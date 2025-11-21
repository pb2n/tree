import React, { useState, useEffect } from 'react';
import { AppView, Card, ChatMessage, PlayerStats, Enemy, Biome, EnemyIntent, Rarity, EnemyAiType, BestiaryEntry, Material } from './types';
import { StoryView } from './components/StoryView';
import { CardForge } from './components/CardForge';
import { CardComponent } from './components/CardComponent';
import { IconBook, IconHexagon, IconCards, IconUser, IconSparkles, IconAlert, IconWifi, IconWifiOff, IconBackpack, IconBox, IconGem } from './components/Icons';
import { generateEnemyData, generateCardImage, generateCardData, onNetworkStatusChange, resetNetworkStatus, onQuotaExceeded } from './services/geminiService';
import { BIOME_LIST, BIOME_MATERIALS, ELEMENT_COLORS } from './constants';
import { audio } from './services/audioService';

const REST_COST = 30;
const CARD_COOLDOWN_MS = 10000; // 10 seconds cooldown for card reuse

const ACTION_COSTS = {
  CHAT: 10,
  EXPLORE: 15,
  COMBAT: 10,
  FORGE: 30
};

const App: React.FC = () => {
  const [currentView, setCurrentView] = useState<AppView>(AppView.STORY);
  const [inventory, setInventory] = useState<Card[]>([]);
  const [stardust, setStardust] = useState<number>(100);
  const [materials, setMaterials] = useState<Record<string, number>>({});
  
  const [inventoryTab, setInventoryTab] = useState<'CARDS' | 'MATERIALS'>('CARDS');
  const [isOnline, setIsOnline] = useState(true);

  // Stats State
  const [hp, setHp] = useState(100);
  const [maxHp] = useState(100);
  const [sp, setSp] = useState(50); // Stamina Points
  const [maxSp] = useState(50);

  const [currentBiome, setCurrentBiome] = useState<Biome>(BIOME_LIST[0]);
  const [explorationProgress, setExplorationProgress] = useState(0);
  const [activeEnemy, setActiveEnemy] = useState<Enemy | null>(null);
  const [bestiary, setBestiary] = useState<BestiaryEntry[]>([]);
  const [dropPityCounter, setDropPityCounter] = useState(0);

  // Loot Notification State
  const [lootNotification, setLootNotification] = useState<{ material: Material, count: number } | null>(null);

  const [messages, setMessages] = useState<ChatMessage[]>([
    { 
      role: 'model', 
      text: '欢迎回到世界树旅馆！我是哈娜。我们现在位于【迷雾森林】的边缘。所有行动都需要消耗体力(SP)，使用强力卡牌会消耗更多精神力并需要冷却时间。', 
      timestamp: Date.now() 
    }
  ]);

  const [forgeStatus, setForgeStatus] = useState<'idle' | 'generating_data' | 'generating_image'>('idle');
  const [generatedCard, setGeneratedCard] = useState<Card | null>(null);
  const [forgeError, setForgeError] = useState('');
  const [forgeCost] = useState(50);

  const [profileTab, setProfileTab] = useState<'STATUS' | 'BESTIARY' | 'RANKING'>('STATUS');
  
  // Heartbeat state to force re-renders for cooldown timers
  const [heartbeat, setHeartbeat] = useState(0);

  // --- STAMINA REGEN & LISTENERS ---
  useEffect(() => {
    // Auto Regen SP every second + Heartbeat
    const regenInterval = setInterval(() => {
      setSp(prev => Math.min(maxSp, prev + 1));
      setHeartbeat(prev => prev + 1);
    }, 1000);

    // Network Status Listener
    const unsubscribeNetwork = onNetworkStatusChange((status) => {
      setIsOnline(status);
    });

    // Quota Exceeded Listener (Overload Penalty)
    const unsubscribeQuota = onQuotaExceeded(() => {
      setSp(0); // DROP TO ZERO IMMEDIATELY
      setMessages(prev => [...prev, {
        role: 'system',
        text: `[精神过载] 与多元宇宙的链接过于频繁！你的体力(SP)已耗尽，进入强制冷却状态。`,
        timestamp: Date.now()
      }]);
      audio.sfxError();
    });

    return () => { 
      clearInterval(regenInterval); 
      unsubscribeNetwork(); 
      unsubscribeQuota();
    };
  }, [maxSp]);

  const handleNetworkReconnect = () => {
    if (!isOnline) {
      resetNetworkStatus();
      setIsOnline(true); 
      setMessages(prev => [...prev, {
        role: 'system',
        text: '[系统] 正在尝试重新连接神经网络...',
        timestamp: Date.now()
      }]);
    }
  };

  const playerStats: PlayerStats = React.useMemo(() => {
    const base = { atk: 5, def: 5, spd: 5 };
    let maxAtk = 0, maxDef = 0, maxSpd = 0;
    let bestAtkCard: Card | null = null;
    let bestDefCard: Card | null = null;
    let bestSpdCard: Card | null = null;

    inventory.forEach(card => {
      if (card.stats.atk > maxAtk) { maxAtk = card.stats.atk; bestAtkCard = card; }
      if (card.stats.def > maxDef) { maxDef = card.stats.def; bestDefCard = card; }
      if (card.stats.spd > maxSpd) { maxSpd = card.stats.spd; bestSpdCard = card; }
    });

    return {
      atk: base.atk + maxAtk,
      def: base.def + maxDef,
      spd: base.spd + maxSpd,
      hp, maxHp, sp, maxSp,
      bestCards: { atk: bestAtkCard, def: bestDefCard, spd: bestSpdCard }
    };
  }, [inventory, hp, maxHp, sp, maxSp, heartbeat]); // depend on heartbeat to refresh checks

  const addToInventory = (card: Card) => { setInventory(prev => [card, ...prev]); };
  const handleStardustChange = (amount: number) => { setStardust(prev => Math.max(0, prev + amount)); };
  const addMaterial = (matId: string, amount: number) => { setMaterials(prev => ({ ...prev, [matId]: (prev[matId] || 0) + amount })); };

  const unlockBestiaryEntry = (enemy: Enemy) => {
    setBestiary(prev => {
       const exists = prev.find(e => e.name === enemy.name);
       if (exists) return prev.map(e => e.name === enemy.name ? { ...e, encounterCount: e.encounterCount + 1 } : e);
       return [...prev, { enemyId: enemy.id, name: enemy.name, description: enemy.description, imageUrl: enemy.imageUrl, element: enemy.element, encounterCount: 1, defeatCount: 0, aiType: enemy.aiType }];
    });
  };
  const updateBestiaryKill = (enemyName: string) => { setBestiary(prev => prev.map(e => e.name === enemyName ? { ...e, defeatCount: e.defeatCount + 1 } : e)); };
  const getDurabilityByRarity = (rarity: Rarity) => { switch (rarity) { case Rarity.MYTHIC: return 20; case Rarity.LEGENDARY: return 12; case Rarity.EPIC: return 8; case Rarity.RARE: return 5; default: return 3; } };

  // --- ACTIONS ---

  const checkSp = (cost: number) => {
    if (sp < cost) {
      audio.sfxError();
      setMessages(prev => [...prev, { role: 'system', text: `[体力不足] 需要 ${cost} SP，当前只有 ${sp}。请稍作休息。`, timestamp: Date.now() }]);
      return false;
    }
    return true;
  };

  const handleStartForge = async (prompt: string, materialId: string) => {
    if (!checkSp(ACTION_COSTS.FORGE)) return;
    if (stardust < forgeCost) return;
    if ((materials[materialId] || 0) <= 0) return;

    setSp(prev => prev - ACTION_COSTS.FORGE); // Deduct SP
    setStardust(prev => prev - forgeCost);
    setMaterials(prev => ({ ...prev, [materialId]: Math.max(0, (prev[materialId] || 0) - 1) }));

    setForgeStatus('generating_data');
    setForgeError('');
    setGeneratedCard(null);

    try {
      const usedMaterial = Object.values(BIOME_MATERIALS).find(m => m.id === materialId);
      const augmentedPrompt = usedMaterial ? `${prompt} (Infused with ${usedMaterial.name}: ${usedMaterial.description})` : prompt;
      const data = await generateCardData(augmentedPrompt);
      
      setForgeStatus('generating_image');
      let finalImageUrl = `https://picsum.photos/seed/${data.name?.replace(/\s/g, '')}${Date.now()}/600/800`;
      if (data.visualPrompt) {
        const art = await generateCardImage(data.visualPrompt);
        if (art) finalImageUrl = art;
      }
      
      const rarity = data.rarity as Rarity || Rarity.COMMON;
      const maxUsage = getDurabilityByRarity(rarity);
      const newCard: Card = {
        id: Date.now().toString(),
        name: data.name || 'Unknown',
        title: data.title || 'The Nameless',
        description: data.description || '',
        rarity: rarity,
        element: data.element as any,
        stats: data.stats || { atk: 0, def: 0, spd: 0 },
        lore: data.lore || '',
        imageUrl: finalImageUrl,
        currentUsage: maxUsage,
        maxUsage: maxUsage
      };
      setGeneratedCard(newCard);
    } catch (e) {
      setForgeError('灵感枯竭了... 星尘和祭品已返还。');
      setStardust(prev => prev + forgeCost);
      setMaterials(prev => ({ ...prev, [materialId]: (prev[materialId] || 0) + 1 }));
    } finally {
      setForgeStatus('idle');
    }
  };

  const handleClaimCard = () => {
    if (generatedCard) {
      addToInventory(generatedCard);
      setGeneratedCard(null);
      setMessages(prev => [...prev, { role: 'system', text: `[获得卡牌] 成功召唤了【${generatedCard.name}】！`, timestamp: Date.now() }]);
    }
  };
  const handleDiscardCard = () => { setGeneratedCard(null); };

  const handleTakeDamage = (amount: number) => {
    setHp(prev => {
      const next = prev - amount;
      if (next <= 0) {
        setTimeout(() => {
          setMessages(prevMsg => [...prevMsg, { role: 'system', text: `[HP归零] 意识模糊... 哈娜把你拖回了旅馆。星尘 -50，进度重置。`, timestamp: Date.now() }]);
          setStardust(s => Math.max(0, s - 50));
          setHp(maxHp);
          setSp(maxSp); // Full restore on death
          setActiveEnemy(null); 
          setExplorationProgress(0);
        }, 1000);
        return 0;
      }
      return next;
    });
  };

  const handleConsumeCard = (cardId: string): boolean => {
    let cardBroke = false;
    setInventory(prev => prev.filter(c => {
      if (c.id === cardId) {
        const nextUsage = c.currentUsage - 1;
        if (nextUsage <= 0) { cardBroke = true; return false; }
        return true; 
      }
      return true;
    }));
    
    if (!cardBroke) {
        // Update cooldown and usage
        setInventory(prev => prev.map(c => 
            c.id === cardId 
            ? { ...c, currentUsage: c.currentUsage - 1, cooldownUntil: Date.now() + CARD_COOLDOWN_MS } 
            : c
        ));
    }
    return cardBroke;
  };

  const spawnEnemy = async (isAmbush: boolean = false) => {
    const level = inventory.length + currentBiome.difficultyLevel;
    const enemyData = await generateEnemyData(level, currentBiome);
    let imageUrl = `https://picsum.photos/seed/${enemyData.name}monster/600/600`;
    if (enemyData.visualPrompt) {
      const art = await generateCardImage(enemyData.visualPrompt);
      if (art) imageUrl = art;
    }
    const newEnemy: Enemy = {
      id: Date.now().toString(),
      name: enemyData.name || "Unknown",
      description: enemyData.description || "...",
      element: enemyData.element as any,
      stats: enemyData.stats || { atk: 10, def: 5, spd: 5 },
      hp: enemyData.hp || 50,
      maxHp: enemyData.hp || 50,
      imageUrl,
      rewardStardust: 30 + level * 10,
      nextIntent: EnemyIntent.ATTACK, 
      aiType: enemyData.aiType || EnemyAiType.CHAOTIC
    };
    newEnemy.nextIntent = calculateEnemyIntent(newEnemy);
    setActiveEnemy(newEnemy);
    unlockBestiaryEntry(newEnemy); 
    const introText = isAmbush 
      ? `[露营遇袭] 篝火引来了【${newEnemy.name}】！`
      : `[遭遇敌人] 在${currentBiome.name}的深处，遭遇了【${newEnemy.name}】(类型: ${newEnemy.aiType})！`;
    setMessages(prev => [...prev, { role: 'system', text: introText, timestamp: Date.now(), meta: { eventType: 'COMBAT', enemyName: newEnemy.name, biomeName: currentBiome.name } }]);
  };

  const handleRest = () => {
    if (activeEnemy) return; 
    if (stardust < REST_COST) {
      setMessages(prev => [...prev, { role: 'system', text: `[无法休息] 星尘不足 (${stardust}/${REST_COST})。`, timestamp: Date.now() }]);
      return;
    }
    setStardust(prev => prev - REST_COST);
    
    // Restores SP too
    setHp(prev => Math.min(maxHp, prev + Math.floor(maxHp * 0.5)));
    setSp(prev => Math.min(maxSp, prev + Math.floor(maxSp * 0.5)));

    const ambushChance = 0.30 + (currentBiome.difficultyLevel * 0.05);
    if (Math.random() < ambushChance) {
       spawnEnemy(true);
    } else {
       setMessages(prev => [...prev, { role: 'system', text: `[露营] 消耗${REST_COST}星尘。HP/SP 恢复了 50%。`, timestamp: Date.now() }]);
    }
  };

  const calculateEnemyIntent = (enemy: Enemy): EnemyIntent => {
    const hpPercent = enemy.hp / enemy.maxHp;
    const rand = Math.random();
    switch (enemy.aiType) {
      case EnemyAiType.AGGRESSIVE: return rand < 0.8 ? EnemyIntent.ATTACK : EnemyIntent.CHARGE;
      case EnemyAiType.DEFENSIVE: if (hpPercent < 0.4) return rand < 0.7 ? EnemyIntent.DEFEND : EnemyIntent.ATTACK; return rand < 0.4 ? EnemyIntent.DEFEND : EnemyIntent.ATTACK;
      case EnemyAiType.TACTICAL: if (hpPercent > 0.7) return rand < 0.3 ? EnemyIntent.CHARGE : EnemyIntent.ATTACK; if (hpPercent < 0.3) return rand < 0.5 ? EnemyIntent.DEFEND : EnemyIntent.ATTACK; return EnemyIntent.ATTACK;
      case EnemyAiType.CHAOTIC: default: if (rand < 0.6) return EnemyIntent.ATTACK; if (rand < 0.8) return EnemyIntent.DEFEND; return EnemyIntent.CHARGE;
    }
  };

  const handleExplore = async () => {
    if (activeEnemy) return;
    if (!checkSp(ACTION_COSTS.EXPLORE)) return;
    setSp(prev => prev - ACTION_COSTS.EXPLORE);

    const progressGain = Math.floor(Math.random() * 15) + 10;
    const nextProgress = explorationProgress + progressGain;

    if (nextProgress >= 100) {
        const currentIndex = BIOME_LIST.findIndex(b => b.id === currentBiome.id);
        const nextIndex = (currentIndex + 1) % BIOME_LIST.length;
        const nextBiome = BIOME_LIST[nextIndex];
        const rewardStardust = 50;
        const rewardMat = BIOME_MATERIALS[currentBiome.id];
        const rewardMatCount = Math.floor(Math.random() * 3) + 1;

        setCurrentBiome(nextBiome);
        setExplorationProgress(0);
        handleStardustChange(rewardStardust);
        addMaterial(rewardMat.id, rewardMatCount);

        setMessages(prev => [...prev, {
             role: 'system',
             text: `[区域通关] 探索进度 100%！抵达：【${nextBiome.name}】。\n(奖励: ${rewardStardust} 星尘, ${rewardMatCount}个 ${rewardMat.name})`,
             timestamp: Date.now(),
             meta: { eventType: 'EVENT', biomeName: nextBiome.name }
        }]);
        return;
    }

    setExplorationProgress(nextProgress);
    const roll = Math.random();
    if (roll < 0.5) {
      await spawnEnemy(false);
    } else if (roll < 0.7) {
       const dust = Math.floor(Math.random() * 30) + 10;
       handleStardustChange(dust);
       setMessages(prev => [...prev, { role: 'system', text: `[发现宝藏] 星尘 +${dust}`, timestamp: Date.now(), meta: { eventType: 'TREASURE', biomeName: currentBiome.name } }]);
    } else {
       setMessages(prev => [...prev, { role: 'system', text: `[突发事件] 前方出现了奇怪的景象... (请进行检定以应对)`, timestamp: Date.now(), meta: { eventType: 'EVENT', biomeName: currentBiome.name } }]);
    }
  };

  const handleCombatRound = (enemy: Enemy, damageDealt: number, damageTaken: number) => {
    const nextEnemyHp = enemy.hp - damageDealt;
    if (nextEnemyHp <= 0) {
      setActiveEnemy(null);
      handleStardustChange(enemy.rewardStardust);
      updateBestiaryKill(enemy.name);
      setDropPityCounter(prev => prev + 1);
      let dropMsg = '';
      
      // Pity System & Loot Logic
      if (Math.random() < 0.35 || dropPityCounter >= 2) {
         const mat = BIOME_MATERIALS[currentBiome.id];
         addMaterial(mat.id, 1);
         setDropPityCounter(0);
         dropMsg = ` [战利品] 获得祭品：${mat.name} x1`;
         
         // Trigger Loot Notification
         audio.sfxLevelUp(); // Use level up sound for "Treasure/Rare" feel
         setLootNotification({ material: mat, count: 1 });
         setTimeout(() => setLootNotification(null), 3000);
      }

      if (dropMsg) {
         setMessages(prev => [...prev, { role: 'system', text: dropMsg, timestamp: Date.now(), meta: { eventType: 'TREASURE' } }]);
      }
      return { isVictory: true };
    } else {
      const tempEnemy = { ...enemy, hp: nextEnemyHp };
      const nextIntent = calculateEnemyIntent(tempEnemy);
      setActiveEnemy({ ...tempEnemy, nextIntent });
      if (damageTaken > 0) handleTakeDamage(damageTaken);
      return { isVictory: false };
    }
  };
  const getMaterialInfo = (id: string) => Object.values(BIOME_MATERIALS).find(m => m.id === id);
  const NavItem = ({ view, icon, label }: { view: AppView; icon: React.ReactNode; label: string }) => {
    const isForging = view === AppView.FORGE && forgeStatus !== 'idle';
    const hasResult = view === AppView.FORGE && generatedCard !== null;
    return (
      <button onClick={() => setCurrentView(view)} className={`flex flex-col items-center gap-1 p-2 w-full transition-colors duration-300 relative ${currentView === view ? 'text-orange-400' : 'text-gray-500 hover:text-gray-300'}`}>
        <div className="w-6 h-6 relative">
          {icon}
          {isForging && <span className="absolute -top-1 -right-1 w-3 h-3 bg-indigo-500 rounded-full animate-spin border-2 border-[#0f0e17]"></span>}
          {hasResult && !isForging && <span className="absolute -top-1 -right-1 w-3 h-3 bg-rose-500 rounded-full animate-bounce border-2 border-[#0f0e17]"></span>}
        </div>
        <span className="text-[10px] font-medium tracking-wider">{label}</span>
        {currentView === view && <span className="absolute top-0 w-8 h-[2px] bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.8)]"></span>}
      </button>
    );
  };

  return (
    <div className="h-screen w-full bg-[#0f0e17] flex flex-col overflow-hidden text-slate-200 font-sans selection:bg-orange-500/30 relative">
      
      {/* Loot Notification Overlay */}
      {lootNotification && (
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 z-50 pointer-events-none flex flex-col items-center animate-in slide-in-from-bottom-10 fade-in duration-700">
           <div className="relative">
             <div className="absolute inset-0 bg-yellow-500/30 blur-xl rounded-full animate-pulse"></div>
             <IconGem className="w-20 h-20 text-yellow-300 drop-shadow-[0_0_15px_rgba(253,224,71,0.5)] animate-bounce" />
           </div>
           <div className="mt-4 text-center space-y-1">
             <div className="text-sm font-bold text-yellow-500 uppercase tracking-widest text-shadow-sm">获得祭品</div>
             <div className="text-2xl font-display font-bold text-white drop-shadow-md">
               {lootNotification.material.name} <span className="text-lg text-yellow-400">x{lootNotification.count}</span>
             </div>
           </div>
        </div>
      )}

      <header className="h-14 border-b border-white/5 bg-[#0f0e17]/80 backdrop-blur-md flex items-center justify-between px-4 z-50 relative shrink-0">
        <div className="w-16 flex items-center gap-2">
          <button 
            onClick={handleNetworkReconnect}
            disabled={isOnline}
            className={`w-8 h-8 rounded-full flex items-center justify-center border transition-all duration-500 
              ${isOnline ? 'bg-emerald-900/20 border-emerald-500/30 text-emerald-400 cursor-default' : 'bg-rose-900/20 border-rose-500/30 text-rose-400 hover:bg-rose-900/40 cursor-pointer animate-pulse'}
            `}
            title={isOnline ? "在线 (Online)" : "离线 (Offline) - 点击尝试重连"}
          >
             {isOnline ? <IconWifi className="w-4 h-4" /> : <IconWifiOff className="w-4 h-4" />}
          </button>
        </div> 
        <h1 className="font-display font-bold text-xl tracking-widest bg-gradient-to-r from-orange-200 via-white to-orange-200 bg-clip-text text-transparent">
          YGGDRASIL INN
        </h1>
        <div className="w-16 flex justify-end">
           <div className="flex items-center gap-1 bg-slate-800/50 px-2 py-1 rounded-full border border-slate-700">
             <IconSparkles className="w-3 h-3 text-yellow-400" />
             <span className="text-xs font-mono font-bold text-yellow-100">{stardust}</span>
           </div>
        </div>
      </header>

      <main className="flex-1 relative overflow-hidden w-full">
        {currentView === AppView.STORY && (
          <StoryView 
            messages={messages} 
            setMessages={setMessages} 
            playerStats={playerStats}
            activeEnemy={activeEnemy}
            currentBiome={currentBiome}
            explorationProgress={explorationProgress}
            onAddStardust={() => handleStardustChange(5)}
            onTakeDamage={handleTakeDamage}
            onConsumeCard={handleConsumeCard}
            onRest={handleRest}
            onExplore={handleExplore}
            onCombatRound={handleCombatRound}
            stardust={stardust}
            restCost={REST_COST}
            checkSp={checkSp} // Pass helper
            deductSp={(amt) => setSp(p => p - amt)}
          />
        )}
        
        {currentView === AppView.FORGE && (
          <CardForge 
            stardust={stardust}
            cost={forgeCost}
            materials={materials}
            status={forgeStatus}
            generatedCard={generatedCard}
            error={forgeError}
            onForge={handleStartForge}
            onClaim={handleClaimCard}
            onDiscard={handleDiscardCard}
            sp={sp}
            spCost={ACTION_COSTS.FORGE}
          />
        )}

        {currentView === AppView.INVENTORY && (
          <div className="h-full flex flex-col bg-[#0f0e17]">
             <div className="p-4 pb-2 bg-slate-900/50 border-b border-white/5 shrink-0">
                <h2 className="text-xl font-display text-center mb-3 text-orange-100">冒险行囊</h2>
                <div className="flex justify-center gap-6 text-xs font-medium">
                  <div className="flex gap-1.5 items-center"><IconAlert className="w-3 h-3 text-rose-400" /> <span className="text-gray-300">ATK {playerStats.atk}</span></div>
                  <div className="flex gap-1.5 items-center"><IconSparkles className="w-3 h-3 text-blue-400" /> <span className="text-gray-300">DEF {playerStats.def}</span></div>
                  <div className="flex gap-1.5 items-center"><IconSparkles className="w-3 h-3 text-emerald-400" /> <span className="text-gray-300">SPD {playerStats.spd}</span></div>
                </div>
             </div>
             <div className="flex px-4 pt-4 gap-2 shrink-0">
                <button onClick={() => setInventoryTab('CARDS')} className={`flex-1 py-2 rounded-t-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 border-t border-x ${inventoryTab === 'CARDS' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-transparent border-transparent text-gray-600 hover:bg-white/5 hover:text-gray-400'}`}><IconCards className="w-4 h-4" /> 战斗卡牌 ({inventory.length})</button>
                <button onClick={() => setInventoryTab('MATERIALS')} className={`flex-1 py-2 rounded-t-lg text-xs font-bold transition-colors flex items-center justify-center gap-2 border-t border-x ${inventoryTab === 'MATERIALS' ? 'bg-slate-800 border-slate-700 text-white' : 'bg-transparent border-transparent text-gray-600 hover:bg-white/5 hover:text-gray-400'}`}><IconBox className="w-4 h-4" /> 素材/祭品 ({Object.values(materials).reduce((a, b) => a + b, 0)})</button>
             </div>
             <div className="flex-1 overflow-y-auto bg-slate-800 p-4 border-t border-slate-700">
                {inventoryTab === 'CARDS' ? (
                   inventory.length === 0 ? (
                    <div className="h-full flex flex-col items-center justify-center text-gray-500"><IconCards className="w-12 h-12 mb-2 opacity-20" /><p>暂无卡牌...</p><p className="text-xs opacity-60 mt-1">前往【召唤】界面获取力量</p></div>
                   ) : (
                    <div className="flex flex-wrap justify-center gap-6 pb-20">{inventory.map(card => (<CardComponent key={card.id} card={card} />))}</div>
                   )
                ) : (
                   <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-20">
                      {Object.entries(materials).filter(([_, count]) => count > 0).length === 0 ? (
                         <div className="col-span-2 py-20 text-center text-gray-500"><IconBox className="w-12 h-12 mx-auto mb-2 opacity-20" /><p>行囊空空如也...</p><p className="text-xs opacity-60 mt-1">探索区域或击败敌人可获得祭品</p></div>
                      ) : (
                         Object.entries(materials).filter(([_, count]) => count > 0).map(([id, count]) => {
                            const info = getMaterialInfo(id);
                            if (!info) return null;
                            return (
                               <div key={id} className="bg-slate-900 border border-slate-700 rounded-xl p-3 flex gap-3 items-center shadow-lg relative overflow-hidden group"><div className={`absolute inset-0 bg-gradient-to-r ${ELEMENT_COLORS[info.element]} opacity-5`}></div><div className="w-12 h-12 rounded-lg bg-slate-800 border border-white/10 flex items-center justify-center shrink-0 relative"><IconGem className="w-6 h-6 text-white/80" /><div className="absolute -top-1 -right-1 bg-amber-500 text-black text-[10px] font-bold px-1.5 rounded-full shadow-sm">x{count}</div></div><div className="flex-1 min-w-0"><div className="flex justify-between items-start"><h4 className="text-sm font-bold text-gray-200">{info.name}</h4><span className="text-[9px] px-1.5 py-0.5 rounded bg-slate-800 border border-slate-700 text-gray-500 uppercase tracking-wider">{info.element}</span></div><p className="text-[10px] text-gray-500 mt-1 line-clamp-2">{info.description}</p></div></div>
                            );
                         })
                      )}
                   </div>
                )}
             </div>
          </div>
        )}
        
        {currentView === AppView.PROFILE && (
          <div className="h-full flex flex-col overflow-hidden">
            <div className="p-6 flex-shrink-0 flex flex-col items-center bg-gradient-to-b from-slate-900/50 to-[#0f0e17]">
              <div className="w-20 h-20 bg-gradient-to-br from-orange-500 to-amber-600 rounded-full flex items-center justify-center text-3xl shadow-lg shadow-orange-500/20 mb-4"><IconUser className="w-10 h-10 text-white" /></div>
              <h2 className="text-xl font-bold text-white">旅店老板代理人</h2>
              <p className="text-sm text-gray-500 mb-4">等级 {Math.floor(stardust / 100) + 1}</p>
              <div className="flex bg-slate-800/50 rounded-lg p-1 space-x-1">{(['STATUS', 'BESTIARY', 'RANKING'] as const).map(tab => (<button key={tab} onClick={() => setProfileTab(tab)} className={`px-4 py-2 rounded text-xs font-medium transition-all ${profileTab === tab ? 'bg-orange-600 text-white shadow' : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'}`}>{tab === 'STATUS' ? '状态' : tab === 'BESTIARY' ? '生物档案' : '排行榜'}</button>))}</div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              {profileTab === 'STATUS' && (
                 <div className="max-w-sm mx-auto w-full space-y-6 animate-in fade-in slide-in-from-bottom-4">
                    <div className="grid grid-cols-2 gap-4">
                       <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700"><div className="text-xs text-gray-400 mb-1">HP (生命值)</div><div className="text-2xl font-bold text-red-400">{hp} <span className="text-sm text-gray-500">/ {maxHp}</span></div></div>
                       <div className="bg-slate-800/50 p-4 rounded-xl border border-slate-700"><div className="text-xs text-gray-400 mb-1">SP (体力)</div><div className="text-2xl font-bold text-yellow-400">{sp} <span className="text-sm text-gray-500">/ {maxSp}</span></div></div>
                    </div>
                    <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700">
                      <h3 className="text-sm font-bold text-gray-300 mb-4 border-b border-slate-700 pb-2">基础属性</h3>
                      <div className="space-y-4">
                        <div className="flex items-center justify-between"><span className="text-rose-400 flex items-center gap-2"><IconAlert className="w-4 h-4" /> ATK</span><span className="font-display text-xl">{playerStats.atk}</span></div>
                        <div className="flex items-center justify-between"><span className="text-blue-400 flex items-center gap-2"><IconSparkles className="w-4 h-4" /> DEF</span><span className="font-display text-xl">{playerStats.def}</span></div>
                        <div className="flex items-center justify-between"><span className="text-emerald-400 flex items-center gap-2"><IconSparkles className="w-4 h-4" /> SPD</span><span className="font-display text-xl">{playerStats.spd}</span></div>
                      </div>
                    </div>
                 </div>
              )}
              {profileTab === 'BESTIARY' && (
                 <div className="grid grid-cols-2 gap-4 animate-in fade-in slide-in-from-bottom-4 pb-20">
                   {bestiary.length === 0 ? (<div className="col-span-2 text-center text-gray-500 py-10"><IconBook className="w-12 h-12 mx-auto mb-2 opacity-20" /><p>暂无记录。去探索世界吧！</p></div>) : (bestiary.map((entry) => (<div key={entry.enemyId} className="bg-slate-800 rounded-xl overflow-hidden border border-slate-700 shadow-lg relative group"><div className="h-24 bg-gray-900 relative"><img src={entry.imageUrl} alt={entry.name} className="w-full h-full object-cover opacity-60 group-hover:opacity-100 transition-opacity" /><div className="absolute top-2 right-2 bg-black/60 text-[10px] px-1.5 py-0.5 rounded text-gray-300">{entry.aiType}</div></div><div className="p-3"><h4 className="font-bold text-sm text-white truncate">{entry.name}</h4><p className="text-[10px] text-gray-400 line-clamp-2 h-8 mb-2">{entry.description}</p><div className="flex justify-between text-[10px] text-gray-500 border-t border-slate-700 pt-2"><span>遭遇: {entry.encounterCount}</span><span className="text-red-400">击败: {entry.defeatCount}</span></div></div></div>)))}
                 </div>
              )}
              {profileTab === 'RANKING' && (
                 <div className="space-y-4 animate-in fade-in slide-in-from-bottom-4">
                    <div className="bg-amber-900/20 border border-amber-700/50 rounded-xl p-4 flex items-center gap-4"><div className="text-4xl font-display font-bold text-amber-500">#1</div><div><div className="font-bold text-white">传说中的旅人</div><div className="text-xs text-amber-300">虚空枢纽 - 150000 星尘</div></div></div>
                    {[2, 3, 4, 5].map(rank => (<div key={rank} className="bg-slate-800/40 border border-slate-700/50 rounded-xl p-3 flex items-center gap-4"><div className="text-xl font-display font-bold text-slate-500 w-8 text-center">#{rank}</div><div><div className="text-sm text-gray-300">匿名冒险者 {1000 + rank * 42}</div><div className="text-xs text-gray-500">{Math.floor(100000 / rank)} 星尘</div></div></div>))}
                    <div className="mt-8 pt-4 border-t border-slate-800 text-center"><p className="text-xs text-gray-500 mb-1">你的当前排名</p><div className="bg-slate-800 border border-orange-500/30 rounded-xl p-3 flex items-center gap-4 mx-auto"><div className="text-xl font-display font-bold text-orange-500 w-8 text-center">#99+</div><div className="text-left"><div className="text-sm text-white font-bold">旅店老板代理人</div><div className="text-xs text-gray-400">{stardust} 星尘</div></div></div></div>
                 </div>
              )}
            </div>
          </div>
        )}
      </main>
      <nav className="h-20 border-t border-white/5 bg-[#0f0e17]/90 backdrop-blur-lg flex justify-around items-center pb-4 px-2 z-50 shrink-0">
        <NavItem view={AppView.STORY} icon={<IconBook />} label="冒险" />
        <NavItem view={AppView.FORGE} icon={<IconHexagon />} label="召唤" />
        <NavItem view={AppView.INVENTORY} icon={<IconBackpack />} label="背包" />
        <NavItem view={AppView.PROFILE} icon={<IconUser />} label="档案" />
      </nav>
    </div>
  );
};

export default App;