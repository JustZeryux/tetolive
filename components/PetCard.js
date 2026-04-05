"use client";
import React from 'react';

const GreenCoin = ({cls="w-3.5 h-3.5"}) => <img src="/green-coin.png" className={`${cls} inline-block grayscale opacity-90`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

// --- HELPERS DE RAREZA ---
const getPetVariants = (name, isDBLimited) => {
  const lowerName = (name || '').toLowerCase();
  return {
    isShiny: lowerName.includes('shiny'),
    isMythic: lowerName.includes('mythic') || isDBLimited, // Un limited de DB siempre es al menos Mythic
    isXL: lowerName.includes('xl') 
  };
};

const getRarityClass = (variants) => {
  if (variants.isXL) return "rarity-xl";
  if (variants.isShiny && variants.isMythic) return "rarity-shiny-mythic";
  if (variants.isMythic) return "rarity-mythic";
  if (variants.isShiny) return "rarity-shiny";
  return "rarity-standard";
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
    const isDBLimited = data.items?.is_mythic || data.items?.is_limited || data.is_mythic || data.is_limited || data.rarity === 'Limited' || false;
    
    // Extra Data
    const serial = data.serial_number || data.serial || null;
    const owner = data.original_owner || data.originalOwner || null;
    const value = data.items?.value || data.value || data.valor || data.price || 0;
    const chance = data.chance || null;

    // Calculamos las clases visuales Premium
    const variants = getPetVariants(name, isDBLimited);
    const rarityClass = getRarityClass(variants);
    const isRare = showChance && chance && chance < 1; // Menos del 1% activa el pulso rojo

    // Clases dinámicas principales
    const cardClasses = `pet-card-visual ${rarityClass} ${isRare ? 'is-rare' : ''} ${isSelected ? 'is-selected' : ''} ${onClick ? 'is-clickable' : ''}`;

    return (
        <div 
            onClick={onClick}
            className={`relative w-full h-full min-h-[220px] transition-all duration-300 ${onClick ? 'cursor-pointer' : ''} ${isSelected ? 'scale-105 z-20' : 'z-10'}`}
        >
            <div className={cardClasses} style={{ '--item-color': color }}>
                
                {/* Capas de Brillo y Efectos */}
                <div className="pet-glow-layer"></div>
                <div className="pet-sparkle-overlay"></div>
                {variants.isXL && <div className="xl-particle-effect"></div>}

                {/* --- OVERLAYS TOP --- */}
                {/* Banner Rarity (Si es Mythic/XL) */}
                {(variants.isMythic || variants.isXL) && !isSelected && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-max z-30 pointer-events-none">
                        <div className={`text-[8px] font-black px-3 py-0.5 rounded-b-md uppercase tracking-[0.2em] shadow-lg border-b-2
                            ${variants.isXL ? 'bg-gradient-to-r from-yellow-300 via-white to-yellow-300 text-yellow-900 border-yellow-100 shadow-[0_0_15px_#FFD700]' : 
                            variants.isShiny ? 'bg-gradient-to-r from-cyan-400 via-purple-500 to-cyan-400 text-white border-cyan-200' : 
                            'bg-gradient-to-r from-red-600 via-rose-400 to-red-600 text-white border-rose-200 shadow-[0_0_10px_#DC143C]'}`
                        }>
                            {variants.isXL ? 'XL PURE' : (variants.isShiny ? 'SHINY MYTHIC' : 'MYTHIC')}
                        </div>
                    </div>
                )}

                {/* Checkbox (Wallet/Trading) */}
                {selectable && (
                    <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all z-30 shadow-md
                        ${isSelected ? 'bg-[#3AFF4E] border-[#3AFF4E] shadow-[0_0_15px_rgba(58,255,78,0.8)]' : 'bg-black/60 border-gray-500 hover:border-gray-300 backdrop-blur-sm'}
                    `}>
                        {isSelected && <span className="text-black text-xs font-black drop-shadow-md">✓</span>}
                    </div>
                )}

                {/* Badge de Probabilidad (Cases) */}
                {showChance && chance && (
                    <div className="pet-chance-badge" style={{borderColor: `${color}50`}}>
                        {chance.toFixed(variants.isXL || chance < 0.1 ? 2 : 1)}%
                    </div>
                )}

                {/* --- IMAGEN DE LA PET --- */}
                <div className="pet-image-container mt-4 mb-2 pointer-events-none">
                    <img 
                        src={img} 
                        className={`pet-image ${variants.isMythic || variants.isXL ? 'animate-float' : ''}`} 
                        alt={name}
                    />
                </div>
                
                {/* --- INFO BOTTOM --- */}
                <div className="pet-info-bar">
                    <div className="pet-name" style={{ color: variants.isXL ? '#FFD700' : (variants.isShiny && variants.isMythic ? 'transparent' : 'white') }}>
                        {name}
                    </div>
                    
                    {/* MetaData Mítica (Serial & Owner) */}
                    {(variants.isMythic || isDBLimited) && serial && (
                       <div className="flex flex-col items-center bg-black/60 border border-yellow-500/30 w-full rounded p-1 my-1 shadow-inner backdrop-blur-sm">
                           <span className="text-[10px] font-black text-yellow-400 uppercase tracking-widest drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]">#{serial}</span>
                           {owner && <span className="text-[7.5px] font-bold text-gray-400 truncate w-full uppercase mt-0.5">Own: {owner}</span>}
                       </div>
                    )}

                    {/* Precio / Valor */}
                    {showValue && value > 0 && (
                        <div className="flex items-center justify-center gap-1 bg-black/50 rounded px-2 py-1 border border-white/10 w-full mt-1 backdrop-blur-md">
                            <GreenCoin /> 
                            <span className="text-gray-200 text-[11px] font-black tracking-wide">
                                {formatValue(value)}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* --- ESTILOS INYECTADOS --- */}
            {/* Si ya tienes estos estilos globales por CasesPage.js, puedes omitir esta etiqueta, pero dejarla asegura que PetCard funcione en cualquier parte */}
            <style dangerouslySetInnerHTML={{__html: `
                .pet-card-visual {
                    background: #111827;
                    border-radius: 0.75rem;
                    display: flex;
                    flex-direction: column;
                    align-items: center;
                    justify-content: center;
                    position: absolute;
                    inset: 0;
                    transition: all 0.3s cubic-bezier(0.2, 0.8, 0.2, 1);
                    box-shadow: 0 10px 20px rgba(0,0,0,0.4);
                    overflow: hidden;
                    border: 2px solid transparent;
                }

                .pet-card-visual.is-clickable:hover {
                    transform: translateY(-5px);
                    box-shadow: 0 15px 30px rgba(0,0,0,0.6), 0 0 15px var(--item-color, #ffffff)30;
                }

                /* ESTADO SELECCIONADO (Trading/Wallet) OVERRIDE */
                .pet-card-visual.is-selected {
                    border-color: #3AFF4E !important;
                    box-shadow: 0 15px 30px rgba(0,0,0,0.5), 0 0 25px rgba(58,255,78,0.4), inset 0 0 20px rgba(58,255,78,0.15) !important;
                    background: #15291a !important;
                }
                .pet-card-visual.is-selected:before {
                    content: ''; position: absolute; inset: 0; border: 2px solid #3AFF4E; border-radius: 0.65rem; pointer-events: none; opacity: 0.5; animation: pulse-green 2s infinite;
                }

                .pet-glow-layer { position: absolute; inset: 0; opacity: 0.15; transition: opacity 0.3s; pointer-events: none; }
                .pet-card-visual.is-clickable:hover .pet-glow-layer { opacity: 0.4; }

                .pet-info-bar {
                    width: 100%; text-align: center; margin-top: auto;
                    border-top: 1px solid rgba(255,255,255,0.08);
                    background: rgba(0,0,0,0.5); padding: 0.5rem; z-index: 10;
                }

                .pet-name {
                    font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.7rem;
                    white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 2px 4px rgba(0,0,0,0.8);
                }

                .pet-image-container { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; z-index: 5; width: 100%; }
                
                .pet-image {
                    max-width: 80%; max-height: 100px; object-fit: contain;
                    filter: drop-shadow(0 10px 15px rgba(0,0,0,0.7));
                    transition: transform 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                }

                .pet-card-visual.is-clickable:hover .pet-image { transform: scale(1.15) rotate(-3deg); }

                .pet-chance-badge {
                    position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(0,0,0,0.75); border: 1px solid;
                    backdrop-filter: blur(5px); color: white; font-weight: 900; font-size: 0.6rem;
                    padding: 0.2rem 0.5rem; border-radius: 2rem; z-index: 15;
                }

                /* --- RAREZAS --- */
                .rarity-standard .pet-glow-layer { background: radial-gradient(circle at center, var(--item-color, #ffffff) 0%, transparent 70%); }
                .rarity-standard { border-color: rgba(255,255,255,0.05); }

                /* Shiny ⚡ */
                .rarity-shiny { border-color: #00FFFF30; box-shadow: 0 8px 20px rgba(0,0,0,0.5), 0 0 10px #00FFFF10; }
                .rarity-shiny .pet-glow-layer { background: radial-gradient(circle at center, #00FFFF 0%, transparent 75%); opacity: 0.2; }
                .rarity-shiny .pet-name { color: #00FFFF; text-shadow: 0 0 8px #00FFFF60; }
                .rarity-shiny .pet-sparkle-overlay {
                    position: absolute; inset: 0; opacity: 0.1; animation: shine-sparkle 4s linear infinite; pointer-events: none;
                    background-image: url('data:image/svg+xml,%3Csvg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="M50 50L52 52L50 54L48 52Z" fill="%23fff" fill-opacity="0.5"/%3E%3C/svg%3E');
                }

                /* Mythic 🔮 */
                .rarity-mythic { border-color: #DC143C40; box-shadow: 0 8px 20px rgba(0,0,0,0.5), inset 0 0 15px #DC143C10; }
                .rarity-mythic .pet-glow-layer { background: radial-gradient(circle at center, #DC143C 0%, #300000 80%, transparent 100%); opacity: 0.3; }
                .rarity-mythic .pet-name { color: #FF4D6D; text-shadow: 0 0 10px #DC143C80; }

                /* Shiny Mythic 🌟 */
                .rarity-shiny-mythic { border-color: #fff2; background: linear-gradient(135deg, #111827 0%, #1a1a2e 100%); }
                .rarity-shiny-mythic .pet-glow-layer { background: radial-gradient(circle at center, #00FFFF 0%, #DC143C 50%, transparent 80%); opacity: 0.3; }
                .rarity-shiny-mythic:after { 
                    content: ''; position: absolute; inset: -2px; background: linear-gradient(90deg, #ff00ff, #00ffff, #ff00ff);
                    z-index: -1; border-radius: 0.85rem; opacity: 0.4; animation: rainbow-rotate 4s linear infinite; pointer-events: none;
                }
                .rarity-shiny-mythic .pet-name { 
                    background: linear-gradient(90deg, #FF69B4, #00FFFF, #FF69B4); -webkit-background-clip: text; background-clip: text; color: transparent;
                    text-shadow: 0 0 10px rgba(255,255,255,0.3); animation: rainbow-rotate 5s linear infinite; background-size: 200% 100%;
                }

                /* XL 🏆 */
                .rarity-xl { background: linear-gradient(135deg, #1a1608 0%, #0a0a0a 100%); box-shadow: 0 10px 30px rgba(0,0,0,0.6), 0 0 15px #FFD70015; }
                .rarity-xl:before {
                    content: ''; position: absolute; inset: -2px; border-radius: 0.85rem; pointer-events: none;
                    background: linear-gradient(135deg, #8a6e12 0%, #FFD700 30%, #fff8d1 50%, #FFD700 70%, #8a6e12 100%);
                    animation: gradient-shift 3s ease infinite; background-size: 400% 400%; z-index: -1;
                }
                .rarity-xl .pet-glow-layer { background: radial-gradient(circle at center, #FFD700 0%, transparent 75%); opacity: 0.35; }
                .xl-particle-effect {
                    position: absolute; inset: 0; opacity: 0.1; animation: particles-rise 4s linear infinite; pointer-events: none;
                    background-image: radial-gradient(#FFD700 1px, transparent 1px); background-size: 15px 15px; 
                }

                /* --- BAJA PROBABILIDAD (< 1%) --- */
                .pet-card-visual.is-rare .pet-glow-layer { opacity: 0.5; }
                .pet-card-visual.is-rare .pet-image { filter: drop-shadow(0 0 15px var(--item-color, #ffffff)60); }
                .pet-card-visual.is-rare .pet-chance-badge {
                    background: #ff4d4d30; border-color: #ff4d4d60; color: #ff9999;
                    box-shadow: 0 0 10px #ff4d4d; animation: pulse-rare-badge 1.5s infinite;
                }

                /* ANIMACIONES GENERALES */
                @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
                @keyframes shine-sparkle { 0% { background-position: 0 0; } 100% { background-position: 100px 100px; } }
                @keyframes rainbow-rotate { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
                @keyframes gradient-shift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
                @keyframes particles-rise { 0% { background-position: 0 0; opacity: 0.1; } 50% { opacity: 0.3; } 100% { background-position: 0 -100px; opacity: 0; } }
                @keyframes pulse-rare-badge { 0%, 100% { opacity: 1; } 50% { opacity: 0.6; } }
                @keyframes pulse-green { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; box-shadow: 0 0 15px #3AFF4E; } }
            `}} />
        </div>
    );
}
