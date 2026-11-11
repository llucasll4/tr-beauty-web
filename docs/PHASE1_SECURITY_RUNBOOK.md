# TR Beauty Concept — Fase 1: segurança, testes e LGPD

Atualizado em 11/11/2026. Repositório: `llucasll4/tr-beauty-web`, integração com Supabase e Vercel.

## Implementado
- Revogação de EXECUTE público/cliente nas funções internas de gatilho de reservas, bloqueios, estorno TR Points e proteção de cancelamentos. Migração `20261111_phase1_restrict_trigger_rpc.sql` aplicada e checada no Supabase.
- Testes unitários com Node `node --test` para `vipProgress.js`.
- Testes PostgreSQL 17 em banco descartável, extraindo as funções SQL reais das migrações, para validar lacunas, buffer 15 minutos, bloqueio de agendas, limites do expediente, conflitos e crédito/resgate/estorno TR Points.
- Workflow GitHub Actions `.github/workflows/phase1-checks.yml` executado em pull requests para `main` e nos pushes da `main`, com passos de build web, teste unitário e integração SQL. **A proteção de merge só vale depois que a regra da branch for ativada.**
- Aviso de Privacidade acessível na Home, no cadastro e no Perfil, com informação honesta dos dados e serviços usados.
- Solicitações de exclusão com estado `pending` / `in_review` / `responded`, auditoria da administração, mensagem visível à cliente e navegação para suporte.
- Não realiza exclusão automática de usuários/atendimentos ou armazenamento.

## Configurações administrativas ainda necessárias (não automatizáveis pela conexão atual)

### 1. Supabase — habilitar proteção contra senhas vazadas
- Acesse [Supabase Auth](https://supabase.com/dashboard/project/gotdntnqiwhdkopaxrbb/auth/users).
- No menu **Authentication**, entre nas opções de segurança de senha (Password Security / Settings).
- Habilite **Leaked Password Protection** e salve.
- Reexecute **Database Advisors → Security** e confirme a ausência do alerta `auth_leaked_password_protection`.
- O conector Supabase disponível nesta integração não oferece ação para alterar essa configuração do servidor Auth. Não use SQL para simular a ativação.

Referência: https://supabase.com/docs/guides/auth/password-security#password-strength-and-leaked-password-protection

### 2. GitHub — proteger a branch `main`
- Acesse https://github.com/llucasll4/tr-beauty-web/settings/rules
- Crie um branch ruleset com alvo **main**, habilite a exigência de pull request e de aprovação conforme política da conta.
- Exija os checks **app-tests-and-build** e **booking-points-db-regression** (nomes dos jobs de `phase1-checks.yml`), após passarem em um PR.
- Ative **Require branches to be up to date** se não causar conflito com outras automações e, opcionalmente, inclua o status Vercel.
- Mantenha bloqueado o bypass de colaboradores não autorizados.
- O conector GitHub instalado não tem permissão administrativa para criar rulesets; ler as regras atualmente retorna 403.

### 3. Revisão jurídica e operacional do aviso
- Confirme quem responde oficialmente pelos dados do estúdio e o contato para LGPD.
- Defina e documente prazos de conservação por categoria de dado, justificativas legais, operadores e transferências internacionais.
- Verifique textos de consentimento conforme a operação real e considere avaliar juridicamente o aviso.
- Estabeleça processo formal para resposta, retenção, exportação e eventual exclusão.
- O status **responded** indica que uma resposta foi registrada, não significa que a conta tenha sido removida.
- A exclusão efetiva deve ocorrer por procedimento autorizado, observando registros obrigatórios e dependências das reservas.

## Controle de qualidade

Comandos úteis em checkout local:

```bash
npm install --no-audit --no-fund
npm test
npm run build
```

Para testar as funções SQL é necessário um PostgreSQL **descartável** (o GitHub Actions cria um serviço PostgreSQL 17):

```bash
node scripts/extract-db-functions.cjs
psql -v ON_ERROR_STOP=1 -f tests/db/fixture.sql
psql -v ON_ERROR_STOP=1 -f tests/db/generated-functions.sql
psql -v ON_ERROR_STOP=1 -f tests/db/install-triggers.sql
psql -v ON_ERROR_STOP=1 -f tests/db/regression.sql
```

**Não execute o fixture no banco de produção.** Ele cria tabelas temporárias de teste na base conectada e foi projetado exclusivamente para a instância isolada de CI.

## Próximas verificações
- Revisão visual autenticada de Cadastro, Home, Perfil e Configurações Admin em celular.
- Teste de ponta a ponta de um pedido de exclusão com resposta administrativa usando contas de teste.
- Ativar as duas configurações administrativas acima.
- Executar `get_advisors` após cada migração para confirmar permissões e novos avisos.
