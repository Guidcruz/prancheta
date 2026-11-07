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
- **No máximo 3 por lista** (decisão 1 do CEO, aprovada em 2026-11-07). O motor aceita qualquer tamanho; o limite é da tela.
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
7. **Persistência:** recarregar a página mantém as três listas (depende da ficha do técnico no save, do ADR em preparação).

## Marcas do cenário

Nenhuma.

## Pedidos ao motor

O que Escalação, Tática e Funções precisam do motor e do save fica decidido no ADR da ficha do técnico, que o `architect` está escrevendo (aprovado pelo CEO em 2026-11-07, com tarefa própria antes da T-029). O contrato fica lá, não aqui. O que as três telas pedem, em uma linha cada:

1. Guardar a ficha do técnico no save, aceitando vaga livre e jogador inapto (rascunho).
2. Ler o nível de posição (improvisado, fora de posição) do motor, sem repetir a tabela.
3. Ler a força da ficha (Força e os três setores), com vaga livre e inapto valendo 0, na régua da decisão 8; a regra e os critérios de teste estão em [escalacao.md](escalacao.md#força-do-time).
4. Trocar a formação antes do jogo pela posição de cada um (US-018).
5. Completar só o que falta na ficha (vagas livres e inaptos).
6. Sugerir o melhor XI e o banco na formação escolhida pelo técnico (decisão 6).
7. Saber quem está com cada função agora, pela lista ou pela regra automática.
8. Ler todos os problemas da ficha, não só o primeiro.

## Decisões do CEO (T-029)

Aprovadas pelo CEO em 2026-11-07 ("ok recomendado").

1. **Listas de funções com até 3 nomes, só titulares;** quem sai do time sai das listas.
2. **Formação só na Tática.** Na Escalação fica a linha "Formação 4-4-2 · Mudar na Tática"; a Tática não tem uma segunda prévia de campo, só a força e os avisos de quem ficou fora de posição.
3. **Celular deitado: "Jogar rodada" na própria barra de abas** quando a altura é menor que 480px. É um ajuste de tela à parte, na moldura e no `navegacao.md`, **fora da T-029**.
4. **"Jogar rodada" com a escalação que não pode ir abre a folha com "Completar e jogar"** (completa só o que falta e já joga a rodada) e "Ajustar a escalação". Na própria tela, o "Completar automaticamente" do aviso só completa, com "Desfazer".
5. **Listas de funções começam vazias** ("Automático: {nome}"), sem o preenchimento da sugestão do motor.
6. **"Sugerir escalação" mantém a formação e a tática** e troca só os 11 e o banco, com "Desfazer"; as listas ficam, menos quem saiu do time.
7. **Arrastar no toque só depois de segurar 300ms;** deslizar sem segurar rola a página.
8. **Régua da força** na Escalação e na Tática (ajustada e aprovada em 2026-11-07, depois da conferência do `game-designer`): a mesma fonte da Força do Novo jogo (`teamStrength`), com o cansaço: cada vaga vale `overall × fit × (0,80 + 0,20 × condição / 100)`; vaga livre, inapto escalado e gol vazio valem 0; Força = soma ÷ 11; cada setor = soma do setor ÷ vagas do setor × multiplicador da formação. Moral, mando, postura e pressão ficam fora. Aviso de titular cansado (condição abaixo de 85) só no Completo. Detalhes em [escalacao.md](escalacao.md#força-do-time).
9. **Elenco sem selo de titular ou reserva:** a Escalação mostra titulares, banco e não relacionados.
10. **Selos novos** `improvised`, `outOfPosition` e `leader`, registrados em [design-system.md](../design-system.md), "Selos".
