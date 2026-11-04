# Changelog

Formato: [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/). Versionamento semântico.

## [Não lançado]

### Adicionado

- Dia 1: site com devlog, roteiro, apoio e privacidade; versão zero do jogo em `/jogo` (tela inicial, PWA instalável); configuração central da marca; tokens do design system; motor com gerador aleatório determinístico e gerador de escudos; kit da empresa de agentes adaptado ao projeto.
- Fundações do motor (T-001) em `app/src/engine/`: tipos base (`types.ts`), resultado tipado `ok`/`fail` (`result.ts`), `ENGINE_VERSION = 1` (`version.ts`) e utilitários numéricos determinísticos (`math.ts`: clamp, exp, normal).
- Utilitário de golden (`testing/golden.ts`, `__golden__/foundations.json`) e o script `npm run golden:update -w app`, que recusa sobrescrever um golden alterado sem subir `ENGINE_VERSION`.
- `GameParams` (T-002): `app/src/engine/params.ts` com tipos somente leitura, `PARAM_RANGES`, `validateParams` (nunca lança; lista todos os `ParamIssue`) e as constantes `SEASON_WEEKS = 34` e `SEASON_ROUNDS = 38`.
- Seis JSON em `app/src/params/` (`match`, `players`, `generation`, `ai`, `season`, `fans`), com `match.homeBase = 0.05` (ADR-0011) e valores da ADR-0005 fixos; `fatigue`, `injury` e `cards` são grupos dentro de `match.json`.
- `loadGameParams()` em `app/src/lib/params.ts`: valida uma vez e devolve os parâmetros congelados.
- Teste que prende os JSON às tabelas de `docs/design/`.
- Dados dos clubes (T-003, US-001): `ClubDef` e `validateClubs` em `app/src/engine/clubs.ts` (nunca lança), com `abbreviation` de 3 letras única, `titles` (`league`, `cup`, `libertadores`, `sudamericana`) e `strength` inteiro de 55 a 85, sem relação com o porte (ausente vale 70, com aviso).
- `app/src/data/` com `clubs.serie-a.json` (20 clubes fictícios aprovados), `blocklist.sha256.json` (1.443 hashes de nomes reais; nenhum nome real em texto), `check.ts` e `blocklist.ts` (SHA-256 só no Node).
- `npm run content:check` e `npm run blocklist:hash -- <arquivo fora do repositório>` (`scripts/hash-blocklist.mjs`).
- Gerador de nomes (T-004, US-003) em `app/src/lib/generators/names.ts`: sete formas de exibição, forma curta coerente com o prenome, sem duplicata no elenco, no máximo 3 jogadores por sobrenome, `familyNoSolo`, origem "X de Y", determinístico por semente e exclusões por índice; em esgotamento das listas devolve resultado marcado `degraded`.
- Listas de nomes fictícios `app/src/content/names/br.json` (412 prenomes, 19, 407, 123, 130 e 49 itens nas demais listas) e `br.exclusions.json` (57 pares, 6 sobrenomes e 3 triplas, só índices).
- Site novo: páginas O jogo, Modos, Clubes e Perguntas, página inicial refeita, roteiro com selo de estado (`site/src/data/recursos.ts`), escudos de exemplo gerados no build, tema dia automático, menu sem JavaScript, sitemap (`@astrojs/sitemap` 3.7.4) e `robots.txt`; nenhum script, cookie ou serviço de terceiros (teste `site/src/lib/dist.test.ts`).
- Tokens `layout` e o estilo `display-lg`; `display-xl` e `botao` passam a ser estilos de verdade em `design/tokens.json`.
- `contacts.discussionsUrl` e `contacts.repository` em `config/prancheta.config.ts`.
- `app/src/data/athletes-blocklist.sha256.json` (469 hashes de nomes de atletas reais; nenhum nome em texto).
- `npm run names:exclusions` (`scripts/name-exclusions.mjs`) e `npm run blocklist:hash:athletes`.
- Teste completo dos nomes com `NAMES_FULL_CHECK=1 npm test -w app` (cerca de 2 minutos), para rodar antes de release e quando as listas mudarem.
- ADR-0012 aceito: nome e rosto resolvidos na criação ficam no estado e no save; nome retirado também sai dos saves antigos.
- Modelo do jogador (T-005, US-004) em `app/src/engine/players.ts`: tipos `Player`, `PlayerNameText`, `PlayerIdentity` e `IdentitySource` (ADR-0012); `computeOverall`, `fit`/`fitLevel`, `drawTrait`, `drawPotential`, `drawGrowthCurve`, `isProspect` (rótulo "promessa"), `fitAttributesToOverall`, `attributeOf` e `validatePlayer` (nunca lança); constantes `SQUAD_COMPOSITION`, `POTENTIAL_MAX` e limites dos campos.
- Fontes de teste do motor `testing/identity.ts` e `testing/players.ts` e golden `__golden__/players.json` (`ENGINE_VERSION` continua 1).
- Desenho e textos aprovados do site novo (`docs/design/site.md`, `docs/content/site/`); a implementação vem em PR próprio.
- Geração dos elencos e novo jogo (T-006, US-004): `newGame` e `generateSquad` em `app/src/engine/`, com formações, números de camisa realistas, joia e ídolo por clube; nome e rosto vêm da `IdentitySource` recebida por argumento (ADR-0012).
- `app/src/lib/generators/identity.ts`: fonte de identidade do jogo, com rosto placeholder até a T-027.
- ADR-0013 aceito: liga online da 1b com até 20 humanos, um por clube; liga online com Séries A e B antecipada para a Etapa 2.
- Calendário da Série A (T-007, US-006) em `app/src/engine/fixtures.ts`: 380 jogos, Berger com `BERGER_START = 3`, returno espelhado, mando com no máximo 2 seguidos, 1ª rodada no domingo depois do 2º sábado de abril, 8 rodadas de quarta, sem Data FIFA e última rodada entre 26/11 e 02/12.
- `newGame` devolve `fixtures` e o erro `'invalid-calendar'` (ano fora do intervalo ou calendário que não cabe); `Rng.shuffle` determinístico.
- Nomes, revisão 2: listas revisadas pelo CEO, origens curtas e exclusões regeneradas.
- Descrições curtas para compartilhar as páginas do site, aprovadas (clubes: "Clubes com trocadilho").
- Propostas de três direções visuais do site (escolhida a A "Noite de estádio") e de três estilos de escudo (aguardando escolha).

### Alterado

- `ENGINE_VERSION` passa a 2 (calendário no estado inicial).
- Nome de exibição do jogador limitado a 22 caracteres: sorteia-se de novo a forma e, se preciso, o jogador.
- ADR-0013 revisado: liga online ao vivo até 8 humanos e assíncrona até 20 por divisão; o site usa esses números.
- Lint impede `lib/` e `ui/` de importar arquivos só do Node e os hashes de bloqueio.
- Metas de placar do balanceamento: 0×0 de 6% a 9%, goleada de 8% a 13%, diferença de 5 ou mais gols de 0,5% a 2%.
- Regra de nomes reais: documentos de trabalho em `docs/` podem citá-los só como referência; no jogo, código, dados e site a regra continua absoluta.

- Lint de fronteira do motor ampliado: sem `ui`, `lib`, `content`, `params`, `data`, DOM, `Intl`, `process` nem `node:*`; sem `Math.random`, `Date.now`, `localeCompare` e `toLocale*`; imports relativos com extensão `.ts`; código de produção não importa `testing/`. Fora do motor: `ui` não importa `lib/save` e `lib` não importa `ui`.
- `erasableSyntaxOnly` ligado em `app/tsconfig.json`.
- `attributes` do jogador é parcial (6 chaves por posição) e `potential` é guardado até 99; o teto 95 vale só na geração (`docs/02-architecture.md` §4.1).
- `engines.node` passa a exigir `>= 22.18`.
- O tamanho do elenco (25) deixou de ser parâmetro e virou constante.
- O escudo gerado passa a mostrar a sigla do clube (`abbreviation`) no símbolo de letra; `shieldSpecFor` ganhou o 4º argumento opcional.
- Porte (grandes, médios, pequenos) separado da força: o porte vem de títulos, história e torcida; a força, da tabela do Brasileirão 2026 parcial (33ª rodada), numa escada única de 20 degraus.

### Corrigido

- Site: espaços em volta de elementos inline ("eLiga", "oroteiro"), com teste geral em `site/src/lib/dist.test.ts`.
- Site: tamanho da liga passa a "Até 20 (um técnico por clube da Série A)"; removida frase desatualizada sobre números ajustáveis.
