# ADR-0004: Caminho leve também vai por PR

- **Status:** aceita (padrão aplicado; o CEO pode reverter)
- **Data:** 2026-11-03
- **Decisores:** Orquestrador (propôs, a partir da auditoria do dia 1), CEO (a confirmar)

## Contexto

O kit padrão faz o merge local do caminho leve e um push na `main`. Com a proteção de branch do GitHub (PR obrigatório, sem bypass), esse push é recusado; sem a proteção, um agente publicaria em produção pelo Cloudflare Pages, o que contraria "publicar é do CEO". Também não há como apagar branches sem ser o CEO.

## Decisão

`/quick` abre um PR pequeno (conferido pelo Orquestrador, sem os portões completos) e o CEO faz o merge no GitHub. Nenhum merge local, nenhum push na `main`, nenhum agente apaga branch (`ALLOW_QUICK_MERGE=0`, `ALLOW_PUSH_MAIN=0`, `ALLOW_BRANCH_DELETE=0` no hook). O devlog usa `quick/devlog-<data>`.

## Consequências

- **Positivo:** uma única forma de chegar à `main`; prévia do Pages em todo PR; produção só com ação do CEO.
- **Negativo:** o CEO clica em "merge" também nos ajustes pequenos.
- **Para reverter:** `ALLOW_QUICK_MERGE=1`, proteção de branch com bypass para o CEO, e o `/quick` do kit original.
