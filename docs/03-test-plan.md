# Plano de testes

> Mantido pelo `qa-engineer`. Atualizado a cada história entregue. A suíte de regressão só cresce; remover um teste exige ADR.

## Ferramentas

| Camada           | Ferramenta                       | Onde                            | Comando                     |
| ---------------- | -------------------------------- | ------------------------------- | --------------------------- |
| Unitário e motor | Vitest                           | ao lado do código (`*.test.ts`) | `npm test`                  |
| E2E (Etapa 1a)   | Playwright                       | `tests/e2e/`                    | a definir                   |
| Regressão        | tudo acima + `tests/regression/` |                                 | `npm run test:all`          |
| Hook de travas   | tabela de comandos               | `scripts/test-hook.sh`          | `bash scripts/test-hook.sh` |

## Regras

1. Todo critério de aceite de `docs/01-requirements.md` tem pelo menos um teste; o mapa abaixo registra.
2. Todo bug (do QA, do CEO ou de produção) ganha um teste que o reproduz antes da correção, com o id (`BUG-NNN`), em `tests/regression/`.
3. Testes determinísticos: sem rede, sem relógio, sem estado compartilhado, sem ordem. O motor tem golden tests: trocar o algoritmo quebra saves, replays e o online.
4. Teste instável é bug: quarentena com issue, nunca apagado.
5. A regressão inteira roda em todo PR e antes de todo release.

## Mapa de cobertura

| História | Critério                       | Teste (arquivo::nome)                   | Camada   | Estado |
| -------- | ------------------------------ | --------------------------------------- | -------- | ------ |
| dia 1    | Rng determinístico e golden    | `app/src/engine/rng.test.ts`            | unitário | feito  |
| dia 1    | textos iguais nos três idiomas | `app/src/lib/i18n.test.ts`              | unitário | feito  |
| dia 1    | escudo estável e seguro        | `app/src/lib/generators/shield.test.ts` | unitário | feito  |
| dia 1    | contraste dos tokens           | `scripts/tokens-to-css.mjs`             | build    | feito  |
| dia 1    | hook de travas                 | `scripts/test-hook.sh`                  | CI       | feito  |

## Registro de regressão

| Bug | Origem | Teste | Data |
| --- | ------ | ----- | ---- |

## Checklist manual do CEO

> O que a automação cobre mal. O Orquestrador inclui os itens relevantes em todo PR.

- [ ] Layout no seu celular (uma mão) e no desktop
- [ ] Textos em pt-BR fazem sentido e têm humor de torcida sem ofender
- [ ] A rodada é divertida: tensão, zebra, mas justa
- [ ] Instalar o app e abrir sem internet
