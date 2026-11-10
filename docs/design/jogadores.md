# Jogadores e elencos

> Mantido pelo `game-designer`. Fonte: `docs/PROJETO.md`, "Jogadores, contratos e mercado" e o item "Modelo de atributos dos jogadores" (Etapa 1) do backlog. Parâmetros em `app/src/params/players.json` (`players.*`) e `app/src/params/generation.json` (`generation.*`).

**Regra em uma frase:** cada jogador tem uma posição, 6 atributos de 1 a 99 que formam a nota geral, e três estados que mudam a cada rodada (condição, moral e forma); jovens crescem até o potencial, veteranos caem.

## Escopo

| Entra na 1a                                                                   | Fica para depois                                                              |
| ----------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Posição, 6 atributos, nota geral, potencial escondido, idade, traço           | Contratos, salário, multa, valor de mercado (Etapa 3)                         |
| Condição, moral, forma (exibição), lesão, suspensão                           | Treino semanal, comissão técnica, CT (Etapa 3)                                |
| Evolução uma vez por temporada (idade, potencial, minutos, moral)             | Base gerando jovens, aposentadoria com festa, histórico (Etapa 4)             |
| Renovação mínima: aposentadoria variável de 33 a 40 e um jovem de 17 no lugar | Base de verdade (categorias, investimento), aposentadoria com festa (Etapa 4) |
| Geração dos elencos dos 20 clubes                                             | Olheiros e faixa de nota para estrangeiros (Etapa 5)                          |

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

**Posição secundária (projetada em 2026-11-08, ainda não implementada):** cerca de 1 em 3 jogadores de linha terá uma secundária, vizinha da natural (`FIT ≥ 0,85`), onde rende 0,95 em vez da célula da tabela; goleiro nunca. Vem junto a escalação automática "natural primeiro". Regra completa, geração, migração, parâmetro e casos de borda em [posicao-secundaria.md](posicao-secundaria.md); até a implementação, vale a tabela acima para todos.

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

| Estado    | Faixa       | Começa em         | Muda com                                                                                                  |
| --------- | ----------- | ----------------- | --------------------------------------------------------------------------------------------------------- |
| Condição  | 0 a 100     | 100               | cai no jogo, recupera 7 por dia (`partida.md`, "Cansaço"); volta a 100 na virada da temporada             |
| Moral     | 0 a 100     | `Rng.int(50, 70)` | resultados, banco, torcida, conversa do intervalo (abaixo); na virada, metade do caminho até `fans.start` |
| Forma     | nota 3 a 10 | "sem jogos"       | média das notas dos últimos 5 jogos; **só exibição**; volta a "sem jogos" na virada                       |
| Lesão     | rodadas     | 0                 | `partida.md`, "Lesões"; desconta 1 por rodada; termina na virada da temporada (decisão 13)                |
| Suspensão | jogos       | 0                 | `partida.md`, "Cartões"; desconta 1 por jogo do clube; termina na virada da temporada                     |
| Amarelos  | contador    | 0                 | zera ao chegar a 3 (gera suspensão) e no fim da temporada; no Realismo simplificado fica em 0             |

**Frações.** Condição e moral são números reais (o cansaço tira 0,3 por minuto; o profissional perde −1,5). O motor não arredonda o estado: só corta em 0 e 100. A interface mostra o inteiro arredondado (`Math.round`). Lesão, suspensão e amarelos são inteiros.

Forma e moral: o `PROJETO.md` lista as duas; na 1a só a moral mexe no jogo e a forma é o histórico recente que o técnico lê para escalar. Uma variável mecânica a menos, mesma informação na tela.

### Moral por rodada (aplicada depois de todos os jogos)

| Situação                                                | Δ moral                                               |
| ------------------------------------------------------- | ----------------------------------------------------- |
| Entrou em campo e o time venceu / empatou / perdeu      | +3 / 0 / −3                                           |
| Clássico                                                | resultado acima × 2                                   |
| Esperava jogar e não entrou (2ª rodada seguida ou mais) | −2 por rodada                                         |
| Deriva da torcida                                       | até 1 ponto na direção do termômetro, sem passar dele |
| Conversa "cobrar" no intervalo                          | −3 para temperamentais em campo                       |
| Voltou de lesão                                         | sem mudança                                           |

"Entrou em campo" vale mesmo para quem entrou só nos acréscimos, com 0 minuto regulamentar (`partida.md`, "Minutos jogados").

"Esperava jogar" = `overall ≥ média dos overall dos 11 titulares da rodada − 3`. Traços: **profissional** sofre só metade das quedas por resultado e por banco; **temperamental** sofre o dobro da queda por banco. Moral sempre entre 0 e 100.

**Como o motor lê a tabela (T-014, revisado pelo `game-designer` em 2026-11-05):**

- **Uma conta só.** Todas as linhas da rodada leem a moral e o termômetro do **início da rodada**, somam e cortam em 0 e 100 uma vez. A ordem das linhas não muda o resultado.
- **Deriva:** `deriva = clamp(termômetro − moral, −fans.moraleDrift, +fans.moraleDrift)`, com os dois valores do início da rodada. Anda até 1 ponto e para no termômetro: moral 79,5 com termômetro 80 vai a 80,0, não a 80,5, e não fica oscilando em volta (a tela mostraria 80, 81, 80, … sem motivo). Com moral igual ao termômetro, não anda. Vale para todo o elenco, tenha jogado ou não.
- **Profissional:** a metade vale para cada componente negativo de resultado (derrota) e de banco, um a um, nunca para o saldo. **A deriva é igual para todos** (ADR-0005 e `brasilidades.md`: "1 ponto na direção do termômetro"), para baixo também; ela não é queda por desempenho, é o clima do clube. Exemplos: vitória (+3) com deriva para baixo (−1) dá +2, como para qualquer um; derrota (−3 → −1,5) com deriva para cima (+1) dá −0,5; derrota em clássico (−6 → −3) com deriva para baixo (−1) dá −4.
- **"Esperava jogar":** a média é a do `overall` (sem `fit`, moral nem condição) de quem começou a partida pelo clube, mesmo que tenha saído ou sido expulso; quem entrou depois não entra na média. Lesionado ou suspenso no início da rodada não esperava jogar, e o contador do banco volta a 0 (quem volta de lesão recomeça a contar). Uma rodada em que ele não esperava jogar também zera o contador. Quem entrou em campo, nem que nos acréscimos, zera o contador.
- **"Cobrar":** os −3 do temperamental não passam pela metade (profissional e temperamental são traços diferentes; um jogador tem um só).

## Traço de personalidade

Um por jogador. `drawTrait` sorteia só Líder 10%, Temperamental 15%, Profissional 20% e Discreto 55%. O **ídolo não é sorteado**: na montagem do elenco (T-006), o escolhido tem o traço sorteado substituído por Ídolo (um traço por jogador). Exatamente 1 ídolo por clube, validado onde o elenco é montado.

| Traço         | Chance na geração                            | Efeito mecânico na 1a                                          | Uso nas notícias e rede social     |
| ------------- | -------------------------------------------- | -------------------------------------------------------------- | ---------------------------------- |
| Líder         | 10%                                          | como capitão, dobra o efeito positivo da conversa do intervalo | discursos, cobra o grupo           |
| Temperamental | 15%                                          | cartões ×1,5; banco dói em dobro; "cobrar" tira moral          | polêmica, indireta quando no banco |
| Profissional  | 20%                                          | metade das quedas de moral por resultado e por banco           | elogios da imprensa                |
| Ídolo         | 1 por clube (titular ≥ 29 com maior overall) | no banco 2 rodadas seguidas, em clube humano: termômetro −1    | torcida pede, comemora com ele     |
| Discreto      | o resto                                      | nenhum                                                         | poucas notícias                    |

**Ídolo no banco (regra em uma frase):** se o técnico humano deixa o ídolo apto fora de campo duas rodadas seguidas ou mais, a torcida dele perde 1 por rodada. "Apto" = nem lesionado nem suspenso no início da rodada; "fora de campo" = não entrou nem nos acréscimos; o contador (`idolBenchStreak`) zera quando ele entra em campo ou fica inapto. **Só vale para clube humano** (o que está em `sheets` ou `coaches` da rodada; `torcida.md`, "Decisões do técnico"): a IA escala pela força e não faz escolha para a torcida, e punir a IA por escalar o melhor seria ruído que ninguém vê. Num clube da IA o contador nem anda (fica em 0). Entra no termômetro depois do teto das decisões (`torcida.md`, "Fórmula").

**O ídolo só muda quando sai do clube** (T-017; T-048): não há novo sorteio na virada, mesmo que ele envelheça, caia de nível ou deixe de ser titular. Ídolo é história com a torcida, não o melhor do elenco no momento; o veterano em queda que a torcida pede é um dilema de técnico, e custa pouco resolvê-lo (uma entrada nos acréscimos zera o contador). Na 1a a única saída é a aposentadoria da renovação mínima (`temporada.md`, "Carreira longa na 1a"): da virada dos 33 anos em diante cada jogador tem uma chance de parar que cresce com a idade (menor para goleiros), aos 40 sai com certeza, e o ídolo segue a mesma regra. **Quando o clube fica sem ídolo, escolhe um novo na mesma virada** pela regra da geração aplicada ao melhor XI do momento (`bestEleven` do elenco já renovado, na 1ª formação preferida, todos aptos e descansados): o titular de 29 anos ou mais com maior overall; sem nenhum, o titular de maior overall; empate, o primeiro na ordem das vagas do XI. O traço sorteado dele vira Ídolo, e o `idolBenchStreak` do clube volta a 0. Assim o clube nunca passa uma rodada sem ídolo, e o ídolo da geração (29 a 34 anos, quase sempre) se aposenta entre a 1ª e a 11ª virada. Venda (Etapa 3) segue a mesma regra.

Vaias, pedido de saída e ídolo contra a torcida: Etapa 3.

## Potencial

Teto do `overall`. Nunca aparece como número na 1a (olheiros: Etapa 5). O jogo mostra o rótulo "promessa" para jogador de até 23 anos com `potential − overall ≥ 10`, e o resumo da temporada mostra quanto cada um evoluiu.

## Evolução (uma vez, no fim da temporada)

**Regra em uma frase:** no fim de cada temporada, cada jogador sobe ou desce pela curva da idade, os jovens crescem mais quando jogam e estão animados, ninguém passa do potencial, e todos fazem aniversário.

```
ageEff = idade − (peakAge − 27)
Δ = curva(ageEff)
se Δ > 0: Δ = Δ × growth × (1.0 + 0.2 × min(1, minutos / (38 × 90 × 0.6))) × (0.9 + 0.2 × moral / 100)
Δ = round(Δ + Normal(0, 1))
se Δ > 0: Δ = min(Δ, potential − overall)
alvo = clamp(overall + Δ, 1, 99)
idade = idade + 1
```

| `ageEff` | ≤ 19 | 20–21 | 22–23 | 24–25 | 26–27 | 28–30 | 31–32 | 33–34 | ≥ 35 |
| -------- | ---- | ----- | ----- | ----- | ----- | ----- | ----- | ----- | ---- |
| curva    | +5   | +4    | +3    | +2    | +1    | 0     | −1    | −2    | −3   |

**Entradas, para implementar sem interpretar (T-017):**

| Termo               | De onde vem                                                                                                                                                                                                                                                                                                              |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| quem evolui         | todos os jogadores do estado (os 20 clubes), na fase do `endSeason` (`temporada.md`, "Fim de temporada"), depois dos prêmios                                                                                                                                                                                             |
| `idade`             | a da temporada que acabou (antes do `+ 1`)                                                                                                                                                                                                                                                                               |
| `peakAge`, `growth` | do jogador (sorteados na geração; não mudam)                                                                                                                                                                                                                                                                             |
| `minutos`           | `seasonStats[id].minutes` (minutos regulamentares); quem não entrou em campo tem 0                                                                                                                                                                                                                                       |
| `moral`             | `morale` depois da rodada 38, antes da puxada da virada                                                                                                                                                                                                                                                                  |
| `Normal(0, 1)`      | `normal(rng, 0, 1)` de `math.ts` (soma de 6 uniformes), com um `Rng` por jogador: ``new Rng(seedFromString(`${seed}-s${season}-evolution-${playerId}`))``, em que `season` é a temporada que acabou. Uma semente por jogador deixa o resultado igual em qualquer ordem de processamento e não gasta o `Rng` de mais nada |
| `round`             | `Math.round` (meio para cima: 2,5 → 3 e −2,5 → −2), como no resto do motor                                                                                                                                                                                                                                               |
| teto                | `potential − overall`, que é sempre ≥ 0; só corta Δ positivo                                                                                                                                                                                                                                                             |
| atributos           | `fitAttributesToOverall(attributes, position, alvo)` ("Ajuste ao alvo"); com `alvo = overall`, os atributos não mudam                                                                                                                                                                                                    |
| o que não muda      | `potential`, `peakAge`, `growth`, posição (e a secundária, quando existir; [posicao-secundaria.md](posicao-secundaria.md)), traço, camisa                                                                                                                                                                                |

- Cada jogador tem a própria curva (`PROJETO.md`): `peakAge` sorteado entre 26 e 29 e `growth` entre `players.growthMin = 0.8` e `players.growthMax = 1.2`.
- Minutos (1,0 a 1,2) e moral (0,9 a 1,1) são os multiplicadores da fórmula das Brasilidades; CT e auxiliar entram na Etapa 3 como mais dois multiplicadores. A referência dos minutos (60% de 38 jogos de 90 minutos, 2.052 minutos) é constante.
- O novo overall é o `alvo`, e os atributos chegam lá pelo "Ajuste ao alvo" (deslocamento grosso de Δ, depois ajuste fino). O overall final é **exatamente** o alvo. Como o Δ positivo já foi cortado em `potential − overall` e o negativo só desce, o resultado nunca passa do potencial.
- **O ruído no auge desce mais do que sobe, de propósito.** Quem está no auge (curva 0) e já no potencial só pode descer pelo ruído: em média −0,3 por temporada. Isso segura a inflação que os jovens trazem: medido, tirar o ruído do auge deixa a força média da liga cerca de 0,3 ponto mais alta nas temporadas 4 e 5 (71,3 contra 71,0) (`balance-log.md`, 2026-11-05, T-017). Fica como está.

**Medido (cadeias de temporadas, IA nos 20 clubes; `balance-log.md`):** Δ médio na 1ª virada de +3,9 para quem tem até 21 anos, +1,7 de 22 a 26, −0,3 de 27 a 30 e −1,2 de 31 em diante; +0,5 nos titulares e +0,9 no elenco todo. A força média da liga vai de 70,0 a 70,6 na temporada 2 e 70,9 na 3.

**Exemplo.** Meia de 20 anos, overall 64, potencial 80, `peakAge` 28 (`ageEff` 19 → +5), `growth` 1,1, jogou 1.800 minutos (fator 1,18), moral 70 (1,04): `5 × 1,1 × 1,18 × 1,04 = 6,7`, mais o ruído → cerca de +7, overall 71.

## Geração de elencos

**Dados de entrada por clube** (vêm da lista de clubes aprovada pelo CEO, não do motor): nome, cidade, cores, porte (grande, médio, pequeno), perfil da IA, rivais, capacidade do estádio e `strength` (força-alvo do time titular). **A força não depende do porte** (decisão do CEO, `clubes-serie-a.md`): é uma escada única de 20 degraus, atribuída pela colocação na tabela de referência:

```
LADDER = [78, 77, 76, 75, 74, 73, 72, 72, 71, 70, 70, 69, 68, 68, 67, 66, 65, 65, 64, 64]   // soma 1.404
```

É a escada com o fundo mais alto, decidida pelo CEO em 2026-11-06 (T-070; `clubes-serie-a.md`, "Força"): os 3 últimos degraus subiram de 64, 63 e 62 para 65, 64 e 64, para que todo clube possa ser campeão. A anterior, de 2026-11-04, terminava em `65, 64, 63, 62` (soma 1.400).

Validade: inteiro entre 55 e 85. Se a lista não trouxer `strength`, vale 70, com aviso.

Com a escada anterior, o protótipo deu campeão com 73,7 pontos e 17º com 40,7 (metas 72–82 e 39–45; a do 17º revista pelo CEO em 2026-11-05). Se o `/balance` do motor mostrar campeão abaixo de 72, a correção é abrir a escada (o maior para 79), não mexer na partida.

**Motor com a moral (T-014, 2 × 100 carreiras):** campeão 77,4 e 76,6, 17º 40,1 e 40,2 (antes da moral: 75,6 e 41,2). A moral alarga a tabela pelos dois lados, porque amplia a sorte de quem embala, não a vantagem do mais forte (os pontos por posição de força quase não mudam). O 17º já estava abaixo do centro da meta antiga (43) antes da moral, e nenhum botão existente o sobe sem baixar mais o campeão: subir o fundo da escada (62/63 → 64/64) dá +0,4; `baseChance` 0,087 dá 0; `kChance` 0,13 dá +0,5 e −1,0 no campeão; `moraleMult` de 0,97 a 1,03 dá +0,5 e −1,6. A referência real é cerca de 42 pontos para o 17º (mínimo 39, máximo 45). **Decidido (aprovado pelo CEO em 2026-11-05):** a meta passa a 42, de 39 a 45, e a moral fica como está (`balance-targets.md`, decisão 8). Na T-016 o 17º só é medido; não há correção para ele. Com a escada nova (motor, 1.000 temporadas, semente 1), o campeão fica em 75,0 e o 17º em 40,6, contra 75,3 e 40,3 na anterior.

**Variação por carreira:** `strength` efetiva = `strength + Normal(0, generation.clubStrengthSd)`, com `generation.clubStrengthSd = 1.5` (decisão 3 de `balance-targets.md`).

**Atualização anual:** a força de cada clube segue a colocação final do último campeonato real, na escada única acima; o porte não muda pela colocação (`clubes-serie-a.md`, "Atualização anual"). Isso vale para o lote de clubes de quem começa um jogo novo. **Dentro da carreira**, da 2ª temporada em diante, a força é a do melhor XI do elenco evoluído, sem escada nem colocação (`temporada.md`, "Força dos clubes na virada"; decisão D8 do CEO).

**Elenco de 25 (constante):** 3 GOL, 5 ZAG, 4 LAT, 4 VOL, 4 MEI, 5 ATA. O tamanho sai da composição; não há parâmetro de tamanho de elenco (ver "Parâmetros").

| Grupo     | Quantos                                   | Overall                        | Idade                |
| --------- | ----------------------------------------- | ------------------------------ | -------------------- |
| Titulares | 11 (vagas da formação preferida do clube) | `strength + Normal(0, 3)`      | 22 a 33, moda 27 (1) |
| Reservas  | 7                                         | `strength − 5 + Normal(0, 3)`  | 19 a 34              |
| Elenco    | 4                                         | `strength − 10 + Normal(0, 4)` | 23 a 33              |
| Jovens    | 3                                         | `strength − 12 + Normal(0, 4)` | 17 a 20              |

(1) Triangular contínua em [22, 34) com pico em 27,5, arredondada para baixo: inteiros de 22 a 33, o 27 é o mais comum. Os outros grupos são uniformes inteiros na faixa (`Rng.int(min, max)`).

- **Posições fora do XI:** os 11 titulares ocupam as vagas da formação preferida; dos 14 que sobram da composição 3/5/4/4/4/5, os reservas recebem um de cada posição (o 2º goleiro entre eles) mais um sorteado entre os restantes; os 7 que sobram são embaralhados entre elenco (4) e jovens (3). Toda formação usa no máximo 3 ZAG, 2 LAT, 2 VOL, 3 MEI e 3 ATA, então sempre há um reserva de cada posição.
- Overall sempre entre 35 e 92. Depois de gerar, o motor desloca todos os overall do elenco pelo mesmo valor `d` (inteiro) para que a força do melhor XI na formação preferida fique a 0,5 ponto da `strength` efetiva. Como o improvisado anda `d × fit` e o XI pode mudar, o motor mede os `d` vizinhos de `round(alvo − força)` e fica com o mais perto (empate: menor `|d|`, depois o menor `d`). **Plano B** (cerca de 2 em 1.000 elencos, quando nenhum `d` cai na janela): os titulares do melhor XI andam 1 ponto cada, vaga a vaga, na direção do alvo, até entrar na janela (cada ponto move a média cerca de 0,09). Aceito: o efeito é invisível e a força continua exata.
- **Força efetiva** não é arredondada nem cortada (é real); a janela de 0,5 e o piso da joia a usam como está.
- **Atributos:** cada atributo com peso > 0 = `overall + Normal(0, 6)` (não há termo de perfil: o ruído de 6 já faz o atacante rápido e o atacante finalizador; um "estilo" de jogador seria um sistema a mais que ninguém sente no resultado); atributos de peso 0 = `overall − 20 + Normal(0, 8)`; todos entre 1 e 99; depois o "Ajuste fino" (seção "Ajuste ao alvo") leva a fórmula ao `overall` gerado. O deslocamento do elenco para a força-alvo é o "Deslocamento grosso" seguido do ajuste fino, jogador a jogador.
- **Potencial:** até 23 anos, `overall + round(U^1.5 × (30 − 2 × (idade − 17)))` com `U = Rng.next()`; de 24 a 26, `overall + Rng.int(0, 4)`; 27 ou mais, igual ao overall. Máximo 95. Um dos jovens de cada clube é a **joia**: potencial de pelo menos `strength + 8` (a história do jovem que vira craque precisa existir em todo clube). O potencial é sorteado **depois** do deslocamento do elenco (sobre o overall final), para valer `potential ≥ overall`; a joia é o jovem de maior potencial e, se ficar abaixo do piso `min(95, ceil(strength efetiva + 8))`, sobe para ele (e nunca abaixo do próprio overall). Joia e ídolo são regras do elenco (T-006), não do jogador avulso. **O ídolo sai dos 11 titulares gerados** (revisado em 2026-11-05): o titular de 29 anos ou mais com maior overall; sem titular de 29 ou mais, o titular de maior overall. Antes ele saía do elenco inteiro, e em 5,7% dos clubes (229 de 4.000, 200 carreiras) caía num reserva, 39 deles o goleiro reserva, que a IA e o técnico quase nunca escalam: o clube levava −1 de termômetro em até 37 das 38 rodadas sem ninguém ter decidido nada. **Desempates** (ídolo com o mesmo overall, joia com o mesmo potencial): o primeiro na ordem do elenco (XI por vaga, reservas, elenco, jovens).
- **Nacionalidade:** na 1a, todos brasileiros (`BR`); os sul-americanos entram na Etapa 5, junto com os nomes em espanhol e os olheiros (decisão 9 do CEO na auditoria de 2026-11-05, alinhada à US-003, que deixa "nomes de outras nacionalidades" para a Etapa 5). Antes valia 90% brasileiros e 10% dos outros 9 países da CONMEBOL, com nomes brasileiros para eles enquanto não houvesse lista em espanhol: um uruguaio chamado "Thiago Silva" é ruído, não sabor, e a lista em espanhol não é da 1a. Na Etapa 5 a regra volta a ser decidida com os clubes sul-americanos (a parcela e os pesos por país), com a lista de nomes aprovada pelo CEO. Nomes e avatares vêm de `app/src/lib/generators/` (fora do motor), sempre fictícios; o motor só guarda a semente do nome e do rosto.
- **Formação preferida:** sorteada entre as duas do perfil do clube (ver `ia-clubes.md`); a sorteada vai primeiro em `preferredFormations`, o elenco é montado para ela e ela vence o empate da IA. O Caótico recebe duas formações distintas sorteadas entre as seis; elas só moldam o elenco, porque no jogo ele continua sorteando a cada partida.
- **Partidas pelo clube (`clubAppearances`):** titulares, reservas e elenco começam com 1 (`PRE_CAREER_APPEARANCES`, constante: já estrearam antes da carreira); os 3 jovens começam com 0. Serve só ao marcador `estreia` (`partida.md`, "Marcadores do resultado") e não aparece na interface da 1a como total de jogos.
- **Camisas** (uma por jogador, únicas no clube, fixas na carreira). Titulares, na ordem GOL, LAT, ZAG, VOL, MEI, ATA (dentro da posição, na ordem das vagas), pegam o primeiro número livre da sua lista; se nenhum estiver livre, o menor livre de 2 a 11. Os 11 titulares sempre ficam com 1 a 11.

  | Posição | Lista    |
  | ------- | -------- |
  | GOL     | 1        |
  | LAT     | 2, 6     |
  | ZAG     | 3, 4     |
  | VOL     | 5, 8     |
  | MEI     | 10, 8, 7 |
  | ATA     | 9, 11, 7 |

  Reservas: o goleiro leva 12; os outros, na ordem do elenco, o menor livre a partir de 13. Elenco: o menor livre a partir de 13. Jovens: o menor livre a partir de 30. Ex.: 4-3-3 dá LAT 2 e 6, ZAG 3 e 4, VOL 5, MEI 10 e 8, ATA 9, 11 e 7. Por quê: o 10 do meia e o 9 do centroavante são parte da história que o jogador conta; custa uma tabela.

## Parâmetros

| Parâmetro                   | Valor inicial | Faixa   | Por quê                                         |
| --------------------------- | ------------- | ------- | ----------------------------------------------- |
| `players.growthMin`         | 0,8           | 0,5–1,0 | curvas diferentes entre jogadores               |
| `players.growthMax`         | 1,2           | 1,0–1,5 | idem                                            |
| `generation.clubStrengthSd` | 1,5           | 0–4     | cada carreira com favoritos um pouco diferentes |

Projetado, ainda fora do `players.json`: `players.secondaryChance` = 0,33 (faixa 0–0,5), em [posicao-secundaria.md](posicao-secundaria.md), "Parâmetros e limites".

A evolução não tem outro parâmetro: `growthMin` e `growthMax` são o botão do quanto os jovens crescem (e da inflação da liga, decisão 11 de `balance-targets.md`). Curva, ruído de 1, multiplicadores de minutos e de moral e a referência de minutos são constantes.

**Constantes:** tabelas de posição, pesos, curva de idade, chances de traço, efeitos de moral, composição do elenco (3/5/4/4/4/5 = 25, com os grupos titulares 11, reservas 7, elenco 4, jovens 3), faixas de overall por grupo, limiar de "promessa" (até 23 anos e `potential − overall ≥ 10`) e a regra de suspensão (3 amarelos ou 1 vermelho, em `partida.md`). Ficam no código, documentados aqui, porque são regra do jogo e não botão do `/balance`; viram parâmetro só se uma rodada do `/balance` precisar mexer neles.

**Por que não há `generation.squadSize`:** tamanho sem composição não diz ao motor quantos de cada posição gerar, e uma composição parametrizável seria uma tabela a mais para validar sem nenhuma meta de `balance-targets.md` que dependa dela. 25 cabe numa tela do celular e dá rotação para as 8 quartas da temporada.

**Feito:** o pedido de tirar `squadSize` de `app/src/params/generation.json`, do tipo e da tabela de faixas em `app/src/engine/params.ts` já foi atendido: `generation.json` só tem `clubStrengthSd` (conferido em 2026-11-05) e a composição é a constante do motor (3/5/4/4/4/5 = 25).

**Feito na T-069 (aguardando merge):** o pedido ao `developer` da decisão 9 (`/feature`, mexe em `app/src/engine/`) foi atendido, com `ENGINE_VERSION` 14. Na 1a todo jogador gerado é brasileiro; o texto abaixo é o pedido original e a regra não mudou. Conferido: o `new-game` tinha 2 estrangeiros, 34 jogadores ganharam nome e rosto novos, e o balance de 200 temporadas saiu idêntico ao da `main` (39/39 metas).

- **O que muda:** só `app/src/engine/generation.ts`. `HOME_NATIONALITY_SHARE` passa de 0,9 a 1 (todo sorteio cai em `BR`); o sorteio `rng.next()` de `drawNationality` **continua sendo consumido**, para não deslocar a sequência do `Rng` do elenco (atributos, traço, curva e moral que vêm depois). `SOUTH_AMERICAN_NATIONALITIES` fica no código para a Etapa 5, e o validador do save continua aceitando esses códigos (saves antigos com estrangeiros seguem válidos; não há migração nem mudança de formato). Ajustar o comentário "90% Brazilians" e o teste de `generation.test.ts` que espera 88% a 92% de `BR`.
- **Parâmetro:** nenhum. A nacionalidade nunca foi parâmetro: `app/src/params/players.json` (`growthMin`, `growthMax`) e `generation.json` (`clubStrengthSd`) não mudam. Na Etapa 5 a parcela volta como constante documentada aqui, não como botão do `/balance` (não move nenhuma meta).
- **Impacto nos goldens:** como o sorteio continua consumido, partidas, placares, tabelas e forças não mudam. Mudam os campos `nationality` dos poucos estrangeiros (no `new-game.json` de hoje são 2 de 50 jogadores) e a identidade (nome e rosto) de parte dos brasileiros do mesmo clube, porque os nomes são pedidos por nacionalidade (`${seed}-names-${clubId}-${nationality}`) e o grupo `BR` fica maior. Por isso mudam o `new-game.json` e o `digest` de `round-first.json`, `season-full.json`, `season-human-simplified.json` e `season-turn.json`; os goldens de partida, `strengths.json`, `players.json` e `foundations.json` não podem mudar. Sobe `ENGINE_VERSION` e roda `npm run golden:update -w app`.
- **Aceite:** (1) em 40 carreiras (as sementes do teste atual), 100% dos jogadores gerados com `nationality = BR`; (2) o diff dos goldens toca só `nationality`, nome, rosto e `digest`, e nenhum placar, ponto ou força; (3) `npm run balance -- --seasons 200` com as mesmas métricas de antes, número a número (a nacionalidade não entra no cálculo); (4) um save de antes, com jogadores `AR` ou `UY`, carrega e valida sem erro.

## Limites dos campos (o validador do save confere)

| Campo            | Faixa                   | Tipo    | Por quê                                                                                                                                                                                                                     |
| ---------------- | ----------------------- | ------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| atributos        | 1 a 99                  | inteiro | regra da nota                                                                                                                                                                                                               |
| `overall`        | 1 a 99, igual à fórmula | inteiro | 35–92 só na geração; a evolução pode sair dessa faixa                                                                                                                                                                       |
| `potential`      | `overall` a 99          | inteiro | teto; 95 é o máximo na geração                                                                                                                                                                                              |
| `age`            | 15 a 99                 | inteiro | a geração e a base dão 17 a 34, e com a aposentadoria variável (T-048) ninguém joga uma temporada com 40 ou mais; a faixa larga fica da T-017 e é só sanidade (saves de antes da renovação podem ter jogadores acima de 40) |
| `peakAge`        | 26 a 29                 | inteiro | curva pessoal                                                                                                                                                                                                               |
| `growth`         | 0,5 a 1,5               | real    | as faixas mais largas de `players.growthMin/Max`: mudar o parâmetro não invalida saves antigos                                                                                                                              |
| `shirt`          | 1 a 99                  | inteiro | única no clube (validada na montagem do elenco, T-006)                                                                                                                                                                      |
| `condition`      | 0 a 100                 | real    | ver "Frações"                                                                                                                                                                                                               |
| `morale`         | 0 a 100                 | real    | ver "Frações"                                                                                                                                                                                                               |
| `yellowCount`    | 0 a 2                   | inteiro | o 3º amarelo zera o contador e gera suspensão                                                                                                                                                                               |
| lesão, suspensão | ≥ 0                     | inteiro | contadores                                                                                                                                                                                                                  |

Projetado (com o ADR do save): `secondaryPosition`, uma posição de linha diferente da natural, ou nenhuma; goleiro nunca. Regra do validador em [posicao-secundaria.md](posicao-secundaria.md), "Parâmetros e limites".

## Casos de borda

| Caso                                                     | Regra                                                                                                                                                                                  |
| -------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Evolução levaria um atributo acima de 99 ou abaixo de 1  | corta na borda; o ajuste fino compensa em outro atributo de peso > 0                                                                                                                   |
| Fórmula arredondada passaria do potencial                | não acontece: o alvo já respeita o potencial e o ajuste fino o atinge                                                                                                                  |
| Goleiro na linha precisa de `finishing`/`passing`/etc.   | "Atributo ausente": `round(0.4 × overall)`                                                                                                                                             |
| Jovem já no potencial                                    | Δ positivo vira 0; Δ negativo (raro, pelo ruído) vale                                                                                                                                  |
| Jogador que não entrou em campo na temporada             | minutos 0 (fator 1,0); evolui normalmente                                                                                                                                              |
| Veterano em queda abaixo do potencial                    | o ruído pode dar Δ positivo (raro); vale, até o potencial                                                                                                                              |
| Jogador com 33 a 39 anos depois do aniversário da virada | um sorteio pela tabela da idade (goleiro ou linha; `temporada.md`, "Carreira longa na 1a"): se sai, entra um jovem de 17 da base na mesma posição; o elenco segue com 25 e 3/5/4/4/4/5 |
| Jogador completa 40 anos na virada                       | aposenta-se sempre, sem sorteio, goleiro ou não                                                                                                                                        |
| Jogador de 40 ou mais num save antigo                    | aposenta-se na primeira virada, como o de 40                                                                                                                                           |
| Ídolo se aposenta                                        | o clube escolhe um novo na mesma virada (ver "Traço de personalidade"), e o contador do banco volta a 0                                                                                |
| Jovem da base com potencial alto                         | vale o sorteio da regra de até 23 anos; o piso da joia é só da geração do elenco, e a base não cria joia nova                                                                          |
| Clube sem titular ≥ 29 para ídolo                        | ídolo é o titular de maior overall                                                                                                                                                     |
| Dois jogadores gerados com o mesmo nome no clube         | o gerador de nomes resolve (fora do motor); o motor usa IDs                                                                                                                            |
| Lista de clubes sem `strength` ou com porte inválido     | `strength` ausente vira 70; porte inválido vira médio; registra aviso                                                                                                                  |

Casos de borda da posição secundária (goleiro, save antigo, tabela que muda, escalação com natural e secundário empatados): [posicao-secundaria.md](posicao-secundaria.md), "Casos de borda".
