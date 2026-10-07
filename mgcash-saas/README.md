# MG-CASH SaaS

GCash Cash In / Cash Out / Load manager para sa sari-sari stores — **multi-tenant SaaS**.
Moises (Super Admin) sells it to store owners for **₱210/month (₱7/day)** with a **7-day free trial**.

- **React 19 + Vite + TypeScript + Tailwind v4** PWA (installable, offline cache)
- **Firebase** Auth + Firestore + Hosting (works on the free **Spark** plan; Cloud Functions optional)
- Multi-tenant isolation enforced in `firestore.rules` and covered by 25 emulator tests

## Roles

| Role | Login | Sees |
|---|---|---|
| **Super Admin** (Moises) | email + password, custom claim `superadmin` | All stores, billing, support view (read-only store data) |
| **Store Owner / Boss** | phone + password (self sign-up) | Own store only: profit, approvals, tindera, audit, payroll, reports |
| **Tindera** | Store Code + username + password (created by Boss) | Own commission + own transactions only |
| **Customer** | none | Public `/customer-type?store_id=…&trans_id=…` page to type own GCash number |

## Data model (Firestore)

```
config/app                      admin GCash number + price (Super Admin writes)
users/{uid}                     { role, store_id, name }           role directory
store_codes/{CODE}              { store_id }                       unique store code -> store
payments/{id}                   subscription payments (pending/paid/rejected)
payment_proofs/{paymentId}      compressed GCash screenshot
stores/{storeId}                storeId == owner uid; subscription + balances + daily stats
  tinderas/{uid}                salary/commission settings + membership (active flag)
  transactions/{id}             cash_in | cash_out | load, locked customer number, status
  shifts/{id}                   start/end photo, start cash, expected vs counted, audit
  photos/{id}                   compressed JPEG data URLs (no Cloud Storage needed)
  payrolls/{id}                 saved payslips
```

**Subscription status** is derived from dates (`src/lib/subscription.ts`, mirrored in rules `storeActive()`):
`trial` → `active` (paid) → `overdue` (3-day grace, still works) → `expired` (locked). `deactivated` = manual lock by Super Admin.

## Anti-theft / anti-typo flow

1. Tindera taps **Cash In**, enters amount, picks mode:
   - **QR** → customer scans with *own* phone → types number on `/customer-type` → **locked** & auto-sent to Boss.
     Rules allow exactly one lock, within 15 minutes, only on the number fields.
   - **Bluetooth keypad** → global `keydown` listener (no `<input>`, so no on-screen keyboard); ENTER locks.
2. Number is immutable after lock (yellow **LOCKED** badge) — even the Boss can't edit it.
3. Boss taps **Approve + Copy** → number copied → Boss sends via GCash app (Boss holds the MPIN).
   Approval runs in a Firestore transaction that updates GCash fund, cash float and today's profit atomically.
4. Tindera commission must equal the rate the Boss set (enforced in rules).
5. Start / End shift with timestamped selfie. End shift is counted **blind**; shortage goes to Boss **Audit** → approve or deduct from payroll.

## Setup

```bash
cd mgcash-saas
npm install
cp .env.example .env            # fill in Firebase web config + your GCash number
cp .firebaserc.example .firebaserc   # set your project id
```

1. Firebase Console → create project → enable **Authentication › Email/Password** and **Firestore**.
2. Deploy rules + indexes + app: `npx firebase login && npm run deploy`
3. Create your Super Admin:
   - Console › Authentication › Add user (your email + strong password)
   - Console › Project settings › Service accounts › *Generate new private key* → save as `service-account.json` (git-ignored)
   - `node scripts/set-superadmin.mjs you@email.com`
4. Login at `/admin/login` → **Settings** → set your real GCash number (shown on every paywall).

### Optional: Reset Password (needs Blaze plan)
```bash
cd functions && npm install && cd .. && npm run deploy:functions
```
Super Admin can reset any owner; Boss can reset own tinderas. Without it, the app shows a friendly message.

## Development

```bash
npm run emulators        # terminal 1 (Auth + Firestore emulators, needs Java)
# .env.local: VITE_USE_EMULATORS=true and VITE_FIREBASE_PROJECT_ID=demo-mgcash
npm run dev              # terminal 2
npm test                 # unit tests (subscription, fees, payroll, reports)
npm run test:rules       # security rules tests on the emulator
npm run typecheck && npm run build
```

## Screens

- **Super Admin:** Login, Dashboard (counts, MRR, funds managed, alerts), All Stores (filter/search), Store Detail (profit, tindera performance, payment history, Extend Trial +7d, Mark as Paid, Deactivate, Reset Password, SMS/copy reminder), Billing (approve/reject proofs, due dates), Settings.
- **Store Owner:** Sign Up (auto 7-day trial, referral code), Login, Subscription banner + full-screen **Expired** lock with proof upload, Dashboard, Approvals, Tindera Management, Audit, Payroll (kinsenas/monthly), Reports (daily/weekly/monthly), Settings (store info, GCash business number, fees, change password, referral code).
- **Tindera:** Login, Start Shift (photo), Dashboard (commission only), Cash In / Cash Out / Load (QR or Bluetooth keypad), End Shift audit, My Commission + payslips.
- **Customer:** public number entry page.

## Referral

Each store's code is its referral code. When a referred store's first payment is approved, the referrer automatically gets **+30 days free**.

## Notes / limits

- Photos are stored as compressed JPEG data URLs in Firestore (~50–150 KB) to stay on the free plan. Move to Cloud Storage if volume grows.
- "Send reminder" opens the phone's SMS app with a prefilled message (`sms:` link) or copies it — no paid SMS gateway.
- Tindera can technically read her store doc (needed for fees/lock status), but the UI only shows commission. Split public store fields into a sub-doc if stricter field-level privacy is needed.
