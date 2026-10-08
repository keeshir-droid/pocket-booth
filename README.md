# Pocket Booth

**A photo booth in your pocket.** Four shots, a countdown and a flash, and out slides a real-looking photo booth strip. Or turn four photos you already have into one. Send it to everyone in it, and print four real-size strips on one page. Free, no account, no AI, and your photos never leave your phone.

Made for friends taking pictures together. Day 6 of [21 Days of Creative Tech](https://github.com/keeshir-droid).

**Live:** https://the-pocket-booth.vercel.app (see "Deploying" below)

<!-- Demo GIF: to add once the first phone test is done -->

## The story

Photo booth strips are having a moment: young people queue to pay for two printed strips of four, to hold something real instead of leaving photos buried in their phones. A booth gives you the countdown chaos, the squeeze, and a keepsake. This puts that in a phone, anywhere (a bedroom, a terrace, a hostel room), free, with a strip you can actually print.

## How it works

1. **Start the booth.** Tap Start: 3, 2, 1, flash, four times. Or **use photos you already have** (pick four).
2. A strip slides out of the slot and develops. Each photo is auto-framed on the faces and gently matched to the others (levels, white balance, exposure, colour), then given one grain and softness so four different photos feel like one booth session.
3. Pick one of seven **styles** (Classic, Warm film, Flash night, Faded, Four-cut, Sepia 1950s, Disposable), a strip colour, a caption and a date. The caption and date are printed in a dot-matrix stamp drawn in code.
4. **Send** a 4:5 share image, save a story-size image, or **print four strips at true 2×6 in** on one A4 or US Letter page, with cut marks and a 5 cm ruler to check your print scale.

Everything happens on the device. No uploads, no accounts, no libraries, no build step: plain HTML, CSS and JavaScript. The PDF is written by hand. The look (curtain, marquee bulbs, sticker buttons) is all inline SVG and CSS. Fonts are self-hosted: Shrikhand, Courier Prime and Caveat (all SIL OFL, licences in `fonts/`).

## What broke / what was hard

- Four mismatched camera-roll photos in colour styles still looked like different worlds after levels, white balance and exposure matching. What fixed most of it was a shared palette step per style (pull odd hues toward the style's colour, cap extreme saturation, split-tone). Classic, Sepia and Faded hide mismatches naturally; Flash night is the least unified, on purpose.
- Headless Edge cannot render a true phone width, so phone checks use device emulation.
- Early drafts used Shrikhand for digits, and its "4" looks odd, so numbers in headings are spelled out.

## Limits and next steps

- The camera needs HTTPS (the live site) and has only been tested with a fake camera so far. Real iPhone and Android checks, the print measurement, and the share sheet on real phones are listed in `VERIFY.md` ("Needs a real phone").
- Not today: a story **video** of the strip developing, stickers or handwriting on the strip, moving strips, other layouts (3 frames, 2×2), retaking a single frame, a 4×6 photo layout, offline use.

## Running it locally

```
python -m http.server 8000
```
then open http://localhost:8000. The camera works on `localhost` and on the deployed HTTPS site, but not over `http://192.168.x.x`.

Checks (Node, no installs): `node tests/smoke.js`, `node tests/engine/<name>.test.js`, and `node tests/page-check.js` (headless Edge, fake camera, needs the local server).

## Deploying

A static site: no build step. Import the repo in Vercel (Framework: Other, no build command, output directory `.`). `vercel.json` sets caching and `.vercelignore` keeps tests and planning files out of the deploy. Turn on Web Analytics in the Vercel dashboard; the page already loads `/_vercel/insights/script.js` when it exists.

## Credits

- Landing sample photos: [cottonbro studio](https://www.pexels.com/@cottonbro) on Pexels (photos 4003765, 4003773, 4003776, 4003803), Pexels License.
- Fonts: Shrikhand (Jonny Pinhorn), Courier Prime (The Courier Prime Project Authors), Caveat. SIL Open Font License 1.1.

## Links

- Reel: coming soon
- More from Risheek: Handwriting → Font, Doodle Alive, Underline, Look Up
