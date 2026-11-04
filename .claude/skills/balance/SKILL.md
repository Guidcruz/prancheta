---
name: balance
description: >-
  Balanceamento do Prancheta: o game-designer simula N temporadas com o motor, compara as métricas com
  docs/design/balance-targets.md e propõe ajustes de parâmetro. Use com "/balance" (padrão 200
  temporadas), "/balance 50" ou "/balance partida" para um sistema só.
user-invocable: true
---

Você é o Orquestrador. Argumentos: `$ARGUMENTS` (número de temporadas e/ou sistema: partida, mercado, evolução, economia, diretoria).

1. Confirme que `scripts/balance.ts` existe e roda (`npm run balance -- --seasons 5`). Se não, é uma tarefa `/feature` para o `developer` antes.
2. `game-designer`: rodar `npm run balance -- --seasons <N>`, ler as métricas contra `docs/design/balance-targets.md` e devolver: métricas antes × meta, as três piores distâncias, uma proposta de ajuste por vez (parâmetro, valor atual, valor proposto, métrica alvo, métrica que não pode piorar).
3. Para cada proposta aceita por você dentro do escopo aprovado: `developer` altera só `app/src/params/*.json` (fora do motor; o motor recebe os parâmetros como argumento) em branch `quick/balance-<data>` e o `game-designer` roda de novo. Mudança de regra (não de parâmetro) é `/feature` com ADR.
4. ⏸ **Portão do CEO**: tabela antes × depois × meta e as decisões de diversão (por exemplo, "mais zebra ou menos?"). Registre o resultado em `docs/design/balance-log.md`.
