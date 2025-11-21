
import React, { useEffect, useState, useRef } from 'react';
import { audio } from '../services/audioService';
import { IconSparkles, IconSkull } from './Icons';

interface DiceOverlayProps {
  statType: 'ATK' | 'DEF' | 'SPD';
  statValue: number;
  onComplete: (total: number, roll: number) => void;
  onClose: () => void;
}

export const DiceOverlay: React.FC<DiceOverlayProps> = ({ statType, statValue, onComplete, onClose }) => {
  const [displayNumber, setDisplayNumber] = useState(1);
  const [phase, setPhase] = useState<'rolling' | 'slowing' | 'result'>('rolling');
  const [finalResult, setFinalResult] = useState<{roll: number, total: number} | null>(null);
  
  // Refs for animation control
  const timeouts = useRef<NodeJS.Timeout[]>([]);

  useEffect(() => {
    // 1. Pre-calculate Fate
    const actualRoll = Math.floor(Math.random() * 20) + 1;
    const total = actualRoll + statValue;
    
    // Play initial sound
    audio.sfxRoll();

    // 2. Rolling Sequence Logic
    let currentDelay = 50; // Start very fast
    let iterations = 0;
    const maxIterationsBeforeSlowing = 15;
    
    const rollStep = () => {
      // Visual chaos: pick random number
      setDisplayNumber(Math.floor(Math.random() * 20) + 1);
      
      iterations++;
      
      if (iterations < maxIterationsBeforeSlowing) {
        // Constant fast speed phase
        const id = setTimeout(rollStep, 50);
        timeouts.current.push(id);
      } else {
        // Slowing down phase
        if (phase !== 'slowing') setPhase('slowing');
        
        // Exponential decay of speed (increase delay)
        currentDelay = Math.floor(currentDelay * 1.2);
        
        if (currentDelay > 400) {
          // STOP
          finalize(actualRoll, total);
        } else {
          const id = setTimeout(rollStep, currentDelay);
          timeouts.current.push(id);
        }
      }
    };

    // Start rolling
    rollStep();

    return () => {
      timeouts.current.forEach(clearTimeout);
    };
  }, []);

  const finalize = (roll: number, total: number) => {
    setDisplayNumber(roll);
    setFinalResult({ roll, total });
    setPhase('result');
    
    // SFX based on result
    if (roll === 20) {
        audio.sfxCrit();
    } else if (roll === 1) {
        audio.sfxError();
    } else {
        audio.sfxSelect();
    }

    // Delay before closing to let user see result
    const closeDelay = roll === 20 || roll === 1 ? 2500 : 1800;
    
    const id = setTimeout(() => {
      onComplete(total, roll);
    }, closeDelay);
    timeouts.current.push(id);
  };

  // --- Visual Config ---
  const getTheme = () => {
    switch (statType) {
      case 'ATK': return { color: 'text-rose-500', bg: 'from-rose-900/90 to-slate-900', border: 'border-rose-500/30', glow: 'shadow-rose-500/50' };
      case 'DEF': return { color: 'text-blue-400', bg: 'from-blue-900/90 to-slate-900', border: 'border-blue-500/30', glow: 'shadow-blue-500/50' };
      case 'SPD': return { color: 'text-emerald-400', bg: 'from-emerald-900/90 to-slate-900', border: 'border-emerald-500/30', glow: 'shadow-emerald-500/50' };
    }
  };

  const theme = getTheme();
  const isCrit = finalResult?.roll === 20;
  const isFail = finalResult?.roll === 1;

  return (
    <div className="absolute inset-0 z-50 flex items-center justify-center bg-[#0f0e17]/90 backdrop-blur-md animate-in fade-in duration-300">
      <div className={`relative w-72 rounded-2xl bg-gradient-to-b ${theme.bg} border ${theme.border} p-8 flex flex-col items-center justify-center shadow-2xl ${phase === 'result' ? 'scale-105' : 'scale-100'} transition-transform duration-500`}>
        
        {/* Background Glow Effects */}
        <div className={`absolute inset-0 bg-gradient-to-b ${theme.bg} opacity-50 rounded-2xl blur-xl -z-10`}></div>
        {isCrit && <div className="absolute inset-0 bg-yellow-500/20 rounded-2xl animate-pulse z-0"></div>}
        {isFail && <div className="absolute inset-0 bg-red-500/20 rounded-2xl animate-pulse z-0"></div>}

        {/* Header */}
        <h3 className={`text-white/90 uppercase tracking-[0.3em] text-xs font-bold mb-8 flex items-center gap-2 ${phase === 'rolling' ? 'animate-pulse' : ''}`}>
          {statType} CHECK
        </h3>

        {/* D20 Visualization */}
        <div className={`relative w-40 h-40 flex items-center justify-center mb-8 transition-all duration-300 ${phase === 'rolling' ? 'animate-spin-slow' : ''}`}>
           {/* D20 SVG Shape */}
           <svg viewBox="0 0 100 100" className={`w-full h-full drop-shadow-2xl transition-all duration-500 ${isCrit ? 'text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)]' : isFail ? 'text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]' : theme.color}`}>
              <path 
                d="M50 5 L93 28 L93 72 L50 95 L7 72 L7 28 Z" 
                fill="currentColor" 
                fillOpacity="0.15" 
                stroke="currentColor" 
                strokeWidth="2"
                strokeLinejoin="round"
              />
              <path 
                d="M50 5 L50 50 L93 28 M50 50 L93 72 M50 50 L50 95 M50 50 L7 72 M50 50 L7 28 M7 28 L50 5 L93 28" 
                fill="none" 
                stroke="currentColor" 
                strokeWidth="1" 
                strokeLinecap="round"
                strokeLinejoin="round"
                className="opacity-50"
              />
           </svg>
           
           {/* Number Display */}
           <div className="absolute inset-0 flex items-center justify-center z-10">
             <span className={`font-display font-bold text-5xl tabular-nums tracking-tighter transition-all duration-200 
                ${phase === 'rolling' ? 'blur-[1px] opacity-80 scale-90 text-white' : 'blur-0 opacity-100 scale-110'}
                ${isCrit ? 'text-yellow-300 text-6xl drop-shadow-[0_0_10px_black]' : isFail ? 'text-red-300 text-6xl drop-shadow-[0_0_10px_black]' : 'text-white'}
             `}>
               {displayNumber}
             </span>
           </div>
        </div>

        {/* Result Calculation Phase */}
        <div className="h-16 flex flex-col items-center justify-center w-full">
           {phase === 'result' && finalResult ? (
             <div className="animate-in slide-in-from-bottom-4 fade-in duration-500 w-full">
               
               {/* Special Result Text */}
               {(isCrit || isFail) && (
                 <div className={`text-center font-display font-bold text-lg mb-2 tracking-wider animate-bounce ${isCrit ? 'text-yellow-400' : 'text-red-500'}`}>
                   {isCrit ? "CRITICAL SUCCESS!" : "CRITICAL FAILURE..."}
                 </div>
               )}

               {/* Math Breakdown */}
               <div className="flex items-center justify-center gap-3 text-sm font-mono text-slate-300 bg-black/30 py-2 px-4 rounded-lg border border-white/5">
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 uppercase">Roll</span>
                    <span className={isCrit ? 'text-yellow-400 font-bold' : isFail ? 'text-red-400 font-bold' : 'text-white'}>{finalResult.roll}</span>
                  </div>
                  <span className="text-slate-500">+</span>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 uppercase">Stat</span>
                    <span>{statValue}</span>
                  </div>
                  <span className="text-slate-500">=</span>
                  <div className="flex flex-col items-center">
                    <span className="text-[10px] text-slate-500 uppercase">Total</span>
                    <span className={`text-xl font-bold ${theme.color}`}>{finalResult.total}</span>
                  </div>
               </div>
             </div>
           ) : (
             <div className="text-slate-500 text-xs tracking-widest animate-pulse">
               ROLLING FATE...
             </div>
           )}
        </div>

      </div>
    </div>
  );
};
