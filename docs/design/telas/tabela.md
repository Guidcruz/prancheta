# Tabela

**Histórias:** US-023 · **Prioridade:** Must · **Ordem:** 10

## Objetivo

Mostrar a classificação legível no celular, com o clube do jogador e as zonas fáceis de achar.

## Conteúdo

1. ScreenHeader com a rodada atual.
2. ScrollTable: coluna fixa com posição, mudança (seta + número), escudo e nome; colunas roláveis P, J, V, E, D, GP, GC, SG.
3. Marcas de zona (líder/título e as 4 últimas) por ícone ou letra na linha, além da cor.
4. Legenda das zonas e das setas abaixo da tabela.
5. Atalho "ir para o meu clube" quando a linha dele estiver fora da tela.

## Ao alcance do polegar

Rolagem vertical e lateral; o atalho do item 5 fica embaixo, acima do "Jogar rodada".

## Estados

- **Vazio:** antes da rodada 1, tabela zerada, sem setas.
- **Carregando:** Skeleton de linhas.
- **Erro:** ErrorState.
- **Offline:** nada muda.

## Componentes

ScreenHeader, ScrollTable, TableRow, StatusBadge, Crest, Button.

## Acessibilidade

- Meu clube com destaque visual (fundo `surface-2` e marcador) e rótulo acessível "seu clube".
- Setas animadas só sem reduced motion; com ela, a seta aparece parada; "+2" sempre em texto.
- Números em `tabular-nums`; cabeçalhos com nome completo acessível (P = pontos etc., do conteúdo).
- A 360px a coluna fixa mostra nome curto do clube se o completo não couber.

## Desktop

Todas as colunas visíveis, sem rolagem lateral.

## Patrocínio

Nenhum na 1a (o nome patrocinado da competição, se houver, ficaria no cabeçalho; não previsto na 1a).
