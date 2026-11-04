# Clubes da Série A: força, perfil de IA e capacidade (T-003)

> Mantido pelo `game-designer`. Entrada para `ClubDef` (`docs/02-architecture.md` §4.1): `size`, `strength`, `aiProfile`, `stadium.capacity` e o campo novo proposto `titles`. Quando o CEO aprovar a aplicação (já na base 2026 ou só no lote de 2027), `strength` passa a seguir a regra "Atualização anual" abaixo. Nomes, cores, siglas e rivais vêm do lote aprovado `docs/content/lotes/2026-11-04-nomes-serie-a.md`. O nome do estádio fica com o `content-writer` (próximo lote); este documento só fixa a capacidade.

**Regra em uma frase:** cada clube recebe uma força-alvo dentro da faixa do seu porte, um perfil de IA que respeita a distribuição padrão por porte, o estádio real em que manda os jogos e um histórico de títulos que espelha o real, só para contar a história.

## Tabela

Títulos = histórico fictício até 2025, espelhando o clube real que inspira cada um (Brasileiro, Copa do Brasil, Libertadores, Sul-Americana). Exceção: Chapecão tem 0 Sul-Americana por decisão do CEO (nenhuma alusão à história do clube real). Capacidade = a do estádio real em que o clube manda os jogos, arredondada para centenas (pedido do CEO: reconhecível).

| #   | Clube            | Porte   | `strength` | `aiProfile`   | `stadium.capacity` | Brasileiro | Copa do Brasil | Libertadores | Sul-Americana | Justificativa curta                                                                                 |
| --- | ---------------- | ------- | ---------- | ------------- | ------------------ | ---------- | -------------- | ------------ | ------------- | --------------------------------------------------------------------------------------------------- |
| 1   | Palmeral         | grande  | 78         | `ambitious`   | 43.700             | 12         | 4              | 3            | 0             | Favorito e maior campeão nacional; arena moderna, não a maior.                                      |
| 2   | Flamingo         | grande  | 77         | `ambitious`   | 78.800             | 8          | 5              | 4            | 0             | Segundo favorito e maior torcida; divide com o Fluminário o maior estádio do jogo.                  |
| 3   | Atlético Minério | grande  | 76         | `ambitious`   | 44.900             | 3          | 2              | 1            | 0             | Terceira força, briga por título; arena nova.                                                       |
| 4   | Corinto          | grande  | 75         | `ambitious`   | 48.900             | 7          | 4              | 1            | 0             | Torcida enorme, elenco um degrau abaixo: candidato a G4 que às vezes briga pelo topo.               |
| 5   | São Paulão       | grande  | 74         | `traditional` | 72.000             | 6          | 1              | 3            | 1             | Grande que muda pouco e aposta em experientes; estádio antigo e grande.                             |
| 6   | Grêmeos          | grande  | 73         | `traditional` | 55.700             | 2          | 5              | 3            | 0             | Grande mais fraco na liga, copeiro (5 Copas); arena grande no Sul.                                  |
| 7   | Cruzador         | médio   | 72         | `traditional` | 61.900             | 4          | 6              | 2            | 0             | Médio forte (lote), maior campeão da Copa; torcida de grande, elenco experiente.                    |
| 8   | Botafogueira     | médio   | 72         | `seller`      | 44.700             | 3          | 0              | 1            | 0             | Médio forte (lote): investe e vende caro; força que ameaça os grandes.                              |
| 9   | Inter-Regional   | médio   | 71         | `academy`     | 50.800             | 3          | 1              | 2            | 1             | Médio forte (lote, decisão 3 do CEO): base forte que vende jovens.                                  |
| 10  | Fluminário       | médio   | 70         | `academy`     | 78.800             | 4          | 1              | 1            | 0             | Base tradicional que revela e vende; divide o maior estádio com o Flamingo.                         |
| 11  | Tufão            | médio   | 70         | `seller`      | 42.400             | 1          | 1              | 0            | 2             | Clube-empresa que compra barato e vende caro; arena moderna.                                        |
| 12  | Baião            | médio   | 69         | `traditional` | 48.700             | 2          | 0              | 0            | 0             | Maior do Nordeste na lista, elenco estável; arena grande (fontes 47.400–50.000, média).             |
| 13  | Vasconcelos      | médio   | 68         | `traditional` | 21.700             | 4          | 1              | 1            | 0             | Gigante de torcida em fase fraca; estádio próprio pequeno e apertado.                               |
| 14  | Santões          | médio   | 68         | `academy`     | 16.100             | 8          | 1              | 3            | 0             | Muitos títulos, fase fraca; a base é a identidade; o menor estádio entre os médios.                 |
| 15  | Bragantão        | pequeno | 67         | `seller`      | 12.000             | 0          | 0              | 0            | 0             | Pequeno mais forte: projeto que vende bem e reinveste; estádio de interior reinaugurado.            |
| 16  | Miragol          | pequeno | 66         | `seller`      | 15.000             | 0          | 0              | 0            | 0             | Interior organizado, vende quem se destaca.                                                         |
| 17  | Vitorioso        | pequeno | 65         | `chaotic`     | 35.600             | 0          | 0              | 0            | 0             | Pequeno de torcida grande e diretoria inquieta: o caótico da liga.                                  |
| 18  | Coritibom        | pequeno | 64         | `academy`     | 40.500             | 1          | 0              | 0            | 0             | Pequeno de torcida grande, campeão uma vez, vive da base; estádio maior que o porte.                |
| 19  | Chapecão         | pequeno | 63         | `traditional` | 21.600             | 0          | 0              | 0            | 0             | Elenco estável e sem sobressalto (decisão 5 do CEO: nada de história); fontes 20.600–22.600, média. |
| 20  | Remador          | pequeno | 62         | `academy`     | 53.600             | 0          | 0              | 0            | 0             | O mais fraco no papel; manda no estádio estadual grande (ver "Capacidade").                         |

## Regras gerais

### Escada de força

- **Os valores são exatamente a escada padrão por porte de `jogadores.md`** (78 a 73; 72, 72, 71, 70, 70, 69, 68, 68; 67 a 62). Só escolhi qual clube fica em qual degrau. A soma e a forma da escada são as que o protótipo validou (campeão 73,7 pontos, 17º com 40,7), então esta tabela não muda nenhuma métrica de `balance-targets.md`; muda só quem tende a ocupar cada posição.
- **Degrau de 1 ponto dentro do porte, com sobreposição na fronteira.** O grande mais fraco (73) fica a 1 ponto dos dois médios fortes (72) e o pequeno mais forte (67) a 1 ponto dos médios mais fracos (68). Com `generation.clubStrengthSd = 1,5`, Cruzador ou Botafogueira terminam acima de Grêmeos em boa parte das carreiras, e Bragantão às vezes passa Santões: o porte guia a meta da diretoria, não trava a tabela.
- **Dois favoritos claros (Palmeral 78, Flamingo 77) e um terceiro (Atlético Minério 76)**, como o lote sugere. A diferença de 5 pontos entre o 1º e o 6º grande garante que "ser grande" não é garantia de G4.
- **Clássicos com porte diferente dão azarão:** Gêm-Reg (73 × 71) e Clássico do Minério (76 × 72) são quase parelhos; Flami-Flumi (77 × 70) e Clássico dos Bilhões (77 × 68) têm favorito, mas a zebra existe (meta de zebra em `balance-targets.md`).
- **Os "pequenos de torcida grande" (Coritibom, Vitorioso) não são os pequenos mais fortes:** a força vem do elenco, a torcida aparece no estádio. Isso separa as duas coisas e dá ao jogador um pequeno com casa cheia e elenco fraco.

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
- **Escada revisada contra os títulos, sem mudança:** Santões fica médio 68 (muitos títulos, momento fraco, como o Vasconcelos); Cruzador (4/6) já é o médio mais forte; Grêmeos (2/5) segue o grande mais fraco porque o porte vem da torcida e do orçamento, e a Copa reforça só o rótulo de copeiro nas notícias; Botafogueira (3/0) segue médio forte pelo elenco atual. Mudar porte do Santões seria mudar o lote aprovado: decisão do CEO, não minha.
- **Continentais:** 12 clubes têm Libertadores (Flamingo é o maior, com 4); Tufão é o maior da Sul-Americana (2). Servem às mesmas notícias ("tetracampeão da América") e a nenhuma conta.
- **Cinco clubes sem título** (Bragantão, Miragol, Vitorioso, Chapecão, Remador): cinco histórias possíveis de "primeiro título da história".

## Atualização anual e força pela colocação (regra do CEO, ainda não aplicada)

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

1. **Colocação de referência** de cada clube da Série A da temporada nova: a posição final na Série A real anterior (1 a 16, porque os 4 últimos caíram). Quem subiu recebe `20 + posição na Série B` (21 a 24): sempre atrás de quem ficou.
2. **Dentro de cada porte**, ordena os clubes pela colocação de referência (melhor primeiro).
3. **Atribui a escada fixa do porte nessa ordem:** grande 78, 77, 76, 75, 74, 73; médio 72, 72, 71, 70, 70, 69, 68, 68; pequeno 67, 66, 65, 64, 63, 62 (`jogadores.md`).
4. Se o número de clubes por porte mudar (ex.: 7 médios e 5 pequenos depois de acesso), a escada do porte é a padrão cortada ou estendida no degrau mais fraco, sempre dentro da faixa (grande 73–78, médio 67–72, pequeno 62–67); um 7º grande recebe 73.

```
reference(club) = previousSerieAPosition            // 1..16
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
| Temporada real atípica (campeonato não terminado)        | mantém a ordem do ano anterior                                                        |

### Impacto previsto na temporada base 2026 (referência: Brasileirão 2025)

Classificação final do Brasileirão 2025 (pesquisada pelo Orquestrador): 1 Flamengo, 2 Palmeiras, 3 Cruzeiro, 4 Mirassol, 5 Fluminense, 6 Botafogo, 7 Bahia, 8 São Paulo, 9 Grêmio, 10 Bragantino, 11 Atlético-MG, 12 Santos, 13 Corinthians, 14 Internacional e 16 Vasco (**a confirmar**: as fontes não fecham a ordem), 15 Vitória; caíram Ceará, Fortaleza, Juventude e Sport. Subiram da Série B: Coritiba (campeão, referência 21), Athletico-PR, Chapecoense e Remo (**ordem a confirmar**; uso 22, 23, 24 nessa ordem). Nada foi aplicado na tabela.

| Clube            | Porte   | Referência       | Hoje | Com a regra | Δ   |
| ---------------- | ------- | ---------------- | ---- | ----------- | --- |
| Flamingo         | grande  | 1                | 77   | 78          | +1  |
| Palmeral         | grande  | 2                | 78   | 77          | −1  |
| São Paulão       | grande  | 8                | 74   | 76          | +2  |
| Grêmeos          | grande  | 9                | 73   | 75          | +2  |
| Atlético Minério | grande  | 11               | 76   | 74          | −2  |
| Corinto          | grande  | 13               | 75   | 73          | −2  |
| Cruzador         | médio   | 3                | 72   | 72          | 0   |
| Fluminário       | médio   | 5                | 70   | 72          | +2  |
| Botafogueira     | médio   | 6                | 72   | 71          | −1  |
| Baião            | médio   | 7                | 69   | 70          | +1  |
| Santões          | médio   | 12               | 68   | 70          | +2  |
| Inter-Regional   | médio   | 14 (a confirmar) | 71   | 69          | −2  |
| Vasconcelos      | médio   | 16 (a confirmar) | 68   | 68          | 0   |
| Tufão            | médio   | 22 (a confirmar) | 70   | 68          | −2  |
| Miragol          | pequeno | 4                | 66   | 67          | +1  |
| Bragantão        | pequeno | 10               | 67   | 66          | −1  |
| Vitorioso        | pequeno | 15               | 65   | 65          | 0   |
| Coritibom        | pequeno | 21               | 64   | 64          | 0   |
| Chapecão         | pequeno | 23 (a confirmar) | 63   | 63          | 0   |
| Remador          | pequeno | 24 (a confirmar) | 62   | 62          | 0   |

- Se Vasco tiver terminado à frente do Internacional, os dois trocam (Vasconcelos 69, Inter-Regional 68). Se Remo tiver subido à frente da Chapecoense, Remador 63 e Chapecão 62. A posição do Athletico-PR na Série B não muda nada, porque ele é o único médio que subiu.
- Soma e forma da escada iguais: nenhuma mudança prevista nas métricas de `balance-targets.md`.
- Maiores efeitos: Inter-Regional deixa de ser "médio forte" (contraria a sugestão do lote); Atlético Minério e Corinto vão para o fim dos grandes; Fluminário e Santões sobem 2. Miragol (4º em 2025) vira o pequeno mais forte, e pelo caso de borda o lote anual deveria propor ao CEO discutir o porte dele.
- Com a ordem confirmada e o ok do CEO, a coluna `strength` de "Tabela" passa a ser a coluna "Com a regra".

## Casos de borda

| Caso                                                     | Regra                                                                                 |
| -------------------------------------------------------- | ------------------------------------------------------------------------------------- |
| Empate de referência (impossível na Série A)             | dois que subiram com a mesma posição não existem; se faltar dado, desempata pelo `id` |
| Clube sem colocação conhecida (lote novo, dado faltando) | referência 25 (último do porte)                                                       |
| Campeão da Série A num porte pequeno                     | recebe 67, o teto do porte; o lote anual deve propor ao CEO subir o porte             |
| Temporada real atípica (campeonato não terminado)        | mantém a ordem do ano anterior                                                        |

### Impacto previsto na temporada base 2026 (referência: Brasileirão 2025)

**Precisa de conferência do Orquestrador:** a classificação final do Brasileirão 2025 e as posições da Série B 2025 de Coritiba, Athletico-PR, Chapecoense e Remo. Uso abaixo a ordem que conheço, que pode ter erros; nada foi aplicado na tabela.

Ordem usada: Flamengo 1º, Palmeiras 2º, Cruzeiro 3º, Mirassol 4º, Fluminense 5º, Botafogo 6º, Bahia 7º, São Paulo 8º, Grêmio 9º, Bragantino 10º, Atlético-MG 11º, Santos 12º, Corinthians 13º, Vasco 14º, Vitória 15º, Internacional 16º; da Série B, Coritiba, Athletico-PR, Chapecoense e Remo, nessa ordem.

| Clube            | Porte   | Hoje | Com a regra | Δ   |
| ---------------- | ------- | ---- | ----------- | --- |
| Flamingo         | grande  | 77   | 78          | +1  |
| Palmeral         | grande  | 78   | 77          | −1  |
| São Paulão       | grande  | 74   | 76          | +2  |
| Grêmeos          | grande  | 73   | 75          | +2  |
| Atlético Minério | grande  | 76   | 74          | −2  |
| Corinto          | grande  | 75   | 73          | −2  |
| Cruzador         | médio   | 72   | 72          | 0   |
| Fluminário       | médio   | 70   | 72          | +2  |
| Botafogueira     | médio   | 72   | 71          | −1  |
| Baião            | médio   | 69   | 70          | +1  |
| Santões          | médio   | 68   | 70          | +2  |
| Vasconcelos      | médio   | 68   | 69          | +1  |
| Inter-Regional   | médio   | 71   | 68          | −3  |
| Tufão            | médio   | 70   | 68          | −2  |
| Miragol          | pequeno | 66   | 67          | +1  |
| Bragantão        | pequeno | 67   | 66          | −1  |
| Vitorioso        | pequeno | 65   | 65          | 0   |
| Coritibom        | pequeno | 64   | 64          | 0   |
| Chapecão         | pequeno | 63   | 63          | 0   |
| Remador          | pequeno | 62   | 62          | 0   |

- Soma e forma da escada iguais: métricas de `balance-targets.md` sem mudança prevista.
- Maior efeito: Inter-Regional deixa de ser "médio forte" (−3), contrariando a sugestão do lote, e Atlético Minério e Corinto caem para o fim dos grandes. Miragol (4º em 2025) vira o pequeno mais forte; pelo caso de borda acima, o lote anual deveria propor ao CEO discutir o porte dele.
- A partir da confirmação da tabela e do ok do CEO, a coluna `strength` de "Tabela" passa a ser a de "Com a regra".

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
