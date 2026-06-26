---
layout: default
title: "All Weeks"
permalink: /all/
---

# All Weeks

<section class="card">
  <h2>Vocabulary Quiz</h2>
  <p class="muted small">Quiz yourself across all 600 words from every week. Weakest mode targets the words you've missed most.</p>

  <div class="controls" id="aqControls">
    <label>
      Quiz type
      <select id="aqType">
        <option value="pinyin">Pinyin → 汉字</option>
        <option value="meaning">Meaning → 汉字</option>
      </select>
    </label>
    <label>
      Words
      <select id="aqMode">
        <option value="random20">20 random</option>
        <option value="random50">50 random</option>
        <option value="weak20">Weakest 20</option>
        <option value="all">All 600</option>
      </select>
    </label>
    <button id="aqStart" class="btn" type="button">Start</button>
  </div>

  <p id="aqLoading" class="muted small" hidden>Loading all weeks…</p>

  <div id="aqArea" class="quiz-area" hidden>
    <div class="quiz-top">
      <div class="pill" id="aqProgress"></div>
      <div class="pill" id="aqScore"></div>
    </div>
    <div class="prompt" id="aqPrompt"></div>
    <div class="options" id="aqOptions"></div>
    <div class="feedback" id="aqFeedback"></div>
    <div class="nav-row">
      <button id="aqNext" class="btn" type="button" disabled>Next</button>
      <button id="aqRestart" class="btn ghost" type="button">Restart</button>
    </div>
    <p class="muted small quiz-shortcuts-hint">Keys: <strong>1–4</strong> pick option · <strong>Enter</strong> advance</p>
  </div>
</section>

<section class="card">
  <h2>Reading Stories</h2>
  <p class="muted small">Pick a story to read. Hover over the Chinese to see pinyin and meaning.</p>
  <ul class="story-list">
    <li><a href="{{ '/all/all-weeks/' | relative_url }}">All Weeks (mixed vocabulary)</a></li>
    {% for i in (1..12) %}
      <li><a href="{{ '/all/week' | append: i | append: '/' | relative_url }}">Week {{ i }} Story</a></li>
    {% endfor %}
  </ul>
</section>

<script>
  window.ALLQUIZ_BASEURL = {{ site.baseurl | jsonify }};
</script>
<script src="{{ '/assets/js/allquiz.js' | relative_url }}"></script>
