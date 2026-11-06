# Comentários nos posts do devlog (estudo parado)

> **Situação:** parado pelo CEO em 2026-11-06 ("deixa como está por agora"). Nada decidido, nenhum código. Estes arquivos são rascunhos guardados para o caso de o estudo ser retomado.

## O que foi pedido

Que quem acompanha o projeto possa comentar nos posts do devlog, de forma anônima ou com apelido (ou nome). Hoje o site (`site/`) é estático, sem `<script>`, cookie nem chamada a terceiros.

## Arquivos

| Arquivo                            | Autor            | Conteúdo                                                                   |
| ---------------------------------- | ---------------- | -------------------------------------------------------------------------- |
| [historia.md](historia.md)         | product-manager  | Histórias US-075 a US-083 e decisões D1 a D13                              |
| [adr-rascunho.md](adr-rascunho.md) | architect        | Rascunho do ADR-0020: opções A a D, desenho, riscos, tarefas T-072 a T-083 |
| [seguranca.md](seguranca.md)       | security-auditor | Revisão de segurança e privacidade: 3 achados altos, 18 condições          |

## Resumo

- **Opção recomendada:** C, servidor próprio (Hono + D1) em Pages Functions, com moderação prévia (nada aparece sem o CEO aprovar), funcionando sem JavaScript. Com o paliativo D (T-072) disponível já, enquanto a C não existe.
- **Veredito de segurança:** aprovável com condições. Sem achado crítico. Os 3 achados altos são lacunas jurídicas e de processo (ECA Digital e LGPD) e bloqueiam a ativação ao público, não o aceite do ADR nem o início do código.

### Decisões pendentes do CEO (como no rascunho do ADR)

1. Opção e calendário (D11): C em trilha paralela, começando pela peça de servidor da 1b, com a D já; ou C só depois da 1a, com a D até lá.
2. Exceção à regra "sem texto livre" do `CLAUDE.md`, só para os comentários do devlog, com moderação prévia e sem contato entre usuários.
3. Turnstile (D1): desligado no lançamento e pronto para ligar, ou ligado desde o início.
4. Autenticação da fila de moderação: Access num Worker próprio (recomendado), Access num caminho do `pages.dev`, ou Basic Auth.
5. Canal do aviso (D8): ntfy.sh agora (só a contagem) e e-mail quando houver domínio, ou sem aviso até o domínio.
6. Aceitar que as páginas de post passem por uma Function (cota compartilhada com a liga da 1b).
7. Criar os recursos no painel, a custo zero: D1 de produção e de prévia, Zero Trust e Access, Worker de admin, segredos, environment `production` com aprovação.
8. Aceitar as decisões D2 a D7, D9, D10, D12 e D13 do product-manager como recomendadas (apelido, nomes reais recusados, sem edição, 30 dias na fila, 90 dias de post aberto, sem resposta da equipe, remoção em 48 h, limites, checagem em 8 semanas).
9. Posição sobre a consulta ao advogado (D10). O ADR sugere não bloquear a ativação; a segurança pede o contrário (item abaixo).

### Ações que a segurança pede ao CEO

- **Advogado antes de ativar** (art. 29, §4º e art. 30 do ECA Digital, responsabilidade civil do CEO como pessoa física, exceção do art. 27). Isso muda a decisão 9 acima.
- **E-mail próprio de privacidade e denúncias**, publicado na política, nas regras e perto do botão "Pedir remoção" (pode ser um alias até haver domínio).
- **Conta Cloudflare separada para o site, ou aceitar por escrito o risco** de robôs gastarem a cota compartilhada com a liga da 1b.

## Avisos

- **Numeração provisória.** ADR-0020, US-075 a US-083 e T-072 a T-083 **não estão reservados** e serão renumerados se o estudo for retomado. `docs/01-requirements.md`, `docs/02-architecture.md` e `docs/adr/` não foram alterados.
- **Conferência jurídica incompleta.** O texto oficial da Lei 15.211/2025 (ECA Digital) não foi aberto: o Planalto estava bloqueado na sessão. A conferência foi feita em fontes secundárias; os pontos marcados "conferir no Planalto" em `seguranca.md` continuam abertos.
