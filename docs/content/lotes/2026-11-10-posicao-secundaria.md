# Lote T-080: Posição secundária (pt-BR, es, en)

Status: aprovado pelo CEO em 2026-11-10 ("ok recomendado"), com a ajuda do card na variante B, sem número. Total: **4 chaves**, todas para `ui.json` dos três idiomas, mesmas chaves e mesmos placeholders. Nenhum nome real.

**Entrada no jogo:** os textos ainda não estão em `app/src/content/`. Cada chave entra só na tarefa que a usa: `lineup.fit.secondary` na T-079; `player.secondaryPosition`, `player.secondaryPosition.hint` e `squad.secondaryPosition.a11y` na T-081.

Regra do jogo em `docs/design/posicao-secundaria.md`; telas em `docs/design/telas/escalacao.md`, `elenco.md` e `jogador.md` (seções "Posição secundária").

## Textos

| Chave                           | pt-BR                                                                       | es                                                                          | en                                                                                     |
| ------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- |
| `lineup.fit.secondary`          | Posição secundária                                                          | Posición secundaria                                                         | Secondary position                                                                     |
| `player.secondaryPosition`      | Posição secundária                                                          | Posición secundaria                                                         | Secondary position                                                                     |
| `player.secondaryPosition.hint` | Outra posição em que ele joga bem. Ali rende um pouco menos que na natural. | Otra posición donde juega bien. Allí rinde un poco menos que en la natural. | Another position he plays well in. There he performs a little below his natural level. |
| `squad.secondaryPosition.a11y`  | {natural}, também joga de {secondary}                                       | {natural}, también juega de {secondary}                                     | {natural}, also plays as {secondary}                                                   |

## Onde cada chave é usada

- `lineup.fit.secondary` (T-079): rótulo da marca na vaga e do selo do candidato na Escalação, par de `lineup.fit.improvised`. Em minúsculas, também fecha o nome acessível ("…, posição secundária"). Cabe em 2 linhas de cerca de 60 px na face condensada de 12 px; a maior palavra tem 10 letras (menos que "Improvisado").
- `player.secondaryPosition` (T-081): rótulo (`dt`) do campo no card do jogador.
- `player.secondaryPosition.hint` (T-081): ajuda curta embaixo do par no card.
- `squad.secondaryPosition.a11y` (T-081): nome acessível da posição na linha do Elenco e da Escalação. O `{natural}` é `position.<P>` e o `{secondary}` chega em minúsculas. Concordância: "joga de" (pt-BR e es) e "plays as" (en) servem às cinco posições de linha; goleiro não tem secundária.

## Decisão: a ajuda não cita número

O CEO escolheu a variante B (sem "95%"). Motivo: o número seria texto fixo, sem ligação com `SECONDARY_FIT` (a tela não o lê, ADR-0022). Se a constante mudar no `/balance`, os três idiomas ficariam errados sem aviso. "Um pouco menos" diz o mesmo ao jogador e não envelhece.

Variante descartada (A), para registro: "Outra posição em que ele joga bem. Ali rende 95% do que rende na natural." (es: "...rinde el 95% de lo que rinde en la natural."; en: "...performs at 95% of his natural level.").
