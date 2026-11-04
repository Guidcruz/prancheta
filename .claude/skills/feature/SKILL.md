---
name: feature
description: Executa o ciclo completo de uma funcionalidade ou correção na "empresa de agentes" (requisitos → desenvolvimento → code review → QA/regressão → docs → PR), parando nos portões do CEO. Use quando o CEO disser "/feature <descrição ou id da tarefa>" ou pedir para implementar algo.
user-invocable: true
---

Você é o Orquestrador. Demanda do CEO: `$ARGUMENTS` (se vazio, pergunte o que ele quer implementar ou qual tarefa do plano em `docs/02-architecture.md` deve ser feita).

Crie a lista de tarefas e siga o fluxo. Nunca pule um portão.

1. **Preparação**
   - `git status` e `git branch --show-current`. Se houver trabalho não commitado, pergunte ao CEO o que fazer.
   - Atualize `main` (`git fetch` + `git pull` na main, se estiver nela) e crie a branch `feat/<slug>` (ou `fix/<slug>` para bug).
   - Verifique a **Definition of Ready**: existe história com critérios de aceite em `docs/01-requirements.md` e cobertura em `docs/02-architecture.md`/ADRs? Se não existir, chame `product-manager` (e `architect` se tocar estrutura) antes de seguir. Se os requisitos mudarem o escopo aprovado, ⏸ pergunte ao CEO.

2. **Antes de implementar (condicional)** → regra nova no motor: `game-designer` escreve o doc de design e os parâmetros primeiro. Tela nova ou alterada: `ux-designer` entrega a especificação e a casca do componente. ⏸ Pergunte ao CEO antes de começar a tarefa; o pedido ao developer leva "Aprovado pelo CEO".

2b. **Implementação** → chame `developer` com: tarefa, história e critérios de aceite, trecho de arquitetura relevante, branch, e a proibição de tocar em CI/deploy. Tarefas em `app/src/engine/` ou de complexidade G: `model: opus`.

3. **Code review** → chame `code-reviewer` em uma invocação separada, passando só a branch, a base (`main`) e a tarefa, sem o raciocínio do developer. Se a tarefa tocou tela, também o `ux-designer` em invocação separada com o checklist de interface (se ele escreveu a casca, a revisão vai para o `code-reviewer` com o checklist).
   - CHANGES REQUESTED → devolva a lista ao `developer` (volte ao passo 2b). Na segunda reprovação pelo mesmo motivo, escale o developer para `opus`. Na terceira, ⏸ pare e consulte o CEO.

4. **QA + regressão** → chame `qa-engineer` com a branch e os critérios de aceite. Ele escreve testes de aceite e roda a regressão completa.
   - FAIL → relatório de bug volta ao `developer` (passo 2b), depois nova revisão (passo 3) apenas do diff novo.

5. **Segurança (condicional)** → se a mudança tocar autenticação, autorização, dados pessoais, upload, pagamento ou dependências, chame `security-auditor` antes do PR.

6. **Documentação** → chame `tech-writer` para atualizar docs, CHANGELOG (seção Unreleased) e traduções pt-BR. Pode rodar em paralelo com o passo 5.

7. **PR** → confirme que o CI está verde (`gh pr checks` depois de abrir, ou `gh run list`). Abra o PR para `main` usando o template do projeto (`gh pr create` pede confirmação do CEO pelas permissões; se ele preferir, dê o comando pronto). O corpo do PR, em português, deve conter: resumo, critérios de aceite cobertos, veredictos (review, QA com totais da regressão, segurança se aplicável) e passos de teste manual.

8. ⏸ **Portão do CEO** → relatório em português no formato padrão (Feito / Em andamento / Bloqueado / Decisões / Próximo passo), incluindo os **passos de teste manual** sugeridos pelo developer e pelo QA. O merge é do CEO. Não faça merge.
