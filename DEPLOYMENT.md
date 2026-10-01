# Deployment guide

This project deploys the Express API to Render and the Vite client to Vercel. Push the repository to GitHub first so both services can deploy from it.

## Run locally

Node.js 20 or newer is required. Open two terminals in the repository:

```powershell
cd server
npm install
npm start
```

```powershell
cd client
npm install
npm run dev -- --host 127.0.0.1
```

Open `http://127.0.0.1:5173`. When `MONGODB_URI` is not set and `NODE_ENV` is not `production`, the API automatically uses a local JSON data file (`server/.local-data.json`) and a development-only JWT secret. This local data file is ignored by Git. Production continues to require MongoDB and a configured `JWT_SECRET`.

## 1. Create a MongoDB Atlas free cluster

1. Sign in to [MongoDB Atlas](https://www.mongodb.com/atlas/database) and create a project.
2. Create a cluster and choose the **M0 Free** tier. Pick a region near the Render service you plan to use. Atlas documents the current free-cluster flow [here](https://www.mongodb.com/docs/atlas/tutorial/deploy-free-tier-cluster/).
3. Under **Security → Database Access**, create a database user with a strong password. Give it read/write access to the application database (for example, `invoice_generator`). This database user is separate from your Atlas website login.
4. Under **Security → Network Access**, add your current IP temporarily if you want to connect from your computer. Add Render's outbound IP ranges after creating the Render service (step 2); use the ranges shown for that service under **Connect → Outbound**. Atlas accepts IP addresses and CIDR ranges in its access list. See [Render's Atlas connection guide](https://render.com/docs/connect-to-mongodb-atlas).
5. In the cluster's **Connect → Drivers** panel, select Node.js and copy the SRV connection string. Use it as `MONGODB_URI` in Render. It should resemble:

   ```text
   mongodb+srv://<db-user>:<password>@<cluster-host>/invoice_generator?retryWrites=true&w=majority
   ```

   Replace the placeholders and URL-encode any special characters in the username or password. Keep this URI private.

## 2. Deploy `server/` to Render

1. In Render, choose **New → Web Service**, connect the GitHub repository, and select the repository.
2. Set **Root Directory** to `server`, runtime to **Node**, **Build Command** to `npm ci`, and **Start Command** to `npm start`. The `start` script runs `node server.js`. Render's Node/Express deployment flow is documented [here](https://render.com/docs/deploy-node-express-app).
3. Add these environment variables in the service's **Environment** settings:

   | Key | Value |
   | --- | --- |
   | `NODE_ENV` | `production` |
   | `MONGODB_URI` | The Atlas SRV connection string from step 1 |
   | `JWT_SECRET` | A long, randomly generated secret; never commit it |
   | `ALLOWED_ORIGIN` | Your Vercel origin, after step 3 (for example `https://your-app.vercel.app`) |

   Render supplies `PORT`; the app reads it automatically, so do not set it unless you have a specific reason. Keep the `ALLOWED_ORIGIN` value to origins only: no path or trailing slash. Multiple origins can be comma-separated.
4. Deploy the service and note its URL, such as `https://your-invoice-api.onrender.com`. Confirm `https://<your-render-service>/api/health` returns `{"status":"ok"}`.
5. In Atlas **Network Access**, add the outbound IP ranges Render shows for this service. Allowlist only those ranges when possible; avoid `0.0.0.0/0` for a production database.

## 3. Deploy `client/` to Vercel

1. In Vercel, import the same GitHub repository.
2. Set **Root Directory** to `client` and select the Vite framework preset. Use **Build Command** `npm run build` and **Output Directory** `dist` (the Vercel Vite settings are described [here](https://vercel.com/docs/frameworks/frontend/vite)).
3. Add the environment variable `VITE_API_URL` with the Render service's base URL, for example `https://your-invoice-api.onrender.com`. Do not append `/api`; the client requests include their own `/api/...` paths. Set it for Production and for Preview too if preview deployments need to call the API.
4. Deploy and note the Vercel origin, such as `https://your-app.vercel.app`. The checked-in `client/.env.production` is a public placeholder for local production builds; Vercel's environment variable should contain the real API URL. Vite variables prefixed with `VITE_` are included in browser code, so never put secrets in them.
5. `client/vercel.json` rewrites client-side routes to `index.html`, so direct visits and refreshes on routes such as `/invoices/123` resolve through the React app.

## 4. Set the real URLs and CORS allowlist

1. In Vercel, set `VITE_API_URL` to the exact Render origin (`https://<service>.onrender.com`) and redeploy so the new URL is included in the production build.
2. In Render, set `ALLOWED_ORIGIN` to the exact Vercel origin (`https://<project>.vercel.app`). To allow more than one deployed frontend, use a comma-separated list, for example `https://your-app.vercel.app,https://preview.example.com`.
3. Save the Render environment change and redeploy/restart the service. In production, browser origins not listed in `ALLOWED_ORIGIN` are rejected by CORS. In non-production, all origins are allowed only when `ALLOWED_ORIGIN` is empty.
4. Verify the client can sign in and call the API, and check the API health endpoint. If using a custom Vercel domain, add that exact origin to `ALLOWED_ORIGIN` as well.

## Secrets and environment files

Commit `server/.env.example` only as a placeholder reference. Keep real `.env` files out of Git; the repository `.gitignore` excludes `.env` files. The committed `client/.env.production` contains only the public API URL placeholder, not credentials. Store production secrets in Render's environment settings, not in source files or Vercel's `VITE_` variables.

Additional platform references: [Render Node version selection](https://render.com/docs/node-version), [Atlas connection strings](https://www.mongodb.com/docs/atlas/connect-to-database-deployment/), and [Vercel SPA routing](https://vercel.com/kb/guide/why-is-my-deployed-project-giving-404).
