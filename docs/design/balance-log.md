# Registro do balanceamento

> Mantido pelo `game-designer`. Cada rodada do `/balance` entra aqui: o que foi medido, o que foi proposto, o que o CEO decidiu. As metas estão em `balance-targets.md`; os parâmetros, em `app/src/params/`.

## 2026-11-05: T-016, parte 2 (calibragem)

**Como foi medido.** `npm run balance -- --seasons 200 --seed N` (sementes 1, 2 e 3; 200 temporadas, 76.000 jogos e duelos de 20.000 por semente), sobre uma cópia do código no commit `7f880e7`, com as sobrescritas por `--params`. Os dois ajustes que ainda são constantes do motor (o fator do pendurado e o "tudo no ataque") foram medidos na mesma cópia, com a constante trocada só nela; `app/` e `scripts/` não foram tocados. Os parâmetros propostos estão em `scratchpad/t016-params.json` (carrega no `--params` sem erro).

### Ajustes, um por vez (semente 1; cada linha soma o ajuste às de cima)

| Passo | Ajuste                                                 | Métrica alvo                  | Resultado na semente 1                   | Não pode piorar (ficou)                                                                          |
| ----- | ------------------------------------------------------ | ----------------------------- | ---------------------------------------- | ------------------------------------------------------------------------------------------------ |
| 1     | `match.comfortableLeadPower` 1 → **0,85**              | goleada (8% a 13%)            | 15,1% → 13,3%                            | gols 2,74, 20 pontos 65,2%, zebra 7,3%, empates 24,6%                                            |
| 2     | `match.baseChance` 0,090 → **0,087**                   | gols para o centro; goleada   | gols 2,64; goleada 12,6%                 | 0×0 7,1%, empates 25,1%, mandante 46,9%, 20 pontos 64,8%                                         |
| 3     | fator do pendurado 0,5 → **0,20** (`cards.bookedMult`) | vermelhos (0,11 a 0,25)       | 0,332 → 0,180                            | amarelos 4,46 (igual), gols e goleada iguais                                                     |
| 4     | `fans.reversion` 0,08 → **0,10**                       | termômetro abaixo de 20       | 4,0% → 2,4%                              | média 53,5, desvio 15,9 (acima de 15), campeão e 17º iguais                                      |
| 5     | `match.kChance` 0,14 → **0,125**                       | zebra de 30 pontos (8% a 12%) | 7,4% → 8,5% (0,13 dá 8,3%; 0,12 dá 9,1%) | 20 pontos 63,0% (0,13: 63,4%; 0,12: 62,3%), goleada 12,2%, mandante 46,3%                        |
| 6     | "tudo no ataque" 1,10 · 0,85 → **1,25 · 0,78**         | "tudo no ataque" (≥ +3 p.p.)  | +1,4 → +3,7 p.p.                         | "tudo no ataque" desde o apito inicial: V − D de −3,0 para +1,0 a +2,1 (dentro de ±3); gols 2,64 |

**`match.comfortableLeadGoals`: confirmado 2, faixa de 2 a 5.** Com 1, quem ganha por 1 gol também tiraria o pé e o "segurar o 1×0" viraria regra automática. Acima de 5 a regra quase nunca dispara (diferença de 5 ou mais é 1% dos jogos). A faixa do `developer` está certa.

**O fator do pendurado precisa virar parâmetro** (`cards.bookedMult`, faixa de 0 a 1, valor 0,20), como já previsto em `partida.md` ("Calibragem dos vermelhos"). Pedido ao `developer`.

**O "tudo no ataque" é constante de regra** (tabela de posturas de `partida.md`, `strength.ts`): mudar para 1,25 · 0,78 é pedido ao `developer` com aprovação do CEO (decisão 2 abaixo), não um `--params`.

### Tabela final: antes × depois × meta (sementes 1 / 2 / 3)

"Depois" = os 4 parâmetros de `t016-params.json` + `cards.bookedMult` 0,20 + "tudo no ataque" 1,25 · 0,78.

| Métrica                         | Antes (1 / 2 / 3)       | Depois (1 / 2 / 3)                   | Meta                      |
| ------------------------------- | ----------------------- | ------------------------------------ | ------------------------- |
| Gols por partida                | 2,77 / 2,79 / 2,76      | 2,64 / 2,65 / 2,62                   | 2,50 a 2,80               |
| Time 20 pontos mais forte vence | 65,3 / 65,4 / 65,5%     | 62,8 / 62,6 / 62,4%                  | 62% a 68%                 |
| Zebra de 30 pontos              | 7,3 / 6,9 / 7,5% ✗      | 8,3 / 8,1 / 8,4%                     | 8% a 12%                  |
| Empates                         | 24,6 / 24,2 / 24,8%     | 26,1 / 25,9 / 26,5%                  | 24% a 28%                 |
| Mandante vence                  | 47,2 / 47,5 / 47,2%     | 46,0 / 45,9 / 45,5%                  | 45% a 50%                 |
| 0×0                             | 6,4 / 6,3 / 6,6%        | 7,3 / 7,0 / 7,3%                     | 6% a 9%                   |
| Goleada (≥ 3)                   | 15,1 / 15,1 / 15,0% ✗   | 12,3 / 12,4 / 12,2%                  | 8% a 13%                  |
| Placar grande (≥ 5)             | 1,6 / 1,7 / 1,6%        | 0,9 / 1,0 / 0,9%                     | 0,5% a 2%                 |
| Amarelos                        | 4,46 / 4,45 / 4,45      | 4,46 / 4,46 / 4,46                   | 3,5 a 4,5                 |
| Vermelhos                       | 0,331 / 0,326 / 0,326 ✗ | 0,181 / 0,179 / 0,179                | 0,11 a 0,25               |
| "Tudo no ataque" (0×1 aos 75')  | +1,5 / +1,3 / +1,5 ✗    | +3,7 / +3,5 / +3,1                   | ≥ +3 p.p.                 |
| Táticas (V − D, pior caso)      | −1,6 a +1,3             | −1,7 a +1,4                          | −3 a +3 p.p.              |
| Pontos do campeão               | 76,7 / 77,1 / 77,1      | 75,0 / 75,8 / 75,1                   | 72 a 82                   |
| Pontos do 17º                   | 40,0 / 39,6 / 39,9      | 40,3 / 40,3 / 40,2                   | 39 a 45                   |
| Termômetro abaixo de 20         | 4,3 / 4,1 / 4,3%        | 2,3 / 2,3 / 2,6%                     | no máximo 5%              |
| Campeão grande                  | 87,5 ✗ / 84,5 / 83,0%   | 83,0 / 80,5 / 82,5%                  | 50% a 85%                 |
| Campeão pequeno                 | 0,5 / 1,0 / 1,5%        | 2,0 / 1,0 / 1,5%                     | 0,5% a 3%                 |
| Grande rebaixado                | 98,0 / 98,0 / 96,5% ✗   | 96,0 / 95,0 / 94,5% ✗                | 40% a 80% (ver decisão 3) |
| Clube fraco no G4               | 2,5 ✗ / 3,0 ✗ / 6,0%    | 8,0 / 4,0 / 6,0% (as 3 juntas: 6,0%) | 5% a 15%                  |
| Fuga do Z4 depois da rodada 30  | 19,0 / 17,3 / 19,5%     | 21,9 / 20,5 / 20,4%                  | 15% a 30%                 |
| Fuga do Z4 de 6 a 8 pontos      | 5,8 / 7,0 / 8,8%        | 7,7 / 8,4 / 7,2%                     | ao menos 3%               |
| Robô no Coritibom: ganho        | +3,9 / +5,2 / +3,5      | +4,1 / +3,9 / +4,5                   | +2 a +8 pontos            |
| Título do Coritibom com o robô  | 4,0 / 3,0 / 1,5%        | 4,5 / 3,5 / 3,0%                     | no máximo 5%              |
| **Metas obrigatórias fora**     | 7 / 6 / 5               | 1 / 2 / 1                            | 0                         |

Fica fora em todas as sementes só o "grande rebaixado", que é dado de clube (decisão 3). O "clube fraco no G4" da semente 2 (4,0%) é acaso de amostra: as 3 sementes juntas dão 6,0%.

### Investigações

**Clube fraco no G4: 2,5% no `/balance` contra 7,0% a 7,5% na T-014.** É amostra, não regra. Os 7,0% a 7,5% da T-014 eram das sementes 1 a 200 da cópia do `game-designer`, que caíram num bloco de sorte: nas 1.000 temporadas da mesma cópia o valor é 4,5% com os 4 fixos da lista e 4,3% com os 4 mais fracos pela força efetiva (blocos de 200 temporadas: 7,5; 4,5; 3,0; 4,0; 3,5%). Os 2,5% (força efetiva) e 3,5% (4 fixos) do `/balance` cabem nesse ruído: com 200 temporadas, o erro padrão de uma taxa de 4% é de cerca de 1,4 ponto. O recorte pela força efetiva, como o `developer` fez, é o certo: é o que a tela de Novo jogo mostra. A linha de base estava, de verdade, logo abaixo de 5%; com `kChance` 0,125 vai a cerca de 6% a 7%.

**Regra de medição proposta: metas de tabela raras se julgam com as 3 sementes juntas.** Campeão pequeno (0,5% a 3%), clube fraco no G4 e fuga do Z4 de 6 a 8 pontos são taxas de poucos por cento em 200 temporadas, e uma semente sozinha erra por mais do que a largura da faixa. Proposta: para essas três, a decisão usa as 600 temporadas das 3 sementes (erro padrão de cerca de 0,7 ponto); as outras metas continuam semente a semente. Pedido ao `developer` (não urgente): o relatório imprimir a soma das 3 sementes quando receber `--seed 1,2,3`.

**Robô ofensivo em cerca de 75% dos jogos: não é tática dominante disfarçada.** Medido em 40.000 jogos entre elencos iguais (parâmetros propostos), a ofensiva contra a equilibrada dá 36,8% / 27,3% / 36,0%: 1,375 ponto por jogo contra 1,361 de quem joga equilibrado dos dois lados, ou cerca de +0,5 ponto numa temporada inteira de ofensiva. É o efeito dos 3 pontos (menos empates valem um pouco mais), pequeno perto dos +4 pontos do robô, que vêm sobretudo da escalação e da rotação. As outras variantes dão quase o mesmo (defensiva +0,2, pressão baixa +0,4, 4-3-3 +0,45 por temporada): estão todas dentro do ruído da medida, e a ofensiva não se destaca. O robô a escolhe porque o modelo dele vê um ganho pequeno e real contra cada adversário, não porque ela domina. Pedido ao `developer` (para pegar isso no futuro): os duelos táticos imprimirem também os pontos por jogo contra a referência, com faixa de ±0,04 (cerca de ±1,5 ponto por temporada), como referência que não bloqueia.

**Zebra de 30 pontos e time 20 pontos mais forte puxam para lados opostos.** O único botão que move a zebra é o `kChance` (`dayFormSd` não move: medido na T-012), e ele move as duas juntas: 0,14 dá 65,3% e 7,3%; 0,125 dá 62,8% e 8,5%. As duas metas vêm do `PROJETO.md` (65% e cerca de 10%), e o motor não chega aos dois centros ao mesmo tempo: com qualquer `kChance` que põe as duas na faixa, as duas ficam perto da borda (menos de 1 ponto de folga). Decisão 1 abaixo.

### Decisões de diversão para o CEO

1. **Mais zebra ou favorito mais confiável?** Hoje o favorito por 20 pontos vence 65% e o azarão por 30 vence 7% (abaixo da meta). Proposta: `kChance` 0,125, com favorito vencendo 63% e azarão vencendo 8,5%; as duas ficam dentro, mas encostadas na borda. Alternativa: manter 65% e aceitar uma zebra de 7% (mudar a meta da zebra para 7% a 11% exige ADR, porque vem do `PROJETO.md`). **Recomendo 0,125**: a zebra é o que faz o jogo surpreender, e 63% ainda é "o favorito ganha quase 2 em cada 3".
2. **"Tudo no ataque" vira uma aposta de verdade?** Hoje, perdendo por 1 aos 75', "todo mundo no ataque" aumenta a chance de não perder só 1,4 ponto: o jogador quase não sente. Proposta: o time vai mais à frente e se expõe mais (ataque ×1,25, defesa ×0,78, era ×1,10 e ×0,85), e a chance sobe 3 a 4 pontos, com mais gols nos dois lados no fim. Ela não vira tática para o jogo todo: desde o apito inicial fica empatada com jogar normal (vitórias − derrotas de +1 a +2 pontos, dentro do limite de ±3), e ainda cansa e dá mais cartões. **Recomendo aceitar.** É mudança de regra (constante do motor), então precisa do ok e de um pedido ao `developer`.
3. **"Grande rebaixado" em 95% das temporadas (meta de 40% a 80%).** Não é a partida: é a lista de 2026, em que dois grandes começam entre os 3 mais fracos (Corinto, 65, cai em 41% das temporadas; Inter-Regional, 64, em 54%). Opções: (a) mexer na escada, subindo os grandes fracos (contradiz a regra "a força vem da tabela de referência", decisão do CEO); (b) mudar a meta; (c) **deixar como está e tornar a meta informativa na temporada única**, valendo de novo na carreira longa, quando a força acompanha a receita e um grande fraco se recupera. **Recomendo (c)**: com esta lista, um grande cair na 1ª temporada é o esperado, e é uma das histórias da carreira. O campeão grande (87,5%) entrou na faixa com os ajustes (80% a 83%) e não pede nada.
4. **Regra de medição das metas raras** (3 sementes juntas, acima): decisão de método, sem efeito no jogo. Recomendo aceitar.

### Pedidos ao `developer` (critérios de aceite)

1. `cards.bookedMult` como parâmetro (faixa de 0 a 1, valor 0,20; hoje `CARD_FACTORS.booked`). Aceite: com 0,5 o motor dá os mesmos resultados de hoje (goldens iguais); com 0,20, vermelhos de 0,17 a 0,19 nas 3 sementes, amarelos iguais.
2. Se o CEO aprovar a decisão 2: posturas de "tudo no ataque" ×1,25 · ×0,78 em `strength.ts` e em `partida.md`. Aceite: "tudo no ataque" de +3,1 a +3,7 p.p. nas 3 sementes; um duelo novo de referência, "tudo no ataque desde o apito inicial", com V − D dentro de ±3.
3. Duelos táticos com pontos por jogo (referência) e `--seed 1,2,3` somando as metas raras (não urgentes).
4. Depois dos itens 1 e 2: aplicar `t016-params.json` em `app/src/params/` (`/quick`) e rodar o `/balance` das 3 sementes para fechar este registro.

### Decisões do CEO (2026-11-05: "recomendados")

| Decisão               | O que foi aprovado                                                                                                                                                               | Valor aplicado |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1. Zebra              | `match.kChance` 0,14 → 0,125                                                                                                                                                     | 0,125          |
| 2. "Tudo no ataque"   | posturas do comando: ataque ×1,10 → ×1,25, defesa ×0,85 → ×0,78 (constante de regra, `partida.md`), com o duelo novo "tudo no ataque desde o apito inicial" (V − D dentro de ±3) | ×1,25 · ×0,78  |
| 3. "Grande rebaixado" | informativo na temporada única; volta a valer na carreira longa (`balance-targets.md`, decisão 12)                                                                               | —              |
| 4. Metas raras        | campeão pequeno, clube fraco no G4 e fuga do Z4 de 6 a 8 pontos julgados no total das 3 sementes (`balance-targets.md`, decisão 12)                                              | —              |

Junto com as decisões, entram os ajustes da ordem já aprovada: `match.comfortableLeadPower` 0,85, `match.baseChance` 0,087, `cards.bookedMult` 0,20 (o fator do pendurado vira parâmetro) e `fans.reversion` 0,10. Aplicação pelo `developer`, com `ENGINE_VERSION` 11 e goldens novos.

### Medição final (3 sementes)

_A preencher com a tabela do `developer` depois da aplicação: `npm run balance -- --seasons 200 --seed N`, com N = 1, 2 e 3, e as metas raras somadas nas 3 sementes._

| Métrica | Semente 1 | Semente 2 | Semente 3 | Meta |
| ------- | --------- | --------- | --------- | ---- |
|         |           |           |           |      |
