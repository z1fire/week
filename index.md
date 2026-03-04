---
layout: default
title: "Mandarin Study Companion"
---

# Mandarin Study Companion (12 Weeks)

Pick a week to study that week’s 50 words.

<ul class="week-list">
  {% for i in (1..12) %}
    <li><a href="{{ '/week/' | append: i | append: '/' | relative_url }}">Week {{ i }}</a></li>
  {% endfor %}
</ul>
