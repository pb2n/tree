
import React from 'react';

export interface FloatingTextItem {
  id: string;
  text: string;
  x: number; // Percentage 0-100 relative to container
  y: number; // Percentage 0-100
  type: 'damage' | 'heal' | 'crit' | 'block' | 'miss';
}

interface FloatingTextProps {
  items: FloatingTextItem[];
}

export const FloatingTextOverlay: React.FC<FloatingTextProps> = ({ items }) => {
  return (
    <div className="absolute inset-0 pointer-events-none z-50 overflow-hidden">
      {items.map((item) => (
        <div
          key={item.id}
          className={`absolute font-display font-bold text-2xl tracking-wider animate-float-text drop-shadow-lg
            ${item.type === 'damage' ? 'text-white text-3xl' : ''}
            ${item.type === 'crit' ? 'text-yellow-400 text-4xl scale-125' : ''}
            ${item.type === 'heal' ? 'text-emerald-400 text-2xl' : ''}
            ${item.type === 'block' ? 'text-blue-300 text-xl' : ''}
            ${item.type === 'miss' ? 'text-gray-400 text-xl' : ''}
          `}
          style={{ 
            left: `${item.x}%`, 
            top: `${item.y}%`,
            textShadow: item.type === 'crit' ? '0 0 10px red' : '2px 2px 0 #000'
          }}
        >
          {item.text}
        </div>
      ))}
    </div>
  );
};
