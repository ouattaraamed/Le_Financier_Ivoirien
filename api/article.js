export default async function handler(req, res) {
  const id = req.query.id;

  if (!id) {
    return res.status(400).send("Article introuvable");
  }

  const SUPABASE_URL =
    "https://xjwimhgdqcaqqadhhtnz.supabase.co";

  const SUPABASE_KEY =
    "sb_publishable_gneCI14E-yANxMZOeBotww_K2snSohZ";

  try {
    const response = await fetch(
      `${SUPABASE_URL}/rest/v1/Articles?id=eq.${encodeURIComponent(id)}&select=*`,
      {
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`
        }
      }
    );

    const data = await response.json();
    const article = data[0];

    if (!article) {
      return res.status(404).send("Article introuvable");
    }

    const titre = article.titre || "Le Financier Ivoirien";

    const description = (
      article.contenu ||
      "L’information financière qui compte."
    )
      .replace(/<[^>]*>/g, "")
      .replace(/"/g, "&quot;")
      .substring(0, 200);

    const image =
      article.image_url ||
      "https://le-financier-ivoirien.vercel.app/og-image.png";

    const articleUrl =
      `https://le-financier-ivoirien.vercel.app/article?id=${encodeURIComponent(id)}`;

    const siteUrl =
      `https://le-financier-ivoirien.vercel.app/?article=${encodeURIComponent(id)}`;

    const html = `
<!doctype html>
<html lang="fr">
<head>
  <meta charset="utf-8">

  <title>${titre}</title>

  <meta name="description" content="${description}">

  <meta property="og:title" content="${titre}">
  <meta property="og:description" content="${description}">
  <meta property="og:image" content="${image}">
  <meta property="og:url" content="${articleUrl}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Le Financier Ivoirien">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${titre}">
  <meta name="twitter:description" content="${description}">
  <meta name="twitter:image" content="${image}">

  <meta http-equiv="refresh" content="0;url=${siteUrl}">
</head>

<body>
  <p>Chargement de l’article...</p>
</body>
</html>
`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");

    return res.status(200).send(html);

  } catch (error) {
    console.error(error);
    return res.status(500).send("Erreur serveur");
  }
}
