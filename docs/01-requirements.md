# Requisitos

> Escrito pelo `product-manager` no `/kickoff`, a partir do backlog de `docs/PROJETO.md`. Cada história cabe num PR e cada critério de aceite vira um teste. IDs são estáveis: nunca renumerar, só acrescentar.

## Índice

| ID     | Título   | Etapa | Prioridade            | Estado                                   |
| ------ | -------- | ----- | --------------------- | ---------------------------------------- |
| US-001 | <título> | 1a    | Must / Should / Could | rascunho / pronta / em andamento / feita |

---

## US-001: <Título>

**Como** <papel>, **quero** <objetivo>, **para** <benefício>.

**Prioridade:** Must
**Depende de:** —
**Notas:** <regras de jogo, links para `docs/PROJETO.md` e `docs/design/`>

### Critérios de aceite

```gherkin
Cenário: <caminho feliz>
  Dado <pré-condição>
  Quando <ação>
  Então <resultado observável>

Cenário: <caso de borda ou erro>
  Dado <pré-condição>
  Quando <ação>
  Então <resultado observável>
```

### Fora do escopo desta história

- <item>

---

## Requisitos não funcionais

| Área            | Requisito                                                                               | Como verificamos                 |
| --------------- | --------------------------------------------------------------------------------------- | -------------------------------- |
| Desempenho      | rodada simulada em menos de 2 s num celular simples; instalação inicial abaixo de 10 MB | medição no `/balance` e no build |
| Privacidade     | nenhum dado pessoal; lista da seção de privacidade do `PROJETO.md`                      | `security-auditor`               |
| Acessibilidade  | alvos ≥ 44px, contraste ≥ 4,5:1, resultado nunca só por cor                             | `ux-designer` e `npm run tokens` |
| Compatibilidade | Chrome e Safari dos últimos 2 anos, Android e iPhone; desktop                           | E2E (Etapa 1a)                   |
| Determinismo    | mesma semente, mesma temporada                                                          | testes do motor                  |
