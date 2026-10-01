# Invoice Generator — MERN Stack Build Plan (Phase-Wise)

**Project:** Freelancer Invoice Generator
**Stack:** MongoDB, Express, React (Vite), Node.js
**Core idea:** Freelancers create clients, create invoices for those clients, track tax/totals, mark invoices paid/unpaid/overdue, and download invoices as PDF.

How to use this document: work through the phases **in order**. Each phase has a Goal, Tasks, Deliverables, and a ready-to-use **Prompt for AI** block — copy that block into your AI coding assistant (Claude Code, Cursor, etc.) as-is, phase by phase. Don't skip ahead — later prompts assume earlier phases exist.

---

## Phase 0 — Planning & Environment Setup

**Goal:** Lock the data model and get the dev environment ready before writing code.

**Tasks:**
- Decide final schema fields (see below)
- Create MongoDB Atlas free cluster + get connection string
- Create GitHub repo with `server/` and `client/` folders
- Install Node.js, create `.env` files (never commit them)

**Data model (lock this before Phase 1):**
- **User:** name, email (unique), password (hashed), businessName, createdAt
- **Client:** name, email, phone, address, user (owner ref), createdAt
- **Invoice:** invoiceNumber, client (ref), user (owner ref), items[{description, quantity, rate, amount}], subtotal, taxRate, taxAmount, total, status (`draft` / `sent` / `paid` / `overdue`), issueDate, dueDate, notes, createdAt

**Deliverables:** Atlas cluster URL, repo scaffolded with empty `server/` and `client/` folders, `.gitignore` in place.

**Prompt for AI:**
```
I'm building a MERN stack Invoice Generator app for freelancers.
Scaffold the base project structure only (no logic yet):

- Root folder with /server and /client subfolders
- /server: package.json with express, mongoose, bcryptjs, jsonwebtoken,
  dotenv, cors, express-validator installed; folder structure:
  server/models, server/controllers, server/routes, server/middleware,
  server/config
- /server/config/db.js: mongoose connection function reading MONGODB_URI
  from .env
- /server/.env.example with MONGODB_URI, JWT_SECRET, PORT placeholders
- /server/server.js: basic Express app with cors, express.json(),
  a health check route GET /api/health, and app.listen using PORT from .env
- /client: create a Vite + React app, install react-router-dom, axios
- Add a root .gitignore excluding node_modules and .env

Do not add any models, routes, or auth logic yet — this phase is just
project scaffolding.
```

---

## Phase 1 — Backend: Mongoose Models

**Goal:** Define User, Client, and Invoice schemas exactly as locked in Phase 0.

**Tasks:**
- Create `User.js`, `Client.js`, `Invoice.js` models
- Add validation at schema level (required fields, enums for status)
- Add `pre('save')` hook on User to hash password with bcrypt

**Deliverables:** Three Mongoose models in `server/models/`.

**Prompt for AI:**
```
In my existing server/models folder, create three Mongoose models:

1. User.js
   - name (String, required)
   - email (String, required, unique, lowercase)
   - password (String, required, min 6 chars)
   - businessName (String, optional)
   - timestamps: true
   - Add a pre('save') hook that hashes password with bcryptjs
     (only if password is modified)
   - Add an instance method comparePassword(candidatePassword) that
     returns a boolean using bcrypt.compare

2. Client.js
   - name (String, required)
   - email (String, required)
   - phone (String)
   - address (String)
   - user (ObjectId ref 'User', required) — the owner
   - timestamps: true

3. Invoice.js
   - invoiceNumber (String, required, unique per user)
   - client (ObjectId ref 'Client', required)
   - user (ObjectId ref 'User', required)
   - items: array of { description: String, quantity: Number,
     rate: Number, amount: Number }
   - subtotal (Number, required)
   - taxRate (Number, default 0)   // percentage e.g. 18
   - taxAmount (Number, default 0)
   - total (Number, required)
   - status (String, enum ['draft','sent','paid','overdue'], default 'draft')
   - issueDate (Date, default now)
   - dueDate (Date, required)
   - notes (String)
   - timestamps: true

Export all three models correctly using mongoose.model().
```

---

## Phase 2 — Backend: Auth APIs

**Goal:** Register, Login, Get current user — with JWT and bcrypt.

**APIs:**
| Method | Route | Auth |
|---|---|---|
| POST | /api/auth/register | Public |
| POST | /api/auth/login | Public |
| GET | /api/auth/me | Private |

**Tasks:**
- `authController.js`: register, login, getMe
- `authMiddleware.js`: verify JWT from `Authorization: Bearer <token>`, attach `req.user`
- `authRoutes.js`
- Input validation with express-validator
- Proper status codes: 201 on register, 200 on login/me, 400 on bad input, 401 on bad credentials/no token, 404 where relevant

**Prompt for AI:**
```
Using my existing server/models/User.js, build the full auth flow:

1. server/middleware/authMiddleware.js
   - Reads "Authorization: Bearer <token>" header
   - Verifies JWT using JWT_SECRET from .env
   - On success, attaches decoded { id } as req.user and calls next()
   - On missing/invalid token, respond 401 with { message }

2. server/controllers/authController.js with:
   - register(req, res): validates name/email/password, checks for
     existing email (400 if duplicate), creates user, returns 201 with
     { user: {id,name,email}, token }
   - login(req, res): validates input, finds user by email, compares
     password with comparePassword, returns 401 on mismatch, otherwise
     200 with { user, token }
   - getMe(req, res): protected, returns 200 with logged-in user's own
     data (no password field), 404 if somehow not found

3. server/routes/authRoutes.js
   - POST /api/auth/register -> register (with express-validator checks:
     name required, valid email, password min 6 chars; 400 with error
     array on failure)
   - POST /api/auth/login -> login
   - GET /api/auth/me -> authMiddleware, then getMe

4. Wire authRoutes into server.js at /api/auth

5. JWT: sign with { id: user._id }, expiresIn '7d', secret from
   process.env.JWT_SECRET

Return clean JSON error shapes like { message: "..." } consistently.
```

**✅ Test in Postman before moving on:** register a user, login, call `/me` with the returned token.

---

## Phase 3 — Backend: Client APIs (Supporting Resource)

**Goal:** Full CRUD for Clients, scoped to the logged-in user only.

**APIs:**
| Method | Route | Auth |
|---|---|---|
| POST | /api/clients | Private |
| GET | /api/clients | Private (paginated) |
| GET | /api/clients/:id | Private |
| PUT | /api/clients/:id | Private |
| DELETE | /api/clients/:id | Private |

**Prompt for AI:**
```
Using my existing Client model and authMiddleware, build full CRUD for
clients, scoped strictly to req.user (a user must never see or modify
another user's clients):

server/controllers/clientController.js:
- createClient: validate name+email required, set user: req.user.id,
  return 201
- getClients: return only clients where user = req.user.id, support
  query params ?page=&limit= (default page=1, limit=10), return
  { data, total, page, pages }
- getClientById: 404 if not found OR not owned by req.user, else 200
- updateClient: 404 if not found/not owned, else update and return 200
- deleteClient: 404 if not found/not owned, else delete and return 200
  with a success message

server/routes/clientRoutes.js:
- All routes go through authMiddleware first
- POST /api/clients
- GET /api/clients
- GET /api/clients/:id
- PUT /api/clients/:id
- DELETE /api/clients/:id

Wire into server.js at /api/clients. Use proper status codes throughout
(200, 201, 400, 401, 404).
```

**✅ Test in Postman:** create 2-3 clients, list with pagination, try accessing another user's client (should 404).

---

## Phase 4 — Backend: Invoice APIs (Main Resource) + Tax Logic

**Goal:** Full CRUD for Invoices with server-side total/tax calculation — never trust client-sent totals.

**APIs:**
| Method | Route | Auth |
|---|---|---|
| POST | /api/invoices | Private |
| GET | /api/invoices | Private (paginated) |
| GET | /api/invoices/:id | Private |
| PUT | /api/invoices/:id | Private |
| DELETE | /api/invoices/:id | Private |

**Prompt for AI:**
`

**✅ Test in Postman:** create an invoice with 2-3 line items and a taxRate, confirm subtotal/tax/total are computed correctly on the server.

---

## Phase 5 — Backend: Special APIs

**Goal:** The "extra" endpoints that make the app actually useful: status change, search, stats.

**APIs:**
| Method | Route | Purpose |
|---|---|---|
| PATCH | /api/invoices/:id/status | Mark paid / sent / overdue / draft |
| GET | /api/invoices/search?q= | Search by invoice number or client name |
| GET | /api/invoices/stats | Totals: paid, unpaid, overdue, revenue this month |
| GET | /api/clients/:id/invoices | All invoices for one client |

**Prompt for AI:**
```
Add these additional endpoints to my existing invoice/client APIs
(all behind authMidd``
Using my existing Invoice and Client models and authMiddleware, build
full CRUD for invoices scoped to req.user:

server/controllers/invoiceController.js:

- createInvoice:
  - Validate client id belongs to req.user (404 if not)
  - Validate items array (description, quantity>0, rate>=0)
  - Calculate server-side (ignore any subtotal/total sent by client):
      amount per item = quantity * rate
      subtotal = sum of item amounts
      taxAmount = subtotal * (taxRate / 100)
      total = subtotal + taxAmount
  - Auto-generate invoiceNumber if not provided, e.g. INV-<timestamp>
    or an incrementing per-user number
  - status defaults to 'draft'
  - Set user: req.user.id
  - Return 201 with the created invoice

- getInvoices:
  - Only invoices where user = req.user.id
  - Support pagination (?page=&limit=)
  - Support filtering by ?status=paid|sent|overdue|draft
  - Support ?client=<clientId> filter
  - Populate client name/email in response
  - Return { data, total, page, pages }

- getInvoiceById: 404 if not found/not owned, else populate client, 200

- updateInvoice:
  - 404 if not found/not owned
  - If items or taxRate change, RECALCULATE subtotal/taxAmount/total
    server-side again (never trust incoming totals)
  - Return 200 with updated invoice

- deleteInvoice: 404 if not found/not owned, else delete, 200

server/routes/invoiceRoutes.js — all routes behind authMiddleware:
POST/GET /api/invoices, GET/PUT/DELETE /api/invoices/:id

Wire into server.js at /api/invoices.
```leware, all scoped to req.user):

1. PATCH /api/invoices/:id/status
   - Body: { status: 'draft'|'sent'|'paid'|'overdue' }
   - Validate status is one of the allowed enum values (400 if not)
   - 404 if invoice not found/not owned
   - Update and return 200 with updated invoice

2. GET /api/invoices/search?q=<text>
   - Search invoices belonging to req.user where invoiceNumber matches
     q (case-insensitive) OR the populated client's name matches q
   - Return paginated results in the same { data, total, page, pages }
     shape as the list endpoint

3. GET /api/invoices/stats
   - For req.user only, return:
     {
       totalInvoices, totalRevenue (sum of total where status='paid'),
       totalOutstanding (sum of total where status in ['sent','overdue']),
       paidCount, unpaidCount, overdueCount,
       thisMonthRevenue (paid invoices with issueDate in current month)
     }
   - Use MongoDB aggregation ($match, $group) for efficiency

4. GET /api/clients/:id/invoices
   - 404 if client not found/not owned by req.user
   - Return all invoices for that client (paginated), for req.user only

Register these routes correctly, being careful about Express route
ordering (e.g. /api/invoices/stats and /api/invoices/search must be
defined BEFORE /api/invoices/:id so they aren't shadowed by the
:id param route).
```

**✅ Test in Postman:** mark an invoice paid, search by partial invoice number, hit `/stats` and confirm numbers match your test data.

---

## Phase 6 — Backend: PDF Generation

**Goal:** Generate a downloadable PDF for any invoice.

**API:**
| Method | Route | Purpose |
|---|---|---|
| GET | /api/invoices/:id/pdf | Stream/download invoice as PDF |

**Prompt for AI:**
```
Add PDF generation to my invoice API using the "pdfkit" npm package
(install it in server/).

GET /api/invoices/:id/pdf (behind authMiddleware):
- 404 if invoice not found or not owned by req.user
- Populate client details
- Generate a clean, professional PDF with:
  - Business name/header (from the logged-in user's businessName)
  - Invoice number, issue date, due date, status
  - "Bill To" section with client name/email/address
  - A table of line items: description, quantity, rate, amount
  - Subtotal, Tax (rate% and amount), Total — clearly separated
  - Notes section if present
- Set response headers so the browser downloads it as
  "invoice-<invoiceNumber>.pdf" (Content-Type: application/pdf,
  Content-Disposition: attachment)
- Stream the PDF directly to the response, don't save to disk

Keep the layout simple and readable — this doesn't need to be fancy,
just correctly laid out and legible.
```

**✅ Test in Postman:** hit the endpoint, confirm Postman offers to save/preview a valid PDF.

---

## Phase 7 — Full Postman Regression Pass

**Goal:** Before touching any frontend code, verify every single API works end-to-end.

**Checklist to run manually or via a Postman collection:**
- [ ] Register duplicate email → 400
- [ ] Login wrong password → 401
- [ ] Access any private route with no token → 401
- [ ] Access any private route with expired/invalid token → 401
- [ ] Create client with missing fields → 400
- [ ] Create invoice referencing another user's client → 404
- [ ] List invoices with pagination params → correct page/limit
- [ ] Filter invoices by status → correct subset
- [ ] Update invoice items → totals recalculated correctly
- [ ] PATCH status to 'paid' → reflected in `/stats`
- [ ] Delete client that has invoices → decide & confirm your intended behavior (block delete, or cascade — document your choice)
- [ ] Download PDF → valid file

**Prompt for AI:**
```
Generate a Postman collection (as a JSON file I can import) covering
every endpoint we've built so far:
- Auth: register, login, me
- Clients: create, list (with pagination), get by id, update, delete
- Invoices: create, list (with pagination/filter), get by id, update,
  delete, status change, search, stats, pdf download
- Client's invoices sub-resource

Use {{baseUrl}} and {{token}} as collection variables. Include example
request bodies for POST/PUT requests. Add a short test script on the
login request that automatically sets the {{token}} variable from the
response for use in subsequent requests.
```

---

## Phase 8 — Frontend: Project Setup, Routing, State, API layer

**Goal:** Scaffold the React app shell before building real pages.

**Tasks:**
- React Router routes (public + protected)
- Axios instance with base URL + interceptor to attach JWT
- Auth Context (or Redux Toolkit) for logged-in user + token
- Protected route wrapper

**Prompt for AI:**
```
In my existing client/ (Vite + React + react-router-dom + axios),
set up the app shell:

1. client/src/services/api.js
   - axios instance with baseURL from import.meta.env.VITE_API_URL
   - request interceptor: if a token exists in localStorage, attach
     "Authorization: Bearer <token>" header
   - response interceptor: on 401, clear stored auth and redirect to /login

2. client/src/context/AuthContext.jsx
   - React Context + provider storing { user, token, loading }
   - login(email,password), register(name,email,password), logout()
     functions that call the auth API and update state + localStorage
   - On app load, if a token exists, call GET /api/auth/me to restore
     the session

3. client/src/components/ProtectedRoute.jsx
   - Redirects to /login if no authenticated user, else renders children

4. client/src/App.jsx with react-router-dom routes:
   - /login, /register (public)
   - /dashboard, /clients, /clients/:id, /invoices, /invoices/:id,
     /invoices/new (all wrapped in ProtectedRoute)
   - Wrap the whole app in AuthProvider

5. Set up plain CSS or Tailwind (your choice, but be consistent) with
   a basic layout: sidebar/topbar nav shown only when logged in.

Don't build the actual page contents yet — stub each page with just a
heading, e.g. <h1>Dashboard</h1>. Focus purely on routing/auth
plumbing working correctly.
```

---

## Phase 9 — Frontend: Auth Pages

**Goal:** Working Register and Login pages wired to AuthContext.

**Prompt for AI:**
```
Build the real Register and Login pages using my existing AuthContext:

client/src/pages/Register.jsx
- Form: name, email, password, businessName (optional)
- Client-side validation (required fields, basic email format,
  password min 6 chars) with inline error messages
- On submit, call context register(); on success redirect to /dashboard;
  on failure show the server's error message
- Loading state on the submit button

client/src/pages/Login.jsx
- Form: email, password
- Same validation/error/loading pattern as above
- On success redirect to /dashboard
- Link to Register page

Style both forms cleanly and consistently with the rest of the app
(centered card layout, clear error states).
```

---

## Phase 10 — Frontend: Clients Pages

**Goal:** Full client management UI.

**Prompt for AI:**
```
Build the Clients section of the app using my existing api.js:

client/src/pages/Clients.jsx
- Fetch and display paginated list of clients (table or card list):
  name, email, phone
- "Add Client" button opens a form (modal or separate route) to create
  a client
- Edit and Delete actions per row, with a confirm step before delete
- Pagination controls (prev/next, page indicator)
- Empty state when no clients exist yet
- Loading and error states

client/src/pages/ClientDetail.jsx
- Shows full client info
- Lists that client's invoices (using GET /api/clients/:id/invoices)
- "New Invoice for this client" button linking to /invoices/new
  pre-filled with this client

client/src/components/ClientForm.jsx
- Reusable form component for both create and edit, with validation
  matching the backend rules
```

---

## Phase 11 — Frontend: Invoices Pages (Core Feature)

**Goal:** The main workflow — create, view, edit invoices with live tax/total calculation.

**Prompt for AI:**
```
Build the Invoices section — this is the core of the app:

client/src/pages/Invoices.jsx
- Paginated list of invoices: invoice number, client name, total,
  status (colored badge), due date
- Filter controls: by status, and a search box (debounced) hitting
  GET /api/invoices/search
- Quick status-change control per row (dropdown calling the PATCH
  status endpoint) without navigating away
- Pagination controls
- "New Invoice" button

client/src/pages/InvoiceForm.jsx (used for both create and edit)
- Client dropdown (fetched from /api/clients)
- Dynamic line items: add/remove rows, each with description,
  quantity, rate — auto-calculate amount = quantity*rate LIVE in the UI
- Tax rate input — live-calculate subtotal, taxAmount, total in the UI
  as the user types (for instant feedback), but remember the backend
  is the source of truth and will recalculate on save
- Due date picker, notes field
- On submit, POST (create) or PUT (edit) to the invoice API
- Show validation errors from the backend inline

client/src/pages/InvoiceDetail.jsx
- Read-only formatted view of one invoice: client info, line items
  table, subtotal/tax/total, status
- "Download PDF" button that hits GET /api/invoices/:id/pdf and
  triggers a browser download (handle the blob response correctly)
- "Edit" and "Delete" actions
- "Mark as Paid" quick action

Make sure every fetch is scoped correctly (the backend already
enforces per-user ownership, but handle 404s gracefully in the UI,
e.g. redirect to /invoices with a "not found" message).
```

---

## Phase 12 — Frontend: Dashboard / Stats

**Goal:** Landing page after login showing a useful overview.

**Prompt for AI:**
```
Build client/src/pages/Dashboard.jsx using GET /api/invoices/stats:

- Summary cards: Total Revenue (paid), Outstanding Amount, Paid Count,
  Overdue Count, This Month's Revenue
- A simple recent-invoices list (last 5, most recent first) with
  status badges, each linking to its detail page
- If there are overdue invoices, show a small warning banner listing
  how many are overdue
- Handle loading and empty states (new users with no data yet)

Keep it visually clear and scannable — this is the first thing a user
sees after logging in.
```

---

## Phase 13 — Polish Pass

**Goal:** Tighten UX and catch edge cases before deploying.

**Checklist:**
- [ ] All forms show clear validation errors (frontend + backend messages)
- [ ] All async actions show loading states (buttons disabled while submitting)
- [ ] All list pages handle empty state (no clients / no invoices yet)
- [ ] 401 anywhere → auto-logout and redirect to /login
- [ ] Currency formatting consistent everywhere (e.g. Intl.NumberFormat)
- [ ] Dates formatted consistently
- [ ] Responsive on mobile (at least usable, not broken)
- [ ] No console errors/warnings

**Prompt for AI:**
```
Do a polish pass over the whole client/ app:
- Add a reusable Loading spinner component and Empty state component,
  use them consistently across Clients, Invoices, Dashboard
- Add a global toast/notification system for success and error messages
  (e.g. "Client created", "Invoice marked as paid", API error messages)
- Format all currency values with Intl.NumberFormat and all dates with
  a consistent short date format
- Verify every protected page redirects to /login if the session is
  invalid/expired
- Do a pass for basic responsiveness on mobile widths
- Fix any console warnings/errors you find
```

---

## Phase 14 — Deployment

**Goal:** Ship it, all on free tiers.

**Tasks:**
1. **MongoDB Atlas** — create free (M0) cluster, whitelist `0.0.0.0/0` (or Render's IPs), get connection string, put in Render env vars.
2. **Render (API)** — new Web Service from your GitHub repo's `server/` folder, set build command `npm install`, start command `npm start`, add env vars `MONGODB_URI`, `JWT_SECRET`, `PORT`.
3. **Vercel/Netlify (React)** — new project from `client/` folder, build command `npm run build`, output `dist`, set `VITE_API_URL` to your Render API URL.
4. Update CORS on the backend to allow your deployed frontend's origin (not `*` in production).
5. Do one full smoke test on the live URLs: register → login → create client → create invoice → mark paid → download PDF.

**Prompt for AI:**
```
Help me prepare my MERN app for deployment:

1. Review server/server.js and update the CORS configuration to only
   allow origins from an ALLOWED_ORIGIN env var (comma-separated list
   supported), falling back to allowing all origins only in development
   (NODE_ENV !== 'production')

2. Add a "start" script to server/package.json (node server.js) and
   confirm engines.node is set appropriately for Render

3. Create client/.env.production with VITE_API_URL pointing to a
   placeholder Render URL, and confirm client/src/services/api.js
   correctly reads import.meta.env.VITE_API_URL in production builds

4. Write a short DEPLOYMENT.md in the repo root with exact step-by-step
   instructions for:
   - MongoDB Atlas free cluster setup
   - Deploying server/ to Render (env vars needed, build/start commands)
   - Deploying client/ to Vercel (env vars needed, build command,
     output directory)
   - How to update CORS/env vars after getting the real deployed URLs

Double-check nothing in .env is hardcoded anywhere in the committed code.
```

---

## Reference: Full API List

| Group | Method | Route | Auth |
|---|---|---|---|
| Auth | POST | /api/auth/register | Public |
| Auth | POST | /api/auth/login | Public |
| Auth | GET | /api/auth/me | Private |
| Clients | POST | /api/clients | Private |
| Clients | GET | /api/clients | Private |
| Clients | GET | /api/clients/:id | Private |
| Clients | PUT | /api/clients/:id | Private |
| Clients | DELETE | /api/clients/:id | Private |
| Clients | GET | /api/clients/:id/invoices | Private |
| Invoices | POST | /api/invoices | Private |
| Invoices | GET | /api/invoices | Private |
| Invoices | GET | /api/invoices/:id | Private |
| Invoices | PUT | /api/invoices/:id | Private |
| Invoices | DELETE | /api/invoices/:id | Private |
| Invoices | PATCH | /api/invoices/:id/status | Private |
| Invoices | GET | /api/invoices/search | Private |
| Invoices | GET | /api/invoices/stats | Private |
| Invoices | GET | /api/invoices/:id/pdf | Private |

**Total: 18 endpoints** — 3 auth, 5 client CRUD (+1 sub-resource), 5 invoice CRUD, 4 special.

---

## Notes on order

Don't reorder these phases. Auth must exist before Clients (Client needs `user` ref). Clients must exist before Invoices (Invoice needs `client` ref). Backend must be fully tested in Postman (Phase 7) before any frontend work starts — debugging tax/total math is far easier in Postman than through a UI.