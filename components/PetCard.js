"use client";
import React from 'react';

const GreenCoin = ({cls="w-3.5 h-3.5"}) => <img src="/green-coin.png" className={`${cls} inline-block grayscale opacity-90`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

// --- MOTOR DE VARIANTES MODULARES ---
const getPetVariants = (name, isDBLimited) => {
  const lowerName = (name || '').toLowerCase();
  return {
    isShiny: lowerName.includes('shiny'),
    isMythic: lowerName.includes('mythic'),
    isXL: lowerName.includes('xl'),
    isLimited: isDBLimited // LIMITED es el tier Dios supremo
  };
};

// Generador de Banner Dinámico para Combinaciones (Ej: "LIMITED SHINY MYTHIC XL")
const getBannerInfo = (variants) => {
  if (!variants.isMythic && !variants.isXL && !variants.isLimited) return null; // No hay banner para normales/solo shiny
  
  let parts = [];
  if (variants.isLimited) parts.push("LIMITED");
  if (variants.isShiny) parts.push("SHINY");
  if (variants.isMythic && !variants.isLimited) parts.push("MYTHIC"); // Si es limited, omitimos decir "mythic" para no saturar, pero mantenemos si no lo es
  if (variants.isXL) parts.push("XL");

  if (parts.length === 1 && variants.isXL) parts = ["XL PURE"];
  
  const text = parts.join(" ");
  const textScale = parts.length > 2 ? 'text-[7px] px-2' : 'text-[9px] px-4'; // Hace el texto más pequeño si hay muchas palabras

  // Estilos de banner por jerarquía
  let bgClass = "bg-gradient-to-r from-gray-700 to-gray-500 text-white";
  if (variants.isLimited) {
      bgClass = "bg-[linear-gradient(90deg,#ff0000,#ffff00,#00ff00,#00ffff,#0000ff,#ff00ff,#ff0000)] bg-[length:200%_auto] animate-rainbow-bg text-white border-white shadow-[0_0_20px_rgba(255,255,255,0.8)]";
  } else if (variants.isXL) {
      bgClass = "bg-gradient-to-r from-yellow-400 via-yellow-100 to-yellow-400 text-yellow-900 border-yellow-200 shadow-[0_0_15px_#FFD700] animate-pulse-slow";
  } else if (variants.isShiny && variants.isMythic) {
      bgClass = "bg-gradient-to-r from-cyan-400 via-purple-500 to-cyan-400 text-white border-cyan-200 shadow-[0_0_15px_#a855f7]";
  } else if (variants.isMythic) {
      bgClass = "bg-gradient-to-r from-red-600 via-rose-500 to-red-600 text-white border-rose-200 shadow-[0_0_15px_#DC143C]";
  }

  return { text, bgClass, textScale };
};

export default function PetCard({ 
    item, 
    pet, 
    onClick, 
    isSelected = false, 
    showValue = true, 
    showChance = false,
    selectable = false
}) {
    const data = item || pet;
    if (!data) return null;

    const name = data.items?.name || data.name || 'Unknown';
    const img = data.items?.image_url || data.image_url || data.img || '/default-pet.png';
    const color = data.items?.color || data.color || '#9ca3af';
    
    // El Santo Grial: Detectar si es verdaderamente una Limited de base de datos
    const isDBLimited = data.items?.is_mythic || data.items?.is_limited || data.is_mythic || data.is_limited || data.rarity === 'Limited' || false;
    
    const serial = data.serial_number || data.serial || null;
    const owner = data.original_owner || data.originalOwner || null;
    const value = data.items?.value || data.value || data.valor || data.price || 0;
    const chance = data.chance || null;

    // Calculamos las Variantes
    const variants = getPetVariants(name, isDBLimited);
    const banner = getBannerInfo(variants);
    const isRare = showChance && chance && chance < 1; 

    // Clases dinámicas Modulares (Se SUMAN, no se reemplazan)
    const cardClasses = [
        'pet-card-visual',
        variants.isShiny ? 'has-shiny' : 'is-standard',
        variants.isMythic ? 'has-mythic' : '',
        variants.isShiny && variants.isMythic ? 'has-shiny-mythic' : '',
        variants.isXL ? 'has-xl' : '',
        variants.isLimited ? 'has-limited' : '',
        isRare ? 'is-rare' : '',
        isSelected ? 'is-selected' : '',
        onClick ? 'is-clickable' : ''
    ].filter(Boolean).join(' ');

    return (
        <div 
            onClick={onClick}
            className={`relative w-full h-full min-h-[220px] transition-all duration-300 ${onClick ? 'cursor-pointer' : ''} ${isSelected ? 'scale-105 z-20' : 'z-10'}`}
        >
            <div className={cardClasses} style={{ '--item-color': color }}>
                
                {/* --- CAPAS DE EFECTOS (SE MEZCLAN ENTRE SÍ) --- */}
                <div className="pet-glow-layer"></div>
                
                {variants.isShiny && <div className="shiny-glint"></div>}
                {variants.isMythic && <div className="mythic-aura"></div>}
                {(variants.isShiny && variants.isMythic) && <div className="holographic-sweep"></div>}
                
                {variants.isXL && (
                    <>
                        <div className="xl-god-rays"></div>
                        <div className="xl-particles"></div>
                    </>
                )}
                
                {variants.isLimited && (
                    <>
                        <div className="limited-galaxy-bg"></div>
                        <div className="limited-stars"></div>
                    </>
                )}
                
                <div className="pet-sparkle-overlay"></div>

                {/* --- BANNER DE RAREZA (Dinámico para combinaciones) --- */}
                {banner && !isSelected && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 w-max max-w-[95%] z-40 pointer-events-none">
                        <div className={`font-black py-0.5 rounded-b-lg uppercase tracking-[0.2em] border-b-2 text-center whitespace-nowrap ${banner.bgClass} ${banner.textScale}`}>
                            {banner.text}
                        </div>
                    </div>
                )}

                {/* Checkbox (Wallet/Trading) */}
                {selectable && (
                    <div className={`absolute top-2 left-2 w-6 h-6 rounded-md border-2 flex items-center justify-center transition-all z-40 shadow-lg
                        ${isSelected ? 'bg-[#3AFF4E] border-[#3AFF4E] shadow-[0_0_20px_rgba(58,255,78,0.8)] scale-110' : 'bg-black/70 border-gray-400 hover:border-white backdrop-blur-sm'}
                    `}>
                        {isSelected && <span className="text-black text-sm font-black drop-shadow-md">✓</span>}
                    </div>
                )}

                {/* Badge de Probabilidad (Cases) */}
                {showChance && chance && (
                    <div className={`pet-chance-badge ${isRare ? 'rare-heartbeat' : ''}`} style={{borderColor: `${color}50`}}>
                        {chance.toFixed(variants.isXL || chance < 0.1 ? 2 : 1)}%
                    </div>
                )}

                {/* --- IMAGEN DE LA PET --- */}
                <div className="pet-image-container mt-6 mb-3 pointer-events-none z-30">
                    {/* Sombra de piso dinámica */}
                    {(variants.isXL || variants.isMythic || variants.isLimited) && (
                        <div className={`absolute bottom-0 w-24 h-5 blur-[12px] rounded-full mix-blend-screen
                            ${variants.isLimited ? 'bg-fuchsia-500/50' : variants.isXL ? 'bg-yellow-500/50' : 'bg-red-500/50'}`}>
                        </div>
                    )}
                    <img 
                        src={img} 
                        className={`pet-image 
                            ${variants.isLimited ? 'animate-levitate-epic' : variants.isXL ? 'animate-levitate-slow' : variants.isMythic ? 'animate-float' : ''}`} 
                        alt={name}
                    />
                </div>
                
                {/* --- INFO BOTTOM --- */}
                <div className="pet-info-bar z-40">
                    <div className="pet-name">
                        {name}
                    </div>
                    
                    {/* MetaData Mítica/Limited (Serial & Owner) */}
                    {(variants.isMythic || variants.isLimited) && serial && (
                       <div className="flex flex-col items-center bg-black/80 border border-yellow-500/50 w-full rounded-md p-1.5 my-1.5 shadow-inner backdrop-blur-md relative overflow-hidden">
                           {variants.isLimited && <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent animate-glint"></div>}
                           <span className={`text-[11px] font-black uppercase tracking-[0.2em] z-10 ${variants.isLimited ? 'text-transparent bg-clip-text bg-[linear-gradient(90deg,#ff00ff,#00ffff,#ff00ff)] bg-[length:200%_auto] animate-rainbow-bg drop-shadow-[0_0_5px_rgba(255,255,255,0.5)]' : 'text-yellow-400 drop-shadow-[0_0_8px_rgba(250,204,21,0.8)]'}`}>
                               #{serial}
                           </span>
                           {owner && <span className="text-[8px] font-bold text-gray-300 truncate w-full uppercase mt-0.5 z-10">Own: {owner}</span>}
                       </div>
                    )}

                    {/* Precio / Valor */}
                    {showValue && value > 0 && (
                        <div className="flex items-center justify-center gap-1.5 bg-black/60 rounded-md px-2 py-1.5 border border-white/10 w-full mt-1 backdrop-blur-md hover:bg-black/80 transition-colors">
                            <GreenCoin /> 
                            <span className="text-gray-100 text-[12px] font-black tracking-widest">
                                {formatValue(value)}
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* --- CSS MODULAR AVANZADO --- */}
            <style dangerouslySetInnerHTML={{__html: `
                .pet-card-visual {
                    background: #11131a; border-radius: 1rem; display: flex; flex-direction: column; align-items: center; justify-content: center;
                    position: absolute; inset: 0; transition: all 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275);
                    box-shadow: 0 10px 25px rgba(0,0,0,0.6); overflow: hidden; border: 2px solid transparent;
                }

                .pet-card-visual.is-clickable:hover { transform: translateY(-8px) scale(1.02); box-shadow: 0 20px 40px rgba(0,0,0,0.8), 0 0 25px var(--item-color, #ffffff)50; }

                /* ESTADO SELECCIONADO */
                .pet-card-visual.is-selected { border-color: #3AFF4E !important; box-shadow: 0 15px 40px rgba(0,0,0,0.7), 0 0 30px rgba(58,255,78,0.5), inset 0 0 30px rgba(58,255,78,0.2) !important; background: #0a1f0f !important; }
                .pet-card-visual.is-selected:before { content: ''; position: absolute; inset: 0; border: 2px solid #3AFF4E; border-radius: 0.85rem; pointer-events: none; opacity: 0.5; animation: pulse-green 1.5s infinite; z-index: 50; }

                /* --- CAPAS BASE --- */
                .pet-glow-layer { position: absolute; inset: 0; opacity: 0.15; transition: opacity 0.3s; pointer-events: none; z-index: 1; background: radial-gradient(circle at center, var(--item-color, #ffffff) 0%, transparent 75%); }
                .pet-card-visual.is-clickable:hover .pet-glow-layer { opacity: 0.5; }

                .pet-info-bar {
                    width: 100%; text-align: center; margin-top: auto; border-top: 1px solid rgba(255,255,255,0.1);
                    background: rgba(0,0,0,0.7); padding: 0.6rem; z-index: 40; backdrop-filter: blur(10px);
                }

                .pet-image-container { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; width: 100%; }
                .pet-image { max-width: 85%; max-height: 110px; object-fit: contain; filter: drop-shadow(0 15px 20px rgba(0,0,0,0.8)); transition: transform 0.5s cubic-bezier(0.175, 0.885, 0.32, 1.275); }
                .pet-card-visual.is-clickable:hover .pet-image { transform: scale(1.2) rotate(-4deg); filter: drop-shadow(0 20px 30px rgba(0,0,0,0.9)) drop-shadow(0 0 15px var(--item-color, #ffffff)60); }

                .pet-chance-badge { position: absolute; top: 0.5rem; right: 0.5rem; background: rgba(0,0,0,0.8); border: 1px solid; backdrop-filter: blur(5px); color: white; font-weight: 900; font-size: 0.65rem; padding: 0.25rem 0.6rem; border-radius: 2rem; z-index: 45; box-shadow: 0 5px 10px rgba(0,0,0,0.5); }

                /* --- TEXTO DEL NOMBRE (Jerarquía de colores) --- */
                .pet-name { font-weight: 900; text-transform: uppercase; letter-spacing: 0.05em; font-size: 0.75rem; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; text-shadow: 0 3px 6px rgba(0,0,0,0.9); color: white; }
                .has-shiny .pet-name { color: #00FFFF; text-shadow: 0 0 12px #00FFFF80; }
                .has-mythic .pet-name { color: #FF4D6D; text-shadow: 0 0 15px #DC143C90; }
                .has-shiny-mythic .pet-name { background: linear-gradient(90deg, #FF69B4, #00FFFF, #FFD700, #FF69B4); -webkit-background-clip: text; color: transparent; text-shadow: 0 0 15px rgba(255,255,255,0.4); animation: rainbow-bg 4s linear infinite; background-size: 300% 100%; }
                .has-xl .pet-name { color: #FFD700 !important; text-shadow: 0 0 20px #FFD700, 0 3px 6px rgba(0,0,0,0.9) !important; -webkit-text-fill-color: initial; background: none; }
                .has-limited .pet-name { background: linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000) !important; -webkit-background-clip: text !important; color: transparent !important; text-shadow: 0 0 15px rgba(255,255,255,0.7) !important; animation: rainbow-bg 3s linear infinite !important; background-size: 200% auto !important; }

                /* --- MODULOS DE EFECTOS VISUALES --- */

                /* Standard */
                .is-standard { border-color: rgba(255,255,255,0.08); }

                /* ⚡ SHINY MODULE */
                .has-shiny { box-shadow: 0 10px 25px rgba(0,0,0,0.6), 0 0 15px #00FFFF15; }
                .has-shiny.is-standard { border-color: #00FFFF40; }
                .shiny-glint { position: absolute; top: 0; left: -100%; width: 40%; height: 100%; z-index: 25; background: linear-gradient(to right, transparent, rgba(0, 255, 255, 0.5), transparent); transform: skewX(-25deg); animation: shiny-laser 4s cubic-bezier(0.25, 0.1, 0.25, 1) infinite; pointer-events: none; mix-blend-mode: color-dodge; }

                /* 🔮 MYTHIC MODULE */
                .has-mythic { box-shadow: 0 10px 30px rgba(0,0,0,0.7), inset 0 0 20px #DC143C30; border-color: #DC143C50; }
                .mythic-aura { position: absolute; top: 50%; left: 50%; transform: translate(-50%, -50%); width: 150%; height: 150%; background: radial-gradient(circle, rgba(220, 20, 60, 0.5) 0%, transparent 60%); animation: pulse-aura 2.5s ease-in-out infinite alternate; pointer-events: none; z-index: 2; mix-blend-mode: screen; }

                /* 🌟 SHINY MYTHIC HOLO MODULE */
                .holographic-sweep { position: absolute; inset: 0; z-index: 25; opacity: 0.5; mix-blend-mode: color-dodge; pointer-events: none; background: linear-gradient(115deg, transparent 20%, rgba(255,255,255,0.6) 25%, rgba(0,255,255,0.6) 30%, transparent 35%, transparent 40%, rgba(255,0,255,0.5) 45%, transparent 50%); background-size: 200% 200%; animation: holo-shine 4s linear infinite; }

                /* 🏆 XL MODULE (Rayos divinos y Borde Oro) */
                .has-xl { border-color: transparent !important; box-shadow: 0 20px 50px rgba(0,0,0,0.9), 0 0 30px #FFD70040 !important; }
                .has-xl:before { content: ''; position: absolute; inset: -3px; border-radius: 1.1rem; pointer-events: none; background: linear-gradient(135deg, #8a6e12 0%, #FFD700 30%, #fff8d1 50%, #FFD700 70%, #8a6e12 100%); animation: rainbow-bg 3s ease infinite; background-size: 400% 400%; z-index: -1; }
                .xl-god-rays { position: absolute; top: 50%; left: 50%; width: 250%; height: 250%; transform: translate(-50%, -50%); background: repeating-conic-gradient(from 0deg, transparent 0deg 15deg, rgba(255, 215, 0, 0.2) 15deg 30deg); animation: spin-rays 20s linear infinite; pointer-events: none; z-index: 3; mix-blend-mode: screen; }
                .xl-particles { position: absolute; inset: 0; opacity: 0.5; animation: particles-rise 3s linear infinite; pointer-events: none; z-index: 4; background-image: radial-gradient(#FFD700 2px, transparent 2px); background-size: 30px 30px; }

                /* 💎 LIMITED MODULE (EL DIOS DE LAS CARTAS) */
                .has-limited { border-color: transparent !important; box-shadow: 0 20px 60px rgba(0,0,0,0.9), 0 0 50px rgba(255,0,255,0.4) !important; background: #000 !important;}
                .has-limited:after { /* Sobrescribe incluso el borde dorado de XL con un arcoíris animado */
                    content: ''; position: absolute; inset: -3px; border-radius: 1.1rem; pointer-events: none;
                    background: linear-gradient(90deg, #ff0000, #ffff00, #00ff00, #00ffff, #0000ff, #ff00ff, #ff0000);
                    background-size: 200% auto; animation: rainbow-bg 2s linear infinite; z-index: -1; 
                }
                .limited-galaxy-bg { position: absolute; inset: 0; background: radial-gradient(circle at center, rgba(255,0,255,0.3) 0%, rgba(0,0,255,0.3) 50%, transparent 100%); z-index: 2; mix-blend-mode: screen; animation: pulse-aura 3s infinite; }
                .limited-stars { position: absolute; inset: 0; background-image: radial-gradient(#fff 1.5px, transparent 1.5px); background-size: 20px 20px; animation: spin-rays 15s linear infinite; opacity: 0.6; z-index: 5; pointer-events: none; }

                /* General Sparkles */
                .pet-sparkle-overlay { position: absolute; inset: 0; opacity: 0.15; animation: shine-sparkle 5s linear infinite; pointer-events: none; z-index: 6; background-image: url('data:image/svg+xml,%3Csvg width="100" height="100" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"%3E%3Cpath d="M50 50L52 52L50 54L48 52Z" fill="%23fff" fill-opacity="0.5"/%3E%3C/svg%3E'); }

                /* Baja Probabilidad (< 1%) */
                .is-rare .pet-glow-layer { opacity: 0.8; }
                .is-rare .pet-image { filter: drop-shadow(0 0 30px var(--item-color, #ffffff)80); }
                .rare-heartbeat { background: #ff000050; border-color: #ff4d4d; color: #ffe6e6; box-shadow: 0 0 20px #ff0000; animation: heartbeat 1s infinite; }

                /* --- KEYFRAMES --- */
                @keyframes shiny-laser { 0%, 40% { left: -100%; } 100% { left: 200%; } }
                @keyframes pulse-aura { 0% { transform: translate(-50%, -50%) scale(0.8); opacity: 0.4; } 100% { transform: translate(-50%, -50%) scale(1.1); opacity: 1; } }
                @keyframes holo-shine { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }
                @keyframes spin-rays { 0% { transform: translate(-50%, -50%) rotate(0deg); } 100% { transform: translate(-50%, -50%) rotate(360deg); } }
                @keyframes heartbeat { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.15); box-shadow: 0 0 25px #ff0000; } }
                @keyframes animate-levitate-slow { 0%, 100% { transform: translateY(0px) scale(1.05); } 50% { transform: translateY(-8px) scale(1.05); } }
                @keyframes animate-levitate-epic { 0%, 100% { transform: translateY(0px) scale(1.15); filter: drop-shadow(0 0 20px rgba(255,255,255,0.5)); } 50% { transform: translateY(-12px) scale(1.15); filter: drop-shadow(0 0 40px rgba(255,0,255,0.8)); } }
                @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-5px); } }
                @keyframes shine-sparkle { 0% { background-position: 0 0; } 100% { background-position: 100px 100px; } }
                @keyframes rainbow-bg { 0% { background-position: 0% 50%; } 100% { background-position: 200% 50%; } }
                @keyframes particles-rise { 0% { background-position: 0 0; opacity: 0.2; } 50% { opacity: 0.6; } 100% { background-position: 0 -150px; opacity: 0; } }
                @keyframes pulse-green { 0%, 100% { opacity: 0.5; } 50% { opacity: 1; box-shadow: 0 0 20px #3AFF4E; } }
                @keyframes animate-glint { 0% { transform: translateX(-100%); } 100% { transform: translateX(100%); } }
            `}} />
        </div>
    );
}
