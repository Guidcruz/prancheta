# Brasilidades: o que acontece no futebol brasileiro

> Decidido em 2026-11-03 (ADR-0005). O `game-designer` detalha fórmulas e parâmetros em cada etapa; o `content-writer` escreve as notícias e conversas de cada situação. Regra geral: tudo aqui é consequência de escolha do técnico ou da diretoria, com aviso antes; nada é azar puro.

## Salários e caixa (Etapa 3)

| Situação                 | O que o jogo faz                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Decidir atrasar salários | Libera o caixa do mês; moral cai (−5 por mês de atraso); a imprensa e a rede social noticiam                                                                             |
| 2 meses de atraso        | Elenco cancela treinos em protesto (treino da semana perdido); confiança da diretoria −10                                                                                |
| 3 meses de atraso        | Qualquer jogador pode rescindir e sair livre para qualquer clube (rescisão indireta, Lei Pelé art. 31); o clube deve os salários até o fim do contrato, que viram dívida |
| Clube da IA atrasando    | Olheiros avisam: jogadores perto de ficar livres aparecem como oportunidade no mercado                                                                                   |

Parâmetros iniciais: `salary.lateMoralePenalty = 5/mês`, `salary.strikeMonth = 2`, `salary.freeAgentMonth = 3`, chance de um jogador rescindir no mês 3: `0.35 × (1 − moral/100)`.

## Transfer ban (Etapa 3)

- Compras de jogadores de outros clubes podem ser parceladas (até 4 parcelas em 12 meses).
- Parcela atrasada 60 dias: o credor notifica (aviso na caixa de mensagens). Mais 30 dias: transfer ban até quitar.
- Com ban: não registra jogadores novos (contratação ou empréstimo); pode renovar contratos e reintegrar emprestados; jovens da base promovidos contam como registro e ficam bloqueados.
- Três bans acumulados na mesma gestão: multa de 5% da receita anual e a diretoria cobra a demissão (confiança −30).
- Você como credor: clube da IA atrasado entra em ban; você escolhe renegociar (recebe 70% já) ou esperar (100%, com risco de novo atraso).

Parâmetros: `ban.noticeDays = 60`, `ban.banDays = 90`, `ban.maxBansBeforePenalty = 3`, `ban.renegotiateRate = 0.7`.

## STJD (Etapa 2, com o calendário completo)

- Cartões: suspensão automática (3 amarelos ou 1 vermelho), avisada na escalação.
- Escalação irregular: escalar jogador suspenso é permitido, mas custa os pontos do jogo (vão ao adversário), multa e confiança −15. É a "virada de mesa" real (Portuguesa 2013, São Paulo 1999).
- Expulsão por agressão: julgamento em 2 a 4 rodadas, pena de 2 a 6 jogos. O técnico decide pedir **efeito suspensivo**: o jogador segue jogando até o julgamento; se a pena for confirmada, dobra. Chance de absolvição: 30%; de redução: 30%; de confirmação: 40%.
- Torcida: briga ou invasão (probabilidade cresce com termômetro abaixo de 30 ou acima de 90 em clássico): perda de mando (um jogo de portões fechados, bilheteria zero) e multa.
- Recurso ao Pleno: o clube pode recorrer de qualquer pena; a decisão sai 3 a 6 rodadas depois, com 25% de chance de reduzir e 10% de agravar.
- Virada de mesa por liminar: evento raro (≤ 2% por temporada, só no estilo Realista): um clube da IA rebaixado volta pela Justiça comum e a divisão joga com um time a mais na temporada seguinte (Gama 2000).

## Estrutura do clube e comissão técnica (Etapas 3 e 4)

| Área                  | Níveis                | Efeito                                                                                                                                                |
| --------------------- | --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Centro de treinamento | 1 a 5                 | Multiplicador de evolução no treino: 0,8 / 0,9 / 1,0 / 1,1 / 1,2; recuperação de fadiga +0 / +5 / +10 / +15 / +20%                                    |
| Categoria de base     | 1 a 5                 | Jovens por temporada: 1 / 2 / 2 / 3 / 4; potencial médio +0 / +2 / +4 / +6 / +8                                                                       |
| Departamento médico   | 1 a 5                 | Frequência de lesões ×1,2 / 1,1 / 1,0 / 0,9 / 0,8; tempo de recuperação idem                                                                          |
| Estádio               | capacidade            | Público e bilheteria (ver "Estádio, torcida e finanças")                                                                                              |
| Comissão técnica      | nota 1 a 99 por cargo | Auxiliar multiplica o treino (0,85 a 1,15); preparador físico, a fadiga; médico, as lesões; olheiro, a precisão das notas de fora (faixa de ±15 a ±3) |

- Evolução de um jogador por temporada = curva de idade × multiplicador do CT × multiplicador do auxiliar × (0,9 a 1,1 pela moral) × (1,0 a 1,2 por minutos jogados).
- Obras: custam 3 parcelas e levam uma temporada; o jogo mostra o retorno esperado antes de começar.
- **SAF (Etapa 4):** um investidor pode oferecer transformar o clube em SAF: injeção de caixa (uma temporada de receita) e obras em metade do tempo, em troca de metas mais duras, 30% das vendas e paciência menor (confiança cai 1,5× mais rápido). Recusar mantém a associação. É uma escolha apresentada ao técnico pela diretoria, não um evento automático. Probabilidade de oferta: 10% por temporada para clubes de porte médio e grande com caixa negativo.
- **Dívida herdada:** cada clube nasce com dívida proporcional ao porte (grande: 1,5 receita anual; médio: 1,0; pequeno: 0,5) que consome 10% da receita por temporada; pagar antes libera orçamento; diretoria caótica tende a aumentá-la.

## O que fica de fora de propósito

- Processos trabalhistas detalhados, dívidas fiscais, Profut: viram só a "dívida herdada".
- Doping, manipulação de resultados, apostas: não entram (público com menores; e não é divertido perder por isso).
- Justiça comum contra o seu próprio clube: nunca; a virada de mesa só acontece em favor ou contra a IA.

## Fontes

- [Gazeta Esportiva: transfer ban vira rotina no Brasil](https://www.gazetaesportiva.com/futebol/transfer-ban-brasil-clubes-serie-a-fifa-dividas/)
- [Diario de Pernambuco: rescisão por três meses de atraso (Lei Pelé)](https://www.diariodepernambuco.com.br/esportes-dp/santa-cruz/2026/06/amp/11715950-jogadores-do-santa-cruz-podem-rescindir-contrato-por-atrasos-salariais-veja-o-que-diz-a-lei.html)
- [Jovem Pan: viradas de mesa (Portuguesa 2013, São Paulo 1999, Gama 2000)](https://jovempan.com.br/?p=5136)
- [NSC Total: perda de pontos e multas por escalação irregular no STJD](https://www.nsctotal.com.br/?p=7830776)
