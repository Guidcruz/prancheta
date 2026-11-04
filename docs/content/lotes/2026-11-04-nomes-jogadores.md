# Lote 2026-11-04: nomes de jogadores (brasileiros), T-004 / US-003

Autor: `content-writer`. Pedido: `/content nomes de jogadores`. Status: **aprovado pelo CEO em 2026-11-04 (com ajustes)**. Nada foi gravado em `app/src/`; as listas aprovadas viram arquivos em `app/src/content/names/` (a lista de atletas reais bloqueados fica fora do repositório, só em hash, via `npm run blocklist:hash`).

## Números propostos e por quê

| Lista                                  | Itens | Por quê                                                                                             |
| -------------------------------------- | ----- | --------------------------------------------------------------------------------------------------- |
| Prenomes simples                       | 417   | variedade por região e geração; 500 jogadores por carreira consomem poucos por vez                  |
| Prenomes compostos                     | 20    | sabor de arquibancada ("João Pedro"), usados em ~4% dos prenomes                                    |
| Sobrenomes                             | 413   | portugueses, italianos, alemães, japoneses, árabes, poloneses e outros, como no Brasil real         |
| Formas curtas do prenome (diminutivos) | 128   | só entram junto de sobrenome, origem ou apelido; nunca sozinhas                                     |
| Apelidos-base                          | 130   | alcunhas leves (bichos, objetos, ofícios, lances)                                                   |
| Origens inventadas                     | 49    | lugares claramente inventados (prefixo + palavra solta, como "Vale Cometa"), para o "Nome de Lugar" |

Conta de variedade: 500 jogadores por carreira cabem folgados em 417 x 413 (cerca de 172 mil nomes completos), e no apelido há 128 x 49 e 128 x 413 combinações. Em 10 temporadas entram uns 800 jovens novos; a chance de dois jogadores do mesmo clube terem o mesmo nome de exibição é praticamente zero com as regras abaixo, e o gerador ainda confere (sorteia de novo). Se o CEO quiser cortar, o piso seguro é 250 prenomes, 300 sobrenomes e 100 apelidos.

## Regras de montagem recomendadas (o developer implementa)

Cada jogador tem **nome completo** (prenome + sobrenome, e às vezes segundo sobrenome) e **nome de exibição**, ambos determinísticos pela `nameSeed`. Sorteio da forma de exibição:

| Forma de exibição                         | Peso | Exemplo (inventado) |
| ----------------------------------------- | ---- | ------------------- |
| Prenome + sobrenome                       | 30%  | Heitor Tavares      |
| Só sobrenome                              | 25%  | Tavares             |
| Forma curta + sobrenome                   | 15%  | Biel Tavares        |
| Apelido-base sozinho                      | 10%  | Pardal              |
| Prenome ou forma curta + origem inventada | 8%   | Rafa Pindoval       |
| Prenome + apelido-base                    | 7%   | Heitor Sabiá        |
| Forma curta + apelido-base                | 5%   | Juninho Trovão      |

Regras:

1. **Nunca prenome ou forma curta sozinha** como nome de exibição (evita "Dudu", "Fred", "Paulinho", "Gerson" etc., que são apelidos de atletas reais). O apelido-base sozinho só vale se não estiver na lista bloqueada.
2. **Só sobrenome** pede sobrenome com 4 letras ou mais e fora da lista bloqueada como forma exata.
3. **Sem repetição no clube**: o gerador compara o nome de exibição normalizado (minúsculas, sem acento) com os já usados no elenco e sorteia de novo se repetir. Dois "Tavares" no mesmo clube não passam nem como "Heitor Tavares" e "Tavares".
4. **Variedade entre carreiras**: a semente do jogo entra no sorteio; os sobrenomes se repetem pouco (limite de 3 por clube).
5. **Sobrenome composto** (segundo sobrenome) em 35% dos nomes completos, só no nome completo, nunca no de exibição.
6. **Pesos regionais**: não há. Todas as listas valem para todos os clubes, para não criar estereótipo de região. Sobrenomes de imigração (italianos, alemães, japoneses, árabes, poloneses) somam cerca de 20% do sorteio, perto da realidade.
7. **Origem inventada**: sempre "prefixo + palavra" da lista, escrita com espaços no jogo; nunca município, distrito, bairro ou clube real.
8. **Verificação final (por nome gerado)**: normaliza (minúsculas, sem acento, hífen vira espaço) e compara com a lista bloqueada tanto o nome de exibição quanto o nome completo; se bater, sorteia de novo.
9. **Placeholders e idiomas**: nomes de pessoas não se traduzem; as mesmas listas valem em pt-BR, es e en.

## Prenomes simples (417)

Adalberto, Adão, Adauto, Adelson, Ademar, Ademir, Adilson, Adriano, Afonso, Agenor, Ailton, Airton, Alan, Alberto, Alcides, Alcir, Aldair, Aldo, Alessandro, Alex, Alexandre, Alexsandro, Alfredo, Alisson, Almir, Altair, Aluísio, Álvaro, Amadeu, Amaro, Anderson, André, Andrey, Ângelo, Anselmo, Antenor, Antônio, Aparecido, Arlindo, Armando, Arnaldo, Artur, Átila, Augusto, Aurélio, Ayrton, Baltazar, Benedito, Benício, Benjamin, Bento, Bernardo, Breno, Brian, Bruno, Caetano, Caio, Calebe, Camilo, Carlos, Cássio, Cauã, Cauê, Celso, César, Cícero, Cirilo, Cláudio, Clayton, Clóvis, Cristiano, Cristian, Dalton, Damião, Daniel, Danilo, Davi, Dener, Denis, Diego, Diogo, Domingos, Douglas, Edgar, Edilson, Edmar, Edson, Eduardo, Elias, Elton, Emanuel, Emerson, Enzo, Erick, Everaldo, Everton, Ezequiel, Fabiano, Fábio, Fabrício, Felipe, Fernando, Filipe, Flávio, Francisco, Frederico, Gabriel, Geraldo, Gilberto, Giovani, Guilherme, Gustavo, Heitor, Helder, Henrique, Hélio, Hugo, Humberto, Iago, Igor, Ítalo, Ivan, Jackson, Jair, Jeferson, Jean, Joaquim, João, Jonas, Jorge, José, Josué, Juliano, Júlio, Kléber, Leandro, Leonardo, Lourenço, Luan, Lucas, Luciano, Luís, Luiz, Manoel, Marcelo, Márcio, Marcos, Mário, Mateus, Matheus, Maurício, Miguel, Murilo, Nathan, Nelson, Nicolas, Otávio, Osvaldo, Patrick, Paulo, Pedro, Rafael, Raul, Renan, Renato, Ricardo, Roberto, Rodrigo, Rogério, Samuel, Sérgio, Thiago, Tiago, Vagner, Valdir, Vicente, Victor, Vinícius, Vitor, Wagner, Wallace, Wellington, Wesley, Yago, Yuri, Abel, Abner, Acácio, Adelmo, Adonias, Agostinho, Alaor, Alderico, Aleixo, Alípio, Amílcar, Anacleto, Anderlei, Aníbal, Anísio, Aristeu, Arilson, Armindo, Ataíde, Aurino, Avelino, Baltasar, Belmiro, Bartolomeu, Basílio, Belarmino, Boaventura, Brás, Cândido, Cassiano, Cléber, Cleiton, Cleverson, Clodoaldo, Crispim, Cristóvão, Dagoberto, Daivison, Damásio, Dário, Dejair, Delcir, Demétrio, Derlei, Dilson, Dimas, Dionísio, Dirceu, Divino, Dorival, Durval, Edenilson, Edivaldo, Edmundo, Edvaldo, Efraim, Elcio, Eliseu, Elivelton, Eloy, Ênio, Epaminondas, Erasmo, Ernani, Eurico, Evandro, Evaristo, Fabrizio, Faustino, Felício, Fidélis, Firmino, Florêncio, Fortunato, Gedeão, Geovane, Gerson, Gidalto, Gildo, Givaldo, Glauber, Gleison, Godofredo, Gonçalo, Gregório, Haroldo, Hebert, Hermes, Hilário, Hiago, Honório, Horácio, Ícaro, Ildo, Inácio, Ismael, Israel, Itamar, Ivo, Jaci, Jadson, Jaime, Jandir, Janio, Jarbas, Jasão, Jessé, Jocimar, Joelson, Jonatas, Josias, Judson, Juvenal, Kaíque, Kauan, Kayke, Lauro, Lázaro, Leodoro, Leônidas, Levi, Lindomar, Lisandro, Lucélio, Ludovico, Maicon, Marlon, Mauro, Max, Moacir, Moisés, Nailton, Natanael, Neemias, Nilson, Nivaldo, Noé, Odair, Olavo, Orlando, Orestes, Oséias, Osmar, Otoniel, Pascoal, Plínio, Policarpo, Quirino, Raimundo, Reginaldo, Reinaldo, Ronei, Rubens, Rudnei, Rui, Sandro, Saulo, Sebastião, Severino, Silvano, Silvio, Sidney, Tadeu, Telmo, Teodoro, Tércio, Tobias, Ubiratã, Ulisses, Valmir, Valter, Venâncio, Wanderley, Washington, Wélton, Wilson, Xavier, Zacarias, Zenildo, Arthur, Bryan, Dante, Enrico, Ethan, Gael, Henry, Isaac, Kevin, Lorenzo, Lukas, Théo, Vinicius, Yan, Ravi, Otto, Pietro, Rael, Rhuan, Samir, Thales, Thomaz, Vitório, Wendel, Welington, Zeca, Kaleb, Luigi, Michel, Murillo, Noah, Pablo, Brayan, Cauan, Emílio, Fausto, Giuliano, Hudson, Ivanildo, Jhonatan, Josenildo, Kelvin, Lenon, Mikael, Natan, Nathã, Riquelme, Ruan, Ryan, Tales, Thalison, Wallison, Weslley

## Prenomes compostos (20)

Antônio Carlos, João Pedro, José Carlos, Luiz Felipe, Luiz Henrique, Pedro Henrique, João Victor, João Gabriel, Carlos Eduardo, Marco Antônio, Paulo Roberto, José Augusto, Luiz Gustavo, Pedro Lucas, Gabriel Henrique, Lucas Gabriel, Ana , Jorge Luiz, Luís Fernando, Carlos Alberto

## Sobrenomes (413)

Silva, Santos, Oliveira, Souza, Rodrigues, Ferreira, Alves, Pereira, Lima, Gomes, Costa, Ribeiro, Martins, Carvalho, Almeida, Lopes, Soares, Fernandes, Vieira, Barbosa, Rocha, Dias, Nascimento, Andrade, Moreira, Nunes, Marques, Machado, Mendes, Freitas, Cardoso, Ramos, Gonçalves, Santana, Teixeira, Araújo, Cavalcanti, Monteiro, Moura, Correia, Pinto, Campos, Cunha, Borges, Duarte, Azevedo, Medeiros, Siqueira, Tavares, Batista, Brito, Bezerra, Albuquerque, Barros, Peixoto, Fonseca, Guimarães, Miranda, Nogueira, Pacheco, Pires, Prado, Reis, Sampaio, Sales, Torres, Vasconcelos, Xavier, Aguiar, Amaral, Assis, Bastos, Bittencourt, Camargo, Castro, Coelho, Coutinho, Dantas, Damasceno, Esteves, Falcão, Farias, Figueiredo, Franco, Furtado, Garcia, Gouveia, Henriques, Holanda, Leite, Lacerda, Leal, Macedo, Magalhães, Matos, Meireles, Meira, Neves, Novaes, Paiva, Paixão, Pimentel, Queiroz, Ramalho, Rangel, Resende, Rezende, Salgado, Sarmento, Seixas, Serra, Simões, Tenório, Toledo, Valadares, Valente, Vaz, Vidal, Viana, Aquino, Arruda, Bandeira, Barreto, Bento, Bragança, Brandão, Cabral, Caldas, Calixto, Cândido, Cerqueira, Chaves, Corrêa, Cordeiro, Cruz, Domingues, Drumond, Evangelista, Faria, Feitosa, Fialho, Galvão, Godoy, Guedes, Honorato, Jordão, Laranjeira, Lemos, Lessa, Loureiro, Maciel, Mascarenhas, Maia, Menezes, Morais, Motta, Muniz, Nobre, Ornelas, Padilha, Paranhos, Pedrosa, Penha, Portela, Quintão, Rabelo, Raposo, Rebouças, Rego, Ribas, Rios, Rolim, Rosa, Sá, Saldanha, Sena, Sobral, Sodré, Telles, Trindade, Uchoa, Urbano, Varela, Vilela, Zampieri, Bianchi, Bortolini, Bertolino, Brunetti, Cavalini, Colombo, Dallago, Fontana, Gallo, Giordano, Lombardi, Marchetti, Morelli, Panizza, Pellegrini, Pezzotti, Piccoli, Rossetti, Salvatori, Santoro, Tonelli, Venturini, Zanetti, Zanini, Ferrari, Vitale, Cristofoli, Basso, Toniolo, Martinelli, Spadoni, Schmidt, Becker, Krause, Weber, Hoffmann, Kroeger, Steffen, Wendt, Ziegler, Brandt, Engel, Fischer, Lorenz, Hartmann, Klein, Moser, Pfeifer, Reinert, Stahl, Vogel, Takahashi, Nakamura, Yamada, Matsuda, Kobayashi, Ishikawa, Tanaka, Okamoto, Sakai, Higa, Haddad, Khoury, Nasser, Sabbag, Zogbi, Jabour, Salim, Cury, Bechara, Kowalski, Nowak, Lewandowicz, Wisniewski, Sobczak, Kaminski, Dudek, Zielinski, Mazur, Wrobel, Fernández, Gutiérrez, Ortega, Navarro, Molina, Ibáñez, Cáceres, Barroso, Quaresma, Pestana, Salazar, Guerreiro, Bernardes, Camões, Portugal, Lobato, Garrido, Medina, Morales, Valdez, Beltrão, Lourenço, Serrano, Teles, Anjos, Amorim, Barcelos, Bernardi, Borba, Brum, Bueno, Cabrera, Canto, Cardim, Cesar, Chagas, Conceição, Dorneles, Flores, Fraga, Frota, Gama, Granja, Guerra, Ilha, Jardim, Lago, Lamas, Lins, Lobo, Luz, Maranhão, Marinho, Mattos, Mello, Mota, Neto, Nóbrega, Ourique, Paes, Parente, Peçanha, Perdigão, Peres, Porto, Prates, Quadros, Ramires, Ribeira, Rubim, Saraiva, Sardinha, Sousa, Souto, Tomé, Travassos, Trevisan, Vargas, Veloso, Vilar, Albernaz, Alcântara, Aranha, Arantes, Bacelar, Beltrame, Bocaiúva, Bonfim, Cafezeiro, Calado, Cambraia, Capistrano, Carneiro, Carrilho, Casimiro, Castanheira, Cavalheiro, Ceccato, Cidade, Coimbra, Colaço, Cotrim, Cravo, Dornelas, Elias, Fagundes, Falconi, Fiúza, Gaspar, Gusmão, Hilário, Jacinto, Lameira, Lanza, Lustosa, Madeira, Magno, Malta, Mangueira, Mesquita, Montenegro, Morgado, Nolasco, Olímpio, Palhares, Patrício, Paz, Pessoa, Pinheiro, Pontes, Quintela, Regis, Roque, Sacramento, Sabino, Salomão, Sepúlveda, Silveira, Tabosa, Tamandaré, Tolentino, Toscano, Trigueiro, Uliana, Valério, Venâncio, Vicente, Zeferino

## Formas curtas do prenome (128)

Juninho, Betinho, Zezinho, Toninho, Marquinhos, Pedrinho, Luizinho, Carlinhos, Rafinha, Biel, Bielzinho, Guto, Gutinho, Digão, Rafa, Thi, Gui, Guigo, Caíque, Lipe, Lipão, Fê, Fernandinho, Du, Dudinha, Léo, Leozinho, Nando, Dinho, Binho, Cacá, Cadu, Cau, Caíco, Rodrigão, Rodriguinho, Jão, Joãozinho, Tiaguinho, Tiagão, Thiaguinho, Mateusinho, Matinha, Vitinho, Vitão, Vinão, Vini, Vinizinho, Gabi, Gabão, Gabizinho, Lucão, Lukinhas, Luquinhas, Brunão, Brunin, Bruninho, Rickinho, Ricardão, Beto, Betão, Chico, Chiquinho, Zeca, Zé, Zezé, Totó, Tonho, Tonico, Nino, Nininho, Pipo, Pipa, Dedé, Dico, Dodô, Duda, Edu, Eduzinho, Fabinho, Fabão, Felipão, Felipinho, Flávinho, Geraldinho, Giba, Gil, Gilsinho, Henriquinho, Ivinho, Jairzinho, Jorginho, Lalá, Lelê, Lico, Macário, Marcão, Mazinho, Miguelito, Mimi, Miro, Naldo, Naldinho, Neném, Netinho, Paulão, Pepê, Quico, Raulzinho, Renanzinho, Rodão, Rominho, Rubão, Sandrinho, Serginho, Tadeuzinho, Teco, Tião, Tinho, Tito, Titico, Valtinho, Wandão, Weslão, Xande, Yagão, Zinho, Zequinha

## Apelidos-base (130)

Tatu, Pardal, Sabiá, Curió, Quero Quero, Jabuti, Capivara, Guaxinim, Tamanduá, Cutia, Preá, Lontra, Trovão, Relâmpago, Foguete, Turbina, Flecha, Cometa, Meteoro, Rojão, Estilingue, Canhão, Martelo, Marreta, Trator, Escudeiro, Zagueirão, Maestro, Cartola, Professor, Doutor, Capitão, Comandante, Sargento, Xerife, Barão, Duque, Conde, Príncipe, Mestre, Mágico, Artilheiro, Foguetinho, Mosquito, Vespa, Marimbondo, Abelha, Besouro, Grilo, Cigarra, Libélula, Joaninha, Tico Tico, Canário, Bem te vi, Sanhaço, João de Barro, Gavião Real, Coruja, Carcará, Jacaré, Cascavel, Jibóia, Sucuri, Camaleão, Lagartixa, Pirarucu, Tucunaré, Dourado, Lambari, Tilápia, Golfinho, Pinguim, Lobo Guará, Jaguatirica, Gato do Mato, Tamanduaí, Quati, Esquilo, Coelho, Raposinha, Potro, Pescador, Poeta, Cantor, Sambista, Seresteiro, Tamborim, Pandeiro, Cuíca, Berimbau, Repique, Reco Reco, Agogô, Cavaquinho, Bandolim, Piano, Flautim, Trombone, Apito, Escanteio, Rabona, Elástico, Chapéu, Lençol, Drible, Folha Seca, Bicicleta, Voleio, Cabeçada, Carrinho, Cobertura, Tabela, Pivô, Bigorna, Parafuso, Chave de Fenda, Alicate, Ferrolho, Cadeado, Compasso, Bússola, Farol, Lanterna, Vela, Faísca, Brasa, Paçoca, Brigadeiro, Cocada

## Origens inventadas (49)

Vale Pardal, Campina Tambor, Alto Lanterna, Serra Pandeiro, Vila Cometa, Lagoa Trovão, Ponta Maestro, Morro Bússola, Barra Foguete, Vale Apito, Campina Sanhaço, Alto Quati, Serra Pirarucu, Vila Voleio, Lagoa Escanteio, Ponta Repique, Morro Bandolim, Barra Cavaquinho, Vale Farol, Campina Relâmpago, Alto Jabuti, Serra Coruja, Vila Tatu, Lagoa Sabiá, Ponta Berimbau, Morro Estilingue, Barra Gaivota, Vale Chapéu, Campina Lençol, Alto Rabona, Serra Tamborim, Vila Agogô, Lagoa Canário, Ponta Cutia, Morro Lontra, Barra Pinguim, Vale Golfinho, Campina Marimbondo, Alto Libélula, Serra Joaninha, Vila Besouro, Lagoa Carcará, Ponta Gavião, Morro Trombone, Barra Piano, Vale Flautim, Campina Mágico, Alto Doutor, Serra Professor

## Cuidados de tom

- Sem apelido sobre aparência, corpo, origem, região, religião ou deficiência; sem nome de bicho que sirva de ofensa; sem apelido de regionalismo ou ofício estereotipado.
- Nada de santo ou entidade como apelido. Sobrenomes religiosos comuns no Brasil (Conceição, Trindade, Bonfim, Sacramento) ficam porque são sobrenomes de família, não piada.
- Ofícios e instrumentos (Maestro, Professor, Pandeiro) são respeitosos.

## Dúvidas para o CEO

1. Aceita o piso de 250 / 300 / 100 caso queira lista menor, ou prefere as listas completas?
2. Os pesos de exibição (55% só nome e sobrenome, 30% com apelido ou origem) soam bem?

## Colisões com a lista bloqueada (contagem; a lista em si fica fora do repositório)

- Prenome sozinho igual a item bloqueado: 23 de 437. Forma curta sozinha: 14 de 128. Sobrenome sozinho: 7 de 413. Apelido-base: 0 de 130.
- Pares "prenome ou forma curta + sobrenome" que reproduzem um nome completo bloqueado: cerca de 58, de um universo de mais de 100 mil. Por isso a verificação final por nome gerado (regra 8) é obrigatória; ela não precisa de exceção nas listas.
- Solução: bloquear só a forma exata normalizada, nunca por pedaço (bloquear "Silva" ou "Pedro" eliminaria nomes comuns); proibir prenome ou forma curta sozinha como exibição (regra 1); e filtrar na montagem os 7 sobrenomes e os apelidos-base que forem item bloqueado quando usados sozinhos.

## Revisão de tom (ajustes do CEO, 2026-11-04)

Removidos por duplo sentido, gíria ofensiva, pessoa notória ou termo pejorativo: Veadinho, Traíra, Furão, Cavalinho, Atabaque, Bandeirinha, Corneta, Tucano, Bazuca, Bala, Carvão, Cafezinho e Isqueiro (apelidos-base); Marcola, Jeca, Popó, Deco, Lulu e Xandão (formas curtas); Maluf, Mourão, Escobar, Calheiros, Barbalho e Cavaco (sobrenomes); Genivaldo (prenome). Origens: lista refeita, só composições "prefixo + palavra" claramente inventadas.
