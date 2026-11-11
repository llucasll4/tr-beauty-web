// A classificação do Clube VIP usa pontos acumulados durante a vida do programa,
// não o saldo disponível (que diminui quando a cliente resgata serviços).
// As metas vêm de public.vip_settings, sem números fixos no aplicativo.
export function getVipProgress(vipSummary, vipSettings) {
  if (!vipSummary || !vipSettings) return null;

  const lifetime = Number(vipSummary.lifetime_points);
  const silver = Number(vipSettings.silver_points);
  const gold = Number(vipSettings.gold_points);

  if (![lifetime, silver, gold].every(Number.isFinite) ||
      silver <= 0 || gold <= silver) return null;

  const accumulated = Math.max(0, lifetime);
  if (accumulated >= gold) {
    return {
      tier: 'Ouro',
      nextTier: null,
      lifetime: accumulated,
      goal: gold,
      remaining: 0,
      progress: 100,
    };
  }

  const isSilver = accumulated >= silver;
  const start = isSilver ? silver : 0;
  const goal = isSilver ? gold : silver;

  return {
    tier: isSilver ? 'Prata' : 'Bronze',
    nextTier: isSilver ? 'Ouro' : 'Prata',
    lifetime: accumulated,
    goal,
    remaining: Math.max(0, goal - accumulated),
    progress: Math.min(100, Math.max(0,
      ((accumulated - start) / (goal - start)) * 100)),
  };
}
