# Calendário

**Histórias:** US-024 · **Prioridade:** Must · **Ordem:** 11

## Objetivo

Ver as 38 rodadas do clube, com o que vem e o que já foi, para planejar a rotação e rever a campanha.

## Conteúdo

1. Lista de MatchCard do clube por rodada (adversário, mando, rótulo de data, placar e StatusBadge V/E/D nas jogadas, "Clássico" quando for).
2. A próxima rodada em destaque (`state="next"`); a tela abre rolada nela.
3. Separador entre os turnos.
4. **Rodada (subtela):** ao tocar numa rodada jogada, abre a rodada inteira com os 10 resultados e autores dos gols (mesmo bloco do Resumo da rodada, sem patrocínio nem "Continuar").

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

## Patrocínio

Nenhum.
