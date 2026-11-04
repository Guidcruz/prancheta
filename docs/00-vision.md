# Visão

> Escrita a partir de `docs/PROJETO.md` (seção "Visão geral"). O `product-manager` revisa no `/kickoff`; o CEO já aprovou o conteúdo no documento de projeto.

## Problema

Jogos de técnico de futebol no celular ou são pesados e complexos demais (Football Manager) ou são antigos e sem o clima do futebol brasileiro. Quem quer "ser técnico" do seu time por dez minutos no ônibus não tem onde jogar.

## Público

| Persona                      | Contexto                                         | Necessidade                                                                                     |
| ---------------------------- | ------------------------------------------------ | ----------------------------------------------------------------------------------------------- |
| Torcedor que joga no celular | Rodadas curtas, no transporte ou antes de dormir | Comandar um clube que lembra o dele, com história e tensão, sem manual                          |
| Grupo de amigos              | Liga entre eles, cada um com um clube            | Competir no mesmo campeonato, no ritmo que der (ao vivo, por dia ou seguindo o calendário real) |
| Nostálgico do Brasfoot       | Conhece o gênero                                 | Profundidade suficiente (mercado, carreira, Libertadores) sem virar planilha                    |

## Resultado esperado

Uma pessoa instala o app, escolhe um clube e joga uma temporada inteira do Brasileirão em sessões de 2 a 3 minutos por rodada, sem cadastro, sem perder o progresso, e quer continuar na temporada seguinte.

## Capacidades (Etapa 1)

1. Brasileirão Série A com 20 clubes fictícios em trocadilho, escudos e elencos gerados.
2. Escalação e três ajustes táticos; partida simulada minuto a minuto, animada, com comandos durante o jogo.
3. Tabela, calendário, notícias e rede social fictícia simples.
4. PWA instalável, offline, com salvamento automático e exportar/importar save.
5. Estrutura de três idiomas e marcas fictícias no cenário (patrocínio real desligado e não anunciado; [ADR-0015](adr/0015-patrocinio-desligado.md)).
6. (1b) Online mínimo: conta anônima, liga da Série A entre amigos por código, ao vivo e assíncrono, servidor simulando as rodadas, mensagens prontas.

## Fora de escopo (Etapa 1)

Séries B a D, copas, América do Sul, mercado, finanças, carreira longa, tempo real, sincronização de saves, voz, patrocinadores reais, ligas grandes e painel de admin completo. Entram nas etapas 2 a 6 (`docs/roadmap.md`).

## Restrições

- Mobile first, uma mão só; completo, mas simples.
- Nenhum nome, marca, escudo, voz ou pessoa real. Nenhum dado pessoal. Sem loot box, sem recompensa por tempo de uso, sem chat livre.
- Custo zero até o online; Cloudflare; portável para VPS.

## Premissas

- Trocadilhos e cores bastam para o torcedor reconhecer o clube.
- Rodadas curtas e a tensão da tabela prendem mais que mecânicas de retenção.

## Riscos

| Risco                                    | Impacto | Mitigação                                                                                                   |
| ---------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------- |
| A partida não ser divertida nem justa    | alto    | `game-designer` com `/balance` desde a Etapa 1; metas numéricas em `docs/design/balance-targets.md`         |
| Perda de save no celular                 | alto    | salvamento automático com 3 versões, armazenamento persistente, exportar/importar; sincronização na Etapa 4 |
| Nome ou trocadilho dar problema de marca | médio   | nome provisório em `config/`; conferência no INPI; advogado antes de monetizar                              |
| Escopo crescer sem fim                   | médio   | etapas com entrega jogável; o que não está na etapa fica em `docs/roadmap.md`                               |

---

**Aprovação do CEO:** ☑ conteúdo aprovado no documento de projeto em 2026-11-03
