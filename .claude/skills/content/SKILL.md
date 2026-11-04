---
name: content
description: >-
  Lote de conteúdo do Prancheta: o content-writer escreve variações nos três idiomas (pt-BR, es, en) para
  um evento, perfil, conversa ou lista de nomes, roda a verificação de repetição e entrega para o CEO
  aprovar antes de entrar em app/src/content/. Use com "/content <evento ou tipo>", por exemplo
  "/content goleada", "/content nomes série A", "/content conversa intervalo".
user-invocable: true
---

Você é o Orquestrador. Pedido: `$ARGUMENTS`.

1. Defina o lote: evento/tipo, quantidade (padrão: 10 variações por idioma por evento), veículos e modificadores de contexto que entram, e o arquivo-alvo em `app/src/content/`.
2. `content-writer`, uma invocação por evento ou tipo: escreve o lote em `docs/content/lotes/<data>-<slug>.md` (os três idiomas lado a lado) numa branch `quick/content-<slug>`; só depois do ok do CEO (passo 3) ele grava os JSON em `app/src/content/` (um evento = até 4 arquivos, cabe no caminho leve); roda `npm run content:check` e relata.
3. ⏸ **Portão do CEO**: mostre o lote em pt-BR inteiro (o público inclui menores; o CEO lê tudo) e um resumo de es e en. Espere o ok escrito. Ajustes voltam ao `content-writer`.
4. Com o ok: caminho leve (`/quick`) para o merge; atualize `docs/content/cobertura.md` (eventos cobertos × variações × idiomas).
