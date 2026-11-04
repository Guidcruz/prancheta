# Site público: mapa, páginas e componentes

**Status:** aprovado pelo CEO em 2026-11-04, com as três opções da seção "Tokens e tema" (tema `dia` pela preferência do sistema, grupo `layout` nos tokens, `@astrojs/sitemap`).

**Direção visual:** em 2026-11-04 o CEO escolheu a **direção A, "Noite de estádio"**, com os toques recomendados (ver `docs/design/site-direcoes/README.md`): da C, a **figurinha de clube** (`Sticker`) e as **etapas como tabela de classificação**; da B, o **diagrama tático a giz**, só na página O jogo. Aprovou também as mudanças ao design system da A (tokens de vidro fosco e de feixe de refletor, só no site; Barlow Condensed 800 em `display-xl`; cartão de vidro), o `Sticker` da C, o diagrama a giz da B só onde dito, e a imagem de compartilhamento da A (`docs/design/site-direcoes/a-og.html`) com os títulos curtos aprovados em `docs/content/site/complementos.md` ("Descrições para compartilhar").

Especificação do `ux-designer` para o site em `site/` (Astro, só pt-BR). Define a estrutura, o visual e os componentes; o texto é do `tech-writer`, em `docs/content/site/`. Nome, slogan, logo, cores, domínio e contatos vêm sempre de `config/prancheta.config.ts`; cores, fontes, raios e espaços só de `app/src/tokens.css` e `site/src/theme-auto.css` (gerados de `design/tokens.json`).

Princípios: celular primeiro (360px), leitura com uma mão, cara de estádio à noite (tema `noite`), simples antes de bonito. Sem capturas de tela até existirem telas do jogo: a parte visual vem dos escudos gerados, do logo, da tipografia e de desenhos em CSS e SVG inline.

Referência visual: `docs/design/site-direcoes/a-noite-de-estadio.html` e as capturas `a-noite-de-estadio-*.png`. Onde esta especificação diverge do mockup (contraste, a grade "Onde estamos", cores literais), **vale esta especificação**.

## Mapa do site

| Página               | Rota            | Objetivo em uma frase                                                       |
| -------------------- | --------------- | --------------------------------------------------------------------------- |
| Início               | `/`             | Explicar o jogo em 10 segundos e levar a jogar a versão atual ou a seguir.  |
| O jogo               | `/o-jogo/`      | Mostrar como é uma temporada, do ajuste tático à rede social.               |
| Modos de jogo        | `/modos/`       | Explicar carreira e liga com amigos, os dois ritmos e quando cada um chega. |
| Clubes               | `/clubes/`      | Apresentar a ideia dos clubes fictícios em trocadilho e seus escudos.       |
| Perguntas frequentes | `/perguntas/`   | Responder dúvidas de preço, privacidade, celular, idiomas e clubes.         |
| Roteiro              | `/roadmap/`     | Etapas e estado, lidos de `docs/roadmap.md`.                                |
| Devlog               | `/devlog/`      | Diário semanal do desenvolvimento.                                          |
| Apoiar               | `/apoiar/`      | Como apoiar e "Patrocine aqui".                                             |
| Privacidade          | `/privacidade/` | Política de privacidade.                                                    |
| Jogo                 | `/jogo/`        | O próprio jogo (PWA, outro workspace).                                      |

A rota `/roadmap/` fica como está (o devlog e posts antigos já apontam para ela); o rótulo visível é "Roteiro".

## Navegação

### Celular (até 719px)

- **Cabeçalho fixo no topo** (altura 56px): marca à esquerda (logo de `config.logo.mark` + `config.name` em `subtitulo`; enquanto `hasBrand` for falso, só o nome), à direita dois alvos: botão **Jogar** (único primário do cabeçalho, `grass`/`on-grass`, ≥ 44px) e botão **Menu** (ícone + texto "Menu", ≥ 44×44px).
- **Pele de vidro (direção A)**: fundo `color-mix(in srgb, var(--surface-0) 78%, transparent)` com `backdrop-filter: blur(12px)` (e o prefixo `-webkit-`), borda inferior de 1px em `glass-line`. Sem suporte a `backdrop-filter` (`@supports not`) ou com `prefers-reduced-transparency: reduce`: fundo `surface-0` opaco e borda `line`.
- **Menu**: painel que desce sob o cabeçalho, fundo `surface-1` opaco (nunca vidro: é lista de leitura), borda inferior `line`, lista vertical das páginas (cada item ≥ 48px de altura, largura total). Feito com `<details>/<summary>` para funcionar sem JavaScript; foco visível; a página atual leva `aria-current="page"` e um marcador além da cor (barra lateral de 4px em `grass` + peso 600).
- **Ordem do menu**: O jogo, Modos de jogo, Clubes, Perguntas, Roteiro, Devlog, Apoiar.
- **Sem barra de abas embaixo** no site: ela é padrão do jogo e confundiria com o app. O alcance do polegar vem dos CTAs no corpo (cada página termina com a Chamada final, na metade de baixo da tela).

### Desktop (720px ou mais)

- Mesmo cabeçalho, com o menu em linha (itens em `rotulo`, `ink-muted`, `ink` no hover e na página atual; atual também com sublinhado de 2px em `grass`; alvos ≥ 44px), sem botão Menu; "Jogar" continua à direita.
- Conteúdo em coluna de leitura de no máximo `--layout-content-max` (720px); grades e seções de duas colunas vão a `--layout-wide-max` (1040px).

### Rodapé (todas as páginas)

Texto e links conforme `complementos.md` ("Rodapé"). Dois blocos empilhados no celular, em duas colunas (2fr 3fr) no desktop: (1) aviso e linha de versão (`config.version`, em `rotulo`, `tabular-nums`); (2) links: Privacidade, Apoiar, Roteiro, Devlog, Discussões (só se `config.contacts.discussionsUrl` não for vazio) e, à parte, "RSS do devlog". Fundo `surface-0`, borda superior `line`, texto `ink-muted`, links em `ink` sublinhados com alvo ≥ 44px (padding vertical, não só a altura da linha). Sem vidro, sem feixe.

### Pular para o conteúdo

Primeiro elemento focável de toda página: link "Pular para o conteúdo" (visível no foco) para `#conteudo` no `<main>`.

## Estado dos recursos (fonte única)

Todo recurso citado no site leva um **StatusBadge** com um de três valores:

| Valor                | Quando                                                           |
| -------------------- | ---------------------------------------------------------------- |
| `disponivel`         | Já pode ser jogado na versão publicada em `/jogo`.               |
| `em-desenvolvimento` | Pertence à etapa com estado "em andamento" em `docs/roadmap.md`. |
| `planejado`          | Pertence a uma etapa com estado "planejada".                     |

O estado é derivado da etapa do recurso, lida de `docs/roadmap.md` no build (o mesmo leitor do Roteiro), e só vira `disponivel` por marcação explícita no arquivo de dados quando a tarefa for publicada (conferir em `docs/status.md`). Nada muda aqui com a direção A.

## Tokens novos (direção A e toques)

Todos entram em `design/tokens.json`, com uso marcado **"só no site"**, e saem nos dois temas em `app/src/tokens.css` e `site/src/theme-auto.css` (pelo `npm run tokens`; nunca à mão). O jogo não usa nenhum deles.

### Cores

| Token           | Noite                    | Dia                      | Uso                                                                                                         |
| --------------- | ------------------------ | ------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `surface-glass` | `rgba(23,37,52,0.62)`    | `rgba(255,255,255,0.72)` | Fundo do cartão de vidro (`GlassCard`) e da etiqueta do hero. Sempre com `glass-line` e `backdrop-filter`.  |
| `glass-line`    | `rgba(255,255,255,0.09)` | `rgba(16,32,44,0.10)`    | Borda de 1px do vidro e do cabeçalho. Decorativa.                                                           |
| `beam`          | `rgba(255,214,120,0.12)` | `rgba(240,180,41,0.14)`  | Feixe de refletor: gradientes do `StadiumHero` e do `PageHero`, brilho do `h1`. Decorativo, nunca sob link. |
| `sticker`       | `#fbf6e9`                | `#ffffff`                | Papel da figurinha (`Sticker`). Claro nos dois temas.                                                       |
| `on-sticker`    | `#10202c`                | `#10202c`                | Texto, contorno e símbolo do escudo sobre `sticker`.                                                        |
| `sticker-muted` | `#4e5a63`                | `#4e6170`                | Cidade e número da figurinha sobre `sticker`.                                                               |
| `board`         | `#13261f`                | `#fbfcf8`                | Lousa (noite) ou quadro branco (dia) do diagrama a giz. Só na página O jogo.                                |
| `chalk`         | `#eef3ec`                | `#10202c`                | Giz: jogadores, setas e texto sobre `board`.                                                                |
| `chalk-line`    | `rgba(238,243,236,0.55)` | `#8ea2b2`                | Linhas do campo desenhadas a giz. Decorativa.                                                               |
| `mark`          | `#ffc83d`                | `#1565c0`                | Destaque a giz (rótulo "4-3-3", círculo do jogador em foco) sobre `board`.                                  |

**Calibragem do feixe (atenção, CEO):** o mockup usou `beam` a 0,20 (noite) e 0,22 (dia). Ao conferir o contraste, vi que os quatro gradientes do hero se sobrepõem no centro do topo (dois focos de canto e duas faixas diagonais): com 0,20 e duas camadas, `ink-muted` cai a 3,0:1 e `floodlight` a 4,2:1 no tema noite. Baixei para 0,12 e 0,14, que mantêm o efeito visível e, junto com as regras abaixo, passam em qualquer sobreposição. A imagem de compartilhamento continua com 0,22 (texto só grande; ver `docs/art/og-image.md`).

### Sombra

| Token         | Noite                         | Dia                             | Uso                                                                                                                                                                                             |
| ------------- | ----------------------------- | ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `shadow-lift` | `0 10px 8px rgba(0,0,0,0.45)` | `0 8px 8px rgba(16,32,44,0.22)` | Sombra de objeto "em pé": escudos no gramado do hero e figurinhas. Valor de sombra única (sem `spread`), para servir tanto em `box-shadow` quanto em `filter: drop-shadow(var(--shadow-lift))`. |

O sistema dizia que `shadow-card` era o único sombreado; `shadow-lift` é o segundo, só no site.

### Tipografia

- `display-xl` passa a: `fontWeight` **800**, `fontSize` `clamp(72px, 21vw, 196px)`, `lineHeight` `0.84`, `letterSpacing` `-0.01em`, caixa alta. Uso: só o nome do jogo no hero do Início. O script `tokens-to-css.mjs` precisa aceitar `fontSize` em `clamp()` e `lineHeight` sem unidade (hoje todos são px).
- O site carrega mais um arquivo: `@fontsource/barlow-condensed/800.css` (cerca de 22 KB). Itálicos não entram (o rótulo "4-3-3" do diagrama usa Barlow Condensed 600 normal, já carregada).
- `display-lg` (40/44, 700) fica como está e passa a ser o estilo de todo `h2` de seção do site e do `h1` das páginas internas, em todas as larguras (o mockup usava 56px no desktop; fica 40px para não criar estilo novo).

### Derivações permitidas (sem token novo)

Só estas, sempre a partir de token, nunca cor literal:

| Onde                                  | Valor                                                                                                                        |
| ------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Fundo do cabeçalho                    | `color-mix(in srgb, var(--surface-0) 78%, transparent)`                                                                      |
| Brilho atrás dos cartões de vidro     | `radial-gradient(50% 50% at 50% 50%, color-mix(in srgb, var(--grass) 15%, transparent), transparent 70%)`                    |
| Halo do botão primário (hero e final) | `0 0 0 6px color-mix(in srgb, var(--grass) 22%, transparent), 0 10px 40px color-mix(in srgb, var(--grass) 45%, transparent)` |
| Hover do cartão de vidro              | borda `color-mix(in srgb, var(--grass) 55%, transparent)`                                                                    |
| Moldura interna da figurinha          | borda 2px `color-mix(in srgb, var(--on-sticker) 12%, transparent)`                                                           |
| Ponto da etiqueta do hero             | anel `0 0 0 4px color-mix(in srgb, var(--floodlight) 30%, transparent)`                                                      |

O mockup tem cores literais (`#fff` no título da chamada final e nas faixas do gramado, `rgba(0,0,0,…)` nas sombras); na implementação elas viram os tokens acima.

### Contraste (calculado, WCAG 2)

Valores compostos sobre `surface-0` (o vidro e o feixe são translúcidos). "Pior caso" = o ponto de maior sobreposição do feixe (até 4 camadas no hero).

| Par                                                                   | Noite       | Dia         | Regra                                      |
| --------------------------------------------------------------------- | ----------- | ----------- | ------------------------------------------ |
| `ink` sobre vidro (sobre `surface-0` / sobre o brilho verde)          | 14,9 / 13,5 | 16,2 / 15,5 | ok                                         |
| `ink-muted` sobre vidro (idem)                                        | 7,6 / 6,9   | 6,3 / 6,0   | ok                                         |
| `info` (link) sobre vidro (idem)                                      | 7,1 / 6,4   | 5,6 / 5,4   | ok                                         |
| `ink` sobre feixe, pior caso                                          | 5,3         | 11,9        | ok: único texto corrido permitido no feixe |
| `ink-muted` sobre feixe, pior caso                                    | 2,7         | 4,6         | **proibido** sobre o feixe                 |
| `info` sobre feixe, pior caso                                         | 2,5         | 4,1         | **proibido**: nenhum link no feixe         |
| destaque do slogan: `floodlight` (noite) / `grass` (dia), pior caso   | 3,75        | 3,86        | só como texto grande (≥ 24px): `titulo`    |
| `on-sticker` sobre `sticker`                                          | 15,4        | 16,6        | ok                                         |
| `sticker-muted` sobre `sticker`                                       | 6,6         | 6,4         | ok                                         |
| `chalk` sobre `board`                                                 | 14,1        | 16,1        | ok                                         |
| `mark` sobre `board`                                                  | 10,3        | 5,6         | ok                                         |
| `ink` sobre `pitch` (título da chamada final, noite)                  | 5,9         | 4,1         | no dia a chamada final troca de fundo      |
| `ink` sobre `grass-soft` (chamada final, dia; linha atual das etapas) | 9,3         | 14,0        | ok (par já conferido)                      |

**Regras que saem daí:**

1. Sobre o feixe (hero do Início e `PageHero`), texto corrido só em `ink`. Lead e nota do hero ficam em `ink` (no mockup estavam em `ink-muted`). Nada de link no feixe: lá só há botões.
2. O trecho em destaque do slogan usa `floodlight` (noite) ou `grass` (dia) e o slogan inteiro fica em `titulo` (28/32, 700), que é texto grande (limite 3:1). Destaque também por forma: o trecho fica em `<strong>` (o peso já é 700; use `<em>` sem itálico só se o leitor de tela precisar de ênfase).
3. O `tokens-to-css.mjs` hoje só confere cores hexadecimais. Os tokens com `rgba` ficam fora da lista de pares automáticos; acrescente à lista os pares sólidos novos: `on-sticker`/`sticker`, `sticker-muted`/`sticker`, `chalk`/`board`, `mark`/`board`. Os valores compostos acima ficam documentados aqui (opcional: o script compor `rgba` sobre `surface-0` antes de medir).

## Componentes

Em `site/src/components/`, todos sem JavaScript no cliente, só tokens. Props em inglês.

### Novos

| Componente        | Props                                                                                                 | Onde                                 |
| ----------------- | ----------------------------------------------------------------------------------------------------- | ------------------------------------ |
| `StadiumHero`     | `title`, `slogan`, `sloganHighlight`, `lead`, `note?`, `primary`, `secondary?`, `clubs` (5)           | Início                               |
| `PageHero`        | `title`, `lead?`, `kicker?`                                                                           | Todas as páginas internas            |
| `FloodlightTower` | `side: 'left' \| 'right'`                                                                             | Dentro do `StadiumHero`              |
| `PitchShowcase`   | `clubs` (5), `height?`                                                                                | Dentro do `StadiumHero`              |
| `GlassCard`       | `as?: 'li' \| 'div' \| 'article'`, `interactive?: boolean`, slot                                      | Base do `FeatureCard`; etiqueta hero |
| `Sticker`         | `club: { id, shortName, city, state, colors, abbreviation }`, `number: number`, `size?: 'md' \| 'lg'` | Clubes                               |
| `StickerGrid`     | `clubs`                                                                                               | Clubes (substitui o `ShieldGrid`)    |

### Alterados

| Componente      | O que muda                                                                                                                                                                                                                                                             |
| --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SiteHeader`    | Pele de vidro (ver Navegação).                                                                                                                                                                                                                                         |
| `SiteFooter`    | Texto e links de `complementos.md`; layout 2fr 3fr no desktop.                                                                                                                                                                                                         |
| `FeatureCard`   | Passa a ser um `GlassCard` (`radius-lg`, padding `space-4`, `space-6` no desktop). Ícone em quadrado de 44px, `grass-soft`, `radius-md`. Título em `subtitulo` caixa alta. Link no pé (`margin-top: auto`).                                                            |
| `StepList`      | Número em círculo de 56px, `surface-0`, anel interno de 2px `floodlight` (dia: 3px), número `ink` (dia) ou `floodlight` (noite) em Barlow Condensed 800 32px. Cada passo num cartão `surface-1`, borda `line`, `radius-lg`. Título do passo em `subtitulo` caixa alta. |
| `StageTable`    | Vira **tabela de classificação** e ganha `variant: 'compact' \| 'full'`. Substitui o `StageStrip` (que sai). Detalhe abaixo. Corrige o bug da grade.                                                                                                                   |
| `TacticDiagram` | Ganha `variant: 'pitch' \| 'chalk'` (padrão `pitch`); na página O jogo, `chalk`. Detalhe abaixo.                                                                                                                                                                       |
| `FinalCta`      | Vira um pedaço de gramado com o círculo central. Detalhe abaixo.                                                                                                                                                                                                       |
| `Button`        | Primário ganha a prop `glow?: boolean` (halo; só no hero e na chamada final). Hover: `translateY(-1px)` só sem movimento reduzido.                                                                                                                                     |
| `PostCard`      | `surface-1`, borda `line`, `radius-lg`, padding `space-6` no desktop; título em `subtitulo` 700; linha de data e etapa em `rotulo` `ink-muted`.                                                                                                                        |
| `ShieldGrid`    | Sai do site (Clubes passa a usar `StickerGrid`; o hero usa `PitchShowcase`). Pode ser apagado.                                                                                                                                                                         |

Mantêm-se sem mudança visual: `StatusBadge`, `FaqItem`, `MatchSample`, `NewsSample`, `FanMeter`, `RhythmCompare`, `TableScroll`, `Icon`. Ficam sobre `surface-0`/`surface-1`, sem vidro.

### `StadiumHero` (Início)

Estrutura de cima para baixo, centralizada, padding `space-8` no topo do celular e 72px no desktop:

1. **Fundo de feixes** (`::before`, `aria-hidden`, `z-index` atrás do conteúdo, `isolation: isolate` no hero): quatro camadas em `var(--beam)`: `radial-gradient(70% 55% at 0% 0%, var(--beam), transparent 70%)`, o mesmo em `100% 0%`, `linear-gradient(118deg, transparent 30%, var(--beam) 45%, transparent 58%)` e o mesmo a `242deg`. Para reduzir faixas (banding) em telas de 8 bits, nada além disso (sem ruído em imagem).
2. **Torres de refletor** (`FloodlightTower`, SVG inline 120×90, `aria-hidden`): placa `surface-2` com borda `line`, 8 lâmpadas (círculos r7) em `floodlight`, poste `line`. Celular: 64px de largura, a −14px das bordas, topo 8px. Desktop: 120px, a 24px das bordas.
3. **Etiqueta** "Em desenvolvimento, em público" em `rotulo`, `GlassCard` pílula (`radius-pill`, padding 6px 14px) com ponto de 8px `floodlight` e anel (derivação acima). Não é alvo de toque.
4. **`h1`** com `config.name` em `display-xl`, `ink`, `text-shadow: 0 0 48px var(--beam)`.
5. **Slogan** de `config.slogan['pt-BR']` em `titulo`, `ink`, `max-width: 30ch`; o trecho final (o mesmo do título curto da imagem, `slogan.short`) em destaque (regra 2 do contraste). O ponto de corte vem da configuração, não de índice fixo no código.
6. **Lead** em `body`, `ink`, `max-width: 46ch`.
7. **CTAs**: primário "Abrir a versão atual (v…)" com `glow`, secundário "Ver o roteiro". Celular: empilhados, largura total até 360px. Desktop: em linha, centralizados.
8. **Nota** em `caption`, `ink` (não `ink-muted`; regra 1), `max-width: 46ch`.
9. **`PitchShowcase`** (abaixo), encostado nas bordas da tela no celular (margem lateral negativa igual ao padding).

### `PitchShowcase`

Gramado em perspectiva, `aria-hidden="true"` (decorativo; os escudos não têm nome aqui). SVG `viewBox="0 0 1000 260"`, `preserveAspectRatio="none"`, altura 190px no celular e 300px no desktop:

- Trapézio `M140 0H860L1000 260H0Z` preenchido com gradiente vertical de `pitch` (opacidade 0 no topo, 1 a 35%).
- Cinco faixas de gramado em `pitch-line` com `opacity="0.06"`: `M140 0H212L100 260H0Z`, `M284 0H356L300 260H200Z`, `M428 0H500L500 260H400Z`, `M572 0H644L700 260H600Z`, `M716 0H788L900 260H800Z`.
- Linhas em `pitch-line`, traço 3, `opacity="0.75"`: linha de fundo `M120 40H880`, linha do meio `M500 40V260`, elipse do círculo central (500,150) rx150 ry62, ponto central r5.
- Cinco escudos de `shield.ts` sobre o gramado, alinhados embaixo (a 30px do pé; 50px no desktop), com `filter: drop-shadow(var(--shadow-lift))`. Larguras no celular 54/64/84/64/54px, com o 2º e o 4º subindo 18px e o do meio 32px; no desktop 84/100/128/100/84, subindo 30 e 54px. Escolha dos clubes: os mesmos 5 de hoje (`exampleClubIds`), ordem fixa.

### `PageHero` (páginas internas)

Versão contida do hero, para dar a cara de estádio sem repetir o show do Início: padding `space-8` em cima e `space-6` embaixo; fundo só com os dois focos de canto (`radial-gradient(60% 80% at 0% 0%, var(--beam), transparent 70%)` e o mesmo em `100% 0%`), sem faixas diagonais e sem torres. `kicker` opcional em `rotulo` `ink`; `h1` em `display-lg`, `ink`; `lead` em `body` 17/26, `ink` (regra 1). Alinhado à esquerda, largura da coluna de leitura.

### `GlassCard`

`background: var(--surface-glass)`, `border: 1px solid var(--glass-line)`, `radius-lg`, `backdrop-filter: blur(14px) saturate(1.2)` (e `-webkit-`). Só se usa sobre fundo decorado (brilho verde ou feixe); sobre `surface-0` liso, use cartão `surface-1` comum. Fallback (`@supports not (backdrop-filter: blur(1px))` ou `prefers-reduced-transparency: reduce`): `surface-1` opaco com borda `line`. Com `interactive`: hover/foco-dentro troca a borda (derivação acima) e sobe 2px (sem movimento reduzido, só a borda). Limite de desempenho: no máximo 6 elementos com `backdrop-filter` por página (cabeçalho + etiqueta + 4 cartões no Início).

### `Sticker` (figurinha de clube, da C)

Cartão de papel, não interativo, `<figure>` dentro de `<li>`:

- Largura 128px (`md`) ou 160px (`lg`); `background: var(--sticker)`, `color: var(--on-sticker)`, `radius-md`, `overflow: hidden`, padding inferior `space-3`, centralizado; sombra `var(--shadow-lift)`; moldura interna de 2px a 6px da borda (derivação acima, `pointer-events: none`).
- **Faixa** de 34px no topo: `linear-gradient(115deg, <cor 1> 0 55%, <cor 2> 55% 100%)` com `colors[0]` e `colors[1]` do clube (dado do clube, como no escudo; não é cor de interface). Decorativa.
- **Número** no canto superior esquerdo (top 8px, left 10px): pílula `sticker` com raio `radius-sm`, Barlow Condensed 800 14px, `sticker-muted`, `tabular-nums`, dois dígitos ("07"). É a ordem na grade, `aria-hidden="true"`.
- **Escudo** de `shield.ts` (76px em `md`, 84px em `lg`), subindo 14px sobre a faixa, `role="img"`, `aria-label="Escudo: {shortName}"`. No contêiner da figurinha, redefina `--ink: var(--on-sticker)`, porque o gerador desenha contorno e símbolo em `var(--ink)` e, no tema noite, `ink` é claro e sumiria no papel.
- **Nome** (`shortName`) em Barlow Condensed 800, `subtitulo` em tamanho (20/24) caixa alta, `on-sticker`, quebra permitida.
- **Cidade** em `caption`, `sticker-muted`: "{city} · {state}".
- Sem inclinação, sem animação de "colar" (simples antes de bonito; a C tinha, a A não traz).
- `StickerGrid`: `<ul>` com `grid-template-columns: repeat(auto-fill, minmax(128px, 1fr))`, `justify-items: center`, gap `space-4`; dá 2 colunas a 360px e até 6 a 1040px. Nada de nome de clube real em lugar nenhum; vale a mesma lista de clubes do site (hoje os exemplos de `exampleClubIds`).

### `StageTable` (etapas como tabela de classificação, da C)

Uma `<table>` de verdade em todas as larguras, dentro do `TableScroll` (rolagem horizontal só no contêiner, com o rótulo "{nome da tabela} (tabela com rolagem)"):

- **`compact`** (Início, "Onde estamos"): colunas Etapa, Nome, Estado. **`full`** (Roteiro e Modos): Etapa, Nome, O que entra (`aria-label` com o nome longo, conforme `complementos.md`), Estado.
- Contêiner `surface-1`, borda `line`, `radius-lg`, padding `space-2`. Cabeçalho em `rotulo`, `ink-muted`, alinhado à esquerda, com borda inferior `line`.
- Linhas com altura mínima 48px, padding `space-2` `space-3`, divisória `line` entre linhas (como a `LinhaTabela` do jogo).
- Coluna **Etapa** fixa (`position: sticky; left: 0`, fundo igual ao da linha), largura 52px, Barlow Condensed 800 26px, `tabular-nums`; `ink-muted` nas planejadas, `ink` na concluída e na atual.
- Coluna Nome em `body-strong`; `min-width: 0` e `overflow-wrap: anywhere` para quebrar em vez de vazar. Coluna Estado com `StatusBadge` (nunca encolhe: `white-space: nowrap`, `width: 1%`). No `full`, "O que entra" em `body`, `ink-muted`, `min-width: 220px`.
- **Linha atual**: fundo `grass-soft`, barra de 4px à esquerda em `grass` (`box-shadow: inset 4px 0 0 var(--grass)` na primeira célula), `aria-current="step"` no `<tr>` e o selo "Em desenvolvimento". Forma + texto, nunca só cor.
- Todas as linhas levam `StatusBadge` (inclusive as planejadas; o mockup mostrava texto solto "planejada").

### `TacticDiagram` variante `chalk` (da B, só em O jogo)

Mesmo desenho e mesmas três formas (`formation`, `posture`, `pressure`), com `<title>` e o texto alternativo aprovado em `complementos.md`; o que muda é a pele:

- Fundo `board` com `radius-md`; linhas do campo em `chalk-line`, traço 2; jogadores em `chalk`; setas da postura em `chalk`, traço 2,6, ponta arredondada; faixas da pressão em `chalk` com opacidade 0,15 / 0,35 / 0,6 (o texto alternativo descreve "cada uma mais clara"); rótulo da formação "4-3-3" em Barlow Condensed 600 18px, `mark`, dentro do SVG (`aria-hidden`; o `<title>` já diz a formação).
- **Efeito de giz** só nos traços (nunca no texto): `<filter id="chalk-{kind}">` com `feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2"` e `feDisplacementMap scale="2.4"`. Ids únicos por diagrama (há três na página). Custo de CPU limitado: três diagramas, nada mais leva o filtro.
- Fica dentro dos três `FeatureCard` de "Você manda no time" (o cartão é `surface-1`, não vidro, porque a lousa já é o destaque).
- A presilha, a moldura da prancheta e a textura de lousa da B **não** entram.

### `FinalCta` (todas as páginas que têm chamada final)

- Seção de largura total, `overflow: hidden`, padding 64px em cima e 72px embaixo, centralizada.
- **Noite**: fundo `pitch`; desenho do campo em SVG (`aria-hidden`, `preserveAspectRatio="xMidYMid slice"`, `viewBox="0 0 1000 400"`): linha do meio, círculo central r120 e as duas grandes áreas (retângulos 160×220 cortados nas bordas), traço 3 em `pitch-line` com opacidade 0,3. Título em `display-lg`, `ink` (5,9:1 sobre `pitch`; onde a linha cruza o texto o contraste local fica em cerca de 3,6:1, aceito porque o título é texto grande).
- **Dia**: fundo `grass-soft`, linhas em `grass` com opacidade 0,35, título em `ink`.
- Botões: primário com `glow`; secundário com fundo `surface-0` e texto `ink`, sem contorno.
- O título e os botões são os de `complementos.md` ("Fechamento").

## Páginas

Todas: `SiteHeader`, `PageHero` (exceto o Início, que usa o `StadiumHero`), corpo em seções com `h2` em `display-lg`, `FinalCta` onde já existe, `SiteFooter`. Seções com padding vertical de 48px no celular e 72px no desktop. A ordem e o texto das seções seguem os arquivos aprovados de `docs/content/site/`; aqui está o que muda no visual.

### Início (`/`)

1. **Abertura**: `StadiumHero` (substitui o hero atual e o `ShieldGrid` decorativo).
2. **O que é**: no desktop, duas colunas (5fr 7fr): `h2` à esquerda, texto à direita; primeiro parágrafo em `subtitulo` 600 24/30, `ink`; demais em `body` 17/26. No celular, empilhado.
3. **Destaques**: seção com o brilho verde atrás (derivação acima); 4 `FeatureCard` de vidro, `interactive`. 1 coluna no celular, 2 a partir de 600px, 4 a partir de 960px. O cartão de clubes mantém a fileira de 4 escudos de 30px.
4. **Como começar** e **Onde estamos**: no desktop, lado a lado (duas colunas iguais, gap 48px); no celular, empilhados nessa ordem. Como começar: `StepList` novo + nota em `caption` com o link do roteiro. Onde estamos: `StageTable variant="compact"` + link "Ver o roteiro completo". **Esta é a correção do bug** (seção própria abaixo).
5. **Jeito de fazer**: três blocos `surface-1` com borda `line`, `radius-lg`, fundo `linear-gradient(160deg, var(--surface-1), var(--surface-0))`; título em `subtitulo` caixa alta. 1 coluna no celular, 3 no desktop. (No código atual vem antes de "Onde estamos"; passa para depois, como no mockup aprovado.)
6. **Últimas do devlog**: `PostCard` novo + "Todos os posts".
7. **Chamada final**: `FinalCta` novo; o parágrafo de fechamento (devlog, roteiro, perguntas, apoiar) segue embaixo, em coluna de leitura, `ink-muted`, links `info`.

### O jogo (`/o-jogo/`)

- `PageHero` com título e resumo; o sumário de âncoras ("Nesta página") fica logo abaixo, como lista de links ≥ 44px em `surface-1`.
- **Você manda no time**: os três `TacticDiagram` passam a `variant="chalk"` (único lugar do site com giz).
- **A partida**: `MatchSample` sem mudança; o placar em `placar-xl` ganha um cartão `surface-1` `radius-lg`.
- **O clube em volta**, **Seu progresso fica protegido**, **O que vem depois**: sem mudança de estrutura; cartões `surface-1` com `radius-lg`; tabela "O que vem depois" com a coluna fixa do item.
- `FinalCta` novo.

### Modos de jogo (`/modos/`)

- `PageHero`.
- **Carreira** e **Liga online**: cada modo num cartão de vidro (`GlassCard`, não interativo) sobre o brilho verde; os passos da liga com o `StepList` novo.
- **Os dois ritmos**: `RhythmCompare` sem mudança.
- **O que entra em cada etapa**: `StageTable variant="full"` (classificação).
- `FinalCta` novo.

### Clubes (`/clubes/`)

- `PageHero`.
- **Alguns escudos de exemplo**: `StickerGrid` com os clubes de exemplo, figurinhas `md` (no desktop, `lg`); a frase aprovada logo abaixo, em `body`, `ink-muted`.
- **Quem está no jogo**: tabela com a coluna da divisão fixa, `StatusBadge` em todas as linhas.
- Demais seções (Como um clube nasce, Jogadores, Aviso, Patrocinadores) em texto, sem mudança.
- `FinalCta` novo.

### Perguntas (`/perguntas/`)

- `PageHero`.
- Grupos com `h2` em `display-lg`; `FaqItem` sem mudança (cada item `surface-1`, borda `line`, `radius-md`; `summary` ≥ 48px com seta além do texto).
- **Não achou a sua pergunta?** num `GlassCard` sobre o brilho verde.
- `FinalCta` novo. Corrigir o espaço que falta antes do link do roteiro (nota do `tech-writer`).

### Roteiro (`/roadmap/`)

- `PageHero` com o título e a nota do roteiro (`roadmapNote`) como lead.
- `StageTable variant="full"` (classificação), página larga.
- Acrescentar o `FinalCta` novo no fim (hoje a página termina na tabela; é a única de conteúdo sem chamada).

### Devlog (`/devlog/` e posts)

- Lista: `PageHero` com o título e a frase atual; posts em `PostCard` novo (tira os estilos inline de hoje), um por linha, gap `space-3`. Sem `FinalCta` (a página é de leitura e já tem RSS no rodapé).
- Post: `PageHero` com o título do post em `display-lg` e a linha de data e etapa como `kicker`; corpo em coluna de leitura, `body` 17/26; código e tabelas do Markdown em `surface-1`. Sem vidro e sem feixe no corpo.

### Apoiar (`/apoiar/`)

- `PageHero`.
- Texto em coluna de leitura; o parágrafo principal ("a melhor forma de apoiar…") num `GlassCard` sobre o brilho verde; a nota sobre menores em `caption`, `ink-muted`, fora do cartão.
- Se houver um bloco "Patrocine aqui", ele é um cartão `surface-1` comum, sem marca real.
- Sem `FinalCta` (o próprio texto é a chamada).

### Privacidade (`/privacidade/`)

- `PageHero` com o título; o resto é texto puro em coluna de leitura, `h2` em `display-lg`. **Nenhuma decoração** (sem vidro, sem brilho, sem `FinalCta`): é página de leitura e de confiança.

## O bug da grade "Onde estamos" (desktop)

**O que se vê** (`a-noite-de-estadio-desktop.png`): no desktop, a faixa de etapas era uma grade 4×2 dentro de meia coluna (cerca de 460px). Cada célula ficava com uns 105px; o selo "Em desenvolvimento" da etapa 1a e o nome "Série A (carreira)" não cabiam e invadiam a célula de "1b · Online mínimo", com textos encavalados.

**Causa:** colunas `minmax(0, 1fr)` deixam o conteúdo maior que a célula vazar para a vizinha sem cortar nem quebrar; o selo tem largura mínima fixa (texto sem quebra), e a meia coluna não comporta quatro selos lado a lado.

**Correção:** não há mais grade de cartões de etapas. "Onde estamos" usa a `StageTable variant="compact"` (uma linha por etapa, em todas as larguras), com nome quebrando (`min-width: 0`, `overflow-wrap: anywhere`) e selo que nunca encolhe. Na meia coluna de 460px sobram cerca de 230px para o nome, que cabe em uma ou duas linhas.

**Aceite:** sem sobreposição e sem rolagem horizontal da página a 360, 390, 720, 1024 e 1440px, nos dois temas, e com zoom de 200% a 1440px (a tabela pode rolar dentro do próprio contêiner). Vale conferir com o Playwright quando o E2E existir: as caixas de texto das células de uma mesma linha não se intersectam.

## Movimento

Regra geral: tudo é estático por padrão; o movimento só existe dentro de `@media (prefers-reduced-motion: no-preference)`. Nada em loop, nada que dispare sozinho depois do carregamento, total de entrada ≤ 1,2s.

| Onde                    | Efeito                                                                                             | Duração          |
| ----------------------- | -------------------------------------------------------------------------------------------------- | ---------------- |
| Feixes do `StadiumHero` | "acendem": opacidade de 0 a 1, uma vez, ao carregar                                                | 1,2s, `ease-out` |
| Setas do diagrama a giz | traço se desenha (`pathLength="1"`, `stroke-dashoffset` de 1 a 0), em sequência com 0,3s de atraso | 1s cada          |
| `GlassCard` interativo  | sobe 2px no hover e no foco-dentro                                                                 | 150ms            |
| `Button`                | sobe 1px no hover                                                                                  | 150ms            |
| Menu do celular         | abre sem animação de altura (é `<details>`)                                                        | —                |

- As setas do giz só animam com `@supports (animation-timeline: view())`, usando a própria visibilidade do diagrama como linha do tempo (a seção fica abaixo da dobra; sem isso, a animação rodaria fora da tela). Sem suporte, ficam desenhadas.
- Com `prefers-reduced-motion: reduce`: nenhum `animation` nem `transform` de hover; as trocas de cor de borda continuam, sem transição; nada de rolagem suave.
- Com `prefers-reduced-transparency: reduce`: vidro vira `surface-1` opaco (ver `GlassCard`).

## Acessibilidade

- **Contraste** ≥ 4,5:1 para texto em todos os pares usados, nos dois temas (tabela acima). Texto sobre `grass` só em `on-grass`; sobre `floodlight`, só em `on-floodlight`; sobre `sticker`, só `on-sticker`/`sticker-muted`; sobre `board`, só `chalk`/`mark`. Links em `info` com sublinhado (não só cor), nunca sobre o feixe.
- **Alvos** ≥ 44px em todo link e botão de navegação, rodapé, sumário e FAQ; espaço de pelo menos 8px entre alvos vizinhos. Figurinhas, etiqueta e selos não são alvos.
- **Estado nunca só por cor**: `StatusBadge` com texto e ícone; etapa atual com barra de forma + selo + `aria-current`; item atual do menu com barra/sublinhado; termômetro com número e rótulo.
- **Foco**: anel de 2px sólido em `focus`, `outline-offset: 2px`, em todo elemento interativo; nunca `outline: none` sem substituto. Sobre `pitch` (chamada final) o anel continua em `focus` (noite `floodlight`, 4,2:1 sobre `pitch`; dia `focus` sobre `grass-soft`, 4,9:1; acima dos 3:1 pedidos para contorno).
- **Semântica**: um `h1` por página, hierarquia sem saltos, `lang="pt-BR"`, `<nav aria-label="Principal">`, landmarks (`header`, `main`, `footer`); tudo que é decoração (`FloodlightTower`, `PitchShowcase`, desenhos do campo, faixa e número da figurinha) com `aria-hidden="true"`; diagramas táticos com `<title>` e legenda em texto; escudos com nome (`aria-label="Escudo: {nome}"`) onde não são decorativos.
- **Zoom e largura**: legível a 360px e com zoom de 200% sem rolagem horizontal da página (só as tabelas rolam dentro do próprio contêiner). O `h1` do hero usa `clamp()` e nunca passa da largura (a 360px, 72px cabem "PRANCHETA"; com nome mais longo em `config.name`, o `clamp` mínimo pode cair para 56px: conferir quando o nome definitivo existir).
- **Sem JavaScript**: tudo funciona sem JS (menu e FAQ em `<details>`).

## SEO e imagem de compartilhamento

O layout `Base.astro` aceita `title`, `description` e `ogType`. Já existem `canonical`, `og:*` e `twitter:card`. Muda:

- **Descrições**: as de `complementos.md` ("Descrições para compartilhar", aprovadas), em `<meta name="description">` e `og:description`, para todas as nove páginas (inclusive Devlog, que hoje não passa descrição curta).
- **Imagem por página**: uma PNG 1200×630 por página, gerada no build a partir de SVG, na composição da direção A. A especificação completa (camadas, coordenadas, fontes, rasterização, testes) está em `docs/art/og-image.md`. Títulos da imagem:

| Página      | Arquivo           | Título na imagem                                                 |
| ----------- | ----------------- | ---------------------------------------------------------------- |
| Início      | `index.png`       | `config.slogan.short['pt-BR']` ("O Brasil inteiro na prancheta") |
| O jogo      | `o-jogo.png`      | Como é jogar                                                     |
| Modos       | `modos.png`       | Carreira ou liga com amigos                                      |
| Clubes      | `clubes.png`      | Clubes com trocadilho                                            |
| Perguntas   | `perguntas.png`   | Perguntas frequentes                                             |
| Roteiro     | `roadmap.png`     | O roteiro do jogo                                                |
| Devlog      | `devlog.png`      | Diário de desenvolvimento                                        |
| Apoiar      | `apoiar.png`      | Apoie o projeto                                                  |
| Privacidade | `privacidade.png` | Privacidade                                                      |

- Os posts do devlog usam `devlog.png` (`og:type` = `article`).
- Fonte única dos textos de compartilhamento: um arquivo de dados do site (sugestão: `site/src/data/share.ts`, com `{ slug, description, ogTitle }`), lido pelo `Base.astro` e pelo script da imagem; o título do Início vem do campo novo `slogan.short` em `config/prancheta.config.ts` (mexer em `config/` é caminho `/feature`).
- Tags: `og:image` e `twitter:image` com URL absoluta, `og:image:width` 1200, `og:image:height` 630, `og:image:alt` com o título da imagem.
- Também: `sitemap.xml` via `@astrojs/sitemap` e `robots.txt` (já feitos).

## Privacidade e terceiros

- Sem cookies, sem `localStorage` no site, sem analytics com identificação, sem pixels nem incorporações (vídeo, mapas, redes sociais).
- Nenhuma chamada a terceiros: fontes por `@fontsource`, ícones e desenhos como SVG inline no repositório, nada de CDN.
- Se um dia houver contagem de visitas, só agregada e sem identificação, com ADR e revisão do `security-auditor`.

## Tokens e tema (decisões anteriores)

Decisões do CEO em 2026-11-04, já aplicadas:

1. **Tema `dia` no site**: segue `prefers-color-scheme: light`; quem prefere escuro (ou não declara preferência) fica no `noite`, que continua padrão. Todas as páginas são conferidas nos dois temas. Na direção A, o `dia` é a "tarde de sol": fundo claro, feixes amarelados suaves, destaques em `grass`.
2. **Grupo `layout` em `design/tokens.json`**: `content-max` = 720px e `wide-max` = 1040px.
3. **`@astrojs/sitemap`** como dependência do site.

## Pedido ao `developer`

Caminho `/feature` (mexe em `design/tokens.json`, `scripts/`, `config/` e várias páginas).

1. **Tokens**: acrescentar em `design/tokens.json` as cores `surface-glass`, `glass-line`, `beam`, `sticker`, `on-sticker`, `sticker-muted`, `board`, `chalk`, `chalk-line`, `mark` e a sombra `shadow-lift`, com os valores e usos daqui (marcados "só no site"); mudar `display-xl` (800, `clamp`, `0.84`, `-0.01em`). Ajustar `scripts/tokens-to-css.mjs` para aceitar `rgba` (fora da conferência automática), `clamp()` e `lineHeight` sem unidade, e para conferir os quatro pares sólidos novos. Rodar `npm run tokens`; nunca editar os CSS gerados.
2. **Fonte**: importar `@fontsource/barlow-condensed/800.css` no `Base.astro`.
3. **Componentes**: criar `StadiumHero`, `PageHero`, `FloodlightTower`, `PitchShowcase`, `GlassCard`, `Sticker`, `StickerGrid`; alterar `SiteHeader`, `SiteFooter`, `FeatureCard`, `StepList`, `StageTable`, `TacticDiagram`, `FinalCta`, `Button`, `PostCard`; remover `StageStrip` e `ShieldGrid` quando não houver mais uso.
4. **Páginas**: aplicar a seção "Páginas" nas nove, inclusive a troca de ordem no Início e o `FinalCta` no Roteiro; tirar os estilos inline do Devlog.
5. **Imagem de compartilhamento**: `scripts/og.mjs` conforme `docs/art/og-image.md`, os dados de compartilhamento num arquivo só e o campo `slogan.short` na configuração.
6. **Conferência**: capturas a 360px e 1440px nos dois temas e com `prefers-reduced-motion: reduce`, mais o aceite do bug "Onde estamos"; depois, revisão de interface pelo `code-reviewer` com o checklist do `ux-designer` (quem escreveu esta especificação não revisa a própria casca).
