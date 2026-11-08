export const BARANGAY_NAME = "Barangay Malineng";
export const BARANGAY_CITY = "Angeles City, Pampanga";

export const PUROKS = ["Purok 1", "Purok 2", "Purok 3", "Purok 4", "Purok 5"] as const;
export type Purok = (typeof PUROKS)[number];

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
