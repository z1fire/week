---
layout: default
title: "All Weeks Stories"
permalink: /all/
---

# All Weeks Stories

<p class="muted">Pick a story to read. Each story shows just the reading text and translation.</p>

<section class="card">
  <ul class="story-list">
    <li><a href="{{ '/all/all-weeks/' | relative_url }}">All Weeks (mixed vocabulary)</a></li>
    {% for i in (1..12) %}
      <li><a href="{{ '/all/week' | append: i | append: '/' | relative_url }}">Week {{ i }} Story</a></li>
    {% endfor %}
  </ul>
</section>
