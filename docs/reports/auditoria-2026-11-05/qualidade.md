# Auditoria — Eixo C (Qualidade) — 2026-11-05, main em `5498ccc`

**Estado verde confirmado.** `npm test`: 81 arquivos, 1177 testes passando, 1 pulado (`names.test.ts:368`, só com `NAMES_FULL_CHECK=1`), 69,6 s nesta máquina (3 núcleos úteis). `npm run lint`: 26 s, saída 0, inclusive os casos do hook. Nenhum teste usa relógio, rede ou `Math.random`; os goldens estão todos em `engineVersion: 12`, igual a `ENGINE_VERSION`; `testParams()` é hoje idêntico aos 6 JSON de `app/src/params/` (43 chaves, 0 diferenças, conferido por script).

## Achados

### Alta

**1. O portão `/balance` existe só no papel.**

- Onde: `/home/user/prancheta/docs/03-test-plan.md:95` e `:99` (job `ci` roda `balance --seasons 200 --seed 1`; "`/quick` em `app/src/params/` é justamente o que o balance protege") × `/home/user/prancheta/.github/workflows/ci.yml:20-48` (nenhum passo de balance) × `/home/user/prancheta/package.json` (`test:all` = lint + test + build).
- Impacto: um `/quick` em `app/src/params/` (permitido pelo `CLAUDE.md`) passa o CI com as 36 metas fora. A Q4 do plano (`03-test-plan.md:324`) previa ligar o passo depois da primeira calibragem fechar; ela fechou na T-016 e o passo segue pendente (`docs/status.md:152`, `:384`).
- Recomendação: `devops-engineer` adiciona o passo bloqueante (`--seasons 200 --seed 1`; medir no runner de 2 vCPU: localmente 200 temporadas levaram 200 s, o orçamento do plano é 3 min). Se estourar, `--seasons 100` no PR e 200 na `main`/release.

**2. Os testes do site (`dist.test.ts`) nunca rodam no CI.**

- Onde: `/home/user/prancheta/site/src/lib/dist.test.ts:11-12` (`describe.skip` quando `site/dist` não existe, salvo `REQUIRE_SITE_DIST=1`) × `ci.yml:34-39` (`npm test` roda **antes** de `npm run build`, num checkout limpo).
- Impacto: 14 verificações ficam fora de todo PR: sem `<script>`, sem cookies/storage, sem analytics ou fonte de terceiros, só URLs externas permitidas, `h1`/skip link/`main`/`lang`/canonical, tabelas em região focável, `og:image`, sitemap, "Brasileirão" (BUG-SITE-001), links mortos e "não promover o jogo antes de jogável". Essas são as únicas provas automatizadas das regras de privacidade do site. Localmente passa só porque há um `site/dist` velho — pode até passar contra HTML desatualizado.
- Recomendação: no CI, depois do build, `REQUIRE_SITE_DIST=1 npm test -w app -- site/src/lib/dist.test.ts`; e o mesmo no `test:all`. Pendência já listada em `docs/status.md:384`.

**3. `tests/regression/` está fora do `include` do Vitest.**

- Onde: `/home/user/prancheta/app/vite.config.ts:65` (`include: ['src/**/*.test.ts', '../site/src/**/*.test.ts', '../scripts/**/*.test.ts']`) × `03-test-plan.md:127` (regra 2: todo bug ganha `BUG-NNN` em `tests/regression/`) e `:77` (`tests/regression/no-test-hooks-in-prod.test.ts`).
- Impacto: um teste de regressão posto onde o plano manda jamais rodaria, em silêncio. Hoje a pasta está vazia; os dois bugs já corrigidos (BUG-SITE-001 em `dist.test.ts:118`, BUG-A da T-017 em `app/src/engine/season.test.ts:643`) estão ao lado do código e a tabela "Registro de regressão" (`03-test-plan.md:356-359`) está vazia.
- Recomendação: incluir `../tests/regression/**/*.test.ts` no `include` (ou decidir que a regressão fica ao lado do código e reescrever a regra 2); preencher o registro com os dois bugs.

**4. `content:check` não está no CI nem no `test:all`.**

- Onde: `03-test-plan.md:18`, `:41`, `:95` (CI e `test:all` rodam `content:check`) × `ci.yml` (ausente) × `package.json` (`test:all` sem ele). O script existe e tem 107 checagens (`docs/status.md:65`).
- Impacto: um `/quick` em dados/conteúdo (caminho leve permitido) passa sem a lista bloqueada e sem a validação dos clubes.
- Recomendação: adicionar aos dois lugares; é um passo de segundos.

**5. Nove histórias da 1a sem linha no mapa de cobertura.**

- Onde: `docs/01-requirements.md:85-93` (US-066 a US-069 e US-070 a US-074; US-066 e US-068 são Must) × `03-test-plan.md` §9 (só a US-069 tem linha; `grep` das outras oito = 0).
- Impacto: viola a regra 1 do plano (`:126`). A US-068 (títulos somam ao escudo) já está implementada e testada só de passagem na linha da US-025 (`:269`, "títulos derivados de `pastSeasons`").
- Recomendação: `qa-engineer` acrescenta as linhas (US-066/069 → `clubs.serie-a*.test.ts`; US-068 → `season.test.ts` `careerLeagueTitles`; US-070 a US-074 → planejado T-033).

### Média

**6. Metas do `/balance` duplicadas à mão, sem teste contra o documento.**

- Onde: `/home/user/prancheta/scripts/balance/metrics.ts` (17 faixas `{ min, max }` literais, ex. `:302` `{ min: 0.62, max: 0.68 }`); `scripts/balance/metrics.test.ts` não lê `balance-targets.md`. Compare com `app/src/lib/params.test.ts:85-114`, que lê as tabelas de `docs/design/*.md`.
- Impacto: uma meta mudada pelo CEO em `balance-targets.md` (como a do 17º, 40–46 → 39–45) não falha nada se o código não acompanhar.
- Recomendação: teste que lê a tabela "Metas" (coluna Tolerância) e compara com as faixas de `metrics.ts`, ou um JSON único de metas lido pelos dois.

**7. Metas sem folga e centro do `PROJETO.md` não atingido.**

- Onde: `docs/design/balance-log.md:183-188` (20 pontos: 62,8/62,6/62,4% para piso 62%; zebra 8,3/8,1/8,4% para piso 8%; goleada 12,3/12,4/12,2% para teto 13%; amarelos 4,46 para teto 4,5) × `docs/PROJETO.md:102` e `CLAUDE.md:96` ("cerca de 65%"). O próprio log diz "encostadas na borda" (`:149`).
- Impacto: com erro de amostra de 0,2 a 0,4 p.p., uma mudança alheia à partida (ou o passo do CI do achado 1) pode fazer o portão oscilar; e o documento congelado promete 65%, o motor entrega 63%.
- Recomendação: decisão do CEO (lista abaixo): aceitar 63% como centro (ADR, ajuste em `PROJETO.md`/`CLAUDE.md`) ou recalibrar aceitando zebra de 7%. Em qualquer caso, registrar no plano a regra "faixa com folga ≥ 2 erros padrão".

**8. Testes do motor que conferem o motor contra as próprias constantes.**

- Onde: `/home/user/prancheta/app/src/engine/match/simulate.property.test.ts:2,5,80-81,135-138` (`BENCH_SIZE`, `MAX_SUBS`, `STOPPAGE`, `INJURY_SEVERITIES` importados de `rules.ts`/`lineup.ts` e usados nas asserções); `round.golden.test.ts:6,76,82` (`POINTS`, `RELEGATION_SPOTS`). Em contraste, `properties.test.ts:75-84` define `DOC_MAX_SUBS`, `DOC_BENCH_SIZE`, `DOC_STOPPAGE` a partir de `partida.md` de propósito, mas ainda importa `ABANDONED_SCORE`, `MIN_PLAYERS_ON_PITCH`, `SUSPENSION`, `RATING` (`:5-10`).
- Impacto: uma constante errada (banco de 8, acréscimo de 0 a 5) passa nesses testes.
- Recomendação: um teste "constantes de `rules.ts` = tabela 'Constantes' de `partida.md`", no padrão de `params.test.ts`, e os testes de propriedade passam a usar os números do documento.

**9. Parâmetros de teste do motor são cópia manual, sem trava de igualdade.**

- Onde: `/home/user/prancheta/app/src/engine/testing/params.ts:9-50` (43 valores digitados) × `app/src/params/*.json`; `version.ts` nota 11 afirma "the test parameters follow app/src/params/"; nenhum teste compara os dois (`engine/params.test.ts:19-21` só valida).
- Impacto: hoje iguais (verificado), mas um `/quick` em `match.json` deixa goldens, propriedades e relatórios (`match-metrics`, `fans-metrics`) testando valores que o jogo não usa mais, sem aviso. Se a trava for adicionada, toda calibragem passa a exigir mexer em `engine/testing/` e subir `ENGINE_VERSION` — o que foi o caminho da T-016, mas contradiz o caminho leve para `app/src/params/`.
- Recomendação: decisão para o CEO/`architect` (lista abaixo) e, qualquer que seja, um teste que explicite a regra escolhida.

**10. Acessibilidade do site sem verificação automática além da estrutura.**

- Onde: `dist.test.ts:130-149` (um `h1`, skip link, `main`, `lang`, região focável) e `scripts/tokens-to-css.mjs:46-87` (contraste 4,5:1 dos tokens, que o site importa em `site/src/layouts/Base.astro:12`). Nada confere alvos de toque ≥ 44 px, contraste sobre os vidros/gradientes da direção "Noite de estádio", nem os guardas de `prefers-reduced-motion` (`StadiumHero.astro:77`, `GlassCard.astro:51`, `Button.astro:45`). O §8 do plano só prevê `axe` no E2E do jogo (T-024); o §11 (site) não planeja nada.
- Recomendação: incluir as 9 páginas do site no `a11y.spec.ts` da T-024 (axe + alvos + reduced-motion) e registrar no §11.

**11. Ritual "antes de release" não existe como comando nem como agenda.**

- Onde: `03-test-plan.md:42` (`npm run test:release` a criar) e `:98`; `package.json` não tem `test:release`; nenhum workflow agendado. Ficam só manuais: `PROPERTY_FULL=1` (9 min, rodou uma vez na T-015), `NAMES_FULL_CHECK=1` (1 teste pulado em toda execução), `FANS_METRICS=1`/`MATCH_METRICS=1`, `--seed 1,2,3`, `npm run bench`.
- Recomendação: criar o `test:release` agora (barato) e um job `workflow_dispatch` + `schedule` semanal, não bloqueante, que rode os completos e publique o resumo.

**12. Tempo da suíte: um teste de ferramenta de build é o 2º mais caro.**

- Onde (medido com `--reporter=json`): `properties.test.ts` 38 s (esperado), `/home/user/prancheta/site/src/lib/og.test.ts` 31 s (renderiza as 9 imagens OG duas vezes com `sharp`), `scripts/balance/chain.test.ts` 12 s, `cli.test.ts` 10 s, `match/discipline.test.ts` 11 s. Suíte total 70 s, dentro do orçamento de 3 min, mas o plano (`:101-112`) não registra nenhum valor medido.
- Recomendação: mover `og.test.ts` para um passo de build (ou gate por variável, como `dist.test.ts`); anotar na tabela de orçamentos os tempos medidos (local e CI).

**13. Mapa de cobertura com estados velhos.**

- Onde: `03-test-plan.md:5` ("Nada aqui foi implementado ainda"); `:237` (T-005 `it.fails`, "bug aberto") × `players.property.test.ts:188` (hoje `it(...)` passando, corrigido no #31); `:245` (US-001 "/balance pendente da T-016"); `:271` (US-026 "Pendente: QA da T-014", T-014 mergeada com QA PASS); `:36-38` (`content:check` e `balance` "substituem o `echo`", já existem).
- Recomendação: passada do `tech-writer`/`qa-engineer` no mesmo PR dos achados 3 e 5.

### Baixa

**14. Nome "e2e" em testes Vitest.** `app/src/data/career.acceptance.e2e.test.ts` e `season.ai.e2e.test.ts` são Vitest; o plano reserva "E2E" para Playwright (`tests/e2e/*.spec.ts`). Renomear para `.acceptance.test.ts`.

**15. `golden:update` depende só de `--mode golden`.** `app/package.json` (`vitest run --mode golden src/engine`) e `testing/golden.ts:48-50`. A recusa sem subir `ENGINE_VERSION` funciona (`golden.ts:145-154`), mas nada impede rodar o update no CI por engano; um `if (process.env.CI) throw` no `isGoldenUpdate` fecha isso.

## Decisões para o CEO

1. `/balance` no CI: bloqueante em todo PR com 200 temporadas (aceitando o tempo no runner de 2 vCPU) ou 100 no PR e 200 só na `main`/release.
2. Meta "20 pontos mais forte vence 65%": aceitar o centro medido de 63% (ADR alterando `PROJETO.md` e `CLAUDE.md`) ou recalibrar e aceitar zebra abaixo de 8%.
3. Testes de regressão de bug: pasta `tests/regression/` (incluir no Vitest) ou ao lado do código (reescrever a regra 2 do plano).
4. Parâmetros de teste do motor: goldens seguem `app/src/params/` (toda calibragem sobe `ENGINE_VERSION`; mudança de parâmetro deixa de ser `/quick`) ou ficam congelados como hoje, com a divergência documentada.
5. Ritual de release: criar `test:release` e um job semanal no GitHub Actions (consome minutos do plano gratuito) ou manter só manual antes de cada release.
6. `og.test.ts` (31 s, `sharp`) continua no `npm test` ou vira verificação do build.
