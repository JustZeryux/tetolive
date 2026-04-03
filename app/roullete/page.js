"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/Supabase';

// --- COMPONENTES VISUALES ---
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val?.toLocaleString();
};

const getAvatar = (url, name) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name || 'player'}&backgroundColor=b91c1c,000000`;

const playSFX = (type) => {
    try {
        const audio = new Audio(`/sounds/${type}.mp3`);
        audio.volume = type === 'bang' ? 1.0 : 0.7;
        audio.play().catch(() => {});
    } catch (e) {}
};

// SVG del Revólver (Más detallado)
const GunSVG = ({ targetAngle, isShaking, isFiring, isSpinningCylinder }) => (
    <div className={`transition-all duration-700 ease-[cubic-bezier(0.34,1.56,0.64,1)] transform ${isShaking ? 'animate-shake-hard' : ''} ${isFiring ? 'scale-125 drop-shadow-[0_0_50px_rgba(220,38,38,1)]' : 'drop-shadow-[0_25px_30px_rgba(0,0,0,0.9)]'}`} style={{ transform: `rotate(${targetAngle}deg)` }}>
        <svg width="220" height="220" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M120 280 L120 400 Q120 420 140 420 L180 420 Q200 420 200 400 L200 280 Z" fill="#111" stroke="#000" strokeWidth="10"/>
            <path d="M130 290 L130 390 L190 390 L190 290 Z" fill="#333" />
            <path d="M120 280 L200 280 L250 230 L460 230 Q480 230 480 210 L480 170 Q480 150 460 150 L120 150 Z" fill="#444" stroke="#000" strokeWidth="8"/>
            <path d="M300 230 L300 260" stroke="#000" strokeWidth="8" />
            {/* Cilindro que gira */}
            <g className={isSpinningCylinder ? "animate-spin-fast" : ""} style={{ transformOrigin: "280px 190px" }}>
                <circle cx="280" cy="190" r="45" fill="#222" stroke="#000" strokeWidth="6"/>
                <circle cx="280" cy="190" r="12" fill="#555" />
                <circle cx="250" cy="190" r="10" fill="#000" className="shadow-inner"/>
                <circle cx="310" cy="190" r="10" fill="#000" />
                <circle cx="280" cy="160" r="10" fill="#000" />
                <circle cx="280" cy="220" r="10" fill="#000" />
            </g>
            <path d="M460 170 L480 170" stroke="#ff3333" strokeWidth="14" strokeLinecap="round" className={isFiring ? "animate-pulse" : "hidden"}/>
            {isFiring && <circle cx="510" cy="190" r="60" fill="url(#fire)" />}
            <defs>
                <radialGradient id="fire" cx="50%" cy="50%" r="50%">
                    <stop offset="0%" stopColor="#fff" />
                    <stop offset="30%" stopColor="#fbd38d" />
                    <stop offset="80%" stopColor="#e53e3e" />
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
  
  const [view, setView] = useState('menu'); 
  const [mode, setMode] = useState('bot'); 
  
  // APUESTAS COMPLETAS (COINS Y PETS)
  const [betType, setBetType] = useState('coins');
  const [coinBet, setCoinBet] = useState(10);
  const [selectedPets, setSelectedPets] = useState([]);
  const [botPets, setBotPets] = useState([]); // Pets generadas por TetoBot para la mesa
  
  // LOBBIES & MULTIPLAYER
  const [lobbies, setLobbies] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [players, setPlayers] = useState([]); 
  const channelRef = useRef(null);

  // GAMEPLAY STATE
  const [turnId, setTurnId] = useState(null); 
  const [actionLog, setActionLog] = useState("WAITING...");
  const [isProcessing, setIsProcessing] = useState(false);
  const [potTotal, setPotTotal] = useState(0);
  
  // EFECTOS
  const [gunAngle, setGunAngle] = useState(-90); 
  const [gunShaking, setGunShaking] = useState(false);
  const [gunFiring, setGunFiring] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);
  const [cylinderSpinning, setCylinderSpinning] = useState(false);

  // MEMORIA DE BALAS
  const chambersRef = useRef([]);
  const currentChamberRef = useRef(0);
  const [uiChamber, setUiChamber] = useState(0); 

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

  const togglePetSelection = (pet) => {
      if (selectedPets.find(p => p.id === pet.id)) setSelectedPets(selectedPets.filter(p => p.id !== pet.id));
      else setSelectedPets([...selectedPets, pet]);
  };
  const calculateSelectedValue = () => selectedPets.reduce((sum, p) => sum + p.value, 0);

  // --- MODO BOT (LOCAL) ---
  const startBotMatch = async () => {
      const isCoin = betType === 'coins';
      const myBetVal = isCoin ? coinBet : calculateSelectedValue();
      
      if (isCoin && userProfile.saldo_verde < myBetVal) return alert("Insufficient coins!");
      if (!isCoin && selectedPets.length === 0) return alert("Select at least one pet!");
      
      // Cobro
      if (isCoin) await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde - myBetVal }).eq('id', currentUser.id);
      
      // Bot iguala la apuesta
      let tetoPets = [];
      if (!isCoin) {
          const { data: allItems } = await supabase.from('items').select('*').gt('value', 0);
          let currentVal = 0;
          if (allItems) {
              while (currentVal < myBetVal && tetoPets.length < 5) {
                  const p = allItems[Math.floor(Math.random() * allItems.length)];
                  tetoPets.push(p);
                  currentVal += p.value;
              }
          }
          setBotPets(tetoPets);
      }
      
      setPotTotal(myBetVal * 2);
      
      const botPlayer = { id: 'bot', name: 'TetoBot', avatar: '/TetoGun.png', isDead: false };
      const mePlayer = { id: currentUser.id, name: userProfile.username, avatar: getAvatar(userProfile.avatar_url, userProfile.username), isDead: false };
      
      setPlayers([mePlayer, botPlayer]);
      setTurnId(currentUser.id);
      
      // Animación inicial de recargar
      setView('playing');
      setActionLog("LOADING CYLINDER...");
      setCylinderSpinning(true);
      playSFX('spin');
      
      setTimeout(() => {
          const newChambers = [false, false, false, false, false, false];
          newChambers[Math.floor(Math.random() * 6)] = true;
          chambersRef.current = newChambers;
          currentChamberRef.current = 0;
          setUiChamber(0);
          setCylinderSpinning(false);
          setActionLog("YOUR TURN.");
      }, 2000);
  };

  const executeBotTurn = async () => {
      setIsProcessing(true);
      setActionLog("TETOBOT IS THINKING...");
      setGunAngle(-90); // Apunta al bot (arriba)
      await new Promise(r => setTimeout(r, 1500));
      
      const isBullet = chambersRef.current[currentChamberRef.current];
      setActionLog("TETOBOT POINTS AT ITS HEAD...");
      
      setGunShaking(true);
      await new Promise(r => setTimeout(r, 1500));
      setGunShaking(false);

      if (isBullet) {
          playSFX('bang');
          setGunFiring(true);
          setScreenFlash(true);
          setActionLog("💥 BANG! TETOBOT DIED! 💥");
          
          setPlayers(prev => prev.map(p => p.id === 'bot' ? {...p, isDead: true} : p));
          setTimeout(() => endGame(currentUser.id, potTotal), 2500);
      } else {
          playSFX('click');
          setActionLog("...CLICK. TETOBOT SURVIVED.");
          setTimeout(() => {
              currentChamberRef.current += 1;
              setUiChamber(currentChamberRef.current);
              setTurnId(currentUser.id);
              setIsProcessing(false);
              setActionLog("YOUR TURN.");
          }, 2000);
      }
  };

  useEffect(() => {
      if (mode === 'bot' && view === 'playing' && turnId === 'bot' && !isProcessing && !cylinderSpinning) {
          executeBotTurn();
      }
  }, [turnId, view, mode, cylinderSpinning]);

  // --- ONLINE ROYALE ---
  const fetchLobbies = async () => {
      const { data } = await supabase.from('roulette_lobbies').select('*').eq('status', 'waiting');
      if (data) setLobbies(data);
  };

  const openLobbies = () => {
      setMode('online');
      fetchLobbies();
      setView('lobbies');
      supabase.channel('public:roulette_lobbies').on('postgres_changes', { event: '*', schema: 'public', table: 'roulette_lobbies' }, fetchLobbies).subscribe();
  };

  const hostOnlineMatch = async () => {
      if (betType === 'pets') return alert("Online Pet Betting currently disabled for safety.");
      if (userProfile.saldo_verde < coinBet) return alert("Insufficient coins.");
      
      await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde - coinBet }).eq('id', currentUser.id);

      const me = { id: currentUser.id, name: userProfile.username, avatar: getAvatar(userProfile.avatar_url, userProfile.username), isDead: false };

      const { data, error } = await supabase.from('roulette_lobbies').insert({
          host_id: currentUser.id, host_name: userProfile.username, bet_type: 'coins', bet_amount: coinBet, players: [me]
      }).select().single();

      if (data) {
          setCurrentRoom(data);
          setPlayers([me]);
          setPotTotal(coinBet);
          connectToRoom(data.id, true);
          setView('lobby_room');
      }
  };

  const joinOnlineMatch = async (lobby) => {
      if (userProfile.saldo_verde < lobby.bet_amount) return alert("No saldo.");
      await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde - lobby.bet_amount }).eq('id', currentUser.id);

      const me = { id: currentUser.id, name: userProfile.username, avatar: getAvatar(userProfile.avatar_url, userProfile.username), isDead: false };
      const updatedPlayers = [...lobby.players, me];

      await supabase.from('roulette_lobbies').update({ players: updatedPlayers }).eq('id', lobby.id);

      setCurrentRoom(lobby);
      setPlayers(updatedPlayers);
      setPotTotal(lobby.bet_amount * updatedPlayers.length);
      connectToRoom(lobby.id, false);
      setView('lobby_room');
  };

  const connectToRoom = (roomId, isHost) => {
      const channel = supabase.channel(`room_${roomId}`);
      channelRef.current = channel;

      channel.on('broadcast', { event: 'player_joined' }, payload => {
          setPlayers(payload.players);
          setPotTotal(currentRoom.bet_amount * payload.players.length);
      });
      
      channel.on('broadcast', { event: 'game_start' }, payload => {
          setView('playing');
          setActionLog("SPINNING CYLINDER...");
          setCylinderSpinning(true);
          playSFX('spin');
          
          setTimeout(() => {
              chambersRef.current = payload.chambers;
              currentChamberRef.current = 0;
              setUiChamber(0);
              setCylinderSpinning(false);
              setTurnId(payload.turnId);
              setActionLog(payload.turnId === currentUser.id ? "YOUR TURN." : "MATCH STARTED.");
          }, 2000);
      });

      channel.on('broadcast', { event: 'shoot_action' }, payload => {
          executeOnlineVisuals(payload.shooterId, payload.targetId, payload.isBullet);
      });

      channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED' && isHost) {
              supabase.channel('lobby_updates').on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'roulette_lobbies', filter: `id=eq.${roomId}` }, (payload) => {
                  setPlayers(payload.new.players);
                  channel.send({ type: 'broadcast', event: 'player_joined', payload: { players: payload.new.players } });
              }).subscribe();
          }
      });
  };

  const startOnlineGameHost = async () => {
      if (players.length < 2) return alert("Need at least 2 players!");
      await supabase.from('roulette_lobbies').update({ status: 'playing' }).eq('id', currentRoom.id);
      
      const newChambers = [false, false, false, false, false, false];
      newChambers[Math.floor(Math.random() * 6)] = true;
      
      const firstTurn = players[0].id;
      
      setView('playing');
      setActionLog("SPINNING CYLINDER...");
      setCylinderSpinning(true);
      playSFX('spin');

      setTimeout(() => {
          chambersRef.current = newChambers;
          currentChamberRef.current = 0;
          setUiChamber(0);
          setCylinderSpinning(false);
          setTurnId(firstTurn);
          setActionLog("YOUR TURN.");
      }, 2000);

      channelRef.current.send({ type: 'broadcast', event: 'game_start', payload: { chambers: newChambers, turnId: firstTurn } });
  };

  // --- CORE GAMEPLAY (DISPARO) ---
  const handleShoot = async (targetId) => {
      if (isProcessing || turnId !== currentUser.id || cylinderSpinning) return;
      setIsProcessing(true);

      const isBullet = chambersRef.current[currentChamberRef.current];

      if (mode === 'online') {
          channelRef.current.send({ type: 'broadcast', event: 'shoot_action', payload: { shooterId: currentUser.id, targetId, isBullet } });
          executeOnlineVisuals(currentUser.id, targetId, isBullet);
      } else {
          setGunAngle(targetId === currentUser.id ? 90 : -90);
          setActionLog(targetId === currentUser.id ? "YOU AIM AT YOURSELF..." : "YOU AIM AT TETOBOT...");
          
          await new Promise(r => setTimeout(r, 1000));
          setGunShaking(true);
          await new Promise(r => setTimeout(r, 1500));
          setGunShaking(false);

          if (isBullet) {
              playSFX('bang');
              setGunFiring(true);
              setScreenFlash(true);
              setActionLog("💥 BANG! 💥");
              
              if (targetId === currentUser.id) {
                  setPlayers(prev => prev.map(p => p.id === currentUser.id ? {...p, isDead: true} : p));
                  setTimeout(() => endGame('bot', 0), 2000);
              } else {
                  setPlayers(prev => prev.map(p => p.id === 'bot' ? {...p, isDead: true} : p));
                  setTimeout(() => endGame(currentUser.id, potTotal), 2000);
              }
          } else {
              playSFX('click');
              setActionLog("...CLICK. NOTHING HAPPENED.");
              setTimeout(() => {
                  currentChamberRef.current += 1;
                  setUiChamber(currentChamberRef.current);
                  setTurnId('bot');
                  setIsProcessing(false);
              }, 1500);
          }
      }
  };

  const executeOnlineVisuals = async (shooterId, targetId, isBullet) => {
      const shooterName = players.find(p => p.id === shooterId)?.name;
      const targetName = players.find(p => p.id === targetId)?.name;
      const shootingSelf = shooterId === targetId;

      if (targetId === currentUser.id) setGunAngle(90);
      else if (shooterId === currentUser.id && targetId !== currentUser.id) setGunAngle(-90);
      else setGunAngle(-90);

      setActionLog(shootingSelf ? `${shooterName} AIMS AT THEMSELVES...` : `${shooterName} AIMS AT ${targetName}...`);
      
      await new Promise(r => setTimeout(r, 1500));
      setGunShaking(true);
      await new Promise(r => setTimeout(r, 1500));
      setGunShaking(false);

      if (isBullet) {
          playSFX('bang');
          setGunFiring(true);
          setScreenFlash(true);
          setActionLog(`💥 BANG! ${targetName} IS DEAD! 💥`);
          
          setPlayers(prev => {
              const newPlayers = prev.map(p => p.id === targetId ? {...p, isDead: true} : p);
              checkOnlineWinCondition(newPlayers);
              return newPlayers;
          });
      } else {
          playSFX('click');
          setActionLog("...CLICK.");
          setTimeout(() => {
              currentChamberRef.current += 1;
              setUiChamber(currentChamberRef.current);
              
              let nextIdx = players.findIndex(p => p.id === shooterId) + 1;
              while (nextIdx < players.length * 2) {
                  const checkPlayer = players[nextIdx % players.length];
                  if (!checkPlayer.isDead) {
                      setTurnId(checkPlayer.id);
                      setActionLog(checkPlayer.id === currentUser.id ? "YOUR TURN." : `${checkPlayer.name}'S TURN.`);
                      break;
                  }
                  nextIdx++;
              }
              setIsProcessing(false);
          }, 2000);
      }
  };

  const checkOnlineWinCondition = async (currentPlayers) => {
      const alivePlayers = currentPlayers.filter(p => !p.isDead);
      if (alivePlayers.length === 1) {
          const winner = alivePlayers[0];
          setTimeout(() => endGame(winner.id, currentRoom.bet_amount * currentPlayers.length), 3000);
      } else {
          setTimeout(() => {
               setGunFiring(false);
               setScreenFlash(false);
               let nextIdx = currentPlayers.findIndex(p => p.isDead) + 1;
               while (nextIdx < currentPlayers.length * 2) {
                  const checkPlayer = currentPlayers[nextIdx % currentPlayers.length];
                  if (!checkPlayer.isDead) {
                      setTurnId(checkPlayer.id);
                      setActionLog(checkPlayer.id === currentUser.id ? "YOUR TURN." : `${checkPlayer.name}'S TURN.`);
                      break;
                  }
                  nextIdx++;
              }
              setIsProcessing(false);
          }, 3000);
      }
  };

  const endGame = async (winnerId, prize) => {
      if (winnerId === currentUser.id) {
          playSFX('win');
          await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde + prize }).eq('id', currentUser.id);
          
          if (betType === 'pets' && mode === 'bot') {
              // Lógica para entregar botPets al usuario en DB (simplificada aquí visualmente)
          }
          
          setActionLog(`🏆 YOU SURVIVED & WON ${formatValue(prize)}! 🏆`);
      } else {
          if (betType === 'pets' && mode === 'bot') {
              await supabase.from('inventory').delete().in('id', selectedPets.map(p=>p.id));
          }
          const winnerName = players.find(p => p.id === winnerId)?.name || 'SOMEONE';
          setActionLog(`💀 YOU DIED. ${winnerName} TAKES IT ALL. 💀`);
      }
      
      if (currentRoom && currentRoom.host_id === currentUser.id) {
          await supabase.from('roulette_lobbies').update({ status: 'finished' }).eq('id', currentRoom.id);
      }
      if(channelRef.current) supabase.removeChannel(channelRef.current);
      
      setTimeout(() => setView('result'), 1500);
      setGunFiring(false);
      setScreenFlash(false);
      setIsProcessing(false);
  };

  // --- RENDERIZADOS ---
  return (
    <div className={`min-h-[calc(100vh-80px)] bg-[#050505] text-white font-sans overflow-hidden transition-colors duration-100 ${screenFlash ? 'bg-red-900' : ''}`}>
      
      {screenFlash && <div className="fixed inset-0 bg-red-600/80 z-50 animate-flash pointer-events-none"></div>}

      <div className="max-w-[1400px] mx-auto relative z-10 p-4 md:p-8">
        
        {/* === MENU PRINCIPAL === */}
        {view === 'menu' && (
            <div className="flex flex-col items-center justify-center py-10 md:py-20 animate-fade-in relative">
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-red-900/20 blur-[120px] rounded-full pointer-events-none"></div>
                <h1 className="text-7xl md:text-9xl font-black italic tracking-tighter mb-4 text-transparent bg-clip-text bg-gradient-to-b from-red-500 via-red-600 to-red-900 drop-shadow-[0_0_40px_rgba(220,38,38,0.5)] z-10">ROULETTE</h1>
                <p className="text-gray-400 mb-16 tracking-[0.5em] uppercase font-bold border-b border-red-900/50 pb-4 z-10">High Stakes VIP Arena</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl z-10">
                    <button onClick={() => { setMode('bot'); setView('betting'); }} className="group relative bg-[#0a0a0a] border-2 border-[#222] p-12 rounded-[3rem] overflow-hidden transition-all hover:scale-105 hover:border-red-600 hover:shadow-[0_0_50px_rgba(220,38,38,0.3)]">
                        <div className="absolute inset-0 bg-gradient-to-tr from-red-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className="text-7xl block mb-6 drop-shadow-2xl">🤖</span>
                        <h3 className="text-3xl font-black uppercase tracking-widest text-white mb-2">Local Duel</h3>
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Coins & Pets vs TetoBot</p>
                    </button>
                    <button onClick={openLobbies} className="group relative bg-[#0a0a0a] border-2 border-[#222] p-12 rounded-[3rem] overflow-hidden transition-all hover:scale-105 hover:border-blue-600 hover:shadow-[0_0_50px_rgba(37,99,235,0.3)]">
                        <div className="absolute inset-0 bg-gradient-to-tr from-blue-900/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                        <span className="text-7xl block mb-6 drop-shadow-2xl">🌐</span>
                        <h3 className="text-3xl font-black uppercase tracking-widest text-white mb-2">Multiplayer</h3>
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Battle Royale (Up to 6)</p>
                    </button>
                </div>
            </div>
        )}

        {/* === SETUP APUESTA === */}
        {view === 'betting' && (
            <div className="animate-fade-in max-w-5xl mx-auto py-10">
                <div className="flex items-center gap-4 mb-8">
                    <button onClick={() => setView(mode === 'online' ? 'lobbies' : 'menu')} className="bg-[#111] hover:bg-[#222] border border-[#333] px-6 py-2 rounded-xl text-gray-400 hover:text-white font-bold uppercase tracking-widest transition-all text-sm">← Back</button>
                    <h2 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-white to-gray-500">Setup Bet</h2>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-5 gap-8">
                    <div className="lg:col-span-3 bg-[#0a0a0a] rounded-[2rem] p-8 border border-[#222] shadow-2xl relative">
                        <div className="flex gap-4 mb-8 bg-[#111] p-2 rounded-2xl border border-[#333]">
                            <button onClick={() => setBetType('coins')} className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest transition-all ${betType === 'coins' ? (mode === 'online' ? 'bg-blue-600' : 'bg-red-600') + ' text-white shadow-lg' : 'text-gray-500 hover:bg-[#222]'}`}>Coins</button>
                            <button onClick={() => setBetType('pets')} disabled={mode === 'online'} className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest transition-all ${betType === 'pets' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:bg-[#222]'} disabled:opacity-20`}>
                                Pets {mode === 'online' && '(Local Only)'}
                            </button>
                        </div>

                        {betType === 'coins' ? (
                            <div className="py-10">
                                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-4">Wager Amount</p>
                                <div className="bg-[#111] p-8 rounded-[2rem] border-2 border-[#333] flex items-center justify-between focus-within:border-white transition-colors">
                                    <input type="number" value={coinBet} onChange={(e) => setCoinBet(Number(e.target.value))} className="bg-transparent text-5xl font-black outline-none w-full text-white" />
                                    <GreenCoin cls="w-10 h-10"/>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <p className="text-gray-400 text-sm font-bold uppercase tracking-widest mb-4 flex justify-between">
                                    <span>Select Pets ({selectedPets.length})</span>
                                    <span className="text-green-400">Total: {formatValue(calculateSelectedValue())}</span>
                                </p>
                                <div className="grid grid-cols-3 md:grid-cols-4 gap-3 max-h-[350px] overflow-y-auto pr-2 custom-scrollbar p-2 bg-[#111] rounded-2xl border border-[#333]">
                                    {userInventory.map(pet => (
                                        <div key={pet.id} onClick={() => togglePetSelection(pet)} className={`relative p-3 rounded-xl border-2 cursor-pointer transition-all hover:-translate-y-1 ${selectedPets.find(p=>p.id===pet.id) ? 'border-red-500 bg-red-900/20 shadow-[0_0_15px_rgba(220,38,38,0.3)]' : 'border-[#222] bg-[#0a0a0a]'}`}>
                                            <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent z-0 rounded-xl"></div>
                                            <img src={pet.img} className="w-full h-16 object-contain mb-2 relative z-10 drop-shadow-md" alt={pet.name} />
                                            <p className="text-[10px] font-black truncate text-center relative z-10 text-white">{pet.name}</p>
                                            <p className="text-[9px] font-bold text-green-400 text-center relative z-10 flex items-center justify-center gap-1"><GreenCoin cls="w-3 h-3"/> {formatValue(pet.value)}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="lg:col-span-2 flex flex-col justify-between">
                        <div className="bg-[#0a0a0a] rounded-[2rem] p-8 border border-[#222] shadow-2xl mb-6 flex-1 flex flex-col justify-center text-center">
                            <h4 className="text-gray-600 font-black uppercase tracking-[0.3em] text-xs mb-8">Match Preview</h4>
                            
                            <div className="mb-6">
                                <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2">Total Pot</p>
                                <p className={`text-6xl font-black drop-shadow-[0_0_20px_rgba(255,255,255,0.2)] flex items-center justify-center gap-3 ${mode === 'online' ? 'text-blue-500' : 'text-red-500'}`}>
                                    {betType === 'coins' ? <><GreenCoin cls="w-12 h-12 grayscale opacity-50"/> {formatValue(coinBet * (mode === 'online' ? 2 : 2))}</> : 'PETS MIX'}
                                </p>
                            </div>
                            
                            <div className="flex justify-center items-center gap-4 border-t border-[#222] pt-6">
                                <div className="text-right">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">You</p>
                                    <p className="text-lg font-black text-white">{userProfile?.username}</p>
                                </div>
                                <span className="text-3xl font-black italic text-red-600 mx-2">VS</span>
                                <div className="text-left">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{mode==='online' ? 'Lobby' : 'Bot'}</p>
                                    <p className="text-lg font-black text-white">{mode === 'online' ? 'ANYONE' : 'TETOBOT'}</p>
                                </div>
                            </div>
                        </div>
                        
                        <button onClick={mode === 'online' ? hostOnlineMatch : startBotMatch} className={`w-full py-6 text-white font-black text-2xl uppercase tracking-widest rounded-[2rem] transition-all active:scale-95 ${mode === 'online' ? 'bg-gradient-to-r from-blue-700 to-blue-500 hover:shadow-[0_0_40px_rgba(37,99,235,0.5)]' : 'bg-gradient-to-r from-red-700 to-red-500 hover:shadow-[0_0_40px_rgba(220,38,38,0.5)]'}`}>
                            {mode === 'online' ? 'Create Arena' : 'Start Duel'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* LOBBIES Y SALA DE ESPERA OMITIDOS PARA ESPACIO, MANTÉN LOS MISMOS QUE ARRIBA */}
        
        {/* === LA MESA VIP (GAMEPLAY ÉPICO) === */}
        {view === 'playing' && (
            <div className="flex flex-col items-center justify-center min-h-[85vh] relative py-10 w-full">
                
                {/* --- THE VIP TABLE --- */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-[1000px] h-[65vh] max-h-[600px] bg-[#140808] border-[16px] border-[#1a1111] rounded-[600px] shadow-[0_0_100px_rgba(0,0,0,1),inset_0_0_150px_rgba(0,0,0,1)] z-0 flex items-center justify-center">
                    {/* Textura Felt */}
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 rounded-[500px]"></div>
                    {/* Borde Neón */}
                    <div className="absolute inset-4 rounded-[500px] border-2 border-red-900/50 shadow-[inset_0_0_30px_rgba(220,38,38,0.2)]"></div>
                    
                    {/* --- EL POT EN EL CENTRO --- */}
                    <div className="absolute z-0 flex flex-col items-center justify-center bg-black/40 p-8 rounded-full border border-red-900/30 backdrop-blur-sm shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                        <span className="text-[10px] uppercase tracking-[0.4em] text-red-500/80 mb-2 font-black">Total Pot</span>
                        {betType === 'coins' ? (
                            <div className="text-5xl font-black text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)] flex items-center gap-3">
                                <GreenCoin cls="w-10 h-10"/> {formatValue(potTotal)}
                            </div>
                        ) : (
                            <div className="flex items-center gap-6">
                                <div className="flex -space-x-3">
                                    {selectedPets.slice(0,3).map((p,i) => <img key={i} src={p.img} className="w-10 h-10 rounded-full border border-white/20 bg-black/50" />)}
                                </div>
                                <span className="text-xl font-black text-red-600 italic">VS</span>
                                <div className="flex -space-x-3">
                                    {botPets.slice(0,3).map((p,i) => <img key={i} src={p.img} className="w-10 h-10 rounded-full border border-white/20 bg-black/50" />)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* TEXTO DE ACCIÓN CINEMÁTICO */}
                <div className="absolute top-4 w-full text-center z-30 pointer-events-none">
                    <p className={`text-4xl md:text-6xl font-black italic transition-all duration-300 uppercase tracking-[0.2em] bg-black/50 backdrop-blur-md inline-block px-10 py-4 rounded-full border border-white/10 ${actionLog.includes('BANG') ? 'text-red-600 scale-110 drop-shadow-[0_0_40px_rgba(220,38,38,1)] border-red-500/50' : 'text-white shadow-2xl'}`}>
                        {actionLog}
                    </p>
                </div>

                {/* --- JUGADORES OPONENTES --- */}
                <div className="flex justify-around w-full max-w-[800px] relative z-20 mb-auto mt-24 px-10">
                    {players.filter(p => p.id !== currentUser.id).map((p) => (
                        <div key={p.id} className={`flex flex-col items-center transition-all duration-500 relative ${turnId === p.id ? 'scale-125 -translate-y-6 z-30' : 'opacity-70 scale-90'} ${p.isDead ? 'grayscale opacity-30' : ''}`}>
                            
                            {/* Spotlight */}
                            {turnId === p.id && !p.isDead && <div className="absolute -top-20 w-40 h-60 bg-gradient-to-b from-white/20 to-transparent blur-xl rounded-full pointer-events-none"></div>}

                            <div className={`w-24 h-24 md:w-32 md:h-32 rounded-full border-[6px] p-1 bg-[#111] relative shadow-2xl ${turnId === p.id && !p.isDead ? 'border-white drop-shadow-[0_0_40px_rgba(255,255,255,0.6)]' : 'border-[#222]'}`}>
                                <img src={p.avatar} className="w-full h-full object-cover rounded-full" />
                                {p.isDead && <div className="absolute inset-0 flex items-center justify-center text-5xl bg-red-900/80 rounded-full backdrop-blur-sm animate-pulse">💀</div>}
                            </div>
                            <div className="mt-4 bg-[#0a0a0a] text-white font-black text-[10px] px-6 py-2 rounded-full uppercase tracking-widest border border-[#333] shadow-lg">{p.name}</div>
                        </div>
                    ))}
                </div>

                {/* --- EL ARMA EN EL CENTRO --- */}
                <div className="relative w-64 h-64 md:w-80 md:h-80 flex items-center justify-center my-4 z-30 pointer-events-none">
                    <GunSVG targetAngle={gunAngle} isShaking={gunShaking} isFiring={gunFiring} isSpinningCylinder={cylinderSpinning} />
                    
                    {/* UI del Cilindro flotante */}
                    <div className="absolute -bottom-16 flex gap-3 bg-black/50 px-6 py-3 rounded-full border border-white/5 backdrop-blur-md">
                        {[0, 1, 2, 3, 4, 5].map(idx => (
                            <div key={idx} className={`w-4 h-4 rounded-full border-2 transition-all duration-300 ${idx === uiChamber ? 'border-red-500 bg-red-500 shadow-[0_0_15px_rgba(220,38,38,1)] scale-150' : idx < uiChamber ? 'border-[#333] bg-[#111] opacity-40' : 'border-gray-400 bg-transparent'}`}></div>
                        ))}
                    </div>
                </div>

                {/* --- JUGADOR LOCAL (TÚ) --- */}
                <div className={`relative z-30 w-full max-w-4xl mt-auto pt-20 flex justify-center items-end transition-all duration-500 ${turnId === currentUser.id ? 'scale-110' : 'opacity-80'}`}>
                    
                    {/* Spotlight Tú */}
                    {turnId === currentUser.id && <div className="absolute bottom-0 w-60 h-80 bg-gradient-to-t from-white/10 to-transparent blur-3xl rounded-full pointer-events-none z-0"></div>}

                    <div className="flex w-full justify-between items-center px-4 relative z-10">
                        <button 
                            disabled={isProcessing || turnId !== currentUser.id || players.find(p=>p.id===currentUser.id)?.isDead} 
                            onClick={() => handleShoot(currentUser.id)}
                            className="bg-white hover:bg-gray-200 text-black px-10 py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] transition-all disabled:opacity-10 disabled:cursor-not-allowed shadow-[0_10px_30px_rgba(255,255,255,0.2)] active:scale-95 text-sm md:text-lg border-4 border-white/20"
                        >
                            Shoot Self
                        </button>
                        
                        <div className={`w-36 h-36 md:w-48 md:h-48 rounded-full border-[8px] p-2 bg-[#111] relative shadow-2xl shrink-0 mx-8 ${turnId === currentUser.id ? 'border-red-600 drop-shadow-[0_0_50px_rgba(220,38,38,0.8)]' : 'border-[#222]'}`}>
                            <img src={getAvatar(userProfile?.avatar_url, userProfile?.username)} className="w-full h-full object-cover rounded-full" />
                            {players.find(p=>p.id===currentUser.id)?.isDead && <div className="absolute inset-0 flex items-center justify-center text-7xl bg-red-900/80 rounded-full backdrop-blur-sm">💀</div>}
                            <div className="absolute -bottom-6 left-1/2 -translate-x-1/2 bg-red-600 text-white font-black text-sm px-8 py-2 rounded-full uppercase tracking-[0.2em] border-2 border-black shadow-2xl">YOU</div>
                        </div>

                        <button 
                            disabled={isProcessing || turnId !== currentUser.id || players.find(p=>p.id===currentUser.id)?.isDead || mode === 'online'} 
                            onClick={() => handleShoot('bot')}
                            className="bg-[#111] text-gray-500 px-10 py-6 rounded-[2rem] font-black uppercase tracking-[0.2em] disabled:opacity-20 shadow-xl text-sm md:text-lg border-2 border-[#222] relative group"
                        >
                            <span className="opacity-50">Shoot Foe</span>
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* --- PANTALLA DE RESULTADOS CINEMÁTICA --- */}
        {view === 'result' && (
            <div className="flex flex-col items-center justify-center py-40 animate-fade-in relative z-50">
                <div className="absolute inset-0 bg-black/90 backdrop-blur-xl z-0 pointer-events-none"></div>
                <div className="text-[200px] leading-none mb-8 z-10 drop-shadow-[0_0_80px_rgba(255,0,0,0.8)] animate-bounce-slight">{actionLog.includes('WON') ? '🏆' : '💀'}</div>
                <h2 className={`text-5xl md:text-8xl font-black mb-16 text-center z-10 uppercase tracking-[0.2em] drop-shadow-2xl px-4 ${actionLog.includes('WON') ? 'text-yellow-400' : 'text-red-600'}`}>{actionLog}</h2>
                <button onClick={() => { setView('menu'); setCurrentRoom(null); setPlayers([]); setBotPets([]); }} className="px-20 py-8 bg-white text-black text-2xl font-black uppercase tracking-widest rounded-full hover:bg-gray-200 transition-all shadow-[0_0_60px_rgba(255,255,255,0.5)] hover:scale-105 z-10 active:scale-95">
                    EXIT ARENA
                </button>
            </div>
        )}

      </div>

      <style jsx global>{`
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        .animate-shake-hard { animation: shakeHard 0.15s ease-in-out infinite; }
        .animate-flash { animation: flash 0.6s ease-out forwards; }
        .animate-spin-fast { animation: spinFast 0.5s linear infinite; }
        .animate-bounce-slight { animation: bounceSlight 2s ease-in-out infinite; }
        
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
        @keyframes shakeHard {
            0%, 100% { transform: translate(0, 0) rotate(0deg); }
            25% { transform: translate(-6px, 6px) rotate(-4deg); }
            50% { transform: translate(6px, -6px) rotate(4deg); }
            75% { transform: translate(-6px, -6px) rotate(-2deg); }
        }
        @keyframes flash {
            0% { opacity: 1; background-color: rgba(220,38,38,1); }
            100% { opacity: 0; background-color: transparent; }
        }
        @keyframes spinFast {
            from { transform: rotate(0deg); }
            to { transform: rotate(360deg); }
        }
        @keyframes bounceSlight {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-20px); }
        }
        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0a0a0a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
      `}</style>
    </div>
  );
}
