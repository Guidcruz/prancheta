# Temporada da Série A (Etapa 1a)

> Mantido pelo `game-designer`. Fonte: `docs/PROJETO.md`, "Competições e calendário" (Série A: 20 clubes, pontos corridos, 4 caem, abril a dezembro), "Diretoria e metas" e "Novo jogo: configurações iniciais". Parâmetros em `app/src/params/season.json` (`season.*`).

**Regra em uma frase:** 20 clubes jogam todos contra todos em turno e returno, 38 rodadas de abril a dezembro; vitória vale 3, empate 1; o primeiro é campeão e os 4 últimos caem (na 1a, a queda só aparece como "zona de rebaixamento", sem efeito: decisão P2 do CEO).

## Escopo

| Entra na 1a                                                                  | Fica para depois                                                        |
| ---------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 38 rodadas, tabela, desempate, campeão, zona de rebaixamento sem efeito (P2) | Séries B a D com acesso de verdade, estaduais, Copa do Brasil (Etapa 2) |
| Nova temporada com os mesmos 20 clubes, sem fim (P2)                         | Subida de 4 clubes da Série B, quando houver lista aprovada pelo CEO    |
| Datas aproximadas (fim de semana, 8 rodadas no meio da semana)               | Ritmo "Tempo real" com o calendário real do servidor (Etapa 4)          |
| Prêmios da temporada e resumo                                                | Vagas na Libertadores e Sul-Americana valendo (Etapa 5)                 |
| Expectativa da diretoria só informativa (decisão 6), pela força              | Barra de confiança, cobrança e demissão (Etapa 4)                       |
| Evolução e envelhecimento no fim da temporada                                | Base, aposentadorias com festa, histórico e recordes (Etapa 4)          |

Na 1a o ritmo é sempre "No meu ritmo": a rodada avança quando o jogador toca em "Jogar rodada". O tipo de carreira é, na prática, "clube fixo". O estilo (Tranquilo ou Realista) não aparece na 1a: o novo jogo esconde as opções de etapas futuras (decisão P3, US-014), e a diretoria fala só com o tom do porte ("Expectativa da diretoria"). O estilo entra na Etapa 4, com a confiança e a demissão.

## Tabela de jogos

1. Embaralha os 20 clubes com uma semente própria de cada temporada: `seedFromString("<seed>-fixtures-<season>")`, em que `<season>` é o número da temporada na carreira (1, 2, …, o mesmo de `GameState.season`; a primeira usa `<seed>-fixtures-1`), não o ano. Cada temporada tem o seu sorteio (com os mesmos 20 clubes, a ordem dos jogos muda de uma temporada para a outra), e a mesma carreira na mesma temporada dá sempre a mesma tabela.
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

**Zonas na tela:** 1º "Campeão"; 2º a 6º "Zona da Libertadores" e 7º a 12º "Zona da Sul-Americana", com o aviso "as copas chegam numa próxima versão"; 17º a 20º "Zona de rebaixamento", com o aviso "o acesso e o rebaixamento entram numa próxima versão" (P2). Sempre com rótulo de texto, não só faixa de cor. Os fatos `enteredZ4`, `leftZ4` e `relegatedClinched` continuam saindo (a briga contra a queda é história), mas o texto do `content-writer` nunca diz que o clube vai jogar a Série B.

## Ordem do processamento de uma rodada

1. Validar as escalações; a IA monta as suas (`ia-clubes.md`).
2. Simular as 10 partidas (cada uma com a sua semente; o jogo do técnico pode ser ao vivo, as outras rodam em paralelo e a tela pode mostrar os placares da rodada).
3. Atualizar tabela, artilharia e estatísticas.
4. Descontar suspensões cumpridas e rodadas de lesão; aplicar as novas. No Realismo simplificado (`partida.md`) não há novas: nem suspensão, nem lesão que passe da partida, e o contador de amarelos não muda (fica em 0 a carreira toda). Sem elas, não saem os fatos `suspended` e `injured`.
5. Moral dos jogadores (`jogadores.md`), depois termômetro da torcida (`torcida.md`). Os dois leem o estado do início da rodada (moral, termômetro, quem estava lesionado ou suspenso) mais os resultados; o termômetro usa a tabela já com a rodada.
6. Recuperar condição até a próxima rodada (dias de intervalo × 7). Depois da rodada 38 não há recuperação: a condição volta a 100 na virada da temporada ("Fim de temporada", passo 4). No Realismo simplificado a condição volta a 100 depois de toda rodada, a 38 inclusive (igual ao que a virada faria).
7. Gerar os fatos para notícias e rede social (lista de marcadores de `partida.md` + fatos da tabela abaixo).
8. Salvamento automático.

### Fatos da tabela para o `content-writer`

**Regra em uma frase:** a rodada só gera fato do que mudou ou do que virou marco; série que continua não vira notícia toda semana.

O motor emite os fatos (`Fact`, `facts.ts`), nunca texto; a camada de conteúdo escolhe quais viram notícia. Todos saem da tabela depois da rodada comparada com a de antes e dos resultados da rodada.

| Fato (`kind`)                              | Quando sai                                                                                                                                                       |
| ------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `leadership` `took`                        | o líder mudou; na rodada 1, o primeiro líder (`rounds = 1`; o conteúdo lê "primeiro líder do campeonato")                                                        |
| `leadership` `lost`                        | junto com o `took`, para o líder anterior, com as rodadas seguidas que ele liderou; não sai na rodada 1                                                          |
| `leadership` `kept`                        | só nos marcos: quando as rodadas seguidas na liderança, contando esta, chegam a 5, 10, 15, …                                                                     |
| `enteredZ4` / `leftZ4`                     | da rodada 2 em diante, para quem entrou ou saiu dos 4 últimos; na rodada 1 não sai nenhum (não há Z4 antes do primeiro jogo, e "4 entraram" seria ruído)         |
| `unbeaten` (invencibilidade)               | só nos marcos: N jogos seguidos sem perder com N = 5, 10, 15, …                                                                                                  |
| `winless` (jejum)                          | só nos marcos: N jogos seguidos sem vencer com N = 4, 9, 14, … (o mínimo e depois a cada 5)                                                                      |
| `unbeatenEnded` (perdeu a invencibilidade) | o clube perde depois de N ≥ 5 jogos seguidos sem perder; campos `clubId`, `games` (N, sem contar a derrota), `round`, `opponentId` (quem o venceu)               |
| `winlessEnded` (acabou o jejum)            | o clube vence depois de N ≥ 4 jogos seguidos sem vencer; campos `clubId`, `games` (N, sem contar a vitória), `round`, `opponentId` (quem ele venceu)             |
| `championClinched`                         | uma vez, na rodada em que o título fica garantido                                                                                                                |
| `relegatedClinched`                        | uma vez por clube, na rodada em que a queda fica garantida                                                                                                       |
| `topScorerOfRound`                         | quem fez mais gols reais na rodada, **só se fez 2 ou mais**; empatados no topo saem todos (na ordem do primeiro gol) e o conteúdo junta numa nota só ("dividem") |
| `decisiveLastRound`                        | no relatório da rodada 37: `title` se o campeão não está definido, `relegation` se ao menos uma vaga de queda está em aberto                                     |
| `suspended` / `injured`                    | toda suspensão e lesão nova da rodada, com os jogos (ou rodadas) de fora                                                                                         |

**Marcos das séries** (`leadership kept`, `unbeaten`, `winless`): uma regra só, "sai no mínimo e depois a cada 5". O mínimo é constante: liderança 5, invencibilidade 5, jejum 4.

**Fim das séries** (`unbeatenEnded`, `winlessEnded`; decisão do CEO, 2026-11-05): o mínimo é o mesmo da série, então toda série que já virou notícia tem a sua notícia de fim, e nenhuma outra tem. Saem uma vez, na rodada em que a série acaba, com o placar da tabela (partida encerrada conta pelo placar definido). **O fim tem prioridade:** na rodada em que sai um `unbeatenEnded` ou `winlessEnded` de um clube, não sai `unbeaten` nem `winless` desse clube (acontece quando os últimos jogos da série foram empates: "perdeu a invencibilidade de 5" e "4 jogos sem vencer" na mesma rodada; medido em cerca de 2% dos fins). A liderança perdida já é o `leadership lost`.

Campeão antecipado e rebaixado matemático: quando a diferença de pontos é maior que `3 × rodadas restantes`; empate nessa conta não define (depende de desempate) e só vale na última rodada.

**Volume medido (T-013, 60 temporadas encadeadas com os 20 clubes, `playRound`, 2.280 rodadas):**

| Fato por rodada                  | Antes (todo fato que vale) | Com a regra acima |
| -------------------------------- | -------------------------- | ----------------- |
| `leadership kept`                | 0,74                       | 0,11              |
| `unbeaten`                       | 1,90                       | 0,76              |
| `winless`                        | 2,88                       | 1,20              |
| `topScorerOfRound`               | 3,32                       | 2,13              |
| `enteredZ4`                      | 0,70                       | 0,60              |
| `unbeatenEnded` (N ≥ 5)          | —                          | 0,62              |
| `winlessEnded` (N ≥ 4)           | —                          | 0,99              |
| tabela (sem suspensão nem lesão) | 10,8                       | 7,6               |
| `suspended`                      | 14,2                       | 14,2              |
| `injured`                        | 3,2                        | 3,2               |

Em 95% das rodadas alguém faz 2 gols ou mais, então o artilheiro da rodada quase sempre existe. Suspensões e lesões são muitas (cerca de 0,7 e 0,16 por clube e rodada) e não são notícia por si: a camada de conteúdo só transforma em nota as do clube do técnico e as do próximo adversário dele.

**Mínimos do fim de série, medidos** (por rodada, 60 temporadas): `unbeatenEnded` com N ≥ 5, 6, 7, 8 dá 0,62, 0,39, 0,25, 0,16; `winlessEnded` com N ≥ 3, 4, 5, 6 dá 1,66, 0,99, 0,59, 0,37. Ficam 5 e 4, os mínimos das séries: um pouco mais de uma invencibilidade e de um jejum encerrados por clube na temporada (1,2 e 1,9), e a regra cabe numa frase. Se o jejum de 4 encerrado parecer notícia fraca no teste com amigos, o próximo passo é subir os dois mínimos do jejum para 5 juntos (série e fim), não só o do fim.

## Força e dificuldade na escolha do clube

A tela de Novo jogo mostra, para cada clube, a força (número, a mesma de `balance-targets.md`) e um rótulo pela posição da força entre os 20: 1º a 6º "Favorito", 7º a 14º "Meio de tabela", 15º a 20º "Luta contra a queda". É a dificuldade da carreira (`PROJETO.md`: "a dificuldade de verdade é o clube escolhido").

## Expectativa da diretoria (só informativa na 1a)

Mostrada no início da temporada e conferida no resumo; não mexe em nada na 1a.

**Regra em uma frase (decisão do CEO, 2026-11-04):** a diretoria pede o que o elenco pode dar; o porte diz o quanto ela cobra.

```
strengthRank = posição do clube na ordem de ClubState.strength da temporada (1 = mais forte; empate pelo id)
targetPosition = min(strengthRank + 2, 16)
```

| Porte   | Tom da cobrança na 1a (texto)                                   | Paciência (Etapa 4) |
| ------- | --------------------------------------------------------------- | ------------------- |
| Grande  | exigente ("é obrigação ficar entre os N")                       | menor               |
| Médio   | firme ("a meta é ficar entre os N")                             | média               |
| Pequeno | compreensivo ("o objetivo é terminar entre os N" ou "não cair") | maior               |

Na temporada 1, a `strength` é a força efetiva da carreira; da 2ª em diante, a recalculada na virada ("Força dos clubes na virada"). A meta é refeita a cada temporada.

**Exemplos:** Flamingo (força 1º) → terminar entre os 3; Corinto (força 17º, grande) → entre os 16, com tom de grande; Bragantão (9º, pequeno) → entre os 11. A meta de 16 lê "não cair".

Isto troca a meta por porte do `PROJETO.md` ("o porte define as metas e a paciência"): vai para a ADR da Etapa 4 (o `architect` abre). Na 1a só muda o texto mostrado.

Na 1a não há estilo (escondido pela P3, US-014): o texto da meta usa só o tom do porte da tabela acima. Na Etapa 4, com o estilo, o Tranquilo diz "a diretoria espera" e o Realista, "a diretoria cobra"; a confiança de 0 a 100 e a demissão (só no Realista) entram junto.

## Porte na carreira (Etapa 4, decisão do CEO)

**Regra em uma frase:** dentro de uma carreira, o porte de um clube pode crescer devagar com títulos e torcida conquistados (pequeno → médio → grande), sem mexer nos dados base.

- Fica no save da carreira (`careerSize` por clube), não no `ClubDef`; jogo novo começa com o porte do lote.
- Critério a calibrar na Etapa 4 com o `/balance`: título nacional ou continental mais termômetro da torcida alto por várias temporadas sobe um degrau; nunca mais de um degrau por temporada e nunca pela colocação sozinha. Cair de porte não existe dentro da carreira (porte é história).
- Mudar o porte muda a paciência e o tom da diretoria, o perfil padrão e, na Etapa 3, a receita; não muda a força.
- Mudança no formato de save: ADR do `architect` com migração.

## Fim de temporada

**Regra em uma frase (decisão P2 do CEO):** depois da rodada 38 vêm a cerimônia, os prêmios e o resumo; os jogadores evoluem e fazem aniversário; e a temporada seguinte começa com os mesmos 20 clubes, todos aptos e descansados, sem fim de carreira na 1a.

Os 4 últimos aparecem como "zona de rebaixamento", sem efeito: ninguém sai, ninguém entra, e o clube do técnico continua na Série A mesmo entre os 4 últimos. A subida de clubes da Série B espera uma lista aprovada pelo CEO ("Acesso da Série B (futuro)", abaixo).

### Ordem: duas funções do motor

**`endSeason`** (só com `round` 39 e `phase: 'season'`; em qualquer outro estado devolve o erro e não mexe em nada, então a evolução nunca roda duas vezes):

1. **Tabela final:** campeão (1º) e zona de rebaixamento (17º a 20º), de `getStandings`. A tela mostra a cerimônia do campeão e a classificação final.
2. **Prêmios** (tabela abaixo), do `seasonStats`.
3. **Campanha** de cada clube humano: posição, pontos, meta da diretoria cumprida ou não, maior vitória, maior derrota, artilheiro do clube.
4. **Evolução e idade** de todos os jogadores dos 20 clubes (`jogadores.md`, "Evolução"): lê os minutos do `seasonStats` e a moral depois da rodada 38, e guarda o overall de antes para o "quem evoluiu" da campanha.
5. **Renovação mínima** ("Carreira longa na 1a", abaixo): quem tem 35 anos depois do aniversário sai do elenco, um jovem de 17 da base entra no lugar, e o clube que perdeu o ídolo escolhe outro. O aposentado sai de `squads` aqui e só sai de `players` no `startNextSeason`, para a tela de resumo ter o nome e o rosto dele mesmo se o app fechar na fase `seasonEnd`.
6. Grava o resumo em `pastSeasons` e passa a `phase: 'seasonEnd'`. O título já conta a partir daqui (a estrela nova aparece na própria cerimônia).

A ordem importa: prêmios e campanha leem o `seasonStats` e as idades da temporada jogada (a revelação tem até 21 anos **nesta** temporada), e a evolução lê os minutos antes de eles serem zerados. A tela de resumo, na fase `seasonEnd`, já mostra o elenco evoluído ("como o elenco chega à pré-temporada").

**`startNextSeason`** (só com `phase: 'seasonEnd'`): a **virada**.

1. `season + 1`, `year + 1` (o ano da temporada nova), `round` 1, `phase: 'season'`; calendário novo pelo sorteio da temporada nova ("Tabela de jogos"; datas pelo ano novo).
2. `seasonStats` zerado (`{}`), o `lastRound` já não está no estado (saiu na T-049; o relatório da rodada só volta no retorno do `playRound`); `lastSheets` fica (o `shownEleven` ignora a ficha que não resolve mais).
3. Jogadores e clubes, pelas tabelas abaixo. A meta da diretoria da temporada nova sai da força recalculada.
4. **Lembrete** discreto de exportar o save (`PROJETO.md`, "Saves e backup"), na interface.

A virada não sorteia nada (o único sorteio é o calendário, pela semente da temporada): o mesmo save no fim da temporada dá sempre a mesma temporada nova (US-025, "determinismo da virada").

### A virada: jogadores

**Regra em uma frase:** a temporada nova começa com todos aptos, descansados e sem histórico de banco ou de cartão; a moral faz metade do caminho até a esperança da torcida.

| Campo                                                                                | Na virada                                      | Por quê                                                                                                                                                                                                                                                                                                           |
| ------------------------------------------------------------------------------------ | ---------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `condition`                                                                          | 100                                            | a pré-temporada é o descanso; depois da rodada 38 o `playRound` não recupera                                                                                                                                                                                                                                      |
| `injuryRounds`                                                                       | 0                                              | a pausa de dezembro a abril (cerca de 19 semanas) é maior que a lesão mais longa do jogo (20 rodadas; `partida.md`, "Lesões"); decisão 13 de `balance-targets.md`                                                                                                                                                 |
| `suspendedGames`                                                                     | 0                                              | a suspensão é da competição que acabou; vale para amarelo e vermelho (uma regra só)                                                                                                                                                                                                                               |
| `yellowCount`                                                                        | 0                                              | idem                                                                                                                                                                                                                                                                                                              |
| `benchStreak`                                                                        | 0                                              | "esperava jogar" é coisa da temporada: ninguém fica "2 rodadas seguidas no banco" atravessando 4 meses                                                                                                                                                                                                            |
| `recentRatings` (forma)                                                              | `[]` ("sem jogos")                             | nota de 4 meses atrás não é forma; é o mesmo começo da temporada 1                                                                                                                                                                                                                                                |
| `morale`                                                                             | `round2(morale + 0.5 × (fans.start − morale))` | metade do caminho até a esperança de início de temporada (60): o campeão chega animado (cerca de 70), o lanterna chega abatido (cerca de 40), sem a espiral de uma temporada para a outra (decisão 13) Arredondada para centésimos (`round2`), para o save não crescer em dígitos a cada virada (BUG-A da T-017). |
| `clubAppearances`                                                                    | mantém                                         | conta a carreira (marcador `estreia`)                                                                                                                                                                                                                                                                             |
| `age`, `overall`, `attributes`                                                       | já mudaram no `endSeason`                      | evolução e idade                                                                                                                                                                                                                                                                                                  |
| `trait` (o ídolo inclusive), `potential`, `peakAge`, `growth`, `shirt`, nome e rosto | mantém                                         | o ídolo só muda quando se aposenta, e aí o novo já foi escolhido no `endSeason` (`jogadores.md`, "Traço de personalidade")                                                                                                                                                                                        |

`0.5` é constante (`MORALE_OFFSEASON_PULL`), não parâmetro. A moral continua sem arredondamento e cortada em 0 a 100.

### A virada: clubes

| Campo                            | Na virada                                               | Por quê                                                                                                                                                                                 |
| -------------------------------- | ------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fans` (termômetro)              | `fans.start` para os 20 clubes                          | "começo de temporada é esperança" (`torcida.md`); sem bônus de campeão nem desconto pela zona (P2: a zona não tem efeito; 5 pontos de termômetro são 0,3 ponto de mando, ninguém sente) |
| `idolBenchStreak`                | 0                                                       | mesma razão do `benchStreak`                                                                                                                                                            |
| `strength`                       | recalculada do elenco evoluído (abaixo)                 | pendência da T-014: os pontos esperados da torcida e a meta da diretoria seguem o elenco do ano                                                                                         |
| `profile`, `preferredFormations` | mantém                                                  | identidade do clube                                                                                                                                                                     |
| decisão pendente da torcida      | zerada (camada de aplicação; `docs/02-architecture.md`) | o termômetro volta a `fans.start` de qualquer forma                                                                                                                                     |

### Força dos clubes na virada

**Regra em uma frase:** a força de cada clube na temporada nova é a força do melhor XI do seu elenco depois da evolução, sem escada nem colocação.

```
strength(temporada nova) = elevenStrength(bestEleven(elenco inteiro, preferredFormations[0]))
```

- É a mesma definição de "Força" de `balance-targets.md`: média de `overall × fit` do melhor XI na formação preferida, com todos aptos e descansados, sem moral nem mando, escolhido como a geração escolhe (`bestEleven`). Número real, sem arredondar, sem sorteio e sem corte; a tela arredonda.
- Na temporada 1 a geração deixa o melhor XI a até 0,5 ponto da força efetiva, então a regra dá praticamente o número com que a carreira começou: a força só anda pelo que a evolução mudou.
- **Sem escada e sem colocação (decisão D8 do CEO):** a `LADDER` vale só para montar a temporada 1 a partir da lista de clubes; dentro da carreira a força vem do elenco. Não há renormalização para soma 1.400: se os jovens de um clube crescem, ele fica mais forte, e a escada muda de forma só pela evolução.
- **Quem lê, e quando:** os pontos esperados da torcida (`torcida.md`), a posição de força da meta da diretoria (`strengthRank`, acima) e o número "força do clube" das telas leem todos o mesmo campo, então **mudam juntos, uma vez por temporada, na virada**. A força do XI da rodada (`teamStrength`, na escalação e no placar) é outro número e continua mudando a cada rodada, como hoje. Não se recalcula `strength` no meio da temporada: a expectativa da torcida é de pré-temporada, e baixá-la com lesões daria termômetro de graça a quem perde jogadores (o mesmo motivo da leitura da T-014).
- **Sem realimentação:** depois do `newGame`, nada que escreve jogadores lê a `strength`, e a evolução não a lê. O único caminho indireto é força → pontos esperados → termômetro → moral → multiplicador de moral da evolução (0,9 a 1,1, só no crescimento). Medido: a força média da liga na temporada 3 é a mesma com a moral passando inteira, pela metade ou zerada (70,91, 70,92 e 70,92; `balance-log.md`, 2026-11-05, T-017).

### Prêmios

**Regra em uma frase:** artilheiro e garçom pelo total; os prêmios de nota e o de goleiro só para quem jogou pelo menos metade da temporada.

| Prêmio                | Quem concorre                                                                                                         | Critério                                                                   | Desempate, em ordem                                           |
| --------------------- | --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------- | ------------------------------------------------------------- |
| Artilheiro            | todos, com ao menos 1 gol                                                                                             | mais gols                                                                  | menos jogos; mais assistências; empatados em tudo **dividem** |
| Garçom                | todos, com ao menos 1 assistência                                                                                     | mais assistências                                                          | menos jogos; mais gols; empatados em tudo **dividem**         |
| Melhor jogador        | ao menos 19 jogos com nota (`ratedGames`)                                                                             | maior média de nota (`ratingSum / ratedGames`)                             | mais jogos com nota; mais minutos; menor id                   |
| Revelação             | idem, com até 21 anos na temporada jogada (antes do aniversário da virada)                                            | idem                                                                       | idem                                                          |
| Melhor goleiro        | posição natural GOL, ao menos 19 jogos (`games`)                                                                      | menor `conceded / games`                                                   | mais jogos; maior média de nota; menor id                     |
| Seleção do campeonato | por vaga de um 4-3-3 (GOL, 2 ZAG, 2 LAT, VOL, 2 MEI, 3 ATA), só a posição natural da vaga, ao menos 19 jogos com nota | maior média de nota, vaga a vaga na ordem da formação, sem repetir jogador | como o melhor jogador                                         |

- **19 é constante** (`AWARD_MIN_GAMES`, metade das 38 rodadas), não parâmetro. "Jogos com nota" são os de 15 minutos ou mais (a nota só existe neles); o goleiro conta `games`, porque `conceded` soma por partida em que ele entrou.
- **"Menor id"** só desempata o que já empatou em média, jogos e minutos (números reais, praticamente nunca): o clube pelo id, depois o número do jogador no clube (a mesma comparação numérica do `bestEleven`).
- **Ninguém atinge o mínimo:** não há o prêmio, e a tela mostra "sem vencedor nesta temporada"; na seleção, a vaga fica vazia. Sem segunda régua (a regra antiga, "metade dos jogos do clube", dava os mesmos 19). Medido (`balance-log.md`): por temporada, cerca de 282 jogadores com 19 jogos com nota, 20 goleiros com 19 jogos e de 15 a 25 jogadores de até 21 anos com 19 jogos com nota (de 13 a 24 no Realismo simplificado), nunca zero em 750 temporadas. Na carreira longa, com a renovação mínima (T-048), sempre há candidatos: nunca menos de 7 numa carreira, e a média vai de 15 a 110 por temporada ("Carreira longa na 1a"); sem ela, da temporada 6 em diante não havia jogador de até 21 anos.
- O clube do jogador premiado é o dele na temporada (na 1a ninguém troca de clube; o resumo guarda o `clubId` para quando houver mercado).

### Campanha do clube do técnico

Para cada clube humano (o da carreira; na liga online, cada clube com dono). Quem chama o `endSeason` passa a lista; sem ela, o resumo não tem campanha.

| Item                          | Regra                                                                                                                                                                                                                                |
| ----------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Posição e pontos              | da tabela final                                                                                                                                                                                                                      |
| Meta da diretoria             | `targetPosition` pela `strength` da temporada que acabou ("Expectativa da diretoria"); cumprida se `posição ≤ targetPosition`                                                                                                        |
| Maior vitória                 | maior saldo; empate: mais gols marcados, depois a rodada mais cedo; partida encerrada conta pelo placar definido; sem vitória, não há o item                                                                                         |
| Maior derrota                 | o mesmo, pelo lado da derrota                                                                                                                                                                                                        |
| Artilheiro do clube           | quem fez mais gols pelo clube; empatados dividem; sem gols, não há o item                                                                                                                                                            |
| Quem evoluiu                  | os jogadores do clube cujo overall mudou na evolução, do maior Δ para o menor (empate: maior overall novo, depois a ordem do elenco), com o overall de antes e o de depois                                                           |
| Despedidas e chegadas da base | quem se aposentou (`farewells`, na ordem do elenco da temporada jogada) e quem subiu da base (`academy`, na ordem de entrada); o aposentado aparece também em "Quem evoluiu", com o último overall; sem aposentadoria, não há o item |

### O que vai para `pastSeasons` (resumo enxuto)

Um item por temporada encerrada, gravado no `endSeason`. Só ids e números, nunca nomes (ADR-0012: um nome retirado é regerado no save, e um nome copiado aqui escaparia disso).

| Campo                          | Conteúdo                                                                                                                                                                                                                                           |
| ------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `season`, `year`               | a temporada e o ano                                                                                                                                                                                                                                |
| `championId`, `championPoints` | o campeão                                                                                                                                                                                                                                          |
| `relegationZone`               | os 4 clubes do 17º ao 20º, na ordem; só informativo (P2)                                                                                                                                                                                           |
| `awards`                       | os prêmios acima: para cada um, `playerId`, `clubId` e o número que deu o prêmio (gols, assistências, média, gols sofridos por jogo); artilheiro e garçom são listas (dividem); a seleção é a lista das 11 vagas com `slot`, `playerId` e `clubId` |
| `campaigns`                    | por `clubId` humano, os itens da campanha acima (o "quem evoluiu" como `playerId`, overall de antes e de depois)                                                                                                                                   |

Fica fora: a tabela inteira, as estatísticas de todos, as partidas e os fatos. **Meta: até 3 KB por item** em JSON, com um clube humano (medido na T-017: de 2,0 a 2,8 KB; a seleção do campeonato e o "quem evoluiu" são a maior parte). Não corto nada: os dois são o que o resumo da temporada mostra e o que o histórico da Etapa 4 vai ler, e 3 KB por temporada são cerca de 90 KB em 30 temporadas sem compressão, perto de um quarto do estado de um jogo novo (354 KB). O estado no começo da temporada 3 tem o tamanho do começo da temporada 2, mais um item de `pastSeasons`.

**Títulos da carreira (US-068):** o total de títulos de liga de um clube na carreira é `def.titles.league + (temporadas de pastSeasons com championId = clube)`. A fonte é o `pastSeasons`, sem campo novo em `ClubState`: o mesmo número não fica guardado em dois lugares, e a migração da US-068 ("histórico da temporada base mais os títulos das temporadas já encerradas") é exatamente essa conta. O `ClubDef` nunca muda. O escudo (ADR-0014) recebe o total nas telas da carreira (1 estrela pequena por título, cada 5 viram 1 grande); a tela de Novo jogo mostra o conjunto da temporada base. Função única no motor (sugestão: `careerLeagueTitles(state, clubId)`), usada pela interface e pelos templates.

**Gols sofridos na temporada (`PlayerSeasonStats.conceded`):** a soma, partida a partida, dos gols reais sofridos pelo time com o jogador em campo no gol ou na defesa, o mesmo contador que a nota da partida já usa (`Appearance.conceded`). Entra na T-013, junto com o resto do `seasonStats`: o campo é novo nesta versão do save, e acrescentá-lo depois pediria migração. O prêmio lê só quem é goleiro de posição; o número dos defensores fica disponível, sem uso na 1a.

### Carreira longa na 1a (decisão 14 de `balance-targets.md`; T-048)

**Regra em uma frase:** quem completa 35 anos na virada se aposenta, e o clube promove da base um jovem de 17 anos da mesma posição.

É a renovação **mínima**: a base de verdade (categorias, investimento, peneira) e a aposentadoria com festa são da Etapa 4, e a régua aqui é só não deixar o elenco envelhecer até parar. Não lê mercado, finanças nem desempenho.

- **O jovem** nasce como os "Jovens" da geração (`jogadores.md`, "Geração de elencos"): overall `def.strength − 12 + Normal(0, 4)`, arredondado e cortado em 35 a 92; atributos, traço sorteado, curva de idade, nacionalidade e moral inicial como na geração; potencial pela regra de até 23 anos (teto 95, sem o piso da joia). Idade 17, condição 100, `clubAppearances` 0, camisa: a menor livre a partir de 30. A âncora é a força da lista (`def.strength`), não a atual, para que um clube em queda não gere jovens piores e caia mais.
- **O ídolo** que se aposenta é substituído na mesma virada (`jogadores.md`, "Traço de personalidade").
- **Constantes, não parâmetros:** `RETIREMENT_AGE = 35` e a idade de 17 da base. São o botão da decisão 14, mas nenhuma meta obrigatória da 1a os lê (a temporada 1 não passa pela virada, e até a 3ª quase só se aposentam reservas), então não vão para `app/src/params/`.

**Medido** (`balance-log.md`, 2026-11-06): metas obrigatórias das temporadas 1 a 3 todas dentro nas 3 sementes. Em 30 temporadas (60 carreiras, semente 1): idade média de 23,6 a 27,3; candidatos à revelação nunca abaixo de 7 numa carreira; pontos do campeão de 74 a 77 e do 17º de 40 a 41 (dentro das metas da temporada única); campeão grande de 73% a 90%. Fora das metas, como a decisão 14 previu: gols por partida abaixo de 2,50 da temporada 8 em diante (2,39 a 2,49).

**O que a medição longa mostrou** (informativo; carreira longa é da Etapa 4):

- **Ciclo de 18 temporadas, que não amortece.** Como todo mundo entra com 17 e sai com 35, a idade de entrada e de saída é fixa, e a onda de aposentadorias da geração inicial se repete a cada 35 − 17 = 18 temporadas: aposentadorias por clube 0,43 na 1ª virada e na 19ª; idade média 27,3 na 4ª e na 22ª, 24,2 na 10ª e na 28ª. A queda de idade da temporada 10 (−0,7 por temporada) é o vale da primeira onda, não uma deriva sem fim: a idade volta a subir da 13ª em diante. Os candidatos à revelação seguem a mesma onda (de 15 na 1ª a 101 na 10ª, 32 na 18ª e 110 na 29ª).
- **A força média da liga sobe com a onda de jovens:** +1,4 na temporada 10, +4,0 da 15ª à 21ª, e volta a +1,5 na 27ª. É de todos os clubes ao mesmo tempo (a tabela não muda), mas a distância entre os 4 mais fortes e os 4 mais fracos da temporada 1 encolhe de 12,4 para 11,0 a 11,5 (−1,0 a −1,45, contra a trava de ±0,5 que só vale nas temporadas 2 e 3). Grandes contra não grandes ficam em ±0,25.
- **Os gols caem devagar** (2,43 na 10ª, 2,39 na 30ª): os atacantes do melhor XI envelhecem mais que os defensores (decisão 14).

**Ponto de checagem (sem meta nova; as metas da carreira longa são do CEO na Etapa 4).** Rodar de novo `npm run balance -- --seasons 60 --seed 1 --chain 30 --duels 0 --robot none` (cerca de 3 minutos com 4 threads) e comparar com os números acima quando:

1. mudar a idade de aposentadoria, a idade ou a fórmula do jovem da base, a evolução (`players.growthMin`, `players.growthMax`, curva de idade) ou as idades da geração;
2. **antes de fechar o desenho do acesso da Série B (Etapa 2):** o clube que sobe nasce pela força da lista (61 a 66), e uma Série A que já subiu até +4,0 de força média o receberia mais fraco do que a escada prevê. Ler a força média da liga na temporada em que o acesso entra e decidir a âncora com essa medição;
3. **antes de desenhar a base e a aposentadoria da Etapa 4:** a idade de saída deve ter variação (por exemplo, 33 a 37) para o ciclo de 18 temporadas amortecer; gols abaixo de 2,50 da 8ª temporada em diante e a distância entre fortes e fracos encolhendo mais de 1,0 entram ali como problema a resolver, junto com as metas da carreira longa ("Estabilidade da liga", "Elenco que se renova");
4. o `/balance` de release (antes de cada versão pública), só para registrar.

Leitura (não bloqueia): idade média fora de 23,5 a 27,5, alguma carreira sem candidato à revelação, força média da liga mais de 4,5 acima da temporada 1, ou gols abaixo de 2,35 pedem leitura do `game-designer` antes do merge, porque saem do que foi medido aqui.

### Acesso da Série B (futuro)

Guardado para quando o CEO aprovar a lista de clubes da Série B (P2): os 4 da zona de rebaixamento saem e entram 4 clubes da lista, com nome e força (`strength` 61 a 66), sorteados com peso pela força e com elencos gerados na hora; se o clube do técnico cair, a carreira segue na Série B quando ela existir (Etapa 2). O `startNextSeason` pode aceitar um `incoming` opcional (`docs/02-architecture.md`, §7), mas na 1a ninguém o passa, e não há regra de jogo para ele até a lista existir. Quando entrar, é decisão nova do CEO, com a lista.

## Parâmetros (`app/src/params/season.json`)

| Parâmetro             | Valor inicial                  | Faixa válida                                        | Por quê                                      |
| --------------------- | ------------------------------ | --------------------------------------------------- | -------------------------------------------- |
| `season.fifaWeeks`    | [9, 21, 25, 30]                | semanas inteiras de 1 a 34, crescentes, sem repetir | pausas que dão respiro e recuperação total   |
| `season.midweekWeeks` | [3, 7, 12, 16, 19, 23, 28, 32] | semanas inteiras de 1 a 34, crescentes, sem repetir | rodadas com 3 dias de descanso pedem rotação |

**Regras que cruzam as duas listas** (o validador recusa ao carregar): nenhuma semana de Data FIFA tem rodada no meio da semana, e `34 − (nº de semanas FIFA) + (nº de quartas) = 38` rodadas. Mais uma Data FIFA pede mais uma quarta, e vice-versa.

**Constantes:** 20 clubes, 38 rodadas, 3/1/0 pontos, 4 na zona de rebaixamento, ordem de desempate, metas por porte, mínimo de 19 jogos dos prêmios (`AWARD_MIN_GAMES`), a moral da virada a meio caminho de `fans.start` (`MORALE_OFFSEASON_PULL = 0.5`). O fim de temporada não tem parâmetro em `season.json`.

### Lesões entre temporadas: revisar na Etapa 2 (pedido do CEO, 2026-11-05)

A regra da 1a (a lesão termina na virada, decisão 13 de `balance-targets.md`) vale só enquanto a pausa entre temporadas for longa (cerca de 19 semanas) e não houver mercado para repor o jogador. Na Etapa 2, com estaduais e Copa do Brasil, o ano começa em janeiro e a pausa cai para algo como 6 a 8 semanas. Então:

- **Regra a adotar:** a lesão continua pelo tempo que falta, descontadas as semanas de pausa; uma lesão curta some na pausa, uma longa invade o começo do ano.
- **Lesões graves de longa duração:** o CEO pediu que entrem lesões de até cerca de 1 ano (o caso típico é a ruptura de ligamento do joelho), seguindo as regras do futebol brasileiro. Antes de virar regra, o `game-designer` pesquisa e registra: tempos de recuperação por tipo de lesão, frequência real, o que as regras de inscrição da CBF permitem ao clube nesse caso (por exemplo, inscrever um substituto ou manter o lesionado inscrito) e o efeito no contrato e no salário (Etapa 3).
- **Hoje:** a lesão mais longa da 1a é a "grave", de até 20 rodadas (`partida.md`, "Lesões"); a escala nova, com a lesão de cerca de 1 ano, entra com a calibragem da Etapa 2 e uma rodada de `/balance`.

### Suspensões entre temporadas: revisar na Etapa 2 (pedido do CEO, 2026-11-05)

Na 1a, tudo zera na virada: amarelos acumulados e suspensões, inclusive a de quem foi expulso na última rodada sem jogo para cumprir. Na Etapa 2, junto com o STJD (já no roteiro), o `game-designer` pesquisa o regulamento da CBF e define, com fonte:

- **Suspensão automática pendente** (3 amarelos ou expulsão sem jogo cumprido no fim do campeonato): se passa para a próxima edição da mesma competição, se vale em outra competição ou se prescreve.
- **Penas do STJD** (julgamento por agressão, por exemplo): contadas em jogos ou em dias, se atravessam a pausa e em quais competições valem.
- **Amarelos:** quando zeram (fim da competição, fase ou turno), conforme o regulamento de cada competição.

### Calendário com copas: prioridade e rodízio (Etapa 2; ideia do CEO, 2026-11-06)

Na 1a todos jogam só a Série A, e o favorito nunca divide o elenco: com 1.000 temporadas, o clube mais forte ganha 26,0% dos títulos, contra cerca de 20% para cada um dos dois maiores campeões no real. Na Etapa 2, com Copa do Brasil e estaduais (e na Etapa 5, com Libertadores e Sul-Americana), o calendário cheio deve criar **escolha de prioridade e rodízio** para os clubes do topo: mais jogos, mais desgaste e lesões, titulares poupados numa competição para render na outra. É isso, e não um ajuste na partida, que deve aproximar a concentração de títulos da liga do real. A medida e a meta estão na decisão 18 de `balance-targets.md`; as regras de prioridade da IA e do técnico se desenham com as copas.

## Casos de borda

| Caso                                            | Regra                                                                                                                                                                                                  |
| ----------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Partida encerrada por menos de 7 em campo       | vale o placar definido em `partida.md`; cartões e gols contam normal                                                                                                                                   |
| Goleiro trocado ou expulso no jogo              | cada um soma os gols sofridos enquanto estava em campo; o jogador de linha que vai para o gol soma os dele, mas não concorre ao prêmio de goleiro                                                      |
| Empate total até os amarelos                    | sorteio determinístico (critério 8)                                                                                                                                                                    |
| Prêmio sem ninguém com 19 jogos                 | não há o prêmio ("sem vencedor nesta temporada"); na seleção, a vaga fica vazia                                                                                                                        |
| Artilheiros empatados em tudo                   | dividem o prêmio                                                                                                                                                                                       |
| Clube do técnico na zona de rebaixamento        | continua na Série A na temporada seguinte (P2); a tela mostra a zona com o aviso de que o acesso e o rebaixamento entram numa próxima versão                                                           |
| `endSeason` chamado de novo, ou antes da 38ª    | devolve o erro e não muda o estado; a evolução e o título nunca contam duas vezes                                                                                                                      |
| `startNextSeason` fora da fase `seasonEnd`      | devolve o erro e não muda o estado                                                                                                                                                                     |
| App fechado entre `endSeason` e a virada        | o save fica na fase `seasonEnd`; ao abrir, volta ao resumo e o "Próxima temporada" faz a virada (as duas funções são deterministas)                                                                    |
| Lesão longa no fim da temporada                 | termina na virada, como as suspensões (decisão 13 de `balance-targets.md`)                                                                                                                             |
| Ídolo envelhecido ou em queda                   | continua ídolo até se aposentar aos 35; a regra do banco vale igual, e uma entrada nos acréscimos zera o contador (`jogadores.md`)                                                                     |
| Ídolo se aposenta                               | o clube escolhe um novo no mesmo `endSeason` (`jogadores.md`, "Traço de personalidade") e o `idolBenchStreak` volta a 0                                                                                |
| Vários aposentados na mesma posição             | um jovem por aposentado, cada um com a posição do seu; o elenco segue com 25 e 3/5/4/4/4/5                                                                                                             |
| Clube sem vitória ou sem gol na temporada       | a campanha fica sem "maior vitória" ou sem "artilheiro do clube"                                                                                                                                       |
| Ano da temporada nova fora do calendário aceito | `startNextSeason` devolve `invalid-calendar` e não muda o estado                                                                                                                                       |
| Ano escolhido no novo jogo ausente              | a interface passa o ano corrente do aparelho; o motor só recebe o número                                                                                                                               |
| Save aberto no meio da rodada (app fechado)     | a rodada só conta depois do salvamento do passo 8; senão recomeça do passo 1 com as mesmas sementes; as partidas da IA dão o mesmo resultado, e a partida ao vivo do técnico recomeça do apito inicial |
