const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xjwimhgdqcaqqadhhtnz.supabase.co";
const PUBLISHABLE = "sb_publishable_gneCI14E-yANxMZOeBotww_K2snSohZ";
const BUCKET = "newsletter-subscribers";

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

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Méthode refusée." });
  }

  const key = serviceKey();
  if (!key) {
    return res.status(503).json({ error: "Liste indisponible." });
  }
  if (!(await reader(req))) {
    return res.status(401).json({ error: "Connexion requise." });
  }

  const list = await fetch(SUPABASE_URL + "/storage/v1/object/list/" + BUCKET, {
    method: "POST",
    headers: serviceHeaders(key),
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
      { headers: serviceHeaders(key) }
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
