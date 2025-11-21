
import React, { useState, useEffect, useRef } from 'react';
import { ChatMessage, PlayerStats, Card, Enemy, Biome, EnemyIntent } from '../types';
import { generateStoryResponse } from '../services/geminiService';
import { Button } from './Button';
import { DiceOverlay } from './DiceOverlay';
import { FloatingTextOverlay, FloatingTextItem } from './FloatingText';
import { audio } from '../services/audioService';
import { IconSword, IconShield, IconZap, IconDice, IconSquirrel, IconHeart, IconStar, IconMap, IconTreasure, IconAlert, IconEnergy } from './Icons';
import { RARITY_SP_COST } from '../constants';

interface StoryViewProps {
  messages: ChatMessage[];
  setMessages: React.Dispatch<React.SetStateAction<ChatMessage[]>>;
  playerStats: PlayerStats;
  activeEnemy: Enemy | null;
  currentBiome: Biome;
  explorationProgress: number;
  onAddStardust: () => void;
  onTakeDamage: (val: number) => void;
  onConsumeCard: (id: string) => boolean; 
  onRest: () => void;
  onExplore: () => void;
  onCombatRound: (enemy: Enemy, dmgDealt: number, dmgTaken: number) => { isVictory: boolean };
  stardust: number;
  restCost: number;
  checkSp: (cost: number) => boolean;
  deductSp: (amt: number) => void;
}

export const StoryView: React.FC<StoryViewProps> = ({ 
  messages, 
  setMessages, 
  playerStats, 
  activeEnemy,
  currentBiome,
  explorationProgress,
  onAddStardust,
  onTakeDamage,
  onConsumeCard,
  onRest,
  onExplore,
  onCombatRound,
  stardust,
  restCost,
  checkSp,
  deductSp
}) => {
  const [inputText, setInputText] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [showActions, setShowActions] = useState(false);
  const [activeRoll, setActiveRoll] = useState<'ATK' | 'DEF' | 'SPD' | null>(null);
  const [isExploring, setIsExploring] = useState(false);

  const [floatingTexts, setFloatingTexts] = useState<FloatingTextItem[]>([]);
  const [screenShake, setScreenShake] = useState(false);
  const [enemyShake, setEnemyShake] = useState(false);
  const [enemyFlash, setEnemyFlash] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping, activeEnemy]);

  const addFloatingText = (text: string, type: FloatingTextItem['type'], target: 'player' | 'enemy') => {
    const id = Date.now().toString() + Math.random();
    const x = target === 'enemy' ? 50 + (Math.random() * 20 - 10) : 50 + (Math.random() * 20 - 10);
    const y = target === 'enemy' ? 30 + (Math.random() * 10 - 5) : 60 + (Math.random() * 10 - 5);
    setFloatingTexts(prev => [...prev, { id, text, x, y, type }]);
    setTimeout(() => setFloatingTexts(prev => prev.filter(item => item.id !== id)), 1500);
  };

  const triggerScreenShake = () => {
    setScreenShake(true);
    setTimeout(() => setScreenShake(false), 500);
  };

  const triggerEnemyHitEffect = (isCrit: boolean) => {
    setEnemyShake(true);
    setEnemyFlash(true);
    if (isCrit) audio.sfxCrit();
    else audio.sfxHit();
    setTimeout(() => { setEnemyShake(false); setEnemyFlash(false); }, 500);
  };

  const getCardStatus = (card: Card | null) => {
    if (!card) return { isReady: false, cooldownRemaining: 0, cost: 0 };
    const remaining = card.cooldownUntil ? Math.max(0, card.cooldownUntil - Date.now()) : 0;
    const cost = RARITY_SP_COST[card.rarity] || 0;
    return { isReady: remaining === 0, cooldownRemaining: remaining, cost };
  };

  const handleSend = async () => {
    if (!inputText.trim() || isTyping) return;
    if (!checkSp(10)) return; // Chat Cost
    
    audio.sfxSelect();
    deductSp(10);

    const userMsg: ChatMessage = { role: 'user', text: inputText, timestamp: Date.now() };
    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setIsTyping(true);
    onAddStardust();

    const responseText = await generateStoryResponse(messages, userMsg.text);
    
    const aiMsg: ChatMessage = { role: 'model', text: responseText, timestamp: Date.now() };
    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  };

  const handleExploreClick = async () => {
    if (activeEnemy || isExploring) return;
    if (!checkSp(15)) return; 
    
    audio.sfxSelect();
    setIsExploring(true);
    setShowActions(false);
    try {
      await onExplore();
    } finally {
      setIsExploring(false);
    }
  };

  const handleRestClick = () => {
    if (stardust < restCost) {
       audio.sfxError();
       addFloatingText("No Stardust", "miss", "player");
       return;
    }
    audio.sfxHeal();
    addFloatingText("+HP +SP", "heal", "player");
    onRest();
    setShowActions(false);
  }

  const handleActionClick = (type: 'ATK' | 'DEF' | 'SPD') => {
    const card = playerStats.bestCards[type.toLowerCase() as keyof typeof playerStats.bestCards] as Card | null;
    const { isReady, cost } = getCardStatus(card);
    const totalCost = 10 + (isReady ? cost : 0); // Base 10 + Card Cost

    if (!checkSp(totalCost)) return;
    audio.sfxHover();
    setActiveRoll(type);
  }

  const handleRollComplete = async (total: number, rawRoll: number) => {
    if (!activeRoll) return;
    
    const type = activeRoll;
    const card = playerStats.bestCards[type.toLowerCase() as keyof typeof playerStats.bestCards] as Card | null;
    const { isReady, cost } = getCardStatus(card);
    const totalCost = 10 + (isReady ? cost : 0);

    deductSp(totalCost); // Deduct the calculated cost
    
    setActiveRoll(null); 
    setShowActions(false);

    const effectiveCard = isReady ? card : null; // Only use card if ready

    let sysText = '';
    let prompt = '';
    
    if (activeEnemy) {
      let damageDealt = 0;
      let damageTaken = 0;
      let combatDesc = '';
      let isCrit = total >= 20;
      const enemyAction = activeEnemy.nextIntent || EnemyIntent.ATTACK;

      if (type === 'ATK') {
        audio.sfxAttack(); 
        const diff = total - activeEnemy.stats.def;
        if (diff > 0) {
           damageDealt = Math.floor(diff * 1.5) + 5;
           if (enemyAction === EnemyIntent.DEFEND) {
              damageDealt = Math.floor(damageDealt * 0.5);
              combatDesc = `敌人防御了你的攻击！造成 ${damageDealt} 点伤害。`;
              setTimeout(() => { audio.sfxBlock(); addFloatingText("BLOCK", "block", "enemy"); }, 200);
           } else {
              combatDesc = `攻击命中！造成 ${damageDealt} 点伤害。`;
              setTimeout(() => { triggerEnemyHitEffect(isCrit); addFloatingText(`-${damageDealt}`, isCrit ? "crit" : "damage", "enemy"); }, 300);
           }
        } else {
           combatDesc = `攻击被格挡！`;
           setTimeout(() => { audio.sfxBlock(); addFloatingText("MISS", "miss", "enemy"); }, 300);
        }
        if (enemyAction === EnemyIntent.ATTACK) {
           damageTaken = Math.max(0, activeEnemy.stats.atk - playerStats.def);
           if (damageTaken > 0) combatDesc += ` 受到反击 -${damageTaken} HP。`;
        } else if (enemyAction === EnemyIntent.CHARGE) {
           combatDesc += ` 敌人正在蓄力，没有反击！`;
        }
      } else if (type === 'DEF') {
        audio.sfxBlock();
        const diff = total - activeEnemy.stats.atk;
        if (enemyAction === EnemyIntent.ATTACK) {
           if (diff >= 0) {
              combatDesc = `完美防御！未受伤害。`;
              addFloatingText("BLOCK", "block", "player");
           } else {
              damageTaken = Math.abs(diff); 
              combatDesc = `防御勉强支撑，受到 -${damageTaken} HP。`;
           }
        } else if (enemyAction === EnemyIntent.CHARGE) {
           combatDesc = `你摆出了防御架势，但敌人正在蓄力！`;
        } else {
           combatDesc = `双方都在寻找破绽...`;
        }
      } else if (type === 'SPD') {
         audio.sfxDodge();
         const dodgeThreshold = enemyAction === EnemyIntent.CHARGE ? activeEnemy.stats.spd + 5 : activeEnemy.stats.spd;
         if (total > dodgeThreshold) {
            combatDesc = `灵巧地闪避了攻击！`;
            addFloatingText("DODGE", "heal", "player");
         } else {
            if (enemyAction === EnemyIntent.CHARGE) {
               damageTaken = activeEnemy.stats.atk * 2; 
               combatDesc = `闪避蓄力攻击失败！！受到重创 -${damageTaken} HP。`;
            } else if (enemyAction === EnemyIntent.ATTACK) {
               damageTaken = activeEnemy.stats.atk;
               combatDesc = `闪避失败！被击中 -${damageTaken} HP。`;
            } else {
               combatDesc = `你快速移动调整了位置。`;
            }
         }
      }

      if (damageTaken > 0) {
         setTimeout(() => { triggerScreenShake(); audio.sfxHit(); addFloatingText(`-${damageTaken}`, "damage", "player"); }, 600);
      }

      let cardBroke = false;
      if (effectiveCard) cardBroke = onConsumeCard(effectiveCard.id);

      const roundResult = onCombatRound(activeEnemy, damageDealt, damageTaken);

      sysText = `[战斗] ${type}检定: ${total} (vs ${activeEnemy.name})。${combatDesc}`;
      if (effectiveCard && cardBroke) sysText += ` 卡牌【${effectiveCard.name}】碎裂了！`;
      if (roundResult.isVictory) {
        sysText += ` [击败敌人] 获得 ${activeEnemy.rewardStardust} 星尘！`;
        setTimeout(() => audio.sfxLevelUp(), 1000);
      }

      prompt = `我正在与【${activeEnemy.name}】战斗。我进行了${type}行动，检定结果${total}。${combatDesc}`;
      if (roundResult.isVictory) prompt += ` 我给予了它最后一击，它消散了。请描写胜利的场景。`;
      if (effectiveCard && cardBroke) prompt += ` 我的卡牌【${effectiveCard.name}】碎裂了。`;
      prompt += " 请描写战斗过程。";
      
      const userMsg: ChatMessage = { 
        role: 'system', 
        text: sysText, 
        timestamp: Date.now(),
        meta: { isRoll: true, rollType: type, rollValue: rawRoll, totalValue: total, usedCardName: effectiveCard?.name, damageTaken, damageDealt, enemyName: activeEnemy.name, isVictory: roundResult.isVictory }
      };
      setMessages(prev => [...prev, userMsg]);

    } else {
      let isSuccess = false;
      let damageTaken = 0;
      let cardBroke = false;

      if (total < 5) damageTaken = 25;
      else if (total < 10) damageTaken = 10;
      else isSuccess = true;

      if (damageTaken > 0) {
         onTakeDamage(damageTaken);
         triggerScreenShake();
         audio.sfxHit();
         addFloatingText(`-${damageTaken}`, "damage", "player");
      }
      
      if (effectiveCard) cardBroke = onConsumeCard(effectiveCard.id);
      const resultDesc = total > 20 ? "大成功" : total > 15 ? "成功" : total < 10 ? "失败" : "勉强";
      sysText = `[系统] 检定【${type}】: ${total}。结果: ${resultDesc}。`;
      if (damageTaken > 0) sysText += ` 受到伤害 -${damageTaken} HP。`;
      if (effectiveCard && cardBroke) sysText += ` 卡牌【${effectiveCard.name}】碎裂了！`;

      prompt = `我进行了${type}检定，点数${total}（${resultDesc}）。`;
      if (damageTaken > 0) prompt += ` 失败导致受到了${damageTaken}点伤害。`;
      prompt += " 请继续剧情。";

      const userMsg: ChatMessage = { 
        role: 'system', 
        text: sysText, 
        timestamp: Date.now(),
        meta: { isRoll: true, rollType: type, rollValue: rawRoll, totalValue: total, usedCardName: effectiveCard?.name, damageTaken, cardBroke }
      };
      setMessages(prev => [...prev, userMsg]);
      if (isSuccess) onAddStardust();
    }

    setIsTyping(true);
    const responseText = await generateStoryResponse([...messages], prompt);
    const aiMsg: ChatMessage = { role: 'model', text: responseText, timestamp: Date.now() };
    setMessages(prev => [...prev, aiMsg]);
    setIsTyping(false);
  };

  const ActionButton = ({ type, icon, value, card, label }: { type: string, icon: React.ReactNode, value: number, card: Card | null, label: string }) => {
    const { isReady, cooldownRemaining, cost } = getCardStatus(card);
    const cooldownSec = Math.ceil(cooldownRemaining / 1000);
    const totalCost = 10 + (isReady ? cost : 0);

    return (
      <button 
        onClick={() => handleActionClick(type as any)}
        className="flex flex-col items-center gap-2 bg-slate-800/90 hover:bg-slate-700 border border-slate-600 p-3 rounded-xl transition-all active:scale-95 w-full shadow-lg relative overflow-hidden"
      >
        <div className="flex items-center gap-2 relative z-10">
          <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg bg-slate-900 border border-slate-700 text-slate-400 shadow-inner`}>
            {icon}
          </div>
          <div className="text-left">
            <div className="font-bold text-sm text-slate-200">{label}</div>
            <div className="text-[10px] text-slate-400 flex items-center gap-1">
              <span className={!isReady && card ? 'text-gray-500' : 'text-white'}>加成 +{isReady || !card ? value : '0'}</span>
              <span className="text-yellow-400">| {totalCost} SP</span>
            </div>
          </div>
        </div>
        
        {card ? (
          <div className="w-full bg-slate-900/50 rounded px-2 py-1 flex items-center gap-2 border border-slate-700/50 relative overflow-hidden">
            {/* Cooldown Overlay */}
            {!isReady && (
               <div className="absolute inset-0 bg-black/80 z-20 flex items-center justify-center text-[10px] text-white font-mono">
                 冷却中 {cooldownSec}s
               </div>
            )}
            <div className={`w-4 h-4 rounded bg-cover bg-center ${!isReady ? 'grayscale opacity-50' : ''}`} style={{ backgroundImage: `url(${card.imageUrl})`}}></div>
            <div className="flex-1 overflow-hidden">
               <div className={`text-[10px] truncate ${!isReady ? 'text-gray-500' : 'text-indigo-300'}`}>{card.name}</div>
            </div>
          </div>
        ) : (
           <div className="w-full bg-slate-900/50 rounded px-2 py-1 text-[10px] text-gray-600 italic text-center">
             无卡牌
           </div>
        )}
      </button>
    );
  };

  const ProgressBar = ({ current, max, color, icon }: { current: number, max: number, color: string, icon: any }) => (
    <div className="flex items-center gap-2 w-28 transition-all">
       {icon}
       <div className="flex-1 h-1.5 bg-slate-800 rounded-full overflow-hidden border border-slate-700 shadow-inner">
         <div 
           className={`h-full transition-all duration-500 ${color}`} 
           style={{ width: `${Math.max(0, Math.min(100, (current / max) * 100))}%` }} 
         />
       </div>
    </div>
  );

  return (
    <div className={`flex flex-col h-full relative bg-[#0f0e17] ${screenShake ? 'animate-shake' : ''}`}>
      {activeRoll && (
        <DiceOverlay 
          statType={activeRoll} 
          statValue={getCardStatus(playerStats.bestCards[activeRoll.toLowerCase() as keyof typeof playerStats.bestCards] as Card).isReady 
             ? playerStats[activeRoll.toLowerCase() as 'atk' | 'def' | 'spd']
             : (playerStats[activeRoll.toLowerCase() as 'atk' | 'def' | 'spd'] - (playerStats.bestCards[activeRoll.toLowerCase() as keyof typeof playerStats.bestCards]?.stats[activeRoll.toLowerCase() as 'atk' | 'def' | 'spd'] || 0))
          } 
          onComplete={handleRollComplete}
          onClose={() => setActiveRoll(null)}
        />
      )}
      <FloatingTextOverlay items={floatingTexts} />

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[60%] h-[60%] bg-orange-900/10 blur-[120px] rounded-full mix-blend-screen animate-float"></div>
        <div className="absolute bottom-[-10%] right-[-10%] w-[60%] h-[60%] bg-indigo-900/10 blur-[120px] rounded-full mix-blend-screen animate-float" style={{ animationDelay: '-3s' }}></div>
        {activeEnemy && <div className="absolute inset-0 bg-red-900/10 animate-pulse pointer-events-none"></div>}
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/stardust.png')] opacity-5"></div>
      </div>

      <div className="absolute top-0 left-0 right-0 z-30 pointer-events-none">
        <div className="w-full h-16 bg-gradient-to-b from-black/80 to-transparent px-4 pt-1 flex items-center justify-between border-b border-white/5">
           <div className="flex items-center gap-2 opacity-80">
              <IconMap className="w-4 h-4 text-emerald-400" />
              <div className="flex flex-col">
                <span className="text-xs font-bold text-emerald-200 tracking-wider">{currentBiome.name}</span>
                <div className="w-24 h-1 bg-slate-800 rounded-full mt-0.5 overflow-hidden">
                  <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${explorationProgress}%` }} />
                </div>
              </div>
           </div>
           
           <div className="flex flex-col gap-1 items-end">
             <ProgressBar current={playerStats.hp} max={playerStats.maxHp} color="bg-rose-500" icon={<IconHeart className="w-3 h-3 text-rose-400" />} />
             <ProgressBar current={playerStats.sp} max={playerStats.maxSp} color="bg-yellow-500" icon={<IconEnergy className="w-3 h-3 text-yellow-400" />} />
           </div>
        </div>
      </div>

      {activeEnemy && (
        <div className={`absolute top-20 left-4 right-4 z-20 animate-in slide-in-from-top-4 duration-500 ${enemyShake ? 'animate-shake' : ''}`}>
           <div className={`bg-slate-900/90 backdrop-blur-md border border-red-900/50 rounded-xl p-3 shadow-2xl flex items-center gap-3 relative overflow-hidden ${enemyFlash ? 'animate-hit-flash' : ''}`}>
              <div className="absolute inset-0 bg-gradient-to-r from-red-900/20 to-transparent pointer-events-none"></div>
              <div className="w-16 h-16 rounded-lg bg-slate-800 border border-red-700/50 flex-shrink-0 overflow-hidden relative">
                 <img src={activeEnemy.imageUrl} alt="Enemy" className="w-full h-full object-cover" />
                 {enemyFlash && <div className="absolute inset-0 bg-white/50 mix-blend-overlay"></div>}
              </div>
              <div className="flex-1 min-w-0">
                 <div className="flex justify-between items-end mb-1">
                    <h3 className="font-display font-bold text-red-200 text-lg truncate">{activeEnemy.name}</h3>
                    <div className="flex gap-1">
                      <div className="bg-black/50 px-2 py-0.5 rounded text-[10px] border border-white/10 text-gray-300 uppercase tracking-wide">
                        AI: {activeEnemy.aiType}
                      </div>
                      <div className="bg-black/50 px-2 py-0.5 rounded text-[10px] border border-red-500/30 text-red-300 flex items-center gap-1 animate-pulse">
                        {activeEnemy.nextIntent === EnemyIntent.ATTACK && <><IconSword className="w-3 h-3" /> 准备攻击</>}
                        {activeEnemy.nextIntent === EnemyIntent.DEFEND && <><IconShield className="w-3 h-3" /> 防御姿态</>}
                        {activeEnemy.nextIntent === EnemyIntent.CHARGE && <><IconAlert className="w-3 h-3 text-yellow-400" /> 正在蓄力!</>}
                      </div>
                    </div>
                 </div>
                 <div className="h-3 bg-slate-800 rounded-full overflow-hidden border border-slate-700">
                    <div className="h-full bg-red-600 transition-all duration-300" style={{ width: `${(activeEnemy.hp / activeEnemy.maxHp) * 100}%` }} />
                 </div>
                 <div className="flex gap-3 mt-1 text-[10px] text-gray-400">
                    <span className="flex items-center gap-0.5"><IconSword className="w-3 h-3" /> {activeEnemy.stats.atk}</span>
                    <span className="flex items-center gap-0.5"><IconShield className="w-3 h-3" /> {activeEnemy.stats.def}</span>
                    <span className="flex items-center gap-0.5"><IconZap className="w-3 h-3" /> {activeEnemy.stats.spd}</span>
                 </div>
              </div>
           </div>
        </div>
      )}

      <div ref={scrollContainerRef} className={`flex-1 overflow-y-auto p-4 pt-20 space-y-6 pb-44 scroll-smooth overscroll-y-contain ${activeEnemy ? 'pt-40' : ''}`} style={{ WebkitOverflowScrolling: 'touch' }}>
        {messages.map((msg, idx) => {
          const isModel = msg.role === 'model';
          const isSystem = msg.role === 'system';
          if (isSystem) {
            const isCombatLog = msg.meta?.eventType === 'COMBAT' || msg.text.includes('造成') || msg.text.includes('受到伤害') || msg.text.includes('露营遇袭');
            const isTreasure = msg.meta?.eventType === 'TREASURE';
            return (
              <div key={idx} className="flex flex-col items-center my-4 opacity-90 gap-1 animate-in fade-in zoom-in-95">
                <div className={`backdrop-blur border px-4 py-2 rounded-full text-xs font-mono flex items-center gap-2 shadow-lg text-center leading-tight max-w-[95%] ${isCombatLog ? 'bg-red-900/40 border-red-700 text-red-200' : isTreasure ? 'bg-yellow-900/40 border-yellow-700 text-yellow-200' : 'bg-black/40 border-slate-700/50 text-slate-300'}`}>
                  {isCombatLog ? <IconSword className="w-4 h-4" /> : isTreasure ? <IconTreasure className="w-4 h-4" /> : <IconDice className="w-4 h-4" />}
                  {msg.text.replace(/^\[.*?\]\s*/, '')}
                </div>
              </div>
            );
          }
          return (
            <div key={idx} className={`flex w-full ${isModel ? 'justify-start' : 'justify-end'} group animate-in fade-in slide-in-from-bottom-2 duration-500`}>
              {isModel && (
                <div className="flex-shrink-0 mr-3 flex flex-col items-center gap-1 mt-1">
                  <div className="w-10 h-10 rounded-full bg-gradient-to-br from-orange-400 to-amber-600 p-[2px] shadow-lg shadow-orange-500/20">
                    <div className="w-full h-full rounded-full bg-slate-900 flex items-center justify-center overflow-hidden">
                       <IconSquirrel className="w-6 h-6 text-orange-200" />
                    </div>
                  </div>
                </div>
              )}
              <div className={`flex flex-col max-w-[85%] ${isModel ? 'items-start' : 'items-end'}`}>
                <span className={`text-[10px] uppercase tracking-wider font-bold mb-1 opacity-0 group-hover:opacity-70 transition-opacity px-1 ${isModel ? 'text-orange-400' : 'text-indigo-400'}`}>{isModel ? 'Hana' : 'Traveler'}</span>
                <div className={`relative px-5 py-3 text-sm leading-relaxed shadow-md transition-all duration-300 ${isModel ? 'bg-slate-800/80 backdrop-blur-md border border-slate-700/50 text-slate-200 rounded-2xl rounded-tl-none font-serif' : 'bg-gradient-to-br from-indigo-600 to-violet-700 text-white rounded-2xl rounded-tr-none font-sans shadow-indigo-500/10'}`}>{msg.text}</div>
              </div>
            </div>
          );
        })}
        {isTyping && (
           <div className="flex w-full justify-start animate-in fade-in duration-300">
             <div className="flex-shrink-0 mr-3 w-10" />
             <div className="bg-slate-800/50 border border-slate-700/50 rounded-2xl rounded-tl-none px-4 py-3 flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-orange-400/80 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-1.5 h-1.5 bg-orange-400/80 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-1.5 h-1.5 bg-orange-400/80 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
             </div>
          </div>
        )}
        <div ref={messagesEndRef} className="h-1" />
      </div>

      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-[#0f0e17] via-[#0f0e17] to-transparent z-20 backdrop-blur-[2px]">
        <div className="px-4 pb-2 flex gap-2 justify-center pointer-events-auto">
           <button onClick={() => { audio.sfxSelect(); setShowActions(!showActions); }} className={`px-6 py-2 rounded-t-xl text-xs font-bold transition-all border-t border-x border-slate-700/50 flex items-center gap-2 shadow-lg ${showActions ? 'bg-slate-800 text-orange-400 translate-y-1' : activeEnemy ? 'bg-red-900/80 text-white animate-pulse' : 'bg-slate-900/80 text-gray-300 hover:bg-slate-800'}`}>
             {activeEnemy ? <IconSword className="w-4 h-4" /> : <IconMap className="w-4 h-4" />}
             {activeEnemy ? "战斗指令" : "区域探索"}
           </button>
        </div>

        {showActions && (
          <div className="px-4 pb-4 animate-in slide-in-from-bottom-4">
             <div className={`bg-slate-900/95 border rounded-xl p-4 shadow-2xl relative overflow-hidden ${activeEnemy ? 'border-red-900/50' : 'border-slate-700'}`}>
                {activeEnemy && <div className="absolute inset-0 bg-red-500/5 pointer-events-none animate-pulse"></div>}
                
                <div className="grid grid-cols-3 gap-3 mb-2 relative z-10">
                  <ActionButton type="ATK" label={activeEnemy ? "攻击" : "力量检定"} icon={<IconSword className="w-5 h-5" />} value={playerStats.atk} card={playerStats.bestCards.atk} />
                  <ActionButton type="DEF" label={activeEnemy ? "防御" : "体质检定"} icon={<IconShield className="w-5 h-5" />} value={playerStats.def} card={playerStats.bestCards.def} />
                  <ActionButton type="SPD" label={activeEnemy ? "闪避" : "敏捷检定"} icon={<IconZap className="w-5 h-5" />} value={playerStats.spd} card={playerStats.bestCards.spd} />
                </div>
                
                <div className="grid grid-cols-2 gap-3 mt-2 relative z-10">
                  <button onClick={handleRestClick} disabled={!!activeEnemy || stardust < restCost} className={`relative w-full py-3 border rounded-lg text-xs font-medium transition-all flex flex-col items-center justify-center gap-1 ${activeEnemy || stardust < restCost ? 'opacity-50 cursor-not-allowed border-slate-800 text-slate-600' : 'bg-emerald-900/30 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/50'}`}>
                     <div className="flex items-center gap-2"><IconHeart className="w-3 h-3" /> 露营休息</div>
                     <div className="text-[10px] opacity-80 flex items-center gap-1"><span className={stardust < restCost ? "text-red-400" : "text-yellow-200"}>-{restCost} ✨</span><span className="text-red-300">| 有几率遇袭</span></div>
                  </button>
                  <button onClick={handleExploreClick} disabled={!!activeEnemy || isExploring} className={`w-full py-3 border rounded-lg text-xs font-medium transition-all flex flex-col items-center justify-center gap-1 ${activeEnemy ? 'opacity-50 cursor-not-allowed border-slate-800 text-slate-600' : 'bg-indigo-900/30 border-indigo-700/50 text-indigo-300 hover:bg-indigo-900/50'}`}>
                     {isExploring ? <span className="animate-pulse">探索中...</span> : <><div className="flex items-center gap-2"><IconMap className="w-3 h-3" /> 继续探索</div><div className="text-[10px] text-yellow-200 opacity-80 flex items-center gap-1"><IconEnergy className="w-2 h-2"/> -15 SP</div></>}
                  </button>
                </div>
             </div>
          </div>
        )}

        <div className="max-w-3xl mx-auto relative p-4 pt-0">
          <div className="flex gap-3 items-end">
            <div className="flex-1 bg-slate-900/90 border border-slate-700/80 rounded-xl shadow-2xl overflow-hidden focus-within:border-orange-500/50 focus-within:ring-1 focus-within:ring-orange-500/20 transition-all">
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSend(); } }}
                placeholder={activeEnemy ? "描述你的战斗动作... (-10 SP)" : "和哈娜对话，或描述行动... (-10 SP)"}
                className="w-full bg-transparent border-none px-4 py-3 text-slate-200 focus:ring-0 resize-none max-h-32 min-h-[3rem] placeholder:text-slate-600 text-sm"
                rows={1}
                style={{ height: 'auto', minHeight: '50px' }}
              />
            </div>
            <Button onClick={handleSend} disabled={isTyping || !inputText.trim()} className="h-[50px] w-[50px] !p-0 rounded-xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-indigo-500/20">
              <span className="text-lg transform -rotate-45 translate-x-0.5 -translate-y-0.5">➤</span>
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
