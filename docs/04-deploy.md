# Deploy e operação

> Mantido pelo `devops-engineer`. Publicação em produção é do CEO.

## Ambientes

| Ambiente | Para quê           | Onde                                                           | Publicado por                                     |
| -------- | ------------------ | -------------------------------------------------------------- | ------------------------------------------------- |
| local    | desenvolvimento    | `npm run dev`                                                  | qualquer um                                       |
| prévia   | revisão de cada PR | `<branch>.prancheta.pages.dev` (Cloudflare Pages cria sozinho) | Cloudflare, no push da branch                     |
| produção | jogadores          | `prancheta.pages.dev` (depois o domínio definitivo)            | Cloudflare, no merge na `main` (o merge é do CEO) |

## GitHub (checklist do CEO, uma vez)

Settings → Branches → regra para `main`:

- [ ] Exigir pull request antes do merge
- [ ] Exigir status check `ci` passando
- [ ] Exigir branch atualizada
- [ ] Não permitir bypass

## Cloudflare Pages (checklist do CEO, uma vez)

1. Workers & Pages → Create → Pages → Connect to Git → este repositório.
2. Build command: `npm run build`. Build output directory: `dist`. Root directory: `/`.
3. Environment variables: `NODE_VERSION` = `22`.
4. Depois do primeiro deploy, Custom domains → adicionar o domínio definitivo quando decidido. Trocar o domínio separa os saves locais dos jogadores: avisar no devlog e manter exportar/importar.
5. Web Analytics (sem cookies) → ativar para o projeto, se quiser contar visitas.

## Build e versão

- Versão em `config/prancheta.config.ts` (`version`) e nos `package.json`; o `devops-engineer` sobe no `/release`.
- `npm run build` gera `dist/` com o site em `/` e o jogo em `/jogo` (`scripts/build.mjs`).

## Publicar (produção)

1. O CEO faz merge do PR na `main`; o Cloudflare Pages publica sozinho.
2. Smoke test: abrir `/`, `/devlog/`, `/jogo/`; instalar o app no celular; confirmar a versão no rodapé.
3. Tag de release pelo `/release`, quando houver versão.

## Rollback

Cloudflare Pages → Deployments → o deploy anterior → "Rollback to this deployment". Instantâneo. Saves locais não são afetados; se o formato de save mudou, a migração é para frente e o rollback exige o aviso de "nova versão" desativado até corrigir.

## A partir da Etapa 1b (servidor)

Workers, D1 e Durable Objects entram com `wrangler` (R2 na Etapa 4), sempre com o custo documentado antes e cópia de segurança diária das ligas (exportação do D1). Segredos locais em `.dev.vars`, nunca commitado. Detalhes quando a 1b começar.

## Monitoramento

- Erros do cliente: registro sem dados pessoais (a definir na Etapa 1, com o `security-auditor`).
- Visitas: Cloudflare Web Analytics, sem cookies.
- Bugs viram tarefas `/feature` com teste de regressão.
