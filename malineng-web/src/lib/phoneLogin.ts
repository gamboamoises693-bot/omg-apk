import { normalizePhone } from "./phone";

/**
 * Residents without an email log in with their mobile number. Firebase Auth needs an email-shaped id, so the number
 * becomes "09171234567@malineng-contact.ph". Nothing is ever sent to this address (it is not a real mailbox).
 */
export const CONTACT_EMAIL_DOMAIN = "malineng-contact.ph";

/** The id used to sign in: a real email stays as typed, a PH mobile number becomes its hidden email. */
export function loginIdFor(input: string): string {
  const raw = input.trim();
  if (raw.includes("@")) return raw;
  const phone = normalizePhone(raw);
  return phone ? `${phone}@${CONTACT_EMAIL_DOMAIN}` : raw;
}

/** True for the hidden email made from a mobile number. */
export function isContactEmail(email: string | null | undefined): boolean {
  return !!email && email.toLowerCase().endsWith(`@${CONTACT_EMAIL_DOMAIN}`);
}
