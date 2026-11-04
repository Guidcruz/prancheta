# Lote 2026-11-04: nomes da Série A (20 clubes)

Autor: `content-writer`. Pedido: `/content nomes série A` (destrava a US-001). Status: **aguardando ok do CEO**. Nada foi gravado em `app/src/`.

## Como ler este lote

- Proporção por porte (de `docs/design/jogadores.md`): **6 grandes, 8 médios, 6 pequenos**.
- Cidades e estados são reais (o PROJETO.md pede cidade reconhecível); nomes, cores e apelidos são fictícios.
- **Cores:** onde o PROJETO.md pede cores "reconhecíveis" e a regra do projeto proíbe combinação que identifique um clube real, escolhi o meio-termo: a cor lembra a região ou o trocadilho, mas nenhuma dupla repete a do clube que inspirou o nome (ver dúvida 1).
- **Escudo e símbolo** ficam com o `art-director` e o gerador; aqui só vão as duas cores (principal e secundária, em hex, prontas para o `ClubDef.colors`).
- Estádio, capacidade, perfil de IA e `strength` **não** estão neste lote (vêm numa segunda etapa, depois do ok dos nomes; valem os padrões por porte do `jogadores.md` e do `ia-clubes.md`).
- Nomes de clube não se traduzem: os mesmos em pt-BR, es e en (ver "Formas em es/en").

## Os 20 clubes

| #   | Porte   | Nome completo                   | Nome curto     | Sigla | Cidade / UF        | Cores (principal, secundária)                       | Apelido da torcida |
| --- | ------- | ------------------------------- | -------------- | ----- | ------------------ | --------------------------------------------------- | ------------------ |
| 1   | grande  | Flamingo Futebol Clube          | Flamingo       | FLG   | Rio de Janeiro, RJ | rosa-coral `#F2667A`, grafite `#22252B`             | Flamingada         |
| 2   | grande  | Sport Clube Corinto             | Corinto        | CRT   | São Paulo, SP      | roxo-uva `#4B2A7B`, prata `#C0C4CC`                 | Os Gregos          |
| 3   | grande  | Sociedade Esportiva Palmeral    | Palmeral       | PLM   | São Paulo, SP      | verde-palmeira `#1E7A4A`, dourado `#E0B030`         | Coqueirada         |
| 4   | grande  | Grêmeos Futebol Porto-Alegrense | Grêmeos        | GRM   | Porto Alegre, RS   | azul-petróleo `#0F5C73`, laranja-queimado `#E07A2F` | Gemada             |
| 5   | grande  | Inter-Regional Futebol Clube    | Inter-Regional | IRG   | Porto Alegre, RS   | vermelho-tijolo `#B23A2E`, marinho `#1B2A4A`        | Regionais          |
| 6   | grande  | Atlético Minério Clube          | Minério        | AMN   | Belo Horizonte, MG | grafite `#3A3F45`, cobre `#B8693D`                  | Mineradores        |
| 7   | médio   | Cruzador Esporte Clube          | Cruzador       | CRZ   | Belo Horizonte, MG | azul-marinho `#14305E`, amarelo-claro `#F4E27A`     | Tripulação         |
| 8   | médio   | Botafogueira Futebol Clube      | Botafogueira   | BTF   | Rio de Janeiro, RJ | vermelho-fogo `#D9381E`, cinza-chumbo `#5A5F66`     | Fogueteiros        |
| 9   | médio   | Vasconcelos Atlético Clube      | Vasconcelos    | VSC   | Rio de Janeiro, RJ | preto `#111417`, dourado-velho `#C9A227`            | Vasconcelistas     |
| 10  | médio   | Vitorioso Esporte Clube         | Vitorioso      | VIT   | Salvador, BA       | vinho `#7A1F3D`, mostarda `#E3A91F`                 | Capoeiras          |
| 11  | médio   | Sportivo Arrecifes              | Arrecifes      | ARR   | Recife, PE         | turquesa `#1FA3A8`, laranja-coral `#F28C4B`         | Corais             |
| 12  | médio   | Pinhão Futebol Clube            | Pinhão         | PIN   | Curitiba, PR       | marrom-pinhão `#6B4226`, verde-musgo `#6E8B3D`      | Pinhoeiros         |
| 13  | médio   | Tufão Esporte Clube             | Tufão          | TUF   | Curitiba, PR       | ciano `#00A5CF`, preto `#10151A`                    | Ventania           |
| 14  | médio   | Goiabada Esporte Clube          | Goiabada       | GOI   | Goiânia, GO        | vermelho-goiaba `#C8344A`, verde-folha `#3E8E41`    | Doceiros           |
| 15  | pequeno | Ponte Velha Atlético Clube      | Ponte Velha    | PNV   | Campinas, SP       | cinza-pedra `#8A8D91`, azul-claro `#6FB7E9`         | Pontistas          |
| 16  | pequeno | Guaraná Futebol Clube           | Guaraná        | GUA   | Campinas, SP       | vermelho-guaraná `#A3162A`, verde-escuro `#1F5F3A`  | Guaranistas        |
| 17  | pequeno | Pai d'Égua Sport Club           | Pai d'Égua     | PDE   | Belém, PA          | verde-água `#3CB8A0`, amarelo-ouro `#F2C230`        | Mangueiros         |
| 18  | pequeno | Remador Futebol Clube           | Remador        | REM   | Belém, PA          | azul-rio `#2B6CB0`, branco-gelo `#EAF2F8`           | Remadores          |
| 19  | pequeno | Figueiral Atlético Clube        | Figueiral      | FIG   | Florianópolis, SC  | verde-limão `#8DBE2D`, preto `#1A1A1A`              | Figos              |
| 20  | pequeno | Ilhéu Esporte Clube             | Ilhéu          | ILH   | Florianópolis, SC  | azul-marinho `#1B3B6F`, areia `#E4D3A8`             | Manezinhos         |

Siglas: 20 únicas, 3 letras, nenhuma coincide com sigla de uso corrente de clube real que eu conheça (evitei FLA, COR, PAL, GRE, INT, CAM, VAS, BOT, CRU e similares).

## Trocadilho e conferência, clube por clube

"Conferência" abaixo = o que eu consegui checar. **Limite honesto:** não tenho acesso a base de clubes nem a busca na web nesta sessão; a conferência é por comparação com os clubes que conheço (Séries A a D, estaduais conhecidos e os principais da América do Sul) e por regra de construção (nome que não é igual, nem só com acento ou hífen, a nome real). Risco: **B** = baixo, **M** = médio (palavra comum que pode ser nome de clube pequeno ou cidade; vale uma busca do CEO).

| #   | Trocadilho (uma linha)                                                                                                | Conferência feita                                                                                                                                                  | Risco |
| --- | --------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ----- |
| 1   | Flamingo: a ave no lugar do nome carioca mais famoso (o exemplo do próprio PROJETO.md); rosa no lugar do rubro-negro. | "Flamingo" não é nome de clube que eu conheça; "Flamingada" não é apelido de torcida real; cores diferentes das do clube inspirador.                               | B     |
| 2   | Corinto: cidade grega dos "Coríntios" no lugar do clube paulistano; "Os Gregos" é a torcida.                          | Nome e apelido não coincidem com nenhum clube conhecido; existe cidade Corinto (MG), mas não clube grande.                                                         | M     |
| 3   | Palmeral: grupo de palmeiras no lugar de "Palmeiras"; torcida "Coqueirada" (coqueiros).                               | Nome não igual a clube que eu conheça; sigla e cores diferentes.                                                                                                   | B     |
| 4   | Grêmeos: "gêmeos" encaixado em "Grêmio"; torcida "Gemada".                                                            | "Grêmio" aparece só como som; nome, cores e apelido distintos.                                                                                                     | B     |
| 5   | Inter-Regional: "Internacional" virou "Inter" + "Regional", um clube só do interior da própria região.                | Não igual a "Internacional" nem a "Inter de ..." conhecido; cores trocadas (marinho no lugar de branco).                                                           | M     |
| 6   | Atlético Minério: "Mineiro" virou "minério", a riqueza do estado; torcida "Mineradores".                              | Evitei mascote e apelido do clube inspirador; nome não é igual a nenhum conhecido.                                                                                 | B     |
| 7   | Cruzador: "cruzeiro" virou navio de guerra; torcida "Tripulação".                                                     | Palavra comum; não conheço clube com esse nome.                                                                                                                    | M     |
| 8   | Botafogueira: "Botafogo" mais "fogueira"; torcida "Fogueteiros".                                                      | Evitei "Futebol e Regatas" e preto e branco; nome de pesquisa simples não retorna clube real que eu conheça.                                                       | B     |
| 9   | Vasconcelos: sobrenome português no lugar de "Vasco"; preto e dourado em vez de preto e branco.                       | Sobrenome comum, pode existir clube amador homônimo; apelido "Vasconcelistas" é inventado.                                                                         | M     |
| 10  | Vitorioso: "Vitória" virou adjetivo; vinho e mostarda no lugar do rubro-negro; "Capoeiras" é cultura baiana.          | Evitei leão, "Barradão" e rubro-negro; nome não igual ao do clube baiano.                                                                                          | B     |
| 11  | Arrecifes: "recife" no sentido de recife de coral (a palavra é a cidade); "Sportivo" no lugar de "Sport".             | Não conheço clube "Arrecifes" no Brasil; "Sportivo" é prefixo comum, mas o conjunto é novo.                                                                        | M     |
| 12  | Pinhão: fruta típica do Paraná; "Pinhoeiros" é a torcida (aceno ao CEO, de Pinhais).                                  | Existe cidade Pinhão (PR), nenhum clube conhecido; verde e marrom, não verde e branco.                                                                             | M     |
| 13  | Tufão: o vento no lugar do "Furacão"; ciano e preto no lugar do vermelho e preto.                                     | Não é "Atlético Paranaense" (nome antigo do real) nem "Athletico"; palavra comum.                                                                                  | M     |
| 14  | Goiabada: fruta e doce no lugar de "Goiás"; torcida "Doceiros".                                                       | Não conheço clube com esse nome; cores sem verde e branco.                                                                                                         | B     |
| 15  | Ponte Velha: "Ponte Preta" com a cor trocada pela idade; cinza e azul-claro em vez de preto e branco.                 | Evitei "Macaca" e mascote; nome não é igual a "Ponte Preta" nem a "Ponte Nova"/"Ponte Alta" (reais).                                                               | M     |
| 16  | Guaraná: bebida no lugar de "Guarani"; vermelho e verde; torcida "Guaranistas".                                       | "Guaraná" é marca de refrigerantes: **possível marca registrada em contexto de produto**, uso como nome de clube é comum em trocadilho mas vale o INPI (dúvida 3). | M     |
| 17  | Pai d'Égua: expressão paraense ("muito bom") no lugar do clube do papão; verde-água e amarelo.                        | Evitei "Papão" e azul-celeste; expressão popular, não marca conhecida.                                                                                             | B     |
| 18  | Remador: "Remo" virou quem rema; torcida "Remadores".                                                                 | Evitei "Leão Azul" e azul-marinho e branco; nome diferente do clube real.                                                                                          | B     |
| 19  | Figueiral: "Figueirense" virou o bosque de figueiras; torcida "Figos".                                                | Evitei "Figueirense" e "Furacão do Estreito"; verde e preto, não preto e branco.                                                                                   | B     |
| 20  | Ilhéu: o morador da ilha no lugar de "Avaí"; torcida "Manezinhos" (apelido afetuoso local).                           | "Ilhéu" é palavra comum e há clubes portugueses de nome parecido; azul e areia diferentes do azul e branco.                                                        | M     |

## Clássicos (pares simétricos, para `rivals`)

| Par                         | Tipo                                |
| --------------------------- | ----------------------------------- |
| Corinto x Palmeral          | clássico da cidade (São Paulo)      |
| Grêmeos x Inter-Regional    | clássico da cidade (Porto Alegre)   |
| Atlético Minério x Cruzador | clássico da cidade (Belo Horizonte) |
| Flamingo x Botafogueira     | clássico da cidade (Rio)            |
| Flamingo x Vasconcelos      | clássico da cidade (Rio)            |
| Botafogueira x Vasconcelos  | clássico menor (Rio)                |
| Pinhão x Tufão              | clássico da cidade (Curitiba)       |
| Ponte Velha x Guaraná       | clássico da cidade (Campinas)       |
| Remador x Pai d'Égua        | clássico da cidade (Belém)          |
| Figueiral x Ilhéu           | clássico da cidade (Florianópolis)  |
| Corinto x Flamingo          | clássico entre os dois maiores      |
| Vitorioso x Arrecifes       | rivalidade regional (Nordeste)      |

Goiabada (Goiânia) fica **sem clássico** na lista: é o único clube sem rival de cidade na amostra. Ver dúvida 4.

## Formas em es e en

Nenhum nome muda. Notas de leitura: "Pai d'Égua" e "Grêmeos" mantêm acento e apóstrofo (o gerador de escudos usa a sigla, não o nome); "Inter-Regional" mantém o hífen; es e en usam "Sport" e "Sportivo" como estão. Os apelidos da torcida (coluna da tabela) também não se traduzem; a explicação do trocadilho, quando aparecer na ajuda do jogo, é conteúdo à parte.

## Lista reserva (subida da Série B, 6 clubes)

| Nome completo               | Nome curto  | Sigla | Cidade / UF        | Porte   | Cores                                       | Apelido     | Trocadilho (uma linha)                           | Risco |
| --------------------------- | ----------- | ----- | ------------------ | ------- | ------------------------------------------- | ----------- | ------------------------------------------------ | ----- |
| Mandacaru Esporte Clube     | Mandacaru   | MDC   | Fortaleza, CE      | médio   | verde-cacto `#4F7A3A`, vermelho `#C23B2A`   | Espinhos    | cacto do sertão no lugar de um nome cearense     | M     |
| Cerradão Atlético Clube     | Cerradão    | CRD   | Brasília, DF       | médio   | laranja-ipê `#E8912D`, marrom `#5A3E2B`     | Cerradeiros | bioma do Planalto Central; "cerrado" aumentado   | B     |
| Pantaneiros Futebol Clube   | Pantaneiros | PNT   | Campo Grande, MS   | pequeno | verde-água `#2E9C7A`, areia `#E0CFA0`       | Jacarés     | gente do Pantanal; torcida em homenagem ao bicho | M     |
| Sertanejo Atlético Clube    | Sertanejo   | SRT   | Campina Grande, PB | pequeno | terracota `#B5532F`, azul-claro `#8EC5E6`   | Vaqueiros   | habitante do sertão (palavra comum)              | M     |
| Maré Cheia Futebol Clube    | Maré Cheia  | MRC   | Santos, SP         | pequeno | azul-mar `#1C6FA8`, branco-espuma `#F2F6F8` | Maresia     | maré alta do litoral paulista                    | B     |
| Lagoa Dourada Esporte Clube | Lagoa       | LGD   | Maceió, AL         | pequeno | dourado `#D9A520`, verde-lagoa `#2F8F83`    | Lagunares   | lagoas de Alagoas ao pôr do sol                  | M     |

Mesma conferência e mesmo limite dos 20 acima. O número de reservas (6) cobre a subida de 4 clubes por ano sem repetir nome.

## Dúvidas para o CEO

1. **Cores x "cores reconhecíveis".** O PROJETO.md quer cidade, cores e apelido reconhecíveis; a regra do projeto (e o risco de marca) pede que nenhuma combinação identifique um clube real de forma inequívoca. Decidi pela cidade reconhecível e cores que evocam sem copiar. Se preferir cores mais próximas das reais (mais "arquibancada", mais risco), digo quais trocas.
2. **Flamingo.** Usei o exemplo do PROJETO.md. Se virar identidade fixa do jogo, convém conferir no INPI antes.
3. **Guaraná** (e, em menor grau, Pinhão, Tufão, Goiabada) podem ser marca de produto. Se quiser evitar o risco, troco Guaraná por "Guaraciaba Futebol Clube" (sigla GUA mantida). Decida se quer manter.
4. **Goiabada sem clássico.** Pode ficar sem rival ou aceito um rival regional (por exemplo, com Cerradão, quando subir). A validação do US-001 aceita lista de rivais vazia? Preciso da resposta do `developer`/`game-designer`.
5. **Dupla Curitiba (Pinhão x Tufão) e Campinas (Ponte Velha x Guaraná):** são derbis de cidade, mas Campinas tem dois pequenos juntos; se preferir diversidade geográfica, troco um por Manaus ou Cuiabá.
6. **Lista bloqueada em hash.** O `scripts/hash-blocklist.mjs` e o `blocklist.sha256.json` ainda não existem (são parte do T-003). Não consegui rodar a checagem automática; a conferência acima é manual e deve ser repetida pelo script quando existir. Preciso do ok para o `developer` criar o script e eu alimentar a lista de nomes reais (só em hash).
7. **Conferência no INPI:** nenhum dos 26 nomes (20 + 6) foi consultado no INPI; isso só o CEO ou alguém com acesso faz. Os marcados M merecem a consulta primeiro.
8. **Estádios fictícios e capacidades:** entram no próximo lote, depois do ok dos nomes.
