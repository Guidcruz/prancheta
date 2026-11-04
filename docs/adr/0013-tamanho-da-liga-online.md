# ADR-0013: Tamanho da liga online (20 humanos na 1b; Séries A e B juntas na Etapa 2)

- **Status:** aceita (CEO, 2026-11-04)
- **Data:** 2026-11-04
- **Decisores:** architect (redigiu), CEO (decidiu em 2026-11-04)

## Contexto

O `docs/PROJETO.md` ("Modo online" e "Novo jogo › Liga online") fixa o padrão de "até 8 humanos no ao vivo e até 30 no assíncrono". Na 1b, porém, a liga online é só da Série A, que tem 20 clubes, e cada humano comanda um clube; 30 humanos não cabem e 8 limitaria sem motivo técnico o ao vivo. A Série B só passa a existir no jogo na Etapa 2, e só então uma liga online pode ter 40 clubes. O custo de CPU de `processRound` no plano gratuito dos Workers (10 ms) ainda não foi medido; a bancada da T-059 é o lugar de medir, agora também com 20 partidas por rodada (Séries A e B juntas). A moderação continua simples: ligas só por convite entre amigos (código ou link), sem lista pública, sem chat livre, só mensagens prontas.

O `docs/PROJETO.md` está congelado e não é editado; este ADR é o registro da mudança.

## Opções consideradas

| Opção                                                                                    | Prós                                                                                         | Contras                                                                                     |
| ---------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| A: manter o padrão 8 ao vivo / 30 assíncrono                                             | segue o documento de projeto                                                                 | 30 não cabe numa liga de 20 clubes; 8 no ao vivo é limite arbitrário; US-061 fica confusa   |
| B: até 20 humanos por divisão nos dois modos; Séries A e B juntas na Etapa 2 (escolhida) | um humano por clube, regra única e fácil de explicar; a Etapa 2 ganha o online com 40 clubes | o ao vivo com 20 humanos e o processamento de 20 partidas precisam caber no custo (a medir) |
| C: ligas com mais divisões já na Etapa 2                                                 | adianta a Etapa 6                                                                            | Séries C e D com 20 humanos cada multiplicam CPU, moderação e espera de prontos; sem pedido |

## Decisão

**B.** Na 1b, a liga online é só da Série A, com **no máximo 20 técnicos humanos** (um por clube; os demais ficam com a IA), nos modos **ao vivo e assíncrono**. O padrão "até 8 ao vivo / até 30 assíncrono" do `docs/PROJETO.md` deixa de valer para a 1b. Na **Etapa 2**, quando a Série B entra no jogo, a liga online pode ter **Séries A e B juntas** (40 clubes, acesso e rebaixamento entre elas, pelas mesmas regras da carreira). Ligas com mais divisões e torneios continentais continuam nas Etapas 5 e 6.

## Consequências

- **Limites por modo:** ao vivo e assíncrono, **até 20 humanos por divisão** (um por clube). O máximo de uma liga é `20 × número de divisões` (20 na 1b; 40 na Etapa 2 com A e B). Em `server/src/config.ts` os padrões passam a `maxHumans.live = 20` e `maxHumans.async = 20`, ainda sobrescrevíveis por variável do Cloudflare (US-051), e o servidor aplica sempre `min(config, clubes humanos possíveis)`; a configuração pode baixar o limite, nunca subir acima de um por clube.
- **Servidor e protocolo (ADR-0009):** o ciclo da rodada, os prontos, o processamento idempotente e a transmissão por linha do tempo não mudam. O que muda:
  - a liga guarda, desde a 1b, o formato de competição (`leagues.format`, valor único `'serie-a'` na 1b; `'serie-a-b'` entra na Etapa 2), para a Etapa 2 não exigir mudança de protocolo, só um valor novo e a migração do D1 que for preciso para os dados da Série B;
  - na Etapa 2, `processRound` simula as partidas de todas as divisões da liga numa só passada (até 20 partidas), e cada partida em `roundLive.matches[]` e no `RoundReport` leva a divisão; a virada de temporada aplica acesso e rebaixamento com `startNextSeason`, sem regra própria do online;
  - a sala do Durable Object passa a esperar até 20 humanos prontos (até 40 na Etapa 2) e a manter até esse número de WebSockets no ao vivo, o que cabe com folga num Durable Object com hibernação.
- **T-056:** criar liga oferece de 2 a 20 humanos nos dois modos (limite lido da configuração, nunca acima de 20 na Série A); entrar por código recusa quando todos os clubes humanos possíveis estão ocupados; `leagues.format` gravado como `'serie-a'`.
- **T-059:** a bancada de CPU mede `processRound` em dois casos: 10 partidas (Série A, 1b) e 20 partidas com estado de 40 clubes (Séries A e B, cenário da Etapa 2). O orçamento é 10 ms de CPU do plano gratuito. Se o caso de 20 partidas passar do orçamento, a decisão fica para a Etapa 2 (enxugar o estado, processar uma divisão por invocação ou o plano pago de US$ 5/mês, que exige ok do CEO); a 1b não espera por isso.
- **Moderação:** ligas só por convite entre amigos; com até 20 humanos, a moderação continua sendo a dos apelidos e nomes de liga filtrados e das mensagens prontas (US-062), sem lista pública de ligas.
- **Requisitos (para o `product-manager`):** a nota de US-051 foi atualizada para o padrão de 20 nos dois modos. O cenário "limite de humanos" de US-061 (trocar de assíncrono para ao vivo com mais humanos que o limite do ao vivo) não acontece com os padrões, porque os limites são iguais; continua válido se a configuração baixar o limite do ao vivo. Cabe ao PM decidir se mantém o cenário assim ou o reescreve. As histórias da liga com Séries A e B na Etapa 2 ainda não existem e devem ser escritas pelo PM no planejamento da Etapa 2.
- **Positivo:** regra única e simples ("um humano por clube"); nenhum limite artificial no ao vivo; a Etapa 2 entrega online com acesso e rebaixamento sem mudar o protocolo.
- **Negativo:** com 20 humanos, uma rodada ao vivo pode esperar mais pelos prontos (o prazo resolve); a Etapa 2 dobra o trabalho de `processRound`, ainda não medido.
- **Pendências:** T-056 e T-059 atualizadas em `docs/02-architecture.md`; histórias da liga com Séries A e B na Etapa 2 (PM).

## Conformidade

O limite de humanos vem só de `server/src/config.ts` e é sempre limitado pelo número de clubes da liga; um número fixo de humanos em outro lugar do código é BLOCKER na revisão. O servidor recusa entrada acima do limite mesmo que o cliente ofereça. A bancada da T-059 roda no CI com os dois casos (10 e 20 partidas).
