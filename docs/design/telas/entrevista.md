# Entrevista pós-jogo

**Histórias:** US-030 · **Prioridade:** Should · **Ordem:** 16

## Objetivo

Deixar o técnico responder à imprensa com uma escolha simples, que pesa na moral e na torcida.

## Conteúdo

BottomSheet sobre o Resumo da rodada, só quando sorteada:

1. Veículo e pergunta.
2. OptionGroup com 2 ou 3 respostas, cada uma com a pista de efeito em texto.
3. "Responder" (primário) e "Dispensar" (secundário, sempre visível).

## Ao alcance do polegar

A folha inteira fica na metade de baixo.

## Estados

- **Erro:** a folha fecha como "Dispensar" e registra o erro; nada muda no save.
- **Offline:** nada muda.
- Sem prazo nem contagem regressiva.

## Componentes

BottomSheet, OptionGroup/OptionCard, Button.

## Acessibilidade

Foco na pergunta ao abrir; Esc e voltar equivalem a "Dispensar"; sem animação de subida com reduced motion.

## Marcas do cenário

Nenhuma.
