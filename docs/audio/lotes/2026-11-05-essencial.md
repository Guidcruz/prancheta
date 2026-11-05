# Lote de áudio 2026-11-05: o pacote essencial (Passo 1)

> Autor: `audio-designer`. Pedido do CEO em 2026-11-05: começar pelo simples e essencial e melhorar depois.
> **Custo: zero.** Créditos do ElevenLabs: **0**. Nenhuma chamada à API, nenhuma geração paga. Nada é baixado agora.
> Status: proposta para o CEO aprovar. Nada foi implementado; o `developer` só começa depois do ok (junto da T-033, tela de partida).

## 1. Resumo

- 17 sons de partida e interface, mais a torcida ambiente em 3 camadas, **todos gerados por código no navegador** (Web Audio API). O pacote não tem arquivo de áudio nenhum, então pesa quase nada e não tem licença de terceiros.
- Uma exceção possível: a massa da torcida. Ruído filtrado imita bem o "murmúrio" do estádio, mas pode soar como vento. O plano é ouvir primeiro (seção 5) e só então decidir se entra uma gravação livre CC0 (opção b, com critérios e fontes na seção 4).
- O motor não muda. Ele já emite `kickoff`, `goal`, `chance` (com `outcome` `saved`, `post` ou `wide`), `penaltyAwarded`, `penaltyMissed`, `yellow`, `red`, `injury`, `substitution`, `tacticChange` (com `preset`), `halftime` e `fulltime` em `app/src/engine/match/types.ts`. O som nasce na camada de interface, a partir desses eventos, na hora em que a animação os revela.
- Padrão proposto: **desligado** até o jogador aceitar uma pergunta única, que serve também de primeiro gesto (seção 6).
- Aviso de processo: a P5 dizia "sem áudio na Etapa 1" e o PROJETO.md diz que efeitos saem do ElevenLabs. Esta decisão muda as duas coisas. Cabe ao Orquestrador abrir o ADR e atualizar US-020, US-044, US-073 e a seção "Fora de escopo" do `docs/01-requirements.md` (linhas ~819, 853, 1722, 1741 a 1753, 2837, 2879, 2946, 2957). Eu não mexo nesses arquivos.

## 2. Lista de eventos sonoros

Convenções:

- **Prioridade** de 1 (vence) a 5 (cede). Se dois sons de prioridades diferentes pedem a vez ao mesmo tempo, o de número menor toca e o outro é cortado ou, se for só ambiente, fica 6 dB mais baixo por 1,5 s (ducking). Mesma prioridade: toca o mais novo e o antigo faz fade de 80 ms.
- **Volume relativo**: 0 dB é o pico do gol. Os valores são em relação a ele (dBFS alvo = -6 dBFS no pico do gol, depois o master do jogador).
- Limite de **4 vozes de efeito ao mesmo tempo**, mais a torcida. Um compressor leve (`DynamicsCompressorNode`, threshold -18 dB, ratio 4) no master evita estouro quando tudo soma.

### 2.1 Partida

| Id              | Evento do motor / quando toca                                      | Duração | Prio | Volume | Observação                                                                                                         |
| --------------- | ------------------------------------------------------------------ | ------- | ---- | ------ | ------------------------------------------------------------------------------------------------------------------ |
| `whistle_start` | `kickoff` (1º e 2º tempo), no instante em que o relógio começa     | 0,6 s   | 1    | -3 dB  | 1 apito longo                                                                                                      |
| `whistle_half`  | `halftime`                                                         | 1,3 s   | 1    | -3 dB  | 2 apitos curtos e 1 longo, ver receita                                                                             |
| `whistle_full`  | `fulltime`                                                         | 1,9 s   | 1    | -3 dB  | 3 apitos; depois a torcida reage ao resultado (2.2)                                                                |
| `goal`          | `goal`, quando a animação revela o gol (depois da pausa dramática) | 3,2 s   | 2    | 0 dB   | rede (0,3 s) + explosão da torcida (3 s); gol do adversário usa a variante "abafada" (-6 dB e filtro mais fechado) |
| `post`          | `chance` com `outcome: 'post'` (e `penaltyMissed` na trave)        | 0,9 s   | 3    | -4 dB  | ping metálico + "ohhh" curto da torcida                                                                            |
| `save`          | `chance` com `outcome: 'saved'` e `pGoal` alto (defesa difícil)    | 0,7 s   | 4    | -8 dB  | opcional; só lances de `importance` 2 ou 3, para não virar ruído                                                   |
| `penalty`       | `penaltyAwarded`                                                   | 1,0 s   | 2    | -3 dB  | apito + torcida cai (silêncio de tensão de 1 s); o gol ou a perda vêm depois pelos sons acima                      |
| `yellow`        | `yellow`                                                           | 0,35 s  | 3    | -6 dB  | apito curto e seco                                                                                                 |
| `red`           | `red`                                                              | 0,9 s   | 2    | -3 dB  | apito longo + baque grave; torcida vaia curto                                                                      |
| `injury`        | `injury`                                                           | 0,5 s   | 4    | -14 dB | sutil; a torcida baixa 3 dB por 2 s                                                                                |
| `sub`           | `substitution` (opcional)                                          | 0,3 s   | 5    | -14 dB | dois toques suaves                                                                                                 |
| `all_out`       | `tacticChange` com `preset: 'allOut'` (opcional)                   | 1,6 s   | 4    | -8 dB  | swell de torcida crescente, sem canto; só quando o clube do técnico ativa, não a IA adversária                     |

### 2.2 Torcida

**Ambiente** (loop contínuo, intensidade `i` de 0 a 1, três camadas somadas):

| Camada    | O que é                                      | Quando sobe                                                             |
| --------- | -------------------------------------------- | ----------------------------------------------------------------------- |
| `murmur`  | murmúrio constante, grave e largo            | sempre ligada na partida; `i` mexe pouco                                |
| `tension` | rumor médio que cresce, com leve tremulação  | ataque perigoso, reta final (a partir dos 75 min), clássico (base fixa) |
| `swell`   | ruído mais brilhante, só aparece em `i` alto | lance de gol iminente; some em segundos                                 |

Mapa de intensidade (valor-alvo; o motor de áudio suaviza com `setTargetAtTime`, constante de 0,8 s subindo e 2,5 s descendo):

| Situação                                                                                               | `i` alvo                                                          |
| ------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Pré-jogo, intervalo                                                                                    | 0,15                                                              |
| Jogo normal                                                                                            | 0,30                                                              |
| Clássico (bônus somado durante o jogo todo)                                                            | +0,10                                                             |
| Reta final, 75 min em diante (sobe linear até 90)                                                      | +0,00 a +0,20                                                     |
| Ataque perigoso (`chance` revelada, `pGoal` ≥ 0,25)                                                    | +0,25 por 4 s                                                     |
| Time da casa perdendo em casa (cai e fica murmurando, com vaia fraca a cada 20 min de jogo, no máximo) | -0,10 e `tension` mais grave                                      |
| Time da casa ganhando por 2 ou mais                                                                    | 0,35, com camada `murmur` mais alegre (corte do filtro mais alto) |
| Depois do apito final: vitória da casa / derrota da casa                                               | sobe a 0,7 por 4 s e some / cai a 0,1 com vaia de 2 s             |

O teto é 1,0; a soma passa pelo `clamp`. A "vaia" é ruído com ressonância grave descendente (receita em 3.3), nunca voz ou palavra.

**Gancho do termômetro da torcida (passo futuro, não entra agora).** O termômetro (0 a 100, PROJETO.md › Torcida) é conhecido antes da partida. A API do módulo já aceita `crowd.setMood({ thermometer, capacity, fillRatio })`, mas no Passo 1 o valor é ignorado. No Passo 2 ele passa a mexer: (1) a base de `i` (estádio cheio e empolgado = base maior); (2) o brilho do `murmur`; (3) a chance e o tamanho da vaia na derrota; (4) com termômetro muito baixo, o estádio "vazio" (base 0,08 e eco maior). Os números são do `game-designer`.

### 2.3 Plantão de gol em outro jogo (US-073)

| Id            | Quando toca                                 | Duração | Prio | Volume | Observação                                                          |
| ------------- | ------------------------------------------- | ------- | ---- | ------ | ------------------------------------------------------------------- |
| `flash_short` | plantão curto (nível 0) entra na tela       | 0,25 s  | 5    | -16 dB | dois bips; baixinho, porque ocorre um gol a cada 3 ou 4 min de jogo |
| `flash_big`   | plantão grande (níveis 1 a 3) entra na tela | 0,7 s   | 4    | -10 dB | três notas subindo + um colchão suave; só ele ganha destaque        |
| `flash_group` | plantão agrupado ("3 gols na rodada")       | 0,25 s  | 5    | -16 dB | reutiliza `flash_short`                                             |

Regras: sem som no plantão se a preferência for "Desligado" (US-074); com "Só os importantes" o curto fica mudo; o plantão nunca abafa o apito nem o gol da partida assistida (prioridade 4 e 5 contra 1 e 2). Os sinais são notas simples em intervalos comuns (quinta e oitava), sem melodia reconhecível, para não lembrar nenhuma vinheta de emissora. O `ux-designer` e o CEO ouvem antes de fechar.

### 2.4 Interface

| Id        | Quando toca                                           | Duração | Prio | Volume |
| --------- | ----------------------------------------------------- | ------- | ---- | ------ |
| `ui_tap`  | toque em botão primário e em abas                     | 0,03 s  | 5    | -20 dB |
| `ui_ok`   | confirmação (salvar, escalação confirmada, contratar) | 0,16 s  | 5    | -16 dB |
| `ui_back` | opcional: voltar/cancelar                             | 0,05 s  | 5    | -22 dB |

Interface usa só o bus de efeitos e respeita o mudo. Nada toca em listas rolando ou em cada linha; só ações.

## 3. Como cada som é feito (opção a: síntese por código)

Tudo com Web Audio API. Um `AudioContext` único, criado no primeiro gesto. Todas as funções recebem `ctx`, o destino (bus) e `when` (tempo de agendamento). Amostragem do contexto padrão (44,1 ou 48 kHz).

### 3.1 Peças comuns

- **Ruído branco**: um `AudioBuffer` mono de 2 s preenchido com `Math.random() * 2 - 1` (a regra de `Math.random()` vale só para `app/src/engine/`; em `lib/audio/` é permitido, e o som não afeta o jogo). Gerado uma vez, reaproveitado em `loop = true` por vários `AudioBufferSourceNode`.
- **Ruído rosa** (mais natural para torcida): filtro de Paul Kellet sobre o ruído branco, gerado uma vez em 4 s, normalizado para pico 0,9. **Ruído marrom**: integral leve do branco (`out = (last + 0.02*w) / 1.02`), ganho x3,5.
- **Envelope**: `gain.gain.setValueAtTime(0.0001, t)`, `exponentialRampToValueAtTime(pico, t + attack)`, depois `exponentialRampToValueAtTime(0.0001, t + attack + decay)`. Nunca partir de zero exato (exponencial) e sempre terminar em 0,0001 antes de parar o nó, para não estalar.
- **Sem estalo**: `osc.stop(t + dur + 0.05)`; desconectar os nós no `onended`.
- **Aleatoriedade leve**: cada disparo varia a afinação em ±2 % e o ganho em ±1 dB, para repetições não soarem como máquina.

### 3.2 Apitos

Receita-base `whistle(ctx, bus, t, dur, f0)`, com `f0 ≈ 2900 Hz`:

1. Duas ondas `sine` em `f0` e `f0 * 1.045` (batimento de ~130 Hz que dá o timbre áspero do apito).
2. Um LFO `sine` de 26 Hz (a "ervilha") ligado em um `GainNode` que modula o ganho das duas ondas em ±35 % (`depth 0.35`, base 0.65).
3. Ruído branco → `bandpass` a 3200 Hz, Q 1,2, ganho 0,12 (o sopro).
4. Envelope: ataque 15 ms, sustentação, queda de 60 ms no fim. A frequência cai 3 % no último terço (sopro acabando): `osc.frequency.linearRampToValueAtTime(f0 * 0.97, t + dur)`.
5. `highpass` a 1500 Hz no total, para não ocupar o grave da torcida.

| Som             | Composição                                                                                                                                |
| --------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `whistle_start` | 1 apito, `dur` 0,6 s, `f0` 2900                                                                                                           |
| `whistle_half`  | apitos de 0,22 s (t=0), 0,22 s (t=0,32) e 0,6 s (t=0,64); `f0` 2900                                                                       |
| `whistle_full`  | três apitos de 0,45 s (t=0, 0,65 e 1,3 s), `f0` 2900, o último com +3 % de afinação (clímax)                                              |
| `yellow`        | 1 apito de 0,22 s, `f0` 3100, só 1 onda (mais fino e seco)                                                                                |
| `red`           | 1 apito de 0,7 s a `f0` 2800 + baque (3.4, `thud`) em t=0,05                                                                              |
| `penalty`       | 1 apito de 0,5 s; em seguida a torcida entra em `hush` (ganho do bus da torcida a 0,4 em 0,15 s, volta em 1 s depois que o lance resolve) |

### 3.3 Torcida

**Ambiente** (loop; dois nós de ruído rosa com offsets diferentes para não repetir o mesmo trecho nos dois canais; o resultado é mono):

- `murmur`: ruído rosa → `lowpass` 900 Hz (Q 0,5) → ganho-base 0,22. Um LFO `sine` de 0,13 Hz modula o ganho em ±15 % (ondas lentas de multidão). Um `bandpass` paralelo a 500 Hz, Q 0,8, ganho 0,12, com LFO de 0,21 Hz fora de fase.
- `tension`: ruído rosa → `bandpass` 1100 Hz, Q 0,7 → ganho `0.05 + 0.30 * i`; LFO de 0,35 Hz em ±25 % (a oscilação cresce com `i`).
- `swell`: ruído branco → `bandpass` 2400 Hz, Q 0,6 → `highshelf` +3 dB a 3 kHz → ganho `max(0, i - 0.6) * 0.5`.
- O corte do `lowpass` do murmúrio sobe de 700 para 1400 Hz conforme `i` vai a 1 (gente gritando é mais brilhante).
- Saída: um `ConvolverNode` curto (impulso sintético: ruído com decaimento exponencial de 1,4 s, gerado uma vez) misturado a 18 % úmido, para dar a sensação de estádio aberto.

**Explosão do gol** (`goal`, 3 s):

1. Rede (t=0, 0,3 s): ruído branco → `highpass` 3500 Hz → envelope ataque 5 ms, queda 220 ms, pico 0,5; mais `thud` (3.4) a -6 dB. É o som da bola na rede.
2. Torcida (começa em t=0,15 s): ruído rosa → dois `bandpass` em paralelo, a 700 Hz (Q 1,5) e a 1300 Hz (Q 1,8), que dão as vogais abertas de um "ahhh" sem palavra. Ataque 0,25 s até pico 0,9, sustentação 1,2 s, queda exponencial de 1,6 s. A frequência central dos dois `bandpass` sobe 15 % durante o ataque (o grito que abre).
3. Brilho: ruído branco → `bandpass` 3000 Hz, ganho 0,25 da camada acima, mesmo envelope.
4. Ao fim, a torcida ambiente volta a `i` ≥ 0,55 e desce em 6 s (a comemoração que passa).
5. Variante do gol do adversário: só o item 2 com ganho 0,35, `lowpass` 900 Hz, sem brilho, e a ambiente cai a `i` 0,15 por 4 s (a casa calou).

**Vaia** (`boo`, 2,2 s): ruído rosa → `bandpass` 320 Hz, Q 2,5 (formante grave) com frequência central caindo 320 → 240 Hz em 2 s; LFO de 5 Hz em ±20 % no ganho (a vibração de muitas vozes); ataque 0,4 s, queda 1,6 s; ganho final 0,5. Sem componente agudo.

**"Ohhh" de quase-gol** (em `post` e `save`): como a explosão, mas com `bandpass` descendo 900 → 600 Hz, duração 0,8 s, ganho 0,45, sem rede nem brilho.

**`all_out`**: `tension` sobe de `i` atual a `i + 0.3` em 1,2 s, mais um `swell` curto em t=1,0 s; volta à base em 4 s. Sem batida, sem canto.

### 3.4 Baque, trave, defesa, lesão, troca

- `thud` (baque): `sine` 110 → 45 Hz em 90 ms (`exponentialRamp`), envelope ataque 2 ms, queda 140 ms, pico 0,8.
- `post` (trave): três `sine` inarmônicas em 1180, 3260 e 6370 Hz (razões 1 : 2,76 : 5,40, comportamento de barra metálica), ganhos 0,6 / 0,3 / 0,15, queda exponencial de 0,45 / 0,3 / 0,18 s, mais um `thud` de -10 dB em t=0. Depois o "ohhh" de quase-gol em t=0,12.
- `save` (defesa): palmada de luva = ruído branco → `bandpass` 1500 Hz, Q 1,0, envelope ataque 2 ms, queda 90 ms, pico 0,6; mais `thud` de -12 dB. Depois "ohhh" curto.
- `injury`: `sine` 220 → 175 Hz em 0,4 s, envelope suave (ataque 40 ms, queda 0,4 s), pico 0,3; torcida -3 dB por 2 s.
- `sub`: duas `triangle`, 660 Hz (t=0) e 880 Hz (t=0,12 s), 0,12 s cada, envelope ataque 5 ms e queda 110 ms.

### 3.5 Plantão e interface

- `flash_short`: dois bips `triangle` de 988 Hz (t=0) e 1319 Hz (t=0,11 s), 80 ms cada, envelope ataque 3 ms, queda 70 ms, `lowpass` 4000 Hz.
- `flash_big`: três bips `triangle` em 659, 880 e 1175 Hz (t=0, 0,13 e 0,26 s), 110 ms cada, mais um colchão: duas `sine` em 220 e 330 Hz, ataque 80 ms, queda 0,5 s, ganho 0,2.
- `ui_tap`: `sine` 1800 Hz, 20 ms, ataque 2 ms, queda 18 ms, pico 0,25.
- `ui_ok`: `sine` 880 Hz (t=0) e 1320 Hz (t=0,07 s), 70 ms cada, queda exponencial, pico 0,3.
- `ui_back`: `sine` 700 Hz, 35 ms, pico 0,2.

### 3.6 Teste de aceite da síntese

O `developer` entrega uma página de bancada (rota só em desenvolvimento, fora do build de produção) com um botão por som e um controle de `i` da torcida. O CEO e o `audio-designer` ouvem e ajustam só os números da seção 3 (num arquivo de parâmetros do módulo). Critérios: nenhum estalo no início ou no fim; nenhum som passa de -3 dBFS somado; a torcida não soa como vento ou chiado de TV quando `i` está em 0,3 (se soar, aciona a opção b na seção 4).

## 4. Opção b: gravação livre, só se a síntese não convencer

Uso previsto: apenas a **massa da torcida** (e, se preciso, a vaia). Os apitos, a rede, as notas e a interface ficam sintetizados.

**Fontes sugeridas (não baixar agora):**

| Fonte                                | Licença aceita                           | Observação                                                                          |
| ------------------------------------ | ---------------------------------------- | ----------------------------------------------------------------------------------- |
| Freesound.org                        | **só CC0** (filtro "Creative Commons 0") | A licença é por arquivo; conferir na página. Rejeitar CC-BY, CC-BY-NC e "Sampling+" |
| OpenGameArt.org                      | CC0                                      | Filtrar por CC0 e por "Sound Effect"                                                |
| Kenney.nl                            | CC0                                      | Pacotes de efeitos de interface e impacto; pouca torcida                            |
| Wikimedia Commons / Internet Archive | domínio público ou CC0                   | Conferir a marca "Public domain" ou "CC0" explícita, não "PD por idade" duvidosa    |

Fora: bibliotecas "royalty-free" com licença própria (por exemplo pacotes comerciais de efeitos), porque a licença não é CC0 e não permite redistribuir o arquivo no repositório público de um PWA sem análise.

**Critérios de busca e de aceitação:**

1. Busca: "crowd ambience", "stadium crowd murmur", "football crowd loop", "crowd cheer", "crowd boo", em CC0.
2. Rejeitar qualquer gravação com **voz identificável**: canto, coro, cântico, palavras inteligíveis, nome de clube ou jogador, locutor, hino, bateria de torcida organizada, buzina característica. Se se ouve uma frase, rejeitar.
3. Rejeitar gravação de transmissão (narrador ao fundo, vinheta de emissora).
4. Preferir mono, sem música, 15 a 40 s, sem pico isolado (apito, grito agudo) que denuncie o loop.
5. Aceitar só se o loop fecha sem salto (crossfade de 1 s nas pontas).
6. Registro obrigatório antes do arquivo entrar no repositório: uma linha em `docs/audio/inventario.md` (criar na primeira entrada, no mesmo formato de `docs/art/inventario.md`), com: arquivo final, URL da página original, autor, licença (texto "CC0 1.0"), data da conferência, e quem conferiu. Sem a linha, o arquivo não entra.
7. Passa pelo CEO (ouvir e aprovar) e pelo `security-auditor` só se a licença for diferente de CC0.

**Peso estimado (se usada):** 3 loops (`murmur`, `tension`, `swell`) de 20 s, mono, Opus 32 kbps, cerca de 80 KB cada, ou seja ~240 KB no total. Carregam sob demanda, na primeira partida com som, e ficam no cache do service worker (cache de execução, fora do precache).

## 5. Tamanho, formato e meta de peso

| Item                                                    | Estimativa                                              |
| ------------------------------------------------------- | ------------------------------------------------------- |
| Código do módulo de áudio (síntese + diretor + mixagem) | 8 a 12 KB minificado, ~4 KB gzip                        |
| Arquivos de áudio no cenário só com síntese             | **0 KB**                                                |
| Arquivos de áudio no cenário com torcida gravada        | ~240 KB (3 loops)                                       |
| **Meta de peso do Passo 1**                             | **≤ 15 KB gzip de código e ≤ 300 KB de áudio no total** |

- O código de áudio fica em um chunk separado (`import()` dinâmico), baixado só depois do primeiro gesto e do aceite do jogador. Quem nunca liga o som nunca baixa nada. Nada de áudio no precache da PWA.
- Formato dos arquivos (só se houver gravação): **OGG/Opus mono 32 kbps**, normalizado a -16 LUFS integrado e pico real ≤ -1 dBTP, cada arquivo abaixo de 100 KB. Alternativa para navegadores sem Opus em OGG (Safari mais antigo): **M4A/AAC mono 48 kbps** do mesmo arquivo, escolhido com `canPlayType` no carregamento. O `manifest.json` lista os dois.
- Latência: sons de partida são sintetizados na hora (sem decodificar nada), então não há atraso entre o gol e a rede.

## 6. Regras

1. **Nada que imite real**: sem canto, grito articulado, hino, vinheta ou melodia que lembre torcida, clube ou emissora real. A torcida sintetizada não tem voz; só ruído filtrado. As notas do plantão e do gol são intervalos simples sem melodia. Apito de árbitro é som genérico.
2. **Sem nome de jogo, de jogador ou de clube** em qualquer som (não há voz neste passo).
3. **Primeiro gesto**: o `AudioContext` só é criado (ou `resume()`) dentro de um evento de toque/clique. Antes disso o módulo não faz nada e as chamadas `cue()` são ignoradas sem erro. Se o contexto ficar `suspended` ou `interrupted` (iOS, chamada telefônica), o módulo tenta `resume()` no próximo gesto e nunca mostra erro ao jogador.
4. **Volumes** (em Preferências, US-044): quatro controles, **Geral**, **Efeitos**, **Torcida** e **Mudo**. O mudo é também um botão pequeno e sempre visível na tela de partida (alvo ≥ 44 px, ícone e rótulo de texto). Os valores ficam no aparelho, como as outras preferências, sem dado pessoal.
5. **Padrão proposto**: **desligado**. Na primeira partida em que o jogador abre a tela de partida, aparece uma pergunta única, "Quer ouvir o estádio?", com "Sim, ligar o som" e "Agora não". O toque em "Sim" é o primeiro gesto. Se ligar: Geral 60 %, Efeitos 80 %, Torcida 50 %. A resposta é lembrada e a pergunta não volta (só as Preferências mudam). Motivo: o jogo é de celular, usado em ônibus, sala de aula e cama; som inesperado é o pior erro de um jogo mobile.
6. **Modo silencioso e reprodução do aparelho**: o Web Audio no iOS obedece à chave de silêncio do aparelho; manter assim (o jogo não tenta furá-la) e declarar a sessão como "ambiente" (`navigator.audioSession.type = 'ambient'`, onde existir), para não interromper a música do jogador. No Android, tocar via Web Audio dentro do navegador já segue o volume de mídia. Quando a aba perde o foco (`visibilitychange` → `hidden`), `ctx.suspend()`; ao voltar, `resume()`.
7. **`prefers-reduced-motion`** trata de movimento, não de som, então **não** liga ou desliga áudio sozinho. Em compensação: a vibração (que já existe no Android) obedece a esse sinal, e o plantão grande com reduced-motion não ganha som extra. Não se acopla o som a um sinal de acessibilidade que mede outra coisa.
8. **Acessibilidade**: nenhum evento é informado só por som. Tudo que toca tem seu texto na narração rolando, ou ícone, ou placar (gol, cartão, lesão, troca, plantão, fim do jogo). Os testes E2E checam que, com o som mudo, todos os eventos continuam visíveis. Nada toca em alerta crítico sozinho, e as pessoas surdas ou com o som desligado jogam sem perda.
9. **Ritmo e velocidade**: em velocidade rápida só tocam apitos e gol (o resto é cortado), para a partida não virar uma pilha de sons. No modo "só resultado" só toca o apito final. Pausar a partida pausa a torcida (queda a `i` 0,1 em 0,3 s).
10. **Spoiler**: nenhum som antecipa o desfecho de um lance. O "perigo" da torcida usa só o que a animação já mostrou; o gol toca só quando a animação revela, depois da pausa dramática.
11. **Gol em outro jogo**: o plantão nunca usa o som do gol da partida assistida. O gol de outro jogo é só `flash_*`.

## 7. Arquitetura proposta (não implementar agora)

```
app/src/lib/audio/
  manifest.json          id do som → { kind: "synth" | "sample", recipe | files, bus, priority, gainDb, cooldownMs }
  index.ts               API pública, não toca em Web Audio até o primeiro gesto
  engine.ts              AudioContext, buses (master, sfx, crowd), compressor, ducking, polifonia
  recipes/               uma função por receita da seção 3 (whistle.ts, crowd.ts, goal.ts, ui.ts)
  director.ts            traduz MatchEvent / estado da partida em cues e em intensidade da torcida
  prefs.ts               volumes e mudo (lidos das Preferências)
```

- **Eixo principal**: `audio.cue(id, opts?)` para sons pontuais e `audio.crowd.set({ intensity, mood })` para o ambiente. A UI chama a API; o módulo se vira.
- **O motor não depende do áudio.** O motor já emite `MatchEvent[]` puros. A camada de partida da UI (a mesma que alimenta a animação do campo e a narração em texto) recebe os eventos, decide o instante em que o lance é revelado e chama `director.onReveal(event, context)`. O diretor mora em `app/src/lib/audio/`, importa **tipos** de `engine/` (permitido: `lib` pode importar do motor) e o motor jamais importa `lib/`. Se não houver áudio (desligado, sem gesto, sem suporte), `onReveal` retorna sem fazer nada. Nenhum teste do motor muda; `ENGINE_VERSION` não sobe e o golden não mexe.
- **Teste sem navegador**: o diretor é função pura (`MatchEvent + contexto → lista de cues e `i` alvo`) e pode ser testado em Vitest sem `AudioContext`. As receitas ficam atrás de uma interface (`SoundBackend`), com implementação Web Audio e uma falsa de teste.
- **Manifesto**: `manifest.json` aponta para receitas (`"kind": "synth", "recipe": "whistle_full"`) e, se existir gravação, para arquivos (`"kind": "sample", "files": {"opus": "audio/crowd_murmur.ogg", "aac": "audio/crowd_murmur.m4a"}`). A troca de síntese por gravação é só trocar a linha do manifesto, sem mexer em quem chama.
- **Carregamento sob demanda**: (1) o chunk de áudio é um `import()` disparado pelo aceite da pergunta da seção 6; (2) as receitas de partida carregam juntas na primeira partida com som; (3) as de interface na primeira interação depois do aceite; (4) amostras (se houver) com `fetch` + `decodeAudioData` na primeira partida, em segundo plano, e a síntese cobre o intervalo até chegar; (5) tudo fora do precache do service worker; amostras no cache de execução.
- **Preferências**: `prefs.ts` lê e grava no armazenamento do aparelho junto das outras preferências (US-044). Sem servidor, sem analytics de uso do som.
- **Mixagem (buses)**: `master` → compressor → destino; `sfx` e `crowd` entram no master; a torcida tem um sub-bus `crowd.hush` (para o silêncio de tensão do pênalti) e o ducking (-6 dB por 1,5 s) quando um som de prioridade 1 ou 2 toca.
- **Dono de cada parte**: `developer` implementa; `ux-designer` define o controle de volume, o botão de mudo e a pergunta única (e a tela de Preferências); `qa-engineer` testa mudo, primeiro gesto, aba em segundo plano e eventos sem som; `performance-engineer` mede o custo de CPU da torcida em celular fraco (meta: menos de 5 % de CPU em segundo plano de partida). Se passar, reduz-se a 2 camadas.

## 8. Roteiro dos passos seguintes (só planejamento)

**Passo 2: torcida e atmosfera melhores (ainda sem voz)**

- Variações de torcida: 3 a 4 timbres de `murmur` por estádio (aberto, fechado, pequeno, grande), escolhidos pelo estádio do clube.
- Cantos inventados por clube: melodias curtas, sem letra reconhecível e sem referência a canto real, derivadas de um gerador (escala e ritmo vêm de uma semente do clube, como o escudo). Revisão do CEO em cada família de timbre, e checagem de que nada lembra um canto real conhecido.
- Estádio cheio ou vazio pelo termômetro da torcida: o `setMood` da seção 2.2 passa a valer; vaias e coros crescem com o termômetro e com o público.
- Possível música de menu (a definir; PROJETO.md fala em ElevenLabs pago ou músico independente), que exigiria decisão e licença à parte.
- Se a síntese não bastar, entram aqui as gravações CC0 da seção 4 e o `docs/audio/inventario.md`.

**Passo 3: narração no ElevenLabs (exige estimativa de créditos e ok escrito do CEO)**

- Banco de narração em `docs/audio/narracao.pt-BR.md` e `narracao.es.md`, frases escritas pelo `content-writer`, aprovadas pelo CEO. Eventos: gol, defesa, trave, pênalti, cartão, virada, fim de jogo, nome genérico do clube (se houver). Sem nome do jogo e sem nome de jogador.
- Plano de vozes em `docs/audio/vozes.md`, criadas no Voice Design (originais; nunca clone de narrador).
- Cada lote em `docs/audio/lotes/<lote>.md` com contagem de frases, créditos estimados e custo. O plano gratuito só testa vozes; nada dele vai ao jogo. Nenhuma chamada sem o "pode gerar" escrito do CEO.
- A mixagem da narração fica por cima da torcida com ducking de -8 dB; a narração em voz é opcional e desliga separada (quinto controle de volume).

## 9. Decisões para o CEO

1. **Som desligado ou ligado por padrão?** Minha recomendação: **desligado**, com uma pergunta única na primeira partida ("Quer ouvir o estádio?"). Motivo: ninguém quer que o celular apite no ônibus. Se você preferir ligado, o mesmo toque da pergunta vira só um aviso e o volume geral começa em 40 %.
2. **Torcida: síntese ou gravação livre?** Recomendo **começar pela síntese** (custo zero, zero arquivo, zero licença) e ouvir na página de bancada. Se soar como vento, entra a gravação CC0 (~240 KB), que exige que você ouça e aprove, e o registro de licença. Posso preparar a busca de candidatos quando você mandar.
3. **Aceitar mudar a P5?** A P5 dizia "sem áudio na Etapa 1" e o PROJETO.md prevê efeitos pelo ElevenLabs. Pelo seu pedido, o áudio essencial entra na Etapa 1a, por código, e o ElevenLabs fica para a narração (Passo 3). Isso pede um ADR curto; o Orquestrador abre e atualiza os requisitos.
4. **Escopo do Passo 1.** Os três itens que você chamou de opcionais (defesa difícil, substituição e "todo mundo no ataque") custam pouco de síntese. Recomendo **incluir os três**, com volume baixo. Se quiser enxugar, o corte natural é substituição.
5. **O plantão tem som?** Recomendo som só no plantão grande e um bip baixíssimo no curto, e ambos desligam com a preferência "Plantão dos outros jogos" (US-074). Alternativa: só o grande.
6. **Botão de mudo na tela de partida?** Recomendo sim, sempre visível, além do controle nas Preferências.
7. **Tela vem junto?** O áudio entra junto da T-033 como uma tarefa separada, para não atrasar a tela; ele só liga em cima dela. Se preferir tudo no mesmo PR, o risco é a T-033 crescer demais para o portão de revisão.

## 10. Estimativa deste lote

| Item                                       | Quantidade                | Créditos ElevenLabs | Custo    |
| ------------------------------------------ | ------------------------- | ------------------- | -------- |
| Sons de partida (apitos, gol, trave, etc.) | 12 receitas               | 0                   | R$ 0     |
| Plantão                                    | 2 receitas                | 0                   | R$ 0     |
| Interface                                  | 3 receitas                | 0                   | R$ 0     |
| Torcida ambiente                           | 3 camadas + vaia + "ohhh" | 0                   | R$ 0     |
| Gravações CC0 (condicional)                | 0 a 3 arquivos            | 0                   | R$ 0     |
| **Total**                                  | **17 sons + torcida**     | **0**               | **R$ 0** |

## 11. O que o `developer` precisa integrar (depois do ok do CEO)

1. Criar `app/src/lib/audio/` com a estrutura da seção 7 e o `manifest.json` (as 17 entradas da seção 2, `kind: "synth"`).
2. Ligar `director.onReveal` ao ponto onde a camada de partida revela cada lance (T-033), e `crowd.set` ao relógio, ao placar e à preferência de velocidade.
3. Tela de Preferências (US-044): quatro controles (Geral, Efeitos, Torcida, Mudo); botão de mudo na tela de partida; pergunta única da primeira partida.
4. Página de bancada só em desenvolvimento.
5. Testes: diretor puro em Vitest; E2E com som mudo e com som desligado (todos os eventos continuam visíveis em texto ou ícone); aba em segundo plano.
6. Nada de arquivo em `app/public/audio/` neste passo, a menos que o CEO escolha a opção b para a torcida.
