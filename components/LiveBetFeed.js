"use client";
import { useState, useEffect } from 'react';

const GreenCoin = ({cls="w-4 h-4"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

export default function LiveBetFeed() {
  const [bets, setBets] = useState([
    { id: 1, game: 'Mines', icon: '💣', user: 'Zeryux', wager: 500000, payout: 1250000, multiplier: 2.5, item: null, time: 'Just now', isHighRoller: false },
    { id: 2, game: 'Cases', icon: '📦', user: 'NinjaUser', wager: 2500000, payout: 25000000, multiplier: 10.0, item: 'AgujeroNegro', color: '#f472b6', time: '12s ago', isHighRoller: true },
    { id: 3, game: 'Coinflip', icon: '🪙', user: 'GamerX', wager: 1000000, payout: 2000000, multiplier: 2.0, item: null, time: '45s ago', isHighRoller: false },
    { id: 4, game: 'Battles', icon: '⚔️', user: 'RichGuy', wager: 5000000, payout: 15000000, multiplier: 3.0, item: 'CastigoDivino', color: '#ef4444', time: '1m ago', isHighRoller: true },
    { id: 5, game: 'Mines', icon: '💣', user: 'LuckyPro', wager: 100000, payout: 150000, multiplier: 1.5, item: null, time: '2m ago', isHighRoller: false },
  ]);

  useEffect(() => {
    const games = [
      { name: 'Mines', icon: '💣' },
      { name: 'Cases', icon: '📦' },
      { name: 'Coinflip', icon: '🪙' },
      { name: 'Jackpot', icon: '🎰' },
      { name: 'Battles', icon: '⚔️' }
    ];
    // Nombres de usuarios simulados, incluyendo algunos temáticos
    const users = ['Player', 'TetoFan', 'BloxKing', 'Gamer', 'Lucky', 'Whale'];
    const items = [null, null, 'Huge Teto Pet', null, 'Dominus', 'Valkyrie Helm', null];
    const colors = ['#f472b6', '#ef4444', '#facc15', '#38bdf8'];

    const interval = setInterval(() => {
      const randomGame = games[Math.floor(Math.random() * games.length)];
      // Lógica para que de vez en cuando salga una apuesta GIGANTE (High Roller)
      const isMassive = Math.random() > 0.85; 
      
      const wager = isMassive ? Math.floor(Math.random() * 5000000) + 1000000 : Math.floor(Math.random() * 500000) + 10000;
      const multiplier = isMassive ? (Math.random() * 10 + 2).toFixed(2) : (Math.random() * 3 + 1).toFixed(2);
      const payout = Math.floor(wager * multiplier);
      
      const randomItem = randomGame.name === 'Cases' || randomGame.name === 'Battles' ? items[Math.floor(Math.random() * items.length)] : null;
      const randomColor = colors[Math.floor(Math.random() * colors.length)];
      
      const userPrefix = users[Math.floor(Math.random() * users.length)];
      const isTetoAvatar = Math.random() > 0.8; // 20% de probabilidad de tener a Teto de foto

      const newBet = {
        id: Date.now(),
        game: randomGame.name,
        icon: randomGame.icon,
        user: `${userPrefix}${Math.floor(Math.random() * 999)}`,
        avatar: isTetoAvatar ? '/teto.png' : `https://api.dicebear.com/7.x/avataaars/svg?seed=${Math.random()}`,
        wager: wager,
        payout: payout,
        multiplier: parseFloat(multiplier),
        item: randomItem,
        color: randomColor,
        time: 'Just now',
        isHighRoller: payout > 5000000 || parseFloat(multiplier) >= 10 // Condición de High Roller
      };

      setBets(prev => [newBet, ...prev].slice(0, 10));
    }, 3000); // Lo bajé a 3 segundos para que se vea más activo

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="w-full bg-[#11141d] border border-[#222630] rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] mt-8">
      
      {/* HEADER DEL FEED */}
      <div className="bg-[#14171f] px-6 py-4 flex items-center justify-between border-b border-[#222630]">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f472b6] shadow-[0_0_10px_#f472b6] animate-pulse"></span>
          <h2 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2">
            Live Bets
          </h2>
        </div>
        <div className="hidden sm:flex gap-2">
          <button className="bg-[#222630] text-white px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors border border-[#f472b6]/30 shadow-[0_0_10px_rgba(244,114,182,0.1)]">All Bets</button>
          <button className="text-[#555b82] hover:text-[#facc15] px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-colors flex items-center gap-1">
            <span>⭐</span> High Rollers
          </button>
        </div>
      </div>

      {/* TABLA DE APUESTAS */}
      <div className="overflow-x-auto custom-scrollbar">
        <table className="w-full text-left border-collapse min-w-[700px]">
          <thead className="bg-[#0b0e14] text-[#555b82] text-[10px] font-black uppercase tracking-widest">
            <tr>
              <th className="px-6 py-4">Game</th>
              <th className="px-6 py-4">User</th>
              <th className="px-6 py-4">Wager</th>
              <th className="px-6 py-4">Multiplier</th>
              <th className="px-6 py-4 text-right">Payout</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#222630]/50">
            {bets.map((bet, idx) => (
              <tr 
                key={bet.id} 
                className={`transition-all duration-500 hover:bg-[#1a1e29] relative group
                  ${idx === 0 ? 'animate-slide-down' : ''} 
                  ${bet.isHighRoller ? 'bg-gradient-to-r from-[#f472b6]/10 to-transparent' : ''}
                `}
              >
                {/* BORDE LATERAL PARA HIGH ROLLERS */}
                {bet.isHighRoller && (
                  <td className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#f472b6] to-[#fb7185] shadow-[0_0_10px_#f472b6]"></td>
                )}

                {/* GAME */}
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className={`text-xl p-2 rounded-xl border flex items-center justify-center
                      ${bet.isHighRoller ? 'bg-[#f472b6]/20 border-[#f472b6]/50 shadow-[0_0_15px_rgba(244,114,182,0.3)]' : 'bg-[#222630] border-[#2a2e44] shadow-inner'}`}>
                      {bet.icon}
                    </span>
                    <span className={`font-black text-xs uppercase tracking-wider ${bet.isHighRoller ? 'text-white' : 'text-[#8f9ac6]'}`}>
                      {bet.game}
                    </span>
                  </div>
                </td>
                
                {/* USER */}
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg overflow-hidden border-2 flex-shrink-0
                      ${bet.isHighRoller ? 'border-[#facc15] shadow-[0_0_10px_rgba(250,204,21,0.3)]' : 'border-[#222630] bg-[#1a1e29]'}`}>
                      <img src={bet.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${bet.user}`} alt="avatar" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-white font-bold text-sm truncate max-w-[120px]">{bet.user}</span>
                  </div>
                </td>
                
                {/* WAGER */}
                <td className="px-6 py-3.5">
                  <span className="text-[#8f9ac6] font-black text-sm flex items-center gap-1.5">
                    <GreenCoin cls="w-3.5 h-3.5 grayscale opacity-50"/> {formatValue(bet.wager)}
                  </span>
                </td>
                
                {/* MULTIPLIER */}
                <td className="px-6 py-3.5">
                  <span className={`font-black text-xs px-2.5 py-1.5 rounded-lg border flex inline-flex items-center justify-center min-w-[60px]
                    ${bet.multiplier >= 10 ? 'bg-gradient-to-r from-[#facc15]/20 to-[#eab308]/20 text-[#facc15] border-[#facc15]/50 shadow-[0_0_15px_rgba(250,204,21,0.3)]' : 
                      bet.multiplier >= 2 ? 'bg-[#22c55e]/10 text-[#4ade80] border-[#22c55e]/30' : 
                      'bg-[#1a1e29] text-[#8f9ac6] border-[#222630]'}`}>
                    {bet.multiplier.toFixed(2)}x
                  </span>
                </td>
                
                {/* PAYOUT / ITEM */}
                <td className="px-6 py-3.5 text-right">
                  {bet.item ? (
                    <div className="inline-flex flex-col items-end">
                      <span className="font-black text-sm uppercase tracking-widest drop-shadow-md" style={{color: bet.color}}>{bet.item}</span>
                      <span className="text-[#555b82] text-[9px] font-bold uppercase">{bet.time}</span>
                    </div>
                  ) : (
                    <div className="inline-flex flex-col items-end">
                      <span className={`font-black text-base flex items-center gap-1.5 
                        ${bet.isHighRoller ? 'text-[#facc15] drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]' : 'text-[#4ade80] drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]'}`}>
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
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #222630; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f4354; }
        
        .animate-slide-down { 
          animation: slideDownFlash 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; 
        }
        
        @keyframes slideDownFlash { 
          0% { opacity: 0; transform: translateY(-15px); background-color: rgba(244, 114, 182, 0.3); } 
          100% { opacity: 1; transform: translateY(0); } 
        }
      `}} />
    </div>
  );
}
