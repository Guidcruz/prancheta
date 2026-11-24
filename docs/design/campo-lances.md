# Campo: lances, nomes e posse (proposta de regra)

**Estado:** decidida pelo CEO em 2026-11-23 (ver §9); sem código ainda. **Parte:** a regra de jogo e a honestidade dos dados. O visual (etiqueta, rastro, sombra, perspectiva, estádio) é do `ux-designer`, no arquivo dele, escrito em paralelo. **Base:** a especificação do campo em [telas/partida.md](telas/partida.md) ("Campo 2D (T-085)"), `app/src/ui/match/pitch/scene.ts`, `app/src/ui/match/steps.ts`, o motor (`app/src/engine/match/simulate.ts` e `types.ts`) e a §4.7 de `docs/02-architecture.md`.

**A regra em uma frase:** no campo, só tem nome e número quem está num evento do motor; o resto se move sem identidade, e a posse que o campo mostra bate com a da súmula.

## 1. O que a referência mostra e o que isso pede ao jogo

O CEO mandou prints de um app real de lance a lance, só como referência de mecânica (nada do visual, dos nomes ou das marcas entra no projeto). Ali, cada lance do campo vem de um dado real: o app recebe a lista de passes da partida de verdade. É isso que dá valor à etiqueta "Passe · 5 · Fulano": ela é um fato.

No Prancheta, o motor **não gera passes**. Ele sorteia, a cada minuto, se cada time cria uma chance, e depois cartões, lesões e trocas. Tudo o que acontece entre um lance e outro no campo de hoje é decorativo (`scene.ts`: "the positions are decorative and never decide anything"). Então a pergunta não é "como mostrar os passes", é "o que o campo pode afirmar sem inventar fato".

| Elemento da referência                  | O que existe no motor                                                       | O que esta proposta faz                                                                  |
| --------------------------------------- | --------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| 1. Rastro do passe, bola andando nele   | nenhum passe                                                                | passes **anônimos** nos minutos sem lance e no começo de cada lance (D2, D3)             |
| 2. Etiqueta: camisa, número, tipo, nome | o jogador de cada evento (`PlayerId`) e o número da camisa (`Player.shirt`) | etiqueta **só** nos eventos do motor (D1)                                                |
| 3. Próximo jogador, apagado no alto     | o finalizador do lance, já conhecido no começo dele                         | só no começo de um lance: o finalizador (D3)                                             |
| 4. Sombra em cunha para o ataque        | posse só como estatística do jogo inteiro; direção fixa por lado            | dono da bola por minuto, por cota que bate com a posse da súmula; direção pelo lado (D4) |
| 5. Campo em perspectiva com estádio     | nada (é visual)                                                             | sem efeito nos dados; restrições de regra em D7                                          |

## 2. O que o motor gera (dados do código)

O motor entrega a lista inteira de `MatchEvent` antes do apito inicial (`simulateMatch`); a tela só decide quando mostrar cada um (`matchSteps`). Tipos, de `app/src/engine/match/types.ts`:

| Evento                                        | Jogador(es) no evento                                                                     | Lado | Média por partida |
| --------------------------------------------- | ----------------------------------------------------------------------------------------- | ---- | ----------------- |
| `chance`                                      | `shooter` (finalizador); `kind` `open` ou `freeKick`; `outcome` `saved`, `post` ou `wide` | sim  | 14,9              |
| `goal`                                        | `scorer` e, às vezes, `assist`; `kind` `open`, `freeKick` ou `penalty`                    | sim  | 2,7               |
| `penaltyAwarded`                              | `taker` (cobrador)                                                                        | sim  | 0,29              |
| `penaltyMissed`                               | `taker`; `outcome`                                                                        | sim  | 0,06              |
| `yellow`                                      | `player`                                                                                  | sim  | 4,5               |
| `red`                                         | `player`; `reason` (direto ou segundo amarelo)                                            | sim  | 0,18              |
| `injury`                                      | `player`; `severity`                                                                      | sim  | 0,34              |
| `substitution`                                | `out` e `in`; `reason`                                                                    | sim  | 7,1               |
| `tacticChange`                                | nenhum (só o lado e a tática)                                                             | sim  | 1,7               |
| `halftimeTalk`                                | nenhum (só o lado); nunca narrado                                                         | sim  | 2,0               |
| `kickoff`, `stoppage`, `halftime`, `fulltime` | nenhum                                                                                    | não  | fases             |

**O que o motor não gera, e a tela não pode inventar como fato:**

- **Passe.** Não existe. A assistência só existe no gol de jogada (`kind: 'open'`) e só em parte deles: `match.assistShare` = 0,7; medido, 62% de todos os gols têm assistência (1,70 de 2,73 por partida). Falta e pênalti nunca têm.
- **Autor da falta.** A cobrança de falta é um `kind` da chance ou do gol; ninguém comete a falta. O pênalti também não tem autor. Um nome de "quem fez a falta" seria inventado e ainda sugeriria um cartão que a súmula não mostra.
- **Goleiro na defesa.** O `outcome: 'saved'` não diz quem defendeu. O motor conta a defesa para o goleiro que está na vaga de goleiro do outro lado (`keeper.saves`, +0,3 na nota), mas não põe o nome no evento. A tela sabe quem é pelo dono do disco do goleiro (D5).
- **Posse por minuto.** Não existe. A posse é só estatística de exibição: um número por tempo, calculado **no fim** de cada tempo (`halfPossession`: `clamp(50 + 1,5 × ΔMid + Rng.int(−3, 3), 30, 70)`), e o `MatchResult` só expõe a média do jogo (`stats.home.possession`). A partida não tem "quem está com a bola" minuto a minuto: num minuto, os dois times sorteiam chance, mandante primeiro.
- **Direção do ataque.** Não é dado: o campo fixa o mandante à esquerda atacando para a direita o jogo todo (decisão 11 da T-032). A direção é uma função do lado.

**Quem a tela conhece:** o `live.match` tem os `players` de cada lado (titulares e reservas, com `name` e `shirt`; a camisa é única no elenco, conferida em `generation.ts`), e a coreografia já acompanha quem está em cada disco (`Field.owner`: titulares, trocas, vermelho, lesão sem troca).

## 3. Medidas (simulação)

Script de medida no scratchpad (não entra no repositório): 10 temporadas da Série A, 3.800 partidas, parâmetros atuais, `ENGINE_VERSION` 19, todos os clubes com a IA (é o que o técnico vê até a T-033: o auxiliar comanda), com `matchSteps(events, 'full')` e o `MATCH_TIMING` atual.

| Medida (por partida)                                    | Valor                                                      |
| ------------------------------------------------------- | ---------------------------------------------------------- |
| Passos de minuto sem lance (`minuteFull`)               | 67,7                                                       |
| Tempo deles no Normal / Rápido                          | 54,2 s de 79,5 s (68%) / 20,3 s de 30,2 s                  |
| Minutos com finalização, gol ou pênalti                 | 16,9 (em 0,8 deles, dos dois lados)                        |
| Passos de pausa dramática (`drama`, 1,2 s / 0,5 s)      | 3,8                                                        |
| Passos comuns (`event`, 0,4 s / 0,15 s)                 | 31,7                                                       |
| Jogadores que entraram em campo                         | 29,1                                                       |
| Jogadores distintos com nome em algum evento            | 22,3 (11,0 só em finalização, gol, assistência ou pênalti) |
| Goleiro que sai sem troca (vermelho; lesão sem reserva) | 9 em 3.800 partidas (0,24%)                                |
| Posse do mandante a 10 pontos ou mais de 50%            | 46% das partidas                                           |

**Leitura:** dois terços do tempo da "Animada completa" são minutos sem lance. É ali que a referência ganha vida, e é ali que o motor não tem nada a dizer. Os nomes reais cabem nos 17 minutos com lance e nos cartões e trocas.

## 4. Decisões

### D1. Quem ganha nome e número no campo

- **A. Só quem está no evento do passo** (`shooter`, `scorer`, `assist` na revelação, `taker`, `player`, `out` e `in`), mais o goleiro na defesa (D5). Prós: tudo o que o campo afirma está na súmula; a regra cabe numa frase ("se tem nome, aconteceu"); nenhum risco de contradição. Contras: os minutos sem lance ficam sem etiqueta.
- **B. A + nome nos passes de ligação** (D2, opção D). Prós: mais parecido com a referência. Contras: inventa fato em 68% do tempo (seção 6).
- **Recomendo A.** O valor da etiqueta é dizer a verdade; num jogo de técnico, o jogador vai usar o que vê no campo para decidir troca e tática.

**Número na etiqueta:** o `Player.shirt` do jogador do evento, lido de `live.match.<lado>.players` pelo `PlayerId` (o reserva que entrou está lá também). Sem número (jogador fora da lista, só com save danificado): a etiqueta sai sem número, com `match.player.unknown` no lugar do nome, como a narração já faz.

**Tipo na etiqueta, por passo** (o texto é do `content-writer`; as chaves, do `ux-designer`):

| Passo                                               | Tipo                           | Jogador                                   |
| --------------------------------------------------- | ------------------------------ | ----------------------------------------- |
| Começo de lance de jogada (`build`)                 | finalização                    | `shooter` ou `scorer` (são o mesmo papel) |
| Começo de falta (`build`)                           | falta                          | o cobrador; **nunca** quem fez a falta    |
| `penaltyAwarded`                                    | pênalti                        | `taker`                                   |
| Desfecho: gol                                       | gol; e, se houver, assistência | `scorer`; `assist`                        |
| Desfecho: defesa                                    | defesa                         | o goleiro do outro lado (D5)              |
| Desfecho: trave, para fora; chance fraca            | na trave, para fora            | `shooter`                                 |
| `yellow`, `red`, `injury`                           | amarelo, vermelho, lesão       | `player`                                  |
| `substitution`                                      | troca                          | `out` e `in`                              |
| `tacticChange`, `stoppage`, fases, minuto sem lance | sem etiqueta de jogador        | —                                         |

**Tempo de leitura (aviso ao `ux-designer`):** o passo comum dura 400 ms no Normal e 150 ms no Rápido, curto para ler um nome. A regra de dados permite etiqueta em todos os passos da tabela; quanto tempo ela fica na tela é decisão visual. A narração continua sendo onde o fato se lê.

### D2. Passes de ligação (minutos sem lance)

Hoje a bola anda até um ponto sorteado no meio-campo, sem dono. As opções:

- **A. Nada muda.** Prós: zero risco, zero código. Contras: o campo continua sem a mecânica que o CEO gostou.
- **B. Passes anônimos (recomendada).** Um passe por minuto sem lance, entre dois discos do time com a bola (D4), com o rastro e a bola andando nele, **sem nome, sem número e sem "próximo"**. Prós: dá o movimento da referência em 68% do tempo sem afirmar nada; não depende de quem é cada disco, então não pode errar quem está em campo. Contras: falta a etiqueta nesses minutos (o "quem" fica para os lances).
- **C. Só o número da camisa.** Contras: número é identidade (o jogador conhece "o 10" do elenco); tem os mesmos riscos de D com menos ganho.
- **D. Nome e número, escolhidos por posição com a semente.** Prós: o mais vivo. Contras: inventa uns 68 "fatos" por partida; os riscos da seção 6 (nota, melhor em campo, posição depois de troca de formação, goleiro trocado); contraria a decisão 12 da T-032 (sem linhas de ambiente nos minutos sem lance), porque é o mesmo conteúdo inventado, só que no campo.

**Regra da opção B (para o `developer`, sem interpretar):** _itens 2 a 5 sem efeito no modo "só a bola" (§10): não há discos nos minutos sem lance; a bola segue o planejador de [telas/partida-campo-v2.md](telas/partida-campo-v2.md), §6, entre 10 e 95 m. O item 1 continua._

1. O dono do minuto sai de D4.
2. O ponto de chegada da bola é sorteado como hoje (rótulo `m${slot}`, a no máximo `maxStep` = 20 m de onde ela está), mas na faixa do dono: `x` de 45 a 75 m quando o dono é o mandante e de 30 a 60 m quando é o visitante (o espelho), `y` de 10 a 58 m. Os blocos acompanham a bola como hoje (`follow`).
3. Quem passa: o disco do dono, em campo, mais perto da bola no começo do minuto (empate: o de menor índice). Quem recebe: o disco do dono, em campo, mais perto do ponto de chegada na pose final (empate: o de menor índice). Nenhum sorteio novo.
4. A bola termina 1 m à frente de quem recebe, no sentido do ataque do dono. Se quem passa e quem recebe são o mesmo disco, é uma condução: a bola anda sem rastro.
5. Os números (45 a 75, 30 a 60, 1 m) entram no `PITCH_MOTION` (`app/src/ui/match/pitch/motion.ts`), com comentário apontando para cá. Não são parâmetros do motor e não vão para `app/src/params/`.

### D3. O passe antes da finalização e a assistência

A regra que não pode quebrar (`partida.md`, "Nada antecipa o desfecho", com teste em 11 pontos): o começo de um gol e o de uma chance do mesmo tipo, lado e finalizador são iguais quadro a quadro. A assistência só existe no gol; usá-la no começo do lance entrega o desfecho.

- **A. O passador do começo é o assistente real nos gols.** Contras: quebra a regra acima (um gol com assistência e uma chance seriam diferentes); e, no gol sem assistência (38% dos gols), não haveria de onde tirar o passador sem inventar. **Descartada.**
- **B. Passe anônimo no começo, assistência na revelação (recomendada).** No começo do lance (jogada), a bola chega ao finalizador num passe de um companheiro **sem nome nem número**, escolhido pelo rótulo `${line.id}-build` que já existe, igual para gol e chance. O "próximo jogador, apagado no alto" é o finalizador, que a narração já nomeia no começo ("Fulano finaliza..."). Na revelação do gol, a etiqueta mostra o artilheiro e, se houver, a assistência (a narração e a súmula já mostram as duas). Prós: mantém a regra; nenhum nome sem fato. Contras: o rastro do começo pode sair de um disco que não é o do assistente; como esse disco não tem nome nem número, o jogador não consegue comparar. _No modo "só a bola" (§10) não há disco de origem: o passe do começo sai de onde a bola está._
- **B2 (opcional, junto de B).** Durante o passo depois do gol (2,0 s no Normal, 0,8 s no Rápido), um rastro de "replay" do disco do assistente até o ponto do chute. É fato, já revelado. Fica a critério do `ux-designer` (a comemoração ocupa o campo nesse passo).
- **C. Sem passe no começo** (como hoje: a bola vai ao ponto do lance). Seguro, mas perde o momento mais tenso para mostrar a mecânica.
- **Recomendo B**, com B2 se couber no visual.

**Falta e pênalti:** sem passe no começo (a bola vai ao ponto, como hoje). A etiqueta diz "falta" ou "pênalti" e o cobrador; ninguém é apontado como autor da falta.

### D4. Posse e direção do ataque (a sombra)

**A direção** é a do lado: o mandante ataca para a direita, o visitante para a esquerda, o jogo todo. Não precisa de nada do motor.

**O dono da bola** é que não existe por minuto. Opções:

- **A. Sombra só nos lances.** Do começo ao desfecho de um lance, o dono é o `side` do evento (fato do motor). Nos minutos sem lance, sem sombra. Prós: 100% fato. Contras: a sombra aparece em menos de um terço do tempo, e some e volta.
- **B. A + moeda por minuto com a posse da súmula.** Em cada minuto sem lance, o dono é sorteado com a chance `stats.home.possession / 100`. Medido em 1.900 partidas: a parte dos minutos de cada time fica longe da posse da súmula (desvio mediano de 4,3 pontos, p90 de 10,1); com sequências (manter o dono com 60%), piora (p90 de 17,6). O campo mostraria 52% para quem a súmula dá 62%.
- **C. A + cota com faixa (recomendada).** Nos minutos sem lance, cada time fica com a bola até "dever" de 0,5 a 2 minutos de posse em relação à porcentagem da súmula; aí ela passa ao outro. Medido em 1.900 partidas: desvio mediano de 1,2 ponto entre a parte do campo e a posse da súmula, p90 de 2,4, p99 de 3,3; sequências de 4,1 minutos em média (cerca de 3 s no Normal), sem a alternância mecânica de minuto a minuto. Prós: a sombra existe em todo minuto e conta a mesma história da súmula. Contras: usa a posse do jogo inteiro desde o 1º minuto (ver "Vazamento" abaixo).
- **D. O motor passa a dar posse por tempo ou por minuto.** Ver D6. Descartada.

**Regra da opção C (para o `developer`):** _o item 4 vale também para os passos sem lance com bola em jogo, com peso pelo tempo, no modo "só a bola" (§10)._

1. `p = stats.home.possession / 100`, do `MatchResult` que a tela já tem. `debt = 0` no começo do jogo; a faixa `band` é sorteada em `[0,5; 2,0]` com o rótulo `${seed}-pitch-band-start`.
2. Nos passos de lance (começo, desfecho, pênalti, chance fraca), o dono é o `side` do evento; o `debt` não muda.
3. **Depois de um lance:** depois de um gol, o dono passa ao time que sofreu (a saída de bola); depois de uma chance para fora, defendida ou na trave, ou de um pênalti perdido, ao time que defendeu. **Começo de cada tempo:** o mandante no 1º, o visitante no 2º (convenção da tela; o motor não diz quem sai jogando, e a súmula não registra).
4. **Em cada minuto sem lance, antes de jogar:** se o dono é o mandante e `debt < −band`, o dono passa ao visitante; se é o visitante e `debt > band`, passa ao mandante; a cada troca, uma faixa nova, sorteada com o rótulo `m${slot}-band`. Depois, `debt += p − (dono é o mandante ? 1 : 0)`.
5. A faixa `[0,5; 2,0]` vai para o `PITCH_MOTION` como `possessionBand`.

**Vazamento:** a posse da súmula é a média dos dois tempos, e a do 2º tempo usa o meio de campo do fim do jogo (energia, expulsões, conversa do intervalo). Usá-la desde o 1º minuto "sabe" um pouco do futuro. O efeito máximo é de poucos pontos de posse (1,5 por ponto de diferença de meio, mais ou menos 3 de ruído), não diz nada sobre gols e nenhum jogador consegue contar minutos de posse na tela. **Aceito**, e registrado aqui. Não muda o começo nem o desfecho de nenhum lance.

**Com a T-033 (comandos):** um comando do técnico refaz o resto da partida, e a posse da súmula muda. Os passos já mostrados não mudam; a cota continua do ponto em que está, com o `p` novo.

### D5. O goleiro na defesa e a troca de goleiro

O goleiro que defende é o dono do disco do goleiro do outro lado (`Field.owner`). Ele está certo nas trocas (o reserva fica com o disco de quem saiu). Ele **diverge do motor** num caso só: quando o goleiro sai sem troca, o motor põe no gol o jogador de linha com o maior `physical` (`fillEmptyGoal`, empate na primeira vaga), e a coreografia põe o da última vaga ocupada. Medido: 9 em 3.800 partidas (0,24%). O efeito de hoje: o disco do goleiro passa a ser de outro jogador, e se esse jogador finaliza depois, é o disco do goleiro que sobe para chutar. _No modo "só a bola" (§10) esse efeito some (o disco do lance é criado pelo `PlayerId` do evento), e a opção B fica sem efeito pela decisão 4 do CEO (a defesa leva o finalizador)._

- **A. Corrigir a coreografia** para a regra do motor: o disco de linha, em campo, cujo jogador tem o maior `attributeOf(player, 'physical')`, empate no menor índice de disco. Igual ao motor enquanto o lado não trocou de formação (a troca de formação reordena as vagas pela energia, que a tela não conhece).
- **B. Defesa sem nome depois de uma troca de goleiro:** a etiqueta diz "defesa" com o escudo do clube, sem nome nem número.
- **Recomendo A + B:** A corrige o disco que sobe para chutar; B garante que nenhum nome errado apareça no caso que A não cobre (troca de formação e depois goleiro expulso). Custo: 0,24% das partidas perdem um nome na defesa.

### D6. Mudar o motor ou o save?

- **A. Só interface (recomendada).** Tudo acima usa o que a tela já recebe: os eventos, os `players` do `live.match`, o `stats.home.possession` e a semente da partida, com rótulos novos de sorteio na coreografia. `ENGINE_VERSION` (19), goldens do motor, `SAVE_SCHEMA_VERSION` e fixtures do save não mudam. Sem ADR.
- **B. O motor expõe a posse de cada tempo** (`stats.possessionByHalf`). Ganho pequeno (o vazamento de D4 cai pela metade). Custo: muda a saída do `MatchResult`, os goldens da partida e o `ENGINE_VERSION`; se entrar no `MatchStats`, o save grava as estatísticas e muda o formato. Não vale.
- **C. O motor gera passes e posse por minuto.** Custo: sorteios novos mudam todos os resultados (`ENGINE_VERSION`, goldens, novo balanceamento de gols, zebra e chances); um tipo de evento novo no save (o resumo da rodada e a súmula gravam os eventos, validados em `app/src/lib/save/validate.ts`, até 2.000 por partida) exige ADR e migração; e cerca de 100 eventos a mais por partida pesam no save. Tudo para dar "fato" a um passe que não decide nada. **Descartada**, e eu recusaria mesmo com o pedido: um sistema que ninguém sente no resultado não entra no motor.

### D7. Perspectiva (para o CEO decidir depois)

Nada nos dados muda com a perspectiva. Do lado da regra, o que ela precisa manter:

- **Lados fixos:** o mandante à esquerda atacando para a direita, o jogo todo. Na perspectiva, "esquerda" continua sendo o gol da esquerda de quem olha.
- **A posição como pista que não depende da cor:** o jogador tem de saber de que lado é o lance pela posição. Na perspectiva, o lado de longe encolhe; o lance do fundo do campo não pode ficar ilegível.
- **O desfecho não pode ser antecipado pelo ângulo:** se houver qualquer movimento de câmera, ele é o mesmo para gol e chance no começo do lance (a mesma regra da bola).
- **As metas de desempenho** da T-085 continuam (chunk do campo de no máximo 20 KB gzip, quadro mediano de no máximo 6 ms com 4× de CPU, 30 quadros por segundo no pior caso). Um estádio desenhado tem de caber nelas; se não couber, volta ao `architect`.

## 5. O que muda em decisões anteriores

- **Decisão 11 da T-032 (CEO):** "nenhum cartão, número ou texto no campo (proposta 35)". A etiqueta com número e nome **revoga** essa parte. É decisão de spec, não do `docs/PROJETO.md`: não precisa de ADR, mas precisa do CEO por escrito. A regra "nenhum texto desenhado no canvas" é do `ux-designer` (a etiqueta pode ficar fora do canvas).
- **Decisão 12 da T-032 (CEO):** sem linhas de ambiente nos minutos sem lance. A recomendação (passes anônimos) **respeita**; a opção D de D2 contraria.
- **Coreografia do minuto sem lance** (`partida.md`): "o sorteio não depende do placar nem de quem joga melhor: o campo não sugere domínio que o motor não calculou". Com D4-C, o campo passa a sugerir domínio, mas **o que o motor calculou** (a posse da súmula). A frase da spec muda para: "o campo sugere só o domínio da posse da súmula".
- **`docs/PROJETO.md`** ("Campo 2D visto de cima, jogadores como bolinhas [...] mostrando só os lances importantes"): o "visto de cima" fica em jogo só se o CEO escolher a perspectiva; aí sim é mudança no documento de projeto, e vira ADR.

## 6. Riscos de o jogador achar que é dado real

| Risco                                                                              | Com a recomendação                                                 | Com nomes nos passes (D2-D)                                                           |
| ---------------------------------------------------------------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| Nome de quem não está em campo (reserva, expulso, lesionado)                       | impossível: o nome vem do evento                                   | evitável: os minutos sem lance não têm evento, e `Field.owner` está certo nesse ponto |
| Contradição com a nota (o meia "dá 20 passes" e tira 5,8; passe não conta na nota) | não há passe com nome                                              | **alto**: a nota é gols, assistências, defesas, gols sofridos, cartões e resultado    |
| Contradição com o melhor em campo                                                  | não há                                                             | alto, pela mesma razão                                                                |
| Passador do começo do lance diferente do assistente da súmula                      | o passador do começo é anônimo; a assistência aparece na revelação | direto, se o começo tiver nome                                                        |
| Jogador em posição que não é a dele depois de uma troca de formação                | sem efeito no nome (ele vem do evento); só visual                  | "o zagueiro Fulano tocando no ataque"                                                 |
| Goleiro errado depois de uma troca de goleiro                                      | D5: coreografia corrigida e defesa sem nome nesse caso             | o mesmo, mais os passes                                                               |
| Autor de falta inventado                                                           | nunca                                                              | nunca                                                                                 |
| Campo e súmula com posses diferentes                                               | p90 de 2,4 pontos (D4-C)                                           | o mesmo                                                                               |
| "Só lances principais" e "Animada completa" parecerem jogos diferentes             | não: o que tem nome é o mesmo nos dois modos                       | sim: um modo tem dezenas de "fatos" que o outro não tem                               |

## 7. Pedido ao `developer` (se o CEO aprovar a recomendação)

Tudo em `app/src/ui/match/` (`scene.ts` e o que a etiqueta precisar); nada em `app/src/engine/` nem em `app/src/lib/save/`. Tamanho estimado: M (a etiqueta e o visual vêm do `ux-designer`).

**Critérios de aceite (Vitest, salvo onde dito):**

1. **Nomes só de eventos:** em 200 partidas simuladas (sementes fixas), toda etiqueta com jogador tem um `PlayerId` do evento do passo (`shooter`, `scorer`, `taker`, `player`, `out`, `in`; `assist` só no desfecho do gol) ou é o goleiro de D5. Nenhum passo `minuteFull` tem etiqueta de jogador nem "próximo".
2. **Número certo:** o número da etiqueta é o `shirt` do `Player` com aquele `PlayerId` em `live.match.<lado>.players`.
3. **Nada antecipa o desfecho:** o teste dos 11 pontos que já existe passa a cobrir também o passe do começo do lance (origem, rastro e quem recebe), a etiqueta e o "próximo": iguais para gol e chance do mesmo lado, finalizador e tipo.
4. **Posse que bate com a súmula:** em 1.000 partidas, `|parte dos minutos sem lance com o mandante como dono − stats.home.possession|` tem p90 de no máximo 3 pontos e p99 de no máximo 4,5. _No modo "só a bola": parte do **tempo** (relógio Normal) dos passos da cota (§10)._
5. **Dono depois dos lances:** depois de um gol, o dono é quem sofreu; depois de uma chance perdida ou um pênalti perdido, quem defendeu; o primeiro minuto sem lance de cada tempo (sem lance antes) é do mandante no 1º e do visitante no 2º.
6. ~~**Passes com discos em campo:** quem passa e quem recebe têm `on[d] === 1` no passo; o rastro nunca começa nem termina num disco fora.~~ _Sem efeito no modo "só a bola" (§10)._
7. **Goleiro (D5):** com o goleiro expulso sem troca, o disco do goleiro passa ao jogador de linha em campo de maior `physical` (empate: menor índice), num caso montado à mão; e, depois de uma troca de goleiro num lado que mudou de formação, a defesa sai sem nome.
8. **Determinismo:** a mesma partida dá a mesma coreografia; os sorteios que existem (`m${slot}`, `-build`, `-outcome`) não mudam de valor por causa dos rótulos novos (`-band-start`, `m${slot}-band`).
9. **Motor e save intactos:** `ENGINE_VERSION` 19, goldens do motor e `SAVE_SCHEMA_VERSION` sem mudança; o chunk do campo continua com no máximo 20.000 bytes gzip (`tests/regression/match-chunks.test.ts`).
10. **Textos:** os tipos da etiqueta são chaves em `app/src/content/<idioma>/` (pt-BR, es, en), nunca no código; o lote passa pelo `content-writer` e pelo CEO.

## 8. Decisões para o CEO

1. **Quem ganha nome no campo (D1):** só quem está num evento do motor (recomendado) ou também os passes de ligação.
2. **Passes nos minutos sem lance (D2):** nada; **anônimos (recomendado)**; só número; nome e número.
3. **Passe antes do lance (D3):** **anônimo no começo e assistência na revelação (recomendado)**, com o "replay" da assistência se o visual comportar; ou sem passe no começo.
4. **Sombra da posse (D4):** só nos lances; moeda por minuto; **cota que bate com a súmula (recomendado)**.
5. **Revogar a parte "nenhum número ou texto no campo" da decisão 11 da T-032**, se o item 1 ficar com etiqueta.
6. **Perspectiva (D7):** fica para depois do estudo visual do `ux-designer`; se entrar, o "visto de cima" do `docs/PROJETO.md` vira ADR.

## 9. Decisões do CEO (2026-11-23)

Aprovadas as recomendações: D1-A (só tem nome quem está num evento do motor), D2-B (passes de ligação anônimos), D3-B (passe anônimo no começo, assistência na revelação, sem "replay" no campo), D4-C (posse por cota que bate com a súmula) e D6-A (motor e save intactos). A parte "nenhum número ou texto no campo" da decisão 11 da T-032 fica revogada (a etiqueta fica fora do canvas). D5: a correção do goleiro no campo entra na fase 1; a etiqueta da defesa mostra o finalizador e "Defendida", sem nomear o goleiro. D7: a perspectiva por código (inclinação do campo) entra na fase 1, no lugar da vista de cima, com ADR; as restrições de regra da D7 valem (ver [telas/partida-campo-v2.md](telas/partida-campo-v2.md), §15).

## 10. Modo "só a bola" (2026-11-24)

O CEO escolheu o modo "só a bola" ([telas/partida-campo-v2.md](telas/partida-campo-v2.md), §5 e §16). Nos minutos sem lance, o campo mostra só a bola, os rastros por tipo, a cunha e a camisa do time com a bola; os discos só aparecem nos lances do motor. Conferi pelo lado da regra, com medida nova (1.900 partidas, 5 temporadas, `ENGINE_VERSION` 19). A regra em uma frase continua valendo.

**Ficam sem efeito:**

- os passes entre discos da D2-B (itens 2 a 5: quem passa, quem recebe, a faixa de 45 a 75 m do dono e o fim 1 m à frente de quem recebe) e o critério 6 do §7;
- o disco de origem do passe do começo do lance na D3-B;
- a D5-B, já trocada pela decisão 4 do CEO (a defesa leva o finalizador e "Defendida").

**Confirmações e ajustes:**

1. **D2-B com a bola de 10 a 95 m: confirmada, com um ajuste.**
   - A faixa é simétrica entre os dois lados, porque o espelho de 10 a 95 é ele mesmo.
   - Nada nela nomeia ninguém. A camisa sobre a bola não tem número nem nome.
   - **Ajuste:** o cruzamento do §6 da spec cai "de 7 a 14 m da linha de fundo", o que leva a bola a até 98 m. Isso contradiz o limite de 95 m e o critério 4 de "planejador e rastros" do §13. O cruzamento passa a cair **de 10 a 14 m** da linha de fundo.
   - Regra que fica: num minuto sem lance, a bola nunca chega a menos de 10 m de uma linha de gol, e nenhuma ação vai na direção do gol. O campo não mostra quase-chance que o motor não sorteou.
   - **Regra de honestidade do planejador:** ele lê só a semente, o dono, o estado da bola no fim do passo anterior e o ponto do lance. Nunca lê o placar, as forças, o tipo de evento nem os eventos futuros. Os pesos das ações são os mesmos para os dois times. O único "domínio" que o campo mostra é a posse da súmula (D4-C).
2. **D4-C: confirmada, com um ajuste para continuar batendo com a súmula.**
   - No modo "só a bola", a cunha e a camisa aparecem também nos passos de amarelo, lesão, troca, mudança tática, acréscimo e vermelho. São cerca de 6 s por partida no Normal, além dos 53 s de minutos sem lance.
   - Se só os minutos sem lance movessem a cota, a parte do tempo com a bola se afastaria da súmula: p90 de 3,9 pontos e p99 de 6,1.
   - **Ajuste:** todo passo da cota move a conta, com peso pelo tempo. O item 4 vira `debt += (p − (dono é o mandante ? 1 : 0)) × duração Normal do passo ÷ 800 ms`, e a troca de dono é conferida antes, como hoje.
   - Medido: p50 de 1,0 ponto, p90 de 2,2, p99 de 3,0 e máximo de 3,5. O critério 4 do §7 (p90 até 3, p99 até 4,5) passa a medir a parte do tempo.
   - **Passos da cota:** os minutos sem lance e os passos de amarelo, lesão, troca, mudança tática, acréscimo e vermelho, exceto o passo logo depois de um gol (a bola volta ao centro, sem dono).
   - **Nuance de texto para a spec:** a camisa sobre a bola diz "quem está com a bola" num minuto, e isso é decorativo. O fato é a parte do tempo, que bate com a posse da súmula. A spec diz "que é fato (D4-C)", e eu trocaria por "que segue a posse da súmula (D4-C)".
3. **D3-B e o começo do gol igual ao da chance: confirmada.** A escolha do tipo do passe do começo usa só estes dados:
   - o dono do passo anterior;
   - a posição da bola no fim dele ("aberta" a mais de 14 m do meio na largura);
   - se a ação anterior foi por cima;
   - o ponto do lance, sorteado com o rótulo `-build` a partir do lado, do finalizador e do tipo.

   Nada disso lê o desfecho, então gol e chance dão o mesmo cruzamento ou o mesmo rasteiro.
   - Ressalva já aceita na D4-C: o `p` da cota é a posse do jogo inteiro e pode diferir, por pouco, entre uma partida em que o lance é gol e outra em que é chance. Isso não muda o começo do lance que se vê.
   - **Pedido ao teste dos 11 pontos:** monte as duas variantes trocando só o evento do lance (gol ou chance, com o mesmo `stats.home.possession` e os mesmos eventos anteriores) e compare o tipo do passe do começo, o caminho da bola, a cunha, os discos e a etiqueta.

4. **D5-A no PR A: confirmada.**
   - O efeito visível ficou pequeno: o disco do goleiro é anônimo, e a defesa leva o finalizador.
   - Ela continua necessária porque o critério 1 de âncora do §13 da spec calcula o goleiro pela regra do motor, e a coreografia de hoje erra em 0,24% das partidas.
   - É barata: uma escolha por maior `physical` sobre os jogadores que a tela já tem.
