# Temporada da Série A (Etapa 1a)

> Mantido pelo `game-designer`. Fonte: `docs/PROJETO.md`, "Competições e calendário" (Série A: 20 clubes, pontos corridos, 4 caem, abril a dezembro), "Diretoria e metas" e "Novo jogo: configurações iniciais". Parâmetros em `app/src/params/season.json` (`season.*`).

**Regra em uma frase:** 20 clubes jogam todos contra todos em turno e returno, 38 rodadas de abril a dezembro; vitória vale 3, empate 1; o primeiro é campeão e os 4 últimos caem.

## Escopo

| Entra na 1a                                                     | Fica para depois                                                        |
| --------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 38 rodadas, tabela, desempate, campeão, rebaixados              | Séries B a D com acesso de verdade, estaduais, Copa do Brasil (Etapa 2) |
| Datas aproximadas (fim de semana, 8 rodadas no meio da semana)  | Ritmo "Tempo real" com o calendário real do servidor (Etapa 4)          |
| Prêmios da temporada e resumo                                   | Vagas na Libertadores e Sul-Americana valendo (Etapa 5)                 |
| Expectativa da diretoria só informativa (decisão 6), pela força | Barra de confiança, cobrança e demissão (Etapa 4)                       |
| Evolução e envelhecimento no fim da temporada                   | Base, aposentadorias com festa, histórico e recordes (Etapa 4)          |

Na 1a o ritmo é sempre "No meu ritmo": a rodada avança quando o jogador toca em "Jogar rodada". O tipo de carreira é, na prática, "clube fixo" e o estilo Tranquilo e o Realista só mudam o texto da diretoria (demissão: Etapa 4).

## Tabela de jogos

1. Embaralha os 20 clubes com uma semente própria de cada temporada: `seedFromString("<seed>-fixtures-<season>")`, em que `<season>` é o número da temporada na carreira (1, 2, …, o mesmo de `GameState.season`; a primeira usa `<seed>-fixtures-1`), não o ano. Cada temporada tem o seu sorteio (na opção B do fim de temporada, a tabela muda de uma temporada para a outra), e a mesma carreira na mesma temporada dá sempre a mesma tabela.
2. Turno (rodadas 1 a 19) pelo método do círculo (tabela de Berger), começando na 4ª rotação da ordem canônica (`BERGER_START = 3`, contando de 0) e seguindo as 19 rotações em ciclo a partir dali.
3. Returno (rodadas 20 a 38) espelhado: a rodada `19 + n` repete os confrontos da rodada `n` com o mando invertido, como na CBF.
4. Sem restrição de clássico na 1a. Se dois clubes da mesma cidade forem mandantes na mesma rodada, não há problema (cada um tem o seu estádio na lista de clubes).

**Limite de mando:** nenhum clube joga mais de 2 vezes seguidas em casa ou fora em toda a temporada, incluindo a virada do turno (rodadas 19, 20 e 21). Motivo do `BERGER_START = 3`: na ordem canônica de Berger (começando da 1ª rotação), o espelho do returno faz 2 clubes terem 3 mandos iguais seguidos nas rodadas 19 a 21; Berger sozinho garante o limite dentro do turno, não na emenda com o returno. A 4ª rotação é a primeira a partir da qual o turno respeita o limite também na virada. É constante (não parâmetro); o teste do calendário confere o limite nas 38 rodadas.

## Datas

A temporada começa no 2º sábado de abril do ano escolhido no novo jogo (o ano entra como argumento; o motor nunca lê a data do aparelho) e dura 34 semanas; cada semana vai de sábado a sexta. A rodada 1 é no domingo seguinte ao 2º sábado de abril (entre 9 e 15 de abril; em 2026, 12/04).

| Item                      | Regra                                                  | Parâmetro                                              |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| Rodadas de fim de semana  | domingo, nas 34 semanas exceto as de Data FIFA         | —                                                      |
| Data FIFA (sem rodada)    | semanas 9, 21, 25 e 30 da temporada                    | `season.fifaWeeks = [9, 21, 25, 30]`                   |
| Rodadas no meio da semana | quarta-feira das semanas 3, 7, 12, 16, 19, 23, 28 e 32 | `season.midweekWeeks = [3, 7, 12, 16, 19, 23, 28, 32]` |

Conta: 34 − 4 = 30 rodadas de domingo + 8 de quarta = 38. Domingo → quarta são 3 dias de recuperação; quarta → domingo, 4. A rodada 38 é o domingo da semana 34, 231 dias depois da rodada 1: cai entre 26/11 e 02/12 conforme o ano (2026: 29/11). Todos os jogos de uma rodada acontecem no mesmo dia (a hora é só texto).

## Pontos e tabela

Vitória 3, empate 1, derrota 0. Colunas: posição, clube, P, J, V, E, D, GP, GC, SG, aproveitamento (%), últimos 5 (V/E/D em letra, não só cor).

**Desempate** (critérios do Brasileirão, nesta ordem):

1. Pontos
2. Número de vitórias
3. Saldo de gols
4. Gols marcados
5. Confronto direto (só quando o empate é entre exatamente 2 clubes): pontos nos dois jogos entre eles, depois saldo nesses jogos
6. Menos cartões vermelhos
7. Menos cartões amarelos
8. Sorteio: ordem de ``seedFromString(`${seed}-s${season}-tiebreak-${clubId}`)``, menor primeiro (determinístico e sem gastar sorteios do `Rng` da temporada). A temporada entra no rótulo, no mesmo formato das sementes das partidas (`docs/02-architecture.md`, §4.1): sem ela, o mesmo clube ganharia o sorteio em todas as temporadas da carreira, uma vantagem fixa e escondida.

Com 3 ou mais clubes empatados até o critério 4, pula o 5 e segue do 6.

**Zonas na tela:** 1º "Campeão"; 2º a 6º "Zona da Libertadores" e 7º a 12º "Zona da Sul-Americana", com o aviso "as copas chegam numa próxima versão"; 17º a 20º "Rebaixamento". Sempre com rótulo de texto, não só faixa de cor.

## Ordem do processamento de uma rodada

1. Validar as escalações; a IA monta as suas (`ia-clubes.md`).
2. Simular as 10 partidas (cada uma com a sua semente; o jogo do técnico pode ser ao vivo, as outras rodam em paralelo e a tela pode mostrar os placares da rodada).
3. Atualizar tabela, artilharia e estatísticas.
4. Descontar suspensões cumpridas e rodadas de lesão; aplicar as novas.
5. Moral dos jogadores (`jogadores.md`), depois termômetro da torcida (`torcida.md`).
6. Recuperar condição até a próxima rodada (dias de intervalo × 7). Depois da rodada 38 não há recuperação: a condição volta a 100 na virada da temporada ("Fim de temporada", passo 4).
7. Gerar os fatos para notícias e rede social (lista de marcadores de `partida.md` + fatos da tabela abaixo).
8. Salvamento automático.

### Fatos da tabela para o `content-writer`

**Regra em uma frase:** a rodada só gera fato do que mudou ou do que virou marco; série que continua não vira notícia toda semana.

O motor emite os fatos (`Fact`, `facts.ts`), nunca texto; a camada de conteúdo escolhe quais viram notícia. Todos saem da tabela depois da rodada comparada com a de antes e dos resultados da rodada.

| Fato (`kind`)                | Quando sai                                                                                                                                                       |
| ---------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `leadership` `took`          | o líder mudou; na rodada 1, o primeiro líder (`rounds = 1`; o conteúdo lê "primeiro líder do campeonato")                                                        |
| `leadership` `lost`          | junto com o `took`, para o líder anterior, com as rodadas seguidas que ele liderou; não sai na rodada 1                                                          |
| `leadership` `kept`          | só nos marcos: quando as rodadas seguidas na liderança, contando esta, chegam a 5, 10, 15, …                                                                     |
| `enteredZ4` / `leftZ4`       | da rodada 2 em diante, para quem entrou ou saiu dos 4 últimos; na rodada 1 não sai nenhum (não há Z4 antes do primeiro jogo, e "4 entraram" seria ruído)         |
| `unbeaten` (invencibilidade) | só nos marcos: N jogos seguidos sem perder com N = 5, 10, 15, …                                                                                                  |
| `winless` (jejum)            | só nos marcos: N jogos seguidos sem vencer com N = 4, 9, 14, … (o mínimo e depois a cada 5)                                                                      |
| `championClinched`           | uma vez, na rodada em que o título fica garantido                                                                                                                |
| `relegatedClinched`          | uma vez por clube, na rodada em que a queda fica garantida                                                                                                       |
| `topScorerOfRound`           | quem fez mais gols reais na rodada, **só se fez 2 ou mais**; empatados no topo saem todos (na ordem do primeiro gol) e o conteúdo junta numa nota só ("dividem") |
| `decisiveLastRound`          | no relatório da rodada 37: `title` se o campeão não está definido, `relegation` se ao menos uma vaga de queda está em aberto                                     |
| `suspended` / `injured`      | toda suspensão e lesão nova da rodada, com os jogos (ou rodadas) de fora                                                                                         |

**Marcos das séries** (`leadership kept`, `unbeaten`, `winless`): uma regra só, "sai no mínimo e depois a cada 5". O mínimo é constante: liderança 5, invencibilidade 5, jejum 4. A série que acaba não gera fato na 1a (ver "Propostas para o conteúdo").

Campeão antecipado e rebaixado matemático: quando a diferença de pontos é maior que `3 × rodadas restantes`; empate nessa conta não define (depende de desempate) e só vale na última rodada.

**Volume medido (T-013, 60 temporadas encadeadas com os 20 clubes, `playRound`, 2.280 rodadas):**

| Fato por rodada                  | Antes (todo fato que vale) | Com a regra acima |
| -------------------------------- | -------------------------- | ----------------- |
| `leadership kept`                | 0,74                       | 0,11              |
| `unbeaten`                       | 1,90                       | 0,76              |
| `winless`                        | 2,88                       | 1,20              |
| `topScorerOfRound`               | 3,32                       | 2,13              |
| `enteredZ4`                      | 0,70                       | 0,60              |
| tabela (sem suspensão nem lesão) | 10,8                       | 6,1               |
| `suspended`                      | 14,2                       | 14,2              |
| `injured`                        | 3,2                        | 3,2               |

Em 95% das rodadas alguém faz 2 gols ou mais, então o artilheiro da rodada quase sempre existe. Suspensões e lesões são muitas (cerca de 0,7 e 0,16 por clube e rodada) e não são notícia por si: a camada de conteúdo só transforma em nota as do clube do técnico e as do próximo adversário dele.

**Propostas para o conteúdo (não entram na T-013):** "perdeu a invencibilidade de N jogos" e "acabou o jejum de N jogos" são as melhores notícias de série e pedem dois fatos novos (`unbeatenEnded`, `winlessEnded`, com N ≥ o mínimo). Ficam para quando o `content-writer` tiver os templates, com ok do CEO.

## Força e dificuldade na escolha do clube

A tela de Novo jogo mostra, para cada clube, a força (número, a mesma de `balance-targets.md`) e um rótulo pela posição da força entre os 20: 1º a 6º "Favorito", 7º a 14º "Meio de tabela", 15º a 20º "Luta contra a queda". É a dificuldade da carreira (`PROJETO.md`: "a dificuldade de verdade é o clube escolhido").

## Expectativa da diretoria (só informativa na 1a)

Mostrada no início da temporada e conferida no resumo; não mexe em nada na 1a.

**Regra em uma frase (decisão do CEO, 2026-11-04):** a diretoria pede o que o elenco pode dar; o porte diz o quanto ela cobra.

```
strengthRank = posição do clube na ordem de força efetiva da carreira (1 = mais forte; empate pelo id)
targetPosition = min(strengthRank + 2, 16)
```

| Porte   | Tom da cobrança na 1a (texto)                                   | Paciência (Etapa 4) |
| ------- | --------------------------------------------------------------- | ------------------- |
| Grande  | exigente ("é obrigação ficar entre os N")                       | menor               |
| Médio   | firme ("a meta é ficar entre os N")                             | média               |
| Pequeno | compreensivo ("o objetivo é terminar entre os N" ou "não cair") | maior               |

**Exemplos:** Flamingo (força 1º) → terminar entre os 3; Corinto (força 17º, grande) → entre os 16, com tom de grande; Bragantão (9º, pequeno) → entre os 11. A meta de 16 lê "não cair".

Isto troca a meta por porte do `PROJETO.md` ("o porte define as metas e a paciência"): vai para a ADR da Etapa 4 (o `architect` abre). Na 1a só muda o texto mostrado.

No estilo Tranquilo o texto é "a diretoria espera"; no Realista, "a diretoria cobra". A confiança de 0 a 100 e a demissão entram na Etapa 4.

## Porte na carreira (Etapa 4, decisão do CEO)

**Regra em uma frase:** dentro de uma carreira, o porte de um clube pode crescer devagar com títulos e torcida conquistados (pequeno → médio → grande), sem mexer nos dados base.

- Fica no save da carreira (`careerSize` por clube), não no `ClubDef`; jogo novo começa com o porte do lote.
- Critério a calibrar na Etapa 4 com o `/balance`: título nacional ou continental mais termômetro da torcida alto por várias temporadas sobe um degrau; nunca mais de um degrau por temporada e nunca pela colocação sozinha. Cair de porte não existe dentro da carreira (porte é história).
- Mudar o porte muda a paciência e o tom da diretoria, o perfil padrão e, na Etapa 3, a receita; não muda a força.
- Mudança no formato de save: ADR do `architect` com migração.

## Fim de temporada

Sempre, ao fim da rodada 38:

1. **Cerimônia do campeão** e lista dos 4 rebaixados.
2. **Prêmios:** artilheiro (gols; desempate: menos jogos, depois mais assistências), garçom (assistências), melhor jogador (maior média de nota com ao menos 19 jogos), revelação (idem, até 21 anos), seleção do campeonato (melhor média por vaga num 4-3-3, ao menos 19 jogos), melhor goleiro (jogador de posição GOL com menos `conceded / games`, ao menos 19 jogos; desempate: mais jogos, depois maior média de nota).
3. **Resumo do técnico:** posição, meta cumprida ou não, maior vitória, maior derrota, artilheiro do clube, "quem evoluiu" (a evolução calculada no passo 4).
4. **Evolução e idade** (`jogadores.md`), depois a **virada:** `seasonStats` zerado, amarelos zerados, lesões e suspensões terminadas, condição 100 para todos (a pré-temporada é o descanso; não há recuperação depois da rodada 38). A moral passa como está. A ordem importa: prêmios, resumo e evolução leem o `seasonStats` (a evolução usa os minutos) antes de ele ser zerado.
5. **Lembrete** discreto de exportar o save (`PROJETO.md`, "Saves e backup").

**Gols sofridos na temporada (`PlayerSeasonStats.conceded`):** a soma, partida a partida, dos gols reais sofridos pelo time com o jogador em campo no gol ou na defesa, o mesmo contador que a nota da partida já usa (`Appearance.conceded`). Entra na T-013, junto com o resto do `seasonStats`: o campo é novo nesta versão do save, e acrescentá-lo depois pediria migração. O prêmio lê só quem é goleiro de posição; o número dos defensores fica disponível, sem uso na 1a.

Depois disso, uma de duas opções (decisão 5 de `balance-targets.md`, do CEO):

| Opção                               | O que acontece                                                                                                                                                                                                                                                                                                | Custo                                                                    |
| ----------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------ |
| **A. Temporada única**              | A carreira termina no resumo. O save fica "concluído", pode ser exportado e continua na Etapa 2 por migração.                                                                                                                                                                                                 | nenhum                                                                   |
| **B. Nova temporada (recomendada)** | Os 4 rebaixados saem e entram 4 clubes da "Série B" abstrata: uma lista reserva de clubes com nome e força (`strength` 61 a 66), sorteados com peso pela força, com elencos gerados na hora. Se o clube do técnico cair, a carreira termina como na opção A, com a notícia de que a Série B chega na Etapa 2. | lista de 4 a 8 clubes extras aprovada pelo CEO; tela de "nova temporada" |

Recomendo a B: dá motivo para a última rodada importar também para quem está no meio da tabela, deixa a evolução dos jovens visível no jogo e não é a "carreira longa" da Etapa 4 (sem histórico, reputação nem base).

## Parâmetros (`app/src/params/season.json`)

| Parâmetro             | Valor inicial                  | Faixa válida                                        | Por quê                                      |
| --------------------- | ------------------------------ | --------------------------------------------------- | -------------------------------------------- |
| `season.fifaWeeks`    | [9, 21, 25, 30]                | semanas inteiras de 1 a 34, crescentes, sem repetir | pausas que dão respiro e recuperação total   |
| `season.midweekWeeks` | [3, 7, 12, 16, 19, 23, 28, 32] | semanas inteiras de 1 a 34, crescentes, sem repetir | rodadas com 3 dias de descanso pedem rotação |

**Regras que cruzam as duas listas** (o validador recusa ao carregar): nenhuma semana de Data FIFA tem rodada no meio da semana, e `34 − (nº de semanas FIFA) + (nº de quartas) = 38` rodadas. Mais uma Data FIFA pede mais uma quarta, e vice-versa.

**Constantes:** 20 clubes, 38 rodadas, 3/1/0 pontos, 4 rebaixados, ordem de desempate, metas por porte.

## Casos de borda

| Caso                                        | Regra                                                                                                                                                                                                  |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Partida encerrada por menos de 7 em campo   | vale o placar definido em `partida.md`; cartões e gols contam normal                                                                                                                                   |
| Goleiro trocado ou expulso no jogo          | cada um soma os gols sofridos enquanto estava em campo; o jogador de linha que vai para o gol soma os dele, mas não concorre ao prêmio de goleiro                                                      |
| Empate total até os amarelos                | sorteio determinístico (critério 8)                                                                                                                                                                    |
| Prêmio sem ninguém com 19 jogos             | baixa o mínimo para metade dos jogos do clube; se ainda vazio, não há o prêmio                                                                                                                         |
| Artilheiros empatados em tudo               | dividem o prêmio                                                                                                                                                                                       |
| Ano escolhido no novo jogo ausente          | a interface passa o ano corrente do aparelho; o motor só recebe o número                                                                                                                               |
| Save aberto no meio da rodada (app fechado) | a rodada só conta depois do salvamento do passo 8; senão recomeça do passo 1 com as mesmas sementes; as partidas da IA dão o mesmo resultado, e a partida ao vivo do técnico recomeça do apito inicial |
