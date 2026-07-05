# Hyperbase Authentication Integration Guide

This document specifies the integration contract for the Borobudur Heatmap Dashboard backend to leverage or integrate with the authentication systems of Hyperbase. It serves as the implementation specification for Claude Code.

---

## Hyperbase Authentication Overview

Hyperbase provides two primary levels of authentication:
1. **Administrative Authentication (Password-Based):** Used by Hyperbase project owners/administrators to manage databases, collections, files, and project tokens. It is exposed via `/auth/password-based`.
2. **Application Authentication (Token-Based):** Used by client applications (like the Heatmap Dashboard or mobile loggers) to communicate with Hyperbase services. It is exposed via `/auth/token-based`.

### Authentication Methods
* **Anonymous Token Login:** The client authenticates using a Project Token ID and Secret. If `allow_anonymous` is enabled on the token, Hyperbase returns a public JWT.
* **Collection-Based User Login:** The client authenticates using a Project Token and passes user credentials matching designated auth fields in a specific collection. If successful, Hyperbase returns a JWT containing a user claim (`UserClaim`) identifying the specific database record (user).

### User Lifecycle
* **System Admins:** Registered via `/auth/register` and verified via a code sent by email (`/auth/verify-registration`).
* **Application Users:** Stored as normal records inside a collection designated for users (e.g., `users`). Created by inserting a record into the collection via a POST request. Modified or deleted using normal record endpoints, subject to Token rules.

### Session Lifecycle
* Hyperbase authentication is stateless and session-less.
* Sessions are represented by JSON Web Tokens (JWT) issued by Hyperbase upon login.
* The backend does not maintain active session stores or token blacklists. To "logout," client applications must discard the JWT locally.

### JWT/Token Lifecycle
* **Administration JWT:** Encodes a `ClaimId::Admin(admin_uuid)`.
* **Application JWT:** Encodes a `ClaimId::Token(token_uuid, Option<UserClaim>)`.
  * `UserClaim` contains `collection_id: Uuid` and `id: Uuid` (matching the user's record ID).
* **Token Expiration:** Configured globally on the server.
* **Token Renewal:** Handled via `GET /auth/token`. If the remaining time is less than half the total expiry duration, a new JWT is returned.

### Password Hashing Mechanism
* Hyperbase hashes password fields using **Argon2id** (via the `hb_hash_argon2` crate).
* **Security Note:** The current Hyperbase version uses a single static salt configured in `config.yml` for all Argon2 hashes, which reduces defense-in-depth against dictionary and precomputed rainbow-table attacks.

### Role/Permission Model
* Hyperbase lacks native application-level user roles (e.g., `admin`, `visitor`).
* Permissions are defined *per token* and *per collection* using `CollectionRule` constraints:
  * `all`: Any request authenticated with the token can access the endpoint.
  * `self_made`: Access is restricted to records where `_created_by` matches the user's record ID (from the JWT's `UserClaim`).
  * `none`: Denied.

---

## Authentication Architecture

The system flow for the Borobudur Heatmap Dashboard is structured as follows:

```text
Client (Dashboard UI)
      │
      │ [1] Credentials (email + password)
      ▼
Heatmap Backend (Express API)
      │
      │ [2] POST /auth/token-based (with App Token + Credentials)
      ▼
Hyperbase BaaS (Rust engine)
      │
      │ [3] SELECT record WHERE email = 'user@example.com'
      ▼
ScyllaDB (Storage)
      │
      │ [4] Returns matching record (with password hash)
      ▼
Hyperbase BaaS
      │
      │ [5] Verifies Argon2 hash; encodes JWT containing UserClaim
      ▼
Heatmap Backend
      │
      │ [6] Caches JWT / Sets httpOnly cookie
      ▼
Client (Dashboard UI)
```

### Component Responsibilities

| Responsibility | Component | Notes |
| :--- | :--- | :--- |
| **Signup** | Heatmap Backend & Hyperbase | Heatmap backend accepts registration parameters, performs validation, and uses its App Token to insert the record in Hyperbase. |
| **Login** | Hyperbase BaaS | Validates user record fields and matches password hashes. |
| **Logout** | Heatmap Backend | Stateless. Express backend clears the `httpOnly` cookie; React frontend discards any local session state. |
| **Session Validation** | Heatmap Backend | Verifies the incoming cookie/JWT signature and checks active user credentials. |
| **JWT Generation** | Hyperbase BaaS | Generates the JWT upon successful login or token renewal. |
| **Password Hashing** | Hyperbase BaaS | Hashing of `hashed` fields is handled automatically inside the DAO layer during inserts. |
| **Role Validation** | Heatmap Backend | Since Hyperbase lacks user roles, the Express backend must check the user's `role` field and restrict routes accordingly. |

---

## REST API

### 1. User Authentication (Login)
Exchanges user credentials for a Hyperbase JWT.

* **HTTP Method:** `POST`
* **URL:** `/api/rest/auth/token-based`
* **Headers:**
  * `Content-Type: application/json`
* **Request Body:**
  ```json
  {
    "token_id": "8a83d789-299f-4bdf-99e7-ea7d5c8088fb",
    "token": "app-token-secret-key-string",
    "collection_id": "c62fb384-a1db-49eb-8de2-8c88db47683c",
    "data": {
      "email": "visitor@borobudur.gov",
      "password": "securepassword123"
    }
  }
  ```
* **Response Body (200 OK):**
  ```json
  {
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```
* **Error Responses:**
  * `400 Bad Request`:
    * `"Incorrect authentication data"` (password mismatch or incorrect identifier)
    * `"Authentication data not found"` (user email does not exist)
    * `"Token doesn't match"` (incorrect Project Token secret)

---

### 2. Session Validation and Profile Retrieval
Retrieves current session user details using a Bearer token.

* **HTTP Method:** `GET`
* **URL:** `/api/rest/user`
* **Headers:**
  * `Authorization: Bearer <jwt>`
* **Request Body:** None
* **Response Body (200 OK):**
  ```json
  {
    "data": {
      "_id": "019082ef-0012-70b0-a5c9-9488b39c011e",
      "_created_by": "019082ef-0012-70b0-a5c9-9488b39c011e",
      "_updated_at": "2026-07-05T11:15:30Z",
      "email": "visitor@borobudur.gov",
      "role": "visitor"
    }
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: `"Must be logged in using token-based login"` (or decoding failure)

---

### 3. Token Renewal (Refresh)
Renews the active JWT if it is close to expiration.

* **HTTP Method:** `GET`
* **URL:** `/api/rest/auth/token`
* **Headers:**
  * `Authorization: Bearer <jwt>`
* **Request Body:** None
* **Response Body (200 OK):**
  ```json
  {
    "data": {
      "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
    }
  }
  ```
* **Error Responses:**
  * `400 Bad Request`: `"Failed to decode token..."`

---

## User Schema

Create a collection named `users` in Hyperbase with the following schema:

| Field | Type | Required | Unique | Indexed | Auth Column | Hashed | Hidden |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| `_id` | UUID (v7) | Yes | Yes (PK) | Yes | No | No | No |
| `email` | string | Yes | Yes | Yes | Yes | No | No |
| `password` | string | Yes | No | No | Yes | Yes | Yes |
| `role` | string | Yes | No | No | No | No | No |

* **Uniqueness Constraints:** Handled implicitly on physical primary keys (`PRIMARY KEY (_collection_id, _id)`). The unique constraint on the custom `email` field is enforced by Hyperbase DAO logic.
* **Password Encryption:** The `password` field must have `hashed: true` and `auth_column: true`. This causes Hyperbase to hash it with Argon2id on insert/update and verify it during token-based authentication.

---

## Roles

Because Hyperbase does not provide native Role-Based Access Control (RBAC), roles must be managed as data within user records and validated at the application middleware level.

### Borobudur Dashboard Roles
1. **admin:** Full access to all locations, dashboard metrics, ML hotspots, and administrative operations.
2. **visitor:** Access only to the aggregated heatmap and summary statistics; denied access to mock generation, location deletion, or raw user tables.

### Setup
* Add a `role` field of kind `string` to the `users` schema.
* On user signup, default the value to `"visitor"`.
* Enforce permissions inside the Express backend router middleware by inspecting this value.

---

## Session Management

* **Cookies vs. Authorization Header:** 
  * The React frontend will send credentials to the Express backend.
  * The Express backend handles communication with Hyperbase, obtains the JWT, and sets it in an `httpOnly`, `secure: true`, `sameSite: strict` cookie named `borobudur_session`.
  * The Express backend reads this cookie for client requests, and forwards the token in the `Authorization: Bearer <jwt>` header to Hyperbase.
* **Token Expiration:** The JWT's expiration duration is set by Hyperbase configuration. The Express backend should intercept requests, check if the token requires renewal, call the token refresh endpoint (`GET /api/rest/auth/token`), and update the client cookie on renewal.

---

## Security Recommendations

1. **Brute-Force Protection:** Implement `express-rate-limit` on Express login (`/api/auth/login`) and signup (`/api/auth/signup`) endpoints. Lock accounts or restrict requests after 5 failed attempts within 15 minutes.
2. **CSRF Protection:** If using session cookies, enforce CSRF protection via double-submit cookies or custom request headers (e.g., ensuring requests contain a custom `X-Requested-With` header which browser scripts can set but simple cross-site forms cannot).
3. **CORS:** Restrict CORS configuration on the Express backend to allow requests only from the production dashboard frontend origin.
4. **Secure Cookies:** In production, ensure cookies use:
   * `httpOnly: true` (prevents XSS reads)
   * `secure: true` (restricts to HTTPS)
   * `sameSite: 'strict'` (blocks cross-site request forgery)
5. **Argon2 Salt Vulnerability mitigation:** Because Hyperbase reuses a static salt for Argon2, add a custom pepper or re-hash passwords on the Express backend before transmitting them to Hyperbase (e.g., using `bcrypt` or local `argon2` with a random salt on the backend, then using that hash as the password submitted to Hyperbase).

---

## Integration Guide for Borobudur Dashboard

This section outlines the Express backend integration contract for Claude Code.

### 1. Middleware: `authenticateUser`
* Intercepts HTTP requests.
* Extracts the token from the `borobudur_session` cookie.
* Calls `GET /api/rest/user` on Hyperbase with the JWT.
* If successful:
  * Appends user data to `req.user`.
  * Checks JWT expiry and calls `GET /api/rest/auth/token` if renewal is needed, updating the response cookie.
* If unsuccessful: Returns `401 Unauthorized`.

### 2. Middleware: `requireRole(role)`
* Pre-requisite: Runs after `authenticateUser`.
* Compares `req.user.role` with the required role.
* If authorized: Continues to the route.
* If unauthorized: Returns `403 Forbidden`.

### 3. Login Route (`POST /api/auth/login`)
1. Receives `email` and `password` from the client.
2. Makes a POST request to Hyperbase `/api/rest/auth/token-based` with the credentials, target User collection ID, and Project token details.
3. If Hyperbase returns a token, sets it as an `httpOnly` cookie and returns `200 OK` with user details.
4. If Hyperbase returns an error, maps it to a generic `"Invalid email or password"` response.

### 4. Signup Route (`POST /api/auth/signup`)
1. Receives `email`, `password`, and optional profile fields.
2. Formats a record JSON payload, setting `"role": "visitor"` to prevent privilege escalation.
3. Uses the App Token (server-to-server credentials) to issue a `POST /api/rest/project/{projectId}/collection/{collectionId}/record` to Hyperbase.
4. Returns `201 Created` on success.

### 5. Logout Route (`POST /api/auth/logout`)
1. Clears the `borobudur_session` cookie.
2. Returns `200 OK`.

### 6. Route Permissions
* **Public Routes:** `/api/auth/login`, `/api/auth/signup`, `/health`.
* **Visitor Protected Routes:** (Requires `authenticateUser`)
  * `GET /api/heatmap/aggregate`
  * `GET /api/dashboard/summary`
  * `GET /api/hotspots`
* **Admin Protected Routes:** (Requires `authenticateUser` + `requireRole('admin')`)
  * `POST /api/mock/location`
  * `POST /api/mock/generate`
  * `DELETE /api/mock/clear`

---

## Environment Variables

The Heatmap Dashboard backend requires the following configuration:

```env
PORT=3001
REPOSITORY_DRIVER=hyperbase

# Hyperbase REST API Server
HYPERBASE_BASE_URL=http://localhost:8080

# Project Metadata
HYPERBASE_PROJECT_ID=<project-uuid>
HYPERBASE_LOCATION_COLLECTION_ID=<location-logs-collection-uuid>
HYPERBASE_USERS_COLLECTION_ID=<users-collection-uuid>

# Backend Service Token (Used for Registration & Database management)
HYPERBASE_TOKEN_ID=<token-uuid>
HYPERBASE_TOKEN_SECRET=<token-secret>

# Express Cookie and Token settings
SESSION_COOKIE_NAME=borobudur_session
SESSION_SECRET=<random-jwt-and-cookie-signing-key>
```

---

## Implementation Checklist

- [ ] **Step 1: Setup Schemas inside Hyperbase**
  * Create `users` collection with fields: `email` (string, required, auth_column), `password` (string, required, auth_column, hashed, hidden), and `role` (string, required).
  * Configure the Project Token collection rules to allow `users` collection read/write operations for the service token.
- [ ] **Step 2: Add rate limiting to Express**
  * Install `express-rate-limit` and register it on auth endpoints.
- [ ] **Step 3: Setup Session Cookie Middleware**
  * Implement cookie parsing and signing using `cookie-parser`.
- [ ] **Step 4: Create Hyperbase HTTP client wrapper**
  * Write utility function to make fetch calls to Hyperbase REST server with appropriate Authorization headers.
- [ ] **Step 5: Implement `authenticateUser` middleware**
  * Read `borobudur_session` cookie.
  * Verify token using `/api/rest/user`.
  * Attach user context to `req.user`.
- [ ] **Step 6: Implement `requireRole` middleware**
  * Verify role restrictions on routes.
- [ ] **Step 7: Implement Login, Signup, and Logout routes**
  * Login route calls Hyperbase token-based signin.
  * Signup route inserts visitor records into the `users` collection.
  * Logout route clears the local cookie.
- [ ] **Step 8: Bind router configurations**
  * Guard existing endpoints (`/api/heatmap/aggregate`, `/api/mock/generate`, etc.) with the new authentication middleware.

---

## Recommendation

### Summary Recommendation
The Borobudur Dashboard should **not** rely on Hyperbase's built-in token-based authentication for its application users. Instead, it should **implement a separate authentication system** managed directly by the Heatmap Backend (Express API) using a standard, secure Express session/JWT package (e.g., `passport` or `jsonwebtoken` with `bcrypt/argon2` libraries), using Hyperbase purely as a storage layer for user metadata records.

### Technical Justifications

1. **Security Vulnerability (Static Salt):**
   Hyperbase's internal Argon2id hashing component uses a static salt parsed from configuration rather than a unique random salt generated per password. Reusing a static salt makes the user database highly susceptible to precomputed lookup table and rainbow table attacks. Managing password hashing locally on the Express backend (using standard NPM packages like `bcrypt` or `argon2` which guarantee unique salts) mitigates this risk.
2. **Lack of User Roles/RBAC:**
   Hyperbase does not support application roles. If you use Hyperbase auth, the Express backend still has to perform extra checks to determine whether a user is an `admin` or a `visitor`. Managing authentication on the Express backend anyway simplifies the architecture by keeping auth logic unified.
3. **Inflexible Session Control:**
   Hyperbase does not provide session blacklisting, logout hooks, or audit trails. Doing authentication on the Express backend allows the dashboard to easily implement JWT blacklisting, sliding session windows, and database-backed login audit records.
4. **Rate Limiting Gaps:**
   Hyperbase lacks rate limiting on `/auth/token-based`, making user logins vulnerable to brute force and credential stuffing. Putting authentication on the Express backend ensures that rate limiting can be safely managed in the application layer.
