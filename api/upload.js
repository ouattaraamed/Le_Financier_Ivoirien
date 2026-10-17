const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xjwimhgdqcaqqadhhtnz.supabase.co";
const PUBLISHABLE = "sb_publishable_gneCI14E-yANxMZOeBotww_K2snSohZ";
const BUCKET = "article-images";

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
    return res.status(503).json({ error: "Dépôt d’image indisponible." });
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

  const match = String(body.data || "").match(
    /^data:(image\/(?:jpeg|png|webp));base64,([A-Za-z0-9+/=\s]+)$/
  );
  if (!match) {
    return res.status(400).json({ error: "Choisissez une image JPEG, PNG ou WebP." });
  }

  const type = match[1];
  const bytes = Buffer.from(match[2].replace(/\s/g, ""), "base64");
  if (!bytes.length || bytes.length > 1400000) {
    return res.status(400).json({ error: "L’image doit faire moins de 1,4 Mo." });
  }

  const ext = type === "image/png" ? "png" : type === "image/webp" ? "webp" : "jpg";
  const name = Date.now() + "-" + Math.random().toString(36).slice(2, 8) + "." + ext;

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
      return res.status(502).json({ error: "Le dépôt de l’image n’a pas abouti." });
    }
    return res.status(200).json({
      url: SUPABASE_URL + "/storage/v1/object/public/" + BUCKET + "/" + name
    });
  } catch (error) {
    console.error("upload");
    return res.status(502).json({ error: "Le dépôt de l’image n’a pas abouti." });
  }
}
