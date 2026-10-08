# PLAN.md: Pocket Booth (Day 6)

> **A photo booth in your pocket.**
> Four shots, a countdown and a flash, and out comes a real-looking photo booth strip. Or turn four photos you already have into one. Send it to everyone in it, and print four real-size strips on one sheet. Free, no account, no AI, nothing uploaded.

This is the single planning file for the project. A build session opened in this folder (`pocket-booth/`) should need only this file, the root `../CLAUDE.md` (loaded automatically), `../shared-kit/README.md` and the agents in `.claude/agents/`.

**Status (2026-10-08):** planned, nothing built. The folder holds only this file, `HANDOFF.md` and the agents. Build in a separate session, starting from `HANDOFF.md`.

**Decisions made by Rishi (2026-10-08):**
- Name **Pocket Booth**. Folder `pocket-booth/`. Address **`the-pocket-booth.vercel.app`** (`pocket-booth` and `pocketbooth` are taken, the second by a Spanish online photobooth; `the-pocket-booth` and the repo name both confirmed free on 2026-10-08). Repo `keeshir-droid/pocket-booth`, Vercel project `the-pocket-booth`.
- **Two ways in, live booth first:** the landing leads with the live booth (friends together in a room). "Use photos you already have" is a clear second option.
- **No secret capture.** No audio is ever recorded and nothing is captured outside the 4 shots. (A "hidden candid frame" idea was dropped as a privacy problem.)
- **Styles (filters):** 7 booth looks (§5.5), each made in code.
- **Outputs:**
  1. **Share image:** the strip *presented* (lying on a surface, tilted, with a shadow) so it reads as a photo booth strip in a chat, never a bare thin strip. 4:5 for chats and feed, plus story size.
  2. **Print PDF:** one A4 sheet with **4 copies of the same strip at true booth size (2×6 in)**, cut marks, ready to print at home or at a print shop with no Canva step. Chosen style and effects baked in.
  - The 4×6 photo-print layout is dropped; the A4 PDF does that job.
- **Test material:** free-licensed stock photos of people only (Unsplash, Pexels). Rishi doesn't share personal photos; he tests on his own phone after deploy.
- Footer siblings: Look Up, Underline, Doodle Alive, Handwriting → Font.

---

## 1. Why this, and for whom

**Audience:** young (teens to 20s), expressive, non-technical people. Not developers, not content creators.

**The behaviour, which everyone already has:** friends hanging out, taking pictures together. A viewer recognises a photo booth strip in under a second.

**Evidence (research, Oct 8):**
- Gen Z is turning back to physical, tangible things (vinyl, paper planners, printed photos). [YPulse 2026](https://www.ypulse.com/?p=179844)
- **Photo booth strips are a craze**, including in India: young people queue and pay about ₹200 for two printed strips of four, to keep instead of leaving photos buried in their phones. [Hitavada, June 2026](https://www.thehitavada.com//Encyc/2026/6/9/smile-pose-print-the-photobooth-craze.html). Korea's four-cut booths and Vietnam's 2025 booth wave show the same thing.
- Sites that spread are personal, look great as a single image, and need no onboarding (Receiptify, Instafest, neal.fun).

**Why a strip isn't just "a photo":** what people love about booth strips is the memory of the night: the countdown chaos, the squeeze, the keepsake you can hold. The strip *format* is what triggers it. A phone booth gives that anywhere (a bedroom, a terrace, a hostel room), free, with a real printable strip at the end.

**The "aha" moments:**
- **Live booth:** the countdown, the flash, the 4 frantic poses, then a real-looking strip slides out and develops on screen.
- **From your photos:** four photos from different years, phones and lighting come out looking like **one booth session**. "We were never in a booth together, but here's our strip." It's a 2-minute birthday or anniversary gift.
- **Print:** a real 2×6 strip in your hand for the price of one printed page.

**Honest risks:**
- **"Photo booth apps already exist."** We win on: no install, the most authentic strip look, and a true-size print sheet. Judged at M1 (§8).
- **Mismatched camera-roll photos might still look mismatched.** This is M1's other go/no-go.
- **Camera in in-app browsers** (Instagram, WhatsApp) can be blocked. There's a one-shot-at-a-time fallback (§6.3).

## 2. The bar

- **The strip looks like it came out of a real booth.** Paper, borders, grain, the dot-matrix date stamp, true proportions. Not "an app template".
- **Four camera-roll photos look like one session** once a style is on.
- **The live booth is fun and fast.** Tap Start, and 15 seconds later you're looking at your strip.
- **The print comes out right first time:** 2×6 in exactly, sharp, not muddy, with cut marks.
- **Few taps.** Start → pose ×4 → pick a style → Send. Under a minute.
- **Every output carries the address** `the-pocket-booth.vercel.app`.

---

## 3. The user flow, from the reel to the next person

### Step 0: the reel
- **What the viewer sees:** three friends on a bed, phone propped on a pile of books. "3… 2… 1…", flash, everyone scrambling between poses. A strip slides out on screen and develops. Cut to the printed strips being cut apart and handed out.
- **Caption hook:** *"we made a photo booth in my room"*.
- **Getting there:** `the-pocket-booth.vercel.app`, on screen at the end and in the bio/link sticker.

### Step 1: landing (first 3 seconds)
- **Headline:** *"A photo booth in your pocket."*
- **Sub-line:** *"Four shots. One strip. Print it for the price of a page."*
- **A sample strip** slides out of a slot and develops, then cycles through 3–4 styles.
- **One big button: Start the booth.** Below it, a clear second button: **Use photos you already have**.
- **Trust line:** *"Free. No account. Your photos never leave your phone."*

### Step 2A: the live booth
1. **Before the camera asks for permission,** one calm line: *"Your camera stays on your phone. Nothing is recorded or sent."* Then the browser's own prompt.
2. **The booth screen:**
   - The camera preview fills a 4:3 frame exactly as it will be captured (what you see is what you get), mirrored like a mirror.
   - Front camera by default, with a flip button for the back camera.
   - A hint: *"Prop your phone up, or hold it out."*
   - Four small dots show the shots (1 of 4).
   - Optional toggles, small: **Pose ideas** (off by default) and **Sound** (on).
   - **Start** (big).
3. **The session:**
   - 3 · 2 · 1 big countdown, synthesised beeps.
   - **Flash:** the screen goes white for a moment (which also lights faces in a dim room), shutter sound, frame captured.
   - The shot drops into a mini strip at the edge.
   - *"Next one…"* 3 s countdown, then the next shot. Four in total.
   - With Pose ideas on, each countdown shows a dare above it (*"Worst passport photo"*, *"Everyone look at the one who's late"*; the list lives in `app.js`).
4. **The strip develops** (§5.3): it slides out of a slot at the top and the frames fade in from a pale grey-brown. This is the on-camera moment.
5. **Retake** starts over. There's no retaking single frames, as in a real booth.

**If the camera can't open** (denied, missing, or an in-app browser), see §6.3: a friendly message, **Take 4 photos one at a time** (each tap opens the phone's camera app), and *"Open in your browser for the full booth"* with simple steps.

### Step 2B: from your photos
1. **Pick 4 photos** in one go (multi-select).
   - Fewer than 4: *"Pick 2 more"*, with a button to add.
   - More than 4: the first 4 are used, and the person can swap.
2. **The strip appears at once,** each photo auto-framed:
   - centred left to right, centred 40% from the top, because faces are usually in the upper part
   - matched to each other (§6.4)
   - in the current style
3. **Tap any frame to adjust it:**
   - drag and pinch to frame the faces
   - **Move up / Move down** to reorder
   - **Replace** to pick another photo
   - **Done**

   Every change shows on the strip right away.
4. Same result screen as the live booth.

### Step 3: make it yours (the result screen)
- **The strip, big,** with a soft shadow on the warm-paper screen.
- **Style chips:** 7 styles (§5.5), one tap each, with a live result.
- **Strip colour:** the style's own colour by default, or White · Black · Pink · Blue.
- **Caption** (optional, max 24 characters), placeholder *"Riya's room"*. It's printed in the dot-matrix stamp in the strip's bottom band.
- **Date** on the strip, on by default, as `08 OCT 2026`. It's today's date (when the strip was made), and the person can switch it off.
- **Edit photos** goes back to Step 2B's frame editor. It works for live shots too: framing only, no reorder needed.

### Step 4: keep it and send it
In a sticky bottom bar and just above it:
- **Send** (primary): the 4:5 share image (§5.6) through the phone's share sheet. Android without a share sheet: download.
- **Save image:** the same 4:5 image, saved.
- **Print 4 strips (PDF):** the A4 sheet (§6.6). Under the button, one small line: *"Print at Actual size (100%), on photo paper if you can."*
- **Story size:** the 1080×1920 version for Instagram or WhatsApp status.
- Every output carries the address. The strip's own bottom band carries it too, like the booth's name on a real strip.
- **File names:**
  - `pocket-booth-<YYYY-MM-DD>.jpg`
  - `pocket-booth-story-<YYYY-MM-DD>.jpg`
  - `pocket-booth-print-<YYYY-MM-DD>.pdf`

### Step 5: done
- *"Saved."* A one-line nudge: *"Send it to everyone in the strip."*
- Then: **Send again**, **Print 4 strips**, **Try another style**, **New strip**.

### Step 6: the next person (growth loop)
- Everyone in the strip wants a copy, so it gets sent to every person in it, often in the group chat.
- The share image reads as a booth strip at a glance and carries the address. *"Where did you get this?"* leads to the address and to Step 1.
- Printed strips get stuck on walls, mirrors and laptops, with the address in the strip's band.

---

## 4. Scope for today

### In
- **Live booth:** front/back camera, mirrored WYSIWYG 4:3 preview, 3-2-1 countdown, screen flash, 4 shots, mini strip, retake, Pose ideas (off by default), synthesised sounds (toggle).
- **Camera fallback:** take 4 photos one at a time with the phone's camera app; "open in browser" help for in-app browsers.
- **From your photos:** multi-pick 4, auto-frame, auto-match, a frame editor (drag, pinch, move up/down, replace), HEIC message.
- **The strip:** true 2×6 in at 300 dpi, 7 styles, strip colour, caption, date, the dot-matrix stamp, the develop animation.
- **Outputs:** 4:5 share image, 1080×1920 story image, A4 print PDF with 4 strips at true size and cut marks (US Letter automatically for US-style locales).
- Share sheet with save fallbacks, good file names.
- **Sample strip:** 4 free-licensed photos of the same friends, credited, for the landing demo and dev checks.
- Remembers style, strip colour, sound and pose-ideas settings on the device. "More from Risheek" footer.
- Vercel Web Analytics (page views). README with the standard sections. Live on its own address.

### Not today (goes in the README's "next steps")
- A story **video** of the strip sliding out and developing (the kit's video export could do it later).
- Stickers, doodles or handwriting on the strip; the Day 2 handwriting font for the caption.
- Moving strips (each frame a tiny loop).
- Other layouts: 3 frames, a 2×2 grid, a wide horizontal strip.
- Retaking a single frame; a burst or boomerang mode.
- 4×6 photo-print layout.
- Add to Home Screen / offline.

---

## 5. Design

### 5.1 The look: the family, with a booth curtain
- Copy `../shared-kit/tokens.css` (warm paper, ink-blue pills, serif headings, Caveat). Always light.
- **Feel:** a small, well-kept booth in an old arcade. Warm paper UI; the strip and the camera preview are the only big things on screen.
- **Accents for this site only:**
  - booth-curtain red `--curtain: #a8322d`, used sparingly: a curtain edge drawn in SVG at the top of the landing and booth screens, and the countdown numbers
  - slot black `--slot: #1b1b1b` for the slot the strip slides out of
- Primary buttons are 56px ink-blue pills; chips are 44px.

### 5.2 Voice
- Short, playful, warm, talking to the group: *Squeeze in. Four shots. Go.*
- Never "upload", "process", "render", "filter", "AI" or "generate". Call the looks **styles**.

### 5.3 Screens (phone first at 390×844, one-handed)
1. **Landing:**
   - the curtain edge
   - the headline and sub-line
   - the animated sample strip
   - **Start the booth** and **Use photos you already have**
   - the trust line and footer
2. **Booth:**
   - the 4:3 camera preview (full width), the shot dots, the flip-camera button, and the Pose ideas and Sound toggles
   - **Start** in a bottom bar
   - **During the session:** a huge countdown over the preview, the flash overlay, and the mini strip down the right edge filling up
3. **Camera help:** an error, then the one-at-a-time fallback and the in-app browser steps.
4. **Pick:** the multi-photo picker opens straight from the landing button. Then a *"Pick 2 more"* state if needed.
5. **Frame editor:** one frame big, with drag and pinch, and **Move up · Move down · Replace · Done**.
6. **Result:**
   - the strip
   - the style chips (scrolling sideways)
   - the strip-colour dots, the caption field and the date toggle
   - a sticky bar with **Send** (primary) · **Save image**
   - **Print 4 strips (PDF)** · **Story size** · **Edit photos** above the bar
7. **Done:** see §3 Step 5.
8. **Errors** (one friendly message, one button): camera denied, no camera, not an image, HEIC, export failed.

**The develop animation** (result screen, first time only and on New strip):
- 0–1.2 s: the strip slides down out of the slot (a dark bar at the top of the screen), with a slight ease-out and a 1° wobble.
- 0.6–2.4 s: the frames fade from a flat pale grey-brown (`#cfc6b8`) to the real image. The bottom band's stamp prints last.
- Changing style later swaps instantly, with no re-develop.

**Desktop:** the same screens centred in a 480px column. The live booth works with a webcam.

### 5.4 The strip (the most important visual)
**True size:** 2×6 in at 300 dpi, so **600×1800 px**, portrait. All numbers below are at that size.
- **Side and top margin:** 45 px.
- **Four frames:** 510×383 px each (about 4:3 landscape), 30 px apart, the first at y = 45. The last ends at y = 1667.
- **Bottom band:** y 1667–1800 (133 px):
  - line 1: the caption · the date (or just one of them), in the dot-matrix stamp, about 26 px tall
  - line 2: `THE-POCKET-BOOTH.VERCEL.APP`, dot-matrix, about 14 px tall, at 60% ink
  - both centred
- **Dot-matrix stamp:**
  - drawn in code: a 5×7 dot grid per character, round dots, slightly uneven ink so it looks printed
  - glyphs: A–Z, 0–9, space, `. , ' ! ? - : & / @ # ♥ ·`
  - lower case is drawn as upper case
  - any other character (for example non-Latin) falls back to Caveat for that text
  - no web fonts are needed for the strip, so it looks the same on every phone
- **Paper:** the strip colour, with very fine paper grain (2% noise) and a hairline darker edge.
- **Frames:**
  - each photo is cropped to the frame's aspect using its crop (§6.4), graded with the style, then drawn
  - every frame gets the **same grain seed and the same tiny softening** (§6.4), so the four feel like one camera
- **Mirror:** live front-camera shots are kept mirrored, as people saw themselves. Camera-roll photos are never mirrored.

### 5.5 The 7 styles
Each style is: a grade (pixel maths on each frame), a default strip colour, frame corners, and extras. All drawn in code.

| id | Name | Grade | Strip colour (default) | Frames and extras |
|---|---|---|---|---|
| `classic` (default) | Classic | Black and white (luma 0.299/0.587/0.114), strong S-curve, black point 4%, white point 96%, grain 6%, vignette 15% | White `#f7f5f0` | Square corners. The real 80s booth |
| `film` | Warm film | Colour; warm highlights (R +6, B −6), lifted blacks (8%), saturation −10%, soft red halation on highlights (10%), grain 5% | Cream `#f1e8d6` | Square corners |
| `flash` | Flash night | Direct-flash look: centre +18% falling to corners −25% (radial), high contrast, crushed shadows, slightly cool (R −4), saturation +5%, grain 7% | Black `#141414` (stamp in white) | Square corners. The party look |
| `faded` | Faded | Contrast −30%, black point 15%, cyan shadows and warm-pink highlights, saturation −35% | Yellowed `#efe2bf` | Softly worn: darker paper edges, one faint crease across a frame, slightly rounded worn corners. The strip found in an old wallet |
| `fourcut` | Four-cut | Bright (+10% exposure), low contrast, soft bloom (blurred copy screened at 20%), a slight pink tint | Pastel pink `#f6d6dc` | Rounded frame corners (18 px). Korean four-cut style; the band reads `POCKET BOOTH` above the date |
| `sepia` | Sepia 1950s | Luminance mapped through a brown ramp (`#2b1a0e` → `#f3e3c4`), vignette 25%, grain 8% | Cream `#efe6d2` | Small rounded corners (8 px), a few faint scuffs |
| `disposable` | Disposable | Warm and saturated (+15%), green-tinted shadows, highlights slightly clipped, vignette 20%, grain 6% | White `#f7f5f0` | An orange 7-segment date stamp in the bottom-right corner of frame 4 (`'26 10 08` style), drawn in code |

**Strip colour choices:** the style's own colour (default), White `#f7f5f0`, Black `#141414`, Pink `#f6d6dc`, Blue `#d5e3f2`. On Black, the stamp is white.

### 5.6 The share images (the strip, presented)
A bare 600×1800 strip looks tiny and odd in a chat, so the share images show the strip **as an object**.
- **4:5, 1080×1350 (the main share):**
  - background: warm paper `#f3ece0` with soft grain and a faint vignette
  - the strip centred, about 1180 px tall, rotated −4°
  - a soft two-layer shadow: tight and dark, then wide and soft
  - a short strip of washi tape across its top (drawn in code, semi-transparent)
  - bottom-right, 22 px, 60% ink: *made with the-pocket-booth.vercel.app*
- **Story, 1080×1920:**
  - the same background
  - the strip about 1250 px tall, rotated −3°, within the story safe zone: y 270–1540, side margins 90 px
  - the mark at 26 px, inside the safe zone
- Both are drawn from the same full-resolution strip render, so they're sharp.

---

## 6. Tech

Plain HTML, CSS and JavaScript, no build step, no framework, **no libraries at all** (the PDF is written by hand, §6.6). Classic scripts attach to `globalThis.PB`. Every engine file must load in Node without touching `document`, `window` or `navigator` at load time.

### 6.1 Files

```
pocket-booth/
├── index.html
├── assets/
│   └── sample/           1.jpg … 4.jpg: the landing sample (free licence, the same friends, ≤1200 px long side, ≤200 KB each); credit in README
├── src/
│   ├── app.js            site-builder: screens, state, events, POSES list; MAKER_NAME + SIBLINGS + footer from ../shared-kit/footer/
│   ├── styles.css        site-builder: starts from ../shared-kit/tokens.css + ../shared-kit/footer/footer.css
│   └── engine/           engine-builder
│       ├── util.js       from ../shared-kit/engine/util.js; namespace UL → PB; the constants block replaced with §7.3; messages adapted (§7.2)
│       ├── decode.js     from ../shared-kit/engine/decode.js; UL → PB; DEFAULT_MAX_SIDE 2000
│       ├── camera.js     new: getUserMedia start/stop/flip, grab a frame (mirrored or not), support check
│       ├── photo.js      new: photo object, statistics, auto-crop, matching (§6.4)
│       ├── styles.js     new: the 7 grades (§5.5)
│       ├── stamp.js      new: the 5×7 dot-matrix font and the 7-segment date
│       ├── strip.js      new: the strip object, layout, render at any scale, caching
│       ├── scene.js      new: the 4:5 and story share images (§5.6)
│       ├── print.js      new: the print sheet layout (A4/Letter), the canvas preview of the sheet
│       ├── pdf.js        new: a minimal hand-written PDF writer (§6.6)
│       ├── sound.js      new: synthesised beep and shutter (Web Audio, no files)
│       ├── sample.js     new: loads assets/sample/1–4.jpg with preset crops
│       ├── export.js     new: makes the share/story JPEGs and the print PDF; fileName (pattern from ../shared-kit/engine/export.js, no video)
│       └── share.js      from ../shared-kit/engine/share.js; UL → PB; fallback name "pocket-booth"
├── fonts/                caveat-600.woff2 + OFL.txt, from ../shared-kit/fonts/
├── tests/                never deployed
│   ├── smoke.js          integrator: every PB name exists (pattern from ../look-up/tests/smoke.js)
│   ├── page-check.js     integrator: headless Edge with a fake camera (copy and adapt ../look-up/tests/page-check.js and cdp.js)
│   ├── strips.html       engine-builder: the M1 test page (§7.4)
│   ├── engine/           engine-builder: small Node tests (layout maths, print layout in points, PDF structure, stamp glyphs, file names)
│   └── real/             stock test photos (gitignored), with CREDITS.md listing source and licence
├── shots/                ui-verifier screenshots (gitignored)
├── notes/
├── README.md, VERIFY.md
├── .gitignore            copy ../look-up/.gitignore
├── .vercelignore         copy ../look-up/.vercelignore
├── .gitattributes        copy ../look-up/.gitattributes
└── vercel.json           copy ../look-up/vercel.json
```

**Copy, never link.** Never edit anything outside `pocket-booth/`. If a kit file needs a fix, report it; the main session updates `../shared-kit/` with Rishi's okay. The kit's `export.js` and `vendor/` (video) aren't needed today.

**Script order in `index.html`:**
`util, decode, camera, photo, styles, stamp, strip, scene, print, pdf, sound, sample, export, share`, then `app.js`.

### 6.2 Speed targets (mid-range Android; your PC is several times faster)
- Style change on the result screen: under about 250 ms. Render the on-screen strip at half size (300×900); render full size only for outputs.
- Share image: under 1 s. PDF: under 1.5 s.
- Camera grab: under 50 ms, so the flash and the shot line up.
- Cache each frame's cropped, matched photo at strip size. A style change then only re-grades four 510×383 images.

### 6.3 The camera
- `getUserMedia({ video: { facingMode, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false })`. **Never ask for audio.**
- It works only on HTTPS or localhost. **A phone on Wi-Fi at `http://192.168.x.x` can't open the camera**, so the live booth's first real-phone test is on the deployed site (§8 M4).
- **The preview** is a `<video playsinline muted autoplay>` with `object-fit: cover` inside a 4:3 box. It's mirrored with CSS for the front camera.
- **The grab** draws the video's current frame into a canvas, cropped to the same 4:3 area the preview shows (centre crop), mirrored for the front camera.
- **Flash timing:** show the white overlay, wait about 120 ms (the screen lights the faces), grab, then fade the overlay over 300 ms. Whether the screen flash visibly helps is checked on a real phone.
- **Stop the stream** whenever the booth screen is left, the page is hidden, or the session ends. The camera light must go off.
- **Errors:**
  - `camera-denied`: permission refused
  - `camera-missing`: no camera
  - `camera-unsupported`: no getUserMedia, which happens in some in-app browsers
- **Fallback:** a file input with `accept="image/*" capture="user"`, used four times (*"Photo 1 of 4"*). Each tap opens the phone's camera app. The result is the same strip.

### 6.4 Photos, framing and matching
- **Auto-crop:**
  - cover the frame's aspect
  - horizontally centred
  - vertically centred on 40% from the top
  - zoom 1

  The crop is `{ cx, cy, zoom }`: `cx` and `cy` are the centre (0–1 of the photo), and `zoom` is at least 1, relative to the cover fit. The frame editor changes it with drag and pinch, clamped so the photo always covers the frame.
- **Matching** (camera-roll photos at full strength; live shots at half, since they already match). It runs on the cropped frame at strip size, **before** the style:
  1. **Levels:** from the 1% and 99% luminance percentiles, blended 70%.
  2. **White balance:** grey-world, with channel gains clamped to 0.8–1.25, blended 50%.
  3. **Exposure:** a midtone gamma so the median luminance moves toward 0.48, blended 70%.
- **One-camera finish** (all frames, after the style):
  1. the same tiny softening (a 0.6 px blur) to even out sharp and soft photos
  2. **grain** at strip resolution from one seed per strip
  3. the style's vignette

  Grain and softness are what make four different photos read as one booth.

### 6.5 Sound
Synthesised with Web Audio, no files:
- **Beep:** a short 880 Hz sine, 80 ms.
- **Shutter:** a 40 ms burst of filtered noise plus a low click.

The audio context is created on the first tap (Start). It respects the Sound toggle. A phone on silent may mute it, and that's fine.

### 6.6 The print PDF
- **Paper:**
  - A4 (595.28×841.89 pt) by default
  - US Letter (612×792 pt) when the browser's language region is US, CA, MX, PH, CL, CO, VE or PR, from `PB.print.paperFor(navigator.language)`
- **Layout (in points; 72 pt = 1 in):**
  - Each strip is placed **sideways** (rotated 90°), as a 432×144 pt rectangle (6×2 in). Upright side by side, four strips would be too wide for A4.
  - Four strips stacked, 18 pt apart, so 630 pt tall in total.
  - The stack is centred on the page.
  - **Cut marks:** 0.5 pt black lines, 12 pt long, starting 4 pt outside each strip corner, never touching the image.
  - **Top line**, Helvetica 9 pt, grey, centred: *"Pocket Booth · Print at Actual size (100%), not Fit to page · Cut along the marks"*.
  - **Bottom:** a 5 cm (141.73 pt) line with *"This line should measure 5 cm"*, so anyone can check their print scale.
- **Image:**
  - the strip rendered at full 600×1800
  - with a **print lift** (midtone gamma 0.9 and shadows +3%) so it doesn't print muddy
  - encoded as JPEG quality 0.95
  - **embedded once** and drawn four times (one image object, four `cm` placements), so the PDF stays small (about 300–600 KB)
- **The writer** (`pdf.js`, about 150 lines, no library):
  - PDF 1.4: Catalog, Pages, one Page, one Image XObject (`/DCTDecode`, `/DeviceRGB`, 8 bits), the standard Helvetica font, one uncompressed content stream
  - correct byte offsets in the xref table
  - output as a `Uint8Array`, so the JPEG bytes stay binary
  - the Catalog sets `/ViewerPreferences << /PrintScaling /None >>`, which asks viewers to print at actual size
- **Saving:** a `File` of type `application/pdf`, through `PB.share`:
  - **iPhone:** the share sheet offers Print, Save to Files and WhatsApp
  - **Android:** share, or a download to the Downloads folder, ready to send to a print shop on WhatsApp

### 6.7 Saving, sharing and remembering
- **Share and story images:** JPEG quality 0.92. Make the 4:5 image as soon as the result settles (debounced 300 ms after the last change), so **Send** is instant.
- **Making on tap:** the story image and the PDF are made only when their button is tapped. If that takes longer than the browser allows for a share (iOS), the button turns into **Share now** for a second tap.
- **Share the file only,** with no text. The image carries the address.
- **Remembered on the device** (`localStorage`, wrapped in try/catch): the last style, strip colour, sound and pose ideas. Photos are never stored.

---

## 7. The contract between screens and engine

The site-builder and engine-builder work in parallel. **This section keeps them in step.** Names, inputs and results must match exactly.

### 7.1 Who owns what
| Owner | Files |
|---|---|
| site-builder | `index.html`, `src/app.js`, `src/styles.css` |
| engine-builder | `src/engine/` (all), `tests/strips.html`, `tests/engine/` |
| integrator | small fixes anywhere; `fonts/`, `tests/smoke.js`, `tests/page-check.js`, `tests/cdp.js`, `.gitignore`, `.vercelignore`, `.gitattributes`, `vercel.json` |
| ui-verifier | `VERIFY.md`, `shots/` |
| main session | downloads (stock photos, the sample), `assets/`, `tests/real/`, git, GitHub, Vercel, `README.md`, `../shared-kit/`, root `../README.md` and `../CLAUDE.md` |

### 7.2 Errors
Engine functions reject with `Error` objects carrying `{ code, title, detail }`. Here `title` and `detail` are friendly, ready to show.

Codes:
- `not-image`, `heic`, `unreadable`
- `camera-denied`: *"The camera's switched off for this site."* / *"Allow the camera in your browser settings, or take 4 photos one at a time."*
- `camera-missing`: *"No camera found."* / *"You can still make a strip from photos you already have."*
- `camera-unsupported`: *"This app's browser can't open the camera."* / *"Open this page in Chrome or Safari for the full booth, or take 4 photos one at a time."*
- `export-failed`, `pdf-failed`
- `cancelled`, which the site ignores

### 7.3 Names
**Constants**
- `PB.STYLES = [{ id: "classic", name: "Classic" }, { id: "film", name: "Warm film" }, { id: "flash", name: "Flash night" }, { id: "faded", name: "Faded" }, { id: "fourcut", name: "Four-cut" }, { id: "sepia", name: "Sepia 1950s" }, { id: "disposable", name: "Disposable" }]`
- `PB.PAPERS = [{ id: "auto", name: "Style" }, { id: "white", hex: "#f7f5f0" }, { id: "black", hex: "#141414" }, { id: "pink", hex: "#f6d6dc" }, { id: "blue", hex: "#d5e3f2" }]`
- `PB.DEFAULTS = { style: "classic", paper: "auto", caption: "", showDate: true, when: 0 }`
- `PB.STRIP = { w: 600, h: 1800, dpi: 300, margin: 45, frameW: 510, frameH: 383, gap: 30, bandY: 1667, bandH: 133 }`
- `PB.FRAMES = 4`

**Photo in**
- `PB.decode.fileToImageData(file, { maxSide }) → Promise<ImageData>`

**Camera**
- `PB.camera.supported() → boolean`
- `PB.camera.start(video, { facing: "user" | "environment" }) → Promise<{ facing, width, height, stop() }>`: attaches the stream to the `<video>` element
- `PB.camera.grab(video, { mirror, aspect }) → HTMLCanvasElement`: the centre crop at `aspect` (frameW/frameH), full camera resolution
- `PB.camera.stopAll()`

**Photos**
- `PB.photo.from(source, { live }) → Promise<Photo>`, where `source` is an `ImageData` or a canvas
  - `photo.width`, `photo.height`, `photo.live`: live shots get half-strength matching
- `PB.photo.autoCrop(photo) → { cx, cy, zoom }`
- `PB.photo.clampCrop(photo, crop) → crop`: keeps the frame covered
- `PB.photo.drawCrop(canvas, photo, crop)`: the frame editor's view, un-styled, sized to the canvas

**The strip**
- `PB.strip.create(photos, crops, settings) → Promise<Strip>`: takes 4 photos and 4 crops; resolves once fonts are ready
  - `strip.settings`: current settings, with defaults filled in
  - `strip.update(partialSettings) → Promise<void>`
  - `strip.setPhoto(i, photo, crop)`, `strip.setCrop(i, crop)`, `strip.swap(i, j)`
  - `strip.render(scale) → HTMLCanvasElement`: 600·scale × 1800·scale, cached per settings and scale
- `PB.stamp.draw(ctx, text, x, y, height, color, { align })`: dot-matrix text; returns the width
- `PB.scene.draw(ctx, strip, format)`, where `format` is `"share"` (1080×1350) or `"story"` (1080×1920)

**Print**
- `PB.print.paperFor(locale) → "a4" | "letter"`
- `PB.print.layout(paper) → { page: { w, h }, strips: [{ x, y, w, h, rotate }], marks: [{ x1, y1, x2, y2 }], texts: [{ text, x, y, size }], ruler: { x1, y, x2 } }`, all in points
- `PB.print.drawPreview(canvas, strip, paper)`: the whole sheet drawn on a canvas at 150 dpi, for checks and screenshots

**Export**
- `PB.export.shareImage(strip, format) → Promise<File>`: JPEG, `format` `"share"` | `"story"`
- `PB.export.printPdf(strip, { paper }) → Promise<File>`: `application/pdf`
- `PB.export.fileName(kind, ext) → string`, where `kind` is `"share"` | `"story"` | `"print"` (§3 Step 4)

**Sample and sound**
- `PB.sample.load() → Promise<{ photos, crops, settings }>`
- `PB.sound.beep()`, `PB.sound.shutter()`, `PB.sound.unlock()`: call `unlock` inside the first tap

**Sharing**
- `PB.share.platform()`, `PB.share.canShare(file)`, `PB.share.share(file)`, `PB.share.save(file)`: as in the kit

### 7.4 Dev shortcuts in the address (for checks and screenshots)
- `?sample=1`: start on the result screen with the sample strip
- `&screen=landing|booth|countdown|camera-help|pick|edit|result|done|frame|error-camera-denied|error-camera-missing|error-not-image`
- `&style=<id>&paper=<id>&caption=...&date=0|1&when=<ms>`
- `&format=strip|share|story|print` with `screen=frame`: draw that one output full size on a canvas and stop. `print` uses `PB.print.drawPreview`; `&paper=a4|letter` picks the sheet in that case.
- `&fast=1`: countdowns of 0.3 s, for the page check
- `&develop=0`: skip the develop animation (for screenshots)
- **`tests/strips.html?set=real`:** loads every photo in `tests/real/` in groups of 4 (in file order, wrapping round). For each group it shows:
  - the 4 raw crops
  - the 4 matched crops
  - the strip in all 7 styles side by side, at half size

  Plus the timings.
- **`tests/strips.html?set=sample&style=<id>`:** one strip full size.
- The site keeps `window.__booth = { screen, settings, photos, crops, strip }` current.

---

## 8. Milestones (check on a phone-sized screen after each)

**M0. Test material (main session, before anything; Rishi okays the download list once).**
- **Find 8–10 free-licensed photos of people** (Unsplash or Pexels; their licences allow this). Pick them to be deliberately mismatched, like a real camera roll:
  - two friends, a phone selfie at arm's length, daylight
  - a group of 3–4 indoors, warm lamp light
  - a night photo with harsh flash
  - a dim, noisy photo
  - an outdoor sunny photo
  - a portrait-orientation and a landscape-orientation photo
  - a close-up of two faces
  - one already black and white
- **Separately, 4 photos of the same people from one shoot,** for the landing sample.
- **Show Rishi one list:** file name, source page, licence and size. Then download:
  - the test set to `tests/real/`, with `tests/real/CREDITS.md`
  - the sample to `assets/sample/1–4.jpg` (≤1200 px, ≤200 KB each), noting the credit for the README

**M1. The strip: go / no-go (engine-builder, about 1.5 h).**
- Build `util`, `decode`, `photo` (crop and match), `styles` (all 7), `stamp`, `strip`, and `tests/strips.html`.
- Screenshot every group from the test set in all 7 styles, and **look at it**.
- **Show Rishi:**
  - full-size strips: the most mismatched group in Classic, Four-cut and Disposable
  - the raw-vs-matched comparison
  - a close crop of the dot-matrix band
- **Rishi decides:** does it look like a real booth strip, and do four mismatched photos look like one session? If not, fix the strip before anything else.

**M2 + M3 in parallel (about 1.5 h).**
- engine-builder: `camera`, `scene`, `print`, `pdf`, `sound`, `sample`, `export`, `share`, plus Node tests for the print layout and PDF structure.
- site-builder: all screens from §5.3, using the §7 names.

**Join (integrator):** smoke and page checks passing (the page check runs the live booth with Edge's fake camera). Then ui-verifier writes `VERIFY.md`, and the fix loop runs until it's clean.

**M4. A first private deploy for the camera (main session, with Rishi's okay).** The camera can't be tested on a phone over local Wi-Fi (§6.3), so this happens straight after the first clean verify:
- `git init`
- create the repo
- deploy to Vercel (`the-pocket-booth`)

Rishi then tests on his own phone:
- the live booth with the front and back cameras, the flash and the sound
- picking 4 of his photos
- Send, Save, Print PDF

He prints one sheet (home or print shop) and **measures the 5 cm line and a strip (should be 2×6 in, about 5.1×15.2 cm)**. Fixes go back through integrator → ui-verifier → redeploy.

**M5. Ship (main session, with Rishi's okay at each step).**
- Turn on Web Analytics.
- README with the standard sections, the sample photos' credit and a demo GIF.
- Rishi marks the real-phone rows "tested by hand" in `VERIFY.md`.
- **Root updates:**
  - `../README.md` gets the Day 6 row
  - `../CLAUDE.md` "Where we are" gets Day 6 live
- **With Rishi's okay** (these touch other projects): add Pocket Booth to `../shared-kit/footer/siblings.js` and to the footers of the earlier sites.

---

## 9. Risks and what we do about them

| Risk | Plan |
|---|---|
| The strip looks like an app template, not a real booth | M1 go/no-go on full-size strips: true proportions, paper grain, dot-matrix stamp, one-camera grain |
| Camera-roll photos still look mismatched | Matching (§6.4) plus a shared grain and softening; judged at M1 on a deliberately mismatched stock set |
| Camera blocked in the Instagram/WhatsApp in-app browser | Friendly message, the one-at-a-time camera-app fallback, and "open in browser" steps; tested from a real Instagram link at M4 |
| Camera can't be tested over local Wi-Fi (needs HTTPS) | An early private deploy at M4; Edge's fake camera for automated checks before that |
| Print comes out the wrong size | `/PrintScaling /None`, the "Actual size" line on the sheet and the site, and the 5 cm check line; Rishi measures a real print at M4 |
| Print comes out dark or muddy | The print lift (§6.6); checked on Rishi's real print |
| Low-end Android slow on style change | Half-size on-screen render, cached matched frames (§6.2) |
| The share sheet needs a fresh tap on iOS | Share image made ahead; the story and PDF become **Share now** on a second tap if needed |
| Front-camera frames are low resolution on cheap phones | Frames are only 510×383 at 300 dpi, so even a 720p camera is enough |
| Name collision with other "Pocket Booth" sites | Our address is distinct (`the-pocket-booth`); launch copy always uses the full address |

## 10. Definition of done

On top of the root `../CLAUDE.md` checklist:
- [ ] The strip looks like a real booth strip, and four mismatched photos look like one session (Rishi's judgement at M1)
- [ ] Live booth: Start → 4 shots → strip works on a real iPhone (Safari) and a real Android (Chrome); the camera light goes off after
- [ ] From your photos: pick 4 → adjust → strip works on both phones
- [ ] The 4:5 share image reads as a booth strip in WhatsApp and Instagram DMs; the story image posts inside the safe zones
- [ ] The PDF prints 4 strips at exactly 2×6 in on A4 (measured), sharp and not muddy
- [ ] The camera-blocked path (Instagram in-app browser) still ends in a strip
- [ ] Address on every output and in the strip's band; "More from Risheek" footer; analytics on
- [ ] README (with the sample photos' credit and a demo GIF), live address, root README and CLAUDE.md updated
