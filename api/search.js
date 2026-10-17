import { searchTerm } from "../lib/text.mjs";

const SUPABASE_URL =
  process.env.SUPABASE_URL || "https://xjwimhgdqcaqqadhhtnz.supabase.co";
const SUPABASE_KEY =
  process.env.SUPABASE_ANON_KEY ||
  "sb_publishable_gneCI14E-yANxMZOeBotww_K2snSohZ";

export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.setHeader("Allow", "GET");
    return res.status(405).json({ error: "Méthode refusée." });
  }

  const term = searchTerm(req.query.q);
  if (term.length < 2) {
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ articles: [] });
  }

  const star = "*" + term + "*";
  const filter =
    "(titre.ilike." + star +
    ",contenu.ilike." + star +
    ",categorie.ilike." + star +
    ",auteur.ilike." + star + ")";
  const url =
    SUPABASE_URL +
    "/rest/v1/Articles?select=id,titre,categorie,auteur,created_at&or=" +
    encodeURIComponent(filter) +
    "&order=created_at.desc&limit=20";

  try {
    const response = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: "Bearer " + SUPABASE_KEY
      }
    });
    if (!response.ok) {
      return res.status(502).json({ error: "Recherche indisponible." });
    }
    const data = await response.json();
    const articles = (Array.isArray(data) ? data : []).map(function (article) {
      return {
        id: article.id,
        titre: article.titre || "",
        categorie: article.categorie || "",
        auteur: article.auteur || "",
        created_at: article.created_at || ""
      };
    });
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).json({ articles: articles });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "Recherche indisponible." });
  }
}
