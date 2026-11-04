# Intervalo

**Histórias:** US-022 · **Prioridade:** Should · **Ordem:** 13

## Objetivo

Deixar o técnico falar com o elenco uma vez por jogo, escolhendo o tom da conversa.

## Conteúdo

1. Scoreboard do primeiro tempo (com a faixa de marca do cenário, decorativa).
2. Resumo curto do primeiro tempo (gols e cartões, da narração).
3. OptionGroup com 3 opções (motivar, cobrar, acalmar), cada uma com frase de efeito do conteúdo.
4. "Pular" (secundário) e a confirmação da escolha como primário; acesso a Substituir e Tática, como na Partida.

## Ao alcance do polegar

Opções e botões na metade de baixo.

## Estados

- **Carregando:** não se aplica (a partida já está calculada até aqui).
- **Erro:** ErrorState; a partida segue sem conversa (equivale a pular).
- **Offline:** nada muda.
- Só aparece em "animada completa" e "só lances principais".

## Componentes

Scoreboard, OptionGroup/OptionCard, Button, BottomSheet, BrandSlot.

## Acessibilidade

Grupo de rádio com legenda; foco vai para o título ao abrir; nenhuma contagem regressiva para escolher.

## Marcas do cenário

Faixa do placar (marca fictícia de `brandForSlot`, sem rótulo e sem link).
