# Bespoke Library

A private reading platform for manuscript authors to share their work with a curated audience — built as both a working product and a portfolio demonstration of full-stack engineering on Azure.

Live at [bespoke.nicholasnevins.org](https://bespoke.nicholasnevins.org)

---

## What it does

Authors upload novel manuscripts (`.md` files or `.zip` archives) to a structured library. They control exactly who can read what — granting access at the series, book, or individual draft level. Readers get a clean, distraction-free reading experience that remembers where they left off.

---

## Architecture

### Stack

- **Frontend** — Vanilla JavaScript ES modules, no framework. Azure Static Web Apps hosts and handles AAD authentication.
- **Backend** — Python Azure Functions (v2 programming model)
- **Database** — Azure Cosmos DB for MongoDB API

### Database schema

Five collections, normalised from an original flat design:

| Collection | Purpose |
|---|---|
| `series` | Top-level grouping of manuscripts |
| `manuscripts` | Individual books within a series |
| `drafts` | Versioned drafts of a manuscript |
| `chapters` | Individual chapter documents with content |
| `access` | All permission grants (scope-typed) |
| `users` | User records, created on first login |
| `invites` | Time-limited invite tokens |

### Permission model

Access is granted at three scopes (`series`, `manuscript`, `draft`) with three roles (`owner`, `author`, `reader`). Resolution walks the hierarchy — a series-level grant cascades to all manuscripts and drafts within it. Draft-level grants are reader-only; authorship can only be granted at series or manuscript level.

```
Series owner     → full access to all manuscripts in series
Manuscript owner → full access to that book
Series author    → edit access to all drafts of all books in series
Manuscript author → edit access to all drafts of that book
Series reader    → read all books in series
Manuscript reader → read all drafts of that book
Draft reader     → read that specific draft only
```

All permission checks are enforced on the backend (`permission_service.py`) before any data is returned or written. The frontend makes zero security decisions.

### Invite system

Owners generate time-limited, use-limited invite links from the Author Studio. Links carry a UUID token (`/?invite=<token>`). If the recipient isn't logged in, the token is saved to `sessionStorage`, the user is sent through AAD authentication, and the invite is redeemed automatically on return. Redemptions are atomic — a `find_one_and_update` with a use-count condition prevents race conditions if the same link is clicked simultaneously.

### Author Studio

Authors upload chapters via a drag-and-drop interface. ZIP archives are expanded client-side using JSZip. Files can be reordered by dragging before upload, with editable title fields and word counts per file. Upload progress is tracked via `XMLHttpRequest` (Fetch does not expose upload progress).

### Reading progress

Progress is stored in `localStorage` keyed by `draft_id`, persisting across sessions. Scroll position is saved as a percentage (not pixels) so it survives window resizes. The bookshelf shows a per-draft progress bar and a "Continue Reading" section for the most recently active drafts.

---

## Project structure

```
/
├── api/                        # Azure Functions (Python)
│   ├── function_app.py         # Route registration
│   ├── routes/                 # HTTP handlers (thin layer)
│   ├── services/               # Business logic + permission enforcement
│   ├── repositories/           # Database access (one per collection)
│   └── utils/                  # Auth extraction, response helpers
├── frontend/                   # Static web app
│   ├── core/                   # Router, state management
│   ├── views/                  # Page-level render functions
│   ├── components/             # Reusable UI components
│   ├── services/               # API call wrappers
│   └── utils/                  # groupNovels, markdown renderer
├── migrate.py                  # One-time migration from v1 schema
└── staticwebapp.config.json    # Azure SWA routing + auth config
```

---

## API routes

| Route | Method | Auth | Description |
|---|---|---|---|
| `GetNovels` | GET | Optional | All content visible to the current user |
| `GetChapters` | GET | Optional | Chapter list for a draft |
| `GetChapterContent` | GET | Optional | Single chapter with prev/next IDs |
| `GetAuthoredManuscripts` | GET | Required | Manuscripts where user is owner/author |
| `CreateProject` | POST | Required | Create series + manuscript + draft |
| `GetDrafts` | GET | Required | Drafts for a manuscript (write access) |
| `UploadFiles` | POST | Required | Upload chapters to a draft |
| `CreateInvite` | POST | Required (owner) | Generate an invite link |
| `RedeemInvite` | POST | Required | Redeem an invite token |
| `RevokeInvite` | POST | Required (owner) | Revoke an active invite |
| `ListInvites` | GET | Required (owner) | Active invites for a scope |

---

## Running locally

Azure Static Web Apps can be run locally with the [SWA CLI](https://azure.github.io/static-web-apps-cli/).

```bash
# Install SWA CLI
npm install -g @azure/static-web-apps-cli

# Install Python dependencies
cd api && pip install -r requirements.txt

# Set environment variables
export COSMOS_CONNECTION_STRING="..."
export ADMIN_EMAIL="you@example.com"
export APP_BASE_URL="http://localhost:4280"

# Run
swa start frontend --api-location api
```

The `/.auth/me` endpoint is mocked by the SWA CLI locally, so authentication works without a live Azure tenant.

---

## Migration

If migrating from the original single-collection schema:

```bash
COSMOS_CONNECTION_STRING="..." python migrate.py
```

The script is idempotent and non-destructive — it uses `_migration_old_id` tracking to skip already-migrated documents and does not drop the original `novels` collection. Verify the migration before dropping it manually.

To preview what would be migrated without writing anything:

```bash
DRY_RUN=1 COSMOS_CONNECTION_STRING="..." python migrate.py
```

---

## Key design decisions

**Why Cosmos DB over SQL?** Manuscripts and chapters have a natural document shape — a chapter is always read with its content, never joined to other tables. Cosmos DB's MongoDB API gives document storage with a familiar query interface and horizontal scaling built in.

**Why vanilla JS over React?** The app has three views and minimal shared state. A framework would add build complexity without meaningful benefit. ES modules give clean separation without a bundler.

**Why a separate `access` collection instead of embedding permissions?** Embedded permissions (e.g. an array on each manuscript) require updating every manuscript document when a series-level grant changes. A separate collection means one write for any grant change, regardless of how many manuscripts it affects. It also makes "what can this user see" a single indexed query rather than a full collection scan.
