# Fase 2 — Migração controlada Expo SDK 52 → 53

## Estado e objetivo

Migração **isolada em branch de upgrade**, sem publicar alterações antes de validar o comportamento real. A branch de origem é a `main` com a regressão de navegação do PR #46 incorporada. A produção continua protegida até aprovação.

Expo SDK 53 introduz React 19, React Native 0.79, React Native Web 0.20 e habilita por padrão a New Architecture em projetos nativos. O TR Beauty atualmente publica **Expo Web**: nenhuma validação deste PR equivale a uma build nativa iOS/Android.

## Matriz de dependências

| Dependência | SDK 52 | SDK 53 |
|---|---|---|
| expo | ~52.0.0 | ~53.0.0 |
| react / react-dom | 18.3.1 | 19.0.0 |
| react-native | 0.76.9 | 0.79.6 |
| react-native-web | ~0.19.13 | ~0.20.0 |
| @expo/metro-runtime | ~4.0.1 | ~5.0.4 |
| @expo/vector-icons | ~14.0.4 | ^14.1.0 |
| expo-asset | ~11.0.3 | ~11.1.6 |
| expo-font | ~13.0.3 | ~13.3.2 |

O `package-lock.json` é produzido por `npm install` e `npx expo install --fix --npm` em runner limpo com Node 22. `npx expo install --check` deve passar. **Não editar lockfile manualmente.** O workflow temporário de geração de lockfile foi removido da branch após o uso.

## Gates de qualidade

1. `npm ci --no-audit --no-fund` com lockfile versionado.
2. `npx expo install --check` sem incompatibilidades.
3. `npm test` para calendário, fuso de São Paulo, VIP, identificadores e imports.
4. `npm run build` exportando Expo Web.
5. Playwright Chromium: visitante desktop/mobile, sessão de cliente e Admin, TR Points, histórico, fluxo de escolha do serviço e calendário, sem criar reservas reais.
6. Regressão SQL com PostgreSQL isolado para reserva e fidelidade.
7. Vercel Preview **READY** do SHA final do PR.
8. Inspeção manual no Safari/iPhone, login por e-mail e Google, perfil, reservas, notificações e TR Points, antes de aprovação para produção.

## Riscos de compatibilidade

- **React 19** introduz alterações importantes de comportamento; evitar misturar refatorações de negócio ou interface a este PR.
- Em **React Native 0.79**, resolução de pacotes via `package.json:exports` fica habilitada por padrão no Metro. O changelog do SDK 53 registra incompatibilidades conhecidas com `@supabase/supabase-js`. Se a aplicação apresentar falha de bundle ou tela branca, reproduzir nos testes Chromium antes de avaliar `unstable_enablePackageExports: false` em um `metro.config.js`. **Não aplicar o fallback sem reproduzir o problema.**
- A New Architecture passa a ser o padrão no SDK 53; este PR não valida funcionalidades nativas. Se forem lançados aplicativos iOS ou Android, acrescentar gates de build e testes nativos.
- O CI usa URLs/chaves fictícias do Supabase e sessões sintéticas, sem acesso a clientes reais.

## Contrato de não regressão

- Não mudar schema, RLS, funções, chaves, autenticação ou dados do Supabase.
- Preservar slots reais, regras de expediente, buffer de 15 minutos e resolução de conflitos.
- Preservar saldos, histórico, resgates e níveis do TR Points.
- Preservar fluxos de Admin e Cliente, WhatsApp desativado e visual nude/creme original.
- Em caso de tela branca, erro de autenticação ou inconsistência de pontos, **não mesclar** e corrigir na branch; depois repetir todos os gates.

## Fontes

- https://expo.dev/changelog/sdk-53
- https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
- https://github.com/llucasll4/tr-beauty-web/pull/46
