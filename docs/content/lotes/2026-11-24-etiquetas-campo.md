# Lote 2026-11-24: etiquetas do desfecho no campo v2 (PR B)

Status: aguardando aprovação do CEO. Nada deste lote entrou em `app/src/content/`.

Contexto: `docs/design/telas/partida-campo-v2.md`, seção de etiquetas. A pílula mostra o tipo da jogada em `rotulo` e o nome do jogador. No desfecho de uma chance que não virou gol, o tipo troca para uma das três chaves abaixo.

## Chaves

- `match.tag.saved`: defesa do goleiro (inclui pênalti defendido).
- `match.tag.post`: bola na trave.
- `match.tag.wide`: chute para fora (inclui chance fraca e pênalti para fora).

## Estilo

Igual ao dos textos existentes (`match.live.shot` "Finalização", `match.live.freeKick` "Falta", `match.live.penalty` "Pênalti", `report.event.red` "Vermelho"): substantivo curto, sem ponto de exclamação, sem narração. Em es, segue a variante já usada no jogo ("Penalti", "Remate").

## Larguras

Estimativa de 5,9 px por caractere em `rotulo`, calibrada nas medidas da spec ("Finalização" = 11 caracteres = 65,4 px; "Off the post" = 12 caracteres = 70,8 px). É estimativa, não medição; o `ux-designer` confere no PR. Todas ficam bem abaixo do teto de 140 px.

## Tabela para aprovação

Recomendada em negrito; a alternativa vem logo abaixo.

| Chave             | pt-BR                 | es                  | en                       |
| ----------------- | --------------------- | ------------------- | ------------------------ |
| `match.tag.saved` | **Defesa** (35 px)    | **Atajada** (41 px) | **Saved** (30 px)        |
| alternativa       | Defendeu (47 px)      | Parada (35 px)      | Save (24 px)             |
| `match.tag.post`  | **Trave** (30 px)     | **Al palo** (41 px) | **Off the post** (71 px) |
| alternativa       | Na trave (47 px)      | Poste (30 px)       | Post (24 px)             |
| `match.tag.wide`  | **Para fora** (53 px) | **Afuera** (35 px)  | **Wide** (24 px)         |
| alternativa       | Fora (24 px)          | Desviado (47 px)    | Off target (59 px)       |

## Notas de escolha

- pt-BR: "Defesa" e "Trave" são substantivos, como "Falta" e "Pênalti". "Defendeu" e "Na trave" soam a verbo ou frase, por isso ficam como alternativa.
- es: "Atajada" e "Al palo" são o uso corrente na América do Sul. "Parada" é mais da Espanha; "Poste" é neutro e correto, porém menos usado.
- en: "Off the post" é a forma idiomática e foi a maior medida da spec (70,8 px). "Post" sozinho é mais curto, mas ambíguo fora do contexto. "Wide" é o termo usual para chute para fora.
- Nenhum texto antecipa o resultado: a etiqueta só troca no desfecho.
- Sem nome real, marca ou lema.

## Onde entra depois da aprovação

Mesmas três chaves, mesmo texto por idioma, nos arquivos:

- `app/src/content/pt-BR/ui.json`
- `app/src/content/es/ui.json`
- `app/src/content/en/ui.json`

Sugestão de posição: logo depois de `match.live.penalty` (linha 253 dos três arquivos). Sem placeholders.
