#!/usr/bin/env bash
# Hook PreToolUse das ferramentas Bash e PowerShell (empresa de agentes, adaptado ao Prancheta).
# Bloqueia o que é do CEO (merge, tag, release, force, apagar branch, commit na main) e o que é
# perigoso no projeto (bloco "projeto" abaixo). Sai com 2 = bloqueia; 0 = passa.
# Só bash, sem jq nem python (roda no Git Bash do Windows). Testes: scripts/test-hook.sh.

shopt -s nocasematch

input="$(cat)"
full="$input"
re_cmd='"command"[[:space:]]*:[[:space:]]*"((\\.|[^"\\])*)"'
if [[ "$input" =~ $re_cmd ]]; then full="${BASH_REMATCH[1]}"; fi
full="${full//\\\"/\"}"
full="${full//\\n/ ; }"

# Remove o conteúdo entre aspas e heredocs antes de casar as regex: uma mensagem de commit que
# cite "merge" ou "deploy" não é um comando.
strip_quotes() {
  local s="$1"
  s="$(printf '%s' "$s" | sed -E "s/'[^']*'/''/g; s/\"[^\"]*\"/\"\"/g; s/<<-?[[:space:]]*['\"]?[A-Za-z_]+['\"]?.*$//")"
  printf '%s' "$s"
}
current_branch() {
  if [[ -n "${GUARD_BRANCH:-}" ]]; then printf '%s' "$GUARD_BRANCH"; else git branch --show-current 2>/dev/null; fi
}

block() {
  echo "BLOQUEADO pela regra do projeto: $1" >&2
  echo "Isso é do CEO ou é perigoso. Prepare o comando exato e peça a ele; não tente outro caminho." >&2
  exit 2
}

# ---- Ajuste por projeto (Prancheta) -----------------------------------------------------------
# Caminho leve: no Prancheta todo merge na main é pelo GitHub (PR + proteção de branch), então
# nenhum merge local é liberado e ninguém dá push na main.
ALLOW_QUICK_MERGE=0
ALLOW_PUSH_MAIN=0
# Apagar branch é do CEO (docs/PROCESSO.md). 0 = bloqueia qualquer -D/-d.
ALLOW_BRANCH_DELETE=0
# Comandos perigosos do projeto (regex estendida, sem diferenciar maiúsculas).
PROJECT_BLOCK_PATTERNS=(
  # deploy e recursos pagos na Cloudflare são do CEO (prévias por PR são do Pages, automáticas)
  'wrangler[[:space:]]+(deploy|publish|pages[[:space:]]+(deploy|publish))'
  'wrangler[[:space:]]+d1[[:space:]]+(create|delete)'
  'wrangler[[:space:]]+d1[[:space:]]+(execute|migrations[[:space:]]+apply)[^;&|]*--remote'
  'wrangler[[:space:]]+r2[[:space:]]+bucket[[:space:]]+(create|delete)'
  'wrangler[[:space:]]+kv[[:space:]]+namespace[[:space:]]+(create|delete)'
  'wrangler[[:space:]]+secret[[:space:]]+(put|delete)'
  # nenhuma chamada paga ao ElevenLabs por agente (ler docs sobre o ElevenLabs é permitido)
  '(curl|wget|http|https|fetch|node|npx|python|python3|deno|bun|Invoke-WebRequest|Invoke-RestMethod)[^;&|]*elevenlabs\.io'
  # apagar saves ou dados do jogo
  '(rm|Remove-Item)[[:space:]]+(-[a-z]*(r|f)[a-z]*|--recursive|--force|-Recurse)[^;&|]*(saves|\.prancheta|prancheta-data)'
  # publicar pacotes
  'npm[[:space:]]+publish'
  # ler ou copiar segredos pelo shell
  '(cat|less|more|head|tail|type|Get-Content|bat|cp|copy|grep|rg|source|\.|mv|scp)[[:space:]][^;&|]*(\.env($|[^.a-z])|\.dev\.vars)'
  # mais deploy e escrita remota na Cloudflare; merge por API
  'wrangler[[:space:]]+versions[[:space:]]+deploy'
  'wrangler[[:space:]]+kv[[:space:]]+key[[:space:]]+(put|delete)[^;&|]*--remote'
  'gh[[:space:]]+api[^;&|]*/merge'
  # histórico e árvore: operações destrutivas são do CEO
  'git([[:space:]]+(-[cC][[:space:]]*[^[:space:]]+|--[a-z-]+))*[[:space:]]+(clean[[:space:]]+-[a-z]*[fx]|checkout[[:space:]]+--[[:space:]]+\.([[:space:]]|$)|restore[[:space:]]+\.([[:space:]]|$))'
  # rebase reescreve a história: só --abort e --continue são permitidos (para sair de um rebase iniciado pelo CEO)
  'git([[:space:]]+(-[cC][[:space:]]*[^[:space:]]+|--[a-z-]+))*[[:space:]]+rebase([[:space:]]+(-i|--interactive|--onto|[A-Za-z0-9/_.-]+))*[[:space:]]*($|[;&|])'
  'git([[:space:]]+(-[cC][[:space:]]*[^[:space:]]+|--[a-z-]+))*[[:space:]]+pull[^;&|]*(--rebase|-r([[:space:]]|$))'
)
# Rodar E2E e preview só com o ambiente de teste (regra a ativar na Etapa 1a, quando existirem).
APP_PATTERN='(playwright[[:space:]]+test|npm[[:space:]]+run[[:space:]]+(test:e2e|preview)([[:space:]]|$)(-w[[:space:]]+app)?([[:space:]]|$)|vite[[:space:]]+preview)'
APP_REQUIRED_ENV=('PRANCHETA_ENV=test')
# ----------------------------------------------------------------------------------------------

# git pode vir com -C <dir> ou -c k=v antes do subcomando
gitpre='git([[:space:]]+(-[cC][[:space:]]*[^[:space:]]+|--[a-z-]+))*[[:space:]]+'
sep='[^;&|]'
re_git="(^|[[:space:];&|(])${gitpre}"
re_merge="${gitpre}merge([[:space:]]|$)"
re_merge_abort="${gitpre}merge[[:space:]]+--abort"
re_merge_main="${gitpre}merge[[:space:]]+(origin/)?(main|master)[[:space:]]*($|[;&|])"
re_merge_quick="${gitpre}merge[[:space:]]+--no-ff[[:space:]]+quick/[A-Za-z0-9._-]+"
re_force="${gitpre}push${sep}*(--force|-f([[:space:]]|$)|--force-with-lease|--delete|--mirror|[[:space:]]:[A-Za-z]|[[:space:]]\+[A-Za-z])"
re_push_main="${gitpre}push${sep}*[[:space:]:/+](main|master)([[:space:]]|$|:)"
re_push_bare="${gitpre}push[[:space:]]*($|[;&|])"
re_tag="${gitpre}tag([[:space:]]|$)"
re_tag_list="${gitpre}tag[[:space:]]+(-l|--list|-n)"
re_reset="${gitpre}reset${sep}*--hard"
re_branch_del="${gitpre}branch${sep}*[[:space:]](-D|-d|--delete)([[:space:]]|$)"
re_rewrite="${gitpre}(filter-branch|filter-repo)([[:space:]]|$)"
re_commit="${gitpre}commit([[:space:]]|$)"
re_newbranch="${gitpre}(checkout[[:space:]]+-b|switch[[:space:]]+-c)"
re_gh_release='gh[[:space:]]+release([[:space:]]|$)'
re_gh_merge='gh[[:space:]]+pr[[:space:]]+merge([[:space:]]|$)'
re_gh_workflow='gh[[:space:]]+workflow[[:space:]]+run([[:space:]]|$)'
re_gh_delete='gh[[:space:]]+repo[[:space:]]+delete([[:space:]]|$)'

check_one() {
  local cmd="$1"
  if [[ "$cmd" =~ $re_git ]]; then
    if [[ "$cmd" =~ $re_merge ]] && ! [[ "$cmd" =~ $re_merge_abort ]]; then
      branch="$(current_branch)"
      if [[ "$cmd" =~ $re_merge_main && "$branch" != "main" && "$branch" != "master" && -n "$branch" ]]; then
        : # atualizar a branch de trabalho com a main é permitido
      elif [[ "$ALLOW_QUICK_MERGE" == "1" && "$cmd" =~ $re_merge_quick ]]; then :; else
        block "git merge (o merge na main é pelo PR, feito pelo CEO)"
      fi
    fi
    [[ "$cmd" =~ $re_force ]] && block "push forçado / apagar branch remota"
    if [[ "$ALLOW_PUSH_MAIN" != "1" ]]; then
      [[ "$cmd" =~ $re_push_main ]] && block "push na main"
      if [[ "$cmd" =~ $re_push_bare ]]; then
        branch="$(current_branch)"
        [[ "$branch" == "main" || "$branch" == "master" ]] && block "push estando na '$branch'"
      fi
    fi
    if [[ "$cmd" =~ $re_tag ]] && ! [[ "$cmd" =~ $re_tag_list ]]; then block "git tag (a versão é do CEO)"; fi
    [[ "$cmd" =~ $re_reset ]] && block "git reset --hard"
    if [[ "$cmd" =~ $re_branch_del ]]; then
      if [[ "$ALLOW_BRANCH_DELETE" != "1" ]] || [[ "$cmd" =~ (-D|-d|--delete)[[:space:]]+(main|master)([[:space:]]|$) ]]; then
        block "apagar branch"
      fi
    fi
    [[ "$cmd" =~ $re_rewrite ]] && block "reescrever a história"
    if [[ "$cmd" =~ $re_commit ]]; then
      branch="$(current_branch)"
      if [[ "$branch" == "main" || "$branch" == "master" ]] && ! [[ "$cmd" =~ $re_newbranch ]]; then
        block "commit estando na '$branch' (trabalhe numa branch)"
      fi
    fi
  fi

  [[ "$cmd" =~ $re_gh_release ]]  && block "gh release (publicar é do CEO)"
  [[ "$cmd" =~ $re_gh_merge ]]    && block "gh pr merge"
  [[ "$cmd" =~ $re_gh_workflow ]] && block "gh workflow run"
  [[ "$cmd" =~ $re_gh_delete ]]   && block "gh repo delete"

  local pat
  for pat in "${PROJECT_BLOCK_PATTERNS[@]}"; do
    # sair de um rebase (--abort/--continue/--skip/--quit) é permitido
    [[ "$pat" == *rebase* && "$cmd" =~ rebase[[:space:]]+--(abort|continue|skip|quit) ]] && continue
    [[ -n "$pat" && "$cmd" =~ $pat ]] && block "comando do projeto: $pat"
  done

  if [[ -n "$APP_PATTERN" && "$cmd" =~ $APP_PATTERN ]]; then
    local v
    for v in "${APP_REQUIRED_ENV[@]}"; do
      [[ "$cmd" == *"$v"* ]] || block "rodar o app sem o ambiente de teste ($v)"
    done
  fi
}

# Avalia cada trecho separado por ; && || e |, para uma exceção não liberar a linha inteira.
full="$(strip_quotes "$full")"
IFS=$'\n' read -r -d '' -a parts < <(printf '%s' "$full" | sed -E 's/(&&|\|\||;|\|)/\n/g'; printf '\0')
for part in "${parts[@]}"; do
  [[ -n "${part// /}" ]] && check_one "$part"
done
check_one "$full"

exit 0
