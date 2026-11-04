# Carreiras e backup (saves)

**Histórias:** US-034, US-035, US-036, US-037 · **Prioridade:** Must · **Ordem:** 18

## Objetivo

Gerenciar as carreiras do aparelho e garantir que o jogador não perca nenhuma.

## O que o jogador faz

Abre outra carreira, exporta, importa, apaga (com confirmação dupla) e vê se o armazenamento está protegido.

## Conteúdo

1. ScreenHeader com voltar (abre do Início e do menu "Mais").
2. Banner de armazenamento não persistente, quando o navegador negou (US-037): recomenda instalar o app e exportar.
3. Lista de CareerCard da mais recente para a mais antiga (escudo, clube, temporada, rodada, data); a carreira aberta marcada como atual.
4. Ações por carreira: Continuar, Exportar, Apagar (em menu da carta, ≥ 44px).
5. "Importar save" (secundário) no pé.

## Fluxos em folha

- **Exportar:** aviso de que o apelido do técnico vai junto no arquivo; depois a folha de compartilhar do sistema (ou download no desktop).
- **Apagar:** 1ª folha oferece exportar antes; 2ª folha pede confirmação explícita, com o botão destrutivo em `danger`; cancelar em qualquer uma não apaga nada.
- **Importar:** escolha do arquivo; se a carreira já existir, folha comparando as duas versões (clube, temporada, rodada, data) com "Substituir" e "Guardar separada"; recusas (arquivo corrompido, de outro tipo, grande demais, versão mais nova) com mensagem em texto e nada alterado.

## Ao alcance do polegar

Ações das cartas e "Importar save" embaixo; as folhas sobem de baixo.

## Estados

- **Vazio:** sem carreiras: EmptyState com "Novo jogo" e "Importar save".
- **Carregando:** Skeleton de cartas; exportar e importar com botão em `busy`.
- **Erro:** mensagens próprias de importação; erro ao listar com ErrorState.
- **Offline:** exportar e importar funcionam.

## Componentes

ScreenHeader, CareerCard, Crest, Banner, BottomSheet, ConfirmSheet, Button, EmptyState, Skeleton.

## Acessibilidade

Confirmação destrutiva nunca pré-focada no botão de apagar; mensagens de recusa ligadas por `aria-live`; nenhum ícone sozinho nas ações (sempre com rótulo).

## Marcas do cenário

Nenhuma.
