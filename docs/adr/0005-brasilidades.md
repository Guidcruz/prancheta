# ADR-0005: Situações do futebol brasileiro como sistemas de jogo

- **Status:** aceita
- **Data:** 2026-11-03
- **Decisores:** CEO (pediu), Orquestrador (pesquisou os casos e registrou)

## Contexto

O CEO quer que o jogo tenha o que acontece de verdade no futebol brasileiro: transfer ban, salários atrasados, STJD com efeito suspensivo, viradas de mesa, estrutura de clube e SAF. E quer saber se comissão técnica e estrutura afetam treino e evolução.

## Decisão

Entram como sistemas de consequência, descritos em `docs/design/brasilidades.md`: salários e transfer ban na Etapa 3 (finanças), STJD na Etapa 2 (calendário completo), estrutura e comissão técnica na Etapa 3, sócio-torcedor na Etapa 3, SAF e dívida herdada na Etapa 4; o termômetro da torcida volta para o jogo (mando de campo, público, moral, pressão) desde a Etapa 1a. Comissão técnica e estrutura afetam treino, evolução, fadiga, lesões, base e olheiros por multiplicadores simples (0,8 a 1,2). Tudo com aviso antes da escolha; nada de azar puro; nada de doping, manipulação ou apostas.

## Consequências

- **Positivo:** o jogo ganha histórias que todo torcedor reconhece; as decisões financeiras passam a ter peso.
- **Negativo:** mais parâmetros para balancear; o `/balance` precisa medir frequência desses eventos para não virar tragédia toda temporada.
- **Pendências:** o `game-designer` fecha as fórmulas em cada etapa; o `content-writer` escreve as notícias e conversas de cada situação.
