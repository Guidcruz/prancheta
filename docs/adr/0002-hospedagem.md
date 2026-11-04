# ADR-0002: Hospedagem na Cloudflare, portável para VPS

- **Status:** aceita
- **Data:** 2026-11-03
- **Decisores:** CEO (aprovou no documento de projeto), Orquestrador (registrou)

## Contexto

Custo zero até o online, uso comercial futuro (patrocínios e apoio), possibilidade de migrar para uma VPS mais tarde.

## Opções consideradas

| Opção                                                   | Prós                                                                  | Contras                                                      |
| ------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------ |
| A: Cloudflare (Pages, Workers, D1, Durable Objects, R2) | Uso comercial no plano gratuito; banda ilimitada; tudo no mesmo lugar | Limites de CPU por requisição no gratuito; algum acoplamento |
| B: Vercel                                               | Ótimo para sites                                                      | Plano gratuito proíbe uso comercial; sem banco próprio       |
| C: VPS desde o início                                   | Controle total                                                        | Custo e manutenção desde o dia 1                             |

## Decisão

Cloudflare (A). Site e jogo no Pages (`npm run build` → `dist/`, site em `/` e jogo em `/jogo`), prévia por PR, publicação em produção só por merge na `main` feito pelo CEO. Servidor em Hono nos Workers, D1 (SQLite) e Durable Objects a partir da Etapa 1b; R2 na Etapa 4. Portabilidade: Hono roda em Node e Bun; SQL padrão por uma camada de acesso; salas online atrás de uma interface própria.

## Consequências

- **Positivo:** zero de custo até o online; migração possível sem reescrever o motor nem a API.
- **Negativo:** a simulação de rodadas grandes pode exigir o plano pago dos Workers (US$ 5/mês).
- **Pendências:** domínio definitivo (trocar depois separa os saves locais); criação do projeto no Pages pelo CEO.

## Conformidade

Nenhum `wrangler deploy` ou criação de recurso por agente (hook); `docs/04-deploy.md` registra todo custo antes de existir.
