import express from "express";
import cors from "cors";
import { Innertube, UniversalCache } from "youtubei.js";
import { generate as generatePoToken } from "youtube-po-token-generator";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());

let youtube;

// YouTube exige un PO Token (Proof of Origin) para aceptar peticiones desde
// IPs de datacenter (Render, Railway, VPS, etc). Sin esto, /player y /next
// responden 403 aunque el código esté bien. Lo generamos con jsdom (sin
// necesitar un navegador real) y se lo pasamos a Innertube.
async function initYouTube() {
  try {
    const { visitorData, poToken } = await generatePoToken();

    youtube = await Innertube.create({
      cache: new UniversalCache(false),
      generate_session_locally: true,
      visitor_data: visitorData,
      po_token: poToken,
    });

    console.log("YouTube client initialized successfully (con PO Token).");
  } catch (error) {
    console.error("Error initializing YouTube client:", error);
  }
}

initYouTube();

// El PO Token expira; regeneramos el cliente cada 5 horas para no quedarnos
// con una sesión muerta en producción.
setInterval(initYouTube, 5 * 60 * 60 * 1000);

app.get("/api/video/:id", async (req, res) => {
  try {
    const videoId = req.params.id;

    if (!youtube) {
      return res
        .status(503)
        .json({ success: false, error: "Servicio de YouTube no disponible aún." });
    }

    // getBasicInfo solo llama al endpoint /player (streams + metadata básica).
    // getInfo también llama a /next (relacionados, comentarios, etc.), que en
    // muchos hosts (IPs de datacenter) YouTube bloquea con 403.
    const info = await youtube.getBasicInfo(videoId);

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

    // decipher() resuelve la URL real de reproducción usando el player actual
    // (en versiones recientes de youtubei.js es asíncrono, por eso el await).
    // Si alguna URL falla al decodificar, se descarta ese formato en vez de
    // romper toda la respuesta.
    const buildStream = async (f, extra) => {
      try {
        const url = await f.decipher(youtube.session.player);
        if (!url) return null;
        return { url, mimeType: f.mime_type, itag: f.itag, ...extra };
      } catch (e) {
        return null;
      }
    };

    const videoStreams = (
      await Promise.all(
        allFormats
          .filter((f) => f.has_video)
          .map((v) =>
            buildStream(v, {
              quality: v.quality_label || v.quality || null,
              fps: v.fps || null,
            })
          )
      )
    ).filter(Boolean);

    const audioStreams = (
      await Promise.all(
        allFormats
          .filter((f) => f.has_audio && !f.has_video)
          .map((a) =>
            buildStream(a, {
              bitrate: a.bitrate || a.average_bitrate || null,
            })
          )
      )
    ).filter(Boolean);

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
