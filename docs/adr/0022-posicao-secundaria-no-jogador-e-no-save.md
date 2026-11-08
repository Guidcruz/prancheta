# ADR-0022: Posição secundária no jogador e no save (formato v3)

- **Status:** aceito (CEO, 2026-11-08: "ok recomendado", para este ADR, para o design e para as decisões recomendadas; ver "Decisões do CEO"). Antes, no mesmo dia, o CEO tinha aprovado a ideia ("ok recomendado, pode começar a posição secundária"). A forma técnica é do `architect`; a regra de jogo é do `game-designer`.
- **Data:** 2026-11-08
- **Decisores:** CEO (pediu e aprovou), game-designer (regra e números: `docs/design/posicao-secundaria.md`, branch `docs/design-posicao-secundaria`, commit 6c2b081), architect (propôs e redigiu)
- **Complementa:** ADR-0006 (formato do save: versão 3 e migração), ADR-0007 (contrato do motor e regra 7: `ENGINE_VERSION` e goldens; regra 2: sementes por fluxo), ADR-0012 (o que o `Player` guarda no estado) e ADR-0021 (formato v2, que este ADR sucede, e as leituras da escalação, que mudam de assinatura ou de comportamento).

## Contexto

Hoje o rendimento de um jogador numa vaga vem só da tabela `FIT[natural][vaga]` de `app/src/engine/players.ts`, igual para todos: todo zagueiro rende 0,90 na lateral, todo meia rende 0,90 no ataque. O `fitLevel(natural, vaga)` dá à tela três níveis: `natural`, `improvised` e `outOfPosition`. O CEO quer que um jogador possa ter uma posição secundária própria, que rende menos que a natural e mais que o improviso. A regra está em `docs/design/posicao-secundaria.md`, que é a fonte de todos os números citados aqui:

- na secundária o jogador rende `max(FIT[natural][secundária], SECONDARY_FIT)`, com `SECONDARY_FIT = 0.95` constante ("`fit` com a secundária");
- cada jogador de linha tem a chance `players.secondaryChance` (parâmetro, 0,33, faixa 0 a 0,5) de ter uma, no máximo uma, sorteada com chances iguais entre as vizinhas. As vizinhas são as posições de linha com `FIT[natural][vaga] ≥ IMPROVISED_MIN_FIT`, fora a natural, na ordem de `POSITIONS`, sempre calculadas da tabela. Goleiro nunca tem ("Geração");
- a escalação automática passa a ser "natural primeiro", em dois passes. Sem isso, a secundária a 0,95 tiraria titulares da própria posição, e o time ficaria mais fraco (−0,13 de força num elenco completo, pela medição do design, "Escalação automática: natural primeiro");
- carreiras já salvas recebem a secundária pela mesma regra, de forma determinística, sem refazer a força dos elencos ("Carreiras já salvas").

Este ADR decide onde o dado mora, como entra no save, como a migração o sorteia e como o motor o lê. Cinco fatos pesam no desenho:

1. **O `Player` está no `GameState`, e o `GameState` está no save.** Um campo novo no jogador muda a forma do save. O teste de forma (`shape-vN.json`) quebra até o `schemaVersion` subir, com migração e fixture nova (ADR-0006).
2. **O `fit` é lido em pelo menos dez lugares do motor:** `selectionValue` (IA, substituto do inapto e `completeSheet`), `effectiveRating` e `sheetStrength` (força exibida), o `Δ` da IA, `bestEleven` e `elevenStrength` (geração, deslocamento do elenco e força da virada) e a partida (`occupy`, `slotEff`, chute e cobranças em `match/team.ts`), além do robô do `/balance`. Todos recebem hoje só a posição natural.
3. **O `GameState` não guarda estado de `Rng`.** Cada fluxo deriva a própria semente de `GameState.seed` com um rótulo (ADR-0007, regra 2). Não há "o `Rng` do estado" para a migração consumir por engano, mas também não há um fluxo pronto para ela.
4. **Os ids dos jogadores são únicos na carreira e estáveis.** `${clubId}#1` a `#25` no novo jogo, `turnPlayerId(clubId, temporada, k)` na base. As posições do novo jogo saem do primeiro sorteio do fluxo do elenco (`squadPositions`), antes de qualquer outro.
5. **O validador do jogador é o do motor.** O esquema do save chama `validatePlayer` em cada jogador, nos níveis `full` e `open`. Os limites guardados seguem a faixa mais larga da regra, não o valor de hoje, para que um ajuste não invalide saves (o `growth` confere 0,5 a 1,5, e não os parâmetros atuais).

## Opções consideradas

**O campo no `Player`:**

| Opção                                                 | Prós                                                                                                                                                                                                                                                                    | Contras                                                                                                                                                                                                                 |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: opcional, `secondaryPosition?: Position`           | só cerca de um terço dos jogadores de linha carrega a chave: cerca de 4 KB por snapshot, contra cerca de 12 KB da B                                                                                                                                                     | um jogador sem a chave pode ser "não tem" ou "esqueceram de pôr": a migração e a geração não ficam conferidas pelo tipo nem pelo validador, que hoje exige todas as chaves; toda fábrica de jogador compila sem decidir |
| B: obrigatório, `secondaryPosition: Position \| null` | segue o validador de hoje (toda chave presente); um jogador de v2 que passou pela cadeia sem a migração é recusado com `missing`; o TypeScript obriga cada lugar que cria jogador (geração, base, fábricas de teste) a decidir; `null` diz "não tem" de forma explícita | cerca de 25 bytes por jogador em todos os jogadores: cerca de 12 KB num snapshot de até 680 KB (menos de 2%)                                                                                                            |
| C: lista, `secondaryPositions: Position[]`            | pronta para mais de uma secundária                                                                                                                                                                                                                                      | a regra aprovada é "no máximo uma"; o tipo aceitaria o que o jogo não gera, e o limite de um item seria só do validador                                                                                                 |
| D: fora do `Player`, uma tabela por id no `GameState` | o `Player` não muda                                                                                                                                                                                                                                                     | o dado é do jogador; toda leitura de `fit` passaria a receber o estado, e um jogador sem linha na tabela seria um caso a mais                                                                                           |

**Como a migração sorteia a secundária das carreiras já salvas:**

| Opção                                                                                                                     | Prós                                                                                                                                                                                                                                                                                                  | Contras                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A: um `Rng` só para a migração, que percorre os jogadores em ordem                                                        | simples                                                                                                                                                                                                                                                                                               | o resultado de um jogador depende da ordem e de quantos vieram antes; uma ordem de chaves diferente no JSON (arquivo editado, outra serialização) muda tudo                                |
| B: um fluxo por jogador, ``seedFromString(`${seed}-secondary-${id}`)``, numa função pura do motor usada também na geração | o resultado depende só da semente da carreira, do id, da posição natural e da chance; não depende da ordem, não consome nenhum outro fluxo e é idempotente por construção; a carreira migrada recebe as mesmas secundárias que um jogo novo da mesma semente daria aos mesmos jogadores; uma regra só | a migração passa a depender de uma função do motor, que não pode mudar de saída enquanto a migração existir (ver "Conformidade")                                                           |
| C: a mesma ideia da B, com uma cópia congelada da regra dentro da migração                                                | a migração não depende do motor                                                                                                                                                                                                                                                                       | duas implementações da mesma regra (a da geração e a da migração), que podem divergir em silêncio; a carreira migrada deixa de bater com o jogo novo assim que alguém ajustar só uma delas |

A semente sem a carreira, só `${player.id}` (alternativa citada no design, "Carreiras já salvas"), não foi preciso: a migração lê `save.game.seed`, então carreiras diferentes dão secundárias diferentes aos mesmos números de jogador.

**Como o motor lê a secundária:**

| Opção                                                                                 | Prós                                                                                                                                                                                                       | Contras                                                                                                                            |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A: terceiro argumento opcional, `fit(natural, slot, secondary?)`                      | as chamadas de hoje continuam compilando                                                                                                                                                                   | justamente por isso: uma chamada esquecida compila e ignora a secundária em silêncio, e a partida e a força exibida podem divergir |
| B: `fit(player, slot)`, com `player: Pick<Player, 'position' \| 'secondaryPosition'>` | toda chamada de hoje deixa de compilar e precisa ser revista; a partida, a força exibida, a IA e a tela leem o mesmo número pelo mesmo caminho; quem não tem secundária recebe a tabela de hoje, bit a bit | muda a assinatura de `fit` e de `fitLevel` (contrato), e a tela precisa passar o jogador                                           |

**Onde mora o "natural primeiro":**

| Opção                                                                                        | Prós                                                                                                                 | Contras                                                                                                                       |
| -------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| A: os dois passes escritos em cada lugar (`pickEleven`, `bestEleven`, `elevenByEff` do robô) | cada lugar fica como está hoje, com o próprio laço                                                                   | três cópias do mesmo algoritmo, com o gol, o desempate e o caso de menos de 11; o robô deixaria de medir o mesmo que a IA faz |
| B: uma função só no motor, que recebe o valor de cada jogador na vaga, usada pelos três      | uma regra, um teste; o robô do `/balance` escala pelo `eff` com o mesmo algoritmo que a IA usa pelo valor de seleção | um símbolo novo na API de ferramentas, para o robô                                                                            |

## Decisão

**Campo: B. Migração: B. Leitura no motor: B. "Natural primeiro": B.**

### 1. O campo no jogador

```ts
// app/src/engine/players.ts
export interface Player {
  // ...os campos de hoje...
  /** Natural position. */
  readonly position: Position;
  /**
   * Secondary position (ADR-0022; docs/design/posicao-secundaria.md): `null` when the player has
   * none. Never 'GK', never equal to `position`, always `null` for a goalkeeper. Drawn once, when
   * the player is created (or by the save migration 0002), by {@link secondaryPositionFor};
   * never changes.
   */
  readonly secondaryPosition: Position | null;
}
```

- **Obrigatório e anulável.** Toda chave do jogador continua obrigatória no validador. `null` quer dizer "não tem" (o design deixa essa escolha para o ADR, "Limite do campo no save").
- **Fixo na carreira.** A secundária é sorteada quando o jogador é criado e nunca muda: a evolução, a virada e a aposentadoria não mexem nela (design, "Evolução"). Ganhar ou perder secundária treinando, na Etapa 3, pede outro ADR.
- **Só o `fit` lê a secundária.** O que identifica a posição continua lendo só a natural (design, "O que não muda"): a nota geral (`overall` com os pesos da natural), a composição do elenco, as linhas do banco da IA (`BENCH_LINES`), a regra do goleiro, a seleção da temporada por posição, a regra 3 da IA durante o jogo (meia ou atacante natural), a moral do banco, a tabela de aposentadoria, a posição do jovem da base, a lista de camisas, o agrupamento do elenco e a cor de setor na tela. O passe 1 do "natural primeiro" lê a natural por definição (item 5). Uma regra nova que precise ler a secundária fora do `fit` passa pelo `game-designer` e pelo `architect`.

### 2. As regras e a função de sorteio, no motor

Em `players.ts`, pela seção "Parâmetros e limites" do design:

- `SECONDARY_FIT = 0.95`, constante, ao lado da `FIT`.
- As vizinhas, calculadas da tabela por uma função interna (`secondaryNeighbours(position)`): as posições de linha com `FIT[position][s] ≥ IMPROVISED_MIN_FIT`, fora a natural, na ordem de `POSITIONS`. Nunca listadas à mão. O goleiro não tem vizinha, e nenhuma lista tem o gol.
- `players.secondaryChance`, parâmetro do `/balance` em `app/src/params/players.json`, com `PlayersParams.secondaryChance`, a faixa `num(0, 0.5)` em `PARAM_RANGES` e o valor no `testParams`, no mesmo PR (o validador de parâmetros recusa chave desconhecida).

```ts
// app/src/engine/players.ts; no contrato (index.ts)
export function secondaryPositionFor(
  seed: number, // GameState.seed (inteiro sem sinal de 32 bits)
  playerId: PlayerId,
  position: Position, // a natural
  chance: number, // players.secondaryChance na geração; a constante congelada na migração (item 4)
): Position | null;
```

O design sugere o nome `drawSecondaryPosition`. Fica `secondaryPositionFor` porque, no motor, `draw*` recebe um `Rng` por argumento, e esta função cria o próprio.

- **Fluxo próprio.** ``new Rng(seedFromString(`${seed}-secondary-${playerId}`))``, criado dentro da função, igual ao do design ("Sorteio e determinismo"). Não recebe nem consome nenhum outro `Rng`. Como os ids são únicos na carreira (fato 4), cada jogador tem o seu fluxo, e a ordem em que os jogadores são criados ou migrados não importa.
- **Ordem dos sorteios (contrato de determinismo).** Goleiro, ou posição sem vizinhas: devolve `null`, sem sortear. Senão, `u = rng.next()`; com `u ≥ chance`, `null`; senão, `vizinhas[rng.int(0, vizinhas.length − 1)]`. No máximo dois sorteios.
- **Monotônica na chance.** O `u` não depende da chance. Quem tem secundária com 0,33 continua com a mesma com 0,40, o que deixa o `/balance` comparar valores sem trocar os jogadores.
- **Pura e total.** Nunca lança, não lê relógio nem `Math.random()`. Mesma entrada, mesma saída, em qualquer motor JavaScript: `seedFromString` e o `Rng` só usam operações inteiras de 32 bits e uma divisão exata por 2³².

### 3. Onde a geração chama a função

- **`generateSquad`.** Na criação de cada rascunho, depois de `squadPositions` e com o id já conhecido (`idOf(index)`), `secondaryPosition: secondaryPositionFor(seed, id, position, params.players.secondaryChance)`. Fica **antes** do `shiftSquad`, para o deslocamento do elenco e o `bestEleven` já contarem com ela (design, "Onde entra"). O fluxo do elenco (`${label}-squad-${clubId}`) não muda: posições, idades, notas, atributos, traço, curva, nacionalidade, moral e potencial saem dos mesmos sorteios de hoje.
- **`generateAcademy`.** O jovem da base recebe `secondaryPositionFor(seed, turnPlayerId(clubId, season + 1, k), position, params.players.secondaryChance)`. O fluxo `${seed}-s${season}-academy-${clubId}-${k}` também não muda.
- **Mercado e outras criações (etapas seguintes).** Todo jogador novo recebe a secundária pela mesma função, com o id dele. Um caminho que crie jogador sem passar por ela é BLOCKER na revisão.
- **Online (1b).** O servidor usa o mesmo motor, então a liga gera as secundárias da semente dela, iguais para todos os participantes, e o D1 guarda o campo dentro do estado. Não há D1 em produção ainda, então não há migração do lado do servidor.

### 4. Versão 3 do save e a migração `0002`

- `SAVE_SCHEMA_VERSION` passa a 3. `CareerSaveV3` é o `CareerSaveV2` com `schemaVersion: 3`, e o `GameState` dele já traz `Player.secondaryPosition`. `CareerSave` passa a ser o `CareerSaveV3`, e o arquivo exportado passa a começar por `PRANCHETA-SAVE 3`. O envelope e o `CareerData` não mudam.
- **Migração** `app/src/lib/save/migrations/0002-secondary-position.ts` (`from: 2`):
  - lê `save.game.seed` e, para cada jogador de `save.game.players`, grava `secondaryPosition: secondaryPositionFor(seed, player.id, player.position, MIGRATION_SECONDARY_CHANCE)`;
  - **a chance é uma constante da própria migração**, `MIGRATION_SECONDARY_CHANCE = 0.33`, o valor de `players.secondaryChance` quando a v3 sai. A migração não recebe parâmetros e não pode depender deles: um ajuste do `/balance` mudaria a secundária de um save v2 migrado depois do ajuste. Enquanto `players.secondaryChance` for 0,33, a carreira migrada bate com o jogo novo; depois de um ajuste, os jogos novos seguem o parâmetro e a migração continua dando o mesmo de sempre;
  - nada mais muda: nem o resto do jogador (overall, atributos e potencial ficam, design "Carreiras já salvas"), nem os elencos, nem a tabela, nem `career.draft`, `career.lastRound` e `career.matchSheets`. O save migrado, gravado sem `base`, regrava as linhas de `matchSheets` com o mesmo conteúdo, como na `0001` (§4.2, "Gravação sem `base` numa carreira que já existe");
  - **não conserta e não lança.** O save ainda não passou pelo esquema (ADR-0006), então a migração só lê com cuidado: se `game` não for objeto, se `seed` não for inteiro de 0 a 2³² − 1, ou se um jogador não for objeto com `id` em texto e `position` em `POSITIONS`, ela copia aquele trecho como veio, sem a chave nova. O esquema `full` depois da cadeia recusa o save com `missing` ou com o problema do próprio dado. Monta a saída só com spread e `Object.fromEntries`, como pede `migrations/index.ts`;
  - **uma `secondaryPosition` que já venha num save v2 é trocada pelo sorteio.** Nenhum build v2 grava esse campo, então ele só aparece em arquivo editado, e a importação aceita só o que o jogo poderia ter gerado (nota de 2026-11-06 no ADR-0006), como a `0001` faz com `career.draft`;
  - **idempotente e determinística por construção.** A saída de cada jogador depende só de `seed`, `id`, `position` e da constante, que a migração não altera. Aplicar o passo duas vezes dá o mesmo resultado que uma, e migrar a mesma carreira em outro aparelho, outro navegador ou outro dia dá o mesmo resultado;
  - **a carreira migrada bate com o jogo novo.** Os jogadores `#1` a `#25` de uma carreira v2 têm a mesma posição natural num jogo novo da mesma semente (fato 4), então recebem a mesma secundária que receberiam se a carreira começasse hoje. O mesmo vale para os jovens da base, pelo id.
- **O que a migração não faz: refazer a força.** Ela não refaz o deslocamento do elenco nem a `strength` guardada dos clubes. Os elencos de antes foram deslocados para que o XI escolhido pelo algoritmo antigo batesse a escada, e o XI "natural primeiro" deles mede um pouco mais. Pela medição do design (4.000 elencos), a força de um clube muda assim: mediana 0, média +0,3, 10% dos clubes com +1 ou mais, 1% com +2 ou mais, máximo +3,3. A força exibida desses clubes sobe nessa medida, e eles jogam assim a partir da primeira rodada depois da atualização (ADR-0007, regra 7). Decisão 3 do CEO: aceito, sem reescrever o overall e sem aviso no jogo.
- **Fixtures.** Depois de subir a versão e escrever o passo, `npm run save:fixtures -w app` grava `__fixtures__/v3.json` e `__fixtures__/shape-v3.json`. O script nunca sobrescreve, então as da v1 e da v2 ficam como estão. A amostra da v3 é a mesma carreira das anteriores (temporada 2, rodada 2, clube 7). Ela tem goleiros (sempre `null`) e jogadores de linha com e sem secundária, então a forma, lida das amostras nos nós que o motor valida (`testing/shape.ts`), registra `secondaryPosition` como texto ou `null` de forma estável.

### 5. Escalação automática "natural primeiro" (T-082)

Decisão 2 do CEO: entra na mesma feature, antes de o `fit` ler a secundária. O algoritmo é o do design ("O algoritmo (substitui o passo 3 de `ia-clubes.md`)"). Resumo:

1. **Passe da posição:** vaga a vaga, na ordem da formação, a vaga recebe o disponível não escolhido **da posição natural da vaga** de maior valor; sem ninguém da posição, fica vazia neste passe.
2. **Passe da troca:** vaga a vaga, só as 10 de linha, o melhor não escolhido de qualquer posição toma a vaga se o valor dele for **estritamente maior** que o do ocupante, ou se ela estiver vazia. O ocupante que sai volta aos não escolhidos e pode tomar uma vaga seguinte no mesmo passe.
3. **Gol:** sem goleiro disponível, o gol é preenchido por último, depois do passe 2, como hoje. Um goleiro do passe 1 nunca é trocado.
4. **Menos de 11 disponíveis:** o preenchimento de hoje, sem mudança.
5. **Desempate:** o de hoje (`winsTie`: maior overall, mais novo, menor id).

**Uma função só**, em `selection.ts`:

```ts
// app/src/engine/selection.ts; na API de ferramentas (index.ts), para o robô do /balance
export function naturalFirstEleven<T extends Player>(
  available: readonly T[],
  formation: Formation,
  value: (player: T, slot: Position) => number,
): (T | undefined)[]; // um por vaga de FORMATION_SLOTS[formation]; undefined só com menos de 11
```

| Quem usa                                                             | Com que valor                                               | O que muda                                                                                                                                                                    |
| -------------------------------------------------------------------- | ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pickEleven` (`ai.ts`): escalação da IA e `suggestSheet`             | `selectionValue`                                            | o passo 3; a rotação (passo 4) e o banco (passo 5) não mudam                                                                                                                  |
| `bestEleven` (`generation.ts`): deslocamento, força na virada, ídolo | `overall × fit`, todos aptos e condição 100                 | o laço guloso de hoje                                                                                                                                                         |
| Robô do `/balance` (`scripts/balance/robot.ts`, `elevenByEff`)       | `effectiveRating(player, slot, correctedCondition(player))` | o laço guloso de hoje; o desempate passa a ser o `winsTie`, como na IA. Sem isso, a meta "técnico-robô vence a IA" mediria o algoritmo, não as decisões (design, "Onde vale") |
| `completeSheet` e o `bestForSlot` de uma vaga só                     | `selectionValue`                                            | **não mudam**: são uma ou duas vagas, e o técnico vê o resultado (design, "Onde vale")                                                                                        |

Antes da secundária, a mudança já melhora a escalação: pela medição do design, a força do XI completo vai de 70,20 a 70,47, e os titulares fora da posição natural caem de 0,39 para 0 por XI. Ela muda os goldens de rodada, temporada e virada e o `d` do deslocamento em parte dos clubes (logo, o `new-game.json`), e sobe o `ENGINE_VERSION`.

### 6. O contrato do motor muda de assinatura (T-079)

| Função                                                                                           | Hoje                                       | Depois                                                                                                                                                                                                                                                                                                                     |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fit` (interna)                                                                                  | `fit(natural, slot)`: `FIT[natural][slot]` | `fit(player: Pick<Player, 'position' \| 'secondaryPosition'>, slot)`: 1 na natural; `max(FIT[position][slot], SECONDARY_FIT)` na secundária; senão `FIT[position][slot]`. Com `secondaryPosition: null`, o mesmo número de hoje, bit a bit. O `max` mantém 0,95 numa secundária que deixe de ser vizinha se a tabela mudar |
| `fitLevel` (contrato)                                                                            | `fitLevel(natural, slot)`, três níveis     | `fitLevel(player: Pick<Player, 'position' \| 'secondaryPosition'>, slot)`, com `FitLevel = 'natural' \| 'secondary' \| 'improvised' \| 'outOfPosition'`. Decide pela vaga, não pelo número: natural, depois secundária, depois os limites de hoje (`IMPROVISED_MIN_FIT`)                                                   |
| `selectionValue`, `bestForSlot`                                                                  | `overall × fit(natural, slot) × …`         | o mesmo, com `fit(player, slot)`. Os tipos de `Pick<Player, …>` ganham `'secondaryPosition'`                                                                                                                                                                                                                               |
| `effectiveRating`, `slotEff`, `occupy` e as cobranças da partida                                 | idem                                       | idem: a partida, a força exibida e a tela ao vivo continuam dando o mesmo número para o mesmo jogador na mesma vaga                                                                                                                                                                                                        |
| `bestEleven`, `elevenStrength`, `naturalFirstEleven`                                             | idem                                       | idem. O `shiftSquad` mede o melhor XI já com as secundárias, então a força-alvo do novo jogo continua exata (o overall médio gerado desce cerca de 0,3, pelo design, "Efeito esperado no balanceamento")                                                                                                                   |
| `sheetStrength`, `completeSheet`, `reshapeLineup`, `sheetRoles`, `sheetProblems`, `suggestSheet` | a assinatura não muda                      | o comportamento muda pelo `fit` e, na sugestão, pelo "natural primeiro". A secundária entra quando falta alguém da posição. O `Δ` da IA (`shownEleven`, `teamStrength`) idem. `sheetProblems` não ganha problema novo                                                                                                      |

- **Contrato (`index.ts` e `CONTRACT` de `index.test.ts`).** Entram `secondaryPositionFor` (T-078; função usada pela migração em `lib/save`) e o membro novo de `FitLevel` (T-079). `fitLevel` muda de assinatura (T-079). `naturalFirstEleven` entra na API de ferramentas (T-082), só para `scripts/`. `SECONDARY_FIT`, `secondaryNeighbours`, `FIT` e `IMPROVISED_MIN_FIT` continuam internos: a tela lê o nível pelo `fitLevel`, e ler qualquer um deles em `ui/` ou `lib/` é BLOCKER, como já é com a `FIT` (§4.1).
- **`validatePlayer` (T-078).** Exige a chave. Aceita `null` ou uma posição de `POSITIONS` diferente de `position` e diferente de `GK`, e exige `null` no goleiro. Senão, o problema novo `invalid-secondary-position`, no campo `secondaryPosition`. O validador **não** confere as vizinhas: como o `growth` (fato 5), ele aceita a faixa mais larga da regra, para que uma mudança da tabela `FIT` nunca invalide um save legítimo (design, "Limite do campo no save"). A geração só dá vizinhas, e os testes de propriedade conferem isso.
- **Conferência de conteúdo da importação (T-073).** Não ganha caso novo: a secundária não tem texto, e um arquivo editado com uma secundária que não é vizinha muda só um número de jogo, como um atributo editado já muda hoje.
- **`ENGINE_VERSION`.** Sobe três vezes, uma por PR, cada uma com a explicação em `version.ts`: na T-078, o campo entra no novo jogo, e nenhum placar, ponto ou força muda; na T-082, o "natural primeiro" muda a escalação e o deslocamento; na T-079, o `fit` passa a ler a secundária.

### 7. Impacto na interface

Decisão 4 do CEO: a secundária aparece como marca própria e neutra na vaga, fora da lista de avisos (design, "O que a tela mostra").

- **Escalação (`ui/lineup.ts`).** As três chamadas de `fitLevel` passam a receber o jogador. O nível `secondary` ganha um selo novo no `StatusBadge`, com ícone e texto, nunca só por cor, e um par de cores nos tokens. A chave é `lineup.fit.secondary`, nos três idiomas. Na marca da vaga (uma por vaga, a mais grave vence), a ordem é lesionado > suspenso > fora de posição > improvisado > secundária > nenhuma. A secundária **não** entra na lista de avisos da Escalação nem na lista "Nesta formação" da Tática. Na escolha de quem entra numa vaga, o candidato na secundária aparece com a mesma marca.
- **Card do jogador e lista do elenco.** O card mostra "Posição" e "Posição secundária", com uma ajuda curta. A lista do elenco mostra a sigla da secundária menor, depois da natural, e um nome acessível ("Volante, também joga de zagueiro"). A cor de setor e o agrupamento do elenco continuam pela natural. As chaves são as da seção "Chaves de texto" do design; o desenho é do `ux-designer`, e os textos são do `content-writer`, com o lote aprovado pelo CEO.
- **O que não muda.** A tela continua sem ler a tabela `FIT` nem repetir limites. O pré-jogo e a força do time não mudam de tela, porque o número já conta o `fit`.

## Consequências

- **Positivo:** cerca de um terço dos jogadores de linha ganha uma segunda posição de verdade, o que dá ao técnico escolhas que hoje não existem. Uma regra só gera a secundária no jogo novo, na base e na migração, e a carreira migrada recebe as mesmas secundárias que um jogo novo da mesma semente daria. A migração é idempotente e não depende da ordem dos jogadores. O `fit` passa a ter um caminho só, que o compilador obriga cada chamada a seguir. Quem não tem secundária rende exatamente o que rende hoje. Com o "natural primeiro", a IA deixa de tirar um titular da posição dele para cobrir outra, e o robô do `/balance` escala pelo mesmo algoritmo.
- **Negativo:** o formato sobe para a v3, com migração, fixture e forma novas. A assinatura de `fit` e de `fitLevel` muda, com cerca de dez chamadas no motor e três na tela. O `ENGINE_VERSION` sobe três vezes, e a T-082 e a T-079 regravam os goldens de rodada, temporada e virada. O snapshot cresce cerca de 12 KB (menos de 2%). Carreiras em andamento mudam a partir da rodada seguinte à atualização: a força de alguns clubes sobe (mediana 0, máximo +3,3), e a IA pode escalar diferente.
- **Pendências:** as tarefas do plano abaixo; o design mergeado (`docs/design/posicao-secundaria.md`) e as mudanças que ele pede em `jogadores.md` ("Limites dos campos") e em `ia-clubes.md` (passo 3 da "Escalação") (`game-designer`); o texto deste ADR no §4.1 (`Player`, `fit`, `fitLevel`, `secondaryPositionFor`, `naturalFirstEleven` na API de ferramentas), no §4.2 (formato v3) e no §7 de `docs/02-architecture.md`, no PR de cada tarefa.

## Plano de tarefas

Os números são os próximos livres da 1a (o rascunho guardado de `docs/research/comentarios-devlog/` não reserva números). As tarefas do `developer` são `/feature`, porque tocam `app/src/engine/` e `app/src/lib/save/`.

| #     | Tarefa                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         | Quem                         | Depende de                            | Tamanho |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | ------------------------------------- | ------- |
| T-078 | **Campo e save v3, sem mudar a simulação.** `Player.secondaryPosition`, `SECONDARY_FIT`, `secondaryNeighbours`, `players.secondaryChance` (`players.json`, `PlayersParams`, `PARAM_RANGES`, `testParams`), `secondaryPositionFor` no contrato, a geração (antes do `shiftSquad`) e a base, `validatePlayer` com `invalid-secondary-position`, a fábrica de teste (`testing/players.ts`) com `null`; `SAVE_SCHEMA_VERSION` 3, `CareerSaveV3`, migração `0002-secondary-position.ts` com `MIGRATION_SECONDARY_CHANCE`, `__fixtures__/v3.json` e `shape-v3.json`. O `fit` ainda não lê o campo. `ENGINE_VERSION` sobe: muda o `new-game.json` (só o campo novo) e os digests. `measure:save` com o snapshot maior | developer                    | design mergeado                       | M       |
| T-080 | **Como a secundária aparece e os textos.** O selo `secondary` no `StatusBadge` e as cores nos tokens, a secundária no card e na lista do elenco, nos dois temas, em `escalacao.md` e nas telas do elenco e do card; as chaves da seção "Chaves de texto" do design em pt-BR, es e en. O lote de textos passa pelo CEO                                                                                                                                                                                                                                                                                                                                                                                          | ux-designer e content-writer | pode correr junto da T-078 e da T-082 | P       |
| T-082 | **Escalação "natural primeiro".** `naturalFirstEleven` em `selection.ts` (na API de ferramentas); `pickEleven`, `bestEleven` e o `elevenByEff` do robô passam a usá-la; `completeSheet` e o `bestForSlot` de uma vaga não mudam; a métrica informativa de titulares improvisados ou fora de posição por ficha no relatório do `/balance`; `ENGINE_VERSION` sobe e os goldens são regravados; `/balance` com 200 temporadas nas sementes 1, 2 e 3                                                                                                                                                                                                                                                               | developer                    | T-078                                 | M       |
| T-079 | **O motor lê a secundária.** `fit(player, slot)` com o `max` e `fitLevel(player, slot)` com o nível `secondary`; todas as chamadas do motor (seleção, força, IA, geração, partida, leituras da escalação) e do robô; as três chamadas de `ui/lineup.ts`, o selo e a ordem de gravidade da marca da vaga, pela T-080; `index.ts` e `CONTRACT`; a métrica informativa de titulares na secundária por ficha; `ENGINE_VERSION` sobe e os goldens são regravados; `/balance` com 200 temporadas nas sementes 1, 2 e 3 e o de release, com as metas conferidas pelo `game-designer`                                                                                                                                  | developer                    | T-082 e T-080                         | M       |
| T-081 | **A secundária no card e no elenco.** O card do jogador e a lista do elenco mostram a secundária pelo desenho da T-080, com os textos aprovados; E2E de que a escalação mostra o selo da secundária e o card mostra a posição secundária                                                                                                                                                                                                                                                                                                                                                                                                                                                                       | developer                    | T-079 e T-080                         | P       |

A ordem é T-078, depois T-082, depois T-079, depois T-081, com a T-080 em paralelo às três primeiras. O "natural primeiro" ficou numa tarefa própria porque, junto da T-079, ela passaria de M. Ele vem antes da T-079 porque, com o preenchimento de hoje, a secundária deixaria o time mais fraco (fato do design citado no "Contexto"). Cada PR prova uma coisa só: a T-078, que o formato mudou sem mudar nenhuma partida; a T-082, que só a escalação automática mudou; a T-079, que a simulação mudou só pelo `fit`.

## Testes (com o `qa-engineer`)

**Migração e formato (T-078):**

- `v1.json` e `v2.json` sobem a cadeia e passam no `full` da v3, com a mesma rodada, o mesmo clube e a mesma tabela (o teste que já existe para cada fixture). Em cada um: todo goleiro com `null`; toda secundária diferente da natural, nunca `GK` e sempre vizinha.
- O passo `0002` não muda nada além de `schemaVersion` e da chave nova em cada jogador: o save migrado, com a chave apagada de cada jogador, é igual à entrada com `schemaVersion: 3`. A entrada não muda.
- **Determinismo fixado.** As secundárias da `v2.json` migrada ficam numa lista `[id, secundária]` gravada no teste. Se a saída de `secondaryPositionFor` ou das vizinhas mudar, esse teste falha (ver "Conformidade"). Mudar `players.secondaryChance` não muda esse teste.
- **Idempotência.** Aplicar o passo `0002` duas vezes dá o mesmo que uma. Embaralhar a ordem das chaves de `game.players` não muda nenhuma secundária. Abrir duas vezes o mesmo save dá as mesmas secundárias (aceite 7 do design).
- **Bate com o jogo novo.** Com `players.secondaryChance` igual a `MIGRATION_SECONDARY_CHANCE`, para os jogadores da `v2.json` com id `#1` a `#25`, a secundária migrada é a do `newGame` da mesma semente, e a posição natural também.
- Um v2 com `secondaryPosition` num jogador (arquivo editado) sai com o valor do sorteio. Um v2 com `game` que não é objeto, `seed` inválida ou jogador sem `position` válida sai sem a chave nesse trecho, e o `full` o recusa, sem exceção na migração.
- `v3.json` passa no `full`, no `open` e no `write`. Um v3 aberto por um build v2 é recusado com `save-too-new`, sem alteração. Um v3 com um jogador sem a chave é recusado.
- `validatePlayer`: chave ausente é `missing`; `'GK'`, a própria natural, texto fora de `POSITIONS` e número são `invalid-secondary-position`; goleiro com secundária é `invalid-secondary-position`; `null` e qualquer posição de linha diferente da natural passam.
- `validateParams`: `players.secondaryChance` fora de 0 a 0,5 é recusado.

**Geração e propriedade (T-078; `PROPERTY_FULL=1` com o volume de release):**

- Em 200 carreiras (as sementes do teste do gerador), de 31% a 35% dos jogadores de linha têm secundária; nenhum goleiro tem; toda secundária é vizinha; nenhuma é igual à natural (aceite 1 do design). O mesmo vale para os jovens da base em temporadas seguidas, e a parcela por clube e por posição fica razoável.
- `secondaryPositionFor` é pura: mesma entrada, mesma saída. Subir a chance de 0,33 para 0,40 não tira nem troca a secundária de ninguém (aceite 2 do design).
- O fluxo do elenco não muda: com `players.secondaryChance = 0`, idade, atributos sorteados, traço, curva, moral, nacionalidade, nome e rosto de cada jogador são iguais aos da `main` (aceite 3 do design).

**"Natural primeiro" (T-082):**

- O caso do aceite 5 do design: com o melhor VOL (78) com secundária ZAG, ZAGs naturais de 68 e o VOL seguinte de 66, a IA escala o VOL de 78 no meio e os ZAGs na zaga. Em 4.000 elencos completos, titulares fora da natural ficam abaixo de 0,05 por XI; com 3 titulares fora, a força média do XI fica maior ou igual à do preenchimento de hoje.
- O goleiro do passe 1 nunca é trocado; sem goleiro, o gol é o último; com menos de 11 disponíveis, a saída é a do preenchimento de hoje; o passe 2 só troca com valor estritamente maior.
- `pickEleven`, `bestEleven` e o robô dão o mesmo XI que `naturalFirstEleven` com o valor de cada um. Nenhuma outra cópia do algoritmo existe.

**Leitura da secundária (T-079):**

- `fit(jogador com null, vaga) === FIT[natural][vaga]` para as 36 combinações; `fit(jogador, secundária) === max(FIT[natural][secundária], 0.95)`, que hoje dá 0,95 em toda vizinha; `fitLevel` dá `secondary` só na vaga da secundária, e os outros três níveis como hoje (aceite 4 do design).
- As propriedades que já existem continuam: a força exibida e a da partida dão o mesmo número para a mesma ficha; `sheetProblems` concorda com o `validateLineup`; nenhuma vaga livre aumenta a força; sem `NaN`. A propriedade da T-019 (o que a gravação aceita, a abertura aceita) roda com as secundárias.

**Golden e balanceamento:**

- (T-078) O diff dos goldens toca só a chave `secondaryPosition` do `new-game.json`, os digests e a versão. Nenhum placar, ponto, força nem nota muda, como na T-069.
- (T-082 e T-079) O PR lista os goldens que mudaram e por quê. Um golden montado só com jogadores feitos à mão, com `secondaryPosition: null`, não pode mudar nos dados por causa da T-079, só na versão.
- (T-082 e T-079) `npm run balance -- --seasons 200` com `--seed 1`, `2` e `3`: todas as metas da 1a dentro da tolerância. Na T-079, também gols por partida a ±0,02 e o 20 pontos mais forte a ±1 p.p. entre `secondaryChance` 0 e 0,33 (aceite 6 do design), e o de release (`--seasons 1000 --seed 1 --robot weakest`). Se uma meta sair da faixa, o ajuste é do `game-designer`, antes do merge.
- (T-079) `season.bench.ts` e `round.bench.ts` sem piora perceptível (o `fit` ganha uma comparação no laço da partida).

**E2E (T-081):** a escalação mostra o selo e o texto da secundária quando o jogador está na vaga dela, a lista de avisos não mostra a secundária, e o card do jogador mostra a posição secundária.

## Riscos

| Risco                                                                                                         | Efeito                                                                                                                                     | Como se trata                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alguém muda a regra da secundária (a função, a tabela `FIT`, `IMPROVISED_MIN_FIT`) depois que a `0002` existe | um save v2 migrado depois da mudança teria secundárias diferentes de um migrado antes; a regra "mesma carreira, mesmo resultado" quebraria | o teste de determinismo fixado falha; a regra da "Conformidade" manda congelar a versão antiga dentro da `0002` antes de mudar o motor. Ajustar `players.secondaryChance` não tem esse risco, porque a migração usa a própria constante |
| A secundária e o "natural primeiro" mexem no equilíbrio                                                       | metas de `balance-targets.md` fora da faixa                                                                                                | no novo jogo, o deslocamento do elenco mede o XI com o algoritmo e as secundárias novos, então a força-alvo continua exata; o design estima efeitos abaixo de ±0,01 gol e ±0,3 p.p.; o `/balance` da T-082 e da T-079 confere as metas  |
| Carreira em andamento muda no meio da temporada                                                               | força de alguns clubes sobe (mediana 0, 10% com +1 ou mais, máximo +3,3); a IA escala diferente                                            | decisão 3 do CEO: aceito, sem reescrever o overall e sem aviso no jogo; o devlog explica                                                                                                                                                |
| Uma chamada de `fit` esquecida, ou uma regra que compare `player.position` onde devia ler a secundária        | a partida e a força exibida divergem                                                                                                       | a assinatura nova não compila sem o jogador; as propriedades de concordância já existem; a lista do item 1 diz o que continua lendo só a natural                                                                                        |
| Volta do deploy para um build v2 depois de carreiras gravadas em v3                                           | essas carreiras ficam recusadas com `save-too-new` até o build novo voltar                                                                 | é o comportamento de toda mudança de formato (ADR-0006); nada é apagado nem alterado; o `devops-engineer` lembra disso no plano de release                                                                                              |
| Hash fraco: ids vizinhos (`#1`, `#2`) dando secundárias correlacionadas                                       | parcela torta por clube ou por posição                                                                                                     | `seedFromString` (FNV-1a) e o primeiro valor do mulberry32 misturam bem rótulos parecidos, como já acontece nos outros fluxos; os testes por clube e por posição conferem                                                               |
| Snapshot maior                                                                                                | gravação um pouco mais lenta                                                                                                               | cerca de 12 KB em até 680 KB; a T-078 roda o `measure:save` e compara com a meta de 130 ms do p90 (§5)                                                                                                                                  |

## Conformidade

- Só o `fit` lê `secondaryPosition` para rendimento, e o `fit` só existe em `players.ts`. Uma conta de rendimento por vaga fora dele, ou um `fit` que receba só a posição natural, é BLOCKER na revisão.
- Todo jogador criado pelo motor recebe a secundária por `secondaryPositionFor`, com o id dele e `players.secondaryChance`. Sortear a secundária num fluxo que já existe (o do elenco, o da base) ou num `Rng` recebido por argumento é BLOCKER: deslocaria os sorteios seguintes e desligaria a geração da migração.
- A migração `0002` chama `secondaryPositionFor` do contrato, com a constante `MIGRATION_SECONDARY_CHANCE`, e não tem cópia da regra. **Enquanto ela chamar o motor, a saída de `secondaryPositionFor` não muda para nenhuma entrada**, e isso inclui as vizinhas, que saem da tabela `FIT` e de `IMPROVISED_MIN_FIT`. Para mudar qualquer um deles, o mesmo PR primeiro copia a versão atual para dentro da `0002` (congelada, com o teste de determinismo fixado passando igual) e só então muda o motor. Mudar a saída sem esse passo é BLOCKER. A migração ler `players.secondaryChance` ou outro parâmetro também é BLOCKER.
- O "natural primeiro" só existe em `naturalFirstEleven`. Outra cópia dos dois passes, no motor ou em `scripts/`, é BLOCKER.
- `ui/` e `lib/` não leem `SECONDARY_FIT`, `secondaryNeighbours`, `FIT` nem `IMPROVISED_MIN_FIT`: a tela usa o `fitLevel`. `naturalFirstEleven` é da API de ferramentas, só para `scripts/`.
- Mudar a forma do campo (por exemplo, para uma lista) ou estreitar o que o validador aceita é formato novo: `schemaVersion`, migração e fixture, como pede o ADR-0006.

## Decisões do CEO

Decididas pelo CEO em 2026-11-08 ("ok recomendado"). Ficam como registro.

1. **Aprovar este ADR e o design** (`docs/design/posicao-secundaria.md`). **Decidido: sim.** A secundária é um campo obrigatório do jogador (`null` quando não tem). O formato sobe para a v3, com a migração pela semente da carreira e pelo id do jogador, e o `fit` lê a secundária em todo o motor.
2. **A escalação automática passa a "natural primeiro" na mesma feature.** **Decidido: sim.** Vale para a IA, a sugestão, o melhor XI e o robô do `/balance`. O `completeSheet` não muda. Entra como a T-082, antes da T-079.
3. **Carreiras salvas.** **Decidido:** a força de alguns clubes muda ao migrar (mediana 0, 10% com +1 ou mais, máximo +3,3). O overall não é reescrito, não há aviso no jogo, e a novidade vai só para o devlog. A opção descartada, um aviso único no jogo, pediria textos novos e um campo a mais no save.
4. **Como a secundária aparece na escalação.** **Decidido:** uma marca própria e neutra na vaga, menos grave que "improvisado", fora da lista de avisos. As opções descartadas eram nenhuma marca, que esconderia a diferença de 5%, e a mesma marca de "improvisado", que trataria como problema uma escolha boa.
