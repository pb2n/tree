
import React, { useState } from 'react';
import { Card } from '../types';
import { CardComponent } from './CardComponent';
import { Button } from './Button';
import { IconSparkles, IconGem, IconEnergy } from './Icons';
import { BIOME_MATERIALS } from '../constants';

interface CardForgeProps {
  stardust: number;
  cost: number;
  materials: Record<string, number>;
  status: 'idle' | 'generating_data' | 'generating_image';
  generatedCard: Card | null;
  error: string;
  onForge: (prompt: string, materialId: string) => void;
  onClaim: () => void;
  onDiscard: () => void;
  sp: number;
  spCost: number;
}

export const CardForge: React.FC<CardForgeProps> = ({ 
  stardust, 
  cost, 
  materials,
  status, 
  generatedCard, 
  error, 
  onForge, 
  onClaim, 
  onDiscard,
  sp,
  spCost
}) => {
  const [prompt, setPrompt] = useState('');
  const [selectedMaterialId, setSelectedMaterialId] = useState<string | null>(null);
  
  const isLoading = status !== 'idle';
  const availableMaterials = Object.values(BIOME_MATERIALS).filter(m => (materials[m.id] || 0) > 0);
  const totalMaterials = availableMaterials.reduce((acc, m) => acc + (materials[m.id] || 0), 0);

  return (
    <div className="h-full flex flex-col items-center justify-center p-6 overflow-y-auto">
      {!generatedCard ? (
        <div className="w-full max-w-md flex flex-col items-center gap-6 animate-float">
          <div className="text-center space-y-2">
            <h2 className="text-3xl font-display text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
              异界召唤
            </h2>
            <p className="text-gray-400 text-sm flex items-center justify-center gap-3">
               <span className="flex items-center gap-1 text-yellow-400 font-bold"><IconSparkles className="w-3 h-3" /> {cost}</span>
               <span className="flex items-center gap-1 text-emerald-400 font-bold"><IconGem className="w-3 h-3" /> 1</span>
               <span className="flex items-center gap-1 text-yellow-200 font-bold"><IconEnergy className="w-3 h-3" /> {spCost} SP</span>
            </p>
            <div className="flex gap-3 justify-center text-xs text-gray-500">
               <span>星尘: {stardust}</span>
               <span>体力: {sp}</span>
               <span>祭品: {totalMaterials}</span>
            </div>
          </div>

          <div className="w-full space-y-4 relative">
            {isLoading && (
              <div className="absolute inset-0 z-10 bg-black/60 backdrop-blur-sm rounded-lg flex flex-col items-center justify-center text-center p-4">
                 <div className="w-12 h-12 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mb-3"></div>
                 <p className="text-indigo-300 font-medium animate-pulse">
                   {status === 'generating_data' ? '正在构筑灵魂...' : '正在绘制卡面...'}
                 </p>
                 <p className="text-xs text-gray-500 mt-2">您可以切换到其他界面，召唤不会中断</p>
              </div>
            )}
            
            <div className="space-y-2">
              <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">1. 选择祭品</label>
              {availableMaterials.length === 0 ? (
                <div className="bg-slate-800/50 border border-red-900/50 rounded-lg p-4 text-center text-gray-500 text-sm">
                   <IconGem className="w-6 h-6 mx-auto mb-2 opacity-30" />
                   暂无祭品，请前往冒险探索获得。
                </div>
              ) : (
                <div className="grid grid-cols-3 gap-2">
                  {availableMaterials.map(mat => (
                    <button
                      key={mat.id}
                      onClick={() => setSelectedMaterialId(mat.id)}
                      className={`relative p-2 rounded-lg border text-left transition-all flex flex-col gap-1 ${
                         selectedMaterialId === mat.id 
                         ? 'bg-indigo-900/40 border-indigo-500 shadow-lg shadow-indigo-500/20' 
                         : 'bg-slate-800/50 border-slate-700 hover:border-indigo-500/50'
                      }`}
                    >
                      <div className="flex justify-between items-start">
                         <IconGem className={`w-4 h-4 ${selectedMaterialId === mat.id ? 'text-emerald-400' : 'text-gray-500'}`} />
                         <span className="text-[10px] bg-black/40 px-1.5 rounded text-white font-mono">x{materials[mat.id]}</span>
                      </div>
                      <div className="text-xs font-medium text-gray-200 truncate">{mat.name}</div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <label className="text-xs text-gray-400 font-bold uppercase tracking-wider">2. 祈愿咒语 (可选)</label>
              <input
                type="text"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
                placeholder="例如：赛博朋克武士、火焰巨龙..."
                disabled={isLoading}
                className="w-full bg-black/50 backdrop-blur-md border border-indigo-500/30 rounded-lg px-4 py-3 text-white focus:outline-none focus:border-indigo-500 transition-all placeholder-gray-600 disabled:opacity-50 text-sm"
              />
            </div>

            <Button 
              onClick={() => selectedMaterialId && onForge(prompt, selectedMaterialId)} 
              isLoading={isLoading}
              disabled={stardust < cost || sp < spCost || !selectedMaterialId}
              className={`w-full py-3 text-lg ${(stardust < cost || sp < spCost || !selectedMaterialId) ? 'opacity-50 grayscale' : ''}`}
            >
              {isLoading ? '召唤进行中...' : '开始召唤'}
            </Button>
            
            {error && <p className="text-red-400 text-center text-sm">{error}</p>}
          </div>

          {!isLoading && (
            <div className="flex flex-wrap gap-2 justify-center">
              {['暗影刺客', '发光蘑菇', '时间法师', '机械战警'].map(tag => (
                <button key={tag} onClick={() => setPrompt(tag)} className="px-3 py-1 rounded-full bg-slate-800 text-xs text-gray-400 border border-slate-700 hover:border-indigo-500 hover:text-indigo-300 transition-colors">
                  {tag}
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-6 animate-sparkle">
          <div className="relative">
            <div className="absolute inset-0 bg-gradient-to-r from-indigo-500 to-purple-500 blur-2xl opacity-40 animate-pulse-glow"></div>
            <CardComponent card={generatedCard} />
          </div>
          <div className="flex gap-4">
             <Button variant="secondary" onClick={onDiscard}>再次召唤</Button>
             <Button onClick={onClaim}>收入行囊</Button>
          </div>
        </div>
      )}
    </div>
  );
};
