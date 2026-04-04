"use client";
import { useState, useEffect, useRef } from 'react';
import { supabase } from '@/utils/Supabase';
import { showToast } from '@/components/EpicToasts';
import PetCard from '@/components/PetCard';

// --- DATABASE SIMULADA DE ENEMIGOS ---
const ENEMIES = [
    { name: "Slime Corrupto", hp: 100, maxHp: 100, dmg: 10, speed: 2000, img: "💧" },
    { name: "Lobo Sombrío", hp: 150, maxHp: 150, dmg: 18, speed: 1500, img: "🐺" },
    { name: "Gólem de Óxido", hp: 300, maxHp: 300, dmg: 25, speed: 3000, img: "🪨" }
];

export default function ExpeditionPage() {
    const [user, setUser] = useState(null);
    const [inventory, setInventory] = useState([]);
    
    // Estados del Juego
    const [view, setView] = useState('select'); // select, battle, result
    const [activePet, setActivePet] = useState(null);
    const [expeditionId, setExpeditionId] = useState(null);
    const [runStats, setRunStats] = useState({ kills: 0, coins: 0 });

    // Estados de Combate
    const [enemy, setEnemy] = useState(null);
    const [playerHp, setPlayerHp] = useState(100);
    const [playerMaxHp, setPlayerMaxHp] = useState(100);
    
    // Barras de Acción (ATB)
    const [playerAtb, setPlayerAtb] = useState(0);
    const [enemyAtb, setEnemyAtb] = useState(0);
    const [isDefending, setIsDefending] = useState(false);
    
    const atbInterval = useRef(null);

    // --- 1. INICIALIZACIÓN ---
    useEffect(() => {
        const init = async () => {
            const { data: { user } } = await supabase.auth.getUser();
            if (user) {
                setUser(user);
                const { data } = await supabase.from('inventory').select('*, items(*)').eq('user_id', user.id);
                if (data) {
                    setInventory(data.map(i => ({
                        ...i.items, inv_id: i.id, item_id: i.item_id, is_shiny: i.is_shiny, is_mythic: i.is_mythic
                    })));
                }
            }
        };
        init();
        return () => clearInterval(atbInterval.current);
    }, []);

    // --- 2. LÓGICA DE COMBATE EN TIEMPO REAL ---
    const startEncounter = () => {
        const randomEnemy = { ...ENEMIES[Math.floor(Math.random() * ENEMIES.length)] };
        // Escalar enemigo basado en las kills actuales
        randomEnemy.hp += (runStats.kills * 20);
        randomEnemy.maxHp = randomEnemy.hp;
        randomEnemy.dmg += (runStats.kills * 2);
        
        setEnemy(randomEnemy);
        setPlayerAtb(0);
        setEnemyAtb(0);
        setIsDefending(false);
        setView('battle');

        // Bucle principal del juego (Tick cada 100ms)
        atbInterval.current = setInterval(() => {
            setPlayerAtb(prev => Math.min(100, prev + 5)); // Jugador recarga
            
            setEnemyAtb(prev => {
                const newAtb = prev + (10000 / randomEnemy.speed);
                if (newAtb >= 100) {
                    enemyAttack();
                    return 0; // Resetear barra de enemigo tras atacar
                }
                return newAtb;
            });
        }, 100);
    };

    const enemyAttack = () => {
        setPlayerHp(prev => {
            setIsDefending(def => {
                const damage = def ? Math.floor(enemy.dmg * 0.3) : enemy.dmg; // Bloqueo reduce 70%
                if (!def) triggerScreenShake();
                const newHp = Math.max(0, prev - damage);
                if (newHp <= 0) handleDeath();
                return def; // Mantener estado anterior
            });
            return prev; // Placeholder, el setState real ocurre arriba
        });
        
        // Forma segura de actualizar HP en React
        setIsDefending(def => {
            const damage = def ? Math.floor(enemy.dmg * 0.3) : enemy.dmg;
            if (!def) triggerScreenShake();
            setPlayerHp(prev => {
                const newHp = Math.max(0, prev - damage);
                if (newHp === 0) setTimeout(handleDeath, 100);
                return newHp;
            });
            return false; // Quitar defensa tras recibir el golpe
        });
    };

    // --- 3. HABILIDADES DEL JUGADOR ---
    const actionAttack = () => {
        if (playerAtb < 100) return;
        setPlayerAtb(0);
        setIsDefending(false);
        
        // Daño base + bonus si es shiny/mythic
        let dmg = 25 + (activePet.value * 0.1);
        if (activePet.is_mythic) dmg *= 1.5;

        setEnemy(prev => {
            const newHp = Math.max(0, prev.hp - dmg);
            if (newHp === 0) setTimeout(handleVictory, 100);
            return { ...prev, hp: newHp };
        });
    };

    const actionDefend = () => {
        if (playerAtb < 50) return; // Cuesta media barra
        setPlayerAtb(prev => prev - 50);
        setIsDefending(true);
    };

    const actionHeal = () => {
        if (playerAtb < 100) return;
        setPlayerAtb(0);
        setIsDefending(false);
        setPlayerHp(prev => Math.min(playerMaxHp, prev + 40));
    };

    // --- 4. RESOLUCIÓN ---
    const handleVictory = () => {
        clearInterval(atbInterval.current);
        const coinsWon = Math.floor(Math.random() * 50) + 20 + (runStats.kills * 10);
        
        setRunStats(prev => ({ kills: prev.kills + 1, coins: prev.coins + coinsWon }));
        showToast(`¡Enemigo derrotado! +${coinsWon} Green Coins`, "success");
        setView('intermission');
    };

    const handleDeath = async () => {
        clearInterval(atbInterval.current);
        showToast("Tu mascota ha caído en combate. Pierdes el loot.", "error");
        
        await supabase.from('expeditions').update({ 
            status: 'dead' 
        }).eq('id', expeditionId);

        setView('result');
    };

    const extractLoot = async () => {
        clearInterval(atbInterval.current);
        
        // 1. Dar las monedas al jugador
        const { data: profile } = await supabase.from('profiles').select('saldo_verde').eq('id', user.id).single();
        await supabase.from('profiles').update({ 
            saldo_verde: profile.saldo_verde + runStats.coins 
        }).eq('id', user.id);

        // 2. Marcar expedición como exitosa
        await supabase.from('expeditions').update({ 
            status: 'extracted',
            coins_earned: runStats.coins,
            enemies_defeated: runStats.kills
        }).eq('id', expeditionId);

        showToast(`¡Extracción exitosa! Llevas ${runStats.coins} a tu Vault.`, "success");
        setView('result');
    };

    const startExpedition = async (pet) => {
        setActivePet(pet);
        setPlayerHp(100 + (pet.value * 0.5));
        setPlayerMaxHp(100 + (pet.value * 0.5));
        setRunStats({ kills: 0, coins: 0 });

        const { data } = await supabase.from('expeditions').insert({
            user_id: user.id,
            pet_used_id: pet.item_id,
            zone_name: 'Caverna Inicial'
        }).select().single();

        if (data) setExpeditionId(data.id);
        
        startEncounter();
    };

    // Efecto visual simple
    const triggerScreenShake = () => {
        const el = document.getElementById('battle-screen');
        if (el) {
            el.classList.add('animate-shake');
            setTimeout(() => el.classList.remove('animate-shake'), 300);
        }
    };

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#050505] text-white p-4 md:p-8 font-sans overflow-hidden">
            
            {/* SELECCIÓN DE MASCOTA */}
            {view === 'select' && (
                <div className="max-w-6xl mx-auto animate-fade-in">
                    <h1 className="text-5xl font-black uppercase tracking-widest text-cyan-500 mb-2">Expediciones RPG</h1>
                    <p className="text-gray-500 font-bold uppercase tracking-widest mb-12">Elige a tu campeón. Lucha. Sobrevive. Extrae.</p>
                    
                    <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                        {inventory.map(pet => (
                            <div key={pet.inv_id} onClick={() => startExpedition(pet)} className="cursor-pointer hover:scale-105 transition-all group">
                                <div className="pointer-events-none"><PetCard pet={pet} /></div>
                                <button className="w-full mt-2 py-2 bg-[#111] border border-[#333] group-hover:border-cyan-500 text-xs font-black uppercase tracking-widest rounded-lg">Desplegar</button>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* PANTALLA DE BATALLA */}
            {view === 'battle' && enemy && (
                <div id="battle-screen" className="max-w-4xl mx-auto mt-10 animate-fade-in">
                    
                    {/* Header: Stats de la Run */}
                    <div className="flex justify-between items-center bg-[#0a0a0a] border border-[#222] p-4 rounded-2xl mb-8">
                        <span className="text-red-500 font-black uppercase tracking-widest">Kills: {runStats.kills}</span>
                        <span className="text-green-400 font-black uppercase tracking-widest flex items-center gap-2">Loot: <img src="/green-coin.png" className="w-5 h-5"/> {runStats.coins}</span>
                    </div>

                    <div className="flex flex-col md:flex-row gap-8 justify-between items-center mb-12 relative">
                        
                        {/* JUGADOR */}
                        <div className="flex flex-col items-center w-full md:w-1/3">
                            <h3 className="text-xl font-black uppercase tracking-widest mb-4">{activePet.name}</h3>
                            <div className={`scale-125 mb-8 ${isDefending ? 'brightness-50 drop-shadow-[0_0_20px_rgba(59,130,246,0.8)]' : ''}`}>
                                <PetCard pet={activePet} />
                            </div>
                            
                            {/* Barra HP Jugador */}
                            <div className="w-full bg-[#111] h-6 rounded-full border border-[#333] overflow-hidden mb-2 relative">
                                <div className="bg-green-500 h-full transition-all" style={{ width: `${(playerHp / playerMaxHp) * 100}%` }}></div>
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black drop-shadow-md">{Math.floor(playerHp)} / {Math.floor(playerMaxHp)} HP</span>
                            </div>
                            
                            {/* Barra ATB Jugador */}
                            <div className="w-full bg-[#111] h-3 rounded-full border border-[#333] overflow-hidden">
                                <div className="bg-cyan-500 h-full transition-all duration-100 ease-linear shadow-[0_0_10px_#06b6d4]" style={{ width: `${playerAtb}%` }}></div>
                            </div>
                        </div>

                        <div className="text-6xl font-black text-[#222] italic">VS</div>

                        {/* ENEMIGO */}
                        <div className="flex flex-col items-center w-full md:w-1/3">
                            <h3 className="text-xl font-black uppercase tracking-widest mb-4 text-red-500">{enemy.name}</h3>
                            <div className="text-9xl mb-8 drop-shadow-[0_0_30px_rgba(239,68,68,0.3)] animate-pulse">{enemy.img}</div>
                            
                            {/* Barra HP Enemigo */}
                            <div className="w-full bg-[#111] h-6 rounded-full border border-[#333] overflow-hidden mb-2 relative">
                                <div className="bg-red-600 h-full transition-all" style={{ width: `${(enemy.hp / enemy.maxHp) * 100}%` }}></div>
                                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-black drop-shadow-md">{Math.floor(enemy.hp)} HP</span>
                            </div>

                            {/* Barra ATB Enemigo */}
                            <div className="w-full bg-[#111] h-3 rounded-full border border-[#333] overflow-hidden">
                                <div className="bg-red-900 h-full transition-all duration-100 ease-linear" style={{ width: `${enemyAtb}%` }}></div>
                            </div>
                        </div>

                    </div>

                    {/* PANEL DE ACCIONES */}
                    <div className="grid grid-cols-3 gap-4 bg-[#0a0a0a] border border-[#222] p-6 rounded-3xl shadow-2xl">
                        <button onClick={actionAttack} disabled={playerAtb < 100} className="bg-red-900/30 border border-red-900/50 hover:bg-red-900/60 text-red-500 disabled:opacity-30 py-6 rounded-xl font-black uppercase tracking-widest transition-all flex flex-col items-center gap-2 active:scale-95">
                            <span className="text-2xl">⚔️</span> Atacar (100%)
                        </button>
                        <button onClick={actionDefend} disabled={playerAtb < 50} className="bg-blue-900/30 border border-blue-900/50 hover:bg-blue-900/60 text-blue-500 disabled:opacity-30 py-6 rounded-xl font-black uppercase tracking-widest transition-all flex flex-col items-center gap-2 active:scale-95">
                            <span className="text-2xl">🛡️</span> Bloquear (50%)
                        </button>
                        <button onClick={actionHeal} disabled={playerAtb < 100} className="bg-green-900/30 border border-green-900/50 hover:bg-green-900/60 text-green-500 disabled:opacity-30 py-6 rounded-xl font-black uppercase tracking-widest transition-all flex flex-col items-center gap-2 active:scale-95">
                            <span className="text-2xl">🧪</span> Curar (100%)
                        </button>
                    </div>

                </div>
            )}

            {/* PANTALLA INTERMEDIA (Seguir o Extraer) */}
            {view === 'intermission' && (
                <div className="flex flex-col items-center justify-center mt-20 animate-fade-in">
                    <h2 className="text-4xl font-black text-white uppercase tracking-widest mb-2">Zona Limpia</h2>
                    <p className="text-gray-500 mb-8 font-bold tracking-widest uppercase">Loot actual: {runStats.coins} Green Coins</p>
                    
                    <div className="flex gap-6">
                        <button onClick={startEncounter} className="bg-[#111] border-2 border-red-500 hover:bg-red-900/30 text-white px-12 py-6 rounded-2xl font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(239,68,68,0.2)]">
                            Explorar más profundo
                        </button>
                        <button onClick={extractLoot} className="bg-green-600 hover:bg-green-500 text-white px-12 py-6 rounded-2xl font-black uppercase tracking-widest transition-all shadow-[0_0_30px_rgba(34,197,94,0.4)]">
                            Extraer y Guardar Loot
                        </button>
                    </div>
                </div>
            )}

            {/* PANTALLA DE RESULTADOS */}
            {view === 'result' && (
                <div className="flex flex-col items-center justify-center mt-20 animate-fade-in">
                    <h2 className="text-6xl font-black uppercase tracking-[0.2em] mb-8 text-center">Resumen de Expedición</h2>
                    <div className="bg-[#0a0a0a] border border-[#222] p-8 rounded-3xl text-center min-w-[300px]">
                        <p className="text-gray-500 font-black uppercase tracking-widest mb-4">Enemigos Derrotados</p>
                        <p className="text-4xl text-white font-black mb-8">{runStats.kills}</p>
                        
                        <p className="text-gray-500 font-black uppercase tracking-widest mb-4">Green Coins Extraídas</p>
                        <p className="text-4xl text-green-400 font-black flex justify-center items-center gap-3">
                            <img src="/green-coin.png" className="w-8 h-8"/>
                            {runStats.coins}
                        </p>
                    </div>
                    
                    <button onClick={() => setView('select')} className="mt-12 text-gray-500 hover:text-white font-black uppercase tracking-widest transition-colors">
                        Volver al menú
                    </button>
                </div>
            )}

            <style jsx global>{`
                .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
                .animate-shake { animation: shake 0.3s cubic-bezier(.36,.07,.19,.97) both; }
                
                @keyframes fadeIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
                @keyframes shake {
                    10%, 90% { transform: translate3d(-2px, 0, 0); }
                    20%, 80% { transform: translate3d(4px, 0, 0); }
                    30%, 50%, 70% { transform: translate3d(-8px, 0, 0); }
                    40%, 60% { transform: translate3d(8px, 0, 0); }
                }
            `}</style>
        </div>
    );
}
