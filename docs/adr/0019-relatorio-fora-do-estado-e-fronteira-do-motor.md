# ADR-0019: Relatório da rodada fora do estado e `index.ts` como fronteira real do motor

- **Status:** Aceito (CEO, 2026-11-05)
- **Data:** 2026-11-05
- **Decisores:** project-auditor (apontou, `docs/reports/auditoria-2026-11-05/codigo.md`, achados 1, 2, 3 e 6), architect (mediu, propôs e redigiu, `docs/02-architecture.md` §4.1), CEO (aceitou as recomendações da auditoria em 2026-11-05, "recomendados": decisões 12 e 13 de `docs/reports/auditoria-2026-11-05/README.md`)
- **Complementa:** ADR-0006 (forma do envelope `CareerSaveV1`, antes do congelamento na T-019) e ADR-0007 (superfície pública do motor).
- **Substitui em parte:** ADR-0009 › "Estado", o trecho "`round_results` (RoundReport gzip, ...)": a tabela guarda o `RoundRecap` em gzip, não o `RoundReport`.

## Contexto

A auditoria de 2026-11-05 achou dois problemas no motor, os dois baratos de corrigir agora e caros depois que o formato do save congelar na T-019 e o servidor da 1b passar a usar o motor.

1. **O `lastRound` pesa no estado.** Medido na fixture `state-engine-v9-round-6.json` (rodada 6, motor v9), o `GameState` tem 531 KB crus e 63,8 KB em gzip, e o `lastRound` ocupa 95 KB crus e 13,1 KB em gzip (18% do estado). Por partida, os eventos somam cerca de 5,3 KB, e os mapas por jogador que o `playRound` já aplicou em `players` e `seasonStats` somam cerca de 3,6 KB. Nenhum código do motor lê o campo: o `round.ts` só grava e o `season.ts` só apaga. No servidor da 1b, o gatilho é de 8 ms de CPU por rodada no `workerd` (§5 da arquitetura), o motor sozinho já gasta de 6,7 a 7,8 ms, e o estado é lido, serializado e comprimido em toda rodada.
2. **O `index.ts` não é a fronteira.** Ele reexporta cerca de 250 símbolos, muitos deles internos exportados para teste, enquanto o §4.1 assina cerca de 20 funções e os tipos. Fora do motor, `lib/`, `scripts/` e o site importam arquivos internos (`@engine/rng` em `lib/generators/names.ts`, `@engine/types` e `@engine/clubs` em `lib/generators/shield.ts`, `engine/math.ts` em `scripts/balance/robot.ts`, `engine/rng.ts` em `scripts/og.mjs`, e o alias `@engine` aberto no site). O lint só protege o sentido motor → fora. Uma renomeação interna quebraria quem está fora, e o servidor da 1b copiaria o padrão.

Junto, o motor ainda tolera estado sem `pastSeasons` (achado 6), que é trabalho de migração e cabe a `lib/save/migrations/`.

## Opções consideradas

Para o relatório da rodada (decisão 12):

| Opção                                                                                                                                            | Prós                                                                                                                                                                             | Contras                                                                                                                                                                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: o `lastRound` fica no `GameState`, só com `events`, `score`, `stats` e os campos pequenos (`motm`, `markers`, `attendance`)                   | mudança menor no motor; a carreira não guarda nada novo fora do estado                                                                                                           | economiza só 37 KB crus (7%) e 6,9 KB em gzip (11%): estado de 494 KB e 56,9 KB; o servidor continua carregando um dado que não usa, e duas vezes (estado e `round_results`) |
| B: o `lastRound` sai do `GameState`; o motor oferece a forma enxuta (`RoundRecap`) e a camada de aplicação a guarda (carreira e `round_results`) | economiza 95 KB crus (18%) e 13,1 KB em gzip (21%): estado de 436 KB e 50,7 KB; o motor fica mais simples (o `playRound` já devolve o `report` e só deixa de copiá-lo no estado) | o envelope do save ganha `career.lastRound` e `career.matchSheets`; a carreira passa a ser responsável por zerar as súmulas na virada                                        |

Para a fronteira (decisão 13), a alternativa era deixar o `index.ts` como está e só exportar `exp` para o `/balance`. Ela foi descartada pelo mesmo motivo do achado: sem regra de lint, a fronteira continua sendo um comentário.

## Decisão

**Relatório: opção B.** Os motivos:

1. O `lastRound` é saída, não estado: nenhum código do motor o lê.
2. No servidor, o relatório já tem lugar em `round_results.report_gz` (§4.5). Com ele no estado, `league_states.state_gz` o levaria uma segunda vez.
3. A economia é 2,5 vezes a da A, na parte que pesa no gatilho de 8 ms. Descomprimir, ler, serializar e comprimir de 354 a 700 KB mediu de 10 a 21 ms no Node, então cortar 18% do estado deve poupar de 2 a 4 ms por rodada, contra cerca de 1 ms da A. É estimativa; a T-059 mede no `workerd`.
4. O motor fica mais simples.

O contrato (§4.1, "Relatório da rodada fora do estado"):

- o `GameState` perde o `lastRound`. O `playRound` continua devolvendo `{ state, report }` com o `RoundReport` inteiro, que a tela e o conteúdo usam na hora. O `startNextSeason` deixa de apagar o campo;
- `roundRecap(report)` devolve a forma de guardar: por partida, `fixtureId`, `score`, `events`, `stats`, `motm`, `motmRating`, `markers` e `attendance`, mais os `facts`, sem os mapas por jogador e sem os `warnings`. Medido: 58 KB crus e 6,2 KB em gzip por rodada;
- **carreira:** `CareerSaveV1.career.lastRound?: RoundRecap` (§4.2), no mesmo snapshot do estado novo, para o resumo da rodada depois de reabrir o app;
- **liga online (1b):** `round_results.report_gz` guarda o `RoundRecap`, e `GET /leagues/:id/rounds` devolve `RoundRecap[]` (§4.3). O `league_states.state_gz` não leva relatório nenhum.

**Súmula também fora do estado.** A súmula de qualquer jogo já jogado (US-019) precisa de cartões com o minuto, substituições, lesões e a nota do melhor em campo, que o `MatchSummary` do `Fixture.result` não tem. Pôr esses eventos no `MatchSummary` levaria o `fixtures` de cerca de 230 KB para cerca de 1 MB cru no fim da temporada, de novo no estado do servidor. Por isso:

- `matchSheet(result)` guarda só os eventos de súmula (`goal`, `penaltyMissed`, `yellow`, `red`, `injury`, `substitution`) e a nota do melhor em campo. A súmula na tela é `Fixture.result` + `MatchSheet`;
- **carreira:** `CareerSaveV1.career.matchSheets: Record<FixtureId, MatchSheet>`, **só da temporada atual**, que o `CareerService` zera junto do `startNextSeason`. Medido: cerca de 22 KB crus e 2,1 KB em gzip por rodada, até cerca de 830 KB crus e 80 KB em gzip no fim da temporada;
- **gatilho do store próprio:** o snapshot do fim da temporada fica perto de 160 KB em gzip, dentro da faixa de 100 a 300 KB do §4.2, mas perto de 1,5 MB cru para serializar a cada rodada. A T-018 mede a gravação desse snapshot no Chromium com 4× de lentidão de CPU. **Se passar de 150 ms** (cerca de um terço da meta de 500 ms da rodada), o `matchSheets` vai para um store próprio do IndexedDB, gravado na mesma transação do snapshot, antes de a T-019 congelar o formato;
- **liga online:** a súmula sai do `round_results` da rodada, sem campo novo;
- a súmula de temporadas passadas fica de fora; nenhuma história a pede.

**Fronteira: o `index.ts` exporta só o contrato** (§4.1, "Fronteira do `index.ts`"):

- **contrato público:** os tipos que o §4.1 assina, `ENGINE_VERSION`, `Rng` e `seedFromString`, as funções do §4.1 (inclusive `roundRecap` e `matchSheet`) e as listas fechadas e faixas de campo que a interface e o esquema `valibot` da T-019 precisam ler;
- **API de ferramentas:** um bloco separado e comentado no `index.ts`, só para `scripts/` (o `/balance` e o `og.mjs`). Hoje é `exp`, mais o que a T-049 achar nos imports de `scripts/`. A lista fica escrita no §4.1, símbolo por símbolo, e símbolo novo nela passa pelo `architect`;
- **interno:** todo o resto sai do `index.ts` e continua descrito no §4.1 como regra do motor, não como contrato. Os testes do motor importam pelo caminho do arquivo;
- **lint:** em `lib/**`, `ui/**`, `scripts/**`, `site/**` e, na 1b, `server/**`, uma regra de importação restrita só aceita `app/src/engine/index.ts` ou `@engine` sem subcaminho, inclusive nos testes desses lugares. Só os arquivos de `app/src/engine/` importam internos. O site, além disso, só lê de fora de `site/` a lista fixa do §3.
- **ajuste da T-049 (architect, 2026-11-05):** a regra vale para todo `app/src/` fora do motor, inclusive `main.ts` e o código de produção de `app/src/data/`. A única exceção são os testes de `app/src/data/` (`*.test.ts`): são os testes de aceite do motor com os clubes reais, que não podem morar em `engine/` (o motor não importa `data/`) e precisam, como os testes do motor, de internos e de `engine/testing/`. Eles pegam do `index.ts` o que é do contrato e só o resto pelo caminho do arquivo. A exceção não abre a fronteira para quem é de fora: uma renomeação interna que os quebre quebra no mesmo `npm test` do PR que renomeia. As condições estão no §4.1, "Fronteira do `index.ts`".

A fronteira não muda nenhum resultado e, sozinha, não subiria a `ENGINE_VERSION`.

**Fim da tolerância a estado sem `pastSeasons`.** O motor assume `GameState` válido na forma atual. Saem a fixture `state-engine-v9-round-6.json` e o `legacy-state.test.ts`. Esse estado nunca foi save, então não há o que migrar; a tolerância a versões antigas fica só em `lib/save/migrations/` (T-019).

## Consequências

- **Positivo:** o estado cai 18% (21% em gzip) antes de o formato congelar e antes de o servidor existir; o servidor guarda o relatório uma vez só; a US-019 ganha súmula das rodadas anteriores sem engordar o estado; o servidor da 1b nasce importando só o contrato; renomear um interno do motor deixa de quebrar `lib/`, `scripts/` ou o site; o `valibot` da T-019 lê as faixas do motor em vez de redigitá-las.
- **Negativo:** o envelope do save ganha dois campos e a carreira passa a cuidar deles (gravar no mesmo snapshot, zerar as súmulas na virada); o snapshot do fim da temporada fica perto de 1,5 MB cru, o que pode levar a um store próprio (decidido pela medição da T-018); o resumo da rodada depois de reabrir o app lê o `RoundRecap`, sem os mapas por jogador.
- **Versão e goldens:** na T-049, a `ENGINE_VERSION` sobe para **13**, porque o digest do estado nos goldens de rodada e de temporada muda. A simulação é a mesma: os goldens de partida não mudam (o `report` do `playRound` é o mesmo), e quem regrava os goldens de rodada e de temporada confere que só sumiu o `lastRound`. A T-048 vem depois, com a 14.
- **Save:** sem migração. A forma muda antes do congelamento na T-019, e nenhum save existe ainda (`app/src/lib/save/` nasce na T-018). A fixture v1 da T-019 já sai com `career.lastRound` e `career.matchSheets`.
- **Pendências:**
  - T-049 (`developer`): tudo acima no motor, no lint e nos imports de `lib/`, `scripts/` e site, com os aceites da tabela do §7 (lint verde e teste provando que `@engine/rng` em `lib/` falha; estado sem `lastRound`; `RoundRecap` de uma rodada da Série A com até 8 KB em gzip e `MatchSheet` da rodada com até 3 KB em gzip). No mesmo PR, a lista da API de ferramentas é escrita no §4.1.
  - T-018: medir a gravação do snapshot do fim da temporada (gatilho de 150 ms) e, se passar, levar o `matchSheets` para um store próprio.
  - T-019: fixture v1 e teste de forma com os dois campos novos.
  - T-023 (`CareerService`): gravar `lastRound` e a súmula da rodada no snapshot da rodada e zerar `matchSheets` no `startNextSeason`.
  - 1b: `round_results.report_gz` com `RoundRecap` (§4.5) e `GET /leagues/:id/rounds` com `RoundRecap[]` (§4.3).

## Conformidade

- O `GameState` não tem `lastRound`; um teste da T-049 confere o estado depois do `playRound`. Campo de relatório ou de súmula de volta no `GameState` exige ADR novo.
- Importar arquivo interno do motor fora de `app/src/engine/` falha no lint (`npm run lint`), e um teste prova que a regra pega `@engine/rng` em `lib/`. Desligar a regra num arquivo é BLOCKER na revisão. A exceção dos testes de `app/src/data/` é a única (ajuste da T-049, acima); outra exceção exige ADR.
- Símbolo novo no `index.ts` precisa estar assinado no §4.1 (contrato) ou na lista da API de ferramentas; o revisor confere. Símbolo da API de ferramentas usado em `lib/`, `ui/`, `server/` ou `site/` é BLOCKER.
- `matchSheets` com súmula de temporada passada, ou leitura de estado sem `pastSeasons` dentro do motor, é BLOCKER; a tolerância a formatos antigos mora em `lib/save/migrations/`.
