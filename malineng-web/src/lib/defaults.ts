import type { Settings } from "./types";
import { DEFAULT_PUROKS } from "./constants";

/**
 * Fallback content shown while settings/main does not exist yet.
 * Once the admin saves Settings in /admin, Firestore data replaces this.
 */
export const DEFAULT_SETTINGS: Settings = {
  puroks: DEFAULT_PUROKS,
  alertBanner: "",
  alertType: "wala",
  emergencyNumbers: {
    tanod: "",
    healthCenter: "",
    bfp: "",
  },
  officials: [],
  announcements: [],
  projects: [
    { name: "Covered Court", progress: 0 },
    { name: "Street Lights", progress: 0 },
    { name: "Drainage", progress: 0 },
  ],
};
