export const BARANGAY_NAME = "Barangay Malineng";
export const BARANGAY_CITY = "Cuyapo, Nueva Ecija";

/** Starting list only. Admin can add/rename/remove puroks in /admin > Settings. */
export const DEFAULT_PUROKS: string[] = ["Purok 1", "Purok 2", "Purok 3", "Purok 4", "Purok 5"];

export const LISTING_CATEGORIES = ["Ulam", "Pagkain", "Ukay", "Halaman", "Homemade", "Iba pa"] as const;
export type ListingCategory = (typeof LISTING_CATEGORIES)[number];

export const JOB_CATEGORIES = [
  "Construction",
  "Kasambahay",
  "Delivery",
  "Tindahan / Sales",
  "Paglilinis",
  "Online / Computer",
  "Iba pa",
] as const;

export const SKILL_TYPES = ["Mananahi", "Electrician", "Tubero", "Karpintero", "Tutor", "Rider", "Iba pa"] as const;
export type SkillType = (typeof SKILL_TYPES)[number];

export const APPOINTMENT_SERVICES = ["Barangay Clearance", "Indigency", "Cedula", "Blotter", "Iba pa"] as const;
export type AppointmentService = (typeof APPOINTMENT_SERVICES)[number];

export const APPOINTMENT_STATUSES = ["natanggap", "nasa_kagawad", "ready"] as const;
export type AppointmentStatus = (typeof APPOINTMENT_STATUSES)[number];
export const APPOINTMENT_STATUS_LABEL: Record<AppointmentStatus, string> = {
  natanggap: "Natanggap",
  nasa_kagawad: "Nasa Kagawad",
  ready: "Ready na — pwede nang kunin",
};

export const AYUDA_STATUS_LABEL: Record<string, string> = {
  qualified: "Qualified",
  scheduled: "Naka-schedule",
  claimed: "Nakuha na",
};

export const REGISTRATION_PURPOSES = ["Ayuda", "Clean-up", "Fiesta", "Event"] as const;

export const ALERT_TYPES = ["wala", "baha", "brownout", "weather"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

export const LISTING_DURATION_DAYS = 30;

/** Admin positions. "Kapitan" can approve ambulance trips (enforced in firestore.rules). */
// "BHW" = Barangay Health Worker: manages the Botika only (no other admin powers).
export const ADMIN_POSITIONS = ["Kapitan", "Secretary", "Treasurer", "Kagawad", "SK Chairman", "BHW Head", "BHW", "Iba pa"] as const;

export const REJECT_REASONS = [
  "Malabo o madilim ang litrato",
  "Hindi kita ang buong mukha",
  "Hindi tugma sa impormasyon ng profile",
  "Duplicate na account",
  "Hindi taga-Barangay Malineng",
] as const;

export const PROJECT_CATEGORIES = ["Imprastraktura", "Kalusugan", "Edukasyon", "Kabuhayan", "Kapaligiran", "Peace & Order", "Iba pa"] as const;
export const INFRA_CATEGORY = "Imprastraktura";

export const FUND_SOURCES = [
  "20% Development Fund",
  "General Fund ng Barangay",
  "SK Fund",
  "BDRRM Fund",
  "LGU Cuyapo (Munisipyo)",
  "Provincial Government",
  "National / DPWH",
  "Donasyon / Private",
  "Iba pa",
] as const;

export const PROJECT_STATUS_LABEL = {
  planned: "Nakaplano",
  ongoing: "Ginagawa",
  completed: "Tapos na",
  delayed: "Naantala",
} as const;

export const HOUSEHOLD_RELATIONS = ["Asawa", "Anak", "Magulang", "Kapatid", "Apo", "Lolo/Lola", "Kamag-anak", "Iba pa"] as const;
