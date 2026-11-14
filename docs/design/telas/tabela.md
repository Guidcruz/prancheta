# Tabela

**Histórias:** US-023 (e, em tarefas seguintes, US-025, US-071, US-073) · **Prioridade:** Must · **Ordem:** 10 · **Tarefas:** T-031 (Tabela) e T-084 (Calendário; ver [calendario.md](calendario.md))

## Objetivo

Mostrar a classificação legível no celular, com o clube do jogador e as zonas fáceis de achar.

## O que o jogador faz

Abre a aba Tabela, vê de cara onde o clube dele está, quantos pontos tem e se subiu ou caiu na última rodada; rola para o lado para ver as outras colunas e para cima ou para baixo para ver o líder e a zona de rebaixamento. Nada é tocável na tabela: a tela é só leitura, e o primário continua sendo o "Jogar rodada".

## Divisão em duas tarefas

Decisão do CEO de 2026-11-14 (decisão 1, abaixo): a T-031 planejada (M) juntava duas telas, cada uma com um conjunto de medidas do tamanho do da T-030. Como na T-030 e na T-083, ela foi dividida em dois PRs de tamanho M, e a Tabela vem primeiro. Cada item desta spec é da T-031; o Calendário inteiro está em [calendario.md](calendario.md).

| Tarefa                               | O que entra                                                                                                                                                                                                                                                                                                                                  |
| ------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **T-031** (Tabela, US-023)           | A aba Tabela (`#/table`) de verdade: ScrollTable com a coluna fixa até 60%, TableRow com mudança de posição, marca de zona e linha de duas alturas, as colunas da classificação, a legenda, a seta com um movimento curto, os estados (pré-temporada, rodada 1, temporada encerrada), a abertura já mostrando o meu clube e o E2E da tabela. |
| **T-084** (Calendário, US-024; nova) | A aba Calendário (`#/calendar`) com as 38 rodadas do clube, a subtela da rodada (`#/calendar/round/N`) com os 10 resultados e a súmula da T-083 em qualquer rodada jogada, com o E2E da súmula de uma rodada antiga sem lances. Depende da T-083; não depende da T-031.                                                                      |

O número T-084 é o primeiro livre que encontrei em `docs/02-architecture.md`; quem fixa o número e a linha da tarefa é o `architect`.

## Navegação

- É a aba **Tabela** da moldura ([navegacao.md](navegacao.md)), endereço `#/table`. Cabeçalho com o título "Tabela" (`nav.tab.table`) e o ícone "Mais"; "Jogar rodada" flutuante e TabBar, como em toda aba. No desktop, a barra lateral com Tabela ativa.
- Chega-se pela TabBar, pelo link "Tabela" do bloco Classificação do Clube (que hoje leva ao Placeholder) e pelo voltar do navegador. Sem subtelas e sem folhas na T-031.
- **Abre mostrando o meu clube** (decisão 7 do CEO): se a linha do meu clube não estiver inteira na área visível (entre o cabeçalho e o "Jogar rodada"), a página rola, sem animação, até a linha ficar no meio dessa área. Se estiver visível de cara (do 1º ao cerca de 9º a 360×740), a tela fica no topo. Não há atalho flutuante "ir para o meu clube": ele disputaria o lugar do "Jogar rodada" e só serve a uma tabela de 20 linhas que cabe em duas telas.
- Depois de uma rodada, "Continuar" do resumo volta à Tabela (se foi dela que o jogador tocou "Jogar rodada"), já com a tabela nova, as setas da rodada e a mesma regra de abertura.

## Conteúdo (de cima para baixo, no celular em pé)

1. **Cabeçalho** (ScreenHeader da moldura): "Tabela".
2. **Faixa de avisos** da moldura, como em toda aba.
3. **Tabela** (ScrollTable, `fixedMax={60}`), com a `caption` visível em `caption` `ink-muted` acima das colunas (`showCaption`):
   - durante a temporada: `table.caption` ("Depois da rodada 12");
   - antes da rodada 1: `club.table.preseason` (já existe: "Antes da 1ª rodada, todos com 0 ponto.");
   - temporada encerrada (`game.round` 39): `table.caption.final`.
   - Colunas, nesta ordem (US-023 e [temporada.md](../temporada.md#pontos-e-tabela)): **Clube** (fixa) · **Pts** · **J** · **V** · **E** · **D** · **GP** · **GC** · **SG** · **%** · **Últimos 5**. As duas últimas vêm de temporada.md (decisão 4 do CEO).
   - 20 linhas (TableRow `layout="full"`), na ordem do `getStandings(game)`.
4. **Legenda** (TableLegend), abaixo da tabela, a partir da rodada 1 (na pré-temporada não há zona nem seta, então não há o que explicar).

### A linha (TableRow `layout="full"`)

Todas as linhas têm a mesma altura, a de duas linhas de texto (uma de `body` e uma de `caption`, mais o respiro de `space-1`: cerca de 46px), com ou sem a segunda linha, para a tabela não "pular" entre linhas com e sem zona.

**Coluna fixa**, da esquerda para a direita:

| Parte            | Largura a 360px                    | O que mostra                                                                                                                                                                                                                                                                |
| ---------------- | ---------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Bloco da posição | `space-8` (32px), centralizado     | Em cima, a posição em `numero` (na zona, dentro da marca de zona, ver "Zonas"). Embaixo, a mudança da última rodada em `caption`: ícone `arrow-up` ou `arrow-down` de 12px e o número com sinal ("+2", "−1", por `Intl.NumberFormat` com `signDisplay`). Sem mudança, nada. |
| Escudo           | Crest `sm` (32px), `space-1` antes | Decorativo.                                                                                                                                                                                                                                                                 |
| Nome e zona      | o resto, `space-2` antes           | Em cima, o nome curto (`body`, o meu clube em `body-strong`), numa linha, sem reticências (ver "360px"). Embaixo, só nas linhas de zona, a palavra da zona em `caption` `ink-muted` (`table.zone.*`).                                                                       |

**Colunas que rolam:** números em `numero`, alinhados à direita, `tabular-nums`. SG com sinal (`signed`, como no Clube). % sem casa decimal (`Intl.NumberFormat` com `style: 'percent'`); sem jogos, "—" com `club.form.none` para o leitor de tela. Últimos 5: até 5 StatusBadge só de letra (V/E/D), do mais antigo ao mais recente, como no Clube; sem jogos, "—" com `club.form.none`.

**Meu clube:** o destaque que a TableRow já tem (fundo `surface-2`, nome em `body-strong`, barra de `space-1` em `grass` na borda esquerda, `aria-current="true"` e `table.mine` para o leitor de tela).

### Zonas (decisões 2 e 3 do CEO)

Na Etapa 1, só duas zonas (US-023): o **1º lugar** e os **4 últimos** (`RELEGATION_SPOTS` do motor; nenhum número escrito na tela). Nada de Libertadores ou Sul-Americana: as copas não existem na 1a, e um aviso "as copas chegam numa próxima versão" é promessa (P3).

| Zona         | Quando                                               | Marca na posição (PositionMark)           | Palavra embaixo do nome |
| ------------ | ---------------------------------------------------- | ----------------------------------------- | ----------------------- |
| Líder        | 1º lugar, da rodada 1 à 38                           | `on-floodlight` sobre `floodlight`        | `table.zone.leader`     |
| Campeão      | 1º lugar, temporada encerrada (`game.round` 39)      | igual                                     | `table.zone.champion`   |
| Rebaixamento | do 17º ao 20º, da rodada 1 até a temporada encerrada | `ink` sobre `danger-soft`, borda `danger` | `table.zone.relegation` |
| (nenhuma)    | do 2º ao 16º, e todas as linhas na pré-temporada     | sem marca: o número em `ink`              | nada                    |

- **Nunca só por cor:** a palavra da zona está escrita em cada linha da zona, a marca tem forma (caixinha com borda e fundo) além da cor, e a legenda explica as duas. Os dois pares são os dos Selos (`derby`/`prospect` e `loss`), já conferidos pelo `npm run tokens`; nenhuma cor nova.
- **A marca é a mesma em todo lugar que mostrar a classificação inteira:** a Tabela (T-031), a classificação final do Fim de temporada (T-037) e a tabela "se terminasse agora" (T-045). A mini tabela do Clube não leva marca (3 linhas, sem legenda); fica como está.
- O aviso de que ninguém cai nesta versão (P2) não entra na Tabela: é do Fim de temporada, como a US-025 pede (decisão 8 do CEO).

### Mudança de posição

- Compara a tabela depois da última rodada jogada (`r = game.round − 1`, como o resumo) com a de depois da anterior: `getStandings(game, r)` contra `getStandings(game, r − 1)`, a mesma conta do `positionChange` que o resumo já usa (`ui/round.ts`).
- **Na pré-temporada e depois da rodada 1, nenhuma linha tem mudança** (a tabela antes da rodada 1 é toda zerada; o resumo faz igual).
- Temporada encerrada: a mudança da rodada 38 continua.
- Para o leitor de tela, a mudança é a frase do resumo (`round.table.up.*` ou `round.table.down.*`: "Subiu 2 posições"); o ícone e o "+2" visíveis ficam `aria-hidden`. Sem mudança, nada é lido (20 vezes "mesma posição" seria ruído).

### Legenda (TableLegend)

Uma lista curta, em `caption`, embaixo da tabela, com um `h2` escondido (`table.legend.title`). Cada item tem o desenho de exemplo (`aria-hidden`) e o texto:

1. marca de líder com "1" + `table.legend.leader` (ou `table.legend.champion` com a temporada encerrada);
2. marca de rebaixamento com o primeiro número da zona ("17", de `RELEGATION_SPOTS`) + `table.legend.relegation` (`{count}` = 4);
3. `arrow-up` e `arrow-down` + `table.legend.movement`.

## Ao alcance do polegar

A tela é só leitura: rolar na vertical (a página) e na horizontal (a caixa da tabela, com o polegar sobre os números). A linha do meu clube abre no meio da área visível, perto do polegar; "Jogar rodada" e a TabBar continuam no lugar de sempre. A legenda fica no fim, onde o polegar chega depois de rolar.

## Estados

| Estado                       | O que aparece                                                                                                                                                                                                                                                                             |
| ---------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Carregando**               | Não existe: a carreira já está na memória quando a aba abre (como no Clube), e a tabela é uma conta síncrona. Sem Skeleton e sem chave de carregamento.                                                                                                                                   |
| **Pré-temporada** (rodada 1) | As 20 linhas na ordem que o `getStandings` devolve sem jogos (a mesma da mini tabela do Clube), com os números da posição, todos os números em 0, % e Últimos 5 com "—". Sem marca de zona, sem palavra de zona, sem mudança e sem legenda. A `caption` visível é `club.table.preseason`. |
| **Depois da rodada 1**       | Zonas e legenda aparecem; nenhuma mudança (ver "Mudança de posição").                                                                                                                                                                                                                     |
| **Durante a temporada**      | Como descrito.                                                                                                                                                                                                                                                                            |
| **Temporada encerrada** (39) | `table.caption.final`; o 1º com `table.zone.champion`; a mudança da rodada 38; a legenda com `table.legend.champion`. A cerimônia, a classificação final do Fim de temporada e o aviso P2 são da T-037. "Jogar rodada" em `blocked` com `play.blocked.seasonOver` (já existe).            |
| **Erro**                     | A leitura não tem situação de jogo que falhe (`getStandings` nunca lança); um erro aqui é bug. A fronteira da aba (T-023) troca a área de conteúdo pelo ErrorState `area`; cabeçalho, abas e "Jogar rodada" continuam. Registrado em `lib/errors` com `screen: 'table'`.                  |
| **Realismo simplificado**    | Igual. Os cartões continuam valendo no desempate (critérios 6 e 7), porque contam dentro do jogo.                                                                                                                                                                                         |
| **Offline**                  | Nada muda.                                                                                                                                                                                                                                                                                |
| **Rodada não salva**         | Nada muda na tabela (ela mostra o estado na memória, que é o que o jogador viu no resumo); o aviso e o "Jogar rodada" bloqueado são da moldura.                                                                                                                                           |

## Celular em pé (360px), deitado e desktop

- **360px:** a caixa da tabela tem 326px por dentro (margem `space-4` e borda de 1px). A coluna fixa pode ter até **60%** dela (decisão 5 do CEO; o Elenco continua com 50%), 195px com o respiro e a linha da borda, ou cerca de 174px de conteúdo. A conta: bloco da posição 32 + 4 + escudo 32 + 8 + nome 95 = 171px. O nome curto mais largo do conjunto, "Inter-Regional" em `body-strong`, mede 94,8px; a palavra de zona mais larga em pt-BR, "Rebaixamento" em `caption`, mede 75px (medidas com as fontes do jogo). Nenhum nome corta. Ficam visíveis, sem rolar, Pts, J e V; o resto rola por dentro da caixa, nunca a página. A linha da borda da coluna fixa mostra onde a rolagem começa.
- **Reticências só como último recurso:** a célula mantém o `max-inline-size` (agora com o limite de 60%). Se uma lista de clubes futura tiver um nome mais largo, ele corta com reticências, e o `npm run content:check` deveria avisar antes (pedido ao `developer`, ver "Medidas").
- **390px:** caixa de 358px; a coluna fixa usa o que precisa (cerca de 192px), e aparecem Pts, J, V e E.
- **Deitado (844×390):** a coluna de conteúdo ocupa a largura da tela menos as margens (cerca de 810px), porque a moldura só limita a largura a partir de 900px ([navegacao.md](navegacao.md)), como no Elenco. A tabela inteira cabe (cerca de 650px com % e Últimos 5) e a caixa não rola. A linha continua com a mesma altura; na altura baixa (`breakpoint-short`) nada muda, a página só rola.
- **Desktop (a partir de 900px):** a coluna de conteúdo tem `layout-content-max` (720px), com a barra lateral e a Tabela ativa; a tabela inteira cabe e a caixa não rola.
- **A `caption` visível rola junto com as colunas:** ela fica dentro da caixa da tabela, com a largura da tabela, então "Depois da rodada N" sai de vista quando o jogador rola até as últimas colunas e volta ao rolar para o início. É o comportamento da ScrollTable (o Elenco faz igual) e fica assim na T-031: a coluna fixa continua no lugar e a rodada não é informação que se perca. Tirar a `caption` visível da área que rola é a proposta 31 de [componentes.md](componentes.md#propostas-ao-design-system), pendente.

## Movimento (decisão 6 do CEO)

- **A seta faz um movimento curto ao abrir a aba:** cada bloco de mudança (ícone e número) entra com 4px de deslocamento na direção dele (o de subida vem de baixo, o de queda vem de cima) e opacidade de 0 a 1, em 300 ms, `ease-out`, **uma vez**, todas as linhas juntas. Sem repetição, sem atraso escalonado, sem número que corre. É a "tabela com setas animadas" do PROJETO, no mínimo que ela pede.
- A duração fica escrita na TableRow, com comentário apontando para a proposta 2 de [componentes.md](componentes.md#propostas-ao-design-system) (durações de movimento), como o Skeleton.
- **Com `prefers-reduced-motion`:** a seta aparece parada, já no lugar (a regra global do `app.css` zera a animação). O "+2" está sempre escrito.
- Nada mais se mexe: a rolagem até o meu clube é instantânea, sem rolagem suave, com ou sem movimento reduzido.

## Acessibilidade

- **Tabela de verdade:** `table` com `caption` (o nome da região que rola, visível); cabeçalhos `th scope="col"` com a sigla visível e o nome completo para o leitor de tela (`table.col.*.full`, pela `abbr` da ScrollTable); a primeira célula de cada linha é `th scope="row"`. O leitor de tela lê cada número com o nome da coluna e o da linha.
- **Ordem da leitura da célula do clube:** posição, nome, "seu clube" (só na minha linha), zona e mudança: "3, Flamingo, seu clube, Rebaixamento, Subiu 2 posições". O escudo, o ícone e o "+2" visíveis são `aria-hidden`; a frase da mudança fica escondida no fim da célula.
- **Nunca só por cor:** zona em palavra na linha e na legenda, com forma além da cor; mudança em número com sinal e frase, com a seta só de reforço; meu clube com negrito, barra, `aria-current` e "seu clube"; Últimos 5 em letra, com a palavra inteira para o leitor de tela.
- **Sem cabeçalho de ordenação:** a ordem é a classificação; nenhuma coluna tem `aria-sort` nem é tocável.
- **Foco:** a caixa da tabela é uma região focável (para rolar pelo teclado), como no Elenco; nada mais da tela recebe foco além da moldura.
- **Contraste:** só pares conferidos pelo `npm run tokens`: `ink` e `ink-muted` sobre `surface-1` e `surface-2`, `on-floodlight` sobre `floodlight`, `ink` sobre `danger-soft`. A borda `danger` da marca e o ícone da seta (`ink-muted`) são reforço, não texto.
- **Números** (posição, mudança, estatísticas, %) em `tabular-nums`.

## Componentes

Props em [componentes.md](componentes.md#casca-da-t-031-tabela-e-da-t-084-calendário).

| Reaproveitados                                                                                           | Novos                     | Mudanças                                                                                                                         |
| -------------------------------------------------------------------------------------------------------- | ------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| ScreenHeader e moldura, Crest, StatusBadge (letra V/E/D), Icon (`arrow-up`, `arrow-down`), ErrorBoundary | PositionMark, TableLegend | ScrollTable: `fixedMax`. TableRow: `layout="full"`, `movement`, `zone`, células com texto para leitor de tela, `form`, `animate` |

Nenhum ícone novo, nenhum token novo, nenhum tipo novo de selo. A marca de zona usa os pares dos Selos e está no design system ([design-system.md](../design-system.md#marca-de-zona-da-tabela-aprovado-pelo-ceo-em-2026-11-14); decisão 3 do CEO, proposta 29 de [componentes.md](componentes.md#propostas-ao-design-system)).

## O que a tela lê (para o `developer`)

| Dado                | De onde                                                                                                                                |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Linhas              | `getStandings(game)` (contrato do motor): posição, pontos, jogos, V, E, D, GP, GC, SG, `form`                                          |
| Rodada da `caption` | `game.round − 1`; pré-temporada pelo `preseason(game)` do Clube; encerrada quando `game.round > SEASON_ROUNDS`                         |
| Mudança             | `getStandings(game, r)` e `getStandings(game, r − 1)`, com `r = game.round − 1`; nenhuma com `r ≤ 1`                                   |
| Zonas               | posição 1; posições maiores que `linhas − RELEGATION_SPOTS` (o número de linhas vem do próprio `getStandings`, nunca de um 20 escrito) |
| %                   | `points / (played × 3)`, arredondado pelo `Intl.NumberFormat`; sem jogos, "—"                                                          |
| Nome e escudo       | `game.clubs[clubId].def` (`shortName` e os campos do escudo)                                                                           |
| Meu clube           | `career.clubId`                                                                                                                        |

As três chamadas ao `getStandings` por abertura da aba (a tabela e as duas das setas) não pesam; se a medição pedir, o `standingsHistory` do contrato dá as tabelas de todas as rodadas numa passada só.

## Fronteira com as outras tarefas

| Tarefa            | O que é dela, não da T-031                                                                                                                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| T-084             | A aba Calendário inteira, a subtela da rodada e a súmula de rodadas antigas ([calendario.md](calendario.md)).                                                                                                                                            |
| T-037             | Fim de temporada: cerimônia, classificação final na tela própria (com a mesma TableRow e a mesma marca de zona), o aviso P2 de que ninguém cai nesta versão, a passagem para a próxima temporada.                                                        |
| T-045             | Tabela "se terminasse agora" (US-071) durante a partida, no intervalo e no "como ficou" do resumo, com as setas comparadas com a tabela do início da rodada e um título de parcial. Reaproveita a TableRow, a PositionMark e a TableLegend desta tarefa. |
| T-046             | A versão de 5 linhas do plantão grande (US-073), com a mesma linha.                                                                                                                                                                                      |
| T-034             | Notícias dos fatos de tabela (`enteredZ4`, `leftZ4`, `relegatedClinched`); a Tabela não mostra notícia.                                                                                                                                                  |
| Etapa 2 em diante | Outras divisões, copas e as zonas de Libertadores e Sul-Americana; acesso e rebaixamento de verdade. Artilharia e estatísticas históricas, Etapa 4 (fora do escopo da US-023).                                                                           |

## Textos (chaves)

Para o `content-writer`; os textos vão ao CEO no próximo lote. Todas em `app/src/content/<idioma>/ui.json`. As larguras são a 360px, medidas na fonte de cada lugar, não em letras. Onde há ícone ou marca ao lado, a regra é a de [escalacao.md](escalacao.md#textos-chaves) adaptada: o ícone e o espaço contam na largura, e o E2E confere o texto mais longo dos três idiomas. Siglas de coluna são do idioma (em inglês, "W" e "L"; em espanhol, "G" e "P", por exemplo); nomes de clube nunca se traduzem.

### Já existem e são reaproveitadas

| Chave                                                                                                                                                       | Onde                                                                    |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| `nav.tab.table`                                                                                                                                             | título da tela                                                          |
| `table.col.club`, `table.col.played`, `table.col.played.full`, `table.col.goalDiff`, `table.col.goalDiff.full`, `table.col.points`, `table.col.points.full` | cabeçalhos (também na mini tabela do Clube: quem mudar um muda o outro) |
| `table.mine`                                                                                                                                                | "seu clube" na minha linha                                              |
| `club.table.preseason`                                                                                                                                      | `caption` visível na pré-temporada                                      |
| `club.form.none`                                                                                                                                            | leitor de tela do "—" em % e Últimos 5 na pré-temporada                 |
| `result.W`, `result.D`, `result.L`, `result.W.short`, `result.D.short`, `result.L.short`                                                                    | Últimos 5 (letra visível, palavra lida)                                 |
| `round.table.up.one/.other`, `round.table.down.one/.other`                                                                                                  | frase da mudança para o leitor de tela (no resumo, é texto visível)     |
| `play.blocked.seasonOver`                                                                                                                                   | "Jogar rodada" com a temporada encerrada (moldura)                      |

### Novas da T-031

| Chave                         | Onde aparece                                                    | Limite a 360px                                                                   | Placeholders |
| ----------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------- | ------------ |
| `table.caption`               | `caption` visível acima das colunas (e nome da região que rola) | 1 linha em `caption` em ~300px                                                   | `{round}`    |
| `table.caption.final`         | `caption` com a temporada encerrada                             | idem                                                                             | `{season}`   |
| `table.col.wins`              | cabeçalho V                                                     | até ~28px em `rotulo` (caixa alta), a largura de um número de 2 dígitos          | —            |
| `table.col.wins.full`         | nome completo do cabeçalho (leitor de tela)                     | —                                                                                | —            |
| `table.col.draws`             | cabeçalho E                                                     | idem a `wins`                                                                    | —            |
| `table.col.draws.full`        | idem                                                            | —                                                                                | —            |
| `table.col.losses`            | cabeçalho D                                                     | idem                                                                             | —            |
| `table.col.losses.full`       | idem                                                            | —                                                                                | —            |
| `table.col.goalsFor`          | cabeçalho GP                                                    | idem                                                                             | —            |
| `table.col.goalsFor.full`     | idem ("Gols pró")                                               | —                                                                                | —            |
| `table.col.goalsAgainst`      | cabeçalho GC                                                    | idem                                                                             | —            |
| `table.col.goalsAgainst.full` | idem ("Gols contra")                                            | —                                                                                | —            |
| `table.col.percent`           | cabeçalho % (decisão 4)                                         | até ~40px em `rotulo`                                                            | —            |
| `table.col.percent.full`      | idem ("Aproveitamento")                                         | —                                                                                | —            |
| `table.col.form`              | cabeçalho Últimos 5 (decisão 4)                                 | 1 linha em `rotulo`, até ~120px (a largura de 5 selos de letra)                  | —            |
| `table.col.form.full`         | idem                                                            | —                                                                                | —            |
| `table.zone.leader`           | palavra embaixo do nome do 1º                                   | **1 linha em `caption`, até ~95px** (a coluna do nome), para a linha não crescer | —            |
| `table.zone.champion`         | idem, com a temporada encerrada                                 | idem                                                                             | —            |
| `table.zone.relegation`       | palavra embaixo do nome do 17º ao 20º                           | idem ("Rebaixamento" mede 75px; "Zona de rebaixamento" não cabe)                 | —            |
| `table.legend.title`          | `h2` escondido da legenda                                       | —                                                                                | —            |
| `table.legend.leader`         | item da legenda, depois da marca de exemplo (~28px + `space-2`) | até 2 linhas em `caption` em ~260px                                              | —            |
| `table.legend.champion`       | idem, com a temporada encerrada                                 | idem                                                                             | —            |
| `table.legend.relegation`     | item da legenda                                                 | idem                                                                             | `{count}`    |
| `table.legend.movement`       | item da legenda, depois das duas setas (~32px + `space-2`)      | idem, em ~256px                                                                  | —            |

São 24 chaves novas. A mudança visível ("+2") e o % não têm chave: são números formatados pelo `Intl.NumberFormat` do idioma.

## Medidas para o E2E

`tests/e2e/standings.spec.ts`, com `PRANCHETA_ENV=test`, numa carreira de teste com fixture conhecida (Completo, "só resultado"). Larguras 360×740, 390×844, 844×390 (deitado) e 1280×800; temas `noite` e `dia`. O teste importa o motor por `index.ts` para conferir com o `getStandings` do save.

1. **Coluna fixa (US-023, cenário 1):** a 360×740, a caixa da tabela rola (`scrollWidth > clientWidth`); depois de rolar até o fim, o `x` do primeiro `th[scope="row"]` não muda (±1 px) e a largura dele, com o respiro e a linha da borda, é no máximo 60% da caixa. Os cabeçalhos estão na ordem Clube, Pts, J, V, E, D, GP, GC, SG, %, Últimos 5, cada sigla com o nome completo como texto acessível.
2. **Ordem e números:** as 20 linhas estão na ordem do `getStandings` do save; em cada linha, os números visíveis são os da `StandingRow` (SG com sinal); % e Últimos 5 conferem com `points`, `played` e `form`. Os números têm `font-variant-numeric: tabular-nums`.
3. **Mudança (cenário 2):** depois de 3 rodadas, para cada clube, a mudança visível confere com `getStandings(game, 2)` contra `getStandings(game, 3)`: quem subiu tem `arrow-up` e "+n", quem caiu `arrow-down` e "−n" (ou o sinal de menos do idioma), quem ficou não tem nem ícone nem número; o texto acessível da célula do clube contém a frase de `round.table.up.*` ou `round.table.down.*`. Há pelo menos um clube que subiu 2 ou mais na fixture (se não houver, o teste escolhe outra rodada da fixture e diz qual).
4. **Movimento:** com `reducedMotion: 'reduce'`, `document.getAnimations().length === 0` com a Tabela aberta; sem ele, toda animação da página tem `iterations` 1 e `duration` ≤ 400 ms, e `getAnimations()` fica vazio 1 s depois de abrir.
5. **Zonas (cenário 3):** depois da rodada 1, a linha 1 tem o texto de `table.zone.leader`, as linhas 17 a 20 têm o de `table.zone.relegation`, as linhas 2 a 16 não têm texto de zona; a legenda está visível com os textos de `table.legend.leader`, `table.legend.relegation` e `table.legend.movement`. Com o tema `dia` e com o `noite`, o texto de zona continua lá (a medida não depende de cor).
6. **Meu clube (cenário 4):** a linha do meu clube tem `aria-current="true"`, o texto acessível da célula contém `table.mine`, o nome tem `font-weight` ≥ 600 e o fundo das células é diferente do das outras linhas.
7. **Leitura da célula:** o nome acessível do `rowheader` do meu clube, numa rodada em que ele mudou de posição e está numa zona (fixture forçada, ou a rodada escolhida pelo teste), segue a ordem posição, nome, "seu clube", zona, mudança.
8. **Pré-temporada:** numa carreira nova, a `caption` é `club.table.preseason`; nenhuma linha tem texto de zona nem mudança; todas têm 0 ponto; não há legenda.
9. **Rodada 1:** depois da primeira rodada, nenhuma linha tem mudança; as zonas e a legenda aparecem.
10. **Temporada encerrada:** numa carreira na rodada 39 (fixture de save ou `playUntil`), a `caption` é a de `table.caption.final`, o 1º tem `table.zone.champion` e a legenda `table.legend.champion`; o "Jogar rodada" mostra `play.blocked.seasonOver`.
11. **Abre no meu clube:** a 360×740, com o meu clube num lugar abaixo da primeira tela (do 12º para baixo, fixture escolhida), ao abrir a aba a linha dele está inteira entre o fim do cabeçalho e o topo do "Jogar rodada"; com o meu clube entre os 5 primeiros, `scrollY` é 0.
12. **Nomes inteiros:** a 360×740, com o meu clube trocado para o de nome curto mais largo ("Inter-Regional"), em cada linha o elemento do nome tem `scrollWidth <= clientWidth`, e o texto de zona ocupa uma linha só (altura de uma linha de `caption`), em pt-BR, es e en.
13. **Altura e alvos:** todas as linhas têm a mesma altura (±1 px), de pelo menos 44px. Nenhum elemento da tabela é `a` nem `button`.
14. **Sem rolagem lateral da página** em 360, 390, 844 e 1280, em pt-BR, es e en; a 844 e a 1280, a caixa da tabela não rola (`scrollWidth <= clientWidth`).
15. **Desktop (1280×800):** barra lateral com a Tabela marcada com `aria-current="page"`; a tabela cabe sem rolar.

**No Vitest (T-031), pedidos ao `developer`:** as linhas da tabela em função pura de `app/src/ui/` (zona por posição e `RELEGATION_SPOTS`, campeão só com `game.round` 39, nenhuma zona na pré-temporada, mudança nenhuma com `r ≤ 1`, % com 0 jogos); a abertura no meu clube (a conta de rolagem, sem DOM, pela posição da linha e a altura da área); e um aviso no `npm run content:check` quando um nome curto de clube passar da largura da coluna (o `ux-designer` dá a largura: 95px em `body-strong`), para uma lista nova não cortar nomes calada.

**E2E existentes que mudam (T-031):** nenhum espera o Placeholder da aba Tabela; o `club-squad.spec.ts` que segue o link "Tabela" do Clube pode passar a conferir que a tela abre (`h1` "Tabela").

## Marcas do cenário

Nenhuma. A competição não tem nome nem marca na tela: o título é "Tabela", e a `caption` diz só a rodada.

## Decisões do CEO (T-031)

Aprovadas pelo CEO em 2026-11-14 ("ok recomendado"), todas pela recomendação do `ux-designer`, junto das propostas 29 e 30 ao design system. As de [calendario.md](calendario.md#decisões-do-ceo-t-084) são da T-084.

1. **T-031 dividida em duas M:** T-031 (Tabela) e T-084 (Calendário, rodada e súmula de rodada antiga). A Tabela vem primeiro; as duas não dependem uma da outra.
2. **Zonas da 1a: só o 1º e os 4 últimos** (US-023), sem as zonas de Libertadores e Sul-Americana nem o aviso "as copas chegam numa próxima versão" de [temporada.md](../temporada.md#pontos-e-tabela) (P3). O `game-designer` alinha a linha "Zonas na tela" de temporada.md com a US-023.
3. **Marca de zona:** a posição numa caixinha com os pares dos Selos, a palavra da zona embaixo do nome e a legenda. Registrada em [design-system.md](../design-system.md#marca-de-zona-da-tabela-aprovado-pelo-ceo-em-2026-11-14).
4. **Colunas % e Últimos 5** no fim da tabela, além das 8 da US-023 (24 chaves novas, com as 4 delas).
5. **Coluna fixa da Tabela com até 60% da caixa** (o Elenco continua com 50%), para nenhum nome de clube cortar a 360px. Registrada em [design-system.md](../design-system.md#coluna-fixa-das-tabelas-que-rolam-aprovado-pelo-ceo-em-2026-11-14).
6. **Seta com um movimento curto:** 300 ms, uma vez, ao abrir a aba; parada com movimento reduzido.
7. **Sem atalho "ir para o meu clube":** a Tabela abre já mostrando a linha do meu clube (e o Calendário, a próxima rodada; decisão 4 da T-084).
8. **O aviso de que ninguém cai nesta versão (P2) fica só no Fim de temporada** (T-037), como a US-025 pede, e não na legenda da Tabela.
