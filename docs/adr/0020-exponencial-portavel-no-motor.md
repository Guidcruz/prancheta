# ADR-0020: Exponencial própria no motor, igual bit a bit em qualquer motor JavaScript

- **Status:** aceita (CEO, 2026-11-07: "1 e 2 ok", abrir a correção do determinismo entre motores JavaScript; a forma técnica abaixo é do `architect`)
- **Data:** 2026-11-07
- **Decisores:** devops-engineer (mediu, T-024), architect (propôs e redigiu), CEO (aprovou abrir a correção)
- **Complementa:** ADR-0007, regra 9 ("se divergir do V8, troca-se a implementação em `math.ts` por uma própria"). Este ADR é essa troca e diz como ela é feita e conferida.

## Contexto

O ADR-0007 promete que a mesma semente dá o mesmo resultado em qualquer lugar: no navegador do jogador, no Node do `/balance` e dos goldens, e no Workers do servidor da 1b. A regra 9 já previa o risco: o ECMAScript não exige arredondamento correto de `Math.exp`, `Math.pow` e das outras funções transcendentes. Cada motor (V8, JavaScriptCore, SpiderMonkey) e cada versão de motor pode devolver um resultado diferente no último bit.

**Medição da T-024 (devops-engineer, 2026-11-07).**

- O `Math.exp` do Chromium 153 (V8 14) difere do Node 22 (V8 12.4) no último bit em 579 de 6.001 valores medidos, cerca de 10%. O `Math.pow` diverge de forma parecida (o motor já evita `pow`).
- Dos 5 goldens de partida refeitos no navegador, 3 divergem (`match-round`, `match-ai-sheets` e `match-commands`) e 2 batem (`match-derby` e `match-short-handed`). Exemplo: `pGoal` vale 0.15751095014892763 no Node e 0.1575109501489276 no Chromium.
- A página do golden reproduz os 5 goldens no Node. Então a diferença vem do motor JavaScript, não do empacotamento.
- O WebKit ainda não foi medido (só roda no CI). O teste do golden no navegador está em `test.fixme` na branch da T-024.

**Efeito hoje.** Na carreira, o resultado é gravado e nunca recalculado. No online, só o servidor simula. Nenhum jogador perde nada hoje. Mas três coisas ficam quebradas:

1. A promessa do ADR-0007.
2. O golden no navegador, que o `docs/03-test-plan.md` (§4, item 5) trata como bloqueante.
3. A base do teste "servidor × cliente" (US-056). O servidor roda num V8 novo (Workers), o `/balance` e os goldens rodam no Node 22, e um dia o Node do projeto também sobe de versão.

Basta 1 bit de diferença em `pGoal` para mudar um sorteio, e daí em diante a partida toda.

### Levantamento das funções de `Math` no motor

Feito em `app/src/engine/**/*.ts`, sem testes nem bancadas (código de 2026-11-07, `ENGINE_VERSION` 15).

| Função                                                                                                                        | Usos                                                                                                                                                                                                                                               | Exata pela especificação?                                         | Decisão                                |
| ----------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------- |
| `Math.exp`                                                                                                                    | 1, em `math.ts` (`exp`). Chamada por `chanceProbability` (`match/rules.ts`, uma vez por time e por minuto) e por `goalProbability` (`match/rules.ts`, uma por finalização). Fora do motor: `scripts/balance/robot.ts` (`exp(-lambda)`, só no Node) | **não**                                                           | **troca** pela implementação deste ADR |
| `Math.pow`, `**`                                                                                                              | 0 (`players.ts` calcula U^1,5 como `u * Math.sqrt(u)`; o lint já proíbe `**`)                                                                                                                                                                      | não                                                               | proibido (já é)                        |
| `log`, `log1p`, `log2`, `log10`, `expm1`, `sin`, `cos`, `tan`, `asin`, `acos`, `atan`, `atan2`, hiperbólicas, `cbrt`, `hypot` | 0                                                                                                                                                                                                                                                  | não                                                               | proibido, também em `math.ts`          |
| `Math.sqrt`                                                                                                                   | 3 (`generation.ts` 2×, distribuição triangular; `players.ts` 1×)                                                                                                                                                                                   | sim: o IEEE-754 exige arredondamento correto                      | permitido                              |
| `Math.SQRT2`                                                                                                                  | 1 (`math.ts`, `normal`)                                                                                                                                                                                                                            | sim: a especificação fixa o valor (o double mais próximo de √2)   | permitido                              |
| `Math.round`                                                                                                                  | 12 (`season.ts`, `generation.ts`, `players.ts`, `match/simulate.ts`, `match/rules.ts`, `match/summary.ts`)                                                                                                                                         | sim: definida exatamente (o inteiro mais próximo, empate para +∞) | permitido                              |
| `Math.floor`, `Math.ceil`, `Math.trunc`, `Math.abs`, `Math.sign`, `Math.min`, `Math.max`                                      | 21 `floor`, 2 `ceil`, 11 `abs`, 12 `min`, 21 `max`                                                                                                                                                                                                 | sim: resultado exato                                              | permitido                              |
| `Math.imul`, `Math.clz32`, `Math.fround`                                                                                      | 3 `imul` (`rng.ts`)                                                                                                                                                                                                                                | sim: definidas bit a bit                                          | permitido                              |
| `Math.random`                                                                                                                 | 0 (só no comentário de `rng.ts`)                                                                                                                                                                                                                   | não determinística                                                | proibido (já é)                        |

A única função não exata em uso é a `exp`, e ela já passa toda por `math.ts`. As quatro operações (`+ - * /`) são exatas no sentido que importa aqui. O ECMAScript define cada uma como a operação do IEEE-754 binary64 com arredondamento ao par mais próximo. A especificação não permite precisão estendida, nem fundir multiplicação e soma (FMA) por conta própria, como um compilador C pode fazer. Logo, a mesma sequência de operações dá os mesmos bits em qualquer motor conforme. A conversão de número para texto (`JSON.stringify`) também é definida exatamente, então o golden em texto não acrescenta diferença.

## Opções consideradas

| Opção                                                                                                                                                                                         | Prós                                                                                                                                                                                                                             | Contras                                                                                                                                                                                                                               |
| --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: manter `Math.exp` e restringir a promessa a "mesmo motor JavaScript"                                                                                                                       | nenhum trabalho                                                                                                                                                                                                                  | quebra o ADR-0007; o golden no navegador sai do E2E; o servidor (Workers, V8 novo) e o Node dos testes divergem, e o teste "servidor × cliente" da US-056 não prova nada; cada atualização do Node pode mudar goldens e balanceamento |
| B: `exp` própria, um port do `e_exp.c` do fdlibm (redução por `ln 2` com a constante dividida em parte alta e baixa, mais aproximação racional), só com `+ - * /`, `Math.trunc` e comparações | igual bit a bit em qualquer motor IEEE-754; erro menor que 1 ulp (garantia do fdlibm); **medido igual bit a bit ao `Math.exp` do Node 22.23.4** em 10,8 milhões de entradas, então os dados dos goldens e o `/balance` não mudam | cerca de 50 linhas a manter; de 1,4 a 3 vezes mais lenta que a nativa (irrelevante no total, ver "Custo"); aviso de licença da Sun no arquivo                                                                                         |
| C: `exp` com arredondamento correto (estilo CORE-MATH ou crlibm, com aritmética de precisão dupla-dupla e tabelas)                                                                            | determinística e exata no último bit                                                                                                                                                                                             | código grande e difícil de revisar; mais lenta; difere do Node em uma fração das entradas, então os goldens mudam e o `/balance` precisa ser refeito; exatidão no último bit não é requisito do jogo, só a igualdade entre motores    |
| D: tirar a exponencial do modelo (tabela por diferença inteira, ou polinômio simples no lugar da curva)                                                                                       | sem função transcendente                                                                                                                                                                                                         | muda as fórmulas de `docs/design/partida.md` e a calibragem do ADR-0018 (`kChance` 0,125); refazer o balanceamento inteiro por um problema de último bit                                                                              |
| E: arredondar o resultado de `Math.exp` (por exemplo, a 12 casas)                                                                                                                             | uma linha                                                                                                                                                                                                                        | não resolve: um valor que cai perto da fronteira do arredondamento continua divergindo; só fica mais raro, e o golden continua sem garantia                                                                                           |

## Decisão

**B.** A `exp` do motor passa a ser definida pela nossa própria aritmética, e não pelo motor JavaScript que a executa.

### Contrato (`app/src/engine/math.ts`)

```ts
/** e^x by arithmetic only (ADR-0020): the same bits on every IEEE-754 JavaScript engine. */
export function exp(x: number): number;
```

- **Algoritmo:** o do `e_exp.c` do fdlibm (Sun, 1993), passo a passo, sem leitura de bits:
  1. Casos especiais, nesta ordem:
     - `NaN` devolve `NaN`;
     - `x > 709.782712893384` devolve `Infinity` (inclui `+Infinity`);
     - `x < -745.1332191019411` devolve `0` (inclui `-Infinity`);
     - `x === 1` devolve `Math.E`, o valor com arredondamento correto. O fdlibm puro dá 1 ulp acima, e o Node 22 também trata esse caso à parte.
  2. Se `|x| < 2^-28` (3.725290298461914e-9), devolve `1 + x`.
  3. **Redução:** `x = k·ln 2 + r`, com `|r| ≤ ln 2 / 2`.
     - `k = 0` se `|x| < 0.3465735912322998` (é o `0x3fd62e42` da palavra alta do fdlibm, escrito como double).
     - `k = ±1` se `|x| < 1.0397205352783203` (`0x3ff0a2b2`).
     - Nos outros casos, `k = Math.trunc(INV_LN2 * x ± 0.5)`.
     - `hi = x - k * LN2_HI` e `lo = k * LN2_LO`. Os bits baixos de `LN2_HI` são zero, então `k * LN2_HI` é exato para todo `k` do domínio.
  4. **Aproximação** em `[-ln 2/2, ln 2/2]`:
     - `t = r²`;
     - `c = r - t·(P1 + t·(P2 + t·(P3 + t·(P4 + t·P5))))`;
     - `y = 1 - ((lo - r·c/(2 - c)) - hi)`. Com `k = 0`, é `1 - ((r·c)/(c - 2) - r)`.
     - O polinômio de Remez de grau 5 em `r²` fica dentro de uma fórmula racional do tipo Padé. O fdlibm documenta o erro da aproximação abaixo de 2^-59, e o erro final menor que 1 ulp.
  5. **Escala:** `y · 2^k`, com `2^k` montado por multiplicações de potências de 2, que são exatas (quadrados sucessivos de `2` ou de `0.5`, ou uma tabela de constantes, à escolha do developer).
     - Para `k < -1021`, faz `y · 2^(k+1000) · 2^-1000`. É o mesmo passo do fdlibm: resultado subnormal, com um único arredondamento.
     - Para `k = 1024`, faz `y · 2 · 2^1023`.
- **Constantes** (as do fdlibm). Ficam escritas em decimal no código, e um teste confere os bits de cada uma:

  | Nome          | Valor                       | Bits (hex)           |
  | ------------- | --------------------------- | -------------------- |
  | `LN2_HI`      | 6.93147180369123816490e-01  | `0x3fe62e42fee00000` |
  | `LN2_LO`      | 1.90821492927058770002e-10  | `0x3dea39ef35793c76` |
  | `INV_LN2`     | 1.44269504088896338700e+00  | `0x3ff71547652b82fe` |
  | `P1`          | 1.66666666666666019037e-01  | `0x3fc555555555553e` |
  | `P2`          | -2.77777777770155933842e-03 | `0xbf66c16c16bebd93` |
  | `P3`          | 6.61375632143793436117e-05  | `0x3f11566aaf25de2c` |
  | `P4`          | -1.65339022054652515390e-06 | `0xbebbbd41c5d26bf1` |
  | `P5`          | 4.13813679705723846039e-08  | `0x3e66376972bea4d0` |
  | `O_THRESHOLD` | 7.09782712893383973096e+02  | `0x40862e42fefa39ef` |
  | `U_THRESHOLD` | -7.45133219101941108420e+02 | `0xc0874910d52d3051` |

- **Só aritmética:** dentro de `exp`, só `+ - * /`, comparações, `Math.trunc` (ou `Math.floor`) e `Math.E`. Nada de `Float64Array`, `DataView` ou `BigInt`. O código fica legível e não depende da ordem dos bytes da máquina.
- **Licença:** o aviso do fdlibm ("Permission to use, copy, modify, and distribute this software is freely granted, provided that this notice is preserved.") vai copiado no topo da função em `math.ts`. O fdlibm é a base do `StrictMath` do Java e de boa parte da matemática do próprio V8. A preservação do aviso é a única condição da licença.

### Prova feita pelo `architect` (protótipo descartável, fora do repositório)

- **Igualdade com o Node.** Em Node 22.23.4, o protótipo dá os mesmos bits que `Math.exp` em todas as 10.800.024 entradas testadas:
  - 4 milhões aleatórias em [-6, 6], a faixa do jogo;
  - 2 milhões em [-730, 730];
  - 300 mil vizinhas (em ulps) de cada lado dos dois limites de `k`, nos dois sinais;
  - os casos especiais (`±0`, `±1`, `±Infinity`, `NaN`, os limiares, subnormais).
  - Sem o caso `x === 1`, a única diferença em 5,3 milhões de pontos foi `exp(1)`.
- **Consequência:** a troca não muda os dados de nenhum golden nem o resultado do `/balance` no Node. Ela só passa a valer igual também nos navegadores e no Workers.
- **Custo:** 10 milhões de chamadas em [-3, 3] levaram de 105 a 124 ms com `Math.exp` e de 150 a 314 ms com o protótipo, ou seja, de 5 a 20 ns a mais por chamada.
  - Uma partida chama a `exp` cerca de 2 vezes por minuto (`chanceProbability`, um por time) mais uma vez por finalização (`goalProbability`). São cerca de 200 a 230 chamadas, ou menos de 5 µs por partida e menos de 50 µs por rodada.
  - A rodada mede de 6,7 a 7,8 ms no Node (§4.1, T-014), então o acréscimo fica abaixo de 1%. O gatilho de 8 ms de CPU do servidor (§5) não muda.

### Lint

A trava de transcendentes de `app/eslint.config.js` (`Math.exp`, `log*`, `pow`, `expm1`, `cbrt`, `hypot`, trigonométricas e hiperbólicas) passa a valer em **todo** `app/src/engine/`, inclusive `math.ts`, que perde a exceção. O `**` continua proibido. Ficam permitidas, por serem exatas pela especificação:

- `Math.sqrt`, `Math.floor`, `Math.ceil`, `Math.round`, `Math.trunc`;
- `Math.abs`, `Math.sign`, `Math.min`, `Math.max`;
- `Math.imul`, `Math.clz32`, `Math.fround`;
- as constantes de `Math` (`E`, `SQRT2` e as outras).

Testes e bancadas (`*.test.ts`, `*.bench.ts`, `testing/`) seguem livres, porque o teste de propriedade compara com `Math.exp`. A mensagem do lint passa a citar este ADR. Uma transcendente nova que o motor precise (um `log`, por exemplo) segue o mesmo caminho: implementação própria em `math.ts` só com aritmética, teste de bits e golden de tabela. Isso não exige ADR novo enquanto seguir este.

### Versão do motor

**`ENGINE_VERSION` sobe para 16**, mesmo que os dados dos goldens não mudem no Node. A regra 7 do ADR-0007 só obriga a subir quando a saída muda. Aqui, sobe porque muda a definição do algoritmo: até a versão 15, o resultado dependia do motor JavaScript que rodava o jogo; da 16 em diante, depende só da semente. O estado guarda `engineVersion`, então um save diz qual das duas promessas valia quando foi simulado. O custo é só regravar os goldens: mudam os digests que guardam a versão (new-game, rodadas, temporada, virada) e o campo de versão dos outros.

**Qualquer outra mudança nos dados de um golden é bug do port, não regravação.** Pelo protótipo, não deve haver nenhuma.

## Consequências

- **Positivo:**
  - A promessa do ADR-0007 vale de fato: mesma semente, mesmo resultado no Node, no Chromium, no WebKit e no Workers, em qualquer versão de cada um.
  - O teste "servidor × cliente" (US-056) passa a provar algo também fora do Node.
  - Atualizar o Node do projeto ou o `compatibility_date` do Workers não muda mais goldens nem balanceamento.
  - Os dados dos goldens e as metas do `/balance` continuam os mesmos, porque o port é igual bit a bit ao Node 22.
- **Negativo:**
  - Cerca de 50 linhas de matemática numérica a manter, com o aviso de licença.
  - A `exp` fica de 1,4 a 3 vezes mais lenta que a nativa, menos de 1% da rodada.
  - Toda transcendente nova no motor exige implementação própria e testes de bits, em vez de uma chamada a `Math`.
- **Pendências:**
  - A tarefa nova **T-074** (§7 de `docs/02-architecture.md`).
  - O §9 da arquitetura (risco do `Math.exp`) passa a apontar para este ADR.
  - Depois da T-074, o QA atualiza o `docs/03-test-plan.md` (§4, item 5, e a linha "Determinismo cliente × servidor × navegador") para dizer que o golden no Chromium e no WebKit é obrigatório e cobre também a tabela da `exp`.

## Testes (com o `qa-engineer`)

1. **Bits das constantes (U).** Cada constante da tabela acima, lida por `DataView` no teste, bate com o hex. Isso pega um dígito trocado no literal decimal.
2. **Casos especiais (U).** São estes:
   - `exp(NaN)` é `NaN`;
   - `exp(±0)` é 1;
   - `exp(1) === Math.E`;
   - `exp(Infinity)` é `Infinity` e `exp(-Infinity)` é 0;
   - nos dois limiares e em 1 ulp de cada lado, `Infinity`/finito e 0/subnormal;
   - um subnormal conhecido.
3. **Golden de tabela (G), o teste que garante a portabilidade.** `app/src/engine/__golden__/exp-table.json`, gerado pelo `golden:update` e com `ENGINE_VERSION`, guarda 4.096 entradas e o resultado de cada uma em hex (16 dígitos). As entradas são:
   - uma grade semeada em [-6, 6], a faixa do jogo (os argumentos do motor ficam em `kChance·Δ/10` e `kFinish·Δ/10`, com as faixas de `validateParams`);
   - uma grade em [-745, 709];
   - os vizinhos dos limites de `k`;
   - os casos especiais.

   O teste não compara com `Math.exp` de nenhum ambiente: compara com bits congelados. Ele roda no Vitest (Node) e também na página do golden do E2E, ao lado dos 5 goldens de partida.

4. **Propriedade de exatidão (P).** Para `x` sorteado com semente em [-745,13; 709,78], a distância em ulps entre `exp(x)` e o `Math.exp(x)` do ambiente é no máximo **1**. São 10.000 pontos no modo rápido e 10 milhões com `PROPERTY_FULL=1`. No Node 22.23.4, a distância medida foi 0 em todos os pontos; outro ambiente pode chegar a 1, porque os dois erros ficam abaixo de 1 ulp. Distância maior que 1 indica erro no port. O teste usa a tolerância e não a igualdade para não quebrar quando o Node do projeto subir de versão.
5. **Monotonia (P).** Para `x` sorteado, `exp(x) ≤ exp(x⁺)`, onde `x⁺` é o double seguinte a `x`. Isso pega um erro de sinal ou de limite na redução que a tabela poderia não cobrir.
6. **Golden no navegador (E), agora obrigatório.** Em `tests/e2e/golden.spec.ts`, sai o `test.fixme` (`KNOWN_DIVERGENCE`). Os 5 goldens de partida e o `exp-table` têm de bater byte a byte no Chromium **e** no WebKit do CI. Divergência continua bloqueante (`docs/03-test-plan.md`, §4, item 5) e entra na suíte de regressão.
7. **Lint (C).** Um teste de fronteira prova que `Math.exp` em `app/src/engine/math.ts` e em outro arquivo do motor é recusado pelo ESLint. É o mesmo padrão dos testes de fronteira que já existem.

## Conformidade

- `Math.exp`, `Math.log*`, `Math.pow`, `**` e as outras transcendentes em `app/src/engine/` fora de testes e bancadas são erro de lint. Desligar a regra (`eslint-disable`) no motor é BLOCKER na revisão.
- A `exp` de `math.ts` só usa `+ - * /`, comparações, `Math.trunc`/`Math.floor` e `Math.E`. `Float64Array`, `DataView` ou `BigInt` dentro dela é BLOCKER.
- Mudança em `math.ts` que altere um bit do `exp-table.json` exige subir `ENGINE_VERSION`. O teste de golden já confere isso.
- O job `e2e` reprovando o golden em qualquer navegador bloqueia o PR. Não existe `fixme` nem quarentena para ele.
