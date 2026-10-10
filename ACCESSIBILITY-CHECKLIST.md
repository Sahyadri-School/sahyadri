# Accessibility and responsive QA checklist

Run this checklist before merging changes to templates, styles, navigation, or page content. Automated HTML checks do not replace a real keyboard/screen-size review.

## Keyboard and screen-reader basics
- [ ] Reload and press Tab: “Skip to main content” appears before navigation and can be activated with Enter.
- [ ] Continue with Tab and Shift+Tab: every link, button, form field, tab, and menu control has a visible focus indicator and a sensible order.
- [ ] Operate the navbar dropdowns, dark-mode toggle, year tabs, search and “load more” controls without a mouse.
- [ ] Confirm page landmarks: one clear main-content landmark per page; headings describe sections in a logical order.
- [ ] Check that meaningful images have useful alt text; decorative images use empty alt text. For Google Drive images, verify the rendered output and context rather than assuming the filename supplies text.
- [ ] Check forms and validation messages with keyboard and screen reader; status/error text should be announced and inputs have labels.

## Mobile, zoom and layout
- [ ] Check homepage, newsletter list, an article with a gallery, Activities, Profiles, Photos, Videos, KFI and PDF archives at 320px, 375px, 768px and desktop widths.
- [ ] At 200% browser zoom, no essential text or control is clipped; content reflows without page-wide horizontal scrolling.
- [ ] Sticky navigation does not cover in-page anchors, headings, focus rings, or the skip-link target.
- [ ] Controls have comfortable touch targets and enough spacing to avoid accidental activation.
- [ ] Test both light and dark modes, including hover, focus, disabled, empty and no-results states.
- [ ] Check browser “reduce motion” preference; non-essential animation should be minimized.

## Contrast and visual checks
- [ ] Check text, link, placeholder, focus-ring, button and disabled-state contrast with a WCAG contrast checker.
- [ ] Do not use color alone to convey status or selected state.
- [ ] Confirm captions and image overlays remain legible on bright and dark photographs.

## Before publishing
- [ ] Build and internal HTML/link/image checks pass.
- [ ] Review the built page in a real browser at the sizes above; CI cannot detect all visual regressions.
- [ ] Check external-link workflow results separately; an external service may block automated requests even when a link works in a browser.

Target: WCAG 2.2 AA where practical. Record any known exceptions and the affected page.
