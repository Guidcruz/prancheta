# Requisitos

> Escrito pelo `product-manager` no `/kickoff`, a partir do backlog de `docs/PROJETO.md`, e revisado em 2026-11-04 com as decisões do CEO (ver "Decisões do CEO (2026-11-04)" no fim). Cada história cabe num PR e cada critério de aceite vira um teste. IDs são estáveis: nunca renumerar, só acrescentar.

Escopo deste arquivo: **Etapa 1** inteira, em duas metades (ADR-0003): **1a**, carreira offline da Série A; **1b**, online mínimo sobre o mesmo motor. Tudo o que não aparece aqui está fora do escopo da Etapa 1 (ver "Fora do escopo da Etapa 1" no fim e `docs/roadmap.md`).

Convenções usadas nas histórias:

- **Números de jogo** (pesos, probabilidades, limiares) não são decididos aqui: vêm de `app/src/params/`, com metas em `docs/design/balance-targets.md` e regras nos documentos de sistema do `game-designer` em `docs/design/`. Os critérios dizem "o parâmetro X" quando o valor é dele.
- **Textos** mostrados ao jogador vêm sempre de `app/src/content/<idioma>/`; nenhum critério aceita texto escrito no código.
- **Acessibilidade** vale para toda tela: alvos de toque ≥ 44 px, contraste ≥ 4,5:1, resultado nunca indicado só por cor (sempre texto ou ícone junto), animações respeitam `prefers-reduced-motion`. Os critérios repetem isso só onde o risco é maior.
- **Estado** `rascunho` = depende de uma decisão ou de um insumo do CEO ainda pendente (indicado em "Depende de"); `pronta` = pode ser implementada. A aprovação de cada lote de textos pelo CEO faz parte do PR de conteúdo e não deixa a história em rascunho.
- **Decisões** já tomadas aparecem nos critérios como "(P1)", "(P2)" etc., com a resposta registrada em "Decisões do CEO (2026-11-04)".
- **Ordem**: o índice segue a ordem em que as coisas precisam existir.

## Índice

| ID     | Título                                                     | Etapa | Prioridade | Estado   |
| ------ | ---------------------------------------------------------- | ----- | ---------- | -------- |
| US-001 | Cadastro e validação dos 20 clubes da Série A              | 1a    | Must       | pronta   |
| US-002 | Uniformes gerados por código                               | 1a    | Must       | pronta   |
| US-003 | Gerador de nomes fictícios de jogadores                    | 1a    | Must       | pronta   |
| US-004 | Modelo de jogador e geração dos elencos                    | 1a    | Must       | pronta   |
| US-005 | Avatares de jogadores gerados por código                   | 1a    | Should     | pronta   |
| US-006 | Calendário da Série A (38 rodadas)                         | 1a    | Must       | pronta   |
| US-007 | Motor: força por setor a partir de escalação e tática      | 1a    | Must       | pronta   |
| US-008 | Motor: partida simulada minuto a minuto, determinística    | 1a    | Must       | pronta   |
| US-009 | Motor: cartões, suspensões, lesões simples e pênaltis      | 1a    | Must       | pronta   |
| US-010 | Forma, moral e fadiga entre rodadas                        | 1a    | Must       | pronta   |
| US-011 | IA dos clubes: escalação, rotação e substituições          | 1a    | Must       | pronta   |
| US-012 | Rodada completa e tabela de classificação com desempate    | 1a    | Must       | pronta   |
| US-013 | Ferramenta de balanceamento (`npm run balance`)            | 1a    | Must       | pronta   |
| US-014 | Novo jogo: configuração da carreira                        | 1a    | Must       | pronta   |
| US-015 | Navegação principal (celular e desktop) e tela do clube    | 1a    | Must       | pronta   |
| US-016 | Tela do elenco e card do jogador                           | 1a    | Must       | pronta   |
| US-017 | Escalação com arrastar e soltar                            | 1a    | Must       | pronta   |
| US-018 | Ajustes táticos, capitão e cobradores                      | 1a    | Must       | pronta   |
| US-019 | Jogar rodada no modo "só resultado"                        | 1a    | Must       | pronta   |
| US-020 | Partida animada no campo 2D                                | 1a    | Must       | pronta   |
| US-021 | Comandos e substituições durante a partida                 | 1a    | Must       | pronta   |
| US-022 | Conversa no intervalo                                      | 1a    | Should     | pronta   |
| US-023 | Tela da tabela                                             | 1a    | Must       | pronta   |
| US-024 | Tela do calendário e resultados                            | 1a    | Must       | pronta   |
| US-025 | Fim de temporada e passagem para a seguinte                | 1a    | Must       | pronta   |
| US-026 | Termômetro da torcida e clássicos                          | 1a    | Must       | pronta   |
| US-027 | Sistema de templates de texto                              | 1a    | Must       | pronta   |
| US-028 | Notícias da rodada (jornal)                                | 1a    | Must       | pronta   |
| US-029 | Rede social simples (torcedores e canal de TV)             | 1a    | Must       | pronta   |
| US-030 | Entrevista pós-jogo em múltipla escolha                    | 1a    | Should     | pronta   |
| US-031 | Ferramenta de repetição de templates                       | 1a    | Should     | pronta   |
| US-032 | Salvamento automático com 3 versões e gravação segura      | 1a    | Must       | pronta   |
| US-033 | Versão do formato de save e migração                       | 1a    | Must       | pronta   |
| US-034 | Vários saves: listar, continuar e apagar                   | 1a    | Must       | pronta   |
| US-035 | Exportar save                                              | 1a    | Must       | pronta   |
| US-036 | Importar save                                              | 1a    | Must       | pronta   |
| US-037 | Armazenamento persistente e lembrete de exportar           | 1a    | Must       | pronta   |
| US-038 | PWA instalável e jogável offline                           | 1a    | Must       | pronta   |
| US-039 | Aviso de nova versão e novidades no jogo                   | 1a    | Must       | pronta   |
| US-040 | Estrutura de tradução e escolha de idioma                  | 1a    | Must       | pronta   |
| US-041 | Marcas fictícias no cenário                                | 1a    | Must       | pronta   |
| US-042 | Tutorial e primeiros passos                                | 1a    | Should     | pronta   |
| US-043 | Tela "Sobre": aviso de ficção, versão, privacidade e links | 1a    | Must       | pronta   |
| US-044 | Preferências: tema, vibração, tipo de partida, rede social | 1a    | Should     | pronta   |
| US-045 | Tratamento e registro de erros sem dados pessoais          | 1a    | Must       | pronta   |
| US-046 | Estatísticas de uso do site sem cookies                    | 1a    | Could      | pronta   |
| US-047 | Criar conta anônima com apelido e passkey                  | 1b    | Must       | rascunho |
| US-048 | Código de recuperação                                      | 1b    | Must       | pronta   |
| US-049 | Entrar de novo e recuperar a conta em outro aparelho       | 1b    | Must       | pronta   |
| US-050 | Apagar a conta                                             | 1b    | Must       | pronta   |
| US-051 | Criar liga online da Série A                               | 1b    | Must       | pronta   |
| US-052 | Entrar na liga por código de convite                       | 1b    | Must       | pronta   |
| US-053 | Escolha de clubes: livre e sorteio                         | 1b    | Must       | pronta   |
| US-054 | Escolha de clubes por draft                                | 1b    | Could      | pronta   |
| US-055 | Preparar a rodada online e confirmar "Pronto"              | 1b    | Must       | pronta   |
| US-056 | Servidor processa a rodada com o mesmo motor               | 1b    | Must       | pronta   |
| US-057 | Modo ao vivo: partidas vistas juntas                       | 1b    | Must       | pronta   |
| US-058 | Modo assíncrono: aviso de rodada processada                | 1b    | Must       | pronta   |
| US-059 | Resultados, tabela e notícias da liga para todos           | 1b    | Must       | pronta   |
| US-060 | Inatividade: a IA assume o clube                           | 1b    | Must       | pronta   |
| US-061 | Dono da liga troca o modo no meio da temporada             | 1b    | Should     | pronta   |
| US-062 | Mensagens prontas e emojis                                 | 1b    | Must       | pronta   |
| US-063 | Fim de temporada e duração da liga online                  | 1b    | Must       | pronta   |
| US-064 | Lista de privacidade da 1b auditada e política atualizada  | 1b    | Must       | pronta   |
| US-065 | Denunciar apelido ou nome de liga                          | 1b    | Must       | rascunho |
| US-066 | Temporada base nos dados de clubes e no novo jogo          | 1a    | Must       | pronta   |
| US-067 | Lote anual de atualização da temporada base                | 1a    | Should     | pronta   |
| US-068 | Títulos da carreira somam ao histórico do clube            | 1a    | Must       | pronta   |
| US-069 | Força inicial pela colocação da temporada anterior         | 1a    | Must       | pronta   |
| US-070 | Placar ao vivo dos outros jogos na partida                 | 1a    | Should     | pronta   |
| US-071 | Tabela ao vivo: se terminasse agora, intervalo e fim       | 1a    | Should     | pronta   |
| US-072 | Importância do gol em outro jogo                           | 1a    | Should     | pronta   |
| US-073 | Plantão dos outros jogos na tela da partida                | 1a    | Should     | pronta   |
| US-074 | Preferência "Plantão dos outros jogos"                     | 1a    | Should     | pronta   |

Totais: 55 histórias da 1a (US-001 a US-046 e US-066 a US-074) e 19 da 1b (US-047 a US-065). US-066 a US-069 vêm da regra do CEO sobre os dados de referência dos clubes (2026-11-04) e foram acrescentadas no fim, fora da ordem de dependência do índice: na 1a, entram junto da US-001 (dados), da US-025 (fim de temporada) e da US-032/US-033 (save). US-070 a US-074 vêm do pedido do CEO de 2026-11-05 (placar, tabela ao vivo e plantão dos outros jogos da rodada, "como na TV") e entram depois da partida animada (US-020), da conversa do intervalo (US-022) e da tela da tabela (US-023). Depois das decisões de 2026-11-04 e do acréscimo de 2026-11-05: 72 prontas e 2 em rascunho (US-047, domínio definitivo; US-065, quem trata as denúncias e em quanto tempo).

---

## US-001: Cadastro e validação dos 20 clubes da Série A

**Como** equipe de conteúdo, **quero** um arquivo de dados dos 20 clubes da Série A com validação automática, **para** montar e revisar os clubes sem tocar no código e sem deixar escapar nome real.

**Prioridade:** Must
**Depende de:** lista dos 20 clubes, aprovada pelo CEO em 2026-11-04 (`docs/content/lotes/2026-11-04-nomes-serie-a.md`)
**Notas:** [PROJETO.md › Clubes, nomes e identidade](PROJETO.md#clubes-nomes-e-identidade); item "Ferramenta de cadastro dos clubes" do [backlog](PROJETO.md#backlog-de-recursos-por-etapa). Cada clube tem: id, nome em trocadilho, nome curto, cidade, estado, cores, apelido, porte (grande, médio, pequeno), perfil de IA ([IA dos outros clubes](PROJETO.md#ia-dos-outros-clubes)), estádio fictício e capacidade, e lista de rivais (clássicos). O escudo é o gerador do dia 1 (`app/src/lib/generators/shield.ts`). Os valores de porte e capacidade são do `game-designer`. A lista aprovada está no lote de 2026-11-04; `rivals` pode ser vazio (Bragantão, Miragol, Chapecão, Remador).

### Critérios de aceite

```gherkin
Cenário: arquivo válido com 20 clubes
  Dado o arquivo de clubes da Série A
  Quando a validação roda no CI
  Então existem exatamente 20 clubes com id único
  E cada clube tem todos os campos obrigatórios preenchidos
  E cada clube gera um escudo SVG sem erro

Cenário: nome real é bloqueado
  Dado uma lista de nomes de clubes, estádios e apelidos reais mantida pelo content-writer
  Quando um clube do arquivo tem nome, nome curto ou estádio igual (sem diferença de acento ou caixa) a um item dessa lista
  Então a validação falha e indica o clube e o campo

Cenário: rivalidade inconsistente
  Dado um clube A que lista B como rival
  Quando B não lista A como rival, ou A lista um id inexistente
  Então a validação falha e indica o par
```

### Fora do escopo desta história

- Clubes das Séries B a D e de outros países (Etapas 2 e 5).
- Tela de admin para cadastro (a ferramenta da Etapa 1 é arquivo + validação).
- Editor de clubes para o jogador (Etapa 4).

---

## US-002: Uniformes gerados por código

**Como** jogador, **quero** ver cada clube com um uniforme próprio nas cores dele, **para** reconhecer o time na partida e nos cards.

**Prioridade:** Must
**Depende de:** US-001
**Notas:** [PROJETO.md › Clubes, nomes e identidade](PROJETO.md#clubes-nomes-e-identidade) (listras, faixas, gola). Gerado em SVG em `app/src/lib/generators/`; nunca imagem no repositório. O `art-director` define os padrões.

### Critérios de aceite

```gherkin
Cenário: uniforme estável
  Dado um clube com id e cores definidos
  Quando o uniforme é gerado duas vezes
  Então os dois SVG são idênticos

Cenário: uniforme reserva quando as cores conflitam
  Dado uma partida entre dois clubes cujos uniformes principais têm cor dominante parecida, segundo a regra de distância de cor do art-director
  Quando a partida é preparada
  Então o visitante usa o uniforme reserva
  E as duas cores dominantes em campo passam na regra de distância

Cenário: SVG seguro
  Dado qualquer clube do arquivo
  Quando o uniforme é gerado
  Então o SVG não contém script, link externo nem atributo de evento
```

### Fora do escopo desta história

- Editor de uniforme (recompensa de apoio, Etapa 6; editor local, Etapa 4).
- Marca fictícia na camisa, só como cenário (ver US-041; patrocínio real desligado pelo ADR-0015).

---

## US-003: Gerador de nomes fictícios de jogadores

**Como** jogador, **quero** que todos os atletas tenham nomes brasileiros plausíveis e inventados, **para** sentir o clima do futebol brasileiro sem uso de nome real.

**Prioridade:** Must
**Depende de:** —
**Notas:** [PROJETO.md › Clubes, nomes e identidade](PROJETO.md#clubes-nomes-e-identidade) (nomes reais de atletas têm direito de imagem). Listas de prenomes, sobrenomes e apelidos de boleiro ficam em arquivos de conteúdo, revisados pelo CEO. Na Etapa 1 a nacionalidade é só brasileira; outras entram na Etapa 5.

### Critérios de aceite

```gherkin
Cenário: determinismo
  Dado a mesma semente
  Quando o gerador cria 500 nomes duas vezes
  Então as duas listas são idênticas

Cenário: nome de atleta real bloqueado
  Dado uma lista de nomes de atletas reais conhecidos mantida pelo content-writer
  Quando o gerador cria 10.000 nomes com sementes variadas
  Então nenhum nome gerado (nome de exibição ou nome completo) coincide com um item da lista

Cenário: sem duplicata no mesmo clube
  Dado um elenco gerado
  Quando os nomes de exibição são comparados
  Então não há dois jogadores com o mesmo nome de exibição no mesmo clube
```

### Fora do escopo desta história

- Nomes de outras nacionalidades (Etapa 5).
- Nomes de perfis da rede social e de veículos (US-029).

---

## US-004: Modelo de jogador e geração dos elencos

**Como** jogador, **quero** que cada clube comece com um elenco completo e coerente com a força do clube, **para** que escolher o clube seja a dificuldade do jogo.

**Prioridade:** Must
**Depende de:** US-001, US-003
**Notas:** [PROJETO.md › Jogadores, contratos e mercado](PROJETO.md#jogadores-contratos-e-mercado). Campos da Etapa 1: posição, 6 atributos por posição (1 a 99), nota geral, potencial (oculto na interface como número; ver o rótulo "promessa" em US-016), idade, forma, moral, fadiga, um traço de personalidade (líder, temperamental, profissional, ídolo da torcida), número da camisa. Tamanho do elenco, distribuição por posição e faixa de notas pela força do clube (`strength`) são definidos em `docs/design/` (constante ou parâmetro): [jogadores › Geração de elencos](design/jogadores.md#geração-de-elencos). Decisão do CEO (2026-11-04): a força não depende do porte; vem da colocação na tabela de referência (US-069, [clubes-serie-a.md](design/clubes-serie-a.md)). Contrato e salário não entram na Etapa 1 (mercado e finanças são Etapa 3).

### Critérios de aceite

```gherkin
Cenário: elenco completo e determinístico
  Dado a semente de um novo jogo
  Quando os 20 elencos são gerados duas vezes com a mesma semente
  Então os elencos são idênticos
  E cada clube tem o número de jogadores e o mínimo por posição definidos em docs/design/jogadores.md, incluindo goleiros

Cenário: atributos dentro dos limites
  Dado qualquer jogador gerado
  Então cada atributo está entre 1 e 99, a nota geral está entre 1 e 99
  E o potencial é maior ou igual à nota geral

Cenário: força do clube define o elenco
  Dado 100 sementes diferentes
  Quando os elencos são gerados
  Então, em todas as sementes, a média da nota dos titulares prováveis do clube de maior strength é maior que a do clube de menor strength
  E, na média das 100 sementes, a ordem dos clubes pela nota dos titulares prováveis segue a ordem de strength, com empate permitido só entre clubes de mesma strength
```

### Fora do escopo desta história

- Contratos, salários, multa rescisória e valor de mercado (Etapa 3).
- Categoria de base e jovens por temporada (Etapa 4).
- Olheiros e faixa de nota (Etapa 5).

---

## US-005: Avatares de jogadores gerados por código

**Como** jogador, **quero** ver um rosto para cada atleta, **para** criar ligação com o elenco.

**Prioridade:** Should
**Depende de:** US-004
**Notas:** [PROJETO.md › Clubes, nomes e identidade](PROJETO.md#clubes-nomes-e-identidade) e [Arte e áudio](PROJETO.md#arte-e-áudio). SVG gerado por código (formato do rosto, tom de pele, cabelo, barba). O `art-director` cuida da diversidade de tons e traços.

### Critérios de aceite

```gherkin
Cenário: avatar estável
  Dado um jogador com id fixo
  Quando o avatar é gerado em duas sessões diferentes
  Então o SVG é idêntico

Cenário: avatar seguro e leve
  Dado 1.000 jogadores
  Quando os avatares são gerados
  Então nenhum SVG contém script, link externo ou atributo de evento
  E cada SVG tem no máximo o tamanho em bytes definido pelo art-director
```

### Fora do escopo desta história

- Envelhecimento visual do avatar entre temporadas.
- Avatares dos perfis da rede social (reaproveitam o gerador em US-029).

---

## US-006: Calendário da Série A (38 rodadas)

**Como** jogador, **quero** um campeonato de pontos corridos em turno e returno, **para** jogar a Série A como ela é.

**Prioridade:** Must
**Depende de:** US-001
**Notas:** [PROJETO.md › Competições e calendário](PROJETO.md#competições-e-calendário). Na Etapa 1 só existe a Série A, no ritmo "No meu ritmo"; datas são rótulos do calendário aproximado embutido (abril a dezembro), sem tempo real.

### Critérios de aceite

```gherkin
Cenário: tabela de jogos válida
  Dado os 20 clubes e uma semente
  Quando o calendário é gerado
  Então há 38 rodadas com 10 jogos cada
  E cada par de clubes se enfrenta exatamente duas vezes, uma com mando de cada lado
  E nenhum clube joga duas vezes na mesma rodada

Cenário: returno espelha o turno
  Dado o calendário gerado
  Então a rodada N+19 tem os mesmos confrontos da rodada N com o mando invertido

Cenário: mando equilibrado
  Dado o calendário gerado
  Então nenhum clube tem mais de 2 jogos seguidos como mandante ou como visitante

Cenário: determinismo
  Dado a mesma semente
  Quando o calendário é gerado duas vezes
  Então os dois são idênticos
```

### Fora do escopo desta história

- Estaduais, copas, semanas com dois jogos e conflito de datas (Etapa 2).
- Calendário real e ritmo "Tempo real" (Etapa 4).

---

## US-007: Motor: força por setor a partir de escalação e tática

**Como** jogador, **quero** que minhas escolhas de escalação e tática mudem a força do meu time, **para** que pensar antes da rodada valha a pena.

**Prioridade:** Must
**Depende de:** US-004
**Notas:** [PROJETO.md › Táticas](PROJETO.md#táticas) e [Cálculo da partida](PROJETO.md#cálculo-da-partida). Força de defesa, meio e ataque a partir dos titulares, ajustada por formação, postura, pressão, moral, fadiga, jogador fora de posição e mando de campo. O mando soma o fator fixo `match.homeBase` (ADR-0011, opção A, aprovada pelo CEO) à parte da torcida (US-026, ADR-0005). Os pesos são do `game-designer` (documento de sistema da partida em `docs/design/`). Função pura em `app/src/engine/`, parâmetros por argumento.

### Critérios de aceite

```gherkin
Cenário: formação muda os setores
  Dado o mesmo onze titular
  Quando a força é calculada em 5-3-2 e em 3-4-3
  Então a defesa em 5-3-2 é maior e o ataque em 3-4-3 é maior

Cenário: jogador fora de posição perde rendimento
  Dado um zagueiro escalado como atacante
  Quando a força é calculada
  Então a contribuição dele ao ataque é menor do que a de um atacante com os mesmos atributos, na proporção do parâmetro de fora de posição

Cenário: mando, moral e fadiga
  Dado o mesmo onze e a mesma tática
  Quando a força é calculada em casa e fora, com moral alta e baixa, e com fadiga baixa e alta
  Então a força é maior em casa, com moral alta e com fadiga baixa

Cenário: escalação incompleta não quebra o motor
  Dado uma escalação com menos de 11 jogadores aptos
  Quando a força é calculada
  Então o motor retorna um resultado tipado de escalação inválida, sem lançar exceção
```

### Fora do escopo desta história

- Altitude e clima (Etapa 5).
- Efeito de treino e comissão técnica (Etapa 3).

---

## US-008: Motor: partida simulada minuto a minuto, determinística

**Como** jogador, **quero** que a partida seja simulada minuto a minuto de forma justa, **para** confiar no resultado e poder revê-lo.

**Prioridade:** Must
**Depende de:** US-007
**Notas:** [PROJETO.md › Cálculo da partida](PROJETO.md#cálculo-da-partida). Cada minuto: chance de oportunidade pela comparação meio/ataque contra defesa; cada oportunidade vira gol, defesa, trave ou fora pelo finalizador contra o goleiro. Metas de gols, empates, zebras e mando em [`docs/design/balance-targets.md`](design/balance-targets.md) (mandante vence 45% a 50%, pelo ADR-0011). Toda aleatoriedade pelo `Rng` com semente; `Math.random()` e `Date.now()` proibidos.

### Critérios de aceite

```gherkin
Cenário: determinismo (golden test)
  Dado duas escalações, duas táticas, os parâmetros e uma semente fixos
  Quando a partida é simulada duas vezes
  Então a lista de eventos (minuto, tipo, clube, jogador) e o placar são idênticos
  E batem com o arquivo golden versionado no repositório

Cenário: estrutura da partida
  Dado uma partida simulada
  Então ela tem dois tempos, com acréscimos dentro do limite do parâmetro
  E cada oportunidade tem exatamente um desfecho entre gol, defesa, trave e fora
  E cada gol tem um finalizador que estava em campo naquele minuto

Cenário: metas de balanceamento
  Dado 200 temporadas simuladas pela ferramenta de US-013
  Então gols por partida, empates, vitória do mandante, vitória do time 20 pontos mais forte e zebras ficam dentro das faixas de balance-targets.md
```

### Fora do escopo desta história

- Replay de partidas na interface (Etapa 4; a semente já permite).
- Altitude, clima e prorrogação/pênaltis de mata-mata (Etapas 2 e 5).

---

## US-009: Motor: cartões, suspensões, lesões simples e pênaltis

**Como** jogador, **quero** que cartões, lesões e pênaltis aconteçam na partida e tenham consequência, **para** ter que fazer rotação e tomar decisões.

**Prioridade:** Must
**Depende de:** US-008
**Notas:** [PROJETO.md › Jogadores, contratos e mercado](PROJETO.md#jogadores-contratos-e-mercado) (lesões influenciadas por fadiga, suspensão automática), [Cálculo da partida](PROJETO.md#cálculo-da-partida) (eventos), item "Lesões, suspensões e fadiga: 1 (simples)" do [backlog](PROJETO.md#backlog-de-recursos-por-etapa). Regra de suspensão: 3 amarelos ou 1 vermelho, como em [brasilidades › STJD](design/brasilidades.md#stjd-etapa-2-com-o-calendário-completo), com os números definidos em `docs/design/` (constante ou parâmetro): [partida › Cartões e suspensão](design/partida.md#cartões-e-suspensão). Pressão alta aumenta cartões ([Táticas](PROJETO.md#táticas)). Julgamento, efeito suspensivo e escalação irregular são Etapa 2.

### Critérios de aceite

```gherkin
Cenário: vermelho tira o jogador e suspende
  Dado um jogador que recebe cartão vermelho no minuto 30
  Quando a partida continua
  Então ele não participa de nenhum evento depois do minuto 30
  E fica suspenso na rodada seguinte do clube

Cenário: acúmulo de amarelos
  Dado um jogador com amarelos acumulados um abaixo do limite definido em docs/design/partida.md
  Quando recebe mais um amarelo numa partida
  Então fica suspenso na rodada seguinte e o contador volta a zero depois de cumprir

Cenário: lesão ligada à fadiga
  Dado 10.000 partidas simuladas
  Então a taxa de lesão de jogadores com fadiga alta é maior que a de jogadores com fadiga baixa
  E cada lesão tem uma duração em rodadas dentro da faixa do parâmetro

Cenário: pênalti usa o cobrador escolhido
  Dado um pênalti marcado a favor de um time cujo cobrador de pênalti está em campo
  Quando o pênalti é cobrado
  Então o finalizador do evento é o cobrador escolhido; se ele não estiver em campo, é o próximo da lista
```

### Fora do escopo desta história

- STJD: julgamento, efeito suspensivo, escalação irregular, perda de mando (Etapa 2).
- Departamento médico e preparador físico (Etapa 3).

---

## US-010: Forma, moral e fadiga entre rodadas

**Como** jogador, **quero** que forma, moral e cansaço dos atletas mudem com os jogos, **para** que o elenco inteiro importe ao longo da temporada.

**Prioridade:** Must
**Depende de:** US-008
**Notas:** [PROJETO.md › Jogadores, contratos e mercado](PROJETO.md#jogadores-contratos-e-mercado) (forma e moral sobem e descem com jogos, resultados e tempo no banco; fadiga cresce com os jogos e cai com descanso). Clássicos têm moral mais alta ([Táticas](PROJETO.md#táticas)). Taxas são parâmetros do `game-designer`. O efeito do termômetro da torcida na moral está em US-026.

### Critérios de aceite

```gherkin
Cenário: fadiga sobe ao jogar e cai ao descansar
  Dado um jogador que jogou 90 minutos
  Quando a rodada é processada
  Então a fadiga dele sobe; e se ele não joga na rodada seguinte, a fadiga cai

Cenário: banco prolongado derruba a moral
  Dado um jogador sem entrar em campo pelo número de rodadas do parâmetro
  Quando a rodada é processada
  Então a moral dele cai

Cenário: resultado mexe na moral
  Dado o mesmo elenco
  Quando o clube vence uma rodada e, em outra simulação com a mesma semente, perde
  Então a moral média do elenco é maior no caso da vitória

Cenário: limites
  Dado qualquer sequência de 38 rodadas
  Então forma, moral e fadiga ficam sempre entre 0 e 100
```

### Fora do escopo desta história

- Treino semanal com foco (Etapa 3).
- Pedido de saída por moral baixa (Etapa 3, junto com o mercado).

---

## US-011: IA dos clubes: escalação, rotação e substituições

**Como** jogador, **quero** que os clubes controlados pela IA escalem e mexam no time com lógica, **para** enfrentar adversários críveis.

**Prioridade:** Must
**Depende de:** US-007, US-009, US-010
**Notas:** [PROJETO.md › IA dos outros clubes](PROJETO.md#ia-dos-outros-clubes) (escala pelos melhores atributos, rotação quando a fadiga sobe) e [Cálculo da partida](PROJETO.md#cálculo-da-partida) (substituições da IA). Os perfis existem nos dados (US-001), mas na Etapa 1 só afetam escalação e tática; mercado e técnico são Etapas 3 e 4. A mesma rotina escala o clube humano que não confirma no online (US-056) e sugere escalação ao jogador.

### Critérios de aceite

```gherkin
Cenário: escalação válida
  Dado qualquer clube da IA antes de uma rodada
  Quando a IA escala o time
  Então há 11 titulares, exatamente 1 goleiro, nenhum suspenso ou lesionado, e a formação é uma das 6 válidas

Cenário: rotação por fadiga
  Dado um titular com fadiga acima do limiar do parâmetro e um reserva da mesma posição apto
  Quando a IA escala o time
  Então o reserva começa no lugar dele

Cenário: substituição na partida
  Dado um jogador da IA que se lesiona durante a partida e substituições ainda disponíveis
  Quando o evento acontece
  Então a IA o substitui, no mesmo minuto, pelo reserva que mais rende na vaga (maior valor de seleção, quase sempre o da mesma posição)
  E a IA nunca faz mais de 5 substituições

Cenário: elenco sem reservas aptos
  Dado um clube com menos de 11 jogadores aptos
  Quando a IA escala o time
  Então escala todos os aptos e o motor joga com menos jogadores, sem exceção
```

### Fora do escopo desta história

- IA de mercado, demissão de técnico e propostas (Etapas 3 e 4).

---

## US-012: Rodada completa e tabela de classificação com desempate

**Como** jogador, **quero** que cada rodada simule os 10 jogos e atualize a tabela, **para** acompanhar o campeonato inteiro.

**Prioridade:** Must
**Depende de:** US-006, US-008, US-011
**Notas:** [PROJETO.md › Competições e calendário](PROJETO.md#competições-e-calendário). Vitória 3 pontos, empate 1, derrota 0. Desempate pelos critérios da CBF para a Série A, com sorteio pela semente no fim (decisão P1). Desempenho: rodada em menos de 2 s num celular simples (requisitos não funcionais).

### Critérios de aceite

```gherkin
Cenário: rodada atualiza a tabela
  Dado uma rodada com 10 jogos
  Quando a rodada é processada
  Então cada clube tem exatamente um jogo a mais
  E pontos, vitórias, empates, derrotas, gols pró, gols contra e saldo batem com os placares

Cenário: desempate pelos critérios da CBF (P1)
  Dado dois clubes com os mesmos pontos
  Quando a tabela é ordenada
  Então fica à frente o de mais vitórias; persistindo, o de maior saldo; depois mais gols pró; depois confronto direto (só entre dois clubes); depois menos vermelhos; depois menos amarelos

Cenário: empate em todos os critérios (P1)
  Dado dois clubes iguais em todos os critérios da CBF
  Quando a tabela é ordenada
  Então a ordem é decidida por sorteio com a semente do jogo, sempre igual para o mesmo save

Cenário: rodada não pode ser processada duas vezes
  Dado uma rodada já processada
  Quando o processamento é chamado de novo
  Então o motor retorna "rodada já processada" e a tabela não muda
```

### Fora do escopo desta história

- Acesso e rebaixamento efetivos (Etapa 2; ver US-025).
- Vagas em copas continentais (Etapa 5).

---

## US-013: Ferramenta de balanceamento (`npm run balance`)

**Como** game-designer, **quero** simular centenas de temporadas e comparar com as metas, **para** ajustar os parâmetros antes de o jogador sentir.

**Prioridade:** Must
**Depende de:** US-012
**Notas:** item "Balanceamento automático" do [backlog](PROJETO.md#backlog-de-recursos-por-etapa); metas em [`docs/design/balance-targets.md`](design/balance-targets.md); comando `/balance` em [PROJETO.md › Processo](PROJETO.md#processo-de-desenvolvimento-com-agentes). Usa só o motor, sem interface. A vitória do mandante é medida contra a meta do ADR-0011 (opção A: 45% a 50%).

### Critérios de aceite

```gherkin
Cenário: relatório contra as metas
  Dado os parâmetros atuais
  Quando "npm run balance -- --seasons 200" roda
  Então a saída lista cada métrica da Etapa 1 de balance-targets.md com valor medido, faixa alvo e status "dentro" ou "fora"

Cenário: reprodutível
  Dado a mesma semente base e os mesmos parâmetros
  Quando a ferramenta roda duas vezes
  Então as duas saídas são idênticas

Cenário: parâmetros alternativos
  Dado um arquivo de parâmetros passado por argumento
  Quando a ferramenta roda
  Então usa esse arquivo sem alterar app/src/params/
```

### Fora do escopo desta história

- Métricas de finanças e inflação (Etapa 3 em diante).
- Ajuste automático de parâmetros (o game-designer propõe; o ajuste é PR).

---

## US-014: Novo jogo: configuração da carreira

**Como** jogador, **quero** começar uma carreira escolhendo meu clube e poucas opções já preenchidas, **para** jogar em menos de um minuto.

**Prioridade:** Must
**Depende de:** US-001, US-004, US-006
**Notas:** [PROJETO.md › Novo jogo: configurações iniciais](PROJETO.md#novo-jogo-configurações-iniciais). Opções que funcionam na Etapa 1: apelido do técnico (texto livre, só no aparelho), clube (qualquer um dos 20), realismo (lesões, cartões e fadiga ligados ou simplificados, regra do `game-designer`), tipo de partida (animada completa, só lances principais, só resultado). Ritmo fica fixo em "No meu ritmo" e competições em "Só Brasil" (Série A). As opções de etapas futuras ficam escondidas (decisão P3). Decisão do CEO: o realismo fica fixo depois de criar a carreira; o tipo de partida pode ser trocado depois, nas Preferências (US-044) e ao jogar a rodada (US-019). As escolhas viram "última configuração".

### Critérios de aceite

```gherkin
Cenário: começar com os padrões
  Dado a tela de novo jogo aberta pela primeira vez
  Quando o jogador escolhe um clube e toca "Começar"
  Então uma carreira nova é criada com semente própria, na rodada 1, com o clube escolhido
  E o apelido padrão vem do arquivo de conteúdo do idioma

Cenário: última configuração lembrada
  Dado que o jogador criou uma carreira com "só resultado" e realismo simplificado
  Quando abre a tela de novo jogo de novo
  Então essas opções já vêm marcadas

Cenário: apelido inválido
  Dado o campo de apelido do técnico
  Quando o jogador deixa vazio, só com espaços, ou acima do limite de caracteres
  Então "Começar" fica desabilitado com a mensagem do arquivo de conteúdo, e o apelido não sai do aparelho

Cenário: opções de etapas futuras escondidas (P3)
  Dado a tela de novo jogo na Etapa 1
  Então ritmo "Tempo real", começar desempregado, técnico livre, Brasil + América do Sul, estilo e backup na nuvem não aparecem, nem desabilitados nem com "em breve"
```

### Fora do escopo desta história

- Ritmo "Tempo real", começar desempregado, técnico livre e demissão (Etapa 4).
- América do Sul (Etapa 5); backup na nuvem (Etapa 4).
- Trocar o realismo de uma carreira já criada (fixo por decisão do CEO).
- Configurações da liga online (US-051).

---

## US-015: Navegação principal (celular e desktop) e tela do clube

**Como** jogador, **quero** navegar com uma mão e ter "Jogar rodada" sempre ao alcance do polegar, **para** jogar em pé no ônibus; e no computador, **quero** a mesma navegação numa barra lateral.

**Prioridade:** Must
**Depende de:** US-014
**Notas:** [PROJETO.md › Padrões de design](PROJETO.md#padrões-de-design) (abas Clube, Elenco, Tabela, Mercado, Calendário) e item "Layout de desktop" do [backlog](PROJETO.md#backlog-de-recursos-por-etapa). A aba Mercado não aparece na Etapa 1 (mercado é Etapa 3). A tela Clube mostra escudo, próximo jogo, posição na tabela, termômetro (US-026) e as últimas notícias (US-028). Decisões do CEO: o menu "Mais" abre pelo ícone do cabeçalho, no topo, e as mesmas entradas aparecem no pé da tela Clube (revisar na Etapa 3, quando o Mercado virar a 5ª aba); os ícones são próprios, desenhados pelo `art-director`, e até a aprovação um conjunto aberto provisório fica atrás do componente `Icon`. Design system: `docs/design/design-system.md`, guardado pelo `ux-designer`; telas em `docs/design/telas/`.

### Critérios de aceite

```gherkin
Cenário: abas no celular
  Dado uma tela com largura de celular (até o breakpoint do design system)
  Quando o jogo está numa carreira
  Então as abas Clube, Elenco, Tabela e Calendário aparecem na parte de baixo, cada uma com ícone do componente Icon e texto e alvo de toque ≥ 44 px
  E o botão "Jogar rodada" aparece fixo na metade de baixo da tela
  E o ícone de menu no cabeçalho abre o menu "Mais" em qualquer aba

Cenário: barra lateral no desktop
  Dado uma tela acima do breakpoint de desktop
  Então as mesmas abas aparecem numa barra lateral, e nenhuma tela tem rolagem horizontal da página

Cenário: aba ativa não só por cor
  Dado qualquer aba selecionada
  Então ela é indicada por um marcador visual além da cor e por aria-current

Cenário: tela do clube
  Dado uma carreira na rodada 5
  Quando o jogador abre a aba Clube
  Então vê o próximo adversário com mando, a posição atual na tabela e o termômetro com valor em número
  E o pé da tela mostra as mesmas entradas do menu "Mais"
```

### Fora do escopo desta história

- Aba Mercado (Etapa 3).
- Tamanho de fonte ajustável e leitor de tela completo (Etapa 2).
- Desenho final dos ícones próprios (`/assets arte ícones`, com aprovação do CEO).

---

## US-016: Tela do elenco e card do jogador

**Como** jogador, **quero** ver meu elenco com posição, nota, forma, moral, cansaço e situação de cada atleta, **para** decidir quem joga.

**Prioridade:** Must
**Depende de:** US-004, US-009, US-010, US-015
**Notas:** componente "card de jogador" de [PROJETO.md › Padrões de design](PROJETO.md#padrões-de-design). O número do potencial nunca aparece (só olheiros ou tempo; olheiros na Etapa 5). Decisão do CEO: jovens que se enquadram na regra do `game-designer` ([jogadores › Potencial](design/jogadores.md#potencial); limiares definidos em `docs/design/` (constante ou parâmetro), no mesmo documento) levam o rótulo "promessa", só o rótulo, nunca o número. Tabelas no celular: coluna fixa e estatísticas rolando para o lado.

### Critérios de aceite

```gherkin
Cenário: lista do elenco
  Dado um clube com o elenco gerado
  Quando o jogador abre a aba Elenco
  Então cada atleta mostra nome, posição, idade, nota geral, forma, moral e fadiga em número ou ícone com rótulo
  E a lista pode ser ordenada por posição, nota e fadiga

Cenário: situação nunca só por cor
  Dado um atleta suspenso e outro lesionado
  Então cada um mostra ícone e texto ("Suspenso", "Lesionado, N rodadas") vindos do arquivo de conteúdo

Cenário: detalhe do jogador
  Dado um atleta da lista
  Quando o jogador toca nele
  Então abre o card com os 6 atributos da posição, o traço de personalidade e gols e jogos na temporada

Cenário: rótulo "promessa" sem o número
  Dado um atleta que se enquadra na regra de promessa de docs/design/jogadores.md e outro que não se enquadra
  Quando o elenco e o card são mostrados
  Então só o primeiro mostra o rótulo "promessa" com ícone e texto do arquivo de conteúdo
  E a interface recebe do motor só o booleano de promessa, e nenhum número, faixa ou barra do potencial aparece em nenhuma tela
```

### Fora do escopo desta história

- Contrato, salário e valor (Etapa 3).
- Histórico de carreira do jogador (Etapa 4).
- Potencial em número ou faixa (olheiros, Etapa 5).

---

## US-017: Escalação com arrastar e soltar

**Como** jogador, **quero** montar o time arrastando atletas para as posições do campo, **para** escalar rápido com uma mão.

**Prioridade:** Must
**Depende de:** US-007, US-016
**Notas:** [PROJETO.md › Táticas](PROJETO.md#táticas) (arrastar e soltar; fora de posição perde rendimento). Alternativa de toque (tocar no atleta e depois na posição) para quem não arrasta e para acessibilidade. "Sugerir escalação" usa a rotina da IA (US-011).

### Critérios de aceite

```gherkin
Cenário: trocar titular por reserva
  Dado a tela de escalação
  Quando o jogador arrasta um reserva sobre um titular
  Então os dois trocam de lugar e a força por setor mostrada é recalculada

Cenário: alternativa sem arrastar
  Dado a tela de escalação
  Quando o jogador toca num reserva e depois numa posição do campo
  Então o efeito é o mesmo de arrastar

Cenário: aviso de fora de posição
  Dado um zagueiro colocado na posição de atacante
  Então a posição mostra um ícone e o texto de "fora de posição"

Cenário: suspenso ou lesionado não entra
  Dado um atleta suspenso ou lesionado
  Quando o jogador tenta colocá-lo como titular
  Então a ação é recusada com a mensagem do motivo e a escalação não muda

Cenário: escalação incompleta bloqueia a rodada
  Dado menos de 11 titulares aptos escolhidos com reservas aptos disponíveis
  Quando o jogador toca "Jogar rodada"
  Então o jogo avisa e oferece "Completar automaticamente"
```

### Fora do escopo desta história

- Escalação diferente por competição (Etapa 2).

---

## US-018: Ajustes táticos, capitão e cobradores

**Como** jogador, **quero** escolher formação, postura e pressão, e definir capitão e cobradores, **para** imprimir meu estilo no time.

**Prioridade:** Must
**Depende de:** US-007, US-017
**Notas:** [PROJETO.md › Táticas](PROJETO.md#táticas): 6 formações (4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 3-4-3, 5-3-2), postura (defensiva, equilibrada, ofensiva), pressão (baixa, média, alta). Cada opção tem uma frase curta de efeito, do arquivo de conteúdo.

### Critérios de aceite

```gherkin
Cenário: trocar a formação reposiciona os titulares
  Dado o time em 4-4-2
  Quando o jogador escolhe 4-3-3
  Então o campo mostra 4-3-3 com os mesmos 11 titulares redistribuídos pela posição de cada um

Cenário: tática é salva para a rodada
  Dado postura ofensiva e pressão alta escolhidas
  Quando a rodada é jogada
  Então o motor recebe postura ofensiva e pressão alta

Cenário: capitão e cobradores
  Dado o capitão e os cobradores de pênalti e falta definidos
  Quando um deles sai de campo durante a partida
  Então a função passa ao próximo da lista definida pelo jogador ou, sem lista, ao melhor atributo de finalização em campo
```

### Fora do escopo desta história

- Instruções individuais por jogador (fora do princípio "completo, mas simples").

---

## US-019: Jogar rodada no modo "só resultado"

**Como** jogador com pressa, **quero** tocar "Jogar rodada" e ver logo o placar e a tabela, **para** avançar a temporada rápido.

**Prioridade:** Must
**Depende de:** US-012, US-017
**Notas:** [PROJETO.md › Animações e engajamento saudável](PROJETO.md#animações-e-engajamento-saudável) (opção "só resultado") e [Fluxos de jogo](PROJETO.md#fluxos-de-jogo). É o fluxo base da rodada; a partida animada (US-020) se apoia nele. Decisão do CEO: o tipo de partida pode ser trocado durante a carreira, também no momento de jogar a rodada; a troca vale para as rodadas seguintes e é a mesma opção mostrada nas Preferências (US-044). Ao fim, salvamento automático (US-032).

### Critérios de aceite

```gherkin
Cenário: rodada em um toque
  Dado uma carreira com escalação válida e o tipo de partida "só resultado"
  Quando o jogador toca "Jogar rodada"
  Então vê o placar do seu jogo, os autores dos gols e os outros 9 resultados
  E a rodada atual avança em 1 e a tabela é atualizada

Cenário: trocar o tipo de partida ao jogar
  Dado uma carreira com o tipo de partida "animada completa"
  Quando o jogador escolhe "só resultado" no seletor de tipo de "Jogar rodada" e joga
  Então a rodada vai direto ao resumo
  E as rodadas seguintes continuam em "só resultado", que é o tipo mostrado nas Preferências

Cenário: resultado com texto
  Dado o resumo da rodada
  Então vitória, empate ou derrota do clube do jogador aparece em texto ou ícone, nunca só por cor

Cenário: fechar o app no meio
  Dado que o app é fechado depois de tocar "Jogar rodada" e antes de mostrar o resumo
  Quando o jogador reabre
  Então a carreira está ou na rodada anterior, sem nada aplicado, ou na rodada seguinte com tudo aplicado; nunca num estado intermediário
```

### Fora do escopo desta história

- Avanço automático de várias rodadas seguidas (reprodução automática sem fim é evitada de propósito).

---

## US-020: Partida animada no campo 2D

**Como** jogador, **quero** assistir aos lances importantes num campo visto de cima com narração em texto, **para** sentir a tensão do jogo.

**Prioridade:** Must
**Depende de:** US-002, US-019
**Notas:** [PROJETO.md › Animações e engajamento saudável](PROJETO.md#animações-e-engajamento-saudável): campo 2D em canvas, jogadores como bolinhas nas cores do uniforme, narração em texto rolando, pausa dramática antes de revelar se foi gol, comemoração com escudo e nome do artilheiro, vibração no Android. "Animada completa" mostra todos os lances que o motor marca como visíveis; "só lances principais" mostra só gols, chances claras, cartões vermelhos e pênaltis. A animação é desenhada a partir dos eventos do motor; nunca muda o resultado. O tipo de partida pode ser trocado entre rodadas (US-019, US-044). Sem áudio na Etapa 1, só vibração no Android (decisão P5).

### Critérios de aceite

```gherkin
Cenário: animação reflete os eventos
  Dado uma partida simulada com uma lista de eventos
  Quando ela é mostrada em "animada completa"
  Então cada gol, cartão e substituição da lista aparece na narração no minuto certo
  E o placar final mostrado é igual ao do motor

Cenário: tipo de partida não muda o resultado
  Dado o mesmo save e a mesma semente, sem comandos durante a partida
  Quando a rodada é jogada em "animada completa", "só lances principais" e "só resultado"
  Então os eventos do motor e os placares são idênticos nos três tipos

Cenário: pular para o fim
  Dado uma partida em andamento na tela
  Quando o jogador toca "Pular"
  Então vai direto para o resumo, com o mesmo resultado

Cenário: reduzir movimento
  Dado o sistema com prefers-reduced-motion ativo
  Quando um gol acontece
  Então não há câmera lenta, tremor nem animação de comemoração; a narração e o placar mudam sem movimento

Cenário: vibração opcional
  Dado um Android com a vibração ligada nas preferências (US-044)
  Quando o clube do jogador marca
  Então o aparelho vibra uma vez; com a vibração desligada, não vibra
```

### Fora do escopo desta história

- Áudio de qualquer tipo: efeitos (apito, rede, torcida) e narração em voz (decisão P5; só com lote aprovado pelo CEO com a estimativa de créditos).
- Replay (Etapa 4).

---

## US-021: Comandos e substituições durante a partida

**Como** jogador, **quero** mexer no time durante o jogo, **para** virar uma partida ou segurar um resultado.

**Prioridade:** Must
**Depende de:** US-020
**Notas:** [PROJETO.md › Táticas](PROJETO.md#táticas): comandos "pressionar", "segurar o resultado", "todo mundo no ataque", até 5 substituições; mudar formação, postura e pressão. A partida pausa enquanto o jogador decide. O motor recalcula do minuto da mudança em diante, com a mesma semente (determinismo: mesma sequência de decisões, mesmo resultado). Vale também no modo "só lances principais"; no "só resultado" não há pausa.

### Critérios de aceite

```gherkin
Cenário: substituição
  Dado uma partida no minuto 60 com substituições disponíveis
  Quando o jogador troca um titular por um reserva
  Então o reserva participa dos eventos a partir do minuto 60 e o titular não participa mais
  E o contador de substituições diminui em 1

Cenário: limite de 5 substituições
  Dado 5 substituições já feitas
  Quando o jogador tenta outra
  Então a ação é recusada com a mensagem do arquivo de conteúdo

Cenário: comando muda a simulação
  Dado o mesmo estado da partida no minuto 70 e a mesma semente
  Quando a partida segue com "todo mundo no ataque" e, em outra execução, com "segurar o resultado"
  Então o primeiro caso tem mais oportunidades criadas e mais sofridas do que o segundo, na média de 1.000 execuções

Cenário: mesmas decisões, mesmo resultado
  Dado a mesma semente e a mesma sequência de decisões nos mesmos minutos
  Quando a partida é simulada duas vezes
  Então os eventos são idênticos
```

### Fora do escopo desta história

- Comandos durante a partida no online (decisão P6: não na 1b).

---

## US-022: Conversa no intervalo

**Como** jogador, **quero** falar com o elenco no intervalo escolhendo entre motivar, cobrar ou acalmar, **para** influenciar o segundo tempo.

**Prioridade:** Should
**Depende de:** US-021
**Notas:** [PROJETO.md › Táticas](PROJETO.md#táticas) e [Notícias e mensagens › Mensagens e conversas](PROJETO.md#notícias-e-mensagens). Efeito na moral do segundo tempo, dependente do placar e da personalidade; regra do `game-designer`. Falas do arquivo de conteúdo.

### Critérios de aceite

```gherkin
Cenário: três opções no intervalo
  Dado uma partida animada ou com lances principais chegando ao intervalo
  Então a partida pausa e mostra as 3 opções com uma frase de efeito cada

Cenário: efeito na moral
  Dado o mesmo estado no intervalo e a mesma semente
  Quando o jogador escolhe cada uma das 3 opções em execuções separadas
  Então a moral do elenco no segundo tempo difere conforme a regra do game-designer e o resultado é determinístico para cada escolha

Cenário: pular a conversa
  Dado a conversa aberta
  Quando o jogador toca "Pular"
  Então a moral não muda pela conversa
```

### Fora do escopo desta história

- Conversa individual com jogador insatisfeito e reunião com a diretoria (Etapa 4).

---

## US-023: Tela da tabela

**Como** jogador, **quero** ver a classificação legível no celular, **para** saber como estou na briga pelo título ou contra o rebaixamento.

**Prioridade:** Must
**Depende de:** US-012, US-015
**Notas:** [PROJETO.md › Padrões de design](PROJETO.md#padrões-de-design) (coluna do clube fixa, estatísticas rolando, números em largura fixa) e [Animações](PROJETO.md#animações-e-engajamento-saudável) (setas animadas). Zonas na Etapa 1: líder/título e as 4 últimas (rebaixamento, ver US-025).

### Critérios de aceite

```gherkin
Cenário: tabela no celular
  Dado a tabela aberta em largura de celular
  Quando o jogador rola para o lado
  Então a posição e o clube continuam visíveis e as estatísticas (P, J, V, E, D, GP, GC, SG) rolam

Cenário: mudança de posição
  Dado um clube que subiu duas posições na última rodada
  Então a linha mostra seta para cima e "+2" em texto; com prefers-reduced-motion, a seta aparece sem animação

Cenário: zonas não só por cor
  Dado as 4 últimas posições
  Então cada linha tem marcação textual ou ícone de zona além da cor, com legenda na tela

Cenário: meu clube destacado
  Então a linha do clube do jogador tem destaque visual e um rótulo acessível "seu clube"
```

### Fora do escopo desta história

- Tabelas de outras divisões e copas (Etapa 2).
- Artilharia e estatísticas históricas (Etapa 4).

---

## US-024: Tela do calendário e resultados

**Como** jogador, **quero** ver todas as rodadas com meus próximos jogos e os resultados passados, **para** planejar a rotação e rever a campanha.

**Prioridade:** Must
**Depende de:** US-006, US-012, US-015
**Notas:** componente "card de partida" de [PROJETO.md › Padrões de design](PROJETO.md#padrões-de-design).

### Critérios de aceite

```gherkin
Cenário: jogos do meu clube
  Dado uma carreira na rodada 10
  Quando o jogador abre a aba Calendário
  Então vê as 38 rodadas do seu clube, com adversário, mando, rótulo de data e placar nas já jogadas
  E a próxima rodada aparece em destaque e a tela abre posicionada nela

Cenário: rodada inteira
  Dado uma rodada já jogada
  Quando o jogador toca nela
  Então vê os 10 resultados com os autores dos gols

Cenário: clássico identificado
  Dado um jogo contra um rival
  Então o card mostra o rótulo "Clássico" em texto
```

### Fora do escopo desta história

- Datas reais e notificação de dia de rodada (Etapa 4).

---

## US-025: Fim de temporada e passagem para a seguinte

**Como** jogador, **quero** uma cerimônia ao fim das 38 rodadas e a chance de continuar, **para** comemorar o título ou planejar a volta por cima.

**Prioridade:** Must
**Depende de:** US-012, US-023
**Notas:** [PROJETO.md › Animações](PROJETO.md#animações-e-engajamento-saudável) (cerimônia de título) e [Competições](PROJETO.md#competições-e-calendário) (4 caem). Decisão P2: como a Série B só existe na Etapa 2, depois da rodada 38 começa uma nova temporada com os mesmos 20 clubes, com envelhecimento e evolução pela curva de idade ([Jogadores](PROJETO.md#jogadores-contratos-e-mercado)); o clube do jogador continua na Série A mesmo se terminar entre os 4 últimos. A subida de 4 clubes fica para quando houver lista de clubes aprovada pelo CEO.

### Critérios de aceite

```gherkin
Cenário: campeão e cerimônia
  Dado a rodada 38 processada
  Então o jogo mostra o campeão, a classificação final e, se o campeão for o clube do jogador, a cerimônia de título
  E com prefers-reduced-motion a cerimônia é estática

Cenário: zona de rebaixamento sem efeito (P2)
  Dado a classificação final
  Então os 4 últimos aparecem como "zona de rebaixamento" com o aviso de que o acesso e o rebaixamento entram numa próxima versão

Cenário: nova temporada (P2)
  Dado o fim da temporada 1
  Quando o jogador toca "Próxima temporada"
  Então começa a temporada 2 com os mesmos 20 clubes, um calendário novo, tabela zerada, idade de todos +1 e atributos ajustados pela curva de idade
  E suspensões por amarelo zeram, enquanto lesões em curso continuam

Cenário: determinismo da virada
  Dado o mesmo save no fim da temporada
  Quando a virada é feita duas vezes
  Então as duas temporadas novas são idênticas
```

### Fora do escopo desta história

- Acesso e rebaixamento reais, com a troca dos 4 últimos por clubes que sobem (Etapa 2, depois da lista da Série B aprovada pelo CEO); base, aposentadoria e histórico (Etapa 4).
- Metas e avaliação da diretoria (Etapa 4).

---

## US-026: Termômetro da torcida e clássicos

**Como** jogador, **quero** ver o humor da torcida num termômetro de 0 a 100 e sentir o efeito dele no jogo, **para** que resultados e decisões tenham consequência além da tabela.

**Prioridade:** Must
**Depende de:** US-010, US-012
**Notas:** [brasilidades › Torcida dentro do jogo](design/brasilidades.md#torcida-dentro-do-jogo-etapa-1a-o-termômetro-efeitos-completos-na-etapa-3), ADR-0005, ADR-0011, [Rede social do jogo](PROJETO.md#rede-social-do-jogo). Entradas na 1a: resultados, humor da rede social (US-029) e decisões do técnico (entrevista, US-030). Efeitos na 1a: mando (fator fixo `match.homeBase` do ADR-0011, opção A, mais a parte da torcida, de `fans.homeBonusMin` a `fans.homeBonusMax`; clássico soma `fans.derbyBonus`) e deriva da moral (`fans.moraleDrift`). Público, pressão sobre a diretoria, incidentes e jogador vaiado ficam para as etapas indicadas no documento. Valores são parâmetros; o termômetro existe para os 20 clubes (o da IA influencia o mando dela).

### Critérios de aceite

```gherkin
Cenário: termômetro reage aos resultados
  Dado um clube com termômetro 50
  Quando vence 3 rodadas seguidas
  Então o termômetro sobe; e, em outra simulação com a mesma semente, ao perder 3 seguidas, desce
  E fica sempre entre 0 e 100

Cenário: bônus de mando
  Dado o mesmo jogo em casa com termômetro 0 e com termômetro 100
  Quando a força é calculada
  Então o bônus de casa é match.homeBase + fans.homeBonusMin no primeiro e match.homeBase + fans.homeBonusMax no segundo
  E num clássico os dois recebem mais fans.derbyBonus

Cenário: deriva da moral
  Dado um jogador com moral 40 e o termômetro do clube em 80
  Quando uma rodada é processada sem outros efeitos
  Então a moral dele vai a 40 + fans.moraleDrift

Cenário: termômetro na tela
  Dado a tela do clube
  Então o termômetro mostra o número e um rótulo de humor em texto ("em festa", "fria" etc., do arquivo de conteúdo), nunca só cor
```

### Fora do escopo desta história

- Público, bilheteria, sócios e incidentes (Etapas 2 e 3).
- Enquetes "deve demitir?" e pressão sobre a diretoria (Etapa 4).

---

## US-027: Sistema de templates de texto

**Como** content-writer, **quero** um sistema de templates com placeholders, variações e memória de frases, **para** que notícias e posts variem sem IA em tempo de jogo.

**Prioridade:** Must
**Depende de:** —
**Notas:** [PROJETO.md › Notícias e mensagens](PROJETO.md#notícias-e-mensagens): placeholders como `{clube}`, `{rival}`, `{artilheiro}`, `{placar}`; manchete + 1 a 3 parágrafos de blocos independentes; modificadores de contexto (clássico, jejum, momento da tabela); memória das últimas 200 frases. Templates em `app/src/content/<idioma>/`. A escolha usa o `Rng` com semente (mesmo save, mesmas notícias).

### Critérios de aceite

```gherkin
Cenário: placeholders preenchidos
  Dado um template com {clube}, {rival} e {placar}
  Quando é renderizado com um evento de vitória
  Então o texto final não contém "{" nem "}" e traz os valores do evento

Cenário: placeholder desconhecido falha no CI
  Dado um template com um placeholder que não existe no catálogo
  Quando a validação de conteúdo roda
  Então ela falha e indica arquivo, idioma e chave

Cenário: memória evita repetição
  Dado um evento com 20 variações
  Quando o mesmo evento é gerado 20 vezes seguidas
  Então nenhuma frase se repete enquanto estiver entre as últimas 200 usadas

Cenário: contexto escolhe a variação
  Dado uma vitória num clássico
  Quando a notícia é gerada
  Então a variação vem do conjunto marcado para clássico, se houver; senão, do conjunto geral
```

### Fora do escopo desta história

- Resumo semanal escrito por IA no servidor (opcional futuro).
- Os 250 a 300 tipos de evento completos (crescem por etapa; a 1a cobre os eventos que existem nela).

---

## US-028: Notícias da rodada (jornal)

**Como** jogador, **quero** ler manchetes sobre meu time depois de cada rodada, **para** sentir que o clube vive uma história.

**Prioridade:** Must
**Depende de:** US-012, US-027
**Notas:** [PROJETO.md › Notícias e mensagens](PROJETO.md#notícias-e-mensagens) (veículos com tom próprio). Eventos da 1a, no mínimo: vitória, derrota, empate, goleada, virada, zebra, clássico, lesão, suspensão, série de vitórias, série de derrotas, liderança, entrada na zona de rebaixamento, artilheiro da rodada, título. Cada lote de textos passa pelo CEO antes de entrar no jogo. Veículos com nomes inventados. Textos nos três idiomas, com menos variações em es e en na 1a (decisão P4, ver US-040).

### Critérios de aceite

```gherkin
Cenário: notícias depois da rodada
  Dado uma rodada processada em que o clube do jogador venceu de virada
  Quando o jogador abre as notícias
  Então há ao menos uma manchete sobre a virada do seu clube e manchetes da rodada geral, em ordem da mais recente

Cenário: notícia ligada ao fato
  Dado uma notícia de lesão
  Então o jogador citado está de fato lesionado no save, com a duração citada

Cenário: sem nome real
  Dado o catálogo de veículos e todos os templates aprovados
  Quando a validação de conteúdo roda com a lista de nomes reais (veículos, emissoras, jornalistas)
  Então nenhum nome real aparece

Cenário: histórico limitado
  Dado uma temporada inteira jogada
  Então o jogo guarda as notícias até o limite do parâmetro de histórico, descartando as mais antigas
```

### Fora do escopo desta história

- Boatos de mercado (Etapa 3); notícias de copas e finanças (Etapas 2 e 3).
- Ilustrações de notícia do ComfyUI.

---

## US-029: Rede social simples (torcedores e canal de TV)

**Como** jogador, **quero** um feed com reações fictícias de torcedores e de um canal de TV, **para** sentir o humor da torcida rodada a rodada.

**Prioridade:** Must
**Depende de:** US-005, US-027, US-028
**Notas:** [PROJETO.md › Rede social do jogo](PROJETO.md#rede-social-do-jogo): versão simples na Etapa 1 com torcedores comuns e canal de TV. Perfis gerados por código (nome, avatar, tipo, humor), posts com curtidas e comentários fictícios. Tudo gerado pelo jogo: nenhum usuário real posta ou lê. Tom de brincadeira, nunca ofensa ou preconceito. Desligável nas preferências (US-044). O humor dos posts alimenta o termômetro (US-026).

### Critérios de aceite

```gherkin
Cenário: feed depois da rodada
  Dado uma rodada processada
  Quando o jogador abre o feed
  Então há posts novos de torcedores do seu clube e do canal de TV sobre o resultado, cada um com nome, avatar, curtidas e comentários

Cenário: humor coerente
  Dado uma derrota em clássico
  Então a maioria dos posts de torcedores do clube usa variações marcadas como negativas

Cenário: perfis estáveis
  Dado o mesmo save
  Quando o feed é aberto em dois momentos
  Então o mesmo perfil tem o mesmo nome e avatar

Cenário: nada sai do aparelho
  Dado o feed aberto com a rede do navegador monitorada
  Então nenhuma requisição de rede é feita para montar ou mostrar o feed
```

### Fora do escopo desta história

- Torcedor fanático, rival, influenciador, jornalista de mercado, jogadores, diretoria, enquetes e reação do técnico a posts (Etapa 4).

---

## US-030: Entrevista pós-jogo em múltipla escolha

**Como** jogador, **quero** responder à imprensa depois do jogo com 2 ou 3 opções, **para** influenciar o elenco e a torcida com minhas palavras.

**Prioridade:** Should
**Depende de:** US-019, US-026, US-027
**Notas:** [PROJETO.md › Notícias e mensagens › Mensagens e conversas](PROJETO.md#notícias-e-mensagens). Efeito na moral e no termômetro; regra do `game-designer`. Frequência (não toda rodada) é parâmetro. Opcional: o jogador pode dispensar.

### Critérios de aceite

```gherkin
Cenário: entrevista com opções
  Dado uma rodada em que a entrevista é sorteada pelo parâmetro de frequência
  Quando o resumo da rodada termina
  Então aparece uma pergunta com 2 ou 3 respostas, cada uma com uma pista de efeito em texto

Cenário: efeito da resposta
  Dado o mesmo estado e a mesma semente
  Quando o jogador escolhe respostas diferentes em execuções separadas
  Então moral do elenco e termômetro mudam conforme a regra de cada resposta

Cenário: dispensar
  Dado a entrevista aberta
  Quando o jogador toca "Dispensar"
  Então nada muda e a próxima rodada fica disponível
```

### Fora do escopo desta história

- Conversas com jogador insatisfeito, diretoria e propostas de clubes (Etapa 4).

---

## US-031: Ferramenta de repetição de templates

**Como** content-writer, **quero** simular 50 temporadas e ver as frases mais repetidas, **para** saber onde faltam variações.

**Prioridade:** Should
**Depende de:** US-027, US-028, US-029
**Notas:** [PROJETO.md › Notícias e mensagens](PROJETO.md#notícias-e-mensagens) (meta: nenhuma repetição em menos de 40 rodadas). Script em `scripts/`; cobertura registrada em `docs/content/cobertura.md`. Na 1a, es e en têm menos variações por decisão (P4); o relatório mostra a repetição deles, mas a meta de 40 rodadas vale só para pt-BR até a Etapa 5.

### Critérios de aceite

```gherkin
Cenário: relatório de repetição
  Dado os templates atuais de um idioma
  Quando a ferramenta simula 50 temporadas
  Então lista as frases ordenadas por número de usos e os eventos com repetição em menos de 40 rodadas

Cenário: reprodutível
  Dado a mesma semente
  Quando a ferramenta roda duas vezes
  Então os relatórios são idênticos
```

### Fora do escopo desta história

- Geração automática de variações (o `/content` faz em lote, com revisão do CEO).

---

## US-032: Salvamento automático com 3 versões e gravação segura

**Como** jogador, **quero** que o jogo salve sozinho ao fim de cada rodada sem nunca corromper meu progresso, **para** não perder a carreira.

**Prioridade:** Must
**Depende de:** US-019
**Notas:** [PROJETO.md › Saves e backup](PROJETO.md#saves-e-backup), camada 1: ao fim de cada rodada, 3 últimas versões; se uma corromper, volta para a anterior; o save novo só substitui o antigo depois de conferido. Formato em `app/src/lib/save/` (mudança exige ADR).

### Critérios de aceite

```gherkin
Cenário: salva ao fim da rodada
  Dado uma carreira na rodada 5
  Quando a rodada 5 é jogada
  Então existe uma versão salva da rodada 6 e são mantidas no máximo 3 versões dessa carreira

Cenário: gravação interrompida
  Dado uma falha simulada no meio da gravação
  Quando o jogo é reaberto
  Então a carreira abre na última versão íntegra, sem perda além da rodada em curso

Cenário: versão corrompida
  Dado que a versão mais recente falha na conferência de integridade
  Quando o jogador continua a carreira
  Então o jogo abre a versão anterior íntegra e avisa em pt-BR quantas rodadas foram perdidas

Cenário: todas as versões corrompidas
  Dado que as 3 versões falham na conferência
  Então o jogo não abre a carreira, explica o problema e oferece importar um arquivo exportado (US-036)
```

### Fora do escopo desta história

- Sincronização com o servidor (Etapa 4).

---

## US-033: Versão do formato de save e migração

**Como** jogador, **quero** que atualizações do jogo convertam meus saves antigos, **para** nunca perder uma carreira por causa de uma versão nova.

**Prioridade:** Must
**Depende de:** US-032
**Notas:** [PROJETO.md › Saves e backup](PROJETO.md#saves-e-backup) (cada save leva a versão do formato) e regra do `CLAUDE.md` (mudar o formato exige ADR e teste de migração). Saves de exemplo de cada versão ficam como fixtures de teste.

### Critérios de aceite

```gherkin
Cenário: migração de versão antiga
  Dado um save fixture na versão N-1 do formato
  Quando o jogo na versão N abre esse save
  Então ele é convertido para a versão N, abre na mesma rodada, com o mesmo clube e a mesma tabela

Cenário: cadeia de migrações
  Dado um save na versão 1 e o jogo na versão N > 2
  Quando o save é aberto
  Então todas as migrações de 1 até N rodam em ordem e o resultado é igual a migrar passo a passo

Cenário: save de versão mais nova
  Dado um save com versão de formato maior que a suportada
  Quando o jogo tenta abrir
  Então não abre nem altera o save, e pede para atualizar o jogo

Cenário: original preservado
  Dado uma migração que falha
  Então a versão original do save continua intacta e o erro é registrado sem dados pessoais
```

### Fora do escopo desta história

- Conversão entre save offline e liga online (são coisas separadas).

---

## US-034: Vários saves: listar, continuar e apagar

**Como** jogador, **quero** ter mais de uma carreira ao mesmo tempo e apagar as que não quero, **para** testar clubes diferentes.

**Prioridade:** Must
**Depende de:** US-032
**Notas:** item "Vários saves" do [backlog](PROJETO.md#backlog-de-recursos-por-etapa); [Saves e backup](PROJETO.md#saves-e-backup) (antes de apagar, confirmação dupla e oferta de exportar). Limite de carreiras simultâneas, se houver, é decisão do `architect` pelo espaço disponível.

### Critérios de aceite

```gherkin
Cenário: lista de carreiras
  Dado duas carreiras salvas
  Quando o jogador abre a tela inicial
  Então vê as duas com clube, escudo, temporada, rodada e data da última jogada, da mais recente para a mais antiga

Cenário: carreiras independentes
  Dado duas carreiras
  Quando o jogador joga uma rodada na primeira
  Então a segunda não muda

Cenário: apagar com confirmação dupla
  Dado uma carreira
  Quando o jogador toca "Apagar"
  Então o jogo oferece exportar antes; depois pede uma segunda confirmação explícita
  E só depois da segunda confirmação a carreira e suas 3 versões são removidas

Cenário: desistir de apagar
  Dado a primeira ou a segunda confirmação aberta
  Quando o jogador cancela
  Então nada é apagado
```

### Fora do escopo desta história

- Lixeira ou desfazer depois de apagar.

---

## US-035: Exportar save

**Como** jogador, **quero** gerar um arquivo do meu save e mandar para onde eu quiser, **para** ter um backup fora do celular.

**Prioridade:** Must
**Depende de:** US-033, US-034
**Notas:** [PROJETO.md › Saves e backup](PROJETO.md#saves-e-backup), camada 3 (pelo botão de compartilhar do celular; restaurável em qualquer aparelho, inclusive após troca de domínio). O arquivo leva a versão do formato e um verificador de integridade. Não contém nada além do jogo (o apelido do técnico vai junto porque faz parte do save; o jogo avisa isso).

### Critérios de aceite

```gherkin
Cenário: exportar no celular
  Dado um navegador com a API de compartilhamento de arquivos
  Quando o jogador toca "Exportar"
  Então abre a folha de compartilhar do sistema com um arquivo nomeado com o nome do jogo (da configuração central), clube, temporada e rodada

Cenário: sem compartilhamento
  Dado um navegador sem a API de compartilhamento de arquivos (desktop)
  Quando o jogador toca "Exportar"
  Então o arquivo é baixado

Cenário: ida e volta
  Dado um save exportado
  Quando ele é importado (US-036) num perfil de navegador limpo
  Então a carreira aberta é igual à original em clube, rodada, tabela, elencos e notícias

Cenário: offline
  Dado o aparelho sem conexão
  Quando o jogador exporta
  Então a exportação funciona
```

### Fora do escopo desta história

- Envio automático para nuvem (Etapa 4).

---

## US-036: Importar save

**Como** jogador, **quero** abrir um arquivo de save exportado em qualquer aparelho, **para** continuar a carreira depois de trocar de celular ou de domínio.

**Prioridade:** Must
**Depende de:** US-033, US-035
**Notas:** [PROJETO.md › Saves e backup](PROJETO.md#saves-e-backup). Importar cria uma carreira na lista; nunca sobrescreve uma existente sem perguntar. O arquivo é dado não confiável: validado antes de qualquer uso.

### Critérios de aceite

```gherkin
Cenário: importar válido
  Dado um arquivo exportado pela versão atual
  Quando o jogador escolhe "Importar" e o arquivo
  Então a carreira aparece na lista e abre na rodada do arquivo

Cenário: mesma carreira já existe
  Dado que a carreira do arquivo já está no aparelho
  Quando o jogador importa
  Então o jogo mostra as duas versões (clube, temporada, rodada, data) e pergunta se substitui ou guarda como carreira separada

Cenário: arquivo corrompido ou de outro tipo
  Dado um arquivo truncado, alterado à mão ou que não é save
  Quando o jogador importa
  Então o jogo recusa com mensagem em pt-BR, não cria carreira e não altera as existentes

Cenário: versão antiga e versão mais nova
  Dado um arquivo da versão N-1 do formato
  Então é migrado e importado (US-033)
  E dado um arquivo de versão maior que a suportada, a importação é recusada pedindo para atualizar o jogo

Cenário: arquivo grande demais
  Dado um arquivo acima do limite de tamanho definido pelo architect
  Então a importação é recusada antes de ler o conteúdo
```

### Fora do escopo desta história

- Importar saves de outros jogos.

---

## US-037: Armazenamento persistente e lembrete de exportar

**Como** jogador de iPhone, **quero** que o navegador não apague meu jogo e que o jogo me lembre de exportar, **para** não perder a carreira por limpeza automática.

**Prioridade:** Must
**Depende de:** US-032, US-035
**Notas:** [PROJETO.md › Saves e backup](PROJETO.md#saves-e-backup), camada 2 (pedir armazenamento persistente; instalar ajuda) e o lembrete discreto ao fim de cada temporada, desligável.

### Critérios de aceite

```gherkin
Cenário: pedir persistência
  Dado a primeira carreira criada
  Então o jogo pede ao navegador armazenamento persistente e registra no save local se foi concedido

Cenário: persistência negada
  Dado que o navegador negou
  Então a tela de saves mostra um aviso em texto recomendando instalar o app e exportar

Cenário: lembrete no fim da temporada
  Dado o lembrete ligado
  Quando a rodada 38 termina
  Então aparece um lembrete discreto de exportar com o botão "Exportar" e a opção "Não lembrar mais"

Cenário: lembrete desligado
  Dado que o jogador escolheu "Não lembrar mais"
  Quando outra temporada termina
  Então o lembrete não aparece, e pode ser religado nas preferências
```

### Fora do escopo desta história

- Backup na nuvem (Etapa 4).

---

## US-038: PWA instalável e jogável offline

**Como** jogador, **quero** instalar o jogo na tela inicial e jogar sem internet, **para** jogar no metrô.

**Prioridade:** Must
**Depende de:** US-019
**Notas:** [PROJETO.md › Visão geral](PROJETO.md#visão-geral) e [Configuração central da marca](PROJETO.md#configuração-central-da-marca) (manifest, ícones e cores gerados da configuração). Meta de instalação inicial abaixo de 10 MB (item do backlog). Fontes e tudo o mais servidos pelo próprio app. Na 1a o jogo não tem estatísticas de uso nem envio de erros pela rede (decisão P11).

### Critérios de aceite

```gherkin
Cenário: instalável
  Dado o jogo aberto em /jogo num navegador compatível
  Então o manifest é válido, com nome, nome curto, ícones e cor de tema vindos de config/prancheta.config.ts

Cenário: offline depois da primeira visita
  Dado o jogo carregado uma vez com conexão
  Quando a conexão é cortada e o jogo é reaberto
  Então o jogador cria uma carreira, joga uma rodada com partida animada e exporta o save sem erro

Cenário: tamanho da instalação
  Dado o build de produção
  Então o total pré-carregado pelo service worker é menor que 10 MB, e o CI falha se passar

Cenário: sem terceiros (P11)
  Dado uma sessão completa de carreira com a rede monitorada
  Então nenhuma requisição sai para domínio diferente do próprio app
```

### Fora do escopo desta história

- Empacotar para lojas de apps.
- Notificações push (Etapa 6).

---

## US-039: Aviso de nova versão e novidades no jogo

**Como** jogador, **quero** saber quando há uma versão nova e o que mudou, sem perder a rodada em andamento, **para** atualizar com segurança.

**Prioridade:** Must
**Depende de:** US-032, US-038
**Notas:** itens "Aviso de nova versão" e "Canal com a comunidade" (changelog dentro do jogo) do [backlog](PROJETO.md#backlog-de-recursos-por-etapa). As novidades vêm do CHANGELOG, em texto curto por idioma.

### Critérios de aceite

```gherkin
Cenário: aviso fora da partida
  Dado uma versão nova baixada em segundo plano e o jogador numa tela fora da partida
  Então aparece "Nova versão disponível" com o botão "Atualizar"
  E ao tocar, o jogo recarrega na mesma carreira e rodada

Cenário: não interrompe a partida
  Dado uma versão nova baixada durante uma partida animada
  Então o aviso só aparece depois do resumo da rodada, já com o salvamento feito

Cenário: novidades
  Dado o jogo atualizado para uma versão nova
  Quando o jogador abre o jogo pela primeira vez nela
  Então pode ver as novidades da versão, e o número da versão fica visível na tela "Sobre"

Cenário: save migrado na atualização
  Dado uma atualização que muda a versão do formato de save
  Quando o jogo recarrega
  Então a migração de US-033 roda antes de a carreira abrir
```

### Fora do escopo desta história

- Forçar atualização (o jogador pode adiar).

---

## US-040: Estrutura de tradução e escolha de idioma

**Como** jogador hispanofalante ou anglofalante, **quero** escolher o idioma do jogo, **para** jogar na minha língua; **como** equipe, **queremos** todos os textos fora do código, **para** traduzir sem programar.

**Prioridade:** Must
**Depende de:** —
**Notas:** item "Idiomas" do [backlog](PROJETO.md#backlog-de-recursos-por-etapa) (estrutura na Etapa 1; três línguas completas até a Etapa 5) e política de idioma do `CLAUDE.md`. Decisão P4: a interface inteira em pt-BR, es e en desde a 1a; notícias, rede social e mensagens prontas também nos três, com menos variações em es e en (a recomendação aprovada citava cerca de 5 por evento, contra 15 a 20 em pt-BR), completando até a Etapa 5. Base existente: `app/src/lib/i18n.ts` e `app/src/content/<idioma>/`. Nome do jogo sempre lido da configuração central.

### Critérios de aceite

```gherkin
Cenário: idioma inicial (P4)
  Dado o primeiro acesso com o navegador em espanhol
  Então o jogo abre em es; com o navegador em inglês, em en; em qualquer outro idioma, em pt-BR
  E o jogador pode trocar o idioma nas preferências, sem reiniciar a carreira

Cenário: chave ou evento faltando (P4)
  Dado uma chave de interface presente em pt-BR e ausente em es, ou um evento de notícia, rede social ou mensagem pronta da 1a sem nenhuma variação em en
  Quando a validação roda no CI
  Então ela falha indicando a chave ou o evento e o idioma

Cenário: texto escrito no código
  Dado um componente com texto visível fora dos arquivos de conteúdo
  Quando o lint roda
  Então ele falha indicando o arquivo

Cenário: nome do jogo
  Dado qualquer texto de interface que cite o nome do jogo
  Então o nome vem de config/prancheta.config.ts, e trocar o nome na configuração muda todos os textos
```

### Fora do escopo desta história

- Espanhol e inglês com o mesmo número de variações do pt-BR em notícias e rede social (até a Etapa 5, decisão P4).
- Narração em voz.

---

## US-041: Marcas fictícias no cenário

**Como** jogador, **quero** ver marcas inventadas nas placas, no placar e no resumo da rodada, **para** o jogo ter clima de estádio sem nenhuma propaganda de verdade.

**Prioridade:** Must
**Depende de:** US-020, US-019
**Notas:** [PROJETO.md › Monetização e apoio](PROJETO.md#monetização-e-apoio), alterado pelo [ADR-0015](adr/0015-patrocinio-desligado.md). A possibilidade técnica de patrocínio real fica, mas desligada. O jogo e o site não anunciam nem mostram patrocínio, e não há convite "Patrocine aqui" ou "Anuncie aqui" em lugar nenhum. Placas em volta do campo, placar, telas de carregamento e resumo da rodada usam marcas fictícias (a camisa fica para depois da 1a; o nome do estádio e o da competição não são espaços de marca), só como cenário, iguais para todos; nada de aposta nem bebida alcoólica. A receita vem só do apoio voluntário, com recompensa só cosmética. A lista de marcas fictícias é conteúdo, aprovada pelo CEO. Mapa dos lugares por tela em `docs/design/telas/README.md`. Não há patrocinador real nem busca de marcas no servidor; o formato do espaço permite a troca futura, desligada por padrão.

### Critérios de aceite

```gherkin
Cenário: cenário preenchido com marca fictícia
  Dado uma partida animada e o resumo da rodada
  Então as placas do campo, o placar e o resumo mostram marcas da lista de marcas fictícias
  E nenhum lugar fica vazio

Cenário: nenhum convite para patrocinar ou anunciar (ADR-0015)
  Dado os textos de interface em pt-BR, es e en
  Quando a validação de conteúdo roda
  Então ela falha se algum texto tiver um termo da lista de convites proibidos ("Patrocine aqui", "Anuncie aqui" e os equivalentes em es e en)

Cenário: igual para todos
  Dado dois saves diferentes na mesma rodada e no mesmo estádio
  Então a escolha da marca depende só do espaço, da rodada, do clube e do estádio, nunca de dado do jogador

Cenário: categorias proibidas
  Dado a lista de marcas fictícias
  Quando a validação de conteúdo roda
  Então ela falha se alguma marca estiver marcada como aposta, bebida alcoólica ou se coincidir com a lista de marcas reais

Cenário: sem rede e sem contagem
  Dado uma sessão de carreira com a rede monitorada
  Então nenhum espaço faz requisição de rede e nenhuma impressão é registrada
```

### Fora do escopo desta história

- Patrocinadores reais, espaços vindos do servidor, contagem de impressões e painel de patrocínios: a possibilidade técnica fica, mas desligada (ADR-0015); ligar depende de nova decisão do CEO.
- Apoio voluntário e recompensas cosméticas (link "Apoiar" na US-043; PIX na Etapa 6).
- Marca fictícia na camisa: depois da 1a, a menos que o CEO decida diferente.

---

## US-042: Tutorial e primeiros passos

**Como** jogador novo no gênero, **quero** um guia curto na primeira carreira, **para** entender escalação, tática e "Jogar rodada" sem manual.

**Prioridade:** Should
**Depende de:** US-017, US-018, US-019
**Notas:** item "Tutorial e primeiros passos" do [backlog](PROJETO.md#backlog-de-recursos-por-etapa); princípio "se precisa de manual, está complexo demais". Passos curtos, pulável, textos do arquivo de conteúdo. Sem recompensa por concluir.

### Critérios de aceite

```gherkin
Cenário: primeira carreira
  Dado o primeiro novo jogo no aparelho
  Quando a carreira começa
  Então o guia mostra em sequência: elenco, escalação, tática e "Jogar rodada", cada passo apontando o elemento na tela

Cenário: pular e rever
  Dado o guia aberto
  Quando o jogador toca "Pular"
  Então o guia fecha e não volta sozinho; pode ser reaberto pela tela "Sobre" ou de ajuda

Cenário: segunda carreira
  Dado que o guia já foi concluído ou pulado
  Quando o jogador cria outra carreira
  Então o guia não abre sozinho

Cenário: acessível
  Dado o guia aberto
  Então o foco do teclado vai para o passo atual e o passo pode ser fechado com Esc
```

### Fora do escopo desta história

- Tutoriais de mercado, finanças e online (etapas seguintes; o online da 1b tem ajuda própria nas telas).

---

## US-043: Tela "Sobre": aviso de ficção, versão, privacidade e links

**Como** jogador, **quero** saber que clubes e jogadores são fictícios, qual versão estou usando e o que o jogo faz com meus dados, **para** jogar tranquilo.

**Prioridade:** Must
**Depende de:** US-015
**Notas:** [PROJETO.md › Clubes, nomes e identidade](PROJETO.md#clubes-nomes-e-identidade) (aviso no jogo), [Privacidade](PROJETO.md#privacidade-lgpd-e-eca-digital) (política curta), [Monetização](PROJETO.md#monetização-e-apoio) (link de apoio simples desde cedo; apoio fora do jogo, com aviso) e item "Canal com a comunidade" do backlog. Decisão P13: o canal com a comunidade é público e moderável (Discussions do repositório público ou formulário no devlog), nunca Discord nem grupo de WhatsApp; qual dos dois ainda está em aberto, mas a tela só lê o link da configuração central. Decisão do CEO: a tela Sobre é, junto com o site, o único lugar do jogo com o convite "Patrocine aqui". Contatos e links lidos da configuração central; o e-mail de suporte ainda está vazio (pendência da auditoria do dia 1).

### Critérios de aceite

```gherkin
Cenário: aviso de ficção
  Dado a tela de abertura e a tela "Sobre"
  Então ambas mostram o aviso de que clubes, jogadores e marcas do jogo são fictícios

Cenário: versão e links (P13)
  Dado a tela "Sobre"
  Então mostra o número da versão do app, o link da política de privacidade do site e o link do canal com a comunidade
  E nenhum item convida a patrocinar ou anunciar (ADR-0015)
  E todos os links vêm de config/prancheta.config.ts

Cenário: link de apoio com aviso
  Dado o link "Apoiar" na tela "Sobre"
  Quando o jogador toca nele
  Então antes de sair do jogo aparece o aviso de que é uma página externa e de que menores precisam de um responsável

Cenário: contato ou link vazio
  Dado o e-mail de suporte ou o link do canal vazio na configuração
  Então a tela não mostra o item correspondente, nem campo de e-mail quebrado nem link vazio
```

### Fora do escopo desta história

- Termos de uso e classificação indicativa (Etapa 6).
- Apoio via PIX, com recompensas só cosméticas (Etapa 6).

---

## US-044: Preferências: tema, vibração, tipo de partida, rede social

**Como** jogador, **quero** escolher tema claro ou escuro, ligar ou desligar a vibração, trocar o tipo de partida e esconder a rede social, **para** jogar do meu jeito.

**Prioridade:** Should
**Depende de:** US-015, US-020, US-029
**Notas:** [Padrões de design](PROJETO.md#padrões-de-design) (escuro padrão, claro opcional) e [Rede social › Limites](PROJETO.md#rede-social-do-jogo) (desligar a aba). Preferências ficam no aparelho. Decisões do CEO: o tipo de partida (animada completa, só lances principais, só resultado) pode ser trocado durante a carreira, aqui e ao jogar a rodada (US-019); o realismo fica fixo depois de criar a carreira (US-014). Sem opção de áudio na Etapa 1 (decisão P5). Idioma em US-040; lembrete de exportar em US-037. Tela em `docs/design/telas/preferencias.md`.

### Critérios de aceite

```gherkin
Cenário: tema
  Dado o primeiro acesso
  Então o tema é escuro; ao escolher claro, todas as telas mudam e a escolha persiste depois de reabrir

Cenário: contraste nos dois temas
  Dado os tokens dos temas escuro e claro
  Quando "npm run tokens" roda
  Então todo par de texto e fundo usado passa em contraste ≥ 4,5:1

Cenário: trocar o tipo de partida
  Dado uma carreira aberta com o tipo "animada completa"
  Quando o jogador escolhe "só lances principais" nas Preferências
  Então a próxima rodada dessa carreira é mostrada só com lances principais, e a escolha continua depois de reabrir o jogo

Cenário: realismo fixo e sem áudio (P5)
  Dado as Preferências com uma carreira aberta
  Então o realismo da carreira aparece só como informação, sem controle para trocar, e não existe opção de áudio

Cenário: desligar a rede social
  Dado a rede social desligada
  Então a aba ou entrada do feed some e o termômetro continua funcionando com resultados e decisões
```

### Fora do escopo desta história

- Tamanho de fonte ajustável (Etapa 2).
- Opção de áudio (só quando houver lote de áudio aprovado pelo CEO).

---

## US-045: Tratamento e registro de erros sem dados pessoais

**Como** jogador, **quero** ver uma mensagem clara quando algo dá errado; **como** equipe, **queremos** saber que o jogo quebrou sem identificar ninguém, **para** corrigir rápido.

**Prioridade:** Must
**Depende de:** —
**Notas:** item "Registro de erros sem dados pessoais" do [backlog](PROJETO.md#backlog-de-recursos-por-etapa) e regra de erros do `CLAUDE.md` (motor retorna resultados tipados; a interface mostra em pt-BR e registra sem dados pessoais). Decisão P11: na 1a o registro fica só no aparelho, com o botão "Copiar relatório de erros" para mandar ao suporte; o envio anônimo ao nosso servidor na 1b é outra história e passa antes pelo `security-auditor`.

### Critérios de aceite

```gherkin
Cenário: erro inesperado na interface
  Dado um erro de programação lançado numa tela
  Então o jogador vê uma mensagem no idioma atual com "Tentar de novo" e "Voltar ao início", e a carreira salva não é alterada

Cenário: registro sem dados pessoais (P11)
  Dado um erro registrado
  Então o registro contém versão do app, tela, tipo e pilha do erro
  E não contém apelido do técnico, conteúdo do save, IP nem identificador do aparelho
  E nenhuma requisição de rede é feita para registrar o erro

Cenário: limite do registro local (P11)
  Dado mais erros do que o limite do registro local
  Então os mais antigos são descartados

Cenário: copiar para o suporte (P11)
  Dado a tela "Sobre"
  Quando o jogador toca "Copiar relatório de erros"
  Então o texto copiado é o mesmo registro, sem dados pessoais
```

### Fora do escopo desta história

- Envio do registro ao servidor (1b em diante, com revisão do `security-auditor`).
- Painel de saúde do servidor (Etapa 6).

---

## US-046: Estatísticas de uso do site sem cookies

**Como** equipe, **queremos** saber quantas pessoas visitam o site e de que país, sem identificar ninguém, **para** decidir prioridades.

**Prioridade:** Could
**Depende de:** —
**Notas:** item "Estatísticas de uso sem cookies" do [backlog](PROJETO.md#backlog-de-recursos-por-etapa) (exemplo citado: Cloudflare Web Analytics, registrado como restrição, não decisão) e [Privacidade](PROJETO.md#privacidade-lgpd-e-eca-digital) (sem cookie de terceiros, sem banner). Decisão P11: estatísticas só no site (`site/`) por enquanto; o jogo em `/jogo` não tem estatística nenhuma, porque seria uma chamada a terceiro dentro de um app offline. Passa pelo `security-auditor`.

### Critérios de aceite

```gherkin
Cenário: sem cookie nem identificador
  Dado uma visita ao site com estatísticas ligadas
  Então nenhum cookie é criado e nenhum identificador persistente de pessoa ou aparelho é gravado para estatística

Cenário: só contagens agregadas
  Dado o que é enviado ao serviço
  Então contém só página e dados técnicos agregáveis, sem nenhum dado do jogo

Cenário: jogo sem estatísticas (P11)
  Dado o build do jogo em /jogo e uma sessão de carreira com a rede monitorada
  Então nenhum script ou requisição de estatística existe no jogo
```

### Fora do escopo desta história

- Estatísticas dentro do jogo, eventos de jogo detalhados e funis.

---

## US-047: Criar conta anônima com apelido e passkey

**Como** jogador que quer jogar com amigos, **quero** criar uma conta só com um apelido e a biometria do celular, **para** entrar no online sem e-mail nem dado pessoal.

**Prioridade:** Must
**Depende de:** domínio definitivo (decisão pendente do CEO, item 4 da auditoria do dia 1)
**Notas:** [PROJETO.md › Privacidade, LGPD e ECA Digital](PROJETO.md#privacidade-lgpd-e-eca-digital) (apelido + passkey; sem e-mail, telefone, nome real ou data de nascimento; apelidos filtrados) e ADR-0003. Decisão P8: o online exige passkey; quem não tem suporte recebe a explicação, e a carreira offline não é afetada. Fica em rascunho até o domínio definitivo: a passkey fica presa ao domínio em que foi criada, e criar contas em `*.pages.dev` obrigaria todos a recuperar a conta pelo código (US-049) na troca de domínio. O servidor guarda só apelido, chave pública da passkey e o necessário para o código de recuperação (US-048). A carreira offline continua sem conta. A tela inicial ganha a entrada "Liga online" ao lado de "Carreira".

### Critérios de aceite

```gherkin
Cenário: criar conta
  Dado um aparelho com suporte a passkey e conexão
  Quando o jogador escolhe um apelido permitido e confirma com a biometria
  Então a conta é criada e o jogo segue para o código de recuperação (US-048)
  E o servidor guarda apenas apelido, chave pública e dados de recuperação

Cenário: apelido filtrado
  Dado um apelido com palavrão, ofensa, nome de pessoa pública da lista de bloqueio, link, e-mail ou telefone
  Quando o jogador tenta criar a conta
  Então o servidor recusa com mensagem em pt-BR, sem dizer qual palavra bateu, e nada é gravado

Cenário: apelido repetido ou fora do tamanho
  Dado um apelido já usado (sem diferença de caixa) ou fora dos limites de tamanho e caracteres
  Então a criação é recusada com a mensagem do motivo

Cenário: sem conexão
  Dado o aparelho offline
  Quando o jogador abre "Liga online"
  Então o jogo explica que o online precisa de internet e a carreira offline continua disponível

Cenário: aparelho sem passkey (P8)
  Dado um navegador sem suporte a passkey
  Então o jogo explica que o online exige um aparelho com passkey e não cria conta
```

### Fora do escopo desta história

- Conta sem passkey, só com código de recuperação (descartada na P8).
- Selo de apoiador e recompensas (Etapa 6).
- Limite de criação de contas em massa (Etapa 6).

---

## US-048: Código de recuperação

**Como** dono de uma conta anônima, **quero** um código de recuperação, **para** não perder a conta se trocar ou perder o celular.

**Prioridade:** Must
**Depende de:** US-047
**Notas:** [PROJETO.md › Privacidade](PROJETO.md#privacidade-lgpd-e-eca-digital) (sem o código e sem o aparelho, a conta se perde) e [Saves e backup](PROJETO.md#saves-e-backup) (o código também será a base da chave de cifra da sincronização na Etapa 4). O servidor nunca guarda o código em texto aberto. Formato e força do código são do `architect` com o `security-auditor`.

### Critérios de aceite

```gherkin
Cenário: mostrar uma vez
  Dado uma conta recém-criada
  Então o código aparece uma única vez, com botões "Copiar" e "Compartilhar"
  E o jogador só avança depois de digitar de volta uma parte pedida do código ou confirmar que guardou

Cenário: servidor não guarda o código legível
  Dado o banco do servidor após a criação
  Então não existe o código em texto aberto em nenhuma tabela nem em log

Cenário: gerar novo código
  Dado o jogador logado
  Quando pede um código novo e confirma com a passkey
  Então o código antigo deixa de funcionar e o novo é mostrado uma única vez
```

### Fora do escopo desta história

- Recuperação por e-mail ou telefone (não existe por decisão de privacidade).

---

## US-049: Entrar de novo e recuperar a conta em outro aparelho

**Como** jogador online, **quero** entrar com a biometria e, num celular novo, recuperar a conta com o código, **para** continuar nas minhas ligas.

**Prioridade:** Must
**Depende de:** US-048
**Notas:** [PROJETO.md › Privacidade](PROJETO.md#privacidade-lgpd-e-eca-digital). Ao recuperar, o aparelho novo registra uma passkey nova. Sessões têm validade definida pelo `architect`.

### Critérios de aceite

```gherkin
Cenário: entrar com passkey
  Dado uma conta com passkey neste aparelho
  Quando o jogador abre "Liga online" e confirma a biometria
  Então entra na conta e vê as suas ligas

Cenário: recuperar com o código
  Dado um aparelho sem a passkey da conta
  Quando o jogador informa apelido e código de recuperação corretos
  Então registra uma passkey nova neste aparelho e entra na conta, com as mesmas ligas

Cenário: código errado
  Dado um código incorreto
  Então o servidor recusa com mensagem genérica, sem revelar se o apelido existe
  E depois do número de tentativas do parâmetro de segurança, novas tentativas ficam bloqueadas por um tempo

Cenário: sessão expirada
  Dado uma sessão vencida
  Quando o jogador tenta confirmar uma rodada
  Então o jogo pede a biometria de novo e mantém a escalação que estava sendo editada
```

### Fora do escopo desta história

- Sincronização de saves da carreira (Etapa 4).

---

## US-050: Apagar a conta

**Como** jogador online, **quero** apagar minha conta e tudo o que o servidor guarda sobre mim, **para** exercer meu direito de eliminação (LGPD).

**Prioridade:** Must
**Depende de:** US-049
**Notas:** [PROJETO.md › Privacidade](PROJETO.md#privacidade-lgpd-e-eca-digital) e LGPD (direito de eliminação). Ao apagar, os clubes da pessoa nas ligas passam para a IA. Revisão obrigatória do `security-auditor`.

### Critérios de aceite

```gherkin
Cenário: apagar com confirmação
  Dado o jogador logado
  Quando escolhe "Apagar conta", lê o aviso e confirma com a passkey
  Então apelido, chaves, dados de recuperação e sessões são removidos do servidor
  E os clubes dele nas ligas passam para a IA, mostrados como "Técnico IA" para os demais

Cenário: apelido some das ligas
  Dado uma liga em que a pessoa jogou
  Depois de a conta ser apagada
  Então o apelido não aparece em tabela, mensagens ou histórico dessa liga

Cenário: dono da liga apaga a conta
  Dado que a pessoa é dona de uma liga com outros humanos
  Então a posse passa ao humano mais antigo da liga; sem outros humanos, a liga é encerrada
```

### Fora do escopo desta história

- Exportar os dados da conta (o servidor guarda só apelido e ligas; a tela de conta já mostra tudo).

---

## US-051: Criar liga online da Série A

**Como** jogador, **quero** criar uma liga da Série A com nome, modo e prazo, **para** jogar com meus amigos.

**Prioridade:** Must
**Depende de:** US-049, US-012
**Notas:** [PROJETO.md › Modo online](PROJETO.md#modo-online) e [Novo jogo › Liga online](PROJETO.md#novo-jogo-configurações-iniciais). Opções da 1b: nome da liga (filtrado como o apelido), modo (ao vivo ou assíncrono, com prazo por rodada), número de humanos (2 até o limite do modo, padrão 8 no ao vivo e 20 no assíncrono, um por clube, lido de configuração e não fixo no código; ADR-0013, revisado pelo CEO em 2026-11-04, substitui para a 1b o padrão de 8 e 30 do PROJETO.md), escolha de clubes (US-053, US-054), inatividade (US-060), mensagens prontas ligadas ou desligadas (US-062), duração (US-063). Decisão P12: prazos fixos por modo, ao vivo com 1, 2 ou 5 minutos (padrão 2) e assíncrono com 12, 24 ou 48 horas (padrão 24). Competições: só Série A. As escolhas viram "última configuração".

### Critérios de aceite

```gherkin
Cenário: criar com padrões
  Dado o jogador logado
  Quando cria uma liga com um nome permitido e os padrões
  Então a liga é criada no servidor com o criador como dono, um código de convite e estado "aguardando jogadores"

Cenário: limite por modo vem da configuração
  Dado o limite do modo ao vivo alterado na configuração do servidor
  Quando o jogador cria uma liga ao vivo
  Então o máximo de humanos oferecido é o novo limite, sem mudança de código, e nunca passa de 20 (um por clube)

Cenário: nome filtrado
  Dado um nome de liga com termo bloqueado, link, e-mail ou telefone
  Então a criação é recusada com mensagem em pt-BR

Cenário: prazos por modo (P12)
  Dado a tela de criação de liga
  Então o modo ao vivo oferece 1, 2 ou 5 minutos por rodada (padrão 2) e o assíncrono 12, 24 ou 48 horas (padrão 24)
  E uma requisição com prazo fora das opções do modo é recusada pelo servidor
```

### Fora do escopo desta história

- Tempo real, equilíbrio de orçamentos, mercado entre humanos, competições além da Série A, várias divisões (Etapas 2 a 6).
- Prazo livre digitado pelo dono da liga (P12).

---

## US-052: Entrar na liga por código de convite

**Como** amigo convidado, **quero** entrar na liga digitando ou abrindo um código, **para** participar sem busca pública.

**Prioridade:** Must
**Depende de:** US-051
**Notas:** [PROJETO.md › Modo online › Regras da liga](PROJETO.md#modo-online). Não há lista pública de ligas. O código pode ser compartilhado como link. Decisão P9: dá para entrar com a liga em andamento, enquanto houver vaga, assumindo um clube da IA.

### Critérios de aceite

```gherkin
Cenário: entrar
  Dado uma liga aguardando jogadores com vaga
  Quando o jogador logado informa o código
  Então entra na liga e aparece na lista de participantes para todos

Cenário: código inválido, liga cheia ou já membro
  Dado um código inexistente, uma liga sem vaga, ou um jogador que já está na liga
  Então o servidor recusa com a mensagem de cada caso e nada muda

Cenário: link de convite
  Dado o link de convite aberto por alguém sem conta
  Então o jogo leva à criação de conta (US-047) e depois volta para entrar na liga

Cenário: liga em andamento (P9)
  Dado uma liga já iniciada com vaga e clube da IA disponível
  Quando o jogador entra pelo código
  Então assume um clube da IA a partir da próxima rodada não processada, herdando pontos e elenco do clube
```

### Fora do escopo desta história

- Busca pública e página pública da liga (Etapa 6).
- Limites contra convites repetidos (Etapa 6).

---

## US-053: Escolha de clubes: livre e sorteio

**Como** dono da liga, **quero** que os humanos escolham o clube livremente ou por sorteio, **para** começar a temporada de forma justa.

**Prioridade:** Must
**Depende de:** US-052
**Notas:** [PROJETO.md › Novo jogo › Liga online](PROJETO.md#novo-jogo-configurações-iniciais). O sorteio é feito pelo servidor com semente registrada. Só o dono inicia a temporada; os clubes sem humano ficam com a IA.

### Critérios de aceite

```gherkin
Cenário: escolha livre
  Dado uma liga com escolha livre
  Quando dois jogadores tentam o mesmo clube
  Então só o primeiro a confirmar no servidor fica com ele; o segundo recebe "clube já escolhido"

Cenário: sorteio
  Dado uma liga com sorteio e 6 humanos
  Quando o dono inicia a temporada
  Então o servidor atribui 6 clubes diferentes, a atribuição é reproduzível pela semente registrada e todos veem o resultado

Cenário: iniciar a temporada
  Dado ao menos 2 humanos com clube
  Quando o dono toca "Começar temporada"
  Então a liga gera calendário e elencos, vai para a rodada 1 e os demais clubes ficam com a IA
  E com menos de 2 humanos o botão fica desabilitado com o motivo
```

### Fora do escopo desta história

- Draft (US-054); orçamentos nivelados (Etapa 3).

---

## US-054: Escolha de clubes por draft

**Como** grupo de amigos, **queremos** escolher os clubes cada um na sua vez, **para** dar emoção à montagem da liga.

**Prioridade:** Could
**Depende de:** US-053
**Notas:** [PROJETO.md › Novo jogo › Liga online](PROJETO.md#novo-jogo-configurações-iniciais) (draft em ligas pequenas; em ligas grandes, sorteio ou livre). O limite de humanos para permitir draft é configuração.

### Critérios de aceite

```gherkin
Cenário: ordem do draft
  Dado uma liga com draft e 4 humanos
  Quando o dono inicia o draft
  Então o servidor sorteia a ordem com semente registrada e cada um escolhe na sua vez

Cenário: vez esgotada
  Dado um jogador cuja vez passou do prazo de escolha
  Então o servidor escolhe por ele o clube disponível de maior força e passa a vez

Cenário: draft indisponível em liga grande
  Dado uma liga com mais humanos que o limite de draft da configuração
  Então a opção draft não aparece na criação
```

### Fora do escopo desta história

- Draft de jogadores.

---

## US-055: Preparar a rodada online e confirmar "Pronto"

**Como** jogador online, **quero** ajustar escalação e tática e apertar "Pronto", **para** que a rodada ande assim que todos estiverem prontos.

**Prioridade:** Must
**Depende de:** US-053, US-017, US-018
**Notas:** [PROJETO.md › Modo online › Fluxo de uma rodada](PROJETO.md#modo-online). As telas de escalação e tática são as mesmas da carreira. O servidor valida tudo (o cliente não é confiável).

### Critérios de aceite

```gherkin
Cenário: confirmar
  Dado uma rodada aberta
  Quando o jogador salva escalação e tática e toca "Pronto"
  Então o servidor registra a escalação, e todos da liga veem o jogador como pronto

Cenário: mudar de ideia
  Dado o jogador pronto e a rodada ainda não processada
  Quando ele altera a escalação e confirma de novo
  Então vale a última escalação confirmada

Cenário: escalação inválida
  Dado uma escalação com jogador de outro clube, suspenso, lesionado, repetido ou com número errado de titulares
  Então o servidor recusa com o motivo e o estado de pronto não muda

Cenário: sem conexão
  Dado o aparelho offline
  Quando o jogador toca "Pronto"
  Então o jogo avisa que não confirmou, mantém a escalação no aparelho e tenta de novo quando a conexão volta, se a rodada ainda estiver aberta

Cenário: prazo visível
  Dado uma rodada aberta
  Então o tempo restante do prazo aparece em texto, na hora local do aparelho
```

### Fora do escopo desta história

- Mercado entre humanos (Etapa 3); modo férias (Etapa 6).

---

## US-056: Servidor processa a rodada com o mesmo motor

**Como** jogador online, **quero** que o servidor simule a rodada com o mesmo motor do jogo, **para** que ninguém manipule resultados.

**Prioridade:** Must
**Depende de:** US-055, US-012, US-011
**Notas:** [PROJETO.md › Modo online](PROJETO.md#modo-online) (simula quando todos confirmam ou o prazo vence; quem não confirmou joga com a última escalação salva; mesmo motor) e ADR-0003 (Hono + Workers + D1 + Durable Objects, como restrição). O cliente nunca envia resultados.

### Critérios de aceite

```gherkin
Cenário: todos prontos
  Dado todos os humanos prontos antes do prazo
  Então o servidor processa a rodada sem esperar o prazo

Cenário: prazo vence
  Dado um humano sem confirmar quando o prazo vence
  Então a rodada é processada com a última escalação confirmada dele
  E se ele nunca confirmou, com a escalação da IA (US-011)

Cenário: última escalação com desfalque
  Dado a última escalação com um jogador agora suspenso ou lesionado
  Então o servidor troca esse jogador pela regra da IA, só nessa posição, e avisa o dono do clube

Cenário: mesmo motor, mesmo resultado
  Dado o estado da liga, as escalações e a semente da rodada
  Quando a rodada é simulada no servidor e no motor do cliente em teste
  Então os resultados são idênticos

Cenário: processamento único
  Dado duas chamadas simultâneas para processar a mesma rodada
  Então a rodada é processada uma única vez
```

### Fora do escopo desta história

- Reprocessar rodada pelo painel de admin (Etapa 6).
- Copas e várias divisões (Etapas 2 e 5).

---

## US-057: Modo ao vivo: partidas vistas juntas

**Como** grupo conectado ao mesmo tempo, **queremos** ver as partidas e os placares ao vivo juntos, **para** sofrer e comemorar na mesma hora.

**Prioridade:** Must
**Depende de:** US-056, US-020
**Notas:** [PROJETO.md › Modo online](PROJETO.md#modo-online) (prazo curto, resultado simulado na hora e visto por todos juntos, placares ao vivo, mensagens prontas). A partida é exibida a partir dos eventos já simulados pelo servidor, no mesmo ritmo para todos. Decisão P6: sem comandos durante a partida no online da 1b; tática e escalação valem como definidas antes do "Pronto". O placar ao vivo dos outros jogos é a faixa da carreira (US-070), que define o comportamento; o critério abaixo continua sendo o do online. A tabela ao vivo (US-071), a importância do gol (US-072), o plantão (US-073) e a preferência dele (US-074) valem também aqui, com o clube de cada humano no lugar do clube do técnico, e dependem da T-063.

### Critérios de aceite

```gherkin
Cenário: transmissão sincronizada
  Dado uma liga ao vivo com 3 humanos conectados
  Quando a rodada é processada
  Então os 3 recebem os mesmos eventos e veem o mesmo minuto da partida com diferença máxima definida pelo architect
  E um placar ao vivo dos outros jogos da rodada atualiza a cada gol

Cenário: chegou atrasado
  Dado um jogador que conecta no minuto 60 da transmissão
  Então ele entra no minuto atual, com o placar certo

Cenário: conexão cai
  Dado um jogador que perde a conexão durante a transmissão
  Quando reconecta
  Então volta ao minuto atual ou, se acabou, ao resumo da rodada; o resultado não depende de quem estava conectado

Cenário: sem comandos (P6)
  Dado uma partida online em transmissão
  Então não aparecem comandos, substituições manuais nem conversa no intervalo
```

### Fora do escopo desta história

- Comandos e substituições ao vivo no online (P6; reavaliar depois da 1b).
- Narração em voz e torcida sonora.

---

## US-058: Modo assíncrono: aviso de rodada processada

**Como** jogador de liga assíncrona, **quero** saber, ao abrir o jogo, que a rodada foi processada e o que mudou, **para** jogar quando der.

**Prioridade:** Must
**Depende de:** US-056
**Notas:** [PROJETO.md › Modo online](PROJETO.md#modo-online) (prazo longo; notificação de rodada processada). Push só na Etapa 6; na 1b o aviso é dentro do app.

### Critérios de aceite

```gherkin
Cenário: aviso ao abrir
  Dado uma rodada processada enquanto o jogador estava fora
  Quando ele abre o jogo
  Então vê na entrada da liga o aviso "rodada N processada" e o placar do seu jogo

Cenário: várias rodadas
  Dado 3 rodadas processadas desde o último acesso
  Então o jogo mostra o resumo das 3, da mais antiga para a mais recente, e a rodada aberta atual

Cenário: partida rápida
  Dado o resumo de uma rodada no assíncrono
  Então o jogador pode ver a partida animada a partir dos eventos ou só o resultado, conforme a preferência
```

### Fora do escopo desta história

- Notificações push (Etapa 6).

---

## US-059: Resultados, tabela e notícias da liga para todos

**Como** jogador online, **quero** ver resultados, tabela e notícias da minha liga depois de cada rodada, **para** acompanhar a disputa com os amigos.

**Prioridade:** Must
**Depende de:** US-056, US-023, US-028
**Notas:** [PROJETO.md › Modo online › Fluxo de uma rodada](PROJETO.md#modo-online) (resultados, tabela e notícias chegam a todos). Clubes de humanos mostram o apelido do técnico; clubes da IA, "Técnico IA". Mesmos critérios de desempate de US-012 (CBF, P1).

### Critérios de aceite

```gherkin
Cenário: tabela da liga
  Dado uma rodada processada
  Então todos os membros veem a mesma tabela, com os clubes humanos identificados pelo apelido em texto

Cenário: notícias do meu clube
  Dado uma rodada processada
  Então cada humano vê notícias sobre o próprio clube e da rodada geral, geradas pelos templates de US-027

Cenário: offline depois de sincronizar
  Dado o jogador que abriu a liga com conexão e depois ficou offline
  Então ainda vê a última tabela e os últimos resultados recebidos, com o aviso "atualizado em" em texto
```

### Fora do escopo desta história

- Rede social e termômetro exibidos na liga online (o termômetro existe no motor; a tela fica para depois).
- Página pública da liga (Etapa 6).

---

## US-060: Inatividade: a IA assume o clube

**Como** jogador de uma liga, **quero** que quem sumiu não trave a liga, **para** a temporada continuar.

**Prioridade:** Must
**Depende de:** US-056
**Notas:** [PROJETO.md › Novo jogo › Liga online](PROJETO.md#novo-jogo-configurações-iniciais) (após quantas rodadas sem confirmar a IA assume). O número de rodadas é escolhido na criação da liga. Decisão P10: o clube fica reservado e a pessoa o retoma ao confirmar uma escalação, sem pedir nada ao dono.

### Critérios de aceite

```gherkin
Cenário: IA assume
  Dado uma liga com inatividade de 3 rodadas
  Quando um humano fica 3 rodadas seguidas sem confirmar
  Então a partir da rodada seguinte o clube dele é escalado pela IA e marcado como "IA no comando" para todos

Cenário: não conta para "todos prontos"
  Dado um clube com a IA no comando
  Então ele não é esperado para processar a rodada antes do prazo

Cenário: volta do jogador (P10)
  Dado um humano cujo clube está com a IA
  Quando ele confirma uma escalação numa rodada aberta
  Então retoma o clube a partir dessa rodada, sem aprovação do dono da liga
```

### Fora do escopo desta história

- Modo férias (Etapa 6); expulsar jogador da liga.

---

## US-061: Dono da liga troca o modo no meio da temporada

**Como** dono da liga, **quero** trocar entre ao vivo e assíncrono no meio da temporada, **para** adaptar a liga à rotina do grupo.

**Prioridade:** Should
**Depende de:** US-057, US-058
**Notas:** [PROJETO.md › Modo online › Regras da liga](PROJETO.md#modo-online) (o dono pode trocar o modo no meio da temporada). A rodada seguinte abre com o prazo padrão do novo modo (P12). Com os padrões do ADR-0013 revisado (8 no ao vivo, 20 no assíncrono), o cenário "limite de humanos" acontece de fato: uma liga assíncrona com mais de 8 humanos não pode passar para ao vivo. Recomendação do `architect`: o servidor recusa a troca com o motivo em pt-BR e a opção aparece desabilitada com o mesmo motivo; ninguém é tirado da liga nem passado à IA para caber. A troca de ao vivo para assíncrono é sempre permitida.

### Critérios de aceite

```gherkin
Cenário: troca vale na próxima rodada
  Dado uma liga assíncrona com a rodada 10 aberta
  Quando o dono troca para ao vivo
  Então a rodada 10 mantém o prazo atual e a rodada 11 abre com o prazo do modo ao vivo
  E todos os membros recebem o aviso da troca

Cenário: limite de humanos
  Dado uma liga assíncrona com mais humanos que o limite do ao vivo
  Então a troca para ao vivo é recusada com o motivo

Cenário: só o dono
  Dado um membro que não é dono
  Então a opção de trocar o modo não aparece e o servidor recusa a requisição
```

### Fora do escopo desta história

- Trocar para "Tempo real" (Etapa 4).

---

## US-062: Mensagens prontas e emojis

**Como** jogador online, **quero** provocar e cumprimentar os amigos com mensagens prontas e emojis, **para** ter a resenha sem chat livre.

**Prioridade:** Must
**Depende de:** US-055
**Notas:** [PROJETO.md › Privacidade › ECA Digital](PROJETO.md#privacidade-lgpd-e-eca-digital) (chat só com mensagens prontas e emojis, desligável) e [Notícias e mensagens](PROJETO.md#notícias-e-mensagens). Catálogo de mensagens e emojis nos três idiomas em `app/src/content/<idioma>/` (P4), aprovado pelo CEO; cada destinatário vê a mensagem no próprio idioma. Nenhum texto livre em nenhum lugar.

### Critérios de aceite

```gherkin
Cenário: enviar mensagem pronta
  Dado uma liga com mensagens ligadas
  Quando o jogador escolhe uma mensagem do catálogo
  Então os membros veem a mensagem com o apelido do autor, no idioma de cada um

Cenário: texto livre é impossível
  Dado uma requisição ao servidor com texto que não é um id do catálogo
  Então o servidor recusa e nada é gravado nem repassado

Cenário: desligar na liga e para si
  Dado o dono desligou as mensagens da liga
  Então ninguém envia nem vê mensagens nessa liga
  E dado um jogador que desligou as mensagens só para si, ele não as vê, e os outros continuam usando

Cenário: limite de envio
  Dado um jogador que envia mais mensagens que o limite do parâmetro num intervalo
  Então as excedentes são recusadas com aviso
```

### Fora do escopo desta história

- Chat de texto livre (nunca).
- Bloquear jogador (Etapa 6).

---

## US-063: Fim de temporada e duração da liga online

**Como** grupo de amigos, **queremos** que a liga feche a temporada com um campeão e continue pelo número de temporadas combinado, **para** ter rivalidade de longo prazo.

**Prioridade:** Must
**Depende de:** US-059, US-025
**Notas:** [PROJETO.md › Novo jogo › Liga online](PROJETO.md#novo-jogo-configurações-iniciais) (duração: número de temporadas ou sem fim). A virada de temporada segue a mesma regra da carreira: mesmos 20 clubes (decisão P2).

### Critérios de aceite

```gherkin
Cenário: campeão da liga
  Dado a rodada 38 processada
  Então todos veem o campeão e a classificação final, com os humanos destacados por apelido

Cenário: liga com duração
  Dado uma liga de 2 temporadas no fim da segunda
  Então a liga vai ao estado "encerrada", fica só para leitura e não abre nova rodada

Cenário: próxima temporada (P2)
  Dado uma liga sem fim ou com temporadas restantes
  Quando o dono inicia a próxima temporada
  Então ela começa pela mesma regra de virada de US-025, com os mesmos 20 clubes e os mesmos humanos nos mesmos clubes
```

### Fora do escopo desta história

- Troca de clube entre temporadas e propostas a humanos (Etapa 4).

---

## US-064: Lista de privacidade da 1b auditada e política atualizada

**Como** responsável legal pelo jogo, **quero** comprovar que o online guarda só o que o documento decide, **para** cumprir LGPD e ECA Digital antes de abrir para amigos.

**Prioridade:** Must
**Depende de:** US-047 a US-062
**Notas:** [PROJETO.md › Privacidade, LGPD e ECA Digital](PROJETO.md#privacidade-lgpd-e-eca-digital), ADR-0003 (o `security-auditor` revisa a 1b antes de qualquer merge que toque contas ou servidor). A política de privacidade do site é atualizada para descrever o online.

### Critérios de aceite

```gherkin
Cenário: só os campos permitidos
  Dado o esquema do banco do servidor
  Quando o teste de esquema roda
  Então os únicos dados ligados a uma pessoa são apelido, chave pública, dados de recuperação sem o código legível, sessões, participação em ligas e mensagens prontas por id
  E qualquer coluna nova ligada a conta faz o teste falhar até ser incluída na lista aprovada

Cenário: logs sem IP nem apelido
  Dado os logs do servidor de uma sessão completa (criar conta, liga, rodada, mensagem)
  Então nenhum log contém IP, apelido, código de recuperação ou identificador da passkey

Cenário: política atualizada
  Dado a página de privacidade do site
  Então ela descreve exatamente os dados da lista acima, por quanto tempo ficam e como apagar a conta (US-050)
```

### Fora do escopo desta história

- Consulta ao advogado (antes de monetizar; tarefa do CEO).

---

## US-065: Denunciar apelido ou nome de liga

**Como** jogador, **quero** denunciar um apelido ou nome de liga ofensivo, **para** que a liga continue um lugar saudável.

**Prioridade:** Must (P7 aprovada: a denúncia mínima entra na 1b)
**Depende de:** US-047, US-051; quem trata as denúncias e em quanto tempo (parte da P7 ainda em aberto)
**Notas:** [PROJETO.md › Privacidade › ECA Digital](PROJETO.md#privacidade-lgpd-e-eca-digital) (apelidos filtrados, com botão de denúncia; interação entre usuários exige denúncia). O roteiro põe denúncias completas na Etapa 6; esta história é a versão mínima, sem painel: a denúncia fica registrada no servidor e é tratada à mão pela equipe. Mensagens prontas não precisam de denúncia porque são do catálogo. Fica em rascunho até o CEO dizer quem trata e em quanto tempo; com a resposta entra um critério para o prazo informado na confirmação ao jogador e na política de privacidade.

### Critérios de aceite

```gherkin
Cenário: denunciar
  Dado um apelido ou nome de liga visível na liga
  Quando o jogador toca "Denunciar" e escolhe um motivo da lista
  Então o servidor registra a denúncia com o alvo, o motivo e a data, e o jogador vê a confirmação

Cenário: sem duplicata
  Dado que o jogador já denunciou o mesmo alvo
  Então a nova denúncia não cria outro registro

Cenário: dados da denúncia
  Dado um registro de denúncia
  Então ele não contém IP nem texto livre
```

### Fora do escopo desta história

- Fila de denúncias no painel de admin, renomear e suspender (Etapa 6).
- Bloquear jogador (Etapa 6).

---

## US-066: Temporada base nos dados de clubes e no novo jogo

**Como** jogador, **quero** que um jogo novo comece com os dados de clubes da temporada mais recente, **para** encontrar a Série A, os estádios e os títulos como estão hoje, sem que as minhas carreiras em andamento mudem.

**Prioridade:** Must
**Depende de:** US-001, US-014, US-032
**Notas:** Regra do CEO (2026-11-04): os dados de referência dos clubes (títulos históricos, capacidade dos estádios, quem está na Série A depois de acesso e rebaixamento, e a força pela colocação de referência, US-069) são atualizados uma vez por ano, num conjunto identificado pela **temporada base**. Decisão do CEO (D4, em "Decisões do CEO sobre os dados de referência dos clubes"): a temporada base leva o ano que será jogado, e a temporada 1 da carreira leva esse ano. A **base 2026** usa a tabela do Brasileirão 2026 parcial para a força e os títulos até 2025 ([clubes-serie-a.md](design/clubes-serie-a.md)). O novo jogo sempre usa a temporada base mais recente; carreiras já existentes não mudam, porque o save guarda o próprio estado (ADR-0006). Como a temporada base fica registrada na carreira é decisão do `architect`; se pedir campo novo no save, é ADR com migração, junto da T-018/T-019. O processo anual de troca é a US-067; os títulos ganhos na carreira (US-068) nunca entram nestes conjuntos. Na Etapa 1 só existe a Série A.

### Critérios de aceite

```gherkin
Cenário: cada temporada base passa na validação da US-001
  Dado cada conjunto de dados de clubes do repositório, identificado pela sua temporada base
  Quando a validação roda no CI
  Então cada conjunto passa em todos os cenários de US-001
  E não existem dois conjuntos com a mesma temporada base

Cenário: novo jogo usa a temporada base mais recente (D4)
  Dado o jogo com os conjuntos das temporadas base 2026 e 2027
  Quando o jogador cria uma carreira nova (US-014)
  Então os clubes, estádios, capacidades, títulos e forças da carreira são os do conjunto 2027
  E o save registra a temporada base 2027, e a temporada 1 da carreira leva o ano 2027

Cenário: carreira existente não muda
  Dado um save fixture criado com a temporada base 2026
  Quando ele é aberto numa versão do jogo que já traz o conjunto 2027
  Então clubes, nomes, estádios, capacidades, títulos e forças são idênticos aos do save antes de abrir
  E o save continua registrado com a temporada base 2026
```

### Fora do escopo desta história

- Atualizar uma carreira em andamento para uma temporada base nova, ou trocar a temporada base de uma carreira.
- Escolher uma temporada base antiga no novo jogo.
- Dados de clubes enviados pelo servidor fora de uma versão nova do jogo (os conjuntos chegam com a atualização do app, US-039).
- Temporada base nas ligas online (1b): a regra para ligas novas fica para o refinamento da US-051.
- Séries B a D (Etapa 2).

---

## US-067: Lote anual de atualização da temporada base

**Como** CEO, **quero** receber uma vez por ano o lote da nova temporada base com tudo o que mudou em relação à anterior, **para** aprovar as mudanças antes que entrem no jogo.

**Prioridade:** Should (decisão D6: fica Should até a data da 1a estar clara; vira Must se a primeira versão pública da 1a sair depois do fim do Brasileiro real de 2026)
**Depende de:** US-066; lista reserva de clubes que podem subir da Série B, com nomes aprovados pelo CEO
**Notas:** Regra do CEO (2026-11-04) e [clubes-serie-a.md › Atualização anual](design/clubes-serie-a.md#atualização-anual). Decisão D5: o lote é montado em dezembro, depois do fim da temporada real, e publicado até o fim de janeiro. O `game-designer` e o `content-writer` montam o conjunto N+1: quem sobe e quem cai, títulos atualizados, capacidades e colocação de referência (que muda a força, US-069). O porte só muda por decisão do CEO, nunca pela colocação; o perfil de IA só muda com justificativa no lote. Como toda lista de clubes, o lote passa pelo CEO antes de entrar no jogo; a aprovação faz parte do PR de conteúdo, que só o CEO aprova e faz merge. Clube que sobe precisa de nome em trocadilho, cores, estádio, apelido e rivais vindos de um lote aprovado; clube que já esteve num conjunto anterior mantém o mesmo id. O número de vagas de acesso e rebaixamento é constante ou parâmetro do `game-designer` (4 na Série A atual).

### Critérios de aceite

```gherkin
Cenário: relatório de diferenças para o CEO
  Dado o conjunto da temporada base N e o conjunto N+1 proposto
  Quando a ferramenta de comparação roda
  Então a saída lista os clubes que saem e os que entram na Série A e, para cada clube presente nos dois, cada campo que mudou com o valor antigo e o novo
  E nenhum campo sem mudança aparece

Cenário: acesso e rebaixamento coerentes
  Dado o conjunto N+1
  Quando a validação roda no CI
  Então o número de clubes que saem e o de clubes que entram em relação ao conjunto N são iguais ao número de vagas de rebaixamento e de acesso
  E todo clube que entra consta da lista reserva aprovada e tem todos os campos obrigatórios de US-001
  E um clube que volta à Série A usa o mesmo id que tinha num conjunto anterior

Cenário: títulos só crescem, com um campeão por ano
  Dado os clubes presentes nos conjuntos N e N+1
  Quando a validação roda no CI
  Então nenhum contador de títulos diminui
  E exatamente um clube ganha 1 título no contador do Brasileiro, nos demais contadores no máximo um clube ganha 1, e nenhum clube ganha mais de 1 num mesmo contador
```

### Fora do escopo desta história

- Atualizações no meio do ano (reforma de estádio, mudança de força por contratações): só uma vez por ano.
- Elencos e jogadores reais (nunca: os jogadores são gerados, US-003 e US-004).
- Coleta automática de fontes externas: o lote é montado pelos agentes e aprovado pelo CEO.
- Séries B a D com dados próprios (Etapa 2).

---

## US-068: Títulos da carreira somam ao histórico do clube

**Como** jogador, **quero** que os títulos conquistados na carreira se somem ao histórico do clube, **para** ver o meu trabalho entrar para a história do clube.

**Prioridade:** Must
**Depende de:** US-025, US-032, US-033, US-066
**Notas:** Regra do CEO (2026-11-04) e [clubes-serie-a.md › Títulos](design/clubes-serie-a.md#títulos-histórico-fictício): o histórico fixo vem do conjunto da temporada base (US-066) e nunca é alterado pela carreira; os títulos ganhos no jogo ficam no estado da carreira, no save, e a interface e os templates mostram a soma. Entra na T-017 (fim de temporada) e na T-018 (save), com ADR do `architect` e migração (T-019). O total é calculado para os 20 clubes, inclusive os da IA, para que notícias como "o maior campeão do país" continuem certas. Na Etapa 1 só se ganha o título do Brasileiro (Série A); os outros contadores (Copa do Brasil, Libertadores, Sul-Americana) só mudam quando as competições existirem. Decisão D7: na 1a o total de títulos aparece só para o clube do jogador (tela do clube, US-015), além da cerimônia e das notícias.

### Critérios de aceite

```gherkin
Cenário: título conquistado soma ao histórico
  Dado uma carreira em que o clube do jogador tem H títulos de liga no conjunto da temporada base
  Quando o clube termina a temporada 1 em primeiro lugar
  Então a cerimônia de título (US-025) e a tela do clube (US-015) mostram H+1 títulos de liga, com o texto do arquivo de conteúdo
  E o conjunto da temporada base continua com H para esse clube

Cenário: campeão da IA também soma
  Dado uma carreira em que um clube da IA com H títulos de liga é campeão da temporada
  Então o total de títulos de liga desse clube na carreira, usado pelos templates, passa a H+1
  E o total de nenhum outro clube muda

Cenário: fica no save e não passa para outras carreiras
  Dado a carreira com o clube do jogador em H+1 títulos, salva, exportada e importada (US-035, US-036)
  Então o total continua H+1
  E uma carreira nova com o mesmo clube e a mesma temporada base mostra H

Cenário: migração do save
  Dado um save fixture da versão do formato anterior ao registro de títulos da carreira
  Quando o jogo abre esse save (US-033)
  Então ele é migrado, abre na mesma rodada, e o total de cada clube é o histórico da temporada base mais os títulos das temporadas já encerradas nesse save
```

### Fora do escopo desta história

- Ficha com o total de títulos de outros clubes (D7: Etapa 4, junto com "Histórico e recordes").
- Títulos de copa, estaduais e continentais conquistados na carreira (Etapas 2 e 5).
- Sala de troféus, hall da fama e troféus do técnico (Etapa 4, "Histórico e recordes").
- Títulos de ligas online (1b): não somam ao histórico de nenhuma carreira nem do conjunto da temporada base.
- Levar títulos de uma carreira para outra ou para o conjunto da temporada base.

---

## US-069: Força inicial pela colocação da temporada anterior

**Como** jogador, **quero** que a força inicial de cada clube siga a colocação dele no último campeonato, **para** que o começo da carreira se pareça com a temporada de verdade, mesmo quando um grande está mal.

**Prioridade:** Must
**Depende de:** US-066
**Notas:** Regra do CEO (2026-11-04) e [clubes-serie-a.md › Força e Atualização anual](design/clubes-serie-a.md#força). Porte e força são separados: o porte vem de títulos, história e torcida e nunca muda pela colocação; a força (`strength`) vem só da colocação de referência, numa escada única de 20 degraus (`LADDER`, soma 1.400), sem relação com o porte. Referência: posição final na Série A anterior (1 a 16 para quem ficou) e `20 + posição na Série B` para quem subiu (21 a 24); os 20 clubes são ordenados pela referência e recebem `LADDER` nessa ordem. Na base 2026, a referência é a posição na tabela parcial do Brasileirão 2026 (1 a 20), com data e rodada no documento. Clube sem colocação conhecida vai para o fim da ordem, com desempate pelo `id`. A força gera o elenco (US-004). Decisão D8: a colocação dentro da carreira não mexe na força da temporada seguinte.

### Critérios de aceite

```gherkin
Cenário: força segue a escada pela referência
  Dado um conjunto de temporada base com a referência de cada clube
  Quando a validação roda no CI
  Então as 20 forças, ordenadas, são exatamente a LADDER de docs/design/clubes-serie-a.md
  E a força de cada clube é a do degrau da sua posição na ordem por referência; se divergir, a validação falha indicando o clube, o valor gravado e o esperado

Cenário: referência inválida ou ausente
  Dado um clube com referência fora de 1 a 24 ou dois clubes com a mesma referência
  Quando a validação roda no CI
  Então ela falha e indica o clube
  E dado um clube sem referência, ele recebe o degrau do fim da ordem, com desempate pelo id, sem falhar

Cenário: porte não entra na força
  Dado dois conjuntos iguais exceto pelo porte de um clube
  Quando as forças são calculadas
  Então as forças dos 20 clubes são idênticas nos dois conjuntos

Cenário: colocação na carreira não muda a força (D8)
  Dado uma carreira em que um clube termina a temporada 1 numa posição diferente da sua referência
  Quando começa a temporada 2 (US-025)
  Então a strength desse clube na carreira é a mesma da temporada 1
```

### Fora do escopo desta história

- Mudar o porte pela colocação (nunca; o porte só muda por decisão do CEO).
- Considerar copas ou campanhas anteriores à última temporada.

---

## US-070: Placar ao vivo dos outros jogos na partida

**Como** técnico assistindo à partida do meu clube, **quero** ver numa faixa discreta os placares dos outros 9 jogos da rodada, atualizados a cada gol, **para** saber o que acontece com os concorrentes sem sair do meu jogo.

**Prioridade:** Should
**Depende de:** US-012, US-020
**Notas:** Pedido do CEO (2026-11-05), "como na TV", em cinco histórias: esta faixa, a tabela ao vivo (US-071), a importância do gol (US-072), o plantão (US-073) e a preferência do plantão (US-074). [temporada.md › Ordem do processamento de uma rodada](design/temporada.md#ordem-do-processamento-de-uma-rodada), passo 2: as outras 9 partidas rodam em paralelo, cada uma com a sua semente, e os comandos do técnico (US-021) só recalculam a partida dele; por isso a faixa nunca desfaz um gol já mostrado. Vale nos tipos "animada completa" e "só lances principais" (partida assistida, ritmo "No meu ritmo"); no "só resultado" não há transmissão e os outros resultados aparecem só no resumo (US-019). Relógio comum: um gol do minuto M de outro jogo aparece quando a partida assistida chega ao minuto M; com a partida pausada (comandos, intervalo), a faixa para; "Pular" (US-020) vai ao resumo com os 10 resultados. Acréscimos (proposta, a confirmar com o `game-designer`): os de todos os jogos correm no relógio da partida assistida; quando ela termina, os jogos que ainda teriam acréscimos mostram o placar final de uma vez, todos marcados "encerrado". Volume: cerca de 25 gols por rodada nos outros 9 jogos, um a cada 3 ou 4 minutos de jogo. A faixa existe com qualquer valor da preferência do plantão (US-074), inclusive "Desligado". No online, a US-057 já pede "um placar ao vivo dos outros jogos da rodada atualiza a cada gol": a faixa é a mesma e a US-057 continua dona do critério no online (T-063); no ritmo "Tempo real" (Etapa 4) a faixa também é a mesma. Os nomes curtos vêm dos dados dos clubes e os textos de `app/src/content/<idioma>/`.

### Critérios de aceite

```gherkin
Cenário: faixa com os outros 9 jogos
  Dado a partida do clube do técnico em "animada completa" ou "só lances principais"
  Quando a transmissão começa
  Então a faixa mostra os outros 9 jogos da rodada, cada um com o nome curto dos dois clubes e o placar 0 x 0
  E a faixa não se sobrepõe ao placar da partida assistida nem aos botões de comando, em largura de celular e de desktop

Cenário: placar muda no minuto do gol
  Dado um outro jogo da rodada em que o motor registra um gol no minuto M
  Quando a partida assistida chega ao minuto M
  Então o placar desse jogo na faixa muda nesse minuto, e não antes
  E o placar que mudou fica destacado pelo tempo definido pelo ux-designer, com ícone de gol e rótulo de texto, não só por cor
  E com prefers-reduced-motion o destaque aparece sem animação

Cenário: fim da partida assistida
  Dado a partida assistida no apito final
  Então os 9 placares da faixa são iguais aos do motor e aos do resumo da rodada (US-019), todos marcados "encerrado"

Cenário: partida pausada
  Dado a partida assistida pausada para comandos (US-021) ou no intervalo (US-022)
  Então nenhum placar da faixa muda até a partida voltar a correr

Cenário: sem transmissão no "só resultado"
  Dado o tipo de partida "só resultado"
  Quando o jogador joga a rodada
  Então não aparece a faixa; os outros 9 resultados aparecem no resumo (US-019)
```

### Fora do escopo desta história

- Outros lances dos outros jogos na faixa (cartões, pênaltis perdidos, lesões).
- Assistir a outro jogo da rodada ou trocar de partida.

---

## US-071: Tabela ao vivo: se terminasse agora, intervalo e fim

**Como** técnico, **quero** ver a classificação como estaria se a rodada terminasse agora, com setas de quem sobe e quem desce, com um toque durante o jogo, sozinha no intervalo e "como ficou" no fim, **para** acompanhar o efeito dos placares sem parar a partida.

**Prioridade:** Should
**Depende de:** US-012, US-019, US-022, US-023, US-070
**Notas:** Pedido do CEO (2026-11-05). "Se terminasse agora" é a tabela oficial de antes da rodada mais os 10 jogos com o placar do minuto atual contado como final, inclusive o jogo do técnico. O desempate é o da tabela oficial (US-012, P1; [temporada.md › Pontos e tabela](design/temporada.md#pontos-e-tabela)): os cartões até o minuto atual contam nos critérios 6 e 7, o confronto direto conta o jogo em andamento quando os dois empatados se enfrentam nesta rodada, e o sorteio do critério 8 usa a mesma semente. A ordem tem de ser a que o motor daria; onde fica o cálculo é decisão do `architect`. As setas comparam com a tabela oficial do início da rodada, não com o minuto anterior. A tabela usa os rótulos de zona e o "seu clube" da tela da tabela (US-023), com um título que deixa claro que é parcial. Três momentos: durante o jogo, abre por cima da partida com um toque e a partida continua correndo; no intervalo, aparece sozinha junto da conversa do intervalo (US-022), sem tomar o lugar dela; no apito final da partida assistida, a tela mostra "como ficou" no mesmo formato (antes ou dentro do resumo da rodada, US-019; o lugar é do `ux-designer`). No modo "só resultado", que não tem transmissão, o "como ficou" aparece no resumo da rodada (US-019), no mesmo formato (decisão D10 do CEO, 2026-11-05). A versão resumida, usada pelo plantão grande (US-073), tem 5 linhas: o clube do técnico e os 2 vizinhos de cada lado (nas pontas, as 5 primeiras ou as 5 últimas). Online e "Tempo real": mesma dependência da US-070.

### Critérios de aceite

```gherkin
Cenário: mesma regra da tabela oficial
  Dado a tabela antes da rodada e os placares e cartões dos 10 jogos no minuto M
  Quando o jogador abre a tabela ao vivo no minuto M
  Então a ordem e as colunas P, J, V, E, D, GP, GC e SG são as da tabela oficial calculada com esses placares e cartões como resultados finais, com os mesmos critérios de desempate (P1)

Cenário: setas de quem sobe e quem desce
  Dado um clube 10º antes da rodada que está 7º na tabela ao vivo e outro 7º que está 9º
  Então o primeiro mostra seta para cima e "+3" em texto, e o segundo seta para baixo e "−2", cada seta com rótulo acessível
  E quem não mudou de posição mostra o ícone de "sem mudança", com rótulo
  E com prefers-reduced-motion as setas e as trocas de linha aparecem sem animação

Cenário: abre com um toque e não interrompe
  Dado a partida assistida correndo no minuto M
  Quando o jogador toca o botão da tabela ao vivo, com alvo de toque de pelo menos 44 px
  Então a tabela abre sem pausar o relógio da partida e atualiza a cada gol enquanto está aberta
  E um toque fecha a tabela, com a partida no mesmo minuto em que estaria sem ela

Cenário: tabela no intervalo
  Dado a partida assistida chegando ao intervalo
  Então a tela mostra sozinha a tabela ao vivo do intervalo, com setas e o clube do técnico destacado
  E as 3 opções da conversa do intervalo (US-022) continuam visíveis, sem sobreposição com a tabela, com alvos de pelo menos 44 px
  E escolher uma opção ou "Pular" tem o mesmo efeito que sem a tabela

Cenário: conversa do intervalo cita a tabela (D11)
  Dado a partida assistida no intervalo e a tabela ao vivo do intervalo calculada
  Quando a situação do clube do técnico na tabela ao vivo cai num dos casos previstos (sai ou entra no Z4, entra ou sai da zona da Libertadores, assume ou perde a liderança, o rival direto está perdendo ou ganhando)
  Então o texto de cada opção da conversa (motivar, cobrar, acalmar) usa uma variação que cita essa situação, vinda dos templates de app/src/content/<idioma>/
  E sem caso previsto, o texto é o padrão da US-022
  E o efeito da conversa no motor é idêntico ao da mesma opção sem a citação

Cenário: como ficou no fim
  Dado o apito final da partida assistida
  Então a tela mostra "como ficou", no mesmo formato, igual à tabela oficial depois da rodada, com as setas em relação ao início da rodada

Cenário: como ficou no "só resultado" (D10)
  Dado o tipo de partida "só resultado"
  Quando o jogador joga a rodada
  Então o resumo da rodada (US-019) mostra "como ficou", no mesmo formato, igual à tabela oficial depois da rodada, com as setas em relação ao início da rodada e o clube do técnico destacado

Cenário: resultado e tabela oficial intocados
  Dado o mesmo save e a mesma semente
  Quando a rodada é jogada uma vez abrindo a tabela ao vivo e outra sem abrir
  Então os eventos do motor e os placares são idênticos
  E a tela da tabela (US-023) só muda depois que a rodada é aplicada
```

### Fora do escopo desta história

- Simular cenários ("e se eu empatar?") ou projetar o fim do campeonato.
- Artilharia ao vivo.
- Opção nova "Mostrar a tabela" na conversa do intervalo, com efeito próprio no motor: ideia registrada em `docs/status.md`, a avaliar depois da calibragem da T-016 (D11).

---

## US-072: Importância do gol em outro jogo

**Como** técnico, **quero** que o jogo saiba quais gols dos outros jogos mexem na minha situação, e quanto, **para** que a transmissão destaque o que importa, como na TV.

**Prioridade:** Should
**Depende de:** US-071; confirmação do critério e do valor de N pelo `game-designer` (em `docs/design/`) antes de a tarefa começar
**Notas:** Pedido do CEO (2026-11-05); exemplos dele: o rival direto empatou, o líder está perdendo, um concorrente contra o rebaixamento virou o jogo. É a regra que o plantão (US-073) usa para escolher o tamanho e a ordem da fila. Critério proposto, **a confirmar com o `game-designer`**: tudo é medido na tabela ao vivo (US-071) logo antes e logo depois do gol, e o gol de um dos outros 9 jogos recebe o nível mais alto entre as regras que valem ("você" é o clube do técnico).

| Nível | Nome   | Quando                                                                                                   | Motivo (indicativo)                  | Plantão                |
| ----- | ------ | -------------------------------------------------------------------------------------------------------- | ------------------------------------ | ---------------------- |
| 3     | Título | você está na briga pelo título e o gol mexe nela                                                         | `titleRace`                          | grande, passa à frente |
| 2     | Zona   | você está na briga da Libertadores ou na da queda e o gol mexe nela                                      | `relegationRace`, `libertadoresRace` | grande                 |
| 1     | Você   | a sua posição mudou, ou o gol mudou os pontos do clube logo acima ou logo abaixo de você, a até N pontos | `position`, `directRival`            | grande                 |
| 0     | Comum  | nenhuma das anteriores                                                                                   | `none`                               | curto                  |

- **Briga de uma fronteira** entre as posições k e k+1: quem está até a posição k e tem no máximo `P(k+1) + N` pontos, mais quem está depois da posição k e tem pelo menos `P(k) − N` pontos, em que `P(i)` é a pontuação do i-ésimo colocado. Fica vazia quando os dois lados estão a mais de N pontos. Fronteiras: título, k = 1; Libertadores, k = 6 (a última posição da "Zona da Libertadores" da tabela; D9); queda, k = 16.
- **O gol mexe na briga** quando muda os pontos ao vivo de um clube da briga ou muda quem está de cada lado da fronteira.
- **Mudar os pontos** é mudar o resultado ao vivo daquele jogo (vitória, empate ou derrota). O gol que só amplia a vantagem (de 2 x 0 para 3 x 0) não muda pontos, mas pode mudar a posição pelo saldo.
- **Motivo:** sai junto do nível e escolhe a linha "o que mudou para você" do plantão grande (por exemplo, "O líder está perdendo", "Seu rival direto empatou", "Você entrou no Z4"); o texto é do `content-writer`. Se mais de uma regra vale, vence a de nível mais alto; no nível 2, `relegationRace` antes de `libertadoresRace`; no nível 1, `position` antes de `directRival`. Os nomes dos códigos são do `architect`.
- **N** é parâmetro novo em `app/src/params/` (o nome é do `architect`); sugestão de valor: 3, uma vitória.
- **Sem nível acima de 0:** na rodada 1 (a tabela parte do zero e quase todo gol mexe em posição; a mesma razão dos fatos `enteredZ4` em `temporada.md`). Gol do jogo do técnico não passa por esta regra: já aparece na partida.
- **Volume:** o `game-designer` mede com a ferramenta de balanceamento a média de gols de cada nível por rodada, por faixa da tabela, e ajusta N. No começo da temporada, com poucos pontos, as brigas são largas e o nível 3 pode ficar frequente; o ajuste (N menor nas primeiras rodadas, por exemplo) é dele.
- **Zonas:** a Sul-Americana não entra. A briga da Libertadores usa a mesma fronteira da tabela da 1a, a "Zona da Libertadores" do 2º ao 6º (`temporada.md`), no lugar do G4 citado no pedido (decisão D9 do CEO, 2026-11-05), mesmo com as copas ainda sem valer; se a zona mudar na tabela, k muda junto.

### Critérios de aceite

```gherkin
Esquema do Cenário: nível e motivo do gol (a confirmar com o game-designer)
  Dado N = 3, a rodada <rodada> e a tabela ao vivo logo antes de um gol num dos outros 9 jogos
  E <situação>
  Quando o gol acontece
  Então o nível do gol é <nível> e o motivo é <motivo>

  Exemplos:
    | rodada | situação                                                                                                                             | nível | motivo           |
    | 10     | o 1º tem 20 pontos e você é 2º com 18; o líder empatava e sofre o gol que o deixa perdendo                                           | 3     | titleRace        |
    | 10     | o 1º tem 20, o 2º 12 e você é 3º com 11, fora da briga da Libertadores e da queda; o líder empatava e sofre o gol que o deixa perdendo | 0     | none             |
    | 10     | você é 16º com 15 pontos e o 17º tem 13; o 18º, com 12 e perdendo, vira o jogo                                                       | 2     | relegationRace   |
    | 10     | você é 6º com 30, longe do líder, e o 7º tem 29 perdendo; o 7º empata                                                                | 2     | libertadoresRace |
    | 10     | você é 10º com 25, fora das três brigas; o 11º, com 24 e perdendo, empata e você continua 10º                                        | 1     | directRival      |
    | 10     | você é 10º, fora das três brigas; o 11º, com os mesmos pontos e já vencendo por 1 x 0, faz o 2º gol e passa à sua frente pelo saldo  | 1     | position         |
    | 10     | você é 10º, fora das três brigas; o 9º, 2 pontos à frente e vencendo por 2 x 0, faz o 3º gol e nenhuma posição muda                  | 0     | none             |
    | 10     | você é 10º, fora das três brigas; o 18º vira o jogo e a sua posição não muda                                                         | 0     | none             |
    | 1      | qualquer gol num dos outros 9 jogos                                                                                                  | 0     | none             |

Cenário: regra determinística e sem efeito no motor
  Dado a mesma tabela ao vivo antes e depois de um gol e o mesmo N
  Quando o nível é calculado duas vezes
  Então o nível e o motivo são os mesmos
  E os eventos do motor e os placares da rodada não dependem do cálculo
```

### Fora do escopo desta história

- Importância de cartão vermelho, pênalti perdido ou lesão em outros jogos.
- Zona da Sul-Americana e vagas de copa valendo (Etapa 5).
- Importância dos gols do próprio jogo do técnico.

---

## US-073: Plantão dos outros jogos na tela da partida

**Como** técnico, **quero** que todo gol dos outros jogos seja anunciado como num plantão de TV, curto para o gol comum e grande para o que mexe comigo, **para** sentir a rodada inteira sem perder a minha partida.

**Prioridade:** Should
**Depende de:** US-070, US-071, US-072
**Notas:** Pedido do CEO (2026-11-05), com a correção dele de que todo gol em outro jogo é anunciado, como na TV. Dois tamanhos, escolhidos pelo nível da US-072:

- **Plantão curto (nível 0):** uma faixa que entra por 2 a 3 segundos com "GOL", o clube que marcou, o placar novo e o minuto, e some.
- **Plantão grande (níveis 1 a 3):** um cartão de destaque por alguns segundos com o clube que marcou, o placar novo, o minuto e a linha "o que mudou para você" (motivo da US-072); depois o cartão vira a tabela resumida (US-071: o clube do técnico e os 2 vizinhos de cada lado), com as setas de quem sobe e quem desce.

Fila: um plantão por vez; o de nível mais alto passa à frente; no mesmo nível, vale a ordem dos eventos do motor. Quando um plantão termina e há 2 ou mais curtos esperando (por exemplo, em velocidade rápida), eles saem juntos num plantão só ("3 gols na rodada", com o placar de cada jogo). Os tempos exatos (o curto dentro de 2 a 3 s) são do `ux-designer` e contam em tempo real, não em minutos de jogo. A partida assistida continua por trás e nunca para sozinha por causa de um plantão. Com a partida pausada pelo técnico (comandos, US-021), nenhum plantão novo começa e o tempo do que está na tela para. No intervalo e no apito final a fila é descartada, porque a tabela do intervalo e o "como ficou" (US-071) já mostram tudo (proposta, a confirmar com o `ux-designer`). Nenhum plantão cobre o placar da partida assistida nem os botões de comando. A faixa de placares (US-070) atualiza em todo gol, com ou sem plantão. O que aparece depende da preferência "Plantão dos outros jogos" (US-074). Ritmo: cerca de 25 gols por rodada nos outros 9 jogos, um a cada 3 ou 4 minutos de jogo.

Estilo de "plantão" genérico: nenhuma marca, vinheta, nome, bordão ou visual que imite uma emissora ou um programa de TV real (regra de nomes reais do `CLAUDE.md`). O visual é do `art-director` e do `ux-designer`; os textos são do `content-writer` e passam pelo CEO no lote. Sem som na Etapa 1 (P5): nada de vinheta sonora. Quando o áudio entrar, com lote aprovado pelo CEO e estimativa de créditos, pode-se avaliar uma vinheta própria do plantão, também sem imitar emissora real. Online e "Tempo real": mesma dependência da US-070.

### Critérios de aceite

```gherkin
Cenário: gol comum gera plantão curto
  Dado a preferência "Todos os gols" e um gol de nível 0 num outro jogo no minuto M
  Quando a partida assistida chega ao minuto M
  Então entra um plantão curto com "GOL", o clube que marcou, o placar novo e o minuto, que some sozinho entre 2 e 3 segundos depois
  E o relógio da partida assistida não para

Cenário: gol importante gera plantão grande
  Dado um gol de nível 1, 2 ou 3 num outro jogo
  Então entra o plantão grande com o clube que marcou, o placar novo, o minuto e a linha "o que mudou para você" do motivo da US-072, com ícone e texto, não só cor
  E em seguida o cartão mostra a tabela resumida com o clube do técnico e os 2 vizinhos de cada lado, com as setas
  E o relógio da partida assistida não para

Cenário: fila com prioridade e agrupamento
  Dado um plantão na tela e, esperando, dois gols de nível 0 e depois um de nível 2
  Quando o plantão da tela termina
  Então o próximo é o de nível 2
  E depois dele os dois de nível 0 saem juntos num único plantão, com os dois placares

Cenário: pausa, intervalo e fim
  Dado um plantão na tela e outro na fila
  Quando o técnico pausa a partida para dar um comando
  Então o tempo do plantão na tela para e nenhum novo começa até a partida voltar a correr
  E ao chegar ao intervalo ou ao apito final, a fila é descartada

Cenário: não cobre a partida e reduz movimento
  Dado qualquer plantão na tela, em largura de celular e de desktop
  Então ele não se sobrepõe ao placar da partida assistida nem aos botões de comando
  E com prefers-reduced-motion ele aparece e some sem animação de entrada e saída

Cenário: sem marca real de TV
  Dado a lista bloqueada de conteúdo, com nomes de emissoras, programas e bordões de TV reais mantidos pelo content-writer
  Quando npm run content:check roda
  Então nenhum texto do plantão, em nenhum idioma, contém um item dessa lista
```

### Fora do escopo desta história

- Som e vinheta sonora (P5; só com lote de áudio aprovado pelo CEO).
- Plantão de cartão vermelho, pênalti perdido ou lesão em outro jogo.
- Replay do gol de outro jogo (Etapa 4).
- Plantão no modo "só resultado".

---

## US-074: Preferência "Plantão dos outros jogos"

**Como** jogador, **quero** escolher se o plantão anuncia todos os gols dos outros jogos, só os importantes ou nenhum, **para** ter a transmissão do meu jeito.

**Prioridade:** Should
**Depende de:** US-044, US-073
**Notas:** Pedido do CEO (2026-11-05). Opção nas Preferências (US-044), com três valores: "Todos os gols" (padrão), "Só os importantes" (só o plantão grande; o gol comum só atualiza e destaca a faixa) e "Desligado" (só a faixa de placares, US-070). Não muda o motor nem a tabela ao vivo (US-071). Fica no aparelho, como as outras preferências da US-044. Entra junto da US-073, para o plantão nunca existir sem como desligar.

### Critérios de aceite

```gherkin
Cenário: valor padrão
  Dado o primeiro acesso
  Então "Plantão dos outros jogos" vale "Todos os gols"

Esquema do Cenário: o que cada valor mostra
  Dado a preferência "<valor>"
  Quando sai um gol de nível 0 e depois um de nível 2 em outros jogos
  Então aparece <plantões>
  E a faixa de placares atualiza e destaca os dois jogos

  Exemplos:
    | valor             | plantões                   |
    | Todos os gols     | o plantão curto e o grande |
    | Só os importantes | só o plantão grande        |
    | Desligado         | nenhum plantão             |

Cenário: persiste e não muda o resultado
  Dado a preferência trocada para "Desligado"
  Então a escolha continua depois de reabrir o jogo
  E com o mesmo save e a mesma semente, os eventos do motor e os placares são iguais aos de "Todos os gols"
```

### Fora do escopo desta história

- Escolher o plantão por clube ou por briga (por exemplo, "só a briga contra a queda").

---

## Requisitos não funcionais

| Área            | Requisito                                                                                                | Como verificamos                         |
| --------------- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------- |
| Desempenho      | rodada simulada em menos de 2 s num celular simples; instalação inicial abaixo de 10 MB                  | medição no `/balance` e no build         |
| Privacidade     | nenhum dado pessoal; lista da seção de privacidade do `PROJETO.md`                                       | `security-auditor`                       |
| Acessibilidade  | alvos ≥ 44px, contraste ≥ 4,5:1, resultado nunca só por cor, `prefers-reduced-motion` respeitado         | `ux-designer`, `npm run tokens` e E2E    |
| Compatibilidade | Chrome e Safari dos últimos 2 anos, Android e iPhone; desktop                                            | E2E (Etapa 1a)                           |
| Determinismo    | mesma semente, mesma temporada; mesmo resultado no aparelho e no servidor                                | testes do motor e golden tests           |
| Offline         | carreira inteira jogável sem conexão depois da primeira visita                                           | E2E com rede cortada                     |
| Conteúdo        | nenhum texto visível fora de `app/src/content/<idioma>/`; nenhum nome real                               | lint e validação de conteúdo no CI       |
| Engajamento     | sem recompensa por login, sequência de dias, tempo de uso ou reprodução automática sem fim; sem loot box | revisão do `security-auditor` em cada PR |
| Custo           | 1a com custo zero; 1b dentro do plano gratuito ou, se preciso, do plano pago de US$ 5 dos Workers        | `devops-engineer` documenta antes        |

## Fora do escopo da Etapa 1

- Séries B a D, acesso e rebaixamento reais, Copa do Brasil, estaduais, Supercopa e Recopa, calendário congestionado e STJD (Etapa 2).
- Mercado entre clubes e entre humanos, contratos, salários, finanças, bilheteria, sócios, estádio, comissão técnica, treinos e brasilidades financeiras (Etapa 3).
- Metas e confiança da diretoria, demissão, propostas, base, histórico, replay, editor local, ritmo "Tempo real", sincronização de saves, SAF e dívida herdada (Etapa 4).
- América do Sul, olheiros, resto do mundo, altitude e clima, espanhol e inglês completos (Etapa 5).
- Ligas grandes com várias divisões, notificações push, modo férias, bloqueio, página pública da liga, painel de admin completo, apoio via PIX, limites contra abuso (Etapa 6).
- Áudio de qualquer tipo, efeitos e narração em voz (P5); estatísticas de uso dentro do jogo (P11); comandos durante a partida no online (P6).
- Patrocinadores reais e qualquer anúncio ou convite para patrocinar (desligados pelo ADR-0015); chat de texto livre (este, nunca).

## Decisões do CEO (2026-11-04)

Respostas às perguntas do `/kickoff`, registradas em `docs/status.md` ("Decisões do CEO no `/kickoff`" e "Decisões do CEO depois do merge do `/kickoff`"). Em P1 e P2 o CEO respondeu explicitamente; de P3 a P13 aceitou as recomendações deste documento.

1. **P1. Critérios de desempate da tabela.** Os da CBF para a Série A: vitórias, saldo de gols, gols pró, confronto direto (só entre dois clubes), menos cartões vermelhos, menos amarelos e, por fim, sorteio com a semente do jogo. (US-012, US-059)
2. **P2. Depois da 38ª rodada, sem Série B.** Nova temporada com os mesmos 20 clubes: os 4 últimos aparecem como "zona de rebaixamento", sem efeito, e os jogadores envelhecem e evoluem pela curva de idade; o clube do jogador continua na Série A mesmo entre os 4 últimos. A subida de 4 clubes fica para quando houver lista aprovada. (US-025, US-063)
3. **P3. Opções do novo jogo de etapas futuras.** Escondidas na Etapa 1, nem desabilitadas nem com "em breve"; voltam quando o sistema existir. (US-014)
4. **P4. Idiomas na 1a.** Interface inteira em pt-BR, es e en desde a 1a, com o CI bloqueando chave faltando; notícias, rede social e mensagens prontas também nos três, com menos variações em es e en, completando até a Etapa 5. (US-040, US-028, US-031, US-062)
5. **P5. Áudio na Etapa 1.** Nenhum áudio, só vibração no Android; a opção "Áudio" fica escondida até o CEO aprovar um lote com a estimativa de créditos. (US-020, US-044)
6. **P6. Comandos durante a partida no online ao vivo.** Não na 1b: a partida online é simulada inteira no servidor e transmitida igual para todos, com tática e escalação definidas antes do "Pronto". (US-057, US-021)
7. **P7. Denúncia de apelido na 1b.** Sim, uma denúncia mínima (registro no servidor, tratado à mão, sem painel). Segue aberto quem trata e em quanto tempo (ver abaixo). (US-065)
8. **P8. Aparelho sem passkey.** O online exige passkey; quem não tem suporte recebe a explicação, e a carreira offline não é afetada. (US-047)
9. **P9. Entrar numa liga em andamento.** Permitido enquanto houver vaga: a pessoa assume um clube da IA a partir da próxima rodada, herdando pontos e elenco. (US-052)
10. **P10. Volta depois da inatividade.** O clube fica reservado e a pessoa o retoma ao confirmar uma escalação, sem pedir nada ao dono. (US-060)
11. **P11. Registro de erros e estatísticas.** Na 1a, registro de erros só no aparelho, com "Copiar relatório de erros"; o envio anônimo ao nosso servidor na 1b passa antes pelo `security-auditor`. Estatísticas de uso só no site; nenhuma no jogo. (US-045, US-046, US-038)
12. **P12. Prazos por rodada.** Opções fixas: ao vivo com 1, 2 ou 5 minutos (padrão 2); assíncrono com 12, 24 ou 48 horas (padrão 24). (US-051, US-061)
13. **P13. Canal com a comunidade.** Até existir o e-mail de suporte, o devlog com um formulário simples ou as Discussions do repositório público; sem Discord nem grupos de WhatsApp, por causa do público menor de idade. Segue aberto qual dos dois (ver abaixo). (US-043)

Outras decisões do CEO que mudaram critérios:

- **Rótulo "promessa":** aprovado para jovens de potencial alto, só o rótulo, nunca o número. (US-016)
- **Tipo de partida:** pode ser trocado durante a carreira, nas Preferências e ao jogar a rodada; o realismo fica fixo depois de criar a carreira. (US-014, US-019, US-020, US-044)
- **Patrocínio:** desligado (ADR-0015). Placas, placar e camisas usam marcas fictícias, só como cenário; nem o jogo nem o site anunciam ou mostram patrocínio, sem "Patrocine aqui" em lugar nenhum; a receita vem só do apoio voluntário, com recompensa só cosmética. (US-041, US-043)
- **Ícones próprios** do `art-director`, com conjunto aberto provisório atrás do componente `Icon` até a aprovação; **menu "Mais"** no topo, com as mesmas entradas no pé da tela Clube. (US-015)
- **Fator casa:** ADR-0011, opção A (`match.homeBase = 0.05`; mandante vence 45% a 50%). (US-007, US-008, US-013, US-026)
- **Dados de referência dos clubes:** atualizados uma vez por ano, por temporada base; o novo jogo usa a mais recente e carreiras existentes não mudam (ADR-0006); cada lote passa pelo CEO; títulos ganhos na carreira somam ao histórico e ficam no save; a força inicial segue a colocação de referência. (US-066, US-067, US-068, US-069)
- **Porte e força separados:** o porte vem de títulos, história e torcida e só muda por decisão do CEO; a força vem só da colocação de referência, numa escada única de 20 degraus (`docs/design/clubes-serie-a.md`). (US-004, US-069)

### Decisões do CEO sobre os dados de referência dos clubes (2026-11-04)

O CEO aceitou as recomendações das perguntas abertas 4 a 8 desta revisão. A numeração segue a das perguntas (D4 a D8).

4. **D4. Ano da temporada base.** É o ano que será jogado, e a temporada 1 da carreira leva esse ano. A base 2026 usa a tabela do Brasileirão 2026 parcial para a força (decisão anterior do CEO, registrada em `docs/design/clubes-serie-a.md`) e os títulos até 2025. (US-066, US-069)
5. **D5. Quando sai o lote anual.** Montado em dezembro, depois do fim da temporada real, e publicado até o fim de janeiro. (US-067)
6. **D6. US-067 na primeira versão da 1a.** Fica Should até a data da 1a estar clara; vira Must se a primeira versão pública sair depois do fim do Brasileiro real de 2026. (US-067)
7. **D7. Onde aparece o total de títulos.** Na 1a, só para o clube do jogador (tela do clube), além da cerimônia de título e das notícias; a ficha de outros clubes fica para a Etapa 4, com "Histórico e recordes". (US-068)
8. **D8. Colocação dentro da carreira.** Não mexe na força da temporada seguinte da carreira; a força na carreira vem do elenco e da curva de idade (US-025). (US-069)

### Decisões do CEO sobre o placar e a tabela ao vivo (2026-11-05)

O CEO aceitou as recomendações das perguntas abertas 9 e 10 do pedido de 2026-11-05 (US-070 a US-074). A numeração segue a das perguntas (D9 e D10).

9. **D9. Fronteira da Libertadores no plantão.** O plantão usa a mesma fronteira da tabela da 1a: a "Zona da Libertadores", do 2º ao 6º (`docs/design/temporada.md`), no lugar do G4. Na US-072, k = 6 e o motivo `libertadoresRace`. (US-072, US-073)
10. **D10. "Como ficou" no "só resultado".** Aparece também no resumo do modo "só resultado" (US-019), no mesmo formato da partida assistida. (US-071, US-019)
11. **D11. A conversa do intervalo cita a tabela ao vivo.** Decisão do CEO de 2026-11-05: as três opções da conversa ganham variações de texto que citam a situação da tabela ao vivo (Z4, zona da Libertadores, liderança, rival direto), sem mudar o efeito no motor; o lote de textos do `content-writer` passa pelo CEO. Uma opção nova "Mostrar a tabela", com efeito próprio, fica como ideia para depois da calibragem da T-016. (US-071, US-022)

### Perguntas que seguem abertas

1. **P7 (resto). Quem trata as denúncias e em quanto tempo?** Recomendo que, na 1b, o próprio CEO trate, com prazo de até 72 horas para renomear à força ou remover um apelido ou nome de liga ofensivo, e que o `architect` defina como o CEO fica sabendo de uma denúncia nova (sem painel). Um prazo semanal seria mais leve, mas deixa um apelido ofensivo visível para menores por dias. Trava a US-065.
2. **P13 (resto). Discussions do GitHub ou formulário no devlog?** Recomendo as Discussions do repositório público: custo zero, nada para construir nem guardar do nosso lado, moderação pronta e exigência de conta no GitHub (que só aceita maiores de 13 anos). O formulário no devlog pediria um lugar para guardar as respostas, ou seja, dado pessoal novo com ADR e `security-auditor`. Não trava nenhuma história: a tela Sobre lê o link da configuração.
3. **Tipo de partida por carreira ou para o aparelho?** As decisões não dizem se trocar o tipo de partida vale só para a carreira aberta ou para todas as carreiras do aparelho. Recomendo por carreira, porque ele é escolhido no novo jogo (US-014). Os critérios de US-019 e US-044 foram escritos para valer nos dois casos, então não trava nada; a resposta orienta o `ux-designer` e o `architect`.

As perguntas 4 a 10 foram respondidas (ver D4 a D8 e D9 e D10 acima).

Insumos pendentes que travam histórias (não são perguntas novas):

- **Lista dos 20 clubes da Série A** (`/content nomes série A`, aprovada pelo CEO): trava a US-001.
- **Domínio definitivo** (item 4 da auditoria do dia 1): trava a US-047, porque a passkey fica presa ao domínio em que foi criada. Recomendo decidir antes de começar a 1b.
- **Lista reserva de clubes que podem subir da Série B**, com nomes aprovados pelo CEO: trava o primeiro lote da US-067.
