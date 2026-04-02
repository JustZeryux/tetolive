"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

const GreenCoin = ({cls="w-4 h-4"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

export default function LiveBetFeed() {
  const [bets, setBets] = useState([]);

  // Diccionario de íconos según tu base de datos
  const gameIcons = {
    'coinflip': '🪙',
    'battles': '⚔️',
    'jackpot': '🎰',
    'mines': '💣',
    'cases': '📦'
  };

  useEffect(() => {
    // 1. Cargar las últimas partidas completadas
    const fetchRealBets = async () => {
      const { data, error } = await supabase
        .from('partidas')
        .select(`
          id, modo_juego, apuesta_creador, resultado, estado,
          profiles:creador_id ( username, avatar_url )
        `)
        .in('estado', ['completed', 'in_progress'])
        .order('creado_en', { ascending: false })
        .limit(15);

      if (data && !error) {
        const parsedBets = data.map(formatearApuesta).filter(b => b !== null);
        setBets(parsedBets);
      }
    };

    fetchRealBets();

    // 2. Escuchar la tabla partidas en TIEMPO REAL
    const channel = supabase.channel('live_bet_feed')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'partidas' 
      }, async (payload) => {
        const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('id', payload.new.creador_id).single();
        const nuevaApuesta = formatearApuesta({ ...payload.new, profiles: profile });
        if (nuevaApuesta) setBets(prev => [nuevaApuesta, ...prev].slice(0, 15));
      })
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'partidas' 
      }, async (payload) => {
        // Actualizar la apuesta si terminó (ej. para mostrar el pago final/payout)
        const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('id', payload.new.creador_id).single();
        const apuestaActualizada = formatearApuesta({ ...payload.new, profiles: profile });
        
        if (apuestaActualizada) {
          setBets(prev => {
            const existe = prev.findIndex(b => b.id === apuestaActualizada.id);
            if (existe >= 0) {
              const nuevaLista = [...prev];
              nuevaLista[existe] = apuestaActualizada;
              return nuevaLista;
            }
            return [apuestaActualizada, ...prev].slice(0, 15);
          });
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Transforma el JSON raro de tu tabla "partidas" en algo que la tabla pueda leer
  const formatearApuesta = (partida) => {
    try {
      // Calcular el valor total de las mascotas apostadas
      let wagerAmount = 0;
      if (Array.isArray(partida.apuesta_creador)) {
         wagerAmount = partida.apuesta_creador.reduce((sum, pet) => sum + (pet.value || pet.valor || 0), 0);
      } else if (typeof partida.apuesta_creador === 'number') {
         wagerAmount = partida.apuesta_creador; // Por si algún modo usa saldo en vez de pets
      }

      // Si no hay apuesta válida, la ignoramos
      if (wagerAmount === 0) return null;

      // Calcular Payout (cuánto se llevó). Simplificado: si ganó, se lleva el doble (en coinflip)
      let payoutAmount = 0;
      let multiplier = 0;

      if (partida.estado === 'completed') {
         // Lógica básica: Si él es el ganador en el JSON, su payout es positivo
         const esGanador = partida.resultado?.ganador_id === partida.creador_id;
         payoutAmount = esGanador ? wagerAmount * 2 : 0; 
         multiplier = esGanador ? 2.0 : 0.0;
      }

      return {
        id: partida.id,
        game: partida.modo_juego.charAt(0).toUpperCase() + partida.modo_juego.slice(1), // ej: 'coinflip' -> 'Coinflip'
        icon: gameIcons[partida.modo_juego] || '🎲',
        user: partida.profiles?.username || 'Unknown',
        avatar: partida.profiles?.avatar_url || '/default-avatar.png',
        wager: wagerAmount,
        payout: payoutAmount,
        multiplier: multiplier,
        item: null, // Opcional: Podrías extraer el nombre de la mejor pet de la apuesta aquí
        color: '#4ade80',
        time: 'Just now',
        isHighRoller: wagerAmount > 1000000 // Destaca apuestas de más de 1M
      };
    } catch (e) {
      return null;
    }
  };

  return (
    <div className="w-full bg-[#11141d] border border-[#222630] rounded-2xl overflow-hidden shadow-[0_10px_30px_rgba(0,0,0,0.5)] mt-8">
      {/* HEADER DEL FEED */}
      <div className="bg-[#14171f] px-6 py-4 flex items-center justify-between border-b border-[#222630]">
        <div className="flex items-center gap-3">
          <span className="w-2.5 h-2.5 rounded-full bg-[#f472b6] shadow-[0_0_10px_#f472b6] animate-pulse"></span>
          <h2 className="text-white font-black uppercase tracking-widest text-sm flex items-center gap-2">Live Bets</h2>
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
              <tr key={bet.id} className={`transition-all duration-500 hover:bg-[#1a1e29] relative group ${idx === 0 ? 'animate-slide-down' : ''} ${bet.isHighRoller ? 'bg-gradient-to-r from-[#f472b6]/10 to-transparent' : ''}`}>
                {bet.isHighRoller && <td className="absolute left-0 top-0 bottom-0 w-1 bg-gradient-to-b from-[#f472b6] to-[#fb7185] shadow-[0_0_10px_#f472b6]"></td>}
                
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <span className={`text-xl p-2 rounded-xl border flex items-center justify-center ${bet.isHighRoller ? 'bg-[#f472b6]/20 border-[#f472b6]/50 shadow-[0_0_15px_rgba(244,114,182,0.3)]' : 'bg-[#222630] border-[#2a2e44] shadow-inner'}`}>{bet.icon}</span>
                    <span className={`font-black text-xs uppercase tracking-wider ${bet.isHighRoller ? 'text-white' : 'text-[#8f9ac6]'}`}>{bet.game}</span>
                  </div>
                </td>
                
                <td className="px-6 py-3.5">
                  <div className="flex items-center gap-3">
                    <div className={`w-8 h-8 rounded-lg overflow-hidden border-2 flex-shrink-0 ${bet.isHighRoller ? 'border-[#facc15] shadow-[0_0_10px_rgba(250,204,21,0.3)]' : 'border-[#222630] bg-[#1a1e29]'}`}>
                      <img src={bet.avatar} alt="avatar" className="w-full h-full object-cover" />
                    </div>
                    <span className="text-white font-bold text-sm truncate max-w-[120px]">{bet.user}</span>
                  </div>
                </td>
                
                <td className="px-6 py-3.5">
                  <span className="text-[#8f9ac6] font-black text-sm flex items-center gap-1.5"><GreenCoin cls="w-3.5 h-3.5 grayscale opacity-50"/> {formatValue(bet.wager)}</span>
                </td>
                
                <td className="px-6 py-3.5">
                  <span className={`font-black text-xs px-2.5 py-1.5 rounded-lg border flex inline-flex items-center justify-center min-w-[60px] ${bet.multiplier >= 2 ? 'bg-[#22c55e]/10 text-[#4ade80] border-[#22c55e]/30' : 'bg-[#1a1e29] text-[#8f9ac6] border-[#222630]'}`}>{bet.multiplier.toFixed(2)}x</span>
                </td>
                
                <td className="px-6 py-3.5 text-right">
                  <div className="inline-flex flex-col items-end">
                    <span className={`font-black text-base flex items-center gap-1.5 ${bet.isHighRoller ? 'text-[#facc15] drop-shadow-[0_0_10px_rgba(250,204,21,0.6)]' : bet.payout > 0 ? 'text-[#4ade80] drop-shadow-[0_0_8px_rgba(74,222,128,0.3)]' : 'text-[#8f9ac6]'}`}><GreenCoin cls="w-4 h-4"/> {formatValue(bet.payout)}</span>
                  </div>
                </td>
              </tr>
            ))}
            {bets.length === 0 && (
                <tr>
                    <td colSpan="5" className="px-6 py-12 text-center text-[#555b82] font-black uppercase tracking-widest text-xs">Waiting for players...</td>
                </tr>
            )}
          </tbody>
        </table>
      </div>
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #222630; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #3f4354; }
        .animate-slide-down { animation: slideDownFlash 0.6s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
        @keyframes slideDownFlash { 0% { opacity: 0; transform: translateY(-15px); background-color: rgba(244, 114, 182, 0.3); } 100% { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}
