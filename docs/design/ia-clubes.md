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
- **Força no Δ:** a própria é a do XI que a IA acabou de montar, já com a rotação (o poupado não conta). A do adversário é a força exibida dele sem escalação (`teamStrength` sem `lineup`, o número da tela de pré-jogo): hoje, o melhor XI dos aptos na primeira formação preferida, todos descansados; a partir da T-013, o que o `teamStrength` passar a ler (`lastSheets`). A IA nunca lê a ficha que o adversário vai mandar, então as 20 fichas da rodada saem em qualquer ordem com o mesmo resultado. Com menos de 11, a vaga vazia conta 0 (soma de `overall × fit` dividida por 11): o time desfalcado se vê mais fraco, e o adversário dele também o vê assim.
- **Sem adversário ou sem jogo na rodada** (sugestão fora do calendário, testes): Δ = 0 em campo neutro, que não é "em casa" nem "fora". Fica: Ambicioso ofensiva e pressão média; Formador ofensiva e alta; Vendedor e Tradicional equilibrada e média (o Tradicional só se defende fora de casa).
- **Sorteios do "Caótico":** um `Rng` por clube e rodada, com a semente ``seedFromString(`${seed}-s${season}-r${round}-ai-${clubId}`)``, com 3 sorteios nesta ordem: formação (`Rng.int(0, 5)` sobre `FORMATIONS`: 4-4-2, 4-3-3, 4-2-3-1, 3-5-2, 3-4-3, 5-3-2), postura (`Rng.next()` sobre ofensiva 0,5, equilibrada 0,3, defensiva 0,2, nessa ordem) e pressão (`Rng.next()` sobre alta 0,5, média 0,3, baixa 0,2). A pressão é sorteada sempre, mesmo quando a regra do cansaço a troca por baixa: o consumo fixo impede que a condição do elenco mude os sorteios. O adversário não entra no rótulo: pedir a sugestão duas vezes na mesma rodada dá a mesma ficha. Os outros perfis não sorteiam. O sorteio da conversa do intervalo é da partida (abaixo), não deste `Rng`.
- **Intervalo do "Caótico":** sorteia uma das três conversas com 1/3 cada, sem olhar o placar (`Rng.int(0, 2)` sobre motivar, cobrar, acalmar, nessa ordem; um sorteio por time caótico, mandante primeiro). Ele pode cobrar quem está ganhando e perder 3% no segundo tempo: é o perfil. Sem pesos porque nenhuma opção é "a do caótico"; o tempero dele já está na postura e na pressão.
- **Cansaço manda na pressão:** se a condição média do XI escalado for menor que `ai.tiredTeamCondition = 85`, a pressão vira baixa, em qualquer perfil.
- **Pressão alta por perfil (intencional):** o Formador pressiona sempre, o Ambicioso só em casa e o Caótico em metade dos jogos; na Série A atual dá cerca de 38% das fichas da liga em pressão alta (medido: 37,6% com as 38 rodadas em sequência). É a identidade do perfil: jogar contra o Formador é jogo pegado. O freio dele é a rotação (quem volta com 83 é poupado), não a regra do cansaço: com a rotação, a média do XI quase nunca fica abaixo de 85 (0,0% das fichas na 1a, em que o menor intervalo é de 3 dias). O custo da pressão alta em cartões entra na calibragem de `partida.md` ("Calibragem dos vermelhos").
- **Formação do jogo:** das duas preferidas (`preferredFormations`, a primeira é a sorteada na geração e a do elenco), a que dá a maior soma de `eff` no XI montado (abaixo); empate fica com a primeira. O "Caótico" sorteia entre as seis a cada jogo; as duas que ele recebe na geração só moldam o elenco.
- **Perfil por porte** (padrão, se a lista de clubes não disser), sorteado com os pesos da Série A atual (`clubes-serie-a.md`): grandes → Grande ambicioso 4, Tradicional 4, Formador 3, Vendedor 1; médios → Formador 2, Tradicional 1, Vendedor 1, Caótico 1; pequenos → Vendedor 2, Tradicional 1. Sorteio por clube com a semente da carreira. O perfil depende do porte, nunca da força: um grande fraco pode ser ambicioso.
- **Clube do técnico humano:** quando a IA decide por ele ("Sugerir escalação", técnico que não montou a escalação, humano que não confirmou no online, conversa do intervalo sem escolha, trocas por lesão no modo "só resultado"), roda a mesma rotina (`suggestSheet` e as regras de "Durante o jogo") com o perfil lido como "Tradicional", qualquer que seja o perfil do clube. A formação continua saindo das duas preferidas do clube, sem sorteio. Por quê: o perfil é o jeito da diretoria gerir o clube, não o do técnico; quem pede uma sugestão espera uma ficha previsível, nunca a pressão alta de todo jogo do Formador nem o sorteio do Caótico. Vale a US-011 ("a mesma rotina") e vale `partida.md` ("pelo perfil Tradicional").

**Exemplo.** Ambicioso de força 76 recebe um clube de força 64: Δ = 76 + 4 − 64 = 16 → ofensiva, pressão alta. O mesmo clube visitando um de força 77: Δ = 76 − 77 − 4 = −5 → equilibrada, pressão média.

## Escalação

1. **Disponíveis:** sem lesão e sem suspensão.
2. **Valor de seleção** de cada jogador para cada vaga: `overall × fit × (0.80 + 0.20 × condição / 100)`.
3. **Preenchimento guloso**, na ordem GOL, ZAG, LAT, VOL, MEI, ATA: cada vaga recebe o disponível de maior valor de seleção que ainda não foi escolhido. Empate: maior overall, depois mais novo, depois menor ID. **Sem goleiro disponível**, a vaga do gol é preenchida por último: primeiro as 10 de linha, depois o gol recebe, entre os que sobraram, o de maior valor de seleção para o gol (`fit` 0,40), como o reserva de `partida.md`. Por quê: como o `fit` para o gol é 0,40 para todos, na ordem normal o melhor jogador de linha do elenco iria para o gol.
4. **Rotação:** um titular escolhido com condição abaixo de `ai.rotationCondition = 85` é trocado pelo melhor reserva para aquela vaga **entre os que têm condição de pelo menos `ai.rotationCondition`**, se o valor de seleção desse reserva for pelo menos `ai.rotationMinRatio = 0.90` do valor do titular.
   - Na ordem das vagas. O reserva que entra sai da lista para as vagas seguintes; o titular poupado não volta em outra vaga na mesma rotação, mas pode ir para o banco (passo 5).
   - Por quê o reserva descansado: poupar é para descansar; trocar um cansado por outro ainda mais cansado piora o time agora e não poupa ninguém. Com a regra, quem entra está sempre mais inteiro que quem sai.
5. **Banco (7):** 1 GOL e 6 de linha.
   - O goleiro é o de maior overall entre os goleiros que sobraram. Segundo goleiro só entra se faltarem jogadores de linha para completar o banco (sem isso, ele aparecia em 16% das fichas, numa vaga que só serve se dois goleiros saírem no mesmo jogo).
   - Os 6 de linha: primeiro o de maior overall de cada linha que ainda não tem ninguém no banco (defesa = ZAG e LAT, meio = VOL e MEI, ataque = ATA, pela posição natural), depois os de maior overall entre os de linha restantes.
   - Ordem do banco: o goleiro, depois por overall (desempate: mais novo, menor ID). Sem goleiro sobrando, 7 de linha; com menos de 7 sobrando, entram todos.
6. **Capitão:** titular com traço líder de maior overall; sem líder, o titular mais velho. **Pênalti:** maior `finishing` entre os titulares. **Falta:** maior `technique`.

## Validação da ficha (`validateLineup`)

**Regra em uma frase:** a ficha vale se o XI é válido e o banco tem no máximo 7 jogadores do clube, aptos e sem repetir ninguém; o resto a partida corrige sozinha.

- **XI:** formação conhecida, 11 titulares, cada um do elenco, sem repetir, sem lesão nem suspensão (os mesmos motivos de `sectorStrengths`).
- **Banco:** no máximo 7; cada um do elenco, nem titular nem repetido, sem lesão nem suspensão. Banco com menos de 7, vazio ou sem goleiro é válido.
- Recusa com o primeiro problema, o XI antes do banco, dizendo a parte (`starters` ou `bench`).
- **Não confere** capitão, cobradores nem tática: a partida usa o primeiro da lista que está em campo e senão a regra de `partida.md` ("Capitão e cobradores"), e postura ou pressão desconhecida vira equilibrada ou média com aviso ("Valor desconhecido na entrada"). Nenhum desses erros dá vantagem a quem o comete. No online (1b), recusar tática desconhecida no servidor é decisão do `security-auditor`, não regra de jogo.

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

| Caso                                        | Regra                                                                                                                                                                                                               |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Nenhum disponível para uma vaga da formação | a vaga recebe o melhor disponível de qualquer posição (com o `fit`)                                                                                                                                                 |
| Menos de 11 disponíveis                     | escala os que há; o resto vale `partida.md`                                                                                                                                                                         |
| Nenhum goleiro disponível                   | a vaga do gol é a última do preenchimento ("Escalação", passo 3); na partida, `partida.md`, "Casos de borda", linhas "Goleiro titular fora e nenhum goleiro no banco" e "Sem goleiro e sem reserva nenhum no banco" |
| Banco sem goleiro                           | o banco fica com 7 de linha                                                                                                                                                                                         |
| Regras 3 e 5 no mesmo minuto                | impossível (placar diferente); as regras 1 e 2 vêm antes de 3 a 5                                                                                                                                                   |
| Sem substituição restante                   | as regras de troca são ignoradas; os comandos de postura continuam                                                                                                                                                  |
| Perfil desconhecido (save danificado, bug)  | joga como "Tradicional". O aviso é da partida, um por time no apito inicial (`partida.md`, "Valor desconhecido na entrada"); o `suggestSheet` não avisa, para o aviso não sair duas vezes                           |
| Clube desconhecido no `suggestSheet`        | ficha vazia na 4-4-2, equilibrada, média (a partida trata o resto)                                                                                                                                                  |
| Sem adversário ou sem jogo na rodada        | Δ = 0 em campo neutro ("Perfis na 1a")                                                                                                                                                                              |
| Clube do técnico humano                     | perfil lido como "Tradicional" ("Perfis na 1a")                                                                                                                                                                     |

## Pedido ao `developer` (critérios de aceite)

1. Mesma semente, mesmo elenco e mesmo adversário → mesma escalação e mesma tática.
2. Teste: nenhuma escalação da IA contém jogador lesionado ou suspenso em 200 temporadas.
3. `/balance` imprime: substituições por jogo da IA (meta 3 a 4), proporção de jogos com titular abaixo de 75 de condição (meta abaixo de 5%), e a distribuição de posturas por perfil.
4. Ajustes da T-011 (decisões do `developer` revistas; o resto está confirmado como implementado):
   - **Rotação:** o reserva só entra com condição maior ou igual a `ai.rotationCondition`. Teste: titular com condição 80 e reserva com 0,95 do valor dele e condição 84 → não troca; o mesmo reserva com condição 85 → troca; com dois reservas, um de condição 84 e valor maior e outro de condição 90 e valor de pelo menos 0,90 do titular → entra o de 90.
   - **Banco:** com pelo menos 6 de linha sobrando, nunca há 2 goleiros. Teste: 3 goleiros aptos, o 3º com overall acima de todos os reservas de linha → 1 goleiro no banco.
   - **Sem goleiro disponível:** o gol é preenchido por último. Teste: elenco sem goleiro apto → o jogador de linha de maior overall fica numa vaga de linha, e o gol vai para o de maior valor de seleção entre os que sobraram das 10 vagas.
   - **Clube do técnico humano:** `suggestSheet` com uma opção que lê o perfil como "Tradicional" (o `GameState` ainda não marca o clube humano; a partida já tem `TeamInput.controller`), e a partida com `controller: 'human'` usa "Tradicional" na conversa sem escolha e nas regras da T-012. Teste: um clube Caótico e um Formador com essa opção dão a mesma ficha que dariam com perfil "Tradicional", sem criar `Rng`.
5. **Medir com cansaço:** o critério 3 e a regra do cansaço só aparecem com as rodadas em sequência. O `/balance` (T-016) joga as 38 rodadas em ordem, levando condição, lesões e suspensões de uma para a outra (`playRound` da T-013), e imprime a proporção de fichas com pressão alta e com a regra do cansaço disparada. Referência do `game-designer` (protótipo no relatório de 30 temporadas, só com a condição levada): 37,6% de pressão alta, 0,0% de cansaço, 2,5% das fichas com titular abaixo de 75.
