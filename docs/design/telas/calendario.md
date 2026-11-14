# Calendário

**Histórias:** US-024 · **Prioridade:** Must · **Ordem:** 11

## Objetivo

Ver as 38 rodadas do clube, com o que vem e o que já foi, para planejar a rotação e rever a campanha.

## Conteúdo

1. Lista de MatchCard do clube por rodada (adversário, mando, rótulo de data, placar e StatusBadge V/E/D nas jogadas, "Clássico" quando for).
2. A próxima rodada em destaque (`state="next"`); a tela abre rolada nela.
3. Separador entre os turnos.
4. **Rodada (subtela):** ao tocar numa rodada jogada, abre a rodada inteira com os 10 resultados (o bloco "Outros resultados" do [Resumo da rodada](resumo-rodada.md), com os 10 jogos, sem o placar em destaque, sem a faixa de marca do cenário e sem "Continuar"). Tocar num jogo abre a **súmula** da T-030 (a mesma folha, com o caso "súmula sem lances" para as rodadas de `missingSheetRounds`), com os autores dos gols, os cartões, as trocas, o melhor em campo e os números.

## Ao alcance do polegar

Lista rolável; atalho "ir para a próxima rodada" embaixo quando ela sair da tela.

## Estados

- **Vazio:** não se aplica (calendário gerado no novo jogo).
- **Carregando:** Skeleton de cards.
- **Erro:** ErrorState.
- **Offline:** nada muda.

## Componentes

MatchCard, StatusBadge, Crest, BottomSheet ou tela para a rodada, Button.

## Acessibilidade

Resultado sempre com letra/ícone e texto acessível; destaque da próxima rodada com rótulo, não só cor; rolagem automática até a próxima rodada sem animação suave com reduced motion.

## Marcas do cenário

Nenhuma.
