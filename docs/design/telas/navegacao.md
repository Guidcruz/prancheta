# Moldura e navegação

**Histórias:** US-015 · **Prioridade:** Must · **Ordem:** 1

## Objetivo

Dar à carreira uma moldura única em que o jogador alcança tudo com o polegar e nunca perde o "Jogar rodada" de vista.

## Conteúdo

- **Celular:** ScreenHeader no topo (título da tela, voltar quando houver, ícone de menu "Mais" à direita); conteúdo rolável; PlayRoundButton centralizado acima da TabBar; TabBar fixa embaixo com Clube, Elenco, Tabela e Calendário, cada aba com ícone e rótulo.
- **Desktop:** TabBar em `orientation="side"` com os mesmos destinos mais Notícias, Rede social, Carreiras, Preferências e Sobre; "Jogar rodada" fixo no pé da barra lateral; conteúdo com largura máxima de leitura.
- **Menu "Mais"** (BottomSheet no celular): Notícias, Rede social (se ligada), Carreiras e backup, Preferências, Sobre, Rever tutorial.

## Ao alcance do polegar

TabBar, "Jogar rodada" e o conteúdo de baixo. O menu "Mais" fica no topo de propósito: é usado raramente; as mesmas entradas também estão no pé da tela Clube.

## Estados

- **Carregando a carreira:** Skeleton na área de conteúdo; TabBar visível; "Jogar rodada" em `busy`.
- **Erro ao abrir a carreira:** ErrorState em tela cheia (ver [erros-e-avisos.md](erros-e-avisos.md)).
- **Rodada bloqueada** (escalação incompleta): o botão continua tocável; ao tocar, abre a folha de US-017 com "Completar automaticamente". Nunca some nem fica cinza sem explicação.
- **Offline:** nada muda.

## Componentes

AppShell, TabBar, PlayRoundButton, ScreenHeader, BottomSheet, LinkRow, Icon.

## Acessibilidade

- Abas e botões ≥ 44px; aba ativa com marcador (traço ou pílula) além da cor e `aria-current="page"`.
- O PlayRoundButton nunca cobre o último item rolável (respiro embaixo do conteúdo).
- Ordem de foco: conteúdo, botão "Jogar rodada", abas. Link "pular para o conteúdo" no desktop.
- Troca de aba sem animação de deslizar quando `prefers-reduced-motion`.
- Contraste da aba inativa (`ink-muted` sobre `surface-1`) ≥ 4,5:1 nos dois temas.

## Patrocínio

Nenhum.
