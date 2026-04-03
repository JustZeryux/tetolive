"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/Supabase';

// Componentes Visuales
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" />;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val?.toLocaleString();
};

// SVG del Revólver Épico
const GunSVG = ({ isPointingSelf, isShaking, isFiring }) => (
    <div className={`transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform ${isPointingSelf ? 'rotate-180' : 'rotate-0'} ${isShaking ? 'animate-shake-hard' : ''} ${isFiring ? 'scale-125 drop-shadow-[0_0_40px_rgba(220,38,38,1)]' : 'drop-shadow-[0_15px_15px_rgba(0,0,0,0.8)]'}`}>
        <svg width="200" height="200" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M120 280 L120 380 Q120 400 140 400 L180 400 Q200 400 200 380 L200 280 Z" fill="#2d3748" stroke="#1a202c" strokeWidth="8"/>
            <path d="M120 280 L200 280 L250 240 L450 240 Q470 240 470 220 L470 180 Q470 160 450 160 L120 160 Z" fill="#4a5568" stroke="#1a202c" strokeWidth="8"/>
            <circle cx="280" cy="200" r="30" fill="#1a202c" />
            <path d="M450 180 L470 180" stroke="#f56565" strokeWidth="12" strokeLinecap="round" className={isFiring ? "animate-pulse" : "hidden"}/>
            {isFiring && <circle cx="490" cy="200" r="40" fill="url(#fire)" />}
            <defs>
                <radialGradient id="fire" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fff" />
                    <stop offset="50%" stopColor="#fbd38d" />
                    <stop offset="100%" stopColor="#e53e3e" stopOpacity="0" />
                </radialGradient>
            </defs>
        </svg>
    </div>
);

export default function RussianRoulettePage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userInventory, setUserInventory] = useState([]);
  
  // NAVEGACIÓN Y MODOS
  const [view, setView] = useState('menu'); 
  const [mode, setMode] = useState('bot'); 
  
  // APUESTAS
  const [betType, setBetType] = useState('coins');
  const [coinBet, setCoinBet] = useState(100);
  const [selectedPets, setSelectedPets] = useState([]);
  
  // MULTIJUGADOR ONLINE
  const [lobbies, setLobbies] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const channelRef = useRef(null);

  // ESTADO DE LA PARTIDA 
  const [turn, setTurn] = useState('player'); 
  const [actionLog, setActionLog] = useState("READY TO SPIN?");
  const [isSpinning, setIsSpinning] = useState(false);
  const [hasShotOpponent, setHasShotOpponent] = useState({ player: false, opponent: false });
  
  // EFECTOS ÉPICOS
  const [gunPointingSelf, setGunPointingSelf] = useState(false);
  const [gunShaking, setGunShaking] = useState(false);
  const [gunFiring, setGunFiring] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);

  // MEMORIA BLINDADA (Fix del Bug de 8 Balas)
  const chambersRef = useRef([]);
  const currentChamberRef = useRef(0);
  const [uiChamber, setUiChamber] = useState(0); // Solo para pintar la UI
  
  const [opponent, setOpponent] = useState({ name: "TetoBot", avatar: "/TetoGun.png", betValue: 0 });

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

  const getAvatar = (url, name) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name || 'player'}&backgroundColor=ff0000,000000`;

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
      setOpponent({ name: "TetoBot", avatar: "/TetoGun.png", betValue: botValue });

      // Cargar Bala Real
      const newChambers = [false, false, false, false, false, false];
      newChambers[Math.floor(Math.random() * 6)] = true;
      chambersRef.current = newChambers;
      currentChamberRef.current = 0;
      setUiChamber(0);

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
      supabase.channel('public:roulette_lobbies').on('postgres_changes', { event: '*', schema: 'public', table: 'roulette_lobbies' }, payload => {
          fetchLobbies();
      }).subscribe();
  };

  const createOnlineLobby = async () => {
      if (betType === 'coins' && userProfile.saldo_verde < coinBet) return alert("No tienes saldo suficiente.");
      if (betType === 'pets') return alert("Pets bets online coming next patch."); 

      await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde - coinBet }).eq('id', currentUser.id);

      const { data, error } = await supabase.from('roulette_lobbies').insert({
          host_id: currentUser.id,
          host_name: userProfile.username || 'Host',
          bet_type: 'coins',
          bet_amount: coinBet
      }).select().single();

      if (!error && data) {
          setCurrentRoom(data);
          setOpponent({ name: "Waiting...", avatar: getAvatar(null, "Wait"), betValue: coinBet });
          connectToRoom(data.id, true);
          setView('playing');
          setActionLog("WAITING FOR OPPONENT...");
      }
  };

  const joinLobby = async (lobby) => {
      if (userProfile.saldo_verde < lobby.bet_amount) return alert("No tienes saldo para igualar la apuesta.");
      
      await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde - lobby.bet_amount }).eq('id', currentUser.id);
      await supabase.from('roulette_lobbies').update({
          guest_id: currentUser.id,
          guest_name: userProfile.username || 'Player',
          status: 'playing'
      }).eq('id', lobby.id);

      setCurrentRoom(lobby);
      setOpponent({ name: lobby.host_name, avatar: getAvatar(null, lobby.host_name), betValue: lobby.bet_amount });
      connectToRoom(lobby.id, false);
      setView('playing');
  };

  const connectToRoom = (roomId, isHost) => {
      const channel = supabase.channel(`room_${roomId}`);
      channelRef.current = channel;

      channel.on('broadcast', { event: 'game_start' }, payload => {
          chambersRef.current = payload.chambers;
          currentChamberRef.current = 0;
          setUiChamber(0);
          setTurn('player'); 
          setActionLog(isHost ? "YOUR TURN." : "OPPONENT's TURN.");
          setOpponent(prev => ({...prev, name: payload.guest_name, avatar: getAvatar(null, payload.guest_name)}));
      });

      channel.on('broadcast', { event: 'shoot_action' }, payload => {
          executeOnlineShot(payload.target, payload.isBullet, payload.shooter);
      });

      channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && isHost) {
              supabase.channel('public:roulette_lobbies').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'roulette_lobbies', filter: `id=eq.${roomId}` }, async (payload) => {
                  if (payload.new.status === 'playing') {
                      const newChambers = [false, false, false, false, false, false];
                      newChambers[Math.floor(Math.random() * 6)] = true;
                      chambersRef.current = newChambers;
                      currentChamberRef.current = 0;
                      setUiChamber(0);
                      
                      setTurn('player');
                      setActionLog("YOUR TURN.");
                      setOpponent(prev => ({...prev, name: payload.new.guest_name, avatar: getAvatar(null, payload.new.guest_name)}));
                      
                      channel.send({ type: 'broadcast', event: 'game_start', payload: { chambers: newChambers, guest_name: payload.new.guest_name } });
                  }
              }).subscribe();
          }
      });
  };

  // --- LÓGICA DE JUEGO PRINCIPAL ---
  const pullTrigger = async (target) => {
    if (isSpinning || (mode === 'bot' && turn !== 'player') || (mode === 'online' && (currentRoom?.host_id === currentUser.id && turn !== 'player') || (currentRoom?.guest_id === currentUser.id && turn === 'player'))) return;
    
    setIsSpinning(true);
    // LEEMOS DE LA REFERENCIA PARA QUE NUNCA FALLE
    const currentIdx = currentChamberRef.current;
    if(currentIdx >= 6) return; // Fallback de seguridad extrema
    
    const isBullet = chambersRef.current[currentIdx];
    const shootingSelf = target === 'self';

    if (mode === 'online') {
        const role = currentRoom.host_id === currentUser.id ? 'host' : 'guest';
        channelRef.current.send({ type: 'broadcast', event: 'shoot_action', payload: { target, isBullet, shooter: role } });
        executeOnlineShot(target, isBullet, role);
    } else {
        // Ejecutar Visuales Bot Local
        setGunPointingSelf(shootingSelf);
        setActionLog(shootingSelf ? "YOU POINT THE GUN AT YOUR HEAD..." : "YOU AIM AT TETOBOT...");
        await new Promise(r => setTimeout(r, 1000));
        
        setGunShaking(true);
        await new Promise(r => setTimeout(r, 1500));
        setGunShaking(false);

        if (isBullet) {
            setGunFiring(true);
            setScreenFlash(true);
            setActionLog("💥 BANG! 💥");
            setTimeout(() => endGame(shootingSelf ? 'opponent' : 'player'), 2000);
        } else {
            setActionLog("...CLICK. NOTHING HAPPENED.");
            setTimeout(() => {
                currentChamberRef.current += 1;
                setUiChamber(currentChamberRef.current);
                setTurn('opponent');
                setIsSpinning(false);
            }, 1500);
        }
    }
  };

  // Trigger del Bot (Vigila cuando le toca el turno)
  useEffect(() => {
      if (mode === 'bot' && turn === 'opponent' && view === 'playing') {
          const runBot = async () => {
              setIsSpinning(true);
              setActionLog("TETOBOT IS THINKING...");
              await new Promise(r => setTimeout(r, 2000));
              
              const currentIdx = currentChamberRef.current;
              const isBullet = chambersRef.current[currentIdx];
              const shootPlayer = !hasShotOpponent.opponent && Math.random() < 0.2;
              
              if (shootPlayer) setHasShotOpponent(prev => ({...prev, opponent: true}));
              
              setGunPointingSelf(!shootPlayer); // Si se dispara a si mismo, el arma nos apunta a nosotros en la pantalla NO, apunta arriba.
              setActionLog(shootPlayer ? "TETOBOT AIMS AT YOU!" : "TETOBOT POINTS AT ITS HEAD...");
              
              await new Promise(r => setTimeout(r, 1000));
              setGunShaking(true);
              await new Promise(r => setTimeout(r, 1500));
              setGunShaking(false);

              if (isBullet) {
                  setGunFiring(true);
                  setScreenFlash(true);
                  setActionLog("💥 BANG! 💥");
                  setTimeout(() => endGame(shootPlayer ? 'opponent' : 'player'), 2000);
              } else {
                  setActionLog("...CLICK. TETOBOT SURVIVED.");
                  setTimeout(() => {
                      currentChamberRef.current += 1;
                      setUiChamber(currentChamberRef.current);
                      setTurn('player');
                      setIsSpinning(false);
                      setActionLog("YOUR TURN.");
                  }, 1500);
              }
          };
          runBot();
      }
  }, [turn, view, mode]);

  const executeOnlineShot = async (target, isBullet, shooter) => {
      const imShooter = (currentRoom.host_id === currentUser.id && shooter === 'host') || (currentRoom.guest_id === currentUser.id && shooter === 'guest');
      const shootingSelf = target === 'self';

      setGunPointingSelf(shootingSelf ? imShooter : !imShooter);

      if (imShooter) setActionLog(shootingSelf ? "YOU POINT AT YOUR HEAD..." : "YOU AIM AT OPPONENT...");
      else setActionLog(shootingSelf ? "OPPONENT POINTS AT THEIR HEAD..." : "OPPONENT AIMS AT YOU!");

      await new Promise(r => setTimeout(r, 1000));
      setGunShaking(true);
      await new Promise(r => setTimeout(r, 1500));
      setGunShaking(false);

      if (isBullet) {
          setGunFiring(true);
          setScreenFlash(true);
          setActionLog("💥 BANG! 💥");
          let iWon = false;
          if (imShooter && !shootingSelf) iWon = true;
          if (!imShooter && shootingSelf) iWon = true;
          setTimeout(() => endGame(iWon ? 'player' : 'opponent'), 2000);
      } else {
          setActionLog("...CLICK.");
          setTimeout(() => {
              currentChamberRef.current += 1;
              setUiChamber(currentChamberRef.current);
              setTurn(imShooter ? 'opponent' : 'player');
              setIsSpinning(false);
              setActionLog(!imShooter ? "YOUR TURN." : "OPPONENT's TURN.");
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
      setGunFiring(false);
      setScreenFlash(false);
  };

  return (
    <div className={`min-h-[calc(100vh-80px)] bg-[#050505] text-white p-4 md:p-8 font-sans overflow-hidden transition-colors duration-100 ${screenFlash ? 'bg-red-900' : ''}`}>
      
      {/* Tensión Atmosférica */}
      <div className={`absolute inset-0 transition-opacity duration-1000 pointer-events-none z-0 ${view === 'playing' ? 'bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-[#050505] to-[#050505] opacity-100' : 'opacity-0'}`}></div>
      {screenFlash && <div className="fixed inset-0 bg-red-600/50 z-50 animate-flash pointer-events-none"></div>}

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
                    <h2 className="text-3xl font-black uppercase text-blue-500 drop-shadow-[0_0_10px_rgba(37,99,235,0.5)]">Public Matches</h2>
                    <button onClick={() => setView('betting')} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-xl font-bold uppercase shadow-[0_0_15px_rgba(37,99,235,0.4)] transition-all">Host Game</button>
                </div>

                <div className="bg-[#111] rounded-3xl p-6 border border-[#222] min-h-[400px]">
                    {lobbies.length === 0 ? (
                        <div className="text-center text-gray-500 py-20 font-bold uppercase tracking-widest flex flex-col items-center">
                            <span className="text-4xl mb-4">🏜️</span>
                            No games available. Host one!
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {lobbies.map(l => (
                                <div key={l.id} className="bg-[#0a0a0a] border border-[#222] p-4 rounded-2xl flex justify-between items-center hover:border-blue-500/50 transition-colors">
                                    <div className="flex items-center gap-4">
                                        <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-[#333]">
                                            <img src={getAvatar(null, l.host_name)} alt="avatar" />
                                        </div>
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
                                        <button onClick={() => joinLobby(l)} className="bg-[#222] hover:bg-blue-600 px-6 py-3 rounded-xl font-black uppercase transition-colors shadow-lg">Join</button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        )}

        {/* --- PANTALLA DE APUESTAS --- */}
        {view === 'betting' && (
            <div className="animate-fade-in max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => setView(mode === 'online' ? 'lobbies' : 'menu')} className="text-gray-500 hover:text-white font-bold">← BACK</button>
                    <h2 className="text-3xl font-black uppercase">Setup your Bet</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                    <div className="bg-[#111] rounded-3xl p-8 border border-[#222]">
                        <div className="flex gap-4 mb-8">
                            <button onClick={() => setBetType('coins')} className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest transition-all ${betType === 'coins' ? (mode === 'online' ? 'bg-blue-600' : 'bg-red-600') + ' text-white shadow-lg' : 'bg-[#0a0a0a] text-gray-500'}`}>Coins</button>
                            <button onClick={() => setBetType('pets')} disabled={mode === 'online'} className={`flex-1 py-3 rounded-xl font-black uppercase tracking-widest transition-all ${betType === 'pets' ? 'bg-red-600 text-white shadow-lg' : 'bg-[#0a0a0a] text-gray-500'} disabled:opacity-20`}>
                                Pets {mode === 'online' && '(Local Only)'}
                            </button>
                        </div>

                        {betType === 'coins' ? (
                            <div className="space-y-6">
                                <p className="text-gray-400 text-sm font-bold uppercase">Enter Coin Amount</p>
                                <div className="bg-[#0a0a0a] p-6 rounded-2xl border border-white/5 flex items-center justify-between focus-within:border-white/20 transition-colors">
                                    <input type="number" value={coinBet} onChange={(e) => setCoinBet(Number(e.target.value))} className="bg-transparent text-3xl font-black outline-none w-full" />
                                    <GreenCoin cls="w-8 h-8"/>
                                </div>
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <p className="text-gray-400 text-sm font-bold uppercase">Select Pets ({selectedPets.length})</p>
                                <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {userInventory.map(pet => (
                                        <div key={pet.id} onClick={() => togglePetSelection(pet.id)} className={`p-2 rounded-xl border-2 cursor-pointer transition-all ${selectedPets.includes(pet.id) ? 'border-red-600 bg-red-900/20 shadow-[0_0_10px_rgba(220,38,38,0.3)]' : 'border-[#222] bg-[#0a0a0a] opacity-60 hover:opacity-100'}`}>
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
                                    <p className="text-sm font-bold text-gray-400 uppercase">{userProfile?.username || 'YOU'}</p>
                                    <p className={`text-2xl font-black flex items-center gap-2 ${mode === 'online' ? 'text-blue-500' : 'text-red-600'}`}>{betType === 'coins' ? formatValue(coinBet) : formatValue(calculateSelectedValue())}</p>
                                </div>
                                <div className="text-2xl font-black italic text-gray-700">VS</div>
                                <div className="text-right">
                                    <p className="text-sm font-bold text-gray-400 uppercase">{mode === 'online' ? 'ANYONE' : 'TETOBOT'}</p>
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

        {/* --- MESA DE JUEGO (GAMEPLAY ÉPICO) --- */}
        {view === 'playing' && (
            <div className="flex flex-col items-center py-4 min-h-[70vh] justify-between relative">
                
                {/* Oponente */}
                <div className={`flex flex-col items-center transition-all duration-500 ${turn === 'opponent' ? 'scale-110 opacity-100' : 'opacity-40 scale-90'}`}>
                    <div className={`w-28 h-28 rounded-full border-4 p-1 bg-[#0a0a0a] relative shadow-2xl ${turn === 'opponent' ? 'border-red-600 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)]' : 'border-[#333]'}`}>
                        <img src={opponent.avatar} className="w-full h-full object-cover rounded-full" alt="Opponent" />
                        <div className={`absolute -bottom-3 left-1/2 -translate-x-1/2 text-white font-black text-[10px] px-4 py-1 rounded-full uppercase tracking-widest border border-black ${mode === 'online' ? 'bg-blue-600' : 'bg-red-900'}`}>{opponent.name}</div>
                    </div>
                </div>

                {/* Zona de Tensión y Arma */}
                <div className="w-full flex flex-col items-center justify-center relative my-12">
                    <p className={`text-3xl md:text-5xl font-black italic text-center transition-all duration-300 absolute -top-16 w-full ${actionLog.includes('BANG') ? 'text-red-600 scale-125 drop-shadow-[0_0_20px_rgba(220,38,38,1)]' : 'text-white drop-shadow-md'}`}>
                        {actionLog}
                    </p>
                    
                    {/* El Revólver */}
                    <div className="relative w-64 h-64 flex items-center justify-center">
                        <div className="absolute inset-0 bg-red-900 blur-[80px] opacity-20 rounded-full"></div>
                        <GunSVG isPointingSelf={gunPointingSelf} isShaking={gunShaking} isFiring={gunFiring} />
                    </div>

                    {/* UI del Cilindro (Las 6 balas) */}
                    {currentRoom?.status !== 'waiting' && (
                        <div className="flex gap-3 mt-8">
                            {[0, 1, 2, 3, 4, 5].map(idx => (
                                <div key={idx} className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${idx === uiChamber ? 'border-red-500 bg-red-500 shadow-[0_0_10px_rgba(220,38,38,1)] scale-125' : idx < uiChamber ? 'border-[#333] bg-[#111] opacity-50' : 'border-gray-500 bg-transparent'}`}></div>
                            ))}
                        </div>
                    )}
                </div>

                {/* Jugador Local */}
                <div className={`flex flex-col items-center transition-all duration-500 w-full max-w-2xl ${turn === 'player' ? 'scale-105 opacity-100' : 'opacity-40 scale-90'}`}>
                    <div className="flex justify-between w-full items-end">
                        
                        <div className="flex-1 flex justify-end pr-8">
                            <button 
                                disabled={isSpinning || actionLog === 'WAITING FOR OPPONENT...'} 
                                onClick={() => pullTrigger('self')}
                                className="bg-white hover:bg-gray-200 text-black px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-[0_5px_15px_rgba(255,255,255,0.2)] active:scale-95"
                            >
                                Shoot Myself
                            </button>
                        </div>

                        <div className={`w-32 h-32 rounded-full border-4 p-1 bg-[#0a0a0a] relative z-10 shadow-2xl shrink-0 ${turn === 'player' ? 'border-red-600 drop-shadow-[0_0_20px_rgba(220,38,38,0.8)]' : 'border-[#333]'}`}>
                            <img src={getAvatar(userProfile?.avatar_url, userProfile?.username)} className="w-full h-full object-cover rounded-full" alt="You" />
                            <div className="absolute -bottom-3 left-1/2 -translate-x-1/2 bg-red-600 text-white font-black text-xs px-4 py-1 rounded-full uppercase tracking-widest border border-black shadow-lg">YOU</div>
                        </div>

                        <div className="flex-1 flex justify-start pl-8">
                            <button 
                                disabled={isSpinning || actionLog === 'WAITING FOR OPPONENT...' || hasShotOpponent.player} 
                                onClick={() => { pullTrigger('opponent'); setHasShotOpponent(p => ({...p, player: true})); }}
                                className="bg-red-600 hover:bg-red-500 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest transition-all disabled:opacity-20 disabled:cursor-not-allowed shadow-[0_5px_20px_rgba(220,38,38,0.4)] active:scale-95"
                            >
                                Shoot Foe {hasShotOpponent.player ? '(0)' : '(1)'}
                            </button>
                        </div>

                    </div>
                </div>
            </div>
        )}

        {/* --- PANTALLA DE RESULTADOS --- */}
        {view === 'result' && (
            <div className="flex flex-col items-center justify-center py-20 animate-fade-in relative z-20">
                <div className="absolute inset-0 bg-black/60 blur-3xl rounded-full z-0"></div>
                <div className="text-9xl mb-8 z-10 drop-shadow-[0_0_20px_rgba(255,0,0,0.5)]">{actionLog.includes('VICTORY') ? '🏆' : '💀'}</div>
                <h2 className={`text-6xl font-black mb-10 text-center z-10 uppercase tracking-widest drop-shadow-xl ${actionLog.includes('VICTORY') ? 'text-yellow-400' : 'text-red-600'}`}>{actionLog}</h2>
                <button onClick={() => { setView('menu'); setCurrentRoom(null); }} className="px-14 py-6 bg-white text-black text-xl font-black uppercase tracking-widest rounded-2xl hover:bg-gray-200 transition-all shadow-[0_0_30px_rgba(255,255,255,0.3)] hover:scale-105 z-10">
                    BACK TO MENU
                </button>
            </div>
        )}

      </div>

      <style jsx global>{`
        .animate-fade-in { animation: fadeIn 0.5s ease-out; }
        .animate-shake-hard { animation: shakeHard 0.3s ease-in-out infinite; }
        .animate-flash { animation: flash 0.5s ease-out; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shakeHard {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            25% { transform: translate(-3px, 3px) rotate(-2deg); }
            50% { transform: translate(3px, -3px) rotate(2deg); }
            75% { transform: translate(-3px, -3px) rotate(-1deg); }
        }
        @keyframes flash {
            0% { opacity: 1; background-color: rgba(220,38,38,0.9); }
            100% { opacity: 0; background-color: transparent; }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
      `}</style>
    </div>
  );
}
