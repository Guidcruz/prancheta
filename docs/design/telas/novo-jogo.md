# Novo jogo

**Histórias:** US-014 · **Prioridade:** Must · **Ordem:** 3 · **Tarefa:** T-025

## Objetivo

Começar uma carreira em menos de um minuto: escolher o clube e tocar "Começar".

## O que o jogador faz

Escolhe um dos 20 clubes e toca "Começar". Se quiser, abre "Alterar" e muda o apelido do técnico, o realismo e o tipo de partida.

## Fluxo: passo único

Uma tela só, sem etapas: clube na lista, opções já preenchidas num resumo, "Começar" fixo embaixo. Quem quer só jogar escolhe o clube e toca "Começar" (dois toques); quem quer ajustar abre a folha de opções. Etapas ("1 de 3") fariam o caminho padrão mais longo para esconder três escolhas que já têm valor.

## Conteúdo (de cima para baixo)

1. **ScreenHeader** "Nova carreira" com voltar ao Início (o voltar do celular também volta).
2. **Resumo das opções** (OptionsSummary): uma carta tocável com "Opções da carreira", os três valores atuais (Técnico, Realismo, Partida) e "Alterar". Abre a folha de opções.
3. **Escolha do clube** (ClubPicker), em três grupos pela força, cada um com o título em `rotulo`:
   - "Favoritos" (1º a 6º em força), "Meio de tabela" (7º a 14º), "Luta contra a queda" (15º a 20º), a regra de `docs/design/temporada.md`, "Força e dificuldade na escolha do clube".
   - Dentro do grupo, da maior força para a menor; empate pelo `id`.
   - Cada clube (ClubOption): escudo `md`, nome curto, cidade e estado em `caption` ("Curitiba (PR)"), e à direita "Força" em `caption` com o número em `numero` (`tabular-nums`). O número é o `strength` da lista de clubes, o mesmo que o `game-designer` define para esta tela. O rótulo da faixa vem do título do grupo e entra no nome acessível de cada clube.
   - Frase sob o título: "A dificuldade de verdade é o clube: quanto menor a força, maior o desafio." (PROJETO, "Novo jogo").
   - Sem busca nem filtro: 20 clubes em três grupos cabem numa rolagem, e a ordem por força já é o filtro que importa. Busca entra quando houver Série B (Etapa 2).
4. **Barra fixa** (ActionBar) embaixo: o clube escolhido (escudo `sm`, nome, "Força 74 · Favorito") e "Começar" (primário). Sem clube: "Escolha um clube para começar." e "Começar" desabilitado, ligado a essa frase por `aria-describedby`.

Ritmo, competições, estilo, início desempregado, técnico livre, áudio e backup na nuvem não aparecem (decisão P3: nem desabilitados, nem com "em breve").

### Folha "Opções da carreira"

BottomSheet (diálogo centrado no desktop) com:

1. **Apelido do técnico** (TextField): rótulo visível, a frase "Fica só neste aparelho e no arquivo de backup.", contador "16/24" à direita e o erro em texto embaixo. Teclado com a primeira letra maiúscula, sem corretor (`autocapitalize="words"`, `spellcheck="false"`, `autocomplete="off"`), tecla de confirmar "Concluído" (`enterkeyhint="done"`) que fecha o teclado.
2. **Realismo** (OptionGroup, 2 cartas): Completo / Simplificado, cada um com a frase de efeito; nota "Não dá para mudar depois de começar." (decisão do CEO na US-014).
3. **Partida** (OptionGroup, 3 cartas, uma coluna também no desktop): Animada completa / Só lances principais / Só resultado, com a frase de efeito; nota "Dá para trocar depois, nas Preferências ou antes de cada rodada." Enquanto só houver uma opção (antes da T-031/T-032, só "Só resultado"; ver "Decisões para o CEO", item 3), a nota fica escondida: falar em trocar sem ter para o que trocar promete o que não existe (P3).
4. **Pronto** (secundário, largura toda): fecha a folha. As mudanças valem na hora; fechar pelo X, Esc, toque fora ou voltar tem o mesmo efeito que "Pronto".

### Regras do apelido

- A regra é a do `checkCoachName` (`app/src/lib/career/coach-name.ts`): NFC, sem espaços nas pontas, não vazio, até `COACH_NAME_MAX` pontos de código, e `isSafeDisplayText`.
- **Limite: 24.** Proposta para fechar o provisório (ver "Decisões para o CEO"). A tela conta pontos de código depois do NFC e do `trim`, igual à regra; o campo não usa `maxlength` nativo (conta unidades UTF-16 e cortaria emoji ao meio), então o jogador pode digitar além e lê por que "Começar" não anda.
- Mensagem por problema, sempre em texto sob o campo (`aria-describedby`, `role="alert"`): `empty` e só espaços, `too-long`, `unsafe`. A mesma situação aparece no resumo ("O apelido do técnico precisa de ajuste.", com borda `danger` e ícone) e desabilita "Começar", com a frase da barra trocada por `newGame.bar.invalidName`.
- O erro aparece ao sair do campo ou ao tentar fechar a folha, não a cada letra; o contador acompanha a digitação e passa a `ink` acima do limite.
- Padrão: `career.coachDefault` ("Técnico") do idioma atual.

### Última configuração

- Ao tocar "Começar" e a carreira ser criada, a tela grava no `kv` do save a chave `newGame.last` com `{ realism, matchMode }`. Na próxima vez, a folha vem com esses valores. Sem a chave (primeira vez) ou com valor inválido: os padrões abaixo.
- **O clube não é lembrado**: cada carreira nova costuma ser outro clube, e um clube já marcado levaria a "Começar" sem escolher.
- **O apelido não entra** na última configuração (recomendação; ver "Decisões para o CEO"): ele já fica em cada save; uma cópia no `kv` sobreviveria a apagar todas as carreiras, e o jogador que apaga tudo espera que o apelido vá junto. O padrão continua sendo `career.coachDefault`.
- Padrões da primeira vez: realismo **Completo** (o "padrão recomendado" de `partida.md`); partida **Animada completa** (a vitrine do jogo; quem quer rapidez troca uma vez e fica lembrado).
- Falha ao gravar o `kv`: ignorada em silêncio (a carreira já está criada; registra no log local sem dados pessoais).

## Ao alcance do polegar

"Começar" fixo embaixo, à direita, com o clube escolhido ao lado; a lista de clubes rola acima da barra. O resumo das opções fica em cima de propósito: é usado raramente.

## Estados

| Estado                                                                         | O que aparece                                                                                                                                                                                                                       |
| ------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Sem clube escolhido**                                                        | Barra com `newGame.bar.noClub` e "Começar" desabilitado, ligado à frase.                                                                                                                                                            |
| **Apelido inválido**                                                           | Mensagem sob o campo; o resumo marca o problema; barra com `newGame.bar.invalidName`; "Começar" desabilitado.                                                                                                                       |
| **Lendo a última configuração**                                                | Nada visível: os padrões entram de imediato e são trocados quando o `kv` responder (antes do primeiro toque, na prática).                                                                                                           |
| **Criando** (depois de "Começar")                                              | "Começar" em `busy` ("Criando a carreira..." para leitor de tela), sem toque duplo; lista e resumo ficam sem efeito. Se passar de 1 s, tela de carregamento cheia com a marca do cenário (BrandSlot `loading`) e `newGame.loading`. |
| **Limite de 10** (`career-limit`)                                              | Só aparece se alguém chegar aqui com 10 carreiras (o Início já esconde "Nova carreira"): Banner `warning` acima da barra, com "Ir para as carreiras" (volta ao Início).                                                             |
| **Sem armazenamento** (`unsupported-browser`, `storage-unavailable`, ao criar) | Volta ao Início, que mostra o ErrorState `block` e esconde "Nova carreira".                                                                                                                                                         |
| **Sem espaço** (`quota-exceeded`)                                              | Banner `danger` acima da barra com `save.quota-exceeded.*` e "Liberar espaço" (volta ao Início, à lista, para apagar); "Começar" volta ao normal para tentar de novo. Nada foi criado.                                              |
| **Outro erro ao gravar**                                                       | ErrorState `block` acima da barra com "Tentar de novo" (repete "Começar"); nada criado pela metade (o `CareerService` só abre a carreira depois de gravada).                                                                        |
| **Offline**                                                                    | Nada muda.                                                                                                                                                                                                                          |

## Desktop (a partir de 900px)

Coluna centrada com largura máxima `layout-wide-max`; os clubes em grade de 3 colunas; a barra deixa de ser fixa na janela e gruda no pé da coluna (`position: sticky`); a folha de opções vira diálogo centrado.

## Componentes

ScreenHeader, OptionsSummary, ClubPicker, ClubOption, Crest, ActionBar, Button, BottomSheet, TextField, OptionGroup, Banner, ErrorState, BrandSlot (só no carregamento). Casca em `app/src/ui/components/` (ver [componentes.md](componentes.md)).

## Textos (chaves)

Para o `content-writer` (`ui.json`); rascunho em pt-BR. As frases de efeito do realismo e da partida resumem `partida.md` e `ia-clubes.md`; o `game-designer` confere se dizem a regra certa.

| Chave                             | Rascunho pt-BR                                                              | Onde                                |
| --------------------------------- | --------------------------------------------------------------------------- | ----------------------------------- |
| `newGame.title`                   | Nova carreira                                                               | cabeçalho                           |
| `newGame.options.title`           | Opções da carreira                                                          | resumo e título da folha            |
| `newGame.options.change`          | Alterar                                                                     | resumo                              |
| `newGame.options.coach`           | Técnico                                                                     | rótulo no resumo                    |
| `newGame.options.realism`         | Realismo                                                                    | rótulo no resumo e legenda do grupo |
| `newGame.options.match`           | Partida                                                                     | rótulo no resumo e legenda do grupo |
| `newGame.options.problem`         | O apelido do técnico precisa de ajuste.                                     | resumo com apelido inválido         |
| `newGame.options.done`            | Pronto                                                                      | fecha a folha                       |
| `newGame.clubs.legend`            | Escolha o seu clube                                                         | título da lista                     |
| `newGame.clubs.hint`              | A dificuldade de verdade é o clube: quanto menor a força, maior o desafio.  | sob o título                        |
| `newGame.clubs.place`             | {city} ({state})                                                            | linha de cada clube                 |
| `newGame.band.favorite`           | Favoritos                                                                   | título do grupo                     |
| `newGame.band.favorite.one`       | Favorito                                                                    | barra e nome acessível              |
| `newGame.band.mid`                | Meio de tabela                                                              | título do grupo, barra              |
| `newGame.band.relegation`         | Luta contra a queda                                                         | título do grupo, barra              |
| `newGame.strength`                | Força                                                                       | rótulo do número                    |
| `newGame.bar.club`                | Força {strength} · {band}                                                   | barra, sob o nome do clube          |
| `newGame.bar.noClub`              | Escolha um clube para começar.                                              | barra sem clube                     |
| `newGame.bar.invalidName`         | Corrija o apelido do técnico para começar.                                  | barra com apelido inválido          |
| `newGame.coach.label`             | Apelido do técnico                                                          | campo                               |
| `newGame.coach.hint`              | Fica só neste aparelho e no arquivo de backup.                              | campo                               |
| `newGame.coach.counter`           | {count}/{max}                                                               | contador                            |
| `newGame.coach.error.empty`       | Escreva um apelido.                                                         | erro                                |
| `newGame.coach.error.tooLong`     | Use até {max} caracteres.                                                   | erro                                |
| `newGame.coach.error.unsafe`      | Use só letras, números e sinais comuns.                                     | erro                                |
| `newGame.realism.note`            | Não dá para mudar depois de começar.                                        | nota do grupo                       |
| `newGame.realism.full`            | Completo                                                                    | carta                               |
| `newGame.realism.full.body`       | Lesões, suspensões e cansaço passam de um jogo para o outro.                | carta                               |
| `newGame.realism.simplified`      | Simplificado                                                                | carta                               |
| `newGame.realism.simplified.body` | Cartão e lesão valem só dentro do jogo; na rodada seguinte, todos inteiros. | carta                               |
| `newGame.match.note`              | Dá para trocar depois, nas Preferências ou antes de cada rodada.            | nota do grupo                       |
| `newGame.match.full`              | Animada completa                                                            | carta                               |
| `newGame.match.full.body`         | Assista ao jogo no campo e mexa no time ao vivo.                            | carta                               |
| `newGame.match.highlights`        | Só lances principais                                                        | carta                               |
| `newGame.match.highlights.body`   | Só os momentos que importam, mais rápido; você ainda mexe no time.          | carta                               |
| `newGame.match.result`            | Só resultado                                                                | carta                               |
| `newGame.match.result.body`       | O auxiliar comanda o jogo; você vê o placar na hora.                        | carta                               |
| `newGame.start`                   | Começar                                                                     | barra                               |
| `newGame.start.busy`              | Criando a carreira...                                                       | `busy` (leitor de tela)             |
| `newGame.loading`                 | Montando o elenco e o calendário...                                         | tela de carregamento                |
| `newGame.limit.action`            | Ir para as carreiras                                                        | Banner `career-limit`               |

As chaves `newGame.match.*` servem também às Preferências (US-044) e à escolha antes da rodada (US-019): o mesmo texto nos três lugares.

## Acessibilidade

- A lista de clubes é um grupo de rádio nativo (`fieldset` com `legend`, um `name` só para os 20): setas movem entre os clubes, Espaço marca. Selecionado com ícone de marcado, borda `grass` e superfície mais clara, além da cor.
- O nome acessível de cada clube tem nome, cidade, força e faixa ("Tufão, Curitiba (PR), Força 74, Favorito").
- Erro do apelido por texto, `aria-invalid` e `aria-describedby`, não só borda vermelha.
- Nomes de clube longos em es/en quebram em duas linhas, sem cortar; os botões também.
- O campo do apelido tem fonte de 17px (`body-lg`): abaixo de 16px o iOS dá zoom ao focar (ver [componentes.md](componentes.md#zoom-no-celular)).

## Marcas do cenário

Só na tela de carregamento ao criar a carreira, e só se a espera passar de 1 s (marca fictícia de `brandForSlot`).

## Decisões para o CEO (T-025)

1. **Limite do apelido: 24 caracteres (fechar o provisório).** Medido na prévia a 390px: "Professor Girafales da Silva Sauro" (34) já cabe no campo, e 24 caracteres cabem numa linha em `titulo` (28px) na largura útil de 328px a 360px para letras comuns; nomes com muitas letras largas quebram em duas linhas, nunca cortam. Recomendo **manter 24**: como não muda, a importação não ganha o caso `too-long` de builds antigos.
2. **O apelido não entra na "última configuração".** Recomendo **não**: só realismo e partida vão para o `kv`. Assim nenhuma cópia do apelido sobrevive a apagar as carreiras (minimização, LGPD), e o custo é digitar o apelido de novo a cada carreira.
3. **Padrões da primeira vez:** realismo Completo e partida Animada completa. Recomendo **sim**. Enquanto a partida animada não existir (T-031/T-032), o `developer` usa "Só resultado" como padrão e as outras duas cartas ficam fora (P3: nada de "em breve"); a troca volta quando a animada entrar.
4. **Clubes em três grupos pela força** (Favoritos, Meio de tabela, Luta contra a queda) em vez de ordem alfabética, sem busca. Recomendo **sim**: a força é a dificuldade da carreira, e 20 clubes cabem numa rolagem.
5. **Apagar antes da T-020:** a confirmação dupla entra na T-025, mas o passo 1 só oferece "Exportar carreira" quando a T-020 existir. Recomendo **sim**, com o critério "oferece exportar antes" da US-034 fechando na T-020 (a alternativa é segurar o apagar até lá).
6. **"Temporada 1" em vez de "Temporada 2026"** na carta da carreira. Recomendo **manter o número** na T-025; mostrar o ano pede `year` no `CareerSummary` (muda o registro `careers` do save, que é `/feature` com ADR). Fica como melhoria.
