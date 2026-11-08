# Barangay Malineng Website

**Live:** https://barangay-malineng.web.app

Opisyal na community website ng **Barangay Malineng, Cuyapo, Nueva Ecija**.
Next.js + Tailwind + Firebase (Auth, Firestore, Storage, Hosting). Mobile-first, Tagalog/Taglish.

## Mga Feature

| Page | Ano ang ginagawa |
|---|---|
| `/` | Alert banner, Hero, Quick Services, Anunsyo, Opisyal, Transparency, Emergency |
| `/login`, `/register` | Email/Password + Google Login |
| `/board` | Community Board: post (may approval), like, comment |
| `/tindahan` | Libreng marketplace: search, category, Tawagan/Messenger |
| `/tindahan/item?id=` | Detail page ng paninda |
| `/tindahan/magbenta` | Form sa pagbebenta (expires after 30 days) |
| `/trabaho` | Trabaho/Sideline board + "Interesado Ako" |
| `/skills` | Skills Directory na may instant search |
| `/emergency` | Malalaking SOS buttons (tel: link) |
| `/lost-found` | Nawawala / Nakita na may photo |
| `/ayuda` | Ayuda Checker gamit ang pangalan o control number |
| `/appointment` | Pag-book + tracking (Natanggap → Nasa Kagawad → Ready) |
| `/register-event` | Pagparehistro sa Ayuda / Clean-up / Fiesta / Event |
| `/events`, `/botohan`, `/purok` | Events, Polls, Purok Points leaderboard |
| `/account` | Profile, mga paninda ko, logout |
| `/admin` | Approve, appointments, ayuda (may CSV import), settings, events, polls, purok points |

---

## Setup gamit ang PHONE LANG (mga 20 minuto)

### Step 1: Gumawa ng Firebase project
1. Buksan ang **console.firebase.google.com** sa Chrome (i-check ang "Desktop site" kung masikip ang screen).
2. **Add project** → pangalan: `barangay-malineng` → Create.

> **"You've reached the project limit"?** Gumamit na lang ng project na hindi ginagamit (hal. "My First Project").
> Para gumanda ang URL: **Hosting → Get started → Add another site** → `barangay-malineng`,
> tapos idagdag ang GitHub Secret na `FIREBASE_HOSTING_SITE` = `barangay-malineng`.
> Lalabas ang site sa `https://barangay-malineng.web.app`.
3. **Build → Authentication → Get started**
   - I-enable ang **Email/Password**
   - I-enable ang **Google** (pumili ng support email)
4. **Build → Firestore Database → Create database** → Production mode → location `asia-southeast1`.
5. **Huwag nang i-enable ang Storage.** Naka-`USE_FIREBASE_STORAGE = false` na ang app, kaya ise-save ang compressed na photo diretso sa Firestore (libre, walang Blaze plan).

### Step 2: Kunin ang web config
1. Project settings (gear icon) → **Your apps** → pindutin ang `</>` (Web) → i-register ang app.
2. Kopyahin ang `firebaseConfig`.
3. Sa GitHub app/website, i-edit ang **`malineng-web/src/config/firebase.config.ts`** at palitan ang mga `PALITAN-...` ng values mo.
4. I-edit din ang **`malineng-web/.firebaserc`**: palitan ang `PALITAN-NG-PROJECT-ID` ng project ID mo.

### Step 3: Gumawa ng service account (para sa auto-deploy)
1. Firebase Console → Project settings → **Service accounts** → **Manage service account permissions** (bubukas ang Google Cloud).
2. **+ Create service account** → pangalan: `github-deploy`.
3. Ibigay ang roles na ito: **Firebase Admin**, **Service Account User** at **API Keys Viewer**.
4. Buksan ang ginawang account → **Keys → Add key → JSON**. Mada-download ang `.json` file.

### Step 4: Ilagay ang GitHub Secrets
GitHub repo → **Settings → Secrets and variables → Actions → New repository secret**:

| Name | Value |
|---|---|
| `FIREBASE_PROJECT_ID` | project ID mo (hal. `barangay-malineng`) |
| `FIREBASE_SERVICE_ACCOUNT` | buong laman ng `.json` file (buksan sa text viewer, i-copy lahat) |
| `FIREBASE_HOSTING_SITE` *(optional)* | pangalan ng custom Hosting site, hal. `barangay-malineng` |

### Step 5: I-deploy
- I-merge sa `main` ang branch na ito. Kusang tatakbo ang **Actions → Deploy Barangay Malineng Website**.
- Pwede ring i-run nang manual: **Actions → Deploy... → Run workflow**.
- Pagkatapos nito, live na ang site sa: `https://PROJECT-ID.web.app`

### Step 6: Payagan ang Google Login sa domain
Authentication → **Settings → Authorized domains**: dapat nakalista ang `PROJECT-ID.web.app`. Karaniwang automatic na ito.

### Step 7: Gawing ADMIN ang sarili mo
1. Mag-register muna sa website mo.
2. Firebase Console → Firestore → `users` → buksan ang document mo.
3. Palitan ang `role` mula `resident` papuntang **`admin`**.
4. I-refresh ang site. Lalabas na ang shield icon (Admin) sa itaas.
5. Pumunta sa **/admin → Settings** at ilagay ang emergency numbers, mga opisyal, at anunsyo.

---

## Roles at verification

| Role | Paano itakda | Kaya |
|---|---|---|
| **Super Admin** (`role: "superadmin"`) | **Isang beses sa Firebase Console**: Firestore → `users` → doc mo → `role` = `superadmin` | Lahat, kasama ang 👑 Users at Roles at 👑 Activity Log |
| **Admin** (`role: "admin"` + `position`) | Ng Super Admin sa Admin → 👑 Users at Roles | Pamamahala. Ang `position: "Kapitan"` lang ang makaka-approve ng ambulansya |
| **Residente** | Default pagka-register | Normal na gamit |

- **Selfie verification**: pagka-register → `/verify`. Susuriin ito ng Admin sa tab na ✓ Verification. Itatago ang selfie hanggang burahin ng residente ang account (Account → Burahin ang account ko).
- **Verified lang**: Tindahan, Trabaho, Appointment/Clearance, schedule ng ambulansya, at Botohan. **Laging bukas ang emergency request.**
- **Suspend**: Ng Super Admin. Hindi makakapag-post o makakapag-book ang naka-suspend, pero bukas pa rin sa kanya ang emergency.
- **Clearance na may QR**: Admin → Appointments → (Ready) → Gumawa ng dokumento. Ang QR ay papunta sa `/verify-doc/?id=...`.

## Data model (Firestore)

`users`, `posts`, `comments`, `listings`, `jobs`, `skills`, `lostFound`, `ayuda`, `appointments`,
`polls`, `events`, `purokPoints`, `settings` (single doc: `settings/main`), `registrations` (para sa `/register-event`),
`ambulanceRequests` + `ambulanceSchedule`, `verifications` (selfie, private) + `verifiedUsers` (public flag),
`activityLogs` (append-only), `issuedDocuments` (QR check), at `households`.

Mga tala:
- **ayuda**: ang document ID ay ang **control number** (UPPERCASE). May `nameLower` field para sa pag-search ng pangalan.
- **polls**: ang `votes` ay array ng `{uid, option}`, at ang `voters` ay array ng uid. Isang boto lang bawat tao (naka-enforce sa rules).
- **purokPoints**: doc ID `purok-1` hanggang `purok-5`.

## Security
Lahat ng permission ay naka-enforce sa `firestore.rules` at `storage.rules`, hindi lang sa UI:
- Guest: view lang.
- Resident: pwedeng mag-post. Laging `pending` ang bagong post, at hindi niya kayang i-approve ang sarili o gawing admin ang sarili.
- Admin: `users/{uid}.role == "admin"`.

## Local dev (kung may computer)
```bash
cd malineng-web
npm install
npm run dev     # http://localhost:3000
npm run build   # static export -> out/
```
