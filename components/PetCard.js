"use client";
import React from 'react';

const GreenCoin = ({cls="w-3.5 h-3.5"}) => <img src="/green-coin.png" className={`${cls} inline-block grayscale opacity-90`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

export default function PetCard({ 
    item, 
    pet, // Soporte por si algún archivo viejo usa 'pet' en lugar de 'item'
    onClick, 
    isSelected = false, 
    showValue = true, 
    showChance = false,
    selectable = false
}) {
    // 🧠 MOTOR DE NORMALIZACIÓN UNIVERSAL (Wallet, Market, Cases, Trading)
    const data = item || pet;
    if (!data) return null;

    const name = data.items?.name || data.name || 'Unknown';
    const img = data.items?.image_url || data.image_url || data.img || '/default-pet.png';
    const color = data.items?.color || data.color || '#9ca3af';
    
    // Detecta Limited/Mythic desde cualquier formato de DB
    const isMythic = data.items?.is_mythic || data.items?.is_limited || data.is_mythic || data.is_limited || data.rarity === 'Limited' || false;
    
    // Extra Data
    const serial = data.serial_number || data.serial || null;
    const owner = data.original_owner || data.originalOwner || null;
    const value = data.items?.value || data.value || data.valor || data.price || 0;
    const chance = data.chance || null;

    return (
        <div 
            onClick={onClick}
            className={`relative w-full h-full min-h-[220px] rounded-xl transition-all duration-300 cursor-pointer overflow-hidden group p-[2px]
                ${isSelected ? 'scale-105 z-10' : (onClick ? 'hover:-translate-y-1 hover:shadow-xl' : '')}
            `}
            style={{ 
                boxShadow: isSelected ? `0 0 20px ${isMythic ? 'rgba(250,204,21,0.6)' : 'rgba(58,255,78,0.6)'}` : ''
            }}
        >
            {/* --- FONDO ANIMADO O BORDE --- */}
            {isMythic ? (
                <div className="absolute inset-0 z-0 overflow-hidden rounded-xl">
                    <div className="absolute -inset-[100%] animate-spin-slow" style={{ background: 'conic-gradient(from 0deg, transparent 0 340deg, rgba(250,204,21,0.8) 360deg)' }}></div>
                </div>
            ) : (
                <div className={`absolute inset-0 rounded-xl transition-colors ${isSelected ? 'bg-[#3AFF4E]' : 'bg-[#252839] group-hover:bg-cyan-500'}`}></div>
            )}

            {/* --- CONTENEDOR INTERNO --- */}
            <div className={`relative h-full w-full rounded-[10px] flex flex-col items-center justify-between overflow-hidden bg-[#0a0a0a] z-10`}>
                
                {/* Glow Radial Interno */}
                {isMythic ? (
                    <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,rgba(250,204,21,0.15)_0%,transparent_80%)] z-0 pointer-events-none"></div>
                ) : (
                    <div className="absolute inset-0 opacity-20 group-hover:opacity-40 transition-opacity duration-500 z-0 pointer-events-none">
                        <div className="w-[150%] h-[150%] absolute -top-1/4 -left-1/4" style={{ background: `radial-gradient(circle at center, ${color} 0%, transparent 70%)` }}></div>
                    </div>
                )}

                {/* --- OVERLAYS TOP --- */}
                {/* Banner Mythic */}
                {isMythic && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-max z-30">
                        <div className="bg-gradient-to-r from-yellow-600 via-yellow-400 to-yellow-600 text-[#0a0a0a] text-[9px] font-black px-4 py-0.5 rounded-b-md uppercase tracking-[0.2em] shadow-[0_0_15px_rgba(250,204,21,0.8)] border-b-2 border-yellow-200">
                            Mythic
                        </div>
                    </div>
                )}

                {/* Checkbox (Wallet/Trading) */}
                {selectable && (
                    <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all z-30
                        ${isSelected ? 'bg-[#3AFF4E] border-[#3AFF4E] shadow-[0_0_10px_rgba(58,255,78,0.8)]' : 'bg-black/50 border-[#555b82] group-hover:border-gray-400'}
                    `}>
                        {isSelected && <span className="text-black text-xs font-black">✓</span>}
                    </div>
                )}

                {/* Badge de Probabilidad (Cases) */}
                {showChance && chance && (
                    <div className="absolute top-2 right-2 text-[10px] font-black px-1.5 py-0.5 rounded bg-black/80 border text-white z-20" style={{borderColor: color}}>
                        {chance}%
                    </div>
                )}

                {/* --- IMAGEN DE LA PET --- */}
                <div className="relative w-full flex-1 flex items-center justify-center mt-6 mb-2 z-10 pointer-events-none">
                    <div className={`absolute w-16 h-16 rounded-full blur-[20px] transition-opacity duration-300 ${isMythic ? 'opacity-70 bg-yellow-500 animate-pulse' : 'opacity-40'}`} style={!isMythic ? { backgroundColor: color } : {}}></div>
                    <img 
                        src={img} 
                        className={`w-20 h-20 object-contain drop-shadow-[0_15px_15px_rgba(0,0,0,0.8)] transition-transform duration-500 relative z-10 ${isMythic ? 'animate-float' : 'group-hover:scale-110'}`} 
                        alt={name}
                    />
                </div>
                
                {/* --- INFO BOTTOM --- */}
                <div className="w-full text-center z-10 bg-[#111827]/90 rounded-b-[10px] rounded-t-sm pt-2 pb-2 px-2 backdrop-blur-md border-t border-[#374151]/50 relative overflow-hidden flex flex-col items-center">
                    <div className="absolute top-0 left-0 w-full h-[1px]" style={{ background: `linear-gradient(90deg, transparent, ${isMythic ? '#facc15' : color}, transparent)` }}></div>
                    
                    <div className="text-[11px] truncate w-full text-white font-black uppercase tracking-widest px-1 mb-1" style={{textShadow: `0 2px 4px rgba(0,0,0,0.8)`, color: isMythic ? '#facc15' : 'white'}}>
                        {name}
                    </div>
                    
                    {/* MetaData Mítica (Serial) */}
                    {isMythic && serial && (
                       <div className="flex flex-col items-center bg-[#0a0a0a] border border-yellow-500/40 w-full rounded p-1 mb-1 shadow-inner">
                           <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest">#{serial}</span>
                           {owner && <span className="text-[7px] font-bold text-gray-400 truncate w-full uppercase">Own: {owner}</span>}
                       </div>
                    )}

                    {/* Precio */}
                    {showValue && value > 0 && (
                        <div className="flex items-center justify-center gap-1 bg-[#0a0a0a]/60 rounded px-2 py-1 border border-[#2F3347] w-full mt-0.5">
                            <GreenCoin /> 
                            <span className="text-gray-200 text-xs font-black">
                                {formatValue(value)}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            <style dangerouslySetInnerHTML={{__html: `
                @keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }
                .animate-spin-slow { animation: spin 4s linear infinite; }
                @keyframes float { 0% { transform: translateY(0px); } 50% { transform: translateY(-8px); } 100% { transform: translateY(0px); } }
                .animate-float { animation: float 3s ease-in-out infinite; }
            `}} />
        </div>
    );
}
