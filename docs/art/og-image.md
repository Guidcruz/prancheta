# Imagem de compartilhamento (Open Graph)

Exemplo para aprovação: `docs/art/og-image-exemplo.svg` (página Início, tema noite). Tudo é vetor com cores chapadas, sem imagem de terceiros e sem ComfyUI.

## Composição (1200×630)

Alinhamento central. Tudo o que importa fica no quadrado central de 630×630 (x 285 a 915), porque alguns apps cortam para quadrado; as laterais só têm fundo e respiro.

| Camada | Posição | Detalhe | Token |
| --- | --- | --- | --- |
| Fundo | 0,0 a 1200×440 | cor chapada | `surface-0` (noite) |
| Faixa superior | y 0, altura 12 | cor chapada | `floodlight` |
| Gramado | y 440 a 630 | faixa chapada, linha de 4 px no topo e meio círculo de raio 120 centrado em (600, 630) | `pitch`, `pitch-line` |
| Nome | centro x 600, linha de base y 118 | Barlow Condensed 700, 44 px, espaçamento 6, caixa alta | `floodlight` |
| Título | centro x 600, primeira linha de base y 232 | Barlow Condensed 700, 64 px, entrelinha 62, até 3 linhas, largura máxima 630 px | `ink` |
| Escudos | y 476, 96×108 cada, passo de 136 px, 4 escudos centrados (x inicial 348) | gerados por `shield.ts` | cores do clube |

- Nome vem de `config.name` (o exemplo usa "Prancheta"). Título e slogan vêm de `config.slogan['pt-BR']`; nunca escritos à mão. O site é só pt-BR.
- Título com mais de 3 linhas: reduza para 56 px e entrelinha 54; passou de 4 linhas, corte no limite de palavra e termine com reticências.
- Quebra de linha: por medição da fonte real (largura máxima 630 px), não por contagem de caracteres.
- Contraste (calculado): `floodlight` sobre `surface-0` cerca de 11:1; `ink` sobre `surface-0` cerca de 15:1; contorno `ink` dos escudos sobre `pitch` cerca de 6:1. Todos acima de 4,5:1.
- Miniatura de 300 px (escala 0,25): título de 64 px vira 16 px, legível; o nome de 44 px vira 11 px, é só marca. Por isso o título é a peça principal.
- Sempre o tema noite (identidade do produto), independente do tema do usuário.

## Escudos

- Sempre 4, de `app/src/data/clubs.serie-a.json`, renderizados por `shieldSpecFor(id, colors[0], colors[1], abbreviation)` e `shieldSvg(spec, 96)`.
- O SVG do gerador usa `var(--ink)` no contorno e nos símbolos; o script troca por `#f2f5f7` (valor `ink` noite, lido de `design/tokens.json`), pois o rasterizador não resolve variáveis CSS. Esse texto do símbolo `letter` também usa `var(--font-display)`: trocar por `'Barlow Condensed'`.
- Escolha determinística, por página: ordene os clubes por `id`, embaralhe com `Rng(seedFromString('og:' + slug))` e pegue 4 com pares de cores diferentes (compare `colors[0]` e `colors[1]`; descarte o que repete par já escolhido). Mesma página, mesma imagem em todo build.
- Nada de nome de clube na imagem, só o escudo.

## Variação por página

Muda só o título (e a semente dos escudos). Início usa o slogan; as outras usam o título da página (o mesmo do `<title>`, sem o sufixo do nome). Mesma grade; título curto (1 linha) sobe para 80 px e centraliza verticalmente no espaço entre y 150 e y 420.

## O que o script precisa fazer (para o developer)

1. Novo `scripts/og.mjs` e `npm run og`, encadeado no build do site (ou antes dele), como o `icons.mjs`.
2. Ler `design/tokens.json` (tema noite) e `config/prancheta.config.ts` (nome, slogan); a lista de páginas e títulos vem do conteúdo do site.
3. Montar o SVG de cada página seguindo o exemplo; escudos via `shield.ts` (importar com o alias resolvido; o script roda fora do Vite).
4. Rasterizar com `sharp` (mesma ferramenta dos ícones) para PNG 1200×630 e gravar em `site/public/og/<página>.png` (Início: `index.png`), ou em `dist/` no build, sem versionar os PNG. `og:image` e `twitter:image` com URL absoluta, `og:image:width/height`, `twitter:card=summary_large_image`.
5. Fontes: `sharp` (librsvg) usa fontes do sistema e não lê woff/woff2. No exemplo renderizado aqui, sem Barlow instalada, caiu em fonte genérica. Fornecer Barlow Condensed 700 em TTF/OTF ao rasterizador (converter os arquivos de `@fontsource` para TTF no script, ou registrar via fontconfig no CI), e falhar o build se a fonte não for encontrada, para nunca sair imagem com fonte errada.
6. Paleta de PNG (`png({ palette: true })`) para cor chapada. Limite: **300 KB por arquivo** (o exemplo sem a fonte certa dá cerca de 70 KB); o script falha acima disso.
7. Teste: dimensão 1200×630, tamanho, e título longo não passa de 4 linhas.
