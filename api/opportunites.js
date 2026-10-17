const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xjwimhgdqcaqqadhhtnz.supabase.co";
const PUBLISHABLE = "sb_publishable_gneCI14E-yANxMZOeBotww_K2snSohZ";
const BUCKET = "opportunites";
const TYPES = ["Stage", "Emploi", "Concours", "Appel à candidatures"];
const DOMAINES = ["Finance", "Gestion", "Économie"];

function serviceKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\s+/g, "");
}

function jsonHeaders(key) {
  return {
    apikey: key,
    Authorization: "Bearer " + key,
    "Content-Type": "application/json"
  };
}

function clean(value, max) {
  return String(value || "")
    .replace(/[\u0000-\u001f]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function safeLink(value) {
  try {
    const url = new URL(String(value || "").trim());
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString().slice(0, 500);
    }
  } catch (error) {
    return "";
  }
  return "";
}

function validDay(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value) && !Number.isNaN(new Date(value + "T00:00:00Z").getTime());
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
    headers: jsonHeaders(key),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false })
  });
  if (!response.ok) {
    const text = await response.text();
    if (!/exists|duplicate|already/i.test(text)) {
      throw new Error("bucket");
    }
  }
}

async function readAll(key) {
  const list = await fetch(SUPABASE_URL + "/storage/v1/object/list/" + BUCKET, {
    method: "POST",
    headers: jsonHeaders(key),
    body: JSON.stringify({
      prefix: "",
      limit: 80,
      offset: 0,
      sortBy: { column: "created_at", order: "desc" }
    })
  });
  if (list.status === 404) {
    return [];
  }
  if (!list.ok) {
    throw new Error("list");
  }
  const files = await list.json();
  const names = (Array.isArray(files) ? files : [])
    .map(function (file) { return file.name; })
    .filter(Boolean)
    .slice(0, 80);
  const items = [];
  for (const name of names) {
    const file = await fetch(
      SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + encodeURIComponent(name),
      { headers: jsonHeaders(key) }
    );
    if (!file.ok) {
      continue;
    }
    const data = await file.json().catch(function () { return null; });
    if (data && data.titre && data.lien) {
      items.push({
        id: name,
        titre: data.titre,
        organisme: data.organisme || "",
        type: data.type || "",
        domaine: data.domaine || "",
        date_limite: data.date_limite || "",
        lieu: data.lieu || "",
        lien: data.lien,
        resume: data.resume || "",
        created_at: data.created_at || ""
      });
    }
  }
  items.sort(function (a, b) {
    if (a.date_limite && b.date_limite) {
      return a.date_limite < b.date_limite ? -1 : 1;
    }
    if (a.date_limite) return -1;
    if (b.date_limite) return 1;
    return String(b.created_at).localeCompare(String(a.created_at));
  });
  return items;
}

export default async function handler(req, res) {
  const key = serviceKey();
  if (!key) {
    return res.status(503).json({ error: "Rubrique indisponible." });
  }

  if (req.method === "GET") {
    try {
      const items = await readAll(key);
      res.setHeader("Cache-Control", "no-store");
      return res.status(200).json({ opportunites: items });
    } catch (error) {
      console.error("opportunites");
      return res.status(502).json({ error: "Lecture impossible." });
    }
  }

  if (!(await reader(req))) {
    return res.status(401).json({ error: "Connexion requise." });
  }

  if (req.method === "DELETE") {
    const id = String(req.query.id || "");
    if (!/^[\w.-]+\.json$/.test(id)) {
      return res.status(400).json({ error: "Annonce introuvable." });
    }
    const response = await fetch(
      SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + encodeURIComponent(id),
      { method: "DELETE", headers: jsonHeaders(key) }
    );
    if (!response.ok && response.status !== 404) {
      return res.status(502).json({ error: "Suppression impossible." });
    }
    return res.status(200).json({ ok: true });
  }

  if (req.method !== "POST") {
    res.setHeader("Allow", "GET, POST, DELETE");
    return res.status(405).json({ error: "Méthode refusée." });
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

  const titre = clean(body.titre, 140);
  const organisme = clean(body.organisme, 120);
  const type = TYPES.indexOf(body.type) >= 0 ? body.type : "";
  const domaine = DOMAINES.indexOf(body.domaine) >= 0 ? body.domaine : "";
  const dateLimite = validDay(body.date_limite) ? body.date_limite : "";
  const lieu = clean(body.lieu, 80);
  const lien = safeLink(body.lien);
  const resume = String(body.resume || "").replace(/\u0000/g, "").trim().slice(0, 800);

  if (titre.length < 5 || !organisme || !type || !domaine || !lien || resume.length < 10) {
    return res.status(400).json({
      error: "Indiquez le titre, l’organisme, le type, le domaine, un lien et un court résumé."
    });
  }

  try {
    await ensureBucket(key);
    const file = Date.now() + "-" + Math.random().toString(36).slice(2, 8) + ".json";
    const response = await fetch(
      SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + file,
      {
        method: "POST",
        headers: jsonHeaders(key),
        body: JSON.stringify({
          titre: titre,
          organisme: organisme,
          type: type,
          domaine: domaine,
          date_limite: dateLimite,
          lieu: lieu,
          lien: lien,
          resume: resume,
          created_at: new Date().toISOString()
        })
      }
    );
    if (!response.ok) {
      console.error("opportunites", response.status);
      return res.status(502).json({ error: "L’enregistrement n’a pas abouti." });
    }
    return res.status(200).json({ ok: true });
  } catch (error) {
    console.error("opportunites");
    return res.status(502).json({ error: "L’enregistrement n’a pas abouti." });
  }
}
