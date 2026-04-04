import { NextResponse } from 'next/server';
export const runtime = 'edge';

export async function POST(req) {
    try {
        const body = await req.json();
        const { logId, userId, actionType, details, description } = body;

        // Reemplaza esto con tu Webhook real de Discord
        const DISCORD_WEBHOOK_URL = "https://discord.com/api/webhooks/1489886211450605639/VM7L5-G5-5oPRjBj7_OHVlJ6ml__-sb_qgbLiFk0hfSCRSZAs8Z8SvKt2P08ZIouo9SN";

        const embed = {
            title: "🚨 NUEVO REPORTE DE BUG / PÉRDIDA DE ITEMS",
            color: 16711680, // Rojo
            fields: [
                { name: "User ID", value: userId, inline: false },
                { name: "Log ID (Referencia)", value: logId, inline: false },
                { name: "Acción", value: actionType, inline: true },
                { name: "Detalles Técnicos", value: `\`\`\`json\n${JSON.stringify(details, null, 2)}\n\`\`\``, inline: false },
                { name: "Comentario del Jugador", value: description, inline: false }
            ],
            timestamp: new Date().toISOString()
        };

        const response = await fetch(DISCORD_WEBHOOK_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ embeds: [embed] })
        });

        if (!response.ok) throw new Error("Fallo al enviar a Discord");

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error("Discord Webhook Error:", error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
