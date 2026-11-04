# ADR-0008: Contas anônimas com passkey e código de recuperação

- **Status:** proposta
- **Data:** 2026-11-04
- **Decisores:** architect (propôs), security-auditor (revisa), CEO (aprova)

## Contexto

O `docs/PROJETO.md` ("Privacidade, LGPD e ECA Digital") e o ADR-0003 definem a conta do online: anônima, só apelido + passkey, sem e-mail, telefone, nome ou data de nascimento, com código de recuperação. Sem o código e sem o aparelho, a conta se perde. O US-048 deixa ao architect o formato e a força do código, e o US-049 deixa a validade das sessões. Na Etapa 4, o mesmo código será a base da chave que cifra a sincronização dos saves, então o servidor não pode conseguir derivar essa chave.

## Opções consideradas

| Opção                                                                                     | Prós                                                                                       | Contras                                                                               |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------ | ------------------------------------------------------------------------------------- |
| A: código gerado pelo servidor e guardado com hash lento (Argon2/scrypt)                   | modelo conhecido                                                                           | o servidor vê o código; KDF lenta não cabe nos 10 ms de CPU do Worker gratuito        |
| B: código gerado no aparelho; o servidor recebe só um verificador derivado (HKDF) e guarda o HMAC dele com um pepper secreto | o servidor nunca vê o código; a chave da Etapa 4 sai de outro rótulo do HKDF; barato em CPU | sem o pepper e sem o código não há recuperação (é o que se quer)                       |
| C: login só por código, sem passkey (P8)                                                  | funciona em qualquer aparelho                                                              | código vira senha; mais fraco contra roubo de conta                                   |

## Decisão

**B**, com passkey obrigatória (recomendação da P8):

- **WebAuthn** com `@simplewebauthn/server` e `@simplewebauthn/browser`. Credencial residente (login sem digitar apelido) e `userVerification: 'required'`. O `rpId` é o domínio do jogo (hoje `prancheta-ad1.pages.dev`, lido de `config/prancheta.config.ts`). Na prévia de PR, o `rpId` é o host da prévia, com um D1 separado.
- **Código de recuperação:** 20 caracteres em base32 de Crockford (100 bits), mostrados como `XXXXX-XXXXX-XXXXX-XXXXX`. São gerados no aparelho com `crypto.getRandomValues` e mostrados uma única vez. O cliente envia `recoveryVerifier = HKDF-SHA256(código normalizado, info "prancheta/auth/v1")`, e o servidor guarda `HMAC-SHA256(RECOVERY_PEPPER, verificador)`. A chave da Etapa 4 virá de `info "prancheta/sync/v1"` e nunca sai do aparelho.
- **Recuperar:** apelido + verificador. Se bater, o aparelho registra uma passkey nova. A mensagem de erro é sempre genérica e não revela se o apelido existe. Depois de 5 falhas seguidas no mesmo apelido, novas tentativas ficam bloqueadas por 15 minutos, e o bloqueio dobra a cada nova série de falhas, até 24 h. O bloqueio é por conta, sem IP.
- **Sessão:** token aleatório de 32 bytes no cookie `__Host-pz_session` (HttpOnly, Secure, SameSite=Strict, Path=/). O servidor guarda só o SHA-256 do token. A sessão expira depois de 30 dias sem uso, com no máximo 90 dias no total, e então o jogo pede a biometria de novo e mantém a escalação em edição (US-049). É um cookie primário estritamente necessário, sem banner.
- **Reautenticação:** gerar código novo (US-048) e apagar a conta (US-050) exigem uma asserção de passkey feita nos últimos 5 minutos.
- **Apagar conta:** remove `accounts`, `credentials`, `sessions` e `messages` da pessoa. Em `league_members`, `account_id` vira `NULL` e `controller` vira `ai`. A posse da liga passa ao humano mais antigo, e sem outros humanos a liga é encerrada.
- **Dados guardados:** exatamente os da tabela 4.5 de `docs/02-architecture.md`.

## Consequências

- **Positivo:** o servidor não consegue ler o código nem a futura chave de sincronização. Vazamento do banco sem o pepper não permite recuperar contas. O custo de CPU é mínimo.
- **Negativo:** aparelho sem passkey não entra no online. Perder o código e o aparelho perde a conta, e isso é intencional. A passkey fica presa ao domínio: trocar o domínio depois da 1b obriga a recuperar pelo código (por isso o domínio deve ser decidido antes da 1b).
- **Pendências:** T-053, T-054, T-055 e T-060. Segredo `RECOVERY_PEPPER` no Cloudflare. O `security-auditor` revisa antes do merge (ADR-0003).

## Conformidade

- Nenhuma rota recebe o código de recuperação em texto, e um teste confere o corpo das requisições do cliente.
- O teste de esquema do D1 (US-064) falha com qualquer coluna ligada a conta fora da lista aprovada.
- Logs não contêm apelido, `accountId`, credential id nem token, e um teste roda uma sessão completa conferindo os logs.
