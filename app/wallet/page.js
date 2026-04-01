"use client";
import { useState, useMemo, useEffect } from 'react';
import PETS_DATABASE_RAW from '../data/pets_bgsi.json';

const PETS_DATABASE = PETS_DATABASE_RAW
  .filter(pet => pet && pet.valor !== 0 && pet.valor !== "0" && pet.valor !== null)
  .map(pet => {
    let valorCorregido = pet.valor;
    if (typeof valorCorregido === 'number') {
      if (valorCorregido < 10) valorCorregido = Math.round(valorCorregido * 1000000); 
      else if (valorCorregido < 1000) valorCorregido = Math.round(valorCorregido * 1000); 
    }
    return { ...pet, valor: valorCorregido };
  });

const formatValue = (val) => {
  if (val === "O/C") return "O/C";
  if (typeof val !== 'number') return val;
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

const RedCoin = ({cls="w-4 h-4"}) => <img src="/red-coin.png" className={`${cls} inline-block floating drop-shadow-[0_0_5px_rgba(239,68,68,0.8)]`} alt="R" />;
const GreenCoin = ({cls="w-4 h-4"}) => <img src="/green-coin.png" className={`${cls} inline-block floating drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" />;

export default function Wallet() {
  const [saldoVerde, setSaldoVerde] = useState(50000); 
  const [misPets, setMisPets] = useState([]);
  const [busqueda, setBusqueda] = useState('');
  const [orden, setOrden] = useState('highest');

  useEffect(() => {
    const iniciales = [];
    for(let i = 0; i < 21; i++) {
      const p = PETS_DATABASE[Math.floor(Math.random() * PETS_DATABASE.length)];
      if(p) iniciales.push({ ...p, inventarioId: Date.now() + i });
    }
    setMisPets(iniciales);
  }, []);

  const totalValorRojo = useMemo(() => misPets.reduce((acc, pet) => acc + (typeof pet.valor === 'number' ? pet.valor : 0), 0), [misPets]);

  const venderPet = (inventarioId, valor) => {
    const valorSuma = typeof valor === 'number' ? valor : 0;
    setSaldoVerde(prev => prev + valorSuma); 
    setMisPets(prev => prev.filter(pet => pet.inventarioId !== inventarioId)); 
  };
  
  const itemsFiltrados = useMemo(() => {
    let items = [...misPets];
    if (busqueda) items = items.filter(item => item.nombre.toLowerCase().includes(busqueda.toLowerCase()));
    items.sort((a, b) => {
      const valA = typeof a.valor === 'number' ? a.valor : Infinity;
      const valB = typeof b.valor === 'number' ? b.valor : Infinity;
      return orden === 'highest' ? valB - valA : valA - valB;
    });
    return items;
  }, [misPets, busqueda, orden]);

  const renderImg = (img, xtra="") => img?.startsWith('http') ? <img src={img} className={`w-full h-full object-contain ${xtra}`} alt="pet" /> : <span className="text-3xl">🐾</span>;

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-[#1c212d] via-[#0b0e14] to-[#0b0e14] text-white font-sans p-4 md:p-8 animate-fade-in">
      <div className="max-w-[1400px] mx-auto">
        
        {/* HEADERS DE ECONOMÍA ANIMADOS */}
        <div className="flex flex-col md:flex-row gap-6 mb-10">
          <div className="flex-1 bg-[#14171f]/80 backdrop-blur-md border border-[#222630] rounded-2xl p-8 text-center relative overflow-hidden group hover:border-[#22c55e]/50 transition-colors duration-500 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#22c55e] to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <p className="text-[#7c8291] text-xs font-bold uppercase tracking-[0.2em] mb-4">Green Balance (Cases/Mines)</p>
            <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#4ade80] to-[#16a34a] tracking-tight flex items-center justify-center gap-3 drop-shadow-lg">
              <GreenCoin cls="w-10 h-10" /> {formatValue(saldoVerde)}
            </p>
          </div>
          <div className="flex-1 bg-[#14171f]/80 backdrop-blur-md border border-[#222630] rounded-2xl p-8 text-center relative overflow-hidden group hover:border-[#ef4444]/50 transition-colors duration-500 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#ef4444] to-transparent opacity-50 group-hover:opacity-100 transition-opacity"></div>
            <p className="text-[#7c8291] text-xs font-bold uppercase tracking-[0.2em] mb-4">Red Value (Inventory/Coinflip)</p>
            <p className="text-5xl font-black text-transparent bg-clip-text bg-gradient-to-b from-[#f87171] to-[#dc2626] tracking-tight flex items-center justify-center gap-3 drop-shadow-lg">
              <RedCoin cls="w-10 h-10" /> {formatValue(totalValorRojo)}
            </p>
          </div>
        </div>

        {/* INVENTARIO */}
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 xl:grid-cols-7 gap-5">
          {itemsFiltrados.map((pet, idx) => (
            <div key={pet.inventarioId} className="relative bg-[#14171f] border border-[#222630] rounded-xl overflow-hidden hover-glow-green transition-all duration-300 group flex flex-col aspect-[3/4] animate-slide-up" style={{animationDelay: `${idx * 0.05}s`}}>
              <div className="absolute inset-0 opacity-[0.15] group-hover:opacity-30 transition-opacity" style={{ background: `radial-gradient(circle at 50% 40%, ${pet.color || '#9ca3af'} 0%, transparent 70%)` }}></div>
              
              {/* BOTÓN VENDER (Brillo y resplandor verde) */}
              <div className="absolute inset-0 bg-[#0b0e14]/80 z-20 flex flex-col items-center justify-center opacity-0 group-hover:opacity-100 transition-all duration-300 backdrop-blur-sm">
                 <button onClick={() => venderPet(pet.inventarioId, pet.valor)} className="animate-shine bg-gradient-to-b from-[#22c55e] to-[#16a34a] text-[#0b0e14] font-black px-6 py-3 rounded-lg text-xs tracking-widest uppercase hover:scale-110 transition-transform flex flex-col items-center gap-1 shadow-[0_0_20px_rgba(34,197,94,0.5)]">
                   <span>SELL FOR</span>
                   <span className="flex items-center gap-1.5 text-sm"><GreenCoin/> {formatValue(pet.valor)}</span>
                 </button>
              </div>

              {pet.rareza && <div className="absolute top-2 left-2 z-10 bg-black/60 backdrop-blur-md text-gray-200 text-[9px] uppercase font-bold px-2 py-1 rounded shadow-md border border-[#222630]" style={{color: pet.color}}>{pet.rareza}</div>}
              
              <div className="flex-1 w-full p-4 flex items-center justify-center z-10 mt-3 relative">
                <div className="w-full h-full group-hover:scale-125 transition-transform duration-500 ease-out">{renderImg(pet.img, "drop-shadow-[0_10px_15px_rgba(0,0,0,0.5)]")}</div>
              </div>
              
              <div className="w-full text-center pb-4 z-10 flex flex-col items-center relative">
                <p className="text-[#8b92a5] text-xs font-bold w-11/12 truncate mb-1">{pet.nombre}</p>
                <div className="bg-[#0b0e14] border border-[#222630] px-3 py-1 rounded-full flex items-center gap-1.5 shadow-inner">
                  <RedCoin cls="w-3.5 h-3.5"/><span className="text-[#ef4444] font-black text-xs tracking-wide">{formatValue(pet.valor)}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* MEGA CSS INYECTADO */}
      <style dangerouslySetInnerHTML={{__html: `
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-slide-up { animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards; opacity: 0; transform: translateY(20px); }
        .floating { animation: float 3s ease-in-out infinite; }
        .hover-glow-green:hover { box-shadow: 0 0 25px rgba(34, 197, 94, 0.25); transform: translateY(-5px); border-color: rgba(34, 197, 94, 0.4); z-index: 10; }
        .animate-shine { position: relative; overflow: hidden; }
        .animate-shine::before {
          content: ''; position: absolute; top: 0; left: -100%; width: 50%; height: 100%;
          background: linear-gradient(to right, transparent, rgba(255,255,255,0.4), transparent);
          transform: skewX(-20deg); animation: shine 3s infinite;
        }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes slideUp { to { opacity: 1; transform: translateY(0); } }
        @keyframes float { 0%, 100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
        @keyframes shine { 0% { left: -100%; } 20% { left: 200%; } 100% { left: 200%; } }
      `}} />
    </div>
  );
}