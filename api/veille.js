import { parseIndices, parseActions, updatedAt, load, PAGES } from "./brvm.js";
import { parseList, fetchText } from "./bceao.js";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xjwimhgdqcaqqadhhtnz.supabase.co";
const PUBLISHABLE = "sb_publishable_gneCI14E-yANxMZOeBotww_K2snSohZ";
const BUCKET = "veille-brouillons";
const FICHIER = "brouillons.json";
const IMAGE_BCEAO = "https://lefinancierivoirien.com/bceao-logo.png";

function cleService() {
  return String(process.env.SUPABASE_SERVICE_ROLE_KEY || "").replace(/\s+/g, "");
}

function entetes(cle) {
  return {
    apikey: cle,
    Authorization: "Bearer " + cle,
    "Content-Type": "application/json"
  };
}

function jourAbidjan() {
  return new Intl.DateTimeFormat("fr-CA", {
    timeZone: "Africa/Abidjan",
    year: "numeric",
    month: "2-digit",
    day: "2-digit"
  }).format(new Date());
}

function dateLongue(iso) {
  const parts = String(iso || "").split("-").map(Number);
  if (parts.length !== 3 || parts.some(function (n) { return !n; })) {
    return iso;
  }
  return new Date(Date.UTC(parts[0], parts[1] - 1, parts[2])).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC"
  });
}

function nombre(valeur) {
  const n = parseFloat(String(valeur || "").replace(/\s/g, "").replace("%", "").replace(",", "."));
  return Number.isFinite(n) ? n : null;
}

async function lecteur(req) {
  const header = req.headers.authorization || "";
  const token = header.startsWith("Bearer ") ? header.slice(7).trim() : "";
  if (!token || token === process.env.CRON_SECRET) {
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

function tacheCron(req) {
  return String(req.headers["x-vercel-cron"] || "") === "1";
}

async function assurerBucket(cle) {
  const response = await fetch(SUPABASE_URL + "/storage/v1/bucket", {
    method: "POST",
    headers: entetes(cle),
    body: JSON.stringify({ id: BUCKET, name: BUCKET, public: false })
  });
  if (!response.ok) {
    const text = await response.text();
    if (!/exists|duplicate|already/i.test(text)) {
      throw new Error("bucket");
    }
  }
}

async function lireBrouillons(cle) {
  const response = await fetch(
    SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + FICHIER,
    { headers: { apikey: cle, Authorization: "Bearer " + cle } }
  );
  if (response.status === 400 || response.status === 404) {
    return [];
  }
  if (!response.ok) {
    throw new Error("lecture");
  }
  const data = await response.json();
  return Array.isArray(data) ? data : [];
}

async function ecrireBrouillons(cle, brouillons) {
  const response = await fetch(
    SUPABASE_URL + "/storage/v1/object/" + BUCKET + "/" + FICHIER,
    {
      method: "POST",
      headers: Object.assign({ "x-upsert": "true" }, entetes(cle)),
      body: JSON.stringify(brouillons)
    }
  );
  if (!response.ok) {
    throw new Error("ecriture");
  }
}

async function dejaPublie(cle) {
  const response = await fetch(
    SUPABASE_URL +
      "/rest/v1/Articles?select=titre,contenu&order=created_at.desc&limit=80",
    { headers: entetes(cle) }
  );
  if (!response.ok) {
    return [];
  }
  const rows = await response.json();
  return Array.isArray(rows) ? rows : [];
}

function pointBrvm(indices, actions, seance) {
  const composite = indices.find(function (item) {
    return /composite/i.test(item.name);
  });
  const trente = indices.find(function (item) {
    return /brvm\s*30/i.test(item.name);
  });
  const lignes = [
    "Lecture des cours officiels de la BRVM" + (seance ? ", séance indiquée : " + seance + "." : "."),
    ""
  ];
  if (composite) {
    lignes.push("BRVM Composite : " + composite.last + " (" + composite.change + ").");
  }
  if (trente) {
    lignes.push("BRVM 30 : " + trente.last + " (" + trente.change + ").");
  }
  const mouvements = actions
    .map(function (action) {
      return { action: action, ecart: nombre(action.change) };
    })
    .filter(function (item) {
      return item.ecart !== null && item.action.symbol;
    })
    .sort(function (a, b) {
      return b.ecart - a.ecart;
    });
  const hausse = mouvements[0];
  const baisse = mouvements[mouvements.length - 1];
  if (hausse && hausse.ecart > 0) {
    lignes.push(
      "",
      "Plus forte hausse relevée : " + hausse.action.name + " (" + hausse.action.symbol + "), " +
        hausse.action.last + ", " + hausse.action.change + "."
    );
  }
  if (baisse && baisse.ecart < 0 && (!hausse || baisse.action.symbol !== hausse.action.symbol)) {
    lignes.push(
      "Plus forte baisse relevée : " + baisse.action.name + " (" + baisse.action.symbol + "), " +
        baisse.action.last + ", " + baisse.action.change + "."
    );
  }
  lignes.push(
    "",
    "Source : https://www.brvm.org/fr/indices",
    "Les chiffres sont ceux publiés par la Bourse. À relire avant publication."
  );
  return lignes.join("\n");
}

async function brouillonBrvm(connus) {
  const [actionsHtml, indicesHtml] = await Promise.all([
    load(PAGES.actions),
    load(PAGES.indices)
  ]);
  const indices = parseIndices(indicesHtml);
  const actions = parseActions(actionsHtml);
  if (!indices.length && !actions.length) {
    return null;
  }
  const jour = jourAbidjan();
  const id = "brvm-" + jour;
  const titre = "Point BRVM du " + dateLongue(jour);
  if (connus.some(function (row) {
    return row.titre === titre;
  })) {
    return null;
  }
  return {
    id: id,
    titre: titre,
    categorie: "Marchés & Bourse",
    auteur: "La rédaction",
    image_url: "",
    contenu: pointBrvm(indices, actions, updatedAt(actionsHtml) || updatedAt(indicesHtml)),
    source: "https://www.brvm.org/fr/indices",
    creeLe: new Date().toISOString()
  };
}

function noteBceao(item) {
  return [
    "La BCEAO a publié le " + item.date + " un communiqué : « " + item.title + " ».",
    "",
    "Le texte officiel n'est pas recopié ici. Il se lit sur le site de la Banque.",
    "",
    "Source officielle : " + item.url
  ].join("\n");
}

async function brouillonsBceao(connus) {
  const html = await fetchText("https://www.bceao.int/fr/communique-presse");
  const listed = parseList(html).slice(0, 4);
  return listed.filter(function (item) {
    return !connus.some(function (row) {
      return String(row.contenu || "").indexOf(item.url) !== -1 || row.titre === item.title;
    });
  }).map(function (item) {
    return {
      id: "bceao-" + item.url.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").slice(-70),
      titre: item.title,
      categorie: "Banques & Finance",
      auteur: "La rédaction",
      image_url: IMAGE_BCEAO,
      contenu: noteBceao(item),
      source: item.url,
      creeLe: new Date().toISOString()
    };
  });
}

async function actualiser(cle) {
  await assurerBucket(cle);
  const actuels = await lireBrouillons(cle);
  const connus = actuels.concat(await dejaPublie(cle));
  const ajouts = [];
  try {
    const brvm = await brouillonBrvm(connus);
    if (brvm && !actuels.some(function (item) { return item.id === brvm.id; })) {
      ajouts.push(brvm);
    }
  } catch (error) {
    console.error(error);
  }
  try {
    const bceao = await brouillonsBceao(connus.concat(ajouts));
    bceao.forEach(function (item) {
      if (!actuels.some(function (row) { return row.id === item.id; })) {
        ajouts.push(item);
      }
    });
  } catch (error) {
    console.error(error);
  }
  const tous = ajouts.concat(actuels).slice(0, 30);
  await ecrireBrouillons(cle, tous);
  return tous;
}

async function publier(cle, id) {
  const brouillons = await lireBrouillons(cle);
  const choix = brouillons.find(function (item) { return item.id === id; });
  if (!choix) {
    return { error: "Brouillon introuvable.", status: 404 };
  }
  const response = await fetch(SUPABASE_URL + "/rest/v1/Articles", {
    method: "POST",
    headers: Object.assign({ Prefer: "return=minimal" }, entetes(cle)),
    body: JSON.stringify({
      titre: choix.titre,
      categorie: choix.categorie,
      auteur: choix.auteur,
      image_url: choix.image_url || "",
      contenu: choix.contenu
    })
  });
  if (!response.ok) {
    return { error: "Publication impossible.", status: 502 };
  }
  await ecrireBrouillons(cle, brouillons.filter(function (item) { return item.id !== id; }));
  return { ok: true };
}

export default async function handler(req, res) {
  const cle = cleService();
  if (!cle) {
    return res.status(503).json({ error: "Veille indisponible." });
  }

  const cron = tacheCron(req);
  const admin = cron ? false : await lecteur(req);
  if (!cron && !admin) {
    return res.status(401).json({ error: "Connexion requise." });
  }

  try {
    if (req.method === "GET") {
      const brouillons = cron ? await actualiser(cle) : await lireBrouillons(cle);
      return res.status(200).json({ brouillons: brouillons });
    }

    if (req.method !== "POST") {
      return res.status(405).json({ error: "Méthode refusée." });
    }

    const body = typeof req.body === "string" ? JSON.parse(req.body || "{}") : (req.body || {});
    if (body.action === "actualiser") {
      const brouillons = await actualiser(cle);
      return res.status(200).json({ brouillons: brouillons });
    }
    if (body.action === "ecarter") {
      const brouillons = (await lireBrouillons(cle)).filter(function (item) {
        return item.id !== body.id;
      });
      await ecrireBrouillons(cle, brouillons);
      return res.status(200).json({ brouillons: brouillons });
    }
    if (body.action === "publier") {
      const resultat = await publier(cle, body.id);
      if (resultat.error) {
        return res.status(resultat.status).json({ error: resultat.error });
      }
      return res.status(200).json({ brouillons: await lireBrouillons(cle) });
    }
    return res.status(400).json({ error: "Action inconnue." });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "La veille n'a pas abouti." });
  }
}
