---
title: 'Quem pode ser campeão?'
date: 2026-11-06
summary: 'Mil temporadas simuladas mostram que os 20 clubes podem ser campeões, quanto a sorte pesa em 10, 100 e 1.000 temporadas e quanto um bom técnico ajuda em cada clube.'
tags: ['balanceamento', 'simulação', 'campeonato', 'zebras', 'decisões']
etapa: 1
---

No post anterior mostramos que uma partida isolada é muito aleatória e que só a média de milhares de jogos diz se o motor está calibrado. Hoje fazemos a pergunta de quem joga: quem pode ser campeão? Para responder, simulamos 1.000 temporadas completas, 380.000 partidas, com a inteligência artificial comandando os 20 clubes da Série A. Os números abaixo vêm dessa simulação, e deixamos claro o que ela mede e o que o jogo ainda não tem.

## Como a medição funciona

A ferramenta de balanceamento joga temporadas seguidas com sementes diferentes (a semente é o número inicial do gerador pseudoaleatório, explicado no post anterior), junta os resultados e compara cada medida com uma meta. As metas foram definidas antes da simulação. Cada uma vem de um comportamento do campeonato brasileiro real ou de uma decisão de diversão. Em todas as 40 metas obrigatórias, o resultado ficou dentro da faixa.

Uma ressalva importante: tudo aqui é **temporada única**, ou seja, cada temporada começa com os clubes na força inicial. Não há mercado, base de jovens nem carreira longa no jogo ainda. Mais adiante falamos do pouco que já medimos de temporadas em sequência.

## Quem ganha o título

![Gráfico de barras com os títulos de cada clube em 1.000 temporadas simuladas: Flamingo 260, Palmeral 172, Cruzador 131, Fluminário 108, Tufão 77, Baião 65, Minério 48, Bragantão 28, Santões 28, São Paulão 20, Coritibom 18, Botafogueira 17, Vitorioso 6, Vasconcelos 5, Grêmeos 5, Miragol 4, Corinto 3, Inter-Regional 3, Chapecão 1, Remador 1. Todos os 20 clubes ganharam ao menos um título.](/devlog/2026-11-06/titulos-por-clube.svg)

Cada clube tem uma **força**, um número que resume o nível do elenco. Na escada inicial, o Flamingo tem 78, o Palmeral 77, o Cruzador 76, e a escada desce até o Remador e o Chapecão, com 64. O resultado:

- O Flamingo, o mais forte, ganhou 260 vezes, ou 26,0% dos títulos. Palmeral e Cruzador somaram 172 e 131.
- **Os 20 clubes ganharam ao menos um título.** Remador e Chapecão, os dois últimos da escada, ganharam um cada. É o mínimo, então o resultado está no limite: com outra sequência de sorteios, um deles poderia ficar com zero.
- Os clubes de porte grande ficam com 80,0% dos títulos. Um clube de porte pequeno é campeão em 3,3% das temporadas. O Coritibom, de porte médio, ganhou 18 vezes (1,8%).
- Os 6 mais fortes da escada levam o título em 82,9% das temporadas.

### Como a força inicial de cada clube é definida

- **Um degrau de uma escada fixa.** São 20 valores, de 78 a 64 (78, 77, 76, 75, 74, 73, 72, 72, 71, 70, 70, 69, 68, 68, 67, 66, 65, 65, 64, 64). O 1º colocado da classificação de referência recebe 78, o 2º recebe 77, e assim por diante. A classificação de referência é a tabela da temporada base, que hoje é a de 2026.
- **Vem do desempenho recente, não da torcida nem da história.** O porte (grande, médio ou pequeno) muda torcida, estádio e a paciência da diretoria, mas não a força. Corinto e Inter-Regional são clubes de porte grande, mas estavam na zona de rebaixamento nessa classificação, por isso começam como o 17º e o 18º mais fortes, com 65 cada, e ganharam 3 títulos cada em 1.000 temporadas. Numa carreira, um grande em crise deve ter mais facilidade para voltar ao topo, com mais receita e mais torcida, mas isso depende de sistemas que ainda não existem (mercado, finanças e carreira longa).
- **A escada é fixa para manter o equilíbrio.** A mesma distribuição de forças toda temporada deixa estáveis as metas de gols e de pontos.
- **Cada carreira varia um pouco.** Ao começar, cada clube fica um pouco acima ou abaixo do seu degrau (variação de cerca de 1,5 ponto), para nenhuma carreira ser igual à outra.

**Ela pode mudar:**

- **A cada ano.** A lista de clubes é atualizada com a tabela da temporada que terminou e a escada é redistribuída. Um clube que termina em 3º lugar, por exemplo, recebe o 3º degrau (76) no ano seguinte.
- **Média das últimas três tabelas.** Estudamos usar a média das três últimas classificações, com mais peso na mais recente, e deixamos a ideia para a próxima atualização anual. Ela concentra títulos nos grandes.
- **Dentro da carreira.** A força muda de temporada para temporada, porque os jogadores evoluem e envelhecem.
- **Nas próximas etapas.** Mercado, base, finanças, estrutura e SAF também vão mexer na força. Falamos disso na seção "Isto é uma base", mais abaixo.

#### Por que o fundo da escada subiu

Na primeira versão da escada, o último colocado tinha 62 de força e a diferença do 1º ao 20º era de 16 pontos. Com ela, os dois mais fracos não ganhavam nenhum título em 1.000 temporadas. Decidimos que todo clube precisa ter chance real de ser campeão, então subimos o fundo: Inter-Regional foi para 65, Remador para 64 e Chapecão para 64. Os outros 17 clubes não mudaram, e a distância do 1º ao 20º caiu de 16 para 14 pontos.

Testamos duas outras saídas antes de decidir:

- **Mais variação de força por carreira.** Aumentar a variação de cerca de 1,5 ponto foi testado e não ajudou o clube mais fraco.
- **Média das últimas 3 tabelas.** Estudamos e adiamos, porque ela concentra os títulos nos clubes grandes.

O campeão faz em média 75,0 pontos, e o 17º colocado, o primeiro dentro da zona de rebaixamento, faz 40,6. No campeonato brasileiro real, o campeão costuma ficar entre 72 e 82 pontos, e o 17º fez cerca de 42 em média.

### Quantas temporadas até a ordem aparecer

Os 1.000 títulos acima vêm de uma sequência de temporadas. As 10 e as 100 primeiras dessa mesma sequência (mesma semente, mesmas temporadas, só interrompidas mais cedo) mostram o que acontece com menos amostra:

| Clube          | Força | 10 temporadas (títulos) | 100 temporadas (%) | 1.000 temporadas (%) |
| -------------- | ----- | ----------------------- | ------------------ | -------------------- |
| Flamingo       | 78    | 5                       | 36%                | 26,0%                |
| Palmeral       | 77    | 2                       | 14%                | 17,2%                |
| Cruzador       | 76    | 0                       | 12%                | 13,1%                |
| Fluminário     | 75    | 1                       | 11%                | 10,8%                |
| Tufão          | 74    | 1                       | 6%                 | 7,7%                 |
| Baião          | 73    | 0                       | 0%                 | 6,5%                 |
| Minério        | 72    | 1                       | 8%                 | 4,8%                 |
| Santões        | 72    | 0                       | 3%                 | 2,8%                 |
| Bragantão      | 71    | 0                       | 2%                 | 2,8%                 |
| São Paulão     | 70    | 0                       | 2%                 | 2,0%                 |
| Coritibom      | 70    | 0                       | 3%                 | 1,8%                 |
| Botafogueira   | 69    | 0                       | 1%                 | 1,7%                 |
| Vitorioso      | 68    | 0                       | 0%                 | 0,6%                 |
| Vasconcelos    | 68    | 0                       | 0%                 | 0,5%                 |
| Grêmeos        | 67    | 0                       | 1%                 | 0,5%                 |
| Miragol        | 66    | 0                       | 0%                 | 0,4%                 |
| Corinto        | 65    | 0                       | 0%                 | 0,3%                 |
| Inter-Regional | 65    | 0                       | 1%                 | 0,3%                 |
| Remador        | 64    | 0                       | 0%                 | 0,1%                 |
| Chapecão       | 64    | 0                       | 0%                 | 0,1%                 |

O que a tabela ensina é a **lei dos grandes números**: quanto mais vezes se repete um sorteio, mais a frequência observada se aproxima da chance verdadeira. Em 10 temporadas, a ordem parece embaralhada. O Flamingo ganhou 5 das 10, ou 50%, quase o dobro da chance real de 26,0%; o Cruzador, o terceiro mais forte e com 13,1% de chance por temporada, não ganhou nenhuma; só 5 clubes diferentes foram campeões. Em 100, a ordem do topo já aparece, mas ainda há ruído: o Baião, com 6,5% de chance real, não ganhou nenhuma em 100 temporadas, e o Minério ganhou 8% quando a chance real é de 4,8%. Em 1.000, cada clube já está perto da sua chance real, e os 20 aparecem.

Para quem joga, isso quer dizer que numa carreira de 10 temporadas a sorte ainda pesa muito. Um clube de chance real de 13% por ano, como o Cruzador, passa 10 anos sem título com probabilidade de cerca de 25% (o cálculo é 0,869 elevado a 10). A força do elenco muda a chance de cada ano, mas não garante o resultado de uma carreira só.

### Uma comparação honesta com o campeonato real

Entre 2006 e 2025, o campeonato brasileiro de pontos corridos teve 8 campeões diferentes em 20 temporadas, e os dois maiores ganharam 4 vezes cada, 20% dos títulos. No jogo, o clube mais forte leva 26,0% dos títulos, e os 20 clubes ganham ao menos um. É mais concentrado no topo do que o real, e ainda não decidimos se isso é um defeito: na temporada única a escada de forças é fixa, e uma diferença de 14 pontos entre o primeiro e o último é o que a lista de clubes de 2026 dá, com o fundo mais alto. Na carreira longa, a meta aprovada é de no máximo 30% dos títulos com um só clube em 30 temporadas, com 7 a 12 campeões diferentes. Isso só vai poder ser medido quando a carreira longa existir.

Há ainda uma diferença de calendário. No campeonato real, os clubes do topo disputam mais de uma competição ao mesmo tempo (copas nacionais e torneio continental), dividem o elenco e as datas entre elas, e esse desgaste tira pontos deles na liga. No jogo, por enquanto, só existe a Série A, então o clube mais forte não sofre esse desgaste e tende a ficar ainda mais concentrado no topo. As copas entram em etapas futuras, e o efeito do calendário só será medido quando elas existirem; hoje não há meta numérica para ele.

## Por que o mais forte nem sempre ganha

Uma temporada tem 38 rodadas, e cada jogo é decidido por sorteio, com a probabilidade pesada pela diferença de força. Três números mostram o tamanho da aleatoriedade por jogo:

| Situação                                    | Resultado |
| ------------------------------------------- | --------- |
| Time 20 pontos mais forte vence             | 62,8%     |
| Time 30 pontos mais fraco vence (a "zebra") | 8,3%      |
| Empates, em todos os jogos                  | 26,2%     |

Quem é 20 pontos mais forte vence quase dois jogos em cada três, e não três em cada três. O restante é empate ou derrota. O texto do projeto dizia "cerca de 65%". Medimos 62,8% e ajustamos a meta para uma faixa de 62% a 68%, com centro em 63%. Com o motor atual, não conseguimos ao mesmo tempo 65% no favorito de 20 pontos e 10% na zebra de 30: melhorar um piora o outro. Ficamos com a faixa mais realista e documentamos o motivo.

Ao longo de 38 jogos, a diferença de força se acumula, mas o acaso também. Por isso o Flamingo, com a maior força, ganha pouco mais de um título em cada quatro temporadas, e não em todas.

## Zebras: o fraco no G4 e a arrancada contra o rebaixamento

Chamamos de **G4** os quatro primeiros colocados e de **Z4** os quatro últimos, a zona de rebaixamento. Duas metas medem se a tabela deixa espaço para surpresa.

**Clube fraco no G4.** Os 4 mais fracos da escada inicial (Corinto, Inter-Regional, Remador e Chapecão) terminam entre os 4 primeiros em 7,1% das temporadas. A meta é de 5% a 15%, com centro em 10%. A referência real: de 2006 a 2025, clubes recém-promovidos da segunda divisão terminaram no G4 em 5 das 20 temporadas; tirando os de porte grande, que voltaram com elenco forte, foram 2 em 20 (10%).

**Fuga do Z4.** Olhamos os clubes que estavam entre os quatro últimos depois da rodada 30, quando faltam 8 rodadas, e vimos quantos escaparam. Resultado:

- Dos clubes no Z4 depois da rodada 30, **21,1%** se salvam. A meta é de 15% a 30%.
- Dos que estavam de 6 a 8 pontos atrás do 16º colocado, só **7,7%** se salvam. A meta é de ao menos 3%. Com 9 pontos ou mais de distância, o milagre quase não existe, como no futebol real.

Uma arrancada é rara, mas existe: algo como um clube por temporada sai do Z4 nas últimas 8 rodadas.

### O que não está na meta

A simulação mostra uma coisa que não bate com a meta: em 96,8% das temporadas, ao menos um clube de porte grande é rebaixado. A meta era de 40% a 80%. Isso acontece porque 12 dos 20 clubes são de porte grande, então, com 4 rebaixados por temporada, quase sempre cai ao menos um. Decidimos deixar essa medida como informativa na temporada única, e ela volta a valer na carreira longa.

## O projeto de longo prazo do clube médio

Queremos que um técnico bom consiga, depois de algumas temporadas, levar um clube médio ao título, mesmo que demore. A regra que fixamos é: cerca de 10 temporadas de trabalho, e não 1 nem 3.

Como medir isso sem esperar o jogo ficar pronto? A ferramenta tem um **técnico-robô**, um programa que joga como um humano que joga bem: escolhe o melhor time por condição física e moral, roda o elenco nas semanas com dois jogos, escolhe formação, postura e pressão contra o adversário da rodada e usa a conversa do intervalo conforme o placar. Colocamos o robô no comando de um clube e comparamos com a IA padrão no mesmo clube e nas mesmas sementes. Assim só a diferença de decisão aparece. Repetimos isso em 5 clubes, do topo ao fundo da escada, com 1.000 temporadas pareadas cada um:

| Clube     | Força | Pontos: IA | Pontos: robô | Ganho (pontos) | Título: IA | Título: robô | G4: IA | G4: robô |
| --------- | ----- | ---------- | ------------ | -------------- | ---------- | ------------ | ------ | -------- |
| Flamingo  | 78    | 65,7       | 67,4         | +1,8           | 26,0%      | 30,7%        | 62,9%  | 71,3%    |
| Tufão     | 74    | 58,6       | 60,6         | +2,0           | 7,7%       | 9,7%         | 35,7%  | 44,7%    |
| Coritibom | 70    | 51,4       | 55,3         | +3,9           | 1,8%       | 3,2%         | 13,5%  | 20,7%    |
| Corinto   | 65    | 43,5       | 46,4         | +2,8           | 0,3%       | 0,1%         | 3,1%   | 4,4%     |
| Chapecão  | 64    | 42,3       | 44,6         | +2,3           | 0,1%       | 0,0%         | 1,7%   | 3,0%     |

O ganho é a média da diferença temporada a temporada, por isso pode diferir em 0,1 da subtração das duas médias arredondadas. Os intervalos de confiança de 95% do ganho são: Flamingo de 1,3 a 2,2; Tufão de 1,5 a 2,5; Coritibom de 3,4 a 4,4; Corinto de 2,4 a 3,3; Chapecão de 1,9 a 2,7.

O que a tabela mostra:

- **O técnico bom ajuda mais no meio da tabela.** O Coritibom ganha 3,9 pontos por temporada; o Flamingo, no topo, +1,8; o Chapecão, no fundo, +2,3. A meta de +2 a +8 pontos vale para o Coritibom, o clube médio de referência, e ficou dentro. Não medimos por que o ganho é menor nas pontas; uma explicação plausível é que, no topo, o time já vence muito e sobra pouco a ganhar, e que, no fundo, o elenco limita o que a decisão consegue mudar.
- **No clube médio o título dobra, mas continua raro.** O Coritibom vai de 1,8% para 3,2% de título numa temporada e de 13,5% para 20,7% de G4, abaixo do teto de 5% que fixamos para o título de um clube médio.
- **No mais fraco, o G4 quase dobra, mas o título não vem numa temporada só.** O Chapecão com o robô chega ao G4 em 3,0% das temporadas, contra 1,7% com a IA, e a meta era de ao menos 2%.
- **Alguns números de título são ruído.** O Corinto tem 0,1% com o robô contra 0,3% da IA, e o Chapecão 0,0% contra 0,1%. Isso é 1 a 3 títulos em 1.000 temporadas: amostra pequena demais para dizer que o robô piora alguma coisa. Os ganhos em pontos e em G4, que têm mais ocorrências, são mais confiáveis.

Para o título de um clube médio vir em cerca de 10 temporadas, o clube precisa de um título em cerca de 7% das temporadas, o que exige uma força perto de 76, a dos três mais fortes. Isso significa algo como +4 a +6 de força em 6 a 8 temporadas. Esse ganho não pode vir da partida: tem que vir de coisas que a carreira longa ainda vai ter, como receita que cresce com os resultados, base de jovens e reputação do técnico.

### O que existe hoje e o que vem

Hoje, o jogo **não tem** mercado de jogadores, base, finanças nem carreira longa. O projeto de longo prazo do clube médio é a meta de design que esses sistemas vão ter de cumprir, e a medição dele (mediana de 10 temporadas até o primeiro título, de 7 a 15) só vai poder ser feita quando eles existirem. A mesma regra tem um freio: no máximo 10% das carreiras com título antes da quinta temporada, para o clube médio não virar potência fácil.

## E em temporadas seguidas?

Quando uma temporada acaba, o jogo começa outra com os mesmos 20 clubes, sem fim de carreira. Medimos cadeias de 3 temporadas, em 200 carreiras, com a evolução dos jogadores e a moral da virada. Das 93 metas obrigatórias medidas, 92 ficaram dentro da faixa. Os números das temporadas 1, 2 e 3: campeão grande em 86,0%, 82,5% e 86,0%, e clube fraco no G4 em 7,0%, 6,0% e 7,0%. O campeão grande, o clube fraco no G4 e o campeão pequeno são só informativos a partir da segunda temporada da cadeia, porque com 200 carreiras a margem de erro é de alguns pontos. O que garante que a liga não muda de cara entre as temporadas é uma trava de deriva, que continua obrigatória: a diferença de força entre grandes e não grandes, e entre os 4 mais fortes e os 4 mais fracos, não pode mudar mais que 0,5 ponto da temporada 1 à 3. Ela mudou entre -0,01 e +0,02, bem dentro do limite, e a força média da liga subiu 0,93 na temporada 3, dentro do limite de 1,0.

A meta que ficou fora é o **campeão pequeno na temporada 2**: 4,5%, ou 9 títulos em 200 carreiras, acima do teto de 4%. Com 200 carreiras, a margem de erro dessa medida é de cerca de 1,5 ponto, então é provável que seja amostra, e na temporada 3 o mesmo número voltou para 2,0%. Por isso decidimos tratar essa medida como informativa a partir da segunda temporada da cadeia, como as outras duas, e manter a trava de deriva obrigatória.

Há também um limite honesto: nessas cadeias os elencos só envelhecem. Em cadeias de 10 temporadas, a idade média vai de 26 para 35 anos e não aparece mais jogador jovem a partir da sexta temporada. Por isso a renovação dos elencos (aposentadoria e novos jovens) é a próxima tarefa do motor, antes de qualquer carreira longa.

## Isto é uma base

Tudo o que mostramos acima é a **base**: a temporada única da Série A, com a IA comandando os 20 clubes, elencos novos e a força de cada clube tirada da lista. Ela diz quanto pesam a força do elenco, a sorte e as decisões do técnico num ano. **Não leva em conta o que pode fortalecer um clube e acelerar um título ao longo dos anos, e nada disso está implementado.** Os números de hoje vão mudar quando esses sistemas existirem.

Duas observações para ler a lista sem mal-entendido. "Já está no motor" quer dizer que a regra está pronta e entra nas simulações; as telas para jogar ainda estão sendo feitas, então ainda não dá para jogar. E o que está na coluna da direita é plano, não medição: as metas, como "um clube médio campeão em cerca de 10 temporadas", só serão medidas quando os sistemas existirem.

| Já está no motor e entra nas simulações                          | Ainda não está no jogo                                                             |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------------------- |
| Táticas: formação, postura e pressão                             | Mercado e transferências: Etapa 3                                                  |
| Condição física e rodízio                                        | Empréstimos: Etapa 3                                                               |
| Moral do elenco                                                  | Olheiros: Etapa 5                                                                  |
| Torcida e mando de campo (e clássicos)                           | Categoria de base: Etapas 3 e 4 (antes, só a renovação dos elencos)                |
| Evolução dos jogadores no fim da temporada                       | Finanças e receita: Etapa 3                                                        |
| Comandos e substituições durante o jogo, e conversa no intervalo | Estádio e ingresso: Etapa 3                                                        |
| Acaso: forma do dia, zebras e variação de força de cada carreira | Estrutura (centro de treinamento, departamento médico) e comissão técnica: Etapa 3 |
|                                                                  | Reputação do técnico e propostas de outros clubes: Etapa 4                         |
|                                                                  | Diretoria, com metas, confiança e paciência: Etapa 4                               |
|                                                                  | SAF no clube do técnico: Etapa 4                                                   |
|                                                                  | SAF também nos clubes da IA: só ideia, prevista para a Etapa 4, ainda sem regra    |
|                                                                  | Copa do Brasil: Etapa 2; Libertadores e Sul-Americana: Etapa 5                     |

SAF é a Sociedade Anônima do Futebol, o clube-empresa com dono investidor. No clube do técnico, a ideia é que a oferta de um investidor seja uma escolha que a diretoria apresenta, com caixa de uma vez e obras mais rápidas, em troca de metas mais duras e uma diretoria com menos paciência. Nos clubes da IA, a ideia é criar rivais que crescem de repente e mexem na briga pelo título ao longo dos anos, o que combina com o princípio de que todos podem ser campeões. Mas ela precisaria de freios (um limite de casos por temporada, um teto de ganho de força e a saída do investidor para não virar dinastia eterna) e ainda não tem regra.

Hoje, o que o técnico controla é o conjunto de decisões de jogo, que vale cerca de 4 pontos por temporada num clube médio. Isso basta para brigar por vaga, mas raramente leva um clube médio ao título numa temporada só.

## O que vem a seguir

A renovação dos elencos é a próxima tarefa do motor. Depois vêm as telas para jogar. A medição de como os clubes sobem e descem ao longo de 30 anos só começa quando existirem mercado, base e finanças, e não temos data para isso.

## Pergunta da semana

Quantas temporadas você aceitaria trabalhar para levar um clube médio ao título: 5, 10 ou 15? E, na sua cabeça, o campeão tem que ser quase sempre um dos seis mais fortes ou você quer ver zebra no topo com frequência, mesmo que o último colocado só ganhe uma vez em mil temporadas? Conte nas [Discussões](https://github.com/Guidcruz/prancheta/discussions) do projeto.

Acompanhe no devlog: o próximo post sai na semana que vem.
