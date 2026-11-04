# Início

**Histórias:** US-034, US-043 · **Prioridade:** Must · **Ordem:** 2

## Objetivo

Abrir o jogo e voltar à carreira em um toque, ou começar uma nova.

## O que o jogador faz

Continua a última carreira, cria uma nova, vai às carreiras salvas ou importa um save.

## Conteúdo (de cima para baixo)

1. Nome do jogo e marca, lidos de `config/prancheta.config.ts` (enquanto `logo.hasBrand` for falso, o nome em texto).
2. Slogan da configuração, no idioma atual.
3. **Com carreira salva:** CareerCard da mais recente com "Continuar" como primário; "Novo jogo" secundário; link "Todas as carreiras" com o número de carreiras.
4. **Sem carreira:** "Novo jogo" primário; "Importar save" secundário.
5. Aviso de ficção (US-043) em `caption`, sempre visível sem rolar.
6. Pé: Preferências e Sobre como LinkRow.

Na 1b, uma entrada "Liga online" entra entre o item 3 e o 5.

## Ao alcance do polegar

Os botões "Continuar" e "Novo jogo" ficam na metade de baixo; marca e slogan em cima.

## Estados

- **Vazio:** sem carreiras (item 4).
- **Carregando:** Skeleton no lugar do CareerCard enquanto a lista local é lida.
- **Erro:** save da última carreira ilegível: o CareerCard mostra o aviso em texto e oferece abrir a versão anterior (US-032) ou ir às carreiras; os outros botões continuam funcionando.
- **Offline:** nada muda.
- **Aviso de nova versão / novidades:** Banner acima do CareerCard (ver [erros-e-avisos.md](erros-e-avisos.md)).

## Componentes

CareerCard, Button, LinkRow, Banner, Skeleton.

## Acessibilidade

Botões ≥ 44px; um único primário; o aviso de ficção é texto real (não imagem) com contraste ≥ 4,5:1; nenhuma animação de entrada obrigatória.

## Patrocínio

Nenhum.
