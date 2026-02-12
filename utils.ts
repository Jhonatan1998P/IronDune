
export const formatNumber = (value: number): string => {
  // Aseguramos que visualmente siempre sea un entero, eliminando decimales de la lógica interna.
  const intValue = Math.floor(value);

  if (intValue < 1000) return intValue.toString();

  const tiers = [
    { value: 1e12, symbol: "T" },
    { value: 1e9, symbol: "B" },
    { value: 1e6, symbol: "M" },
    { value: 1e3, symbol: "K" }
  ];

  for (const tier of tiers) {
    if (intValue >= tier.value) {
      return (intValue / tier.value).toFixed(2).replace(/\.00$/, '') + tier.symbol;
    }
  }

  return intValue.toString();
};

export const formatDuration = (ms: number): string => {
    const seconds = Math.floor(ms / 1000);
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = seconds % 60;
    
    if (h > 0) return `${h}h ${m}m`;
    if (m > 0) return `${m}m ${s}s`;
    return `${s}s`;
};
