<!-- Exportado do documento de projeto (claude.ai) em 2026-11-03. Congelado: a fonte da verdade a partir daqui é o repositório; mudança de decisão vira ADR. -->

# Jogo de Técnico de Futebol – Documento do Projeto

Nov 3, 2026 · @Guilherme

## Visão geral

Um jogo de técnico de futebol no estilo Brasfoot, focado em clubes brasileiros e sul-americanos, jogado no navegador e instalável no celular como app (PWA). Nome provisório: Prancheta (a prancheta tática do técnico), até a conferência no INPI.

- **Plataforma:** navegador (desktop e celular), instalável como PWA, funcionando offline no modo carreira.
- **Modos:** carreira offline (um jogador) e online com vários jogadores (padrão até 8 no ao vivo e até 30 no assíncrono, ajustável), em modo ao vivo ou assíncrono. Nos dois modos, o ritmo pode ser "No meu ritmo" (avança quando quiser) ou "Tempo real" (segue o calendário do futebol brasileiro).
- **Competições:** Séries A a D, Copa do Brasil, estaduais simplificados, Libertadores e Sul-Americana.
- **Mercado:** transferências entre clubes de toda a América do Sul.

**Princípios do projeto**

1. Mobile first: tudo pensado para o celular e uma mão só.
2. Entregas jogáveis a cada etapa, nunca meses sem algo para testar.
3. Dados mínimos dos usuários: o ideal é nenhum dado pessoal.
4. Nada de pagar para ganhar e nada de loot boxes.
5. Arquitetura portável: sem ficar preso a um único provedor.
6. Clubes, jogadores, escudos e vozes sempre fictícios e originais.
7. Completo, mas simples: cada sistema cabe numa tela e numa frase; se precisa de manual, está complexo demais.
8. Três idiomas desde o início: português, espanhol e inglês.

## Clubes, nomes e identidade

Todos os clubes têm nomes em trocadilho que lembram o original, com escudos e uniformes gerados por código; nenhuma marca oficial é copiada.

- **Nomes:** trocadilhos no estilo "Flamingo", mantendo cidade, cores e apelido reconhecíveis. Vale também para clubes de Argentina, Uruguai, Colômbia, Chile e demais países.
- **Escudos:** gerados em SVG, combinando formato, cores, faixas e um símbolo genérico (estrela, animal, letra). Nunca imitam o desenho do escudo real.
- **Uniformes:** padrões (listras, faixas, gola) gerados com as cores do clube.
- **Jogadores:** todos fictícios, com nome, nacionalidade, posição e atributos gerados pelo jogo. Nomes reais de atletas têm direito de imagem.
- **Rostos:** avatares gerados por código (formato do rosto, tom de pele, cabelo, barba).
- **Aviso no jogo:** clubes e jogadores são fictícios; patrocinadores anunciam no jogo, não nos clubes reais.

**Pendente:** lista inicial de clubes por divisão e país, com o trocadilho de cada um.

## Jogadores, contratos e mercado

O modelo de jogadores é completo, mas simples de entender: poucos atributos visíveis, contratos com regras claras e um mercado que inclui o resto do mundo sem simulá-lo.

**Jogador**

| Campo               | Como funciona                                                                                                                      |
| ------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| Atributos           | 6 por posição (por exemplo, para linha: velocidade, técnica, passe, finalização, marcação, físico), de 1 a 99, mais uma nota geral |
| Potencial           | Teto que o jogador pode alcançar; visível só por olheiros ou com o tempo                                                           |
| Forma e moral       | Sobem e descem com jogos, treinos, resultados e tempo no banco                                                                     |
| Idade e evolução    | Jovens evoluem até cerca de 27 anos, estabilizam e declinam depois dos 31; cada jogador tem sua curva                              |
| Lesões e suspensões | Lesões por sorteio influenciado por fadiga; cartões geram suspensão automática                                                     |
| Fadiga              | Cresce com os jogos, cai com descanso; o calendário congestionado obriga rotação                                                   |
| Personalidade       | Um traço simples (líder, temperamental, profissional, ídolo da torcida) que gera notícias e eventos                                |

**Contratos**

- Duração de 1 a 5 anos, salário e multa rescisória; jogador com contrato a vencer pode assinar de graça com outro clube.
- Renovação depende de moral, minutos jogados e ambição do jogador.
- Multa rescisória: qualquer clube pode pagar e levar o jogador, o que cria urgência.

**Mercado**

- **Janelas:** duas por ano, no calendário brasileiro.
- **Negócios:** compra, venda, troca e **empréstimo** (com ou sem opção de compra), entre clubes de toda a América do Sul e entre humanos no online.
- **Olheiros:** revelam atributos e potencial de jogadores de outros países; sem olheiro, a nota aparece como faixa (por exemplo, 60 a 75).
- **Resto do mundo (Europa, Ásia, EUA e México):** mercado abstrato, sem simular ligas de fora. Clubes estrangeiros fazem propostas, geralmente altas, pelos destaques; o jogador vendido aparece como "no exterior" e pode voltar após 2 a 6 anos, mais experiente ou em declínio, às vezes se oferecendo ao antigo clube. Também chegam ofertas de estrangeiros querendo jogar na América do Sul.
- **Agentes:** não existem como sistema; a negociação é direta com o jogador e o clube, para manter a simplicidade.

**Comissão técnica e base**

- Quatro cargos: auxiliar (treinos), preparador físico (fadiga e lesões), médico (recuperação) e olheiro (mercado), cada um com uma nota.
- Treino semanal com um foco por semana (ataque, defesa, físico, descanso), sem microgestão.
- Categoria de base gera 2 a 4 jovens por temporada, com potencial variado; promover um jovem que vira craque é uma das histórias do jogo.

**Economia em longo prazo:** salários e valores são corrigidos a cada temporada por um índice interno, para carreiras de 20 anos não inflacionarem.

## Regras do jogo

As regras seguem o princípio "completo, mas simples": três ajustes táticos, um cálculo de partida que dá para explicar numa frase e uma IA de clubes com personalidade.

### Táticas

| Ajuste   | Opções                                     | Efeito                                                              |
| -------- | ------------------------------------------ | ------------------------------------------------------------------- |
| Formação | 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 3-4-3, 5-3-2 | Define quantos jogadores pesam em cada setor (defesa, meio, ataque) |
| Postura  | Defensiva, equilibrada, ofensiva           | Troca chances criadas por chances sofridas                          |
| Pressão  | Baixa, média, alta                         | Mais bolas recuperadas, mais fadiga e mais cartões                  |

- Escalação com arrastar e soltar; jogador fora da posição perde rendimento.
- Capitão e cobradores de pênalti e falta.
- Comandos durante a partida: pressionar, segurar o resultado, todo mundo no ataque, e até 5 substituições.
- Conversa no intervalo com 3 opções (motivar, cobrar, acalmar), com efeito na moral do segundo tempo.
- Rivalidade: clássicos têm moral e torcida mais altas para os dois lados.

### Cálculo da partida

Cada time recebe uma força por setor (defesa, meio e ataque) a partir dos atributos dos titulares, ajustada por formação, postura, moral, fadiga e mando de campo; a partida é simulada minuto a minuto, e a chance de cada time criar uma oportunidade naquele minuto vem da comparação entre o seu meio e ataque e a defesa do adversário.

- Cada oportunidade vira gol, defesa, trave ou chute para fora conforme o finalizador contra o goleiro.
- Média alvo de 2,5 a 2,8 gols por partida, calibrada pela simulação de centenas de temporadas.
- Zebras acontecem, mas o time melhor vence com mais frequência: um clube 20 pontos mais forte deve vencer cerca de 65% das vezes.
- Mando de campo vale um bônus pequeno, maior em estádio cheio e em altitude (La Paz, Quito).
- Simulação determinística: mesma semente, mesmo resultado, o que permite replay e testes.
- Eventos por partida: gols, cartões, lesões, pênaltis e substituições da IA.

### IA dos outros clubes

Cada clube controlado pela IA tem um perfil que guia escalação, mercado e paciência com o técnico.

| Perfil           | Comportamento                                                   |
| ---------------- | --------------------------------------------------------------- |
| Grande ambicioso | Compra os melhores, vende pouco, exige títulos                  |
| Formador         | Promove a base, vende jovens valorizados para o exterior        |
| Vendedor         | Aceita propostas acima do valor, reinveste em jogadores baratos |
| Tradicional      | Mantém o elenco, contrata experientes, muda pouco               |
| Caótico          | Troca de técnico com frequência, contrata por impulso           |

- Escala pelos melhores atributos, com rotação quando a fadiga sobe.
- Compra para cobrir a posição mais fraca dentro do orçamento; vende quando a proposta supera o valor em cerca de 30%.
- Responde a propostas em até 2 rodadas, com contraproposta quando o valor está perto.
- Também recebe e aceita ofertas do exterior pelos destaques.

### Competições e calendário

| Competição         | Formato                                              | Quando              |
| ------------------ | ---------------------------------------------------- | ------------------- |
| Estaduais          | 8 clubes por estado (grupo único, semifinal e final) | Janeiro a março     |
| Série A e B        | 20 clubes, pontos corridos, 4 sobem e 4 caem         | Abril a dezembro    |
| Série C            | 20 clubes, pontos corridos e quadrangulares finais   | Abril a novembro    |
| Série D            | 64 clubes em grupos e mata-mata                      | Abril a setembro    |
| Copa do Brasil     | Mata-mata com 64 clubes, finais em outubro           | Fevereiro a outubro |
| Libertadores       | 32 clubes em 8 grupos e mata-mata                    | Abril a novembro    |
| Sul-Americana      | 32 clubes em 8 grupos e mata-mata                    | Abril a novembro    |
| Supercopa e Recopa | Jogo único                                           | Janeiro e abril     |

- Vagas na Libertadores e na Sul-Americana pela tabela da Série A e pela Copa do Brasil.
- Calendário congestionado de propósito: semanas com dois jogos obrigam rotação e dão valor ao elenco.
- Premiação em dinheiro por competição e fase; cotas de TV por divisão.

### Diretoria e metas

Cada clube tem um porte (grande, médio ou pequeno) que define as metas da temporada e a paciência da diretoria, medida por uma barra de confiança de 0 a 100.

| Porte   | Meta típica                                               | Paciência                                         |
| ------- | --------------------------------------------------------- | ------------------------------------------------- |
| Grande  | Título ou vaga na Libertadores                            | Baixa: 5 jogos sem vencer já derrubam a confiança |
| Médio   | Primeira metade da tabela, boa campanha na Copa do Brasil | Média                                             |
| Pequeno | Não cair, revelar e vender jogadores                      | Alta: valoriza finanças e jovens                  |

- A confiança sobe com resultados, metas atingidas e torcida feliz; cai com derrotas, metas perdidas e caixa negativo.
- Abaixo de 20, demissão (só no estilo Realista). No estilo Tranquilo a diretoria apenas cobra.
- Com confiança alta, chegam propostas de clubes maiores; o técnico decide se aceita.
- Reuniões com a diretoria em múltipla escolha: pedir verba, prometer resultado, pedir paciência.

### Estádio, torcida e finanças

| Item                      | Como funciona                                                                             |
| ------------------------- | ----------------------------------------------------------------------------------------- |
| Público                   | Depende da capacidade, do termômetro da torcida, do rival, da fase e do preço do ingresso |
| Ingresso                  | Três faixas (popular, normal, caro); caro rende mais por jogo, mas esfria a torcida       |
| Estádio                   | Capacidade inicial por porte; ampliação paga em parcelas, com obras de uma temporada      |
| Receitas                  | Bilheteria, cotas de TV, premiações, patrocínio de camisa, vendas de jogadores            |
| Despesas                  | Salários, comissão técnica, parcelas de contratações e obras                              |
| Caixa negativo            | Diretoria perde confiança, mercado bloqueado até ajustar                                  |
| Sem empréstimos bancários | Para manter simples, a saída é vender jogadores ou cortar salários                        |

### Brasilidades: o que acontece no futebol brasileiro

(Adicionado em 2026-11-03 pela ADR-0005; detalhe e parâmetros em `docs/design/brasilidades.md`.)

O `game-designer` detalha fórmulas e parâmetros em cada etapa; o `content-writer` escreve as notícias e conversas de cada situação. Regra geral: tudo aqui é consequência de escolha do técnico ou da diretoria, com aviso antes; nada é azar puro.

#### Salários e caixa (Etapa 3)

| Situação                 | O que o jogo faz                                                                                                                                                         |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Decidir atrasar salários | Libera o caixa do mês; moral cai (−5 por mês de atraso); a imprensa e a rede social noticiam                                                                             |
| 2 meses de atraso        | Elenco cancela treinos em protesto (treino da semana perdido); confiança da diretoria −10                                                                                |
| 3 meses de atraso        | Qualquer jogador pode rescindir e sair livre para qualquer clube (rescisão indireta, Lei Pelé art. 31); o clube deve os salários até o fim do contrato, que viram dívida |
| Clube da IA atrasando    | Olheiros avisam: jogadores perto de ficar livres aparecem como oportunidade no mercado                                                                                   |

Parâmetros iniciais: `salary.lateMoralePenalty = 5/mês`, `salary.strikeMonth = 2`, `salary.freeAgentMonth = 3`, chance de um jogador rescindir no mês 3: `0.35 × (1 − moral/100)`.

#### Transfer ban e fair play financeiro (Etapa 3)

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

#### Vitrine e formação (Etapa 3; vitrine continental na Etapa 5)

- **Vitrine:** o valor de mercado de um jogador sobe com destaque em jogos de peso: gol ou melhor em campo em clássico (+3%), fase de mata-mata nacional (+5%), Libertadores e Sul-Americana (+8%), convocação para a seleção (+15%). Depois de uma vitrine, propostas do exterior ficam 2× mais prováveis por 3 rodadas. O técnico sente isso na mão: escalar o jovem na Libertadores é investimento.
- **Clube formador:** quem revela um jogador (base ou chegada antes dos 19 anos) recebe solidariedade em toda venda futura dele, pela vida inteira da carreira, mesmo depois de ele sair. Para clubes pequenos, é a receita que faz a base valer a pena.
- **Certificado de clube formador:** com categoria de base nível 3 ou mais, o clube também recebe indenização por formação quando um jovem sai antes do primeiro contrato profissional.
- **No online:** a solidariedade entre humanos é automática, cobrada pelo servidor na hora da venda.

#### STJD (Etapa 2, com o calendário completo)

- Cartões: suspensão automática (3 amarelos ou 1 vermelho), avisada na escalação.
- Escalação irregular: escalar jogador suspenso é permitido, mas custa os pontos do jogo (vão ao adversário), multa e confiança −15. É a "virada de mesa" real (Portuguesa 2013, São Paulo 1999).
- Expulsão por agressão: julgamento em 2 a 4 rodadas, pena de 2 a 6 jogos. O técnico decide pedir **efeito suspensivo**: o jogador segue jogando até o julgamento; se a pena for confirmada, dobra. Chance de absolvição: 30%; de redução: 30%; de confirmação: 40%.
- Torcida: briga ou invasão (probabilidade cresce com termômetro abaixo de 30 ou acima de 90 em clássico): perda de mando (um jogo de portões fechados, bilheteria zero) e multa.
- Recurso ao Pleno: o clube pode recorrer de qualquer pena; a decisão sai 3 a 6 rodadas depois, com 25% de chance de reduzir e 10% de agravar.
- Virada de mesa por liminar: evento raro (≤ 2% por temporada, só no estilo Realista): um clube da IA rebaixado volta pela Justiça comum e a divisão joga com um time a mais na temporada seguinte (Gama 2000).

#### Estrutura do clube e comissão técnica (Etapas 3 e 4)

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

#### Torcida dentro do jogo (Etapa 1a o termômetro; efeitos completos na Etapa 3)

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

#### Sócio-torcedor (Etapa 3)

- Cada clube tem um plano de sócios com número de sócios (depende do porte, do termômetro e da fase) e uma mensalidade em três faixas (popular, normal, premium).
- Receita mensal estável: a principal fonte de caixa de clubes pequenos e médios, como no Brasil.
- Sócios sobem com vitórias, títulos, contratações de impacto e campanha promocional (custa caixa, dá sócios); caem com derrotas em sequência, salários atrasados e preço alto.
- Benefícios dos sócios no jogo: desconto no ingresso (ocupa capacidade com menos bilheteria, mas enche o estádio) e voto simbólico em enquetes que a diretoria leva em conta.
- Decisão do técnico/diretoria: lançar campanha, mudar faixa, dar ingresso grátis em jogo decisivo.

Parâmetros: `members.base = {pequeno: 2000, médio: 15000, grande: 80000}`, `members.perWinPct = 0.5`, `members.perLossPct = -0.4`, `members.lateSalaryPct = -3`, `members.campaignCost = 2% da receita anual`, `members.campaignGainPct = 8`.

#### O que fica de fora de propósito

- Processos trabalhistas detalhados, dívidas fiscais, Profut: viram só a "dívida herdada".
- Doping, manipulação de resultados, apostas: não entram (público com menores; e não é divertido perder por isso).
- Justiça comum contra o seu próprio clube: nunca; a virada de mesa só acontece em favor ou contra a IA.

#### Fontes

- [Gazeta Esportiva: transfer ban vira rotina no Brasil](https://www.gazetaesportiva.com/futebol/transfer-ban-brasil-clubes-serie-a-fifa-dividas/)
- [Diario de Pernambuco: rescisão por três meses de atraso (Lei Pelé)](https://www.diariodepernambuco.com.br/esportes-dp/santa-cruz/2026/06/amp/11715950-jogadores-do-santa-cruz-podem-rescindir-contrato-por-atrasos-salariais-veja-o-que-diz-a-lei.html)
- [Jovem Pan: viradas de mesa (Portuguesa 2013, São Paulo 1999, Gama 2000)](https://jovempan.com.br/?p=5136)
- [NSC Total: perda de pontos e multas por escalação irregular no STJD](https://www.nsctotal.com.br/?p=7830776)

## Arquitetura e tecnologia

O motor do jogo é TypeScript puro, separado da interface, e roda igual no celular (carreira offline) e no servidor (online).

> _(Diagrama no documento original: arquitetura · aparelho e Cloudflare)_

No modo offline nada sai do aparelho; no online, o servidor simula as rodadas com o mesmo motor.

| Camada          | Escolha                                            | Motivo                                                           |
| --------------- | -------------------------------------------------- | ---------------------------------------------------------------- |
| Linguagem       | TypeScript                                         | Tipagem evita bugs com centenas de clubes, jogadores e contratos |
| Interface       | Svelte + Vite (a confirmar; React é a alternativa) | App mais leve em celulares simples                               |
| PWA             | Manifest + service worker (vite-plugin-pwa)        | Instalável e offline                                             |
| Saves locais    | IndexedDB                                          | Carreira sem servidor                                            |
| Partida animada | PixiJS ou canvas                                   | Campo 2D fluido no celular                                       |
| Backend         | Hono                                               | Roda em Workers, Node e Bun                                      |
| Banco           | D1 (SQLite)                                        | SQL padrão, fácil de migrar                                      |

### Configuração central da marca

Um único arquivo de configuração (por exemplo, `projeto.config.ts`) guarda nome, logo e identidade; jogo, servidor, painel de admin e PWA leem tudo dele, então trocar a marca é editar um arquivo e publicar de novo.

| Campo                      | Exemplo                         | Onde aparece                                          |
| -------------------------- | ------------------------------- | ----------------------------------------------------- |
| Nome completo e nome curto | "Prancheta" / "Prancheta"       | Título, tela inicial, ícone instalado, textos do jogo |
| Slogan                     | Frase curta                     | Tela de abertura, loja de apps                        |
| Logo                       | Arquivo SVG                     | Topo do app, abertura, painel de admin                |
| Cores da marca             | Primária, secundária, destaque  | Design system inteiro (tokens)                        |
| Fontes                     | Títulos e textos                | Design system                                         |
| Domínio                    | A definir                       | Links, PWA, servidor                                  |
| Contatos e links           | E-mail de suporte, apoio, redes | Rodapé, ajuda, tela de apoio                          |
| Dados legais               | Responsável, cidade             | Política de privacidade, termos                       |

**Gerado automaticamente a partir dele:** manifest do PWA, ícones em todos os tamanhos, favicon, telas de abertura do celular, meta tags de compartilhamento, títulos das páginas e cores do tema.

**Regras para nada ficar preso à marca**

- Nenhum texto do jogo escreve o nome direto no código: tudo usa o valor da configuração.
- Imagens do ComfyUI sem nome ou logo embutidos; o logo é sobreposto por código.
- Narração nunca fala o nome do jogo.

**Cuidados**

- Trocar nome e ícone atualiza o app instalado no Android sozinho com o tempo; no iPhone pode exigir reinstalar.
- Trocar o **domínio** cria, na prática, outro app: os saves locais ficam no domínio antigo. Por isso, escolher o domínio cedo e ter exportar e importar save desde a Etapa 1.

## Hospedagem e portabilidade

A hospedagem será na Cloudflare, porque o plano gratuito permite uso comercial e reúne site, API, banco e salas online no mesmo lugar.

| Serviço         | Uso no jogo                                            | Plano gratuito                                           |
| --------------- | ------------------------------------------------------ | -------------------------------------------------------- |
| Pages           | Site e PWA                                             | Banda ilimitada, uso comercial permitido                 |
| Workers         | API do modo online                                     | 100 mil requisições por dia, 10 ms de CPU por requisição |
| D1 (SQLite)     | Contas anônimas, ligas, mercado                        | Até 500 MB por banco                                     |
| Durable Objects | Uma sala por liga online, alarmes de prazo, WebSockets | Disponível com limites                                   |

- **Por que não Vercel:** o plano Hobby é só para uso pessoal e não comercial; com anúncios ou apoio seria preciso o Pro, a US$ 20 por usuário por mês.
- **Custo previsto:** zero até o online; depois, provavelmente o plano pago dos Workers, de US$ 5 por mês, por causa do tempo de CPU da simulação.

**Portabilidade (para migrar a uma VPS no futuro)**

- Backend escrito com Hono, que roda igual em Workers, Node e Bun.
- Banco acessado por uma camada própria com SQL padrão: troca simples para SQLite ou Postgres.
- Salas online atrás de uma interface própria: numa VPS viram um servidor de WebSocket comum.
- Gatilho para migrar: simulação pesada demais ou necessidade de controle total.

[Vercel – Hobby](https://vercel.com/docs/plans/hobby-plan) · [Cloudflare Workers – limites](https://developers.cloudflare.com/workers/platform/limits) · [Cloudflare D1 – limites](https://developers.cloudflare.com:2083/d1/platform/limits)

## Modo online

Ligas com vários jogadores humanos (padrão até 8 no ao vivo e até 30 no assíncrono, ajustável no painel de admin), em que a rodada avança quando todos confirmam ou quando o prazo acaba; os modos ao vivo e assíncrono são a mesma liga com prazos diferentes.

|                      | Ao vivo                                  | Assíncrono                                         |
| -------------------- | ---------------------------------------- | -------------------------------------------------- |
| Prazo por rodada     | Curto, por exemplo 2 minutos             | Longo, por exemplo 24 horas                        |
| Jogadores conectados | Todos ao mesmo tempo                     | Cada um entra quando puder                         |
| Resultado            | Simulado na hora, visto por todos juntos | Processado no prazo ou antes, se todos confirmarem |
| Extras               | Placares ao vivo, mensagens prontas      | Notificação de rodada processada                   |

**Fluxo de uma rodada**

1. Cada jogador ajusta escalação e tática e aperta "Pronto".
2. A rodada é simulada no servidor quando todos confirmam ou o prazo vence.
3. Quem não confirmou joga com a última escalação salva.
4. Resultados, tabela e notícias chegam a todos.

**Regras da liga**

- Um jogador cria a liga, escolhe o modo e convida os amigos por código. O limite de jogadores por modo é uma configuração, não um número fixo no código; o ao vivo tem limite menor porque esperar muita gente trava a rodada.
- Os demais clubes são controlados pela IA. Em ligas grandes, humanos podem estar em divisões diferentes e se encontrar nas copas e na Libertadores.
- O dono da liga pode trocar o modo no meio da temporada.
- Mercado entre humanos: propostas de compra e troca, com prazo para aceitar ou recusar.
- O servidor simula as partidas com o mesmo motor do modo offline, então ninguém manipula resultados.

## Novo jogo: configurações iniciais

Todo jogo novo começa por uma tela de configuração própria do modo, com valores padrão já preenchidos para quem quer só começar.

**Carreira (offline)**

| Configuração       | Opções                                                                                                                                                                   |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Ritmo              | No meu ritmo ou Tempo real (segue o calendário brasileiro real)                                                                                                          |
| Apelido do técnico | Texto livre, guardado só no aparelho                                                                                                                                     |
| Início             | Escolher qualquer clube, ou começar desempregado e receber propostas de clubes menores                                                                                   |
| Tipo de carreira   | Clube fixo (sem demissão) ou técnico livre (diretoria cobra, demite, outros clubes chamam)                                                                               |
| Competições ativas | Só Brasil, ou Brasil + América do Sul (mais pesado em celulares simples)                                                                                                 |
| Estilo             | Dois estilos: Tranquilo (diretoria paciente, caixa folgado, sem demissão) ou Realista (cobrança normal, demissão possível). A dificuldade de verdade é o clube escolhido |
| Realismo           | Lesões, cartões e fadiga ligados ou simplificados                                                                                                                        |
| Partida            | Animada completa, só lances principais ou só resultado                                                                                                                   |
| Áudio              | Narração, torcida e música ligadas ou desligadas                                                                                                                         |
| Backup na nuvem    | Ligado ou desligado (ver Saves e backup)                                                                                                                                 |

**Liga online**

| Configuração      | Opções                                                                                                                      |
| ----------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Nome da liga      | Texto filtrado                                                                                                              |
| Modo              | Ao vivo ou assíncrono, com o prazo por rodada; ou Tempo real, em que o prazo é o dia da rodada real                         |
| Jogadores humanos | 2 até o limite do modo (padrão 8 ao vivo, 30 assíncrono)                                                                    |
| Escolha de clubes | Livre, sorteio ou draft (cada um escolhe na sua vez); em ligas grandes, sorteio ou escolha livre, porque o draft fica longo |
| Equilíbrio        | Clubes como são, ou orçamentos nivelados para todos os humanos                                                              |
| Competições       | Mesmas opções da carreira                                                                                                   |
| Mercado           | Janelas de transferência, limite de negócios entre humanos                                                                  |
| Inatividade       | Após quantas rodadas sem confirmar a IA assume o clube                                                                      |
| Mensagens         | Mensagens prontas ligadas ou desligadas                                                                                     |
| Duração           | Número de temporadas, ou sem fim                                                                                            |

As escolhas ficam salvas como "última configuração" para agilizar o próximo jogo.

### Ritmo: no meu ritmo ou tempo real

Além do modo (Carreira ou Liga online), todo jogo novo escolhe um ritmo; "Tempo real" faz a rodada do jogo acontecer no mesmo dia da rodada real do futebol brasileiro.

| Ritmo                 | Como funciona                                                                                                                                                              | Onde                             |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------- |
| No meu ritmo (padrão) | O jogador avança a rodada quando quiser; no online, pelo prazo ao vivo ou assíncrono                                                                                       | Carreira e Liga online           |
| Tempo real            | A temporada segue as datas reais: estaduais em janeiro, Brasileirão de abril a dezembro, copas e Libertadores nas semanas certas; janelas de transferência nas datas reais | Carreira e Liga online (Etapa 4) |

**Em tempo real**

- No dia da rodada, o jogador recebe a notificação, monta o time e joga; nos outros dias cuida de treinos, mercado e rede social.
- Quem perder o dia não trava: a partida é simulada com a última escalação e o resultado fica disponível depois.
- Na liga online, o dia real da rodada é o prazo; isso cria ligas de longa duração, com uma temporada por ano.
- Quem entra no meio do ano escolhe entre começar na rodada atual ou esperar a próxima competição.
- Chama o jogador uma vez por rodada, sem recompensa por tempo de uso.

**Calendário real**

- Só as datas são usadas; nunca resultados, elencos ou nomes reais. Confirmar com o advogado junto com o restante.
- As datas ficam num arquivo de calendário no servidor, atualizado pelo painel de admin a cada temporada e quando jogos são remarcados; o app baixa e guarda uma cópia.
- Sem conexão, vale um calendário aproximado embutido no app.

## Saves e backup

O progresso fica protegido em quatro camadas, sem exigir conta nem dado pessoal; só a última camada usa o servidor, e mesmo assim de forma cifrada.

1. **Salvamento automático:** ao fim de cada rodada, com as 3 últimas versões guardadas. Se uma corromper, volta-se para a anterior.
2. **Armazenamento persistente:** o jogo pede ao navegador que não apague os dados. Instalar o app na tela inicial ajuda muito, principalmente no iPhone, onde o Safari pode limpar dados de sites pouco usados.
3. **Exportar save:** gera um arquivo de save que a pessoa guarda onde quiser (Drive, WhatsApp, e-mail para si mesma) pelo botão de compartilhar do celular. Importar restaura em qualquer aparelho, inclusive após troca de domínio.
4. **Sincronização com o servidor (opcional):** com a conta anônima, o save da carreira é enviado automaticamente ao fim de cada rodada, cifrado no aparelho com uma chave derivada do código de recuperação, e guardado no Cloudflare R2. Funciona como backup e permite continuar a carreira em outro aparelho. O servidor guarda um arquivo que não consegue ler.

**Regras de segurança do save**

- Gravação segura: o save novo só substitui o antigo depois de conferido.
- Cada save leva a versão do formato; atualizações do jogo convertem saves antigos em vez de quebrá-los.
- Lembrete discreto para exportar ao fim de cada temporada, que a pessoa pode desligar.
- Antes de apagar um jogo, confirmação dupla e oferta de exportar.

**Online já fica no servidor:** o estado das ligas online vive no servidor, que é quem simula as rodadas, então esse progresso não depende do aparelho.

**Sincronização sem internet:** o jogo continua offline normalmente e envia o save quando a conexão volta. Se a mesma carreira avançar em dois aparelhos sem sincronizar, o jogo mostra as duas versões (clube, temporada, rodada, data) e a pessoa escolhe qual manter; a outra vira um save separado, nunca é apagada.

**Custo:** um save comprimido deve ter poucos megabytes e o R2 tem 10 GB gratuitos, o suficiente para milhares de carreiras.

**Quando entra:** camadas 1 a 3 na Etapa 1; contas anônimas já na Etapa 1 (pelo online mínimo); sincronização dos saves na Etapa 4, quando as carreiras ficam longas e valiosas.

## Fluxos de jogo

Os dois modos seguem o mesmo ciclo de temporada; a diferença é que na carreira tudo roda no aparelho e no online o servidor guarda a liga e decide quando a rodada avança.

### Carreira (offline)

> _(Diagrama no documento original: fluxo da carreira offline)_

O jogador avança no próprio ritmo; o salvamento automático e a sincronização acontecem ao fim de cada rodada.

### Liga online

> _(Diagrama no documento original: fluxo da liga online)_

No modo ao vivo o prazo é curto e todos veem as partidas juntos; no assíncrono o prazo é longo e cada um recebe a notificação quando a rodada é processada.

## Etapas de desenvolvimento

O jogo cresce em 6 etapas, e cada uma termina com uma versão jogável e instalável; a Etapa 1 é a próxima.

> _(Diagrama no documento original: etapas · 6 entregas jogáveis)_

A Etapa 1 já inclui os espaços de patrocínio com marcas fictícias e, na sua segunda metade, o **online mínimo**: ligas da Série A entre amigos por código de convite, nos modos ao vivo e assíncrono, com contas anônimas (apelido + passkey + código de recuperação), o servidor simulando as rodadas com o mesmo motor e mensagens prontas. Ficam para as etapas seguintes só o que depende delas: mercado entre humanos (Etapa 3), tempo real e sincronização de saves (Etapa 4), ligas com várias divisões e torneios continentais (Etapas 2 e 5), painel de admin completo, denúncias e apoio via PIX (Etapa 6). Por isso o servidor (Hono, Workers, D1, Durable Objects) e o `security-auditor` com a lista de privacidade entram desde a Etapa 1.

**Etapa 1 em duas metades:** 1a, carreira offline jogável (Série A completa, PWA, saves); 1b, online mínimo sobre o mesmo motor. A 1a sai primeiro para o devlog e para testes com amigos; a 1b vem logo depois, sem esperar a Etapa 2.

## Padrões de design

O visual é mobile first, com cara de estádio à noite, e será registrado num design system antes do código da interface.

- **Navegação:** abas na parte de baixo (Clube, Elenco, Tabela, Mercado, Calendário); botão principal "Jogar rodada" sempre ao alcance do polegar.
- **Tema:** escuro como padrão, claro opcional. Cores de destaque para gramado, placar e alertas.
- **Tipografia:** fonte condensada para placares e números (por exemplo, Barlow Condensed) e uma bem legível para textos (por exemplo, Inter). Números em largura fixa nas tabelas.
- **Tabelas no celular:** coluna do clube fixa e estatísticas rolando para o lado.
- **Acessibilidade:** alvos de toque de no mínimo 44 px, bom contraste, resultados indicados por texto ou ícone e não só por cor, respeito à opção "reduzir movimento".

**Componentes base:** card de partida, linha de tabela, card de jogador, escudo, placar, barra de abas, card de notícia, carta de contratação.

**Pendente:** paleta de cores e referências visuais preferidas.

## Arte e áudio

Imagens únicas saem do ComfyUI rodando localmente na RTX 5080; narração e efeitos saem do ElevenLabs; escudos, uniformes e rostos são gerados por código.

| Recurso                                                       | Ferramenta      | Observação                                                        |
| ------------------------------------------------------------- | --------------- | ----------------------------------------------------------------- |
| Escudos, uniformes, rostos                                    | Código (SVG)    | Infinitos, leves, estilo único                                    |
| Estádios, troféus, telas de fundo, ilustrações de notícias    | ComfyUI (local) | Mesmo estilo em tudo, idealmente com um LoRA próprio              |
| Narração em português                                         | ElevenLabs      | Voz original criada no Voice Design, nunca clone de narrador real |
| Efeitos (apito, chute, rede, trave, torcida, vaia, interface) | ElevenLabs      | Livres de royalties nos planos pagos                              |
| Música de menu                                                | A definir       | ElevenLabs pago ou músico independente                            |

**ComfyUI**

- Baixar só pelo GitHub oficial da Comfy Org; o site comfyui.com não é oficial.
- Usar a versão portátil mais recente, que suporta placas Blackwell como a RTX 5080 (16 GB de VRAM).
- Conferir a licença de cada modelo antes de usar no jogo; alguns restringem uso comercial.
- Nunca citar escudos, uniformes ou estádios reais nos prompts.

**ElevenLabs**

- O plano gratuito não tem licença comercial: usar só para testar vozes e frases.
- Com o roteiro fechado, assinar o Starter (cerca de US$ 6 por mês) e gerar todo o banco; a licença cobre o que foi gerado durante a assinatura.
- Narração: frases-chave com 3 a 5 variações ("GOOOOL!", "Que defesa!", "Na trave!", "Pênalti!", "Fim de jogo!", "Virada!").
- Nome de cada clube narrado ("Gol do Flamingo!"); jogadores sem nome na voz ("Gol do camisa 9!"), com o nome na tela.
- Arquivos comprimidos e carregados sob demanda.

[ElevenLabs – publicação de conteúdo](https://elevenlabs.io/docs/help-center/legal/can-i-publish-the-content-i-generate-on-the-platform/llms.txt) · [ElevenLabs – efeitos comerciais](https://elevenlabs.io/sound-effects/commercial)

## Animações e engajamento saudável

O jogo prende pela tensão da partida e pela história do clube, não por mecânicas de uso compulsivo, que o ECA Digital manda limitar.

**Tela da partida**

- Campo 2D visto de cima, jogadores como bolinhas nas cores do uniforme, mostrando só os lances importantes.
- Narração em texto rolando e voz nos momentos-chave; torcida que cresce no ataque, explode no gol e vaia quando o time vai mal.
- Câmera lenta e pausa dramática antes de revelar se foi gol.
- Comemoração com escudo, nome do artilheiro e vibração do celular (Android).
- Decisões durante o jogo: substituições, tática, comandos ("pressionar", "segurar o resultado", "todo mundo no ataque") e conversa no intervalo.
- Opção "só resultado" para quem tem pressa.

**Fora da partida:** tabela com setas animadas, contratações reveladas como carta, jornal com manchetes do seu time, cerimônia de título.

**Tecnologia:** PixiJS ou canvas para o campo; CSS e Motion para a interface.

**O que prende (sim):** rivalidades, cobrança da diretoria, imprensa, jovem da base que vira craque, última rodada decisiva, conquistas por feito ("da Série D à A"), rodadas curtas de 2 a 3 minutos.

**O que evitar (não):** recompensa diária por login, sequências de dias seguidos, recompensas por tempo de uso, reprodução automática sem fim.

## Notícias e mensagens

Notícias e mensagens vêm de um sistema de templates gerado pelo motor do jogo, não de IA em tempo de jogo; a IA é usada só na produção, para escrever milhares de variações revisadas.

**Por que não IA ao vivo:** o modo carreira é offline, o custo por rodada no online seria alto, a IA pode inventar fatos, e todo texto mostrado a um público com menores precisa ser previsível e revisado.

**Como a variação fica boa**

| Camada               | O que varia                                                                                                                                | Meta                                                        |
| -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| Evento               | Cada fato do jogo tem seu conjunto de frases (goleada, virada, zebra, lesão, venda, contrato a vencer, jovem estreando, série de derrotas) | 150 a 200 tipos de evento                                   |
| Variações por evento | Frases diferentes para o mesmo fato                                                                                                        | 8 a 12 por evento, por idioma                               |
| Veículo              | Jornal sério, programa polêmico, rádio, perfil da torcida; cada um com tom próprio                                                         | 4 veículos                                                  |
| Contexto             | A mesma vitória muda de frase se é clássico, se quebra um jejum, se vale título ou rebaixamento                                            | Modificadores por rivalidade, momento na tabela e histórico |
| Personalidade        | Traço do jogador (líder, temperamental, ídolo) escolhe a frase e gera eventos próprios                                                     | 1 traço por jogador                                         |
| Memória              | O jogo guarda as últimas 50 frases usadas e evita repetir                                                                                  | Nenhuma repetição em menos de 20 rodadas                    |
| Composição           | Manchete + 1 a 3 parágrafos montados de blocos independentes                                                                               | Combinações na casa dos milhares por evento                 |

**Mensagens e conversas**

- Diretoria, jogadores e imprensa falam pelo mesmo sistema, com **respostas em múltipla escolha** (2 ou 3 opções), cada uma com efeito na moral, na relação com a diretoria ou na imprensa.
- Tipos: entrevista pós-jogo, conversa com jogador insatisfeito, reunião com a diretoria, proposta de outro clube, conversa no intervalo.
- Entre humanos no online: mensagens prontas e emojis, como definido na seção de privacidade.

**Produção:** os templates ficam em arquivos de texto por idioma, fora do código, numa linguagem simples de placeholders ({clube}, {rival}, {artilheiro}, {placar}). A IA gera as variações em lote em português, espanhol e inglês; cada lote passa por revisão humana antes de entrar no jogo. Uma ferramenta de teste simula 50 temporadas e lista as frases mais repetidas, para saber onde faltam variações.

**Opcional no futuro:** um resumo semanal da liga online escrito por IA no servidor, uma chamada por liga e por rodada, com cache. Só depois de o online existir.

### Rede social do jogo

Uma aba em formato de feed mostra reações fictícias de torcedores, canais de TV, influenciadores e jogadores ao que acontece com o clube; é a mesma geração por templates, só com cara de rede social.

**Perfis fictícios (gerados por código)**

| Tipo                  | Exemplo de comportamento                                                                         |
| --------------------- | ------------------------------------------------------------------------------------------------ |
| Torcedores comuns     | Reagem a cada jogo; humor sobe e desce com a fase; cobram contratações e reclamam do técnico     |
| Torcedor fanático     | Exagera para os dois lados: "melhor time do mundo" numa semana, "vergonha" na outra              |
| Torcedor rival        | Provoca depois de derrotas e clássicos                                                           |
| Canal de TV e rádio   | Manchetes, escalação vazada, polêmica de arbitragem                                              |
| Influenciador         | Opiniões fortes, enquetes ("deve demitir o técnico?") com resultado que reflete a torcida        |
| Jornalista de mercado | Boatos de transferência: parte verdadeira, parte falsa, com "fontes"                             |
| Jogadores do clube    | Comemoram, agradecem a torcida, soltam indireta quando estão no banco (depende da personalidade) |
| Diretoria             | Comunicados oficiais: bastidores, notas de apoio ou de "confiança" antes da demissão             |

**Como funciona**

- Cada perfil tem nome, avatar gerado por código, tipo e um humor que muda com os resultados.
- Os posts têm curtidas, comentários fictícios e, às vezes, respostas em cadeia (torcedor provoca, rival responde).
- A partir das enquetes e do humor dos torcedores, o jogo mostra um **termômetro da torcida**, que influencia bilheteria, pressão da diretoria e moral dos jogadores.
- O técnico pode **reagir a um post** com múltipla escolha (responder, ignorar, dar entrevista), com consequências, igual às conversas.
- Boatos de mercado criam oportunidades: alguns são verdadeiros e antecipam propostas.
- Mesma variação das notícias: perfis com voz própria, memória de frases, contexto de clássico e fase.

**Limites**

- Tudo é fictício e gerado pelo jogo: nenhum usuário real posta ou lê posts de outros; isso não é um chat, então não cria obrigações de moderação.
- Nomes de perfis e veículos são inventados, sem referência a emissoras, jornalistas ou influenciadores reais.
- Tom sempre de brincadeira: provocações de torcida, nunca ofensas, preconceito ou ataques pessoais.
- Quem não gostar pode desligar a aba nas configurações.

**Quando entra:** versão simples (torcedores e canal de TV) na Etapa 1; perfis completos, enquetes e reações do técnico na Etapa 4.

## Privacidade, LGPD e ECA Digital

O jogo coleta o mínimo possível: nada no modo offline e apenas um apelido e uma chave pública no online.

| Área                | Decisão                                                                                                  |
| ------------------- | -------------------------------------------------------------------------------------------------------- |
| Modo offline        | Saves só no aparelho (IndexedDB); sem cadastro                                                           |
| Conta online        | Anônima: apelido + passkey (biometria do celular); sem e-mail, telefone, nome real ou data de nascimento |
| Recuperação         | Código de recuperação; sem ele e sem o aparelho, a conta se perde                                        |
| Rastreamento        | Nenhum SDK de anúncio, cookie de terceiros ou analytics que identifique pessoas; sem banner de cookies   |
| IP                  | O app não grava; a Cloudflare processa conforme a política dela                                          |
| Pagamentos de apoio | Dados ficam no provedor (por exemplo, Mercado Pago); o jogo guarda só um código de recompensa            |
| Patrocínios         | Só contagem total de impressões                                                                          |

**ECA Digital (Lei 15.211/2025, em vigor desde 17 de março de 2026)**

O jogo é de acesso provável por menores, então a lei se aplica.

- Loot boxes proibidas: o jogo não terá itens aleatórios pagos, só cosméticos comprados de forma direta.
- Interação entre usuários exige denúncia e opção de desativar o chat: chat só com mensagens prontas e emojis, desligável.
- Apelidos filtrados, com botão de denúncia.
- Microtransações para menores exigem consentimento dos pais (Lei 14.852/2024): apoio via PIX fora do jogo, com aviso.
- Meta de classificação indicativa: Livre.
- Política de privacidade curta descrevendo exatamente o que está acima.

**Pendente:** consulta rápida com advogado de direito digital antes de monetizar.

[Poder360 – ECA Digital](https://www.poder360.com.br/poder-governo/eca-digital-entra-em-vigor-nesta-3a-feira-entenda-o-que-muda/) · [Confidata – ECA Digital](https://confidata.com.br/blog/eca-digital-o-que-muda-empresas) · [SMA – ECA Digital](https://smabr.com/eca-digital/) · [Conjur – jogos eletrônicos](https://www.conjur.com.br/2025-out-22/impactos-do-eca-digital-no-segmento-de-jogos-eletronicos//?print=1)

## Monetização e apoio

A receita vem de patrocinadores reais no cenário do jogo e de apoio voluntário com recompensas cosméticas, sem vantagem competitiva.

**Patrocínios no cenário**

- Espaços: placas em volta do campo, placar, camisas, nome de competição e de estádio, telas de carregamento, resumo da rodada.
- Os espaços vêm do servidor (imagem, link, período): vender e trocar anúncios sem atualizar o app.
- Espaço vazio mostra uma marca fictícia.
- Anúncios identificáveis como publicidade.
- Evitar apostas e bebidas alcoólicas, por causa do público menor de idade.

**Apoio ao projeto**

- PIX direto ou plataformas como Apoia.se, Catarse e Ko-fi.
- Recompensas: nome nos créditos, selo de apoiador no online, editor de escudo e uniforme, nome do estádio personalizado, acesso antecipado.
- Nada de pagar para ganhar.
- Se o jogo for para a Play Store como app empacotado, itens digitais vendidos lá dentro seguem as regras do Google; apoio via site é mais simples.

**Quando entra:** espaços de patrocínio já na Etapa 1, com marcas fictícias; link de apoio simples desde cedo; PIX com recompensas na conta anônima na Etapa 6.

## Painel de admin

Um painel web separado, só para a equipe, cuida de patrocínios, saúde do servidor, suporte, denúncias e ligas online.

| Módulo            | O que faz                                                                                      |
| ----------------- | ---------------------------------------------------------------------------------------------- |
| Patrocínios       | Cadastrar espaços e anunciantes, subir artes, definir período, ver impressões totais           |
| Saúde do servidor | Erros, tempo de resposta, uso dos limites da Cloudflare, rodadas atrasadas                     |
| Ligas online      | Ver ligas ativas, pausar, reprocessar uma rodada com problema                                  |
| Denúncias         | Fila de apelidos e mensagens denunciados, com ação (renomear, suspender)                       |
| Suporte           | Caixa de mensagens de ajuda com status (aberto, respondido, fechado)                           |
| Apoiadores        | Gerar e conferir códigos de recompensa do PIX                                                  |
| Configurações     | Avisos dentro do jogo, ligar e desligar funções, modo manutenção, limite de jogadores por modo |

**Segurança**

- Em um subdomínio próprio (por exemplo, admin.), protegido por Cloudflare Access: login com e-mail da equipe e segundo fator, antes mesmo de a página carregar.
- Cada ação importante registrada em log (quem fez, o quê, quando).

**Suporte e LGPD**

- O jogo não pede e-mail; quem quer ajuda escreve por um formulário ou para um endereço de suporte, e esse contato vira dado pessoal.
- Guardar só o necessário e apagar as conversas fechadas após um prazo definido (por exemplo, 90 dias), informado na política de privacidade.
- Formulário com aviso para não enviar dados sensíveis.

**Quando entra:** uma versão mínima (patrocínios e avisos) junto com o primeiro patrocinador real; denúncias, ligas e suporte completos na Etapa 6, porque o ECA Digital exige canal de denúncia quando há interação entre jogadores.

## Backlog de recursos por etapa

Todos os 30 pontos da auditoria de 3 de novembro de 2026 foram aceitos e entram nas etapas indicadas; os de jogadores, contratos e mercado já estão detalhados na seção própria. O critério para cada um é o mesmo do projeto: completo, mas simples, e sempre a serviço da diversão.

**Motor do jogo e regras**

| Item                               | Por que importa                                                                                | Etapa                     |
| ---------------------------------- | ---------------------------------------------------------------------------------------------- | ------------------------- |
| Modelo de atributos dos jogadores  | Base de tudo: habilidades, forma, moral, idade, potencial e curva de evolução e declínio       | 1                         |
| Comissão técnica                   | Auxiliar, preparador físico, médico e olheiros dão profundidade à gestão                       | 3                         |
| Treinos                            | Melhoram atributos, cansaço e moral; sem eles a evolução fica só no acaso                      | 3                         |
| Lesões, suspensões e fadiga        | Obrigam rotação com o calendário brasileiro lotado                                             | 1 (simples), 3 (completo) |
| Empréstimos de jogadores           | Muito comum no Brasil; faltam no plano de mercado                                              | 3                         |
| Contratos e multas rescisórias     | Vencimento, renovação, jogador livre e multa definem o mercado                                 | 3                         |
| Olheiros e descoberta              | Mercado sul-americano só funciona se houver como descobrir jogadores                           | 5                         |
| Calendário congestionado           | Estaduais, Série, Copa do Brasil e Libertadores juntos: conflitos de data e rotação            | 2                         |
| Supercopa e Recopa                 | Completam o calendário de títulos                                                              | 2 e 5                     |
| Mando de campo, altitude e clima   | Jogar em La Paz ou no calor do Nordeste muda a partida e diverte                               | 5                         |
| Simulação determinística (semente) | Mesma entrada, mesmo resultado: reprodução de partidas, testes e justiça no online             | 1                         |
| Balanceamento automático           | Simular centenas de temporadas para checar realismo (placares, campeões, inflação de salários) | 1 em diante               |

**Experiência do jogador**

| Item                              | Por que importa                                                                                                                                        | Etapa |
| --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| Tutorial e primeiros passos       | Jogo de gestão intimida; um guia curto reduz abandono                                                                                                  | 1     |
| Vários saves                      | Mais de uma carreira ao mesmo tempo                                                                                                                    | 1     |
| Histórico e recordes              | Hall da fama, artilheiros históricos, troféus do técnico: motivo para continuar                                                                        | 4     |
| Replay de partidas                | Rever o gol do título; depende da semente                                                                                                              | 4     |
| Editor de clubes                  | A comunidade do Brasfoot vive de edições; permitir editar nomes e escudos só localmente, sem compartilhar, para não virar distribuição de marcas reais | 4     |
| Página pública da liga online     | Link com tabela e resultados para compartilhar; traz novos jogadores                                                                                   | 6     |
| Notificações push no assíncrono   | No iPhone, só funcionam com o app instalado na tela inicial; precisa pedir permissão na hora certa                                                     | 6     |
| Modo férias no online             | Jogador avisa ausência e a IA assume temporariamente, sem perder o clube                                                                               | 6     |
| Fuso horário dos prazos           | Prazos mostrados na hora local de cada jogador                                                                                                         | 6     |
| Bloquear jogador                  | Além de denunciar, poder silenciar alguém na liga                                                                                                      | 6     |
| Aviso de nova versão              | PWA atualiza em segundo plano; mostrar "nova versão disponível" e trocar sem perder a rodada                                                           | 1     |
| Layout de desktop                 | O jogo também será jogado no computador; abas embaixo viram barra lateral                                                                              | 1     |
| Tamanho de fonte e leitor de tela | Acessibilidade além do contraste e dos alvos de toque                                                                                                  | 2     |

**Infraestrutura e operação**

| Item                                          | Por que importa                                                                                   | Etapa |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----- |
| Cópia de segurança do servidor                | O D1 e o R2 também podem falhar; exportação diária automática das ligas e dos saves sincronizados | 4     |
| Registro de erros sem dados pessoais          | Saber que o jogo quebrou no celular de alguém, sem identificar a pessoa                           | 1     |
| Estatísticas de uso sem cookies               | Quantas pessoas jogam, por país, sem identificar ninguém (por exemplo, Cloudflare Web Analytics)  | 1     |
| Limites de requisição e proteção contra abuso | Convites repetidos, criação de contas em massa, flood no mercado                                  | 6     |
| Integração e publicação automáticas           | Repositório no GitHub com testes rodando a cada mudança e publicação automática na Cloudflare     | 1     |
| Tamanho do app e consumo de dados             | Áudio e imagens baixados sob demanda; meta de instalação inicial abaixo de 10 MB                  | 1     |
| Ferramenta de cadastro dos clubes             | Planilha ou tela de admin para montar e revisar os dados iniciais de centenas de clubes           | 1     |

**Produto, legal e comunidade**

| Item                                     | Por que importa                                                                                                                                                                                                                     | Etapa                       |
| ---------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------- |
| Idiomas                                  | Português, espanhol e inglês são essenciais: estrutura de tradução na Etapa 1, com todos os textos em arquivos separados do código; as três línguas completas até a Etapa 5; narração em voz em português e espanhol, inglês depois | 1 (estrutura), 5 (espanhol) |
| Registro da marca                        | Conferir o nome no INPI antes de divulgar, para não ter que trocar depois                                                                                                                                                           | antes da Etapa 1            |
| Termos de uso e classificação indicativa | Além da política de privacidade; classificação Livre pode ser autodeclarada                                                                                                                                                         | 6                           |
| Anúncios e menores                       | O ECA Digital restringe publicidade baseada em perfil para menores; os patrocínios serão só contextuais, iguais para todos                                                                                                          | 1                           |
| Licença do código                        | Decidir se o projeto será aberto ou fechado; afeta contribuições e a marca                                                                                                                                                          | antes da Etapa 1            |
| Canal com a comunidade                   | Onde receber sugestões e testar versões (beta); mudanças registradas num changelog dentro do jogo                                                                                                                                   | 1                           |
| Economia em longo prazo                  | Carreiras de 20 temporadas inflacionam salários e valores; precisa de regra de correção                                                                                                                                             | 4                           |

## Site e devlog desde o dia 1

O site do Prancheta vai ao ar no Cloudflare Pages antes de o jogo existir, com um devlog público que registra o desenvolvimento desde o primeiro dia.

**O que entra no site já na primeira semana**

| Página      | Conteúdo                                                                                                                     |
| ----------- | ---------------------------------------------------------------------------------------------------------------------------- |
| Início      | Nome, uma frase, o cover do design system, aviso "em desenvolvimento" e o link do devlog                                     |
| Devlog      | Lista de posts em ordem inversa; um post por marco ou por semana, com o que foi feito, o que vem a seguir e capturas de tela |
| Roadmap     | As 6 etapas com o estado de cada uma (planejada, em andamento, jogável)                                                      |
| Jogar       | Botão para a versão atual, mesmo incompleta, com o número da versão; leva ao app em /jogo                                    |
| Apoiar      | Link de apoio simples (PIX ou plataforma), até existir a versão completa na Etapa 6                                          |
| Privacidade | A política curta descrita na seção de privacidade                                                                            |

**Como funciona**

- Site estático gerado com Astro no mesmo repositório do jogo, em pastas separadas: o site em `site/`, o jogo em `app/`. O site é publicado em `/`, e o jogo em `/jogo`, no mesmo domínio.
- Cada post do devlog é um arquivo Markdown com data, título e tags; o Astro gera as páginas, o feed RSS e as meta tags de compartilhamento.
- Nome, logo e cores do site vêm do mesmo arquivo de configuração central do jogo.
- Publicação automática: todo push na branch principal publica site e jogo no Cloudflare Pages; cada pull request ganha uma prévia com link próprio.
- O primeiro post é o "Dia 1": a ideia, o que o jogo vai ser e o link deste documento de projeto (ou um resumo dele).
- Ritmo: um post curto por semana, mesmo que seja "nesta semana só o motor de simulação evoluiu". Posts maiores a cada etapa concluída.
- Capturas de tela e vídeos curtos do jogo rodando no celular valem mais que texto.
- Estatísticas de visitas sem cookies, pelo Cloudflare Web Analytics, para saber se o devlog tem leitores.

**Primeiros passos, nesta ordem**

1. Criar o repositório no GitHub com `site/`, `app/` e o arquivo de configuração central.
2. Publicar o site no Cloudflare Pages com o domínio escolhido e o post "Dia 1".
3. Colocar a versão zero do jogo em `/jogo`: uma tela com o escudo, o nome e o botão "Jogar rodada" que ainda não faz nada.
4. A partir daí, cada semana traz um post e uma versão nova em `/jogo`.

## Processo de desenvolvimento com agentes

O projeto usa o modelo "Empresa de Agentes" (orquestrador, departamentos especialistas, três portões de qualidade e o CEO decidindo o que é irreversível), com o elenco adaptado a um jogo: entram cinco departamentos de design, arte, áudio, conteúdo e regras de jogo, e o redator técnico assume o devlog.

**Departamentos do Prancheta**

| Agente           | Situação                     | Faz                                                                                                                                                                                                                  | Modelo                                                        |
| ---------------- | ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Orquestrador     | Mantido                      | Planeja, delega, cobra, relata ao CEO                                                                                                                                                                                | opus                                                          |
| product-manager  | Mantido                      | Histórias de usuário e critérios de aceite a partir deste documento; perguntas ao CEO                                                                                                                                | opus                                                          |
| game-designer    | Novo                         | Regras do jogo (táticas, cálculo da partida, IA dos clubes, economia), fórmulas e tabelas de balanceamento; roda a simulação de centenas de temporadas e ajusta até bater as metas (gols por jogo, zebras, inflação) | opus                                                          |
| architect        | Mantido                      | Motor separado da interface, modelo de dados, formato de save com versão, API e salas online, ADRs                                                                                                                   | opus (fable em decisões difíceis)                             |
| developer        | Mantido                      | Uma tarefa por vez, em branch, com testes                                                                                                                                                                            | sonnet na interface; opus no motor (determinismo e simulação) |
| ux-designer      | Novo                         | Guardião do design system: telas, fluxos, componentes Svelte, uso por uma mão, acessibilidade, estados de carregamento e erro; revisa toda tela nova contra o design system                                          | opus                                                          |
| art-director     | Novo                         | Gerador de escudos, uniformes e avatares em SVG; estilo visual único; fluxos e prompts do ComfyUI para o CEO rodar na RTX 5080; organização dos assets e licenças dos modelos                                        | sonnet                                                        |
| audio-designer   | Novo                         | Banco de frases da narração (pt, es), lista de eventos sonoros, prompts e vozes do ElevenLabs, mixagem e carregamento sob demanda; nunca gera áudio pago sem ok do CEO                                               | sonnet                                                        |
| content-writer   | Novo                         | Templates de notícias, rede social, conversas e mensagens prontas nos três idiomas; nomes de clubes, jogadores e veículos fictícios; arquivos de tradução; roda a ferramenta de repetição                            | sonnet (haiku para variações em lote)                         |
| code-reviewer    | Mantido (portão 1)           | Revisa o diff; veto                                                                                                                                                                                                  | opus                                                          |
| qa-engineer      | Mantido (portão 2)           | Testes de aceite, regressão, testes de determinismo (mesma semente, mesmo resultado) e de migração de saves                                                                                                          | sonnet                                                        |
| security-auditor | Mantido (portão 3), ampliado | Segurança, dependências e também a lista de privacidade: nenhum dado pessoal novo, LGPD, ECA Digital (sem loot box, chat só com mensagens prontas, canal de denúncia)                                                | opus                                                          |
| project-auditor  | Mantido                      | Auditoria geral no fim de cada etapa                                                                                                                                                                                 | fable                                                         |
| devops-engineer  | Mantido, reduzido            | Pipeline do Cloudflare Pages, prévias por PR, Workers e D1 a partir da Etapa 4; só documenta o que custa dinheiro                                                                                                    | sonnet                                                        |
| tech-writer      | Mantido, ampliado            | README, CHANGELOG, docs e o post semanal do devlog (absorve o papel opcional writer)                                                                                                                                 | sonnet                                                        |

**Sem mudança no kit:** os seis comandos, o hook de travas, os templates e a estrutura de `docs/`.

**Comandos novos**

| Comando             | Roda                                                                                                  |
| ------------------- | ----------------------------------------------------------------------------------------------------- |
| `/balance`          | game-designer simula N temporadas e devolve as métricas contra as metas, com a proposta de ajuste     |
| `/content <evento>` | content-writer gera um lote de variações nos três idiomas para revisão do CEO                         |
| `/devlog`           | tech-writer escreve o post da semana a partir do git log e do status                                  |
| `/assets <tipo>`    | art-director prepara o fluxo do ComfyUI ou o lote de escudos; audio-designer prepara o roteiro de voz |

**O que só o CEO faz, além do padrão**

- Rodar o ComfyUI (usa a GPU e abre janela): os agentes entregam fluxos e prompts, o CEO gera e devolve os arquivos.
- Gerar áudio no ElevenLabs pago: cada lote precisa de ok por escrito, com a estimativa de créditos.
- Publicar no domínio de produção, criar o projeto no Cloudflare, cadastrar chaves, assinar serviços.
- Aprovar cada lote de textos do content-writer antes de entrar no jogo (público com menores).
- Conferir o nome no INPI e aprovar a lista de clubes com trocadilhos.

**Travas específicas no hook:** deploy para produção, chamada à API do ElevenLabs, comando que apaga saves ou o banco D1, alteração do arquivo de calendário real, e publicação de post no devlog sem revisão.

**Documentação viva:** este documento é exportado para `docs/00-vision.md` e `docs/02-architecture.md` no `/kickoff` e congelado; a partir daí a fonte da verdade é o repositório. O design system continua no artefato e seus tokens são exportados para `app/src/tokens.css`.

**Caminho leve (`/quick`):** textos, templates, tokens de cor e ajustes de tela; até 5 arquivos; nunca toca o motor de simulação, o formato de save, o servidor online ou a configuração central.

## Decisões pendentes e próximos passos

O próximo passo é fechar o visual no design system e começar a Etapa 1.

- [ ] Nome provisório definido: Prancheta (conferir no INPI antes de divulgar)
- [ ] Definir o domínio cedo (trocar depois separa os saves)
- [ ] Conferir o nome no INPI antes de divulgar
- [ ] Decidir se o código será aberto ou fechado
- [ ] Confirmar a interface: Svelte (recomendado) ou React
- [ ] Definir paleta de cores e referências visuais
- [ ] Design system montado: Prancheta (tema noite e dia, Barlow Condensed e Barlow, 7 componentes); revisar cores e componentes
- [ ] Listar os 20 clubes da Série A com trocadilhos
- [ ] Instalar o ComfyUI oficial e testar um estilo visual
- [ ] Testar vozes de narração no plano gratuito do ElevenLabs
- [ ] Criar o repositório, publicar o site com o devlog "Dia 1" no Cloudflare Pages e começar a Etapa 1
- [ ] Consultar um advogado de direito digital antes de monetizar
