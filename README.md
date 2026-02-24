# Bespoke Library  
**Cloud-native manuscript platform with secure access control (Azure)**

Live: https://bespoke.nicholasnevins.org  

---

## Overview

Bespoke Library is a full-stack Azure application that enables authors to securely distribute unpublished manuscripts to a controlled audience.

It is deployed as a **dedicated Azure Static Web App (SWA)** under a subdomain of a separate React-based portfolio site, demonstrating separation of concerns across independently deployed systems.

The system is designed around a core challenge:

> How do you share sensitive content while maintaining strict control over access, versioning, and user experience?

This project demonstrates:
- Cloud architecture on Azure (serverless + managed services)
- Backend-enforced authorization and data integrity
- Scalable NoSQL data modeling
- Maintainable, layered system design

---

## Architecture

```
                          ┌────────────────────────────┐
                          │  React Portfolio (Main)    │
                          │  nicholasnevins.org        │
                          └────────────┬───────────────┘
                                       │
                                       │ Subdomain Routing
                                       ▼
                    ┌──────────────────────────────────────┐
                    │ Azure Static Web App (Frontend)      │
                    │ bespoke.nicholasnevins.org           │
                    │                                      │
                    │ - Vanilla JS (ES Modules)            │
                    │ - AAD Auth via /.auth/me             │
                    └────────────┬─────────────────────────┘
                                 │
                                 │ Authenticated API Calls
                                 ▼
                    ┌──────────────────────────────────────┐
                    │ Azure Functions (Python - v2)        │
                    │ Serverless API Layer                 │
                    │                                      │
                    │ Routes → Services → Repositories     │
                    │                                      │
                    │ - Permission enforcement             │
                    │ - Invite redemption logic            │
                    │ - Business rules                     │
                    └────────────┬─────────────────────────┘
                                 │
                                 │ Queries / Writes
                                 ▼
                    ┌──────────────────────────────────────┐
                    │ Azure Cosmos DB (MongoDB API)        │
                    │                                      │
                    │ Collections:                         │
                    │ - series                             │
                    │ - manuscripts                        │
                    │ - drafts                             │
                    │ - chapters                           │
                    │ - access                             │
                    │ - users                              │
                    │ - invites                            │
                    └──────────────────────────────────────┘
```

---

## Key Engineering Highlights

### Backend-enforced access control

- Hierarchical permissions: `series → manuscript → draft`  
- Roles: `owner`, `author`, `reader`  
- Cascading resolution across hierarchy  

All authorization is enforced server-side in `api/services/permission_service.py`.

The frontend makes **zero security decisions**, enforcing a proper trust boundary.

---

### Atomic invite system (race-condition safe)

- Token-based (`UUID`)
- Time-limited and use-limited
- Atomic redemption via `find_one_and_update`

Prevents:
- Duplicate redemptions  
- Concurrency issues under simultaneous access  

---

### Layered backend architecture

```
Routes → Services → Repositories → Database
```

- **Routes**: thin HTTP handlers  
- **Services**: business logic + permission enforcement  
- **Repositories**: isolated database access  

Promotes maintainability, testability, and clear separation of concerns.

---

### Data modeling (Cosmos DB)

Collections:

- `series`
- `manuscripts`
- `drafts`
- `chapters`
- `access`
- `users`
- `invites`

Key design decisions:
- Separate `access` collection enables **constant-time permission updates**  
- Avoids document fan-out when permissions change  
- Optimized for efficient “what can this user access?” queries  

---

### Frontend design decisions

- Vanilla JavaScript (ES modules, no framework)  
- Chosen to minimize complexity for a small, focused application  
- Client-side ZIP parsing (JSZip) reduces backend load  
- Upload progress handled via `XMLHttpRequest` (Fetch limitation workaround)  
- Reading progress stored as percentages for resolution-independent persistence  

---

## Tech Stack

- **Frontend**: Vanilla JavaScript (ES Modules)  
- **Backend**: Python Azure Functions (v2 programming model)  
- **Database**: Azure Cosmos DB (MongoDB API)  
- **Hosting/Auth**: Azure Static Web Apps (AAD authentication)  

---

## Running Locally

```bash
npm install -g @azure/static-web-apps-cli

cd api
pip install -r requirements.txt

export COSMOS_CONNECTION_STRING="..."
export ADMIN_EMAIL="you@example.com"
export APP_BASE_URL="http://localhost:4280"

swa start frontend --api-location api
```

---

## Migration

```bash
COSMOS_CONNECTION_STRING="..." python migrate.py
```

- Idempotent  
- Non-destructive  
- Supports dry-run with `DRY_RUN=1`  

---

## What I’d Improve Next

- Add Azure Monitor + Application Insights for observability  
- Introduce infrastructure-as-code (Bicep or Terraform)  
- Implement rate limiting and abuse protection  
- Expand integration test coverage (especially permission edge cases)  

---

## Why This Project Matters

This project demonstrates the ability to:

- Design secure, backend-driven access control systems  
- Build and structure cloud-native applications on Azure  
- Make practical tradeoffs in NoSQL data modeling  
- Think beyond features into reliability, scalability, and maintainability  
