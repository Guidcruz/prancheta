# Tática

**Histórias:** US-018 · **Prioridade:** Must · **Ordem:** 8 · **Tarefa:** T-029

## Objetivo

Escolher formação, postura e pressão e definir capitão e cobradores, entendendo o efeito de cada opção numa frase.

## O que o jogador faz

Toca uma formação, uma postura e uma pressão (cada uma com a frase de efeito), vê a força e os avisos mudarem com a formação, e abre as folhas de capitão, pênaltis e faltas ([funcoes.md](funcoes.md)). Tudo vale na hora, sem "Salvar".

## Navegação

- Terceira opção do seletor Elenco | Escalação | Tática, na aba Elenco (`#/squad`); ver [escalacao.md](escalacao.md), "Navegação".
- As folhas de Funções têm entrada própria no histórico: o voltar do celular fecha a folha e fica na Tática.
- A Tática da partida (folha durante o jogo, T-033) reaproveita o FormationPicker e os OptionGroup desta tela; a postura "Tudo no ataque" só existe lá, a partir dos 60' (partida.md, "Nota para a tela").

## Conteúdo (de cima para baixo)

1. **Seletor** Elenco | Escalação | **Tática**.
2. **Formação** (FormationPicker): as 6 formações em cartas de rádio, cada uma com a miniatura do esquema (ver "Miniatura da formação"), o nome ao lado e a frase de efeito embaixo, na largura toda da carta. Duas colunas no celular em pé; três quando o grupo tem 480px ou mais. Nota embaixo da legenda: `tactic.formation.note`.
3. **Força do time** (StrengthBars, a mesma da Escalação, com a mesma regra: [escalacao.md](escalacao.md#força-do-time)): mostra a mudança com a seta e o número com sinal logo depois de trocar a formação.
4. **Nesta formação** (LineupIssues, título `tactic.issues.title`): fora de posição e improvisados que a troca criou ou desfez, com nome e as duas posições. Os avisos de vaga livre e de inaptos também aparecem aqui, se houver.
5. **Postura** (OptionGroup): Defensiva, Equilibrada, Ofensiva, cada uma com a frase de efeito.
6. **Pressão** (OptionGroup): Baixa, Média, Alta, com a frase.
7. **Funções** (título `tactic.roles.title` e três LinkRow): Capitão, Pênaltis, Faltas. O valor de cada linha é a lista ("Ildo, Zuza", com o nome de exibição e vírgula; corta com reticências) ou, com a lista vazia, "Automático: {nome}" com quem a regra escolhe hoje. Tocar abre a folha da função.

Não há botão primário: o primário é "Jogar rodada".

## Miniatura da formação

Pedido do CEO em 2026-11-07, depois da primeira captura ("melhore as imagens de formação, talvez colocar linhas conectando as bolinhas"): na versão 1, as bolinhas ficavam amontoadas, o 4-4-2 não se lia como 4 + 4 + 2 e o 4-2-3-1 parecia o 3-5-2.

- **Mesma geometria do campo da Escalação.** Cada vaga é uma bolinha no centro da sua área em `PITCH_LAYOUT` (um campo de 8 × 10 células), para as duas telas nunca discordarem.
- **Linhas do nome.** Um traço liga as bolinhas de cada linha que o nome da formação diz, da esquerda para a direita (`PITCH_LINES`: 4-2-3-1 tem as linhas 4, 2, 3 e 1; 3-5-2 tem 3, 5 e 2). Assim o 4-2-3-1 mostra duas linhas no meio e o 3-5-2 uma linha de 5 em "W". O goleiro não entra em linha nenhuma. Testado em `pitch-layout.test.ts`: os tamanhos batem com o nome, cada jogador de linha está numa linha só e cada linha corre da esquerda para a direita.
- **Campo de referência.** Fundo `pitch`; borda, linha do meio, círculo central e as duas grandes áreas em `pitch-line`, finos e apagados (traço de 1px, 45% de opacidade), por baixo dos traços dos jogadores (2px, `pitch-line` cheio).
- **Direção do ataque.** O goleiro é a bolinha `floodlight` embaixo, com contorno `on-floodlight`; uma seta em `ink-muted`, acima do campo, aponta o ataque, como no campo da Escalação (gol embaixo, ataque em cima).
- **Jogadores** em `ink` com contorno `pitch`, que separa a bolinha do traço. Funciona nos temas noite (bolinha clara) e dia (bolinha escura sobre o verde, traço quase branco).
- **Tamanho:** 72px de largura (`touch + space-6 + space-1`) e cerca de 98px de altura, também a 360px; os traços não mudam de espessura com o desenho (`vector-effect: non-scaling-stroke`).
- **Leitor de tela:** a miniatura é um `svg` com `aria-hidden="true"` e `focusable="false"`; o rádio tem o nome da formação como rótulo e a frase de efeito como descrição.
- **Movimento:** nenhum. Escolher uma carta só muda a borda e a marca de "check".

## Trocar a formação

- Os 11 titulares continuam os mesmos e são redistribuídos **pela posição de cada um** (US-018): quem joga numa posição que existe na formação nova fica nela; quem sobra vai para as vagas livres pelo melhor rendimento. A regra é a de "Troca de formação durante o jogo" (partida.md), aplicada antes do jogo, e mora no motor (ver [funcoes.md](funcoes.md#pedidos-ao-motor)). O banco e as listas de funções não mudam.
- Depois da troca, a força mostra a mudança, os avisos listam quem ficou fora de posição, e uma mensagem na região viva da tela resume: "Formação 4-3-3. Ataque 67, subiu 3. 1 jogador fora de posição."
- Trocar para a formação atual não muda nada.
- O campo com os 11 redistribuídos está na Escalação (o critério da US-018 "o campo mostra 4-3-3 com os mesmos 11" se confere lá). Não há uma segunda prévia de campo nesta tela (decisão 2 do CEO, aprovada em 2026-11-07).

## Posição secundária

Decisão do CEO de 2026-11-08 (especificado na T-080; entra com a T-079). A regra está em [posicao-secundaria.md](../posicao-secundaria.md).

- **"Nesta formação" não muda:** lista só fora de posição e improvisados (e vaga livre e inaptos). Quem a troca de formação põe na posição secundária não aparece: é uma boa escolha, não um problema.
- **A mensagem da região viva** ("Formação 4-3-3. Ataque 67, subiu 3. 1 jogador fora de posição.") não conta a secundária.
- **A marca na vaga** (`secondary`, neutra, com ícone e texto) aparece na Escalação, onde está o campo ([escalacao.md](escalacao.md#posição-secundária)). A Tática não tem campo.
- **Força:** sem mudança de tela; o número já conta o `fit` de 0,95.
- **Folhas de funções (RoleEditor):** sem mudança. Capitão e cobradores não dependem da posição.

Medida para o E2E (T-079): com a fixture da Escalação (o volante com secundária ZAG na vaga de ZAG), "Nesta formação" não tem linha com o nome dele.

## Ao alcance do polegar

Postura, pressão e funções, as escolhas mais frequentes, ficam na metade de baixo depois da rolagem; a formação, que muda pouco, fica em cima. Cada carta é inteira tocável.

## Estados

| Estado                      | O que aparece                                                                                                                                                                                         |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Carregando**              | Skeleton `card` × 3 com `tactic.loading`, só depois de 300 ms.                                                                                                                                        |
| **Primeira vez**            | Formação, postura e pressão vêm da sugestão do motor para o técnico (perfil Tradicional, ia-clubes.md); as listas de funções vêm vazias, com "Automático" (decisão 5 do CEO, aprovada em 2026-11-07). |
| **Vazio**                   | Não existe: sempre há uma formação, uma postura e uma pressão escolhidas.                                                                                                                             |
| **Lista de função vazia**   | A linha mostra "Automático: {nome}", o titular que a regra escolhe agora.                                                                                                                             |
| **Escalação incompleta**    | A Tática funciona igual; "Nesta formação" mostra também os avisos de vaga livre e inaptos; "Automático" lê só os titulares que existem. Sem nenhum titular, "Automático: ninguém em campo".           |
| **Erro**                    | Fronteira da aba: ErrorState `area`; a tática salva fica como estava.                                                                                                                                 |
| **Completo e Simplificado** | Iguais. A frase da pressão alta fala de cansaço e cartões, que valem dentro do jogo nos dois modos (partida.md, "Realismo simplificado").                                                             |
| **Offline**                 | Nada muda.                                                                                                                                                                                            |

## Celular deitado (844×390) e desktop

- **Deitado:** formação em três colunas (o grupo passa de 480px); postura e pressão em uma coluna (o OptionGroup só põe lado a lado a partir de 900px). A página rola.
- **Desktop:** coluna normal (`layout-content-max`), formação em três colunas, postura e pressão com as três cartas lado a lado. As folhas de funções abrem como diálogo ancorado pela base (BottomSheet da T-025).

## Movimento

Nenhum além do da barra de força (0,2 s, zerado com `prefers-reduced-motion`). Escolher uma carta só troca a marcação.

## Acessibilidade

- Cada grupo é um `fieldset` de rádios com `legend` visível (Formação, Postura, Pressão); as setas do teclado trocam a opção; a frase de efeito é a descrição (`aria-describedby`) de cada rádio.
- Selecionado com o ícone de marcado e borda `grass`, além do fundo; nunca só cor.
- O desenho pequeno de cada formação é `aria-hidden`; o nome "4-3-3" e a frase dizem tudo.
- Cada carta e cada LinkRow tem ≥ 44px; a carta inteira é o alvo.
- Região viva (educada) com a mensagem depois da troca de formação; a postura e a pressão não precisam de mensagem (o rádio já anuncia a escolha).

## Componentes

SegmentedControl, FormationPicker, StrengthBars, LineupIssues, OptionGroup, LinkRow, BottomSheet, RoleEditor, Skeleton, ErrorState. Casca em [componentes.md](componentes.md#casca-da-t-029-escalação-tática-e-funções).

## Textos (chaves)

Rascunho pt-BR para o `content-writer`, em `ui.json`. As frases de efeito são as do PROJETO e de partida.md ("Táticas"), em linguagem de torcedor e sem número. O nome da formação ("4-3-3") também vem do conteúdo, para o caso de algum idioma escrever diferente.

| Chave                             | Rascunho pt-BR                                            | Onde                               |
| --------------------------------- | --------------------------------------------------------- | ---------------------------------- |
| `tactic.loading`                  | Carregando a tática...                                    | Skeleton                           |
| `tactic.formation.legend`         | Formação                                                  | legenda                            |
| `tactic.formation.note`           | Os 11 titulares mudam de lugar pela posição de cada um.   | nota da legenda                    |
| `tactic.formation.4-4-2`          | 4-4-2                                                     | nome                               |
| `tactic.formation.4-4-2.effect`   | Equilíbrio: quatro atrás, quatro no meio, dois na frente. | frase                              |
| `tactic.formation.4-3-3`          | 4-3-3                                                     | nome                               |
| `tactic.formation.4-3-3.effect`   | Três na frente; o meio perde um pouco.                    | frase                              |
| `tactic.formation.4-2-3-1`        | 4-2-3-1                                                   | nome                               |
| `tactic.formation.4-2-3-1.effect` | Meio forte, com um atacante só.                           | frase                              |
| `tactic.formation.3-5-2`          | 3-5-2                                                     | nome                               |
| `tactic.formation.3-5-2.effect`   | Meio cheio, com alas; três atrás.                         | frase                              |
| `tactic.formation.3-4-3`          | 3-4-3                                                     | nome                               |
| `tactic.formation.3-4-3.effect`   | Ataque com três; a defesa fica exposta.                   | frase                              |
| `tactic.formation.5-3-2`          | 5-3-2                                                     | nome                               |
| `tactic.formation.5-3-2.effect`   | Cinco atrás; meio e ataque perdem um pouco.               | frase                              |
| `tactic.formation.changed`        | Formação {formation}.                                     | região viva, início da mensagem    |
| `tactic.formation.out.one`        | {count} jogador fora de posição.                          | região viva, fim da mensagem       |
| `tactic.formation.out.other`      | {count} jogadores fora de posição.                        | região viva                        |
| `tactic.issues.title`             | Nesta formação                                            | título dos avisos                  |
| `tactic.posture.legend`           | Postura                                                   | legenda                            |
| `tactic.posture.defensive`        | Defensiva                                                 | carta                              |
| `tactic.posture.defensive.effect` | Cria menos chances e sofre menos.                         | frase                              |
| `tactic.posture.balanced`         | Equilibrada                                               | carta                              |
| `tactic.posture.balanced.effect`  | O ponto de partida: nem mais, nem menos.                  | frase                              |
| `tactic.posture.attacking`        | Ofensiva                                                  | carta                              |
| `tactic.posture.attacking.effect` | Cria mais chances e sofre mais.                           | frase                              |
| `tactic.pressure.legend`          | Pressão                                                   | legenda                            |
| `tactic.pressure.low`             | Baixa                                                     | carta                              |
| `tactic.pressure.low.effect`      | Recupera menos bolas, cansa menos e leva menos cartões.   | frase                              |
| `tactic.pressure.medium`          | Média                                                     | carta                              |
| `tactic.pressure.medium.effect`   | O ponto de partida.                                       | frase                              |
| `tactic.pressure.high`            | Alta                                                      | carta                              |
| `tactic.pressure.high.effect`     | Recupera mais bolas, cansa mais e leva mais cartões.      | frase                              |
| `tactic.roles.title`              | Funções                                                   | título                             |
| `tactic.roles.list`               | {names}                                                   | valor da linha (nomes com vírgula) |
| `tactic.roles.auto`               | Automático: {name}                                        | valor da linha, lista vazia        |
| `tactic.roles.none`               | Automático: ninguém em campo                              | valor, sem titulares               |

Os rótulos das funções (Capitão, Pênaltis, Faltas) e o resto das folhas estão em [funcoes.md](funcoes.md#textos-chaves).

## Medidas para o E2E

1. **Formação (US-018):** com a fixture em 4-4-2, escolher 4-3-3 marca a carta (`checked`); na Escalação, o grupo vira "Campo, formação 4-3-3" com os **mesmos 11 nomes** de antes (como conjunto) e as vagas na ordem do 4-3-3; o banco não muda.
2. **Postura e pressão salvas (US-018, "tática é salva para a rodada"):** escolher Ofensiva e Alta, recarregar a página: as duas continuam marcadas. Teste de integração (não E2E): a ficha que a camada de carreira entrega ao `playRound` tem `posture: 'attacking'` e `pressure: 'high'`.
3. **Sem "tudo no ataque"** nesta tela: a Postura tem exatamente 3 opções.
4. **Alvos:** cada carta de formação, postura e pressão e cada linha de função tem ≥ 44px; o grupo de formação tem 2 colunas a 390px e 3 a 1280px (`x` das cartas).
5. **Teclado:** com o foco num rádio de Postura, seta para baixo troca a escolha (o rádio seguinte fica `checked`).
6. **Sem rolagem lateral** em 360, 390, 844 e 1280.
7. **Funções:** com as listas vazias, as três linhas mostram "Automático:" e um nome; ver [funcoes.md](funcoes.md#medidas-para-o-e2e).

## Marcas do cenário

Nenhuma.
