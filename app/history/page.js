"use client";
import { useState, useEffect } from 'react';
import { supabase } from '@/utils/Supabase';
import { showToast } from '@/components/EpicToasts';

export default function HistoryPage() {
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [reportingLog, setReportingLog] = useState(null);
    const [reportText, setReportText] = useState("");
    const [user, setUser] = useState(null);

    useEffect(() => {
        fetchLogs();
    }, []);

    const fetchLogs = async () => {
        setLoading(true);
        const { data: { user } } = await supabase.auth.getUser();
        if (user) {
            setUser(user);
            const { data, error } = await supabase
                .from('action_logs')
                .select('*')
                .eq('user_id', user.id)
                .order('created_at', { ascending: false })
                .limit(50);
            
            if (data) setLogs(data);
            if (error) console.error("Error fetching logs:", error);
        }
        setLoading(false);
    };

    const handleReportSubmit = async () => {
        if (!reportText.trim()) return showToast("Escribe qué pasó", "error");
        
        try {
            // 1. Enviar al Webhook de Discord
            const res = await fetch('/api/report', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    logId: reportingLog.id,
                    userId: user.id,
                    actionType: reportingLog.action_type,
                    details: reportingLog.details,
                    description: reportText
                })
            });

            if (!res.ok) throw new Error("Error enviando reporte");

            // 2. Marcar el log como 'reported' en la base de datos
            await supabase.from('action_logs').update({ status: 'reported' }).eq('id', reportingLog.id);

            showToast("Reporte enviado a los administradores. Lo revisaremos pronto.", "success");
            setLogs(logs.map(l => l.id === reportingLog.id ? { ...l, status: 'reported' } : l));
            setReportingLog(null);
            setReportText("");

        } catch (err) {
            showToast("Hubo un error al enviar el reporte", "error");
        }
    };

    if (loading) return <div className="min-h-screen bg-[#050505] text-white flex items-center justify-center font-black animate-pulse">CARGANDO HISTORIAL...</div>;

    return (
        <div className="min-h-[calc(100vh-80px)] bg-[#050505] text-white p-4 md:p-8">
            <div className="max-w-4xl mx-auto">
                <div className="flex items-center gap-4 mb-8 border-b border-[#222] pb-6">
                    <span className="text-5xl drop-shadow-[0_0_15px_rgba(255,255,255,0.5)]">📜</span>
                    <div>
                        <h1 className="text-4xl font-black uppercase tracking-widest text-cyan-500">Action History</h1>
                        <p className="text-gray-500 text-sm font-bold uppercase tracking-widest mt-1">Registro de todas tus transacciones. Reporta si perdiste algo.</p>
                    </div>
                </div>

                {logs.length === 0 ? (
                    <div className="text-center py-20 border-2 border-dashed border-[#222] rounded-3xl text-gray-600 font-black uppercase tracking-widest">
                        No hay registros todavía.
                    </div>
                ) : (
                    <div className="space-y-4">
                        {logs.map(log => (
                            <div key={log.id} className="bg-[#0a0a0a] border border-[#222] p-6 rounded-2xl flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:border-[#333] transition-colors">
                                <div>
                                    <div className="flex items-center gap-3 mb-2">
                                        <span className={`px-3 py-1 text-[10px] font-black uppercase tracking-widest rounded-md 
                                            ${log.action_type.includes('TRADE') ? 'bg-cyan-900/30 text-cyan-400' : 
                                              log.action_type.includes('DAYCARE') ? 'bg-red-900/30 text-red-400' : 
                                              'bg-green-900/30 text-green-400'}`}>
                                            {log.action_type}
                                        </span>
                                        <span className="text-gray-500 text-xs font-bold">{new Date(log.created_at).toLocaleString()}</span>
                                        {log.status === 'reported' && <span className="text-yellow-500 text-[10px] font-black tracking-widest uppercase border border-yellow-500 px-2 py-0.5 rounded">Reportado</span>}
                                    </div>
                                    <p className="text-sm text-gray-300 font-mono bg-[#111] p-3 rounded-lg border border-[#222] mt-2">
                                        {JSON.stringify(log.details)}
                                    </p>
                                </div>
                                
                                {log.status !== 'reported' && (
                                    <button 
                                        onClick={() => setReportingLog(log)}
                                        className="bg-red-900/20 text-red-500 border border-red-900/50 hover:bg-red-900/50 px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all whitespace-nowrap"
                                    >
                                        Reportar Fallo
                                    </button>
                                )}
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* MODAL DE REPORTE */}
            {reportingLog && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-fade-in">
                    <div className="bg-[#0a0a0a] border border-red-900 p-6 md:p-8 rounded-[2rem] w-full max-w-lg shadow-[0_0_50px_rgba(239,68,68,0.2)]">
                        <h2 className="text-2xl font-black text-red-500 uppercase tracking-widest mb-2">Reportar Problema</h2>
                        <p className="text-gray-400 text-xs uppercase tracking-widest mb-6 border-b border-[#222] pb-4">
                            Log ID: {reportingLog.id.split('-')[0]}...
                        </p>
                        
                        <label className="block text-gray-500 text-[10px] font-black uppercase tracking-widest mb-2">¿Qué pasó exactamente?</label>
                        <textarea 
                            className="w-full bg-[#111] border border-[#333] focus:border-red-500 rounded-xl p-4 text-white outline-none min-h-[120px] mb-6 custom-scrollbar text-sm"
                            placeholder="Ej: Metí mi mascota Flex al daycare y el internet parpadeó. La mascota desapareció de mi inventario pero no está en la guardería."
                            value={reportText}
                            onChange={(e) => setReportText(e.target.value)}
                        />

                        <div className="flex gap-4">
                            <button onClick={handleReportSubmit} className="flex-1 bg-red-600 hover:bg-red-500 text-white font-black uppercase tracking-widest py-4 rounded-xl transition-all">Enviar a Discord</button>
                            <button onClick={() => setReportingLog(null)} className="flex-1 bg-transparent border border-[#333] hover:bg-[#111] text-gray-400 font-black uppercase tracking-widest py-4 rounded-xl transition-all">Cancelar</button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
