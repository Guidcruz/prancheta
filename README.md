# Prancheta

Jogo de técnico de futebol para o celular (PWA), com clubes brasileiros e sul-americanos fictícios. Carreira offline e ligas online. Feito em público: o devlog está no site.

- Site e devlog: `site/` (Astro), publicado em `/`.
- Jogo: `app/` (Svelte 5 + Vite, PWA), publicado em `/jogo`.
- Motor do jogo: `app/src/engine/` (TypeScript puro, determinístico).
- Configuração central da marca: `config/prancheta.config.ts`.
- Design system: `design/tokens.json` → `app/src/tokens.css` (gerado).
- Documento de projeto (congelado): `docs/PROJETO.md`. Roteiro: `docs/roadmap.md`. Andamento: `docs/status.md`.

## Rodar

```bash
npm install
npm run dev          # o jogo em http://localhost:5173/jogo/ (gera os ícones antes)
npm run dev -w site  # o site em http://localhost:4321/
npm test             # testes do motor
npm run build        # site + jogo em dist/ (o que o Cloudflare Pages publica)
```

## Processo

O desenvolvimento usa a "empresa de agentes" do Claude Code: a sessão principal orquestra, departamentos especialistas constroem, três portões de qualidade revisam e o CEO (humano) decide o que é irreversível. Leia `CLAUDE.md`, `docs/PROCESSO.md` e `docs/papeis.md`.

## Licença

A definir (decisão pendente do CEO, em `docs/status.md`).
