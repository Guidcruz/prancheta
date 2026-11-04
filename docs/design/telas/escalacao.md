# Escalação

**Histórias:** US-017 · **Prioridade:** Must · **Ordem:** 7

## Objetivo

Montar os 11 titulares rapidamente, com uma mão, sabendo o efeito de cada troca.

## O que o jogador faz

Arrasta um reserva sobre um titular (ou toca no reserva e depois na posição), vê a força por setor mudar e, se quiser, usa "Sugerir escalação".

## Conteúdo

1. SegmentedControl: Elenco | **Escalação** | Tática.
2. StrengthBars com a força por setor (número + barra).
3. LineupPitch com a formação atual (DOM): cada posição mostra número, nome curto e, quando for o caso, StatusBadge "fora de posição".
4. Lista de reservas (PlayerCard `row`) abaixo do campo, com situação; suspensos e lesionados aparecem marcados e não podem ser escolhidos como titular.
5. Ações secundárias: "Sugerir escalação" (rotina da IA, US-011).

## Ao alcance do polegar

Reservas e ações ficam abaixo do campo, na metade de baixo. Fluxo em dois toques: tocar no reserva (fica selecionado, com marcador) e depois na posição; no desktop, arrastar com o mouse ou usar teclado (Enter para pegar, setas para mover, Enter para soltar).

## Estados

- **Escalação incompleta:** aviso em Banner no topo do campo; ao tocar "Jogar rodada", folha com "Completar automaticamente" (US-017).
- **Ação recusada:** suspenso/lesionado como titular: a troca não acontece e aparece a mensagem do motivo junto ao atleta (e anunciada por `aria-live`).
- **Carregando:** Skeleton do campo.
- **Erro:** ErrorState; escalação anterior preservada.
- **Offline:** nada muda.

## Componentes

SegmentedControl, StrengthBars, LineupPitch, PlayerCard (`row`), StatusBadge, Banner, BottomSheet, Button.

## Acessibilidade

- Posições no campo ≥ 44px mesmo em 5-3-2 a 360px (linha mais cheia com 5 alvos).
- Arrastar nunca é o único jeito (toque em dois passos e teclado).
- "Fora de posição" com ícone + texto; seleção com marcador, não só cor.
- Sem animação de troca de lugar com reduced motion.

## Desktop

Campo à esquerda e reservas à direita, lado a lado.

## Patrocínio

Nenhum.
