# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versionamento semântico.

## [Não lançado]

### Adicionado

- Dia 1: site com devlog, roteiro, apoio e privacidade; versão zero do jogo em `/jogo` (tela inicial, PWA instalável); configuração central da marca; tokens do design system; motor com gerador aleatório determinístico e gerador de escudos; kit da empresa de agentes adaptado ao projeto.
- Fundações do motor (T-001) em `app/src/engine/`: tipos base (`types.ts`), resultado tipado `ok`/`fail` (`result.ts`), `ENGINE_VERSION = 1` (`version.ts`) e utilitários numéricos determinísticos (`math.ts`: clamp, exp, normal).
- Utilitário de golden (`testing/golden.ts`, `__golden__/foundations.json`) e o script `npm run golden:update -w app`, que recusa sobrescrever um golden alterado sem subir `ENGINE_VERSION`.
- `GameParams` (T-002): `app/src/engine/params.ts` com tipos somente leitura, `PARAM_RANGES`, `validateParams` (nunca lança; lista todos os `ParamIssue`) e as constantes `SEASON_WEEKS = 34` e `SEASON_ROUNDS = 38`.
- Seis JSON em `app/src/params/` (`match`, `players`, `generation`, `ai`, `season`, `fans`), com `match.homeBase = 0.05` (ADR-0011) e valores da ADR-0005 fixos; `fatigue`, `injury` e `cards` são grupos dentro de `match.json`.
- `loadGameParams()` em `app/src/lib/params.ts`: valida uma vez e devolve os parâmetros congelados.
- Teste que prende os JSON às tabelas de `docs/design/`.

### Alterado

- Lint de fronteira do motor ampliado: sem `ui`, `lib`, `content`, `params`, `data`, DOM, `Intl`, `process` nem `node:*`; sem `Math.random`, `Date.now`, `localeCompare` e `toLocale*`; imports relativos com extensão `.ts`; código de produção não importa `testing/`. Fora do motor: `ui` não importa `lib/save` e `lib` não importa `ui`.
- `erasableSyntaxOnly` ligado em `app/tsconfig.json`.
- `engines.node` passa a exigir `>= 22.18`.
- O tamanho do elenco (25) deixou de ser parâmetro e virou constante.
