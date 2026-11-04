# ADR-0015: Patrocínio real desligado e não anunciado; só marcas fictícias no cenário

- **Status:** Aceito (CEO, 2026-11-04)
- **Data:** 2026-11-04
- **Decisores:** architect (redigiu), CEO (decidiu em 2026-11-04)
- **Substitui em parte:** `docs/PROJETO.md` › "Monetização e apoio" (bloco "Patrocínios no cenário" e o "Quando entra"), a decisão do CEO registrada na US-041 e na US-043 (`docs/01-requirements.md`) e o item 4 das decisões do `/kickoff` em `docs/status.md`.

## Contexto

O `docs/PROJETO.md` previa receita de patrocinadores reais no cenário do jogo, com os espaços vindos do servidor, e a US-041 e a US-043 pediam o convite "Patrocine aqui" no site e na tela Sobre. Publicidade num jogo com público menor de idade cai no ECA Digital (Lei 15.211/2025) e na LGPD, pede painel de admin, contagem de impressões e uma consulta jurídica que ainda não houve. Em 2026-11-04 o CEO decidiu não vender nem anunciar patrocínio por enquanto, mas sem fechar a porta. Hoje nenhum código usa patrocínio: o único resto é `placeholderSponsor: { name: 'Patrocine aqui', url: '/apoiar' }` em `config/prancheta.config.ts`, sem leitor.

O `docs/PROJETO.md` está congelado e não é editado; este ADR prevalece sobre a seção 'Monetização e apoio' (os trechos sobre receita com patrocinadores reais e espaços vindos do servidor).

Trechos do `docs/PROJETO.md` (na versão de 2026-11-04) que este ADR substitui:

- linha 634: "A receita vem de patrocinadores reais no cenário do jogo [...]" (a receita passa a ser só o apoio voluntário);
- linhas 636 a 642, bloco "Patrocínios no cenário": os espaços continuam (linha 638) como cenário com marcas fictícias; a linha 639 (espaços vindos do servidor) e a linha 641 (anúncios identificáveis como publicidade) ficam para o ADR que um dia ligar o patrocínio; as linhas 640 e 642 (marca fictícia, nada de aposta nem bebida) continuam valendo;
- linha 651, "Quando entra": a parte "espaços de patrocínio já na Etapa 1" vira "marcas fictícias no cenário já na Etapa 1"; o resto (apoio) continua;
- relacionadas, fora da seção: linha 36 (o aviso no jogo diz que clubes, jogadores e marcas são fictícios), linha 615 (sem contagem de impressões enquanto o patrocínio estiver desligado) e linha 678 (o módulo de patrocínios do painel de admin só existe se o patrocínio for ligado).

A seção "Apoio ao projeto" (linhas 644 a 649) e o item "Anúncios e menores" do backlog (linha 738) não mudam; o segundo volta a ser obrigatório no ADR que ligar o patrocínio.

## Opções consideradas

| Opção                                                                                                             | Prós                                                                                    | Contras                                                                                                                   |
| ----------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| A: manter o PROJETO (espaços vendáveis, "Patrocine aqui" no site e na Sobre, patrocinador real vindo do servidor) | abre uma receita cedo                                                                   | exige revisão de ECA Digital e LGPD, painel de admin e contagem de impressões antes de ter jogo; promete o que não existe |
| B: patrocínio real desligado e não anunciado; cenário com marcas fictícias; um ponto único para ligar depois      | nada a revisar agora; o cenário fica pronto; ligar depois troca uma fonte, não as telas | nenhuma receita de patrocínio; a "possibilidade" custa um contrato pequeno que ninguém usa por enquanto                   |
| C: tirar o patrocínio do projeto (marcas fictícias escritas direto em cada tela, sem ponto único)                 | o mais simples hoje                                                                     | ligar um dia exige refazer cada tela que mostra marca; contraria a decisão do CEO de manter a possibilidade               |

## Decisão

Opção B.

1. **Desligado.** O patrocínio real fica como possibilidade técnica, mas **desligado**: `config.sponsorship.enabled` vale `false`. Não existem, nem desligados, busca de patrocínio no servidor, download de arte, link no cenário, contagem de impressões nem o módulo de patrocínios do painel de admin. A "possibilidade" é só isto: toda marca do cenário passa por um único ponto (a função que escolhe a marca de um espaço, abaixo), que hoje lê só a lista de marcas fictícias.
2. **Não anunciado.** O site e o jogo não anunciam nem mostram patrocínio. Nada de "Patrocine aqui", "Anuncie aqui", "Quer anunciar?" nem página ou bloco equivalente, nem no site (incluindo `/apoiar/`) nem na tela Sobre. O aviso de ficção passa a dizer "clubes, jogadores e marcas do jogo são fictícios".
3. **Marcas fictícias, só como cenário.** As placas em volta do campo, o placar e as camisas (quando houver prévia de uniforme) mostram marcas fictícias, como cenário. Elas não são publicidade: sem rótulo de "publicidade", sem link, sem rede e sem contagem. Continuam valendo as regras da US-041: lista de marcas aprovada pelo CEO como conteúdo, nenhuma marca real nem parecida, nada de aposta nem bebida alcoólica, escolha igual para todos (depende só do espaço, da rodada e do clube).
4. **Receita.** A receita é só o apoio voluntário (página Apoiar), com recompensas só cosméticas e nada de pagar para ganhar, como já aprovado em `docs/PROJETO.md`.
5. **Ligar um dia** é decisão nova do CEO, com ADR próprio e revisão do `security-auditor` (LGPD; ECA Digital e publicidade para menores). Esse ADR futuro decide fonte dos espaços, rótulo de publicidade, contagem, painel de admin e o que muda na política de privacidade.

**Contrato do ponto único** (entra em `docs/02-architecture.md` com a T-040; os nomes finais são do `developer`):

```ts
type SlotId = 'pitch-boards' | 'scoreboard' | 'round-summary' | 'loading' | 'shirt';
interface SlotContext {
  round: number;
  clubId: string;
  stadiumId: string;
}
interface FictionalBrand {
  id: string;
  name: string;
  colors: [string, string];
}
// Pura e determinística; sem rede, sem relógio, sem dado do jogador.
function brandForSlot(
  slot: SlotId,
  ctx: SlotContext,
  brands: readonly FictionalBrand[],
): FictionalBrand;
```

A interface (o componente de espaço) só desenha o `FictionalBrand` que recebe. O patrocínio dentro da economia simulada (receita de patrocínio de camisa do clube, Etapa 3) não é afetado: é número do jogo, e a marca que aparece nele também é fictícia.

## Consequências

- **Positivo:** nenhuma publicidade para menores e nenhum dado novo para revisar; o site e o jogo não prometem o que não existe; o cenário fica completo na 1a; ligar um dia troca a fonte de `brandForSlot`, sem refazer telas.
- **Negativo:** abrimos mão de receita de patrocínio até nova decisão; o apoio voluntário é a única fonte.
- **Configuração** (instrução ao `developer`, em PR próprio, já que `config/` não entra no `/quick`): em `config/prancheta.config.ts`, trocar as linhas do `placeholderSponsor` por

  ```ts
  /** Real sponsorship (ADR-0015): off and not advertised. Turning it on needs a new ADR and a security-auditor review. */
  sponsorship: { enabled: false },
  ```

  e apagar o `placeholderSponsor` (hoje sem leitor; conferir com `grep -rn placeholderSponsor` antes). `contacts.donateUrl` continua. Nenhum código lê `sponsorship.enabled` na 1a; ele documenta o estado e é conferido por teste (Conformidade).

- **Pendências:**
  - `product-manager`: reescrever a US-041 (título "Marcas fictícias no cenário"; objetivo de cenário, não de venda; sem rótulo de publicidade; camisa incluída quando houver prévia de uniforme; critério novo "nenhum texto convida a anunciar") e a US-043 (tirar o convite "Patrocine aqui" dos critérios "versão e links" e "contato ou link vazio"; aviso de ficção com "marcas"); ajustar a linha de resumo "Patrocínio" no fim do `docs/01-requirements.md`.
  - `ux-designer`: `docs/design/telas/README.md` e `componentes.md` (espaço sem rótulo de publicidade e sem link; o nome `SponsorSlot` pode ficar no código ou virar `BrandSlot`, a critério do `developer`); `docs/design/site.md` (tirar "Patrocine aqui" da página Apoiar).
  - `content-writer`: textos do site em `docs/content/site/` (`clubes.md` perde a seção "Patrocinadores" e o "Quer anunciar?"; `perguntas.md` responde que o jogo não tem anúncio e que as marcas do cenário são fictícias; avisos de ficção com "marcas"), com aprovação do CEO; depois o `developer` leva ao `site/` (o rodapé `SiteFooter.astro` ainda diz "patrocinadores").
  - `qa-engineer`: ajustar a linha da US-041 e da US-043 em `docs/03-test-plan.md`.
  - `tech-writer`: trocar o item 4 das decisões do `/kickoff` em `docs/status.md` por referência a este ADR; `docs/00-vision.md` item 5 vira "marcas fictícias no cenário".
  - `developer`: a troca no `config/` acima e o teste da Conformidade (pode ir junto da T-040).

## Conformidade

- `config.sponsorship.enabled` é `false`, e um teste (por exemplo `app/src/lib/sponsorship.test.ts`, que roda em `npm test`) falha se não for. Mudar esse valor sem um ADR novo aceito pelo CEO e sem a revisão do `security-auditor` é BLOCKER.
- O mesmo teste procura, sem diferenciar maiúsculas, "patrocine aqui", "anuncie aqui", "anuncie no" e "quer anunciar" em `app/src/content/`, `site/src/` e `config/`, e falha se encontrar.
- Revisão de código: toda marca exibida no cenário vem de `brandForSlot` e da lista de marcas fictícias; marca escrita direto numa tela, `fetch` ou link num espaço do cenário, rótulo de publicidade ou contagem de impressões é BLOCKER.
- O `security-auditor` confere, na auditoria de release, que o jogo não faz nenhuma requisição ligada a patrocínio (cenário "sem rede e sem contagem" da US-041).
