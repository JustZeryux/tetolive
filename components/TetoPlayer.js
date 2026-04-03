"use client";
import { useState, useEffect, useRef } from 'react';

// LA PLAYLIST COMPLETA
const TETO_TRACKS = [
  { title: "Igaku (Medicine) - Teto", src: "/music/igaku.mp3" },
  { title: "Override - Teto", src: "/music/override.mp3" },
  { title: "Fukkireta (Ochame Kinou)", src: "/music/fukkireta.mp3" },
  { title: "Liar Dancer - Teto", src: "/music/liar_dancer.mp3" }
];

export default function TetoPlayer({ isMobileVisible, setIsMobileVisible }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [isExpanded, setIsExpanded] = useState(false); // NUEVO: Controla si está abierto o cerrado
  const audioRef = useRef(null);

  // Iniciar el volumen bajito (15%)
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.15;
    }
  }, []);

  // Manejar Play/Pause con Promesas (Para evitar bloqueos del navegador)
  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play()
        .then(() => setIsPlaying(true))
        .catch(e => console.log("Autoplay bloqueado por el navegador:", e));
    }
  };

  // Siguiente Canción
  const nextTrack = () => {
    setCurrentTrack((prev) => (prev + 1) % TETO_TRACKS.length);
    setIsPlaying(true);
  };

  // Efecto SUPER IMPORTANTE: Forzar la carga de la nueva canción
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.load(); // Esto arregla el bug de que no reproducía
      if (isPlaying) {
        audioRef.current.play().catch(e => console.log(e));
      }
    }
  }, [currentTrack]);

  // Clase para ocultar en celular si no lo abren
  const mobileClass = isMobileVisible ? "translate-y-0" : "translate-y-[150%] md:translate-y-0";

  return (
    <>
      <audio 
        ref={audioRef} 
        src={TETO_TRACKS[currentTrack].src} 
        onEnded={nextTrack} // Si acaba, sigue a la próxima solita
      />

      <div className={`fixed bottom-24 md:bottom-6 right-4 md:left-6 z-[80] transition-transform duration-500 ease-in-out ${mobileClass}`}>
        
        {/* Contenedor principal: AHORA DEPENDE DEL ESTADO 'isExpanded' Y NO DE 'group-hover' */}
        <div className={`bg-[#14151f]/90 backdrop-blur-md border-2 border-[#f472b6]/50 rounded-2xl p-3 shadow-[0_0_20px_rgba(244,114,182,0.3)] flex items-center gap-3 transition-all duration-300 overflow-hidden ${isExpanded ? 'w-[260px]' : 'w-[64px]'}`}>
          
          {/* Ícono de Teto (Botón para abrir/cerrar) */}
          <button 
            onClick={() => setIsExpanded(!isExpanded)}
            className="w-10 h-10 shrink-0 bg-[#0b0e14] rounded-full border border-[#f472b6] flex items-center justify-center shadow-inner relative overflow-hidden focus:outline-none hover:scale-105 transition-transform"
          >
            <img src="/favicon.ico" alt="Teto" className={`w-7 h-7 object-contain ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`} />
          </button>

          {/* Controles de Música (Solo se pueden clickear y ver si está expandido) */}
          <div className={`flex flex-col min-w-[180px] transition-opacity duration-300 delay-100 ${isExpanded ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}>
            <p className="text-[#f472b6] text-[10px] font-black uppercase tracking-widest truncate mb-1 w-full">
              {TETO_TRACKS[currentTrack].title}
            </p>
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} className="text-white hover:text-[#f472b6] text-xl transition-colors focus:outline-none">
                {isPlaying ? '⏸' : '▶️'}
              </button>
              <button onClick={nextTrack} className="text-[#8f9ac6] hover:text-white text-sm transition-colors focus:outline-none">
                ⏭
              </button>
              
              <div className="flex gap-0.5 ml-auto items-end h-3">
                <span className={`w-1 bg-[#f472b6] rounded-sm ${isPlaying ? 'animate-[bounce_0.8s_infinite]' : 'h-1'}`} style={{animationDelay: '0s', height: '100%'}}></span>
                <span className={`w-1 bg-[#f472b6] rounded-sm ${isPlaying ? 'animate-[bounce_0.8s_infinite]' : 'h-1'}`} style={{animationDelay: '0.2s', height: '60%'}}></span>
                <span className={`w-1 bg-[#f472b6] rounded-sm ${isPlaying ? 'animate-[bounce_0.8s_infinite]' : 'h-1'}`} style={{animationDelay: '0.4s', height: '80%'}}></span>
              </div>
            </div>
          </div>

        </div>
        
        <button 
          onClick={() => setIsMobileVisible(false)}
          className="md:hidden absolute -top-3 -right-3 bg-[#14151f] border border-[#f472b6] text-white w-6 h-6 rounded-full text-xs font-bold focus:outline-none"
        >
          X
        </button>
      </div>
    </>
  );
}
