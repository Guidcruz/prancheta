# Jogador (card completo)

**Histórias:** US-016 · **Prioridade:** Must · **Ordem:** 6

## Objetivo

Mostrar tudo o que o técnico precisa saber de um atleta antes de escalá-lo.

## Conteúdo

BottomSheet de altura total no celular (painel lateral no desktop), com endereço próprio no histórico:

1. Avatar gerado, nome, posição, idade, nota geral.
2. Situação (StatusBadge): apto, suspenso, lesionado com rodadas restantes.
3. Forma, moral e fadiga.
4. Os 6 atributos da posição (AttributeBar: rótulo, número, barra).
5. Traço de personalidade em texto (com frase curta de explicação, do conteúdo).
6. Temporada: jogos e gols.

Sem contrato, salário, valor ou potencial na 1a.

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

## Patrocínio

Nenhum.
