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

const CFAO_FEED =
  "https://cfaocareers.talent-soft.com/handlers/offerRss.ashx?LCID=1036&Rss_JobFamily=2407&Rss_JobCountry=65";
const EMPLOI_FEEDS = [
  "https://www.emploi.ci/recherche-jobs-cote-ivoire?f%5B0%5D=im_field_offre_metiers%3A30",
  "https://www.emploi.ci/recherche-jobs-cote-ivoire?f%5B0%5D=im_field_offre_metiers%3A30&f%5B1%5D=im_field_offre_contrat_type%3A45"
];
const EDUCA_FEED = "https://emploi.educarriere.ci/page/all";

function decodeXml(value) {
  return String(value || "")
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1")
    .replace(/&#(\d+);/g, function (_, code) {
      return String.fromCharCode(Number(code));
    })
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function fold(value) {
  return String(value || "")
    .replace(/[àáâãä]/gi, "a")
    .replace(/[éèêë]/gi, "e")
    .replace(/[ïî]/gi, "i")
    .replace(/[ôö]/gi, "o")
    .replace(/[ùûü]/gi, "u")
    .replace(/ç/gi, "c")
    .toLowerCase();
}

function financeTitle(title) {
  const value = fold(title);
  if (/commercial|marketing|office manager|developpeur|informatique|gardien|enseignant|infograph|tele|logistique|approvisionnement|juridique/.test(value)) {
    return false;
  }
  return /comptab|financ|fiscal|audit|tresor|banque|bancaire|caiss|factur|credit|epargne|econom|budget|controleur|controle de gestion|business controller|analyste|\bdaf\b|\braf\b|\bcfo\b|risque|gestion/.test(value);
}

function offerType(text) {
  const value = fold(text);
  if (/concours/.test(value)) return "Concours";
  if (/appel a candidature/.test(value)) return "Appel à candidatures";
  if (/stage/.test(value)) return "Stage";
  return "Emploi";
}

function offerDomaine(title) {
  const value = fold(title);
  if (/econom/.test(value)) return "Économie";
  if (/gestion/.test(value) && !/financ|compta/.test(value)) return "Gestion";
  return "Finance";
}

function dayFromFr(value) {
  const match = String(value || "").match(/(\d{2})\/(\d{2})\/(\d{4})/);
  if (!match) return "";
  const day = match[3] + "-" + match[2] + "-" + match[1];
  return validDay(day) ? day : "";
}

function splitPlace(title) {
  const parts = String(title || "").split(" - ");
  if (parts.length < 2) return { titre: title, lieu: "Côte d'Ivoire" };
  const lieu = parts[parts.length - 1].trim();
  if (!lieu || lieu.length > 40) return { titre: title, lieu: "Côte d'Ivoire" };
  return { titre: parts.slice(0, -1).join(" - ").trim(), lieu: lieu };
}

async function fetchText(url, accept) {
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 8000);
  try {
    const response = await fetch(url, {
      headers: {
        Accept: accept,
        "User-Agent": "Mozilla/5.0 (compatible; LeFinancierIvoirien/1.0; +https://le-financier-ivoirien.vercel.app)"
      },
      signal: controller.signal
    });
    if (!response.ok) return "";
    return await response.text();
  } catch (error) {
    return "";
  } finally {
    clearTimeout(timer);
  }
}

function cfaoOffersFromXml(xml) {
  return String(xml)
    .split("<item>")
    .slice(1)
    .map(function (chunk) {
      const body = chunk.split("</item>")[0];
      const field = function (tag) {
        const match = body.match(new RegExp("<" + tag + ">([\\s\\S]*?)</" + tag + ">"));
        return match ? decodeXml(match[1]) : "";
      };
      const categories = [...body.matchAll(/<category>([\s\S]*?)<\/category>/g)].map(function (match) {
        return decodeXml(match[1]);
      });
      const metier = categories.find(function (item) { return item.indexOf("/") >= 0; }) || "";
      const contrat = categories.find(function (item) {
        return /^(Stage|CDI|CDD|Autre)$/i.test(item);
      }) || "";
      const lieu = categories.find(function (item) {
        return item !== metier && item !== contrat;
      }) || "Côte d'Ivoire";
      const link = field("link");
      const rawTitle = field("title");
      const parts = rawTitle.split(" - ");
      const titre = (parts.length > 1 ? parts.slice(1).join(" - ") : rawTitle).slice(0, 140);
      if (!titre || !link.startsWith("https://cfaocareers.talent-soft.com/")) {
        return null;
      }
      if (/juridique|avocat/i.test(metier) && !/comptab|finance|fiscal|audit|gestion/i.test(metier + " " + titre)) {
        return null;
      }
      const type = /stage/i.test(contrat + " " + titre) ? "Stage" : "Emploi";
      const domaine = /gestion/i.test(metier + " " + titre) ? "Gestion" : "Finance";
      const detail = (metier.split(" - ").pop() || "Finance").toLowerCase();
      return {
        id: "cfao-" + link.replace(/[^a-z0-9]+/gi, "").slice(-28),
        titre: titre,
        organisme: "CFAO",
        type: type,
        domaine: domaine,
        date_limite: "",
        lieu: lieu,
        lien: link,
        resume: type + " · " + detail + " · " + lieu + ". Annonce CFAO. La candidature se fait sur le site d’origine.",
        created_at: "",
        source: "CFAO",
        automatique: true
      };
    })
    .filter(Boolean);
}

function listedOffer(item) {
  const titre = clean(item.titre, 140);
  const organisme = clean(item.organisme, 120);
  const lieu = clean(item.lieu, 80) || "Côte d'Ivoire";
  const lien = safeLink(item.lien);
  if (titre.length < 5 || !organisme || !lien || !financeTitle(titre)) return null;
  const type = offerType((item.typeText || "") + " " + titre);
  const domaine = offerDomaine(titre);
  return {
    id: item.id,
    titre: titre,
    organisme: organisme,
    type: type,
    domaine: domaine,
    date_limite: item.date_limite || "",
    lieu: lieu,
    lien: lien,
    resume: type + " · " + organisme + " · " + lieu + ". Annonce " + item.source + ". La candidature se fait sur le site d’origine.",
    created_at: "",
    source: item.source,
    automatique: true
  };
}

function emploiOffersFromHtml(html) {
  return String(html)
    .split('class="card card-job"')
    .slice(1)
    .map(function (block) {
      const path = (block.match(/href="(\/offre-emploi-cote-ivoire\/[a-z0-9-]+)"/i) || [])[1] || "";
      const title = decodeXml((block.match(/<h3>\s*<a[^>]*>([\s\S]*?)<\/a>/) || [])[1] || "");
      const company = decodeXml((block.match(/class="card-job-company[^"]*">([\s\S]*?)<\/a>/) || [])[1] || "");
      const contract = decodeXml((block.match(/Contrat proposé[\s\S]{0,120}<strong>([\s\S]*?)<\/strong>/) || [])[1] || "");
      const place = splitPlace(title);
      const nid = (path.match(/(\d+)$/) || [])[1] || "";
      if (!path || !nid) return null;
      return listedOffer({
        id: "emploi-" + nid,
        titre: place.titre,
        organisme: company || "emploi.ci",
        lieu: place.lieu,
        lien: "https://www.emploi.ci" + path,
        typeText: contract + " " + title,
        source: "emploi.ci"
      });
    })
    .filter(Boolean);
}

function educaOffersFromHtml(html) {
  return String(html)
    .split('class="ej-card"')
    .slice(1)
    .map(function (block) {
      const link = (block.match(/href="(https:\/\/emploi\.educarriere\.ci\/offre-\d+[^"]*)"/) || [])[1] || "";
      const title = decodeXml((block.match(/class="ej-poste"[^>]*>([^<]+)/) || [])[1] || "");
      const company = decodeXml((block.match(/class="ej-societe"[^>]*>[\s\S]*?<\/i>\s*([^<]+)/) || [])[1] || "");
      const place = decodeXml((block.match(/fa-map-marker[\s\S]*?<\/i>\s*([^<]+)/) || [])[1] || "");
      const kind = decodeXml((block.match(/class="ej-tag[^"]*"[^>]*>([^<]+)/) || [])[1] || "");
      const deadline = (block.match(/class="ej-expire[^"]*"[^>]*>[\s\S]{0,180}?(\d{2}\/\d{2}\/\d{4})/) || [])[1] || "";
      const id = (link.match(/offre-(\d+)/) || [])[1] || "";
      if (!id) return null;
      return listedOffer({
        id: "educa-" + id,
        titre: title,
        organisme: company || "Educarriere",
        lieu: place || "Côte d'Ivoire",
        lien: link,
        typeText: kind + " " + title,
        date_limite: dayFromFr(deadline),
        source: "Educarriere"
      });
    })
    .filter(Boolean);
}

function takeOffers(items, max) {
  const seen = new Set();
  const unique = [];
  items.forEach(function (item) {
    if (!item || seen.has(item.lien)) return;
    seen.add(item.lien);
    unique.push(item);
  });
  return sortOffers(unique).slice(0, max);
}

async function cfaoOffers() {
  const xml = await fetchText(CFAO_FEED, "application/rss+xml, text/xml");
  return cfaoOffersFromXml(xml).slice(0, 12);
}

async function emploiOffers() {
  const pages = await Promise.all(EMPLOI_FEEDS.map(function (url) {
    return fetchText(url, "text/html");
  }));
  const items = [];
  pages.forEach(function (page) {
    emploiOffersFromHtml(page).forEach(function (item) { items.push(item); });
  });
  return takeOffers(items, 10);
}

async function educaOffers() {
  const html = await fetchText(EDUCA_FEED, "text/html");
  return takeOffers(educaOffersFromHtml(html), 10);
}

async function automaticOffers() {
  const groups = await Promise.all([cfaoOffers(), emploiOffers(), educaOffers()]);
  const items = [];
  groups.forEach(function (group) {
    group.forEach(function (item) { items.push(item); });
  });
  return items;
}

function sortOffers(items) {
  return items.sort(function (a, b) {
    if (a.type === "Stage" && b.type !== "Stage") return -1;
    if (b.type === "Stage" && a.type !== "Stage") return 1;
    if (a.date_limite && b.date_limite) {
      return a.date_limite < b.date_limite ? -1 : 1;
    }
    if (a.date_limite) return -1;
    if (b.date_limite) return 1;
    return String(b.created_at).localeCompare(String(a.created_at));
  });
}

export default async function handler(req, res) {
  const key = serviceKey();

  if (req.method === "GET") {
    let manual = [];
    if (key) {
      try {
        manual = await readAll(key);
      } catch (error) {
        console.error("opportunites");
      }
    }
    const remote = await automaticOffers();
    res.setHeader("Cache-Control", "public, max-age=300");
    return res.status(200).json({ opportunites: sortOffers(manual.concat(remote)) });
  }

  if (!key) {
    return res.status(503).json({ error: "Rubrique indisponible." });
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
