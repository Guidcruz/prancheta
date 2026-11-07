# Jogador (card completo)

**Histórias:** US-016 · **Prioridade:** Must · **Ordem:** 6 · **Tarefa:** T-028

## Objetivo

Mostrar tudo o que o técnico precisa saber de um atleta antes de escalá-lo.

## O que o jogador faz

Lê o card, passa para o atleta anterior ou o próximo da lista sem fechar, e fecha (voltar do celular, fundo, Esc ou o X).

## Navegação

- Abre do Elenco (e, na T-029, da Escalação) como BottomSheet, com entrada própria no histórico: o voltar do celular fecha a folha. "Anterior" e "Próximo" trocam o atleta na mesma entrada (`history.replaceState`), para o voltar não percorrer o elenco inteiro.
- "Anterior" e "Próximo" seguem a ordem da lista que abriu o card (a ordenação atual do Elenco). No primeiro atleta, "Anterior" fica desabilitado; no último, "Próximo". Nunca dá a volta.
- No desktop, o mesmo BottomSheet vira o diálogo flutuante ancorado pela base (T-025), com 540px de largura. Não é painel lateral (decisão do CEO, 2026-11-07).

## Conteúdo (corpo da folha, de cima para baixo)

Título da folha: o nome completo (`Player.name.full`). Depois, o PlayerCard `full`:

1. **Cabeçalho:** Avatar `xl` (96px, do gerador da T-027, camisa na 1ª cor do clube); posição por extenso ("Meia"); idade e camisa ("23 anos · Camisa 9"); nota geral em `titulo` com o rótulo "Nota geral".
2. **Selos** (se houver): "Lesionado, 3 rodadas", "Suspenso", "Promessa", com ícone e texto.
3. **Como está:** Condição (0 a 100; só no Completo), Moral (0 a 100) e Forma (média das últimas 5 notas, uma casa decimal; "Sem jogos ainda" quando não há), cada uma com rótulo, número e barra (AttributeBar).
4. **Atributos:** os 6 da posição natural, na ordem de `jogadores.md` (linha: velocidade, técnica, passe, finalização, marcação, físico; goleiro: reflexos, posicionamento, jogo aéreo, saída do gol, reposição, físico), cada um com rótulo, número de 1 a 99 e barra.
5. **Personalidade:** nome do traço e uma frase do que ele faz no jogo (do conteúdo).
6. **Na temporada:** Jogos e Gols de `seasonStats` (0 e 0 quando não jogou; a seção nunca some).
7. **Pé fixo** (fora do corpo que rola): "Anterior" e "Próximo" (Button `secondary`, lado a lado, 50% cada).

Sem contrato, salário, valor nem potencial na 1a. Não há botão primário: a folha é de leitura, e o primário da tela continua sendo o "Jogar rodada" que fica por baixo.

## Ao alcance do polegar

Os botões "Anterior" e "Próximo" ficam no pé da folha, no alcance do polegar, e trocam o atleta sem precisar fechar e abrir de novo. Fechar: gesto de voltar, toque no fundo ou o X do cabeçalho (este último fica em cima, é o caminho menos usado).

## Estados

| Estado                    | O que aparece                                                                                                                                                                                          |
| ------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Carregando**            | Não há espera: o jogador já está na memória. Se um dia houver, Skeleton dentro do corpo, com `player.loading`.                                                                                         |
| **Erro**                  | Jogador que não está mais no elenco (id inválido no histórico) ou erro ao montar o card: ErrorState `block` dentro da folha, com `player.error.title` e `player.error.body`; a folha continua com o X. |
| **Vazio**                 | Temporada sem jogos: Jogos 0, Gols 0; Forma "Sem jogos ainda".                                                                                                                                         |
| **Realismo completo**     | Como descrito.                                                                                                                                                                                         |
| **Realismo simplificado** | Sem a linha "Condição" (sempre 100 entre as rodadas) e nunca com selo de lesão ou suspensão. O resto igual.                                                                                            |
| **Offline**               | Nada muda.                                                                                                                                                                                             |

## Celular deitado e desktop

- A folha tem no máximo 85% da altura (`BottomSheet`): título, X e o pé ficam sempre visíveis; só o corpo rola. No celular deitado (844×390), sobram cerca de 200px de corpo, e ele rola.
- Quando a folha passa de 480px de largura (celular deitado, 720px; diálogo do desktop, 540px), "Como está" e "Atributos" ficam lado a lado, e "Personalidade" e "Na temporada" na linha de baixo (consulta de contêiner, não da tela).

## Componentes

BottomSheet, PlayerCard (`full`), Avatar, AttributeBar, StatusBadge, Button, ErrorState. Casca em [componentes.md](componentes.md#casca-da-t-028-clube-elenco-e-jogador).

## Textos (chaves)

Rascunho pt-BR para o `content-writer`, em `ui.json`. As frases dos traços resumem `jogadores.md`, "Traço de personalidade"; o `game-designer` confere se dizem a regra certa. `position.*` e `status.*` estão em [elenco.md](elenco.md#textos-chaves).

| Chave                     | Rascunho pt-BR                                                          | Onde                       |
| ------------------------- | ----------------------------------------------------------------------- | -------------------------- |
| `player.loading`          | Carregando o jogador...                                                 | Skeleton                   |
| `player.age.one`          | {count} ano                                                             | cabeçalho                  |
| `player.age.other`        | {count} anos                                                            | cabeçalho                  |
| `player.shirt`            | Camisa {number}                                                         | cabeçalho                  |
| `player.overall`          | Nota geral                                                              | rótulo da nota             |
| `player.states.title`     | Como está                                                               | título da seção            |
| `player.condition`        | Condição                                                                | linha                      |
| `player.morale`           | Moral                                                                   | linha                      |
| `player.form`             | Forma (últimos 5 jogos)                                                 | linha                      |
| `player.form.none`        | Sem jogos ainda                                                         | no lugar do número         |
| `player.attributes.title` | Atributos                                                               | título da seção            |
| `attr.speed`              | Velocidade                                                              | atributo                   |
| `attr.technique`          | Técnica                                                                 | atributo                   |
| `attr.passing`            | Passe                                                                   | atributo                   |
| `attr.finishing`          | Finalização                                                             | atributo                   |
| `attr.marking`            | Marcação                                                                | atributo                   |
| `attr.physical`           | Físico                                                                  | atributo (linha e goleiro) |
| `attr.reflexes`           | Reflexos                                                                | atributo do goleiro        |
| `attr.positioning`        | Posicionamento                                                          | atributo do goleiro        |
| `attr.aerial`             | Jogo aéreo                                                              | atributo do goleiro        |
| `attr.rushing`            | Saída do gol                                                            | atributo do goleiro        |
| `attr.distribution`       | Reposição                                                               | atributo do goleiro        |
| `player.trait.title`      | Personalidade                                                           | título da seção            |
| `trait.leader`            | Líder                                                                   | nome do traço              |
| `trait.leader.body`       | Como capitão, a conversa do intervalo rende o dobro.                    | frase                      |
| `trait.hothead`           | Temperamental                                                           | nome do traço              |
| `trait.hothead.body`      | Leva mais cartões, sente mais o banco e não gosta de ser cobrado.       | frase                      |
| `trait.professional`      | Profissional                                                            | nome do traço              |
| `trait.professional.body` | Sente só metade das derrotas e do banco.                                | frase                      |
| `trait.idol`              | Ídolo da torcida                                                        | nome do traço              |
| `trait.idol.body`         | A torcida quer vê-lo em campo: duas rodadas seguidas fora e ela esfria. | frase                      |
| `trait.quiet`             | Discreto                                                                | nome do traço              |
| `trait.quiet.body`        | Faz o trabalho dele sem chamar atenção.                                 | frase                      |
| `player.season.title`     | Na temporada                                                            | título da seção            |
| `player.season.games`     | Jogos                                                                   | número                     |
| `player.season.goals`     | Gols                                                                    | número                     |
| `player.prev`             | Anterior                                                                | botão do pé                |
| `player.next`             | Próximo                                                                 | botão do pé                |
| `player.error.title`      | Não deu para abrir este jogador.                                        | ErrorState                 |
| `player.error.body`       | A sua carreira não foi alterada. Feche e tente de novo.                 | ErrorState                 |

## Acessibilidade

- **Diálogo modal nativo:** foco preso na folha; Esc fecha; o foco entra no X (o padrão do BottomSheet, aprovado na T-025; muda o rascunho do kickoff, que punha o foco no nome) e o título da folha, que é o nome, é anunciado como nome do diálogo. Ao fechar, o foco volta ao botão do nome na lista.
- **Ao trocar de atleta** com "Anterior"/"Próximo", o foco fica no botão tocado e o novo nome é anunciado pelo título (o `developer` põe o título num `aria-live="polite"` só durante a troca, ou move o foco para o título; escolha dele, conferida na revisão).
- **Estrutura:** título da folha `h2`; seções em `h3`; estados e atributos em `dl` (rótulo `dt`, número `dd`); as barras são `aria-hidden`.
- **Nunca só cor:** selos com ícone e texto; as barras não carregam informação que o número não tenha.
- **Avatar** decorativo (o nome está no título); gerado, nunca foto.
- **Alvos ≥ 44px:** X, "Anterior", "Próximo"; botão desabilitado explica-se pela posição na lista (primeiro ou último), o que é óbvio, então não leva texto extra.
- **Movimento:** a folha aparece sem animação (BottomSheet); nada a reduzir.
- **Contraste:** `ink` e `ink-muted` sobre `surface-1`; barras em `ink-muted` sobre `surface-2` são reforço.

## Medidas para o E2E

1. **Detalhe (US-016):** tocar num atleta abre um `dialog` com o nome completo no título, 6 linhas de atributo com números de 1 a 99, o nome do traço e os números de Jogos e Gols.
2. **Histórico:** `history.length` cresce 1 ao abrir; o voltar fecha o diálogo e mantém `#/squad`; "Próximo" não cresce o histórico.
3. **Foco:** ao abrir, `document.activeElement` é o X; ao fechar com Esc, é o botão do nome da linha de origem.
4. **Pé visível:** no celular em pé (390×844), deitado (844×390) e no desktop (1280×800), o X e os dois botões do pé estão inteiros dentro da janela, e o corpo rola (`scrollHeight > clientHeight` no deitado).
5. **Primeiro e último:** no primeiro atleta da lista, "Anterior" está desabilitado; no último, "Próximo".
6. **Simplificado:** sem a linha "Condição".
7. **Alvos ≥ 44px** e **sem animação** com `reducedMotion: 'reduce'` (`document.getAnimations().length === 0`).
8. **Avatar:** um `svg` dentro do cabeçalho do card, sem `<text>` e sem `<image>`.

## Marcas do cenário

Nenhuma.

## Pedidos ao motor

O que a T-028 precisa e o contrato do motor (`app/src/engine/index.ts`) ainda não expõe. Cada item é pequeno e não muda o save nem o `ENGINE_VERSION`; passa pelo `architect` porque mexe no contrato (§4.1).

1. **`isProspect` no contrato.** Existe em `engine/players.ts`, mas não é exportado pelo `index.ts`. A US-016 diz que a interface recebe do motor só o booleano; sem a exportação, a tela teria de ler `potential` e repetir a regra. Pedido: exportar `isProspect` no bloco de funções do contrato.
2. **Faixa de humor do termômetro.** Não existe. As faixas estão em `torcida.md` ("Humor da rede social") e servem a duas coisas: o rótulo da tela Clube e o tom dos posts da rede social (T-035), que no online roda também no servidor. Pedido: uma lista fechada `FAN_MOODS` (`revolt`, `irritated`, `wary`, `excited`, `party`) e uma função de leitura `fanMood(fans: number): FanMood` em `engine/fans.ts`, no contrato; a casca do FanThermometer já usa esses cinco nomes e passa a importá-los do motor quando existirem.
3. **Ordem dos atributos por posição.** `attributeKeysFor(position)` (ou as listas `OUTFIELD_ATTRIBUTES` e `GOALKEEPER_ATTRIBUTES`) existe e não é exportada. Sem ela, a tela depende da ordem das chaves do objeto `attributes`. Pedido: exportar a função no contrato.
4. **Forma (opcional).** A média de `recentRatings` é uma conta de exibição simples; a tela pode fazê-la. Se o `architect` preferir uma fonte só (a súmula e o resumo da temporada também mostram forma), uma função de leitura `playerForm(player): number | undefined` no contrato.

Nada mais falta: próximo jogo, clássico, desfalques, termômetro, posição e "últimos 5" já saem de `GameState` e de `getStandings`; jogos e gols, de `seasonStats`; o rosto, de `Player.face` com `renderFace`.

## Decisões do CEO (T-028)

Aprovadas pelo CEO em 2026-11-07 ("ok recomendado"). Valem para Clube, Elenco e Jogador.

1. **Rótulo de humor = as 5 faixas de `torcida.md`:** "Em revolta" (0–19), "Irritada" (20–39), "Desconfiada" (40–59), "Animada" (60–79), "Em festa" (80–100), a mesma escala do tom dos posts da rede social. O "fria" da US-026 era só exemplo.
2. **Realismo simplificado sem condição:** a tela tira a coluna Cond. e a opção "Condição" do Elenco e a linha "Condição" do card, porque nesse modo todos voltam a 100 a cada rodada. A exceção à US-016 ("ordenar por fadiga") fica registrada pelo `product-manager` na história.
3. **Notícias e Rede social no Clube só com a T-034 e a T-035,** sem "em breve" antes disso (P3).
4. **Card do jogador no desktop como diálogo** flutuante ancorado pela base (o BottomSheet da T-025), com "Anterior" e "Próximo" no pé. Não há painel lateral.
5. **"Mais opções" no pé do Clube só abaixo de 900px;** a partir daí as entradas estão na barra lateral.
6. **Ordem do Clube:** Próximo jogo, Torcida, Classificação (no DOM e no celular; no desktop, Torcida na coluna da direita).
7. **Linha "Desfalques"** no bloco do próximo jogo, só no Realismo completo, levando ao Elenco.
8. **Sem seta de tendência no termômetro na 1a** (exigiria guardar o valor anterior no save).
