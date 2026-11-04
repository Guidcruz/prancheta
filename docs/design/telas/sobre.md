# Sobre

**Histórias:** US-043, US-039, US-045 (e US-042 para rever o tutorial) · **Prioridade:** Must · **Ordem:** 20

## Objetivo

Dizer que tudo é fictício, qual versão está rodando e o que o jogo faz com os dados.

## Conteúdo

1. ScreenHeader com voltar.
2. Nome e marca do jogo (da configuração) e número da versão.
3. Aviso de ficção: clubes, jogadores e marcas do jogo são fictícios (ADR-0015).
4. Novidades da versão (US-039): LinkRow que abre as notas curtas no idioma atual.
5. Privacidade: resumo curto e LinkRow externo para a política do site.
6. Comunidade (P13) e Apoiar: LinkRow externos; não há convite para anunciar (nada de "Patrocine aqui" nem equivalente, ADR-0015); "Apoiar" abre antes uma ConfirmSheet avisando que é página externa e que menores precisam de um responsável.
7. Suporte: e-mail só se existir na configuração (nunca link vazio); "Copiar relatório de erros" (US-045).
8. "Rever tutorial".

## Ao alcance do polegar

Lista rolável de LinkRow; as ações mais usadas (copiar relatório, rever tutorial) no fim, perto do polegar.

## Estados

- **Offline:** links externos marcados como "precisa de conexão" e, se tocados, mostram aviso em vez de falhar em silêncio.
- **Vazio:** relatório de erros vazio: o botão diz que não há erros registrados.
- **Erro:** cópia falhou: Banner com o texto selecionável para copiar à mão.
- **Carregando:** não se aplica.

## Componentes

ScreenHeader, LinkRow, ConfirmSheet, Banner, Button.

## Acessibilidade

Links externos com ícone e texto acessível indicando que saem do jogo; confirmação do "Apoiar" com foco no cancelar.

## Marcas do cenário

Nenhuma. A tela não mostra marca nem convida a anunciar; o único link de dinheiro é o "Apoiar" (apoio voluntário).
