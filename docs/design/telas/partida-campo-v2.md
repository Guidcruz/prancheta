# Partida: campo v2 (campo inclinado, só a bola, rastros, etiquetas e cunha)

**Estado:** decidido pelo CEO em 2026-11-23 e 2026-11-24 (§15), depois de cinco protótipos. Sem código de produção ainda; a implementação espera o ADR do campo inclinado (o "visto de cima" do `docs/PROJETO.md`), que o `architect` escreve em outra branch. **Parte:** o visual e o movimento decorativo da "Animada completa". A regra de jogo e a honestidade dos dados (quem ganha nome, de onde vêm a posse e a direção) são do `game-designer`, em [../campo-lances.md](../campo-lances.md); este arquivo segue as recomendações de lá (D1-A, D3-B, D4-C, D5-A, D6-A, D7), adapta a D2-B ao modo "só a bola" (§6, pendência 8) e aponta onde diverge. **Base:** [partida.md](partida.md) ("Campo 2D (T-085)", "Movimento", "Acessibilidade", "Desempenho no celular"), [../design-system.md](../design-system.md) ("Campo da partida"), [../../art/uniformes.md](../../art/uniformes.md) e a §4.7 de [../../02-architecture.md](../../02-architecture.md). **Referência:** prints de um app real de lance a lance, só pela mecânica. Nada do visual, dos escudos, dos nomes ou das marcas daquele app entra no projeto, e nenhuma imagem dele está no repositório.

**Em uma frase:** o campo da "Animada completa" passa a ser visto de lado e de cima, inclinado por código, com arquibancadas e placas fictícias em volta; nele, **só a bola** se move o tempo todo, deixando rastros que mostram a jogada (rasteiro, condução, tabela, por cima, cruzamento, chute), com uma cunha que aponta o ataque e a camisa do time com a bola; os jogadores só aparecem nos lances do motor, e a etiqueta (do lance e de gol) sai do jogador certo.

## 1. Resumo e divisão em PRs

| Item                            | No Prancheta                                                                                                                              | PR  |
| ------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | --- |
| Campo em perspectiva            | **Campo inclinado por código** (§3), com arquibancadas, mureta e três filas de placas desenhadas uma vez num canvas fora da tela (§4)     | A   |
| Modo "só a bola"                | A bola sempre à vista; os discos só nos lances do motor: o jogador do evento, o goleiro e, no gol, o artilheiro (§5)                      | A   |
| Goleiro que sai sem troca       | A correção D5-A do `campo-lances.md` (§10)                                                                                                | A   |
| Etiqueta do lance e de gol      | Pílula fora do canvas, saindo do jogador por uma ponta e um fio, com a camisa e o número, o tipo e o nome; no gol, a etiqueta de gol (§9) | B   |
| Camisa sobre a bola             | Nos minutos sem lance, só a camisa do time com a bola, sem número nem nome (§9)                                                           | B   |
| Âncora no jogador certo         | Critério de aceite e testes (§10)                                                                                                         | B   |
| Planejador da bola              | A bola nunca para: conduções, passes rasteiros, tabelas, passes por cima e cruzamentos, na proporção de um jogo real, passo a passo (§6)  | C   |
| Rastros por tipo, encadeados    | Cada ação com a sua forma (reta, pontilhado, arco); a ação em curso e as três anteriores, esmaecendo (§7)                                 | C   |
| Bola no ar                      | A bola sobe e desce no arco, com a sombra no chão no token novo `pitch-shadow` (§7)                                                       | C   |
| Cunha do ataque                 | Triângulo a partir da bola até a linha do gol atacado, no token `pitch-wedge` (§8)                                                        | C   |
| Etiqueta em espera; assistência | O finalizador apagado até a bola chegar; a assistência na etiqueta de gol (§9)                                                            | D   |

**Os PRs, na ordem** (o tamanho G pede o "G aprovado" do CEO; nenhum destes passa de M):

| PR  | O quê                                                                                                                                                                                                                                                                                                                                   | Tamanho | Depende de |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------- | ---------- |
| A   | Projeção em `geometry.ts`; fundo novo (arquibancadas, mureta, placas só com cores, gramado e marcações inclinados, traves); modo "só a bola" sobre a coreografia de hoje (a bola e os discos do lance, com entrada e saída suaves); correção D5-A em `scene.ts`; testes de geometria e de pixel. A GoalCelebration continua até o PR B. | M       | o ADR      |
| B   | `PitchTag` (lance, gol e camisa sobre a bola) com a regra de posição e o fio; a etiqueta de gol no lugar da GoalCelebration; os testes de âncora; textos novos (`match.tag.*`).                                                                                                                                                         | M       | A          |
| C   | O planejador da bola (`app/src/ui/match/pitch/plan.ts`), passo a passo; posse D4-C; rastros por tipo e encadeados; bola no ar e sombra (`pitch-shadow`); cunha (`pitch-wedge`); testes de distribuição, continuidade e desfecho.                                                                                                        | M       | A, B       |
| D   | Etiqueta em espera e assistência na etiqueta de gol (fase 2).                                                                                                                                                                                                                                                                           | P       | C          |

Se o PR C passar de M ao ser quebrado em tarefas, a cunha sai dele para um PR P próprio.

## 2. Regras que não mudam

- O campo continua decorativo e `aria-hidden`; a narração e o placar continuam sendo a versão acessível. Etiquetas, camisa sobre a bola e placas também são `aria-hidden`.
- **O canvas continua sem texto** (decisão 2): as etiquetas são DOM sobre o canvas, e as placas, na recomendação, só têm cores (§4).
- **Nada antecipa o desfecho:** o começo de um gol e o de uma chance do mesmo lado, tipo e finalizador continuam iguais quadro a quadro (critério 3 do `campo-lances.md`): o caminho da bola, o tipo do passe do começo do lance, os discos, a cunha e a etiqueta. Só o passo do desfecho lê o desfecho. A câmera é fixa: nenhum movimento de câmera, zoom ou mudança de ângulo (D7).
- **Só tem nome e número quem está num evento do motor** (D1-A). Tudo o que acontece nos minutos sem lance é decorativo e anônimo.
- O mandante fica sempre à esquerda, atacando para a direita, o jogo todo.
- Sem tremor, sem zoom, sem flash, sem mudança de cor do campo.
- A cena continua em metros e uma função pura do passo, do progresso e da semente; o motor e o save não mudam (D6-A).
- O tamanho da caixa do campo e a conta da altura (o maior retângulo 1,5:1; `100dvh − 442px` em pé): a narração continua com 4 linhas de lance a 360×740.
- As metas da T-085: quadros p95 ≤ 34 ms, desenho mediano ≤ 6 ms (CPU 4×, 390×844, densidade 3), nenhuma alocação por quadro na cena, chunk do campo ≤ 20 KB gzip, nenhum `requestAnimationFrame` parado, nenhuma tarefa longa (> 50 ms) durante a partida.

## 3. Geometria e projeção (PR A)

**A câmera.** Fixa, no eixo do meio-campo, atrás da linha lateral de perto, a cerca de 143 m de altura e 157 m atrás da borda de perto do desenho: olha o centro do campo de cima, a cerca de **36°** do gramado. O plano da imagem é vertical, com o quadro deslocado para baixo, então **as verticais continuam verticais** (traves, placas, a altura da bola) e a linha lateral de longe é horizontal. A proporção da caixa é fixa (1,5:1), então a câmera é a mesma em qualquer tamanho; só a escala muda.

**Os três números da vista** (constante `PITCH_VIEW` em `app/src/ui/match/pitch/motion.ts`, com comentário apontando para cá; o `developer` pode ajustá-los no aparelho, sem mudar as regras):

| Nome          | Valor | O que é                                                                                                   |
| ------------- | ----- | --------------------------------------------------------------------------------------------------------- |
| `farScale`    | 0,68  | largura da borda de longe do desenho ÷ largura da borda de perto                                          |
| `grassShare`  | 0,62  | parte da altura da caixa do desenho do gramado (da borda de longe até o pé da caixa); o resto é o estádio |
| `boardHeight` | 12    | altura das placas de longe, em px CSS, a 360px de largura da caixa (proporcional à largura)               |

**A fórmula.** O desenho continua com 111 × 74 m (o campo de 105 × 68 e a faixa de grama de 3 m). Para um ponto da cena em metros (`x`, `y`), com `u = x + 3` e `v = y + 3`, na caixa de `Wc × Hc` px (canvas, já multiplicados pela densidade):

```
s0    = Wc / 111                                   // px por metro na borda de perto
yFar  = Hc × (1 − grassShare)                      // a borda de longe do desenho
t(v)  = 74·farScale / (74·farScale + (1 − farScale) × (74 − v))   // escala: 1 perto, farScale longe
sx    = Wc/2 + (u − 55,5) × s0 × t(v)
sy    = yFar + (Hc − yFar) × (t(v) − farScale) / (1 − farScale)
k     = s0 × t(v)                                  // px por metro naquele ponto (discos, bola, traves, placas, altura)
```

É uma perspectiva verdadeira (homografia): retas da cena continuam retas na tela, então as linhas do campo, os rastros retos, a cunha e a base das placas se desenham projetando só os vértices. Os cantos do desenho caem em `(0, Hc)` e `(Wc, Hc)` (perto) e em `(Wc × (1 − farScale)/2, yFar)` e `(Wc × (1 + farScale)/2, yFar)` (longe). **Um ponto no ar** (a bola no arco) é o ponto do chão projetado, subido `z × k` px.

**O que muda em `geometry.ts`.**

- `pitchGeometry(width, height, dpr)` continua calculada uma vez por tamanho, nunca por quadro, e passa a guardar `s0`, `yFar`, `farScale`, a altura e o topo das placas de longe (`boardTop = yFar − boardHeight`), os mínimos em px e as caixas dos dois gols na tela (para as etiquetas).
- `project(g, x, y, out)`, pura: escreve `sx`, `sy` e `k` num `Float64Array(3)` reaproveitado, sem alocação.
- **Disco** (só os do lance): raio `max(2,75 × k, 7 px CSS)`; o anel de 2px CSS e a marca do visitante (um terço do diâmetro) continuam.
- **Bola:** raio `max(1,25 × k, 4 px CSS)`; no ar, vezes `1 + 0,45 × min(1, z ÷ 9)` (§7).
- **`clampBall`:** a mesma função, aplicada depois da projeção (e da altura), ao centro da bola em px.
- `tagPlacement(g, px, py, r, w, h, out)`, pura, para as etiquetas (§9).
- `scene.ts` continua em metros; o PR A só acrescenta a correção D5-A, e o PR C troca o movimento da bola pelo planejador (§6).

**O fundo, num canvas fora da tela** (redesenhado só quando o tamanho ou o `data-theme` muda): as arquibancadas e a mureta (§4); o gramado (`pitch`) em toda a caixa abaixo da mureta e entre as filas dos fundos, sem faixas alternadas; as marcações em `pitch-line`, com traço de `max(1, Wc ÷ 360)` px CSS (os círculos como polilinhas de 48 pontos projetados); os gols (a rede no chão e, em cada poste, uma trave vertical de `2,44 × k` px com o travessão, em `pitch-line` com 2px CSS); as três filas de placas.

**A cada quadro:** copiar o fundo, a cunha (§8), os rastros (§7), os discos do lance (do fundo para a frente), os fios das etiquetas, a sombra da bola e a bola.

## 4. Arquibancadas, mureta e placas (PR A)

**Arquibancada de longe** (da borda de cima da caixa até `boardTop`, toda com tokens): gradiente vertical de `surface-0` (no alto) a `surface-2`; fileiras de 1px em `line`, a cada 6px embaixo, apertando até 3px no alto, com opacidade de 0,3 a 0,9 (`globalAlpha`); cobertura de 10px em `surface-0`; quatro refletores de 18 × 3px a 12%, 37%, 63% e 88% da largura, a 5px do alto, em `floodlight` com halo radial de 52px no token `beam` no tema noite (proposta 45), apagados em `line` no tema dia. Sem público, sem pessoas, sem bandeiras, sem nada que lembre um estádio real.

**Mureta:** de `boardTop` até `yFar`, em `surface-1`, por toda a largura.

**Arquibancadas atrás dos gols:** do lado de fora de cada fila de placas dos fundos até a borda da caixa, um polígono em gradiente de `surface-2` (no alto) a `surface-0`.

**Placas: três filas, no canvas do fundo, só com cores** (recomendação; pendência 2):

- **Fundo:** 7 placas iguais, com 1px de intervalo, sobre a borda de longe: largura total `Wc × farScale` (245px a 360px), centrada; altura `boardHeight × Wc ÷ 360` (12px a 360px, 13px deitado, 20px no desktop).
- **Atrás de cada gol:** 6 placas de pé sobre a linha `x = −4,5 m` e `x = 109,5 m` (1,5 m fora da faixa de grama, 2,5 m atrás da rede), cobrindo `y` de −3 a 71 m com 0,6 m de intervalo. Cada uma é um paralelogramo: a base é o trecho projetado da linha (inclinado, seguindo a lateral do trapézio), os lados são verticais, com a altura de `boardHeight` convertida em metros na borda de longe (`boardHeight ÷ (s0 × farScale)`, cerca de 5,4 m) vezes o `k` de cada ponta (12px no fundo, até cerca de 17px perto). Perto, a fila sai da caixa pelo lado.
- **Nunca cobrem o jogo:** acima de qualquer ponto da lateral do trapézio a tela já está fora do desenho, então uma placa de pé sobre a linha de fundo nunca se sobrepõe ao gramado, às traves, à rede ou à bola; e tudo o que é desenhado a cada quadro fica por cima do fundo.
- **Cada placa** é uma marca fictícia de `brandForSlot` (`pitch-boards`, ADR-0015), só com as duas cores da marca (dado da marca): o fundo na primeira e uma faixa central (60% da largura, 26% da altura) na segunda. Sem texto, sem rótulo de publicidade, sem link. Até a lista de marcas existir, pares de tokens (`ink`/`surface-0`, `floodlight`/`on-floodlight`, `surface-1`/`ink`, `grass`/`on-grass`), como no protótipo (pendência 3).

## 5. O modo "só a bola" (PR A; o movimento da bola no PR C)

**Escolhido pelo CEO em 2026-11-24** (§15), depois de comparar três modos no protótipo v3. É o que a referência faz e o que deixa o campo fluido: a bola nunca para, e o que não é fato não ganha rosto.

**O que aparece, e quando:**

| Passo                                            | Bola e rastros                     | Cunha | Discos                                                                            | Etiqueta                                  |
| ------------------------------------------------ | ---------------------------------- | ----- | --------------------------------------------------------------------------------- | ----------------------------------------- |
| Minuto sem lance                                 | sim                                | sim   | nenhum                                                                            | a camisa do time com a bola, sobre a bola |
| Começo de lance (jogada, falta, pênalti)         | sim                                | sim   | o finalizador ou cobrador e o goleiro que defende                                 | a do lance, no finalizador ou cobrador    |
| Desfecho sem gol                                 | sim                                | não   | os mesmos                                                                         | a do lance, com o tipo do desfecho        |
| Desfecho de gol                                  | sim                                | não   | o artilheiro e o goleiro                                                          | a de gol, no artilheiro                   |
| Vermelho                                         | sim                                | sim   | o expulso, que surge a 3 m da bola e anda até a linha lateral mais perto no passo | a do vermelho, no expulso                 |
| Depois do gol, começo e intervalo                | a bola volta ao centro, sem rastro | não   | os discos saem                                                                    | nenhuma                                   |
| Amarelo, lesão, troca, mudança tática, acréscimo | sim (a bola segue a jogada)        | sim   | nenhum                                                                            | nenhuma (só a narração)                   |

- **Os discos entram e saem suavemente:** opacidade de 0 a 1 nos primeiros 30% do passo em que aparecem e de 1 a 0 nos primeiros 30% do passo seguinte (curva cúbica), sem animação com movimento reduzido. Os 22 nunca aparecem juntos.
- **Onde o disco surge:** o finalizador surge a 6 m do ponto do lance, do lado do próprio gol, e corre até 1,5 m atrás da bola na primeira metade do avanço e até a bola na câmera lenta (como hoje); o cobrador de falta e de pênalti surge 2 m atrás da bola; o goleiro surge no eixo do gol (§6, item 7). A posição do disco é decorativa; **quem ele é** não (§10).
- **Tamanhos a 360×740:** caixa de 360 × 240px; estádio de longe com 91px; gramado com 149px; placas de 12px (longe) e de 12 a 17px (fundos); disco do lance de 14 a 18px; bola de 8px (até 11,6px no alto de um arco); a etiqueta precisa de 60px acima do disco e cabe sobre o disco mais ao fundo. Deitado (844×390): caixa de 397 × 265px. Desktop (1280×800): 600 × 400px. A 360×640: 297 × 198px, com a etiqueta em uma linha.

**Os modos não escolhidos** ("só os envolvidos" e "os 22 em movimento contínuo") ficam registrados no §18.

## 6. O planejador da bola (PR C)

**O que ele faz.** Decide, passo a passo, o caminho da bola: em cada minuto sem lance, uma ou duas ações do time com a bola (conduzir, passar rasteiro, tabelar, recuar, passar por cima, cruzar), encadeadas de modo que **a bola nunca para**; nos lances, o passe do começo (D3-B), o chute e o que vem depois. Também decide onde os discos do lance surgem e andam. Mora em `app/src/ui/match/pitch/plan.ts`, sem DOM, testado no Vitest; os números ficam em `PITCH_MOTION`, com comentário apontando para cá.

**Dono da bola e direção.** O dono de cada minuto sem lance é o da cota de posse D4-C do `campo-lances.md` (que bate com a posse da súmula); nos lances, o `side` do evento. A direção é a do lado.

**As ações e a distribuição** (`PITCH_MOTION.actions`; sorteio por passo com o rótulo `m${slot}-play`):

| Padrão do minuto                  | Peso | O que a bola faz (frações do passo; distâncias em metros)                                                                                            |
| --------------------------------- | ---- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| Condução e passe rasteiro         | 0,20 | conduz por 30 a 45% do passo (3 a 6 m para a frente, até 3 m para o lado) e passa rasteiro até o fim do passo                                        |
| Passe rasteiro e condução         | 0,15 | passa rasteiro em 55% do passo; quem recebe conduz 2 a 5 m                                                                                           |
| Um passe rasteiro                 | 0,20 | um passe rasteiro no passo inteiro                                                                                                                   |
| Dois passes rasteiros             | 0,14 | dois passes rasteiros, metade do passo cada                                                                                                          |
| Recuo                             | 0,12 | no próprio campo (8 m ou mais atrás do meio), metade das vezes para o goleiro; senão, um recuo de 8 a 15 m e uma condução de 2 a 4 m                 |
| Tabela                            | 0,08 | dois passes rasteiros curtos, metade do passo cada; o segundo volta 6 m à frente de onde a bola saiu, formando um "V"                                |
| Por cima (lançamento ou inversão) | 0,11 | um passe por cima no passo inteiro: lançamento (18 a 30 m para a frente, até 12 m para o lado) ou inversão (para o outro lado do campo), meio a meio |

- **Passe rasteiro curto:** de 5 a 18 m para a frente e até 14 m para o lado.
- **Cruzamento:** só com a bola aberta no terço final (a mais de 18 m do meio-campo no sentido do ataque e a mais de 15 m do meio na largura), com 45% de chance, no lugar do padrão sorteado: um passe por cima que cai na área (7 a 14 m da linha de fundo, até 7 m do meio na largura).
- **Nunca dois por cima seguidos** (lançamento, inversão ou cruzamento), nem no começo de lance logo depois de um passe por cima: o peso do "por cima" sai do sorteio enquanto a ação anterior foi por cima.
- **Limites:** a bola fica entre 10 e 95 m no comprimento e entre 5 e 63 m na largura nos minutos sem lance.
- **Troca de dono:** quando o dono muda, a bola primeiro se solta (anda de 3 a 6 m, sem rastro, nos primeiros 30% do passo: a disputa) e só depois o novo dono joga.

**A proporção medida** (protótipo v5, 20 partidas de 90 minutos, 2.298 ações sem contar os lances): passe rasteiro (curto e recuo) **66,0%**, condução **21,6%**, tabela **5,2%**, por cima **6,0%**, cruzamento **1,1%**; nenhuma vez dois passes por cima seguidos. Numa partida só (semente 11): 66,7%, 20,8%, 2,5%, 5,8% e 4,2%.

**O lance (D3-B, sem antecipar o desfecho).**

- **Começo de lance de jogada:** se o dono da bola já é o lado do lance, um passe anônimo leva a bola ao ponto do lance na primeira metade do avanço: **cruzamento** se a bola está aberta (a mais de 14 m do meio na largura), o ponto fica na área e a ação anterior não foi por cima; senão, **rasteiro**. Se o dono era o outro lado, a bola vai ao ponto sem rastro (uma retomada). Tudo isso depende só do que já aconteceu e do ponto do lance (rótulo `-build`), então o começo do gol e o da chance são iguais.
- **Falta e pênalti:** a bola vai ao ponto sem rastro (não há passe).
- **Desfecho:** o chute sai do ponto do lance e chega ao destino de hoje (rede, goleiro, poste, fora) em metade do `afterMiss`. Chute rasteiro na maioria; **por cima do travessão** em metade dos "para fora" (o destino passa a ficar dentro da largura do gol, acima do travessão); **arco baixo** em toda falta (por cima da barreira). Na trave, a volta de 6 m continua. Só este passo lê o desfecho (rótulo `-outcome`).
- **Depois do gol, começo e intervalo:** a bola rola até o centro no passo, sem rastro.

**Discos do lance.** O finalizador ou cobrador e o goleiro, como no §5. O goleiro fica no eixo do gol: profundidade a partir da própria linha de `2 + 0,12 × (distância da bola a essa linha)`, entre 2 e 14 m, e largura `34 + 0,3 × (y da bola − 34)`, limitada a ±6 m; na defesa, vai ao ponto da defesa (como hoje).

**Continuidade.** A bola é contínua em posição em todo o jogo: cada ação começa onde a anterior terminou, e cada passo começa onde o anterior terminou. A condução é uma curva cúbica (Hermite) com a velocidade da bola na saída; o passe rasteiro desacelera (`1 − (1 − u)²`); o passe por cima anda constante no chão e sobe numa parábola (§7). Os discos do lance seguem curvas cúbicas com velocidade contínua, com no máximo 11 m/s no relógio Normal (o finalizador, até 14 m/s, para chegar à bola).

**Passo a passo, sem tarefa longa.** O planejador **nunca monta a partida inteira de uma vez**. O plano do passo `i + 1` é feito quando o passo `i` é revelado (no `onreveal`), a partir do estado do fim do passo `i` (onde a bola está, como se move, quem é o dono, se a ação anterior foi por cima) e da semente: cerca de 0,1 ms por passo com CPU 4×. Como o plano de um passo só depende do passado e da semente, montar passo a passo ou de uma vez dá o mesmo resultado (teste). Pular para o resultado não precisa de plano.

**Sem alocação por quadro.** O plano de cada passo cabe num `Float64Array` de tamanho fixo (até 3 ações por passo, 12 números cada, mais 16 números de pontos de condução), escrito uma vez no plano; a cena do quadro só avalia esses números e escreve no mesmo `out` de sempre.

**Tempo.** O plano é em segundos do relógio Normal; o quadro usa `τ = início do passo + avanço × duração Normal`, com o avanço da câmera lenta na pausa dramática. No Rápido, tudo anda na mesma proporção.

## 7. Rastros por tipo e encadeados (PR C)

**Os tipos se distinguem pela forma, nunca só pela cor** (todos em `ink`):

| Ação                                          | Desenho                                                                                                                                                                    |
| --------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Passe rasteiro (curto, recuo, para o goleiro) | linha reta contínua de 2px CSS, que cresce com a bola                                                                                                                      |
| Tabela                                        | dois rasteiros encadeados (o "V")                                                                                                                                          |
| Condução                                      | **pontilhado** (traço `[0,1, 5]`, 2,2px, pontas redondas) pelos 8 pontos do caminho real da bola, colado ao chão                                                           |
| Por cima (lançamento, inversão, cruzamento)   | **arco no ar**: 19 pontos da parábola, cada um projetado e subido `z × k`, em linha de 2px; e, no chão, o **rastro da sombra**, tracejado (`[3, 4]`, 1,2px, opacidade 0,7) |
| Chute                                         | linha reta **mais grossa** (3,5px) até o destino                                                                                                                           |
| Chute por cima (travessão, barreira)          | **arco baixo** de 3px                                                                                                                                                      |
| Trave                                         | linha quebrada: do ponto ao poste e a volta                                                                                                                                |

- **Altura do passe por cima:** `h = min(11, 2,5 + 0,17 × distância)` m, numa parábola `z = h × 4u(1 − u)`; cruzamento de 4 a 6 m; chute por cima do travessão subindo até 3,2 m na linha do gol (`z = h × (1 − (1 − u)²)`); falta com 2,2 m.
- **O ponto de origem** (5px de diâmetro em `ink`) só na ação mais nova.
- **Encadeados:** a ação em curso e as **três anteriores**, com opacidade 1; 0,6; 0,38; 0,22, cada uma ainda vezes `1 − idade ÷ 3,2 s` (relógio Normal) depois de terminar. Assim a jogada inteira aparece, como na referência. A cadeia recomeça na volta ao centro (depois do gol, começo e intervalo). Um anel fixo de 4 entradas, sem alocação.
- **A bola no ar:** desenhada no ponto subido, com o raio vezes `1 + 0,45 × min(1, z ÷ 9)`; **a sombra** fica no chão, embaixo: uma elipse de `1,05 r₀ × 0,5 r₀` no token novo **`pitch-shadow`** (`rgba(0, 0, 0, 0.38)` nos dois temas; proposta 49), desenhada só com `z > 0,15 m`. A sombra é escura nos dois temas porque uma sombra clara não se lê como sombra; ela é decoração e nunca fica sob texto.
- **Ressalva de leitura:** um passe por cima quase só na profundidade (de perto para longe) vira uma linha quase vertical, porque a altura também é vertical na tela; o arco se lê bem quando o passe tem componente lateral. É raro (os por cima são 6%).
- **Custo:** até cerca de 100 projeções por quadro (4 rastros, 19 pontos no pior caso), os padrões de traço em arrays fixos, a elipse e as polilinhas como chamadas do canvas: de 0,1 a 0,2 ms por quadro com CPU 4×.

## 8. Cunha do ataque (PR C)

Um triângulo translúcido com o vértice na bola (no ponto do chão, também com a bola no ar), apontado para o centro do gol que o dono ataca, até a linha desse gol, com meia-abertura de 26°, recortado ao retângulo de jogo projetado; gradiente do token `pitch-wedge` (proposta 42, aprovada: noite `rgba(4, 18, 10, 0.45)`, dia `rgba(255, 255, 255, 0.35)`) no vértice até transparente no gol. A cunha sempre afasta o gramado do `ink` (no vértice, 10,96:1 no tema noite e 7,35:1 no dia). Em todo passo com dono; some no desfecho e na volta ao centro; com a bola a menos de 3 m da linha do gol atacado, não é desenhada. Quando o dono muda, a nova entra em 200 ms (`globalAlpha`). O gradiente é criado uma vez por tamanho e tema num eixo local, e a cada quadro só se ajusta a transformação e se passam os vértices para o eixo local (sem alocação): de 0,1 a 0,3 ms por quadro com CPU 4×.

## 9. Etiquetas: do lance, de gol e a camisa sobre a bola (PR B; espera e assistência no PR D)

**A etiqueta sai do jogador** (pedido do CEO, 2026-11-23): uma pílula fora do canvas, presa ao disco por uma ponta e um fio.

**Posição** (`tagPlacement`, pura, a cada quadro):

1. Em cima do disco (ou da bola, na camisa sobre a bola), centrada no `x` dele: a base fica 12px acima do topo (7px de ponta e 5px de fio).
2. Presa na caixa: `x` entre `space-2` e `Wc − space-2 − largura`; o topo nunca acima de 4px.
3. **Nunca cobre um gol:** se cruzar, na altura, a caixa de um gol na tela (traves, travessão e rede projetados, com 6px de margem), ela é empurrada para o lado de dentro até não cobrir, e presa na caixa de novo.
4. **A ponta** fica no `x` do jogador, limitada a 20px das pontas da pílula: perto da borda ou do gol, a pílula vira para dentro e o fio sai inclinado.
5. **O fio** é traço no canvas (1,5px em `ink`), da ponta ao topo do disco ou da bola.
6. A largura e a altura são medidas uma vez por etiqueta; a posição vai para o DOM como `transform` só quando muda mais de 0,5px (a única escrita no DOM por quadro; sem layout).

O que ela pode cobrir por instantes: a bola que vem de cima do jogador no passe do começo do lance. O que ela nunca cobre: os gols, o próprio jogador e a bola no pé dele.

**Etiqueta do lance.** Pílula em `surface-1`, borda de 1px em `line`, `radius-pill`, `shadow-card`; ponta de 12 × 7px na cor da pílula. À esquerda, a camisa: um círculo de 40px em `surface-2` com a camisa do uniforme do jogador (`kitSvg` com a opção aditiva `part: 'shirt'`, a `viewBox` `0 0 64 42`, 34 × 22px; o goleiro com a de goleiro; pedido ao `art-director` e ao `developer`) e o número (`Player.shirt`) em `numero` com `tabular-nums`, na `numberColor` do uniforme, sobre a `numberPlate` quando ela existe. À direita, o tipo em `rotulo` (`ink-muted`) e o nome em `body-strong` (`ink`). Largura de até 60% da caixa (216px a 360px); o nome quebra em até 2 linhas e nunca corta; 48px de altura (70px com duas linhas de nome); abaixo de 200px de altura da caixa, uma linha só (camisa e nome), 40px.

| Passo                                                        | Tipo (chave)                                                  | Âncora (disco do…) |
| ------------------------------------------------------------ | ------------------------------------------------------------- | ------------------ |
| Começo de lance de jogada                                    | `match.live.shot` ("Finalização")                             | finalizador        |
| Começo de falta                                              | `match.live.freeKick` ("Falta")                               | cobrador           |
| `penaltyAwarded`                                             | `match.live.penalty` ("Pênalti")                              | cobrador           |
| Desfecho: defesa, trave, fora; pênalti perdido; chance fraca | `match.tag.saved`, `match.tag.post`, `match.tag.wide` (novas) | finalizador        |
| Desfecho: gol                                                | a etiqueta de gol                                             | artilheiro         |
| Vermelho                                                     | `report.event.red` ("Vermelho")                               | expulso            |

**Etiqueta de gol** (substitui a GoalCelebration; proposta 47). A mesma pílula, com `tone="goal"`: fundo, borda e ponta em `grass`, texto em `on-grass` (par conferido), o círculo da camisa em `surface-1`; "Gol!" (`match.celebration.title`) em `numero`, caixa alta; o artilheiro em `body-strong`; no PR D, "Assistência de {player}" (`match.celebration.assist`) em `caption`. 50px de altura (66px com a assistência); sem escudo (a camisa identifica, e a linha da narração tem o escudo). Entra com escala de 0,92 a 1 e opacidade em 200 ms `ease-out` a partir da ponta; fica o passo "depois de um gol" inteiro, seguindo o artilheiro; sai sem animação no passo seguinte. O anúncio do gol continua na região viva do placar.

**A camisa sobre a bola** (minutos sem lance; proposta 48). Uma pílula compacta só com a camisa do time com a bola, **sem número e sem nome**: círculo de 32px em `surface-2` com a camisa de 26 × 17px, ponta e fio até a bola (subida, no ar). Diz só quem está com a bola, que é fato (D4-C); o número diria quem tocou, o que seria inventar (D2-B). Aparece nos passos de minuto sem lance quando não há etiqueta de lance na tela; troca de camisa, sem animação, quando o dono muda; não aparece com movimento reduzido (o campo só é redesenhado nos lances).

**Tempos da etiqueta do lance.** Entra com opacidade e escala de 0,92 a 1 a partir da ponta, em 160 ms `ease-out`, no `onreveal`; do começo ao desfecho do mesmo lance, só o texto do tipo muda; outro jogador substitui na hora; sai com opacidade em 120 ms no começo do primeiro passo sem etiqueta que comece pelo menos 1,6 s (Normal) ou 0,8 s (Rápido) depois da entrada, ou quando o disco dela sai de cena. As durações ficam no componente, com comentário apontando para cá, até o grupo de movimento dos tokens existir.

**Etiqueta em espera (PR D).** No começo de um lance de jogada, o nome entra em `ink-muted` e passa para `ink` quando a bola chega ao finalizador (o fim do primeiro trecho: 35% do tempo na pausa dramática). Igual para gol e chance; na falta e no pênalti, e com movimento reduzido, entra acesa. É a versão honesta do "próximo jogador, apagado" da referência.

**Leitor de tela.** Todas `aria-hidden`: o que dizem está na linha da narração do mesmo passo. Nada entra na região viva.

**Idiomas.** Medido em `rotulo`: o tipo mais largo que já existe é "Finalização", 65,4px; as sugestões novas, de 25,8 ("Wide") a 70,8px ("Off the post"). Os `match.tag.*` com no máximo 140px nos três idiomas.

**Componente.** `PitchTag.svelte` em `app/src/ui/components/` (casca do `ux-designer`, no chunk do campo): `tone: 'play' | 'goal' | 'team'`, `kind?: string`, `name?: string`, `assist?: string`, `shirt?: number`, `kitSvg: string`, `number?: { color: string; plate: string | null }`, `waiting?: boolean`, `compact?: boolean`. A posição vem de fora (a tela aplica o `tagPlacement`).

## 10. Âncora: sempre o jogador certo (PR A e B; critério de aceite)

- No modo "só a bola", **cada disco do lance é criado para o jogador do evento**: o finalizador, o cobrador, o artilheiro ou o expulso, pelo `PlayerId` do evento. A etiqueta ancora nesse disco e mostra o nome e o número **desse** jogador (o mesmo `PlayerId` dá o disco, o nome e o `Player.shirt`).
- **O goleiro** é o dono atual da vaga de goleiro do lado que defende, pelo `Field.owner` da coreografia, que segue a escalação real em campo naquele minuto: os titulares; nas trocas, quem entrou; no vermelho e na lesão sem troca, a vaga vazia.
- **D5-A (PR A):** quando o goleiro sai sem troca, o motor põe no gol o jogador de linha em campo de maior `physical` (empate na primeira vaga); hoje o campo põe o da última vaga. A coreografia passa a seguir o motor: a vaga de goleiro passa ao jogador de linha em campo de maior `attributeOf(player, 'physical')`, empate no menor índice. O caso que a regra não cobre (troca de formação antes, que reordena as vagas pela energia) não mostra nome errado: a etiqueta da defesa leva o finalizador (decisão 4).
- **A bola vai a esse disco:** no começo do lance, o contato (o fim da câmera lenta) põe a bola no disco do finalizador; no pênalti, o cobrador chega à marca; o chute sai dele.
- **O expulso:** a etiqueta entra no passo do vermelho, presa ao disco enquanto ele anda até a linha lateral; quando o disco sai, no fim do passo, a etiqueta fica no último ponto dele, sem fio, até o tempo mínimo.
- **Sem jogador:** se o `PlayerId` do evento não estiver na lista do time (só com save danificado), não há disco nem etiqueta, e o caso é registrado como erro de programação em `lib/errors`. O "último disco de linha" que o `discOf` de hoje devolve nunca é usado para etiqueta.

## 11. Temas e movimento reduzido

**Tema noite (padrão):** arquibancadas em `surface-0` → `surface-2`, refletores acesos (`floodlight` com halo `beam`), mureta `surface-1`, gramado `pitch`, marcações `pitch-line`, cunha escura, bola, rastros e fios em `ink` claro, sombra da bola em `pitch-shadow`.

**Tema dia:** os mesmos papéis com os tokens do dia: arquibancadas claras, refletores apagados (em `line`, sem halo), cunha clara, `ink` escuro; a sombra continua escura. O estádio perde a cara de noite (pendência 1). Ao trocar o tema, o fundo e o gradiente da cunha são redesenhados uma vez.

**Movimento reduzido** (regra da T-085, ajustada ao modo "só a bola"): o campo fica parado, com um quadro só a cada passo com linha na narração e nenhum `requestAnimationFrame` entre eles. No quadro: a bola no ponto de chegada do passo (no chão); os rastros daquele passo **inteiros e parados** (o arco desenhado completo, a condução pontilhada inteira); a cunha do dono daquele passo; os discos do lance no **fim do passo** (não mais nas posições da formação, que deixariam o finalizador longe da bola); as etiquetas sem transição; sem a camisa sobre a bola. A câmera nunca se move.

## 12. Desempenho e orçamento

| Item                               | Hoje (medido, T-085) | PR A                                        | PR B                        | PR C                                                           | PR D | Meta                        |
| ---------------------------------- | -------------------- | ------------------------------------------- | --------------------------- | -------------------------------------------------------------- | ---- | --------------------------- |
| Chunk do campo (JS + CSS, gzip)    | 7,1 KB               | +3 KB (projeção, fundo, placas, modo, D5-A) | +2 KB (`PitchTag`, posição) | +3 a 4 KB (planejador, rastros por tipo, sombra, cunha)        | +0,3 | ≤ 20 KB                     |
| Desenho de um quadro (mediana)     | 0,5 ms               | +0,1 ms (projeções, até 3 discos)           | +0,05 ms (fios)             | +0,3 ms (rastros, sombra, cunha)                               | —    | ≤ 6 ms                      |
| Intervalo entre quadros (p95)      | 16,8 ms              | sem mudança esperada                        | sem mudança esperada        | sem mudança esperada                                           | —    | ≤ 34 ms                     |
| Redesenho do fundo (tamanho, tema) | não medido           | de 5 a 15 ms com CPU 4×                     | —                           | —                                                              | —    | ≤ 30 ms, nunca tarefa longa |
| Planejamento                       | —                    | —                                           | —                           | cerca de 0,1 ms por passo, no `onreveal`                       | —    | nenhuma tarefa longa        |
| Memória do plano                   | poses de hoje        | —                                           | —                           | até cerca de 60 números por passo (cerca de 70 KB por partida) | —    | —                           |

Total estimado ao fim: de 15,5 a 16,5 KB gzip no chunk do campo e cerca de 1 ms de mediana por quadro; nenhuma imagem nova no precache. Se uma meta passar, volta ao `architect`.

## 13. Critérios de aceite e medidas

**Vitest, geometria (PR A):**

1. Os quatro cantos do desenho caem onde o §3 diz (tolerância de 0,5px), em 360×240, 397×265, 600×400 e 297×198.
2. Profundidade monótona; retas continuam retas (três pontos alinhados na cena continuam alinhados na tela, tolerância de 0,5px).
3. Mínimos: disco ≥ 7px CSS de raio e bola ≥ 4px CSS em todo o desenho.
4. `project` e `tagPlacement` são puras e não alocam.
5. Placas: nenhum vértice das placas dos fundos dentro do trapézio do desenho; a fila de longe acima de `yFar`.
6. `tagPlacement`, numa grade de posições nos quatro tamanhos e com as alturas de etiqueta: a pílula fica inteira na caixa, não cruza a caixa de nenhum gol, e a ponta fica a no máximo 20px das pontas da pílula.

**Vitest, âncora (PR A e B; com o `qa-engineer`):**

1. Em 200 partidas simuladas (sementes fixas, escalações reais, com trocas, vermelhos e lesões), todo passo com etiqueta tem o disco-âncora criado para o `PlayerId` do evento do passo; o goleiro do lance é o dono da vaga de goleiro naquele passo, calculado no teste de forma independente da coreografia (titulares, refeitos evento a evento: troca, vermelho, lesão sem troca e a regra do motor para o goleiro que sai).
2. O expulso: o critério vale no passo do vermelho, com o disco ainda em cena.
3. O nome da etiqueta é igual ao da linha da narração do mesmo passo, e o número é o `Player.shirt` do mesmo `PlayerId`.
4. No fim do começo de cada lance de jogada, a bola fica a no máximo 0,1 m do disco do finalizador; no pênalti, o cobrador está na marca.
5. D5-A: num caso montado à mão (goleiro expulso sem troca), a vaga de goleiro passa ao jogador de linha em campo de maior `physical`.
6. Sem jogador: com um evento de um `PlayerId` fora da lista (montado à mão), não há disco nem etiqueta, e o erro é registrado.

**Vitest, planejador e rastros (PR C):**

1. Determinismo: a mesma partida dá o mesmo plano; montar passo a passo (no `onreveal`) e de uma vez dá o mesmo resultado, número a número.
2. A bola nunca salta: a posição no fim de cada passo é igual (até 1 mm) à do começo do seguinte; dentro do passo, a distância entre dois instantes a 16 ms nunca passa de 3 m (nem no chute).
3. A bola nunca para nos minutos sem lance: em nenhum intervalo de 200 ms do relógio Normal a bola anda menos de 0,2 m (o fim de um passe rasteiro curto, que desacelera, é o caso mais lento).
4. Limites: nos minutos sem lance, a bola fica entre 10 e 95 m e entre 5 e 63 m.
5. **Distribuição**, em 1.000 partidas: passe rasteiro (curto e recuo) entre 60 e 70%; condução entre 17 e 25%; tabela entre 3 e 8%; por cima (lançamento e inversão) entre 4 e 8%; cruzamento no máximo 3%, e só com a bola aberta no terço final.
6. Nunca dois passes por cima seguidos (lançamento, inversão ou cruzamento), também no começo de lance.
7. **Nada antecipa o desfecho:** o teste dos 11 pontos cobre o caminho da bola, o tipo do passe do começo do lance, os discos, a cunha e a etiqueta: iguais para gol e chance do mesmo lado, finalizador e tipo.
8. Sem alocação: `sceneAt` escreve no mesmo objeto, e o anel de rastros tem 4 entradas fixas.

**E2E (Playwright, como os da T-085):**

1. **Desempenho:** quadros p95 ≤ 34 ms e desenho mediano ≤ 6 ms a 390×844, densidade 3, CPU 4×, 15 s de "Animada completa" no Normal (PR A e de novo no C).
2. **Sem tarefa longa** durante a partida inteira, com o planejamento passo a passo e a troca de tema no meio (`PerformanceObserver` de `longtask`).
3. **Pixels** (substitui o item 11 da T-085 e o do E2E offline): o pixel do meio da borda de baixo do canvas em `--pitch`; o do canto de cima à esquerda em `--surface-0`. Nos dois temas.
4. **Etiquetas:** `aria-hidden`; a de gol aparece no desfecho do gol e some no passo seguinte; a do lance nunca num passo `minuteFull`; inteiras dentro da caixa a 360×740, 844×390 e 1280×800; uma linha só a 360×640; o anúncio do gol continua na região viva do placar.
5. **Camisa sobre a bola:** `aria-hidden`; só em passos `minuteFull`; nunca com movimento reduzido.
6. **Movimento reduzido:** sem transição nas etiquetas e na cunha; nenhum `requestAnimationFrame` entre lances.
7. **Chunk** (`tests/regression/match-chunks.test.ts`): o do campo com no máximo 20.000 bytes gzip, e nenhum arquivo de imagem novo no fecho dele.

## 14. Design system e textos

**Propostas** (numeração de [componentes.md](componentes.md#propostas-ao-design-system); registro lá e no `design-system.md` na implementação):

41. **Etiqueta do lance no campo: aprovada**, presa ao jogador (§9).
42. **Token `pitch-wedge`: aprovada** (§8); o `npm run tokens` confere o `ink` sobre o `pitch` com a cunha ≥ 3:1 nos dois temas.
43. **Rastros da bola** (aprovados com a fase 1; revistos): os tipos do §7, distintos pela forma, encadeados, inteiros e parados com `prefers-reduced-motion`. Sem token novo além do 49.
44. **Assistência no gol: aprovada**, como a terceira linha da etiqueta de gol (PR D).
45. **`beam` também no jogo (para o CEO):** o token, hoje "só no site", nos halos dos refletores da arquibancada, no tema noite, decorativo. Sem valor novo.
46. **Campo inclinado, modo "só a bola" e placas (para o CEO, junto do ADR):** a regra "Campo da partida" passa de "campo deitado, visto de cima, com os 22" para "campo inclinado por código (§3), com arquibancadas, mureta e três filas de placas só com cores no fundo, só a bola em movimento e os discos só nos lances do motor (§5)".
47. **Etiqueta de gol no lugar da comemoração (para o CEO):** a GoalCelebration (proposta 39) sai; o gol é a `PitchTag` com `tone="goal"` (§9).
48. **Camisa sobre a bola (para o CEO):** a etiqueta só com a camisa do time com a bola, sem número nem nome, nos minutos sem lance (§9).
49. **Token `pitch-shadow` (para o CEO):** `rgba(0, 0, 0, 0.38)` nos dois temas, só a sombra da bola no ar (§7).

**Textos novos** (para o `content-writer`; o lote passa pelo CEO):

| Chave                      | pt-BR (sugestão)          | Uso                                     |
| -------------------------- | ------------------------- | --------------------------------------- |
| `match.tag.saved`          | "Defendida"               | tipo da etiqueta no desfecho de defesa  |
| `match.tag.post`           | "Na trave"                | idem, trave                             |
| `match.tag.wide`           | "Para fora"               | idem, para fora                         |
| `match.celebration.assist` | "Assistência de {player}" | PR D, terceira linha da etiqueta de gol |

Reaproveitadas: `match.live.shot`, `match.live.freeKick`, `match.live.penalty`, `report.event.red`, `match.celebration.title`.

**Atualizações em [partida.md](partida.md) na implementação** (no PR de cada parte, pelo `ux-designer`): "Desenho", "Tamanhos", "Coreografia", "Comemoração", "Placas", "Movimento", "Marcas do cenário" e "Medidas para o E2E" passam a apontar para este arquivo.

## 15. Decisões do CEO

**2026-11-23, sobre a proposta:**

1. **Fases:** aprovadas. Fase 1: rastro, etiqueta e cunha, no campo inclinado (item 6), com a posse do `campo-lances.md`. Fase 2: etiqueta em espera e assistência. (A divisão em PRs do §1 é para cada PR caber em M.)
2. **Proposta 41 (etiqueta no campo): aprovada.** Fica revogada a parte "nenhum número ou texto no campo" da decisão 11 da T-032; o canvas continua sem texto.
3. **Proposta 42 (token `pitch-wedge`): aprovada.**
4. **Etiqueta da defesa:** finalizador e "Defendida" na fase 1.
5. **Eventos com etiqueta:** só lances com bola (finalização, gol, pênalti) e cartão vermelho.
6. **Perspectiva:** a **saída A, campo inclinado por código**, já na fase 1, no lugar da vista de cima; sem fundo ilustrado; ADR antes da implementação. A cunha do ataque continua ("a sombra que indica qual lado está atacando").
7. **Placas:** uma fila no fundo, só com marcas fictícias (ADR-0015); nenhuma na faixa de grama.
8. **Proposta 44 (assistência): aprovada**, na fase 2; sem "replay" da assistência no campo.

**2026-11-23 e 2026-11-24, depois dos protótipos:**

9. **Placas também atrás dos gols** (pedido do CEO): três filas (§4).
10. **O gol como etiqueta saindo do jogador**, no lugar do cartão grande (pedido do CEO): §9, proposta 47.
11. **Etiquetas sempre no jogador certo**, com critério de aceite (pergunta do CEO): §10 e §13.
12. **Modo "só a bola"** (escolhido entre três no protótipo v3): §5. "Só os envolvidos" e "os 22 em movimento contínuo" ficam fora (§18).
13. **Passes variados, com o "por cima" como exceção** (v4 e v5): os tipos do §7 e a distribuição do §6.

## 16. Decisões do CEO de 2026-11-24 (antes pendências)

Depois de ver os protótipos v1 a v5, o CEO escolheu o modo "só a bola" (modo 1 do v3), com rastros por tipo e o passe por cima como exceção (v5), e decidiu as pendências, todas como recomendado:

1. **Arquibancada no tema dia:** segue o tema (estádio claro, refletores apagados; sem token novo).
2. **Placas:** só cores, no canvas do fundo, sem texto.
3. **Marcas fictícias:** o lote da lista (T-040) é antecipado para o PR A e passa pelo CEO; até lá, pares de tokens.
4. **Altura da caixa:** mantém 1,5:1.
5. **Divisão:** quatro PRs, A, B e C de tamanho M e D de tamanho P, na ordem do §1; o ADR-0023 vai antes, em PR próprio.
6. **Tokens:** `pitch-shadow` (proposta 49) e `beam` no jogo (proposta 45) aprovados; `pitch-wedge` já aprovado.
7. **Propostas 45, 46, 47, 48 e 49:** aprovadas.
8. **D2-B no modo "só a bola":** aprovada a bola entre 10 e 95 m nos minutos sem lance (§6). A confirmação do `game-designer` entra no `campo-lances.md`.

## 17. Protótipos

Tudo fora do repositório, no scratchpad da sessão, com clubes fictícios do jogo (Cruzador x Miragol) e escudos, uniformes e nomes dos geradores do próprio jogo; nenhum escudo, nome ou marca real. As placas mostram o nome do jogo e marcas abstratas.

- **v5 (o que esta spec descreve):** `prototipo-v5.html`, só o modo 1, com a distribuição do §6, e `v5-jogada.gif` (7,5 s de uma sequência típica).
- **v4:** os tipos de rastro, com passes por cima demais (`prototipo-v4.html`, `v4-*.png`, `v4-jogada.gif`).
- **v3:** os três modos (`prototipo-v3.html`, `v3-*`).
- **v2 e v1:** o campo inclinado com os 22 e a comemoração em cartão.
- **Maquetes estáticas** da proposta original (`a-vista-de-cima.png` a `i-etiqueta-em-espera.png`).

## 18. Anexo: o que não foi escolhido

- **Vista de cima** (saída C) e **fundo ilustrado** (saída B, ComfyUI): o CEO escolheu o campo inclinado por código. B custaria de 75 a 360 KB a mais no precache para todos e revisão de arte a cada ajuste; C tinha a melhor legibilidade, sem custo. A transformação por CSS do canvas foi descartada (achata os discos, desfoca, e a tela não sabe onde cada ponto caiu).
- **Os 22 com movimento por função** (v2): alvo por função, pressão, cobertura, corrida de ruptura, deriva. O CEO achou travado e com pouca variação.
- **Os 22 em movimento contínuo** (modo 3 do v3): curvas com velocidade carregada, planos assíncronos, conduções. Mais fluido, mas a 360px os discos se embolam perto da bola, e cada disco sem nome é um fato inventado na tela. Custo estimado: 0,6 a 1 ms por quadro e de 4 a 4,5 KB.
- **Só os envolvidos** (modo 2 do v3): de 3 a 5 discos que aparecem e somem; tira a noção de quem é quem e não ganha do modo 1.
- **A comemoração em cartão grande** (proposta 39): substituída pela etiqueta de gol.
