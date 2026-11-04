# Novo jogo

**Histórias:** US-014 · **Prioridade:** Must · **Ordem:** 3

## Objetivo

Começar uma carreira em menos de um minuto: escolher o clube e tocar "Começar".

## O que o jogador faz

Escolhe um dos 20 clubes; opcionalmente muda o apelido do técnico, o realismo e o tipo de partida.

## Conteúdo (de cima para baixo)

1. ScreenHeader com voltar ao Início.
2. **Clube:** lista dos 20 clubes (ClubOption: escudo + nome), em uma coluna no celular e grade no desktop. Se o `game-designer` definir uma indicação de força ou de dificuldade do clube, ela entra como texto ou ícone com rótulo, nunca só cor.
3. **Opções**, recolhidas num resumo de uma linha com os valores atuais e "Alterar":
   - Apelido do técnico (TextField; padrão do arquivo de conteúdo; aviso de que fica só no aparelho).
   - Realismo: dois OptionCard (completo ou simplificado), com frase de efeito.
   - Partida: três OptionCard (animada completa, só lances principais, só resultado).
4. Barra fixa embaixo com o clube escolhido (escudo + nome) e "Começar" (primário).

Ritmo, competições e as demais opções da P3 não aparecem. As escolhas viram "última configuração" e vêm marcadas na próxima vez.

## Ao alcance do polegar

"Começar" fixo embaixo; a lista de clubes rola acima dela.

## Estados

- **Vazio:** não se aplica (os 20 clubes vêm do jogo).
- **Inválido:** apelido vazio, só espaços ou longo demais: mensagem em texto sob o campo, "Começar" desabilitado com a mesma mensagem ligada ao botão; sem clube escolhido, a barra diz que falta escolher.
- **Carregando:** ao tocar "Começar", tela de carregamento com SponsorSlot enquanto a carreira é gerada; "Começar" em `busy`, sem toque duplo.
- **Erro:** falha ao gravar: ErrorState com "Tentar de novo"; nada criado pela metade.
- **Offline:** nada muda.

## Componentes

ScreenHeader, ClubOption, Crest, TextField, OptionGroup/OptionCard, Button, SponsorSlot (só no carregamento), ErrorState.

## Acessibilidade

- Lista de clubes como grupo de rádio; selecionado com ícone de marcado e `aria-checked`.
- Erro do apelido por texto e `aria-describedby`, não só borda vermelha.
- Nomes de clube longos em es/en quebram em duas linhas, sem cortar.

## Patrocínio

Só na tela de carregamento ao criar a carreira, e só se a espera existir.
