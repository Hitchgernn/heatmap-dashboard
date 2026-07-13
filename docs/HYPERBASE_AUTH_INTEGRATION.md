# Hyperbase Authentication Integration Guide

This document details the authentication flows within the Hyperbase ecosystem and how the Borobudur Heatmap Dashboard backend must integrate with it. It serves as a technical specification and implementation guide for Claude Code.

---

## Hyperbase Authentication Overview

Hyperbase provides a fully built-in authentication system. The Borobudur dashboard **must not** connect directly to ScyllaDB for authentication. Instead, it must proxy all database access through the Hyperbase REST API using project tokens.

### Authentication State & Support
- **Already Implemented:** Yes. Hyperbase inherently supports authentication for both Administrative users (system configuration) and Application users (visitors/consumers of the API).
- **Supported Methods:**
  - Password-based: `/api/rest/auth/password-based` (Admin only)
  - Token-based: `/api/rest/auth/token-based` (Application Users via Project Tokens)
  - MQTT Auth: Native MQTT authentication/authorization routes.
- **User Lifecycle:**
  - Users are stored as standard records in a specific collection (e.g., `records_users`).
  - To enable authentication on a collection, certain fields must have `auth_column: true` (e.g., email) and `hashed: true` (e.g., password) in the collection schema.
- **Password Hashing:** Uses `Argon2id` (implemented in `hb_hash_argon2`). *Note: Current implementation uses a static salt which is a known limitation.*
- **Session Lifecycle:** Stateless JWT. Borobudur backend should convert the JWT into an HTTP-only secure cookie for web clients.
- **JWT / Token Lifecycle:**
  - Hyperbase issues JWTs upon successful login.
  - JWTs can be renewed via `GET /api/rest/auth/token` if they are past half their expiration threshold.
  - The JWT Claim includes a `ClaimId::Token(token_id, Option<UserClaim>)`. `UserClaim` stores the `collection_id` and `record_id` (UUIDv7).
- **Role/Permission Model:** 
  - Hyperbase uses a token-centric `CollectionRule` model (`All`, `SelfMade`, `None`). 
  - The Project Token created for the dashboard defines what the dashboard app is allowed to do. 
  - Finer-grained, application-level roles (like `admin` vs `visitor`) should be stored within the user record in Hyperbase and enforced by the Borobudur Express backend.

---

## Authentication Architecture

The dashboard operates in a proxy pattern to protect project tokens and raw user data. 

```text
Client (Browser)
       ↓   [Cookie containing JWT]
Borobudur Express Backend
       ↓   [Bearer JWT / Admin Project Token]
Hyperbase BaaS (REST API)
       ↓   [Internal ScyllaDB Driver]
ScyllaDB
```

### Component Responsibilities

1. **Signup (Registration):** 
   - **Dashboard Backend** receives user details, enforces default `"role": "visitor"`, and writes the record to Hyperbase using a high-privilege Project Token.
   - **Hyperbase BaaS** automatically hashes the password using Argon2id (because the schema defines it as `hashed: true`) and stores it.
2. **Login:** 
   - **Dashboard Backend** proxies credentials to Hyperbase's `token-based` endpoint.
   - **Hyperbase BaaS** validates the hash, returns a JWT containing the `UserClaim`.
   - **Dashboard Backend** sets a secure `borobudur_session` cookie.
3. **Logout:** 
   - **Dashboard Backend** clears the `borobudur_session` cookie.
   - **Hyperbase BaaS** has no state to clear (stateless JWT).
4. **Session Validation:** 
   - **Dashboard Backend** extracts the JWT from the cookie on protected routes.
   - **Hyperbase BaaS** validates the JWT on subsequent API calls and renews it via `/api/rest/auth/token` if needed.
5. **JWT Generation & Validation:** **Hyperbase BaaS** owns the cryptographic signing and validation of all tokens.
6. **Password Hashing:** **Hyperbase BaaS** performs all Argon2id hashing internally upon record insertion/verification.

---

## Authentication Flows

### 1. Client-to-Backend Token-Based Login Flow

This flow describes how an application user signs into the Dashboard. Hyperbase's `token-based` endpoint requires the `token_id` and `token` of the project, the target `collection_id`, and the `data` containing the authentication credentials.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Dashboard UI
    participant Server as Express Backend
    participant HB as Hyperbase BaaS
    database DB as ScyllaDB

    Client->>Server: POST /api/auth/login<br/>{ email, password }
    Note over Server: Express rate-limits<br/>and validates inputs
    Server->>HB: POST /api/rest/auth/token-based<br/>{ token_id, token, collection_id, data: { email, password } }
    Note over HB: 1. Validate Project Token<br/>2. Retrieve Collection Schema
    HB->>DB: SELECT record WHERE email = 'user@email'
    DB-->>HB: User Record (id, email, password_hash)
    Note over HB: 3. Verify Argon2id hash<br/>4. Generate JWT with UserClaim(collection_id, record_id)
    HB-->>Server: 200 OK { data: { token: JWT } }
    Note over Server: Sets httpOnly, secure, SameSite=strict<br/>cookie: "borobudur_session"
    Server-->>Client: 200 OK { role, email }
```

### 2. Session Validation and Middleware Flow

This flow executes on every protected dashboard route to check caller permissions. Hyperbase exposes `GET /api/rest/auth/token` to renew an expiring JWT and `GET /api/rest/user` to fetch the record identified in the `UserClaim`.

```mermaid
flowchart TD
    A[Client Request] --> B{Cookie "borobudur_session" exists?}
    B -- No --> C[Return 401 Unauthorized]
    B -- Yes --> D[Express Extract JWT]
    D --> E[GET /api/rest/user with Bearer JWT]
    E --> F{Hyperbase validates JWT?}
    F -- Invalid/Expired --> G[Clear Cookie & Return 401 Unauthorized]
    F -- Valid --> H{Check JWT Expire threshold}
    H -- Expiry < 50% remaining --> I[GET /api/rest/auth/token to Renew JWT]
    I --> J[Update Response Cookie with New JWT]
    J --> K[Attach User Profile to req.user]
    H -- Expiry OK --> K
    K --> L{Route requires role?}
    L -- No --> M[Allow Request]
    L -- Yes --> N{req.user.role matches required?}
    N -- No --> O[Return 403 Forbidden]
    N -- Yes --> M
```

### 3. User Registration (Signup) Flow

Since end-users cannot write to the user directory directly (Project tokens shouldn't have raw write access for security), the Express Backend acts as an authoritative proxy using an elevated token to create the record.

```mermaid
sequenceDiagram
    autonumber
    actor Client as Dashboard UI
    participant Server as Express Backend
    participant HB as Hyperbase BaaS
    database DB as ScyllaDB

    Client->>Server: POST /api/auth/signup<br/>{ email, password }
    Note over Server: Force `"role": "visitor"`<br/>to prevent privilege escalation
    Server->>HB: POST /api/rest/project/{pid}/collection/{cid}/record<br/>Header: Authorization: Bearer <Admin_Project_Token><br/>Body: { email, password, role }
    Note over HB: Collection schema has<br/>`auth_column: true`, `hashed: true` for password.<br/>Hashes password with Argon2id.
    HB->>DB: INSERT INTO records_users (id, email, password, role)
    DB-->>HB: Success
    HB-->>Server: 201 Created { _id, email, role }
    Server-->>Client: 201 Created
```

### 4. Hyperbase Administrative Flow (For System Admins)

This is the system administrator path for configuring Hyperbase itself (creating projects, collections, rule tables).

```mermaid
sequenceDiagram
    autonumber
    actor Admin as System Admin
    participant UI as SvelteKit UI
    participant HB as Hyperbase BaaS
    database DB as ScyllaDB

    Admin->>UI: Submit Admin email/password
    UI->>HB: POST /api/rest/auth/password-based { email, password }
    HB->>DB: SELECT admin WHERE email = 'admin@email'
    DB-->>HB: Admin Record
    Note over HB: Verifies Argon2id password hash
    HB-->>UI: 200 OK { data: { token: AdminJWT } }
    UI->>Admin: Access granted to Hyperbase Control Panel
```

---

## Security Requirements & Codebase Integration Notes

1. **Authentication Data Fields:**
   When defining the User Collection in Hyperbase, ensure:
   - `email` field is marked as `auth_column: true`.
   - `password` field is marked as `auth_column: true` and `hashed: true`.
   This is critical because the Hyperbase backend specifically looks for `auth_column: true` and `hashed: true` fields during the `POST /api/rest/auth/token-based` evaluation in `auth.rs`.

2. **JWT Payload:**
   Hyperbase generates JWTs where the `ClaimId` includes the `collection_id` and the UUIDv7 `record_id`. The Express backend must proxy requests using this token to inherently query the correct user record.

3. **Privacy Restrictions:**
   The frontend must **never** receive raw `visitor_id` UUIDs or access to individual movement history data. The Express proxy must intercept all requests and aggregate or strip these fields before returning the response to the dashboard UI.

4. **Environment Setup & Provisioning:**
   The Express backend requires the following authentication-specific environment variables in its `.env` file:
   - `HYPERBASE_AUTH_COLLECTION_ID`: The UUID of the collection used for admin user records.
   - `ADMIN_REGISTRATION_SECRET`: A secure string used by the `POST /signup` endpoint to authorize admin creation.
   - `COOKIE_SECRET`: A secure string to sign the Express session cookie.

   **Separate auth project:** the auth collection may live in a *different*
   Hyperbase project than the location (`coordinate data`) collection. Four
   optional overrides exist — `HYPERBASE_AUTH_BASE_URL`,
   `HYPERBASE_AUTH_PROJECT_ID`, `HYPERBASE_AUTH_TOKEN_ID`,
   `HYPERBASE_AUTH_TOKEN_SECRET` — each falling back to its `HYPERBASE_*`
   counterpart when empty, so a single-project setup needs nothing extra.
   Hyperbase tokens are project-scoped: setting a different
   `HYPERBASE_AUTH_PROJECT_ID` requires that project's own token id/secret.
   All auth-service calls (`signin`, `signup`, session validation / record
   fetch) go through `env.hyperbaseAuth` (see `config/env.ts` and
   `services/auth.service.ts`).
   
   **Provisioning Quirks (SvelteKit UI):**
   When creating a new project via the Hyperbase SvelteKit UI, it automatically provisions a default `Users` collection and an `App Token`.
   - The `App Token` provides the `HYPERBASE_TOKEN_ID` and `HYPERBASE_TOKEN_SECRET` values.
   - The default `Users` collection uses `username` (string) instead of `email`, and lacks a `role` field.
   - For this dashboard integration, you must either add `role` (string) to the default `Users` schema and rename `username` to `email`, or create a completely new `admins` collection with `email` (`auth_column: true`), `password` (`auth_column: true, hashed: true`), and `role` (string), then use its UUID for `HYPERBASE_AUTH_COLLECTION_ID`.
