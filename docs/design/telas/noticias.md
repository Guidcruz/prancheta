# Notícias

**Histórias:** US-028 · **Prioridade:** Must · **Ordem:** 14

## Objetivo

Contar a história do clube rodada a rodada em manchetes de veículos fictícios.

## Conteúdo

1. ScreenHeader com voltar (aberta a partir do Clube ou do menu "Mais").
2. Filtro opcional (SegmentedControl): meu clube | rodada geral.
3. Lista de NewsCard da mais recente para a mais antiga, agrupada por rodada; cada card com veículo em texto, manchete e corpo expansível.
4. Fim da lista: aviso discreto de que notícias antigas são descartadas no limite do histórico.

## Ao alcance do polegar

Lista rolável; expandir tocando no card inteiro.

## Estados

- **Vazio:** antes da primeira rodada, EmptyState com texto do conteúdo.
- **Carregando:** Skeleton de cards.
- **Erro:** ErrorState.
- **Offline:** nada muda.

## Componentes

ScreenHeader, SegmentedControl, NewsCard, EmptyState, Skeleton.

## Acessibilidade

Manchete como cabeçalho; card expansível com `aria-expanded`; texto em `body` com contraste ≥ 4,5:1; nenhum logo de veículo (só nome em texto).

## Marcas do cenário

Nenhuma.
