# Decisões vigentes

| ADR  | Decisão                                                                                                                                                                   | Data       |
| ---- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------- |
| 0001 | Stack: Svelte 5 + Vite 8 no jogo, Astro 7 no site, motor TypeScript puro e determinístico, fontes hospedadas                                                              | 2026-11-03 |
| 0002 | Hospedagem na Cloudflare, portável para VPS; produção só por merge do CEO                                                                                                 | 2026-11-03 |
| 0003 | Online mínimo na Etapa 1b; Etapa 6 vira "Online completo"                                                                                                                 | 2026-11-03 |
| 0004 | Caminho leve por PR; ninguém faz merge, push na main ou apaga branch além do CEO                                                                                          | 2026-11-03 |
| 0005 | Brasilidades (salários, transfer ban, STJD, estrutura, SAF, sócios, torcida no jogo) como sistemas de consequência; comissão técnica e estrutura afetam treino e evolução | 2026-11-03 |
| 0006 | Save como snapshot JSON gzip + SHA-256 no IndexedDB, 3 versões com gravação conferida, migração em cadeia, arquivo exportado `.txt`, `valibot`                            | 2026-11-04 |
| 0007 | API do motor em funções puras com `Result`, semente por fluxo, comandos como lista, fatos em vez de texto, `ENGINE_VERSION` + golden                                      | 2026-11-04 |
| 0008 | Conta anônima com passkey obrigatória; código de recuperação gerado no aparelho, servidor guarda só HMAC de um verificador HKDF                                           | 2026-11-04 |
| 0009 | Liga online: estado no D1, Durable Object só coordena; rodada idempotente; ao vivo por linha do tempo com `startAt` comum                                                 | 2026-11-04 |
| 0010 | Servidor da 1b em Pages Functions (`/api`, mesma origem) + Worker de salas com o Durable Object; deploy do Worker com aprovação do CEO                                    | 2026-11-04 |
| 0011 | Fator casa fixo `match.homeBase = 0.05` além da torcida do ADR-0005 (mandante vence 45% a 50%)                                                                            | 2026-11-04 |
| 0012 | Nome e rosto do jogador resolvidos na criação e guardados no estado; sementes só geram; nome retirado sai também dos saves antigos                                        | 2026-11-04 |

Decisões pendentes: `docs/status.md`.
