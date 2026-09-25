import express from "express";
import cors from "cors";
import { Innertube, UniversalCache } from "youtubei.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

let youtube;

async function initYouTube() {
  try {
    youtube = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true,
    });
    console.log("YouTube client initialized successfully.");
  } catch (error) {
    console.error("Error initializing YouTube client:", error);
  }
}

initYouTube();

app.get("/api/video/:id", async (req, res) => {
  try {
    const videoId = req.params.id;

    if (!youtube) {
      return res
        .status(503)
        .json({ success: false, error: "Servicio de YouTube no disponible aún." });
    }

    const info = await youtube.getInfo(videoId);

    // Chequeo de disponibilidad (privado, borrado, con restricción de edad, etc.)
    const playability = info.playability_status;
    if (playability && playability.status !== "OK") {
      return res.status(422).json({
        success: false,
        error: "El video no está disponible para reproducir.",
        details: playability.reason || playability.status,
      });
    }

    const basicInfo = info.basic_info;

    const formats = info.streaming_data?.formats || [];
    const adaptiveFormats = info.streaming_data?.adaptive_formats || [];
    const allFormats = [...formats, ...adaptiveFormats];

    // decipher() resuelve la URL real de reproducción usando el player actual.
    // Si alguna URL falla al decodificar, se descarta ese formato en vez de romper todo.
    const buildStream = (f, extra) => {
      try {
        const url = f.decipher(youtube.session.player);
        if (!url) return null;
        return { url, mimeType: f.mime_type, itag: f.itag, ...extra };
      } catch (e) {
        return null;
      }
    };

    const videoStreams = allFormats
      .filter((f) => f.has_video)
      .map((v) =>
        buildStream(v, {
          quality: v.quality_label || v.quality || null,
          fps: v.fps || null,
        })
      )
      .filter(Boolean);

    const audioStreams = allFormats
      .filter((f) => f.has_audio && !f.has_video)
      .map((a) =>
        buildStream(a, {
          bitrate: a.bitrate || a.average_bitrate || null,
        })
      )
      .filter(Boolean);

    const data = {
      id: videoId,
      title: basicInfo.title,
      author: basicInfo.author,
      views: basicInfo.view_count,
      duration: basicInfo.duration,
      thumbnail:
        basicInfo.thumbnail?.[basicInfo.thumbnail.length - 1]?.url ||
        basicInfo.thumbnail?.[0]?.url ||
        null,
      videoStreams,
      audioStreams,
    };

    res.json({ success: true, data });
  } catch (error) {
    console.error("❌ Error en /api/video:", error);
    res.status(500).json({
      success: false,
      error: "No se pudo extraer el video.",
      details: error.message,
    });
  }
});

app.get("/api/search/:query", async (req, res) => {
  try {
    const q = req.params.query?.trim();
    if (!q || q.length < 2) {
      return res.json({ success: true, results: [] });
    }

    if (!youtube) {
      return res
        .status(503)
        .json({ error: "Servicio de YouTube no disponible aún." });
    }

    const searchResults = await youtube.search(q, { type: "video" });
    const items = searchResults?.results || [];

    const videos = items
      .map((item) => ({
        id: item.id || item.videoId || null,
        title: item.title?.text || item.title || "Sin título",
        author: item.author?.name || null,
        duration: item.duration?.text || null,
        thumbnail: item.thumbnails?.[0]?.url || null,
      }))
      .slice(0, 10);

    res.json({ success: true, results: videos });
  } catch (error) {
    console.error("❌ Error en /api/search:", error.message);
    res.status(500).json({
      success: false,
      error: "Error en la búsqueda.",
      details: error.message,
    });
  }
});

app.listen(PORT, () => {
  console.log(`Servidor backend escuchando en el puerto ${PORT}`);
});
