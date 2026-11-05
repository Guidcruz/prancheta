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

O CEO aceitou todas as recomendações em 2026-11-05 ("recomendados"):

1. Fica a branch da sessão, porque o ambiente exige. Regra escrita: nenhum commit novo enquanto houver PR aberto da branch.
2. Um PR por tarefa. ADR, pesquisa e texto de site vão em PR próprio.
3. O relatório do code review e do QA vai como comentário no PR.
4. Em PR só de motor, o teste do CEO é conferir a tabela de métricas e os riscos; o teste manual fica "N/A, só motor".
5. O CI passa a rodar `/balance`, `dist.test` depois do build e `content:check`, a cargo do `devops-engineer`. Se o `/balance` passar de 3 min no runner, roda 100 temporadas no PR e 200 na `main`.
6. `main` vermelha é prioridade zero e a correção vai num PR `fix(ci)` próprio.
7. Prettier roda automático antes do commit, e o `npm run test:all` passa a ser obrigatório também no caminho leve e no `/devlog`.
8. A meta "20 pontos mais forte vence cerca de 65%" vira a faixa de 62% a 68%, com centro realista em 63% (ADR).
9. Na 1a, os jogadores são só brasileiros, como na US-003; os sul-americanos entram na Etapa 5.
10. A meta da diretoria aparece só como texto informativo na 1a e entra nos critérios da US-025.
11. A vibração segue o `prefers-reduced-motion`.
12. O `architect` emagrece o `lastRound` antes do congelamento do save (T-019).
13. O `index.ts` passa a exportar só o contrato público, com uma regra de lint para quem importa o motor.
14. Ordem: primeiro as correções da auditoria (docs e CI), depois o save (T-018, T-027, T-019), depois a T-048.
