# Definition of Ready e Definition of Done

## Definition of Ready (uma tarefa só entra em desenvolvimento se)

- [ ] Tem história em `docs/01-requirements.md` com critérios de aceite em Gherkin.
- [ ] `docs/02-architecture.md` e/ou um ADR cobrem o desenho; regra de jogo nova tem doc em `docs/design/`.
- [ ] Está na quebra técnica aprovada (seção 7 da arquitetura).
- [ ] Cabe num PR (P ou M; G é dividida ou aprovada explicitamente).
- [ ] Suas dependências estão prontas.
- [ ] O CEO deu o ok para começar.

## Definition of Done (uma tarefa só está pronta se)

- [ ] Código em branch `feat/`, `fix/`, `chore/`, `refactor/`, `docs/` ou `quick/`; nada na `main`.
- [ ] Testes unitários acompanham o código; correção de bug tem teste de regressão falhando-depois-passando.
- [ ] Lint, tipos e formatação passam sem aviso novo.
- [ ] `code-reviewer`: **APROVADO** (zero BLOCKER); tela nova: revisão de interface aprovada.
- [ ] `qa-engineer`: **PASS**, regressão verde.
- [ ] `security-auditor` consultado quando a mudança toca contas, servidor, saves sincronizados, patrocínios, chat, textos para menores ou dependências.
- [ ] Docs, CHANGELOG ("Não lançado") e `docs/status.md` atualizados pelo `tech-writer`.
- [ ] CI verde no PR.
- [ ] PR aberto contra `main` com o template, incluindo passos de teste manual.
- [ ] CEO testou e fez o merge.

## Release Done

- [ ] Auditoria de segurança e privacidade sem CRITICAL/HIGH (ou risco aceito por escrito pelo CEO).
- [ ] Regressão verde na `main`.
- [ ] CHANGELOG fechado com versão e data; versão em `config/prancheta.config.ts` e nos `package.json`.
- [ ] Post de marco no devlog.
- [ ] Tag feita pelo CEO; smoke test passou; rollback conhecido.
