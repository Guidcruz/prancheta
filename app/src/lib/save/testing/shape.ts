/*
 * The shape of the save format (docs/02-architecture.md, 4.2, "Migração"; ADR-0006): the tree of
 * keys and types, with optional keys marked `?`, records as `{}`, lists as `[]`, closed lists and
 * variants with their values. It is read from the strict schema (validate.ts), so it does not
 * depend on what a sample career happened to produce, except at the nodes the engine validates
 * itself (`validatePlayer` for players, `validateClubs` for the club definitions): there the
 * schema is opaque, and the shape is read from the sample values, merged. Players and club
 * definitions have the same keys in every career, so the result is stable under any tuning.
 * The limit: at those nodes a key that is optional but present in every sample (as
 * `ClubDef.aiProfile` in the 2026 data) is shown as required, so a sample without it changes the
 * shape without a change of format (see fixtures.test.ts).
 *
 * Test-only (fixtures.test.ts): the frozen `__fixtures__/shape-vN.json` is this function's output
 * for the format N, and a save made now must give the same.
 */

export type Shape = string | Shape[] | { readonly [key: string]: Shape };

interface Node {
  readonly type: string;
  readonly entries?: Readonly<Record<string, Node>>;
  readonly item?: Node;
  readonly items?: readonly Node[];
  readonly value?: Node;
  readonly wrapped?: Node;
  readonly options?: readonly unknown[];
  readonly literal?: unknown;
  readonly key?: string;
}

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value);

const sortKeys = (entries: [string, Shape][]): Record<string, Shape> =>
  Object.fromEntries(entries.sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)));

/** The shape of sample values (for the opaque nodes): keys merged, `?` when not in every one. */
export function dataShape(samples: readonly unknown[]): Shape {
  const kinds = new Set<string>();
  const objects: Record<string, unknown>[] = [];
  const lists: unknown[][] = [];
  for (const sample of samples) {
    if (Array.isArray(sample)) {
      kinds.add('[]');
      lists.push(sample);
    } else if (isObject(sample)) {
      kinds.add('{}');
      objects.push(sample);
    } else {
      kinds.add(sample === null ? 'null' : typeof sample);
    }
  }
  const parts: Shape[] = [];
  for (const kind of [...kinds].sort()) {
    if (kind === '{}') {
      const keys = new Set(objects.flatMap((o) => Object.keys(o)));
      parts.push(
        sortKeys(
          [...keys].map((key) => {
            const present = objects.filter((o) => Object.hasOwn(o, key));
            const name = present.length === objects.length ? key : `${key}?`;
            return [name, dataShape(present.map((o) => o[key]))];
          }),
        ),
      );
    } else if (kind === '[]') {
      parts.push({ '[]': dataShape(lists.flat()) });
    } else {
      parts.push(kind);
    }
  }
  return parts.length === 1 ? parts[0]! : parts;
}

const label = (value: unknown) => JSON.stringify(value);

/** The values a node of `values` holds: the entry `key` of each object. */
const field = (values: readonly unknown[], key: string) =>
  values.filter(isObject).flatMap((o) => (Object.hasOwn(o, key) ? [o[key]] : []));

/**
 * The shape of a valibot schema; `samples` are values at this node of real saves, read only by
 * the opaque (`custom`) nodes.
 */
export function formatShape(schema: unknown, samples: readonly unknown[] = []): Shape {
  const node = schema as Node;
  switch (node.type) {
    case 'string':
    case 'number':
    case 'boolean':
      return node.type;
    case 'literal':
      return `literal ${label(node.literal)}`;
    case 'picklist':
      return `one of ${node.options!.map(label).sort().join(' | ')}`;
    case 'exact_optional':
    case 'optional':
      return formatShape(node.wrapped, samples);
    case 'strict_object':
    case 'object':
    case 'loose_object': {
      const entries = Object.entries(node.entries!).map(([key, entry]): [string, Shape] => {
        const optional = entry.type === 'exact_optional' || entry.type === 'optional';
        return [optional ? `${key}?` : key, formatShape(entry, field(samples, key))];
      });
      return sortKeys(entries);
    }
    case 'record':
      return { '{}': formatShape(node.value, samples.filter(isObject).flatMap(Object.values)) };
    case 'array':
      return { '[]': formatShape(node.item, samples.filter(Array.isArray).flat()) };
    case 'strict_tuple':
    case 'tuple':
      return node.items!.map((item, i) =>
        formatShape(
          item,
          samples.filter(Array.isArray).map((s) => s[i]),
        ),
      );
    case 'variant': {
      const key = node.key!;
      const options = (node.options as Node[]).map((option): [string, Shape] => {
        const discriminator = option.entries![key]!;
        const tag = String(formatShape(discriminator));
        const accepts = (value: unknown) =>
          discriminator.type === 'literal'
            ? value === discriminator.literal
            : discriminator.options!.includes(value);
        const own = samples.filter((s) => isObject(s) && accepts(s[key]));
        return [tag, formatShape(option, own)];
      });
      return { [`variant by ${key}`]: sortKeys(options) };
    }
    case 'union':
      return { 'any of': (node.options as Node[]).map((option) => formatShape(option, samples)) };
    case 'custom':
      return samples.length === 0 ? 'opaque' : dataShape(samples);
    default:
      throw new Error(`formatShape: unknown schema type ${node.type}`);
  }
}

/** Every path of a shape, dotted (`game.players.{}.name.display`), for the assertions. */
export function shapePaths(shape: Shape, prefix = ''): string[] {
  if (typeof shape === 'string') return [];
  const entries = Array.isArray(shape)
    ? shape.map((s, i): [string, Shape] => [String(i), s])
    : Object.entries(shape);
  return entries.flatMap(([key, child]) => {
    const path = prefix === '' ? key : `${prefix}.${key}`;
    return [path, ...shapePaths(child, path)];
  });
}
