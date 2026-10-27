# Deployment checklist: Vercel frontend + Render API

This patch is meant to be copied into the existing repository. Keep your current backend/app/main.py and frontend/src files; this patch only adds hosting configuration and adjusts the backend Docker command to use the port assigned by the host.

## 1. Apply the patch

Copy these files into the existing project, replacing `backend/Dockerfile` and `render.yaml`, and adding `frontend/vercel.json`:

- `backend/Dockerfile`
- `render.yaml`
- `frontend/vercel.json`

Commit and push the changes to the public GitHub repo:

```powershell
git add backend/Dockerfile render.yaml frontend/vercel.json
git commit -m "Add deployment configuration for Render and Vercel"
git push
```

## 2. Deploy the API to Render

1. Sign in at https://render.com/.
2. Choose **New + → Blueprint** and select the GitHub repository containing `render.yaml`.
3. Review the service settings and deploy the Blueprint.
4. Wait for deployment to succeed, then open the service URL. It should end in `.onrender.com`.
5. Test `https://YOUR-API.onrender.com/api/health` and confirm it returns JSON with `"status":"ok"`.

If Blueprint is unavailable for the account, create a **Web Service** from the repo and set Runtime = Docker, root directory = `backend`, Dockerfile path = `Dockerfile`, health-check path = `/api/health`.

## 3. Deploy the frontend to Vercel

1. Sign in at https://vercel.com/ and choose **Add New → Project**.
2. Import the same GitHub repository.
3. Set Root Directory to `frontend`.
4. Use build command `npm run build` and output directory `dist` (the `frontend/vercel.json` supplies these defaults).
5. Add environment variable `VITE_API_URL` with the API base URL from Render, for example `https://YOUR-API.onrender.com`. Do not append `/api`.
6. Deploy and copy the Vercel public URL.

## 4. Verify CORS and the live data

The initial Render configuration uses `CORS_ORIGINS=*` for the demo (CORS credentials are disabled in the app). Once the Vercel URL exists, change `CORS_ORIGINS` on Render to the exact frontend origin, such as `https://your-project.vercel.app`, then redeploy the API.

Open these URLs in an incognito window:

- `https://YOUR-API.onrender.com/api/health`
- `https://YOUR-API.onrender.com/api/analysis?start=2026-01-01&end=2026-01-31&cutoff_hour=12`
- `https://YOUR-PROJECT.vercel.app`

The analysis response must contain matched points and non-null metrics before submitting. HTTP 200 alone does not prove the January data is correctly matched. If delivery_periods is 0, fix the Elexon historical query/matching logic rather than inventing numbers.

## Account access note

Actual publication requires signing into Render and Vercel and authorizing access to GitHub. Do not put passwords or access tokens into chat or source files. Deployment URLs are only real after the hosting platform finishes a successful build.
