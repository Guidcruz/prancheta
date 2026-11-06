# Status

Atualizado pelo Orquestrador e pelo `tech-writer` a cada merge. Último post do devlog: 2026-11-06 (Quem pode ser campeão?, aguardando merge; o anterior foi 2026-11-05, Semana 1). Última atualização: 2026-11-06 (T-071 feita, aguardando merge).

## Etapa atual: 1a — Série A (em andamento, motor completo)

A Etapa 0 (Dia 1) está concluída; o que resta dela são pendências do CEO, listadas abaixo. A tabela a seguir é o estado da Etapa 0.

### Etapa 0 — Dia 1

| Item                           | Estado     | Observação                                                                           |
| ------------------------------ | ---------- | ------------------------------------------------------------------------------------ |
| Documento de projeto           | feito      | congelado em `docs/PROJETO.md`                                                       |
| Design system                  | feito (v1) | artefato "Prancheta"; tokens em `design/tokens.json`                                 |
| Kit de agentes adaptado        | feito      | 14 agentes, 10 comandos, hook com travas do projeto e 74 casos de teste              |
| Auditoria do dia 1             | feita      | 50 achados; corrigidos os que não dependem de decisão; os outros estão abaixo        |
| Repositório no GitHub          | feito      | `Guidcruz/prancheta`, público, `main` protegida por ruleset (PR, CI `ci`, só squash) |
| Site no Cloudflare Pages       | feito      | `prancheta-ad1.pages.dev`; publica a cada merge na `main`, prévia por PR             |
| Domínio                        | pendente   | decisão do CEO; até lá `*.pages.dev`                                                 |
| Versão zero do jogo em `/jogo` | feito      | tela inicial com escudo, nome e botão                                                |
| Post "Dia 1"                   | feito      | `site/src/content/devlog/2026-11-03-dia-1.md`                                        |
| Nome no INPI                   | pendente   | CEO                                                                                  |
| Revisão jurídica dos escudos   | pendente   | CEO; antes do lançamento público, escudos de risco médio (ADR-0014)                  |
| Licença do código              | pendente   | CEO                                                                                  |

## Decisões pendentes do CEO (da auditoria do dia 1)

> 2026-11-04: no `/kickoff`, o CEO adiou os itens 4 a 8 (não bloqueiam o planejamento da Etapa 1); o item 9 ficou resolvido com o uso do `/kickoff` adaptado.

1. Caminho leve por PR, com a `main` protegida (aplicado como padrão; para voltar ao merge local, mudar o hook e o `/quick`).
2. Apagar branches só pelo CEO (aplicado: `ALLOW_BRANCH_DELETE=0`).
3. Fontes hospedadas no próprio site, sem Google Fonts (aplicado, por privacidade).
4. E-mail de suporte real (hoje vazio; a política de privacidade avisa) e domínio definitivo.
5. Manter nome e cidade do responsável na política de privacidade.
6. Publicar o nome "Prancheta" no site antes da conferência no INPI, ou esperar.
7. Licença do código.
8. ~~Confirmar que o alias de modelo `fable` existe na sua instalação do Claude Code (usado pelo `project-auditor`).~~ Resolvido: o alias funcionou na auditoria de 2026-11-05, feita pelo `project-auditor`.
9. ~~Versão adaptada do `/kickoff` (passo 0) antes do primeiro uso.~~ Resolvido em 2026-11-04.

## Decisões do CEO no `/kickoff` (2026-11-04)

Telas da 1a (`docs/design/telas/`):

1. Rótulo "promessa" para jovens de potencial alto: aprovado, só o rótulo, nunca o número (ajustar US-016).
2. Ícones próprios, desenhados pelo `art-director` (`/assets arte ícones`); até a aprovação, conjunto aberto provisório atrás do componente `Icon`.
3. Tipo de partida (animada, lances principais, só resultado) pode ser trocado durante a carreira, nas Preferências e ao jogar a rodada; o "Realismo" fica fixo após criar a carreira.
4. Substituído pelo [ADR-0015](adr/0015-patrocinio-desligado.md) (2026-11-04): patrocínio real desligado e não anunciado; só marcas fictícias no cenário; receita só com apoio voluntário.
5. Menu "Mais" fica no topo na 1a, com as mesmas entradas no pé da tela Clube; revisar na Etapa 3, quando o Mercado virar a 5ª aba.

## Decisões do CEO depois do merge do `/kickoff` (2026-11-04)

1. ADRs 0006 a 0010 aceitos; ADR-0011 aceito na opção A (`match.homeBase = 0.05`).
2. Dependências aprovadas: `valibot` (1a); `hono`, `@simplewebauthn/server` e `/browser` (1b); só de teste `@playwright/test`, `fake-indexeddb`, `@axe-core/playwright` (sem `fast-check`).
3. Ajustes no `CLAUDE.md`, CI e `docs/04-deploy.md` sugeridos pelo `architect` e pelo `qa-engineer` aprovados; entram no PR da tarefa que os usa.
4. Desempate da tabela pelos critérios da CBF, com sorteio pela semente no fim (P1).
5. Depois da rodada 38, nova temporada com os mesmos 20 clubes (P2); subida de 4 clubes fica para quando houver lista aprovada.
6. Demais perguntas do `product-manager` (P3 a P13) e do `qa-engineer` (Q1 a Q10): aceitas as recomendações dos documentos.

## Etapa 1a: andamento das tarefas

| Tarefa | Estado                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| T-001  | feita (PR #4 mergeado); fundações do motor                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| T-002  | feita (`GameParams`, `validateParams`, seis JSON em `app/src/params/`, `lib/params.ts`)                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| T-003  | feita (`ClubDef`, `validateClubs`, `app/src/data/`, `content:check`, `blocklist:hash`; 322 testes; `content:check` 107)                                                                                                                                                                                                                                                                                                                                                                                                  |
| T-004  | feita (gerador de nomes, listas `br`, exclusões, 469 hashes de atletas; 344 testes)                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| T-005  | feita (PR #10 mergeado); modelo do jogador no motor: `players.ts`, `testing/identity.ts`, `testing/players.ts`, golden `players.json`; 398 testes; `ENGINE_VERSION` segue 1                                                                                                                                                                                                                                                                                                                                              |
| T-006  | feita (`newGame`, `generateSquad`, formações, camisas realistas, joia, ídolo, `lib/generators/identity.ts` com rosto placeholder até a T-027)                                                                                                                                                                                                                                                                                                                                                                            |
| T-007  | feita (PR #15 mergeado; code review e QA aprovados; 517 testes, 518 com o completo de nomes): `fixtures.ts` com 380 jogos, `newGame` com `fixtures` e erro `'invalid-calendar'`, `ENGINE_VERSION` 2, `Rng.shuffle`                                                                                                                                                                                                                                                                                                       |
| T-008  | feita (PR #18 mergeado; code review aprovado): `strength.ts` com nota efetiva, forças de setor, fator casa, força exibida e vaga vazia; `ENGINE_VERSION` segue 3                                                                                                                                                                                                                                                                                                                                                         |
| T-009  | feita (PR #20 mergeado): `app/src/engine/match/`, goldens de partida, `ENGINE_VERSION` 4                                                                                                                                                                                                                                                                                                                                                                                                                                 |
| T-010  | feita (PR #21 mergeado): cartões, lesões, pênaltis e faltas, jogo encerrado, `ENGINE_VERSION` 5                                                                                                                                                                                                                                                                                                                                                                                                                          |
| T-011  | feita (PR #22 mergeado): IA pré-jogo, `suggestSheet`, `validateLineup`, `ENGINE_VERSION` segue 5                                                                                                                                                                                                                                                                                                                                                                                                                         |
| T-012  | feita (PR #24 mergeado): comandos na partida, IA em jogo, `ENGINE_VERSION` 7                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| T-013  | feita (PR #25 mergeado; code review e QA aprovados): `prepareRound`, `playRound`, `getStandings`, fatos da tabela, `ENGINE_VERSION` 9                                                                                                                                                                                                                                                                                                                                                                                    |
| T-014  | feita (PR #26 mergeado; code review aprovado em 2 rodadas e QA PASS): moral, forma, termômetro da torcida, "realismo simplificado", ídolo sempre titular, `ENGINE_VERSION` 10                                                                                                                                                                                                                                                                                                                                            |
| T-016  | feita (PR #28 mergeado): `npm run balance` com técnico-robô, regra "tirar o pé", "tudo no ataque" só a partir dos 60', `fans.reversion` 0,10, `ENGINE_VERSION` 11                                                                                                                                                                                                                                                                                                                                                        |
| T-015  | feita (PR #29 mergeado): `properties.test.ts` com as invariantes em 1.000 partidas e 30 temporadas (`PROPERTY_FULL=1`: 10.000 e 1.000) e golden novo `season-human-simplified`; `ENGINE_VERSION` segue 11                                                                                                                                                                                                                                                                                                                |
| T-017  | feita (PR #31 mergeado): `endSeason` e `startNextSeason` (prêmios, evolução e idade, títulos somados ao escudo, `strength` recalculada, temporada nova zerada), `npm run balance -- --chain N` com trava de deriva, `ENGINE_VERSION` 12                                                                                                                                                                                                                                                                                  |
| T-049  | feita, aguardando merge (decisões 12 e 13 da auditoria; ADR-0019): `lastRound` fora do `GameState` (`roundRecap`, `matchSheet`), `index.ts` de 347 para 174 símbolos (contrato de 152 e API de ferramentas de 22), lint `engineEntryOnly`, estado cerca de 16% menor, simulação igual (balance 200 temporadas idêntico à `main`), `ENGINE_VERSION` 13; QA PASS (1222 testes no app; `PROPERTY_FULL` 1319)                                                                                                                |
| T-069  | feita, aguardando merge (decisão 9 da auditoria): todo jogador gerado é brasileiro (`HOME_NATIONALITY_SHARE` 1, sorteio ainda consumido); goldens mudaram só nacionalidade, nome, rosto e `digest` (o `new-game` tinha 2 estrangeiros; 34 jogadores com nome e rosto novos); balance de 200 temporadas idêntico à `main` (39/39 metas); saves com `AR`/`UY` seguem válidos; `ENGINE_VERSION` 14                                                                                                                          |
| T-070  | feita, aguardando merge (decisão 16, "todos podem ser campeões"): escada com o fundo mais alto (Inter-Regional 64 → 65, Remador 63 → 64, Chapecão 62 → 64; soma 1.404), `clubStrengthSd` 1,5; metas de release novas no `/balance` ("todo clube campeão" em 1.000 temporadas e G4 do robô no mais fraco de pelo menos 2%, com `--robot weakest`); 200 temporadas, semente 1: 39/39 metas, campeão grande 86,0%; 1.000 temporadas: os 20 clubes com título, robô no Chapecão com G4 de 3,0%; nenhum golden do motor mudou |
| T-071  | feita, aguardando merge (decisão 17): na cadeia do `/balance` (`--chain`), o campeão pequeno vira informativo nas temporadas 2 e 3, como o grande e o fraco no G4 (decisão 15); a trava de deriva segue obrigatória; sem `--chain`, nada muda; a cadeia de 3 temporadas passa de 92 de 93 metas para 91 de 91                                                                                                                                                                                                            |

## Métricas da cadeia da T-017 (`--chain 3`, 3 temporadas, 600 carreiras)

Todas as metas obrigatórias dentro.

| Métrica                                                                | Valor medido  | Meta     |
| ---------------------------------------------------------------------- | ------------- | -------- |
| Força média da liga, mudança frente à temporada 1                      | +0,59 a +0,94 | até ±1,0 |
| Trava de deriva (grandes e não grandes, 4 mais fortes e 4 mais fracos) | +0,01 a +0,06 | até ±0,5 |

## Auditoria geral de 2026-11-05 (depois da T-017)

Relatórios em [`docs/reports/auditoria-2026-11-05/`](reports/auditoria-2026-11-05/README.md) (planejamento, código, qualidade e processo). Nenhum bug de jogo; achados em processo, CI, docs e código. O CEO aceitou todas as recomendações; as 14 decisões:

1. Fica a branch da sessão (o ambiente exige); nenhum commit novo enquanto houver PR aberto dela.
2. Um PR por tarefa; ADR, pesquisa e texto de site em PR próprio.
3. O relatório do code review e do QA vai como comentário no PR.
4. Em PR só de motor, o teste do CEO é a tabela de métricas e os riscos; teste manual "N/A, só motor".
5. O CI passa a rodar `/balance`, `dist.test` depois do build e `content:check` (`devops-engineer`); se o `/balance` passar de 3 min, 100 temporadas no PR e 200 na `main`.
6. `main` vermelha é prioridade zero, com PR `fix(ci)` próprio do `devops-engineer`, registrado aqui.
7. Prettier antes do commit; `npm run test:all` obrigatório também no caminho leve e no `/devlog`.
8. Meta "20 pontos mais forte vence cerca de 65%" vira a faixa de 62% a 68%, centro em 63% (ADR).
9. ~~Na 1a, jogadores só brasileiros; sul-americanos na Etapa 5.~~ Feito na T-069 (aguardando merge): `HOME_NATIONALITY_SHARE` 1, `ENGINE_VERSION` 14.
10. Meta da diretoria só como texto informativo na 1a, com critérios na US-025.
11. A vibração segue o `prefers-reduced-motion`.
12. ~~O `architect` emagrece o `lastRound` antes do congelamento do save (T-019).~~ Feito na T-049 (aguardando merge): o `lastRound` saiu do estado.
13. ~~O `index.ts` exporta só o contrato público, com regra de lint para quem importa o motor.~~ Feito na T-049 (aguardando merge): 174 símbolos e regra `engineEntryOnly`.
14. Ordem: correções da auditoria (docs e CI), depois o save (T-018, T-027, T-019), depois a T-048.

Este PR de docs aplica as decisões 1 a 4, 6, 7, 9, 10 e 11 e a limpeza dos documentos; o PR de CI (5 e 6) é do `devops-engineer`; 8, 12 e 13 ficam com o `architect` e o `game-designer`.

## Decisões do CEO em 2026-11-06 (T-070 e T-071)

16. Decisão 16: todos podem ser campeões (aprovada com "ok recomendado", as cinco recomendações; `docs/design/balance-targets.md`, decisão 16, e `docs/design/clubes-serie-a.md`, "Força").
    - Escada com o fundo mais alto: Inter-Regional 64 → 65, Remador 63 → 64, Chapecão 62 → 64 (soma 1.404); `clubStrengthSd` continua em 1,5.
    - Teto do campeão pequeno: 4%. Teto do grande: 90%.
    - Metas de release novas: "todo clube campeão" em 1.000 temporadas (semente 1) e G4 do técnico-robô no clube mais fraco de pelo menos 2% (`--robot weakest`). Comando: `npm run balance -- --seasons 1000 --seed 1 --robot weakest`.
    - A média ponderada 3/2/1 foi estudada e adiada para o lote de dezembro.
17. Decisão 17: na cadeia do `/balance`, o campeão pequeno passa a ser informativo nas temporadas 2 e 3, como o grande e o fraco no G4 (decisão 15); a trava de deriva continua obrigatória; sem `--chain`, nada muda (`docs/design/balance-targets.md`, decisão 17).

## Decisões do CEO em 2026-11-05 (T-017)

1. Decisão 13: lesões e suspensões terminam na virada; a moral leva metade do humor para o ano seguinte.
2. Decisão 14: a renovação mínima do elenco vira a T-048.
3. Decisão 15: metas da cadeia. Campeão grande e clube fraco no G4 são informativos nas temporadas 2 e 3; a trava de deriva é obrigatória. A decisão 17 (2026-11-06) inclui o campeão pequeno.
4. ADR-0017 aceito: efeito suspensivo fiel ao real.
5. Notas para a Etapa 2: rever lesões graves (que atravessam o ano) e suspensões entre temporadas, junto do STJD.
6. Auditoria geral feita logo depois do merge da T-017 (ver acima).

## Resultados da T-015 (testes de propriedade)

- Nenhuma invariante falhou, ou seja, nenhum bug encontrado no motor.
- Mutações de teste detectadas: 7 pelo `developer` e 8 de 9 pelo revisor; a 9ª foi coberta depois.
- Tempo: +5 a 8 s na suíte padrão; a versão completa (`PROPERTY_FULL=1`) leva cerca de 9 min e roda antes de cada release.
- Golden novo `season-human-simplified` (temporada com técnico humano no realismo simplificado); sem subir o `ENGINE_VERSION`.

## Decisão do CEO em 2026-11-05 (áudio essencial)

A P5 ("sem áudio de nenhum tipo na Etapa 1") foi trocada pelo **áudio essencial sem custo** (R$ 0, 0 crédito do ElevenLabs). Fonte: `docs/audio/lotes/2026-11-05-essencial.md`; o CEO aceitou todas as recomendações. O ADR-0016 está sendo escrito pelo `architect`. Requisitos atualizados: US-020, US-044, US-073, "Fora do escopo" e P5 em `docs/01-requirements.md`.

1. O som começa desligado, com a pergunta única "Quer ouvir o estádio?" na primeira partida.
2. A torcida é feita por síntese; gravação CC0 só se não convencer, ouvida e aprovada pelo CEO antes.
3. Entram em volume baixo: defesa difícil, substituição e "todo mundo no ataque".
4. O plantão grande tem som e o curto tem um bip baixíssimo, seguindo a preferência da US-074.
5. Botão de mudo sempre visível na tela de partida, mais os volumes nas Preferências (Geral, Efeitos, Torcida, Mudo).
6. O áudio é uma tarefa própria, depois da T-033.

Pendências derivadas:

- T-047, áudio essencial (depois da T-033): módulo `app/src/lib/audio/`, receitas por código, diretor puro testado em Vitest, página de bancada só em desenvolvimento, pergunta única, controles e botão de mudo, E2E com som mudo (todos os eventos visíveis).
- ADR-0016 (`docs/adr/0016-audio-essencial-sem-custo.md`) aceito; `docs/02-architecture.md` §4.6 traz o desenho do `app/src/lib/audio/`.
- Meta de peso: até 15 KB gzip de código e 300 KB de áudio no total, fora do precache da PWA.
- `developer`, na T-047: medir a CPU da torcida em celular fraco (meta: menos de 5% em segundo plano).

## Decisões e ideias do CEO em 2026-11-05 (T-015)

1. Súmula do jogo antigo: ver o que aconteceu numa partida já jogada (US-024, já nos requisitos).
2. Impedimento e VAR, e perfil de arbitragem: já registrados em "Ideias registradas para etapas futuras", para depois da Etapa 1a.

## Métricas finais da T-016 (3 sementes de 200 temporadas)

36 de 36 metas obrigatórias dentro em cada semente; as 3 metas raras dentro no total das 3.

| Métrica                      | Valor final | Meta      |
| ---------------------------- | ----------- | --------- |
| Gols por jogo                | 2,64        | 2,5–2,8   |
| Goleadas                     | 12,3%       | 8–13%     |
| Vermelhos por jogo           | 0,18        | 0,11–0,25 |
| Zebra por 30 pontos          | 8,3%        | 8–12%     |
| Mais forte por 20 pontos     | 62,8%       | —         |
| Campeão (pontos)             | 75          | 72–82     |
| 17º colocado                 | 40          | 39–45     |
| Técnico-robô (por temporada) | +4,2 pontos | —         |

## Decisões do CEO em 2026-11-05 (T-016)

1. Recomendações aceitas: `kChance` 0,125, "tudo no ataque" mais forte, "grande rebaixado" só informativo na temporada única e metas raras julgadas com 3 sementes.
2. "Tudo no ataque" só pode ser usado a partir dos 60'.
3. Texto de instalação do site para Android e iOS.

Pendências derivadas:

- `devops-engineer`: ~~ligar o `/balance` no CI~~ (feito: 200 temporadas, semente 1, PR e `main`). Falta medir o tempo real no runner de 2 vCPU; se passar de 3 min, o CEO decide a medida.
- Gatilho de reavaliação do "tudo no ataque" (`docs/design/balance-log.md`): repetir a medição se a média das 3 sementes passar de +0,04 ou se mexerem em `allOutPower`, `allOutDef`, `allOutFromMinute`, `kChance` ou no cansaço.
- "Grande rebaixado" volta a valer como meta na carreira longa.

## Dados da temporada (T-013, 20 temporadas)

| Métrica          | Valor atual | Meta    |
| ---------------- | ----------- | ------- |
| Campeão (pontos) | 73,8        | 72–82   |
| 17º colocado     | 41,1        | 40–46   |
| Gols por jogo    | 2,77        | 2,5–2,8 |
| Trocas por time  | 3,5         | 3–4     |

## Dados da temporada (T-014, 100 temporadas)

| Métrica                 | Valor atual | Meta         |
| ----------------------- | ----------- | ------------ |
| Termômetro (média)      | 53,6        | 50–60        |
| Termômetro (desvio)     | 18,2        | acima de 15  |
| Termômetro abaixo de 20 | 4,4%        | —            |
| Termômetro acima de 90  | 1,8%        | —            |
| Campeão (pontos)        | 77,4        | 72–82        |
| 17º colocado            | 39,8        | 39–45 (novo) |
| Gols por jogo           | 2,770       | 2,5–2,8      |
| Tempo por rodada        | 7 ms        | —            |

Regressão: 988 testes passando e 1 pulado.

## Decisões do CEO em 2026-11-05 (T-014)

1. Meta do 17º recentrada em 42, de 39 a 45.
2. Topo da tabela mantido como está, sem deixar os favoritos mais dominantes (hoje o mais forte é campeão em cerca de 24% das temporadas e algum dos 3 favoritos termina na metade de baixo em 26%).
3. Placar e tabela ao vivo da rodada na tela de partida, no estilo TV: plantão curto em todo gol, plantão grande no gol que mexe com o técnico, tabela no intervalo e no fim, e opção nos ajustes. Registrada como US-070 a US-074 (Should, 1a); duas perguntas abertas para o CEO (G4 ou zona da Libertadores no plantão; "como ficou" também no modo só resultado).
4. O devlog pode citar inspirações reais, como campeonatos e jogos, como referência.

Pendências derivadas:

- T-016 (feita, ver abaixo): `fans.reversion` 0,10; medir a fuga do Z4 (meta de 15% a 30% dos que estão no Z4 na rodada 30 se salvarem; hoje cerca de 20%); reconferir "grande rebaixado" (95%, fora da meta de 40% a 80%) e "pequeno campeão" (3,5%, acima de 3%); medir a métrica nova "time pequeno no G4" (uma zebra positiva, aprovada pelo CEO em 2026-11-05), com a meta em `docs/design/balance-targets.md`.
- T-017: recalcular a `strength` dos clubes na virada da temporada.
- T-059 (online): as 3 regras de servidor para `fanDecisions` e a fronteira de `app/src/content/` para os valores da entrevista.

## Decisões do CEO em 2026-11-05 (T-013)

1. Notícias novas "perdeu a invencibilidade" e "acabou o jejum" aprovadas.
2. Plano dos Workers na 1b: começar no gratuito, com medição; o pago só se a rodada passar de cerca de 8 ms. O `architect` mediu que só abrir e gravar o estado leva de 9 a 21 ms, então o pago é provável.

## Decisões do CEO durante a T-003 (2026-11-04)

1. Porte por títulos, história e torcida: 12 grandes, 5 médios, 3 pequenos.
2. Força pela tabela do Brasileirão 2026 parcial (33ª rodada), numa escada única de 20 degraus, separada do porte.
3. Lote refeito em dezembro com a tabela final.
4. Atualização anual dos dados (US-066 a US-069).
5. Títulos da carreira somam ao histórico do clube (T-017/T-018).
6. O porte pode crescer dentro da carreira (Etapa 4).
7. Metas de balanceamento ajustadas.

## Decisões do CEO durante a T-004 (2026-11-04)

1. Lote de nomes aprovado com ajustes: itens ofensivos e de pessoas notórias removidos, origens inventadas, diminutivo ligado ao prenome.
2. Metas de placar: 0×0 de 6% a 9%; goleada de 8% a 13%; diferença de 5 ou mais gols de 0,5% a 2%.
3. ADR-0012 aceito: nome e rosto resolvidos ficam no estado e no save; nome retirado também sai dos saves antigos.
4. Exceção à regra de nomes reais: documentos de trabalho em `docs/` podem citá-los só como referência; no jogo, código, dados e site a regra continua absoluta.

## Decisões do CEO sobre o site novo (2026-11-04)

Desenho (`docs/design/site.md`) e textos (`docs/content/site/`) aprovados, com 8 decisões:

1. "Série A" no lugar de "Brasileirão".
2. Só exemplos de clubes.
3. Nome provisório numa linha.
4. Discussions do GitHub via `contacts.discussionsUrl`.
5. Sem citar advogado.
6. Tema dia, seguindo o sistema.
7. Tokens `layout`.
8. `@astrojs/sitemap`.

Implementado e publicado (PR #12; correções no PR #13 e no PR da T-006).

## Decisões do CEO em 2026-11-04 (T-006 e liga online)

1. Camisas realistas nos elencos, desenhadas pelo `game-designer`.
2. ADR-0013 aceito: liga da 1b com até 20 humanos, um por clube; liga online com Séries A e B antecipada para a Etapa 2.
3. Site com "Até 20 (um técnico por clube da Série A)" no tamanho da liga.
4. Site novo entregue (implementação do desenho aprovado), com correção dos espaços em volta de elementos inline.

## Decisões do CEO em 2026-11-04 (calendário, nomes, site e escudos)

1. Nomes, revisão 2: listas revisadas pelo CEO, origens curtas, limite de 22 caracteres no nome de exibição, exclusões regeneradas.
2. ADR-0013 revisado: liga ao vivo até 8 humanos; assíncrona até 20 por divisão. O site usa esses números.
3. Descrições curtas para compartilhar aprovadas (clubes: "Clubes com trocadilho").
4. Site: escolhida a direção visual A "Noite de estádio", com os toques recomendados; especificação em `docs/design/site.md` (em escrita pelo `ux-designer`).
5. Escudos: estilo A v5 (Brasão) escolhido e implementado; ADR-0014 aceito.

## Perguntas abertas para a Etapa 2

1. **No online, o que acontece quando um técnico humano é rebaixado?** (pergunta do CEO)
   - A: liga com Séries A e B; quem cai joga a B na mesma liga.
   - B: liga só da Série A; quem cai assume um dos clubes que subiram.
   - C: liga só da Série A com rebaixamento desligado.
   - Recomendação do Orquestrador: o dono escolhe ao criar a liga entre "Série A e B" e "Só Série A"; na "Só Série A" ele também escolhe se o rebaixamento vale (B como alternativa). Na carreira offline, cair é jogar a Série B.

## Observações do QA para revisar depois

- Nomes de exibição longos: tratar a truncagem na tela do elenco (T-028).
- Alguns nomes lembram pessoas notórias (ex.: "Cartola", "Dudek", "Carlos Alberto"): revisão de conteúdo.
- Estrangeiros saem com nome brasileiro até existir a lista em espanhol.

## Pendências abertas

- ADR da Etapa 4 para a meta da diretoria pela força.
- Consulta ao advogado sobre espelhar dados reais (tabela e títulos).
- Lote de dezembro com a tabela final.
- ADR da faixa de 62% a 68% para "20 pontos mais forte" (decisão 8 da auditoria).

## Dívida técnica (achados do security-auditor)

- M1 (resolvido por este PR): a política prometia apagar mensagens de suporte em 90 dias, mas o canal publicado são as Discussões do GitHub (público, de terceiros). Textos de Privacidade, Perguntas e rodapé corrigidos.
- L1: `scripts/og.mjs` não limpa a pasta temporária em SIGINT/SIGTERM.
- L2: criar `_headers` do Cloudflare Pages (CSP, `X-Content-Type-Options`, `Referrer-Policy`, `frame-ancestors`) antes da Etapa 1b.
- L3: ações do CI fixadas por SHA (feito no PR de CI de 2026-11-05). Falta só a imagem do devcontainer por digest.

## Concluído (mergeado em 2026-11-04)

- PR #24: T-012 mergeada (comandos na partida e IA em jogo; `ENGINE_VERSION` 7).
- PR #23: Node no Codespace.
- PR #22: T-011 mergeada (IA pré-jogo, `suggestSheet`, `validateLineup`; `ENGINE_VERSION` segue 5).
- PR #21: T-010 mergeada (cartões, lesões, pênaltis e faltas, jogo encerrado, `ENGINE_VERSION` 5).
- PR #20: T-009 mergeada (núcleo do `simulateMatch`, goldens de partida, `ENGINE_VERSION` 4).
- PR #19: ADR-0015 (patrocínio desligado) e textos do site e do jogo sem patrocínio.
- PR #16: site na direção A "Noite de estádio" e escudos v5 (ADR-0014).
- PR #17: privacidade e canal de suporte (correção do achado M1).

Entregas do PR #16:

- Site na direção A "Noite de estádio": componentes e páginas novos, imagens de compartilhamento por `scripts/og.mjs`, tabelas que viram cartões no celular.
- Gerador de escudos estilo A v5 (`shield.ts`): silhuetas, padrões, símbolo da cidade, estrelas douradas (Série A) e prateadas (Série B). ADR-0014 aceito.
- Campos de escudo em `ClubDef` (`crestShape`, `crestPattern`, `crestBase`, `crestSymbol`, problema `invalid-crest`) e `ENGINE_VERSION` 3.
- ADR-0013 revisada: ao vivo até 8, assíncrona até 20 por divisão, Série A+B na Etapa 2.
- Tokens novos: `body-lg`, `sticker-name`, `sticker-name-long`, `stage-number`; mínimo de `type-display-xl` em 64px.
- Textos aprovados em `docs/content/site/complementos.md`.

## Métricas da partida (T-012, com comandos e IA em jogo) contra as metas

| Métrica                  | Valor atual | Meta      |
| ------------------------ | ----------- | --------- |
| Gols por jogo            | 2,77        | 2,5–2,8   |
| 0×0                      | 6,5%        | 6–9%      |
| Empates                  | 24,6%       | —         |
| Mandante                 | 47,8%       | —         |
| Goleada                  | 14,5%       | 8–13      |
| Amarelos por jogo        | 4,42        | 3,5–4,5   |
| Vermelhos por jogo       | 0,32        | 0,11–0,25 |
| Lesões por jogo          | 0,31        | —         |
| Mais forte por 20 pontos | 65,3%       | —         |
| Zebra por 30 pontos      | 7,5%        | 8–12      |
| Trocas por time          | 3,52        | 3–4       |

Notas:

- Os vermelhos seguem acima da meta; a proposta do `game-designer` para a T-016 é `cards.bookedMult` 0,20.
- Diagnóstico das goleadas: não vêm da T-012; até entre times iguais elas dão 12,7%. A solução está na T-016: a regra "tirar o pé" e depois `baseChance` 0,087.

## Decisões do CEO em 2026-11-04 (T-012)

1. A regra "tirar o pé" (quem ganha por 2 ou mais ataca 15% menos) vai para a T-016.
2. Meta de 3 a 4 trocas por time.
3. `ai.subEnergy` 85 (era 65).

## Decisões do CEO em 2026-11-04 (T-009)

1. Fator casa também na finalização (chute e goleiro do mandante); nota no ADR-0011.
2. Marcador "estreia" só para os jovens no início da carreira (quem nunca jogou pelo clube).

## Decisões de design em 2026-11-04 (T-011)

1. Rotação só com reserva descansado.
2. Banco com 1 goleiro e 6 de linha.
3. Clube humano sem ficha é lido como Tradicional.
4. Formador sempre com pressão alta, mantido como identidade do perfil.

## Em andamento

- Correções da auditoria de 2026-11-05: este PR de documentação; em seguida o PR de CI do `devops-engineer`.

## Concluído em 2026-11-04 (T-008 e patrocínio)

- PR #18: T-008 mergeada (força por setor, nota efetiva, mando com termômetro e força exibida). `ENGINE_VERSION` segue 3.
- ADR-0015 aceito pelo CEO: patrocínio real desligado e não anunciado; marcas fictícias só como cenário; receita só com apoio voluntário.
- Textos do site sem patrocínio e sem "em público" aprovados pelo CEO e aplicados no `site/` e nos três idiomas do jogo.

## Decisões novas do CEO em 2026-11-04 (patrocínio e marca)

1. O patrocínio fica como possibilidade futura, desligada e não anunciada.
2. O jogo e o site mostram só marcas fictícias no cenário.
3. A receita vem só do apoio voluntário.
4. O ADR e os ajustes do site vieram depois do PR da T-008: ADR-0015 aceito e textos aplicados.

**Marca:** o CEO avalia lançar sem registro no INPI. Recomendação: fazer pelo menos a busca gratuita antes do lançamento.

## Pendências de conteúdo

- Textos das duas notícias novas ("perdeu a invencibilidade" e "acabou o jejum") e do "primeiro líder" (`leadership took` na rodada 1).
- Juntar os artilheiros empatados numa nota só ("dividem").
- Filtrar as cerca de 14 suspensões por rodada: só as do clube do técnico e do próximo adversário.
- O `content-writer` vai precisar de um template de jogo encerrado (W.O.), usado quando `fulltime.abandoned` for verdadeiro.

## Pendências do CEO

- Consulta no INPI do nome "Prancheta" e dos nomes de risco médio.
- Advogado: espelhamento anual de dados reais (tabela e títulos) e os 5 escudos de risco médio da ADR-0014.
- Domínio definitivo (bloqueia a US-047).
- Quem trata as denúncias e em quanto tempo (bloqueia a US-065).
- Comentários nos posts do devlog: estudo parado em 2026-11-06, nada decidido; rascunhos e decisões pendentes em `docs/research/comentarios-devlog/`.

## Ideias registradas para etapas futuras

Pedidas pelo CEO; não mudam nada agora. O `game-designer` detalha quando a etapa chegar, e as regras passam pelo CEO antes de virar ADR ou requisito.

- **Técnico interino e período sem técnico (Etapa 4, registrado em 2026-11-04):** quando um clube demite o técnico, o auxiliar assume como interino por 1 a 3 rodadas e joga no perfil "Tradicional"; "efeito técnico novo" com ganho de moral nos primeiros jogos; notícias e posts ("fulano é o interino", "diretoria busca nome no mercado"); no modo "técnico livre", o técnico humano demitido fica desempregado algumas rodadas até receber proposta. Vale para os clubes da IA e para o clube do técnico humano.
- **Post "Quem pode ser campeão?" (devlog, sugestão do CEO para o post da próxima semana, registrado em 2026-11-05):** chance de título por clube em 1.000 temporadas, por que o mais forte nem sempre ganha, zebras e arrancadas contra o rebaixamento, o projeto de longo prazo do clube médio e a comparação com o campeonato real. Números em `docs/design/balance-targets.md`, decisões 8 a 11.
- **Perfil do clube que muda com o tempo (Etapas 3 e 4, registrado em 2026-11-05):** hoje o perfil é sorteado no início da carreira e fica fixo. Na carreira longa ele passa a mudar com a diretoria, que é quem o define: eleição a cada 3 temporadas (uma chapa nova pode trocar o perfil, com notícia e conversa com a diretoria), crise financeira (o clube endividado vira Vendedor por algumas temporadas) e subida de porte (puxa para o lado mais ambicioso, como já prevê `docs/design/temporada.md`). No máximo uma troca a cada 3 temporadas, sempre anunciada no jornal. Ajuda na meta de estabilidade da liga (`docs/design/balance-targets.md`, decisão 11).
- **"Mostrar a tabela" na conversa do intervalo (a avaliar depois da T-016, registrado em 2026-11-05):** quarta opção da conversa do intervalo, com efeito que depende da tabela ao vivo: motiva quando o resultado parcial favorece o clube e pressiona quando não, ajudando ou travando jogadores conforme o temperamento. Mexe no motor: precisa de regra do `game-designer` e de calibragem. A parte só de texto (as conversas citam a tabela) já é critério da US-071 (D11).
- **Técnicos da IA com nome e qualidade (Etapa 4, registrado em 2026-11-05):** cada clube da IA passa a ter um técnico com nome gerado e uma qualidade que muda o rendimento do time (o técnico-robô da T-016 mostrou que um bom técnico vale cerca de +4 pontos por temporada). As demissões seguem a regra do `PROJETO.md` (barra de confiança de 0 a 100, meta pela força, paciência pelo porte, ritmo pelo perfil; o "Caótico" troca mais), com o interino do item acima. Contratar bem faz um clube subir; errar faz um grande afundar. Gera histórias para o jornal e ajuda a meta de estabilidade da liga (campeões que mudam ao longo das décadas).
- **SAF também nos clubes da IA (Etapa 4, registrado em 2026-11-06):** hoje só o clube do técnico recebe a oferta de SAF (`docs/PROJETO.md`, "Estrutura do clube"); a ideia é que um clube da IA também possa virar SAF e investir muito, criando rivais que crescem do nada e mudando a briga pelo título ao longo dos anos, o que ajuda o "todos podem ser campeões" na carreira longa. Pontos de equilíbrio (frequência, teto de investimento, saída do investidor e as metas de "Estabilidade da liga" e "Projeto do clube médio") em `docs/design/brasilidades.md`, logo abaixo do item da SAF. Mudar a regra do `PROJETO.md` é ADR.
- **Impedimento e VAR (depois da Etapa 1a, junto das brasilidades, registrado em 2026-11-05):** como eventos da partida, sem simular posição: (1) gol anulado por impedimento, com chance ligada à tática (linha alta pega mais impedimento, mas quem escapa sai na cara do goleiro); (2) VAR que revisa gol, pênalti e expulsão, podendo confirmar, anular ou marcar pênalti não dado, com a pausa "VAR revisando…" na transmissão; (3) polêmica: o CEO destaca que o VAR vira notícia e discussão na rede social do jogo, e mexe no termômetro da torcida. Mexe em gols, pênaltis e vermelhos já calibrados na T-016: precisa de regra do `game-designer`, templates do `content-writer` (aprovados pelo CEO) e nova rodada de `/balance`.
- **Perfil de arbitragem (mesmo pacote do impedimento e do VAR, registrado em 2026-11-05):** cada jogo tem um árbitro com nome fictício gerado pelo jogo (nunca de árbitro real) e um perfil, mostrado antes da partida com os números dele na temporada (cartões, pênaltis, expulsões): Rigoroso (mais cartão e pênalti), Deixa jogar (menos falta e cartão, jogo mais pegado), Caseiro (leve tendência ao mandante com estádio cheio, igual para todos os clubes) e, com o VAR, "usa o VAR toda hora". Vira decisão tática (pressão alta e pendurados contra árbitro rigoroso) e notícia ("árbitro polêmico volta a apitar clássico"). A escala sai do sorteio com a semente, para todos verem o mesmo árbitro no online. Os perfis se compensam para a média da liga continuar nas metas da T-016. Versão leve possível antes: só o perfil mexendo na chance de cartão.

## Próximo

1. T-018, T-027 e T-019 (save).
2. T-048 (renovação mínima do elenco).
3. `PROPERTY_FULL=1`, `NAMES_FULL_CHECK=1` e `npm run balance -- --seasons 1000 --seed 1 --robot weakest` antes de release.
4. Lista de nomes em espanhol (estrangeiros ainda saem com nome brasileiro; na 1a só brasileiros).
5. Placar e tabela ao vivo da rodada (US-070 a US-074).
6. Lote de clubes de dezembro, com a tabela final de 2026.
7. Áudio essencial (T-047, depois da T-033; ver a decisão de 2026-11-05).
