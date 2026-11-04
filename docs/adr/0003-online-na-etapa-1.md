# ADR-0003: Online mínimo já na Etapa 1 (1b)

- **Status:** aceita
- **Data:** 2026-11-03
- **Decisores:** CEO (pediu), Orquestrador (registrou)

## Contexto

O plano original deixava o online para a Etapa 6 e as contas anônimas para a Etapa 4. O CEO quer jogar online com amigos desde a primeira versão, mesmo sem todos os recursos.

## Decisão

A Etapa 1 fica em duas metades: **1a**, carreira offline da Série A jogável; **1b**, online mínimo sobre o mesmo motor: conta anônima (apelido + passkey + código de recuperação), ligas da Série A por código de convite, modos ao vivo e assíncrono, servidor simulando as rodadas (Hono + Workers + D1 + Durable Objects), mensagens prontas. Ficam para depois: mercado entre humanos (Etapa 3), tempo real e sincronização de saves (Etapa 4), ligas com várias divisões e torneios continentais (Etapas 2 e 5), denúncias, painel de admin completo e apoio via PIX (Etapa 6). A Etapa 6 passa a se chamar "Online completo".

## Consequências

- **Positivo:** o modelo de dados nasce multiplayer; feedback de ligas reais desde cedo.
- **Negativo:** o servidor, as contas e a auditoria de privacidade (LGPD, ECA Digital) entram mais cedo; a 1b pode exigir o plano pago dos Workers.
- **Pendências:** `docs/PROJETO.md` (congelado) ainda tem frases da versão anterior na seção do painel de admin e do devops; esta ADR prevalece.

## Conformidade

`docs/roadmap.md`, `CLAUDE.md` e o site refletem 1a e 1b; o `security-auditor` revisa a 1b antes de qualquer merge que toque contas ou servidor.
