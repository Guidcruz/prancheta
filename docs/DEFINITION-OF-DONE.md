# Definition of Ready e Definition of Done

## Definition of Ready (uma tarefa só entra em desenvolvimento se)

- [ ] Tem história em `docs/01-requirements.md` com critérios de aceite em Gherkin.
- [ ] `docs/02-architecture.md` e/ou um ADR cobrem o desenho; regra de jogo nova tem doc em `docs/design/`.
- [ ] Está na quebra técnica aprovada (seção 7 da arquitetura).
- [ ] Cabe num PR (P ou M; G é dividida ou aprovada; G só com "G aprovado" escrito pelo CEO).
- [ ] Suas dependências estão prontas.
- [ ] O CEO deu o ok para começar.

## Definition of Done (uma tarefa só está pronta se)

- [ ] Código em branch `feat/`, `fix/`, `chore/`, `refactor/`, `docs/` ou `quick/`; nada na `main`.
- [ ] Testes unitários acompanham o código; correção de bug tem teste de regressão falhando-depois-passando.
- [ ] Lint, tipos e formatação passam sem aviso novo.
- [ ] `code-reviewer`: **APROVADO** (zero BLOCKER); tela nova: revisão de interface aprovada. O relatório (veredito, totais e apontamentos) está como comentário no PR.
- [ ] `qa-engineer`: **PASS**, regressão verde. O relatório (veredito, totais e apontamentos) está como comentário no PR.
- [ ] `security-auditor` consultado quando a mudança toca contas, servidor, saves sincronizados, patrocínios, chat, textos para menores ou dependências.
- [ ] Docs, CHANGELOG ("Não lançado") e `docs/status.md` atualizados pelo `tech-writer`.
- [ ] CI verde no PR.
- [ ] PR aberto contra `main` com o template, um PR por tarefa (ADR, pesquisa e texto de site em PR próprio), com o tamanho declarado e o título em inglês no padrão Conventional Commits (vira o assunto do squash).
- [ ] Passos de teste manual no PR; em PR só de motor, o teste do CEO é conferir a tabela de métricas e os riscos, e os passos ficam "N/A, só motor".
- [ ] Nenhum commit novo na branch da sessão depois que o PR foi aberto.
- [ ] CEO testou e fez o merge.

## Release Done

- [ ] Auditoria de segurança e privacidade sem CRITICAL/HIGH (ou risco aceito por escrito pelo CEO).
- [ ] Regressão verde na `main` (`main` vermelha é prioridade zero: PR `fix(ci)` próprio do `devops-engineer`, registrado em `docs/status.md`).
- [ ] CHANGELOG fechado com versão e data; versão em `config/prancheta.config.ts` e nos `package.json`.
- [ ] Post de marco no devlog.
- [ ] Tag feita pelo CEO; smoke test passou; rollback conhecido.
