# Posição secundária

> Mantido pelo `game-designer`. Pedido do CEO (2026-11-08): "Podemos ter posição secundária, hoje é bem comum no futebol, mas com menor desempenho"; proposta aprovada como ponto de partida ("ok recomendado, pode começar a posição secundária"). Design aprovado pelo CEO em 2026-11-08 ("ok recomendado"), com as recomendações: escalação automática "natural primeiro" na mesma feature; carreiras salvas sem reescrever overall e sem aviso na tela; a secundária como marca na vaga, fora da lista de avisos. Formato do save: ADR-0022. Complementa [jogadores.md](jogadores.md), "Posições" e "Jogador fora da posição", e muda a escalação automática de [ia-clubes.md](ia-clubes.md), "Escalação". O formato do save e a migração são do ADR-0022; aqui está só a regra de jogo. **Status: projetado, não implementado.** Até a implementação, o motor segue `jogadores.md` e `ia-clubes.md` como estão.

**Regra em uma frase:** cerca de 1 em 3 jogadores de linha tem uma posição secundária, sempre vizinha da natural, onde rende 95%, entre a natural (100%) e o improvisado (85% a 90%); goleiro nunca tem.

## Escopo

| Entra na 1a                                                                                                  | Fica para depois                                                                       |
| ------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| No máximo uma secundária por jogador, sorteada na criação e fixa na carreira                                 | Ganhar ou perder secundária jogando ou treinando na posição (Etapa 3, junto do treino) |
| `fit` 0,95 na secundária e o nível `secondary` na tela                                                       | Secundária como critério do olheiro e do mercado (Etapas 3 e 5)                        |
| Escalação automática "natural primeiro" (IA, sugestão, melhor XI), para a secundária não tirar ninguém do XI | Duas secundárias, "polivalente" como traço                                             |
| Carreiras salvas recebem a secundária pela mesma regra, de forma determinística                              |                                                                                        |

O `PROJETO.md` decide só que "jogador fora da posição perde rendimento" ("Regras do jogo"); a posição secundária não contradiz nada dele (é uma célula a mais do `fit`, por jogador), então não pede ADR de regra. O ADR é o do save (campo novo e migração), com o `architect`.

## A regra no jogo

### `fit` com a secundária

```
fit(player, slot) =
  1.00                                     se slot = player.position
  max(FIT[player.position][slot], 0.95)    se slot = player.secondaryPosition
  FIT[player.position][slot]               nos outros casos
```

- **Substitui a célula, só para aquele jogador**: a tabela `FIT` continua igual para todos. Como toda vizinha tem `fit` 0,85 ou 0,90, na prática a secundária vale sempre 0,95; o `max` só garante que uma mudança futura da tabela nunca faça a secundária render menos que a célula comum.
- `SECONDARY_FIT = 0.95` é **constante** (regra do jogo, como a tabela `FIT`; o CEO fixou "95%"), ao lado de `FIT` em `app/src/engine/players.ts`. Vira parâmetro só se uma rodada do `/balance` precisar dela.
- A assinatura muda de `fit(natural, slot)` para `fit(player, slot)` (com `player: Pick<Player, 'position' | 'secondaryPosition'>`). Todo lugar que hoje passa `player.position` passa o jogador: `strength.ts` (`eff`), `match/team.ts` (forças de setor, finalizador, cobrador, reposição), `selection.ts` (valor de seleção), `ai.ts` (força do XI), `generation.ts` (`bestEleven`, `elevenStrength`), o robô do `/balance` e a interface (`ui/lineup.ts`). Uma função só; ninguém repete a regra.

### Nível na tela (`fitLevel`)

| Nível           | Quando                            | `fit`       | Na tela                                             |
| --------------- | --------------------------------- | ----------- | --------------------------------------------------- |
| `natural`       | vaga = posição natural            | 1,00        | sem marca                                           |
| `secondary`     | vaga = posição secundária         | 0,95        | ícone + texto "posição secundária"; **não é aviso** |
| `improvised`    | `FIT` da tabela entre 0,85 e 0,90 | 0,85 a 0,90 | ícone + texto "improvisado" (como hoje)             |
| `outOfPosition` | `FIT` da tabela abaixo de 0,85    | 0,40 a 0,80 | ícone + texto "fora de posição" (como hoje)         |

`fitLevel(player, slot)` decide pela vaga, não pelo número: natural primeiro, depois secundária, depois a tabela. Gravidade para a "marca da vaga" (`escalacao.md`, uma marca por vaga, a mais grave vence): lesionado > suspenso > fora de posição > improvisado > secundária > nenhuma.

**Por que a secundária não é aviso:** o aviso existe para o técnico corrigir um problema; jogar alguém na secundária é uma escolha boa (perde 5%, um ponto e pouco de força do time em 11), não um descuido. A marca na vaga basta para ele saber. Ela também não entra na lista "Nesta formação" da tela de Tática.

### O que não muda

- `overall`, atributos e pesos continuam os da posição natural; a secundária não tem nota própria (a tela pode mostrar `round(overall × 0,95)` como "rende ~N", a critério do `ux-designer`).
- "Atributo ausente" (`jogadores.md`) não muda: goleiro nunca tem secundária, e jogador de linha tem os 6 atributos de linha.
- "Esperava jogar" (moral do banco) usa só o `overall`, sem `fit`: não muda.
- Banco da IA (passo 5 de `ia-clubes.md`), "por linha pela posição natural": não muda.
- Regra 3 da IA durante o jogo ("um ATA ou MEI (posição natural) no banco"): não muda. Um VOL com secundária MEI não conta como atacante para a troca ofensiva; a regra fica com uma condição só.
- Camisa, joia, traço, evolução e aposentadoria: não leem a secundária. O ídolo novo da virada sai do melhor XI, que já a conta pelo `fit`; a regra dele não muda.

## Escalação automática: natural primeiro

**Regra em uma frase:** cada vaga recebe primeiro o melhor da posição; depois, vaga a vaga, quem ficou de fora toma a vaga se render mais nela.

### Por que mudar o preenchimento guloso

O passo 3 de `ia-clubes.md` enche as vagas na ordem GOL, ZAG, LAT, VOL, MEI, ATA com o de maior valor de seleção de **qualquer** posição. Com isso um volante de 78 vai para a zaga (78 × 0,90 = 70,2 > zagueiro de 68), e a vaga de volante fica com um reserva de 66: o time perde 10 pontos de soma para ganhar 2. Isso já acontece hoje com o 0,90 e a secundária o dobra, porque 0,95 "rouba" titulares de vaga mais vezes. Medido (scratch, 4.000 elencos do gerador atual, 200 sementes × 20 clubes, escada da 1a, formações variadas, secundária pela regra deste documento com chance 0,33; força = média de `overall × fit` do XI, condição 100):

| Cenário                                       | Guloso, sem secundária | Guloso, com secundária           | Natural primeiro, sem | Natural primeiro, com     |
| --------------------------------------------- | ---------------------- | -------------------------------- | --------------------- | ------------------------- |
| Elenco completo: força do XI                  | 70,20                  | 70,07                            | 70,47                 | 70,47                     |
| Elenco completo: titulares fora da natural    | 0,39 por XI            | 0,80 por XI (0,47 na secundária) | 0,00                  | 0,03 (0,02 na secundária) |
| 3 titulares fora (lesão, suspensão): força    | 68,35                  | 68,33                            | 68,97                 | 69,00                     |
| 3 titulares fora: na secundária / improvisado | — / 1,18               | 0,71 / 0,90                      | — / 0,20              | 0,14 / 0,15               |

Com o guloso, dar a secundária **enfraquece** o time (−0,13 completo) e a "Sugestão de escalação" mostraria o absurdo: o volante na zaga com o selo "posição secundária" e um volante pior no lugar dele. Com "natural primeiro", a secundária nunca tira um titular da posição dele, entra quando falta alguém (14% dos XIs desfalcados) e cobre cerca de 30% dos improvisos (0,20 → 0,15 por XI). Em 1 de 4.000 elencos a versão com secundária saiu um centésimo abaixo da sem (efeito de cadeia da troca); aceito.

### O algoritmo (substitui o passo 3 de `ia-clubes.md`)

Entrada: os disponíveis (passo 1) e o valor de seleção (passo 2, agora com o `fit` deste documento).

1. **Passe da posição:** vaga a vaga, na ordem da formação (GOL, ZAG, LAT, VOL, MEI, ATA), a vaga recebe, entre os disponíveis ainda não escolhidos **cuja posição natural é a da vaga**, o de maior valor de seleção. Empate: maior overall, depois mais novo, depois menor ID (o de hoje). Sem ninguém da posição, a vaga fica vazia neste passe.
2. **Passe da troca:** vaga a vaga, na mesma ordem, **só as 10 de linha**: o disponível não escolhido (de qualquer posição) de maior valor de seleção para a vaga a toma se o valor dele for **estritamente maior** que o do ocupante, ou se a vaga estiver vazia. O ocupante que sai volta para os não escolhidos e pode tomar uma vaga seguinte neste mesmo passe. Empate entre candidatos: o de hoje.
3. **Gol:** se a vaga do gol ficou vazia no passe 1 (nenhum goleiro disponível), ela é a última a ser preenchida, depois do passe 2, com o de maior valor de seleção para o gol entre os que sobraram (`fit` 0,40 para todos), como hoje. Um goleiro escolhido no passe 1 nunca é trocado no passe 2 (um goleiro cansado de 40 renderia menos que um atacante de 80 × 0,40, e mandar o atacante para o gol é o erro que o passo 3 de hoje já evita).
4. **Menos de 11 disponíveis:** vale o preenchimento guloso de hoje, sem mudança (o gol nunca é a vaga vazia, as vazias são as últimas). Situação rara, e ali a ordem das vagas vazias importa mais que 5%.
5. **Rotação (passo 4) e banco (passo 5):** sem mudança. A rotação já troca vaga a vaga só por reserva descansado; com o `fit` novo ela pode pôr um reserva na secundária, e está certo.

Converge sempre: cada vaga de linha é visitada uma vez no passe 2.

### Onde vale

| Lugar                                                                                      | Regra                                                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pickEleven` (`ai.ts`): escalação da IA e "Sugerir escalação" do técnico                   | natural primeiro (os passos acima)                                                                                                                                                                         |
| `bestEleven` (`generation.ts`): deslocamento do elenco, força na virada, ídolo novo        | natural primeiro, com todos aptos e condição 100 (como hoje)                                                                                                                                               |
| Robô do `/balance` (`scripts/balance/robot.ts`, `elevenByEff`)                             | natural primeiro, pelo `eff`: senão a meta "técnico-robô bom vence a IA" passaria a medir a qualidade do algoritmo de escalação, e não as decisões do técnico                                              |
| `completeSheet` (`draft.ts`): vagas livres do técnico                                      | **sem mudança**: cada vaga livre, na ordem, pelo `bestForSlot` (banco primeiro, depois fora da ficha), agora com o `fit` novo. São 1 ou 2 vagas, e o técnico vê o resultado em "Completar automaticamente" |
| `bestForSlot` de uma vaga só (troca do indisponível no apito, substituição durante o jogo) | sem mudança, com o `fit` novo: é uma vaga, não há a quem roubar                                                                                                                                            |

## Força do time

Nada de fórmula nova: a força exibida, o `eff` da partida e a força do XI usam `overall × fit`, e o `fit` já traz a secundária. Um jogador de 72 na secundária conta 68,4 (improvisado a 0,90 contaria 64,8): o técnico ganha cerca de 0,3 ponto de força do time por vaga coberta assim.

## Geração

### Quem recebe e qual posição

| Natural | Chance de ter | Vizinhas (`FIT` ≥ 0,85), uma sorteada com chances iguais | Resultado com `secondaryChance` 0,33 |
| ------- | ------------- | -------------------------------------------------------- | ------------------------------------ |
| GOL     | 0             | nenhuma                                                  | nunca                                |
| ZAG     | 0,33          | LAT, VOL                                                 | LAT 16,5%, VOL 16,5%                 |
| LAT     | 0,33          | ZAG, VOL, MEI                                            | ZAG 11%, VOL 11%, MEI 11%            |
| VOL     | 0,33          | ZAG, LAT, MEI                                            | ZAG 11%, LAT 11%, MEI 11%            |
| MEI     | 0,33          | VOL, ATA                                                 | VOL 16,5%, ATA 16,5%                 |
| ATA     | 0,33          | MEI                                                      | MEI 33%                              |

- **Vizinhas** = as vagas de linha com `FIT[natural][vaga] ≥ IMPROVISED_MIN_FIT` (0,85), fora a natural, na ordem de `POSITIONS` (`GK, CB, FB, DM, AM, ST`). Calculadas da tabela, nunca listadas à mão; se a tabela mudar, as vizinhas mudam junto. O goleiro não tem vizinha (todo `fit` dele é 0,40), e nenhuma linha tem o gol como vizinha.
- **Uma chance para todas as posições, e a vizinha com chances iguais.** Pesar por posição ("lateral é mais versátil") seria uma tabela a mais que ninguém sente no resultado; a lista de vizinhas já faz o atacante ter só a meia e o lateral ter três opções.
- **Medido:** 33,0% dos jogadores de linha, 7,3 por elenco de 25 (29% do elenco todo, com os 3 goleiros), o "cerca de 1 em 3" do pedido.

### Sorteio e determinismo

Cada jogador tem **um fluxo próprio** para a secundária, e ela não gasta o `Rng` do elenco:

```
rng = new Rng(seedFromString(`${seed}-secondary-${playerId}`))   // seed = GameState.seed
se position = GK: sem secundária (nenhum sorteio)
u = rng.next()
se u ≥ players.secondaryChance: sem secundária
senão: secondaryPosition = vizinhas[rng.int(0, vizinhas.length − 1)]
```

Função única no motor (sugestão: `drawSecondaryPosition(seed, playerId, position, chance)`), pura, usada em três lugares: `generateSquad`, `generateAcademy` e a migração do save.

- **Por que um fluxo por jogador:** (1) a sequência do `Rng` do elenco (posições, idade, overall, atributos, traço, curva, nacionalidade, moral, potencial) não muda, então nomes, idades e atributos sorteados de cada carreira continuam os mesmos; (2) a migração de um save dá exatamente a secundária que um jogo novo com a mesma semente daria ao mesmo jogador; (3) mudar a chance é monotônico: quem tinha secundária com 0,33 continua tendo a mesma com 0,40 (o `u` é o mesmo), o que deixa o `/balance` comparar valores sem trocar os jogadores. É o mesmo desenho da evolução (`jogadores.md`, uma semente por jogador).
- **Onde entra:** em `generateSquad`, na criação de cada rascunho (a id já é conhecida, `idOf(index)`), **antes** de `shiftSquad`, para o deslocamento do elenco e o `bestEleven` já contarem com ela. Em `generateAcademy`, na criação de cada jovem, com a id `turnPlayerId(...)`. A id é única na carreira (`${clubId}#N`, com as da virada a partir de `#100 × temporada`), então os fluxos nunca se repetem.
- **Goldens e versão:** muda todo golden que contém jogador ou escalação: o campo novo em cada jogador; o `bestEleven` "natural primeiro" muda o `d` do deslocamento em parte dos clubes (logo overall e atributos); a escalação da IA muda nas rodadas com desfalque (logo placares, tabelas, `digest`). Sobe `ENGINE_VERSION` (hoje 16) e roda `npm run golden:update -w app`. É mudança de `/feature` (motor e save), nunca `/quick`.

## Carreiras já salvas (regra de jogo da migração)

O mecanismo (versão do save, passo de migração, teste com as fixtures) é do ADR do `architect`. A regra de jogo:

- **Quem recebe:** todo jogador do save, de todos os clubes, pela mesma `drawSecondaryPosition(GameState.seed, player.id, player.position, players.secondaryChance)` da geração. Mesma carreira, mesmo resultado, sempre; não depende da ordem em que os jogadores são migrados.
- **Nada mais muda no save:** overall, atributos e potencial ficam como estão. Não há novo deslocamento do elenco (mexer no overall de um jogador que o técnico já conhece é pior que uma força 0,3 diferente).
- **Efeito visível ao abrir a carreira:** os elencos de antes foram deslocados para que o XI **guloso** batesse a escada; o XI "natural primeiro" deles mede mais. Medido nos 4.000 elencos: mediana 0, média +0,3, 10% dos clubes com +1 ou mais, 1% com +2 ou mais, máximo 3,3. O número de força desses clubes na tela sobe nessa medida, e eles jogam assim (a IA deles e a sugestão do técnico usam o algoritmo novo). Aceito, sem aviso na tela: na 1a as carreiras salvas são de teste, e reescrever o overall de jogadores que o técnico já conhece seria pior. Aprovado pelo CEO em 2026-11-08.
- Se o `architect` precisar da semente da carreira na migração e ela não estiver disponível no passo, a alternativa é `${player.id}` sozinho; registre no ADR, porque aí carreiras diferentes dariam a secundária aos mesmos números de jogador.

## Evolução

**Recomendação: fixa na carreira na Etapa 1a.** A evolução (`jogadores.md`) e a renovação não mudam a secundária, como não mudam a posição natural. Por quê: na 1a não há treino (Etapa 3); uma secundária que aparece ou some na virada sem o técnico ter feito nada seria ruído, e uma regra de "aprender jogando" pede contar minutos por vaga, um estado a mais no save. Para a Etapa 3, a ideia a medir junto do treino: quem joga N jogos numa vizinha ganha a secundária nela (no máximo uma, troca a antiga). A secundária entra na lista "o que não muda" da evolução.

## Parâmetros e limites

| Parâmetro                 | Arquivo                       | Valor inicial | Faixa do validador | Por quê                                                                                                                        |
| ------------------------- | ----------------------------- | ------------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| `players.secondaryChance` | `app/src/params/players.json` | 0,33          | 0 a 0,5            | o "cerca de 1 em 3" do CEO; 0 desliga o sistema (comparação no `/balance`); acima de 0,5 a secundária deixa de ser diferencial |

- **Ainda não está no `players.json`:** o validador de parâmetros recusa chave desconhecida (`unknown-key` em `app/src/engine/params.ts`), então a chave entra no mesmo PR que o tipo `PlayersParams`, a faixa `num(0, 0.5)` e o `testParams` (pedido abaixo).
- **Constantes** (no código, documentadas aqui): `SECONDARY_FIT = 0.95`; as vizinhas (`FIT ≥ 0,85`, calculadas); goleiro nunca tem; no máximo uma por jogador.

**Limite do campo no save** (para o `architect` e o validador, `jogadores.md`, "Limites dos campos"):

| Campo               | Valor                    | Regra do validador                                                                                                                             |
| ------------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `secondaryPosition` | uma `Position`, ou "sem" | se presente: posição válida, diferente de `position`, diferente de `GK`, e `position` diferente de `GK`. **Não** exige ser vizinha pela tabela |

Por que não exigir a vizinha: se a tabela `FIT` mudar, um save legítimo de antes não pode virar inválido (o mesmo critério da faixa larga do `growth`). Ser vizinha é regra da geração, conferida nos testes do gerador. Como representar "sem" (campo ausente ou `null`) é decisão do ADR.

## Efeito esperado no balanceamento

Estimativa antes do `/balance` (o de verdade roda depois da implementação, com as três sementes):

| Métrica                         | Meta (tolerância) | Efeito esperado     | Por quê                                                                                                                                                                                                                  |
| ------------------------------- | ----------------- | ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Gols por partida                | 2,65 (2,50–2,80)  | menos de ±0,01      | o deslocamento do elenco traz o melhor XI de volta à força da escada; a secundária só age com desfalque e nos dois lados igual                                                                                           |
| Vitória do 20 pontos mais forte | 63% (62–68%)      | menos de ±0,3 p.p.  | os duelos calibrados usam elencos com força exata; o desfalcado ganha cerca de +0,35 de força em relação a hoje, nos dois times                                                                                          |
| Zebra de 30 pontos              | 10% (8–12%)       | menos de ±0,3 p.p.  | idem                                                                                                                                                                                                                     |
| Campeão / 17º                   | 77 / 42           | menos de ±0,3 ponto | o elenco profundo (o forte) aproveita um pouco mais a secundária quando desfalcado; efeito pequeno, a medir                                                                                                              |
| Técnico-robô bom vence a IA     | +2 a +8           | sem mudança         | só se o robô usar o mesmo "natural primeiro" (pedido abaixo); com o robô no guloso e a IA no novo, o ganho dele cairia cerca de 0,3 de força nos jogos desfalcados                                                       |
| Overall médio gerado            | —                 | −0,3 ponto          | o "natural primeiro" mede o XI 0,27 acima do guloso, e o deslocamento compensa baixando o overall; a força em campo não muda. A inflação da liga (decisão 11) é medida pela mesma função nas duas pontas, então não muda |

**Métricas novas, só informativas no relatório do `/balance`** (sem meta; servem para ver se a secundária existe no jogo): (1) titulares na secundária por ficha da IA; (2) titulares improvisados ou fora de posição por ficha. Esperado, pela medição estática: menos de 0,1 na secundária por ficha (14% das fichas desfalcadas) e os improvisados abaixo de hoje (o guloso de hoje põe 0,39 por XI completo).

**Leitura de diversão:** o efeito no placar é pequeno de propósito (o CEO pediu "menor desempenho", não um sistema de força); onde o técnico sente é na escolha: com o zagueiro suspenso, o volante que "também joga de zagueiro" rende 95% e não 90%, e o Elenco mostra quem tem duas utilidades. A zebra não muda.

## Casos de borda

| Caso                                                                       | Regra                                                                                                                                       |
| -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Goleiro                                                                    | nunca tem secundária; nenhum jogador de linha tem o gol como secundária; a migração e o validador garantem os dois                          |
| Jogador na secundária e na natural ao mesmo tempo                          | impossível: a secundária é diferente da natural                                                                                             |
| Secundária que deixou de ser vizinha (a tabela `FIT` mudou depois do save) | continua valendo 0,95 (`max`); o save segue válido                                                                                          |
| Natural e secundário com o mesmo valor de seleção para a vaga              | o passe 1 já pôs o natural; no passe 2 só troca com valor estritamente maior                                                                |
| Natural cansado (condição baixa) contra secundário descansado              | o passe 2 troca se o valor de seleção do secundário for maior: é o mesmo critério de condição de hoje                                       |
| Nenhum natural disponível para a vaga                                      | o passe 2 preenche com o melhor de qualquer posição; a secundária a 0,95 vence o improvisado de mesmo overall                               |
| Sem goleiro disponível                                                     | o gol é preenchido por último, depois do passe 2, como hoje                                                                                 |
| Menos de 11 disponíveis                                                    | preenchimento guloso de hoje, sem mudança                                                                                                   |
| Duas vagas livres vizinhas no `completeSheet` (ex.: ZAG e VOL)             | pode pôr o VOL de secundária ZAG na zaga e um pior no meio (é o guloso, vaga a vaga); aceito: são vagas raras e o técnico vê antes de jogar |
| Jovem da base promovido na virada                                          | sorteia a secundária pela mesma função, com a id dele                                                                                       |
| Elenco gerado na temporada 2 ou depois (`generateSquad` com `season`)      | mesma função; as ids da virada não repetem as da temporada 1                                                                                |
| `players.secondaryChance = 0`                                              | ninguém tem secundária; o jogo é o de hoje com a escalação "natural primeiro"                                                               |
| Save antigo com estrangeiros, lesionados ou suspensos                      | recebem a secundária como todos; ela não lê nacionalidade nem estado                                                                        |
| Liga online (1b)                                                           | o motor é o mesmo no servidor; a secundária vem da semente da liga, igual para todos os participantes                                       |

## O que a tela mostra (para o `ux-designer` especificar)

- **Elenco:** na linha do jogador, a secundária ao lado da posição natural (ex.: "VOL" e, menor, "ZAG"), com nome completo para leitor de tela ("Volante, também joga de zagueiro"). A ordem "Posição" agrupa pela natural, como hoje; a secundária não entra no agrupamento.
- **Card do jogador:** "Posição" e "Posição secundária" (ou nada, quando não tem), com o rendimento (95%) num texto de ajuda.
- **Escalação:** a marca da vaga ganha o nível `secondary` (ícone + texto; selo novo no `StatusBadge`, com par de cores nos tokens), menos grave que improvisado; **sem** linha na lista de avisos. Na escolha de quem entra numa vaga, o candidato na secundária aparece com a mesma marca.
- **Tática:** a lista "Nesta formação" continua só com improvisados e fora de posição; a secundária não aparece nela.
- Pré-jogo e força do time: sem mudança de tela (o número já conta o `fit`).

## Chaves de texto (para o `content-writer`; nenhum texto final aqui)

pt-BR, es e en, em `app/src/content/<idioma>/ui.json`:

- `lineup.fit.secondary`: rótulo da marca da vaga (par de `lineup.fit.improvised`; também usado em minúsculas no nome acessível da vaga).
- `player.secondaryPosition`: rótulo do campo no card do jogador.
- `player.secondaryPosition.hint`: ajuda curta do card (o que é e que rende um pouco menos que na natural).
- `squad.secondaryPosition.a11y`: nome acessível da posição na linha do Elenco, com `{natural}` e `{secondary}`.
- `squad.secondaryPosition.short`: forma curta, se o `ux-designer` quiser texto e não só a segunda caixinha (com `{secondary}`).

As caixinhas usam os códigos de posição que já existem (`position.<P>.short`) e as posições por extenso (`position.<P>`, se existir; senão uma chave nova por posição, a confirmar com o `ux-designer`).

**Revisto pelo `ux-designer` na T-080:** ficam 4 chaves. `squad.secondaryPosition.short` sai, porque o Elenco mostra só a segunda caixinha. `position.<P>` já existe, e nenhuma chave nova por posição é necessária. O contexto de cada chave está em [escalacao.md](telas/escalacao.md#posição-secundária), [elenco.md](telas/elenco.md#posição-secundária) e [jogador.md](telas/jogador.md#posição-secundária).

## Pedido ao `developer` (`/feature`; mexe em `app/src/engine/` e no save)

Depende do ADR do save do `architect` (campo `secondaryPosition`, versão nova e migração).

1. **Motor:** `SECONDARY_FIT`, `fit(player, slot)` e `fitLevel(player, slot)` com o nível `secondary` (`players.ts`), e todos os chamadores da lista acima; `drawSecondaryPosition` em `generateSquad` (antes de `shiftSquad`) e em `generateAcademy`; "natural primeiro" em `pickEleven` e `bestEleven`; `players.secondaryChance` em `players.json`, `PlayersParams`, faixa `num(0, 0.5)` e `testParams`. `ENGINE_VERSION` nova e goldens atualizados.
2. **Robô do `/balance`:** `elevenByEff` com os mesmos dois passes, pelo `eff`.
3. **Relatório do `/balance`:** as duas métricas informativas acima.

**Critérios de aceite:**

1. Em 200 carreiras (as sementes do teste do gerador), a parcela de jogadores de linha com secundária fica entre 31% e 35%; nenhum goleiro tem; toda secundária é vizinha pela tabela; nenhum jogador tem a secundária igual à natural.
2. Determinismo: a mesma semente e a mesma id dão a mesma secundária em `generateSquad`, `generateAcademy` e na migração; trocar a ordem dos jogadores na migração não muda nada; subir `secondaryChance` de 0,33 para 0,40 não tira nem troca a secundária de ninguém.
3. A sequência do `Rng` do elenco não muda: com `secondaryChance = 0`, idade, atributos sorteados, traço, curva, moral, nacionalidade, nome e rosto de cada jogador são iguais aos da `main` (o overall final pode mudar só pelo `d` do deslocamento, por causa do "natural primeiro").
4. `fit(player, secondaryPosition) = 0.95` e `fitLevel = 'secondary'`; nas outras vagas, `fit` e `fitLevel` iguais aos de hoje.
5. "Natural primeiro": num elenco em que o melhor VOL (78) tem secundária ZAG, os ZAG naturais têm 68 e o VOL seguinte 66, a IA escala o VOL de 78 no meio e os ZAG de 68 na zaga; em 4.000 elencos completos, titulares fora da natural ficam abaixo de 0,05 por XI (hoje 0,39); com 3 titulares fora, a força média do XI fica ≥ à do guloso.
6. `npm run balance -- --seasons 200` com `--seed 1`, `2` e `3`: todas as metas da 1a dentro da tolerância; e, com a mesma semente, gols por partida a ±0,02 e o 20 pontos mais forte a ±1 p.p. entre `secondaryChance` 0 e 0,33.
7. Um save da versão anterior carrega, migra e valida; abrir duas vezes o mesmo save dá as mesmas secundárias.
