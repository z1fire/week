/* assets/js/progress.js — localStorage progress tracker */
const Progress = (() => {
  const MASTERY_KEY  = 'mandarin_mastery';
  const STREAK_KEY   = 'mandarin_streak';
  const HISTORY_KEY  = 'mandarin_history';
  const WEEK_SUM_KEY = 'mandarin_week_summary';

  function load(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch { return fallback; }
  }

  function save(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch {}
  }

  function todayStr() {
    return new Date().toISOString().slice(0, 10);
  }

  function updateStreak() {
    const today = todayStr();
    const s = load(STREAK_KEY, { lastDate: null, streak: 0, longest: 0 });
    if (s.lastDate === today) return;
    const prev = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    s.streak = (s.lastDate === prev) ? s.streak + 1 : 1;
    s.lastDate = today;
    s.longest = Math.max(s.longest || 0, s.streak);
    save(STREAK_KEY, s);
  }

  function getMastery() { return load(MASTERY_KEY, {}); }

  function recordQuizResult(week, quizType, score, total, wordResults) {
    updateStreak();
    const m = getMastery();
    if (Array.isArray(wordResults)) {
      for (const { hanzi, correct } of wordResults) {
        m[hanzi] = Math.min(5, Math.max(0, (m[hanzi] || 0) + (correct ? 1 : -1)));
      }
    }
    save(MASTERY_KEY, m);
    const hist = load(HISTORY_KEY, []);
    hist.push({ date: todayStr(), week, quizType, score, total,
      pct: total ? Math.round(score / total * 100) : 0 });
    if (hist.length > 200) hist.splice(0, hist.length - 200);
    save(HISTORY_KEY, hist);
  }

  function recordWritingPractice(hanzi) {
    updateStreak();
    const m = getMastery();
    m[hanzi] = Math.min(5, (m[hanzi] || 0) + 1);
    save(MASTERY_KEY, m);
  }

  function updateWeekSummary(week, words) {
    if (!Array.isArray(words) || !words.length) return;
    const m = getMastery();
    const mastered = words.filter(w => (m[w.hanzi] || 0) >= 3).length;
    const sum = load(WEEK_SUM_KEY, {});
    sum[week] = { mastered, total: words.length };
    save(WEEK_SUM_KEY, sum);
  }

  function getWeekSummary(week) {
    const sum = load(WEEK_SUM_KEY, {});
    return sum[week] || { mastered: 0, total: 50 };
  }

  function getWeekLastScore(week) {
    const hist = load(HISTORY_KEY, []);
    const wh = hist.filter(h => h.week === week);
    return wh.length ? wh[wh.length - 1] : null;
  }

  function getMasteredCount() {
    return Object.values(getMastery()).filter(v => v >= 3).length;
  }

  function getStreakInfo() {
    return load(STREAK_KEY, { lastDate: null, streak: 0, longest: 0 });
  }

  function getWordMastery(hanzi) {
    return getMastery()[hanzi] || 0;
  }

  return {
    recordQuizResult,
    recordWritingPractice,
    updateWeekSummary,
    getWeekSummary,
    getWeekLastScore,
    getMasteredCount,
    getStreakInfo,
    getWordMastery
  };
})();
