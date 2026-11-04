# Jogadores e elencos

> Mantido pelo `game-designer`. Fonte: `docs/PROJETO.md`, "Jogadores, contratos e mercado" e o item "Modelo de atributos dos jogadores" (Etapa 1) do backlog. Parâmetros em `app/src/params/players.json` (`players.*`) e `app/src/params/generation.json` (`generation.*`).

**Regra em uma frase:** cada jogador tem uma posição, 6 atributos de 1 a 99 que formam a nota geral, e três estados que mudam a cada rodada (condição, moral e forma); jovens crescem até o potencial, veteranos caem.

## Escopo

| Entra na 1a                                                         | Fica para depois                                                  |
| ------------------------------------------------------------------- | ----------------------------------------------------------------- |
| Posição, 6 atributos, nota geral, potencial escondido, idade, traço | Contratos, salário, multa, valor de mercado (Etapa 3)             |
| Condição, moral, forma (exibição), lesão, suspensão                 | Treino semanal, comissão técnica, CT (Etapa 3)                    |
| Evolução uma vez por temporada (idade, potencial, minutos, moral)   | Base gerando jovens, aposentadoria com festa, histórico (Etapa 4) |
| Geração dos elencos dos 20 clubes                                   | Olheiros e faixa de nota para estrangeiros (Etapa 5)              |

## Posições

Seis posições, uma natural por jogador:

| Código | Rótulo (pt-BR) | Código no motor |
| ------ | -------------- | --------------- |
| GOL    | Goleiro        | `GK`            |
| ZAG    | Zagueiro       | `CB`            |
| LAT    | Lateral        | `FB`            |
| VOL    | Volante        | `DM`            |
| MEI    | Meia           | `AM`            |
| ATA    | Atacante       | `ST`            |

**Jogador fora da posição** rende `overall × fit`:

| Natural ↓ / Vaga → | GOL  | ZAG  | LAT  | VOL  | MEI  | ATA  |
| ------------------ | ---- | ---- | ---- | ---- | ---- | ---- |
| GOL                | 1,00 | 0,40 | 0,40 | 0,40 | 0,40 | 0,40 |
| ZAG                | 0,40 | 1,00 | 0,90 | 0,90 | 0,75 | 0,70 |
| LAT                | 0,40 | 0,90 | 1,00 | 0,85 | 0,85 | 0,75 |
| VOL                | 0,40 | 0,90 | 0,85 | 1,00 | 0,90 | 0,75 |
| MEI                | 0,40 | 0,70 | 0,80 | 0,90 | 1,00 | 0,90 |
| ATA                | 0,40 | 0,65 | 0,75 | 0,75 | 0,90 | 1,00 |

Na tela: 1,00 sem marca; 0,85 a 0,90 "improvisado" (ícone amarelo + texto); abaixo de 0,85 "fora de posição" (ícone vermelho + texto). Nunca só por cor.

## Atributos e nota geral

Linha: `speed` (velocidade), `technique` (técnica), `passing` (passe), `finishing` (finalização), `marking` (marcação), `physical` (físico). Goleiro: `reflexes` (reflexos), `positioning` (posicionamento), `aerial` (jogo aéreo), `rushing` (saída do gol), `distribution` (reposição), `physical` (físico).

`overall = round(Σ peso × atributo)`, com os pesos da posição natural:

| Posição | speed | technique | passing | finishing | marking | physical |
| ------- | ----- | --------- | ------- | --------- | ------- | -------- |
| ZAG     | 0,15  | 0,10      | 0,10    | 0         | 0,40    | 0,25     |
| LAT     | 0,30  | 0,10      | 0,20    | 0         | 0,25    | 0,15     |
| VOL     | 0,10  | 0,15      | 0,25    | 0         | 0,30    | 0,20     |
| MEI     | 0,15  | 0,30      | 0,30    | 0,15      | 0       | 0,10     |
| ATA     | 0,20  | 0,20      | 0,05    | 0,40      | 0       | 0,15     |

| Posição | reflexes | positioning | aerial | rushing | distribution | physical |
| ------- | -------- | ----------- | ------ | ------- | ------------ | -------- |
| GOL     | 0,30     | 0,25        | 0,15   | 0,15    | 0,05         | 0,10     |

Onde cada atributo pesa na partida, além do `overall` (para o atributo ser sentido): `finishing` na finalização, `passing` em quem dá a assistência, `technique` na falta direta, `physical` no cansaço (ver `partida.md`).

**Exemplo.** Atacante com speed 80, technique 72, passing 60, finishing 81, marking 30, physical 70: `0,20×80 + 0,20×72 + 0,05×60 + 0,40×81 + 0,15×70 = 76,3` → overall 76.

## Estados que mudam

| Estado    | Faixa       | Começa em         | Muda com                                                   |
| --------- | ----------- | ----------------- | ---------------------------------------------------------- |
| Condição  | 0 a 100     | 100               | cai no jogo, recupera 7 por dia (`partida.md`, "Cansaço")  |
| Moral     | 0 a 100     | `Rng.int(50, 70)` | resultados, banco, torcida, conversa do intervalo (abaixo) |
| Forma     | nota 3 a 10 | "sem jogos"       | média das notas dos últimos 5 jogos; **só exibição**       |
| Lesão     | rodadas     | 0                 | `partida.md`, "Lesões"; desconta 1 por rodada              |
| Suspensão | jogos       | 0                 | `partida.md`, "Cartões"; desconta 1 por jogo do clube      |
| Amarelos  | contador    | 0                 | zera ao chegar a 3 (gera suspensão) e no fim da temporada  |

Forma e moral: o `PROJETO.md` lista as duas; na 1a só a moral mexe no jogo e a forma é o histórico recente que o técnico lê para escalar. Uma variável mecânica a menos, mesma informação na tela.

### Moral por rodada (aplicada depois de todos os jogos)

| Situação                                                | Δ moral                                               |
| ------------------------------------------------------- | ----------------------------------------------------- |
| Jogou (≥ 1 minuto) e o time venceu / empatou / perdeu   | +3 / 0 / −3                                           |
| Clássico                                                | resultado acima × 2                                   |
| Esperava jogar e não entrou (2ª rodada seguida ou mais) | −2 por rodada                                         |
| Deriva da torcida                                       | 1 ponto na direção do termômetro (`fans.moraleDrift`) |
| Conversa "cobrar" no intervalo                          | −3 para temperamentais em campo                       |
| Voltou de lesão                                         | sem mudança                                           |

"Esperava jogar" = `overall ≥ média dos overall dos 11 titulares da rodada − 3`. Traços: **profissional** sofre só metade das quedas; **temperamental** sofre o dobro da queda por banco. Moral sempre entre 0 e 100.

## Traço de personalidade

Um por jogador, sorteado na geração.

| Traço         | Chance na geração                             | Efeito mecânico na 1a                                          | Uso nas notícias e rede social     |
| ------------- | --------------------------------------------- | -------------------------------------------------------------- | ---------------------------------- |
| Líder         | 10%                                           | como capitão, dobra o efeito positivo da conversa do intervalo | discursos, cobra o grupo           |
| Temperamental | 15%                                           | cartões ×1,5; banco dói em dobro; "cobrar" tira moral          | polêmica, indireta quando no banco |
| Profissional  | 20%                                           | metade das quedas de moral                                     | elogios da imprensa                |
| Ídolo         | 1 por clube (veterano ≥ 29 com maior overall) | no banco 2 rodadas seguidas: termômetro −1 por rodada          | torcida pede, comemora com ele     |
| Discreto      | o resto                                       | nenhum                                                         | poucas notícias                    |

Vaias, pedido de saída e ídolo contra a torcida: Etapa 3.

## Potencial

Teto do `overall`. Nunca aparece como número na 1a (olheiros: Etapa 5). O jogo mostra o rótulo "promessa" para jogador de até 23 anos com `potential − overall ≥ 10`, e o resumo da temporada mostra quanto cada um evoluiu.

## Evolução (uma vez, no fim da temporada)

```
ageEff = idade − (peakAge − 27)
Δ = curva(ageEff)
se Δ > 0: Δ = Δ × growth × (1.0 + 0.2 × min(1, minutos / (38 × 90 × 0.6))) × (0.9 + 0.2 × moral / 100)
Δ = round(Δ + Normal(0, 1))
se Δ > 0: Δ = min(Δ, potential − overall)
idade = idade + 1
```

| `ageEff` | ≤ 19 | 20–21 | 22–23 | 24–25 | 26–27 | 28–30 | 31–32 | 33–34 | ≥ 35 |
| -------- | ---- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ---- |
| curva    | +5   | +4    | +3    | +2    | +1    | 0     | −1    | −2    | −3   |

- Cada jogador tem a própria curva (`PROJETO.md`): `peakAge` sorteado entre 26 e 29 e `growth` entre `players.growthMin = 0.8` e `players.growthMax = 1.2`.
- Minutos (1,0 a 1,2) e moral (0,9 a 1,1) são os multiplicadores da fórmula das Brasilidades; CT e auxiliar entram na Etapa 3 como mais dois multiplicadores.
- O Δ do overall é distribuído nos 6 atributos na proporção dos pesos da posição, arredondando e jogando o resto no atributo de maior peso; o `overall` é recalculado da fórmula (pode diferir em 1 do previsto, e vale o recalculado).

**Exemplo.** Meia de 20 anos, overall 64, potencial 80, `peakAge` 28 (`ageEff` 19 → +5), `growth` 1,1, jogou 1.800 minutos (fator 1,18), moral 70 (1,04): `5 × 1,1 × 1,18 × 1,04 = 6,7`, mais o ruído → cerca de +7, overall 71.

## Geração de elencos

**Dados de entrada por clube** (vêm da lista de clubes aprovada pelo CEO, não do motor): nome, cidade, cores, porte (grande, médio, pequeno), perfil da IA, rivais, capacidade do estádio e `strength` (força-alvo do time titular). Se a lista não trouxer `strength`, vale o padrão por porte:

| Porte   | Clubes na Série A | `strength` padrão              | Faixa |
| ------- | ----------------- | ------------------------------ | ----- |
| Grande  | 6                 | 78, 77, 76, 75, 74, 73         | 73–78 |
| Médio   | 8                 | 72, 72, 71, 70, 70, 69, 68, 68 | 67–72 |
| Pequeno | 6                 | 67, 66, 65, 64, 63, 62         | 62–67 |

Com essa escada, o protótipo deu campeão com 73,7 pontos e 17º com 40,7 (metas 72–82 e 40–46). Se o `/balance` do motor mostrar campeão abaixo de 72, a correção é abrir a escada (o maior para 79), não mexer na partida.

**Variação por carreira:** `strength` efetiva = `strength + Normal(0, generation.clubStrengthSd)`, com `generation.clubStrengthSd = 1.5` (decisão 3 de `balance-targets.md`).

**Elenco de 25 (constante):** 3 GOL, 5 ZAG, 4 LAT, 4 VOL, 4 MEI, 5 ATA. O tamanho sai da composição; não há parâmetro de tamanho de elenco (ver "Parâmetros").

| Grupo     | Quantos                                   | Overall                        | Idade                  |
| --------- | ----------------------------------------- | ------------------------------ | ---------------------- |
| Titulares | 11 (vagas da formação preferida do clube) | `strength + Normal(0, 3)`      | 22 a 33, mais comum 27 |
| Reservas  | 7                                         | `strength − 5 + Normal(0, 3)`  | 19 a 34                |
| Elenco    | 4                                         | `strength − 10 + Normal(0, 4)` | 23 a 33                |
| Jovens    | 3                                         | `strength − 12 + Normal(0, 4)` | 17 a 20                |

- Overall sempre entre 35 e 92. Depois de gerar, o motor desloca todos os overall do elenco pelo mesmo valor para que a força do melhor XI na formação preferida fique a 0,5 ponto da `strength` efetiva.
- **Atributos:** cada atributo com peso > 0 = `overall + perfil + Normal(0, 6)`; atributos de peso 0 = `overall − 20 + Normal(0, 8)`; todos entre 1 e 99; depois ajusta-se o atributo de maior peso para que a fórmula dê o `overall` gerado.
- **Potencial:** até 23 anos, `overall + round(U^1.5 × (30 − 2 × (idade − 17)))` com `U = Rng.next()`; de 24 a 26, `overall + Rng.int(0, 4)`; 27 ou mais, igual ao overall. Máximo 95. Um dos jovens de cada clube é a **joia**: potencial de pelo menos `strength + 8` (a história do jovem que vira craque precisa existir em todo clube).
- **Nacionalidade:** 90% brasileiros, 10% de outros países da América do Sul. Nomes e avatares vêm de `app/src/lib/generators/` (fora do motor), sempre fictícios; o motor só guarda a semente do nome e do rosto.
- **Formação preferida:** sorteada entre as duas do perfil do clube (ver `ia-clubes.md`).

## Parâmetros

| Parâmetro                   | Valor inicial | Faixa   | Por quê                                         |
| --------------------------- | ------------- | ------- | ----------------------------------------------- |
| `players.growthMin`         | 0,8           | 0,5–1,0 | curvas diferentes entre jogadores               |
| `players.growthMax`         | 1,2           | 1,0–1,5 | idem                                            |
| `generation.clubStrengthSd` | 1,5           | 0–4     | cada carreira com favoritos um pouco diferentes |

**Constantes:** tabelas de posição, pesos, curva de idade, chances de traço, efeitos de moral, composição do elenco (3/5/4/4/4/5 = 25, com os grupos titulares 11, reservas 7, elenco 4, jovens 3), faixas de overall por grupo, limiar de "promessa" (até 23 anos e `potential − overall ≥ 10`) e a regra de suspensão (3 amarelos ou 1 vermelho, em `partida.md`). Ficam no código, documentados aqui, porque são regra do jogo e não botão do `/balance`; viram parâmetro só se uma rodada do `/balance` precisar mexer neles.

**Por que não há `generation.squadSize`:** tamanho sem composição não diz ao motor quantos de cada posição gerar, e uma composição parametrizável seria uma tabela a mais para validar sem nenhuma meta de `balance-targets.md` que dependa dela. 25 cabe numa tela do celular e dá rotação para as 8 quartas da temporada.

**Pedido ao `developer`:** tirar `squadSize` de `app/src/params/generation.json`, do tipo e da tabela de faixas em `app/src/engine/params.ts`; a composição vira constante no motor (`SQUAD_COMPOSITION`, soma 25). Aceite: `generation.json` só com `clubStrengthSd`; todo elenco gerado tem exatamente 3/5/4/4/4/5 em 200 temporadas; o validador recusa `squadSize` como chave extra.

## Casos de borda

| Caso                                                    | Regra                                                              |
| ------------------------------------------------------- | ------------------------------------------------------------------ |
| Evolução levaria um atributo acima de 99 ou abaixo de 1 | corta na borda e recalcula o overall                               |
| Jovem já no potencial                                   | Δ positivo vira 0; Δ negativo (raro, pelo ruído) vale              |
| Clube sem veterano ≥ 29 para ídolo                      | ídolo é o titular de maior overall                                 |
| Dois jogadores gerados com o mesmo nome no clube        | o gerador de nomes resolve (fora do motor); o motor usa IDs        |
| Lista de clubes sem `strength` ou com porte inválido    | usa o padrão por porte; porte inválido vira médio e registra aviso |
