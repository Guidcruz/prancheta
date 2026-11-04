# Rede social

**Histórias:** US-029, US-044 · **Prioridade:** Must · **Ordem:** 15

## Objetivo

Mostrar o humor da torcida e da TV em posts fictícios, sem nenhum usuário real.

## Conteúdo

1. ScreenHeader com voltar.
2. Aviso fixo e discreto de que todos os perfis e posts são fictícios, gerados pelo jogo.
3. Feed de SocialPost da rodada mais recente para a mais antiga: Avatar, nome, tipo do perfil em texto (torcedor, canal de TV), conteúdo, curtidas e comentários em número; comentários fictícios expansíveis.
4. Não há campo de escrever, curtir ou responder na 1a.

## Ao alcance do polegar

Feed rolável; expandir comentários tocando no post.

## Estados

- **Vazio:** antes da primeira rodada, EmptyState.
- **Desligada nas Preferências:** a entrada some do Clube, do menu e da barra lateral; quem abrir pelo endereço vê EmptyState com atalho para Preferências.
- **Carregando:** Skeleton de posts.
- **Erro:** ErrorState.
- **Offline:** nada muda (nenhuma requisição de rede, US-029).

## Componentes

ScreenHeader, SocialPost, Avatar, EmptyState, Skeleton, Banner (aviso de ficção).

## Acessibilidade

Humor do post nunca indicado só por cor; números com rótulo acessível ("N curtidas"); avatares decorativos (`aria-hidden`) porque o nome está ao lado.

## Marcas do cenário

Nenhuma.
