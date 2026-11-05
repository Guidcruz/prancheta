# ADR-0018: Meta do favorito por 20 pontos vira a faixa de 62% a 68%, com centro realista em 63%

- **Status:** Aceito (CEO, 2026-11-05)
- **Data:** 2026-11-05
- **Decisores:** game-designer (mediu e propôs em `docs/design/balance-log.md`, T-016, decisão 1), project-auditor (apontou a falta do ADR, `docs/reports/auditoria-2026-11-05/planejamento.md`, achado 10), architect (redigiu), CEO (decidiu em 2026-11-05: `kChance` 0,125 na T-016 e este ADR na auditoria, decisão 8)
- **Substitui em parte:** `docs/PROJETO.md` › "Cálculo da partida", a frase "um clube 20 pontos mais forte deve vencer cerca de 65% das vezes".

## Contexto

O `docs/PROJETO.md` pede que um clube 20 pontos mais forte vença "cerca de 65%" das partidas, e o `docs/design/balance-targets.md` traduziu isso na meta de 65% com tolerância de 62% a 68%. Na T-016, o `/balance` mostrou que o único botão que move a zebra de 30 pontos é `match.kChance`, e ele move as duas metas juntas: com 0,14, o favorito vence 65,3% e a zebra fica em 7,3%, abaixo da faixa de 8% a 12%; com 0,125, o favorito vence de 62,4% a 62,8% e a zebra fica de 8,1% a 8,4% (3 sementes, 200 temporadas cada). O motor não chega ao centro das duas metas ao mesmo tempo. O CEO aprovou 0,125 (decisão 1 da T-016), o que, na prática, troca o centro de 65% por 63%. A meta do `PROJETO.md` não tinha mudado, e mudar uma meta que vem de lá exige ADR (`balance-targets.md`).

O `docs/PROJETO.md` está congelado e não é editado. Este ADR prevalece sobre o trecho acima, na versão de 2026-11-05.

## Opções consideradas

| Opção                                                                           | Prós                                                                                            | Contras                                                                                                               |
| ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| A: `kChance` 0,125; "cerca de 65%" passa a ser a faixa de 62% a 68%, centro 63% | as duas metas dentro da faixa; mais zebra, que é o que faz o jogo surpreender; já está no motor | o favorito fica encostado no piso (62%); o número que o `PROJETO.md` cita deixa de ser o centro                       |
| B: voltar a `kChance` 0,14 (65%) e baixar a meta da zebra para 7% a 11%         | o favorito no centro da meta original                                                           | menos zebra; mexe na outra meta, que também vem do `PROJETO.md` (outro ADR); refaz a calibragem e os goldens da T-016 |

## Decisão

**Opção A.** A meta do favorito por 20 pontos é a **faixa de 62% a 68%**, com **centro realista em 63%**, e `match.kChance` fica em 0,125. "Cerca de 65%" no `PROJETO.md` passa a ser lido como essa faixa. A zebra de 30 pontos continua com a faixa de 8% a 12% do `balance-targets.md`. 63% ainda quer dizer que o favorito ganha quase 2 de cada 3 jogos, e a zebra é a parte do jogo que surpreende.

## Consequências

- **Positivo:** o `/balance` da T-016 já passa com 35 de 35 metas obrigatórias nas 3 sementes, sem mudar código nem parâmetro. O `balance-targets.md` já tem a faixa de 62% a 68%; este ADR só registra que o centro de referência é 63% e que estar perto do piso é esperado, não defeito.
- **Negativo (risco):** as duas metas ficam com **menos de 1 ponto de folga** em todas as sementes: o favorito mediu de 62,4% a 62,8% (piso 62%) e a zebra de 8,1% a 8,4% (piso 8%). Qualquer ajuste futuro que mexa no equilíbrio das partidas (`kChance`, `kFinish`, `baseChance`, mando, posturas, fadiga, moral, a renovação dos elencos da T-048) pode tirar uma das duas da faixa, e o `/balance` vai acusar. Como `kChance` puxa as duas para lados opostos, o conserto não é "subir um pouco o `kChance`": quem propõe o ajuste mede as duas juntas.
- **Pendências:**
  - Feito no mesmo PR deste ADR (`game-designer`): a coluna "Meta" do `balance-targets.md` traz 63% na linha do favorito por 20 pontos, citando este ADR; a tolerância não muda.
  - `game-designer`: todo `/balance` que mexa no equilíbrio das partidas registra no `balance-log.md` a folga das duas metas (distância até o piso, por semente).
  - Se um ajuste futuro não conseguir manter as duas dentro, a saída é uma decisão de diversão do CEO (mais zebra ou favorito mais confiável) e um ADR novo, nunca um alargamento silencioso da faixa.

## Conformidade

O `/balance` (`scripts/balance/`) compara a vitória do favorito por 20 pontos com 62% a 68% e a zebra de 30 pontos com 8% a 12%, e sai com código diferente de 0 se uma das duas cair fora. Mudar `match.kChance` dentro da faixa válida continua sendo ajuste de parâmetro (`/quick` + `/balance`), desde que as duas metas fiquem dentro. Mudar qualquer uma das duas faixas exige ADR.
