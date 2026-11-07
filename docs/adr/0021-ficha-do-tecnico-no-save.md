# ADR-0021: Ficha do técnico no save (formato v2), fora do estado do motor

- **Status:** proposto (aguarda o CEO). O CEO aprovou em 2026-11-07, pela recomendação, que a escalação montada pelo técnico seja guardada no save. A forma técnica abaixo é do `architect`.
- **Data:** 2026-11-07
- **Decisores:** ux-designer (pediu: `docs/design/telas/funcoes.md`, "Pedidos ao motor", pedido 1), architect (propôs e redigiu), CEO (aprova)
- **Complementa:** ADR-0006 (formato do save: versão 2 e migração), ADR-0007 (contrato do motor: leituras novas, sem mudar a simulação) e ADR-0019 (dado da aplicação fica fora do `GameState`).

## Contexto

A tela de escalação, tática e funções (T-029) muda a ficha na hora, sem botão "Salvar". O save não tem onde guardar essa ficha. O `CareerData` não tem ficha, e o `GameState.lastSheets` só guarda a ficha que cada clube já levou a campo. Por isso, recarregar a página perde a escalação, a formação, a postura, a pressão, o capitão e os cobradores. Três medidas de E2E da T-029 dependem disso: a 11 da Escalação, a 2 da Tática e a 7 das Funções.

A ficha guardada precisa aceitar um estado inválido. O técnico pode deixar uma vaga livre e sair, e um titular pode se lesionar ou ser suspenso na rodada. A tela mostra essa ficha com o aviso até ela ser consertada. Quatro fatos pesam no desenho:

1. **O `Lineup` do motor não tem buraco.** `starters[i]` ocupa a vaga `i` de `FORMATION_SLOTS[formation]`. Uma lista mais curta deixa vazias as últimas vagas. Uma vaga livre no meio (um zagueiro tirado do campo) não cabe nessa forma.
2. **A IA lê o `lastSheets` dos adversários.** O Δ do `suggestSheet` usa a força exibida do adversário pelo `shownEleven`, que parte de `lastSheets` (§4.1, T-011 e T-013). A regra de `ia-clubes.md` é que a IA nunca vê a ficha que o adversário vai mandar.
3. **O snapshot é grande.** Ele tem até cerca de 680 KB de JSON. A gravação segura mede p90 de 70 a 104 ms com 4× de lentidão de CPU (§5, "Medido na T-072"), e uma carreira guarda só 3 versões. Na Etapa 2, com as Séries B a D, o snapshot cresce cerca de 4 vezes (§9).
4. **A ficha é pequena.** São 18 ids, três listas curtas e a tática, cerca de 0,6 KB de JSON.

## Opções consideradas

**Onde a ficha fica:**

| Opção                                                                | Prós                                                                                                                                                                       | Contras                                                                                                                                                                                                                                                                                                                            |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: no `GameState` (campo novo, ou a ficha em edição no `lastSheets`) | um lugar só para fichas                                                                                                                                                    | o motor não lê a ficha em edição; o digest do estado muda nos goldens e o `ENGINE_VERSION` sobe sem mudar a simulação; no `lastSheets`, a IA passaria a ver a ficha que o técnico está montando, e a sugestão dela dependeria da ordem das edições na tela; o servidor da 1b carregaria um dado da carreira offline em toda rodada |
| B: no envelope, `career.draft`                                       | o motor e os goldens não mudam; segue o ADR-0019 (o que é da aplicação fica fora do estado), como `career.lastRound` e `career.matchSheets`; a IA continua sem ver a ficha | o `CareerService` passa a cuidar da ficha (conciliar com o elenco, gravar, levar para a rodada)                                                                                                                                                                                                                                    |

**Formato:**

| Opção                                                                                    | Prós                                                                                                                                                                      | Contras                                                                                                                                               |
| ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: o próprio `TeamSheet` do motor                                                        | tipo que já existe                                                                                                                                                        | não representa vaga livre no meio (fato 1) nem banco com vaga livre na posição que a tela mostra; obrigaria a tela a reordenar o que o técnico deixou |
| B: uma forma de edição, `DraftSheet`, com `null` na vaga livre, separada da ficha válida | é exatamente o que a tela mostra; a passagem para a ficha válida tem um caminho só (`completeSheet` e depois `validateLineup`); o motor continua recebendo só `TeamSheet` | um tipo a mais no contrato, e duas conversões (`draftFromSheet` e `completeSheet`)                                                                    |

**Como a ficha é gravada entre as rodadas:**

| Opção                                                               | Prós                                                                                                                                                                                                                                      | Contras                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: um snapshot novo a cada edição (com espera de alguns ms)         | nenhum mecanismo novo                                                                                                                                                                                                                     | cerca de 680 KB gravados e relidos por toque, de 70 a 104 ms no p90 com 4× de lentidão, boa parte na thread principal durante o arrastar; algumas edições ocupam as 3 versões com a mesma rodada; o custo cresce cerca de 4 vezes na Etapa 2 enquanto a ficha continua com 0,6 KB |
| B: um store novo do IndexedDB, uma linha por carreira               | gravação de cerca de 1 KB                                                                                                                                                                                                                 | versão 2 da estrutura do banco, com teste de atualização; mais um store para apagar junto com a carreira e para casar com o snapshot certo                                                                                                                                        |
| C: no registro da carreira no store `careers`, ao lado do `headSeq` | gravação de cerca de 1 KB numa transação de um store; a trava de outra aba e o casamento com o snapshot usam a mesma linha que o `headSeq`; o desfazer e o `deleteCareer` já tratam essa linha; a estrutura do banco continua na versão 1 | o registro de `careers` deixa de ser só o resumo da lista                                                                                                                                                                                                                         |

## Decisão

**Onde: B. Formato: B. Gravação: C.** Os detalhes do contrato estão em `docs/02-architecture.md`, §4.1 ("Ficha em edição e leituras para a escalação") e §4.2 ("Ficha do técnico").

### 1. A ficha fica no envelope, nunca no `GameState`

`CareerSaveV2.career.draft?: DraftSheet`. Ausente quer dizer que o técnico ainda não mexeu: a tela mostra o `suggestSheet` com `controller: 'human'`, e jogar sem ficha deixa o motor sugerir, como hoje.

**Determinismo.** A ficha só chega à simulação como `RoundInput.sheets[clubId]`, que já é uma entrada explícita do `playRound` e do `prepareRound`. Mesmo estado, mesmos parâmetros e mesma entrada continuam dando o mesmo resultado (ADR-0007). O motor nunca lê o envelope. O `lastSheets` continua sendo só a ficha jogada, gravada pelo `playRound`, e a IA continua sem ver a ficha em edição. A regra de que a tela ao vivo e o `playRound` recebem a mesma ficha não muda. A diferença é que, depois de recarregar, essa ficha é a mesma de antes.

**Liga online (1b).** A ficha confirmada mora no servidor (`PUT .../lineup`, ADR-0009). Este ADR vale só para a carreira.

### 2. Formato: a ficha em edição separada da ficha válida

```ts
// app/src/engine/lineup.ts, no contrato (T-075)
export interface DraftLineup {
  readonly formation: Formation;
  readonly starters: readonly (PlayerId | null)[]; // sempre 11, na ordem das vagas de FORMATION_SLOTS[formation]; null = vaga livre
  readonly bench: readonly (PlayerId | null)[]; // até BENCH_SIZE (7); null = vaga livre do banco
  readonly captains: readonly PlayerId[];
  readonly penaltyTakers: readonly PlayerId[];
  readonly freeKickTakers: readonly PlayerId[]; // listas ordenadas, como em Lineup
}
export interface DraftSheet {
  readonly lineup: DraftLineup;
  readonly tactic: Tactic; // só as 3 posturas de antes do jogo, como no TeamSheet
}
export function draftFromSheet(sheet: TeamSheet): DraftSheet; // completa titulares com null até 11 e o banco até 7; listas e tática iguais
```

- **O que a ficha em edição aceita:** vaga livre (`null`) no campo e no banco; titular ou reserva lesionado ou suspenso; listas de funções com quem não está em campo; qualquer formação conhecida.
- **O que ela não aceita:** id repetido entre titulares e banco; id repetido numa lista; id fora do elenco do clube do técnico; postura `allOut`. A ficha nunca tem um jogador que não existe no estado.
- **De ficha em edição para ficha válida:** só por `completeSheet` (T-076), e depois pelo `validateLineup`. Isso vale no "Jogar rodada" (a ficha pronta passa igual, ver §4.1) e no "Completar e jogar". O `CareerService` entrega ao motor só `TeamSheet`. O motor não recebe `DraftSheet` em nenhuma função da simulação.
- **Depois da rodada:** se a tela mandou uma ficha, `career.draft = draftFromSheet(ficha enviada)`. Assim o "Completar e jogar" fica guardado como foi jogado (medida 9 da Escalação: "a escalação salva tem 11 aptos"). Se não mandou, `career.draft` fica como estava. As trocas feitas durante a partida não mudam a ficha, que é a de antes do apito.
- **Conciliação com o elenco:** `reconcileDraft(game, clubId, draft)`, em `app/src/lib/career/draft.ts`, é pura e idempotente. Id fora do elenco do clube vira `null`. A segunda ocorrência de um id repetido vira `null`. O banco é completado com `null` até `BENCH_SIZE`. As listas ficam só com titulares não nulos, sem repetição, e com no máximo 3 itens (decisão 1 do CEO na T-029; o limite é da tela, o motor aceita qualquer tamanho). Lesionado e suspenso ficam onde estão. Formação e tática não mudam. O `CareerService` concilia num ponto só, antes de toda gravação (`persist` e `setDraft`), e guarda em memória o resultado conciliado.

### 3. Gravação: no snapshot e, entre as rodadas, no registro da carreira

- **No snapshot.** Toda gravação de snapshot leva a ficha que está em memória, como parte do `CareerSave`. O arquivo exportado leva a ficha, e a importação a recebe pelo `full`.
- **Entre as rodadas.** `SaveStore.writeDraft(save, guard)` grava `draft: { seq, sheet }` no registro da carreira no store `careers`, numa transação só desse store. `seq` é o `guard.expectedHeadSeq`, o snapshot sobre o qual a ficha foi montada. A gravação recusa com `not-found` (carreira sem registro), `save-too-new` (registro de build mais novo), `conflict` (outra aba gravou) e `invalid-save` (a ficha não passa em `parseDraft` contra o elenco de `save.game`). Os erros de armazenamento são os mesmos do `writeSnapshot`. Não há releitura: perder a ficha custa só as edições desde a última gravação, e a abertura confere a ficha.
- **Ao abrir.** Depois de escolher o snapshot, migrar e conferir, o store usa a ficha do registro só se `draft.seq` for o `seq` do snapshot aberto e se ela passar em `parseDraft` contra o elenco desse save. Senão, vale a ficha do próprio snapshot, e `OpenedCareer.draftSkipped` diz por quê (`stale`, quando o `seq` não casa, como na volta para uma versão anterior, ou `invalid`). O `CareerService` registra `invalid` como linha `storage` (`draft-skipped`), sem conteúdo. `stale` não é erro.
- **Gravação de snapshot.** O registro novo de `careers` sai sem `draft`, porque a ficha está no snapshot. O desfazer do passo 3 (§4.2) já devolve o registro anterior inteiro, então a ficha volta junto. O `deleteCareer` já apaga o registro. O `listCareers` devolve o resumo sem `draft`.
- **Estrutura do banco.** Continua na versão 1: é um campo opcional num registro que já existe, sem índice. Uma aba de build antigo não grava por cima, porque o `schemaVersion` 2 do registro a faz recusar com `save-too-new`.
- **`CareerService.setDraft(draft)`.** Concilia, atualiza a memória e chama o `writeDraft` na fila serial do store. Se outra gravação de ficha estiver na fila, só a última é gravada. Com rodada ainda não gravada em memória (`unsaved`), a ficha fica só na memória e vai junto no "Tentar de novo".
- **Custo.** Cerca de 1 KB por edição. O snapshot cresce cerca de 0,6 KB. Nenhuma medição do §5 muda.

### 4. Versão 2 do save, migração, fixtures e testes

- `SAVE_SCHEMA_VERSION` passa a 2. `CareerSaveV2` é o `CareerSaveV1` com `schemaVersion: 2` e `career.draft?: DraftSheet`, e `CareerSave` passa a ser o `CareerSaveV2`. O arquivo exportado passa a começar por `PRANCHETA-SAVE 2`.
- **Migração** `app/src/lib/save/migrations/0001-coach-draft.ts` (`from: 1`): copia o save e tira `career.draft` se ele vier. Nenhum build v1 grava esse campo, então um v1 com ele é arquivo editado, e a importação aceita só o que o jogo poderia ter gerado (nota de 2026-11-06 no ADR-0006). A migração não tenta montar a ficha a partir do `lastSheets`: antes da T-029 a ficha do clube do técnico é sempre a sugestão do motor, então a tela mostrar a sugestão dá o mesmo resultado. A migração não toca nas súmulas. Por isso o save migrado, gravado sem `base`, regrava as linhas de `matchSheets` com o mesmo conteúdo, e os snapshots anteriores continuam com as súmulas (§4.2, "Gravação sem `base` numa carreira que já existe").
- **Fixtures.** Depois de subir a versão e escrever o passo, `npm run save:fixtures -w app` grava `__fixtures__/v2.json` e `__fixtures__/shape-v2.json`. O script nunca sobrescreve, então `v1.json` e `shape-v1.json` ficam como estão. A amostra da v2 (a mesma carreira da v1: temporada 2, rodada 2, clube 7) leva uma ficha com uma vaga livre no campo, uma no banco, uma lista com 2 nomes e postura e pressão diferentes da sugestão, para a forma registrar `null` nas vagas. Se o auxiliar de forma (`testing/shape.ts`) não souber descrever um `nullable`, ele ganha esse caso no mesmo PR.
- **Testes de migração e do formato:**
  - `v1.json` sobe a cadeia e passa no `full` da v2, sem `career.draft` e com a mesma rodada, o mesmo clube e a mesma tabela (o teste que já existe para cada fixture);
  - o passo `0001` não muda nada além de `schemaVersion`, e um v1 com `career.draft` sai sem ele;
  - `v2.json` passa no `full`, no `open` e no `write`;
  - um v2 aberto por um build v1 é recusado com `save-too-new`, sem alteração.

### 5. Virada da temporada e mudanças no elenco

| Situação                                                  | O que acontece com a ficha                                                                                                                                                                                         |
| --------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Titular ou reserva lesionado ou suspenso depois da edição | Fica na ficha. A tela mostra "lesionado (ou suspenso) escalado" e bloqueia o "Jogar rodada" até consertar, ou até o "Completar e jogar" trocar (`escalacao.md`, "Estados"). No realismo simplificado não acontece. |
| Aposentado na virada (`endSeason` tira do elenco, T-048)  | A conciliação na gravação do fim da temporada troca o id por vaga livre e o tira das listas. O snapshot da fase `seasonEnd` já sai coerente, antes de o `startNextSeason` tirar o jogador de `players`.            |
| Vendido ou emprestado (mercado, fora da 1a)               | A mesma regra: saiu do elenco, vira vaga livre e sai das listas. Nenhuma mudança neste ADR quando o mercado entrar.                                                                                                |
| Jovem promovido da base                                   | Não entra na ficha sozinho: aparece em "Não relacionados".                                                                                                                                                         |
| `startNextSeason`                                         | A ficha fica: formação, tática, titulares e listas, menos quem saiu. Condição, lesões e suspensões voltam a zero no motor, então só as vagas livres de quem saiu bloqueiam. Ver a decisão 2 do CEO, abaixo.        |
| Jogador que sai de `players` com o id ainda na ficha      | Não acontece: a conciliação roda antes de toda gravação, e a coerência do esquema recusa a gravação se o id não estiver no elenco (erro de programação, registrado).                                               |

### 6. O `ENGINE_VERSION` não sobe

O `GameState` não muda, então o digest dos goldens não muda. O `DraftSheet` e o `draftFromSheet` (T-075) e as leituras da T-076 não usam `Rng` e não são chamados por `newGame`, `prepareRound`, `simulateMatch`, `playRound`, `endSeason` nem `startNextSeason`. A opção `formation` do `suggestSheet` só é lida com `controller: 'human'`, que não cria `Rng`, e sem a opção a saída é a mesma de hoje. A regra de redistribuição da troca de formação passa a ser compartilhada entre a partida e o `reshapeLineup`, como refatoração. Se qualquer golden mudar num desses PRs, o defeito é do PR (ADR-0007, regra 7).

### 7. Limites do esquema e a invariante entre os três níveis

- **`career.draft`** é `exactOptional` e estrito: `formation` em `FORMATIONS`; `starters` com exatamente 11 itens (o tamanho das vagas de `FORMATION_SLOTS`), cada um `id` ou `null`; `bench` com até `BENCH_SIZE` (7) itens, cada um `id` ou `null`; cada lista com até 11 ids (o máximo de titulares distintos; o limite de 3 é da tela e da conciliação, não do formato); `tactic` com as 3 posturas de antes do jogo e as 3 pressões. Uma verificação no próprio esquema recusa id repetido entre titulares e banco e id repetido numa lista.
- **Coerência:** todo id da ficha (titulares, banco e listas) está em `game.squads[career.clubId]`; senão, `unknown-player`, com o caminho `career.draft.lineup.<parte>.<índice>`. A verificação entra em `writeIncoherence`, a parte da coerência que a gravação também roda.
- **Os três níveis usam o mesmo esquema e a mesma coerência.** A ficha é montada pela camada de aplicação, então é conferida inteira no `full`, no `open` e no `write`, como o apelido. O esquema `write` passa a ler `game.squads` (cerca de 500 ids, custo desprezível), para a coerência poder rodar na gravação. A busca de chaves de protótipo do `write` já cobre todo o `career`, menos `matchSheets` e `lastRound`, e por isso cobre a ficha.
- **`parseDraft(raw, squad)`** (`validate.ts`) usa o mesmo esquema, a mesma coerência e a busca de chaves de protótipo. É o que o `writeDraft` e a abertura chamam para a ficha do registro de `careers`.
- **Invariante "o que a gravação aceita, a abertura aceita".** Vale por construção, porque é a mesma função nos dois lados. Para a ficha do registro, a trava do `guard` garante que o elenco conferido na gravação é o do snapshot que a abertura casa pelo `seq`. O teste de propriedade da T-019 (§4.2, "Níveis de conferência do esquema", condição 1) passa a montar fichas por edições aleatórias conciliadas (vagas livres, inaptos, listas) em todas as rodadas que já confere, inclusive a fase `seasonEnd` e a rodada 1 da temporada seguinte, e confere cada save no `full`, no `open` e no `write`, e cada ficha no `parseDraft`.
- **Importação.** A ficha só tem ids, sem texto, e a coerência garante que eles resolvem. A conferência de conteúdo da T-073 não ganha caso novo.

### 8. Leituras do motor para a escalação (T-076)

O contrato completo está no §4.1, "Ficha em edição e leituras para a escalação". Resumo:

| Pedido (`funcoes.md`)  | Assinatura                                                                                                                   | Onde mora                        | Muda a simulação?                                                                           |
| ---------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------- | ------------------------------------------------------------------------------------------- |
| 2. `fitLevel`          | `fitLevel(natural: Position, slot: Position): FitLevel`, com `FitLevel = 'natural' \| 'improvised' \| 'outOfPosition'`       | `players.ts` (já existe)         | não: só muda a exportação                                                                   |
| 3. força da ficha      | `sheetStrength(state: ShownState, clubId, lineup: Pick<DraftLineup, 'formation' \| 'starters'>): SheetStrength \| undefined` | `strength.ts` (nova)             | não: leitura sem `Rng`, que a simulação não chama                                           |
| 4. troca de formação   | `reshapeLineup(state: LineupState, clubId, lineup: DraftLineup, formation: Formation): DraftLineup`                          | `draft.ts` (nova)                | não: a regra passa a ser compartilhada com a partida, e os goldens provam que ela é a mesma |
| 5. completar           | `completeSheet(state: LineupState, clubId, sheet: DraftSheet): TeamSheet`                                                    | `draft.ts` (nova)                | não: reusa `bestForSlot` e `pickBench`, sem `Rng`                                           |
| 6. sugerir na formação | `SuggestOptions.formation?: Formation`, lida só com `controller: 'human'`                                                    | `ai.ts`                          | não: sem a opção, ou com `controller: 'ai'`, a saída é a de hoje                            |
| 7. funções agora       | `sheetRoles(state: LineupState, clubId, lineup: DraftLineup): SheetRoles`                                                    | `draft.ts` (nova)                | não: reusa `pickCaptainAndTakers`, sem `Rng`                                                |
| 8. todos os problemas  | `sheetProblems(state: LineupState, clubId, sheet: DraftSheet): SheetCheck` e `isAvailable(player): boolean`                  | `draft.ts` (nova); `strength.ts` | não: leituras; o `isAvailable` é o mesmo que o `validateLineup` usa                         |

`LineupState` é `Pick<GameState, 'players' | 'squads'>`, o mesmo que o `validateLineup` lê.

## Consequências

- **Positivo:** recarregar a página mantém a ficha inteira. A ficha em edição tem a forma exata da tela, e a ficha válida tem um caminho só até o motor. O motor, os goldens e o `ENGINE_VERSION` não mudam, e a IA continua sem ver a ficha do técnico. Cada edição grava cerca de 1 KB, e o custo não cresce com o snapshot na Etapa 2. A tela deixa de repetir regras do motor (tabela de `fit`, troca de formação, capitão e cobradores, disponibilidade).
- **Negativo:** o formato sobe para a v2, com migração, fixture e forma novas. O registro de `careers` passa a guardar a ficha, além do resumo. O `CareerService` passa a conciliar a ficha antes de toda gravação. O contrato do motor ganha dois tipos de ficha e seis leituras.
- **Pendências:**
  - **T-075** (`developer`): tipos `DraftLineup` e `DraftSheet` e a função `draftFromSheet` no contrato do motor; save v2 (`schema.ts`, `validate.ts` com `parseDraft`, `migrations/0001-coach-draft.ts`, `__fixtures__/v2.json` e `shape-v2.json`); `SaveStore.writeDraft` e a ficha do registro na abertura; `CareerService.setDraft`, `reconcileDraft` e a ficha depois da rodada; testes acima.
  - **T-076** (`developer`): as leituras do item 8 no contrato, com os testes de propriedade do §4.1.
  - **T-029** passa a depender da T-075 e da T-076.

## Testes (com o `qa-engineer`)

- **Migração e formato:** os do item 4.
- **Store:** `writeDraft` e depois `openCareer` devolvem a ficha gravada; `writeDraft` com o `seq` antigo recusa com `conflict` sem mudar nada; ficha do registro com `seq` de outro snapshot é ignorada (`stale`), inclusive na volta para a versão anterior depois de um head corrompido; ficha do registro que não passa no `parseDraft` é ignorada (`invalid`), e a carreira abre com a ficha do snapshot; `writeSnapshot` deixa o registro sem `draft`, e o desfazer de uma conferência que falhou devolve a ficha do registro anterior; `writeDraft` não lê nem grava `snapshots` nem `matchSheets` (espião no banco de teste); `deleteCareer` some com a ficha; `listCareers` não devolve `draft`.
- **Carreira:** recarregar depois de `setDraft` devolve a mesma ficha (com o banco de teste, como o E2E 11 fará na tela); a ficha depois da rodada é a ficha enviada; o aposentado vira vaga livre na gravação do fim da temporada e sai das listas; `reconcileDraft` é idempotente; toda chamada a `writeSnapshot` e a `writeDraft` recebe ficha conciliada (espião); com `unsaved`, `setDraft` não chama `writeDraft`.
- **Propriedade:** a do item 7.
- **Motor:** os da T-076 no §4.1, e todos os goldens iguais.

## Conformidade

- A ficha em edição não entra no `GameState`. Campo de ficha do técnico no estado, ou a ficha em edição escrita em `lastSheets`, é BLOCKER na revisão.
- Função da simulação (`prepareRound`, `simulateMatch`, `playRound` e o resto da lista do item 6) que receba `DraftSheet` é BLOCKER. O motor recebe só `TeamSheet`, saída do `completeSheet` e conferida pelo `validateLineup`.
- A ficha só é gravada conciliada, e só pelo `CareerService` (`writeSnapshot` ou `writeDraft`). A tela não chama `lib/save` (o lint já proíbe).
- A coerência da ficha mora em `writeIncoherence` e em `parseDraft`. Uma segunda implementação dela em outro lugar é BLOCKER, porque quebraria a invariante entre gravar e abrir.
- Mudar a forma do `DraftSheet` ou um limite dele para menos é formato novo: `schemaVersion`, migração e fixture, como pede o ADR-0006.

## Decisões do CEO

1. **Aprovar este ADR**, com a ficha no envelope (`career.draft`), o formato v2 com a migração acima e a gravação entre as rodadas no registro da carreira. _Recomendação:_ sim. É a forma mais simples que guarda a ficha sem mexer no motor nem nos goldens e sem gravar 680 KB a cada toque.
2. **A ficha na virada da temporada.**
   - Opção A: a ficha fica. Formação, tática, titulares e listas continuam, e quem se aposentou vira vaga livre, com o aviso "Escalação incompleta" e o "Completar automaticamente" na primeira tela da temporada nova. Com cerca de 1,3 aposentadoria por clube por virada (§4.1, T-048), o aviso deve aparecer na maioria das viradas.
   - Opção B: a ficha some na virada, e a temporada começa com a sugestão do motor, como a rodada 1 da carreira. O técnico perde a formação, a tática e as listas que escolheu.
   - _Recomendação:_ A. Respeita a escolha do técnico, a tela já trata a vaga livre, e o resumo da temporada já mostra as despedidas. Nada muda sem o técnico ver.
