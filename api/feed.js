function xmlEscape(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function isoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
}

const SITE = "https://lefinancierivoirien.com";
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xjwimhgdqcaqqadhhtnz.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_gneCI14E-yANxMZOeBotww_K2snSohZ";

const PAGES = [
  ["/", "daily", "1.0"],
  ["/brvm", "daily", "0.8"],
  ["/banques", "daily", "0.8"],
  ["/entreprises", "daily", "0.8"],
  ["/economie", "daily", "0.8"],
  ["/afrique", "daily", "0.8"],
  ["/investissement", "daily", "0.8"],
  ["/actualites", "daily", "0.8"],
  ["/etudiants", "daily", "0.8"],
  ["/portraits", "weekly", "0.8"],
  ["/a-propos", "monthly", "0.5"],
  ["/contact", "monthly", "0.5"],
  ["/mentions-legales", "yearly", "0.3"]
];

function headers() {
  return {
    apikey: SUPABASE_KEY,
    Authorization: "Bearer " + SUPABASE_KEY
  };
}

async function articles(select, limit) {
  try {
    const response = await fetch(
      SUPABASE_URL +
        "/rest/v1/Articles?select=" + select + "&order=created_at.desc&limit=" + limit,
      { headers: headers() }
    );
    if (!response.ok) {
      return [];
    }
    const data = await response.json();
    return Array.isArray(data) ? data : [];
  } catch (error) {
    console.error(error);
    return [];
  }
}

async function sitemap(res) {
  const rows = await articles("id,created_at", 500);
  const urls = PAGES.map(function (page) {
    return (
      "  <url><loc>" + xmlEscape(SITE + page[0]) + "</loc>" +
      "<changefreq>" + page[1] + "</changefreq>" +
      "<priority>" + page[2] + "</priority></url>"
    );
  }).concat(rows.filter(function (article) {
    return article && article.id;
  }).map(function (article) {
    const lastmod = isoDate(article.created_at).slice(0, 10);
    return (
      "  <url><loc>" + xmlEscape(SITE + "/article?id=" + encodeURIComponent(article.id)) + "</loc>" +
      (lastmod ? "<lastmod>" + lastmod + "</lastmod>" : "") +
      "<changefreq>monthly</changefreq><priority>0.7</priority></url>"
    );
  }));

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).send(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join("\n") +
    "\n</urlset>\n"
  );
}

async function rss(res) {
  const rows = await articles("id,titre,contenu,auteur,created_at", 30);
  const items = rows.filter(function (article) {
    return article && article.id;
  }).map(function (article) {
    const link = SITE + "/article?id=" + encodeURIComponent(article.id);
    const when = isoDate(article.created_at);
    const pub = when ? new Date(when).toUTCString() : "";
    const description = String(article.contenu || "")
      .replace(/<[^>]*>/g, " ")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 280);
    return (
      "    <item>\n" +
      "      <title>" + xmlEscape(article.titre || "Article") + "</title>\n" +
      "      <link>" + xmlEscape(link) + "</link>\n" +
      "      <guid>" + xmlEscape(link) + "</guid>\n" +
      (pub ? "      <pubDate>" + pub + "</pubDate>\n" : "") +
      "      <description>" + xmlEscape(description) + "</description>\n" +
      "      <author>" + xmlEscape(article.auteur || "Le Financier Ivoirien") + "</author>\n" +
      "    </item>"
    );
  }).join("\n");

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).send(
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0">\n' +
    "  <channel>\n" +
    "    <title>Le Financier Ivoirien</title>\n" +
    "    <link>" + SITE + "/</link>\n" +
    "    <description>L’information financière qui compte.</description>\n" +
    "    <language>fr</language>\n" +
    items +
    "\n  </channel>\n</rss>\n"
  );
}

export default async function handler(req, res) {
  if (req.query.type === "rss") {
    return rss(res);
  }
  return sitemap(res);
}
