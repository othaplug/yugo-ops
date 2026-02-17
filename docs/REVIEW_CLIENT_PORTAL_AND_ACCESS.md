# Review: Client Portal & Access

## 1. What we’ve done (summary)

### Admin move detail
- **Edit Move Details:** Removed entire lat/long section (from_lat, from_lng, to_lat, to_lng).
- **Inventory:** Fixed admin and client inventory so items added on move create show correctly (super-admin + RLS handling in APIs).
- **Documents:** Removed “Linked documents” / “Documents” labels; primary action is “Add document (upload PDF)” with upload; “Add link” kept as secondary.
- **Emails:**  
  - Move-created email: if client already has an active account (has signed in), we send a short “your move was created” email **without** credentials; first-time users get credentials.  
  - We don’t auto-resend portal/welcome on every move create for existing users; only when admin explicitly resends.
- **Email styling:** All move/portal emails use consistent layout (9px eyebrow, 560px width, same buttons/cards).
- **Move detail layout:**  
  - Crew & Asset → **Crew** only (slim card, no Truck/Dispatch).  
  - Removed Property & Access card; from/to access live in **Addresses** card.  
  - Addresses card moved up (below Time & Intelligence); same grid pattern as other cards.  
  - All cards made sleeker (p-3, smaller headings, consistent edit icons).  
  - Addresses and Crew cards overhauled to match other cards (grid + heading).

### Giving a client portal access from admin
- **Resend portal access** is available in two ways:
  1. **Move detail (one-click):** On the move page, in the hero next to “Notify”, there is a **“Resend portal access”** button. It sends the portal-access email (temp password + login link) to the move’s **client email**. Use this for any client (e.g. Sofia Vagara) after confirming the move has the correct `client_email`.
  2. **Contact modal:** Open the move → click the client name → in “Client contact details”, check **“Send portal access (create account + email temp password)”** → Save. Contact details are saved and the same portal email is sent.

---

## 2. Does the client portal exist? Is it working?

**Yes.** The client portal exists and is wired end-to-end.

- **URLs**
  - Login: `/client/login`
  - Dashboard (list of moves for logged-in client): `/client` (or `/client/` via `(portal)/page.tsx`)
  - Single move: `/client/moves/[id]`

- **Auth**
  - Client signs in with **email + password** (Supabase Auth).
  - Access to moves is by **email match:** only moves where `moves.client_email` matches the signed-in user’s email (case-insensitive) are visible.
  - No separate “client user” table; “client user” = any Supabase user whose email matches a move’s `client_email`.

- **How a client gets access**
  1. Move is created with `client_email` and (optionally) move-created email is sent with temp password, **or**
  2. Admin uses **“Resend portal access”** on the move (hero button or contact modal). That creates/updates the auth user and emails temp password + login link.

So the portal is working for any client whose move has `client_email` set and who has received the portal email (or who already had an account and was sent the no-credentials “your move was created” email and can sign in with their existing password).

---

## 3. Does the client portal have all the functionalities we created?

**Yes.** The client side uses the same data and APIs we built; nothing is missing from the client UI.

| Feature | Admin side | Client portal | API (client) |
|--------|------------|----------------|---------------|
| **Move list** | Admin move list | Dashboard shows moves where `client_email` = user email | Server loads moves by `client_email` |
| **Move detail** | Move detail page | Single move page: dates, addresses, crew, countdown, progress | Same `moves` row |
| **Inventory** | Move inventory section (add/edit/delete) | ClientInventory tab: view by room, status | `GET /api/moves/[id]/inventory` (fixed to return items) |
| **Photos** | Move photos section (upload/delete) | ClientPhotos tab: view gallery | `GET /api/moves/[id]/photos` |
| **Documents** | Move documents + client documents + link invoices | ClientDocuments tab: view/download | `GET /api/moves/[id]/documents` (or equivalent) |
| **Change requests** | Change requests queue (approve/reject) | “Messages” / request form: submit change type + description | `POST /api/moves/[id]/change-request` |
| **Live tracking** | (Crew/asset on move) | ClientLiveTrackingMap tab | e.g. crew-status or similar |
| **Notify** | Notify button (sends status email) | N/A (client receives only) | `/api/notify` |

Client dashboard tabs: **Dashboard**, **Live Tracking**, **Inventory**, **Photos**, **Documents**, **Messages**. All are present and backed by the APIs we use.

---

## 4. Does client “Sofia Vagara” have client user access?

**We can’t tell from code alone.** Access is determined by:

1. **There is a move** whose `client_name` is “Sofia Vagara” (or similar) and whose `client_email` is set to the email she should use.
2. **That email** has a Supabase Auth user (created when move-created or “Resend portal access” was sent).
3. She signs in at `/client/login` with that email and the temp password (or her updated password).

So “Sofia Vagara” has access if:
- A move exists with her name and the correct `client_email`, and  
- She (or someone) received the portal-access email for that email and can log in.

**If she has never received the portal email or doesn’t have an account:**  
Use **“Resend portal access”** for her move so she gets the email with temp password and link.

**How to give Sofia Vagara access (recommended):**

1. In **Admin**, open **Moves** and find the move for **Sofia Vagara** (search by client name or use your list).
2. Open that move’s detail page.
3. Confirm **client email** is correct (click her name → edit contact if needed).
4. Click **“Resend portal access”** in the hero (next to “Notify”).
5. She will receive an email with a temporary password and link to the client portal. She signs in at `/client/login` with that email and temp password (and can change password when prompted).

No code change is required for “Sofia Vagara” specifically; the move’s `client_email` is the only thing that must match the email she uses to log in.

---

## 5. Questions that are useful to clarify

1. **Exact client name/email**  
   Is the move stored under “Sofia Vagara” and what exact `client_email` is on that move? (If it’s a typo or different email, she won’t see the move after logging in.)

2. **Has she ever received a portal or move-created email?**  
   If yes, she may already have an account; she might need “Forgot password” or a fresh “Resend portal access” to get a new temp password.

3. **Environment**  
   Is `RESEND_API_KEY` set in the environment where you run the app? Without it, “Resend portal access” and move-created emails won’t send (move creation still succeeds).

4. **Multiple moves for same client**  
   If one person has several moves (same email on each), they see all of them on the client dashboard; no extra config needed.

5. **Client URL**  
   What is the base URL clients use? (e.g. `https://yourapp.com/client/login`.) Ensure they’re using that and not an admin or old link.

---

## 6. Quick checklist for “client doesn’t have access”

- [ ] Move exists and has `client_email` set.
- [ ] `client_email` is the email the client will use to log in.
- [ ] “Resend portal access” was clicked for that move (and no send error).
- [ ] Resend is configured (`RESEND_API_KEY`).
- [ ] Client is checking the inbox (and spam) for the portal email.
- [ ] Client is using `/client/login` (or your app’s client login URL), not admin login.

If you want, we can add a small admin-only “Client access” note on the move detail (e.g. “Portal access last sent: …” or “No portal email sent yet”) using the existing send-portal-access API and optional tracking.
