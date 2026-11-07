# Escalação

**Histórias:** US-017 (e o "trocar a formação" da US-018, visto aqui) · **Prioridade:** Must · **Ordem:** 7 · **Tarefa:** T-029

## Objetivo

Montar os 11 titulares e o banco com uma mão, vendo na hora o efeito de cada troca.

## O que o jogador faz

Troca dois lugares (titular, banco ou não relacionado) de três jeitos que dão o mesmo resultado: arrasta um jogador sobre outro; toca num e depois no outro; ou, pelo teclado, Enter num e Enter no outro. Vê a força por setor mudar, lê os avisos (fora de posição, lesionado, vaga livre) e, se quiser, toca "Sugerir escalação". Tudo vale na hora, sem "Salvar".

## Navegação

- Aba **Elenco** (`#/squad`), com o seletor **Elenco | Escalação | Tática** no topo (SegmentedControl, legenda escondida `squad.view.legend`). Ele entra nesta tarefa ([elenco.md](elenco.md), "Navegação").
- Trocar de vista não cria entrada no histórico: o voltar do celular sai da aba como antes. A última vista escolhida fica lembrada enquanto a carreira está aberta (estado da moldura, como a ordem do Elenco; não vai ao save).
- "Ver card" (na barra de estado) abre a folha do jogador da T-028 ([jogador.md](jogador.md)), com entrada própria no histórico. "Anterior" e "Próximo" percorrem os titulares na ordem das vagas, depois o banco, depois os não relacionados.
- "Mudar na Tática", ao lado do nome da formação, troca o seletor para Tática.

## Conteúdo (de cima para baixo, no celular em pé)

1. **Seletor** Elenco | Escalação | Tática.
2. **Aviso de escalação incompleta** (Banner `warning`), só quando a escalação não pode ir para a rodada; ver "Estados".
3. **Força do time** (StrengthBars): Força, Defesa, Meio, Ataque, cada um com número e barra. Depois de uma troca, cada número que mudou mostra a seta e o valor com sinal (`+2`, `−3`), até a próxima troca. Embaixo, "O que conta na Força" abre a explicação. A regra está em "Força do time" e a conta é do motor.
4. **Linha da formação:** "Formação **4-4-2**" e o link "Mudar na Tática" (≥ 44px de altura).
5. **Campo** (LineupPitch): os 11 titulares (ver "Desenho do campo" e "Marca da vaga").
6. **Avisos da escalação** (LineupIssues, título `lineup.issues.title`): uma linha por aviso, com ícone e texto completo: vaga sem jogador, titular lesionado ou suspenso, fora de posição ("Lauro Quintela (ZAG) jogando de ATA"), improvisado e ídolo fora do time. Sem avisos, a seção não aparece.
7. **"Sugerir escalação"** (Button secundário, ícone `suggest`).
8. **Banco** (LineupGroup + LineupRow): título "Banco" com "6 de 7", os cabeçalhos "Nota" e "Cond." e os reservas por posição (GOL a ATA, dentro da posição pela nota). As vagas livres do banco aparecem como linhas tracejadas "Vaga no banco", que também recebem um jogador.
9. **Não relacionados** (LineupGroup + LineupRow): o resto do elenco, na mesma ordem, com os selos da T-028 (lesionado, suspenso, promessa).
10. **Barra de estado** (LineupStatusBar), presa embaixo, acima de "Jogar rodada" (ver "Barra de estado").

Não há botão primário na tela: o primário continua sendo "Jogar rodada".

## Força do time

Decisão 8 do CEO, ajustada em 2026-11-07 depois da conferência do `game-designer`.

- **Mesma fonte da Força do Novo jogo** (`teamStrength`, balance-targets.md, "Força"), agora com o cansaço. Valor de cada vaga: `v(vaga) = selectionValue(jogador, vaga) = overall × fit × (0,80 + 0,20 × condição / 100)` (`engine/selection.ts`). No Simplificado a condição é sempre 100, e o número é o da Força sem desconto.
- **Vaga livre, lesionado ou suspenso escalado e gol vazio valem 0.**
- **Força** = `Σ v / 11`. **Defesa, Meio e Ataque** = soma de `v` das vagas do setor (o setor de cada vaga é o do motor; os laterais da linha de 3 contam no meio) ÷ número de vagas do setor × `FORMATION_MULTIPLIERS[formação].setor`. O goleiro entra só na Força.
- **Fica fora das barras:** moral, mando, postura e pressão. A postura e a pressão se explicam pela frase de efeito na Tática.
- A tela mostra os quatro números arredondados; as setas comparam os números arredondados.
- **Explicação** (disclosure "O que conta na Força", embaixo das barras, fechada por padrão): `lineup.strength.help.full` no Completo e `lineup.strength.help.simplified` no Simplificado.

Critérios para o `developer` (testes unitários da leitura do motor):

1. Com 11 aptos e condição 100, a Força é igual a `teamStrength` e os setores são iguais a `sectorStrengths` com moral 50, postura equilibrada, pressão média e sem mando.
2. Tirar um titular (deixar a vaga livre) nunca aumenta nenhum dos quatro números.
3. Trocar um titular por um inapto dá o mesmo resultado que deixar a vaga livre.
4. É leitura pura: sem `Rng`, sem golden novo e sem mudar o `ENGINE_VERSION`.

## Desenho do campo

- **No DOM, não em canvas.** Grade de 8 colunas por 10 linhas sobre `pitch`, com as marcações em `pitch-line` (decorativas). O gol do time fica embaixo e o ataque em cima.
- **Cada vaga ocupa 2 × 2 células**, na posição da tabela `PITCH_LAYOUT` (`app/src/ui/components/pitch-layout.ts`). Assim uma vaga pode ficar meio passo ao lado ou atrás da vizinha, e nenhuma linha visual tem mais de 4 vagas lado a lado: as linhas de 5 (5-3-2 atrás, 3-5-2 no meio) viram duas meias linhas. Por isso cada vaga tem 1/4 da largura do campo (75px a 360px, 83px a 390px), largura que cabe "Fora de posição" em duas linhas. Regra da tabela, testada em `pitch-layout.test.ts`: duas vagas nunca dividem uma célula, todas cabem na grade e o goleiro fica sozinho embaixo.
- **Ordem das vagas:** a do motor (`FORMATION_SLOTS`: GOL, ZAG, LAT, VOL, MEI, ATA). O primeiro de cada par fica à esquerda de quem olha a tela. O leitor de tela e a tabulação seguem essa ordem (do goleiro ao ataque), que é a ordem de leitura de uma escalação; o desenho é só complemento.
- **Altura:** cada linha da grade tem meio "alvo duplo" (`2 × touch / 2` = 44px), e o campo inteiro tem 440px mais o respiro. No celular em pé, o campo começa na metade de cima e termina abaixo da dobra; a página rola.
- **3-5-2 e 5-3-2** têm as mesmas vagas no motor (só muda o setor dos laterais): no 3-5-2 os laterais ficam na altura do meio; no 5-3-2, meio passo à frente dos zagueiros.

## A vaga (LineupChip)

Um botão por vaga, com:

- **Linha de cima:** o código da posição da vaga (`ZAG`, em `rotulo`), o "C" do capitão quando for o caso (círculo em `ink`, a palavra "capitão" no nome acessível) e a nota geral do jogador à direita (`numero`).
- **Nome:** `Player.name.display` em `caption`, uma linha, cortado com reticências (o nome inteiro está no nome acessível, na barra de estado e no card).
- **Marca da vaga** (no máximo uma; a mais grave vence): lesionado, suspenso, fora de posição, improvisado. Ícone mais texto, no par de cores dos selos (lesionado, suspenso e fora de posição: `ink` sobre `danger-soft` com borda e ícone `danger`; improvisado: `on-floodlight` sobre `floodlight`). Texto na face condensada do `rotulo`, sem caixa alta, até duas linhas ("Fora de / posição"). As outras situações do mesmo jogador vão para o nome acessível e para os avisos.
- **Barra de condição** (só no realismo Completo): traço de `size-bar` em `grass` sobre `surface-2`, com o comprimento da condição. Decorativa: o número está no nome acessível e nas listas.
- **Vaga livre:** borda tracejada, fundo `surface-0`, "Vaga livre" em `ink-muted`.

Níveis de posição (jogadores.md, "Jogador fora da posição"): `fit` 1,00 sem marca; 0,85 a 0,90 "Improvisado"; abaixo de 0,85 "Fora de posição". A tela lê o nível do motor (`fitLevel`; ver "Pedidos ao motor"), nunca a tabela.

## Trocar lugares

Um lugar é uma vaga do campo (11), uma vaga do banco (7) ou um não relacionado. Toda troca é entre dois lugares: os dois jogadores trocam de lugar; se um dos lugares está livre, o jogador só muda de lugar e o de origem fica livre.

### Em dois toques (o caminho de base; também teclado e leitor de tela)

1. Toque num jogador (ou Enter/Espaço com o foco nele): ele fica **selecionado** (borda `floodlight`, marca de "check" no topo, `aria-pressed="true"`), e a barra de estado diz "Ildo Albuquerque selecionado · Toque em outro lugar para trocar", com "Ver card" e "Cancelar".
2. Toque em outro lugar (ou Enter nele): a troca acontece, a seleção some e a barra anuncia o resultado ("Ildo Albuquerque e Reinor Alcântara trocaram de lugar. Ataque 64, caiu 3.").

- Tocar de novo no selecionado, tocar "Cancelar" ou Esc desfaz a seleção, sem troca.
- Enquanto há seleção, cada lugar leva `aria-describedby` para a dica da barra.
- Não existe "pegar com Enter e mover com as setas": o caminho do teclado é o mesmo dos dois toques (muda o rascunho do kickoff, mais simples e igual ao do toque).

### Arrastar e soltar

- **Mouse:** o arrasto começa quando o ponteiro anda 6px com o botão apertado.
- **Toque e caneta:** o arrasto começa depois de **segurar 300ms** sem mexer mais de 8px; antes disso, deslizar rola a página (o campo ocupa quase a tela toda e não pode prender a rolagem). Ao começar, vibração curta onde houver (`navigator.vibrate(10)`, opcional).
- Durante o arrasto: uma cópia do jogador (LineupChip `ghost`, com `shadow-lift`) segue o dedo, **48px acima do ponto de toque** para o dedo não cobrir; o lugar de origem fica tracejado (`origin`); o lugar sob o dedo fica com borda `grass`, fundo `grass-soft` e o ícone de troca (`target`). Perto da borda de cima ou de baixo da janela, a página rola sozinha (o banco fica abaixo do campo no celular).
- Soltar num lugar = a mesma troca dos dois toques. Soltar fora de um lugar, Esc ou um segundo dedo cancela, sem troca.
- O teste de colisão usa `data-slot` (vagas do campo) e `data-place` (`bench-0..6`, `out-0..n`).

### Recusa

Lesionado ou suspenso não entra no campo nem no banco (US-017; `validateLineup` recusa os dois). Se a troca levaria um deles para lá, ela **não acontece**:

- a barra de estado fica no tom `danger` com o motivo: "Neném Carvalhal está lesionado e não pode ser escalado." (`role="status"`, anunciado);
- a linha ou a vaga do atleta mostra o motivo embaixo, com ícone ("Lesionado: não pode ser escalado.") e borda `danger`, até a próxima ação;
- a seleção some; a escalação não muda.

Trocar um lesionado que já está no campo (ficou lesionado depois de escalado) por um apto é permitido: é assim que se conserta a escalação.

### Capitão e cobradores numa troca

As listas de capitão e cobradores são de titulares ([funcoes.md](funcoes.md)). Quem sai do campo sai das listas; quem entra não entra nelas. Se alguém sai de uma lista, a barra acrescenta "Ildo Albuquerque saiu da lista de pênaltis." Lista vazia volta à regra automática.

## Barra de estado

A LineupStatusBar fica no fim da tela, presa ao pé (`position: sticky`), acima de "Jogar rodada" e da barra de abas no celular, e no pé da coluna a partir de 900px. Ela é a região viva (`role="status"`, educada) da tela e está sempre no DOM, também vazia. Mostra uma coisa por vez:

| Situação                                                                               | Texto                                                      | Ações               |
| -------------------------------------------------------------------------------------- | ---------------------------------------------------------- | ------------------- |
| Jogador selecionado                                                                    | "{nome} selecionado" + "Toque em outro lugar para trocar." | Ver card · Cancelar |
| Troca feita                                                                            | "{a} e {b} trocaram de lugar." + mudança da força          | —                   |
| Recusa                                                                                 | "{nome} está lesionado e não pode ser escalado."           | —                   |
| Depois de "Sugerir escalação" (poupando alguém: "Escalação sugerida. Poupou {nomes}.") | "Escalação sugerida."                                      | Desfazer            |
| Depois de "Completar automaticamente"                                                  | "Escalação completada."                                    | Desfazer            |
| Nada                                                                                   | (vazia, sem caixa)                                         | —                   |

- Abaixo de 480px de largura, as ações mostram só o ícone (o rótulo continua como nome acessível); com a tela baixa (celular deitado), a segunda linha some (continua ligada por `aria-describedby`) e a barra fica com uma linha só.
- "Desfazer" volta à escalação de antes da última ação automática (um nível só) e some na próxima troca.
- Mensagens de troca e de recusa ficam até a próxima ação; nenhuma some por tempo.

## Ao alcance do polegar

- A barra de estado, "Jogar rodada" e as abas ficam embaixo; o segundo toque da troca costuma ser no banco, que fica abaixo do campo, na metade de baixo depois de rolar.
- O campo é o alvo grande da tela: cada vaga tem pelo menos 75 × 52px no celular em pé.
- O que se usa pouco fica em cima: a força e a formação.

## Estados

| Estado                               | O que aparece                                                                                                                                                                                                                                                                                             |
| ------------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Carregando**                       | Skeleton `card` × 3 com `lineup.loading`, só depois de 300 ms (como no Elenco: na prática não aparece).                                                                                                                                                                                                   |
| **Primeira vez (rodada 1)**          | A escalação começa como a sugestão do motor para o técnico (`suggestSheet` com `controller: 'human'`): nunca há tela vazia na entrada.                                                                                                                                                                    |
| **Vazio**                            | Só se o jogador tirar todos do campo: as 11 vagas tracejadas "Vaga livre", o Banner "Faltam 11 titulares" com "Completar automaticamente".                                                                                                                                                                |
| **Incompleta (vaga livre)**          | Vaga tracejada no campo; Banner `warning` "Escalação incompleta · Falta 1 titular." com a ação "Completar automaticamente"; aviso "Vaga de ZAG sem jogador"; "Jogar rodada" com a linha de motivo `play.blocked.lineup`.                                                                                  |
| **Lesionado ou suspenso escalado**   | Acontece quando a rodada anterior lesiona ou suspende um titular ou reserva. Marca "Lesionado, 2 rodadas" na vaga (ou selo na linha do banco); aviso "Ícaro Tavernard (MEI) está lesionado, 2 rodadas"; o mesmo Banner e o mesmo bloqueio. Um não relacionado lesionado não bloqueia nada.                |
| **Fora de posição ou improvisado**   | Só informa: marca na vaga e aviso com as duas posições. Não bloqueia a rodada.                                                                                                                                                                                                                            |
| **Titular cansado** (só no Completo) | Aviso informativo `lineup.issue.tired` para cada titular com condição abaixo de 85 (o limiar de `ai.rotationCondition`): "Juca Pimentel está cansado (condição 79): rende menos e se machuca mais." Não bloqueia. No Simplificado não existe (a condição é sempre 100).                                   |
| **Ídolo fora do time**               | Aviso informativo `lineup.issue.idol` (a torcida esfria a partir da 2ª rodada seguida sem ele; torcida.md). Não bloqueia.                                                                                                                                                                                 |
| **Menos de 11 aptos no elenco**      | A escalação vale com todos os aptos (`validateLineup`); as vagas que sobram ficam livres sem bloquear, e um Banner `info` diz "Só {count} jogadores podem jogar: o time entra com {count}."                                                                                                               |
| **Erro**                             | Fronteira da aba (T-023): ErrorState `area`; a escalação salva fica como estava.                                                                                                                                                                                                                          |
| **Realismo Completo**                | Coluna "Cond." nas listas, barra de condição nas vagas, selos e marcas de lesão e suspensão quando houver.                                                                                                                                                                                                |
| **Realismo Simplificado**            | Sem "Cond." nas listas e sem barra de condição nas vagas (todos voltam a 100 entre as rodadas; decisão do CEO na T-028). Nunca há lesionado ou suspenso entre as rodadas, então nunca há recusa nem o estado "lesionado ou suspenso escalado". Fora de posição, improvisado e vaga livre funcionam igual. |
| **Offline**                          | Nada muda.                                                                                                                                                                                                                                                                                                |

### "Jogar rodada" com a escalação que não pode ir

O botão continua tocável, com a linha de motivo "Escalação incompleta" (navegacao.md). Ao tocar, abre a folha **Escalação incompleta** (BottomSheet, com entrada no histórico):

- texto `lineup.check.message`; a lista dos problemas que bloqueiam (LineupIssues sem título visível); a nota `lineup.check.hint`;
- no pé: **"Completar e jogar"** (primário da folha) e "Ajustar a escalação" (secundário, fecha a folha e mostra a vista Escalação).
- "Completar e jogar" preenche só o que falta (vagas livres e inaptos no campo e no banco) com os melhores disponíveis, mantém o resto como o técnico deixou e já joga a rodada (decisão 4 do CEO, aprovada em 2026-11-07). O "Completar automaticamente" do Banner, na própria tela, faz o mesmo preenchimento sem jogar, com "Desfazer" na barra.

## Celular deitado (844×390) e desktop

- **Duas colunas a partir de 720px de largura útil** (consulta de contêiner, o mesmo 720px do padrão "tabela vira cartões"): à esquerda força, formação, campo, avisos e "Sugerir escalação"; à direita Banco e Não relacionados. A barra de estado ocupa a largura toda embaixo. No celular deitado, a página rola na vertical; o campo inteiro tem cerca de 470px, então rola-se para ver o goleiro.
- **Desktop (a partir de 900px):** a mesma divisão, na coluna larga da moldura (`wide`, até `layout-wide-max`). As vagas ficam com cerca de 110px e os nomes cabem inteiros. A barra de estado fica no pé da coluna, com as ações com rótulo.
- **Celular deitado:** a moldura da T-023 (abas + "Jogar rodada" flutuante) ocupa cerca de 120 dos 390px; com a barra de estado, sobram cerca de 200px de conteúdo visível. O CEO aprovou levar "Jogar rodada" para a barra de abas nessa altura (decisão 3), como ajuste de tela à parte, fora da T-029.

## Movimento

- A troca não anima: os dois jogadores aparecem no lugar novo de uma vez (também sem `prefers-reduced-motion`; simples antes de bonito).
- A barra da força muda de largura em 0,2 s; com `prefers-reduced-motion: reduce`, sem transição.
- O arrasto segue o dedo (manipulação direta, não animação). Soltar fora não tem animação de volta. A rolagem automática perto da borda continua com movimento reduzido (é função, não enfeite), em passos.

## Acessibilidade

- **Alvos:** cada vaga ≥ 75 × 52px a 360px; linhas das listas ≥ 44px; ações da barra 44 × 44px; link "Mudar na Tática" ≥ 44px de altura.
- **Nomes acessíveis** (montados pela tela com o conteúdo): vaga "Zagueiro: Quirino Bastos, nota 68, condição 92, capitão, fora de posição"; vaga livre "Zagueiro: vaga livre"; linha "Brenno Sá, Zagueiro, nota 63, condição 100, lesionado, 3 rodadas"; vaga livre do banco "Vaga no banco, livre".
- **Seleção** com `aria-pressed`, marca visível e borda; nunca só cor. Destino do arrasto com ícone de troca.
- **Marcas** com ícone e texto (US-017: "a posição mostra um ícone e o texto"); os avisos repetem tudo em texto corrido.
- **Região viva única:** a barra de estado. A StrengthBars não tem região própria: a mensagem da troca já diz o que mudou.
- **Campo** é um `role="group"` com nome "Campo, formação 4-4-2"; as vagas são uma lista ordenada (`ol`) na ordem das vagas do motor. As marcações do campo são `aria-hidden`.
- **Foco:** depois de uma troca, o foco fica no lugar onde o jogador chegou (o segundo toque); depois de uma recusa, no lugar que recusou; ao fechar o card, volta ao botão "Ver card" ou ao lugar de origem.
- **Contraste:** todo texto da vaga está sobre `surface-1`, `surface-2`, `surface-0`, `grass-soft` (só em `ink`), `danger-soft` ou `floodlight`, pares conferidos pelo `npm run tokens`. No destino do arrasto (`grass-soft`) o código da posição passa a `ink`.
- **Zoom:** a tela não tem campo de texto.

## Componentes

SegmentedControl, Banner, StrengthBars, LineupPitch, LineupChip, LineupIssues, Button, LineupGroup, LineupRow, StatusBadge, LineupStatusBar, BottomSheet, Skeleton, ErrorState. Casca em [componentes.md](componentes.md#casca-da-t-029-escalação-tática-e-funções).

## Textos (chaves)

Rascunho pt-BR para o `content-writer`, em `ui.json`. Usam também `position.*`, `status.*`, `squad.col.overall`, `squad.col.condition` e `nav.close` da T-028.

| Chave                              | Rascunho pt-BR                                                                                                                                                                                               | Onde                                                     |
| ---------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------- |
| `squad.view.legend`                | Mostrar                                                                                                                                                                                                      | legenda escondida do seletor                             |
| `squad.view.squad`                 | Elenco                                                                                                                                                                                                       | opção                                                    |
| `squad.view.lineup`                | Escalação                                                                                                                                                                                                    | opção                                                    |
| `squad.view.tactic`                | Tática                                                                                                                                                                                                       | opção                                                    |
| `lineup.loading`                   | Carregando a escalação...                                                                                                                                                                                    | Skeleton                                                 |
| `lineup.strength.title`            | Força do time                                                                                                                                                                                                | título escondido da StrengthBars                         |
| `lineup.strength.overall`          | Força                                                                                                                                                                                                        | primeiro número                                          |
| `lineup.sector.def`                | Defesa                                                                                                                                                                                                       | setor                                                    |
| `lineup.sector.mid`                | Meio                                                                                                                                                                                                         | setor                                                    |
| `lineup.sector.atk`                | Ataque                                                                                                                                                                                                       | setor                                                    |
| `lineup.strength.up`               | subiu {value}                                                                                                                                                                                                | leitor de tela da seta                                   |
| `lineup.strength.help.label`       | O que conta na Força                                                                                                                                                                                         | disclosure embaixo das barras                            |
| `lineup.strength.help.full`        | Força é a média das notas dos titulares na vaga em que cada um joga, com o desconto do cansaço. Defesa, Meio e Ataque já contam a formação. Moral, mando, postura e pressão contam na partida, mas não aqui. | explicação (Completo)                                    |
| `lineup.strength.help.simplified`  | Força é a média das notas dos titulares na vaga em que cada um joga. Defesa, Meio e Ataque já contam a formação. Moral, mando, postura e pressão contam na partida, mas não aqui.                            | explicação (Simplificado)                                |
| `lineup.strength.down`             | caiu {value}                                                                                                                                                                                                 | leitor de tela da seta                                   |
| `lineup.formation.line`            | Formação {formation}                                                                                                                                                                                         | linha acima do campo                                     |
| `lineup.formation.change`          | Mudar na Tática                                                                                                                                                                                              | link                                                     |
| `lineup.pitch.label`               | Campo, formação {formation}                                                                                                                                                                                  | nome do grupo do campo                                   |
| `lineup.slot.a11y`                 | {position}: {name}, nota {overall}                                                                                                                                                                           | nome da vaga (Simplificado)                              |
| `lineup.slot.a11yCondition`        | {position}: {name}, nota {overall}, condição {condition}                                                                                                                                                     | nome da vaga (Completo)                                  |
| `lineup.slot.empty`                | Vaga livre                                                                                                                                                                                                   | vaga sem jogador                                         |
| `lineup.slot.emptyA11y`            | {position}: vaga livre                                                                                                                                                                                       | nome da vaga livre                                       |
| `lineup.captain.short`             | C                                                                                                                                                                                                            | marca do capitão na vaga                                 |
| `lineup.captain.a11y`              | capitão                                                                                                                                                                                                      | acrescentado ao nome da vaga                             |
| `lineup.fit.improvised`            | Improvisado                                                                                                                                                                                                  | marca da vaga                                            |
| `lineup.fit.outOfPosition`         | Fora de posição                                                                                                                                                                                              | marca da vaga                                            |
| `lineup.issues.title`              | Atenção na escalação                                                                                                                                                                                         | título dos avisos                                        |
| `lineup.issue.empty`               | Vaga de {position} sem jogador                                                                                                                                                                               | aviso                                                    |
| `lineup.issue.injured`             | {name} ({position}) está {status}                                                                                                                                                                            | aviso; `{status}` = `status.injured.*` minúsculo         |
| `lineup.issue.suspended`           | {name} ({position}) está {status}                                                                                                                                                                            | aviso; `{status}` = `status.suspended.*`                 |
| `lineup.issue.outOfPosition`       | {name} ({natural}) jogando de {position}                                                                                                                                                                     | aviso                                                    |
| `lineup.issue.improvised`          | {name} ({natural}) improvisado de {position}                                                                                                                                                                 | aviso                                                    |
| `lineup.issue.tired`               | {name} está cansado (condição {condition}): rende menos e se machuca mais.                                                                                                                                   | aviso informativo (só no Completo)                       |
| `lineup.issue.idol`                | {name} é o ídolo da torcida: fora do time, ela esfria.                                                                                                                                                       | aviso informativo                                        |
| `lineup.issue.short`               | Só {count} jogadores podem jogar: o time entra com {count}.                                                                                                                                                  | Banner `info`                                            |
| `lineup.suggest`                   | Sugerir escalação                                                                                                                                                                                            | botão                                                    |
| `lineup.bench.title`               | Banco                                                                                                                                                                                                        | título                                                   |
| `lineup.bench.count`               | {count} de {max}                                                                                                                                                                                             | ao lado do título                                        |
| `lineup.bench.empty`               | Vaga no banco                                                                                                                                                                                                | linha livre                                              |
| `lineup.bench.emptyA11y`           | Vaga no banco, livre                                                                                                                                                                                         | nome da linha livre                                      |
| `lineup.out.title`                 | Não relacionados                                                                                                                                                                                             | título                                                   |
| `lineup.row.a11y`                  | {name}, {position}, nota {overall}                                                                                                                                                                           | nome da linha (Simplificado)                             |
| `lineup.row.a11yCondition`         | {name}, {position}, nota {overall}, condição {condition}                                                                                                                                                     | nome da linha (Completo)                                 |
| `lineup.select.selected`           | {name} selecionado                                                                                                                                                                                           | barra                                                    |
| `lineup.select.hint`               | Toque em outro lugar para trocar.                                                                                                                                                                            | barra, 2ª linha                                          |
| `lineup.select.card`               | Ver card                                                                                                                                                                                                     | ação da barra                                            |
| `lineup.select.cancel`             | Cancelar                                                                                                                                                                                                     | ação da barra                                            |
| `lineup.swap.done`                 | {a} e {b} trocaram de lugar.                                                                                                                                                                                 | barra                                                    |
| `lineup.move.done`                 | {name} foi para {place}.                                                                                                                                                                                     | barra (lugar livre)                                      |
| `lineup.place.bench`               | o banco                                                                                                                                                                                                      | `{place}`                                                |
| `lineup.place.out`                 | os não relacionados                                                                                                                                                                                          | `{place}`                                                |
| `lineup.strength.changed`          | {sector} {value}, {change}.                                                                                                                                                                                  | acrescentado à mensagem da troca                         |
| `lineup.refuse.injured`            | {name} está lesionado e não pode ser escalado.                                                                                                                                                               | barra (recusa)                                           |
| `lineup.refuse.suspended`          | {name} está suspenso e não pode ser escalado.                                                                                                                                                                | barra (recusa)                                           |
| `lineup.refuse.injured.short`      | Lesionado: não pode ser escalado.                                                                                                                                                                            | embaixo da linha ou da vaga                              |
| `lineup.refuse.suspended.short`    | Suspenso: não pode ser escalado.                                                                                                                                                                             | embaixo da linha ou da vaga                              |
| `lineup.roles.removed`             | {name} saiu da lista de {role}.                                                                                                                                                                              | barra, depois da troca                                   |
| `lineup.suggest.rested`            | Escalação sugerida. Poupou {names}.                                                                                                                                                                          | barra, quando a sugestão tira do time titulares cansados |
| `lineup.suggest.done`              | Escalação sugerida.                                                                                                                                                                                          | barra                                                    |
| `lineup.complete.done`             | Escalação completada.                                                                                                                                                                                        | barra                                                    |
| `lineup.undo`                      | Desfazer                                                                                                                                                                                                     | ação da barra                                            |
| `lineup.undo.done`                 | A escalação anterior voltou.                                                                                                                                                                                 | barra                                                    |
| `lineup.invalid.title`             | Escalação incompleta                                                                                                                                                                                         | Banner                                                   |
| `lineup.invalid.missing.one`       | Falta {count} titular.                                                                                                                                                                                       | Banner                                                   |
| `lineup.invalid.missing.other`     | Faltam {count} titulares.                                                                                                                                                                                    | Banner                                                   |
| `lineup.invalid.unavailable.one`   | {count} escalado não pode jogar.                                                                                                                                                                             | Banner (titular ou reserva)                              |
| `lineup.invalid.unavailable.other` | {count} escalados não podem jogar.                                                                                                                                                                           | Banner                                                   |
| `lineup.complete`                  | Completar automaticamente                                                                                                                                                                                    | ação do Banner                                           |
| `lineup.check.title`               | Escalação incompleta                                                                                                                                                                                         | título da folha                                          |
| `lineup.check.message`             | Antes de jogar, o time precisa de 11 titulares que possam jogar.                                                                                                                                             | folha                                                    |
| `lineup.check.hint`                | Entram os melhores disponíveis nas vagas; o resto fica como você deixou.                                                                                                                                     | folha                                                    |
| `lineup.check.play`                | Completar e jogar                                                                                                                                                                                            | primário da folha                                        |
| `lineup.check.adjust`              | Ajustar a escalação                                                                                                                                                                                          | secundário da folha                                      |

Para o `content-writer`: "Fora de posição" e "Improvisado" precisam caber em 2 linhas de cerca de 60px na face condensada (12px) nos três idiomas; nenhuma palavra pode passar de cerca de 11 letras (es "Fuera de posición", en "Out of position", "Improvisado"/"Improvised" cabem). Os rótulos das ações da barra ("Ver card", "Cancelar", "Desfazer") só aparecem com 480px ou mais e podem ter até cerca de 12 letras.

## Medidas para o E2E

Com `PRANCHETA_ENV=test`, uma carreira de teste com fixture conhecida (4-4-2, um zagueiro forçado na vaga de atacante, um meia na de volante, um não relacionado lesionado e outro suspenso, no realismo Completo; e uma carreira no Simplificado).

1. **Seletor:** em `#/squad`, as três opções têm ≥ 44px de altura; escolher "Escalação" mostra o grupo `Campo, formação 4-4-2` com 11 botões, na ordem GOL, ZAG, ZAG, LAT, LAT, VOL, VOL, MEI, MEI, ATA, ATA (lida pelo código da posição de cada botão).
2. **Alvos:** a 360×740, todas as vagas medem ≥ 44 × 44px e nenhuma se sobrepõe a outra (retângulos sem interseção), em cada uma das 6 formações; o mesmo a 390×844, 844×390 e 1280×800. As linhas do banco e dos não relacionados têm ≥ 44px; as ações da barra, 44 × 44px.
3. **Sem rolagem lateral** da página em 360, 390, 844 (deitado) e 1280.
4. **Dois toques (US-017, "alternativa sem arrastar"):** tocar num reserva (`aria-pressed="true"`, barra com "selecionado") e depois num titular troca os dois: o reserva aparece na vaga, o titular no banco, e pelo menos um número da força muda ou fica igual ao calculado pelo motor para a ficha nova (o teste compara com a leitura do motor, não com um número fixo).
5. **Teclado:** Tab até o reserva, Enter, Tab até a vaga, Enter dá a mesma escalação do item 4. Esc com um selecionado deixa `aria-pressed="false"` e não troca.
6. **Arrastar (US-017, "trocar titular por reserva"):** no Chromium desktop, arrastar com o mouse um reserva até uma vaga dá o mesmo resultado do item 4. No Chromium celular, pressionar um reserva por 400ms e mover até a vaga dá o mesmo resultado; deslizar sem segurar rola a página (o `scrollY` muda e a escalação não).
7. **Fora de posição (US-017):** a vaga com o zagueiro na posição de atacante tem um `svg` e o texto visível "Fora de posição"; a lista de avisos tem "(ZAG) jogando de ATA".
8. **Recusa (US-017):** tentar levar o lesionado para o campo (dois toques) e para o banco: a escalação não muda (mesmos 18 nomes nos mesmos lugares), a barra tem "está lesionado e não pode ser escalado" e a linha do atleta tem o motivo; idem para o suspenso.
9. **Incompleta (US-017):** mover um titular para uma vaga livre do banco deixa "Vaga livre" no campo e o Banner; tocar "Jogar rodada" abre a folha "Escalação incompleta" com "Completar e jogar"; "Completar e jogar" joga a rodada com 11 titulares (o resumo da rodada abre), e a escalação salva tem 11 aptos.
10. **Sugerir e desfazer:** "Sugerir escalação" mantém a formação, a barra mostra "Desfazer"; "Desfazer" volta exatamente à escalação anterior.
11. **Persistência:** recarregar a página depois de uma troca mostra a mesma escalação (depende da ficha do técnico no save, do ADR em preparação).
12. **Simplificado:** sem "Cond." nas listas e nenhuma vaga com barra de condição; nenhum selo de lesão ou suspensão.
13. **Movimento:** com `reducedMotion: 'reduce'`, a barra da força tem `transition-duration` 0s.
14. **Capitão:** a vaga do capitão tem o "C" e o nome acessível contém "capitão".
15. **Força (decisão 8):** na fixture do Completo, um titular com condição abaixo de 85 aparece no aviso "está cansado"; mover um titular para o banco (vaga livre) não aumenta nenhum dos quatro números; "O que conta na Força" abre a explicação (`aria-expanded` muda) e o texto do Simplificado não fala de cansaço.

## Marcas do cenário

Nenhuma.

## Pedidos ao motor

Ver [funcoes.md](funcoes.md#pedidos-ao-motor): o contrato fica no ADR da ficha do técnico, que o `architect` está escrevendo.

## Decisões do CEO

Aprovadas em 2026-11-07; lista única em [funcoes.md](funcoes.md#decisões-do-ceo-t-029). As desta tela: formação só na Tática (2), "Completar e jogar" (4), "Sugerir escalação" mantém formação e tática (6), arrastar no toque depois de 300ms (7), régua da força (8, pendente do `game-designer`) e selos novos (10).
