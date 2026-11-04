# Lote 2026-11-04: nomes da Série A (20 clubes), versão 2

Autor: `content-writer`. Pedido: `/content nomes série A` (destrava a US-001). Status: **aprovado pelo CEO em 2026-11-04 (com ajustes)**. Nada foi gravado em `app/src/`. Esta versão substitui a primeira.

## O que mudou e como ler

- A lista agora segue a **Série A 2026 real** (conferida na web pelo Orquestrador): um clube fictício por clube real, com trocadilho, mesma cidade, **cores principais reais**, e apelido de torcida reconhecível sem ser o oficial.
- O que continua proibido: nome oficial, escudo, mascote registrado, marca. Por isso nenhum clube usa o mascote real (galo, leão, raposa, peixe, urubu, touro etc.); o `art-director` deve gerar escudos e padrões de camisa próprios.
- Cores: duas por clube (principal, secundária), em hex, prontas para `ClubDef.colors`. Como as cores são reais, vários clubes dividem a dupla (preto e branco em 5, vermelho e preto em 3). A diferença fica no **padrão do uniforme** (listras, faixa diagonal, gola, metades), que é do `art-director`; ver dúvida 2.
- Siglas: 3 letras, nenhuma é a sigla de uso corrente do clube real.
- Estádio, capacidade, perfil de IA e `strength` ficam para o próximo lote (valem os padrões por porte).
- Nomes de clube não se traduzem (mesmos em pt-BR, es e en); ver "Formas em es e en".

## Os 20 clubes (fictício, inspirado em)

| #   | Porte   | Nome completo                   | Nome curto     | Sigla | Cidade / UF           | Cores (principal, secundária)        | Apelido da torcida | Inspirado em  |
| --- | ------- | ------------------------------- | -------------- | ----- | --------------------- | ------------------------------------ | ------------------ | ------------- |
| 1   | grande  | Flamingo Futebol Clube          | Flamingo       | FLG   | Rio de Janeiro, RJ    | vermelho `#C8102E`, preto `#111417`  | Flamingada         | Flamengo      |
| 2   | grande  | Sport Clube Corinto             | Corinto        | CRT   | São Paulo, SP         | preto `#111417`, branco `#FFFFFF`    | Coríntios          | Corinthians   |
| 3   | grande  | Sociedade Esportiva Palmeral    | Palmeral       | PLM   | São Paulo, SP         | verde `#006437`, branco `#FFFFFF`    | Palmeralada        | Palmeiras     |
| 4   | grande  | São Paulão Futebol Clube        | São Paulão     | SPL   | São Paulo, SP         | vermelho `#E4002B`, preto `#111417`  | Tricoloridos       | São Paulo     |
| 5   | grande  | Atlético Minério Clube          | Minério        | AMN   | Belo Horizonte, MG    | preto `#111417`, branco `#FFFFFF`    | Minerários         | Atlético-MG   |
| 6   | grande  | Grêmeos Futebol Porto-Alegrense | Grêmeos        | GRM   | Porto Alegre, RS      | azul `#0D80BF`, preto `#111417`      | Gemada             | Grêmio        |
| 7   | grande  | Fluminário Futebol Clube        | Fluminário     | FLM   | Rio de Janeiro, RJ    | grená `#8B1A2E`, verde `#00704A`     | Tricolorada        | Fluminense    |
| 8   | grande  | Botafogueira Futebol Clube      | Botafogueira   | BTG   | Rio de Janeiro, RJ    | preto `#111417`, branco `#FFFFFF`    | Fogueirada         | Botafogo      |
| 9   | grande  | Vasconcelos Atlético Clube      | Vasconcelos    | VSC   | Rio de Janeiro, RJ    | preto `#111417`, branco `#FFFFFF`    | Vasconcelistas     | Vasco         |
| 10  | grande  | Santões Futebol Clube           | Santões        | SNT   | Santos, SP            | branco `#FFFFFF`, preto `#111417`    | Praieiros          | Santos        |
| 11  | grande  | Cruzador Esporte Clube          | Cruzador       | CRZ   | Belo Horizonte, MG    | azul `#0033A0`, branco `#FFFFFF`     | Celestinos         | Cruzeiro      |
| 12  | grande  | Inter-Regional Futebol Clube    | Inter-Regional | IRG   | Porto Alegre, RS      | vermelho `#E5050F`, branco `#FFFFFF` | Vermelhada         | Internacional |
| 13  | médio   | Tufão Esporte Clube             | Tufão          | TUF   | Curitiba, PR          | vermelho `#C8102E`, preto `#111417`  | Ventania           | Athletico-PR  |
| 14  | médio   | Baião Esporte Clube             | Baião          | BAO   | Salvador, BA          | azul `#0057B8`, vermelho `#D6001C`   | Baianada           | Bahia         |
| 15  | médio   | Coritibom Futebol Clube         | Coritibom      | CTB   | Curitiba, PR          | verde `#00553A`, branco `#FFFFFF`    | Verdeiros          | Coritiba      |
| 16  | médio   | Vitorioso Esporte Clube         | Vitorioso      | VTR   | Salvador, BA          | vermelho `#C8102E`, preto `#111417`  | Barrenses          | Vitória       |
| 17  | pequeno | Bragantão Futebol Clube         | Bragantão      | BRG   | Bragança Paulista, SP | branco `#FFFFFF`, vermelho `#D81E2B` | Bragantistas       | Bragantino    |
| 18  | pequeno | Miragol Futebol Clube           | Miragol        | MRG   | Mirassol, SP          | amarelo `#FFD400`, verde `#0A7A3D`   | Miragolenses       | Mirassol      |
| 19  | pequeno | Chapecão Esporte Clube          | Chapecão       | CHP   | Chapecó, SC           | verde `#00A650`, branco `#FFFFFF`    | Oestinos           | Chapecoense   |
| 20  | médio   | Remador Futebol Clube           | Remador        | RMD   | Belém, PA             | azul `#003A8C`, branco `#FFFFFF`     | Remeiros           | Remo          |

### Critério do porte (rodada 3)

- Porte vem de **história e torcida** (títulos, tradição, tamanho da torcida), não da colocação atual. A força na tabela é outro dado (`strength`), definido em `docs/design/clubes-serie-a.md`.
- **Grandes (12):** Flamingo, Palmeral, Cruzador, Fluminário, Atlético Minério, Santões, São Paulão, Botafogueira, Vasconcelos, Grêmeos, Corinto e Inter-Regional.
- **Médios (5):** Tufão, Baião, Coritibom, Vitorioso e Remador.
- **Pequenos (3):** Bragantão, Miragol e Chapecão.

## Trocadilho e conferência, clube por clube

"Conferência" abaixo = o que consegui checar. **Limite honesto:** não tenho base de clubes nem busca na web nesta sessão; a lista real da Série A veio do Orquestrador. Comparei cada nome fictício com os clubes que conheço (Séries A a D, estaduais conhecidos e principais da América do Sul) e com a regra de construção: nenhum nome é igual, nem só com acento, hífen ou "Foot Ball Club", ao nome oficial ou a uma sigla. Risco: **B** = baixo; **M** = médio (palavra comum ou som muito próximo; vale uma busca do CEO).

| #   | Trocadilho (uma linha)                                                                                    | Conferência feita                                                                                        | Risco |
| --- | --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------- | ----- |
| 1   | Flamingo: a ave no lugar do nome carioca mais famoso (exemplo do PROJETO.md).                             | Sem mascote de urubu; apelido "Flamingada" não é o oficial; sigla FLG.                                   | B     |
| 2   | Corinto: a cidade grega dos "Coríntios" no lugar do clube paulistano; "Coríntios" é o apelido da torcida. | Não uso "Timão" nem "Fiel"; nome não é igual a clube que eu conheça (Corinto, MG, é cidade).             | M     |
| 3   | Palmeral: grupo de palmeiras no lugar de "Palmeiras".                                                     | Não uso "Verdão" nem porco; nome não igual a clube que eu conheça.                                       | B     |
| 4   | São Paulão: "São Paulo" aumentado, como o povo fala do time.                                              | O nome oficial não aparece; "Soberano" e o tricolor-lema não usados.                                     | M     |
| 5   | Atlético Minério: "mineiro" virou "minério", a riqueza do estado.                                         | Sem galo; "Galoucura" e similares fora; nome não igual ao oficial.                                       | B     |
| 6   | Grêmeos: "gêmeos" encaixado em "Grêmio".                                                                  | Sem mascote de mosqueteiro nem hino; nome distinto do oficial.                                           | B     |
| 7   | Fluminário: "fluminense" virou "fluminário", palavra inventada com o mesmo som.                           | Sem "Pó de Arroz" nem "Time de Guerreiros"; nome distinto do oficial.                                    | M     |
| 8   | Botafogueira: "Botafogo" mais "fogueira"; "Fogueirada" é a torcida.                                       | Sem "Futebol e Regatas" e sem estrela solitária no escudo (nota ao art-director).                        | M     |
| 9   | Vasconcelos: sobrenome português no lugar de "Vasco".                                                     | Sem "Cruz de Malta" nem "Gigante da Colina"; apelido "Vasconcelistas" inventado.                         | M     |
| 10  | Santões: "Santos" no aumentativo.                                                                         | Sem peixe/baleia e sem "Vila": nome distinto do oficial.                                                 | M     |
| 11  | Cruzador: "cruzeiro" virou navio de guerra.                                                               | Sem raposa; palavra comum, não conheço clube homônimo.                                                   | M     |
| 12  | Inter-Regional: "Internacional" quebrado em "Inter" + "Regional".                                         | Não é "Internacional" nem "Inter de ..."; sem "Colorado" nem saci.                                       | M     |
| 13  | Tufão: o vento no lugar do "Furacão".                                                                     | Não é "Atlético Paranaense" nem "Athletico"; sem escudo de furacão.                                      | M     |
| 14  | Baião: "Bahia" virou "baião", ritmo e prato do Nordeste; muda o som, mantém o clima.                      | Evitei "Tricolor de Aço" e "Esquadrão"; "baião" é palavra comum, não conheço clube homônimo.             | M     |
| 15  | Coritibom: "Coritiba" com "bom".                                                                          | Sem "Coxa" e "Coxinha" (apelido evitado de propósito, por conotação política); nome distinto do oficial. | M     |
| 16  | Vitorioso: "Vitória" virou adjetivo.                                                                      | Sem leão nem "Barradão"; "Barrenses" é só o bairro.                                                      | B     |
| 17  | Bragantão: "Bragantino" aumentado, como cidade grande-pequena.                                            | Sem touro nem marca de bebida; cores brancas e vermelha, não a identidade do patrocinador.               | M     |
| 18  | Miragol: "Mirassol" com "gol".                                                                            | Sem leão; apelido inventado.                                                                             | B     |
| 19  | Chapecão: "Chapecoense" aumentado. Sem qualquer referência à história do clube.                           | Sem "Verdão do Oeste"; trato do tema com respeito: nenhuma menção ao acidente de 2016.                   | M     |
| 20  | Remador: "Remo" virou quem rema.                                                                          | Sem leão azul; nome distinto do oficial.                                                                 | B     |

## Clássicos (pares simétricos, para `rivals`)

| Par                         | Clássico (nome fictício, trocadilho) | Real em que se inspira             | Tipo                    |
| --------------------------- | ------------------------------------ | ---------------------------------- | ----------------------- |
| Flamingo x Fluminário       | **Flami-Flumi**                      | Fla-Flu                            | cidade (Rio)            |
| Flamingo x Vasconcelos      | **Clássico dos Bilhões**             | Clássico dos Milhões               | cidade (Rio)            |
| Flamingo x Botafogueira     | **Clássico Vovó**                    | Clássico Vovô                      | cidade (Rio)            |
| Fluminário x Botafogueira   | sem nome próprio                     | clássico carioca                   | cidade (Rio)            |
| Fluminário x Vasconcelos    | sem nome próprio                     | clássico carioca                   | cidade (Rio)            |
| Botafogueira x Vasconcelos  | sem nome próprio                     | clássico carioca                   | cidade (Rio)            |
| Corinto x Palmeral          | **Dérbi Paulistão**                  | Derby Paulista                     | cidade (São Paulo)      |
| Corinto x São Paulão        | **Majestosão**                       | Majestoso                          | cidade (São Paulo)      |
| Palmeral x São Paulão       | **Choque-Rey**                       | Choque-Rei                         | cidade (São Paulo)      |
| Santões x São Paulão        | **San-Pau**                          | San-São                            | estado (SP)             |
| Santões x Corinto           | **Clássico Alvinegrão**              | Clássico Alvinegro                 | estado (SP)             |
| Santões x Palmeral          | **Clássico da Saudosa**              | Clássico da Saudade                | estado (SP)             |
| Flamingo x Corinto          | **Clássico das Massas**              | clássico entre as maiores torcidas | nacional                |
| Atlético Minério x Cruzador | **Clássico do Minério**              | Clássico Mineiro                   | cidade (Belo Horizonte) |
| Grêmeos x Inter-Regional    | **Gêm-Reg**                          | Gre-Nal                            | cidade (Porto Alegre)   |
| Tufão x Coritibom           | **Tufotiba**                         | Atletiba                           | cidade (Curitiba)       |
| Baião x Vitorioso           | **Bai-Vit**                          | Ba-Vi                              | cidade (Salvador)       |

**Sem clássico real na lista:** Bragantão, Miragol, Chapecão e Remador (os rivais reais deles não estão na Série A 2026). Decisão do CEO: ficam sem rival (ver decisões).

## Formas em es e en

Nenhum nome muda. Nomes de clássicos são conteúdo à parte (aparecem em notícias) e podem ganhar forma livre em es e en depois, com a mesma chave. "Grêmeos", "Baião", "Botafogueira" e "Chapecão" mantêm acentos e til; "Inter-Regional" mantém o hífen. Apelidos de torcida não se traduzem.

## Lista reserva (subida da Série B): os 4 rebaixados de 2025 mais 3 tradicionais

| Nome completo              | Nome curto  | Sigla | Cidade / UF       | Porte   | Cores                               | Apelido      | Inspirado em               | Trocadilho (uma linha)                     | Risco |
| -------------------------- | ----------- | ----- | ----------------- | ------- | ----------------------------------- | ------------ | -------------------------- | ------------------------------------------ | ----- |
| Sportivo Arrecifes         | Arrecifes   | ARR   | Recife, PE        | médio   | vermelho `#C8102E`, preto `#111417` | Arrecifeiros | Sport (rebaixado)          | "recife" no sentido de recife de coral     | M     |
| Juvenília Esporte Clube    | Juvenília   | JVL   | Caxias do Sul, RS | pequeno | verde `#00843D`, branco `#FFFFFF`   | Vinhateiros  | Juventude (reb.)           | "juventude" em tom de nome próprio         | B     |
| Seará Sporting Clube       | Seará       | SEA   | Fortaleza, CE     | médio   | preto `#111417`, branco `#FFFFFF`   | Barulheira   | Ceará (rebaixado)          | "Ceará" com o som de "ser" ("será")        | M     |
| Fortaleça Esporte Clube    | Fortaleça   | FRT   | Fortaleza, CE     | médio   | azul `#003399`, vermelho `#D6001C`  | Aliados      | Fortaleza (reb.)           | verbo "fortalecer" no imperativo           | M     |
| Goiabada Esporte Clube     | Goiabada    | GBD   | Goiânia, GO       | médio   | verde `#00843D`, branco `#FFFFFF`   | Doceiros     | Goiás                      | fruta e doce no lugar de "Goiás"           | B     |
| Ilhéu Esporte Clube        | Ilhéu       | ILH   | Florianópolis, SC | pequeno | azul `#0057A8`, branco `#FFFFFF`    | Manezinhos   | Avaí                       | morador da ilha, no lugar de "Avaí"        | M     |
| Ponte Velha Atlético Clube | Ponte Velha | PNV   | Campinas, SP      | médio   | preto `#111417`, branco `#FFFFFF`   | Pontistas    | Ponte Preta (Série B 2026) | "Ponte Preta" com a cor trocada pela idade | M     |

Clássicos da reserva: **Seará x Fortaleça** = **Clássico-Reino** (de Clássico-Rei); Goiabada, Juvenília, Arrecifes, Ilhéu e Ponte Velha sem par na lista (Ponte Velha: sem Guarani na lista). Mesma conferência e mesmo limite dos 20. Goiás, Avaí e Ponte Preta confirmados na Série B 2026 pelo Orquestrador; Paysandu saiu (está na Série C).

## Decisões do CEO (2026-11-04)

1. Reserva: sai Pai d'Égua (Paysandu caiu para a Série C) e o Re-Pai; entra Ponte Velha (PNV, Campinas) ← Ponte Preta.
2. "Baía" vira **Baião Esporte Clube** (BAO); o clássico vira Bai-Vit.
3. Inter-Regional segue médio por ora (pode virar "médio forte" na `strength`).
4. Bragantão, Miragol, Chapecão e Remador ficam **sem rival**; `rivals` vazio é válido (o `developer` confirma na T-003).
5. Chapecão: nenhuma alusão à história do clube real, em notícias, cerimônias ou posts.
6. Regras de padrão de uniforme e de símbolo (clubes de mesma dupla de cores) ficam com o `art-director` na US-002.
7. Consulta ao INPI: pendente com o CEO (marcados M primeiro).
8. Apelidos "Coríntios" e "Tricoloridos": mantidos.
9. Lista bloqueada em hash: entra com a T-003. Estádios e capacidades: próximo lote. Nada foi gravado em `app/src/`; isso entra na T-003.

## Ajustes do CEO (2026-11-04), rodada 2

10. Remador: apelido da torcida "Azulinos" vira **Remeiros** (o antigo é apelido real do Remo).
11. Goiabada (reserva): sigla "GOI" vira **GBD** (GOI é a sigla real do Goiás).

## Ajustes do CEO (2026-11-04), rodada 3

12. Porte por história e torcida, não pela colocação: 12 grandes, 5 médios e 3 pequenos, como em `docs/design/clubes-serie-a.md`. Só a coluna Porte da tabela principal mudou.
