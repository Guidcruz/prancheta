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

Título da folha: o nome que a linha do Elenco mostra (`Player.name.display`, que pode ser um apelido), para o atleta ser o mesmo que o técnico tocou. Logo abaixo, no corpo, em `caption` e `ink-muted`, o nome completo (`Player.name.full`), só quando ele difere do `display` (comparação sem acento, sem caixa, sem hífen e sem espaços repetidos; iguais, a linha não aparece). O leitor de tela ouve o `display` como nome do diálogo e o nome completo uma vez, no corpo. Decisão do CEO, 2026-11-07 (antes o título era o nome completo e, com apelido, o card parecia de outro jogador). Depois, o PlayerCard `full`:

1. **Cabeçalho:** Avatar `xl` (96px, do gerador da T-027, camisa na 1ª cor do clube); posição com a sigla na caixinha da cor do setor (PositionTag, a mesma do Elenco) e por extenso ("MEI Meia"); idade e camisa ("23 anos · Camisa 9"); nota geral em `titulo` com o rótulo "Nota geral".
2. **Selos** (se houver): "Lesionado, 3 rodadas", "Suspenso, 1 jogo" (`status.suspended.one/.other`), "Promessa", com ícone e texto.
3. **Como está:** Condição (0 a 100; só no Completo), Moral (0 a 100) e Forma (média das últimas 5 notas, uma casa decimal; "Sem jogos ainda" quando não há), cada uma com rótulo, número e barra (AttributeBar). O número ganha a cor da faixa (boa, regular, ruim), com as mesmas faixas e tokens do Elenco ([elenco.md](elenco.md#cores-por-faixa)); a barra continua em `ink-muted`. "Sem jogos ainda" fica sem cor. A nota geral não tem cor; os atributos têm a regra própria do item 4.
4. **Atributos:** os 6 da posição natural, na ordem de `jogadores.md` (linha: velocidade, técnica, passe, finalização, marcação, físico; goleiro: reflexos, posicionamento, jogo aéreo, saída do gol, reposição, físico), cada um com rótulo, número de 1 a 99 e barra. O número ganha cor quando é ponto forte ou ponto fraco do jogador (ver "Pontos fortes e fracos", abaixo); a barra continua em `ink-muted`.
5. **Personalidade:** nome do traço e uma frase do que ele faz no jogo (do conteúdo).
6. **Na temporada:** Jogos e Gols de `seasonStats` (0 e 0 quando não jogou; a seção nunca some).
7. **Pé fixo** (fora do corpo que rola): "Anterior" e "Próximo" (Button `secondary`, lado a lado, 50% cada).

### Pontos fortes e fracos

Aprovado pelo CEO em 2026-11-07 (regra geral em [design-system.md](../design-system.md#pontos-fortes-e-fracos-dos-atributos-aprovado-pelo-ceo-em-2026-11-07)). A cor do atributo é **relativa à nota geral do próprio jogador**, não uma escala fixa: o card diz no que ele é bom, qualquer que seja o nível do clube.

| Estado      | Regra                                  | Cor          | Leitor de tela                 |
| ----------- | -------------------------------------- | ------------ | ------------------------------ |
| Ponto forte | atributo ≥ nota geral + 5              | `level-good` | "Finalização, 81, ponto forte" |
| Ponto fraco | atributo ≤ nota geral − 5              | `level-poor` | "Marcação, 30, ponto fraco"    |
| (nenhum)    | entre os dois (de nota − 4 a nota + 4) | sem cor      | "Passe, 74"                    |

- **Margem numa constante só:** `ATTRIBUTE_MARGIN = 5` em `app/src/ui/components/levels.ts`, lida por `attributeLevelOf(valor, nota)`, que devolve `'good'`, `'poor'` ou `undefined`. Nenhum componente escreve a margem.
- **Só dois estados:** nunca `level-fair` num atributo.
- **Goleiro:** a mesma regra, sobre os 6 atributos dele.
- **Atributo de peso 0** na posição (finalização do zagueiro, do lateral e do volante; marcação do meia e do atacante) nasce cerca de 20 pontos abaixo da nota ([jogadores.md](../jogadores.md), "Geração") e aparece quase sempre como ponto fraco. Aceito pelo CEO: é a verdade do jogador.
- **Exemplo** (o atacante de `jogadores.md`, nota 76): velocidade 80 e finalização 81 são pontos fortes; técnica 72 e físico 70 ficam sem cor; passe 60 e marcação 30 são pontos fracos.
- **Leitura:** o número visível fica `aria-hidden` e o texto escondido usa `level.reading` com a palavra do estado ("81, ponto forte"); sem estado, sem `srText`, e o leitor lê só o número.

### Posição secundária

Decisão do CEO de 2026-11-08 (especificado na T-080; entra com a T-081). A regra está em [posicao-secundaria.md](../posicao-secundaria.md).

- **Onde:** um bloco logo abaixo do cabeçalho, antes dos selos, com a largura toda, só quando o jogador tem secundária. É um `dl` com um par: o `dt` é `player.secondaryPosition` ("Posição secundária", rascunho), em `caption` e `ink-muted`; o `dd` tem a sigla na PositionTag `size="sm"` neutra (sem `sector`, `hidden`) e a posição por extenso (`position.<P>`, "Volante") em `body-strong`. O `dt` e o `dd` ficam na mesma linha, com `flex-wrap`: em es e en, a 360px, o `dd` desce para a linha de baixo sem rolar.
- **Embaixo do par:** `player.secondaryPosition.hint`, em `caption` e `ink-muted`. É uma frase curta sobre o que é a posição secundária e sobre ele render um pouco menos ali que na natural.
- **Por que fora da coluna do cabeçalho:** a 360px, a coluna ao lado do avatar tem cerca de 200px. "Posição secundária" mais a sigla e o nome já quebrariam ali, e duas linhas a mais deixariam o cabeçalho mais alto que o avatar.
- **A sigla secundária é neutra**, como no Elenco ([elenco.md](elenco.md#posição-secundária)): a cor do setor fica só na sigla natural do cabeçalho.
- **Sem secundária, e sempre no goleiro:** o bloco não existe (nem "—").
- **Nenhum número calculado:** a tela não lê `SECONDARY_FIT` nem `fit` (ADR-0022: ler em `ui/` é BLOCKER, e `fit` não está no contrato), então "rende ~N" não entra. Se a ajuda citar "95%", o número é texto fixo do conteúdo (ver "Decisões pendentes", na T-080, em [componentes.md](componentes.md#casca-da-t-080-posição-secundária)).
- **Atributos e nota:** continuam os da posição natural; nada muda nas seções de baixo.
- **Duas colunas (folha ≥ 480px):** o bloco fica acima da grade, com a largura toda, como os selos.
- **Leitor de tela:** "Posição secundária, Volante", depois a frase de ajuda. A sigla é `aria-hidden`.
- **Contraste:** `ink-muted` e `ink` sobre `surface-1`, pares já conferidos.

Textos: `player.secondaryPosition` (rótulo, `dt`) e `player.secondaryPosition.hint` (ajuda curta).

Medidas para o E2E (T-081):

1. No card de um volante forçado com secundária ZAG, há um `dt` com o texto de `player.secondaryPosition`, e o `dd` dele tem "Zagueiro" e uma caixinha `aria-hidden` sem classe `sector-*`. A frase de `player.secondaryPosition.hint` está visível.
2. No card de um jogador sem secundária e no de um goleiro, não há `dt` com esse texto.
3. A 360×740 e a 844×390, nos três idiomas, o card não rola na horizontal (`scrollWidth <= clientWidth` no corpo da folha). O `dd` fica inteiro dentro da folha.
4. A sigla do cabeçalho continua com a classe de setor da posição natural (medida 12).

Sem contrato, salário, valor nem potencial na 1a. Não há botão primário: a folha é de leitura, e o primário da tela continua sendo o "Jogar rodada" que fica por baixo.

## Ao alcance do polegar

Os botões "Anterior" e "Próximo" ficam no pé da folha, no alcance do polegar, e trocam o atleta sem precisar fechar e abrir de novo. Fechar: gesto de voltar, toque no fundo ou o X do cabeçalho (este último fica em cima, é o caminho menos usado).

## Estados

| Estado                    | O que aparece                                                                                                                                                                                                                                                                                               |
| ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Carregando**            | Não há espera: o jogador já está na memória. Se um dia houver, Skeleton dentro do corpo, com `player.loading`.                                                                                                                                                                                              |
| **Erro**                  | Jogador que não está mais no elenco (id inválido no histórico) ou erro ao montar o card: o título da folha vira "Jogador" (`squad.col.player`), o corpo mostra o ErrorState `block` com `player.error.title` e `player.error.body`, "Anterior" e "Próximo" ficam desabilitados, e a folha continua com o X. |
| **Vazio**                 | Temporada sem jogos: Jogos 0, Gols 0; Forma "Sem jogos ainda".                                                                                                                                                                                                                                              |
| **Realismo completo**     | Como descrito.                                                                                                                                                                                                                                                                                              |
| **Realismo simplificado** | Sem a linha "Condição" (sempre 100 entre as rodadas) e nunca com selo de lesão ou suspensão. O resto igual.                                                                                                                                                                                                 |
| **Offline**               | Nada muda.                                                                                                                                                                                                                                                                                                  |

## Celular deitado e desktop

- A folha tem no máximo 85% da altura (`BottomSheet`): título, X e o pé ficam sempre visíveis; só o corpo rola. No celular deitado (844×390), sobram cerca de 200px de corpo, e ele rola.
- Quando a folha passa de 480px de largura (celular deitado, 720px; diálogo do desktop, 540px), "Como está" e "Atributos" ficam lado a lado, e "Personalidade" e "Na temporada" na linha de baixo (consulta de contêiner, não da tela).

## Componentes

BottomSheet, PlayerCard (`full`), Avatar, PositionTag, AttributeBar, StatusBadge, Button, ErrorState. Casca em [componentes.md](componentes.md#casca-da-t-028-clube-elenco-e-jogador).

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

As faixas dos estados usam `level.good`, `level.fair`, `level.poor` e `level.reading` ("82, boa"), as mesmas do Elenco ([elenco.md](elenco.md#textos-chaves)).

Os pontos fortes e fracos dos atributos usam duas chaves novas, **com textos aprovados pelo CEO em 2026-11-07**. Entram em `app/src/content/<idioma>/ui.json` pelo `developer`, na mesma branch da casca.

| Chave               | pt-BR       | es           | en           | Onde                                                      |
| ------------------- | ----------- | ------------ | ------------ | --------------------------------------------------------- |
| `attr.level.strong` | ponto forte | punto fuerte | strong point | estado do atributo, para leitor de tela (`level.reading`) |
| `attr.level.weak`   | ponto fraco | punto débil  | weak point   | estado do atributo, para leitor de tela                   |

A leitura é `level.reading` ("{value}, {level}"), igual nos três: "81, ponto forte", "81, punto fuerte", "81, strong point".

## Acessibilidade

- **Diálogo modal nativo:** foco preso na folha; Esc fecha; o foco entra no X (o padrão do BottomSheet, aprovado na T-025; muda o rascunho do kickoff, que punha o foco no nome) e o título da folha, que é o nome, é anunciado como nome do diálogo. Ao fechar, o foco volta ao botão do nome da linha de origem, também quando o card foi aberto por um toque em outro ponto da linha (a tela guarda o botão de origem; ver [elenco.md](elenco.md#acessibilidade)).
- **Ao trocar de atleta** com "Anterior"/"Próximo", o foco fica no botão tocado, e o novo nome (`display`) é anunciado por um texto escondido com `aria-live="polite"` no pé da folha, junto dos botões (o título do diálogo não é relido ao mudar). Se o botão tocado ficar desabilitado (chegou ao primeiro ou ao último), o foco passa para o outro botão do pé.
- **Estrutura:** título da folha `h2`; seções em `h3`; estados e atributos em `dl` (rótulo `dt`, número `dd`); as barras são `aria-hidden`.
- **Nunca só cor:** selos com ícone e texto; as barras não carregam informação que o número não tenha. Nos estados com faixa, o número visível é `aria-hidden` e o texto escondido lê "Condição, 82, boa" (o `dt` e depois `level.reading`); nos atributos com ponto forte ou fraco, "Finalização, 81, ponto forte". A sigla da posição tem o código escrito e é `aria-hidden` no card (a posição por extenso está ao lado); a cor do setor só reforça.
- **Anel de foco só para o teclado:** aberto por toque, o X recebe o foco sem anel; aberto pelo teclado, com anel ([design-system.md](../design-system.md#foco-anel-só-para-o-teclado-pedido-do-ceo-em-2026-11-07)). O lugar do foco não muda.
- **Avatar** decorativo (o nome está no título); gerado, nunca foto.
- **Alvos ≥ 44px:** X, "Anterior", "Próximo"; botão desabilitado explica-se pela posição na lista (primeiro ou último), o que é óbvio, então não leva texto extra.
- **Movimento:** a folha aparece sem animação (BottomSheet); nada a reduzir.
- **Contraste:** `ink` e `ink-muted` sobre `surface-1`; `level-good`, `level-fair` e `level-poor` sobre `surface-1` (≥ 5,6:1 nos dois temas); `ink` sobre os `sector-*-soft` (≥ 10:1); barras em `ink-muted` sobre `surface-2` são reforço.

## Medidas para o E2E

1. **Detalhe (US-016):** tocar num atleta abre um `dialog` com o mesmo nome da linha no título (`display`) e, quando o nome completo é diferente, ele logo abaixo, 6 linhas de atributo com números de 1 a 99, o nome do traço e os números de Jogos e Gols.
2. **Histórico:** `history.length` cresce 1 ao abrir; o voltar fecha o diálogo e mantém `#/squad`; "Próximo" não cresce o histórico.
3. **Foco:** ao abrir, `document.activeElement` é o X; ao fechar com Esc, é o botão do nome da linha de origem, tanto abrindo pelo botão quanto por um toque em outra célula da linha.
4. **Pé visível:** no celular em pé (390×844), deitado (844×390) e no desktop (1280×800), o X e os dois botões do pé estão inteiros dentro da janela, e o corpo rola (`scrollHeight > clientHeight` no deitado).
5. **Primeiro e último:** no primeiro atleta da lista, "Anterior" está desabilitado; no último, "Próximo".
6. **Simplificado:** sem a linha "Condição".
7. **Alvos ≥ 44px** e **sem animação** com `reducedMotion: 'reduce'` (`document.getAnimations().length === 0`).
8. **Avatar:** um `svg` dentro do cabeçalho do card, sem `<text>` e sem `<image>`.
9. **Faixas:** o número de cada estado tem a classe da faixa de `levelOf` sobre o valor mostrado e o texto escondido de `level.reading`; a nota geral não tem classe `level-*`.
10. **Anel:** aberto por toque, o X está focado com `outline-style: none`; aberto pelo teclado, `solid` (ver [elenco.md](elenco.md#medidas-para-o-e2e), medida 11).
11. **Pontos fortes e fracos:** num atacante e num goleiro forçados na fixture, os 6 atributos seguem o padrão forte, forte, perto, fraco, perto, perto (na ordem de `attributeKeysFor`). Os valores são achados por busca: o save recusa uma nota diferente da fórmula, então o teste varia os atributos e usa a nota exata que o save aceita (a do `validatePlayer`), até as diferenças para a nota darem esse padrão nos pesos da posição. Os números fortes têm `level-good` e o texto escondido "N, ponto forte"; o fraco, `level-poor` e "N, ponto fraco"; os de perto não têm classe nem texto escondido; nenhum atributo tem `level-fair`; a cor computada é a do token, nos dois temas. Os valores exatos da regra (nota 70; atributos 75, 74, 66 e 65 dão forte, nenhum, nenhum e fraco) ficam no teste unitário de `attributeLevelOf` (`app/src/ui/components/levels.test.ts`).
12. **Sigla no cabeçalho:** o card tem a caixinha da posição com a classe de setor de `SECTOR_OF` e `aria-hidden="true"`.

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

## Decisões do CEO (cores de atributos e posição)

Aprovadas pelo CEO em 2026-11-07, todas pela recomendação do `ux-designer`. Valem para o Elenco, o card e, quando entrar, a Escalação.

1. **Atributos com cor relativa à nota do próprio jogador,** com `ATTRIBUTE_MARGIN = 5`. Só dois estados: ponto forte (`level-good`) e ponto fraco (`level-poor`); o resto fica sem cor. A mesma regra vale para o goleiro. O atributo de peso 0 aparecer sempre como ponto fraco é aceito.
2. **Posição com a cor do setor,** só no fundo e na borda da sigla, com o texto em `ink`: 8 tokens `sector-*` (borda e fundo de goleiro, defesa, meio e ataque) e o componente `PositionTag`.
3. **A nota geral continua sem cor.**
4. **Regra nova do design system:** a cor de faixa só pinta números, e a cor de setor só pinta o fundo da sigla ([design-system.md](../design-system.md#onde-cada-cor-pinta-aprovado-pelo-ceo-em-2026-11-07)).
