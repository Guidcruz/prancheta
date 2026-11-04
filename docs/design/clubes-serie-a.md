# Clubes da Série A: força, perfil de IA e capacidade (T-003)

> Mantido pelo `game-designer`. Entrada para `ClubDef` (`docs/02-architecture.md` §4.1): `size`, `strength`, `aiProfile`, `stadium.capacity` e o campo novo proposto `titles`. `strength` segue a regra "Atualização anual e força pela colocação" (decisão do CEO, aplicada já na base 2026). Nomes, cores, siglas e rivais vêm do lote aprovado `docs/content/lotes/2026-11-04-nomes-serie-a.md`. O nome do estádio fica com o `content-writer` (próximo lote); este documento só fixa a capacidade.

**Regra em uma frase:** cada clube recebe uma força-alvo dentro da faixa do seu porte, um perfil de IA que respeita a distribuição padrão por porte, o estádio real em que manda os jogos e um histórico de títulos que espelha o real, só para contar a história.

## Tabela

Títulos = histórico fictício até 2025, espelhando o clube real que inspira cada um (Brasileiro, Copa do Brasil, Libertadores, Sul-Americana). Exceção: Chapecão tem 0 Sul-Americana por decisão do CEO (nenhuma alusão à história do clube real). `strength` = regra "Força pela colocação" (abaixo) aplicada à classificação do Brasileirão 2026 **parcial, 33ª rodada, 2026-11-02**; Ref. 2026 = posição nessa tabela. O lote é refeito com a tabela final depois da 38ª rodada (dezembro de 2026). Capacidade = a do estádio real em que o clube manda os jogos, arredondada para centenas (pedido do CEO: reconhecível).

| #   | Clube            | Porte   | Ref. 2026 | `strength` | `aiProfile`   | `stadium.capacity` | Brasileiro | Copa do Brasil | Libertadores | Sul-Americana | Justificativa curta                                                                                       |
| --- | ---------------- | ------- | --------- | ---------- | ------------- | ------------------ | ---------- | -------------- | ------------ | ------------- | --------------------------------------------------------------------------------------------------------- |
| 1   | Palmeral         | grande  | 2         | 77         | `ambitious`   | 43.700             | 12         | 4              | 3            | 0             | Vice na tabela-referência e maior campeão nacional; arena moderna, não a maior.                           |
| 2   | Flamingo         | grande  | 1         | 78         | `ambitious`   | 78.800             | 8          | 5              | 4            | 0             | Líder da tabela-referência e maior torcida: o favorito; divide com o Fluminário o maior estádio.          |
| 3   | Atlético Minério | grande  | 7         | 76         | `ambitious`   | 44.900             | 3          | 2              | 1            | 0             | Terceiro grande na tabela, briga por G4; arena nova.                                                      |
| 4   | Corinto          | grande  | 17        | 73         | `ambitious`   | 48.900             | 7          | 4              | 1            | 0             | Grande na zona de rebaixamento real: o grande mais fraco, ainda acima de quase todos os médios.           |
| 5   | São Paulão       | grande  | 10        | 75         | `traditional` | 72.000             | 6          | 1              | 3            | 1             | Meio de tabela; grande que muda pouco e aposta em experientes; estádio antigo e grande.                   |
| 6   | Grêmeos          | grande  | 15        | 74         | `traditional` | 55.700             | 2          | 5              | 3            | 0             | Temporada ruim, copeiro (5 Copas); arena grande no Sul.                                                   |
| 7   | Cruzador         | médio   | 3         | 72         | `traditional` | 61.900             | 4          | 6              | 2            | 0             | Terceiro da tabela, médio forte; maior campeão da Copa, torcida de grande.                                |
| 8   | Botafogueira     | médio   | 12        | 69         | `seller`      | 44.700             | 3          | 0              | 1            | 0             | Temporada fraca depois de anos fortes; investe e vende caro.                                              |
| 9   | Inter-Regional   | médio   | 18        | 68         | `academy`     | 50.800             | 3          | 1              | 2            | 1             | Zona de rebaixamento real: o médio mais fraco; base que vende jovens.                                     |
| 10  | Fluminário       | médio   | 4         | 72         | `academy`     | 78.800             | 4          | 1              | 1            | 0             | Quarto da tabela, médio forte; base que revela e vende; divide o maior estádio com o Flamingo.            |
| 11  | Tufão            | médio   | 5         | 71         | `seller`      | 42.400             | 1          | 1              | 0            | 2             | Quinto da tabela; clube-empresa que compra barato e vende caro; arena moderna.                            |
| 12  | Baião            | médio   | 6         | 70         | `traditional` | 48.700             | 2          | 0              | 0            | 0             | Maior do Nordeste na lista, perto do G6; arena grande (fontes 47.400–50.000, média).                      |
| 13  | Vasconcelos      | médio   | 13        | 68         | `traditional` | 21.700             | 4          | 1              | 1            | 0             | Gigante de torcida em fase fraca; estádio próprio pequeno e apertado.                                     |
| 14  | Santões          | médio   | 8         | 70         | `academy`     | 16.100             | 8          | 1              | 3            | 0             | Muitos títulos, meio de tabela; a base é a identidade; o menor estádio entre os médios.                   |
| 15  | Bragantão        | pequeno | 9         | 67         | `seller`      | 12.000             | 0          | 0              | 0            | 0             | Pequeno mais bem colocado: projeto que vende bem e reinveste; estádio de interior.                        |
| 16  | Miragol          | pequeno | 16        | 64         | `seller`      | 15.000             | 0          | 0              | 0            | 0             | Interior organizado, temporada difícil; vende quem se destaca.                                            |
| 17  | Vitorioso        | pequeno | 14        | 65         | `chaotic`     | 35.600             | 0          | 0              | 0            | 0             | Pequeno de torcida grande e diretoria inquieta: o caótico da liga.                                        |
| 18  | Coritibom        | pequeno | 11        | 66         | `academy`     | 40.500             | 1          | 0              | 0            | 0             | Pequeno de torcida grande, campeão uma vez, meio de tabela; estádio maior que o porte.                    |
| 19  | Chapecão         | pequeno | 20        | 62         | `traditional` | 21.600             | 0          | 0              | 0            | 0             | Lanterna da tabela-referência; elenco estável (decisão 5 do CEO: nada de história); fontes 20.600–22.600. |
| 20  | Remador          | pequeno | 19        | 63         | `academy`     | 53.600             | 0          | 0              | 0            | 0             | Penúltimo na tabela; manda no estádio estadual grande (ver "Capacidade").                                 |

## Regras gerais

### Escada de força

- **Os valores são exatamente a escada padrão por porte de `jogadores.md`** (78 a 73; 72, 72, 71, 70, 70, 69, 68, 68; 67 a 62). A ordem dentro de cada porte vem da colocação na tabela real ("Atualização anual e força pela colocação"). A soma e a forma da escada são as que o protótipo validou (campeão 73,7 pontos, 17º com 40,7), então nenhuma métrica de `balance-targets.md` muda; muda só quem tende a ocupar cada posição.
- **Degrau de 1 ponto dentro do porte, com sobreposição na fronteira.** O grande mais fraco (73) fica a 1 ponto dos médios fortes (72) e o pequeno mais forte (67) a 1 ponto dos médios mais fracos (68). Com `generation.clubStrengthSd = 1,5`, Cruzador ou Fluminário terminam acima de Corinto em boa parte das carreiras, e Bragantão às vezes passa Inter-Regional: o porte guia a meta da diretoria, não trava a tabela.
- **Dois favoritos claros (Flamingo 78, Palmeral 77)**, como na tabela real. A diferença de 5 pontos entre o 1º e o 6º grande garante que "ser grande" não é garantia de G4.
- **Clássicos com porte diferente dão azarão:** Clássico do Minério (76 × 72) e Gêm-Reg (74 × 68) têm favorito; Flami-Flumi (78 × 72) e Majestosão (73 × 75) são mais parelhos do que o nome sugere.

### Distribuição de perfis

Segue exatamente o padrão por porte de `ia-clubes.md` (nenhum sorteio necessário, porque a lista traz o perfil):

| Porte   | `ambitious` | `traditional` | `academy` | `seller` | `chaotic` |
| ------- | ----------- | ------------- | --------- | -------- | --------- |
| Grande  | 4           | 2             | 0         | 0        | 0         |
| Médio   | 0           | 3             | 3         | 2        | 0         |
| Pequeno | 0           | 1             | 2         | 2        | 1         |
| Total   | 4           | 6             | 5         | 4        | 1         |

- Os quatro favoritos jogam ofensivos (`ambitious`); os dois grandes `traditional` dão grandes mais previsíveis e mais vulneráveis fora de casa.
- Um único `chaotic` na liga: o suficiente para haver um time imprevisível, não tanto que a tabela vire sorteio.
- Na 1a o perfil só afeta formação, postura, pressão e intervalo; mercado e paciência (`seller`, `academy` vendendo jovens, `chaotic` trocando técnico) entram nas Etapas 3 a 5 e já ficam coerentes com esta escolha.

### Capacidade

- **Igual à real, arredondada para centenas** (pedido do CEO). Onde as fontes divergem (Baião, Chapecão), uso a média da faixa. Flamingo e Fluminário dividem o mesmo estádio e têm a mesma capacidade, 78.800; o `content-writer` deve dar o mesmo nome de estádio aos dois.
- **Remador: 53.600 (o estádio estadual), não o estádio próprio.** Não há dado confiável do estádio próprio, o clube real manda os jogos grandes no estadual e tem uma das maiores médias de público do país; um estádio pequeno o deixaria irreconhecível. Na 1a o público é só exibido, então o custo é zero. Reavaliar na Etapa 3, quando a bilheteria entrar: um pequeno com 53.600 lugares pode ganhar receita de médio.
- **Ocupação média continua na meta.** A fórmula de `torcida.md` é proporcional à capacidade: `ocupação = clamp(fans.baseOccupancy × demanda × clássico, 0,10, 1,00)`, e a capacidade não entra no fator. Com `fans.baseOccupancy = 0,62` e termômetro médio 55 (demanda 0,985), a ocupação é 61% em todo estádio e em todo porte, dentro da meta de 55% a 70% de `balance-targets.md`. **Nenhum parâmetro muda.**
- **Efeito colateral (só exibição na 1a):** com 61% de ocupação, Fluminário (médio) mostra cerca de 48.000 por jogo e Remador (pequeno) cerca de 32.700, mais que a média dos grandes Palmeral (26.700) e Atlético Minério (27.400). Para a 1a isso é aceitável e até reconhecível. Se na Etapa 3 a bilheteria precisar de público por porte, a correção será uma demanda por porte em `torcida.md` (ADR-0005), não mudar a capacidade.
- Médias por porte: grande 57.300, médio 45.600, pequeno 29.700. Os padrões de `torcida.md` (45.000 / 30.000 / 15.000) continuam valendo só para clube sem capacidade na lista.

### Títulos (histórico fictício)

- **Espelham os reais até 2025**, um a um, para o clube ser reconhecível pela história além do nome e das cores. São do clube fictício; nenhum texto menciona o clube real.
- **Para que servem na 1a (só conteúdo, sem efeito no motor):** notícias e fichas ("o maior campeão do país", "o maior campeão da Copa", "em busca do primeiro título"), apresentação do clube na escolha da carreira e nas cerimônias de título ("13º Brasileiro"), e os comentários de expectativa da torcida em templates. O título conquistado na carreira soma ao histórico na exibição.
- **Não pesam em porte, `strength` nem `aiProfile`.** Título conta o passado; `strength` é o elenco de agora, porte é o orçamento e a torcida de agora (lote aprovado pelo CEO), perfil é o jeito de gerir. Misturar faria o Santões (8 Brasileiros, fase fraca) virar favorito e apagaria a história de "gigante em crise", que é boa para o jogo.
- **Títulos não reordenam a escada:** quem ordena é a colocação na tabela real. Santões (8 Brasileiros) segue médio; mudar o porte dele seria mudar o lote aprovado, decisão do CEO.
- **Continentais:** 12 clubes têm Libertadores (Flamingo é o maior, com 4); Tufão é o maior da Sul-Americana (2). Servem às mesmas notícias ("tetracampeão da América") e a nenhuma conta.
- **Cinco clubes sem título** (Bragantão, Miragol, Vitorioso, Chapecão, Remador): cinco histórias possíveis de "primeiro título da história".

## Atualização anual e força pela colocação (regra do CEO, aplicada na base 2026)

**Regra em uma frase:** uma vez por ano o lote de clubes é atualizado para quem começa um jogo novo, e a escada de força de cada porte é reordenada pela colocação final do último campeonato real: quem terminou melhor recebe o degrau mais alto do seu porte.

### O que muda no lote anual

| Dado                    | Muda?                 | Como                                                                              |
| ----------------------- | --------------------- | --------------------------------------------------------------------------------- |
| `titles`                | sim                   | soma os títulos reais da temporada encerrada                                      |
| `stadium.capacity`      | sim, se mudou         | capacidade real arredondada para centenas                                         |
| Quem está em cada série | sim                   | 4 rebaixados saem, 4 que subiram entram (vindos da lista reserva ou de lote novo) |
| `strength`              | sim                   | reordenação da escada (abaixo)                                                    |
| `size` (porte)          | só por decisão do CEO | o lote anual propõe; não muda por fórmula                                         |
| `aiProfile`             | não, por padrão       | mantém; troca só com justificativa no lote (clube vendido, mudança de gestão)     |
| Carreiras já começadas  | não                   | o save leva os seus `ClubDef`; o lote novo vale só para jogo novo                 |

### Fórmula da força

1. **Colocação de referência** de cada clube da Série A da temporada nova: a posição na Série A real mais recente (1 a 16 para quem ficou, porque os 4 últimos caíram). Quem subiu recebe `20 + posição na Série B` (21 a 24): sempre atrás de quem ficou. **Exceção da base 2026:** os 20 clubes já estão na Série A 2026, então a referência é a posição atual na tabela de 2026 (1 a 20) para todos.
2. **Dentro de cada porte**, ordena os clubes pela colocação de referência (melhor primeiro).
3. **Atribui a escada fixa do porte nessa ordem:** grande 78, 77, 76, 75, 74, 73; médio 72, 72, 71, 70, 70, 69, 68, 68; pequeno 67, 66, 65, 64, 63, 62 (`jogadores.md`).
4. Se o número de clubes por porte mudar (ex.: 7 médios e 5 pequenos depois de acesso), a escada do porte é a padrão cortada ou estendida no degrau mais fraco, sempre dentro da faixa (grande 73–78, médio 67–72, pequeno 62–67); um 7º grande recebe 73.

```
reference(club) = previousSerieAPosition            // 1..16 (base 2026: posição atual, 1..20)
               ?? 20 + previousSerieBPosition       // 21..24 para quem subiu
strength(club) = LADDER[size][rank of reference(club) among clubs of same size]
```

**Por que assim:** a escada continua a mesma, então a soma das forças e as metas de `balance-targets.md` (pontos do campeão e do 17º, zebra) não mudam com a atualização: nenhum `/balance` novo é obrigatório. A colocação pesa até 5 pontos dentro do porte (do 1º ao 6º grande), que é a diferença entre favorito e candidato a G4. Não é uma fórmula contínua (pontos ou posição convertidos em força) porque ela empurraria clubes para fora da faixa e mexeria na escada validada; ordenar é uma frase e o jogador reconhece ("o campeão do ano passado é o favorito"). O porte não muda por fórmula porque porte é torcida e orçamento, e uma temporada boa não muda isso; quando muda (um pequeno que se firma), é decisão do CEO no lote anual.

**Parâmetros:** nenhum novo. A escada é constante (`jogadores.md`).

### Exemplo numérico

Médios em uma temporada hipotética: A terminou 3º, B 5º, C 9º, D 12º, E 14º, F 16º, G subiu como 1º da B (referência 21), H subiu como 3º da B (23). Força: A 72, B 72, C 71, D 70, E 70, F 69, G 68, H 68. Se no ano seguinte F terminar 2º, ele passa a 72 e quem ficar atrás desce um degrau.

### Casos de borda

| Caso                                                     | Regra                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Empate de referência (impossível na Série A)             | dois que subiram com a mesma posição não existem; se faltar dado, desempata pelo `id` |
| Clube sem colocação conhecida (lote novo, dado faltando) | referência 25 (último do porte)                                                       |
| Campeão da Série A num porte pequeno                     | recebe 67, o teto do porte; o lote anual deve propor ao CEO subir o porte             |
| Temporada real em andamento (caso da base 2026)          | usa a tabela parcial mais recente, com data e rodada no doc; refaz com a final        |
| Empate de pontos na tabela real                          | vale a posição oficial (critérios de desempate da competição)                         |

### Aplicação na base 2026

Tabela usada: Brasileirão 2026, **parcial, 33ª rodada, 2026-11-02** (pesquisada pelo Orquestrador): 1 Flamengo, 2 Palmeiras, 3 Cruzeiro, 4 Fluminense, 5 Athletico-PR, 6 Bahia, 7 Atlético-MG, 8 Santos, 9 Bragantino, 10 São Paulo, 11 Coritiba, 12 Botafogo, 13 Vasco (um jogo a menos), 14 Vitória, 15 Grêmio, 16 Mirassol, 17 Corinthians, 18 Internacional, 19 Remo, 20 Chapecoense. **O lote é refeito com a tabela final depois da 38ª rodada (dezembro de 2026).**

| Porte   | Ordem (posição) → `strength`                                                                                                                      |
| ------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Grande  | Flamingo (1) 78, Palmeral (2) 77, Atlético Minério (7) 76, São Paulão (10) 75, Grêmeos (15) 74, Corinto (17) 73                                   |
| Médio   | Cruzador (3) 72, Fluminário (4) 72, Tufão (5) 71, Baião (6) 70, Santões (8) 70, Botafogueira (12) 69, Vasconcelos (13) 68, Inter-Regional (18) 68 |
| Pequeno | Bragantão (9) 67, Coritibom (11) 66, Vitorioso (14) 65, Miragol (16) 64, Remador (19) 63, Chapecão (20) 62                                        |

- **Pontos instáveis:** Bragantino tem 44 ou 47 conforme a fonte (não muda a ordem entre pequenos); Vasco e Vitória empatam em 38, mas estão em portes diferentes (sem efeito). Até a 38ª, qualquer troca de posição dentro do mesmo porte troca no máximo um degrau.
- Soma e forma da escada iguais à validada: nenhuma mudança prevista nas métricas de `balance-targets.md`; não há `/balance` obrigatório.

### Revisão de porte sugerida pela tabela (proposta ao CEO, não aplicada)

| Clube          | Porte   | Posição | Leitura                                                          | Proposta                                                                                                       |
| -------------- | ------- | ------- | ---------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- |
| Corinto        | grande  | 17      | grande em crise; com a escada, ainda 73, acima de 6 dos 8 médios | **manter grande.** O grande na zona de rebaixamento, com meta de G4 e diretoria impaciente, é uma boa história |
| Tufão          | médio   | 5       | médio no G6; 71, a 2 pontos do grande mais fraco                 | **manter médio** por ora; rever com a tabela final. Uma temporada boa não muda torcida e orçamento             |
| Inter-Regional | médio   | 18      | médio na zona; 68                                                | manter médio                                                                                                   |
| Coritibom      | pequeno | 11      | pequeno à frente de 3 médios; 66                                 | manter pequeno; candidato a médio se repetir em 2027                                                           |
| Bragantão      | pequeno | 9       | o pequeno mais bem colocado; já no teto (67)                     | manter pequeno; candidato a médio se terminar no G8 também em 2027                                             |

Critério que proponho para o lote anual (decisão do CEO): sugerir mudança de porte só quando a colocação contradiz o porte **em duas temporadas seguidas** (grande fora dos 12 primeiros, médio no G4 ou no Z4, pequeno no G8). Nenhum clube cumpre isso hoje, porque só temos uma temporada medida.

## Casos de borda

| Caso                                                             | Regra                                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `strength` fora da faixa do porte                                | dado inválido: o carregador de `app/src/data/` recusa (faixas de `jogadores.md`)           |
| `aiProfile` ausente                                              | sorteio por porte com a semente da carreira (`ia-clubes.md`); nesta lista não ocorre       |
| `stadium.capacity` ausente                                       | padrão por porte de `torcida.md`; nesta lista não ocorre                                   |
| Clube da lista reserva sobe da Série B                           | entra no lote anual com referência 21–24 (ver "Atualização anual")                         |
| Dois clubes com a mesma `strength` (72/72, 70/70, 68/68)         | válido; a variação por carreira (`clubStrengthSd`) desempata                               |
| Clube com `rivals` vazio (Bragantão, Miragol, Chapecão, Remador) | sem efeito nesta tabela; o multiplicador de clássico do público simplesmente não se aplica |

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

## Pedido ao `developer` (T-003)

Gravar `strength`, `aiProfile`, `stadium.capacity` e `titles` nos `ClubDef` de `app/src/data/`. Aceite: os 20 clubes iguais a esta tabela; teste que confere que cada `strength` está na faixa do seu porte, que a contagem de perfis por porte bate com a tabela "Distribuição de perfis", que Flamingo e Fluminário têm a mesma capacidade e que `titles` tem inteiros >= 0; `/balance` de 200 temporadas com campeão entre 72 e 82 pontos, 17º entre 40 e 46 e ocupação média por porte entre 55% e 70% (`balance-targets.md`).
