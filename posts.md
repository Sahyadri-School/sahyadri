---
# FILE: posts.md
# PURPOSE: Newsletter listing page. Custom tabbed-by-year template (inline <style> block)
# with TOC sidebar. Pulls from _posts collection, grouped by 'category' front matter.
# Jekyll Front Matter Configuration
layout: page
title: "Newsletter"
permalink: /posts/
share-description: "Student-written newsletter articles from Sahyadri School, grouped by academic year and month."
---

{% comment %}
  -----------------------------------------------------------------------------
  STEP 1: Determine Unique Academic Years
  An Academic Year runs from June 1st of year X to March 31st of year X+1.
  This loop iterates through all posts to extract unique start years (e.g., "2023").
  -----------------------------------------------------------------------------
{% endcomment %}

{% assign ay_start_years = "" %}

{% for post in site.posts %}
  {% assign post_month = post.date | date: "%m" | plus: 0 %}
  {% assign post_year  = post.date | date: "%Y" %}

  {% comment %} June (month 6) or later belongs to the current year's academic block {% endcomment %}
  {% if post_month >= 6 %}
    {% assign ay_start = post_year %}
  {% else %}
    {% comment %} Jan-May belongs to the previous calendar year's academic block {% endcomment %}
    {% assign ay_start = post_year | minus: 1 | append: "" | remove: ".0" %}
  {% endif %}

  {% comment %} Deduplicate academic year start values using pipe-delimited string searching {% endcomment %}
  {% assign padded = "|" | append: ay_start_years | append: "|" %}
  {% assign needle  = "|" | append: ay_start | append: "|" %}
  {% unless padded contains needle %}
    {% if ay_start_years == "" %}
      {% assign ay_start_years = ay_start %}
    {% else %}
      {% assign ay_start_years = ay_start_years | append: "|" | append: ay_start %}
    {% endif %}
  {% endunless %}
{% endfor %}

{% comment %} Sort academic years descending so the most recent academic year is first {% endcomment %}
{% assign year_blocks         = ay_start_years | split: "|" | sort | reverse %}
{% assign default_active_year = year_blocks[0] %}

<!-- Scroll anchor for back-to-top links -->
<div id="top" style="scroll-margin-top: 200px;"></div>

<!-- Academic Year Tabs Header -->
<div class="tabs-container">
  <div class="academic-tabs">
    {% for ay in year_blocks %}
      {% comment %} Format e.g., 2023 -> 2023-24 tab label {% endcomment %}
      {% assign ay_end_year  = ay | plus: 1 | append: "" | remove: ".0" %}
      {% assign ay_short_end = ay_end_year | slice: 2, 2 %}
      {% assign tab_id        = "ay-" | append: ay | append: "-" | append: ay_short_end %}
      <button
        class="tab-link {% if ay == default_active_year %}active{% endif %}"
        onclick="switchAcademicYear(event, '{{ tab_id }}')">
        {{ ay }}&#8211;{{ ay_short_end }}
      </button>
    {% endfor %}
  </div>
</div>

{% if site.post_search %}
  <!-- Year-scoped search: filters posts within the currently active academic
       year panel only. Resets whenever the user switches tabs (see
       switchAcademicYear() below). Gated by site.post_search in _config.yml. -->
  <div class="year-search-container">
    <span class="year-search-icon" aria-hidden="true"><i class="fa fa-search"></i></span>
    <input
      type="text"
      id="year-search-input"
      class="year-search-input"
      placeholder="Search within this academic year..."
      aria-label="Search newsletters within the selected academic year"
      oninput="filterYearSearch()"
    >
    <button
      type="button"
      id="year-search-clear"
      class="year-search-clear"
      aria-label="Clear search"
      onclick="clearYearSearch()"
      style="display: none;"
    >&times;</button>
  </div>
{% endif %}

{% comment %} Group all Jekyll posts by category {% endcomment %}
{% assign grouped_posts = site.posts | group_by: "category" %}

{% comment %} Build a pipe-delimited list of every real profile slug that exists,
     computed once here (not per-post) since this page loops over every post. {% endcomment %}
{% assign known_profile_slugs = "" %}
{% for profile in site.profiles %}
  {% assign profile_slug = profile.path | split: "/" | last | remove: ".md" %}
  {% assign known_profile_slugs = known_profile_slugs | append: "|" | append: profile_slug | append: "|" %}
{% endfor %}

{% comment %}
  -----------------------------------------------------------------------------
  STEP 2: Render Content Panels per Academic Year
  -----------------------------------------------------------------------------
{% endcomment %}
{% for ay in year_blocks %}
  {% assign ay_end_year         = ay | plus: 1 | append: "" | remove: ".0" %}
  {% assign ay_short_end        = ay_end_year | slice: 2, 2 %}
  {% assign academic_start_date = ay | append: "-06-01" %}
  {% assign academic_end_date   = ay_end_year | append: "-03-31" %}
  {% assign panel_id            = "ay-" | append: ay | append: "-" | append: ay_short_end %}
  {% assign is_active           = false %}
  {% if ay == default_active_year %}
    {% assign is_active = true %}
  {% endif %}

  <div id="{{ panel_id }}" class="academic-panel {% if is_active %}active{% endif %}">
    <div class="newsletter-container">

      <!-- Table of Contents Sidebar (Filters categories active in this AY) -->
      <aside class="toc-sidebar">
        <nav class="toc-card">
          <h2 class="toc-title">Editions</h2>
          <ul class="toc-list">
            {% for group in grouped_posts %}
              {% assign has_posts = false %}
              {% for item in group.items %}
                {% assign item_date = item.date | date: "%Y-%m-%d" %}
                {% if item_date >= academic_start_date and item_date <= academic_end_date %}
                  {% assign has_posts = true %}
                  {% break %}
                {% endif %}
              {% endfor %}
              {% if has_posts %}
                {% assign cat_id = panel_id | append: "-" | append: group.name | slugify %}
                <li><a href="#{{ cat_id }}">{{ group.name | default: "General Updates" }}</a></li>
              {% endif %}
            {% endfor %}
          </ul>
        </nav>
      </aside>

      <!-- Main Content Column for Posts -->
      <div class="posts-list">
        {% assign total_posts = 0 %}

        {% for group in grouped_posts %}
          {% comment %} Pin featured posts to top of their respective category {% endcomment %}
          {% assign pinned_posts = group.items | where: "pinned", true %}
          {% assign normal_posts = group.items | where_exp: "item", "item.pinned != true" %}
          {% assign sorted_posts = pinned_posts | concat: normal_posts %}
          {% assign group_count  = 0 %}

          {% capture group_html %}
            {% for post in sorted_posts %}
              {% assign post_date = post.date | date: "%Y-%m-%d" %}
              {% comment %} Render post only if it falls within current academic year dates {% endcomment %}
              {% if post_date >= academic_start_date and post_date <= academic_end_date %}
                {% assign group_count = group_count | plus: 1 %}
                <article class="post-preview post-preview-card">
                  <!-- Post Title -->
                  <a href="{{ post.url | relative_url }}" style="text-decoration: none;">
                    <h3 class="post-title">{{ post.title }}</h3>
                  </a>

                  <!-- Dynamic Author / Subtitle Attribution (Supports 1 or 2 Authors) -->
                  {% if post.subtitle %}
                    <h4 class="post-subtitle">
                      by
                      {% comment %} Author 1 Profile Link {% endcomment %}
                      {% if post.profile-link %}
                        <a href="{{ post.profile-link }}" target="_blank" rel="noopener noreferrer">{{ post.subtitle }}</a>
                      {% else %}
                        {% assign a1 = post.subtitle | split: " " %}
                        {% capture a1_slug %}{{ a1[0] | downcase }}-{{ a1[1] | downcase }}{% endcapture %}
                        {% assign a1_needle = "|" | append: a1_slug | append: "|" %}
                        {% if known_profile_slugs contains a1_needle %}
                          <a href="{{ '/profiles/' | append: a1_slug | append: '/' | relative_url }}">{{ post.subtitle }}</a>
                        {% else %}
                          <a href="{{ '/not_done_yet' | relative_url }}">{{ post.subtitle }}</a>
                        {% endif %}
                      {% endif %}

                      {% comment %} Author 2 Profile Link (Optional) {% endcomment %}
                      {% if post.subtitle2 %}
                        and
                        {% if post.profile-link2 %}
                          <a href="{{ post.profile-link2 }}" target="_blank" rel="noopener noreferrer">{{ post.subtitle2 }}</a>
                        {% else %}
                          {% assign a2 = post.subtitle2 | split: " " %}
                          {% capture a2_slug %}{{ a2[0] | downcase }}-{{ a2[1] | downcase }}{% endcapture %}
                          {% assign a2_needle = "|" | append: a2_slug | append: "|" %}
                          {% if known_profile_slugs contains a2_needle %}
                            <a href="{{ '/profiles/' | append: a2_slug | append: '/' | relative_url }}">{{ post.subtitle2 }}</a>
                          {% else %}
                            <a href="{{ '/not_done_yet' | relative_url }}">{{ post.subtitle2 }}</a>
                          {% endif %}
                        {% endif %}
                      {% endif %}
                    </h4>
                  {% endif %}

                  <!-- Post Date -->
                  <p class="post-meta">Posted on {{ post.date | date: "%B %d, %Y" }}</p>

                  <!-- Post Excerpt & Google Drive Image Thumbnail -->
                  <div class="post-entry-container">
                    {% assign current_image = post.image_id | default: post.image %}
                    {% if current_image %}
                      <div class="post-image">
                        <a href="{{ post.url | relative_url }}">
                          <img src="https://lh3.googleusercontent.com/d/{{ current_image }}?sz=800" alt="{{ post.title }}" loading="lazy">
                        </a>
                      </div>
                    {% endif %}
                    <div class="post-entry">
                      {{ post.excerpt | strip_html | truncatewords: 30 }}
                      <a href="{{ post.url | relative_url }}" class="post-read-more">Read More</a>
                    </div>
                  </div>
                </article>
              {% endif %}
            {% endfor %}
          {% endcapture %}

          <!-- Output Category Block if matching posts exist -->
          {% if group_count > 0 %}
            {% assign total_posts = total_posts | plus: group_count %}
            {% assign cat_id = panel_id | append: "-" | append: group.name | slugify %}
            <section class="term-section" id="{{ cat_id }}">
              <h2 class="category-heading">{{ group.name | default: "General Updates" }}</h2>
              {{ group_html }}
              <div class="back-to-top"><a href="#top">&#8593; Back to top</a></div>
            </section>
          {% endif %}
        {% endfor %}

        <!-- Empty State Handling -->
        {% if total_posts == 0 %}
          <p class="no-posts-msg">No newsletters found for this academic period.</p>
        {% endif %}
      </div>

    </div>
  </div>
{% endfor %}

<!-- JavaScript Tab Switcher -->
<script>
  /**
   * Switches visible academic year panel and active tab state.
   * @param {Event} evt - Click event on tab button
   * @param {string} panelId - Target panel element ID
   */
  function switchAcademicYear(evt, panelId) {
    // Hide all panels and remove active state from tab links
    document.querySelectorAll(".academic-panel").forEach(p => p.classList.remove("active"));
    document.querySelectorAll(".tab-link").forEach(t => t.classList.remove("active"));
    
    // Activate target panel and clicked tab
    document.getElementById(panelId).classList.add("active");
    evt.currentTarget.classList.add("active");

    // Reset the year-scoped search box when switching tabs, since the search
    // should only ever apply to whichever academic year is currently visible.
    var searchInput = document.getElementById('year-search-input');
    if (searchInput) {
      searchInput.value = '';
      filterYearSearch();
    }
  }

  /**
   * filterYearSearch — filters posts within the currently active
   * .academic-panel only, based on the year-search-input's value.
   * Hides individual .post-preview cards that don't match, and hides
   * entire .term-section category blocks if every card within them
   * gets filtered out. Shows a "no results" message when nothing matches.
   * Also highlights the matched query text inside each visible card.
   */
  function clearYearSearch() {
    var input = document.getElementById('year-search-input');
    if (!input) return;
    input.value = '';
    filterYearSearch();
    input.focus();
  }

  // Caches each card's un-highlighted HTML so re-running the highlight on a
  // new keystroke always starts clean, instead of nesting highlights inside
  // previous highlights or leaking stale <mark> tags from a shorter query.
  var yearSearchOriginalHtml = new WeakMap();

  function yearSearchEscapeRegExp(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  // Walks a card's DOM and wraps matches of `regex` inside text nodes only
  // (never inside tags/attributes), so links like "Read More" or the
  // author's profile link stay intact and clickable.
  function yearSearchHighlightNode(node, regex) {
    if (node.nodeType === Node.TEXT_NODE) {
      var text = node.nodeValue;
      regex.lastIndex = 0;
      if (!regex.test(text)) return;
      regex.lastIndex = 0;
      var frag = document.createDocumentFragment();
      var lastIndex = 0;
      var match;
      while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
          frag.appendChild(document.createTextNode(text.slice(lastIndex, match.index)));
        }
        var mark = document.createElement('mark');
        mark.className = 'year-search-highlight';
        mark.textContent = match[0];
        frag.appendChild(mark);
        lastIndex = match.index + match[0].length;
        if (match[0].length === 0) regex.lastIndex++;
      }
      if (lastIndex < text.length) {
        frag.appendChild(document.createTextNode(text.slice(lastIndex)));
      }
      node.parentNode.replaceChild(frag, node);
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      if (node.tagName === 'SCRIPT' || node.tagName === 'STYLE') return;
      Array.prototype.slice.call(node.childNodes).forEach(function (child) {
        yearSearchHighlightNode(child, regex);
      });
    }
  }

  function yearSearchApplyHighlight(card, query) {
    if (!yearSearchOriginalHtml.has(card)) {
      yearSearchOriginalHtml.set(card, card.innerHTML);
    }
    card.innerHTML = yearSearchOriginalHtml.get(card);
    if (!query) return;
    var regex = new RegExp(yearSearchEscapeRegExp(query), 'gi');
    yearSearchHighlightNode(card, regex);
  }

  function filterYearSearch() {
    var input = document.getElementById('year-search-input');
    if (!input) return;

    var query = input.value.trim().toLowerCase();

    var clearBtn = document.getElementById('year-search-clear');
    if (clearBtn) {
      clearBtn.style.display = query === '' ? 'none' : '';
    }
    var activePanel = document.querySelector('.academic-panel.active');
    if (!activePanel) return;

    var sections = activePanel.querySelectorAll('.term-section');
    var totalVisible = 0;

    sections.forEach(function (section) {
      var cards = section.querySelectorAll('.post-preview');
      var sectionVisible = 0;

      cards.forEach(function (card) {
        var text = card.textContent.toLowerCase();
        var matches = query === '' || text.indexOf(query) !== -1;
        card.style.display = matches ? '' : 'none';
        if (matches) sectionVisible++;
        yearSearchApplyHighlight(card, matches ? query : '');
      });

      section.style.display = sectionVisible > 0 ? '' : 'none';
      totalVisible += sectionVisible;
    });

    var postsList = activePanel.querySelector('.posts-list');
    var noResultsMsg = activePanel.querySelector('.year-search-no-results');

    if (postsList && !noResultsMsg) {
      noResultsMsg = document.createElement('p');
      noResultsMsg.className = 'no-posts-msg year-search-no-results';
      noResultsMsg.textContent = 'No newsletters match your search within this academic year.';
      postsList.appendChild(noResultsMsg);
    }

    if (noResultsMsg) {
      noResultsMsg.style.display = (totalVisible === 0 && query !== '') ? '' : 'none';
    }
  }
</script>
