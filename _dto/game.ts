import { calculateLevelIndex, LEVELS } from '../_rules/levels.ts';
import {
  calculateEnergyLimit,
  calculatePointsPerClick,
} from '../_rules/rule.ts';
import gameConfigs from '../_rules/gameConfigs.json' with { type: 'json' };

export type GameContext = {
  levelName: string;
  energyLimit: number;
  remainingEnergyRefills: number;
  totalEarnedPoints: number;
  pointBalance: number;
  energyBalance: number;
  multitapLevel: number;
  energyLimitLevel: number;
  lastEnergyRefilledAt: Date;
  lastEnergyUpdatedAt: Date;
  lastPointUpdatedAt: Date;
  maxEnergyRefillsPerDay: number;
  pointEarnsPerClick: number;
  energyConsumesPerClick: number;
  energyRefillInterval: number;
};

export function convertToGameContext(
  gameProfile: any,
  userBoosters?: any[],
  userDailyBoosters?: any[],
): GameContext {
  let multitapLevel = 0;
  let energyLimitLevel = 0;
  let remainingEnergyRefills = 0;
  let lastEnergyRefilledAt = new Date();
  let maxEnergyRefillsPerDay = gameConfigs.max_energy_refills_per_day;
  if (userBoosters) {
    const multitapBooster = userBoosters.find(
      (item) => item.booster.type === 'MULTITAP',
    );
    if (multitapBooster) {
      multitapLevel = multitapBooster.level;
    }
    const energyLimitBooster = userBoosters.find(
      (item) => item.booster.type === 'ENERGY_LIMIT',
    );
    if (energyLimitBooster) {
      energyLimitLevel = energyLimitBooster.level;
    }
  }

  if (userDailyBoosters) {
    const energyRefillBooster = userDailyBoosters.find(
      (booster) => booster.type === 'DAILY_REFILL',
    );
    if (energyRefillBooster) {
      remainingEnergyRefills = energyRefillBooster.remainingAmount;
      lastEnergyRefilledAt = energyRefillBooster.lastRefilledAt;
      maxEnergyRefillsPerDay = energyRefillBooster.daily_booster.max_available;
    }
  }

  const pointEarnsPerClick = calculatePointsPerClick(multitapLevel);
  return {
    levelName:
    LEVELS[calculateLevelIndex(gameProfile.total_earned_points)].name,
    energyBalance: gameProfile.energy_balance,
    energyLimit: calculateEnergyLimit(energyLimitLevel),
    remainingEnergyRefills: remainingEnergyRefills,
    totalEarnedPoints: gameProfile.total_earned_points,
    pointBalance: gameProfile.point_balance,
    multitapLevel: multitapLevel,
    energyLimitLevel: energyLimitLevel,
    lastEnergyRefilledAt: lastEnergyRefilledAt,
    lastEnergyUpdatedAt: gameProfile.last_energy_updated_at,
    lastPointUpdatedAt: gameProfile.last_point_updated_at,
    maxEnergyRefillsPerDay: maxEnergyRefillsPerDay,
    pointEarnsPerClick: pointEarnsPerClick,
    energyConsumesPerClick: pointEarnsPerClick,
    energyRefillInterval: gameConfigs.energy_refill_interval_ms,
  };
}
