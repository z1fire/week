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
      window.mandarinspot.annotate("#storyReading", { phonetic: "pinyin", inline: false, show: true });
    }
  }

  document.addEventListener("DOMContentLoaded", async () => {
    try {
      const week = (window.STORY && window.STORY.week) || 0;
      const baseurl = (window.STORY && window.STORY.baseurl) || "";

      const isAll = Number(week) === 0;
      const zhUrl = isAll
        ? `${baseurl}/assets/readings/all.txt`
        : `${baseurl}/assets/readings/week${String(week).padStart(2, "0")}.txt`;
      const enUrl = isAll
        ? `${baseurl}/assets/readings/all_en.txt`
        : `${baseurl}/assets/readings/week${String(week).padStart(2, "0")}_en.txt`;

      const zhText = await fetchText(zhUrl);

      let enText = "";
      try { enText = await fetchText(enUrl); } catch { enText = ""; }

      $("storyReading").innerHTML = renderPairs(zhText, enText);

      const hasEnglish = parseLines(enText).length > 0;
      $("storyEnglishToggleWrap").style.display = hasEnglish ? "flex" : "none";

      if (hasEnglish) {
        $("storyToggleEnglish").checked = false;
        $("storyToggleEnglish").addEventListener("change", () => {
          const show = $("storyToggleEnglish").checked;
          document.querySelectorAll("#storyReading .en").forEach(el => el.hidden = !show);
        });
      }

      annotate();
    } catch (e) {
      console.error(e);
      $("storyReading").textContent = "Could not load this story. Check assets/readings.";
      $("storyEnglishToggleWrap").style.display = "none";
    }
  });
})();
