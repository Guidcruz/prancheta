# Erros e avisos globais

**Histórias:** US-045, US-039, US-037, US-038 · **Prioridade:** Must · **Ordem:** 22 (a casca do ErrorState entra cedo, junto da moldura)

## Objetivo

Avisar o jogador do que importa sem interromper a rodada, e mostrar erros com saída clara.

## Erro inesperado (US-045)

- ErrorState em tela cheia: ícone, mensagem no idioma atual, "Tentar de novo" (primário) e "Voltar ao início".
- A carreira salva não é alterada; o registro local não leva dado pessoal.
- Erro dentro de um bloco (Clube, listas) usa o ErrorState pequeno no lugar do bloco.

## Nova versão e novidades (US-039)

- Banner `info` "nova versão disponível" com "Atualizar"; nunca durante a Partida, Intervalo ou Entrevista: espera o Resumo da rodada, já salvo.
- Pode ser adiado (fechar o Banner); volta na próxima abertura.
- Novidades: na primeira abertura da versão nova, Banner com "Ver novidades", que abre BottomSheet com as notas curtas.

## Armazenamento e backup (US-037)

- Persistência negada: Banner `warning` em Carreiras e backup (não em toda tela).
- Lembrete de exportar: no Fim de temporada.

## Offline (US-038)

- Sem aviso global: o jogo é offline por desenho. Só links externos e a busca de nova versão dizem que precisam de conexão.

## Componentes

ErrorState, Banner, BottomSheet, Button.

## Acessibilidade

Banners com ícone + texto e `role="status"` (erros com `role="alert"`); nada de aviso que cubra o "Jogar rodada" ou as abas; Banner sem animação de entrada com reduced motion.

## Patrocínio

Nenhum.
