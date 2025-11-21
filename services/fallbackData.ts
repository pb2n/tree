// --- STORY FALLBACKS ---
export const STORY_TEMPLATES = {
  COMBAT_ATK: [
    "你挥舞武器发起了猛烈的攻击，剑光在空气中划出一道残影。",
    "即使无法聆听神谕，你的战斗本能依然敏锐。你抓住了敌人的破绽。",
    "一次朴实无华但极具威胁的攻击！空气因你的力量而震颤。",
    "你调整呼吸，将全身的力量汇聚在一点，随后爆发而出。",
    "你利用周围的环境作为掩护，对敌人发起了突袭。"
  ],
  COMBAT_DEF: [
    "你架起防御姿态，如同磐石般不可动摇。",
    "你预判了敌人的攻势，冷静地格挡了即将到来的冲击。",
    "在混乱的战场中，你找到了一处安全的死角进行防守。",
    "光芒闪过，你的护盾承受住了这次重击。",
    "你压低重心，准备迎接冲击。"
  ],
  COMBAT_DODGE: [
    "你身形一闪，险之又险地避开了致命一击。",
    "你的动作快如闪电，敌人的攻击只击中了你的残影。",
    "你利用地形优势，灵巧地翻滚到了侧翼。",
    "一阵风吹过，你已不在原地。",
    "你如同幻影般穿梭在战场上。"
  ],
  COMBAT_VICTORY: [
    "随着最后一次重击，敌人化作光点消散在空气中。",
    "战斗结束了。你擦去额头的汗水，感受着战利品的重量。",
    "虽然有些狼狈，但胜利依然属于你。敌人已不复存在。",
    "你不仅战胜了对手，更战胜了内心的恐惧。",
    "敌人的身躯崩解，化作纯粹的能量消散。"
  ],
  EXPLORE: [
    "你继续在这片神秘的土地上前行，周围的景色逐渐变得陌生。",
    "脚下的路蜿蜒曲折，远处似乎传来了未知的低语。",
    "你拨开眼前的障碍物，发现了一些古文明留下的痕迹。",
    "虽然信号受到了干扰，但你的探险精神从未熄灭。",
    "风中传来异样的气息，这片区域似乎隐藏着秘密。"
  ],
  CHAT: [
    "哈娜微笑着听着，虽然她此刻似乎在忙着整理柜台，但还是向你点了点头。",
    "风声太大了，哈娜似乎没有听清你在说什么，但她贴心地递给你一杯热茶。",
    "（心灵感应受到干扰）哈娜正在冥想，无法回应复杂的对话，但你能感受到她的善意。",
    "哈娜正忙着对付一只偷吃坚果的飞鼠，无暇顾及你的话语，只是匆忙指了指任务板。",
    "“虽然现在的魔力波动很乱，但只要树屋还在，我就一直在。”哈娜这样说道。"
  ]
};

// --- ENEMY PRESETS ---
interface EnemyPreset {
  name: string;
  description: string;
  visualKeywords: string;
}

export const BIOME_ENEMIES: Record<string, EnemyPreset[]> = {
  'mistwood': [ // Nature
    { name: "苔藓巨狼", description: "浑身覆盖着发光苔藓的巨狼，眼神凶狠。", visualKeywords: "giant wolf, moss, forest, glowing green eyes" },
    { name: "腐化树人", description: "被黑暗力量扭曲的古树，挥舞着带刺的藤蔓。", visualKeywords: "treant, corrupted, dark forest, twisted wood" },
    { name: "迷雾幽灵", description: "在雾气中若隐若现的灵体，散发着寒气。", visualKeywords: "ghost, mist, fog, scary spirit" }
  ],
  'ember_canyon': [ // Fire
    { name: "熔岩史莱姆", description: "一团滚烫的液态岩浆，所过之处寸草不生。", visualKeywords: "magma slime, lava, fire, burning" },
    { name: "黑曜石魔像", description: "由坚硬的黑曜石构成的构装体，防御力极高。", visualKeywords: "obsidian golem, rock monster, lava background" },
    { name: "火蜥蜴掠夺者", description: "手持粗糙武器的蜥蜴人，习惯群体行动。", visualKeywords: "lizardman, fire weapons, canyon, warrior" }
  ],
  'crystal_spire': [ // Light
    { name: "晶体卫士", description: "自动巡逻的古代机械，核心闪烁着蓝光。", visualKeywords: "crystal robot, ancient guardian, sci-fi fantasy, floating spire" },
    { name: "光辉元素", description: "纯粹光能聚合而成的生物，刺眼得让人无法直视。", visualKeywords: "light elemental, glowing angel, bright energy" },
    { name: "镜面魔", description: "能够反射攻击的诡异生物，身体如同镜子。", visualKeywords: "mirror monster, reflection, crystal, glass" }
  ],
  'abyssal_depths': [ // Water
    { name: "深渊巨蟹", description: "甲壳上长满藤壶的巨蟹，巨钳能夹断钢铁。", visualKeywords: "giant crab, deep sea, dark water, bioluminescence" },
    { name: "塞壬海妖", description: "用歌声迷惑猎物的海妖，美丽而致命。", visualKeywords: "siren, mermaid, dark ocean, scary beautiful" },
    { name: "克苏鲁之影", description: "不可名状的触手阴影，令人掉san。", visualKeywords: "lovecraftian monster, tentacles, deep dark sea, horror" }
  ],
  'void_nexus': [ // Void
    { name: "虚空行者", description: "没有面孔的人形生物，周身环绕着紫色的虚空能量。", visualKeywords: "void walker, purple energy, faceless, cosmic" },
    { name: "熵增兽", description: "存在的目的就是为了吞噬物质的混沌野兽。", visualKeywords: "chaos beast, purple black hole, cosmic horror" },
    { name: "时空吞噬者", description: "游荡在时间缝隙中的巨口。", visualKeywords: "giant mouth, space galaxy background, purple teeth" }
  ]
};

// --- CARD GENERATION TEMPLATES ---

export const CARD_PREFIXES = [
  "古老的", "虚空的", "燃烧的", "冰霜的", "雷霆的", "神圣的", "被诅咒的", "机械的", "翡翠的", "暗影的", "星界的", "龙血的"
];

export const CARD_SUFFIXES = [
  "之剑", "护盾", "法杖", "护符", "战甲", "指环", "秘典", "之眼", "核心", "披风", "巨锤", "长弓"
];

export const CARD_DESCRIPTIONS = [
  "散发着令人心悸的能量波动。",
  "上面刻满了无法解读的古代符文。",
  "握在手中能感受到它曾经主人的意志。",
  "仿佛有生命一般微微搏动。",
  "在黑暗中会发出微弱的荧光。",
  "只有真正的勇士才能驾驭这股力量。",
  "似乎连接着另一个维度的入口。"
];