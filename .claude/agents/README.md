# Build agents for Pocket Booth

Four agents build this project, adapted from Day 5's (Look Up), which came from Day 4's (Underline). They're Claude Code subagents: each one is a Markdown file in this folder, and the main session hands work to them. All of them work from [`PLAN.md`](../../PLAN.md). §7 is the contract that keeps the two builders in step.

| Agent | Builds / does | Owns (only edits) | Can run commands? |
|---|---|---|---|
| [`engine-builder`](engine-builder.md) | Everything that touches photos and outputs: photo in, the camera, auto-crop and matching, the 7 styles, the dot-matrix stamp, the strip, the share scenes, the print sheet and PDF, sounds, the sample, export, sharing; tests on the test photos | `src/engine/`, `tests/strips.html`, `tests/engine/` | Yes: syntax checks, small Node tests, headless Edge screenshots |
| [`site-builder`](site-builder.md) | The screens: landing, the live booth session (countdown, flash, mini strip), camera help, picker, frame editor, result, done; the warm-paper look | `index.html`, `src/app.js`, `src/styles.css` | No |
| [`integrator`](integrator.md) | Joins the two, runs the checks (including the live booth with Edge's fake camera), fixes errors and the FAILs in VERIFY.md | Small fixes anywhere; `fonts/`, `tests/smoke.js`, `tests/page-check.js`, `tests/cdp.js`, `.gitignore`, `.vercelignore`, `.gitattributes`, `vercel.json` | Yes |
| [`ui-verifier`](ui-verifier.md) | Screenshots every screen, style, share image and print sheet, and the test photos; judges them; writes VERIFY.md. Never changes code | `VERIFY.md`, `shots/` | Yes: screenshots and curl only |

## The order to use them

1. **Before anything:**
   - Open the build session **inside this folder** (`pocket-booth/`) so these agents load.
   - Rishi starts the local server in a separate terminal, inside `pocket-booth/`, and leaves it running:
     ```bash
     python -m http.server 8000
     ```
     (Stop any other project's server on port 8000 first.)
   - **M0:** the main session finds 8–10 free-licensed stock photos of people plus 4 from one shoot for the sample, shows Rishi the list, and downloads them with his okay (PLAN.md §8).
2. **M1, the strip:** `engine-builder` builds photo in, crop and match, the 7 styles, the stamp and the strip, plus `tests/strips.html`, and checks it on every test group. The main session shows Rishi full-size strips. **Rishi says go or no-go.**
3. **M2 + M3, in parallel:** `engine-builder` (camera, scenes, print, PDF, sound, sample, export, share) and `site-builder` (screens). They own different files, so they can run at the same time.
4. **Join:** `integrator` makes them fit and gets the checks passing.
5. **Check:** `ui-verifier` writes `VERIFY.md`.
6. **Fix loop:** `integrator` fixes the FAILs, then `ui-verifier` checks again. Repeat until clean.
7. **M4, first deploy for the camera:** the camera needs HTTPS, so it can't be tested on a phone over local Wi-Fi. The main session sets up git, GitHub and Vercel with Rishi's okay. Rishi tests on his phone and prints one sheet. Fixes go back through steps 4–6.
8. **Ship (M5):** the main session handles analytics, the README and the root README/CLAUDE.md updates (agents never push). Rishi marks his real-phone rows "tested by hand" in `VERIFY.md`.

**Things agents can't do**, so the main session does them with Rishi's okay:
- downloading anything (stock photos, the sample)
- creating the GitHub repo, pushing, deploying, enabling analytics
- editing `../shared-kit/` or other projects (adding Pocket Booth to the sibling list and older footers)

## How agents work (for editing them)

- Claude Code picks these up **when the session is opened in the `pocket-booth` folder**.
- Each agent works in its **own fresh context** and doesn't see the main conversation. Everything it needs is in its file, PLAN.md, or the task it's given.
- If an agent's instructions conflict with PLAN.md, PLAN.md wins, and the conflict should be reported.
- After editing an agent file, start a new session (or reload agents) so the change is picked up.
