#!/usr/bin/env bash
# Testa scripts/git-hooks/pre-commit num repositório temporário.
# Uso: bash scripts/test-pre-commit.sh   (roda no npm run lint)
set -u
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
fail=0
ok() { if [ "$1" != "$2" ]; then echo "FALHOU: $3 (esperava '$2', obteve '$1')"; fail=1; fi; }

cd "$TMP"
git init -q . && git config user.email t@t && git config user.name t
mkdir -p scripts
cp -r "$ROOT/scripts/git-hooks" scripts/git-hooks
ln -s "$ROOT/node_modules" node_modules
cp "$ROOT/.prettierrc"* . 2>/dev/null || true
printf 'ignorado.mjs\n' > .prettierignore
git config core.hooksPath scripts/git-hooks
git add -A && git commit -q -m base --no-verify

# 1. arquivo mal formatado vira formatado no commit
printf 'const   a =  1\n' > a.mjs
git add a.mjs && git commit -q -m t1
ok "$(git show HEAD:a.mjs)" "const a = 1;" "arquivo formatado no commit"
ok "$(git status --porcelain)" "" "árvore limpa depois do commit"

# 2. nome com espaço
printf 'const   b =  2\n' > 'com espaco.mjs'
git add 'com espaco.mjs' && git commit -q -m t2
ok "$(git show 'HEAD:com espaco.mjs')" "const b = 2;" "nome com espaço"

# 3. recusa com alterações fora do stage
printf 'const c = 3;\n' > c.mjs; git add c.mjs; git commit -q -m t3
printf 'const   c =  4\n' > c.mjs; git add c.mjs
printf 'const   c =  5\n' > c.mjs   # alteração fora do stage
git commit -q -m t4 2>/dev/null; code=$?
ok "$([ $code -ne 0 ] && echo recusou || echo passou)" "recusou" "recusa com alterações fora do stage"
ok "$(git log --format=%s -1)" "t3" "commit não foi criado"
git checkout -q -- c.mjs; git reset -q

# 4. arquivo no .prettierignore fica intacto e o commit passa
printf 'const   d =  6\n' > ignorado.mjs
git add ignorado.mjs && git commit -q -m t5
ok "$(git show HEAD:ignorado.mjs)" "const   d =  6" "arquivo ignorado não é alterado"

# 5. sem arquivos suportados, passa
printf 'x\n' > nota.txt; git add nota.txt && git commit -q -m t6
ok "$(git log --format=%s -1)" "t6" "commit sem arquivos suportados"

[ $fail -eq 0 ] && echo "pre-commit: ok"
exit $fail
