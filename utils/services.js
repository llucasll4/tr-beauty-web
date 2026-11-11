// Emojis relacionados a unhas para os cards, sem associar gel a gotas d'água.
export const emojiForHomeService = (name = '') => {
  const label = String(name).toLocaleLowerCase('pt-BR');
  if (label.includes('nail art') || label.includes('decora') || label.includes('arte')) return '🎨';
  if (label.includes('manuten') || label.includes('alongamento') || label.includes('gel') ||
      label.includes('esmalta') || label.includes('unha') || label.includes('banho')) return '💅';
  return '✨';
};
