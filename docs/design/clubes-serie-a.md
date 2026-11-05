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

Ordem e `strength` pela classificação do Brasileirão 2026 **parcial, 33ª rodada, 2026-11-02** (Ref. 2026 = posição nessa tabela). **O lote é refeito com a tabela final depois da 38ª rodada (dezembro de 2026).** Títulos = histórico fictício até 2025, espelhando o clube real (Chapecão tem 0 Sul-Americana por decisão do CEO: nenhuma alusão à história do clube real). Capacidade = a do estádio real em que o clube manda os jogos, arredondada para centenas.

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
| 18  | Inter-Regional   | grande  | 18        | 64         | `academy`     | 50.800             | 3          | 1              | 2            | 1             | Grande: 3 Brasileiros, 2 Libertadores. 18º: grande na zona de rebaixamento.                         |
| 19  | Remador          | médio   | 19        | 63         | `academy`     | 53.600             | 0          | 0              | 0            | 0             | Médio: sem títulos nacionais, mas torcida regional enorme (estádio estadual). 19º.                  |
| 20  | Chapecão         | pequeno | 20        | 62         | `traditional` | 21.600             | 0          | 0              | 0            | 0             | Pequeno: sem títulos (decisão 5 do CEO), cidade pequena. Lanterna.                                  |

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

**Escada única de 20 degraus, a mesma que já existia:** 78, 77, 76, 75, 74, 73, 72, 72, 71, 70, 70, 69, 68, 68, 67, 66, 65, 64, 63, 62 (soma 1.400). O 1º da tabela de referência recebe 78, o 2º 77, e assim por diante; o porte não entra. Como os valores e a soma são os mesmos, a distribuição de forças da liga é a validada no protótipo (campeão 73,7 pontos, 17º com 40,7) e as metas de pontos de `balance-targets.md` não mudam.

```
strength(club) = LADDER[reference(club) - 1]
LADDER = [78, 77, 76, 75, 74, 73, 72, 72, 71, 70, 70, 69, 68, 68, 67, 66, 65, 64, 63, 62]
reference(club) = posição na tabela de referência (1..20)
```

- Empates previstos (72/72, 70/70, 68/68) são parte da escada; a variação por carreira (`generation.clubStrengthSd = 1,5`) desempata.
- **Consequências que o CEO pediu:** Corinto (17º) tem 65 e Inter-Regional (18º) 64, abaixo de Bragantão (71) e Coritibom (70). Tufão (5º) e Baião (6º), médios, são o 5º e o 6º mais fortes.

### Impacto previsto nas metas (precisa do `/balance` do motor)

Sem o motor de partida, estimei com um modelo simplificado (Poisson, mando +4, 300 temporadas, `clubStrengthSd = 1,5`): serve para a direção da mudança, não para o número.

| Métrica (`balance-targets.md`)              | Meta          | Antes (6/8/6, escada por porte) | Depois (12/5/3, escada única) | Leitura                                         |
| ------------------------------------------- | ------------- | ------------------------------- | ----------------------------- | ----------------------------------------------- |
| Pontos do campeão / do 17º                  | 72–82 / 39–45 | sem mudança                     | sem mudança                   | mesma escada                                    |
| Campeão por porte: grande                   | 50%–85%       | ~92% no modelo                  | ~87% no modelo                | cai um pouco; o modelo exagera os dois          |
| Campeão por porte: pequeno                  | 0,5%–3%       | 0%                              | ~1%                           | Bragantão (71) às vezes ganha                   |
| Temporadas com ao menos um grande rebaixado | 40%–80%       | ~4%                             | **~97%**                      | acima da meta no modelo; conferir no `/balance` |

**Decidido pelo CEO (2026-11-04):** "temporadas com ao menos um grande rebaixado" passa a 40% a 80% e "campeão é grande" a 50% a 85% (`balance-targets.md`). Pequeno ou médio campeão: raro, mas possível (tática, zebra, jovens; mercado e estrutura na Etapa 3). O `/balance` reporta as métricas pelo porte e, para comparação, pelos 6 mais fortes.

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
   - trocar "strength dentro da faixa do porte" por: as 20 forças, ordenadas, são exatamente `LADDER` (`[78, 77, 76, 75, 74, 73, 72, 72, 71, 70, 70, 69, 68, 68, 67, 66, 65, 64, 63, 62]`), ou seja, soma 1.400 e só os três empates previstos; e a ordem de força bate com a coluna "Ref. 2026" (`strength` = `LADDER[ref − 1]`);
   - o teste que lê a tabela deste doc continua igual (colunas `Clube`, `Porte`, `strength`, `aiProfile`, `stadium.capacity`, títulos); o teste que compara `size` com o lote de nomes falha até a coluna "Porte" do lote ser atualizada (ver "Porte").
4. **`/balance`** de 200 temporadas: campeão 72–82 pontos, 17º 39–45 (meta revista pelo CEO em 2026-11-05), ocupação 55%–70% (sem mudança esperada); e imprimir "campeão por porte" e "temporadas com grande rebaixado" pelo porte **e** pelos 6 mais fortes, para a decisão do CEO.
