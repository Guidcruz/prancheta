---
title: 'A posição secundária entrou no jogo'
date: 2026-11-14
summary: 'Cerca de 1 em cada 3 jogadores de linha agora tem uma segunda posição em que rende 95%. A escalação automática passou a pôr o natural primeiro, e o balanceamento mostrou uma tabela um pouco mais aberta.'
tags: ['jogadores', 'escalação', 'motor', 'balanceamento', 'saves', 'telas']
etapa: 1
---

No post anterior a posição secundária era um projeto. Agora ela está inteira no jogo: no save, na escalação automática, no motor e nas telas. Este post conta cada peça, o que medimos e o que mudou nos números do campeonato.

## No save: quem tem e qual é

Cada jogador de linha passou a ter, no save, um campo opcional de **posição secundária**.

- **Quem tem:** cerca de **1 em cada 3** jogadores de linha. **Goleiro nunca tem.**
- **Quais são possíveis:** só as posições **vizinhas** da natural, calculadas a partir da tabela de encaixe por posição (a mesma que dá 1,00 na natural e 0,85 ou 0,90 nas vizinhas). Como o código lê a tabela em vez de ter uma lista própria, uma mudança na tabela leva as vizinhas junto.
- **Saves antigos:** a migração sorteia a secundária de cada jogador com um gerador de números pseudoaleatórios semeado com a semente da carreira e o identificador do jogador. É um sorteio **estável**: com a mesma semente, o mesmo jogador recebe sempre a mesma secundária. Reabrir o save, ou migrar de novo, dá o mesmo resultado, e nota e atributos de ninguém mudam.

## A escalação automática: natural primeiro

Como o post anterior explicou, a escalação **gulosa** (cada vaga recebe o jogador de maior valor entre todos) tirava titulares da posição natural, porque um volante bom vale mais na zaga do que um zagueiro mediano. Com a secundária a 95% isso pioraria. Entrou então o algoritmo em dois passes:

1. **Passe da posição:** cada vaga recebe o melhor jogador disponível cuja posição **natural** é a da vaga.
2. **Passe da troca:** vaga a vaga, nas dez de linha, quem ficou de fora só toma a vaga se render **estritamente mais** que o ocupante. Empate não troca.

O goleiro nunca é trocado. O mesmo algoritmo serve à IA dos clubes, ao botão "Sugerir escalação" e ao robô do balanceamento.

Medimos o resultado em fichas montadas por esse algoritmo: os **titulares fora da posição natural caíram de 0,52 para 0,06 por ficha**. Sobra um caso de vez em quando, que é quando a troca realmente compensa.

## No motor: 95% na vaga da secundária

Agora o motor lê a secundária. Na vaga dela, o jogador rende o **maior valor entre a tabela de encaixe e 0,95**. O `max` garante que a secundária nunca piora ninguém: se a tabela já der 0,95 ou mais para aquela vaga, vale a tabela. Um jogador de nota 72 vale 68,4 na secundária contra 64,8 improvisado a 0,90. A conta da força do time segue a mesma do post anterior, `nota × aptidão × (0,80 + 0,20 × condição / 100)`, só com a aptidão nova.

## O que o balanceamento mostrou

Rodamos o balanceamento duas vezes: 600 temporadas, e depois as **1.000 temporadas de release**, com um robô assumindo o clube mais fraco. O que **não mudou**:

- **Gols por partida:** 2,65, igual a antes, dentro da meta de 2,5 a 2,8.
- **Time 20 pontos mais forte:** vence cerca de 63% das vezes.

O que **mexeu**, pouco, e para o lado da abertura da tabela:

| Medida                               | Antes | Depois |
| ------------------------------------ | ----- | ------ |
| Campeão pequeno (% das temporadas)   | 1,2%  | 1,8%   |
| Clube fraco no G4 (% das temporadas) | 6,2%  | 8,5%   |
| Campeão grande, 1.000 temporadas     | 81,6% | 79,7%  |

A causa provável: um elenco curto, quando perde titulares por lesão ou suspensão, passa a cobrir o buraco com a secundária a 95% em vez de improvisar a 85% ou 90%. Quem tem elenco curto é, em geral, o clube menor, então ele sente mais o ganho. É uma hipótese coerente com os números, não uma prova; não isolamos o efeito rodando sem a secundária.

Também medimos quanto a secundária aparece em jogo: cerca de **0,07 titular por time** joga na posição secundária. Ou seja, ela é rara em campo, e é isso que se espera de uma regra que só entra quando falta alguém.

## Nas telas

- **Card do jogador:** ganhou o campo **"Posição secundária"**, com a dica: "Outra posição em que ele joga bem. Ali rende um pouco menos que na natural."
- **Elenco e banco:** embaixo da sigla colorida da posição natural aparece uma sigla **cinza e menor** com a secundária. Para leitor de tela, a linha diz, por exemplo, "Volante, também joga de zagueiro".
- **Escalação:** quando um titular está na vaga da secundária, a vaga mostra a marca **"Posição secundária"**. Os reservas que podem ocupar aquela vaga ganham um selo parecido. É informação neutra, **nunca aviso**: usar a secundária é uma boa escolha, e perder 5% não é erro.

### Um detalhe de tela: "Secondary" em três linhas

Na versão em inglês, "Secondary position" quebrava em **3 linhas** num celular de 360 px. A causa: a marca tem um ícone ao lado do texto, e a palavra "Secondary" sozinha não cabia no espaço que sobrava. Como uma palavra não quebra no meio, o texto foi empurrado para linhas curtas.

Duas correções. O texto passou a ser "Second position". E a **regra de largura das marcas** foi consertada: antes ela contava letras, e agora exige que a **primeira palavra caiba ao lado do ícone**, que é o que decide de fato onde a linha quebra. Contar letras dá a mesma resposta para palavras diferentes; medir a primeira palavra, não.

## Bastidor: o CI no container do Playwright

Uma queda do repositório de pacotes do Ubuntu derrubou o CI, porque os testes de tela instalavam dependências do navegador na hora. Agora esses testes rodam dentro do **container oficial do Playwright**, que já traz navegadores e dependências, e não dependem mais desse repositório a cada execução.

## O que vem a seguir

- Seguir com as telas da carreira que faltam, a começar por calendário e tabela.
- Observar, nas próximas rodadas de balanceamento, se a tabela mais aberta se mantém ou se era ruído.

Uma pergunta para quem acompanha: um campeão grande em 79,7% das temporadas, contra 81,6%, é pouca coisa ou já é o campeonato que você queria jogar? Queremos saber que grau de surpresa a Série A deve ter.
