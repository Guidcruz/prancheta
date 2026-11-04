# ADR-0011: Fator casa fixo além da torcida (`match.homeBase`)

- **Status:** proposta (decisão de diversão do CEO; o architect só redigiu)
- **Data:** 2026-11-04
- **Decisores:** game-designer (propôs em `docs/design/balance-targets.md`, decisão 1), architect (redigiu), CEO (decide)

## Contexto

O `docs/PROJETO.md` e o ADR-0005 fixam o bônus de mando de campo pela torcida entre +2% (torcida fria) e +8% (em festa), mais +2% em clássico. No protótipo do `game-designer`, só com isso o mandante vence 42,4% dos jogos. No Brasileirão real, o mandante vence perto de 48%. A meta proposta em `balance-targets.md` é de 45% a 50%. Somar um fator fixo muda, na prática, a faixa escrita no ADR-0005, por isso pede ADR.

## Opções consideradas

| Opção                                         | Prós                                                                                                   | Contras                                                                                 |
| --------------------------------------------- | ------------------------------------------------------------------------------------------------------ | --------------------------------------------------------------------------------------- |
| A: `match.homeBase = 0.05` (+5% fixo)          | mandante vence cerca de 47% (protótipo), como no futebol brasileiro; jogar em casa "pesa"               | o mando total vai a +7% a +13%; a torcida passa a ser uma parte menor do mando          |
| B: `match.homeBase = 0` (só a torcida)         | mantém exatamente o ADR-0005; a torcida é todo o mando                                                  | mandante vence cerca de 42%; a meta precisa cair para 40% a 45%                          |
| C: valor intermediário (ex.: 0,03)             | meio-termo                                                                                              | sem base de realismo; mais uma rodada de calibração                                      |

## Decisão

Pendente do CEO. Recomendação do `game-designer`: **A**. O architect não opina sobre diversão. Tecnicamente, as três opções custam o mesmo: o motor recebe `match.homeBase` por parâmetro (faixa válida 0 a 0,08), e o valor padrão no repositório fica 0 até a aprovação.

## Consequências

- **Se A:** `app/src/params/match.json` passa a ter `homeBase: 0.05`. A meta de vitórias do mandante fica em 45% a 50%. O ADR-0005 continua valendo para a parte da torcida (+2% a +8%, clássico +2%), e esta ADR acrescenta o fator fixo.
- **Se B:** `homeBase` fica 0 e a meta de `balance-targets.md` cai para 40% a 45% (proposta do `game-designer` aprovada pelo CEO).
- **Pendências:** um `/balance` com três sementes depois da escolha (T-016).

## Conformidade

O `/balance` imprime a vitória do mandante contra a meta da opção escolhida. Mudar `match.homeBase` depois disso é ajuste de parâmetro (`/quick` + `/balance`), não ADR, enquanto ficar na faixa aprovada aqui.
