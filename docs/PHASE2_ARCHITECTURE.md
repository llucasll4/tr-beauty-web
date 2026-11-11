# Fase 2 — Arquitetura, identidade visual e dependências

**Projeto:** TR Beauty Concept • Repositório `llucasll4/tr-beauty-web`
**Escopo:** refatoração sem alteração intencional de regras de negócio, cores, dados ou banco.

## Arquitetura desta entrega

| Módulo | Responsabilidade |
|---|---|
| `App.js` | Orquestração de autenticação, estado da sessão, navegação e fluxos centrais |
| `HomeScreen.js` | Interface da Home; componente estável que recebe dados e ações do controlador |
| `appStyles.js` | Estilos gerais anteriormente misturados com o controlador (231 chaves) |
| `theme/tokens.js` | Cores da marca e escalas compartilhadas de espaçamento/raio |
| `utils/calendar.js` | Datas de São Paulo, navegação por meses e grade de dias disponíveis |
| `utils/services.js` | Associação visual de serviços de Nail Design a ícones |
| `BookingWizard.js` | Fluxo de reserva original, respeitando disponibilidade RPC |
| `AdminCalendar.js` | Agenda administrativa; mesmos tokens de cores originais |
| `ClientSettings.js` | Preferências da cliente; mesmos tons originais da marca |

A Home era declarada **dentro** de `MainApp`. A cada atualização do controlador, sua identidade de componente React era recriada, potencialmente reinicializando componentes descendentes. O módulo independente elimina esse padrão sem alterar a seleção de dados, os callbacks ou a lógica de navegação.

## Regras que não devem mudar

- `available_slots`, buffer de 15 minutos, bloqueios administrativos e exceções de expediente definidos pelo Supabase.
- Condição de início até 20h nos dias permitidos e fechamento às 18h em terça/quinta.
- Saldo resgatável dos TR Points separado do acumulado para níveis VIP.
- Fluxos e estados de cliente, administrador, agendamento, notificações e suporte.
- Identidade visual com os valores originais da paleta. **Não** arredondar, harmonizar ou trocar hexadecimais nesta fase.

## Verificações

- `npm test`: VIP + testes adicionais da grade de calendário, fuso de São Paulo, ícones de serviços e tokens originais.
- `npm run build`: exportação Expo Web para Vercel.
- `booking-points-db-regression`: integração das funções reais do Supabase em PostgreSQL isolado.
- `app-tests-and-build`: testes JS e compilação.
- Prévia Vercel correspondente ao SHA submetido.
- Teste manual futuro recomendado: Home e Admin autenticados, cadastro, Perfil, reservas com e sem TR Points, atualização visual após seleção de serviço.

## Builds reproduzíveis

O projeto antes não versionava `package-lock.json`; a instalação usava `npm install` em todas as execuções. **Agora o lockfile v3 foi gerado por `npm install` em um runner limpo (Node 22), validado contra `package.json` e versionado com 1.163 entradas da árvore de pacotes.** O CI usa `npm ci` para reproduzir a resolução exata. Isso evita atualizações implícitas de dependências transitivas entre instalações.

Não usar uma árvore de dependências inventada ou um lockfile montado manualmente. Quando atualizar pacotes, regenerar o lock e exigir aprovação dos dois checks de CI.

## Plano de atualização do Expo

**Situação atual:** Expo SDK 51, React 18.2, React Native 0.74 e React Native Web 0.19.
**Objetivo futuro:** migrar para uma linha Expo SDK suportada, sem misturar essa migração à refatoração visual.

A documentação oficial recomenda evoluir o SDK **um por vez**:
1. Criar branch exclusiva de upgrade, com ponto de retorno.
2. SDK 51 → 52; executar `npx expo install --fix`, `npx expo-doctor`, testes JS e exportação web.
3. Repetir para 53, 54, 55, 56, 57 e 58, validando as notas de migração a cada etapa.
4. Revisar incompatibilidades de React, React Native, React Native Web, bibliotecas de ícones, navegação, tratamento de URL do Supabase e disponibilidade no Expo Web.
5. A cada SDK, verificar especialmente a Home, autorizações, dados de clientes, login, redirecionamento de recuperação de senha, reservadores e horários em Brasília.
6. Mesclar apenas a versão final testada no Vercel Preview, com validação visual em iOS/Android/web, e sem criar mudanças no Supabase desnecessárias.

**Não executar** o upgrade em série diretamente na `main`: isso dificultaria isolar regressões de versões. A versão Expo não foi alterada nesta entrega.

Documentação oficial:
https://docs.expo.dev/workflow/upgrading-expo-sdk-walkthrough/
https://docs.expo.dev/versions/latest/

## Próximas extrações recomendadas

1. Separar `AdminScreen` do controlador, preservando navegação e modais.
2. Criar hooks reutilizáveis para notificações, serviços e consultas de pontos, com política consistente de refresh.
3. Eliminar estilos inline repetidos e reforçar acessibilidade, sem mudança visual inesperada.
4. Adicionar testes de interface autenticada (Playwright) quando um ambiente de testes seguro estiver disponível.

A refatoração deve ser incremental, PR por PR, e passar pelas verificações obrigatórias.
