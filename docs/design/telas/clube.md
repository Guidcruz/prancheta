# Clube

**Histórias:** US-015, US-026 (parte da tela), US-028 e US-029 (blocos que entram depois) · **Prioridade:** Must · **Ordem:** 4 · **Tarefa:** T-028

## Objetivo

Mostrar num relance o próximo jogo, o humor da torcida e a posição na tabela, para o jogador decidir se mexe no time ou joga a rodada.

## O que o jogador faz

Lê os três blocos, toca no próximo jogo (vai ao Calendário), nos desfalques (vai ao Elenco) ou em "Tabela", e, no pé da tela, abre as entradas do menu "Mais". Na maior parte das vezes, só lê e toca "Jogar rodada".

## Navegação

- É a aba **Clube** da moldura ([navegacao.md](navegacao.md)) e o destino de abertura da carreira (`#/club`). Cabeçalho com o título "Clube" (`nav.tab.club`) e o ícone "Mais"; "Jogar rodada" flutuante e TabBar, como em toda aba.
- Saídas: o card do próximo jogo e o link "Calendário" do bloco vão a `#/calendar`; a linha de desfalques vai a `#/squad`; o link "Tabela" vai a `#/table`; as linhas do pé vão aos destinos do "Mais". Todas trocam a aba pelo mesmo caminho da TabBar (entrada nova no histórico; o voltar do celular volta ao Clube).
- Enquanto Calendário e Tabela não existem (T-031), os links levam ao Placeholder dessas abas, como a TabBar já faz.

## Conteúdo (de cima para baixo, no celular)

1. **Clube** (cabeçalho da área): Crest `lg` (64px), nome curto do clube em `titulo` e a linha de progresso já existente (`career.progress`, "Temporada 2026 · próxima rodada: 6"; com a temporada encerrada, `career.seasonOver`). O nome é o `h2` da tela; o escudo é decorativo.
2. **Próximo jogo** (SectionCard com o link "Calendário"):
   - MatchCard com rodada e data (`club.next.meta`, data formatada por `Intl.DateTimeFormat` do idioma, dia da semana e mês abreviados), mandante em cima e visitante embaixo, o meu clube em negrito, o mando em texto ("Em casa" / "Fora de casa") e o selo "Clássico" quando o adversário está em `rivals` do meu clube. O card inteiro é um link ≥ 44px.
   - **Desfalques** (LinkRow com ícone `squad`, só no Realismo completo e só quando houver): "Desfalques: 1 lesionado, 1 suspenso". Conta os jogadores do elenco com `injuryRounds > 0` ou `suspendedGames > 0`; quem tem os dois conta só como lesionado. Toque leva ao Elenco.
   - Temporada encerrada (`round` 39): no lugar do card, o texto `club.next.none`; o link "Calendário" continua.
3. **Torcida** (SectionCard sem link): FanThermometer com o número (0 a 100, arredondado), "de 100", o rótulo de humor em texto e a barra de cinco faixas; embaixo, uma frase do que o humor muda (`club.fans.hint`).
4. **Classificação** (SectionCard com o link "Tabela"):
   - Posição em `titulo` ("13º") e a linha "6 pontos em 5 jogos".
   - Mini tabela de 3 linhas (TableRow): o clube de cima, o meu e o de baixo; no 1º lugar, as 3 primeiras; no 20º, as 3 últimas. Colunas: Clube (posição, escudo, nome), J, SG, Pts. A linha do meu clube tem o destaque de TableRow (fundo, negrito, barra à esquerda, `aria-current` e "seu clube" para leitor de tela).
   - **Últimos jogos:** até 5 StatusBadge de letra (V/E/D) do `StandingRow.form`, do mais antigo ao mais recente, cada um com a palavra inteira para leitor de tela.
5. **Mais opções** (só no celular): título `nav.more` em `rotulo` e as mesmas entradas do menu "Mais", na mesma ordem e com os mesmos ícones (`NAV_EXTRA`, `NAV_SETTINGS`, `NAV_TUTORIAL`, com a Rede social só se estiver ligada), em LinkRow. A partir de 900px some: a barra lateral já tem todas.

Os blocos **Últimas notícias** e **Rede social** do PROJETO entram com as suas tarefas (T-034 e T-035), entre Torcida e Classificação no celular e na coluna da direita no desktop. Até lá não aparecem, nem como "em breve" (P3).

## Ao alcance do polegar

"Jogar rodada" e TabBar, como em toda aba. O que se toca em toda rodada (próximo jogo e desfalques) está no primeiro bloco; o pé da tela, perto do polegar ao fim da rolagem, tem os atalhos do "Mais". O link de cada bloco fica no canto de cima, porque é usado pouco: o card do próximo jogo e a linha de desfalques são os alvos grandes.

## Estados

| Estado                    | O que aparece                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Carregando**            | Skeleton `featured` × 3 no lugar dos blocos, com `club.loading` para leitor de tela; aparece só se a leitura passar de 300 ms. Hoje a carreira já está na memória quando a aba abre, então na prática não aparece; fica para quando a tela ler algo assíncrono.                                                                                                                                                                                                                                                                                                                                                                       |
| **Vazio (pré-temporada)** | Antes da rodada 1: próximo jogo normal (rodada 1); termômetro em `fans.start` (60, "Animada"); posição "—" com `club.table.preseason`; mini tabela na ordem que o `getStandings` devolve sem jogos (todos com 0); "Últimos jogos" com `club.form.none`. Nada de bloco vazio.                                                                                                                                                                                                                                                                                                                                                          |
| **Erro num bloco**        | O bloco que falhar (por exemplo, a tabela lança) vira ErrorState `block` no lugar dele, com `club.error.block.title`, `club.error.block.body` e "Tentar de novo" (secundário; o primário da tela continua sendo "Jogar rodada"). Os outros blocos continuam. Cada bloco se protege em duas partes: as leituras da carreira passam por `readBlock` (devolve o valor ou o erro, sem lançar), e o desenho do bloco fica num `<svelte:boundary>` próprio, com o mesmo ErrorState no `failed`. O `ErrorBoundary` não serve para bloco: ele mostra o ErrorState `area`, de tela inteira. Os dois caminhos registram o erro em `lib/errors`. |
| **Erro na tela inteira**  | A fronteira da aba (T-023) troca a área de conteúdo pelo ErrorState `area`; abas e "Jogar rodada" continuam.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| **Temporada encerrada**   | `career.seasonOver` no cabeçalho, `club.next.none` no bloco do próximo jogo, sem desfalques. Torcida e classificação finais continuam.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                |
| **Realismo completo**     | Como descrito; a linha de desfalques aparece quando há lesionado ou suspenso.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| **Realismo simplificado** | Igual, sem a linha de desfalques: nesse modo ninguém sai lesionado ou suspenso de uma rodada para a outra (`partida.md`, "Modo Realismo simplificado"). Nada na tela diz qual realismo está ativo (isso fica nas Preferências, US-044).                                                                                                                                                                                                                                                                                                                                                                                               |
| **Offline**               | Nada muda.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                            |
| **Rede social desligada** | O pé da tela não tem a linha "Rede social" (igual ao menu "Mais").                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                    |

## Desktop (a partir de 900px) e celular deitado

- A partir de 720px de largura da coluna (celular deitado, 844×390, e desktop): duas colunas. À esquerda, Próximo jogo e Classificação; à direita, Torcida (e, depois, Notícias e Rede social). No DOM a ordem continua a do celular (Próximo jogo, Torcida, Classificação), e a grade só reposiciona: o leitor de tela e o Tab seguem a mesma ordem nas duas larguras.
- No desktop, o pé "Mais opções" some. A coluna de conteúdo é a normal (`layout-content-max`), sem `wide`.
- Celular deitado: a área útil entre o cabeçalho e o "Jogar rodada" é baixa; a tela só rola, sem nada fixo além da moldura.

## Componentes

ScreenHeader, Crest, SectionCard, MatchCard, StatusBadge, LinkRow, FanThermometer, TableRow, ErrorState, ErrorBoundary (só a da aba), Skeleton. Novos da T-028 em [componentes.md](componentes.md#casca-da-t-028-clube-elenco-e-jogador).

## O que a tela lê (para o `developer`)

| Dado                         | De onde                                                                                                                |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| Próximo jogo                 | `game.fixtures` da rodada `game.round` com o meu clube; clássico por `clubs[mine].def.rivals`                          |
| Desfalques                   | `game.squads[mine]` e `players[id].injuryRounds`, `suspendedGames`                                                     |
| Termômetro                   | `game.clubs[mine].fans`, arredondado com `Math.round`                                                                  |
| Faixa de humor               | **Falta no motor** (ver "Pedidos ao motor" no fim): uma função de leitura que devolve uma das 5 faixas de `torcida.md` |
| Posição, pontos, jogos, form | `getStandings(game)` (contrato do motor), linha do meu clube e as vizinhas                                             |

## Textos (chaves)

Rascunho pt-BR para o `content-writer`; vai ao CEO no próximo lote. Todas em `app/src/content/<idioma>/ui.json`, menos os rótulos de humor, que vão em `fans.json` (`docs/02-architecture.md` §3, "Conteúdo e i18n"; o `developer` acrescenta o arquivo à tabela do `i18n.ts`). Já existem e continuam: `nav.tab.club`, `nav.more`, os `nav.*` do pé, `career.progress`, `career.seasonOver`, `action.retry`.

| Chave                           | Rascunho pt-BR                                                                               | Onde                                                                                                                |
| ------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| `club.loading`                  | Carregando o clube...                                                                        | Skeleton (leitor de tela)                                                                                           |
| `club.next.title`               | Próximo jogo                                                                                 | título do bloco                                                                                                     |
| `club.next.action`              | Calendário                                                                                   | link do bloco                                                                                                       |
| `club.next.actionA11y`          | Ver o calendário completo                                                                    | nome acessível do link (contém o texto visível)                                                                     |
| `club.next.meta`                | Rodada {round} · {date}                                                                      | linha de cima do MatchCard                                                                                          |
| `club.next.none`                | Não há mais jogos nesta temporada.                                                           | temporada encerrada                                                                                                 |
| `match.venue.home`              | Em casa                                                                                      | mando no MatchCard                                                                                                  |
| `match.venue.away`              | Fora de casa                                                                                 | mando no MatchCard                                                                                                  |
| `match.derby`                   | Clássico                                                                                     | StatusBadge `derby`                                                                                                 |
| `club.absences`                 | Desfalques: {list}                                                                           | linha de desfalques; `{list}` junta as duas chaves de baixo                                                         |
| `club.absences.injured.one`     | {count} lesionado                                                                            | dentro de `{list}`                                                                                                  |
| `club.absences.injured.other`   | {count} lesionados                                                                           | dentro de `{list}`                                                                                                  |
| `club.absences.suspended.one`   | {count} suspenso                                                                             | dentro de `{list}`                                                                                                  |
| `club.absences.suspended.other` | {count} suspensos                                                                            | dentro de `{list}`                                                                                                  |
| `club.absences.join`            | {first}, {second}                                                                            | junta lesionados e suspensos quando há os dois                                                                      |
| `club.fans.title`               | Torcida                                                                                      | título do bloco                                                                                                     |
| `club.fans.hint`                | Torcida quente empurra o time em casa e anima o elenco. Resultado abaixo do esperado esfria. | frase sob a barra                                                                                                   |
| `fans.scale`                    | de 100                                                                                       | depois do número                                                                                                    |
| `club.table.title`              | Classificação                                                                                | título do bloco                                                                                                     |
| `club.table.action`             | Tabela                                                                                       | link do bloco                                                                                                       |
| `club.table.actionA11y`         | Ver a tabela completa                                                                        | nome acessível do link                                                                                              |
| `club.table.position`           | {position}º                                                                                  | posição em destaque (en: "{position}th" não serve; o `content-writer` decide a forma, por exemplo "No. {position}") |
| `club.table.points.one`         | {count} ponto                                                                                | linha de resumo                                                                                                     |
| `club.table.points.other`       | {count} pontos                                                                               | linha de resumo                                                                                                     |
| `club.table.played.one`         | em {count} jogo                                                                              | linha de resumo, depois dos pontos                                                                                  |
| `club.table.played.other`       | em {count} jogos                                                                             | linha de resumo                                                                                                     |
| `club.table.preseason`          | Antes da 1ª rodada, todos com 0 ponto.                                                       | estado de pré-temporada                                                                                             |
| `club.table.caption`            | Classificação perto do seu clube                                                             | `caption` da mini tabela (só leitor de tela)                                                                        |
| `table.col.club`                | Clube                                                                                        | cabeçalho (também na Tabela, T-031)                                                                                 |
| `table.col.played`              | J                                                                                            | cabeçalho                                                                                                           |
| `table.col.played.full`         | Jogos                                                                                        | nome completo do cabeçalho (leitor de tela)                                                                         |
| `table.col.goalDiff`            | SG                                                                                           | cabeçalho                                                                                                           |
| `table.col.goalDiff.full`       | Saldo de gols                                                                                | nome completo                                                                                                       |
| `table.col.points`              | Pts                                                                                          | cabeçalho                                                                                                           |
| `table.col.points.full`         | Pontos                                                                                       | nome completo                                                                                                       |
| `table.mine`                    | seu clube                                                                                    | lido depois do nome na linha do meu clube                                                                           |
| `club.form.title`               | Últimos jogos                                                                                | rótulo da fileira V/E/D                                                                                             |
| `club.form.none`                | Nenhum jogo ainda                                                                            | pré-temporada                                                                                                       |
| `result.W`                      | Vitória                                                                                      | leitor de tela do selo                                                                                              |
| `result.W.short`                | V                                                                                            | letra do selo                                                                                                       |
| `result.D`                      | Empate                                                                                       | leitor de tela                                                                                                      |
| `result.D.short`                | E                                                                                            | letra                                                                                                               |
| `result.L`                      | Derrota                                                                                      | leitor de tela                                                                                                      |
| `result.L.short`                | D                                                                                            | letra                                                                                                               |
| `club.error.block.title`        | Não deu para mostrar esta parte.                                                             | ErrorState `block`                                                                                                  |
| `club.error.block.body`         | O resto da tela continua funcionando. A sua carreira não foi alterada.                       | ErrorState `block`                                                                                                  |

Rótulos de humor, em `app/src/content/<idioma>/fans.json` (as faixas de `torcida.md`, "Humor da rede social"):

| Chave                 | Faixa  | Rascunho pt-BR |
| --------------------- | ------ | -------------- |
| `fans.mood.revolt`    | 0–19   | Em revolta     |
| `fans.mood.irritated` | 20–39  | Irritada       |
| `fans.mood.wary`      | 40–59  | Desconfiada    |
| `fans.mood.excited`   | 60–79  | Animada        |
| `fans.mood.party`     | 80–100 | Em festa       |

Cabe em es e en: o rótulo de humor quebra para a linha de baixo do número quando passa da largura (testado a 360px com "En rebelión"); os títulos dos blocos têm uma palavra; a linha de desfalques quebra em duas linhas dentro do LinkRow. Nomes de clube nunca se traduzem.

## Acessibilidade

- **Estrutura:** `h1` é o título da moldura; o nome do clube é `h2`; cada bloco é uma `section` com o próprio `h2` (SectionCard), para o leitor de tela pular de bloco em bloco.
- **Alvos ≥ 44px:** card do próximo jogo, linha de desfalques, links "Calendário" e "Tabela", linhas do pé. O nome acessível dos links do bloco contém o texto visível (WCAG 2.5.3).
- **Termômetro:** o número, "de 100" e o rótulo de humor são texto comum, lidos em sequência ("55 de 100 Desconfiada"); a barra é `aria-hidden`. Sem `role="meter"` (muda o que estava no rascunho do kickoff): com o papel `meter`, os filhos viram apresentação e o rótulo de humor deixaria de ser lido como texto, e o VoiceOver do iOS lê `meter` de forma irregular. A frase de ajuda é ligada por `aria-describedby`.
- **Nunca só cor:** humor em palavra; V/E/D em letra e palavra; clássico, lesionado e suspenso com ícone e texto; o meu clube com negrito, barra e "seu clube".
- **Contraste:** só pares conferidos pelo `npm run tokens` (`ink` e `ink-muted` sobre `surface-0/1/2`, `on-grass` sobre `grass`, `on-floodlight` sobre `floodlight`, `ink` sobre `danger-soft`). As cores da barra do termômetro (`danger`, `draw`, `grass`, `floodlight`) são reforço, não texto.
- **Movimento:** nenhuma animação na tela (o termômetro não "enche"); o Skeleton só pulsa com movimento ligado.
- **Números** em `tabular-nums`.

## Medidas para o E2E

No celular 390×844 e 360×740, no celular deitado 844×390 e no desktop 1280×800, temas `noite` e `dia`:

1. **Sem rolagem lateral da página:** `document.documentElement.scrollWidth <= clientWidth`.
2. **Alvos:** todo `a`, `button` e `input` visível da área de conteúdo mede pelo menos 44×44 px (`boundingBox`), menos os que ficam dentro de outro alvo maior.
3. **Termômetro (US-026):** o bloco "Torcida" tem o número igual a `Math.round(fans)` e um dos 5 rótulos de humor como texto visível; a barra tem `aria-hidden="true"`.
4. **US-015, "tela do clube":** numa carreira na rodada 5, o MatchCard mostra o adversário e "Em casa" ou "Fora de casa"; o bloco "Classificação" mostra a posição do `getStandings`.
5. **Pé = "Mais" (US-015):** abaixo de 900px, os rótulos das linhas do pé são iguais, na mesma ordem, aos do menu "Mais"; a partir de 900px o pé não é visível.
6. **Ordem:** no DOM, Próximo jogo vem antes de Torcida, e Torcida antes de Classificação, nas duas larguras.
7. **Simplificado:** numa carreira simplificada, a linha de desfalques não existe; no Completo, com um lesionado forçado na fixture de teste, ela existe e leva a `#/squad`.
8. **Movimento:** com `reducedMotion: 'reduce'`, `document.getAnimations().length === 0` depois de a tela abrir.

## Marcas do cenário

Nenhuma.

## Decisões do CEO (T-028)

Aprovadas em 2026-11-07, com a lista completa em [jogador.md](jogador.md#decisões-do-ceo-t-028). As desta tela:

- Rótulo de humor com as 5 faixas de `torcida.md` ("Em revolta" a "Em festa").
- Notícias e Rede social só com a T-034 e a T-035, sem "em breve".
- "Mais opções" no pé só abaixo de 900px.
- Ordem: Próximo jogo, Torcida, Classificação.
- Linha "Desfalques" só no Realismo completo.
- Termômetro sem seta de tendência na 1a.
