"use client";
import { useState, useEffect, useRef } from 'react';

// LA PLAYLIST (Asegúrate de poner estos .mp3 en tu carpeta public/music/)
const TETO_TRACKS = [
  { title: "Igaku (Medicine) - Teto", src: "/music/igaku.mp3" },
  { title: "Override - Teto", src: "/music/override.mp3" },
  { title: "Fukkireta (Ochame Kinou)", src: "/music/fukkireta.mp3" },
  { title: "Liar Dancer - Teto", src: "/music/liar_dancer.mp3" }
];

export default function TetoPlayer({ isMobileVisible, setIsMobileVisible }) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTrack, setCurrentTrack] = useState(0);
  const audioRef = useRef(null);

  // Iniciar el volumen bajito (15%) para que sea chill
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = 0.15;
    }
  }, []);

  // Manejar Play/Pause
  const togglePlay = () => {
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch(e => console.log("El navegador bloqueó el autoplay", e));
    }
    setIsPlaying(!isPlaying);
  };

  // Siguiente Canción
  const nextTrack = () => {
    const nextIndex = (currentTrack + 1) % TETO_TRACKS.length;
    setCurrentTrack(nextIndex);
    setIsPlaying(true);
  };

  // Efecto para cambiar la fuente y reproducir al instante cuando cambia la rola
  useEffect(() => {
    if (audioRef.current && isPlaying) {
      audioRef.current.play().catch(e => console.log(e));
    }
  }, [currentTrack]);

  // Si no está visible en celular, le metemos una clase para ocultarlo
  const mobileClass = isMobileVisible ? "translate-y-0" : "translate-y-[150%] md:translate-y-0";

  return (
    <>
      {/* Etiqueta de Audio Real */}
      <audio 
        ref={audioRef} 
        src={TETO_TRACKS[currentTrack].src} 
        onEnded={nextTrack} // Auto-play la siguiente cuando termina
      />

      {/* REPRODUCTOR VISUAL */}
      <div className={`fixed bottom-24 md:bottom-6 right-4 md:left-6 z-[80] transition-all duration-500 ease-in-out ${mobileClass} group`}>
        
        {/* Contenedor principal que se expande en hover (solo en PC) */}
        <div className="bg-[#14151f]/90 backdrop-blur-md border-2 border-[#f472b6]/50 rounded-2xl p-3 shadow-[0_0_20px_rgba(244,114,182,0.3)] flex items-center gap-3 w-[260px] md:w-[60px] md:group-hover:w-[260px] transition-all duration-300 overflow-hidden">
          
          {/* Ícono de Teto (Animado cuando suena) */}
          <div className="w-10 h-10 shrink-0 bg-[#0b0e14] rounded-full border border-[#f472b6] flex items-center justify-center shadow-inner relative overflow-hidden">
            <img src="/favicon.ico" alt="Teto" className={`w-7 h-7 object-contain ${isPlaying ? 'animate-[spin_4s_linear_infinite]' : ''}`} />
          </div>

          {/* Controles de Música (Ocultos en PC hasta hacer hover) */}
          <div className="flex flex-col min-w-[180px] opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity duration-300 delay-100">
            <p className="text-[#f472b6] text-[10px] font-black uppercase tracking-widest truncate mb-1 w-full">
              {TETO_TRACKS[currentTrack].title}
            </p>
            <div className="flex items-center gap-3">
              <button onClick={togglePlay} className="text-white hover:text-[#f472b6] text-xl transition-colors">
                {isPlaying ? '⏸' : '▶️'}
              </button>
              <button onClick={nextTrack} className="text-[#8f9ac6] hover:text-white text-sm transition-colors">
                ⏭
              </button>
              {/* Indicador de volumen tipo barritas */}
              <div className="flex gap-0.5 ml-auto items-end h-3">
                <span className={`w-1 bg-[#f472b6] rounded-sm ${isPlaying ? 'animate-[bounce_0.8s_infinite]' : 'h-1'}`} style={{animationDelay: '0s', height: '100%'}}></span>
                <span className={`w-1 bg-[#f472b6] rounded-sm ${isPlaying ? 'animate-[bounce_0.8s_infinite]' : 'h-1'}`} style={{animationDelay: '0.2s', height: '60%'}}></span>
                <span className={`w-1 bg-[#f472b6] rounded-sm ${isPlaying ? 'animate-[bounce_0.8s_infinite]' : 'h-1'}`} style={{animationDelay: '0.4s', height: '80%'}}></span>
              </div>
            </div>
          </div>

        </div>
        
        {/* Botón de cerrar en celular para ocultar el widget */}
        <button 
          onClick={() => setIsMobileVisible(false)}
          className="md:hidden absolute -top-3 -right-3 bg-[#14151f] border border-[#f472b6] text-white w-6 h-6 rounded-full text-xs font-bold"
        >
          X
        </button>
      </div>
    </>
  );
}
