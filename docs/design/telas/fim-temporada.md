# Fim de temporada

**Histórias:** US-025, US-037 · **Prioridade:** Must · **Ordem:** 17

## Objetivo

Encerrar a temporada com o campeão e a classificação final, e oferecer a próxima.

## Conteúdo

1. Campeão: Crest grande e nome; se for o clube do jogador, a cerimônia de título (escudo, nome e destaque em `floodlight`).
2. Posição final do clube do jogador em texto.
3. Classificação final (ScrollTable + TableRow), com as 4 últimas marcadas como zona de rebaixamento e o aviso, do conteúdo, de que acesso e rebaixamento entram numa próxima versão (P2).
4. Lembrete de exportar (US-037), se ligado: Banner com "Exportar" e "Não lembrar mais".
5. "Próxima temporada" (primário) fixo embaixo.

## Ao alcance do polegar

"Próxima temporada" e as ações do lembrete.

## Estados

- **Carregando:** ao tocar "Próxima temporada", tela de carregamento com SponsorSlot enquanto a virada é calculada.
- **Erro:** ErrorState; a carreira continua no fim da temporada anterior.
- **Offline:** nada muda (exportar funciona offline).

## Componentes

Crest, ScrollTable, TableRow, StatusBadge, Banner, Button, SponsorSlot (carregamento).

## Acessibilidade

Com reduced motion, cerimônia estática (US-025); campeão anunciado em texto; zona com ícone e legenda.

## Patrocínio

Só na tela de carregamento da virada.
