# Clubes da Série A: força, perfil de IA e capacidade (T-003)

> Mantido pelo `game-designer`. Entrada para `ClubDef` (`docs/02-architecture.md` §4.1): `size`, `strength`, `aiProfile`, `stadium.capacity`. Nomes, cores, siglas e rivais vêm do lote aprovado `docs/content/lotes/2026-11-04-nomes-serie-a.md`. O nome do estádio fica com o `content-writer` (próximo lote); este documento só fixa a capacidade.

**Regra em uma frase:** cada clube recebe uma força-alvo dentro da faixa do seu porte, um perfil de IA que respeita a distribuição padrão por porte e um estádio cujo tamanho acompanha a torcida.

## Tabela

| #   | Clube            | Porte   | `strength` | `aiProfile`   | `stadium.capacity` | Justificativa curta                                                                   |
| --- | ---------------- | ------- | ---------- | ------------- | ------------------ | ------------------------------------------------------------------------------------- |
| 1   | Palmeral         | grande  | 78         | `ambitious`   | 43.000             | Favorito: elenco mais caro e mais regular; estádio moderno, não o maior.              |
| 2   | Flamingo         | grande  | 77         | `ambitious`   | 72.000             | Segundo favorito e maior torcida: o maior estádio do jogo.                            |
| 3   | Atlético Minério | grande  | 76         | `ambitious`   | 46.000             | Terceira força, briga por título; arena nova de porte médio-grande.                   |
| 4   | Corinto          | grande  | 75         | `ambitious`   | 48.000             | Torcida enorme, elenco um degrau abaixo: candidato a G4 que às vezes briga pelo topo. |
| 5   | São Paulão       | grande  | 74         | `traditional` | 62.000             | Grande que muda pouco e aposta em experientes; estádio antigo e grande.               |
| 6   | Grêmeos          | grande  | 73         | `traditional` | 55.000             | Grande mais fraco: mantém base e copeiros; arena grande no Sul.                       |
| 7   | Cruzador         | médio   | 72         | `traditional` | 44.000             | Médio forte (lote): torcida de grande, elenco experiente; estádio grande.             |
| 8   | Botafogueira     | médio   | 72         | `seller`      | 42.000             | Médio forte (lote): investe e vende caro; força que ameaça os grandes.                |
| 9   | Inter-Regional   | médio   | 71         | `academy`     | 45.000             | Médio forte (lote, decisão 3 do CEO): base forte que vende jovens; estádio grande.    |
| 10  | Fluminário       | médio   | 70         | `academy`     | 34.000             | Base tradicional que revela e vende; meio da tabela com chance de surpresa.           |
| 11  | Tufão            | médio   | 70         | `seller`      | 40.000             | Clube-empresa que compra barato e vende caro; arena moderna.                          |
| 12  | Baião            | médio   | 69         | `traditional` | 38.000             | Maior do Nordeste na lista, elenco estável; torcida que enche a arena.                |
| 13  | Vasconcelos      | médio   | 68         | `traditional` | 24.000             | Gigante de torcida em fase fraca; estádio próprio pequeno e apertado.                 |
| 14  | Santões          | médio   | 68         | `academy`     | 18.000             | A base é a identidade: revela joias e as perde; o menor estádio entre os médios.      |
| 15  | Bragantão        | pequeno | 67         | `seller`      | 15.000             | Pequeno mais forte: projeto que vende bem e reinveste; estádio de cidade do interior. |
| 16  | Miragol          | pequeno | 66         | `seller`      | 12.000             | Interior organizado, vende quem se destaca; o menor estádio do jogo.                  |
| 17  | Vitorioso        | pequeno | 65         | `chaotic`     | 26.000             | Pequeno de torcida grande e diretoria inquieta: o caótico da liga.                    |
| 18  | Coritibom        | pequeno | 64         | `academy`     | 28.000             | Pequeno de torcida grande que vive da base; estádio maior que o porte.                |
| 19  | Chapecão         | pequeno | 63         | `traditional` | 20.000             | Elenco estável e sem sobressalto; perfil neutro (decisão 5 do CEO: nada de história). |
| 20  | Remador          | pequeno | 62         | `academy`     | 18.000             | O mais fraco no papel; aposta em jovens da região para escapar do rebaixamento.       |

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

- **Faixas por porte:** grande 43.000 a 72.000; médio 18.000 a 45.000; pequeno 12.000 a 28.000. Todas múltiplas de 1.000. Médias: grande 54.300, médio 35.600, pequeno 19.800, acima dos padrões de `torcida.md` (45.000 / 30.000 / 15.000), que continuam valendo só para clube sem capacidade na lista.
- **A capacidade acompanha a torcida, não a força.** Por isso Vasconcelos e Santões (médios) têm estádio pequeno, e Coritibom e Vitorioso (pequenos) têm estádio maior que Bragantão e Miragol. A ocupação média continua a de `torcida.md` (`fans.baseOccupancy = 0,62`, cerca de 61% com humor médio, dentro da meta de 55% a 70%), porque a fórmula é proporcional à capacidade.
- Os números são fictícios e arredondados; não reproduzem a capacidade oficial de nenhum estádio real.
- Na 1a o público é só exibido; quando a bilheteria entrar (Etapa 3), a capacidade passa a pesar na receita e a tabela será revista com o `/balance` da economia.

## Casos de borda

| Caso                                                             | Regra                                                                                      |
| ---------------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `strength` fora da faixa do porte                                | dado inválido: o carregador de `app/src/data/` recusa (faixas de `jogadores.md`)           |
| `aiProfile` ausente                                              | sorteio por porte com a semente da carreira (`ia-clubes.md`); nesta lista não ocorre       |
| `stadium.capacity` ausente                                       | padrão por porte de `torcida.md`; nesta lista não ocorre                                   |
| Clube da lista reserva sobe da Série B                           | recebe valores próprios num lote futuro; até lá, padrão por porte                          |
| Dois clubes com a mesma `strength` (72/72, 70/70, 68/68)         | válido; a variação por carreira (`clubStrengthSd`) desempata                               |
| Clube com `rivals` vazio (Bragantão, Miragol, Chapecão, Remador) | sem efeito nesta tabela; o multiplicador de clássico do público simplesmente não se aplica |

## Pedido ao `developer` (T-003)

Gravar os quatro campos acima nos `ClubDef` de `app/src/data/`. Aceite: os 20 clubes com `strength`, `aiProfile` e `stadium.capacity` iguais a esta tabela; teste que confere que cada `strength` está na faixa do seu porte e que a contagem de perfis por porte bate com a tabela "Distribuição de perfis"; `/balance` de 200 temporadas com campeão entre 72 e 82 pontos e 17º entre 40 e 46 (mesma meta de `balance-targets.md`).
