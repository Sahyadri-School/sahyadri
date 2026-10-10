---
# FILE: geeth-gunjan.md
# PURPOSE: Geeth Gunjan document listing page. NOTE: known issue — two cards share the same
# Google Drive thumbnail ID; needs the correct second document ID from the site owner.
layout: page
title: Geet Gunjan
subtitle: Click thumbnail to download Geet Gunjan
permalink: /geeth
share-description: "Geet Gunjan from Sahyadri School, to read as a PDF in the original script or in English transliteration."
---
<!-- Page-specific CSS previously here (pdf-grid-container, ninad-card,
     ninad-caption-banner) has been removed — it was a stale duplicate of
     the shared definition in custom-styles.css (section 12), missing a
     later flex-grow fix for caption banner height consistency. Using the
     shared definition now avoids this drift happening again. -->
<!-- Main Container holding the Geet Gunjan PDF items -->
<div class="pdf-grid-container">
  <!-- Document Card 1: English Transliterated Version -->
  <figure class="ninad-card">
    {% include pdf.html 
       thumbnail_path="https://drive.google.com/thumbnail?id=1jMUgEMR5LOFygyomN17iWU47JBsXrTOR&sz=s0"
       pdf_path="https://drive.google.com/uc?export=download&id=1o1U1PIGIDH2eo_rkz38BUjVd5DxU5sDt" 
       only_thumbnail=true %} 
    <figcaption class="ninad-caption-banner">Geet Gunjan (English Transliterated)</figcaption>
  </figure>
  <!-- Document Card 2: Original Version -->
  <figure class="ninad-card">
    {% include pdf.html 
       thumbnail_path="https://drive.google.com/thumbnail?id=1ybQifay7oFupzEqj_le-JemM0szJZEEo&sz=s0"
       pdf_path="https://drive.google.com/uc?export=download&id=1ybQifay7oFupzEqj_le-JemM0szJZEEo" 
       only_thumbnail=true %} 
    <figcaption class="ninad-caption-banner">Geet Gunjan (Original)</figcaption>
  </figure>
</div>
