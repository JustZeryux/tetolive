"use client";
import { useState, useEffect } from 'react';

const GreenCoin = ({cls="w-4 h-4"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

export default function LiveBetFeed() {
  // Mock Data inicial
  const [bets, setBets] = useState([
    { id: 1, game: 'Mines', icon: '💣', user: 'Zeryux', wager: 500000, payout: 1250000, multiplier: 2.5, item: null, time: 'Just now' },
    { id: 2, game: 'Cases', icon: '📦', user: 'NinjaUser', wager: 2500000, payout: 25000000, multiplier: 10.0, item: 'AgujeroNegro', color: '#a855f7', time: '12s ago' },
    { id: 3, game: 'Coinflip', icon: '🪙', user: 'GamerX', wager: 1000000, payout: 2000000, multiplier: 2.0, item: null, time: '45s ago' },
    { id: 4, game: 'Battles', icon: '⚔️', user: 'RichGuy', wager: 5000000, payout: 15000000, multiplier: 3.0, item: 'CastigoDivino', color: '#ef4444', time: '1m ago' },
    { id: 5, game: 'Mines', icon: '💣', user: 'LuckyPro', wager: 100000, payout: 150000, multiplier: 1.5, item: null, time: '2m ago' },
  ]);

  // Simulador de apuestas en tiempo real
  useEffect(() => {
    const games = [
      { name: 'Mines', icon: '💣' },
      { name: 'Cases', icon: '📦' },
      { name: 'Coinflip', icon: '🪙' },
      { name: 'Battles', icon: '⚔️' }
    ];
    const items = [null, null, 'AgujeroNegro', null, 'CastigoDivino', 'Huge Cat', null];
    const colors = ['#a855f7', '#ef4444', '#facc15', '#38bdf8'];

    const interval = setInterval(() => {
      const randomGame = games[Math.floor(Math.random() * games.length)];
      const wager = Math.floor(Math.random() * 2000000) + 50000;
      const multiplier = (Math.random() * 5 + 1).toFixed(2);
      const payout = Math.floor(wager * multiplier);
      const randomItem = randomGame.name === 'Cases' || randomGame.name === 'Battles' ? items[Math.floor(Math.random() * items.length)] : null;
      const randomColor = colors[Math.floor(Math.random() * colors.length)];

      const newBet = {
        id: Date.now(),
        game: randomGame.name,
        icon: randomGame.icon,
        user: `Player${Math.floor(Math.random() * 999)}`,
        wager: wager,
        payout: payout,
        multiplier: parseFloat(multiplier),
        item: randomItem,
        color: randomColor,
        time: 'Just now'
      };

      setBets(prev => [newBet, ...prev].slice(0, 10)); // Mantiene solo las últimas 10 apuestas
    }, 4500); // Nueva apuesta cada 4.5 segundos

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-[#1c1f2e] border border-[#252839] rounded-2xl overflow-hidden shadow-xl mt-8">
      
      {/* HEADER DEL FEED */}
      <div className="bg-[#141323] px-6 py-4 flex items-center justify-between border-b border-[#252839]">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#3AFF4E] shadow-[0_0_10px_#3AFF4E] animate-pulse"></span>
          <h2 className="text-white font-black uppercase tracking-widest text-sm">Live Bets</h2>
        </div>
        <div className="hidden sm:flex gap-2">
          <button className="bg-[#2a2e44] text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors shadow-inner">All Bets</button>
          <button className="text-[#555b82] hover:text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors">High Rollers</button>
        </div>
      </div>

      {/* TABLA DE APUESTAS */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead className="bg-[#141323]/50 text-[#555b82] text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="px-6 py-3">Game</th>
              <th className="px-6 py-3">User</th>
              <th className="px-6 py-3">Wager</th>
              <th className="px-6 py-3">Multiplier</th>
              <th className="px-6 py-3 text-right">Payout / Item</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#252839]">
            {bets.map((bet, idx) => (
              <tr 
                key={bet.id} 
                className={`transition-all duration-500 hover:bg-[#252839]/30 animate-slide-down ${idx === 0 ? 'bg-[#22c55e]/5' : ''}`}
              >
                {/* GAME */}
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <span className="text-xl bg-[#2a2e44] p-1.5 rounded-lg shadow-inner">{bet.icon}</span>
                    <span className="text-[#8f9ac6] font-bold text-xs uppercase tracking-wider">{bet.game}</span>
                  </div>
                </td>
                
                {/* USER */}
                <td className="px-6 py-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-full bg-[#2a2e44] border border-[#3f4354] overflow-hidden">
                      <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${bet.user}`} alt="avatar" />
                    </div>
                    <span className="text-white font-bold text-sm truncate max-w-[100px]">{bet.user}</span>
                  </div>
                </td>
                
                {/* WAGER */}
                <td className="px-6 py-3">
                  <span className="text-[#8f9ac6] font-black text-xs flex items-center gap-1">
                    <GreenCoin cls="w-3 h-3 grayscale opacity-70"/> {formatValue(bet.wager)}
                  </span>
                </td>
                
                {/* MULTIPLIER */}
                <td className="px-6 py-3">
                  <span className={`font-black text-xs px-2 py-1 rounded-md border ${bet.multiplier >= 5 ? 'bg-[#facc15]/10 text-[#facc15] border-[#facc15]/30 shadow-[0_0_10px_rgba(250,204,21,0.2)]' : bet.multiplier >= 2 ? 'bg-[#3AFF4E]/10 text-[#3AFF4E] border-[#3AFF4E]/30' : 'bg-[#2a2e44] text-[#8f9ac6] border-transparent'}`}>
                    {bet.multiplier.toFixed(2)}x
                  </span>
                </td>
                
                {/* PAYOUT / ITEM */}
                <td className="px-6 py-3 text-right">
                  {bet.item ? (
                    <div className="inline-flex flex-col items-end">
                      <span className="font-black text-sm uppercase tracking-widest drop-shadow-md" style={{color: bet.color}}>{bet.item}</span>
                      <span className="text-[#555b82] text-[9px] font-bold uppercase">{bet.time}</span>
                    </div>
                  ) : (
                    <div className="inline-flex flex-col items-end">
                      <span className="font-black text-[#3AFF4E] text-sm flex items-center gap-1 drop-shadow-[0_0_8px_rgba(58,255,78,0.4)]">
                        <GreenCoin cls="w-4 h-4"/> {formatValue(bet.payout)}
                      </span>
                      <span className="text-[#555b82] text-[9px] font-bold uppercase">{bet.time}</span>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #252839; border-radius: 10px; }
        .animate-slide-down { animation: slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slideDown { 
          from { opacity: 0; transform: translateY(-10px); background-color: rgba(34, 197, 94, 0.2); } 
          to { opacity: 1; transform: translateY(0); } 
        }
      `}} />
    </div>
  );
}