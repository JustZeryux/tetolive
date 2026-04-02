"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

// Componentes Monedas
const RedCoin = ({cls="w-3 h-3 md:w-3 md:h-3"}) => <img src="/red-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

export default function LiveDrops() {
  const [drops, setDrops] = useState([]);

  useEffect(() => {
    // 1. Cargar el historial reciente al entrar a la página
    const fetchRecentDrops = async () => {
      const { data, error } = await supabase
        .from('partidas')
        .select('id, modo_juego, resultado, creador_id')
        .eq('estado', 'completed')
        .order('creado_en', { ascending: false })
        .limit(20);

      if (!error && data) {
        // Necesitamos cruzar la info con el perfil del ganador (opcional, pero se ve mejor con su avatar)
        const parsedDrops = await parseDrops(data);
        setDrops(parsedDrops);
      }
    };

    fetchRecentDrops();

    // 2. Suscribirse a nuevas partidas completadas EN VIVO
    const channel = supabase.channel('live_drops_bar')
      .on('postgres_changes', { 
        event: 'UPDATE', 
        schema: 'public', 
        table: 'partidas',
        filter: "estado=eq.completed"
      }, async (payload) => {
        const newDrop = await parseSingleDrop(payload.new);
        if (newDrop) {
          setDrops(prev => [newDrop, ...prev].slice(0, 20)); // Agregar al inicio y mantener máximo 20
        }
      })
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'partidas',
        filter: "estado=eq.completed"
      }, async (payload) => {
        const newDrop = await parseSingleDrop(payload.new);
        if (newDrop) {
          setDrops(prev => [newDrop, ...prev].slice(0, 20));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  // Función para extraer los datos correctos según el modo de juego
  const parseSingleDrop = async (partida) => {
    try {
      let itemInfo = null;
      let winnerId = partida.creador_id; // Por defecto el creador
      let modeName = '';

      // Extraer datos si es de 'Cases' (Cajas solitarias)
      if (partida.modo_juego === 'cases' && partida.resultado?.ganador) {
        itemInfo = partida.resultado.ganador;
        modeName = 'Case';
      }
      // Extraer datos si es de 'Battles'
      else if (partida.modo_juego === 'battles' && partida.resultado?.ganador_id) {
        // En battles, el resultado guarda el mejor item de la ronda o simplemente el total. 
        // Para el drop, tomamos el item más valioso que se abrió.
        winnerId = partida.resultado.ganador_id;
        const allRounds = partida.resultado.rounds || [];
        if (allRounds.length > 0) {
            // Ordenamos los items ganados para mostrar el mejor
            const bestRoll = [...allRounds].sort((a,b) => (b.item.valor || b.item.value) - (a.item.valor || a.item.value))[0];
            itemInfo = bestRoll.item;
        }
        modeName = 'Battle';
      }

      // Si no es un modo que tire items (como coinflip o mines), lo ignoramos para esta barra
      if (!itemInfo) return null;

      // Obtener el avatar del ganador de la tabla perfiles
      const { data: profile } = await supabase.from('perfiles').select('username, avatar_url').eq('id', winnerId).single();

      return {
        id: partida.id,
        user: profile?.username || 'Player',
        avatar: profile?.avatar_url || '/default-avatar.png',
        itemName: itemInfo.name || itemInfo.nombre,
        itemImg: itemInfo.img || itemInfo.image_url,
        itemValue: itemInfo.valor || itemInfo.value,
        itemColor: itemInfo.color || '#9ca3af',
        mode: modeName
      };
    } catch (e) {
      console.error("Error parseando drop:", e);
      return null;
    }
  };

  const parseDrops = async (partidas) => {
    const dropsAwaited = await Promise.all(partidas.map(parseSingleDrop));
    return dropsAwaited.filter(d => d !== null);
  };

  return (
    <div className="w-full bg-[#0b0e14] border-b border-[#222630] overflow-hidden flex items-center h-[60px] relative z-30 shadow-md">
        
        {/* Sombras laterales para el efecto de desvanecimiento */}
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#0b0e14] to-transparent z-10 pointer-events-none"></div>
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0b0e14] to-transparent z-10 pointer-events-none"></div>
        
        <div className="flex items-center gap-2 px-4 h-full relative" style={{ width: 'max-content', animation: 'slideLeft 40s linear infinite' }}>
            
            {/* Si no hay drops aún */}
            {drops.length === 0 && (
               <div className="flex items-center gap-2 h-full px-8">
                  <span className="w-2 h-2 rounded-full bg-[#3AFF4E] animate-pulse"></span>
                  <span className="text-[#555b82] text-[10px] font-black uppercase tracking-widest">Awaiting live drops...</span>
               </div>
            )}
            
            {/* Renderizar los Drops (Duplicamos el array visualmente para que el scroll parezca infinito si hay pocos) */}
            {[...drops, ...drops].map((drop, idx) => (
                <div key={`${drop.id}-${idx}`} className="flex items-center gap-3 bg-[#14171f] border border-[#222630] rounded-lg p-1.5 min-w-[160px] max-w-[200px] shrink-0 hover:border-[#3f4354] transition-colors cursor-pointer group relative overflow-hidden">
                    
                    {/* Glow de color según la rareza de la mascota */}
                    <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity" style={{background: `radial-gradient(circle at left, ${drop.itemColor} 0%, transparent 70%)`}}></div>

                    <img src={drop.itemImg} className="w-8 h-8 object-contain drop-shadow-md group-hover:scale-110 transition-transform z-10" alt="item"/>
                    
                    <div className="flex flex-col flex-1 overflow-hidden z-10">
                        <div className="flex items-center justify-between gap-2">
                            <span className="text-[9px] font-bold truncate text-[#8f9ac6]" style={{color: drop.itemColor}}>{drop.itemName}</span>
                        </div>
                        <div className="flex items-center justify-between mt-0.5">
                            <span className="text-[10px] font-black text-white flex items-center gap-1"><RedCoin/> {formatValue(drop.itemValue)}</span>
                            <div className="w-4 h-4 rounded-sm overflow-hidden border border-[#222630] ml-1" title={drop.user}>
                                <img src={drop.avatar} className="w-full h-full object-cover" alt="user"/>
                            </div>
                        </div>
                    </div>
                </div>
            ))}
        </div>

        <style dangerouslySetInnerHTML={{__html: `
            /* Pausar la animación cuando el usuario pase el mouse por encima para poder ver un drop */
            .w-full:hover > div[style*="animation"] {
                animation-play-state: paused !important;
            }
            @keyframes slideLeft {
                from { transform: translateX(0); }
                to { transform: translateX(-50%); }
            }
        `}} />
    </div>
  );
}
