# Partida

**Histórias:** US-020, US-021, US-041 · **Prioridade:** Must · **Ordem:** 12

## Objetivo

Fazer o jogador sentir a tensão do jogo e mexer no time na hora certa, sem nunca mudar o resultado pela animação.

## O que o jogador faz

Assiste aos lances (todos os visíveis ou só os principais), pausa para dar comandos, substituir ou mudar a tática, e pode pular para o fim.

## Conteúdo (de cima para baixo, celular)

1. Scoreboard: escudos, placar, minuto, faixa de patrocínio do placar; nome do estádio, se houver.
2. MatchPitch (canvas): campo visto de cima, bolinhas nas cores dos uniformes, placas de patrocínio em volta.
3. CommentaryFeed: narração com minuto, a mais recente em cima ou embaixo conforme o teste de uso (decidir na casca; recomendação: a mais recente embaixo, perto do polegar).
4. Barra de controles fixa embaixo: Pausar/continuar, Comandos, Substituir (com o número restante), Tática, Pular.
5. GoalCelebration sobre o campo quando há gol: escudo e nome do artilheiro.

Folhas (BottomSheet, com a partida pausada): Comandos (pressionar, segurar o resultado, todo mundo no ataque), Substituir (titular sai, reserva entra; recusa com motivo ao passar do limite), Tática (formação, postura, pressão).

## Ao alcance do polegar

Toda a barra de controles e as folhas. O placar fica em cima, só para leitura.

## Estados

- **Carregando:** tela de carregamento com SponsorSlot se a simulação demorar.
- **Erro:** ErrorState com "Tentar de novo"; a rodada não é aplicada pela metade (US-019).
- **Pausada:** controles visíveis, indicação "pausada" em texto.
- **Offline:** nada muda.
- **Nova versão:** aviso suprimido até o Resumo (US-039).

## Componentes

Scoreboard, MatchPitch, CommentaryFeed, GoalCelebration, SponsorSlot, BottomSheet, OptionGroup, PlayerCard (`row`), Button, StatusBadge.

## Acessibilidade

- Tudo o que o canvas mostra de importante (gol, cartão, substituição, minuto) também está em texto na narração e no placar; o canvas tem `aria-hidden` e um resumo acessível.
- Gols, cartões e fim de tempo anunciados por `aria-live="polite"`; o resto não, para não inundar o leitor de tela.
- **Reduced motion:** sem câmera lenta, tremor, comemoração animada nem movimento das bolinhas; a narração e o placar mudam sem movimento (US-020). A pausa dramática vira só o atraso do texto, sem efeito visual.
- Sem flashes acima de 3 por segundo.
- Vibração só no gol do próprio clube e só se ligada nas Preferências.
- Controles ≥ 44px; "Pular" separado dos outros para não ser tocado sem querer.

## Desktop

Campo à esquerda; placar, narração e controles numa coluna à direita.

## Patrocínio

Placas do campo, faixa do placar, tela de carregamento e, se existir, nome do estádio.
