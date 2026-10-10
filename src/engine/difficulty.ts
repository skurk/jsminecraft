export type DifficultyId = 'easy' | 'medium' | 'hard';

export interface Difficulty {
  id: DifficultyId;
  name: string;
  description: string;
  maxMobs: number;
  spawnInterval: number;
  spawnPerWave: number;
  aggroRange: number;
  speedMultiplier: number;
  damageMultiplier: number;
  healthMultiplier: number;
  attackCooldown: number;
}

export const DIFFICULTIES: Record<DifficultyId, Difficulty> = {
  easy: {
    id: 'easy',
    name: 'Easy',
    description: 'Few mobs, slow and weak',
    maxMobs: 6,
    spawnInterval: 4,
    spawnPerWave: 1,
    aggroRange: 12,
    speedMultiplier: 0.75,
    damageMultiplier: 0.5,
    healthMultiplier: 0.8,
    attackCooldown: 1.6,
  },
  medium: {
    id: 'medium',
    name: 'Medium',
    description: 'A fair fight after dark',
    maxMobs: 14,
    spawnInterval: 2,
    spawnPerWave: 2,
    aggroRange: 22,
    speedMultiplier: 1,
    damageMultiplier: 1,
    healthMultiplier: 1,
    attackCooldown: 1,
  },
  hard: {
    id: 'hard',
    name: 'Hard',
    description: 'Packs of fast, hard-hitting mobs',
    maxMobs: 24,
    spawnInterval: 1.2,
    spawnPerWave: 3,
    aggroRange: 32,
    speedMultiplier: 1.25,
    damageMultiplier: 1.6,
    healthMultiplier: 1.3,
    attackCooldown: 0.7,
  },
};

export const DEFAULT_DIFFICULTY: DifficultyId = 'medium';
