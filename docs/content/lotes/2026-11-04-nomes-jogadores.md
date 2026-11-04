# Lote 2026-11-04: nomes de jogadores (brasileiros), T-004 / US-003

Autor: `content-writer`. Pedido: `/content nomes de jogadores`. Status: **revisão 2 — aguardando ok do CEO** (a revisão 1 foi aprovada em 2026-11-04 com ajustes; esta revisão trata do QA da T-006). Nada foi gravado em `app/src/`; as listas aprovadas viram arquivos em `app/src/content/names/` (a lista de atletas reais bloqueados fica fora do repositório, só em hash, via `npm run blocklist:hash`).

## Números propostos e por quê

| Lista                                  | Itens | Por quê                                                                                        |
| -------------------------------------- | ----- | ---------------------------------------------------------------------------------------------- |
| Prenomes simples                       | 398   | variedade por região e geração; 500 jogadores por carreira consomem poucos por vez             |
| Prenomes compostos                     | 20    | sabor de arquibancada ("João Pedro"), usados em ~4% dos prenomes                               |
| Sobrenomes                             | 386   | portugueses, italianos, alemães, japoneses, árabes, poloneses e outros, como no Brasil real    |
| Formas curtas do prenome (diminutivos) | 117   | só entram junto de sobrenome, origem ou apelido; nunca sozinhas                                |
| Apelidos-base                          | 130   | alcunhas leves (bichos, objetos, ofícios, lances)                                              |
| Origens inventadas                     | 49    | lugares inventados, palavra única de até 9 letras (como "Valetatu"), para o "Rafa de Valetatu" |

Conta de variedade: 500 jogadores por carreira cabem folgados em 418 x 398 (cerca de 166 mil nomes completos), e no apelido há 128 x 49 e 128 x 398 combinações. Em 10 temporadas entram uns 800 jovens novos; a chance de dois jogadores do mesmo clube terem o mesmo nome de exibição é praticamente zero com as regras abaixo, e o gerador ainda confere (sorteia de novo). Se o CEO quiser cortar, o piso seguro é 250 prenomes, 300 sobrenomes e 100 apelidos.

## Regras de montagem recomendadas (o developer implementa)

Cada jogador tem **nome completo** (prenome + sobrenome, e às vezes segundo sobrenome) e **nome de exibição**, ambos determinísticos pela `nameSeed`. Sorteio da forma de exibição:

| Forma de exibição                         | Peso | Exemplo (inventado) |
| ----------------------------------------- | ---- | ------------------- |
| Prenome + sobrenome                       | 30%  | Heitor Tavares      |
| Só sobrenome                              | 25%  | Tavares             |
| Forma curta + sobrenome                   | 15%  | Biel Tavares        |
| Apelido-base sozinho                      | 10%  | Pardal              |
| Prenome ou forma curta + origem inventada | 8%   | Rafa de Valetatu    |
| Prenome + apelido-base                    | 7%   | Heitor Sabiá        |
| Forma curta + apelido-base                | 5%   | Juninho Trovão      |

Regras:

1. **Nunca prenome ou forma curta sozinha** como nome de exibição (evita "Dudu", "Fred", "Paulinho", "Gerson" etc., que são apelidos de atletas reais). O apelido-base sozinho só vale se não estiver na lista bloqueada.
2. **Só sobrenome** pede sobrenome com 4 letras ou mais e fora do campo `familyNoSolo` (os 6 sobrenomes que coincidem com apelido de atleta real; continuam valendo em "Prenome + sobrenome").
3. **Forma curta com o prenome certo**: a forma curta só pode ser sorteada se o jogador tiver o prenome correspondente. Se está em `shortOf`, o prenome do nome completo (para composto, a primeira palavra) precisa estar na lista da forma curta ("Pedrinho" só para Pedro); se está em `shortGeneric`, vale para qualquer um. Assim "Pedrinho Sodré" nunca tem nome completo "Everaldo Sodré".
4. **Sem repetição no clube**: o gerador compara o nome de exibição normalizado (minúsculas, sem acento) com os já usados no elenco e sorteia de novo se repetir. Dois "Tavares" no mesmo clube não passam nem como "Heitor Tavares" e "Tavares".
5. **Variedade entre carreiras**: a semente do jogo entra no sorteio; os sobrenomes se repetem pouco (limite de 3 por clube).
6. **Sobrenome composto** (segundo sobrenome) em 35% dos nomes completos, só no nome completo, nunca no de exibição.
7. **Pesos regionais**: não há. Todas as listas valem para todos os clubes, para não criar estereótipo de região. Sobrenomes de imigração (italianos, alemães, japoneses, árabes, poloneses) somam cerca de 20% do sorteio, perto da realidade.
8. **Origem inventada**: palavra única de `origins`, sempre precedida de "de" ("Rafa de Valetatu", "Biel de Lagolira"); nunca município, distrito, bairro ou clube real. Serve para ambos os gêneros de palavra, sem artigo.
9. **Verificação final (por nome gerado)**: normaliza (minúsculas, sem acento, hífen vira espaço) e compara com a lista bloqueada tanto o nome de exibição quanto o nome completo; se bater, sorteia de novo.
10. **Limite de tamanho do nome de exibição: 22 caracteres** (contando espaços e o "de"). Se a forma sorteada passar disso (ex.: "Epaminondas de Pontavela", "Rodriguinho Chave de Fenda"), o gerador sorteia de novo, primeiro a forma e, se preciso, o jogador; nunca corta o texto. O nome completo não tem limite, mas a tela deve usar sempre o de exibição. O limite vale para o jogo inteiro (listas e telas dimensionadas para 22).
11. **Placeholders e idiomas**: nomes de pessoas não se traduzem; as mesmas listas valem em pt-BR, es e en.

## Prenomes simples (398)

Adalberto, Adão, Adauto, Adelson, Ademar, Adilson, Afonso, Agenor, Airton, Alan, Alberto, Alcides, Alcir, Aldo, Alessandro, Alex, Alexandre, Alexsandro, Alfredo, Almir, Altair, Aluísio, Álvaro, Amadeu, Amaro, Anderson, André, Andrey, Ângelo, Anselmo, Antenor, Antônio, Aparecido, Arlindo, Armando, Arnaldo, Artur, Átila, Augusto, Aurélio, Ayrton, Baltazar, Benedito, Benício, Benjamin, Bento, Bernardo, Breno, Brian, Bruno, Caetano, Caio, Calebe, Camilo, Carlos, Cauã, Cauê, Celso, César, Cícero, Cirilo, Cláudio, Clayton, Clóvis, Cristiano, Cristian, Dalton, Damião, Daniel, Danilo, Davi, Denis, Diego, Diogo, Domingos, Douglas, Edgar, Edmar, Edson, Eduardo, Elias, Elton, Emanuel, Emerson, Enzo, Erick, Everaldo, Ezequiel, Fabiano, Fábio, Fabrício, Felipe, Fernando, Filipe, Flávio, Francisco, Frederico, Gabriel, Geraldo, Gilberto, Giovani, Guilherme, Gustavo, Heitor, Helder, Henrique, Hélio, Hugo, Humberto, Iago, Igor, Ítalo, Ivan, Jackson, Jair, Jeferson, Jean, Joaquim, João, Jonas, Jorge, José, Josué, Juliano, Júlio, Leandro, Leonardo, Luan, Lucas, Luciano, Luís, Luiz, Manoel, Marcelo, Márcio, Marcos, Mário, Mateus, Matheus, Maurício, Miguel, Murilo, Nathan, Nelson, Nicolas, Otávio, Osvaldo, Patrick, Paulo, Pedro, Rafael, Raul, Renan, Renato, Ricardo, Roberto, Rodrigo, Rogério, Samuel, Sérgio, Thiago, Tiago, Vagner, Valdir, Vicente, Victor, Vinícius, Vitor, Wagner, Wallace, Wellington, Wesley, Yago, Yuri, Abel, Abner, Acácio, Adelmo, Adonias, Agostinho, Alaor, Alderico, Aleixo, Alípio, Amílcar, Anacleto, Anderlei, Aníbal, Anísio, Aristeu, Arilson, Armindo, Ataíde, Aurino, Avelino, Baltasar, Belmiro, Bartolomeu, Basílio, Belarmino, Boaventura, Brás, Cassiano, Cléber, Cleiton, Cleverson, Crispim, Cristóvão, Dagoberto, Daivison, Damásio, Dário, Dejair, Delcir, Demétrio, Dilson, Dimas, Dionísio, Divino, Durval, Edenilson, Edivaldo, Edvaldo, Efraim, Elcio, Eliseu, Eloy, Ênio, Epaminondas, Erasmo, Ernani, Eurico, Evandro, Evaristo, Fabrizio, Faustino, Felício, Fidélis, Florêncio, Fortunato, Gedeão, Geovane, Gidalto, Gildo, Givaldo, Glauber, Gleison, Godofredo, Gonçalo, Gregório, Haroldo, Hebert, Hermes, Hilário, Hiago, Honório, Horácio, Ícaro, Ildo, Inácio, Ismael, Israel, Itamar, Ivo, Jaci, Jaime, Jandir, Janio, Jarbas, Jasão, Jessé, Jocimar, Joelson, Jonatas, Josias, Judson, Juvenal, Kaíque, Kauan, Kayke, Lauro, Lázaro, Leodoro, Levi, Lindomar, Lisandro, Lucélio, Ludovico, Maicon, Marlon, Mauro, Max, Moacir, Moisés, Nailton, Natanael, Neemias, Nilson, Nivaldo, Noé, Odair, Olavo, Orlando, Orestes, Oséias, Osmar, Otoniel, Pascoal, Plínio, Policarpo, Quirino, Raimundo, Reginaldo, Reinaldo, Ronei, Rubens, Rudnei, Rui, Sandro, Saulo, Sebastião, Severino, Silvano, Silvio, Sidney, Tadeu, Telmo, Teodoro, Tércio, Tobias, Ubiratã, Ulisses, Valmir, Valter, Venâncio, Wanderley, Washington, Wélton, Wilson, Zacarias, Zenildo, Arthur, Bryan, Dante, Enrico, Ethan, Gael, Henry, Isaac, Kevin, Lorenzo, Lukas, Théo, Yan, Ravi, Otto, Pietro, Rael, Rhuan, Samir, Thales, Thomaz, Vitório, Welington, Kaleb, Luigi, Michel, Murillo, Noah, Pablo, Brayan, Cauan, Emílio, Fausto, Giuliano, Hudson, Ivanildo, Jhonatan, Josenildo, Kelvin, Lenon, Mikael, Natan, Nathã, Ruan, Ryan, Tales, Thalison, Wallison, Weslley, Abílio, Aderbal, Cleomar, Dalmir, Eustáquio, Genésio, Jurandir, Laércio

## Prenomes compostos (20)

Antônio Carlos, João Pedro, José Carlos, Luiz Felipe, Pedro Henrique, João Victor, João Gabriel, Marco Antônio, José Augusto, Pedro Lucas, Gabriel Henrique, Lucas Gabriel, Jorge Luiz, Luís Fernando, Pedro Paulo, Antônio Marcos, José Roberto, João Lucas, Pedro Miguel, Luís Miguel

## Sobrenomes (386)

Silva, Santos, Oliveira, Souza, Rodrigues, Ferreira, Alves, Pereira, Lima, Gomes, Costa, Ribeiro, Martins, Carvalho, Almeida, Lopes, Soares, Fernandes, Vieira, Barbosa, Rocha, Dias, Nascimento, Andrade, Moreira, Nunes, Marques, Machado, Mendes, Freitas, Cardoso, Ramos, Gonçalves, Santana, Teixeira, Araújo, Cavalcanti, Monteiro, Moura, Correia, Pinto, Campos, Cunha, Borges, Duarte, Azevedo, Medeiros, Siqueira, Tavares, Batista, Brito, Bezerra, Albuquerque, Barros, Peixoto, Fonseca, Guimarães, Miranda, Nogueira, Pacheco, Pires, Prado, Reis, Sampaio, Sales, Torres, Vasconcelos, Xavier, Aguiar, Amaral, Assis, Bastos, Bittencourt, Camargo, Castro, Coelho, Coutinho, Dantas, Damasceno, Esteves, Falcão, Farias, Figueiredo, Franco, Furtado, Garcia, Gouveia, Henriques, Holanda, Leite, Lacerda, Leal, Macedo, Magalhães, Matos, Meireles, Meira, Neves, Novaes, Paiva, Paixão, Pimentel, Queiroz, Ramalho, Rangel, Resende, Rezende, Salgado, Sarmento, Seixas, Serra, Simões, Tenório, Toledo, Valadares, Valente, Vaz, Vidal, Viana, Aquino, Arruda, Bandeira, Barreto, Bragança, Brandão, Cabral, Caldas, Calixto, Cândido, Cerqueira, Chaves, Corrêa, Cordeiro, Cruz, Domingues, Evangelista, Faria, Feitosa, Fialho, Galvão, Godoy, Guedes, Honorato, Jordão, Laranjeira, Lemos, Lessa, Loureiro, Maciel, Mascarenhas, Maia, Menezes, Morais, Motta, Muniz, Nobre, Ornelas, Paranhos, Pedrosa, Penha, Portela, Quintão, Rabelo, Raposo, Rebouças, Rego, Ribas, Rios, Rolim, Rosa, Sá, Sena, Sobral, Sodré, Telles, Trindade, Uchoa, Urbano, Varela, Vilela, Zampieri, Bortolini, Bertolino, Brunetti, Cavalini, Colombo, Dallago, Fontana, Gallo, Giordano, Lombardi, Marchetti, Morelli, Panizza, Pezzotti, Piccoli, Rossetti, Salvatori, Tonelli, Venturini, Zanini, Vitale, Cristofoli, Basso, Toniolo, Martinelli, Spadoni, Schmidt, Krause, Weber, Hoffmann, Kroeger, Steffen, Wendt, Ziegler, Brandt, Engel, Fischer, Lorenz, Hartmann, Klein, Moser, Pfeifer, Reinert, Stahl, Vogel, Takahashi, Nakamura, Yamada, Matsuda, Kobayashi, Ishikawa, Tanaka, Okamoto, Sakai, Higa, Khoury, Nasser, Sabbag, Zogbi, Jabour, Salim, Bechara, Kowalski, Nowak, Wisniewski, Sobczak, Kaminski, Mazur, Wrobel, Fernández, Gutiérrez, Navarro, Molina, Ibáñez, Pestana, Salazar, Bernardes, Portugal, Medina, Beltrão, Lourenço, Serrano, Teles, Anjos, Amorim, Barcelos, Bernardi, Borba, Brum, Bueno, Cabrera, Canto, Cardim, Chagas, Conceição, Dorneles, Flores, Fraga, Frota, Gama, Granja, Guerra, Ilha, Jardim, Lago, Lamas, Lins, Lobo, Luz, Maranhão, Marinho, Mattos, Mello, Mota, Nóbrega, Ourique, Parente, Peres, Porto, Prates, Ramires, Ribeira, Rubim, Saraiva, Sardinha, Sousa, Souto, Tomé, Travassos, Trevisan, Vargas, Vilar, Albernaz, Aranha, Arantes, Bacelar, Beltrame, Bonfim, Cafezeiro, Calado, Cambraia, Capistrano, Carneiro, Carrilho, Casimiro, Castanheira, Cavalheiro, Ceccato, Cidade, Coimbra, Colaço, Cotrim, Cravo, Dornelas, Fagundes, Fiúza, Gaspar, Gusmão, Jacinto, Lameira, Lanza, Lustosa, Madeira, Magno, Malta, Mangueira, Mesquita, Morgado, Nolasco, Olímpio, Palhares, Patrício, Paz, Pinheiro, Pontes, Quintela, Regis, Roque, Sacramento, Sabino, Salomão, Sepúlveda, Silveira, Tabosa, Tolentino, Toscano, Trigueiro, Uliana, Valério, Zeferino, Cantarelli, Bonetti, Lunardi, Zimmer, Lindner, Ogawa, Matsumoto, Mansur, Karam, Barreiros, Calazans, Ventura, Furlan, Vasques, Linhares

## Formas curtas do prenome (117)

**Genéricas** (`shortGeneric`, valem para qualquer prenome): Juninho, Dinho, Binho, Nino, Nininho, Dico, Dodô, Lalá, Lelê, Lico, Mazinho, Mimi, Neném, Netinho, Pepê, Tinho, Tito, Titico.

**Por prenome** (`shortOf`, forma curta: prenomes de origem): Betinho (Alberto, Roberto, Adalberto, Humberto); Zezinho (José); Toninho (Antônio); Marquinhos (Marcos, Marcelo, Márcio); Pedrinho (Pedro); Luizinho (Luiz, Luís); Carlinhos (Carlos); Rafinha (Rafael); Biel (Gabriel); Bielzinho (Gabriel); Guto (Gustavo, Augusto); Gutinho (Gustavo, Augusto); Digão (Diego, Rodrigo, Diogo); Rafa (Rafael); Thi (Thiago, Tiago); Gui (Guilherme); Guigo (Guilherme); Lipe (Felipe, Filipe); Lipão (Felipe, Filipe); Fê (Fernando); Du (Eduardo); Léo (Leonardo, Leandro); Leozinho (Leonardo, Leandro); Nando (Fernando, Armando); Cacá (Carlos, Cláudio); Cadu (Eduardo, Carlos); Cau (Cauã, Cauê, Cauan); Caíco (Caio); Rodrigão (Rodrigo); Rodriguinho (Rodrigo); Jão (João); Joãozinho (João); Tiaguinho (Tiago); Tiagão (Tiago); Mateusinho (Mateus, Matheus); Vitinho (Vitor, Victor, Vitório); Vitão (Vitor, Victor, Vitório); Vinão (Vinícius); Vini (Vinícius); Vinizinho (Vinícius); Gabi (Gabriel); Gabão (Gabriel); Gabizinho (Gabriel); Lucão (Lucas, Lukas); Lukinhas (Lucas, Lukas); Luquinhas (Lucas, Lukas); Brunão (Bruno); Brunin (Bruno); Bruninho (Bruno); Rickinho (Ricardo, Erick); Ricardão (Ricardo); Beto (Alberto, Roberto, Adalberto, Humberto); Betão (Alberto, Roberto, Adalberto, Humberto); Chico (Francisco); Chiquinho (Francisco); Zeca (José); Zé (José); Zezé (José); Totó (Antônio); Tonho (Antônio); Tonico (Antônio); Pipo (Felipe, Filipe); Pipa (Felipe, Filipe); Dedé (André); Duda (Eduardo); Edu (Eduardo); Eduzinho (Eduardo); Fabinho (Fábio, Fabiano, Fabrício); Fabão (Fábio, Fabiano, Fabrício); Felipinho (Felipe, Filipe); Flávinho (Flávio); Geraldinho (Geraldo); Giba (Gilberto); Gil (Gilberto, Gildo); Gilsinho (Gilberto, Gildo); Henriquinho (Henrique); Ivinho (Ivan, Ivo); Marcão (Marcos, Marcelo, Márcio); Miguelito (Miguel); Miro (Almir); Naldo (Reinaldo, Reginaldo, Arnaldo); Naldinho (Reinaldo, Reginaldo, Arnaldo); Paulão (Paulo); Quico (Francisco); Raulzinho (Raul); Renanzinho (Renan); Rodão (Rodrigo); Rubão (Rubens); Sandrinho (Sandro, Alessandro); Serginho (Sérgio); Tadeuzinho (Tadeu); Teco (Teodoro); Tião (Sebastião); Valtinho (Valter, Valdir, Valmir); Wandão (Wanderley); Weslão (Wesley, Weslley); Xande (Alexandre, Alexsandro); Yagão (Yago); Zequinha (José).

## Apelidos-base (130)

Tatu, Pardal, Sabiá, Curió, Quero Quero, Jabuti, Capivara, Guaxinim, Tamanduá, Cutia, Preá, Lontra, Trovão, Relâmpago, Foguete, Turbina, Flecha, Cometa, Meteoro, Rojão, Estilingue, Canhão, Martelo, Marreta, Trator, Escudeiro, Zagueirão, Maestro, Professor, Doutor, Capitão, Comandante, Sargento, Xerife, Barão, Duque, Conde, Príncipe, Mestre, Artilheiro, Foguetinho, Mosquito, Vespa, Marimbondo, Abelha, Besouro, Grilo, Cigarra, Libélula, Joaninha, Tico Tico, Canário, Bem te vi, Sanhaço, João de Barro, Gavião Real, Coruja, Carcará, Jacaré, Cascavel, Jibóia, Sucuri, Camaleão, Lagartixa, Pirarucu, Tucunaré, Dourado, Lambari, Tilápia, Golfinho, Pinguim, Lobo Guará, Jaguatirica, Gato do Mato, Tamanduaí, Quati, Esquilo, Coelho, Raposinha, Potro, Pescador, Poeta, Cantor, Sambista, Seresteiro, Tamborim, Pandeiro, Cuíca, Berimbau, Repique, Reco Reco, Agogô, Cavaquinho, Bandolim, Piano, Flautim, Trombone, Apito, Escanteio, Rabona, Elástico, Chapéu, Lençol, Drible, Folha Seca, Bicicleta, Voleio, Cabeçada, Carrinho, Cobertura, Tabela, Pivô, Bigorna, Parafuso, Chave de Fenda, Alicate, Ferrolho, Cadeado, Compasso, Bússola, Farol, Lanterna, Vela, Faísca, Brasa, Paçoca, Brigadeiro, Cocada, Maritaca, Saracura

## Origens inventadas (49)

Valesabiá, Valequati, Valefarol, Valegaita, Vilasabiá, Vilaquati, Vilafarol, Vilagaita, Lagosabiá, Lagoquati, Lagofarol, Lagogaita, Altosabiá, Altoquati, Altofarol, Altogaita, Serratatu, Serrapreá, Serravela, Serrasino, Serralira, Pontatatu, Pontapreá, Pontavela, Pontasino, Pontalira, Morrotatu, Morropreá, Morrovela, Morrosino, Morrolira, Barratatu, Barrapreá, Barravela, Barrasino, Barralira, Valetatu, Lagolira, Altosino, Valevela, Vilapreá, Valelira, Vilalira, Altolira, Lagovela, Valesino, Vilatatu, Altopreá, Lagotatu

## Cuidados de tom

- Sem apelido sobre aparência, corpo, origem, região, religião ou deficiência; sem nome de bicho que sirva de ofensa; sem apelido de regionalismo ou ofício estereotipado.
- Nada de santo ou entidade como apelido. Sobrenomes religiosos comuns no Brasil (Conceição, Trindade, Bonfim, Sacramento) ficam porque são sobrenomes de família, não piada.
- Ofícios e instrumentos (Maestro, Professor, Pandeiro) são respeitosos.

## Dúvidas para o CEO

1. Aceita o piso de 250 / 300 / 100 caso queira lista menor, ou prefere as listas completas?
2. Os pesos de exibição (55% só nome e sobrenome, 30% com apelido ou origem) soam bem?

## Colisões com a lista bloqueada (contagem; a lista em si fica fora do repositório)

- Contagens antes dos ajustes do code review (ordem de grandeza): prenome sozinho igual a item bloqueado, 23; forma curta sozinha, 14 (o filtro de rule 1 já as exclui); sobrenome sozinho, 6 (`familyNoSolo`); apelido-base, 0.
- Pares "prenome ou forma curta + sobrenome" que reproduzem um nome completo bloqueado: cerca de 58, de um universo de mais de 100 mil. Por isso a verificação final por nome gerado (regra 8) é obrigatória; ela não precisa de exceção nas listas.
- Solução: bloquear só a forma exata normalizada, nunca por pedaço (bloquear "Silva" ou "Pedro" eliminaria nomes comuns); proibir prenome ou forma curta sozinha como exibição (regra 1); e os 6 sobrenomes que colidem ficam no campo `familyNoSolo` do JSON (Coutinho, Falcão, Cabral, Martinelli, Ramires, Vargas), sem sair da lista; os pares prenome+sobrenome que coincidem são bloqueados por índice pelo developer.

## Revisão de tom (ajustes do CEO, 2026-11-04)

Removidos por duplo sentido, gíria ofensiva, pessoa notória ou termo pejorativo: Veadinho, Traíra, Furão, Cavalinho, Atabaque, Bandeirinha, Corneta, Tucano, Bazuca, Bala, Carvão, Cafezinho e Isqueiro (apelidos-base); Marcola, Jeca, Popó, Deco, Lulu e Xandão (formas curtas); Maluf, Mourão, Escobar, Calheiros, Barbalho e Cavaco (sobrenomes); Genivaldo (prenome). Origens: lista refeita com composições claramente inventadas, depois em palavra única. Ajustes posteriores: "Vinicius" (duplicata sem acento de "Vinícius") e "Ana" (feminino, estava nos compostos) saíram; os demais prenomes foram conferidos e não há outro feminino.

- Ajustes do code review da T-004: formas curtas sem prenome correspondente saíram (Caíque, Dudinha, Matinha, Macário, Rominho; os dois primeiros e o último por serem prenome ou feminino ou sem base); campos novos `shortOf` e `shortGeneric`; palavras que estavam em prenomes e sobrenomes ficaram em uma lista só (prenomes: Bento, César, Elias, Hilário, Venâncio, Vicente; sobrenomes: Xavier, Cândido, Lourenço); "Zeca" saiu dos prenomes (é forma curta); `familyNoSolo` perdeu Bento, ficou com 6.

## Revisão 2: o que saiu, o que entrou e por quê (QA da T-006, 2026-11-04)

Critério: sai o que lembra de imediato uma pessoa real conhecida (atleta, técnico, artista, escritor, político, marca). Nome comum de família e prenome popular ficam; o que pesa é a associação forte. Avaliação dos casos do QA: Cartola (apelido-base; sambista famoso) saiu; Dudek (goleiro estrangeiro famoso) saiu; Carlos Alberto (capitão histórico) saiu; Everton e Wendel (prenomes de jogadores muito conhecidos) saíram; Padilha (técnico e político) saiu; Cury (autor best-seller) saiu; Garrido (sobrenome de jogador estrangeiro conhecido) saiu.

**Saíram**

- Prenomes (22): Alisson, Everton, Wendel, Dener, Derlei, Edmundo, Gerson, Dirceu, Aldair, Ademir, Adriano, Leônidas, Clodoaldo, Dorival, Riquelme, Cássio, Firmino, Ailton, Elivelton, Jadson, Edilson, Kléber. Motivo: prenomes que viraram nome próprio de ídolo ou de atleta de seleção (muitos são conhecidos só pelo prenome).
- Compostos (5): Carlos Alberto, Luiz Gustavo, Luiz Henrique, Carlos Eduardo, Paulo Roberto. Motivo: ídolos e jogadores de seleção conhecidos pelo composto inteiro.
- Sobrenomes (36): Dudek, Cury, Garrido, Padilha, Lewandowicz, Zielinski, Ortega, Cáceres, Quaresma, Valdez, Morales, Bianchi, Ferrari, Becker, Haddad, Camões, Pessoa, Veloso, Barroso, Lobato, Guerreiro, Pellegrini, Zanetti, Santoro, Drumond, Quadros, Montenegro, Saldanha, Peçanha, Perdigão, Tamandaré, Falconi, Paes, Bocaiúva, Neto, Alcântara. Motivo: atletas e técnicos estrangeiros famosos (Dudek, Ortega, Zanetti, Pellegrini, Zielinski, Bianchi, Cáceres, Quaresma, Valdez), grafia quase igual a de atleta (Lewandowicz), escritores, artistas, políticos e marcas (Camões, Pessoa, Veloso, Barroso, Lobato, Drumond, Quadros, Montenegro, Peçanha, Paes, Haddad, Ferrari, Perdigão, Becker, Falconi, Saldanha, Bocaiúva, Tamandaré).
- Apelidos-base (2): Cartola, Mágico (alcunhas de sambista e de ídolo conhecidos).
- Formas curtas (6): Fernandinho, Felipão, Jairzinho, Jorginho, Thiaguinho, Zinho (alcunhas muito ligadas a atletas, técnicos ou cantores). Em `shortOf`, Adriano e Cássio e Leônidas saíram das listas de bases (Dedé, Léo, Leozinho, Cacá); `shortGeneric` perdeu Zinho (18 itens). Todas as bases de `shortOf` existem nos prenomes.
- `familyNoSolo` não mudou (6): todos continuam na lista de sobrenomes; só não valem sozinhos.

**Entraram**

- Prenomes (8): Abílio, Aderbal, Cleomar, Dalmir, Eustáquio, Genésio, Jurandir, Laércio. Motivo: prenomes de família antigos, sem ídolo óbvio, para manter a variedade.
- Compostos (6): Pedro Paulo, Antônio Marcos, José Roberto, João Lucas, Pedro Miguel, Luís Miguel. Motivo: mesmo sabor de arquibancada, sem composto de ídolo.
- Sobrenomes (15): Cantarelli, Bonetti, Lunardi, Zimmer, Lindner, Ogawa, Matsumoto, Mansur, Karam, Barreiros, Calazans, Ventura, Furlan, Vasques, Linhares. Motivo: repor o peso de imigração (italianos, alemães, japoneses, árabes) e de sobrenomes ibéricos.
- Apelidos-base (2): Maritaca, Saracura (aves, sem ligação com pessoa).

**Origens trocadas (as 49)**: todas viram palavra única de no máximo 9 letras, prefixo + base curta (Vale, Vila, Lago, Alto + sabiá, quati, farol, gaita, e Serra, Ponta, Morro, Barra + tatu, preá, vela, sino, lira; mais 13 de prefixo curto + base curta). Exemplos: Valesabiá, Vilaquati, Serratatu, Pontavela, Morrolira, Barrasino, Valetatu. Os antigos (Campinasanhaço, Morrotrombone etc.) chegavam a 17 letras e davam "Carlos Alberto de Morrotrombone" (31). Nome de exibição mais longo com origem agora: prenome mais longo (11) + " de " + 9 = 24, coberto pelo limite de 22 (sorteia de novo).

**Limite proposto**: 22 caracteres no nome de exibição (regra 10), garantido no gerador; abaixo disso cabem em uma linha nas telas de 360 px as formas mais comuns ("Prenome Sobrenome" médio tem 14 a 18).

## Dúvidas para o CEO (revisão 2)

1. As origens são combinações de palavras sem sentido de lugar, mas não consegui conferir offline contra a lista de municípios e distritos; peço que o developer passe as 49 pelo `content:check` (ou o CEO bata o olho). "Serrasino", "Altosino" e "Vilaquati" são os que eu olharia primeiro.
2. Concorda com 22 caracteres? Com 20 sobrariam mais formas descartadas (mais sorteios de novo), com 24 as mais longas passariam apertadas no celular.
