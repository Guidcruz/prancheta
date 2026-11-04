# Tutorial (primeiros passos)

**Histórias:** US-042 · **Prioridade:** Should · **Ordem:** 21

## Objetivo

Ensinar, na primeira carreira, onde ficam elenco, escalação, tática e "Jogar rodada", sem manual.

## Conteúdo

Sequência de Coachmark sobre as telas reais, um passo por vez:

1. Elenco (aba e lista).
2. Escalação (campo e reservas).
3. Tática (grupos de opções).
4. "Jogar rodada".

Cada passo: o elemento-alvo realçado e um BottomSheet curto com o texto do conteúdo, a posição no guia (passo N de 4, em texto), "Próximo" (primário) e "Pular".

## Ao alcance do polegar

O texto e os botões ficam sempre embaixo; quando o alvo estiver embaixo (abas, "Jogar rodada"), a folha sobe acima dele sem cobri-lo.

## Estados

- Abre sozinho só na primeira carreira do aparelho; depois de concluído ou pulado, só por "Rever tutorial" (Sobre e menu "Mais").
- **Erro:** se o alvo não existir na tela, o passo aparece sem realce, com o texto.
- **Offline:** nada muda.
- Sem recompensa por concluir.

## Componentes

Coachmark, BottomSheet, Button.

## Acessibilidade

Foco vai para o passo atual; Esc fecha (equivale a "Pular"); o realce não depende só de cor (contorno com `focus`); sem animação de pulsar com reduced motion.

## Patrocínio

Nenhum.
