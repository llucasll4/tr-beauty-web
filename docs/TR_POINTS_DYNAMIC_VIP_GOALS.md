# TR Points — Meta automática para evolução no Clube VIP

## Alteração

A meta fixa de **300 pontos** foi removida do cartão TR Points da Home e do painel detalhado. O progresso agora acompanha a próxima evolução do Clube VIP, com a mesma fonte de dados do painel VIP.

Fontes Supabase:
- `get_my_loyalty()` → **saldo disponível** para resgates e últimos movimentos.
- `get_my_vip_summary()` → `lifetime_points`, **pontos positivos acumulados** que determinam o nível VIP; resgates não diminuem esse acumulado.
- `vip_settings` → `silver_points` e `gold_points`, limites editáveis no banco.

Valores atuais verificados em produção: **Prata a partir de 1.000 pontos acumulados; Ouro a partir de 2.000 pontos**. Não são valores hardcoded no frontend, mudam quando os parâmetros do Supabase mudarem.

## Etapas

- **Bronze:** a barra vai de 0 até a meta de Prata. Exibe a meta, acumulado e os pontos restantes.
- **Prata:** a meta automaticamente muda para Ouro. A barra reinicia apenas o *progresso da etapa* (de 1.000 para 2.000), não zera os pontos acumulados nem o saldo.
- **Ouro:** exibe nível máximo e barra completa, sem inventar novos níveis ou metas.
- **Resgate:** reduz o saldo disponível, mas não reduz o nível ou a barra VIP.

O cálculo está centralizado em `vipProgress.js` e é usado tanto no cartão da Home (`LoyaltyCard.js`) como no painel `TRPointsDashboard.js`.

## Atualização automática

O cartão atualiza ao entrar na Home, a cada **60 segundos** enquanto a Home estiver aberta, após o retorno do app ao primeiro plano e quando `myAppointmentsRefresh` mudar. A cliente ainda pode tocar em **Atualizar pontos e nível**.

Não foi criada migração de banco, porque a tabela `points_ledger` não está publicada no Realtime neste projeto; a atualização periódica mantém a solução funcional sem alterar permissões de transmissão ou políticas RLS. Com isso, uma mudança realizada no banco pode levar até aproximadamente 60 segundos para aparecer se a Home permanecer aberta.

## Testes de cálculo

1. 0 pontos → Bronze, meta Prata 1.000, progresso 0%.
2. 350 pontos → Bronze, faltam 650, progresso 35%.
3. 1.000 pontos → Prata, meta Ouro 2.000, progresso da etapa 0%.
4. 1.500 pontos → Prata, faltam 500, progresso da etapa 50%.
5. 2.000+ pontos → Ouro, meta máxima, progresso 100%.
6. Ajustar as metas no Supabase altera os cálculos sem modificar o código.
7. O saldo resgatável, mesmo zero, não é utilizado para calcular a evolução VIP.

O cálculo foi validado em 9 cenários automatizados em JavaScript antes de adicionar o helper ao GitHub.
