const axios = require('axios');
const cheerio = require('cheerio');
const fs = require('fs');

async function obtenerPetsBGSI() {
    console.log("Iniciando escaneo de bgsi.gg...");
    try {
        // Hacemos una petición a la página de valores
        const { data } = await axios.get('https://bgsi.gg/values');
        const $ = cheerio.load(data);
        const petsGuardadas = [];

        // Buscamos todas las tarjetas de pets en su HTML
        // Nota: Estas clases ('.pet-name', etc.) asumen una estructura genérica.
        // Si no extrae nada, tendrías que inspeccionar bgsi.gg con F12 para ver qué clases exactas usan.
        $('.pet-card, .card').each((index, element) => {
            const nombre = $(element).find('.name, .pet-name').text().trim();
            const valorTexto = $(element).find('.value, .pet-value').text().trim();
            const imagen = $(element).find('img').attr('src');
            
            // Limpiar el valor para que sea un número real ("1.2K" -> 1200)
            let valorNumerico = 0;
            if (valorTexto.includes('K')) valorNumerico = parseFloat(valorTexto) * 1000;
            else if (valorTexto.includes('M')) valorNumerico = parseFloat(valorTexto) * 1000000;
            else valorNumerico = parseFloat(valorTexto.replace(/,/g, '')) || 0;

            if (nombre) {
                petsGuardadas.push({
                    id: index + 1,
                    nombre: nombre,
                    valor: valorNumerico,
                    img: imagen || '🐶', // Si no hay imagen, pone un emoji de respaldo
                    color: '#9ca3af' // Color por defecto
                });
            }
        });

        // Guardamos todo en un archivo JSON en tu proyecto
        fs.writeFileSync('pets_database.json', JSON.stringify(petsGuardadas, null, 2));
        console.log(`¡Éxito! Se guardaron ${petsGuardadas.length} pets en pets_database.json`);

    } catch (error) {
        console.error("Error al conectar con la página:", error.message);
    }
}

obtenerPetsBGSI();