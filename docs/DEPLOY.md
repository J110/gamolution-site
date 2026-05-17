# Deploy gamolution.html to gamolution.com via Cloudflare Pages

## Prerequisites (verify before starting)
- File at `/path/to/gamolution.html` (or wherever the agent has it)
- Cloudflare account with `gamolution.com` already on Cloudflare DNS
- GitHub account
- `gh` CLI authenticated, or willingness to use web UI

## 1. Set up the repo

```bash
mkdir gamolution-site && cd gamolution-site
cp /path/to/gamolution.html index.html
git init -b main
echo "node_modules/" > .gitignore
git add .
git commit -m "Initial Gamolution site"
gh repo create gamolution-site --public --source=. --remote=origin --push
```

If `gh` not available, create the repo manually at github.com and run:
```bash
git remote add origin git@github.com:<USER>/gamolution-site.git
git push -u origin main
```

## 2. Create Cloudflare Pages project

Cloudflare Dashboard → **Workers & Pages** → **Create** → **Pages** → **Connect to Git**.

- Authorize GitHub, select `gamolution-site`
- Project name: `gamolution`
- Production branch: `main`
- Build settings:
  - Framework preset: **None**
  - Build command: *(leave empty)*
  - Build output directory: `/`
- Click **Save and Deploy**

First deploy completes in ~30 seconds. Note the temporary URL (e.g. `gamolution.pages.dev`).

## 3. Attach custom domain

In the Pages project → **Custom domains** → **Set up a custom domain**.

- Enter `gamolution.com` → **Continue** → **Activate domain**
- Repeat for `www.gamolution.com` → **Continue** → **Activate domain**

Cloudflare auto-adds the required CNAME/A records to the `gamolution.com` zone. No manual DNS edits needed since the zone is already on Cloudflare.

## 4. Verify

Wait ~1 minute for SSL provisioning. Then:

```bash
curl -sI https://gamolution.com | head -5
curl -sI https://www.gamolution.com | head -5
```

Both should return `HTTP/2 200`. Open `https://gamolution.com` in a browser — animations should run.

## 5. Recommended Cloudflare zone settings

Zone → `gamolution.com` → **SSL/TLS** → set encryption mode to **Full** (not Flexible).

Zone → **Rules** → **Page Rules** (or **Redirect Rules** in new UI):
- Add: `www.gamolution.com/*` → 301 redirect to `https://gamolution.com/$1` (or reverse, depending on preferred canonical)

Zone → **Speed** → **Optimization**:
- Auto Minify: enable HTML, CSS, JS
- Brotli: on

## 6. Future updates

```bash
cp /path/to/updated/gamolution.html index.html
git add . && git commit -m "Update animation"
git push
```

Cloudflare Pages auto-redeploys on push. Preview deployments are generated for branches other than `main`.

## Notes
- Single-file site, no build step needed
- If splitting into `index.html` + `styles.css` + `script.js` later, no Cloudflare config changes required — just commit and push
- Pages free tier handles unlimited bandwidth on the gamolution.pages.dev and custom domain
