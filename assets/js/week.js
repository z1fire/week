
/* assets/js/week.js */
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

  // --- seeded RNG ---
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

  // --- TTS (Web Speech API) ---
  function speakChinese(text) {
    if (!window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utt = new SpeechSynthesisUtterance(text);
    utt.lang = "zh-CN";
    utt.rate = 0.85;
    window.speechSynthesis.speak(utt);
  }
  window._speakChinese = speakChinese;

  // --- audio playback (file-based, falls back silently) ---
  function playAudio(hanzi, baseurl, week) {
    const p = pad2(week);
    const basePath = `${baseurl}/assets/audio/week${p}/${encodeURIComponent(hanzi)}`;
    let resolved = false;
    for (const ext of [".wav", ".mp3"]) {
      const a = new Audio(`${basePath}${ext}`);
      a.oncanplaythrough = () => {
        if (!resolved) { resolved = true; a.play().catch(() => {}); }
      };
    }
  }

  function createAudioButton(hanzi, baseurl, week) {
    return `<button class="audio-btn" type="button" data-hanzi="${escapeHtml(hanzi)}" data-baseurl="${escapeHtml(baseurl)}" data-week="${week}" aria-label="Play pronunciation" title="Play pronunciation">🔊</button>`;
  }

  // --- pinyin / text normalization for typing quiz ---
  function normalizePinyin(s) {
    return s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/\s+/g, "").trim();
  }

  function normalizeText(s) { return s.toLowerCase().trim(); }

  // --- UI builders ---
  function buildStudyTable(words, baseurl, week) {
    const rows = words.map((w) => {
      const meanings = Array.isArray(w.meanings) ? w.meanings.join("; ") : String(w.meanings || "");
      const mastery = window.Progress ? window.Progress.getWordMastery(w.hanzi) : 0;
      const dots = "●".repeat(mastery) + "○".repeat(5 - mastery);
      return `<tr>
        <td class="hanzi">${escapeHtml(w.hanzi)}</td>
        <td>${escapeHtml(w.pinyin)}</td>
        <td>${escapeHtml(meanings)}</td>
        <td class="audio-cell">${createAudioButton(w.hanzi, baseurl, week)}</td>
        <td class="mastery-cell" title="Mastery ${mastery}/5"><span class="mastery-dots">${dots}</span></td>
      </tr>`;
    }).join("");

    return `<table class="study-table">
      <thead><tr><th>汉字</th><th>Pinyin</th><th>Meanings</th><th>Audio</th><th>Mastery</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
  }

  function renderReadingPairs(zhText, enText) {
    const zh = parseLines(zhText);
    const en = parseLines(enText);
    return zh.map((z, i) => {
      const maybeEn = en[i] ? `<div class="en" hidden>${escapeHtml(en[i])}</div>` : "";
      return `<div class="read-line"><div class="zh">${escapeHtml(z)}</div>${maybeEn}</div>`;
    }).join("");
  }

  function annotateReading() {
    if (window.mandarinspot && typeof window.mandarinspot.annotate === "function") {
      window.mandarinspot.annotate("#readingText", { phonetic: "pinyin", inline: false, show: true });
    }
  }

  // --- video ---
  function loadWeekVideo(week, baseurl) {
    const p = pad2(week);
    const path = `${baseurl}/assets/videos/week${p}.mp4`;
    if ($("weekVideo")) $("weekVideo").src = path;
    if ($("videoFallbackLink")) $("videoFallbackLink").href = path;
  }

  // --- data loading ---
  async function loadWeekData(week, baseurl) {
    const p = pad2(week);
    const data = await fetchJson(`${baseurl}/assets/data/week${p}.json`);
    const zhText = await fetchText(`${baseurl}/assets/readings/week${p}.txt`);
    let enText = "";
    try { enText = await fetchText(`${baseurl}/assets/readings/week${p}_en.txt`); } catch {}
    return { data, zhText, enText };
  }

  async function loadPrevWeeksWords(week, baseurl) {
    const all = [];
    for (let w = 1; w < week; w++) {
      try {
        const d = await fetchJson(`${baseurl}/assets/data/week${pad2(w)}.json`);
        if (Array.isArray(d.words)) all.push(...d.words);
      } catch {}
    }
    return all;
  }

  // --- stats badge ---
  function updateWeekStatsBadge(week) {
    const el = $("weekStatsBadge");
    if (!el || !window.Progress) return;
    const { mastered, total } = window.Progress.getWeekSummary(week);
    const last = window.Progress.getWeekLastScore(week);
    let text = `${mastered} / ${total} mastered`;
    if (last) text += ` · Last quiz: ${last.pct}%`;
    el.textContent = text;
  }

  // =========================
  // QUIZ
  // =========================
  let WORDS = [];
  let READING_ZH = "";
  let DISTRACTOR_POOL = [];
  let QUESTIONS = [];
  let WORD_RESULTS = [];
  let idx = 0;
  let score = 0;
  let locked = false;
  let QUIZ_SEED = "";
  let CURRENT_QUIZ_TYPE = "pinyin";

  function pickMeaningStable(word, seedStr) {
    const meanings = Array.isArray(word.meanings) ? word.meanings : [String(word.meanings || "")];
    const list = meanings.filter((m) => (m || "").trim());
    if (!list.length) return "";
    if (list.length === 1) return list[0];
    const rng = makeRng(seedStr);
    return list[Math.floor(rng() * list.length)];
  }

  function makeFillBlankQuestions(words, zhText, seedStr) {
    const sentences = parseLines(zhText).filter((s) => s.length >= 4);
    const shuffled = seededShuffle(words, makeRng(seedStr + "|fb"));
    const questions = [];
    shuffled.forEach((w) => {
      const sentence = sentences.find((s) => s.includes(w.hanzi));
      if (!sentence) return;
      questions.push({
        prompt: sentence.replace(w.hanzi, "___"),
        correct: w.hanzi,
        word: w,
        subtype: "fill-blank",
      });
    });
    return questions;
  }

  function makeQuestions(words, quizType, mode, n, seedStr) {
    if (quizType === "fill-blank") {
      const all = makeFillBlankQuestions(words, READING_ZH, seedStr);
      return mode === "random" ? all.slice(0, n) : all;
    }

    const rngPick = makeRng(seedStr + "|pick");
    const picked = mode === "random"
      ? seededSample(words, n, rngPick)
      : seededShuffle(words, rngPick);

    return picked.map((w, i) => {
      if (quizType === "pinyin") {
        return { prompt: w.pinyin, correct: w.hanzi, word: w, subtype: "mc" };
      }
      if (quizType === "meaning") {
        const meaning = pickMeaningStable(w, seedStr + `|meaning|${i}`);
        return { prompt: meaning, correct: w.hanzi, word: w, subtype: "mc" };
      }
      if (quizType === "type-pinyin") {
        return { prompt: w.hanzi, correct: w.pinyin, word: w, subtype: "type-pinyin" };
      }
      if (quizType === "type-meaning") {
        const meanings = Array.isArray(w.meanings) ? w.meanings : [String(w.meanings || "")];
        return { prompt: w.hanzi, correct: meanings[0], allCorrect: meanings, word: w, subtype: "type-meaning" };
      }
      if (quizType === "listening") {
        return { prompt: w.hanzi, correct: w.hanzi, word: w, subtype: "listening" };
      }
      const meaning = pickMeaningStable(w, seedStr + `|meaning|${i}`);
      return { prompt: meaning, correct: w.hanzi, word: w, subtype: "mc" };
    });
  }

  function pickDistractors(pool, correctHanzi, k, seedStr) {
    const options = pool.filter((w) => w.hanzi !== correctHanzi).map((w) => w.hanzi);
    return seededSample(options, k, makeRng(seedStr));
  }

  function setProgress() {
    if ($("progressText")) $("progressText").textContent = `Question ${idx + 1} / ${QUESTIONS.length}`;
    if ($("scoreText")) $("scoreText").textContent = `Score: ${score}`;
  }

  function renderMCOptions(choices, correct, hanziForAudio) {
    if (!$("options")) return;
    $("options").innerHTML = choices
      .map((c) => `<button class="option" type="button" data-choice="${escapeHtml(c)}">${escapeHtml(c)}</button>`)
      .join("");
    $("options").querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", () => onMCAnswer(btn, correct, hanziForAudio));
    });
  }

  function showQuestion() {
    locked = false;
    if ($("feedback")) $("feedback").textContent = "";
    if ($("nextBtn")) $("nextBtn").disabled = true;

    const q = QUESTIONS[idx];
    const { subtype } = q;
    const isTyping = subtype === "type-pinyin" || subtype === "type-meaning";
    const isListening = subtype === "listening";
    const { week, baseurl } = window.STUDY || { week: 1, baseurl: "" };

    if ($("options")) $("options").hidden = isTyping;
    if ($("typingArea")) $("typingArea").hidden = !isTyping;
    if ($("typingInput")) {
      $("typingInput").value = "";
      $("typingInput").classList.remove("typing-correct", "typing-wrong");
    }

    if (isTyping) {
      if ($("prompt")) $("prompt").textContent = q.prompt;
      if ($("quizAudioBtn")) {
        $("quizAudioBtn").innerHTML = createAudioButton(q.word.hanzi, baseurl, week);
      }
      if ($("typingHint")) {
        $("typingHint").textContent = subtype === "type-pinyin"
          ? "Type the pinyin (tone marks optional):"
          : "Type the English meaning:";
      }
      setTimeout(() => $("typingInput")?.focus(), 50);

    } else if (isListening) {
      if ($("prompt")) $("prompt").innerHTML = `<span class="listening-icon" title="Click to replay" role="button" tabindex="0">🔊</span>`;
      if ($("quizAudioBtn")) {
        $("quizAudioBtn").innerHTML = `<button class="btn ghost replay-btn" type="button">↩ Replay</button>`;
        $("quizAudioBtn").querySelector(".replay-btn")
          ?.addEventListener("click", () => speakChinese(q.prompt));
        const icon = $("prompt")?.querySelector(".listening-icon");
        if (icon) icon.addEventListener("click", () => speakChinese(q.prompt));
      }
      speakChinese(q.prompt);
      const qSeed = QUIZ_SEED + `|q|${idx}`;
      const distractors = pickDistractors(DISTRACTOR_POOL, q.correct, 3, qSeed + "|d");
      const choices = seededShuffle([q.correct, ...distractors], makeRng(qSeed + "|c"));
      renderMCOptions(choices, q.correct, q.word.hanzi);

    } else {
      if ($("prompt")) {
        if (q.subtype === "fill-blank") {
          $("prompt").innerHTML = escapeHtml(q.prompt).replace(
            "___", '<span class="fill-slot">___</span>'
          );
        } else {
          $("prompt").textContent = q.prompt;
        }
      }
      if ($("quizAudioBtn")) {
        $("quizAudioBtn").innerHTML = createAudioButton(q.correct, baseurl, week);
      }
      const qSeed = QUIZ_SEED + `|q|${idx}`;
      const distractors = pickDistractors(DISTRACTOR_POOL, q.correct, 3, qSeed + "|d");
      const choices = seededShuffle([q.correct, ...distractors], makeRng(qSeed + "|c"));
      renderMCOptions(choices, q.correct, q.word.hanzi);
    }

    setProgress();
  }

  function onMCAnswer(btn, correct, hanzi) {
    if (locked) return;
    locked = true;
    const chosen = btn.getAttribute("data-choice");
    const isCorrect = chosen === correct;
    WORD_RESULTS.push({ hanzi, correct: isCorrect });

    if ($("options")) {
      $("options").querySelectorAll("button").forEach((b) => {
        if (b.getAttribute("data-choice") === correct) b.classList.add("correct");
        if (!isCorrect && b === btn) b.classList.add("wrong");
        b.disabled = true;
      });
    }

    if (isCorrect) { score += 1; if ($("feedback")) $("feedback").textContent = "✅ Correct"; }
    else { if ($("feedback")) $("feedback").textContent = `❌ Incorrect — correct: ${correct}`; }

    if ($("nextBtn")) $("nextBtn").disabled = false;
    if ($("scoreText")) $("scoreText").textContent = `Score: ${score}`;
  }

  function onTypingAnswer() {
    if (locked) return;
    const q = QUESTIONS[idx];
    const input = $("typingInput");
    if (!input) return;

    let isCorrect = false;
    if (q.subtype === "type-pinyin") {
      isCorrect = normalizePinyin(input.value) === normalizePinyin(q.correct);
    } else {
      const all = Array.isArray(q.allCorrect) ? q.allCorrect : [q.correct];
      isCorrect = all.some((m) => normalizeText(input.value) === normalizeText(m));
    }

    locked = true;
    WORD_RESULTS.push({ hanzi: q.word.hanzi, correct: isCorrect });

    if (isCorrect) {
      score += 1;
      if ($("feedback")) $("feedback").textContent = "✅ Correct!";
      input.classList.add("typing-correct");
    } else {
      if ($("feedback")) $("feedback").textContent = `❌ Incorrect — correct: ${q.correct}`;
      input.classList.add("typing-wrong");
    }

    if ($("scoreText")) $("scoreText").textContent = `Score: ${score}`;
    if ($("nextBtn")) $("nextBtn").disabled = false;

    setTimeout(() => {
      if (!locked) return;
      input.classList.remove("typing-correct", "typing-wrong");
      if (idx < QUESTIONS.length - 1) { idx++; showQuestion(); } else { finishQuiz(); }
    }, 1500);
  }

  function advanceQuiz() {
    if (idx < QUESTIONS.length - 1) { idx++; showQuestion(); } else { finishQuiz(); }
  }

  function finishQuiz() {
    if ($("prompt")) $("prompt").textContent = "Done!";
    if ($("options")) $("options").innerHTML = "";
    if ($("typingArea")) $("typingArea").hidden = true;
    if ($("quizAudioBtn")) $("quizAudioBtn").innerHTML = "";
    if ($("feedback")) $("feedback").textContent = `Final score: ${score} / ${QUESTIONS.length}`;
    if ($("nextBtn")) $("nextBtn").disabled = true;
    if ($("progressText")) $("progressText").textContent = "";

    if (window.Progress) {
      const { week } = window.STUDY || { week: 1 };
      window.Progress.recordQuizResult(week, CURRENT_QUIZ_TYPE, score, QUESTIONS.length, WORD_RESULTS);
      window.Progress.updateWeekSummary(week, WORDS);
      updateWeekStatsBadge(week);
    }
  }

  async function startQuizFlow(week, baseurl) {
    CURRENT_QUIZ_TYPE = $("quizType")?.value || "pinyin";
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

    QUIZ_SEED = `quiz|week:${week}|type:${CURRENT_QUIZ_TYPE}|mode:${mode}|n:${n}|prev:${includePrev}|run:${newRunSeed()}`;
    QUESTIONS = makeQuestions(WORDS, CURRENT_QUIZ_TYPE, mode, n, QUIZ_SEED);
    WORD_RESULTS = [];
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

  function fcUpdateProgress() {
    if ($("fcProgress")) $("fcProgress").textContent = `Card ${fcIndex + 1} / ${FC_ORDER.length}`;
  }

  function fcRender(baseurl, week) {
    if (!FC_ORDER.length) return;
    const word = FC_ORDER[fcIndex];

    const frontFields = [
      $("fcFrontHanzi")?.checked && "hanzi",
      $("fcFrontPinyin")?.checked && "pinyin",
      $("fcFrontMeaning")?.checked && "meaning",
    ].filter(Boolean);

    const backFields = [
      $("fcBackHanzi")?.checked && "hanzi",
      $("fcBackPinyin")?.checked && "pinyin",
      $("fcBackMeaning")?.checked && "meaning",
    ].filter(Boolean);

    function renderFields(fields) {
      return fields.map((f) => {
        if (f === "hanzi") return `<div class="flash-hanzi">${escapeHtml(word.hanzi || "")}</div>`;
        if (f === "pinyin") return `<div class="flash-pinyin">${escapeHtml(word.pinyin || "")}</div>`;
        if (f === "meaning") return `<div class="flash-meaning">${escapeHtml(pickMeaningStable(word, fcSeed + `|m|${fcIndex}|${fcIsBack ? "back" : "front"}`))}</div>`;
        return "";
      }).join("");
    }

    const showHtml = renderFields(fcIsBack ? backFields : frontFields);
    const face = $("fcFace");
    if (face) {
      face.innerHTML = `<div class="flash-main">${showHtml}</div><div class="flash-audio">${createAudioButton(word.hanzi, baseurl, week)}</div>`;
    }

    const card = $("fcCard");
    if (card) card.classList.toggle("is-back", fcIsBack);
    if ($("fcPrev")) $("fcPrev").disabled = fcIndex === 0;
    if ($("fcNext")) $("fcNext").disabled = fcIndex === FC_ORDER.length - 1;
    fcUpdateProgress();
  }

  function fcFlip(baseurl, week) { fcIsBack = !fcIsBack; fcRender(baseurl, week); }

  function fcGo(delta, baseurl, week) {
    const next = fcIndex + delta;
    if (next < 0 || next >= FC_ORDER.length) return;
    fcIndex = next;
    fcIsBack = false;
    fcRender(baseurl, week);
  }

  function fcStart(week, baseurl) {
    if (!WORDS.length) return;
    fcSeed = `flash|week:${week}|run:${newRunSeed()}`;
    FC_ORDER = $("fcShuffle")?.checked
      ? seededShuffle(WORDS, makeRng(fcSeed + "|order"))
      : WORDS.slice();
    fcIndex = 0;
    fcIsBack = false;
    if ($("fcArea")) $("fcArea").hidden = false;
    fcRender(baseurl, week);
  }

  // =========================
  // WRITING TAB (HanziWriter)
  // =========================
  let WRITE_WORD_IDX = -1;
  let WRITE_CHAR_IDX = 0;
  let hwCurrentWriter = null;
  let hwLoaded = false;
  let hwLoading = false;

  function loadHanziWriter(cb) {
    if (hwLoaded) { cb(); return; }
    if (hwLoading) {
      const poll = setInterval(() => { if (hwLoaded) { clearInterval(poll); cb(); } }, 100);
      return;
    }
    hwLoading = true;
    const s = document.createElement("script");
    s.src = "https://cdn.jsdelivr.net/npm/hanzi-writer@3.5/dist/hanzi-writer.min.js";
    s.onload = () => { hwLoaded = true; cb(); };
    s.onerror = () => console.error("HanziWriter failed to load");
    document.head.appendChild(s);
  }

  function hwColors() {
    const light = document.documentElement.getAttribute("data-theme") === "light";
    return {
      strokeColor:   light ? "#2d62ff" : "#7aa2ff",
      radicalColor:  light ? "#0fa96a" : "#4ee59a",
      outlineColor:  light ? "rgba(0,0,0,0.18)" : "rgba(255,255,255,0.20)",
      drawingColor:  light ? "#121a2b" : "#e9eefc",
    };
  }

  function renderWordGrid() {
    const container = $("writeWordGrid");
    if (!container || !WORDS.length) return;
    container.innerHTML = WORDS.map((w, i) => {
      const tip = `${escapeHtml(w.pinyin)} · ${Array.isArray(w.meanings) ? escapeHtml(w.meanings[0]) : escapeHtml(String(w.meanings || ""))}`;
      return `<button class="write-word-btn" type="button" data-widx="${i}" title="${tip}">${escapeHtml(w.hanzi)}</button>`;
    }).join("");
    container.querySelectorAll(".write-word-btn").forEach((btn) => {
      btn.addEventListener("click", () => selectWriteWord(parseInt(btn.dataset.widx, 10)));
    });
  }

  function selectWriteWord(wordIdx) {
    WRITE_WORD_IDX = wordIdx;
    WRITE_CHAR_IDX = 0;
    const word = WORDS[wordIdx];
    const chars = [...word.hanzi];

    // Highlight selected grid button
    document.querySelectorAll(".write-word-btn").forEach((btn, i) => {
      btn.classList.toggle("active", i === wordIdx);
    });

    // Show the detail panel
    if ($("writeSelected")) $("writeSelected").hidden = false;

    // Update word info
    if ($("writeWordHanzi")) $("writeWordHanzi").textContent = word.hanzi;
    if ($("writeWordPinyin")) $("writeWordPinyin").textContent = word.pinyin;
    if ($("writeWordMeaning")) $("writeWordMeaning").textContent = Array.isArray(word.meanings) ? word.meanings.join(", ") : word.meanings;

    // Render character tabs only for multi-char words
    const tabsEl = $("writeCharTabs");
    if (tabsEl) {
      if (chars.length > 1) {
        tabsEl.innerHTML = chars.map((c, i) =>
          `<button class="write-char-tab${i === 0 ? " active" : ""}" type="button" data-cidx="${i}">${escapeHtml(c)}</button>`
        ).join("");
        tabsEl.querySelectorAll(".write-char-tab").forEach((tab) => {
          tab.addEventListener("click", () => selectWriteChar(parseInt(tab.dataset.cidx, 10)));
        });
        tabsEl.hidden = false;
      } else {
        tabsEl.hidden = true;
      }
    }

    if ($("writeFeedback")) $("writeFeedback").textContent = "";
    resetWriteCanvas();
  }

  function selectWriteChar(charIdx) {
    WRITE_CHAR_IDX = charIdx;
    document.querySelectorAll(".write-char-tab").forEach((tab, i) => {
      tab.classList.toggle("active", i === charIdx);
    });
    if ($("writeFeedback")) $("writeFeedback").textContent = "";
    resetWriteCanvas();
  }

  function resetWriteCanvas() {
    if (hwCurrentWriter) { try { hwCurrentWriter.cancelQuiz(); } catch {} hwCurrentWriter = null; }
    const canvas = $("writeCharCanvas");
    if (canvas) canvas.innerHTML = `<p class="muted small hw-placeholder">Click Animate or Practice to load stroke diagram.</p>`;
  }

  function currentWriteChar() {
    if (WRITE_WORD_IDX < 0 || !WORDS.length) return null;
    return [...WORDS[WRITE_WORD_IDX].hanzi][WRITE_CHAR_IDX] || null;
  }

  function createWriterForCurrentChar(callback) {
    const char = currentWriteChar();
    if (!char) return;

    loadHanziWriter(() => {
      if (hwCurrentWriter) { try { hwCurrentWriter.cancelQuiz(); } catch {} }

      const canvas = $("writeCharCanvas");
      if (!canvas) return;
      canvas.innerHTML = "";

      const div = document.createElement("div");
      div.id = "hw-single";
      canvas.appendChild(div);

      const col = hwColors();
      let writer;
      try {
        writer = HanziWriter.create("hw-single", char, {
          width: 250, height: 250, padding: 8,
          showCharacter: true,
          strokeColor:   col.strokeColor,
          radicalColor:  col.radicalColor,
          outlineColor:  col.outlineColor,
          drawingColor:  col.drawingColor,
          strokeAnimationSpeed: 1,
          delayBetweenStrokes: 200,
          onLoadCharDataError: () => {
            div.innerHTML = `<div class="hw-unsupported">${escapeHtml(char)}<br><small class="muted">Stroke data unavailable</small></div>`;
            hwCurrentWriter = null;
          },
        });
        hwCurrentWriter = writer;
        if (callback) callback(writer);
      } catch {
        div.innerHTML = `<div class="hw-unsupported">${escapeHtml(char)}</div>`;
        hwCurrentWriter = null;
      }
    });
  }

  function animateCurrentChar() {
    if (WRITE_WORD_IDX < 0) return;
    if (hwCurrentWriter) {
      hwCurrentWriter.cancelQuiz();
      hwCurrentWriter.animateCharacter();
    } else {
      createWriterForCurrentChar((w) => w.animateCharacter());
    }
  }

  function practiceCurrentChar() {
    const char = currentWriteChar();
    if (!char) return;
    const startQuiz = (writer) => {
      if (!writer) return;
      if ($("writeFeedback")) $("writeFeedback").textContent = `✏️ Trace each stroke of ${char}`;
      writer.quiz({
        onMistake: () => { if ($("writeFeedback")) $("writeFeedback").textContent = `✏️ Tracing ${char} — keep going!`; },
        onCorrectStroke: () => {},
        onComplete: (summary) => {
          const m = summary.totalMistakes || 0;
          if ($("writeFeedback")) $("writeFeedback").textContent = m === 0 ? `✅ ${char} — Perfect! No mistakes.` : `✅ ${char} done — ${m} mistake${m !== 1 ? "s" : ""}`;
          if (window.Progress) {
            const { week } = window.STUDY || { week: 1 };
            window.Progress.recordWritingPractice(char);
            window.Progress.updateWeekSummary(week, WORDS);
            updateWeekStatsBadge(week);
          }
        },
      });
    };
    if (hwCurrentWriter) { hwCurrentWriter.cancelQuiz(); startQuiz(hwCurrentWriter); }
    else { createWriterForCurrentChar(startQuiz); }
  }

  function showCurrentChar() {
    if (hwCurrentWriter) hwCurrentWriter.showCharacter();
    else createWriterForCurrentChar((w) => w?.showCharacter());
  }

  // =========================
  // WORKSHEET GENERATOR
  // =========================
  function tianGridSvg(s) {
    const h = s / 2;
    return `<rect x="0.5" y="0.5" width="${s - 1}" height="${s - 1}" stroke="#b0b0b0" stroke-width="0.8" fill="none"/>
    <line x1="${h}" y1="0" x2="${h}" y2="${s}" stroke="#c8c8c8" stroke-width="0.5" stroke-dasharray="3,2"/>
    <line x1="0" y1="${h}" x2="${s}" y2="${h}" stroke="#c8c8c8" stroke-width="0.5" stroke-dasharray="3,2"/>`;
  }

  function miGridSvg(s) {
    const h = s / 2;
    return tianGridSvg(s) + `
    <line x1="0" y1="0" x2="${s}" y2="${s}" stroke="#c8c8c8" stroke-width="0.5" stroke-dasharray="3,2"/>
    <line x1="${s}" y1="0" x2="0" y2="${s}" stroke="#c8c8c8" stroke-width="0.5" stroke-dasharray="3,2"/>`;
  }

  function generateWorksheet() {
    if (!WORDS.length) return;

    const wordCountVal = $("wsWordCount")?.value || "20";
    const practiceBoxes = parseInt($("wsPracticeBoxes")?.value || "5", 10);
    const traceBoxes    = parseInt($("wsTraceBoxes")?.value    || "2", 10);
    const gridType      = $("wsGridType")?.value    || "tian";
    const showPinyin    = $("wsShowPinyin")?.checked  ?? true;
    const showMeaning   = $("wsShowMeaning")?.checked ?? true;

    const words = WORDS.slice(0, parseInt(wordCountVal, 10));
    const { week } = window.STUDY || { week: 1 };
    const CELL = 72;
    const gridSvg = gridType === "mi" ? miGridSvg(CELL) : tianGridSvg(CELL);

    // Expand compound words to per-character rows
    const entries = [];
    words.forEach((w) => {
      const chars  = [...w.hanzi];
      const meaning = Array.isArray(w.meanings) ? w.meanings[0] : String(w.meanings || "");
      if (chars.length === 1) {
        entries.push({ char: chars[0], pinyin: w.pinyin, meaning, partOf: "" });
      } else {
        chars.forEach((c, i) => {
          entries.push({ char: c, pinyin: w.pinyin, meaning, partOf: `${w.hanzi} ${i + 1}/${chars.length}` });
        });
      }
    });

    function boxSvg(char) {
      const overlay = char
        ? `<span class="ws-overlay ws-trace">${escapeHtml(char)}</span>`
        : "";
      return `<div class="ws-box"><svg xmlns="http://www.w3.org/2000/svg" width="${CELL}" height="${CELL}">${gridSvg}</svg>${overlay}</div>`;
    }

    function refBox(char) {
      return `<div class="ws-box ws-ref"><svg xmlns="http://www.w3.org/2000/svg" width="${CELL}" height="${CELL}">${gridSvg}</svg><span class="ws-overlay ws-full">${escapeHtml(char)}</span></div>`;
    }

    const rows = entries.map((e) => {
      const py = showPinyin  ? `<div class="ws-py">${escapeHtml(e.pinyin)}</div>`  : "";
      const mn = showMeaning ? `<div class="ws-mn">${escapeHtml(e.meaning)}</div>` : "";
      const pt = e.partOf    ? `<div class="ws-pt">${escapeHtml(e.partOf)}</div>`  : "";
      const traces  = Array.from({ length: traceBoxes    }, () => boxSvg(e.char)).join("");
      const empties = Array.from({ length: practiceBoxes }, () => boxSvg("")).join("");
      return `<div class="ws-row">${refBox(e.char)}<div class="ws-info">${py}${mn}${pt}</div><div class="ws-boxes">${traces}${empties}</div></div>`;
    }).join("");

    const title = `Week ${week} — Handwriting Practice`;
    const today = new Date().toLocaleDateString();
    const charFonts = "'KaiTi','STKaiti','AR PL UKai CN','FZKai-Z03','Kaiti SC','BiauKai','SimSun',serif";
    const fs = Math.round(CELL * 0.82);

    const html = `<!DOCTYPE html>
<html lang="zh">
<head>
<meta charset="utf-8">
<title>${escapeHtml(title)}</title>
<style>
*{box-sizing:border-box;margin:0;padding:0;}
body{font-family:Arial,sans-serif;padding:15mm 14mm;color:#111;background:#fff;font-size:12px;}
.no-print{display:flex;gap:8px;align-items:center;margin-bottom:14px;padding:10px 12px;background:#f5f5f5;border-radius:6px;border:1px solid #ddd;}
.no-print button{padding:7px 16px;font-size:.95rem;cursor:pointer;border:1px solid #bbb;border-radius:4px;background:#fff;}
.no-print button:hover{background:#e8e8e8;}
.tip{color:#777;font-size:.8rem;margin-left:8px;}
.ws-header{border-bottom:2px solid #111;padding-bottom:8px;margin-bottom:12px;}
.ws-header h1{font-size:1.2rem;font-weight:800;margin-bottom:3px;}
.ws-meta{color:#777;font-size:.78rem;}
.ws-row{display:flex;align-items:center;gap:6px;padding:4px 0;border-bottom:1px solid #eee;break-inside:avoid;}
.ws-box{position:relative;width:${CELL}px;height:${CELL}px;flex-shrink:0;}
.ws-box svg{display:block;position:absolute;top:0;left:0;}
.ws-overlay{position:absolute;top:50%;left:50%;transform:translate(-50%,-50%);font-family:${charFonts};font-size:${fs}px;line-height:1;pointer-events:none;user-select:none;}
.ws-full{color:#111;}
.ws-trace{color:rgba(0,0,0,.14);}
.ws-info{width:84px;flex-shrink:0;line-height:1.45;}
.ws-py{font-weight:700;color:#222;font-size:.82rem;}
.ws-mn{color:#555;font-size:.78rem;}
.ws-pt{color:#aaa;font-size:.70rem;}
.ws-boxes{display:flex;gap:3px;flex:1;flex-wrap:wrap;}
@media print{.no-print{display:none!important;}body{padding:10mm 12mm;}}
</style>
</head>
<body>
<div class="no-print">
  <button onclick="window.print()">&#128424; Print</button>
  <button onclick="window.close()">&#x2715; Close</button>
  <span class="tip">Tip: set page margins to "Minimum" in print settings for best results.</span>
</div>
<div class="ws-header">
  <h1>${escapeHtml(title)}</h1>
  <div class="ws-meta">${entries.length} characters &middot; ${escapeHtml(today)} &middot; Mandarin Study Companion</div>
</div>
${rows}
</body>
</html>`;

    const win = window.open("", "_blank");
    if (!win) { alert("Please allow pop-ups for this site to generate the worksheet."); return; }
    win.document.write(html);
    win.document.close();
  }

  // =========================
  // KEYBOARD SHORTCUTS
  // =========================
  function initKeyboardShortcuts(baseurl, week) {
    document.addEventListener("keydown", (e) => {
      const inText = e.target.matches('input[type="text"], input:not([type]), textarea');

      // Quiz area shortcuts
      if (!$("quizArea")?.hidden) {
        if (inText) {
          if (e.key === "Enter" && !$("typingArea")?.hidden) {
            e.preventDefault();
            onTypingAnswer();
          }
        } else {
          if (e.key >= "1" && e.key <= "4") {
            e.preventDefault();
            const btns = $("options")?.querySelectorAll("button:not([disabled])");
            btns?.[parseInt(e.key) - 1]?.click();
          }
          if (e.key === "Enter" && !$("nextBtn")?.disabled) {
            e.preventDefault();
            $("nextBtn")?.click();
          }
          if (e.key === "r" || e.key === "R") {
            e.preventDefault();
            document.querySelector(".audio-btn")?.click();
          }
        }
      }

      // Flashcard shortcuts
      if (!$("fcArea")?.hidden && !inText) {
        if (e.key === " " || e.key === "Enter") { e.preventDefault(); $("fcFlip")?.click(); }
        if (e.key === "ArrowLeft")  { e.preventDefault(); $("fcPrev")?.click(); }
        if (e.key === "ArrowRight") { e.preventDefault(); $("fcNext")?.click(); }
      }
    });
  }

  // =========================
  // INIT
  // =========================
  document.addEventListener("DOMContentLoaded", async () => {
    const { week, baseurl } = window.STUDY || { week: 1, baseurl: "" };

    // Hide listening option if TTS unavailable
    if (!window.speechSynthesis) {
      $("quizType")?.querySelector('option[value="listening"]')?.remove();
    }

    // Random N visibility
    $("questionMode")?.addEventListener("change", () => {
      if ($("randomCountWrap")) $("randomCountWrap").hidden = $("questionMode").value !== "random";
    });

    // Load data
    try {
      const { data, zhText, enText } = await loadWeekData(week, baseurl);

      if ($("weekTitle")) $("weekTitle").textContent = data.title || `Week ${week}`;
      if ($("youtubeLink")) $("youtubeLink").href = data.youtube || "#";

      WORDS = Array.isArray(data.words) ? data.words : [];
      READING_ZH = zhText;

      if (window.Progress) {
        window.Progress.updateWeekSummary(week, WORDS);
        updateWeekStatsBadge(week);
      }

      if ($("studyTableWrap")) $("studyTableWrap").innerHTML = buildStudyTable(WORDS, baseurl, week);
      if ($("readingText")) $("readingText").innerHTML = renderReadingPairs(zhText, enText);

      const hasEnglish = parseLines(enText).length > 0;
      if ($("englishToggleWrap")) $("englishToggleWrap").hidden = !hasEnglish;
      if (hasEnglish && $("toggleEnglish")) {
        $("toggleEnglish").checked = false;
        $("toggleEnglish").addEventListener("change", () => {
          const show = $("toggleEnglish").checked;
          document.querySelectorAll("#readingText .en").forEach((el) => (el.hidden = !show));
        });
      }

      annotateReading();
      loadWeekVideo(week, baseurl);

      // Hide YouTube button if no link configured
      const ytLink = $("youtubeLink");
      if (ytLink && (!data.youtube || data.youtube === "#")) ytLink.hidden = true;

      // Populate writing word grid
      renderWordGrid();
    } catch (err) {
      console.error(err);
      if ($("readingText")) $("readingText").textContent = "Could not load this week's files. Check assets/data and assets/readings.";
      if ($("englishToggleWrap")) $("englishToggleWrap").hidden = true;
    }

    // Quiz wiring
    $("startQuiz")?.addEventListener("click", () => startQuizFlow(week, baseurl));
    $("nextBtn")?.addEventListener("click", advanceQuiz);
    $("restartBtn")?.addEventListener("click", () => startQuizFlow(week, baseurl));
    $("typingSubmit")?.addEventListener("click", onTypingAnswer);

    // Flashcard wiring
    $("fcStart")?.addEventListener("click", () => fcStart(week, baseurl));
    $("fcCard")?.addEventListener("click", (e) => {
      if (e.target.closest(".audio-btn")) { e.stopPropagation(); return; }
      fcFlip(baseurl, week);
    });
    $("fcFlip")?.addEventListener("click", () => fcFlip(baseurl, week));
    $("fcPrev")?.addEventListener("click", () => fcGo(-1, baseurl, week));
    $("fcNext")?.addEventListener("click", () => fcGo(1, baseurl, week));

    // Worksheet wiring
    $("wsGenerate")?.addEventListener("click", generateWorksheet);

    // Writing tab wiring
    $("writeAnimate")?.addEventListener("click",  animateCurrentChar);
    $("writePractice")?.addEventListener("click", practiceCurrentChar);
    $("writeShowChar")?.addEventListener("click", showCurrentChar);

    // Hide video section if no video file loads
    $("weekVideo")?.addEventListener("error", () => {
      const section = $("weekVideo")?.closest("section");
      if (section) section.hidden = true;
    });

    // Audio button delegation
    document.addEventListener("click", (e) => {
      const btn = e.target.closest(".audio-btn");
      if (btn) {
        playAudio(btn.dataset.hanzi, btn.dataset.baseurl, parseInt(btn.dataset.week, 10));
      }
    });

    initKeyboardShortcuts(baseurl, week);
  });
})();
