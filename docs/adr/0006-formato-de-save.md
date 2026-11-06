# ADR-0006: Formato de save, gravação segura e migração

- **Status:** aceita (CEO, 2026-11-04)
- **Data:** 2026-11-04
- **Decisores:** architect (propôs), CEO (aprova)

## Contexto

A carreira offline vive só no aparelho (IndexedDB). O `docs/PROJETO.md` ("Saves e backup") pede salvamento automático ao fim de cada rodada, com as 3 últimas versões. Pede também gravação segura, versão do formato com conversão de saves antigos, e exportar/importar que funcione até depois de uma troca de domínio. O `CLAUDE.md` exige ADR e teste de migração para mudar o formato. Faltava decidir o que vai no save, como ele é gravado e conferido, e qual é o formato do arquivo exportado.

## Opções consideradas

| Opção                                                             | Prós                                                                     | Contras                                                                                                 |
| ----------------------------------------------------------------- | ------------------------------------------------------------------------ | ------------------------------------------------------------------------------------------------------- |
| A: snapshot do estado inteiro a cada rodada (JSON gzip + SHA-256) | simples; não depende do algoritmo do motor; abrir é ler e conferir       | 100 a 300 KB por versão; migração mexe na estrutura                                                     |
| B: semente + log de decisões, refeito pelo motor ao abrir         | arquivo minúsculo; replay "de graça"                                     | qualquer mudança no motor muda a carreira inteira de quem já joga; abrir fica lento no fim da temporada |
| C: banco relacional no IndexedDB (uma store por entidade)         | gravação parcial                                                         | atomicidade e conferência difíceis; migração muito mais trabalhosa                                      |
| Arquivo exportado: JSON puro, `.json` ou `.gz`                    | legível                                                                  | o compartilhamento de arquivos do Chrome não aceita esses tipos; JSON puro é grande                     |
| Arquivo exportado: texto `.txt` com cabeçalho + base64 do gzip    | aceito pelo compartilhamento no Android e no iPhone; pequeno; conferível | não é legível a olho nu (não precisa ser)                                                               |

## Decisão

**A**, com arquivo exportado em texto. Os detalhes estão em `docs/02-architecture.md`, item 4.2:

- `CareerSave` = envelope (`schemaVersion`, `careerId`, datas, `appVersion`, `engineVersion`, `paramsHash`) + `career` (apelido do técnico, clube, modo de partida, notícias e posts como referências a templates, memória de frases) + `game` (`GameState` do motor).
- IndexedDB `prancheta` (`prancheta-test` com `PRANCHETA_ENV=test`), stores `careers`, `snapshots`, `kv`, `errors` e, na 1b, `leagueCache`.
- Gravação: snapshot novo numa transação atômica, depois releitura e conferência do SHA-256, e só então apagam-se os snapshots além dos 3 mais novos. Ao abrir, usa-se o primeiro snapshot íntegro, do mais novo para o mais antigo.
- Migração: funções puras `vN → vN+1` em `app/src/lib/save/migrations/`, aplicadas em cadeia. O original só sai depois de a versão migrada ser gravada e conferida. Save de versão mais nova não é aberto nem alterado.
- Exportar: `<shortName>-<clube>-T<n>-R<n>.txt`. A primeira linha é `PRANCHETA-SAVE <schemaVersion>`, a segunda é o SHA-256 e o resto é o base64 do gzip. Importar: recusa acima de 5 MB antes de ler e para a descompressão acima de 40 MB. Depois confere o hash, valida com `valibot` em modo estrito, migra e confere a coerência. Se o `careerId` já existe, pergunta se substitui ou se guarda como carreira nova.
- Limite de 10 carreiras no aparelho.
- Dependência nova: `valibot`, que valida o arquivo importado no cliente e as requisições no servidor da 1b.

## Consequências

- **Positivo:** abrir é rápido e independe da versão do motor. Um ajuste de balanceamento não muda a carreira de ninguém. A ida e volta pelo arquivo é exata. Corrupção de uma versão custa no máximo uma rodada.
- **Negativo:** toda mudança em `GameState` ou no envelope exige subir `schemaVersion`, escrever a migração e a fixture. Os saves ocupam alguns MB no total, o que é aceitável.
- **Pendências:** T-018, T-019 e T-020. O arquivo leva o apelido do técnico (o jogo avisa ao exportar). Na Etapa 4, a sincronização cifra este mesmo arquivo.

## Conformidade

- Só `app/src/lib/save/` toca o IndexedDB de saves. Acesso direto em outro lugar é BLOCKER na revisão.
- O teste de forma (`fixtures/shape-vN.json`) falha se `GameState` mudar sem subir `schemaVersion`. Toda versão tem `fixtures/vN.json` e teste de migração até a atual.
- Importar nunca usa dado antes de passar pela validação estrita.

## Nota (architect, 2026-11-06): súmulas em store próprio e conferência por bytes (T-018)

Dois ajustes de mecanismo, sem mudar o formato do arquivo nem as garantias desta decisão. O detalhe está em `docs/02-architecture.md`, §4.2, e os números no §5.

1. **Store `matchSheets`.** O banco ganha um quinto store, `matchSheets` (chave `[careerId, season, round]`), porque o gatilho de 150 ms do ADR-0019 disparou na medição da T-018 (264 ms de mediana no Chromium com 4× de lentidão de CPU). O `CareerSave` continua inteiro na forma lógica e no arquivo exportado; o snapshot guarda `career.matchSheets: {}`, as súmulas vão em linhas por rodada gravadas na mesma transação do snapshot, e abrir remonta tudo. O registro do snapshot ganha `season`, `round` e o índice das linhas de súmulas que usa. A estrutura do banco continua na versão 1, porque nenhum banco existe fora dos testes.
2. **Conferência pós-gravação por bytes.** Em vez de reler, descomprimir e recalcular o SHA-256, a gravação relê o registro e compara `sha256`, `bytes` e os bytes do gzip com os que estavam em memória. O gzip em memória foi feito do JSON cujo SHA-256 está no registro, então bytes iguais provam que o gravado é o que se quis gravar, e a regra "só se apagam as versões antigas depois da conferência" continua. A conferência completa do SHA-256 continua em toda abertura. O que deixa de ser coberto na gravação é um defeito do próprio compressor da plataforma; ele fica com o teste de ida e volta do codec no Node e no E2E (Chromium e WebKit) e, se acontecer num aparelho, a abertura detecta e volta à versão anterior. Motivo: a conferência completa custava cerca de 95 ms por gravação, e sem ela a gravação não cabia no gatilho de 150 ms (p90 de 160 ms mesmo sem as súmulas).

## Nota (T-019, 2026-11-06; revisada pelo architect): formato v1 congelado, `ClubDef` congelado no save e níveis de conferência

Registro pedido pelo §4.2 da arquitetura ("Dados de referência dos clubes no save": "Registrar isso no ADR-0006 fica para o PR da T-019"). Não muda nenhuma decisão acima; o detalhe está no §4.2 e os números no §5.

1. **`ClubDef` congelado no save.** `ClubState.def` guarda o clube como estava no novo jogo (cerca de 12 KB por snapshot). Um conjunto novo de dados de clubes, identificado pela temporada base (US-066), vale só para carreira nova: nenhuma migração atualiza nomes, escudos, estádios, capacidades, títulos ou forças de saves existentes. A carreira registra o conjunto em `career.baseSeason`, que nunca muda, e a temporada 1 leva esse ano (`game.year = baseSeason + season − 1`, conferido pelo esquema). Exceção que pede ADR próprio: retirar o nome ou o escudo de um clube de saves existentes por motivo legal, como o ADR-0012 faz com os nomes de jogadores.
2. **Formato v1 congelado.** A fixture `app/src/lib/save/__fixtures__/v1.json` (uma carreira na temporada 2, com `pastSeasons`, `career.lastRound`, `career.matchSheets` e `career.baseSeason`) e a forma `__fixtures__/shape-v1.json` ficam no repositório e nunca mudam. Os caminhos da seção "Conformidade" (`fixtures/vN.json`, `fixtures/shape-vN.json`) passam a ser estes, em `__fixtures__/`, como no plano de testes e em `engine/__golden__/`. O esquema estrito `valibot` está em `app/src/lib/save/validate.ts`; mudar a forma do `CareerSave` (envelope ou `GameState`) quebra o teste de forma até subir `schemaVersion`, com migração e fixture nova.
3. **Níveis de conferência.** A validação estrita tem três níveis, pela origem do dado: `full` no arquivo importado e no save migrado (a regra "Importar nunca usa dado antes de passar pela validação estrita" continua inteira); `open` no snapshot do formato atual, sem reconferir o conteúdo das súmulas, que foi conferido inteiro ao gravar cada linha e é protegido pelo SHA-256 do índice; `write` na gravação, estrito no envelope e no que a camada de aplicação monta, e, do que o motor produz, só o que o store lê. Vale a invariante "o que a gravação aceita, a abertura aceita": a parte do motor é garantida por teste de propriedade no esquema completo, não em tempo de execução. Motivo: o esquema inteiro custa cerca de 120 ms com 4× de lentidão de CPU, quase a meta de 150 ms da gravação.

## Nota (architect, 2026-11-06): importação só com o conteúdo que o próprio jogo poderia ter gerado (T-073)

Registro da decisão 11 do CEO de 2026-11-06, "importação só com os clubes do jogo" (`docs/02-architecture.md`, §8), que responde ao achado M3 da auditoria de segurança da T-019: o esquema `full` aceitava `def` de clube, nomes de jogador e `vars` de notícias arbitrários num arquivo editado à mão ou passado entre pessoas, contra a regra de nenhum nome real e a de textos revisados antes de entrar no jogo. O SHA-256 do arquivo detecta corrupção, não edição: quem edita recalcula o hash. Não muda o formato do arquivo nem o `schemaVersion`. O desenho completo está no §4.2, "Importação do arquivo" e "Conferência de conteúdo".

1. **Regra.** A importação aceita só arquivos cujo conteúdo o próprio jogo poderia ter gerado. Todo texto que o jogo mostra a partir de um arquivo importado vem do build (clubes, listas de nomes, templates) ou é o apelido do técnico:
   - **Clubes:** `career.baseSeason` é a de um conjunto de `CLUB_SETS` deste build (senão, `unknown-base-season`); os ids de `game.clubs` são exatamente os do conjunto, e cada `def` é igual, no JSON canônico, ao `ClubDef` de mesmo id. Os conjuntos publicados são imutáveis, travados por `app/src/data/club-sets.lock.json`.
   - **Nomes de jogador:** cada `Player.name` poderia ter saído do gerador. As partes estão nas listas atuais ou em `content/names/br.legacy.json`, montadas numa das formas do gerador, e nenhuma combinação está na lista bloqueada nem em `retired.json`. O nome é conferido, nunca regerado (ver a nota de 2026-11-06 no ADR-0012).
   - **`vars` de notícias e posts:** só ids que resolvem no estado e números, pelos tipos do catálogo de placeholders da T-021.
   - **Apelido do técnico:** passa pela mesma regra do novo jogo.
2. **Recusa, não conserto.** Um arquivo que não passa é recusado inteiro com `foreign-content` (ou `unknown-base-season`), sem gravar nada. O jogo não troca a `def`, o nome nem a variável pelo valor "certo".
3. **Ordem dos passos.** Corrige a ordem escrita na Decisão ("confere o hash, valida com `valibot` em modo estrito, migra e confere a coerência"): (1) tamanho do arquivo, até 5 MB; (2) cabeçalho e base64; (3) descompressão limitada a `IMPORT_MAX_JSON_BYTES`; (4) SHA-256 e `JSON.parse`; (5) pré-passagem de chaves de protótipo e tetos de nós; (6) versão e migração em cadeia; (7) `parseCareerSave(migrado, 'full')`; (8) conferência de conteúdo; (9) gravação com `careerId` novo. Os passos 2 a 8 rodam num Web Worker. O `full` é o esquema do formato atual, por isso vem depois da migração; antes dela só entram as defesas que não dependem do formato. A regra "Importar nunca usa dado antes de passar pela validação estrita" continua: daqui em diante só se usa `parsed.value`.
4. **Invariante.** O que o jogo exporta, o jogo importa: o teste de propriedade da T-019 passa a exigir que todo save que o jogo grava passe também na conferência de conteúdo.
5. **Dono.** A T-073 (`lib/save/import/content-check.ts`, `lib/generators/name-check.ts`, `br.legacy.json` e a trava dos conjuntos) vem antes da T-020, que liga a conferência no passo 8.
6. **Exceção que continua pedindo ADR.** Mudar um clube já publicado por motivo de segurança mexe nos saves que já estão nos aparelhos (a `def` fica congelada, conforme a nota da T-019) e na conferência. O ADR dessa mudança define como a importação aceita a versão antiga.
