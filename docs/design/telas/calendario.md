# Calendário

**Histórias:** US-024 (e a súmula de jogo já jogado da US-019) · **Prioridade:** Must · **Ordem:** 11 · **Tarefa:** T-084 (parte 2 da T-031 planejada, ver "Divisão" em [tabela.md](tabela.md#divisão-em-duas-tarefas))

## Objetivo

Ver as 38 rodadas do clube, com o que vem e o que já foi, para planejar a rotação e rever a campanha.

## O que o jogador faz

Abre a aba Calendário, que já mostra a próxima rodada; rola para trás para rever os resultados e para frente para ver os próximos adversários, o mando e os clássicos. Toca numa rodada jogada para ver os 10 resultados dela e, em cada jogo, a súmula (autores dos gols, cartões, trocas, melhor em campo, números).

## Divisão

Decisão do CEO de 2026-11-14 (decisão 1 de [tabela.md](tabela.md#decisões-do-ceo-t-031)): a T-031 planejada foi dividida em duas M. Tudo nesta spec é da T-084, que vem depois da T-031 e depende da T-083 (a folha da súmula), não da T-031.

## Navegação

| Tela                 | Endereço             | Como chega                                                                                                           | Como sai                                                                                                                                |
| -------------------- | -------------------- | -------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| **Calendário**       | `#/calendar`         | TabBar; card do próximo jogo e link "Calendário" do Clube (hoje vão ao Placeholder); voltar do navegador             | Abas; toque numa rodada jogada                                                                                                          |
| **Rodada** (subtela) | `#/calendar/round/N` | Toque no card de uma rodada jogada (entrada nova no histórico); voltar ou avançar do navegador                       | Voltar do cabeçalho (`nav.back`; `history.back()`, ou `replaceState` no endereço digitado) ou voltar do celular, de volta à lista; abas |
| **Súmula** (folha)   | (o mesmo da Rodada)  | Toque num jogo da Rodada: a folha da T-083 (`MatchReport`), com entrada própria (`pushSheet('report', { fixture })`) | X, voltar do celular ou toque no fundo: fecha e fica na Rodada, com o foco no card que a abriu                                          |

- **A Rodada é uma subtela da aba, não uma folha** (decisão 1 do CEO): a súmula já é uma folha e abre por cima dela; folha sobre folha deixaria o voltar confuso. A Rodada fica dentro da moldura: TabBar com Calendário ativo, "Jogar rodada" flutuante, cabeçalho com o voltar à esquerda, o título `round.title` ("Rodada 5") e o ícone "Mais".
- **O voltar do cabeçalho** faz `history.back()` quando a entrada da Rodada foi criada pelo toque num card da lista (marcada no `history.state`), também quando o jogador volta a ela pelo voltar ou pelo avançar do navegador: a entrada de baixo é sempre essa lista. Só num endereço digitado ou colado (entrada sem a marca) ele troca o endereço por `#/calendar` com `replaceState`, sem entrada nova, e a lista mostra o card daquela rodada, focado. (Ajustado na revisão de interface da T-084, em 2026-11-15: a versão anterior pedia `replaceState` também na chegada pelo "avançar", o que duplicaria a lista no histórico.)
- **Endereço que não vale:** `#/calendar/round/N` com N fora de 1 a 38, que não é número, ou de uma rodada ainda não jogada nesta temporada vira `#/calendar` com `replaceState` (sem entrada nova). Depois de uma virada de temporada (T-037), um endereço antigo mostra a rodada N da temporada atual, se já jogada.
- **De volta à lista**, ela mostra o card da rodada de onde o jogador voltou (rolada até ele, com o foco nele), e não a próxima rodada. Só a abertura pela aba, pelo Clube ou por um endereço novo vai à próxima rodada. O endereço da lista não muda; o `developer` guarda a rodada de origem (no `history.state` da entrada da lista, por exemplo).
- **"Jogar rodada"** na lista ou na Rodada: o resumo abre por cima, e "Continuar" volta ao mesmo endereço (a lista abre na próxima rodada nova; a Rodada mostra a mesma rodada de antes).
- **Recarregar e reabrir a carreira** continua abrindo no Clube (decisão 3 da T-030). As entradas `#/calendar/round/N` e a da súmula ficam no histórico, e o voltar as mostra de novo, como já acontece com o `#/round` (aceito pelo CEO em 2026-11-14): a rodada mostrada é a verdadeira, e a súmula reabre pela entrada dela, como no resumo.

## Conteúdo da lista (de cima para baixo, no celular em pé)

1. **Cabeçalho** (ScreenHeader da moldura): "Calendário".
2. **Faixa de avisos** da moldura.
3. **1º turno** (`section` com `h2` `calendar.half.first`, em `subtitulo`) e **2º turno** (`calendar.half.second`): o separador entre os turnos é o título da seção. Cada seção é uma lista (`ol`) de 19 MatchCard, um por rodada, na ordem da rodada.
4. **Cada card** (MatchCard, o mesmo do Próximo jogo do Clube):
   - linha de cima: `club.next.meta` ("Rodada 5 · dom., 10 de mai."), data por `Intl.DateTimeFormat` do idioma (`matchDate`, como no Clube);
   - mandante em cima e visitante embaixo, com escudo e nome curto, o meu clube em negrito; nas jogadas, os gols de cada lado (`Fixture.result.score`, o placar dado);
   - pé: o mando do meu clube em texto (`match.venue.home` ou `match.venue.away`); o selo "Clássico" (`match.derby`) quando o adversário está nos `rivals` do meu clube; nas jogadas, o selo do resultado com a palavra inteira (`win`, `draw` ou `loss` com `result.*`; decisão 3 do CEO); no jogo encerrado, a nota `match.abandoned.short`;
   - **jogada:** o card é um botão (≥ 44px, com a seta à direita) que abre a Rodada, com o nome acessível `calendar.match.open`;
   - **ainda não jogada:** o card é só leitura (o `div` do MatchCard, sem seta e sem foco);
   - **a próxima rodada** (`game.round`): só leitura, com o destaque `highlight` do MatchCard: a palavra `club.next.title` ("Próximo jogo") em `rotulo` no topo do card e a borda de 2px em `grass`. A palavra é a pista; a borda só reforça.
5. **Abre na próxima rodada** (US-024; decisão 4 do CEO): o card da próxima rodada fica no meio da área visível (entre o cabeçalho e o "Jogar rodada"), sem animação. Na rodada 1, a lista fica no topo. Com a temporada encerrada, não há próxima: a lista abre com o card da rodada 38 à vista. Não há atalho flutuante "ir para a próxima rodada".

## Conteúdo da Rodada (subtela)

1. **Cabeçalho:** voltar, `round.title` ("Rodada 5") e "Mais". Ao entrar, o foco vai para o título (`tabindex="-1"`), como em toda troca de tela.
2. **Data da rodada** em `caption` `ink-muted` (`matchDate`, sem chave: a rodada já está no título).
3. **Os 10 jogos** (`ul` com o nome do título), cada um num MatchCard sem a linha de cima, mandante em cima e visitante embaixo com os gols, o selo "Clássico" quando o visitante está nos `rivals` do mandante, e `match.abandoned.short` no jogo encerrado. **O meu jogo primeiro** (com o meu clube em negrito), **depois os outros 9 na ordem do calendário**, como no resumo (decisão 5 do CEO). Sem selo de resultado e sem mando: o card da lista já os mostra, e aqui todos os cards têm a mesma forma.
4. **Cada card é um botão** (≥ 44px, com a seta) que abre a súmula daquele jogo, com o nome acessível `round.others.open` (o mesmo do resumo).
5. **Os autores dos gols ficam na súmula**, a um toque (decisão 2 do CEO; a mesma escolha da decisão 4 da T-030).

Sem barra de ação e sem "Continuar": o primário da tela continua sendo o "Jogar rodada".

## Súmula

A folha da T-083 (`MatchReport.svelte`), sem mudança, para qualquer jogo de qualquer rodada jogada da temporada: `Fixture.result` + `career.matchSheets[fixture.id]`. Tudo o que [resumo-rodada.md](resumo-rodada.md#súmula-folha--t-083) diz dela vale aqui, inclusive:

- **súmula sem lances:** quando o `matchSheets` não tem a partida (rodada em `missingSheetRounds`, por exemplo depois de uma linha que falhou na abertura), o EmptyState `report.missing.*` no lugar dos lances, os gols lidos de `Fixture.result.goals`, o melhor em campo sem a nota, as estatísticas e o público. Sem aviso global ([erros-e-avisos.md](erros-e-avisos.md), "Rodadas perdidas"). É a T-084 que leva o E2E desse caso, que a T-083 deixou para quando houvesse acesso a rodadas antigas;
- **erro ao montar a súmula:** o ErrorState `block` dentro da folha, sem ação; a Rodada atrás continua.

A Rodada usa o mesmo padrão de histórico do resumo: abre com `pushSheet`, o voltar fecha, o "avançar" até a entrada reabre a folha no mesmo jogo, e ao fechar o foco volta ao card que a abriu (mesmo quando a folha foi reaberta pelo "avançar").

## Ao alcance do polegar

A lista abre com a próxima rodada no meio da tela; os cards jogados, que são o que se toca, ficam logo acima dela, ao alcance do polegar depois de uma rolada curta. Na Rodada, os 10 cards ocupam a tela toda; o voltar do cabeçalho fica no topo, mas o voltar do celular faz o mesmo. A súmula é uma folha que sobe de baixo, como no resumo.

## Estados

| Estado                           | O que aparece                                                                                                                                                                                                                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Carregando**                   | Não existe: o calendário está na memória quando a aba abre. Sem Skeleton e sem chave.                                                                                                                                                                                                           |
| **Vazio**                        | Não existe: o calendário é gerado no novo jogo.                                                                                                                                                                                                                                                 |
| **Pré-temporada** (rodada 1)     | Nenhum card jogado; o da rodada 1 com o destaque "Próximo jogo", no topo.                                                                                                                                                                                                                       |
| **Durante a temporada**          | Como descrito.                                                                                                                                                                                                                                                                                  |
| **Temporada encerrada** (39)     | Os 38 cards jogados, nenhum destaque, a lista aberta com a rodada 38 à vista. "Jogar rodada" em `blocked` com `play.blocked.seasonOver` (já existe). O Fim de temporada é da T-037.                                                                                                             |
| **Rodada que não existe**        | O endereço vira `#/calendar` (ver "Navegação"). Não é erro.                                                                                                                                                                                                                                     |
| **Súmula sem lances**            | Ver "Súmula".                                                                                                                                                                                                                                                                                   |
| **Jogo encerrado** (`abandoned`) | `match.abandoned.short` no card da lista e no da Rodada; o placar dado nos dois; na súmula, `match.abandoned`, como no resumo.                                                                                                                                                                  |
| **Erro**                         | As leituras não têm situação de jogo que falhe; um erro é bug. A fronteira da aba troca a área de conteúdo (da lista ou da Rodada) pelo ErrorState `area`; abas e "Jogar rodada" continuam. Registrado em `lib/errors` com `screen: 'calendar'`. O erro da súmula fica dentro da folha (T-083). |
| **Realismo simplificado**        | Igual. Na súmula, `report.event.yellowSuspended` não aparece (T-083).                                                                                                                                                                                                                           |
| **Rodada não salva**             | A lista e a Rodada mostram o estado na memória (o que o jogador viu no resumo); o aviso e o "Jogar rodada" bloqueado são da moldura. A súmula da rodada não salva existe na memória e abre normalmente.                                                                                         |
| **Offline**                      | Nada muda.                                                                                                                                                                                                                                                                                      |

## Celular em pé (360px), deitado e desktop

- **360px:** uma coluna de cards, margem `space-4`. No card, o nome curto tem toda a largura menos o escudo, o placar e a seta (cerca de 200px): "Inter-Regional" (94,8px em `body-strong`) cabe com folga. O pé quebra em duas linhas quando junta mando, "Clássico" e o resultado ("Fora de casa", "Clássico", "Derrota"), nunca corta. Cada card tem cerca de 150px; a lista inteira, cerca de 6.000px, por isso ela abre na próxima rodada (decisões 3 e 4 do CEO).
- **Deitado (844×390) e desktop:** a coluna de conteúdo passa de 480px (`breakpoint-card`, consulta de contêiner como em "Outros resultados"), e os cards de cada turno e os da Rodada ficam em **duas colunas**, na ordem da rodada (1 e 2 na primeira linha, 3 e 4 na segunda). No deitado, a área útil é baixa: a lista só rola; a súmula segue o BottomSheet. No desktop, a súmula é o diálogo ancorado pela base, de 540px, e a barra lateral marca Calendário também na Rodada. Na T-084, um card ao lado de outro mais alto (o do destaque, ou um com "Clássico") não estica até a altura da linha, como nos "Outros resultados" do resumo; a altura igual fica para uma tarefa futura (item 32 das [propostas](componentes.md#propostas-ao-design-system)).

## Movimento

Nenhum. A rolagem até a próxima rodada (e até o card de origem, na volta) é instantânea, com ou sem movimento reduzido. A folha da súmula segue o BottomSheet (sem animação de subida com `prefers-reduced-motion`).

## Acessibilidade

- **Estrutura:** `h1` da moldura ("Calendário" ou "Rodada 5"); na lista, as duas seções com `h2` e uma `ol` cada; na Rodada, uma `ul` nomeada pelo título.
- **Nomes dos cards tocáveis:** `calendar.match.open` na lista e `round.others.open` na Rodada (WCAG 2.5.3). Na lista, o nome traz a rodada, os nomes e os gols na ordem do card, e depois o resultado, o mando, o "Clássico" e a nota do jogo encerrado, quando há ("Ver a rodada 8: Leões 1 Tubarões 1, Empate, Em casa, Clássico"); a data da linha de cima fica fora do nome. Na Rodada, os nomes e os gols na ordem do card, e depois o "Clássico" e a nota, quando há. Os cards só de leitura são lidos pelo próprio texto. (Redação alinhada em 2026-11-15 ao lote de textos da T-084 aprovado pelo CEO nessa data, em [docs/content/lotes/2026-11-15-calendario.md](../../content/lotes/2026-11-15-calendario.md); nenhum texto do jogo mudou.)
- **Nunca só por cor:** resultado em palavra no selo; "Clássico" em texto; mando em texto; próxima rodada com a palavra "Próximo jogo"; meu clube em negrito (e citado pelo nome do card).
- **Alvos ≥ 44px:** cada card jogado da lista, cada card da Rodada, o voltar do cabeçalho e o X da súmula.
- **Foco:** entrar na Rodada leva o foco ao título; voltar à lista leva o foco ao card da rodada de onde voltou; fechar a súmula devolve o foco ao card que a abriu.
- **Contraste:** só pares conferidos pelo `npm run tokens` (`ink` e `ink-muted` sobre `surface-0/1/2`, `on-grass` sobre `grass`, `on-floodlight` sobre `floodlight`, `ink` sobre `danger-soft`). A borda `grass` do destaque é reforço, não texto.
- **Números** (gols, rodada) em `tabular-nums`.

## Componentes

Props em [componentes.md](componentes.md#casca-da-t-031-tabela-e-da-t-084-calendário).

| Reaproveitados                                                                                                                                                    | Novos  | Mudanças                                                         |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ---------------------------------------------------------------- |
| ScreenHeader (com voltar), MatchCard (botão e só leitura), StatusBadge (`win`, `draw`, `loss`, `derby`), Crest, Icon, MatchReport (folha da T-083), ErrorBoundary | nenhum | MatchCard: `highlight?` (palavra no topo e borda `grass` de 2px) |

Nenhum ícone, token ou selo novo.

## O que a tela lê (para o `developer`)

| Dado                       | De onde                                                                                                           |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------- |
| As 38 rodadas do meu clube | `game.fixtures` com `homeId` ou `awayId` igual ao meu clube, na ordem de `round`                                  |
| Turno                      | `round ≤ SEASON_ROUNDS / 2` (o motor exporta `SEASON_ROUNDS`; nenhum 19 escrito)                                  |
| Próxima rodada             | `game.round` (nenhuma com `game.round > SEASON_ROUNDS`)                                                           |
| Data e mando               | `Fixture.date` (`matchDate`), `homeId`                                                                            |
| Resultado do meu lado      | `resultOf(Fixture.result.score, lado)` de `ui/round.ts`                                                           |
| Clássico                   | `isDerby` de `ui/round.ts` (o visitante nos `rivals` do mandante; os rivais são mútuos)                           |
| A Rodada                   | os 10 `game.fixtures` da rodada, o meu primeiro e os outros na ordem do calendário; vale só se todos têm `result` |
| Súmula                     | `Fixture.result` + `career.matchSheets[fixture.id]`, pelo `matchReport` de `ui/report.ts` (T-083)                 |

## Fronteira com as outras tarefas

| Tarefa  | O que é dela, não da T-084                                                                                                                           |
| ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-031   | A aba Tabela ([tabela.md](tabela.md)).                                                                                                               |
| T-032   | Partida animada e o seletor de tipo de partida; o Calendário não muda.                                                                               |
| T-035   | Entrevista pós-jogo; nada no Calendário.                                                                                                             |
| T-037   | Fim de temporada e virada; com a temporada nova, o Calendário mostra o calendário novo sem mudança na tela.                                          |
| T-045   | Placar e tabela ao vivo dos outros jogos (US-070 a US-072); o Calendário mostra só rodadas já jogadas e salvas.                                      |
| Etapa 4 | Datas reais e notificação de dia de rodada, replay lance a lance a partir da semente, histórico de temporadas anteriores (fora do escopo da US-024). |

## Textos (chaves)

Para o `content-writer`; os textos vão ao CEO no próximo lote. Todas em `app/src/content/<idioma>/ui.json`. Mesma regra de largura de [tabela.md](tabela.md#textos-chaves).

### Já existem e são reaproveitadas

| Chave                                                                        | Onde                                                                                          |
| ---------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| `nav.tab.calendar`                                                           | título da lista                                                                               |
| `nav.back`                                                                   | voltar do cabeçalho da Rodada                                                                 |
| `round.title`                                                                | título da Rodada                                                                              |
| `club.next.meta`                                                             | linha de cima de cada card da lista                                                           |
| `club.next.title`                                                            | destaque "Próximo jogo" no card da próxima rodada (o mesmo texto do título do bloco do Clube) |
| `match.venue.home`, `match.venue.away`                                       | mando no pé do card                                                                           |
| `match.derby`                                                                | selo "Clássico"                                                                               |
| `result.W`, `result.D`, `result.L`                                           | selo do resultado (palavra inteira) e dentro de `calendar.match.open`                         |
| `match.abandoned.short`                                                      | nota do jogo encerrado nos cards                                                              |
| `round.others.open`                                                          | nome acessível de cada card da Rodada                                                         |
| `report.*`, `match.*`, `round.goals.none`, `nav.close`, `club.error.block.*` | a súmula da T-083, sem mudança                                                                |
| `play.blocked.seasonOver`                                                    | "Jogar rodada" com a temporada encerrada (moldura)                                            |

### Novas da T-084

| Chave                  | Onde aparece                           | Limite a 360px                                                                                     | Placeholders                                                                         |
| ---------------------- | -------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `calendar.half.first`  | `h2` da primeira seção                 | 1 linha em `subtitulo` (20px), ~300px                                                              | —                                                                                    |
| `calendar.half.second` | `h2` da segunda seção                  | idem                                                                                               | —                                                                                    |
| `calendar.match.open`  | nome acessível do card jogado da lista | —; tem de conter o texto visível do card na mesma ordem (a rodada, os nomes, os gols, o resultado) | `{round}`, `{home}`, `{homeGoals}`, `{away}`, `{awayGoals}`, `{result}` (`result.*`) |

São 3 chaves novas.

## Medidas para o E2E

`tests/e2e/calendar.spec.ts`, com `PRANCHETA_ENV=test`, numa carreira de teste com fixture conhecida (Completo, "só resultado"), e outra no Simplificado. Larguras 360×740, 390×844, 844×390 (deitado) e 1280×800; temas `noite` e `dia`.

1. **Jogos do meu clube (US-024, cenário 1):** numa carreira na rodada 10, a lista tem 38 cards, um por rodada, na ordem; cada um tem a linha `club.next.meta` com a rodada e a data do save formatada; o mando confere com `homeId`; os das rodadas 1 a 9 mostram o placar do save e o selo com a palavra de `result.*` coerente com o placar do meu lado; os das rodadas 10 a 38 não têm gols.
2. **Próxima rodada:** o card da rodada 10 tem o texto de `club.next.title`; nenhum outro tem. Ao abrir a aba (pela TabBar e pelo card do Clube), o card da rodada 10 está inteiro entre o fim do cabeçalho e o topo do "Jogar rodada", a 360×740 e a 390×844.
3. **Turnos:** há duas seções com `h2` (`calendar.half.first` e `calendar.half.second`); a primeira tem as rodadas 1 a 19, a segunda, 20 a 38.
4. **Clássico (cenário 3):** todo card cujo adversário está nos `rivals` do meu clube tem o texto de `match.derby`; nenhum outro tem.
5. **Alvos:** os cards jogados são `button` com pelo menos 44 × 44px e nome acessível que contém a rodada, os nomes e os gols visíveis, na mesma ordem; os cards não jogados não são `a` nem `button`.
6. **Rodada inteira (cenário 2):** tocar no card da rodada 3 leva a `#/calendar/round/3`, com o `h1` de `round.title` com 3 e o foco nele; a lista tem 10 cards, o do meu jogo primeiro e os outros 9 na ordem do calendário, com os placares do save. O voltar do cabeçalho e `page.goBack()` levam a `#/calendar`, com o card da rodada 3 à vista e focado. Depois do avançar de volta à Rodada 3, o voltar do cabeçalho leva a `#/calendar` sem entrada nova (`history.length` igual), com o foco no card da rodada 3.
7. **Súmula de jogo já jogado (cenário 4):** na Rodada 3, tocar no card de um jogo de outros clubes abre o diálogo `report.title`; a lista de lances tem o mesmo número de itens de `matchSheets[id].events`, na mesma ordem; os números da tabela de estatísticas são os de `result.stats`; o voltar do celular fecha a folha e fica na Rodada, com o foco no card que a abriu. O mesmo para o meu jogo.
8. **Súmula de uma rodada antiga sem lances (a medida que a T-083 deixou):** jogar 3 rodadas; no IndexedDB `prancheta-test`, apagar a linha de `matchSheets` com a chave `[careerId, temporada, 1]`; reabrir a carreira numa página nova do mesmo contexto; no Calendário, abrir a rodada 1 e tocar no meu jogo. A folha mostra o título de `report.missing.title`; a lista de gols tem `result.goals.length` itens, cada um com o minuto e o `name.display` do autor (ou o texto de `round.goals.none` se o jogo foi 0 × 0, e nunca o de `report.events.none`); o melhor em campo mostra o nome do `motm` sem nota; a tabela de estatísticas confere com `result.stats`; a faixa de avisos da moldura não tem aviso sobre isso. Na rodada 2, a súmula do mesmo clube tem os lances normalmente.
9. **Endereço que não vale:** abrir `#/calendar/round/30` numa carreira na rodada 4, e `#/calendar/round/abc`, termina em `#/calendar`, sem entrada nova no histórico (`history.length` igual).
10. **"Jogar rodada" na Rodada:** em `#/calendar/round/2`, "Jogar rodada" abre o resumo; "Continuar" volta a `#/calendar/round/2`, que continua mostrando a rodada 2.
11. **Temporada encerrada:** numa carreira na rodada 39, nenhum card tem `club.next.title`, os 38 são botões, e o card da rodada 38 está à vista ao abrir.
12. **Textos e nomes cabem:** a 360×740, com o meu clube trocado para "Inter-Regional", em pt-BR, es e en: nenhum nome de clube nos cards tem `scrollWidth > clientWidth`; os títulos dos turnos ficam em 1 linha.
13. **Sem rolagem lateral da página** em 360, 390, 844 e 1280, na lista, na Rodada e com a súmula aberta, em pt-BR, es e en.
14. **Duas colunas:** a 844×390 e a 1280×800, os cards de um turno e os da Rodada têm dois valores de `x`; a 360 e a 390, um só.
15. **Movimento:** com `reducedMotion: 'reduce'`, `document.getAnimations().length === 0` na lista, na Rodada e com a súmula aberta.
16. **Simplificado:** nenhuma linha de súmula com o texto de `report.event.yellowSuspended`.

**No Vitest (T-084), pedidos ao `developer`:** as funções puras de `app/src/ui/` para as 38 rodadas do clube (turno, próxima, resultado do meu lado, clássico), para a ordem da Rodada (o meu jogo primeiro) e para ler o endereço (`#/calendar/round/N` só para rodada jogada da temporada; o resto, `#/calendar`); a conta de rolagem da abertura e da volta, sem DOM.

**E2E existentes que mudam (T-084):** o `club-squad.spec.ts` que confere o `href` do card do próximo jogo continua valendo e pode seguir o link até a lista. Nenhum outro espera o Placeholder do Calendário.

## Marcas do cenário

Nenhuma.

## Decisões do CEO (T-084)

Aprovadas pelo CEO em 2026-11-14 ("ok recomendado"), todas pela recomendação do `ux-designer`. A divisão da T-031 em duas é a decisão 1 de [tabela.md](tabela.md#decisões-do-ceo-t-031).

1. **Rodada como subtela da aba, com endereço próprio** (`#/calendar/round/N`), e não como folha: a súmula abre por cima como folha.
2. **Os autores dos gols da rodada ficam na súmula**, a um toque, e não em cada card da Rodada (a mesma escolha da decisão 4 da T-030). É assim que a T-084 cumpre o "vê os 10 resultados com os autores dos gols" da US-024.
3. **Calendário com o MatchCard inteiro** (o mesmo do Clube, 38 cards) e o selo do resultado com a palavra inteira ("Vitória"), não só a letra. Sem componente novo.
4. **Abre na próxima rodada, sem atalho flutuante** "ir para a próxima rodada" (como a decisão 7 da Tabela).
5. **Na Rodada, o meu jogo primeiro**, depois os outros 9 na ordem do calendário, todos com a mesma forma (sem selo de resultado nem mando).
6. **Rodadas futuras não abrem** (o card é só leitura).
