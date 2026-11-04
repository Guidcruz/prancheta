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

### Ajuste ao alvo (geração, deslocamento do elenco e evolução)

O `overall` é sempre igual à fórmula (o validador recusa diferença). Quando o motor precisa de um `overall` alvo, ele mexe nos atributos, nunca só no número:

1. **Deslocamento grosso:** para mudar o overall em `d` pontos, soma `d` a cada atributo de peso > 0 da posição (os pesos somam 1, então a fórmula anda `d`); atributos de peso 0 não mudam. Cada atributo corta em 1 e 99.
2. **Ajuste fino:** enquanto `round(Σ peso × atributo) ≠ alvo`, o atributo de **maior peso** que ainda não está na borda (99 se precisa subir, 1 se precisa descer) anda 1 ponto na direção do alvo. Empate de peso: o primeiro na ordem da tabela (`speed, technique, passing, finishing, marking, physical`; goleiro `reflexes, positioning, aerial, rushing, distribution, physical`). Ex.: MEI usa `technique`; ATA, `finishing`; GOL, `reflexes`.

Converge sempre: cada passo move a fórmula em no máximo 0,40 (menos que 1) e qualquer alvo entre 1 e 99 é alcançável. Função única no motor (sugestão de nome: `fitAttributesToOverall(attributes, position, target)`), usada nos três lugares.

### Atributo ausente

Cada jogador guarda só os 6 atributos da sua posição natural. Quando a partida pede um atributo que ele não tem (goleiro jogando na linha e escolhido para finalizar, dar assistência ou cobrar), vale:

```
atributo ausente = clamp(round(0.4 × overall), 1, 99)
```

0,4 é o mesmo `fit` de goleiro fora do gol: um goleiro de overall 70 finaliza como 28. A partida nunca lê atributo exclusivo de goleiro (`reflexes` etc.): a força do goleiro é o `eff` (`overall × fit × ...`), então o jogador de linha no gol já fica coberto pelo próprio overall × 0,40. `physical` existe nas duas listas e é sempre o próprio. Função única no motor (sugestão: `attributeOf(player, key)`).

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

**Frações.** Condição e moral são números reais (o cansaço tira 0,3 por minuto; o profissional perde −1,5). O motor não arredonda o estado: só corta em 0 e 100. A interface mostra o inteiro arredondado (`Math.round`). Lesão, suspensão e amarelos são inteiros.

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

Um por jogador. `drawTrait` sorteia só Líder 10%, Temperamental 15%, Profissional 20% e Discreto 55%. O **ídolo não é sorteado**: na montagem do elenco (T-006), o escolhido tem o traço sorteado substituído por Ídolo (um traço por jogador). Exatamente 1 ídolo por clube, validado onde o elenco é montado.

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
- O novo overall é `alvo = clamp(overall + Δ, 1, 99)` e os atributos chegam lá pelo "Ajuste ao alvo" (deslocamento grosso de Δ, depois ajuste fino). O overall final é **exatamente** o alvo. Como o Δ positivo já foi cortado em `potential − overall` e o negativo só desce, o resultado nunca passa do potencial; o potencial não muda na evolução.

**Exemplo.** Meia de 20 anos, overall 64, potencial 80, `peakAge` 28 (`ageEff` 19 → +5), `growth` 1,1, jogou 1.800 minutos (fator 1,18), moral 70 (1,04): `5 × 1,1 × 1,18 × 1,04 = 6,7`, mais o ruído → cerca de +7, overall 71.

## Geração de elencos

**Dados de entrada por clube** (vêm da lista de clubes aprovada pelo CEO, não do motor): nome, cidade, cores, porte (grande, médio, pequeno), perfil da IA, rivais, capacidade do estádio e `strength` (força-alvo do time titular). **A força não depende do porte** (decisão do CEO, `clubes-serie-a.md`): é uma escada única de 20 degraus, atribuída pela colocação na tabela de referência:

```
LADDER = [78, 77, 76, 75, 74, 73, 72, 72, 71, 70, 70, 69, 68, 68, 67, 66, 65, 64, 63, 62]   // soma 1.400
```

Validade: inteiro entre 55 e 85. Se a lista não trouxer `strength`, vale 70, com aviso.

Com essa escada, o protótipo deu campeão com 73,7 pontos e 17º com 40,7 (metas 72–82 e 40–46). Se o `/balance` do motor mostrar campeão abaixo de 72, a correção é abrir a escada (o maior para 79), não mexer na partida.

**Variação por carreira:** `strength` efetiva = `strength + Normal(0, generation.clubStrengthSd)`, com `generation.clubStrengthSd = 1.5` (decisão 3 de `balance-targets.md`).

**Atualização anual:** a força de cada clube segue a colocação final do último campeonato real, na escada única acima; o porte não muda pela colocação (`clubes-serie-a.md`, "Atualização anual").

**Elenco de 25 (constante):** 3 GOL, 5 ZAG, 4 LAT, 4 VOL, 4 MEI, 5 ATA. O tamanho sai da composição; não há parâmetro de tamanho de elenco (ver "Parâmetros").

| Grupo     | Quantos                                   | Overall                        | Idade                  |
| --------- | ----------------------------------------- | ------------------------------ | ---------------------- |
| Titulares | 11 (vagas da formação preferida do clube) | `strength + Normal(0, 3)`      | 22 a 33, mais comum 27 |
| Reservas  | 7                                         | `strength − 5 + Normal(0, 3)`  | 19 a 34                |
| Elenco    | 4                                         | `strength − 10 + Normal(0, 4)` | 23 a 33                |
| Jovens    | 3                                         | `strength − 12 + Normal(0, 4)` | 17 a 20                |

- Overall sempre entre 35 e 92. Depois de gerar, o motor desloca todos os overall do elenco pelo mesmo valor para que a força do melhor XI na formação preferida fique a 0,5 ponto da `strength` efetiva.
- **Atributos:** cada atributo com peso > 0 = `overall + perfil + Normal(0, 6)`; atributos de peso 0 = `overall − 20 + Normal(0, 8)`; todos entre 1 e 99; depois o "Ajuste fino" (seção "Ajuste ao alvo") leva a fórmula ao `overall` gerado. O deslocamento do elenco para a força-alvo é o "Deslocamento grosso" seguido do ajuste fino, jogador a jogador.
- **Potencial:** até 23 anos, `overall + round(U^1.5 × (30 − 2 × (idade − 17)))` com `U = Rng.next()`; de 24 a 26, `overall + Rng.int(0, 4)`; 27 ou mais, igual ao overall. Máximo 95. Um dos jovens de cada clube é a **joia**: potencial de pelo menos `strength + 8` (a história do jovem que vira craque precisa existir em todo clube). O potencial é sorteado **depois** do deslocamento do elenco (sobre o overall final), para valer `potential ≥ overall`; a joia é o jovem de maior potencial e, se ficar abaixo de `strength + 8`, sobe para esse valor (máximo 95). Joia e ídolo são regras do elenco (T-006), não do jogador avulso.
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

## Limites dos campos (o validador do save confere)

| Campo            | Faixa                   | Tipo    | Por quê                                                                                                |
| ---------------- | ----------------------- | ------- | ------------------------------------------------------------------------------------------------------ |
| atributos        | 1 a 99                  | inteiro | regra da nota                                                                                          |
| `overall`        | 1 a 99, igual à fórmula | inteiro | 35–92 só na geração; a evolução pode sair dessa faixa                                                  |
| `potential`      | `overall` a 99          | inteiro | teto; 95 é o máximo na geração                                                                         |
| `age`            | 15 a 60                 | inteiro | a geração dá 17 a 34; 60 é só sanidade até a aposentadoria (Etapa 4), para um save longo nunca quebrar |
| `peakAge`        | 26 a 29                 | inteiro | curva pessoal                                                                                          |
| `growth`         | 0,5 a 1,5               | real    | as faixas mais largas de `players.growthMin/Max`: mudar o parâmetro não invalida saves antigos         |
| `shirt`          | 1 a 99                  | inteiro | única no clube (validada na montagem do elenco, T-006)                                                 |
| `condition`      | 0 a 100                 | real    | ver "Frações"                                                                                          |
| `morale`         | 0 a 100                 | real    | ver "Frações"                                                                                          |
| `yellowCount`    | 0 a 2                   | inteiro | o 3º amarelo zera o contador e gera suspensão                                                          |
| lesão, suspensão | ≥ 0                     | inteiro | contadores                                                                                             |

## Casos de borda

| Caso                                                    | Regra                                                                 |
| ------------------------------------------------------- | --------------------------------------------------------------------- |
| Evolução levaria um atributo acima de 99 ou abaixo de 1 | corta na borda; o ajuste fino compensa em outro atributo de peso > 0  |
| Fórmula arredondada passaria do potencial               | não acontece: o alvo já respeita o potencial e o ajuste fino o atinge |
| Goleiro na linha precisa de `finishing`/`passing`/etc.  | "Atributo ausente": `round(0.4 × overall)`                            |
| Jovem já no potencial                                   | Δ positivo vira 0; Δ negativo (raro, pelo ruído) vale                 |
| Clube sem veterano ≥ 29 para ídolo                      | ídolo é o titular de maior overall                                    |
| Dois jogadores gerados com o mesmo nome no clube        | o gerador de nomes resolve (fora do motor); o motor usa IDs           |
| Lista de clubes sem `strength` ou com porte inválido    | `strength` ausente vira 70; porte inválido vira médio; registra aviso |
