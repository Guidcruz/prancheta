# Deploy e operação

> Mantido pelo `devops-engineer`. Publicação em produção é do CEO.

## Ambientes

| Ambiente | Para quê           | Onde                                                               | Publicado por                                     |
| -------- | ------------------ | ------------------------------------------------------------------ | ------------------------------------------------- |
| local    | desenvolvimento    | `npm run dev`                                                      | qualquer um                                       |
| prévia   | revisão de cada PR | `<branch>.prancheta-ad1.pages.dev` (Cloudflare Pages cria sozinho) | Cloudflare, no push da branch                     |
| produção | jogadores          | `prancheta-ad1.pages.dev` (depois o domínio definitivo)            | Cloudflare, no merge na `main` (o merge é do CEO) |

## GitHub (checklist do CEO, uma vez)

Settings → Branches → regra para `main`:

- [ ] Exigir pull request antes do merge
- [ ] Exigir status check `ci` passando
- [ ] Exigir também `e2e (chromium)` e `e2e (webkit)` (jobs do E2E, T-024; só aparecem na lista depois de rodarem uma vez num PR)
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

## E2E (Playwright) e CI

- **Comando:** `PRANCHETA_ENV=test npm run test:e2e` (o hook só deixa rodar com a variável). Sobe sozinho o build de teste (`PRANCHETA_ENV=test vite build`, saída em `app/dist-e2e/`, IndexedDB `prancheta-test`) e o serve em `127.0.0.1:4173`; o `playwright.config.ts` se recusa a rodar sem a variável. Nada do `dist/` publicado é usado.
- **Projetos:** `chromium-mobile` e `webkit-mobile` (390x844), `chromium-desktop` e `webkit-desktop` (1280x800). Sem janela (headless), trace/captura/vídeo desligados; localmente 1 worker, no CI 2.
- **Rede bloqueada:** todo spec usa `tests/e2e/fixtures.ts`, que aborta qualquer requisição fora da origem do servidor de teste e reprova o teste se houver alguma. Service worker bloqueado (só o spec de PWA offline, T-039, liga).
- **Só Chromium, com um navegador já instalado** (ambiente sem acesso ao download): `PRANCHETA_ENV=test PRANCHETA_CHROMIUM=<caminho do chrome-headless-shell> npm run test:e2e -- --project=chromium-mobile --project=chromium-desktop`. WebKit só roda no CI, dentro do container oficial do Playwright (`mcr.microsoft.com/playwright:v1.65.0-noble`).
- **Job `e2e` no CI** (`.github/workflows/ci.yml`): matriz `chromium` e `webkit`, em paralelo ao job `ci`, 15 min de limite, rodando no container oficial `mcr.microsoft.com/playwright:v1.65.0-noble` (`--ipc=host --init`), que já traz os navegadores e as dependências do sistema: não há cache de navegadores nem `playwright install`. Um passo confere que o `@playwright/test` instalado pelo `npm ci` tem a mesma versão da tag da imagem e falha com mensagem clara se não tiver; ao atualizar o Playwright, troque a tag, o digest (`@sha256:...`, o do índice multi-arquitetura, lido em `https://mcr.microsoft.com/v2/playwright/manifests/<tag>` no cabeçalho `Docker-Content-Digest`) e `PW_IMAGE_VERSION` no `ci.yml` junto com o `package-lock.json`. A imagem fica fixada por tag e digest. `PRANCHETA_ENV=test` vale só no passo do E2E, nunca no nível do job (o `scripts/build.mjs` se recusa a montar o `dist/` com ela). Se falhar, sobe o `playwright-report/` e o `test-results/` como artefato por 7 dias. Custo: mais dois jobs de Actions por PR (alguns minutos cada, incluindo baixar a imagem do container a cada execução; se o repositório for privado, consomem os minutos gratuitos do GitHub).
- **Trava contra o ambiente de teste em produção:** `tests/regression/no-test-hooks-in-prod.test.ts` (roda no `npm run test:all` e num passo do `ci`) e um `grep` no passo "Conferir a saída" falham se o `dist/` tiver `prancheta-test` ou `__prancheta_test__`.
- **Golden da partida no navegador** (`tests/e2e/golden.spec.ts`): refaz no navegador as partidas dos goldens do motor e compara byte a byte com `app/src/engine/__golden__/`. Confere também a `exp-table`. Roda no Chromium e no WebKit e bloqueia o PR se divergir em qualquer um (ADR-0020, T-074).
- **Secrets:** nenhum.

## Hook de pre-commit (Prettier)

- `npm install` roda `prepare` (`scripts/setup-hooks.mjs`), que faz `git config core.hooksPath scripts/git-hooks`. Fora de um checkout git ou com `CI` definido, não faz nada.
- `scripts/git-hooks/pre-commit` roda `prettier --write` nos arquivos staged suportados e faz `git add` deles de novo. Se um arquivo staged também tem alterações fora do stage, o hook recusa e diz o que fazer. Sem dependência nova. O CI segue com `prettier --check`.
- Exige bash 4.4 ou mais novo (o macOS traz o 3.2; instale com `brew install bash`).
- Com `git commit <arquivo>`, faça `git add <arquivo>` antes: o hook só formata o que está no stage.
- `core.hooksPath` sobrescreve qualquer hook global do usuário (`~/.config/git/hooks`).

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
