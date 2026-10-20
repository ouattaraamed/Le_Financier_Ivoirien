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

function detachTail(value) {
  let url = value;
  let tail = "";
  while (url && /[),.;:!?»]+$/.test(url)) {
    const last = url.slice(-1);
    if (last === ")" && (url.split("(").length - 1) >= url.split(")").length - 1) {
      break;
    }
    tail = last + tail;
    url = url.slice(0, -1);
  }
  return { url: url, tail: tail };
}

function renderText(value) {
  const text = String(value || "");
  const pattern = /(?:https?:\/\/|www\.)[^\s<>"']+/gi;
  let html = "";
  let last = 0;
  let match;
  while ((match = pattern.exec(text))) {
    html += escapeHtml(text.slice(last, match.index)).replace(/\n/g, "<br>");
    const parts = detachTail(match[0]);
    const href = safeUrl(/^www\./i.test(parts.url) ? "https://" + parts.url : parts.url, "");
    if (!href) {
      html += escapeHtml(match[0]);
    } else {
      html +=
        '<a href="' + escapeHtml(href) + '" target="_blank" rel="noopener">' +
        escapeHtml(parts.url) + "</a>" + escapeHtml(parts.tail);
    }
    last = match.index + match[0].length;
  }
  html += escapeHtml(text.slice(last)).replace(/\n/g, "<br>");
  return html;
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

function splitArticle(value) {
  const raw = String(value || "");
  const marker = "@@lfi-images@@";
  const at = raw.indexOf(marker);
  if (at < 0) {
    return { text: raw, images: [] };
  }
  const images = [];
  raw.slice(at + marker.length).split(/\n+/).forEach(function (line) {
    const url = safeUrl(line.trim(), "");
    if (url && images.indexOf(url) < 0 && images.length < 8) {
      images.push(url);
    }
  });
  return { text: raw.slice(0, at).replace(/\s+$/, ""), images: images };
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
    const parts = splitArticle(article.contenu || "");
    const description = parts.text
      .replace(/<[^>]*>/g, "")
      .replace(/\s+/g, " ")
      .trim()
      .substring(0, 200);

    const image = safeUrl(article.image_url, fallbackImage);
    const auteur = article.auteur || "Le Financier Ivoirien";
    const categorie = article.categorie || "Actualités";
    const contenu = parts.text;
    const extras = parts.images.filter(function (url) {
      return url !== image;
    });
    const articleUrl = `${siteUrl}/article?id=${encodeURIComponent(id)}`;
    const shareUrl = JSON.stringify(articleUrl).replace(/</g, "\\u003c");
    const shareTitle = JSON.stringify(titre).replace(/</g, "\\u003c");

    const titreHTML = escapeHtml(titre);
    const descriptionHTML = escapeHtml(description);
    const auteurHTML = escapeHtml(auteur);
    const categorieHTML = escapeHtml(categorie);
    const imageHTML = escapeHtml(image);
    const contenuHTML = renderText(contenu);
    const galleryHTML = extras.length
      ? `<div class="detail-gallery">${extras.map(function (url) {
          return `<img src="${escapeHtml(url)}" alt="">`;
        }).join("")}</div>`
      : "";
    const dateLabel = frenchDate(article.created_at);
    const dateHTML = escapeHtml(dateLabel);
    const tribuneNote = categorie === "Tribune libre"
      ? `<p class="detail-meta">Tribune signée par son auteur. Le Financier Ivoirien la publie dans la rubrique <a href="/tribune">Tribune libre</a>.</p>`
      : "";
    const published = isoDate(article.created_at);
    const jsonLd = JSON.stringify({
      "@context": "https://schema.org",
      "@type": "NewsArticle",
      headline: titre,
      datePublished: published || undefined,
      author: { "@type": "Person", name: auteur },
      image: [image].concat(extras),
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
  <link rel="icon" href="/favicon-32.png?v=20261020" type="image/png" sizes="32x32">
  <link rel="icon" href="/favicon.svg?v=20261020" type="image/svg+xml">
  <link rel="apple-touch-icon" href="/apple-touch-icon.png?v=20261020" sizes="180x180">
  <link rel="manifest" href="/site.webmanifest">
  <meta name="theme-color" content="#000000">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@500;600;700&family=Source+Sans+3:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="/css/site.css?v=20261020bw">
</head>
<body>
  <div id="site-chrome" data-root="/"></div>
  <script src="/js/site.js?v=20261020a"></script>
  <main>
    <article id="article-detail">
      <a class="detail-back" href="/">← Retour aux actualités</a>
      <span class="detail-category">${categorieHTML}</span>
      ${tribuneNote}
      <h1 class="detail-title">${titreHTML}</h1>
      <div class="detail-meta">Par ${auteurHTML}${dateHTML ? " · " + dateHTML : ""}</div>
      <div class="share-bar">
        <button type="button" id="shareButton">Partager</button>
        <a class="share-wa" href="https://wa.me/?text=${encodeURIComponent(titre + " " + articleUrl)}" target="_blank" rel="noopener">WhatsApp</a>
        <a href="https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(articleUrl)}" target="_blank" rel="noopener">Facebook</a>
      </div>
      <img class="detail-image" src="${imageHTML}" alt="${titreHTML}">
      <div class="detail-content">${contenuHTML}</div>
      ${galleryHTML}
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
        <a href="/a-propos">À propos</a>
        <a href="/contact">Contact</a>
        <a href="/mentions-legales">Mentions légales</a>
      </div>
      <div>
        <h4>Catégories</h4>
        <a href="/brvm">Marchés & Bourse</a>
        <a href="/banques">Banques & Finance</a>
        <a href="/entreprises">Entreprises</a>
        <a href="/economie">Économie</a>
        <a href="/afrique">Afrique & International</a>
        <a href="/investissement">Investissement</a>
      </div>
      <div>
        <h4>Le média</h4>
        <a href="/contact">Contact rédaction</a>
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
