import { isoDate, xmlEscape } from "../lib/text.mjs";

const SITE = "https://le-financier-ivoirien.vercel.app";
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xjwimhgdqcaqqadhhtnz.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_gneCI14E-yANxMZOeBotww_K2snSohZ";

function excerpt(value) {
  return String(value || "")
    .replace(/<[^>]*>/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 280);
}

export default async function handler(req, res) {
  let articles = [];
  try {
    const response = await fetch(
      SUPABASE_URL +
        "/rest/v1/Articles?select=id,titre,contenu,auteur,created_at&order=created_at.desc&limit=30",
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: "Bearer " + SUPABASE_KEY
        }
      }
    );
    if (response.ok) {
      const data = await response.json();
      articles = Array.isArray(data) ? data : [];
    }
  } catch (error) {
    console.error(error);
  }

  const items = articles.filter(function (article) {
    return article && article.id;
  }).map(function (article) {
    const link = SITE + "/article?id=" + encodeURIComponent(article.id);
    const when = isoDate(article.created_at);
    const pub = when ? new Date(when).toUTCString() : "";
    return (
      "    <item>\n" +
      "      <title>" + xmlEscape(article.titre || "Article") + "</title>\n" +
      "      <link>" + xmlEscape(link) + "</link>\n" +
      "      <guid>" + xmlEscape(link) + "</guid>\n" +
      (pub ? "      <pubDate>" + pub + "</pubDate>\n" : "") +
      "      <description>" + xmlEscape(excerpt(article.contenu)) + "</description>\n" +
      "      <author>" + xmlEscape(article.auteur || "Le Financier Ivoirien") + "</author>\n" +
      "    </item>"
    );
  }).join("\n");

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<rss version="2.0">\n' +
    "  <channel>\n" +
    "    <title>Le Financier Ivoirien</title>\n" +
    "    <link>" + SITE + "/</link>\n" +
    "    <description>L’information financière qui compte.</description>\n" +
    "    <language>fr</language>\n" +
    items +
    "\n  </channel>\n</rss>\n";

  res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).send(xml);
}
