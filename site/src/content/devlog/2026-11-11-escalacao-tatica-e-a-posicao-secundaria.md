---
title: 'Escalação, tática e a posição secundária'
date: 2026-11-11
summary: 'O jogo ganhou as telas do Clube, da Escalação, da Tática e das Funções. Também contamos a posição secundária, que ainda está sendo construída, e por que a escalação automática vai passar a pôr o jogador natural primeiro.'
tags: ['telas', 'escalação', 'tática', 'jogadores', 'saves']
etapa: 1
---

Esta semana o técnico ganhou as ferramentas de técnico: ver o clube, montar o time, escolher a tática e distribuir as funções. A segunda metade do post é sobre uma regra que ainda **não está no jogo**: a posição secundária. Ela já foi decidida e documentada, e está sendo construída agora. Deixamos claro, em cada trecho, o que já funciona e o que ainda é projeto.

## O que já está no jogo

### Tela do Clube

É a tela de abertura da carreira e responde a uma pergunta: "preciso mexer no time ou só jogo a rodada?". Tem três blocos:

- **Próximo jogo:** adversário, mando (em casa ou fora), data e o selo "Clássico" quando o adversário é rival do seu clube. Quando há lesionados ou suspensos, uma linha avisa ("Desfalques: 1 lesionado, 1 suspenso") e leva ao elenco.
- **Torcida:** o **termômetro**, um número de 0 a 100 com um rótulo de humor em palavras e uma barra de cinco faixas.
- **Classificação:** a posição, os pontos, uma mini tabela com o clube de cima, o seu e o de baixo, e os últimos cinco jogos (V, E, D).

### Elenco e card do jogador

O Elenco é uma tabela com a coluna do nome fixa: ao rolar para os lados, o nome fica no lugar. Num celular de 360 pixels de largura, essa coluna ocupa no máximo metade da tabela, e há um teste automático que mede isso. Tocar num nome abre o **card do jogador**, com atributos, condição, moral e forma.

Duas decisões de cor, ambas testadas no celular antes de entrarem:

- **Condição, moral e forma** ganham cor por faixa (verde, amarelo, vermelho). O número continua escrito, e a faixa também vai em palavra para quem usa leitor de tela ("82, boa"). A cor nunca é a única informação.
- **A nota geral não tem cor.** A nota é relativa ao nível do clube: um 65 é titular num time do fundo da tabela e reserva num time do topo. Com faixas fixas, o elenco inteiro de um clube fraco ficaria vermelho, e a cor não ajudaria a escolher entre os jogadores do próprio time.

Depois vieram as cores dos **atributos** (por força, só no card) e das **posições** (por setor: goleiro, defesa, meio e ataque). Uma regra do design system separa os dois usos: a cor de faixa só pinta números, e a cor de setor só pinta o fundo da sigla da posição.

Também corrigimos um erro pequeno: o nome no topo do card podia diferir do nome na linha da lista. Agora o card usa o mesmo texto da linha.

### Anel de foco só no teclado

O **anel de foco** é o contorno que mostra qual elemento está selecionado. Ele é essencial para quem navega por teclado, mas aparecia também depois de um toque, o que poluía a tela do celular. Passou a aparecer só quando o foco vem do teclado, usando a pseudoclasse `:focus-visible` do CSS, que o navegador liga sozinho nesse caso.

### Escalação

A tela mostra os 11 titulares num campo, o banco com 7 vagas e os não relacionados. Trocar dois jogadores de lugar funciona de três jeitos que dão o mesmo resultado:

1. **Dois toques:** toca num jogador e depois no outro.
2. **Teclado:** Enter num e Enter no outro.
3. **Arrastar:** no mouse, é só arrastar. No toque, é preciso **segurar por 300 ms** antes de arrastar. Sem isso, deslizar o dedo rola a página, e o campo ocupa quase a tela inteira, então um arrasto imediato prenderia a rolagem.

Para tirar alguém do campo sem pôr ninguém no lugar, o jogador vai até **"Deixar de fora"**, a primeira linha dos não relacionados. A vaga fica livre e a tela avisa.

Pontos que valem explicar:

- **Força do time.** Quatro barras: Força, Defesa, Meio e Ataque. Cada jogador numa vaga vale `nota × aptidão × (0,80 + 0,20 × condição / 100)`. A **aptidão** é o quanto ele rende naquela vaga: 1,00 na posição natural, 0,85 a 0,90 improvisado numa posição vizinha e menos que isso quando está fora de posição. Vaga livre, lesionado escalado e gol vazio valem zero. A Força é a soma dos 11 valores dividida por 11. Depois de cada troca, o número que mudou mostra a seta e o valor com sinal, como `+2` ou `−3`.
- **Avisos.** Uma linha por problema, com ícone e texto: vaga livre, lesionado ou suspenso escalado, jogador fora de posição ou improvisado.
- **Sugerir e Desfazer.** "Sugerir escalação" monta um time pela mesma regra que a IA usa nos clubes, mantendo a formação e a tática que você escolheu. "Desfazer" volta ao estado anterior.
- **Completar e jogar.** Se a escalação está incompleta, a tela oferece completar as vagas livres automaticamente e seguir para a rodada.
- **Sem botão "Salvar".** Tudo vale na hora.

### Tática e Funções

Na **Tática** o técnico escolhe a formação, a **postura** e a **pressão**. A frase embaixo de cada opção diz o efeito em palavras. Mudar a formação reaproveita os mesmos jogadores nas vagas novas sempre que possível.

Em **Funções** ficam o capitão, os cobradores de pênalti e os de falta. Cada lista aceita até 3 nomes, em ordem de preferência. Lista vazia mostra "Automático" com o nome de quem o motor escolheria.

### A ficha agora fica no save

Como a escalação vale na hora, ela precisa sobreviver a fechar a aba. A **ficha do técnico** (escalação, formação, postura, pressão, capitão, cobradores) passou a ser gravada no save, que ganhou a **versão 2**. Dois cuidados de projeto:

- A ficha fica **fora do estado do motor**. O motor continua só simulando; a ficha é dado da aplicação. Assim a IA não vê a ficha que o adversário vai mandar, e os resultados de referência do motor não mudam.
- Ela aceita ficha **inválida**: o técnico pode sair da tela com uma vaga livre, ou um titular pode se lesionar entre uma rodada e outra. A tela mostra a ficha como está, com o aviso, até alguém consertar.

A ficha é pequena, cerca de 0,6 KB de JSON, contra até cerca de 680 KB do save inteiro. Por isso guardá-la não pesa na gravação.

Para a tela de Escalação, o motor também ganhou **leituras** novas: funções que só calculam e devolvem um número (a força da ficha, a aptidão de um jogador numa vaga). Elas não sorteiam nada e não mudam nenhum resultado de partida.

## A posição secundária: decidida, ainda em construção

> **Status:** projetada e documentada, **não implementada**. Hoje o jogo ainda funciona como descrito nas seções acima.

A ideia é algo comum no futebol: o jogador que tem uma posição de origem, mas também atua bem em outra. Chamamos de **posição secundária**. As regras decididas:

- **Quem tem:** cerca de **1 em cada 3** jogadores de linha. **Goleiro nunca tem.**
- **Qual é:** sempre uma posição **vizinha** da natural, ou seja, uma em que o improvisado já renderia 85% ou 90%. Um atacante só pode ter meia; um zagueiro, lateral ou volante; um lateral, zagueiro, volante ou meia. O código calcula as vizinhas a partir da tabela de aptidão, sem listá-las à mão, para que uma mudança na tabela as acompanhe.
- **Quanto rende:** **95%**, no meio do caminho entre a natural (100%) e o improvisado (90%).
- **Fixa na carreira:** nesta etapa o jogador não ganha nem perde secundária. Isso só faz sentido junto do treino, que vem na Etapa 3.

O efeito no placar é **pequeno de propósito**. Um jogador de nota 72 na secundária vale 68,4; o mesmo jogador improvisado valeria 64,8. Cobrir uma vaga assim rende cerca de 0,3 ponto de força do time. Quem sente é o técnico, na hora de cobrir um desfalque: a decisão deixa de ser "ponho um volante na zaga e rezo" e passa a ter um meio-termo.

### O sorteio é determinístico

A secundária é sorteada **uma vez por jogador**, com um gerador de números pseudoaleatórios próprio, semeado com a semente da carreira mais o identificador do jogador. Isso tem três vantagens:

1. Os sorteios do elenco (idade, nota, atributos) **não mudam**; o jogador continua tendo as mesmas características de antes.
2. Um save antigo recebe, na migração, **exatamente** a secundária que um jogo novo com a mesma semente daria ao mesmo jogador.
3. Se um dia a chance subir de 33% para 40%, quem já tinha continua com a mesma, e quem ganha é só quem estava entre os 33% e os 40%. Isso deixa o balanceamento comparar valores sem trocar os jogadores.

Em 4.000 elencos simulados, 33,0% dos jogadores de linha receberam uma secundária, ou 7,3 por elenco de 25.

### Por que a escalação automática muda

Esta é a parte que dá mais trabalho. Hoje a escalação automática é **gulosa**: preenche as vagas em ordem (goleiro, zagueiros, laterais, volantes, meias, atacantes) e dá cada uma ao jogador de maior valor entre **todos**, de qualquer posição. O problema aparece assim: um volante de nota 78 vale 70,2 na zaga (78 × 0,90), mais que o zagueiro de nota 68. O algoritmo põe o volante na zaga. Aí a vaga de volante fica com um reserva de 66. O time perdeu 10 pontos de soma para ganhar 2.

Medimos em 4.000 elencos do gerador atual, com a secundária sorteada pela regra acima:

| Cenário                           | Guloso, sem secundária | Guloso, com secundária | Natural primeiro, com secundária |
| --------------------------------- | ---------------------- | ---------------------- | -------------------------------- |
| Força do XI (elenco completo)     | 70,20                  | 70,07                  | 70,47                            |
| Titulares fora da posição natural | 0,39 por time          | 0,80 por time          | 0,03 por time                    |

Dois resultados incomodam. O primeiro: **mesmo hoje, sem secundária, o jeito guloso tira em média 0,39 titular da posição natural por time.** O segundo: com a secundária valendo 95%, o guloso a usaria para "roubar" titulares de outras vagas ainda mais vezes, e a secundária **enfraqueceria** o time (de 70,20 para 70,07). Uma regra feita para dar flexibilidade acabaria punindo.

A solução é o **"natural primeiro"**, em dois passes:

1. **Passe da posição.** Cada vaga recebe o melhor jogador disponível **cuja posição natural é a da vaga**.
2. **Passe da troca.** Vaga a vaga, nas dez de linha, quem ficou de fora toma a vaga **só se render estritamente mais** que o ocupante. O ocupante que sai pode tomar uma vaga seguinte no mesmo passe.

O goleiro é tratado à parte: um goleiro escolhido no primeiro passe nunca é trocado. Sem isso, um atacante de nota 80 (que no gol valeria 32, com aptidão de 0,40) poderia ganhar de um goleiro muito cansado, e mandar o atacante para o gol é exatamente o erro que queremos evitar. O segundo passe termina sempre, porque cada vaga de linha é visitada uma única vez.

Com o natural primeiro, a secundária **nunca tira um titular da posição dele**. Ela só entra quando falta alguém. Com três titulares fora por lesão ou suspensão, a secundária cobre cerca de 30% dos improvisos. O mesmo algoritmo vale para a IA dos clubes, para o botão "Sugerir escalação" e para o robô do balanceamento. Se o robô usasse o guloso, a meta "um técnico bom vence a IA" mediria a qualidade do algoritmo, e não as decisões do técnico.

### O que acontece com carreiras já salvas

Quem tem uma carreira em andamento recebe a secundária na migração, sem mudar a nota nem os atributos de ninguém. Os elencos antigos foram ajustados para que o XI **guloso** batesse a escada de força; o XI "natural primeiro" deles mede um pouco mais. Em média, +0,3 ponto, com 10% dos clubes subindo 1 ou mais e o máximo em 3,3. Decidimos aceitar sem aviso na tela, porque na Etapa 1 as carreiras salvas são de teste, e mexer na nota de jogadores que o técnico já conhece seria pior.

Como mexe em jogadores, escalação e saves, essa mudança também altera os resultados de referência do motor, e por isso passa pelo caminho completo de revisão, não pelo rápido.

## O que vem a seguir

- Implementar a posição secundária: o sorteio, o novo algoritmo de escalação, a marca "posição secundária" na vaga (que **não** é aviso: usar a secundária é uma boa escolha, e perder 5% não é um erro) e a migração do save.
- Rodar o balanceamento de novo com o algoritmo novo, para ver se algum número do jogo se mexe.
- Seguir com as telas da carreira: calendário e tabela.

Uma pergunta para quem acompanha: na hora de cobrir um desfalque, você prefere um jogador **natural** de nota menor ou um **improvisado** de nota maior? A posição secundária existe para dar uma terceira opção, e queremos saber se 95% é o número que faz essa escolha valer a pena.
