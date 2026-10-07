/**
 * Firebase Auth needs an email; store owners & tinderas log in with phone / username.
 * We map them to synthetic, non-deliverable emails. Keep this stable - changing it
 * breaks existing logins.
 */
const OWNER_DOMAIN = "owner.mgcash.app";
const TINDERA_DOMAIN = "tindera.mgcash.app";

export function ownerEmail(phone: string): string {
  return `${phone}@${OWNER_DOMAIN}`;
}

export function tinderaEmail(storeCode: string, username: string): string {
  return `${username.trim().toLowerCase()}.${storeCode.trim().toLowerCase()}@${TINDERA_DOMAIN}`;
}

export const USERNAME_RE = /^[a-z0-9_]{3,20}$/;

/** Short shareable store code e.g. "NENA-4821". */
export function makeStoreCode(storeName: string): string {
  const word = storeName.toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4).padEnd(3, "X");
  const num = Math.floor(1000 + Math.random() * 9000);
  return `${word}-${num}`;
}

/** Map Firebase auth error codes to Tagalog messages. */
export function authErrorMessage(err: unknown): string {
  const code = (err as { code?: string })?.code ?? "";
  switch (code) {
    case "auth/invalid-credential":
    case "auth/wrong-password":
    case "auth/user-not-found":
    case "auth/invalid-email":
      return "Mali ang login details. Pakicheck ulit.";
    case "auth/email-already-in-use":
      return "May account na gamit ang number/username na ito.";
    case "auth/weak-password":
      return "Mahina ang password. Gumamit ng 6 characters pataas.";
    case "auth/too-many-requests":
      return "Masyadong maraming try. Maghintay ng ilang minuto.";
    case "auth/network-request-failed":
      return "Walang internet. Pakicheck ang connection.";
    default:
      return (err as Error)?.message ?? "May error. Subukan ulit.";
  }
}
