import gameConfigs from './gameConfigs.json' with { type: 'json' };

export const calculateUpgradeCost = (
  levelIndex: number,
  basePrice: number,
  multiplier: number,
): number => {
  return Math.floor(basePrice * Math.pow(multiplier, levelIndex));
};

export const calculateUpgradeIncrement = (
  levelIndex: number,
  baseIncrement: number,
  multiplier: number,
): number => {
  let benefit = 0;
  for (let i = 0; i <= levelIndex; i++) {
    benefit += Math.floor(baseIncrement * Math.pow(multiplier, i));
  }
  return benefit;
};

export const calculateRestoredEnergy = (
  previousTimestamp: number,
  newTimestamp: number,
): number => {
  const numChargePerSecond = 1000 / gameConfigs.energy_refill_interval_ms;
  const restoredEnergy =
    numChargePerSecond * Math.floor((newTimestamp - previousTimestamp) / 1000);
  return restoredEnergy;
};

export const calculatePointsPerClick = (levelIndex: number) => {
  return calculateUpgradeIncrement(
    levelIndex,
    gameConfigs.multitap_upgrade_base_increment,
    gameConfigs.multitap_upgrade_increment_multiplier,
  );
};

export const calculateEnergyLimit = (levelIndex: number) => {
  return (
    gameConfigs.default_energy_limit +
    calculateUpgradeIncrement(
      levelIndex,
      gameConfigs.energy_limit_upgrade_base_increment,
      gameConfigs.energy_limit_upgrade_increment_multiplier,
    )
  );
};
