export interface LevelData {
  name: string;
  minPoints: number;
  friendBonus: number;
  friendBonusPremium: number;
}

// Customizable: customize the levels here
export const LEVELS: LevelData[] = [
  {
    name: '🥉 Bronze',
    minPoints: 0,
    friendBonus: 0,
    friendBonusPremium: 0,
  },
  {
    name: '🥈 Silver',
    minPoints: 5000,
    friendBonus: 10000,
    friendBonusPremium: 20000,
  },
  {
    name: '🥇 Gold',
    minPoints: 25000,
    friendBonus: 30000,
    friendBonusPremium: 50000,
  },
  {
    name: '🏆 Platinum',
    minPoints: 1000000,
    friendBonus: 60000,
    friendBonusPremium: 100000,
  },
];

export const calculateLevelIndex = (points: number): number => {
  for (let i = LEVELS.length - 1; i >= 0; i--) {
    if (points >= LEVELS[i].minPoints) {
      return i;
    }
  }
  return 0; // Default to 0 if something goes wrong
};
