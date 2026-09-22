import express from 'express';
import cors from 'cors';
import { Innertube, UniversalCache } from 'youtubei.js';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

let youtube;

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

app.get('/api/video/:id', async (req, res) => {
  try {
    if (!youtube) {
      return res.status(503).json({ error: "Servicio de YouTube no disponible aún." });
    }

    const videoId = req.params.id;
    const stream = await youtube.download(videoId, {
      type: 'video+audio', // también puedes usar 'video' o 'audio'
      quality: 'best'      // o '720p', '1080p', etc.
    });

    // Configura headers para que el navegador lo interprete como video
    res.setHeader('Content-Type', 'video/mp4');

    // Pipea el stream directamente al response
    stream.pipe(res);

  } catch (error) {
    console.error("Error extrayendo video:", error);
    res.status(500).json({ success: false, error: "No se pudo extraer el video.", details: error.message });
  }
});



app.get("/api/search/:query", async (req, res) => {
  try {
    const q = req.params.query?.trim();
    if (!q || q.length < 2) {
      return res.json({ success: true, results: [] });
    }

    if (!youtube) {
      return res.status(503).json({ error: "Servicio de YouTube no disponible aún." });
    }

    const searchResults = await youtube.search(q, { type: "video" });
    const items = searchResults?.results || [];

    const videos = items
      .map(item => ({
        id:        item.id || item.videoId || null,
        title:     item.title?.text || item.title || "Sin título",
        author:    item.author?.name || null,
        duration:  item.duration?.text || null,
        thumbnail: item.thumbnails?.[0]?.url || null,
      }))
      .slice(0, 10);

    res.json({ success: true, results: videos });

  } catch (error) {
    console.error("❌ Error en /api/search:", error.message);
    res.status(500).json({ success: false, error: "Error en la búsqueda.", details: error.message });
  }
});


app.listen(PORT, () => {
    console.log(`Servidor backend escuchando en el puerto ${PORT}`);
});
