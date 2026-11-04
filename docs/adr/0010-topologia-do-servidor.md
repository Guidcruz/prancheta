# ADR-0010: Topologia do servidor na 1b (Pages Functions + Worker de salas)

- **Status:** proposta
- **Data:** 2026-11-04
- **Decisores:** architect (propôs), devops-engineer (implementa), CEO (aprova)

## Contexto

O ADR-0002 põe site e jogo no Cloudflare Pages (já configurado em `prancheta-ad1.pages.dev`) e o servidor em Hono com Workers, D1 e Durable Objects na 1b. Três fatos pesam: (1) a passkey fica presa ao domínio da página, e um cookie de sessão sem CORS só funciona na mesma origem; (2) as Pages Functions podem usar D1 e Durable Objects, mas a classe do Durable Object precisa estar num Worker próprio; (3) o projeto é custo zero e só o CEO publica em produção.

## Opções consideradas

| Opção                                                                                    | Prós                                                                                               | Contras                                                                                         |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A: Pages Functions em `/api/*` (Hono) + Worker `prancheta-rooms` só com o Durable Object | mesma origem do jogo (cookie primário, `rpId` igual, sem CORS); mantém o Pages e as prévias por PR | dois itens para publicar (Pages sozinho; Worker de salas por job com aprovação)                 |
| B: Worker separado em `*.workers.dev` com toda a API                                     | um deploy de servidor                                                                              | outra origem: CORS e cookie de terceiro (bloqueado no Safari); sessão teria de ir em cabeçalho  |
| C: migrar site e jogo para um Worker único com arquivos estáticos                        | um só deploy, com o DO no mesmo script                                                             | muda o ADR-0002 e a hospedagem já configurada; troca a origem (saves locais de teste se perdem) |

## Decisão

**A** (recomendada; a C fica como alternativa para o CEO, que mudaria o ADR-0002):

- `server/` vira workspace npm, com `server/src/app.ts` (Hono, sem nada de Cloudflare) e as implementações `D1Db` e `LeagueRoomDO`.
- `functions/api/[[route]].ts` (na raiz, exigência das Pages Functions) é só um adaptador que monta o app do `server/` com os bindings `DB` (D1) e `LEAGUE_ROOM` (Durable Object do Worker `prancheta-rooms`, ligado por `script_name`).
- O Worker `prancheta-rooms` (`server/wrangler.rooms.toml`) exporta `LeagueRoomDO` com armazenamento SQLite (exigência do plano gratuito para Durable Objects) e usa só alarme e WebSocket com hibernação.
- Ambientes: produção com o D1 `prancheta` e o Worker `prancheta-rooms`. As prévias de PR usam o D1 `prancheta-preview` e o Worker `prancheta-rooms-preview`, com `rpId` igual ao host da prévia.
- Publicação: o Pages publica sozinho no merge do CEO (como hoje). O Worker de salas e as migrações do D1 (`wrangler d1 migrations apply`) saem de um job do GitHub Actions no push da `main`, num _environment_ `production` que exige aprovação do CEO. Nenhum agente roda `wrangler deploy` (hook).
- `_headers` do Pages com CSP e cabeçalhos de segurança (`docs/02-architecture.md`, item 5).

## Consequências

- **Positivo:** sessão e passkey simples e seguras na mesma origem. Prévias por PR continuam automáticas. O Hono e a `Db` seguem portáveis para Node/Bun numa VPS (ADR-0002).
- **Negativo:** duas peças para configurar uma vez. O Worker de salas pode ficar uma versão atrás das Functions entre o merge e a aprovação do job, por isso o protocolo entre os dois é versionado (`RoomCoordinator` por RPC com campo de versão).
- **Pendências:** T-050, T-051 e `docs/04-deploy.md` (checklist do CEO). Custo previsto: zero no plano gratuito. O plano pago de US$ 5/mês só entra se a bancada de CPU pedir, com autorização do CEO.

## Conformidade

- Nada fora de `server/src/` conhece Hono, D1 ou Durable Object, salvo os dois adaptadores (`functions/api/` e o Worker de salas).
- O job de deploy só roda na `main` e com a aprovação do _environment_ `production`. O hook continua bloqueando `wrangler deploy` por agentes.
