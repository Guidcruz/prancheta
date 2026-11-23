# Partida: campo v2 (campo inclinado, movimento, rastro, etiqueta e cunha)

**Estado:** decidido pelo CEO em 2026-11-23 (§15). A perspectiva foi revista no mesmo dia: o campo passa a ser **inclinado por código**, já na fase 1, no lugar da vista de cima. Ainda no mesmo dia, depois do protótipo, o CEO pediu quatro coisas: mais variedade no movimento dos jogadores (§6), a comemoração de gol como uma etiqueta saindo do jogador (§10), placas também atrás dos gols (§4) e etiquetas sempre no jogador certo (§9, "Âncora"). Sem código de produção ainda; a implementação espera o ADR do "visto de cima" do `docs/PROJETO.md`, que o `architect` escreve em paralelo. **Parte:** o visual e o movimento decorativo. A regra de jogo e a honestidade dos dados (quem ganha nome, de onde vêm a posse e a direção) são do `game-designer`, em [../campo-lances.md](../campo-lances.md); este arquivo segue as recomendações de lá (D1-A, D2-B, D3-B, D4-C, D5-A, D6-A, D7) e aponta onde diverge. **Base:** [partida.md](partida.md) ("Campo 2D (T-085)", "Movimento", "Acessibilidade", "Desempenho no celular"), [../design-system.md](../design-system.md) ("Campo da partida"), [../../art/uniformes.md](../../art/uniformes.md) e a §4.7 de [../../02-architecture.md](../../02-architecture.md). **Referência:** prints de um app real de lance a lance, só pela mecânica. Nada do visual, dos escudos, dos nomes ou das marcas daquele app entra no projeto, e nenhuma imagem dele está no repositório.

**Em uma frase:** o campo da "Animada completa" passa a ser visto de lado e de cima, inclinado por código, com arquibancada e placas fictícias em volta; os jogadores se movem cada um pela sua função; sobre o campo, o caminho da bola (rastro), uma cunha que aponta o ataque de quem tem a bola e uma etiqueta que sai do jogador do lance (e, no gol, a etiqueta de gol).

## 1. Resumo e fases

| Item                          | No Prancheta                                                                                                                                     | Fase |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| 5. Campo em perspectiva       | **Campo inclinado por código** (§3), com a arquibancada, a mureta e as placas desenhadas uma vez num canvas fora da tela (§4)                    | 1a   |
| Placas                        | Três filas: atrás da linha lateral de longe e atrás de cada linha de fundo; só marcas fictícias (ADR-0015); só cores, sem nome (pendência 2)     | 1a   |
| Gol                           | **Etiqueta de gol** saindo do artilheiro, no lugar do cartão grande da comemoração (§10)                                                         | 1a   |
| Jogador certo                 | A âncora da etiqueta e a correção do goleiro que sai sem troca (D5-A), com critério de aceite (§9)                                               | 1a   |
| Movimento dos jogadores       | **Cada um pela sua função:** alvo próprio, atraso e ritmo próprios, pressão e cobertura, corrida de ruptura, goleiro no eixo do gol, deriva (§6) | 1b   |
| 1. Rastro do passe            | **Rastro da bola:** linha em `ink` de onde a bola saiu até onde ela está (§7)                                                                    | 1b   |
| 4. Sombra em cunha            | **Cunha do ataque:** triângulo a partir da bola até a linha do gol atacado, no token `pitch-wedge` (§8)                                          | 1b   |
| 2. Etiqueta do lance          | **Etiqueta do lance:** pílula fora do canvas, presa ao jogador por uma ponta e um fio, com a camisa e o número, o tipo e o nome (§9)             | 1b   |
| 3. O próximo jogador, apagado | **Etiqueta em espera:** o finalizador aparece apagado e acende quando a bola chega (§9); a assistência na etiqueta de gol (§10)                  | 2    |

**Por que a fase 1 se divide em duas.** Juntas, a perspectiva, o movimento e os três itens passariam do tamanho M (o G pede o "G aprovado" do CEO). Separadas, cada uma cabe num PR M:

- **1a, o campo inclinado:** a projeção em `geometry.ts`, o fundo novo (arquibancada, mureta, placas, gramado e marcações inclinados, traves), os discos por profundidade, a etiqueta ancorada (o componente e a regra de posição) com a etiqueta de gol no lugar da GoalCelebration, a correção D5-A do goleiro em `scene.ts` e os testes de geometria, de pixel e de âncora. O resto da coreografia não muda. Depende do ADR.
- **1b, movimento, rastro, cunha e etiqueta do lance:** o modelo de movimento do §6 em `scene.ts`, a parte de regra do `game-designer` (passes anônimos D2-B, posse D4-C, passe do começo do lance D3-B) e os três itens sobre o campo inclinado. O movimento entra junto com a posse porque depende dela (quem ataca e quem defende).
- **2, P:** a etiqueta em espera e a assistência na etiqueta de gol.

## 2. O que não muda

- O campo continua decorativo e `aria-hidden`; a narração e o placar continuam sendo a versão acessível. A etiqueta também é `aria-hidden`.
- **O canvas continua sem texto** (decisão 2 do CEO): a etiqueta é DOM sobre o canvas, e as placas, na recomendação, só têm cores (§4).
- Nada antecipa o desfecho: o começo de um gol e o de uma chance do mesmo lado, tipo e finalizador continuam iguais quadro a quadro, agora com o movimento novo, o rastro, a cunha e a etiqueta (critério 3 do `campo-lances.md`). A câmera é fixa: nenhum movimento de câmera, zoom ou mudança de ângulo, em nenhum passo (D7).
- O mandante fica sempre à esquerda, atacando para a direita, o jogo todo. Na perspectiva, "esquerda" é o gol da esquerda de quem olha.
- Sem tremor, sem zoom, sem flash, sem mudança de cor do campo.
- A coreografia continua em metros e continua uma função pura do passo, do progresso e da semente (`scene.ts`: `x` a partir da linha do gol do mandante, `y` a partir da linha lateral **de longe**, a de cima na tela). Na 1b, o movimento em bloco dá lugar ao modelo do §6, sem mudar o motor.
- O tamanho da caixa do campo e a conta da altura (o maior retângulo 1,5:1 que cabe; `100dvh − 442px` em pé): a narração continua com 4 linhas de lance a 360×740.
- As metas da T-085: quadros p95 ≤ 34 ms, desenho mediano ≤ 6 ms (CPU 4×, 390×844, densidade 3), nenhuma alocação por quadro na cena, chunk do campo ≤ 20 KB gzip, nenhum `requestAnimationFrame` parado.

## 3. Geometria e projeção (fase 1a)

**A câmera.** Fixa, no eixo do meio-campo, atrás da linha lateral de perto, a cerca de 143 m de altura e 157 m atrás da borda de perto do desenho: olha o centro do campo de cima, a cerca de **36°** do gramado. O plano da imagem é vertical, com o quadro deslocado para baixo, então **as verticais continuam verticais** (traves e placas) e a linha lateral de longe é horizontal. Ninguém precisa dessa câmera no código: ela é só o que a fórmula abaixo equivale. A proporção da caixa é fixa (1,5:1), então a câmera é a mesma em qualquer tamanho; só a escala muda.

**Os três números da vista** (constante `PITCH_VIEW` em `app/src/ui/match/pitch/motion.ts`, com comentário apontando para cá; o `developer` pode ajustá-los ao ver no aparelho, sem mudar as regras):

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
k     = s0 × t(v)                                  // px por metro naquele ponto (discos, bola, traves, placas)
```

É uma perspectiva verdadeira (homografia): retas da cena continuam retas na tela, então uma linha do campo, o rastro, a cunha e a base das placas se desenham projetando só os vértices. Os cantos do desenho caem em `(0, Hc)` e `(Wc, Hc)` (perto, a largura toda) e em `(Wc × (1 − farScale)/2, yFar)` e `(Wc × (1 + farScale)/2, yFar)` (longe).

**O que muda em `geometry.ts`.**

- `pitchGeometry(width, height, dpr)` continua calculada uma vez por tamanho, nunca por quadro, e passa a guardar `s0`, `yFar`, `farScale`, a altura e o topo das placas de longe (`boardTop = yFar − boardHeight`, em px), os mínimos em px (disco e bola, abaixo) e as caixas dos dois gols na tela (para a etiqueta, §9).
- Função nova e pura, `project(g, x, y, out)`: escreve `sx`, `sy` e `k` num `Float64Array(3)` que o chamador reaproveita, sem alocação.
- **Disco:** raio `max(2,75 × k, 7 px CSS)`. O mínimo de 14px de diâmetro é o menor disco que a vista de cima já tinha (a 360×640) e mantém a marca do visitante com 4,7px ou mais, a pista de forma que não depende da cor. O anel continua com 2px CSS, por dentro, e a marca com um terço do diâmetro.
- **Bola:** raio `max(1,25 × k, 4 px CSS)`. O mínimo de 8px continua.
- **`clampBall`:** mesma função, agora aplicada **depois** da projeção, ao centro da bola em px: `[r, Wc − r] × [r, Hc − r]`. A projeção já deixa a bola inteira em todos os tamanhos medidos; o `clampBall` fica como rede de segurança.
- **Ordem de desenho por profundidade:** os discos de longe primeiro (`y` menor), para o de perto ficar por cima. Um `Uint8Array(22)` de índices, ordenado por inserção a cada quadro (22 itens, quase sempre já em ordem), sem alocação. A bola continua sempre por cima de tudo.
- **Quem sai pela lateral** (vermelho, lesão sem troca) continua indo 1,5 m além da linha mais próxima; pela lateral de perto, o disco pode ficar cortado pelo pé da caixa no último instante do passo, antes de sumir. Aceito.
- `tagPlacement(g, px, py, r, w, h, out)`, pura, para a posição da etiqueta (§9).

**O fundo, num canvas fora da tela** (redesenhado só quando o tamanho ou o `data-theme` muda, como hoje):

1. A arquibancada de longe, as arquibancadas atrás dos gols e a mureta (§4).
2. O gramado: a caixa inteira abaixo da mureta e entre as filas de placas dos fundos em `pitch`. Fora do trapézio do desenho continua grama, sem marcação; sem faixas alternadas, como hoje.
3. As marcações em `pitch-line`, com traço de `max(1, Wc ÷ 360)` px CSS igual em toda a profundidade: retângulos e linhas pelos vértices projetados; o círculo central, as meias-luas e as marcas pela projeção de uma polilinha de 48 pontos por círculo.
4. Os gols: a rede no chão (os 7,32 × 2 m de hoje, projetados) e, em cada poste, uma trave vertical de `2,44 × k` px de altura, com o travessão ligando os topos, em `pitch-line` com 2px CSS.
5. As três filas de placas (§4).

**A cada quadro:** copiar o fundo, a cunha (§8), o rastro (§7), os 22 discos na ordem de profundidade, o fio da etiqueta (§9) e a bola.

## 4. Arquibancada, mureta e placas (fase 1a)

**Arquibancada de longe** (no canvas do fundo, da borda de cima da caixa até `boardTop`; toda com tokens):

- Fundo em gradiente vertical de `surface-0` (no alto) a `surface-2` (embaixo).
- Fileiras: linhas horizontais de 1px em `line`, a cada 6px embaixo, apertando até 3px no alto, com opacidade de 0,3 no alto a 0,9 embaixo (`globalAlpha`, sem cor nova).
- Cobertura: uma faixa de 10px em `surface-0` no alto.
- Refletores: quatro barras de 18 × 3px a 12%, 37%, 63% e 88% da largura, a 5px do alto. No tema noite, em `floodlight`, cada uma com um halo radial de 52px no token `beam` (proposta 45, §14); no tema dia, apagadas: em `line`, sem halo.
- Sem público, sem pessoas, sem bandeiras, sem nada que lembre um estádio real.

**Mureta:** de `boardTop` até `yFar`, em `surface-1`, por toda a largura.

**Arquibancadas atrás dos gols:** do lado de fora de cada fila de placas dos fundos até a borda da caixa, um polígono em gradiente de `surface-2` (no alto) a `surface-0` (embaixo). Assim as placas ficam entre o gramado e o estádio, como na referência, e não soltas na grama.

**Placas: três filas, no canvas do fundo, só com cores** (a recomendação; a alternativa com nome é a pendência 2):

- **Fundo:** 7 placas iguais, com 1px de intervalo, presas à borda de longe do desenho: largura total `Wc × farScale` (245px a 360px), centrada; altura `boardHeight × Wc ÷ 360` arredondada (12px a 360px, 13px deitado, 20px no desktop); topo em `boardTop`. A borda de longe é horizontal, então cada placa é um retângulo.
- **Atrás de cada gol:** 6 placas de pé sobre a linha `x = −4,5 m` (esquerda) e `x = 109,5 m` (direita), 1,5 m fora da faixa de grama e 2,5 m atrás da rede, cobrindo `y` de −3 a 71 m com 0,6 m de intervalo entre elas. Cada placa é um paralelogramo: a base é o trecho projetado da linha (inclinada, seguindo a lateral do trapézio), e os lados são verticais, com a altura de `boardHeight` convertida em metros na borda de longe (`boardHeight ÷ (s0 × farScale)`, cerca de 5,4 m a 360px) vezes o `k` de cada ponta (12px no fundo, até cerca de 17px perto). Perto, a fila sai da caixa pelo lado; aceito, como na referência.
- **Nunca cobrem o jogo.** Acima de qualquer ponto da lateral do trapézio, a tela já está fora do desenho (a lateral sobe inclinada para dentro), então uma placa de pé sobre a linha de fundo nunca se sobrepõe ao gramado, às traves, à rede, à bola ou aos discos; e, de qualquer modo, ela está no fundo: tudo o que é desenhado a cada quadro fica por cima. A fila de longe fica acima de `yFar`, onde a bola e os discos não chegam (no máximo 1,5 m além da linha lateral, dentro da faixa de grama).
- **Cada placa** é uma marca fictícia de `brandForSlot` (`pitch-boards`, ADR-0015), desenhada só com as duas cores da marca (dado da marca, como as cores do escudo): o fundo na primeira cor e uma faixa central (60% da largura, 26% da altura) na segunda. Sem texto, sem rótulo de publicidade, sem link, não focável; o canvas já é `aria-hidden`. Enquanto a lista de marcas fictícias não existir, pares de tokens (`ink`/`surface-0`, `floodlight`/`on-floodlight`, `surface-1`/`ink`, `grass`/`on-grass`), como no protótipo.
- **Custo:** nenhum por quadro (estão no fundo). No redesenho do fundo, 19 polígonos a mais.

## 5. Tamanhos

A caixa é a mesma de hoje (o maior retângulo 1,5:1); a tabela é a mesma conta da fórmula em cada tamanho.

| Medida (px CSS)                                                 | 360×740 em pé | 844×390 deitado | 1280×800 desktop | 360×640 em pé      |
| --------------------------------------------------------------- | ------------- | --------------- | ---------------- | ------------------ |
| Caixa do campo                                                  | 360 × 240     | 397 × 265       | 600 × 400        | 297 × 198          |
| Estádio de longe (arquibancada, mureta e placas)                | 91            | 101             | 152              | 75                 |
| Gramado (do fundo ao pé)                                        | 149           | 164             | 248              | 123                |
| Placas de longe (altura; largura da fila)                       | 12; 245       | 13; 270         | 20; 408          | 10; 202            |
| Placas dos fundos (altura longe / perto)                        | 12 / 17       | 13 / 19         | 20 / 29          | 10 / 14            |
| Disco perto / longe (mínimo de 14)                              | 18 / 14       | 20 / 14         | 30 / 20          | 15 / 14            |
| Bola perto / longe (mínimo de 8)                                | 8 / 8         | 9 / 8           | 13 / 9           | 8 / 8              |
| Profundidade: px por metro perto / longe                        | 2,9 / 1,4     | 3,2 / 1,5       | 4,9 / 2,3        | 2,4 / 1,1          |
| Etiqueta do lance (altura; acima do disco, com a ponta e o fio) | 48; 60        | 48; 60          | 48; 60           | 40; 52 (uma linha) |
| Etiqueta de gol (altura sem / com assistência)                  | 50 / 66       | 50 / 66         | 50 / 66          | 40 (uma linha)     |
| Topo da trave de longe                                          | 138           | 153             | 230              | 114                |

**Leitura.** A etiqueta cabe acima de qualquer disco em todos os tamanhos: o disco mais ao fundo tem o topo a cerca de 84px a 360×740, e a etiqueta precisa de 60px acima dele. O lado de longe perde mais da metade da resolução em profundidade em relação à vista de cima (3,2 px/m): é o custo que o CEO aceitou ao escolher a perspectiva. Os mínimos de disco e bola seguram a leitura.

**Uma alternativa que não recomendo:** uma caixa mais alta (por exemplo 360 × 270 em pé) daria 168px de gramado, mas tiraria meia linha da narração a 360×740. Fica registrada para o caso de o CEO achar o gramado baixo no aparelho.

## 6. Movimento dos jogadores (fase 1b)

**O que incomodava.** Na T-085, cada disco vai à posição da formação deslocada pela bola com os mesmos pesos (35% no comprimento, 20% na largura), na mesma curva e no mesmo instante: o time anda em bloco, como uma peça só (pedido do CEO, 2026-11-23).

**O modelo.** Em cada passo, cada disco tem **um alvo próprio** (a sua função na formação, puxada pela bola e pela fase do time), **um atraso e um ritmo próprios** e **uma deriva pequena**. Continua uma função pura de (passo, progresso) e da semente da partida, sem alocação por quadro, sem tocar no motor. Os números ficam em `PITCH_MOTION` (`app/src/ui/match/pitch/motion.ts`), com comentário apontando para cá; o `developer` pode ajustá-los no aparelho sem mudar as regras.

**1. Função.** Do `FORMATION_SLOTS` do motor (GK, CB, FB, DM, AM, ST); um ST ou AM cuja vaga fica a 17 m ou mais do meio na largura é **aberto** (W: ponta ou meia aberto).

**2. Fase do time no passo.** Ataque (o time é o dono da bola do passo, D4-C), defesa (o outro) ou neutra (sem dono: começo de cada tempo, intervalo, depois do gol).

**3. Alvo pela função** (`a` = 1 para o mandante, −1 para o visitante; `(bx, by)` = onde a bola termina o passo; a vaga em `(sx, sy)`):

```
x = sx + kx × (bx − 52,5) + a × avanço
y = sy + ky × (by − 34) + fecha × (34 − sy)
```

| Função | `kx` ataque / defesa | `avanço` ataque / defesa (m) | `ky` | `fecha` na defesa | Deriva (m) |
| ------ | -------------------- | ---------------------------- | ---- | ----------------- | ---------- |
| CB     | 0,40 / 0,30          | +4 / −3                      | 0,15 | 0,10              | 0,5        |
| FB     | 0,55 / 0,35          | +10 / −2                     | 0,20 | 0,18              | 0,9        |
| DM     | 0,50 / 0,40          | +3 / −3                      | 0,35 | 0,10              | 0,8        |
| AM     | 0,60 / 0,45          | +6 / −6                      | 0,45 | 0,10              | 1,0        |
| W      | 0,55 / 0,45          | +8 / −10                     | 0,12 | 0,12              | 1,0        |
| ST     | 0,50 / 0,30          | +8 / −2                      | 0,30 | 0                 | 1,1        |

Na fase neutra, `kx` é a média das duas colunas, sem avanço nem fecha. Os zagueiros da mesma linha têm os mesmos pesos, então seguram a linha juntos; os laterais sobem com a posse; os meias acompanham mais a bola; os pontas recuam com o time sem a bola. O alvo fica dentro do campo (de 1 a 104 m e de 1 a 67 m).

**4. Linha do impedimento.** No time com a bola, ST, W e AM não passam da linha do último defensor de linha do outro time menos 0,5 m, no sentido do ataque (exceto quem faz a corrida, item 7).

**5. Pressão e cobertura.** No time sem a bola, o disco de linha mais perto da bola **no começo do passo** vai a 2,5 m dela, na reta entre a bola e o próprio gol; o segundo mais perto vai a 9 m, na mesma reta.

**6. Quem recebe.** O receptor do passe anônimo (D2-B) vai ao ponto de chegada, e a bola termina 1 m à frente dele, no sentido do ataque. Quem passa é o disco do dono mais perto da bola no começo do passo; se for o mesmo disco, é condução (D2-B), sem rastro.

**7. Corrida de ruptura.** Em 35% dos passes dos minutos sem lance (sorteio com o rótulo `m${slot}-run`), o atacante central do time com a bola (o ST mais perto do meio na largura, que não é quem passa nem quem recebe) corre até 3 m além da linha do último defensor, fechando 35% do caminho para o meio. No começo de um lance, quem corre é o finalizador, pela regra de hoje.

**8. Goleiro.** No eixo do gol: profundidade a partir da própria linha de `2 + 0,1 × (distância da bola a essa linha)`, entre 2 e 12 m; largura `34 + 0,25 × (by − 34)`, limitada a ±5 m. No desfecho de defesa, ao ponto da defesa (como hoje); no gol, 60% do caminho até a bola na largura; no chute para fora, 50% até o poste mais perto.

**9. Começo de lance e desfecho.** No começo de lance, os alvos são os do ponto do lance, com o time do lance no ataque; o finalizador segue a regra de hoje (1,5 m atrás da bola, depois a bola, na câmera lenta). No desfecho, o finalizador segue 1,5 m na direção do gol, o goleiro faz o item 8, e os outros seguram.

**10. Tempo de cada um.** Dentro do passo, cada disco anda no seu trecho, com a curva cúbica de hoje:

```
atraso = 0,04 + 0,16 × reação + 0,10 × sorteio      // fração do passo
ritmo  = min(1 − atraso, 0,55 + 0,35 × sorteio')     // fração do passo para chegar
```

A **reação** é fixa por disco na partida (rótulo `react`); os sorteios são por passo e por disco. Quem tem função no passo (receptor, quem pressiona, quem cobre, quem corre, o finalizador, o goleiro na defesa) sai na hora e chega junto com a bola (atraso 0, ritmo 1). No começo de lance, todos se ajeitam na primeira metade do avanço, antes da câmera lenta. **Todos chegam ao alvo no fim do passo**, então o passo seguinte começa onde este terminou: nada salta.

**11. Deriva.** Por eixo, `amplitude × (0,7 × sen(2π f₁ τ + φ₁) + 0,3 × sen(2π f₂ τ + φ₂))`, com a amplitude da tabela, `f₁ = 0,23 Hz` e `f₂ = 0,61 Hz` vezes um fator do disco (de 0,85 a 1,15), fases do disco, e `τ` = o relógio da partida em segundos do ritmo Normal (a soma das durações Normais dos passos anteriores mais o progresso vezes a duração Normal do passo; contínuo entre passos). Quem tem função no passo não deriva: o peso da deriva vai de 0 a 1 (ou de 1 a 0) com a curva do passo, sem salto; assim o receptor chega exatamente à bola.

**12. Sorteios e semente.** Os sorteios por passo e por disco saem de uma função de espalhamento inteira, sem estado, de `(semente da partida, passo, disco)` (ou do `Rng` com rótulo `${seed}-pitch-…`, calculados ao montar a coreografia). Os sorteios de hoje (`m${slot}`, `-build`, `-outcome`) não mudam de valor por causa dos novos.

**Honestidade e desfecho.** O movimento usa só o dono da bola (D4-C, que bate com a posse da súmula), o lado e o ponto do lance: não sugere domínio que o motor não calculou. No começo de lance, tudo depende do lado, do finalizador, do tipo e do ponto (rótulo `-build`) e da pose de partida, nunca do desfecho: o começo do gol e o da chance continuam iguais quadro a quadro.

**Movimento reduzido.** Nada disso anima: o quadro parado de cada passo com linha na narração continua com os times nas posições da formação (regra da T-085), sem deriva.

**Custo.** Por quadro e por disco: uma interpolação, uma curva cúbica e quatro senos (ou dois espalhamentos inteiros, se o atraso e o ritmo não forem guardados no passo): menos de 0,05 ms para os 22 com CPU 4×. Na coreografia, por passo, os alvos (46 números) e uma máscara de bits de quem tem função (um inteiro), como as poses de hoje: cerca de 100 KB por partida. No chunk, de 1,5 a 2 KB gzip.

## 7. Item 1: rastro da bola (fase 1b)

**O que é.** O caminho que a bola fez **no passo atual**, de onde ela saiu até onde ela está, com a bola andando na ponta. É o "passe" da referência, mas sem afirmar quem passou: nos minutos sem lance, um passe anônimo entre dois discos do time com a bola (D2-B); no começo de um lance de jogada, o passe anônimo que chega ao finalizador (D3-B); no desfecho e na chance fraca, o chute.

| Passo                                             | Rastro                                                                           |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| Minuto sem lance com passe (D2-B)                 | de onde a bola saiu até a bola                                                   |
| Minuto sem lance com condução (o mesmo disco)     | nenhum (a bola anda sozinha, como hoje)                                          |
| Começo de lance de jogada                         | do companheiro anônimo até a bola (D3-B)                                         |
| Começo de falta e de pênalti                      | nenhum (a bola vai ao ponto, como hoje)                                          |
| Desfecho, chance fraca (o voo)                    | do ponto do lance até a bola; na trave, uma linha quebrada (ponto, poste, volta) |
| Depois do gol, começo, intervalo, 2º tempo        | nenhum (a bola volta ao centro sem rastro)                                       |
| Vermelho, lesão, troca, mudança tática, acréscimo | nenhum                                                                           |

O rastro **vive o passo em que nasceu**: some no começo do passo seguinte, sem animação. Pausada (no fim de um passo), a partida mostra o rastro daquele passo inteiro.

**Desenho.** A origem e a bola (e o poste, na trave) projetados (§3) e ligados por uma linha de 2px CSS em `ink`, pontas e juntas redondas, com um ponto de 5px de diâmetro em `ink` na origem. A espessura é a mesma em toda a profundidade. Por cima do gramado e da cunha, por baixo dos discos; a bola por cima de tudo. O `ink` sobre `pitch` dá 5,94:1 (noite) e 4,09:1 (dia), o par do anel e da bola. Ele se distingue das marcações (`pitch-line`, 1px) pela espessura, pelo ponto de origem e porque segue a bola.

**Desempenho.** Um `stroke` de até 4 pontos e um `arc` por quadro, com os pontos num `Float64Array` de tamanho fixo escrito pela cena: menos de 0,1 ms por quadro com CPU 4×.

## 8. Item 4: cunha do ataque (fase 1b)

**O que é.** Um triângulo translúcido com o vértice na bola, apontado para o centro do gol que o time com a bola ataca, até a linha desse gol. Diz "quem está com a bola e para onde vai" sem cor de time. O CEO pediu para manter ("a sombra que indica qual lado está atacando").

**Dono e direção.** Do `campo-lances.md`, D4-C: nos lances, o `side` do evento; nos minutos sem lance, a cota de posse que bate com a da súmula. A direção é a do lado.

**Desenho.**

- **Em metros:** vértice no centro da bola; eixo da bola ao centro do gol atacado; meia-abertura de 26°; até a linha do gol atacado; recortado ao retângulo de jogo (105 × 68). Na tela, os três vértices projetados, e o recorte é o trapézio do retângulo de jogo projetado. Na perspectiva, a cunha estreita ao longe, como a sombra da referência.
- Gradiente linear ao longo do eixo **na tela**, do token `pitch-wedge` no vértice projetado até transparente no centro do gol projetado.
- **`pitch-wedge`** (proposta 42, aprovada): noite `rgba(4, 18, 10, 0.45)` (sombra); dia `rgba(255, 255, 255, 0.35)` (luz). A cunha sempre **afasta o gramado do `ink`**: no vértice, o `ink` sobre o gramado com a cunha dá 10,96:1 (noite, 5,94 sem ela) e 7,35:1 (dia, 4,09).
- Logo depois do fundo copiado e antes do rastro e dos discos.

**Quando aparece.** Em todo passo com dono (D4-C), também nos minutos sem lance. Some no começo do passo de desfecho e no gol, na volta ao centro, no começo de cada tempo e no intervalo; volta no passo seguinte com dono. Com a bola a menos de 3 m da linha do gol atacado, não é desenhada.

**Tempos.** Quando o dono muda, a cunha nova entra com opacidade de 0 a 1 em 200 ms (`globalAlpha`), e a antiga sai de uma vez. O dono troca a cada 4,1 minutos em média (cerca de 3 s no Normal).

**Desempenho, sem alocação.** O gradiente é criado **uma vez** por tamanho e tema, num eixo local de (0, 0) a (1, 0). A cada quadro, com o vértice `a` e o fim `e` já projetados, comprimento `len` e ângulo `θ` do segmento, `setTransform(cos θ·len, sin θ·len, −sin θ·len, cos θ·len, ax, ay)` (vezes a densidade), e os três vértices projetados passam para o eixo local pela inversa (`R(−θ)·(p − a) / len`) antes do `fill`. Mais `save`/`clip`/`restore`. De 0,1 a 0,3 ms por quadro com CPU 4×.

## 9. Item 2: etiqueta do lance (fase 1b; a âncora e o componente na 1a)

**O que é.** A linha da narração em miniatura, **saindo do jogador**: a camisa dele com o número, o tipo do lance e o nome, numa pílula presa a ele por uma ponta e um fio. Só para quem está num evento do motor (D1-A).

**Por que presa ao jogador, e não fixa no alto.** É o que a referência faz e o que o CEO pediu para o gol; usar a mesma regra no lance e no gol deixa uma etiqueta só, que sempre aponta quem é. A pista do time passa a ser o próprio disco a que ela está ligada (com ou sem a marca do visitante), além da narração.

**Posição** (função pura `tagPlacement`, §3, a cada quadro):

1. Em cima do disco do jogador, centrada no `x` dele: a base da pílula fica 12px acima do topo do disco (7px de ponta e 5px de fio).
2. Presa na caixa: `x` entre `space-2` e `Wc − space-2 − largura`; o topo nunca acima de 4px.
3. **Nunca cobre um gol:** se a pílula cruzar, na altura, a caixa de um dos gols na tela (traves, travessão e rede projetados, com 6px de margem), ela é empurrada para o lado de dentro (para o meio do campo) até não cobrir; depois, presa na caixa de novo.
4. **A ponta** fica no `x` do jogador, limitada a 20px das pontas da pílula: perto da borda ou do gol, a pílula vira para o lado de dentro e o fio sai inclinado.
5. **O fio** é desenhado no canvas (é traço, não texto), de 1,5px em `ink`, da ponta ao topo do disco, depois dos discos e antes da bola.
6. Ela segue o jogador a cada quadro. A largura e a altura são medidas **uma vez** por etiqueta; a posição vai para o DOM como `transform` só quando muda mais de 0,5px (é a única escrita no DOM por quadro, e nada de layout).

O que ela pode cobrir por instantes: os discos logo acima do jogador e, no passe do começo do lance, a bola que vem de cima dele. O que ela nunca cobre: os gols, o próprio jogador e a bola no pé dele.

**Desenho** (protótipo v2, capturas 2 e 4).

- Pílula em `surface-1`, borda de 1px em `line`, `radius-pill` e `shadow-card`; a ponta, um triângulo de 12 × 7px na cor da pílula. Respiro `space-1` em cima, embaixo e do lado da camisa; `space-3` do lado do texto.
- **Camisa:** um círculo de 40px em `surface-2` com a camisa do uniforme do jogador (o `kitSvg` do gerador da T-026, só a camisa, 34 × 22px; o goleiro com a de goleiro) e, por cima, o número (`Player.shirt`) em `numero` com `tabular-nums`, na `numberColor` do uniforme; com a `numberPlate`, sobre uma placa nessa cor, com 4px de raio (contrato de [uniformes.md](../../art/uniformes.md) §3: o número sempre com 4,5:1 contra o que está atrás dele). Para só a camisa, o `kitSvg` ganha uma opção aditiva (`part: 'shirt'`, a `viewBox` `0 0 64 42`); pedido ao `art-director` e ao `developer`, sem efeito no save nem no motor.
- **Texto, em duas linhas:** o tipo em `rotulo` (caixa alta), em `ink-muted`; o nome (`name.display`) em `body-strong`, em `ink`. Pares já conferidos sobre `surface-1`.
- **Largura máxima:** 60% da largura da caixa (216px a 360px; cerca de 150px para o nome). O nome quebra em até 2 linhas e nunca corta. Altura: 48px com uma linha de nome, 70px com duas.
- **Abaixo de 200px de altura da caixa** (360×640): uma linha só (a camisa e o nome, sem o tipo), 40px.
- Sem `backdrop-filter`.

**Quando aparece, e com que tipo** (decisões 4 e 5 do CEO): só lances com bola e vermelho.

| Passo                                                        | Tipo (chave)                                                  | Âncora (disco do…) |
| ------------------------------------------------------------ | ------------------------------------------------------------- | ------------------ |
| Começo de lance de jogada                                    | `match.live.shot` ("Finalização")                             | finalizador        |
| Começo de falta                                              | `match.live.freeKick` ("Falta")                               | cobrador           |
| `penaltyAwarded`                                             | `match.live.penalty` ("Pênalti")                              | cobrador           |
| Desfecho: defesa, trave, fora; pênalti perdido; chance fraca | `match.tag.saved`, `match.tag.post`, `match.tag.wide` (novas) | finalizador        |
| Desfecho: gol                                                | a etiqueta de gol (§10)                                       | artilheiro         |
| Vermelho                                                     | `report.event.red` ("Vermelho")                               | expulso            |

**Âncora: sempre o jogador certo** (pergunta do CEO, 2026-11-23; critério de aceite):

- A etiqueta ancora no **disco que representa o jogador do evento** (finalizador, artilheiro, cobrador ou expulso) e mostra o nome e o número **desse** jogador: o mesmo `PlayerId` dá o disco, o nome e o `Player.shirt`.
- O vínculo entre disco e jogador é o `Field.owner` da coreografia, que segue a escalação real em campo naquele minuto: os 11 titulares na ordem das vagas; numa troca, o disco passa a ser de quem entrou; no vermelho e na lesão sem troca, o disco sai no fim do passo.
- **A bola vai a esse mesmo disco:** no começo do lance, o contato (o fim da câmera lenta) põe a bola no disco da âncora; no pênalti, o cobrador é o disco que chega à marca; no desfecho, a bola sai dele.
- **O expulso:** a etiqueta entra no passo do vermelho, presa ao disco enquanto ele anda até a linha lateral; quando o disco sai, no fim do passo, a etiqueta fica no último ponto dele, sem fio, até o tempo mínimo, e sai.
- **O goleiro que sai sem troca (D5-A do `campo-lances.md`, corrigido na fase 1a):** hoje o campo põe no gol o jogador da última vaga ocupada; o motor põe o jogador de linha em campo de maior `physical` (empate na primeira vaga). A coreografia passa a seguir o motor: o disco do goleiro passa ao jogador de linha em campo de maior `attributeOf(player, 'physical')` (empate no menor índice de disco), e o disco desse jogador sai pela lateral. O caso que a regra não cobre (troca de formação antes da saída do goleiro, que reordena as vagas pela energia que a tela não conhece) é o D5-B: a etiqueta da defesa já não leva o goleiro (decisão 4), então nenhum nome errado aparece.
- **Sem disco:** a função de hoje `discOf` devolve "o último disco de linha em campo" quando não acha o jogador. Para a etiqueta, isso seria apontar o jogador errado: sem disco do jogador do evento (só com save danificado), **não há etiqueta**, e o caso é registrado como erro de programação em `lib/errors`.

**Tempos.**

- **Entrada:** opacidade de 0 a 1 e escala de 0,92 a 1 a partir da ponta, em 160 ms `ease-out`, no `onreveal` do passo.
- **Mesmo jogador, tipo novo** (do começo ao desfecho do mesmo lance): só o texto do tipo muda, no lugar.
- **Outro jogador:** a etiqueta nova substitui a anterior na hora e entra como acima.
- **Saída:** fica até ser substituída ou até o começo do primeiro passo sem etiqueta que comece pelo menos **1,6 s (Normal) ou 0,8 s (Rápido)** depois da entrada; aí sai com opacidade de 1 a 0 em 120 ms. Saindo, para de seguir o jogador e perde o fio.
- **Pausa:** pausada, a etiqueta do momento fica.
- As durações ficam escritas no componente, com comentário apontando para cá, até o grupo de movimento dos tokens existir.

**A etiqueta em espera (fase 2).** No começo de um lance de jogada, a narração já nomeia o finalizador, e o passe anônimo vai até ele (D3-B). A etiqueta entra com o nome em `ink-muted` e passa para `ink` quando a bola chega ao finalizador (o fim do primeiro trecho da cena: 35% do tempo na pausa dramática). Igual para gol e chance. Na falta e no pênalti, entra já acesa; com movimento reduzido, também. É a versão honesta do "próximo jogador, apagado" da referência: lá é um fato que o app tem; aqui, mostrar quem vem antes de o lance começar entregaria o lance.

**Movimento reduzido.** A etiqueta aparece e some sem transição, presa ao disco no quadro parado (o disco na posição da formação); o tempo mínimo na tela continua.

**Leitor de tela.** `aria-hidden="true"`: tudo o que ela diz está na linha da narração do mesmo passo. Nada entra na região viva.

**Idiomas.** Medido em `rotulo`: o mais largo dos tipos que já existem é "Finalização", 65,4px; as sugestões novas, de 25,8 ("Wide") a 70,8px ("Off the post"). Os `match.tag.*` com no máximo 140px nos três idiomas.

**Componente.** `PitchTag.svelte` em `app/src/ui/components/` (casca do `ux-designer`, no chunk do campo), props: `tone: 'play' | 'goal'`, `kind: string` (texto pronto), `name: string`, `assist?: string` (fase 2), `shirt?: number`, `kitSvg: string`, `number: { color: string; plate: string | null }`, `waiting?: boolean` (fase 2), `compact?: boolean`. A posição vem de fora (a tela aplica o `tagPlacement`); quem decide qual etiqueta mostrar e quando é a tela.

## 10. Comemoração de gol: a etiqueta de gol (fase 1a)

**O pedido do CEO** (2026-11-23): o cartão grande da comemoração parecia uma notificação; melhor algo saindo do jogador, como na referência. A GoalCelebration (cartão em `surface-1` com escudo `md` e "Gol!" em `display-lg`, proposta 39) **sai**, e o gol vira a **etiqueta de gol**: a mesma `PitchTag` do §9, com `tone="goal"`, presa ao artilheiro pelas mesmas regras de posição (nunca cobre um gol, nunca sai da caixa, vira para dentro perto da borda).

**Desenho** (protótipo v2, captura 3).

- Pílula em `grass`, borda em `grass`, ponta em `grass`; texto em `on-grass` (o par do botão primário, conferido pelo `npm run tokens`). O círculo da camisa em `surface-1`, com o número como no §9.
- **"Gol!"** (`match.celebration.title`) em `numero`, caixa alta, na primeira linha; o **artilheiro** em `body-strong` na segunda; na fase 2, **"Assistência de {player}"** (`match.celebration.assist`) em `caption`, `on-grass`, na terceira.
- Altura: 50px sem a assistência, 66px com; largura até 60% da caixa. Abaixo de 200px de altura da caixa: "Gol!" e o nome numa linha só, sem a assistência (40px).
- Sem escudo: a camisa com o número já identifica, e a linha da narração do gol tem o escudo e o nome do clube.

**Tempos.** Entra no desfecho do gol com escala de 0,92 a 1 e opacidade de 0 a 1 em 200 ms `ease-out`, a partir da ponta (o que a proposta 39 já fazia); fica o passo "depois de um gol" inteiro, seguindo o artilheiro; sai sem animação no começo do passo seguinte. A etiqueta do lance que estava no artilheiro é trocada por ela no mesmo lugar.

**Movimento reduzido.** Aparece e some parada.

**Leitor de tela.** Nada muda: a etiqueta é `aria-hidden`, e o anúncio do gol continua na região viva do placar (`match.live.goal.a11y`). O som (T-047) e a vibração (T-041) continuam no mesmo ponto de revelação.

## 11. Temas e movimento reduzido

**Tema noite (padrão):** arquibancadas em `surface-0` → `surface-2`, fileiras em `line`, refletores acesos (`floodlight` com halo `beam`), mureta `surface-1`, gramado `pitch`, marcações `pitch-line`, cunha escura, anel, bola, rastro e fio da etiqueta em `ink` claro.

**Tema dia:** os mesmos papéis com os tokens do dia: as arquibancadas claras, os refletores apagados (em `line`, sem halo), a cunha clara e o `ink` escuro. O estádio perde a cara de noite; ver a pendência 1 (§16).

**Troca de tema no meio da partida:** o fundo (com as placas) é redesenhado uma vez, e o gradiente da cunha também.

**Movimento reduzido** (regra da T-085, sem mudança): o campo fica parado, com um quadro só a cada passo com linha na narração e nenhum `requestAnimationFrame` entre eles. No quadro: os times nas posições da formação, projetados, sem deriva; a bola no ponto de chegada do passo; o rastro **inteiro** daquele passo, parado; a cunha do dono daquele passo, sem a entrada de 200 ms; a etiqueta (do lance ou de gol) sem transição, presa ao disco. A câmera nunca se move. As arquibancadas e as placas são paradas por natureza.

## 12. Desempenho e orçamento

| Item                               | Hoje (medido, CHANGELOG da T-085) | Fase 1a (estimativa)                                                        | Fase 1b (estimativa)                                            | Meta                                  |
| ---------------------------------- | --------------------------------- | --------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------- |
| Chunk do campo (JS + CSS, gzip)    | 7,1 KB                            | +3 a 5 KB (projeção, fundo, três filas de placas, etiqueta e posição, D5-A) | +3,5 a 5 KB (movimento, rastro, cunha, regras de posse e passe) | ≤ 20 KB                               |
| Desenho de um quadro (mediana)     | 0,5 ms                            | +0,2 ms (24 projeções, ordenação, fio da etiqueta)                          | +0,5 ms (movimento, cunha com recorte, rastro)                  | ≤ 6 ms                                |
| Intervalo entre quadros (p95)      | 16,8 ms                           | sem mudança esperada                                                        | sem mudança esperada                                            | ≤ 34 ms                               |
| Redesenho do fundo (tamanho, tema) | não medido                        | de 5 a 15 ms com CPU 4× (fileiras, polilinhas, placas)                      | —                                                               | ≤ 30 ms, nunca tarefa longa (> 50 ms) |
| Imagens e precache                 | nenhuma imagem                    | nenhuma imagem                                                              | nenhuma imagem                                                  | —                                     |

Total estimado ao fim da fase 1: de 13 a 17 KB gzip no chunk do campo e de 1 a 1,5 ms de mediana por quadro. Se uma meta passar, volta ao `architect` antes de a tela virar tela de espera.

## 13. Medidas para os testes

**Vitest (1a), geometria** (`geometry.test.ts`, reescrito):

1. Os quatro cantos do desenho caem onde o §3 diz (tolerância de 0,5px), em 360×240, 397×265, 600×400 e 297×198.
2. Profundidade monótona: para `y` crescente, `sy` cresce e `k` cresce.
3. Retas continuam retas: três pontos alinhados na cena continuam alinhados na tela (tolerância de 0,5px).
4. Mínimos: raio do disco ≥ 7px CSS e da bola ≥ 4px CSS em todo o desenho, nos quatro tamanhos.
5. `project` e `tagPlacement` são puras e não alocam.
6. A bola, em qualquer ponto a até 1,5 m da borda do desenho, fica inteira no canvas depois da projeção.
7. Placas: nenhum vértice das placas dos fundos fica dentro do trapézio do desenho; a fila de longe fica acima de `yFar`.
8. `tagPlacement`, numa grade de posições de jogador nos quatro tamanhos e com as duas alturas de etiqueta: a pílula fica inteira na caixa, não cruza a caixa de nenhum gol, e a ponta fica a no máximo 20px das pontas da pílula.

**Vitest, âncora: sempre o jogador certo** (1a para o gol, o vermelho e o D5-A; 1b para os lances; com o `qa-engineer`):

1. **Em 200 partidas simuladas** (sementes fixas, escalações reais, com trocas, vermelhos e lesões), para todo passo com etiqueta, o disco-âncora é o disco cujo dono, naquele passo, é o jogador do evento. O dono de referência é calculado no teste de forma independente da coreografia: os titulares na ordem das vagas, refeitos evento a evento (troca: quem entra fica com a vaga de quem saiu; vermelho e lesão sem troca: a vaga fica vazia; goleiro que sai sem troca: a regra do motor, maior `physical`).
2. **O expulso:** o critério vale no passo do vermelho, com o disco ainda em campo (`on[d] === 1`).
3. **Nome e número:** o nome da etiqueta é igual ao da linha da narração do mesmo passo, e o número é o `Player.shirt` do mesmo `PlayerId`.
4. **A bola no disco:** no fim do começo de cada lance (contato), a bola fica a no máximo 0,1 m do disco-âncora; no pênalti, o disco-âncora é o que está na marca.
5. **D5-A:** num caso montado à mão (goleiro expulso sem troca), o disco do goleiro passa ao jogador de linha em campo de maior `physical`; nas 200 partidas, todo caso de goleiro sem troca bate com o goleiro que o motor usa nas defesas seguintes.
6. **Sem disco:** com um evento de um jogador fora de campo (montado à mão), não há etiqueta, e o erro é registrado.

**Vitest (1b), movimento:**

1. Determinismo: a mesma partida dá a mesma cena em qualquer `(passo, progresso)`.
2. Nada salta: a posição de cada disco no fim de um passo é igual (até 1 mm) à do começo do seguinte, com a deriva.
3. Todos chegam: no fim de cada passo, cada disco está no seu alvo mais a deriva; `atraso + ritmo ≤ 1` sempre.
4. O receptor chega à bola: no fim de cada passe, a bola está a 1 m (± 0,1) do receptor, no sentido do ataque.
5. Pressão: no fim de cada passo com dono, há um disco do outro time a no máximo 3 m da bola.
6. Impedimento: no fim de cada passo com dono, nenhum ST, W ou AM do time com a bola passa a linha do último defensor, salvo quem corre.
7. Goleiro: sempre a no máximo 12 m da própria linha e a ±5 m do meio na largura, fora o desfecho de defesa.
8. Velocidade: nenhum disco anda mais de 10 m por segundo de relógio Normal (nada de teletransporte).
9. Nada antecipa o desfecho: o teste dos 11 pontos cobre o movimento novo, a origem do rastro, a cunha e a etiqueta (na fase 2, também o instante em que o nome acende).
10. Sem alocação: `sceneAt` continua escrevendo no mesmo objeto.

**E2E (Playwright, como os da T-085):**

1. **Desempenho** (1a e 1b): quadros p95 ≤ 34 ms e desenho mediano ≤ 6 ms a 390×844, densidade 3, CPU 4×, 15 s de "Animada completa" no Normal.
2. **Redesenho do fundo:** trocar o tema no meio da partida não gera tarefa longa (> 50 ms).
3. **Pixels** (substitui o item 11 da T-085 e o do E2E offline, que liam um canto em `--pitch`): o pixel do meio da borda de baixo do canvas fica em `--pitch` (a faixa de grama de perto); o do canto de cima à esquerda, em `--surface-0` (a cobertura). Nos dois temas. Os cantos de baixo deixam de servir: dependendo do tamanho, caem na grama, numa placa dos fundos ou na arquibancada atrás do gol.
4. **Etiqueta de gol** (1a): `aria-hidden`; aparece no desfecho do gol e some no passo seguinte; inteira dentro da caixa; o anúncio do gol continua na região viva do placar.
5. **Etiqueta do lance** (1b): `aria-hidden`; nunca num passo `minuteFull`; o texto é o da linha da narração do mesmo passo; inteira dentro da caixa a 360×740, 844×390 e 1280×800; uma linha só a 360×640.
6. **Movimento reduzido:** sem transição na etiqueta e na cunha; nenhum `requestAnimationFrame` entre lances (como hoje).
7. **Chunk** (`tests/regression/match-chunks.test.ts`): o do campo com no máximo 20.000 bytes gzip, e nenhum arquivo de imagem novo no fecho dele.

## 14. Design system e textos

**Propostas** (numeração de [componentes.md](componentes.md#propostas-ao-design-system); registro lá e no `design-system.md` na implementação):

41. **Etiqueta do lance no campo: aprovada**, agora presa ao jogador (§9). Revoga o "nenhum número ou texto no campo" da decisão 11 da T-032; o canvas continua sem texto; sobre ele, fora do canvas, **uma** etiqueta `aria-hidden` com a camisa, o número, o tipo e o nome de quem está no evento do passo, ligada ao disco dele.
42. **Token `pitch-wedge`: aprovada.** Noite `rgba(4, 18, 10, 0.45)`, dia `rgba(255, 255, 255, 0.35)`, só na cunha; o `npm run tokens` confere o `ink` sobre o `pitch` com a cunha ≥ 3:1 nos dois temas.
43. **Rastro da bola** (aprovado com a fase 1): linha de 2px em `ink` com ponto de origem, só no passo em que nasce, inteira e parada com `prefers-reduced-motion`. Sem token novo.
44. **Assistência no gol: aprovada**, na fase 2; agora como a terceira linha da etiqueta de gol (§10).
45. **`beam` também no jogo (nova, para o CEO):** usar o token, hoje "só no site", nos halos dos refletores da arquibancada do campo, no tema noite, decorativo, nunca sob texto. Sem valor novo.
46. **Campo inclinado e placas (nova, para o CEO, junto do ADR):** a regra "Campo da partida" passa de "campo deitado, visto de cima" para "campo inclinado por código (§3), com arquibancadas, mureta e três filas de placas só com cores no canvas do fundo, e a etiqueta em DOM sobre ele". Sem token novo.
47. **Etiqueta de gol no lugar da comemoração (nova, para o CEO):** a GoalCelebration (proposta 39) sai; o gol é a `PitchTag` com `tone="goal"` (`grass` e `on-grass`, par conferido), presa ao artilheiro (§10). Sem token novo.

**Textos novos** (para o `content-writer`; o lote passa pelo CEO):

| Chave                      | pt-BR (sugestão)          | Uso                                       |
| -------------------------- | ------------------------- | ----------------------------------------- |
| `match.tag.saved`          | "Defendida"               | tipo da etiqueta no desfecho de defesa    |
| `match.tag.post`           | "Na trave"                | idem, trave                               |
| `match.tag.wide`           | "Para fora"               | idem, para fora                           |
| `match.celebration.assist` | "Assistência de {player}" | fase 2, terceira linha da etiqueta de gol |

Reaproveitadas: `match.live.shot`, `match.live.freeKick`, `match.live.penalty`, `report.event.red`, `match.celebration.title`. Limite de 140px em `rotulo` para os `match.tag.*`.

**Atualizações em [partida.md](partida.md) na implementação** (no PR de cada fase, pelo `ux-designer`): "Desenho", "Tamanhos", "Coreografia", "Comemoração", "Placas", "Marcas do cenário" e "Medidas para o E2E" passam a apontar para este arquivo.

## 15. Decisões do CEO (2026-11-23)

1. **Fases:** aprovadas. Fase 1: rastro, etiqueta e cunha, no campo inclinado (item 6), com os passes anônimos e a posse do `campo-lances.md`. Fase 2: etiqueta em espera e assistência na comemoração. (A divisão da fase 1 em 1a e 1b, no §1, é só para cada PR caber em M.)
2. **Proposta 41 (etiqueta no campo): aprovada.** Fica revogada a parte "nenhum número ou texto no campo" da decisão 11 da T-032; o canvas continua sem texto.
3. **Proposta 42 (token `pitch-wedge`): aprovada.**
4. **Etiqueta da defesa:** finalizador e "Defendida" na fase 1.
5. **Eventos com etiqueta:** só lances com bola (finalização, gol, pênalti) e cartão vermelho.
6. **Perspectiva (revista pelo CEO no mesmo dia):** o CEO prefere a vista parecida com a referência. Entra a **saída A, campo inclinado por código**, já na fase 1, no lugar da vista de cima; sem fundo ilustrado. Muda o "visto de cima" do `docs/PROJETO.md`, então pede ADR antes da implementação. A cunha do ataque continua, por pedido explícito do CEO ("a sombra que indica qual lado está atacando").
7. **Placas:** com a perspectiva, uma fila de placas no fundo, só com marcas fictícias (ADR-0015); nenhuma na faixa de grama.
8. **Proposta 44 (assistência na comemoração): aprovada**, na fase 2; sem "replay" da assistência no campo.

**Pedidos do CEO depois do protótipo (mesmo dia), atendidos nesta versão:** mais variedade no movimento (§6); o gol como etiqueta saindo do jogador, no lugar do cartão grande (§10, proposta 47); placas também atrás dos gols (§4); etiquetas sempre no jogador certo, com critério de aceite (§9 e §13).

## 16. Pendências para o CEO

1. **Arquibancada no tema dia:** seguir o tema (estádio claro, refletores apagados; sem token novo) (recomendo), ou estádio sempre à noite (dois tokens novos só para a arquibancada).
2. **Placas com nome ou só com cores:** recomendo **só cores**, como o ADR do `architect`. A 360px as placas têm de 10 a 17px de altura (de longe e dos fundos), e um nome nelas fica com 6 a 8px, ilegível; nas placas dos fundos, inclinadas, o texto ainda sai torto (o protótipo v2 tem a alternância "Placas: só cores / com nome" para comparar). Só cores, tudo fica no canvas do fundo, sem texto e sem custo por quadro; com nome, as placas teriam de ir para o DOM (a de longe como retângulo, as dos fundos com uma matriz CSS por placa), e a regra "canvas sem texto" se mantém, mas com mais código e letras que ninguém lê. Se um dia valer a pena, o nome entra só na fila de longe e só a partir de 900px de largura (20px de placa).
3. **As marcas das placas:** mesmo só com cores, as placas mostram marcas fictícias da lista (as duas cores de cada marca), que é conteúdo da T-040 e passa pelo CEO. Recomendo **antecipar o lote da lista** para a fase 1a; até lá, pares de tokens, como no protótipo. Placas vazias não, porque lembrariam espaço à venda (ADR-0015).
4. **Propostas 45 (`beam` no jogo), 46 (campo inclinado e placas) e 47 (etiqueta de gol no lugar da comemoração):** recomendo aprovar as três.
5. **Altura da caixa:** manter 1,5:1 (149px de gramado a 360×740, 4 linhas de narração) (recomendo), ou uma caixa mais alta, com meia linha de narração a menos.
6. **A etiqueta presa ao jogador cobre por instantes os discos logo acima dele** (de 1 a 2 s por lance). Recomendo aceitar: é o que a referência faz, e o lance (o jogador, a bola no pé dele e o gol) fica sempre à vista.

## 17. Maquetes e protótipo

Tudo fora do repositório, no scratchpad da sessão, com clubes fictícios do jogo (Cruzador x Miragol) e escudos, uniformes e nomes dos geradores do próprio jogo; nenhum escudo, nome ou marca real. As placas mostram só o nome do jogo e marcas abstratas.

- **Protótipo v2:** `prototipo-v2.html`, um arquivo só, sem nada externo (fontes do jogo embutidas), a 360×740, cerca de 33 s em loop no ritmo Normal. Tem o movimento do §6, a etiqueta presa ao jogador (lance e gol), a etiqueta em espera, as placas nas três filas e a alternância "Placas: só cores / com nome", além de tema dia, movimento reduzido e recomeçar; "Pausar" e "Rápido" funcionam. O número da etiqueta é sempre o do disco de onde ela sai. Simplificações: o protótipo sempre mostra um passe nos minutos sem lance (D2-B permite condução), não tem intervalo, trocas nem vermelho.
- **Capturas do v2** (densidade 2): `v2-1-passe-movimento.png`, `v2-2-finalizacao-etiqueta.png`, `v2-3-gol-etiqueta.png`, `v2-4-tema-dia.png`, `v2-5-placas-so-cores.png`, `v2-6-placas-com-nome.png`; e o vídeo de 8 s do lance do gol, `v2-video-gol.webm` (e `v2-video-gol.gif`).
- **Protótipo v1** (`prototipo.html` e as capturas `proto-*.png`): o movimento em bloco e a comemoração em cartão, para comparar.
- **Maquetes estáticas da proposta original:** `a-vista-de-cima.png` a `i-etiqueta-em-espera.png` e `comparativo-a-b-c.png`.

## 18. Anexo: as saídas estudadas para a perspectiva

Registro do estudo que levou à decisão 6; não é mais escolha aberta.

- **A. Inclinar por código (escolhida):** projeção feita à mão (§3), discos redondos menores ao longe, arquibancada e placas por código. Nenhuma imagem; menos de 0,3 ms a mais por quadro. A transformação por CSS (`perspective()` e `rotateX()` no canvas) foi descartada: achata os discos e a marca do visitante, desfoca o lado de perto e deixa a tela sem saber onde cada ponto caiu.
- **B. Fundo ilustrado (ComfyUI na máquina do CEO, pelo `art-director`):** só a arquibancada numa imagem, com o resto da saída A. De 75 a 360 KB a mais no precache para todos os jogadores, revisão de arte a cada ajuste de enquadramento, cores fora do `npm run tokens`. Descartada pelo CEO.
- **C. Não fazer (a vista de cima):** a melhor legibilidade a 360px (3,2 px/m em toda a profundidade, discos de 18px), sem custo. Era a recomendação do `ux-designer`; o CEO preferiu a vista da referência.
