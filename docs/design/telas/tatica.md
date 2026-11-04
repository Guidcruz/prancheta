# Tática

**Histórias:** US-018 · **Prioridade:** Must · **Ordem:** 8

## Objetivo

Escolher formação, postura e pressão e definir capitão e cobradores, entendendo o efeito de cada opção numa frase.

## Conteúdo

1. SegmentedControl: Elenco | Escalação | **Tática**.
2. **Formação:** OptionGroup com as 6 formações em grade (2 ou 3 colunas), cada uma com miniatura do desenho e frase de efeito; prévia no LineupPitch reduzido, com os mesmos 11 redistribuídos.
3. **Postura:** OptionGroup com 3 opções e frase de efeito.
4. **Pressão:** OptionGroup com 3 opções e frase de efeito.
5. **Funções:** LinkRow para capitão, cobrador de pênalti e cobrador de falta, cada uma mostrando quem está e abrindo BottomSheet com a lista ordenável de titulares (a ordem define o substituto, US-018).

## Ao alcance do polegar

Postura, pressão e funções ficam na metade de baixo depois da rolagem; formação, a escolha mais rara, fica em cima. A tática vale ao sair da tela, sem botão "Salvar".

## Estados

- **Carregando:** Skeleton dos grupos.
- **Erro:** ErrorState; tática anterior preservada.
- **Vazio:** sem lista de cobradores definida, a linha mostra o critério automático em texto.
- **Offline:** nada muda.

## Componentes

SegmentedControl, OptionGroup/OptionCard, LineupPitch (prévia), LinkRow, BottomSheet, PlayerCard (`row`).

## Acessibilidade

Cada grupo é um grupo de rádio com legenda; selecionado com ícone de marcado; reordenar a lista de cobradores também por botões subir/descer (não só arrastar); a prévia do campo é complementar ao texto.

## Patrocínio

Nenhum.
