# Fase 2 — Expo SDK 53 → SDK 54

## Escopo
Atualização **exclusiva de dependências**, sem mudanças nas funções da aplicação, banco Supabase, dados de clientes ou na UI. A branch `upgrade/phase2-expo-sdk54-20261112` foi criada a partir do SDK 53 aprovado e publicado (commit `f37053c919d80700e57a196b83a41234fe46f00a`).

## Matriz técnica

| Componente | SDK 53 | SDK 54 |
|---|---|---|
| Expo | ~53.0.0 | ~54.0.0 |
| React / React DOM | 19.0.0 | 19.1.0 |
| React Native | 0.79.6 | 0.81.5 |
| React Native Web | ~0.20.0 | ~0.21.0 |
| @expo/metro-runtime | ~5.0.4 | ~6.1.2 |
| @expo/vector-icons | ^14.1.0 | ^15.0.0 |
| expo-asset | ~11.1.6 | ~12.0.0 |
| expo-font | ~13.3.2 | ~14.0.0 |

**Resolução reproduzível:** após erro `ERESOLVE` causado por referências legadas do lockfile SDK 53, o `package-lock.json` foi regenerado em runner isolado Node 22 com `rm -f package-lock.json && npm install --no-audit --no-fund && npx expo install --fix --npm && npx expo install --check`. A verificação de compatibilidade terminou com sucesso, sem `--force` ou `--legacy-peer-deps`. O workflow temporário foi excluído; a branch mantém somente manifest, lockfile e documentação.

## Aprovação obrigatória
- [ ] `npm ci --no-audit --no-fund` reproduz o lockfile no GitHub Actions
- [ ] `npx expo install --check`
- [ ] `npm test`
- [ ] `npm run build` web
- [ ] Chromium Playwright: visitante desktop e mobile, conta Cliente, TR Points, jornada de agendamento e Admin com Supabase fictício
- [ ] PostgreSQL isolado: regras de agenda e TR Points
- [ ] Vercel Preview `READY` no SHA final
- [ ] Validação manual iPhone/Safari e conta Admin/Cliente antes do merge

## Regressões e riscos

- **Expo Web em produção:** os testes de browser não validam builds nativas iOS/Android. A implantação no iPhone atualmente é acesso pelo navegador.
- **React Native 0.81:** `SafeAreaView` da biblioteca `react-native` foi depreciado; adiar qualquer mudança de layout por enquanto para não misturar migração e refatoração. Se migrar para app nativo futuramente, considerar `react-native-safe-area-context` em PR independente.
- **Ícones v15:** as famílias do pacote foram atualizadas; conferir os ícones de calendário, notificações, Perfil, pontos e menus em Safari/Chromium.
- **Autolinking:** SDK 54 altera descoberta de módulos nativos; não habilitar opções experimentais não necessárias à web.
- **New Architecture:** SDK 54 é a última versão que ainda permite Legacy Architecture; a atualização de código nativo exige testes próprios quando houver builds nativas.
- **Promise rejections:** melhorias no diagnóstico podem evidenciar erros preexistentes em código assíncrono. Falhas JS/tela branca bloqueiam merge.
- **Regras preservadas:** horário de terça/quinta até 18h, exceções/última entrada às 20h nos dias permitidos, buffer de 15 min, proteção contra reservas conflitantes, resgate de pontos e separação entre saldo e pontos acumulados.
- **Privacidade:** nenhuma alteração de SQL, RLS, serviços, autenticação, credenciais, SMS, SMTP ou WhatsApp. O CI utiliza sessões e Supabase fictícios.

## Recuperação
Caso ocorra regressão, manter a versão SDK 53 em `main` e cancelar o merge. Se houver regressão após futuro deploy aprovado, utilizar rollback Vercel para o deploy anterior sem alterar o banco.

## Referências
- https://expo.dev/changelog/sdk-54
- https://expo.dev/blog/expo-sdk-upgrade-guide
- https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
