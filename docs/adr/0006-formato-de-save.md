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
