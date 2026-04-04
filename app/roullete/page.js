"use client";
import { useState, useEffect, useRef, useMemo } from 'react';
import { supabase } from '@/utils/Supabase';
import PetCard from '@/components/PetCard';
import { showToast } from '@/components/EpicToasts';

// --- VISUAL COMPONENTS ---
const GreenCoin = ({cls="w-4 h-4 md:w-5 md:h-5"}) => <img src="/green-coin.png" className={`${cls} inline-block drop-shadow-[0_0_5px_rgba(34,197,94,0.8)]`} alt="G" onError={e=>e.target.style.display='none'}/>;

const formatValue = (val) => {
  if (val >= 1000000) return parseFloat((val / 1000000).toFixed(2)) + 'M';
  if (val >= 1000) return parseFloat((val / 1000).toFixed(2)) + 'K';
  return val?.toLocaleString() || '0';
};

const getAvatar = (url, name) => url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${name || 'player'}&backgroundColor=8b0000,000000`;

// Animated Revolver SVG
const GunSVG = ({ targetAngle, isShaking, isFiring, isSpinningCylinder }) => (
    <div className={`transition-all duration-500 ease-[cubic-bezier(0.34,1.56,0.64,1)] absolute inset-0 flex items-center justify-center ${isShaking ? 'animate-shake-hard' : ''}`} style={{ transform: `rotate(${targetAngle}deg)` }}>
        <div className={`relative ${isFiring ? 'scale-125 drop-shadow-[0_0_60px_rgba(255,0,0,1)]' : 'drop-shadow-[0_25px_25px_rgba(0,0,0,0.9)]'} transition-transform duration-100`}>
            <svg width="180" height="180" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg" style={{transform: "translateX(20px)"}}>
                <path d="M120 280 L120 400 Q120 420 140 420 L180 420 Q200 420 200 400 L200 280 Z" fill="#111" stroke="#000" strokeWidth="10"/>
                <path d="M130 290 L130 390 L190 390 L190 290 Z" fill="#222" />
                <path d="M120 280 L200 280 L250 240 L460 240 Q480 240 480 220 L480 180 Q480 160 460 160 L120 160 Z" fill="#333" stroke="#000" strokeWidth="8"/>
                <path d="M300 240 L300 260" stroke="#000" strokeWidth="8" />
                <g className={isSpinningCylinder ? "animate-spin-fast" : ""} style={{ transformOrigin: "280px 200px" }}>
                    <circle cx="280" cy="200" r="45" fill="#1a1a1a" stroke="#000" strokeWidth="6"/>
                    <circle cx="280" cy="200" r="12" fill="#444" />
                    <circle cx="250" cy="200" r="10" fill="#000" className="shadow-inner"/>
                    <circle cx="310" cy="200" r="10" fill="#000" />
                    <circle cx="280" cy="170" r="10" fill="#000" />
                    <circle cx="280" cy="230" r="10" fill="#000" />
                </g>
                <path d="M460 180 L480 180" stroke="#ff3333" strokeWidth="16" strokeLinecap="round" className={isFiring ? "animate-pulse" : "hidden"}/>
                {isFiring && <circle cx="520" cy="200" r="70" fill="url(#fire)" />}
                <defs>
                    <radialGradient id="fire" cx="50%" cy="50%" r="50%">
                        <stop offset="0%" stopColor="#fff" />
                        <stop offset="20%" stopColor="#fbd38d" />
                        <stop offset="60%" stopColor="#e53e3e" />
                        <stop offset="100%" stopColor="#e53e3e" stopOpacity="0" />
                    </radialGradient>
                </defs>
            </svg>
        </div>
    </div>
);

export default function RussianRoulettePage() {
  const [currentUser, setCurrentUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [userInventory, setUserInventory] = useState([]);
  
  const [view, setView] = useState('menu'); 
  const [mode, setMode] = useState('bot'); 
  
  const [betType, setBetType] = useState('coins');
  const [coinBet, setCoinBet] = useState(10);
  const [selectedPets, setSelectedPets] = useState([]);
  const [botPets, setBotPets] = useState([]); 
  
  const [lobbies, setLobbies] = useState([]);
  const [currentRoom, setCurrentRoom] = useState(null);
  const [players, setPlayers] = useState([]); 

  const [turnId, setTurnId] = useState(null); 
  const [actionLog, setActionLog] = useState("WAITING...");
  const [isProcessing, setIsProcessing] = useState(false);
  const [potTotal, setPotTotal] = useState(0);
  const [winData, setWinData] = useState(null); 
  
  // VISUAL EFFECTS
  const [gunAngle, setGunAngle] = useState(-90);
  const [gunShaking, setGunShaking] = useState(false);
  const [gunFiring, setGunFiring] = useState(false);
  const [screenFlash, setScreenFlash] = useState(false);
  const [cylinderSpinning, setCylinderSpinning] = useState(false);

  const chambersRef = useRef([]);
  const currentChamberRef = useRef(0);
  const lastPayloadTsRef = useRef(0); 
  const activeChannelRef = useRef(null); 
  const [uiChamber, setUiChamber] = useState(0); 

  // FIX 1: Extracción Segura del Inventario
  const fetchUserInventory = async (userId) => {
      const { data: inv, error } = await supabase.from('inventory').select(`id, item_id, items (*)`).eq('user_id', userId);
      
      if (error) console.error("Error cargando inventario:", error);
      
      if (inv) {
          setUserInventory(inv.map(i => {
              // Supabase puede devolver items como arreglo en vez de objeto a veces
              const itemData = Array.isArray(i.items) ? i.items[0] : i.items;
              if(!itemData) return null;
              
              return { 
                  id: i.id, 
                  item_id: i.item_id,
                  name: itemData.name, 
                  value: itemData.value || 0, 
                  // FIX ICONOS: Fallback en cascada si no existe image_url
                  image_url: itemData.image_url || itemData.image || itemData.img || '/file.svg', 
                  color: itemData.color,
                  is_shiny: itemData.is_shiny,
                  is_mythic: itemData.is_mythic
              }
          }).filter(Boolean)); // Elimina nulos por si alguna pet viene rota
      }
  };

  useEffect(() => {
    const init = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setCurrentUser(user);
        const { data: profile } = await supabase.from('profiles').select('*').eq('id', user.id).single();
        setUserProfile(profile);
        await fetchUserInventory(user.id);
      }
    };
    init();

    return () => cleanupChannel(); 
  }, []);

  const unlockAudio = () => {
      ['spin', 'click', 'bang', 'win'].forEach(id => {
          const el = document.getElementById(`sfx-${id}`);
          if (el && el.paused) { el.volume = 0; el.play().then(() => { el.pause(); el.currentTime = 0; el.volume = id === 'bang' ? 1 : 0.8; }).catch(()=>{}); }
      });
  };

  const playSFX = (type) => {
      const audioEl = document.getElementById(`sfx-${type}`);
      if (audioEl) {
          audioEl.currentTime = 0;
          audioEl.play().catch(() => {});
      }
  };

  const togglePetSelection = (pet) => {
      if (selectedPets.find(p => p.id === pet.id)) setSelectedPets(selectedPets.filter(p => p.id !== pet.id));
      else setSelectedPets([...selectedPets, pet]);
  };
  
  const calculateSelectedValue = () => selectedPets.reduce((sum, p) => sum + p.value, 0);

  const getCircleMath = (index, total) => {
      const startAngle = Math.PI / 2; 
      const angleStep = (2 * Math.PI) / total;
      const angle = startAngle + (index * angleStep);
      
      const rx = 40; const ry = 35; 
      const left = 50 + Math.cos(angle) * rx;
      const top = 50 + Math.sin(angle) * ry;
      
      const gunDegrees = angle * (180 / Math.PI); 
      return { left: `${left}%`, top: `${top}%`, gunDegrees };
  };

  const visualCirclePlayers = useMemo(() => {
      if (players.length === 0) return [];
      let mapped = [...players];
      const myIdx = mapped.findIndex(p => p.id === currentUser?.id);
      if (myIdx > 0) {
          const me = mapped.splice(myIdx, 1)[0];
          mapped.unshift(me);
      }
      return mapped.map((p, idx) => {
          const math = getCircleMath(idx, mapped.length);
          return { ...p, visualLeft: math.left, visualTop: math.top, gunDegrees: math.gunDegrees };
      });
  }, [players, currentUser]);


  const startBotMatch = async () => {
      unlockAudio();
      const isCoin = betType === 'coins';
      const myBetVal = isCoin ? coinBet : calculateSelectedValue();
      
      if (isCoin && userProfile.saldo_verde < myBetVal) return showToast("Saldo insuficiente!", "error");
      if (!isCoin && selectedPets.length === 0) return showToast("Selecciona al menos una mascota!", "error");
      
      if (isCoin) {
          await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde - myBetVal }).eq('id', currentUser.id);
          setUserProfile(prev => ({...prev, saldo_verde: prev.saldo_verde - myBetVal}));
      } else {
          await supabase.from('inventory').delete().in('id', selectedPets.map(p => p.id));
          await fetchUserInventory(currentUser.id);
      }
      
      if (!isCoin) {
          const { data: allItems } = await supabase.from('items').select('*').gt('value', 0);
          let tetoPets = []; let currentVal = 0;
          if (allItems) {
              while (currentVal < myBetVal && tetoPets.length < 4) {
                  const p = allItems[Math.floor(Math.random() * allItems.length)];
                  tetoPets.push({...p, item_id: p.id}); currentVal += p.value;
              }
          }
          setBotPets(tetoPets);
      }
      
      setPotTotal(myBetVal * 2);
      
      // FIX ICONOS: Bot Avatar Fallback
      const botPlayer = { id: 'bot', name: 'TetoBot', avatar: 'https://api.dicebear.com/7.x/bottts/svg?seed=TetoBot&backgroundColor=8b0000', isDead: false };
      const mePlayer = { id: currentUser.id, name: userProfile.username, avatar: getAvatar(userProfile.avatar_url, userProfile.username), isDead: false };
      
      setPlayers([mePlayer, botPlayer]);
      setTurnId(currentUser.id);
      
      setView('playing');
      setActionLog("LOADING CYLINDER...");
      setGunAngle(-90);
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
      
      const botVisual = visualCirclePlayers.find(p => p.id === 'bot');
      setGunAngle(botVisual.gunDegrees); 
      
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
          setActionLog("...CLICK.");
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


  const cleanupChannel = () => {
      if (activeChannelRef.current) {
          supabase.removeChannel(activeChannelRef.current);
          activeChannelRef.current = null;
      }
  };

  const fetchLobbies = async () => {
      const { data } = await supabase.from('roulette_lobbies').select('*').eq('status', 'waiting');
      if (data) setLobbies(data);
  };

  const openLobbies = () => {
      setMode('online');
      fetchLobbies();
      setView('lobbies');
      
      cleanupChannel(); 
      const channel = supabase.channel('public:roulette_lobbies')
          .on('postgres_changes', { event: '*', schema: 'public', table: 'roulette_lobbies' }, fetchLobbies)
          .subscribe();
      activeChannelRef.current = channel;
  };

  // FIX 2: EVITAR EL ROBO (NO COBRAR HASTA CONFIRMAR LA BASE DE DATOS)
  const hostOnlineMatch = async () => {
      unlockAudio();
      const isCoins = betType === 'coins';
      const myBetVal = isCoins ? coinBet : calculateSelectedValue();

      if (isCoins && userProfile.saldo_verde < myBetVal) return showToast("Saldo Insuficiente.", "error");
      if (!isCoins && selectedPets.length === 0) return showToast("Selecciona mascotas para crear la mesa.", "error");
      
      const me = { id: currentUser.id, name: userProfile.username, avatar: getAvatar(userProfile.avatar_url, userProfile.username), isDead: false };

      // 1. INTENTAR CREAR LA SALA PRIMERO
      const { data, error } = await supabase.from('roulette_lobbies').insert({
          host_id: currentUser.id, 
          host_name: userProfile.username, 
          bet_type: betType, 
          bet_amount: myBetVal, 
          players: [me],
          pool_items: !isCoins ? selectedPets : [],
          status: 'waiting' // Asegurar el status para evitar bugs
      }).select().single();

      if (error || !data) {
          console.error("Lobby Error:", error);
          return showToast("Error al crear la partida en los servidores.", "error");
      }

      // 2. SI LA SALA SE CREÓ BIEN, AHORA SÍ COBRAMOS
      if (isCoins) {
          await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde - myBetVal }).eq('id', currentUser.id);
          setUserProfile(prev => ({...prev, saldo_verde: prev.saldo_verde - myBetVal}));
      } else {
          await supabase.from('inventory').delete().in('id', selectedPets.map(p => p.id));
          await fetchUserInventory(currentUser.id);
      }

      // 3. CONTINUAR CON EL JUEGO
      setCurrentRoom(data);
      setPlayers([me]);
      setPotTotal(myBetVal);
      connectToRoom(data.id);
      setView('playing'); 
      setActionLog("WAITING FOR PLAYERS...");
  };

  // FIX 3: MISMO BLINDAJE PARA JOIN MATCH
  const joinOnlineMatch = async (lobby) => {
      unlockAudio();
      const isCoins = lobby.bet_type === 'coins';
      const myBetVal = isCoins ? lobby.bet_amount : calculateSelectedValue();

      if (isCoins && userProfile.saldo_verde < myBetVal) return showToast("Saldo Insuficiente.", "error");
      
      if (!isCoins) {
          const diff = Math.abs(myBetVal - lobby.bet_amount);
          const maxDiff = lobby.bet_amount * 0.02;
          if (diff > maxDiff) {
              return showToast("El valor de tus mascotas debe estar a un margen de 2% del Host!", "error");
          }
      }

      const me = { id: currentUser.id, name: userProfile.username, avatar: getAvatar(userProfile.avatar_url, userProfile.username), isDead: false };
      const updatedPlayers = [...lobby.players, me];
      const updatedPool = !isCoins ? [...lobby.pool_items, ...selectedPets] : [];
      
      const joinPayload = { event: 'player_joined', ts: Date.now() };

      // 1. INTENTAR UNIRSE PRIMERO A LA DB
      const { error } = await supabase.from('roulette_lobbies').update({ 
          players: updatedPlayers, 
          action_payload: joinPayload,
          pool_items: updatedPool 
      }).eq('id', lobby.id);

      if (error) return showToast("La sala ya no está disponible o hubo un error.", "error");

      // 2. SI TODO SALIÓ BIEN, COBRAMOS
      if (isCoins) {
          await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde - myBetVal }).eq('id', currentUser.id);
          setUserProfile(prev => ({...prev, saldo_verde: prev.saldo_verde - myBetVal}));
      } else {
          await supabase.from('inventory').delete().in('id', selectedPets.map(p => p.id));
          await fetchUserInventory(currentUser.id);
      }

      setCurrentRoom(lobby);
      setPlayers(updatedPlayers);
      setPotTotal(lobby.bet_amount * updatedPlayers.length);
      connectToRoom(lobby.id);
      setView('playing');
      setActionLog("WAITING FOR HOST TO START...");
  };

  const connectToRoom = (roomId) => {
      cleanupChannel(); 

      const channel = supabase.channel(`room_${roomId}_updates`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'roulette_lobbies', filter: `id=eq.${roomId}` }, (payload) => {
          const newRow = payload.new;
          setCurrentRoom(newRow); 
          setPotTotal(newRow.bet_amount * newRow.players.length);

          const action = newRow.action_payload;
          
          if (action?.event !== 'shoot_action') {
              setPlayers(newRow.players);
          }

          if (action && action.ts !== lastPayloadTsRef.current) {
              lastPayloadTsRef.current = action.ts;

              if (action.event === 'player_joined') {
                  playSFX('click');
              } else if (action.event === 'game_start') {
                  setActionLog("SPINNING CYLINDER...");
                  setCylinderSpinning(true);
                  playSFX('spin');
                  setTimeout(() => {
                      chambersRef.current = action.chambers;
                      currentChamberRef.current = 0;
                      setUiChamber(0);
                      setCylinderSpinning(false);
                      setTurnId(action.turnId);
                      setActionLog(action.turnId === currentUser.id ? "YOUR TURN." : "MATCH STARTED.");
                  }, 2000);
              } else if (action.event === 'shoot_action') {
                  executeOnlineVisuals(action, newRow); 
              } else if (action.event === 'reload_cylinder') {
                  chambersRef.current = action.chambers;
                  currentChamberRef.current = 0;
                  setUiChamber(0);
                  setActionLog("RELOADING...");
                  setCylinderSpinning(true);
                  playSFX('spin');
                  setTimeout(() => {
                      setCylinderSpinning(false);
                      setTurnId(action.turnId);
                      setActionLog(action.turnId === currentUser.id ? "YOUR TURN." : "CONTINUING.");
                      setIsProcessing(false);
                  }, 2000);
              }
          }
      }).subscribe();

      activeChannelRef.current = channel;
  };

  const startOnlineGameHost = async () => {
      if (players.length < 2) return showToast("Need at least 2 players to start!", "error");
      
      const newChambers = [false, false, false, false, false, false];
      newChambers[Math.floor(Math.random() * 6)] = true;
      const firstTurn = players[0].id;
      
      const startPayload = { event: 'game_start', chambers: newChambers, turnId: firstTurn, ts: Date.now() };
      await supabase.from('roulette_lobbies').update({ status: 'playing', action_payload: startPayload }).eq('id', currentRoom.id);
  };


  const handleShoot = async (targetId) => {
      if (isProcessing || turnId !== currentUser.id || cylinderSpinning) return;
      setIsProcessing(true);

      const isBullet = chambersRef.current[currentChamberRef.current];

      if (mode === 'online') {
          const newPlayers = players.map(p => p.id === targetId && isBullet ? {...p, isDead: true} : p);
          const shootPayload = { event: 'shoot_action', shooterId: currentUser.id, targetId, isBullet, ts: Date.now() };
          await supabase.from('roulette_lobbies').update({ action_payload: shootPayload, players: newPlayers }).eq('id', currentRoom.id);
      } else {
          const targetVisual = visualCirclePlayers.find(p => p.id === targetId);
          setGunAngle(targetVisual.gunDegrees); 
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
              
              const isMeDead = targetId === currentUser.id;
              setPlayers(prev => prev.map(p => p.id === targetId ? {...p, isDead: true} : p));
              setTimeout(() => endGame(isMeDead ? 'bot' : currentUser.id, isMeDead ? 0 : potTotal), 2000);
          } else {
              playSFX('click');
              setActionLog("...CLICK.");
              setTimeout(() => {
                  currentChamberRef.current += 1;
                  setUiChamber(currentChamberRef.current);
                  setTurnId('bot');
                  setIsProcessing(false);
              }, 1500);
          }
      }
  };

  const executeOnlineVisuals = async (action, newRow) => {
      const currentDbPlayers = newRow.players;
      const shooterName = currentDbPlayers.find(p => p.id === action.shooterId)?.name;
      
      let mapped = [...currentDbPlayers];
      const myIdx = mapped.findIndex(p => p.id === currentUser?.id);
      if (myIdx > 0) {
          const me = mapped.splice(myIdx, 1)[0];
          mapped.unshift(me);
      }
      const targetIdx = mapped.findIndex(p => p.id === action.targetId);
      const math = getCircleMath(targetIdx, mapped.length);

      setGunAngle(math.gunDegrees);
      setActionLog(action.shooterId === action.targetId ? `${shooterName} AIMS AT THEMSELVES...` : `${shooterName} AIMS AT TARGET...`);
      
      await new Promise(r => setTimeout(r, 1500));
      setGunShaking(true);
      await new Promise(r => setTimeout(r, 1500));
      setGunShaking(false);

      if (action.isBullet) {
          playSFX('bang');
          setGunFiring(true);
          setScreenFlash(true);
          setActionLog(`💥 BANG! 💥`);
          
          setPlayers(currentDbPlayers);

          setTimeout(() => {
              checkOnlineWinCondition(currentDbPlayers, action.targetId, newRow);
          }, 1000);
      } else {
          playSFX('click');
          setActionLog("...CLICK.");
          setPlayers(currentDbPlayers); 

          setTimeout(() => {
              currentChamberRef.current += 1;
              setUiChamber(currentChamberRef.current);
              
              let nextIdx = currentDbPlayers.findIndex(p => p.id === action.shooterId) + 1;
              let nextTurnId = null;
              while (nextIdx < currentDbPlayers.length * 2) {
                  const checkPlayer = currentDbPlayers[nextIdx % currentDbPlayers.length];
                  if (!checkPlayer.isDead) {
                      nextTurnId = checkPlayer.id;
                      break;
                  }
                  nextIdx++;
              }
              
              setTurnId(nextTurnId);
              const nextPlayerInfo = currentDbPlayers.find(p => p.id === nextTurnId);
              setActionLog(nextTurnId === currentUser.id ? "YOUR TURN." : `${nextPlayerInfo?.name || 'NEXT'}'S TURN.`);
              setIsProcessing(false);
          }, 2000);
      }
  };

  const checkOnlineWinCondition = async (currentPlayers, deadPlayerId, newRow) => {
      const alivePlayers = currentPlayers.filter(p => !p.isDead);
      
      if (alivePlayers.length === 1) {
          setTimeout(() => endGame(alivePlayers[0].id, newRow.bet_amount * currentPlayers.length, newRow), 3000);
      } else {
          setTimeout(async () => {
               setGunFiring(false);
               setScreenFlash(false);
               
               let nextIdx = currentPlayers.findIndex(p => p.id === deadPlayerId) + 1;
               let nextTurnId = null;
               while (nextIdx < currentPlayers.length * 2) {
                  const checkPlayer = currentPlayers[nextIdx % currentPlayers.length];
                  if (!checkPlayer.isDead) {
                      nextTurnId = checkPlayer.id;
                      break;
                  }
                  nextIdx++;
               }

               if (newRow.host_id === currentUser.id) {
                   const newChambers = [false, false, false, false, false, false];
                   newChambers[Math.floor(Math.random() * 6)] = true;
                   
                   const reloadPayload = { event: 'reload_cylinder', chambers: newChambers, turnId: nextTurnId, ts: Date.now() };
                   await supabase.from('roulette_lobbies').update({ action_payload: reloadPayload }).eq('id', newRow.id);
               }
          }, 3000);
      }
  };

  const endGame = async (winnerId, prize, roomState = currentRoom) => {
      if (winnerId === currentUser.id) {
          playSFX('win');
          let wonItemsList = [];
          
          if (betType === 'coins') {
              await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde + prize }).eq('id', currentUser.id);
              setUserProfile(prev => ({...prev, saldo_verde: prev.saldo_verde + prize}));
          } else {
              const allBotsPets = mode === 'bot' ? botPets : [];
              const allLobbyPets = roomState ? roomState.pool_items : [];
              wonItemsList = mode === 'bot' ? [...selectedPets, ...allBotsPets] : allLobbyPets;
              
              const insertPayload = wonItemsList.map(p => ({ user_id: currentUser.id, item_id: p.item_id || p.id }));
              await supabase.from('inventory').insert(insertPayload);
              await fetchUserInventory(currentUser.id);
          }
          
          setWinData({ prizeType: betType, amount: prize, items: wonItemsList });
          setActionLog(`🏆 YOU WON ${betType === 'coins' ? formatValue(prize) : 'EPIC LOOT'}! 🏆`);
      } else {
          const currentPlayersList = roomState?.players || players;
          const winnerName = currentPlayersList.find(p => p.id === winnerId)?.name || 'SOMEONE';
          setActionLog(`💀 ${winnerName} TAKES IT ALL. 💀`);
      }
      
      if (roomState && roomState.host_id === currentUser.id) {
          await supabase.from('roulette_lobbies').update({ status: 'finished' }).eq('id', roomState.id);
      }
      
      setTimeout(() => {
          setView('result');
          cleanupChannel();
      }, 2500);
      
      setGunFiring(false);
      setScreenFlash(false);
      setIsProcessing(false);
  };

  // FIX 4: DESTRUCTOR DE GHOST MATCHES Y REEMBOLSOS DE HUIDA
  const handleLeaveMatch = async () => {
      if (currentRoom && currentRoom.status === 'waiting') {
          if (currentRoom.host_id === currentUser.id) {
              // El Host destruye la sala y recibe refund completo
              await supabase.from('roulette_lobbies').delete().eq('id', currentRoom.id);
              await processRefund();
          } else {
              // El Guest abandona, se saca de la lista y recibe refund
              const newPlayers = currentRoom.players.filter(p => p.id !== currentUser.id);
              await supabase.from('roulette_lobbies').update({ players: newPlayers }).eq('id', currentRoom.id);
              await processRefund();
          }
      }
      leaveToMenu();
  };

  const processRefund = async () => {
      if (betType === 'coins') {
          const refundAmt = currentRoom ? currentRoom.bet_amount : coinBet;
          await supabase.from('profiles').update({ saldo_verde: userProfile.saldo_verde + refundAmt }).eq('id', currentUser.id);
          setUserProfile(prev => ({...prev, saldo_verde: prev.saldo_verde + refundAmt}));
      } else {
          // Devolver Pets al inventario local
          const insertPayload = selectedPets.map(p => ({ user_id: currentUser.id, item_id: p.item_id || p.id }));
          await supabase.from('inventory').insert(insertPayload);
          await fetchUserInventory(currentUser.id);
      }
      showToast("Apuesta reembolsada por abandonar.", "info");
  };

  const leaveToMenu = () => {
      cleanupChannel();
      setView('menu'); 
      setCurrentRoom(null); 
      setPlayers([]); 
      setSelectedPets([]); 
      setWinData(null);
  };

  return (
    <div className={`min-h-[calc(100vh-80px)] bg-[#050505] text-white font-sans overflow-hidden transition-colors duration-100 ${screenFlash ? 'bg-red-900' : ''}`}>
      
      {/* PRELOADED AUDIO */}
      <audio id="sfx-spin" src="/sounds/spin.mp3" preload="auto" />
      <audio id="sfx-click" src="/sounds/click.mp3" preload="auto" />
      <audio id="sfx-bang" src="/sounds/bang.mp3" preload="auto" />
      <audio id="sfx-win" src="/sounds/win.mp3" preload="auto" />

      {screenFlash && <div className="fixed inset-0 bg-red-600/80 z-50 animate-flash pointer-events-none"></div>}

      <div className="max-w-[1400px] mx-auto relative z-10 p-4 flex flex-col justify-center min-h-[calc(100vh-100px)]">
        
        {/* === MENU === */}
        {view === 'menu' && (
            <div className="flex flex-col items-center justify-center animate-fade-in relative py-20">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-red-900/10 blur-[100px] rounded-full pointer-events-none"></div>
                <h1 className="text-7xl md:text-9xl font-black italic tracking-tighter mb-2 text-transparent bg-clip-text bg-gradient-to-b from-red-500 to-red-800 drop-shadow-[0_0_50px_rgba(220,38,38,0.4)] z-10">ROULETTE</h1>
                <p className="text-gray-400 mb-16 tracking-[0.5em] uppercase font-bold border-b border-red-900/50 pb-4 z-10">High Stakes Survival</p>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl z-10">
                    <button onClick={() => { setMode('bot'); setView('betting'); unlockAudio(); }} className="group relative bg-[#0a0a0a] border border-[#222] p-12 rounded-[2rem] transition-all hover:scale-105 hover:border-red-600 shadow-2xl flex flex-col items-center">
                        <span className="text-7xl mb-4 group-hover:scale-125 transition-transform drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">🤖</span>
                        <h3 className="text-3xl font-black uppercase tracking-widest text-white mb-2">Local Duel</h3>
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Coins & Pets vs Bot</p>
                    </button>
                    <button onClick={() => { openLobbies(); unlockAudio(); }} className="group relative bg-[#0a0a0a] border border-[#222] p-12 rounded-[2rem] transition-all hover:scale-105 hover:border-blue-600 shadow-2xl flex flex-col items-center">
                        <span className="text-7xl mb-4 group-hover:scale-125 transition-transform drop-shadow-[0_0_15px_rgba(255,255,255,0.2)]">🌐</span>
                        <h3 className="text-3xl font-black uppercase tracking-widest text-white mb-2">Online Arena</h3>
                        <p className="text-gray-500 font-bold uppercase tracking-widest text-xs">Multiplayer Battle Royale</p>
                    </button>
                </div>
            </div>
        )}

        {/* === LOBBIES === */}
        {view === 'lobbies' && (
            <div className="animate-fade-in max-w-5xl mx-auto w-full">
                <div className="flex justify-between items-center mb-8 bg-[#0a0a0a] p-6 rounded-[2rem] border border-[#222] shadow-xl">
                    <button onClick={leaveToMenu} className="text-gray-500 hover:text-white font-black tracking-widest uppercase text-sm">← Back</button>
                    <h2 className="text-3xl font-black uppercase tracking-widest text-blue-500">Public Tables</h2>
                    <button onClick={() => setView('betting')} className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-4 rounded-xl font-black uppercase tracking-widest shadow-lg transition-all active:scale-95">Host Match</button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {lobbies.length === 0 ? (
                        <div className="col-span-full text-center text-gray-600 py-32 font-black uppercase tracking-widest text-2xl border-2 border-dashed border-[#222] rounded-[2rem]">
                            No active tables. Host one!
                        </div>
                    ) : lobbies.map(l => (
                        <div key={l.id} className="bg-[#111] border border-[#333] p-8 rounded-[2rem] flex flex-col hover:border-blue-500 transition-colors group relative shadow-2xl">
                            <div className="absolute top-0 right-0 bg-blue-600/20 text-blue-400 font-black text-[10px] px-6 py-2 rounded-bl-2xl uppercase tracking-widest">Lobby Open</div>
                            <div className="flex items-center gap-6 mb-8">
                                <img src={getAvatar(null, l.host_name)} className="w-20 h-20 rounded-full border-4 border-[#222] object-cover" />
                                <div>
                                    <p className="font-black text-2xl tracking-wider text-white truncate max-w-[200px]">{l.host_name}'s Table</p>
                                    <p className="text-sm text-gray-500 uppercase font-black tracking-widest mt-1">{l.players?.length || 1} / 6 Players</p>
                                </div>
                            </div>
                            <div className="flex justify-between items-end border-t border-[#222] pt-6 mt-auto">
                                <div>
                                    <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Entry Fee {l.bet_type === 'pets' ? '(2% Diff Limit)' : ''}</p>
                                    <p className={`font-black text-3xl flex items-center gap-2 ${l.bet_type === 'coins' ? 'text-green-400' : 'text-red-500'}`}>
                                        {l.bet_type === 'coins' ? <GreenCoin cls="w-8 h-8"/> : '🐾'} {formatValue(l.bet_amount)}
                                    </p>
                                </div>
                                <button onClick={() => joinOnlineMatch(l)} disabled={l.players?.length >= 6} className="bg-white text-black hover:bg-blue-500 hover:text-white px-10 py-4 rounded-xl font-black uppercase transition-all disabled:opacity-20 active:scale-95">Join</button>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        )}

        {/* === SETUP BET === */}
        {view === 'betting' && (
            <div className="animate-fade-in max-w-5xl mx-auto w-full py-10">
                <div className="flex items-center justify-between mb-8">
                    <button onClick={leaveToMenu} className="bg-[#111] border border-[#333] px-6 py-3 rounded-xl text-gray-400 hover:text-white font-black uppercase tracking-widest transition-all">← Back</button>
                    <h2 className="text-4xl font-black uppercase tracking-widest">Set Wager</h2>
                    <div className="w-24"></div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                    <div className="lg:col-span-2 bg-[#0a0a0a] rounded-[2rem] p-8 border border-[#222] shadow-2xl">
                        <div className="flex gap-4 mb-8 bg-[#111] p-2 rounded-2xl border border-[#333]">
                            <button onClick={() => setBetType('coins')} className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest transition-all ${betType === 'coins' ? (mode === 'online' ? 'bg-blue-600' : 'bg-red-600') + ' text-white shadow-lg' : 'text-gray-500 hover:bg-[#222]'}`}>Coins</button>
                            <button onClick={() => setBetType('pets')} className={`flex-1 py-4 rounded-xl font-black uppercase tracking-widest transition-all ${betType === 'pets' ? 'bg-red-600 text-white shadow-lg' : 'text-gray-500 hover:bg-[#222]'}`}>Pets</button>
                        </div>

                        {betType === 'coins' ? (
                            <div className="py-10">
                                <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-4 flex justify-between">
                                  <span>Wager Amount</span>
                                  <span className="text-[#22c55e]">Balance: {formatValue(userProfile?.saldo_verde || 0)}</span>
                                </p>
                                <div className="bg-[#111] p-8 rounded-[2rem] border-2 border-[#333] flex items-center justify-between focus-within:border-white transition-colors">
                                    <input type="number" value={coinBet} onChange={(e) => setCoinBet(Number(e.target.value))} className="bg-transparent text-5xl font-black outline-none w-full text-white" />
                                    <GreenCoin cls="w-12 h-12"/>
                                </div>
                            </div>
                        ) : (
                            <div>
                                <p className="text-gray-400 text-xs font-black uppercase tracking-widest mb-4 flex justify-between"><span>Inventory ({selectedPets.length})</span> <span className="text-green-400">Value: {formatValue(calculateSelectedValue())}</span></p>
                                <div className="grid grid-cols-3 md:grid-cols-4 gap-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar p-4 bg-[#111] rounded-2xl border border-[#333]">
                                    {userInventory.map(pet => (
                                        <div key={pet.id} onClick={() => togglePetSelection(pet)} className={`relative transition-all cursor-pointer ${selectedPets.find(p=>p.id===pet.id) ? 'scale-105 drop-shadow-[0_0_15px_rgba(220,38,38,0.8)] border-2 border-red-500 rounded-xl z-10' : 'hover:-translate-y-1'}`}>
                                            <PetCard pet={pet} />
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-[#0a0a0a] rounded-[2rem] p-8 border border-[#222] shadow-2xl flex flex-col justify-between">
                        <div>
                            <h4 className="text-gray-600 font-black uppercase tracking-[0.3em] text-xs mb-8 text-center border-b border-[#222] pb-4">Match Preview</h4>
                            <p className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-2 text-center">Total Pot</p>
                            <div className={`text-5xl font-black drop-shadow-xl flex flex-col items-center gap-3 text-center mb-10 ${mode === 'online' ? 'text-blue-500' : 'text-red-500'}`}>
                                {betType === 'coins' ? <><GreenCoin cls="w-16 h-16"/> {formatValue(coinBet * 2)}</> : 'PETS MIX'}
                            </div>
                            <div className="flex justify-between items-center bg-[#111] p-4 rounded-2xl border border-[#222]">
                                <div className="text-center w-full">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">You</p>
                                    <p className="text-lg font-black text-white truncate max-w-[100px] mx-auto">{userProfile?.username}</p>
                                </div>
                                <span className="text-2xl font-black italic text-red-600 mx-4">VS</span>
                                <div className="text-center w-full">
                                    <p className="text-[10px] font-bold text-gray-500 uppercase tracking-widest">{mode==='online' ? 'Lobby' : 'Bot'}</p>
                                    <p className="text-lg font-black text-white">{mode === 'online' ? 'ANY' : 'TETO'}</p>
                                </div>
                            </div>
                        </div>
                        <button onClick={mode === 'online' ? hostOnlineMatch : startBotMatch} className={`w-full py-6 mt-8 text-white font-black text-xl uppercase tracking-widest rounded-2xl transition-all active:scale-95 ${mode === 'online' ? 'bg-gradient-to-r from-blue-700 to-blue-500 shadow-[0_5px_30px_rgba(37,99,235,0.4)]' : 'bg-gradient-to-r from-red-700 to-red-500 shadow-[0_5px_30px_rgba(220,38,38,0.4)]'}`}>
                            {mode === 'online' ? 'Create Lobby' : 'Start Match'}
                        </button>
                    </div>
                </div>
            </div>
        )}

        {/* === THE CASINO TABLE === */}
        {view === 'playing' && (
            <div className="relative w-full h-[70vh] flex items-center justify-center animate-fade-in mt-10">
                
                {/* BOTÓN ANTI GHOST MATCHES */}
                {currentRoom?.status === 'waiting' && (
                    <div className="absolute top-0 left-0 z-50">
                        <button onClick={handleLeaveMatch} className="bg-red-600/80 hover:bg-red-500 text-white px-6 py-3 rounded-full font-black uppercase tracking-widest text-xs border border-red-400/50 backdrop-blur-md transition-all active:scale-95">
                            ← Abandonar (Reembolso)
                        </button>
                    </div>
                )}

                {/* TABLE BACKGROUND */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[95vw] max-w-[1000px] h-[65vh] max-h-[600px] bg-[#140808] border-[20px] border-[#1a1111] rounded-[600px] shadow-[0_0_100px_rgba(0,0,0,1),inset_0_0_150px_rgba(0,0,0,1)] z-0 flex items-center justify-center pointer-events-none">
                    <div className="absolute inset-0 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')] opacity-10 rounded-[500px]"></div>
                    <div className="absolute inset-6 rounded-[500px] border-[3px] border-red-900/40"></div>
                    
                    {/* CENTER POT */}
                    <div className="absolute z-0 flex flex-col items-center justify-center bg-black/60 p-8 rounded-full border border-red-900/50 backdrop-blur-md shadow-[0_0_50px_rgba(0,0,0,0.8)]">
                        <span className="text-[10px] uppercase tracking-[0.4em] text-red-500/80 mb-2 font-black">Pot Total</span>
                        {betType === 'coins' ? (
                            <div className="text-5xl font-black text-yellow-400 drop-shadow-[0_0_20px_rgba(250,204,21,0.6)] flex items-center gap-3">
                                <GreenCoin cls="w-10 h-10"/> {formatValue(potTotal)}
                            </div>
                        ) : (
                            <div className="flex flex-col items-center gap-4">
                                <div className="flex -space-x-4">
                                    {selectedPets.slice(0,3).map((p,i) => <img key={i} src={p.image_url || p.img || '/file.svg'} className="w-12 h-12 rounded-full border-2 border-white bg-black/80 shadow-lg object-contain p-1" />)}
                                </div>
                                <span className="text-sm font-black text-red-600 italic">VS {mode === 'online' ? 'LOBBY' : 'TETO'}</span>
                                <div className="flex -space-x-4">
                                    {(mode === 'bot' ? botPets : (currentRoom?.pool_items || [])).slice(0,3).map((p,i) => <img key={`b${i}`} src={p.image_url || p.img || '/file.svg'} className="w-12 h-12 rounded-full border-2 border-gray-500 bg-black/80 shadow-lg object-contain p-1 opacity-80" />)}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* ACTION LOG TEXT */}
                <div className="absolute top-0 w-full text-center z-40 pointer-events-none">
                    <p className={`text-4xl md:text-5xl font-black italic transition-all duration-300 uppercase tracking-[0.2em] bg-black/80 backdrop-blur-xl inline-block px-12 py-5 rounded-full border border-white/10 shadow-2xl ${actionLog.includes('BANG') ? 'text-red-600 scale-125 drop-shadow-[0_0_50px_rgba(220,38,38,1)] border-red-500/50' : 'text-white'}`}>
                        {actionLog}
                    </p>
                </div>

                {/* --- PLAYERS (PERFECT CIRCLE) --- */}
                <div className="absolute inset-0 z-20 pointer-events-none">
                    {visualCirclePlayers.map(p => {
                        const isMe = p.id === currentUser?.id;
                        const isMyTurn = turnId === p.id;
                        
                        return (
                            <div key={p.id} className={`absolute flex flex-col items-center transition-all duration-700 pointer-events-auto -translate-x-1/2 -translate-y-1/2 ${isMyTurn ? 'scale-110 z-40' : 'opacity-80 scale-90 z-10'} ${p.isDead ? 'grayscale opacity-30 scale-75' : ''}`} style={{ left: p.visualLeft, top: p.visualTop }}>
                                
                                <div className={`w-28 h-28 md:w-36 md:h-36 rounded-full border-[8px] p-1 bg-[#0a0a0a] relative shadow-2xl ${isMyTurn && !p.isDead ? 'border-white drop-shadow-[0_0_50px_rgba(255,255,255,0.8)]' : 'border-[#222]'}`}>
                                    <img src={p.avatar} className="w-full h-full object-cover rounded-full" />
                                    {p.isDead && <div className="absolute inset-0 flex items-center justify-center text-6xl bg-red-900/80 rounded-full backdrop-blur-sm">💀</div>}
                                </div>
                                <div className={`mt-3 font-black text-xs px-6 py-2 rounded-full uppercase tracking-widest border border-black shadow-2xl ${isMe ? 'bg-red-600 text-white' : 'bg-[#111] text-gray-400'}`}>
                                    {isMe ? 'YOU' : p.name}
                                </div>
                                
                                {/* ACTIONS BUTTONS */}
                                {isMe && !p.isDead && turnId === currentUser.id && (
                                    <div className="absolute top-[-70px] w-max flex gap-4">
                                        <button disabled={isProcessing || cylinderSpinning} onClick={() => handleShoot(currentUser.id)} className="bg-white hover:bg-gray-200 text-black px-6 py-3 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(255,255,255,0.4)] active:scale-95 border-4 border-white/20 disabled:opacity-20 disabled:cursor-not-allowed">Shoot Self</button>
                                        <button disabled={isProcessing || cylinderSpinning || mode === 'online'} onClick={() => handleShoot('bot')} className="bg-red-600 hover:bg-red-500 text-white px-6 py-3 rounded-2xl font-black uppercase tracking-widest shadow-[0_0_30px_rgba(220,38,38,0.4)] active:scale-95 disabled:opacity-20 disabled:cursor-not-allowed">Shoot Foe {mode === 'online' && '(Disabled)'}</button>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* --- THE GUN --- */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-64 h-64 flex items-center justify-center z-30 pointer-events-none mt-4">
                    <GunSVG targetAngle={gunAngle} isShaking={gunShaking} isFiring={gunFiring} isSpinningCylinder={cylinderSpinning} />
                    
                    {/* CYLINDER UI */}
                    <div className="absolute -bottom-16 flex gap-2 bg-black/80 px-6 py-3 rounded-full border border-white/10 backdrop-blur-xl shadow-2xl">
                        {[0, 1, 2, 3, 4, 5].map(idx => (
                            <div key={idx} className={`w-3 h-3 rounded-full border-2 transition-all duration-300 ${idx === uiChamber ? 'border-red-500 bg-red-500 shadow-[0_0_15px_rgba(220,38,38,1)] scale-150' : idx < uiChamber ? 'border-[#333] bg-[#111] opacity-40' : 'border-gray-500 bg-transparent'}`}></div>
                        ))}
                    </div>
                </div>

                {/* HOST START BUTTON */}
                {currentRoom?.host_id === currentUser?.id && actionLog === "WAITING FOR PLAYERS..." && (
                    <div className="absolute bottom-10 z-40">
                        <button onClick={startOnlineGameHost} disabled={players.length < 2} className="bg-white text-black px-16 py-6 rounded-full font-black text-xl uppercase tracking-widest shadow-[0_0_40px_rgba(255,255,255,0.4)] hover:scale-105 transition-all disabled:opacity-20 active:scale-95">Start Match ({players.length}/6)</button>
                    </div>
                )}
            </div>
        )}

        {/* === EPIC RESULT SCREEN === */}
        {view === 'result' && (
            <div className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 backdrop-blur-3xl animate-fade-in overflow-hidden">
                
                {/* FIX ICONOS: Backpack Icon Fallback a un emoji gigante por si la imagen se rompe */}
                {actionLog.includes('WON') && (
                    <div className="absolute top-10 right-10 z-50 text-7xl animate-pulse drop-shadow-[0_0_20px_rgba(255,255,255,0.8)]">
                        🎒
                    </div>
                )}

                <div className="text-[150px] leading-none mb-6 z-10 drop-shadow-[0_0_80px_rgba(255,0,0,0.8)] animate-bounce-slight">
                    {actionLog.includes('WON') ? '🏆' : '💀'}
                </div>
                
                <h2 className={`text-5xl md:text-8xl font-black mb-16 text-center z-10 uppercase tracking-[0.2em] drop-shadow-2xl px-4 ${actionLog.includes('WON') ? 'text-yellow-400' : 'text-red-600'}`}>
                    {actionLog}
                </h2>
                
                {/* Flying Items Animation Container */}
                {actionLog.includes('WON') && winData && (
                    <div className="flex flex-wrap gap-6 justify-center items-center max-w-4xl z-10 mt-8">
                        {winData.prizeType === 'coins' ? (
                            <div className="flex items-center gap-6 text-7xl text-green-400 font-black animate-fly-to-backpack drop-shadow-[0_0_30px_rgba(34,197,94,0.8)]">
                                <GreenCoin cls="w-24 h-24"/> +{formatValue(winData.amount)}
                            </div>
                        ) : (
                            winData.items.map((pet, i) => (
                                <div key={i} className="animate-fly-to-backpack drop-shadow-[0_0_20px_rgba(255,255,255,0.5)]" style={{animationDelay: `${i * 0.15}s`}}>
                                    <div className="scale-125 pointer-events-none">
                                        <PetCard pet={pet} />
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                )}

                <button onClick={leaveToMenu} className="px-20 py-8 mt-16 bg-white text-black text-2xl font-black uppercase tracking-widest rounded-full hover:bg-gray-200 transition-all shadow-[0_0_50px_rgba(255,255,255,0.5)] hover:scale-105 z-10 active:scale-95">
                    {actionLog.includes('WON') ? 'COLLECT LOOT & LEAVE' : 'BACK TO LOBBY'}
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

        /* EPIC BACKPACK FLYING ANIMATION */
        @keyframes flyToBackpack {
            0% { transform: scale(0) translateY(100px); opacity: 0; }
            15% { transform: scale(1.2) translateY(0); opacity: 1; }
            60% { transform: scale(1) translateY(0); opacity: 1; }
            100% { transform: scale(0.1) translate(calc(45vw - 100px), calc(-40vh + 100px)); opacity: 0; }
        }
        .animate-fly-to-backpack {
            animation: flyToBackpack 2.5s cubic-bezier(0.25, 1, 0.5, 1) forwards;
        }

        .custom-scrollbar::-webkit-scrollbar { width: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #0a0a0a; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #333; border-radius: 10px; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #555; }
      `}</style>
    </div>
  );
}
