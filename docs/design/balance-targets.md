# Metas de balanceamento

> Mantido pelo `game-designer`. As metas de gols, de vantagem do time mais forte e de zebra vêm de `docs/PROJETO.md` ("Regras do jogo", "Cálculo da partida"); as demais são metas de diversão e realismo deste documento. O `/balance` compara a simulação com esta tabela. Mudar uma meta que veio do `PROJETO.md` é ADR; mudar uma meta própria deste documento é proposta do `game-designer` aprovada pelo CEO.

## Como o `/balance` mede

- **Comando:** `npm run balance -- --seasons 200 --seed 1` (script `scripts/balance.ts`, mantido pelo `developer`).
- **Temporadas de liga:** 200 temporadas completas da Série A (20 clubes, 380 jogos cada, 76.000 jogos no total), todas com a IA nos dois lados. A temporada `i` usa a semente `seedFromString("balance-<seed>-<i>")`, com elencos gerados do zero (ver `jogadores.md`, "Geração de elencos").
- **Duelos calibrados:** além da liga, 20.000 jogos em campo neutro para cada diferença de força (0, 10, 20 e 30 pontos), com dois elencos sintéticos gerados com força exata (`clubStrengthSd = 0`), os dois em 4-4-2, postura equilibrada, pressão média, termômetro 55. É assim que as metas "20 pontos" e "30 pontos" ficam bem definidas: na Série A, diferenças de 30 pontos quase não acontecem.
- **Duelos táticos:** 20.000 jogos em campo neutro entre elencos iguais (força 70), variando só um ajuste (formação, postura ou pressão) contra a referência 4-4-2, equilibrada, média.
- **Três sementes:** uma proposta de ajuste só é aceita se todas as metas da 1a passam com `--seed 1`, `--seed 2` e `--seed 3`. Isso evita calibrar para o acaso de uma semente.
- **"Força" de um time:** média de `overall × fit` dos 11 titulares escalados (sem condição, moral nem mando). É o número que a interface mostra e o que a meta "20 pontos mais forte" usa.
- **Erro de amostra:** com 76.000 jogos, o erro padrão de uma proporção fica abaixo de 0,2 ponto percentual e o da média de gols abaixo de 0,01; com 20.000 duelos, abaixo de 0,4 ponto. As tolerâncias abaixo são bem maiores que isso: estar fora da tolerância é problema de regra, não de sorte.

## Metas

Legenda da coluna Etapa: **1a** vale agora e bloqueia a entrega; **futura** é medida a partir da etapa indicada (o `/balance` imprime "n/a" até lá).

| Métrica                                         | Meta                            | Tolerância (falha fora disto)                    | Como medir                                                                  | Etapa       | Origem       |
| ----------------------------------------------- | ------------------------------- | ------------------------------------------------ | --------------------------------------------------------------------------- | ----------- | ------------ |
| Gols por partida                                | 2,65                            | 2,50 a 2,80                                      | média nas 200 temporadas                                                    | 1a          | PROJETO      |
| Vitória do time 20 pontos mais forte            | 65%                             | 62% a 68%                                        | duelos calibrados, diferença 20                                             | 1a          | PROJETO      |
| Zebra: time 30 pontos mais fraco vence          | 10%                             | 8% a 12%                                         | duelos calibrados, diferença 30                                             | 1a          | PROJETO      |
| Empates                                         | 26%                             | 24% a 28%                                        | proporção nas 200 temporadas                                                | 1a          | próprio      |
| Vitórias do mandante                            | 47,5%                           | 45% a 50%                                        | proporção nas 200 temporadas (sem altitude na 1a)                           | 1a          | próprio      |
| Placar mais comum                               | 1×1 e 1×0                       | os dois entre os 3 placares mais frequentes      | distribuição de placares mandante×visitante (0×1 e 1×0 contam separados) | 1a          | próprio      |
| Pontos do campeão                               | 77                              | média entre 72 e 82                              | média dos campeões nas 200 temporadas                                       | 1a          | próprio      |
| Pontos do 17º colocado                          | 43                              | média entre 40 e 46                              | média nas 200 temporadas                                                    | 1a          | próprio      |
| Amarelos por partida                            | 4,0                             | 3,5 a 4,5                                        | média nas 200 temporadas, os dois times                                     | 1a          | próprio      |
| Vermelhos por partida                           | 0,18                            | 0,11 a 0,25                                      | idem (direto + segundo amarelo)                                             | 1a          | próprio      |
| Lesões por partida                              | 0,30                            | 0,20 a 0,40                                      | idem; duração média entre 2 e 3 rodadas                                     | 1a          | próprio      |
| Pênaltis por partida                            | 0,25                            | 0,17 a 0,33                                      | idem; conversão entre 72% e 82%                                             | 1a          | próprio      |
| Nenhuma tática dominante                        | vitórias − derrotas = 0         | entre −3 e +3 pontos percentuais                 | duelos táticos, cada formação, postura e pressão contra a referência        | 1a          | próprio      |
| "Tudo no ataque" serve para buscar o empate     | ajuda quando se perde por 1     | P(não perder) sobe ≥ 3 pontos vs. equilibrada    | 20.000 jogos a partir de 0×1 aos 75', elencos iguais                        | 1a          | próprio      |
| Campeão por porte                               | grande vence a maioria          | grande 50% a 75%; pequeno 0,5% a 3%              | porte do campeão nas 200 temporadas                                         | 1a          | próprio      |
| Grande rebaixado                                | raro, mas possível              | 1% a 5% das temporadas com ao menos um grande    | idem                                                                        | 1a          | próprio      |
| Termômetro da torcida                           | média 55                        | média 50 a 60; < 20 ou > 90 em no máximo 5% cada | todas as rodadas de todos os clubes                                         | 1a          | próprio      |
| Inflação de salários                            | 0% ao ano                       | ±1% ao ano, corrigida pelo índice interno        | média após 20 temporadas                                                    | futura (3)  | PROJETO      |
| Público médio                                   | 55% a 70% da capacidade         | média por porte dentro da faixa                  | média por porte (na 1a o público é só exibido; ver `torcida.md`)            | futura (3)  | próprio      |
| Frequência de eventos das Brasilidades          | nenhuma "tragédia toda temporada" | a definir com o sistema                         | contagem por temporada (ADR-0005)                                           | futura (2–4) | ADR-0005     |

## Calibração inicial (protótipo)

Os valores iniciais dos parâmetros em `partida.md` foram escolhidos num protótipo simplificado (times com todos os atributos iguais à força, sem formação nem jogadores individuais), não no motor. Resultado com os valores propostos e o fator casa de 5% da decisão 1 abaixo:

| Métrica                        | Protótipo | Meta       |
| ------------------------------ | --------- | ---------- |
| Gols por partida               | 2,63      | 2,50–2,80  |
| 20 pontos mais forte vence     | 66,9%     | 62–68%     |
| 30 pontos mais fraco vence     | 9,0%      | 8–12%      |
| Empates                        | 24,8%     | 24–28%     |
| Mandante vence                 | 47,0%     | 45–50%     |
| Placares mais comuns           | 1×1 12,5%, 1×0 11,0% | 1×1 e 1×0 |
| Campeão / 17º                  | 73,7 / 40,7 | 72–82 / 40–46 |
| Amarelos / lesões por partida  | 4,07 / 0,31 | 3,5–4,5 / 0,2–0,4 |

Sem o fator casa (só os 2% a 8% da torcida), o mandante vence 42,4%: abaixo da meta. Postura, pressão e formações ficaram entre −1,5 e +1,9 ponto de saldo contra a referência. O motor real, com jogadores, posições e substituições, vai deslocar esses números; o primeiro `/balance` do motor recalibra `match.baseChance`, `match.kChance` e `match.kFinish`, nesta ordem e um por vez.

## Decisões de diversão (do CEO)

Cada uma com a minha recomendação. Nenhuma bloqueia o início da implementação: o motor recebe tudo por parâmetro.

1. **Fator casa além da torcida.** O `PROJETO.md` e a ADR-0005 fixam o bônus de mando em +2% (torcida fria) a +8% (em festa). Com só isso, o mandante vence 42% dos jogos; no Brasileirão real é perto de 48%. **Recomendo** somar um fator casa fixo de +5% (viagem, gramado, costume), parâmetro `match.homeBase = 0.05`, o que leva o total a +7% a +13%. Mexe numa faixa escrita no `PROJETO.md`, então precisa de ADR. Sem aprovação, `match.homeBase = 0` e baixamos a meta de vitórias do mandante para 40% a 45%.
2. **Quanto de zebra.** Proposta: 20 pontos mais forte vence 65% e o 30 pontos mais fraco vence 9% a 10% (dentro do `PROJETO.md`). O botão é `match.kChance` (menor = mais zebra). **Recomendo** manter o centro da meta; se os testes com amigos acharem o jogo "injusto", o próximo passo é `match.dayFormSd` de 3 para 4, que espalha a zebra sem mexer na média de gols.
3. **Variação entre carreiras.** A força de cada clube varia um pouco a cada carreira nova (`generation.clubStrengthSd`). **Recomendo** 1,5 ponto: o favorito muda de uma carreira para outra e um pequeno campeão acontece em cerca de 1% das temporadas, sem desmontar a hierarquia dos clubes.
4. **Quanto a torcida pesa.** Na 1a a torcida mexe no mando (+2% a +8%) e na moral (1 ponto por rodada). **Recomendo** manter os valores da ADR-0005 e não acrescentar efeito na 1a; o resto entra na Etapa 3.
5. **O que acontece depois da rodada 38 na 1a.** Ver `temporada.md`, "Fim de temporada". **Recomendo** a opção B (seguir para uma nova temporada com os mesmos 20 clubes e acesso abstrato de 4 clubes da Série B, só com nome e força), que exige a lista de 4 a 8 clubes extras do CEO; se a lista não vier a tempo, a opção A (a carreira termina no resumo da temporada).
6. **Expectativa da diretoria na 1a.** Demissão e barra de confiança são da Etapa 4. **Recomendo** mostrar a meta da temporada por porte, só como informação (cumprida ou não no resumo), sem consequência.
7. **Padrão de "Realismo".** **Recomendo** "ligado" como padrão (lesões, cartões e fadiga completos da 1a); o "simplificado" fica para quem quer partidas rápidas sem rotação.
