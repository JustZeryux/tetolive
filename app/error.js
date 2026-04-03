"use client"; // Este archivo debe ser un Client Component obligatoriamente
import { useEffect } from 'react';

export default function ErrorBoundary({ error, reset }) {
  useEffect(() => {
    // Esto imprime el error en tu consola de Vercel/Navegador para que puedas revisarlo
    console.error("Teto atrapó un error:", error);
  }, [error]);

  return (
    <div className="min-h-screen bg-[#0b0e14] flex flex-col items-center justify-center p-4 text-center font-sans relative overflow-hidden">
      
      {/* Luces de fondo dramáticas (Rojo de alerta) */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-[#ef4444] opacity-10 blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-[#6C63FF] opacity-10 blur-[120px] pointer-events-none"></div>

      <div className="relative z-10 bg-[#14151f] border border-[#252839] rounded-3xl shadow-[0_0_50px_rgba(239,68,68,0.15)] p-8 max-w-lg w-full flex flex-col items-center animate-fade-in">
        
        {/* LA TETO */}
        <div className="relative w-48 h-48 mb-6">
          <div className="absolute inset-0 bg-[#ef4444] rounded-full opacity-20 blur-2xl animate-pulse"></div>
          {/* OJO: Asegúrate de tener una imagen llamada teto-error.png en tu carpeta public */}
          <img 
            src="/favicon.ico" 
            alt="Teto Error" 
            className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_20px_rgba(239,68,68,0.4)] hover:scale-105 transition-transform"
            onError={(e) => { 
                // Si no encuentra tu imagen, pone este GIF de emergencia
                e.target.src = 'https://media.tenor.com/images/9c336b110a2eb7058a5e8e8fb4ce094a/tenor.gif'; 
            }} 
          />
        </div>

        <h1 className="text-3xl font-black text-white uppercase tracking-widest mb-2">
          SYSTEM <span className="text-[#ef4444]">CRASHED</span>
        </h1>
        <p className="text-[#8f9ac6] font-bold mb-6 text-sm">
          ¡Ay no! Teto tropezó con los cables del servidor.
        </p>

        {/* CAJA DEL ERROR EXACTO */}
        <div className="bg-[#0b0e14] border border-[#ef4444]/30 rounded-xl p-4 w-full text-left mb-8 overflow-x-auto custom-scrollbar shadow-inner relative group">
          <div className="absolute top-0 left-0 w-1 h-full bg-[#ef4444] rounded-l-xl"></div>
          <p className="text-[#ef4444] text-[10px] font-black uppercase tracking-widest mb-2 flex items-center gap-2">
            ⚠️ Error Details
          </p>
          <code className="text-[#a8b3d6] text-xs break-words font-mono block">
            {error.message || "Unknown Fatal Error"}
          </code>
          {error.digest && (
              <p className="text-[#555b82] text-[9px] mt-2 font-mono">Digest ID: {error.digest}</p>
          )}
        </div>

        {/* BOTONES DE RESCATE */}
        <div className="flex flex-col sm:flex-row gap-4 w-full">
          <button
            onClick={() => window.history.back()}
            className="flex-1 py-3 px-4 bg-[#0b0e14] hover:bg-[#252839] border border-[#252839] hover:border-[#3f4354] text-[#8f9ac6] hover:text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all"
          >
            ← Go Back
          </button>
          
          <button
            onClick={() => reset()}
            className="flex-1 py-3 px-4 bg-gradient-to-r from-[#ef4444] to-[#dc2626] hover:from-[#f87171] text-white font-black rounded-xl text-xs uppercase tracking-widest transition-all shadow-[0_0_15px_rgba(239,68,68,0.4)] hover:shadow-[0_0_25px_rgba(239,68,68,0.6)] hover:-translate-y-1"
          >
            Try Again ↻
          </button>
        </div>
      </div>
      
      {/* Estilos para el scrollbar de la caja de error */}
      <style dangerouslySetInnerHTML={{__html: `
        .custom-scrollbar::-webkit-scrollbar { height: 6px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #ef4444; border-radius: 10px; }
        .animate-fade-in { animation: fadeIn 0.4s ease-out forwards; }
        @keyframes fadeIn { from { opacity: 0; transform: translateY(20px); } to { opacity: 1; transform: translateY(0); } }
      `}} />
    </div>
  );
}
