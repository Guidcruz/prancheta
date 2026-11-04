# Status

Atualizado pelo Orquestrador e pelo `tech-writer` a cada merge. Último post do devlog: 2026-11-03 (Dia 1).

## Etapa atual: 0 — Dia 1

| Item                           | Estado     | Observação                                                                           |
| ------------------------------ | ---------- | ------------------------------------------------------------------------------------ |
| Documento de projeto           | feito      | congelado em `docs/PROJETO.md`                                                       |
| Design system                  | feito (v1) | artefato "Prancheta"; tokens em `design/tokens.json`                                 |
| Kit de agentes adaptado        | feito      | 14 agentes, 10 comandos, hook com travas do projeto e 74 casos de teste              |
| Auditoria do dia 1             | feita      | 50 achados; corrigidos os que não dependem de decisão; os outros estão abaixo        |
| Repositório no GitHub          | feito      | `Guidcruz/prancheta`, público, `main` protegida por ruleset (PR, CI `ci`, só squash) |
| Site no Cloudflare Pages       | feito      | `prancheta-ad1.pages.dev`; publica a cada merge na `main`, prévia por PR             |
| Domínio                        | pendente   | decisão do CEO; até lá `*.pages.dev`                                                 |
| Versão zero do jogo em `/jogo` | feito      | tela inicial com escudo, nome e botão                                                |
| Post "Dia 1"                   | feito      | `site/src/content/devlog/2026-11-03-dia-1.md`                                        |
| Nome no INPI                   | pendente   | CEO                                                                                  |
| Licença do código              | pendente   | CEO                                                                                  |

## Decisões pendentes do CEO (da auditoria do dia 1)

> 2026-11-04: no `/kickoff`, o CEO adiou os itens 4 a 8 (não bloqueiam o planejamento da Etapa 1); o item 9 ficou resolvido com o uso do `/kickoff` adaptado.

1. Caminho leve por PR, com a `main` protegida (aplicado como padrão; para voltar ao merge local, mudar o hook e o `/quick`).
2. Apagar branches só pelo CEO (aplicado: `ALLOW_BRANCH_DELETE=0`).
3. Fontes hospedadas no próprio site, sem Google Fonts (aplicado, por privacidade).
4. E-mail de suporte real (hoje vazio; a política de privacidade avisa) e domínio definitivo.
5. Manter nome e cidade do responsável na política de privacidade.
6. Publicar o nome "Prancheta" no site antes da conferência no INPI, ou esperar.
7. Licença do código.
8. Confirmar que o alias de modelo `fable` existe na sua instalação do Claude Code (usado pelo `project-auditor`); senão, trocar por `opus`.
9. ~~Versão adaptada do `/kickoff` (passo 0) antes do primeiro uso.~~ Resolvido em 2026-11-04.

## Próximo

`/kickoff` para o `product-manager` e o `architect` transformarem `docs/PROJETO.md` em `docs/01-requirements.md` e `docs/02-architecture.md` da Etapa 1 (1a carreira offline, 1b online mínimo), com a quebra técnica.
