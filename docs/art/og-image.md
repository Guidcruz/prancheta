# Imagem de compartilhamento (Open Graph)

**Status:** direção A, "Noite de estádio", escolhida pelo CEO em 2026-11-04, com os títulos curtos por página aprovados em `docs/content/site/complementos.md` ("Descrições para compartilhar"). Referência visual: `docs/design/site-direcoes/a-og.html` e `a-og.png`. O exemplo antigo `docs/art/og-image-exemplo.svg` (faixa chapada, sem feixes nem torres) ficou **obsoleto**; vale esta página. Contexto do site: `docs/design/site.md`, seção "SEO e imagem de compartilhamento".

Tudo é vetor gerado por código, sem imagem de terceiros e sem ComfyUI. Uma imagem por página, gerada no build.

## Composição (1200×630)

Tudo o que importa fica no quadrado central de 630×630 (x 285 a 915), porque alguns apps cortam para quadrado; as laterais só têm fundo, feixe e as torres. Cores do tema `noite`, lidas de `design/tokens.json` (sempre noite, independente do tema do usuário).

Camadas, de trás para a frente (coordenadas em px no espaço 1200×630):

| #   | Camada            | Geometria                                                                                                                                                                                   | Cor                                                                      |
| --- | ----------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| 1   | Fundo             | retângulo 0,0 1200×630                                                                                                                                                                      | `surface-0`                                                              |
| 2   | Foco esquerdo     | `radialGradient` `gradientUnits="userSpaceOnUse"` `cx=0 cy=0 r=1` `gradientTransform="translate(96 0) scale(540 378)"`; paradas: 0 = feixe, 0,7 = transparente                              | feixe (ver abaixo)                                                       |
| 3   | Foco direito      | igual, `translate(1104 0)`                                                                                                                                                                  | feixe                                                                    |
| 4   | Faixa 120°        | `linearGradient` `userSpaceOnUse` de (14, −23) a (1186, 653); paradas: 0,32 transparente, 0,45 feixe, 0,56 transparente; preenche o retângulo todo                                          | feixe                                                                    |
| 5   | Faixa 240°        | igual, de (1186, −23) a (14, 653)                                                                                                                                                           | feixe                                                                    |
| 6   | Faixa superior    | retângulo y 0, altura 12, largura total                                                                                                                                                     | `floodlight`                                                             |
| 7   | Torres            | a mesma torre do site (`FloodlightTower`), 120×90, em (40, 30) e (1040, 30): placa 104×52 em (8, 8) com raio 6, 8 lâmpadas r7 em x 26/49/72/95 e y 24/44, poste 8×30 em (56, 60)            | placa `surface-2`, borda `line` 2px, lâmpadas `floodlight`, poste `line` |
| 8   | Gramado           | trapézio (168,400) (1032,400) (1200,630) (0,630) com `linearGradient` vertical de `pitch`: opacidade 0 em y 400, 1 em y 480                                                                 | `pitch`                                                                  |
| 9   | Faixas do gramado | (168,400)(254,400)(120,630)(0,630); (341,400)(427,400)(360,630)(240,630); (514,400)(600,400)(600,630)(480,630); (686,400)(773,400)(840,630)(720,630); (859,400)(946,400)(1080,630)(960,630) | `pitch-line`, `opacity` 0,06                                             |
| 10  | Linhas do campo   | linha de fundo y 435 de x 144 a 1056; linha do meio x 600 de y 435 a 630; elipse centro (600, 533) rx 180 ry 55; ponto central r 5; traço 3, `opacity` 0,75                                 | `pitch-line`                                                             |
| 11  | Nome              | `config.name` em caixa alta, centro x 600, linha de base y 102; Barlow Condensed 700, 40px, `letter-spacing` 8                                                                              | `floodlight`                                                             |
| 12  | Título            | título curto da página em caixa alta, centralizado em x 600, largura máxima 630 (x 285 a 915); Barlow Condensed 800 (regras de tamanho abaixo)                                              | `ink`                                                                    |
| 13  | Escudos           | 4 escudos de 96×108 em x 366, 490, 614 e 738; topo em y 478 (1º e 4º) e y 456 (2º e 3º, "mais perto"); sombra abaixo                                                                        | cores do clube, contorno `ink`                                           |

- **Feixe**: a cor RGB do token `beam` (noite: 255, 214, 120) com opacidade fixa **0,22** na imagem (`stop-color` + `stop-opacity`). No site o token tem 0,12, por causa do texto pequeno; aqui todo texto é grande e o feixe pode ser mais forte, como no mockup aprovado. A constante fica no script, com comentário apontando para este documento.
- **Sombra dos escudos**: `<filter>` com `feGaussianBlur in="SourceAlpha" stdDeviation="4"`, `feOffset dy="10"`, `feComponentTransfer` com `feFuncA slope="0.5"` e `feMerge` com o gráfico original (não use `feDropShadow`, que nem toda versão do librsvg aceita).
- **Letter-spacing com centro**: com `text-anchor="middle"`, o espaçamento sobra à direita da última letra; some 4 (metade do espaçamento) ao x do nome.
- **Caixa alta**: o SVG do rasterizador não aplica `text-transform`; o script converte com `toLocaleUpperCase('pt-BR')`. Escape `&`, `<`, `>` e aspas antes de montar o SVG.
- Sem o brilho (`text-shadow`) do título que o mockup em HTML tinha: filtro em texto no librsvg é caro e pouco ganha na miniatura.

## Título: tamanho, quebra e posição

- **Quebra** por medição da fonte real, nunca por contagem de caracteres (ver "Medir texto").
- **1 ou 2 linhas**: 84px, distância entre linhas de base 76px. Linha de base da 1ª linha: **y 242** com 1 linha e **y 204** com 2 (o bloco fica centrado em y ≈ 212, entre o nome e o gramado).
- **3 linhas**: 68px, distância 62px, linhas de base em y 174, 236 e 298.
- **Mais de 3 linhas a 68px**: corte no limite de palavra na 3ª linha e termine com "…". Nenhum título aprovado chega perto disso (o maior tem 29 caracteres).
- **Palavra sozinha mais larga que 630px** (por exemplo "DESENVOLVIMENTO", se não couber a 84px): reduza o tamanho de 4 em 4px, até 68px, antes de quebrar em mais linhas.

Títulos por página (fonte: `complementos.md`; implementação: um arquivo de dados do site, ver `docs/design/site.md`):

| Página      | Arquivo           | Título                                                          |
| ----------- | ----------------- | --------------------------------------------------------------- |
| Início      | `index.png`       | `config.slogan.short['pt-BR']`: "O Brasil inteiro na prancheta" |
| O jogo      | `o-jogo.png`      | Como é jogar                                                    |
| Modos       | `modos.png`       | Carreira ou liga com amigos                                     |
| Clubes      | `clubes.png`      | Clubes com trocadilho                                           |
| Perguntas   | `perguntas.png`   | Perguntas frequentes                                            |
| Roteiro     | `roadmap.png`     | O roteiro do jogo                                               |
| Devlog      | `devlog.png`      | Diário de desenvolvimento (também nos posts)                    |
| Apoiar      | `apoiar.png`      | Apoie o projeto                                                 |
| Privacidade | `privacidade.png` | Privacidade                                                     |

Nada escrito à mão no script: nome de `config.name`, título do Início de `config.slogan.short`, demais títulos do arquivo de dados do site.

## Contraste (calculado)

- `ink` sobre `surface-0`: 16,1:1; sobre o feixe a 0,22 (uma camada): 9,1:1; no pior cruzamento das camadas, acima de 5,5:1.
- `floodlight` sobre `surface-0`: 11,4:1; sobre o feixe: 6,5:1; no pior cruzamento, cerca de 4:1. O nome tem 40px em 700 (texto grande, limite 3:1).
- Contorno `ink` dos escudos sobre `pitch`: cerca de 6:1.
- Miniatura de 300px (escala 0,25): título de 84px vira 21px, legível; o nome de 40px vira 10px, é só marca. O título é a peça principal.

## Escudos

- Sempre 4, de `app/src/data/clubs.serie-a.json`, por `shieldSpecFor(id, colors[0], colors[1], abbreviation)` e `shieldSvg(spec, 96)`.
- O SVG do gerador usa `var(--ink)` no contorno e nos símbolos: o script troca por `ink` do tema noite (`#f2f5f7`, lido de `design/tokens.json`), porque o rasterizador não resolve variáveis CSS. O texto do símbolo `letter` usa `var(--font-display)`: trocar por `'Barlow Condensed'`.
- Escolha determinística por página: ordene os clubes por `id`, embaralhe com `Rng(seedFromString('og:' + slug))` e pegue 4 com pares de cores diferentes (descarte o que repete um par já escolhido). Mesma página, mesma imagem em todo build.
- Nada de nome de clube na imagem, só o escudo.

## Fontes (o ponto sensível)

O `sharp` rasteriza SVG com o librsvg, que procura fontes pelo fontconfig do sistema e **não lê WOFF nem WOFF2**. Sem a fonte certa ele cai em outra família sem avisar (foi o que aconteceu no primeiro exemplo). Precisa de TTF ou OTF, e de dois pesos: **Barlow Condensed 700** (nome) e **800** (título).

Caminho sem dependência nova:

1. Ler `node_modules/@fontsource/barlow-condensed/files/barlow-condensed-latin-700-normal.woff` e `…-800-normal.woff` (o **WOFF 1**, não o WOFF2; o subconjunto `latin` cobre os acentos do português).
2. Converter WOFF 1 para TTF no próprio script com `node:zlib`: o WOFF 1 é o mesmo sfnt com cada tabela comprimida por zlib; basta ler o cabeçalho e o diretório de tabelas, descomprimir (`inflateSync`) cada tabela cujo tamanho comprimido seja menor que o original, e regravar cabeçalho sfnt, diretório (offsets recalculados, alinhados a 4 bytes) e tabelas. Cerca de 40 linhas.
3. Gravar os TTF numa pasta temporária (`os.tmpdir()/prancheta-og-fonts/`) com um `fonts.conf` mínimo que aponte só para ela (`<dir>` da pasta e `<cachedir>` temporário, mais `<include ignore_missing="yes">` da configuração do sistema para não quebrar nada).
4. Definir `process.env.FONTCONFIG_FILE` para esse `fonts.conf` **antes** de importar o `sharp` (importação dinâmica, `await import('sharp')`), porque o fontconfig lê a variável ao iniciar.
5. **Prova da fonte, que falha o build**: rasterizar "PRANCHETA" a 84px em `font-family="Barlow Condensed" font-weight="800"`, depois em `font-weight="700"` e depois numa família inexistente (`"Sem Fonte Prancheta"`), medir a largura de cada uma com `trim()` e exigir que as três sejam diferentes entre si (mais de 2px). Se 800 e a inexistente derem a mesma largura, a fonte não foi achada; se 700 e 800 forem iguais, o peso 800 não foi achado. Nunca sai imagem com fonte errada.

Se um dia trocar o `sharp` por outro rasterizador que aceite arquivos de fonte direto (por exemplo, que receba os TTF por parâmetro), os passos 3 e 4 somem; a conversão e a prova continuam.

## Medir texto

Sem biblioteca de métricas: meça cada linha candidata rasterizando só ela (SVG do tamanho da imagem, texto no tamanho e peso finais, com `letter-spacing` quando houver) e lendo a largura depois do `trim()`. Monte as linhas palavra por palavra, enquanto a largura ficar ≤ 630px. São poucos títulos e poucas medições por build; vale a precisão.

## O que o script precisa fazer (para o developer)

1. `scripts/og.mjs` e `npm run og`, rodando antes do `astro build` (encadeado no build do site, como o `icons.mjs` no do jogo).
2. Ler `design/tokens.json` (tema noite), `config/prancheta.config.ts` (nome e `slogan.short`) e o arquivo de dados de compartilhamento do site (títulos por página).
3. Preparar as fontes e fazer a prova (seção "Fontes"); falhar se não passar.
4. Montar o SVG de cada página com as camadas acima; escudos via `shield.ts` (com o alias de `@engine` resolvido; o script roda fora do Vite). A geometria da torre e do gramado pode ficar num módulo compartilhado com os componentes do site (`FloodlightTower`, `PitchShowcase`), para não divergir.
5. Rasterizar com `sharp` para PNG 1200×630, 24 bits, `compressionLevel: 9`, **sem paleta** (os gradientes do feixe fazem faixas visíveis com 256 cores). O mockup em PNG deu cerca de 100 KB. Limite: **300 KB por arquivo**; o script falha acima disso.
6. Gravar em `site/public/og/<arquivo>.png` (pasta no `.gitignore`; os PNG não são versionados). No `Base.astro`: `og:image` e `twitter:image` com URL absoluta (`https://${config.domain}` + caminho), `og:image:width` 1200, `og:image:height` 630, `og:image:alt` com o título da imagem, `twitter:card` = `summary_large_image`. Página sem imagem gerada: omitir as tags, nunca apontar para arquivo inexistente.
7. Testes (Vitest): as 9 imagens existem; dimensão 1200×630; tamanho ≤ 300 KB; prova da fonte; título longo de teste não passa de 3 linhas e termina em "…"; mesma entrada, mesmo arquivo (hash igual em duas execuções).
