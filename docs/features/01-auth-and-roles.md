# Feature 01: Authentication, Roles & Multi-Tenant Isolation

---

## 1. What this feature does
This feature manages user identity, account creation, and security roles for FieldLog. Business owners can sign up with email and password, which automatically creates their private company workspace and seeds 6 default issue chips. Owners can create supervisor accounts with a phone number and a simple 4-digit PIN. Field supervisors log in using only their phone and 4-digit PIN. The server strictly prevents any company from accessing another company's data.

---

## 2. Hinglish me samjho
Ye feature login aur security ka dhyan rakhta hai. Company ka Maalik (Owner) apne email aur password se account banata hai. Uske baad Maalik apne mistri ya supervisor ka naam, phone number aur 4-digit ka aasan PIN set karke unka account banata hai. Supervisor ko koi lamba password yaad rakhne ki zaroorat nahi hai—wo bas apna mobile number aur 4-digit PIN daal kar login kar lega. Sabse zaroori baat: ek company ka data doosri company ko kabhi nahi dikhega (strict multi-tenant security).

---

## 3. Who uses it
- **Owner:** Signs up, logs in, creates supervisor accounts, resets PINs, and deactivates supervisors who leave work.
- **Supervisor:** Logs in using their phone number and 4-digit PIN; remains logged in securely on their phone.

**User Steps (Owner Signup & Login):**
1. Open Owner portal/app.
2. Enter company name, your name, email, phone, and secure password. Tap "Sign Up".
3. Inside the dashboard, tap "Supervisors" → "+ Add Supervisor".
4. Enter supervisor name, phone number, and a 4-digit PIN (e.g. `1234`). Tap Save.

**User Steps (Supervisor Login):**
1. Open FieldLog on the mobile phone.
2. Enter phone number and 4-digit PIN.
3. Tap "लॉग इन" (Log In). The app opens the "My Work" screen directly.

---

## 4. How it works inside
1. **Owner Signup:** Client calls `POST /api/v1/auth/owner/signup`. Server creates an entry in `organizations`, hashes the password with `bcrypt`, creates an `owner` in `users`, and seeds 6 default chips in `issue_types`.
2. **Supervisor Creation:** Owner sends `POST /api/v1/supervisors` with `Bearer <owner_token>`. Server verifies owner role, hashes the 4-digit PIN, and links the supervisor to the owner's `organization_id`.
3. **Supervisor Login:** Client sends `POST /api/v1/auth/supervisor/login` with `{ phone, pin }`. Server matches phone, checks `is_active === true`, and verifies `pinHash`.
4. **Token Generation:** Server signs a short-lived access JWT (1 hour) and a long-lived refresh JWT (30 days). Payload includes `{ userId, organizationId, role }`.
5. **Multi-Tenant Protection:** Every authenticated route runs `authenticate` middleware, which extracts `request.user.organizationId`. Every database query strictly filters `where organization_id = request.user.organizationId`.

---

## 5. Files and code involved
- `backend/src/services/auth.service.ts`: Hashes passwords/PINs with bcrypt and generates/verifies JWT access and refresh tokens.
- `backend/src/middleware/auth.ts`: Middleware for token authentication and role guards (`requireOwner`, `requireSupervisor`).
- `backend/src/routes/auth.ts`: API endpoints for Owner signup/login, Supervisor PIN login, and token refresh.
- `backend/src/routes/supervisors.ts`: Owner management endpoints for listing, creating, resetting PIN, and toggling supervisor status.
- `backend/src/tests/auth.test.ts`: Automated integration tests covering signup, login, role restrictions, and tenant isolation.
- `mobile/src/i18n/hi.ts` & `en.ts`: Neutral translations for login and supervisor screens.

---

## 6. Database tables touched
- `organizations`: Created on owner signup.
- `users`: Stores owners (with `password_hash`) and supervisors (with `pin_hash`).
- `issue_types`: Default rows seeded on organization signup.

---

## 7. API endpoints used
- `POST /api/v1/auth/owner/signup`: Registers owner and creates organization.
- `POST /api/v1/auth/owner/login`: Authenticates owner via email and password.
- `POST /api/v1/auth/supervisor/login`: Authenticates supervisor via phone and 4-digit PIN.
- `POST /api/v1/auth/refresh`: Refreshes session tokens.
- `GET /api/v1/auth/me`: Fetches profile of current logged-in user.
- `GET /api/v1/supervisors`: Lists organization supervisors.
- `POST /api/v1/supervisors`: Creates a new supervisor.
- `PATCH /api/v1/supervisors/:id/pin`: Resets supervisor PIN.
- `PATCH /api/v1/supervisors/:id/status`: Deactivates or activates supervisor.

---

## 8. Edge cases and what happens
- **Duplicate phone or email:** Server returns HTTP 409 Conflict with a clear message: *"An account with this email/phone already exists"*.
- **Supervisor enters wrong PIN:** Server returns HTTP 401 Unauthorized: *"फ़ोन नंबर या 4-अंकों का पिन गलत है (Invalid phone or PIN)"*.
- **Supervisor account deactivated:** Server rejects login with HTTP 403 Forbidden: *"यह अकाउंट बंद कर दिया गया है (Supervisor account is deactivated)"*.
- **Supervisor attempts to call Owner endpoints:** Middleware returns HTTP 403 Forbidden with code `FORBIDDEN_ROLE`.
- **Cross-tenant access attempt:** If Owner A attempts to access or modify Owner B's supervisor, server returns HTTP 404 Not Found.

---

## 9. How to test it by hand
1. Open PowerShell or an API testing client (e.g. Postman / curl).
2. Call `POST /api/v1/auth/owner/signup` with company name, email, phone, and password. Confirm HTTP 201 and received tokens.
3. Call `POST /api/v1/supervisors` using the Owner's access token to create a supervisor with phone `9876543210` and PIN `1234`.
4. Call `POST /api/v1/auth/supervisor/login` with `{ phone: "9876543210", pin: "1234" }`. Confirm HTTP 200 and supervisor token.
5. Try logging in with PIN `0000`. Confirm HTTP 401 error.
6. Try calling `GET /api/v1/supervisors` using the Supervisor's token. Confirm HTTP 403 Forbidden.

---

## 10. Known limits and future improvements
- In V1, supervisors are created directly by the Owner with a PIN; there is no SMS OTP verification.
- In V2, owners will be able to enable optional SMS OTP or WhatsApp-based login verification.
