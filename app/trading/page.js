"use client";

import React, { useState, useEffect } from 'react';

export default function TradingHub() {
  // Navegación
  const [activeTab, setActiveTab] = useState('hub'); // 'hub', 'requests', 'trade_room'
  
  // Datos del Usuario (Basados en tu tabla 'profiles' e 'inventory')
  const [saldoVerde, setSaldoVerde] = useState(0);
  const [myInventory, setMyInventory] = useState([]);
  
  // Estados del Trade Activo
  const [tradeOffer, setTradeOffer] = useState({ saldo_verde: 0, items: [] });
  const [partnerOffer, setPartnerOffer] = useState({ saldo_verde: 0, items: [] });
  const [isLocked, setIsLocked] = useState(false);
  const [partnerLocked, setPartnerLocked] = useState(false);

  // MOCK DE CARGA INICIAL (Aquí meterás tus fetch de Supabase reales)
  useEffect(() => {
    // Simulando fetch a perfiles e inventario (reemplazar con llamadas reales)
    setSaldoVerde(25000); // Viene de profiles.saldo_verde
    setMyInventory([
      // Viene de inventory JOIN items
      { id: 'uuid-1', item_id: 'pet_001', name: 'Gato Galáctico', color: 'Purple', is_limited: true, serial_number: 14, locked: false },
      { id: 'uuid-2', item_id: 'pet_002', name: 'Perro Base', color: 'White', is_limited: false, serial_number: null, locked: false },
    ]);
  }, []);

  const handlePetToggle = (pet) => {
    if (isLocked || pet.locked) return; // No puede tradear pets bloqueadas o si ya le dio a 'Listo'
    
    const isSelected = tradeOffer.items.some(p => p.id === pet.id);
    if (isSelected) {
      setTradeOffer({ ...tradeOffer, items: tradeOffer.items.filter(p => p.id !== pet.id) });
    } else {
      setTradeOffer({ ...tradeOffer, items: [...tradeOffer.items, pet] });
    }
  };

  return (
    <div className="min-h-screen bg-[#0b0c10] text-white p-6 font-sans">
      
      {/* HEADER TIPO WALLET */}
      <div className="max-w-6xl mx-auto mb-8 bg-[#1e1f22] p-6 rounded-2xl border-b-4 border-[#00FF7F] shadow-[0_4px_20px_rgba(0,255,127,0.15)] flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-black tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-[#00FF7F] to-[#00b359]">
            MERCADO NEGRO
          </h1>
          <p className="text-gray-400 font-medium mt-1">Trading Hub Oficial</p>
        </div>
        <div className="flex gap-4">
          <button 
            onClick={() => setActiveTab('hub')}
            className={`px-4 py-2 font-bold rounded-lg transition-colors ${activeTab === 'hub' ? 'bg-[#00FF7F] text-black' : 'bg-[#2b2d31] text-gray-300 hover:bg-[#383a40]'}`}
          >
            Jugadores
          </button>
          <button 
            onClick={() => setActiveTab('requests')}
            className={`px-4 py-2 font-bold rounded-lg transition-colors relative ${activeTab === 'requests' ? 'bg-[#00FF7F] text-black' : 'bg-[#2b2d31] text-gray-300 hover:bg-[#383a40]'}`}
          >
            Solicitudes
            <span className="absolute -top-2 -right-2 bg-red-500 text-white text-xs w-5 h-5 flex items-center justify-center rounded-full">1</span>
          </button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto">
        {/* PESTAÑA 1: LISTA DE JUGADORES */}
        {activeTab === 'hub' && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="bg-[#1e1f22] border border-[#2b2d31] rounded-xl p-5 hover:border-[#00FF7F] transition-all duration-300 shadow-lg group">
                <div className="flex items-center gap-4 mb-4">
                  <img src={`https://api.dicebear.com/7.x/avataaars/svg?seed=${i}`} alt="Avatar" className="w-14 h-14 rounded-full border-2 border-transparent group-hover:border-[#00FF7F] transition-colors" />
                  <div>
                    <h3 className="font-bold text-lg">Usuario_{i}</h3>
                    <p className="text-[#00FF7F] text-sm font-bold">Nivel 15</p>
                  </div>
                </div>
                <button 
                  onClick={() => setActiveTab('trade_room')}
                  className="w-full bg-[#0b0c10] text-[#00FF7F] border border-[#00FF7F] py-2 rounded-lg font-bold hover:bg-[#00FF7F] hover:text-black transition-colors"
                >
                  Proponer Trato
                </button>
              </div>
            ))}
          </div>
        )}

        {/* PESTAÑA 2: SOLICITUDES ENTRANTES */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="bg-[#1e1f22] border-l-4 border-[#00FF7F] rounded-r-xl p-5 flex flex-col sm:flex-row justify-between items-center shadow-md">
              <div className="flex items-center gap-4 mb-4 sm:mb-0">
                 <img src="https://api.dicebear.com/7.x/avataaars/svg?seed=trader" alt="Avatar" className="w-12 h-12 rounded-full bg-gray-600" />
                 <div>
                   <h4 className="font-bold text-lg">El_Patron quiere intercambiar contigo.</h4>
                   <p className="text-sm text-gray-400">Expira en 5 minutos...</p>
                 </div>
              </div>
              <div className="flex gap-3 w-full sm:w-auto">
                <button className="flex-1 sm:flex-none bg-[#2b2d31] text-red-400 border border-red-500/30 px-5 py-2 rounded-lg hover:bg-red-500 hover:text-white transition-colors font-bold">
                  Rechazar
                </button>
                <button 
                  onClick={() => setActiveTab('trade_room')}
                  className="flex-1 sm:flex-none bg-[#00FF7F] text-black px-5 py-2 rounded-lg hover:bg-[#00cc66] transition-colors font-bold shadow-[0_0_15px_rgba(0,255,127,0.4)]"
                >
                  Entrar a Sala
                </button>
              </div>
            </div>
          </div>
        )}

        {/* PESTAÑA 3: LA SALA DE TRADEO (TRADE ROOM) */}
        {activeTab === 'trade_room' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            
            {/* PANEL IZQUIERDO: TÚ */}
            <div className={`bg-[#1e1f22] rounded-2xl p-6 border-2 transition-all duration-300 ${isLocked ? 'border-[#00FF7F] shadow-[0_0_20px_rgba(0,255,127,0.2)]' : 'border-[#2b2d31]'}`}>
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-white">TU OFERTA</h2>
                {isLocked && <span className="bg-[#00FF7F] text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider animate-pulse">Confirmado</span>}
              </div>
              
              {/* Input Saldo Verde */}
              <div className="bg-[#0b0c10] rounded-xl p-4 mb-6 border border-[#2b2d31]">
                <div className="flex justify-between mb-2">
                  <label className="text-gray-400 text-sm font-bold">Saldo Verde</label>
                  <span className="text-[#00FF7F] text-sm font-bold">Disponible: {saldoVerde.toLocaleString()}</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[#00FF7F]/20 flex items-center justify-center border border-[#00FF7F]">
                    <span className="text-[#00FF7F] font-bold">$</span>
                  </div>
                  <input 
                    type="number" 
                    disabled={isLocked}
                    className="bg-transparent text-white text-3xl font-black w-full outline-none placeholder-gray-600"
                    placeholder="0"
                    value={tradeOffer.saldo_verde || ''}
                    onChange={(e) => {
                      const val = Number(e.target.value);
                      if (val <= saldoVerde && val >= 0) setTradeOffer({...tradeOffer, saldo_verde: val});
                    }}
                  />
                </div>
              </div>

              {/* Inventario de Mascotas */}
              <div className="mb-6">
                <label className="text-gray-400 text-sm font-bold block mb-3">Tu Inventario</label>
                <div className="grid grid-cols-2 gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar">
                  {myInventory.map(pet => {
                    const isSelected = tradeOffer.items.some(p => p.id === pet.id);
                    return (
                      <div 
                        key={pet.id} 
                        onClick={() => handlePetToggle(pet)}
                        className={`cursor-pointer p-4 rounded-xl border-2 transition-all relative overflow-hidden
                          ${pet.locked ? 'opacity-50 grayscale cursor-not-allowed border-red-500/30' : ''}
                          ${isSelected ? 'border-[#00FF7F] bg-[#00FF7F]/10' : 'border-[#2b2d31] bg-[#0b0c10] hover:border-gray-500'}
                        `}
                      >
                        {pet.is_limited && (
                          <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[10px] font-black px-2 py-1 rounded-bl-lg">
                            #{pet.serial_number}
                          </div>
                        )}
                        <h3 className="text-white font-bold text-sm truncate mt-2">{pet.name}</h3>
                        <p className="text-xs text-gray-500 font-medium mt-1">{pet.item_id}</p>
                      </div>
                    );
                  })}
                </div>
              </div>

              <button 
                onClick={() => setIsLocked(!isLocked)}
                className={`w-full py-4 rounded-xl font-black text-lg transition-all ${isLocked ? 'bg-red-500/20 text-red-500 border border-red-500 hover:bg-red-500 hover:text-white' : 'bg-[#00FF7F] hover:bg-[#00cc66] text-black shadow-[0_0_15px_rgba(0,255,127,0.3)]'}`}
              >
                {isLocked ? 'CANCELAR CONFIRMACIÓN' : 'CONFIRMAR OFERTA'}
              </button>
            </div>

            {/* PANEL DERECHO: RIVAL */}
            <div className="bg-[#1e1f22] rounded-2xl p-6 border-2 border-[#2b2d31] relative">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-black text-gray-300">OFERTA DE RIVAL</h2>
                {partnerLocked ? (
                  <span className="bg-[#00FF7F] text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider">Confirmado</span>
                ) : (
                  <span className="bg-orange-500 text-black text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider animate-pulse">Editando...</span>
                )}
              </div>
              
              <div className="bg-[#0b0c10] rounded-xl p-4 mb-6 border border-[#2b2d31] opacity-90">
                <label className="text-gray-400 text-sm font-bold block mb-2">Saldo Verde Ofertado</label>
                <div className="flex items-center gap-3">
                   <div className="w-8 h-8 rounded-full bg-[#00FF7F]/20 flex items-center justify-center border border-[#00FF7F]">
                    <span className="text-[#00FF7F] font-bold">$</span>
                  </div>
                  <span className="text-white text-3xl font-black">{partnerOffer.saldo_verde.toLocaleString()}</span>
                </div>
              </div>

              <div className="mb-6 opacity-90">
                <label className="text-gray-400 text-sm font-bold block mb-3">Mascotas Ofertadas</label>
                <div className="grid grid-cols-2 gap-3 min-h-[100px]">
                  {partnerOffer.items.length === 0 ? (
                    <div className="col-span-2 text-center text-gray-500 text-sm font-medium py-8 border border-dashed border-[#2b2d31] rounded-xl">
                      Esperando que el rival añada items...
                    </div>
                  ) : (
                    partnerOffer.items.map(pet => (
                      <div key={pet.id} className="p-4 rounded-xl border-2 border-[#2b2d31] bg-[#0b0c10] relative">
                         {pet.is_limited && (
                          <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[10px] font-black px-2 py-1 rounded-bl-lg">
                            #{pet.serial_number}
                          </div>
                        )}
                        <h3 className="text-white font-bold text-sm truncate mt-2">{pet.name}</h3>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Botón Final (Solo se habilita si ambos confirmaron) */}
              <div className="mt-auto pt-6 border-t border-[#2b2d31]">
                <button 
                  disabled={!(isLocked && partnerLocked)}
                  className={`w-full py-4 rounded-xl font-black text-lg transition-all ${
                    isLocked && partnerLocked 
                    ? 'bg-[#00FF7F] text-black shadow-[0_0_20px_rgba(0,255,127,0.5)] hover:scale-[1.02]' 
                    : 'bg-[#2b2d31] text-gray-500 cursor-not-allowed'
                  }`}
                >
                  EJECUTAR INTERCAMBIO
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
