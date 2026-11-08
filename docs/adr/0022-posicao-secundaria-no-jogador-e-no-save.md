# ADR-0022: Posição secundária no jogador e no save (formato v3)

- **Status:** proposta. O CEO aprovou a ideia em 2026-11-08 ("ok recomendado, pode começar a posição secundária"): um jogador pode ter uma posição secundária própria, que rende menos que a natural, e as carreiras já salvas a recebem de forma determinística. A forma técnica abaixo é do `architect` e espera a aprovação do CEO (ver "Decisões do CEO").
- **Data:** 2026-11-08
- **Decisores:** CEO (pediu e aprovou a ideia), game-designer (fecha os números em `docs/design/jogadores.md`, na branch `docs/design-posicao-secundaria`), architect (propôs e redigiu), CEO (aprova este ADR)
- **Complementa:** ADR-0006 (formato do save: versão 3 e migração), ADR-0007 (contrato do motor e regra 7: `ENGINE_VERSION` e goldens; regra 2: sementes por fluxo), ADR-0012 (o que o `Player` guarda no estado) e ADR-0021 (formato v2, que este ADR sucede, e as leituras da escalação, que mudam de assinatura).

## Contexto

Hoje o rendimento de um jogador numa vaga vem só da tabela `FIT[natural][vaga]` de `app/src/engine/players.ts`, igual para todos: todo zagueiro rende 0,90 na lateral, todo meia rende 0,90 no ataque. O `fitLevel(natural, vaga)` dá à tela três níveis: `natural`, `improvised` e `outOfPosition`. O CEO quer que um jogador possa ter uma posição secundária própria, que rende menos que a natural e mais que o improviso. A proposta aprovada:

- na secundária o jogador rende cerca de 95% (entre a natural, 1,00, e o improviso, 0,90);
- cerca de 1 em 3 jogadores tem uma, no máximo uma, sempre vizinha da natural; goleiro nunca tem;
- carreiras já salvas recebem a secundária pela migração, de forma determinística: a mesma carreira tem sempre o mesmo resultado.

Os números (o rendimento, a parcela de jogadores e a tabela de posições vizinhas) são do `game-designer` e ficam em `docs/design/jogadores.md`, na seção da posição secundária. Este ADR não fixa nenhum deles: decide onde o dado mora, como entra no save, como a migração o sorteia e como o motor o lê. Cinco fatos pesam no desenho:

1. **O `Player` está no `GameState`, e o `GameState` está no save.** Um campo novo no jogador muda a forma do save. O teste de forma (`shape-vN.json`) quebra até o `schemaVersion` subir, com migração e fixture nova (ADR-0006).
2. **O `fit` é lido em pelo menos dez lugares do motor:** `selectionValue` (IA, substituto do inapto e `completeSheet`), `effectiveRating` e `sheetStrength` (força exibida), o `Δ` da IA, `bestEleven` e `elevenStrength` (geração, deslocamento do elenco e força da virada) e a partida (`occupy`, `slotEff`, chute e cobranças em `match/team.ts`). Todos recebem hoje só a posição natural.
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

| Opção                                                                                                                     | Prós                                                                                                                                                                                                                                                                                                 | Contras                                                                                                                                                                                    |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A: um `Rng` só para a migração, que percorre os jogadores em ordem                                                        | simples                                                                                                                                                                                                                                                                                              | o resultado de um jogador depende da ordem e de quantos vieram antes; uma ordem de chaves diferente no JSON (arquivo editado, outra serialização) muda tudo                                |
| B: um fluxo por jogador, ``seedFromString(`${seed}-secondary-${id}`)``, numa função pura do motor usada também na geração | o resultado depende só da semente da carreira, do id e da posição natural; não depende da ordem, não consome nenhum outro fluxo e é idempotente por construção; a carreira migrada recebe as mesmas secundárias que um jogo novo da mesma semente daria aos mesmos jogadores; uma regra só, no motor | a migração passa a depender de uma função do motor, que não pode mudar de saída enquanto a migração existir (ver "Conformidade")                                                           |
| C: a mesma ideia da B, com uma cópia congelada da regra dentro da migração                                                | a migração não depende do motor                                                                                                                                                                                                                                                                      | duas implementações da mesma regra (a da geração e a da migração), que podem divergir em silêncio; a carreira migrada deixa de bater com o jogo novo assim que alguém ajustar só uma delas |

**Como o motor lê a secundária:**

| Opção                                                                                 | Prós                                                                                                                                                                                                       | Contras                                                                                                                            |
| ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| A: terceiro argumento opcional, `fit(natural, slot, secondary?)`                      | as chamadas de hoje continuam compilando                                                                                                                                                                   | justamente por isso: uma chamada esquecida compila e ignora a secundária em silêncio, e a partida e a força exibida podem divergir |
| B: `fit(player, slot)`, com `player: Pick<Player, 'position' \| 'secondaryPosition'>` | toda chamada de hoje deixa de compilar e precisa ser revista; a partida, a força exibida, a IA e a tela leem o mesmo número pelo mesmo caminho; quem não tem secundária recebe a tabela de hoje, bit a bit | muda a assinatura de `fit` e de `fitLevel` (contrato), e a tela precisa passar o jogador                                           |

## Decisão

**Campo: B. Migração: B. Leitura no motor: B.**

### 1. O campo no jogador

```ts
// app/src/engine/players.ts
export interface Player {
  // ...os campos de hoje...
  /** Natural position. */
  readonly position: Position;
  /**
   * Secondary position (ADR-0022; jogadores.md): `null` when the player has none. Never 'GK',
   * never equal to `position`, always `null` for a goalkeeper. Drawn once, when the player is
   * created (or by the save migration 0002), by {@link secondaryPositionFor}; never changes.
   */
  readonly secondaryPosition: Position | null;
}
```

- **Obrigatório e anulável.** Toda chave do jogador continua obrigatória no validador. `null` quer dizer "não tem".
- **Fixo na carreira.** A secundária é sorteada quando o jogador é criado e nunca muda: a evolução, a virada e a aposentadoria não mexem nela. Se o design quiser que a secundária mude com o tempo (por exemplo, aprender uma posição no treino da Etapa 3), isso pede outro ADR.
- **Só o `fit` lê a secundária.** O que identifica a posição continua lendo só a natural: a nota geral (`overall` com os pesos da natural), a composição do elenco, as linhas do banco (`BENCH_LINES`), a regra do goleiro, a seleção da temporada por posição, a troca de meia ou atacante da IA, a tabela de aposentadoria, a posição do jovem da base, a lista de camisas e a cor de setor na tela. Uma regra nova que precise ler a secundária fora do `fit` passa pelo `game-designer` e pelo `architect`.

### 2. As regras e a função de sorteio, no motor

Três constantes novas em `players.ts`, com os valores de `docs/design/jogadores.md`, seção da posição secundária. São regras do jogo, como a tabela `FIT`, e não botões do `/balance` ("Parâmetros" › "Constantes"):

- `SECONDARY_FIT`: o rendimento na secundária (a proposta aprovada fala em cerca de 0,95). Um teste exige `FIT[natural][s] < SECONDARY_FIT < 1` para toda posição `s` que a tabela de vizinhas permite, para que a secundária nunca renda menos que o improviso que ela substitui.
- `SECONDARY_NEIGHBOURS: { readonly [P in Position]: readonly Position[] }`: as vizinhas de cada posição natural, na ordem da tabela do design. `GK` tem lista vazia, e nenhuma lista contém `GK`.
- `SECONDARY_SHARE`: a chance de um jogador de linha ter secundária (a proposta aprovada fala em cerca de 1 em 3).

Se o design pedir pesos diferentes por vizinha, a tabela ganha os pesos e o sorteio usa a soma acumulada, como o `drawTrait`. Se o design pedir uma cota por elenco (por exemplo, "exatamente N por clube") em vez da chance por jogador, a função deixa de ser por jogador, e este ADR volta ao `architect` antes do código.

```ts
// app/src/engine/players.ts; no contrato (index.ts)
export function secondaryPositionFor(
  seed: number, // GameState.seed (inteiro sem sinal de 32 bits)
  playerId: PlayerId,
  position: Position, // a natural
): Position | null;
```

- **Fluxo próprio.** ``new Rng(seedFromString(`${seed}-secondary-${playerId}`))``, criado dentro da função. Não recebe nem consome nenhum outro `Rng`. Como os ids são únicos na carreira (fato 4), cada jogador tem o seu fluxo, e a ordem em que os jogadores são criados ou migrados não importa.
- **Ordem dos sorteios (contrato de determinismo).** Goleiro, ou posição sem vizinhas: devolve `null`, sem sortear. Senão, `rng.next() < SECONDARY_SHARE` decide se tem; se tem, `rng.int(0, n − 1)` escolhe a vizinha na ordem de `SECONDARY_NEIGHBOURS[position]` (ou a soma acumulada dos pesos, se o design os tiver). No máximo dois sorteios.
- **Pura e total.** Nunca lança, não lê relógio nem `Math.random()`. Mesma entrada, mesma saída, em qualquer motor JavaScript: `seedFromString` e o `Rng` só usam operações inteiras de 32 bits e uma divisão exata por 2³².

### 3. Onde a geração chama a função

- **`generateSquad`.** Depois de `squadPositions` e do id de cada jogador (`idOf(index)`), cada rascunho recebe `secondaryPosition: secondaryPositionFor(seed, id, position)`. O fluxo do elenco (`${label}-squad-${clubId}`) não muda: idades, notas, atributos, traço, curva, nacionalidade, moral e potencial saem dos mesmos sorteios de hoje. A secundária tem de existir antes do `shiftSquad`, porque o `bestEleven` passa a lê-la a partir da T-079 (item 5).
- **`generateAcademy`.** O jovem da base recebe `secondaryPositionFor(seed, turnPlayerId(clubId, season + 1, k), position)`. O fluxo `${seed}-s${season}-academy-${clubId}-${k}` também não muda.
- **Mercado e outras criações (etapas seguintes).** Todo jogador novo recebe a secundária pela mesma função, com o id dele. Um caminho que crie jogador sem passar por ela é BLOCKER na revisão.
- **Online (1b).** O servidor usa o mesmo motor, então a liga gera as secundárias da mesma forma e o D1 guarda o campo dentro do estado. Não há D1 em produção ainda, então não há migração do lado do servidor.

### 4. Versão 3 do save e a migração `0002`

- `SAVE_SCHEMA_VERSION` passa a 3. `CareerSaveV3` é o `CareerSaveV2` com `schemaVersion: 3`, e o `GameState` dele já traz `Player.secondaryPosition`. `CareerSave` passa a ser o `CareerSaveV3`, e o arquivo exportado passa a começar por `PRANCHETA-SAVE 3`. O envelope e o `CareerData` não mudam.
- **Migração** `app/src/lib/save/migrations/0002-secondary-position.ts` (`from: 2`):
  - lê `save.game.seed` e, para cada jogador de `save.game.players`, grava `secondaryPosition: secondaryPositionFor(seed, player.id, player.position)`;
  - nada mais muda: nem o resto do jogador, nem os elencos, nem a tabela, nem `career.draft`, `career.lastRound` e `career.matchSheets`. O save migrado, gravado sem `base`, regrava as linhas de `matchSheets` com o mesmo conteúdo, como na `0001` (§4.2, "Gravação sem `base` numa carreira que já existe");
  - **não conserta e não lança.** O save ainda não passou pelo esquema (ADR-0006), então a migração só lê com cuidado: se `game` não for objeto, se `seed` não for inteiro de 0 a 2³² − 1, ou se um jogador não for objeto com `id` em texto e `position` em `POSITIONS`, ela copia aquele trecho como veio, sem a chave nova. O esquema `full` depois da cadeia recusa o save com `missing` ou com o problema do próprio dado. Monta a saída só com spread e `Object.fromEntries`, como pede `migrations/index.ts`;
  - **uma `secondaryPosition` que já venha num save v2 é trocada pelo sorteio.** Nenhum build v2 grava esse campo, então ele só aparece em arquivo editado, e a importação aceita só o que o jogo poderia ter gerado (nota de 2026-11-06 no ADR-0006), como a `0001` faz com `career.draft`;
  - **idempotente e determinística por construção.** A saída de cada jogador depende só de `seed`, `id` e `position`, que a migração não altera. Aplicar o passo duas vezes dá o mesmo resultado que uma, e migrar a mesma carreira em outro aparelho, outro navegador ou outro dia dá o mesmo resultado.
  - **A carreira migrada bate com o jogo novo.** Os jogadores `#1` a `#25` de uma carreira v2 têm a mesma posição natural num jogo novo da mesma semente (fato 4), então recebem a mesma secundária que receberiam se a carreira começasse hoje. O mesmo vale para os jovens da base, pelo id.
- **O que a migração não faz.** Não refaz o deslocamento do elenco nem a força dos clubes. Uma carreira em andamento passa a ter clubes um pouco mais fortes onde a secundária ajuda, a partir da primeira rodada depois da atualização (ADR-0007, regra 7: vale da próxima rodada em diante). Refazer o deslocamento mudaria notas e atributos que o jogador já viu.
- **Fixtures.** Depois de subir a versão e escrever o passo, `npm run save:fixtures -w app` grava `__fixtures__/v3.json` e `__fixtures__/shape-v3.json`. O script nunca sobrescreve, então as da v1 e da v2 ficam como estão. A amostra da v3 é a mesma carreira das anteriores (temporada 2, rodada 2, clube 7). Ela tem goleiros (sempre `null`) e jogadores de linha com e sem secundária, então a forma, lida das amostras nos nós que o motor valida (`testing/shape.ts`), registra `secondaryPosition` como texto ou `null` de forma estável.

### 5. O contrato do motor muda de assinatura (T-079)

| Função                                                                                           | Hoje                                       | Depois                                                                                                                                                                                                                                                                                                                 |
| ------------------------------------------------------------------------------------------------ | ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fit` (interna)                                                                                  | `fit(natural, slot)`: `FIT[natural][slot]` | `fit(player: Pick<Player, 'position' \| 'secondaryPosition'>, slot)`: 1 na natural; `SECONDARY_FIT` na secundária; senão `FIT[position][slot]`. Com `secondaryPosition: null`, o mesmo número de hoje, bit a bit                                                                                                       |
| `fitLevel` (contrato)                                                                            | `fitLevel(natural, slot)`, três níveis     | `fitLevel(player: Pick<Player, 'position' \| 'secondaryPosition'>, slot)`, com `FitLevel = 'natural' \| 'secondary' \| 'improvised' \| 'outOfPosition'`. A vaga da natural é `natural`; a da secundária é `secondary`, pelo tipo de vaga e não pelo número; as outras seguem os limites de hoje (`IMPROVISED_MIN_FIT`) |
| `selectionValue`, `bestForSlot`                                                                  | `overall × fit(natural, slot) × …`         | o mesmo, com `fit(player, slot)`. Os tipos de `Pick<Player, …>` ganham `'secondaryPosition'`                                                                                                                                                                                                                           |
| `effectiveRating`, `slotEff`, `occupy` e as cobranças da partida                                 | idem                                       | idem: a partida, a força exibida e a tela ao vivo continuam dando o mesmo número para o mesmo jogador na mesma vaga                                                                                                                                                                                                    |
| `bestEleven`, `elevenStrength`                                                                   | idem                                       | idem. O `shiftSquad` mede o melhor XI já com as secundárias, então a força-alvo do novo jogo continua exata (o elenco desce um pouco onde a secundária ajudaria)                                                                                                                                                       |
| `sheetStrength`, `completeSheet`, `reshapeLineup`, `sheetRoles`, `sheetProblems`, `suggestSheet` | a assinatura não muda                      | o comportamento muda pelo `fit`: a sugestão e o "Completar" passam a escalar um jogador na secundária quando ele rende mais ali. O `Δ` da IA (`shownEleven`, `teamStrength`) idem                                                                                                                                      |

- **Contrato (`index.ts` e `CONTRACT` de `index.test.ts`).** Entram `secondaryPositionFor` (função, usada pela migração em `lib/save`) e o membro novo de `FitLevel`. `fitLevel` muda de assinatura. `SECONDARY_FIT`, `SECONDARY_NEIGHBOURS`, `SECONDARY_SHARE`, `FIT` e `IMPROVISED_MIN_FIT` continuam internos: a tela lê o nível pelo `fitLevel`, e ler qualquer um deles em `ui/` ou `lib/` é BLOCKER, como já é com a `FIT` (§4.1).
- **`validatePlayer`.** Exige a chave. Aceita `null` ou uma posição de `POSITIONS` diferente de `position` e diferente de `GK`, e exige `null` no goleiro. Senão, o problema novo `invalid-secondary-position`, no campo `secondaryPosition`. O validador **não** confere a tabela de vizinhas: como o `growth` (fato 5), ele aceita a faixa mais larga da regra, para que um ajuste da tabela no design nunca invalide um save. A geração, sim, só dá vizinhas, e os testes de propriedade conferem isso.
- **Conferência de conteúdo da importação (T-073).** Não ganha caso novo: a secundária não tem texto, e um arquivo editado com uma secundária que não é vizinha muda só um número de jogo, como um atributo editado já muda hoje.
- **`ENGINE_VERSION`.** Sobe na T-078 (o campo entra no novo jogo; nenhum placar, ponto ou força muda) e de novo na T-079 (o `fit` passa a ler a secundária; a simulação muda). São dois PRs com goldens novos, cada um com a sua explicação em `version.ts`.

### 6. Impacto na interface

- **Escalação (`ui/lineup.ts`).** As três chamadas de `fitLevel` passam a receber o jogador. O nível `secondary` ganha marca própria, com ícone e texto (nunca só por cor), e a chave `lineup.fit.secondary` nos três idiomas. A forma da marca é do `ux-designer`, e o texto do `content-writer`, aprovado pelo CEO (ver a decisão 2).
- **Card do jogador e lista do elenco.** Mostram a secundária ao lado da natural (por exemplo, a sigla da secundária menor, depois da natural). A cor de setor continua sendo a da natural. O desenho é do `ux-designer`.
- **O que não muda.** A tela continua sem ler a tabela `FIT` nem repetir limites. Os agrupamentos e a ordem do elenco continuam pela natural.

## Consequências

- **Positivo:** cerca de um terço dos jogadores ganha uma segunda posição de verdade, o que dá ao técnico escolhas que hoje não existem. Uma regra só gera a secundária no jogo novo, na base e na migração, e a carreira migrada recebe as mesmas secundárias que um jogo novo da mesma semente daria. A migração é idempotente e não depende da ordem dos jogadores. O `fit` passa a ter um caminho só, que o compilador obriga cada chamada a seguir. Quem não tem secundária rende exatamente o que rende hoje.
- **Negativo:** o formato sobe para a v3, com migração, fixture e forma novas. A assinatura de `fit` e de `fitLevel` muda, com cerca de dez chamadas no motor e três na tela. O `ENGINE_VERSION` sobe duas vezes, e a T-079 regrava os goldens de rodada, temporada e virada. O snapshot cresce cerca de 12 KB (menos de 2%). Carreiras em andamento mudam um pouco a partir da rodada seguinte à atualização: alguns clubes ficam um pouco mais fortes, e a IA pode escalar diferente.
- **Pendências:** as tarefas do plano abaixo; a seção da posição secundária em `docs/design/jogadores.md` (números e tabela de vizinhas) e a linha `secondaryPosition` em "Limites dos campos" (`game-designer`, branch `docs/design-posicao-secundaria`); o texto deste ADR no §4.1 (`Player`, `fit`, `fitLevel`), no §4.2 (formato v3) e no §7 de `docs/02-architecture.md`, no PR de cada tarefa.

## Plano de tarefas

Os números são os próximos livres da 1a (o rascunho guardado de `docs/research/comentarios-devlog/` não reserva números). As duas tarefas do `developer` são `/feature`, porque tocam `app/src/engine/` e `app/src/lib/save/`.

| #     | Tarefa                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   | Quem                         | Depende de                                   | Tamanho |
| ----- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------- | -------------------------------------------- | ------- |
| T-078 | **Campo e save v3, sem mudar a simulação.** `Player.secondaryPosition`, as três constantes, `secondaryPositionFor` (no contrato), a geração e a base, `validatePlayer` com `invalid-secondary-position`, a fábrica de teste (`testing/players.ts`) com `null`; `SAVE_SCHEMA_VERSION` 3, `CareerSaveV3`, migração `0002-secondary-position.ts`, `__fixtures__/v3.json` e `shape-v3.json`; o `fit` ainda não lê o campo. `ENGINE_VERSION` sobe: muda o `new-game.json` (só o campo novo) e os digests. `measure:save` com o snapshot maior | developer                    | design mergeado                              | M       |
| T-080 | **Como a secundária aparece e os textos.** Marca do nível `secondary` na escalação, a secundária no card e na lista do elenco, nos dois temas; `lineup.fit.secondary` e o rótulo da secundária no card em pt-BR, es e en. O lote de textos passa pelo CEO                                                                                                                                                                                                                                                                                | ux-designer e content-writer | decisão 2 do CEO; pode correr junto da T-078 | P       |
| T-079 | **O motor lê a secundária.** `fit(player, slot)` e `fitLevel(player, slot)` com o nível `secondary`; todas as chamadas do motor (seleção, força, IA, geração, partida, leituras da escalação); as três chamadas de `ui/lineup.ts` e a marca da T-080; `index.ts` e `CONTRACT`; `ENGINE_VERSION` sobe e os goldens são regravados; `npm run balance -- --seasons 200` e o de release, com as metas conferidas pelo `game-designer`                                                                                                        | developer                    | T-078 e T-080                                | M       |
| T-081 | **A secundária no card e no elenco.** O card do jogador e a lista do elenco mostram a secundária pelo desenho da T-080, com os textos aprovados; E2E de que a escalação mostra a marca da secundária e o card mostra a sigla                                                                                                                                                                                                                                                                                                             | developer                    | T-079 e T-080                                | P       |

A ordem é T-078 (com a T-080 em paralelo), depois T-079, depois T-081. A T-078 fica separada da T-079 para que a revisão de cada uma prove uma coisa só: na T-078, que o formato mudou sem mudar nenhuma partida; na T-079, que a simulação mudou só pelo `fit`. As duas juntas seriam G.

## Testes (com o `qa-engineer`)

**Migração e formato (T-078):**

- `v1.json` e `v2.json` sobem a cadeia e passam no `full` da v3, com a mesma rodada, o mesmo clube e a mesma tabela (o teste que já existe para cada fixture). Em cada um: todo goleiro com `null`; toda secundária diferente da natural, nunca `GK` e sempre vizinha pela tabela do design.
- O passo `0002` não muda nada além de `schemaVersion` e da chave nova em cada jogador: o save migrado, com a chave apagada de cada jogador, é igual à entrada com `schemaVersion: 3`. A entrada não muda.
- **Determinismo fixado.** As secundárias da `v2.json` migrada ficam numa lista `[id, secundária]` gravada no teste. Se a saída de `secondaryPositionFor` mudar, esse teste falha (ver "Conformidade").
- **Idempotência.** Aplicar o passo `0002` duas vezes dá o mesmo que uma. Embaralhar a ordem das chaves de `game.players` não muda nenhuma secundária.
- **Bate com o jogo novo.** Para os jogadores da `v2.json` com id `#1` a `#25`, a secundária migrada é a do `newGame` da mesma semente, e a posição natural também.
- Um v2 com `secondaryPosition` num jogador (arquivo editado) sai com o valor do sorteio. Um v2 com `game` que não é objeto, `seed` inválida ou jogador sem `position` válida sai sem a chave nesse trecho, e o `full` o recusa, sem exceção na migração.
- `v3.json` passa no `full`, no `open` e no `write`. Um v3 aberto por um build v2 é recusado com `save-too-new`, sem alteração. Um v3 com um jogador sem a chave é recusado.
- `validatePlayer`: chave ausente é `missing`; `'GK'`, a própria natural, texto fora de `POSITIONS` e número são `invalid-secondary-position`; goleiro com secundária é `invalid-secondary-position`; `null` e qualquer posição de linha diferente da natural passam.

**Propriedade (T-078 e T-079; `PROPERTY_FULL=1` com o volume de release):**

- Em carreiras geradas com sementes variadas, a parcela de jogadores de linha com secundária fica na faixa que o `game-designer` der para `SECONDARY_SHARE`, no total e por posição. Nenhum goleiro tem secundária, e nenhuma secundária é `GK`, a natural ou fora da tabela de vizinhas. O mesmo vale para os jovens da base em temporadas seguidas.
- `secondaryPositionFor` é pura: mesma entrada, mesma saída; e duas chamadas com o mesmo id e sementes diferentes não ficam presas uma à outra (a parcela por clube também fica na faixa).
- (T-079) `fit(jogador com null, vaga) === FIT[natural][vaga]` para as 36 combinações; `fit(jogador, secundária) === SECONDARY_FIT`; `FIT[natural][s] < SECONDARY_FIT < 1` para toda vizinha `s`. `fitLevel` dá `secondary` só na vaga da secundária, e os outros três níveis como hoje.
- (T-079) As propriedades que já existem continuam: a força exibida e a da partida dão o mesmo número para a mesma ficha; `sheetProblems` concorda com o `validateLineup`; nenhuma vaga livre aumenta a força; sem `NaN`. A propriedade da T-019 (o que a gravação aceita, a abertura aceita) roda com as secundárias.

**Golden e balanceamento:**

- (T-078) O diff dos goldens toca só a chave `secondaryPosition` do `new-game.json`, os digests e a versão. Nenhum placar, ponto, força nem nota muda, como na T-069.
- (T-079) O PR lista os goldens que mudaram e por quê. Um golden montado só com jogadores feitos à mão, com `secondaryPosition: null`, não pode mudar nos dados, só na versão.
- (T-079) `npm run balance -- --seasons 200` e o de release (`--seasons 1000 --seed 1 --robot weakest`) com as metas de `balance-targets.md` (gols por jogo, favorito por 20 pontos, campeão e 17º). Se uma meta sair da faixa, o ajuste é do `game-designer`, nos números da secundária ou nos parâmetros, antes do merge.
- (T-079) `season.bench.ts` e `round.bench.ts` sem piora perceptível (o `fit` ganha uma comparação no laço da partida).

**E2E (T-081):** a escalação mostra a marca e o texto da secundária quando o jogador está na vaga dela, e o card do jogador mostra a sigla da secundária.

## Riscos

| Risco                                                                                                  | Efeito                                                                                                                                    | Como se trata                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Alguém ajusta a regra da secundária (parcela, vizinhas) depois que a migração `0002` existe            | um save v2 migrado depois do ajuste teria secundárias diferentes de um migrado antes; a regra "mesma carreira, mesmo resultado" quebraria | o teste de determinismo fixado falha; a regra da "Conformidade" manda congelar a versão antiga dentro da `0002` antes de mudar o motor                                             |
| A secundária mexe no equilíbrio (mais força média, mais gols, favorito vencendo mais)                  | metas de `balance-targets.md` fora da faixa                                                                                               | no novo jogo, o deslocamento do elenco já mede o XI com as secundárias, então a força-alvo continua exata; o `/balance` da T-079 confere as metas, e o ajuste é do `game-designer` |
| Carreira em andamento muda no meio da temporada                                                        | clubes um pouco mais fortes, a IA escala diferente; a `strength` guardada do clube na temporada 1 fica um pouco abaixo do melhor XI       | efeito pequeno e igual para todos os clubes; nada quebra nem some; a decisão 3 diz como avisar                                                                                     |
| Uma chamada de `fit` esquecida, ou uma regra que compare `player.position` onde devia ler a secundária | a partida e a força exibida divergem                                                                                                      | a assinatura nova não compila sem o jogador; as propriedades de concordância já existem; a lista do item 1 diz o que continua lendo só a natural                                   |
| Volta do deploy para um build v2 depois de carreiras gravadas em v3                                    | essas carreiras ficam recusadas com `save-too-new` até o build novo voltar                                                                | é o comportamento de toda mudança de formato (ADR-0006); nada é apagado nem alterado; o `devops-engineer` lembra disso no plano de release                                         |
| Hash fraco: ids vizinhos (`#1`, `#2`) dando secundárias correlacionadas                                | parcela torta por clube ou por posição                                                                                                    | `seedFromString` (FNV-1a) e o primeiro valor do mulberry32 misturam bem rótulos parecidos, como já acontece nos outros fluxos; as propriedades por clube e por posição conferem    |
| Snapshot maior                                                                                         | gravação um pouco mais lenta                                                                                                              | cerca de 12 KB em até 680 KB; a T-078 roda o `measure:save` e compara com a meta de 130 ms do p90 (§5)                                                                             |

## Conformidade

- Só o `fit` lê `secondaryPosition` para rendimento, e o `fit` só existe em `players.ts`. Uma conta de rendimento por vaga fora dele, ou um `fit` que receba só a posição natural, é BLOCKER na revisão.
- Todo jogador criado pelo motor recebe a secundária por `secondaryPositionFor`, com o id dele. Sortear a secundária num fluxo que já existe (o do elenco, o da base) ou num `Rng` recebido por argumento é BLOCKER: deslocaria os sorteios seguintes e desligaria a geração da migração.
- A migração `0002` chama `secondaryPositionFor` do contrato e não tem cópia da regra. **Enquanto ela chamar o motor, a saída de `secondaryPositionFor` não muda para nenhuma entrada.** Para mudar a regra dos jogos novos, o mesmo PR primeiro copia a versão atual para dentro da `0002` (congelada, com o teste de determinismo fixado passando igual) e só então muda o motor. Mudar a saída sem esse passo é BLOCKER.
- `ui/` e `lib/` não leem `SECONDARY_FIT`, `SECONDARY_NEIGHBOURS`, `SECONDARY_SHARE`, `FIT` nem `IMPROVISED_MIN_FIT`: a tela usa o `fitLevel`.
- Mudar a forma do campo (por exemplo, para uma lista) ou estreitar o que o validador aceita é formato novo: `schemaVersion`, migração e fixture, como pede o ADR-0006.

## Decisões do CEO

1. **Aprovar este ADR**: a secundária como campo obrigatório do jogador (`null` quando não tem), o formato v3 com a migração pela semente da carreira e pelo id do jogador, e o `fit` lendo a secundária em todo o motor. **Recomendação: sim.** É a forma mais simples que dá a mesma secundária para a mesma carreira em qualquer aparelho, usa uma regra só para o jogo novo e para a carreira migrada, e não mexe em nenhum outro sorteio. Efeito nas carreiras em andamento: a partir da primeira rodada depois da atualização, alguns clubes ficam um pouco mais fortes e a IA pode escalar diferente. Nada do que já foi jogado muda.
2. **Como a secundária aparece na escalação.**
   - Opção A (recomendada): marca própria, "posição secundária", com ícone neutro e texto, diferente da de "improvisado". O técnico vê que o jogador rende bem ali, mas não tanto quanto na natural.
   - Opção B: sem marca, como na natural. Mais limpo, mas esconde a diferença de cerca de 5% que o CEO pediu que existisse.
   - Opção C: a mesma marca de "improvisado". Não pede desenho novo, mas trata como problema uma escolha boa.
3. **Aviso nas carreiras em andamento.**
   - Opção A (recomendada): sem aviso no jogo. A secundária aparece no card e na escalação, e o post do devlog da semana explica a novidade. Não pede tela nem texto novo.
   - Opção B: um aviso único na primeira abertura depois da atualização ("Novidade: alguns jogadores agora têm posição secundária"). Pede texto nos três idiomas e um lugar no save para lembrar que o aviso já apareceu.
