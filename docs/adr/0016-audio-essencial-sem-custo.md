# ADR-0016: Áudio essencial sem custo na Etapa 1a, sintetizado no navegador

- **Status:** Aceito (CEO, 2026-11-05)
- **Data:** 2026-11-05
- **Decisores:** architect (redigiu), audio-designer (propôs o lote `docs/audio/lotes/2026-11-05-essencial.md`), CEO (decidiu em 2026-11-05, aceitando todas as recomendações do lote)
- **Substitui em parte:** a decisão P5 ("sem áudio de nenhum tipo na Etapa 1", `docs/01-requirements.md`) e `docs/PROJETO.md` › "Arte e áudio" na parte dos efeitos sonoros.

## Contexto

A P5 decidiu que a Etapa 1 não teria áudio nenhum, só a vibração no Android, e que a opção "Áudio" das Preferências ficaria escondida até o CEO aprovar um lote com a estimativa de créditos (US-020, US-044, US-073). O `docs/PROJETO.md` › "Arte e áudio" previa que a narração e os efeitos (apito, chute, rede, trave, torcida, vaia, interface) sairiam do ElevenLabs, num plano pago. Em 2026-11-05 o CEO pediu para começar pelo simples e essencial e melhorar depois. O `audio-designer` respondeu com um pacote de 17 sons e uma torcida ambiente em 3 camadas, todos gerados por código no navegador, com custo zero e nenhum crédito de ElevenLabs. O motor já emite todos os eventos necessários (`MatchEvent` em `app/src/engine/match/types.ts`), então o som pode nascer inteiro na camada de interface.

O `docs/PROJETO.md` está congelado e não é editado. Este ADR prevalece sobre os trechos abaixo, na versão de 2026-11-05:

- linha 492, "narração e efeitos saem do ElevenLabs": os **efeitos** passam a ser sintetizados por código; a **narração** continua no ElevenLabs (Passo 3, abaixo);
- linha 499, a linha "Efeitos (apito, chute, rede, trave, torcida, vaia, interface) | ElevenLabs": passa a ser "Código (Web Audio)", com gravação CC0 só para a massa da torcida, se a síntese não convencer.

Continuam valendo a linha 498 (narração com voz original, nunca clone), a linha 500 (música de menu a definir) e o bloco "ElevenLabs" (linhas 509 a 515), que agora vale só para a narração.

## Opções consideradas

| Opção                                                                                                     | Prós                                                                                   | Contras                                                                                                                                                       |
| --------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| A: manter a P5 (sem áudio na Etapa 1)                                                                     | nada a fazer nem a testar                                                              | a partida fica muda; o pedido do CEO não é atendido                                                                                                           |
| B: efeitos gerados no ElevenLabs, como no PROJETO                                                         | timbre gravado, mais realista                                                          | custo (assinatura e créditos), licença presa ao período da assinatura, dezenas de arquivos para baixar e versionar, peso na instalação ou na primeira partida |
| C: efeitos sintetizados no navegador (Web Audio), com gravação CC0 só para a massa da torcida, se preciso | custo zero, 0 crédito, nenhum arquivo nem licença de terceiros, ~4 KB gzip, sem atraso | timbre mais simples; a torcida por ruído filtrado pode soar como vento (por isso a válvula da gravação CC0)                                                   |
| D: banco de gravações livres (CC0) para todos os sons                                                     | timbre gravado sem custo                                                               | licença conferida arquivo por arquivo, risco de voz identificável, centenas de KB, inventário longo                                                           |

## Decisão

Opção C, com as escolhas do CEO de 2026-11-05.

1. **Síntese no navegador.** Os 17 sons do lote (apitos, gol, trave, defesa difícil, pênalti, cartões, lesão, substituição, "todo mundo no ataque", plantão e interface) e a torcida ambiente em 3 camadas (`murmur`, `tension`, `swell`, mais vaia e "ohhh") são gerados por código com a Web Audio API, a partir das receitas da seção 3 do lote.
2. **Custo zero.** Nenhuma assinatura, nenhuma chamada à API do ElevenLabs, **0 crédito**. Nenhuma dependência nova.
3. **Torcida:** começa pela síntese. Se, na página de bancada, a torcida em `i` 0,3 soar como vento ou chiado de TV, entra uma gravação CC0 só para a massa da torcida (e, se preciso, a vaia): 3 loops mono de 20 s em Opus 32 kbps, ~240 KB no total, que o CEO ouve e aprova antes. Os critérios de busca e de aceite são os da seção 4 do lote.
4. **Opcionais incluídos, em volume baixo:** defesa difícil (`save`, -8 dB, só lances de `importance` 2 ou 3), substituição (`sub`, -14 dB) e "todo mundo no ataque" (`all_out`, -8 dB, só quando o clube do técnico ativa).
5. **Plantão (US-073):** som no plantão grande (`flash_big`) e um bip baixíssimo no curto (`flash_short`, -16 dB); os dois seguem a preferência do plantão (US-074): "Desligado" cala os dois e "Só os importantes" cala o curto.
6. **Padrão: som desligado.** Na primeira vez que o jogador abre a tela de partida, uma pergunta única, "Quer ouvir o estádio?", com "Sim, ligar o som" e "Agora não". O toque em "Sim" é também o primeiro gesto que o navegador exige. A resposta é lembrada e a pergunta não volta; depois, só as Preferências mudam. Se ligar: Geral 60 %, Efeitos 80 %, Torcida 50 %.
7. **Mudo e volumes:** um botão de mudo sempre visível na tela de partida (alvo ≥ 44 px, ícone e rótulo de texto), além de quatro controles nas Preferências (US-044): Geral, Efeitos, Torcida e Mudo. Os valores ficam no aparelho, sem dado pessoal.
8. **O motor não muda.** Nenhum arquivo de `app/src/engine/` é alterado; `ENGINE_VERSION` não sobe e o golden não mexe. O motor continua sem importar `lib/`. O módulo de áudio (`app/src/lib/audio/`) importa do motor **só tipos** (`MatchEvent`, `Side`, `TacticPreset`).
9. **O som toca quando a animação revela o lance**, nunca quando o motor o calcula. A camada de partida da UI (a mesma que alimenta o canvas e a narração em texto) chama o diretor de áudio no instante da revelação; o gol só toca depois da pausa dramática. Nenhum som antecipa o desfecho de um lance.
10. **Carregamento sob demanda e fora do precache.** Só uma casca mínima (API, preferências, desbloqueio do `AudioContext`) entra no pacote principal. O resto (mixagem, receitas, diretor) é um chunk separado, baixado por `import()` dinâmico depois do aceite; quem nunca liga o som nunca baixa nada. Nem o chunk de áudio nem as gravações (se houver) entram no precache do service worker; ficam no cache de execução depois do primeiro uso.
11. **Metas de peso:** casca no pacote principal ≤ 1 KB gzip; chunk de áudio ≤ 15 KB gzip; áudio gravado ≤ 300 KB no total e cada arquivo < 100 KB (OGG/Opus mono 32 kbps, com M4A/AAC mono 48 kbps como alternativa escolhida por `canPlayType`); 0 KB de áudio no cenário só com síntese. A torcida usa menos de 5 % de CPU num celular fraco; se passar, cai para 2 camadas.

**Regras.**

- **Nenhum evento só por som.** Tudo o que toca tem texto na narração, ícone ou placar (gol, cartão, lesão, troca, plantão, fim de jogo). Com o som mudo ou desligado, o jogo não perde nada.
- **Chave de silêncio do iOS:** o jogo obedece à chave e não tenta furá-la; declara a sessão como ambiente (`navigator.audioSession.type = 'ambient'`, onde existir), para não interromper a música do jogador.
- **Segundo plano:** com `visibilitychange` em `hidden`, `ctx.suspend()`; ao voltar, `resume()`. Pausar a partida baixa a torcida a `i` 0,1.
- **Primeiro gesto:** o `AudioContext` é criado ou retomado só dentro de um evento de toque ou clique, de forma síncrona, na casca (antes do `import()` do chunk, porque o Safari pode recusar o desbloqueio depois de um `await`). Antes disso, todas as chamadas são ignoradas sem erro. Contexto `suspended` ou `interrupted` tenta `resume()` no próximo gesto e nunca mostra erro ao jogador.
- **Nada que imite real:** sem canto, grito articulado, hino, vinheta ou melodia que lembre torcida, clube ou emissora real. A torcida sintetizada não tem voz, só ruído filtrado; as notas do plantão e do gol são intervalos simples (quinta, oitava), sem melodia reconhecível; o apito é genérico. Gravação com voz identificável, canto, bateria de torcida organizada ou trecho de transmissão é recusada.
- **Gravação só CC0**, com uma linha em `docs/audio/inventario.md` (arquivo, URL de origem, autor, "CC0 1.0", data e quem conferiu) antes de o arquivo entrar no repositório. Licença diferente de CC0 não entra sem o `security-auditor`.
- **Ritmo:** em velocidade rápida só tocam apitos e gol; no modo "só resultado", só o apito final. O gol de outro jogo é sempre `flash_*`, nunca o som do gol da partida assistida.
- `prefers-reduced-motion` mede movimento, não som: não liga nem desliga o áudio.

O desenho do módulo (`app/src/lib/audio/`, `manifest.json`, diretor puro, `SoundBackend`) está em `docs/02-architecture.md` §4.6 e a implementação é a T-047.

## Consequências

- **Positivo:** a partida ganha som na 1a sem custo, sem crédito e sem licença de terceiros; o motor, o save e o golden ficam intactos; trocar a síntese por uma gravação é trocar uma entrada do `manifest.json`, sem mexer em quem chama; o diretor é função pura, testado em Vitest sem navegador.
- **Negativo:** o timbre sintetizado é mais simples que uma gravação; a torcida pode exigir a gravação CC0 (e o seu inventário); quem joga offline logo depois de uma atualização do app fica sem som até o chunk novo ser baixado, porque o áudio está fora do precache (o jogo segue normal, só mudo).
- **Passo 3 (narração no ElevenLabs) não muda de regra:** continua exigindo o lote em `docs/audio/lotes/`, a estimativa de créditos e o ok escrito do CEO ("pode gerar") antes de qualquer chamada, e a trava do hook contra a API do ElevenLabs continua. O Passo 2 (torcida por estádio, cantos inventados, termômetro) e a música de menu pedem decisão própria.
- **Pendências:**
  - `tech-writer`: atualizar em `docs/01-requirements.md` a P5 (decisão 5 da lista final), os "Fora de escopo" da US-020 e da US-073, o cenário "realismo fixo e sem áudio (P5)" e as notas da US-044 (as quatro opções de som deixam de ficar escondidas), e o resumo "Fora de escopo" do fim; registrar a decisão em `docs/status.md`.
  - `product-manager`: a sugestão do lote de a vibração seguir `prefers-reduced-motion` mexe na US-020 e não é decidida aqui.
  - `qa-engineer`: a linha Q5 do `docs/03-test-plan.md` (a P5 deixa de travar testes) e os casos do áudio (mudo, primeiro gesto, segundo plano, eventos visíveis sem som).
  - `ux-designer`: a pergunta única, o botão de mudo da tela de partida e o bloco de som das Preferências; os textos vão para `app/src/content/<idioma>/` pelo `content-writer`, com aprovação do CEO.
  - `audio-designer` e CEO: ouvir na página de bancada e decidir se a torcida fica na síntese.
  - `developer`: a T-047.

## Conformidade

- `app/src/engine/` não muda na T-047; diff no motor, `ENGINE_VERSION` novo ou golden regravado por causa de som é BLOCKER.
- `app/src/lib/audio/**` importa de `engine/` só com `import type`; import de valor do motor, de `ui/**`, de `lib/save/**` ou de `lib/career/**` é BLOCKER (o lint de fronteira cobre).
- O som de um lance é disparado pela camada de partida da UI no momento da revelação, nunca ao receber o resultado de `simulateMatch`.
- Um teste Vitest valida o `manifest.json`: os 17 ids e as camadas da torcida presentes, receitas existentes, `gainDb` ≤ 0, prioridade de 1 a 5, e todo `kind: "sample"` com arquivo em `app/public/audio/` e linha correspondente em `docs/audio/inventario.md`.
- O precache não contém o chunk de áudio nem `audio/*` (conferido por `scripts/check-precache.mjs` quando a T-039 existir; até lá, na revisão do `sw.js` gerado). Chunk de áudio acima de 15 KB gzip ou áudio gravado acima de 300 KB é BLOCKER.
- Nenhuma chamada a `api.elevenlabs.io` nem dependência de áudio de terceiros no app.
- O E2E com som mudo confere que gol, cartão, lesão, troca, plantão e fim de jogo continuam visíveis em texto ou ícone.
