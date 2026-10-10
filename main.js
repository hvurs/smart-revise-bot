const GH_USER = "hvurs";

/* Mouse trail (uses your existing cursor-effects.js) */
if (
  window.cursoreffects &&
  !matchMedia("(prefers-reduced-motion: reduce)").matches
) {
  new cursoreffects.trailingCursor({
    particles: 15,
    rate: 0.6,
    baseImageSrc: "",
  });
}

/* GitHub contributions */
async function loadChart() {
  const chart = document.getElementById("chart");
  const meta = document.getElementById("chart-meta");
  try {
    const res = await fetch(
      "https://github-contributions-api.jogruber.de/v4/" + GH_USER + "?y=last",
    );
    const data = await res.json();
    const days = data.contributions;
    const pad = new Date(days[0].date + "T00:00:00").getDay();
    let html = "<i style='visibility:hidden'></i>".repeat(pad);
    let total = 0;
    for (const c of days) {
      total += c.count;
      html +=
        '<i data-l="' +
        c.level +
        '" title="' +
        c.count +
        " on " +
        c.date +
        '"></i>';
    }
    chart.innerHTML = html;
    meta.textContent =
      total.toLocaleString() + " contributions in the last year";
    const sc = document.getElementById("scroll");
    sc.scrollLeft = sc.scrollWidth;
  } catch (e) {
    meta.innerHTML =
      "Couldn't load the chart. <a href=\"https://github.com/" +
      GH_USER +
      '" target="_blank" rel="noopener">See it on GitHub</a>.';
  }
}
loadChart();

/* Copy ETH address */
const COPY_PATH =
  "M16 1H4a2 2 0 0 0-2 2v14h2V3h12V1zm3 4H8a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2zm0 16H8V7h11v14z";
const CHECK_PATH = "M9 16.2 4.8 12l-1.4 1.4L9 19 21 7l-1.4-1.4z";
document.getElementById("copy").addEventListener("click", function () {
  const btn = this;
  navigator.clipboard
    .writeText(document.getElementById("eth").textContent.trim())
    .then(() => {
      document.getElementById("copy-label").textContent = "Copied";
      document.getElementById("copy-icon").setAttribute("d", CHECK_PATH);
      btn.classList.add("done");
      setTimeout(() => {
        document.getElementById("copy-label").textContent = "Copy address";
        document.getElementById("copy-icon").setAttribute("d", COPY_PATH);
        btn.classList.remove("done");
      }, 1800);
    });
});
