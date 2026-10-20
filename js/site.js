(function () {
  var mount = document.getElementById("site-chrome");
  var root = "";

  if (mount && mount.getAttribute("data-root") === "/") {
    root = "/";
  }

  var page = (location.pathname.split("/").pop() || "index").toLowerCase().replace(/\.html$/, "");
  if (!page) page = "index";

  function pageHref(slug) {
    return slug === "index" ? "/" : "/" + slug;
  }

  var links = [
    { href: pageHref("index"), id: "index", label: "Accueil" },
    { href: pageHref("brvm"), id: "brvm", label: "Marchés & Bourse" },
    { href: pageHref("banques"), id: "banques", label: "Banques & Finance" },
    { href: pageHref("entreprises"), id: "entreprises", label: "Entreprises" },
    { href: pageHref("economie"), id: "economie", label: "Économie" },
    { href: pageHref("afrique"), id: "afrique", label: "Afrique & International" },
    { href: pageHref("investissement"), id: "investissement", label: "Investissement" },
    { href: pageHref("actualites"), id: "actualites", label: "Actualités" },
    { href: pageHref("tribune"), id: "tribune", label: "Tribune libre" },
    { href: pageHref("etudiants"), id: "etudiants", label: "Étudiants" },
    { href: pageHref("portraits"), id: "portraits", label: "Portraits & Interviews" }
  ];

  function isActive(item) {
    if (page === "article") {
      return false;
    }
    return page === item.id;
  }

  function navHtml() {
    return links
      .map(function (item) {
        var cls = "nav-link" + (isActive(item) ? " active" : "");
        return '<a href="' + item.href + '" class="' + cls + '">' + item.label + "</a>";
      })
      .join("");
  }

  function chromeHtml() {
    return (
      '<header class="header">' +
        '<button class="menu-button" id="menuButton" type="button" aria-label="Ouvrir le menu" aria-expanded="false" aria-controls="navLinks">' +
          '<span></span><span></span><span></span>' +
        "</button>" +
        '<a class="brand" href="/" id="homeLink">' +
          '<img class="logo" src="' + root + 'logo.png?v=20261020" alt="Le Financier Ivoirien">' +
          '<h1 class="visually-hidden">Le Financier Ivoirien</h1>' +
        "</a>" +
        '<button class="search-button search-button-mobile" type="button" aria-label="Rechercher">⌕</button>' +
      "</header>" +
      '<nav class="nav" id="siteNav">' +
        '<div class="nav-links" id="navLinks">' +
          navHtml() +
          '<div class="nav-extra">' +
            '<a href="/a-propos">À propos</a>' +
            '<a href="/contact">Contact</a>' +
          "</div>" +
        "</div>" +
        '<button class="search-button" id="searchButton" type="button" aria-label="Rechercher">⌕</button>' +
      "</nav>"
    );
  }

  if (mount) {
    mount.outerHTML = chromeHtml();
  }

  function footerHtml() {
    var items = [
      { href: "/", label: "Accueil" },
      { href: "/a-propos", label: "À propos" },
      { href: "/contact", label: "Contact" },
      { href: "/mentions-legales", label: "Mentions légales" },
      { href: "/brvm", label: "Marchés & Bourse" },
      { href: "/banques", label: "Banques & Finance" },
      { href: "/entreprises", label: "Entreprises" },
      { href: "/economie", label: "Économie" },
      { href: "/afrique", label: "Afrique & International" },
      { href: "/investissement", label: "Investissement" },
      { href: "/actualites", label: "Actualités" },
      { href: "/tribune", label: "Tribune libre" },
      { href: "/etudiants", label: "Étudiants" },
      { href: "/portraits", label: "Portraits & Interviews" }
    ];

    var rows = [];
    for (var i = 0; i < items.length; i += 3) {
      rows.push(
        '<div class="footer-row">' +
          items
            .slice(i, i + 3)
            .map(function (item) {
              return '<a href="' + item.href + '">' + item.label + "</a>";
            })
            .join('<span class="footer-sep" aria-hidden="true">|</span>') +
        "</div>"
      );
    }

    return '<nav class="footer-links">' + rows.join("") + "</nav>";
  }

  function placeFooter() {
    var extras = document.querySelectorAll(".top");
    extras.forEach(function (el) {
      el.remove();
    });

    var footers = document.querySelectorAll("footer");
    var footer = footers.length ? footers[footers.length - 1] : null;
    if (!footer) {
      footer = document.createElement("footer");
      document.body.appendChild(footer);
    }
    footer.innerHTML = footerHtml();
    footers.forEach(function (el) {
      if (el !== footer) {
        el.remove();
      }
    });
    document.body.appendChild(footer);
  }

  if (!document.getElementById("footer-bar-style")) {
    var footerStyle = document.createElement("style");
    footerStyle.id = "footer-bar-style";
    footerStyle.textContent =
      "footer{background:#111!important;color:#fff!important;padding:22px 16px!important;text-align:center!important;overflow-x:clip}" +
      "footer .footer-links{display:flex;flex-direction:column;align-items:center;gap:8px;margin:0 auto;width:100%;max-width:100%;background:transparent!important}" +
      "footer .footer-row{display:flex;justify-content:center;align-items:center;max-width:100%}" +
      "footer .footer-links a{display:inline!important;color:#fff!important;font-size:13px!important;font-weight:500;margin:0!important;padding:0 10px!important;white-space:nowrap}" +
      "footer .footer-sep{color:#fff;font-size:13px;padding:0 2px}" +
      "footer .footer-links a:hover{color:#c4a34d!important}" +
      "@media(max-width:700px){" +
      "footer .footer-row{flex-wrap:wrap;width:100%;row-gap:8px}" +
      "footer .footer-links a{white-space:normal!important;padding:4px 8px!important}" +
      "footer .footer-sep{display:none}" +
      "}";
    document.head.appendChild(footerStyle);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", placeFooter);
  } else {
    placeFooter();
  }

  if (!document.querySelector('meta[name="color-scheme"]')) {
    var colorScheme = document.createElement("meta");
    colorScheme.setAttribute("name", "color-scheme");
    colorScheme.setAttribute("content", "light");
    document.head.appendChild(colorScheme);
  }

  var searchButtons = document.querySelectorAll(".search-button");

  function escapeHtml(value) {
    return String(value || "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function articleHref(id) {
    return "/article?id=" + encodeURIComponent(id);
  }

  function ensureSearch() {
    var box = document.getElementById("searchBox");
    if (!box) {
      box = document.createElement("div");
      box.className = "search-box";
      box.id = "searchBox";
      box.innerHTML =
        '<input id="searchInput" type="search" placeholder="Rechercher un article..." aria-label="Rechercher un article">';
      var nav = document.getElementById("siteNav");
      if (nav && nav.nextSibling) {
        nav.parentNode.insertBefore(box, nav.nextSibling);
      } else {
        document.body.insertBefore(box, document.body.firstChild);
      }
    }
    if (!document.getElementById("searchResults")) {
      var results = document.createElement("div");
      results.id = "searchResults";
      results.className = "search-results";
      box.appendChild(results);
    }
    return box;
  }

  function renderHits(articles, term) {
    var results = document.getElementById("searchResults");
    if (!results) {
      return;
    }
    if (!term || term.length < 2) {
      results.innerHTML = "";
      return;
    }
    if (!articles.length) {
      results.innerHTML = "<p>Aucun article pour « " + escapeHtml(term) + " ».</p>";
      return;
    }
    results.innerHTML = articles.map(function (article) {
      var date = article.created_at
        ? new Date(article.created_at).toLocaleDateString("fr-FR", {
            day: "numeric",
            month: "long",
            year: "numeric",
            timeZone: "Africa/Abidjan"
          })
        : "";
      return (
        '<a href="' + articleHref(article.id) + '">' +
          "<strong>" + escapeHtml(article.titre || "Sans titre") + "</strong>" +
          "<span>" + escapeHtml(article.categorie || "Actualités") + "</span>" +
          "<em>" + escapeHtml(article.auteur || "") + (date ? " · " + escapeHtml(date) : "") + "</em>" +
        "</a>"
      );
    }).join("");
  }

  function startSearch() {
    var box = ensureSearch();
    var input = document.getElementById("searchInput");
    var timer = 0;

    function run(term) {
      var clean = String(term || "").trim();
      if (clean.length < 2) {
        renderHits([], "");
        return;
      }
      fetch("/api/search?q=" + encodeURIComponent(clean))
        .then(function (response) {
          if (!response.ok) {
            throw new Error("search");
          }
          return response.json();
        })
        .then(function (data) {
          renderHits((data && data.articles) || [], clean);
        })
        .catch(function () {
          var results = document.getElementById("searchResults");
          if (results) {
            results.innerHTML = "<p>La recherche est momentanément indisponible.</p>";
          }
        });
    }

    searchButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        box.classList.toggle("show");
        if (box.classList.contains("show")) {
          input.focus();
        }
      });
    });

    if (input) {
      input.addEventListener("input", function () {
        var value = input.value;
        window.clearTimeout(timer);
        timer = window.setTimeout(function () {
          var params = new URLSearchParams(location.search);
          var clean = value.trim();
          if (clean) {
            params.set("q", clean);
          } else {
            params.delete("q");
          }
          var next = location.pathname + (params.toString() ? "?" + params.toString() : "");
          history.replaceState(null, "", next);
          run(value);
        }, 250);
      });
    }

    var initial = new URLSearchParams(location.search).get("q");
    if (initial && input) {
      box.classList.add("show");
      input.value = initial;
      run(initial);
    }
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", startSearch);
  } else {
    startSearch();
  }

  var nav = document.getElementById("siteNav");
  var menuBtn = document.getElementById("menuButton");
  if (nav && menuBtn) {
    function closeMenu() {
      nav.classList.remove("is-open");
      document.body.classList.remove("nav-open");
      menuBtn.setAttribute("aria-expanded", "false");
      menuBtn.setAttribute("aria-label", "Ouvrir le menu");
    }

    function toggleMenu() {
      var open = nav.classList.toggle("is-open");
      document.body.classList.toggle("nav-open", open);
      menuBtn.setAttribute("aria-expanded", open ? "true" : "false");
      menuBtn.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    }

    menuBtn.addEventListener("click", toggleMenu);

    nav.querySelectorAll(".nav-links a").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeMenu();
      }
    });
  }

  function formatDate(date) {
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  function fillDates() {
    var label = formatDate(new Date());
    label = label.charAt(0).toUpperCase() + label.slice(1);
    document.querySelectorAll("#currentDate, #date").forEach(function (el) {
      el.textContent = label;
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", fillDates);
  } else {
    fillDates();
  }
})();
