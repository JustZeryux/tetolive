"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

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
    // 1. Cargar el historial reciente (Hacemos JOIN de inventory + profiles + items)
    const fetchRecentDrops = async () => {
      const { data, error } = await supabase
        .from('inventory')
        .select(`
          id,
          created_at,
          profiles ( username, avatar_url ),
          items ( name, image_url, color, value )
        `)
        .order('created_at', { ascending: false })
        .limit(20);

      if (!error && data) {
        const parsedDrops = data.map(d => ({
          id: d.id,
          user: d.profiles?.username || 'Player',
          avatar: d.profiles?.avatar_url || '/default-avatar.png',
          itemName: d.items?.name || 'Unknown Item',
          itemImg: d.items?.image_url || '/missing.png',
          itemValue: d.items?.value || 0,
          itemColor: d.items?.color || '#9ca3af'
        }));
        setDrops(parsedDrops);
      }
    };

    fetchRecentDrops();

    // 2. Escuchar EN VIVO la tabla inventory (cada vez que alguien gana una pet)
    const channel = supabase.channel('live_drops_bar')
      .on('postgres_changes', { 
        event: 'INSERT', 
        schema: 'public', 
        table: 'inventory'
      }, async (payload) => {
        // Obtenemos los detalles del usuario y la mascota que acaba de ganar
        const { data: profile } = await supabase.from('profiles').select('username, avatar_url').eq('id', payload.new.user_id).single();
        const { data: item } = await supabase.from('items').select('name, image_url, color, value').eq('id', payload.new.item_id).single();
        
        if (item) {
          const newDrop = {
            id: payload.new.id,
            user: profile?.username || 'Player',
            avatar: profile?.avatar_url || '/default-avatar.png',
            itemName: item.name,
            itemImg: item.image_url,
            itemValue: item.value,
            itemColor: item.color
          };
          // Agregamos al inicio de la barra
          setDrops(prev => [newDrop, ...prev].slice(0, 20));
        }
      })
      .subscribe();

    return () => supabase.removeChannel(channel);
  }, []);

  return (
    <div className="w-full bg-[#0b0e14] border-b border-[#222630] overflow-hidden flex items-center h-[60px] relative z-30 shadow-md">
        <div className="absolute left-0 top-0 bottom-0 w-12 bg-gradient-to-r from-[#0b0e14] to-transparent z-10 pointer-events-none"></div>
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-[#0b0e14] to-transparent z-10 pointer-events-none"></div>
        
        <div className="flex items-center gap-2 px-4 h-full relative" style={{ width: 'max-content', animation: 'slideLeft 40s linear infinite' }}>
            {drops.length === 0 && (
               <div className="flex items-center gap-2 h-full px-8">
                  <span className="w-2 h-2 rounded-full bg-[#3AFF4E] animate-pulse"></span>
                  <span className="text-[#555b82] text-[10px] font-black uppercase tracking-widest">Awaiting live drops...</span>
               </div>
            )}
            
            {[...drops, ...drops].map((drop, idx) => (
                <div key={`${drop.id}-${idx}`} className="flex items-center gap-3 bg-[#14171f] border border-[#222630] rounded-lg p-1.5 min-w-[160px] max-w-[200px] shrink-0 hover:border-[#3f4354] transition-colors cursor-pointer group relative overflow-hidden">
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
            .w-full:hover > div[style*="animation"] { animation-play-state: paused !important; }
            @keyframes slideLeft { from { transform: translateX(0); } to { transform: translateX(-50%); } }
        `}} />
    </div>
  );
}
