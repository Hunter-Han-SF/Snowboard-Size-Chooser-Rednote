# Design QA · 2026-10-28

## Visual truth and captures

- Source: `C:/Users/ChoraiSuperUser/.codex/generated_images/01a18065-c869-7f32-9004-23898f5a5947/exec-e1cce698-005b-4f9e-ab79-0f32d95597fd.png` (first displayed ideation result, selected by user).
- Source raster: 853×1844; intended logical viewport: 390×844. Compared at matching logical width (~0.457 source scale), without stretching image assets.
- Implementation: `tmp/alpine-blue-390.png`, `tmp/alpine-green-390.png`, `tmp/alpine-red-390.png`; each 390×844 pixels / 390×844 CSS viewport (capture density 1).
- Narrow-screen evidence: `tmp/alpine-long-320.png`, 320×568.
- State: default Men's Howler, 175cm / 70kg, initial form; each screenshot activates its respective preference.
- Local browser: http://127.0.0.1:8734/ . Reference and rendered capture were opened together for full-view comparison; final color captures also inspected together.

## Required fidelity surfaces

- Typography: bold uppercase product title, smaller Chinese tagline, large editable measurements, compact brand header. Local system Chinese fonts and Arial avoid external requests. Long model names use a smaller size; word breaking verified at 320px. Original generated JONES lettering is represented by the existing project text wordmark; it is not an official logo asset.
- Layout: full-width alpine hero, product to the right, quiz strip, two-column measurements, three-way preference selector and one primary button. At 390×844 the CTA fits within the first screen. Narrow phones scroll naturally; no horizontal layout is introduced.
- Colors: intentional user change from mock's green CTA to balanced blue (#225b83), flexible green (#23624c), stable red (#a43e4b). Corresponding soft surfaces and dark result panels remain within each palette.
- Images: real transparent board assets preserved without distorting aspect ratios; new snowy mountain photography generated from the selected reference, stored locally as alpine-day.webp. Hero is slightly shorter than the mock to accommodate actual native input metrics and 44px touch targets. Original supplied board silhouette is narrower than the generated mock's depiction; preserving real product proportions is intentional.
- Copy: actual official product tagline retained (rather than the mock's generated copy); supported range labels are the real 120–205cm / 20–120kg. Existing algorithms, detailed specifications and optional controls remain accessible.
- Focused regions: title/product overlap, contrast of change-board action, numeric input/units, preference slider and complete CTA inspected at full 390px and 320px rendered sizes; no extra crops required because these captures show readable pixels directly.

## Comparison and repair history

1. P2: initial desktop-style scrollbar reduced usable portrait width and CTA was below the 844px fold. Hid scrollbar gutter, adjusted hero/spacing; final blue capture shows full CTA.
2. P2: 320px long title broke HOVERCRAFT within a word; reduced long-title font to 22px at narrow width. Final alpine-long-320.png shows whole words.
3. P2: change-board action overlapped dark rocks; added a light translucent surface. Final three theme captures show readable label and arrow.
4. P2 behavior: selected-board dialog focus trap omitted summary. Added summary and verified Tab → confirmBoard → modelClose.
5. P2 behavior: page overflow hidden prevented result toolbar from sticking to viewport. Removed clipping from the outer page. Browser DOM reports toolbar bottom 844 in 844px viewport.

## Interaction verification

Three theme selections; body-number input sync; search/empty/recovery; long-model selection; modal open/close/Escape/Tab; result transition and return; optional EU44/stance preset and Canvas; 1500px share image preview; complete child questionnaire and prefilled return to form. Browser error/warning log checked. No application errors observed.

## Follow-up polish and limits

No remaining actionable P0/P1/P2 findings. Device font rasterization can differ slightly from Chromium. Actual iPhone safe area/keyboard, native Rednote bridges and reduced-motion OS setting were not exercised on a real device; reduced-motion CSS and JS fallback paths were inspected. No device frame-rate claim is made.

Prior iteration result: superseded by feedback below.

## Feedback correction — preserve functionality, restore original result styling

The user's newest instruction overrides the compact form arrangement: all shoe, stance and style inputs must be visible on the home form. The first-screen CTA requirement above no longer applies. Main JS is byte-for-byte unchanged during this correction.

Source: original repository result CSS at HEAD (dark glass card) + existing alpine imagery + explicit feedback. This is a restoration of the result styling, not a new image-based design selection.

Current evidence:
- `tmp/restored-home-fields.png`: 390×844, EU43 and stance inputs/presets directly visible.
- `tmp/restored-result-top.png`: 390×844, stable red result, Frontier 2.0 Split, 159.
- `tmp/restored-stance.png`: 390×844, visible original Canvas and explanatory values.

Typography/layout: result title 24px, model 15px, size 78px, full-width explanation; transparent hero area inside one continuous dark glass card. Original supplied board image proportions retained. Contrast: pale text and hairline dividers over dark glass, theme-matched night background. Corrected hierarchy: recommendation → size chooser → stance detection → matching evidence → always-visible official specs. The original Canvas rendering is deliberately unchanged; explanatory text carries readable values on small phones.

Resolved P1: hidden shoe/angle input affordances. Resolved P1: flat white result styling replacing original atmosphere. Resolved P2: specs required an extra expansion action. Algorithm and stance visibility conditions unchanged.

Verified: all form controls visible without details expansion; full stance computation; manual 159→158W recalculates 1.6→0.6cm; 320/390/430px no horizontal overflow; sticky controls at viewport bottom; main.js equality and data check. Earlier device/bridge testing limits still apply.

final result: passed
