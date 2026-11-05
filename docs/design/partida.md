# Partida e táticas

> Mantido pelo `game-designer`. Fonte das decisões: `docs/PROJETO.md`, "Táticas" e "Cálculo da partida"; mando de campo pela torcida em `docs/design/brasilidades.md` ("Torcida dentro do jogo"). Metas em `balance-targets.md`. Parâmetros em `app/src/params/match.json` (nomes `match.*`, `fatigue.*`, `cards.*`, `injury.*`).

**Regra em uma frase:** a cada minuto, cada time tem uma chance de criar uma oportunidade que cresce com a diferença entre o seu meio e ataque e a defesa do adversário; cada oportunidade vira gol, defesa, trave ou chute para fora conforme o finalizador contra o goleiro.

## Escopo

| Entra na 1a                                                                         | Fica para depois                                                       |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Formação, postura e pressão; comandos em jogo; até 5 substituições                  | Altitude e clima (Etapa 5, "Mando de campo, altitude e clima")         |
| Mando de campo pelo termômetro da torcida (+ fator casa, se aprovado)               | Treino semanal e comissão técnica mexendo em fadiga e lesões (Etapa 3) |
| Cansaço dentro do jogo e entre jogos; lesões simples; cartões e suspensão de 1 jogo | STJD: agressão, efeito suspensivo, escalação irregular (Etapa 2)       |
| Pênaltis e faltas diretas; capitão e cobradores; conversa no intervalo              | Calendário congestionado com copas (Etapa 2)                           |
| Clássicos (rivalidade)                                                              | Incidentes de torcida, portões fechados (Etapa 2/3)                    |

## Visão geral do cálculo

1. **Antes do apito:** calcula a nota efetiva de cada titular, as forças de setor (defesa, meio, ataque) de cada time, o bônus de mando e a "forma do dia".
2. **Minuto a minuto** (1 a 45 + acréscimos, intervalo, 46 a 90 + acréscimos): para cada time, na ordem mandante e depois visitante, sorteia se cria oportunidade; se cria, sorteia tipo, finalizador, resultado e assistência. Depois sorteia cartões e lesões de cada jogador em campo, na ordem da escalação, e desconta energia.
3. **Comandos** (do técnico ou da IA) valem a partir do minuto seguinte.
4. **Fim:** placar, eventos, estatísticas, notas dos jogadores, condição final e novas lesões e suspensões.

## Nota efetiva de um jogador em campo

```
eff = overall × fit(posição natural, posição da vaga) × moraleMult × condMult
moraleMult = 0.95 + 0.10 × moral / 100           (moral 0 → 0,95; 50 → 1,00; 100 → 1,05)
condMult   = 0.80 + 0.20 × energy / 100          (energia 100 → 1,00; 70 → 0,94)
```

`overall`, `fit` (tabela de posições) e `moral` estão em `jogadores.md`. `energy` começa na condição do jogador e cai durante o jogo (ver "Cansaço").

## Formações

Cada vaga tem uma posição e um setor. Os laterais na linha de três (3-5-2, 3-4-3) são alas e contam no meio.

| Formação | Defesa (vagas) | Meio (vagas)        | Ataque | `def` | `mid` | `atk` |
| -------- | -------------- | ------------------- | ------ | ----- | ----- | ----- |
| 4-4-2    | 2 ZAG, 2 LAT   | 2 VOL, 2 MEI        | 2 ATA  | 1,00  | 1,00  | 1,00  |
| 4-3-3    | 2 ZAG, 2 LAT   | 1 VOL, 2 MEI        | 3 ATA  | 0,99  | 0,96  | 1,06  |
| 4-2-3-1  | 2 ZAG, 2 LAT   | 2 VOL, 3 MEI        | 1 ATA  | 1,01  | 1,04  | 0,95  |
| 3-5-2    | 3 ZAG          | 2 LAT, 2 VOL, 1 MEI | 2 ATA  | 0,96  | 1,06  | 1,00  |
| 3-4-3    | 3 ZAG          | 2 LAT, 2 VOL        | 3 ATA  | 0,95  | 0,98  | 1,10  |
| 5-3-2    | 3 ZAG, 2 LAT   | 2 VOL, 1 MEI        | 2 ATA  | 1,05  | 0,95  | 0,97  |

Sempre 1 GOL. Os multiplicadores representam quantos jogadores pesam em cada setor; foram escolhidos para que nenhuma formação seja melhor com elencos iguais (protótipo: todas entre −1,9 e +1,5 ponto de saldo contra o 4-4-2). A formação certa é a que encaixa os melhores jogadores do elenco nas suas posições.

## Forças de setor e poder de ataque

```
Def(t)  = média(eff das vagas de defesa) × formation.def × T(t)
Mid(t)  = média(eff das vagas de meio)   × formation.mid × pressure.mid × T(t)
Atk(t)  = média(eff das vagas de ataque) × formation.atk × T(t)
Power(t)   = (match.midWeight × Mid(t) + (1 − match.midWeight) × Atk(t)) × posture.power
Defense(t) = Def(t) × posture.def
T(t) = (1 + home(t)) × (1 − match.missingPlayerPenalty × faltando(t)) × (1 + halftimeBoost(t))
```

Depois disso soma-se a **forma do dia** `dayForm(t)`, sorteada uma vez no apito inicial, a `Power` e a `Defense` do time: `dayForm ~ Normal(0, match.dayFormSd)`, em pontos (aproximação por soma de 6 uniformes, que o `Rng` dá de forma determinística).

`faltando(t)` = jogadores a menos que 11 (expulsão ou lesão sem substituição disponível).

### Vaga vazia (jogador a menos)

**Regra:** a vaga vazia sai da média do seu setor, e o time paga só o `missingPlayerPenalty` de `T(t)`. Se o setor fica sem ninguém, a média dele passa a ser `EMPTY_SECTOR_FIT × média(eff de todos os jogadores de linha em campo)`, com `EMPTY_SECTOR_FIT = 0.90` (constante: o `fit` de "improvisado" da tabela de posições).

- `média(eff das vagas do setor)` é sempre sobre as vagas **ocupadas**; cada jogador entra com o `eff` da vaga em que está e a energia do momento. A vaga vazia nunca conta como 0: contar 0 somaria um segundo castigo ao `missingPlayerPenalty` (perder um de dois atacantes cortaria o ataque pela metade), e o 0,07 já foi calibrado como o custo inteiro de um a menos.
- A vaga do goleiro nunca fica vazia: se o goleiro sai sem substituição, o jogador de linha de maior `physical` vai para o gol ("Casos de borda") e a vaga **dele** é que fica vazia, pela mesma regra.
- O setor vazio continua levando `formation.*`, `pressure.mid` (se for o meio) e `T(t)`, como os outros. A média de jogadores de linha nunca é de zero jogadores: com menos de 7 em campo a partida já acabou, então sempre há pelo menos 6 na linha.
- Por quê: uma regra só, sem tabela de "setor vizinho". Perder um jogador custa o mesmo 7% em qualquer setor, salvo quando esvazia o setor; aí custa um pouco mais, porque alguém improvisa na função. O caso só acontece com facilidade no 4-2-3-1 (um ATA), e o efeito na meta "nenhuma tática dominante" é desprezível: o centroavante isolado sai sem reposição em menos de 1% dos jogos.

**Exemplo 1 (um de dois atacantes).** 4-4-2, campo neutro, sem conversa de intervalo; ATA com eff 78 e 70. O de 78 é expulso. Antes: `Atk = 74 × 1,00 × 1 = 74`. Depois: `Atk = 70 × 1,00 × 0,93 = 65,1` (a média é só do que ficou, 70, e não 35). Os outros setores também levam o 0,93.

**Exemplo 2 (caso extremo: setor vazio).** 4-2-3-1, campo neutro, postura equilibrada, pressão média, `midWeight` 0,5. Defesa 70, 70, 68, 72; meio 74, 70, 72, 66, 68 (média 70); ATA único com eff 76, expulso.

|         | Antes            | Depois da expulsão                                                      |
| ------- | ---------------- | ----------------------------------------------------------------------- |
| `Mid`   | 70 × 1,04 = 72,8 | 72,8 × 0,93 = 67,7                                                      |
| `Atk`   | 76 × 0,95 = 72,2 | 0,90 × 70,0 × 0,95 × 0,93 = 55,7 (70,0 = média dos 9 de linha: 630 / 9) |
| `Power` | 72,5             | 61,7                                                                    |

Se o expulso fosse um zagueiro, `Power` cairia só para 72,5 × 0,93 = 67,4: perder o único atacante custa cerca de 14% das oportunidades por minuto (`exp(0,14 × −1,08) = 0,86`), contra 7% de um a menos comum (`exp(0,14 × −0,51) = 0,93`).

## Chance de oportunidade e finalização

Por minuto, para o time `t` contra o adversário `o`:

```
pChance = clamp(match.baseChance × exp(match.kChance × (Power(t) − Defense(o)) / 10), 0.01, 0.30)
```

Se cria, o **tipo** da oportunidade:

| Tipo         | Probabilidade               | Quem finaliza                       | Chance de gol                                           |
| ------------ | --------------------------- | ----------------------------------- | ------------------------------------------------------- |
| Pênalti      | `match.penaltyShare` = 1,5% | cobrador de pênalti                 | `clamp(0.78 + 0.004 × (finishing − gkEff), 0.60, 0.92)` |
| Falta direta | `match.freeKickShare` = 6%  | cobrador de falta (usa `technique`) | `pGoal × 0.45`                                          |
| Jogada       | o resto                     | sorteado pelos pesos abaixo         | `pGoal`                                                 |

```
shot  = finishing do finalizador × fit × moraleMult × condMult × (1 + home(time do finalizador))
gkEff = eff do goleiro adversário × (1 + home(time do goleiro))
pGoal = clamp(match.conversion × exp(match.kFinish × (shot − gkEff) / 10), 0.04, 0.40)
```

**Mando na finalização.** O mando também vale no chute e na defesa do goleiro: o finalizador do mandante chuta com `shot × (1 + home)`, e o goleiro do mandante defende com `gkEff × (1 + home)`. O `home(t)` é o mesmo da seção "Mando de campo e clássico", calculado uma vez no apito inicial; o visitante e os dois times em campo neutro têm `home = 0`, e o fator vira 1.

- Entra só o fator de mando, `(1 + home(t))`, e não o `T(t)` inteiro: jogador a menos e conversa do intervalo continuam mexendo só nas forças de setor (criação de chances), nunca no chute nem no goleiro.
- Vale nos três tipos de oportunidade: na jogada (`shot`), na falta direta (`shot` com `technique` no lugar de `finishing`, depois o `× 0.45`) e no pênalti, em que o `finishing` do cobrador do mandante vira `finishing × (1 + home)` e o `gkEff` do goleiro do mandante vira `gkEff × (1 + home)` na mesma fórmula da tabela.
- O fator entra antes do `clamp`; os limites de `pGoal` (0,04 a 0,40) e do pênalti (0,60 a 0,92) não mudam.
- Por quê: com o mando só na criação de chances, o mandante cria mais, mas cada chute dele vale o mesmo que o do visitante, e a vantagem de casa fica fraca no placar. Pôr o mesmo fator nas duas pontas da finalização faz o mando aparecer no resultado sem parâmetro novo.

Peso de cada jogador de linha para ser o finalizador de uma jogada: `shooterWeight[setor da vaga em que joga] × finishing / 60`, com ATA 3,0, MEI 1,6, VOL 0,6, LAT 0,5, ZAG 0,4 (cabeçada em escanteio), GOL 0.

Se não é gol: trave 7%, defesa do goleiro 48%, para fora 45%. Na jogada que termina em gol, há assistência em 70% dos casos (`match.assistShare`), de um companheiro sorteado com peso `assistWeight[setor] × passing / 60` (MEI 3,0, LAT 1,5, ATA 1,5, VOL 1,2, ZAG 0,5; GOL 0), também pelo setor da vaga. Atributo que o jogador não tem (goleiro na linha) vale `round(0.4 × overall)` ("Atributo ausente" em `jogadores.md`); a força do goleiro é sempre o `eff`, então jogador de linha no gol não precisa de `reflexes`.

**Exemplo numérico.** Mandante com força 74, visitante com 68, termômetro do mandante 60, 4-4-2 equilibrada nos dois, todos descansados, moral 50, fator casa aprovado. `home = 0.05 + 0.02 + 0.06 × 0.60 = 0.106`. Power do mandante ≈ 74 × 1,106 = 81,8; Defense do visitante ≈ 68. Diferença 13,8 → `pChance = 0.090 × exp(0.14 × 1.38) = 0.109` por minuto, cerca de 10 oportunidades no jogo. No sentido contrário, diferença −13,8 → 0,074 por minuto, cerca de 7. Na finalização, com atacantes de finishing 78 (fit 1, moral 50, descansados) e goleiros de eff 66 nos dois times:

| Quem chuta | `shot`            | `gkEff` do goleiro que defende | `pGoal`                                       |
| ---------- | ----------------- | ------------------------------ | --------------------------------------------- |
| Mandante   | 78 × 1,106 = 86,3 | 66 (visitante, `home = 0`)     | `0.15 × exp(0.09 × 2.03) = 0.180`             |
| Visitante  | 78                | 66 × 1,106 = 73,0              | `0.15 × exp(0.09 × 0.50) = 0.157`             |
| Neutro     | 78                | 66                             | `0.15 × exp(0.09 × 1.2) = 0.167` (referência) |

Cada chute do mandante vale cerca de 8% a mais e cada chute do visitante cerca de 6% a menos que em campo neutro. No pênalti, com os mesmos 78 e 66: mandante `0.78 + 0.004 × 20.3 = 0.861`, visitante `0.78 + 0.004 × 5.0 = 0.800`, neutro 0,828.

## Táticas

| Ajuste  | Opção                               | Efeito                                                      | Parâmetros                             |
| ------- | ----------------------------------- | ----------------------------------------------------------- | -------------------------------------- |
| Postura | Defensiva                           | Menos chances criadas, menos sofridas                       | `power` 0,95 · `def` 1,05              |
|         | Equilibrada                         | Referência                                                  | 1,00 · 1,00                            |
|         | Ofensiva                            | Mais chances criadas, mais sofridas                         | 1,05 · 0,95                            |
|         | Tudo no ataque (só comando em jogo) | Aposta para buscar o resultado                              | 1,10 · 0,85                            |
| Pressão | Baixa                               | Meio rende menos, cansa menos, menos cartões                | `mid` 0,96 · `drain` 0,8 · `cards` 0,7 |
|         | Média                               | Referência                                                  | 1,00 · 1,0 · 1,0                       |
|         | Alta                                | Meio rende mais (bola recuperada), cansa mais, mais cartões | 1,05 · 1,4 · 1,4                       |

Protótipo com elencos iguais: ofensiva × equilibrada termina 36,8% / 25,6% / 37,6% com 2,79 gols; defensiva × equilibrada, 36,4% / 28,1% / 35,6% com 2,37 gols; pressão alta, 37,6% / 25,9% / 36,5%. Nenhuma opção domina; o que muda é o tipo de jogo, e a escolha certa depende do placar e do adversário.

**Comandos em jogo** (botões; equivalem a ajustes, aplicados no minuto seguinte):

| Comando              | O que faz                               |
| -------------------- | --------------------------------------- |
| Pressionar           | pressão alta                            |
| Segurar o resultado  | postura defensiva + pressão baixa       |
| Todo mundo no ataque | postura "tudo no ataque" + pressão alta |

O técnico também pode trocar formação, postura e pressão diretamente a qualquer momento.

### Quando um comando vale

**Regra em uma frase:** o comando leva o último minuto jogado e vale a partir do minuto seguinte, também nos acréscimos do 2º tempo.

- **Relógio da tela.** A partida pausa com o relógio em `M'`, o próximo minuto a ser jogado. O comando sai com `minute: M − 1` e vale a partir de `M`, como pede a US-021 ("o reserva participa dos eventos a partir do minuto 60": a tela mostra 60' e o comando vai com `minute: 59`). No intervalo, o comando vai com `minute: 45` e vale a partir do 46.
- **Acréscimos do 1º tempo.** Os comandos esperam o 2º tempo: vão com `minute: 45`. Nenhuma regra da IA começa antes do 60, então o 1º tempo não precisa de mais que isso.
- **Acréscimos do 2º tempo.** O comando ganha o campo opcional `added` (inteiro de 0 a 6), só com `minute: 90`. `{ minute: 90 }` (ou `added: 0`) vale a partir do 90+1; `{ minute: 90, added: k }` vale a partir do 90+(k+1). Com `k` maior ou igual ao número de acréscimos sorteado (o do último minuto de acréscimo, ou além dele), não há minuto seguinte, e o comando é ignorado no fim do jogo com o aviso `command-too-late`. `added` com outro minuto, ou fora de 0 a 6, é `command-invalid-minute`. Por quê: os acréscimos do 2º tempo têm em média 4 minutos e são onde mora o `golNoFim`; o técnico que sofre um gol no 90+1 precisa poder pôr "todo mundo no ataque". O determinismo continua: os acréscimos são sorteados antes do primeiro minuto de acréscimo, então o comando não muda nada do que já passou.
- **A IA também decide nos acréscimos do 2º tempo** (`ia-clubes.md`, "Durante o jogo"), depois dos comandos daquele minuto.
- **Só o lado do técnico recebe comandos.** Comando para um lado com `controller: 'ai'` é ignorado com aviso `command-ai-side`, verificado no apito. Por quê: com o comando aceito, a IA decidia logo depois no mesmo minuto e podia desfazê-lo; nenhuma tela gera comando para a IA, e no online quem manda em cada clube é o servidor.
- **Lesão com troca disponível:** o lesionado sempre sai e é substituído enquanto houver troca e reserva. O técnico escolhe quem entra com o comando de substituição daquele minuto (`out` = o lesionado); sem comando, vale a regra 1 de `ia-clubes.md`. Ele não pode deixar o time com 10 de propósito: jogar com um a menos custa 7% em todos os setores, nunca é melhor que gastar a troca, e a escolha pediria mais uma pausa na tela.

### Troca de formação durante o jogo

**Regra:** quem já joga numa posição que existe na formação nova fica nela; quem sobra preenche as vagas livres, uma a uma, na ordem da formação; as vagas que ficam sem ninguém são as últimas vagas livres dessa ordem.

1. **Fica na posição.** Na ordem das vagas da formação atual, cada jogador em campo ocupa a primeira vaga livre da formação nova com a **mesma posição** da vaga em que ele está (ZAG → ZAG, LAT → LAT etc.). Vale também para quem está no gol, mesmo jogador de linha: o gol nunca muda de dono numa troca de formação.
2. **Quem sobra.** Na ordem das vagas da formação nova (GOL, ZAG, LAT, VOL, MEI, ATA, como em `FORMATION_SLOTS`), cada vaga ainda livre recebe, entre os que sobraram, o de maior `eff` naquela vaga (com a energia e a moral do momento). Empate: maior overall, depois mais novo, depois menor ID (o mesmo de `ia-clubes.md`, "Escalação").
3. **Vagas vazias.** Com `N` em campo, ficam vazias exatamente `11 − N` vagas: as que sobram no fim do passo 2. Elas seguem a regra de "Vaga vazia".

- Vale para o técnico. A IA da 1a nunca troca a formação durante o jogo (`ia-clubes.md`, "Durante o jogo"); a regra vale para ela quando isso mudar.
- Depois da troca, o técnico pode trocar dois jogadores de vaga entre si (vagas ocupadas), mas não escolhe quais vagas ficam vazias. Assim ninguém esvazia um setor fraco de propósito para receber os 0,90 da média da linha. **Esse comando de troca de vagas entra com as telas (T-033)**, como um tipo novo de `MatchCommand` (`{ kind: 'swapSlots', a, b }`, os dois em campo); a T-012 não o tem e nada a bloqueia: nenhuma tela gera o comando antes disso.
- Trocar para a formação em que o time já está não é troca: nada muda, nem a vaga vazia.
- Expulsão ou lesão sem substituição, sem troca de formação, deixa vazia a vaga de quem saiu, onde ela estiver. Quem entra numa substituição ocupa a vaga de quem saiu.

**Exemplo.** 4-4-2 com 10 em campo (um ATA expulso), todos com moral 50 e energia 100; os VOL têm eff 70 e 66, nessa ordem de vaga, e o ATA que ficou tem eff 76. O técnico muda para 4-3-3 (ZAG 2, LAT 2, VOL 1, MEI 2, ATA 3).

- Passo 1: os 2 ZAG, os 2 LAT e os 2 MEI ficam nas suas posições; o VOL da primeira vaga (70) fica na única vaga de VOL; o ATA ocupa a primeira vaga de ATA.
- Passo 2: sobra o VOL de 66; a segunda vaga de ATA o recebe (`66 × fit(VOL, ATA) 0,75 = 49,5`).
- Passo 3: a terceira vaga de ATA fica vazia.
- `Atk = média(76; 49,5) × 1,06 × 0,93 = 61,9`, contra `76 × 1,00 × 0,93 = 70,7` se ficasse no 4-4-2. Abrir o time com um a menos e sem atacante no banco custa ataque: a troca é uma decisão, não um ganho automático.

## Mando de campo e clássico

```
home(mandante) = match.homeBase + fans.homeBonusMin + (fans.homeBonusMax − fans.homeBonusMin) × termômetro / 100
               + (clássico ? fans.derbyBonus : 0)
home(visitante) = 0
home(campo neutro) = 0 para os dois times
```

**Onde o mando entra (regra em uma frase):** o mesmo `home(t)` multiplica as forças de setor do mandante (por `T(t)`, mais chances criadas), o chute do mandante (`shot × (1 + home)`) e a defesa do goleiro do mandante (`gkEff × (1 + home)`); ver "Mando na finalização". A posse de bola exibida não leva mando ("Estatísticas e notas").

**Valor aprovado e meta.** Os +5% de `match.homeBase` do ADR-0011 continuam sendo o valor aprovado; a fórmula de onde o mando entra é desta página, não do ADR. A meta é o mandante vencer cerca de 47% dos jogos (faixa 45% a 50%, `balance-targets.md`). Se o `/balance` com o mando na finalização sair da faixa, o ajuste é em `match.homeBase` dentro de 0 a 0,08, um por vez, sem mexer na regra.

`fans.homeBonusMin = 0.02`, `fans.homeBonusMax = 0.08`, `fans.derbyBonus = 0.02` (ADR-0005). `match.homeBase = 0.05` (ADR-0011, opção A, aceita pelo CEO; faixa 0 a 0,08: mudar dentro da faixa é ajuste de parâmetro, fora dela é ADR). Em clássico, o visitante também ganha moral (ver `jogadores.md`), e os **amarelos** ficam ×1,2 para os dois lados (`cards.derbyMult`; o segundo amarelo também, porque é um amarelo; o vermelho direto não muda). Altitude: Etapa 5.

## Cansaço

Dentro do jogo, por minuto, cada jogador em campo perde:

```
drain = fatigue.drainPerMinute × pressure.drain × (1.2 − 0.4 × physical / 100)
```

Com `fatigue.drainPerMinute = 0.30`, um jogador de físico 50 em pressão média termina os 90 minutos com cerca de 72 de energia; em pressão alta, com cerca de 62. Goleiro gasta 30% disso. Quem entra no segundo tempo começa com a própria condição.

Entre jogos: `condição final = energia ao fim do jogo`; depois recupera `fatigue.recoveryPerDay = 7` por dia até 100. Com 3 dias entre jogos (rodada no meio da semana), quem terminou com 72 volta com 93; com 7 dias, volta inteiro. É isso que obriga rotação nas semanas com dois jogos.

## Lesões (versão simples da 1a)

Por minuto, cada jogador em campo:

```
pInjury = injury.basePerMinute × (1 + 2 × (1 − energy / 100))
```

`injury.basePerMinute = 0.00012` (cerca de 0,3 lesão por partida, os dois times). Um jogador cansado (energia 60) tem 1,8× o risco de um descansado. Gravidade sorteada:

| Gravidade | Probabilidade | Rodadas fora |
| --------- | ------------- | ------------ |
| Leve      | 60%           | 1            |
| Média     | 25%           | 2 a 3        |
| Séria     | 12%           | 4 a 8        |
| Grave     | 3%            | 10 a 20      |

O lesionado sai na hora: o técnico (ou a IA) escolhe o substituto; sem substituição sobrando, o time fica com um a menos. Uma lesão que passa do fim da temporada termina no fim da temporada (na 1a não há pré-temporada).

## Cartões e suspensão

Por minuto, cada jogador em campo:

```
pYellow = cards.yellowPerMinute × pressure.cards × positionMult × traitMult × (já tem amarelo ? cards.bookedMult : 1)
          × (clássico ? cards.derbyMult : 1) × (acalmar no intervalo e 2º tempo ? 0.75 : 1)
pRed    = cards.redPerMinute × pressure.cards × positionMult × traitMult
```

| Posição        | GOL | ZAG | LAT | VOL | MEI | ATA |
| -------------- | --- | --- | --- | --- | --- | --- |
| `positionMult` | 0,2 | 1,3 | 1,1 | 1,3 | 0,9 | 0,8 |

`traitMult` = 1,5 para temperamental, 1,0 para os outros. `positionMult` é o da **posição da vaga** em que o jogador está no minuto, não o da posição natural (como os pesos de finalizador e assistência): um volante improvisado de lateral usa 1,1, e o jogador de linha que foi para o gol usa 0,2. O fator 0,5 depois do amarelo é o jogador "jogando pendurado" (`BOOKED_MULT`, constante por enquanto; ver "Calibragem dos vermelhos").

`cards.yellowPerMinute = 0.0020` dá cerca de 4 amarelos por jogo (motor, T-010: 3,89). `cards.redPerMinute = 0.00003` dá cerca de 0,07 vermelho direto por jogo (motor: 0,068). Com o fator 0,5, o segundo amarelo dá cerca de 0,20 por jogo (motor: 0,205), e o total fica em cerca de 0,27, acima da meta de 0,11 a 0,25 de `balance-targets.md`.

Segundo amarelo vira vermelho. Expulso sai e não é substituído; o time joga com um a menos (`match.missingPlayerPenalty = 0.07` em todos os setores por jogador a menos).

**Eventos e números do segundo amarelo (regra em uma frase):** o segundo amarelo gera só o evento `red` com motivo `secondYellow`, sem um segundo `yellow`.

- Nas estatísticas, o jogador fica com 1 amarelo e 1 vermelho; "amarelos por partida" conta eventos `yellow`, então o segundo amarelo não entra duas vezes.
- Na nota, desconta −0,5 (o amarelo) e −1,5 (o vermelho), −2,0 no total. O vermelho direto de quem não tinha amarelo desconta só −1,5; o de quem já tinha amarelo, também −2,0. Cada cartão mostrado custa o seu valor, sem exceção.

**Suspensão na 1a:** 3 amarelos acumulados = 1 jogo de suspensão (e o contador zera); vermelho = 1 jogo. Os dois amarelos que viraram vermelho não entram no acúmulo. As suspensões somam. Suspensão por agressão, julgamento e recurso: Etapa 2 (STJD).

| Caso (contador antes do jogo)              | Contador depois | Suspensão                       |
| ------------------------------------------ | --------------- | ------------------------------- |
| 2, leva amarelo                            | 0               | 1 jogo (3 amarelos)             |
| 2, leva amarelo e depois vermelho direto   | 0               | 2 jogos (3 amarelos + vermelho) |
| 2, leva amarelo e depois o segundo amarelo | 2               | 1 jogo (só o vermelho)          |
| qualquer, vermelho direto sem amarelo      | igual           | 1 jogo                          |

- O campo "terceiro da série" do evento `yellow` diz o que valia **no momento** do cartão. Se o mesmo jogador leva depois o segundo amarelo, o `yellow` não é corrigido; a suspensão e o contador que valem são os do resultado da partida (`newSuspensions`, `yellowCounts`). A narração não erra o que importa: ele fica fora do próximo jogo nos dois casos.
- Por quê o segundo amarelo pesa menos que o terceiro amarelo mais o vermelho direto: é a regra do futebol de verdade (os amarelos da expulsão não acumulam), e quem entende de futebol estranharia o contrário.

### Calibragem dos vermelhos (para a T-016)

A estimativa antiga deste documento ("cerca de 0,18 vermelho por jogo somando o segundo amarelo") estava errada no texto; a fórmula está certa e o motor a reproduz. A conta, para um jogador com taxa de amarelo `λ` por minuto em `T` minutos (cerca de 95, com acréscimos), com o segundo amarelo a `0,5 × λ`:

```
P(segundo amarelo) = (1 − exp(−λ × T / 2))²        (vale só com BOOKED_MULT = 0,5)
λ = cards.yellowPerMinute × positionMult × traitMult × pressure.cards
```

Somando os 22 jogadores do 4-4-2 (`Σ positionMult² = 12,1` por time), com 15% de temperamentais e pressão média, dá 4,0 amarelos, 0,23 segundo amarelo e 0,07 vermelho direto por jogo; o motor dá 0,205, um pouco menos, porque quem sai de campo (substituído ou expulso) não leva mais cartão. Para o total dar 0,18 com 4 amarelos, o segundo amarelo teria de ficar em cerca de 0,12, o que o fator 0,5 não dá.

- **Não é erro de regra:** é calibragem, e fica para a T-016 (um ajuste por vez, com o `/balance`).
- **Botão certo:** o fator do pendurado. Ele é o único que mexe só no segundo amarelo: `cards.yellowPerMinute` tiraria amarelos (3,89 já está perto do centro de 4) e `cards.redPerMinute` só alcança 0,07 do total.
- **Com a IA escalando os dois lados (T-011)** os vermelhos sobem de 0,272 para 0,349 (segundo amarelo 0,272, direto 0,077) e os amarelos de 3,89 para 4,36. A causa inteira é a pressão alta (cartões ×1,4; o segundo amarelo cresce com o quadrado da taxa, cerca de ×1,9): cerca de 38% das fichas da liga vão em pressão alta (`ia-clubes.md`, "Pressão alta por perfil"). Com a mesma IA e a pressão forçada em média, dá 0,269 e 3,88, o mesmo de antes; formação e postura não mexem nos cartões. Com as 38 rodadas em sequência e a condição levada de uma para a outra, nada muda (37,6% de pressão alta, 0,349): a rotação mantém o XI acima de 85 e a regra do cansaço não dispara.
- **Medido no relatório de 30 temporadas** (11.400 jogos, IA nos dois lados, só o fator trocado na cópia de teste; amarelos 4,36, gols 2,73 a 2,75 e goleada 14,3% a 14,5% em todos):

| Fator do pendurado | Segundo amarelo | Vermelhos (total) | Meta 0,11 a 0,25  |
| ------------------ | --------------- | ----------------- | ----------------- |
| 0,50 (hoje)        | 0,272           | 0,349             | falha             |
| 0,30               | 0,165           | 0,242             | no limite         |
| 0,25               | 0,139           | 0,215             | ok                |
| 0,20               | 0,111           | 0,189             | ok, perto de 0,18 |

- **Proposta para a T-016 (revista):** promover `BOOKED_MULT` a parâmetro, `cards.bookedMult`, faixa 0 a 1, e baixar de 0,5 para **0,20** (não mais 0,30). Os 0,30 ficam em 0,242, a 0,008 do teto, sem margem para as três sementes nem para os comandos da T-012 ("todo mundo no ataque" põe pressão alta no fim do jogo). Com 0,20, o segundo amarelo fica em 0,11 e o vermelho direto em 0,08. Métrica que deve mudar: vermelhos por partida, para perto de 0,18. Métricas que não podem piorar: amarelos por partida (3,5 a 4,5; o fator não mexe neles), gols por partida, goleada e zebra com 30 pontos. Medir depois da T-012, com o `/balance` jogando as rodadas em sequência (`ia-clubes.md`, "Pedido ao `developer`", item 5).
- **O que não fazer:** baixar `pressure.cards` da pressão alta (1,4) tiraria o custo da pressão alta e mexeria nos amarelos e no equilíbrio tático; mudar a pressão dos perfis tiraria a identidade do Formador. Os dois ficam como estão.
- **Depois da T-012** (regras novas de `ia-clubes.md` medidas na cópia): os vermelhos caem de 0,343 para 0,321, porque mais pendurados saem de campo nas trocas dos 60, 70 e 80. A proposta de 0,20 continua; medir de novo na T-016 antes de aplicar.

### Calibragem das goleadas (para a T-016)

**Diagnóstico: não é erro de regra da T-012; é calibragem, e uma premissa errada de `balance-targets.md`.** Medido no relatório de 30 temporadas encadeadas (11.400 jogos, IA nos dois lados), numa cópia do motor:

| Variante (só ela muda)                                           | Gols  | Goleada | Diferença ≥ 5 |
| ---------------------------------------------------------------- | ----- | ------- | ------------- |
| Hoje (T-012)                                                     | 2,756 | 14,9%   | 1,5%          |
| Sem nenhuma regra da IA em jogo (regras 2 a 6 desligadas)        | 2,715 | 14,2%   | 1,5%          |
| "Segurar" também ganhando por 2                                  | 2,743 | 14,6%   | 1,5%          |
| "Segurar" com qualquer vantagem, por 2 ou mais já a partir do 60 | 2,717 | 14,2%   | 1,5%          |
| Regra 3 só perdendo por 1                                        | 2,731 | 14,4%   | 1,4%          |
| `match.kChance` 0,12                                             | 2,720 | 14,2%   | 1,5%          |
| `match.dayFormSd` 2                                              | 2,760 | 14,6%   | 1,6%          |
| `match.baseChance` 0,085                                         | 2,623 | 13,8%   | 1,4%          |
| `match.baseChance` 0,082                                         | 2,523 | 12,9%   | 1,0%          |

- As regras em jogo da T-012 somam só 0,7 ponto (14,2% → 14,9%). Mesmo os jogos entre iguais (diferença de força mais mando abaixo de 4) têm 12,7% de goleadas: é a variância do placar com cerca de 2,75 gols, a mesma da conta de Poisson de `balance-targets.md` (14,9% com 2,80 gols).
- A premissa errada: `balance-targets.md` contava com "o time que ganha por 2 ou mais segura o resultado a partir dos 75'" para ficar abaixo do Poisson, mas a regra 5 só age com 1 gol de vantagem, e mesmo estendida ela tira menos de 1 ponto: a postura defensiva com pressão baixa corta só cerca de 5% das chances (`power` 0,95, `mid` 0,96), pouco para mudar o placar em 15 minutos.
- Só com `baseChance` (menos gols) a goleada entra na faixa abaixo de 2,52 gols, na borda das duas metas ao mesmo tempo. Não serve.

**Proposta para a T-016: regra nova "tirar o pé" + `baseChance`, um ajuste por vez.** Aprovada pelo CEO em 2026-11-04 (regra "tirar o pé" para a T-016; meta de substituições de 3 a 4 por time; `ai.subEnergy` 85).

1. **Regra (precisa do CEO e de código):** o time que ganha por 2 gols ou mais cria menos: `Power × match.comfortableLeadPower` no cálculo do `pChance` dele, com `comfortableLeadPower = 0.85` (faixa 0,7 a 1; 1 desliga). Vale para todos os times, técnico ou IA, por cima da postura: é o time que relaxa, não uma ordem do técnico. A `Defense` não muda, então quem perde não ganha chances a mais; o que cai é o terceiro e o quarto gol de quem já ganha. Medido: goleada 14,9% → 12,8%, diferença ≥ 5 1,5% → 1,0%, gols 2,71; 20 pontos mais forte 65,5% → 65,4%; zebra de 30 pontos sem mudança.
2. **Depois, `match.baseChance` 0,090 → 0,087**, para levar os gols ao centro da meta. Medido com os dois: gols 2,63, goleada 12,1% a 12,3%, diferença ≥ 5 0,8% a 0,9%, 0×0 7,1% a 7,2%, empates 25,1%, mandante 46,9% a 47,0%, 20 pontos 64,9%.

- Métrica que deve mudar: goleada, para 11% a 12,5%. Métricas que não podem piorar: gols (2,5 a 2,8), 0×0, empates, mandante, 20 pontos mais forte e zebra de 30 pontos.
- Por quê uma regra e não só parâmetro: os botões existentes mexem na goleada só pelo número de gols, e as duas metas se cruzam na borda. "Tirar o pé" é como o futebol de verdade fica abaixo do Poisson, e o jogador sente: menos 5×0 sem graça, e a virada de quem perde por 2 continua possível. Fica como **decisão de diversão do CEO** (abaixo, e no relatório).
- **Aviso à parte (não é goleada):** a zebra de 30 pontos está em 7,1% (meta 8% a 12%), e já estava em 7,4% a 7,6% sem as regras da IA em jogo. `match.dayFormSd` de 3 para 4 ou 5 não a move (7,6% a 7,7%), ao contrário do que `balance-targets.md` previa. Fica para a T-016, depois das goleadas, com `match.kChance` como próximo candidato, medido nos duelos calibrados.

## Substituições

- Até 5 por jogo (`match.maxSubs = 5`), sem limite de paradas; banco de 7 (`match.benchSize = 7`).
- Quem sai não volta. O reserva entra com a sua condição.
- Substituição pedida pelo técnico vale no minuto seguinte ("Quando um comando vale"). A IA do adversário segue as regras de `ia-clubes.md`.
- O lesionado é sempre substituído enquanto houver troca e reserva ("Quando um comando vale", último item).

## Capitão e cobradores

- O técnico escolhe capitão, cobrador de pênalti e cobrador de falta como listas ordenadas de titulares (a tela de Tática): cobra o primeiro da lista que está em campo. Sem lista, ou com a lista toda fora de campo, cobra quem está em campo com maior `finishing` (pênalti) ou maior `technique` (falta); a braçadeira vai para o líder em campo, senão o mais velho.
- **Desempates:** entre vários líderes em campo, o de maior overall (como em `ia-clubes.md`, "Escalação"); entre os mais velhos, entre cobradores com o mesmo atributo e entre líderes com o mesmo overall, o primeiro na ordem das vagas.
- O capitão com traço **líder** dobra o efeito positivo da conversa do intervalo. É o único efeito mecânico do capitão na 1a; o resto é notícia.

## Conversa no intervalo

O técnico escolhe uma de três; o efeito é `halftimeBoost` (multiplica as forças do time no segundo tempo), conforme o placar no intervalo:

| Opção   | Perdendo | Empatando | Ganhando | Efeito extra                                          |
| ------- | -------- | --------- | -------- | ----------------------------------------------------- |
| Motivar | +3%      | +2%       | 0%       | —                                                     |
| Cobrar  | +4%      | 0%        | −3%      | temperamentais em campo perdem 3 de moral após o jogo |
| Acalmar | −2%      | +1%       | +2%      | amarelos ×0,75 no segundo tempo                       |

Sem escolha (modo "só resultado" ou técnico ausente), vale a escolha da IA (ver `ia-clubes.md`). Cada opção tem um placar em que é a melhor; a interface mostra o efeito em palavras ("o time voltou ligado"), nunca o número.

**"Pular" é uma escolha, não a falta dela** (US-022: "a moral não muda pela conversa"). O técnico que abre a conversa e toca "Pular" não fala: `halftimeBoost = 0`, sem amarelos ×0,75 e sem a perda de moral do "Cobrar"; o capitão líder dobra zero. No contrato, o comando `halftimeTalk` aceita `talk: 'skip'` (o `architect` registra), e o evento `halftimeTalk` sai com `talk: 'skip'` (a narração tem um texto para "vestiário em silêncio"). O sorteio do Caótico continua acontecendo, como com qualquer escolha do técnico. A falta de escolha continua sendo a escolha da IA: o técnico ausente tem um auxiliar que fala; o que tocou "Pular" decidiu não falar.

- Por quê "Pular" vale 0 e não a escolha da IA: é o que a história promete, e o técnico sabe o que escolheu. "Motivar" nunca é negativo, então quem quer o seguro escolhe "Motivar"; "Pular" é para quem quer ir rápido e aceita não ganhar nada.

**"Cobrar" e a moral (T-013).** Os −3 de moral do "Cobrar" são aplicados com a moral da rodada (`jogadores.md`, "Moral por rodada"), na `playRound`, não na partida. Perdem os temperamentais que estavam em campo no apito do intervalo (os que ouviram a conversa), mesmo que tenham saído depois; quem entrou no 2º tempo não perde. A partida já dá o que é preciso: o evento `halftimeTalk` com a opção e quem estava em campo naquele momento (eventos de substituição e expulsão até o intervalo).

## Acréscimos

Primeiro tempo: `Rng.int(0, 3)` minutos; segundo tempo: `Rng.int(2, 6)`, sorteados no fim de cada tempo e anunciados como evento. Os minutos de acréscimo são simulados como os outros.

## Estatísticas e notas

- **Finalizações:** oportunidades criadas. **No alvo:** gols + defesas do goleiro.
- **Posse de bola** (só exibição): `clamp(50 + 1.5 × (MidSemMando(t) − MidSemMando(o)) + Rng.int(−3, 3), 30, 70)` para o mandante, calculada no fim de cada tempo (depois dos acréscimos) com o `Mid` daquele momento. `MidSemMando` é o `Mid` com `home(t) = 0` (energia, vagas vazias, pressão e conversa do intervalo continuam valendo). A posse do jogo é a média dos dois tempos arredondada para inteiro (`Math.round`; o meio ponto vai para o mandante), e o visitante fica com `100 − posse do mandante`.
  - Por quê sem mando: com o `Mid` cheio, dois times iguais davam 60,9% de posse ao mandante (2.000 duelos de força 70, termômetro 60), porque o mando multiplica o meio inteiro. Posse é só exibição; uma estatística que mostra 61% × 39% num jogo entre iguais engana quem lê. Sem o mando, iguais ficam em 50%.
- **Minutos jogados:** só os regulamentares (1 a 90; o jogo inteiro vale 90). O minuto de acréscimo não conta. Quem está em campo no começo de um minuto jogou esse minuto, mesmo que saia nele: expulso ou lesionado no minuto 30 fica com 30 minutos; no 45+2, com 45. A evolução (`jogadores.md`, "Minutos") e a regra de "sem nota" usam essa conta. "Jogou", para a moral, é ter entrado em campo, mesmo só nos acréscimos (`jogadores.md`, "Moral por rodada").
- **Nota do jogador** (0 a 10, uma casa decimal): `6.0 + 1.0 × gols + 0.6 × assistências + 0.3 × defesas (goleiro) − 0.25 × gols sofridos (goleiro e defesa) − 0.5 × amarelo − 1.5 × vermelho + 0.4 (vitória) / −0.4 (derrota) + ruído`, arredondada para uma casa e cortada entre 3,0 e 10,0. Quem jogou menos de 15 minutos regulamentares fica "sem nota" e não gasta sorteio.
  - **Ruído:** uniforme em [−0,5; 0,5) (`(Rng.next() × 2 − 1) × 0.5`), um sorteio por jogador com nota, mandante primeiro, cada time na ordem de entrada em campo.
  - **Gols sofridos:** contam para quem estava em campo, no momento do gol, na vaga do gol ou numa vaga do **setor** de defesa da formação (a tabela "Formações"). Ala do 3-5-2 e do 3-4-3 está no meio e não conta; LAT do 5-3-2 está na defesa e conta. Jogador de linha no gol conta como goleiro.
- **Melhor em campo:** maior nota entre os que têm nota. Desempate, nesta ordem: mais gols; jogador do time vencedor; menor número da camisa; o do mandante (só sobra empate com camisas iguais nos dois times). Sem ninguém com nota (impossível com 7 ou mais em campo), não há melhor em campo.

## Eventos (o que a partida animada, a narração, as notícias e a rede social consomem)

Cada evento tem `minute` (com acréscimo, por exemplo 45+2), `half`, `team` e os campos abaixo. A lista é a saída do motor e é igual para a mesma semente e os mesmos comandos.

- `kickoff` sai uma vez só, no minuto 0 do primeiro tempo. O começo do segundo tempo é o evento seguinte a `halftimeTalk`; a narração e a animação usam `halftime` para os dois lados do intervalo.
- `stoppage` sai sempre no fim de cada tempo (minuto 45 ou 90, antes dos acréscimos), mesmo com 0 minuto: a narração precisa de um texto para "sem acréscimo", que acontece em 25% dos primeiros tempos.
- **Pênalti:** sai sempre `penaltyAwarded` e depois `goal` (tipo pênalti) ou `penaltyMissed`; o pênalti nunca gera `chance`. O perdido usa a mesma divisão trave/defesa/fora da jogada e conta nas estatísticas como os outros chutes: é finalização; se o goleiro defende, é no alvo e defesa do goleiro (+0,3 na nota dele).

| Evento           | Campos                                                                   | Importância (para "só lances principais") |
| ---------------- | ------------------------------------------------------------------------ | ----------------------------------------- |
| `kickoff`        | —                                                                        | 1                                         |
| `chance`         | finalizador, tipo (jogada/falta), resultado (defesa/trave/fora), `pGoal` | 2 se `pGoal ≥ 0,25` ou trave; senão 1     |
| `goal`           | autor, assistência, tipo, placar depois                                  | 3                                         |
| `penaltyAwarded` | cobrador                                                                 | 3                                         |
| `penaltyMissed`  | cobrador, resultado (defesa/fora/trave)                                  | 3                                         |
| `yellow`         | jogador, se é o terceiro da série (gera suspensão)                       | 1                                         |
| `red`            | jogador, motivo (`direct` / `secondYellow`)                              | 3                                         |
| `injury`         | jogador, gravidade                                                       | 2                                         |
| `substitution`   | sai, entra, motivo (`tactical` / `fatigue` / `injury`)                   | 1                                         |
| `tacticChange`   | formação, postura, pressão novas; comando usado                          | 1                                         |
| `stoppage`       | minutos de acréscimo                                                     | 1                                         |
| `halftime`       | placar                                                                   | 2                                         |
| `halftimeTalk`   | opção escolhida                                                          | 1                                         |
| `fulltime`       | placar, estatísticas, notas, melhor em campo, marcadores (abaixo)        | 3                                         |

**Marcadores do resultado** (calculados no `fulltime`, para o `content-writer` escolher o template):

| Marcador        | Regra                                                                                            |
| --------------- | ------------------------------------------------------------------------------------------------ |
| `goleada`       | diferença de 3 gols ou mais                                                                      |
| `virada`        | o vencedor esteve perdendo em algum momento                                                      |
| `zebra`         | o vencedor tinha força + mando (4 pontos para o mandante) pelo menos 8 pontos abaixo do perdedor |
| `golNoFim`      | o último gol que mudou o resultado do jogo saiu aos 85' ou depois (acréscimos incluídos)         |
| `hatTrick`      | um jogador com 3 gols ou mais                                                                    |
| `semSofrerGols` | por time                                                                                         |
| `classico`      | os dois clubes são rivais                                                                        |
| `estreia`       | jogador que entrou em campo com `clubAppearances = 0` (regra abaixo)                             |

- O `kind` de cada marcador é o nome da primeira coluna, sem tradução: é a chave que os templates do `content-writer` e a arquitetura (`docs/02-architecture.md`, `MatchMarker`) já usam.
- **`golNoFim`, em detalhe.** "Mudar o resultado" é mudar quem está vencendo: de empate para vitória de alguém, de vitória para empate (o empate no fim conta) ou de um vencedor para o outro. O gol que só amplia a vantagem (2×1 para 3×1) e o que só diminui (2×0 para 2×1) não mudam. Vale o **último** gol que mudou o resultado: se ele saiu aos 85' ou depois (o 45+2 do primeiro tempo é minuto 45 e não conta; o 90+3 conta), o marcador sai com o time, o autor e o minuto desse gol. Exemplo: 1×1 aos 80', o mandante faz 2×1 aos 88' e o visitante empata aos 90+2' → `golNoFim` do visitante (o empate). 0×0, o mandante faz 1×0 aos 86' e 2×0 aos 89' → `golNoFim` do gol dos 86'.
- **`estreia`, em detalhe.** O marcador conta a história de quem chegou: o jovem que sobe da base e o reforço. O elenco inicial de uma carreira já jogava pelo clube antes dela, então não estreia: na geração (`jogadores.md`, "Geração de elencos"), titulares, reservas e elenco começam com `clubAppearances = 1` (`PRE_CAREER_APPEARANCES`, constante: "já estreou antes da carreira", sem histórico inventado) e os 3 jovens com 0. Depois, `clubAppearances` soma 1 a cada partida em que o jogador entra em campo pelo clube. Na 1a, então, só os 3 jovens de cada clube estreiam, quando o técnico ou a IA os põe em campo (com a IA, raro: o banco leva os de maior overall); reforços (Etapa 3) e jovens promovidos da base (Etapa 4) chegam com 0, pela mesma regra. Na interface da 1a, `clubAppearances` não aparece como "jogos pelo clube" (o 1 é convenção, não estatística).

### Jogo encerrado (menos de 7 em campo)

**Regra em uma frase:** o time que fica com menos de 7 perde por 0×3, ou pelo placar do momento se o adversário já vencia por mais de 3 gols; o placar dado decide o resultado, e os gols reais contam os gols.

- **"Vencia por mais"** é margem maior que 3: 1×4 vira 0×3 (margem 3, não mais); 0×4 e 1×5 ficam como estão. O time que fica com menos de 7 perde sempre, mesmo que vencesse: 3×0 a favor dele vira 0×3.
- **Os dois com menos de 7 ao mesmo tempo** só acontece no apito inicial, com entrada danificada (a escalação já gerou avisos): confere primeiro o mandante, que perde por 0×3. Durante o jogo, o caso não existe: a partida acaba no primeiro jogador que deixa um time com 6.
- **O placar dado vale para:** tabela e torcida (`temporada.md`, `torcida.md`), vitória ou derrota na nota (±0,4), desempate do melhor em campo e `zebra`.
- **Os gols reais valem para:** artilharia (`temporada.md`: "gols contam normal"), gols, assistências, defesas e gols sofridos na nota, `hatTrick` e `semSofrerGols` (por time, pelos gols reais sofridos).
- **Não saem** `goleada`, `virada` nem `golNoFim`: a história do jogo é o abandono, e a notícia usa o `fulltime.abandoned`. Sem isso, um 1×0 abandonado viraria "goleada" de 3×0, e um 2×1 que virou 0×3 de mesa sairia como "virada".
- `classico` e `estreia` saem como sempre.

Mudança em relação à T-010 (o `developer` tinha lido "placar dado para todos os marcadores"): ver "Pedido ao `developer`", item 7.

## Modo "Realismo simplificado" (configuração do novo jogo)

| Sistema | Ligado (padrão recomendado)          | Simplificado                                                    |
| ------- | ------------------------------------ | --------------------------------------------------------------- |
| Fadiga  | como acima                           | dentro do jogo igual; entre jogos todos voltam a 100            |
| Lesões  | como acima                           | o lesionado sai do jogo, mas está disponível na rodada seguinte |
| Cartões | suspensão por 3 amarelos ou vermelho | cartões e expulsão no jogo, sem suspensão nem contador (1)      |

(1) No simplificado o contador de amarelos (`yellowCount`) não muda: fica em 0 a carreira toda. Por isso nenhum `yellow` sai com `triggersSuspension` verdadeiro (só o 3º amarelo acumulado o marca), a tela nunca mostra "pendurado" e a narração nunca diz "está fora do próximo jogo". Os amarelos e vermelhos continuam nas estatísticas da temporada (`seasonStats`) e no desempate da tabela. Regra em uma frase: no simplificado, cartão e lesão só valem dentro do jogo.

O modo escolhido vale para todos os clubes da carreira, não só para o do jogador, para a tabela não ficar desigual.

## Determinismo

- Cada partida tem a própria semente: ``seedFromString(`${seed}-s${season}-r${round}-${homeId}-${awayId}`)``, em que `seed` é a semente da carreira e `season` o número da temporada na carreira (o mesmo formato de `docs/02-architecture.md`, §4.1). Mudar uma partida não muda as outras, e as 10 partidas da rodada podem ser simuladas em qualquer ordem.
- Ordem fixa dos sorteios em cada minuto: mandante (chance, tipo, finalizador, resultado, assistência), visitante (idem), depois cartões e lesões de cada jogador em campo na ordem da escalação, mandante primeiro. Forma do dia: no apito inicial, mandante e depois visitante. O `developer` pode mudar a ordem, desde que seja fixa e testada.
- Os comandos entram como lista `(minuto, time, comando)`. Mesma semente + mesmos comandos = mesma partida. Isso dá o replay e a partida do servidor na 1b.

## Casos de borda (o motor nunca lança; resolve assim)

| Caso                                                | Regra                                                                                                                                  |
| --------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Escalação com jogador suspenso ou lesionado         | a interface bloqueia; se chegar ao motor, ele troca pelo melhor reserva disponível e registra aviso (escalação irregular é da Etapa 2) |
| Escalação ausente (técnico não montou)              | a rotina da IA (`suggestSheet`) monta, com o perfil lido como "Tradicional" (`ia-clubes.md`, "Clube do técnico humano")                |
| Melhor reserva para a vaga de um titular fora       | maior valor de seleção para a vaga (`ia-clubes.md`, "Escalação"); empate: maior overall, mais novo, menor ID                           |
| Goleiro titular fora e nenhum goleiro no banco      | a mesma regra do reserva: entra o reserva de maior valor de seleção para o gol (`fit` 0,40); os 10 de linha ficam nas vagas            |
| Sem goleiro e sem reserva nenhum no banco           | joga no gol o titular de linha com maior `physical`, com `fit` 0,40, e a vaga dele fica vazia                                          |
| Goleiro expulso ou lesionado sem substituição       | idem, durante o jogo                                                                                                                   |
| Menos de 11 disponíveis no elenco                   | joga com os que há (`missingPlayerPenalty` por jogador a menos)                                                                        |
| Vaga vazia (expulsão, lesão sem substituição)       | sai da média do setor; só o `missingPlayerPenalty` ("Vaga vazia")                                                                      |
| Setor sem ninguém (ex.: o único ATA do 4-2-3-1)     | média do setor = `EMPTY_SECTOR_FIT` (0,90) × média do `eff` dos jogadores de linha em campo ("Vaga vazia")                             |
| Troca de formação com menos de 11 em campo          | "Troca de formação durante o jogo": ficam vazias as últimas vagas livres da ordem da formação                                          |
| Menos de 7 em campo em qualquer momento             | partida encerrada; o adversário vence por 3×0, ou pelo placar do momento se vencia por mais de 3 ("Jogo encerrado")                    |
| Os dois times com menos de 7 no apito inicial       | confere o mandante primeiro: o mandante perde por 0×3 ("Jogo encerrado")                                                               |
| Cobrador escolhido fora de campo                    | regra de "Capitão e cobradores"                                                                                                        |
| Probabilidade fora de [0, 1] por parâmetro estranho | todas as probabilidades passam por `clamp`; o validador de parâmetros recusa valores fora da faixa ao carregar                         |
| Comando no mesmo minuto de um gol                   | vale a partir do minuto seguinte, sempre                                                                                               |
| Valor desconhecido na entrada (save danificado)     | 4-4-2, `balanced`, `medium`, perfil "Tradicional"; aviso (abaixo)                                                                      |

**Valor desconhecido na entrada:** formação vira 4-4-2, postura vira `balanced`, pressão vira `medium` e perfil desconhecido joga como "Tradicional" em tudo o que o perfil decide (a conversa do intervalo agora; tática e comandos na T-011). Cada valor trocado gera um aviso por time no apito inicial, inclusive o perfil.

## Parâmetros (`app/src/params/match.json`)

**Organização do arquivo.** Cansaço, lesões e cartões são grupos dentro de `match.json`: `fatigue.*`, `injury.*` e `cards.*` deste documento são, no arquivo e no código, `match.fatigue.*`, `match.injury.*` e `match.cards.*` (ex.: `match.fatigue.drainPerMinute`, `match.cards.derbyMult`). No texto, a forma curta vale como apelido da completa.

| Parâmetro                    | Valor inicial                               | Faixa válida | Por quê                                                    |
| ---------------------------- | ------------------------------------------- | ------------ | ---------------------------------------------------------- |
| `match.baseChance`           | 0,090                                       | 0,03–0,20    | cerca de 8,6 oportunidades por time em jogo equilibrado    |
| `match.kChance`              | 0,14                                        | 0,05–0,40    | 20 pontos de diferença → 65% de vitória (protótipo 66,9%)  |
| `match.conversion`           | 0,15                                        | 0,05–0,30    | cerca de 1,3 gol por time em jogo equilibrado              |
| `match.kFinish`              | 0,09                                        | 0,00–0,30    | finalizador e goleiro pesam, sem dominar                   |
| `match.midWeight`            | 0,5                                         | 0,3–0,7      | meio e ataque pesam igual na criação, como no `PROJETO.md` |
| `match.dayFormSd`            | 3                                           | 0–6          | dia bom e dia ruim; botão secundário da zebra              |
| `match.homeBase`             | 0,05 (ADR-0011, opção A)                    | 0–0,08       | leva o mandante a 47% de vitórias                          |
| `match.missingPlayerPenalty` | 0,07                                        | 0,03–0,12    | um a menos pesa, sem decidir o jogo sozinho                |
| `match.penaltyShare`         | 0,015                                       | 0–0,05       | cerca de 0,25 pênalti por jogo                             |
| `match.freeKickShare`        | 0,06                                        | 0–0,15       | falta perigosa de vez em quando                            |
| `match.assistShare`          | 0,70                                        | 0–1          | maioria dos gols com assistência                           |
| `match.comfortableLeadGoals` | 2                                           | 2–5          | "tirar o pé" vale a partir de 2 gols de vantagem           |
| `match.comfortableLeadPower` | 1 (neutro; proposta 0,85 na T-016, parte 2) | 0,7–1        | "tirar o pé": quem ganha com folga cria menos; 1 desliga   |
| `fatigue.drainPerMinute`     | 0,30                                        | 0,1–0,6      | 90 minutos custam cerca de 28 de energia                   |
| `fatigue.recoveryPerDay`     | 7                                           | 3–15         | 3 dias não bastam para voltar inteiro                      |
| `injury.basePerMinute`       | 0,00012                                     | 0–0,0005     | cerca de 0,3 lesão por jogo                                |
| `cards.yellowPerMinute`      | 0,0020                                      | 0–0,005      | cerca de 4 amarelos por jogo                               |
| `cards.redPerMinute`         | 0,00003                                     | 0–0,0002     | cerca de 0,07 vermelho direto por jogo                     |
| `cards.derbyMult`            | 1,2                                         | 1–1,5        | clássico é mais quente                                     |
| `cards.bookedMult`           | 0,5 (proposta 0,20 na T-016, parte 2)       | 0–1          | o pendurado leva o segundo amarelo com esta parte da taxa  |

**Constantes** (no código, documentadas aqui; viram parâmetro só se o `/balance` pedir): tabelas de formação, postura, pressão, `positionMult`, pesos de finalizador e assistência, gravidade de lesões, divisão trave/defesa/fora, conversa do intervalo, `maxSubs = 5` e `benchSize = 7` (regra do jogo no `PROJETO.md`, não botão de balanceamento), limite de suspensão (3 amarelos), `condMult`, `moraleMult` e `EMPTY_SECTOR_FIT = 0.90` ("Vaga vazia").

## Pedido ao `developer` (critérios de aceite)

1. Motor da partida com a assinatura "estado inicial + parâmetros + semente + comandos → eventos + resultado", sem `Math.random` nem `Date`.
2. Teste: mesma semente e mesmos comandos dão a mesma lista de eventos, byte a byte; semente diferente dá resultados diferentes em ao menos 95 de 100 partidas.
3. `scripts/balance.ts` com os três modos de `balance-targets.md` (liga, duelos calibrados, duelos táticos), imprimindo cada métrica com meta, tolerância e "ok/falha", e aceitando `--seasons`, `--seed` e `--duels`.
4. 200 temporadas rodam em menos de 3 minutos no CI (o `/balance` precisa ser usado a cada ajuste).
5. Vaga vazia ("Vaga vazia"): as forças de setor aceitam vagas vazias e reproduzem os dois exemplos daquela seção (65,1; 55,7 e 61,7, com tolerância de 0,05); nenhum setor dá `NaN` ou divide por zero em nenhuma formação com 7 a 11 em campo (teste que esvazia cada setor de cada formação).
6. Troca de formação ("Troca de formação durante o jogo"): reproduz o exemplo daquela seção (61,9 com tolerância de 0,05); para cada par das 6 × 6 formações e cada `N` de 7 a 11, nunca lança, deixa exatamente `11 − N` vagas vazias, mantém o goleiro no gol e é determinística; trocar para a formação atual não muda nenhuma vaga.
7. Ajustes da T-010 (cartões, pênaltis e jogo encerrado):
   - Jogo encerrado ("Jogo encerrado"): com `abandoned`, `goleada`, `virada` e `golNoFim` não saem; `semSofrerGols` lê os gols reais sofridos; tabela, ±0,4 da nota, melhor em campo e `zebra` leem o placar dado. Testes: 1×0 com o visitante abandonando (vira 3×0): sem `goleada`, `semSofrerGols` só do mandante; 2×1 com o mandante abandonando (vira 0×3): sem `virada` nem `golNoFim`, nenhum `semSofrerGols`, +0,4 na nota do visitante e −0,4 na do mandante; 0×4 com o mandante abandonando: fica 0×4, sem `goleada`, `semSofrerGols` do visitante.
   - Os casos da tabela de suspensão ("Cartões e suspensão") com um teste cada.
   - O resto das decisões da T-010 está confirmado como implementado; o texto do mando (amarelos ×1,2) foi corrigido aqui, sem mudança no código.
8. Ajustes da T-012 (comandos; as regras da IA em jogo estão em `ia-clubes.md`, "Pedido ao `developer`", item 6):
   - **"Pular" no intervalo:** `halftimeTalk` aceita `talk: 'skip'` (contrato registrado pelo `architect`). Testes: com `skip`, `halftimeBoost` é 0 em qualquer placar e com capitão líder, os amarelos do 2º tempo não levam ×0,75, o evento sai com `talk: 'skip'`, e o time Caótico consome o mesmo sorteio que com outra escolha (os eventos do 1º tempo e o resto da sequência de sorteios não mudam). Sem comando, continua a escolha da IA.
   - **Acréscimos do 2º tempo:** campo opcional `added` no `MatchCommand`, só com `minute: 90` ("Quando um comando vale"). Testes: `{ minute: 90 }` vale no 90+1 (antes era sempre `command-too-late`); `{ minute: 90, added: 2 }` com 4 de acréscimo vale no 90+3 e os eventos até o 90+2 não mudam; `added` igual ao número de acréscimos → `command-too-late`; `added` com `minute: 45`, negativo, não inteiro ou acima de 6 → `command-invalid-minute`. Um comando de `minute: 45` continua valendo no 46, haja ou não acréscimo no 1º tempo.
   - **Comando para o lado da IA:** ignorado no apito com `command-ai-side`. Teste: um `preset` para o lado `controller: 'ai'` não gera `tacticChange` nem muda a partida.
   - **Lesionado com troca disponível:** sempre substituído (como está). Teste já existente; nenhuma mudança.
   - A mudança da IA nos acréscimos muda os eventos: sobe `ENGINE_VERSION` e regrava o golden.
