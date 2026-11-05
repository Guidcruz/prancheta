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

| Métrica                                     | Meta                                                                | Tolerância (falha fora disto)                                                | Como medir                                                               | Etapa        | Origem   |
| ------------------------------------------- | ------------------------------------------------------------------- | ---------------------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------ | -------- |
| Gols por partida                            | 2,65                                                                | 2,50 a 2,80                                                                  | média nas 200 temporadas                                                 | 1a           | PROJETO  |
| Vitória do time 20 pontos mais forte        | 65%                                                                 | 62% a 68%                                                                    | duelos calibrados, diferença 20                                          | 1a           | PROJETO  |
| Zebra: time 30 pontos mais fraco vence      | 10%                                                                 | 8% a 12%                                                                     | duelos calibrados, diferença 30                                          | 1a           | PROJETO  |
| Empates                                     | 26%                                                                 | 24% a 28%                                                                    | proporção nas 200 temporadas                                             | 1a           | próprio  |
| Vitórias do mandante                        | 47,5%                                                               | 45% a 50%                                                                    | proporção nas 200 temporadas (sem altitude na 1a)                        | 1a           | próprio  |
| Placar mais comum                           | 1×1 e 1×0                                                           | os dois entre os 3 placares mais frequentes                                  | distribuição de placares mandante×visitante (0×1 e 1×0 contam separados) | 1a           | próprio  |
| 0×0                                         | 7%                                                                  | 6% a 9% dos jogos (decisão do CEO, 2026-11-04)                               | proporção nas 200 temporadas                                             | 1a           | CEO      |
| Goleada (diferença ≥ 3)                     | 11%                                                                 | 8% a 13% dos jogos (CEO pediu 7% a 11%; ajustada pela conta abaixo)          | proporção nas 200 temporadas                                             | 1a           | CEO      |
| Placar grande (diferença ≥ 5)               | 1%                                                                  | 0,5% a 2% dos jogos (raro, mas presente)                                     | proporção nas 200 temporadas                                             | 1a           | CEO      |
| Pontos do campeão                           | 77                                                                  | média entre 72 e 82                                                          | média dos campeões nas 200 temporadas                                    | 1a           | próprio  |
| Pontos do 17º colocado                      | 42                                                                  | média entre 39 e 45 (decisão do CEO, 2026-11-05; decisão 8)                  | média nas 200 temporadas                                                 | 1a           | CEO      |
| Amarelos por partida                        | 4,0                                                                 | 3,5 a 4,5                                                                    | média nas 200 temporadas, os dois times                                  | 1a           | próprio  |
| Vermelhos por partida                       | 0,18                                                                | 0,11 a 0,25                                                                  | idem (direto + segundo amarelo)                                          | 1a           | próprio  |
| Lesões por partida                          | 0,30                                                                | 0,20 a 0,40                                                                  | idem; duração média entre 2 e 3 rodadas                                  | 1a           | próprio  |
| Pênaltis por partida                        | 0,25                                                                | 0,17 a 0,33                                                                  | idem; conversão entre 72% e 82%                                          | 1a           | próprio  |
| Nenhuma tática dominante                    | vitórias − derrotas = 0                                             | entre −3 e +3 pontos percentuais                                             | duelos táticos, cada formação, postura e pressão contra a referência     | 1a           | próprio  |
| "Tudo no ataque" serve para buscar o empate | ajuda quando se perde por 1                                         | P(não perder) sobe ≥ 3 pontos vs. equilibrada                                | 20.000 jogos a partir de 0×1 aos 75', elencos iguais                     | 1a           | próprio  |
| Campeão por porte                           | grande vence a maioria; pequeno ou médio campeão raro, mas possível | grande 50% a 85%; pequeno 0,5% a 3% (decisão do CEO, 2026-11-04)             | porte do campeão nas 200 temporadas                                      | 1a           | próprio  |
| Grande rebaixado                            | comum, como no Brasil real (12 grandes; porte ≠ força)              | 40% a 80% das temporadas com ao menos um grande (decisão do CEO, 2026-11-04) | idem                                                                     | 1a           | próprio  |
| Termômetro da torcida                       | média 55                                                            | média 50 a 60; < 20 ou > 90 em no máximo 5% cada                             | todas as rodadas de todos os clubes                                      | 1a           | próprio  |
| Inflação de salários                        | 0% ao ano                                                           | ±1% ao ano, corrigida pelo índice interno                                    | média após 20 temporadas                                                 | futura (3)   | PROJETO  |
| Público médio                               | 55% a 70% da capacidade                                             | média por porte dentro da faixa                                              | média por porte (na 1a o público é só exibido; ver `torcida.md`)         | futura (3)   | próprio  |
| Frequência de eventos das Brasilidades      | nenhuma "tragédia toda temporada"                                   | a definir com o sistema                                                      | contagem por temporada (ADR-0005)                                        | futura (2–4) | ADR-0005 |

## Calibração inicial (protótipo)

Os valores iniciais dos parâmetros em `partida.md` foram escolhidos num protótipo simplificado (times com todos os atributos iguais à força, sem formação nem jogadores individuais), não no motor. Resultado com os valores propostos e o fator casa de 5% da decisão 1 abaixo:

| Métrica                       | Protótipo            | Meta              |
| ----------------------------- | -------------------- | ----------------- |
| Gols por partida              | 2,63                 | 2,50–2,80         |
| 20 pontos mais forte vence    | 66,9%                | 62–68%            |
| 30 pontos mais fraco vence    | 9,0%                 | 8–12%             |
| Empates                       | 24,8%                | 24–28%            |
| Mandante vence                | 47,0%                | 45–50%            |
| Placares mais comuns          | 1×1 12,5%, 1×0 11,0% | 1×1 e 1×0         |
| Campeão / 17º                 | 73,7 / 40,7          | 72–82 / 39–45     |
| Amarelos / lesões por partida | 4,07 / 0,31          | 3,5–4,5 / 0,2–0,4 |

Sem o fator casa (só os 2% a 8% da torcida), o mandante vence 42,4%: abaixo da meta. Postura, pressão e formações ficaram entre −1,5 e +1,9 ponto de saldo contra a referência. O motor real, com jogadores, posições e substituições, vai deslocar esses números; o primeiro `/balance` do motor recalibra `match.baseChance`, `match.kChance` e `match.kFinish`, nesta ordem e um por vez.

**Metas de placar (T-016), conferidas contra as outras metas.** O protótipo antigo não mediu 0×0 nem goleadas; refiz a conta com gols de Poisson por time, a escada de força da Série A, `kChance` calibrado para 20 pontos → 66% e mando dando 46% de vitórias do mandante (modelo de conferência, não o motor):

| Gols por partida | 0×0  | Diferença ≥ 3 | Diferença ≥ 5 | Empates |
| ---------------- | ---- | ------------- | ------------- | ------- |
| 2,50             | 8,2% | 12,6%         | 1,0%          | 25,9%   |
| 2,65             | 7,1% | 13,8%         | 1,2%          | 24,9%   |
| 2,80             | 6,1% | 14,9%         | 1,5%          | 24,0%   |

- **0×0 em 6% a 9%:** coerente com 2,50 a 2,80 gols; mantida.
- **Goleada:** com 2,65 gols e a escada atual, a conta dá cerca de 14%; 7% a 11% exigiria menos gols (abaixo de 2,5) ou menos diferença entre os clubes (menos zebra contrária e campeão com menos pontos). O motor deve ficar um pouco abaixo do Poisson, porque o time que ganha por 2 ou mais segura o resultado a partir dos 75' (`ia-clubes.md`) e o que perde arrisca mais e também sofre. Por isso a faixa fica em **8% a 13%**, centro 11%: abaixo da conta pura, sem conflitar com gols por partida nem com a vitória do mais forte. **Corrigido depois da T-012:** o motor segue o Poisson (14,9% com 2,76 gols), e "segurar o resultado" não o puxa para baixo (medido: menos de 1 ponto, mesmo estendido a quem ganha por 2 ou mais). O ajuste proposto é a regra "tirar o pé" e depois `match.baseChance`, não `kChance` (que mexe na zebra); ver `partida.md`, "Calibragem das goleadas".
- **Diferença ≥ 5 em 0,5% a 2%:** a conta dá 1,0% a 1,5% (cerca de 4 a 6 jogos por temporada de 380); o 0,3% a 1,5% do exemplo cortaria o próprio centro da conta perto de 2,8 gols.

## Decisões de diversão (do CEO)

Cada uma com a minha recomendação. Nenhuma bloqueia o início da implementação: o motor recebe tudo por parâmetro.

1. **Fator casa além da torcida.** O `PROJETO.md` e a ADR-0005 fixam o bônus de mando em +2% (torcida fria) a +8% (em festa). Com só isso, o mandante vence 42% dos jogos; no Brasileirão real é perto de 48%. **Decidido (ADR-0011, opção A, CEO em 2026-11-04):** fator casa fixo de +5% (viagem, gramado, costume), `match.homeBase = 0.05`, faixa 0 a 0,08; o mando total vai a +7% a +13%. A meta de vitórias do mandante fica em 45% a 50%.
2. **Quanto de zebra.** Proposta: 20 pontos mais forte vence 65% e o 30 pontos mais fraco vence 9% a 10% (dentro do `PROJETO.md`). O botão é `match.kChance` (menor = mais zebra). **Recomendo** manter o centro da meta; se os testes com amigos acharem o jogo "injusto", o próximo passo é `match.dayFormSd` de 3 para 4, que espalha a zebra sem mexer na média de gols. **Medido no motor (T-012):** `dayFormSd` de 3 para 5 quase não move a zebra de 30 pontos (7,6% para 7,7%), que hoje está abaixo da meta; o botão da zebra é `kChance` (`partida.md`, "Calibragem das goleadas", aviso).
3. **Variação entre carreiras.** A força de cada clube varia um pouco a cada carreira nova (`generation.clubStrengthSd`). **Recomendo** 1,5 ponto: o favorito muda de uma carreira para outra e um pequeno campeão acontece em cerca de 1% das temporadas, sem desmontar a hierarquia dos clubes. Pequeno ou médio campeão deve ser raro, mas possível, pelos caminhos que o jogador controla: tática, zebra e evolução dos jovens (mercado e estrutura entram na Etapa 3).
4. **Quanto a torcida pesa.** Na 1a a torcida mexe no mando (+2% a +8%) e na moral (1 ponto por rodada). **Recomendo** manter os valores da ADR-0005 e não acrescentar efeito na 1a; o resto entra na Etapa 3.
5. **O que acontece depois da rodada 38 na 1a.** Ver `temporada.md`, "Fim de temporada". **Recomendo** a opção B (seguir para uma nova temporada com os mesmos 20 clubes e acesso abstrato de 4 clubes da Série B, só com nome e força), que exige a lista de 4 a 8 clubes extras do CEO; se a lista não vier a tempo, a opção A (a carreira termina no resumo da temporada).
6. **Expectativa da diretoria na 1a.** Demissão e barra de confiança são da Etapa 4. **Decidido (CEO, 2026-11-04):** a meta vem da força (posição de força + 2, no máximo 16º) e o porte dá a paciência e o tom da cobrança; na 1a é só informação e texto (cumprida ou não no resumo), sem consequência. A regra entra na ADR da Etapa 4 (`temporada.md`, "Expectativa da diretoria").
7. **Padrão de "Realismo".** **Recomendo** "ligado" como padrão (lesões, cartões e fadiga completos da 1a); o "simplificado" fica para quem quer partidas rápidas sem rotação.
8. **Pontos do 17º colocado.** **Decidido (aprovado pelo CEO em 2026-11-05):** meta de 42 pontos, tolerância de 39 a 45 (antes 43, de 40 a 46), e a moral fica como está. Motivo: no motor da T-014 o 17º faz 40,1 e 40,2 (2 × 100 carreiras); o laço moral → partida tira cerca de 1 ponto dele e põe o campeão em 77,4, no centro da meta, e nenhum botão existente sobe o 17º sem baixar mais o campeão (`jogadores.md`, "Geração de elencos"). A meta nova segue o Brasileirão real de pontos corridos com 20 clubes: o 17º fez em média cerca de 42 pontos, entre 39 (2006) e 45 (2009). Fontes: [Diário do Nordeste](https://diariodonordeste.verdesmares.com.br/opiniao/colunistas/gustavo-de-negreiros/pontuacao-para-fugir-do-z-4-na-serie-a-2021-pode-ser-maior-que-dos-ultimos-anos-veja-contas-1.3161536) (média de cerca de 42, mínimo 39, máximo 45) e [Trivela](https://trivela.com.br/brasil/campeonato-brasileiro/rebaixamento-brasileirao-maior-pontuacao-nao-se-salvou/) (45 é o recorde de um 17º). **Na T-016 o 17º não precisa de correção, só de medição:** o `/balance` confere a faixa de 39 a 45 nas 3 sementes, depois de "tirar o pé", `baseChance` e `cards.bookedMult`.
