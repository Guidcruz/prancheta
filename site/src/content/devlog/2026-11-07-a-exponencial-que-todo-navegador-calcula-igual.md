---
title: 'A exponencial que todo navegador calcula igual'
date: 2026-11-07
summary: 'Os testes em Chromium e WebKit mostraram que a mesma conta de exponencial dava um último bit diferente. Contamos como portamos a função e o que mais entrou: saves no aparelho, rostos, aposentadorias e a tela inicial.'
tags: ['motor', 'determinismo', 'saves', 'jogadores', 'testes']
etapa: 1
---

Esta semana o jogo ganhou muita coisa por baixo e algumas telas por cima. O fio condutor do post é um problema que só apareceu quando passamos a testar o jogo em mais de um navegador: a mesma partida podia dar outro resultado em outro aparelho. Contamos como achamos, como resolvemos e quais números provam que resolveu. Depois vêm as outras entregas, em seções mais curtas.

## O problema: o último bit

O motor do Prancheta é **determinístico**: dada a mesma **semente** (o número inicial do gerador pseudoaleatório), a mesma partida acontece igual, lance por lance. Isso vale para reproduzir um erro, para o balanceamento que roda 1.000 temporadas e, na Etapa 1b, para o servidor e o seu celular concordarem sobre o resultado.

A chance de um chute virar gol, por exemplo, usa uma **exponencial** (a função e elevado a x):

`chance = conversão × exp(k × (finalização − goleiro) / 10)`

O motor compara essa chance com um número sorteado. Se o sorteio cai abaixo dela, é gol.

Nosso teste de ponta a ponta abre o jogo num navegador de verdade a cada mudança. Ao rodar no Chromium (o motor do Chrome), vimos que o `Math.exp` dele devolvia resultado diferente do Node em cerca de **10% das entradas**, sempre no último bit. O padrão da linguagem JavaScript não exige que `Math.exp` e as outras funções transcendentais (as que não se reduzem às quatro operações) sejam exatas até o último bit. Cada motor (V8 no Chrome e no Node, JavaScriptCore no Safari) usa o seu algoritmo, e eles podem discordar.

### O que é IEEE 754

O JavaScript guarda cada número em 64 bits, no formato **binary64** definido pelo padrão **IEEE 754**. Um número como 0,1 não cabe exatamente nesse formato, então é guardado como o vizinho mais próximo. O padrão manda, para as quatro operações (soma, subtração, multiplicação e divisão), que o resultado seja o exato arredondado para o vizinho representável mais próximo. Por isso uma conta feita só com essas operações dá exatamente os mesmos bits em qualquer aparelho que siga o padrão. Para a exponencial, o padrão da linguagem não impõe nada parecido.

### O que é um ulp

Os números representáveis não formam uma linha contínua: formam uma reta com degraus. O **ulp** (_unit in the last place_, a unidade da última casa) é o tamanho do degrau entre um número representável e o seguinte. Perto de 1, o degrau é 2⁻⁵², cerca de 0,00000000000000022. "Diferença de 1 ulp" quer dizer que dois resultados são vizinhos na reta e discordam só no último bit.

![Reta com quatro números representáveis em intervalos iguais. O valor exato cai entre dois deles. O Node escolhe o vizinho da esquerda e o Chromium, o da direita, uma diferença de 1 ulp.](/devlog/2026-11-07/ulp.svg)

### Por que o último bit importa

Uma diferença de 0,00000000000000022 na chance parece irrelevante, e quase sempre é. Mas o motor compara a chance com um sorteio, e basta o sorteio cair entre os dois vizinhos para um aparelho marcar o gol e o outro não. Num único chute isso é raríssimo. Só que um campeonato tem centenas de milhares de chutes, e **um único gol diferente muda tudo o que vem depois**: o placar, a moral, os sorteios seguintes do gerador. Num jogo com semente, "quase igual" não serve, porque a diferença se propaga e cresce. Ou o resultado é idêntico bit a bit, ou não é.

## A solução: portar a exponencial

O motor já proibia chamar funções transcendentais do `Math`. O que faltava era uma substituta. Portamos a `exp` da **fdlibm**, a biblioteca matemática clássica escrita na Sun Microsystems em 1993, que serviu de base para as bibliotecas de muitas linguagens. O algoritmo, em resumo:

1. **Reduz o argumento:** escreve x como k × ln 2 + r, com r pequeno (no máximo meio ln 2 em módulo). Assim, e^x = 2^k × e^r.
2. **Calcula e^r** com um polinômio de grau baixo (os coeficientes P1 a P5 da fdlibm), só com multiplicações e somas.
3. **Multiplica por 2^k.** Como é uma potência de dois, o produto é exato, e uma tabela de potências de dois, montada por duplicações, evita qualquer chamada de função.

O código usa **apenas soma, subtração, multiplicação e divisão**, as operações que o IEEE 754 obriga a dar o mesmo resultado em qualquer lugar. Sem `Math.exp`, não há mais o que divergir. Um teste confere os bits de cada constante contra o valor hexadecimal da biblioteca original, para que um arredondamento ao copiar um número não passe despercebido.

### Os números

- **0 ulp de diferença** em relação ao `Math.exp` do Node em mais de **33 milhões de entradas**. Nossa versão devolve os mesmos bits do Node em todas elas, portanto concorda com o que o motor já calculava antes.
- Uma **tabela de 4.096 valores** de referência é conferida no **Chromium e no Safari** (este via WebKit, o motor do Safari) a cada mudança. Se algum navegador devolver um bit diferente, o teste falha.
- O **balanceamento de 1.000 temporadas** (380.000 partidas) ficou **idêntico linha a linha** ao de antes. A troca não mexeu no equilíbrio medido no post anterior: só tirou a dependência do navegador.

## Saves no aparelho

A carreira fica no **IndexedDB**, o banco de dados do próprio navegador.

- **Cópia conferida.** Cada gravação calcula um **SHA-256** (uma impressão digital de 256 bits do conteúdo) para conferir a cópia, e o jogo guarda 3 versões.
- **Formato v1 congelado.** O formato tem número de versão, esquema estrito e migrações para quando mudar. Textos digitados são limitados a 60 caracteres.
- **Gravação mais barata.** A foto da carreira (o snapshot) agora é guardada sem compressão gzip, e as súmulas das partidas são comprimidas por rodada. Medimos num Chromium sem janela, com a CPU limitada a 4 vezes mais lenta para imitar um celular modesto: a gravação ficou com **p90 de 78 a 88 ms**, abaixo da meta de 130 ms. O p90 é o valor abaixo do qual ficam 90% das medições.

## Rostos dos jogadores

Cada jogador tem um rosto desenhado por código em SVG, sem arquivo de imagem. Um **código de 13 caracteres, sorteado uma vez**, define os traços, e a idade e a nacionalidade determinam o que é permitido: jovens, por exemplo, não têm calvície nem cabelo grisalho. Como o código fica guardado com o jogador, o rosto não é redesenhado a cada temporada: os anos passam, e o código continua o mesmo.

## Aposentadoria variável

A chance de se aposentar sobe ano a ano, dos 33 aos 40, e **goleiros duram mais**. Aos 40, todos se aposentam.

![Gráfico de barras com a chance de aposentadoria por idade. Linha: 33 anos 5%, 34 anos 10%, 35 anos 25%, 36 anos 35%, 37 anos 45%, 38 anos 55%, 39 anos 70%, 40 anos 100%. Goleiros: 33 anos 0%, 34 anos 2%, 35 anos 5%, 36 anos 10%, 37 anos 15%, 38 anos 20%, 39 anos 30%, 40 anos 100%.](/devlog/2026-11-07/aposentadoria.svg)

Quando alguém sai, a **base** repõe: jovens de 17 anos sobem para o elenco. E, se quem se aposenta é o ídolo do clube, **surge um novo ídolo**.

## A casca do jogo

O jogo agora tem a moldura da carreira, um **registro de erros** que guarda o que deu errado sem nenhum dado pessoal, e os textos da interface em **três idiomas** (português, espanhol e inglês). Os testes de ponta a ponta rodam no Chromium e no WebKit a cada mudança, e foram eles que acharam o problema da exponencial.

## Tela inicial e novo jogo

- **Lista de carreiras**, com o apelido de cada uma.
- **Apagar em dois passos**, para ninguém perder uma carreira por engano. Há uma janela de 500 ms em que o toque é ignorado, contra toque duplo. "Cancelar" é sempre o último botão, e o botão de apagar do passo final fica 61 px acima do anterior, inclusive com o celular deitado, para que um toque repetido no mesmo ponto não confirme nada sem querer.
- **Novo jogo** lembra a última configuração.
- **Zoom de pinça liberado**, por acessibilidade, mas sem o zoom automático que o navegador do celular faz ao tocar num campo de texto.

## O que vem a seguir

A próxima entrega é a **tela do clube**: o termômetro da torcida, o elenco e o card do jogador, onde os rostos e as aposentadorias passam a aparecer.

## Pergunta para quem lê

Um jogador de linha de 38 anos tem 55% de chance de parar no ano, e um goleiro da mesma idade, 20%. Você gostaria de poder **convencer um veterano a ficar mais um ano**, ou prefere que a idade decida sozinha?
