# Site público: três direções visuais para a página inicial

**Status:** aguardando a escolha do CEO. Autor: `ux-designer`. Nada foi mudado em `site/`, no código nem em `design/tokens.json`; isto é só para escolher.

Cada direção é um mockup estático da página Início (HTML autocontido, CSS inline, sem JavaScript), com o conteúdo aprovado (`docs/content/site/inicio.md` e `complementos.md`), nome e slogan de `config/prancheta.config.ts` e escudos reais gerados por `app/src/lib/generators/shield.ts` com os clubes de `app/src/data/clubs.serie-a.json`. As fontes são as locais (`@fontsource`, Barlow e Barlow Condensed); para abrir os HTML no navegador, rode `npm install` antes (os `@font-face` apontam para `node_modules/`).

As capturas foram feitas com o Playwright em modo headless. O tema `noite` é o padrão; o tema `dia` (por `prefers-color-scheme: light`) aparece na captura "celular-dia". Todas as capturas usam `prefers-reduced-motion: reduce`, então mostram o estado final, sem animação.

| Direção                 | Celular (noite)                      | Celular (dia)                            | Desktop                              | Compartilhamento 1200×630 |
| ----------------------- | ------------------------------------ | ---------------------------------------- | ------------------------------------ | ------------------------- |
| A. Noite de estádio     | `a-noite-de-estadio-celular.png`     | `a-noite-de-estadio-celular-dia.png`     | `a-noite-de-estadio-desktop.png`     | `a-og.png`                |
| B. Prancheta do técnico | `b-prancheta-do-tecnico-celular.png` | `b-prancheta-do-tecnico-celular-dia.png` | `b-prancheta-do-tecnico-desktop.png` | `b-og.png`                |
| C. Álbum de figurinhas  | `c-album-de-figurinhas-celular.png`  | `c-album-de-figurinhas-celular-dia.png`  | `c-album-de-figurinhas-desktop.png`  | `c-og.png`                |

As capturas de celular são a página inteira em 390 px de largura (o topo, de 844 px, é o que aparece ao abrir); a de desktop é a página inteira em 1440 px.

## O que é igual nas três

- Mesma ordem de seções: abertura, O que é, Destaques (4 cartões com selo), Como começar, Onde estamos, Jeito de fazer, Últimas do devlog, Chamada final, rodapé. Títulos de seção são os nomes já aprovados.
- Mesmo cabeçalho (marca, Jogar, Menu em `<details>`; no desktop o menu fica em linha), mesmo selo de estado (texto + ícone, nunca só cor), um botão primário por área visível, links sublinhados, alvos ≥ 44 px, anel de foco de 2 px, `h1` único.
- Sem JavaScript, sem imagem de terceiros, sem cookies. Toda a parte visual é CSS, SVG inline e os escudos gerados.
- Movimento: só um efeito de entrada curto (≤ 1,2 s, uma vez) e transições de hover/foco ≤ 200 ms; tudo desligado em `prefers-reduced-motion: reduce`. Nada em loop.
- Conferido sem rolagem horizontal a 360 px e a 390 px.

## A. Noite de estádio

**Ideia:** a página é um estádio à noite. Refletores (radial e feixes em gradiente) acendem sobre um título enorme; embaixo, o gramado em perspectiva com as linhas do campo e cinco escudos "em campo", com sombra. Cartões de vidro fosco sobre um brilho verde; a faixa de etapas é um placar eletrônico; a chamada final é um pedaço de gramado com o círculo central.

- **Paleta:** `surface-0` e `surface-1` de fundo, `floodlight` para luz e destaques, `grass` no botão, `pitch` e `pitch-line` no gramado. No `dia` vira "tarde de sol": fundo claro, feixes amarelados suaves, destaque em `grass`.
- **Tipografia:** Barlow Condensed 800 no título (até 196 px no desktop), 700 nos títulos de seção; Barlow 400/600 no texto. Peso 800 é novo (mais um arquivo de 22 KB).
- **Componentes-chave:** hero com torres de refletor em SVG e gramado; `FeatureCard` de vidro (`backdrop-filter`); `StepList` com número em anel `floodlight`; `StageStrip` como placar (lista no celular, grade 4×2 no desktop, atual com barra `grass` + selo); rodapé simples.
- **Movimento:** os refletores acendem uma vez (fade de 1,2 s).
- **Compartilhamento:** segue o rascunho de `docs/art/og-image.md` quase à risca (faixa `floodlight`, nome, título, gramado, 4 escudos), com feixes de luz e as torres.
- **Prós:** é a "cara de estádio à noite" que o design system já promete; continuidade total com o jogo (mesmos tokens, gramado da tela da partida); os escudos ganham palco; o mais rápido de implementar a partir do site atual.
- **Contras:** é o caminho mais "esperado" para jogo de futebol; o vidro fosco custa GPU em celular fraco (há fallback: sem `backdrop-filter` o cartão fica `surface-1` translúcido, ainda legível); gradientes grandes dão faixas (banding) em telas de 8 bits.
- **Tokens novos propostos:** `surface-glass` (noite `rgba(23,37,52,.62)`, dia `rgba(255,255,255,.72)`), `glass-line` (noite `rgba(255,255,255,.09)`, dia `rgba(16,32,44,.10)`), `beam` (noite `rgba(255,214,120,.20)`, dia `rgba(240,180,41,.22)`), e o peso 800 da Barlow Condensed em `display-xl`.

## B. Prancheta do técnico

**Ideia:** o nome do jogo virando objeto. O topo é uma prancheta de verdade (moldura, presilha amarela igual à do logo) com a lousa e o título em "giz"; ao lado, o esquema 4-3-3 desenhado à mão com setas de ataque (filtro SVG de giz) e os escudos como ímãs. O resto da página é a lousa: títulos sublinhados a giz, cartões com contorno de giz, passos ligados por um passe tracejado, etapa atual circulada, rodapé como a bandeja do giz e do apagador. No `dia`, vira quadro branco com marcador azul e vermelho.

- **Paleta:** tokens novos para a lousa (abaixo); `floodlight` vira o giz amarelo de destaque no `noite` e `info` vira o marcador azul no `dia`; `danger` (tom claro) marca os adversários.
- **Tipografia:** Barlow Condensed 800 (título) e 600 itálico (anotações "à mão": "4-3-3"); Barlow no texto. Considerei uma fonte de giz OFL (por exemplo, Caveat), mas **não recomendo**: pesa mais 30 a 40 KB, lê pior em tela pequena e falha em textos longos. O efeito de giz fica nos desenhos SVG, não no texto.
- **Componentes-chave:** hero "Prancheta" (moldura + presilha + lousa); diagrama tático em SVG com `<title>`/`aria-label` (reaproveitável na página O jogo, onde a spec já pede diagramas); `FeatureCard` com contorno de giz; `StepList` com passe tracejado; `StageStrip` com a etapa atual circulada (forma + selo, não só cor); `PostCard` como ficha presa por um ímã.
- **Movimento:** as setas se desenham uma vez (traço de 1 s, em sequência).
- **Compartilhamento:** a prancheta inteira com a presilha, o esquema tático apagado ao fundo, nome em "giz" amarelo, título grande e 4 escudos-ímã.
- **Prós:** a mais original e com mais personalidade; conversa direto com o nome e o logo (a presilha amarela); o diagrama tático já resolve uma necessidade da página O jogo; no `dia` o quadro branco fica limpo e muito legível.
- **Contras:** a textura de lousa (ruído SVG) é pesada para PNG e um pouco para pintar; por isso ela ficou só dentro da prancheta e o resto da página usa manchas suaves. O filtro de giz custa CPU em celular fraco (só nos desenhos; dá para trocar por traço simples). Afasta-se mais do visual do jogo (o jogo não tem lousa), então exige cuidado para não parecer outro produto. Mais trabalho de implementação.
- **Tokens novos propostos:** `board` (noite `#13261f`, dia `#fbfcf8`), `board-2` (noite `#1a3129`, dia `#ffffff`), `chalk` (noite `#eef3ec`, dia `#10202c`), `chalk-muted` (noite `#b4c6b9`, dia `#4e6170`), `chalk-line` (noite `rgba(238,243,236,.55)`, dia `#8ea2b2`, decorativo), `mark` (noite `#ffc83d`, dia `#1565c0`), `mark-2` (noite `#ff9d8a`, dia `#c62828`, decorativo), `frame` (noite `#3a4a57`, dia `#b9c4ce`), e os pesos 800 e 600 itálico da Barlow Condensed.

## C. Álbum de figurinhas

**Ideia:** revista esportiva de domingo e álbum da Copa. A capa é um bloco amarelo com listras diagonais, faixa "Em desenvolvimento, em público" colada torta e o nome em letras enormes; ao lado, três figurinhas de clubes fictícios (número do álbum, faixa com as duas cores do clube, escudo, nome, cidade) em leque. Depois, números grandes (20 clubes, 38 rodadas, 3 ajustes táticos), uma citação em destaque, cartões de recurso em blocos de cor com o número de capa ao fundo, passos com numerais gigantes, as etapas como **tabela de classificação** (coluna da etapa fixa, atual com a listra amarela) e a contracapa amarela na chamada final.

- **Paleta:** pares que já existem, usados como blocos: `floodlight`/`on-floodlight`, `grass`/`on-grass`, `surface-2`/`ink`, `grass-soft`/`ink`. Figurinha em papel claro nos dois temas.
- **Tipografia:** Barlow Condensed 800 (título e números) e 700 itálico (citação); Barlow no texto.
- **Componentes-chave:** `Sticker` (figurinha de clube; serve também para a página Clubes e para o jogo, se o CEO quiser); `StatStrip` de números grandes; `FeatureCard` em bloco de cor; `StageTable` em formato de classificação (reaproveita `LinhaTabela` do jogo); faixa listrada (`repeating-linear-gradient`, sem imagem).
- **Movimento:** as figurinhas "colam" uma vez ao carregar (0,45 s, em sequência) e endireitam com o ponteiro em cima (só decoração).
- **Compartilhamento:** amarelo listrado, faixa com o nome, título enorme e 4 figurinhas em leque sobre uma faixa diagonal verde. É a que mais se destaca na miniatura de uma rede social (o título lê fácil a 300 px).
- **Prós:** a mais alegre e "moderna"; leve (só CSS e SVG, a mais leve das três nas capturas); mostra a graça dos clubes em trocadilho logo de cara; o amarelo diferencia o site de qualquer outro jogo de futebol escuro; a tabela de classificação fala a língua de quem joga.
- **Contras:** foge do "estádio à noite" no topo (o amarelo domina a primeira tela); muitos blocos de cor podem cansar se as páginas internas repetirem a fórmula, então lá ela precisa ser mais contida; os números "20 / 38 / 3" são texto novo (fatos do `docs/PROJETO.md`), precisam do `tech-writer` e do ok do CEO; figurinha é uma referência forte a um produto de terceiros (o formato é genérico, sem marca, mas convém não imitar nenhum álbum específico).
- **Tokens novos propostos:** `sticker` (noite `#fbf6e9`, dia `#ffffff`), `on-sticker` (`#10202c` nos dois), `sticker-muted` (noite `#4e5a63`, dia `#4e6170`), `stripe` (`rgba(28,21,0,.07)`, decorativo), e os pesos 800 e 700 itálico da Barlow Condensed.

## Contraste dos pares novos (calculado)

Todos ≥ 4,5:1. Os pares existentes já são conferidos por `npm run tokens`.

| Par                                                                       | Noite       | Dia  |
| ------------------------------------------------------------------------- | ----------- | ---- |
| A: `ink` sobre vidro                                                      | 14,9        | 15+  |
| A: `ink-muted` sobre vidro                                                | 7,6         | 6,3  |
| A: destaque do slogan (`floodlight` noite, `grass` dia) sobre `surface-0` | 11,4        | 4,9  |
| B: `chalk` sobre `board` / `board-2`                                      | 14,1 / 12,3 | 16,1 |
| B: `chalk-muted` sobre `board` / `board-2`                                | 8,9 / 7,7   | 6,2  |
| B: `mark` sobre a lousa                                                   | 9,0         | 5,6  |
| C: `on-sticker` sobre `sticker`                                           | 15,4        | 15+  |
| C: `sticker-muted` sobre `sticker`                                        | 6,6         | 6+   |
| C: `on-floodlight` sobre `floodlight` com listras                         | 10,2        | 8,6  |
| C: faixa `floodlight` sobre `on-floodlight`                               | 11,7        | 9,7  |

## Peso (para o celular)

- Fontes: hoje o site carrega 5 arquivos (Barlow 400/500/600, Barlow Condensed 600/700), cerca de 112 KB. A acrescenta 1 (800, +22 KB); B e C acrescentam 2 (+46 KB). Se o CEO quiser zero acréscimo, o título pode ficar em 700 com pouca perda.
- Decoração: tudo em CSS e SVG inline, sem imagens. O HTML de cada mockup tem de 28 a 32 KB sem compressão, já com 5 a 9 escudos inline.

## Recomendação

**Direção A, com dois elementos emprestados da C.** A é a que melhor cumpre o design system ("cara de estádio à noite"), tem continuidade com o jogo e é a mais simples de levar para todas as páginas sem virar outro produto. Ela resolve o "muito simples" com o título gigante, os refletores e o gramado com os escudos, sem custo de manutenção. Da C eu traria a **figurinha de clube** (para a página Clubes e para a faixa de escudos) e a **etapa como tabela de classificação**, que são as duas ideias mais "nossas". A B é a mais original, mas é a mais cara de fazer bem e a que mais se afasta do jogo; eu a guardaria como linguagem de ilustração da página O jogo (o diagrama tático em giz), não como identidade do site.

Se o CEO quiser algo que salte mais na rede social e não se pareça com outros jogos de futebol, a C inteira é uma escolha legítima; nesse caso eu manteria as páginas internas no fundo escuro e deixaria o amarelo só na capa, no compartilhamento e na chamada final.

## Mudanças propostas ao design system (para o CEO aprovar)

Valem só para a direção escolhida:

1. Os tokens novos da seção da direção escolhida, em `design/tokens.json`, com uso marcado "só no site".
2. Peso 800 da Barlow Condensed para `display-xl` (as três usam).
3. Na A, o vidro fosco como segundo tratamento de card (hoje o sistema só tem card chapado e uma sombra); na C, o componente `Sticker`.
4. Texto novo a passar pelo `tech-writer`: na C, os rótulos dos números grandes ("clubes", "rodadas", "ajustes táticos").
