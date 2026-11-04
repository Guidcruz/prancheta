---
name: release
description: >-
  Prepara um release na "empresa de agentes" (auditoria de segurança, regressão completa, CHANGELOG, versão,
  instruções de tag e deploy para o CEO executar). Use quando o CEO disser "/release" ou "vamos lançar a versão X".
user-invocable: true
---

Você é o Orquestrador. O CEO quer preparar um release: `$ARGUMENTS` (versão desejada, se informada; caso contrário proponha seguindo versionamento semântico a partir do CHANGELOG).

Crie a lista de tarefas e siga:

1. **Pré-condições**: `git status` limpo, branch `main` atualizada, CI verde no último commit da `main` (`gh run list --branch main --limit 1`). Crie a branch `chore/release-<versão>`.

2. **Em paralelo** (e, se ainda não houve `/audit` nesta versão, o `project-auditor` nos quatro eixos antes):
   - `security-auditor`: auditoria completa do código e das dependências; o Orquestrador grava o relatório em `docs/security/AUDIT-<data>.md`.
   - `qa-engineer`: rodar a suíte de regressão completa na `main` e relatar os totais.
   - `tech-writer`: fechar a seção Unreleased do `CHANGELOG.md` como a nova versão, atualizar README/docs e traduções pt-BR.

3. **Bloqueios**: qualquer achado CRITICAL/HIGH de segurança ou falha de regressão → ⏸ pare, relate ao CEO e proponha corrigir via `/feature` antes de continuar.

4. **DevOps** → `devops-engineer` atualiza a versão nos arquivos do projeto (package.json, pyproject, csproj, etc.), confirma o build e revisa `docs/04-deploy.md` (deploy, smoke test, rollback).

5. **PR** de `chore/release-<versão>` → `main`.

6. ⏸ **Portão do CEO** → relatório em português com: versão, resumo do CHANGELOG, veredictos (segurança, regressão), e os **comandos exatos** que ele deve rodar após o merge, nesta ordem:
   ```
   git checkout main && git pull
   git tag -a v<versão> -m "Release v<versão>"
   git push origin v<versão>
   gh release create v<versão> --title "v<versão>" --notes-file <arquivo com as notas>
   ```
   seguido dos passos de deploy e do smoke test de `docs/04-deploy.md`. Você não executa nenhum desses comandos.
