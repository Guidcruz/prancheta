# Auditoria geral — Eixo A (planejamento) — 2026-11-05

Base: `origin/main` em `5498ccc` (36 commits desde `fb313d0`). Só leitura. Achados ordenados por gravidade; nenhum achado **crítico** (não encontrei violação de regra não negociável nem decisão que leve a construir a coisa errada já em código).

## Achados

**1. (Alta) Índice de decisões parou no ADR-0015.**
Onde: `/home/user/prancheta/docs/decisions.md` (última alteração no PR #19); `/home/user/prancheta/docs/adr/0016-audio-essencial-sem-custo.md` e `/home/user/prancheta/docs/adr/0017-efeito-suspensivo-fiel-ao-real.md` (ambos "Aceito, 2026-11-05").
Problema: dois ADRs aceitos pelo CEO não aparecem na tabela "Decisões vigentes", que é o ponto de entrada de quem procura o que vale. `docs/papeis.md` exige "decisão aprovada vira ADR no mesmo dia"; o ADR existe, o índice não.
Recomendação: `tech-writer` acrescenta as linhas 0016 e 0017; incluir a atualização do índice no checklist do DoD ("Docs atualizados").

**2. (Alta) US-070 a US-074 estão "prontas" sem tarefa, sem teste planejado e com dependência escondida.**
Onde: `/home/user/prancheta/docs/01-requirements.md:89-93` (Should, 1a, estado "pronta"); `/home/user/prancheta/docs/02-architecture.md:1191` ("T-045 e T-046 estão reservados para o placar ao vivo"); `/home/user/prancheta/docs/03-test-plan.md` (nenhuma linha US-070…074); `02-architecture.md:1169` (T-047 lista US-073/US-074 nas histórias).
Problema: cinco histórias aprovadas pelo CEO (decisões D9–D11) não têm linha na quebra técnica §7 nem no mapa de testes; a T-047 (áudio) implementa os sons do plantão (US-073/074) e só declara dependência da T-033, mas o plantão não existe em tarefa nenhuma. Pelo DoR (`docs/DEFINITION-OF-DONE.md:7`), essas histórias não podem entrar em desenvolvimento.
Recomendação: `architect` cria T-045/T-046 (faixa + tabela ao vivo; plantão + preferência) com dependências (T-032/T-033, T-031) e põe T-047 dependente de T-046; `qa-engineer` adiciona as linhas no mapa §9.

**3. (Alta) `02-architecture.md` desatualizado onde o DoR e o ok do CEO se apoiam.**
Onde: `/home/user/prancheta/docs/02-architecture.md:5` ("ADRs desta etapa, todos propostos, aguardando o CEO"); `:1132-1141` (T-008 a T-016 "feita (PR em aberto)", T-017 "a fazer", apesar do PR #31 mergeado); `:1193-1210` (§8 lista como pendentes as decisões 1, 2, 3, 7 e 8, todas tomadas em 2026-11-04, cf. `docs/status.md:52-53`); `:1227` ("Aprovação do CEO: ☐").
Problema: o documento que o DoR chama de "quebra técnica aprovada" diz que nada foi aprovado e que a T-017 não foi feita. Quem entra do zero (subagente) lê isso como verdade.
Recomendação: `tech-writer`/`architect` atualizam cabeçalho, coluna Estado (com nº do PR) e §8 (marcar o que foi decidido, deixar só 4 e 6 como registro), e marcam a aprovação com data.

**4. (Alta) US-025 diz menos do que o motor faz e exclui o que ele já faz.**
Onde: `/home/user/prancheta/docs/01-requirements.md:1063-1090` (critérios: campeão, zona, nova temporada, determinismo; "Fora do escopo: Metas e avaliação da diretoria (Etapa 4)"); `/home/user/prancheta/docs/design/temporada.md:122-145,168,251` (expectativa da diretoria informativa, `targetPosition`, "meta cumprida ou não" na campanha); `02-architecture.md:784` (`TARGET_MARGIN`, `TARGET_POSITION_MAX` no motor); `CHANGELOG.md` (prêmios, seleção, revelação, campanha).
Problema: prêmios (artilheiro, garçom, melhor jogador, revelação, goleiro, seleção), campanha do clube e a meta da diretoria informativa foram implementados na T-017 sem critério de aceite em história nenhuma; pior, a US-025 declara a meta da diretoria fora de escopo, enquanto a decisão 6 do CEO (`balance-targets.md:100`) a põe na 1a "só como texto". Spec e código apontam para lados opostos; a T-037 (tela) vai desenhar sobre qual?
Recomendação: `product-manager` acrescenta à US-025 (ou a uma US nova) os critérios dos prêmios, da campanha e da meta informativa, e corrige o "Fora do escopo" para "cobrança, confiança e demissão (Etapa 4)".

**5. (Média) Nacionalidade dos jogadores: requisito diz "só brasileira", design e código geram 10% sul-americanos.**
Onde: `/home/user/prancheta/docs/01-requirements.md:177,200` ("Na Etapa 1 a nacionalidade é só brasileira; outras entram na Etapa 5"); `/home/user/prancheta/docs/design/jogadores.md:219` (90% BR, 10% CONMEBOL); `docs/status.md:257` ("estrangeiros saem com nome brasileiro até existir a lista em espanhol"); `status.md:385` (lista em espanhol como "Próximo").
Problema: é um vazamento de escopo da Etapa 5 para a 1a (bandeira/nacionalidade sem nomes coerentes), e gera trabalho novo (lista em espanhol) que o CEO não aprovou como item da 1a. Ou a US-003 está errada, ou o gerador está.
Recomendação: decisão do CEO (ver lista); depois, alinhar US-003/US-004 ou `jogadores.md` + `generation`.

**6. (Média) `status.md` e `CLAUDE.md` com estado velho.**
Onde: `/home/user/prancheta/CLAUDE.md` ("Status: Etapa 1a em andamento (T-001 a T-003 feitas)"); `/home/user/prancheta/docs/status.md:76-79` (T-014 a T-017 "PR aberto"), `:332-336` ("Em andamento": T-014 e T-016 com PR aberto; teste de patrocínio "em revisão"), `:259-261` ("Pendências abertas: /balance da T-016 deve medir grande rebaixado", já medido em `:131`), `:268` ("M1 (resolvido por este PR)").
Problema: o `CLAUDE.md` é lido por todo agente; o `status.md` é "o estado vivo" do roteiro. Os dois dizem que o motor está no começo.
Recomendação: `tech-writer` atualiza a linha de status do `CLAUDE.md` (até T-017) e consolida o `status.md` (seções "Em andamento", "Pendências abertas", tabela de tarefas com nº do PR).

**7. (Média) Plano de testes e arquitetura prometem no CI o que o CI não roda.**
Onde: `/home/user/prancheta/docs/03-test-plan.md:95` (job `ci` com `content:check`, `balance --seasons 200 --seed 1`, `check:precache`), `/home/user/prancheta/docs/02-architecture.md:1114` ("todo PR depois da T-016"); `/home/user/prancheta/.github/workflows/ci.yml` (roda tokens, lint, test, audit, build, conferência de saída; nenhum dos três).
Problema: um `/quick` em `app/src/params/` passa no CI sem o `/balance`, exatamente o risco que o plano diz cobrir. O `status.md:384` registra a pendência do `devops-engineer`, mas os documentos normativos falam no presente.
Recomendação: `devops-engineer` liga `content:check` já (barato) e mede o `/balance` no runner; `qa-engineer` muda o §4 para "planejado" até lá.

**8. (Média) Histórias dos dados de referência sem teste planejado; US-068 já parcialmente no motor.**
Onde: `/home/user/prancheta/docs/03-test-plan.md` (só US-069 e US-025 aparecem no mapa; nada de US-066, US-067, US-068); `02-architecture.md:792` (`careerLeagueTitles` implementado na T-017); `01-requirements.md:2657` (US-068 "entra na T-017 e na T-018, com ADR do `architect` e migração").
Problema: o ADR prometido para US-068 não existe (a decisão "derivado de `pastSeasons`, sem campo novo" está só na arquitetura); US-066 ("temporada base" registrada no save) não tem desenho em §4.2 nem tarefa.
Recomendação: `qa-engineer` acrescenta as linhas; `architect` decide se US-068 dispensa ADR (registrar) e onde a temporada base entra (T-018/T-019).

**9. (Média) Roteiro interno contradiz a 1a e usa palavra proibida de forma ambígua; o site não lê o texto dele.**
Onde: `/home/user/prancheta/docs/roadmap.md:12` (Etapa 4: "base, evolução, histórico"); `:11` (Etapa 3: "patrocínio"); `/home/user/prancheta/CLAUDE.md` ("o roteiro do site é lido de `docs/roadmap.md` no build") × `/home/user/prancheta/site/src/data/etapas-resumo.ts` (texto público próprio) e `site/src/pages/roadmap.astro:17` (`text="summary"`).
Problema: evolução e envelhecimento já são da 1a (US-025, T-017); "patrocínio" na Etapa 3 só pode ser a receita fictícia do clube (ADR-0015 §Consequências), mas sem adjetivo lê-se como o patrocínio real que o ADR manda não anunciar. O site mostra outro texto, então há duas fontes de "o que entra em cada etapa".
Recomendação: corrigir as duas células ("evolução" sai da 4; "patrocínio fictício na economia do clube"); ou o site passa a ler a coluna do roteiro, ou o `CLAUDE.md` passa a dizer que só estado e nome vêm dele.

**10. (Média) Metas do `PROJETO.md` encostadas na borda sem decisão registrada como ADR.**
Onde: `/home/user/prancheta/docs/design/balance-log.md:149,183-184` (20 pontos: 62,4–62,8% com piso 62; zebra 8,1–8,4% com piso 8; "o motor não chega aos dois centros ao mesmo tempo"); `/home/user/prancheta/CLAUDE.md` e `PROJETO.md:102` ("cerca de 65%"); `balance-targets.md:3` ("mudar uma meta que veio do `PROJETO.md` é ADR").
Problema: o CEO aceitou `kChance` 0,125 (decisão 1 da T-016), que troca o centro de 65% por 63% na prática; a meta do `PROJETO.md` não mudou e as duas faixas ficaram com menos de 1 ponto de folga em todas as sementes. Qualquer ajuste futuro quebra uma das duas.
Recomendação: CEO escolhe (ver lista); se mantiver 0,125, `architect` registra ADR curto reinterpretando o "cerca de 65%" como faixa 62–68 com centro realista 63.

**11. (Média) Dependência da T-019 passa por uma tarefa que o plano "Próximo" ignora.**
Onde: `/home/user/prancheta/docs/02-architecture.md:1143` (T-019 depende de T-018, **T-027**, T-017); `/home/user/prancheta/docs/status.md:382` ("T-048, depois T-018/T-019 e as telas").
Problema: o congelamento do formato do save (fixture v1 com `face` codificado, ADR-0012) exige o gerador de avatares; o próximo passo publicado não o cita.
Recomendação: Orquestrador inclui T-027 antes da T-019 no "Próximo" ou o `architect` justifica tirar a dependência.

**12. (Média) `papeis.md` manda o `game-designer` escrever onde a regra proíbe.**
Onde: `/home/user/prancheta/docs/papeis.md:12` ("Escreve em `docs/design/`, `app/src/engine/params/`"); `/home/user/prancheta/CLAUDE.md` (parâmetros em `app/src/params/`, fora do motor; lint bloqueia).
Recomendação: corrigir para `app/src/params/`.

**13. (Baixa) Textos vencidos nos documentos de design.**
Onde: `/home/user/prancheta/docs/design/partida.md:13` ("+ fator casa, se aprovado"; ADR-0011 aceito); `/home/user/prancheta/docs/design/jogadores.md:249` ("Pedido ao `developer`: tirar `squadSize`", já feito, `generation.json` só tem `clubStrengthSd`); `/home/user/prancheta/docs/design/brasilidades.md:44,90` ("a troca é formalizada em ADR", sem citar ADR-0017); `/home/user/prancheta/docs/design/temporada.md:18` (estilo Tranquilo/Realista mudam texto na 1a, mas P3/US-014 escondem "Estilo"); `/home/user/prancheta/docs/design/balance-targets.md:105` ("os outros quatro casos precisam ser conferidos antes de a T-016 fechar": sem registro de conferência); `/home/user/prancheta/docs/03-test-plan.md:269` ("lesões continuam" × decisão 13).
Recomendação: varredura do `tech-writer` com os donos de cada documento.

**14. (Baixa) "Perguntas que seguem abertas" nos requisitos já foram respondidas.**
Onde: `/home/user/prancheta/docs/01-requirements.md:3113` (P13 resto: Discussions, decidido em `status.md:222`), `:3120` ("Lista dos 20 clubes trava a US-001", entregue na T-003), `:3099` ("o número [do ADR-0016] será ajustado").
Recomendação: `product-manager` fecha os itens e deixa só P7 (resto) e "tipo de partida por carreira ou aparelho".

**15. (Baixa) Combinados do CEO sem reflexo no roteiro/visão.**
Onde: `/home/user/prancheta/docs/roadmap.md:8` e `/home/user/prancheta/docs/00-vision.md:28-33` não citam o áudio essencial (ADR-0016) nem o placar/tabela ao vivo (US-070–074), ambos aprovados para a 1a; `00-vision.md` "Fora de escopo" ainda diz "voz" (certo) mas a lista de capacidades não ganhou o som.
Recomendação: uma linha em cada.

## Decisões para o CEO

1. Nacionalidade na 1a: manter 10% de sul-americanos (e aprovar a lista de nomes em espanhol como item da 1a) ou só brasileiros, como diz a US-003.
2. Metas "20 pontos" e "zebra": manter `kChance` 0,125 com ADR que reinterpreta o "cerca de 65%" do `PROJETO.md`, ou voltar a 65% e aceitar zebra de 7%.
3. Meta da diretoria informativa na 1a (decisão 6): confirmar que entra na US-025/T-037 ou tirar do motor.
4. Vibração seguir `prefers-reduced-motion` (pendência do ADR-0016 para o `product-manager`, US-020).
5. Tipo de partida vale por carreira ou para o aparelho (pergunta aberta 3 dos requisitos).
6. Quem trata denúncias e em quanto tempo (P7, trava a US-065).
7. Domínio definitivo antes da 1b (trava a US-047; passkey presa ao domínio).
8. Lista reserva de clubes da Série B e lote de dezembro (travam US-067 e o acesso futuro).
9. Pendências do Dia 1 ainda abertas: INPI, licença do código, e-mail de suporte, nome/cidade na política, alias `fable` do `project-auditor`.
10. Ordem do próximo bloco: T-048 antes ou depois de T-018/T-027/T-019 (a arquitetura diz que T-048 não bloqueia nada; o save, sim).
