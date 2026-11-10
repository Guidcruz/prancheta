# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versionamento semântico.

## [Não lançado]

### Adicionado

- Posição secundária no jogador e no save, formato v3 (T-078, ADR-0022):
  - O jogador ainda não vê a mudança, e nenhuma partida muda: o rendimento na secundária (95%) entra na T-079, e a marca na tela na T-080 e na T-081.
  - Motor: `Player.secondaryPosition` (`null` quando não tem; goleiro sempre `null`). Cerca de 1 em 3 jogadores de linha tem uma, sorteada entre as vizinhas da tabela de posições (`FIT` ≥ 0,85), com chances iguais, por `secondaryPositionFor`, no contrato. Cada jogador tem o próprio sorteio, pela semente da carreira e pelo id, então os sorteios do elenco não mudam: nomes, idades, atributos e forças são os mesmos de antes.
  - A geração do novo jogo (antes do ajuste de força do elenco) e a base sorteiam a secundária. Parâmetro novo `players.secondaryChance` = 0,33 (faixa 0 a 0,5). Constante `SECONDARY_FIT` = 0,95, ainda sem uso.
  - `validatePlayer` exige o campo e aceita `null` ou uma posição de linha diferente da natural; o problema novo é `invalid-secondary-position`.
  - Save v3: migração `0002-secondary-position` (v2 → v3), que dá a cada jogador das carreiras salvas a mesma secundária que um jogo novo da mesma semente daria, com a chance congelada em 0,33, sem mexer em mais nada. Fixtures `v3.json` e `shape-v3.json`; as da v1 e da v2 não mudaram.
  - `ENGINE_VERSION` 17: no `new-game.json` só entra o campo novo; nos outros goldens mudam só a versão e os digests.

- Telas de Tática e Funções (T-077; US-018):
  - A vista Tática da aba Elenco substitui o "Esta tela chega numa próxima versão.": formação em cartas com a miniatura do esquema (6 formações), força do time com seta e sinal depois da troca, avisos "Nesta formação", postura (3 opções, sem "Tudo no ataque") e pressão, cada uma com a frase de efeito.
  - Trocar a formação mantém os mesmos 11 titulares, redistribuídos pela posição de cada um (regra do motor); o banco e as listas não mudam, e a região viva resume a troca ("Formação 4-3-3. Ataque 67, subiu 3. 1 jogador fora de posição.").
  - Funções: as linhas Capitão, Pênaltis e Faltas abrem cada uma a sua folha, com entrada própria no histórico. Até 3 titulares por lista, com Subir, Descer e Tirar (44 × 44 px) e "Pôr na lista"; quem sai do time na Escalação sai das listas. Com a lista vazia, a linha mostra "Automático: {nome}", quem a regra do motor escolhe hoje.
  - As listas começam vazias enquanto o técnico não mexeu na ficha (decisão 5 do CEO). Tudo vale na hora, sem "Salvar", e vai para a ficha do técnico no save.
  - Na Escalação, a sigla de cada vaga passa a ser a da posição natural do jogador, com a cor do setor (a mesma do Elenco); a vaga livre fica sem sigla.
  - Nas folhas de Pênaltis e Faltas, os candidatos aparecem ordenados por finalização e por técnica, o valor que o motor usa para escolher o cobrador. Em linhas de menu com valor ("Automático: {nome}"), o valor encolhe com reticências e o rótulo mantém a linha.
- Tela de Escalação (T-029; US-017):
  - A aba Elenco ganha o seletor Elenco | Escalação | Tática. A Tática mostra "Esta tela chega numa próxima versão." até a T-077. Trocar de vista não cria entrada no histórico, e a vista fica lembrada enquanto a carreira está aberta.
  - Escalação: força do time (Força, Defesa, Meio e Ataque arredondados, com seta e sinal depois de cada troca, e "O que conta na Força"), formação com "Mudar na Tática", campo com as 11 vagas, avisos (vaga livre, lesionado, suspenso, fora de posição, improvisado, cansado e ídolo fora do time), "Sugerir escalação", banco e não relacionados.
  - Três jeitos de trocar dois lugares, com o mesmo resultado: dois toques, Enter e Enter no teclado, ou arrastar (mouse depois de 6 px; toque depois de segurar 300 ms, para o deslizar continuar rolando a página). Lesionado e suspenso não entram no campo nem no banco: a troca é recusada com o motivo.
  - "Deixar de fora", a primeira linha dos Não relacionados, tira um titular ou reserva sem pôr ninguém no lugar; um jogador levado a uma vaga livre do campo ocupa a vaga ("foi para a vaga de ZAG"). O banco pode ficar incompleto ou vazio sem bloquear a rodada.
  - Barra de estado embaixo, a única região viva da tela: selecionado (com "Ver card" e "Cancelar"), troca feita com a mudança da força, recusa, e "Desfazer" depois de "Sugerir escalação" e de "Completar automaticamente".
  - Tudo vale na hora, sem "Salvar": cada troca vai para a ficha do técnico no save. Se uma rodada está sendo jogada, a edição espera e é gravada logo depois; se a gravação da ficha falha, o aviso do save aparece com "Tentar de novo".
  - "Jogar rodada" com a escalação que não pode ir continua tocável, com o motivo "Escalação incompleta", e abre a folha com "Completar e jogar" e "Ajustar a escalação". A ficha pronta vai para a rodada como está.
- Cores de pontos fortes e fracos dos atributos e de setor da posição (aprovadas pelo CEO em 2026-11-07):
  - No card do jogador, o atributo 5 pontos ou mais acima da nota geral aparece em verde ("ponto forte") e o 5 ou mais abaixo em vermelho ("ponto fraco"); os do meio e a nota geral ficam sem cor. A leitura para leitor de tela diz "75, ponto forte".
  - A sigla da posição (GOL, ZAG, LAT, VOL, MEI, ATA) ganha a cor do setor (goleiro, defesa, meio, ataque) no fundo e na borda, no Elenco e no cabeçalho do card; o texto continua em tinta e a sigla segue escondida de leitor de tela, que lê a posição por extenso.
  - Textos novos em pt-BR, es e en; testes de tela e E2E nas medidas novas. A escalação (T-029) usa as mesmas cores depois.

- Leituras do motor para a escalação (T-076, ADR-0021):
  - O jogador ainda não vê a mudança: a tela de escalação, que usa essas leituras, vem na T-029.
  - Contrato do motor: `fitLevel`, `isAvailable`, `sheetStrength`, `reshapeLineup`, `completeSheet`, `sheetRoles`, `sheetProblems` e a opção `SuggestOptions.formation`.
  - `sheetStrength` calcula a força da ficha em edição: usa o valor de seleção de cada jogador, vaga vazia ou inapto vale 0, soma dividida por 11, com os setores multiplicados pela formação.
  - A troca de formação passou a ser uma regra só (`reshapeSlots`), usada pela partida e pela escalação.
  - `completeSheet`: a ficha pronta passa igual; a incompleta é completada até 7 no banco, com no máximo um goleiro.
  - Nenhum golden mudou, o `ENGINE_VERSION` continua 16 e o balanceamento de release (1.000 temporadas) saiu idêntico ao da `main`.

- Ficha do técnico no save, formato v2 (T-075, ADR-0021):
  - O jogador ainda não vê a mudança: a tela de escalação, que usa a ficha, vem na T-029.
  - Motor: tipos `DraftLineup` e `DraftSheet` (vaga livre como `null` no campo e no banco) e `draftFromSheet` no contrato. Nenhuma simulação recebe a ficha em edição, os goldens são os mesmos e o `ENGINE_VERSION` continua 16.
  - Save v2: `career.draft` opcional, com o mesmo esquema estrito e a mesma coerência (todo id no elenco do clube do técnico) no `full`, no `open`, no `write` e no `parseDraft`; o esquema `write` passa a ler `game.squads`. Migração `0001-coach-draft` (v1 → v2, tira um `career.draft` que um v1 não poderia ter). Fixtures `v2.json` e `shape-v2.json`; as da v1 não mudaram.
  - Entre as rodadas, `SaveStore.writeDraft` grava `{ seq, sheet }` no registro da carreira (store `careers`, uma transação só dele, com a trava de outra aba); o `seq` é o do snapshot aberto, e por isso a ficha continua valendo depois de uma volta a uma versão anterior. Ao abrir, a ficha do registro só vale com o snapshot daquele `seq` e se passar no `parseDraft`; senão vale a do snapshot (`draftSkipped`). A gravação de snapshot tira a ficha do registro, e o `listCareers` não a devolve. A estrutura do banco continua na versão 1.
  - Carreira: `reconcileDraft` (quem saiu do elenco vira vaga livre e sai das listas; lesionado e suspenso ficam; listas com até 3 titulares) roda antes de toda gravação; `CareerService.setDraft` guarda a ficha na hora e grava só a última das edições que esperam; a ficha enviada para a rodada vira a ficha guardada.
  - Testes: tipos, migração com a fixture v1, esquema nos três níveis, store, carreira (recarregar mantém a ficha), virada da temporada com aposentados e a propriedade do formato com fichas editadas ao acaso. A medição do save passa a incluir a ficha no snapshot e o tempo do `writeDraft`.

- Anel de foco só para o teclado e cores por faixa no Elenco:
  - O anel de foco aparece só para quem usa o teclado e não aparece depois de um toque (no iPhone ele surgia no botão de fechar e no nome do jogador).
  - Condição, moral e forma ganham verde, amarelo ou vermelho por faixa no Elenco e no card do jogador, com o texto da faixa ("74, ruim") para o leitor de tela; a nota geral continua sem cor.

- Tela do clube, elenco e card do jogador (T-028; US-015, US-016, US-026 na parte da tela):
  - Clube: próximo jogo com mando em texto e posição na tabela, linha "Desfalques" só no realismo Completo, termômetro da torcida com número e rótulo de humor, mini classificação e últimos resultados, "Mais opções" no pé abaixo de 900px, duas colunas deitado e no desktop, erro por bloco.
  - Elenco: colunas nome, posição, idade, nota, condição (só no Completo), moral e forma; ordenação por posição, nota e condição, guardada só na tela e nunca no save; selos com ícone e texto (lesionado, suspenso com N jogos, promessa).
  - Card do jogador: folha no celular e diálogo no desktop, com atributos na ordem do motor, traço, jogos e gols; "Anterior" e "Próximo" trocam de jogador sem criar entrada no histórico, o voltar do sistema fecha o card e o foco volta ao jogador de origem; um erro aparece dentro do card.
  - Motor: `isProspect` e `attributeKeysFor` exportados; novos `playerForm`, `FAN_MOODS`, `FanMood` e `fanMood` (5 faixas: Em revolta, Irritada, Desconfiada, Animada, Em festa). Nenhuma simulação muda, os goldens são os mesmos e o `ENGINE_VERSION` continua 16.
  - Design system: 12 componentes novos, 6 tokens novos (tamanhos de barra e medalhão) e regras novas (selos, card em duas colunas, tamanhos).
  - 131 chaves de texto em pt-BR, es e en.
  - Testes: UI, motor e E2E (`club-squad.spec.ts`), com teste de valor sentinela que garante que o potencial nunca aparece na tela.

- Exponencial portável no motor (T-074, ADR-0020):
  - A `exp` de `app/src/engine/math.ts` é o port do `e_exp.c` do fdlibm, só com `+ - * /`, comparações, `Math.trunc`, `Math.E` e uma tabela exata de 2^k; 0 ulp de diferença do `Math.exp` do Node em mais de 33 milhões de entradas, e `exp(1) === Math.E`.
  - `exp-table.json` com 4.096 entradas, incluindo 24 janelas que cruzam as trocas reais do `k`.
  - Golden E2E no navegador (5 goldens de partida e a `exp-table`) sem `fixme`, no Chromium e no WebKit, bloqueante no CI.
  - Teste de fronteira do lint para as funções transcendentais e os acessos a `Math`.

- Tela inicial e novo jogo (T-025; US-034, US-014):
  - Lista de carreiras com a mais recente em destaque e o contador "N de 10"; continuar uma carreira.
  - Apagar em dois passos: o botão do passo seguinte ignora toques por 500 ms depois de a folha abrir; "Cancelar" fica sempre por último e na mesma altura; o destrutivo do passo 2 sobe pelo menos 56 px, com um separador.
  - Novo jogo com clube, apelido (`checkCoachName`, até 24 caracteres), realismo e modo de partida; a última configuração (sem o apelido) fica lembrada.
  - Erros de save com textos neutros, aprovados pelo CEO.
  - Zoom por pinça continua liberado: `touch-action: manipulation` e campos de 16px ou mais.
  - `BottomSheet` com cabeçalho e pé fixos e corpo rolável; com `footer`, o corpo vira região focável; a partir de 900px a folha fica ancorada pela base.
  - Padrão novo no design system, "Confirmação em passos: o passo final" (aprovado pelo CEO em 2026-11-07).
  - E2E: `tests/e2e/delete.spec.ts` (celular em pé, deitado em 844×390 e 932×430, e desktop) e `tests/e2e/careers.spec.ts`.
- Infraestrutura de testes de tela (T-024; US-038, base):
  - Playwright em Chromium e WebKit, no celular (390×844) e no desktop (1280×800). Rodar: `PRANCHETA_ENV=test npm run test:e2e`.
  - Build de teste em `app/dist-e2e`, separado do de produção. Trava de produção: `tests/regression/no-test-hooks-in-prod.test.ts` e a conferência do `dist/` no CI garantem que nenhum gancho de teste vai para o build público.
  - Trava de rede: o teste falha se algo tentar sair para fora da origem.
  - Verificações da moldura: um só "Jogar rodada" por largura, breakpoint em 900px, alvos de toque de pelo menos 44px, sem rolagem horizontal em 360px e respeito a `prefers-reduced-motion`.
  - Job `e2e` no CI, em paralelo ao `ci`.
  - O golden de partida no navegador fica em quarentena até a T-074 (ADR-0020): o `Math.exp` do Chromium difere do Node em cerca de 10% das entradas. O WebKit só roda no CI.

- Casca da interface (T-023; US-015, US-045):
  - Navegação com abas embaixo no celular e barra lateral no desktop, a partir de 900px de largura.
  - `CareerService` (`app/src/lib/career/`): toda gravação do save passa o `guard` com `expectedHeadSeq`, e uma rodada não salva bloqueia o botão "Jogar rodada" até salvar.
  - Avisos e telas cheias para os códigos do save (sem espaço, navegador sem suporte, jogo desatualizado, conflito entre abas, save de versão mais nova, cópias danificadas, falha na conferência), sempre com o código do erro visível para citar ao suporte.
  - Registro local de até 50 erros, sem dados pessoais (versão do app, tela, tipo e pilha), guardado no aparelho.
  - Textos em pt-BR, es e en (73 chaves), aprovados pelo CEO em 2026-11-06.
  - Provisório: a tela inicial e o conteúdo das abas são placeholders (telas reais na T-025 e na T-028), e o apelido é limitado a 24 caracteres até a tela de novo jogo.

- Renovação mínima dos elencos (T-048, US-025 no motor; decisão 14 do `balance-targets.md`, com a regra variável decidida pelo CEO em 2026-11-06):
  - Aposentadoria variável de 33 a 40 anos na virada da temporada: cada jogador sorteia uma chance que cresce com a idade (jogador de linha de 5% aos 33 a 70% aos 39), a do goleiro é mais baixa (de 0 a 30%), e aos 40 todos saem. Sorteio por jogador no fluxo `${seed}-s${season}-retirement-${playerId}`, então o mesmo save aposenta os mesmos.
  - Para cada aposentado entra um jovem de 17 anos da base, na mesma posição, com nome e rosto gerados; o elenco segue com 25 jogadores (3/5/4/4/4/5). Quando o ídolo se aposenta, o clube escolhe um novo ídolo na mesma virada.
  - As despedidas e as chegadas ficam na campanha do clube (`farewells` e `academy`), para a tela de resumo. O aposentado sai do elenco no `endSeason` e de `players` só no `startNextSeason`.
  - `ENGINE_VERSION` 15 e golden `season-turn` regravado. O formato do save não muda (sem migração).
  - `npm run balance -- --chain` ganha as linhas de idade média, candidatos à revelação e aposentadorias por clube. Nas 30 temporadas medidas: idade média de 24,6 a 28,4, cerca de 1,3 aposentadoria por clube por virada, 75 de 75 metas obrigatórias das temporadas 1 a 3 dentro.
  - Nota: a geração inicial ainda se aposenta em ondas de cerca de 19 a 20 temporadas (a variação as amortece pouco); registrado como ponto de checagem para a base da Etapa 4.

- Gravação do save cerca de 2× mais rápida e abertura da carreira cerca de 2× mais rápida (T-072; só a camada de dados em `app/src/lib/save/` e o `measure:save`):
  - O snapshot passa a ser guardado sem compressão no aparelho (UTF-8 com SHA-256, conferido por bytes como antes), aprovado pelo CEO. O custo é espaço: até cerca de 2,2 MB por carreira e cerca de 22 MB com as 10 carreiras, contra 4,6 MB. As súmulas seguem em gzip e o arquivo exportado continua comprimido (compressão feita na hora de exportar).
  - Novo índice `bySeason` no store `snapshots`: a poda da virada de temporada acha a menor temporada mantida sem ler o valor dos snapshots (poda de 3 a 6 ms, contra 13 a 20 ms sem o índice). A estrutura do banco continua na versão 1; quem testou antes disso deve apagar o IndexedDB `prancheta`.
  - Medido no Chromium com CPU 4×, em três execuções: p90 de 78,0 a 88,4 ms após a rodada 38 (antes, 113,6 a 130,9 ms só com o ajuste do codec) e de no máximo 68,1 ms nas três gravações da virada; abrir a carreira com p90 de 136,5 a 153,2 ms, dentro dos 400 ms.
  - `npm run measure:save` mostra o tempo de cada etapa e decide pelo limite de 130 ms no p90 de cada gravação que decide, saindo com código 1 se passar; a meta continua 150 ms.
  - `CareerSave`, `schemaVersion`, a fixture, a API do `SaveStore` e o motor não mudam.

- Formato do save congelado na versão 1 (T-019, US-033 e US-066; é a camada de dados, sem tela):
  - Esquema estrito com `valibot` 1.4.2 e três níveis de conferência (`full`, `open`, `write`), escolhidos pela origem do dado para a gravação não pagar a conferência inteira. Recusa chaves de protótipo e impõe limites de texto e de listas.
  - `isSafeDisplayText` (`app/src/lib/safe-text.ts`) filtra caracteres invisíveis, de direção de texto (bidi) e de controle nos textos mostrados na tela.
  - O formato v1 fica congelado por uma fixture e por um teste de forma, que quebra o CI se o formato mudar sem subir a versão. `npm run save:fixtures -w app` gera as fixtures de uma versão nova e nunca sobrescreve as existentes.
  - Cadeia de migrações (vazia na v1), aplicada na memória. Se a conferência da versão migrada falha, o desfazer devolve as súmulas antigas e o original continua intacto. Save de versão mais nova não é aberto nem alterado.
  - Temporada base por conjunto de clubes (`app/src/data/club-sets.ts`): cada conjunto declara a sua, e o novo jogo usa o mais recente e começa no ano da base.
  - Os textos de clube e de jogador passam a ter no máximo 60 caracteres.
  - O motor não muda de simulação: `ENGINE_VERSION` segue 14.
  - Pendências: a gravação do fim da temporada passava da meta de 150 ms no p90 (resolvido na T-072, acima); a importação de arquivo (T-020) depende da T-073, pela decisão do CEO de que a importação só aceita os clubes do jogo.

- Avatares dos jogadores gerados por código (T-027, US-005; ainda sem tela, ela entra na T-028):
  - `face.ts` tem o catálogo de traços e sorteia o rosto por idade e nacionalidade. O rosto vira um código de 13 caracteres em `Player.face` e nunca é regenerado.
  - `avatar.ts` desenha um SVG seguro (sem script, link nem evento) em 3 tamanhos, igual à folha de exemplo aprovada pelo CEO (`docs/art/avatares-exemplo.svg`).
  - O motor passa a idade do jogador à fonte de identidade, sem sorteio novo: placares e goldens não mudam e `ENGINE_VERSION` segue 14.

- Save da carreira no aparelho (T-018, US-032 e US-034; é a camada de dados, as telas são da T-025 e da T-030):
  - Cada carreira é guardada em IndexedDB com as 3 últimas versões. Cada versão é comprimida (gzip) e leva um SHA-256 para detectar corrupção; a gravação é conferida byte a byte antes de valer.
  - Ao abrir, se a versão mais recente estiver corrompida ou incompleta, o jogo volta para a anterior. Se as 3 estiverem estragadas, devolve um erro tipado e a carreira continua na lista, sem tela em branco.
  - As súmulas das partidas ficam fora do snapshot, em linhas próprias gravadas só da rodada nova, o que mantém a gravação do fim da temporada perto da meta de 150 ms no p90. Medido no Chromium com CPU 4×, em três execuções: p90 de 158,0, 127,9 e 139,0 ms após a rodada 38 (folga curta, de cerca de 4%); abrir a carreira com p90 de 233,5 a 302,2 ms, dentro dos 400 ms.
  - Lista de carreiras independentes, com limite de 10, e proteção contra gravação de outra aba (`expectedHeadSeq`). Os nomes de jogadores sobrevivem a fechar e reabrir o jogo (ADR-0012).
  - `npm run measure:save` (com `PRANCHETA_ENV=test`) mede a gravação e a abertura num Chromium sem janela, com CPU 4×; `PRANCHETA_CHROMIUM=<caminho>` usa um navegador já instalado. É manual e fica fora do CI.
  - O build com `PRANCHETA_ENV=test` vai para `dist-e2e`, para o banco de teste nunca entrar no `dist/` publicado.
  - Ainda não existe: a confirmação dupla ao apagar, o aviso em pt-BR com as rodadas perdidas e os E2E de salvamento (T-025 e T-030). O formato só congela na T-019.

- Campeão pequeno informativo na cadeia do `/balance` (T-071, decisão 17 do CEO): com `--chain`, nas temporadas 2 e 3 o campeão pequeno deixa de ser meta obrigatória, como o grande e o clube fraco no G4 (decisão 15); a trava de deriva continua obrigatória. Sem `--chain`, nada muda. A cadeia de 3 temporadas passa de 92 de 93 metas para 91 de 91.
- Todos podem ser campeões (T-070, decisão 16 do CEO, US-013): a escada de forças sobe o fundo (Inter-Regional 64 → 65, Remador 63 → 64, Chapecão 62 → 64; soma 1.404) e `clubStrengthSd` segue em 1,5. O `/balance` ganha duas metas de release: todo clube campeão em 1.000 temporadas (semente 1) e G4 do técnico-robô no clube mais fraco de pelo menos 2%, com a opção `--robot weakest` (`npm run balance -- --seasons 1000 --seed 1 --robot weakest`). Medido: 200 temporadas, semente 1, 39 de 39 metas e campeão grande em 86,0%; em 1.000 temporadas os 20 clubes têm título e o robô no Chapecão chega ao G4 em 3,0%. Teto do campeão pequeno 4% e do grande 90%. Nenhum golden do motor mudou.
- Só brasileiros na geração (T-069, decisão 9 da auditoria, US-003): na Etapa 1a todo jogador gerado é brasileiro; os sul-americanos ficam para a Etapa 5. Mudam só nacionalidade, nome e rosto de parte dos jogadores (o jogo de referência tinha 2 estrangeiros e 34 jogadores ganharam nome e rosto novos); placares, tabelas e forças não mudam, e o balanceamento de 200 temporadas sai idêntico (39 de 39 metas). Saves antigos com jogadores argentinos ou uruguaios continuam válidos. `ENGINE_VERSION` 14.

- Fim de temporada e virada para a seguinte (T-017, US-025; é o motor, as telas são da T-037):
  - Prêmios da temporada: artilheiro, garçom, melhor jogador, revelação, melhor goleiro e seleção do campeonato. Quem não chega a 19 jogos não concorre, e o prêmio fica "sem vencedor" se ninguém chega. Saem também o campeão, a zona de rebaixamento (sem efeito por enquanto) e a campanha do clube do técnico.
  - Evolução dos jogadores: no fim do ano todos fazem aniversário e mudam de nível conforme a idade. Jovens tendem a crescer e veteranos a cair. A idade vai até 99 anos, para uma carreira longa nunca invalidar o save.
  - Os títulos ganhos na carreira somam aos que o clube já tinha no escudo (as estrelas). O resumo de cada temporada guarda só números e identificadores, nunca nomes.
  - A força de cada clube é recalculada com o elenco já evoluído: quem formou bons jovens sobe, quem envelheceu desce.
  - Temporada nova com os mesmos 20 clubes: calendário novo, tabela, estatísticas e cartões zerados, todos aptos e descansados e a torcida de volta ao começo.
  - A moral leva metade do humor para o ano seguinte: ela anda até a metade do caminho de volta ao 60 (decisão 13 do CEO).
  - Lesões e suspensões terminam na virada: ninguém começa o ano seguinte machucado ou suspenso (decisão 13 do CEO).
  - `npm run balance -- --chain N`: carreiras de N temporadas encadeadas, com as metas por temporada e a força da liga a cada virada. As temporadas 1 a 3 contam e as seguintes são só informativas. Há uma trava de deriva que confere se a virada não deixa os grandes cada vez mais fortes ou fracos que os demais (decisão 15 do CEO). Sem `--chain`, a saída é a mesma de antes.

- Garantia de qualidade do motor (T-015), sem mudança para quem joga:
  - Testes automáticos conferem as regras do jogo em 1.000 partidas e 30 temporadas.
  - Antes de cada lançamento roda a versão completa, com 10.000 partidas e 1.000 temporadas.
  - Jogo de referência novo: uma temporada com técnico humano no realismo simplificado.

- Ajustes da ferramenta de balanceamento (T-016, revisão da parte 1 e pedidos do `game-designer`):
  - Fator do pendurado como parâmetro: `match.cards.bookedMult` (faixa de 0 a 1), ainda em 0,5. Nenhum resultado muda e os goldens ficam iguais; o valor novo entra com os outros parâmetros da T-016, quando o CEO decidir.
  - Códigos de saída do `npm run balance`: 0 com tudo dentro, 1 com alguma meta obrigatória fora, 2 erro de uso e 3 falha da própria ferramenta (antes, uma falha saía com 1, como se fosse meta fora).
  - `--seed 1,2,3`: roda as três sementes, mostra cada uma e julga as metas raras (campeão pequeno, clube fraco no G4 e fuga do Z4 de 6 a 8 pontos) na soma das 600 temporadas; as outras metas continuam semente a semente. Com uma semente, nada muda.
  - Novas linhas informativas, que não contam no código de saída: pontos por jogo de cada tática contra a referência (4-4-2 equilibrada contra ela mesma, faixa de ±0,04), "campeão entre os 6 mais fortes" e "algum dos 6 mais fortes rebaixado", e as metas de etapas futuras, como "n/a".
  - Aviso no resumo quando uma meta obrigatória fica sem medida (`--robot none`, `--duels 0`), e no stderr quando o arquivo do `--params` tem uma chave `__proto__` (ignorada).
  - As tarefas longas (temporadas do técnico-robô e "tudo no ataque") são distribuídas primeiro entre as threads; a saída não muda.

- Ferramenta de balanceamento e regra "tirar o pé" (T-016, parte 1; US-013):
  - `npm run balance` (`scripts/balance.ts`): simula temporadas completas da Série A só com o motor, os duelos calibrados (0, 10, 20 e 30 pontos de diferença), os duelos táticos (cada formação, postura e pressão contra a 4-4-2 equilibrada) e o "tudo no ataque" a partir de 0×1 aos 75'. Para cada meta da Etapa 1a de `balance-targets.md`, mostra o valor medido, a meta e "dentro" ou "fora".
  - Opções `--seasons`, `--seed`, `--duels`, `--params <arquivo>` (sobrescreve parâmetros sem mexer em `app/src/params/`), `--robot <clube>`, `--json` e `--workers`. A mesma semente dá a mesma saída, com qualquer número de threads; o tempo sai à parte.
  - Código de saída 1 quando alguma meta obrigatória fica fora, para o CI usar depois.
  - Técnico-robô bom (decisão 10): escala pelo rendimento, faz rodízio nas semanas com dois jogos, escolhe a tática contra o adversário, conversa no intervalo pelo placar e faz as decisões da torcida até o teto. Joga no lugar da IA no mesmo clube e nas mesmas sementes; no Coritibom ganha cerca de 4 pontos por temporada.
  - Regra "tirar o pé" no motor: quem ganha por 2 gols ou mais cria menos (`match.comfortableLeadGoals` e `match.comfortableLeadPower`). Entra neutra (fator 1): nenhum resultado muda e os goldens ficam iguais; o valor é do `game-designer`, na parte 2.

- Moral, forma, torcida e "realismo simplificado" (T-014, US-010, US-026 e partes de US-009 e US-004) em `app/src/engine/`:
  - Moral entre rodadas: quem joga numa vitória ganha 3 pontos de moral, no empate fica igual e numa derrota perde 3; no clássico o efeito dobra. Quem esperava jogar e fica no banco perde 2 por rodada, a partir da 2ª seguida. O profissional sofre só metade das quedas e o temperamental sofre o dobro da queda por ficar no banco. A moral também anda até 1 ponto por rodada em direção ao humor da torcida, sem passar dele.
  - Forma: a média das últimas 5 notas de cada jogador, para o técnico ler ao escalar.
  - Termômetro da torcida (de 0 a 100, começa em 60), para os 20 clubes: sobe quando o time faz mais do que se esperava do confronto e desce quando faz menos. Contam ainda a goleada (3 gols ou mais de diferença), o jejum (a partir do 4º jogo sem vencer), estar entre os 4 primeiros ou na zona de rebaixamento (da 6ª rodada em diante), as decisões do técnico com a torcida e deixar o ídolo no banco. Ele puxa o mando de campo: de cerca de +3% com a torcida fria a +7% com ela em festa.
  - Modo "realismo simplificado": sem suspensões nem lesões, e a condição física volta a 100 entre as rodadas.
  - O ídolo do clube agora é sempre um titular.
  - `ENGINE_VERSION` 10: os goldens de rodada e de temporada mudam.
  - Em 100 temporadas, o termômetro fica em média 53,6 e a rodada leva cerca de 7 ms.

- Rodada e temporada (T-013, US-009, US-012 e US-019) em `app/src/engine/`:
  - `prepareRound` e `playRound`: a rodada completa, com as 10 partidas, a IA escalando os clubes, a ficha sugerida para o técnico e o `RoundSetup`. São idempotentes e recusam com `round-already-played`, `round-not-open` e `season-over`.
  - Entre rodadas: a suspensão é cumprida, os amarelos são mesclados, as lesões contam rodadas e a condição se recupera por dias. O "Cobrar" custa 3 pontos de moral aos temperamentais.
  - Modo "só resultado": a IA joga pelo técnico como Tradicional. Os comandos da partida ao vivo valem na rodada gravada.
  - `getStandings` com os 8 critérios de desempate; o sorteio final muda a cada temporada.
  - Fatos da tabela com cadência nova (cerca de 7,5 por rodada) e duas notícias novas, aprovadas pelo CEO: "perdeu a invencibilidade de N" (`unbeatenEnded`) e "acabou o jejum de N" (`winlessEnded`).
  - `seasonStats` com gols sofridos, para o prêmio de goleiro.
  - A força exibida desconta suspensos e lesionados.
  - `ENGINE_VERSION` 9: os goldens mudam.
  - Bancada da rodada: de 5,6 a 7,4 ms por rodada no Node.
  - Testes de ponta a ponta: temporada encadeada e carreira com o placar ao vivo igual ao gravado.

- Comandos do técnico e IA em jogo (T-012, US-021 e US-022) em `app/src/engine/match/`:
  - `simulateMatch(input, params, commands?)` aceita até 5 substituições, mudança de formação, postura e pressão, os atalhos de tática e a conversa do intervalo, incluindo "Pular". Sem comandos, as chamadas de dois argumentos continuam válidas.
  - O comando vale a partir do minuto seguinte, com prefixo idêntico: os eventos até o minuto do comando não mudam. Também vale nos acréscimos do 2º tempo (`added`).
  - IA em jogo, regras 1 a 6: (1) troca por lesão; (2) cansaço, aos 60, 70 e 80 minutos; (3) perdendo, vai ao ataque e põe um atacante; (4) segura o resultado quando ganha por 1 gol; (5) tudo ao ataque no fim; (6) guarda a 5ª troca. O clube do técnico humano só tem a regra 1; no "só resultado" a IA joga as seis por ele.
  - Troca de formação com jogador a menos: as últimas vagas livres da ordem da formação ficam vazias.
  - Avisos `command-*` para comando recusado ou corrigido; a partida nunca lança por causa de um comando.
  - `substitutionsLeft(events, side)`, `MAX_SUBS`, `TACTIC_PRESETS` e `IN_MATCH_AI` exportados pelo motor.
  - `ENGINE_VERSION` 7: os eventos e os goldens de partida mudam.

- IA pré-jogo (T-011, US-011) em `app/src/engine/`:
  - `suggestSheet` monta a ficha de cada clube: XI pelo valor de seleção, rotação com reserva descansado, banco de 1 goleiro e 6 de linha, capitão e cobradores.
  - Tática por perfil, com o Δ de força e o mando; o Caótico sorteia; time cansado joga com pressão baixa.
  - O clube do técnico humano é lido como Tradicional.
  - `validateLineup` aceita `min(11, aptos)` titulares e confere o banco.
  - O valor de seleção é compartilhado com a partida, e o desempate por ID passou a ser numérico.
  - `shownEleven`: a força exibida e a IA usam a mesma conta.
  - O relatório de métricas da partida passa a usar a IA na liga.
  - Teste de ponta a ponta: 3 temporadas com os 20 clubes reais, 2.280 fichas, nenhuma com lesionado ou suspenso, e a rotação funcionando.
  - `ENGINE_VERSION` continua 5.

- Cartões, lesões, pênaltis e faltas na partida (T-010, US-009) em `app/src/engine/match/`:
  - Cartões amarelos e vermelhos, com o segundo amarelo virando vermelho e a suspensão devolvida em `newSuspensions` (1 a 2 jogos); o contador de amarelos volta em `yellowCounts`, só de quem entrou em campo.
  - Lesões ligadas ao cansaço, com gravidade (`InjurySeverity`) e rodadas fora devolvidas em `newInjuries`.
  - Pênaltis e faltas diretas com cobradores; o fator casa também vale neles.
  - Capitão de traço líder: o efeito positivo da conversa do intervalo fica maior (`halftimeBoost` ganhou o 4º parâmetro opcional).
  - Jogo encerrado com menos de 7 em campo (`fulltime.abandoned`): vale 3×0 contra quem ficou com menos de 7, ou o placar do momento se a diferença já passava de 3. Os gols reais contam para a artilharia e o jogo não gera `goleada`, `virada` nem `golNoFim`.
  - Reserva entra no apito no lugar de titular lesionado ou suspenso, com aviso `lineup-unavailable-player`.
  - `ENGINE_VERSION` 5: os sorteios de cartões e lesões entram na ordem de cada minuto, e os goldens de partida mudam.

- Partida simulada minuto a minuto (T-009, US-008) em `app/src/engine/match/`: `simulateMatch(input, params)` gera as oportunidades de cada minuto (chance, finalização, defesa do goleiro e assistência), o cansaço, os acréscimos, a conversa do intervalo e o fechamento com estatísticas, notas, melhor em campo, marcadores do resultado (goleada, virada, zebra, gol no fim, hat-trick, clássico, estreia) e a lista de eventos. Mesma semente dá a mesma partida, byte a byte. Cartões, lesões, pênaltis e faltas ficam para a T-010.
- Goldens de partida novos (`__golden__`) e `ENGINE_VERSION` 4 (a geração do elenco passou a marcar as aparições pelo clube, o que muda o golden de novo jogo).
- Decisão do CEO (2026-11-04): o fator casa vale também na finalização, no chute do mandante e na defesa do goleiro do mandante, sem parâmetro novo (nota no ADR-0011 e em `docs/design/partida.md`, "Mando na finalização").
- A posse de bola exibida não leva o fator casa: dois times iguais ficam em 50% (antes, davam cerca de 61% ao mandante).
- O marcador "estreia" vale só para quem nunca jogou pelo clube: o elenco inicial começa com uma aparição (`PRE_CAREER_APPEARANCES`) e só os jovens do início da carreira com zero.
- Bancada da partida (`npm run bench -w app`): cerca de 0,13 ms por partida no Node, abaixo da meta de 0,3 ms. Ainda não roda no CI.
- Relatório de métricas da partida com os clubes reais, só com `MATCH_METRICS=1` (fora do `npm test` comum).

- ADR-0015 aceito: patrocínio real desligado e não anunciado; marcas fictícias só como cenário (`brandForSlot` como ponto único, a implementar na T-040); receita só com apoio voluntário. Substitui em parte a seção "Monetização e apoio" do `docs/PROJETO.md`.
- `config.sponsorship.enabled = false` em `config/prancheta.config.ts` (no lugar de `placeholderSponsor`), com teste de conformidade (`app/src/lib/sponsorship.test.ts`) que falha se o valor mudar ou se aparecerem convites como "Patrocine aqui" em `app/src/content/`, `site/src/` e `config/`.
- Força por setor (T-008, US-007) em `app/src/engine/strength.ts`: nota efetiva do jogador na vaga (overall, adequação à posição, moral e condição) e forças de defesa, meio e ataque a partir da formação, da postura e da pressão. Escalação inválida devolve o erro tipado `invalid-lineup`, sem lançar. Tipos `Lineup`, `Tactic` e `TeamSheet` em `lineup.ts`.
- Fator casa: 5% fixo (`match.homeBase`) mais a parte do termômetro da torcida do mandante, mais o bônus de clássico; o visitante e o campo neutro não recebem nada.
- Força exibida (`teamStrength`): média de `overall` com adequação dos 11 titulares, sem condição, moral nem mando; sem escalação definida, usa o melhor time disponível do clube.
- Vaga vazia (jogador a menos): a vaga sai da média do setor e o time paga só a penalidade por jogador a menos; setor sem ninguém vale 90% da média dos jogadores de linha em campo. O goleiro nunca fica sem substituto: um jogador de linha vai ao gol.
- Golden `strengths.json`; `ENGINE_VERSION` continua 3.
- Regras novas de design em `docs/design/partida.md`: "Vaga vazia (jogador a menos)" e troca de formação durante o jogo com menos de 11 em campo (ficam vazias as últimas vagas livres da ordem da formação).
- Contrato da T-008 documentado em `docs/02-architecture.md` (§4.1, "Força (T-008)").
- Dia 1: site com devlog, roteiro, apoio e privacidade; versão zero do jogo em `/jogo` (tela inicial, PWA instalável); configuração central da marca; tokens do design system; motor com gerador aleatório determinístico e gerador de escudos; kit da empresa de agentes adaptado ao projeto.
- Fundações do motor (T-001) em `app/src/engine/`: tipos base (`types.ts`), resultado tipado `ok`/`fail` (`result.ts`), `ENGINE_VERSION = 1` (`version.ts`) e utilitários numéricos determinísticos (`math.ts`: clamp, exp, normal).
- Utilitário de golden (`testing/golden.ts`, `__golden__/foundations.json`) e o script `npm run golden:update -w app`, que recusa sobrescrever um golden alterado sem subir `ENGINE_VERSION`.
- `GameParams` (T-002): `app/src/engine/params.ts` com tipos somente leitura, `PARAM_RANGES`, `validateParams` (nunca lança; lista todos os `ParamIssue`) e as constantes `SEASON_WEEKS = 34` e `SEASON_ROUNDS = 38`.
- Seis JSON em `app/src/params/` (`match`, `players`, `generation`, `ai`, `season`, `fans`), com `match.homeBase = 0.05` (ADR-0011) e valores da ADR-0005 fixos; `fatigue`, `injury` e `cards` são grupos dentro de `match.json`.
- `loadGameParams()` em `app/src/lib/params.ts`: valida uma vez e devolve os parâmetros congelados.
- Teste que prende os JSON às tabelas de `docs/design/`.
- Dados dos clubes (T-003, US-001): `ClubDef` e `validateClubs` em `app/src/engine/clubs.ts` (nunca lança), com `abbreviation` de 3 letras única, `titles` (`league`, `cup`, `libertadores`, `sudamericana`) e `strength` inteiro de 55 a 85, sem relação com o porte (ausente vale 70, com aviso).
- `app/src/data/` com `clubs.serie-a.json` (20 clubes fictícios aprovados), `blocklist.sha256.json` (1.443 hashes de nomes reais; nenhum nome real em texto), `check.ts` e `blocklist.ts` (SHA-256 só no Node).
- `npm run content:check` e `npm run blocklist:hash -- <arquivo fora do repositório>` (`scripts/hash-blocklist.mjs`).
- Gerador de nomes (T-004, US-003) em `app/src/lib/generators/names.ts`: sete formas de exibição, forma curta coerente com o prenome, sem duplicata no elenco, no máximo 3 jogadores por sobrenome, `familyNoSolo`, origem "X de Y", determinístico por semente e exclusões por índice; em esgotamento das listas devolve resultado marcado `degraded`.
- Listas de nomes fictícios `app/src/content/names/br.json` (412 prenomes, 19, 407, 123, 130 e 49 itens nas demais listas) e `br.exclusions.json` (57 pares, 6 sobrenomes e 3 triplas, só índices).
- Site novo: páginas O jogo, Modos, Clubes e Perguntas, página inicial refeita, roteiro com selo de estado (`site/src/data/recursos.ts`), escudos de exemplo gerados no build, tema dia automático, menu sem JavaScript, sitemap (`@astrojs/sitemap` 3.7.4) e `robots.txt`; nenhum script, cookie ou serviço de terceiros (teste `site/src/lib/dist.test.ts`).
- Tokens `layout` e o estilo `display-lg`; `display-xl` e `botao` passam a ser estilos de verdade em `design/tokens.json`.
- `contacts.discussionsUrl` e `contacts.repository` em `config/prancheta.config.ts`.
- `app/src/data/athletes-blocklist.sha256.json` (469 hashes de nomes de atletas reais; nenhum nome em texto).
- `npm run names:exclusions` (`scripts/name-exclusions.mjs`) e `npm run blocklist:hash:athletes`.
- Teste completo dos nomes com `NAMES_FULL_CHECK=1 npm test -w app` (cerca de 2 minutos), para rodar antes de release e quando as listas mudarem.
- ADR-0012 aceito: nome e rosto resolvidos na criação ficam no estado e no save; nome retirado também sai dos saves antigos.
- Modelo do jogador (T-005, US-004) em `app/src/engine/players.ts`: tipos `Player`, `PlayerNameText`, `PlayerIdentity` e `IdentitySource` (ADR-0012); `computeOverall`, `fit`/`fitLevel`, `drawTrait`, `drawPotential`, `drawGrowthCurve`, `isProspect` (rótulo "promessa"), `fitAttributesToOverall`, `attributeOf` e `validatePlayer` (nunca lança); constantes `SQUAD_COMPOSITION`, `POTENTIAL_MAX` e limites dos campos.
- Fontes de teste do motor `testing/identity.ts` e `testing/players.ts` e golden `__golden__/players.json` (`ENGINE_VERSION` continua 1).
- Desenho e textos aprovados do site novo (`docs/design/site.md`, `docs/content/site/`); a implementação vem em PR próprio.
- Geração dos elencos e novo jogo (T-006, US-004): `newGame` e `generateSquad` em `app/src/engine/`, com formações, números de camisa realistas, joia e ídolo por clube; nome e rosto vêm da `IdentitySource` recebida por argumento (ADR-0012).
- `app/src/lib/generators/identity.ts`: fonte de identidade do jogo, com rosto placeholder até a T-027.
- ADR-0013 aceito: liga online da 1b com até 20 humanos, um por clube; liga online com Séries A e B antecipada para a Etapa 2.
- Calendário da Série A (T-007, US-006) em `app/src/engine/fixtures.ts`: 380 jogos, Berger com `BERGER_START = 3`, returno espelhado, mando com no máximo 2 seguidos, 1ª rodada no domingo depois do 2º sábado de abril, 8 rodadas de quarta, sem Data FIFA e última rodada entre 26/11 e 02/12.
- `newGame` devolve `fixtures` e o erro `'invalid-calendar'` (ano fora do intervalo ou calendário que não cabe); `Rng.shuffle` determinístico.
- Nomes, revisão 2: listas revisadas pelo CEO, origens curtas e exclusões regeneradas.
- Descrições curtas para compartilhar as páginas do site, aprovadas (clubes: "Clubes com trocadilho").
- Propostas de três direções visuais do site (escolhida a A "Noite de estádio") e de três estilos de escudo (aguardando escolha).
- Site na direção visual A "Noite de estádio" (`docs/design/site.md`): componentes novos (`StadiumHero`, `FloodlightTower`, `GlassCard`, `Sticker`, `StickerGrid`, `StageTable`, `TableScroll`, `TacticDiagram`, `PitchShowcase`, `MatchSample`, `NewsSample`, `FanMeter`, `RhythmCompare`, `StepList`, `StatusBadge`, entre outros), páginas refeitas e tabelas que viram cartões no celular; sem rolagem horizontal da página a 320px.
- Imagens de compartilhamento (1200x630) geradas no build por `scripts/og.mjs` (`npm run og`), uma por página, em `site/public/og/`; o script falha se as fontes não forem achadas ou se a imagem passar de 300 KB.
- Gerador de escudos estilo A v5 (`app/src/lib/generators/shield.ts`): seis silhuetas, dez padrões, 20 símbolos da cidade desenhados por nós, estrelas douradas (títulos da Série A) e prateadas (Série B), versão simples até 32px. SVG autocontido, determinístico, sem sorteio.
- Campos fixos de escudo em `ClubDef` (`crestShape`, `crestPattern`, `crestBase`, `crestSymbol`) nos 20 clubes da Série A, validados por `validateClubs` (problema `invalid-crest` quando o valor não está na lista).
- ADR-0014 aceito: escudos podem lembrar o clube real só na silhueta, nas cores e no tipo de padrão, nunca no símbolo, nas iniciais, na sigla, no nome ou na composição.
- Tokens novos no design system: `body-lg` (17px/26px), `sticker-name`, `sticker-name-long` e `stage-number`; `type-display-xl` passa a ter mínimo de 64px. Também os tokens de vidro, feixe de luz, adesivo e giz da direção A.
- Textos complementares do site aprovados pelo CEO em `docs/content/site/complementos.md` (inclui o item dos escudos na página Clubes).
- Capturas de tela do site implementado em `docs/design/`.

### Alterado

- Fadiga e condição valem só no realismo Completo (T-028; US-016 e US-010).
- Determinismo entre motores JavaScript (T-074, ADR-0020):
  - `ENGINE_VERSION` 16. Nos goldens só mudaram a versão e os digests; os saves continuam válidos sem migração (`engineVersion` é só diagnóstico; `schemaVersion` segue 1).
  - O lint barra funções transcendentais em todo o motor, inclusive em `math.ts`, e também alias de `Math`, acesso computado e passar `Math` adiante.
  - O build mantém o aviso de licença da Sun no bundle (`rolldownOptions.output.comments.legal`), com +222 B em gzip.
  - Balanceamento idêntico ao anterior (39/39, 91/91 e 75/75; de release, 39/39).
  - `KNOWN_DIVERGENCE` e `GOLDEN_STRICT` saíram dos testes E2E.

- Fronteira do motor e relatório da rodada fora do estado (T-049, ADR-0019; decisões 12 e 13 da auditoria de 2026-11-05):
  - `ENGINE_VERSION` 13. O `lastRound` saiu do `GameState`: o relatório da rodada só volta no retorno do `playRound`. Entram no contrato `roundRecap` (relatório enxuto, até cerca de 7 KB gzip) e `matchSheet` (súmula da partida, até cerca de 2,4 KB gzip com os clubes reais), para a camada de aplicação guardar fora do estado.
  - O estado ficou cerca de 16% menor (rodada 6: de 506 para 425 KB crus e de 70 para 57 KB em gzip).
  - O `app/src/engine/index.ts` passou de 347 para 174 símbolos: o contrato público (152) mais uma API de ferramentas (22), só para `scripts/`.
  - Nova regra de lint `engineEntryOnly`: quem está fora do motor importa só o `index.ts`. Vale para o `app/` e para o `eslint.config.js` da raiz, que agora roda com `eslint .`.
  - A simulação não mudou: o `/balance` de 200 temporadas dá o mesmo resultado da `main` (39 de 39 metas).
  - O motor deixou de tolerar estado sem `pastSeasons`; estado de formato antigo é assunto das migrações do save (T-019). Saíram a fixture `state-engine-v9-round-6.json` e o `legacy-state.test.ts`.
  - O `og.test.ts` foi para `scripts/`. No `package-lock.json` só entraram as declarações `eslint` e `typescript-eslint` na raiz; nenhuma versão mudou.
- Infraestrutura: CI roda `content:check`, o balanceamento (200 temporadas, semente 1) e os testes do site sobre o build; ações do GitHub fixadas por SHA; hook de pre-commit que formata com o Prettier (ativado no `npm install`).
- Motor: `ENGINE_VERSION` 12 (fim de temporada e virada). O estado do jogo ganha o histórico de temporadas passadas (`pastSeasons`, vazio no jogo novo) e o golden da virada entra; a simulação em si não muda.

- Calibragem da partida e da ferramenta (T-016, parte 2), com as decisões do CEO de 2026-11-05:
  - Tirar o pé: quem vence por 2 gols ou mais passa a atacar menos. Com isso saem menos goleadas (12,3% dos jogos) e o time que está ganhando deixa de pressionar até o fim.
  - Menos cartões vermelhos (0,18 por jogo): quem está pendurado se cuida mais.
  - Um pouco mais de zebra: o time 30 pontos mais fraco vence 8,3% das vezes, e o 20 pontos mais forte vence 62,8%.
  - "Todo mundo no ataque" virou uma aposta de verdade: dá mais força de ataque, mas deixa a defesa bem mais exposta. Só pode ser usado a partir dos 60 minutos.
  - Torcida: o termômetro volta ao normal um pouco mais rápido (`fans.reversion` 0,10).
  - Temporada: campeão com cerca de 75 pontos e 17º com cerca de 40; 2,64 gols por jogo.
  - Motor: `ENGINE_VERSION` 11. Os goldens de partida, rodada e temporada mudam.
  - `npm run balance` agora mede o "tudo no ataque" a partir dos 60 minutos, aponta comandos de duelo ignorados como falha e trata "grande rebaixado" só como informação na temporada única. Em 3 sementes de 200 temporadas, as 36 metas obrigatórias ficam dentro em cada uma e as 3 raras ficam dentro no total. O técnico-robô ganha cerca de 4,2 pontos por temporada.

- `ai.subEnergy` de 65 para 85 (aprovado pelo CEO em 2026-11-04): dá cerca de 3,5 trocas por time, dentro da meta de 3 a 4.
- Textos do site sem patrocínio: a seção "Patrocinadores" e o "Quer anunciar?" saem, a pergunta sobre anúncios responde que o jogo não tem e que as marcas do cenário são fictícias, e o rodapé fala em "marcas".
- Etiqueta da página inicial passa a "Em desenvolvimento · acompanhe no devlog", e o subtítulo do jogo (`home.subtitle`) muda nos três idiomas ("Versão zero. Acompanhe a construção no devlog."), sem "em público".
- `ENGINE_VERSION` passa a 2 (calendário no estado inicial).
- Nome de exibição do jogador limitado a 22 caracteres: sorteia-se de novo a forma e, se preciso, o jogador.
- ADR-0013 revisado: liga online ao vivo até 8 humanos e assíncrona até 20 por divisão; o site usa esses números.
- Lint impede `lib/` e `ui/` de importar arquivos só do Node e os hashes de bloqueio.
- Metas de placar do balanceamento: 0×0 de 6% a 9%, goleada de 8% a 13%, diferença de 5 ou mais gols de 0,5% a 2%.
- Regra de nomes reais: documentos de trabalho em `docs/` podem citá-los só como referência; no jogo, código, dados e site a regra continua absoluta.

- Lint de fronteira do motor ampliado: sem `ui`, `lib`, `content`, `params`, `data`, DOM, `Intl`, `process` nem `node:*`; sem `Math.random`, `Date.now`, `localeCompare` e `toLocale*`; imports relativos com extensão `.ts`; código de produção não importa `testing/`. Fora do motor: `ui` não importa `lib/save` e `lib` não importa `ui`.
- `erasableSyntaxOnly` ligado em `app/tsconfig.json`.
- `attributes` do jogador é parcial (6 chaves por posição) e `potential` é guardado até 99; o teto 95 vale só na geração (`docs/02-architecture.md` §4.1).
- `engines.node` passa a exigir `>= 22.18`.
- O tamanho do elenco (25) deixou de ser parâmetro e virou constante.
- O escudo gerado passa a mostrar a sigla do clube (`abbreviation`) no símbolo de letra; `shieldSpecFor` ganhou o 4º argumento opcional.
- Porte (grandes, médios, pequenos) separado da força: o porte vem de títulos, história e torcida; a força, da tabela do Brasileirão 2026 parcial (33ª rodada), numa escada única de 20 degraus.
- `ENGINE_VERSION` passa a 3 (campos de escudo em `ClubDef`; a simulação não mudou).
- `shieldSpecFor` agora recebe o clube (`ShieldClub`) e opções (`{ label?: boolean }`) e lê forma, padrão, base e símbolo dos dados do clube, no lugar do sorteio por id; as estrelas vêm de `titles.league` (e `titles.leagueB`, opcional).
- ADR-0013 revisada: ao vivo até 8 humanos, assíncrona até 20 por divisão, e liga com Série A e B já na Etapa 2.
- Texto alternativo do diagrama de pressão no site: "cada uma mais marcada que a anterior".

### Corrigido

- Card do jogador: o título passa a ser o mesmo nome da linha do Elenco (o apelido, quando há), e o nome completo aparece logo abaixo, em letra menor, só quando é diferente. Antes o card mostrava só o nome completo e parecia ser de outro jogador.
- Toque duplo no X do card do jogador e no "Fechar" do menu "Mais" não fecha duas vezes (T-028).
- Site: espaços em volta de elementos inline ("eLiga", "oroteiro"), com teste geral em `site/src/lib/dist.test.ts`.
- Site: tamanho da liga passa a "Até 20 (um técnico por clube da Série A)"; removida frase desatualizada sobre números ajustáveis.
