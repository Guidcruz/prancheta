# Design system (resumo)

A fonte é o artefato "Prancheta" no claude.ai (tokens, brand book e componentes com prévia). Os tokens estão em `design/tokens.json` e viram `app/src/tokens.css` com `npm run tokens`, que também falha se algum par de cores declarado cair abaixo de 4,5:1.

Regras que o `ux-designer` cobra:

- Só tokens: nenhuma cor, fonte ou raio literal fora de `tokens.css`; classes utilitárias `botao` e `display-xl` para os tamanhos fora da escala de texto.
- Mobile first, uma mão: abas embaixo, "Jogar rodada" sempre acessível, alvos ≥ 44px.
- Tema `noite` padrão e `dia` opcional; contraste ≥ 4,5:1 nos dois.
- Resultado nunca só por cor (V/E/D ou ícone); `prefers-reduced-motion`.
- A cor de faixa só pinta números; a cor de setor só pinta o fundo da sigla da posição ("Onde cada cor pinta").
- Componentes base: Escudo, CardPartida, LinhaTabela, CardJogador, BarraAbas, Botao, Noticia, Placar (Scoreboard; aprovado pelo CEO em 2026-11-14).
- Na partida, nada só por cor também no campo: o visitante tem marca de forma, e o canvas não carrega informação que não esteja na narração ("Campo da partida").
- Textos em `app/src/content/<idioma>/`; nome, logo e cores em `config/prancheta.config.ts`.

## Tipografia

A escala completa (família, tamanho, entrelinha, peso e uso de cada estilo) está em `design/tokens.json`, em `typography.groups`. Aqui ficam só os acréscimos aprovados depois da exportação do artefato.

### Nome na figurinha (aprovado pelo CEO em 2026-11-04)

| Token               | Família                    | Peso | Tamanho / entrelinha | Uso                                                                |
| ------------------- | -------------------------- | ---- | -------------------- | ------------------------------------------------------------------ |
| `sticker-name`      | display (Barlow Condensed) | 800  | 20px / 24px          | Nome curto do clube na figurinha (cartão de clube do álbum).       |
| `sticker-name-long` | display (Barlow Condensed) | 800  | 17px / 22px          | O mesmo nome quando é longo demais para caber em uma linha a 20px. |

- Os dois tokens moram em `design/tokens.json`, grupo "Placar e títulos", e chegam ao CSS por `npm run tokens`; nenhum componente declara esses tamanhos à mão.
- A troca para `sticker-name-long` é por comprimento do nome, decidida no componente (no site, `Sticker.astro` usa o longo quando o nome curto passa de 10 caracteres).
- Uso restrito à figurinha. Nome de clube em card comum continua em `subtitulo`; em tabela, em `body-strong`.

### Mínimo do `display-xl` (aprovado pelo CEO em 2026-11-04)

| Token        | Antes                      | Depois                     |
| ------------ | -------------------------- | -------------------------- |
| `display-xl` | `clamp(72px, 21vw, 196px)` | `clamp(64px, 21vw, 196px)` |

- Só o mínimo muda, de 72px para 64px, para "PRANCHETA" caber em uma linha a 320px de largura. O máximo (196px), a entrelinha (0,84), o peso (800), o espaçamento e a caixa alta continuam iguais.
- Uso continua restrito ao nome do jogo no hero do Início do site.

### Número da etapa (aprovado pelo CEO em 2026-11-04)

| Token          | Família                    | Peso | Tamanho / entrelinha | Uso                                                           |
| -------------- | -------------------------- | ---- | -------------------- | ------------------------------------------------------------- |
| `stage-number` | display (Barlow Condensed) | 800  | 26px / 1             | Número da etapa nos cartões de etapa e nas tabelas de etapas. |

- Mora em `design/tokens.json` e chega ao CSS por `npm run tokens`; nenhum componente declara esse tamanho à mão.
- Mesma família display já usada nos títulos; não entra fonte nova.
- Uso restrito ao número da etapa. O nome e a descrição da etapa continuam nos estilos de texto comuns; números em tabela seguem em `tabular-nums`.

### Face condensada sem caixa alta (aprovado pelo CEO em 2026-11-07)

- Texto curto que precisa caber em cerca de 60px de largura (hoje, a marca "Improvisado" / "Fora de posição" na vaga do campo da escalação) usa `font: var(--type-rotulo)`: a face condensada do `rotulo`, sem a caixa alta e o espaçamento da classe `rotulo`.
- Sem token novo; nenhum componente declara família, tamanho ou peso à mão.

## Tamanhos (aprovado pelo CEO em 2026-11-07)

| Token               | Valor | Uso                                                                                                                   |
| ------------------- | ----- | --------------------------------------------------------------------------------------------------------------------- |
| `size-bar`          | 4px   | Altura das barras de atributo, condição e moral (AttributeBar).                                                       |
| `size-bar-lg`       | 8px   | Altura da barra do termômetro da torcida (FanThermometer).                                                            |
| `size-medallion-xs` | 24px  | Só escudo, dentro de uma linha de texto: narração da partida e súmula (proposta 40, aprovada pelo CEO em 2026-11-15). |
| `size-medallion-sm` | 32px  | Escudo e avatar pequenos: listas, linhas de tabela, barra lateral.                                                    |
| `size-medallion-md` | 48px  | Escudo e avatar médios: cards.                                                                                        |
| `size-medallion-lg` | 64px  | Escudo e avatar grandes: cabeçalho da tela Clube.                                                                     |
| `size-medallion-xl` | 96px  | Escudo e avatar em destaque: card do jogador, comemoração.                                                            |

- Moram em `design/tokens.json`, no grupo de espaçamento ao lado do `touch` (o mesmo caso: tamanho, não espaçamento), e chegam ao CSS por `npm run tokens`.
- Escudo e avatar dividem a mesma escala: um medalhão de 48px tem o mesmo tamanho seja clube ou jogador.
- Os geradores (`shield.ts`, `avatar.ts`) recebem a largura em número; por isso `CREST_SIZES` e `AVATAR_SIZES` repetem os valores, com comentário apontando para cá, até o gerador de tokens exportar também constantes TypeScript.
- Nenhuma barra nem medalhão declara altura ou largura à mão fora dessas medidas.
- **`xs` (aprovado pelo CEO em 2026-11-15):** só o `Crest` usa, e só dentro de uma linha de texto (a linha de lance da CommentaryFeed e da MatchTimeline); o avatar não tem `xs`. É sempre decorativo, com o nome do clube escrito na mesma linha (o escudo pequeno não tem contraste garantido), e nunca aumenta a altura da linha. Desenho em [componentes.md](telas/componentes.md#o-clube-de-cada-lance-narração-e-súmula-aprovado-pelo-ceo-em-2026-11-15).

## Placar (Scoreboard) (aprovado pelo CEO em 2026-11-14)

O placar é componente base do PROJETO ("Componentes base") e agora também do design system. Implementação: `Scoreboard` em `app/src/ui/components/` (T-030); props em [componentes.md](telas/componentes.md#casca-da-t-030-e-da-t-083-resumo-da-rodada-e-súmula).

- **Desenho:** mandante à esquerda, visitante à direita, cada um com escudo e nome curto; os gols no meio, com o separador do conteúdo (`match.score.versus`). Fundo `surface-1`, texto em `ink`; nenhuma cor de resultado no placar.
- **Dois tamanhos:** `lg` (escudo `size-medallion-md`, gols em `placar-xl`), no resumo da rodada; `md` (escudo `size-medallion-sm`, gols em `display-lg`), na súmula e abaixo de `breakpoint-short` (480px de altura).
- **Números** em `tabular-nums`. O nome do meu clube em `body-strong`; o outro em `body`. Nomes quebram em até 2 linhas, nunca cortam.
- **Resultado nunca só por cor:** o selo do resultado (StatusBadge com a palavra inteira) vai embaixo do placar, e o placar tem um nome acessível em frase, ou fica `aria-hidden` quando um título já diz o resultado.
- **Ao vivo (aprovado pelo CEO em 2026-11-15, T-032):** na partida, a linha ao vivo fica embaixo dos gols, no lugar do selo do resultado (os dois nunca juntos): o minuto em `numero`, a fase em `caption` e, com a partida pausada, "Pausada" em `body-strong` (o texto é a pista, sem cor nova). Os anúncios para o leitor de tela (gol, pênalti, vermelho, intervalo e fim, só depois do desfecho) ficam numa região escondida `aria-live="polite"` dentro do Placar; o minuto nunca é anunciado. O placar ao vivo usa sempre o tamanho `md`. Especificação: [partida.md](telas/partida.md#conteúdo-de-cima-para-baixo-no-celular-em-pé).
- **Depois:** a faixa de marca do cenário (BrandSlot `scoreboard`, decorativa) entra com as marcas (T-040).
- Sem token novo.

## Padrões de layout

### Tabela vira cartões abaixo de 720px (aprovado pelo CEO em 2026-11-04)

Vale para o site e para as telas futuras do jogo.

**Quando usar.** Em tabelas cujo texto principal (descrição, nome longo, frase) não cabe ao lado da coluna fixa a 360px sem forçar rolagem horizontal para ler a própria linha. Tabelas numéricas curtas (classificação, artilharia) continuam com a coluna do clube fixa e rolagem horizontal, como na regra geral.

**Regras.**

- A partir de 720px a tabela é uma tabela normal: cabeçalho, coluna fixa à esquerda, linhas de 48px, números em `tabular-nums`.
- Abaixo de 720px cada linha passa a ser lida como um cartão: a tabela perde a largura mínima e não rola na horizontal; o texto principal quebra em quantas linhas precisar.
- A coluna fixa (primeira célula) nunca passa de cerca de 40% da largura útil do contêiner, em qualquer largura. O resto é do texto principal.
- Quando a coluna Estado (`.col-state`) some abaixo de 720px, o selo de estado vai para baixo da primeira célula, no elemento `.inline-state`. Os dois existem no markup; o CSS mostra um ou outro, nunca os dois. O selo mantém texto além da cor (estado nunca só por cor).
- A semântica de tabela fica (`table`, `th` de linha e de coluna); a mudança é só visual, para o leitor de tela continuar lendo cabeçalho e célula.
- Linha atual (`aria-current`) mantém o destaque também no formato de cartão, incluindo a primeira célula.
- Só tokens de cor, espaço e raio; o ponto de quebra é o mesmo 720px usado no resto do layout.

**Implementação de referência.** No site, `site/src/components/TableScroll.astro` com a prop `stack`. No jogo, quando aparecer a primeira tabela desse tipo, a casca entra em `app/src/ui/components/` com o mesmo comportamento e as mesmas classes (`.col-state`, `.inline-state`).

### Coluna fixa das tabelas que rolam (aprovado pelo CEO em 2026-11-14)

- Numa tabela com rolagem lateral (ScrollTable), a coluna fixa inteira (conteúdo, respiro e a linha de 1px da borda) ocupa **no máximo 50% da caixa** da tabela, para os números terem lugar. É o padrão (Elenco, T-028).
- Uma tabela pode pedir outro limite (`fixedMax` da ScrollTable), justificado na spec da tela. A **Tabela** (classificação, T-031) pede **60%**, para o nome curto de clube mais largo caber inteiro a 360px ao lado da posição, da mudança e do escudo, com Pts, J e V ainda à vista.
- O limite é em `cqi` da caixa (consulta de contêiner); as linhas o leem de uma variável que a caixa expõe, nunca de um número escrito na linha.
- Reticências só como último recurso, quando o texto não cabe nem no limite.
- Sem token novo. Especificação: [tabela.md](telas/tabela.md#celular-em-pé-360px-deitado-e-desktop) e [componentes.md](telas/componentes.md#casca-da-t-031-tabela-e-da-t-084-calendário).

### Card em duas colunas (aprovado pelo CEO em 2026-11-07)

- Um card de leitura dentro de uma folha (hoje, o card do jogador) passa a duas colunas quando a folha tem **480px** ou mais de largura (`breakpoint-card`): o celular em pé (390px) fica com uma coluna; a folha do celular deitado (720px) e o diálogo do desktop (540px) ficam com duas.
- A consulta é de contêiner (`@container`), não da tela: o que manda é a largura da folha.
- Variáveis CSS não funcionam em `@container`; o valor fica escrito no componente, com comentário apontando para cá, até o gerador de tokens exportar constantes.

### Campo da escalação (aprovado pelo CEO em 2026-11-07)

- O campo da escalação é DOM, não canvas: uma grade de **8 colunas por 10 linhas** sobre `pitch`, com as marcações em `pitch-line` (decorativas). Gol do time embaixo, ataque em cima.
- Cada vaga cobre **2 × 2 células**, na posição da tabela `PITCH_LAYOUT` (`app/src/ui/components/pitch-layout.ts`), na ordem das vagas do motor. Assim uma vaga pode ficar meio passo ao lado ou atrás da vizinha, nenhuma linha visual tem mais de 4 vagas, e cada vaga tem 1/4 da largura do campo (75px a 360px): nenhuma fica abaixo de 44px, nem nas linhas de 5 (5-3-2, 3-5-2).
- Duas vagas nunca dividem uma célula (teste em `pitch-layout.test.ts`). A altura de cada linha da grade é `touch`.
- Leitor de tela e tabulação seguem a ordem das vagas (do goleiro ao ataque); o desenho é complemento.
- Especificação: `docs/design/telas/escalacao.md`, "Desenho do campo".

### Campo da partida (aprovado pelo CEO em 2026-11-15)

- O campo da partida é canvas, `aria-hidden`, decorativo: tudo o que ele mostra está na narração e no placar. Nenhum texto, número ou cartão é desenhado **no canvas**; as etiquetas são DOM por cima dele (proposta 41). Se o canvas falhar, a partida segue só com a narração, sem aviso.
- Campo **inclinado por código** (proposta 46, aprovada pelo CEO em 2026-11-24; ADR-0023): câmera fixa no eixo do meio-campo, perspectiva verdadeira, verticais verticais (traves, placas). Em volta, arquibancadas em `surface-0` → `surface-2` com fileiras em `line`, mureta em `surface-1`, e três filas de placas (fundo e atrás de cada gol) **só com as duas cores de uma marca fictícia** (ADR-0015), sem texto, com contorno de 1px em `line`; nenhuma placa cobre o gramado. Gramado em `pitch` e marcações em `pitch-line`, lidos dos tokens. Refletores em `floodlight` com halo em `beam` no tema noite (proposta 45, aprovada em 2026-11-24) e apagados, em `line`, no dia.
- **Só a bola** (proposta 46): a bola sempre à vista; os discos só nos lances do motor (o finalizador, o cobrador, o artilheiro ou o expulso, e o goleiro que defende), entrando e saindo por opacidade, nunca os 22 juntos. Especificação: [partida-campo-v2.md](telas/partida-campo-v2.md).
- **O mandante fica sempre à esquerda**, atacando para a direita o jogo todo (o mesmo lado do escudo dele no placar), sem trocar de lado no intervalo.
- **Bolinhas:** disco na cor principal do uniforme, com anel de 2px em `ink` (5,94:1 sobre `pitch` no tema noite e 4,09:1 no dia, acima de 3:1 para elemento gráfico); **o visitante tem um ponto no centro**, com um terço do diâmetro, na cor de contraste do uniforme; o mandante é liso. A bola é um disco menor em `ink`, sem anel.
- **Cores dos uniformes são dado** (gerador da T-026, com a regra de choque de cores dentro dele), como as do escudo; só pintam os discos do campo.
- **De onde vem cada cor (T-085):** o disco é o `FieldKit.fill`, de uma cor só (a segunda cor das camisas listradas não é desenhada); o anel e a bola são o token `ink` do tema, nunca o `FieldKit.ring` do gerador (calculado contra o `grass`, ele fica a 2,92:1 sobre o `pitch` noturno); a marca do visitante é o `FieldKit.mark`, pelo menos 3:1 contra o `fill` (decisão 3A da T-085, tomada pelo CEO em 2026-11-15, em [partida.md](telas/partida.md#decisões-para-o-ceo-t-085); regra no gerador da T-026, `docs/art/uniformes.md` §3.1), nunca o `numberColor`.
- **Tamanhos (campo v2):** o campo em metros, 105 × 68 mais uma faixa de grama de 3 m, numa caixa de 1,5:1 (62% da altura para o gramado); disco de 5,5 m na escala do ponto (de 14 a 18px a 360px, raio nunca abaixo de 7px), anel de 2px em qualquer tamanho, marca com um terço do diâmetro, bola de 2,5 m (raio nunca abaixo de 4px), por cima dos discos e sempre dentro do gramado.
- Sem tremor, sem zoom, sem flash; com `prefers-reduced-motion`, o campo fica parado e é redesenhado só a cada lance.
- **Etiquetas sobre o campo (propostas 41, 47 e 48, aprovadas pelo CEO em 2026-11-23 e 2026-11-24; componente PitchTag):** pílulas no DOM, por cima do canvas, `aria-hidden` e sem toque, presas ao disco do jogador do evento (ou à bola) por uma ponta de 12 × 7px e um fio de 1,5px em `ink` desenhado no canvas; nunca cobrem um gol, o próprio jogador nem a bola no pé dele; até 60% da largura da caixa, o nome em até 2 linhas e nunca cortado. **Do lance:** `surface-1`, borda de 1px em `line`, `radius-pill`, `shadow-card`; a camisa do uniforme num círculo de 40px em `surface-2`, com halo `drop-shadow(0 0 1px var(--ink-muted))` só no tema noite (para camisas escuras), e o número sempre sobre uma placa (`numberPlate` ou o `fill` do uniforme, `radius-sm`), um pouco abaixo do centro; o tipo em `rotulo` (`ink-muted`) e o nome em `body-strong` (`ink`); entra com escala de 0,92 a 1 e opacidade em 160 ms e sai com opacidade em 120 ms. **De gol** (no lugar da comemoração em cartão da proposta 39, removida): a mesma pílula em `grass` com texto `on-grass`, o círculo em `surface-1`, "Gol!" em `numero` e caixa alta, o artilheiro em `body-strong`; entra em 200 ms e sai sem animação. **Camisa sobre a bola:** nos minutos sem lance, só a camisa do time com a bola num círculo de 32px em `surface-2`, sem número nem nome e sem animação; some quando a ponta fica a mais de 12px da bola (perto do gol) e volta abaixo de 9px. Abaixo de 200px de altura da caixa, uma linha só (camisa e nome; no gol, camisa e "Gol!"). Com `prefers-reduced-motion`, nenhuma transição e nenhuma camisa sobre a bola. Especificação: [partida-campo-v2.md](telas/partida-campo-v2.md), §9 e §16.
- **Exceção de tipografia: o número da camisa nas etiquetas** (revisão do PR B do campo v2, 2026-11-24). Usa a face do `numero` (`font-display`, 600, `tabular-nums`) em tamanho próprio, fora da escala: 12px com um dígito e 9px com dois na etiqueta de 40px; 10px e 9px na compacta. Motivo (revisão do `art-director`): o número repete o nome, que está ao lado em `body-strong`, e fica sobre a placa, com contraste de 4,5:1 garantido; nos 18px do token, cobriria a camisa. Vale só para este número; nenhum outro texto do jogo usa esses tamanhos.
- **Comemoração de gol (proposta 39, aprovada pelo CEO em 2026-11-15; substituída pela etiqueta de gol, proposta 47, em 2026-11-24):** o cartão grande com escudo, "Gol!" e o nome saiu do jogo no campo v2; o registro fica em [componentes.md](telas/componentes.md#propostas-ao-design-system), item 39.
- **Tokens do campo v2 (PR C)**, só no campo da partida, decorativos e nunca sob texto; entram no `pitch-tokens.generated.json` com os outros tokens do campo:
  - `pitch-shadow` (proposta 49, aprovada pelo CEO em 2026-11-24): `rgba(0,0,0,0.38)` nos dois temas. Só a sombra da bola no ar, uma elipse no chão sob o ponto subido, desenhada com altura acima de 0,15 m. É escura nos dois temas porque uma sombra clara não se lê como sombra. Composta sobre o `pitch`, fica `#134227` (noite) e `#1c5935` (dia), a 1,76:1 e 2,04:1 do gramado; não entra na conferência, porque nada é lido sobre ela (o `ink` sobre ela daria 10,44:1 na noite e 2,00:1 no dia).
  - `pitch-wedge` (proposta 42, aprovada): noite `rgba(4,18,10,0.45)`, dia `rgba(255,255,255,0.35)`. A cor do vértice da cunha do ataque, na bola, em gradiente até transparente na linha do gol. Ela sempre afasta o gramado do `ink`: composta sobre o `pitch`, o vértice fica `#124327` (noite) e `#77b691` (dia), e o `ink` sobre ele vai a **10,32:1** na noite e **7,02:1** no dia (sem cunha, 5,94:1 e 4,09:1). Especificação: [partida-campo-v2.md](telas/partida-campo-v2.md), §7, §8, §15 e §16.
- Conferência: o par gráfico `ink` sobre `pitch` passa a ser conferido a 3:1 pelo `npm run tokens`, numa lista de pares gráficos ao lado da de texto (a mudança no script é do `developer`, na T-085). Desde o PR C do campo v2, o script também confere a 3:1 o `ink` sobre a cunha no vértice (`pitch-wedge` composto sobre o `pitch`, alfa inteiro), numa lista de pares sobre camada translúcida; o `npm run tokens` falha se a cunha ficar abaixo disso em qualquer tema.
- Especificação: [partida.md](telas/partida.md#campo-2d-t-085).

### Ritmo da partida (aprovado pelo CEO em 2026-11-15)

- As durações da partida assistida (minuto, lance, pausa dramática, depois do gol, intervalo, em Normal e Rápido) ficam na constante `MATCH_TIMING` em `app/src/ui/match/`, com comentário apontando para cá, até o grupo de movimento existir (proposta 2 de [componentes.md](telas/componentes.md#propostas-ao-design-system)).
- São ritmo de jogo, não animação: com `prefers-reduced-motion` continuam valendo (a pausa dramática vira só o atraso do texto); só o movimento para.
- Valores na tabela de [partida.md](telas/partida.md#relógio-da-partida).

### Altura baixa (aprovado pelo CEO em 2026-11-07)

- `breakpoint-short` = **480px de altura** (`@media (max-height: 480px)`): o celular deitado (844×390). Abaixo dele, barras presas ao pé ficam com uma linha só (ações só com ícone, o rótulo como nome acessível).
- Variáveis CSS não funcionam em `@media`; o valor fica escrito no componente, com comentário apontando para cá, até o gerador de tokens exportar constantes (como `breakpoint-desktop` e `breakpoint-card`).

## Padrões de interação

### Arrastar e soltar (aprovado pelo CEO em 2026-11-07)

- **Arrastar nunca é o único caminho.** Todo arrasto tem o mesmo efeito em dois toques (tocar no item, depois no destino) e pelo teclado (Enter no item, Enter no destino; Esc cancela). O item escolhido tem `aria-pressed`, borda `floodlight` e uma marca de "check", nunca só cor.
- **No toque, o arrasto começa depois de segurar 300ms** sem mexer mais de 8px; antes disso, deslizar rola a página. Com mouse, começa depois de 6px de movimento.
- A cópia arrastada segue o dedo 48px acima do toque; o destino sob o dedo tem borda `grass`, fundo `grass-soft` (texto só em `ink`) e o ícone de troca; a origem fica tracejada. Soltar fora cancela, sem animação de volta.
- O resultado e as recusas são anunciados numa região viva (`role="status"`) perto do polegar.
- Implementação de referência: `LineupPitch`, `LineupChip`, `LineupRow` e `LineupStatusBar`; especificação em `docs/design/telas/escalacao.md`, "Trocar lugares".

### Confirmação em passos: o passo final (aprovado pelo CEO em 2026-11-07)

Vale para toda confirmação destrutiva em mais de um passo (hoje, apagar uma carreira: folha de ações, passo 1, passo 2).

**Regras.**

- **"Cancelar" sempre por último e no mesmo lugar.** Em todas as folhas do fluxo, "Cancelar" é o último botão, embaixo, no alcance do polegar, e fica na mesma altura da tela. Quem desiste toca embaixo por reflexo e sempre cancela. "Cancelar" nunca sobe acima do destrutivo.
- **O destrutivo do passo final nunca fica no lugar do botão principal do passo anterior.** O passo final tem um separador entre o destrutivo e "Cancelar": linha de 1px em `line`, com um alvo de toque mais `space-4` de espaço, metade acima e metade abaixo da linha. O destrutivo sobe 61 px; onde estava o botão do passo anterior fica espaço vazio, que não faz nada ao toque.
- **Janela de proteção.** Cada passo ignora a sua ação de avançar ou confirmar por cerca de 500 ms depois de abrir; cancelar, fechar e voltar valem na hora.
- **Folha ancorada pela base nas duas larguras.** No celular a folha sobe de baixo; a partir de 900px vira diálogo flutuante ancorado pela base (`space-8` acima da área segura), não centrado na vertical, para a posição dos botões não depender da altura do texto. Os botões da confirmação ficam no pé fixo da folha; quando a tela é baixa (celular deitado), só o conteúdo de cima rola.
- O destrutivo tem borda `danger`, ícone e texto (nunca só cor); o foco entra no botão de fechar da folha, nunca no destrutivo.

**Medida.** No celular (em pé e deitado) e no desktop, o topo do destrutivo do passo final fica pelo menos 56 px acima do topo do botão principal do passo anterior, sem sobreposição, e "Cancelar" tem o mesmo `y` (±1 px) em todas as folhas do fluxo. O E2E confere.

**Implementação de referência.** `ConfirmSheet` com `finalStep` sobre o `BottomSheet`, em `app/src/ui/components/`; especificação em `docs/design/telas/inicio.md`, "Apagar com confirmação dupla".

### Foco: anel só para o teclado (pedido do CEO em 2026-11-07)

O anel de foco (`focus`, 2px sólido) aparece para quem navega pelo teclado e nunca depois de um toque ou clique.

- **Por que não basta `:focus-visible`.** O WebKit (Safari e todo navegador do iPhone) não move o foco num toque em botão; um foco dado por código logo depois (o X que o `<dialog>` foca ao abrir, o nome que recebe o foco de volta ao fechar) casa com `:focus-visible` e desenha o anel. O Chromium não desenha nesse caso. `focus({ focusVisible: false })` não cobre o foco automático do `<dialog>` e não existe em todo navegador.
- **Regra.** `ui/components/input-modality.ts` guarda a última forma de interação no `<html>`: `data-input="pointer"` no `pointerdown` (toque, mouse, caneta), `data-input="keyboard"` numa tecla de navegação (Tab, setas, Enter, Esc...). Com `pointer`, nenhum elemento focado desenha contorno; campos de texto (`input`, `textarea`, `select`) mantêm o seu, porque mostram onde o texto vai entrar. Sem o atributo (antes da primeira interação), vale o `:focus-visible` do navegador.
- **Teclas que não contam:** modificadores sozinhos, atalhos com Ctrl, Alt ou Cmd, composição e o teclado virtual (`Unidentified`, `Process`); dentro de um campo de texto, só o Tab.
- **O foco não muda de lugar.** Quem usa leitor de tela continua recebendo o foco no X ao abrir e no nome ao fechar; só o desenho do anel depende da modalidade.
- **Componentes novos** usam `:focus-visible` como sempre; não precisam saber da modalidade. Um anel desenhado num pai (`:has(:focus-visible)`, como nos rádios do SegmentedControl) não é apagado pela regra; hoje isso só acontece com rádios, que nenhum navegador marca como `:focus-visible` depois de um toque.

### "Jogar rodada" com seletor (aprovado pelo CEO em 2026-11-15)

- O "Jogar rodada" (PlayRoundButton) vira **botão dividido** quando há tipo de partida para escolher: à esquerda o rótulo, com o tipo atual escrito embaixo em `caption`; à direita, separado por um traço de 1px em `on-grass`, um segmento de 48px com o ícone `chevron-down` e `aria-haspopup="dialog"`, que abre a folha do tipo de partida. Os dois alvos têm a altura do botão.
- Continua sendo **um primário só** (o mesmo botão). Em `blocked`, a linha do motivo fica no lugar da do tipo; em `busy`, sem rodada para jogar ou com a temporada encerrada, o segmento some.
- A escolha na folha só vale ao tocar "Jogar rodada" nela; fechar descarta.
- Especificação: [partida.md](telas/partida.md#seletor-de-tipo-de-partida-no-jogar-rodada).

## Ícones novos (aprovado pelo CEO em 2026-11-15)

- `pause`, `skip` e `chevron-down` entram no `Icon` (lista fechada `IconName`), no estilo do conjunto provisório (24×24, traço de 2px), e na lista que o `art-director` redesenha. "Continuar" usa o `play`; "Rápido" não tem ícone; o estado ligado é o do botão ligado (proposta 38 de [componentes.md](telas/componentes.md#propostas-ao-design-system), aprovada pelo CEO em 2026-11-15), sem o `check`.

## Selos (aprovado pelo CEO em 2026-11-07)

Vale para o StatusBadge (`app/src/ui/components/StatusBadge.svelte`) e para qualquer selo de situação, resultado ou marca, também a marca da vaga no campo da escalação (LineupChip). Improvisado, fora de posição e líder entraram na T-029 (aprovados pelo CEO em 2026-11-07). Posição secundária entrou na T-080 (aprovada pelo CEO em 2026-11-10): marca neutra, mais leve que improvisado; na marca da vaga, a gravidade é lesionado > suspenso > fora de posição > improvisado > posição secundária > nenhuma, e ela nunca entra nos avisos.

| Tipo                                                          | Texto e fundo                      | Borda e ícone                     |
| ------------------------------------------------------------- | ---------------------------------- | --------------------------------- |
| Vitória (`win`)                                               | `on-grass` sobre `grass`           | —                                 |
| Empate (`draw`)                                               | `ink` sobre `surface-2`            | borda `draw`                      |
| Derrota, lesionado, suspenso (`loss`, `injured`, `suspended`) | `ink` sobre `danger-soft`          | borda `danger`; ícone em `danger` |
| Promessa, clássico (`prospect`, `derby`)                      | `on-floodlight` sobre `floodlight` | —                                 |
| Improvisado (`improvised`)                                    | `on-floodlight` sobre `floodlight` | —                                 |
| Fora de posição (`outOfPosition`)                             | `ink` sobre `danger-soft`          | borda `danger`; ícone em `danger` |
| Posição secundária (`secondary`)                              | `ink` sobre `surface-2`            | borda `draw`; ícone em `ink`      |
| Líder (`leader`)                                              | `ink` sobre `surface-2`            | borda `line`                      |

- Todo selo tem letra ou ícone **e** texto (no selo só de letra, V/E/D, a palavra inteira vai para o leitor de tela); a cor só reforça.
- Texto em `rotulo`. Os tipos formam uma lista fechada no componente.
- **Um tipo novo de selo só entra com o seu par de texto e fundo conferido pelo `npm run tokens`** (a lista de pares de `scripts/tokens-to-css.mjs`); cor solta num selo é correção na revisão.

## Marca de zona da tabela (aprovado pelo CEO em 2026-11-14)

Vale para toda tabela de classificação inteira: a Tabela (T-031), a classificação final do Fim de temporada (T-037) e a tabela ao vivo (T-045). A mini tabela do Clube não leva marca.

| Zona              | Linhas (Etapa 1)                              | Marca na posição (PositionMark)           | Palavra embaixo do nome          |
| ----------------- | --------------------------------------------- | ----------------------------------------- | -------------------------------- |
| Líder (e Campeão) | 1º                                            | `on-floodlight` sobre `floodlight`        | "Líder" ou, encerrada, "Campeão" |
| Rebaixamento      | os `RELEGATION_SPOTS` últimos (do 17º ao 20º) | `ink` sobre `danger-soft`, borda `danger` | "Rebaixamento"                   |

- **Forma, cor e palavra:** o número da posição fica numa caixinha (`radius-sm`, borda de 1px) com o par de um Selo; a palavra da zona vai escrita na linha, e a legenda na tela explica as marcas. A cor nunca é a única pista.
- **Pares dos Selos, sem cor nova:** líder com o par de `derby` e `prospect`; rebaixamento com o de `loss`. Os dois já são conferidos pelo `npm run tokens`.
- **Zona nova só com o seu par conferido**, como um selo novo (as de copas, na Etapa 2).
- Na Etapa 1, só essas duas zonas (US-023): nada de Libertadores ou Sul-Americana enquanto as copas não existem.
- Sem token novo. Implementação de referência: `PositionMark` e `TableLegend`, usados pela `TableRow` `layout="full"`; especificação em [tabela.md](telas/tabela.md#zonas-decisões-2-e-3-do-ceo).

## Cores por faixa (aprovado pelo CEO em 2026-11-07)

Números de estado (hoje condição, moral e forma, no Elenco e no card do jogador) podem ganhar a cor da sua faixa: boa, regular ou ruim. Os atributos usam os mesmos tokens com outra regra, relativa à nota do jogador ("Pontos fortes e fracos dos atributos", abaixo).

| Faixa   | Token        | Noite     | Dia       | Sobre `surface-1` (noite / dia) | Sobre `surface-2` (noite / dia) |
| ------- | ------------ | --------- | --------- | ------------------------------- | ------------------------------- |
| Boa     | `level-good` | `#2fb866` | `#157040` | 6,05 / 6,13                     | 5,00 / 5,11                     |
| Regular | `level-fair` | `#ffc83d` | `#8a5a00` | 10,06 / 5,93                    | 8,31 / 4,94                     |
| Ruim    | `level-poor` | `#ff6b6b` | `#c62828` | 5,60 / 5,62                     | 4,63 / 4,69                     |

- **A cor só pinta o número, que está sempre escrito.** Nada de fundo, ícone ou barra colorida; a barra do AttributeBar continua em `ink-muted`.
- **A faixa vai em palavra para o leitor de tela:** "82, boa" (`level.reading`), num texto escondido; o número visível fica `aria-hidden`. Assim a faixa nunca depende só da cor, nem para quem não distingue verde de vermelho (o número continua lá).
- **Limites numa constante só:** `LEVEL_BANDS` em `app/src/ui/components/levels.ts`, lidos por `levelOf(medida, valorMostrado)`; a faixa é sempre do valor mostrado (o inteiro arredondado, ou a forma com uma casa), para cor e número nunca discordarem. Nenhum componente escreve um limite.
- **Tokens próprios, não `grass`, `floodlight` e `danger`:** o `grass` de dia fica em 4,49:1 sobre `surface-2` (o fundo da linha com o ponteiro em cima) e o `floodlight` de dia não chega a 2:1 sobre o branco. `level-good` e `level-poor` de noite têm o mesmo valor de `grass` e `danger`; mudar um não muda o outro.
- **Sem valor, sem cor:** "—" e "Sem jogos ainda" ficam em `ink-muted`, como antes.
- **Medida nova só com faixa definida na spec da tela** (limites, de onde vêm e o texto do leitor de tela). A nota geral não tem faixa e continua sem cor (decisão do CEO em 2026-11-07): ver [elenco.md](telas/elenco.md#cores-por-faixa).

### Pontos fortes e fracos dos atributos (aprovado pelo CEO em 2026-11-07)

Os 6 atributos do card do jogador ganham cor **em relação à nota geral do próprio jogador**, não por uma escala fixa: um 70 é ponto forte de um jogador de nota 62 e ponto fraco de um de nota 80.

| Estado      | Regra                                | Token        | Leitor de tela    |
| ----------- | ------------------------------------ | ------------ | ----------------- |
| Ponto forte | atributo ≥ nota + `ATTRIBUTE_MARGIN` | `level-good` | "78, ponto forte" |
| Ponto fraco | atributo ≤ nota − `ATTRIBUTE_MARGIN` | `level-poor` | "58, ponto fraco" |
| (nenhum)    | entre os dois                        | sem cor      | só o número       |

- `ATTRIBUTE_MARGIN = 5`, em `app/src/ui/components/levels.ts`, lida por `attributeLevelOf(valor, nota)`; nenhum componente escreve a margem.
- **Só dois estados.** Não há "regular" nos atributos: `level-fair` nunca aparece num atributo. O que fica perto da nota não é notícia.
- **Goleiro igual,** com os 6 atributos dele.
- **Atributo de peso 0 na posição** (finalização do zagueiro, marcação do atacante) nasce cerca de 20 pontos abaixo da nota e aparece quase sempre como ponto fraco. Aceito pelo CEO: é a verdade do jogador.
- Mesmos tokens e mesmas regras da faixa: só o número, a barra continua em `ink-muted`, o número visível fica `aria-hidden` e o texto escondido diz o estado em palavra (`level.reading` com `attr.level.strong` ou `attr.level.weak`).

## Cor de setor (aprovado pelo CEO em 2026-11-07)

A sigla da posição (GOL, ZAG, LAT, VOL, MEI, ATA) ganha a cor do seu setor, para o elenco se ler por linhas do time num relance.

| Setor   | Posições | Borda (`sector-*`)    | Fundo (`sector-*-soft`) | `ink` sobre o fundo (noite / dia) | Borda sobre `surface-1` (noite / dia) | Borda sobre `surface-2` (noite / dia) |
| ------- | -------- | --------------------- | ----------------------- | --------------------------------- | ------------------------------------- | ------------------------------------- |
| Goleiro | GOL      | `#ffc83d` / `#a87200` | `#3d3214` / `#fdf0c8`   | 11,52 / 14,60                     | 10,06 / 4,14                          | 8,31 / 3,45                           |
| Defesa  | ZAG, LAT | `#5fb0ff` / `#1565c0` | `#16365a` / `#dcebfc`   | 11,22 / 13,70                     | 6,77 / 5,75                           | 5,59 / 4,79                           |
| Meio    | VOL, MEI | `#a78bfa` / `#6d3fd0` | `#2e2658` / `#ebe4fd`   | 12,50 / 13,48                     | 5,71 / 6,42                           | 4,72 / 5,35                           |
| Ataque  | ATA      | `#e879d6` / `#a0208c` | `#46203f` / `#f7e0f4`   | 12,46 / 13,38                     | 6,02 / 6,82                           | 4,98 / 5,68                           |

Valores na ordem noite / dia. Âmbar, azul, violeta e magenta. O azul, o violeta e o magenta ficam longe do verde e do vermelho das faixas. O âmbar do goleiro coincide com o amarelo de "regular" (`level-fair`) no tema noite (`#ffc83d`, o mesmo valor) e fica perto dele no tema dia (`#a87200` contra `#8a5a00`). É aceitável porque essa cor só pinta a borda da sigla, nunca um número, e a cor de faixa só pinta números ("Onde cada cor pinta"): as duas nunca aparecem no mesmo tipo de elemento.

- **Só o fundo e a borda da sigla.** O texto da sigla é sempre `ink`; nenhum número, nome, linha ou ícone leva cor de setor.
- **Contraste:** `ink` sobre os quatro `sector-*-soft` é conferido pelo `npm run tokens` (≥ 4,5:1 nos dois temas). A borda é reforço, não informação (a sigla está escrita); mesmo assim passa de 3:1 sobre `surface-1` e `surface-2` (conferido à mão, tabela acima).
- **Nunca só por cor:** a sigla está sempre escrita, e a posição inteira vai para o leitor de tela onde a linha a diz.
- **Só a sigla natural** (aprovado pelo CEO em 2026-11-10, T-080): a cor de setor pinta só a sigla da posição natural; a sigla secundária é sempre neutra (PositionTag `size="sm"` sem `sector`: borda `line`, texto `ink-muted`).
- **Mapa único:** `SECTOR_OF` em `app/src/ui/components/sectors.ts` leva a posição natural ao setor (GK → `gk`; CB, FB → `def`; DM, AM → `mid`; ST → `atk`), a mesma divisão das linhas do banco no motor. Nenhuma tela escreve um setor.
- **Implementação de referência:** `PositionTag` (`code`, `sector`, `hidden?`), usado pela `PlayerRow` e pelo `PlayerCard`; a Escalação o usa no `LineupChip` ([escalacao.md](telas/escalacao.md#cor-de-setor-no-lineupchip)).

## Onde cada cor pinta (aprovado pelo CEO em 2026-11-07)

Regra para as duas famílias de cor de leitura, para nunca disputarem o mesmo lugar:

- **A cor de faixa (`level-*`) só pinta números.** Estados do jogador (faixa boa, regular, ruim) e pontos fortes e fracos dos atributos. Nunca fundo, borda, barra, ícone ou texto que não seja o número.
- **A cor de setor (`sector-*`) só pinta o fundo da sigla da posição** (e a borda dela). Nunca o texto, um número ou outro elemento.
- Um elemento novo que queira uma dessas cores fora desses lugares é proposta ao design system, não ajuste de tela.
