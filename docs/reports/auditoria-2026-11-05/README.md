# Auditoria geral de 2026-11-05 (depois da T-017)

Feita pelo `project-auditor`, um agente por eixo, sem ter participado do trabalho. Cobre a `main` em `5498ccc`, 36 commits desde a auditoria do Dia 1 (PRs #16 a #31, T-008 a T-017). Os relatórios completos estão nos arquivos desta pasta: `planejamento.md`, `codigo.md`, `qualidade.md` e `processo.md`.

## Resumo por gravidade

| Eixo         | Crítico | Alto | Médio | Baixo |
| ------------ | ------- | ---- | ----- | ----- |
| Planejamento | 0       | 4    | 8     | 3     |
| Código       | 0       | 3    | 9     | 4     |
| Qualidade    | 0       | 5    | 8     | 2     |
| Processo     | 1       | 4    | 6     | 4     |

Nenhum bug de jogo foi encontrado. O motor está verde e coberto. Os achados se concentram em quatro pontos:

- **Processo.** Tudo passa pela mesma branch de sessão, e houve commits depois dos portões. Os PRs juntam várias tarefas. Os vereditos de revisão e QA não ficam registrados fora do texto do PR.
- **CI.** Portões que o plano promete e o CI não roda: o `/balance`, os testes do site (`dist.test`) e o `content:check`. Além disso, `tests/regression/` está fora do Vitest.
- **Docs.** Documentos com estado velho: `decisions.md` parou no ADR-0015, e `02-architecture.md`, `status.md` e `CLAUDE.md` dizem que tarefas já mergeadas estão "em aberto". As US-070 a US-074 não têm tarefa nem teste planejado. A US-025 não cobre prêmios, campanha e meta da diretoria.
- **Código.** O `lastRound` ocupa 95 KB do estado (18%) e pesa no servidor da 1b. O `index.ts` não é a fronteira real do motor. A superfície pública tem cerca de 250 símbolos.

## Decisões do CEO

A lista consolidada, com a recomendação do Orquestrador, está na mensagem de 2026-11-05. O resultado vai registrado abaixo quando o CEO decidir.

_(pendente)_
