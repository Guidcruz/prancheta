# Moldura e navegação

**Histórias:** US-015 · **Prioridade:** Must · **Ordem:** 1 · **Tarefa:** T-023 (casca da interface)

## Objetivo

Dar à carreira uma moldura única em que o jogador alcança tudo com o polegar e nunca perde o "Jogar rodada" de vista.

## O que o jogador faz aqui

Troca de aba (Clube, Elenco, Tabela, Calendário), abre o menu "Mais" para o que usa pouco e toca "Jogar rodada". No desktop faz o mesmo pela barra lateral.

## Conteúdo

- **Celular (abaixo de 900px):** ScreenHeader no topo (título da tela, voltar quando houver, ícone de menu "Mais" à direita); faixa de avisos logo abaixo do cabeçalho (ver [erros-e-avisos.md](erros-e-avisos.md)); conteúdo rolável; PlayRoundButton centralizado acima da TabBar; TabBar fixa embaixo com Clube, Elenco, Tabela e Calendário, cada aba com ícone e rótulo.
- **Desktop (a partir de 900px):** TabBar em `orientation="side"`, com o nome do jogo (de `config/prancheta.config.ts`) e o escudo e o nome do clube no topo; os quatro destinos das abas, uma divisória, Notícias e Rede social (se ligada), outra divisória, Carreiras e backup, Preferências e Sobre; "Jogar rodada" fixo no pé da barra lateral; conteúdo com largura máxima de leitura (`layout-content-max`). O ícone "Mais" do cabeçalho some, porque todas as entradas já estão na barra.
- **Menu "Mais"** (BottomSheet no celular): Notícias, Rede social (se ligada), Carreiras e backup, Preferências, Sobre, Rever tutorial. Cada entrada é um LinkRow ≥ 44px.

O breakpoint de 900px é o de `docs/02-architecture.md` §3 (Interface). Enquanto não houver token, ele aparece como número só no AppShell e no ScreenHeader (ver propostas em [componentes.md](componentes.md#propostas-ao-design-system)).

## Ao alcance do polegar

TabBar, "Jogar rodada" e o conteúdo de baixo. O menu "Mais" fica no topo de propósito: é usado raramente; as mesmas entradas também estão no pé da tela Clube.

## Estados

- **Carregando a carreira:** Skeleton na área de conteúdo; TabBar visível; "Jogar rodada" em `busy` (rótulo continua visível, com "Calculando..." para leitor de tela).
- **Erro ao abrir a carreira:** ErrorState em tela cheia, sem abas (ver [erros-e-avisos.md](erros-e-avisos.md), tabela dos códigos do save).
- **Erro inesperado numa aba:** a fronteira de erro troca só o conteúdo da aba pelo ErrorState em tela cheia da área de conteúdo; cabeçalho, abas e "Jogar rodada" continuam, para o jogador poder sair por outra aba.
- **Rodada bloqueada** (escalação incompleta): o botão continua tocável, com a linha de motivo embaixo do rótulo; ao tocar, abre a folha de US-017 com "Completar automaticamente". Nunca some nem fica cinza sem explicação.
- **Rodada anterior não salva** (gravação recusada, ver erros-e-avisos): o botão fica em `blocked` com o motivo "a última rodada não foi salva"; ao tocar, leva ao aviso com as saídas. Proposta, depende do CEO (ver o fim de erros-e-avisos).
- **Avisos ativos:** aparecem na faixa abaixo do cabeçalho, nunca por cima das abas nem do botão.
- **Vazio:** não existe; a moldura só aparece com carreira aberta.
- **Offline:** nada muda.

## Componentes

AppShell, TabBar, PlayRoundButton, ScreenHeader, BottomSheet, LinkRow, Icon, Banner (na faixa de avisos). Casca em `app/src/ui/components/` (T-023).

| Componente      | Arquivo                  | Props principais                                                                                                                                                                   |
| --------------- | ------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| AppShell        | `AppShell.svelte`        | `tabs`, `sideExtra`, `sideSettings`, `current`, `onselect?`, `club?` (`name`, `crestSvg`), `wide?`, `playRound`, `navLabel`, `skipLabel`, snippets `header`, `notices`, `children` |
| TabBar          | `TabBar.svelte`          | `items` (`id`, `label`, `icon`, `href`), `current`, `orientation` (`bottom`/`side`), `label`, `onselect?`                                                                          |
| PlayRoundButton | `PlayRoundButton.svelte` | `state` (`ready`/`blocked`/`busy`), `label`, `hint?`, `busyLabel?`, `placement` (`float`/`side`), `onplay`                                                                         |
| ScreenHeader    | `ScreenHeader.svelte`    | `title`, `backLabel?`, `onback?`, `moreLabel?`, `onmore?`                                                                                                                          |
| BottomSheet     | `BottomSheet.svelte`     | `open`, `title`, `closeLabel`, `onclose`, snippets `children` e `footer?`                                                                                                          |
| LinkRow         | `LinkRow.svelte`         | `label`, `icon?`, `value?`, `href?`, `external?`, `externalLabel?`, `onclick?`                                                                                                     |
| Icon            | `Icon.svelte`            | `name` (lista fechada), `size?`, `label?` (sem `label`, fica `aria-hidden`)                                                                                                        |

A ordem, os ícones e as chaves de texto dos destinos estão em `app/src/ui/components/nav-items.ts` (`NAV_TABS`, `NAV_EXTRA`, `NAV_SETTINGS`, `NAV_TUTORIAL`); a tela traduz com `t()` e acrescenta o `href`. O nome do jogo e o logo da barra lateral o AppShell lê direto de `config/prancheta.config.ts`.

O roteamento é por estado simples (§3 da arquitetura); cada aba tem `href` (um endereço no histórico, para o voltar do celular funcionar) e o `onselect` deixa o `developer` interceptar o toque.

## Textos (chaves)

Nenhum texto fica no componente: as telas chamam `t(chave)` de `@lib/i18n` e passam o texto pronto por prop. As chaves vão para `app/src/content/<idioma>/ui.json` pelo `content-writer`; o rascunho em pt-BR é só para o CEO ler.

| Chave                  | Rascunho pt-BR                | Onde                                              |
| ---------------------- | ----------------------------- | ------------------------------------------------- |
| `nav.label`            | Navegação principal           | nome acessível da TabBar                          |
| `nav.skip`             | Pular para o conteúdo         | link de pular, primeiro foco no desktop           |
| `nav.tab.club`         | Clube                         | aba                                               |
| `nav.tab.squad`        | Elenco                        | aba                                               |
| `nav.tab.table`        | Tabela                        | aba                                               |
| `nav.tab.calendar`     | Calendário                    | aba                                               |
| `nav.news`             | Notícias                      | barra lateral e "Mais"                            |
| `nav.social`           | Rede social                   | barra lateral e "Mais"                            |
| `nav.saves`            | Carreiras e backup            | barra lateral e "Mais"                            |
| `nav.preferences`      | Preferências                  | barra lateral e "Mais"                            |
| `nav.about`            | Sobre                         | barra lateral e "Mais"                            |
| `nav.tutorial`         | Rever tutorial                | "Mais"                                            |
| `nav.more`             | Mais opções                   | nome acessível do ícone de menu e título da folha |
| `nav.back`             | Voltar                        | nome acessível do voltar                          |
| `nav.close`            | Fechar                        | fechar a folha                                    |
| `play.label`           | Jogar rodada                  | PlayRoundButton                                   |
| `play.busy`            | Calculando a rodada...        | PlayRoundButton em `busy` (leitor de tela)        |
| `play.blocked.lineup`  | Escalação incompleta          | motivo em `blocked`                               |
| `play.blocked.unsaved` | A última rodada não foi salva | motivo em `blocked` (proposta)                    |

O rótulo mais longo dos três idiomas (provavelmente "Calendario" e "Calendar" cabem; "Rede social" vira "Social network") é conferido na prévia a 360px; rótulo de aba quebra em duas linhas, nunca corta.

## Acessibilidade

- Abas e botões ≥ 44px; aba ativa com marcador (traço em cima no celular, barra à esquerda no desktop) e peso de texto, além da cor, e `aria-current="page"`.
- O PlayRoundButton nunca cobre o último item rolável: o conteúdo tem respiro embaixo igual à TabBar + botão + `env(safe-area-inset-bottom)`.
- Ordem de foco: link de pular (desktop), cabeçalho, avisos, conteúdo, botão "Jogar rodada", abas. No desktop a barra lateral vem antes do conteúdo no DOM, e o link de pular leva direto ao `main`.
- Anel de foco de 2px em `focus` em todo alvo (regra global de `app.css`).
- Troca de aba sem animação; o único movimento da moldura é o indicador de `busy`, desligado com `prefers-reduced-motion` (o texto continua).
- Contraste da aba inativa (`ink-muted` sobre `surface-1`) ≥ 4,5:1 nos dois temas; aba ativa em `grass` sobre `surface-1` com marcador.

## Marcas do cenário

Nenhuma.
