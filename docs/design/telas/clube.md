# Clube

**Histórias:** US-015, US-026, US-028 (e US-029 no bloco da rede) · **Prioridade:** Must · **Ordem:** 4

## Objetivo

Mostrar num relance onde o clube está e o que vem a seguir, para o jogador decidir se mexe no time ou joga a rodada.

## Conteúdo (de cima para baixo)

1. ScreenHeader: escudo, nome do clube, temporada e rodada.
2. **Próximo jogo:** MatchCard em destaque com adversário, mando em texto e "Clássico" quando for o caso; toque leva ao Calendário.
3. **Posição na tabela:** posição, pontos e as linhas vizinhas (TableRow compacta); toque leva à Tabela.
4. **Termômetro da torcida:** FanThermometer com número e rótulo de humor em texto.
5. **Últimas notícias:** 2 ou 3 NewsCard e "Ver todas" (Notícias).
6. **Rede social:** prévia de 1 ou 2 SocialPost e "Ver feed"; o bloco some se a rede estiver desligada (US-044).
7. **Mais:** LinkRow para Carreiras e backup, Preferências, Sobre e Rever tutorial.

## Ao alcance do polegar

"Jogar rodada" (flutuante) e TabBar. Os blocos de leitura ficam em cima; os atalhos do item 7 ficam no fim da rolagem, perto do polegar.

## Estados

- **Vazio:** antes da rodada 1, a posição mostra a tabela zerada em ordem definida pelo motor, e notícias/rede mostram EmptyState de pré-temporada (texto do conteúdo).
- **Carregando:** Skeleton por bloco.
- **Erro:** um bloco que falhar mostra ErrorState pequeno no lugar dele; os outros continuam.
- **Offline:** nada muda.

## Componentes

ScreenHeader, Crest, MatchCard, TableRow, FanThermometer, NewsCard, SocialPost, LinkRow, EmptyState, Skeleton.

## Acessibilidade

- Cada bloco tem título de seção (cabeçalho semântico) e é inteiro tocável ≥ 44px.
- Termômetro: número e rótulo em texto; a barra é decorativa (`aria-hidden`), com `role="meter"` no contêiner.
- Sem animação de enchimento do termômetro com reduced motion.

## Desktop

Duas colunas: próximo jogo e tabela à esquerda; termômetro, notícias e rede à direita.

## Marcas do cenário

Nenhuma.
