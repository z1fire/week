\
(() => {
  const $ = (id) => document.getElementById(id);

  const pad2 = (n) => String(n).padStart(2, "0");

  // --- deterministic RNG helpers (seeded) ---
  // We use a per-run random seed so each Start/Restart produces a new order,
  // but the quiz is stable within that run.
  function xmur3(str) {
    let h = 1779033703 ^ str.length;
    for (let i = 0; i < str.length; i++) {
      h = Math.imul(h ^ str.charCodeAt(i), 3432918353);
      h = (h << 13) | (h >>> 19);
    }
    return function () {
      h = Math.imul(h ^ (h >>> 16), 2246822507);
      h = Math.imul(h ^ (h >>> 13), 3266489909);
      return (h ^= h >>> 16) >>> 0;
    };
  }

  function mulberry32(a) {
    return function () {
      let t = (a += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function makeRng(seedStr) {
    const seed = xmur3(seedStr)();
    return mulberry32(seed);
  }

  function seededShuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function seededSample(arr, n, rng) {
    return seededShuffle(arr, rng).slice(0, Math.max(0, Math.min(n, arr.length)));
  }

  function newRunSeed() {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const buf = new Uint32Array(4);
      crypto.getRandomValues(buf);
      return Array.from(buf).map(x => x.toString(16).padStart(8, "0")).join("");
    }
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }

  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
    return await res.json();
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
      .map((s) => s.trim())
      .filter(Boolean);
  }

  function buildStudyTable(words) {
    const rows = words
      .map((w) => {
        const meanings = Array.isArray(w.meanings) ? w.meanings.join("; ") : String(w.meanings || "");
        return `
          <tr>
            <td class="hanzi">${escapeHtml(w.hanzi)}</td>
            <td>${escapeHtml(w.pinyin)}</td>
            <td>${escapeHtml(meanings)}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <table class="study-table">
        <thead>
          <tr><th>汉字</th><th>Pinyin</th><th>Meanings</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function renderReadingPairs(zhText, enText) {
    const zh = parseLines(zhText);
    const en = parseLines(enText);

    return zh
      .map((z, i) => {
        const maybeEn = en[i] ? `<div class="en" hidden>${escapeHtml(en[i])}</div>` : "";
        return `
          <div class="read-line">
            <div class="zh">${escapeHtml(z)}</div>
            ${maybeEn}
          </div>
        `;
      })
      .join("");
  }

  function annotateReading() {
    if (window.mandarinspot && typeof window.mandarinspot.annotate === "function") {
      window.mandarinspot.annotate("#readingText", { phonetic: "pinyin", inline: false, show: true });
    }
  }

  async function loadWeekData(week, baseurl) {
    const p = pad2(week);
    const dataUrl = `${baseurl}/assets/data/week${p}.json`;
    const readingZhUrl = `${baseurl}/assets/readings/week${p}.txt`;
    const readingEnUrl = `${baseurl}/assets/readings/week${p}_en.txt`;

    const data = await fetchJson(dataUrl);
    const zhText = await fetchText(readingZhUrl);

    let enText = "";
    try {
      enText = await fetchText(readingEnUrl);
    } catch {
      enText = "";
    }

    return { data, zhText, enText };
  }

  async function loadPrevWeeksWords(week, baseurl) {
    const all = [];
    for (let w = 1; w < week; w++) {
      const p = pad2(w);
      const dataUrl = `${baseurl}/assets/data/week${p}.json`;
      try {
        const d = await fetchJson(dataUrl);
        if (Array.isArray(d.words)) all.push(...d.words);
      } catch {}
    }
    return all;
  }

  // Quiz state
  let WORDS = [];
  let DISTRACTOR_POOL = [];
  let QUESTIONS = [];
  let idx = 0;
  let score = 0;
  let locked = false;
  let BASE_SEED = "";

  function setProgress() {
    $("progressText").textContent = `Question ${idx + 1} / ${QUESTIONS.length}`;
    $("scoreText").textContent = `Score: ${score}`;
  }

  function pickMeaning(meanings, seedStr) {
    if (!meanings || meanings.length === 0) return "";
    if (meanings.length === 1) return meanings[0];
    const rng = makeRng(seedStr);
    return meanings[Math.floor(rng() * meanings.length)];
  }

  function makeQuestions(words, type, mode, n, seedStr) {
    const rngPick = makeRng(seedStr + "|pick");

    let picked;
    if (mode === "random") {
      picked = seededSample(words, n, rngPick);
    } else {
      // ALL 50: shuffled each run (per your requirement)
      picked = seededShuffle(words, rngPick);
    }

    return picked.map((w, i) => {
      if (type === "pinyin") return { prompt: w.pinyin, correct: w.hanzi };

      const meanings = Array.isArray(w.meanings) ? w.meanings : [String(w.meanings || "")];
      const meaning = pickMeaning(meanings, seedStr + `|m|${i}`);
      return { prompt: meaning, correct: w.hanzi };
    });
  }

  function pickDistractors(pool, correctHanzi, k, seedStr) {
    const options = pool.filter((w) => w.hanzi !== correctHanzi).map((w) => w.hanzi);
    const rng = makeRng(seedStr);
    return seededSample(options, k, rng);
  }

  function showQuestion() {
    locked = false;
    $("feedback").textContent = "";
    $("nextBtn").disabled = true;

    const q = QUESTIONS[idx];
    $("prompt").textContent = q.prompt;

    const qSeed = BASE_SEED + `|q|${idx}`;
    const distractors = pickDistractors(DISTRACTOR_POOL, q.correct, 3, qSeed + "|d");
    const choices = seededShuffle([q.correct, ...distractors], makeRng(qSeed + "|c"));

    $("options").innerHTML = choices
      .map((c) => `<button class="option" type="button" data-choice="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
      .join("");

    $("options").querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => onAnswer(btn, q.correct));
    });

    setProgress();
  }

  function onAnswer(btn, correct) {
    if (locked) return;
    locked = true;

    const chosen = btn.getAttribute("data-choice");
    const isCorrect = chosen === correct;

    $("options").querySelectorAll("button").forEach((b) => {
      const c = b.getAttribute("data-choice");
      if (c === correct) b.classList.add("correct");
      if (!isCorrect && b === btn) b.classList.add("wrong");
      b.disabled = true;
    });

    if (isCorrect) {
      score += 1;
      $("feedback").textContent = "✅ Correct";
    } else {
      $("feedback").textContent = `❌ Incorrect — correct answer: ${correct}`;
    }

    $("nextBtn").disabled = false;
    $("scoreText").textContent = `Score: ${score}`;
  }

  function finishQuiz() {
    $("prompt").textContent = "Done!";
    $("options").innerHTML = "";
    $("feedback").textContent = `Final score: ${score} / ${QUESTIONS.length}`;
    $("nextBtn").disabled = true;
    $("progressText").textContent = "";
  }

  async function startQuizFlow(week, baseurl) {
    const quizType = $("quizType").value;
    const mode = $("questionMode").value;
    const includePrev = $("includePrev").checked;

    let n = WORDS.length;
    if (mode === "random") {
      const raw = parseInt($("randomCount").value, 10);
      n = Number.isFinite(raw) ? Math.max(1, Math.min(raw, WORDS.length)) : 20;
    }

    DISTRACTOR_POOL = [...WORDS];
    if (includePrev) {
      const prev = await loadPrevWeeksWords(week, baseurl);
      DISTRACTOR_POOL = [...WORDS, ...prev];
    }

    const runSeed = newRunSeed();
    BASE_SEED = `v3|week:${week}|type:${quizType}|mode:${mode}|n:${n}|prev:${includePrev}|run:${runSeed}`;

    QUESTIONS = makeQuestions(WORDS, quizType, mode, n, BASE_SEED);

    idx = 0;
    score = 0;

    $("quizArea").hidden = false;
    showQuestion();
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const { week, baseurl } = window.STUDY;

    $("questionMode").addEventListener("change", () => {
      $("randomCountWrap").style.display = $("questionMode").value === "random" ? "flex" : "none";
    });

    try {
      const { data, zhText, enText } = await loadWeekData(week, baseurl);

      $("weekTitle").textContent = data.title ? data.title : `Week ${week}`;
      $("youtubeLink").href = data.youtube || "#";

      WORDS = Array.isArray(data.words) ? data.words : [];
      $("studyTableWrap").innerHTML = buildStudyTable(WORDS);

      $("readingText").innerHTML = renderReadingPairs(zhText, enText);

      const hasEnglish = parseLines(enText).length > 0;
      $("englishToggleWrap").style.display = hasEnglish ? "flex" : "none";

      if (hasEnglish) {
        $("toggleEnglish").checked = false;
        $("toggleEnglish").addEventListener("change", () => {
          const show = $("toggleEnglish").checked;
          document.querySelectorAll("#readingText .en").forEach((el) => (el.hidden = !show));
        });
      }

      annotateReading();
    } catch (err) {
      console.error(err);
      $("readingText").textContent = "Could not load this week’s files. Check assets/data and assets/readings.";
      $("englishToggleWrap").style.display = "none";
    }

    $("startQuiz").addEventListener("click", async () => startQuizFlow(week, baseurl));
    $("nextBtn").addEventListener("click", () => (idx < QUESTIONS.length - 1 ? (idx++, showQuestion()) : finishQuiz()));
    $("restartBtn").addEventListener("click", async () => startQuizFlow(week, baseurl));
  });
})();
