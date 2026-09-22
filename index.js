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
        res.status(500).json({ success: false, error: "No se pudo obtener la información del video.", details: error.message });
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

    const searchResults = await youtube.search(q);
    const items = searchResults?.results || [];

    const videos = items
      .filter(item => item.type === "LockupView" && item.content_type === "VIDEO")
      .map(item => {
        const meta = item.metadata;
        const rows = meta?.metadata?.metadata_rows || [];
        const texts = rows
          .flatMap(row => (row.metadata_parts || []).map(part => part.text?.toString()))
          .filter(Boolean);

        return {
          id:        item.content_id || null,
          title:     meta?.title?.toString() || "Sin título",
          author:    texts[0] || null,
          duration:  null, // si tu cliente provee duración, aquí la extraes
          thumbnail: item.content_image?.image?.[0]?.url || null,
        };
      })
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
