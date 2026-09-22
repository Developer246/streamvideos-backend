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
    const info = await youtube.getInfo(videoId);

    // Streams disponibles
    const formats = info.streaming_data?.formats || [];
    const adaptiveFormats = info.streaming_data?.adaptive_formats || [];

    const data = {
      id: videoId,
      title: info.basic_info.title,
      author: info.basic_info.author,
      views: info.basic_info.view_count,
      duration: info.basic_info.duration,
      description: info.basic_info.description,
      thumbnail: info.basic_info.thumbnail?.[0]?.url || null,
      // URLs directas de los streams
      formats: formats.map(f => ({
        quality: f.quality_label,
        mimeType: f.mime_type,
        url: f.url
      })),
      adaptiveFormats: adaptiveFormats.map(f => ({
        type: f.mime_type,
        bitrate: f.bitrate,
        url: f.url
      }))
    };

    res.json({ success: true, data });
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
