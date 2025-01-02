import {calculateUpgradeCost} from '../_rules/rule.ts';
import gameConfigs from '../_rules/gameConfigs.json' with {type: 'json'};

export type BoosterType = 'MULTITAP' | 'ENERGY_LIMIT';
export type Booster = {
  id: number;
  title: string;
  description: string;
  basePrice: number;
  type: BoosterType;
};

export type BoosterWithContext = Booster & {
  currentLevel: number;
  currentPrice: number;
};

export type DailyBooster = {
  id: number;
  title: string;
  description: string;
  maxAmount: number;
};

export type DailyBoosterWithContext = DailyBooster & {
  remainingAmount: number;
};

export function convertToBoosterWithContext(booster: any): BoosterWithContext {
  const boosterLevel = booster.user_booster?.[0]?.level ?? 0;
  let upgradePrice = booster.base_price;

  switch (booster.type as BoosterType) {
    case 'MULTITAP':
      upgradePrice = calculateUpgradeCost(
        boosterLevel,
        booster.base_price,
        gameConfigs.multitap_upgrade_price_multiplier,
      );
      break;
    case 'ENERGY_LIMIT':
      upgradePrice = calculateUpgradeCost(
        boosterLevel,
        booster.base_price,
        gameConfigs.energy_limit_upgrade_price_multiplier,
      );
      break;
    default:
      break;
  }
  return {
    id: booster.id,
    title: booster.title,
    description: booster.description,
    basePrice: booster.base_price,
    type: booster.type,
    currentLevel: boosterLevel,
    currentPrice: upgradePrice,
  };
}

export function convertToDailyBoosterWithContext(
  dailyBooster: any,
): DailyBoosterWithContext {
  return {
    id: dailyBooster.id,
    title: dailyBooster.title,
    description: dailyBooster.description,
    maxAmount: dailyBooster.max_available,
    remainingAmount:
      dailyBooster.user_daily_booster?.[0]?.remaining ??
      dailyBooster.max_available,
  };
}
