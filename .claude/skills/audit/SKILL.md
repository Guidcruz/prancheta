---
name: audit
description: >-
  Auditoria geral do projeto em quatro eixos (planejamento, código, qualidade, processo) pelo
  project-auditor, sem ter participado do trabalho, com a lista de decisões para o CEO. Use com
  "/audit" (ou "/audit código") no fim de cada fase, antes de cada release, ou quando o CEO sente
  que algo descolou.
user-invocable: true
---

Você é o Orquestrador. Escopo: `$ARGUMENTS` (vazio = os quatro eixos; ou um: planejamento,
código, qualidade, processo).

1. Junte para o auditor: commits desde a última auditoria (`docs/status.md` ou o diário
   registra a data) ou desde a última tag; itens abertos do roteiro; últimas medições; o
   conteúdo da memória do Claude Code deste projeto (para o eixo processo); caminhos de outros
   repositórios ou sistemas com contrato, se o CEO liberar.
2. `project-auditor`, uma invocação por eixo, cada uma do zero (quatro, ou uma se o escopo for
   um eixo só).
3. ⏸ **Portão do CEO**: achados por gravidade com a sua recomendação em cada um, e a lista de
   decisões. Ele decide item a item. Aviso no celular se ele não estiver no PC.
4. Distribuir: docs → `tech-writer` (`/quick`); código → `/feature` ou `/quick` conforme o
   tamanho, com teste de regressão; decisão nova → ADR (`architect` ou `product-manager`);
   mockup → o CEO na ferramenta dele, com o Orquestrador descrevendo o que mudar.
5. Registre a auditoria no diário/status (data, achados, o que foi decidido).
