---
# FILE: index.md
# PURPOSE: Homepage. Uses 'page' layout — a welcome paragraph plus a
# one-line set of links into the site's main sections, rather than a feed.
# The "notify me" newsletter signup form lives on posts.md (the Newsletter
# page) instead, not here.
# NOTE: this page used to mention an unused _layouts/home.html (a
# generic post-feed/pagination template from the original theme, whose
# field names never matched how content is actually authored here, and
# which depended on the jekyll-paginate plugin the Gemfile excludes).
# That file was deleted as dead code. If a paginated post-feed homepage
# is ever wanted, it would need to be built fresh against this site's
# real front matter fields (image/image_id, subtitle/subtitle2, etc.)
# rather than resurrected from the old theme file.
layout: page
title: Sahyadri Connect
subtitle: 
---



A window into life at Sahyadri School, a space to keep parents and friends connected with the rhythms, reflections, and relationships that shape our everyday experience here. You will find monthly newsletters, glimpses of life on campus, upcoming events, and selected talks and videos from Krishnamurti. We hope it fosters a deeper understanding of the values that guide the school and invites shared inquiry into learning, living, and growing together.

Start with the [Newsletter]({{ 'posts' | relative_url }}), or browse [Activities]({{ 'activities' | relative_url }}), [Photos]({{ 'photos' | relative_url }}), [Videos]({{ 'videos' | relative_url }}), and talks from [Krishnamurti]({{ 'kfi' | relative_url }}).
