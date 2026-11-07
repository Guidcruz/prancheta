# Design system (resumo)

A fonte é o artefato "Prancheta" no claude.ai (tokens, brand book e componentes com prévia). Os tokens estão em `design/tokens.json` e viram `app/src/tokens.css` com `npm run tokens`, que também falha se algum par de cores declarado cair abaixo de 4,5:1.

Regras que o `ux-designer` cobra:

- Só tokens: nenhuma cor, fonte ou raio literal fora de `tokens.css`; classes utilitárias `botao` e `display-xl` para os tamanhos fora da escala de texto.
- Mobile first, uma mão: abas embaixo, "Jogar rodada" sempre acessível, alvos ≥ 44px.
- Tema `noite` padrão e `dia` opcional; contraste ≥ 4,5:1 nos dois.
- Resultado nunca só por cor (V/E/D ou ícone); `prefers-reduced-motion`.
- Componentes base: Escudo, CardPartida, LinhaTabela, CardJogador, BarraAbas, Botao, Noticia.
- Textos em `app/src/content/<idioma>/`; nome, logo e cores em `config/prancheta.config.ts`.

## Tipografia

A escala completa (família, tamanho, entrelinha, peso e uso de cada estilo) está em `design/tokens.json`, em `typography.groups`. Aqui ficam só os acréscimos aprovados depois da exportação do artefato.

### Nome na figurinha (aprovado pelo CEO em 2026-11-04)

| Token               | Família                    | Peso | Tamanho / entrelinha | Uso                                                                |
| ------------------- | -------------------------- | ---- | -------------------- | ------------------------------------------------------------------ |
| `sticker-name`      | display (Barlow Condensed) | 800  | 20px / 24px          | Nome curto do clube na figurinha (cartão de clube do álbum).       |
| `sticker-name-long` | display (Barlow Condensed) | 800  | 17px / 22px          | O mesmo nome quando é longo demais para caber em uma linha a 20px. |

- Os dois tokens moram em `design/tokens.json`, grupo "Placar e títulos", e chegam ao CSS por `npm run tokens`; nenhum componente declara esses tamanhos à mão.
- A troca para `sticker-name-long` é por comprimento do nome, decidida no componente (no site, `Sticker.astro` usa o longo quando o nome curto passa de 10 caracteres).
- Uso restrito à figurinha. Nome de clube em card comum continua em `subtitulo`; em tabela, em `body-strong`.

### Mínimo do `display-xl` (aprovado pelo CEO em 2026-11-04)

| Token        | Antes                      | Depois                     |
| ------------ | -------------------------- | -------------------------- |
| `display-xl` | `clamp(72px, 21vw, 196px)` | `clamp(64px, 21vw, 196px)` |

- Só o mínimo muda, de 72px para 64px, para "PRANCHETA" caber em uma linha a 320px de largura. O máximo (196px), a entrelinha (0,84), o peso (800), o espaçamento e a caixa alta continuam iguais.
- Uso continua restrito ao nome do jogo no hero do Início do site.

### Número da etapa (aprovado pelo CEO em 2026-11-04)

| Token          | Família                    | Peso | Tamanho / entrelinha | Uso                                                           |
| -------------- | -------------------------- | ---- | -------------------- | ------------------------------------------------------------- |
| `stage-number` | display (Barlow Condensed) | 800  | 26px / 1             | Número da etapa nos cartões de etapa e nas tabelas de etapas. |

- Mora em `design/tokens.json` e chega ao CSS por `npm run tokens`; nenhum componente declara esse tamanho à mão.
- Mesma família display já usada nos títulos; não entra fonte nova.
- Uso restrito ao número da etapa. O nome e a descrição da etapa continuam nos estilos de texto comuns; números em tabela seguem em `tabular-nums`.

## Tamanhos (aprovado pelo CEO em 2026-11-07)

| Token               | Valor | Uso                                                                |
| ------------------- | ----- | ------------------------------------------------------------------ |
| `size-bar`          | 4px   | Altura das barras de atributo, condição e moral (AttributeBar).    |
| `size-bar-lg`       | 8px   | Altura da barra do termômetro da torcida (FanThermometer).         |
| `size-medallion-sm` | 32px  | Escudo e avatar pequenos: listas, linhas de tabela, barra lateral. |
| `size-medallion-md` | 48px  | Escudo e avatar médios: cards.                                     |
| `size-medallion-lg` | 64px  | Escudo e avatar grandes: cabeçalho da tela Clube.                  |
| `size-medallion-xl` | 96px  | Escudo e avatar em destaque: card do jogador, comemoração.         |

- Moram em `design/tokens.json`, no grupo de espaçamento ao lado do `touch` (o mesmo caso: tamanho, não espaçamento), e chegam ao CSS por `npm run tokens`.
- Escudo e avatar dividem a mesma escala: um medalhão de 48px tem o mesmo tamanho seja clube ou jogador.
- Os geradores (`shield.ts`, `avatar.ts`) recebem a largura em número; por isso `CREST_SIZES` e `AVATAR_SIZES` repetem os valores, com comentário apontando para cá, até o gerador de tokens exportar também constantes TypeScript.
- Nenhuma barra nem medalhão declara altura ou largura à mão fora dessas medidas.

## Padrões de layout

### Tabela vira cartões abaixo de 720px (aprovado pelo CEO em 2026-11-04)

Vale para o site e para as telas futuras do jogo.

**Quando usar.** Em tabelas cujo texto principal (descrição, nome longo, frase) não cabe ao lado da coluna fixa a 360px sem forçar rolagem horizontal para ler a própria linha. Tabelas numéricas curtas (classificação, artilharia) continuam com a coluna do clube fixa e rolagem horizontal, como na regra geral.

**Regras.**

- A partir de 720px a tabela é uma tabela normal: cabeçalho, coluna fixa à esquerda, linhas de 48px, números em `tabular-nums`.
- Abaixo de 720px cada linha passa a ser lida como um cartão: a tabela perde a largura mínima e não rola na horizontal; o texto principal quebra em quantas linhas precisar.
- A coluna fixa (primeira célula) nunca passa de cerca de 40% da largura útil do contêiner, em qualquer largura. O resto é do texto principal.
- Quando a coluna Estado (`.col-state`) some abaixo de 720px, o selo de estado vai para baixo da primeira célula, no elemento `.inline-state`. Os dois existem no markup; o CSS mostra um ou outro, nunca os dois. O selo mantém texto além da cor (estado nunca só por cor).
- A semântica de tabela fica (`table`, `th` de linha e de coluna); a mudança é só visual, para o leitor de tela continuar lendo cabeçalho e célula.
- Linha atual (`aria-current`) mantém o destaque também no formato de cartão, incluindo a primeira célula.
- Só tokens de cor, espaço e raio; o ponto de quebra é o mesmo 720px usado no resto do layout.

**Implementação de referência.** No site, `site/src/components/TableScroll.astro` com a prop `stack`. No jogo, quando aparecer a primeira tabela desse tipo, a casca entra em `app/src/ui/components/` com o mesmo comportamento e as mesmas classes (`.col-state`, `.inline-state`).

### Card em duas colunas (aprovado pelo CEO em 2026-11-07)

- Um card de leitura dentro de uma folha (hoje, o card do jogador) passa a duas colunas quando a folha tem **480px** ou mais de largura (`breakpoint-card`): o celular em pé (390px) fica com uma coluna; a folha do celular deitado (720px) e o diálogo do desktop (540px) ficam com duas.
- A consulta é de contêiner (`@container`), não da tela: o que manda é a largura da folha.
- Variáveis CSS não funcionam em `@container`; o valor fica escrito no componente, com comentário apontando para cá, até o gerador de tokens exportar constantes.

## Padrões de interação

### Confirmação em passos: o passo final (aprovado pelo CEO em 2026-11-07)

Vale para toda confirmação destrutiva em mais de um passo (hoje, apagar uma carreira: folha de ações, passo 1, passo 2).

**Regras.**

- **"Cancelar" sempre por último e no mesmo lugar.** Em todas as folhas do fluxo, "Cancelar" é o último botão, embaixo, no alcance do polegar, e fica na mesma altura da tela. Quem desiste toca embaixo por reflexo e sempre cancela. "Cancelar" nunca sobe acima do destrutivo.
- **O destrutivo do passo final nunca fica no lugar do botão principal do passo anterior.** O passo final tem um separador entre o destrutivo e "Cancelar": linha de 1px em `line`, com um alvo de toque mais `space-4` de espaço, metade acima e metade abaixo da linha. O destrutivo sobe 61 px; onde estava o botão do passo anterior fica espaço vazio, que não faz nada ao toque.
- **Janela de proteção.** Cada passo ignora a sua ação de avançar ou confirmar por cerca de 500 ms depois de abrir; cancelar, fechar e voltar valem na hora.
- **Folha ancorada pela base nas duas larguras.** No celular a folha sobe de baixo; a partir de 900px vira diálogo flutuante ancorado pela base (`space-8` acima da área segura), não centrado na vertical, para a posição dos botões não depender da altura do texto. Os botões da confirmação ficam no pé fixo da folha; quando a tela é baixa (celular deitado), só o conteúdo de cima rola.
- O destrutivo tem borda `danger`, ícone e texto (nunca só cor); o foco entra no botão de fechar da folha, nunca no destrutivo.

**Medida.** No celular (em pé e deitado) e no desktop, o topo do destrutivo do passo final fica pelo menos 56 px acima do topo do botão principal do passo anterior, sem sobreposição, e "Cancelar" tem o mesmo `y` (±1 px) em todas as folhas do fluxo. O E2E confere.

**Implementação de referência.** `ConfirmSheet` com `finalStep` sobre o `BottomSheet`, em `app/src/ui/components/`; especificação em `docs/design/telas/inicio.md`, "Apagar com confirmação dupla".

## Selos (aprovado pelo CEO em 2026-11-07)

Vale para o StatusBadge (`app/src/ui/components/StatusBadge.svelte`) e para qualquer selo de situação, resultado ou marca.

| Tipo                                                          | Texto e fundo                      | Borda e ícone                     |
| ------------------------------------------------------------- | ---------------------------------- | --------------------------------- |
| Vitória (`win`)                                               | `on-grass` sobre `grass`           | —                                 |
| Empate (`draw`)                                               | `ink` sobre `surface-2`            | borda `draw`                      |
| Derrota, lesionado, suspenso (`loss`, `injured`, `suspended`) | `ink` sobre `danger-soft`          | borda `danger`; ícone em `danger` |
| Promessa, clássico (`prospect`, `derby`)                      | `on-floodlight` sobre `floodlight` | —                                 |

- Todo selo tem letra ou ícone **e** texto (no selo só de letra, V/E/D, a palavra inteira vai para o leitor de tela); a cor só reforça.
- Texto em `rotulo`. Os tipos formam uma lista fechada no componente.
- **Um tipo novo de selo só entra com o seu par de texto e fundo conferido pelo `npm run tokens`** (a lista de pares de `scripts/tokens-to-css.mjs`); cor solta num selo é correção na revisão.
