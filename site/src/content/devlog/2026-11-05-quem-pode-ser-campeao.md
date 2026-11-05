---
title: 'Quem pode ser campeão?'
date: 2026-11-05
summary: 'Mil temporadas simuladas mostram quem ganha o título, quando o fraco chega ao G4, quem escapa do rebaixamento e por que o clube médio precisa de projeto.'
tags: ['balanceamento', 'simulação', 'campeonato', 'zebras', 'decisões']
etapa: 1
---

No post anterior mostramos que uma partida isolada é muito aleatória e que só a média de milhares de jogos diz se o motor está calibrado. Hoje fazemos a pergunta de quem joga: quem pode ser campeão? Para responder, simulamos 1.000 temporadas completas, 380.000 partidas, com a inteligência artificial comandando os 20 clubes da Série A. Os números abaixo vêm dessa simulação, e deixamos claro o que ela mede e o que o jogo ainda não tem.

## Como a medição funciona

A ferramenta de balanceamento joga temporadas seguidas com sementes diferentes (a semente é o número inicial do gerador pseudoaleatório, explicado no post anterior), junta os resultados e compara cada medida com uma meta. As metas foram definidas antes da simulação. Cada uma vem de um comportamento do campeonato brasileiro real ou de uma decisão de diversão. Em todas as 39 metas obrigatórias, o resultado ficou dentro da faixa.

Uma ressalva importante: tudo aqui é **temporada única**, ou seja, cada temporada começa com os clubes na força inicial. Não há mercado, base de jovens nem carreira longa no jogo ainda. Mais adiante falamos do pouco que já medimos de temporadas em sequência.

## Quem ganha o título

![Gráfico de barras com os títulos de cada clube em 1.000 temporadas simuladas: Flamingo 259, Palmeral 182, Cruzador 131, Fluminário 96, Tufão 76, Baião 72, Minério 51, Santões 33, Bragantão 26, Coritibom 18, São Paulão 16, Botafogueira 14, Vitorioso 7, Vasconcelos 6, Grêmeos 5, Inter-Regional 3, Miragol 3, Corinto 2. Remador e Chapecão, os dois mais fracos, não ganharam nenhum.](/devlog/2026-11-05/titulos-por-clube.svg)

Cada clube tem uma **força**, um número que resume o nível do elenco. Na escada inicial, o Flamingo tem 78, o Palmeral 77, o Cruzador 76, e a escada desce até o Chapecão, com 62. O resultado:

- O Flamingo, o mais forte, ganhou 259 vezes, ou 25,9% dos títulos. Palmeral e Cruzador somaram 182 e 131.
- Dos 20 clubes, 18 ganharam ao menos um título. Só Remador (63) e Chapecão (62), os dois últimos da escada, ficaram sem nenhum.
- Os clubes de porte grande ficam com 79,8% dos títulos. Um clube de porte pequeno é campeão em 2,9% das temporadas. O Coritibom, de porte médio, ganhou 18 vezes (1,8%).
- Os 6 mais fortes da escada levam o título em 84,5% das temporadas.

A força de um clube vem da posição dele na classificação de referência usada para montar a lista, e não do tamanho da torcida nem da história. Corinto e Inter-Regional são clubes de porte grande, mas estavam na zona de rebaixamento nessa classificação, por isso começam como o 17º e o 18º mais fortes (65 e 64) e ganharam só 2 e 3 títulos. Numa carreira, um grande em crise deve ter mais facilidade para voltar ao topo, com mais receita e mais torcida, mas isso depende de sistemas que ainda não existem (mercado, finanças e carreira longa). A força é recalculada a cada atualização anual da lista de clubes: um grande que termina em 3º lugar, por exemplo, ganha o 3º degrau da escada no ano seguinte.

O campeão faz em média 75,3 pontos, e o 17º colocado, o primeiro dentro da zona de rebaixamento, faz 40,3. No campeonato brasileiro real, o campeão costuma ficar entre 72 e 82 pontos, e o 17º fez cerca de 42 em média.

### Uma comparação honesta com o campeonato real

Entre 2006 e 2025, o campeonato brasileiro de pontos corridos teve 8 campeões diferentes em 20 temporadas, e os dois maiores ganharam 4 vezes cada, 20% dos títulos. No jogo, o clube mais forte leva 25,9% dos títulos, e 18 clubes diferentes ganham ao menos um. É mais concentrado no topo do que o real, e ainda não decidimos se isso é um defeito: na temporada única a escada de forças é fixa, e uma diferença de 16 pontos entre o primeiro e o último é o que a lista de clubes de 2026 dá. Na carreira longa, a meta aprovada é de no máximo 30% dos títulos com um só clube em 30 temporadas, com 7 a 12 campeões diferentes. Isso só vai poder ser medido quando a carreira longa existir.

## Por que o mais forte nem sempre ganha

Uma temporada tem 38 rodadas, e cada jogo é decidido por sorteio, com a probabilidade pesada pela diferença de força. Três números mostram o tamanho da aleatoriedade por jogo:

| Situação                                    | Resultado |
| ------------------------------------------- | --------- |
| Time 20 pontos mais forte vence             | 62,8%     |
| Time 30 pontos mais fraco vence (a "zebra") | 8,3%      |
| Empates, em todos os jogos                  | 26,1%     |

Quem é 20 pontos mais forte vence quase dois jogos em cada três, e não três em cada três. O restante é empate ou derrota. O texto do projeto dizia "cerca de 65%". Medimos 62,8% e ajustamos a meta para uma faixa de 62% a 68%, com centro em 63%. Com o motor atual, não conseguimos ao mesmo tempo 65% no favorito de 20 pontos e 10% na zebra de 30: melhorar um piora o outro. Ficamos com a faixa mais realista e documentamos o motivo.

Ao longo de 38 jogos, a diferença de força se acumula, mas o acaso também. Por isso o Flamingo, com a maior força, ganha um título em cada quatro temporadas, e não em todas.

## Zebras: o fraco no G4 e a arrancada contra o rebaixamento

Chamamos de **G4** os quatro primeiros colocados e de **Z4** os quatro últimos, a zona de rebaixamento. Duas metas medem se a tabela deixa espaço para surpresa.

**Clube fraco no G4.** Os 4 mais fracos da escada inicial (Corinto, Inter-Regional, Remador e Chapecão) terminam entre os 4 primeiros em 5,5% das temporadas. A meta é de 5% a 15%, com centro em 10%. A referência real: de 2006 a 2025, clubes recém-promovidos da segunda divisão terminaram no G4 em 5 das 20 temporadas; tirando os de porte grande, que voltaram com elenco forte, foram 2 em 20 (10%).

**Fuga do Z4.** Olhamos os clubes que estavam entre os quatro últimos depois da rodada 30, quando faltam 8 rodadas, e vimos quantos escaparam. Resultado:

- Dos clubes no Z4 depois da rodada 30, **20,0%** se salvam. A meta é de 15% a 30%.
- Dos que estavam de 6 a 8 pontos atrás do 16º colocado, só **6,5%** se salvam. A meta é de ao menos 3%. Com 9 pontos ou mais de distância, o milagre quase não existe, como no futebol real.

Uma arrancada é rara, mas existe: algo como um clube por temporada sai do Z4 nas últimas 8 rodadas.

### O que não está na meta

A simulação mostra uma coisa que não bate com a meta: em 96,1% das temporadas, ao menos um clube de porte grande é rebaixado. A meta era de 40% a 80%. Isso acontece porque 12 dos 20 clubes são de porte grande, então, com 4 rebaixados por temporada, quase sempre cai ao menos um. Decidimos deixar essa medida como informativa na temporada única, e ela volta a valer na carreira longa.

## O projeto de longo prazo do clube médio

Queremos que um técnico bom consiga, depois de algumas temporadas, levar um clube médio ao título, mesmo que demore. A regra que fixamos é: cerca de 10 temporadas de trabalho, e não 1 nem 3.

Como medir isso sem esperar o jogo ficar pronto? A ferramenta tem um **técnico-robô**, um programa que joga como um humano que joga bem: escolhe o melhor time por condição física e moral, roda o elenco nas semanas com dois jogos, escolhe formação, postura e pressão contra o adversário da rodada e usa a conversa do intervalo conforme o placar. Ele comanda o Coritibom, e comparamos com a IA padrão no mesmo clube e nas mesmas sementes. Assim só a diferença de decisão aparece.

![Gráfico de barras do Coritibom em 1.000 temporadas pareadas. Com a IA padrão: 51,7 pontos, título em 1,8% das temporadas e G4 em 12,2%. Com o técnico-robô: 55,8 pontos, título em 4,0% e G4 em 22,1%.](/devlog/2026-11-05/robo-no-coritibom.svg)

Em 1.000 temporadas pareadas, o robô faz 55,8 pontos, contra 51,7 da IA: **+4,1 pontos**, com intervalo de confiança de 95% entre 3,7 e 4,6. A meta era de +2 a +8: abaixo de +2 as decisões do técnico não se sentem, e acima de +8 a IA estaria fraca demais ou uma tática dominaria. O título do Coritibom sobe de 1,8% para 4,0%, abaixo do teto de 5% que fixamos, e o G4 vai de 12,2% para 22,1%.

Para o título de um clube médio vir em cerca de 10 temporadas, o clube precisa de um título em cerca de 7% das temporadas, o que exige uma força perto de 76, a dos três mais fortes. Isso significa algo como +4 a +6 de força em 6 a 8 temporadas. Esse ganho não pode vir da partida: tem que vir de coisas que a carreira longa ainda vai ter, como receita que cresce com os resultados, base de jovens e reputação do técnico.

### O que existe hoje e o que vem

Hoje, o jogo **não tem** mercado de jogadores, base, finanças nem carreira longa. O projeto de longo prazo do clube médio é a meta de design que esses sistemas vão ter de cumprir, e a medição dele (mediana de 10 temporadas até o primeiro título, de 7 a 15) só vai poder ser feita quando eles existirem. A mesma regra tem um freio: no máximo 10% das carreiras com título antes da quinta temporada, para o clube médio não virar potência fácil.

## E em temporadas seguidas?

Quando uma temporada acaba, o jogo começa outra com os mesmos 20 clubes, sem fim de carreira. Medimos cadeias de 3 temporadas, em 200 carreiras, com a evolução dos jogadores e a moral da virada. As metas de gols, empates, pontos do campeão e do 17º seguem dentro da faixa nas três. O campeão grande subiu para 87% na temporada 2 e 88% na 3, acima do teto de 85%, e o clube fraco no G4 ficou em 6,0% e 5,0%. Com 200 carreiras a margem de erro é de alguns pontos, e a versão de controle, sem evolução, também passa de 85% em uma das sementes. Por isso essas duas medidas são só informativas a partir da segunda temporada da cadeia. O que fica obrigatório é uma trava de deriva: a diferença de força entre grandes e não grandes, e entre os 4 mais fortes e os 4 mais fracos, não pode mudar mais que 0,5 ponto da temporada 1 à 3.

Há também um limite honesto: nessas cadeias os elencos só envelhecem. Em cadeias de 10 temporadas, a idade média vai de 26 para 35 anos e não aparece mais jogador jovem a partir da sexta temporada. Por isso a renovação dos elencos (aposentadoria e novos jovens) é a próxima tarefa do motor, antes de qualquer carreira longa.

## O que vem a seguir

A renovação dos elencos (T-048) é a próxima tarefa do motor. Depois vêm as telas para jogar. A medição de como os clubes sobem e descem ao longo de 30 anos só começa quando existirem mercado, base e finanças, e não temos data para isso.

## Pergunta da semana

Quantas temporadas você aceitaria trabalhar para levar um clube médio ao título: 5, 10 ou 15? E, na sua cabeça, o campeão tem que ser quase sempre um dos seis mais fortes ou você quer ver zebra no topo com frequência? Conte nas [Discussões](https://github.com/Guidcruz/prancheta/discussions) do projeto.

Acompanhe no devlog: o próximo post sai na semana que vem.
