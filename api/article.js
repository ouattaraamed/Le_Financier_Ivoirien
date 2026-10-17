function frenchDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Africa/Abidjan"
  });
}

function isoDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return date.toISOString();
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function safeUrl(value, fallback) {
  try {
    const url = new URL(value);
    if (url.protocol === "http:" || url.protocol === "https:") {
      return url.toString();
    }
  } catch (error) {
    /* ignore */
  }
  return fallback;
}

export default async function handler(req, res) {
  const id = req.query.id;

  if (!id) {
    return res.status(400).send("Article introuvable");
  }

  const SUPABASE_URL =
    process.env.SUPABASE_URL ||
    "https://xjwimhgdqcaqqadhhtnz.supabase.co";

  const SUPABASE_KEY =
    process.env.SUPABASE_ANON_KEY ||
    "sb_publishable_gneCI14E-yANxMZOeBotww_K2snSohZ";

  const siteUrl = "https://lefinancierivoirien.com";
  const fallbackImage = `${siteUrl}/logo.png`;

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

    const image = safeUrl(article.image_url, fallbackImage);
    const auteur = article.auteur || "Le Financier Ivoirien";
    const categorie = article.categorie || "Actualités";
    const contenu = article.contenu || "";
    const articleUrl = `${siteUrl}/article?id=${encodeURIComponent(id)}`;
    const shareUrl = JSON.stringify(articleUrl).replace(/</g, "\\u003c");
    const shareTitle = JSON.stringify(titre).replace(/</g, "\\u003c");

    const titreHTML = escapeHtml(titre);
    const descriptionHTML = escapeHtml(description);
    const auteurHTML = escapeHtml(auteur);
    const categorieHTML = escapeHtml(categorie);
    const imageHTML = escapeHtml(image);
    const contenuHTML = escapeHtml(contenu).replace(/\n/g, "<br>");
    const dateLabel = frenchDate(article.created_at);
    const dateHTML = escapeHtml(dateLabel);
    const published = isoDate(article.created_at);
    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: titre,
      datePublished: published || undefined,
      author: { "@type": "Person", name: auteur },
      image: [image],
      mainEntityOfPage: articleUrl,
      publisher: {
        "@type": "Organization",
        name: "Le Financier Ivoirien",
        url: siteUrl
      }
    }).replace(/</g, "\\u003c");

    const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${titreHTML} — Le Financier Ivoirien</title>
  <meta name="description" content="${descriptionHTML}">
  <meta property="og:title" content="${titreHTML}">
  <meta property="og:description" content="${descriptionHTML}">
  <meta property="og:image" content="${imageHTML}">
  <meta property="og:url" content="${escapeHtml(articleUrl)}">
  <meta property="og:type" content="article">
  <meta property="og:site_name" content="Le Financier Ivoirien">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${titreHTML}">
  <meta name="twitter:description" content="${descriptionHTML}">
  <meta name="twitter:image" content="${imageHTML}">
  <link rel="canonical" href="${escapeHtml(articleUrl)}">
  <link rel="alternate" type="application/rss+xml" title="Le Financier Ivoirien" href="/rss.xml">
  <script type="application/ld+json">${jsonLd}</script>
  <link rel="icon" href="/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/site.css?v=20261017b">
</head>
<body>
  <div id="site-chrome" data-root="/"></div>
  <script src="/js/site.js?v=20261017b"></script>
  <main>
    <article id="article-detail">
      <a class="detail-back" href="/">← Retour aux actualités</a>
      <span class="detail-category">${categorieHTML}</span>
      <h1 class="detail-title">${titreHTML}</h1>
      <div class="detail-meta">Par ${auteurHTML}${dateHTML ? " · " + dateHTML : ""}</div>
      <div class="share-bar">
        <button type="button" id="shareButton">Partager</button>
        <a class="share-wa" href="https://wa.me/?text=${encodeURIComponent(titre + " " + articleUrl)}" target="_blank" rel="noopener">WhatsApp</a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}" target="_blank" rel="noopener">Facebook</a>
      </div>
      <img class="detail-image" src="${imageHTML}" alt="${titreHTML}">
      <div class="detail-content">${contenuHTML}</div>
    </article>
  </main>
  <script>
    document.getElementById("shareButton").addEventListener("click", function () {
      var url = ${shareUrl};
      var title = ${shareTitle};
      var button = this;
      if (navigator.share) {
        navigator.share({ title: title, url: url }).catch(function () {});
        return;
      }
      navigator.clipboard.writeText(url).then(function () {
        button.textContent = "Lien copié";
      });
    });
  </script>
  <footer>
    <div class="footer-grid">
      <div>
        <div class="footer-brand">Le Financier Ivoirien</div>
        <p>L’information financière qui compte.</p>
      </div>
      <div>
        <h4>Liens utiles</h4>
        <a href="/">Accueil</a>
        <a href="/a-propos.html">À propos</a>
        <a href="/contact.html">Contact</a>
        <a href="/mentions-legales.html">Mentions légales</a>
      </div>
      <div>
        <h4>Catégories</h4>
        <a href="/brvm.html">Marchés & Bourse</a>
        <a href="/banques.html">Banques & Finance</a>
        <a href="/entreprises.html">Entreprises</a>
        <a href="/economie.html">Économie</a>
        <a href="/afrique.html">Afrique & International</a>
        <a href="/investissement.html">Investissement</a>
      </div>
      <div>
        <h4>Le média</h4>
        <a href="/contact.html">Contact rédaction</a>
      </div>
    </div>
    <div class="copy">© 2026 Le Financier Ivoirien. Tous droits réservés.</div>
  </footer>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=60");
    return res.status(200).send(html);
  } catch (error) {
    console.error(error);
    return res.status(500).send("Erreur serveur");
  }
}
