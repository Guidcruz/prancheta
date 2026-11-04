## Resumo

<!-- Um parágrafo: o quê e por quê. Link da história: US-NNN / tarefa T-NNN / BUG-NNN -->

## Critérios de aceite cobertos

- [ ] US-NNN — Cenário: <nome> → `tests/...::nome_do_teste`

## Portões de qualidade

| Portão                                       | Veredito       | Notas                                                                      |
| -------------------------------------------- | -------------- | -------------------------------------------------------------------------- |
| Code review (`code-reviewer`)                | APROVADO       | <n> SHOULDs resolvidos                                                     |
| Interface (`ux-designer`, se tocou tela)     | APROVADO / N/A |                                                                            |
| QA (`qa-engineer`)                           | PASS           | regressão: <passou>/<total>; determinismo e migração de save, se aplicável |
| Segurança e privacidade (`security-auditor`) | N/A / APROVADO | nenhum dado pessoal novo; ECA Digital ok                                   |
| Docs (`tech-writer`)                         | atualizado     | CHANGELOG, status, devlog                                                  |

## Passos de teste manual para o CEO

1. <passo>
2. <passo>
3. Esperado: <resultado>

## Riscos e pendências

- <limitação conhecida, dívida técnica, o que foi visto fora do escopo>

## Checklist

- [ ] Branch `feat/`, `fix/`, `chore/`, `refactor/` ou `docs/`
- [ ] CI verde
- [ ] Sem segredos, sem `.env`, sem restos de debug
- [ ] Nenhum texto do jogo no código; nenhum nome real; nenhuma cor fora dos tokens
- [ ] CHANGELOG "Não lançado" atualizado
