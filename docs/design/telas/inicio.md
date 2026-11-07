# Início

**Histórias:** US-034, US-043 · **Prioridade:** Must · **Ordem:** 2 · **Tarefa:** T-025

## Objetivo

Abrir o jogo e voltar à carreira em um toque, ou começar uma nova.

## O que o jogador faz

Continua a carreira mais recente, abre outra das carreiras do aparelho, apaga uma (com confirmação dupla) ou começa uma nova. Com a T-020, também importa e exporta.

## Conteúdo (de cima para baixo)

1. **Marca:** nome do jogo de `config/prancheta.config.ts` em `titulo`, caixa alta (enquanto `logo.hasBrand` for falso, só o nome em texto; com marca, o `logo.mark` à esquerda).
2. **Slogan** da configuração, no idioma atual (`config.slogan[lang]`), em `body` e `ink-muted`.
3. **Aviso de ficção** (US-043) em `caption`, logo abaixo do slogan: fica no topo para estar sempre visível sem rolar, com qualquer número de carreiras.
4. Faixa de avisos (Banner), quando houver: nova versão, novidades (ver [erros-e-avisos.md](erros-e-avisos.md)).
5. **Carreiras** (com pelo menos uma):
   - Cabeçalho "Suas carreiras" em `subtitulo`, com "3 de 10" à direita em `caption`, `tabular-nums`.
   - A mais recente em CareerCard `featured`: escudo `lg`, nome curto do clube, linha de progresso, data da última jogada, botão "Continuar" (primário da tela) e o botão "Mais ações" (três pontos).
   - As outras em CareerCard `row`, da mais recente para a mais antiga: a linha inteira continua a carreira; o botão "Mais ações" fica ao lado, como alvo separado de 44px.
   - "Nova carreira" (secundário, ícone de mais), logo abaixo da lista.
6. **Sem carreiras:** EmptyState com o título, a frase e "Nova carreira" como primário. Com a T-020, "Importar backup" entra embaixo, secundário.
7. **Pé:** Preferências e Sobre como LinkRow; a versão do app em `caption`.

Na 1b, uma entrada "Liga online" entra entre o item 5 e o 7.

### CareerCard: o que cada linha mostra

| Linha      | Fonte (`CareerSummary`)           | Texto                                                                                                                                                   |
| ---------- | --------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Escudo     | `club` (o `ClubDef` congelado)    | Crest, decorativo (o nome está ao lado)                                                                                                                 |
| Clube      | `club.shortName`                  | "Flamingo"                                                                                                                                              |
| Progresso  | `season`, `round`                 | `home.career.progress` ("Temporada 1 · rodada 12"); com `round` 39, `home.career.seasonOver`                                                            |
| Última vez | `updatedAt`                       | `home.career.lastPlayed` com a data por `Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short' })`; hoje, `home.career.lastPlayedToday` com a hora |
| Selo       | estado da carreira, quando houver | "Versão mais nova", "Danificada" (ver Estados)                                                                                                          |

"Rodada 12" é a próxima a jogar (`round` do resumo), como no cabeçalho da carreira. A temporada aparece pelo número (1, 2...), porque o resumo não tem o ano; mostrar "Temporada 2026" pede o `year` no `CareerSummary` (ver "Decisões para o CEO").

### Ações de uma carreira ("Mais ações")

Toque nos três pontos abre um BottomSheet com o título `home.career.actionsTitle` ("Carreira do Flamingo") e:

- **Exportar carreira** (secundário, ícone de baixar): só a partir da T-020.
- **Apagar carreira** (`danger`, ícone de lixeira): abre a confirmação dupla.

Um sheet de ações, e não um botão "Apagar" na própria carta, para que o apagar nunca fique a um toque de distância do "Continuar".

### Apagar com confirmação dupla (US-034)

Dois ConfirmSheet seguidos; cada um tem endereço no histórico (o voltar do celular fecha sem apagar). Os dois mostram, num bloco em `surface-2`, o escudo, o clube e a linha de progresso da carreira.

| Passo | Título                                                         | Texto                                                                           | Ações (de cima para baixo)                                                                                             |
| ----- | -------------------------------------------------------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 1     | `delete.step1.title` ("Apagar a carreira do Flamingo?")        | `delete.step1.body` (oferece exportar antes)                                    | **Exportar carreira** (secundário; T-020), **Quero apagar** (secundário, não destrói nada ainda), **Cancelar** (ghost) |
| 2     | `delete.step2.title` ("Apagar de vez a carreira do Flamingo?") | `delete.step2.body` (some do aparelho com as três cópias; não dá para desfazer) | **Apagar carreira** (`danger`, ícone de lixeira, `busy` enquanto apaga), **Cancelar** (ghost)                          |

- O foco entra no botão de fechar da folha (o `showModal` foca o primeiro controle), nunca no de apagar. Cancelar fica por último, embaixo, no alcance do polegar; o botão destrutivo fica acima dele, com borda `danger`, ícone e texto.
- Cancelar, fechar, Esc, toque fora ou voltar em qualquer passo: nada é apagado e o foco volta ao botão "Mais ações" da carta.
- Apagou: a folha fecha, a lista é relida e uma mensagem `home.deleted` ("Carreira do Flamingo apagada.") sai numa região `aria-live="polite"` da tela. O foco vai para o cabeçalho "Suas carreiras" (ou para o EmptyState, se era a última).
- Falhou (`CareerService.remove` devolveu erro): a folha do passo 2 fica aberta, o botão sai do `busy` e a mensagem `delete.failed` aparece na própria folha, em `aria-live`. Nada foi apagado.
- Antes da T-020 o passo 1 aparece sem "Exportar carreira": a confirmação continua dupla, e o critério "oferece exportar antes" fecha com a T-020 (ver "Decisões para o CEO").

## Ao alcance do polegar

"Continuar", a lista e "Nova carreira" ficam do meio para baixo; marca, slogan e aviso de ficção, em cima (leitura). As folhas de ações e de confirmação sobem de baixo, com "Cancelar" por último.

## Estados

| Estado                                                                   | O que aparece                                                                                                                                                                                                                                                                                                                                          |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Carregando** (lendo a lista)                                           | Skeleton de uma carta `featured` e duas `row`, com o texto `home.loading` para leitor de tela; só aparece depois de 300 ms, para não piscar (com movimento reduzido, aparece de imediato e parado).                                                                                                                                                    |
| **Vazio** (nenhuma carreira)                                             | EmptyState com `home.empty.title`, `home.empty.body` e "Nova carreira" primário.                                                                                                                                                                                                                                                                       |
| **Lista** (1 a 9 carreiras)                                              | Como no "Conteúdo".                                                                                                                                                                                                                                                                                                                                    |
| **Cheio** (10 carreiras, `MAX_CAREERS`)                                  | A lista inteira; no lugar de "Nova carreira", Banner `warning` com `save.career-limit.title` e `home.limit.body` ("Apague uma para começar outra: toque nos três pontinhos da carreira."). Sem botão desabilitado: o aviso já diz o que fazer, e a ação está na lista.                                                                                 |
| **Abrindo uma carreira**                                                 | O botão daquela carta em `busy` ("Abrindo a carreira..." para leitor de tela); as outras cartas e "Nova carreira" ficam sem efeito até terminar (o `CareerService` já recusa o segundo toque com `busy`).                                                                                                                                              |
| **Erro ao abrir** (`not-found`, `save-too-new`)                          | A carta continua na lista com o selo (`home.badge.tooNew` "Versão mais nova") e uma linha de aviso em texto sob ela; o botão da carta vira a ação do código ("Atualizar o jogo" para `save-too-new`). `not-found` relê a lista (a carta some) e mostra o aviso numa faixa. `all-corrupt`, `read-failed` e `app-outdated` são tela cheia (FatalScreen). |
| **Erro ao listar** (`read-failed`)                                       | ErrorState `block` no lugar da lista, com "Tentar de novo"; "Nova carreira" continua visível.                                                                                                                                                                                                                                                          |
| **Navegador sem suporte** (`unsupported-browser`, `storage-unavailable`) | ErrorState `block` no lugar da lista, com "Saber como resolver" (link externo). **"Nova carreira" e "Continuar" não aparecem**: nada poderia ser salvo (NIT 8 da revisão da T-023). Marca, slogan, aviso de ficção e pé continuam.                                                                                                                     |
| **Offline**                                                              | Nada muda.                                                                                                                                                                                                                                                                                                                                             |
| **Aviso de nova versão / novidades**                                     | Banner acima das carreiras (item 4).                                                                                                                                                                                                                                                                                                                   |

Um único primário: "Continuar" com carreiras; "Nova carreira" sem carreiras; nenhum no estado sem suporte (o "Saber como resolver" do ErrorState `block` é secundário).

## Desktop (a partir de 900px)

A mesma coluna, centrada, com largura máxima `layout-content-max`; "Continuar" deixa de ocupar a largura toda e vai para a direita da carta. Sem barra lateral: o Início é tela cheia, fora da moldura da carreira.

## Componentes

CareerCard, Crest, Button, EmptyState, Skeleton, Banner, ErrorState, BottomSheet, ConfirmSheet, LinkRow. Casca em `app/src/ui/components/` (ver [componentes.md](componentes.md)).

## Textos (chaves)

Para o `content-writer` (`app/src/content/<idioma>/ui.json`); o rascunho em pt-BR é para o CEO ler. As chaves que já existem continuam (`home.new`, `home.continue`, `home.loading`, `career.progress`, `career.seasonOver`); as novas são estas.

| Chave                         | Rascunho pt-BR                                                                                         | Onde                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------- |
| `home.fiction`                | Clubes, jogadores e marcas deste jogo são fictícios.                                                   | aviso de ficção (US-043)                                   |
| `home.careers.title`          | Suas carreiras                                                                                         | cabeçalho da lista                                         |
| `home.careers.count`          | {count} de {max}                                                                                       | ao lado do cabeçalho                                       |
| `home.career.progress`        | Temporada {season} · rodada {round}                                                                    | linha de progresso (substitui `career.progress` no Início) |
| `home.career.seasonOver`      | Temporada {season} encerrada                                                                           | progresso com `round` 39                                   |
| `home.career.lastPlayed`      | Jogada em {date}                                                                                       | data da última jogada                                      |
| `home.career.lastPlayedToday` | Jogada hoje, {time}                                                                                    | idem, no mesmo dia                                         |
| `home.career.continueA11y`    | Continuar a carreira do {club}                                                                         | nome acessível da linha `row`                              |
| `home.career.actions`         | Mais ações da carreira do {club}                                                                       | nome acessível dos três pontos                             |
| `home.career.actionsTitle`    | Carreira do {club}                                                                                     | título da folha de ações                                   |
| `home.career.opening`         | Abrindo a carreira...                                                                                  | `busy` do "Continuar" (leitor de tela)                     |
| `home.badge.tooNew`           | Versão mais nova                                                                                       | selo da carta (`save-too-new`)                             |
| `home.badge.damaged`          | Danificada                                                                                             | selo da carta (`all-corrupt`, em Carreiras e backup)       |
| `home.empty.title`            | Nenhuma carreira ainda                                                                                 | EmptyState                                                 |
| `home.empty.body`             | Escolha um clube, ajuste duas ou três coisas e comece a sua primeira temporada.                        | EmptyState                                                 |
| `home.limit.body`             | Apague uma para começar outra: toque nos três pontinhos da carreira.                                   | Banner do estado cheio (título: `save.career-limit.title`) |
| `home.deleted`                | Carreira do {club} apagada.                                                                            | aviso `aria-live` depois de apagar                         |
| `delete.action`               | Apagar carreira                                                                                        | folha de ações e botão do passo 2                          |
| `delete.step1.title`          | Apagar a carreira do {club}?                                                                           | passo 1                                                    |
| `delete.step1.body`           | Antes, você pode exportar um backup para guardar fora do aparelho. Sem backup, não tem como recuperar. | passo 1                                                    |
| `delete.step1.body.noExport`  | Depois de apagar, não tem como recuperar.                                                              | passo 1 antes da T-020                                     |
| `delete.step1.continue`       | Quero apagar                                                                                           | passo 1                                                    |
| `delete.step2.title`          | Apagar de vez a carreira do {club}?                                                                    | passo 2                                                    |
| `delete.step2.body`           | A carreira e as três cópias salvas vão sumir deste aparelho. Não dá para desfazer.                     | passo 2                                                    |
| `delete.busy`                 | Apagando...                                                                                            | `busy` do botão de apagar (leitor de tela)                 |
| `delete.failed`               | Não deu para apagar agora. Nada foi apagado; tente de novo.                                            | erro no passo 2                                            |
| `delete.cancel`               | Cancelar                                                                                               | os dois passos                                             |

`{club}` é o `shortName`; nas três línguas o nome do clube não se traduz. Em es e en a preposição muda ("la carrera del Flamingo", "your Flamingo career"); o `content-writer` confere.

## Acessibilidade

- Botões e linhas ≥ 44px; um único primário; foco visível em tudo (anel de `app.css`).
- A linha `row` é um botão só, com nome acessível próprio ("Continuar a carreira do Flamingo") e a linha de aviso ligada por `aria-describedby`; os três pontos são outro botão, com nome que cita o clube.
- O selo de problema tem ícone e texto, nunca só cor.
- O aviso de ficção é texto real com contraste ≥ 4,5:1 (`ink-muted` sobre `surface-0`).
- Nenhuma animação de entrada; o Skeleton só pulsa com movimento ligado.

## Marcas do cenário

Nenhuma.

## Decisões para o CEO

Ver o fim de [novo-jogo.md](novo-jogo.md), que reúne as decisões da T-025.
