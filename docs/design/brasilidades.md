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
- Expulsão por agressão: julgamento em 2 a 4 rodadas, pena de 2 a 6 jogos. O técnico decide pedir **efeito suspensivo**: o jogador segue jogando até o julgamento; se a pena for confirmada, dobra. Chance de absolvição: 30%; de redução: 30%; de confirmação: 40%. _(Substituída: no real a pena não dobra. Vale a regra de "Efeito suspensivo: como funciona no real" abaixo, aprovada pelo CEO em 2026-11-05; a troca no `PROJETO.md` é formalizada em ADR.)_
- Torcida: briga ou invasão (probabilidade cresce com termômetro abaixo de 30 ou acima de 90 em clássico): perda de mando (um jogo de portões fechados, bilheteria zero) e multa.
- Recurso ao Pleno: o clube pode recorrer de qualquer pena; a decisão sai 3 a 6 rodadas depois, com 25% de chance de reduzir e 10% de agravar.
- Virada de mesa por liminar: evento raro (≤ 2% por temporada, só no estilo Realista): um clube da IA rebaixado volta pela Justiça comum e a divisão joga com um time a mais na temporada seguinte (Gama 2000).

## Efeito suspensivo: como funciona no real (pesquisa de 2026-11-05)

> Pedido do CEO, que duvidou do "se a pena for confirmada, dobra" da seção acima (e de `PROJETO.md`, "STJD"). Pesquisa em fontes públicas: o CBJD como aparece citado em decisões de tribunais desportivos e reportagens de 2024 a 2026. O texto integral do CBJD e do RGC da CBF não pôde ser baixado nesta sessão (a rede bloqueou os PDFs); quem for implementar confere os artigos no texto vigente.

**Resposta curta: a pena não dobra.** Não há no CBJD nenhuma regra que dobre a pena de quem pediu efeito suspensivo. O risco real é outro: o Pleno pode absolver, reduzir, manter **ou aumentar** a pena (aconteceu em setembro de 2026: 2 jogos viraram 3), e o que sobrar é cumprido depois, nos jogos que vierem, sejam eles quais forem.

### O rito real, em ordem

1. **Expulsão = suspensão automática de 1 jogo**, na partida seguinte da mesma competição, sem esperar julgamento (RGC da CBF). Ela não é pena, é impedimento; por isso não se converte em outra coisa (TJD-DF, janeiro de 2026).
2. **Julgamento na 1ª instância (Comissão Disciplinar do STJD), em cerca de uma semana.** Exemplo: Victor Gabriel (Internacional), jogo em 22/07/2026, julgado em 28/07. A pena vale a partir da decisão, e **a partida da automática é descontada** (CBJD: "deduzir-se-á da pena imposta a partida não disputada em consequência da expulsão"). Pena de 1 jogo = já cumprida.
3. **Recurso ao Tribunal Pleno, com pedido de efeito suspensivo.** Quem pede é o clube (ou o próprio punido), no recurso voluntário, ao relator do Pleno; a Procuradoria também pode recorrer, inclusive para aumentar a pena. Há dois casos:
   - **Pena acima de 2 jogos (ou 15 dias):** o efeito suspensivo decorre da norma, basta pedir (CBJD art. 147-B, I, que remete à Lei Pelé, art. 53, § 4º). Mas só vale para o que passa do limite (147-B, § 1º): o jogador **cumpre 2 jogos (a automática conta) e joga até o Pleno**. Foi o caso de Victor Gabriel (pena de 6 jogos, efeito concedido em 01/08/2026 "depois de cumpridas duas partidas"). Na Série A, os clubes pedem com frequência; as notícias de 2026 trazem vários casos por mês.
   - **Pena de até 2 jogos:** o relator decide caso a caso (art. 147-A): exige argumento plausível e risco de dano irreparável. É exceção: negado a Thiago Carpini (Fortaleza, 2 jogos, maio de 2026), concedido a Abel Ferreira (Palmeiras, 2 jogos, setembro de 2026).
   - Multa: o recurso a suspende sempre (147-B, II).
4. **O Pleno julga, em geral, uma a duas semanas depois.** Victor Gabriel: efeito em 01/08, Pleno em 07/08, pena mantida. Abel Ferreira (microfone): efeito em 05/09, Pleno em 11/09, pena **aumentada de 2 para 3 jogos**, sem novo recurso. Abel Ferreira (abril, expulsões): efeito negado, Pleno reduziu de 8 para 7. O que sobrou é cumprido a partir do jogo seguinte da competição.

### Penas típicas (CBJD, atleta)

| Infração                                              | Artigo | Pena no código                              | Na prática (2026)                                                                                                                        |
| ----------------------------------------------------- | ------ | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| Jogada violenta (força excessiva, mesmo sem intenção) | 254    | 1 a 6 partidas                              | perto do mínimo; com a automática descontada, muitas vezes já está cumprida                                                              |
| Agressão física                                       | 254-A  | 4 a 12 partidas (não atleta: 30 a 180 dias) | perto do mínimo: Pulgar (Flamengo) 4, Zé Ricardo (Remo) 5 com o art. 250; Victor Gabriel 6 e "até o adversário voltar", teto de 180 dias |
| Cusparada                                             | 254-B  | 6 a 12 partidas                             | Kleber (Coritiba) denunciado no mínimo de 6                                                                                              |
| Conduta contrária à disciplina ("antidesportiva")     | 258    | 1 a 6 partidas (não atleta: 15 a 180 dias)  | 1 a 3: Abel Ferreira 2, depois 3, por chutar um microfone                                                                                |

- **Multa:** nas infrações de campo, o atleta leva suspensão; a multa recai sobretudo no clube (por exemplo, Remo multado em R$ 10 mil pelo art. 213, segurança, no mesmo jogo da agressão) e em treinadores e dirigentes. O teto do CBJD é R$ 100 mil por infração (o caso Bruno Henrique, de 2025, terminou numa multa desse valor).

### Em que competições a pena vale (responde a `temporada.md`, "Suspensões entre temporadas")

| Tipo                                          | Onde vale                                                                                                                       | Se a competição acaba (ou o time é eliminado)                                                                                                                                                                                                       |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Suspensão automática (3 amarelos ou vermelho) | só na competição em que foi recebida                                                                                            | **extinta** (RGC; o TJD-DF negou levá-la para a temporada seguinte em 2026); os amarelos zeram com a competição                                                                                                                                     |
| Pena do STJD em partidas                      | só na mesma competição (CBJD art. 171): o gancho de Abel Ferreira no Brasileiro não valia na Copa do Brasil nem na Libertadores | **passa para a partida seguinte de outra competição da mesma entidade** (art. 171, § 1º), ou vira medida de interesse social, a pedido. Bruno Henrique, expulso na semifinal da Copa do Brasil de 2024, cumpriu o resto na última rodada da Série A |
| Pena do STJD em dias                          | em todas as competições da modalidade (art. 172)                                                                                | o prazo corre no calendário, inclusive na pausa                                                                                                                                                                                                     |

A pena é da pessoa: transferido, o jogador a leva para o clube novo, na mesma competição.

**Para o jogo (Etapa 2, só a Série A):** amarelos e suspensão automática pendente zeram na virada, como já é na 1a (a regra atual de `temporada.md` é fiel); jogos de pena do STJD que sobrarem passam para a próxima competição nacional que o jogador disputar (na Etapa 2, a Série A da temporada seguinte; com copas, a primeira que vier no calendário).

### Regra aprovada (CEO, 2026-11-05; entra na Etapa 2)

> Substitui o "se a pena for confirmada, dobra". Como a regra atual está no `PROJETO.md`, a troca é ADR depois do ok do CEO. Os números ainda não foram simulados: o STJD é da Etapa 2 e não existe no motor; as contas abaixo são de esperança simples, e a medição entra no pedido ao `developer`.

**Regra em uma frase:** o expulso fica 1 jogo de fora na hora; o STJD julga na semana e desconta esse jogo; se a pena passar de 2 jogos, você pode recorrer: ele cumpre 2 e joga até o Pleno, que pode absolver, reduzir, manter ou aumentar, e o que sobrar ele cumpre logo depois.

1. **Vermelho direto ganha um motivo**, sorteado no lance: `impedir gol` (35%: pena de 1 jogo, já cumprida com a automática), `jogada violenta` (45%: pena de 1, 2 ou 3 jogos, com pesos 50/30/20) e `agressão` (20%: 4, 5 ou 6 jogos, com pesos 50/30/20). O segundo amarelo continua só na automática, sem julgamento.
2. **Julgamento na rodada seguinte à expulsão** (`stjd.firstInstanceDelayRounds = 1`), com a automática descontada. A notícia sai com a pena e os jogos que ele perde.
3. **Com pena de 3 jogos ou mais**, o técnico vê uma tela com duas opções e os próximos adversários:
   - **Cumprir agora:** perde os jogos da pena, em sequência; sabe quando ele volta.
   - **Recorrer ao Pleno:** cumpre 2 (automática inclusa), joga as `stjd.plenoDelayRounds = 2` rodadas até o Pleno e depois cumpre o que o Pleno decidir, a partir da rodada seguinte, sejam quais forem os jogos.
4. **O parecer do jurídico** aparece antes da escolha (sorteado: um terço cada) e fixa as chances do Pleno. Reduzir e aumentar mexem em 1 jogo (`stjd.plenoStepGames = 1`, constante); absolvição não devolve os 2 já cumpridos (como no real).

| Parecer      | Absolve | Reduz 1 | Mantém | Aumenta 1 | Jogos perdidos, pena de 4 (cumprir agora: 4) |
| ------------ | ------- | ------- | ------ | --------- | -------------------------------------------- |
| Favorável    | 25%     | 35%     | 35%    | 5%        | 3,2                                          |
| Dividido     | 10%     | 30%     | 45%    | 15%       | 3,65                                         |
| Desfavorável | 5%      | 15%     | 55%    | 25%       | 4,0                                          |

**Por que a escolha é interessante:** com parecer favorável, recorrer quase sempre compensa (é o que os clubes fazem no real); com parecer desfavorável, a conta dá empate (4,0 contra 4), e quem decide é o calendário: perder o centroavante agora contra o lanterna ou arriscar perdê-lo no clássico daqui a três rodadas, talvez por um jogo a mais. Não é azar puro: o técnico vê o parecer, a tabela e os jogos antes de decidir.

**Simplificações de propósito:** pena de até 2 jogos não tem efeito suspensivo no jogo (no real é exceção, a critério do relator); a Procuradoria não recorre sozinha (quem cumpre agora não corre risco de aumento); sem custo em dinheiro pelo recurso. As multas ao clube ficam com a parte de torcida do STJD.

**IA dos clubes:** recorre sempre com parecer favorável ou dividido e em metade dos desfavoráveis (`stjd.aiAppealDoubtful = 0.5`).

**Parâmetros (iniciais; vão para `app/src/params/` só depois do ok):** `stjd.redReasonWeights = {preventGoal: 0.35, violentPlay: 0.45, assault: 0.20}`, `stjd.banWeights.violentPlay = {1: 0.5, 2: 0.3, 3: 0.2}`, `stjd.banWeights.assault = {4: 0.5, 5: 0.3, 6: 0.2}`, `stjd.firstInstanceDelayRounds = 1`, `stjd.plenoDelayRounds = 2`, `stjd.plenoOutcomes` (a tabela acima), `stjd.aiAppealDoubtful = 0.5`. Constantes (vêm da lei, não se ajustam): automática de 1 jogo descontada, efeito suspensivo só acima de 2 jogos, 2 jogos cumpridos antes do efeito, passo de 1 jogo no Pleno.

**Frequência esperada (conta, não simulação):** o motor dá cerca de 0,08 vermelho direto por jogo (`partida.md`, T-016), cerca de 1,5 por clube na temporada; pena de 3 ou mais sai em 29% deles (20% + 45% × 20%). A tela de recurso aparece para o clube do técnico cerca de uma vez a cada duas temporadas. Se o CEO quiser mais, o botão é o peso de `assault`, não a regra.

**Casos de borda:**

| Caso                                         | Regra                                                                                 |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| Pleno marcado depois da última rodada        | o Pleno julga na virada; o que sobrar passa para a próxima temporada (art. 171, § 1º) |
| Jogador vendido com pena ou recurso pendente | leva a pena e o recurso para o clube novo                                             |
| Escalar o jogador depois do Pleno confirmar  | é escalação irregular (regra da seção acima)                                          |
| Nova expulsão enquanto o recurso corre       | nova automática e novo julgamento; as penas somam, cada uma com o seu recurso         |
| Absolvição                                   | os 2 jogos cumpridos não voltam; a notícia diz "absolvido, mas já ficou 2 jogos fora" |

**Pedido ao `developer` (Etapa 2, quando o STJD entrar):** evento de vermelho direto com `redReason`; estado de pena por jogador (`banGames`, `appealPending`, `plenoRound`); e o `npm run balance` contando, por temporada, penas por motivo, telas de recurso por clube, resultados do Pleno por parecer e jogos perdidos por quem recorreu e por quem cumpriu. Critérios de aceite: telas de recurso por clube e temporada entre 0,3 e 0,7; jogos perdidos médios de quem recorreu com parecer desfavorável a até ±0,2 de quem cumpriu; nenhuma pena atravessando a temporada fora da regra do art. 171.

### Fontes da pesquisa

- [Lance: STJD concede efeito suspensivo a Victor Gabriel, do Inter (cumpre 2 e joga até o Pleno)](https://www.lance.com.br/internacional/stjd-concede-efeito-suspensivo-a-victor-gabriel-do-inter.html)
- [Band: STJD mantém pena de Victor Gabriel no Pleno](https://www.band.com.br/esportes/stjd-mantem-pena-de-victor-gabriel-por-entrada-em-gabriel-pec-confira-202608071750)
- [Itatiaia: Victor Gabriel punido por até 180 dias](https://www.itatiaia.com.br/esportes/futebol/futebol-nacional/brasileirao-serie-a/stjd-pune-zagueiro-do-inter-por-ate-180-dias-apos-entrada-violenta-em-gabriel-pec/)
- [DGABC: Abel Ferreira consegue efeito suspensivo após chute em microfone](https://www.dgabc.com.br/Noticia/4345339/abel-ferreira-e-palmeiras-conseguem-efeito-suspensivo-apos-chute-em-microfone)
- [Flashscore: STJD aumenta gancho de Abel Ferreira, sem direito a recurso](https://www.flashscore.com.br/noticias/stjd-aumenta-gancho-de-abel-ferreira-sem-direito-a-recurso/Mk941KUI/)
- [Tribuna de Jundiaí: os jogos que Abel perde (só no Brasileiro)](https://tribunadejundiai.com.br/mais/esportes/veja-quais-jogos-abel-ferreira-vai-perder-pelo-palmeiras-apos-suspensao-do-stjd/)
- [Band: Abel tem pena reduzida de 8 para 7 pelo Pleno](https://www.band.com.br/esportes/abel-ferreira-do-palmeiras-tem-pena-reduzida-pelo-stjd-mas-segue-suspenso-202604151444)
- [O Povo: STJD indefere efeito suspensivo para Thiago Carpini](https://www.opovo.com.br/esportes/futebol/times/fortaleza/2026/05/22/stjd-indefere-pedido-do-fortaleza-de-efeito-suspensivo-para-thiago-carpini.html)
- [Diário do Nordeste: Mendoza liberado depois de cumprir 2 jogos (art. 147-B)](https://diariodonordeste.verdesmares.com.br/jogada/mendoza-e-liberado-pelo-stjd-e-ceara-ganha-reforco-para-o-classico-rei-1.3096035)
- [TJD-RS: decisão sobre efeito suspensivo (147-A ope judicis, 147-B ope legis)](https://www.ligagaucha.com.br/assets_site/documentos/TJD_-_DECISÃO_EFEITO_SUSPENSIVO_-_2463524.23.pdf)
- [FPF-PE: parecer com o desconto da automática e a regra da mesma competição](https://www.fpf-pe.com.br/assets/uploads/170837049013.pdf)
- [TJD-DF (2026): automática não se converte nem passa para a temporada seguinte](https://ffdf.com.br/assets/uploads/176796614878.pdf)
- [Bahia Notícias: suspensão automática descontada da pena (caso Neymar)](https://www.bahianoticias.com.br/esportes/noticia/80800-stjd-pune-neymar-com-dois-jogos-de-suspensao-apos-expulsao-contra-o-bahia)
- [Valor Final: cartões no campeonato brasileiro e quando a conta zera](https://valorfinal.com.br/guia/cartoes-amarelos-suspensao-brasileirao)
- [Soccerway: Bruno Henrique cumpre na última rodada da Série A a pena da Copa do Brasil](https://br.soccerway.com/noticias/futebol-brasileirao-betano-stjd-mantem-punicao-a-bruno-henrique-que-desfalca-o-fla-no-encerramento-da-serie-a/AgzFj6RH)
- [Netflu: o art. 171 do CBJD e a pena pendente no fim da competição](https://www.netflu.com.br/nova-resolucao-da-cbf-tem-conflito-com-cbjd/)
- [TNH1: Pulgar pega 4 jogos por agressão (art. 254-A)](https://www.tnh1.com.br/noticia/nid/pulgar-do-flamengo-pega-quatro-jogos-de-suspensao-no-stjd-por-agressao/)
- [O Liberal: Zé Ricardo, 5 jogos, e multa do Remo pelo art. 213](https://www.oliberal.com/esportes/remo/amp/stjd-pune-volante-do-remo-ze-ricardo-com-cinco-jogos-de-suspensao-por-expulsao-contra-o-palmeiras-1.1121838)
- [Lance: Kleber segue suspenso (arts. 254-A e 254-B)](https://www.lance.com.br/futebol-paranaense/stjd-nega-pedido-reconsideracao-coritiba-kleber-segue-suspenso.html)
- [DGABC: caso Bruno Henrique encerrado com multa de R$ 100 mil](https://www.dgabc.com.br/Noticia/4269341/stjd-encerra-caso-bruno-henrique-com-multa-de-r$-100-mil)
- [Jus.com.br: agressão física, jogada violenta e ato hostil no CBJD](https://jus.com.br/artigos/17589/justica-desportiva-agressao-fisica-jogada-violenta-ato-hostil)

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
