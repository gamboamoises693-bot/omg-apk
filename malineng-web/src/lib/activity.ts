import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "./firebase";

/**
 * Append-only activity log (read by the Super Admin only; see firestore.rules).
 * The current actor is registered by AuthContext so call sites stay one line:
 *   logActivity("Ayuda", "Nag-update ng AYD-002 (Maria Santos)")
 */
interface Actor {
  uid: string;
  name: string;
  role: string;
}

let actor: Actor | null = null;

export function setActivityActor(next: Actor | null): void {
  actor = next;
}

export const ACTIVITY_TYPES = [
  "Account",
  "Verification",
  "Roles",
  "Settings",
  "Ambulansya",
  "Appointments",
  "Dokumento",
  "Ayuda",
  "Tindahan",
  "Trabaho",
  "Hiring",
  "Board",
  "Events",
  "Botohan",
  "Purok Points",
  "Pamilya",
  "Botika",
  "Hiraman",
  "Mapa",
  "Pabatid",
  "Survey",
  "Transparency",
  "Blotter",
  "Sektor",
  "Kalusugan",
  "Liga",
  "Presinto",
  "Web Access",
  "Videos",
  "Chat",
] as const;
export type ActivityType = (typeof ACTIVITY_TYPES)[number];

/** Fire-and-forget: a logging failure never blocks the real action. */
export function logActivity(type: ActivityType, text: string, targetId = ""): void {
  if (!actor) return;
  addDoc(collection(db, "activityLogs"), {
    actorId: actor.uid,
    actorName: actor.name,
    actorRole: actor.role,
    type,
    text: text.slice(0, 500),
    targetId,
    createdAt: serverTimestamp(),
  }).catch((err) => console.warn("[activity] log failed:", err));
}

export function roleLabel(role: string, position?: string): string {
  if (role === "superadmin") return "Super Admin";
  if (role === "admin") return position ? `Admin · ${position}` : "Admin";
  return "Residente";
}
