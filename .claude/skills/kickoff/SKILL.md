---
name: kickoff
description: Inicia um projeto novo na "empresa de agentes" a partir de uma ideia do CEO. Roda Descoberta, Requisitos, Arquitetura e DevOps com os portões de aprovação do CEO. Use quando o CEO disser "/kickoff <ideia>" ou "vamos começar um projeto novo".
user-invocable: true
---

Você é o Orquestrador. O CEO acabou de descrever uma ideia de projeto: `$ARGUMENTS` (se vazio, pergunte a ideia em uma frase).

**Passo 0 (Prancheta):** o projeto já tem `docs/PROJETO.md` congelado e aprovado, `docs/00-vision.md`, `CLAUDE.md` preenchido, CI e site no ar. Não refaça nada disso. O `/kickoff` aqui serve para abrir a Etapa 1 (1a carreira offline, 1b online mínimo): o `product-manager` escreve `docs/01-requirements.md` a partir do backlog do `PROJETO.md` (seções "Etapas", "Backlog de recursos por etapa", "Regras do jogo", "Jogadores, contratos e mercado"); o `game-designer` escreve `docs/design/balance-targets.md` e os docs de design dos sistemas da 1a; o `architect` escreve `docs/02-architecture.md` e os ADRs que faltam, com a quebra técnica em 1a e 1b; o `ux-designer` lista as telas da 1a; o `qa-engineer` escreve `docs/03-test-plan.md`. Pré-requisitos antes de rodar: repositório no GitHub com a `main` protegida, `gh` autenticado, decisões pendentes de `docs/status.md` resolvidas ou marcadas como adiadas pelo CEO. Pule os passos abaixo que já estão feitos.

Siga estes passos, criando a lista de tarefas antes de começar:

1. **Preparar o repositório**
   - Verifique se é um repositório git (`git status`). Se não for, peça ao CEO para rodar `git init` e criar o repositório no GitHub, ou faça `git init` se ele autorizar.
   - Verifique se o kit está na raiz (`CLAUDE.md`, `.claude/`, `docs/PROCESSO.md`, `docs/papeis.md`, `.github/`). Se não, diga ao CEO para copiar o conteúdo do kit para a raiz do repositório.
   - A política de idioma e o critério do caminho leve já estão decididos no `CLAUDE.md`; não pergunte de novo.
   - Crie a branch `chore/project-setup` para todo o trabalho de planejamento.

2. **Descoberta** → chame `product-manager` com a ideia do CEO pedindo `docs/00-vision.md` e as perguntas abertas.
   ⏸ Apresente ao CEO (em português): resumo da visão, o que está fora do escopo e as perguntas com a sua recomendação. **Espere a aprovação.**

3. **Requisitos** → chame `product-manager` novamente com as respostas do CEO pedindo `docs/01-requirements.md`.

4. **Arquitetura** → chame `architect` com os dois documentos, pedindo: stack, `docs/02-architecture.md`, ADRs, a seção "Stack e comandos" do `CLAUDE.md` do projeto e a quebra técnica ordenada.
   Se houver escolhas que dependem do CEO (hospedagem, custo), pare e pergunte.

5. **DevOps** → chame `devops-engineer` com a stack definida pedindo CI (`.github/workflows/ci.yml`), ambiente local reproduzível e `docs/04-deploy.md` com os passos que o CEO deve fazer no GitHub (proteção de branch, secrets).

6. **Plano de testes** → chame `qa-engineer` pedindo `docs/03-test-plan.md` inicial (ferramentas, o que é unitário/integração/E2E, como a regressão roda).

7. ⏸ **Portão do CEO**: apresente stack, arquitetura resumida, a lista de tarefas técnicas na ordem e o que ele precisa configurar no GitHub. Abra o PR `chore/project-setup` → `main` para ele revisar e fazer merge. **Não comece a implementação até o merge.**

8. Após o merge, pergunte ao CEO se deseja começar pela primeira tarefa do plano com `/feature`.
