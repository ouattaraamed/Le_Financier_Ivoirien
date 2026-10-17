import { isoDate, xmlEscape } from "../lib/text.mjs";

const SITE = "https://le-financier-ivoirien.vercel.app";
const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xjwimhgdqcaqqadhhtnz.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_gneCI14E-yANxMZOeBotww_K2snSohZ";

const PAGES = [
  ["/", "daily", "1.0"],
  ["/brvm.html", "daily", "0.8"],
  ["/banques.html", "daily", "0.8"],
  ["/entreprises.html", "daily", "0.8"],
  ["/economie.html", "daily", "0.8"],
  ["/afrique.html", "daily", "0.8"],
  ["/investissement.html", "daily", "0.8"],
  ["/actualites.html", "daily", "0.8"],
  ["/portraits.html", "weekly", "0.8"],
  ["/a-propos.html", "monthly", "0.5"],
  ["/contact.html", "monthly", "0.5"],
  ["/mentions-legales.html", "yearly", "0.3"]
];

export default async function handler(req, res) {
  let articles = [];
  try {
    const response = await fetch(
      SUPABASE_URL +
        "/rest/v1/Articles?select=id,created_at&order=created_at.desc&limit=500",
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

  const urls = PAGES.map(function (page) {
    return (
      "  <url><loc>" + xmlEscape(SITE + page[0]) + "</loc>" +
      "<changefreq>" + page[1] + "</changefreq>" +
      "<priority>" + page[2] + "</priority></url>"
    );
  }).concat(articles.filter(function (article) {
    return article && article.id;
  }).map(function (article) {
    const lastmod = isoDate(article.created_at).slice(0, 10);
    return (
      "  <url><loc>" + xmlEscape(SITE + "/article?id=" + encodeURIComponent(article.id)) + "</loc>" +
      (lastmod ? "<lastmod>" + lastmod + "</lastmod>" : "") +
      "<changefreq>monthly</changefreq><priority>0.7</priority></url>"
    );
  }));

  const xml =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urls.join("\n") +
    "\n</urlset>\n";

  res.setHeader("Content-Type", "application/xml; charset=utf-8");
  res.setHeader("Cache-Control", "public, max-age=300");
  return res.status(200).send(xml);
}
