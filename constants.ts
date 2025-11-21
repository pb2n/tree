
import { Rarity, ElementType, Biome, Material } from "./types";

export const RARITY_COLORS: Record<Rarity, string> = {
  [Rarity.COMMON]: "text-gray-400 border-gray-400 shadow-gray-500/20",
  [Rarity.RARE]: "text-blue-400 border-blue-400 shadow-blue-500/20",
  [Rarity.EPIC]: "text-purple-400 border-purple-400 shadow-purple-500/20",
  [Rarity.LEGENDARY]: "text-amber-400 border-amber-400 shadow-amber-500/20",
  [Rarity.MYTHIC]: "text-rose-500 border-rose-500 shadow-rose-500/30",
};

// Extra SP cost to use a card of this rarity
export const RARITY_SP_COST: Record<Rarity, number> = {
  [Rarity.COMMON]: 0,
  [Rarity.RARE]: 2,
  [Rarity.EPIC]: 5,
  [Rarity.LEGENDARY]: 8,
  [Rarity.MYTHIC]: 12,
};

export const ELEMENT_COLORS: Record<ElementType, string> = {
  [ElementType.FIRE]: "bg-red-900/30 text-red-200",
  [ElementType.WATER]: "bg-blue-900/30 text-blue-200",
  [ElementType.NATURE]: "bg-green-900/30 text-green-200",
  [ElementType.LIGHT]: "bg-yellow-900/30 text-yellow-200",
  [ElementType.VOID]: "bg-purple-900/30 text-purple-200",
};

export const BIOME_LIST: Biome[] = [
  {
    id: 'mistwood',
    name: '迷雾森林',
    description: '终年被发光苔藓和浓雾笼罩的古老森林，潜伏着未知的野兽。',
    element: ElementType.NATURE,
    difficultyLevel: 1
  },
  {
    id: 'ember_canyon',
    name: '烬燃峡谷',
    description: '流淌着岩浆的破碎大地，空气中充满硫磺味。火元素极度活跃。',
    element: ElementType.FIRE,
    difficultyLevel: 2
  },
  {
    id: 'crystal_spire',
    name: '水晶尖塔',
    description: '漂浮在天空中的古老遗迹，充满魔法能量和自动防御的构装体。',
    element: ElementType.LIGHT,
    difficultyLevel: 3
  },
  {
    id: 'abyssal_depths',
    name: '深渊海沟',
    description: '光线无法到达的深海，巨大的古神阴影在游动。',
    element: ElementType.WATER,
    difficultyLevel: 4
  },
  {
    id: 'void_nexus',
    name: '虚空枢纽',
    description: '现实的边界，这里只有混乱、熵增和最纯粹的虚空生物。',
    element: ElementType.VOID,
    difficultyLevel: 5
  }
];

export const BIOME_MATERIALS: Record<string, Material> = {
  'mistwood': { id: 'mat_forest_core', name: '森之核', description: '充满生机的绿色结晶', element: ElementType.NATURE },
  'ember_canyon': { id: 'mat_fire_shard', name: '余烬结晶', description: '滚烫的红色碎片', element: ElementType.FIRE },
  'crystal_spire': { id: 'mat_light_prism', name: '光之棱镜', description: '折射彩虹的水晶', element: ElementType.LIGHT },
  'abyssal_depths': { id: 'mat_deep_pearl', name: '深渊黑珠', description: '冰冷且沉重', element: ElementType.WATER },
  'void_nexus': { id: 'mat_void_dust', name: '虚空尘埃', description: '不断闪烁消失的物质', element: ElementType.VOID }
};
