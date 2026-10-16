(function () {
  var mount = document.getElementById("site-chrome");
  var root = "";

  if (mount && mount.getAttribute("data-root") === "/") {
    root = "/";
  }

  var page = (location.pathname.split("/").pop() || "index.html").toLowerCase();
  if (!page || page === "article") {
    page = page === "article" ? "article" : "index.html";
  }

  var links = [
    { href: root + "index.html", id: "index.html", label: "Accueil" },
    { href: root + "brvm.html", id: "brvm.html", label: "Marchés & Bourse" },
    { href: root + "banques.html", id: "banques.html", label: "Banques & Finance" },
    { href: root + "entreprises.html", id: "entreprises.html", label: "Entreprises" },
    { href: root + "economie.html", id: "economie.html", label: "Économie" },
    { href: root + "index.html", id: "afrique", label: "Afrique & International" },
    { href: root + "index.html", id: "investissement", label: "Investissement" },
    { href: root + "portraits.html", id: "portraits.html", label: "Portraits & Interviews" }
  ];

  function isActive(item) {
    if (page === "article") {
      return false;
    }
    if (item.id === "index.html") {
      return page === "index.html" || page === "";
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
        '<a class="brand" href="' + root + 'index.html" id="homeLink">' +
          '<img class="logo" src="' + root + 'logo.png" alt="Le Financier Ivoirien">' +
          '<h1 class="visually-hidden">Le Financier Ivoirien</h1>' +
        "</a>" +
        '<button class="search-button search-button-mobile" type="button" aria-label="Rechercher">⌕</button>' +
      "</header>" +
      '<nav class="nav" id="siteNav">' +
        '<div class="nav-links" id="navLinks">' +
          navHtml() +
          '<div class="nav-extra">' +
            '<a href="' + root + 'a-propos.html">À propos</a>' +
            '<a href="' + root + 'contact.html">Contact</a>' +
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
      { href: root + "index.html", label: "Accueil" },
      { href: root + "a-propos.html", label: "À propos" },
      { href: root + "contact.html", label: "Contact" },
      { href: root + "mentions-legales.html", label: "Mentions légales" },
      { href: root + "brvm.html", label: "Marchés & Bourse" },
      { href: root + "banques.html", label: "Banques & Finance" },
      { href: root + "entreprises.html", label: "Entreprises" },
      { href: root + "economie.html", label: "Économie" },
      { href: root + "index.html", label: "Investissement" }
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
      "footer{background:#111!important;color:#fff!important;padding:22px 4%!important;text-align:center!important}" +
      "footer .footer-links{display:flex;flex-direction:column;align-items:center;gap:8px;margin:0 auto;background:transparent!important}" +
      "footer .footer-row{display:flex;justify-content:center;align-items:center}" +
      "footer .footer-links a{display:inline!important;color:#fff!important;font-size:13px!important;font-weight:500;margin:0!important;padding:0 10px!important;white-space:nowrap}" +
      "footer .footer-sep{color:#fff;font-size:13px;padding:0 2px}" +
      "footer .footer-links a:hover{color:#c4a34d!important}";
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
  if (page !== "index.html" && page !== "") {
    searchButtons.forEach(function (btn) {
      btn.addEventListener("click", function () {
        location.href = root + "index.html";
      });
    });
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
