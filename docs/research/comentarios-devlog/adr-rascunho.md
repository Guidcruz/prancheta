# ADR-0020: Comentários no devlog com servidor próprio e moderação prévia

> **Rascunho guardado (2026-11-06).** Estudo parado pelo CEO; nada foi decidido nem implementado. Os números (ADR-0020, US-075 a US-083, T-072 a T-083) são provisórios e não reservados. Veja o `README.md` desta pasta.

- **Status:** proposta (rascunho do `architect`, 2026-11-06, fora do repositório; aguarda a revisão do `security-auditor` e a decisão do CEO)
- **Data:** 2026-11-06
- **Decisores:** architect (propôs), product-manager (histórias US-075 a US-083, no rascunho `historia.md`), security-auditor (revisa), CEO (aprova)
- **Relaciona:** ADR-0002 (hospedagem), ADR-0003 (online na 1b), ADR-0008 (dados mínimos), ADR-0010 (topologia; este ADR antecipa a T-050 e parte da T-051), ADR-0015 (nada de publicidade nem de contagem)

## Contexto

O CEO pediu (2026-11-06) que quem acompanha o projeto possa comentar nos posts do devlog sem se identificar, com um apelido ou com o nome. O site (`site/`, Astro 7) é estático no Cloudflare Pages. Hoje ele não tem nenhum `<script>`, cookie, armazenamento local nem chamada a terceiros, e o `site/src/lib/dist.test.ts` trava isso. O servidor da 1b (Hono em Workers, D1) ainda não existe.

Seis restrições pesam na escolha:

1. **Custo zero** até o online, só na Cloudflare, e portável para uma VPS (ADR-0002).
2. **Nenhum script nem cookie de terceiros** no site.
3. **Nenhum dado pessoal novo** sem ADR e revisão do `security-auditor` (LGPD).
4. **ECA Digital:** menores acessam o site, então só aparece comentário moderado antes.
5. O `CLAUDE.md` proíbe "chat de texto livre" e nomes reais "no jogo, código, dados e site". Comentário é texto livre de terceiros publicado no site, então a regra precisa de uma exceção explícita e delimitada.
6. A história do `product-manager` acrescenta exigências de produto:
   - envio e leitura funcionando **sem JavaScript**;
   - aprovado visível **em até 5 minutos, sem build nem merge**;
   - chave geral que desliga tudo sem publicar o site de novo;
   - pedido de remoção;
   - nenhum vínculo entre o comentário e o IP.

## Opções consideradas

| Opção                                                                    | Prós                                                                                                              | Contras                                                                                                                                                                                                                               |
| ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: Giscus (GitHub Discussions dentro do post)                            | pronto; custo zero; a moderação usa as ferramentas do GitHub                                                      | exige conta no GitHub (13+), sem anonimato; o comentário publica na hora, sem moderação prévia; script e iframe de `giscus.app`; não funciona sem JavaScript                                                                          |
| B: serviço de terceiros (Disqus; Cusdis hospedado)                       | pronto; o Cusdis tem aprovação prévia e apelido sem e-mail                                                        | script e iframe de terceiros; dados num fornecedor externo (transferência internacional na LGPD); o Disqus grátis tem anúncio e cookies de rastreamento; o Cusdis grátis limita a 100 aprovados por mês; nada funciona sem JavaScript |
| C: servidor próprio (Hono + D1) em Pages Functions, com moderação prévia | atende todas as restrições; dados mínimos e nossos; funciona sem JavaScript; antecipa peças que a 1b vai precisar | maior esforço (G no total, em PRs P e M); primeira peça de servidor do projeto; a página do post passa a usar a cota das Functions                                                                                                    |
| D: sem comentários, só o link para as Discussões do GitHub               | zero esforço, zero dado; o rodapé já tem o link                                                                   | não atende o pedido: exige conta, não tem anonimato e fica fora do post                                                                                                                                                               |

### Comparação detalhada

| Critério                           | A: Giscus                                                                                       | B: Disqus / Cusdis hospedado                                                                                             | C: servidor próprio                                                                                                                                                          | D: link para as Discussões              |
| ---------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------- |
| **Anonimato e apelido**            | não: conta do GitHub, com o login dela                                                          | Disqus: convidado com nome e, em geral, e-mail (a confirmar). Cusdis: apelido, e-mail opcional                           | sim: apelido opcional, que pode ser o primeiro nome; vazio vira "Anônimo"                                                                                                    | não: conta do GitHub                    |
| **Dados guardados**                | no GitHub: conta, texto e reações, públicos                                                     | no fornecedor: texto, apelido, e-mail se dado, IP e sinais do navegador (política dele)                                  | no nosso D1: texto, apelido, data e post. O IP nunca é gravado; o limite de envios guarda um HMAC do IP com chave diária, por até 24 h, sem ligação com o comentário         | no GitHub, fora do site                 |
| **Scripts e cookies de terceiros** | script e iframe de `giscus.app`; sessão no `localStorage` do iframe; cookies do GitHub no login | Disqus: vários cookies de rastreamento e anúncio. Cusdis: script e iframe de `cusdis.com`                                | nenhum. O Turnstile, se o CEO ligar um dia, é o único terceiro e só carrega no formulário                                                                                    | nenhum no site                          |
| **Custo**                          | zero                                                                                            | Disqus: zero com anúncio, pago sem. Cusdis grátis: 1 site, 100 aprovados e 10 "aprovações rápidas" por mês; o Pro é pago | zero no volume esperado (tabela abaixo)                                                                                                                                      | zero                                    |
| **Moderação**                      | depois de publicado: esconder, apagar e trancar no GitHub                                       | Disqus e Cusdis permitem aprovação prévia; o Cusdis manda e-mail com link de aprovação                                   | prévia; fila do CEO no celular com filtros automáticos, sinalizações, expiração em 30 dias e teto de 200                                                                     | a do GitHub, depois de publicado        |
| **Esforço**                        | P                                                                                               | P                                                                                                                        | G no total, em 9 PRs de tamanho P ou M                                                                                                                                       | P (`/quick`)                            |
| **Sem JavaScript**                 | não aparece nada                                                                                | não aparece nada                                                                                                         | ler e enviar funcionam (formulário HTML comum)                                                                                                                               | funciona (é um link)                    |
| **Encaixe com o site estático**    | o Astro continua estático; tudo vem no navegador, pelo iframe                                   | o Astro continua estático; tudo vem no navegador, pelo iframe                                                            | o Astro continua estático (`output: 'static'`); uma Pages Function pega o HTML pronto do post e insere os aprovados na resposta; nada entra no build além de um `posts.json` | o Astro continua estático; nada muda    |
| **ECA Digital (só moderado)**      | **falha**                                                                                       | Disqus passa com anúncio para menor (contra o ADR-0015); Cusdis passa                                                    | passa                                                                                                                                                                        | fora do site (é a plataforma do GitHub) |

Instâncias próprias de Cusdis, Remark42 ou Isso foram descartadas: elas pedem um processo Node ou Go com disco persistente, o que significa VPS e custo.

### Custo da opção C no plano gratuito

As fontes estão no fim. Os números vêm dos resumos das páginas oficiais da Cloudflare: nesta sessão, `developers.cloudflare.com` não abriu direto, então a T-073 confere tudo no painel antes de ativar.

| Recurso                                 | Limite gratuito                                                                         | Uso estimado (500 visitas a posts e 10 comentários por dia)                                                          | Folga             |
| --------------------------------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------- | ----------------- |
| Workers / Pages Functions               | 100.000 requisições por dia; 10 ms de CPU por invocação                                 | cerca de 550 requisições por dia (páginas de post, envios, fila); CPU de 1 a 3 ms (HTMLRewriter, HMAC, uma consulta) | cerca de 0,5%     |
| D1, linhas lidas                        | 5 milhões por dia                                                                       | cerca de 15 mil (aprovados do post, ajustes, fila)                                                                   | cerca de 0,3%     |
| D1, linhas gravadas                     | 100.000 por dia (cada índice conta uma linha a mais)                                    | cerca de 200 (envio, limite, contadores, limpeza)                                                                    | cerca de 0,2%     |
| D1, armazenamento                       | 5 GB                                                                                    | 1.000 comentários de cerca de 1 KB dão 1 MB                                                                          | sobra             |
| Cron Trigger (Worker de moderação)      | incluído no gratuito                                                                    | 1 por hora                                                                                                           | —                 |
| Cloudflare Access (Zero Trust Free)     | até 50 usuários                                                                         | 1 (o CEO)                                                                                                            | —                 |
| Turnstile (se for ligado)               | grátis, até 20 widgets; o teto de verificações não ficou claro nas fontes               | 1 widget                                                                                                             | conferir na T-073 |
| ntfy.sh (aviso; ver "Aviso no celular") | grátis com limite por remetente (cerca de 250 mensagens por dia, número de segunda mão) | no máximo 4 por dia                                                                                                  | sobra             |

**Atenção:** as cotas de Workers e D1 são da conta e serão divididas com a liga online da 1b. Um ataque de robôs com dezenas de milhares de envios por dia gastaria cota da liga. O Turnstile não evita isso, porque a requisição chega à Function antes da verificação. A mitigação está em "Riscos".

## Decisão

**Opção C**, em trilha paralela do site. Até ela ser ativada, a **D** entra já: o link "Comente nas Discussões" no fim de cada post (P, `/quick`).

O desenho abaixo diverge do pedido em três pontos, de propósito:

1. **Os aprovados não são buscados no navegador.** Uma Pages Function insere os aprovados no HTML do post. Assim a leitura e o envio funcionam sem JavaScript, o site continua sem nenhum `<script>`, e o aprovado aparece sem build.
2. **O Turnstile fica pronto, mas desligado no lançamento.** Concordo com o `product-manager` (D1): ele é script de terceiro e impede o envio sem JavaScript. Com moderação prévia, o spam só pesa na fila.
3. **A moderação mora num Worker separado no `workers.dev`, protegido pelo Cloudflare Access.** O caso bem suportado do Access é proteger um host inteiro. Proteger só um caminho dentro do `pages.dev` não está confirmado. O host separado também segue o `docs/PROJETO.md`, que pede o admin num subdomínio próprio, com Access e segundo fator.

### Princípios

- **Exceção delimitada à regra do texto livre:**
  - vale só para os comentários dos posts do devlog no site;
  - o comentário só aparece depois da aprovação humana;
  - não há resposta, menção, link, perfil nem contato entre usuários;
  - o jogo (`/jogo`) continua sem nenhum texto livre.
- **Regra dos nomes reais:** um comentário com nome real de clube, jogador ou pessoa **não é aprovado** (recomendação; decisão D3 do PM). Com isso, a regra do `CLAUDE.md` continua absoluta para tudo o que o site publica.
- **Todo texto fixo fica no Astro**, em pt-BR, como o resto do site. O servidor só faz três coisas:
  - mostra ou esconde blocos marcados com `data-*` no HTML estático;
  - preenche valores;
  - insere o conteúdo do usuário, sempre escapado.

  Os rótulos de cada comentário ("Anônimo", "Pedir remoção") são lidos de atributos `data-label-*` do próprio bloco.

- **O moderador não edita** o texto (D4). Recusar apaga na hora (D5).

### Fluxo

1. **Ler.**
   1. O leitor abre `/devlog/<id>/`.
   2. A Function do post chama `context.next()` para pegar o HTML estático gerado pelo Astro.
   3. Ela lê do D1 os aprovados do post, a chave geral e se o post está fechado.
   4. Com o `HTMLRewriter`, preenche o bloco `<section id="comentarios" data-post="<id>">`: a lista, a contagem, o formulário ou o aviso de "fechado", e um token de formulário assinado.
   5. Se o D1 falhar, a resposta é o HTML estático com o aviso "os comentários não puderam ser carregados agora", que já vem escrito no bloco. O post sempre aparece.
2. **Enviar.**
   1. O formulário é HTML comum: `POST /devlog/<id>/`.
   2. A Function confere, na ordem: campo-isca, token assinado (tempo mínimo e máximo), filtros, limite de envios e teto da fila. O Turnstile entra aqui só se for ligado.
   3. Grava o comentário como `pending` e responde `303` para `/devlog/<id>/?comentario=recebido#comentarios`. O padrão POST-redirect-GET evita envio duplicado.
   4. Em erro de validação, responde `422` com a própria página: o formulário volta preenchido e com a mensagem.
3. **Moderar.** O Worker `prancheta-admin` mostra a fila em HTML, com formulários. O CEO aprova, recusa ou apaga. Depois de aprovar, o próximo carregamento do post já mostra o comentário.
4. **Avisar.** Um Cron Trigger de hora em hora no `prancheta-admin` faz duas coisas:
   - limpa o que venceu;
   - manda o aviso ao celular, quando há fila, com no máximo um aviso a cada 6 horas.

### Onde fica o código

O código fica em `server/` e nos adaptadores da raiz, e não em `site/functions/`. As Pages Functions precisam estar em `functions/` na raiz do projeto do Pages, que é `/` (`docs/04-deploy.md`). Isso segue o ADR-0010: a lógica fica em `server/src/`, sem Cloudflare, e os adaptadores são finos.

```
server/                              workspace npm novo (antecipa a T-050)
  migrations/0001_comments.sql       tabelas abaixo (as da 1b viram a 0002)
  src/config.ts                      limites com padrão (D12 do PM), sobrescritos por variável
  src/db/                            interface Db; D1Db; SqliteDb (node:sqlite, PRAGMA foreign_keys=ON); SQL só aqui
  src/filter/                        normalização, links, e-mails, telefones, sinalizações (base da T-052)
  src/comments/                      domínio: submit, listForPost, requestRemoval, approve, reject,
                                     remove, closePost, setEnabled, expire, stats; rateLimit; formToken
  src/comments/page.ts               "o que injetar": modelo de visão + HTML escapado (puro)
  src/admin/app.ts                   Hono da moderação (HTML com o helper `html`, que escapa)
  src/ports.ts                       Clock, Secrets, HumanCheck, Notifier, AdminAuth, PostCatalog
  src/platform/cloudflare/           D1Db, AccessJwtAuth, TurnstileCheck, NtfyNotifier/EmailNotifier
  wrangler.admin.toml                Worker prancheta-admin: D1 DB, cron "0 * * * *", preview_urls = false
  src/admin/worker.ts                entrada do Worker de moderação (fetch + scheduled)
functions/devlog/[id]/index.ts       adaptador do Pages: GET (reescreve o HTML) e POST (envio)
functions/devlog/[id]/remocao.ts     adaptador do Pages: POST do pedido de remoção
wrangler.toml                        configuração do Pages: pages_build_output_dir = "dist"; D1 DB em produção e prévia
site/src/components/Comments.astro   bloco com textos, formulário, mensagens escondidas e rótulos em data-*
site/src/pages/devlog/posts.json.ts  /devlog/posts.json: [{ id, title, date, comments }] (contrato com o servidor)
site/src/content.config.ts           campo novo `comments: boolean` (padrão true), para fechar um post no frontmatter
site/public/_headers                 CSP e cabeçalhos (fecha a dívida L2)
site/public/_routes.json             Functions só nas páginas de post; fora RSS, imagens e índice
```

Fronteiras novas, que o `architect` registra em `docs/02-architecture.md` §5:

- `site/**` não importa nada de `server/`. O contrato entre os dois é só HTML (`id="comentarios"` e os `data-*`) e o `/devlog/posts.json`.
- `server/**` pode ler do app, além do que já é permitido, os arquivos de hash da lista bloqueada (`app/src/data/*blocklist*.sha256.json`), para as sinalizações.
- `functions/**` só importa de `server/src/`.

**Encaixe com a 1b.**

- A 1b acrescenta `functions/api/[[route]].ts` com a API do jogo (ADR-0010, §4.3), no mesmo `wrangler.toml` e no mesmo D1 `prancheta`.
- O Worker de salas usa o mesmo job de deploy criado aqui.
- A T-050 fica só com as tabelas e rotas da 1b. A T-051 fica com o adaptador `/api` e o Worker de salas: o `_headers`, o `wrangler.toml` do Pages e o job já existem.
- Comentários e liga ficam no mesmo banco. Separar não isolaria nada, porque as cotas do D1 são da conta.

**Portabilidade.**

- O `HTMLRewriter` é da Cloudflare. Numa VPS, o adaptador usa o mesmo motor, o lol-html, compilado para WebAssembly. A decisão sobre o que injetar já mora em `server/src/comments/page.ts` e não depende dele.
- O Access vira um proxy de autenticação qualquer, porque a `AdminAuth` é uma interface.

### Rotas

São rotas de página e não da API do jogo: não usam `X-Prancheta-Protocol`, porque site e Functions saem no mesmo deploy. Os códigos de erro são estáveis, em `snake_case`, e o Astro tem um bloco de mensagem em pt-BR para cada um.

| Método e rota                             | Entrada                                                                                                                           | Resposta                                                                                                                                                         | Erros (código → HTTP)                                                                                                                                                                                                                                                                                  |
| ----------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `GET /devlog/:id/`                        | `?comentario=recebido`, `?remocao=recebida` e `?remover=<commentId>` mostram a confirmação ou o formulário de remoção             | `200`, HTML do post com os aprovados (mais antigo primeiro), a contagem (sem "0"), o formulário com `formToken` ou o aviso de fechado; `Cache-Control: no-cache` | id fora do `posts.json` → passa adiante (`next()`), sem tocar no D1                                                                                                                                                                                                                                    |
| `POST /devlog/:id/`                       | formulário: `nickname?`, `body`, `formToken`, `website` (campo-isca, deve vir vazio) e `cf-turnstile-response` (só com Turnstile) | `303` → `?comentario=recebido#comentarios`. Campo-isca preenchido ou envio rápido demais: a mesma `303`, sem gravar                                              | `422`: `body_too_short`, `body_too_long`, `nickname_too_long`, `nickname_reserved`, `has_link`, `has_contact`, `form_expired`. `403`: `human_check_failed`. `409`: `comments_closed`. `429`: `rate_limited`. `503`: `queue_full`, `comments_unavailable`. Todos devolvem a página com o texto digitado |
| `POST /devlog/:id/remocao`                | `commentId`, `reason` (`personal_data`, `minor`, `offense`, `real_name`, `spam`), `formToken`                                     | `303` → `?remocao=recebida#comentarios`, também quando o pedido repete um que já existe                                                                          | `422`: `unknown_reason`. `404`: `comment_not_found`. `429`: `rate_limited`                                                                                                                                                                                                                             |
| `GET /` (admin)                           | —                                                                                                                                 | fila: `pending` e `hidden`, mais antigo primeiro, com post, apelido, data, texto, sinalizações e pedidos de remoção; contadores da semana (US-083)               | sem JWT válido do Access → `403`, sem nenhum dado                                                                                                                                                                                                                                                      |
| `POST /comments/:id/approve` (admin)      | —                                                                                                                                 | `303` → fila; `status = 'published'`, pedidos de remoção limpos                                                                                                  | `404`: `comment_not_found`                                                                                                                                                                                                                                                                             |
| `POST /comments/:id/reject` (admin)       | `reason` (lista do PM, seção 3)                                                                                                   | `303`; o comentário é apagado na hora e só o contador sobe                                                                                                       | `404`, `422`                                                                                                                                                                                                                                                                                           |
| `POST /comments/:id/remove` (admin)       | `reason`                                                                                                                          | `303`; apaga um publicado                                                                                                                                        | `404`, `422`                                                                                                                                                                                                                                                                                           |
| `GET /published?post=<id>` (admin)        | —                                                                                                                                 | publicados do post, com "Apagar"                                                                                                                                 | —                                                                                                                                                                                                                                                                                                      |
| `POST /posts/:id/close` · `/open` (admin) | —                                                                                                                                 | `303`; grava em `post_settings`                                                                                                                                  | —                                                                                                                                                                                                                                                                                                      |
| `POST /settings/comments` (admin)         | `enabled=0/1`                                                                                                                     | `303`; chave geral em `site_settings`, vale no próximo carregamento sem build                                                                                    | —                                                                                                                                                                                                                                                                                                      |

**`formToken`:**

- Formato: `<emitidoEm>.<HMAC-SHA256(FORM_TOKEN_SECRET, postId | emitidoEm)>`. É injetado no GET e não é gravado em lugar nenhum.
- O POST exige `agora − emitidoEm ≥ 3 s` (`comments.minFillSeconds`) e `≤ 2 h`.
- Funciona sem JavaScript, porque a página já passa pela Function.

**Pedido de remoção (US-081):**

- `personal_data` e `minor` mudam o comentário para `hidden` na hora, e ele volta para a fila.
- Os outros motivos só sinalizam, para análise em até 48 h.
- Se o CEO aprovar de novo, os pedidos daquele comentário são limpos.

**Ordem do envio.** Nada toca o D1 antes da última verificação barata:

1. campo-isca;
2. token;
3. tamanho e filtros;
4. `HumanCheck`;
5. limite de envios;
6. teto da fila;
7. `INSERT`.

### Modelo de dados e retenção (`server/migrations/0001_comments.sql`)

```sql
CREATE TABLE comments (
  id           TEXT PRIMARY KEY,               -- 128 bits aleatórios, base32
  post_id      TEXT NOT NULL,                  -- id da coleção devlog do Astro
  nickname     TEXT,                           -- NULL = "Anônimo"; até 24 caracteres, normalizado
  body         TEXT NOT NULL,                  -- 3 a 800 caracteres, texto puro, NFC
  status       TEXT NOT NULL CHECK (status IN ('pending', 'published', 'hidden')),
  flags        TEXT NOT NULL DEFAULT '',       -- real_name, profanity, personal_data, full_name (só para o moderador)
  created_at   INTEGER NOT NULL,               -- segundos UTC
  published_at INTEGER
);
CREATE INDEX comments_by_post ON comments (post_id, status, created_at);
CREATE INDEX comments_queue   ON comments (status, created_at);

CREATE TABLE comment_reports (
  comment_id TEXT NOT NULL REFERENCES comments (id) ON DELETE CASCADE,
  reason     TEXT NOT NULL CHECK (reason IN ('personal_data', 'minor', 'offense', 'real_name', 'spam')),
  created_at INTEGER NOT NULL,
  PRIMARY KEY (comment_id, reason)               -- pedido repetido não cria outro registro
);

CREATE TABLE post_settings (post_id TEXT PRIMARY KEY, closed INTEGER NOT NULL DEFAULT 0);
CREATE TABLE site_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL);  -- comments_enabled, last_notice_at

CREATE TABLE rate_salts (day TEXT PRIMARY KEY, salt BLOB NOT NULL);       -- 32 bytes aleatórios por dia UTC
CREATE TABLE rate_hits (
  key_hash     TEXT NOT NULL,                  -- ver "Limite de envios"
  bucket       TEXT NOT NULL CHECK (bucket IN ('burst', 'day', 'report')),
  window_start INTEGER NOT NULL,
  count        INTEGER NOT NULL,
  PRIMARY KEY (key_hash, bucket, window_start)
);

CREATE TABLE moderation_stats (                -- US-083: só agregados
  week TEXT NOT NULL, event TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', count INTEGER NOT NULL,
  PRIMARY KEY (week, event, reason)
);
CREATE TABLE moderation_durations (week TEXT NOT NULL, seconds INTEGER NOT NULL);  -- sem id e sem ligação
```

| Dado                                        | Pessoa?                                                | Retenção                                                                                                       |
| ------------------------------------------- | ------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------- |
| `comments` pendente                         | apelido e texto (podem ter dado pessoal até a revisão) | até a decisão; apagado em 30 dias (`expired`)                                                                  |
| `comments` recusado                         | —                                                      | não existe: o `DELETE` é imediato e só sobe o contador                                                         |
| `comments` publicado                        | apelido e texto, públicos                              | até o CEO apagar, um pedido de remoção ser aceito ou o post sair do ar                                         |
| `comment_reports`                           | não (sem IP nem texto livre)                           | até a decisão; some junto com o comentário                                                                     |
| `rate_hits` e `rate_salts`                  | HMAC do IP, que é pseudônimo                           | até 24 h; a limpeza de hora em hora apaga as linhas com `window_start` de mais de 24 h e o sal do dia anterior |
| `moderation_stats` e `moderation_durations` | não                                                    | 26 semanas                                                                                                     |
| Time Travel do D1 (cópia automática)        | tudo o que estava no banco                             | 7 a 30 dias, conforme o plano (a confirmar na T-073); a política de privacidade cita o prazo maior             |

Não se grava IP, user-agent, e-mail, idade, cookie nem identificador de aparelho. O teste de esquema conta `nickname`, `body` e `key_hash` como as únicas colunas "pessoa", estendendo a regra da US-064 da §4.5.

### Limite de envios com IP embaralhado

- **Chave:**

  ```
  key_hash = HMAC-SHA256(HMAC-SHA256(RATE_PEPPER, sal_do_dia), ip)
  ```

  - O resultado é truncado em 16 bytes.
  - `ip` é o `CF-Connecting-IP`. No IPv6, entra só o prefixo /64, porque trocar de endereço dentro do /64 é trivial.
  - O sal é aleatório, criado no primeiro uso do dia com `INSERT OR IGNORE` e apagado no dia seguinte.
  - O `RATE_PEPPER` é segredo do Pages. Quem obtiver só o banco não consegue testar os 2³² IPv4. Depois que o sal é apagado, nem nós ligamos o hash a um IP.

- **Janelas** (`server/src/config.ts`, D12): `burst` 3 envios por 10 min; `day` 10 por dia UTC; `report` 5 pedidos por dia.
- **Sem ligação:** `rate_hits` não tem `comment_id`, e `comments` não tem `key_hash`.
- **Depois do domínio próprio:** a regra de rate limiting do WAF no plano gratuito pode substituir a tabela, sem gravarmos nada (pedido da US-082). No `pages.dev` ela não existe.

### Proteção contra robôs: Turnstile como segundo degrau

`HumanCheck` é uma interface com duas implementações: `none` (lançamento) e `turnstile`. A escolha vem da configuração `COMMENTS_HUMAN_CHECK`. Se o CEO ligar o Turnstile:

- O widget entra só no formulário. A página carrega `https://challenges.cloudflare.com/turnstile/v0/api.js`, e o CSP das páginas de post ganha `script-src` e `frame-src` para esse host.
- O servidor chama o `siteverify` com `secret` e `response`, sem `remoteip` (minimização), e confere `success`, `hostname` e `action = 'comment'`.
- O token vale uma única vez.
- O envio sem JavaScript deixa de funcionar.
- Ligar exige atualizar a política de privacidade (link para o aditivo de privacidade do Turnstile) e o `dist.test.ts`.

Gatilho sugerido pelo PM: mais de uns 20 spams por dia na fila durante uma semana.

### Moderação: página do CEO e autenticação

- **Onde:** Worker `prancheta-admin` em `prancheta-admin.<conta>.workers.dev`, com o mesmo D1 `DB`. Quando houver domínio próprio, ele vai para `admin.<domínio>`, como no `docs/PROJETO.md`.
- **Access (recomendado):**
  - aplicação do Zero Trust Free cobrindo o host inteiro;
  - login pelo GitHub do CEO, que já tem segundo fator, ou por PIN enviado ao e-mail;
  - política "e-mail = o do CEO";
  - URLs de prévia do Worker desligadas (`preview_urls = false`), para nada escapar do Access.
- **Conferência no servidor:** o Worker não confia só na presença do cabeçalho. A `AccessJwtAuth` valida o `Cf-Access-Jwt-Assertion`:
  - RS256 pelas chaves de `https://<time>.cloudflareaccess.com/cdn-cgi/access/certs`, guardadas em memória;
  - `aud` igual a `ACCESS_AUD`;
  - `iss` do time;
  - `exp`;
  - `email` igual a `MODERATOR_EMAIL`.

  Pode usar o `hono/jwk`, que já vem no Hono, ou o `jose`.

- **CSRF:** todo `POST` exige `Origin` igual à origem do admin e `Sec-Fetch-Site: same-origin`. O cookie do Access é do host do admin e não vai em `POST` de outro site.
- **Página:**
  - HTML sem script, alvos de 44 px, pensada para o celular;
  - o CSS é servido pelo próprio Worker;
  - CSP `default-src 'none'; style-src 'self'; form-action 'self'; frame-ancestors 'none'`;
  - `X-Robots-Tag: noindex`;
  - todo conteúdo do usuário passa pelo `html` do Hono, que escapa.
- **Planos B**, se a T-073 mostrar que o Access no `workers.dev` não funciona:
  1. Access num caminho `/admin` do `pages.dev`, com as mesmas rotas montadas por um terceiro adaptador `functions/admin/[[route]].ts`.
  2. Basic Auth com um segredo aleatório de 32 bytes, guardado no gerenciador de senhas do CEO, com bloqueio depois de 5 falhas por hora. Esse não tem segundo fator, então o CEO precisa aceitar a perda.

### Aviso no celular

- **Quem dispara:** o `scheduled()` do `prancheta-admin`, de hora em hora.
- **Regra:** se `pendentes + escondidos > 0` e `agora − last_notice_at ≥ 6 h` (`comments.notifyMinHours`), envia e grava `last_notice_at`.
- **O que vai:** só "Prancheta: N comentários esperando moderação" e o link da fila. Nunca texto, apelido nem título de post (US-080).
- **Canal** (interface `Notifier`):
  - **Agora:** ntfy.sh, com um tópico aleatório de 32 caracteres como segredo (`NTFY_TOPIC`). O CEO assina o tópico no app do ntfy no celular. O terceiro recebe só a contagem, a partir do IP da Cloudflare, sem dado de leitor.
  - **Com domínio próprio na Cloudflare:** e-mail pelo `send_email` do Email Routing, para o endereço verificado do CEO, sem terceiro novo (recomendação do PM, D8). Não dá para usar hoje: o Email Routing exige uma zona própria.
- **No mesmo cron:** a limpeza (pendentes de mais de 30 dias, `rate_hits` e sais com mais de 24 h, contadores com mais de 26 semanas).

### Segurança da página

- `site/public/_headers`, para todo o site:
  - `Content-Security-Policy: default-src 'self'; img-src 'self' data: blob:; connect-src 'self'; form-action 'self'; frame-ancestors 'none'; base-uri 'none'`;
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` e `Permissions-Policy` mínima.

  Isso fecha a L2 de `docs/status.md`. A Function do post repete os mesmos cabeçalhos na resposta que ela monta, a partir de uma constante única em `server/src/`. Assim não depende de o `_headers` valer para respostas de Function.

- `site/public/_routes.json`:
  - `include: ["/devlog/*"]`;
  - `exclude`: `/devlog/`, `/devlog/rss.xml`, `/devlog/posts.json` e as imagens de `site/public/devlog/<data>/` (`/devlog/*.png`, `*.jpg`, `*.webp`, `*.svg`).

  Sem isso, cada imagem do devlog vira uma invocação de Function.

### Configuração e segredos

- **Limites** em `server/src/config.ts`, com os valores padrão da D12 do PM (texto 3 a 800, apelido até 24, 3 por 10 min e 10 por dia, teto de 200, 3 s, 90 dias, 30 dias, 6 h).
- **Variáveis do Cloudflare** sobrescrevem os limites, mas no Pages só valem no deploy seguinte. Por isso a chave geral e o fechar de um post ficam no D1, e não em variável.
- **Segredos do Pages:** `FORM_TOKEN_SECRET`, `RATE_PEPPER` e `TURNSTILE_SECRET` (só se for ligado).
- **Segredos do `prancheta-admin`:** `ACCESS_AUD`, `MODERATOR_EMAIL` e `NTFY_TOPIC`. `ACCESS_TEAM_DOMAIN` é variável comum.
- **Local:** `.dev.vars` (já no `.gitignore`), mais um `.dev.vars.example` com as chaves de teste do Turnstile.
- **Quem configura:** o CEO, no painel. O hook bloqueia `wrangler secret put` para os agentes.

### Erros e logs

- O serviço retorna resultados tipados com o código de erro e não lança por situação de uso. Erro de programação lança e é bug.
- Falha do D1 na leitura do post: a página aparece com o aviso, e o log registra `{ route, status, code: 'db_unavailable', ms }`.
- Tabela ausente (migração ainda não aplicada) dá o mesmo tratamento.
- Os logs nunca contêm IP, `key_hash`, apelido, texto nem e-mail do moderador. Só aparecem `postId`, rota, status, código e tempo.

## Consequências

- **Positivo:**
  - Atende o pedido e todas as restrições: anônimo, só moderado, sem terceiro, sem cookie, sem script, funcionando sem JavaScript, custo zero e dados nossos e mínimos.
  - O esqueleto do servidor, o `Db`, as migrações, o teste de esquema de privacidade, o `_headers` e o job de deploy de Worker ficam prontos e testados antes da 1b. Esse trabalho já estava previsto (T-050 e T-051).
- **Negativo:**
  - É o primeiro código de servidor, com mais peças para operar: um D1, um Worker com cron, o Access e os segredos.
  - As páginas de post passam a ser servidas por uma Function e gastam cota da conta.
  - Se as Functions falharem fechadas ao estourar a cota, o que a T-073 confere, um ataque pode derrubar os posts e a liga da 1b junto.
  - A regra de texto livre do `CLAUDE.md` ganha uma exceção.
  - O CEO vira moderador sozinho.
  - Com o Turnstile ligado, o envio sem JavaScript se perde.
- **Pendências:** as tarefas e as decisões abaixo; a atualização de `docs/02-architecture.md` (§2, §3, §4.5 e §5) e do `docs/04-deploy.md` quando este ADR for aceito; e, no `CLAUDE.md`, a linha "sem chat de texto livre", que passa a citar este ADR. O Orquestrador registra essa mudança depois do aceite do CEO.

### Riscos

| Risco                                                                   | Mitigação                                                                                                                                                                                              |
| ----------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Robôs gastando a cota da conta (compartilhada com a 1b)                 | as verificações sem banco vêm primeiro; limite por IP embaralhado; teto da fila; chave geral no D1; Turnstile como segundo degrau; regra do WAF quando houver domínio; alerta de uso no painel (T-073) |
| Functions falhando fechadas ao estourar a cota, levando os posts juntos | conferir o comportamento na T-073; se for "fechado", ainda assim aceitar (volume previsto em 0,5% da cota) e rever na 1b, quando o plano pago é o mais provável (decisão 5, §8)                        |
| Access no `workers.dev` sem suporte ou com prévias abertas              | conferência na T-073; `preview_urls = false`; JWT validado no servidor; planos B acima                                                                                                                 |
| Comentário com dado de menor publicado por engano                       | moderação prévia; pedido de remoção com motivo grave esconde na hora; recusa apaga de vez; cópia automática do D1 citada na política                                                                   |
| Lista de publicados apagada que volta numa restauração do Time Travel   | restauração só pelo CEO e só para desastre; depois de restaurar, reaplicar as remoções registradas nos contadores da semana (procedimento no `04-deploy.md`)                                           |

### Tarefas de implementação

A numeração é provisória; o Orquestrador confirma. Cada tarefa é um PR. Todas, menos a T-072, são `/feature`, porque tocam `server/`, `.github/` ou `config/`. A soma dá G. Cada PR é P ou M.

| #     | Tarefa                                                                                                                                                                                                                                                                                                                                                                                                            | Tamanho      | Depende de                                                 |
| ----- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------ | ---------------------------------------------------------- |
| T-072 | **Paliativo (opção D):** link "Comente nas Discussões (GitHub, público)" no fim de cada post. Sai quando a C for ativada                                                                                                                                                                                                                                                                                          | P (`/quick`) | —                                                          |
| T-073 | **Conferência no painel** (CEO com o `devops-engineer`, sem código): Access no `workers.dev` do admin; o que as Functions fazem ao estourar a cota; prazo do Time Travel no gratuito; limites atuais de Workers, D1 e Turnstile; alerta de uso. Registrar em `docs/04-deploy.md`                                                                                                                                  | P            | —                                                          |
| T-074 | **Esqueleto do servidor** (absorve a T-050 sem as tabelas da 1b): workspace `server/`; `Db`, `D1Db` e `SqliteDb`; executor de migrações nos testes; `0001_comments.sql`; teste de esquema com a lista de colunas permitidas; logs JSON sem PII; `config.ts`; lint de fronteira (com a exceção da lista bloqueada); `npm test` e `npm run lint` rodando o `server`; CI                                             | M            | —                                                          |
| T-075 | **Filtro de texto** (base da T-052): normalização (NFC, largura zero, bidi, homóglifos do P-09); recusa de link, e-mail e telefone; apelidos reservados; sinalizações (lista bloqueada em hash, palavrão, nome completo, dado pessoal)                                                                                                                                                                            | M            | T-074                                                      |
| T-076 | **Serviço, parte 1:** `submit` e `listForPost`, `formToken`, `HumanCheck` (`none` e `turnstile`), limite com sal diário e pepper, teto da fila, chave geral, post fechado (`posts.json` e `post_settings`), contadores de recebidos e barrados. Testes com `SqliteDb` e relógio falso                                                                                                                             | M            | T-075                                                      |
| T-077 | **Serviço, parte 2:** `requestRemoval` (motivos graves escondem), `approve`, `reject`, `remove`, `closePost`, `expire`, contadores e durações                                                                                                                                                                                                                                                                     | M            | T-076                                                      |
| T-078 | **Borda do Pages:** `wrangler.toml` (D1 de produção e de prévia), `_headers` (fecha a L2), `_routes.json`, `.dev.vars.example`, passo de CI "Functions compilam", job `deploy-server` (migrações do D1, com aprovação do CEO) e checagens novas do `dist/`                                                                                                                                                        | M            | T-074, T-073                                               |
| T-079 | **Página do post:** `functions/devlog/[id]/index.ts` e `remocao.ts` (HTMLRewriter, PRG, 422 com o texto de volta, fallback); `Comments.astro`, `posts.json.ts` e o campo `comments` no frontmatter; testes do adaptador no `workerd` (`@cloudflare/vitest-pool-workers`, conferindo a compatibilidade com o Vitest 5; senão, Miniflare direto); `dist.test.ts` ajustado (o bloco existe, continua sem `<script>`) | M            | T-076, T-077, T-078, especificação do `ux-designer`, T-082 |
| T-080 | **Moderação:** Worker `prancheta-admin` (Hono em HTML; fila, publicados, fechar post, chave geral, contadores), `AccessJwtAuth`, CSRF por `Origin`, `wrangler.admin.toml` e deploy do Worker no job da T-078                                                                                                                                                                                                      | M            | T-077, T-078                                               |
| T-081 | **Cron:** limpeza por retenção e aviso no celular (`Notifier`: ntfy agora, e-mail depois), sem conteúdo, no máximo a cada 6 h                                                                                                                                                                                                                                                                                     | P            | T-080                                                      |
| T-082 | **Textos** (`content-writer`, aprovados pelo CEO, PR próprio): regras públicas dos comentários, textos do formulário e das mensagens de erro, nova versão da página de privacidade (seção 4 do PM, com o HMAC de 24 h, a cópia automática do D1 e o ntfy), pergunta em `perguntas.astro`                                                                                                                          | P            | pode começar já                                            |
| T-083 | **Auditoria e ativação:** revisão do `security-auditor` (base legal da LGPD, arts. 28 a 30 do ECA Digital, CSP, Access, HMAC do IP). Depois, o CEO cria os D1, aprova o job da migração, configura o Access e os segredos e liga a chave geral. A T-072 sai junto                                                                                                                                                 | P            | todas                                                      |

O `ux-designer` especifica o bloco de comentários e a fila do admin antes da T-079 e da T-080. O `qa-engineer` acrescenta os cenários ao `docs/03-test-plan.md`: E2E de enviar, aprovar, ver e pedir remoção com `PRANCHETA_ENV=test`, quando o Playwright entrar.

### Decisões do CEO

A numeração D do `product-manager` aparece entre parênteses quando o assunto é o mesmo.

1. **Opção e calendário (D11).** Recomendo a C, em trilha paralela, começando pela T-074, que é trabalho da 1b de qualquer jeito, sem passar na frente das tarefas de interface da 1a. A D (T-072) entra já. A alternativa é a C só depois da 1a, com a D até lá.
2. **Exceção à regra "sem texto livre"** do `CLAUDE.md`, só para os comentários do devlog no site, com moderação prévia e sem contato entre usuários. Recomendo aceitar. Sem a exceção, sobra só a D.
3. **Turnstile (D1).** Recomendo deixar desligado no lançamento e pronto para ligar, como o PM. A alternativa é ligar desde o início: mais proteção contra robôs, ao custo de um script de terceiro, do envio sem JavaScript e de uma linha na política.
4. **Autenticação da fila.** Recomendo o Access (grátis até 50 usuários) num Worker próprio no `workers.dev`, com login pelo GitHub do CEO, que já tem segundo fator. As alternativas são o Access num caminho do `pages.dev` ou a Basic Auth com segredo longo, que não tem segundo fator.
5. **Canal do aviso (D8).** Recomendo o ntfy.sh agora, levando só a contagem, e o e-mail pela Cloudflare quando houver domínio próprio. A alternativa é ficar sem aviso até o domínio e conferir a fila à mão.
6. **Aceitar que as páginas de post passem por uma Function** (cota compartilhada com a 1b). Recomendo aceitar. A alternativa, buscar os comentários no navegador, quebra a leitura sem JavaScript e põe o primeiro `<script>` no site.
7. **Recursos a criar no painel, todos a custo zero:**
   - D1 `prancheta` e `prancheta-preview`;
   - time do Zero Trust e aplicação do Access;
   - Worker `prancheta-admin`;
   - segredos do Pages, do Worker e do GitHub (`CLOUDFLARE_API_TOKEN` com permissão só de D1 e de Workers, `CLOUDFLARE_ACCOUNT_ID`);
   - environment `production` com aprovação.
8. **As decisões D2 a D7, D9, D10, D12 e D13 do PM** cabem neste desenho como ele recomendou:
   - apelido ou primeiro nome;
   - nomes reais recusados;
   - sem edição;
   - recusa apaga;
   - 30 dias na fila;
   - 90 dias de post aberto;
   - sem resposta da equipe;
   - remoção na v1 com 48 h;
   - limites;
   - checagem em 8 semanas.

   A D10 pede uma posição do CEO sobre a consulta ao advogado. Recomendo que o `security-auditor` revise antes de ativar e que a consulta já pendente no `docs/PROJETO.md` inclua os comentários, sem bloquear a ativação.

## Conformidade

- **SQL só em `server/src/db/`.** Hono, D1, HTMLRewriter e Access só aparecem em `server/src/platform/cloudflare/`, `server/src/admin/worker.ts` e `functions/`. Fora disso, é BLOCKER na revisão.
- **Teste de esquema** (`server/src/db/schema.test.ts`): aplica as migrações no `node:sqlite` e falha com qualquer coluna fora da lista aprovada. As únicas colunas "pessoa" são `comments.nickname`, `comments.body` e `rate_hits.key_hash`. Nenhuma tabela tem `ip`, `user_agent`, `email` ou `cookie`, e `comments` não tem `key_hash`. Coluna nova sem ADR é BLOCKER.
- **IP:** um teste com `Db` falso registra todos os parâmetros de SQL de um envio completo e falha se o IP aparecer em qualquer um deles.
- **Logs:** um teste roda enviar, recusar automaticamente, aprovar, recusar, apagar e pedir remoção, e confere que nenhum log contém IP, `key_hash`, apelido, texto nem e-mail.
- **Visibilidade:** a leitura pública só devolve `status = 'published'`, e o teste cobre os estados `pending` e `hidden`.
- **Escape:** o caso `<script>alert(1)</script>` do PM fica literal na página e no admin. Inserir conteúdo do usuário sem escape (`html` cru, `{ html: true }` no `HTMLRewriter`) é BLOCKER.
- **Admin:** um teste percorre todas as rotas do app de moderação, sem JWT e com JWT de outro `aud`, outro `iss`, vencido ou de outro e-mail, e exige `403` sem nenhum dado.
- **Site:** `dist.test.ts` continua exigindo nenhum `<script>`, cookie nem armazenamento local, e passa a exigir o `_headers` com o CSP acima e o `_routes.json` sem RSS nem imagens. Ligar o Turnstile só passa com ADR curto, política atualizada e a exceção restrita às páginas de post.
- **Aviso:** um teste confere que o corpo do `Notifier` tem só a contagem e o link.
- **Deploy:** nenhum agente roda `wrangler deploy`, `d1 migrations apply --remote` nem `secret put` (o hook já bloqueia). Migração só no job com aprovação do CEO, e só aditiva: o código anterior precisa funcionar com o esquema novo.

## Fontes

As páginas de `developers.cloudflare.com` não abriram direto nesta sessão. Os números vêm dos resumos de busca dessas páginas, e a T-073 confere no painel.

- [Workers, limites](https://developers.cloudflare.com/workers/platform/limits/) e [preços](https://developers.cloudflare.com/workers/platform/pricing/): 100.000 requisições por dia, 10 ms de CPU por invocação no gratuito, cota compartilhada com as Pages Functions.
- [D1, preços](https://developers.cloudflare.com/d1/platform/pricing/): 5 milhões de linhas lidas e 100.000 gravadas por dia, 5 GB, renovação às 00:00 UTC.
- [D1, Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/): restauração de até 30 dias; uma cópia da documentação cita 7 dias no gratuito.
- [Turnstile, planos](https://developers.cloudflare.com/turnstile/plans/) e [CSP](https://developers.cloudflare.com/turnstile/reference/content-security-policy/): grátis, até 20 widgets; `script-src` e `frame-src` para `challenges.cloudflare.com`; cookie `cf_clearance` só no modo de pré-liberação.
- [Cloudflare Zero Trust, planos](https://www.cloudflare.com/plans/zero-trust-services/) e [Teams Free](https://blog.cloudflare.com/teams-plans/): gratuito até 50 usuários.
- [Pages, problemas conhecidos (Access)](https://developers.cloudflare.com/pages/platform/known-issues/): o Access do Pages protege o `*.pages.dev` inteiro e as prévias. A proteção por caminho não está documentada ali.
- [Cusdis Pro](https://blog.cusdis.com/announcing-cusdis-pro/): o gratuito tem 1 site, 100 aprovados e 10 aprovações rápidas por mês.
- [Disqus, cookies](https://www.consentstack.io/vendors/disqus): cookies de rastreamento e de anúncio no plano gratuito.
- [Giscus, privacidade](https://privacytools.io/app/giscus): exige login no GitHub.
- [ntfy, limites](https://github.com/binwiederhier/ntfy/blob/fa9d6444f5318c040b803c1a0fd785f6f99e15dc/docs/config.md): limite por remetente no servidor público.
- [ECA Digital, Agência Gov](https://agenciagov.ebc.com.br/noticias/202608/eca-digital-conheca-as-regras-de-protecao-de-criancas-e-adolescentes-no-ambiente-online) e [Machado Meyer](https://www.machadomeyer.com.br/pt/inteligencia-juridica/publicacoes-ij/direito-digital/estatuto-digital-da-crianca-e-do-adolescente-lei-n-15-211-2025-entra-em-vigor-em-17-de-marco-de-2026): salvaguardas de moderação para interação entre usuários e aplicação proporcional ao porte. Os artigos exatos ficam com o `security-auditor`.
