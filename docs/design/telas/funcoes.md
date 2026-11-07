# Funções: capitão e cobradores

**Histórias:** US-018 · **Prioridade:** Must · **Tarefa:** T-029 · Folhas abertas da [Tática](tatica.md)

## Objetivo

Dizer quem leva a braçadeira e quem bate pênalti e falta, e quem assume quando o escolhido sai de campo.

## O que o jogador faz

Abre uma das três folhas (Capitão, Pênaltis, Faltas), põe até 3 titulares em ordem, sobe, desce ou tira cada um, e fecha. Cobra (ou leva a braçadeira) o primeiro da lista que estiver em campo; sem ninguém da lista em campo, vale a regra automática do motor (partida.md, "Capitão e cobradores").

## Navegação

- Na Tática, as linhas Capitão, Pênaltis e Faltas abrem cada uma a sua folha (BottomSheet), com entrada própria no histórico: o voltar do celular, o "X", Esc, o fundo e "Pronto" fecham a folha e o foco volta à linha que a abriu.
- Uma folha por vez; a mudança vale na hora (sem "Salvar"); "Pronto" só fecha.

## Conteúdo da folha (RoleEditor)

1. **Título:** "Capitão", "Cobrador de pênalti" ou "Cobrador de falta".
2. **Frase:** "Vale o primeiro da lista que estiver em campo." (Capitão: "Leva a braçadeira o primeiro da lista que estiver em campo.")
3. **Na ordem:** a lista (no máximo 3), cada item com o número da ordem, o código da posição, o nome, o atributo que decide a função e três botões de 44 × 44px: **Subir**, **Descer** e **Tirar**. Subir no primeiro e Descer no último ficam desabilitados (continuam no lugar, para a posição dos botões não mudar).
4. **Regra automática**, logo abaixo da lista, com ícone de informação: o que vale quando ninguém da lista está em campo; com a lista vazia, também "Agora: {nome}", quem a regra escolhe hoje entre os titulares.
5. **Outros titulares:** os titulares que não estão na lista, ordenados pelo atributo da função (o maior primeiro; empate pela ordem das vagas), cada um como uma linha inteira tocável com "+" ("Pôr {nome} na lista"). Com a lista cheia, as linhas ficam desabilitadas e uma frase diz por quê ("A lista tem no máximo 3. Tire alguém para pôr outro."), ligada às linhas por `aria-describedby`.
6. **Pé fixo:** "Pronto" (secundário, largura toda).

| Folha    | Atributo mostrado ao lado do nome                | Regra automática (partida.md)                                            |
| -------- | ------------------------------------------------ | ------------------------------------------------------------------------ |
| Capitão  | idade ("31 anos") e o selo "Líder" (traço líder) | o líder em campo (o de maior nota entre vários); sem líder, o mais velho |
| Pênaltis | Finalização (`attr.finishing`) e o número        | quem tiver mais finalização em campo                                     |
| Faltas   | Técnica (`attr.technique`) e o número            | quem tiver mais técnica em campo                                         |

Na folha do Capitão, o selo "Líder" (StatusBadge `leader`) aparece em todo titular com o traço líder, porque só o capitão líder dobra o efeito bom da conversa do intervalo (`trait.leader.body`). Goleiros aparecem nas três folhas (podem ser capitão; o motor decide se bater pênalti faz sentido pela finalização).

## Regras das listas

- **Só titulares.** Quem sai do campo numa troca da Escalação sai das três listas (a barra da Escalação avisa); quem entra não entra em nenhuma.
- **No máximo 3 por lista** (decisão do CEO 1). O motor aceita qualquer tamanho; o limite é da tela.
- **O mesmo jogador pode estar nas três listas.**
- **Lista vazia** é um estado válido: vale a regra automática, e a linha da Tática mostra "Automático: {nome}".
- A ordem é a do motor (`Lineup.captains`, `penaltyTakers`, `freeKickTakers`): nenhuma regra nova.

## Ao alcance do polegar

A folha sobe de baixo; a lista e os botões ficam na metade de baixo da tela; "Pronto" fica no pé fixo. Subir, Descer e Tirar ficam sempre na mesma coluna, à direita, para a mão direita; com 3 itens, a folha inteira cabe a 390×844 sem rolar.

## Estados

| Estado                         | O que aparece                                                                                                                     |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------- |
| **Lista vazia**                | "Lista vazia: vale a regra automática." no lugar da lista, a regra e "Agora: {nome} ({atributo})".                                |
| **Lista cheia (3)**            | Linhas de "Outros titulares" desabilitadas, com a frase do motivo.                                                                |
| **Escalação incompleta**       | "Outros titulares" lista só os titulares que existem; sem titular nenhum, a frase `roles.noStarters` e nenhuma linha.             |
| **Titular lesionado na lista** | Pode ficar (a lista é só ordem); a linha mostra o selo de lesão. A escalação já está bloqueada pela Escalação até ser consertada. |
| **Completo e Simplificado**    | Iguais (no Simplificado, nunca há selo de lesão ou suspensão).                                                                    |
| **Erro**                       | A folha não abre e a Tática mostra o ErrorState da aba; as listas salvas não mudam.                                               |

## Celular deitado e desktop

- **Deitado (844×390):** a folha ocupa no máximo 85dvh; título e "Pronto" ficam fixos, o corpo rola (BottomSheet com `footer`, T-025).
- **Desktop:** diálogo flutuante ancorado pela base, com 540px de largura (BottomSheet da T-025).

## Movimento

Nenhum: subir e descer só trocam a ordem, sem animação.

## Acessibilidade

- A lista é um `ol` com cabeçalho; cada botão tem nome com o jogador ("Subir Ildo Albuquerque", "Tirar Ildo Albuquerque da lista", "Pôr Lauro Quintela na lista").
- **Foco depois de mexer:** Subir e Descer mantêm o foco no mesmo botão do mesmo jogador, na posição nova (se o botão ficou desabilitado, o foco vai ao outro botão de ordem dele); Tirar leva o foco à linha dele em "Outros titulares"; Pôr na lista leva o foco ao Tirar dele na lista.
- **Anúncio:** cada mudança anuncia a ordem nova numa região viva da folha ("Pênaltis: 1 Ildo Albuquerque, 2 Zuza Ferraz.").
- Botões ≥ 44 × 44px; linhas ≥ 44px; nada depende de arrastar.

## Componentes

BottomSheet, RoleEditor, StatusBadge (`leader`, `injured`), Button. Casca em [componentes.md](componentes.md#casca-da-t-029-escalação-tática-e-funções).

## Textos (chaves)

Rascunho pt-BR para o `content-writer`, em `ui.json`. Usam também `attr.finishing`, `attr.technique`, `player.age.*`, `trait.leader`, `position.*` e `nav.close`.

| Chave                    | Rascunho pt-BR                                                            | Onde                                     |
| ------------------------ | ------------------------------------------------------------------------- | ---------------------------------------- |
| `roles.captain`          | Capitão                                                                   | linha da Tática e título da folha        |
| `roles.penalty`          | Pênaltis                                                                  | linha da Tática                          |
| `roles.freeKick`         | Faltas                                                                    | linha da Tática                          |
| `roles.penalty.title`    | Cobrador de pênalti                                                       | título da folha                          |
| `roles.freeKick.title`   | Cobrador de falta                                                         | título da folha                          |
| `roles.captain.intro`    | Leva a braçadeira o primeiro da lista que estiver em campo.               | frase da folha                           |
| `roles.taker.intro`      | Vale o primeiro da lista que estiver em campo.                            | frase das folhas de cobrador             |
| `roles.list`             | Na ordem                                                                  | cabeçalho                                |
| `roles.others`           | Outros titulares                                                          | cabeçalho                                |
| `roles.empty`            | Lista vazia: vale a regra automática.                                     | lista vazia                              |
| `roles.auto.captain`     | Sem ninguém da lista em campo: o líder em campo; sem líder, o mais velho. | regra                                    |
| `roles.auto.penalty`     | Sem ninguém da lista em campo: quem tiver mais finalização.               | regra                                    |
| `roles.auto.freeKick`    | Sem ninguém da lista em campo: quem tiver mais técnica.                   | regra                                    |
| `roles.now`              | Agora: {name} ({detail})                                                  | com a lista vazia                        |
| `roles.full`             | A lista tem no máximo {max}. Tire alguém para pôr outro.                  | lista cheia                              |
| `roles.noStarters`       | Ainda não há titulares escalados.                                         | sem titulares                            |
| `roles.up`               | Subir {name}                                                              | nome do botão                            |
| `roles.down`             | Descer {name}                                                             | nome do botão                            |
| `roles.remove`           | Tirar {name} da lista                                                     | nome do botão                            |
| `roles.add`              | Pôr {name} na lista                                                       | nome da linha                            |
| `roles.order`            | {role}: {list}.                                                           | região viva; `{list}` = "1 Ildo, 2 Zuza" |
| `roles.order.empty`      | {role}: lista vazia, vale a regra automática.                             | região viva                              |
| `roles.detail.attribute` | {attribute} {value}                                                       | "Finalização 84"                         |
| `roles.done`             | Pronto                                                                    | pé da folha                              |

## Medidas para o E2E

1. **Abrir e voltar:** tocar "Pênaltis" abre a folha "Cobrador de pênalti"; o voltar do navegador fecha, a URL continua `#/squad` e o foco volta à linha "Pênaltis".
2. **Montar a lista:** com a lista vazia, "Pôr {A} na lista" e "Pôr {B} na lista" deixam a lista com A e B, nessa ordem; "Descer A" deixa B, A; "Tirar B" deixa só A. A linha da Tática mostra o nome de A.
3. **Limite:** com 3 na lista, as linhas de "Outros titulares" estão `disabled` e a frase "no máximo 3" está visível.
4. **Alvos:** Subir, Descer, Tirar e as linhas de "Pôr" medem ≥ 44 × 44px a 390×844 e a 844×390.
5. **Troca na Escalação tira da lista:** com A na lista de pênaltis, trocar A por um reserva na Escalação tira A da lista, e a barra diz "saiu da lista de pênaltis".
6. **Capitão e cobradores na partida (US-018):** teste de integração, não E2E: a ficha entregue ao `playRound` leva as três listas na ordem da tela; quando o primeiro sai de campo, o motor usa o próximo (o comportamento já é do motor, T-010; o teste confere só que a tela entrega as listas certas).
7. **Persistência:** recarregar a página mantém as três listas (depende do pedido 1 ao motor).

## Marcas do cenário

Nenhuma.

## Pedidos ao motor

O que Escalação, Tática e Funções precisam e o contrato do motor (`app/src/engine/index.ts`) ainda não tem. Passa pelo `architect`, que decide forma e nome. Só o item 1 mexe no save; os outros são leituras puras, sem `Rng` e sem efeito em golden nem no `ENGINE_VERSION`.

1. **Guardar a ficha do técnico no save.** Hoje o save não tem onde guardar a escalação e a tática que o técnico monta entre as rodadas: `GameState.lastSheets` só tem a ficha jogada, e `CareerData` não tem ficha. Sem isso, recarregar a página perde a escalação (medida 11 da Escalação). A ficha precisa aceitar **rascunho**: vaga livre no campo (o técnico pode deixar o campo incompleto e sair) e lesionados escalados (alguém se lesiona na rodada). Proposta: `CareerData.sheet?: DraftSheet`, com `starters` de 11 posições aceitando vazio, e o `validateLineup` decidindo na hora de jogar. É mudança de formato: ADR, versão nova do save e teste de migração (a migração deixa o campo ausente, e a tela usa a sugestão).
2. **`fitLevel` no contrato** (já existe em `players.ts`, com o tipo `FitLevel`): a marca "Improvisado" / "Fora de posição" e os avisos leem dele, sem repetir a tabela `FIT`.
3. **Força da ficha para a tela.** Uma leitura `sheetStrength(state, clubId, lineup)` → `{ overall, def, mid, atk }` (ou `undefined`), que aceite vaga livre (pela regra de "Vaga vazia"), para as barras mostrarem a queda de uma vaga livre. A régua é decisão do `game-designer` (decisão do CEO 8); a recomendação é a mesma base da Força (`teamStrength`: `overall × fit`, sem condição, moral, mando nem tática) por setor, com o multiplicador da formação, para os números andarem com a formação e baterem com a Força da tela Clube. `sectorStrengths` não serve: está na API de ferramentas, inclui mando e pede 11 aptos.
4. **Troca de formação antes do jogo.** `reshapeLineup(state, clubId, lineup, formation)` → `Lineup`: a regra de "Troca de formação durante o jogo" (partida.md) com a energia igual à condição, aceitando vaga livre; o banco e as listas ficam. A US-018 pede "redistribuídos pela posição de cada um", e a regra do jogo já existe dentro da partida (`changeFormation`, sobre o estado interno).
5. **Completar.** `completeSheet(state, clubId, sheet)` → ficha válida: cada vaga livre ou com inapto recebe o melhor disponível para a vaga (banco primeiro, depois o resto; `bestForSlot`, com os desempates de ia-clubes.md); o banco perde inaptos e repetidos e completa até 7 (`pickBench`); o resto fica como o técnico deixou; as listas perdem quem não é titular. O texto da T-028 ("pode reaproveitar `pickEleven` e `pickBench`") esbarra em que os dois estão fora do contrato.
6. **Sugerir na formação escolhida.** `SuggestOptions.formation?: Formation` no `suggestSheet` (com `controller: 'human'`): o melhor XI e o banco para a formação do técnico, sem trocar a formação (decisão do CEO 6). A tática e as listas da sugestão a tela não usa.
7. **Quem está com cada função agora.** `sheetRoles(state, clubId, lineup)` → para capitão, pênalti e falta, `{ player?: PlayerId, auto: boolean }`: o primeiro da lista entre os titulares ou, sem ninguém, a regra automática no apito inicial (partida.md, "Capitão e cobradores", com os desempates). Serve ao "C" do campo e ao "Automático: {nome}" da Tática, sem a tela repetir a regra.
8. **Todos os problemas da ficha.** `validateLineup` devolve só o primeiro problema; o Banner ("Falta 1 titular e 1 escalado não pode jogar"), os avisos e a folha "Escalação incompleta" precisam de todos. `sheetProblems(state, clubId, sheet)` → lista de `SheetProblem` com o índice da vaga, ou, no mínimo, `isAvailable` no contrato (hoje só `isUnavailable` está na API de ferramentas).

Nada mais falta: o elenco, a situação (lesão, suspensão), a condição, a nota, o traço líder, a idade e os atributos já saem de `GameState`; `FORMATIONS`, `FORMATION_SLOTS`, `POSTURES` e `BENCH_SIZE` já estão no contrato.

## Decisões do CEO (T-029)

Cada uma com a recomendação do `ux-designer`.

1. **Listas de funções com até 3 nomes, só titulares; quem sai do time sai das listas.** Recomendo: sim. Três cobrem uma partida (o primeiro, a substituição dele, a expulsão de mais um); além disso a regra automática já escolhe bem. Alternativa: lista com os 11, mais longa de ordenar.
2. **Formação só na Tática.** Na Escalação fica a linha "Formação 4-4-2 · Mudar na Tática"; a Tática não tem uma segunda prévia de campo, só a força e os avisos de quem ficou fora de posição. Recomendo: sim (uma escolha num lugar só; o campo com os 11 redistribuídos está a um toque).
3. **Celular deitado: "Jogar rodada" na própria barra de abas.** A moldura da T-023 ocupa cerca de 120 dos 390px de altura; com a barra de estado, sobram cerca de 200px. Proposta: com altura abaixo de 480px, o botão deixa de flutuar e vira o último item da barra de abas, à direita (cerca de 60px a mais de conteúdo). Mexe na moldura de todas as telas e no `navegacao.md`, então **não entra na T-029**. Recomendo: aprovar como ajuste de tela separado.
4. **"Jogar rodada" com a escalação que não pode ir: "Completar e jogar".** A folha oferece "Completar e jogar" (completa só o que falta e já joga a rodada) e "Ajustar a escalação". A US-017 diz "oferece Completar automaticamente"; o rótulo novo diz o que acontece depois. Recomendo: sim (o jogador tocou "Jogar rodada" porque queria jogar). Na própria tela, o "Completar automaticamente" do aviso só completa, com "Desfazer".
5. **Listas de funções começam vazias** ("Automático"), em vez de vir preenchidas pela sugestão do motor. O resultado na partida é praticamente o mesmo (a regra automática é a mesma que preencheria a lista), e a tela mostra o critério em vez de três nomes que o técnico não escolheu. Recomendo: sim.
6. **"Sugerir escalação" mantém a formação e a tática** e troca só os 11 e o banco, com "Desfazer". As listas ficam, menos quem saiu do time. Recomendo: sim (respeita a escolha de formação do técnico; precisa do pedido 6 ao motor).
7. **Arrastar no toque só depois de segurar 300ms;** deslizar sem segurar rola a página. Recomendo: sim (o campo ocupa quase a tela e não pode prender a rolagem; o toque em dois passos continua sendo o caminho rápido).
8. **Régua da força por setor** na Escalação e na Tática: a mesma base da Força da tela Clube (`overall × fit`, sem condição, moral, mando nem tática), por setor e com o multiplicador da formação. Assim os números andam com a formação e com quem joga onde, e a postura e a pressão ficam explicadas só pela frase de efeito. Recomendo: sim, com a confirmação do `game-designer`. Alternativa: incluir condição e moral (no Completo, cansar um titular apareceria nas barras, mas os números deixariam de bater com a Força do Clube).
9. **Elenco sem selo de titular ou reserva.** O rascunho da T-028 deixava para a T-029 "o selo e o agrupamento por titulares e reservas" no Elenco; a Escalação já mostra titulares, banco e não relacionados. Recomendo: não pôr no Elenco (a tabela do Elenco continua sendo "o estado de todos"; o selo em 18 das 25 linhas seria ruído).
10. **Selos novos** (regra "Selos" do design system: tipo novo só com par conferido): `improvised` em `on-floodlight` sobre `floodlight`; `outOfPosition` em `ink` sobre `danger-soft`, borda e ícone `danger`; `leader` em `ink` sobre `surface-2`, borda `line`. Os três usam pares que o `npm run tokens` já confere. Recomendo: aprovar e registrar na tabela de "Selos".
