# Modos de jogo

> Status: **aguardando ok do CEO**. Autor: `tech-writer`. Só pt-BR. `{config.name}` = nome de `config/prancheta.config.ts`. Fonte: `docs/PROJETO.md` (Modo online, Ritmo, Saves). Nenhuma data prometida.

## Abertura

O {config.name} tem dois modos: **Carreira**, para jogar sozinho, e **Liga online**, para jogar com os amigos. E dois ritmos, que você escolhe ao começar: **No meu ritmo** e **Tempo real**.

## Carreira (offline)

Você, um clube e uma temporada pela frente. Tudo roda no seu aparelho: sem internet, sem cadastro.

- Escolha o clube, escale, ajuste a tática e avance quando quiser.
- O jogo salva sozinho ao fim de cada rodada.
- Exporte o save quando quiser e leve para outro aparelho.

Estado: **em desenvolvimento** (Etapa 1a). Metas da diretoria, demissões e propostas de outros clubes: **planejado (Etapa 4)**.

## Liga online

Um amigo cria a liga, escolhe o jeito de jogar e passa um código de convite. Cada um assume um clube. Os outros clubes ficam por conta do computador.

A rodada roda no servidor, com o mesmo motor da carreira. Ninguém mexe no resultado.

### Como é uma rodada

1. Cada um ajusta escalação e tática e aperta "Pronto".
2. Quando todos confirmam, ou quando o prazo acaba, o servidor joga a rodada.
3. Quem não confirmou joga com a última escalação salva.
4. Resultados, tabela e notícias chegam para todo mundo.

### Ao vivo ou assíncrono

|                 | Ao vivo                             | Assíncrono                  |
| --------------- | ----------------------------------- | --------------------------- |
| Prazo da rodada | Curto, por exemplo 2 minutos        | Longo, por exemplo 24 horas |
| Quem está lá    | Todo mundo ao mesmo tempo           | Cada um entra quando puder  |
| O que se vê     | Placares ao vivo, mensagens prontas | Aviso de rodada processada  |
| Tamanho padrão  | Até 8 jogadores                     | Até 30 jogadores            |

Os números são o padrão e podem ser ajustados. O dono da liga pode trocar de ao vivo para assíncrono (e o contrário) no meio da temporada.

### Conta sem dados pessoais

Para jogar online você escolhe um apelido e usa a biometria do celular (passkey). Sem e-mail, telefone, nome real ou data de nascimento. Você recebe um código de recuperação: guarde bem, porque sem ele e sem o aparelho a conta se perde.

### Conversa entre jogadores

Só mensagens prontas e emojis. Dá para desligar. Apelidos são filtrados e há botão de denúncia.

Estado: liga da Série A entre amigos, por código, **planejado (Etapa 1b)**. Ligas grandes com várias divisões e torneios continentais: **planejado (Etapa 6)**. Mercado entre jogadores: **planejado (Etapa 3)**.

## Os dois ritmos

### No meu ritmo (padrão)

Você avança a rodada quando quiser. Na carreira, sem pressa. No online, pelo prazo da liga.

Estado: **em desenvolvimento** (Etapa 1a, na carreira).

### Tempo real

A temporada acompanha as datas do futebol brasileiro: estaduais no começo do ano, Brasileirão de abril a dezembro, copas nas semanas certas.

- No dia da rodada, você recebe o aviso, monta o time e joga. Nos outros dias, cuida do clube.
- Perdeu o dia? Sem drama: a partida é jogada com a última escalação e o resultado espera por você.
- Só as datas são reais. Resultados, times e nomes continuam fictícios.
- O jogo chama você uma vez por rodada, e não dá recompensa por ficar mais tempo.

Estado: **planejado (Etapa 4)**, na carreira e no online.

## Qual escolher?

- Dez minutos no ônibus: Carreira, no meu ritmo.
- Resenha com os amigos: Liga online, ao vivo.
- Cada um no seu horário: Liga online, assíncrona.
- Uma temporada que dura o ano inteiro: tempo real.
