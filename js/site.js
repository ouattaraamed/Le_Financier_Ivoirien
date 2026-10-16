(function () {
  function formatDate(date) {
    return date.toLocaleDateString("fr-FR", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric"
    });
  }

  function fillDates() {
    const label = formatDate(new Date());
    document.querySelectorAll("#currentDate, #date").forEach(function (el) {
      el.textContent = label.charAt(0).toUpperCase() + label.slice(1);
    });
  }

  document.addEventListener("DOMContentLoaded", fillDates);
})();
