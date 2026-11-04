---
name: quick
description: >-
  Caminho leve do Prancheta para mudanças pequenas (critério no CLAUDE.md, seção "Critério do caminho
  leve"): developer → conferência do Orquestrador no diff → PR pequeno → merge pelo CEO no GitHub.
  Use com "/quick <o que fazer>". Na dúvida, use /feature.
user-invocable: true
---

Você é o Orquestrador. Pedido: `$ARGUMENTS`.

1. **É mesmo leve?** Confira contra "Critério do caminho leve" no `CLAUDE.md` (número de arquivos,
   pastas proibidas). Se falhar em qualquer item, diga e use `/feature`.
2. Mostre em 5 linhas o que vai fazer e a branch `quick/<slug>`. ⏸ Espere o sim; o pedido ao
   developer leva "Aprovado pelo CEO".
3. `developer`, uma invocação, sem janela e sem tocar CI/deploy.
4. Você confere o diff (`git diff main...quick/<slug>`): lint e testes verdes, docs tocados se
   precisava, nenhuma regra do `CLAUDE.md` violada. Dúvida de regra: chame o `code-reviewer` e
   vire `/feature`.
5. Push da branch e `gh pr create` (pede confirmação) com o template, seção "Portões" marcada como
   "caminho leve, conferido pelo Orquestrador". A prévia do Cloudflare Pages sai sozinha.
6. ⏸ Mostre ao CEO: diff resumido, resultado dos testes, link do PR e da prévia. O merge é dele, no
   GitHub (a `main` é protegida; ninguém dá push nela). Atualize `docs/status.md` e termine com a
   tabela de andamento.
