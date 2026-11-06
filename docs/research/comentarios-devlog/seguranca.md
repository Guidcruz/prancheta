# Revisão de segurança e privacidade: comentários no devlog (ADR-0020, US-075 a US-083)

> **Rascunho guardado (2026-11-06).** Estudo parado pelo CEO; nada foi decidido nem implementado. Os números (ADR-0020, US-075 a US-083, T-072 a T-083) são provisórios e não reservados. Veja o `README.md` desta pasta.

> `security-auditor`, 2026-11-06. Revisão de proposta, antes de qualquer código. Fora do repositório; nada foi editado no repo.
> Entradas lidas: `historia.md` (PM, US-075 a US-083, D1 a D13), `adr-rascunho.md` (architect, ADR-0020, opção C), `CLAUDE.md`, `site/src/pages/privacidade.astro` (versão de 4/11/2026), ADR-0008, ADR-0015, `docs/PROJETO.md` (Privacidade, LGPD e ECA Digital; Painel de admin), `docs/04-deploy.md`, `config/prancheta.config.ts`, `site/src/lib/dist.test.ts` e o build atual em `site/dist/`.

## Limite desta revisão (ler antes)

- **Não consegui abrir o texto oficial da Lei 15.211/2025.** O `www.planalto.gov.br` e o `www2.camara.leg.br` estão bloqueados pela rede desta sessão (o proxy recusa a conexão). Os artigos abaixo foram conferidos em trechos literais reproduzidos por buscas (normas.leg.br, Jusbrasil, modeloinicial, DOU republicado pela ABMES/Poder360) e em comentários jurídicos. Onde a redação importa, marquei **"conferir no Planalto"**. Para conferir eu mesmo, o `www.planalto.gov.br` precisa ser liberado nas configurações de rede da sessão.
- Não sou advogado. Onde a resposta depende de interpretação, digo o que precisa ir ao advogado.

## Veredito

**Aprovável com condições.** O desenho técnico é bom: dados mínimos, nenhum script nem cookie, moderação prévia, texto escapado, IP nunca gravado em claro, fila atrás do Access com o JWT validado no servidor. Não há achado crítico. Os achados altos não são falhas do código. São lacunas jurídicas e de processo do ECA Digital e da LGPD. **Elas bloqueiam a ativação ao público (T-083), não o aceite do ADR nem o início da T-074.**

## Resumo por gravidade

| Gravidade    | Quantos | Bloqueia                                                              |
| ------------ | ------- | --------------------------------------------------------------------- |
| Crítico      | 0       | —                                                                     |
| Alto         | 3       | a ativação ao público (T-083)                                         |
| Médio        | 9       | entram como condição no ADR, ou viram issue no ciclo da implementação |
| Baixo / info | 10      | melhorias e cuidados de implementação                                 |

---

## 1. LGPD

### 1.1 O que é dado pessoal

| Dado                                                      | É pessoal?                                            | Por quê                                                                                                                                                                                                  |
| --------------------------------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Apelido                                                   | **sim, em geral**                                     | Pode identificar a pessoa direta ou indiretamente (primeiro nome, apelido conhecido na escola ou no Discord). "Anônimo" não é.                                                                           |
| Texto                                                     | **sim, quando ligado ao autor ou quando cita alguém** | É a opinião de uma pessoa identificável pelo apelido, e pode conter dado de terceiros (nome de colega, escola). O pendente é o pior caso: ainda não passou pela revisão.                                 |
| `created_at` exato                                        | sim, junto com o resto                                | Ajuda a ligar o comentário a outras fontes, como os registros de acesso da Cloudflare e o `rate_hits` (ver M7).                                                                                          |
| HMAC do IP (`key_hash`)                                   | **sim: é dado pseudonimizado** (art. 13, §4º)         | Enquanto o sal do dia existe e o pepper está com o controlador, quem tem os dois consegue testar os 2³² IPv4 e voltar ao IP. Só depois de o sal ser apagado ele fica, na prática, anonimizado (art. 12). |
| O IP em si (`CF-Connecting-IP`)                           | sim                                                   | Mesmo sem ser gravado, ele é **tratado** (o art. 5º, X, inclui o processamento). A Cloudflare, como operadora, também o processa.                                                                        |
| `comment_reports`                                         | não                                                   | Só motivo e data, sem IP e sem texto livre.                                                                                                                                                              |
| `moderation_stats`, `moderation_durations`                | não                                                   | Só agregados.                                                                                                                                                                                            |
| E-mail do moderador (`MODERATOR_EMAIL`), sessão do Access | sim, mas do CEO                                       | É dado do próprio controlador. Fica fora da política de leitores.                                                                                                                                        |

**A LGPD se aplica.** A exceção do art. 4º, I, cobre só o tratamento "para fins exclusivamente particulares e não econômicos". Um site público de um projeto que recebe apoio não se encaixa nela. Como o responsável é pessoa natural, ele provavelmente é "agente de tratamento de pequeno porte" (Resolução CD/ANPD nº 2/2022). Isso dispensa o encarregado, mas **não dispensa um canal de comunicação com o titular** (ver A1).

### 1.2 Base legal (recomendação)

- **Comentário (apelido + texto):** **legítimo interesse** (art. 7º, IX, e art. 10), com o teste de balanceamento curto (LIA) registrado no ADR. O ponto central é que a pessoa escreve por vontade própria para ver o texto publicado. Some-se o melhor interesse da criança e do adolescente (art. 14, caput). O Enunciado CD/ANPD nº 1/2023 permite tratar dado de criança e adolescente com qualquer base do art. 7º, desde que prevaleça o melhor interesse.
- **Por que não consentimento:** para menores de 12 anos, o consentimento precisa vir de um dos pais (art. 14, §1º). Sem verificar idade, e sem querer verificar, essa base não se sustenta.
- **Por que não "execução de contrato" (art. 7º, V):** menor de 16 anos é absolutamente incapaz para contratar, então essa base também fica fraca justo para o público sensível.
- **HMAC do IP para limitar envios:** **legítimo interesse** (segurança e prevenção de abuso), no mesmo LIA.
- **Pedido de remoção:** legítimo interesse, mais o cumprimento de obrigação legal (art. 7º, II) quando a notificação vem pelo canal do art. 28 do ECA Digital.
- O advogado confirma a base na consulta do A3.

### 1.3 Retenção

| Item                            | Proposta                                                    | Avaliação                                                                                                                                                                                                                       |
| ------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Pendente                        | 30 dias                                                     | **Aceitável**, com o teto de 200 e o aviso a cada 6 h. Sugiro 14 dias, porque o pendente é o dado menos revisado. Não é condição.                                                                                               |
| Recusado                        | `DELETE` na hora                                            | **Bom**, mas "apagado na hora" só vale para o banco vivo. O Time Travel guarda a linha. Ver o item abaixo e o A2 (exceção do art. 27).                                                                                          |
| Publicado                       | até apagar, até uma remoção aceita ou até o post sair do ar | Aceitável para conteúdo público, com o direito de remoção.                                                                                                                                                                      |
| `rate_hits`, `rate_salts`       | 24 h                                                        | **Aceitável**, mas a política precisa dizer que as cópias automáticas guardam esses dados por até 7 dias (ou 30, se o plano mudar). Ver também o M7, sobre a ligação por horário.                                               |
| Time Travel do D1               | "7 a 30 dias, a confirmar"                                  | **Confirmado na documentação da Cloudflare:** 7 dias no Workers Free e 30 no Workers Paid. Fica sempre ligado e não dá para desligar. A política deve dizer **"até 30 dias"**, para não ficar falsa quando o plano mudar na 1b. |
| Contadores                      | 26 semanas                                                  | Sem dado pessoal. Ok.                                                                                                                                                                                                           |
| Notificações identificadas (A1) | não previsto                                                | **Precisa entrar.** Sugiro 90 dias depois de encerrada, como a regra do e-mail que a política já anuncia.                                                                                                                       |

### 1.4 Direitos do titular sem conta

- **Como alguém apaga um comentário seu, sem conta:**
  - **Publicado:** pelo "Pedir remoção". Falta o motivo **"Escrevi e quero apagar"** (`author_request`). Ele vai para a fila e é atendido sem pedir prova, porque o pior caso é alguém apagar o comentário de outro, e isso é baixo risco. Deve também esconder o comentário na hora, como os motivos graves? Não recomendo, por causa do abuso (M2).
  - **Pendente:** não é público e expira. Ainda assim o titular pode pedir pelo canal privado (A1).
  - **Recomendado (M3):** um **código do autor**, mostrado uma vez na confirmação, para ver a situação do comentário, apagar e contestar. No banco fica só `HMAC(pepper, código)`. Isso resolve ao mesmo tempo o art. 18 da LGPD e o art. 30 do ECA Digital.
- **Acesso e confirmação (art. 18, I e II; art. 19):** sem conta, não temos como saber de quem é cada comentário, e não devemos criar identificação para isso. A resposta-padrão vai na política: "não guardamos nada que ligue um comentário a você além do apelido e do texto, que são públicos depois de aprovados".
- **Oposição (art. 18, §2º, quando a base é legítimo interesse):** o mesmo caminho da remoção.
- **Revisão de decisão automatizada (art. 20):** as recusas automáticas (link, e-mail, telefone, apelido reservado) mostram a regra na hora, e a pessoa pode reescrever. Basta a política dizer que existem filtros automáticos e que todo comentário publicado passou por uma pessoa.

### 1.5 O que a política de privacidade precisa dizer (além da seção 4 do PM)

1. Quem é o controlador (já está: responsável e cidade) e o **canal privado** para direitos e notificações (A1).
2. A finalidade e a **base legal** (1.2), em uma linha cada.
3. Os dados: apelido, texto, data, post e, à parte, o HMAC do IP com chave diária e para que ele serve. Nada de idade, e-mail ou aparelho.
4. Os prazos (1.3), com a ressalva das **cópias automáticas por até 30 dias**, que valem também para o recusado e o apagado.
5. Os operadores: Cloudflare (hospedagem, banco e processamento do IP). Os dados ficam em servidores da Cloudflare, possivelmente fora do Brasil (B8).
6. O aviso ao celular do CEO vai por um serviço de terceiro (ntfy) e leva só a contagem, sem nenhum dado de leitor.
7. Os filtros automáticos e a revisão humana de todo comentário publicado.
8. Os direitos e como exercê-los: botão "Pedir remoção", código do autor (se entrar) e canal privado.
9. **Uma versão em linguagem simples para crianças e adolescentes** (LGPD, art. 14, §6º). Bastam 4 ou 5 frases no topo da seção ("não escreva seu nome completo, escola, telefone nem rede social; um adulto lê tudo antes de publicar; se algo te expõe, toque em Pedir remoção").
10. A seção "Menores de idade" separando o jogo (sem texto livre) do site (comentários moderados antes).
11. A exceção do art. 27, se o advogado confirmar (A2): conteúdo de aparente abuso ou aliciamento é guardado e comunicado às autoridades.

---

## 2. ECA Digital (Lei 15.211/2025)

> Artigos conferidos em trechos literais de fontes secundárias, não no Planalto (ver "Limite desta revisão"). Vigência: 17 de março de 2026. Uma fonte cita a Lei 15.352/2026 como a que fixou a vigência, e uma nota da ANPD cita o Decreto 12.880/2026 regulamentando dispositivos. **Não conferi o conteúdo de nenhum dos dois.**

### 2.1 O que a lei pede de quem publica conteúdo de usuários

| Artigo             | O que diz (pelos trechos)                                                                                                                                                                                                                           | Situação no desenho                                                                                                                                                     |
| ------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **art. 28**        | Fornecedores de produtos ou serviços de TI direcionados a crianças e adolescentes, ou de **acesso provável** por eles, devem dar aos usuários **mecanismos de notificação** de violações aos direitos de crianças e adolescentes.                   | Parcial: o "Pedir remoção" existe, mas é anônimo (ver o §2º do art. 29).                                                                                                |
| **art. 29, caput** | **Retirada** do conteúdo que viola direitos de criança ou adolescente **assim que** o fornecedor for comunicado pela vítima, por seus representantes, pelo Ministério Público ou por entidades de defesa, **sem ordem judicial**.                   | Ok para os motivos graves, que escondem na hora.                                                                                                                        |
| **art. 29, §2º**   | A notificação precisa identificar o conteúdo e **o autor da notificação**, sob pena de nulidade. **É vedada a denúncia anônima.**                                                                                                                   | **Lacuna (A1):** não existe canal identificado. O botão anônimo não é o canal legal.                                                                                    |
| **art. 29, §3º**   | O mecanismo de notificação tem de ser **público e de fácil acesso**.                                                                                                                                                                                | Falta o canal identificado e um texto que o explique.                                                                                                                   |
| **art. 29, §4º**   | Conteúdo jornalístico e **submetido a controle editorial** fica fora desse procedimento.                                                                                                                                                            | **Pergunta ao advogado (A3):** a moderação prévia é "controle editorial"? Se for, o procedimento do art. 29 muda, mas a responsabilidade do CEO pelo que aprova cresce. |
| **art. 30**        | Quem publicou o conteúdo removido tem direito a ser **avisado**, a saber os **motivos**, a saber **se a análise foi humana ou automatizada**, a **recorrer** e a ter **prazos** definidos.                                                          | **Lacuna (M3):** o autor é anônimo e não deixa contato. O código do autor resolve sem coletar dado.                                                                     |
| **art. 32**        | Mecanismos para identificar o **uso abusivo das denúncias** (censura, perseguição).                                                                                                                                                                 | Parcial: há limite de 5 pedidos por dia por IP, mas o motivo grave esconde na hora (M2).                                                                                |
| **art. 27**        | **Remover e comunicar** às autoridades nacionais e internacionais os conteúdos de aparente exploração, abuso sexual, sequestro e **aliciamento** detectados, na forma do regulamento. O §2º manda reter dados pelo prazo do art. 15 do Marco Civil. | **Lacuna (A2):** "recusa apaga na hora" destrói justamente o que a lei manda comunicar.                                                                                 |
| **art. 21**        | Jogos com interação entre usuários seguem o art. 16 da Lei 14.852/2024 (moderação, proteção contra contato nocivo, controle parental), com a interação **restrita por padrão**.                                                                     | Vale para o jogo, não para o site. A regra "sem texto livre no jogo" continua e é coerente.                                                                             |
| Proporcionalidade  | Há um parágrafo que aplica as obrigações de forma proporcional à capacidade do fornecedor de moderar ou intervir (o trecho veio truncado).                                                                                                          | Ajuda um projeto de uma pessoa só, mas o alcance precisa de confirmação no texto e no regulamento.                                                                      |

### 2.2 Moderação prévia e pedido de remoção bastam?

- **Para o dever de prevenção, sim, e com folga.** Nada aparece sem revisão humana, não há contato entre usuários nem resposta ou menção, e link, telefone, e-mail e `@` são barrados no envio. É mais do que a lei pede de uma plataforma comum.
- **Para os deveres de procedimento, não bastam.** Faltam três coisas:
  1. um canal **identificado** e público de notificação (arts. 28 e 29, §§2º e 3º);
  2. um jeito de **avisar o autor e permitir contestação** (art. 30);
  3. um procedimento para **remover e comunicar** às autoridades o conteúdo de abuso ou aliciamento, guardando o necessário (art. 27).
- **Verificação de idade:** pelos trechos que achei, ela é exigida para conteúdo impróprio ou proibido para menores (e a autodeclaração não vale nesses casos). Não achei exigência para uma seção de comentários de conteúdo livre e moderada antes. **Recomendo não pedir idade**, porque isso criaria dado pessoal sem necessidade. O advogado confirma.
- **Prazos:** a lei fala em retirar "assim que" o fornecedor for comunicado. O prazo de 48 h do PM é razoável para os motivos não graves. Para os graves, esconder na hora mais um aviso imediato ao CEO (M2) atende.

### 2.3 Advogado: sim, antes de abrir ao público (A3)

Recomendo a consulta **antes da ativação (T-083), não antes do código**. O ADR propõe "sem bloquear a ativação", e eu discordo. Perguntas para levar:

1. A moderação prévia caracteriza "controle editorial" (art. 29, §4º)? Qual é a responsabilidade civil do CEO, pessoa física, pelo que ele aprova (difamação, dano)? Considerar o Marco Civil, art. 19, e a decisão do STF de 2025 sobre esse artigo.
2. O art. 30 se cumpre com o código do autor (M3), sem nenhum contato?
3. Art. 27: a quem comunicar e em que prazo, segundo o regulamento; o que reter e por quanto tempo, dado que não guardamos IP. O art. 15 do Marco Civil (guarda de registros de acesso por 6 meses) vale para uma pessoa natural sem fins econômicos? Pelo texto, ele alcança pessoa jurídica com fins econômicos. Se valer, o "não gravamos IP" entra em conflito com ele.
4. Base legal (1.2) e o LIA.
5. O alcance da proporcionalidade e o que o Decreto 12.880/2026 e a regulamentação da ANPD exigem de um fornecedor deste porte.

A mesma consulta já estava pendente "antes de monetizar" no `docs/PROJETO.md`. Juntar as duas sai mais barato.

---

## 3. Achados

### ALTO

**A1. Não existe canal privado e identificado para notificações (ECA Digital) nem para os direitos do titular (LGPD)**

- **Localização:** US-081, ADR-0020 ("Pedido de remoção"), `config/prancheta.config.ts` (`supportEmail` vazio) e `privacidade.astro` ("Ainda não há canal de e-mail").
- **Evidência:** o único caminho de remoção é anônimo e sem contato. O art. 29, §2º, veda a denúncia anônima, e o §3º exige um mecanismo público e de fácil acesso. O único canal identificado hoje é o das Discussões do GitHub, que é **público**. Uma mãe que precisa pedir a retirada de algo que expõe o filho teria de se expor em público.
- **Impacto:** descumprimento dos arts. 28 e 29 e falta do canal de atendimento ao titular (LGPD, art. 18, e Resolução CD/ANPD nº 2/2022, que dispensa o encarregado mas não o canal).
- **Recomendação:**
  - Antes da ativação, um endereço de e-mail próprio para privacidade e denúncias, publicado na política, nas regras dos comentários e perto do botão "Pedir remoção". Pode ser um alias de uma caixa do CEO até haver domínio com Email Routing.
  - Prazo de resposta escrito: esconder na hora o que for notificado como violação de direito de criança ou adolescente.
  - Retenção das mensagens: 90 dias depois de encerradas.
  - O botão anônimo continua como caminho extra e rápido.

**A2. "Recusa apaga na hora" não tem a exceção do art. 27 (abuso, exploração, aliciamento)**

- **Localização:** US-078 (recusar), D5 e ADR-0020 (`reject` faz `DELETE` imediato).
- **Evidência:** o art. 27 manda remover **e comunicar** às autoridades o conteúdo de aparente exploração, abuso sexual, sequestro ou aliciamento detectado, e o §2º manda reter dados. Com moderação prévia, quem detecta é o CEO, na fila. Hoje a única ação dele é apagar sem deixar rastro.
- **Impacto:** o desenho impediria cumprir uma obrigação legal justamente no caso mais grave. A chance é baixa, porque contato, link e `@` já são barrados, mas o impacto é alto.
- **Recomendação:**
  - Um motivo de recusa `report_to_authorities` que **não apaga**. Ele move o comentário (texto, post, data e hora) para uma tabela separada `retained_for_authorities`, fora de qualquer leitura pública, sem IP, porque não temos.
  - O CEO comunica pelo canal que o regulamento indicar (a confirmar com o advogado: SaferNet ou Polícia Federal) e registra a data.
  - O prazo de guarda vem do regulamento e do advogado. A política diz que essa exceção existe.
  - O teste de esquema passa a conhecer essa tabela.

**A3. A conformidade jurídica ainda não foi confirmada, e a ativação não deve ocorrer sem o advogado**

- **Localização:** ADR-0020 ("Decisões do CEO", item 8: consulta "sem bloquear a ativação") e D10.
- **Evidência:** as perguntas da seção 2.3 (controle editorial e responsabilidade, art. 30 com autor anônimo, art. 27 e Marco Civil, art. 15, base legal, proporcionalidade e regulamento). Além disso, eu não consegui conferir o texto oficial nesta sessão.
- **Impacto:** risco legal direto para o CEO, que é pessoa física, num site de acesso provável por menores.
- **Recomendação:** a consulta entra como dependência da T-083. O desenvolvimento (T-074 a T-081) pode seguir sem ela.

### MÉDIO

**M1. Uma restauração pelo Time Travel ressuscita os comentários apagados, e o procedimento proposto não consegue reapagá-los**

- **Localização:** ADR-0020, "Riscos" ("reaplicar as remoções registradas nos contadores da semana").
- **Evidência:** a `moderation_stats` só tem semana, evento, motivo e contagem, sem nenhum id. Depois de restaurar, não há como saber quais comentários tinham sido recusados ou apagados, inclusive os retirados por expor uma criança.
- **Impacto:** um comentário removido por obrigação legal poderia voltar ao ar.
- **Recomendação:**
  - Uma tabela `deleted_comments (id, deleted_at)`, só com o id aleatório, sem nenhum dado pessoal, guardada por 30 dias (o máximo do Time Travel).
  - O procedimento de restauração reaplica esses `DELETE`s e, por precaução, devolve todos os publicados restaurados para `hidden` até a revisão.
  - O teste de esquema conhece a tabela.

**M2. O pedido de remoção anônimo pode ser usado para censura, e o aviso ao CEO pode atrasar até 6 h**

- **Localização:** US-081 e ADR-0020 (`personal_data` e `minor` escondem na hora; o aviso sai no máximo a cada 6 h).
- **Evidência:** qualquer um pode esconder qualquer comentário na hora, com 5 pedidos por dia por IP. Um IPv6 /64 novo custa pouco. O art. 32 pede mecanismos contra o uso abusivo das denúncias.
- **Impacto:**
  - alguém some com os comentários críticos;
  - um pedido grave legítimo espera até 6 h para chegar ao CEO.
- **Recomendação:**
  - manter o "esconde na hora", porque o dano de deixar no ar é maior;
  - pedidos graves disparam o aviso **sem o intervalo de 6 h** (continua sem conteúdo);
  - um teto global de esconderes automáticos por dia (por exemplo, 10). Acima dele, o pedido só sinaliza e avisa;
  - um contador de pedidos rejeitados na US-083, para o CEO ver o abuso;
  - a contestação pelo código do autor (M3).

**M3. Sem contato, não há como cumprir o art. 30 (aviso, motivo e recurso) nem o apagar pelo próprio autor**

- **Localização:** a seção 2 do PM ("Edição ou exclusão pelo autor", fora do escopo) e a US-081 (nota "não há como avisá-lo").
- **Recomendação (sem dado novo de pessoa):**
  - Na confirmação do envio, mostrar uma vez um **código do autor** (por exemplo, 16 caracteres em base32 de Crockford). A página de confirmação precisa ser renderizada direto, ou o código precisa ir num parâmetro que não fique em log. Ver o detalhe abaixo.
  - No banco: `comments.author_code_hash = HMAC(AUTHOR_PEPPER, código)`.
  - Uma página `/devlog/comentario/` em que o código mostra:
    - a situação (pendente, publicado, recusado ou removido);
    - o motivo da lista fechada;
    - se a decisão foi humana ou automática;
    - um botão "Apagar meu comentário";
    - um botão "Contestar", com motivos de lista fechada.
  - Para isso funcionar depois da recusa, o `deleted_comments` do M1 guarda também `author_code_hash`, o motivo e se foi humano, por 30 dias.
  - **Detalhe:** o PRG com `303` não carrega o código sem expô-lo na URL. Ou a confirmação vira `200` direto (aceitando o reenvio no F5, que o limite e a duplicata seguram), ou o código vai no fragmento `#`, que o servidor não vê mas que exige JavaScript para mostrar. Recomendo o `200` com `Cache-Control: no-store`.
  - É coluna nova: precisa entrar neste ADR e na lista do teste de esquema. Não é dado pessoal, porque não identifica ninguém sem o código, que só o autor tem.

**M4. O `Referrer-Policy: no-referrer` faz o navegador mandar `Origin: null` nos POSTs, e a checagem de CSRF por `Origin` quebra**

- **Localização:** ADR-0020, "Segurança da página" (`Referrer-Policy: no-referrer` no site todo) e "Moderação" (todo POST exige `Origin` igual à do admin).
- **Evidência:** pelo padrão Fetch ("serializing a request origin"), num POST que não é CORS e com a política de referrer `no-referrer`, a origem é serializada como `null`, mesmo num envio da própria origem. **Needs verification:** teste com um formulário real no Chrome e no Firefox antes da T-079 e da T-080.
- **Impacto:** se o admin também usar `no-referrer`, todo POST legítimo cai. O perigo é alguém "corrigir" aceitando `Origin: null` e abrir um buraco de CSRF no admin.
- **Recomendação:**
  - `Referrer-Policy: same-origin` (ou `strict-origin-when-cross-origin`) nas páginas com formulário e no admin.
  - A checagem principal é `Sec-Fetch-Site: same-origin`. O `Origin` é exigido igual à origem quando vier, e **nunca se aceita `null`**.
  - O formulário público também confere o `Sec-Fetch-Site` e recusa `cross-site`. Sem sessão não há CSRF clássico, mas um site de terceiros poderia fazer os navegadores dos visitantes enviarem comentários, usando os IPs deles para furar o limite por IP.

**M5. A CSP proposta quebra o visual do site, e o risco é ela ser afrouxada às pressas**

- **Localização:** ADR-0020, `_headers` (`default-src 'self'` sem `style-src` próprio).
- **Evidência:** o build atual tem `<style>` embutido e atributos `style=`, por exemplo em `/home/user/prancheta/site/dist/devlog/2026-11-03-dia-1/index.html` (1 bloco `<style>`) e em `/home/user/prancheta/site/dist/devlog/2026-11-06-quem-pode-ser-campeao/index.html` (`style="--table-min: 520px"`). O Astro embute folhas pequenas por padrão (`inlineStylesheets: 'auto'`). Com `default-src 'self'`, o navegador bloqueia tudo isso. O jogo (`/jogo`) está no mesmo `_headers` e precisa de `script-src 'self'` e do service worker.
- **Impacto:** o site fica sem estilo no deploy, e alguém acaba pondo `'unsafe-inline'` de forma ampla.
- **Recomendação:** CSP por caminho.
  - **Site:** `default-src 'self'; script-src 'none'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; form-action 'self'; frame-ancestors 'none'; base-uri 'none'; object-src 'none'`. O `'unsafe-inline'` só em estilo é aceitável: não há script, e todo conteúdo de usuário é escapado.
  - **`/jogo/*`:** `script-src 'self'`, `worker-src 'self'` e o resto conferido com o jogo rodando.
  - O `dist.test.ts` confere as duas CSPs.

**M6. Robôs podem esgotar a cota da conta com GETs simples e derrubar a liga da 1b. O Turnstile não ajuda, e o comportamento ao estourar a cota está invertido no ADR**

- **Localização:** ADR-0020, "Atenção" das cotas, "Riscos" e "Consequências" ("se as Functions falharem fechadas").
- **Evidência:**
  - Cada GET de `/devlog/<post>/` é uma invocação de Function. Cerca de 1,2 requisição por segundo durante um dia gasta as 100.000 da conta inteira. Para isso não é preciso nem enviar um comentário.
  - A documentação de preços das Pages Functions diz que o padrão é **fail open**: estourada a cota, a Function é pulada e sai o estático. O "fail closed" mostra o erro 1027.
  - O teto de 200 pendentes é outra negação de serviço barata: uns 20 IPs com 10 envios cada lotam a fila num dia e fecham os comentários do site todo.
- **Impacto:** a disponibilidade da liga online na 1b e a dos comentários. Não há impacto de confidencialidade.
- **Recomendação:**
  - Manter o fail open para o site e **o HTML estático do bloco vir com o formulário escondido** e o aviso de "indisponível". Assim, com a cota estourada, ninguém vê um formulário que daria 405.
  - Avaliar **uma conta Cloudflare separada para o site** (custo zero), para isolar a cota da 1b, ou registrar a aceitação do risco pelo CEO até o plano pago.
  - "Recusar em lote" (todos os pendentes filtrados por data ou sinalização) passa de Could para Must, para limpar uma enxurrada no celular.
  - O alerta de uso no painel (T-073) é obrigatório.
- **Turnstile desligado no lançamento: aceitável.** Concordo com o PM e com o architect. Com moderação prévia, o spam só pesa na fila, e o Turnstile não protege a cota. Registro uma limitação: `COMMENTS_HUMAN_CHECK` como variável só vale no próximo deploy, então ligar no meio de um ataque depende de um merge. Na urgência, a chave geral no D1 é o que vale.

**M7. "Nunca ligado ao comentário" é forte demais: dá para ligar o HMAC ao comentário pelo horário, e as cópias guardam tudo por 7 dias**

- **Localização:** ADR-0020, "Limite de envios" e "Sem ligação"; US-082.
- **Evidência:**
  - Se o `window_start` do balde `burst` for o horário do primeiro envio da janela (janela deslizante), ele é igual ao `created_at` do comentário, e um `JOIN` pelo horário liga os dois.
  - Com o pepper e o sal do dia, que o controlador tem, testar os 2³² IPv4 devolve o IP do autor.
  - Com o volume previsto (10 por dia), até baldes fixos de 10 minutos costumam ter um comentário só.
  - O Time Travel guarda `rate_hits` e `rate_salts` por 7 dias, não por 24 h.
- **Impacto:** a promessa da política ficaria imprecisa, e a pseudonimização é mais fraca do que o texto sugere.
- **Recomendação:**
  - `window_start` alinhado a baldes fixos (múltiplos de 10 min e o dia UTC). Nunca o horário do envio.
  - Preferir um limite **sem gravar nada no D1**: um Durable Object com contadores só em memória, peça que a 1b já terá, ou o binding de rate limiting dos Workers, se valer para Pages Functions (**needs verification** na T-073). Com isso, `rate_hits` e `rate_salts` deixam de existir.
  - Enquanto a tabela existir, a política diz "não gravamos o IP nem ligamos o registro ao comentário", não "impossível ligar", e cita as cópias de até 30 dias.

**M8. Os logs da plataforma podem guardar IP e localização, e o teste de logs do ADR não os cobre**

- **Localização:** ADR-0020, "Erros e logs" e "Conformidade (Logs)".
- **Evidência:** o teste confere só os `console.log` do nosso código. Os Workers Logs e a `observability` do `wrangler.toml`, se ligados, registram metadados da requisição (URL, cabeçalhos e o objeto `cf`, com cidade e coordenadas aproximadas). **Needs verification:** conferir na T-073 que campos entram e por quanto tempo.
- **Recomendação:**
  - `observability` desligada, ou `invocation_logs = false`, no Pages e no `prancheta-admin`;
  - nenhum Logpush;
  - `wrangler tail` só em diagnóstico, sem copiar a saída para issues ou PRs;
  - um teste de configuração que falha se a `observability` aparecer ligada no `wrangler*.toml`;
  - a política cita que a Cloudflare processa o IP conforme a política dela (já cita).

**M9. As prévias do Pages são públicas e aceitariam comentários reais num banco sem limpeza nem moderação**

- **Localização:** ADR-0020 (`wrangler.toml` com D1 de prévia) e `docs/04-deploy.md` (cada branch vira `<branch>.prancheta-ad1.pages.dev`).
- **Evidência:** cada push de branch, inclusive dos agentes, publica uma prévia acessível a qualquer um, com o formulário ativo apontando para o `prancheta-preview`. O cron de retenção roda só no `prancheta-admin`, que é de produção.
- **Impacto:** dado pessoal real num banco sem prazo de guarda, sem fila e sem política.
- **Recomendação:**
  - Fora da produção, a chave geral vem desligada por padrão (`comments_enabled` ausente conta como desligado). Para testar, usa-se um ambiente com `PRANCHETA_ENV=test`.
  - Ou o Access protege as prévias do Pages.
  - Em qualquer caso, segredos de prévia **diferentes** dos de produção, e nenhum binding de produção em prévia. Um teste confere o `wrangler.toml`.

### BAIXO / INFO

**B1. O `formToken` vale por 2 h, várias vezes e sem vínculo com o visitante.** Um robô pega um token e o reaproveita, e o tempo mínimo de 3 s só pesa na primeira vez. Como filtro barato, é aceitável. Não conte com ele contra robôs: quem segura é o limite por IP e a fila. Opcional: incluir no HMAC o balde de 10 min do `key_hash`, sem gravar nada.

**B2. Cuidados de XSS na implementação.** O desenho está certo: texto puro, `setInnerContent` sem `html: true`, `html` do Hono e o BLOCKER na conformidade. Condições para a T-079 e a T-080:

- conteúdo de usuário **nunca** vai em atributo. `setAttribute` só recebe ids gerados pelo servidor e validados por regex (`?remover=<commentId>` precisa casar com `^[0-9A-Z]{26}$` antes de ser refletido). A forma como o lol-html escapa aspas em `setAttribute` é **needs verification**, então a regex é a defesa;
- as quebras de linha vêm de `white-space: pre-line` no CSS, nunca de trocar `\n` por `<br>`;
- o `422` que devolve o texto digitado tem teste com `</textarea><script>` e `"><img onerror>`, e sai com `Cache-Control: no-store`;
- caracteres bidi e de largura zero são removidos também do apelido (a T-075 já prevê);
- `raw()` do Hono proibido no admin, conferido por lint ou grep na revisão.

**B3. O Access no `workers.dev` agora é suportado.** O changelog da Cloudflare de 2025-10-03 traz o "one-click Access" para `workers.dev` e URLs de prévia, e recomenda validar o `Cf-Access-Jwt-Assertion` com o AUD e o domínio do time. Condições:

- algoritmo fixado em RS256, com recusa de `none` e `HS*`;
- chave buscada pelo `kid`, com cache e nova busca quando o `kid` for desconhecido;
- `iss` exatamente `https://<time>.cloudflareaccess.com`, `aud`, `exp` e `nbf` com folga pequena, e o `email`;
- o `scheduled()` não passa pelo app HTTP;
- sessão do Access curta (por exemplo, 24 h) e cookie com `SameSite=Lax` ou `Strict` configurado na aplicação;
- login só pelo GitHub com 2FA. O PIN por e-mail não é segundo fator: desligar, ou o CEO aceita por escrito;
- as URLs de prévia do Worker desligadas **e** cobertas pela política de prévias.

Planos B:

- **(1) Access num caminho do `pages.dev`:** põe o admin na mesma origem das páginas com conteúdo de usuário e das prévias de branch, que são do mesmo site. Só como último caso, e com o JWT validado do mesmo jeito.
- **(2) Basic Auth:** aceitável só temporariamente e com o aceite do CEO. **Tirar o "bloqueio depois de 5 falhas por hora"**, que deixa qualquer um trancar o CEO para fora. Com 32 bytes aleatórios, a força bruta já não funciona.

**B4. Segredos e CI.**

- `FORM_TOKEN_SECRET`, `RATE_PEPPER` (e o `AUTHOR_PEPPER` do M3) ficam como segredos do Pages, separados por ambiente (produção e prévia).
- O `MODERATOR_EMAIL` não é segredo de verdade, mas pode ficar como segredo.
- O `CLOUDFLARE_API_TOKEN` do GitHub com permissão de Workers Scripts:Edit consegue publicar código no `prancheta-admin` e ler o banco inteiro. Por isso:
  - token restrito à conta e às permissões mínimas, com validade definida;
  - só no environment `production` com aprovação do CEO;
  - ações de terceiros fixadas por SHA;
  - nenhum `pull_request_target` com segredos.
- O `.dev.vars` já está no `.gitignore` (conferido).

**B5. O ntfy como canal de aviso: aceitável.** O que vaza:

- **para o ntfy.sh, que é público:** a contagem, a URL do admin (revela o subdomínio da conta, mas fica atrás do Access), a hora e o IP do celular do CEO ao assinar;
- **no Android da Play Store:** a mensagem passa pelo Firebase do Google;
- **no iOS:** passa pelo APNs.

Nenhum dado de leitor vai junto, então não é compartilhamento de dado pessoal de usuários. Quem souber o tópico lê as mensagens **e consegue publicar nele**, o que permite um aviso falso com link de phishing. Recomendação:

- mensagem sem link (o CEO abre o admin por um favorito) ou com um link fixo que o app não deixe trocar;
- tópico com 32 ou mais caracteres aleatórios;
- citar o ntfy na política em uma linha.

**B6. Personificação pelo apelido.** Sem conta, qualquer um usa o apelido de outro. Recomendação:

- a regra pública "apelido não é identidade" e "a equipe não comenta nesta versão" (D9);
- nomes reservados comparados depois da normalização de homóglifos (P-09);
- recusar como `impersonation` o apelido de pessoa pública real, como influenciador ou narrador, que a lista bloqueada de atletas não cobre.

Info: reservar "o nome do responsável legal" bloqueia todo apelido "Guilherme", que é um nome muito comum. Isso é aceitável, mas a mensagem de recusa precisa ser clara.

**B7. Limite por IP no Brasil.** O CGNAT das operadoras móveis põe muitos usuários atrás do mesmo IPv4, e 10 envios por dia por IP pode barrar leitor legítimo quando houver volume. Já no IPv6, um /64 novo custa pouco. Com o volume previsto, não há o que mudar agora: fica como info para a checagem de 8 semanas (D13).

**B8. Transferência internacional (needs verification).** O D1 não tem região na América do Sul, então o dado fica fora do Brasil (LGPD, art. 33, e Resolução CD/ANPD nº 19/2024). A Cloudflare já processa os IPs do site hoje. Conferir se o DPA da Cloudflare traz as cláusulas-padrão da ANPD e dizer na política que os dados ficam em servidores da Cloudflare fora do Brasil.

**B9. Turnstile, se for ligado.**

- Ele é um script de terceiro que lê sinais do navegador e o IP. Não grava cookie, salvo o `cf_clearance` no modo de pré-liberação, que deve ficar desligado.
- Conferir no aditivo de privacidade do Turnstile se a Cloudflare age como operadora ou como controladora dos sinais. Se for controladora, há compartilhamento, e a política diz isso.
- A CSP libera `challenges.cloudflare.com` **só** nas páginas de post.
- O `siteverify` não envia `remoteip`, e o `hostname` e a `action` são conferidos (o ADR já prevê).
- Ligar exige ADR curto, a política atualizada e o aceite de que o envio sem JavaScript se perde.
- Sem obrigação específica do ECA Digital.

**B10. Conteúdo.**

- **Nomes reais (D3):** recusar é coerente com o `CLAUDE.md` e com a exceção do ADR. A lista em hash só sinaliza, o que está correto por causa dos falsos positivos.
- **Dado de terceiros no texto** ("o João da 7ª B"): é dado pessoal de outra pessoa, possivelmente menor, e às vezes bullying. Vai como `personal_data` + `offense`.
- **Autorrevelação:** idade + cidade ou escola de quem parece criança deve ser recusada. As regras para o moderador precisam dizer isso.
- **Idiomas:** comentários em espanhol e inglês pedem que o CEO consiga avaliá-los. Em caso de dúvida, recusar como `unreadable`.

**Info.** Há um relato de comunidade (Reddit, abril de 2025) de que, no fail open, arquivos do lado do servidor ficaram acessíveis. Aqui o código fica em `functions/` e `server/`, fora do `dist/`, e não há segredo em arquivo. Basta o `dist.test.ts` conferir que nenhum `.ts`, `wrangler*.toml` ou `.dev.vars` vai para o `dist/`.

---

## 4. Condições para entrar no ADR-0020 antes da decisão do CEO

1. **Canal privado e identificado** para notificações do ECA Digital (arts. 28 e 29) e direitos da LGPD: e-mail publicado antes da ativação, com o prazo de ação e a retenção de 90 dias (A1).
2. **Exceção do art. 27:** o motivo `report_to_authorities` guarda o conteúdo numa tabela restrita, com o procedimento de comunicação e o prazo definidos com o advogado (A2).
3. **A consulta ao advogado é dependência da T-083** (ativação), com as perguntas da seção 2.3 (A3).
4. **Base legal registrada:** legítimo interesse, com um LIA curto no ADR e o melhor interesse da criança (Enunciado CD/ANPD nº 1/2023) (1.2).
5. **Tabela `deleted_comments`** (só id e data, 30 dias) e o procedimento de restauração que reaplica as remoções e devolve os publicados para `hidden` (M1).
6. **Pedidos graves:** aviso sem o intervalo de 6 h, teto global de esconderes automáticos por dia e contador de pedidos rejeitados (M2).
7. **Código do autor** para ver a situação, apagar e contestar (art. 30), com `author_code_hash` na lista do teste de esquema. No mínimo, o motivo `author_request` no "Pedir remoção" (M3, 1.4).
8. **CSRF:** `Sec-Fetch-Site` como checagem principal, `Origin` nunca aceito como `null`, `Referrer-Policy: same-origin` nas páginas com formulário e no admin, e teste em navegador real (M4).
9. **CSP por caminho:** no site, `script-src 'none'` e `style-src 'self' 'unsafe-inline'`; no `/jogo/*`, uma CSP própria; as duas conferidas no `dist.test.ts` (M5).
10. **Cota:** fail open mantido, HTML estático com o formulário escondido, "recusar em lote" como Must, alerta de uso obrigatório, e a decisão do CEO entre uma conta separada para o site e o aceite do risco para a 1b (M6). O texto de "Consequências" e "Riscos" é corrigido: o padrão é fail open.
11. **Limite de envios:** baldes fixos e, de preferência, contador sem gravação no D1 (Durable Object ou binding de rate limiting). O texto da política fica preciso sobre a ligação e as cópias (M7).
12. **Logs da plataforma:** `observability` desligada ou sem `invocation_logs`, sem Logpush, e um teste de configuração (M8).
13. **Prévias:** comentários desligados fora da produção, ou as prévias atrás do Access; segredos e D1 separados; teste do `wrangler.toml` (M9).
14. **Retenção na política:** cópias automáticas "até 30 dias" (7 no plano gratuito atual), valendo também para o recusado, o apagado e o HMAC (1.3).
15. **Política de privacidade** com os itens 1 a 11 da seção 1.5, incluindo a versão em linguagem simples para crianças e adolescentes (LGPD, art. 14, §6º).
16. **Access:** a lista de validação do JWT do B3, só o GitHub com 2FA (ou o aceite escrito do PIN por e-mail), sessão curta, cookie SameSite, prévias do Worker desligadas e cobertas; no plano B2, sem bloqueio por falhas.
17. **ntfy:** mensagem sem link variável e tópico com 32 ou mais caracteres aleatórios (B5).
18. **XSS:** as regras do B2 entram na seção "Conformidade" como BLOCKER de revisão (conteúdo de usuário fora de atributos, ids validados por regex, `pre-line` no CSS, teste do `422`).

## 5. Ações que exigem o CEO

- Decidir se a consulta ao advogado vem antes da ativação. **Recomendo que sim.**
- Criar o e-mail de privacidade e denúncias (A1).
- Decidir entre uma conta Cloudflare separada para o site e aceitar por escrito o risco de cota compartilhada com a 1b (M6).
- Aceitar ou recusar o PIN por e-mail como forma de login no Access, e o plano B2 sem segundo fator, se chegar a ser preciso (B3).
- Liberar o `www.planalto.gov.br` na rede da sessão, se quiser que eu confira os artigos no texto oficial antes do aceite.

## Fontes consultadas

- [Lei 15.211/2025 no Planalto](https://www.planalto.gov.br/ccivil_03/_ato2023-2026/2025/lei/l15211.htm) (oficial, **não abriu nesta sessão**) · [normas.leg.br](https://normas.leg.br/?urn=urn%3Alex%3Abr%3Afederal%3Alei%3A2025-09-17%3B15211) · [Câmara, norma atualizada (PDF)](https://www2.camara.leg.br/legin/fed/lei/2025/lei-15211-17-setembro-2025-797997-normaatualizada-pl.pdf) · [DOU republicado (ABMES)](https://abmes.org.br/arquivos/legislacoes/Lei-15211-2025-09-17.pdf)
- [Art. 29 (modeloinicial)](https://modeloinicial.com.br/lei/L-15211-2025/lei-15211/art-29) · [Art. 29 (Jusbrasil)](https://www.jusbrasil.com.br/topicos/888391926/art-29-da-lei-n-15211-de-17-de-setembro-de-2025) · [Art. 21 (modeloinicial)](https://modeloinicial.com.br/lei/L-15211-2025/lei-15211/art-21) · [Conjur, dever de remoção](https://conjur.com.br/2026-set-18/uma-publicacao-dois-regimes-o-dever-de-remocao-das-plataformas/) · [Estratégia OAB](https://oab.estrategia.com/portal/eca-digital-oab/) · [Informática Jurídica](https://www.informatica-juridica.com/ley/lei-no-15-211-de-17-de-setembro-de-2025/) · [Dizer o Direito](https://buscadordizerodireito.com.br/novidades_legislativas/620/lei-152112025-estatuto-digital-da-crianca-e-do-adolescente) · [Teletime, vigência](https://teletime.com.br/26/02/2026/lei-que-torna-anpd-agencia-e-fixa-vigencia-do-eca-digital-e-sancionada/) · [Legismap, ANPD e ECA Digital](https://legismap.com.br/conteudos/artigos-e-noticias/anpd-divulga-relatorio-de-execucao-da-agenda-regulatoria-2025-2026-2-semestre) · [ANPD, denúncias ECA Digital](https://www.gov.br/anpd/pt-br/assuntos/eca-digital/denuncias-eca-digital)
- [Cloudflare changelog: one-click Access para Workers (2025-10-03)](https://developers.cloudflare.com/changelog/2025-10-03-one-click-access-for-workers) · [Políticas reutilizáveis do Access (2025-12-03)](https://developers.cloudflare.com/changelog/2025-12-03-reusable-access-policies/) · [Prévias dos Workers, padrão](https://developers.cloudflare.com/changelog/2025-10-23-preview-url-default-behavior)
- [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) (7 dias no Free, 30 no Paid)
- [Pages Functions, preços (fail open e fail closed)](https://developers.cloudflare.com/pages/functions/pricing/) · [relato de comunidade sobre o fail open](https://redlib.astrial.org/r/CloudFlare/comments/1jv52hq/security_cloudflare_pages_exposes_serverside_code)
