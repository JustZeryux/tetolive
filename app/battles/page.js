"use client";
import { useState } from 'react';

// Helpers Visuales
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val.toLocaleString();
};

// Mock Data: Cajas de la tienda para crear batallas
const AVAILABLE_CASES = [
  { id: 'c1', name: 'Starter Case', price: 50000, img: 'https://cdn-icons-png.flaticon.com/512/3673/3673556.png', color: '#34d399' },
  { id: 'c2', name: 'Premium Case', price: 250000, img: 'https://cdn-icons-png.flaticon.com/512/3673/3673556.png', color: '#a855f7' },
  { id: 'c3', name: 'Mythic Case', price: 1000000, img: 'https://cdn-icons-png.flaticon.com/512/3673/3673556.png', color: '#facc15' },
  { id: 'c4', name: 'God Case', price: 5000000, img: 'https://cdn-icons-png.flaticon.com/512/3673/3673556.png', color: '#ef4444' },
];

export default function BattlesPage() {
  const [view, setView] = useState('lobby'); // 'lobby' | 'create' | 'arena'
  const [activeBattle, setActiveBattle] = useState(null);

  // Estados para Creación de Batalla
  const [selectedCases, setSelectedCases] = useState([]);
  const [playerCount, setPlayerCount] = useState(2); // 2, 3, o 4 jugadores

  // Mock Data: Batallas Activas
  const [battles, setBattles] = useState([
    {
      id: 'BTL-992', players: 2, joined: 1, cost: 2500000,
      cases: [AVAILABLE_CASES[3], AVAILABLE_CASES[2]],
      users: [{ name: 'Zeryux', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=Zeryux' }, null],
      status: 'waiting'
    }
  ]);

  const joinBattle = (battle) => {
    setActiveBattle(battle);
    setView('arena');
  };

  // Funciones del Creador
  const addCase = (caja) => {
    if (selectedCases.length >= 10) return alert("Maximum 10 cases per battle!");
    setSelectedCases([...selectedCases, { ...caja, uniqueId: Date.now() + Math.random() }]);
  };

  const removeCase = (uniqueId) => {
    setSelectedCases(selectedCases.filter(c => c.uniqueId !== uniqueId));
  };

  const totalCost = selectedCases.reduce((sum, caja) => sum + caja.price, 0);

  const handleCreate = () => {
    if (selectedCases.length === 0) return alert("Add at least one case!");
    const newBattle = {
      id: `BTL-${Math.floor(Math.random() * 10000)}`,
      players: playerCount,
      joined: 1,
      cost: totalCost,
      cases: selectedCases,
      users: [{ name: 'NinjaUser (You)', avatar: 'https://api.dicebear.com/7.x/avataaars/svg?seed=NinjaUser' }, ...Array(playerCount - 1).fill(null)],
      status: 'waiting'
    };
    setBattles([newBattle, ...battles]);
    setSelectedCases([]);
    setView('lobby');
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#0b0e14] text-white p-4 md:p-8 animate-fade-in relative">
      <div className="max-w-[1200px] mx-auto">
        
        {/* =========================================
            VISTA 1: LOBBY DE BATALLAS
        ========================================= */}
        {view === 'lobby' && (
          <div className="animate-fade-in">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
              <div>
                <h1 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-[#ef4444] to-[#f87171] drop-shadow-[0_0_15px_rgba(239,68,68,0.3)] flex items-center gap-3">
                  ⚔️ Case Battles
                </h1>
                <p className="text-[#8f9ac6] font-bold mt-2">Go head-to-head. Winner takes all items.</p>
              </div>
              <button 
                onClick={() => setView('create')}
                className="w-full md:w-auto px-8 py-3 bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#f87171] hover:to-[#ef4444] text-white font-black rounded-xl text-sm uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.6)] hover:-translate-y-1"
              >
                Create Battle
              </button>
            </div>

            <div className="space-y-4">
              {battles.map((battle) => (
                <div key={battle.id} className="bg-[#1c1f2e] border border-[#252839] hover:border-[#ef4444]/50 rounded-2xl p-4 flex flex-col xl:flex-row items-center gap-6 transition-all shadow-lg group">
                  {/* Jugadores */}
                  <div className="flex items-center gap-2 w-full xl:w-auto justify-center xl:justify-start">
                    {battle.users.map((user, idx) => (
                      <div key={idx} className="relative flex items-center">
                        {user ? (
                          <div className="w-12 h-12 rounded-full border-2 border-[#ef4444] overflow-hidden bg-[#141323] shadow-[0_0_10px_rgba(239,68,68,0.2)] z-10">
                            <img src={user.avatar} className="w-full h-full object-cover" alt="player"/>
                          </div>
                        ) : (
                          <div className="w-12 h-12 rounded-full border-2 border-dashed border-[#555b82] flex items-center justify-center bg-[#141323]/50 z-10">
                            <span className="text-[#555b82] font-black">?</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Cajas a abrir */}
                  <div className="flex-1 w-full bg-[#141323] border border-[#252839] rounded-xl p-3 flex items-center gap-3 overflow-x-auto custom-scrollbar">
                    {battle.cases.map((caja, idx) => (
                      <div key={idx} className="relative w-12 h-12 shrink-0 bg-[#1c1f2e] border border-[#252839] rounded-lg flex items-center justify-center">
                        <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle at center, ${caja.color} 0%, transparent 70%)` }}></div>
                        <img src={caja.img} className="w-8 h-8 object-contain drop-shadow-md z-10" alt="case" style={{filter: `drop-shadow(0 0 5px ${caja.color}80)`}}/>
                      </div>
                    ))}
                    <span className="text-[#555b82] font-black text-xs ml-2 shrink-0">{battle.cases.length} Rounds</span>
                  </div>

                  {/* Costo y Botón */}
                  <div className="flex flex-col sm:flex-row items-center gap-4 w-full xl:w-auto justify-between xl:justify-end">
                    <div className="text-center sm:text-right">
                      <p className="text-[#8f9ac6] text-[10px] font-black uppercase tracking-widest">Total Cost</p>
                      <p className="text-xl font-black text-white flex items-center gap-1.5"><GreenCoin cls="w-5 h-5"/> {formatValue(battle.cost)}</p>
                    </div>
                    <button 
                      onClick={() => joinBattle(battle)}
                      className="w-full sm:w-32 py-3 bg-[#2a2e44] hover:bg-gradient-to-r hover:from-[#ef4444] hover:to-[#dc2626] border border-[#3f4354] hover:border-transparent text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-md group-hover:shadow-[0_0_15px_rgba(239,68,68,0.4)]"
                    >
                      {battle.status === 'waiting' ? 'Join Battle' : 'View'}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* =========================================
            VISTA 2: CREAR BATALLA
        ========================================= */}
        {view === 'create' && (
          <div className="animate-fade-in">
            <button onClick={() => setView('lobby')} className="w-max text-[#8f9ac6] hover:text-[#ef4444] font-bold text-sm flex items-center gap-1 transition-colors bg-[#1c1f2e] px-4 py-2 rounded-lg border border-[#252839] mb-6">
              &lsaquo; Back to Lobby
            </button>

            <div className="flex flex-col lg:flex-row gap-6">
              
              {/* PANEL IZQUIERDO: CONFIGURACIÓN Y CHECKOUT */}
              <div className="w-full lg:w-1/3 flex flex-col gap-6">
                
                {/* Opciones de Jugadores */}
                <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 shadow-xl">
                  <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest mb-4">Players</h3>
                  <div className="flex gap-2">
                    {[2, 3, 4].map(num => (
                      <button 
                        key={num}
                        onClick={() => setPlayerCount(num)}
                        className={`flex-1 py-3 rounded-xl border-2 font-black text-lg transition-all ${playerCount === num ? 'bg-[#ef4444]/10 border-[#ef4444] text-[#ef4444] shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-[#141323] border-[#252839] text-[#555b82] hover:border-[#3f4354]'}`}
                      >
                        {num}P
                      </button>
                    ))}
                  </div>
                </div>

                {/* Cajas Seleccionadas y Total */}
                <div className="bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 shadow-xl flex-1 flex flex-col">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-[#8f9ac6] text-xs font-bold uppercase tracking-widest">Selected Cases</h3>
                    <span className="text-[#555b82] text-xs font-black">{selectedCases.length}/10</span>
                  </div>

                  <div className="flex-1 min-h-[150px] bg-[#141323] border border-[#252839] rounded-xl p-3 flex flex-col gap-2 overflow-y-auto custom-scrollbar mb-6">
                    {selectedCases.length === 0 ? (
                      <div className="flex-1 flex items-center justify-center text-[#555b82] font-bold text-sm text-center px-4">
                        Click cases on the right to add them to your battle.
                      </div>
                    ) : (
                      selectedCases.map((caja, idx) => (
                        <div key={caja.uniqueId} className="bg-[#1c1f2e] border border-[#252839] rounded-lg p-2 flex items-center gap-3 animate-fade-in">
                          <span className="text-[#555b82] font-black text-xs w-4">{idx + 1}</span>
                          <div className="w-8 h-8 relative shrink-0">
                            <div className="absolute inset-0 opacity-20" style={{ background: `radial-gradient(circle, ${caja.color} 0%, transparent 70%)` }}></div>
                            <img src={caja.img} className="w-full h-full object-contain drop-shadow-md z-10 relative" alt="case"/>
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-white font-bold text-xs truncate" style={{color: caja.color}}>{caja.name}</p>
                            <p className="text-[#8f9ac6] font-black text-[10px] flex items-center gap-1"><GreenCoin cls="w-2.5 h-2.5"/> {formatValue(caja.price)}</p>
                          </div>
                          <button onClick={() => removeCase(caja.uniqueId)} className="text-[#ef4444] hover:bg-[#ef4444]/20 p-1.5 rounded-md transition-colors">
                            ✖
                          </button>
                        </div>
                      ))
                    )}
                  </div>

                  <div className="border-t border-[#252839] pt-4">
                    <div className="flex justify-between items-end mb-4">
                      <span className="text-[#8f9ac6] font-bold uppercase tracking-widest text-xs">Total Cost:</span>
                      <span className="text-2xl font-black text-white flex items-center gap-2 drop-shadow-md">
                        <GreenCoin cls="w-6 h-6"/> {formatValue(totalCost)}
                      </span>
                    </div>
                    <button 
                      onClick={handleCreate}
                      disabled={selectedCases.length === 0}
                      className="w-full py-4 bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#f87171] hover:to-[#ef4444] text-white font-black rounded-xl text-sm uppercase tracking-widest transition-all shadow-[0_4px_15px_rgba(239,68,68,0.4)] disabled:opacity-50 disabled:grayscale hover:-translate-y-1"
                    >
                      Call to Battle
                    </button>
                  </div>
                </div>

              </div>

              {/* PANEL DERECHO: TIENDA DE CAJAS */}
              <div className="w-full lg:w-2/3 bg-[#1c1f2e] border border-[#252839] rounded-2xl p-6 shadow-xl">
                <h3 className="text-white text-lg font-black uppercase tracking-widest mb-6">Available Cases</h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                  {AVAILABLE_CASES.map((caja) => (
                    <div 
                      key={caja.id} 
                      onClick={() => addCase(caja)}
                      className="bg-[#141323] border border-[#252839] hover:border-[#ef4444] rounded-xl p-4 flex flex-col items-center cursor-pointer transition-all hover:-translate-y-1 hover:shadow-[0_5px_15px_rgba(239,68,68,0.15)] group relative overflow-hidden"
                    >
                      <div className="absolute inset-0 opacity-5 group-hover:opacity-10 transition-opacity" style={{ background: `radial-gradient(circle at center, ${caja.color} 0%, transparent 70%)` }}></div>
                      <img src={caja.img} className="w-16 h-16 object-contain drop-shadow-[0_5px_10px_rgba(0,0,0,0.5)] group-hover:scale-110 transition-transform mb-3 relative z-10" alt={caja.name} style={{filter: `drop-shadow(0 0 10px ${caja.color}60)`}}/>
                      <h4 className="text-[10px] font-black text-white uppercase tracking-widest mb-1 text-center z-10">{caja.name}</h4>
                      <p className="text-[#3AFF4E] font-black text-xs flex items-center gap-1 z-10"><GreenCoin cls="w-3 h-3"/> {formatValue(caja.price)}</p>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {/* VISTA 3: ARENA (Mantienes la que ya teníamos) */}
        {view === 'arena' && activeBattle && (
          <div className="animate-fade-in flex flex-col min-h-[70vh]">
             {/* ... (Tu código de la vista de Arena que te pasé en el mensaje anterior va aquí intacto) ... */}
             <button onClick={() => setView('lobby')} className="w-max text-[#8f9ac6] hover:text-white font-bold text-sm flex items-center gap-1 transition-colors bg-[#1c1f2e] px-4 py-2 rounded-lg border border-[#252839] mb-6">
              &lsaquo; Back to Battles
            </button>
            <div className="flex-1 flex items-center justify-center border border-[#252839] bg-[#141323] rounded-2xl shadow-inner text-center p-8">
                <div>
                   <h2 className="text-2xl font-black text-white uppercase tracking-widest mb-2">Arena is Ready</h2>
                   <p className="text-[#8f9ac6] font-bold">Battle <span className="text-[#ef4444]">{activeBattle.id}</span> started!</p>
                </div>
            </div>
          </div>
        )}

      </div>
    </div>
  );
}