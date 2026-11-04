# Temporada da Série A (Etapa 1a)

> Mantido pelo `game-designer`. Fonte: `docs/PROJETO.md`, "Competições e calendário" (Série A: 20 clubes, pontos corridos, 4 caem, abril a dezembro), "Diretoria e metas" e "Novo jogo: configurações iniciais". Parâmetros em `app/src/params/season.json` (`season.*`).

**Regra em uma frase:** 20 clubes jogam todos contra todos em turno e returno, 38 rodadas de abril a dezembro; vitória vale 3, empate 1; o primeiro é campeão e os 4 últimos caem.

## Escopo

| Entra na 1a                                                    | Fica para depois                                                        |
| -------------------------------------------------------------- | ----------------------------------------------------------------------- |
| 38 rodadas, tabela, desempate, campeão, rebaixados             | Séries B a D com acesso de verdade, estaduais, Copa do Brasil (Etapa 2) |
| Datas aproximadas (fim de semana, 8 rodadas no meio da semana) | Ritmo "Tempo real" com o calendário real do servidor (Etapa 4)          |
| Prêmios da temporada e resumo                                  | Vagas na Libertadores e Sul-Americana valendo (Etapa 5)                 |
| Expectativa da diretoria só informativa (decisão 6)            | Barra de confiança, cobrança e demissão (Etapa 4)                       |
| Evolução e envelhecimento no fim da temporada                  | Base, aposentadorias com festa, histórico e recordes (Etapa 4)          |

Na 1a o ritmo é sempre "No meu ritmo": a rodada avança quando o jogador toca em "Jogar rodada". O tipo de carreira é, na prática, "clube fixo" e o estilo Tranquilo e o Realista só mudam o texto da diretoria (demissão: Etapa 4).

## Tabela de jogos

1. Embaralha os 20 clubes com a semente da carreira (`seedFromString("<seed>-fixtures")`).
2. Turno (rodadas 1 a 19) pelo método do círculo (tabela de Berger), que dá a cada clube no máximo 2 jogos seguidos em casa ou fora.
3. Returno (rodadas 20 a 38) espelhado: a rodada `19 + n` repete os confrontos da rodada `n` com o mando invertido, como na CBF.
4. Sem restrição de clássico na 1a. Se dois clubes da mesma cidade forem mandantes na mesma rodada, não há problema (cada um tem o seu estádio na lista de clubes).

## Datas

A temporada começa no 2º sábado de abril do ano escolhido no novo jogo (o ano entra como argumento; o motor nunca lê a data do aparelho) e dura 34 semanas.

| Item                      | Regra                                                  | Parâmetro                                              |
| ------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| Rodadas de fim de semana  | domingo, nas 34 semanas exceto as de Data FIFA         | —                                                      |
| Data FIFA (sem rodada)    | semanas 9, 21, 25 e 30 da temporada                    | `season.fifaWeeks = [9, 21, 25, 30]`                   |
| Rodadas no meio da semana | quarta-feira das semanas 3, 7, 12, 16, 19, 23, 28 e 32 | `season.midweekWeeks = [3, 7, 12, 16, 19, 23, 28, 32]` |

Conta: 34 − 4 = 30 rodadas de domingo + 8 de quarta = 38. Domingo → quarta são 3 dias de recuperação; quarta → domingo, 4. A rodada 38 termina na primeira semana de dezembro. Todos os jogos de uma rodada acontecem no mesmo dia (a hora é só texto).

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
8. Sorteio: ordem de `seedFromString("<seed>-tiebreak-<clubId>")`, menor primeiro (determinístico e sem gastar sorteios do `Rng` da temporada)

Com 3 ou mais clubes empatados até o critério 4, pula o 5 e segue do 6.

**Zonas na tela:** 1º "Campeão"; 2º a 6º "Zona da Libertadores" e 7º a 12º "Zona da Sul-Americana", com o aviso "as copas chegam numa próxima versão"; 17º a 20º "Rebaixamento". Sempre com rótulo de texto, não só faixa de cor.

## Ordem do processamento de uma rodada

1. Validar as escalações; a IA monta as suas (`ia-clubes.md`).
2. Simular as 10 partidas (cada uma com a sua semente; o jogo do técnico pode ser ao vivo, as outras rodam em paralelo e a tela pode mostrar os placares da rodada).
3. Atualizar tabela, artilharia e estatísticas.
4. Descontar suspensões cumpridas e rodadas de lesão; aplicar as novas.
5. Moral dos jogadores (`jogadores.md`), depois termômetro da torcida (`torcida.md`).
6. Recuperar condição até a próxima rodada (dias de intervalo × 7).
7. Gerar os fatos para notícias e rede social (lista de marcadores de `partida.md` + fatos da tabela abaixo).
8. Salvamento automático.

**Fatos da tabela para o `content-writer`:** `liderança` (assumiu, perdeu, manteve por N rodadas), `entrouZ4` / `saiuZ4`, `invencibilidade` (N jogos sem perder, N ≥ 5), `jejum` (N jogos sem vencer, N ≥ 4), `campeãoAntecipado`, `rebaixadoMatematicamente`, `artilheiroDaRodada`, `últimaRodadaDecisiva` (título ou rebaixamento em aberto antes da 38).

Campeão antecipado e rebaixado matemático: quando a diferença de pontos é maior que `3 × rodadas restantes`; empate nessa conta não define (depende de desempate) e só vale na última rodada.

## Força e dificuldade na escolha do clube

A tela de Novo jogo mostra, para cada clube, a força (número, a mesma de `balance-targets.md`) e um rótulo pela posição da força entre os 20: 1º a 6º "Favorito", 7º a 14º "Meio de tabela", 15º a 20º "Luta contra a queda". É a dificuldade da carreira (`PROJETO.md`: "a dificuldade de verdade é o clube escolhido").

## Expectativa da diretoria (só informativa na 1a)

Mostrada no início da temporada e conferida no resumo; não mexe em nada na 1a.

| Porte   | Meta da temporada        |
| ------- | ------------------------ |
| Grande  | terminar entre os 6      |
| Médio   | terminar entre os 10     |
| Pequeno | não cair (16º ou melhor) |

No estilo Tranquilo o texto é "a diretoria espera"; no Realista, "a diretoria cobra". A confiança de 0 a 100 e a demissão entram na Etapa 4.

## Fim de temporada

Sempre, ao fim da rodada 38:

1. **Cerimônia do campeão** e lista dos 4 rebaixados.
2. **Prêmios:** artilheiro (gols; desempate: menos jogos, depois mais assistências), garçom (assistências), melhor jogador (maior média de nota com ao menos 19 jogos), revelação (idem, até 21 anos), seleção do campeonato (melhor média por vaga num 4-3-3, ao menos 19 jogos), melhor goleiro (menos gols sofridos por jogo, ao menos 19 jogos).
3. **Resumo do técnico:** posição, meta cumprida ou não, maior vitória, maior derrota, artilheiro do clube, "quem evoluiu" (a evolução calculada no passo 4).
4. **Evolução e idade** (`jogadores.md`), amarelos zerados, lesões terminadas.
5. **Lembrete** discreto de exportar o save (`PROJETO.md`, "Saves e backup").

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
| Empate total até os amarelos                | sorteio determinístico (critério 8)                                                                                                                                                                    |
| Prêmio sem ninguém com 19 jogos             | baixa o mínimo para metade dos jogos do clube; se ainda vazio, não há o prêmio                                                                                                                         |
| Artilheiros empatados em tudo               | dividem o prêmio                                                                                                                                                                                       |
| Ano escolhido no novo jogo ausente          | a interface passa o ano corrente do aparelho; o motor só recebe o número                                                                                                                               |
| Save aberto no meio da rodada (app fechado) | a rodada só conta depois do salvamento do passo 8; senão recomeça do passo 1 com as mesmas sementes; as partidas da IA dão o mesmo resultado, e a partida ao vivo do técnico recomeça do apito inicial |
