
export enum Rarity {
  COMMON = '普通',
  RARE = '稀有',
  EPIC = '史诗',
  LEGENDARY = '传说',
  MYTHIC = '神话'
}

export enum ElementType {
  FIRE = '火',
  WATER = '水',
  NATURE = '森',
  LIGHT = '光',
  VOID = '虚空'
}

export interface CardStats {
  atk: number;
  def: number;
  spd: number;
}

export interface Card {
  id: string;
  name: string;
  title: string;
  description: string;
  rarity: Rarity;
  element: ElementType;
  stats: CardStats;
  imageUrl: string;
  lore: string;
  currentUsage: number; 
  maxUsage: number;
  cooldownUntil?: number; // Timestamp for when the card becomes usable again
}

export interface Material {
  id: string;
  name: string;
  description: string;
  element: ElementType;
}

export enum EnemyIntent {
  ATTACK = 'ATTACK',
  DEFEND = 'DEFEND',
  CHARGE = 'CHARGE', // Prepares a big attack
  STUN = 'STUN'
}

export enum EnemyAiType {
  AGGRESSIVE = '狂暴',   // Mostly Attacks/Charges
  DEFENSIVE = '坚守',    // Defends often, especially at low HP
  TACTICAL = '战术',     // Balanced, reacts to player
  CHAOTIC = '混沌'       // Completely random
}

export interface Enemy {
  id: string;
  name: string;
  description: string;
  element: ElementType;
  stats: CardStats;
  hp: number;
  maxHp: number;
  imageUrl: string;
  rewardStardust: number;
  nextIntent: EnemyIntent;
  aiType: EnemyAiType; 
}

export interface BestiaryEntry {
  enemyId: string; // Unique by name+element usually
  name: string;
  description: string;
  imageUrl: string;
  element: ElementType;
  encounterCount: number;
  defeatCount: number;
  aiType: EnemyAiType;
}

export interface Biome {
  id: string;
  name: string;
  description: string;
  element: ElementType;
  difficultyLevel: number;
}

export interface ChatMessage {
  role: 'user' | 'model' | 'system';
  text: string;
  timestamp: number;
  meta?: {
    isRoll?: boolean;
    rollType?: 'ATK' | 'DEF' | 'SPD';
    rollValue?: number;
    totalValue?: number;
    usedCardName?: string;
    damageTaken?: number; 
    damageDealt?: number; 
    cardBroke?: boolean; 
    enemyName?: string;   
    isVictory?: boolean;
    biomeName?: string; 
    eventType?: 'COMBAT' | 'TREASURE' | 'EVENT';
    loot?: string; 
  };
}

export interface PlayerStats {
  atk: number;
  def: number;
  spd: number;
  hp: number;      
  maxHp: number;   
  sp: number;      // Stamina Points (replaces MP)
  maxSp: number;   
  bestCards: {
    atk: Card | null;
    def: Card | null;
    spd: Card | null;
  }
}

export enum AppView {
  STORY = 'STORY',
  FORGE = 'FORGE',
  INVENTORY = 'INVENTORY',
  PROFILE = 'PROFILE'
}
