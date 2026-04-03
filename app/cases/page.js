"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';

// Componente de Tarjeta Estilo Wallet/Inventory
const PetCard = ({ pet, isSelected, onClick, disabled }) => {
  const color = pet.items?.color || '#ffffff';
  return (
    <div 
      onClick={!disabled ? onClick : null}
      className={`relative p-3 rounded-2xl border-2 transition-all duration-300 cursor-pointer overflow-hidden group
        ${isSelected ? 'border-[#00FF7F] bg-[#00FF7F]/10 shadow-[0_0_20px_rgba(0,255,127,0.2)]' : 'border-[#1f2128] bg-[#0a0a0a] hover:border-gray-500'}
        ${disabled ? 'opacity-50 grayscale cursor-not-allowed' : 'hover:-translate-y-1'}
      `}
    >
      {/* Resplandor de fondo dinámico */}
      <div className="absolute inset-0 opacity-10 group-hover:opacity-20 transition-opacity" style={{ background: `radial-gradient(circle at center, ${color} 0%, transparent 70%)` }}></div>
      
      {/* Badge de Limited / Serial */}
      {pet.is_limited && (
        <div className="absolute top-0 right-0 bg-yellow-500 text-black text-[10px] font-black px-2 py-1 rounded-bl-lg z-20 shadow-md">
          #{pet.serial_number}
        </div>
      )}

      <div className="relative z-10 flex flex-col items-center">
        <div className="relative mb-2">
          <div className="absolute inset-0 blur-xl opacity-30" style={{ backgroundColor: color }}></div>
          <img src={pet.items?.image_url} className="w-16 h-16 object-contain drop-shadow-xl relative z-10" alt={pet.items?.name} />
        </div>
        <p className="text-[11px] font-black uppercase tracking-wider text-center truncate w-full" style={{ color: pet.is_limited ? '#facc15' : color }}>
          {pet.items?.name}
        </p>
      </div>
    </div>
  );
};

export default function TradingRoom() {
  // ... (Estados de conexión y trade_id que ya tenemos)

  return (
    <div className="min-h-screen bg-[#08090b] text-white p-4 md:p-8 font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* PANEL PRINCIPAL DE NEGOCIACIÓN */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
          
          {/* LADO A: TU OFERTA (ESTILO WALLET) */}
          <div className={`flex flex-col bg-[#111216] rounded-[2.5rem] border-4 p-8 transition-all duration-500 ${myConfirmations >= 1 ? 'border-yellow-500 shadow-[0_0_40px_rgba(234,179,8,0.1)]' : 'border-[#1f2128]'}`}>
            <div className="flex justify-between items-center mb-8">
              <h2 className="text-3xl font-black italic">TU <span className="text-[#00FF7F]">OFERTA</span></h2>
              <div className="flex gap-2">
                <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${myConfirmations >= 1 ? 'bg-yellow-500 text-black' : 'bg-[#1f2128] text-gray-500'}`}>
                  {myConfirmations >= 1 ? 'BLOQUEADO' : 'EDITANDO'}
                </span>
              </div>
            </div>

            {/* Input de Saldo Verde (Visual de Wallet) */}
            <div className="bg-[#050505] rounded-2xl p-5 mb-8 border border-white/5 shadow-inner">
              <div className="flex justify-between items-center mb-2">
                <label className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Saldo Verde a Entregar</label>
                <span className="text-[#00FF7F] text-xs font-bold">Max: {myProfile?.saldo_verde.toLocaleString()}</span>
              </div>
              <div className="flex items-center gap-4">
                <img src="/green-coin.png" className="w-8 h-8 drop-shadow-[0_0_10px_#00FF7F]" />
                <input 
                  type="number"
                  disabled={myConfirmations >= 1}
                  value={myOffer.coins}
                  onChange={(e) => setMyOffer({...myOffer, coins: e.target.value})}
                  className="bg-transparent text-4xl font-black text-white outline-none w-full placeholder-gray-800"
                  placeholder="0"
                />
              </div>
            </div>

            {/* SELECCIÓN DE PETS (GRID DE WALLET) */}
            <div className="flex-1">
              <h3 className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] mb-4">Seleccionar Mascotas</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                {myInventory.map(pet => (
                  <PetCard 
                    key={pet.id} 
                    pet={pet} 
                    isSelected={myOffer.items.some(i => i.id === pet.id)}
                    onClick={() => toggleItemInOffer(pet)}
                    disabled={myConfirmations >= 1}
                  />
                ))}
              </div>
            </div>

            {/* BOTÓN DE DOBLE CONFIRMACIÓN */}
            <div className="mt-8 space-y-3">
               <button 
                onClick={handleFirstConfirm}
                disabled={myConfirmations >= 1}
                className={`w-full py-5 rounded-2xl font-black uppercase tracking-widest transition-all
                  ${myConfirmations === 0 ? 'bg-white text-black hover:scale-[1.02] active:scale-95 shadow-xl' : 'bg-[#1f2128] text-gray-600'}
                `}
               >
                 {myConfirmations >= 1 ? "✓ OFERTA BLOQUEADA" : "CONFIRMAR OFERTA (1/2)"}
               </button>
               
               {myConfirmations === 1 && partnerConfirmations === 1 && (
                 <button 
                  onClick={handleFinalConfirm}
                  className="w-full py-6 bg-[#00FF7F] text-black rounded-2xl font-black text-xl uppercase tracking-tighter animate-bounceIn shadow-[0_0_30px_rgba(0,255,127,0.4)]"
                 >
                   ACEPTAR TRATO FINAL (2/2)
                 </button>
               )}
            </div>
          </div>

          {/* LADO B: RIVAL (VISUAL ESPEJO) */}
          <div className="bg-[#0e0f13] rounded-[2.5rem] border-4 border-[#1f2128] p-8 flex flex-col relative opacity-90 overflow-hidden">
            {/* ... Lógica similar para mostrar la oferta del rival ... */}
            <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px] flex items-center justify-center z-10">
                <div className="text-center">
                    <div className="w-12 h-12 border-4 border-[#00FF7F] border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                    <p className="text-gray-400 font-black uppercase text-xs tracking-widest">Esperando que el rival <br/> prepare su oferta...</p>
                </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
