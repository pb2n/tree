import { GoogleGenAI, Type, Schema } from "@google/genai";
import { Rarity, ElementType, Card, Enemy, Biome, EnemyAiType } from "../types";
import { STORY_TEMPLATES, BIOME_ENEMIES, CARD_PREFIXES, CARD_SUFFIXES, CARD_DESCRIPTIONS } from "./fallbackData";

// --- Circuit Breaker State ---
let cooldownUntil = 0; // Timestamp: When we can try API again
let isPermanentOffline = false; // Only for missing API Key

const getAiClient = () => {
  // API Key must be obtained exclusively from process.env.API_KEY
  const apiKey = process.env.API_KEY;
  if (!apiKey) throw new Error("API_KEY_MISSING");
  return new GoogleGenAI({ apiKey });
};

// --- Network Status Monitor ---
type NetworkStatusListener = (isOnline: boolean) => void;
const listeners: Set<NetworkStatusListener> = new Set();

// --- Quota Monitor (New) ---
type QuotaListener = () => void;
const quotaListeners: Set<QuotaListener> = new Set();

export const onNetworkStatusChange = (listener: NetworkStatusListener) => {
  listeners.add(listener);
  const isOnline = !isPermanentOffline && Date.now() > cooldownUntil;
  listener(isOnline);
  return () => listeners.delete(listener);
};

export const onQuotaExceeded = (listener: QuotaListener) => {
  quotaListeners.add(listener);
  return () => quotaListeners.delete(listener);
};

const notifyNetworkStatus = (isOnline: boolean) => {
  listeners.forEach(l => l(isOnline));
};

const notifyQuotaExceeded = () => {
  quotaListeners.forEach(l => l());
};

export const resetNetworkStatus = () => {
  if (isPermanentOffline) {
    console.warn("Cannot reset: API Key is missing.");
    return;
  }
  console.log("Manual network reset triggered.");
  cooldownUntil = 0;
  notifyNetworkStatus(true);
};

// --- Helper: JSON Cleaner ---
const cleanJson = (text: string) => {
  if (!text) return "{}";
  return text.replace(/^```json\s*/, '').replace(/\s*```$/, '');
};

// --- Helper: Retry Logic with Circuit Breaker ---
async function withRetry<T>(operation: () => Promise<T>, retries = 1, delay = 1000): Promise<T> {
  if (isPermanentOffline) {
    throw new Error("GLOBAL_OFFLINE_MODE");
  }
  
  if (Date.now() < cooldownUntil) {
    throw new Error("API_COOLDOWN_ACTIVE");
  }

  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API_KEY_MISSING");
    return await operation();
  } catch (error: any) {
    if (error.message === "API_KEY_MISSING") {
        isPermanentOffline = true;
        notifyNetworkStatus(false);
        throw error;
    }

    const isQuotaError = error?.status === 429 || 
                         error?.code === 429 || 
                         error?.message?.includes('429') || 
                         error?.message?.includes('quota') || 
                         error?.message?.includes('RESOURCE_EXHAUSTED');
    
    if (isQuotaError) {
        console.warn("Gemini API Quota Exceeded. Entering 60s Cooldown.");
        cooldownUntil = Date.now() + 60000;
        notifyNetworkStatus(false); 
        notifyQuotaExceeded(); // Notify App to drop SP to 0
        throw new Error("QUOTA_EXCEEDED");
    }

    const isServerErr = error?.status >= 500 || error?.code >= 500;
    
    if (retries > 0 && isServerErr) {
      console.warn(`API call failed (Code ${error?.code || error?.status}). Retrying in ${delay}ms...`);
      await new Promise(resolve => setTimeout(resolve, delay));
      return withRetry(operation, retries - 1, delay * 2);
    }
    
    throw error;
  }
}

// --- Helper Utils ---
const getRandomItem = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const getRandomElement = () => {
  const elements = Object.values(ElementType);
  return elements[Math.floor(Math.random() * elements.length)];
};

// --- Storytelling Service ---

const SYSTEM_INSTRUCTION_STORY = `
你是一棵连接多元宇宙的古老树屋旅馆的旅店老板（Keeper），名字叫“哈娜”（Hana）。
你是一名【松鼠族】的亚人，拥有蓬松的大尾巴和灵动的兽耳。

核心机制：
1. **HP/SP系统**：
   - 玩家有HP（生命）和SP（体力）。战斗中描写动作的消耗。
2. **探索与生物群落 (Biome)**：
   - 所有的描写必须符合当前区域（Biome）的主题。
3. **卡牌与检定**：
   - 检定成功：描写帅气的动作。
   - 检定失败：描写尴尬的失误。

人设细节：
- **性格**：活泼、机灵、贪财、偶尔腹黑。
- **回复风格**：充满画面的奇幻小说风格。如果是对话，则用口语。
- **字数**：150字以内。
`;

export const generateStoryResponse = async (history: {role: string, text: string}[], userMessage: string) => {
  try {
    const text = await withRetry(async () => {
      const ai = getAiClient();
      const model = "gemini-2.5-flash"; 
      
      const chat = ai.chats.create({
        model,
        config: {
          systemInstruction: SYSTEM_INSTRUCTION_STORY,
          temperature: 0.9, 
        },
        history: history.map(h => ({
          role: h.role === 'model' ? 'model' : 'user', 
          parts: [{ text: h.text }]
        }))
      });

      const result = await chat.sendMessage({ message: userMessage });
      return result.text || "";
    });

    notifyNetworkStatus(true);
    return text;
  } catch (error: any) {
    console.warn("Story generation using Offline Mode.");
    
    let templateCategory = STORY_TEMPLATES.CHAT;
    if (userMessage.includes('胜利') || userMessage.includes('消散')) {
      templateCategory = STORY_TEMPLATES.COMBAT_VICTORY;
    } else if (userMessage.includes('ATK') || userMessage.includes('攻击')) {
      templateCategory = STORY_TEMPLATES.COMBAT_ATK;
    } else if (userMessage.includes('DEF') || userMessage.includes('防御')) {
      templateCategory = STORY_TEMPLATES.COMBAT_DEF;
    } else if (userMessage.includes('SPD') || userMessage.includes('闪避')) {
      templateCategory = STORY_TEMPLATES.COMBAT_DODGE;
    } else if (userMessage.includes('探索') || userMessage.includes('前行')) {
      templateCategory = STORY_TEMPLATES.EXPLORE;
    }
    
    const baseText = getRandomItem(templateCategory);
    const flavor = (Date.now() < cooldownUntil) ? " （离线模式 - 精神过载冷却中）" : " （离线模式）";
    return baseText + flavor;
  }
};

// --- Enemy Generation Service ---

const ENEMY_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    description: { type: Type.STRING },
    element: { type: Type.STRING, enum: Object.values(ElementType) },
    stats: {
      type: Type.OBJECT,
      properties: {
        atk: { type: Type.INTEGER },
        def: { type: Type.INTEGER },
        spd: { type: Type.INTEGER },
      },
      required: ["atk", "def", "spd"]
    },
    hp: { type: Type.INTEGER },
    visualPrompt: { type: Type.STRING }
  },
  required: ["name", "description", "element", "stats", "hp", "visualPrompt"]
};

export const generateEnemyData = async (playerLevel: number, biome: Biome): Promise<Partial<Enemy> & { visualPrompt: string }> => {
  try {
    const data = await withRetry(async () => {
      const ai = getAiClient();
      const model = "gemini-2.5-flash"; 
      const difficultyScale = (playerLevel + biome.difficultyLevel) * 5;
      const prompt = `Generate a unique RPG monster for: "${biome.name}" (${biome.description}). Stats Total: ${20 + difficultyScale}.`;
      
      const result = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: ENEMY_SCHEMA }
      });

      const text = cleanJson(result.text || "{}");
      if (!text || text === "{}") throw new Error("No data returned");
      return JSON.parse(text);
    });
    
    let aiType = EnemyAiType.TACTICAL;
    const { atk, def, spd } = data.stats;
    if (atk > def * 1.5) aiType = EnemyAiType.AGGRESSIVE;
    else if (def > atk * 1.5) aiType = EnemyAiType.DEFENSIVE;
    else if (spd > atk && spd > def) aiType = EnemyAiType.CHAOTIC;
    
    notifyNetworkStatus(true);
    return { ...data, aiType };

  } catch (error: any) {
    console.warn("Enemy generation using Offline Mode.");
    const presetList = BIOME_ENEMIES[biome.id] || BIOME_ENEMIES['mistwood'];
    const preset = getRandomItem(presetList);
    const baseStat = 5 + playerLevel * 2 + biome.difficultyLevel * 3;
    
    const atk = baseStat + Math.floor(Math.random() * 5);
    const def = baseStat + Math.floor(Math.random() * 5);
    const spd = baseStat + Math.floor(Math.random() * 5);
    
    let aiType = EnemyAiType.TACTICAL;
    if (atk > def) aiType = EnemyAiType.AGGRESSIVE;
    else if (spd > atk) aiType = EnemyAiType.CHAOTIC;
    
    return {
      name: preset.name,
      description: preset.description,
      element: biome.element,
      stats: { atk, def, spd },
      hp: 30 + playerLevel * 10 + biome.difficultyLevel * 15,
      visualPrompt: preset.visualKeywords,
      aiType
    };
  }
};

// --- Card Generation Service ---

const CARD_SCHEMA: Schema = {
  type: Type.OBJECT,
  properties: {
    name: { type: Type.STRING },
    title: { type: Type.STRING },
    description: { type: Type.STRING },
    rarity: { type: Type.STRING, enum: Object.values(Rarity) },
    element: { type: Type.STRING, enum: Object.values(ElementType) },
    stats: {
      type: Type.OBJECT,
      properties: {
        atk: { type: Type.INTEGER },
        def: { type: Type.INTEGER },
        spd: { type: Type.INTEGER },
      },
      required: ["atk", "def", "spd"]
    },
    lore: { type: Type.STRING },
    visualPrompt: { type: Type.STRING }
  },
  required: ["name", "title", "description", "rarity", "element", "stats", "lore", "visualPrompt"]
};

export const generateCardData = async (themePrompt: string): Promise<Partial<Card> & { visualPrompt: string }> => {
  const rand = Math.random() * 100;
  let targetRarity = Rarity.COMMON;
  let minStat = 15, maxStat = 25;

  if (rand < 50) { targetRarity = Rarity.COMMON; minStat = 15; maxStat = 25; }
  else if (rand < 80) { targetRarity = Rarity.RARE; minStat = 26; maxStat = 35; }
  else if (rand < 95) { targetRarity = Rarity.EPIC; minStat = 36; maxStat = 50; }
  else if (rand < 99) { targetRarity = Rarity.LEGENDARY; minStat = 51; maxStat = 70; }
  else { targetRarity = Rarity.MYTHIC; minStat = 71; maxStat = 100; }

  try {
    const data = await withRetry(async () => {
      const ai = getAiClient();
      const model = "gemini-2.5-flash"; 

      const prompt = `Create RPG card: "${themePrompt}". Rarity: ${targetRarity}. Total Stats: ${minStat}-${maxStat}.`;

      const result = await ai.models.generateContent({
        model,
        contents: prompt,
        config: { responseMimeType: "application/json", responseSchema: CARD_SCHEMA }
      });

      const text = cleanJson(result.text || "{}");
      if (!text || text === "{}") throw new Error("No data returned");
      return JSON.parse(text);
    });

    notifyNetworkStatus(true);
    return data;
  } catch (error: any) {
    console.warn("Card data generation using Offline Mode.");
    const totalBudget = minStat + Math.floor(Math.random() * (maxStat - minStat));
    const atk = Math.floor(totalBudget * 0.33); 
    const def = Math.floor(totalBudget * 0.33);
    const spd = totalBudget - atk - def;

    const prefix = getRandomItem(CARD_PREFIXES);
    const suffix = getRandomItem(CARD_SUFFIXES);
    const name = themePrompt ? `${themePrompt}的${suffix}` : `${prefix}${suffix}`;

    return {
      name: name,
      title: `${targetRarity}造物`,
      description: getRandomItem(CARD_DESCRIPTIONS),
      rarity: targetRarity,
      element: getRandomElement(),
      stats: { atk, def, spd },
      lore: "API冷却时，工匠们启用了古老的技艺。",
      visualPrompt: themePrompt || name
    };
  }
};

export const generateCardImage = async (visualPrompt: string): Promise<string | null> => {
  try {
    const imageUrl = await withRetry(async () => {
      const ai = getAiClient();
      const model = "gemini-2.5-flash-image"; 
      const response = await ai.models.generateContent({
        model,
        contents: { parts: [{ text: `Fantasy RPG Art, ${visualPrompt}` }] },
        config: { imageConfig: { aspectRatio: "3:4" } }
      });
      
      if (response.candidates?.[0]?.content?.parts) {
         for (const part of response.candidates[0].content.parts) {
           if (part.inlineData && part.inlineData.data) {
             return `data:${part.inlineData.mimeType || 'image/png'};base64,${part.inlineData.data}`;
           }
         }
      }
      return null;
    });
    notifyNetworkStatus(true);
    return imageUrl;
  } catch (error: any) {
    const seed = Math.floor(Math.random() * 100000);
    const encodedPrompt = encodeURIComponent(visualPrompt + " fantasy rpg");
    return `https://image.pollinations.ai/prompt/${encodedPrompt}?width=600&height=800&nologo=true&seed=${seed}`;
  }
};