
export const formatNumber = (value: number): string => {
  // Aseguramos que visualmente siempre sea un entero, eliminando decimales de la lógica interna inicial.
  const intValue = Math.floor(value);

  // Menor a 1000: Mostrar entero simple
  if (intValue < 1000) return intValue.toString();

  // Reglas solicitadas:
  // 1.000 = 1.00K
  // 1.000.000 = 1.00Mill
  // 1.000.000.000 = 1.00K Mill
  // 1.000.000.000.000 = 1.00Bill

  // Billions (Trillions in standard short scale, defined as Bill in prompt) -> 1,000,000,000,000
  if (intValue >= 1000000000000) {
    return (intValue / 1000000000000).toFixed(2) + "Bill";
  }

  // K Millions (Billions in standard short scale) -> 1,000,000,000
  if (intValue >= 1000000000) {
    return (intValue / 1000000000).toFixed(2) + "K Mill";
  }

  // Millions -> 1,000,000
  if (intValue >= 1000000) {
    return (intValue / 1000000).toFixed(2) + "Mill";
  }

  // Thousands -> 1,000
  if (intValue >= 1000) {
    return (intValue / 1000).toFixed(2) + "K";
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
