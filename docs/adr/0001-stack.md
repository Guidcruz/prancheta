# ADR-0001: Stack do Prancheta

- **Status:** aceita
- **Data:** 2026-11-03
- **Decisores:** CEO (aprovou no documento de projeto), Orquestrador (registrou)

## Contexto

O jogo precisa rodar no navegador e no celular como PWA, offline na carreira, com o mesmo motor no servidor para o online. O CEO é uma pessoa só, com custo zero até o online.

## Opções consideradas

| Opção                | Prós                                                 | Contras                            |
| -------------------- | ---------------------------------------------------- | ---------------------------------- |
| A: Svelte 5 + Vite   | App leve em celulares simples; menos código por tela | Ecossistema menor que React        |
| B: React + Vite      | Mais material e componentes prontos                  | Mais pesado; mais boilerplate      |
| C: Astro para o site | Markdown vira página; zero JS por padrão; RSS pronto | Mais uma ferramenta no repositório |

## Decisão

Svelte 5 + Vite 8 para o jogo (A), Astro 7 para o site (C), TypeScript estrito em tudo, Vitest para testes, ESLint + Prettier. Motor em TypeScript puro em `app/src/engine/`, sem DOM, determinístico (gerador mulberry32 com semente), parâmetros em `app/src/params/`. Fontes Barlow e Barlow Condensed hospedadas no próprio app (`@fontsource`), sem Google Fonts, por privacidade e para funcionar offline.

## Consequências

- **Positivo:** app pequeno; o motor roda igual no navegador e nos Workers; nenhuma chamada a terceiros.
- **Negativo:** menos exemplos prontos em Svelte; quem entra precisa aprender Svelte 5 (runas).
- **Pendências:** E2E com Playwright entra na Etapa 1a.

## Conformidade

`app/src/engine/` não importa `svelte`, `ui/`, `lib/`, `content/` nem usa `Math.random`, `Date` ou globais do navegador (regras no `app/eslint.config.js`; o code-reviewer bloqueia).
