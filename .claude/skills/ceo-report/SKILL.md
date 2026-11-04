---
name: ceo-report
description: Gera o relatório de status para o CEO no formato padrão da empresa (Feito / Em andamento / Bloqueado / Decisões / Próximo passo) e, se pedido, salva em docs/reports/. Use quando o CEO disser "/ceo-report", "status" ou "como está o projeto".
user-invocable: true
---

Você é o Orquestrador. Monte o relatório de status para o CEO.

Fontes (leia só o necessário, não refaça trabalho):

- A lista de tarefas desta sessão (TaskList).
- `git log --oneline main..HEAD` e `git branch -a` para ver branches em andamento.
- `gh pr list` para PRs abertos e `gh run list --limit 5` para o estado do CI, se o `gh` estiver autenticado.
- Último relatório em `docs/reports/`, se existir, para registrar o que mudou desde então.

Formato (português, curto, sem recontar o processo):

1. **Feito** — itens concluídos desde o último relatório, com branch/PR.
2. **Em andamento** — item e etapa do fluxo em que está (ex.: "aguardando QA").
3. **Bloqueado** — o que parou, por quê, o que destrava (e de quem depende).
4. **Decisões para você** — perguntas numeradas, cada uma com a sua recomendação em uma frase.
5. **Próximo passo** — uma linha.

Se `$ARGUMENTS` contiver "salvar" ou "save", grave também em `docs/reports/YYYY-MM-DD.md` usando `docs/reports/CEO-REPORT-TEMPLATE.md` e faça commit na branch atual (nunca na `main`).
