const express = require('express');
const cors = require('cors');
const { Innertube, UniversalCache } = require('youtubei.js');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware para permitir peticiones desde el frontend
app.use(cors());

// Inicializar el cliente de YouTube
// Innertube crea una sesión única que simula ser un navegador
let youtube;

async function initYouTube() {
    try {
        // Creamos una instancia de Innertube
        youtube = await Innertube.create({
            cache: new UniversalCache(false), // Desactivar caché si necesitas datos siempre frescos
            generate_session_locally: true
        });
        console.log("YouTube client initialized successfully.");
    } catch (error) {
        console.error("Error initializing YouTube client:", error);
    }
}

// Inicializar al arrancar el servidor
initYouTube();

// Endpoint para obtener información de un video
app.get('/api/video-info/:id', async (req, res) => {
    try {
        const videoId = req.params.id;

        if (!youtube) {
            return res.status(503).json({ error: "Servicio de YouTube no disponible aún." });
        }

        // Buscar información del video
        const info = await youtube.getInfo(videoId);

        // Extraer datos relevantes
        const data = {
            title: info.basic_info.title,
            author: info.basic_info.author,
            views: info.basic_info.view_count,
            duration: info.basic_info.duration,
            description: info.basic_info.description,
            thumbnail: info.basic_info.thumbnail.url
        };

        res.json({ success: true, data });

    } catch (error) {
        console.error("Error fetching video info:", error);
        res.status(500).json({ 
            success: false, 
            error: "No se pudo obtener la información del video. Verifica el ID.",
            details: error.message 
        });
    }
});

app.get('/api/search/:query', async (req, res) => {
    try {
        if (!youtube) {
            return res.status(503).json({ error: "Servicio de YouTube no disponible aún." });
        }

        const query = req.params.query;
        
        // Realizar la búsqueda
        const searchResults = await youtube.search(query);

        // LOG DE DEPURACIÓN: Imprime la estructura completa en la consola del servidor
        // Esto nos ayuda a ver qué propiedades existen realmente
        console.log("Estructura de búsqueda:", JSON.stringify(searchResults, null, 2));

        // Intento 1: Buscar en 'results' (común en versiones recientes)
        let items = searchResults.results;

        // Intento 2: Si 'results' no existe o está vacío, buscar en 'contents'
        if (!items || items.length === 0) {
            items = searchResults.contents;
        }

        // Intento 3: Si sigue vacío, buscar dentro de 'contents[0].contents' (estructura anidada)
        if (!items || items.length === 0) {
            const firstContent = searchResults.contents && searchResults.contents[0];
            if (firstContent && firstContent.contents) {
                items = firstContent.contents;
            }
        }

        if (!items || items.length === 0) {
            return res.json({ success: true, results: [], message: "No se encontraron resultados. Verifica la estructura de la respuesta en la consola." });
        }

        // Mapear los resultados
        const results = items
            .filter(item => item && item.video) // Asegurar que el item tenga la propiedad video
            .map(item => {
                const videoData = item.video;
                return {
                    id: videoData.id,
                    title: videoData.title,
                    author: videoData.author,
                    thumbnail: videoData.thumbnails ? videoData.thumbnails[0].url : null,
                    duration: videoData.duration
                };
            })
            .slice(0, 10);

        res.json({ success: true, results });

    } catch (error) {
        console.error("Error detallado en la búsqueda:", error);
        res.status(500).json({ 
            success: false, 
            error: "Error en la búsqueda.", 
            details: error.message 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor backend escuchando en el puerto ${PORT}`);
});
