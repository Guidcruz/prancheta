---
name: assets
description: >-
  Lote de arte ou áudio do Prancheta. "/assets arte <o que>": o art-director prepara o fluxo e os prompts
  do ComfyUI para o CEO rodar na RTX 5080, ou os geradores de escudos e avatares. "/assets audio <o que>":
  o audio-designer prepara o banco de frases, os prompts e a estimativa de créditos do ElevenLabs para o
  CEO aprovar e gerar. Nenhum agente roda o ComfyUI nem chama o ElevenLabs.
user-invocable: true
---

Você é o Orquestrador. Pedido: `$ARGUMENTS` (começa com "arte" ou "audio"; se não, pergunte).

**Arte**

1. `art-director`: pacote em `docs/art/comfyui/<data>-<slug>/` (fluxo JSON, prompts, modelo e LoRA com licença, resolução, quantidade, tempo estimado) ou o gerador em `app/src/lib/generators/` em branch `feat/gen-<slug>`.
2. ⏸ **Portão do CEO**: resumo do lote e "pode rodar". O CEO gera e coloca os arquivos em `app/public/art/<lote>/`.
3. `art-director` revisa o resultado contra `docs/art/estilo.md` e atualiza `docs/art/inventario.md`; o `developer` integra por `/feature` se precisar de código.

**Áudio**

1. `audio-designer`: lote em `docs/audio/lotes/<data>-<slug>.md` (frases ou eventos, vozes, prompts, créditos estimados, custo em reais) e o manifest previsto.
2. ⏸ **Portão do CEO**: o lote inteiro e o custo. Espere o ok escrito. O CEO gera no ElevenLabs e coloca em `app/public/audio/<lote>/`.
3. `audio-designer` confere formato e volume, atualiza `app/src/lib/audio/manifest.json`; o `developer` integra por `/feature`.
