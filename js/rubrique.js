(function () {
  var root = document.querySelector("main[data-rubrique]");
  var cfg = window.LFI;
  if (!root || !cfg) {
    return;
  }

  var kind = root.getAttribute("data-rubrique");
  var label = root.getAttribute("data-label") || "cette rubrique";
  var filters = {
    economie: "or=" + encodeURIComponent("(categorie.eq.Économie,categorie.eq.Économie ivoirienne,categorie.eq.Investissement,titre.ilike.*économ*)"),
    afrique: "or=" + encodeURIComponent("(categorie.eq.Afrique & International,titre.ilike.*afric*)"),
    investissement: "categorie=eq." + encodeURIComponent("Investissement")
  };
  var filter = filters[kind];
  if (!filter) {
    return;
  }

  var apiUrl =
    cfg.supabaseUrl +
    "/rest/v1/Articles?select=id,titre,contenu,categorie,auteur,image_url,created_at&" +
    filter +
    "&order=created_at.desc&limit=20";

  var headers = {
    apikey: cfg.supabaseKey,
    Authorization: "Bearer " + cfg.supabaseKey
  };

  function formatDate(date) {
    if (!date) {
      return "";
    }
    var parsed = new Date(date);
    var month = parsed.toLocaleDateString("fr-FR", { month: "long" });
    return parsed.getDate() + " " + month + ", " + parsed.getFullYear();
  }

  function creerCarte(article) {
    var card = document.createElement("a");
    card.className = "news-card";
    card.href = "/article?id=" + encodeURIComponent(article.id);

    var image = document.createElement("div");
    image.className = "news-image";
    if (article.image_url) {
      var photo = String(article.image_url).replace(
        "https://le-financier-ivoirien.vercel.app/",
        "https://lefinancierivoirien.com/"
      );
      image.style.backgroundImage = 'url("' + photo + '"), linear-gradient(135deg, #333, #111)';
      image.style.backgroundSize = "cover";
      image.style.backgroundPosition = "center";
    }

    var body = document.createElement("div");
    body.className = "news-body";
    var title = document.createElement("h4");
    title.textContent = article.titre || "Sans titre";
    var date = document.createElement("div");
    date.className = "news-date";
    date.textContent = formatDate(article.created_at);
    body.appendChild(title);
    body.appendChild(date);
    card.appendChild(image);
    card.appendChild(body);
    return card;
  }

  function vider(featured, latest, texte) {
    featured.innerHTML = '<div class="empty">' + texte + "</div>";
    latest.hidden = true;
  }

  var featured = document.getElementById("featuredArea");
  var grid = document.getElementById("articlesGrid");
  var latest = document.getElementById("latestSection");
  if (!featured || !grid || !latest) {
    return;
  }

  fetch(apiUrl, { headers: headers })
    .then(function (response) {
      if (!response.ok) {
        throw new Error("chargement");
      }
      return response.json();
    })
    .then(function (articles) {
      if (!Array.isArray(articles) || !articles.length) {
        vider(featured, latest, "Aucun article dans la catégorie « " + label + " » pour le moment.");
        return;
      }
      articles.slice(0, 4).forEach(function (article) {
        featured.appendChild(creerCarte(article));
      });
      var suite = articles.slice(4);
      var count = document.getElementById("newsCount");
      if (count) {
        count.textContent = suite.length
          ? suite.length + " article" + (suite.length > 1 ? "s" : "")
          : "";
      }
      suite.forEach(function (article) {
        grid.appendChild(creerCarte(article));
      });
      if (!suite.length) {
        latest.hidden = true;
      }
    })
    .catch(function () {
      vider(featured, latest, "Impossible de charger les articles pour le moment.");
    });
})();
