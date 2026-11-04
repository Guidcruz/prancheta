# Arquitetura

> Escrita pelo `architect` no `/kickoff`. Toda decisão relevante tem um ADR em `docs/adr/`. Mudar este documento exige um ADR novo. O desenho geral já está em `docs/PROJETO.md` (seção "Arquitetura e tecnologia"); aqui entra o detalhe da Etapa 1.

## 1. Visão geral

<Dois parágrafos: o motor em `app/src/engine/` e como a interface (Svelte) e o servidor (Workers) o usam; o fluxo de uma rodada na carreira e na liga online.>

## 2. Stack

| Camada        | Escolha                              | Por quê                             | ADR      |
| ------------- | ------------------------------------ | ----------------------------------- | -------- |
| Jogo          | Svelte 5 + Vite 8, PWA               | app leve                            | ADR-0001 |
| Site          | Astro 7                              | Markdown vira página                | ADR-0001 |
| Motor         | TypeScript puro, determinístico      | roda igual no celular e no servidor | ADR-0001 |
| Servidor (1b) | Hono em Workers, D1, Durable Objects | custo zero, portável                | ADR-0002 |
| Testes        | Vitest; Playwright na 1a             |                                     | ADR-0001 |
| CI/CD         | GitHub Actions + Cloudflare Pages    |                                     | ADR-0002 |

## 3. Componentes

### Motor (`app/src/engine/`)

- **Responsabilidade:** simular partidas, temporadas, mercado, IA dos clubes e economia a partir de um estado e de parâmetros.
- **Possui:** o tipo `GameState`, o `Rng`, os cálculos.
- **Não depende de:** DOM, `lib/`, `content/`, `ui/`.
- **Entradas:** `advanceRound(state, params, seed)` e afins (a definir).

### Interface (`app/src/ui/`), Saves (`app/src/lib/save/`), Conteúdo (`app/src/content/`), Servidor (`server/`)

<a preencher>

## 4. Contratos

### Save

<formato com `version`, migrações, exportar/importar>

### API do online (1b)

<rotas, autenticação por passkey, sala de liga, prazo, confirmação de rodada>

### Modelo de dados

<entidades: Club, Player, Season, Round, Match, League, Account>

## 5. Transversais

- **Configuração:** `config/prancheta.config.ts`; nenhum literal de marca fora dele.
- **Erros:** o motor retorna resultados tipados; a interface mostra em pt-BR; registro sem dados pessoais.
- **Privacidade:** nenhum dado pessoal novo sem ADR; ver `docs/PROJETO.md`, seção "Privacidade".
- **Desempenho:** rodada em menos de 2 s num celular simples; áudio e arte sob demanda.

## 6. Estratégia de testes (com `qa-engineer`)

| Camada       | Escopo                                  | Ferramenta      | Roda em                   |
| ------------ | --------------------------------------- | --------------- | ------------------------- |
| Unitário     | motor, geradores, i18n                  | Vitest          | todo commit               |
| Determinismo | golden tests de sequências e temporadas | Vitest          | todo PR                   |
| E2E          | jornadas do celular                     | Playwright (1a) | todo PR                   |
| Regressão    | todo bug passado + cenários de aceite   | tudo acima      | todo PR, antes de release |

## 7. Quebra técnica (ordenada)

> O Orquestrador delega uma por vez ao `developer`. Tamanho: P (< 1 h), M (meio dia), G (dia+; dividir ou `opus`).

| #     | Tarefa   | História | Tamanho | Depende de | Estado  |
| ----- | -------- | -------- | ------- | ---------- | ------- |
| T-001 | <tarefa> | US-001   | M       | —          | a fazer |

## 8. Decisões pendentes do CEO

1. <opção A ou B> — _Recomendação:_ <A, porque ...>

---

**Aprovação do CEO:** ☐ aprovado em <data>
