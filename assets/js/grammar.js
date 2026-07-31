
/* assets/js/grammar.js — grammar pattern exercises for /week/N/ pages */
(() => {
  const $ = (id) => document.getElementById(id);
  const pad2 = (n) => String(n).padStart(2, "0");

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
      return Array.from(buf).map((x) => x.toString(16).padStart(8, "0")).join("");
    }
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }

  function normalizeZh(s) {
    return String(s || "").replace(/\s+/g, "").trim();
  }

  async function fetchJson(url) {
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
    return await res.json();
  }

  function annotateGrammar() {
    if (window.mandarinspot && typeof window.mandarinspot.annotate === "function") {
      window.mandarinspot.annotate("#gZhContent", { phonetic: "pinyin", inline: false, show: true });
    }
  }

  // Shared grammar-particle bank used as fill-in-the-blank distractors.
  // "week" = the week each word's grammatical function was first introduced.
  const GRAMMAR_WORDS = [
    { w: "是", week: 1 }, { w: "吗", week: 1 }, { w: "的", week: 1 }, { w: "们", week: 1 },
    { w: "谁的", week: 2 }, { w: "几", week: 2 }, { w: "多少", week: 2 }, { w: "都", week: 2 }, { w: "也", week: 2 }, { w: "在", week: 2 },
    { w: "已经", week: 3 }, { w: "还没", week: 3 }, { w: "因为", week: 3 }, { w: "所以", week: 3 }, { w: "虽然", week: 3 }, { w: "但是", week: 3 },
    { w: "正在", week: 4 }, { w: "更", week: 4 }, { w: "最", week: 4 }, { w: "或者", week: 4 }, { w: "还是", week: 4 },
    { w: "觉得", week: 5 }, { w: "认为", week: 5 }, { w: "打算", week: 5 }, { w: "希望", week: 5 }, { w: "决定", week: 5 },
    { w: "不仅", week: 6 }, { w: "而且", week: 6 }, { w: "只有", week: 6 }, { w: "才", week: 6 }, { w: "只要", week: 6 }, { w: "就", week: 6 }, { w: "吧", week: 6 },
    { w: "既然", week: 7 }, { w: "因此", week: 7 }, { w: "于是", week: 7 }, { w: "无论", week: 7 }, { w: "即使", week: 7 }, { w: "然而", week: 7 },
    { w: "也许", week: 8 }, { w: "甚至", week: 8 }, { w: "尽管", week: 8 }, { w: "恐怕", week: 8 }, { w: "由于", week: 8 }, { w: "至少", week: 8 },
    { w: "被", week: 10 }, { w: "使", week: 10 }, { w: "让", week: 10 }, { w: "连", week: 10 }, { w: "却", week: 10 },
    { w: "除非", week: 11 }, { w: "不得不", week: 11 }, { w: "不可能", week: 11 }, { w: "哪怕", week: 11 },
    { w: "不仅如此", week: 12 }, { w: "无论如何", week: 12 },
  ];

  let WEEK = 1;
  let BASEURL = "";
  let POINTS = [];
  let POOL = []; // flattened sentences across all points this week
  let QUESTIONS = [];
  let idx = 0;
  let score = 0;
  let locked = false;
  let built = []; // tokens the user has placed, in order (scramble/translate)
  let bankRemaining = []; // tokens still available in the bank (scramble/translate)

  function renderExplain() {
    const wrap = $("gExplainWrap");
    if (!wrap) return;
    wrap.innerHTML = POINTS.map((pt) => {
      const ex = pt.sentences[0];
      return `<div class="grammar-point">
        <h3>${escapeHtml(pt.name)}</h3>
        <p class="muted small">${escapeHtml(pt.explain)}</p>
        ${ex ? `<div class="grammar-example" id="gZhContent"><span class="zh">${escapeHtml(ex.zh)}</span><span class="en muted small">${escapeHtml(ex.en)}</span></div>` : ""}
      </div>`;
    }).join("");
    annotateGrammar();
  }

  function buildQuestions(type, seedStr) {
    if (type === "transform") {
      const eligible = POOL.filter((s) => s.transform);
      const shuffled = seededShuffle(eligible, makeRng(seedStr + "|order"));
      return shuffled.map((s) => ({
        type: "transform",
        zh: s.zh,
        en: s.en,
        correct: normalizeZh(s.transform.zh),
        correctDisplay: s.transform.zh,
        hintEn: s.transform.en,
      }));
    }

    const shuffled = seededShuffle(POOL, makeRng(seedStr + "|order"));

    if (type === "fillBlank") {
      return shuffled.map((s, i) => {
        const distractorPool = GRAMMAR_WORDS
          .filter((g) => g.week <= WEEK && g.w !== s.blank.word)
          .map((g) => g.w);
        const distractors = seededSample(distractorPool, 3, makeRng(seedStr + `|d|${i}`));
        const choices = seededShuffle([s.blank.word, ...distractors], makeRng(seedStr + `|c|${i}`));
        return {
          type: "fillBlank",
          zh: s.zh,
          en: s.en,
          tokens: s.tokens,
          blankIndex: s.blank.index,
          correct: s.blank.word,
          choices,
        };
      });
    }

    // scramble & translate share the same build-in-order mechanic
    return shuffled.map((s, i) => ({
      type,
      zh: s.zh,
      en: s.en,
      tokens: s.tokens,
      bank: seededShuffle(s.tokens, makeRng(seedStr + `|b|${i}`)),
    }));
  }

  function setStatus() {
    if ($("gProgress")) $("gProgress").textContent = `Question ${idx + 1} / ${QUESTIONS.length}`;
    if ($("gScoreText")) $("gScoreText").textContent = `Score: ${score}`;
  }

  function renderBankBuilt(q) {
    const bankHtml = bankRemaining
      .map((item) => `<button class="gword" type="button" data-uid="${item.uid}">${escapeHtml(item.tok)}</button>`)
      .join("");
    const builtHtml = built
      .map((item) => `<button class="gword gword-built" type="button" data-uid="${item.uid}">${escapeHtml(item.tok)}</button>`)
      .join("") || `<span class="muted small">Click words below to build the sentence…</span>`;

    if ($("gBuilt")) $("gBuilt").innerHTML = builtHtml;
    if ($("gWordBank")) $("gWordBank").innerHTML = bankHtml;

    $("gBuilt")?.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (locked) return;
        const uid = parseInt(btn.dataset.uid, 10);
        const i = built.findIndex((item) => item.uid === uid);
        if (i === -1) return;
        bankRemaining.push(built[i]);
        built.splice(i, 1);
        renderBankBuilt(q);
      });
    });
    $("gWordBank")?.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (locked) return;
        const uid = parseInt(btn.dataset.uid, 10);
        const i = bankRemaining.findIndex((item) => item.uid === uid);
        if (i === -1) return;
        built.push(bankRemaining[i]);
        bankRemaining.splice(i, 1);
        renderBankBuilt(q);
      });
    });

    if ($("gCheckBtn")) $("gCheckBtn").disabled = built.length !== q.tokens.length;
    annotateGrammar();
  }

  function showQuestion() {
    locked = false;
    if ($("gFeedback")) $("gFeedback").textContent = "";
    if ($("gNextBtn")) $("gNextBtn").disabled = true;

    if (!QUESTIONS.length) {
      if ($("gPrompt")) $("gPrompt").innerHTML = `<span class="muted small">No transformation drills for this week's pattern yet.</span>`;
      if ($("gWordBank")) $("gWordBank").innerHTML = "";
      if ($("gBuilt")) $("gBuilt").innerHTML = "";
      if ($("gOptions")) { $("gOptions").innerHTML = ""; $("gOptions").hidden = true; }
      if ($("gTypingArea")) $("gTypingArea").hidden = true;
      if ($("gWordBankArea")) $("gWordBankArea").hidden = true;
      if ($("gCheckBtn")) $("gCheckBtn").hidden = true;
      if ($("gProgress")) $("gProgress").textContent = "";
      if ($("gScoreText")) $("gScoreText").textContent = "";
      return;
    }

    const q = QUESTIONS[idx];
    if ($("gOptions")) $("gOptions").hidden = q.type !== "fillBlank";
    if ($("gTypingArea")) $("gTypingArea").hidden = q.type !== "transform";
    if ($("gWordBankArea")) $("gWordBankArea").hidden = !(q.type === "scramble" || q.type === "translate");
    if ($("gCheckBtn")) $("gCheckBtn").hidden = q.type === "fillBlank";

    if (q.type === "fillBlank") {
      const display = q.tokens.map((t, i) => (i === q.blankIndex ? '<span class="fill-slot">___</span>' : escapeHtml(t))).join("");
      if ($("gPrompt")) $("gPrompt").innerHTML = `<span id="gZhContent">${display}</span>`;
      if ($("gOptions")) {
        $("gOptions").innerHTML = q.choices
          .map((c) => `<button class="option" type="button" data-choice="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
          .join("");
        $("gOptions").querySelectorAll("button").forEach((btn) => {
          btn.addEventListener("click", () => onFillBlankAnswer(btn, q));
        });
      }
    } else if (q.type === "transform") {
      if ($("gPrompt")) $("gPrompt").innerHTML = `<span id="gZhContent" class="zh">${escapeHtml(q.zh)}</span> <span class="muted small">(${escapeHtml(q.en)})</span>`;
      if ($("gTypingInput")) { $("gTypingInput").value = ""; $("gTypingInput").classList.remove("typing-correct", "typing-wrong"); }
      setTimeout(() => $("gTypingInput")?.focus(), 50);
    } else {
      // scramble / translate
      if ($("gPrompt")) {
        $("gPrompt").innerHTML = q.type === "translate"
          ? `<span class="muted small">Build this sentence in Chinese:</span><br><span>${escapeHtml(q.en)}</span>`
          : `<span class="muted small">Put the words in order:</span><br><span class="muted small">(${escapeHtml(q.en)})</span>`;
      }
      built = [];
      bankRemaining = q.bank.map((tok, uid) => ({ tok, uid }));
      renderBankBuilt(q);
    }

    setStatus();
    annotateGrammar();
  }

  function finishAndLock(isCorrect, correctDisplay) {
    locked = true;
    if (isCorrect) { score += 1; if ($("gFeedback")) $("gFeedback").textContent = "✅ Correct"; }
    else { if ($("gFeedback")) $("gFeedback").textContent = `❌ Incorrect — correct: ${correctDisplay}`; }
    if ($("gNextBtn")) $("gNextBtn").disabled = false;
    setStatus();
  }

  function onFillBlankAnswer(btn, q) {
    if (locked) return;
    const chosen = btn.getAttribute("data-choice");
    const isCorrect = chosen === q.correct;
    $("gOptions")?.querySelectorAll("button").forEach((b) => {
      if (b.getAttribute("data-choice") === q.correct) b.classList.add("correct");
      if (!isCorrect && b === btn) b.classList.add("wrong");
      b.disabled = true;
    });
    finishAndLock(isCorrect, q.correct);
  }

  function onCheckBuilt() {
    if (locked) return;
    const q = QUESTIONS[idx];
    if (!q || built.length !== q.tokens.length) return;
    const isCorrect = built.every((item, i) => item.tok === q.tokens[i]);
    finishAndLock(isCorrect, q.tokens.join(""));
  }

  function onCheckTransform() {
    if (locked) return;
    const q = QUESTIONS[idx];
    const input = $("gTypingInput");
    if (!q || !input) return;
    const isCorrect = normalizeZh(input.value) === q.correct;
    input.classList.add(isCorrect ? "typing-correct" : "typing-wrong");
    finishAndLock(isCorrect, q.correctDisplay);
  }

  function advance() {
    if (!QUESTIONS.length) return;
    if (idx < QUESTIONS.length - 1) { idx++; showQuestion(); } else { finish(); }
  }

  function finish() {
    if ($("gPrompt")) $("gPrompt").textContent = "Done!";
    if ($("gOptions")) $("gOptions").innerHTML = "";
    if ($("gWordBank")) $("gWordBank").innerHTML = "";
    if ($("gBuilt")) $("gBuilt").innerHTML = "";
    if ($("gTypingArea")) $("gTypingArea").hidden = true;
    if ($("gWordBankArea")) $("gWordBankArea").hidden = true;
    if ($("gCheckBtn")) $("gCheckBtn").hidden = true;
    if ($("gFeedback")) $("gFeedback").textContent = `Final score: ${score} / ${QUESTIONS.length}`;
    if ($("gNextBtn")) $("gNextBtn").disabled = true;
    if ($("gProgress")) $("gProgress").textContent = "";
  }

  function startExercise() {
    const type = $("gType")?.value || "scramble";
    const seed = `grammar|week:${WEEK}|type:${type}|run:${newRunSeed()}`;
    QUESTIONS = buildQuestions(type, seed);
    idx = 0;
    score = 0;
    if ($("grammarArea")) $("grammarArea").hidden = false;
    showQuestion();
  }

  function initKeyboardShortcuts() {
    document.addEventListener("keydown", (e) => {
      if ($("grammarArea")?.hidden) return;
      const inText = e.target.matches('input[type="text"], input:not([type]), textarea');
      if (inText) {
        if (e.key === "Enter" && !$("gTypingArea")?.hidden) { e.preventDefault(); onCheckTransform(); }
        return;
      }
      if (e.key === "Enter") {
        if (!$("gNextBtn")?.disabled) { e.preventDefault(); $("gNextBtn")?.click(); }
        else if ($("gCheckBtn") && !$("gCheckBtn").hidden && !$("gCheckBtn").disabled) { e.preventDefault(); $("gCheckBtn")?.click(); }
      }
      if (e.key >= "1" && e.key <= "4" && !$("gOptions")?.hidden) {
        e.preventDefault();
        const btns = $("gOptions")?.querySelectorAll("button:not([disabled])");
        btns?.[parseInt(e.key) - 1]?.click();
      }
    });
  }

  document.addEventListener("DOMContentLoaded", async () => {
    const { week, baseurl } = window.STUDY || { week: 1, baseurl: "" };
    WEEK = week;
    BASEURL = baseurl;

    try {
      const data = await fetchJson(`${baseurl}/assets/data/grammar${pad2(week)}.json`);
      POINTS = Array.isArray(data.points) ? data.points : [];
      POOL = POINTS.flatMap((pt) => pt.sentences || []);
      renderExplain();
    } catch (err) {
      console.error(err);
      if ($("gExplainWrap")) $("gExplainWrap").textContent = "Could not load this week's grammar pattern.";
      return;
    }

    $("gStart")?.addEventListener("click", startExercise);
    $("gNextBtn")?.addEventListener("click", advance);
    $("gRestartBtn")?.addEventListener("click", startExercise);
    $("gCheckBtn")?.addEventListener("click", () => {
      const q = QUESTIONS[idx];
      if (!q) return;
      if (q.type === "transform") onCheckTransform();
      else onCheckBuilt();
    });

    initKeyboardShortcuts();
  });
})();
