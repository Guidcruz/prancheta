# Elenco

**Histórias:** US-016 · **Prioridade:** Must · **Ordem:** 5 · **Tarefa:** T-028

## Objetivo

Ver o estado de todos os atletas de uma vez para decidir quem joga.

## O que o jogador faz

Lê o elenco, troca a ordem (posição, nota, condição) e toca num atleta para abrir o card completo ([jogador.md](jogador.md)).

## Navegação

- Aba **Elenco** da moldura (`#/squad`), título `nav.tab.squad`. Também se chega pela linha de desfalques da tela Clube.
- Tocar num atleta abre a folha do jogador com entrada própria no histórico (`history.pushState`, como o menu "Mais"): o voltar do celular fecha a folha e fica no Elenco.
- **Elenco | Escalação | Tática** (o SegmentedControl do topo do rascunho do kickoff) entra com a T-029, quando houver Escalação e Tática. Na T-028 a aba só tem o Elenco e o seletor não aparece (P3: nada de "em breve").
- A ordem escolhida fica lembrada enquanto a carreira está aberta (estado da tela, não vai ao save).

## Conteúdo (de cima para baixo)

1. **Ordenar por** (SegmentedControl, legenda visível): Posição · Nota · Condição. Padrão: Posição.
   - **Posição:** GOL, ZAG, LAT, VOL, MEI, ATA (a ordem de `POSITIONS`); dentro de cada posição, nota geral decrescente; empate pela ordem do elenco.
   - **Nota:** nota geral decrescente; empate pela ordem de posição e depois do elenco.
   - **Condição:** condição crescente (os mais cansados primeiro); empate pela nota geral decrescente.
2. **Tabela do elenco** (ScrollTable, legenda visível "Elenco do Tufão: 25 jogadores"):
   - **Coluna fixa (Jogador):** código da posição numa caixinha (`ATA`), o nome curto (`Player.name.display`) como botão, e embaixo dele os selos de situação (StatusBadge com ícone e texto): "Lesionado, 3 rodadas", "Suspenso, 1 jogo", "Promessa". Nome longo corta com reticências; o card mostra inteiro.
   - **Colunas que rolam, nesta ordem:** Nota (nota geral), Cond. (condição 0 a 100), Moral (0 a 100), Forma (média das notas dos últimos 5 jogos, uma casa decimal, "—" sem jogos), Idade. A ordem põe primeiro o que decide a escalação: no celular em pé, Nota, Cond. e Moral aparecem sem rolar.
   - Condição e moral são números reais no motor; a tela mostra `Math.round` (`jogadores.md`, "Frações").
   - **Agrupamento:** com a ordem "Posição", uma linha de grupo (GroupRow) antes de cada posição ("Goleiros", "Zagueiros"...). Com "Nota" e "Condição", lista corrida, sem grupos.
   - A coluna ordenada tem `aria-sort` e uma seta no cabeçalho; com "Posição", nenhuma coluna tem `aria-sort` (a posição não é coluna; os grupos dizem a ordem).
3. **Titular e reserva:** não aparecem na T-028. Quem é titular depende da escalação da T-029, que traz o selo e o agrupamento por titulares e reservas (muda o rascunho do kickoff, que separava os dois grupos aqui).

O número do potencial não aparece em lugar nenhum. O selo "Promessa" (decisão do CEO na US-016) aparece para quem se enquadra na regra de `jogadores.md`, "Potencial", e a tela recebe do motor só o booleano (ver "Pedidos ao motor" em [jogador.md](jogador.md#pedidos-ao-motor)).

## Ao alcance do polegar

A lista inteira é tocável: cada linha abre o card (o toque em qualquer ponto da linha é atalho; o botão do nome é o caminho do teclado e do leitor de tela). "Jogar rodada" flutua acima da TabBar, e o fim da lista tem o respiro da moldura. O seletor de ordem fica em cima porque se usa pouco.

## Estados

| Estado                        | O que aparece                                                                                                                                                                                                                                                                                                                                                                          |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Carregando**                | Skeleton `card` × 8, com `squad.loading`; só depois de 300 ms. Como no Clube, hoje a carreira já está na memória e o estado quase não aparece.                                                                                                                                                                                                                                         |
| **Vazio**                     | Não existe: o elenco é sempre gerado (25 jogadores; `SQUAD_SIZE`). Um elenco vazio é bug e cai na fronteira de erro.                                                                                                                                                                                                                                                                   |
| **Sem jogos (pré-temporada)** | A coluna Forma mostra "—" em todos, lido como `squad.form.none` ("sem jogos"). Condição 100 para todos.                                                                                                                                                                                                                                                                                |
| **Erro**                      | Fronteira da aba (T-023): ErrorState `area` no lugar da tabela; abas e "Jogar rodada" continuam.                                                                                                                                                                                                                                                                                       |
| **Realismo completo**         | Como descrito: coluna Cond., ordem por Condição, selos de lesão e suspensão quando houver.                                                                                                                                                                                                                                                                                             |
| **Realismo simplificado**     | Sem a coluna Cond. e sem a opção "Condição" no seletor: nesse modo todos voltam a 100 entre as rodadas, e uma coluna com 25 vezes "100" não ajuda a decidir. Nunca há selo de lesão nem de suspensão (cartão e lesão só valem dentro do jogo). Fica Posição · Nota. Decisão do CEO (2026-11-07): no Simplificado a condição some da tela, apesar de a US-016 pedir ordenar por fadiga. |
| **Offline**                   | Nada muda.                                                                                                                                                                                                                                                                                                                                                                             |

## Desktop (a partir de 900px) e celular deitado

- Desktop: todas as colunas cabem sem rolagem lateral na coluna normal (`layout-content-max`); a tabela não precisa de `wide`. O card abre como diálogo flutuante ancorado pela base (o BottomSheet da T-025), não como painel lateral (decisão do CEO, 2026-11-07).
- Celular deitado (844×390): todas as colunas cabem; a tabela só rola na vertical, com a página.
- Celular a 360px: a coluna fixa ocupa no máximo 50% da caixa da tabela, contando o respiro da célula e a linha da borda (o conteúdo da célula tem `calc(50cqi − respiro − 1px)`; ver [componentes.md](componentes.md#casca-da-t-028-clube-elenco-e-jogador)); Nota, Cond. e Moral ficam visíveis, Forma e Idade rolam por dentro da tabela. A linha da borda da coluna fixa mostra onde a rolagem começa.
- O cabeçalho da tabela não fica fixo ao rolar a página: a caixa da tabela rola na horizontal, e `position: sticky` vertical não atravessa essa caixa. Com 25 linhas e grupos, a legenda dos grupos basta.

## Componentes

SegmentedControl, ScrollTable, GroupRow, PlayerRow (o CardJogador `row`), StatusBadge, Skeleton, ErrorState, ErrorBoundary. Casca em [componentes.md](componentes.md#casca-da-t-028-clube-elenco-e-jogador).

## Textos (chaves)

Rascunho pt-BR para o `content-writer`, em `ui.json`. `status.*` e `position.*` também valem para Escalação, Partida e Resumo.

| Chave                      | Rascunho pt-BR                             | Onde                                                   |
| -------------------------- | ------------------------------------------ | ------------------------------------------------------ |
| `squad.loading`            | Carregando o elenco...                     | Skeleton                                               |
| `squad.sort.legend`        | Ordenar por                                | legenda do SegmentedControl                            |
| `squad.sort.position`      | Posição                                    | opção                                                  |
| `squad.sort.overall`       | Nota                                       | opção                                                  |
| `squad.sort.condition`     | Condição                                   | opção (só no Completo)                                 |
| `squad.caption.one`        | Elenco do {club}: {count} jogador          | legenda da tabela                                      |
| `squad.caption.other`      | Elenco do {club}: {count} jogadores        | legenda da tabela                                      |
| `squad.col.player`         | Jogador                                    | cabeçalho da coluna fixa                               |
| `squad.col.overall`        | Nota                                       | cabeçalho                                              |
| `squad.col.overall.full`   | Nota geral                                 | nome completo (leitor de tela)                         |
| `squad.col.condition`      | Cond.                                      | cabeçalho                                              |
| `squad.col.condition.full` | Condição física                            | nome completo                                          |
| `squad.col.morale`         | Moral                                      | cabeçalho                                              |
| `squad.col.form`           | Forma                                      | cabeçalho                                              |
| `squad.col.form.full`      | Forma: média das notas dos últimos 5 jogos | nome completo                                          |
| `squad.col.age`            | Idade                                      | cabeçalho                                              |
| `squad.form.none`          | sem jogos                                  | leitor de tela do "—" na coluna Forma                  |
| `position.GK.short`        | GOL                                        | caixinha da posição                                    |
| `position.CB.short`        | ZAG                                        |                                                        |
| `position.FB.short`        | LAT                                        |                                                        |
| `position.DM.short`        | VOL                                        |                                                        |
| `position.AM.short`        | MEI                                        |                                                        |
| `position.ST.short`        | ATA                                        |                                                        |
| `position.GK`              | Goleiro                                    | leitor de tela na linha; card do jogador               |
| `position.CB`              | Zagueiro                                   |                                                        |
| `position.FB`              | Lateral                                    |                                                        |
| `position.DM`              | Volante                                    |                                                        |
| `position.AM`              | Meia                                       |                                                        |
| `position.ST`              | Atacante                                   |                                                        |
| `position.GK.group`        | Goleiros                                   | GroupRow                                               |
| `position.CB.group`        | Zagueiros                                  |                                                        |
| `position.FB.group`        | Laterais                                   |                                                        |
| `position.DM.group`        | Volantes                                   |                                                        |
| `position.AM.group`        | Meias                                      |                                                        |
| `position.ST.group`        | Atacantes                                  |                                                        |
| `status.injured.one`       | Lesionado, {count} rodada                  | StatusBadge `injured` (US-016: "Lesionado, N rodadas") |
| `status.injured.other`     | Lesionado, {count} rodadas                 | StatusBadge `injured`                                  |
| `status.suspended.one`     | Suspenso, {count} jogo                     | StatusBadge `suspended` (texto aprovado pelo CEO)      |
| `status.suspended.other`   | Suspenso, {count} jogos                    | StatusBadge `suspended`                                |
| `status.prospect`          | Promessa                                   | StatusBadge `prospect`                                 |

Os códigos de posição têm no máximo 3 letras nos três idiomas (sugestão para o `content-writer`: es POR, DEF, LAT, MCD, MCO, DEL; en GK, CB, FB, DM, AM, ST). Cabeçalhos curtos vêm com o nome completo em `.full`; a caixinha da posição tem largura mínima para 3 letras.

## Acessibilidade

- **Tabela de verdade** (`table`, `caption`, `th scope="col"`, `th scope="row"` na coluna fixa, `th scope="colgroup"` nos grupos): o leitor de tela lê "Atacante, Ildo Albuquerque, Lesionado, 3 rodadas" e o cabeçalho de cada número.
- **Linhas ≥ 44px**; o botão do nome tem pelo menos 44×44px (`min-block-size` e `min-inline-size: var(--touch)`), também quando o nome é curto. Linha com selo fica mais alta (cerca de 72px), sem cortar o selo.
- **Situação nunca só por cor:** ícone + texto do conteúdo (US-016). A caixinha da posição tem o código em texto, e a posição inteira para leitor de tela.
- **Ordenação:** grupo de rádio nativo (setas do teclado trocam a opção); `aria-sort` no cabeçalho da coluna ordenada.
- **Caixa da tabela** é uma região nomeada pela legenda e focável, para rolar pelo teclado.
- **Foco:** ao fechar o card, o foco volta ao botão do nome da linha de origem, também quando o card foi aberto por um toque fora do botão, em outro ponto da linha. A tela guarda o botão de origem e devolve o foco a ele; não depende do `<dialog>` nativo, que devolveria o foco ao elemento ativo (o `body`, num toque na linha).
- **Texto só para leitor de tela dentro das células** ("sem jogos" da coluna Forma): a célula numérica tem `position: relative`, para o texto escondido ficar dentro do recorte da caixa que rola e não criar rolagem lateral da página.
- **Números** em `tabular-nums`, alinhados à direita.
- **Movimento:** nenhum; trocar a ordem só reordena.

## Medidas para o E2E

1. **Lista (US-016):** a tabela tem 25 linhas de jogador (`tbody th[scope="row"]`), cada uma com nome, posição, idade, nota, forma e moral (e condição no Completo).
2. **Ordenar:** "Nota" deixa as notas em ordem decrescente e põe `aria-sort="descending"` em "Nota"; "Condição" deixa a condição em ordem crescente com `aria-sort="ascending"`.
3. **Coluna fixa:** a 360×740, depois de rolar a caixa da tabela até o fim (`scrollLeft = scrollWidth`), o `x` do primeiro `th[scope="row"]` não muda (±1 px), e a largura dele, com o respiro e a linha da borda, é no máximo 50% da largura da caixa. A mesma regra vale para a coluna do clube na mini tabela do Clube.
4. **Sem rolagem lateral da página** em 360, 390, 844 (deitado) e 1280; no desktop e deitado, a caixa da tabela não rola (`scrollWidth <= clientWidth`).
5. **Situação:** com um jogador lesionado (3 rodadas) e outro suspenso forçados na fixture, as linhas mostram "Lesionado, 3 rodadas" e "Suspenso, 1 jogo" como texto visível, cada um com um `svg` ao lado.
6. **Promessa:** um jogador que o motor marca como promessa mostra o selo; outro, não. A garantia de que o número nunca aparece fica num teste unitário, não no E2E: nenhum arquivo de `app/src/ui/` lê o campo `potential` (busca no código), e a tela só chama a função de leitura do motor.
7. **Simplificado:** sem cabeçalho "Cond." e sem a opção "Condição".
8. **Alvos ≥ 44px:** opções do seletor e botões de nome.
9. **Abrir e voltar:** tocar numa linha abre o card; o voltar do navegador fecha e a URL continua `#/squad`.

## Marcas do cenário

Nenhuma.

## Decisões do CEO (T-028)

Aprovadas em 2026-11-07, com a lista completa em [jogador.md](jogador.md#decisões-do-ceo-t-028). As desta tela:

- **Realismo simplificado sem condição:** sem a coluna Cond. e sem a opção "Condição" no seletor.
- **Card do jogador no desktop como diálogo** ancorado pela base, não painel lateral.
