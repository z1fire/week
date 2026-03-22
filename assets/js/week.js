
/* assets/js/week.js
   NOTE: file must be saved as UTF-8 and MUST start with "((" (no stray "\" or BOM garbage).
*/
(() => {
  const $ = (id) => document.getElementById(id);

  const pad2 = (n) => String(n).padStart(2, "0");

  // --- encoding-safe escape ---
  function escapeHtml(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  // --- seeded RNG (stable within a run) + per-run random seed (changes each Start/Restart) ---
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
      return Array.from(buf)
        .map((x) => x.toString(16).padStart(8, "0"))
        .join("");
    }
    return `${Date.now().toString(16)}-${Math.random().toString(16).slice(2)}`;
  }

  // --- fetch helpers ---
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

  // --- audio playback ---
  function playAudio(hanzi, baseurl, week) {
    const p = pad2(week);
    const basePath = `${baseurl}/assets/audio/week${p}/${encodeURIComponent(hanzi)}`;
    const sources = [".wav", ".mp3"];

    let audio = null;
    let resolved = false;

    for (const ext of sources) {
      const testPath = `${basePath}${ext}`;
      const testAudio = new Audio(testPath);
      testAudio.oncanplaythrough = () => {
        if (!resolved) {
          resolved = true;
          testAudio.play().catch((err) => console.warn(`Play failed for ${testPath}:`, err));
        }
      };
      testAudio.onerror = () => {
        if (!resolved && ext === sources[sources.length - 1]) {
          console.warn(`No audio available for "${hanzi}" at ${basePath}[_wav|_mp3]
`);
        }
      };
      if (!audio) audio = testAudio;
    }

    if (audio && !resolved) {
      // fallback attempt with first extension if oncanplaythrough not fired quickly
      audio.play().catch((err) => {
        console.warn(`Could not play audio for "${hanzi}" (fallback):`, err);
      });
    }
  }

  function createAudioButton(hanzi, baseurl, week) {
    return `<button class="audio-btn" type="button" data-hanzi="${escapeHtml(hanzi)}" data-baseurl="${escapeHtml(baseurl)}" data-week="${week}" aria-label="Play pronunciation" title="Click to hear pronunciation">🔊</button>`;
  }

  // --- UI builders ---
  function buildStudyTable(words, baseurl, week) {
    const rows = words
      .map((w) => {
        const meanings = Array.isArray(w.meanings) ? w.meanings.join("; ") : String(w.meanings || "");
        const audioBtn = createAudioButton(w.hanzi, baseurl, week);
        return `
          <tr>
            <td class="hanzi">${escapeHtml(w.hanzi)}</td>
            <td>${escapeHtml(w.pinyin)}</td>
            <td>${escapeHtml(meanings)}</td>
            <td class="audio-cell">${audioBtn}</td>
          </tr>
        `;
      })
      .join("");

    return `
      <table class="study-table">
        <thead>
          <tr><th>汉字</th><th>Pinyin</th><th>Meanings</th><th>Audio</th></tr>
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

  // --- video loading ---
  function loadWeekVideo(week, baseurl) {
    const p = pad2(week);
    const videoPath = `${baseurl}/assets/videos/week${p}.mp4`;
    const videoEl = $("weekVideo");
    const fallbackLink = $("videoFallbackLink");

    if (videoEl) {
      videoEl.src = videoPath;
      videoEl.load(); // reload with new source
    }

    if (fallbackLink) {
      fallbackLink.href = videoPath;
    }
  }

  // --- data loading ---
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
      } catch {
        // ignore missing weeks
      }
    }
    return all;
  }

  // =========================
  // QUIZ (multiple-choice)
  // =========================
  let WORDS = [];
  let DISTRACTOR_POOL = [];
  let QUESTIONS = [];
  let idx = 0;
  let score = 0;
  let locked = false;
  let QUIZ_SEED = "";

  function pickMeaningStable(word, seedStr) {
    const meanings = Array.isArray(word.meanings) ? word.meanings : [String(word.meanings || "")];
    const list = meanings.filter((m) => (m || "").trim());
    if (!list.length) return "";
    if (list.length === 1) return list[0];
    const rng = makeRng(seedStr);
    return list[Math.floor(rng() * list.length)];
  }

  function makeQuestions(words, quizType, mode, n, seedStr) {
    const rngPick = makeRng(seedStr + "|pick");

    // Per your requirement: even "All 50" should NOT stay in the same order.
    // So every Start/Restart gets a new seed => new order.
    let picked;
    if (mode === "random") {
      picked = seededSample(words, n, rngPick);
    } else {
      picked = seededShuffle(words, rngPick);
    }

    return picked.map((w, i) => {
      if (quizType === "pinyin") return { prompt: w.pinyin, correct: w.hanzi };
      const meaning = pickMeaningStable(w, seedStr + `|meaning|${i}`);
      return { prompt: meaning, correct: w.hanzi };
    });
  }

  function pickDistractors(pool, correctHanzi, k, seedStr) {
    const options = pool.filter((w) => w.hanzi !== correctHanzi).map((w) => w.hanzi);
    const rng = makeRng(seedStr);
    return seededSample(options, k, rng);
  }

  function setProgress() {
    if ($("progressText")) $("progressText").textContent = `Question ${idx + 1} / ${QUESTIONS.length}`;
    if ($("scoreText")) $("scoreText").textContent = `Score: ${score}`;
  }

  function showQuestion() {
    locked = false;
    if ($("feedback")) $("feedback").textContent = "";
    if ($("nextBtn")) $("nextBtn").disabled = true;

    const q = QUESTIONS[idx];
    if ($("prompt")) $("prompt").textContent = q.prompt;

    // Add audio button for the correct answer (hanzi)
    if ($("quizAudioBtn")) {
      $("quizAudioBtn").innerHTML = createAudioButton(q.correct, window.STUDY?.baseurl || "", window.STUDY?.week || 1);
    }

    // Stable options within this run for this question index
    const qSeed = QUIZ_SEED + `|q|${idx}`;
    const distractors = pickDistractors(DISTRACTOR_POOL, q.correct, 3, qSeed + "|d");
    const choices = seededShuffle([q.correct, ...distractors], makeRng(qSeed + "|c"));

    if ($("options")) {
      $("options").innerHTML = choices
        .map((c) => `<button class="option" type="button" data-choice="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
        .join("");

      $("options").querySelectorAll("button").forEach((btn) => {
        btn.addEventListener("click", () => onAnswer(btn, q.correct));
      });
    }

    setProgress();
  }

  function onAnswer(btn, correct) {
    if (locked) return;
    locked = true;

    const chosen = btn.getAttribute("data-choice");
    const isCorrect = chosen === correct;

    if ($("options")) {
      $("options").querySelectorAll("button").forEach((b) => {
        const c = b.getAttribute("data-choice");
        if (c === correct) b.classList.add("correct");
        if (!isCorrect && b === btn) b.classList.add("wrong");
        b.disabled = true;
      });
    }

    if (isCorrect) {
      score += 1;
      if ($("feedback")) $("feedback").textContent = "✅ Correct";
    } else {
      if ($("feedback")) $("feedback").textContent = `❌ Incorrect — correct answer: ${correct}`;
    }

    if ($("nextBtn")) $("nextBtn").disabled = false;
    if ($("scoreText")) $("scoreText").textContent = `Score: ${score}`;
  }

  function finishQuiz() {
    if ($("prompt")) $("prompt").textContent = "Done!";
    if ($("options")) $("options").innerHTML = "";
    if ($("feedback")) $("feedback").textContent = `Final score: ${score} / ${QUESTIONS.length}`;
    if ($("nextBtn")) $("nextBtn").disabled = true;
    if ($("progressText")) $("progressText").textContent = "";
  }

  async function startQuizFlow(week, baseurl) {
    const quizType = $("quizType")?.value || "pinyin";
    const mode = $("questionMode")?.value || "all";
    const includePrev = $("includePrev")?.checked || false;

    let n = WORDS.length;
    if (mode === "random") {
      const raw = parseInt($("randomCount")?.value || "20", 10);
      n = Number.isFinite(raw) ? Math.max(1, Math.min(raw, WORDS.length)) : 20;
    }

    DISTRACTOR_POOL = [...WORDS];
    if (includePrev) {
      const prev = await loadPrevWeeksWords(week, baseurl);
      DISTRACTOR_POOL = [...WORDS, ...prev];
    }

    // NEW per-run seed: changes each Start/Restart => different "All 50" order each time
    const runSeed = newRunSeed();
    QUIZ_SEED = `quiz|week:${week}|type:${quizType}|mode:${mode}|n:${n}|prev:${includePrev}|run:${runSeed}`;

    QUESTIONS = makeQuestions(WORDS, quizType, mode, n, QUIZ_SEED);
    idx = 0;
    score = 0;

    if ($("quizArea")) $("quizArea").hidden = false;
    showQuestion();
  }

  // =========================
  // FLASHCARDS
  // =========================
  let FC_ORDER = [];
  let fcIndex = 0;
  let fcIsBack = false;
  let fcSeed = "";

  function formatFlashSide(word, which, seedStr) {
    if (which === "hanzi") return word.hanzi || "";
    if (which === "pinyin") return word.pinyin || "";
    if (which === "meaning") return pickMeaningStable(word, seedStr);
    return "";
  }

  function fcUpdateProgress() {
    if ($("fcProgress")) $("fcProgress").textContent = `Card ${fcIndex + 1} / ${FC_ORDER.length}`;
  }

  function fcRender(baseurl, week) {
    if (!FC_ORDER.length) return;
    const word = FC_ORDER[fcIndex];

    // Gather selected fields for front/back
    const frontFields = [];
    if ($("fcFrontHanzi")?.checked) frontFields.push("hanzi");
    if ($("fcFrontPinyin")?.checked) frontFields.push("pinyin");
    if ($("fcFrontMeaning")?.checked) frontFields.push("meaning");

    const backFields = [];
    if ($("fcBackHanzi")?.checked) backFields.push("hanzi");
    if ($("fcBackPinyin")?.checked) backFields.push("pinyin");
    if ($("fcBackMeaning")?.checked) backFields.push("meaning");

    // Render selected fields
    function renderFields(fields, word, seedStr) {
      return fields.map(f => {
        if (f === "hanzi") return `<div class="flash-hanzi">${escapeHtml(word.hanzi || "")}</div>`;
        if (f === "pinyin") return `<div class="flash-pinyin">${escapeHtml(word.pinyin || "")}</div>`;
        if (f === "meaning") return `<div class="flash-meaning">${escapeHtml(pickMeaningStable(word, seedStr))}</div>`;
        return "";
      }).join("");
    }

    const showFields = fcIsBack ? backFields : frontFields;
    const showHtml = renderFields(showFields, word, fcSeed + `|m|${fcIndex}|${fcIsBack ? "back" : "front"}`);
    const audioBtn = createAudioButton(word.hanzi, baseurl, week);

    const card = $("fcCard");
    const face = $("fcFace");
    if (face) {
      face.innerHTML = `<div class="flash-main">${showHtml}</div><div class="flash-audio">${audioBtn}</div>`;
    }

    if (card) card.classList.toggle("is-back", fcIsBack);

    if ($("fcPrev")) $("fcPrev").disabled = fcIndex === 0;
    if ($("fcNext")) $("fcNext").disabled = fcIndex === FC_ORDER.length - 1;

    fcUpdateProgress();
  }

  function fcFlip() {
    fcIsBack = !fcIsBack;
    fcRender();
  }

  function fcGo(delta, baseurl, week) {
    const next = fcIndex + delta;
    if (next < 0 || next >= FC_ORDER.length) return;
    fcIndex = next;
    fcIsBack = false; // always return to front when moving
    fcRender(baseurl, week);
  }

  function fcStart(week, baseurl) {
    if (!WORDS.length) return;

    const shuffleOn = $("fcShuffle")?.checked || false;

    // fresh per-run seed so order can change each time Start is pressed (if Shuffle enabled)
    fcSeed = `flash|week:${week}|run:${newRunSeed()}`;

    const rng = makeRng(fcSeed + "|order");
    FC_ORDER = shuffleOn ? seededShuffle(WORDS, rng) : WORDS.slice();

    fcIndex = 0;
    fcIsBack = false;

    if ($("fcArea")) $("fcArea").hidden = false;
    fcRender(baseurl, week);
  }

  // =========================
  // INIT
  // =========================
  document.addEventListener("DOMContentLoaded", async () => {
    const { week, baseurl } = window.STUDY || { week: 1, baseurl: "" };

    // quiz "Random N" input visibility
    if ($("questionMode") && $("randomCountWrap")) {
      $("questionMode").addEventListener("change", () => {
        $("randomCountWrap").style.display = $("questionMode").value === "random" ? "flex" : "none";
      });
    }

    // load data + reading
    try {
      const { data, zhText, enText } = await loadWeekData(week, baseurl);

      if ($("weekTitle")) $("weekTitle").textContent = data.title ? data.title : `Week ${week}`;
      if ($("youtubeLink")) $("youtubeLink").href = data.youtube || "#";

      WORDS = Array.isArray(data.words) ? data.words : [];
      if ($("studyTableWrap")) $("studyTableWrap").innerHTML = buildStudyTable(WORDS, baseurl, week);

      // reading block (pairs)
      if ($("readingText")) $("readingText").innerHTML = renderReadingPairs(zhText, enText);

      // english toggle only if we have English lines
      const hasEnglish = parseLines(enText).length > 0;
      if ($("englishToggleWrap")) $("englishToggleWrap").style.display = hasEnglish ? "flex" : "none";

      if (hasEnglish && $("toggleEnglish")) {
        $("toggleEnglish").checked = false;
        $("toggleEnglish").addEventListener("change", () => {
          const show = $("toggleEnglish").checked;
          document.querySelectorAll("#readingText .en").forEach((el) => (el.hidden = !show));
        });
      }

      annotateReading();

      // load video
      loadWeekVideo(week, baseurl);
    } catch (err) {
      console.error(err);
      if ($("readingText")) $("readingText").textContent = "Could not load this week’s files. Check assets/data and assets/readings.";
      if ($("englishToggleWrap")) $("englishToggleWrap").style.display = "none";
    }

    // quiz wiring
    if ($("startQuiz")) $("startQuiz").addEventListener("click", async () => startQuizFlow(week, baseurl));
    if ($("nextBtn")) $("nextBtn").addEventListener("click", () => (idx < QUESTIONS.length - 1 ? (idx++, showQuestion()) : finishQuiz()));
    if ($("restartBtn")) $("restartBtn").addEventListener("click", async () => startQuizFlow(week, baseurl));

    // flashcards wiring (only if the elements exist)
    if ($("fcStart")) $("fcStart").addEventListener("click", () => fcStart(week, baseurl));
    if ($("fcCard")) $("fcCard").addEventListener("click", (e) => {
      if (e.target.closest('.audio-btn')) return; // avoid flip when audio button clicked
      fcFlip();
    });
    if ($("fcFlip")) $("fcFlip").addEventListener("click", fcFlip);
    if ($("fcPrev")) $("fcPrev").addEventListener("click", () => fcGo(-1, baseurl, week));
    if ($("fcNext")) $("fcNext").addEventListener("click", () => fcGo(1, baseurl, week));

    if ($("fcFront")) $("fcFront").addEventListener("change", () => { fcIsBack = false; fcRender(baseurl, week); });
    if ($("fcBack")) $("fcBack").addEventListener("change", () => { fcIsBack = false; fcRender(baseurl, week); });
    if ($("fcShuffle")) $("fcShuffle").addEventListener("change", () => {
      // don't auto-reorder mid-session; user can hit Start again
    });

    // audio buttons
    document.addEventListener("click", (e) => {
      if (e.target.classList.contains("audio-btn")) {
        const hanzi = e.target.getAttribute("data-hanzi");
        const audioBaseurl = e.target.getAttribute("data-baseurl");
        const audioWeek = parseInt(e.target.getAttribute("data-week"), 10);
        playAudio(hanzi, audioBaseurl, audioWeek);
      }
    });
  });
})();
