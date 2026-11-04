# Elenco

**Histórias:** US-016 · **Prioridade:** Must · **Ordem:** 5

## Objetivo

Ver o estado de todos os atletas de uma vez para decidir quem joga.

## O que o jogador faz

Lê o elenco, ordena por posição, nota ou fadiga e toca num atleta para ver o card completo.

## Conteúdo

1. SegmentedControl no topo: **Elenco** | Escalação | Tática (a mesma aba; a última escolhida é lembrada).
2. SegmentedControl de ordenação: posição, nota, fadiga.
3. ScrollTable: coluna fixa com posição e nome (e StatusBadge de situação); colunas que rolam para o lado: idade, nota geral, forma, moral, fadiga. Forma, moral e fadiga em número ou ícone com rótulo, conforme a escala do `game-designer`.
4. Titulares e reservas separados por um cabeçalho de grupo, para o jogador ver quem está escalado.

Potencial não aparece em lugar nenhum.

## Ao alcance do polegar

A lista inteira é tocável; "Jogar rodada" flutua acima da TabBar.

## Estados

- **Vazio:** não se aplica (elenco sempre gerado); se uma ordenação não tiver efeito, nada muda.
- **Carregando:** Skeleton de linhas.
- **Erro:** ErrorState na área da lista.
- **Offline:** nada muda.

## Componentes

SegmentedControl, ScrollTable, PlayerCard (`row`), StatusBadge, Skeleton, ErrorState.

## Acessibilidade

- Linhas ≥ 44px; nome e situação sempre na coluna fixa.
- "Suspenso" e "Lesionado, N rodadas" como ícone + texto (US-016).
- Cabeçalhos ordenáveis com `aria-sort`; números em `tabular-nums`.
- Funciona a 360px com a coluna fixa ocupando no máximo cerca de metade da largura; nomes longos cortam com reticências e mostram completo no card.

## Desktop

Todas as colunas visíveis sem rolagem; o card do jogador abre em painel à direita.

## Patrocínio

Nenhum.
