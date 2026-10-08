# HANDOFF: building Pocket Booth (Day 6)

## Before you start (Rishi)

1. **Open a new Claude Code session in this folder:** `C:\creative technologist projects\pocket-booth`. The four agents in `.claude/agents/` only load when the session opens here.
2. **Start the local server** in a separate terminal and leave it running. Stop Look Up's server first if it's still on port 8000.
   ```bash
   cd "C:\creative technologist projects\pocket-booth"
   ```
   ```bash
   python -m http.server 8000
   ```
3. **No photos needed from you.** The build session finds free-licensed stock photos of people and asks you once before downloading them.
4. **The camera can only be tried on your phone after the first deploy** (it needs HTTPS). The session will ask you before deploying.
5. Paste the prompt below into the new session.

---

## The prompt to paste

```
You are the main session building Pocket Booth, Day 6 of my 21 Days of Creative Tech. Everything is planned. Your job is to coordinate the build with the agents in .claude/agents/ and get it right the first time.

Read first, fully: PLAN.md (the single source of truth), .claude/agents/README.md (the agents and the order to use them), ../shared-kit/README.md (the family kit we copy from), and the root ../CLAUDE.md (project-wide rules, loaded automatically). Decisions are already made and listed at the top of PLAN.md. Don't reopen them.

How to run the build:
- M0 first (PLAN.md §8): find 8–10 free-licensed stock photos of people (Unsplash or Pexels), deliberately mismatched like a real camera roll, plus 4 photos of the same people from one shoot for the landing sample. Show me one list (file name, source page, licence, size) and wait for my okay before downloading. Save the test set to tests/real/ with tests/real/CREDITS.md, and the sample to assets/sample/1–4.jpg (≤1200 px, ≤200 KB each).
- Then follow the order in .claude/agents/README.md exactly: M1 (engine-builder) → go/no-go with me → M2 + M3 in parallel (engine-builder + site-builder) → integrator → ui-verifier → fix loop → M4 first deploy and my phone test → fix loop → M5 ship.
- Give each agent a precise task: the milestone, the PLAN.md sections it serves, and what "done" means. Agents don't see this conversation.
- After every agent finishes, read its report and open the key screenshots yourself before telling me it's done. "It passed" isn't proof; look at the actual output.
- M1 is the go/no-go. Show me full-size strips of the most mismatched group in Classic, Four-cut and Disposable, the raw-vs-matched comparison, and a close crop of the dot-matrix band. Wait for my "go" before M2/M3.
- Keep the load on my laptop light: one heavy command at a time, never several Edge windows at once, and never start or stop the local server (I run it on port 8000).
- Stay inside this folder. Don't edit ../shared-kit/ or other projects without asking me.
- Ask me before: downloading anything, creating the GitHub repo, pushing, deploying, enabling analytics.
- If an agent's instructions conflict with PLAN.md, PLAN.md wins. Tell me about the conflict.
- Explain things to me in plain English. After each milestone, give me a short update: what works, what I should look at, and what's still unverified.

M4, first deploy (with my okay at each step):
- git init (with the .gitignore from PLAN.md §6.1; tests/real/, tests/out/ and shots/ must never be committed), create keeshir-droid/pocket-booth, push.
- Create the Vercel project "the-pocket-booth" (address the-pocket-booth.vercel.app).
- Then give me a short phone checklist: the live booth (front and back camera, flash, sound), the camera-blocked path from an Instagram link, picking 4 of my photos, Send / Save / Print PDF, and printing one A4 sheet at Actual size and measuring a strip (about 5.1×15.2 cm) and the 5 cm line.

Ship (M5, with my okay at each step):
- Turn on Vercel Web Analytics.
- Write README.md with the standard sections from the root CLAUDE.md, including the sample photos' credit.
- Update the root ../README.md (Day 6 row) and the ../CLAUDE.md "Where we are" table (Day 6 live).
- Ask me before adding Pocket Booth to ../shared-kit/footer/siblings.js and the earlier sites' footers.
- Then hand me the remaining checks from VERIFY.md "Needs a real phone".

Start now: confirm the local server answers at http://localhost:8000, then do M0.
```

---

## What "done" looks like
- See PLAN.md §10 for the full checklist.
- **The short version:** on a real phone, Start the booth → 4 shots → a strip that looks like it came out of a real booth → Send works. The same from 4 camera-roll photos.
- The A4 PDF prints 4 strips at exactly 2×6 in.
- It's live at `the-pocket-booth.vercel.app` with the footer and the address on every output.
