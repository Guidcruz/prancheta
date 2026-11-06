# Registro do balanceamento

> Mantido pelo `game-designer`. Cada rodada do `/balance` entra aqui: o que foi medido, o que foi proposto, o que o CEO decidiu. As metas estão em `balance-targets.md`; os parâmetros, em `app/src/params/`.

## 2026-11-06: todos podem ser campeões (escada, variação; T-070)

**Como foi medido.** `/balance` do motor do commit `ca5092a` (T-069), em cópias do repositório no scratchpad com a lista de clubes trocada; `app/` e `scripts/` do repositório não foram tocados. Cópias: `/tmp/claude-0/-home-user-prancheta/633297f9-57fe-584d-9ab1-43de735afb10/scratchpad/repo-base` (escada anterior, ordem atual), `/tmp/claude-0/-home-user-prancheta/633297f9-57fe-584d-9ab1-43de735afb10/scratchpad/repo-A` (escada anterior, ordem 3/2/1), `/tmp/claude-0/-home-user-prancheta/633297f9-57fe-584d-9ab1-43de735afb10/scratchpad/repo-L` (fundo mais alto, ordem atual; a lista é a mesma que a T-070 grava) e `/tmp/claude-0/-home-user-prancheta/633297f9-57fe-584d-9ab1-43de735afb10/scratchpad/repo-LA` (fundo mais alto, ordem 3/2/1). A variação entra por `--params` (`/tmp/claude-0/-home-user-prancheta/633297f9-57fe-584d-9ab1-43de735afb10/scratchpad/sd/params-<sd>.json`, só `generation.clubStrengthSd`). Duas rodadas por combinação: `--seasons 1000 --seed 1 --robot <mais fraco>` (Chapecão na ordem atual, Remador na 3/2/1) e `--seasons 200 --seed 1` (robô no Coritibom; no Tufão na ordem 3/2/1 com o fundo mais alto). Depois da decisão, `--seasons 200 --seed 2,3 --duels 0` no `repo-L`.

**Arquivos:** as 8 combinações de variação em `/tmp/claude-0/-home-user-prancheta/633297f9-57fe-584d-9ab1-43de735afb10/scratchpad/sd/` (`k-<escada>-<sd>.txt` para 1.000 temporadas, `m-<escada>-<sd>.txt` para 200; `base` é a ordem atual e `A` a 3/2/1; roteiro em `run.sh`); as escadas com o fundo mais alto em `/tmp/claude-0/-home-user-prancheta/633297f9-57fe-584d-9ab1-43de735afb10/scratchpad/lad/` (`k-L.txt`, `m-L.txt`, `k-LA.txt`, `m-LA.txt`, `m-L-s23.txt`; roteiro em `run.sh` e `apply.py`).

### As 8 combinações de variação (escada anterior, 62 a 78)

| Ordem | sd  | Metas (200 / 1.000) | Grande (1.000) | Pequeno (1.000) | Fraco no G4 (1.000) | Clubes sem título (1.000) | Robô no mais fraco: título, G4 |
| ----- | --- | ------------------- | -------------- | --------------- | ------------------- | ------------------------- | ------------------------------ |
| atual | 1,5 | 39 / 39             | 79,8%          | 2,9%            | 5,5%                | 2                         | 0,0%, 1,3%                     |
| atual | 2,0 | 39 / 37             | 81,0%          | 3,3%            | 4,6%                | 1                         | 0,1%, 1,7%                     |
| atual | 2,5 | 38 / 37             | 80,5%          | 3,6%            | 4,3%                | 2                         | 0,1%, 1,1%                     |
| atual | 3,0 | 38 / 37             | 82,0%          | 3,4%            | 4,2%                | 1                         | 0,1%, 2,1%                     |
| 3/2/1 | 1,5 | 37 / 38             | 84,3%          | 3,5%            | 5,3%                | 1                         | 0,0%, 1,5%                     |
| 3/2/1 | 2,0 | 37 / 36             | 86,9%          | 3,2%            | 3,8%                | 1                         | 0,2%, 2,0%                     |
| 3/2/1 | 2,5 | 37 / 37             | 87,5%          | 2,9%            | 4,8%                | 1                         | 0,0%, 1,7%                     |
| 3/2/1 | 3,0 | 37 / 36             | 85,4%          | 4,3%            | 3,4%                | 1                         | 0,0%, 2,3%                     |

Leitura: nenhuma combinação deixa todo clube campeão; o `sd` não muda a distância de 16 pontos do 1º ao 20º. Tabela completa em `balance-targets.md`, "Medido: variação por carreira nas duas escadas".

### As 3 escadas (sd 1,5)

| Métrica                                  | Anterior, ordem atual | Fundo mais alto, ordem atual | Fundo mais alto, ordem 3/2/1 |
| ---------------------------------------- | --------------------- | ---------------------------- | ---------------------------- |
| Clubes sem título (1.000, s1)            | 2 (Remador, Chapecão) | 0 (mínimo 1)                 | 0 (mínimo 1)                 |
| Metas obrigatórias (1.000 / 200, s1)     | 39 / 39               | 38 / 38                      | 38 / 38                      |
| Campeão grande (1.000; 200 s1)           | 79,8%; 83,0%          | 80,0%; 86,0%                 | 84,3%; 89,0%                 |
| Campeão grande (200: s2 / s3; total 3)   | 80,5 / 82,5; 82,0%    | 85,5 / 78,0; 83,2%           | n/m                          |
| Campeão pequeno (1.000; total 3 × 200)   | 2,9%; 1,5%            | 3,3%; 2,2%                   | 3,2%; n/m                    |
| Fraco no G4 (1.000)                      | 5,5%                  | 7,1%                         | 6,1%                         |
| Campeão / 17º (1.000)                    | 75,3 / 40,3           | 75,0 / 40,6                  | 74,9 / 40,5                  |
| Robô no mais fraco: pontos (IA), G4 (IA) | 42,0 (39,7), 1,3%     | 44,6 (42,3), 3,0% (1,7%)     | 45,0 (41,5), 2,7% (1,4%)     |
| Robô de referência: ganho, título (200)  | Coritibom +4,1, 4,5%  | Coritibom +4,4, 4,5%         | Tufão +2,3, 3,0%             |

**Decisão do CEO (2026-11-06, "ok recomendado"):** fundo mais alto na ordem atual, `sd` 1,5, teto do pequeno a 4%, metas "Todo clube campeão" e "Técnico-robô no clube mais fraco" na medição longa de release, média 3/2/1 para dezembro (`balance-targets.md`, decisão 16). Com o teto de 4%, a rodada de 1.000 passa em todas as metas; a de 200 na semente 1 ficava fora no campeão grande (86,0%, teto de 85%, calibrado para a escada anterior). **Decisão do CEO (2026-11-06, "ok pode subir o teto para 90%"):** o teto do campeão grande passa a 90%, e o CI continua com `--seasons 200 --seed 1` (`balance-targets.md`, decisão 16, item 6). Com 90%, as rodadas de 1.000 e de 200 (sementes 1 a 3; nas 2 e 3 sem os duelos, que não dependem da escada) da escada nova passam em todas as metas obrigatórias.

## 2026-11-05: T-017, metas da cadeia (motor real)

**Como foi medido.** `npm run balance -- --chain 3 --seasons 200 --seed 1,2,3 --duels 0 --robot none` com o motor da T-017 (commit `06d9a82`), numa cópia do repositório no scratchpad. Só na cópia, três chaves trocadas por variável de ambiente: a constante `MORALE_OFFSEASON_PULL` (0,5 ou 1, que é a moral zerada para 60), a evolução ligada ou desligada (desligada: o jogador passa igual pela virada, sem evolução nem aniversário) e o recorte do clube fraco e dos 6 mais fortes (pela força de cada temporada ou pela da temporada 1). `app/` e `scripts/` do repositório não foram tocados. A linha "virada da T-017, recorte atual" é a saída do code reviewer (`scratchpad/chain3-200.txt`), e a cópia a repete.

**Campeão grande, por semente (1 / 2 / 3) e no total das sementes.** A temporada 1 é a mesma em todas as variantes: 83,0 / 80,5 / 82,5%, total 82,0%.

| Variante                               | Temporada 2                | Temporada 3                |
| -------------------------------------- | -------------------------- | -------------------------- |
| virada da T-017 (moral a meio caminho) | 87,0 / 79,0 / 85,5 → 83,8% | 88,0 / 84,0 / 83,5 → 85,2% |
| moral zerada para 60                   | 85,0 / 81,0 / 82,5 → 82,8% | 85,0 / 88,5 / 82,5 → 85,3% |
| sem evolução (moral a meio caminho)    | 83,0 / 80,0 / 84,0 → 82,3% | 88,0 / 79,5 / 81,5 → 83,0% |
| controle: sem evolução e moral zerada  | 81,0 / 78,5 / 84,5 → 81,3% | 87,0 / 83,5 / 83,5 → 84,7% |

**Clube fraco no G4, no total das sementes.** A temporada 1 é de 6,0% em todas as variantes.

| Variante                              | Recorte por temporada (T-017) | Recorte da temporada 1         |
| ------------------------------------- | ----------------------------- | ------------------------------ |
| virada da T-017                       | 3,8% · 4,7%                   | 4,8% · 5,5%                    |
| moral zerada para 60                  | 5,3% · 4,0%                   | 6,0% · 4,5%                    |
| sem evolução                          | 6,3% · 4,8%                   | igual (a força quase não muda) |
| controle: sem evolução e moral zerada | 6,0% · 5,8%                   | igual                          |

**Leitura.**

- **Campeão grande:** é amostra. O erro por semente é de cerca de 2,7 pontos, e a temporada 1 já está a 3 pontos do teto de 85%. O controle sem evolução e sem moral também sai da faixa numa semente (87,0%). A evolução não favorece os grandes: no script de rascunho, que o `--chain` reproduz, grandes e não grandes ganham a mesma força (+0,61 e +0,58 na temporada 2; +0,93 e +0,92 na 3), e a idade média deles é igual.
- **Moral (hipótese do code reviewer):** não se sustenta. Zerar a moral muda as duas metas em menos de 1,5 ponto, com sinais trocados entre as temporadas.
- **Clube fraco no G4:** a evolução custa cerca de 1 ponto (média de −1,3 nas quatro comparações), menos que o erro de 0,9 ponto por temporada no total. Boa parte disso é do recorte por temporada: ele tira da conta os fracos que cresceram, que são justamente os que chegam ao G4. Com o recorte da temporada 1 fica em 4,8% e 5,5%.
- **Proposta:** recorte da temporada 1 e decisão 15 de `balance-targets.md`.

## 2026-11-05: T-017, virada de temporada (medição de design, antes da implementação)

**Como foi medido.** Um script de rascunho fora do repositório (`scratchpad/sim/chain.ts`), que importa o motor do commit `752aaa7` só para leitura (`newGame`, `playRound`, `getStandings`, `generateFixtures`, `bestEleven`, `elevenStrength`, `fitAttributesToOverall`) e faz, por conta própria, a evolução de `jogadores.md` e a virada de `temporada.md`. Carreiras com as sementes do `/balance` (`balance-<seed>-<i>`), IA nos 20 clubes, Realismo completo, parâmetros do repositório. A temporada 1 bate com o `/balance` da T-016 (campeão 75,2 e 17º 40,3 na semente 1, contra 75,0 e 40,3). `app/` e `scripts/` não foram tocados.

### Configuração recomendada (evolução do doc, moral a meio caminho de `fans.start`), temporadas 1 / 2 / 3

| Métrica                          | Semente 1 (150 carreiras)   | Semente 2 (150 carreiras)      | Meta                |
| -------------------------------- | --------------------------- | ------------------------------ | ------------------- |
| Força média da liga (`strength`) | 70,0 / 70,6 / 70,9          | 70,0 / 70,6 / 70,9             | ±1,0 da temporada 1 |
| Desvio da força                  | 4,74 / 4,80 / 4,85          | 4,80 / 4,87 / 4,94             | 3,5 a 5,5           |
| 1º − 20º em força                | 17,1 / 17,5 / 17,8          | 17,2 / 17,6 / 17,8             | 12 a 20             |
| Gols por partida                 | 2,64 / 2,64 / 2,63          | 2,66 / 2,64 / 2,62             | 2,50 a 2,80         |
| Empates                          | 26,1 / 25,9 / 26,2%         | 26,0 / 26,1 / 26,4%            | 24% a 28%           |
| Mandante vence                   | 46,1 / 46,3 / 46,1%         | 45,9 / 46,1 / 45,6%            | 45% a 50%           |
| 0×0                              | 7,2 / 7,3 / 7,2%            | 7,0 / 7,0 / 7,3%               | 6% a 9%             |
| Goleada (≥ 3)                    | 12,3 / 12,6 / 12,4%         | 12,4 / 12,5 / 12,3%            | 8% a 13%            |
| Pontos do campeão                | 75,2 / 75,9 / 75,4          | 76,1 / 75,7 / 74,7             | 72 a 82             |
| Pontos do 17º                    | 40,3 / 39,9 / 40,0          | 40,0 / 40,0 / 40,5             | 39 a 45             |
| Termômetro: média, < 20, > 90    | 53,4 · 2,3% · 0,6% em todas | 53,4 · 2,2 a 2,4% · 0,6 a 0,7% | 50 a 60; ≤ 5%; ≤ 5% |

Sem inflação nem deflação perceptível em 3 temporadas: a liga inteira sobe +0,9 de força, igual para todos (o placar não muda), e a escada abre um pouco (desvio +0,1). A correlação da força com a da temporada 1 fica em 0,98 na temporada 3: a hierarquia muda devagar.

**Evolução, Δ médio na 1ª virada:** até 21 anos +3,9; 22 a 26 +1,7; 27 a 30 −0,3; 31 ou mais −1,2; titulares +0,5; todos +0,9. Na 2ª virada: +2,9, +0,9, −0,2, −1,3; todos +0,3.

### Variantes medidas (semente 1, 150 carreiras, 5 temporadas)

| Variante                                     | Campeão (t1 → t2 → t3 → t5) | 17º (t1 → t2 → t3 → t5)   | Correlação de pontos t → t+1 | Força média t5 |
| -------------------------------------------- | --------------------------- | ------------------------- | ---------------------------- | -------------- |
| moral passa inteira                          | 75,2 → 76,5 → 76,4 → 77,5   | 40,3 → 40,1 → 39,6 → 39,2 | 0,52 a 0,56                  | 70,9           |
| **moral a meio caminho de 60 (recomendada)** | 75,2 → 75,9 → 75,4 → 77,4   | 40,3 → 39,9 → 40,0 → 40,0 | 0,48 a 0,51                  | 70,9           |
| moral zerada para 60                         | 75,2 → 75,9 → 75,3 → 76,4   | 40,3 → 40,2 → 40,3 → 40,0 | 0,44 a 0,47                  | 70,9           |
| sem ruído no auge (moral inteira)            | 75,2 → 76,4 → 76,1 → 76,8   | 40,3 → 39,9 → 39,8 → 39,6 | 0,52 a 0,56                  | 71,2           |

A moral não mexe na força da liga (a evolução quase não a sente): mexe na tabela. Passando inteira, ela leva a vantagem do embalo de uma temporada para a outra e empurra o 17º para o piso de 39. Tirar o ruído do auge infla a liga (+0,3), então o ruído fica.

**Prêmios, candidatos por temporada:** cerca de 282 jogadores com 19 jogos com nota; 20 goleiros com 19 jogos; de 15 a 25 jogadores de até 21 anos com 19 jogos com nota (de 13 a 24 no Realismo simplificado, 100 carreiras); nunca zero em 750 temporadas até a 5ª da cadeia.

### Carreira longa sem renovação (60 carreiras, 10 temporadas; decisão 14)

| Temporada                       | 1    | 3    | 5    | 6    | 7    | 8    | 9    | 10   |
| ------------------------------- | ---- | ---- | ---- | ---- | ---- | ---- | ---- | ---- |
| Força média da liga             | 69,9 | 70,9 | 70,8 | 70,4 | 69,6 | 68,6 | 67,4 | 65,9 |
| Idade média                     | 26,1 | 28,1 | 30,1 | 31,1 | 32,1 | 33,1 | 34,1 | 35,1 |
| Gols por partida                | 2,66 | 2,63 | 2,56 | 2,54 | 2,49 | 2,44 | 2,43 | 2,35 |
| Até 21 anos com 19 jogos        | 15   | 25   | 10   | 0    | 0    | 0    | 0    | 0    |
| Com aposentadoria aos 35: força | 69,9 | 70,9 | 71,0 | 70,9 | 70,9 | 70,9 | 71,1 | 71,3 |
| Com aposentadoria aos 35: idade | 26,1 | 27,2 | 27,2 | 26,9 | 26,4 | 25,7 | 25,0 | 24,2 |
| Com aposentadoria aos 35: gols  | 2,66 | 2,64 | 2,57 | 2,56 | 2,50 | 2,48 | 2,48 | 2,45 |

A queda dos gols vem dos atacantes: na cadeia sem renovação, o overall médio dos atacantes do melhor XI vai de 69,6 a 62,2 em 10 temporadas, enquanto o dos defensores vai de 70,3 a 72,5 e o dos goleiros fica em 70. Há 9 defensores no elenco para 4 vagas e 5 atacantes para até 3: os jovens de defesa entram no time, e os atacantes envelhecem sem reposição. É da composição dos elencos, não da partida; fica para a base da Etapa 4 (decisão 11).

**Pedido ao `developer`:** o `--chain` do `/balance` (balance-targets.md, "Como o /balance mede"), para repetir esta tabela com o motor de verdade depois da T-017.

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

| Decisão               | O que foi aprovado                                                                                                                                                                                                          | Valor aplicado |
| --------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- |
| 1. Zebra              | `match.kChance` 0,14 → 0,125                                                                                                                                                                                                | 0,125          |
| 2. "Tudo no ataque"   | posturas do comando: ataque ×1,10 → ×1,25, defesa ×0,85 → ×0,78 (viraram os parâmetros `match.allOutPower` e `match.allOutDef`, `partida.md`), com o duelo novo "tudo no ataque desde o apito inicial" (V − D dentro de ±3) | ×1,25 · ×0,78  |
| 3. "Grande rebaixado" | informativo na temporada única; volta a valer na carreira longa (`balance-targets.md`, decisão 12)                                                                                                                          | —              |
| 4. Metas raras        | campeão pequeno, clube fraco no G4 e fuga do Z4 de 6 a 8 pontos julgados no total das 3 sementes (`balance-targets.md`, decisão 12)                                                                                         | —              |

Junto com as decisões, entram os ajustes da ordem já aprovada: `match.comfortableLeadPower` 0,85, `match.baseChance` 0,087, `cards.bookedMult` 0,20 (o fator do pendurado vira parâmetro) e `fans.reversion` 0,10. Aplicação pelo `developer`, com `ENGINE_VERSION` 11 e goldens novos.

### Medição final (3 sementes)

`npm run balance -- --seasons 200 --seed 1,2,3`, com `ENGINE_VERSION` 11 e os parâmetros aplicados em `app/src/params/` (commit `753159e`). **Resultado: 35 de 35 metas obrigatórias dentro em cada semente, as 3 metas raras dentro no total, código de saída 0.**

| Métrica                                        | Semente 1   | Semente 2   | Semente 3   | Meta                        |
| ---------------------------------------------- | ----------- | ----------- | ----------- | --------------------------- |
| Gols por partida                               | 2,64        | 2,65        | 2,62        | 2,50 a 2,80                 |
| Time 20 pontos mais forte vence                | 62,8%       | 62,6%       | 62,4%       | 62% a 68%                   |
| Zebra de 30 pontos                             | 8,3%        | 8,1%        | 8,4%        | 8% a 12%                    |
| Empates                                        | 26,1%       | 25,9%       | 26,5%       | 24% a 28%                   |
| Mandante vence                                 | 46,0%       | 45,9%       | 45,5%       | 45% a 50%                   |
| 0×0                                            | 7,3%        | 7,0%        | 7,3%        | 6% a 9%                     |
| Goleada (≥ 3)                                  | 12,3%       | 12,4%       | 12,2%       | 8% a 13%                    |
| Placar grande (≥ 5)                            | 0,9%        | 1,0%        | 0,9%        | 0,5% a 2%                   |
| Amarelos                                       | 4,46        | 4,46        | 4,46        | 3,5 a 4,5                   |
| Vermelhos                                      | 0,181       | 0,179       | 0,179       | 0,11 a 0,25                 |
| Lesões                                         | 0,324       | 0,319       | 0,322       | 0,20 a 0,40                 |
| Pênaltis                                       | 0,263       | 0,263       | 0,258       | 0,17 a 0,33                 |
| Táticas (V − D, pior caso)                     | −0,8 a +1,4 | −1,3 a +1,1 | −1,7 a +0,9 | −3 a +3 p.p.                |
| "Tudo no ataque" desde o apito inicial (V − D) | +1,6        | +1,0        | +2,1        | −3 a +3 p.p.                |
| "Tudo no ataque" (0×1 aos 75')                 | +3,7        | +3,5        | +3,1        | ≥ +3 p.p.                   |
| Pontos do campeão                              | 75,0        | 75,8        | 75,1        | 72 a 82                     |
| Pontos do 17º                                  | 40,3        | 40,3        | 40,2        | 39 a 45                     |
| Termômetro abaixo de 20 / acima de 90          | 2,3% / 0,6% | 2,3% / 0,7% | 2,6% / 0,6% | no máximo 5% cada           |
| Campeão grande                                 | 83,0%       | 80,5%       | 82,5%       | 50% a 85%                   |
| Fuga do Z4 depois da rodada 30                 | 21,9%       | 20,5%       | 20,4%       | 15% a 30%                   |
| Robô no Coritibom: ganho                       | +4,1        | +3,9        | +4,5        | +2 a +8 pontos              |
| Título do Coritibom com o robô                 | 4,5%        | 3,5%        | 3,0%        | no máximo 5%                |
| Grande rebaixado (informativa)                 | 96,0%       | 95,0%       | 94,5%       | 40% a 80% na carreira longa |

| Meta rara (total das 3 sementes, 600 temporadas) | Valor                   | Meta        |
| ------------------------------------------------ | ----------------------- | ----------- |
| Campeão pequeno                                  | 1,5% (2,0 / 1,0 / 1,5%) | 0,5% a 3%   |
| Clube fraco no G4                                | 6,0% (8,0 / 4,0 / 6,0%) | 5% a 15%    |
| Fuga do Z4 de 6 a 8 pontos                       | 7,8% (7,7 / 8,4 / 7,2%) | ao menos 3% |

Os números conferem com a medição na cópia antes da aplicação (tabela "antes × depois" acima), semente a semente.

### "Tudo no ataque" desde o apito inicial: avaliação dos pontos por jogo

**A observação do `developer`:** desde o apito inicial, o "tudo no ataque" fica dentro de ±3 em vitórias − derrotas (+1,6, +1,0 e +2,1), mas rende +0,029, +0,034 e +0,054 ponto por jogo sobre a referência (a semente 3 fora da faixa de referência de ±0,04). Somado numa temporada, isso dá de +1,1 a +2,1 pontos. É mais que a postura ofensiva comum (+0,012 por jogo, cerca de +0,5 por temporada), porque a postura troca empates por vitórias e derrotas, e a vitória vale 3.

**Medição de temporada (cópia do código em `753159e`, 200 temporadas pareadas por semente, sem duelos).** Um robô que põe "tudo no ataque" no minuto 0 e não muda mais, mantendo a escalação, as trocas e a conversa do robô bom, contra o robô bom normal, que nunca começa no "tudo no ataque" e só o usa perdendo por 1 a partir dos 80':

| Coritibom, ganho sobre a IA (pontos por temporada) | Semente 1    | Semente 2    | Semente 3    | Média        |
| -------------------------------------------------- | ------------ | ------------ | ------------ | ------------ |
| Robô bom                                           | +4,1         | +3,9         | +4,5         | +4,2         |
| Robô "sempre tudo no ataque"                       | +3,5         | +5,9         | +4,9         | +4,8         |
| G4 (robô bom / sempre tudo no ataque)              | 23,0 / 26,5% | 21,5 / 27,0% | 24,0 / 28,0% | 22,8 / 27,2% |
| Título (robô bom / sempre tudo no ataque)          | 4,5 / 5,5%   | 3,5 / 4,0%   | 3,0 / 5,5%   | 3,7 / 5,0%   |

**Leitura.** Em pontos não é dominante: +0,6 ponto por temporada sobre o robô bom, dentro do ruído (diferenças de −0,6 a +2,0 entre as sementes). O cansaço da pressão alta e os cartões a mais pesam ao longo da temporada e comem a maior parte dos +1 a +2 pontos que o duelo isolado mostra. Mesmo assim é um problema de design: **um botão apertado no minuto 0 de todo jogo rende o mesmo que escalar e mexer bem**, e, como põe mais gols nos dois lados, dá mais variância a um clube médio: mais 4 pontos de G4, e o título do Coritibom chega ao teto da meta (5%). Isso esvazia a escolha tática que o jogo quer premiar.

**O robô passaria a usar o tempo todo?** Não. Ele escolhe a postura antes do jogo só entre defensiva, equilibrada e ofensiva, e usa o "tudo no ataque" só perdendo por 1 a partir dos 80'. O risco é o humano descobrir que o botão no minuto 0 vale tanto quanto jogar bem.

**Proposta (volta ao CEO; não aplicada).** Regra em uma frase: **"todo mundo no ataque" só pode ser pedido a partir dos 60 minutos.** É o último recurso, como no futebol: perdendo cedo, o técnico tem a postura ofensiva. Por que esta e não um ajuste de número: os multiplicadores aprovados (×1,25 · ×0,78) e o "tudo no ataque" aos 75' (+3,1 a +3,7) não mudam, o robô e a IA não mudam (os dois só o usam a partir dos 80'), e o uso desde o apito deixa de existir. Nenhuma outra métrica se move. A alternativa seria fazer o "tudo no ataque" cansar mais por minuto (o custo cresce com o tempo de uso e quase não pesa em 15 minutos), mas isso pede um multiplicador novo de cansaço e uma rodada de calibragem; a regra dos 60' não pede nenhuma.

- **Pedido ao `developer`, se o CEO aprovar:** o comando `allOut` (preset e postura) antes do minuto 60 é ignorado com o aviso `command-too-early`; a tela só mostra o botão a partir dos 60'. Aceite: as 35 metas e as 3 raras iguais às desta medição; o duelo "tudo no ataque desde o apito inicial" sai do relatório (ou passa a começar aos 60', com V − D dentro de ±3 e pontos por jogo dentro de ±0,04); um teste com o comando no minuto 30 mostra a partida igual à sem comando, mais o aviso.
- **Meta nova (proposta, referência que não bloqueia):** "nenhum comando ou tática usado do apito ao fim rende mais de +0,04 ponto por jogo sobre a referência", porque vitórias − derrotas não pega o efeito dos 3 pontos.

### Decisão do CEO: "todo mundo no ataque" só a partir dos 60' (2026-11-05)

**Aprovada pelo CEO e aplicada pelo `developer`.** Parâmetro novo `match.allOutFromMinute` = 60 (faixa de 0 a 76): o comando com `minute: 59` vale (a partir do minuto 60, pela regra "o comando leva o último minuto jogado"); antes disso é ignorado. No `/balance`, o duelo "tudo no ataque desde o apito inicial" saiu e entraram dois obrigatórios, os dois com vitórias − derrotas dentro de ±3: `allout-60` (o atalho: "tudo no ataque" com pressão alta, desde o minuto 60) e `allout-60-medium` (a postura com pressão média, desde o minuto 60).

**Medição** (`npm run balance -- --seasons 200 --seed 1,2,3`): 36 de 36 metas obrigatórias dentro em cada semente, as 3 metas raras dentro no total (1,5%, 6,0% e 7,8%), código de saída 0. As outras métricas não mudaram.

| Desde o minuto 60, contra 4-4-2 equilibrada média | Semente 1 | Semente 2 | Semente 3 | Média  | Meta               |
| ------------------------------------------------- | --------- | --------- | --------- | ------ | ------------------ |
| Atalho (pressão alta): V − D                      | +1,0      | +1,1      | +1,5      | +1,2   | −3 a +3 p.p.       |
| Postura (pressão média): V − D                    | +0,7      | +1,4      | +0,9      | +1,0   | −3 a +3 p.p.       |
| Atalho: pontos por jogo sobre a referência        | +0,012    | +0,026    | +0,036    | +0,025 | ±0,04 (referência) |
| Postura: pontos por jogo sobre a referência       | +0,006    | +0,032    | +0,030    | +0,023 | ±0,04 (referência) |
| "Tudo no ataque" a partir de 0×1 aos 75'          | +3,7      | +3,5      | +3,1      | +3,4   | ≥ +3 p.p.          |

**O +0,036 da semente 3 pede acompanhamento, não meta nova.**

- **É ruído de amostra.** Com 20.000 duelos, os pontos por jogo têm erro padrão de cerca de 0,0095, e a diferença para a referência (outra amostra de 20.000) de cerca de 0,013. As três sementes (+0,012 a +0,036) cabem nesse ruído em volta da média de +0,025. A faixa de ±0,04 está a cerca de 3 erros padrão da referência numa semente só: um valor isolado perto dela não diz nada.
- **O efeito médio é pequeno.** +0,025 por jogo é cerca de +0,9 ponto numa temporada em que o técnico ataca com tudo em todos os jogos a partir dos 60', inclusive quando está ganhando, o que ninguém faz. Antes da regra, o uso desde o minuto 0, medido na temporada inteira, já rendia só +0,6 ponto sobre o robô bom, dentro do ruído; desde os 60' a exposição é um terço do jogo.
- **Proposta (sem aplicar):**
  1. Os pontos por jogo das táticas e comandos (referência, não bloqueiam) passam a ser lidos **na média das 3 sementes**, como as metas raras (decisão 12 de `balance-targets.md`). Média de hoje: +0,025 e +0,023, dentro de ±0,04 com folga (erro padrão da média de cerca de 0,0075). Pedido ao `developer` (não urgente): a soma das 3 sementes imprimir também essas linhas.
  2. **Gatilho de reavaliação:** se a média das 3 sementes passar de +0,04, ou se uma mudança mexer em `allOutPower`, `allOutDef`, `allOutFromMinute`, `kChance` ou no cansaço, o `game-designer` repete a medição de temporada (robô bom contra robô "sempre tudo no ataque a partir dos 60'", 3 × 200 temporadas pareadas). Uma meta só nasce se essa medição mostrar ganho acima de +1 ponto por temporada sobre o robô bom.
