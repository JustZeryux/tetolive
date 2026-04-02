"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

// Helpers Visuales
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

// Estilos de Medallas para el Top 3
const RANK_STYLES = {
  1: { color: '#facc15', bg: 'from-[#facc15]/20 to-[#facc15]/5', border: 'border-[#facc15]', icon: '👑', shadow: 'shadow-[0_0_30px_rgba(250,204,21,0.3)]' },
  2: { color: '#94a3b8', bg: 'from-[#94a3b8]/20 to-[#94a3b8]/5', border: 'border-[#94a3b8]', icon: '🥈', shadow: 'shadow-[0_0_20px_rgba(148,163,184,0.2)]' },
  3: { color: '#b45309', bg: 'from-[#b45309]/20 to-[#b45309]/5', border: 'border-[#b45309]', icon: '🥉', shadow: 'shadow-[0_0_20px_rgba(180,83,9,0.2)]' }
};

export default function LeaderboardPage() {
  const [category, setCategory] = useState('wealth'); // 'wealth' (saldo_verde) o 'level' (nivel)
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      
      const orderByColumn = category === 'wealth' ? 'saldo_verde' : 'level';
      
      const { data, error } = await supabase
        .from('perfiles')
        .select('id, username, avatar_url, level, saldo_verde')
        .order(orderByColumn, { ascending: false })
        .limit(50); // Traemos el Top 50

      if (!error && data) {
        setLeaders(data);
      }
      
      setLoading(false);
    };

    fetchLeaderboard();
  }, [category]);

  // Separar el Top 3 del resto
  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);

  // Ordenar el Top 3 para el podio visual (2do, 1ero, 3ero)
  const podiumOrder = [];
  if (top3[1]) podiumOrder.push({ ...top3[1], rank: 2 });
  if (top3[0]) podiumOrder.push({ ...top3[0], rank: 1 });
  if (top3[2]) podiumOrder.push({ ...top3[2], rank: 3 });

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 animate-fade-in relative overflow-hidden">
      
      {/* Luces de fondo decorativas */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[500px] bg-gradient-to-b from-[#facc15]/10 to-transparent blur-[120px] pointer-events-none"></div>

      <div className="max-w-[1000px] mx-auto relative z-10">
        
        {/* HEADER */}
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] drop-shadow-md mb-4 flex items-center justify-center gap-4">
            🏆 Hall of Fame
          </h1>
          <p className="text-[#8f9ac6] font-bold text-lg mb-8">The most legendary players in the ecosystem.</p>
          
          {/* TABS DE CATEGORÍA */}
          <div className="inline-flex bg-[#141323] border border-[#2F3347] rounded-xl p-1 shadow-inner">
             <button 
                onClick={() => setCategory('wealth')}
                className={`px-8 py-2.5 rounded-lg font-black uppercase tracking-widest text-sm transition-all ${category === 'wealth' ? 'bg-[#22c55e] text-[#0b0e14] shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'text-[#8f9ac6] hover:text-white'}`}
             >
                Richest Players
             </button>
             <button 
                onClick={() => setCategory('level')}
                className={`px-8 py-2.5 rounded-lg font-black uppercase tracking-widest text-sm transition-all ${category === 'level' ? 'bg-[#6C63FF] text-white shadow-[0_0_15px_rgba(108,99,255,0.4)]' : 'text-[#8f9ac6] hover:text-white'}`}
             >
                Highest Levels
             </button>
          </div>
        </div>

        {loading ? (
           <div className="py-32 flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-[#252839] border-t-[#facc15] rounded-full animate-spin mb-4"></div>
              <p className="text-[#555b82] font-black uppercase tracking-widest">Loading Legends...</p>
           </div>
        ) : leaders.length === 0 ? (
           <div className="py-20 text-center text-[#555b82] font-bold">No players found.</div>
        ) : (
          <>
            {/* =========================================
                EL PODIO (TOP 3)
            ========================================= */}
            <div className="flex flex-col md:flex-row justify-center items-end gap-4 md:gap-6 mb-16 pt-10">
              {podiumOrder.map((player) => {
                const style = RANK_STYLES[player.rank];
                const isFirst = player.rank === 1;
                
                return (
                  <div key={player.id} className={`flex flex-col items-center w-full md:w-1/3 relative animate-scale-in`} style={{ animationDelay: `${player.rank * 0.1}s` }}>
                    
                    {/* Corona / Icono */}
                    <div className={`text-4xl md:text-5xl mb-2 ${isFirst ? 'animate-bounce drop-shadow-[0_0_15px_rgba(250,204,21,0.8)]' : 'drop-shadow-md'}`}>
                        {style.icon}
                    </div>

                    {/* Tarjeta del Jugador */}
                    <div className={`w-full bg-gradient-to-b ${style.bg} border ${style.border} rounded-t-2xl p-6 flex flex-col items-center ${style.shadow} ${isFirst ? 'md:h-64' : 'md:h-52'} relative overflow-hidden backdrop-blur-sm`}>
                       
                       {/* Brillo interno */}
                       <div className="absolute top-0 inset-x-0 h-px bg-gradient-to-r from-transparent via-white/50 to-transparent"></div>

                       <div className={`rounded-full border-4 ${style.border} overflow-hidden mb-4 bg-[#0b0e14] ${isFirst ? 'w-24 h-24' : 'w-20 h-20'}`}>
                          <img src={player.avatar_url} className="w-full h-full object-cover" alt="avatar"/>
                       </div>
                       
                       <h3 className="font-black text-white text-lg truncate w-full text-center mb-1">{player.username}</h3>
                       
                       {/* Estadística Mostrada */}
                       {category === 'wealth' ? (
                           <div className="bg-[#0b0e14]/50 border border-white/10 px-4 py-1.5 rounded-lg flex items-center gap-2 mt-auto">
                               <GreenCoin cls="w-5 h-5"/>
                               <span className="font-black text-[#22c55e] text-lg">{formatValue(player.saldo_verde)}</span>
                           </div>
                       ) : (
                           <div className="bg-[#0b0e14]/50 border border-white/10 px-4 py-1.5 rounded-lg flex items-center gap-2 mt-auto">
                               <span className="text-[#6C63FF] font-black text-lg">LVL {player.level}</span>
                           </div>
                       )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* =========================================
                LA LISTA (DEL 4 AL 50)
            ========================================= */}
            <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl shadow-2xl overflow-hidden">
               
               <div className="grid grid-cols-[auto_1fr_auto] gap-4 p-4 border-b border-[#252839] bg-[#141323] text-[#8f9ac6] text-xs font-black uppercase tracking-widest">
                  <div className="w-12 text-center">Rank</div>
                  <div>Player</div>
                  <div className="text-right pr-4">{category === 'wealth' ? 'Net Worth' : 'Level'}</div>
               </div>

               <div className="flex flex-col">
                 {rest.map((player, idx) => {
                   const realRank = idx + 4;
                   return (
                     <div key={player.id} className="grid grid-cols-[auto_1fr_auto] items-center gap-4 p-4 border-b border-[#252839]/50 hover:bg-[#252839]/30 transition-colors group">
                        
                        <div className="w-12 text-center font-black text-[#555b82] text-lg group-hover:text-white transition-colors">
                           #{realRank}
                        </div>

                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 rounded-full border border-[#2F3347] overflow-hidden bg-[#0b0e14]">
                              <img src={player.avatar_url} className="w-full h-full object-cover" alt="avatar"/>
                           </div>
                           <span className="font-bold text-white group-hover:text-[#6C63FF] transition-colors">{player.username}</span>
                           {category === 'wealth' && (
                               <span className="hidden sm:inline-flex items-center justify-center text-[9px] font-black bg-[#2a2e44] text-[#8f9ac6] rounded-[4px] px-1.5 py-[1px]">
                                  LVL {player.level}
                               </span>
                           )}
                        </div>

                        <div className="text-right pr-4 font-black">
                           {category === 'wealth' ? (
                               <span className="text-[#22c55e] flex items-center justify-end gap-1.5"><GreenCoin/> {formatValue(player.saldo_verde)}</span>
                           ) : (
                               <span className="text-[#6C63FF]">LVL {player.level}</span>
                           )}
                        </div>

                     </div>
                   );
                 })}
                 {rest.length === 0 && (
                     <div className="p-8 text-center text-[#555b82] font-bold">No more players to show.</div>
                 )}
               </div>

            </div>
          </>
        )}
      </div>

      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in { animation: fadeIn 0.5s ease-out forwards; }
        .animate-scale-in { opacity: 0; animation: scaleIn 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes scaleIn { 0% { opacity: 0; transform: scale(0.8) translateY(20px); } 100% { opacity: 1; transform: scale(1) translateY(0); } }
      `}} />
    </div>
  );
}
