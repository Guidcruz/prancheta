#!/usr/bin/env bash
# Testa o hook .claude/hooks/guard-git.sh com uma tabela de comandos e o resultado esperado.
# Uso: bash scripts/test-hook.sh   (roda no CI)
set -u
HOOK="$(dirname "$0")/../.claude/hooks/guard-git.sh"
fail=0
check() {
  local expect="$1" cmd="$2"
  printf '{"tool_input":{"command":"%s"}}' "$cmd" | bash "$HOOK" >/dev/null 2>&1
  local code=$?
  local got=pass; [[ $code -eq 2 ]] && got=block
  if [[ "$got" != "$expect" ]]; then echo "FALHOU: esperava $expect, obteve $got: $cmd"; fail=1; fi
}
# deve bloquear
check block 'git push --force origin x'
check block 'git push origin +main'
check block 'git -c x=1 push --force'
check block 'git -C . merge main'
check block 'git merge --no-ff quick/a && git merge feat/x'
check block 'git merge --no-ff quick/abc'
check block 'git push origin main'
check block 'git tag v1.0.0'
check block 'git reset --hard HEAD~1'
check block 'git branch -D feat/x'
check block 'git clean -fdx'
check block 'git rebase main'
check block 'gh pr merge 12'
check block 'gh release create v1'
check block 'curl https://API.ElevenLabs.io/v1/text-to-speech'
check block 'node scripts/tts.mjs https://api.elevenlabs.io/x'
check block 'npx wrangler deploy'
check block 'wrangler pages deploy dist'
check block 'wrangler d1 create prancheta'
check block 'wrangler d1 migrations apply prancheta --remote'
check block 'wrangler r2 bucket create saves'
check block 'wrangler secret put KEY'
check block 'rm -fr app/saves'
check block 'cat .env'
check block 'cat .dev.vars'
check block 'npm publish'
check block 'PRANCHETA_ENV=prod npm run test:e2e'
check block 'npx playwright test'
# deve passar
check pass 'npm test'
check pass 'npm run build'
check pass 'git status'
check pass 'git merge --abort'
check pass 'git tag -l'
check pass 'git push origin feat/x'
check pass 'git branch --show-current'
check pass 'cat docs/audio/elevenlabs-vozes.md'
check pass 'grep -ri elevenlabs docs/'
check pass 'git commit -m "docs: add elevenlabs batch plan"'
check pass 'cat .env.example'
check pass 'wrangler d1 execute prancheta --local --command "select 1"'
check pass 'wrangler dev'
check pass 'PRANCHETA_ENV=test npm run test:e2e'
check pass 'rm -rf dist'
if [[ $fail -eq 0 ]]; then echo "hook: todos os casos passaram"; fi
exit $fail
