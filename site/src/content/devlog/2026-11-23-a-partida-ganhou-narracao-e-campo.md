---
title: 'A partida ganhou narração, campo 2D e uniformes'
date: 2026-11-23
summary: 'Agora dá para assistir à partida: placar ao vivo, narração em texto, pausa dramática antes do gol e um campo 2D com bolinhas nas cores dos uniformes. Tem ainda a Tabela, o Calendário e um bug do Safari com movimento reduzido.'
tags: ['partida', 'campo 2D', 'uniformes', 'telas', 'acessibilidade', 'safari']
etapa: 1
---

Até o post anterior, a rodada era jogada e você via o resultado. Nesta semana a partida passou a ser **assistida**: ela roda minuto a minuto na tela, com narração, e na versão completa com um campo visto de cima. O post conta como isso funciona, o que medimos e um bug do Safari que só apareceu porque testamos no WebKit. Antes, as telas de consulta que entraram no caminho: Tabela e Calendário.

## Tabela e Calendário

- **Tabela:** a aba mostra a classificação completa, com pontos, jogos, vitórias, empates, derrotas, gols pró e contra, saldo, aproveitamento e os últimos 5 jogos. A coluna do clube fica fixa (no máximo 60% da largura) e a tabela abre já na linha do seu clube. Só há duas zonas marcadas: o líder e os 4 últimos (rebaixamento), cada uma com uma marca, uma palavra e uma legenda. A cor nunca é a única pista. A setinha de subida e descida dura 300 ms e fica parada se o aparelho pede movimento reduzido.
- **Calendário:** as 38 rodadas em dois turnos, um card por rodada com data, mando e, nas jogadas, o placar e o resultado escrito. A aba abre no próximo jogo, destacado com borda verde. Tocar numa rodada jogada abre os 10 jogos dela, e cada um abre a súmula.
- **Rótulo fixo:** ao rolar as colunas para o lado, o nome da linha (clube na Tabela, jogador no Elenco) agora fica no lugar. Antes, ele rolava junto e você perdia de quem eram os números.

## Uniformes gerados por código

Nenhum uniforme é uma imagem: cada um é um desenho gerado a partir do identificador e das cores do clube, assim como os escudos.

- **10 padrões de camisa.** O padrão de cada clube é sorteado de forma fixa a partir do seu identificador (o mesmo clube tem sempre o mesmo padrão) e **nunca é do mesmo tipo do padrão do escudo**, para camisa e escudo não parecerem repetidos.
- **Uniformes 1, 2 e 3.** O mandante usa sempre o 1. O visitante usa o 1, o 2 ou o 3, na ordem, até as cores deixarem de se confundir. Medimos a confusão com uma distância de cor (ΔE, uma medida de quanto duas cores se parecem para o olho humano) e exigimos pelo menos 30. Num campeonato de 380 jogos, o visitante troca para o uniforme 2 em 44 e chega ao 3 em 6.
- **Goleiro com cor própria.** Cada clube tem uma cor de goleiro estável, trocada só quando conflita com as outras.
- **Contraste do número.** O número da camisa precisa de pelo menos 4,5:1 de contraste com o fundo. Em 14 de 80 uniformes testados nem isso bastou com o número solto, e eles ganham uma placa atrás do número.

Os uniformes ainda não têm tela própria: eles aparecem no campo 2D, logo abaixo.

## A partida narrada

Ao tocar em "Jogar rodada", o botão tem um seletor de **tipo de partida**: "Só resultado" (como antes), "Só lances principais" e "Animada completa". O tipo escolhido vale para as rodadas seguintes e pode ser trocado quando você quiser.

Em "Só lances principais", a partida abre em tela cheia:

- **Placar ao vivo** com o minuto e a fase do jogo.
- **Narração em texto**, com a linha mais recente em cima.
- **Pausa dramática.** Gols, chances claras e pênaltis têm um tempo de suspense: o começo do lance é escrito de modo que **não entrega** o desfecho, e o placar só muda quando o resultado é revelado.
- **Controles:** Pausar e Retomar (a pausa termina o minuto em curso), Rápido (lembrado no aparelho) e Pular, que grava a rodada e abre o resumo direto.

Um ponto importante de projeto: **a tela não decide nada**. O motor de simulação já calculou a partida inteira, da mesma forma e com a mesma semente do modo "Só resultado". A tela só decide **quando mostrar** cada lance. Por isso os três tipos de partida dão exatamente o mesmo jogo.

Medimos a duração com 60 partidas do motor. Em "Só lances principais", cada minuto sem lance dura 180 ms no Normal e 70 ms no Rápido, e uma partida leva em média **28,8 s no Normal e 11,4 s no Rápido**. A partida também pausa sozinha quando a página fica escondida, e o botão voltar do celular pausa e pergunta o que fazer, em vez de sair sem jogar. No apito final, a rodada é gravada sozinha.

Também medimos a resposta da tela com a CPU desacelerada 4 vezes, para simular um celular modesto: do toque até a partida aparecer, 90% das vezes abaixo de 100 ms (a meta era 300 ms); de "Pular" até o resumo, entre 237 e 319 ms (meta 500 ms), e nenhuma tarefa longa travou a tela entre o apito inicial e o final.

## O campo 2D

Na "Animada completa", entre o placar e a narração, entra o campo visto de cima, desenhado em **canvas** (uma área de desenho do navegador, em que o código pinta quadro a quadro).

- **Bolinhas nas cores dos uniformes**, com um anel escuro. O visitante tem **um ponto no centro**, e o mandante fica sempre à esquerda, então nenhuma informação depende só da cor.
- **A coreografia é decorativa.** Os movimentos usam uma semente própria e não mudam o resultado, que vem do motor. Até o desfecho, o começo de um gol é igual ao de uma chance do mesmo tipo, para o suspense continuar valendo.
- **Câmera lenta na pausa dramática.**
- **Comemoração de gol:** o escudo de quem marcou, a palavra "Gol!" e o nome do artilheiro sobre o campo, durante o passo seguinte ao gol. Ela fica escondida do leitor de tela, que já ouve o anúncio do gol.
- **Se o canvas falhar**, ou o código do campo não carregar, a partida segue sem o campo, sem aviso, com um registro do erro.
- **No celular deitado e no computador**, a tela vira duas colunas: cabeçalho e campo à esquerda, placar e narração à direita.

O ritmo também mudou: na "Animada completa", o minuto sem lance dura **800 ms no Normal e 300 ms no Rápido**. Em 60 partidas do motor, isso deu em média **78,7 s por partida no Normal** (de 69,4 a 92,8 s) e **29,9 s no Rápido** (de 26,1 a 35,7 s). Numa temporada, são cerca de 50 minutos de partida no Normal. A "Animada completa" é o padrão de uma carreira nova; quem já tinha outro tipo escolhido continua com ele.

### O custo no aparelho

O código da tela da partida e o do campo são baixados **sob demanda**, só quando você abre uma partida, e os dois ficam guardados para uso **offline**. O do campo tem 7,1 KB comprimido (gzip), com teto de 20 KB. Com a CPU 4 vezes mais lenta, numa tela de 390 × 844 com densidade de pixels 3:

| Medida                                 | Resultado   | Meta  |
| -------------------------------------- | ----------- | ----- |
| Intervalo entre quadros (percentil 95) | 16,8 ms     | 34 ms |
| Desenhar um quadro (mediana)           | 0,5 ms      | 6 ms  |
| Canvas, em pixels por pixel CSS        | no máximo 2 | -     |

16,8 ms entre quadros é o ritmo de 60 quadros por segundo.

## Movimento reduzido: o bug do Safari

Quem ativa "reduzir movimento" no sistema recebe o campo **parado**: um quadro por lance, sem animação, e a comemoração aparece sem movimento. O mecanismo original lia essa preferência com uma consulta de mídia (`matchMedia`) e ouvia o evento de mudança.

Nos testes automáticos do **WebKit** (o motor do Safari), a partida às vezes se comportava como se a preferência estivesse desligada. A causa: no WebKit, o evento de mudança, e às vezes até o valor lido, **só se atualiza no próximo ciclo de renderização da página**. Se a tela está esperando por um lance, sem nada novo a desenhar, esse ciclo pode não chegar antes do passo seguinte da partida. A primeira correção ainda dependia da consulta e não bastou.

A correção definitiva troca a fonte: a tela passou a ler o **estilo calculado** de um elemento dela (`getComputedStyle`), em que uma variável de estilo vale 1 dentro da regra `prefers-reduced-motion: reduce`. Calcular o estilo força o navegador a avaliar a regra na hora, então a leitura nunca fica atrasada. A leitura acontece **uma vez por passo da partida**, nunca por quadro, para não pesar. A comemoração de gol já seguia a mesma regra de mídia no próprio CSS.

## O escudo em cada lance

Cada lance de um time na narração e na súmula agora mostra o **escudo do clube** (24 px) logo depois do minuto, e o nome do clube continua escrito na linha. O escudo é decorativo: o leitor de tela fala o nome do clube logo depois do minuto. A altura da linha não mudou, e não há rolagem lateral de 360 a 1280 px nos três idiomas.

Junto com isso, o **placar deixou de se mexer quando a partida pausa**. Antes, a palavra "Pausada" entrava ao lado da fase do jogo, e a linha do meio do placar alargava. Numa tela de 360 px, o nome mais longo da liga ("Inter-Regional", clube fictício) passava a não caber e quebrava em duas linhas: o placar crescia 12 px e o campo descia. Agora "Pausada" ocupa o lugar da fase, numa mesma célula que sempre reserva a largura da maior das duas palavras. Como a célula já tem o tamanho final, nada muda de tamanho ao pausar ou retomar.

O mesmo teste no WebKit pegou um segundo problema: ao estreitar a tela, o campo guardava por um instante a largura antiga e passava da largura da coluna, o que causava 30 px de rolagem lateral. Agora o campo nunca passa da largura da coluna.

## O que não mudou

Nada disso mexeu no motor, no formato do save ou na versão do motor: nenhuma partida simulada mudou. Todo o trabalho foi nas telas e no que acontece entre o motor e os seus olhos.

A suíte do app está em 2.957 testes de unidade e do motor, mais 140 dos scripts e 25 do build, e 383 testes de ponta a ponta no Chromium (celular e computador), sem falhas. O WebKit roda no servidor de integração, e foi lá que o bug acima apareceu. Dois testes de ponta a ponta também ficaram mais firmes: um da sugestão de escalação com ausências, que agora é determinístico, e outro que esperava pouco depois de um gol.

## O que vem a seguir

Estamos estudando **variações da narração**, para que um mesmo tipo de lance não saia sempre com a mesma frase, e **melhorias na animação do campo**. Ainda são estudos, sem data.
