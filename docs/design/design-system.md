# Design system (resumo)

A fonte é o artefato "Prancheta" no claude.ai (tokens, brand book e componentes com prévia). Os tokens estão em `design/tokens.json` e viram `app/src/tokens.css` com `npm run tokens`, que também falha se algum par de cores declarado cair abaixo de 4,5:1.

Regras que o `ux-designer` cobra:

- Só tokens: nenhuma cor, fonte ou raio literal fora de `tokens.css`; classes utilitárias `botao` e `display-xl` para os tamanhos fora da escala de texto.
- Mobile first, uma mão: abas embaixo, "Jogar rodada" sempre acessível, alvos ≥ 44px.
- Tema `noite` padrão e `dia` opcional; contraste ≥ 4,5:1 nos dois.
- Resultado nunca só por cor (V/E/D ou ícone); `prefers-reduced-motion`.
- Componentes base: Escudo, CardPartida, LinhaTabela, CardJogador, BarraAbas, Botao, Noticia.
- Textos em `app/src/content/<idioma>/`; nome, logo e cores em `config/prancheta.config.ts`.
