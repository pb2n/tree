
import React from 'react';
import { Card, Rarity, ElementType } from '../types';
import { RARITY_COLORS, ELEMENT_COLORS } from '../constants';
import { IconFire, IconDroplet, IconLeaf, IconSun, IconGhost, IconHexagon } from './Icons';

interface CardProps {
  card: Card;
  isRevealed?: boolean;
}

const getElementIcon = (element: ElementType, className: string) => {
  switch (element) {
    case ElementType.FIRE: return <IconFire className={className} />;
    case ElementType.WATER: return <IconDroplet className={className} />;
    case ElementType.NATURE: return <IconLeaf className={className} />;
    case ElementType.LIGHT: return <IconSun className={className} />;
    case ElementType.VOID: return <IconGhost className={className} />;
    default: return <IconHexagon className={className} />;
  }
};

export const CardComponent: React.FC<CardProps> = ({ card, isRevealed = true }) => {
  const rarityClass = RARITY_COLORS[card.rarity];
  const elementClass = ELEMENT_COLORS[card.element];
  
  // Calculate Durability Percentage
  const durabilityPercent = (card.currentUsage / card.maxUsage) * 100;

  if (!isRevealed) {
    return (
      <div className="w-72 h-[26rem] bg-slate-900 rounded-xl border-2 border-slate-700 shadow-2xl flex items-center justify-center relative overflow-hidden group">
        <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/wood-pattern.png')] opacity-10 mix-blend-overlay"></div>
        <div className="absolute inset-0 flex items-center justify-center opacity-20">
           <IconHexagon className="w-32 h-32 text-slate-500 animate-pulse" />
        </div>
      </div>
    );
  }

  return (
    <div className={`w-72 h-[28rem] group perspective-1000 relative transition-all duration-500 hover:-translate-y-2`}>
      <div className={`
        relative w-full h-full rounded-xl border-[3px] bg-slate-900 flex flex-col overflow-hidden shadow-2xl
        ${rarityClass} transition-all duration-300
      `}>
        {(card.rarity === Rarity.LEGENDARY || card.rarity === Rarity.MYTHIC) && (
          <div className="absolute inset-0 pointer-events-none card-holofoil z-20 opacity-30"></div>
        )}

        {/* Image Area */}
        <div className="h-1/2 w-full relative overflow-hidden bg-black">
           <img 
            src={card.imageUrl} 
            alt={card.name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
          />
          <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-slate-900 to-transparent"></div>
          
          <div className="absolute top-2 right-2 bg-black/60 backdrop-blur-md px-2 py-1 rounded text-xs font-bold border border-white/10 text-white">
            {card.rarity}
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 p-4 flex flex-col relative z-10">
          <div className="flex justify-between items-start mb-2">
            <div>
              <div className="text-xs text-gray-400 font-serif italic">{card.title}</div>
              <h3 className="text-xl font-bold font-display text-white leading-none">{card.name}</h3>
            </div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center border border-white/10 ${elementClass}`}>
              {getElementIcon(card.element, "w-5 h-5")}
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 my-3">
            <div className="bg-slate-800/50 rounded p-1 text-center border border-slate-700">
              <div className="text-[10px] text-gray-500 uppercase">ATK</div>
              <div className="font-bold text-rose-400">{card.stats.atk}</div>
            </div>
            <div className="bg-slate-800/50 rounded p-1 text-center border border-slate-700">
              <div className="text-[10px] text-gray-500 uppercase">DEF</div>
              <div className="font-bold text-blue-400">{card.stats.def}</div>
            </div>
            <div className="bg-slate-800/50 rounded p-1 text-center border border-slate-700">
              <div className="text-[10px] text-gray-500 uppercase">SPD</div>
              <div className="font-bold text-emerald-400">{card.stats.spd}</div>
            </div>
          </div>

          <div className="text-xs text-gray-300 leading-relaxed mb-2 line-clamp-3">
            {card.description}
          </div>

          {/* Durability Bar */}
          <div className="mt-auto mb-2">
             <div className="flex justify-between text-[10px] text-gray-500 mb-1">
               <span>耐久度</span>
               <span>{card.currentUsage} / {card.maxUsage}</span>
             </div>
             <div className="w-full h-1 bg-slate-800 rounded-full overflow-hidden">
                <div 
                  className={`h-full rounded-full ${durabilityPercent < 30 ? 'bg-red-500' : 'bg-indigo-500'}`}
                  style={{ width: `${durabilityPercent}%` }}
                />
             </div>
          </div>

          <div className="pt-2 border-t border-slate-800">
            <p className="text-[10px] text-gray-500 italic font-serif">"{card.lore}"</p>
          </div>
        </div>
      </div>
    </div>
  );
};
