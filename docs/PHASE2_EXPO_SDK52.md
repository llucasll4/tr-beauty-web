# Fase 2 — Migração controlada Expo SDK 51 → 52

## Objetivo e contexto

O TR Beauty Concept usa Expo Web como experiência de produção. Depois da falha de tela branca da etapa anterior, **qualquer atualização do SDK deve passar por renderização real no Chromium e regressão SQL antes do merge**.

A Expo recomenda atualizações incrementais, versão por versão: https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/

## Dependências alteradas

| Dependência | SDK 51 | SDK 52 |
|---|---|---|
| `expo` | `~51.0.0` | `~52.0.0` (resolvido 52.0.49) |
| `react` e `react-dom` | 18.2.0 | 18.3.1 |
| `react-native` | 0.74.1 | 0.76.7 |
| `react-native-web` | `~0.19.10` | `~0.19.13` |
| `@expo/metro-runtime` | `~3.2.3` | `~4.0.1` |
| `expo-asset` | `~10.0.10` | `~11.0.3` |
| `expo-font` | `~12.0.10` | `~13.0.3` |
| `@expo/vector-icons` | 14.0.0 | `^14.0.2` |

O `package-lock.json` v3 foi **regenerado em Node 22 dentro do GitHub Actions** com npm limpo. O workflow voltou a usar `npm ci`, não `npm install`, e valida o alinhamento das dependências com `npx expo install --check`. Não regenerar o lockfile manualmente.

Fonte das versões: `expo@52.0.35/bundledNativeModules.json` e notas oficiais de SDK 52:
https://expo.dev/changelog/2024-11-12-sdk-52

## O que não muda nesta etapa

- Banco Supabase: sem mudanças SQL, RLS, chaves ou funções.
- Agendamentos: slots reais, duração, buffer de 15 minutos, regras de expediente e bloqueios.
- TR Points: saldo e histórico de transações, níveis, resgate e prevenção de duplicidades.
- Autenticação: e-mail, Google, senha, recuperação e telefone válido.
- Estilos, textos e cores da identidade TR Beauty Concept.
- Nenhuma ativação de WhatsApp, push ou lista de espera.

## Verificação de qualidade antes de mesclar

1. `npm ci` com lockfile atualizado.
2. `npx expo install --check` sem divergências.
3. `npm test` (verificador de funções não importadas incluído).
4. `npm run build` gerando `dist` Expo Web.
5. Chromium Playwright: Home desktop e mobile, login, galeria, sessão de cliente e sessão de Admin (dados fictícios).
6. `booking-points-db-regression`: PostgreSQL isolado.
7. **Vercel Preview READY no SHA final** e revisão visual manual em Safari/iPhone.
8. Após merge, conferir GitHub Actions na `main`, Vercel Production READY e o domínio oficial.

## Observações de compatibilidade

Expo SDK 52 e React Native 0.76 inauguraram a New Architecture para **projetos novos**. Esta entrega não a habilita deliberadamente. Se o projeto passar a distribuir apps nativos Android/iOS, será necessário testar builds de desenvolvimento e bibliotecas nativas separadamente — os testes atuais são de **Expo Web**.

**SDK 52 é uma etapa intermediária, não a versão final de modernização**. O avanço posterior para SDK 53 e seguintes deve ocorrer em PRs próprios, sem misturar as dependências de vários SDKs ou refatorações funcionais. Não atualizar para o Expo SDK 58 diretamente partindo do 51.

## Plano de recuperação

A branch principal pré-upgrade continua recuperável pelo commit `729e75fdf4bfd06602ac87896315b1d5a31e3434`. O deploy Vercel anterior pode ser restaurado em caso de regressão de produção, sem alterar os dados do Supabase.

Se o Chromium acusar erros de JavaScript ou vier tela branca, **não mesclar**. Corrigir o problema na branch e repetir todas as verificações.
