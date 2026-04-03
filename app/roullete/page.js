"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/Supabase';

const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val?.toLocaleString();
};

export default function RussianRoulettePage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userInventory, setUserInventory] = useState([]);
  
  // NAVEGACIÓN Y MODOS
  const [view, setView] = useState('menu'); // 'menu' | 'lobbies' | 'betting' | 'playing' | 'result'
  const [mode, setMode] = useState('bot'); // 'bot' | 'online'
  
  // APUESTAS
  const [betType, setBetType] = useState('coins'); // 'coins' | 'pets'
  const [coinBet, setCoinBet] = useState(100);
  const [selectedPets, setSelectedPets] = useState([]);
  
  // MULTIJUGADOR ONLINE
  const [lobbies, setLobbies] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const channelRef = useRef(null);

  // ESTADO DE LA PARTIDA (Aplica para Bot y Online)
  const [turn, setTurn] = useState('player'); // 'player' | 'opponent'
  const [chambers, setChambers] = useState([]);
  const [currentChamber, setCurrentChamber] = useState(0);
  const [actionLog, setActionLog] = useState("READY TO SPIN?");
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasShotOpponent, setHasShotOpponent] = useState({ player: false, opponent: false });
  
  const [opponent, setOpponent] = useState({ name: "TetoBot", avatar: "/teto.png", betValue: 0 });

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setUserProfile(profile);
        
        const { data: inv } = await supabase.from('inventory').select(`id, items (name, value, image_url, color)`).eq('user_id', user.id);
        if (inv) {
            setUserInventory(inv.map(i => ({ id: i.id, name: i.items.name, value: i.items.value, img: i.items.image_url, color: i.items.color })));
        }
      }
    };
    init();
  }, []);

  // --- LÓGICA DE APUESTAS ---
  const togglePetSelection = (id) => {
      if (selectedPets.includes(id)) setSelectedPets(selectedPets.filter(p => p !== id));
      else setSelectedPets([...selectedPets, id]);
  };

  const calculateSelectedValue = () => userInventory.filter(p => selectedPets.includes(p.id)).reduce((sum, p) => sum + p.value, 0);

  // --- PREPARAR PARTIDA VS BOT ---
  const prepareBotMatch = async () => {
      if (betType === 'coins' && userProfile.saldo_verde < coinBet) return alert("Insufficient coins!");
      if (betType === 'pets' && selectedPets.length === 0) return alert("Select at least one pet!");

      setIsSpinning(true);
      
      let botValue = betType === 'coins' ? coinBet : calculateSelectedValue();
      setOpponent({ name: "TetoBot", avatar: "/teto.png", betValue: botValue });

      const newChambers = [false, false, false, false, false, false];
      newChambers[Math.floor(Math.random() * 6)] = true;
      setChambers(newChambers);
      setCurrentChamber(0);
      setHasShotOpponent({ player: false, opponent: false });
      
      if (betType === 'coins') {
          await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde - coinBet }).eq('id', currentUser.id);
      }

      setTimeout(() => {
          setView('playing');
          setIsSpinning(false);
          setTurn('player');
          setActionLog("YOUR TURN. CHOOSE WISELY.");
      }, 1500);
  };

  // --- LÓGICA DE MULTIJUGADOR ONLINE (LOBBIES) ---
  const fetchLobbies = async () => {
      const { data } = await supabase.from('roulette_lobbies').select('*').eq('status', 'waiting');
      if (data) setLobbies(data);
  };

  const openLobbies = () => {
      setMode('online');
      fetchLobbies();
      setView('lobbies');
      
      // Suscribirse a cambios en lobbies
      supabase.channel('public:roulette_lobbies').on('postgres_changes', { event: '*', schema: 'public', table: 'roulette_lobbies' }, payload => {
          fetchLobbies();
      }).subscribe();
  };

  const createOnlineLobby = async () => {
      if (betType === 'coins' && userProfile.saldo_verde < coinBet) return alert("No tienes saldo suficiente.");
      if (betType === 'pets') return alert("Las apuestas de Pets Online estarán en el siguiente parche de seguridad."); // Fallback temporal para asegurar economía

      // Descontar saldo al Host
      await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde - coinBet }).eq('id', currentUser.id);

      const { data, error } = await supabase.from('roulette_lobbies').insert({
          host_id: currentUser.id,
          host_name: userProfile.username || 'Host',
          bet_type: 'coins',
          bet_amount: coinBet
      }).select().single();

      if (!error && data) {
          setCurrentRoom(data);
          setOpponent({ name: "Waiting...", avatar: "/avatar-placeholder.png", betValue: coinBet });
          connectToRoom(data.id, true);
          setView('playing');
          setActionLog("WAITING FOR OPPONENT...");
      }
  };

  const joinLobby = async (lobby) => {
      if (userProfile.saldo_verde < lobby.bet_amount) return alert("No tienes saldo para igualar la apuesta.");
      
      // Descontar saldo al Guest
      await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde - lobby.bet_amount }).eq('id', currentUser.id);

      // Actualizar Lobby en DB
      await supabase.from('roulette_lobbies').update({
          guest_id: currentUser.id,
          guest_name: userProfile.username || 'Player',
          status: 'playing'
      }).eq('id', lobby.id);

      setCurrentRoom(lobby);
      setOpponent({ name: lobby.host_name, avatar: "/avatar-placeholder.png", betValue: lobby.bet_amount });
      connectToRoom(lobby.id, false);
      setView('playing');
  };

  // --- REALTIME WEB-SOCKET PARA EL ONLINE ---
  const connectToRoom = (roomId, isHost) => {
      const channel = supabase.channel(`room_${roomId}`);
      channelRef.current = channel;

      channel.on('broadcast', { event: 'game_start' }, payload => {
          setChambers(payload.chambers);
          setCurrentChamber(0);
          setTurn('player'); // El Host tira primero siempre
          setActionLog(isHost ? "YOUR TURN." : "OPPONENT's TURN.");
          setOpponent(prev => ({...prev, name: payload.guest_name}));
      });

      channel.on('broadcast', { event: 'shoot_action' }, payload => {
          executeOnlineShot(payload.target, payload.isBullet, payload.shooter);
      });

      channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && isHost) {
              // Si soy el Host, espero a que el Guest entre para iniciar
              supabase.channel('public:roulette_lobbies').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'roulette_lobbies', filter: `id=eq.${roomId}` }, async (payload) => {
                  if (payload.new.status === 'playing') {
                      // Crear la bala y avisarle al guest
                      const newChambers = [false, false, false, false, false, false];
                      newChambers[Math.floor(Math.random() * 6)] = true;
                      setChambers(newChambers);
                      setTurn('player');
                      setActionLog("YOUR TURN.");
                      setOpponent(prev => ({...prev, name: payload.new.guest_name}));
                      
                      channel.send({ type: 'broadcast', event: 'game_start', payload: { chambers: newChambers, guest_name: payload.new.guest_name } });
                  }
              }).subscribe();
          }
      });
  };

  // --- LÓGICA DE JUEGO (COMÚN Y BOT) ---
  const pullTrigger = async (target) => {
    if (isSpinning || (mode === 'bot' && turn !== 'player') || (mode === 'online' && (currentRoom?.host_id === currentUser.id && turn !== 'player') || (currentRoom?.guest_id === currentUser.id && turn === 'player'))) return;
    
    setIsSpinning(true);
    const isBullet = chambers[currentChamber];
    const shootingSelf = target === 'self';

    if (mode === 'online') {
        // Enviar evento online
        const role = currentRoom.host_id === currentUser.id ? 'host' : 'guest';
        channelRef.current.send({ type: 'broadcast', event: 'shoot_action', payload: { target, isBullet, shooter: role } });
        executeOnlineShot(target, isBullet, role);
    } else {
        // Ejecutar Bot Local
        setActionLog(shootingSelf ? "YOU POINT THE GUN AT YOUR HEAD..." : "YOU AIM AT THE OPPONENT...");
        await new Promise(r => setTimeout(r, 2000));

        if (isBullet) {
            setActionLog("💥 BANG! 💥");
            setTimeout(() => endGame(shootingSelf ? 'opponent' : 'player'), 2000);
        } else {
            setActionLog("...CLICK. NOTHING HAPPENED.");
            setTimeout(() => {
                setCurrentChamber(prev => prev + 1);
                setTurn('opponent');
                setIsSpinning(false);
                botTurn();
            }, 1500);
        }
    }
  };

  const executeOnlineShot = async (target, isBullet, shooter) => {
      const imShooter = (currentRoom.host_id === currentUser.id && shooter === 'host') || (currentRoom.guest_id === currentUser.id && shooter === 'guest');
      const shootingSelf = target === 'self';

      if (imShooter) setActionLog(shootingSelf ? "YOU POINT AT YOUR HEAD..." : "YOU AIM AT OPPONENT...");
      else setActionLog(shootingSelf ? "OPPONENT POINTS AT THEIR HEAD..." : "OPPONENT AIMS AT YOU!");

      await new Promise(r => setTimeout(r, 2000));

      if (isBullet) {
          setActionLog("💥 BANG! 💥");
          // Si me disparé a mí, gana el rival. Si le disparé al rival, gano yo. (Y viceversa)
          let iWon = false;
          if (imShooter && !shootingSelf) iWon = true;
          if (!imShooter && shootingSelf) iWon = true;

          setTimeout(() => endGame(iWon ? 'player' : 'opponent'), 2000);
      } else {
          setActionLog("...CLICK.");
          setTimeout(() => {
              setCurrentChamber(prev => prev + 1);
              // Cambiar turno visualmente
              setTurn(imShooter ? 'opponent' : 'player');
              setIsSpinning(false);
              setActionLog(!imShooter ? "YOUR TURN." : "OPPONENT's TURN.");
          }, 1500);
      }
  };

  const botTurn = async () => {
      setActionLog("TETOBOT IS THINKING...");
      await new Promise(r => setTimeout(r, 2000));
      
      const isBullet = chambers[currentChamber];
      const shootPlayer = !hasShotOpponent.opponent && Math.random() < 0.2;
      
      if (shootPlayer) setHasShotOpponent(prev => ({...prev, opponent: true}));
      setActionLog(shootPlayer ? "TETOBOT AIMS AT YOU!" : "TETOBOT POINTS AT ITS HEAD...");
      
      await new Promise(r => setTimeout(r, 2000));

      if (isBullet) {
          setActionLog("💥 BANG! 💥");
          setTimeout(() => endGame(shootPlayer ? 'opponent' : 'player'), 2000);
      } else {
          setActionLog("...CLICK. TETOBOT SURVIVED.");
          setTimeout(() => {
              setCurrentChamber(prev => prev + 1);
              setTurn('player');
              setIsSpinning(false);
              setActionLog("YOUR TURN.");
          }, 1500);
      }
  };

  const endGame = async (winner) => {
      if (winner === 'player') {
          if (betType === 'coins' || mode === 'online') {
              const prize = (mode === 'online' ? currentRoom.bet_amount : coinBet) * 2;
              await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde + prize }).eq('id', currentUser.id);
          }
          setActionLog("VICTORY. YOU SURVIVED.");
      } else {
          if (betType === 'pets' && mode === 'bot') {
              await supabase.from('inventory').delete().in('id', selectedPets);
          }
          setActionLog("YOU DIED. GAME OVER.");
      }
      
      if (currentRoom) {
          await supabase.from('roulette_lobbies').update({ status: 'finished' }).eq('id', currentRoom.id);
          supabase.removeChannel(channelRef.current);
      }
      setView('result');
  };

  return (
    <div className="min-h-[calc(100vh-80px)] bg-[#050505] text-white p-4 md:p-8 font-sans overflow-hidden">
      <div className={`absolute inset-0 bg-red-900/10 transition-opacity duration-1000 ${view === 'playing' ? 'opacity-100' : 'opacity-0'}`}></div>

      <div className="max-w-[1200px] mx-auto relative z-10">
        
        {/* --- MENU PRINCIPAL --- */}
        {view === 'menu' && (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <h1 className="text-7xl font-black italic tracking-tighter mb-4 text-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.5)]">ROULETTE</h1>
                <p className="text-gray-400 mb-12 tracking-widest uppercase font-bold">One bullet. One survivor.</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl">
                    <button onClick={() => { setMode('bot'); setView('betting'); }} className="group bg-[#111] border-2 border-[#222] p-10 rounded-3xl hover:border-red-600 transition-all text-center">
                        <span className="text-4xl block mb-4 group-hover:scale-125 transition-transform">🤖</span>
                        <h3 className="text-xl font-black">LOCAL MODE</h3>
                        <p className="text-gray-500 text-sm mt-2">Practice against TetoBot</p>
                    </button>
                    <button onClick={openLobbies} className="group bg-[#111] border-2 border-[#222] p-10 rounded-3xl hover:border-blue-500 transition-all text-center">
                        <span className="text-4xl block mb-4 group-hover:scale-125 transition-transform">🌐</span>
                        <h3 className="text-xl font-black">ONLINE PVP</h3>
                        <p className="text-gray-500 text-sm mt-2">Duel against real players</p>
                    </button>
                </div>
            </div>
        )}

        {/* --- LOBBIES ONLINE --- */}
        {view === 'lobbies' && (
            <div className="animate-fade-in max-w-4xl mx-auto">
                <div className="flex justify-between items-center mb-8">
                    <button onClick={() => setView('menu')} className="text-gray-500 hover:text-white font-bold">← BACK</button>
                    <h2 className="text-3xl font-black uppercase text-blue-500">Public Matches</h2>
                    <button onClick={() => setView('betting')} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold uppercase shadow-[0_0_15px_rgba(37,99,235,0.4)]">Host Game</button>
                </div>

                <div className="bg-[#111] rounded-3xl p-6 border border-[#222] min-h-[400px]">
                    {lobbies.length === 0 ? (
                        <div className="text-center text-gray-500 py-20 font-bold uppercase tracking-widest">No games available. Host one!</div>
                    ) : (
                        <div className="space-y-4">
                            {lobbies.map(l => (
                                <div key={l.id} className="bg-[#0a0a0a] border border-[#222] p-4 rounded-2xl flex justify-between items-center hover:border-blue-500/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 bg-[#222] rounded-full flex items-center justify-center font-black">{l.host_name.charAt(0)}</div>
                                        <div>
                                            <p className="font-black text-lg">{l.host_name}</p>
                                            <p className="text-xs text-gray-500 uppercase font-bold">Betting: {l.bet_type}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-xs text-gray-500 font-bold uppercase">Pot</p>
                                            <p className="font-black text-blue-400 flex items-center gap-1"><GreenCoin/> {formatValue(l.bet_amount)}</p>
                                        </div>
                                        <button onClick={() => joinLobby(l)} className="bg-[#222] hover:bg-blue-600 px-6 py-3 rounded-xl font-black uppercase transition-colors">Join</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* --- PANTALLA DE APUESTAS (HOSTING / LOCAL) --- */}
        {view === 'betting' && (
            <div className="animate-fade-in max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => setView(mode === 'online' ? 'lobbies' : 'menu')} className="text-gray-500 hover:text-white font-bold">← BACK</button>
                    <h2 className="text-3xl font-black uppercase">Setup your Bet</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="bg-[#111] rounded-3xl p-8 border border-[#222]">
                        <div className="flex gap-4 mb-8">
                            <button onClick={() => setBetType('coins')} className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest transition-all ${betType === 'coins' ? (mode === 'online' ? 'bg-blue-600' : 'bg-red-600') + ' text-white' : 'bg-[#0a0a0a] text-gray-500'}`}>Coins</button>
                            <button onClick={() => setBetType('pets')} disabled={mode === 'online'} className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest transition-all ${betType === 'pets' ? 'bg-red-600 text-white' : 'bg-[#0a0a0a] text-gray-500'} disabled:opacity-20`}>
                                Pets {mode === 'online' && '(Local Only)'}
                            </button>
                        </div>

                        {betType === 'coins' ? (
                            <div className="space-y-6">
                                <p className="text-gray-400 text-sm font-bold uppercase">Enter Coin Amount</p>
                                <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-white/5 flex items-center justify-between focus-within:border-white/20">
                                    <input type="number" value={coinBet} onChange={(e) => setCoinBet(Number(e.target.value))} className="bg-transparent text-3xl font-black outline-none w-full" />
                                    <GreenCoin cls="w-8 h-8"/>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-gray-400 text-sm font-bold uppercase">Select Pets ({selectedPets.length})</p>
                                <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {userInventory.map(pet => (
                                        <div key={pet.id} onClick={() => togglePetSelection(pet.id)} className={`p-2 rounded-xl border-2 cursor-pointer transition-all ${selectedPets.includes(pet.id) ? 'border-red-600 bg-red-900/20' : 'border-[#222] bg-[#0a0a0a] opacity-60'}`}>
                                            <img src={pet.img} className="w-full h-12 object-contain mb-1" alt={pet.name} />
                                            <p className="text-[10px] font-black truncate text-center">{pet.name}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col justify-between">
                        <div className="bg-[#111] rounded-3xl p-8 border border-[#222] mb-6">
                            <h4 className="text-gray-500 font-bold uppercase text-xs mb-4">Match Preview</h4>
                            <div className="flex justify-between items-center">
                                <div>
                                    <p className="text-sm font-bold text-gray-400">YOU</p>
                                    <p className={`text-2xl font-black ${mode === 'online' ? 'text-blue-500' : 'text-red-600'}`}>{betType === 'coins' ? formatValue(coinBet) : formatValue(calculateSelectedValue())}</p>
                                </div>
                                <div className="text-2xl font-black italic text-gray-700">VS</div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-gray-400">{mode === 'online' ? 'ANYONE' : 'TETOBOT'}</p>
                                    <p className="text-2xl font-black text-white">READY</p>
                                </div>
                            </div>
                        </div>
                        <button onClick={mode === 'online' ? createOnlineLobby : prepareBotMatch} className={`w-full py-6 text-white font-black text-2xl rounded-3xl transition-all active:scale-95 ${mode === 'online' ? 'bg-blue-600 hover:bg-blue-500 shadow-[0_10px_40px_rgba(37,99,235,0.3)]' : 'bg-red-600 hover:bg-red-500 shadow-[0_10px_40px_rgba(220,38,38,0.3)]'}`}>
                            {isSpinning ? 'LOADING...' : (mode === 'online' ? 'CREATE MATCH' : 'START DUEL')}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- MESA DE JUEGO (GAMEPLAY) --- */}
        {view === 'playing' && (
            <div className="flex flex-col items-center py-10">
                {/* Oponente (Bot o Jugador Online) */}
                <div className={`flex flex-col items-center mb-10 transition-all duration-500 ${turn === 'opponent' ? 'scale-125 opacity-100' : 'opacity-40 scale-90'}`}>
                    <div className="w-32 h-32 rounded-full border-4 border-white/20 p-2 bg-[#111] relative">
                        <img src={opponent.avatar} className="w-full h-full object-contain" />
                        <div className={`absolute -bottom-4 left-1/2 -translate-x-1/2 text-black font-black text-xs px-4 py-1 rounded-full uppercase tracking-widest ${mode === 'online' ? 'bg-blue-400' : 'bg-white'}`}>{opponent.name}</div>
                    </div>
                </div>

                {/* Zona del Arma */}
                <div className="relative w-full h-40 flex items-center justify-center mb-10">
                    <div className="text-center">
                        <p className={`text-4xl font-black italic transition-all duration-300 ${actionLog.includes('BANG') ? 'text-red-600 scale-150' : 'text-white'}`}>
                            {actionLog}
                        </p>
                        {currentRoom?.status !== 'waiting' && (
                            <p className="text-gray-600 font-bold mt-2 uppercase tracking-[0.5em]">Chamber {currentChamber + 1}/6</p>
                        )}
                    </div>
                </div>

                {/* Jugador Local */}
                <div className={`flex flex-col items-center transition-all duration-500 ${turn === 'player' ? 'scale-110 opacity-100' : 'opacity-40 scale-90'}`}>
                    <div className="flex gap-4 mb-8">
                        <button 
                            disabled={isSpinning || actionLog === 'WAITING FOR OPPONENT...'} 
                            onClick={() => pullTrigger('self')}
                            className="bg-white text-black px-10 py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-gray-200 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                            Shoot Myself
                        </button>
                        <button 
                            disabled={isSpinning || actionLog === 'WAITING FOR OPPONENT...' || hasShotOpponent.player} 
                            onClick={() => { pullTrigger('opponent'); setHasShotOpponent(p => ({...p, player: true})); }}
                            className="bg-red-600 text-white px-10 py-5 rounded-2xl font-black uppercase tracking-widest hover:bg-red-500 transition-all disabled:opacity-20 disabled:cursor-not-allowed"
                        >
                            Shoot Opponent {hasShotOpponent.player ? '(USED)' : '(1 LEFT)'}
                        </button>
                    </div>

                    <div className="w-32 h-32 rounded-full border-4 border-red-600/50 p-2 bg-[#111] relative">
                        <img src="/avatar-placeholder.png" className="w-full h-full object-contain" />
                        <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 bg-red-600 text-white font-black text-xs px-4 py-1 rounded-full uppercase tracking-widest">YOU</div>
                    </div>
                </div>
            </div>
        )}

        {/* --- PANTALLA DE RESULTADOS --- */}
        {view === 'result' && (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in">
                <div className="text-8xl mb-8">{actionLog.includes('VICTORY') ? '🏆' : '💀'}</div>
                <h2 className="text-5xl font-black mb-10 text-center">{actionLog}</h2>
                <button onClick={() => { setView('menu'); setCurrentRoom(null); }} className="px-12 py-5 bg-white text-black font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all">
                    BACK TO MENU
                </button>
            </div>
        )}

      </div>

      <style jsx global>{`
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  );
}
