# Papéis

Uma conversa e os subagentes de `.claude/agents/`. O CEO fala com o **Orquestrador**, a sessão
principal do Claude Code aberta no repositório. Cada agente tem o papel completo no próprio
arquivo; aqui fica a tabela e o que é comum. Mudou um papel: muda o arquivo do agente e este, no
mesmo PR. O fluxo, os portões e o que é do CEO estão em `docs/PROCESSO.md`.

| Quem                            | Tipo                | Faz                                                                                                                                                | Modelo                                              | Escreve em                                       |
| ------------------------------- | ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------- | ------------------------------------------------ |
| Orquestrador (sessão principal) |                     | pergunta antes de cada item, delega, confere o caminho leve no diff, abre PRs, consolida relatórios, registra decisões aprovadas, avisa no celular | opus                                                | `docs/`, por branch                              |
| `product-manager`               | constrói            | histórias e critérios de aceite a partir de `docs/PROJETO.md`, perguntas ao CEO                                                                    | opus                                                | `docs/`                                          |
| `game-designer`                 | constrói            | regras, fórmulas, parâmetros e balanceamento (`/balance`); não codifica                                                                            | opus                                                | `docs/design/`, `app/src/params/`                |
| `architect`                     | constrói            | motor separado da interface, modelo de dados, save com versão, API e salas online, ADRs                                                            | opus (fable em decisão difícil)                     | `docs/`, esqueleto                               |
| `developer`                     | constrói            | uma tarefa por vez, em branch, com testes                                                                                                          | sonnet na interface; opus no motor ou após 2 falhas | código                                           |
| `ux-designer`                   | constrói e revisa   | telas, fluxos, casca dos componentes Svelte; revisão de interface contra o design system                                                           | opus                                                | `docs/design/telas/`, `app/src/ui/components/`   |
| `art-director`                  | constrói            | geradores de escudos e avatares, fluxos e prompts do ComfyUI para o CEO rodar, inventário e licenças                                               | sonnet                                              | `app/src/lib/generators/`, `docs/art/`           |
| `audio-designer`                | constrói            | banco de narração, eventos sonoros, lotes do ElevenLabs para o CEO aprovar e gerar                                                                 | sonnet                                              | `docs/audio/`, `app/src/lib/audio/manifest.json` |
| `content-writer`                | constrói            | templates de notícias, rede social, conversas, textos de interface e nomes fictícios em pt-BR, es e en (`/content`)                                | sonnet (haiku em lote)                              | `app/src/content/`, `docs/content/`              |
| `code-reviewer`                 | portão 1            | revisa o diff; veto                                                                                                                                | opus                                                | nada                                             |
| `qa-engineer`                   | portão 2            | testes de aceite, regressão inteira, determinismo do motor, migração de saves; worktree próprio                                                    | sonnet (haiku para triar)                           | só pastas de teste                               |
| `security-auditor`              | portão 3            | segurança, dependências e a lista de privacidade (LGPD, ECA Digital); veto de release                                                              | opus                                                | nada                                             |
| `project-auditor`               | auditoria           | auditoria geral em quatro eixos, um por invocação, no fim de cada etapa                                                                            | fable                                               | nada                                             |
| `devops-engineer`               | constrói (reduzido) | CI, build site + jogo, Cloudflare Pages com prévia por PR; Workers, D1 e Durable Objects a partir da Etapa 1b, R2 na Etapa 4; documenta custos     | sonnet                                              | infra, scripts                                   |
| `tech-writer`                   | constrói            | README, docs, CHANGELOG, `docs/status.md` e o devlog (`/devlog`)                                                                                   | sonnet                                              | só documentação e `site/src/content/devlog/`     |

Comandos do projeto além dos padrão: `/balance`, `/content`, `/devlog`, `/assets`.

O que só o CEO faz, além do padrão: rodar o ComfyUI (GPU e janela), autorizar cada lote pago do
ElevenLabs, publicar em produção e criar recursos na Cloudflare, aprovar cada lote de textos e a
lista de clubes, conferir o nome no INPI.

## Regras comuns

- Um subagente começa do zero a cada chamada: o pedido leva tudo (tarefa, branch, critérios,
  regras que toca, proibições, "pode rodar" ou não). A memória do Claude Code não chega aos
  subagentes: regra está no `CLAUDE.md`; estado está em `docs/status.md`.
- Quem revisa ou testa nunca é quem escreveu: invocações separadas, sem o raciocínio do
  developer.
- Nenhum agente decide, publica, faz merge, apaga branch ou histórico; o caminho leve também vai por
  PR. Pedido de trabalho só sai com "Aprovado pelo CEO" (o ok dele para aquela tarefa).
- Decisão aprovada vira ADR no mesmo dia.
- Tela, dispositivo, GPU, produção: do CEO. Nada abre janela sem "pode rodar"; um teste de tela
  por vez; ambiente de teste sempre isolado (o hook cobra).
- Relatório ao CEO: Feito / Em andamento / Bloqueado / Decisões para você (com recomendação) /
  Próximo passo; quem fez cada coisa; o que foi conferido separado do que é recomendação; a
  tabela de andamento no fim.
