# ADR-0007: API do motor, determinismo e versão do motor

- **Status:** aceita (CEO, 2026-11-04)
- **Data:** 2026-11-04
- **Decisores:** architect (propôs), CEO (aprova)

## Contexto

O ADR-0001 já decide o motor em TypeScript puro, sem DOM e com `Rng` semeado. Faltava o contrato. Ele precisa servir a quatro clientes: a interface (inclusive comandos no meio da partida, US-021), o `scripts/balance.ts` no Node (200 temporadas em menos de 3 minutos), o servidor da 1b (mesmo resultado que o motor do cliente, US-056) e os golden tests. Também faltava decidir como os textos saem de eventos sem o motor conhecer `content/`, e o que acontece quando o algoritmo muda.

## Opções consideradas

| Opção                                                                                                                                                    | Prós                                                                            | Contras                                                                                         |
| -------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| A: funções puras `(estado, params, entrada) → (estado novo, relatório)`; partida = `simulateMatch(entrada, params, comandos)` reexecutada a cada comando | uma única forma de rodar em todo lugar; trivial de testar; sem estado escondido | cada comando reexecuta a partida (cerca de 0,1 ms, irrelevante)                                 |
| B: motor com objeto de partida mutável, passo a passo (`step()`, `apply()`)                                                                              | natural para a tela ao vivo                                                     | dois caminhos (passo a passo e completo) que podem divergir; difícil de comparar com o servidor |
| C: um `Rng` único da carreira que atravessa tudo                                                                                                         | menos sementes                                                                  | qualquer mudança desloca todos os sorteios seguintes; partidas dependem da ordem                |

## Decisão

**A**, com estas regras (contrato completo em `docs/02-architecture.md`, item 4.1):

1. **Funções puras e resultado tipado.** `newGame`, `prepareRound`, `simulateMatch`, `playRound`, `validateLineup`, `suggestSheet`, `teamStrength`, `getStandings`, `endSeason`, `startNextSeason` e `validateParams`. Não mudam a entrada, não lançam erro por situação de jogo e devolvem `Result<T, E>` com avisos.
2. **Sementes por fluxo.** Cada partida, o calendário, a geração, o desempate e o conteúdo derivam a própria semente com `seedFromString("<semente>-<rótulo>")`. As 10 partidas da rodada são independentes e podem rodar em qualquer ordem.
3. **Comandos como lista.** `MatchCommand[]` com o minuto. Mesma semente e mesmos comandos dão os mesmos eventos, byte a byte. A tela ao vivo reexecuta a partida e `playRound` recebe a mesma lista, então o placar visto é o placar gravado.
4. **Parâmetros por argumento, validados.** `GameParams` vem dos JSON de `app/src/params/`. O motor define o tipo e as faixas válidas (`validateParams`) e nunca importa os JSON.
5. **O motor emite fatos, não texto.** Eventos (`MatchEvent`), marcadores e `Fact` tipados. `app/src/lib/content/` escolhe e preenche os templates com `Rng` semeado. O servidor da 1b não precisa de `content/`.
6. **Roda sem compilação.** Só sintaxe apagável do TypeScript (`erasableSyntaxOnly`) e imports relativos com extensão `.ts` dentro do motor. Assim o mesmo código roda no Vite, no Node 22.18+ (`node scripts/balance.ts`) e no esbuild do Wrangler.
7. **Versão do motor e golden.** `ENGINE_VERSION` (inteiro) em `app/src/engine/version.ts`. Os golden (`engine/__golden__/`: partida, rodada, temporada inteira, virada) gravam a versão que os gerou. Mudar a saída de um golden exige subir `ENGINE_VERSION` no mesmo PR, e o teste confere isso. Saves são snapshots (ADR-0006), então uma versão nova do motor não muda carreiras em andamento: vale da próxima rodada em diante.
8. **Compatibilidade entre cliente e servidor no online.** Só o servidor simula. O cliente mostra os eventos recebidos e nunca recalcula resultado online. O contrato entre os dois é o protocolo HTTP/WebSocket com `X-Prancheta-Protocol`, não a versão do motor. Cliente abaixo do mínimo recebe `426 client_outdated`. Liga em andamento passa a usar o motor novo na próxima rodada depois do deploy (`leagues.engine_version` registra). O teste "servidor × cliente" (US-056) roda o mesmo `playRound` pelos dois caminhos de carga (bundle do app e bundle do servidor) no Node.
9. **Ponto flutuante.** Funções transcendentes (`exp`) só por `engine/math.ts`. O golden da partida também roda no WebKit pelo E2E. Se divergir do V8, troca-se a implementação em `math.ts` por uma própria (e sobe `ENGINE_VERSION`).

## Consequências

- **Positivo:** um só caminho de simulação. Golden simples. Balanceamento no Node sem build. Servidor e cliente com o mesmo código. Textos traduzíveis sem tocar no motor.
- **Negativo:** `playRound` copia o estado a cada rodada (cerca de 500 jogadores, barato). Toda mudança de regra que altera a saída exige o passo explícito de subir a versão e regenerar o golden.
- **Pendências:** T-001 (fundações e lint), T-002 (params), T-009 (golden da partida), T-015 (golden da temporada). `engines.node` passa a `>=22.18`.

## Conformidade

- Lint de `app/src/engine/**`: sem `Math.random`, `Date`, `Intl`, globais do navegador, `node:*` e imports de `ui/`, `lib/`, `content/`, `params/`, `data/` e `@config`.
- Teste: golden com versão divergente de `ENGINE_VERSION` falha. Função pública do motor que lança em situação de jogo é BLOCKER na revisão.
- O `code-reviewer` recusa estado mutável compartilhado ou `Rng` compartilhado entre sistemas.
