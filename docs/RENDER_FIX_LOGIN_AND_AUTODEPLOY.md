# Fix Render: Login + Auto-Deploy

Steps to fix **Render CLI login** (expired token) and configure **deploy behavior** when you push to GitHub.

> **Current policy (BNI Anchor backend):** Render `autoDeployTrigger` is **off**. GitHub CI (`.github/workflows/ci.yml`) runs tests only and does **not** deploy. Production backend deploys use `./scripts/deploy-render-production.sh` after SRAA gate.

---

## Part 1: Fix Render CLI login (token expired)

### Option A: Re-login (recommended)

1. In a terminal, run:
   ```bash
   render login
   ```
2. Your browser will open. Sign in to Render and approve the CLI.
3. A new token is saved; `render` commands will work again.
4. Verify:
   ```bash
   render whoami
   ```

### Option B: Use API key (scripts / CI)

1. In [Render Dashboard](https://dashboard.render.com) → **Account Settings** (profile icon) → **API Keys**.
2. Create an API key and copy it.
3. Set it when running CLI:
   ```bash
   export RENDER_API_KEY=your_api_key_here
   render services list
   ```
   Or add `RENDER_API_KEY` to your `.env` (do not commit `.env`).

---

## Part 2: Fix auto-deploy (push to GitHub not deploying)

### Step 1: Install / configure Render GitHub App

1. Open: **[github.com/apps/render/installations/new](https://github.com/apps/render/installations/new)**  
   (or: GitHub → Settings → Applications → Render → Configure).
2. Under **Repository access**:
   - Either choose **All repositories**, or  
   - Select **Only select repositories** and add `bni-checkin` (or your repo).
3. Save. Render must have access to the repo to receive push events.

### Step 2: Confirm service is connected to the repo

1. Go to [Render Dashboard](https://dashboard.render.com) → your **backend** service (e.g. `bni-anchor-checkin-backend`).
2. Open **Settings** (left sidebar).
3. In **Build & Deploy**:
   - **Repository** should show your GitHub repo (e.g. `burkaslarry/bni-checkin`).  
   - If it says “Not connected” or wrong repo: click **Connect repository** and pick the correct repo and branch (e.g. `master`).

### Step 3: Turn on auto-deploy and set branch

1. Same service → **Settings** → **Build & Deploy**.
2. Set **Branch** to the branch you push to (e.g. `master`).
3. Set **Auto-Deploy** to **Yes** (deploy on every push to that branch).
4. Save if there’s a Save button.

### Step 4: Push to the correct branch

- Auto-deploy only runs for the branch configured in Step 3.  
- If you use `master`, push with:
  ```bash
  git push origin master
  ```

### Step 5: If it still doesn’t deploy

- **Render Dashboard** → your service → **Events** or **Deploys**: check for errors (e.g. “GitHub webhook failed”).
- **GitHub**: repo → **Settings** → **Webhooks**. You should see a webhook for `render.com`. If it’s missing or shows recent failures, reconnect the repo in Render (Step 2) so the webhook is recreated.
- **Private repo**: Ensure the Render GitHub App has access to this repo (Step 1).

---

## Quick checklist

| Issue | What to do |
|-------|------------|
| CLI says “token is expired” | Run `render login` (or use `RENDER_API_KEY`) |
| Push to GitHub but no deploy | 1) Render GitHub App has repo access 2) Service connected to repo 3) Auto-Deploy = Yes 4) Correct branch |
| Wrong branch deploying | Service Settings → Build & Deploy → set **Branch** to e.g. `master` |

---

## Manual deploy (after fixing login)

Once CLI login works:

```bash
render workspace set          # choose your Render workspace
render services list          # get your backend service ID
render deploys create <service-id> --wait
```

Or trigger a deploy from the Dashboard: service → **Manual Deploy** → **Deploy latest commit**.
