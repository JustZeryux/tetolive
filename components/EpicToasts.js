"use client";
import { useState, useEffect } from 'react';

// Función global que podrás llamar en cualquier archivo para mostrar un aviso
export const showToast = (message, type = 'success') => {
  window.dispatchEvent(new CustomEvent('show-toast', { detail: { message, type } }));
};

export default function EpicToasts() {
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const handleToast = (e) => {
      const id = Date.now();
      const newToast = { id, message: e.detail.message, type: e.detail.type };
      setToasts(prev => [...prev, newToast]);
      
      // Auto eliminar después de 4 segundos
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, 4000);
    };

    window.addEventListener('show-toast', handleToast);
    return () => window.removeEventListener('show-toast', handleToast);
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-20 md:bottom-6 right-4 md:right-6 z-[9999] flex flex-col gap-3 pointer-events-none">
      {toasts.map(toast => (
        <div 
          key={toast.id} 
          className="bg-[#1c1f2e]/90 backdrop-blur-md border border-[#252839] rounded-xl p-4 shadow-2xl min-w-[280px] max-w-sm flex items-start gap-3 animate-slide-left pointer-events-auto relative overflow-hidden group"
        >
          {/* Brillo lateral según el tipo */}
          <div className={`absolute left-0 top-0 bottom-0 w-1.5 ${
            toast.type === 'success' ? 'bg-[#3AFF4E] shadow-[0_0_15px_#3AFF4E]' : 
            toast.type === 'error' ? 'bg-[#ef4444] shadow-[0_0_15px_#ef4444]' : 
            toast.type === 'tip' ? 'bg-[#c084fc] shadow-[0_0_15px_#c084fc]' : 'bg-[#38bdf8]'
          }`}></div>
          
          <div className="text-xl shrink-0 ml-1">
            {toast.type === 'success' ? '✨' : toast.type === 'error' ? '❌' : toast.type === 'tip' ? '💸' : '🔔'}
          </div>
          <div className="flex-1">
            <h4 className={`text-xs font-black uppercase tracking-widest mb-0.5 ${
              toast.type === 'success' ? 'text-[#3AFF4E]' : toast.type === 'error' ? 'text-[#ef4444]' : toast.type === 'tip' ? 'text-[#c084fc]' : 'text-[#38bdf8]'
            }`}>
              {toast.type === 'success' ? 'Success' : toast.type === 'error' ? 'Error' : toast.type === 'tip' ? 'Tip Received' : 'Notification'}
            </h4>
            <p className="text-white text-sm font-bold leading-tight drop-shadow-md">{toast.message}</p>
          </div>
        </div>
      ))}
      <style dangerouslySetInnerHTML={{__html: `
        .animate-slide-left { animation: slideLeft 0.4s cubic-bezier(0.175, 0.885, 0.32, 1.275) forwards; }
        @keyframes slideLeft { 0% { opacity: 0; transform: translateX(100%) scale(0.9); } 100% { opacity: 1; transform: translateX(0) scale(1); } }
      `}} />
    </div>
  );
}