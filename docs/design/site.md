# Site público: mapa, páginas e componentes

**Status:** aprovado pelo CEO em 2026-11-04, com as três opções da seção "Tokens" (tema `dia` pela preferência do sistema, grupo `layout` nos tokens, `@astrojs/sitemap`).

Especificação do `ux-designer` para o site em `site/` (Astro, só pt-BR). Define a estrutura, a ordem das seções, o tipo de conteúdo e os componentes; o texto final é do `tech-writer`, em `docs/content/site/`. Nome, slogan, logo, cores, domínio e contatos vêm sempre de `config/prancheta.config.ts`; cores, fontes, raios e espaços só de `app/src/tokens.css` (gerado de `design/tokens.json`).

Princípios: celular primeiro (360px), leitura com uma mão, cara de estádio à noite (tema `noite`), simples antes de bonito. Sem capturas de tela até existirem telas do jogo: a parte visual vem dos escudos gerados, do logo e da tipografia.

## Mapa do site

| Página               | Rota            | Objetivo em uma frase                                                      | Estado  |
| -------------------- | --------------- | -------------------------------------------------------------------------- | ------- |
| Início               | `/`             | Explicar o jogo em 10 segundos e levar a jogar a versão atual ou a seguir. | refazer |
| O jogo               | `/o-jogo/`      | Mostrar como é uma temporada, do ajuste tático à rede social.              | nova    |
| Modos de jogo        | `/modos/`       | Explicar carreira e liga com amigos, os dois ritmos e quando cada um chega | nova    |
| Clubes               | `/clubes/`      | Apresentar a ideia dos clubes fictícios em trocadilho e seus escudos.      | nova    |
| Perguntas frequentes | `/perguntas/`   | Responder dúvidas de preço, privacidade, celular, idiomas e clubes.        | nova    |
| Devlog               | `/devlog/`      | Diário semanal do desenvolvimento.                                         | mantém  |
| Roteiro              | `/roadmap/`     | Etapas e estado, lidos de `docs/roadmap.md`.                               | mantém  |
| Apoiar               | `/apoiar/`      | Como apoiar e "Patrocine aqui".                                            | mantém  |
| Privacidade          | `/privacidade/` | Política de privacidade.                                                   | mantém  |
| Jogo                 | `/jogo/`        | O próprio jogo (PWA, outro workspace).                                     | link    |

A rota `/roadmap/` fica como está (o devlog e posts antigos já apontam para ela); o rótulo visível é "Roteiro".

## Navegação

### Celular (até 719px)

- **Cabeçalho fixo no topo** (altura 56px, `surface-1`, borda inferior `line`): marca à esquerda (logo de `config.logo.mark` + `config.name` em `subtitulo`; enquanto `hasBrand` for falso, só o nome), à direita dois alvos: botão **Jogar** (único primário do cabeçalho, `grass`/`on-grass`, ≥ 44px) e botão **Menu** (ícone + texto "Menu", ≥ 44×44px).
- **Menu**: painel que desce sob o cabeçalho, com a lista vertical das páginas (cada item ≥ 48px de altura, largura total). Feito com `<details>/<summary>` para funcionar sem JavaScript; foco visível com `focus`; `Esc` fecha se houver o script mínimo opcional. A página atual leva `aria-current="page"` e um marcador visual além da cor (barra lateral de 4px + peso 600).
- **Ordem do menu**: O jogo, Modos de jogo, Clubes, Perguntas, Roteiro, Devlog, Apoiar.
- **Não usar barra de abas embaixo** no site: ela é padrão do jogo; no site confundiria com o app. O alcance do polegar é garantido pelos CTAs no corpo (cada página termina com o bloco "Chamada final" na metade de baixo da tela).

### Desktop (720px ou mais)

- Mesmo cabeçalho, com o menu aberto em linha (itens `rotulo`, ≥ 44px de altura), sem botão Menu; "Jogar" continua à direita.
- Conteúdo em coluna de leitura com no máximo 720px; grades (recursos, escudos) podem ir a 1040px.

### Rodapé (todas as páginas)

Três blocos empilhados no celular, em linha no desktop: (1) aviso "jogo independente, clubes e jogadores fictícios" e versão (`config.version`); (2) links: Privacidade, Apoiar, RSS do devlog, Discussions (só se `config.contacts.discussionsUrl` não for vazio), repositório (só se `config.contacts.repository` não for vazio); (3) contato (só se `supportEmail` não for vazio). Links do rodapé com alvo ≥ 44px (padding vertical, não só a altura da linha).

### Pular para o conteúdo

Primeiro elemento focável de toda página: link "Pular para o conteúdo" (visível no foco) para `#conteudo` no `<main>`.

## Estado dos recursos (fonte única)

Todo recurso citado no site leva um **SeloEstado** com um de três valores:

| Valor                | Quando                                                           |
| -------------------- | ---------------------------------------------------------------- |
| `disponivel`         | Já pode ser jogado na versão publicada em `/jogo`.               |
| `em-desenvolvimento` | Pertence à etapa com estado "em andamento" em `docs/roadmap.md`. |
| `planejado`          | Pertence a uma etapa com estado "planejada".                     |

Regra para não mentir: o estado é derivado da etapa do recurso, lida de `docs/roadmap.md` no build (o mesmo leitor do Roteiro), e só vira `disponivel` por marcação explícita no arquivo de dados quando a tarefa for publicada (conferir em `docs/status.md`). Sugestão ao `developer`: `site/src/data/recursos.ts` com `{ id, etapa, disponivel?: boolean }`; os títulos e descrições vêm de `docs/content/site/`. Hoje, praticamente todos os recursos do jogo ficam `em-desenvolvimento` (Etapa 1a) ou `planejado`; a versão zero em `/jogo` é a única coisa jogável, e o site deve dizer isso com clareza.

## Páginas

Para cada seção: objetivo e tipo de conteúdo. "CTA" é chamada para ação; um só botão primário por tela visível.

### 1. Início (`/`)

1. **Abertura (hero)**. Objetivo: dizer o que é em uma olhada. Conteúdo: rótulo "Em desenvolvimento, em público" (`rotulo`, cor `floodlight`); nome em `display-xl`; slogan de `config.slogan['pt-BR']` em `subtitulo`, `ink-muted`; uma frase de apoio; CTA primário "Jogar a versão atual (v…)" e link secundário "Ver o roteiro". Fundo: `surface-0` com uma faixa decorativa de escudos gerados (3 a 5, `aria-hidden`), sem foto.
2. **Três promessas**. Objetivo: diferenciais. Conteúdo: 3 CardRecurso curtos (rodadas de poucos minutos no celular; clubes fictícios em trocadilho; carreira offline e liga com amigos), cada um com ícone, título, uma frase e SeloEstado.
3. **Como é uma rodada**. Objetivo: dar a sensação do jogo sem captura. Conteúdo: PassoAPasso de 4 passos (escalar e ajustar a tática → jogar a partida minuto a minuto → ver a tabela → ler as notícias e a rede social); link "Conhecer o jogo" para `/o-jogo/`.
4. **Os clubes**. Objetivo: o humor e a identidade. Conteúdo: GradeEscudos com 6 clubes fictícios (escudo + nome curto), uma frase sobre os trocadilhos, link para `/clubes/`.
5. **Onde estamos**. Objetivo: transparência. Conteúdo: FaixaEtapas (etapa atual destacada, próximas em lista), link para o Roteiro.
6. **Últimos posts do devlog**. Objetivo: provar que está vivo. Conteúdo: 3 CardPost (data, etapa, título, resumo), link "Todos os posts". Mantém a lógica atual de `getCollection('devlog')`.
7. **Chamada final**. Objetivo: converter. Conteúdo: ChamadaFinal com "Jogar" (primário) e "Apoiar" (secundário).

### 2. O jogo (`/o-jogo/`)

1. **Abertura**. Título `titulo`, uma frase de resumo, sumário com âncoras para as seções abaixo (lista de links ≥ 44px).
2. **A temporada**. Objetivo: o ciclo de 38 rodadas da Série A com 20 clubes. Conteúdo: texto curto + mini tabela ilustrativa (LinhaTabelaSite, 4 linhas, clubes fictícios, números `tabular-nums`, coluna do clube fixa) marcada como "exemplo". Selo da etapa 1a.
3. **Tática: formação, postura e pressão**. Objetivo: mostrar que três ajustes bastam. Conteúdo: 3 CardRecurso, um por ajuste, cada um com um diagrama simples em SVG inline desenhado com tokens (`pitch`, `pitch-line`) e a lista das opções; legenda textual sempre presente.
4. **A partida minuto a minuto**. Objetivo: o coração do jogo. Conteúdo: LanceExemplo, uma sequência estática de 4 a 6 lances de narração (minuto em `numero` + texto), placar em `placar-xl`; nada de animação automática. Citar os três tipos de partida (animada, lances principais, só resultado).
5. **A torcida**. Objetivo: o termômetro (0 a 100) e o efeito no mando. Conteúdo: texto + Termometro ilustrativo com valor em número e rótulo textual (fria, animada, em festa), nunca só cor. Selo: termômetro na 1a; efeitos completos na Etapa 3 (dois selos, cada um com seu item).
6. **Notícias e rede social**. Objetivo: o mundo reage às suas decisões. Conteúdo: 2 ou 3 NoticiaExemplo (veículo fictício, manchete, trecho) e 2 PostRedeExemplo; tudo fictício e marcado como exemplo.
7. **Chamada final**.

### 3. Modos de jogo (`/modos/`)

1. **Abertura**. Título e a ideia "modo × ritmo" em uma frase.
2. **Carreira offline**. Objetivo: jogar sozinho, sem internet, com save no aparelho, exportar/importar. Conteúdo: CardModo com lista de 3 a 5 itens, cada um com SeloEstado.
3. **Liga com amigos**. Objetivo: ligas da Série A por código de convite, ao vivo ou assíncrono, conta anônima (apelido + passkey), mensagens prontas (sem chat livre). Conteúdo: CardModo com itens e selos (Etapa 1b: `planejado`).
4. **Os dois ritmos**. Objetivo: "No meu ritmo" (padrão) e "Tempo real" (segue o calendário real; Etapa 4). Conteúdo: ComparaRitmos, duas colunas no desktop e dois cards empilhados no celular, com as mesmas linhas (quando avança, onde existe, quando chega).
5. **O que entra em cada etapa**. Objetivo: expectativa honesta. Conteúdo: TabelaEtapas com Etapa, nome, o que entra para o jogador (curto) e SeloEstado; coluna "Etapa" fixa na rolagem horizontal. Fonte: `docs/roadmap.md`; link para o Roteiro completo.
6. **Chamada final**.

### 4. Clubes (`/clubes/`)

1. **Abertura**. Objetivo: a regra da casa: todos os clubes são fictícios, com nomes em trocadilho. Conteúdo: título, uma frase.
2. **A ideia dos trocadilhos**. Objetivo: o humor sem imitar. Conteúdo: texto curto + 3 a 4 exemplos **só do lado fictício** (ex.: Flamingo, Corinto, Coritibom), sem nunca citar, insinuar por extenso ou ligar ao clube real.
3. **Os escudos gerados**. Objetivo: mostrar que cada escudo nasce do código, sempre igual para o mesmo clube. Conteúdo: GradeEscudos com os 20 clubes de `app/src/data/clubs.serie-a.json` (escudo + nome curto), gerados no build por `shieldSpecFor` e `shieldSvg` de `app/src/lib/generators/shield.ts`; uma nota de como funciona (forma, duas cores, símbolo) em linguagem leiga.
4. **O que não fazemos**. Objetivo: confiança. Conteúdo: lista curta: sem escudos, uniformes, canções ou nomes reais; jogadores com nomes inventados.
5. **Mais clubes no futuro**. Conteúdo: itens com selo (Séries B a D na Etapa 2, América do Sul na Etapa 5).
6. **Chamada final**.

### 5. Perguntas frequentes (`/perguntas/`)

1. **Abertura**. Título e campo nenhum de busca (poucas perguntas; a página é curta).
2. **Grupos de perguntas**: Sobre o jogo (preço, celular e computador, instalar como app, idiomas), Clubes e jogadores (por que fictícios), Privacidade (o que fica no aparelho, sem cookies, sem analytics com identificação, sem anúncios de terceiros, link para a política), Online (quando chega, conta anônima, sem chat livre), Apoio (como apoiar, "Patrocine aqui"). Conteúdo: Pergunta (acordeão com `<details>/<summary>`, funciona sem JS, `summary` ≥ 48px, ícone de seta além do texto).
3. **Não achou?** Link para o canal de Discussions (de `config.contacts.discussionsUrl`, se preenchido) e contato se `supportEmail` existir; senão, link para o devlog e o repositório (se houver).

## Componentes Astro reutilizáveis

Em `site/src/components/`, todos sem JavaScript no cliente, só tokens.

| Componente      | Props (inglês)                                                                  | Notas                                                                                                                                                                                                                                                                                                                              |
| --------------- | ------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `SiteHeader`    | `current: string`                                                               | Marca, Jogar, Menu (`<details>`), `aria-current`.                                                                                                                                                                                                                                                                                  |
| `SiteFooter`    | —                                                                               | Lê `config.contacts` e `config.legal`; omite links vazios.                                                                                                                                                                                                                                                                         |
| `StatusBadge`   | `status: 'disponivel' \| 'em-desenvolvimento' \| 'planejado'`, `stage?: string` | Selo pílula (`radius-pill`, `rotulo`, altura 24px, não é alvo de toque). Sempre texto + ícone: disponível = `grass-soft` + `ink` + ✓; em desenvolvimento = `floodlight` + `on-floodlight` + engrenagem/relógio; planejado = `surface-2` + `ink` + contorno tracejado em `line` + calendário. Etapa opcional no texto ("Etapa 1b"). |
| `FeatureCard`   | `title`, `icon?`, `status`, `stage?`, slot                                      | `surface-1`, borda `line`, `radius-md`, padding `space-4`; título `subtitulo`; selo no topo.                                                                                                                                                                                                                                       |
| `StepList`      | `steps: { title, text }[]`                                                      | Lista ordenada (`<ol>`), número em `numero` dentro de círculo `grass-soft`.                                                                                                                                                                                                                                                        |
| `ShieldGrid`    | `clubs: { id, shortName, color1, color2, abbreviation? }[]`, `size?`            | Escudo inline (SVG gerado no build, `role="img"` + `aria-label` com o nome) + nome em `caption`. Grade: 3 colunas a 360px, 4 a partir de 480px, 5 no desktop. Escudo decorativo no hero usa `aria-hidden`.                                                                                                                         |
| `StageStrip`    | `stages` (do leitor do roteiro)                                                 | Lista das etapas; atual com borda `grass` de 2px + StatusBadge.                                                                                                                                                                                                                                                                    |
| `StageTable`    | `stages`                                                                        | Tabela com primeira coluna fixa (`position: sticky`) e rolagem horizontal no celular.                                                                                                                                                                                                                                              |
| `PostCard`      | `post`                                                                          | Já existe inline na página inicial; extrair.                                                                                                                                                                                                                                                                                       |
| `MatchSample`   | `score`, `events: { minute, text }[]`                                           | Placar `placar-xl` + lista; estático.                                                                                                                                                                                                                                                                                              |
| `NewsSample`    | `outlet`, `headline`, `text`, `kind: 'news' \| 'social'`                        | Visual do componente `Noticia` do jogo, versão estática; marca "exemplo" em `caption`.                                                                                                                                                                                                                                             |
| `FanMeter`      | `value: number`, `label: string`                                                | Barra em `surface-2` com preenchimento; número e rótulo em texto.                                                                                                                                                                                                                                                                  |
| `RhythmCompare` | `rows`                                                                          | Duas colunas no desktop, cards empilhados no celular.                                                                                                                                                                                                                                                                              |
| `FaqItem`       | `question`, slot                                                                | `<details>/<summary>`.                                                                                                                                                                                                                                                                                                             |
| `FinalCta`      | `primary`, `secondary?`                                                         | Bloco centralizado com um Botão primário e um link secundário.                                                                                                                                                                                                                                                                     |
| `Button`        | `href`, `variant: 'primary' \| 'secondary'`                                     | Versão de site do `Botao`: `botao`, `radius-pill`, altura ≥ 44px (`--touch`); primário `grass`/`on-grass`; secundário contorno `line` e texto `ink`.                                                                                                                                                                               |

Escudos no build: `shield.ts` importa `@engine/rng`; o `developer` precisa expor esse alias no Vite do Astro (ou equivalente) e gerar o SVG no frontmatter, sem enviar JS ao navegador. O contorno do escudo usa `var(--ink)`, que já está disponível porque o site importa `tokens.css`.

## Acessibilidade

- **Contraste** ≥ 4,5:1 para texto em todos os pares usados (os pares do StatusBadge acima já são pares declarados nos tokens; o `npm run tokens` confere). Texto sobre `grass` só em `on-grass`; sobre `floodlight`, só em `on-floodlight`. Links em `info` com sublinhado (não só cor).
- **Alvos** ≥ 44px em todo link e botão de navegação, rodapé, sumário e FAQ; espaço de pelo menos 8px entre alvos vizinhos.
- **Estado nunca só por cor**: StatusBadge com texto e ícone; o atual do menu e da StageStrip com marcador de forma; termômetro com número e rótulo.
- **Movimento**: o site não tem animação automática. Transições curtas (≤ 150ms) só em hover/foco/abrir menu, desligadas em `@media (prefers-reduced-motion: reduce)`; nada de rolagem suave nesse caso.
- **Foco**: anel de 2px sólido em `focus`, `outline-offset: 2px`, em todo elemento interativo; nunca `outline: none` sem substituto.
- **Semântica**: um `h1` por página, hierarquia sem saltos, `lang="pt-BR"`, `<nav aria-label="Principal">`, landmarks (`header`, `main`, `footer`); SVGs decorativos com `aria-hidden="true"`; diagramas táticos com `<title>` e legenda em texto.
- **Zoom e largura**: legível a 360px e com zoom de 200% sem rolagem horizontal (exceto a StageTable, que rola dentro do próprio contêiner).
- **Sem JavaScript**: tudo funciona sem JS (menu e FAQ em `<details>`).

## SEO básico

O layout `Base.astro` já aceita `title` e `description`; acrescentar:

- `<link rel="canonical">` com `https://${config.domain}` + rota.
- Open Graph: `og:title`, `og:description`, `og:type` (`website`; `article` nos posts), `og:url`, `og:locale` = `pt_BR`, `og:site_name` = `config.name`, `og:image` (ver abaixo); `twitter:card` = `summary_large_image`.
- `og:image`: imagem padrão 1200×630 gerada por script a partir do logo, do nome e de uma fileira de escudos fictícios (sem captura); até existir, omitir a tag em vez de apontar para algo quebrado.
- Título no formato "Página · Nome" (já é assim); descrição de 120 a 160 caracteres, escrita pelo `tech-writer`.

| Página    | Título (base)           | Descrição (tema; texto final do `tech-writer`)             |
| --------- | ----------------------- | ---------------------------------------------------------- |
| Início    | `config.name` (sozinho) | slogan de `config.slogan['pt-BR']`                         |
| O jogo    | O jogo                  | temporada, tática em três ajustes, partida minuto a minuto |
| Modos     | Modos de jogo           | carreira offline, liga com amigos, os dois ritmos          |
| Clubes    | Clubes                  | clubes fictícios em trocadilho e escudos gerados           |
| Perguntas | Perguntas frequentes    | preço, celular, privacidade, online                        |

Também: `sitemap.xml` via `@astrojs/sitemap` (dependência aprovada pelo CEO em 2026-11-04) e `robots.txt` simples apontando para ele.

## Privacidade e terceiros

- Sem cookies, sem `localStorage` no site, sem analytics com identificação, sem pixels nem incorporações (vídeo, mapas, redes sociais).
- Nenhuma chamada a terceiros: fontes por `@fontsource` (já é assim), ícones como SVG inline no repositório, nada de CDN.
- Se um dia houver contagem de visitas, só agregada e sem identificação, com ADR e revisão do `security-auditor`.

## Tokens e tema

Decisões do CEO em 2026-11-04:

1. **Tema `dia` no site**: segue `prefers-color-scheme: light`; quem prefere escuro (ou não declara preferência) fica no `noite`, que continua padrão. Todas as páginas são conferidas nos dois temas (contraste ≥ 4,5:1).
2. **Grupo `layout` em `design/tokens.json`**: `content-max` = 720px (coluna de leitura) e `wide-max` = 1040px (grades de recursos e escudos). Viram `--layout-content-max` e `--layout-wide-max` em `tokens.css`.
3. **`@astrojs/sitemap`** como dependência do site.

Nenhum outro token novo: os pares de cor do StatusBadge, cards, botões e tabela já existem.

## Pedido ao `developer`

1. **Tokens**: acrescentar o grupo `layout` (`content-max: 720px`, `wide-max: 1040px`) em `design/tokens.json`, ajustar `scripts/tokens-to-css.mjs` se ele não emitir grupos novos, e rodar `npm run tokens`; nunca editar `app/src/tokens.css` à mão. Trocar os `720px` literais do `Base.astro` por `var(--layout-content-max)`.
2. **Tema `dia`**: no site, aplicar `data-theme="dia"` quando `prefers-color-scheme: light` (sem script: via `@media` sobre os tokens do tema `dia`, ou o mecanismo que o `tokens.css` já oferecer); `theme-color` com uma `<meta>` por esquema.
3. **Escudos**: expor o alias `@engine` (para `app/src/engine/`) no Vite do Astro, para que `app/src/lib/generators/shield.ts` rode no build; SVG gerado no frontmatter, sem JS no navegador.
4. **Tipografia**: trocar os tamanhos fixos de `h1`, `h2` e `h3` do `Base.astro` (40, 28 e 20px) pelos estilos de texto (`display-xl`, `titulo`, `subtitulo`).
5. **Sitemap**: instalar `@astrojs/sitemap`, ligar no `astro.config` (usa o `site` já derivado de `config.domain`) e criar `robots.txt`.
6. **Discussions**: o link do canal de Discussions (rodapé e "Não achou?" das Perguntas) vem de um campo novo de link em `config/prancheta.config.ts` (sugestão: `contacts.discussionsUrl`, vazio até existir); com o campo vazio, o link não aparece. Mexer em `config/` é caminho `/feature`.
