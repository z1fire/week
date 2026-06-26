---
layout: default
title: "Home"
---

# Mandarin Study Companion

12 weeks · 50 words each · quizzes, writing practice, and bilingual readings.

<div id="progressDashboard" class="progress-dashboard card" data-baseurl="{{ site.baseurl }}">
  <div class="dash-stats" id="dashStats">
    <div class="dash-stat">
      <span class="dash-val" id="streakCount">0</span>
      <span class="dash-label">day streak 🔥</span>
    </div>
    <div class="dash-stat">
      <span class="dash-val" id="masteredCount">0</span>
      <span class="dash-label">/ 600 mastered ✅</span>
    </div>
    <div class="dash-stat">
      <span class="dash-val" id="longestStreak">0</span>
      <span class="dash-label">longest streak 🏆</span>
    </div>
  </div>
  <div id="newUserMsg" class="new-user-msg" hidden>
    <strong>Welcome!</strong> Start with Week 1 — complete a quiz to begin tracking your progress.
  </div>
  <div id="weekProgressBars" class="week-progress-bars"></div>
</div>

<script>
document.addEventListener('DOMContentLoaded', function() {
  if (!window.Progress) return;
  var baseurl = document.getElementById('progressDashboard').dataset.baseurl || '';
  var streak = window.Progress.getStreakInfo();
  var mastered = window.Progress.getMasteredCount();
  var isNew = streak.streak === 0 && mastered === 0;

  var streakEl = document.getElementById('streakCount');
  var masteredEl = document.getElementById('masteredCount');
  var longestEl = document.getElementById('longestStreak');
  if (streakEl) streakEl.textContent = streak.streak;
  if (masteredEl) masteredEl.textContent = mastered;
  if (longestEl) longestEl.textContent = streak.longest || 0;

  if (isNew) {
    var msg = document.getElementById('newUserMsg');
    if (msg) msg.hidden = false;
    var barsEl = document.getElementById('weekProgressBars');
    if (barsEl) barsEl.hidden = true;
  } else {
    var barsEl = document.getElementById('weekProgressBars');
    if (!barsEl) return;
    var html = '';
    for (var i = 1; i <= 12; i++) {
      var summary = window.Progress.getWeekSummary(i);
      var wm = summary.mastered;
      var wt = summary.total;
      var pct = wt > 0 ? Math.round(wm / wt * 100) : 0;
      var last = window.Progress.getWeekLastScore(i);
      var lastLabel = last ? (' · last quiz: ' + last.pct + '%') : '';
      html += '<div class="wpb-row">'
        + '<a href="' + baseurl + '/week/' + i + '/" class="wpb-label">Week ' + i + '</a>'
        + '<div class="wpb-bar-wrap"><div class="wpb-bar" style="width:' + pct + '%"></div></div>'
        + '<span class="wpb-count muted small">' + wm + '/' + wt + lastLabel + '</span>'
        + '</div>';
    }
    barsEl.innerHTML = html;
  }

  // Fill progress bars into week cards
  document.querySelectorAll('[data-week]').forEach(function(card) {
    var w = parseInt(card.dataset.week, 10);
    var summary = window.Progress.getWeekSummary(w);
    var pct = summary.total > 0 ? Math.round(summary.mastered / summary.total * 100) : 0;
    var bar = card.querySelector('.week-card-bar');
    if (bar) bar.style.width = pct + '%';
    if (pct > 0) {
      var sub = card.querySelector('.week-sub');
      if (sub) sub.textContent = summary.mastered + '/' + summary.total + ' mastered (' + pct + '%)';
    }
  });
});
</script>

<div class="grid">
  <a class="card week-card special-card" href="{{ '/all/' | relative_url }}">
    <div class="week-badge">All Weeks</div>
    <div class="week-title">All Weeks Stories</div>
    <div class="week-sub">Stories using vocab from every week</div>
  </a>

  {% for i in (1..12) %}
    <a class="card week-card" href="{{ '/week/' | append: i | append: '/' | relative_url }}" data-week="{{ i }}">
      <div class="week-badge">Week {{ i }}</div>
      <div class="week-title">Study + Worksheets</div>
      <div class="week-sub">50 words · quizzes · writing · reading</div>
      <div class="week-card-progress"><div class="week-card-bar"></div></div>
    </a>
  {% endfor %}
</div>

<p class="muted small">Tip: start with Week 1 · keys <strong>1–4</strong> for quiz options · <strong>Space / ← →</strong> for flashcards.</p>
