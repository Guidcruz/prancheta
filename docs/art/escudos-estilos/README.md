# Escudos: 3 estilos para o CEO escolher

Cada estilo está aplicado aos 20 clubes de `app/src/data/clubs.serie-a.json` (cores, sigla, nome curto, títulos de liga), em grade 5x4, mais um zoom com 4 escudos grandes (Flamingo, Miragol, Remador, Santões) e uma lista com 8 clubes em 32 px, como numa tabela. O protótipo está em `prototipo/` (`escudos.mjs` gera o SVG; `gerar.cjs` monta o HTML e tira os PNG com Playwright headless; `checar.mjs` confere o contraste). Nada em `app/src/` foi tocado.

| Estilo               | HTML                    | Grade                | Zoom                |
| -------------------- | ----------------------- | -------------------- | ------------------- |
| A, Brasão            | `estilo-a-brasao.html`  | `estilo-a-grade.png` | `estilo-a-zoom.png` |
| B, Emblema circular  | `estilo-b-emblema.html` | `estilo-b-grade.png` | `estilo-b-zoom.png` |
| C, Losango com faixa | `estilo-c-losango.html` | `estilo-c-grade.png` | `estilo-c-zoom.png` |

## Ingredientes comuns

- Tudo determinístico pelo id do clube (hash FNV, sorteio por fluxo com sal por estilo). Mesmo clube, mesmo escudo.
- Cores sempre as do clube. A cor do símbolo/texto é a outra cor do clube; se der menos de 3:1, cai para preto ou branco neutro. Contraste mínimo medido nos 20 clubes: 3,14:1.
- 13 símbolos genéricos desenhados por nós (torre, onda, pinheiro, montanha, ponte, âncora, engrenagem, sol, chave, concha, raio, coroa, roda). Nenhum animal, estrela solitária, cruz ou ave, de propósito.
- Padrões: xadrez, faixa diagonal, chevron, gomos radiais, faixa transversal, três listras assimétricas, aspa, metade, chefe, bolinhas. Nada de listras iguais nem tricolor.
- Estrelas de títulos (`titles.league`): 1 estrela a cada 2,5 títulos, máximo 5 (A e C). Sempre acompanhadas do escudo, nunca sozinhas como símbolo.
- Sombra suave por cópia deslocada com opacidade (sem `filter`), contorno escuro grosso. Cada SVG tem de 2 a 4 KB.

## A, Brasão

Escudo com 3 formatos (clássico, pontudo, arqueado), padrão no campo, borda dupla, medalhão central com símbolo e estrelas no alto.

- Prós: o mais "escudo de clube"; o medalhão garante o contraste; funciona bem a 32 px (padrão + símbolo grande); mais próximo do gerador atual.
- Contras: o padrão sob o medalhão pode ficar carregado (xadrez, bolinhas); não mostra nome.

## B, Emblema circular

Anel com o nome curto no topo e um ano de fundação fictício embaixo, miolo com padrão e medalhão.

- Prós: o mais rico e o que dá mais identidade; o nome no anel serve para a tela de clube e o zoom.
- Contras: o texto do anel vira textura a 32 px (a leitura vem do medalhão e das cores); é o PNG mais pesado; nomes longos ("Inter-Regional", "Botafogueira") ficam pequenos; precisa de fonte (usamos `var(--font-display)` na versão de produção, `textPath` mede diferente por fonte).

## C, Losango com faixa

Losango com faixa transversal com a sigla, símbolo no alto, padrão simples embaixo e estrelas numa pastilha.

- Prós: o mais legível e o mais original; a sigla grande lê bem a 32 px; leve; silhueta diferente dos outros, boa para distinguir na tabela.
- Contras: menos "escudo"; a faixa usa a 2ª cor inteira (clubes preto e branco ficam parecidos entre si); a área para padrão é pequena.

## Recomendação

**A (Brasão) como padrão do jogo**, com **C como variante para listas pequenas** (tabela e partida, onde a sigla ajuda). B fica como opção de tela grande (clube, perfil) se o CEO gostar do ano e do nome no anel. Se precisar escolher um só: A.

## O que muda no gerador

- `ShieldSpec` hoje: `{ shape, color1, color2, symbol: 'star'|'ball'|'letter', letter? }`. Passa a ser `{ style, shape, pattern, symbol, color1, color2, abbreviation, shortName?, year?, stars }`, com `symbol` ampliado para as 13 chaves e `pattern` novo. `shieldSpecFor` receberia também `shortName` e `titles.league` (`stars`), mantendo `abbreviation` como hoje.
- A saída muda para todos os clubes (formato, símbolos, padrão), então o inline snapshot de `shieldSpecFor('flamingo', ...)` e os testes de SVG em `shield.test.ts` precisam ser atualizados; os testes de segurança (escape de texto, cor inválida cai em `#777777`) continuam valendo e devem cobrir `shortName`.
- Para manter compatibilidade, o `developer` pode manter o campo `symbol: 'star'|'ball'|'letter'` aceito por um ciclo (renderizando como hoje) e só usar o novo sorteio quando `style` vier.
- Dois cuidados de produção: usar `var(--ink)` no contorno e `var(--font-display)` nos textos (o protótipo usa cores fixas e Arial Black); ids de `clipPath` precisam ser únicos por instância (o protótipo usa contador, produção deve usar o id do clube + estilo, já que a mesma página renderiza muitos escudos).
- Sem dependência nova. Antes de produção, o `code-reviewer` deve conferir a regra de padrões reais já existente e o `content-writer`/CEO validar a lista de símbolos.

---

# Estilo A v2 (escolhido pelo CEO: Brasão, com o C só nas listas pequenas)

Arquivos: `estilo-a-brasao-v2.html`, `estilo-a-grade-v2.png`, `estilo-a-zoom-v2.png`; código em `prototipo/escudos-v2.mjs` e `prototipo/gerar-v2.cjs`. Os arquivos da v1 foram mantidos.

## Todos terão o mesmo formato? Não

Seis formatos: clássico arredondado, francês com ponta, suíço com recorte no topo, oval, chanfrado e bolacha (com anel interno). O formato parte do hash do id; depois, clubes da mesma cidade ou rivais diretos (`rivals`) nunca repetem formato. Resultado nos 20 clubes: 0 conflitos; distribuição 6 francês, 5 suíço, 3 chanfrado, 2 clássico, 2 oval, 2 bolacha. A atribuição percorre os clubes em ordem de id, então depende da lista; o `developer` deve calcular uma vez (função `assignShapes(clubs)`) e guardar no dado derivado do clube, não por escudo renderizado. Se um clube novo entrar, formatos de clubes vizinhos podem mudar; para evitar isso, a proposta é fixar o formato num campo `crestShape` em `clubs.serie-a.json` depois da aprovação.

## Brilho e profundidade

- Gradiente vertical sutil na cor 1 (18% mais claro no topo, 22% mais escuro embaixo), sempre derivado da cor do clube.
- Reflexo diagonal branco (42% para 4% de opacidade) no terço superior, recortado no formato.
- Borda dupla com metal por porte: ouro (big), prata (medium), bronze (small), em gradiente, mais um fio metálico interno; contorno escuro por fora.
- Sombra interna (traço escuro recortado) e sombra externa deslocada, sem `filter` (leve e barato no celular).
- Estrelas com gradiente metálico e halo suave.
- O metal é um acento neutro, como o dourado das estrelas; as cores do escudo continuam sendo as do clube. Contraste do símbolo: mínimo 3,14:1 nos 20 clubes (mesma regra da v1).

## Versão pequena (largura ≤ 32 px)

`brasaoV2(club, shape, size)` troca sozinho para a versão simples quando `size <= 32`: sem gradiente, sem reflexo, sem sombras, sem borda dupla; só formato, cor chapada, padrão grosso (diagonal, chevron, metade, faixa, chefe; padrões finos como xadrez, bolinhas, gomos e listras somem), medalhão com símbolo, contorno simples com fio metálico e no máximo 3 estrelas maiores. Para listas pequenas (tabela), o C continua como variante opcional.

## Regra das estrelas (explícita)

O protótipo v1 usava `ceil(títulos / 2,5)`, máximo 5 (12 títulos e 6 títulos davam resultados confusos). Regra proposta e usada na v2, com `titles.league`:

| Títulos de liga | Estrelas   |
| --------------- | ---------- |
| 0               | 0          |
| 1 a 2           | 1          |
| 3 a 4           | 2          |
| 5 a 6           | 3          |
| 7 a 9           | 4          |
| 10 ou mais      | 5 (máximo) |

Na versão pequena, no máximo 3 estrelas. Só contam títulos de liga; copas não geram estrela. Os 5 níveis mantêm a ordem entre clubes, mas a partir de 10 títulos não se distingue (Palmeral, 12, e um clube de 10 ficam iguais); se o CEO quiser, pode-se mostrar o número ao lado da estrela na tela de clube.

## Peso

SVG médio nos 20 clubes: cerca de 3,1 KB na versão grande e 1,1 KB na pequena (sem compressão; gzip fica em cerca de 1 KB e 0,5 KB). PNG: grade 354 KB, zoom 123 KB.

## O que muda no gerador (além do que está acima)

- `shape` passa a ter 6 valores (`rounded|french|swiss|oval|chamfer|disc`); a chave `size` do clube entra no `ShieldSpec` para escolher o metal; `shieldSvg(spec, size)` ramifica em `size <= 32`.
- IDs de gradiente e `clipPath` precisam ser únicos por instância e por clube (o protótipo usa contador; produção deve usar `clubId` + estilo).
- Os testes existentes em `shield.test.ts` (snapshot do `shieldSpecFor`, escape de texto, cor inválida) precisam ser atualizados; o metal e os gradientes são constantes seguras, e a única cor vinda do dado continua passando por `safeColor`.

---

# Estilo A v3

Arquivos: `estilo-a-brasao-v3.html`, `estilo-a-grade-v3.png` (350 KB), `estilo-a-zoom-v3.png` (130 KB); código em `prototipo/escudos-v3.mjs` e `prototipo/gerar-v3.cjs`. A v1 e a v2 foram mantidas.

## O que mudou

- **Símbolos maiores:** o medalhão passou de raio 13,5 para 18 (17 na bolacha) e o símbolo ocupa cerca de 80% dele (antes, cerca de 55%). Na versão de 32 px continua só formato, cor, padrão grosso e símbolo.
- **Símbolo fixo por clube**, ligado à cidade, em vez de sorteio por hash. Acabou a repetição da chave: são 20 símbolos para 20 clubes, todos diferentes. Proposta: novo campo `crestSymbol` em `clubs.serie-a.json` (string, chave do símbolo). No protótipo ele está no mapa `CREST`.
- **Borda metálica por porte** (ouro velho, prata, bronze) continua, mais fosca. As estrelas ficam numa pastilha escura separada, no alto, com amarelo vivo, para não se confundirem com a borda.
- **Estrelas por série:** título de Série A é estrela dourada; título de Série B, estrela prateada. Hoje só existe `titles.league` (Série A). O desenho e a regra já aceitam um campo futuro `titles.leagueB` (no protótipo, `titles.leagueB`); o quarto escudo do zoom ("Ex.: A+B") mostra o caso com 2 títulos de A e 6 de B. Quando a Série B entrar no jogo, basta o dado novo. Se houver os dois, ouro vem primeiro, prata depois.

## Contagem das estrelas: confirmei e propus mudar

A regra da v2 (1 estrela a cada 2 títulos, com degraus) perde informação: 7 e 9 títulos davam 4 estrelas, e de 10 em diante tudo era 5. Com os dados atuais (12, 8, 8, 7, 6, 4, 4, 4, 3, 3, 3, 2, 2, 1, 1) isso esconde diferença entre os maiores campeões. Proposta da v3, e é o que está nos PNG:

- 1 estrela pequena por título, de 1 a 4.
- Cada 5 títulos viram 1 estrela grande, com aro. Exemplos: 12 títulos são 2 grandes e 2 pequenas; 8 são 1 grande e 3 pequenas; 7 são 1 grande e 2 pequenas; 4 são 4 pequenas.
- Limite: 3 grandes e 4 pequenas (15 a 19 títulos mostram 3 grandes e as pequenas do resto). Acima de 19 títulos, 3 grandes e 4 pequenas; o número exato aparece só na tela do clube.
- Na versão de 32 px: máximo de 3 estrelas no total, sem brilho, na ordem (grandes primeiro, ouro antes de prata). Em listas pequenas, vale mostrar o número ao lado.
- Alternativa descartada: manter "1 a cada 2 títulos". Ela é mais compacta, mas não distingue os grandes campeões.

## Clube, cidade, símbolo, por quê

| Clube            | Cidade            | Símbolo                        | Por quê                                                       |
| ---------------- | ----------------- | ------------------------------ | ------------------------------------------------------------- |
| Flamingo         | Rio de Janeiro    | `calcadao` (ondas grossas)     | Calçadão de ondas da orla.                                    |
| Fluminário       | Rio de Janeiro    | `arcos`                        | Arcos do aqueduto da Lapa, estilo genérico.                   |
| Botafogueira     | Rio de Janeiro    | `chama`                        | Trocadilho do nome (fogueira).                                |
| Vasconcelos      | Rio de Janeiro    | `paoacucar` (morro e bondinho) | Morro arredondado com cabo, sem o desenho de nenhum escudo.   |
| Corinto          | São Paulo         | `predios`                      | Silhueta de prédios da capital.                               |
| Palmeral         | São Paulo         | `palmeira`                     | Trocadilho do nome (palmeiral).                               |
| São Paulão       | São Paulo         | `ponte` (estaiada)             | Ponte estaiada, cartão-postal da cidade.                      |
| Santões          | Santos            | `guindaste`                    | Guindaste do porto.                                           |
| Atlético Minério | Belo Horizonte    | `picareta`                     | Mineração do estado.                                          |
| Cruzador         | Belo Horizonte    | `pampulha` (arcos aninhados)   | Arco parabólico da Pampulha.                                  |
| Grêmeos          | Porto Alegre      | `cuia`                         | Cuia de chimarrão.                                            |
| Inter-Regional   | Porto Alegre      | `chamine`                      | Chaminé da antiga usina do Guaíba.                            |
| Tufão            | Curitiba          | `torre`                        | Torre panorâmica.                                             |
| Coritibom        | Curitiba          | `araucaria`                    | Araucária, árvore-símbolo do Paraná (sugestão do CEO).        |
| Baião            | Salvador          | `berimbau`                     | Cultura baiana, e o nome é de um ritmo nordestino.            |
| Vitorioso        | Salvador          | `farol`                        | Farol da Barra.                                               |
| Bragantão        | Bragança Paulista | `sino`                         | Sino de igreja matriz, cidade histórica do interior.          |
| Miragol          | Mirassol          | `sol`                          | Sol do interior paulista (sugestão do CEO).                   |
| Chapecão         | Chapecó           | `espiga`                       | Agroindústria do oeste catarinense.                           |
| Remador          | Belém             | `vitoriaregia`                 | Vitória-régia da Amazônia; o remo ficou de fora (ver abaixo). |

Clubes da mesma cidade têm símbolos e formatos diferentes. O formato continua vindo de `assignShapes` (v2).

## Conferência contra escudos reais

Aviso honesto: não tive acesso a busca na internet nesta sessão. A conferência abaixo é de memória, sobre os elementos principais conhecidos de escudos de clubes brasileiros; o CEO ou o `legal-advisor` deve passar uma checagem visual antes de entrar no jogo.

- Evitados de propósito: remo/remos cruzados (o clube real de Belém usa remo e leão), âncora, estrela solitária, cruz, leão, águia/aves, galo, tricolor e a chave do bondinho típica de escudo de aeroporto.
- Sem dúvida conhecida: araucária, cuia, chaminé, guindaste, picareta, palmeira, chama, ponte estaiada, berimbau, farol, sino, espiga, vitória-régia.
- Com dúvida pequena, para o CEO decidir: `sol` (Miragol), por ser um símbolo muito comum em geral; `chama` (Botafogueira) e `palmeira` (Palmeral) por ecoarem o nome de clubes reais, mas nenhum escudo real conhecido os usa como elemento principal. Se o CEO preferir, troco `sol` por `laranja` (região de citros) sem alterar mais nada.
- Nenhum símbolo é desenho de escudo real; são formas genéricas minhas.

## Pontos a refinar

Alguns símbolos ainda leem fraco a 32 px ou grandes: pão de açúcar, guindaste e picareta (parece um arco). Na produção, o `developer` pode ajustar os desenhos em `CITY`, mantendo as chaves.

## Peso e o que muda no gerador

SVG médio: cerca de 3,3 KB na versão grande e 1,4 KB na pequena (sem compressão). Mudanças em relação à v2: `crestSymbol` vira campo do clube e entra no `ShieldSpec`; `titles` ganha `leagueB` opcional; a função de estrelas passa a `starGlyphs(titles)`; o resto vale como na v2 (IDs únicos por clube, atualizar o snapshot e os testes de `shield.test.ts`).
