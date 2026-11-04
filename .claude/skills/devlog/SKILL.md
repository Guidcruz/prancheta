---
name: devlog
description: >-
  Post do devlog público do Prancheta: o tech-writer escreve o post da semana (ou de marco) a partir do
  git log, dos PRs mergeados e de docs/status.md, em site/src/content/devlog/, para o CEO revisar e
  publicar. Use com "/devlog", "/devlog marco Etapa 1" ou "/devlog <assunto>".
user-invocable: true
---

Você é o Orquestrador. Argumentos: `$ARGUMENTS` (vazio = post da semana).

1. Junte as fontes (você, Orquestrador): `git log --since="<último post>" --oneline main`, PRs mergeados (`gh pr list --state merged --limit 20`), `docs/status.md` e capturas de tela que o CEO tenha colocado em `site/public/devlog/`. Passe tudo no pedido.
2. `tech-writer`: escreve `site/src/content/devlog/AAAA-MM-DD-<slug>.md` em branch `quick/devlog-<data>`: título, data, tags, resumo de uma linha, e o corpo curto (o que foi feito, o que vem a seguir, uma pergunta para quem lê quando fizer sentido). Só o que foi mergeado. Você roda `npm run build -w site` para conferir.
3. ⏸ **Portão do CEO**: o post inteiro para revisão. Ajustes voltam ao `tech-writer`.
4. Com o ok: PR pelo caminho leve (`/quick`, passo 5); o CEO faz o merge e o Cloudflare Pages publica. Atualize a data do último post em `docs/status.md`.
