(() => {
  const $ = (id) => document.getElementById(id);

  const pad2 = (n) => String(n).padStart(2, "0");
  const shuffle = (arr) => arr.map(v => [Math.random(), v]).sort((a,b)=>a[0]-b[0]).map(([,v])=>v);
  const sample = (arr, n) => shuffle(arr).slice(0, Math.max(0, Math.min(n, arr.length)));

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

  function buildStudyTable(words) {
    const rows = words.map(w => {
      const meanings = Array.isArray(w.meanings) ? w.meanings.join("; ") : String(w.meanings || "");
      return `
        <tr>
          <td class="hanzi">${escapeHtml(w.hanzi)}</td>
          <td>${escapeHtml(w.pinyin)}</td>
          <td>${escapeHtml(meanings)}</td>
        </tr>
      `;
    }).join("");

    return `
      <table class="study-table">
        <thead>
          <tr><th>汉字</th><th>Pinyin</th><th>Meanings</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
    `;
  }

  function makeQuestions(words, type, count) {
    const picked = (count === "all") ? [...words] : sample(words, count);
    return picked.map(w => {
      if (type === "pinyin") return { prompt: w.pinyin, correct: w.hanzi, word: w };

      const meanings = Array.isArray(w.meanings) ? w.meanings : [String(w.meanings || "")];
      const meaning = meanings[Math.floor(Math.random() * meanings.length)] || "";
      return { prompt: meaning, correct: w.hanzi, word: w };
    });
  }

  function pickDistractors(pool, correctHanzi, k = 3) {
    const options = pool.filter(w => w.hanzi !== correctHanzi).map(w => w.hanzi);
    return sample(options, k);
  }

  async function loadWeekData(week, baseurl) {
    const p = pad2(week);
    const dataUrl = `${baseurl}/assets/data/week${p}.json`;
    const readingUrl = `${baseurl}/assets/readings/week${p}.txt`;
    const data = await fetchJson(dataUrl);
    const readingText = await fetchText(readingUrl);
    return { data, readingText };
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

  function renderReading(text) {
    const blocks = text
      .replace(/\r\n/g, "\n")
      .split(/\n\s*\n/g)
      .map(b => b.trim())
      .filter(Boolean);

    return blocks.map(b => `<p>${escapeHtml(b).replaceAll("\n", "<br>")}</p>`).join("");
  }

  function annotateReading() {
    if (window.mandarinspot && typeof window.mandarinspot.annotate === "function") {
      window.mandarinspot.annotate("#readingText", { phonetic: "pinyin", inline: false, show: true });
    }
  }

  let WORDS = [];
  let DISTRACTOR_POOL = [];
  let QUESTIONS = [];
  let idx = 0;
  let score = 0;
  let locked = false;

  function setProgress() {
    $("progressText").textContent = `Question ${idx + 1} / ${QUESTIONS.length}`;
    $("scoreText").textContent = `Score: ${score}`;
  }

  function showQuestion() {
    locked = false;
    $("feedback").textContent = "";
    $("nextBtn").disabled = true;

    const q = QUESTIONS[idx];
    $("prompt").textContent = q.prompt;

    const distractors = pickDistractors(DISTRACTOR_POOL, q.correct, 3);
    const choices = shuffle([q.correct, ...distractors]);

    $("options").innerHTML = choices.map(c => `
      <button class="option" type="button" data-choice="${escapeHtml(c)}">${escapeHtml(c)}</button>
    `).join("");

    $("options").querySelectorAll("button").forEach(btn => {
      btn.addEventListener("click", () => onAnswer(btn, q.correct));
    });

    setProgress();
  }

  function onAnswer(btn, correct) {
    if (locked) return;
    locked = true;

    const chosen = btn.getAttribute("data-choice");
    const isCorrect = chosen === correct;

    // mark buttons
    $("options").querySelectorAll("button").forEach(b => {
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

    let count = "all";
    if (mode === "random") {
      const n = parseInt($("randomCount").value, 10);
      count = Number.isFinite(n) ? Math.max(1, Math.min(n, WORDS.length)) : 20;
    }

    DISTRACTOR_POOL = [...WORDS];
    if (includePrev) {
      const prev = await loadPrevWeeksWords(week, baseurl);
      DISTRACTOR_POOL = [...WORDS, ...prev];
    }

    QUESTIONS = makeQuestions(WORDS, quizType, count);
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
      const { data, readingText } = await loadWeekData(week, baseurl);

      $("weekTitle").textContent = data.title ? data.title : `Week ${week}`;

      // youtube link placeholder
      const yt = data.youtube || "#";
      $("youtubeLink").href = yt;
      if (yt === "#") {
        $("youtubeLink").setAttribute("aria-disabled", "true");
      }

      WORDS = Array.isArray(data.words) ? data.words : [];
      $("studyTableWrap").innerHTML = buildStudyTable(WORDS);

      $("readingText").innerHTML = renderReading(readingText);
      annotateReading();
    } catch (err) {
      console.error(err);
      $("readingText").textContent = "Could not load this week’s files. Check assets/data and assets/readings.";
    }

    $("startQuiz").addEventListener("click", async () => {
      await startQuizFlow(week, baseurl);
    });

    $("nextBtn").addEventListener("click", () => {
      if (idx < QUESTIONS.length - 1) {
        idx += 1;
        showQuestion();
      } else {
        finishQuiz();
      }
    });

    $("restartBtn").addEventListener("click", async () => {
      await startQuizFlow(week, baseurl);
    });
  });
})();
