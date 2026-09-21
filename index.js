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
        // Nota: 'search' puede devolver un objeto con resultados en diferentes propiedades
        const searchResults = await youtube.search(query);

        // Ajuste para manejar la estructura de datos de youtubei.js
        // Dependiendo de la versión, los resultados pueden estar en 'contents' o 'results'
        let contents = [];
        
        if (searchResults && searchResults.contents) {
            contents = searchResults.contents;
        } else if (searchResults && searchResults.results) {
            contents = searchResults.results;
        } else {
            throw new Error("Estructura de respuesta inesperada de YouTube.");
        }

        // Mapear los resultados con manejo de errores por elemento
        const results = contents
            .filter(item => item && item.video) // Filtrar elementos inválidos
            .map(item => {
                const videoData = item.video;
                return {
                    id: videoData.id || "unknown",
                    title: videoData.title || "Sin título",
                    author: videoData.author || "Autor desconocido",
                    thumbnail: videoData.thumbnails ? videoData.thumbnails[0].url : "https://via.placeholder.com/320x180?text=No+Thumbnail",
                    duration: videoData.duration || "0:00"
                };
            })
            .slice(0, 10); // Limitar a los 10 primeros resultados

        if (results.length === 0) {
             return res.json({ success: true, results: [], message: "No se encontraron resultados." });
        }

        res.json({ success: true, results });

    } catch (error) {
        console.error("Error detallado en la búsqueda:", error);
        res.status(500).json({ 
            success: false, 
            error: "Error en la búsqueda.", 
            details: error.message || "Error desconocido" 
        });
    }
});

app.listen(PORT, () => {
    console.log(`Servidor backend escuchando en el puerto ${PORT}`);
});
