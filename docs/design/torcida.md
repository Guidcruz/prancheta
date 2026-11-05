# Torcida: o termômetro (Etapa 1a)

> Mantido pelo `game-designer`. Fonte: `docs/PROJETO.md`, "Brasilidades" > "Torcida dentro do jogo" (o termômetro na 1a, efeitos completos na Etapa 3), "Rede social do jogo" e ADR-0005; detalhe em `brasilidades.md`. Parâmetros em `app/src/params/fans.json` (`fans.*`).

**Regra em uma frase:** a torcida tem um humor de 0 a 100 que sobe quando o time faz mais do que se esperava e desce quando faz menos; na 1a, ele mexe no mando de campo e na moral do elenco, e escolhe o tom da rede social.

## Escopo

| Efeito (tabela da ADR-0005)   | Na 1a                                                          | Completo                   |
| ----------------------------- | -------------------------------------------------------------- | -------------------------- |
| Mando de campo                | **sim**: +2% a +8%, clássico +2%                               | —                          |
| Moral do elenco               | **sim**: 1 ponto por rodada na direção do termômetro           | —                          |
| Público                       | **só exibido** (número no placar e nas notícias), sem dinheiro | bilheteria na Etapa 3      |
| Pressão sobre a diretoria     | não (só a enquete na rede social, sem efeito)                  | Etapa 3/4, com a confiança |
| Incidentes (briga, invasão)   | não                                                            | Etapa 2 (STJD)             |
| Jogador vaiado pede para sair | não                                                            | Etapa 3                    |

Todos os 20 clubes têm termômetro (o da IA conta para o mando dela); só o do clube do técnico aparece na tela. As **decisões** (posts, entrevista e o ídolo no banco) só existem para clube humano, o que está em `sheets` ou `coaches` da rodada; o termômetro de um clube da IA anda só por resultado, extras e reversão.

## Fórmula (uma vez por rodada, depois da moral)

```
Δ = resultado + extras + decisões − reversão

resultado   = fans.resultWeight × (pontos ganhos − pontos esperados) × (clássico ? fans.derbyResultMult : 1)
pontos esperados = clamp(1.40 + 0.04 × d, 0.3, 2.5),  d = força própria − força do adversário ± 4 (mando)
extras      = +2 vitória por 3 gols ou mais / −2 derrota por 3 ou mais
              −1 por rodada a partir do 4º jogo seguido sem vencer
              +0,5 por rodada entre os 4 primeiros / −1 por rodada no Z4 (os dois a partir da 6ª rodada)
decisões    = clamp(soma das decisões do técnico na rodada, ±fans.decisionCap) + ídolo no banco (−1 ou 0)
reversão    = fans.reversion × (termômetro − fans.baseline)
termômetro  = clamp(termômetro + Δ, 0, 100)
```

Começa em `fans.start = 60` para todos ("começo de temporada é esperança").

**Leituras fixadas (T-014, `game-designer`, 2026-11-05):**

- **Força nos pontos esperados:** `ClubState.strength`, a força-alvo efetiva da carreira (o número da tela de Novo jogo), dos dois clubes. Não é a força do XI da rodada: a torcida espera pelo nome e pelo elenco, não pela escalação. Com a força do XI, escalar reservas baixaria a expectativa e daria termômetro de graça a quem poupa o time. Na virada para a 2ª temporada (T-017), a `strength` precisa ser recalculada depois da evolução, senão a expectativa fica presa ao elenco do ano anterior (pendência da T-017).
- **Zona:** G4 = posições 1 a 4, Z4 = 17 a 20, pela tabela **depois** da rodada (com o jogo que acabou de acontecer), as duas da 6ª rodada em diante. O jejum não tem corte de rodada: ele só existe do 4º jogo.
- **Teto das decisões:** vale só para as escolhas do técnico (posts e entrevista). O ídolo no banco entra **depois** do teto: quem responde a todos os posts não esconde o ídolo no banco. Faixa da parcela: −5 a +4.
- **Partida encerrada (W.O.):** conta pelo placar definido, nos pontos, na goleada e no jejum.

**Exemplo.** Clube médio de força 70, termômetro 50, vence em casa um grande de força 76: d = 70 − 76 + 4 = −2; esperado = 1,40 − 0,08 = 1,32; resultado = 4 × (3 − 1,32) = +6,7; reversão = 0,08 × (50 − 55) = −0,4; o técnico respondeu bem a um post (+2). Δ = 6,7 + 2 + 0,4 = +9,1 → termômetro 59. A mesma vitória num clássico: 4 × 1,68 × 1,5 = +10,1.

**Simulação (protótipo, 100 temporadas, 20 clubes):** média 53,5, desvio 16,4; abaixo de 20 em 2,8% das rodadas e acima de 90 em 0,9% (meta: média 50 a 60, no máximo 5% em cada extremo). Com `fans.reversion = 0.05` o termômetro ficava extremo demais (6,2% abaixo de 20).

**Motor (T-014, 100 carreiras, temporada 1, IA nos 20 clubes):** média 53,5, desvio 18,1; abaixo de 20 em 4,4% e acima de 90 em 1,8%. Dentro da meta, mas com pouca folga. A diferença para o protótipo é de **regra, não de calibragem**: o protótipo não tinha a moral mexendo na partida. No motor, quem vence ganha moral, a moral sobe a força (`moraleMult`, 0,95 a 1,05) e o time vence mais (no fim da temporada, moral média 86 no 1º e 20 no 20º). Com a moral congelada, ou com `moraleMult = 1`, o motor dá o protótipo: desvio 16,9, 3,1% e 1,1%. Os parâmetros da torcida estão certos; o que mudou foi a variância dos resultados.

| Variação medida (100 temporadas)                      | Desvio | < 20 | > 90 | Campeão | 17º  |
| ----------------------------------------------------- | ------ | ---- | ---- | ------- | ---- |
| T-014 como está                                       | 18,1   | 4,4% | 1,8% | 77,4    | 40,1 |
| moral congelada (sem o laço moral → partida)          | 16,9   | 3,1% | 1,1% | 75,6    | 41,2 |
| correções de 2026-11-05 (deriva, profissional, ídolo) | 18,2   | 4,4% | 1,8% | 77,4    | 39,9 |
| correções + `fans.reversion = 0.10`                   | 16,3   | 2,7% | 1,0% | 77,3    | 40,2 |
| correções + `fans.reversion = 0.12`                   | 14,7   | 1,5% | 0,4% | 76,9    | 40,1 |

As correções não mexem no termômetro: a deriva é pequena perto do ±3 do resultado, e o ídolo da IA no banco era raro na média (cerca de 0,3 rodada por clube e temporada), embora pesado no clube atingido. **Proposta para a T-016** (uma por vez, depois de "tirar o pé" e de `baseChance`): `fans.reversion` de 0,08 para **0,10**. Métrica que deve mudar: termômetro abaixo de 20, de 4,4% para cerca de 2,7%. Métricas que não podem piorar: média de 50 a 60 e o desvio acima de 15 (o termômetro tem que andar; com 0,12 ele fica parado demais), pontos do campeão e do 17º (a reversão não os mexe: 77,3 e 40,2; a meta do 17º é de 39 a 45 desde 2026-11-05, `balance-targets.md`, decisão 8).

## Decisões do técnico que mexem no termômetro (1a)

Cada decisão é de múltipla escolha; o `content-writer` escreve as falas, o motor aplica o efeito.

| Situação                    | Opções e efeito                                                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Reagir a um post da torcida | responder: +2 se termômetro ≥ 50, −2 se abaixo ("bater boca com torcida irritada piora"); ignorar: 0; dar entrevista: +1 |
| Entrevista pós-jogo         | cada opção entre −2 e +2, escolhida pelo `content-writer` dentro dessa faixa, sempre com uma opção 0                     |
| Deixar o ídolo no banco     | −1 por rodada a partir da 2ª seguida, com o ídolo apto (`jogadores.md`); fora do teto                                    |

`fans.decisionCap = 4`: o técnico não "farma" torcida respondendo a todos os posts. A interface nunca mostra o número da decisão, só a reação ("a torcida gostou").

**Quem pode decidir (regra em uma frase):** cada técnico decide só pela torcida do próprio clube.

- **Motor:** `RoundInput.fanDecisions` só é lido para clube humano da rodada (em `sheets` ou `coaches`). Chave de clube da IA, de clube fora do estado ou valor que não é número finito: ignorada, com aviso (`round-fan-decision-not-human`, `round-unknown-club`, `round-invalid-fan-decision`).
- **Liga online (1b):** o servidor monta o `RoundInput`. Ele grava a decisão de um técnico só na chave do clube ligado à sessão dele, e nunca lê o `clubId` do pedido do aparelho. Um humano não decide pelo clube de outro humano nem por um da IA. Requisito para a 1b (`architect` e `security-auditor`); o filtro do motor é a segunda trava, não a única.

## Efeitos

**Mando:** `home = match.homeBase + 0,02 + 0,06 × termômetro / 100 (+ 0,02 em clássico)`; ver `partida.md`. Termômetro 20 → +3,2% da torcida; 90 → +7,4%.

**Moral:** `fans.moraleDrift = 1` ponto por rodada na direção do termômetro para todos do elenco (jogador com moral 50 e torcida 80 sobe 1), **sem passar dele**: `deriva = clamp(termômetro − moral, −1, +1)`, com a moral e o termômetro do início da rodada (moral 79,5 e torcida 80 sobe 0,5). Igual para todos os traços, para cima e para baixo: o profissional sofre metade das quedas por resultado e por banco, não da deriva (ADR-0005 fixa 1 ponto). Detalhe em `jogadores.md`, "Moral por rodada".

**Público (só exibição na 1a):**

```
público = round(capacidade × clamp(fans.baseOccupancy × demanda × (clássico ? 1.25 : 1), 0.10, 1.00))
demanda = 0.6 + 0.7 × termômetro / 100        (0,6 a 1,3, como na ADR-0005)
```

Com `fans.baseOccupancy = 0.62` e termômetro 55, a ocupação é 61% (meta da Etapa 3: 55% a 70%). Termômetro 90 em clássico: 95% (`0.62 × 1.23 × 1.25`); o estádio só fica cheio em clássico com termômetro 99 ou mais, e fora de clássico nunca passa de 81%. O número aparece no placar e nas notícias ("casa cheia", "estádio vazio"); bilheteria e faixas de ingresso entram na Etapa 3.

## Humor da rede social

O termômetro escolhe o tom dos posts dos torcedores comuns e dos perfis da torcida; os fatos (gol, derrota, contratação) escolhem o assunto.

| Faixa  | Humor       | Exemplo de tom (o `content-writer` escreve) |
| ------ | ----------- | ------------------------------------------- |
| 0–19   | revolta     | "fora todo mundo"                           |
| 20–39  | irritada    | cobrança, ironia                            |
| 40–59  | desconfiada | "vamos ver"                                 |
| 60–79  | animada     | elogio, esperança                           |
| 80–100 | em festa    | "melhor time do mundo"                      |

O torcedor fanático exagera: usa a faixa acima ou abaixo da real, na direção do último resultado. A enquete "deve demitir o técnico?" aparece abaixo de 25 com o resultado `sim = 100 − termômetro ± Rng.int(0, 5)` %, sem efeito mecânico na 1a. A aba pode ser desligada nas configurações sem mudar o termômetro.

## Parâmetros (`app/src/params/fans.json`)

| Parâmetro              | Valor inicial | Faixa           | Por quê                                      |
| ---------------------- | ------------- | --------------- | -------------------------------------------- |
| `fans.homeBonusMin`    | 0,02          | fixo (ADR-0005) | torcida fria                                 |
| `fans.homeBonusMax`    | 0,08          | fixo (ADR-0005) | torcida em festa                             |
| `fans.derbyBonus`      | 0,02          | fixo (ADR-0005) | clássico                                     |
| `fans.moraleDrift`     | 1             | fixo (ADR-0005) | moral segue a torcida devagar                |
| `fans.start`           | 60            | 30–80           | esperança de início de temporada             |
| `fans.baseline`        | 55            | 40–70           | para onde o humor volta sem resultados       |
| `fans.resultWeight`    | 4             | 1–8             | uma vitória inesperada vale cerca de +7      |
| `fans.derbyResultMult` | 1,5           | 1–3             | clássico mexe mais                           |
| `fans.reversion`       | 0,10 (T-016)  | 0–0,2           | mantém os extremos raros (protótipo)         |
| `fans.decisionCap`     | 4             | 0–10            | decisões contam, sem virar fazenda de pontos |
| `fans.baseOccupancy`   | 0,62          | 0,3–1           | 61% de ocupação com humor médio              |

Os quatro primeiros são valores fixos da ADR-0005 (o `match.homeBase` da ADR-0011 soma por fora): o validador aceita só o valor exato (faixa = valor), e mudar é ADR, não `/balance`. Ficam no JSON para o motor recebê-los como argumento junto com o resto. **Constantes:** extras de goleada, jejum e zona; multiplicador de clássico do público; faixas de humor.

## Casos de borda

| Caso                                      | Regra                                                                                                  |
| ----------------------------------------- | ------------------------------------------------------------------------------------------------------ |
| Termômetro passaria de 100 ou de 0        | corta na borda                                                                                         |
| Clube sem capacidade de estádio na lista  | usa o padrão por porte: grande 45.000, médio 30.000, pequeno 15.000                                    |
| Partida encerrada por menos de 7          | conta como resultado normal para a torcida                                                             |
| Decisão enviada para clube da IA          | ignorada, com aviso; o termômetro da IA não recebe decisões nem o ídolo no banco                       |
| Ídolo lesionado ou suspenso fora de campo | não conta como "no banco" e zera o contador                                                            |
| Nova temporada (opção B)                  | termômetro volta para `fans.start`, mais 5 para o campeão e menos 5 para quem terminou entre 13º e 16º |
| Aba da rede social desligada              | o termômetro continua igual; só os posts somem                                                         |
