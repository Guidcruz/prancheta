# ADR-0017: Efeito suspensivo fiel ao real (a pena não dobra)

- **Status:** Aceito (CEO, 2026-11-05)
- **Data:** 2026-11-05
- **Decisores:** game-designer (pesquisou e propôs em `docs/design/brasilidades.md`), architect (redigiu), CEO (decidiu em 2026-11-05)
- **Substitui em parte:** `docs/PROJETO.md` › "STJD (Etapa 2, com o calendário completo)", a linha sobre expulsão e efeito suspensivo.

## Contexto

O `docs/PROJETO.md` diz que, se o técnico pedir efeito suspensivo e a pena for confirmada, ela dobra. A regra não tinha fonte. A pesquisa de 2026-11-05 (`docs/design/brasilidades.md` › "Efeito suspensivo: como funciona no real", com as fontes) mostra que no CBJD a pena não dobra. A expulsão dá 1 jogo de suspensão automática, descontado da pena da 1ª instância. Acima de 2 jogos, o efeito suspensivo vem da lei (art. 147-B): o jogador cumpre 2 jogos e joga até o Pleno. O risco real é o Pleno manter, reduzir, absolver ou aumentar a pena; o que sobrar é cumprido logo depois, sejam quais forem os jogos.

O `docs/PROJETO.md` está congelado e não é editado. Este ADR prevalece sobre o trecho abaixo, na versão de 2026-11-05:

- linha 214: "Expulsão por agressão: julgamento em 2 a 4 rodadas, pena de 2 a 6 jogos. O técnico decide pedir **efeito suspensivo**: o jogador segue jogando até o julgamento; se a pena for confirmada, dobra. Chance de absolvição: 30%; de redução: 30%; de confirmação: 40%."

As outras linhas da seção (cartões, escalação irregular, torcida, liminar) continuam valendo. A linha 216 ("Recurso ao Pleno") continua valendo para as penas que não são de jogador por vermelho direto (perda de mando, multa); para estas, vale o Pleno deste ADR.

## Opções consideradas

| Opção                                                  | Prós                                                                                 | Contras                                                                                |
| ------------------------------------------------------ | ------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| A: manter a regra do PROJETO ("se confirmada, dobra")  | já escrita                                                                           | não existe no real; quem conhece futebol percebe; a escolha vira aposta sem informação |
| B: regra fiel ao real, aprovada pelo CEO, simplificada | fiel ao CBJD; a escolha depende do parecer e do calendário, que o técnico vê na tela | mais estado por jogador (motivo, pena, recurso); mais parâmetros para o `/balance`     |

## Decisão

Opção B. A regra completa, com parâmetros e casos de borda, é a de `docs/design/brasilidades.md` › "Regra aprovada (CEO, 2026-11-05; entra na Etapa 2)", que é a fonte. Em resumo:

1. **Vermelho direto ganha um motivo**, sorteado no lance: impedir gol (pena de 1 jogo), jogada violenta (1 a 3 jogos) ou agressão (4 a 6 jogos). O segundo amarelo continua só na automática.
2. **Automática e julgamento:** o expulso fica 1 jogo de fora na hora; o STJD julga na rodada seguinte e desconta esse jogo da pena.
3. **Recurso só com pena de 3 jogos ou mais.** O técnico escolhe, vendo o parecer do jurídico e os próximos adversários: **cumprir agora** (perde a pena em sequência) ou **recorrer ao Pleno** (cumpre 2, automática inclusa, joga até o Pleno, 2 rodadas depois, e cumpre o que o Pleno decidir).
4. **O Pleno** absolve, reduz 1, mantém ou aumenta 1 jogo, com chances fixadas pelo parecer (favorável, dividido ou desfavorável). Absolvição não devolve os 2 jogos já cumpridos. A pena nunca dobra.

Simplificações aprovadas:

- sem efeito suspensivo para pena de até 2 jogos (no real é exceção, a critério do relator);
- a Procuradoria não tem recurso próprio (quem cumpre agora não corre risco de aumento);
- o recurso não custa dinheiro.

**Frequência esperada** (conta, ainda sem simulação): uma tela de recurso para o clube do técnico a cada duas temporadas, mais ou menos. Se o CEO quiser mais, o ajuste é o peso do motivo `assault`, não a regra.

## Consequências

- **Positivo:** a regra é a do futebol brasileiro; a decisão do técnico tem informação (parecer, tabela, calendário) em vez de azar puro.
- **Negativo:** mais estado no motor e no save, e mais parâmetros para calibrar.
- **Etapa:** entra na Etapa 2, junto com o STJD. Nada muda na 1a (lá o vermelho dá só a automática).
- **Motor:** ganha o motivo do vermelho direto (`redReason` no evento) e a pena por jogador (`banGames`, `appealPending`, `plenoRound`; nomes finais do `developer`). O estado novo no save segue o ADR-0006 (versão e migração).
- **Parâmetros:** os de `brasilidades.md` (`stjd.*`) vão para `app/src/params/` quando o STJD for implementado; as constantes da lei (automática descontada, efeito só acima de 2 jogos, 2 jogos cumpridos antes do efeito, passo de 1 jogo no Pleno) ficam no motor.
- **`/balance`:** mede, por temporada, as telas de recurso por clube e os jogos perdidos de quem recorreu e de quem cumpriu (critérios de aceite em `brasilidades.md`: 0,3 a 0,7 tela por clube e temporada; com parecer desfavorável, recorrer e cumprir a até ±0,2 jogo).

## Conformidade

Na Etapa 2, revisão de código: nenhuma regra de pena dobrada; recurso só oferecido com pena de 3 jogos ou mais; o resultado do Pleno vem só de `stjd.plenoOutcomes` pelo parecer. O `/balance` imprime as métricas acima contra os critérios de aceite.
