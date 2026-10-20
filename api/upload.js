const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xjwimhgdqcaqqadhhtnz.supabase.co";
const PUBLISHABLE = "sb_publishable_gneCI14E-yANxMZOeBotww_K2snSohZ";
const BUCKET = "article-images";

const IMAGE_TYPES = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

const DOC_TYPES = {
  "application/pdf": "pdf",
  "application/msword": "doc",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": "docx",
  "application/vnd.ms-excel": "xls",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": "xlsx",
  "text/plain": "txt",
  "application/rtf": "rtf",
  "text/rtf": "rtf"
};

const EXT_TYPES = {
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  txt: "text/plain",
  rtf: "application/rtf"
};

function serviceKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\s+/g, "");
}

function serviceHeaders(key) {
  return {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json"
  };
}

function safeFileName(value) {
  return String(value || "document")
    .replace(/[^\w.\- ()àâäéèêëïîôùûüçÀÂÄÉÈÊËÏÎÔÙÛÜÇ]+/gi, "_")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120) || "document";
}

function extOf(name) {
  const match = String(name || "").toLowerCase().match(/\.([a-z0-9]+)$/);
  return match ? match[1] : "";
}

async function reader(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) {
    return false;
  }
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: {
      apikey: PUBLISHABLE,
      Authorization: "Bearer " + token
    }
  });
  return response.ok;
}

async function ensureBucket(key) {
  const response = await fetch(SUPABASE_URL + "/storage/v1/bucket", {
    method: "POST",
    headers: serviceHeaders(key),
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: true
    })
  });
  if (!response.ok) {
    const text = await response.text();
    if (/exists|duplicate|already/i.test(text)) {
      return;
    }
    throw new Error("bucket");
  }
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST");
    return res.status(405).json({ error: "Méthode refusée." });
  }

  const key = serviceKey();
  if (!key) {
    return res.status(503).json({ error: "Dépôt de fichier indisponible." });
  }
  if (!(await reader(req))) {
    return res.status(401).json({ error: "Connexion requise." });
  }

  let body = req.body;
  if (typeof body === "string") {
    try {
      body = JSON.parse(body);
    } catch (error) {
      body = {};
    }
  }
  body = body || {};

  const kind = String(body.kind || "image").toLowerCase() === "document"
    ? "document"
    : "image";
  const match = String(body.data || "").match(
    /^data:([a-z0-9.+/-]+);base64,([A-Za-z0-9+/=\s]+)$/i
  );
  if (!match) {
    return res.status(400).json({
      error: kind === "document"
        ? "Choisissez un document PDF, Word, Excel ou texte."
        : "Choisissez une image JPEG, PNG ou WebP."
    });
  }

  let type = String(match[1] || "").toLowerCase();
  const originalName = safeFileName(body.name || "");
  const namedExt = extOf(originalName);

  if (kind === "image") {
    if (!IMAGE_TYPES[type]) {
      return res.status(400).json({ error: "Choisissez une image JPEG, PNG ou WebP." });
    }
  } else {
    if (!DOC_TYPES[type] && type === "application/octet-stream" && EXT_TYPES[namedExt]) {
      type = EXT_TYPES[namedExt];
    }
    if (!DOC_TYPES[type]) {
      return res.status(400).json({
        error: "Formats acceptés : PDF, Word, Excel, TXT, RTF."
      });
    }
  }

  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  const maxBytes = kind === "document" ? 2500000 : 1400000;
  if (!bytes.length || bytes.length > maxBytes) {
    return res.status(400).json({
      error: kind === "document"
        ? "Le document doit faire moins de 2,5 Mo."
        : "L’image doit faire moins de 1,4 Mo."
    });
  }

  const ext = kind === "image" ? IMAGE_TYPES[type] : DOC_TYPES[type];
  const stamp = Date.now() + "-" + Math.random().toString(36).slice(2, 8);
  const name = kind === "document"
    ? "docs/" + stamp + "." + ext
    : stamp + "." + ext;

  try {
    await ensureBucket(key);
    const response = await fetch(
      SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + name,
      {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: "Bearer " + key,
          "Content-Type": type,
          "x-upsert": "false"
        },
        body: bytes
      }
    );
    if (!response.ok) {
      console.error("upload", response.status);
      return res.status(502).json({
        error: kind === "document"
          ? "Le dépôt du document n’a pas abouti."
          : "Le dépôt de l’image n’a pas abouti."
      });
    }
    const url = SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/" + name;
    if (kind === "document") {
      const label = originalName || ("document." + ext);
      return res.status(200).json({
        url: url,
        name: label,
        type: type,
        size: bytes.length
      });
    }
    return res.status(200).json({ url: url });
  } catch (error) {
    console.error("upload");
    return res.status(502).json({
      error: kind === "document"
        ? "Le dépôt du document n’a pas abouti."
        : "Le dépôt de l’image n’a pas abouti."
    });
  }
}
