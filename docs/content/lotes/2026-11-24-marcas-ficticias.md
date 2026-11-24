# Lote T-040: marcas fictícias do cenário (lote 1)

Status: **aprovado pelo CEO em 2026-11-24**, com uma troca: "Açaí Beiço Roxo" passa a se chamar "Açaí Língua Roxa" (mesmas cores). Ficam as 22 marcas, com o nome igual nos três idiomas. Os dados estão em `app/src/data/brands.json` e a escolha por espaço em `app/src/lib/brands/`. Regras: ADR-0015 (marcas fictícias, só como cenário, sem rótulo de publicidade, sem link), `docs/design/telas/partida-campo-v2.md` §4 (placas só com cores, sem texto) e `docs/design/telas/partida.md` ("Marcas do cenário").

Total: **22 marcas**, em categorias do dia a dia. Nenhuma de bebida alcoólica, aposta, cigarro, remédio ou farmácia. Nenhuma pede "Patrocine aqui": cada uma é só um nome, uma categoria e duas cores.

## Como ler

- **Nome:** inventado, sem sigla e sem trocadilho com marca conhecida. Nos três idiomas o nome **fica igual** (são nomes próprios inventados, como os dos clubes); só a categoria, que é dado interno e não aparece na tela, é traduzida se um dia aparecer.
- **Fundo** (`bg`) e **marca** (`mark`): hex. Na placa, o fundo é a placa inteira e a marca é a faixa central (60% da largura, 26% da altura). No placar e na camisa, o nome aparece no texto; as cores servem à forma gráfica.
- **Contraste** fundo x marca: calculado pela fórmula de luminância relativa da WCAG; todos acima de 3:1 (o menor é 3,24). Como a marca é uma forma gráfica, 3:1 basta; o nome em texto, quando aparece, usa os tokens de texto do design system sobre a faixa do placar, nunca estas cores.

## Lista

| #   | Nome (pt-BR, es e en iguais) | Categoria                 | Fundo     | Marca     | Contraste |
| --- | ---------------------------- | ------------------------- | --------- | --------- | --------- |
| 1   | Padaria Miolo Fofo           | padaria                   | `#7a2e1d` | `#ffd9a0` | 7,01:1    |
| 2   | Cimentão Materiais           | material de construção    | `#3d4a52` | `#8fd3ff` | 5,62:1    |
| 3   | Rádio Toca-Fita FM           | rádio local               | `#1f3a8a` | `#9be7ff` | 7,52:1    |
| 4   | Açaí Língua Roxa             | açaí                      | `#4b1d6b` | `#e6ff7a` | 11,23:1   |
| 5   | Borracharia Remendão         | borracharia               | `#243b2c` | `#e8e0c8` | 9,17:1    |
| 6   | Pamonharia Milho Doce        | pamonha                   | `#f4d03f` | `#0f5c4a` | 5,26:1    |
| 7   | Empanadas Doña Crocante      | empanadas                 | `#c9482b` | `#fff1d6` | 4,23:1    |
| 8   | Yerbal Cuia Cheia            | erva-mate e chimarrão     | `#2f6b3a` | `#f0e2b6` | 4,95:1    |
| 9   | Espetinho Brasa Mansa        | espetinho                 | `#2a2a35` | `#ff7a45` | 5,48:1    |
| 10  | Lava Ligeiro                 | lava-rápido               | `#00a6b8` | `#08303a` | 4,78:1    |
| 11  | Sorvetes Gelo Fino           | sorveteria                | `#f7b7d2` | `#6a1b4d` | 6,75:1    |
| 12  | Mercadinho Freguês Feliz     | mercadinho de bairro      | `#e8efe0` | `#b0302c` | 5,40:1    |
| 13  | Chaveiro Abre-Te Sésamo      | chaveiro                  | `#0b5a8a` | `#ffe9a8` | 6,14:1    |
| 14  | Celular Remenda              | conserto de celular       | `#7fd6a5` | `#14344a` | 7,45:1    |
| 15  | Hortifruti Tomate Prosa      | feira e hortifruti        | `#b3261e` | `#e9f5c9` | 5,72:1    |
| 16  | Moto Pitoco                  | moto-entrega              | `#2b1b6e` | `#ffb199` | 8,08:1    |
| 17  | Pastelão da Esquina          | pastelaria                | `#d98324` | `#2b1408` | 5,99:1    |
| 18  | Laticínios Vaca Prosa        | leite e queijo            | `#f2f2ee` | `#1b5faa` | 5,73:1    |
| 19  | Salão Cachinho               | cabeleireiro              | `#e0559a` | `#fff6fb` | 3,34:1    |
| 20  | Alfajores Dulce Tropiezo     | alfajores e doces         | `#8b5a2b` | `#ffe3f0` | 4,87:1    |
| 21  | Chipá Quentinho              | chipá (salgado de queijo) | `#f3e6c4` | `#8a3b12` | 6,23:1    |
| 22  | Pousada Rede Balançante      | pousada                   | `#1f8a8a` | `#ffe27a` | 3,24:1    |

Pet shop e outras categorias ficam de reserva para um lote 2, se o CEO quiser mais variedade.

## Relação com os tokens do design system

- **Fora da paleta de propósito.** Nenhum par usa um hex de `design/tokens.json`: `grass`, `floodlight`, `danger` e as cores de nível têm significado de jogo (gol, destaque, derrota), e uma placa verde, amarela ou vermelha demais poderia ser lida como estado do jogo. Por isso os tons ficam mais quentes, mais terrosos ou mais frios que os tokens: o amarelo mais próximo do `floodlight` (`#ffc83d`) é o fundo de Milho Doce (`#f4d03f`), mais pálido e só em uma placa; o verde mais próximo do `grass` é o fundo de Celular Remenda (`#7fd6a5`), bem mais claro.
- **São dados da marca, iguais nos dois temas** (`noite` e `dia`): uma placa é um objeto do estádio, não interface. A mureta e as arquibancadas em volta usam os tokens (`surface-0`, `surface-2`), e a conferência é que **nenhum fundo de marca some sobre elas**: os fundos mais escuros (Remendão `#243b2c`, Moto Pitoco `#2b1b6e`, Brasa Mansa `#2a2a35`) ficam a menos de 3:1 de `surface-0` no tema noite, então a placa depende da faixa da marca para ser lida; o `ux-designer` confere o recorte na T-040 (sugestão: contorno de 1px em `line`).
- **Distribuição:** fundos escuros, médios e claros misturados; cores de marca claras sobre fundo escuro e o inverso, para as três filas não ficarem monótonas. Nenhuma cor se repete como par; nenhum par imita o de uma marca real famosa (conferido de cabeça contra as combinações vermelho e amarelo, azul e amarelo, verde e amarelo, vermelho e branco e azul e vermelho; os pares mais perto dessas famílias, Freguês Feliz e Vaca Prosa, foram mantidos em tons desviados e sem a segunda cor típica).

## Conferência de nomes

- Nenhum nome é sigla, lema ou frase de marca real. As palavras são do dia a dia (miolo, cimento, rádio, remendo, brasa, cachinho) e os compostos são inventados; "Doña", "Yerbal", "Dulce Tropiezo" e "Chipá" dão a cor sul-americana.
- Nenhuma marca reaproveita nome de clube do jogo (`app/src/content/names/`): conferido por busca de texto em `app/src/content/names/` e `app/src/data/`.
- A ferramenta de repetição (`npm run content:check`) hoje só roda os testes de dados de clubes e a lista bloqueada; ela não cobre lista de marcas, então **não se aplica** a este lote. Quando a lista entrar em `app/src/data/`, o `developer` deve incluir a mesma conferência (nomes únicos, hex válido, contraste ≥ 3:1) num teste.
- Dúvida para o CEO: a busca por marca real **não pode ser feita na internet por mim**; a conferência é de memória. Peço uma olhada rápida no INPI (como se faz com o nome do jogo) para os nomes mais genéricos: Cimentão, Remendão, Toca-Fita FM, Brasa Mansa e Gelo Fino.

## Dúvidas de tom para o CEO

Respondidas pelo CEO em 2026-11-24: (1) o açaí passa a "Açaí Língua Roxa"; (2) ficam as 22; (3) nomes iguais nos três idiomas aprovados.
