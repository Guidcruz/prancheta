# ADR-0014: Escudos gerados podem lembrar o clube real no formato, nas cores e no tipo de padrão

- **Status:** aceita (CEO, 2026-11-04)
- **Data:** 2026-11-04
- **Decisores:** architect (redigiu), art-director (propôs a régua no estilo A v4), CEO (decidiu em 2026-11-04)

## Contexto

O `docs/PROJETO.md` ("Clubes, nomes e identidade") diz que os escudos são gerados em SVG "combinando formato, cores, faixas e um símbolo genérico" e que "nunca imitam o desenho do escudo real". Na rodada do estilo A v4 (`docs/art/escudos-estilos/README.md`), o CEO pediu que o escudo de cada clube fictício lembre o do clube que inspirou o trocadilho, para o jogador reconhecer o clube de relance. Isso afrouxa a frase do documento de projeto e traz risco jurídico (marca e trade dress), que precisa de um limite escrito e de uma revisão antes do lançamento público.

O `docs/PROJETO.md` está congelado e não é editado; este ADR é o registro da mudança.

## Opções consideradas

| Opção                                                                   | Prós                                                             | Contras                                                                  |
| ----------------------------------------------------------------------- | ---------------------------------------------------------------- | ------------------------------------------------------------------------ |
| A: manter a regra original (nada que lembre o escudo real)              | Risco jurídico mínimo                                            | O jogador não reconhece o clube; perde o charme do trocadilho            |
| B: aproximar a sensação (silhueta, cores, tipo de padrão), nunca copiar | Reconhecível; limite claro e verificável; recuo barato por clube | Risco médio em alguns clubes; exige revisão jurídica antes do lançamento |
| C: imitar o desenho do escudo real                                      | Reconhecimento máximo                                            | Violação de marca; inaceitável                                           |

## Decisão

Opção B. Os escudos gerados **podem lembrar** o escudo do clube real que inspirou em três coisas: o **formato geral (silhueta)**, a **disposição e a proporção das cores** e o **tipo de padrão** (listras, faixa, metades, diagonal, chevron, topo). Eles **nunca** usam o símbolo do clube real, monograma ou iniciais, sigla ou nome real, nem a composição exata do escudo real. O símbolo central e o medalhão são sempre desenhos nossos.

## Consequências

- **Positivo:** clubes reconhecíveis de relance; o escudo deixa de ser sorteado e fica estável quando a lista de clubes muda.
- **Negativo:** aceitamos risco jurídico médio em alguns clubes até a revisão; cada clube novo exige escolher e conferir os campos do escudo à mão.
- **Dados fixos por clube:** os campos `crestShape` (`rounded|french|swiss|oval|chamfer|disc`), `crestPattern` (`hoops|vstripes|pales|split|bend|bendMirror|fess|chief|chevron|none`), `crestBase` (0 ou 1: qual cor do clube é o fundo) e `crestSymbol` (chave do símbolo) entram em `app/src/data/clubs.serie-a.json`, como propostos em `docs/art/escudos-estilos/README.md` (estilo A v4, mapa `CLUB_CREST`). O gerador lê esses campos; não há sorteio de formato, padrão nem símbolo, e `assignShapes` deixa de existir. Rivais e clubes da mesma cidade não repetem formato.
- **Estrelas de título:** estrela dourada por título de Série A, prateada por título de Série B (campo futuro `titles.leagueB`); 1 estrela pequena por título e cada 5 títulos viram 1 estrela grande; ouro antes de prata. Só títulos de liga contam.
- **Versão pequena automática:** com largura ≤ 32 px, o gerador troca sozinho para a versão simples (formato, cor chapada, padrão grosso, medalhão com símbolo, contorno simples, no máximo 3 estrelas).
- **Revisão jurídica obrigatória antes do lançamento público** dos escudos de risco médio: Flamingo, Minério, Grêmeos, Fluminário e Vasconcelos (lista do art-director no README), mais os que a v5 indicar. Recuo previsto, se o jurídico pedir: trocar o `crestPattern` do clube por `split` (metades) ou `chief` (faixa no topo), sem mexer em mais nada.
- **Pendências:** a revisão jurídica dos escudos entra nas pendências do CEO junto com a conferência do nome no INPI (`docs/status.md`); o `developer` implementa os campos e o gerador em `/feature` (dados de clube e `shield.test.ts`); o art-director mantém a tabela "O que aproxima / O que ficou diferente / Risco" atualizada a cada clube novo.

## Conformidade

- Revisão de qualquer escudo (dados ou gerador): presença de símbolo, monograma, iniciais, sigla ou nome de clube real, ou composição igual à do escudo real, é BLOCKER.
- Formato, padrão, cor de fundo e símbolo vêm só dos campos `crest*` de `app/src/data/clubs.serie-a.json`; sorteio desses itens no gerador é BLOCKER.
- Todo clube com escudo novo ou alterado tem linha na tabela de risco do art-director; clube de risco médio sem revisão jurídica registrada bloqueia o lançamento público.
