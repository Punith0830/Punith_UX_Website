# Portfolio audit — 13 October 2026

The local source audit and fixes cover Home, Routiq, Chota Dhobi, MyFuture Jobs, ESG Platform, and Orchestration. The current source and publishing copies are synchronized.

**Status:** source/CSS checks and DOM interaction tests completed. Rendered browser, zoom, cross-browser, and real-device verification remain pending. The browser tool rejected the local `file://` preview; no alternate browser route was used to bypass that restriction. An accessible preview of the current files is needed to finish visual testing. No GitHub update or deployment was performed.

## Your six priorities

| Area | Verified here | Still requires a rendered preview |
| --- | --- | --- |
| Responsive behavior | CSS cascade checked at 360, 390, 768, 900, 901, 1024, 1440, and 1920 px in both themes; landscape configurations 844×390, 1024×600, and 1280×720. Matching header breakpoints and size rules across six pages. | Actual element coordinates, overflow, image cropping, viewport-height changes on phones, and 200%/400% zoom. |
| Light and dark modes | Shared saved preference; theme-button state and labels; blocked-storage fallback; cross-tab updates. Static color checks for evaluable solid backgrounds. | Flash behavior, rendered contrast over images/gradients, native controls, and external iframe appearance. |
| CSS styles | Syntax and declarations parsed; local references and CSS variables checked; shared layout resource used by all pages. Fixed tablet navigation and short-screen stack rules. | Visual spacing, stacking/painting, wrapping, and actual sticky behavior. |
| Animations | Reveal callbacks, direct section links, focus-triggered visibility, reduced-motion and unsupported-browser fallbacks; parallax bounds, scroll batching, no idle frame loop. | Smoothness, frame rates, scrolling input response, and layered-card transitions. |
| Consistency and type | Shared navbar geometry, typography stacks, common gutters, menu order, theme state, and shared motion behavior. | Real font loading and fallback transitions, optical alignment, and page-by-page visual comparison. |
| Accessibility | Main/skip navigation, accessible names, image alternatives, ID references, keyboard menu cycling, Escape restoration, touch-target rules, scrollable-table focus, and solid-color contrast review. | Screen-reader testing, image-background contrast, zoom/reflow, and assistive-technology behavior. This audit is not accessibility certification. |

## Fixes applied

1. Moved common layout, theme, menu and animation behavior into `assets/portfolio.css` and `assets/portfolio.js`. All six pages now use the same implementation.
2. Replaced ESG's separate theme key with `portfolio-theme`; theme initialization occurs before the page styles. Removed the unguarded Chota Dhobi storage access and redundant reveal observers.
3. Standardized compact navigation at 900 px. Desktop theme buttons are 44×44 px; compact menu options and controls have larger targets. Closing, resizing, clicking outside, and Escape consistently restore menu state.
4. Added menu focus cycling, focus restoration, hidden-menu inertness, a home-page skip link, focusable main landmarks, and keyboard access to the research comparison table.
5. Fixed light-mode accent-label contrast in Chota Dhobi, MyFuture Jobs and ESG, plus labels on permanently colored brand sections. Added a solid backing to the portrait caption and palette-code labels.
6. Preserved the 1.2-second reveals and subtle desktop parallax. Direct links and keyboard focus reveal all relevant ancestor blocks. Reduced motion disables the effects. Parallax does not move text, menus, controls or the live iframe.
7. The home-page project stack uses normal flow on short landscape screens and with reduced motion. Keyboard-focused project cards are raised above overlapping panels.
8. Converted embedded bitmap images into cacheable assets. PNG conversions are lossless; source pixel dimensions were preserved. Below-fold images use lazy loading and asynchronous decoding. Corrected one home-page intrinsic image size. Routiq's external demo is lazy loaded.
9. Prepared all six current pages and their referenced assets in `dist`. Updated the build command so it copies authoritative source into `dist` instead of restoring an older home page.

## Evidence and practical limits

- **78 DOM interaction scenarios passed** across the six pages. These simulate browser APIs; they do not render pixels or measure performance.
- **132 viewport/theme CSS configurations** were evaluated. They inspect the cascade, not physical layout.
- No duplicate IDs, broken local file/anchor references, missing image alternatives or iframe names, unresolved CSS variables, or CSS syntax errors in the final source scan.
- No remaining contrast flags among the direct text/solid-background combinations evaluated by the custom scan. Transparent image overlays, gradients, pseudo-elements, disabled/focus states, and the external demo need browser review.
- **55 referenced source/build files** were verified byte-for-byte, including all six pages. Build tools and local audit dependencies are excluded from the publishing package.
- Project order is Routiq → Chota Dhobi → MyFuture Jobs → ESG Platform, on the home page and in every Projects menu.
- Existing project narratives, links, image contents and the Routiq source disclosure were retained.

## Loading and performance

| Measurement | Before | After |
| --- | ---: | ---: |
| Combined six-page HTML size | 26,420,902 bytes | 363,918 bytes |
| Unique extracted image files | 19,483,983 source bytes | 12,707,879 optimized bytes |

The HTML reduction largely comes from moving image data into separate files; images still need downloading when viewed. The unique image data is about **35% smaller** through lossless PNG optimization. Separate files can be cached between visits/pages, and below-fold lazy loading reduces eager downloads. No animation library was added. Shared CSS/JS are small reusable resources, but real network timings, Core Web Vitals and frame rates have not been measured.

## Remaining checks before publication

- Open the current build through an accessible preview and inspect every page at the listed sizes, both themes and landscape orientations.
- Exercise the sticky cards, page-to-page navbar alignment and scroll effects using mouse, keyboard and touch input.
- Check 200%/400% zoom, real small-phone browser chrome, iOS Safari and Android Chrome, and a desktop screen reader.
- Measure cold/warm loads, layout shifts and animation performance on a throttled connection/device.
- Verify external link availability and Routiq's embedded app/backend separately; those services were not changed or audited internally.
- Confirm publishing destination and review the local result before a separate GitHub/deployment step.

## Reproducible local checks

- `node scripts/test-portfolio.cjs` — DOM regression tests (local `linkedom` audit dependency).
- `scripts/audit-portfolio.py` — DOM/CSS source scan (local `tinycss2` and `cssselect2` audit dependencies).
- `node scripts/build-site.mjs` — build the six-page static publishing copy.

Machine-readable evidence: `baseline.json`, `results.json`, `runtime-tests.json`, `image-optimization.json`, and `build-verification.json` in this folder.
