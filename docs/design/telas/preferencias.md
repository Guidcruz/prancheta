# Preferências

**Histórias:** US-044, US-040, US-037 (e US-020 pela vibração) · **Prioridade:** Should · **Ordem:** 19

## Objetivo

Deixar o jogador ajustar o jogo ao seu jeito; vale para todas as carreiras do aparelho.

## Conteúdo

1. ScreenHeader com voltar.
2. **Tema:** SegmentedControl noite | dia (noite padrão), com efeito imediato.
3. **Idioma:** LinkRow com o idioma atual, abrindo BottomSheet com os idiomas liberados pela P4; troca sem reiniciar a carreira.
4. **Vibração:** Toggle; só aparece se o aparelho suportar vibração.
5. **Rede social:** Toggle para mostrar ou esconder.
6. **Lembrete de exportar:** Toggle (religa o "Não lembrar mais").
7. Atalho para Sobre.

## Ao alcance do polegar

Lista curta; cada linha inteira é tocável.

## Estados

- **Carregando:** não se aplica (preferências locais e pequenas).
- **Erro:** falha ao gravar mostra Banner e mantém o valor anterior.
- **Offline:** nada muda.

## Componentes

ScreenHeader, SegmentedControl, LinkRow, Toggle, BottomSheet, Banner.

## Acessibilidade

Toggle com estado em texto; nomes dos idiomas escritos no próprio idioma; troca de tema sem transição animada com reduced motion; contraste conferido nos dois temas pelo `npm run tokens`.

## Marcas do cenário

Nenhuma.
