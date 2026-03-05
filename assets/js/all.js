
(() => {
  const $ = (id) => document.getElementById(id);

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function fetchText(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
    return await res.text();
  }

  function parseLines(text) {
    return (text || "")
      .replace(/\r\n/g, "\n")
      .split("\n")
      .map(s => s.trim())
      .filter(Boolean);
  }

  function renderPairs(zhText, enText) {
    const zh = parseLines(zhText);
    const en = parseLines(enText);
    return zh.map((z, i) => {
      const maybeEn = en[i] ? `<div class="en" hidden>${escapeHtml(en[i])}</div>` : "";
      return `
        <div class="read-line">
          <div class="zh">${escapeHtml(z)}</div>
          ${maybeEn}
        </div>
      `;
    }).join("");
  }

  function annotate() {
    if (window.mandarinspot && typeof window.mandarinspot.annotate === "function") {
      window.mandarinspot.annotate("#allReading", { phonetic: "pinyin", inline: false, show: true });
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const baseurl = (window.location.pathname.split("/")[1] ? "/" + window.location.pathname.split("/")[1] : "");
      const zhUrl = `${baseurl}/assets/readings/all.txt`;
      const enUrl = `${baseurl}/assets/readings/all_en.txt`;

      const zhText = await fetchText(zhUrl);

      let enText = "";
      try { enText = await fetchText(enUrl); } catch { enText = ""; }

      $("allReading").innerHTML = renderPairs(zhText, enText);

      const hasEnglish = parseLines(enText).length > 0;
      $("allEnglishToggleWrap").style.display = hasEnglish ? "flex" : "none";

      if (hasEnglish) {
        $("allToggleEnglish").checked = false;
        $("allToggleEnglish").addEventListener("change", () => {
          const show = $("allToggleEnglish").checked;
          document.querySelectorAll("#allReading .en").forEach(el => el.hidden = !show);
        });
      }

      annotate();
    } catch (e) {
      console.error(e);
      $("allReading").textContent = "Add your all-weeks stories in assets/readings/all.txt";
      $("allEnglishToggleWrap").style.display = "none";
    }
  });
})();
