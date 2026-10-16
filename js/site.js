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
    { href: root + "index.html", id: "portraits", label: "Portraits & Interviews" }
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
      '<div class="top">' +
        '<span id="currentDate">Le Financier Ivoirien</span>' +
        '<span id="date" class="visually-hidden"></span>' +
        "<span>" +
          '<a href="' + root + 'a-propos.html">À propos</a>' +
          " &nbsp;|&nbsp; " +
          '<a href="' + root + 'contact.html">Contact</a>' +
          " &nbsp;|&nbsp; " +
          '<a href="' + root + 'index.html#newsletterForm">Newsletter</a>' +
        "</span>" +
      "</div>" +
      '<header class="header">' +
        '<a class="brand" href="' + root + 'index.html" id="homeLink">' +
          '<img class="logo" src="' + root + 'logo.png" alt="Le Financier Ivoirien">' +
          '<h1 class="visually-hidden">Le Financier Ivoirien</h1>' +
        "</a>" +
      "</header>" +
      '<nav class="nav">' +
        navHtml() +
        '<button class="search-button" id="searchButton" type="button" aria-label="Rechercher">⌕</button>' +
      "</nav>"
    );
  }

  if (mount) {
    mount.outerHTML = chromeHtml();
  }

  var searchBtn = document.getElementById("searchButton");
  if (searchBtn && page !== "index.html" && page !== "") {
    searchBtn.addEventListener("click", function () {
      location.href = root + "index.html";
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
