const { EmbedBuilder } = require('discord.js');

module.exports = {
    name: 'profile',
    description: 'Mira tu perfil, flexea tus mascotas limitadas y revisa tu Almanaque.',
    async execute(interaction, db) { // db es tu cliente de postgres/supabase
        await interaction.deferReply();
        const userId = interaction.user.id;

        try {
            // 1. Obtener datos del usuario (Stats base)
            // Asumiendo que tienes una tabla de usuarios con xp, nivel, rango
            const userQuery = await db.query('SELECT xp, level, rank FROM users WHERE id = $1', [userId]);
            let userData = userQuery.rows[0] || { xp: 0, level: 1, rank: 'Novato' };

            // -- FIX DE NIVELES (Punto 17) --
            // Fórmula exponencial para evitar que tengan niveles infinitos absurdos
            const xpBase = 1500;
            const multiplicador = 1.5;
            let nivelReal = 1;
            let xpAcumulada = userData.xp; 
            
            while (xpAcumulada >= Math.floor(xpBase * Math.pow(nivelReal, multiplicador))) {
                xpAcumulada -= Math.floor(xpBase * Math.pow(nivelReal, multiplicador));
                nivelReal++;
            }

            // 2. Obtener TODAS las mascotas de la base de datos (Para el Almanaque)
            const allItemsQuery = await db.query('SELECT id, name, is_limited FROM items ORDER BY value ASC');
            const allItems = allItemsQuery.rows;
            const totalPets = allItems.length;

            // 3. Obtener el inventario del usuario y cruzarlo con la tabla items
            // Asumiendo que tu tabla puente se llama 'inventory' (user_id, item_id, quantity)
            const userInventoryQuery = await db.query(`
                SELECT i.id, i.name, i.is_limited, i.color, i.total_minted, i.max_quantity, inv.quantity 
                FROM inventory inv 
                JOIN items i ON inv.item_id = i.id 
                WHERE inv.user_id = $1
            `, [userId]);
            const userPets = userInventoryQuery.rows;
            
            // Array con los IDs de las mascotas que el usuario ya desbloqueó
            const unlockedItemIds = userPets.map(pet => pet.id);
            const unlockedCount = unlockedItemIds.length;

            // 4. PREPARAR LA SECCIÓN: FLEX LIMITED PETS
            const limitedPets = userPets.filter(pet => pet.is_limited === true);
            let flexText = "";
            
            if (limitedPets.length === 0) {
                flexText = "```\nVacío. Aún no tienes mascotas limitadas para flexear. 🤡\n```";
            } else {
                flexText = limitedPets.map(pet => 
                    `👑 **${pet.name}** \n> 🎨 Color: ${pet.color} | 📦 Print: ${pet.quantity}/${pet.max_quantity || '∞'}`
                ).join('\n\n');
            }

            // 5. PREPARAR LA SECCIÓN: ALMANAQUE
            const porcentaje = totalPets > 0 ? Math.floor((unlockedCount / totalPets) * 100) : 0;
            
            // Creamos una visualización tipo Pokédex (mostrando algunas y "???" en las bloqueadas)
            // Limitamos a las primeras 15 para no saturar el embed de Discord
            let almanacDisplay = allItems.slice(0, 15).map(item => {
                if (unlockedItemIds.includes(item.id)) {
                    return `✅ **${item.name}**`;
                } else {
                    return `🔒 *???*`;
                }
            }).join('\n');

            if (totalPets > 15) {
                almanacDisplay += `\n...y ${totalPets - 15} más.`;
            }

            // 6. CONSTRUIR EL EMBED DEL PERFIL
            const profileEmbed = new EmbedBuilder()
                .setColor('#2B2D31') // Color limpio y elegante
                .setTitle(`👤 Perfil de ${interaction.user.username}`)
                .setThumbnail(interaction.user.displayAvatarURL({ dynamic: true, size: 256 }))
                .addFields(
                    { 
                        name: '📊 Estadísticas', 
                        value: `**Nivel:** ${nivelReal}\n**Rango:** ${userData.rank}\n**XP Actual:** ${xpAcumulada} / ${Math.floor(xpBase * Math.pow(nivelReal, multiplicador))}`, 
                        inline: false 
                    },
                    { 
                        name: '✨ Limited Pets (Showcase)', 
                        value: flexText, 
                        inline: false 
                    },
                    { 
                        name: `📖 Almanaque de Mascotas [${unlockedCount}/${totalPets}] (${porcentaje}%)`, 
                        value: almanacDisplay, 
                        inline: false 
                    }
                )
                .setFooter({ text: 'El inventario y tus monedas están en el comando /wallet' });

            await interaction.editReply({ embeds: [profileEmbed] });

        } catch (error) {
            console.error(error);
            await interaction.editReply({ content: 'Hubo un error cargando tu perfil. Revisa la consola cabrón.' });
        }
    }
};
