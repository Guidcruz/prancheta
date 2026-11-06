# Comentários nos posts do devlog: rascunho de produto

> **Rascunho guardado (2026-11-06).** Estudo parado pelo CEO; nada foi decidido nem implementado. Os números (ADR-0020, US-075 a US-083, T-072 a T-083) são provisórios e não reservados. Veja o `README.md` desta pasta.

> Rascunho do `product-manager` (2026-11-06), fora do repositório. Pedido do CEO: quem acompanha o projeto pode comentar nos posts do devlog, anônimo ou com apelido ou nome. Estudo aprovado ("ok pode começar o estudo"); nenhum código. O `architect` escreve o ADR em paralelo; o `security-auditor` revisa depois. Nada aqui escolhe tecnologia: Cloudflare (Pages, Workers, D1) e Turnstile aparecem como restrição ou como opção a decidir.

## 0. Numeração e recorte

- **Próximo número livre em `docs/01-requirements.md`: US-075.** O arquivo vai até a US-074 e não há US-075 reservada.
- Uma história só não cabe num PR: ficaria com mais de 15 cenários, entre eles a fila do CEO e a política de privacidade. Pela regra "um PR por história", o pedido vira **9 histórias, de US-075 a US-083**, agrupadas como "Comentários no devlog". Os números ficam reservados só depois do ok do CEO. Até lá, isto é proposta.
- **Etapa:** trilha paralela do site, fora do caminho crítico da 1a (ver decisão D11). É a primeira peça com servidor e banco, antes da 1b.
- **Limites numéricos** aparecem como parâmetros com nome em inglês e um valor recomendado entre parênteses. O lugar onde ficam é decisão do `architect`; não vão em `app/src/params/`, que é do jogo. Os valores são da decisão D12.

| ID     | Título                                                       | Prioridade | Estado   |
| ------ | ------------------------------------------------------------ | ---------- | -------- |
| US-075 | Enviar comentário num post do devlog, com apelido ou anônimo | Must       | rascunho |
| US-076 | Filtros automáticos, anti-spam e limite de envios            | Must       | rascunho |
| US-077 | Ver os comentários aprovados no post                         | Must       | rascunho |
| US-078 | Fila de moderação do CEO: aprovar e recusar                  | Must       | rascunho |
| US-079 | Apagar comentário publicado e fechar comentários             | Must       | rascunho |
| US-080 | Aviso no celular quando houver fila                          | Should     | rascunho |
| US-081 | Pedir a remoção de um comentário publicado                   | Must       | rascunho |
| US-082 | Dados mínimos, prazos de guarda e política de privacidade    | Must       | rascunho |
| US-083 | Números da moderação para saber se vale a pena               | Should     | rascunho |

Todas ficam em rascunho até as decisões D1 a D12 (seção 6) e o ADR do `architect`.

---

## 1. Histórias de usuário

### US-075: Enviar comentário num post do devlog, com apelido ou anônimo

**Como** leitor do devlog, **quero** deixar um comentário no fim do post, com apelido ou sem nada, **para** dar opinião sobre o desenvolvimento sem criar conta nem dar e-mail.

**Prioridade:** Must
**Depende de:** ADR do `architect` (onde o envio é recebido e guardado); D2 (nome no apelido); D12 (limites); textos do formulário e das regras feitos pelo `content-writer` e aprovados pelo CEO.
**Notas:** o formulário tem só dois campos: "Apelido (opcional)" e "Comentário". Não pede e-mail, conta nem idade. Perto do botão de enviar, em texto curto, ficam as regras (seção 3), principalmente "não cite clubes, jogadores ou pessoas reais" e "não publique dados pessoais", com um link para as regras completas. Nada aparece no site antes da moderação (US-078). Os textos são só em pt-BR, como o resto do site.

```gherkin
Cenário: comentar com apelido
  Dado um post do devlog com comentários abertos
  Quando o leitor preenche o apelido "Lateral Raiz" e um texto válido e envia
  Então o comentário é gravado como pendente, com o apelido "Lateral Raiz", o texto, a data e o post
  E o leitor vê a confirmação de que o comentário foi recebido e só aparece depois de revisado
  E o comentário não aparece na página do post

Cenário: comentar anônimo
  Dado um post com comentários abertos
  Quando o leitor deixa o apelido vazio, ou só com espaços, e envia um texto válido
  Então o comentário é gravado como pendente com o apelido "Anônimo"

Cenário: limites de tamanho
  Dado um texto com menos de comments.minTextLength (3) ou mais de comments.maxTextLength (800) caracteres, contados depois de tirar os espaços das pontas, ou um apelido com mais de comments.maxNicknameLength (24) caracteres
  Quando o leitor envia
  Então nada é gravado e o formulário mostra, em pt-BR, qual campo está fora do limite e qual é o limite
  E o texto digitado continua no formulário

Cenário: envio sem JavaScript
  Dado um navegador com JavaScript desligado
  Quando o leitor preenche e envia o formulário
  Então o envio funciona como formulário HTML comum e o leitor vê a mesma confirmação
  E, se houver erro de validação, a resposta mostra o formulário de novo com o texto e o apelido digitados e a mensagem do erro

Cenário: falha do servidor ou da rede
  Dado que o serviço de comentários não responde ou responde com erro
  Quando o leitor envia
  Então ele vê uma mensagem em pt-BR dizendo que o comentário não foi enviado e pedindo para tentar mais tarde
  E o texto digitado não se perde: com JavaScript, continua na caixa; sem JavaScript, volta no formulário
  E a página do post continua funcionando

Cenário: nenhum cookie nem terceiro
  Dado um envio completo, do carregamento do post à confirmação, com a rede monitorada
  Então nenhum cookie é criado pelo site
  E nenhuma requisição sai para domínio que não seja o do site (salvo se o CEO aprovar o Turnstile, ver D1)
```

**Fora do escopo desta história:** contador de caracteres ao vivo (Could, só com JavaScript); prévia do comentário antes de enviar.

---

### US-076: Filtros automáticos, anti-spam e limite de envios

**Como** CEO e único moderador, **quero** que o óbvio seja barrado antes de chegar à minha fila, **para** gastar meu tempo só com o que precisa de julgamento.

**Prioridade:** Must
**Depende de:** US-075; D1 (Turnstile); D12 (limites); lista de apelidos reservados feita pelo `content-writer`.
**Notas:** as recusas automáticas mostram ao leitor uma mensagem que diz **a regra**, nunca a palavra que bateu, como já faz a US-047 com os apelidos ("comentários não podem ter links", "não publique e-mail nem telefone"). Assim a pessoa pode reescrever. A normalização (caixa, acento, caracteres de largura zero, homóglifos) segue o caso P-09 do `docs/03-test-plan.md`. O anti-spam não pode depender de JavaScript (US-075, envio sem JavaScript), a não ser que o CEO aprove o Turnstile (D1).

```gherkin
Cenário: link, e-mail ou telefone no texto ou no apelido
  Dado um texto ou apelido com um endereço de site (com ou sem "http", "www" ou domínio como "algo.com"), um e-mail ou um número com cara de telefone brasileiro (8 a 13 dígitos, com ou sem DDD, espaços, pontos ou traços)
  Quando o leitor envia
  Então nada é gravado e a mensagem diz a regra infringida, sem repetir o trecho que bateu

Cenário: apelido reservado ou da lista bloqueada
  Dado um apelido igual, sem diferença de caixa nem de acento, a um nome reservado ("Prancheta", o valor de config.name, "Equipe", "Admin", "Moderador", "Moderação", "CEO", o nome do responsável legal) ou que bata com a lista bloqueada de nomes reais
  Quando o leitor envia
  Então nada é gravado e a mensagem pede outro apelido

Cenário: limite de envios
  Dado que da mesma origem já saíram comments.rateBurst (3) comentários nos últimos 10 minutos, ou comments.rateDaily (10) nas últimas 24 horas
  Quando sai mais um envio
  Então nada é gravado e o leitor vê que precisa esperar, sem dizer quantos envios faltam

Cenário: robô no campo-isca ou envio rápido demais
  Dado um envio que preenche o campo-isca invisível ou chega menos de comments.minFillSeconds (3) segundos depois de a página ser carregada
  Então nada é gravado e a resposta é a mesma confirmação de sucesso, para o robô não aprender

Cenário: fila cheia
  Dado que a fila tem comments.maxPending (200) comentários pendentes
  Quando alguém abre um post
  Então o formulário dá lugar ao aviso de que os comentários estão temporariamente fechados
  E um envio direto ao serviço é recusado sem gravar nada
```

**Fora do escopo desta história:** moderação automática por IA ou por serviço de terceiros; recusa automática por palavrão (os palavrões só **sinalizam** na fila, ver US-078, porque a recusa automática erra com nomes e gírias).

---

### US-077: Ver os comentários aprovados no post

**Como** leitor, **quero** ler o que os outros acharam do post, **para** acompanhar a conversa em volta do projeto.

**Prioridade:** Must
**Depende de:** US-078 (só existe comentário publicado depois da aprovação); ADR do `architect` (como os aprovados chegam à página).
**Notas:** os comentários aparecem só na página do post. Não vão para a lista do devlog, para o RSS nem para a página inicial. O texto é mostrado como texto puro: sem HTML, sem Markdown e sem link clicável. As quebras de linha são mantidas. O prazo de 5 minutos é uma exigência de produto. Se o jeito de cumprir exigir um build novo do site, isso esbarra na regra "publicação só por merge do CEO", e o `architect` precisa tratar no ADR.

```gherkin
Cenário: lista de aprovados
  Dado um post com 3 comentários aprovados e 2 pendentes
  Quando o leitor abre o post
  Então vê "3 comentários" e os 3 aprovados, do mais antigo para o mais novo, cada um com apelido, data no formato dd/mm/aaaa e texto
  E nenhum pendente aparece

Cenário: sem comentários
  Dado um post sem nenhum comentário aprovado
  Então a seção mostra o convite para comentar, sem o número zero

Cenário: texto mostrado como texto
  Dado um comentário aprovado com o texto "<script>alert(1)</script> **forte** [x](y)" e duas quebras de linha
  Então a página mostra esses caracteres literalmente, nenhum script roda, nada vira negrito nem link, e as quebras de linha aparecem

Cenário: aparece logo depois da aprovação
  Dado um comentário aprovado na fila
  Então ele aparece na página do post em até 5 minutos, sem merge nem publicação manual

Cenário: leitura sem JavaScript
  Dado um navegador com JavaScript desligado
  Quando o leitor abre um post com comentários aprovados
  Então vê os mesmos comentários, na mesma ordem

Cenário: serviço fora do ar
  Dado que o serviço de comentários não responde
  Quando o leitor abre o post
  Então o post aparece inteiro e a seção de comentários diz que eles não puderam ser carregados agora
```

**Fora do escopo desta história:** paginação (até a decisão de reavaliar na US-083, todos os aprovados aparecem); ordenar por mais novo; link permanente para um comentário.

---

### US-078: Fila de moderação do CEO: aprovar e recusar

**Como** CEO, **quero** uma página só minha, que funcione bem no celular, com os comentários pendentes, **para** aprovar ou recusar cada um em poucos toques.

**Prioridade:** Must
**Depende de:** US-075; ADR do `architect` (como só o CEO entra; o `docs/PROJETO.md`, na parte do painel de admin, cita Cloudflare Access com segundo fator, que fica registrado como restrição).
**Notas:** a página não é o painel de admin da Etapa 6, só uma fila. O moderador não edita o texto: aprova ou recusa (D4). A recusa apaga o comentário na hora (D5). As sinalizações ajudam a decidir e não recusam nada sozinhas. Elas são: "pode ter nome real", pela lista bloqueada em hash; "pode ter palavrão ou ofensa"; "pode ter dado pessoal", para `@perfil`, sequência longa de números, CEP ou "escola" junto com nome; e "possível nome completo no apelido", para duas ou mais palavras com inicial maiúscula. Alvos de toque de 44 px ou mais.

```gherkin
Cenário: só o moderador entra
  Dado uma requisição à página de moderação, ou às suas ações, sem a autenticação do moderador
  Então a resposta não traz nenhum comentário, apelido nem contagem, e nenhuma ação é executada

Cenário: fila
  Dado 3 comentários pendentes em posts diferentes
  Quando o moderador abre a fila
  Então vê os 3, do mais antigo para o mais novo, cada um com título do post, apelido, data e hora, texto completo e as sinalizações que se aplicam

Cenário: aprovar
  Dado um comentário pendente
  Quando o moderador toca "Aprovar"
  Então o comentário passa a publicado, sai da fila e aparece no post (US-077)

Cenário: recusar
  Dado um comentário pendente
  Quando o moderador toca "Recusar" e, se quiser, escolhe um motivo da lista fechada da seção 3
  Então o texto e o apelido são apagados do banco na hora, sem estado "recusado" que os guarde
  E só o contador agregado do motivo e da semana aumenta (US-083)

Cenário: pendente esquecido expira
  Dado um comentário pendente há mais de comments.pendingTtlDays (30) dias
  Então ele é apagado como se tivesse sido recusado, com o motivo "expirado"
```

**Fora do escopo desta história:** editar o texto; aprovar ou recusar em lote (Could); mais de um moderador; histórico de quem moderou (só há um moderador).

---

### US-079: Apagar comentário publicado e fechar comentários

**Como** CEO, **quero** tirar do ar um comentário já aprovado e fechar os comentários de um post ou do site todo, **para** corrigir um erro meu ou esfriar uma polêmica.

**Prioridade:** Must
**Depende de:** US-077, US-078; D7 (prazo em que o post fica aberto).
**Notas:** fechar não esconde o que já foi publicado; para isso, existe o apagar. O "fechado" de um post pode vir de um campo do post (`comments: false` no frontmatter) ou da página de moderação. Quem decide é o `architect`, mas a chave geral precisa funcionar sem publicar o site de novo.

```gherkin
Cenário: apagar publicado
  Dado um comentário publicado
  Quando o moderador toca "Apagar" na lista de publicados e confirma
  Então o comentário some da página do post em até 5 minutos, sem marca de "comentário removido"
  E é apagado do banco como na recusa (US-078)

Cenário: fechar um post
  Dado um post com os comentários fechados pelo moderador
  Então o formulário dá lugar ao aviso "comentários fechados", os aprovados continuam visíveis e um envio direto ao serviço é recusado sem gravar nada

Cenário: fechar tudo
  Dado a chave geral de comentários desligada
  Então todos os posts se comportam como no cenário anterior, em até 5 minutos e sem build novo do site

Cenário: post antigo fecha sozinho
  Dado um post publicado há mais de comments.openDays (90) dias
  Então os comentários dele estão fechados, como no cenário "fechar um post"
```

---

### US-080: Aviso no celular quando houver fila

**Como** CEO, **quero** um aviso no celular quando chegar comentário para moderar, **para** não precisar abrir a fila todo dia à toa.

**Prioridade:** Should
**Depende de:** US-078; D8 (canal do aviso).
**Notas:** o aviso pode passar por um serviço de terceiros (e-mail, aplicativo de notificação), então ele **nunca** leva o texto, o apelido nem o título do post: só a contagem e o link da fila. Isso também cumpre o combinado "avisar no celular quando algo esperar pelo CEO".

```gherkin
Cenário: primeiro da fila
  Dado a fila vazia
  Quando chega um comentário pendente
  Então o CEO recebe um aviso com o número de pendentes e o link da fila

Cenário: sem enxurrada
  Dado que um aviso saiu há menos de comments.notifyMinHours (6) horas
  Quando chegam mais comentários
  Então nenhum aviso novo sai até o fim desse intervalo, e o próximo traz a contagem atualizada

Cenário: aviso sem conteúdo
  Dado qualquer aviso enviado
  Então ele contém só a contagem e o link, sem texto, apelido nem título de post
```

---

### US-081: Pedir a remoção de um comentário publicado

**Como** leitor, ou como pai, mãe ou responsável, **quero** pedir a retirada de um comentário publicado, **para** que algo que me expõe, ou que expõe uma criança, saia do ar.

**Prioridade:** Must, se o `security-auditor` confirmar que o ECA Digital exige um canal de retirada para conteúdo publicado por usuários. Sem essa exigência, fica Should. Ver D10.
**Depende de:** US-077, US-078; D10 (prazo e esconder na hora).
**Notas:** segue o desenho da US-065: motivo de lista fechada, sem texto livre e sem pedir contato. Os motivos são "expõe dado pessoal meu ou de outra pessoa", "envolve criança ou adolescente", "ofensa ou discriminação", "nome real de clube ou pessoa" e "spam". Os arts. 28 a 30 da Lei 15.211/2025 tratam de retirada sem ordem judicial e de contestação por quem publicou. Como o autor é anônimo e não deixa contato, não há como avisá-lo. O `security-auditor`, e o advogado se for o caso, dizem se isso basta.

```gherkin
Cenário: pedir remoção
  Dado um comentário publicado
  Quando o leitor toca "Pedir remoção" e escolhe um motivo
  Então o pedido é registrado com o comentário, o motivo e a data, sem IP nem texto livre, e o leitor vê a confirmação com o prazo de análise

Cenário: motivos graves escondem na hora
  Dado um pedido com o motivo "expõe dado pessoal" ou "envolve criança ou adolescente"
  Então o comentário sai da página do post em até 5 minutos e volta para a fila do moderador marcado com o motivo

Cenário: pedido repetido
  Dado que já há pedido aberto para o mesmo comentário com o mesmo motivo
  Então o novo pedido não cria outro registro e o leitor vê a mesma confirmação
```

---

### US-082: Dados mínimos, prazos de guarda e política de privacidade

**Como** responsável legal, **quero** comprovar que os comentários guardam só o mínimo e pelo tempo dito, **para** cumprir a LGPD e o ECA Digital antes de abrir o formulário.

**Prioridade:** Must; nenhuma das outras vai ao ar sem esta.
**Depende de:** ADR do `architect`; revisão do `security-auditor`; textos da política escritos pelo `content-writer` e aprovados pelo CEO (seção 4).
**Notas:** o IP, mesmo embaralhado (hash), continua sendo dado pessoal pseudonimizado na LGPD e precisa aparecer na política. O registro usado no limite de envios **não pode ser ligado ao comentário**. Se a Cloudflare fizer o limite sozinha, sem gravarmos nada, melhor ainda (ponto para o `architect`). Backups automáticos do banco (o D1 guarda versões anteriores por um tempo, segundo a documentação da Cloudflare; o `architect` confirma o prazo) contam como guarda e vão para a política.

```gherkin
Cenário: só os campos permitidos
  Dado o esquema do banco de comentários
  Quando o teste de esquema roda
  Então o comentário tem só id, post, apelido, texto, data, estado (pendente ou publicado) e as sinalizações calculadas
  E nenhuma tabela de comentário ou de pedido de remoção tem IP, hash de IP, user agent, cookie ou identificador de aparelho
  E qualquer coluna nova faz o teste falhar até entrar na lista aprovada

Cenário: dado do limite de envios
  Dado o registro usado no limite de envios, se existir no nosso banco
  Então ele guarda o IP só embaralhado com uma chave que troca a cada dia, nunca o IP legível
  E nada nele aponta para um comentário
  E registros com mais de 24 horas não existem

Cenário: logs sem dados
  Dado os logs do serviço numa sessão completa (enviar, recusar automaticamente, aprovar, recusar, apagar, pedir remoção)
  Então nenhum log contém IP, apelido nem texto de comentário

Cenário: política atualizada
  Dado a página de privacidade do site
  Então ela tem a seção de comentários com os itens da seção 4 deste estudo, e a data da versão é a do dia em que os comentários foram ao ar
```

---

### US-083: Números da moderação para saber se vale a pena

**Como** CEO, **quero** ver quantos comentários chegam, quantos aprovo e quanto tempo isso me toma, **para** decidir se mantenho, ajusto ou desligo os comentários.

**Prioridade:** Should
**Depende de:** US-076, US-078.
**Notas:** só contadores agregados por semana, sem texto, apelido nem IP. Aparecem no topo da página de moderação. É a base do ponto de checagem da D13.

```gherkin
Cenário: contadores da semana
  Dado uma semana com 10 envios, 4 barrados pelos filtros, 4 aprovados, 1 recusado e 1 pendente
  Quando o moderador abre a fila
  Então vê, para a semana: recebidos 10, barrados 4 (por regra), aprovados 4, recusados 1 (por motivo), pendentes 1

Cenário: tempo até moderar
  Dado comentários moderados na semana
  Então a página mostra a mediana do tempo entre o envio e a decisão

Cenário: contadores sem dados pessoais
  Dado a tabela de contadores
  Então ela tem só semana, tipo de evento, motivo e número
```

---

## 2. Fora do escopo da primeira versão

Fica fora e não entra sem pedido novo do CEO:

- **Respostas a comentários** (conversa em árvore), inclusive a resposta da equipe como "Equipe Prancheta" (ver D9).
- **Curtidas, reações**, votos e ordenação por popularidade.
- **Notificação para quem comentou** (aprovado, recusado, resposta). Não guardamos contato, então não há como avisar.
- **Edição ou exclusão pelo autor.** Sem conta, não há como provar quem escreveu. O caminho é o "Pedir remoção" (US-081). Um "código para apagar o próprio comentário" fica para depois, se fizer falta.
- **Edição do texto pelo moderador** (D4).
- **Conta, login, e-mail, avatar, selo de apoiador.**
- **Links clicáveis, Markdown, imagens, menções (`@`), emojis personalizados.** Emoji Unicode comum é só texto e passa.
- **Comentários em outras páginas do site e dentro do jogo (`/jogo`).** O jogo continua sem nenhum texto livre (regra do `CLAUDE.md` e do ECA Digital).
- **RSS de comentários**, contagem de comentários na lista do devlog, busca e paginação.
- **Moderação por IA ou por serviço de terceiros** (análise de toxicidade e afins).
- **Mais de um moderador** e o painel de admin completo (Etapa 6).
- **Importar ou espelhar as Discussões do GitHub.** O suporte continua lá (P13), e os comentários são sobre os posts.
- **Tradução** do formulário ou das regras (o site é só pt-BR).

---

## 3. Regras de moderação e de conteúdo

Estas regras viram texto público ("Regras dos comentários"), escrito pelo `content-writer` e aprovado pelo CEO. Ficam linkadas no formulário e citadas na política.

### O que se aprova

- Opinião, sugestão, dúvida e **crítica ao jogo ou ao projeto, mesmo dura, quando é educada**. Isso precisa estar escrito, para a moderação não parecer filtro de elogio.
- Relato de bug, citando aparelho e navegador ("no Android, no Chrome"). Nome de aparelho e de navegador é informação técnica, não propaganda.
- Comparação com o futebol real **sem nome real**: "parece o campeonato brasileiro", "aquele clube grande do Rio".
- Texto em pt-BR, espanhol ou inglês (D12).

### O que se recusa

| Motivo (lista fechada, usada na recusa e nos contadores) | Exemplos                                                                                                                                                                     | Automático?                                                       |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------- |
| `link_or_spam`                                           | link, propaganda, divulgação de canal, perfil ou produto, texto repetido                                                                                                     | link sim (US-076); o resto, moderador                             |
| `personal_data`                                          | telefone, e-mail, endereço, CEP, escola, `@` de rede social, nome completo (seu ou de outra pessoa), foto ou documento descrito                                              | e-mail e telefone sim; o resto é sinalizado                       |
| `real_name`                                              | nome de clube, jogador, técnico, dirigente, árbitro, jornalista, emissora, programa ou pessoa pública real; marca real em tom de propaganda                                  | sinalizado pela lista bloqueada; quem recusa é o moderador (D3)   |
| `offense`                                                | palavrão, xingamento, ataque a outro comentarista, discriminação (raça, cor, origem, região, religião, gênero, orientação, deficiência), rivalidade que vira ódio de torcida | palavrão sinalizado; o resto, moderador                           |
| `unsafe_for_minors`                                      | conteúdo sexual, violência, drogas, **apostas e sites de bet**, bebida alcoólica, pedido de contato privado ("me chama no zap", "manda DM")                                  | moderador; pedido de contato com número ou `@` já cai nos filtros |
| `impersonation`                                          | apelido que se passa pela equipe, pelo projeto ou por outra pessoa                                                                                                           | nomes reservados sim (US-076)                                     |
| `off_topic`                                              | política partidária, assunto que não tem a ver com o jogo nem com o post                                                                                                     | moderador                                                         |
| `unreadable`                                             | texto que o moderador não consegue entender (idioma, só símbolos)                                                                                                            | moderador                                                         |

### Nomes reais de clubes e pessoas

- A regra do `CLAUDE.md` para o site é absoluta: nenhum nome real de clube, jogador ou pessoa. Comentário aprovado faz parte do site. **Recomendação: recusar** e avisar disso **antes** do envio, no formulário (D3).
- A lista bloqueada em hash (`npm run blocklist:hash`, clubes, estádios, atletas) **sinaliza** e não recusa sozinha, porque bate com palavras comuns: "Santos" é sobrenome, "Internacional" é adjetivo, "América" é continente.
- O moderador não edita para tirar o nome (D4). Recusa, e a pessoa pode reescrever.

### Dados pessoais no texto

- E-mail, telefone e link são barrados no envio (US-076). A mensagem diz a regra, e a pessoa reescreve.
- O resto (endereço, escola, `@`, nome completo) é sinalizado e recusado pelo moderador.
- Apelido: apelido ou primeiro nome passam. Nome e sobrenome são recusados (D2). O campo traz a dica "não use seu nome completo".

### O que acontece com o comentário recusado

- É **apagado na hora**: texto, apelido e data. Fica só o contador agregado "motivo X, semana Y" (US-083).
- O autor **não é avisado**, porque não temos contato. A confirmação de envio já diz que nem todo comentário é publicado e linka as regras.
- O pendente que passa de 30 dias sem decisão segue o mesmo caminho, com o motivo "expirado".
- O publicado que é apagado depois (US-079) ou retirado por pedido (US-081) também é apagado de vez, sem marca na página.
- Cópias de segurança automáticas do banco podem guardar o texto por alguns dias depois de apagado. A política diz isso (seção 4).

---

## 4. Mudanças na página de privacidade (`site/src/pages/privacidade.astro`)

O texto é do `content-writer`, com aprovação do CEO e revisão do `security-auditor`. A página precisa:

1. **Nova seção "Comentários no devlog"**, dizendo:
   - o que guardamos: texto, apelido (ou "Anônimo"), data e o post comentado. Nada de e-mail, conta, nome, idade ou identificador de aparelho;
   - que o comentário é **público** depois de aprovado e que todo comentário é revisado antes por uma pessoa (o responsável do projeto);
   - que não se deve publicar dado pessoal (nome completo, e-mail, telefone, endereço, escola, perfil de rede social), seu nem de ninguém, e que comentário com esses dados é recusado;
   - prazos: recusado, apagado na hora; pendente não revisado, apagado em 30 dias; publicado, fica até o post sair do ar, até um pedido de remoção aceito ou até a equipe apagar; cópias de segurança automáticas guardam o banco por até N dias (o número vem do ADR);
   - o IP: se gravarmos algo, que ele é usado **só** para limitar envios, guardado embaralhado com uma chave que troca todo dia, nunca ligado ao comentário e apagado em 24 horas; se o limite for feito pela Cloudflare, que ela processa o IP para isso, conforme a política dela;
   - como pedir remoção (botão "Pedir remoção" em cada comentário) e em quanto tempo o pedido é analisado (D10);
   - que o autor não consegue editar nem apagar sozinho e que, como não temos contato, não avisamos sobre aprovação ou recusa;
   - o aviso no celular do CEO, se passar por terceiro, leva só a contagem, sem conteúdo (quase um detalhe, mas evita a pergunta);
   - a base legal da LGPD para esse tratamento (o `security-auditor` define).
2. **Bullet "Neste site"**: hoje diz "sem chamadas a terceiros". Continua verdade se o Turnstile não entrar. Se entrar (D1), a página precisa dizer que o formulário usa o Turnstile da Cloudflare, que ele lê sinais do navegador para separar pessoas de robôs, e linkar a política dele. Continua valendo "sem cookies de rastreamento".
3. **Seção "Infraestrutura"**: a frase "O jogo não grava endereços IP" fica, porque fala do jogo. Ganha a ressalva do IP dos comentários do site, se houver.
4. **Seção "Menores de idade"**: hoje diz que não há "chat de texto livre" (no jogo). Ela precisa separar: **no jogo**, nada de texto livre; **no site**, comentários com texto livre, publicados só depois da revisão, sem pedir idade nem dado nenhum, com o pedido de remoção para responsáveis.
5. **Data da versão** atualizada no topo.
6. **Coerência em outros lugares**: as páginas `perguntas.astro` e o rodapé ganham, se o CEO quiser, uma pergunta "Posso comentar nos posts?" (Could, mesmo PR de texto). A política continua curta: a seção nova deve ter no máximo uns 10 itens.

---

## 5. Riscos de produto

| Risco                                                                                                                                                                          | Chance | Impacto | Mitigação                                                                                                                                                                                                         |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------ | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Carga de moderação**: o CEO é o único moderador e não há prazo de resposta; a fila acumula e o leitor acha que foi ignorado                                                  | média  | médio   | filtros automáticos (US-076), teto da fila, expiração em 30 dias, aviso agregado (US-080), posts fechando em 90 dias, chave geral para desligar, números semanais (US-083); a confirmação não promete prazo       |
| **Spam**: o formulário é achado por robôs em dias; sem moderação prévia, seria o maior risco                                                                                   | alta   | baixo   | nada é publicado sem aprovação, então o spam só pesa na fila; link barrado no envio, campo-isca, tempo mínimo, limite por origem, teto da fila; Turnstile como segundo degrau (D1)                                |
| **Polêmica**: comparação com clubes reais, rivalidade de torcida, política, crítica ao jogo; recusar nomes reais pode soar como censura                                        | média  | médio   | regras públicas antes do envio, aprovação explícita de crítica educada, fechar um post na hora (US-079), apagar publicado                                                                                         |
| **Risco legal (ECA Digital e LGPD)**: o site passa a publicar texto de usuário num ambiente de acesso provável por menores, com obrigações de retirada e talvez de contestação | média  | alto    | moderação prévia, pedido de remoção com motivos graves escondendo na hora (US-081), dados mínimos (US-082), revisão do `security-auditor`; a consulta ao advogado (pendente no PROJETO) pode ser antecipada (D10) |
| **Seção vazia**: poucos leitores comentam, e "0 comentários" passa a ideia de projeto sem público                                                                              | alta   | baixo   | não mostrar o zero (US-077), convite para comentar; checagem em 8 semanas (D13)                                                                                                                                   |
| **Personificação**: sem conta, qualquer um escreve com o apelido de outro comentarista frequente                                                                               | baixa  | baixo   | nomes da equipe reservados; o resto, moderação; nas regras, "apelido não é identidade"                                                                                                                            |
| **Frustração com a demora**: o comentário só aparece dias depois                                                                                                               | média  | baixo   | confirmação clara ("aparece depois de revisado, pode levar alguns dias")                                                                                                                                          |
| **Desvio da 1a**: é a primeira peça de servidor, banco e acesso protegido, adiantada da 1b e da Etapa 6; pode puxar trabalho de infraestrutura para antes do jogo jogável      | média  | médio   | trilha paralela que não passa na frente das tarefas da 1a (D11); custo zero confirmado pelo `devops-engineer` antes; o `_headers`/CSP (dívida L2) entra antes                                                     |
| **Conflito com o processo**: se mostrar um aprovado exigir build novo do site, isso esbarra em "publicação só por merge do CEO"                                                | média  | médio   | o critério de 5 minutos sem merge (US-077) obriga o ADR a resolver                                                                                                                                                |
| **Vazamento da fila**: pendentes podem conter dado pessoal antes da revisão                                                                                                    | baixa  | alto    | acesso só do CEO com segundo fator, expiração em 30 dias, aviso sem conteúdo, logs sem texto                                                                                                                      |

### Como medir se vale a pena

Os números saem só dos contadores agregados (US-083), sem rastrear leitor:

- **Aprovados por post**, nas 4 semanas seguintes à publicação.
- **Taxa de aproveitamento**: aprovados ÷ (recebidos − barrados).
- **Carga**: comentários moderados por semana × um tempo estimado por decisão. Fica como estimativa, porque o tempo real do CEO não é medido. Junto, a **mediana do envio até a decisão**.
- **Pressão de spam**: barrados por semana e o tamanho máximo da fila.
- **Ponto de checagem** depois de 8 semanas (D13). Se a média for menor que 1 aprovado por post, ou se a moderação passar de uns 30 minutos por semana, o CEO decide entre ajustar (fechar posts mais cedo, ligar o Turnstile) e desligar. A chave geral desliga sem apagar o que já foi publicado.

---

## 6. Decisões que o CEO precisa tomar

**D1. Turnstile ou não. Aqui contesto a direção proposta.**
O Turnstile é um script de fora (`challenges.cloudflare.com`) que lê sinais do navegador. Ele quebra duas promessas atuais: a regra "nada de scripts de terceiros no site" e a frase da política "sem chamadas a terceiros". E ele não funciona sem JavaScript, o que contradiz o envio sem JavaScript. Com moderação prévia, o spam nunca chega ao público, só à fila do CEO.
**Recomendação:** começar **sem Turnstile**. Usar campo-isca, tempo mínimo, limite por origem, link barrado no envio e teto da fila. Ligar o Turnstile só se mais de uns 20 spams por dia chegarem à fila por uma semana, com ADR curto e a política atualizada.

**D2. "Ou nome": o comentarista pode assinar com o próprio nome?**
O pedido diz "anônimo ou com um apelido ou nome", mas o `CLAUDE.md` proíbe nome de pessoa real no site, e nome completo de menor é o dado mais sensível que poderia aparecer.
**Recomendação:** aceitar apelido ou **só o primeiro nome**. Nome e sobrenome são recusados na moderação (sinalizados na fila), e o campo traz a dica "não use seu nome completo".

**D3. Nomes reais de clubes e pessoas dentro dos comentários.**
**Recomendação:** recusar, com o aviso no formulário antes do envio e a sinalização pela lista bloqueada. A alternativa (permitir só nos comentários) muda uma regra absoluta do projeto e pediria ADR.

**D4. O moderador pode editar o texto, por exemplo para tirar um telefone ou um nome?**
**Recomendação:** não. Só aprovar ou recusar. Editar põe palavras na boca do autor e complica o pedido de remoção.

**D5. O que fazer com o recusado.**
**Recomendação:** apagar na hora e guardar só o contador do motivo. Sem "lixeira".

**D6. Prazo da fila.**
**Recomendação:** pendente sem decisão é apagado em 30 dias.

**D7. Por quanto tempo um post aceita comentários.**
**Recomendação:** 90 dias a partir da data do post, mais a chave por post e a chave geral. Os posts que já existem seguem a mesma regra.

**D8. Canal do aviso no celular.**
**Recomendação:** e-mail para o endereço do CEO enviado pela própria Cloudflare (sem terceiro novo), só com a contagem, no máximo um a cada 6 horas. O `architect` confirma se cabe no custo zero. Se não couber, a alternativa é a fila conferida à mão.

**D9. A equipe responde nos comentários ("Equipe Prancheta")?**
**Recomendação:** fora da primeira versão. Volta na checagem de 8 semanas, se houver conversa.

**D10. Pedido de remoção (ECA Digital): entra na primeira versão e com que prazo?**
**Recomendação:** entrar na v1 (US-081). Os motivos "dado pessoal" e "criança ou adolescente" escondem na hora. Os outros são analisados em até 48 horas, prazo dito na confirmação e na política. Pedir ao `security-auditor` que confirme os arts. 28 a 30 da Lei 15.211/2025 e decida se a consulta ao advogado, hoje prevista "antes de monetizar", deve vir antes dos comentários.

**D11. Quando entra.**
**Recomendação:** trilha paralela do site, depois do `_headers`/CSP (dívida L2), sem passar na frente das tarefas da 1a. Uma história por PR, nesta ordem: US-082 (dados e esquema), US-075, US-076, US-078, US-077, US-079, US-081, US-080 e US-083. O formulário só abre ao público quando US-075 a US-079, US-081 e US-082 estiverem no ar.

**D12. Limites e detalhes (podem ser aceitos em bloco).**
**Recomendação:**

- texto de 3 a 800 caracteres;
- apelido até 24 caracteres;
- 3 envios por 10 minutos e 10 por dia por origem;
- teto de 200 pendentes;
- tempo mínimo de 3 segundos para preencher;
- comentários em pt-BR, espanhol ou inglês aceitos (o público sul-americano é esperado);
- ordem do mais antigo para o mais novo;
- sem mostrar "0 comentários".

**D13. Critério de sucesso.**
**Recomendação:** checagem depois de 8 semanas com os números da US-083. Abaixo de 1 aprovado por post em média, ou acima de uns 30 minutos de moderação por semana, o CEO decide entre ajustar e desligar.

---

## 7. Pontos para o `architect` (ADR) e o `security-auditor`

Estas são exigências de produto que mexem na arquitetura. Não escolho tecnologia.

- **Envio e leitura sem JavaScript** (US-075, US-077): o site hoje é estático, então isso pede uma resposta do servidor para o envio e um jeito de os aprovados chegarem ao HTML.
- **Aprovado visível em até 5 minutos, sem merge nem build manual** (US-077, US-079). A chave geral também não pode exigir build.
- **Comentário sem nenhum vínculo com IP** (US-082). Se der, o limite de envios fica na borda da Cloudflare, sem gravarmos nada.
- **Prazo dos backups automáticos do banco**, que entra na política.
- **Acesso à fila só do CEO** e com segundo fator. O `docs/PROJETO.md` cita Cloudflare Access para o admin; fica como restrição.
- **Custo zero:** confirmar que o volume esperado cabe no gratuito dos Workers e do D1.
- **Onde ficam o código e os parâmetros:** `site/`, `server/` ou outro lugar. O `server/` está fora do `/quick`, e isto é `/feature` de qualquer jeito.
- **`security-auditor`:**
  - base legal da LGPD;
  - arts. 28 a 30 do ECA Digital (retirada e contestação com autor anônimo);
  - se a consulta ao advogado deve vir antes;
  - CSP do site com o formulário.
