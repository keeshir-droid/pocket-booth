# VERIFY.md: Pocket Booth

Checked 2026-10-08 against a private static server (http://localhost:8011), headless Edge, fake camera. Screenshots are in `shots/`.

How the shots were made, and one thing to know:
- The strips, share, story, print and laptop shots were taken with the standard Edge command.
- Headless Edge will not make a window narrower than about 500 px, so the plain `--screenshot` phone shots (`landing-phone.png`, `booth-phone.png`, `result-phone.png`, `done-phone.png`, `error-phone.png`, `countdown.png`, `camera-help.png`, `camera-missing.png`, `not-image.png`, `edit.png`, `develop-mid.png`, `result-tall.png`, `*-small.png`) show a 480 px layout cropped to 390 px. They look cut off on the right. That is the screenshot tool, not the site.
- So every phone verdict below uses true-width shots taken with device emulation (the project's own `tests/cdp.js`), named `*-true.png`. Page-check also confirms no horizontal scroll at 360, 390 and 430 px.
- `node tests/page-check.js` (with `PB_BASE=http://localhost:8011`): **PAGE CHECK PASS**, every line PASS (live booth with fake camera, photos, outputs, result controls, all dev screens, no horizontal scroll).

## Results

| Item | PASS / FAIL / UNSURE | Why | Screenshot | Tested by hand |
|---|---|---|---|---|
| Landing: headline, sub-line, animated sample strip, two buttons, trust line (PLAN §3 step 1) | PASS | All present, hierarchy is clear: curtain, big headline, sign + strip, mustard button, cream second button, trust line | landing-phone-true.png, landing-laptop.png | |
| Landing sample strip label matches the style shown | PASS | Phone shows a black and white strip labelled "CLASSIC". Laptop shot caught the cycle on a colour strip labelled "WARM FILM" | landing-phone-true.png, landing-laptop.png | |
| "More from Risheek" sibling footer | PASS | Four sibling cards below the fold | landing-footer-true.png | |
| Live booth screen: 4:3 preview, shot lamps, flip button, Pose ideas and Sound toggles, Start in bottom bar | PASS | Preview box measured 334x250 (4:3) by page-check; everything present, bar does not cover anything | booth-phone-true.png, booth-small-true.png | |
| Countdown screen: huge number, dare, mini strip, Stop | PASS | Big red "2" with cream outline, pose-idea card, mini strip filling, shot lamps, Stop button | countdown-true.png | |
| Countdown beeps, shutter, white flash timing, flash lighting faces | UNSURE | A still cannot show timing or sound | countdown-true.png | |
| Real camera: front/back, mirrored like a mirror, frame matches preview | UNSURE | Only Edge's fake camera (green test pattern) was available | booth-phone-true.png | |
| Camera light goes off after the session and when leaving the booth | PASS | Page-check: every track ended after shot 4, after Back, after Stop | (page-check output) | |
| Camera help and error screens (denied, missing, not-image) | PASS | Friendly title, one line of detail, one button, no raw errors | camera-help-true.png, error-phone-true.png, camera-missing-true.png, not-image-true.png | |
| "Open in your browser" steps for in-app browsers | UNSURE | That card only shows inside an in-app browser and has no address shortcut | camera-help-true.png | |
| Pick photos and "Pick 2 more" state | PASS | Two filled slots, two dashed empty slots, "Add photos" and "Start over" | pick-true.png | |
| Frame editor: view, zoom slider, frame thumbnails, Move up/down, Replace, Done | PASS | Looks right; Move up is correctly greyed on frame 1. Page-check confirms drag, zoom and Move down change the strip | edit-true.png | |
| Frame editor: two-finger pinch on a real touchscreen | UNSURE | Emulation cannot do a real pinch | edit-true.png | |
| HEIC photo gives the friendly message | UNSURE | No HEIC file was tested | | |
| Strip matches PLAN §5.4: 600x1800, 4 frames, bottom band with caption, date, address, paper grain | PASS | True proportions, four 4:3 frames, 45 px margins, band with caption and date, address underneath, fine grain | strip-classic.png | |
| Dot-matrix band is crisp and readable | PASS | Round dots, uneven ink, readable at 1:1 and at 2.5x zoom; address line lighter | strip-classic.png, zoom-band-classic.png | |
| Style Classic: black and white, strong contrast, grain, vignette, white paper | PASS | Strong black and white, visible grain, white strip | strip-classic.png | |
| Style Warm film: warm colour, lifted blacks, cream paper | PASS | Warm and slightly faded, cream paper | strip-film.png | |
| Style Flash night: centre bright falling to dark corners, crushed shadows, black paper, white stamp | PASS | Clear flash falloff, punchy contrast, black strip with white stamp | strip-flash.png | |
| Style Faded: low contrast, cyan/pink split, yellowed paper, worn edges, crease, rounded corners | PASS | Crease across frame 3, darker worn paper edges, soft colour | strip-faded.png | |
| Style Four-cut: bright, pink paper, 18 px rounded corners, "POCKET BOOTH" above the date | PASS | All present | strip-fourcut.png, zoom-band-fourcut.png | |
| Style Sepia 1950s: brown ramp, vignette, small rounded corners, scuffs | PASS | Brown ramp and vignette good. Scuffs are very faint (one small scratch on frame 1) | strip-sepia.png | |
| Style Disposable: warm saturated, orange 7-segment date in frame 4 corner | PASS | Orange `'26 10 08` in frame 4, bottom right. It sits over the hand and the "10" reads oddly, see Other problems | strip-disposable.png, zoom-disposable-stamp.png | |
| Black strip colour on Classic, white stamp | PASS | Black paper, white stamp | strip-black.png | |
| Mismatched photos look like one session | UNSURE | Classic, Sepia and Faded unify well. In Warm film, Flash night and Four-cut a blue-sky frame still sits beside a dark night frame, and "matched" crops look almost the same as raw. Rishi's M1 judgement | strips-real.png, strips-real-full.png | |
| Share image 4:5: strip as an object, tilted, shadow, tape, address mark | PASS | Reads as a booth strip on a table, tape on top, soft shadow, "made with the-pocket-booth.vercel.app" bottom right. Fourcut gets blue tape, Disposable orange tape | share-classic.png, share-fourcut.png, share-disposable.png | |
| Story image safe zones (y 270-1540, 90 px sides) | PASS | Tape top about y 272, strip bottom about y 1505, mark baseline 1534 (code: markX 990, markY 1534). Tight but inside. Strip is 1200 px tall, plan said about 1250 | story-classic.png | |
| Print sheet A4: 4 sideways strips, cut marks clear of strips, top line, 5 cm ruler, all inside the page | PASS | Marks sit outside every corner, instruction line on top, ruler line is 296 px at 150 dpi (5 cm = 295 px) | print-a4.png | |
| Print sheet Letter: same | PASS | Same layout on Letter | print-letter.png | |
| Printed size is really 2x6 in and the 5 cm line is 5 cm | UNSURE | Needs a real print | print-a4.png | |
| Long caption fits | PASS | 24 characters plus date fills the band edge to edge without overflowing (the stamp shrinks). Note: the suggested test text is 25 characters, the field cuts it at 24 so it ends "STO" | strip-long.png, zoom-band-fourcut.png | |
| Non-Latin caption falls back | PASS | Devanagari shows in a handwriting fallback, centred, no overflow. The date next to it also switches to the handwriting font | strip-hindi.png, zoom-band-hindi.png | |
| No caption and no date fall back gracefully | PASS | Only the address line is left, centred, band still looks tidy | strip-nocaption.png | |
| Result screen: strip, style chips, colour dots, caption, date toggle, Print, Story size, Edit photos, sticky Send / Save | PASS | All present and reachable; chips scroll sideways | result-phone-true.png, result-tall-true.png, result-scroll-end-true.png | |
| Sticky bar does not cover controls at 390x844 | PASS | Scrolled to the end, the bar top is at y 748 and the last button ends at y 719. The overlap in earlier full-page shots is only a full-page screenshot artefact | result-scroll-end-true.png | |
| Done screen: "Saved.", nudge, Print, Try another style, New strip, Send again | PASS | All present | done-phone-true.png, done-laptop.png | |
| Look matches §5.1 and the 70s-80s arcade booth art direction | PASS | Scalloped red curtain, bulb marquee frame, mustard hard-shadow buttons, Shrikhand, Courier Prime, Caveat notes, warm paper. Computed fonts: Shrikhand 400, Courier Prime 400/700, Caveat 600 all loaded | landing-phone-true.png, booth-phone-true.png | |
| Every phone screen works one-handed with large buttons | PASS | Every real button and switch is 44 px or taller; primary actions sit in the bottom bar | result-phone-true.png, edit-true.png | |
| Page-check suite | PASS | "PAGE CHECK PASS" | (terminal) | |
| No lorem ipsum, no raw errors, no blank or broken canvases | PASS | None found; every strip and output canvas painted 100% | all | |
| Develop animation: slides from slot, frames fade in, stamp prints last | UNSURE | Mid-shot at 1.3 s shows the strip already out and desaturated; the motion needs eyes | develop-mid-true.png | |
| Send, Save and Story through the real share sheet (WhatsApp, Instagram) | UNSURE | Page-check uses a stub share and a download; real iOS and Android sheets differ | | |
| Style, colour, sound and pose-ideas remembered on the device | UNSURE | Not exercised | | |
| Vercel Analytics script | UNSURE | Returns 404 locally by design; only works once deployed and switched on | | |
| PDF opens and prints from a phone | UNSURE | Only the sheet preview was seen, and the file's structure was checked by page-check | print-a4.png | |

## Aesthetics, per screen

| Screen | Verdict | Notes | Screenshot |
|---|---|---|---|
| Landing, 390x844 | PASS | Poster-like and screenshot-worthy. Gap on the left under the sign (y 410-560) is a bit empty but balanced by the strip | landing-phone-true.png |
| Landing, 360x640 | PASS | Everything fits above the fold, tidy | landing-small-true.png |
| Landing, tall phone (390x1000 and 390x1400) | FAIL | The poster stretches to the screen: a big hole opens in the left column between the sign and the coin (about 150 px at 1000, about 540 px at 1400) | landing-tall-true.png, landing-full-true.png |
| Landing, laptop | PASS | 480 px column centred on warm paper, looks intentional | landing-laptop.png |
| Booth, 390x844 | PASS | Marquee frame is lovely. About 155 px of empty paper above the bottom bar (y 590-745) | booth-phone-true.png |
| Booth, 360x640 | PASS | Fits | booth-small-true.png |
| Booth, 430x932 | PASS | About 240 px of empty paper above the bar, noticeable but not broken | booth-tall-true.png |
| Booth, laptop | FAIL | Curtain art is mis-scaled: top gold rail and bulb loops are cut off and a flat mustard band shows under the scallops (y 50-90). Slightly visible at 430 px wide too | booth-laptop.png |
| Countdown | PASS | Strong hierarchy; dare card, big number, mini strip | countdown-true.png |
| Camera help | PASS | Clear, three actions, one primary | camera-help-true.png |
| Error screens (denied, missing, not-image) | PASS | Clear and readable but the plainest screens: no curtain, a lot of dead paper, 3-line headline on "denied" | error-phone-true.png, camera-missing-true.png, not-image-true.png |
| Pick | PASS | Tilted photo tiles with numbered sticker badges, good | pick-true.png |
| Frame editor | PASS | Good. About 190 px empty above the bar | edit-true.png |
| Result, 390x844 | PASS | Strip on a leather-like table with slot, tape, corners and rubber stamp reads well. Two small flaws, see Other problems | result-phone-true.png |
| Result, 360x640 | FAIL | "Save image" wraps to two lines in the bar so the bar grows and the two buttons differ in height; the strip eats nearly the whole screen so no control is visible without scrolling | result-small-true.png |
| Result, laptop | PASS | Fine in the centred column | result-laptop.png |
| Done | PASS | Big red "Saved." with mustard shadow, clean | done-phone-true.png, done-laptop.png |
| Strips (all 7 styles) | PASS | Photo-booth real, not app-template | strip-*.png |
| Share and story images | PASS | Convincing, but plain beige: no curtain red or arcade character | share-classic.png, story-classic.png |
| Print sheets | PASS | Clean, functional | print-a4.png, print-letter.png |

## Other problems

Site problems, most severe first:
1. Tall phones leave a lot of empty space: landing (hole in the left column, `landing-tall-true.png` x 20-230, y 420-1100 at 1400 high), booth (`booth-tall-true.png` y 600-830), edit (`edit-true.png` y 520-690), pick (`pick-true.png` y 450-690). Content should centre vertically or grow (bigger preview, bigger strip) on tall screens.
2. Booth curtain is mis-scaled at any width above 390 px (`booth-laptop.png` y 0-90): the top rail is cropped and a flat mustard band appears under the scallops. The landing curtain at the same width is fine, so the booth curtain uses different sizing.
3. `result-small-true.png` (360x640): "Save image" wraps to two lines (x 190-345, y 575-610) and the bar grows. Shorten the label, or reduce the size, at 360 px wide.
4. Shrikhand's "4" is an odd old-style figure that reads like a small mark: "Print 4 strips (PDF)" (`result-tall-true.png` x 95-295, y 1082), "4 POSES" on the sign (`landing-phone-true.png` x 60-190, y 335), "Take 4 photos one at a time" on the bar (`error-phone-true.png` y 800). Spell the word out, or set the digit in Courier Prime.
5. Mismatched photos still look mismatched in the colour styles (`strips-real-full.png`, group 1, Warm film, Flash night and Four-cut columns): blue sky frame 1 against near-black frame 4. Matched crops look almost identical to the raw crops, so the matching step has little visible effect. Classic, Sepia and Faded hide it well.
6. Error screens are on-brand in colour but the plainest in the app (`error-phone-true.png`, `camera-missing-true.png`, `not-image-true.png`): no curtain, a big empty area. "No camera found" says you can still use photos you already have, but the only button is "Take 4 photos one at a time"; there is no "Use photos you already have" button there (it exists only on the camera-help screen).
7. On the result screen the sparkle sits on the rubber stamp text "DEVELOPED" (`result-phone-true.png` x 55-70, y 475-490), and the handwritten note "tap a photo to adjust it" touches the strip's top-right corner (`result-tall-true.png` x 268-285, y 145-175).
8. Small text on the phone: "NO. 06" serial plate 9 px, "DEVELOPED" 9.9 px, trust line 10.9 px (`landing-phone-true.png` y 785-810). Legible but at the floor; the trust line is the one that builds trust, make it 12 px or more.
9. Disposable stamp (`zoom-disposable-stamp.png`): it sits across the hand and phone in frame 4, so contrast drops; the "1" in "10" has a gap and reads like ":" plus "0"; and the band loses the date when the stamp takes it (only the caption remains). Moving the stamp or adding a soft dark glow behind it would help.
10. Hindi caption (`strip-hindi.png`): the date next to it also switches to the handwriting font, so the band mixes dot-matrix and script. Graceful, but the date could stay dot-matrix.
11. Share and story images (`share-classic.png`, `story-classic.png`) are very plain next to the site's arcade look. An optional touch: a thin red curtain edge or a mustard sticker so a shared image feels like it came from the booth.
12. Story mark is exactly on the safe-zone edge (right margin 90 px, baseline 1534, descenders about 1540) and the strip is 1200 px tall, not 1250 (`story-classic.png`). Fine, but there is no spare room.
13. The brief's long-caption test text, "The night we couldnt stop", is 25 characters; the caption field stops at 24, so the strip shows "STO". Not a bug, but the example in the spec is wrong.
14. Sepia scuffs are barely there (`strip-sepia.png` frame 1, x 60-75, y 330-350); PLAN §5.5 says "a few faint scuffs".
15. Edge headless cannot render a window narrower than about 500 px with the plain `--screenshot` command, so future runs of the standard command give cropped phone shots. Use device emulation (`tests/cdp.js`) for phone sizes.

## Needs a real phone

Every UNSURE row. Test on the deployed https address, on a real iPhone (Safari) and a real Android (Chrome).

1. **Live camera, front and back.** Open the site, tap Start the booth, allow the camera. Check: the preview is 4:3 and mirrored for the front camera; Flip works; the shot you get matches what the preview showed; the camera light goes off after shot 4 and after Back.
2. **Countdown, beeps, shutter and flash.** Turn Sound on, tap Start. Check: beeps on 3, 2, 1; a shutter sound at each shot; the white flash lights your face in a dim room and the shot is not blurred or doubled. Try with the phone on silent and with Sound off.
3. **Develop animation.** After the fourth shot watch the strip slide out of the slot (about 1.2 s) and fade in. It should feel smooth on a mid-range Android.
4. **Photos path and pinch.** Tap "Use photos you already have", pick 4 (including one from a different year), open a frame, pinch to zoom and drag with two fingers, Move up/down, Replace. Try a HEIC photo from an iPhone and check the friendly message.
5. **Mismatched photos look like one session.** Pick 4 photos from different days and lighting and try each of the 7 styles. Decide whether it feels like one session (the M1 go/no-go).
6. **In-app browser.** Paste the link in an Instagram or WhatsApp chat and open it there. Tap Start the booth: you should see the "Open in browser" steps and "Take 4 photos one at a time"; the fallback should still end in a strip.
7. **Send, Save, Story size.** Tap Send: the phone's share sheet opens with a 4:5 JPEG; send it to WhatsApp and Instagram DM and check it reads as a booth strip with the address mark. Try Save image and Story size, then post the story to Instagram and check nothing is cut by the top or bottom bars.
8. **PDF and print: printing one A4 sheet at Actual size.** Tap Print 4 strips (PDF), open it on the phone (iPhone share sheet: Print or Save to Files; Android: the Downloads folder) and print one A4 sheet (home or shop) with scaling set to Actual size (100%), not Fit to page. Measure with a ruler: one strip should be about 5.1 x 15.2 cm (2 x 6 in); the "This line should measure 5 cm" line should measure 5 cm; cut marks should sit outside the strips. Check the print is not too dark or muddy. Repeat on Letter if you can.
9. **Remembered settings.** Pick a style, a strip colour and turn Sound off and Pose ideas on, close the tab, reopen: they should still be set. Check that your photos were not kept.
10. **Analytics.** After deploy, switch on Web Analytics in the Vercel dashboard and check that a visit shows up.
11. **Aesthetic check on your own phone.** Look at the landing, booth and edit screens at your phone's real height (and in Safari with the toolbar showing) for the empty space described in Other problems 1.

When you have checked a row on a real phone, write "tested by hand" in its last column. A re-run of this check keeps those rows as they are.
