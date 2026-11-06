# Avatares dos jogadores (T-027)

> Direção de arte e limites para o `developer` implementar `app/src/lib/generators/face.ts` (catálogo, pesos, codec, `faceSpecFromSeed`, tabela de retirados; sem SVG) e `app/src/lib/generators/avatar.ts` (só `renderFace`) (US-005, ADR-0012). Folha de exemplo: [`avatares-exemplo.svg`](avatares-exemplo.svg), gerada por `node scripts/avatar-sheet.mjs --sheet` (protótipo descartável; `--check` imprime as medidas citadas aqui). O protótipo tem o catálogo, o codec, o sorteador e o desenho funcionando e serve de referência de formas, não de código de produção.

## 1. Estilo do rosto

- **Busto em medalhão**: cabeça, pescoço e ombros dentro de um disco, viewBox `0 0 48 48`, quadrado. O disco é o mesmo para todos (`#5f7f98`, azul-acinzentado médio), nunca depende do tema nem do clube.
- **Cores chapadas, sem degradê, sem filtro, sem opacidade além de duas exceções** (barba por fazer e cabelo raspado, `fill-opacity` fixo). Contorno `ink` (`#0b1118`, o mesmo dos escudos) de 1,1 unidade, juntas arredondadas. É a mesma família do escudo v5: contorno escuro grosso, formas simples, cor sólida; o avatar não tem metal nem brilho.
- **Proporção**: cabeça um pouco grande (cerca de 55% da altura do disco), olhos pontos grandes, nariz e marcas só em traço fino. Simpático, não caricatura; nada de exagero de lábios, nariz ou olhos por tom de pele.
- **Camadas (ordem de desenho)**: 1 disco, 2 ombros (camisa neutra `#e6ebf0`), 3 silhueta do cabelo (por trás da cabeça), 4 pescoço (gola em V), 5 orelhas, 6 rosto, 7 marcas de expressão, 8 barba, 9 sobrancelhas, 10 olhos, 11 nariz, 12 boca, 13 franja do cabelo (só preenchimento, na frente do rosto), 14 linha do cabelo (traço `ink`) e, no moicano, a crista, 15 acessório. No máximo 16 elementos (`path`, `circle`, `rect`); sem `<defs>`, `id`, `clipPath`, `use`: vários avatares na mesma página não colidem.
- **Regra do cabelo (sem vão, sem contorno duplo)**: o cabelo nunca é uma peça só na frente do rosto. A **silhueta** vai atrás de orelhas e rosto, cobre o topo do crânio (largura x 12 a 36 em y 21, topo em y 6,2 ou mais alto) e tem o contorno `ink`; assim a cabeça "senta" no cabelo e o fundo nunca aparece entre os dois, perto da orelha ou em qualquer outro ponto. A **franja** é um preenchimento sem contorno, na frente, fechado por dentro da silhueta (pelo menos 0,8 de folga), que esconde o contorno do crânio sob o cabelo; a **linha do cabelo** é um traço `ink` à parte, de têmpora a têmpora. Estilos sem franja (careca, coroa) só têm silhueta ou nada; o raspado e o moicano usam franja translúcida (60%) com o contorno do crânio à mostra. Fios longos (tranças, dreads) saem de trás da cabeça. Barba volumosa (4 e 5) tem contorno `ink` fino; brinco fica no lóbulo da orelha, qualquer que seja o tamanho dela.
- **Camisa**: neutra por padrão. `renderFace(face, size, { shirt })` aceita uma cor de clube (passa por `safeColor`, como no escudo) para o card do jogador; não existe listra, número, gola de time nem símbolo. É opcional e a T-027 pode entregar sem ela.
- **Legível em 32, 48 e 96 px**: a 48 e 96 vale o desenho completo. Com `size <= 32` (mesma regra do escudo, `SMALL_SIZE`) a versão simples tira orelhas, nariz, marcas, e os acessórios que não sejam óculos; olhos viram pontos maiores, traços ficam em 1,7 e as sobrancelhas em no mínimo 1,6. A folha mostra os três tamanhos.
- **Temas claro e escuro**: o disco tem contraste de 3,68 a 4,22:1 com `surface-0` e `surface-1` dos dois temas (conferido), então o avatar nunca "some" no fundo, e o contorno `ink` tem 4,49:1 com o disco (acima de 3:1 para elemento gráfico). O tom de pele médio tem pouco contraste direto com o disco (1,1:1 no #a46a43), e quem separa a forma é o contorno; por isso o contorno nunca é omitido, nem na versão pequena.

## 2. Catálogo de traços (índices estáveis)

Regra do ADR-0012: **o catálogo só cresce**. Um índice nunca muda de significado nem é reaproveitado. Cada campo cabe em 1 caractere base36 (até 36 valores). O índice 0 de todo campo é o valor neutro ("padrão"/"nenhum"), usado como fallback.

| Campo       | N   | Índices                                                                                                                                                                                                                                                                                                                                                                                        |
| ----------- | --- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `skin`      | 12  | 0 `#f6d9c4`, 1 `#efc7a8`, 2 `#e5b48f`, 3 `#d9a077`, 4 `#c98c62`, 5 `#b87a50`, 6 `#a46a43`, 7 `#8d5636`, 8 `#744429`, 9 `#5e351f`, 10 `#4a2a19`, 11 `#3a2014`. Da mais clara à mais escura, em passos regulares de luminância. Sombra (pescoço, nariz, marcas) e cor de lábio derivadas por tom, em tabela fixa (`mix` 20% com preto; lábio `mix` 40% com `#963240`), gravadas como constantes. |
| `shape`     | 6   | 0 oval, 1 redondo, 2 quadrado, 3 alongado, 4 queixo fino, 5 mandíbula larga                                                                                                                                                                                                                                                                                                                    |
| `hairStyle` | 16  | 0 careca, 1 raspado, 2 curto, 3 curto com risca, 4 ondulado médio, 5 cacheado curto, 6 black power (redondo alto), 7 comprido liso, 8 coque, 9 tranças, 10 moicano/degradê alto, 11 entradas, 12 coroa (só laterais), 13 topete para trás, 14 cacheado comprido, 15 dreads                                                                                                                     |
| `hairColor` | 10  | 0 preto `#15110f`, 1 castanho-escuro `#2a1a12`, 2 castanho `#4b2f1e`, 3 castanho-claro `#6e4a2b`, 4 louro-escuro `#9c7440`, 5 louro `#cfa75a`, 6 ruivo `#8f3d20`, 7 grisalho `#8f979d`, 8 branco `#dde1e4`, 9 descolorido `#e8d79a`. A mesma cor vale para barba; sobrancelha é a cor misturada 30% com `ink`.                                                                                 |
| `brows`     | 6   | 0 reta fina, 1 reta grossa, 2 arqueada, 3 inclinada (séria), 4 cheia, 5 fina e alta                                                                                                                                                                                                                                                                                                            |
| `eyes`      | 6   | 0 redondo, 1 amendoado, 2 estreito, 3 grande, 4 caído, 5 pálpebra pesada                                                                                                                                                                                                                                                                                                                       |
| `nose`      | 6   | 0 pequeno, 1 arredondado, 2 reto longo, 3 largo, 4 ponta redonda, 5 estreito                                                                                                                                                                                                                                                                                                                   |
| `mouth`     | 6   | 0 neutra, 1 sorriso leve, 2 sorriso com dentes, 3 sorriso de canto, 4 séria, 5 lábios cheios                                                                                                                                                                                                                                                                                                   |
| `ears`      | 3   | 0 pequena, 1 média, 2 saliente                                                                                                                                                                                                                                                                                                                                                                 |
| `facial`    | 8   | 0 nenhuma, 1 barba por fazer, 2 bigode, 3 cavanhaque, 4 barba curta, 5 barba cheia, 6 barbicha de queixo (faixa), 7 bigode com pera                                                                                                                                                                                                                                                            |
| `accessory` | 6   | 0 nenhum, 1 faixa de cabeça branca lisa, 2 brinco de pino, 3 óculos redondos, 4 óculos retangulares, 5 esparadrapo no nariz. Só cinza e branco neutros e o contorno `ink`; nada de cor de clube, marca ou símbolo.                                                                                                                                                                             |
| `marks`     | 3   | 0 nenhuma, 1 vincos de expressão leves, 2 vincos mais fortes e testa marcada                                                                                                                                                                                                                                                                                                                   |

Tudo é combinação de formas simples, 12 campos, o que dá cerca de 1 bilhão de combinações; o teste de 1.000 jogadores do protótipo deu 1.000 códigos distintos.

### A idade entra na spec? Sim, só como contexto de sorteio, nunca guardada

`faceSpecFromSeed(seed, ctx)` recebe `ctx = { age, nationality }` e usa a idade **na criação** para pesar cabelo e barba. A `FaceSpec` não guarda a idade; o rosto fica fixo no save (ADR-0012, e o envelhecimento visual está fora do escopo da US-005). Efeito honesto: um jogador criado aos 17 anos continua com cara de 17 aos 32 (a base nova nasce com 17 a 19 anos). **Um rosto existente nunca é gerado de novo**, nem com a idade da criação nem com a atual: `faceSpecFromSeed` só roda quando o jogador é criado, e depois só vale `Player.face`. O que a idade faz no sorteio (faixas ≤23, 24 a 29, ≥30):

- **Cabelo**: careca e entradas só a partir de 24 anos; coroa e mais calvície a partir de 30 (tabelas abaixo).
- **Cor**: grisalho com probabilidade `min(30%, (idade − 29) × 6%)` e branco `min(8%, (idade − 32) × 2%)` (só 33 ou mais); antes disso, nada. Descolorido (9) vale em qualquer idade, é moda de jogador.
- **Barba**: mais frequente com a idade. **Marcas**: 0% abaixo de 28; de 28 a 31, 25% vincos leves; 32 ou mais, 40% leves e 15% fortes.
- Pessoas de 17 a 34 anos são geradas, então o conjunto é jovem por construção; os extremos (grisalho, branco) são raros.

### Pesos dos sorteios (soma 100 em cada linha)

Cada campo tem o próprio fluxo pseudoaleatório derivado de `fnv(seed|face|campo)`, para acrescentar um campo no futuro não mexer nos outros (o rosto já gravado não muda de qualquer jeito, mas a regeneração por semente continua estável).

| Campo                | Pesos (na ordem dos índices)                                               |
| -------------------- | -------------------------------------------------------------------------- |
| `shape`              | 24, 18, 16, 14, 12, 16                                                     |
| `eyes`               | 22, 20, 14, 16, 12, 16                                                     |
| `brows`              | 18, 22, 20, 14, 14, 12                                                     |
| `nose`               | 20, 18, 18, 16, 16, 12                                                     |
| `mouth`              | 24, 22, 14, 12, 14, 14                                                     |
| `ears`               | 40, 40, 20                                                                 |
| `accessory`          | 78, 4, 8, 3, 3, 4                                                          |
| `hairStyle` ≤23 anos | 0, 10, 16, 14, 8, 12, 5, 3, 3, 5, 5, 0, 0, 8, 4, 7                         |
| `hairStyle` 24 a 29  | 3, 10, 15, 13, 7, 11, 4, 3, 3, 4, 4, 3, 2, 8, 4, 6                         |
| `hairStyle` ≥30 anos | 8, 9, 14, 12, 6, 9, 3, 2, 2, 3, 2, 8, 6, 7, 3, 6                           |
| `hairColor` base     | 34, 24, 16, 8, 5, 3, 2, 0, 0, 8 (grisalho e branco só pela regra da idade) |
| `facial` ≤23 anos    | 66, 14, 3, 4, 6, 2, 3, 2                                                   |
| `facial` 24 a 29     | 48, 14, 5, 7, 13, 6, 4, 3                                                  |
| `facial` ≥30 anos    | 40, 12, 6, 8, 15, 10, 5, 4                                                 |

### Distribuição por nacionalidade, sem estereótipo

Só o **tom de pele** depende da nacionalidade; todo o resto (formato, olhos, nariz, boca, orelhas, acessório) usa os mesmos pesos para todo mundo, e nenhum traço é exclusivo de um país ou de um tom.

- **Brasil (1a, todos `BR`)**: pesos por tom, soma 100: `10, 11, 9, 8 | 9, 11, 12, 10 | 7, 6, 4, 3` (claros 38, médios 42, escuros 20, ordem de grandeza do retrato do país; dentro de cada faixa os tons ficam espalhados).
- **Etapa 5 (sul-americanos)**: a tabela por país entra com os clubes, aprovada pelo CEO. Regras fixas desde já: cada faixa (claro 0 a 3, médio 4 a 7, escuro 8 a 11) tem **no mínimo 5%** em qualquer país; nenhum país tem uma faixa só; nacionalidade desconhecida usa a tabela do Brasil.
- **Correlações suaves e únicas** (realismo, nunca exclusão): cabelo crespo/cacheado (5, 6, 9, 15) pesa ×1,5 para pele 8 a 11 e ×0,75 para pele 0 a 3, e todo estilo continua possível em todo tom; louro, louro-escuro e ruivo naturais (4, 5, 6) não saem para pele 7 ou mais (o peso vai para o preto), mas o descolorido (9) sai para todos.
- **Nada de "assinatura"**: nenhuma combinação é sorteada por jogador existente; a semente é o id do jogador, então não há como pedir um rosto parecido com alguém.

## 3. Codificação de `FaceSpec` em `Player.face` (até 32 caracteres)

```
face = "1" + skin + shape + hairStyle + hairColor + brows + eyes + nose + mouth + ears + facial + accessory + marks
```

- **Tamanho hoje: 13 caracteres** (`1` = versão do layout, mais 12 campos de 1 caractere base36 minúsculo, `0-9a-z`). Exemplo: `1945005321000`.
- **Margem**: até 31 campos no mesmo comprimento máximo de 32, e cada campo aceita até 36 valores. Crescer o catálogo (índice novo num campo) não muda o tamanho; acrescentar um campo é acrescentar um caractere no fim.
- **Compatibilidade**: o decodificador lê por posição e trata caractere ausente (rosto gravado antes de um campo existir) como `0`, que é sempre o valor neutro; por isso acrescentar campo no fim **não** exige subir a versão. A versão `1` só mudaria se a ordem dos campos mudasse, o que é proibido; uma versão `2` seria um layout novo e o decodificador de `1` continuaria existindo.
- **O decodificador nunca lança**: texto que não casa com `^[0-9a-z]{2,32}$`, versão desconhecida ou índice fora do catálogo vira `0` no campo (depois da tabela de retirados abaixo). Isso protege contra save editado à mão sem quebrar a tela.
- **`encodeFace` e `decodeFace` são inversas** para todo `FaceSpec` válido; `faceSpecFromSeed` é pura (mesmos `seed`, `age` e `nationality`, mesmo resultado) e nunca usa `Math.random` nem data.
- **Assinatura**: `faceSpecFromSeed(seed: number, ctx: { age: number; nationality: string }): FaceSpec`, com o segundo argumento aprovado pelo architect (nota de 2026-11-06 no ADR-0012). O pedido `squad` da `IdentitySource` ganha `ages: readonly number[]`, uma idade por jogador, e é daí que vem `age`; `renderFace(face: string | FaceSpec, size: number, opts?: { shirt?: string; label?: string }): string`. A tela chama `renderFace(player.face, …)`, nunca `faceSpecFromSeed`.

### Tabela de traços retirados

Em `face.ts`, ao lado do catálogo (`avatar.ts` só desenha):

```ts
/** Retired trait indices. A retired index is never reused; it maps to a live one. */
export const RETIRED_TRAITS: Partial<Record<FaceField, Record<number, number>>> = {};
```

Está vazia na T-027. Regras: (1) o decodificador aplica a troca antes de validar contra o catálogo; (2) o destino nunca é um índice retirado (sem cadeia, sem laço; teste); (3) o desenho do índice retirado pode sair do código, o índice fica reservado para sempre; (4) retirar um traço (por exemplo, um que se pareça demais com uma figura real) é uma entrada nessa tabela mais uma linha em `docs/art/inventario.md`, sem migração de save.

## 4. Limites do SVG e acessibilidade

Medidos no protótipo, em 1.000 rostos de 17 a 34 anos, com folga de cerca de 50%:

| Limite                                        | Versão completa (48 e 96 px)               | Versão pequena (≤ 32 px)      |
| --------------------------------------------- | ------------------------------------------ | ----------------------------- |
| Bytes por SVG (teto do teste, US-005)         | **3.200** (medido: máx 2.501, média 1.935) | **2.400** (medido: máx 2.084) |
| Elementos gráficos (`path`, `circle`, `rect`) | **20** (medido: máx 16)                    | **16** (medido: máx 13)       |
| Casas decimais nas coordenadas                | até 2 (arredondar)                         | idem                          |

Proibido no SVG (o teste de 1.000 jogadores da US-005 confere por expressão regular): `<script>`, `<style>`, `<text>`, `<image>`, `<foreignObject>`, `<use>`, `<defs>`, `<linearGradient>`, `<filter>`, `href`/`xlink:href`, atributos `on*`, `style=`, `url(`, `id=`, `class=`, `data:`. Só `svg`, `path`, `circle`, `rect`.

Acessibilidade:

- **Decorativo por padrão**: `aria-hidden="true" focusable="false"`, como o escudo. O nome do jogador já está em texto ao lado (lista, card, feed); duplicar seria ruído para leitor de tela.
- **Com nome só quando o avatar está sozinho** (por exemplo, miniatura num botão sem texto): `opts.label` vira `role="img" aria-label="…"`, sempre escapado (`escapeText` como no escudo). O rótulo é o nome do jogador, nunca uma descrição do rosto ("homem negro de barba"): descrever aparência por tom de pele é desnecessário e arriscado.
- **Contraste**: disco ≥ 3:1 com `surface-0` e `surface-1` nos dois temas (medido 3,68 a 4,22); contorno `ink` ≥ 3:1 com o disco (4,49). O avatar não carrega informação sozinho (nada de estado por cor), então não precisa de mais que isso. O teste recalcula esses números a partir de `design/tokens.json`, para um token novo não quebrar em silêncio.
- **Tamanho de toque**: o avatar não é alvo de toque por si; se o card for tocável, o alvo é o card (≥ 44 px).
- `prefers-reduced-motion`: sem animação no avatar.

## 5. Segurança e direito de imagem

- **Nenhum rosto imita pessoa real**: só os traços genéricos do catálogo, sorteados por semente (id do jogador). Não há "avatar do craque", nem busca de rosto por nome, nem parâmetro livre; ninguém escolhe traços de um jogador existente. Cabelo, barba e acessório são formas comuns (sem penteado ou combinação-marca, sem cor de cabelo exclusiva além das 10 da paleta). Se uma combinação passar a lembrar uma figura real, o traço sai pela tabela de retirados.
- **Nada de texto no SVG**: nem `<text>`, nem nome, nem número, nem sigla, nem marca; o acessório é liso, sem logo; a camisa é neutra ou uma cor lisa, sem listra, escudo ou patrocínio.
- **Cor fora da paleta fechada é impossível**: todas as cores vêm das tabelas fixas (pele 12, cabelo 10, constantes do desenho e sombras derivadas por tabela) ou de `opts.shirt` depois de `safeColor` (`^#[0-9a-f]{6}$`, senão fallback). Índice inválido cai em `0`; nada vindo do save vira atributo sem passar por tabela.
- **Entrada hostil**: `face` do save é texto; o decodificador valida o formato e o comprimento antes de usar; `label` é escapado; `size` é número finito entre 16 e 512 (fora disso, vira 48).

## 6. Testes para o QA e o developer

1. **Estabilidade (US-005)**: o mesmo `face` renderizado duas vezes, e em processos diferentes, dá SVG idêntico (comparar com uma fixture de 20 códigos).
2. **Codec**: `decodeFace(encodeFace(spec))` devolve `spec` para todos os índices de cada campo; comprimento sempre ≤ 32; texto inválido, vazio, versão `2`, maiúsculas, índice acima do catálogo e `null` nunca lançam e devolvem rosto válido; um código curto (campo ausente) decodifica com `0` no que falta.
3. **Catálogo que só cresce**: um arquivo-fixture (`avatar.catalog.snap`) com `COUNTS` por campo; o teste falha se algum campo diminuir; um teste de "golden" renderiza 1 rosto por índice de cada campo e compara com o SVG gravado, então mudar o desenho de um traço aparece no diff e exige revisão do `art-director`.
4. **Retirados**: tabela sem cadeia nem laço, destino dentro do catálogo, nenhum índice retirado com desenho vivo, com um caso sintético.
5. **Distribuição**: 20.000 rostos com idades 17 a 34 e `BR`; cada valor de `skin`, `shape`, `eyes`, `nose`, `mouth`, `hairStyle` (nas faixas de idade em que o peso é maior que zero) aparece pelo menos metade do esperado pelo peso (tolerância de ±30% do esperado em cada contagem); `hairStyle` 0, 11 e 12 nunca aparecem com idade ≤ 23; grisalho (7) e branco (8) nunca com idade < 30 e 33 respectivamente; louro/ruivo natural (4, 5, 6) nunca com pele ≥ 7; todos os 12 tons aparecem.
6. **Variedade num elenco de 30** (300 elencos simulados, idades 17 a 34; medidas do protótipo entre parênteses, mínimo observado): pelo menos 7 tons de pele distintos (7), pelo menos 8 estilos de cabelo (8), pelo menos 24 combinações distintas de (pele, estilo, cor) (26), e nenhum código repetido (0 repetições). O teste usa os limites 6, 7 e 24 para não ficar frágil, e as medidas acima ficam no teste como comentário.
7. **Tamanho e segurança**: nos 1.000 jogadores da US-005, cada SVG ≤ 3.200 bytes (≤ 2.400 em `size 32`) e ≤ 20 elementos (≤ 16 em 32); nenhuma das expressões proibidas da seção 4; nenhum `id` repetido (não há `id`); XML bem formado; toda cor do SVG pertence ao conjunto de cores permitido.
8. **Rótulo**: `label` com `<`, `"` e `&` sai escapado; sem `label`, o SVG tem `aria-hidden="true"`.
9. **Contraste**: disco contra `surface-0` e `surface-1` dos dois temas ≥ 3:1 e `ink` contra o disco ≥ 3:1, calculado a partir de `design/tokens.json`.
10. **Visual (uma vez, `art-director` e CEO)**: a folha `docs/art/avatares-exemplo.svg` refeita com o código final deve ser igual em estilo; conferir 32, 48 e 96 px nos dois temas.
