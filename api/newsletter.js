const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xjwimhgdqcaqqadhhtnz.supabase.co";
const PUBLISHABLE = "sb_publishable_gneCI14E-yANxMZOeBotww_K2snSohZ";
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

async function listSubscribers(req, res) {
  const key = serviceKey();
  if (!key) {
    return res.status(503).json({ error: "Liste indisponible." });
  }
  if (!(await reader(req))) {
    return res.status(401).json({ error: "Connexion requise." });
  }

  const list = await fetch(SUPABASE_URL + "/storage/v1/object/list/" + BUCKET, {
    method: "POST",
    headers: headers(key),
    body: JSON.stringify({
      prefix: "",
      limit: 100,
      offset: 0,
      sortBy: { column: "created_at", order: "desc" }
    })
  });

  if (list.status === 404) {
    return res.status(200).json({ subscribers: [] });
  }
  if (!list.ok) {
    return res.status(502).json({ error: "Lecture impossible." });
  }

  const files = await list.json();
  const names = (Array.isArray(files) ? files : [])
    .map(function (file) {
      return file.name;
    })
    .filter(Boolean)
    .slice(0, 100);

  const subscribers = [];
  for (const name of names) {
    const file = await fetch(
      SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + encodeURIComponent(name),
      { headers: headers(key) }
    );
    if (!file.ok) {
      continue;
    }
    const data = await file.json().catch(function () {
      return null;
    });
    if (data && data.email) {
      subscribers.push({
        email: data.email,
        created_at: data.created_at || ""
      });
    }
  }

  return res.status(200).json({ subscribers: subscribers });
}

export default async function handler(req, res) {
  if (req.method === "GET") {
    return listSubscribers(req, res);
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST");
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
