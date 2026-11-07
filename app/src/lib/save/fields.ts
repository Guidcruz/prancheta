import { careerSaveSchema } from './validate.ts';

/*
 * The field names of the save format, read from its strict schema (validate.ts): the keys of
 * every object in it, never the keys of a record (club, player and match ids, round numbers).
 * The error log keeps these in a path and writes `*` for any other segment (US-045; security
 * review LOW-2 of T-023).
 */

type Node = Record<string, unknown>;

const isNode = (value: unknown): value is Node => typeof value === 'object' && value !== null;

/** The object keys of a valibot schema, at any depth (wrappers, pipes, unions, arrays). */
export function fieldNamesOf(schema: unknown): Set<string> {
  const names = new Set<string>();
  const seen = new Set<unknown>();
  const stack: unknown[] = [schema];
  while (stack.length > 0) {
    const node = stack.pop();
    if (!isNode(node) || seen.has(node)) continue;
    seen.add(node);
    if (node.kind !== undefined && node.kind !== 'schema') continue;
    if (isNode(node.entries)) {
      for (const [key, entry] of Object.entries(node.entries)) {
        names.add(key);
        stack.push(entry);
      }
    }
    // A record: its keys are data, only its value is walked.
    if (node.type === 'record') stack.push(node.value);
    for (const child of ['item', 'wrapped', 'rest']) stack.push(node[child]);
    for (const list of ['items', 'options', 'pipe']) {
      if (Array.isArray(node[list])) stack.push(...(node[list] as unknown[]));
    }
  }
  return names;
}

export const SAVE_FIELD_NAMES: ReadonlySet<string> = fieldNamesOf(careerSaveSchema);
