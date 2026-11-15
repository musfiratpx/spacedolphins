# TODOME: things only humans can do

Everything here needs a person: downloading files from NASA's website, making accounts, listening
and judging how the game *feels*, checking facts, recording the demo and submitting.
Claude (or Claude Code) can do everything else. Tick items off as you go.

**Deadline:** Space Apps submissions close **Sun Nov 15, 2026, 11:59 PM local time** and are final.
**Aim to submit by 9:00 PM** to leave time for upload problems.

---

## 🔴 Do first (tonight)

- [ ] **Install Node.js 20 or newer** if you don't have it: https://nodejs.org (LTS).
- [ ] **Run the game once:**
  ```bash
  npm install
  npm run dev
  ```
  Open the link it prints (usually http://localhost:5173). Play one Mars round to the end.
- [ ] **Set up `.env`** (see "API key" below) and run `node scripts/fetch-asteroids.js`.
- [ ] **Commit and push** so `main` always has a working version:
  ```bash
  git add -A
  git commit -m "Phase 1 base demo"
  git push
  ```
- [ ] **Deploy early** (see "Deploy"), so hosting problems show up tonight, not at 11 PM tomorrow.

## 👥 Team decisions (5-minute stand-up)

- [ ] Fill in the **owner for each role** (game lead, 3D/design, content & accuracy, audio & charts,
      data, demo & submission). The outline has the table; put names in `README.md` under "Team".
- [ ] Confirm the **final title** (working title: Hardware Hunters 4052).
- [ ] Confirm **"scan, don't recover"** (CLAUDE.md already assumes scan).
- [ ] Confirm the **age group** (10 to 14).
- [ ] Read the **2026 Space Apps submission guide** for the demo's length limit and format.
      Write it here: `Demo limit: ____`.

## 🔑 API key and `.env`

The game itself needs no secrets. Only the asteroid snapshot script uses a key.

- [ ] Get a free NASA API key at https://api.nasa.gov/ (name + email; the key arrives by email).
- [ ] Copy the template and paste your key in:
  - Windows PowerShell: `Copy-Item .env.example .env`
  - Mac/Linux: `cp .env.example .env`
  - Then edit `.env`: `NASA_API_KEY=your-key-here`
- [ ] Run `node scripts/fetch-asteroids.js` and commit the new `data/asteroids.json`
      (the game reads this snapshot, so judging never depends on the API being up).
- [ ] **Never commit `.env`.** It's already in `.gitignore`. Never rename the key to `VITE_...`
      (that would publish it inside the website).

## 🛰️ Download NASA 3D models (Prompt 3 needs these)

Claude can't reach NASA's website from its workspace, so a person has to download these.

1. Go to **https://science.nasa.gov/3d-resources/** and search the catalog name.
2. Download the **.glb** version.
3. Save it in `assets/models/` with **exactly** the file name below.
4. In `assets/manifest.json`, fill in that model's `"source"` (the exact page URL) and `"credit"`
   (the credit line the page shows).
5. Check the file size. **Anything over ~10 MB:** tell Claude so it can use a lighter substitute.

**Mars first (needed for the demo):**

| Save as | Search for | Done |
|---|---|---|
| `insight.glb` | InSight (make sure it's the **landed** lander, not only the cruise stage) | [ ] |
| `ingenuity.glb` | Ingenuity | [ ] |
| `opportunity.glb` | Mars Exploration Rover Opportunity (MER-B) | [ ] |
| `viking.glb` | Viking Lander | [ ] |

**Then (Moon and Deep space, Phase 2):**

| Save as | Search for | Done |
|---|---|---|
| `apollo-lm.glb` | Apollo Lunar Module | [ ] |
| `apollo17-site.glb` | Apollo 17 Landing Site | [ ] |
| `lro.glb` | Lunar Reconnaissance Orbiter | [ ] |
| `voyager.glb` | Voyager | [ ] |
| `new-horizons.glb` | New Horizons | [ ] |
| `cassini.glb` | Cassini | [ ] |

Blue Ghost has no NASA model; Claude will build an original one later. Collect 2 or 3 NASA photos
of Blue Ghost for reference (photos only; don't use ones credited to another company).

Until a file is there, the card shows a teal wireframe marked "Model placeholder". Nothing breaks.

## 🔊 Download NASA sounds (Prompt 4 needs these)

Save the original downloads in `assets/sounds/nasa/raw/` using these names (keep the original
extension, like `.mp3` or `.wav`). **For each one, copy the page URL and the credit line** into
`assets/manifest.json` (`source`, `credit`) and write one plain sentence about what it is in `what`.
Download from NASA's own pages only, not mirrors.

| Save as | Where to find it | Done |
|---|---|---|
| `marsquake` | NASA's InSight marsquake sonifications | [ ] |
| `ingenuity-hum` | NASA's "Listen to Ingenuity in flight" page (Perseverance microphone; may need extracting from a video) | [ ] |
| `mars-wind` | NASA's Perseverance "sounds of Mars" page | [ ] |
| `atlas-launch` | nasa.gov/historical-sounds: "Atlas V: Launch" | [ ] |
| `voyager-plasma` | nasa.gov/historical-sounds: "Voyager: Interstellar Plasma Sounds" | [ ] |
| `jupiter-lightning` | nasa.gov/historical-sounds: "Voyager: Lightning on Jupiter" | [ ] |
| `saturn-radio` | NASA's Cassini Saturn radio emissions sound | [ ] |
| `kepler-star` | nasa.gov/historical-sounds: Kepler star light-curve sound | [ ] |
| `lcross-moon` | nasa.gov/historical-sounds: "LCROSS: Water on the Moon Song" | [ ] |
| `beeps` | NASA's "beeps and bytes" spacecraft sounds | [ ] |

Rules: no Voyager Golden Record music, no astronaut voice clips that sound like an endorsement,
skip anything credited to a third party (some sonifications name a university partner;
credit whoever the NASA page names).

- [ ] **Install ffmpeg** if you can (https://ffmpeg.org/download.html, or `winget install ffmpeg`
      on Windows). Prompt 4's `scripts/prep-audio.sh` uses it to trim and normalize the sounds.

## ✅ Fact checks (content & accuracy owner + one second person)

Every card fact must match its linked NASA page **before it ships**. Claude can't open NASA's pages
from its workspace, so a person has to check them.

- [ ] Check all 4 Mars cards in `data/hardware.json` against their `source` links.
- [ ] Check every `source` URL actually opens the right NASA page (the outline flags the InSight URL).
- [ ] Check landing-site **coordinates** (all marked `"coordsVerified": false`). Change to `true` once checked.
- [ ] Check the "Status today" lines and set `statusAsOf` to the day you checked.
- [ ] Search the project for `TODO_VERIFY` and either verify each one or remove the claim.
      (VS Code: Ctrl+Shift+F → `TODO_VERIFY`.)
- [ ] Fill in Moon and Deep space card facts (Phase 2), each with a NASA source link.
- [ ] Fact-check the "Real NASA details" polish list in the outline before Claude adds any of them
      (Wright Flyer fabric is already verified for Ingenuity).

## 🎧 Playtesting (needs human ears and hands)

- [ ] Play with the **F2 click track** on (press F2 in a round): do the clicks line up with the music?
      Report anything that feels late or early.
- [ ] If hits feel off, especially with **Bluetooth headphones**, try the **Audio offset** setting
      in the hub (Settings) and note the value that feels right.
- [ ] **Two people who didn't build the chart** play Easy, Normal and Hard. Can a 10-year-old clear Easy?
- [ ] Note which parts of the song sound weak or messy and tell Claude.
- [ ] Try it on a **school-style laptop** and a **phone** (tap lanes). Note any lag.

## 🚀 Deploy (demo & submission owner)

Pick one:

- **GitHub Pages:** push, then in the repo go to Settings → Pages. Easiest: run `npm run build`
  and publish the `dist/` folder (for example with a GitHub Action, or ask Claude to set one up).
- **Netlify:** "Add new site" → import the GitHub repo → Build command `npm run build`,
  Publish directory `dist`.

- [ ] Live link works in a **private/incognito window**.
- [ ] Live link works **on a phone**.
- [ ] Repo is **public**, with `README.md` and `CREDITS.md`.
- [ ] Redeploy after each checkpoint.

## 🎬 Demo and submission (needs a person and your Space Apps login)

- [ ] **Record the demo video** using the script in the outline (about 60 s; trim to the official
      limit). Use headphones or screen capture with system audio so the music is recorded.
- [ ] Fill in the **Project tab** on the team page: summary, how it meets the challenge,
      NASA data used (with links), other resources and licenses, tools used (and AI use if the
      guide asks for it).
- [ ] Upload the demo, add the **live link** and **repo link**, check they work from a phone.
- [ ] **Submit by 9:00 PM, Nov 15.**

## 🤖 What Claude can't do

- Download from NASA's site or any site other than package registries (its workspace blocks them).
- Create accounts or API keys, or log in to Space Apps, GitHub Pages or Netlify for you.
- Hear the game or judge whether timing *feels* right; it needs your playtest notes.
- Confirm facts against live NASA pages, or decide what's true when sources disagree.
- Record the demo video or submit the project.
- Push to GitHub unless you ask it to (and it can only do it once it has access).

## ➡️ Next Claude prompts (from the prompts doc)

Run these one at a time, and play after each:

1. ~~Kickoff: base demo~~ ✅ done
2. Hook and timing check (adds the F2 click track checks; F2 already works)
3. Real models (after you download the `.glb` files above)
4. NASA music system (after you download the sounds above)
5. Core loop (rest of Phase 2)
6. Immersion and polish (Phase 3)
7. Polish checklist
8. Ship (Phase 4)
