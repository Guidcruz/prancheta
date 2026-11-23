# Partida: campo v2 (rastro, etiqueta, cunha e perspectiva)

**Estado:** decidida pelo CEO em 2026-11-23 (ver §15); sem código de produção ainda. **Parte:** o visual. A regra de jogo e a honestidade dos dados (quem ganha nome, de onde vêm a posse e a direção) são do `game-designer`, em [../campo-lances.md](../campo-lances.md), escrito em paralelo; este arquivo segue as recomendações de lá (D1-A, D2-B, D3-B, D4-C, D6-A) e aponta onde diverge. **Base:** [partida.md](partida.md) ("Campo 2D (T-085)", "Movimento", "Acessibilidade", "Desempenho no celular"), [../design-system.md](../design-system.md) ("Campo da partida"), [../../art/uniformes.md](../../art/uniformes.md) e a §4.7 de [../../02-architecture.md](../../02-architecture.md). **Referência:** prints de um app real de lance a lance, só pela mecânica. Nada do visual, dos escudos, dos nomes ou das marcas daquele app entra no projeto, e nenhuma imagem dele está no repositório.

**Em uma frase:** o campo ganha o caminho da bola (rastro), uma etiqueta com o jogador do lance (só de quem está num evento do motor) e uma cunha que aponta o ataque de quem tem a bola, tudo no campo visto de cima; a perspectiva com estádio fica como estudo, com custo, para depois.

## 1. Resumo e recomendação

| Item da referência            | No Prancheta                                                                                                                                                  | Fase        |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------- |
| 1. Rastro do passe            | **Rastro da bola:** linha em `ink` de onde a bola saiu até onde ela está, nos passes anônimos, no passe do começo do lance e no chute                         | 1           |
| 2. Etiqueta do lance          | **Etiqueta do lance:** pílula fora do canvas, no alto, do lado do time do jogador, com o número na bolinha do uniforme, o tipo e o nome                       | 1           |
| 4. Sombra em cunha            | **Cunha do ataque:** triângulo a partir da bola até a linha do gol atacado, num token novo que sempre aumenta o contraste da bola                             | 1           |
| 3. O próximo jogador, apagado | **Etiqueta em espera:** no passe do começo do lance, o finalizador já aparece com o nome apagado e acende quando a bola chega; e a assistência na comemoração | 2           |
| 5. Perspectiva com estádio    | **Estudo:** três saídas com custo (seção 8). Recomendo não fazer agora e, depois da fase 2, um teste da inclinação por código no celular do CEO               | à parte     |
| Placas                        | Na vista de cima, **não**. Só se a perspectiva entrar, e só no fundo                                                                                          | com a T-040 |

**Por que nessa ordem.** Os itens 1, 2 e 4 são os que dão a mecânica da referência e custam pouco: cabem no chunk do campo (hoje 7,1 KB gzip de 20 KB), mudam quase nada no tempo de desenho (hoje mediana de 0,5 ms de 6 ms) e não mudam a geometria nem os testes de posição. O item 3, como a referência mostra ("o próximo"), anteciparia o lance; a versão honesta é um estado da própria etiqueta e depende da fase 1 pronta. A perspectiva muda a geometria, os testes e, segundo o `game-designer` (D7), o "visto de cima" do `docs/PROJETO.md` (ADR); ela pede uma decisão própria.

**Fase 1, em resumo:** os passes anônimos e a posse que bate com a súmula (D2-B e D4-C, do `campo-lances.md`), o rastro, a cunha e a etiqueta nos lances com bola e no vermelho. **Fase 2:** a etiqueta em espera e a assistência na comemoração. Tamanho estimado: fase 1 M (com a parte de regra do `game-designer`), fase 2 P.

## 2. O que não muda

- O campo continua decorativo e `aria-hidden`; a narração e o placar continuam sendo a versão acessível. A etiqueta também é `aria-hidden` (seção 5).
- Nada antecipa o desfecho: o começo de um gol e o de uma chance do mesmo lado, tipo e finalizador continuam iguais quadro a quadro, agora com o rastro, a cunha e a etiqueta (critério 3 do `campo-lances.md`).
- O mandante fica sempre à esquerda, atacando para a direita, o jogo todo.
- Sem tremor, sem zoom, sem flash, sem mudança de cor do campo.
- As metas da T-085: quadros p95 ≤ 34 ms, desenho mediano ≤ 6 ms (CPU 4×, 390×844, densidade 3), nenhuma alocação por quadro, chunk do campo ≤ 20 KB gzip, nenhum `requestAnimationFrame` parado.
- O tamanho do campo e a conta da altura (`100dvh − 442px`): nenhum item da fase 1 ocupa altura fora do campo, e a narração continua com 4 linhas de lance a 360×740.

## 3. Item 1: rastro da bola

**O que é.** O caminho que a bola fez **no passo atual**, de onde ela saiu até onde ela está, com a bola andando na ponta. É o "passe" da referência, mas sem afirmar quem passou: nos minutos sem lance, é um passe anônimo entre dois discos do time com a bola (D2-B); no começo de um lance de jogada, o passe anônimo que chega ao finalizador (D3-B); no desfecho e na chance fraca, o chute.

**Quando aparece.**

| Passo                                             | Rastro                                                                           |
| ------------------------------------------------- | -------------------------------------------------------------------------------- |
| Minuto sem lance com passe (D2-B)                 | de quem passa até a bola                                                         |
| Minuto sem lance com condução (o mesmo disco)     | nenhum (a bola anda sozinha, como hoje)                                          |
| Começo de lance de jogada                         | do companheiro anônimo até a bola (D3-B)                                         |
| Começo de falta e de pênalti                      | nenhum (a bola vai ao ponto, como hoje)                                          |
| Desfecho, chance fraca (o voo)                    | do ponto do lance até a bola; na trave, uma linha quebrada (ponto, poste, volta) |
| Depois do gol, começo, intervalo, 2º tempo        | nenhum (a bola volta ao centro sem rastro)                                       |
| Vermelho, lesão, troca, mudança tática, acréscimo | nenhum                                                                           |

O rastro **vive o passo em que nasceu**: some no começo do passo seguinte, sem animação. Pausada (no fim de um passo), a partida mostra o rastro daquele passo inteiro.

**Desenho.** Linha de 2px CSS (vezes a densidade, como o anel) em `ink`, pontas e juntas redondas, com um ponto de 5px de diâmetro em `ink` na origem. Desenhada por cima do gramado e da cunha e por baixo dos discos; a bola continua por cima de tudo. O `ink` sobre `pitch` dá 5,94:1 (noite) e 4,09:1 (dia), acima de 3:1 para elemento gráfico, o mesmo par do anel e da bola. Ele se distingue das marcações (`pitch-line`, 1px) pela espessura, pelo ponto de origem e porque segue a bola; no tema noite o `pitch-line` é claro como o `ink`, e a maquete (a) mostra que a diferença de espessura basta.

**Tempos.** Os do passo: a bola anda no rastro com a curva que o passo já tem (`ease` cúbica; na pausa dramática, a câmera lenta). Nenhuma duração nova.

**Em pé e deitado.** Mesma espessura em px CSS em qualquer tamanho (a 360×240 e a 397×265 o campo tem cerca de 3,2 e 3,6 px por metro).

**Movimento reduzido.** O campo continua parado (um quadro por passo com linha na narração). Nesse quadro, o rastro do passo aparece **inteiro**, da origem ao destino: é desenho parado, não movimento, e dá a quem não vê a animação a informação que ela daria (de onde a bola veio). Nos minutos sem lance não há quadro, então não há rastro (maquete c).

**Leitor de tela.** Nada novo: o rastro não carrega informação que a narração não tenha.

**Desempenho.** Um `stroke` de até 4 pontos e um `arc` por quadro. Os pontos ficam num `Float64Array` de tamanho fixo, escrito pela cena (`sceneAt` ganha a origem do rastro no mesmo objeto `out`), sem alocação. Estimativa: menos de 0,1 ms por quadro com CPU 4×.

## 4. Item 4: cunha do ataque

**O que é.** Um triângulo translúcido com o vértice na bola, apontado para o centro do gol que o time com a bola ataca, que vai até a linha desse gol. Diz "quem está com a bola e para onde vai" sem cor de time: a direção já diz o lado (o mandante ataca para a direita).

**De onde vêm o dono e a direção.** Do `campo-lances.md`, D4-C: nos lances, o `side` do evento; nos minutos sem lance, a cota de posse que bate com a da súmula. A direção é a do lado.

**Desenho.**

- Vértice no centro da bola; eixo da bola ao centro do gol atacado; meia-abertura de 26° (52° no total); comprimento até a linha do gol atacado; recortado ao retângulo de jogo (105 × 68), nunca sobre a faixa de grama.
- Preenchimento em gradiente linear ao longo do eixo, do token **`pitch-wedge`** (proposta 42, seção 10) no vértice até transparente na linha do gol.
- **`pitch-wedge`:** noite `rgba(4, 18, 10, 0.45)` (sombra); dia `rgba(255, 255, 255, 0.35)` (luz). A cunha é sombra no tema noite e luz no dia porque ela sempre **afasta o gramado do `ink`**: a bola e os anéis ficam mais legíveis dentro dela, nunca menos. Medido no vértice (o ponto mais forte): `ink` sobre o gramado com a cunha, 10,96:1 (noite, contra 5,94 sem ela) e 7,35:1 (dia, contra 4,09). Uma cunha escura no tema dia derrubaria a bola (`ink` escuro) abaixo de 3:1. As marcações dentro da cunha, no dia, ficam com 2,05:1; elas são decorativas e já não têm meta. Valores a calibrar no aparelho, sem mudar a regra.
- Desenhada logo depois do gramado (copiado do canvas fora da tela) e antes do rastro e dos discos.

**Quando aparece.** Em todo passo com dono (D4-C), também nos minutos sem lance. Some no começo do passo de desfecho (quando a bola sai para o gol) e no gol, na volta ao centro, no começo de cada tempo e no intervalo; volta no passo seguinte com dono. Com a bola a menos de 3 m da linha do gol atacado, não é desenhada (o triângulo vira um traço).

**Tempos.** Quando o dono muda, a cunha nova entra com opacidade de 0 a 1 em 200 ms (`globalAlpha`), e a antiga sai de uma vez. Pelo `campo-lances.md`, o dono troca a cada 4,1 minutos em média (cerca de 3 s no Normal): bem longe do limite de 3 mudanças por segundo.

**Em pé e deitado.** A mesma regra em metros; o gradiente é calculado para o tamanho do canvas.

**Movimento reduzido.** No quadro parado de cada passo com linha na narração, a cunha do dono daquele passo, sem a entrada de 200 ms.

**Leitor de tela e cor.** A cunha não é o único sinal de nada: o lado do lance está na narração (escudo e nome do clube) e na direção do ataque. Ela não usa cor de time.

**Desempenho.** O gradiente é criado **uma vez** por tamanho e tema, num eixo local de 0 a 1; a cada quadro, `setTransform` leva o eixo à bola (rotação e escala, números, sem objeto novo), e um `save`/`clip`/`fill`/`restore` desenha o triângulo. Estimativa: 0,1 a 0,3 ms por quadro com CPU 4×, num canvas de 780 × 520 (390px de largura, densidade limitada a 2). Nenhuma alocação.

## 5. Item 2: etiqueta do lance

**O que é.** A linha da narração em miniatura, sobre o campo: o número do jogador na bolinha do uniforme dele, o tipo do lance e o nome. Só aparece para quem está num evento do motor (`campo-lances.md`, D1-A); nos minutos sem lance não há etiqueta.

**Onde fica.** Fora do canvas (DOM sobre ele, dentro da caixa do campo), presa ao alto do desenho a `space-2` da borda de cima e a `space-2` da lateral, **do lado do time do jogador**: à esquerda para o mandante, à direita para o visitante. É o mesmo lado do escudo no placar e o lado de onde o time sai; como o time ataca para o outro lado, a etiqueta fica longe do lance e quase nunca cobre a bola. A posição é mais uma pista do time que não depende da cor.

**Desenho** (maquete a).

- Pílula em `surface-1`, borda de 1px em `line`, `radius-pill`. Respiro `space-1` em cima, embaixo e do lado da bolinha; `space-3` do lado do texto. No visitante, a ordem se espelha (texto à esquerda, bolinha à direita) e o texto alinha à direita.
- **Bolinha:** `size-medallion-sm` (32px), no `FieldKit.fill` do jogador (goleiro: o `fill` de goleiro), com o anel de 2px em `ink` por dentro, como no campo. Dentro, o número (`Player.shirt`) em `numero` com `tabular-nums`, na `FieldKit.numberColor`; quando o `FieldKit.numberPlate` não é nulo, o número fica sobre uma placa nessa cor, com 4px de raio (é o contrato de [uniformes.md](../../art/uniformes.md) §3: o número sempre com 4,5:1 contra o que está atrás dele). Sem número (jogador fora da lista, save danificado): a bolinha sem número.
- **Texto, em duas linhas:** o tipo em `rotulo` (caixa alta), em `ink-muted`; o nome (`name.display`, ou `match.player.unknown`) em `body-strong`, em `ink`. Pares já conferidos pelo `npm run tokens` sobre `surface-1` (`ink-muted` 7,23:1 no tema noite e 6,43:1 no dia).
- **Largura máxima:** 60% da largura do desenho (216px a 360px, sobram cerca de 158px para o nome). O nome quebra em até 2 linhas e nunca corta, como no resto do jogo. Altura: 48px com uma linha de nome (4 + 16 + 22 + 4, mais a borda), 70px com duas.
- Sem `backdrop-filter` (o desfoque seria refeito a cada quadro do canvas por baixo dela).

**Quando aparece, e com que tipo.** A tabela do `campo-lances.md` (D1) permite etiqueta em todos os eventos com jogador; na fase 1 eu a limito aos lances com bola e ao vermelho, por tempo de leitura (o passo comum dura 400 ms no Normal e 150 ms no Rápido) e para o campo não piscar. Amarelo, lesão e troca ficam só na narração.

| Passo                                                        | Tipo (chave)                                                  | Jogador                       |
| ------------------------------------------------------------ | ------------------------------------------------------------- | ----------------------------- |
| Começo de lance de jogada                                    | `match.live.shot` ("Finalização")                             | o finalizador                 |
| Começo de falta                                              | `match.live.freeKick` ("Falta")                               | o cobrador                    |
| `penaltyAwarded`                                             | `match.live.penalty` ("Pênalti")                              | o cobrador                    |
| Desfecho: defesa, trave, fora; pênalti perdido; chance fraca | `match.tag.saved`, `match.tag.post`, `match.tag.wide` (novas) | o finalizador (ver decisão 4) |
| Desfecho: gol                                                | sem etiqueta: a GoalCelebration já diz o mesmo                | —                             |
| Vermelho                                                     | `report.event.red` ("Vermelho")                               | o expulso                     |

**Divergência com o `campo-lances.md` (D5), para o CEO decidir.** Lá, a defesa leva o nome do goleiro. Hoje a narração da defesa não nomeia o goleiro ("O goleiro defende a finalização de {player}"), e a regra do design system é que o campo não mostra o que a narração não diz. Recomendo, na fase 1, a etiqueta da defesa com o **finalizador** e o tipo "Defendida"; o goleiro com nome entra quando o `content-writer` puser `{keeper}` na linha da defesa (com o D5 do `game-designer`), e aí a etiqueta passa para o lado do goleiro.

**Tempos.**

- **Entrada:** opacidade de 0 a 1 e deslocamento de 4px para baixo até a posição, em 160 ms `ease-out`, no `onreveal` do passo.
- **Troca:** uma etiqueta nova substitui a anterior na hora (a anterior some sem animação) e entra como acima.
- **Saída:** a etiqueta fica na tela até ser substituída ou até o começo do primeiro passo sem etiqueta que começa pelo menos **1,6 s (Normal) ou 0,8 s (Rápido)** depois que ela entrou; aí sai com opacidade de 1 a 0 em 120 ms. Assim um desfecho de 600 ms continua legível no minuto seguinte.
- **Gol:** no desfecho do gol a etiqueta sai sem animação, e a GoalCelebration entra.
- **Pausa:** pausada, a etiqueta do momento fica.
- As durações (160, 120 ms) ficam escritas no componente, com comentário apontando para cá, até o grupo de movimento dos tokens existir (proposta 2 de [componentes.md](componentes.md#propostas-ao-design-system)), como na GoalCelebration.

**Em pé e deitado.** As mesmas medidas em px. A 360×240 a etiqueta ocupa os 56px de cima (cerca de 14 m do campo, no canto do próprio campo do time); a 397×265 (deitado) e a 600×400 (desktop), proporcionalmente menos. Abaixo de 200px de altura do campo (por exemplo 360×640, campo de 297 × 198px), a etiqueta perde a linha do tipo e fica com uma linha (32px de bolinha e o nome), para não cobrir um quarto do campo.

**Movimento reduzido.** Aparece e some sem transição; o tempo mínimo na tela continua (é ritmo de leitura, não movimento).

**Leitor de tela.** `aria-hidden="true"`, como o campo e a GoalCelebration: tudo o que ela diz está na linha da narração do mesmo passo, que já é lida. Nada entra na região viva.

**Idiomas.** Os tipos vêm de `app/src/content/<idioma>/`. Medido em `rotulo` (caixa alta, Chromium, fontes do jogo): o mais largo dos que já existem é "Finalização", 65,4px (es "Tiro libre" 56,1; en "Free kick" 52,4); as sugestões novas ficam entre 25,8 ("Wide") e 70,8px ("Off the post"). Tudo cabe nos 158px. Os textos novos (`match.tag.*`) com no máximo 140px em `rotulo` nos três idiomas; um texto maior volta ao `ux-designer`.

**Desempenho.** A etiqueta muda no máximo uma vez por passo com etiqueta (cerca de 20 por partida); entre um e outro, nenhum trabalho. A transição é só `opacity` e `transform` (composição, sem layout). Ela não acompanha a bola, então não há atualização por quadro.

**Componente.** `PitchTag.svelte` em `app/src/ui/components/` (casca do `ux-designer`, no chunk do campo), props: `side: 'home' | 'away'`, `kind: string` (texto pronto), `name: string`, `shirt?: number`, `kit: { fill: string; numberColor: string; numberPlate: string | null }`, `waiting?: boolean` (fase 2), `compact?: boolean` (campo abaixo de 200px). Quem decide qual etiqueta mostrar e quando é a tela (lógica do `developer`).

## 6. Item 3: o próximo jogador (fase 2)

**Por que não como na referência.** Lá, o nome apagado no alto é o próximo a receber, um fato que o app tem. No Prancheta, mostrar quem vem antes de o lance começar entregaria o lance; e, entre um lance e outro, os passes são anônimos (D2-B).

**A versão honesta: a etiqueta em espera** (maquete i). No começo de um lance de jogada, a narração já nomeia o finalizador ("Fulano finaliza..."), e o passe anônimo vai até ele (D3-B). A etiqueta entra no começo do passo com o nome em `ink-muted` (o "próximo", apagado) e passa para `ink` quando a bola chega ao finalizador (o fim do primeiro trecho da cena: 35% do tempo na pausa dramática). O tipo e a bolinha não mudam. É a mesma informação da narração, então não antecipa nada; e como o começo do gol e o da chance são iguais, o momento em que o nome acende também é. Na falta e no pênalti (sem passe), a etiqueta entra já acesa.

- Contraste: `ink-muted` sobre `surface-1`, 7,23 e 6,43:1; a mudança de `ink-muted` para `ink` não é a única pista (a bola chega ao disco).
- Movimento reduzido: a etiqueta entra já acesa (o quadro parado é o do fim do passo).
- Custo: uma mudança de classe por lance, quando o `progress` passa do fim do primeiro trecho (a tela já calcula o `progress` a cada quadro).

**A assistência, na comemoração** (maquete f). No desfecho do gol com assistência, a GoalCelebration ganha uma terceira linha, "Assistência de {player}" em `caption`, `ink-muted`, embaixo do artilheiro. É fato revelado no mesmo instante em que a narração o mostra. Com o campo abaixo de 200px de altura, a linha some junto com o nome (regra atual). O "replay" da assistência no campo (D3-B2 do `campo-lances.md`) **não recomendo** a 360px: a comemoração cobre a parte de baixo do campo, e o rastro fica quase todo escondido atrás dela (visível na maquete f).

## 7. Celular em pé, deitado e desktop

Nada muda na grade da tela. A 360×740: campo de 360 × 240px e 4 linhas de lance na narração (maquete a). Deitado, a 844×390: campo de cerca de 397 × 265px na coluna da esquerda, com a etiqueta do mesmo tamanho (maquete d). Desktop, a 1280×800: campo de cerca de 600 × 400px. Os três itens são desenhados em metros (rastro e cunha) ou em px fixos presos ao canto do desenho (etiqueta), então valem em qualquer tamanho. Com sobras laterais (o campo menor que a caixa), a etiqueta se prende ao canto do **desenho**, não da caixa.

## 8. Item 5: perspectiva com estádio (estudo)

**O que muda em qualquer saída.** A vista de cima vira uma vista de lado, com a linha lateral de baixo perto de quem olha. O "visto de cima" está no `docs/PROJETO.md` e, pelo `game-designer` (seção 5 do `campo-lances.md`), mudá-lo é ADR. As regras de D7 valem: os lados fixos, a câmera parada (nenhum movimento de câmera que diferencie gol e chance) e as metas de desempenho.

**Legibilidade em comum às saídas A e B** (medida na maquete b, campo de 360 × 240px, arquibancada nos 90px de cima, linha lateral de longe com 68% da largura da de perto):

| Medida a 360px                   | Vista de cima | Inclinado                              |
| -------------------------------- | ------------- | -------------------------------------- |
| Altura do gramado                | 240px         | cerca de 150px                         |
| Disco perto / longe              | 18px / 18px   | 18px / 12px                            |
| Marca do visitante perto / longe | 6px / 6px     | 6px / 4px                              |
| Bola (mínimo de 8px)             | 8px           | 8px (presa no mínimo do lado de longe) |
| Pixels por metro na profundidade | 3,2           | 3,0 perto, 1,4 longe                   |

O lado de longe perde mais da metade da resolução em profundidade, e a marca do visitante (a pista de forma que não depende da cor) cai para 4px. Para manter a regra "nunca só por cor", o disco de longe precisaria de um mínimo (14px, por exemplo), o que achata a perspectiva. Em compensação, a etiqueta passa a ficar sobre a arquibancada, sem cobrir o gramado.

### A. Inclinar o campo por código (maquetes b e g)

- **Como:** o canvas 2D só faz transformações afins, que não viram retângulo em trapézio. A saída é uma projeção feita à mão: uma função `project(x, y)` (homografia do gramado para a tela) usada para cada disco, a bola, o rastro e a cunha (retas continuam retas; o círculo central e as meias-luas viram polilinhas, desenhadas uma vez no fundo). Os discos ficam redondos, só menores ao longe. A arquibancada, os refletores e as placas são desenhados por código, uma vez por tamanho e tema, no canvas fora da tela. A alternativa por CSS (`transform: perspective() rotateX()` no canvas) foi descartada: achata os discos e a marca do visitante, desfoca o lado de perto e deixa a tela sem saber onde cada ponto caiu.
- **Download:** de 2 a 4 KB gzip a mais no chunk do campo (projeção, arquibancada e placas). Nenhuma imagem.
- **Celular fraco:** 24 projeções por quadro (algumas multiplicações cada) e o mesmo número de desenhos de hoje; o fundo continua copiado de um canvas fora da tela. Estimativa: menos de 0,3 ms a mais na mediana. Folga ampla (hoje 0,5 ms de 6 ms).
- **Legibilidade a 360px:** a da tabela acima.
- **Tema dia:** a arquibancada feita com os tokens do dia fica clara e perde a cara de estádio à noite (maquete g). Ou ela é sempre noturna (tokens novos só para o estádio), ou fica clara.
- **Geometria e testes:** `geometry.ts` ganha a projeção e o tamanho por profundidade; `clampBall` passa a prender a bola no trapézio; `geometry.test.ts` reescrito (cantos do gramado, profundidade monótona, disco de longe ≥ mínimo); `scene.ts` não muda (continua em metros); o E2E que confere o pixel de um canto em `--pitch` muda para um pixel do gramado (o canto vira arquibancada); a medida de quadros e de desenho continua igual. ADR do "visto de cima".

### B. Fundo ilustrado (ComfyUI na máquina do CEO, pelo `art-director`)

- **Como:** só a arquibancada, o céu e os refletores numa imagem; o gramado, as linhas, os discos e tudo o mais continuam por código, com a projeção da saída A. Uma imagem com o gramado pintado exigiria que o desenho batesse ao pixel com a projeção, e qualquer ajuste viraria nova geração.
- **Download:** a imagem fica fora do chunk de JS e tem de entrar no precache (a partida funciona offline). Estimativa em WebP: de 25 a 40 KB para a faixa de 720 × 180 (celular a densidade 2) e de 50 a 80 KB para 1200 × 300 (desktop); com variações por porte de estádio (pequeno, médio, grande), vezes três. Todos baixam, também quem só joga "Só lances principais", porque o precache é um só: de 75 a 360 KB a mais no precache (hoje 872 KB, teto de 10 MB).
- **Celular fraco:** decodificar a imagem custa dezenas de ms com CPU 4×; com `img.decode()` antes de montar, sai da thread principal e não vira tarefa longa. Depois, a imagem é copiada para o canvas fora da tela uma vez, e cada quadro custa o mesmo da saída A.
- **Legibilidade a 360px:** a mesma da saída A no gramado; a arquibancada ilustrada tende a ter mais detalhe atrás da etiqueta, que continua legível por ter fundo próprio (`surface-1`).
- **Geometria e testes:** os da saída A, mais a conferência do `art-director` (nenhum estádio real reconhecível, nenhuma marca, nenhuma pessoa), o fluxo e os prompts entregues ao CEO, um teste de que a imagem está no precache, e o risco de a imagem fugir dos tokens (as cores dela não passam pelo `npm run tokens`).
- **Custo de equipe:** o mais alto das três: geração na máquina do CEO, revisão, retrabalho a cada ajuste de enquadramento.

### C. Não fazer

- **Download, desempenho, geometria e testes:** nenhuma mudança. A vista de cima tem a melhor legibilidade a 360px (tabela acima) e a regra "nunca só por cor" inteira.
- **O que se perde:** a cara de estádio da referência. A fase 1 já dá a mecânica (rastro, cunha, etiqueta); o "estádio à noite" continua nas cores do jogo (tema noite, `floodlight`, `pitch`).

**Recomendação:** **C agora.** Depois da fase 2, se o CEO ainda quiser o estádio, um teste da saída **A** numa branch, com as medidas de desempenho e a maquete viva no celular dele, antes do ADR. A saída B não recomendo na Etapa 1: custa download para todos, revisão de arte a cada ajuste e não melhora a leitura do lance.

## 9. Placas e marcas

- Só marcas fictícias, da lista de conteúdo aprovada pelo CEO, por `brandForSlot` (ADR-0015, patrocínio real desligado, sem "Patrocine aqui" nem rótulo de publicidade). Nenhuma maquete deste estudo tem marca: as placas da maquete b são blocos de cor sem texto.
- **Na vista de cima, não vale ter placas.** A faixa de grama em volta do campo tem 3 m, cerca de 10px a 360px: uma marca ali tem letras de uns 6px, ilegíveis, e as placas disputariam atenção com a bola quando ela sai pela lateral ou pela linha de fundo. Proponho tirar o `pitch-boards` da vista de cima na T-040 e manter as marcas fictícias onde elas se leem (a faixa do placar, o resumo da rodada, a tela de carregamento).
- **Com a perspectiva (A ou B), vale:** uma fila de placas atrás da linha lateral de longe, com 2,2 m de altura (cerca de 7 a 10px a 360px, 15px no desktop), o nome da marca desenhado no canvas fora da tela uma vez, `aria-hidden` como o campo. Placas só no fundo; nos lados e na frente, nenhuma.

## 10. Mudanças propostas ao design system (para o CEO aprovar)

Numeração seguindo [componentes.md](componentes.md#propostas-ao-design-system); registro lá e no `design-system.md` só depois da aprovação.

41. **Etiqueta do lance no campo.** Revoga a parte "nenhum texto, número ou cartão" da regra "Campo da partida" (decisão 11 da T-032, como pede o `campo-lances.md`): o canvas continua sem texto; sobre ele, fora do canvas, pode haver **uma** etiqueta `aria-hidden` com o número, o tipo e o nome de quem está no evento do passo, nunca com informação que a narração do mesmo passo não tenha. Desenho na seção 5. Sem token novo.
42. **Token `pitch-wedge`** (cor, nos dois temas): noite `rgba(4, 18, 10, 0.45)`, dia `rgba(255, 255, 255, 0.35)`. Uso: só a cunha do ataque, em gradiente até transparente. Regra: o token sempre afasta o gramado do `ink` (escurece no tema noite, clareia no dia). Conferência proposta no `npm run tokens`, na lista de pares gráficos: `ink` sobre `pitch` misturado com `pitch-wedge` ≥ 3:1 nos dois temas.
43. **Rastro da bola.** Padrão novo do campo: linha de 2px em `ink` com ponto de origem, só no passo em que nasce, inteira e parada com `prefers-reduced-motion`. Sem token novo.
44. **Comemoração com assistência** (fase 2). A GoalCelebration ganha a linha "Assistência de {player}" em `caption`, `ink-muted`. Sem token novo.

## 11. Textos novos (chaves, para o `content-writer`)

| Chave                      | pt-BR (sugestão)          | Uso                                    |
| -------------------------- | ------------------------- | -------------------------------------- |
| `match.tag.saved`          | "Defendida"               | tipo da etiqueta no desfecho de defesa |
| `match.tag.post`           | "Na trave"                | idem, trave                            |
| `match.tag.wide`           | "Para fora"               | idem, para fora                        |
| `match.celebration.assist` | "Assistência de {player}" | fase 2, linha da comemoração           |

Reaproveitadas: `match.live.shot`, `match.live.freeKick`, `match.live.penalty`, `report.event.red`, `match.player.unknown`. Limite: 140px em `rotulo` para os `match.tag.*`; o lote passa pelo CEO, como sempre.

## 12. Medidas para os testes (além dos critérios do `campo-lances.md`)

1. **Desempenho** (E2E da T-085, mesmas condições): com rastro, cunha e etiqueta, quadros p95 ≤ 34 ms e desenho mediano ≤ 6 ms; nenhuma alocação por quadro (Vitest: `sceneAt` continua escrevendo no mesmo objeto, agora com a origem do rastro e o dono).
2. **Chunk:** o do campo continua com no máximo 20.000 bytes gzip (`tests/regression/match-chunks.test.ts`); estimativa da fase 1: de 9 a 11 KB.
3. **Cunha e contraste:** o `npm run tokens` confere o par gráfico de `pitch-wedge` (proposta 42).
4. **Etiqueta:** `aria-hidden="true"`; nunca presente num passo `minuteFull`; o texto dela é o da linha da narração do mesmo passo (tipo e jogador); do lado do time (`left` no mandante, `right` no visitante).
5. **Movimento reduzido:** sem transição na etiqueta e na cunha; o quadro parado tem o rastro inteiro do passo; nenhum `requestAnimationFrame` entre lances (como hoje).
6. **Nada antecipa o desfecho:** o teste dos 11 pontos cobre a origem do rastro, a cunha e a etiqueta (inclusive o instante em que o nome acende, na fase 2).

## 13. Maquetes

HTML e canvas estáticos, capturados no Chromium sem janela a densidade 2. Clubes fictícios do jogo (Cruzador x Miragol), com escudos, uniformes e nomes dos geradores do próprio jogo; nenhum escudo, nome ou marca real. **Ficam fora do repositório**, no scratchpad da sessão:

| Arquivo                      | O que mostra                                                  |
| ---------------------------- | ------------------------------------------------------------- |
| `a-vista-de-cima.png`        | fase 1 a 360×740: rastro, etiqueta e cunha no começo do lance |
| `b-inclinado-por-codigo.png` | a mesma cena na saída A, com arquibancada e placas sem texto  |
| `c-movimento-reduzido.png`   | o quadro parado: formação, bola no ponto, rastro inteiro      |
| `d-deitado.png`              | 844×390, duas colunas                                         |
| `e-tema-dia.png`             | a maquete a no tema dia (cunha clara)                         |
| `f-gol-com-assistencia.png`  | fase 2: comemoração com a assistência; o "replay" escondido   |
| `g-inclinado-tema-dia.png`   | saída A no tema dia (a arquibancada perde a noite)            |
| `h-passe-anonimo.png`        | minuto sem lance: passe anônimo, cunha, sem etiqueta          |
| `i-etiqueta-em-espera.png`   | fase 2: o finalizador apagado enquanto a bola vai até ele     |
| `comparativo-a-b-c.png`      | a, b e c lado a lado                                          |

## 14. Decisões para o CEO

1. **Fases:** fase 1 com rastro, etiqueta e cunha na vista de cima; fase 2 com a etiqueta em espera e a assistência na comemoração. **Recomendo.**
2. **Proposta 41 (etiqueta no campo),** que revoga o "nenhum número ou texto no campo" da decisão 11 da T-032 (o canvas continua sem texto). **Recomendo aprovar.**
3. **Proposta 42 (token `pitch-wedge`),** sombra no tema noite e luz no dia. **Recomendo aprovar.**
4. **Etiqueta da defesa:** com o finalizador e "Defendida" na fase 1 (recomendo), ou com o goleiro, o que pede o `{keeper}` na linha da narração (content-writer) e o D5 do `game-designer`.
5. **Quais eventos têm etiqueta:** só lances com bola e vermelho (recomendo), ou também amarelo, lesão e troca, como o `campo-lances.md` permite.
6. **Perspectiva:** C agora e um teste da saída A depois da fase 2 (recomendo); A já; ou B.
7. **Placas:** nenhuma na vista de cima (o `pitch-boards` sai da T-040 enquanto não houver perspectiva) (recomendo); ou placas na faixa de grama como a T-040 previa.
8. **Proposta 44 (assistência na comemoração),** na fase 2. **Recomendo aprovar;** o "replay" da assistência no campo, não.

## 15. Decisões do CEO (2026-11-23)

1. **Fases:** aprovadas como recomendado. Fase 1: rastro, etiqueta e cunha, no campo inclinado (item 6), com os passes anônimos e a posse do `campo-lances.md`. Fase 2: etiqueta em espera e assistência na comemoração.
2. **Proposta 41 (etiqueta no campo): aprovada.** Fica revogada a parte "nenhum número ou texto no campo" da decisão 11 da T-032; o canvas continua sem texto.
3. **Proposta 42 (token `pitch-wedge`): aprovada.**
4. **Etiqueta da defesa:** finalizador e "Defendida" na fase 1.
5. **Eventos com etiqueta:** só lances com bola (finalização, gol, pênalti) e cartão vermelho.
6. **Perspectiva (revista pelo CEO no mesmo dia):** o CEO prefere a vista parecida com a referência. Entra a **saída A, campo inclinado por código** (maquetes b e g), já na fase 1, no lugar da vista de cima; sem fundo ilustrado. Muda o "visto de cima" do `docs/PROJETO.md`, então pede ADR antes da implementação. A cunha do ataque continua, por pedido explícito do CEO ("a sombra que indica qual lado está atacando").
7. **Placas:** com a perspectiva, uma fila de placas no fundo, só com marcas fictícias (ADR-0015); nenhuma na faixa de grama.
8. **Proposta 44 (assistência na comemoração),** na fase 2. **Recomendo aprovar;** o "replay" da assistência no campo, não.

## 15. Decisões do CEO (2026-11-23)

1. **Fases:** aprovadas como recomendado. Fase 1: rastro, etiqueta e cunha na vista de cima, com os passes anônimos e a posse do `campo-lances.md`. Fase 2: etiqueta em espera e assistência na comemoração.
2. **Proposta 41 (etiqueta no campo): aprovada.** Fica revogada a parte "nenhum número ou texto no campo" da decisão 11 da T-032; o canvas continua sem texto.
3. **Proposta 42 (token `pitch-wedge`): aprovada.**
4. **Etiqueta da defesa:** finalizador e "Defendida" na fase 1.
5. **Eventos com etiqueta:** só lances com bola (finalização, gol, pênalti) e cartão vermelho.
6. **Perspectiva:** C agora; um teste da saída A (inclinar por código) depois da fase 2, avaliado no celular do CEO. Se aprovado, vira ADR (o "visto de cima" do `docs/PROJETO.md`).
7. **Placas:** nenhuma na vista de cima; o `pitch-boards` sai da T-040 enquanto não houver perspectiva.
8. **Proposta 44 (assistência na comemoração): aprovada**, na fase 2; sem "replay" da assistência no campo.
