
/* assets/js/allquiz.js — cross-week vocabulary quiz for /all/ page */
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

  // --- seeded RNG (same approach as week.js) ---
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

  function makeRng(seed) {
    return mulberry32(xmur3(seed)());
  }

  function seededShuffle(arr, rng) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function newSeed() {
    if (typeof crypto !== "undefined" && crypto.getRandomValues) {
      const b = new Uint32Array(2);
      crypto.getRandomValues(b);
      return b[0].toString(16) + b[1].toString(16);
    }
    return Date.now().toString(16);
  }

  // --- data loading ---
  const baseurl = window.ALLQUIZ_BASEURL || "";
  let allWordsCache = null;

  async function loadAllWords() {
    if (allWordsCache) return allWordsCache;
    const pad = (n) => String(n).padStart(2, "0");
    const fetches = Array.from({ length: 12 }, (_, i) =>
      fetch(`${baseurl}/assets/data/week${pad(i + 1)}.json`, { cache: "force-cache" })
        .then((r) => r.json())
        .then((d) => (Array.isArray(d.words) ? d.words.map((w) => ({ ...w, week: i + 1 })) : []))
        .catch(() => [])
    );
    const chunks = await Promise.all(fetches);
    allWordsCache = chunks.flat();
    return allWordsCache;
  }

  // --- quiz state ---
  let AQ_QUESTIONS = [];
  let AQ_POOL = [];
  let aqIdx = 0;
  let aqScore = 0;
  let aqLocked = false;
  let aqSeed = "";
  let aqResults = [];
  let aqQuizType = "pinyin";

  function pickMeaning(word) {
    const m = Array.isArray(word.meanings) ? word.meanings : [String(word.meanings || "")];
    return m.filter(Boolean)[0] || "";
  }

  function buildQuestions(words, quizType, seed) {
    return words.map((w) => {
      if (quizType === "pinyin") return { prompt: w.pinyin,       correct: w.hanzi, word: w };
      if (quizType === "meaning") return { prompt: pickMeaning(w), correct: w.hanzi, word: w };
      return { prompt: w.pinyin, correct: w.hanzi, word: w };
    });
  }

  function pickDistractors(pool, correct, k, seed) {
    const opts = pool.filter((w) => w.hanzi !== correct).map((w) => w.hanzi);
    return seededShuffle(opts, makeRng(seed)).slice(0, k);
  }

  function setStatus() {
    if ($("aqProgress")) $("aqProgress").textContent = `Question ${aqIdx + 1} / ${AQ_QUESTIONS.length}`;
    if ($("aqScore"))    $("aqScore").textContent    = `Score: ${aqScore}`;
  }

  function renderOptions(choices, correct, hanzi) {
    if (!$("aqOptions")) return;
    $("aqOptions").innerHTML = choices
      .map((c) => `<button class="option" type="button" data-choice="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
      .join("");
    $("aqOptions").querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => onAnswer(btn, correct, hanzi));
    });
  }

  function showQuestion() {
    aqLocked = false;
    if ($("aqFeedback")) $("aqFeedback").textContent = "";
    if ($("aqNext"))     $("aqNext").disabled = true;

    const q = AQ_QUESTIONS[aqIdx];
    if ($("aqPrompt")) $("aqPrompt").textContent = q.prompt;

    const qSeed = aqSeed + `|q|${aqIdx}`;
    const distractors = pickDistractors(AQ_POOL, q.correct, 3, qSeed + "|d");
    const choices = seededShuffle([q.correct, ...distractors], makeRng(qSeed + "|c"));
    renderOptions(choices, q.correct, q.word.hanzi);
    setStatus();
  }

  function onAnswer(btn, correct, hanzi) {
    if (aqLocked) return;
    aqLocked = true;
    const chosen = btn.getAttribute("data-choice");
    const isCorrect = chosen === correct;
    aqResults.push({ hanzi, correct: isCorrect });

    $("aqOptions")?.querySelectorAll("button").forEach((b) => {
      if (b.getAttribute("data-choice") === correct) b.classList.add("correct");
      if (!isCorrect && b === btn) b.classList.add("wrong");
      b.disabled = true;
    });

    if (isCorrect) { aqScore++; if ($("aqFeedback")) $("aqFeedback").textContent = "✅ Correct"; }
    else           { if ($("aqFeedback")) $("aqFeedback").textContent = `❌ Incorrect — ${correct}`; }

    if ($("aqNext"))  $("aqNext").disabled = false;
    if ($("aqScore")) $("aqScore").textContent = `Score: ${aqScore}`;
  }

  function advanceAQ() {
    if (aqIdx < AQ_QUESTIONS.length - 1) { aqIdx++; showQuestion(); } else { finishAQ(); }
  }

  function finishAQ() {
    if ($("aqPrompt"))   $("aqPrompt").textContent  = "Done!";
    if ($("aqOptions"))  $("aqOptions").innerHTML   = "";
    if ($("aqFeedback")) $("aqFeedback").textContent = `Final score: ${aqScore} / ${AQ_QUESTIONS.length}`;
    if ($("aqNext"))     $("aqNext").disabled        = true;

    if (window.Progress) {
      window.Progress.recordQuizResult(0, aqQuizType, aqScore, AQ_QUESTIONS.length, aqResults);
    }
  }

  async function startAQ() {
    $("aqLoading").hidden = false;
    $("aqArea").hidden    = true;
    $("aqStart").disabled = true;

    let allWords;
    try {
      allWords = await loadAllWords();
    } finally {
      $("aqLoading").hidden = true;
      $("aqStart").disabled = false;
    }

    if (!allWords.length) { if ($("aqFeedback")) $("aqFeedback").textContent = "Could not load word data."; return; }

    aqQuizType = $("aqType")?.value || "pinyin";
    const mode = $("aqMode")?.value || "random20";
    aqSeed = `allquiz|type:${aqQuizType}|mode:${mode}|run:${newSeed()}`;
    const rng = makeRng(aqSeed + "|pick");

    let picked;
    if (mode === "weak20") {
      const sorted = allWords.slice().sort((a, b) => {
        const ma = window.Progress ? window.Progress.getWordMastery(a.hanzi) : 0;
        const mb = window.Progress ? window.Progress.getWordMastery(b.hanzi) : 0;
        return ma - mb;
      });
      picked = sorted.slice(0, 20);
    } else if (mode === "random20") {
      picked = seededShuffle(allWords, rng).slice(0, 20);
    } else if (mode === "random50") {
      picked = seededShuffle(allWords, rng).slice(0, 50);
    } else {
      picked = seededShuffle(allWords, rng);
    }

    AQ_POOL = allWords;
    AQ_QUESTIONS = buildQuestions(picked, aqQuizType, aqSeed);
    aqResults = [];
    aqIdx = 0;
    aqScore = 0;

    $("aqArea").hidden = false;
    showQuestion();
  }

  document.addEventListener("DOMContentLoaded", () => {
    $("aqStart")?.addEventListener("click", startAQ);
    $("aqNext")?.addEventListener("click",  advanceAQ);
    $("aqRestart")?.addEventListener("click", startAQ);

    document.addEventListener("keydown", (e) => {
      if ($("aqArea")?.hidden) return;
      if (e.key >= "1" && e.key <= "4") {
        e.preventDefault();
        $("aqOptions")?.querySelectorAll("button:not([disabled])")?.[parseInt(e.key) - 1]?.click();
      }
      if (e.key === "Enter" && !$("aqNext")?.disabled) {
        e.preventDefault();
        $("aqNext")?.click();
      }
    });
  });
})();
