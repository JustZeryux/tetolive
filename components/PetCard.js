"use client";

export default function PetCard({ 
    item, 
    onClick, 
    isSelected = false, 
    showValue = true, 
    showChance = false,
    selectable = false
}) {
    if (!item) return null;

    // Detectamos si es un item "Limited" o especial (puedes ajustar esta condición según tu BD)
    const isLimited = item.rarity === 'Limited' || item.isLimited || item.name.toLowerCase().includes('limited');

    return (
        <div 
            onClick={onClick}
            className={`relative rounded-xl transition-all duration-300 cursor-pointer overflow-hidden group
                ${isSelected ? 'scale-105 z-10' : 'hover:-translate-y-1 hover:shadow-xl'}
                ${isLimited ? 'p-[2px]' : 'border-2'}
            `}
            style={{ 
                borderColor: !isLimited ? (isSelected ? '#3AFF4E' : '#252839') : 'transparent',
                boxShadow: isSelected ? `0 0 20px ${isLimited ? '#facc15' : '#3AFF4E'}60` : '',
            }}
        >
            {/* FONDO ANIMADO PARA LIMITED (Borde brillante) */}
            {isLimited && (
                <div className={`absolute inset-0 bg-gradient-to-br from-[#facc15] via-[#ef4444] to-[#a855f7] ${isSelected ? 'animate-pulse' : ''}`}></div>
            )}

            {/* CONTENEDOR INTERNO DE LA CARTA */}
            <div className={`relative h-full w-full rounded-[10px] flex flex-col overflow-hidden ${isLimited ? 'bg-[#0b0e14]' : 'bg-[#141323]'}`}>
                
                {/* Glow radial de fondo según el color del item */}
                <div 
                    className="absolute inset-0 opacity-10 group-hover:opacity-30 transition-opacity duration-500" 
                    style={{ background: `radial-gradient(circle at center, ${item.color || '#ffffff'} 0%, transparent 80%)` }}
                />

                {/* ETIQUETA LIMITED */}
                {isLimited && (
                    <div className="absolute top-0 left-1/2 -translate-x-1/2 bg-gradient-to-r from-[#facc15] to-[#ef4444] text-black text-[8px] font-black px-3 py-0.5 rounded-b-md z-20 shadow-md uppercase tracking-widest">
                        Limited
                    </div>
                )}

                {/* CHECKBOX PARA MULTI-SELECT */}
                {selectable && (
                    <div className={`absolute top-2 left-2 w-5 h-5 rounded border-2 flex items-center justify-center transition-all z-30
                        ${isSelected ? 'bg-[#3AFF4E] border-[#3AFF4E] shadow-[0_0_10px_rgba(58,255,78,0.8)]' : 'bg-black/50 border-[#555b82] group-hover:border-gray-400'}
                    `}>
                        {isSelected && <span className="text-black text-xs font-black">✓</span>}
                    </div>
                )}

                {/* PROBABILIDAD (Solo para Cajas) */}
                {showChance && item.chance && (
                    <div className="absolute top-2 right-2 text-[10px] font-black px-1.5 py-0.5 rounded bg-black/80 border text-white z-20" style={{borderColor: item.color || '#555b82'}}>
                        {item.chance}%
                    </div>
                )}

                {/* IMAGEN DE LA PET */}
                <div className="p-4 flex-1 flex justify-center items-center h-28 relative z-10">
                    <img 
                        src={item.img || item.image_url || '/default-pet.png'} 
                        alt={item.name} 
                        className="max-h-full max-w-full object-contain drop-shadow-xl group-hover:scale-110 transition-transform duration-300"
                        style={{ filter: `drop-shadow(0 5px 15px ${item.color || '#ffffff'}60)` }}
                    />
                </div>

                {/* INFO BOTTOM (Nombre y Valor) */}
                <div className={`p-2 border-t relative z-10 ${isLimited ? 'border-[#facc15]/30 bg-gradient-to-t from-[#facc15]/10 to-transparent' : 'border-[#252839] bg-[#0b0e14]/50'}`}>
                    <p className="text-[11px] font-black text-center truncate mb-1" style={{ color: item.color || '#ffffff' }}>
                        {item.name}
                    </p>
                    {showValue && (
                        <div className="flex items-center justify-center gap-1 bg-black/60 rounded px-2 py-1 border border-[#2F3347]">
                            <img src="/green-coin.png" className="w-3 h-3 drop-shadow-md" alt="G" />
                            <span className="text-white text-xs font-black">
                                {(item.valor || item.value || item.price || 0).toLocaleString()}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
