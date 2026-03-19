const asObject = (value) => (value && typeof value === 'object' && !Array.isArray(value) ? value : {});

const toNonNegativeNumber = (value) => {
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return 0;
  return numeric;
};

export const calculateEmpirePointsBreakdown = (stateInput) => {
  const state = asObject(stateInput);

  const buildings = asObject(state.buildings);
  const units = asObject(state.units);
  const techLevels = asObject(state.techLevels);
  const campaignProgress = Math.max(1, Math.floor(toNonNegativeNumber(state.campaignProgress) || 1));

  let economyScore = 0;
  Object.values(buildings).forEach((buildingState) => {
    const level = toNonNegativeNumber(buildingState?.level);
    economyScore += level * 120;
  });

  let militaryScore = 0;
  Object.values(units).forEach((count) => {
    militaryScore += toNonNegativeNumber(count);
  });

  let techScore = 0;
  Object.values(techLevels).forEach((level) => {
    const normalizedLevel = Math.max(0, Math.floor(toNonNegativeNumber(level)));
    techScore += Math.max(0, normalizedLevel - 1) * 200;
  });

  const campaignScore = Math.max(0, (campaignProgress - 1) * 500);
  const empirePoints = Math.max(0, Math.floor(economyScore + militaryScore + techScore + campaignScore));

  return {
    empirePoints,
    militaryScore: Math.max(0, Math.floor(militaryScore)),
    economyScore: Math.max(0, Math.floor(economyScore)),
    campaignScore: Math.max(0, Math.floor(campaignScore)),
  };
};
