# Carreiras e backup (saves)

**Histórias:** US-034, US-035, US-036, US-037 · **Prioridade:** Must · **Ordem:** 18 · **Tarefas:** T-025 (lista e apagar), T-020 (exportar e importar)

## Objetivo

Gerenciar as carreiras do aparelho de dentro da carreira aberta e garantir que o jogador não perca nenhuma.

## O que o jogador faz

Vê as carreiras do aparelho, apaga as que não quer (com confirmação dupla) e, com a T-020, exporta e importa. É também o destino de "Liberar espaço" quando o aparelho fica sem espaço para salvar (`quota-exceeded`).

## Onde fica

- **Fora da carreira**, a lista mora no próprio [Início](inicio.md): com no máximo 10 carreiras, não há tela separada.
- **Dentro da carreira**, esta tela abre pelo menu "Mais" (celular) e pela barra lateral (desktop), dentro da moldura (`nav.saves`), e por "Liberar espaço". Ela fica na moldura, e não manda ao Início, porque sair da carreira com uma rodada não salva perderia a rodada na memória.

## Conteúdo

1. ScreenHeader "Carreiras e backup" com voltar.
2. Banner de armazenamento não persistente, quando o navegador negou (US-037): recomenda instalar o app e exportar (T-020).
3. Lista de CareerCard `row`, da mais recente para a mais antiga, a mesma do Início (mesmas linhas e textos, `home.career.*`). A carreira aberta vem primeiro, com o selo "Atual" (`saves.current`).
4. Ações por carreira, no botão "Mais ações" (três pontos, ≥ 44px), numa folha: **Exportar carreira** (T-020) e **Apagar carreira**. Tocar na linha de outra carreira não troca de carreira daqui (seria fechar a atual): a linha não é tocável, só as ações. Linha que não abre nada **não é botão** (nem `button`, nem `role="button"`, nem cursor de mão): é texto comum, e o único controle dela é o "Mais ações", com nome que cita o clube. Assim o leitor de tela não anuncia um botão que não faz nada.
5. "Importar backup" (secundário) no pé (T-020).

### O que a T-025 entrega aqui

A lista (itens 1 e 3), o selo "Atual" e o apagar com a mesma confirmação dupla do Início ([inicio.md](inicio.md), "Apagar com confirmação dupla"). Exportar, importar e o Banner de persistência entram com a T-020. Sem isso, "Liberar espaço" não teria para onde levar.

### A carreira aberta

- A folha de ações dela não tem "Apagar carreira"; no lugar, uma linha em texto: `saves.current.noDelete` ("Para apagar a carreira aberta, volte ao início primeiro."). Apagar a carreira em uso fecharia a tela por baixo do jogador, e com uma rodada não salva apagaria o que ele tenta salvar.
- Depois de apagar outra carreira para liberar espaço, o Banner `quota-exceeded` continua na faixa de avisos com "Tentar de novo"; o jogador toca nele, e a rodada é salva.

## Fluxos em folha

- **Exportar (T-020):** aviso de que o apelido do técnico vai junto no arquivo; depois a folha de compartilhar do sistema (ou download no desktop).
- **Apagar (T-025):** igual ao Início: passo 1 oferece exportar antes (com a T-020), passo 2 pede confirmação explícita, com o botão destrutivo em `danger`; cancelar em qualquer um não apaga nada. Valem as mesmas proteções contra toque duplo e a mesma medida de [inicio.md](inicio.md), "Apagar com confirmação dupla": janela de cerca de 500 ms em cada passo; "Cancelar" sempre por último e no mesmo lugar nas três folhas (ações, passo 1, passo 2); o passo 2 é um ConfirmSheet com `finalStep`, com um separador que deixa o "Apagar carreira" pelo menos 56 px acima do lugar do "Quero apagar" no celular. Vale também a mesma entrada única no histórico para o fluxo inteiro.
- **Importar (T-020):** escolha do arquivo; se a carreira já existir, folha comparando as duas versões (clube, temporada, rodada, data) com "Substituir" e "Guardar separada"; recusas (arquivo corrompido, de outro tipo, grande demais, versão mais nova) com mensagem em texto e nada alterado.

## Ao alcance do polegar

Ações das cartas e "Importar backup" embaixo; as folhas sobem de baixo, com "Cancelar" por último e no mesmo lugar em todas as folhas do apagar (no passo final, o destrutivo fica acima de um separador).

## Estados

- **Carregando:** Skeleton de cartas; exportar e importar com botão em `busy`.
- **Só a carreira aberta:** a lista com uma carta e, abaixo, `saves.onlyCurrent` ("Esta é a única carreira deste aparelho."). Nunca vazia: a tela só existe com uma carreira aberta.
- **Carreira danificada** (`all-corrupt` ao abrir, vista daqui): a carta ganha o selo `home.badge.damaged` com ícone e texto; ações: apagar e, com a T-020, importar backup.
- **Erro ao listar:** ErrorState `block` com "Tentar de novo".
- **Erro ao apagar:** a mensagem `delete.failed` na folha do passo 2; nada apagado.
- **Offline:** exportar e importar funcionam.

## Componentes

ScreenHeader, CareerCard, Crest, Banner, BottomSheet, ConfirmSheet, Button, Skeleton, ErrorState.

## Textos (chaves)

As da lista e do apagar são as do Início (`home.career.*`, `delete.*`). Novas:

| Chave                    | Rascunho pt-BR                                           | Onde                                     |
| ------------------------ | -------------------------------------------------------- | ---------------------------------------- |
| `saves.title`            | Carreiras e backup                                       | cabeçalho (o mesmo texto de `nav.saves`) |
| `saves.current`          | Atual                                                    | selo da carreira aberta                  |
| `saves.current.noDelete` | Para apagar a carreira aberta, volte ao início primeiro. | folha de ações da carreira aberta        |
| `saves.onlyCurrent`      | Esta é a única carreira deste aparelho.                  | sob a lista com uma carta                |

## Acessibilidade

Confirmação destrutiva nunca pré-focada no botão de apagar; mensagens de recusa ligadas por `aria-live`; nenhum ícone sozinho nas ações (sempre com rótulo); o selo "Atual" é texto, não só destaque de cor.

## Marcas do cenário

Nenhuma.
