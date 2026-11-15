# Uniformes dos clubes (T-026)

> Direção de arte e limites para o `developer` implementar `app/src/lib/generators/kit.ts` (US-002) e `kit.test.ts`. Segue o gerador de escudos (`shield.ts`): puro, determinístico, SVG autocontido (sem variável CSS, sem filtro, sem `<text>`, sem `<script>`, sem link), mesmas funções de cor (`safeColor`, `contrastRatio`, `escapeText`, `SMALL_SIZE`). A partida animada (T-032, canvas) consome só a parte de dados (seção 3); o SVG serve aos cards e telas. Este documento não traz código de produção. Os números marcados "medido" saem dos 20 clubes de `app/src/data/clubs.serie-a.json`.

## 0. Princípios

- **Tudo por código.** Nenhuma imagem de uniforme no repositório (CLAUDE.md). Nenhum texto, número ou marca dentro do SVG do uniforme: o número da camisa é desenhado pela interface (canvas ou HTML) por cima, e a marca fictícia de cenário (US-041, ADR-0015) também, nunca embutida.
- **Nenhum uniforme imita um real** (regra absoluta do projeto). O ADR-0014 afrouxa só o escudo; para o uniforme vale a regra original, então o desenho do uniforme nunca repete o tipo de padrão que o escudo do clube usa para evocar o real (seção 1.3).
- **Estilo**: o mesmo do escudo v5 e do avatar: cor chapada, contorno `ink` (`#0b1118`) grosso, formas simples, sem degradê e sem sombra. Legível em 24, 48 e 96 px; com `size <= 32` (`SMALL_SIZE`) a versão simples tira gola e detalhes finos e engrossa as listras.
- **Entrada**: só `id`, `colors` e `crestPattern` do clube (um `ClubDef` serve). Não há campo novo em `clubs.serie-a.json`, então a T-026 não toca dados, save nem motor (cabe no tamanho P e no `/feature` sem ADR).

## 1. Modelos de camisa

### 1.1 Peças

Um uniforme completo tem **camisa, calção e meias**. No SVG do card (viewBox `0 0 64 72`): camisa em cima (corpo, mangas curtas, gola), calção e meias embaixo, vistos de frente, como peças soltas (sem corpo). Na partida animada só a camisa conta (a bolinha), e as meias e o calção servem à tela de partida e a futuras telas.

| Peça   | Regra                                                                                                                                                                                                       |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Camisa | `base` e `secondary` vêm das cores do clube (seção 1.2); padrão da tabela 1.3; gola da tabela 1.4                                                                                                           |
| Calção | cor lisa: a de maior contraste com a camisa entre `base`, `secondary` e as neutras (`#111417`, `#ffffff`), exigindo ΔE de Lab >= 30 entre a `base` da camisa e a do calção quando possível; senão, a `base` |
| Meias  | iguais à `base` do calção, com uma faixa de 1 unidade na cor da gola quando `size > 32`                                                                                                                     |

### 1.2 Cores: uniforme 1 e uniforme 2

- **Uniforme 1 (principal):** `base = colors[0]`, `secondary = colors[1]`.
- **Uniforme 2 (reserva):** `base = colors[1]`, `secondary = colors[0]` (as cores do clube trocadas). Medido: nos 20 clubes, o uniforme 2 de todos tem ΔE >= 30 contra o uniforme 1 do mesmo clube.
- **Uniforme 3 (último recurso, só para a regra de contraste da seção 2):** `base` = a mais distante do mandante entre `#ffffff`, `#111417` e `#ffd400`; `secondary` = a mais distante dessa `base` entre as outras duas; padrão `plain`. Medido: nos 380 confrontos ordenados dos 20 clubes ele nunca é necessário, mas existe para clubes futuros e para o editor de uniforme (Etapa 4), e o teste o exercita com cores sintéticas.
- Cor inválida passa por `safeColor` (cinza `#777777`), igual ao escudo; nada vindo do save vira atributo do SVG sem passar por ela.

### 1.3 Padrões (10 modelos, índice estável, o catálogo só cresce)

| Índice | `KitPattern` | Desenho (camisa, de frente)                                       | Equivalente no escudo (`crestPattern`) |
| ------ | ------------ | ----------------------------------------------------------------- | -------------------------------------- |
| 0      | `plain`      | lisa, só gola e punho em `secondary`                              | `none`                                 |
| 1      | `hoops`      | listras horizontais largas, 5 faixas                              | `hoops`                                |
| 2      | `vstripes`   | listras verticais, 5 faixas (3 em `secondary` no corpo)           | `vstripes`, `pales`                    |
| 3      | `halves`     | metades verticais (esquerda `base`, direita `secondary`)          | `split`                                |
| 4      | `band`       | faixa horizontal larga no peito                                   | `fess`                                 |
| 5      | `sash`       | faixa diagonal do ombro ao quadril (`sash` espelhado no índice 6) | `bend`, `bendMirror`                   |
| 6      | `sashMirror` | idem, para o outro lado                                           | `bend`, `bendMirror`                   |
| 7      | `chevron`    | V no peito                                                        | `chevron`                              |
| 8      | `yoke`       | ombros e parte alta em `secondary`, corpo em `base`               | `chief`                                |
| 9      | `sleeves`    | corpo `base`, mangas inteiras em `secondary`                      | (sem equivalente: nunca é excluído)    |

A coluna da direita é a **tabela de exclusão** (`KIT_PATTERN_OF_CREST`): para cada clube, o padrão do uniforme nunca é o equivalente do `crestPattern` dele (para `bend`/`bendMirror` ficam excluídos os dois `sash`; para `vstripes`/`pales`, `vstripes`). Motivo: o `crestPattern` foi escolhido para lembrar o clube real (ADR-0014); repetir esse padrão na camisa, com cores do clube, aproximaria o uniforme do real. Com isso, **nenhum clube tem uniforme com o mesmo tipo de padrão do escudo**, o que serve de proxy verificável da regra "não imita um real" (não há como o teste conhecer o uniforme real; a revisão do `art-director` cobre o resto, seção 5).

### 1.4 Gola e acabamento

`collar`: `round` (gola redonda), `v` (em V) ou `polo` (com abertura). Cor `secondary`; se `secondary` tem menos de 3:1 contra a `base`, usa a neutra (`#111417` ou `#ffffff`) de maior contraste (mesma função `onColor` do escudo). Punhos e barra seguem a gola.

### 1.5 Como o clube escolhe, sem sorteio solto

Tudo derivado de `seedFromString` (`engine/rng.ts`) sobre rótulos fixos, como em `face.ts`, e nunca de ordem de lista, data ou `Math.random`:

1. Uniforme 1: `pattern = pick(seed("${id}-kit1-pattern"), PESOS_PADRAO, exclusão)`. Pesos (soma 100): `plain` 24, `hoops` 14, `vstripes` 14, `halves` 8, `band` 10, `sash` 4, `sashMirror` 4, `chevron` 6, `yoke` 8, `sleeves` 8. O padrão excluído tem peso 0 e a escolha é feita sobre o resto (renormalizado), então a escolha continua uma função só do `id` e do `crestPattern`.
2. Uniforme 2: `seed("${id}-kit2-pattern")`, mesma tabela, com **dois** excluídos (o do escudo e o do uniforme 1), para o reserva nunca ser igual ao principal no desenho.
3. Gola: `seed("${id}-kit-collar")`, uniforme entre as três, a mesma nos dois uniformes.
4. Rótulos e pesos são constantes exportadas (`KIT_WEIGHTS`) e entram no teste de golden; mudar um peso muda o uniforme de clubes existentes e exige revisão do `art-director`.

Rivais e clubes da mesma cidade não podem ter o mesmo par (`base`, `pattern`) no uniforme 1; o teste confere nos 20 clubes e, se houver colisão, o `art-director` troca o rótulo do sorteio daquele clube (por exemplo `kit1-pattern-b`), registrado na tabela de risco.

## 2. Contraste em campo: regra de conflito, reserva e goleiro

### 2.1 Medida

Distância de cor = **ΔE76 em CIE Lab (D65)** entre dois `#rrggbb`, função `colorDistance(a, b)` exportada (a mesma que o `developer` usará em todo o gerador). Escolhida por ser simples, sem dependência e estável entre navegador e Node (só `Math.cbrt` e aritmética, sem `exp`; o motor não a usa, então não entra na restrição do ADR-0020). Limite: **ΔE >= 30** (`KIT_MIN_DISTANCE`). Medidas de apoio: branco x preto 94; azul-escuro x azul-médio 14 a 49 (conflito quando 14); `#C8102E` x `#E4002B` 13 (conflito); `#C8102E` x `#E5050F` 24 (conflito). Em 30 ficam fora vermelhos e azuis "irmãos" e entram preto x vermelho e azul x vermelho.

### 2.2 Massa de cor do uniforme

O que o olho vê em campo, por padrão: `plain`, `sleeves`, `yoke`, `chevron`, `sash`, `band` têm **massa dominante = `base`** (a `secondary` é detalhe); `hoops`, `vstripes` e `halves` têm **massa dupla** (`base` e `secondary` em área parecida). Definições:

- `mass(kit)` = `[base]` para padrão de massa única, `[base, secondary]` para massa dupla.
- **Conflito entre dois uniformes** quando (a) as `base` estão a menos de 30, **ou** (b) alguma das duas camisas é de massa dupla e todas as cores de `mass` de uma estão a menos de 30 de alguma cor de `mass` da outra. A regra (b) pega "listrado preto e branco contra listrado branco e preto"; não pega "listrado preto e branco contra liso preto" (a `base` do liso é preta e a do listrado também, então já cai em (a)).

### 2.3 Quem usa o reserva

`matchKits(home, away)` (seção 3) decide, nesta ordem:

1. O **mandante sempre usa o uniforme 1**.
2. O visitante usa o **uniforme 1** se não há conflito com o do mandante.
3. Senão usa o **uniforme 2**.
4. Se ainda há conflito, o **uniforme 3** calculado contra o mandante (nunca falha: tem sempre uma das três cores com ΔE >= 30 contra qualquer cor, e o teste confere nos 380 confrontos mais um conjunto de cores extremas).

Medido (os 20 clubes, `KIT_MIN_DISTANCE` 30): em 48 dos 380 confrontos ordenados o visitante troca para o uniforme 2; em 0 precisa do 3. Os casos mais comuns são os quatro clubes de preto e branco e os vermelhos.

A decisão é função só dos dois clubes: não depende de rodada, de sorteio nem de quem é o jogador, então a tabela de jogos, o resumo e a animação mostram o mesmo uniforme. A regra de quem troca (visitante) é a do futebol; nenhum clube troca por vontade do jogador na Etapa 1.

### 2.4 Goleiro

- Cada goleiro tem **uniforme de goleiro** próprio (camisa, calção e meias lisos), escolhido de uma paleta fechada de 6 cores: `#F2D100` (amarelo), `#F26B1D` (laranja), `#D81B7A` (magenta), `#6E45C9` (violeta), `#18A9D6` (ciano), `#B7C0C8` (cinza-claro). Sem verde (some no gramado). Mede-se contra o gramado da interface: todas passam de ΔE 58 contra `grass` (`#2fb866` noite, `#177a42` dia).
- A cor é a primeira da paleta, **começando no índice `seed("${id}-kit-gk") % 6` e seguindo em ordem circular**, que passa a regra: ΔE >= 30 contra a `base` de **todos** os uniformes de linha em campo (mandante e visitante, só as `base` de massa única e as duas cores de massa dupla), contra o gramado e, no segundo goleiro, contra o primeiro. Ordem de decisão: goleiro do mandante, depois o do visitante.
- Medido: nos 380 confrontos sobram no mínimo 4 das 6 cores para o primeiro goleiro, então a regra nunca esgota a paleta. Se um dia esgotar (cores sintéticas do editor), usa a cor da paleta com a maior distância mínima, e o teste cobre isso.
- O goleiro não usa padrão (sempre `plain`), para o jogador achá-lo de relance; a gola segue a cor de contraste da seção 1.4.
- Árbitro: não faz parte da T-026. Se a T-032 desenhar o árbitro, usa preto `#111417` com a `base` do goleiro de menor risco; ver "fica para depois".

### 2.5 Gramado

O uniforme **não muda por causa do gramado** (Palmeral e Chapecão são verdes e ficariam no verde). Em vez disso a bolinha da partida animada tem **anel de contorno** (seção 3) com contraste >= 3:1 contra o gramado; a camisa verde do Palmeral lê pelo anel e pelo número, como o escudo lê pelo contorno `ink`. Medido: dois clubes têm a `base` a menos de 30 do gramado de noite (Chapecão 7, Miragol a `secondary` 25) e quatro de dia (Palmeral 10, Fluminário `secondary` 11, Coritibom 22, Chapecão 24, Miragol `secondary` 3); nenhum deles é trocado.

## 3. API que a T-032 consome

Em `app/src/lib/generators/kit.ts`. Tudo puro; sem DOM; sem `Date`/`Math.random`. Nomes em inglês, tipos exportados.

```ts
export type KitPattern =
  | 'plain'
  | 'hoops'
  | 'vstripes'
  | 'halves'
  | 'band'
  | 'sash'
  | 'sashMirror'
  | 'chevron'
  | 'yoke'
  | 'sleeves';
export type KitCollar = 'round' | 'v' | 'polo';
export type KitSlot = 'home' | 'away' | 'third' | 'gk';

/** The part of a ClubDef the kit needs; a ClubDef fits. */
export interface KitClub {
  id: string;
  colors: readonly [string, string];
  crestPattern: CrestPattern;
}

/** A full kit: what the card SVG draws. */
export interface Kit {
  slot: KitSlot;
  base: string; // #rrggbb
  secondary: string;
  pattern: KitPattern;
  collar: KitCollar;
  shorts: string;
  socks: string;
}

/** What the animated match needs per outfield player or goalkeeper. */
export interface FieldKit {
  slot: KitSlot;
  fill: string; // dominant colour of the dot
  stripe: string | null; // second colour for double-mass patterns, else null
  ring: string; // 2 px outline, >= 3:1 against the pitch
  numberColor: string; // >= 4.5:1 against fill (and stripe, if any)
  numberPlate: string | null; // null unless no colour reaches 4.5:1 on both
}

export interface MatchKits {
  home: FieldKit;
  away: FieldKit;
  homeGk: FieldKit;
  awayGk: FieldKit;
  awaySlot: 'home' | 'away' | 'third'; // uniform 1, 2 or 3 of the visitor
}

export const KIT_MIN_DISTANCE = 30;
export const KIT_NUMBER_CONTRAST = 4.5;
export const KIT_RING_CONTRAST = 3;

export function colorDistance(a: string, b: string): number; // delta E76 (Lab, D65)
export function kitsFor(club: KitClub): { home: Kit; away: Kit }; // uniforms 1 and 2
export function kitConflict(a: Kit, b: Kit): boolean; // section 2.2
export function matchKits(
  home: KitClub,
  away: KitClub,
  options?: { pitch?: string }, // default: #2fb866 (night grass)
): MatchKits;
export function fieldKit(kit: Kit, pitch?: string): FieldKit;
export function kitSvg(
  kit: Kit,
  size?: number, // px wide, default 64
  options?: { label?: string; instance?: string },
): string;
```

Regras de cada campo de `FieldKit`:

- `fill` = `base`; `stripe` = `secondary` só nos padrões de massa dupla, senão `null`.
- `ring` = `#0b1118` (`ink`), exceto quando o contraste do `ink` contra o gramado ficar abaixo de 3:1 (nunca com os dois gramados do design system; vale para um gramado futuro escuro), caso em que é `#ffffff`.
- `numberColor` = a de maior contraste entre `secondary` (quando existe contraste), `#ffffff` e `#111417` contra `fill`, **com mínimo 4,5:1**; nos padrões de massa dupla o número cai entre as duas cores, então o mínimo vale contra as duas, e a escolha maximiza o menor dos dois contrastes.
- `numberPlate` = `null` quando a cor acima cumpre 4,5:1; senão, uma placa lisa `#ffffff` ou `#111417` atrás do número (sempre cumpre 4,5:1 contra o número em preto ou branco). Medido: nos 20 clubes e nos dois uniformes nenhum precisa de placa, mas o campo existe para cor sintética e o teste a cobre.
- Goleiro: `slot: 'gk'`, `stripe: null`, mesmas regras de `ring` e número.

`kitSvg` desenha camisa, calção e meias (viewBox `0 0 64 72`, gradiente zero). `label` opcional vira `role="img"` + `aria-label` (escapado), como no escudo; sem `label`, o SVG é decorativo (`aria-hidden`). Ids internos de `clipPath` derivam de `id` do clube, `slot` e `instance`, como no escudo, para vários uniformes na mesma página não colidirem. Faixa de `size`: finito entre 16 e 512, fora disso vira 64 (como o avatar).

Acessibilidade: o uniforme nunca é a única informação (nome do clube e escudo sempre ao lado); na partida animada, quem é quem nunca depende só da cor do uniforme (a T-032 mantém nome e número na narração e no placar).

## 4. Testes que o `developer` escreve (`app/src/lib/generators/kit.test.ts`)

Os critérios de aceite da US-002 ficam todos cobertos; os testes de propriedade rodam sobre os 20 clubes reais e sobre clubes sintéticos.

1. **Estabilidade (US-002):** `kitSvg` duas vezes para o mesmo kit dá texto idêntico, e idêntico entre uma lista de clubes embaralhada e a ordenada (a escolha depende só do `id` e do `crestPattern`); uma fixture de 20 clubes x 2 uniformes grava `{ slot, base, secondary, pattern, collar }` e o SVG, e muda só com revisão do `art-director` (golden).
2. **Regra do escudo:** em cada clube, `home.pattern` e `away.pattern` nunca estão no conjunto de padrões que a tabela 1.3 associa ao `crestPattern` dele, e `away.pattern !== home.pattern`; teste negativo com um clube sintético de `crestPattern: 'hoops'` e `id` varrido de 0 a 2.000 (nunca sai `hoops`).
3. **Cobertura da tabela de exclusão:** todo valor de `CrestPattern` tem entrada em `KIT_PATTERN_OF_CREST` (o teste falha se o escudo ganhar um padrão novo sem decisão para o uniforme).
4. **Distribuição:** com 5.000 ids sintéticos, cada padrão aparece e a frequência fica dentro de ±30% do peso esperado (como `face.test.ts`); nos 20 clubes reais aparecem pelo menos 5 padrões diferentes no uniforme 1; nenhum par de rivais ou de clubes da mesma cidade tem o mesmo (`base`, `pattern`).
5. **Distância de cor:** `colorDistance` é simétrica, zero consigo mesma e dá os valores medidos acima (branco x preto entre 93 e 95; `#C8102E` x `#E4002B` abaixo de 15); entrada inválida cai em `safeColor`, nunca em `NaN`.
6. **Uniforme 2:** em todos os clubes reais, `colorDistance(home.base, away.base) >= KIT_MIN_DISTANCE`.
7. **Reserva (US-002):** para os 380 confrontos ordenados dos 20 clubes, depois de `matchKits`: nenhum `kitConflict` entre o mandante e o visitante; `home` é sempre o uniforme 1; o visitante é o 1 quando não havia conflito, o 2 quando só o 1 conflitava; nenhum caso exige o 3 (hoje) e o teste falha com a lista se isso mudar, para o `art-director` rever. Um clube idêntico contra si mesmo e dois clubes sintéticos de cores iguais devolvem o uniforme 3, e este passa na regra.
8. **Goleiros:** em todos os 380 confrontos, `homeGk.fill` e `awayGk.fill` ficam a >= 30 de `home.fill`, `away.fill` (e de `stripe`, quando houver), do gramado de noite e do de dia e um do outro; `homeGk.fill` e `awayGk.fill` pertencem à paleta de 6; nunca verde (ΔE >= 58 contra os dois gramados). Caso sintético em que mandante e visitante usam seis cores de goleiro cercadas: ainda devolve uma cor da paleta (maior distância mínima), sem lançar.
9. **Número e anel:** para todo uniforme (os 20 x 2, o 3 e os goleiros), `contrastRatio(numberColor, fill) >= 4.5` e, havendo `stripe`, também contra ela, ou `numberPlate !== null` e o número tem >= 4.5:1 contra a placa; `contrastRatio(ring, pitch) >= 3` para os dois gramados. Cores sintéticas extremas (preto, branco, cinza médio `#808080`, amarelo-floodlight) cobrem as ramificações.
10. **Determinismo e pureza:** sem `Math.random` nem `Date` (lint já bloqueia no motor; aqui o teste chama 1.000 vezes e compara); `matchKits(a, b)` não muda `a` nem `b` (objetos congelados com `Object.freeze`).
11. **SVG seguro (US-002):** nos 20 clubes x (uniformes 1, 2, 3 e goleiro) x tamanhos 24, 48 e 96: XML bem formado; nenhuma das expressões proibidas (`<script`, `<foreignObject`, `<image`, `<text`, `href`, `xlink`, `javascript:`, ` on\w+=`, `url(http`, `@import`, `<style`); toda cor do SVG pertence ao conjunto permitido (`base`, `secondary`, `shorts`, `socks`, `ink`, as duas neutras); `size <= 32` com menos elementos que `size 64`; <= 3.500 bytes (<= 2.200 em `size 32`); `label` com `<`, `&`, `"` e `'` sai escapado; ids únicos quando dois uniformes do mesmo clube e `slot` estão na mesma página com `instance` diferente. Entrada hostil: `colors` com `url(javascript:...)`, `#xyz`, vazio e `null` caem em `#777777` sem lançar.
12. **Nenhum uniforme reproduz um real (suíte de bloqueio):** (a) o teste 2 (padrão do uniforme nunca igual ao do escudo); (b) nenhum texto, número, sigla ou marca no SVG (o teste 11 já bloqueia `<text`; e as cores `base`/`secondary` são só as do clube); (c) uma tabela gravada de **assinaturas proibidas** em `app/src/lib/generators/kit.forbidden.json`, com pares (`pattern`, cor da `base`, cor da `secondary`) que o `art-director` marca como idênticos ao padrão de um clube real, sem nome (só o código da assinatura, para o repositório nunca citar o clube); o teste falha se algum uniforme dos 20 clubes bater com uma assinatura. A tabela começa vazia e é preenchida pela revisão do `art-director` (seção 5, decisão 3), e um teste garante que o arquivo é lido e que uma assinatura sintética de teste faz o caso falhar (para a trava não ficar morta).
13. **Retrocompatibilidade do catálogo:** o conjunto de `KitPattern` só cresce (fixture `kit.catalog.snap` com a ordem e a contagem); mudar um peso ou um rótulo de sorteio quebra o golden do teste 1.

O teste de carga visual (as folhas 20 clubes x 3 tamanhos) fica com o `art-director`: um script `scripts/kit-sheet.mjs` (como `avatar-sheet.mjs`) gera a folha em `docs/art/uniformes-exemplo.svg` com o código de produção, para o CEO ver.

## 5. O que fica para depois e decisões do CEO

### 5.1 Fica para depois

- **Uniforme nas telas do elenco e do jogador:** a camisa do card do jogador com a cor do clube já existe como `renderFace(..., { shirt })`; mostrar o uniforme completo (com número) no elenco, na escalação e no perfil é tarefa de interface, depois da T-029 e do `ux-designer`. A T-026 só entrega o gerador.
- **Número e nome nas costas:** só na interface, por cima, nunca no SVG do uniforme.
- **Marca fictícia de cenário na camisa** (US-041, ADR-0015): sobreposição por código, a partir de `config/prancheta.config.ts` ou de uma lista fictícia; fora da T-026.
- **Editor de uniforme** (recompensa de apoio, Etapa 6; editor local, Etapa 4): o catálogo de padrões e o campo `slot: 'third'` já deixam o caminho aberto; mudar o uniforme de um clube vira dado de save e exige ADR.
- **Árbitro** e **uniforme de treino**: só quando a T-032 ou o `ux-designer` precisarem.
- **Terceiro uniforme por clube nos dados** (campo no `clubs.serie-a.json`): fica para a Etapa 4, junto com o editor.
- **Clubes sul-americanos** (Etapa 2): as mesmas regras; só revisar a tabela de assinaturas proibidas.

### 5.2 Decisões do CEO (com a recomendação do `art-director`)

**Decididas pelo CEO em 2026-11-15:** (1) opção A, o padrão vem do `id` e exclui o padrão do escudo; (2) limite de ΔE 30, o visitante troca; (3) a revisão humana contra uniformes reais fica como pendência do CEO, junto com a revisão jurídica dos escudos, antes do lançamento; (4) goleiro com cor própria e estável por clube; (5) clubes verdes mantêm o uniforme, com anel e número. O texto abaixo guarda as opções e a recomendação que levaram à decisão.

1. **Padrão do uniforme: derivado do clube (recomendado) ou campo fixo em `clubs.serie-a.json`?**
   - A: derivado por semente do `id`, excluindo o padrão do escudo (esta proposta). Sem mudança de dados, cabe no P, estável por clube, trocar um uniforme é mudar um rótulo.
   - B: campo `kitPattern` por clube, escolhido à mão como os `crest*` (ADR-0014), com ADR e mudança de `ClubDef`/validador. Controle total, mais trabalho (M, toca `engine/clubs.ts`).
   - **Recomendo A**: a regra "nunca igual ao escudo" já é uma barreira verificável, e o `art-director` revisa a folha dos 20 clubes antes do merge; se algum clube ficar feio ou parecido com o real, vira exceção pontual no rótulo do sorteio, sem campo novo.
2. **Limite de confusão de cor (ΔE >= 30) e quem troca (o visitante).** O limite 30 é um pouco mais exigente que o "bem distinto" (cerca de 25) e faz 48 de 380 confrontos usarem o uniforme 2 (cerca de 13%). **Recomendo 30**; se o CEO achar que o reserva aparece demais, 25 deixa 42 de 380; abaixo disso os dois vermelhos parecidos (ΔE 13 a 24) já não são separados.
3. **Revisão contra uniformes reais antes do lançamento.** A regra absoluta de "nenhum uniforme imita um real" precisa de um olhar humano: eu (`art-director`) comparo a folha gerada com o que conheço do uniforme típico de cada clube que inspirou o trocadilho, preencho as assinaturas proibidas (teste 12c) e recuo o que ficar parecido, no mesmo padrão da tabela de risco do ADR-0014. **Recomendo** que isso valha como pendência do CEO junto com a revisão jurídica dos escudos (`docs/status.md`): o jurídico olha as duas folhas de uma vez. Cores iguais às do real são aceitas (as cores do clube já são as do trocadilho), padrão e composição não.
4. **Goleiro em cor própria e fixa por clube (recomendado) ou sempre a cor "do goleiro" mais distante do jogo?** A proposta dá a cada clube uma cor preferida (pela semente) e só a troca se conflitar; assim o jogador reconhece o goleiro do clube, e a cor muda pouco. Alternativa: sempre a cor mais distante; mais simples e mais legível, mas o goleiro muda de cor a cada jogo sem motivo. **Recomendo a proposta.**
5. **Gramado verde x clubes verdes (Palmeral, Chapecão, Miragol, Coritibom):** mantenho o uniforme do clube e resolvo com anel e número (seção 2.5), em vez de trocar o uniforme ou mudar o tom do gramado. **Recomendo** assim; o `ux-designer` pode ajustar o tom do gramado da partida na T-032 sem refazer o gerador (o `pitch` é parâmetro).
6. **Prioridade:** a T-026 (P) vem antes da T-032, como o CEO decidiu. O `developer` implementa a seção 3 e a 4; o `art-director` fecha a folha de exemplo e a tabela de risco antes do merge, em branch própria de `docs/art/`.
