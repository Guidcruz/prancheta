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

### Cor de setor no LineupChip

Decisão do CEO de 2026-11-07 (regra em [design-system.md](../design-system.md#cor-de-setor-aprovado-pelo-ceo-em-2026-11-07)). O `LineupChip` é da T-029 e está sendo feito em outra branch; esta nota diz como ele recebe a cor, para quem o terminar.

- **O chip mostra a sigla com o `PositionTag`,** nunca uma caixinha própria: `<PositionTag code={positionCode} sector={sector} hidden />`, com `hidden` porque o nome acessível do chip já diz a posição.
- **O chip ganha a prop `sector`** (tipo `Sector` de `app/src/ui/components/sectors.ts`) e a repassa ao `PositionTag`. A tela calcula `SECTOR_OF[player.position]`: a cor é da **posição natural do jogador**, a mesma sigla do Elenco, não da vaga. Um zagueiro improvisado no meio continua com a sigla ZAG em azul, e o selo "fora de posição" (ícone e texto) diz o resto; o lugar no campo já diz a linha da vaga.
- **Vaga vazia:** sem jogador, sem sigla e sem cor de setor.
- **Reservas** abaixo do campo usam a `PlayerRow`, que já recebe `sector`.
- Só fundo e borda da sigla; o nome, o número e o selo do chip não levam cor de setor.

## Componentes

SegmentedControl, StrengthBars, LineupPitch, LineupChip (com `PositionTag`), PlayerCard (`row`), StatusBadge, Banner, BottomSheet, Button.

## Acessibilidade

- Posições no campo ≥ 44px mesmo em 5-3-2 a 360px (linha mais cheia com 5 alvos).
- Arrastar nunca é o único jeito (toque em dois passos e teclado).
- "Fora de posição" com ícone + texto; seleção com marcador, não só cor.
- Sem animação de troca de lugar com reduced motion.

## Desktop

Campo à esquerda e reservas à direita, lado a lado.

## Marcas do cenário

Nenhuma.
