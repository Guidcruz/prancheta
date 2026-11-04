# Arquitetura

> Escrita pelo `architect` no `/kickoff` da Etapa 1 (2026-11-04). Toda decisão relevante tem um ADR em `docs/adr/`. Mudar este documento exige um ADR novo. O desenho geral já está em `docs/PROJETO.md` ("Arquitetura e tecnologia", "Hospedagem e portabilidade", "Modo online", "Saves e backup", "Privacidade"); aqui entra o detalhe da Etapa 1. As regras de jogo e os números estão em `docs/design/` (partida, jogadores, ia-clubes, temporada, torcida, balance-targets) e não são repetidos aqui.
>
> ADRs desta etapa (todos **propostos**, aguardando o CEO): 0006 save, 0007 motor, 0008 contas, 0009 protocolo da liga, 0010 topologia do servidor, 0011 fator casa.

## 1. Visão geral

O coração do jogo é o **motor** (`app/src/engine/`): TypeScript puro, sem DOM, sem relógio e sem `Math.random`, que recebe um estado (`GameState`), os parâmetros numéricos (`GameParams`, vindos de `app/src/params/*.json`) e as decisões dos técnicos, e devolve um estado novo mais um relatório (eventos das partidas e fatos da rodada). Toda função pública do motor é pura: a mesma entrada dá sempre a mesma saída, em qualquer ordem de chamada. A **interface** (Svelte, `app/src/ui/`) nunca calcula regra de jogo: ela monta a entrada, chama o motor por meio da camada de aplicação (`app/src/lib/career/`), mostra o resultado e pede o salvamento (`app/src/lib/save/`). Textos nunca saem do motor: o motor emite **fatos** tipados (`Fact`, marcadores do resultado) e a camada de conteúdo (`app/src/lib/content/`) transforma fatos em notícias, posts e falas a partir dos templates de `app/src/content/<idioma>/`, com `Rng` semeado, então o mesmo save produz as mesmas notícias. Na **liga online (1b)**, o mesmo motor roda no servidor (Hono em Cloudflare; ADR-0010); o cliente nunca simula nem envia resultados, só escalação e tática.

**Rodada na carreira (offline).** (1) A interface pede `prepareRound` e recebe as partidas da rodada com as escalações da IA e a sugestão para o clube do técnico. (2) O técnico ajusta escalação e tática e toca "Jogar rodada". (3) No modo "só resultado", a camada de aplicação chama `playRound` direto. Nos modos animados, a tela chama `simulateMatch` para a partida do técnico e a reexecuta inteira cada vez que ele dá um comando (é barato: cerca de 0,1 ms por partida), mostrando os eventos a partir do minuto atual. No fim, `playRound` recebe a lista de comandos e simula as 10 partidas de novo, chegando ao mesmo placar que o técnico viu. (4) `playRound` devolve o estado novo e o `RoundReport`. A camada de conteúdo gera notícias e posts a partir do relatório. (5) Tudo isso vira um snapshot novo, gravado numa única transação do IndexedDB com conferência de integridade (ADR-0006). Se o app fechar antes da gravação, a carreira continua na rodada anterior. Se fechar depois, está na seguinte. Nunca fica no meio.

**Rodada na liga online (1b).** (1) A rodada abre com um prazo (ao vivo: 1, 2 ou 5 min; assíncrono: 12, 24 ou 48 h, se a P12 for aprovada). (2) Cada humano envia escalação e tática (`PUT .../lineup`). O servidor valida com `validateLineup` e marca o jogador como pronto. (3) Quando todos os humanos ativos estão prontos, ou quando o alarme do prazo dispara, a sala da liga (Durable Object) roda `playRound` uma única vez. Quem não confirmou joga com a última escalação confirmada, corrigida pela IA, ou com a escalação da IA. (4) O estado novo, os resultados e os fatos são gravados no D1 numa transação idempotente por `(liga, temporada, rodada)`. (5) No ao vivo, a sala transmite pelo WebSocket a linha do tempo completa com um horário de início comum, e cada cliente mostra o mesmo minuto. No assíncrono, o cliente busca os resumos quando abre o app. As notícias são geradas no cliente a partir dos fatos (ADR-0009).

## 2. Stack

| Camada        | Escolha                                                                            | Por quê                                                     | ADR            |
| ------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------- | -------------- |
| Jogo          | Svelte 5 + Vite 8, PWA (`vite-plugin-pwa` 2)                                       | app leve                                                    | ADR-0001       |
| Site          | Astro 7                                                                            | Markdown vira página                                        | ADR-0001       |
| Motor         | TypeScript puro, determinístico, só sintaxe apagável, imports relativos            | roda igual no celular, no Node (balance) e no servidor      | ADR-0001, 0007 |
| Saves         | IndexedDB (`idb`), snapshot gzip + SHA-256, 3 versões                              | carreira sem servidor e sem corromper                       | ADR-0006       |
| Validação     | `valibot` (cliente e servidor)                                                     | validar save importado e requisições; pequeno e tree-shaken | ADR-0006       |
| Servidor (1b) | Hono em Pages Functions (`/api`) + Worker de salas (Durable Objects)               | mesma origem, custo zero, portável                          | ADR-0002, 0010 |
| Banco (1b)    | D1 (SQLite) atrás de uma interface `Db`; `node:sqlite` nos testes                  | SQL padrão, troca simples para VPS                          | ADR-0002, 0009 |
| Contas (1b)   | WebAuthn com `@simplewebauthn/server` e `/browser`; código de recuperação          | sem e-mail nem senha; biblioteca madura                     | ADR-0008       |
| Testes        | Vitest 5 (unitário, motor, golden, servidor); Playwright na 1a (Chromium e WebKit) | WebKit cobre o iPhone                                       | ADR-0001, 0007 |
| CI/CD         | GitHub Actions + Cloudflare Pages; deploy do Worker de salas com aprovação do CEO  | produção só pelo CEO                                        | ADR-0002, 0010 |

## 3. Componentes

```
app/src/engine/      motor (puro)            ← recebe GameParams e ClubDef[] por argumento
app/src/params/      GameParams em JSON      → lidos por lib/params.ts, scripts/balance.ts e server/
app/src/data/        dados de jogo (clubes da Série A, lista bloqueada em hash)  [novo]
app/src/lib/
  params.ts          carrega e valida os JSON de params (validateParams do motor)
  career/            camada de aplicação da carreira: motor + conteúdo + save (a UI só fala com ela)
  save/              IndexedDB, snapshots, migrações, exportar/importar
  content/           templates → texto (notícias, rede social, entrevista, intervalo, mensagens prontas)
  i18n.ts            textos de interface (existe)
  generators/        escudo (existe), uniforme, nomes, avatar (SVG por código, fora do motor)
  errors/            registro local de erros sem dados pessoais
  online/            cliente da API e do WebSocket (1b)
app/src/ui/          telas Svelte; canvas da partida
server/              (1b) Hono, Db, salas, contas; importa só engine/ e params/
functions/api/       (1b) adaptador fino das Pages Functions → server/
scripts/             balance.ts, content-check.mjs, template-repeat.ts, check-precache.mjs, hash-blocklist.mjs
```

### Motor (`app/src/engine/`)

- **Responsabilidade:** gerar elencos e calendário, calcular força, simular partidas, aplicar a rodada (tabela, cartões, lesões, moral, fadiga, termômetro), IA de escalação e tática, fim e virada de temporada. Emite eventos e fatos, nunca texto.
- **Possui:** os tipos `GameState`, `Player`, `ClubState`, `Lineup`, `MatchInput`, `MatchEvent`, `RoundReport`, `Fact`, `GameParams` (com as faixas válidas), o `Rng`, `ENGINE_VERSION` e as constantes de regra (tabelas de formação, `fit` etc.).
- **Não depende de:** DOM, `lib/`, `ui/`, `content/`, `params/` (recebe por argumento), `data/`, `@config`, `node:*`, `Date`, `Intl`, `Math.random`.
- **Arquivos previstos:** `types.ts`, `version.ts`, `math.ts` (clamp, normal aproximada, `exp` encapsulado), `params.ts` (tipo + validador), `players.ts`, `generation.ts`, `fixtures.ts`, `strength.ts`, `match/` (simulação, eventos, IA em jogo), `ai.ts`, `round.ts`, `standings.ts`, `fans.ts`, `season.ts`, `index.ts` (API pública), `__golden__/`.

### Parâmetros (`app/src/params/`)

- Um JSON por sistema: `match.json`, `players.json`, `generation.json`, `season.json`, `ai.json`, `fans.json`. Os nomes são os de `docs/design/*.md`, com prefixo pelo arquivo (`match.baseChance` → `match.json` › `baseChance`).
- O motor exporta `validateParams(raw: unknown): Result<GameParams, 'invalid-params'>` (a lista de `ParamIssue[]` vai em `detail`, seção 4.1; nunca lança) com as faixas válidas dos documentos de sistema. Um teste carrega os JSON do repositório e exige `ok`, então um `/quick` que ponha um valor fora da faixa quebra o CI.
- Entram no motor como argumento em toda chamada pública. Quem carrega: `app/src/lib/params.ts` (jogo, empacotado no build), `scripts/balance.ts` (lê do disco ou de `--params <arquivo>`) e `server/` (importa os mesmos JSON no build).
- `paramsHash` (SHA-256 do JSON canônico) fica registrado no save e na liga, só para diagnóstico.

### Dados de jogo (`app/src/data/`, pasta nova)

- `clubs.serie-a.json`: os 20 `ClubDef` (US-001), aprovados pelo CEO. Até a lista chegar, os testes do motor usam clubes sintéticos gerados no próprio teste (`Clube Teste 01`...).
- `blocklist.sha256.json`: hashes SHA-256 dos nomes reais normalizados (minúsculas, sem acento, espaços colapsados) de clubes, estádios e apelidos, mantidos pelo `content-writer` com `scripts/hash-blocklist.mjs`. Assim a validação bloqueia nome real sem que o repositório contenha nome real em texto (regra do `CLAUDE.md`).
- A validação (20 clubes, ids e siglas únicos, campos, `titles`, `strength` inteiro de 55 a 85, rivalidade simétrica, escudo gerado sem erro, nenhum hash bloqueado) roda como teste Vitest e em `npm run content:check`.
- `check.ts` e `blocklist.ts` fazem o SHA-256 só no Node (nunca no motor nem no navegador).
- `npm run blocklist:hash -- <arquivo>` (`scripts/hash-blocklist.mjs`) gera os hashes a partir de uma lista de nomes reais que fica **fora do repositório**; o arquivo de nomes nunca é commitado.
- `npm run blocklist:hash:athletes` faz o mesmo e grava em `athletes-blocklist.sha256.json` (nomes de atletas reais, usado pelo teste dos nomes).
- `npm run names:exclusions` (`scripts/name-exclusions.mjs`) recalcula `app/src/content/names/br.exclusions.json` (pares, sobrenomes e triplas, só por índice). `NAMES_FULL_CHECK=1 npm test -w app` roda a verificação completa dos nomes (cerca de 2 minutos): antes de release e quando as listas mudarem.

### Gerador de escudos (`app/src/lib/generators/shield.ts`)

- Estilo A v5 (`docs/art/escudos-estilos/README.md`; ADR-0014). Função pura e determinística, fora do motor: `shieldSpecFor(club, { label? })` monta o `ShieldSpec` a partir do clube e `shieldSvg(spec, size = 64, { instance? })` devolve o SVG.
- Nada é sorteado: silhueta (`crestShape`), padrão (`crestPattern`), cor de base (`crestBase`) e símbolo (`crestSymbol`) são dados fixos do `ClubDef`. As estrelas vêm de `titles.league` (douradas, Série A) e `titles.leagueB` (prateadas, Série B; campo opcional, ainda ausente nos dados).
- O SVG é autocontido (sem variáveis CSS nem filtros), então serve no navegador, no Astro em build e no librsvg (`scripts/og.mjs`). Até 32px (`SMALL_SIZE`) sai a versão simples. Os ids internos derivam do id do clube; `instance` evita colisão com o mesmo clube duas vezes na página. Valores fora das listas caem em padrões seguros (`rounded`, `none`, `sol`); o aviso fica por conta de `validateClubs` (`invalid-crest`).
- Sem `label`, o SVG é decorativo (`aria-hidden`); com `label`, usa `shortName` como nome acessível, sempre escapado.

### Interface (`app/src/ui/`)

- Telas e componentes Svelte 5 segundo `docs/design/telas/` (ux-designer). Roteamento por estado simples (sem biblioteca de rotas), com abas embaixo no celular e barra lateral a partir de 900 px.
- Fala só com `lib/career` (carreira), `lib/online` (1b), `lib/i18n` e `lib/content`. Nunca importa `engine/` para calcular regra, só para usar tipos e funções de leitura (`getStandings`, `teamStrength`).
- Partida animada em `ui/match/`: canvas 2D desenhado a partir dos `MatchEvent`. As posições das bolinhas são decorativas e geradas a partir dos eventos. A animação nunca muda o resultado. `prefers-reduced-motion` desliga câmera lenta, tremor e comemoração.
- Erros inesperados caem numa fronteira de erro por tela ("Tentar de novo" / "Voltar ao início"), que registra em `lib/errors` e não toca no save.

### Carreira, camada de aplicação (`app/src/lib/career/`)

- `CareerService`: `create(setup)`, `open(careerId)`, `prepareRound()`, `playRound(input)`, `endSeason()`, `startNextSeason()`, `answerInterview()`. Orquestra motor, conteúdo e save; é a única que grava.
- Mantém em memória o `CareerSave` aberto e expõe um store Svelte de leitura para a UI.

### Saves (`app/src/lib/save/`)

- Detalhe no item 4.2 e no ADR-0006. Responsável por IndexedDB, snapshots, conferência, migrações, exportar/importar, persistência (`navigator.storage.persist`) e limite de carreiras.

### Conteúdo e i18n (`app/src/content/`, `app/src/lib/content/`, `app/src/lib/i18n.ts`)

- `content/<idioma>/ui.json` (existe), `news.json`, `social.json`, `interview.json`, `halftime.json`, `fans.json` (rótulos de humor), `changelog.json` e, na 1b, `messages.json` (mensagens prontas) e `errors.json` (códigos do servidor → texto).
- Template: `{ id, event, context?: string[], variants: [{ id, text }] }`, com placeholders do catálogo `lib/content/placeholders.ts`. As opções da entrevista trazem `fanEffect` entre −2 e +2 (validado).
- **Escolha determinística:** `Rng(seedFromString(`${seed}-r${round}-news-${factId}`))`. A memória de frases (últimas 200, por id de variante) fica no save.
- **Itens guardados como referência:** a notícia gravada no save é `{ factId, templateId, variantId, vars }`, e o texto é montado na hora de mostrar. Assim, trocar o idioma não reinicia a carreira. Se o idioma tem menos variantes, usa `variantId mod n`.
- **Carregamento:** os idiomas que não são o atual entram por `import()` dinâmico. Continuam no precache, então o jogo inteiro funciona offline.
- **Proibido texto no código:** uma regra local de ESLint (`app/eslint-rules/no-raw-text.js`) acusa nó de texto com letras em `.svelte`. `scripts/content-check.mjs` confere as chaves iguais nos três idiomas, os placeholders conhecidos, as faixas de `fanEffect` e a lista bloqueada.

### Servidor (`server/`, Etapa 1b)

- **Hono** com rotas em `server/src/routes/`. A aplicação (`server/src/app.ts`) não conhece Cloudflare: recebe `Db`, `RoomCoordinator`, `Clock` e `Secrets` por injeção.
- **`Db`** (`server/src/db/`): interface com SQL padrão. Implementação `D1Db` em produção e `SqliteDb` (`node:sqlite`) nos testes e numa futura VPS. Nenhum SQL fora de `server/src/db/`.
- **`RoomCoordinator`** (`server/src/rooms/`): interface da sala da liga (prontos, prazo, processamento único, transmissão). Implementação `LeagueRoomDO` (Durable Object com alarme e WebSocket com hibernação) e `InMemoryRoom` para testes e VPS.
- **Auth** (`server/src/auth/`): WebAuthn, sessões, código de recuperação, reautenticação (ADR-0008).
- **Filtro** (`server/src/filter/`): apelido e nome de liga (palavrões, links, e-mails, telefones, hashes de nomes de pessoas públicas).
- **Motor:** importa `app/src/engine/` e `app/src/params/` por caminho relativo. Não importa `lib/`, `ui/` nem `content/`. As notícias são geradas no cliente.
- **Topologia** (ADR-0010): Pages Functions em `/api/*` (mesma origem do jogo: sem CORS, cookie primário, mesmo `rpId` da passkey) e um Worker separado `prancheta-rooms` que exporta a classe do Durable Object, ligado às Functions por `script_name`.

## 4. Contratos

### 4.1 API pública do motor (`app/src/engine/index.ts`)

Todas as funções são puras. Não mudam a entrada (devolvem cópias) e não lançam erro por situação de jogo. Erro de programação (tipo impossível) pode lançar e é bug.

```ts
// Resultado tipado (o motor nunca lança por situação de jogo)
export type Result<T, E extends string> =
  { ok: true; value: T; warnings: EngineWarning[] } | { ok: false; error: E; detail?: unknown };

export type ClubId = string; // slug estável do ClubDef, ex.: "tricolor-cerrado"
export type PlayerId = string; // estável na carreira: `${clubId}#${n}`
export type FixtureId = string; // `s${season}-r${round}-${homeId}-${awayId}`
export type Position = 'GK' | 'CB' | 'FB' | 'DM' | 'AM' | 'ST';
export type Formation = '4-4-2' | '4-3-3' | '4-2-3-1' | '3-5-2' | '3-4-3' | '5-3-2';
export type Posture = 'defensive' | 'balanced' | 'attacking' | 'allOut'; // allOut só por comando
export type Pressure = 'low' | 'medium' | 'high';
export type Trait = 'leader' | 'hothead' | 'professional' | 'idol' | 'quiet';
export type ClubSize = 'big' | 'medium' | 'small';
export type AiProfile = 'ambitious' | 'academy' | 'seller' | 'traditional' | 'chaotic';
export type Side = 'home' | 'away';

export interface ClubDef {
  // de app/src/data/, aprovado pelo CEO
  id: ClubId;
  name: string;
  shortName: string;
  abbreviation: string; // 3 letras, única entre os clubes; vai no escudo
  nickname: string;
  city: string;
  state: string;
  colors: [string, string];
  size: ClubSize; // porte: títulos, história e torcida (quem o clube é)
  aiProfile?: AiProfile;
  strength?: number; // inteiro 55..85, sem relação com o porte; ausente = 70, com aviso
  titles: { league: number; cup: number; libertadores: number; sudamericana: number };
  stadium: { name: string; capacity: number };
  rivals: ClubId[];
  // escudo (ADR-0014): dados fixos de cada clube, nunca sorteados; listas fechadas em clubs.ts
  crestShape: CrestShape; // 'rounded' | 'french' | 'swiss' | 'oval' | 'chamfer' | 'disc'
  crestPattern: CrestPattern; // 'hoops' | 'vstripes' | 'pales' | 'split' | 'bend' | 'bendMirror' | 'fess' | 'chief' | 'chevron' | 'none'
  crestBase: 0 | 1; // qual das duas cores é a base do campo (0 = primária, 1 = secundária)
  crestSymbol: CrestSymbol; // um dos 20 símbolos da cidade (CREST_SYMBOLS)
}

// validateClubs(raw): valida os clubes, nunca lança. Cada campo de escudo ausente ou fora da lista
// gera o problema 'invalid-crest' (com o campo e o valor); a lista inteira dos problemas é devolvida.
// Escudo: shieldSpecFor(club, { label? }) em app/src/lib/generators/shield.ts (ver "Gerador de escudos").

export interface Player {
  id: PlayerId;
  clubId: ClubId;
  nameSeed: number; // só para gerar (e regerar em renameRetired); nunca para exibir (ADR-0012)
  faceSeed: number; // idem
  name: PlayerNameText; // resolvido na criação pela IdentitySource e guardado
  face: string; // FaceSpec codificada (T-027), opaca para o motor, ≤ 32 caracteres
  nationality: string; // ISO 3166-1 alfa-2; nome e rosto são gerados fora do motor
  position: Position;
  attributes: PlayerAttributes; // parcial: só as 6 chaves da posição (não um Record de todas), 1..99
  overall: number;
  potential: number; // guardado até 99; o teto 95 vale só na geração (POTENTIAL_MAX)
  age: number;
  peakAge: number;
  growth: number;
  trait: Trait;
  shirt: number;
  condition: number;
  morale: number; // 0..100
  injuryRounds: number;
  suspendedGames: number;
  yellowCount: number;
  recentRatings: number[]; // últimos 5 (forma, só exibição)
  benchStreak: number;
  clubAppearances: number;
}

export interface Lineup {
  formation: Formation;
  starters: PlayerId[]; // 11, na ordem das vagas da formação
  bench: PlayerId[]; // até match.benchSize (7)
  captains: PlayerId[];
  penaltyTakers: PlayerId[];
  freeKickTakers: PlayerId[]; // listas ordenadas
}
export interface Tactic {
  posture: Exclude<Posture, 'allOut'>;
  pressure: Pressure;
}
export interface TeamSheet {
  lineup: Lineup;
  tactic: Tactic;
}

export interface ClubState {
  def: ClubDef;
  profile: AiProfile;
  strength: number; // força-alvo efetiva desta carreira
  preferredFormations: [Formation, Formation];
  fans: number; // termômetro 0..100
  idolBenchStreak: number;
}

export interface Fixture {
  id: FixtureId;
  round: number;
  date: string; // "AAAA-MM-DD", calculada do ano passado em newGame
  homeId: ClubId;
  awayId: ClubId;
  result?: MatchSummary;
}

export interface PlayerNameText {
  display: string; // nome exibido
  full: string; // "Nome Sobrenome" ou "Nome Sobrenome Sobrenome2"
  family: string; // primeiro sobrenome (regra de no máximo 3 por sobrenome no elenco)
}

export interface PlayerIdentity extends PlayerNameText {
  nameSeed: number;
  faceSeed: number;
  face: string;
}

// Fonte de identidade (ADR-0012): função pura recebida por argumento, implementada fora do motor
// em lib/generators/identity.ts; nos testes do motor, uma fonte fixa do próprio motor.
export interface IdentitySource {
  retiredRev: number; // revisão de content/names/retired.json; vai para GameState.retiredNamesRev
  squad(req: {
    seed: number;
    nationality: string;
    count: number;
    existing: readonly PlayerNameText[]; // elenco atual, para as regras de nome repetido e sobrenome
  }): PlayerIdentity[];
}

export interface GameState {
  engineVersion: number; // ENGINE_VERSION que gravou por último (diagnóstico)
  retiredNamesRev: number; // revisão de nomes retirados já aplicada (ADR-0012); o motor só copia
  seed: number; // semente da carreira ou da liga
  year: number;
  season: number; // season começa em 1
  round: number; // próxima rodada a jogar (1..38); 39 = temporada terminada
  phase: 'season' | 'seasonEnd';
  rules: { realism: 'full' | 'simplified' };
  clubs: Record<ClubId, ClubState>;
  players: Record<PlayerId, Player>;
  squads: Record<ClubId, PlayerId[]>;
  fixtures: Fixture[]; // 380 da temporada atual
  lastSheets: Record<ClubId, TeamSheet>; // última escalação usada/confirmada
  seasonStats: Record<PlayerId, PlayerSeasonStats>;
  lastRound?: RoundReport; // eventos completos só da última rodada
  pastSeasons: SeasonSummary[]; // campeão, rebaixados, prêmios (enxuto)
}

// Partida
export interface TeamInput {
  clubId: ClubId;
  sheet: TeamSheet;
  controller: 'ai' | 'human';
  profile: AiProfile;
  fans: number;
  players: Player[]; // elenco do clube no apito inicial
}
export interface MatchInput {
  fixtureId: FixtureId;
  seed: number; // seedFromString(`${state.seed}-s${season}-r${round}-${homeId}-${awayId}`)
  home: TeamInput;
  away: TeamInput;
  derby: boolean;
  neutral: boolean; // neutral só no /balance (duelos)
  rules: GameState['rules'];
}
export type MatchCommand =
  // valem a partir do minuto seguinte, salvo troca por lesão
  | { minute: number; side: Side; kind: 'substitution'; out: PlayerId; in: PlayerId }
  | {
      minute: number;
      side: Side;
      kind: 'tactic';
      formation?: Formation;
      posture?: Posture;
      pressure?: Pressure;
    }
  | { minute: number; side: Side; kind: 'preset'; preset: 'press' | 'holdResult' | 'allOut' }
  | { minute: 45; side: Side; kind: 'halftimeTalk'; talk: 'motivate' | 'demand' | 'calm' };

export type MatchEvent = { minute: number; added?: number; half: 1 | 2; importance: 1 | 2 | 3 } & (
  | { type: 'kickoff' }
  | {
      type: 'chance';
      side: Side;
      shooter: PlayerId;
      kind: 'open' | 'freeKick' | 'penalty';
      outcome: 'saved' | 'post' | 'wide';
      pGoal: number;
    }
  | {
      type: 'goal';
      side: Side;
      scorer: PlayerId;
      assist?: PlayerId;
      kind: 'open' | 'freeKick' | 'penalty';
      score: [number, number];
    }
  | { type: 'penaltyAwarded'; side: Side; taker: PlayerId }
  | { type: 'penaltyMissed'; side: Side; taker: PlayerId; outcome: 'saved' | 'post' | 'wide' }
  | { type: 'yellow'; side: Side; player: PlayerId; triggersSuspension: boolean }
  | { type: 'red'; side: Side; player: PlayerId; reason: 'direct' | 'secondYellow' }
  | {
      type: 'injury';
      side: Side;
      player: PlayerId;
      severity: 'light' | 'medium' | 'serious' | 'severe';
    }
  | {
      type: 'substitution';
      side: Side;
      out: PlayerId;
      in: PlayerId;
      reason: 'tactical' | 'fatigue' | 'injury';
    }
  | {
      type: 'tacticChange';
      side: Side;
      formation: Formation;
      posture: Posture;
      pressure: Pressure;
      preset?: string;
    }
  | { type: 'stoppage'; minutes: number }
  | { type: 'halftime'; score: [number, number] }
  | { type: 'halftimeTalk'; side: Side; talk: 'motivate' | 'demand' | 'calm' }
  | { type: 'fulltime'; score: [number, number]; abandoned: boolean }
);

export interface MatchResult {
  fixtureId: FixtureId;
  score: [number, number];
  events: MatchEvent[];
  stats: Record<
    Side,
    { shots: number; onTarget: number; possession: number; yellows: number; reds: number }
  >;
  ratings: Record<PlayerId, number | null>;
  motm?: PlayerId;
  minutes: Record<PlayerId, number>;
  finalEnergy: Record<PlayerId, number>;
  newInjuries: { player: PlayerId; rounds: number }[];
  markers: MatchMarker[]; // goleada, virada, zebra, golNoFim, hatTrick, semSofrerGols, classico, estreia
  attendance: number;
  warnings: EngineWarning[];
}

// Rodada
export interface RoundInput {
  round: number; // rodada esperada (idempotência)
  sheets: Partial<Record<ClubId, TeamSheet>>; // clubes humanos; os ausentes ficam com a IA
  commands: Partial<Record<FixtureId, MatchCommand[]>>; // só na carreira (P6)
  fanDecisions: Partial<Record<ClubId, number>>; // soma das decisões do técnico (limitada por fans.decisionCap)
}
export interface RoundPlan {
  round: number;
  matches: MatchInput[];
  suggested: Record<ClubId, TeamSheet>;
}
export interface RoundReport {
  season: number;
  round: number;
  results: MatchResult[];
  facts: Fact[];
}
export type Fact =
  // fatos da tabela e da rodada, para o conteúdo
  | { kind: 'leadership'; clubId: ClubId; change: 'took' | 'lost' | 'kept'; rounds: number }
  | { kind: 'enteredZ4' | 'leftZ4'; clubId: ClubId }
  | { kind: 'unbeaten' | 'winless'; clubId: ClubId; games: number }
  | { kind: 'championClinched' | 'relegatedClinched'; clubId: ClubId }
  | { kind: 'topScorerOfRound'; playerId: PlayerId; goals: number }
  | { kind: 'decisiveLastRound'; stakes: 'title' | 'relegation' }
  | { kind: 'suspended' | 'injured'; playerId: PlayerId; games: number };

export const ENGINE_VERSION: number;
export function validateParams(raw: unknown): Result<GameParams, 'invalid-params'>;
export function newGame(
  setup: { seed: number; year: number; realism: 'full' | 'simplified' },
  clubs: readonly ClubDef[],
  params: GameParams,
  identities: IdentitySource,
): Result<GameState, 'invalid-clubs' | 'invalid-calendar'>;
export function prepareRound(
  state: GameState,
  params: GameParams,
  sheets?: RoundInput['sheets'],
): Result<RoundPlan, 'season-over'>;
export function simulateMatch(
  input: MatchInput,
  params: GameParams,
  commands?: readonly MatchCommand[],
): MatchResult;
export function playRound(
  state: GameState,
  params: GameParams,
  input: RoundInput,
): Result<
  { state: GameState; report: RoundReport },
  'round-already-played' | 'round-not-open' | 'season-over'
>;
export function validateLineup(
  state: GameState,
  clubId: ClubId,
  sheet: TeamSheet,
): Result<TeamSheet, 'wrong-club' | 'unavailable' | 'duplicate' | 'wrong-count' | 'no-formation'>;
export function suggestSheet(
  state: GameState,
  params: GameParams,
  clubId: ClubId,
  opponentId?: ClubId,
): TeamSheet;
export function teamStrength(state: GameState, clubId: ClubId, lineup?: Lineup): number | undefined; // força exibida; undefined = clube desconhecido, escalação inválida ou menos de 11 aptos
export function getStandings(state: GameState): StandingRow[]; // derivada das partidas
export function endSeason(
  state: GameState,
  params: GameParams,
): Result<{ state: GameState; summary: SeasonSummary }, 'season-not-finished'>;
export function startNextSeason(
  state: GameState,
  params: GameParams,
  identities: IdentitySource,
  opts?: { incoming?: readonly ClubDef[] },
): Result<GameState, 'season-not-ended' | 'invalid-clubs' | 'invalid-calendar'>;
```

Notas do contrato:

- **Calendário (T-007):** `newGame` devolve `GameState.fixtures` com os 380 jogos (Berger com `BERGER_START = 3`, returno espelhado, mando com no máximo 2 seguidos; 1ª rodada no domingo depois do 2º sábado de abril, 8 quartas, sem Data FIFA, última rodada entre 26/11 e 02/12). `'invalid-calendar'` indica ano fora do intervalo aceito ou calendário que não cabe na janela; o `detail` traz o motivo. `startNextSeason` devolve o mesmo erro (previsto; ainda não implementado). `Rng.shuffle` embaralha de forma determinística. `ENGINE_VERSION` é 2 neste ponto.
- **Força (T-008):** `app/src/engine/strength.ts` calcula a força antes e durante a partida, só com aritmética sobre o estado (sem `Rng`); a forma do dia (`dayForm`) entra por cima na T-009. API pública nova em `app/src/engine/index.ts`:
  - funções: `effectiveRating` (`eff = overall × fit(natural, vaga) × moraleMult × condMult`, com a energia em campo; antes do apito, a condição), `moraleMultiplier`, `conditionMultiplier`, `homeAdvantage` (`match.homeBase` + faixa do termômetro do mandante entre `fans.homeBonusMin` e `fans.homeBonusMax` + `fans.derbyBonus` no clássico; o visitante, e os dois em campo neutro, recebem 0 por escolha de quem chama), `teamFactor` (`T(t)`, com `missing` limitado a 0..11 e `halftimeBoost` a −1 ou mais), `strengthsFromRatings` (forças de setor a partir das 11 notas na ordem das vagas, para o laço da partida), `sectorStrengths` (forças de setor de uma escalação, US-007), `fillEmptyGoal` e `teamStrength`;
  - tabelas e constantes (regras de `partida.md`, "Constantes", não botões do `/balance`): `FORMATION_SECTORS`, `FORMATION_MULTIPLIERS`, `POSTURE_EFFECTS`, `PRESSURE_EFFECTS`, `MORALE_MULT`, `CONDITION_MULT`, `EMPTY_SECTOR_FIT`, `STARTERS_COUNT`, `GOALKEEPER_SLOT`;
  - tipos: `StrengthContext`, `TeamStrengths`, `StrengthsResult`, `LineupProblem`, `Sector`, `StrengthFactors`, `RatingFactors`, `StrengthTactic`, `StrengthSheet`, e os de `lineup.ts` (`Lineup`, `Tactic`, `TeamSheet`).
  - **Erro `invalid-lineup`:** `sectorStrengths(squad, sheet, context, params)` devolve `StrengthsResult` (um `Result<TeamStrengths, 'invalid-lineup'>` com `detail: LineupProblem` tipado). Os motivos são os mesmos de `validateLineup`: `no-formation` (com `formation`), `wrong-count` (com `count`), `duplicate`, `wrong-club` (titular fora do elenco do clube) e `unavailable` (lesionado ou suspenso), os três últimos com `player`. Vale o primeiro problema encontrado, nesta ordem: formação, quantidade e cada titular na ordem das vagas. Trocar um titular indisponível é papel da partida (T-010), não do cálculo. `strengthsFromRatings` só lança por erro de programação (lista com tamanho diferente de 11 ou vaga do goleiro vazia).
  - **Força exibida:** `teamStrength` segue a definição de "Força" de um time de `docs/design/balance-targets.md`: média de `overall × fit` dos 11 titulares, sem condição, moral nem mando; número real de 0 a 99, que a interface arredonda. Com `lineup`, usa a formação e os 11 titulares dela (distintos e do elenco); a disponibilidade fica com o `validateLineup` (T-011). Sem `lineup`, usa o melhor XI dos aptos (nem lesionados nem suspensos) na `preferredFormations[0]` do clube, escolhido como a IA faz com todos descansados (`bestEleven`), até a T-013 trazer `lastSheets`. A implementação aceita `Pick<GameState, 'clubs' | 'players' | 'squads'>` e `Pick<Lineup, 'formation' | 'starters'>`.
  - **Vaga vazia (`docs/design/partida.md`, "Vaga vazia"):** em `strengthsFromRatings`, nota `undefined` é vaga vazia. A média de cada setor é só das vagas ocupadas, e cada vaga vazia conta uma vez em `faltando(t)` de `T(t)`. Um setor sem ninguém vale `EMPTY_SECTOR_FIT` (0,90) × a média do `eff` dos jogadores de linha em campo, ainda com `formation.*`, `pressure.mid` (no meio) e `T(t)`. Sem nenhum jogador de linha o setor vale 0, nunca `NaN`. A vaga do goleiro nunca fica vazia: antes do cálculo, `fillEmptyGoal` leva ao gol o jogador de linha de maior `physical` (empate: o primeiro na ordem das vagas), e a vaga dele é que fica vazia.
  - `ENGINE_VERSION` continua **3**: a T-008 só acrescenta o golden `strengths.json`, e nenhum golden existente mudou.
- **Escudo no `ClubDef` (ADR-0014):** `crestShape`, `crestPattern`, `crestBase` e `crestSymbol` são obrigatórios; `validateClubs` devolve `invalid-crest` (com `field` e `value`) para campo ausente ou fora das listas `CREST_SHAPES`, `CREST_PATTERNS`, `[0, 1]` e `CREST_SYMBOLS`. Como fazem parte das definições de clube no resumo do estado, `ENGINE_VERSION` passou a **3** (a simulação não mudou).
- **Semente por partida e por fluxo:** cada partida, o calendário, a geração, o sorteio de desempate e o conteúdo usam `seedFromString` com um rótulo próprio (`docs/design/partida.md`, "Determinismo"). Nunca se compartilha um `Rng` entre sistemas. Assim, mudar uma partida não desloca as outras, e as 10 partidas podem rodar em qualquer ordem.
- **Comandos:** mesma semente + mesmos comandos = mesmos eventos, byte a byte. A tela ao vivo reexecuta `simulateMatch` com a lista de comandos acumulada. Os eventos até o minuto do comando não mudam, porque o comando só vale a partir do minuto seguinte. Troca por lesão do lado humano: o motor aplica a regra da IA, salvo se houver um comando `substitution` com o mesmo `minute` e `out` igual ao lesionado.
- **A tabela é derivada:** `getStandings` calcula a tabela a partir das `Fixture.result`, com os critérios de desempate de `docs/design/temporada.md`. Não existe uma tabela gravada que possa divergir dos resultados.
- **Idempotência:** `playRound` com `input.round < state.round` devolve `round-already-played` e não muda nada.
- **Nome e rosto resolvidos na criação (ADR-0012):** o motor não conhece listas de nomes nem o gerador de rosto. Quando cria jogadores (`newGame`, `startNextSeason` e, nas etapas seguintes, base e mercado), chama a `IdentitySource` recebida por argumento, e o `Player` guarda o resultado: `name` (exibição, completo, sobrenome) e `face` (especificação codificada). `nameSeed` e `faceSeed` servem só para gerar. **Nome e rosto não são função da semente ao longo do tempo:** o resultado de `nameFromSeed` depende do conteúdo, da ordem e do tamanho das listas, que mudam (lote anual da US-067, correções). Por isso nenhuma tela regera nome de jogador existente; lê `Player.name` e desenha com `renderFace(player.face)`. Um nome retirado (ofensivo ou coincidente com atleta real) sai também dos saves antigos: ao abrir ou importar, se `GameState.retiredNamesRev` é menor que a revisão de `content/names/retired.json` (hashes), `lib/generators/identity.ts › renameRetired` regera só os atingidos a partir do `nameSeed`, com as listas atuais e as regras de elenco. No online, o servidor resolve com a mesma fonte, o nome vai no estado do D1 e o cliente só lê.

### 4.2 Save (ADR-0006)

**Envelope (`app/src/lib/save/schema.ts`):**

```ts
interface CareerSaveV1 {
  schemaVersion: 1;
  careerId: string; // UUID v4 gerado no aparelho
  createdAt: string;
  updatedAt: string; // ISO; o relógio fica fora do motor
  appVersion: string;
  engineVersion: number;
  paramsHash: string;
  career: {
    coachName: string; // único dado digitado pelo jogador; só no aparelho e no arquivo exportado
    clubId: ClubId;
    matchMode: 'full' | 'highlights' | 'result';
    news: NewsRef[];
    social: SocialRef[];
    phraseMemory: string[]; // ≤ 200 ids
    pendingFanDecision: number;
    exportReminder: boolean;
  };
  game: GameState;
}
```

**IndexedDB** (banco `prancheta`; com `PRANCHETA_ENV=test`, banco `prancheta-test`; a versão de estrutura do banco é independente de `schemaVersion`):

| Store         | Chave             | Conteúdo                                                                                         |
| ------------- | ----------------- | ------------------------------------------------------------------------------------------------ |
| `careers`     | `id`              | resumo para a lista: clube, temporada, rodada, `updatedAt`, `headSeq`, `schemaVersion`           |
| `snapshots`   | `[careerId, seq]` | `{ schemaVersion, savedAt, sha256, bytes, blob }`; `blob` = gzip do JSON do `CareerSave`         |
| `kv`          | `key`             | última configuração de novo jogo, preferências, idioma, persistência concedida, novidades vistas |
| `errors`      | auto              | registro de erros, anel de 50 (US-045)                                                           |
| `leagueCache` | `leagueId` (1b)   | última visão da liga recebida, com "atualizado em" (US-059)                                      |

**Gravação segura (US-032):** (1) serializa o JSON, calcula o SHA-256 e comprime com `CompressionStream('gzip')`; (2) numa transação `snapshots` + `careers`, grava `seq = headSeq + 1` e avança `headSeq`. A transação é atômica: se o app fechar no meio, nada muda. (3) Relê o snapshot, descomprime e confere o hash. Se bater, apaga os snapshots com `seq ≤ headSeq − 3`. Se não bater, apaga o novo, volta o `headSeq` e registra o erro. **Abrir:** tenta os snapshots do mais novo para o mais antigo. Vale o primeiro que passa por hash, parse, migração e validação, e o jogo avisa quantas rodadas foram perdidas. Se os três falharem, a carreira não abre e o jogo oferece importar.

**Migração (US-033):** `app/src/lib/save/migrations/NNNN-<slug>.ts`, cada uma uma função pura `vN → vN+1`, aplicadas em cadeia na memória. O original só é substituído depois de a versão migrada ser gravada e conferida como snapshot novo. Save com `schemaVersion` maior que o suportado não é aberto nem alterado, e o jogo pede para atualizar. Há uma fixture por versão em `app/src/lib/save/fixtures/vN.json`. Um teste de "forma" compara a árvore de chaves e tipos de um `GameState` novo com `fixtures/shape-vN.json`: mudar o formato sem subir `schemaVersion` e sem escrever a migração quebra o CI.

**Arquivo exportado (US-035/036):** texto UTF-8 com extensão `.txt` (é o tipo que o compartilhamento de arquivos do Chrome e do Safari aceita), nomeado `<config.shortName>-<clube>-T<temporada>-R<rodada>.txt`. A primeira linha é `PRANCHETA-SAVE 1`, a segunda é o SHA-256 e as seguintes são o base64 do gzip do `CareerSave`. Na importação: o arquivo é recusado acima de **5 MB** antes de ser lido; a descompressão para acima de **40 MB** (proteção contra bomba de gzip); depois vêm a conferência de hash, `valibot` estrito, migração e checagem de coerência (ids referenciados existem). Se o `careerId` já existe, o jogo pergunta se substitui ou se guarda como carreira nova (com `careerId` novo). Limite de **10 carreiras** no aparelho (cerca de 100 a 300 KB por snapshot comprimido; 30 snapshots ficam bem abaixo das cotas do Safari).

### 4.3 API HTTP do online (1b; ADR-0008, ADR-0009)

Base `/api/v1`, JSON, mesma origem do jogo. Toda requisição leva o cabeçalho `X-Prancheta-Protocol: <n>`. Abaixo do mínimo, o servidor responde `426 { error: { code: 'client_outdated' } }`. Erros seguem `{ error: { code: string, fields?: string[] } }`, com códigos estáveis em `snake_case`. O cliente traduz por `content/<idioma>/errors.json`, e o servidor nunca envia texto ao jogador. Sessão em cookie `__Host-pz_session` (HttpOnly, Secure, SameSite=Strict). Rotas marcadas com ★ exigem reautenticação com passkey nos últimos 5 minutos.

| Método e rota                                  | Corpo                                                                | Resposta (sucesso)                                     | Erros principais                                       |
| ---------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------------ | ------------------------------------------------------ |
| `POST /accounts/register/options`              | `{ nickname }`                                                       | `{ flowId, options }` (criação, residente)             | `nickname_invalid`, `nickname_taken`                   |
| `POST /accounts/register/verify`               | `{ flowId, credential, recoveryVerifier }`                           | `201 { account }` + cookie                             | `webauthn_failed`, `flow_expired`                      |
| `POST /auth/login/options`                     | `{}`                                                                 | `{ flowId, options }` (descoberta)                     | —                                                      |
| `POST /auth/login/verify`                      | `{ flowId, credential }`                                             | `{ account }` + cookie                                 | `auth_failed` (genérico)                               |
| `POST /auth/recover/options`                   | `{ nickname, recoveryVerifier }`                                     | `{ flowId, options }` (criação)                        | `auth_failed` (genérico), `too_many_attempts`          |
| `POST /auth/recover/verify`                    | `{ flowId, credential }`                                             | `{ account }` + cookie (passkey nova)                  | `webauthn_failed`                                      |
| `POST /auth/reauth/options` · `/verify`        | `{}` · `{ flowId, credential }`                                      | `204` (marca a sessão)                                 | `auth_failed`                                          |
| `POST /auth/logout`                            | —                                                                    | `204`                                                  | —                                                      |
| `GET /me`                                      | —                                                                    | `{ account, leagues: LeagueSummary[] }`                | `unauthenticated`                                      |
| `PUT /me/recovery` ★                           | `{ recoveryVerifier }`                                               | `204` (o código antigo deixa de valer)                 | `reauth_required`                                      |
| `DELETE /me` ★                                 | —                                                                    | `204`                                                  | `reauth_required`                                      |
| `POST /leagues`                                | `LeagueSettings`                                                     | `201 { league }`                                       | `name_invalid`, `deadline_not_allowed`, `max_humans`   |
| `POST /leagues/join`                           | `{ inviteCode }`                                                     | `{ league }`                                           | `invite_not_found`, `league_full`, `already_member`    |
| `GET /leagues/:id`                             | —                                                                    | `LeagueView` (membros, rodada, prontos, prazo, tabela) | `not_member`                                           |
| `GET /leagues/:id/snapshot`                    | — (`If-None-Match`)                                                  | `GameState` gzip, `ETag: s<season>-r<round>`           | `not_member`                                           |
| `GET /leagues/:id/rounds?after=s:r`            | —                                                                    | `RoundReport[]` (até 10)                               | `not_member`                                           |
| `POST /leagues/:id/clubs`                      | `{ clubId }`                                                         | `{ clubId }`                                           | `club_taken`, `wrong_phase`                            |
| `POST /leagues/:id/draft/pick`                 | `{ clubId }`                                                         | `{ clubId }`                                           | `not_your_turn`, `club_taken`                          |
| `POST /leagues/:id/start` (dono)               | —                                                                    | `{ league }`                                           | `not_owner`, `not_enough_humans`                       |
| `PUT /leagues/:id/rounds/:season/:round/sheet` | `TeamSheet`                                                          | `{ ready: true }`                                      | `invalid_lineup` (+ `fields`), `round_closed`          |
| `PATCH /leagues/:id` (dono)                    | `{ mode?, deadlineSeconds?, messagesEnabled? }`                      | `{ league }` (vale na próxima rodada)                  | `not_owner`, `max_humans`                              |
| `POST /leagues/:id/seasons` (dono)             | —                                                                    | `{ league }`                                           | `season_not_finished`, `league_finished`               |
| `PATCH /leagues/:id/me`                        | `{ messagesMuted }`                                                  | `204`                                                  | —                                                      |
| `POST /leagues/:id/messages`                   | `{ messageId }` (id do catálogo)                                     | `201`                                                  | `unknown_message`, `messages_disabled`, `rate_limited` |
| `POST /reports`                                | `{ leagueId, target: 'nickname' \| 'leagueName', targetId, reason }` | `201` ou `200` (já existia)                            | `unknown_reason`                                       |
| `GET /leagues/:id/live` (WebSocket)            | —                                                                    | ver 4.4                                                | `not_member`                                           |

O **código de recuperação** é gerado no aparelho e o servidor nunca o recebe: o cliente envia `recoveryVerifier = HKDF-SHA256(código, "prancheta/auth/v1")` (ADR-0008).

### 4.4 Sala da liga (Durable Object) e WebSocket (ADR-0009)

Interface interna (`server/src/rooms/room.ts`); o DO a implementa por RPC:

```ts
interface RoomCoordinator {
  sheetConfirmed(leagueId: string, season: number, round: number): Promise<void>; // reavalia "todos prontos"
  roundOpened(leagueId: string, season: number, round: number, deadlineAt: number): Promise<void>; // agenda o alarme
  processRound(leagueId: string, season: number, round: number): Promise<'processed' | 'already'>; // idempotente
  connect(leagueId: string, accountId: string, request: Request): Promise<Response>; // WebSocket (ao vivo)
  broadcast(leagueId: string, message: ServerMessage): Promise<void>;
}
```

- **Estados da rodada:** `open` (com `deadlineAt`) → `processing` → (só ao vivo) `broadcasting` até `startAt + duração` → `done`, e então a próxima abre. No assíncrono, a próxima abre logo depois de `done`. No ao vivo, abre depois da transmissão e de um intervalo de 30 s.
- **Processamento único:** a sala é uma por liga e roda uma coisa por vez. Além disso, a gravação no D1 é uma transação (`batch`) condicionada a `leagues.season = ? AND leagues.round = ?`, e `round_results` tem chave única `(league_id, season, round)`. Duas chamadas ao mesmo tempo dão um `processed` e um `already`.
- **Mensagens servidor → cliente:** `hello { serverTime, protocol }`, `ready { clubIds }`, `roundLive { season, round, startAt, msPerMinute, matches: { fixtureId, events }[] }`, `roundDone { season, round }`, `message { from, messageId, at }`, `leagueChanged { fields }`. **Cliente → servidor:** só `ping`. Toda ação vai pelo HTTP.
- **Sincronia do ao vivo:** cada cliente corrige o próprio relógio pelo `serverTime` e mostra o minuto `(agora − startAt) / msPerMinute`. A meta é diferença de até **2 s** entre aparelhos. Quem chega atrasado ou reconecta entra no minuto atual. O resultado já está gravado antes de a transmissão começar.

### 4.5 Modelo de dados do D1 (1b)

Só as colunas marcadas como "pessoa" se ligam a alguém. São exatamente a lista do US-064, e o teste de esquema falha se aparecer outra coluna ligada a conta.

| Tabela           | Colunas principais                                                                                                                                                                                                                                                                                                                | Pessoa                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------- |
| `accounts`       | `id` (aleatório), `nickname`, `nickname_norm` UNIQUE, `recovery_hash` (HMAC do verificador), `recovery_failures`, `recovery_locked_until`                                                                                                                                                                                         | apelido, dados de recuperação         |
| `credentials`    | `id` (credential id), `account_id`, `public_key`, `sign_count`, `transports`                                                                                                                                                                                                                                                      | chave pública                         |
| `sessions`       | `token_hash` PK, `account_id`, `expires_at`, `reauth_at`                                                                                                                                                                                                                                                                          | sessão                                |
| `auth_flows`     | `id`, `challenge`, `purpose`, `account_id?`, `expires_at` (5 min; limpeza no próprio uso e por alarme)                                                                                                                                                                                                                            | temporário                            |
| `leagues`        | `id`, `name`, `name_norm`, `owner_account_id`, `invite_code` UNIQUE, `format` (`'serie-a'` na 1b; ADR-0013), `mode`, `deadline_seconds`, `max_humans`, `club_pick`, `inactivity_rounds`, `messages_enabled`, `seasons_total?`, `season`, `round`, `round_state`, `deadline_at`, `status`, `seed`, `engine_version`, `params_hash` | dono (participação)                   |
| `league_members` | `league_id`, `account_id?` (NULL depois de apagada), `club_id?`, `joined_seq`, `controller` (`human`/`ai`), `missed_rounds`, `messages_muted`                                                                                                                                                                                     | participação                          |
| `league_states`  | `league_id`, `season`, `round`, `state_gz` (GameState gzip), PK `(league_id, season, round)`; guarda a atual e a anterior                                                                                                                                                                                                         | —                                     |
| `round_results`  | `league_id`, `season`, `round`, `report_gz`, `processed_at`, UNIQUE `(league_id, season, round)`                                                                                                                                                                                                                                  | —                                     |
| `sheets`         | `league_id`, `club_id`, `season`, `round`, `sheet_json`, `confirmed_seq`                                                                                                                                                                                                                                                          | —                                     |
| `messages`       | `id`, `league_id`, `account_id`, `message_id` (catálogo), `created_at`; apagadas com a conta; retenção de 30 dias                                                                                                                                                                                                                 | mensagens por id                      |
| `reports`        | `id`, `league_id`, `target_type`, `target_id`, `reason`, `created_at`, `reporter_account_id`, UNIQUE `(reporter, target_type, target_id)`                                                                                                                                                                                         | participação (sem IP nem texto livre) |

Não se grava IP, user-agent, e-mail nem data de nascimento. Os logs registram rota, código de status, código de erro e `leagueId` aleatório, mas não apelido, `accountId` nem credential id (US-064).

## 5. Transversais

- **Configuração:** `config/prancheta.config.ts`. Nenhum literal de marca fora dele. Os limites do online (máximo de humanos por modo, padrão 8 no ao vivo e 20 por divisão no assíncrono, nunca acima de um por clube, ADR-0013 revisado; prazos permitidos, limite de draft, limite de mensagens) ficam em `server/src/config.ts` com valores padrão e podem ser sobrescritos por variáveis do Cloudflare (US-051: mudar sem código).
- **Segredos (1b):** `RECOVERY_PEPPER` (HMAC do verificador) e `SESSION_PEPPER` ficam como segredos do Pages e do Worker. No ambiente local, em `.dev.vars` (no `.gitignore`). Nenhum segredo no repositório nem em log.
- **Erros:** o motor retorna `Result`. A camada de aplicação traduz o `error` para uma chave de `content/`. A interface mostra a mensagem no idioma atual. Erro inesperado é registrado em `lib/errors` com versão do app, tela, tipo e pilha, sem apelido, conteúdo do save, IP ou identificador do aparelho (US-045). Na 1a o registro fica só no aparelho, com o botão "copiar relatório" (P11).
- **Logging do servidor:** `console.log` estruturado em JSON (`{ route, status, code, ms }`), sem PII. Os logs da Cloudflare só ficam ligados com amostragem.
- **Privacidade:** nenhum dado pessoal novo sem ADR (ver 4.5). A carreira offline não envia nada a lugar nenhum.
- **Segurança da página:** arquivo `_headers` do Pages com CSP `default-src 'self'; img-src 'self' data: blob:; connect-src 'self'; frame-ancestors 'none'`, `Referrer-Policy: no-referrer` e `Permissions-Policy` mínima. O SVG gerado já é escapado (`shield.ts`).
- **Fronteiras verificadas pelo lint** (`app/eslint.config.js`; na 1b, `server/eslint.config.js`):
  - `engine/**`: as regras que já existem e mais `**/params/**`, `**/data/**`, `@config`, `node:*` e o global `Intl` (depende da localidade). O TypeScript usa `erasableSyntaxOnly` para o motor rodar no Node sem compilação.
  - `lib/**` não importa `ui/**`.
  - `ui/**` não importa `lib/save/**` direto (só por `lib/career`).
  - `server/**` importa do app só `app/src/engine/**`, `app/src/params/**` e, pelo ADR-0012, `app/src/lib/generators/names.ts`, `identity.ts`, a especificação do rosto (sem o desenho) e `app/src/content/names/**`.
  - `.svelte` sem texto literal (regra local `no-raw-text`).
- **Desempenho:**
  - Rodada completa (`playRound` + conteúdo + gravação) em menos de 2 s num celular simples. Medida no E2E com o Chromium a 4× de lentidão de CPU, com meta de 500 ms nessa condição.
  - `simulateMatch` abaixo de 0,3 ms no Node do CI (teste de bancada não bloqueante que registra o tempo).
  - `npm run balance -- --seasons 200` em menos de 3 minutos no CI, com os três modos. Se precisar, o script divide o trabalho em `worker_threads` e soma os resultados numa ordem fixa, para continuar reprodutível.
  - **Servidor (1b):** `processRound` (descomprimir, parse, 10 partidas, comprimir) dentro de 10 ms de CPU do plano gratuito; a bancada mede também 20 partidas com 40 clubes, o caso das Séries A e B da Etapa 2 (ADR-0013). Há um teste de bancada no CI e o risco está no item 9.
  - Partida animada a 60 fps num canvas de baixa resolução, com `requestAnimationFrame` só na tela da partida.
  - Instalação inicial abaixo de 10 MB, conferida no CI por `scripts/check-precache.mjs`.

## 6. Estratégia de testes (com `qa-engineer`)

| Camada        | Escopo                                                                                                           | Ferramenta                                           | Roda em                   |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------- | ------------------------- |
| Unitário      | motor (cada sistema), geradores, i18n, conteúdo, save (com `fake-indexeddb`), validação dos clubes               | Vitest                                               | todo commit               |
| Determinismo  | golden de partida, rodada, temporada inteira e virada (`engine/__golden__/`); mudar exige subir `ENGINE_VERSION` | Vitest                                               | todo PR                   |
| Propriedade   | invariantes em 1.000 sementes: estados em 0..100, 11 titulares, nenhum suspenso escalado, tabela consistente     | Vitest                                               | todo PR                   |
| Migração      | fixtures `vN` → atual; teste de forma do estado                                                                  | Vitest                                               | todo PR                   |
| Conteúdo      | chaves nos três idiomas, placeholders, lista bloqueada, faixas de `fanEffect`                                    | `npm run content:check`                              | todo PR                   |
| Servidor (1b) | rotas com `SqliteDb` + `InMemoryRoom`; teste de esquema de privacidade; servidor × cliente dão o mesmo resultado | Vitest (Node)                                        | todo PR                   |
| E2E           | jornadas do celular: novo jogo, rodada, partida animada, salvar, exportar/importar, offline, nova versão         | Playwright (Chromium e WebKit, `PRANCHETA_ENV=test`) | todo PR                   |
| Balanceamento | metas da 1a de `balance-targets.md`, `--seasons 200 --seed 1` no CI; sementes 2 e 3 no `/balance`                | `scripts/balance.ts`                                 | todo PR depois da T-016   |
| Regressão     | todo bug passado (`tests/regression/`) + cenários de aceite                                                      | tudo acima                                           | todo PR, antes de release |

O E2E roda o golden da partida também dentro do WebKit, para detectar diferença de ponto flutuante entre motores JavaScript (item 9).

## 7. Quebra técnica (ordenada)

> O Orquestrador delega uma por vez ao `developer`. Tamanho: P (< 1 h), M (meio dia), G (dia ou mais; quebrar se puder ou usar `opus`). Caminho pelo critério do `CLAUDE.md`: tudo que toca `engine/`, `lib/save/`, `server/`, `config/` ou `.github/`, ou que tem mais de 5 arquivos, é `/feature`.

| #     | Tarefa                                                                                                                                                                                                                                                                        | Histórias                      | Etapa | Depende de   | Caminho    | Tamanho | Estado               |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ----- | ------------ | ---------- | ------- | -------------------- |
| T-001 | Fundações do motor: `types.ts`, `Result`, `ENGINE_VERSION`, `math.ts`, utilitário de golden, lint de fronteira novo, `erasableSyntaxOnly`, imports relativos                                                                                                                  | base de US-004..012            | 1a    | —            | `/feature` | M       | feita                |
| T-002 | `GameParams`: tipo e `validateParams` com faixas; seis JSON em `app/src/params/`; `lib/params.ts`; teste de que os JSON do repositório são válidos                                                                                                                            | base de US-007..013            | 1a    | T-001        | `/feature` | M       | feita                |
| T-003 | Dados dos clubes: esquema `ClubDef`, `app/src/data/`, validação (20 clubes, rivais simétricos, escudo, lista bloqueada em hash), `scripts/hash-blocklist.mjs`                                                                                                                 | US-001                         | 1a    | T-001        | `/feature` | M       | feita                |
| T-004 | Gerador de nomes fictícios por nacionalidade (`lib/generators/names.ts`) + listas de nomes                                                                                                                                                                                    | US-003                         | 1a    | —            | `/feature` | M       | feita                |
| T-005 | Modelo do jogador no motor: atributos, `overall`, tabela `fit`, traços, potencial; `Player.name`/`face`, `IdentitySource` e fonte de teste do motor (ADR-0012)                                                                                                                | US-004                         | 1a    | T-001, T-002 | `/feature` | M       | feita                |
| T-006 | Geração dos elencos e `newGame` (escada de força, joia, ídolo, ajuste fino do XI); o gerador passa os 6 atributos da posição a `fitAttributesToOverall` (atributos de peso 0 não são criados por ela); `newGame` com `identities` e `lib/generators/identity.ts` (ADR-0012)   | US-004                         | 1a    | T-003, T-005 | `/feature` | M       | feita                |
| T-007 | Calendário: Berger, returno espelhado, mando ≤ 2 seguidos, datas (Data FIFA, meio de semana)                                                                                                                                                                                  | US-006                         | 1a    | T-001, T-002 | `/feature` | M       | feita (PR #15)       |
| T-008 | Força por setor, nota efetiva, mando com termômetro (e `homeBase`), força exibida                                                                                                                                                                                             | US-007, US-026 (mando)         | 1a    | T-005        | `/feature` | M       | feita (PR em aberto) |
| T-009 | `simulateMatch` núcleo: oportunidades, finalização, assistência, acréscimos, estatísticas, notas, marcadores, eventos, golden                                                                                                                                                 | US-008                         | 1a    | T-008        | `/feature` | G       | a fazer              |
| T-010 | Partida: cartões, lesões, pênaltis e faltas, cobradores e capitão, casos de borda (menos de 7, sem goleiro)                                                                                                                                                                   | US-009                         | 1a    | T-009        | `/feature` | M       | a fazer              |
| T-011 | IA pré-jogo: `suggestSheet` (escalação gulosa, rotação, banco, cobradores), tática por perfil, `validateLineup`                                                                                                                                                               | US-011                         | 1a    | T-008        | `/feature` | M       | a fazer              |
| T-012 | Comandos na partida: substituições, táticas, atalhos, conversa do intervalo, IA em jogo (regras 1–6); implementa a "Troca de formação durante o jogo" de `docs/design/partida.md`                                                                                             | US-021, US-022, US-011         | 1a    | T-010, T-011 | `/feature` | M       | a fazer              |
| T-013 | `prepareRound`/`playRound`: 10 partidas, suspensões, lesões, recuperação por dias, idempotência, `getStandings` com desempate, fatos da tabela; `teamStrength` sem escalação passa a usar `lastSheets`                                                                        | US-012, US-019 (motor)         | 1a    | T-007, T-012 | `/feature` | G       | a fazer              |
| T-014 | Moral e fadiga entre rodadas, termômetro da torcida, modo "realismo simplificado"                                                                                                                                                                                             | US-010, US-026                 | 1a    | T-013        | `/feature` | M       | a fazer              |
| T-015 | Golden da temporada inteira + testes de propriedade em 1.000 sementes                                                                                                                                                                                                         | US-008, US-012                 | 1a    | T-014        | `/feature` | P       | a fazer              |
| T-016 | `scripts/balance.ts` (liga, duelos calibrados, duelos táticos, `--seasons/--seed/--duels/--params`, tempo) e `npm run balance`                                                                                                                                                | US-013                         | 1a    | T-014        | `/feature` | M       | a fazer              |
| T-017 | Fim de temporada: prêmios, resumo, evolução e idade, `endSeason`/`startNextSeason` (com `incoming` opcional para a opção B; `identities` para os clubes que entram). Aceite: a semente de `generateSquad` inclui a temporada (clube que volta não repete elenco nem ids)      | US-025 (motor)                 | 1a    | T-014        | `/feature` | M       | a fazer              |
| T-018 | Save: IndexedDB, snapshots gzip + SHA-256, gravação segura com 3 versões, abrir com volta, banco de teste, limite de 10 carreiras. Aceite: a conformidade real do ADR-0012 (o save mantém os nomes ao reabrir) é testada aqui, em conjunto com a T-044                        | US-032, US-034 (dados)         | 1a    | T-013        | `/feature` | M       | a fazer              |
| T-019 | Versão do formato e migrações: cadeia, fixture v1 (com `name`, `face`, `retiredNamesRev`), teste de forma, recusa de versão nova                                                                                                                                              | US-033                         | 1a    | T-018, T-027 | `/feature` | M       | a fazer              |
| T-020 | Exportar e importar: arquivo `.txt`, compartilhar/baixar, limites, `valibot`, conflito de `careerId`                                                                                                                                                                          | US-035, US-036                 | 1a    | T-019        | `/feature` | M       | a fazer              |
| T-021 | Templates: renderizador, catálogo de placeholders, memória de 200, contexto; `scripts/content-check.mjs`; regra `no-raw-text`                                                                                                                                                 | US-027, US-040 (parte)         | 1a    | —            | `/feature` | M       | a fazer              |
| T-022 | i18n: idioma inicial, troca nas preferências, carregamento dinâmico, nome do jogo da configuração                                                                                                                                                                             | US-040                         | 1a    | T-021        | `/feature` | P       | a fazer              |
| T-023 | Casca da interface: `CareerService`, navegação (abas no celular, barra lateral no desktop), fronteira de erro, registro local de erros                                                                                                                                        | US-015, US-045                 | 1a    | T-013, T-018 | `/feature` | M       | a fazer              |
| T-024 | Infra de E2E: Playwright (Chromium + WebKit), `PRANCHETA_ENV=test`, primeiro teste, golden no WebKit, job no CI                                                                                                                                                               | US-038 (base)                  | 1a    | T-023        | `/feature` | M       | a fazer              |
| T-025 | Tela inicial (lista, continuar, apagar com confirmação dupla) e novo jogo (clube, apelido, realismo, modo de partida, última configuração)                                                                                                                                    | US-034, US-014                 | 1a    | T-023, T-006 | `/feature` | M       | a fazer              |
| T-026 | Uniformes gerados (`lib/generators/kit.ts`)                                                                                                                                                                                                                                   | US-002                         | 1a    | T-003        | `/feature` | P       | a fazer              |
| T-027 | Avatares gerados (`lib/generators/avatar.ts`): `faceSpecFromSeed` separada de `renderFace`, codificação de `Player.face`, limite de bytes do `art-director` (ADR-0012)                                                                                                        | US-005                         | 1a    | T-005        | `/feature` | M       | a fazer              |
| T-028 | Tela do clube (com termômetro e rótulo de humor), elenco e card do jogador                                                                                                                                                                                                    | US-015, US-016, US-026 (tela)  | 1a    | T-025, T-027 | `/feature` | M       | a fazer              |
| T-029 | Escalação com arrastar e soltar, táticas, capitão e cobradores                                                                                                                                                                                                                | US-017, US-018                 | 1a    | T-028, T-011 | `/feature` | G       | a fazer              |
| T-030 | Jogar rodada "só resultado": resumo, outros resultados, salvamento automático, fechar no meio                                                                                                                                                                                 | US-019, US-032                 | 1a    | T-029        | `/feature` | M       | a fazer              |
| T-031 | Tabela e calendário/resultados                                                                                                                                                                                                                                                | US-023, US-024                 | 1a    | T-030        | `/feature` | M       | a fazer              |
| T-032 | Partida animada: canvas 2D, narração, pausa dramática, pular, reduzir movimento, vibração                                                                                                                                                                                     | US-020                         | 1a    | T-030, T-026 | `/feature` | G       | a fazer              |
| T-033 | Comandos, substituições e conversa do intervalo na tela da partida                                                                                                                                                                                                            | US-021, US-022                 | 1a    | T-032        | `/feature` | M       | a fazer              |
| T-034 | Notícias da rodada a partir dos fatos (`lib/content/news.ts`) e tela do jornal                                                                                                                                                                                                | US-028                         | 1a    | T-021, T-030 | `/feature` | M       | a fazer              |
| T-035 | Rede social simples e entrevista pós-jogo (com `fanEffect`)                                                                                                                                                                                                                   | US-029, US-030                 | 1a    | T-034        | `/feature` | M       | a fazer              |
| T-036 | Ferramenta de repetição de templates (`scripts/template-repeat.ts`)                                                                                                                                                                                                           | US-031                         | 1a    | T-034, T-016 | `/feature` | P       | a fazer              |
| T-037 | Fim de temporada nas telas: cerimônia, prêmios, resumo, próxima temporada, lembrete de exportar                                                                                                                                                                               | US-025, US-037 (lembrete)      | 1a    | T-017, T-031 | `/feature` | M       | a fazer              |
| T-038 | Armazenamento persistente e aviso de persistência negada                                                                                                                                                                                                                      | US-037                         | 1a    | T-020        | `/feature` | P       | a fazer              |
| T-039 | PWA: `registerType: 'prompt'`, aviso de nova versão fora da partida, novidades, `check-precache` (< 10 MB) no CI, E2E offline                                                                                                                                                 | US-038, US-039                 | 1a    | T-024, T-030 | `/feature` | M       | a fazer              |
| T-040 | Marcas fictícias no cenário (ADR-0015)                                                                                                                                                                                                                                        | US-041                         | 1a    | T-032        | `/feature` | P       | a fazer              |
| T-041 | Tela "Sobre" e preferências (tema, vibração, aba da rede social, idioma, lembrete, copiar relatório de erros)                                                                                                                                                                 | US-043, US-044, US-045         | 1a    | T-023, T-022 | `/feature` | M       | a fazer              |
| T-042 | Tutorial e primeiros passos                                                                                                                                                                                                                                                   | US-042                         | 1a    | T-030        | `/feature` | M       | a fazer              |
| T-043 | Estatísticas sem cookies só no site (se a P11 for aprovada)                                                                                                                                                                                                                   | US-046                         | 1a    | —            | `/quick`   | P       | a fazer              |
| T-044 | Nomes retirados: `content/names/retired.json` (hashes + `rev`), `npm run names:retire`, `renameRetired` ao abrir e importar, aviso nas novidades, testes (ADR-0012). Aceite: a conformidade real do ADR-0012 (o save mantém os nomes) é testada aqui, em conjunto com a T-018 | US-003, US-033                 | 1a    | T-004, T-019 | `/feature` | P       | a fazer              |
| T-050 | Esqueleto do servidor: workspace `server/`, Hono, `Db` (D1 e `node:sqlite`), migração SQL 0001, erros, logs sem PII, teste de esquema de privacidade, lint (fronteira com a exceção do ADR-0012), CI                                                                          | US-064 (esquema)               | 1b    | T-013        | `/feature` | M       | a fazer              |
| T-051 | Topologia: adaptador `functions/api/[[route]].ts`, Worker `prancheta-rooms` com o DO, `wrangler` de produção e prévia, `_headers`, `docs/04-deploy.md`                                                                                                                        | ADR-0010                       | 1b    | T-050        | `/feature` | M       | a fazer              |
| T-052 | Filtro de apelido e de nome de liga                                                                                                                                                                                                                                           | US-047, US-051                 | 1b    | T-050        | `/feature` | M       | a fazer              |
| T-053 | Criar conta: passkey + código de recuperação gerado no aparelho (verificador HKDF, HMAC com pepper), mostrar uma vez                                                                                                                                                          | US-047, US-048                 | 1b    | T-052        | `/feature` | G       | a fazer              |
| T-054 | Entrar, sessão, recuperar em outro aparelho, bloqueio por tentativas, reautenticação, código novo                                                                                                                                                                             | US-049, US-048                 | 1b    | T-053        | `/feature` | M       | a fazer              |
| T-055 | Apagar conta: remoção, clubes para a IA, apelido some, posse da liga passa adiante                                                                                                                                                                                            | US-050                         | 1b    | T-054, T-056 | `/feature` | M       | a fazer              |
| T-056 | Ligas: criar (configurações e limites da configuração do servidor, até 8 humanos no ao vivo e até 20 no assíncrono, `leagues.format = 'serie-a'`, ADR-0013 revisado), entrar por código, link de convite, `LeagueView`                                                        | US-051, US-052                 | 1b    | T-054        | `/feature` | M       | a fazer              |
| T-057 | Escolha de clubes livre e por sorteio; iniciar temporada (`newGame` no servidor, estado no D1)                                                                                                                                                                                | US-053                         | 1b    | T-056        | `/feature` | M       | a fazer              |
| T-058 | `RoomCoordinator`: interface, `InMemoryRoom`, `LeagueRoomDO` (alarme de prazo), estados da rodada                                                                                                                                                                             | US-056 (base)                  | 1b    | T-051, T-057 | `/feature` | M       | a fazer              |
| T-059 | Rodada online: `PUT sheet`, prontos, processamento idempotente, escalação de reserva/IA, inatividade e volta, bancada de CPU com 10 e 20 partidas (ADR-0013), troca de modo recusada de assíncrono para ao vivo acima de `maxHumans.live` (US-061)                            | US-055, US-056, US-060         | 1b    | T-058        | `/feature` | G       | a fazer              |
| T-060 | Cliente online, conta: `lib/online`, telas de criar conta, código, entrar, recuperar, apagar                                                                                                                                                                                  | US-047..US-050 (telas)         | 1b    | T-054, T-023 | `/feature` | M       | a fazer              |
| T-061 | Cliente online, liga: criar/entrar, escolha de clube, preparar rodada e "Pronto" (reaproveita a escalação), cache offline                                                                                                                                                     | US-051..US-053, US-055, US-059 | 1b    | T-059, T-060 | `/feature` | G       | a fazer              |
| T-062 | Assíncrono: resumos das rodadas processadas, partida a partir dos eventos, notícias da liga no cliente                                                                                                                                                                        | US-058, US-059                 | 1b    | T-061        | `/feature` | M       | a fazer              |
| T-063 | Ao vivo: WebSocket com hibernação, `roundLive` com `startAt`, correção de relógio, reconexão, placares ao vivo                                                                                                                                                                | US-057                         | 1b    | T-062, T-032 | `/feature` | G       | a fazer              |
| T-064 | Dono troca o modo; fim de temporada e duração da liga                                                                                                                                                                                                                         | US-061, US-063                 | 1b    | T-062, T-017 | `/feature` | M       | a fazer              |
| T-065 | Mensagens prontas e emojis (catálogo por id, desligar na liga e para si, limite de envio)                                                                                                                                                                                     | US-062                         | 1b    | T-061        | `/feature` | M       | a fazer              |
| T-066 | Denúncia mínima de apelido e nome de liga (se a P7 for aprovada)                                                                                                                                                                                                              | US-065                         | 1b    | T-056        | `/feature` | P       | a fazer              |
| T-067 | Draft                                                                                                                                                                                                                                                                         | US-054                         | 1b    | T-057, T-058 | `/feature` | M       | a fazer              |
| T-068 | Auditoria de privacidade da 1b (`security-auditor`) e política do site atualizada                                                                                                                                                                                             | US-064                         | 1b    | T-050..T-066 | `/feature` | M       | a fazer              |

**Caminho crítico da 1a:** T-001 → T-002 → T-005 → T-008 → T-009 → T-010 → T-011/T-012 → T-013 → T-014 → T-016 (primeiro `/balance` do motor). Em paralelo, e sem depender do motor: T-003, T-004, T-021. Depois vêm save (T-018..T-020) e a interface (T-023 em diante). A T-044 entrou pelo ADR-0012; os números T-045 a T-049 ficam livres para tarefas que surgirem na 1a.

## 8. Decisões pendentes do CEO

1. **ADR-0006 a ADR-0010** (save, motor, contas, protocolo da liga, topologia): aprovar como estão. _Recomendação:_ aprovar. Nenhuma muda decisão aceita.
2. **ADR-0011, fator casa `match.homeBase`:** é decisão de diversão do CEO, e o architect não decide. Opção A: +5% fixo, o mandante vence cerca de 47%, como no Brasileirão. Opção B: 0, o mandante vence cerca de 42% e a meta cai para 40% a 45%. O motor aceita as duas por parâmetro, então a escolha não bloqueia nenhuma tarefa.
3. **Topologia do servidor (ADR-0010):** A, Pages Functions + Worker de salas, ou B, migrar jogo e site para um Worker único com arquivos estáticos. _Recomendação:_ A, que mantém o ADR-0002 e o Pages já configurado.
4. **Domínio antes da 1b:** a passkey fica presa ao domínio. Trocar o domínio depois de abrir o online obriga todo mundo a recuperar a conta pelo código. _Recomendação:_ decidir o domínio definitivo antes de abrir a 1b para os amigos.
5. **Plano pago dos Workers (US$ 5/mês) se a bancada da T-059 passar de 10 ms de CPU por rodada:** _Recomendação:_ autorizar só se a bancada mostrar a necessidade, primeiro tentando enxugar o estado.
6. **Fim de temporada na 1a:** a P2 do `product-manager` (mesmos 20 clubes, sem efeito) e a decisão 5 do `game-designer` (opção B, com 4 clubes abstratos da Série B, que exige a lista de 4 a 8 clubes extras) divergem. O motor suporta as duas (`startNextSeason` com `incoming` opcional). _Recomendação:_ começar pela P2, que não depende de lista nova, e ligar a opção B quando a lista de clubes extras for aprovada.
7. **Dependência nova `valibot`** (cliente e servidor) e, na 1b, **`@simplewebauthn/server` e `/browser`** e **`hono`**. _Recomendação:_ aprovar. São maduras, pequenas e sem telemetria.
8. **ADR-0012, nome e rosto do jogador guardados no estado:** o save guarda o nome resolvido e a especificação do rosto, e as listas podem mudar sem renomear ninguém. Um nome retirado por ser ofensivo, ou por coincidir com o de um atleta real, some também dos saves antigos: o jogador atingido ganha um nome novo, e o jogo avisa sem citar o nome. _Recomendação:_ aprovar as duas partes. A alternativa para a segunda parte é deixar os saves antigos como estão, com risco de imagem e jurídico.

## 9. Riscos

| Risco                                                                                                          | Efeito                                                            | Mitigação                                                                                                                                                                                                                  |
| -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| CPU de 10 ms do plano gratuito pouco para `processRound` (parse + 10 partidas + gzip; 20 na Etapa 2, ADR-0013) | rodada falha no servidor ou exige US$ 5/mês                       | bancada no CI desde a T-059; estado enxuto (eventos completos só da última rodada); plano pago já previsto no ADR-0002 como saída                                                                                          |
| `Math.exp` e afins com o último bit diferente entre V8 (Chrome, Workers) e JavaScriptCore (Safari)             | o mesmo save daria resultado diferente em outro aparelho          | na carreira, o resultado é gravado e nunca recalculado em outro aparelho; no online, só o servidor simula; golden no WebKit pelo E2E; `exp` encapsulado em `engine/math.ts` para trocar por uma versão própria se precisar |
| Safari apaga dados de sites pouco usados                                                                       | perda de carreira                                                 | `storage.persist`, incentivo à instalação, lembrete de exportar (US-037)                                                                                                                                                   |
| Mudança de domínio depois da 1b                                                                                | passkeys param de funcionar; saves locais ficam no domínio antigo | decidir o domínio antes da 1b; código de recuperação registra passkey nova; exportar/importar                                                                                                                              |
| Golden quebrar a cada ajuste de regra                                                                          | atrito no desenvolvimento                                         | subir `ENGINE_VERSION` e regenerar o golden é um passo explícito do PR; os saves são snapshots e não dependem do algoritmo                                                                                                 |
| Transmissão ao vivo manda o resultado inteiro de uma vez                                                       | um jogador curioso vê o placar antes                              | sem comandos no online (P6), isso não muda nada no jogo; se incomodar, enviar em blocos de 15 minutos (custa mais tempo de DO)                                                                                             |
| Duas topologias de deploy (Pages + Worker de salas)                                                            | mais configuração para o CEO                                      | um job de deploy com aprovação do CEO no GitHub; checklist em `docs/04-deploy.md`                                                                                                                                          |
| Vitest 5 sem suporte do `@cloudflare/vitest-pool-workers`                                                      | não testar o runtime real                                         | testes do servidor em Node com `SqliteDb` + `InMemoryRoom`; teste de fumaça manual com `wrangler pages dev` na prévia                                                                                                      |

---

**Aprovação do CEO:** ☐ aprovado em <data>
