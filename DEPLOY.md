# Deploy Guide — Publishing to GitHub Marketplace + Polar.sh Setup

This guide walks you through publishing **Release Notes AI** to the GitHub Marketplace and wiring up Polar.sh for Pro license sales.

---

## Step 1 — Create the Repo

```bash
cd release-notes-ai
git init
git add .
git commit -m "feat: initial release-notes-ai v1"

# Create a public repo on GitHub (web UI), then:
git remote add origin https://github.com/YOUR_USERNAME/release-notes-ai.git
git branch -M main
git push -u origin main
```

**Important:** Replace every `aura-fyll` in the repo (action.yml, README.md, index.js, src/pro.js, workflow file) with your actual GitHub handle.

```bash
# Bulk replace from the command line
find . -type f -not -path './node_modules/*' -not -path './.git/*' \
  -exec sed -i 's/aura-fyll/ACTUAL_USERNAME/g' {} +
```

---

## Step 2 — Build the `dist/index.js`

GitHub Actions require a single bundled JS file. Use `@vercel/ncc`:

```bash
npm install
npm run build
# This creates dist/index.js — commit it to the repo!
git add dist/
git commit -m "build: bundle dist/index.js"
git push
```

**Critical:** The `dist/` folder MUST be committed (not gitignored). That's what GitHub Actions actually runs.

---

## Step 3 — Tag a Release

GitHub Marketplace requires semver tags:

```bash
git tag -a v1 -m "v1.0.0"
git push origin v1

git tag -a v1.0.0 -m "v1.0.0"
git push origin v1.0.0
```

The `v1` tag is what users reference as `uses: aura-fyll/release-notes-ai@v1`. You can re-point `v1` to newer commits later (e.g. v1.1.0) without breaking users.

---

## Step 4 — Publish to Marketplace

1. Go to your repo on GitHub: `https://github.com/YOUR_USERNAME/release-notes-ai`
2. Click the **"Actions"** tab → you'll see a banner: **"Publish this Action to the GitHub Marketplace"** → click it.
3. Fill in:
   - **Category:** Productivity (or Developer Tools)
   - **Description:** "AI-powered release notes from your commits & PRs. Free tier writes a short summary. Pro tier ($5/mo) adds full structured notes + Slack/Discord/Email/Twitter broadcast."
   - **Logo:** Upload a 200x200 icon (purple feather works, or any free icon maker)
   - **Pricing:** Free (Marketplace doesn't support paid Actions directly — your revenue comes from Polar Pro upsell)
4. Click **Publish**. Live in minutes.

---

## Step 5 — Set Up Polar.sh for Pro Sales (5 minutes)

### 5a. Create the Polar Account & Product

1. Go to https://polar.sh → **Sign in with GitHub** (uses your existing account, no separate auth).
2. Dashboard → **Products** → **New Product**.
3. Fill in:
   - **Name:** Release Notes AI — Pro
   - **Type:** Digital (subscription)
   - **Description:** "Unlock full structured release notes + cross-channel broadcasting for the Release Notes AI GitHub Action."
   - **Pricing:** $5/month (also create a $49/year variant)
   - **License keys:** Enable (Polar generates a unique key per purchase automatically)
4. Save. Copy the **Product ID** from the URL (looks like `uuid-here`) — you'll need this.

### 5b. Polar Checkout Link

The repo is already wired to use this checkout URL (baked into `index.js`, `README.md`, `src/pro.js`):

```
https://buy.polar.sh/polar_cl_2CwVdscDS617r0hrWzCPxwgfOnTyV4XxcTh270BHVA9
```

If Polar generates a different checkout URL for your product (sometimes they use a slug-based form like `https://polar.sh/aura-fyll/products/release-notes-ai-pro`), replace the URL across the repo:

```bash
find . -type f \( -name '*.md' -o -name '*.js' -o -name '*.yml' \) \
  -not -path './node_modules/*' -not -path './dist/*' -not -path './.git/*' \
  -exec sed -i 's|https://buy.polar.sh/polar_cl_2CwVdscDS617r0hrWzCPxwgfOnTyV4XxcTh270BHVA9|YOUR_REAL_POLAR_LINK|g' {} +
npm run build  # rebuild dist/
git add -A && git commit -m "chore: update Polar checkout URL"
```

### 5c. Configure the License Validation

The Action validates each Pro license key against Polar's API at runtime. To enable:

- **Option A (simpler, recommended for v1):** Hardcode your Polar Product ID in `src/pro.js`:
  ```js
  const POLAR_PRODUCT_ID = 'your-real-product-id-here';
  ```
  Rebuild `dist/` (`npm run build`) and commit.

- **Option B (more flexible):** Keep using the env var pattern. Users set `POLAR_PRODUCT_ID` themselves — but this requires publishing the ID, which means anyone can validate keys for any product. Option A is safer.

### 5d. Customize the Polar Thank-You Page

In Polar dashboard → Product → **Post-purchase page** → set the message to:

> "Thanks for buying Pro! Copy your license key, then follow setup at: https://github.com/YOUR_USERNAME/release-notes-ai#upgrade-to-pro"

---

## Step 6 — Set Up Composio (Free dev account)

1. Sign up at https://composio.dev — free tier gives you 1,000 actions/month (enough for ~50 Pro customers).
2. Get your **API Key** from the dashboard.
3. Create an **Embedded Auth Flow** for Slack + Discord (Composio walks you through this).
4. Each user connects their Slack/Discord via the Composio-hosted OAuth page → they get a `connected_account_id` to paste as a repo secret.

---

## Step 7 — Market It (Free Channels)

- **Reddit:** r/github, r/programming, r/webdev, r/opensource — genuine "Show & Tell" post (no spam).
- **Hacker News:** "Show HN: Release Notes AI — automatic release notes from your commits"
- **dev.to:** Tutorial "How I automated my release notes with a GitHub Action"
- **Twitter/X:** 30-sec Loom demo + thread
- **GitHub:** Add to `awesome-github-actions` via PR
- **IndieHackers:** Post in "Products" + write a "Building in Public" post
- **Discord/Slack communities:** Dev guilds, OSS maintainers' channels — share once, politely

---

## Step 8 — First $100 Milestone

Realistic math with nerfed free tier (5% conversion at $5/mo):

- 1 Pro user → $5
- ~20 free users → 1 Pro user
- 100 free users → ~5 Pro users → $25/mo
- 400 free users → ~20 Pro users → $100/mo ✅

Time to 400 free users with consistent marketing: ~60–90 days.

---

## Common Pitfalls

- ❌ **Forgot to commit `dist/`** → Action fails with "Cannot find module"
- ❌ **Tagged as `1.0.0` instead of `v1.0.0`** → Marketplace rejects (must start with `v`)
- ❌ **Repo is private** → Marketplace only accepts public repos
- ❌ **`action.yml` not in repo root** → Marketplace can't find it
- ❌ **Didn't replace `aura-fyll`** → Workflow file references a nonexistent user
- ❌ **Forgot to set `POLAR_PRODUCT_ID`** → License validation always returns false → no one can use Pro

---

## Next Iterations (v1.1+)

- Custom section templates (let users define their own categories) — Pro feature
- Multi-language release notes in one go — Pro feature
- Custom LLM prompts per repo — Pro feature
- Slack bot for interactive setup — Pro feature
- GitHub App version (no workflow file needed — install once, works on all repos) — Pro+ tier at $29/mo

Ship v1 first. Iterate based on real user feedback.
