# Jogador (card completo)

**Histórias:** US-016 · **Prioridade:** Must · **Ordem:** 6

## Objetivo

Mostrar tudo o que o técnico precisa saber de um atleta antes de escalá-lo.

## Conteúdo

BottomSheet de altura total no celular (painel lateral no desktop), com endereço próprio no histórico:

1. Avatar gerado, nome, posição, idade, nota geral.
2. Situação (StatusBadge): apto, suspenso, lesionado com rodadas restantes.
3. Condição (0 a 100, 100 = descansado), moral e forma, cada uma com número e rótulo.
4. Os 6 atributos da posição (AttributeBar: rótulo, número, barra).
5. Traço de personalidade em texto (com frase curta de explicação, do conteúdo).
6. Temporada: jogos e gols.

7. Rótulo "promessa" (StatusBadge, ícone + texto) ao lado da idade, quando o jogador se enquadra na regra do `game-designer` (`docs/design/jogadores.md`, seção do potencial). **Depende do CEO:** a US-016 diz que o potencial não aparece em nenhuma tela; o rótulo não mostra o número, mas revela que ele é alto. Até o ok, a casca do componente aceita o rótulo, e a tela não o usa.

Sem contrato, salário, valor nem o número do potencial na 1a.

## Ao alcance do polegar

Fechar pelo gesto voltar, pelo arrasto para baixo ou pelo botão no pé da folha. Próximo/anterior atleta (opcional) como botões no pé.

## Estados

- **Carregando:** Skeleton dentro da folha.
- **Erro:** ErrorState dentro da folha, com fechar.
- **Vazio:** temporada sem jogos mostra zeros, não esconde a seção.
- **Offline:** nada muda.

## Componentes

BottomSheet, PlayerCard (`full`), Avatar, AttributeBar, StatusBadge, Button.

## Acessibilidade

Foco vai para o nome ao abrir e volta à linha de origem ao fechar; Esc fecha; barras dos atributos são decorativas (o número é o dado); folha sem animação de subida com reduced motion.

## Marcas do cenário

Nenhuma.
