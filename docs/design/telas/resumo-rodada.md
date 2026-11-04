# Resumo da rodada

**Histórias:** US-019, US-041 (e saída para US-030, US-037, US-025) · **Prioridade:** Must · **Ordem:** 9

## Objetivo

Dizer em segundos como foi o jogo do clube e o que mudou na rodada.

## Conteúdo (de cima para baixo)

1. Scoreboard do jogo do clube, com StatusBadge de resultado (V, E ou D com texto) e autores dos gols com minuto.
2. BrandSlot (faixa de marca do cenário do resumo da rodada; decorativa, sem rótulo de publicidade e sem link).
3. Mudança na tabela: posição atual e variação em texto e seta.
4. Os outros 9 resultados (MatchCard `compact`), com autores dos gols ao tocar.
5. "Continuar" (primário) fixo embaixo: segue para a Entrevista (quando sorteada), o lembrete de exportar e o Fim de temporada (na rodada 38), ou volta à aba de origem.

## Ao alcance do polegar

"Continuar" fixo embaixo; nada mais exige toque.

## Estados

- **Carregando:** tela de carregamento curta com BrandSlot, se o cálculo da rodada demorar; "Jogar rodada" fica em `busy` antes disso, sem toque duplo.
- **Erro:** a rodada não aplicada mostra ErrorState com "Tentar de novo"; a carreira fica na rodada anterior (US-019, nunca estado intermediário).
- **Vazio:** não se aplica.
- **Offline:** nada muda.
- **Nova versão:** o aviso só aparece aqui, depois do salvamento (US-039).

## Componentes

Scoreboard, StatusBadge, BrandSlot, MatchCard, Button, Skeleton, ErrorState.

## Acessibilidade

O resultado é anunciado em texto ("vitória", "empate", "derrota" do conteúdo) ao abrir; nunca só pela cor do placar; sem confete nem animação de número com reduced motion.

## Marcas do cenário

Faixa abaixo do placar; tela de carregamento, se existir. Marcas fictícias de `brandForSlot`.
