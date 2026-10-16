export default async function handler(req, res) {
  try {
    const response = await fetch("https://nfs.faireconomy.media/ff_calendar_thisweek.json", {
      headers: {
        Accept: "application/json",
        "User-Agent": "LeFinancierIvoirien/1.0"
      }
    });

    if (!response.ok) {
      return res.status(502).json({ error: "Calendrier indisponible." });
    }

    const data = await response.json();
    const events = (Array.isArray(data) ? data : []).map(function (item) {
      return {
        title: item.title || "",
        currency: item.country || "",
        date: item.date || "",
        impact: item.impact || "",
        actual: item.actual || "",
        forecast: item.forecast || "",
        previous: item.previous || ""
      };
    }).filter(function (item) {
      return item.title && item.date;
    });

    res.setHeader("Cache-Control", "s-maxage=60, stale-while-revalidate=120");
    return res.status(200).json({
      source: "https://www.forexfactory.com/calendar",
      updatedAt: new Date().toISOString(),
      events: events
    });
  } catch (error) {
    console.error(error);
    return res.status(502).json({ error: "Calendrier indisponible." });
  }
}
