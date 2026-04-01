"use client";
import { useState, useEffect } from 'react';

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

export default function LiveDrops() {
  const [drops, setDrops] = useState([
    { id: 1, user: 'Zeryux', item: 'Huge Cat', img: 'https://cdn.bgsi.gg/items/giant-robot.png', color: '#facc15', value: 25000000 },
    { id: 2, user: 'NinjaUser', item: 'Agujero Negro', img: 'https://cdn.bgsi.gg/items/que-fofo-face-god.png', color: '#a855f7', value: 5000000 },
    { id: 3, user: 'GamerX', item: 'Castigo Divino', img: 'https://cdn.bgsi.gg/items/mythic-stellar-acheron.png', color: '#ef4444', value: 1500000 },
    { id: 4, user: 'LuckyPro', item: 'Secret God', img: 'https://cdn.bgsi.gg/items/shiny-santa-slime.png', color: '#ec4899', value: 50000000 },
    { id: 5, user: 'RichGuy', item: 'Titan', img: 'https://cdn.bgsi.gg/items/silly-doggy-tophat.png', color: '#38bdf8', value: 750000 },
  ]);

  return (
    <div className="w-full h-[60px] bg-[#14171f] border-b border-[#222630] overflow-hidden flex items-center relative z-30 shrink-0">
      
      {/* Etiqueta Fija Izquierda */}
      <div className="absolute left-0 top-0 h-full bg-[#14171f] z-20 px-4 flex items-center border-r border-[#222630] shadow-[10px_0_15px_rgba(20,23,31,0.9)]">
        <span className="w-2 h-2 rounded-full bg-[#3AFF4E] shadow-[0_0_8px_#3AFF4E] animate-pulse mr-2"></span>
        <span className="text-white font-black text-[10px] uppercase tracking-widest hidden sm:block">Live Drops</span>
      </div>

      {/* Contenedor Marquee (Animación Infinita) */}
      <div className="flex whitespace-nowrap animate-marquee pl-[120px] sm:pl-[160px] hover:[animation-play-state:paused] cursor-pointer">
        {/* Duplicamos los items para que el loop sea infinito visualmente */}
        {[...drops, ...drops, ...drops].map((drop, idx) => (
          <div key={`${drop.id}-${idx}`} className="inline-flex items-center bg-[#1c1f2e] border border-[#252839] rounded-lg p-1.5 mx-2 hover:border-[#6C63FF] transition-colors relative overflow-hidden group">
            <div className="absolute inset-0 opacity-10" style={{ background: `radial-gradient(circle at left, ${drop.color} 0%, transparent 70%)` }}></div>
            
            <img src={drop.img} className="w-8 h-8 object-contain drop-shadow-md z-10" alt={drop.item} />
            <div className="flex flex-col ml-2 pr-3 z-10">
              <span className="text-[10px] font-black text-white" style={{color: drop.color}}>{drop.item}</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[9px] font-bold text-[#555b82]">{drop.user}</span>
                <span className="text-[9px] font-black text-[#3AFF4E]">{formatValue(drop.value)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-marquee { animation: marquee 30s linear infinite; }
        @keyframes marquee { 0% { transform: translateX(0); } 100% { transform: translateX(-33.33%); } }
      `}} />
    </div>
  );
}