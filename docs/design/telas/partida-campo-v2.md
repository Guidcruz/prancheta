# Partida: campo v2 (campo inclinado, rastro, etiqueta e cunha)

**Estado:** decidido pelo CEO em 2026-11-23 (§15), com a perspectiva revista no mesmo dia: o campo passa a ser **inclinado por código**, já na fase 1, no lugar da vista de cima. Sem código de produção ainda. Ainda falta o ADR do "visto de cima" do `docs/PROJETO.md` (o `architect` escreve em paralelo), e a implementação espera por ele. **Parte:** o visual. A regra de jogo e a honestidade dos dados (quem ganha nome, de onde vêm a posse e a direção) são do `game-designer`, em [../campo-lances.md](../campo-lances.md); este arquivo segue as recomendações de lá (D1-A, D2-B, D3-B, D4-C, D6-A, D7) e aponta onde diverge. **Base:** [partida.md](partida.md) ("Campo 2D (T-085)", "Movimento", "Acessibilidade", "Desempenho no celular"), [../design-system.md](../design-system.md) ("Campo da partida"), [../../art/uniformes.md](../../art/uniformes.md) e a §4.7 de [../../02-architecture.md](../../02-architecture.md). **Referência:** prints de um app real de lance a lance, só pela mecânica. Nada do visual, dos escudos, dos nomes ou das marcas daquele app entra no projeto, e nenhuma imagem dele está no repositório.

**Em uma frase:** o campo da "Animada completa" passa a ser visto de lado e de cima, inclinado por código, com uma arquibancada e uma fila de placas fictícias no fundo; sobre ele, o caminho da bola (rastro), uma cunha que aponta o ataque de quem tem a bola e, flutuando sobre a arquibancada, uma etiqueta com o jogador do lance.

## 1. Resumo e fases

| Item da referência            | No Prancheta                                                                                                                                            | Fase |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| 5. Campo em perspectiva       | **Campo inclinado por código** (§3), com a arquibancada e a mureta desenhadas uma vez num canvas fora da tela, e as placas em DOM (§4)                  | 1a   |
| Placas                        | Uma fila no fundo, atrás da linha lateral de longe, fora do canvas; só marcas fictícias (ADR-0015)                                                      | 1a   |
| Comemoração de gol            | Sobe para o alto do campo, sobre a arquibancada, para o gol continuar à vista (§10)                                                                     | 1a   |
| 1. Rastro do passe            | **Rastro da bola:** linha em `ink` de onde a bola saiu até onde ela está, nos passes anônimos, no passe do começo do lance e no chute (§6)              | 1b   |
| 4. Sombra em cunha            | **Cunha do ataque:** triângulo a partir da bola até a linha do gol atacado, no token `pitch-wedge` (§7)                                                 | 1b   |
| 2. Etiqueta do lance          | **Etiqueta do lance:** pílula fora do canvas, flutuando sobre a arquibancada, do lado do time do jogador, com a camisa e o número, o tipo e o nome (§8) | 1b   |
| 3. O próximo jogador, apagado | **Etiqueta em espera:** o finalizador aparece apagado e acende quando a bola chega; e a assistência na comemoração (§9)                                 | 2    |

**Por que a fase 1 se divide em duas.** Juntas, a perspectiva e os três itens passariam do tamanho M (o G pede o "G aprovado" do CEO). Separadas, cada uma cabe num PR M:

- **1a, o campo inclinado:** a projeção em `geometry.ts`, o fundo novo (arquibancada, mureta, gramado e marcações inclinados, traves), as placas, os discos por profundidade, a comemoração no alto e os testes de geometria e de pixel. A coreografia (`scene.ts`) não muda. Depende do ADR.
- **1b, rastro, cunha e etiqueta:** a parte de regra do `game-designer` (passes anônimos D2-B, posse D4-C, passe do começo do lance D3-B) e os três itens sobre o campo inclinado.
- **2, P:** a etiqueta em espera e a assistência na comemoração.

## 2. O que não muda

- O campo continua decorativo e `aria-hidden`; a narração e o placar continuam sendo a versão acessível. A etiqueta, as placas e a comemoração também são `aria-hidden`.
- **O canvas continua sem texto** (decisão 2 do CEO): a etiqueta, as placas e a comemoração são DOM sobre o canvas.
- Nada antecipa o desfecho: o começo de um gol e o de uma chance do mesmo lado, tipo e finalizador continuam iguais quadro a quadro, agora com o rastro, a cunha e a etiqueta (critério 3 do `campo-lances.md`). A câmera é fixa: nenhum movimento de câmera, zoom ou mudança de ângulo, em nenhum passo (D7).
- O mandante fica sempre à esquerda, atacando para a direita, o jogo todo. Na perspectiva, "esquerda" é o gol da esquerda de quem olha.
- Sem tremor, sem zoom, sem flash, sem mudança de cor do campo.
- A coreografia continua em metros (`scene.ts`: `x` a partir da linha do gol do mandante, `y` a partir da linha lateral **de longe**, que é a de cima na tela); só o desenho muda.
- O tamanho da caixa do campo e a conta da altura (o maior retângulo 1,5:1 que cabe; `100dvh − 442px` em pé): a narração continua com 4 linhas de lance a 360×740. A perspectiva cabe na mesma caixa.
- As metas da T-085: quadros p95 ≤ 34 ms, desenho mediano ≤ 6 ms (CPU 4×, 390×844, densidade 3), nenhuma alocação por quadro, chunk do campo ≤ 20 KB gzip, nenhum `requestAnimationFrame` parado.

## 3. Geometria e projeção (fase 1a)

**A câmera.** Fixa, no eixo do meio-campo, atrás da linha lateral de perto, a cerca de 143 m de altura e 157 m atrás da borda de perto do desenho: olha o centro do campo de cima, a cerca de **36°** do gramado. O plano da imagem é vertical, com o quadro deslocado para baixo, então **as verticais continuam verticais** (traves e placas) e a linha lateral de longe é horizontal. Ninguém precisa dessa câmera no código: ela é só o que a fórmula abaixo equivale. A proporção da caixa é fixa (1,5:1), então a câmera é a mesma em qualquer tamanho; só a escala muda.

**Os três números da vista** (constante `PITCH_VIEW` em `app/src/ui/match/pitch/motion.ts`, com comentário apontando para cá; o `developer` pode ajustá-los ao ver no aparelho, sem mudar as regras):

| Nome          | Valor | O que é                                                                                                   |
| ------------- | ----- | --------------------------------------------------------------------------------------------------------- |
| `farScale`    | 0,68  | largura da borda de longe do desenho ÷ largura da borda de perto                                          |
| `grassShare`  | 0,62  | parte da altura da caixa do desenho do gramado (da borda de longe até o pé da caixa); o resto é o estádio |
| `boardHeight` | 12    | altura das placas, em px CSS, a 360px de largura da caixa (proporcional à largura)                        |

**A fórmula.** O desenho continua com 111 × 74 m (o campo de 105 × 68 e a faixa de grama de 3 m). Para um ponto da cena em metros (`x`, `y`), com `u = x + 3` e `v = y + 3`, na caixa de `Wc × Hc` px (canvas, já multiplicados pela densidade):

```
s0    = Wc / 111                                   // px por metro na borda de perto
yFar  = Hc × (1 − grassShare)                      // a borda de longe do desenho
t(v)  = 74·farScale / (74·farScale + (1 − farScale) × (74 − v))   // escala: 1 perto, farScale longe
sx    = Wc/2 + (u − 55,5) × s0 × t(v)
sy    = yFar + (Hc − yFar) × (t(v) − farScale) / (1 − farScale)
k     = s0 × t(v)                                  // px por metro naquele ponto (discos, bola, traves)
```

É uma perspectiva verdadeira (homografia): retas da cena continuam retas na tela, então uma linha do campo, o rastro e a cunha se desenham projetando só os vértices. Os cantos do desenho caem em `(0, Hc)` e `(Wc, Hc)` (perto, a largura toda) e em `(Wc × (1 − farScale)/2, yFar)` e `(Wc × (1 + farScale)/2, yFar)` (longe).

**O que muda em `geometry.ts`.**

- `pitchGeometry(width, height, dpr)` continua calculada uma vez por tamanho, nunca por quadro, e passa a guardar `s0`, `yFar`, `farScale`, a altura e o topo das placas (`boardTop = yFar − boardHeight`, em px) e os mínimos em px (disco e bola, abaixo).
- Função nova e pura, `project(g, x, y, out)`: escreve `sx`, `sy` e `k` num `Float64Array(3)` que o chamador reaproveita, sem alocação.
- **Disco:** raio `max(2,75 × k, 7 px CSS)`. O mínimo de 14px de diâmetro é o menor disco que a vista de cima já tinha (a 360×640) e mantém a marca do visitante com 4,7px ou mais, a pista de forma que não depende da cor. O anel continua com 2px CSS, por dentro, e a marca com um terço do diâmetro.
- **Bola:** raio `max(1,25 × k, 4 px CSS)`. O mínimo de 8px continua.
- **`clampBall`:** mesma função, agora aplicada **depois** da projeção, ao centro da bola em px: `[r, Wc − r] × [r, Hc − r]`. Com a bola no máximo a 1,5 m da borda do desenho (`ballRoom`), a projeção já a deixa inteira em todos os tamanhos medidos (perto, 1,5 m vale cerca de 4,4px na profundidade e 4,9px na largura); o `clampBall` fica como rede de segurança, como hoje.
- **Ordem de desenho por profundidade:** os discos de longe primeiro (`y` menor), para o de perto ficar por cima. Um `Uint8Array(22)` de índices, ordenado por inserção a cada quadro (22 itens, quase sempre já em ordem), sem alocação. A bola continua sempre por cima de tudo.
- **Quem sai pela lateral** (vermelho, lesão sem troca) continua indo 1,5 m além da linha mais próxima; pela lateral de perto, o disco pode ficar cortado pelo pé da caixa no último instante do passo, antes de sumir. Aceito.
- `scene.ts` não muda.

**O fundo, num canvas fora da tela** (redesenhado só quando o tamanho ou o `data-theme` muda, como hoje):

1. A arquibancada e a mureta (§4).
2. O gramado: a caixa inteira abaixo da mureta em `pitch`. Fora do trapézio do desenho continua grama, sem marcação; sem faixas alternadas, como hoje.
3. As marcações em `pitch-line`, com traço de `max(1, Wc ÷ 360)` px CSS igual em toda a profundidade: retângulos e linhas pelos vértices projetados; o círculo central, as meias-luas e as marcas pela projeção de uma polilinha de 48 pontos por círculo (círculo vira elipse deslocada, como deve ser).
4. Os gols: a rede no chão (os 7,32 × 2 m de hoje, projetados) e, em cada poste, uma trave vertical de `2,44 × k` px de altura, com o travessão ligando os topos, em `pitch-line` com 2px CSS. É o que dá profundidade ao gol; a bola na rede continua por cima.

**A cada quadro:** copiar o fundo, a cunha (§7), o rastro (§6), os 22 discos na ordem de profundidade e a bola. Nada mais que hoje, mais 24 projeções (algumas multiplicações cada) e a ordenação.

## 4. Arquibancada, mureta e placas (fase 1a)

**Arquibancada** (no canvas do fundo, da borda de cima da caixa até `boardTop`; toda com tokens):

- Fundo em gradiente vertical de `surface-0` (no alto) a `surface-2` (embaixo).
- Fileiras: linhas horizontais de 1px em `line`, a cada 6px embaixo, apertando até 3px no alto (perspectiva das fileiras), com opacidade de 0,3 no alto a 0,9 embaixo (`globalAlpha`, sem cor nova).
- Cobertura: uma faixa de 10px em `surface-0` no alto.
- Refletores: quatro barras de 18 × 3px a 12%, 37%, 63% e 88% da largura, a 5px do alto. No tema noite, em `floodlight`, cada uma com um halo radial de 52px no token `beam` (proposta 45, §14); no tema dia, apagadas: em `line`, sem halo.
- Sem público, sem pessoas, sem bandeiras, sem nada que lembre um estádio real.

**Mureta:** de `boardTop` até `yFar`, em `surface-1`, por toda a largura. É o que fica atrás das placas e o que aparece nos lados da fila.

**Placas: em DOM, fora do canvas** (proposta 46, §14):

- Uma fila de 7 placas iguais, com 1px de intervalo, presa à borda de longe do desenho: largura `Wc × farScale` (245px a 360px), centrada; altura `boardHeight × Wc ÷ 360` arredondada (12px a 360px, 13px deitado, 20px no desktop); topo em `boardTop`. Como a borda de longe é horizontal, a fila é um retângulo comum, sem distorção. Nenhuma placa nos lados nem na frente.
- Cada placa é um `BrandSlot` `pitch-boards` com a marca de `brandForSlot` (ADR-0015): nome da marca em `font-display` 700, caixa alta, com 0,62 da altura da placa (7px a 360px, 12px no desktop), nas duas cores da marca (dado da marca, como as cores do escudo). Sem rótulo de publicidade, sem link, não focável, `aria-hidden`.
- **Antes de a lista de marcas fictícias existir** (é conteúdo da T-040 e passa pelo CEO), ver a pendência 2 (§16).
- Por que DOM: o canvas continua sem texto (decisão 2), a letra sai nítida em qualquer densidade, a fonte do jogo já está carregada, e a fila não custa nada por quadro (é estática). A bola e os discos nunca passam por cima dela: o mais longe que vão é 1,5 m além da linha lateral de longe, dentro da faixa de grama, abaixo da mureta.

## 5. Tamanhos

A caixa é a mesma de hoje (o maior retângulo 1,5:1); a tabela é a mesma conta da fórmula em cada tamanho.

| Medida (px CSS)                                | 360×740 em pé | 844×390 deitado | 1280×800 desktop | 360×640 em pé     |
| ---------------------------------------------- | ------------- | --------------- | ---------------- | ----------------- |
| Caixa do campo                                 | 360 × 240     | 397 × 265       | 600 × 400        | 297 × 198         |
| Estádio (arquibancada, mureta e placas)        | 91            | 101             | 152              | 75                |
| Gramado (do fundo ao pé)                       | 149           | 164             | 248              | 123               |
| Placas (altura; largura da fila)               | 12; 245       | 13; 270         | 20; 408          | 10; 202           |
| Disco perto / longe (mínimo de 14)             | 18 / 14       | 20 / 14         | 30 / 20          | 15 / 14           |
| Bola perto / longe (mínimo de 8)               | 8 / 8         | 9 / 8           | 13 / 9           | 8 / 8             |
| Profundidade: px por metro perto / longe       | 2,9 / 1,4     | 3,2 / 1,5       | 4,9 / 2,3        | 2,4 / 1,1         |
| Etiqueta (topo a `space-2`; altura)            | 8; 48         | 8; 48           | 8; 48            | 8; 40 (uma linha) |
| Comemoração (topo a `space-2`; altura)         | 8; 110        | 8; 110          | 8; 110           | 8; 74 (sem nome)  |
| Topo da trave de longe (o gol tem de aparecer) | 138           | 153             | 230              | 114               |

**Leitura.** A etiqueta cabe inteira sobre o estádio em todos os tamanhos: não cobre o gramado. A comemoração cobre o estádio e no máximo uns 20px do fundo do gramado, sempre acima das traves; o gol e a bola na rede ficam à vista. O lado de longe perde mais da metade da resolução em profundidade em relação à vista de cima (3,2 px/m): é o custo que o CEO aceitou ao escolher a perspectiva. Os mínimos de disco e bola seguram a leitura.

**Uma alternativa que não recomendo:** uma caixa mais alta (por exemplo 360 × 270 em pé) daria 168px de gramado, mas tiraria meia linha da narração a 360×740 (de 4 para 3,5 linhas de lance). Fica registrada para o caso de o CEO achar o gramado baixo no aparelho.

## 6. Item 1: rastro da bola (fase 1b)

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

**Desenho.** A origem e a bola (e o poste, na trave) projetados (§3) e ligados por uma linha de 2px CSS em `ink`, pontas e juntas redondas, com um ponto de 5px de diâmetro em `ink` na origem. A espessura é a mesma em toda a profundidade (não afina ao longe): ao longe, o rastro já fica mais curto. Por cima do gramado e da cunha, por baixo dos discos; a bola por cima de tudo. O `ink` sobre `pitch` dá 5,94:1 (noite) e 4,09:1 (dia), o par do anel e da bola. Ele se distingue das marcações (`pitch-line`, 1px) pela espessura, pelo ponto de origem e porque segue a bola.

**Tempos.** Os do passo; nenhuma duração nova.

**Desempenho.** Um `stroke` de até 4 pontos e um `arc` por quadro. Os pontos em metros ficam num `Float64Array` de tamanho fixo, escrito pela cena (`sceneAt` ganha a origem do rastro no mesmo `out`), e são projetados no desenho, sem alocação. Menos de 0,1 ms por quadro com CPU 4×.

## 7. Item 4: cunha do ataque (fase 1b)

**O que é.** Um triângulo translúcido com o vértice na bola, apontado para o centro do gol que o time com a bola ataca, até a linha desse gol. Diz "quem está com a bola e para onde vai" sem cor de time. O CEO pediu para manter ("a sombra que indica qual lado está atacando").

**Dono e direção.** Do `campo-lances.md`, D4-C: nos lances, o `side` do evento; nos minutos sem lance, a cota de posse que bate com a da súmula. A direção é a do lado.

**Desenho.**

- **Em metros, como na vista de cima:** vértice no centro da bola; eixo da bola ao centro do gol atacado; meia-abertura de 26°; até a linha do gol atacado; recortado ao retângulo de jogo (105 × 68). Na tela, os três vértices projetados (uma reta continua reta, então o triângulo continua triângulo), e o recorte é o trapézio do retângulo de jogo projetado. Na perspectiva, a cunha naturalmente estreita ao longe, como a sombra da referência.
- Gradiente linear ao longo do eixo **na tela**, do token `pitch-wedge` no vértice projetado até transparente no centro do gol projetado.
- **`pitch-wedge`** (proposta 42, aprovada): noite `rgba(4, 18, 10, 0.45)` (sombra); dia `rgba(255, 255, 255, 0.35)` (luz). A cunha sempre **afasta o gramado do `ink`**: no vértice, o `ink` sobre o gramado com a cunha dá 10,96:1 (noite, 5,94 sem ela) e 7,35:1 (dia, 4,09). Valores a calibrar no aparelho, sem mudar a regra.
- Logo depois do fundo copiado e antes do rastro e dos discos.

**Quando aparece.** Em todo passo com dono (D4-C), também nos minutos sem lance. Some no começo do passo de desfecho e no gol, na volta ao centro, no começo de cada tempo e no intervalo; volta no passo seguinte com dono. Com a bola a menos de 3 m da linha do gol atacado, não é desenhada.

**Tempos.** Quando o dono muda, a cunha nova entra com opacidade de 0 a 1 em 200 ms (`globalAlpha`), e a antiga sai de uma vez. O dono troca a cada 4,1 minutos em média (cerca de 3 s no Normal), longe do limite de 3 mudanças por segundo.

**Desempenho, sem alocação.** O gradiente é criado **uma vez** por tamanho e tema, num eixo local de (0, 0) a (1, 0). A cada quadro, com o vértice `a` e o fim `e` já projetados, comprimento `len` e ângulo `θ` do segmento, `setTransform(cos θ·len, sin θ·len, −sin θ·len, cos θ·len, ax, ay)` (vezes a densidade), e os três vértices projetados passam para o eixo local pela inversa (`R(−θ)·(p − a) / len`, só aritmética) antes do `fill`. Mais `save`/`clip`/`restore`. De 0,1 a 0,3 ms por quadro com CPU 4×.

## 8. Item 2: etiqueta do lance (fase 1b)

**O que é.** A linha da narração em miniatura, sobre o campo: a camisa do jogador com o número, o tipo do lance e o nome. Só para quem está num evento do motor (D1-A).

**Onde fica.** Fora do canvas (DOM dentro da caixa do campo), **flutuando sobre a arquibancada, como na referência**: topo a `space-2` da borda de cima da caixa e a `space-2` da lateral, **do lado do time do jogador** (à esquerda para o mandante, à direita para o visitante: o lado do escudo no placar, uma pista do time que não depende da cor). Pela tabela do §5, ela cabe inteira sobre o estádio em todos os tamanhos e nunca cobre o gramado nem a bola.

**Desenho** (protótipo, capturas 2 e 4).

- Pílula em `surface-1`, borda de 1px em `line`, `radius-pill` e `shadow-card` (no tema dia, a arquibancada é clara, e a sombra separa a pílula do fundo). Respiro `space-1` em cima, embaixo e do lado da camisa; `space-3` do lado do texto. No visitante, a ordem se espelha e o texto alinha à direita.
- **Camisa:** um círculo de 40px em `surface-2` com a camisa do uniforme do jogador (o `kitSvg` do gerador da T-026, só a camisa, 34 × 22px; o goleiro com a de goleiro) e, por cima, o número (`Player.shirt`) em `numero` com `tabular-nums`, na `numberColor` do uniforme; quando a `numberPlate` não é nula, sobre uma placa nessa cor, com 4px de raio. É o contrato de [uniformes.md](../../art/uniformes.md) §3: o número sempre com 4,5:1 contra o que está atrás dele, também nas camisas listradas. Para só a camisa, o `kitSvg` ganha uma opção aditiva (`part: 'shirt'`, a `viewBox` `0 0 64 42`); pedido ao `art-director` (linha em `uniformes.md`) e ao `developer`, sem efeito no save nem no motor. Sem número (save danificado): a camisa sem número.
- **Texto, em duas linhas:** o tipo em `rotulo` (caixa alta), em `ink-muted`; o nome (`name.display`, ou `match.player.unknown`) em `body-strong`, em `ink`. Pares já conferidos sobre `surface-1` (7,23:1 e 6,43:1 para o `ink-muted`).
- **Largura máxima:** 60% da largura da caixa (216px a 360px; cerca de 150px para o nome). O nome quebra em até 2 linhas e nunca corta. Altura: 48px com uma linha de nome; com duas, 70px, ainda dentro do estádio a 360×740 (91px).
- **Abaixo de 200px de altura da caixa** (360×640): uma linha só (a camisa e o nome, sem o tipo), 40px.
- Sem `backdrop-filter` (o desfoque seria refeito a cada quadro do canvas por baixo).

**Quando aparece, e com que tipo** (decisões 4 e 5 do CEO): só lances com bola e vermelho.

| Passo                                                        | Tipo (chave)                                                  | Jogador       |
| ------------------------------------------------------------ | ------------------------------------------------------------- | ------------- |
| Começo de lance de jogada                                    | `match.live.shot` ("Finalização")                             | o finalizador |
| Começo de falta                                              | `match.live.freeKick` ("Falta")                               | o cobrador    |
| `penaltyAwarded`                                             | `match.live.penalty` ("Pênalti")                              | o cobrador    |
| Desfecho: defesa, trave, fora; pênalti perdido; chance fraca | `match.tag.saved`, `match.tag.post`, `match.tag.wide` (novas) | o finalizador |
| Desfecho: gol                                                | sem etiqueta: a comemoração diz o mesmo                       | —             |
| Vermelho                                                     | `report.event.red` ("Vermelho")                               | o expulso     |

A defesa leva o finalizador e "Defendida" (decisão 4). O goleiro com nome fica para quando a narração o nomear (`{keeper}`, `content-writer`, com o D5 do `game-designer`).

**Tempos.**

- **Entrada:** opacidade de 0 a 1 e deslocamento de 4px para baixo, em 160 ms `ease-out`, no `onreveal` do passo.
- **Mesmo jogador, tipo novo** (do começo ao desfecho do mesmo lance): só o texto do tipo muda, no lugar, sem nova entrada.
- **Outro jogador:** a etiqueta nova substitui a anterior na hora e entra como acima.
- **Saída:** fica até ser substituída ou até o começo do primeiro passo sem etiqueta que comece pelo menos **1,6 s (Normal) ou 0,8 s (Rápido)** depois da entrada; aí sai com opacidade de 1 a 0 em 120 ms.
- **Gol:** no desfecho do gol, sai sem animação, e a comemoração entra no mesmo lugar.
- **Pausa:** pausada, a etiqueta do momento fica.
- As durações ficam escritas no componente, com comentário apontando para cá, até o grupo de movimento dos tokens existir (proposta 2 de [componentes.md](componentes.md#propostas-ao-design-system)).

**Leitor de tela.** `aria-hidden="true"`: tudo o que ela diz está na linha da narração do mesmo passo. Nada entra na região viva.

**Idiomas.** Medido em `rotulo` (caixa alta, Chromium, fontes do jogo): o mais largo dos tipos que já existem é "Finalização", 65,4px (es "Tiro libre" 56,1; en "Free kick" 52,4); as sugestões novas, de 25,8 ("Wide") a 70,8px ("Off the post"). Os `match.tag.*` com no máximo 140px nos três idiomas.

**Desempenho.** Muda no máximo uma vez por passo com etiqueta (cerca de 20 por partida); a transição é só `opacity` e `transform`. Não acompanha a bola.

**Componente.** `PitchTag.svelte` em `app/src/ui/components/` (casca do `ux-designer`, no chunk do campo), props: `side: 'home' | 'away'`, `kind: string` (texto pronto), `name: string`, `shirt?: number`, `kitSvg: string` (a camisa já gerada), `number: { color: string; plate: string | null }`, `waiting?: boolean` (fase 2), `compact?: boolean` (caixa abaixo de 200px). Quem decide qual etiqueta mostrar e quando é a tela.

## 9. Item 3: o próximo jogador (fase 2)

**Por que não como na referência.** Lá, o nome apagado é o próximo a receber, um fato que o app tem. Aqui, mostrar quem vem antes de o lance começar entregaria o lance, e entre um lance e outro os passes são anônimos (D2-B).

**A etiqueta em espera** (protótipo: no lance do gol, o nome acende quando a bola chega). No começo de um lance de jogada, a narração já nomeia o finalizador, e o passe anônimo vai até ele (D3-B). A etiqueta entra com o nome em `ink-muted` e passa para `ink` quando a bola chega ao finalizador (o fim do primeiro trecho da cena: 35% do tempo na pausa dramática). Igual para gol e chance. Na falta e no pênalti, entra já acesa. Com movimento reduzido, entra acesa. Custo: uma troca de classe por lance.

**A assistência, na comemoração.** No gol com assistência, a comemoração ganha a linha "Assistência de {player}" em `caption`, `ink-muted` (proposta 44, aprovada). Sem "replay" da assistência no campo.

## 10. Comemoração de gol (muda na fase 1a)

- **Sobe para o alto do campo:** topo a `space-2` da borda de cima da caixa, `space-4` de cada lado, no lugar da etiqueta. Embaixo, ela cobriria o gramado de perto e, na maioria dos gols, a própria rede; no alto, ela cobre o estádio e no máximo uns 20px do fundo do gramado, sempre acima das traves (§5), e o gol fica à vista.
- O resto é o da proposta 39, aprovada: `surface-1`, borda de 1px em `line`, `radius-md`, escudo `md`, "Gol!" em `display-lg`, o artilheiro em `subtitulo`; entra com escala de 0,92 a 1 e opacidade em 200 ms `ease-out`; sai sem animação; `aria-hidden`; parada com movimento reduzido.
- Abaixo de 200px de altura da caixa, só o escudo e o título (regra de hoje): 74px, dentro do estádio.
- Fase 2: a linha da assistência (§9), 110px no total.

## 11. Temas e movimento reduzido

**Tema noite (padrão):** arquibancada em `surface-0` → `surface-2`, fileiras em `line`, refletores acesos (`floodlight` com halo `beam`), mureta `surface-1`, gramado `pitch`, marcações `pitch-line`, cunha escura, anel, bola e rastro em `ink` claro.

**Tema dia:** os mesmos papéis com os tokens do dia: a arquibancada fica clara, os refletores apagados (em `line`, sem halo), a cunha clara e o `ink` escuro. O estádio perde a cara de noite (captura 4 do protótipo); ver a pendência 1 (§16).

**Troca de tema no meio da partida:** o fundo é redesenhado uma vez (como hoje), e o gradiente da cunha também.

**Movimento reduzido** (regra da T-085, sem mudança): o campo fica parado, com um quadro só a cada passo com linha na narração e nenhum `requestAnimationFrame` entre eles. No quadro: os times nas posições da formação, projetados; a bola no ponto de chegada do passo; o rastro **inteiro** daquele passo, parado; a cunha do dono daquele passo, sem a entrada de 200 ms. A etiqueta aparece e some sem transição (o tempo mínimo na tela continua); a comemoração aparece e some parada. A câmera nunca se move, com ou sem a preferência. A arquibancada e as placas são paradas por natureza.

## 12. Desempenho e orçamento

| Item                               | Hoje (medido, CHANGELOG da T-085) | Fase 1a (estimativa)                           | Fase 1b (estimativa)                                         | Meta                                  |
| ---------------------------------- | --------------------------------- | ---------------------------------------------- | ------------------------------------------------------------ | ------------------------------------- |
| Chunk do campo (JS + CSS, gzip)    | 7,1 KB                            | +2 a 4 KB (projeção, fundo, placas)            | +2 a 3 KB (rastro, cunha, etiqueta, regras de posse e passe) | ≤ 20 KB                               |
| Desenho de um quadro (mediana)     | 0,5 ms                            | +0,2 ms (24 projeções, ordenação)              | +0,4 ms (cunha com recorte, rastro)                          | ≤ 6 ms                                |
| Intervalo entre quadros (p95)      | 16,8 ms                           | sem mudança esperada                           | sem mudança esperada                                         | ≤ 34 ms                               |
| Redesenho do fundo (tamanho, tema) | não medido                        | de 5 a 15 ms com CPU 4× (fileiras, polilinhas) | —                                                            | ≤ 30 ms, nunca tarefa longa (> 50 ms) |
| Imagens e precache                 | nenhuma imagem                    | nenhuma imagem                                 | nenhuma imagem                                               | —                                     |

Total estimado ao fim da fase 1: de 11 a 14 KB gzip no chunk do campo e de 1 a 1,5 ms de mediana por quadro. Se uma meta passar, volta ao `architect` antes de a tela virar tela de espera.

## 13. Medidas para os testes

**Vitest (fase 1a), em `geometry.test.ts`, reescrito:**

1. Os quatro cantos do desenho caem onde o §3 diz (com tolerância de 0,5px), em 360×240, 397×265, 600×400 e 297×198.
2. Profundidade monótona: para `y` crescente, `sy` cresce e `k` cresce.
3. Retas continuam retas: três pontos alinhados na cena continuam alinhados na tela (tolerância de 0,5px).
4. Mínimos: raio do disco ≥ 7px CSS e da bola ≥ 4px CSS em todos os pontos do desenho, nos quatro tamanhos.
5. `project` não aloca (escreve no `out` recebido) e é pura.
6. A bola, em qualquer ponto a até 1,5 m da borda do desenho, fica inteira no canvas depois da projeção (com e sem o `clampBall`).

**E2E (Playwright, como os da T-085):**

1. **Desempenho** (fases 1a e 1b): quadros p95 ≤ 34 ms e desenho mediano ≤ 6 ms a 390×844, densidade 3, CPU 4×, 15 s de "Animada completa" no Normal.
2. **Redesenho do fundo:** trocar o tema no meio da partida não gera tarefa longa (> 50 ms), pelo `PerformanceObserver` que já existe.
3. **Pixels** (substitui o item 11 da T-085 e o do E2E offline, que liam um canto em `--pitch`): o pixel do canto de baixo à esquerda continua em `--pitch`; o do canto de cima à esquerda fica em `--surface-0` (a cobertura). Vale nos dois temas.
4. **Placas:** um elemento `aria-hidden` dentro da caixa do campo, com 7 placas, a base dele na altura `yFar` (tolerância de 1px), nenhuma placa focável nem com link.
5. **Etiqueta** (1b): `aria-hidden`; nunca num passo `minuteFull`; o texto é o da linha da narração do mesmo passo; do lado do time; a base dela acima do topo das placas, a 360×740, 844×390 e 1280×800; uma linha só a 360×640.
6. **Comemoração** (1a): `aria-hidden`; a base acima do topo da trave de longe (a tabela do §5), nos quatro tamanhos.
7. **Movimento reduzido:** sem transição na etiqueta, na cunha e na comemoração; nenhum `requestAnimationFrame` entre lances (como hoje).
8. **Nada antecipa o desfecho** (Vitest, 1b): o teste dos 11 pontos cobre a origem do rastro, a cunha e a etiqueta (na fase 2, também o instante em que o nome acende).
9. **Chunk** (`tests/regression/match-chunks.test.ts`): o do campo com no máximo 20.000 bytes gzip, e nenhum arquivo de imagem novo no fecho dele.

## 14. Design system e textos

**Propostas** (numeração de [componentes.md](componentes.md#propostas-ao-design-system); registro lá e no `design-system.md` na implementação):

41. **Etiqueta do lance no campo: aprovada.** Revoga o "nenhum número ou texto no campo" da decisão 11 da T-032; o canvas continua sem texto; sobre ele, fora do canvas, **uma** etiqueta `aria-hidden` com a camisa, o número, o tipo e o nome de quem está no evento do passo.
42. **Token `pitch-wedge`: aprovada.** Noite `rgba(4, 18, 10, 0.45)`, dia `rgba(255, 255, 255, 0.35)`, só na cunha; o `npm run tokens` confere o `ink` sobre o `pitch` com a cunha ≥ 3:1 nos dois temas, na lista de pares gráficos.
43. **Rastro da bola** (aprovado com a fase 1): linha de 2px em `ink` com ponto de origem, só no passo em que nasce, inteira e parada com `prefers-reduced-motion`. Sem token novo.
44. **Comemoração com assistência: aprovada**, na fase 2.
45. **`beam` também no jogo (nova, para o CEO):** o token hoje é "só no site". Proposta: usá-lo também nos halos dos refletores da arquibancada do campo, no tema noite, decorativo, nunca sob texto. Sem valor novo.
46. **Placas em DOM e campo inclinado (nova, para o CEO, junto do ADR):** a regra "Campo da partida" do design system passa de "campo deitado, visto de cima" para "campo inclinado por código (§3), com a arquibancada e a mureta no canvas e as placas, a etiqueta e a comemoração em DOM sobre ele". A comemoração sobe para o alto do campo. Sem token novo.

**Textos novos** (para o `content-writer`; o lote passa pelo CEO):

| Chave                      | pt-BR (sugestão)          | Uso                                    |
| -------------------------- | ------------------------- | -------------------------------------- |
| `match.tag.saved`          | "Defendida"               | tipo da etiqueta no desfecho de defesa |
| `match.tag.post`           | "Na trave"                | idem, trave                            |
| `match.tag.wide`           | "Para fora"               | idem, para fora                        |
| `match.celebration.assist` | "Assistência de {player}" | fase 2, linha da comemoração           |

Reaproveitadas: `match.live.shot`, `match.live.freeKick`, `match.live.penalty`, `report.event.red`, `match.player.unknown`. Limite de 140px em `rotulo` para os `match.tag.*`.

**Atualizações em [partida.md](partida.md) na implementação** (no PR de cada fase, pelo `ux-designer`): "Desenho", "Tamanhos", "Comemoração", "Placas", "Marcas do cenário" e "Medidas para o E2E" passam a apontar para este arquivo.

## 15. Decisões do CEO (2026-11-23)

1. **Fases:** aprovadas. Fase 1: rastro, etiqueta e cunha, no campo inclinado (item 6), com os passes anônimos e a posse do `campo-lances.md`. Fase 2: etiqueta em espera e assistência na comemoração. (A divisão da fase 1 em 1a e 1b, no §1, é só para cada PR caber em M.)
2. **Proposta 41 (etiqueta no campo): aprovada.** Fica revogada a parte "nenhum número ou texto no campo" da decisão 11 da T-032; o canvas continua sem texto.
3. **Proposta 42 (token `pitch-wedge`): aprovada.**
4. **Etiqueta da defesa:** finalizador e "Defendida" na fase 1.
5. **Eventos com etiqueta:** só lances com bola (finalização, gol, pênalti) e cartão vermelho.
6. **Perspectiva (revista pelo CEO no mesmo dia):** o CEO prefere a vista parecida com a referência. Entra a **saída A, campo inclinado por código**, já na fase 1, no lugar da vista de cima; sem fundo ilustrado. Muda o "visto de cima" do `docs/PROJETO.md`, então pede ADR antes da implementação. A cunha do ataque continua, por pedido explícito do CEO ("a sombra que indica qual lado está atacando").
7. **Placas:** com a perspectiva, uma fila de placas no fundo, só com marcas fictícias (ADR-0015); nenhuma na faixa de grama.
8. **Proposta 44 (assistência na comemoração): aprovada**, na fase 2; sem "replay" da assistência no campo.

## 16. Pendências para o CEO

1. **Arquibancada no tema dia:** seguir o tema (estádio claro, refletores apagados; sem token novo) (recomendo), ou estádio sempre à noite (dois tokens novos só para a arquibancada, com os valores do tema noite nos dois temas).
2. **O que as placas mostram antes da lista de marcas fictícias:** a lista é conteúdo da T-040 e passa pelo CEO. Recomendo **antecipar o lote da lista** (`content-writer`) para entrar com a fase 1a. Enquanto ela não existir, as placas mostram o nome do jogo (lido de `config/prancheta.config.ts`) e marcas abstratas em pares de tokens, como no protótipo; placas vazias não, porque lembrariam espaço à venda (ADR-0015).
3. **Proposta 45 (`beam` no jogo)** e **proposta 46 (campo inclinado e placas em DOM no design system):** recomendo aprovar as duas.
4. **Altura da caixa:** manter 1,5:1 (149px de gramado a 360×740, 4 linhas de narração) (recomendo), ou uma caixa mais alta, com meia linha de narração a menos.

## 17. Maquetes e protótipo

Tudo fora do repositório, no scratchpad da sessão, com clubes fictícios do jogo (Cruzador x Miragol) e escudos, uniformes e nomes dos geradores do próprio jogo; nenhum escudo, nome ou marca real. As placas mostram só o nome do jogo e marcas abstratas.

- **Protótipo animado:** `prototipo.html`, um arquivo só, sem nada externo (fontes do jogo embutidas), a 360×740, com cerca de 33 s em loop no ritmo Normal: passes anônimos com rastro, a cunha seguindo a posse, uma finalização do visitante com a etiqueta e "Defendida", um gol do mandante com a comemoração no alto e a assistência, uma falta para fora. Botões de tema dia, movimento reduzido e recomeçar; "Pausar" e "Rápido" funcionam. Simplificações: o protótipo sempre mostra um passe nos minutos sem lance (a regra D2-B permite condução sem rastro) e não tem intervalo.
- **Capturas do protótipo** (densidade 2): `proto-1-passe-rastro-cunha.png`, `proto-2-finalizacao-etiqueta.png`, `proto-3-gol-comemoracao.png`, `proto-4-tema-dia.png`, `proto-5-movimento-reduzido.png`.
- **Maquetes estáticas da proposta original:** `a-vista-de-cima.png` a `i-etiqueta-em-espera.png` e `comparativo-a-b-c.png`; a `b-inclinado-por-codigo.png` e a `g-inclinado-tema-dia.png` são as que levaram à decisão 6. Diferenças para a spec atual: lá a etiqueta tinha um disco no lugar da camisa, a comemoração ficava embaixo e o gramado tinha faixas de corte (retiradas: o gramado continua liso, como no design system).

## 18. Anexo: as saídas estudadas para a perspectiva

Registro do estudo que levou à decisão 6; não é mais escolha aberta.

- **A. Inclinar por código (escolhida):** projeção feita à mão (§3), discos redondos menores ao longe, arquibancada e placas por código. De 2 a 4 KB gzip; nenhuma imagem; menos de 0,3 ms a mais por quadro. A transformação por CSS (`perspective()` e `rotateX()` no canvas) foi descartada: achata os discos e a marca do visitante, desfoca o lado de perto e deixa a tela sem saber onde cada ponto caiu.
- **B. Fundo ilustrado (ComfyUI na máquina do CEO, pelo `art-director`):** só a arquibancada numa imagem, com o resto da saída A. De 75 a 360 KB a mais no precache para todos os jogadores (também quem só joga "Só lances principais"), revisão de arte a cada ajuste de enquadramento, cores fora do `npm run tokens`. Descartada pelo CEO.
- **C. Não fazer (a vista de cima):** a melhor legibilidade a 360px (3,2 px/m em toda a profundidade, discos de 18px), sem custo. Era a recomendação do `ux-designer`; o CEO preferiu a vista da referência.
