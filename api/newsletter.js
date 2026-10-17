const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xjwimhgdqcaqqadhhtnz.supabase.co";
const BUCKET = "newsletter-subscribers";

function cleanEmail(value) {
  return String(value || "").trim().toLowerCase().slice(0, 160);
}

function validEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function serviceKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\s+/g, "");
}

function headers(key) {
  return {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json"
  };
}

async function ensureBucket(key) {
  const response = await fetch(SUPABASE_URL + "/storage/v1/bucket", {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify({
      id: BUCKET,
      name: BUCKET,
      public: false
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
    return res.status(503).json({ error: "L’inscription est momentanément indisponible." });
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

  if (String(body.company || "").trim()) {
    return res.status(200).json({ ok: true });
  }

  const email = cleanEmail(body.email);
  if (!validEmail(email)) {
    return res.status(400).json({ error: "Indiquez une adresse e-mail valide." });
  }

  const file = email.replace(/[^a-z0-9]+/g, "_") + ".json";

  try {
    await ensureBucket(key);
    const response = await fetch(
      SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + file,
      {
        method: "POST",
        headers: Object.assign({}, headers(key), { "x-upsert": "true" }),
        body: JSON.stringify({
          email: email,
          created_at: new Date().toISOString()
        })
      }
    );
    if (!response.ok) {
      console.error("newsletter", response.status);
      return res.status(502).json({ error: "L’inscription n’a pas abouti. Réessayez." });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("newsletter");
    return res.status(502).json({ error: "L’inscription n’a pas abouti. Réessayez." });
  }
}
