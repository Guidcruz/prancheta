# ADR-0009: Protocolo da liga online (rodada, prontos, ao vivo e assíncrono)

- **Status:** aceita (CEO, 2026-11-04)
- **Data:** 2026-11-04
- **Decisores:** architect (propôs), CEO (aprova)

## Contexto

Na 1b, a rodada avança quando todos os humanos confirmam ou quando o prazo vence. Quem não confirmou joga com a última escalação, e o servidor simula com o mesmo motor, uma única vez (`docs/PROJETO.md`, "Modo online"; US-055 a US-061). Ao vivo e assíncrono são a mesma liga com prazos diferentes. No ao vivo, todos veem as partidas juntos, com diferença máxima definida pelo architect (US-057). Pela P6 (recomendação), não há comandos durante a partida online. O ADR-0002 pede salas atrás de uma interface própria e banco com SQL padrão, para permitir migrar para uma VPS.

## Opções consideradas

| Opção                                                                                                                 | Prós                                                                                   | Contras                                                                                       |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------- |
| A: estado da liga no D1; o Durable Object só coordena (prontos, alarme do prazo, processamento único, WebSocket)      | uma fonte de verdade em SQL padrão; troca simples para VPS; DO quase sem armazenamento | cada rodada lê e grava o estado no D1                                                         |
| B: estado da liga dentro do armazenamento do Durable Object                                                           | menos idas ao banco                                                                    | duas fontes de verdade (D1 para "minhas ligas" e DO para o jogo); preso à Cloudflare          |
| Transmissão ao vivo: o servidor envia minuto a minuto                                                                 | ninguém vê o placar antes                                                              | DO acordado minutos por rodada; mais mensagens; mais custo                                    |
| Transmissão ao vivo: linha do tempo completa com `startAt` comum; cada cliente mostra o minuto pelo relógio corrigido | uma mensagem por rodada; quem chega atrasado entra no minuto certo; barato             | um cliente modificado poderia ver o placar antes (sem efeito no jogo, porque não há comandos) |

## Decisão

**A**, com a transmissão por **linha do tempo completa**:

- **Estado:** `league_states` (GameState gzip, a atual e a anterior), `round_results` (RoundReport gzip, chave única por rodada) e `sheets` (escalações confirmadas) no D1, acessados só pela interface `Db`.
- **Sala:** um `LeagueRoomDO` por liga implementa `RoomCoordinator` (`docs/02-architecture.md`, item 4.4). Para a VPS e os testes há o `InMemoryRoom`, com uma fila por liga e um temporizador.
- **Ciclo da rodada:** `open` (com `deadline_at`) → `processing` → `broadcasting` (só ao vivo) → `done`. No assíncrono, a próxima abre logo depois de `done`. No ao vivo, abre 30 s depois do fim da transmissão. A troca de modo (US-061) vale a partir da próxima rodada aberta.
- **Prontos:** cada `PUT .../sheet` válido grava a escalação e avisa a sala. A sala processa quando todos os humanos com `controller = 'human'` estão prontos. Clubes com a IA no comando não são esperados.
- **Processamento único e idempotente:** a sala serializa. A gravação é um `batch` do D1 condicionado a `leagues.season/round` atuais, e `round_results` é único por `(league_id, season, round)`.
- **Escalação de quem não confirmou:** a última confirmada, com cada desfalque (suspenso ou lesionado) trocado pela regra da IA só naquela vaga, e o dono do clube é avisado. Quem nunca confirmou fica com `suggestSheet`. Ao processar uma rodada sem confirmação, `missed_rounds` sobe. Ao chegar a `inactivity_rounds`, o controle passa à IA. Confirmar de novo devolve o clube ao humano (P10).
- **Ao vivo:** mensagem `roundLive { startAt, msPerMinute, matches[].events }` pelo WebSocket com hibernação. O cliente corrige o relógio pelo `serverTime` do `hello`, e a meta de diferença entre aparelhos é de até 2 s. O resultado é gravado antes de a transmissão começar, então quem cai ou chega atrasado não muda nada.
- **Assíncrono:** sem WebSocket. Ao abrir o app, o cliente busca `GET /leagues/:id` e `GET /leagues/:id/rounds?after=` e mostra os resumos da mais antiga para a mais recente (US-058). Push fica para a Etapa 6.
- **Notícias:** geradas no cliente a partir dos `Fact` do `RoundReport`, com a mesma semente para todos (ADR-0007). Cada um vê no próprio idioma.
- **Prazos permitidos:** os da P12 (ao vivo 1, 2 ou 5 min; assíncrono 12, 24 ou 48 h), na configuração do servidor.

## Consequências

- **Positivo:** uma fonte de verdade em SQL. Processamento único garantido em duas camadas. O ao vivo custa uma mensagem por rodada. A migração para VPS troca só as duas implementações (`Db`, `RoomCoordinator`).
- **Negativo:** cada rodada lê e grava cerca de 100 a 300 KB no D1, o que cabe com folga no plano gratuito. O placar chega ao aparelho antes de ser mostrado.
- **Pendências:** T-058, T-059, T-062, T-063 e T-064. Bancada de CPU do `processRound` (risco da `docs/02-architecture.md`, item 9).

## Conformidade

- Nenhum SQL fora de `server/src/db/`. Nenhuma lógica de rodada fora de `server/src/rooms/` e do motor.
- O cliente nunca envia placar, evento ou estado: o servidor só aceita `TeamSheet`, ids de catálogo e configurações.
- Teste: duas chamadas simultâneas de `processRound` dão uma rodada processada. Rodada processada no servidor e pelo motor do cliente em teste dá o mesmo resultado.
