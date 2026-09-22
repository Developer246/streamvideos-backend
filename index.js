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
    const videoId = req.params.id;
    const url = `yewtu.be/api/v1/videos/${videoId}`;

    const response = await fetch(url);
    const info = await response.json();

    const data = {
      id: videoId,
      title: info.title,
      author: info.author,
      views: info.viewCount,
      duration: info.lengthSeconds,
      thumbnail: info.videoThumbnails?.[0]?.url || null,
      videoStreams: info.videoStreams.map(v => ({
        quality: v.qualityLabel,
        mimeType: v.mimeType,
        url: v.url
      })),
      audioStreams: info.audioStreams.map(a => ({
        bitrate: a.bitrate,
        mimeType: a.mimeType,
        url: a.url
      }))
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error con Invidious:", error);
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
