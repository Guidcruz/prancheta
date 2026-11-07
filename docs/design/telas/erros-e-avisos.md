# Erros e avisos globais

**Histórias:** US-045, US-039, US-037, US-038, US-032 (aviso de rodadas perdidas) · **Prioridade:** Must · **Ordem:** 22 (a casca do ErrorState, do Banner e da fronteira de erro entra cedo, junto da moldura, na T-023)

## Objetivo

Avisar o jogador do que importa sem interromper a rodada, e mostrar erros com uma saída clara que ele consiga fazer sozinho.

## Onde cada aviso aparece

| Forma                                 | Componente                   | Quando                                                                                             |
| ------------------------------------- | ---------------------------- | -------------------------------------------------------------------------------------------------- |
| **Tela cheia**                        | ErrorState `layout="screen"` | Não dá para continuar: a carreira não abre, ou continuar só faria perder mais progresso.           |
| **Área de conteúdo**                  | ErrorState `layout="area"`   | A tela dentro da moldura quebrou (fronteira de erro); cabeçalho, abas e "Jogar rodada" continuam.  |
| **Bloco**                             | ErrorState `layout="block"`  | Uma parte da tela falhou (um bloco do Clube, uma lista); o resto funciona.                         |
| **Faixa de avisos** (sob o cabeçalho) | Banner                       | Dá para continuar, mas o jogador precisa saber ou fazer algo. Nunca cobre abas nem "Jogar rodada". |

Na moldura (AppShell) a faixa de avisos fica logo abaixo do ScreenHeader e acima do conteúdo, nos dois layouts. Mais de um aviso: o de tom mais grave em cima (`danger`, `warning`, `info`), no máximo dois visíveis; os outros esperam.

## Erro inesperado (US-045)

- **Fronteira de erro** (`ErrorBoundary`, sobre o `<svelte:boundary>` do Svelte 5) em volta do conteúdo de cada tela. Erro de programação lançado na tela vira o ErrorState: ícone, título, mensagem no idioma atual, "Tentar de novo" (remonta a tela) e "Voltar ao início".
- Na moldura, layout `area`: ocupa só a área de conteúdo; cabeçalho, abas e "Jogar rodada" continuam, e por isso "Tentar de novo" usa o estilo secundário (o primário da tela continua sendo o "Jogar rodada", regra de um primário por tela). Nas telas cheias (Partida, Resumo, Início), layout `screen`, e "Tentar de novo" é o primário.
- A carreira salva não é alterada; o registro local (`lib/errors`) leva versão do app, tela, tipo e pilha, nunca apelido, conteúdo do save, IP ou identificador do aparelho.
- Uma linha `caption` com o código do erro ("Código: conflict"), para o jogador citar ao suporte. Só o código, nunca a pilha.
- Erro dentro de um bloco (Clube, listas) usa o ErrorState `block` no lugar do bloco, com "Tentar de novo".
- "Copiar relatório" fica em Sobre (US-045, P11), não no ErrorState: a tela de erro é para sair do erro, não para suporte.

## Erros do save (`docs/02-architecture.md` §4.2)

O `CareerService` recebe o código do `SaveStore` e a tela mostra o aviso da tabela. As chaves vão para `app/src/content/<idioma>/errors.json` (§3 da arquitetura; ver "Ponto de entrada dos textos" abaixo). Os textos pt-BR das tabelas abaixo são os aprovados pelo CEO no lote da T-025; a fonte continua sendo o `errors.json`.

### Códigos novos desde a especificação

| Código                | Quando acontece (para o jogador)                                                                 | Forma e lugar                                                                                                                                                                                                                                                     | O que o jogador pode fazer                                                                                                 | Chaves (`save.<código>.*`)                                      | Texto pt-BR                                                                                                                                                                     |
| --------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `quota-exceeded`      | Ao salvar: o aparelho está sem espaço. Nada mudou no save; a rodada está só na memória.          | Banner `danger`, não dispensável, na faixa de avisos da tela em que estava (em geral o Resumo).                                                                                                                                                                   | **Tentar de novo** (primário), **Liberar espaço** (abre Carreiras e backup), **Exportar carreira**.                        | `title`, `body`, `action.retry`, `action.free`, `action.export` | **Sem espaço para salvar.** Libere espaço no aparelho (apague carreiras antigas ou outros dados do navegador) e tente de novo.                                                  |
| `unsupported-browser` | Ao abrir ou salvar: endereço sem HTTPS, ou Safari anterior ao 16.4.                              | No Início: ErrorState `block` no lugar da lista de carreiras; "Nova carreira" e "Continuar" não aparecem (também quando o código vem ao criar a carreira: o Novo jogo volta ao Início).                                                                           | **Saber como resolver** (abre a página de suporte, link externo). Nada a tentar de novo aqui.                              | `title`, `body`, `action.help`                                  | **Este navegador não consegue salvar a carreira.** Abra o jogo pelo endereço oficial (com https) ou atualize o navegador. No iPhone e no iPad, é preciso iOS 16.4 ou mais novo. |
| `app-outdated`        | Qualquer operação: outra aba abriu uma versão mais nova do jogo.                                 | ErrorState `screen` (sem abas).                                                                                                                                                                                                                                   | **Recarregar o jogo** (primário). Se aconteceu ao salvar, a linha extra diz que a última rodada não foi salva.             | `title`, `body`, `bodyUnsaved`, `action.reload`                 | **O jogo foi atualizado em outra aba.** Recarregue esta página para continuar com a versão nova. · Extra: A última rodada desta aba não foi salva.                              |
| `conflict`            | Ao salvar: a mesma carreira foi jogada em outra aba ou janela. Nada mudou.                       | ErrorState `screen` (sem abas): continuar aqui só geraria novos conflitos.                                                                                                                                                                                        | **Recarregar o jogo** (primário, pega o progresso da outra aba) ou **Voltar ao início**. Dica no texto: feche a outra aba. | `title`, `body`, `action.reload`, `action.home`                 | **Esta carreira está aberta em outra aba.** O progresso de lá foi salvo e o daqui não. Feche a outra aba e recarregue esta página para continuar de onde parou.                 |
| `save-too-new`        | Ao abrir: a carreira foi salva por uma versão mais nova do jogo. Ao salvar: idem, por outra aba. | Ao abrir: a carta continua na lista, com o selo "Versão mais nova" (`home.badge.tooNew`), a linha de aviso sob ela e o botão da carta trocado por "Atualizar o jogo" (como em [inicio.md](inicio.md), "Estados"); sem ErrorState. Ao salvar: ErrorState `screen`. | **Atualizar o jogo** (recarrega; se houver versão nova no cache, ela entra). A carreira não é aberta nem sobrescrita.      | `title`, `body`, `action.update`                                | **Esta carreira é de uma versão mais nova do jogo.** Atualize o jogo para continuar. Nada foi apagado.                                                                          |
| `all-corrupt`         | Ao abrir: as três cópias salvas estão danificadas. A carreira continua na lista.                 | ErrorState `screen`; na lista de Carreiras, o card ganha StatusBadge "danificada".                                                                                                                                                                                | **Importar backup** (primário, abre a importação), **Voltar ao início**. Apagar fica em Carreiras e backup.                | `title`, `body`, `action.import`, `action.home`                 | **Não deu para abrir esta carreira.** As três cópias salvas estão danificadas. Se você exportou um backup, importe o arquivo para continuar.                                    |
| `verify-failed`       | Ao salvar: a conferência depois da gravação não bateu. O jogo desfez a gravação.                 | Banner `danger`, não dispensável.                                                                                                                                                                                                                                 | **Tentar de novo** (primário), **Exportar carreira**. O `detail` (`problem`, `rolledBack`) vai só para o registro.         | `title`, `body`, `action.retry`, `action.export`                | **Não deu para salvar.** O jogo conferiu a gravação e algo não bateu, então manteve a versão anterior. Tente de novo; se repetir, exporte um backup das suas carreiras.         |
| `too-large`           | Ao salvar: a carreira passou do tamanho máximo. É defeito do jogo, não do jogador.               | Banner `danger`, não dispensável.                                                                                                                                                                                                                                 | **Exportar carreira** (primário), **Copiar relatório** (secundário; mesmo texto de Sobre).                                 | `title`, `body`, `action.export`, `action.report`               | **A carreira ficou grande demais para salvar.** Isso é um defeito nosso. Exporte a carreira para não perder nada e mande o relatório de erros ao suporte.                       |

### Rodadas perdidas ao voltar para a versão anterior (`roundsLost`)

- Ao abrir, se `OpenedCareer.roundsLost > 0`: Banner `warning` (fundo `floodlight`, texto `on-floodlight`) na faixa de avisos da primeira tela (Clube), dispensável; não volta depois de fechado.
- Ação: **Entendi** (fecha). Sem "tentar recuperar": as cópias puladas já foram descartadas pela abertura.
- Chaves: `save.roundsLost.title`, `save.roundsLost.body.one`, `save.roundsLost.body.other` (plural pelo número; o `content-writer` confere as formas em es e en), `save.roundsLost.action.ok`.
- Texto: **Recuperamos a sua carreira.** A última cópia salva estava danificada, então voltamos para a anterior. {count} rodada foi perdida. / {count} rodadas foram perdidas.
- `missingSheetRounds` (súmulas que faltam) não tem aviso global: a tela da rodada mostra só o placar e um EmptyState curto (T-030).

### Códigos que já existiam

| Código                | Forma e lugar                                                                                                                                                              | O que o jogador pode fazer                                                    | Texto pt-BR                                                                                                                        |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `storage-unavailable` | Igual a `unsupported-browser` (Início, bloco).                                                                                                                             | Saber como resolver.                                                          | **Não deu para usar o armazenamento do navegador.** Em janela anônima ou com dados do site bloqueados, o jogo não consegue salvar. |
| `read-failed`         | ErrorState `screen` ao abrir; `block` numa lista.                                                                                                                          | Tentar de novo, Voltar ao início.                                             | **Não deu para ler a carreira agora.** Tente de novo.                                                                              |
| `write-failed`        | Banner `danger`, não dispensável.                                                                                                                                          | Tentar de novo, Exportar carreira.                                            | **Não deu para salvar.** Tente de novo.                                                                                            |
| `career-limit`        | No Início, Banner `warning` no lugar de "Nova carreira" (T-025); no Novo jogo, se chegar lá, acima da barra.                                                               | Apagar uma carreira da lista do Início ("Ir para as carreiras" no Novo jogo). | **Você já tem 10 carreiras.** Apague uma para começar outra.                                                                       |
| `not-found`           | No Início, a lista é relida (a carta some) e o aviso sai num Banner `warning` na faixa de avisos, acima das carreiras ([inicio.md](inicio.md), "Estados"); sem ErrorState. | Nada a fazer: a lista já está certa.                                          | **Esta carreira não existe mais neste aparelho.** Confira a lista das suas carreiras salvas.                                       |
| `invalid-save`        | É erro de programação: cai na fronteira de erro como erro inesperado e no registro (só caminho e tipo).                                                                    | Tentar de novo, Voltar ao início.                                             | Texto do erro inesperado.                                                                                                          |

### Ações e onde levam

| Ação                | Chave           | O que faz                                                                                                                                                                                                                                                              |
| ------------------- | --------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Tentar de novo      | `action.retry`  | Repete a mesma gravação (o `CareerService` ainda tem a rodada na memória) ou remonta a tela.                                                                                                                                                                           |
| Recarregar o jogo   | `action.reload` | `location.reload()`.                                                                                                                                                                                                                                                   |
| Atualizar o jogo    | `action.update` | Pede a versão nova ao service worker e recarrega; sem versão nova, só recarrega.                                                                                                                                                                                       |
| Liberar espaço      | `action.free`   | Dentro da carreira, abre Carreiras e backup (na moldura, sem fechar a carreira) para apagar outra carreira (US-034, [saves.md](saves.md)); fora dela (Novo jogo), volta à lista do Início. Quanto cada carreira ocupa fica para depois: o armazenamento só dá o total. |
| Exportar carreira   | `action.export` | Baixa o arquivo da carreira em memória (T-020); funciona mesmo sem espaço para salvar.                                                                                                                                                                                 |
| Importar backup     | `action.import` | Abre a importação de Carreiras e backup.                                                                                                                                                                                                                               |
| Copiar relatório    | `action.report` | O mesmo de Sobre (US-045).                                                                                                                                                                                                                                             |
| Saber como resolver | `action.help`   | Link externo para a página de suporte (`config.contacts.supportUrl`), com ícone de link externo.                                                                                                                                                                       |
| Voltar ao início    | `action.home`   | Fecha a carreira na memória (sem gravar) e vai ao Início.                                                                                                                                                                                                              |

As chaves de ação são comuns a todos os códigos (`action.*`, em `ui.json`); a tabela dos códigos lista quais aparecem em cada um. Um único primário por aviso.

## Nova versão e novidades (US-039)

- Banner `info` "nova versão disponível" com "Atualizar"; nunca durante a Partida, Intervalo ou Entrevista: espera o Resumo da rodada, já salvo.
- Pode ser adiado (fechar o Banner); volta na próxima abertura.
- Novidades: na primeira abertura da versão nova, Banner com "Ver novidades", que abre BottomSheet com as notas curtas.
- Chaves: `update.available.title` (Nova versão disponível), `update.available.body` (Atualize para ter as correções mais recentes. A carreira continua salva.), `action.update`, `update.news.title`, `update.news.action` (Ver novidades).

## Armazenamento e backup (US-037)

- Persistência negada: Banner `warning` em Carreiras e backup (não em toda tela).
- Lembrete de exportar: no Fim de temporada.

## Offline (US-038)

- Sem aviso global: o jogo é offline por desenho. Só links externos e a busca de nova versão dizem que precisam de conexão.

## Componentes

ErrorState, ErrorBoundary, Banner, BottomSheet, Button, Icon. Casca em `app/src/ui/components/` (T-023).

| Componente    | Arquivo                | Props principais                                                                                                                                                                                             |
| ------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| ErrorState    | `ErrorState.svelte`    | `layout` (`screen`/`area`/`block`), `title`, `message`, `extra?`, `code?` (já com o rótulo, ex.: "Código: conflict"), `primary?` e `secondary?` (`{ label, onclick, icon? }` ou `{ label, href, external }`) |
| ErrorBoundary | `ErrorBoundary.svelte` | `copy` (`title`, `message`, `retry`, `home`), `onerror(error)`, `onhome`, snippet `children`; "Tentar de novo" chama o `reset` do `<svelte:boundary>`                                                        |
| Banner        | `Banner.svelte`        | `tone` (`info`/`warning`/`danger`), `title`, `message`, `actions?` (o primeiro é o primário do aviso), `dismissLabel?` e `ondismiss?` (sem eles, não dispensável)                                            |
| Button        | `Button.svelte`        | `variant` (`primary`/`secondary`/`ghost`/`danger`), `busy`, `busyLabel?`, `disabled`, `fullWidth`, `icon?`, `href?`, `external?`, snippet `children`                                                         |

A casca não sabe de códigos: recebe textos prontos. Quem escolhe o aviso pelo código é o `CareerService` ou a tela (developer), pela tabela acima.

## Ponto de entrada dos textos

- O i18n completo é a T-022. Até lá, o ponto de entrada é o `t(chave, idioma, vars)` que já existe em `app/src/lib/i18n.ts`, chamado pelas telas, nunca pelos componentes.
- `t()` hoje só lê `ui.json`. Proposta para a T-023: o `developer` faz o `t()` ler também `errors.json` (mesma tabela, chaves `save.*` sem colisão com as de `ui.json`), como prevê o §3 da arquitetura. Sem isso, as chaves `save.*` ficam provisoriamente em `ui.json`; o `content-writer` move quando a T-022 chegar.
- Plural: `save.roundsLost.body.one` e `.other`, escolhidos pela tela com `Intl.PluralRules` até a T-022 trazer o mecanismo.

## Acessibilidade

- Banners com ícone + título + texto, nunca só cor; `info` e `warning` com `role="status"`, `danger` com `role="alert"`.
- ErrorState com ícone, título em `subtitulo` ou `titulo`, `role="alert"`; o título recebe foco ao aparecer em tela cheia, para o leitor de tela anunciar.
- Nada de aviso que cubra o "Jogar rodada" ou as abas; Banner sem animação de entrada (nem com movimento ligado: simples antes de bonito).
- Botões dos avisos ≥ 44px, quebram em duas linhas em es e en em vez de cortar; em telas estreitas, os botões do Banner descem para baixo do texto.
- Contraste: `danger` e `info` aparecem como borda à esquerda e ícone sobre `surface-1`, com texto em `ink` (o par `danger` sobre `danger-soft` não é usado para texto pequeno); `warning` usa `floodlight` com `on-floodlight`.

## Decisões para o CEO

1. **Bloquear "Jogar rodada" enquanto a última rodada não foi salva** (`quota-exceeded`, `verify-failed`, `write-failed`, `too-large`). Proposta: sim, em `blocked` com o motivo; jogar mais rodadas sem salvar só aumentaria o que se perde se o app fechar.
2. **Mostrar o código do erro** ("Código: conflict") na tela de erro, para o suporte. Proposta: sim, só o código, em `caption`.
3. **Erro de duas abas em tela cheia** (`conflict`, `app-outdated`) em vez de Banner. Proposta: tela cheia, porque continuar na aba velha só gera novos conflitos.

## Marcas do cenário

Nenhuma.
