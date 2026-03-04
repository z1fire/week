---
layout: default
title: "Home"
---

# Mandarin Study Companion

A simple companion site for your weekly YouTube vocab playlist.

- 12 weeks
- 50 words per week
- Worksheets: **Pinyin → 汉字** and **Meaning → 汉字**
- Reading study with hover popups

<div class="grid">
  <a class="card week-card special-card" href="{{ '/all/' | relative_url }}">
    <div class="week-badge">All Weeks</div>
    <div class="week-title">All Weeks Stories</div>
    <div class="week-sub">Stories using vocab from every week</div>
  </a>

  {% for i in (1..12) %}
    <a class="card week-card" href="{{ '/week/' | append: i | append: '/' | relative_url }}">
      <div class="week-badge">Week {{ i }}</div>
      <div class="week-title">Study + Worksheets</div>
      <div class="week-sub">50 words · quizzes · reading</div>
    </a>
  {% endfor %}
</div>

<p class="muted small">Tip: start with Week 1, then optionally enable “Include previous weeks” for harder distractors.</p>
