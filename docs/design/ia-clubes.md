# IA dos clubes (Etapa 1a: escalação e tática)

> Mantido pelo `game-designer`. Fonte: `docs/PROJETO.md`, "IA dos outros clubes". Parâmetros em `app/src/params/ai.json` (`ai.*`).

**Regra em uma frase:** cada clube da IA escala os melhores disponíveis na sua formação preferida, poupa quem está cansado, e escolhe postura e pressão comparando a sua força com a do adversário, com um tempero do seu perfil.

## Escopo

| Entra na 1a                                                    | Fica para depois                                                 |
| -------------------------------------------------------------- | ---------------------------------------------------------------- |
| Escalação, rotação por cansaço, banco, capitão e cobradores    | Mercado: comprar, vender, propostas do exterior (Etapas 3 e 5)   |
| Formação, postura e pressão antes do jogo                      | Paciência com o técnico, troca de técnico do "Caótico" (Etapa 4) |
| Substituições e comandos durante o jogo; conversa do intervalo | Promoção de jovens da base (Etapa 4)                             |

A mesma IA monta o time do jogador quando ele não escala (ver `partida.md`, casos de borda) e joga os dois lados no `/balance`.

## Perfis na 1a

| Perfil           | Formações preferidas           | Postura (Δ = força própria + mando − força do adversário)   | Pressão                                  | Intervalo (perdendo / empatando / ganhando) |
| ---------------- | ------------------------------ | ----------------------------------------------------------- | ---------------------------------------- | ------------------------------------------- |
| Grande ambicioso | 4-3-3, 4-2-3-1                 | ofensiva se Δ ≥ −2; defensiva se Δ ≤ −10; senão equilibrada | alta em casa, média fora                 | cobrar / motivar / acalmar                  |
| Formador         | 4-3-3, 3-4-3                   | ofensiva se Δ ≥ 0; defensiva se Δ ≤ −8                      | alta                                     | motivar / motivar / acalmar                 |
| Vendedor         | 4-4-2, 4-2-3-1                 | equilibrada; defensiva se Δ ≤ −6                            | média                                    | motivar / motivar / acalmar                 |
| Tradicional      | 4-4-2, 3-5-2                   | equilibrada; defensiva fora de casa se Δ ≤ −4               | média                                    | cobrar / motivar / acalmar                  |
| Caótico          | sorteia entre as 6 a cada jogo | sorteia: ofensiva 50%, equilibrada 30%, defensiva 20%       | sorteia (alta 50%, média 30%, baixa 20%) | sorteia                                     |

- Δ usa a força exibida (`balance-targets.md`) e +4 para o mandante, a mesma conta dos marcadores de `partida.md`.
- **Intervalo do "Caótico":** sorteia uma das três conversas com 1/3 cada, sem olhar o placar (`Rng.int(0, 2)` sobre motivar, cobrar, acalmar, nessa ordem; um sorteio por time caótico, mandante primeiro). Ele pode cobrar quem está ganhando e perder 3% no segundo tempo: é o perfil. Sem pesos porque nenhuma opção é "a do caótico"; o tempero dele já está na postura e na pressão.
- **Cansaço manda na pressão:** se a condição média do XI escalado for menor que `ai.tiredTeamCondition = 85`, a pressão vira baixa, em qualquer perfil.
- **Formação do jogo:** das duas preferidas (`preferredFormations`, a primeira é a sorteada na geração e a do elenco), a que dá a maior soma de `eff` no XI montado (abaixo); empate fica com a primeira. O "Caótico" sorteia entre as seis a cada jogo; as duas que ele recebe na geração só moldam o elenco.
- **Perfil por porte** (padrão, se a lista de clubes não disser), sorteado com os pesos da Série A atual (`clubes-serie-a.md`): grandes → Grande ambicioso 4, Tradicional 4, Formador 3, Vendedor 1; médios → Formador 2, Tradicional 1, Vendedor 1, Caótico 1; pequenos → Vendedor 2, Tradicional 1. Sorteio por clube com a semente da carreira. O perfil depende do porte, nunca da força: um grande fraco pode ser ambicioso.

**Exemplo.** Ambicioso de força 76 recebe um clube de força 64: Δ = 76 + 4 − 64 = 16 → ofensiva, pressão alta. O mesmo clube visitando um de força 77: Δ = 76 − 77 − 4 = −5 → equilibrada, pressão média.

## Escalação

1. **Disponíveis:** sem lesão e sem suspensão.
2. **Valor de seleção** de cada jogador para cada vaga: `overall × fit × (0.80 + 0.20 × condição / 100)`.
3. **Preenchimento guloso**, na ordem GOL, ZAG, LAT, VOL, MEI, ATA: cada vaga recebe o disponível de maior valor de seleção que ainda não foi escolhido. Empate: maior overall, depois mais novo, depois menor ID.
4. **Rotação:** um titular escolhido com condição abaixo de `ai.rotationCondition = 85` é trocado pelo melhor reserva para aquela vaga se o valor de seleção do reserva for pelo menos `ai.rotationMinRatio = 0.90` do valor do titular.
5. **Banco (7):** 1 GOL, depois os 6 de maior overall entre os restantes, garantindo pelo menos 1 de defesa, 1 de meio e 1 de ataque.
6. **Capitão:** titular com traço líder de maior overall; sem líder, o titular mais velho. **Pênalti:** maior `finishing` entre os titulares. **Falta:** maior `technique`.

## Durante o jogo

As regras são avaliadas em ordem a cada minuto; no máximo uma substituição tática por minuto.

| #   | Quando                                                                   | O que a IA faz                                                                                      |
| --- | ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------- |
| 1   | Lesão                                                                    | troca na hora pelo reserva de maior valor de seleção para a vaga                                    |
| 2   | Minutos 60 a 80, titular com energia < `ai.subEnergy = 65`               | troca pelo melhor reserva para a vaga, se o `eff` do reserva for maior que o `eff` atual do titular |
| 3   | A partir do minuto 70, perdendo                                          | troca o VOL ou ZAG de menor `eff` pelo melhor ATA ou MEI do banco e muda para ofensiva              |
| 4   | A partir do minuto 80, perdendo por 1                                    | "todo mundo no ataque"                                                                              |
| 5   | A partir do minuto 75, ganhando por 1 (Grande ambicioso: a partir do 80) | "segurar o resultado"                                                                               |
| 6   | Sempre                                                                   | guarda 1 substituição até o minuto 80 para lesão                                                    |

O "Caótico" segue as mesmas regras, mas a 3 acontece já a partir do minuto 60. Uma partida da IA contra a IA faz em média de 3 a 4 substituições (critério de aceite para o `developer`).

## Parâmetros (`app/src/params/ai.json`)

| Parâmetro               | Valor inicial | Faixa   | Por quê                                                                                                                                                   |
| ----------------------- | ------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `ai.rotationCondition`  | 85            | 50–95   | na 1a só há rodadas a cada 3 ou 4 dias às vezes: quem jogou em pressão alta volta com cerca de 83 e pode ser poupado; com pressão média (cerca de 93) não |
| `ai.rotationMinRatio`   | 0,90          | 0,7–1,0 | só poupa quando o reserva não derruba o time                                                                                                              |
| `ai.subEnergy`          | 65            | 40–80   | troca o titular que já cansou no segundo tempo                                                                                                            |
| `ai.tiredTeamCondition` | 85            | 60–100  | time desgastado não aguenta pressão alta                                                                                                                  |

**Constantes:** tabela de perfis, distribuição de perfis por porte, ordem das regras em jogo.

## Casos de borda

| Caso                                        | Regra                                                               |
| ------------------------------------------- | ------------------------------------------------------------------- |
| Nenhum disponível para uma vaga da formação | a vaga recebe o melhor disponível de qualquer posição (com o `fit`) |
| Menos de 11 disponíveis                     | escala os que há; o resto vale `partida.md`                         |
| Nenhum goleiro disponível                   | `partida.md`, "Sem goleiro disponível"                              |
| Banco sem goleiro                           | o banco fica com 7 de linha                                         |
| Regras 3 e 5 no mesmo minuto                | impossível (placar diferente); as regras 1 e 2 vêm antes de 3 a 5   |
| Sem substituição restante                   | as regras de troca são ignoradas; os comandos de postura continuam  |
| Perfil desconhecido (save danificado, bug)  | joga como "Tradicional", com aviso (`partida.md`, "Casos de borda") |

## Pedido ao `developer` (critérios de aceite)

1. Mesma semente, mesmo elenco e mesmo adversário → mesma escalação e mesma tática.
2. Teste: nenhuma escalação da IA contém jogador lesionado ou suspenso em 200 temporadas.
3. `/balance` imprime: substituições por jogo da IA (meta 3 a 4), proporção de jogos com titular abaixo de 75 de condição (meta abaixo de 5%), e a distribuição de posturas por perfil.
