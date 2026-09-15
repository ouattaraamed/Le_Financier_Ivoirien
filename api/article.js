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

    const description = (article.contenu || "")
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 200);

    const image =
      article.image_url ||
      "https://le-financier-ivoirien.vercel.app/og-image.png";

    const auteur = article.auteur || "Le Financier Ivoirien";
    const categorie = article.categorie || "Actualités";
    const contenu = article.contenu || "";

    const articleUrl =
      `https://le-financier-ivoirien.vercel.app/article?id=${encodeURIComponent(id)}`;

    const titreHTML = titre
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    const descriptionHTML = description
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

    const auteurHTML = auteur
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const contenuHTML = contenu
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/\n/g, "<br>");

    const html = `
<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">

  <title>${titreHTML} — Le Financier Ivoirien</title>

  <meta name="description" content="${descriptionHTML}">

  <meta property="og:title" content="${titreHTML}">
  <meta property="og:description" content="${descriptionHTML}">
  <meta property="og:image" content="${image}">
  <meta property="og:url" content="${articleUrl}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Le Financier Ivoirien">

  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${titreHTML}">
  <meta name="twitter:description" content="${descriptionHTML}">
  <meta name="twitter:image" content="${image}">

  <link rel="canonical" href="${articleUrl}">

  <style>
    body {
      margin: 0;
      background: #292929;
      color: #eeeeee;
      font-family: Arial, sans-serif;
    }

    .article {
      max-width: 1000px;
      margin: auto;
      padding: 40px 24px 80px;
    }

    .retour {
      display: inline-block;
      background: #17665c;
      color: white;
      padding: 16px 28px;
      text-decoration: none;
      font-weight: bold;
      margin-bottom: 50px;
    }

    .categorie {
      display: inline-block;
      background: #003f34;
      padding: 12px 18px;
      font-weight: bold;
      margin-left: 8px;
    }

    h1 {
      font-family: Georgia, serif;
      font-size: 56px;
      line-height: 1.05;
      color: #b8ffff;
      margin: 20px 0;
    }

    .meta {
      color: #cccccc;
      font-size: 20px;
      margin-bottom: 40px;
    }

    .image {
      width: 100%;
      max-height: 700px;
      object-fit: cover;
      display: block;
      margin-bottom: 50px;
    }

    .contenu {
      font-size: 22px;
      line-height: 1.7;
      color: #eeeeee;
    }

    @media (max-width: 700px) {
      h1 {
        font-size: 38px;
      }

      .contenu {
        font-size: 19px;
      }
    }
  </style>
</head>

<body>

  <main class="article">

    <a class="retour" href="/">
      ← Retour aux actualités
    </a>

    <span class="categorie">${categorie}</span>

    <h1>${titreHTML}</h1>

    <div class="meta">
      Par ${auteurHTML}
    </div>

    <img
      class="image"
      src="${image}"
      alt="${titreHTML}"
    >

    <div class="contenu">
      ${contenuHTML}
    </div>

  </main>

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
