"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

export default function SuperTradingHub() {
  const [view, setView] = useState('hub'); // 'hub', 'room'
  const [myProfile, setMyProfile] = useState(null);
  const [myInventory, setMyInventory] = useState([]);
  const [users, setUsers] = useState([]);
  const [activeTrade, setActiveTrade] = useState(null);
  const [myConfirmations, setMyConfirmations] = useState(0); // 0, 1, 2
  const [partnerConfirmations, setPartnerConfirmations] = useState(0);

  // Estados de oferta local
  const [myOffer, setMyOffer] = useState({ coins: 0, items: [] });

  useEffect(() => {
    const start = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase.from('profiles').select('*').eq('id', user.id).single();
      setMyProfile(prof);
      
      const { data: inv } = await supabase.from('inventory').select('*, items(*)').eq('user_id', user.id).eq('locked', false);
      setMyInventory(inv || []);

      const { data: u } = await supabase.from('profiles').select('*').neq('id', user.id).limit(10);
      setUsers(u || []);
    };
    start();
  }, []);

  const toggleItemInOffer = (item) => {
    if (myConfirmations > 0) return; // Bloqueado si ya confirmó
    const exists = myOffer.items.find(i => i.id === item.id);
    if (exists) {
      setMyOffer({...myOffer, items: myOffer.items.filter(i => i.id !== item.id)});
    } else {
      setMyOffer({...myOffer, items: [...myOffer.items, item]});
    }
  };

  return (
    <div className="min-h-screen bg-[#08090b] text-white p-6 font-sans selection:bg-[#00FF7F] selection:text-black">
      {view === 'hub' ? (
        <div className="max-w-6xl mx-auto">
          <h1 className="text-6xl font-black italic tracking-tighter mb-10">MERCADO <span className="text-[#00FF7F]">NEGRO</span></h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {users.map(u => (
              <div key={u.id} className="bg-[#111216] border-2 border-[#1f2128] p-6 rounded-3xl hover:border-[#00FF7F] transition-all group">
                <img src={u.avatar_url} className="w-20 h-20 rounded-2xl mb-4 bg-black" />
                <h3 className="text-xl font-bold">{u.username}</h3>
                <p className="text-[#00FF7F] text-xs font-black mb-6 uppercase">Nivel {u.level}</p>
                <button onClick={() => { setActiveTrade({ partner: u }); setView('room'); }} className="w-full py-3 bg-[#00FF7F] text-black font-black rounded-xl uppercase text-xs tracking-widest shadow-[0_0_20px_rgba(0,255,127,0.2)] hover:scale-105 transition-all">Iniciar Negociación</button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="max-w-7xl mx-auto animate-fadeIn">
          {/* SALA DE TRADE (DASHBOARD) */}
          <div className="flex justify-between items-center mb-8 bg-[#111216] p-6 rounded-3xl border border-[#1f2128]">
            <button onClick={() => setView('hub')} className="text-gray-500 hover:text-white font-bold uppercase text-xs">← Abortar Trato</button>
            <div className="text-center">
              <span className="text-[10px] text-gray-500 uppercase font-black tracking-widest">Estado del Intercambio</span>
              <h2 className="text-2xl font-black text-[#00FF7F]">NEGOCIACIÓN ACTIVA</h2>
            </div>
            <div className="w-20"></div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* PANEL IZQUIERDO (TÚ) */}
            <div className={`p-8 rounded-[2rem] border-4 transition-all ${myConfirmations === 2 ? 'border-[#00FF7F] bg-[#00FF7F]/5' : myConfirmations === 1 ? 'border-yellow-500 bg-yellow-500/5' : 'border-[#1f2128] bg-[#111216]'}`}>
              <div className="flex justify-between items-start mb-8">
                <h3 className="text-3xl font-black">TU LADO</h3>
                <div className="flex gap-2">
                  <div className={`w-3 h-3 rounded-full ${myConfirmations >= 1 ? 'bg-yellow-500 shadow-[0_0_10px_yellow]' : 'bg-gray-800'}`}></div>
                  <div className={`w-3 h-3 rounded-full ${myConfirmations >= 2 ? 'bg-[#00FF7F] shadow-[0_0_10px_#00FF7F]' : 'bg-gray-800'}`}></div>
                </div>
              </div>

              {/* Coins Verdes */}
              <div className="bg-black/40 rounded-2xl p-6 mb-6 border border-white/5">
                <p className="text-[10px] text-gray-500 uppercase font-black mb-2">Monto en Monedas Verdes</p>
                <input 
                  type="number" 
                  disabled={myConfirmations > 0}
                  className="bg-transparent text-4xl font-black text-[#00FF7F] w-full outline-none"
                  value={myOffer.coins}
                  onChange={(e) => setMyOffer({...myOffer, coins: e.target.value})}
                />
              </div>

              {/* Items en la mesa */}
              <div className="grid grid-cols-3 gap-3 mb-8 h-48 overflow-y-auto">
                {myOffer.items.map(item => (
                  <div key={item.id} className="bg-black/60 p-2 rounded-xl border border-[#00FF7F]/30 relative animate-scaleIn">
                    <img src={item.items.image_url} className="w-full h-12 object-contain" />
                    <p className="text-[8px] text-center font-bold mt-1 uppercase truncate">{item.items.name}</p>
                  </div>
                ))}
              </div>

              <button 
                onClick={() => setMyConfirmations(myConfirmations + 1)}
                disabled={myConfirmations >= 2}
                className={`w-full py-5 rounded-2xl font-black text-sm uppercase tracking-[0.2em] transition-all ${myConfirmations === 0 ? 'bg-white text-black hover:invert' : 'bg-[#1f2128] text-gray-500'}`}
              >
                {myConfirmations === 0 ? "BLOQUEAR OFERTA (1/2)" : myConfirmations === 1 ? "ESPERANDO CONFIRMACIÓN FINAL (2/2)" : "LISTO PARA TRANSFERIR"}
              </button>
            </div>

            {/* PANEL DERECHO (PARTNER) */}
            <div className="p-8 rounded-[2rem] border-4 border-[#1f2128] bg-[#111216] opacity-80">
              <h3 className="text-3xl font-black mb-8 uppercase text-gray-600">{activeTrade.partner.username}</h3>
              {/* Estructura espejo del rival... */}
              <div className="h-full flex flex-col justify-center items-center text-gray-600 italic">
                <p>Esperando acción del rival...</p>
                <div className="flex gap-4 mt-4">
                    <div className="w-4 h-4 rounded-full bg-gray-800 animate-pulse"></div>
                    <div className="w-4 h-4 rounded-full bg-gray-800 animate-pulse delay-75"></div>
                </div>
              </div>
            </div>
          </div>
          
          {/* BOTÓN MAESTRO DE EJECUCIÓN (Solo aparece cuando ambos están en 2/2) */}
          {myConfirmations === 2 && (
            <div className="mt-10 animate-bounceIn">
               <button className="w-full py-8 bg-[#00FF7F] text-black text-2xl font-black rounded-3xl shadow-[0_0_50px_rgba(0,255,127,0.4)] hover:scale-[1.02] transition-all">
                  EJECUTAR CONTRATO DE INTERCAMBIO
               </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
