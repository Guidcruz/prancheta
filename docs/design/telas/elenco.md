# Elenco

**Histórias:** US-016 · **Prioridade:** Must · **Ordem:** 5

## Objetivo

Ver o estado de todos os atletas de uma vez para decidir quem joga.

## O que o jogador faz

Lê o elenco, ordena por posição, nota ou condição e toca num atleta para ver o card completo.

## Conteúdo

1. SegmentedControl no topo: **Elenco** | Escalação | Tática (a mesma aba; a última escolhida é lembrada).
2. SegmentedControl de ordenação: posição, nota, condição (ordenar por condição põe os mais cansados primeiro).
3. ScrollTable: coluna fixa com posição e nome (e StatusBadge de situação); colunas que rolam para o lado: idade, nota geral, forma, moral, condição. Condição e moral em número de 0 a 100 (condição 100 = descansado, `docs/design/jogadores.md`); forma em número ou ícone com rótulo, conforme a escala do `game-designer`.
4. Titulares e reservas separados por um cabeçalho de grupo, para o jogador ver quem está escalado.

O número do potencial não aparece em lugar nenhum. Se o CEO aprovar a proposta do `game-designer`, jovens com potencial alto levam o StatusBadge "promessa" na coluna fixa (regra em `docs/design/jogadores.md`; ver jogador.md).

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
