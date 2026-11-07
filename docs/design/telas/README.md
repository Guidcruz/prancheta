# Telas da Etapa 1

> Escrito pelo `ux-designer` no `/kickoff` da Etapa 1. Descreve telas, navegação e componentes; não define regras nem números de jogo (são do `game-designer`, em `docs/design/`) nem textos finais (são do `content-writer`, em `app/src/content/<idioma>/`). Fontes: `docs/01-requirements.md`, `docs/PROJETO.md` (Padrões de design; Animações e engajamento saudável), `docs/design/design-system.md`, `design/tokens.json`.

Catálogo de componentes compartilhados: [componentes.md](componentes.md).

## Princípios que valem em toda tela

- **Mobile first, uma mão.** Tudo o que se usa em toda rodada fica na metade de baixo da tela. O topo é para leitura (título, placar) e para o que se usa pouco (menu).
- **Um botão primário por tela.** Nas telas com abas, o primário é sempre o "Jogar rodada"; os outros botões são secundários.
- **Voltar pelo sistema.** Cada tela e cada folha tem um endereço no histórico, para o gesto ou botão voltar do celular funcionar. O botão de voltar no cabeçalho existe, mas não é o único caminho.
- **Offline é o normal.** A carreira é toda local: nenhuma tela da 1a mostra aviso de "sem conexão" por padrão. Só o que depende de rede (links externos, aviso de nova versão) diz que precisa de conexão.
- **Sem pressa artificial.** Nenhuma contagem regressiva, recompensa por voltar ou reprodução automática de rodadas (PROJETO › Animações e engajamento saudável).
- **Áreas seguras.** Barra de abas e botão flutuante respeitam `env(safe-area-inset-bottom)`; o conteúdo rolável tem respiro embaixo igual à altura da barra mais o botão, para nada ficar escondido.
- **Textos de tamanho variável.** Todo rótulo deve caber em es e en (em média 20 a 30% mais longos): botões quebram em duas linhas em vez de cortar; rótulos de aba são verificados com o mais longo dos três idiomas.

## Índice das telas da 1a

Prioridade herdada das histórias (Must, Should, Could). A ordem é a sugerida para implementar: cada tela usa componentes das anteriores e destrava um fluxo testável de ponta a ponta o quanto antes.

| Ordem | Tela                                        | Histórias                      | Prioridade | Componentes principais                                             |
| ----- | ------------------------------------------- | ------------------------------ | ---------- | ------------------------------------------------------------------ |
| 1     | [Moldura e navegação](navegacao.md)         | US-015                         | Must       | AppShell, TabBar, PlayRoundButton, ScreenHeader                    |
| 2     | [Início](inicio.md)                         | US-034, US-043                 | Must       | CareerCard, Button, Banner                                         |
| 3     | [Novo jogo](novo-jogo.md)                   | US-014                         | Must       | TextField, ClubOption, OptionGroup, Button                         |
| 4     | [Clube](clube.md)                           | US-015, US-026, US-028         | Must       | SectionCard, MatchCard, FanThermometer, TableRow, LinkRow          |
| 5     | [Elenco](elenco.md)                         | US-016                         | Must       | ScrollTable, PlayerRow, GroupRow, StatusBadge, SegmentedControl    |
| 6     | [Jogador](jogador.md)                       | US-016                         | Must       | BottomSheet, PlayerCard (completo), Avatar, AttributeBar           |
| 7     | [Escalação](escalacao.md)                   | US-017                         | Must       | LineupPitch, PlayerCard (linha), StrengthBars, StatusBadge         |
| 8     | [Tática](tatica.md)                         | US-018                         | Must       | OptionGroup, LineupPitch (prévia), BottomSheet                     |
| 9     | [Resumo da rodada](resumo-rodada.md)        | US-019, US-041                 | Must       | Scoreboard, StatusBadge, MatchCard, BrandSlot                      |
| 10    | [Tabela](tabela.md)                         | US-023                         | Must       | ScrollTable, TableRow, StatusBadge                                 |
| 11    | [Calendário](calendario.md)                 | US-024                         | Must       | MatchCard, StatusBadge                                             |
| 12    | [Partida](partida.md)                       | US-020, US-021, US-041         | Must       | MatchPitch, Scoreboard, CommentaryFeed, GoalCelebration, BrandSlot |
| 13    | [Intervalo](intervalo.md)                   | US-022                         | Should     | OptionGroup, Scoreboard                                            |
| 14    | [Notícias](noticias.md)                     | US-028                         | Must       | NewsCard, EmptyState                                               |
| 15    | [Rede social](rede-social.md)               | US-029, US-044                 | Must       | SocialPost, Avatar, EmptyState                                     |
| 16    | [Entrevista pós-jogo](entrevista.md)        | US-030                         | Should     | BottomSheet, OptionGroup                                           |
| 17    | [Fim de temporada](fim-temporada.md)        | US-025, US-037                 | Must       | Crest, ScrollTable, TableRow, Banner                               |
| 18    | [Carreiras e backup (saves)](saves.md)      | US-034, US-035, US-036, US-037 | Must       | CareerCard, ConfirmSheet, Banner                                   |
| 19    | [Preferências](preferencias.md)             | US-044, US-040, US-037         | Should     | Toggle, SegmentedControl, LinkRow                                  |
| 20    | [Sobre](sobre.md)                           | US-043, US-039, US-045         | Must       | LinkRow, Banner, ConfirmSheet                                      |
| 21    | [Tutorial](tutorial.md)                     | US-042                         | Should     | Coachmark, BottomSheet                                             |
| 22    | [Erros e avisos globais](erros-e-avisos.md) | US-045, US-039, US-037, US-038 | Must       | ErrorState, ErrorBoundary, Banner, BottomSheet                     |

US-046 (estatísticas de uso, Could) não tem tela: se entrar, aparece só como uma linha informativa em Sobre. As histórias de motor, conteúdo e ferramentas (US-001 a US-013, US-027, US-031 a US-033) não têm tela própria; os geradores de US-002 e US-005 aparecem pelos componentes Crest e Avatar.

## Mapa de navegação

### Celular (até o breakpoint de desktop)

```
Início ──► Novo jogo ──► (carreira criada) ──► Clube  [+ Tutorial na 1a carreira]
  │  └──► Carreiras e backup (importar, exportar, apagar)
  └──► Continuar ─────────────────────────────► Clube

Dentro da carreira: barra de abas embaixo + botão "Jogar rodada" flutuante

  [Clube]        [Elenco]                     [Tabela]      [Calendário]
  Clube          Elenco | Escalação | Tática  Tabela        Calendário
   ├─ Notícias    └─ Jogador (folha)                         └─ Rodada (10 resultados)
   ├─ Rede social
   └─ Mais: Carreiras e backup · Preferências · Sobre · Rever tutorial
   (o mesmo "Mais" abre pelo ícone de menu do cabeçalho em qualquer aba)

"Jogar rodada"
   ├─ escalação incompleta? ──► folha "Completar automaticamente"
   ├─ só resultado ──────────────────────────────► Resumo da rodada
   └─ animada / lances principais ──► Partida ──► Intervalo ──► Partida ──► Resumo da rodada
                                        └─ folhas: Comandos · Substituir · Tática
Resumo da rodada ──► [Entrevista, quando sorteada] ──► volta à aba de origem
Resumo da rodada 38 ──► [Lembrete de exportar] ──► Fim de temporada ──► Próxima temporada ──► Clube
```

- Abas na 1a: **Clube, Elenco, Tabela, Calendário** (a aba Mercado só entra na Etapa 3, entre Tabela e Calendário, como no PROJETO).
- Elenco, Escalação e Tática dividem a mesma aba com um seletor no topo, porque são o mesmo trabalho de preparação da rodada; a última escolhida é lembrada.
- Notícias e Rede social não são abas: abrem a partir dos blocos da tela Clube (e da entrada "Mais"). Assim a barra continua com 5 abas quando o Mercado chegar.
- Partida, Intervalo, Resumo, Entrevista e Fim de temporada são telas cheias, sem abas nem botão flutuante: não há como sair da rodada pela metade sem passar pelo "Pular".

### Desktop (acima do breakpoint)

```
┌───────────────┬──────────────────────────────────────────────┐
│ Nome do jogo  │  Cabeçalho da tela                           │
│ Escudo + clube│                                              │
│ ───────────── │  Conteúdo (largura máxima de leitura;        │
│ Clube         │  Clube em duas colunas; Tabela e Elenco      │
│ Elenco        │  com todas as colunas visíveis, sem rolagem   │
│ Tabela        │  lateral quando couber)                      │
│ Calendário    │                                              │
│ Notícias      │  Jogador e folhas abrem como painel lateral  │
│ Rede social   │  à direita ou diálogo central                │
│ ───────────── │                                              │
│ Carreiras     │                                              │
│ Preferências  │                                              │
│ Sobre         │                                              │
│ [Jogar rodada]│                                              │
└───────────────┴──────────────────────────────────────────────┘
```

- A mesma lista de destinos vira barra lateral (US-015); Notícias e Rede social ganham entrada própria porque há espaço.
- "Jogar rodada" fica fixo no pé da barra lateral, sempre visível.
- A Partida usa a largura toda: campo à esquerda, narração e controles à direita.
- Nenhuma tela tem rolagem horizontal da página; só as tabelas rolam por dentro, e só se não couberem.

## Marcas fictícias no cenário (US-041, ADR-0015)

O patrocínio real está desligado e não é anunciado (ADR-0015). Os espaços abaixo são **cenário**: mostram marcas fictícias da lista de conteúdo aprovada pelo CEO, como as placas de um estádio de verdade, e não são publicidade.

- **Ponto único.** Toda marca exibida vem de `brandForSlot(slot, ctx, brands)` (pura e determinística: depende só do espaço, da rodada, do clube e do estádio; igual para todos). Nenhuma tela escreve nome de marca direto.
- **Componente.** Todos usam o BrandSlot (ver [componentes.md](componentes.md)), que só desenha o `FictionalBrand` que recebe.
- **Sem cara de anúncio.** Sem rótulo de "publicidade", sem link, sem rede, sem contagem de impressões. Nenhuma tela convida a anunciar ("Patrocine aqui", "Anuncie aqui", "Quer anunciar?" e parecidos não existem no jogo).
- **Decorativo.** A marca não é alvo de toque nem recebe foco; o BrandSlot leva `aria-hidden="true"` (se for imagem, `alt=""`), porque não carrega informação de jogo. Nas placas do campo, já vale o `aria-hidden` do canvas; o resumo acessível da partida não cita marcas.
- **Cores.** As duas cores da marca (`colors`) são dado da marca, como as cores do clube no escudo, e não cor de interface; moldura, fundo e espaçamento da faixa são só tokens. A faixa nunca parece botão (sem seta, sem sublinhado, sem sombra de elevação) e nunca disputa atenção com o primário da tela.

| Espaço (`SlotId`)                         | Tela                                                                                                                                                                         |
| ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Placas em volta do campo (`pitch-boards`) | Partida (desenhadas no canvas pelo MatchPitch)                                                                                                                               |
| Placar (`scoreboard`)                     | Partida e Intervalo (faixa do Scoreboard)                                                                                                                                    |
| Resumo da rodada (`round-summary`)        | Resumo da rodada (faixa abaixo do placar)                                                                                                                                    |
| Tela de carregamento (`loading`)          | Carregando ao criar a carreira, ao calcular a rodada, ao abrir a partida e na virada da temporada, só se a espera existir                                                    |
| Camisa (`shirt`)                          | **Fica para depois da Etapa 1a**, a menos que o CEO decida diferente: só quando houver prévia de uniforme maior que as bolinhas do campo; nenhuma tela da 1a tem esse espaço |

O nome do estádio não é espaço de marca: é o nome do estádio fictício que vem do conteúdo, sem marca e fora do `brandForSlot`.

Nenhum espaço fica em Início, Novo jogo, Elenco, Escalação, Tática, Preferências, Saves, Sobre ou Tutorial (a tela de carregamento que abre a partir delas é outra tela): são telas de decisão e de configuração, e as marcas são só cenário.

## Telas da 1b (só a lista)

- Conta: criar com apelido e passkey (US-047); código de recuperação (US-048); entrar e recuperar em outro aparelho (US-049); apagar conta (US-050).
- Ligas online: minhas ligas (entrada a partir do Início); criar liga (US-051); entrar por convite (US-052); escolha de clubes livre e sorteio (US-053); draft (US-054).
- Rodada online: preparar e confirmar "Pronto", com o estado dos outros técnicos (US-055); partidas ao vivo vistas juntas (US-057); aviso de rodada processada (US-058); resultados, tabela e notícias da liga, reaproveitando Resumo, Tabela e Notícias (US-059).
- Administração da liga pelo dono: modo, prazos e inatividade (US-060, US-061).
- Mensagens prontas e emojis (US-062); fim de temporada e duração da liga (US-063); privacidade atualizada (US-064); denunciar apelido ou nome de liga (US-065).

## Pendências que dependem de outros

- Breakpoint de desktop, durações de animação e conjunto de ícones não existem no design system: propostas em [componentes.md](componentes.md#propostas-ao-design-system).
- O que aparece como "força" do clube no Novo jogo e o que define "zona" na Tabela além das 4 últimas vêm do `game-designer`.
