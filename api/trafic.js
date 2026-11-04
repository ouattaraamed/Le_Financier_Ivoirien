const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xjwimhgdqcaqqadhhtnz.supabase.co";
const PUBLISHABLE = "sb_publishable_gneCI14E-yANxMZOeBotww_K2snSohZ";
const BUCKET = "trafic";

const PAGES = {
  "/": "Accueil",
  "/brvm": "Marchés & Bourse",
  "/banques": "Banques & Finance",
  "/entreprises": "Entreprises",
  "/economie": "Économie",
  "/afrique": "Afrique & International",
  "/investissement": "Investissement",
  "/actualites": "Actualités",
  "/tribune": "Tribune libre",
  "/etudiants": "Étudiants",
  "/portraits": "Portraits & Interviews",
  "/a-propos": "À propos",
  "/contact": "Contact",
  "/mentions-legales": "Mentions légales"
};

function serviceKey() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\s+/g, "");
}

function authHeaders(key) {
  return {
    apikey: key,
    Authorization: "Bearer " + key
  };
}

function dayKey() {
  return new Date().toISOString().slice(0, 10);
}

function emptyCount() {
  return { views: 0, pages: {}, posts: {} };
}

function addCount(target, field, keyName) {
  if (!target[field] || typeof target[field] !== "object") {
    target[field] = {};
  }
  target[field][keyName] = (Number(target[field][keyName]) || 0) + 1;
}

function countView(target, page) {
  target.views += 1;
  if (page.post) addCount(target, "posts", page.post);
  else addCount(target, "pages", page.path);
}

function pageOf(raw) {
  let value = String(raw || "").trim();
  if (!value || value.length > 180) return null;
  let url;
  try {
    url = new URL(value, "https://lefinancierivoirien.com");
  } catch (error) {
    return null;
  }
  let path = url.pathname || "/";
  if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
  path = path.replace(/\.html$/i, "") || "/";
  if (path === "/index") path = "/";
  if (path === "/article") {
    const id = url.searchParams.get("id") || "";
    if (!/^\d{1,8}$/.test(id)) return null;
    return { path: "/article?id=" + id, post: id };
  }
  if (path.startsWith("/admin") || path.startsWith("/api")) return null;
  if (path !== "/" && !/^\/[a-z0-9-]{1,40}$/.test(path)) return null;
  return { path: path, post: "" };
}

function isBot(req) {
  const ua = String(req.headers["user-agent"] || "");
  return /bot|crawl|spider|slurp|preview|headless|lighthouse|wget|curl|python|go-http/i.test(ua);
}

async function ensureBucket(key) {
  const response = await fetch(SUPABASE_URL + "/storage/v1/bucket", {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders(key)),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false })
  });
  if (response.ok) return;
  const text = await response.text();
  if (/exists|duplicate|already/i.test(text)) return;
  throw new Error("bucket " + response.status);
}

async function readJson(key, path) {
  const response = await fetch(
    SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + path,
    { headers: authHeaders(key) }
  );
  if (response.status === 400 || response.status === 404) return null;
  if (!response.ok) return null;
  const data = await response.json().catch(function () {
    return null;
  });
  if (!data || typeof data !== "object") return null;
  return {
    views: Number(data.views) || 0,
    pages: data.pages && typeof data.pages === "object" ? data.pages : {},
    posts: data.posts && typeof data.posts === "object" ? data.posts : {}
  };
}

async function writeJson(key, path, data) {
  const response = await fetch(
    SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + path,
    {
      method: "POST",
      headers: Object.assign(
        { "Content-Type": "application/json", "x-upsert": "true" },
        authHeaders(key)
      ),
      body: JSON.stringify(data)
    }
  );
  return response.ok;
}

async function reader(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token) return false;
  const response = await fetch(SUPABASE_URL + "/auth/v1/user", {
    headers: {
      apikey: PUBLISHABLE,
      Authorization: "Bearer " + token
    }
  });
  return response.ok;
}

async function record(key, page) {
  await ensureBucket(key);
  const day = dayKey();
  const dailyPath = "days/" + day + ".json";
  const daily = (await readJson(key, dailyPath)) || emptyCount();
  const totals = (await readJson(key, "totals.json")) || emptyCount();
  countView(daily, page);
  countView(totals, page);
  await writeJson(key, dailyPath, daily);
  await writeJson(key, "totals.json", totals);
}

async function listDays(key) {
  const response = await fetch(SUPABASE_URL + "/storage/v1/object/list/" + BUCKET, {
    method: "POST",
    headers: Object.assign({ "Content-Type": "application/json" }, authHeaders(key)),
    body: JSON.stringify({
      prefix: "days/",
      limit: 100,
      offset: 0,
      sortBy: { column: "name", order: "desc" }
    })
  });
  if (!response.ok) return [];
  const files = await response.json();
  return (Array.isArray(files) ? files : [])
    .map(function (file) {
      return String(file.name || "").replace(/^days\//, "");
    })
    .filter(function (name) {
      return /^\d{4}-\d{2}-\d{2}\.json$/.test(name);
    })
    .sort()
    .reverse();
}

async function titlesFor(ids) {
  if (!ids.length) return {};
  const response = await fetch(
    SUPABASE_URL + "/rest/v1/Articles?select=id,titre&id=in.(" + ids.join(",") + ")",
    {
      headers: {
        apikey: PUBLISHABLE,
        Authorization: "Bearer " + PUBLISHABLE
      }
    }
  );
  if (!response.ok) return {};
  const rows = await response.json().catch(function () {
    return [];
  });
  const map = {};
  (Array.isArray(rows) ? rows : []).forEach(function (row) {
    map[String(row.id)] = row.titre || "";
  });
  return map;
}

function ranked(source, limit) {
  return Object.keys(source || {})
    .map(function (key) {
      return { key: key, views: Number(source[key]) || 0 };
    })
    .filter(function (item) {
      return item.views > 0;
    })
    .sort(function (a, b) {
      return b.views - a.views;
    })
    .slice(0, limit);
}

async function report(key) {
  await ensureBucket(key);
  const names = await listDays(key);
  const days = [];
  for (const name of names.slice(0, 30)) {
    const data = await readJson(key, "days/" + name);
    days.push({
      date: name.replace(".json", ""),
      views: data ? data.views : 0
    });
  }
  const totals = (await readJson(key, "totals.json")) || emptyCount();
  const week = days.slice(0, 7).reduce(function (sum, day) {
    return sum + day.views;
  }, 0);
  const month = days.reduce(function (sum, day) {
    return sum + day.views;
  }, 0);
  const postRanks = ranked(totals.posts, 30);
  const titleMap = await titlesFor(postRanks.map(function (item) {
    return item.key;
  }));
  return {
    week: week,
    month: month,
    total: totals.views,
    days: days,
    pages: ranked(totals.pages, 20).map(function (item) {
      return {
        path: item.key,
        label: PAGES[item.key] || (item.key.indexOf("/article?id=") === 0 ? "Article" : item.key),
        views: item.views
      };
    }),
    posts: postRanks.map(function (item) {
      return {
        id: item.key,
        titre: titleMap[item.key] || "Article " + item.key,
        views: item.views
      };
    })
  };
}

export default async function handler(req, res) {
  res.setHeader("Cache-Control", "no-store");
  const key = serviceKey();
  if (!key) {
    if (req.method === "POST") return res.status(204).end();
    return res.status(503).json({ error: "Trafic indisponible." });
  }

  if (req.method === "POST") {
    if (isBot(req)) return res.status(204).end();
    let body = req.body;
    if (Buffer.isBuffer(body)) {
      body = body.toString("utf8");
    }
    if (typeof body === "string") {
      try {
        body = JSON.parse(body);
      } catch (error) {
        body = {};
      }
    }
    const page = pageOf(body && body.path);
    if (!page) return res.status(204).end();
    try {
      await record(key, page);
    } catch (error) {
      console.error(error);
    }
    return res.status(204).end();
  }

  if (req.method === "GET") {
    if (!(await reader(req))) {
      return res.status(401).json({ error: "Connexion requise." });
    }
    try {
      return res.status(200).json(await report(key));
    } catch (error) {
      console.error(error);
      return res.status(502).json({ error: "Lecture impossible." });
    }
  }

  res.setHeader("Allow", "GET, POST");
  return res.status(405).json({ error: "Méthode refusée." });
}
