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

const RANK_STYLES = {
  1: { color: '#facc15', bg: 'from-[#facc15]/20 to-[#facc15]/5', border: 'border-[#facc15]', shadow: 'shadow-[0_0_30px_rgba(250,204,21,0.3)]' },
  2: { color: '#94a3b8', bg: 'from-[#94a3b8]/20 to-[#94a3b8]/5', border: 'border-[#94a3b8]', shadow: 'shadow-[0_0_20px_rgba(148,163,184,0.2)]' },
  3: { color: '#b45309', bg: 'from-[#b45309]/20 to-[#b45309]/5', border: 'border-[#b45309]', shadow: 'shadow-[0_0_20px_rgba(180,83,9,0.2)]' }
};

export default function LeaderboardPage() {
  const [category, setCategory] = useState('wealth');
  const [leaders, setLeaders] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchLeaderboard = async () => {
      setLoading(true);
      const orderByColumn = category === 'wealth' ? 'saldo_verde' : 'level';
      
      const { data, error } = await supabase
        .from('profiles') // <--- CORRECCIÓN A LA TABLA REAL
        .select('id, username, avatar_url, level, saldo_verde')
        .order(orderByColumn, { ascending: false })
        .limit(50);

      if (!error && data) {
        setLeaders(data);
      }
      setLoading(false);
    };

    fetchLeaderboard();
  }, [category]);

  const top3 = leaders.slice(0, 3);
  const rest = leaders.slice(3);
  const podiumOrder = [];
  if (top3[1]) podiumOrder.push({ ...top3[1], rank: 2 });
  if (top3[0]) podiumOrder.push({ ...top3[0], rank: 1 });
  if (top3[2]) podiumOrder.push({ ...top3[2], rank: 3 });

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 animate-fade-in relative overflow-hidden">
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-5xl h-[500px] bg-gradient-to-b from-[#facc15]/10 to-transparent blur-[120px] pointer-events-none"></div>

      <div className="max-w-[1000px] mx-auto relative z-10">
        <div className="text-center mb-10">
          <h1 className="text-5xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-[#8f9ac6] drop-shadow-md mb-4 flex items-center justify-center gap-4">
            🏆 Hall of Fame
          </h1>
          <p className="text-[#8f9ac6] font-bold text-lg mb-8">Los jugadores más legendarios del ecosistema.</p>
          
          <div className="inline-flex bg-[#141323] border border-[#2F3347] rounded-xl p-1 shadow-inner">
             <button 
                onClick={() => setCategory('wealth')}
                className={`px-8 py-2.5 rounded-lg font-black uppercase tracking-widest text-sm transition-all ${category === 'wealth' ? 'bg-[#22c55e] text-[#0b0e14] shadow-[0_0_15px_rgba(34,197,94,0.4)]' : 'text-[#8f9ac6] hover:text-white'}`}
             >
                Top Ricos
             </button>
             <button 
                onClick={() => setCategory('level')}
                className={`px-8 py-2.5 rounded-lg font-black uppercase tracking-widest text-sm transition-all ${category === 'level' ? 'bg-[#6C63FF] text-white shadow-[0_0_15px_rgba(108,99,255,0.4)]' : 'text-[#8f9ac6] hover:text-white'}`}
             >
                Top Nivel
             </button>
          </div>
        </div>

        {loading ? (
           <div className="flex justify-center items-center h-40">
              <div className="w-12 h-12 border-4 border-[#22c55e] border-t-transparent rounded-full animate-spin"></div>
           </div>
        ) : leaders.length === 0 ? (
           <div className="text-center py-20 text-[#8f9ac6] font-bold text-xl bg-[#141323] rounded-3xl border border-[#2F3347] border-dashed">
              Aún no hay nadie aquí. ¡Sé el primero!
           </div>
        ) : (
          <>
            <div className="flex flex-col md:flex-row justify-center items-end gap-6 mb-16 pt-10">
              {podiumOrder.map((user) => {
                const style = RANK_STYLES[user.rank];
                const heightClass = user.rank === 1 ? 'h-64 md:h-72 w-full md:w-1/3' : 'h-48 md:h-56 w-full md:w-1/4';
                return (
                  <div key={user.id} className={`flex flex-col items-center ${heightClass} order-${user.rank === 1 ? '1 md:order-2' : user.rank === 2 ? '2 md:order-1' : '3'} relative group`}>
                    <div className={`absolute -top-16 md:-top-20 z-20 transition-transform duration-500 group-hover:-translate-y-4`}>
                      <img src={user.avatar_url || '/default-avatar.png'} className={`w-24 h-24 md:w-32 md:h-32 rounded-full object-cover border-4 ${style.border} ${style.shadow} bg-[#0b0e14]`} alt={user.username}/>
                      <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 w-10 h-10 md:w-12 md:h-12 bg-[#0b0e14] border-2 ${style.border} rounded-full flex items-center justify-center font-black text-lg md:text-xl z-30`} style={{color: style.color}}>{user.rank}</div>
                    </div>
                    
                    <div className={`w-full h-full bg-gradient-to-b ${style.bg} border-t-2 border-x ${style.border} border-b-0 rounded-t-2xl flex flex-col items-center pt-20 px-4 text-center mt-auto ${style.shadow} transition-all duration-500`}>
                      <span className="font-black text-xl uppercase tracking-widest line-clamp-1 w-full" style={{color: style.color}}>{user.username}</span>
                      {category === 'wealth' ? (
                        <div className="mt-4 bg-[#0b0e14]/50 border border-[#2F3347] px-4 py-2 rounded-xl flex items-center gap-2">
                           <GreenCoin cls="w-5 h-5"/>
                           <span className="font-bold text-white text-lg">{formatValue(user.saldo_verde)}</span>
                        </div>
                      ) : (
                        <div className="mt-4 bg-[#0b0e14]/50 border border-[#2F3347] px-4 py-2 rounded-xl font-black text-[#6C63FF] text-lg">
                           Lvl {user.level || 1}
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-3">
              {rest.map((user, i) => (
                <div key={user.id} className="flex items-center bg-[#141323] hover:bg-[#1c1a30] transition-colors border border-[#2F3347] rounded-2xl p-4 gap-6 group">
                  <div className="w-12 text-center font-black text-[#8f9ac6] text-xl group-hover:text-white transition-colors">#{i + 4}</div>
                  <img src={user.avatar_url || '/default-avatar.png'} className="w-12 h-12 rounded-full border-2 border-[#2F3347]" alt={user.username}/>
                  <div className="flex-1">
                    <h3 className="font-bold text-white text-lg">{user.username}</h3>
                  </div>
                  <div className="text-right">
                     {category === 'wealth' ? (
                        <div className="flex items-center gap-2 bg-[#0b0e14] px-4 py-2 rounded-xl border border-[#2F3347]">
                           <GreenCoin/>
                           <span className="font-bold text-white">{formatValue(user.saldo_verde)}</span>
                        </div>
                     ) : (
                        <div className="bg-[#0b0e14] px-4 py-2 rounded-xl border border-[#2F3347] font-bold text-[#6C63FF]">
                           Lvl {user.level || 1}
                        </div>
                     )}
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
