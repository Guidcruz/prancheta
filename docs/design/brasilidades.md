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

## Transfer ban e fair play financeiro (Etapa 3)

Três origens de dívida levam ao ban, como no Brasil de 2026:

| Dívida                              | Com quem                              | Como nasce no jogo                                                                                                                                 |
| ----------------------------------- | ------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Parcela de compra                   | Outro clube (nacional ou do exterior) | Compras parceladas em até 4 vezes em 12 meses                                                                                                      |
| Salário, direito de imagem ou multa | Jogador ou ex-jogador                 | Atrasar salários; rescisão indireta; multa rescisória não paga; jogador vendido com pendência cobra do antigo clube                                |
| Mecanismo de solidariedade          | Clube formador                        | Ao comprar um jogador, 6% do valor (nacional) ou 5% (do exterior) vai aos clubes que o formaram dos 12 aos 23 anos; não pagar vira dívida com eles |

- **Fair play da CBF (aviso antes da punição):** duas vezes por ano há uma data de corte. Quem tem dívida vencida recebe 45 dias para quitar; dívida com atleta ainda leva multa. É a chance de resolver antes do ban, com a lista das pendências na caixa de mensagens.
- **Ban:** vencido o prazo, o clube não registra jogadores novos (contratação, empréstimo ou promoção da base) por **três janelas ou até quitar**, o que vier antes. Pode renovar contratos e reintegrar emprestados.
- **Acúmulo:** cada ban conta; o segundo seguido traz multa de 5% da receita anual, e o terceiro faz a diretoria cobrar a demissão (confiança −30).
- **Você como credor:** clube da IA atrasado com você entra no mesmo rito; você escolhe renegociar (recebe 70% já) ou esperar (100%, com risco de novo atraso). Jogadores seus vendidos continuam gerando solidariedade quando são revendidos.

Parâmetros: `ban.cutoffDates = [30/06, 31/12]`, `ban.graceDays = 45`, `ban.windows = 3`, `ban.playerDebtFine = 1% da receita anual`, `ban.repeatFine = 5%`, `ban.maxBansBeforePenalty = 3`, `ban.renegotiateRate = 0.7`, `solidarity.national = 0.06`, `solidarity.international = 0.05`.

## Vitrine e formação (Etapa 3; vitrine continental na Etapa 5)

- **Vitrine:** o valor de mercado de um jogador sobe com destaque em jogos de peso: gol ou melhor em campo em clássico (+3%), fase de mata-mata nacional (+5%), Libertadores e Sul-Americana (+8%), convocação para a seleção (+15%). Depois de uma vitrine, propostas do exterior ficam 2× mais prováveis por 3 rodadas. O técnico sente isso na mão: escalar o jovem na Libertadores é investimento.
- **Clube formador:** quem revela um jogador (base ou chegada antes dos 19 anos) recebe solidariedade em toda venda futura dele, pela vida inteira da carreira, mesmo depois de ele sair. Para clubes pequenos, é a receita que faz a base valer a pena.
- **Certificado de clube formador:** com categoria de base nível 3 ou mais, o clube também recebe indenização por formação quando um jovem sai antes do primeiro contrato profissional.
- **No online:** a solidariedade entre humanos é automática, cobrada pelo servidor na hora da venda.

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

## Torcida dentro do jogo (Etapa 1a o termômetro; efeitos completos na Etapa 3)

O termômetro da torcida (0 a 100) sai da rede social, dos resultados e das decisões do técnico, e volta para o jogo:

| Efeito                    | Regra                                                                           |
| ------------------------- | ------------------------------------------------------------------------------- |
| Mando de campo            | Bônus de casa de +2% (torcida fria) a +8% (torcida em festa); clássico soma +2% |
| Público                   | Multiplica a demanda por ingressos (0,6 a 1,3)                                  |
| Moral do elenco           | Cada rodada, moral move 1 ponto na direção do termômetro                        |
| Pressão sobre a diretoria | Abaixo de 25, a confiança cai mais rápido; enquetes "deve demitir?" aparecem    |
| Incidentes                | Abaixo de 30 ou acima de 90 em clássico, risco de briga ou invasão (STJD)       |
| Jogador contra a torcida  | Jogador vaiado (personalidade temperamental) pede para sair no fim da temporada |

Parâmetros: `fans.homeBonusMin = 0.02`, `fans.homeBonusMax = 0.08`, `fans.derbyBonus = 0.02`, `fans.moraleDrift = 1`.

## Sócio-torcedor (Etapa 3)

- Cada clube tem um plano de sócios com número de sócios (depende do porte, do termômetro e da fase) e uma mensalidade em três faixas (popular, normal, premium).
- Receita mensal estável: a principal fonte de caixa de clubes pequenos e médios, como no Brasil.
- Sócios sobem com vitórias, títulos, contratações de impacto e campanha promocional (custa caixa, dá sócios); caem com derrotas em sequência, salários atrasados e preço alto.
- Benefícios dos sócios no jogo: desconto no ingresso (ocupa capacidade com menos bilheteria, mas enche o estádio) e voto simbólico em enquetes que a diretoria leva em conta.
- Decisão do técnico/diretoria: lançar campanha, mudar faixa, dar ingresso grátis em jogo decisivo.

Parâmetros: `members.base = {pequeno: 2000, médio: 15000, grande: 80000}`, `members.perWinPct = 0.5`, `members.perLossPct = -0.4`, `members.lateSalaryPct = -3`, `members.campaignCost = 2% da receita anual`, `members.campaignGainPct = 8`.

## O que fica de fora de propósito

- Processos trabalhistas detalhados, dívidas fiscais, Profut: viram só a "dívida herdada".
- Doping, manipulação de resultados, apostas: não entram (público com menores; e não é divertido perder por isso).
- Justiça comum contra o seu próprio clube: nunca; a virada de mesa só acontece em favor ou contra a IA.

## Fontes

- [Gazeta Esportiva: transfer ban vira rotina no Brasil](https://www.gazetaesportiva.com/futebol/transfer-ban-brasil-clubes-serie-a-fifa-dividas/)
- [Diario de Pernambuco: rescisão por três meses de atraso (Lei Pelé)](https://www.diariodepernambuco.com.br/esportes-dp/santa-cruz/2026/06/amp/11715950-jogadores-do-santa-cruz-podem-rescindir-contrato-por-atrasos-salariais-veja-o-que-diz-a-lei.html)
- [Jovem Pan: viradas de mesa (Portuguesa 2013, São Paulo 1999, Gama 2000)](https://jovempan.com.br/?p=5136)
- [NSC Total: perda de pontos e multas por escalação irregular no STJD](https://www.nsctotal.com.br/?p=7830776)
- [NSC Total: Inter leva ban de três janelas por uma parcela de compra](https://www.nsctotal.com.br/?p=7835488)
- [A Crítica: fair play financeiro da CBF dá 45 dias e multa por dívida com atleta](https://acritica.net/esportes/futebol/sao-paulo-atletico-mg-gremio-e-inter-tem-45-dias-para-pagar-dividas-e-evitar-transfer-ban/)
- [Máquina do Esporte: mecanismo de solidariedade e indenização por formação](https://maquinadoesporte.com.br/analise/mecanismo-de-solidariedade-o-que-e-e-quando-se-aplica/)
