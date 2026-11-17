// Sample data for the guide screenshots. Talks to the LOCAL Firebase emulators only (never the real project).
// Nobody real appears in the pictures: the resident is "Juan Dela Cruz (halimbawa)".
import { readFileSync } from "node:fs";

const PROJECT = process.env.GUIDE_PROJECT || "project-a682ecac-e2d1-469c-bc7";
const AUTH = "http://127.0.0.1:9099";
const STORE = `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents`;
const OWNER = { "content-type": "application/json", Authorization: "Bearer owner" };

const S = (v) => ({ stringValue: v });
const I = (v) => ({ integerValue: String(v) });
const B = (v) => ({ booleanValue: v });
const T = (v) => ({ timestampValue: new Date(v).toISOString() });
const A = (v) => ({ arrayValue: { values: v } });

async function put(path, fields) {
  const r = await fetch(`${STORE}/${path}`, { method: "PATCH", headers: OWNER, body: JSON.stringify({ fields }) });
  if (!r.ok) throw new Error(`${path}: ${r.status} ${await r.text()}`);
}

async function account(email, password) {
  const r = await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/accounts:signUp?key=guides`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ email, password, returnSecureToken: true }),
  });
  const j = await r.json();
  if (!j.localId) throw new Error(`signUp ${email}: ${JSON.stringify(j)}`);
  // Verified e-mail, so the sample resident is allowed to post and request.
  await fetch(`${AUTH}/identitytoolkit.googleapis.com/v1/projects/${PROJECT}/accounts:update`, {
    method: "POST",
    headers: OWNER,
    body: JSON.stringify({ localId: j.localId, emailVerified: true }),
  });
  return j.localId;
}

export const RESIDENT = { email: "juan@halimbawa.test", password: "halimbawa123" };
/** A resident who has not been verified yet (for the "I-verify ang account" guide). */
/** Staff accounts for the guides meant for admins. */
export const KAPITAN = { email: "kap@halimbawa.test", password: "halimbawa123" };
export const DEV = { email: "dev@halimbawa.test", password: "halimbawa123" };
export const NEWBIE = { email: "maria@halimbawa.test", password: "halimbawa123" };

export async function seed(selfieFile) {
  const uid = await account(RESIDENT.email, RESIDENT.password);
  const day = 86400e3;
  await put(`users/${uid}`, {
    uid: S(uid), email: S(RESIDENT.email), fullName: S("Juan Dela Cruz"), role: S("resident"), purok: S("Purok 1"),
    contact: S("09171234567"), birthday: S("1990-05-12"), sex: S("Lalaki"), civilStatus: S("Kasal"), createdAt: T(Date.now() - 30 * day),
  });
  // The Punong Barangay's signature, printed on the Barangay ID.
  await put("settings/signature", { image: S("data:image/png;base64,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") });
  await put(`verifiedUsers/${uid}`, { name: S("Juan Dela Cruz") });
  if (selfieFile) {
    await put(`verifications/${uid}`, {
      uid: S(uid), fullName: S("Juan Dela Cruz"), purok: S("Purok 1"), birthday: S("1990-05-12"), contact: S("09171234567"),
      email: S(RESIDENT.email), selfie: S(readFileSync(selfieFile, "utf8")), status: S("verified"), submittedAt: T(Date.now() - 20 * day),
    });
  }
  const nuid = await account(NEWBIE.email, NEWBIE.password);
  await put(`users/${nuid}`, {
    uid: S(nuid), email: S(NEWBIE.email), fullName: S("Maria Santos"), role: S("resident"), purok: S("Purok 2"),
    contact: S("09181234567"), birthday: S("1995-03-08"), createdAt: T(Date.now() - 2 * day),
  });
  await put(`helpChats/${nuid}`, { uid: S(nuid), name: S("Maria Santos"), lastText: S("Hindi ako makapag-selfie po, ano ang gagawin?"), lastAt: T(Date.now() - 900e3), lastFrom: S("user") });
  const kuid = await account(KAPITAN.email, KAPITAN.password);
  await put(`users/${kuid}`, {
    uid: S(kuid), email: S(KAPITAN.email), fullName: S("Roberto Halimbawa"), role: S("admin"), position: S("Kapitan"), purok: S("Purok 1"),
    contact: S("09170000001"), birthday: S("1975-01-01"), createdAt: T(Date.now() - 90 * day),
  });
  const duid = await account(DEV.email, DEV.password);
  await put(`users/${duid}`, {
    uid: S(duid), email: S(DEV.email), fullName: S("Developer Halimbawa"), role: S("superadmin"), purok: S("Purok 1"),
    contact: S("09170000002"), birthday: S("1990-01-01"), createdAt: T(Date.now() - 90 * day),
  });
  // Waiting for the staff to act on (admin guides).
  const tomorrow = new Date(Date.now() + day).toISOString().slice(0, 10);
  await put("ambulanceRequests/a1", {
    userId: S(uid), type: S("schedule"), patientName: S("Lola Rosa Santos"), purok: S("Purok 2"), reason: S("Dialysis"), date: S(tomorrow), time: S("08:00"),
    pickup: S("Purok 2, tapat ng kapilya"), destination: S("Cuyapo District Hospital"), notes: S("Naka-wheelchair"), contact: S("09171234567"), status: S("pending"), stage: I(1), driver: S("Mang Berto"), durationHours: I(3), createdAt: T(Date.now() - 3600e3),
  });
  await put("appointments/ap1", { userId: S(uid), fullName: S("Juan Dela Cruz"), service: S("Barangay Clearance"), date: S(tomorrow), contact: S("09171234567"), notes: S("Para sa trabaho"), status: S("natanggap"), createdAt: T(Date.now() - 7200e3) });
  await put("posts/pp1", { authorId: S(uid), authorName: S("Juan Dela Cruz"), content: S("Libreng gupit sa Sabado sa Barangay Hall para sa mga bata."), photoURL: S(""), status: S("pending"), likes: A([]), createdAt: T(Date.now() - 1800e3) });
  await put("borrowRequests/br1", {
    userId: S(uid), userName: S("Juan Dela Cruz"), purok: S("Purok 1"), contact: S("09171234567"),
    items: A([{ mapValue: { fields: { itemId: S("tent"), name: S("Tent"), qty: I(1) } } }]), itemIds: A([S("tent")]),
    start: T(Date.now() + 2 * day), end: T(Date.now() + 3 * day), purpose: S("Lamay / Burol"), note: S("Sa Purok 3"), status: S("pending"), stage: I(1), createdAt: T(Date.now() - 4000e3),
  });
  const pid = await account("pedro@halimbawa.test", "halimbawa123");
  await put(`users/${pid}`, { uid: S(pid), email: S("pedro@halimbawa.test"), fullName: S("Pedro Reyes"), role: S("resident"), purok: S("Purok 3"), contact: S("09191234567"), birthday: S("1988-07-20"), createdAt: T(Date.now() - 3 * day) });
  if (selfieFile) {
    await put(`verifications/${pid}`, { uid: S(pid), fullName: S("Pedro Reyes"), purok: S("Purok 3"), birthday: S("1988-07-20"), contact: S("09191234567"), email: S("pedro@halimbawa.test"), selfie: S(readFileSync(selfieFile, "utf8")), status: S("pending"), submittedAt: T(Date.now() - 3600e3) });
  }
  const idf = (purok) => ({ mapValue: { fields: { fullName: S("Pedro Reyes"), purok: S(purok), contact: S("09191234567"), birthday: S("1988-07-20") } } });
  await put(`profileChanges/${pid}`, { uid: S(pid), current: idf("Purok 3"), requested: idf("Purok 5"), status: S("pending"), createdAt: T(Date.now() - 1800e3) });
  await put("raffleDonations/dn1", { userId: S(uid), name: S("Aling Nena Store"), anon: B(false), kind: S("Gamit / premyo"), what: S("Grocery package"), amount: I(1500), contact: S("09170001111"), message: S("Pasko po!"), status: S("new"), createdAt: T(Date.now() - 5400e3) });
  // A few things to look at on the pages.
  await put("settings/main", {
    ambulance: { mapValue: { fields: { status: S("available"), phone: S("09171112222"), fee: S("Libre"), drivers: A([S("Mang Berto"), S("Mang Rudy")]) } } },
    officials: A([
      { mapValue: { fields: { name: S("Romando Felicitas Gamboa"), position: S("Punong Barangay") } } },
      { mapValue: { fields: { name: S("Cristina H. Flores"), position: S("Barangay Secretary") } } },
    ]),
    announcements: A([
      { mapValue: { fields: { title: S("Barangay Kalinisan Day"), body: S("Sabado, 6:00 AM sa Barangay Hall."), date: S("2026-11-20"), until: S(new Date(Date.now() + 5 * day).toISOString().slice(0, 10)) } } },
      // Already over: must not show on Home.
      { mapValue: { fields: { title: S("Tapos nang anunsyo"), body: S("Hindi ito dapat lumabas."), date: S("2026-11-01"), until: S(new Date(Date.now() - 2 * day).toISOString().slice(0, 10)) } } },
    ]),
  });
  await put("borrowItems/tent", { name: S("Tent"), total: I(3), maxPerBorrow: I(2), fee: I(0), photo: S(""), note: S("Para sa lamay, kasal at iba pang okasyon."), hidden: B(false) });
  await put("borrowItems/upuan", { name: S("Monoblock chairs"), total: I(40), maxPerBorrow: I(20), fee: I(0), photo: S(""), note: S(""), hidden: B(false) });
  await put("listings/l1", {
    sellerId: S("seller"), sellerName: S("Aling Nena"), title: S("Gulay at prutas"), price: I(50), category: S("Pagkain"), description: S("Sariwa, galing sa taniman."),
    contact: S("09170001111"), purok: S("Purok 2"), photoURL: S(""), status: S("approved"), createdAt: T(Date.now() - 2 * day), expiresAt: T(Date.now() + 20 * day),
  });
  await put("settings/raffle", { enabled: B(true), startAt: T(Date.now() - day), cutoffAt: T(Date.now() + 7 * day), drawAt: T(Date.now() + 7 * day), rounds: A([{ mapValue: { fields: { name: S("MAJOR PRIZE"), type: S("maj"), prizes: A([S("Rice cooker")]) } } }]) });
  await put("raffleSponsors/s1", { name: S("Omega Purified Ice"), what: S("Media Noche"), amount: I(1000), tier: S("main"), show: B(true), link: S("https://facebook.com/omegapurifiedice"), createdAt: T(Date.now() - day) });
  // Pages that only show what the Barangay published (decisions, points, league, child health, ID check).
  await put("decisionsPublic/d1", { title: S("Bagong ilaw sa kalsada ng Purok 3"), kind: S("Proyekto"), detail: S("Aprubado ang paglalagay ng 10 poste ng ilaw sa Purok 3 para sa kaligtasan sa gabi."), decidedAt: T(Date.now() - 3 * day) });
  await put("decisionsPublic/d2", { title: S("Iskedyul ng pagkolekta ng basura"), kind: S("Patakaran"), detail: S("Tuwing Martes at Biyernes ang pagkolekta ng basura sa lahat ng purok."), decidedAt: T(Date.now() - 9 * day) });
  for (const [id, purok, points, n] of [["p1", "Purok 1", 120, 3], ["p2", "Purok 2", 95, 2], ["p3", "Purok 3", 60, 1]]) {
    await put(`purokPoints/${id}`, { purok: S(purok), points: I(points), cleanupCount: I(n) });
  }
  await put("children/c1", {
    name: S("Ana Dela Cruz"), birthday: S(new Date(Date.now() - 100 * day).toISOString().slice(0, 10)), sex: S("Babae"), purok: S("Purok 1"),
    parentId: S(uid), parentName: S("Juan Dela Cruz"), parentContact: S("09171234567"), notes: S(""), vaccines: { mapValue: { fields: {} } }, createdAt: T(Date.now() - 90 * day),
  });
  await put("leagues/l1", { name: S("Liga ng Malineng 2026"), sport: S("Basketball"), status: S("active"), createdAt: T(Date.now() - 10 * day) });
  for (const [id, name, purok] of [["t1", "Purok 1 Bulls", "Purok 1"], ["t2", "Purok 2 Eagles", "Purok 2"]]) {
    await put(`ligaTeams/${id}`, { leagueId: S("l1"), name: S(name), purok: S(purok), captainId: S("cap"), captainName: S("Kapitan ng Team"), contact: S("09170000000"), players: A([S("Pedro"), S("Mario"), S("Jose")]), status: S("approved"), createdAt: T(Date.now() - 8 * day) });
  }
  await put("ligaGames/g1", { leagueId: S("l1"), homeId: S("t1"), awayId: S("t2"), homeName: S("Purok 1 Bulls"), awayName: S("Purok 2 Eagles"), scheduledAt: S(new Date(Date.now() + 2 * day).toISOString().slice(0, 11) + "18:00"), venue: S("Covered Court"), status: S("scheduled"), homeScore: I(0), awayScore: I(0), period: S("") });
  await put("ligaGames/g0", { leagueId: S("l1"), homeId: S("t2"), awayId: S("t1"), homeName: S("Purok 2 Eagles"), awayName: S("Purok 1 Bulls"), scheduledAt: S(new Date(Date.now() - 2 * day).toISOString().slice(0, 11) + "18:00"), venue: S("Covered Court"), status: S("final"), homeScore: I(58), awayScore: I(61), period: S("") });
  await put("raffleSponsors/s2", { name: S("Aling Nena Store"), what: S("Grocery package"), amount: I(2000), tier: S("reg"), show: B(true), link: S("https://facebook.com/alingnenastore"), createdAt: T(Date.now() - 2 * day) });
  await put("raffleSponsors/s3", { name: S("Hindi nagpakilala"), what: S("Pera"), amount: I(500), tier: S("reg"), show: B(true), createdAt: T(Date.now() - 3 * day) });
  await put("raffleSponsors/s4", { name: S("Kuya Berto Bakery"), what: S("Pandesal at tinapay"), amount: I(800), tier: S("reg"), show: B(true), link: S("https://kuyaberto.example.com"), createdAt: T(Date.now() - 4 * day) });
  // A received donation of the sample resident, for the receipt and the certificate (same id as its sponsor entry).
  await put("raffleDonations/dncertdncertdncert", { userId: S(uid), name: S("Aling Nena Store"), anon: B(false), kind: S("Gamit / premyo"), what: S("Grocery package"), amount: I(2000), contact: S("09170001111"), message: S(""), status: S("received"), receiptNo: S("RAF-20261115-A1B2"), receivedBy: S("x"), receivedByName: S("Roberto Halimbawa"), receivedAt: T(Date.now() - day), createdAt: T(Date.now() - 3 * day) });
  await put("raffleSponsors/dncertdncertdncert", { name: S("Aling Nena Store"), what: S("Grocery package"), amount: I(2000), tier: S("reg"), show: B(true), donationId: S("dncertdncertdncert"), createdAt: T(Date.now() - day) });
  // A long business name, to check that nothing overlaps on the certificate.
  await put("raffleDonations/dnlongdnlongdnlong", { userId: S(uid), name: S("Omega Purified Ice Cubes and Distilled Water Refilling Station"), anon: B(false), kind: S("Gamit / premyo"), what: S("Media Noche Package at Regalo para sa mga Bata"), amount: I(1500), contact: S("09170001111"), message: S(""), status: S("received"), receiptNo: S("RAF-20261115-NABT"), receivedBy: S("x"), receivedByName: S("Roberto Halimbawa"), receivedAt: T(Date.now() - day), createdAt: T(Date.now() - 3 * day) });
  process.env.GUIDE_DONATION = "dncertdncertdncert";
  return uid;
}
