// Ativa os hooks do repositório (scripts/git-hooks) no npm install.
// Não faz nada fora de um checkout git (CI sem .git, pacote publicado) e nunca falha o install.
import { existsSync } from 'node:fs';
import { execSync } from 'node:child_process';

if (existsSync('.git') && !process.env['CI']) {
  try {
    execSync('git config core.hooksPath scripts/git-hooks', { stdio: 'ignore' });
  } catch {
    // git ausente: segue sem o hook
  }
}
