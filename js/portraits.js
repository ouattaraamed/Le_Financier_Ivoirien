(function () {
  var feature = document.getElementById("portraitFeature");
  var grid = document.getElementById("portraitGrid");
  var section = document.getElementById("portraitsSection");
  if (!feature && !grid) {
    return;
  }

  var cfg = window.LFI || {};
  var limit = (section && section.getAttribute("data-limit")) || "12";
  var url =
    cfg.supabaseUrl +
    "/rest/v1/Articles?select=id,titre,contenu,categorie,auteur,image_url,created_at&categorie=eq.Portraits%20%26%20Interviews&order=created_at.desc&limit=" +
    encodeURIComponent(limit);

  function excerpt(html, length) {
    var text = String(html || "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();
    if (!text) {
      return "Un entretien à lire sur Le Financier Ivoirien.";
    }
    if (text.length <= length) {
      return text;
    }
    return text.slice(0, length).replace(/\s+\S*$/, "") + "…";
  }

  function openArticle(article) {
    if (!article || !article.id) {
      return;
    }
    location.href = "/article?id=" + encodeURIComponent(article.id);
  }

  function formatDate(value) {
    if (!value) {
      return "";
    }
    return new Date(value).toLocaleDateString("fr-FR", {
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  function applyImage(el, url) {
    if (el && url) {
      el.style.backgroundImage = 'url("' + url + '")';
    }
  }

  fetch(url, {
    headers: {
      apikey: cfg.supabaseKey,
      Authorization: "Bearer " + cfg.supabaseKey
    }
  })
    .then(function (response) {
      if (!response.ok) {
        throw new Error("portraits");
      }
      return response.json();
    })
    .then(function (liste) {
      if (!liste || !liste.length) {
        if (feature) {
          feature.innerHTML =
            '<div class="portrait-feature-copy">' +
              '<p class="portraits-kicker">Entretien</p>' +
              "<h2>Les visages de l’économie</h2>" +
              '<p class="portrait-quote">Les prochains portraits et interviews seront publiés ici.</p>' +
            "</div>";
        }
        if (grid) {
          grid.innerHTML = "";
        }
        return;
      }

      var premier = liste[0];
      if (feature) {
        feature.innerHTML = "";
        var photo = document.createElement("div");
        photo.className = "portrait-feature-photo";
        applyImage(photo, premier.image_url);

        var copy = document.createElement("div");
        copy.className = "portrait-feature-copy";
        copy.innerHTML =
          '<p class="portraits-kicker">Entretien</p>' +
          "<h2></h2>" +
          '<p class="portrait-quote"></p>' +
          '<div class="portrait-meta"></div>';
        copy.querySelector("h2").textContent = premier.titre || "Sans titre";
        copy.querySelector(".portrait-quote").textContent = excerpt(premier.contenu, 160);
        copy.querySelector(".portrait-meta").textContent =
          (premier.auteur ? premier.auteur + " • " : "") + formatDate(premier.created_at);

        feature.appendChild(photo);
        feature.appendChild(copy);
        feature.onclick = function () {
          openArticle(premier);
        };
      }

      if (!grid) {
        return;
      }

      grid.innerHTML = "";
      liste.slice(1).forEach(function (article) {
        var card = document.createElement("article");
        card.className = "portrait-card";
        var thumb = document.createElement("div");
        thumb.className = "portrait-card-photo";
        applyImage(thumb, article.image_url);
        var title = document.createElement("h3");
        title.textContent = article.titre || "Sans titre";
        var text = document.createElement("p");
        text.textContent = excerpt(article.contenu, 110);
        card.appendChild(thumb);
        card.appendChild(title);
        card.appendChild(text);
        card.onclick = function () {
          openArticle(article);
        };
        grid.appendChild(card);
      });
    })
    .catch(function () {
      if (feature) {
        feature.innerHTML =
          '<div class="portrait-feature-copy">' +
            '<p class="portraits-kicker">Entretien</p>' +
            "<h2>Portraits & Interviews</h2>" +
            '<p class="portrait-quote">La section se mettra à jour dès la publication du prochain entretien.</p>' +
          "</div>";
      }
    });
})();
