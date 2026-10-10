---
# FILE: ninad.md
# PURPOSE: Ninad (school magazine/PDF archive) listing page — card grid of downloadable PDFs.
layout: page
title: Ninad
subtitle: Click on a thumbnail to download an issue of Ninad
share-description: "Ninad, the Sahyadri School magazine: past editions to read or download as PDFs."
---

<!-- Page-specific CSS previously here (pdf-grid-container, ninad-card,
     ninad-caption-banner) has been removed — it was a stale duplicate of
     the shared definition in custom-styles.css (section 12), missing a
     later flex-grow fix for caption banner height consistency. Using the
     shared definition now avoids this drift happening again. -->

<!-- Main Container for Ninad PDF Cards -->
<div class="pdf-grid-container">

  <!-- Ninad Issue 2025-26 -->
  <figure class="ninad-card">
    {% include pdf.html 
       thumbnail_path="/assets/Ninads/25-26.png" 
       pdf_path="https://drive.google.com/uc?export=download&id=1BOHZ1iYSJ9j9mpoCR4AyvWRJUxMwauNh" 
       only_thumbnail=true %} 
    <figcaption class="ninad-caption-banner">Ninad 2025-26</figcaption>
  </figure>

  <!-- Ninad Issue 2023-24 -->
  <figure class="ninad-card">
    {% include pdf.html 
       thumbnail_path="/assets/Ninads/23-24.png" 
       pdf_path="https://drive.google.com/uc?export=download&id=161g-gIkPTlV3mbLBJH5srVOQKo626C26" 
       only_thumbnail=true %} 
    <figcaption class="ninad-caption-banner">Ninad 2023-24</figcaption>
  </figure>

  <!-- Ninad Issue 2020-21 -->
  <figure class="ninad-card">
    {% include pdf.html 
       thumbnail_path="/assets/Ninads/20-21.png" 
       pdf_path="https://drive.google.com/uc?export=download&id=1PHivXhIcHCvNP4rXcgtujfAU9xH9wEFF" 
       only_thumbnail=true %}
    <figcaption class="ninad-caption-banner">Ninad 2020-21</figcaption>
  </figure>

  <!-- Ninad Issue 2019-20 -->
  <figure class="ninad-card">
    {% include pdf.html 
       thumbnail_path="/assets/Ninads/19-20.png" 
       pdf_path="https://drive.google.com/uc?export=download&id=19S9ppPF3vfPfE5EKnAzJYvylu442QgLg" 
       only_thumbnail=true %}
    <figcaption class="ninad-caption-banner">Ninad 2019-20</figcaption>
  </figure>

  <!-- Ninad Issue 2017 -->
  <figure class="ninad-card">
    {% include pdf.html 
       thumbnail_path="/assets/Ninads/17.png" 
       pdf_path="https://drive.google.com/uc?export=download&id=1w8JTz5IaMSysoqtxqyiFksKrQ9it64VJ" 
       only_thumbnail=true %} 
    <figcaption class="ninad-caption-banner">Ninad 2017</figcaption>
  </figure>

</div>
