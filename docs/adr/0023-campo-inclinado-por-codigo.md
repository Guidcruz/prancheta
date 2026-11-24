# ADR-0023: Campo da partida inclinado por código, só com a bola em movimento

- **Status:** aceito (CEO, 2026-11-24). Em 2026-11-23 o CEO escolheu a saída A, o campo inclinado por código, sem fundo ilustrado. Em 2026-11-24, depois de ver os protótipos v1 a v5, escolheu o modo "só a bola" e fechou as pendências, todas como recomendado (`docs/design/telas/partida-campo-v2.md`, §15 e §16). A forma técnica é do `architect`.
- **Data:** 2026-11-23 (proposta); 2026-11-24 (aceito, com as decisões finais)
- **Decisores:** CEO (decidiu), ux-designer (estudo, protótipos e spec: `docs/design/telas/partida-campo-v2.md`, branch `docs/campinho-proposta`, commit 2a8a71b), game-designer (restrições de regra: `docs/design/campo-lances.md`, D1 a D7, na mesma branch), architect (redigiu)
- **Substitui em parte:** `docs/PROJETO.md` › "Animações e engajamento saudável" › "Tela da partida": a linha 525 ("Campo 2D visto de cima, jogadores como bolinhas nas cores do uniforme, mostrando só os lances importantes") e o "com escudo" da linha 528 (a comemoração do gol vira a etiqueta de gol, sem escudo; o escudo continua na linha da narração).
- **Complementa:** ADR-0015 (as placas mostram só marcas fictícias, com o patrocínio real desligado) e a §4.7 de `docs/02-architecture.md` (o chunk do campo e as metas de desempenho da T-085).

## Contexto

A T-085 entregou o campo 2D da "Animada completa" visto de cima, como manda o `docs/PROJETO.md`, com os 22 jogadores como bolinhas nas cores do uniforme em movimento decorativo. Para o campo v2 (rastro da bola, etiqueta do lance e cunha do ataque), o CEO mandou prints de um app real de lance a lance como referência. O `ux-designer` estudou a vista em perspectiva com estádio, com três saídas e o custo de cada uma, e depois fez cinco protótipos: o campo inclinado com os 22 (v1 e v2), três modos de movimento (v3) e os rastros por tipo (v4 e v5). O CEO escolheu:

- o campo **inclinado por código**: arquibancadas, mureta e placas de marcas fictícias desenhadas no canvas, sem fundo ilustrado e sem download extra;
- o modo **"só a bola"**: nos minutos sem lance, só a bola se move, com os rastros por tipo, a cunha do ataque e a camisa do time com a bola sobre ela. Os discos só aparecem nos lances do motor: o jogador do evento, o goleiro e, no gol, o artilheiro.

O "visto de cima" e os "jogadores como bolinhas" são decisões do documento de projeto, e mudá-las é ADR. Pesam no desenho:

1. **As restrições de regra (D7 do `campo-lances.md`):**
   - os lados fixos: o mandante à esquerda, atacando para a direita, o jogo todo;
   - a posição como pista do time que não depende da cor, legível também no lado de longe;
   - nenhum movimento de câmera que diferencie gol e chance;
   - as metas de desempenho da T-085.

   A D1-A ("só tem nome quem está num evento do motor") e a D6-A (motor e save intactos) também continuam.

2. **As metas da T-085** (`docs/design/telas/partida.md`, "Desempenho no celular", e §4.7 da arquitetura):
   - quadros p95 ≤ 34 ms e desenho mediano ≤ 6 ms, com CPU 4× (390×844, densidade limitada a 2);
   - nenhuma alocação por quadro e nenhum `requestAnimationFrame` parado;
   - o chunk do campo com no máximo 20.000 bytes gzip.

   Hoje, medido: chunk de 7,1 KB gzip e desenho mediano de 0,5 ms.

3. **A tela não muda de grade.** O campo continua sendo o maior retângulo de 1,5:1 entre o placar e a narração: 360 × 240 a 360px, a conta `100dvh − 442px` e 4 linhas de narração a 360×740. O estádio tem de caber dentro desse retângulo, tirando altura do gramado.
4. **O canvas 2D só faz transformações afins.** Um retângulo não vira trapézio por `setTransform`, então a perspectiva tem de ser uma projeção feita à mão.

## Opções consideradas

**A vista:**

| Opção                                                                                                                                                                                     | Prós                                                                                                                                                                                                   | Contras                                                                                                                                                                                                                                                                                                     |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: manter a vista de cima (saída C da proposta)                                                                                                                                           | nenhuma mudança de download, desempenho, geometria ou testes; a melhor legibilidade a 360px (gramado de 240px, discos de 18px em todo o campo, marca do visitante de 6px)                              | perde a cara de estádio que o CEO quer; as placas não cabem (na faixa de grama de 3 m, cerca de 10px a 360px, as letras teriam uns 6px)                                                                                                                                                                     |
| B: inclinar o campo por código (saída A da proposta): uma projeção feita à mão leva o desenho em metros à tela; arquibancadas, mureta e placas desenhadas uma vez num canvas fora da tela | nenhuma imagem e nenhum download fora do chunk; custo de quadro pequeno; a cena continua em metros; as etiquetas cabem sobre o estádio; as placas ganham lugar; tudo segue os tokens e muda com o tema | o gramado cai de cerca de 240px para cerca de 149px de altura a 360px; o lado de longe perde mais da metade da resolução em profundidade (3,2 px/m perto, cerca de 1,4 longe); `geometry.ts` e os testes dela mudam, e também os E2E que leem pixels do canvas                                              |
| C: fundo ilustrado (saída B da proposta): arquibancada, céu e refletores numa imagem gerada no ComfyUI da máquina do CEO, com o gramado e o resto por código, na projeção da opção B      | a arquibancada com mais detalhe                                                                                                                                                                        | tudo o que a B custa, mais: de 75 a 360 KB a mais no precache, que todos baixam (também quem só joga "Só lances principais"); decodificação de dezenas de ms com CPU 4×; cores fora do `npm run tokens`; geração e revisão do `art-director` a cada ajuste de enquadramento; a leitura do lance não melhora |

Dentro da opção B ficaram descartadas a perspectiva por CSS (`transform: perspective() rotateX()` no canvas), que achata os discos e a marca do visitante, desfoca o lado de perto e deixa o código sem saber onde cada ponto caiu, e uma biblioteca de desenho 3D ou WebGL, que custaria dezenas de KB e uma dependência para desenhar um trapézio e alguns círculos.

**O que se move no campo** (protótipos v2 e v3):

| Opção                                                                                                      | Prós                                                                                                                                                                         | Contras                                                                                                                                               |
| ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: os 22 discos, com movimento por função (v2)                                                             | a formação sempre à vista                                                                                                                                                    | o CEO achou travado e com pouca variação; a 360px, com a perspectiva, os discos de longe se embolam                                                   |
| B: os 22 em movimento contínuo (modo 3 do v3)                                                              | mais fluido                                                                                                                                                                  | os discos se embolam perto da bola; cada disco sem nome é um fato inventado na tela; de 0,6 a 1 ms por quadro e de 4 a 4,5 KB a mais                  |
| C: só os envolvidos (modo 2 do v3): de 3 a 5 discos que aparecem e somem                                   | menos poluição                                                                                                                                                               | tira a noção de quem é quem e não ganha da D                                                                                                          |
| D: só a bola (modo 1 do v3): a bola sempre à vista, com rastros por tipo; os discos só nos lances do motor | o que a referência faz; o campo fica fluido e legível a 360px; nada sem nome ganha rosto (segue a D1-A à risca); menos discos por quadro, o que compensa o custo dos rastros | a formação deixa de aparecer; a bola precisa de um planejador próprio (passo a passo, sem tarefa longa) para nunca parar e parecer um jogo de verdade |

## Decisão

**Vista: opção B. Movimento: opção D.**

O campo da partida passa a ser **inclinado por código**: a linha lateral de baixo fica perto de quem olha e a de cima longe, com arquibancadas, mureta e três filas de placas de marcas fictícias, tudo desenhado no canvas. Nele, **só a bola** se move o tempo todo. Vamos usar uma projeção feita à mão porque ela dá a vista que o CEO escolheu sem imagem, sem dependência e sem sair das metas da T-085. Vamos mostrar só a bola porque foi o modo que o CEO escolheu nos protótipos e porque é o único em que tudo o que tem rosto é fato do motor.

1. **A caixa do campo não muda.** O canvas continua sendo o maior retângulo de 1,5:1 que cabe na caixa (decisão 4 do CEO em 2026-11-24), com a mesma conta de altura da tela. A arquibancada de longe e a mureta ocupam o alto (cerca de 91px a 360px), e o desenho do gramado (111 × 74 m: o campo de jogo e a faixa de grama) vira um trapézio simétrico embaixo delas.
2. **A vista em três números.** A constante `PITCH_VIEW` em `app/src/ui/match/pitch/motion.ts` guarda:
   - `farScale` 0,68: a borda de longe tem 68% da largura da de perto;
   - `grassShare` 0,62: a parte da altura da caixa que fica com o gramado;
   - `boardHeight` 12: a altura das placas de longe, em px CSS a 360px de largura, proporcional à largura.

   O `developer` e o `ux-designer` podem ajustar os três no aparelho sem ADR, desde que os mínimos do item 5 e as metas de desempenho continuem.

3. **A projeção.** É uma perspectiva verdadeira: uma homografia com a fórmula do §3 da spec, cujos coeficientes são calculados uma vez por tamanho. Retas da cena continuam retas na tela, então linhas do campo, rastros retos, a cunha e a base das placas se desenham projetando só os vértices. Os círculos viram polilinhas de 48 pontos, desenhadas uma vez no fundo. As verticais continuam verticais (traves, placas, a altura da bola no ar): um ponto no ar é o ponto do chão projetado e subido `z × k` px. O trapézio é simétrico, então os dois gols têm o mesmo tamanho e nenhum lado é favorecido pelo desenho.
4. **A câmera é fixa.** Sem movimento de câmera, sem zoom e sem tremor, nem na pausa dramática: a câmera lenta continua sendo só de tempo. O mandante fica à esquerda, atacando para a direita, o jogo todo. Nada no fundo se mexe: arquibancadas, refletores e placas são desenho parado, em qualquer modo.
5. **Tamanhos, com mínimos.**
   - **Disco** (só os do lance): raio `max(2,75 × k, 7px CSS)`. O anel de 2px CSS e a marca do visitante, com um terço do diâmetro, continuam.
   - **Bola:** raio `max(1,25 × k, 4px CSS)`. No ar, cresce até 1,45 vez.
   - **Rastros e fios:** a espessura em px CSS não muda com a profundidade.
6. **Modo "só a bola".**
   - **Minutos sem lance:** a bola, os rastros, a cunha do ataque e a camisa do time com a bola sobre ela, sem número e sem nome.
   - **Lances do motor:** os discos de quem está no evento (o finalizador ou cobrador e o goleiro que defende, o expulso, e no gol o artilheiro e o goleiro), com a etiqueta no jogador certo. A âncora vem do `PlayerId` do evento, e o goleiro do dono da vaga naquele minuto.
   - **Entrada e saída:** os discos entram e saem com opacidade; os 22 nunca aparecem juntos.
   - **Movimento da bola:** passa a vir de um planejador decorativo (`app/src/ui/match/pitch/plan.ts`, PR C). Ele monta um passo de cada vez, no `onreveal` do passo anterior, a partir do fim desse passo e da semente da tela, com rótulos próprios de sorteio. O plano nunca é montado de uma vez para a partida inteira, e o começo de um gol e o de uma chance continuam iguais até o desfecho.
   - **O que o planejador lê** (`campo-lances.md`, §10, do `game-designer`): só a semente, o dono da bola, o estado da bola no fim do passo anterior e o ponto do lance; o desfecho, só no passo do desfecho. Nunca lê o placar, as forças dos times nem os eventos futuros, e os pesos das ações são os mesmos para os dois lados. O dono de cada passo vem da cota de posse da D4-C, ponderada pelo tempo de todos os passos da cota, para a parte do tempo com a bola bater com a posse da súmula. Num minuto sem lance a bola fica entre 10 e 95 m (nunca a menos de 10 m de uma linha de gol, o cruzamento inclusive): o campo não mostra quase-chance que o motor não sorteou. Isso é contrato da interface `plan.ts` (a assinatura não recebe placar nem forças), não do motor.
7. **Ordem de desenho.** A cada quadro:
   1. o fundo (arquibancadas, mureta, placas, gramado, marcações e traves), copiado do canvas fora da tela;
   2. a cunha;
   3. os rastros;
   4. os discos do lance, do fundo para a frente;
   5. os fios das etiquetas;
   6. a sombra da bola;
   7. a bola.

   Nada disso aloca: a ordem dos poucos discos, o anel de 4 rastros e o plano do passo ficam em arrays de tamanho fixo.

8. **As placas: três filas, só com cores, no canvas do fundo** (decisões 2, 3 e 9 do CEO):
   - **Filas:** uma atrás da linha lateral de longe e uma atrás de cada gol, de pé sobre a linha de fundo projetada (paralelogramos com os lados verticais). Nenhuma fica na faixa de grama, e nenhuma cobre o gramado, as traves, a rede ou a bola.
   - **Cores:** cada placa é uma marca fictícia de `brandForSlot('pitch-boards', ...)` (ADR-0015), desenhada só com as duas cores da marca. Não há texto (o canvas continua sem texto), rótulo de publicidade, link nem contagem.
   - **Lista de marcas:** a lista de marcas fictícias da T-040 é antecipada para o PR A e passa pelo CEO. Até ela existir, as placas usam pares de tokens (`ink`/`surface-0`, `floodlight`/`on-floodlight`, `surface-1`/`ink`, `grass`/`on-grass`).
9. **Arquibancada no tema dia: segue o tema** (decisão 1 do CEO), sem token novo. De dia o estádio fica claro, com os refletores apagados (em `line`). À noite, que é o tema padrão, os refletores ficam acesos em `floodlight`, com o halo no token `beam`, que passa a valer também no jogo (proposta 45, aprovada). O fundo e o gradiente da cunha são redesenhados uma vez quando o `data-theme` muda, pelo mecanismo que já existe.
10. **Etiquetas fora do canvas.** A etiqueta do lance, a etiqueta de gol (que substitui a GoalCelebration, proposta 47) e a camisa sobre a bola (proposta 48) são DOM `aria-hidden` sobre o canvas. Cada uma sai do jogador ou da bola por uma ponta e um fio desenhado no canvas. A posição vem de `tagPlacement`, uma função pura de `geometry.ts`: nunca cobre um gol e fica sempre inteira na caixa. Ela é aplicada como `transform`, só quando muda mais de 0,5px, e é a única escrita no DOM por quadro.
11. **Nada muda no motor nem no save** (D6-A). `app/src/engine/`, `ENGINE_VERSION`, os goldens do motor, `SAVE_SCHEMA_VERSION`, as migrações e as fixtures do save ficam como estão. A projeção mora em `geometry.ts` e no `MatchPitch`. A cena (`scene.ts`, `plan.ts`) continua em metros, pura e só da interface. A correção D5-A, que põe no gol o jogador de linha de maior `physical` quando o goleiro sai sem troca, faz a coreografia seguir o motor sem mudar o motor.
12. **Nada de dependência nova e nenhuma imagem.** O campo continua em canvas 2D: a dúvida "PixiJS ou canvas" do `docs/PROJETO.md` continua respondida com canvas. Nenhum arquivo novo entra no precache além do que o chunk do campo já leva.
13. **Quatro PRs, depois deste ADR, que vai em PR próprio** (decisão 5 do CEO; §1 da spec):
    - **A (M):** projeção, fundo, placas, modo "só a bola" sobre a coreografia de hoje e D5-A.
    - **B (M):** `PitchTag`, etiqueta de gol no lugar da GoalCelebration e testes de âncora.
    - **C (M):** planejador, rastros por tipo, bola no ar com sombra (`pitch-shadow`) e cunha (`pitch-wedge`).
    - **D (P):** etiqueta em espera e assistência.

    Se o C passar de M ao ser quebrado, a cunha sai dele para um PR P próprio.

**Contrato (nomes finais do `developer`):**

```ts
// app/src/ui/match/pitch/motion.ts
export const PITCH_VIEW = { farScale: 0.68, grassShare: 0.62, boardHeight: 12 } as const;

// app/src/ui/match/pitch/geometry.ts
export interface PitchGeometry {
  // ...the fields of today (sizes, the ball's limits in the canvas)...
  /** Canvas pixels per metre at the near edge of the drawing. */
  readonly s0: number;
  /** Canvas y of the far edge of the drawing (the stand and the wall are above it). */
  readonly yFar: number;
  readonly farScale: number;
  /** Canvas y of the top of the far boards. */
  readonly boardTop: number;
  /** The two goals on screen (posts, bar and net, plus a margin), for the tags: x0, y0, x1, y1 each. */
  readonly goalBoxes: Float64Array;
}
/** Writes the screen x, y and the pixels per metre k of the scene point (x, y) in metres into out[0..2]. No allocation. */
export function project(g: PitchGeometry, x: number, y: number, out: Float64Array): void;
/** Where a tag of w × h goes for a disc (or the ball) at px, py with radius r: never over a goal, whole in the box. No allocation. */
export function tagPlacement(
  g: PitchGeometry,
  px: number,
  py: number,
  r: number,
  w: number,
  h: number,
  out: Float64Array,
): void;
// clampBall(value, low, high) stays as it is, applied to the ball's centre in pixels after the projection (and the height).
```

## Consequências

- **Legibilidade a 360px.**
  - **Perdas:** o gramado cai de cerca de 240px para cerca de 149px de altura (o estádio de longe fica com 91px), e a resolução em profundidade cai de 3,2 px/m para cerca de 1,4 no lado de longe. Pela escala, um disco de longe teria 12px; com o mínimo de 7px de raio, os discos do lance ficam entre 14 e 18px, e a marca do visitante com cerca de 5 a 6px. A bola fica com 8px (até cerca de 11,6px no alto de um arco).
  - **O que compensa:** como só aparecem de 1 a 3 discos por vez, eles não se embolam. A posição continua sendo a pista do time que não depende da cor: o lado do ataque, a direção da cunha e a camisa sobre a bola.
  - **Etiqueta:** cabe sobre o disco mais ao fundo (precisa de 60px acima dele).
  - **Pior caso:** a caixa de 297 × 198px a 360×640, com a etiqueta em uma linha.
- **Geometria.**
  - `geometry.ts` ganha a projeção, os mínimos em px, o topo das placas, as caixas dos gols na tela e `tagPlacement`. `clampBall` continua e passa a ser aplicada depois da projeção.
  - O `MatchPitch` desenha o fundo uma vez por tamanho e tema, por pontos projetados. A cada quadro, projeta a bola, os rastros, a cunha e os poucos discos do lance.
  - `geometry.test.ts` é reescrito com os critérios do §13 da spec:
    - os quatro cantos do desenho no lugar certo, em quatro tamanhos;
    - a profundidade monótona e retas que continuam retas;
    - o disco com raio ≥ 7px CSS e a bola ≥ 4px CSS;
    - `project` e `tagPlacement` sem alocação;
    - nenhum vértice de placa dentro do trapézio;
    - a etiqueta inteira na caixa e fora dos gols.
  - `scene.test.ts` ganha a D5-A (PR A) e, no PR C, os testes do planejador: determinismo, continuidade, distribuição e "nada antecipa o desfecho".
- **Os E2E que medem o campo** (`tests/e2e/pitch.spec.ts`):
  - **Tamanho** (item 1: caixa de 360 × 240 a 360×740, canvas de 1,5:1, até 200px a 360×640, 4 linhas de narração): continua igual, porque a caixa não muda.
  - **Pixels:** o E2E do tema (item 11) e o da primeira partida offline (§4.7) leem hoje o pixel (2, 2), que passa a ser arquibancada. Passam a ler o pixel do meio da borda de baixo do canvas, que deve estar em `--pitch`, e o do canto de cima à esquerda, que deve estar em `--surface-0`, nos dois temas.
  - **Comparação de pixels:** os E2E que comparam todos os pixels (canvas parado, pausa, página escondida) não mudam.
  - **Novos:** os das etiquetas e da camisa sobre a bola (PR B), e o de nenhuma tarefa longa (> 50 ms) na partida inteira, com a troca de tema no meio (`PerformanceObserver` de `longtask`).
  - **Comemoração:** o E2E da comemoração (item 8) passa a ser o da etiqueta de gol no PR B.
- **Desempenho** (estimativas do §12 da spec):
  - **Chunk do campo:** sai de 7,1 KB para de 15,5 a 16,5 KB gzip no fim dos quatro PRs: +3 KB no A, +2 no B, +3 a 4 no C e +0,3 no D. Fica abaixo do teto de 20.000 bytes, e nenhuma imagem entra no precache.
  - **Desenho:** a mediana vai de 0,5 ms para cerca de 1 ms por quadro, contra a meta de 6 ms. O rastro em arco chega a cerca de 100 projeções no pior quadro.
  - **Intervalo entre quadros (p95):** nenhuma mudança esperada (hoje 16,8 ms, meta de 34 ms).
  - **Redesenho do fundo** (tamanho ou tema): de 5 a 15 ms com CPU 4×; meta de 30 ms, sem nunca virar tarefa longa.
  - **Planejamento:** cerca de 0,1 ms por passo, no `onreveal`.
  - **Testes:** as metas e os testes que as medem continuam, ou seja, o E2E de quadros (no PR A e de novo no C) e o `tests/regression/match-chunks.test.ts`. Se uma meta passar, volta ao `architect`, antes de qualquer corte de desenho.
- **Movimento reduzido.**
  - O campo continua parado, com um quadro por passo que tem linha na narração e nenhum `requestAnimationFrame` entre os lances.
  - **No quadro:**
    - a bola no ponto de chegada do passo;
    - os rastros daquele passo inteiros e parados;
    - a cunha do dono;
    - os discos do lance nas **posições do fim do passo**, e não mais nas da formação, que deixariam o finalizador longe da bola;
    - as etiquetas sem transição, e sem a camisa sobre a bola.
  - A perspectiva é desenho parado, e a câmera nunca se move.
- **Deitado e desktop.** A mesma geometria, em proporção: deitado (844×390), caixa de cerca de 397 × 265px na coluna da esquerda, com placas de longe de 13px; desktop (1280×800), cerca de 600 × 400px, com placas de 20px. As etiquetas seguem o jogador e ficam presas na caixa em qualquer tamanho.
- **Tema dia e tema noite.** Ver o item 9 da decisão.
  - **Noite:** estádio escuro com refletores acesos.
  - **Dia:** estádio claro com refletores apagados. Perde a cara de noite, como o CEO aceitou.
  - **Cunha:** segue o `pitch-wedge` (sombra à noite, luz de dia).
  - **Sombra da bola:** usa o token novo `pitch-shadow`, escuro nos dois temas (proposta 49, aprovada).
- **Positivo:**
  - a vista e o movimento que o CEO escolheu, sem imagem, sem download fora do chunk e sem dependência;
  - nada sem nome ganha rosto;
  - as placas ganham lugar;
  - motor e save intactos.
- **Negativo:**
  - menos gramado e menos resolução no lado de longe;
  - a formação deixa de aparecer no campo;
  - a geometria, o planejador e os testes ficam mais complexos;
  - o tema dia perde o "estádio à noite".
- **Pendências:**
  - `developer`: os PRs A a D, na ordem.
  - `content-writer`: o lote da lista de marcas fictícias, para o PR A, com aprovação do CEO, e os `match.tag.*`, para o PR B.
  - `ux-designer`, na implementação de cada parte:
    - `docs/design/telas/partida.md`: "Desenho", "Tamanhos", "Coreografia", "Comemoração", "Placas", "Movimento", "Marcas do cenário" e "Medidas para o E2E";
    - `design-system.md`: "Campo da partida", na proposta 46;
    - `componentes.md`: as propostas 45 a 49.
  - `product-manager`: na US-020 de `docs/01-requirements.md`, "campo visto de cima" passa a "campo inclinado, só com a bola em movimento".
  - `qa-engineer`: a linha da US-020 em `docs/03-test-plan.md`.
  - `architect`: a §4.7 e a T-040 de `docs/02-architecture.md` já estão ajustadas neste PR.

## Conformidade

- **Motor e save:** `app/src/engine/`, `app/src/lib/save/` e `app/src/params/` não mudam nos PRs A a D; mudança neles nesses PRs é BLOCKER na revisão. `ENGINE_VERSION` e `SAVE_SCHEMA_VERSION` ficam iguais.
- **Projeção:** toda posição desenhada no campo passa por `project` de `geometry.ts`. São BLOCKER:
  - conta de perspectiva fora de `geometry.ts`;
  - `transform` 3D de CSS no canvas;
  - imagem de fundo;
  - dependência nova de desenho.
- **Canvas:** sem texto. As placas mostram só as cores do que `brandForSlot` devolve, da lista de marcas fictícias (ADR-0015), ou, até ela existir, os pares de tokens. São BLOCKER:
  - marca escrita direto no desenho;
  - texto no canvas;
  - rótulo de publicidade;
  - link.
- **Discos:** só aparecem nos passos com evento do motor, e cada disco com etiqueta é o do `PlayerId` do evento (testes de âncora do PR B).
- **Movimento:**
  - nenhuma alocação por quadro, nenhum movimento de câmera e nenhuma animação no fundo;
  - o planejador monta um passo de cada vez e nunca a partida inteira, e a entrada dele não tem placar, forças nem eventos futuros (o desfecho só no passo do desfecho); um teste confere a bola entre 10 e 95 m nos minutos sem lance e a parte do tempo com a bola perto da posse da súmula (p90 até 3 pontos, p99 até 4,5);
  - o começo de um gol e o de uma chance são iguais quadro a quadro (o teste dos 11 pontos).
- **Testes no `test:all` e no job `e2e`:**
  - os de geometria e de âncora;
  - o E2E de quadros (p95 ≤ 34 ms, mediana de desenho ≤ 6 ms);
  - o de nenhuma tarefa longa;
  - o dos pixels (`--pitch` embaixo, `--surface-0` no canto de cima, nos dois temas);
  - o `match-chunks.test.ts` (≤ 20.000 bytes gzip, nenhuma imagem nova).
