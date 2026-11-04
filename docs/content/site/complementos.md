# Complementos de texto do site

> Status: **aguardando ok do CEO**. Autor: `tech-writer`. Só pt-BR. Textos que a implementação precisou além dos arquivos aprovados. Onde o developer escreveu algo bom, mantive; o que mudou está marcado com "(novo)" ou "(ajustado)". `{config.name}` = nome de `config/prancheta.config.ts`. Sem data, sem promessa, sem nome real.

## Meta descriptions (sem o nome do jogo escrito à mão)

| Página    | Texto                                                                                                                                                      |
| --------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| O jogo    | (ajustado) Uma temporada da Série A, tática em três ajustes e partida minuto a minuto, com notícias e torcida reagindo: veja como é jogar o {config.name}. |
| Modos     | (mantido) Carreira offline para jogar sozinho, liga online com amigos por código de convite e dois ritmos: no meu ritmo ou em tempo real.                  |
| Clubes    | (ajustado) Todos os clubes são fictícios, com nomes em trocadilho e escudos desenhados por código. Conheça a ideia por trás dos times do {config.name}.    |
| Perguntas | (ajustado) Preço, celular, privacidade, clubes fictícios e online: respostas diretas às dúvidas mais comuns sobre o {config.name}, sem enrolação.          |

## Início

| Onde                         | Texto                                                                                                                             |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| Selo do topo                 | Em desenvolvimento, em público (mantido)                                                                                          |
| Título da seção              | Destaques (mantido)                                                                                                               |
| Link do cartão 1             | Conhecer o jogo (mantido)                                                                                                         |
| Link dos cartões 2 e 3       | Ver os modos de jogo (mantido)                                                                                                    |
| Link do cartão 4             | Ver os clubes (mantido)                                                                                                           |
| Passo 1                      | **Abra o jogo.** Use o botão acima, no celular.                                                                                   |
| Passo 2                      | **Instale na tela inicial.** O navegador oferece; no iPhone, pelo botão de compartilhar.                                          |
| Passo 3                      | **Escolha um clube.** E jogue a primeira rodada.                                                                                  |
| Nota sob os passos           | Hoje o passo 3 ainda não existe: a escolha de clube e as rodadas estão sendo construídas. Veja o estado de cada coisa no roteiro. |
| Link da faixa "Onde estamos" | Ver o roteiro completo (mantido)                                                                                                  |

Obs. para o developer: na frase de abertura de "Perguntas", falta espaço antes do link ("ou o<a ...>roteiro"). Deve ser "ou o roteiro".

## Fechamento (FinalCta, todas as páginas)

- **Título:** Pronto para a prancheta? (mantido)
- **Botão principal:** Abrir a versão atual (v{config.version}) (mantido)
- **Botão secundário:** Ver o roteiro

## O jogo

- **Rótulo do sumário** (`aria-label` do `nav`): Nesta página
- **Texto alternativo, formação:** Diagrama de campo com onze jogadores em linhas, na formação 4-3-3.
- **Texto alternativo, postura:** Diagrama de campo com três setas de ataque, cada uma de um tamanho: quanto maior, mais ofensiva a postura.
- **Texto alternativo, pressão (corrigido):** Diagrama de campo com três faixas, cada uma mais clara que a anterior: quanto mais clara, mais alta a pressão.
- **Legenda da partida:** Exemplo ilustrativo, com clubes fictícios

**Partida de exemplo:** Flamingo 2 x 1 Corinto.

| Minuto | Lance                                               |
| ------ | --------------------------------------------------- |
| 12'    | Chute de fora da área, a bola passa perto da trave. |
| 34'    | Gol do Flamingo, em cobrança de pênalti.            |
| 58'    | Cartão amarelo para o volante do Corinto.           |
| 71'    | Gol do Corinto, em cabeceio na área.                |
| 89'    | Gol do Flamingo, aos 89: a vitória está perto.      |

O placar e os lances batem: três gols (2 a 1) nos minutos 34, 71 e 89. Só o lance de 89' muda: "a vitória está perto" repete o placar, então fica **"Gol do Flamingo, aos 89, de cabeça, na segunda trave."**

**Termômetro de exemplo:** 72 de 100, "animada". Legenda: Termômetro de exemplo, de 0 a 100.

**Notícia de exemplo**

- Rótulo: Notícia · Diário do Escanteio Curto
- Manchete: Gol no fim e casa em festa
- Texto: O Flamingo achou o gol da vitória aos 89 minutos e deixou a torcida em êxtase.
- Marca: Exemplo fictício

**Nome do veículo (novo): "Diário do Escanteio Curto".** Não usa "Jornal da Várzea", que é nome comum e pode existir de verdade. Como conferi: busquei o nome entre aspas na web e **não consegui rodar a busca neste ambiente** (o buscador não devolveu resultados nem para uma consulta comum). O que posso afirmar é que o nome não aparece em nenhum arquivo do repositório e que não usa nome de emissora, jornal ou portal que eu conheça. **Pendência do CEO (1 minuto):** pesquisar "Diário do Escanteio Curto" entre aspas antes de publicar. Se aparecer algo, a reserva é "Gazeta do Apito Perdido".

**Post de rede social de exemplo (ajustado)**

- Rótulo: Rede social do jogo · Torcedor exagerado
- Título: Time de campeão, dá para ver de longe
- Texto: Que jogo! A Flamingada está em festa e eu já estou contando os pontos do título.
- Marca: Exemplo fictício

Por que mudei: "que engula o choro" aponta para quem duvidou e soa a deboche entre pessoas. Para um público com menores, o exemplo mostra o exagero de torcedor (a graça do perfil) sem mandar recado a ninguém.

**Rótulos:** "Notícia ·" e "Rede social do jogo ·" (mantidos; o ponto médio separa do nome do veículo ou perfil) e "Exemplo fictício" (mantido).

## Modos de jogo

**Títulos dos passos da liga**

| Passo | Título (ajustado) | Texto (mantido)                                                            |
| ----- | ----------------- | -------------------------------------------------------------------------- |
| 1     | Monte o time      | Cada um ajusta escalação e tática e aperta "Pronto".                       |
| 2     | Hora da rodada    | Quando todos confirmam, ou quando o prazo acaba, o servidor joga a rodada. |
| 3     | Quem faltou       | Quem não confirmou joga com a última escalação salva.                      |
| 4     | Resultado         | Resultados, tabela e notícias chegam para todo mundo.                      |

**Linhas da tabela de ritmos**

| Linha         | No meu ritmo (padrão)                                                                       | Tempo real                                                                                                                                 |
| ------------- | ------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| Quando avança | Você avança a rodada quando quiser. Na carreira, sem pressa. No online, pelo prazo da liga. | A temporada acompanha as datas do futebol brasileiro: estaduais no começo do ano, a Série A de abril a dezembro, copas nas semanas certas. |
| Quando chega  | Etapa 1a, na carreira. (Hoje: em desenvolvimento.)                                          | Etapa 4, na carreira e no online. (Hoje: planejado.)                                                                                       |

Ajuste: em "Quando chega" use "Etapa 1a, na carreira" e "Etapa 4, na carreira e no online" como valores, e deixe o selo de estado fazer o resto. Mantidos os valores do developer.

**Tabela "O que entra em cada etapa": coluna "O que entra para o jogador"** (novo; sem termos técnicos; o cabeçalho da coluna é "O que entra" e o nome longo vale como `aria-label`)

| Etapa | O que entra para o jogador                                                                                                                          |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0     | O site no ar, o devlog e uma primeira tela do jogo.                                                                                                 |
| 1a    | Uma temporada completa da Série A: escale o time, ajuste a tática, veja a partida e acompanhe a tabela. Instala no celular e funciona sem internet. |
| 1b    | Ligas com os amigos por código de convite, ao vivo ou no seu horário, com conta sem e-mail e sem cadastro.                                          |
| 2     | Séries A a D com subida e queda, Copa do Brasil, estaduais e as confusões do tribunal esportivo.                                                    |
| 3     | Mercado de jogadores, empréstimos, salários, estádio, sócio-torcedor e estrutura do clube.                                                          |
| 4     | Carreira longa: metas da diretoria, risco de demissão, propostas, base e o jogo em tempo real.                                                      |
| 5     | Clubes de outros países da América do Sul, torneios continentais e o jogo em espanhol e inglês.                                                     |
| 6     | Ligas grandes com várias divisões, modo férias, denúncia e bloqueio, e apoio ao projeto por PIX.                                                    |

## Clubes

- **Título da seção de escudos:** Alguns escudos de exemplo (mantido)
- **Frase sob os escudos (ajustada):** Cada escudo é desenhado por código, a partir do formato, das cores e de um símbolo simples (estrela, bola ou letra), e é sempre o mesmo para o mesmo clube. Os 20 da Série A serão apresentados aqui em breve.
- **Correção em `clubes.md`:** onde estava "(estrela, letra, animal)" agora está "(estrela, bola ou letra)", conforme o gerador (`star`, `ball`, `letter`). Aplicada.
- **Nota:** a frase "assim que a lista for aprovada para publicação" do developer fala de processo interno. A versão acima tira isso do texto público.

## Perguntas frequentes

- **Pergunta recolocada:** "Achei um erro ou tenho uma ideia. Para onde vou?"
  - **Resposta:** Abra um tópico nas Discussões do projeto no GitHub ({config.contacts.discussionsUrl}). Lá cabem relatos de erro, ideias e perguntas.
  - Fica no grupo "Projeto", depois de "O nome é definitivo?".
- **Fecho (título):** Não achou a sua pergunta?
- **Fecho (texto):** Escreva no mesmo lugar: as Discussões do projeto no GitHub. Se preferir, acompanhe o devlog.
- **Se o campo `discussionsUrl` estiver vazio:** Acompanhe o devlog (mantido, com o repositório quando existir).

## Rodapé

- **Texto (aprovado em `inicio.md`):** O nome {config.name} é provisório, até a conferência de marca. Clubes, jogadores e patrocinadores do jogo são fictícios.
- **Linha de versão:** Versão {config.version}
- **Links, nesta ordem:** Privacidade, Apoiar, Roteiro, Devlog, Discussões (e, à parte, "RSS do devlog").
- Troca em relação ao código: sai "é um jogo independente, em desenvolvimento", que não foi aprovado; entra o texto acima. "Roteiro" e "Devlog" precisam entrar na lista de links do rodapé.

## Rótulos de componente

| Componente                 | Texto                                                                                                                                              |
| -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- |
| Link padrão do cartão      | Saiba mais (mantido)                                                                                                                               |
| Coluna da tabela de etapas | O que entra (mantido)                                                                                                                              |
| Escudo (`aria-label`)      | Escudo: {nome do clube}. O artigo de "Escudo do …" erra o gênero com nomes como "Santões" ou "São Paulão"; os dois pontos resolvem todos os casos. |
| Tabela com rolagem         | {nome da tabela} (tabela com rolagem) (mantido)                                                                                                    |

## Descrições para compartilhar (revisão)

> Status: **aprovado pelo CEO em 2026-11-04** (título de Clubes: "Clubes com trocadilho"). Motivo: a descrição da página inicial (o slogan, 86 caracteres) e as das demais páginas (141 a 150 caracteres nas quatro com texto longo) são cortadas na prévia do WhatsApp. Cada descrição abaixo tem no máximo 110 caracteres (contado com o nome já no lugar; o maior tem 104), sem nome real e sem data. Valem para `<meta name="description">` e `og:description`. `{config.name}` = nome de `config/prancheta.config.ts`.

| Página      | Descrição (meta e Open Graph)                                                                                | Título da imagem de compartilhamento |
| ----------- | ------------------------------------------------------------------------------------------------------------ | ------------------------------------ |
| Início      | Técnico de futebol no celular, com clubes fictícios do Brasil. Acompanhe o {config.name} em construção.      | O Brasil inteiro na prancheta        |
| O jogo      | Escale o time, ajuste a tática em três opções e acompanhe a partida minuto a minuto no {config.name}.        | Como é jogar                         |
| Modos       | Carreira offline ou liga online com amigos, no seu ritmo ou em tempo real. Veja os modos do {config.name}.   | Carreira ou liga com amigos          |
| Clubes      | Clubes fictícios com nomes em trocadilho e escudos desenhados por código. Conheça os times do {config.name}. | Clubes com trocadilho                |
| Perguntas   | Preço, celular, privacidade e online: respostas diretas sobre o {config.name}.                               | Perguntas frequentes                 |
| Roteiro     | As etapas do {config.name}, cada uma com uma versão jogável. Veja onde estamos.                              | O roteiro do jogo                    |
| Devlog      | O diário de desenvolvimento do {config.name}: o que ficou pronto e o que vem a seguir.                       | Diário de desenvolvimento            |
| Apoiar      | Como apoiar o desenvolvimento do {config.name}.                                                              | Apoie o projeto                      |
| Privacidade | Política de privacidade do {config.name}: o que o jogo guarda e o que não guarda.                            | Privacidade                          |

**Slogan na imagem.** O slogan completo (86 caracteres) é longo demais para a imagem e quebraria em quatro linhas. Versão curta para a imagem do Início: **"O Brasil inteiro na prancheta"** (29 caracteres), a última parte do próprio slogan. O slogan completo continua no site e no `<title>`.

**Para a implementação (depois do ok):** hoje só `index.astro` usa o slogan como descrição; as demais páginas têm textos longos em `site/src/pages/*.astro` e o Devlog não passa descrição. A troca é de textos; o título curto da imagem pede um campo novo na configuração (por exemplo `slogan.short`), a cargo do Desenvolvimento.

## Página Clubes: frase sobre o escudo (revisão)

> Status: **aprovado pelo CEO em 2026-11-04** (escudos estilo A v5, ADR-0014). Substitui a frase que citava "um símbolo simples (estrela, bola ou letra)".

Cada escudo tem o formato, as cores e um símbolo da cidade do clube, com uma estrela para cada título. Tudo desenhado por código.

## Página Clubes: lista "Como um clube nasce" (revisão do item Escudo)

> Status: **aguardando o CEO**. Autor: `content-writer`. Só pt-BR. Motivo: o item "Escudo" ainda descreve o gerador antigo ("símbolo simples (estrela, bola ou letra)"). A regra vigente é a do ADR-0014 e do gerador v5. Não repete a frase aprovada do topo da página (formato, cores, símbolo da cidade, estrela por título); detalha o que ela não diz: de onde vêm silhueta, cores e padrão, e a cor das estrelas. Os demais itens da lista (Nome, Cidade e cores, Uniforme, Estádio, Torcida) foram lidos e não estão desatualizados quanto ao escudo; ficam como estão.

**Antes** (`site/src/pages/clubes.astro`, linhas 44 a 47):

> **Escudo:** desenhado por código, combinando formato, cores, faixas e um símbolo simples (estrela, bola ou letra). Nunca imita um escudo real.

**Depois (proposto):**

> **Escudo:** desenhado por código. A silhueta, as cores e o tipo de padrão lembram o clube que inspirou o time, mas o desenho é sempre novo. O símbolo vem da cidade, e as estrelas são douradas para títulos da Série A e prateadas para os da Série B.

Notas:

- Sai a frase "Nunca imita um escudo real": a palavra "real" sugeria comparação. A ideia (lembra na forma, não copia) fica em "o desenho é sempre novo".
- Não cita sigla, letra, nome nem símbolo de nenhum clube (ADR-0014).
- 241 caracteres, cabe em um item de lista sem quebrar o layout.

**Pendências fora do pedido, para o CEO decidir:**

1. A "Frase sob os escudos" da seção "Clubes" deste arquivo (acima) também cita "um símbolo simples (estrela, bola ou letra)". Já foi substituída pela frase aprovada em 2026-11-04; confirmar que o site usa a nova e não a antiga.
2. O item "Nome" da lista exemplifica com "Coritibom" e "Botafogueira", que ficam muito perto de nomes de clubes existentes. Sugiro trocar por exemplos mais distantes, em outro lote, se o CEO concordar.
