const express = require('express');
const cors = require('cors');
const { Innertube, UniversalCache } = require('youtubei.js');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

let youtube;

// Inicializar YouTube
async function initYouTube() {
    try {
        youtube = await Innertube.create({
            cache: new UniversalCache(false),
            generate_session_locally: true
        });

        console.log("YouTube client initialized successfully.");
    } catch (error) {
        console.error("Error initializing YouTube client:", error);
    }
}

initYouTube();

/* ============================================================
   GET VIDEO INFO
============================================================ */
app.get('/api/video-info/:id', async (req, res) => {
    try {
        if (!youtube) {
            return res.status(503).json({ error: "Servicio de YouTube no disponible aún." });
        }

        const videoId = req.params.id;
        const info = await youtube.getInfo(videoId);

        const data = {
            id: videoId,
            title: info.basic_info.title,
            author: info.basic_info.author,
            views: info.basic_info.view_count,
            duration: info.basic_info.duration,
            description: info.basic_info.description,
            thumbnail: info.basic_info.thumbnail?.[0]?.url || null
        };

        res.json({ success: true, data });

    } catch (error) {
        console.error("Error fetching video info:", error);
        res.status(500).json({
            success: false,
            error: "No se pudo obtener la información del video.",
            details: error.message
        });
    }
});

/* ============================================================
   SEARCH VIDEOS
============================================================ */
app.get('/api/search/:query', async (req, res) => {
    try {
        if (!youtube) {
            return res.status(503).json({ error: "Servicio de YouTube no disponible aún." });
        }

        const query = req.params.query;
        const searchResults = await youtube.search(query);

        // Los resultados vienen en searchResults.items
        const items = searchResults?.items || [];

        const videos = items
            .filter(item => item.type === 'Video') // Filtrar solo videos
            .map(video => ({
                id: video.id,
                title: video.title,
                author: video.author?.name || null,
                duration: video.duration || null,
                thumbnail: video.thumbnails?.[0]?.url || null
            }))
            .slice(0, 10);

        res.json({ success: true, results: videos });

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
