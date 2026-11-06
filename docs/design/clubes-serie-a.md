# Clubes da Série A: porte, força, perfil de IA, capacidade e títulos (T-003)

> Mantido pelo `game-designer`. Entrada para `ClubDef` (`docs/02-architecture.md` §4.1): `size`, `strength`, `aiProfile`, `stadium.capacity` e o campo novo proposto `titles`. Nomes, cores, siglas e rivais vêm do lote aprovado `docs/content/lotes/2026-11-04-nomes-serie-a.md`. O nome do estádio fica com o `content-writer`; este documento só fixa a capacidade.

**Regra em uma frase:** o porte diz quem o clube é (títulos, história, torcida) e a força diz como o elenco está agora (colocação na tabela de referência); um grande pode estar mal.

## Porte e força: dois conceitos separados (decisão do CEO, 2026-11-04)

|                 | Porte (`size`)                                                                                                                                                     | Força (`strength`)                                                                                                    |
| --------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------------------------------- |
| O que é         | estrutura: títulos (Brasileiro, Copa do Brasil, Libertadores, Sul-Americana), história e tamanho da torcida                                                        | momento do elenco                                                                                                     |
| De onde vem     | decisão do CEO no lote de clubes                                                                                                                                   | colocação na tabela de referência, numa escada única de 20 degraus                                                    |
| Quando muda     | raramente, só por decisão do CEO; a colocação **nunca** muda o porte                                                                                               | todo lote anual (e na revisão de dezembro de 2026)                                                                    |
| O que afeta     | meta e paciência da diretoria; humor e expectativa da torcida nos textos; perfil de IA padrão; capacidade padrão; na Etapa 3, receita (público, cotas, patrocínio) | geração do elenco (overall dos titulares, reservas e jovens, `jogadores.md`) e, por ele, tudo o que acontece em campo |
| O que não afeta | o resultado de um jogo (o motor da partida não lê porte)                                                                                                           | metas e paciência (estas leem o porte)                                                                                |

## Tabela

Ordem e `strength` pela classificação do Brasileirão 2026 **parcial, 33ª rodada, 2026-11-02** (Ref. 2026 = posição nessa tabela), com a escada de "Força" (fundo mais alto, decisão do CEO de 2026-11-06). **O lote é refeito com a tabela final depois da 38ª rodada (dezembro de 2026).** Títulos = histórico fictício até 2025, espelhando o clube real (Chapecão tem 0 Sul-Americana por decisão do CEO: nenhuma alusão à história do clube real). Capacidade = a do estádio real em que o clube manda os jogos, arredondada para centenas.

| #   | Clube            | Porte   | Ref. 2026 | `strength` | `aiProfile`   | `stadium.capacity` | Brasileiro | Copa do Brasil | Libertadores | Sul-Americana | Justificativa curta (porte; momento)                                                                |
| --- | ---------------- | ------- | --------- | ---------- | ------------- | ------------------ | ---------- | -------------- | ------------ | ------------- | --------------------------------------------------------------------------------------------------- |
| 1   | Flamingo         | grande  | 1         | 78         | `ambitious`   | 78.800             | 8          | 5              | 4            | 0             | Grande: 8 Brasileiros, 4 Libertadores, maior torcida. Líder: o favorito.                            |
| 2   | Palmeral         | grande  | 2         | 77         | `ambitious`   | 43.700             | 12         | 4              | 3            | 0             | Grande: maior campeão nacional (12). Vice: segundo favorito.                                        |
| 3   | Cruzador         | grande  | 3         | 76         | `traditional` | 61.900             | 4          | 6              | 2            | 0             | Grande: maior campeão da Copa (6), 2 Libertadores. Terceiro: briga pelo título.                     |
| 4   | Fluminário       | grande  | 4         | 75         | `academy`     | 78.800             | 4          | 1              | 1            | 0             | Grande: 4 Brasileiros e Libertadores. Quarto; divide o maior estádio com o Flamingo.                |
| 5   | Tufão            | médio   | 5         | 74         | `seller`      | 42.400             | 1          | 1              | 0            | 2             | Médio: títulos nacionais (1/1), 2 Sul-Americanas, torcida regional. Quinto: médio em alta.          |
| 6   | Baião            | médio   | 6         | 73         | `traditional` | 48.700             | 2          | 0              | 0            | 0             | Médio: 2 Brasileiros, maior torcida do Nordeste na lista. Sexto: médio em alta.                     |
| 7   | Atlético Minério | grande  | 7         | 72         | `ambitious`   | 44.900             | 3          | 2              | 1            | 0             | Grande: 3 Brasileiros, Libertadores, torcida enorme. Sétimo: G8.                                    |
| 8   | Santões          | grande  | 8         | 72         | `academy`     | 16.100             | 8          | 1              | 3            | 0             | Grande: 8 Brasileiros, 3 Libertadores. Oitavo: meio de tabela.                                      |
| 9   | Bragantão        | pequeno | 9         | 71         | `seller`      | 12.000             | 0          | 0              | 0            | 0             | Pequeno: sem títulos, torcida de cidade do interior. Nono: pequeno bem armado, à frente de grandes. |
| 10  | São Paulão       | grande  | 10        | 70         | `traditional` | 72.000             | 6          | 1              | 3            | 1             | Grande: 6 Brasileiros, 3 Libertadores. Décimo: meio de tabela.                                      |
| 11  | Coritibom        | médio   | 11        | 70         | `academy`     | 40.500             | 1          | 0              | 0            | 0             | Médio: 1 Brasileiro, torcida grande no estado. 11º: meio de tabela.                                 |
| 12  | Botafogueira     | grande  | 12        | 69         | `seller`      | 44.700             | 3          | 0              | 1            | 0             | Grande: 3 Brasileiros, Libertadores. 12º: temporada fraca.                                          |
| 13  | Vasconcelos      | grande  | 13        | 68         | `traditional` | 21.700             | 4          | 1              | 1            | 0             | Grande: 4 Brasileiros, Libertadores, torcida enorme. 13º: gigante em fase ruim.                     |
| 14  | Vitorioso        | médio   | 14        | 68         | `chaotic`     | 35.600             | 0          | 0              | 0            | 0             | Médio: sem títulos nacionais, torcida grande no Nordeste. 14º: luta contra a queda.                 |
| 15  | Grêmeos          | grande  | 15        | 67         | `traditional` | 55.700             | 2          | 5              | 3            | 0             | Grande: 3 Libertadores, 5 Copas. 15º: grande em crise.                                              |
| 16  | Miragol          | pequeno | 16        | 66         | `seller`      | 15.000             | 0          | 0              | 0            | 0             | Pequeno: sem títulos, cidade pequena. 16º: no limite da queda.                                      |
| 17  | Corinto          | grande  | 17        | 65         | `ambitious`   | 48.900             | 7          | 4              | 1            | 0             | Grande: 7 Brasileiros, segunda maior torcida. 17º: grande na zona de rebaixamento.                  |
| 18  | Inter-Regional   | grande  | 18        | 65         | `academy`     | 50.800             | 3          | 1              | 2            | 1             | Grande: 3 Brasileiros, 2 Libertadores. 18º: grande na zona de rebaixamento.                         |
| 19  | Remador          | médio   | 19        | 64         | `academy`     | 53.600             | 0          | 0              | 0            | 0             | Médio: sem títulos nacionais, mas torcida regional enorme (estádio estadual). 19º.                  |
| 20  | Chapecão         | pequeno | 20        | 64         | `traditional` | 21.600             | 0          | 0              | 0            | 0             | Pequeno: sem títulos (decisão 5 do CEO), cidade pequena. Lanterna.                                  |

## Porte

**Critério:** grande = os "12 grandes" de referência do futebol brasileiro (muitos títulos nacionais e continentais, torcida nacional). Médio = títulos nacionais ou torcida regional muito grande. Pequeno = sem títulos nacionais e torcida de cidade.

| Porte   | Quantos | Clubes                                                                                                                                                |
| ------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grande  | 12      | Flamingo, Corinto, Palmeral, São Paulão, Santões, Vasconcelos, Fluminário, Botafogueira, Grêmeos, Inter-Regional, Atlético Minério, Cruzador          |
| Médio   | 5       | Tufão (1/1 e 2 Sul-Americanas), Baião (2 Brasileiros), Coritibom (1 Brasileiro), Vitorioso e Remador (sem títulos nacionais, torcida regional enorme) |
| Pequeno | 3       | Bragantão, Miragol, Chapecão                                                                                                                          |

- **Mudança em relação ao lote aprovado (6/8/6):** sobem a grande Fluminário, Botafogueira, Vasconcelos, Santões, Cruzador e Inter-Regional; sobem a médio Vitorioso, Coritibom e Remador. A coluna "Porte" do lote `docs/content/lotes/2026-11-04-nomes-serie-a.md` precisa ser atualizada pelo Orquestrador ou pelo `content-writer` (o teste do `developer` confere os dois documentos).
- Vitorioso e Remador são médios só pela torcida; se o CEO preferir o critério "médio exige título nacional", os dois viram pequenos (12/3/5). Recomendo médio: a torcida grande é o que o jogador sente (estádio cheio, cobrança).

## Força

**Escada única de 20 degraus, com o fundo mais alto (decisão do CEO, 2026-11-06, "ok recomendado"; T-070):** 78, 77, 76, 75, 74, 73, 72, 72, 71, 70, 70, 69, 68, 68, 67, 66, 65, 65, 64, 64 (soma 1.404). O 1º da tabela de referência recebe 78, o 2º 77, e assim por diante; o porte não entra. A ordem é a da tabela de referência vigente (a média 3/2/1 foi adiada; ver "Média ponderada de 3 temporadas" abaixo) e `generation.clubStrengthSd` fica em 1,5.

```
strength(club) = LADDER[reference(club) - 1]
LADDER = [78, 77, 76, 75, 74, 73, 72, 72, 71, 70, 70, 69, 68, 68, 67, 66, 65, 65, 64, 64]
reference(club) = posição na tabela de referência (1..20)
```

- **O que mudou:** os 3 últimos degraus subiram (64, 63 e 62 viraram 65, 64 e 64). Na lista de 2026, Inter-Regional 64 → 65, Remador 63 → 64 e Chapecão 62 → 64; os outros 17 clubes não mudam. O 1º − 20º vai de 16 a 14 e o desvio da escada de 4,6 a 4,3 (metas da decisão 11 de `balance-targets.md`: de 12 a 20 e de 3,5 a 5,5).
- **Por quê:** é o princípio do CEO, "todos podem ser campeões". Na escada anterior (62 a 78), os dois mais fracos ficavam sem título em 1.000 temporadas com qualquer variação; com o fundo mais alto, todo clube é campeão ao menos uma vez (o mínimo é 1, no limite). Medição completa em `balance-targets.md`, "Medido: escada com o fundo mais alto", e em `balance-log.md`, 2026-11-06.
- **Empates previstos:** 72/72, 70/70, 68/68, 65/65 e 64/64, parte da escada; a variação por carreira (`clubStrengthSd = 1,5`) desempata. O "clube mais fraco da escada" das metas novas é o de menor `strength` da lista, com empate pelo `id`: na lista de 2026, o Chapecão (64, empatado com o Remador).
- **Consequências que o CEO pediu:** Corinto (17º) e Inter-Regional (18º) têm 65, abaixo de Bragantão (71) e Coritibom (70). Tufão (5º) e Baião (6º), médios, são o 5º e o 6º mais fortes.
- **Escada anterior (de 2026-11-04 a 2026-11-06):** `[78, 77, 76, 75, 74, 73, 72, 72, 71, 70, 70, 69, 68, 68, 67, 66, 65, 64, 63, 62]`, soma 1.400, a validada no protótipo (campeão 73,7 pontos, 17º com 40,7).

### Medido com a escada nova (2026-11-06)

| Métrica                                     | Escada anterior           | Fundo mais alto           | Meta                                        |
| ------------------------------------------- | ------------------------- | ------------------------- | ------------------------------------------- |
| Clubes sem título (1.000 temporadas, s1)    | 2                         | 0                         | 0 (todo clube campeão ao menos 1 vez)       |
| Robô no mais fraco: G4 (1.000 pareadas, s1) | 1,3%                      | 3,0%                      | ao menos 2%                                 |
| Campeão pequeno (1.000, s1)                 | 2,9%                      | 3,3%                      | 0,5% a 4% (era 3%)                          |
| Campeão grande (1.000, s1)                  | 79,8%                     | 80,0%                     | 50% a 90% (era 85%)                         |
| Campeão grande (200: s1 / s2 / s3; total)   | 83,0 / 80,5 / 82,5; 82,0% | 86,0 / 85,5 / 78,0; 83,2% | 50% a 90%, semente a semente                |
| Campeão pequeno (200 × 3 sementes, total)   | 1,5%                      | 2,2%                      | 0,5% a 4%                                   |
| Clube fraco no G4 (1.000, s1)               | 5,5%                      | 7,1%                      | 5% a 15%                                    |
| Pontos do campeão / do 17º (1.000, s1)      | 75,3 / 40,3               | 75,0 / 40,6               | 72 a 82 / 39 a 45                           |
| Robô no Coritibom: ganho / título (200, s1) | +4,1 / 4,5%               | +4,4 / 4,5%               | +2 a +8 / no máximo 5%                      |
| Duelos de 20 e 30 pontos, metas de partida  | dentro                    | iguais                    | os duelos usam elencos sintéticos com força |

- **Teto do campeão grande a 90% (decisão do CEO, 2026-11-06):** com 200 temporadas, o campeão grande saía do teto de 85% nas sementes 1 e 2 (86,0% e 85,5%), embora o total das 3 sementes (83,2%) e a rodada de 1.000 (80,0%) ficassem dentro. O 85% foi calibrado para a escada anterior; o CEO subiu o teto para 90% (todos os 23 campeões dos pontos corridos foram grandes, e ainda sobram ao menos 10% dos títulos para médios e pequenos), e o CI continua com `--seasons 200 --seed 1` (`balance-targets.md`, decisão 16, item 6).

### Impacto previsto nas metas (2026-11-04, escada anterior; histórico)

Sem o motor de partida, estimei com um modelo simplificado (Poisson, mando +4, 300 temporadas, `clubStrengthSd = 1,5`): serve para a direção da mudança, não para o número.

| Métrica (`balance-targets.md`)              | Meta          | Antes (6/8/6, escada por porte) | Depois (12/5/3, escada única) | Leitura                                         |
| ------------------------------------------- | ------------- | ------------------------------- | ----------------------------- | ----------------------------------------------- |
| Pontos do campeão / do 17º                  | 72–82 / 39–45 | sem mudança                     | sem mudança                   | mesma escada                                    |
| Campeão por porte: grande                   | 50%–85%       | ~92% no modelo                  | ~87% no modelo                | cai um pouco; o modelo exagera os dois          |
| Campeão por porte: pequeno                  | 0,5%–3%       | 0%                              | ~1%                           | Bragantão (71) às vezes ganha                   |
| Temporadas com ao menos um grande rebaixado | 40%–80%       | ~4%                             | **~97%**                      | acima da meta no modelo; conferir no `/balance` |

**Decidido pelo CEO (2026-11-04):** "temporadas com ao menos um grande rebaixado" passa a 40% a 80% e "campeão é grande" a 50% a 85% (`balance-targets.md`; o teto passou a 90% em 2026-11-06, decisão 16). Pequeno ou médio campeão: raro, mas possível (tática, zebra, jovens; mercado e estrutura na Etapa 3). O `/balance` reporta as métricas pelo porte e, para comparação, pelos 6 mais fortes.

### Expectativa da diretoria (decidido, ADR na Etapa 4)

A meta vem da força (`targetPosition = min(strengthRank + 2, 16)`) e o porte dá a paciência e o tom da cobrança (`temporada.md`, "Expectativa da diretoria"). Corinto (17º em força) ouve "é obrigação ficar entre os 16", não "entre os 6". Na 1a muda só o texto; a ADR da Etapa 4 registra a troca da regra do `PROJETO.md`.

### Porte na carreira (Etapa 4)

O porte da tabela é o do início do jogo. Dentro da carreira ele pode crescer devagar com títulos e torcida (pequeno → médio → grande), guardado no save, sem mexer nestes dados (`temporada.md`, "Porte na carreira").

## Distribuição de perfis

Os perfis de cada clube não mudaram; mudou só a contagem por porte, que é a referência para o sorteio padrão de `ia-clubes.md`:

| Porte   | `ambitious` | `traditional` | `academy` | `seller` | `chaotic` |
| ------- | ----------- | ------------- | --------- | -------- | --------- |
| Grande  | 4           | 4             | 3         | 1        | 0         |
| Médio   | 0           | 1             | 2         | 1        | 1         |
| Pequeno | 0           | 1             | 0         | 2        | 0         |
| Total   | 4           | 6             | 5         | 4        | 1         |

- O perfil é jeito de gerir, não força: Corinto (65) segue `ambitious`, um grande em crise que continua atacando; Bragantão (71) segue `seller`.
- Um único `chaotic` (Vitorioso) na liga.
- Na 1a o perfil só afeta formação, postura, pressão e intervalo (a postura compara forças, não portes).

## Capacidade

- **Igual à real, arredondada para centenas.** Onde as fontes divergem (Baião, Chapecão), média da faixa. Flamingo e Fluminário dividem o mesmo estádio (78.800); o `content-writer` dá o mesmo nome aos dois.
- **Remador: 53.600 (o estádio estadual).** Não há dado confiável do estádio próprio, e o clube manda os jogos grandes lá; agora como médio de torcida enorme, isso fica coerente.
- **Ocupação média na meta.** A ocupação de `torcida.md` não depende da capacidade nem do porte: com `fans.baseOccupancy = 0,62` e termômetro médio 55, 61% em todo estádio (meta 55% a 70%). **Nenhum parâmetro muda.**
- Médias por porte: grande 51.500, médio 44.200, pequeno 16.200. Padrões de `torcida.md` (45.000 / 30.000 / 15.000) só para clube sem capacidade na lista.

## Títulos (histórico fictício)

- **Espelham os reais até 2025**, um a um; nenhum texto menciona o clube real.
- **Na 1a são só conteúdo:** notícias e fichas ("o maior campeão do país", "tetracampeão da América", "em busca do primeiro título"), apresentação do clube na escolha da carreira, cerimônias de título. O título ganho na carreira soma ao histórico na exibição.
- **Pesam no porte** (critério acima, decisão do CEO), **nunca na força**.
- Seis clubes sem título nacional (Bragantão, Miragol, Vitorioso, Chapecão, Remador; Coritibom tem 1): histórias de "primeiro título".

## Atualização anual

**Regra em uma frase:** uma vez por ano o lote de clubes é atualizado para quem começa jogo novo; a força segue a colocação final do último campeonato e o porte só muda se o CEO decidir.

| Dado                    | Muda?                 | Como                                                                  |
| ----------------------- | --------------------- | --------------------------------------------------------------------- |
| `strength`              | sim                   | escada única pela colocação de referência                             |
| `titles`                | sim                   | soma os títulos reais da temporada encerrada                          |
| `stadium.capacity`      | sim, se mudou         | capacidade real arredondada para centenas                             |
| Quem está em cada série | sim                   | 4 rebaixados saem, 4 que subiram entram                               |
| `size` (porte)          | só por decisão do CEO | nunca pela colocação                                                  |
| `aiProfile`             | não, por padrão       | troca só com justificativa no lote (clube vendido, mudança de gestão) |
| Carreiras já começadas  | não                   | o save leva os seus `ClubDef`; o lote novo vale só para jogo novo     |

**Referência:** posição final na Série A anterior (1 a 16 para quem ficou); quem subiu recebe `20 + posição na Série B` (21 a 24). Os 20 da Série A nova são ordenados pela referência e recebem `LADDER` nessa ordem. **Base 2026:** os 20 já estão na Série A 2026, então a referência é a posição na tabela parcial de 2026 (1 a 20).

**Exemplo:** se em 2026 Corinto terminar 3º, no lote de 2027 ele recebe 76 (3º degrau) e continua grande; se Bragantão terminar 3º, recebe 76 e continua pequeno.

## Casos de borda

| Caso                                                             | Regra                                                                                |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| `strength` fora de 55–85                                         | dado inválido: o carregador de `app/src/data/` recusa                                |
| `strength` ausente                                               | 70 (meio da escada), com aviso                                                       |
| `aiProfile` ausente                                              | sorteio por porte com a semente da carreira (`ia-clubes.md`); nesta lista não ocorre |
| `stadium.capacity` ausente                                       | padrão por porte de `torcida.md`; nesta lista não ocorre                             |
| Tabela real em andamento (base 2026)                             | usa a parcial mais recente, com data e rodada no doc; refaz com a final              |
| Empate de pontos na tabela real                                  | vale a posição oficial (critérios de desempate da competição)                        |
| Clube sem colocação conhecida                                    | vai para o fim da ordem; empate entre dois nessa situação desempata pelo `id`        |
| Clube com `rivals` vazio (Bragantão, Miragol, Chapecão, Remador) | sem efeito; o multiplicador de clássico do público não se aplica                     |

## Média ponderada de 3 temporadas: estudada e adiada para o lote de dezembro

> Estudo pedido pelo CEO em 2026-11-05. **Decisão do CEO (2026-11-06, "ok recomendado", item 5): fica de lado, para rever no lote de dezembro de 2026**, separada da escada. A regra vigente continua a de "Força" e "Atualização anual" acima. Medido com o `/balance` do motor em cópias temporárias dos dados (200 temporadas por semente, sementes 1 a 3; e 1.000 na semente 1); nada foi gravado em `app/`.

**Regra estudada, em uma frase:** a força de cada clube vem da posição média nas 3 últimas temporadas, com pesos 3, 2 e 1 (a mais recente pesa metade), e a escada de 20 degraus é distribuída por essa média.

```
pyramid(club, season) = posição na Série A            (1..20)
                      | 20 + posição na Série B        (21..40)
                      | 40 + posição geral na Série C  (41..60)
                      | 61                             (abaixo da Série C ou sem dado)
avg(club) = (3 × pyramid(t) + 2 × pyramid(t − 1) + 1 × pyramid(t − 2)) / 6
strength(club) = LADDER[rank(avg) − 1]      // a mesma LADDER de "Força"
```

- **t:** a última temporada completa, ou a em andamento com peso cheio a partir da 19ª rodada (pela última rodada completa). O peso proporcional às rodadas (3 × 33/38) quase não muda a ordem e foi descartado.
- **Desempate:** a melhor posição em t, depois em t − 1, depois o `id`. Sem dado de uma temporada, conta 61; na Série C, vale a classificação geral final.
- **Constantes, não parâmetros:** os pesos e o número de temporadas ficam neste doc; a força é dado de `app/src/data/`, calculado no lote, e o motor não lê a fórmula. O porte continua fora da conta.
- **Promovidos:** entram na mesma conta (a temporada que acabou conta 20 + posição na Série B), então um promovido pode ficar acima de quem ficou na Série A.

### Ordem e força (dados reais, parcial da 33ª rodada de 2026)

Posições reais da Série A; "B" e "C" com o valor da pirâmide entre parênteses. A ligação com o clube real é a do lote `docs/content/lotes/2026-11-04-nomes-serie-a.md`. As duas últimas colunas usam a escada vigente (fundo mais alto).

| Ordem 3/2/1 | Clube            | 2024     | 2025    | 2026 (33ª) | Média 3/2/1 | Força vigente (ordem atual) | Força com a ordem 3/2/1 |
| ----------- | ---------------- | -------- | ------- | ---------- | ----------- | --------------------------- | ----------------------- |
| 1           | Flamingo         | 3        | 1       | 1          | 1,33        | 78                          | 78                      |
| 2           | Palmeral         | 2        | 2       | 2          | 2,00        | 77                          | 77                      |
| 3           | Cruzador         | 9        | 3       | 3          | 4,00        | 76                          | 76                      |
| 4           | Fluminário       | 13       | 5       | 4          | 5,83        | 75                          | 75                      |
| 5           | Baião            | 8        | 7       | 6          | 6,67        | 73                          | 74                      |
| 6           | Botafogueira     | 1        | 6       | 12         | 8,17        | 69                          | 73                      |
| 7           | São Paulão       | 6        | 8       | 10         | 8,67        | 70                          | 72                      |
| 8           | Atlético Minério | 12       | 11      | 7          | 9,17        | 72                          | 72                      |
| 9           | Bragantão        | 16       | 10      | 9          | 10,50       | 71                          | 71                      |
| 10          | Santões          | B1 (21)  | 12      | 8          | 11,50       | 72                          | 70                      |
| 11          | Tufão            | 17       | B2 (22) | 5          | 12,67       | 74                          | 70                      |
| 12          | Vasconcelos      | 10       | 14      | 13         | 12,83       | 68                          | 69                      |
| 13          | Grêmeos          | 14       | 9       | 15         | 12,83       | 67                          | 68                      |
| 14          | Miragol          | B2 (22)  | 4       | 16         | 13,00       | 66                          | 68                      |
| 15          | Vitorioso        | 11       | 15      | 14         | 13,83       | 68                          | 67                      |
| 16          | Corinto          | 7        | 13      | 17         | 14,00       | 65                          | 66                      |
| 17          | Inter-Regional   | 5        | 16      | 18         | 15,17       | 65                          | 65                      |
| 18          | Coritibom        | B12 (32) | B1 (21) | 11         | 17,83       | 70                          | 65                      |
| 19          | Chapecão         | B15 (35) | B3 (23) | 20         | 23,50       | 64                          | 64                      |
| 20          | Remador          | C4 (44)  | B4 (24) | 19         | 24,83       | 64                          | 64                      |

Vasconcelos e Grêmeos empatam em 12,83; o desempate pela posição de 2026 põe o Vasconcelos na frente.

### O que foi medido (resumo)

| Métrica (meta)                                                | Ordem atual                | Ordem 3/2/1                | Fonte                                            |
| ------------------------------------------------------------- | -------------------------- | -------------------------- | ------------------------------------------------ |
| Campeão grande (teto 85% na época; hoje 90%), escada anterior | 83,0 / 80,5 / 82,5 (s1–s3) | 88,5 / 88,5 / 87,5 (s1–s3) | 200 temporadas por semente                       |
| Campeão pequeno, escada anterior (3 seeds)                    | 1,5%                       | 3,2%                       | 600 temporadas                                   |
| Campeão grande, fundo mais alto (1.000/200)                   | 80,0% / 86,0%              | 84,3% / 89,0%              | semente 1                                        |
| Clubes sem título, fundo mais alto (1.000)                    | 0                          | 0                          | semente 1                                        |
| Robô de referência: ganho                                     | Coritibom +4,4             | Tufão +2,3 (IC 1,2 a 3,4)  | fundo mais alto, 200, s1                         |
| Títulos dos médios (600, escada anterior)                     | 99 (16,5%)                 | 52 (8,7%)                  | a média tira títulos dos médios e dá aos grandes |

- **Por que ficou de lado:** a média premia a constância, e a constância é o que faz um clube ser grande. O Tufão (−4) e o Coritibom (−6), que subiram num ano só, descem; quem sobe é grande (Botafogueira +4, São Paulão +2). O campeão grande fica de 84% a 89%, acima do teto de 85% da época e perto do de 90% de hoje, e a média não combina com o "todos podem ser campeões" (concentra os títulos nos grandes).
- **Variantes descartadas:** 4/3/2/1 com 2023 (campeão grande de 91% a 93,5%), 2/1 só com 2026 e 2025 (84,8% na média das sementes, pequeno 3,3%) e 3/2/1 sem 2026 (92%, e a lista mudaria muito em dezembro). Nenhuma variante com histórico ficou dentro das duas faixas de porte com a escada anterior.
- **Corinto e Inter-Regional sobem só 1 ponto** com a média (66 e 65), porque também foram mal em 2025. Se o objetivo for dar chance real de título a um grande em crise, o botão seria o porte entrar na força (um piso para grande), o que reverte a decisão de 2026-11-04 e é do CEO.
- **No real o grande é campeão sempre:** de 2003 a 2025, os 23 títulos de pontos corridos ficaram com 9 clubes, todos entre os 12 grandes. A faixa de 50% a 90% (85% até 2026-11-06) é meta de diversão, não de realismo.

### Para rever no lote de dezembro

1. Refazer a tabela acima com a final de 2026 (38ª rodada) e medir as duas ordens com a escada vigente, nas sementes 1 a 3 (200) e na semente 1 (1.000, `--robot weakest`), contra as metas vigentes, incluindo "todo clube campeão" e o G4 do robô no mais fraco.
2. Se a média for adotada, decidir junto: se o teto de 90% do campeão grande basta (a média produz de 84% a 89%, a 1 ponto do teto na rodada de 200) e o clube de referência do robô (o Coritibom cai para 65 na ordem 3/2/1; o Tufão, com 70, dá +2,3, no piso da meta de +2 a +8).
3. Pedido ao `developer`, só se aprovada: `strength` pela coluna "Força com a ordem 3/2/1" (refeita com a final); o teste "strength = LADDER[ref − 1]" passa a ler as colunas 2024, 2025 e 2026 da tabela (com "B12 (32)" lido como 32) e confere a média, a ordem com o desempate e `strength = LADDER[ordem − 1]`; e a opção `--clubs <arquivo>` no `/balance`, para medir listas alternativas sem copiar o repositório (com uma cópia idêntica, a saída é a mesma byte a byte; com um arquivo inválido, código 2).

### Variação por carreira: medida, mantida em 1,5 (2026-11-06)

**Decisão do CEO (2026-11-06, item 1):** `generation.clubStrengthSd` fica em 1,5. Medi 1,5, 2,0, 2,5 e 3,0 nas duas ordens (a atual e a 3/2/1), com a escada anterior, em 1.000 temporadas na semente 1 com o robô no mais fraco e em 200 com o `/balance` padrão (as 8 combinações estão em `balance-targets.md`, "Medido: variação por carreira nas duas escadas").

- Em nenhuma das 8 combinações todo clube foi campeão: os dois mais fracos (62 e 63) ficaram com 0 ou 1 título com qualquer `sd`. A variação não muda a distância de 16 pontos entre o 1º e o 20º degrau; o que muda é o fundo da escada, e foi ele que subiu.
- Subir o `sd` custa nas metas raras (com `sd` de 2,0 a 3,0, campeão pequeno de 2,9% a 4,3% e fraco no G4 de 3,4% a 4,8%, contra 2,9% a 3,5% e 5,3% a 5,5% com 1,5), piora o campeão grande na ordem 3/2/1 (até 87,5%) e afasta a força mostrada na escolha do clube da força da lista (o teste de até 4 pontos de `clubs.serie-a.strength.test.ts` deve falhar com 2,5 ou 3,0).

### Fontes

- Série A 2023: [O Povo](https://www.opovo.com.br/esportes/futebol/2023/12/07/tabela-brasileirao-2023-como-ficou-a-classificacao-final.html), [90min](https://www.90min.com/pt-br/posts/a-classificacao-final-do-brasileirao-serie-a-2023-apos-as-38-rodadas), [Wikipédia](https://pt.wikipedia.org/wiki/Campeonato_Brasileiro_de_Futebol_de_2023_-_S%C3%A9rie_A), [CBF](https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-a/2023).
- Série A 2024: [Wikipédia](https://pt.wikipedia.org/wiki/Campeonato_Brasileiro_de_Futebol_de_2024_-_S%C3%A9rie_A), [Bahia Notícias](https://www.bahianoticias.com.br/esportes/noticia/72135-brasileirao-2024-campeao-rebaixados-e-classificacao-final-veja-a-tabela-completa), [Gazeta Esportiva](https://www.gazetaesportiva.com/apostas/noticias/classificacao-do-brasileirao-serie-a-campeao-quem-desceu-artilheiro-e-classificados-para-a-libertadores).
- Série A 2025: [Wikipédia](https://pt.wikipedia.org/wiki/Campeonato_Brasileiro_de_Futebol_de_2025_-_S%C3%A9rie_A), [CBF](https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-a/2025), [API Futebol](https://www.api-futebol.com.br/campeonato/campeonato-brasileiro/2025), [Folha Vitória](https://www.folhavitoria.com.br/esportes/confira-como-ficou-a-tabela-de-classificacao-final-do-brasileirao-2025/).
- Série A 2026, 33ª rodada: [Cassio Zirpoli](https://cassiozirpoli.com.br/a-classificacao-da-serie-a-de-2026-apos-a-33a-rodada-4-pontos-separam-o-12o-do-18o/), [Brasil 247](https://www.brasil247.com/tendencias/2026/11/02/brasileirao-2026-34-rodada/); 34ª rodada parcial (5 de novembro): [Piauí Hoje](https://piauihoje.com/noticias/esportes/brasileirao-2026-flamengo-lidera-com-76-pontos-veja-tabela-470241.html), [Sofutebol](https://www.sofutebol.com.br/classificacao-brasileirao).
- Série B: 2023 ([Wikipédia](https://pt.wikipedia.org/wiki/Campeonato_Brasileiro_de_Futebol_de_2023_-_S%C3%A9rie_B)), 2024 ([Fala Mais](https://falamais.com.br/noticia/5553-classificacao-final-da-serie-b-2024-veja-quem-subiu-para-serie-a), [Wikipédia](https://pt.wikipedia.org/wiki/Campeonato_Brasileiro_de_Futebol_de_2024_-_S%C3%A9rie_B)), 2025 ([Wikipédia](https://pt.wikipedia.org/wiki/Campeonato_Brasileiro_de_Futebol_de_2025_-_S%C3%A9rie_B), [CBF](https://www.cbf.com.br/futebol-brasileiro/tabelas/campeonato-brasileiro/serie-b/2025)).
- Série C: 2023 ([Wikipédia](https://pt.wikipedia.org/wiki/Campeonato_Brasileiro_de_Futebol_de_2023_-_S%C3%A9rie_C)), 2024 ([Wikipédia](https://pt.wikipedia.org/wiki/Campeonato_Brasileiro_de_Futebol_de_2024_-_S%C3%A9rie_C), [2024 Clube do Remo season](https://en.wikipedia.org/wiki/2024_Clube_do_Remo_season)).
- Campeões da era dos pontos corridos: [Valor Final](https://valorfinal.com.br/brasileirao/campeoes), [Trivela](https://trivela.com.br/brasil/campeonato-brasileiro/maior-campeao-pontos-corridos/).
- Limite: as páginas não abrem direto no ambiente; a conferência é pelo texto indexado na busca. A posição final de 2023 do Remo na Série C (11º) só apareceu na Wikipédia.

## Campo novo no `ClubDef` (para o `architect` e o `developer`)

```ts
titles: {
  league: number; // Brasileiro
  cup: number; // Copa do Brasil
  libertadores: number;
  sudamericana: number;
} // histórico até a temporada base; inteiros >= 0
```

- Obrigatório nos 20 clubes (o padrão para clube sem dado é tudo 0).
- É dado estático de `app/src/data/`, como cores e porte; o motor não lê para calcular nada. Títulos ganhos na carreira ficam no estado da carreira (histórico de temporadas), não no `ClubDef`; a interface exibe a soma. Se isso pedir campo novo no save, é ADR do `architect` com migração.
- Libertadores e Sul-Americana entram já como histórico (decisão do CEO), mesmo sem as competições na 1a. Estaduais e outras copas entram como chaves novas quando existirem.

## Pedido ao `developer` (T-003, revisão)

O que muda no código (não aplicado por mim):

1. **`app/src/engine/clubs.ts`:** remover `STRENGTH_RANGE_BY_SIZE` e a checagem "strength dentro da faixa do porte". Regra nova do validador: `strength`, se presente, inteiro entre 55 e 85 (`out-of-range` fora disso), sem relação com `size`. Ausente: 70, com aviso (como já está em `jogadores.md`).
2. **`app/src/data/clubs.serie-a.json`:** `size` e `strength` iguais à tabela acima (12 grandes, 5 médios, 3 pequenos); perfis, capacidade e títulos não mudam.
3. **`app/src/data/clubs.serie-a.test.ts`:**
   - contagem por porte e perfil (ordem `[total, ambitious, traditional, academy, seller, chaotic]`): grande `[12, 4, 4, 3, 1, 0]`, médio `[5, 0, 1, 2, 1, 1]`, pequeno `[3, 0, 1, 0, 2, 0]`;
   - trocar "strength dentro da faixa do porte" por: as 20 forças, ordenadas, são exatamente `LADDER` (na T-003, `[78, 77, 76, 75, 74, 73, 72, 72, 71, 70, 70, 69, 68, 68, 67, 66, 65, 64, 63, 62]`, soma 1.400 e três empates; desde a T-070, a escada de "Força", soma 1.404 e cinco empates); e a ordem de força bate com a coluna "Ref. 2026" (`strength` = `LADDER[ref − 1]`);
   - o teste que lê a tabela deste doc continua igual (colunas `Clube`, `Porte`, `strength`, `aiProfile`, `stadium.capacity`, títulos); o teste que compara `size` com o lote de nomes falha até a coluna "Porte" do lote ser atualizada (ver "Porte").
4. **`/balance`** de 200 temporadas: campeão 72–82 pontos, 17º 39–45 (meta revista pelo CEO em 2026-11-05), ocupação 55%–70% (sem mudança esperada); e imprimir "campeão por porte" e "temporadas com grande rebaixado" pelo porte **e** pelos 6 mais fortes, para a decisão do CEO.
