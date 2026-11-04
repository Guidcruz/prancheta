# Pedido: <de quem> → <para quem>

> O Orquestrador usa esta estrutura ao delegar. É o que o agente recebe; ele não vê a conversa. Cole no prompt do subagente ou salve em `docs/handoffs/<id>-<de>-<para>.md`.

## Tarefa

- **ID:** T-NNN / US-NNN / BUG-NNN
- **Objetivo (uma frase):**
- **Branch:** `feat/<slug>` (base: `main`)
- **Aprovado pelo CEO:** sim, em <data>

## Ler antes

- `docs/01-requirements.md` → US-NNN
- `docs/02-architecture.md` → seção <n>, ADR-NNNN; `docs/design/<sistema>.md` se for regra de jogo
- Código relevante: `app/src/<caminho>`

## Critérios de aceite

<cole os cenários Gherkin literalmente>

## Restrições

- Não tocar: <arquivos / áreas>
- Seguir: <ADR / convenção>
- Fora do escopo: <itens>

## Rodada anterior (se for retrabalho)

<achados do revisor ou do QA, literalmente, cada um com a correção esperada>

## Saída esperada

<exatamente o que entregar e em que formato, ex.: "código + testes unitários na branch, lint e testes verdes, relatório em português com passos de teste manual">
