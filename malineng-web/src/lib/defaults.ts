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
    bfp: "09222366719", // BFP Cuyapo
  },
  // Cuyapo municipal hotlines. Admin can edit these in /admin > Settings.
  hotlines: [
    { name: "BFP Cuyapo (Bumbero)", numbers: ["09222366719"] },
    { name: "Cuyapo MDRRMO", numbers: ["09776638094"] },
    { name: "Cuyapo Municipal Police Station", numbers: ["09279613417", "09989673217"] },
    { name: "Cuyapo Mayor's Office", numbers: ["09959229579"] },
  ],
  officials: [],
  announcements: [],
  projects: [
    { name: "Covered Court", progress: 0 },
    { name: "Street Lights", progress: 0 },
    { name: "Drainage", progress: 0 },
  ],
};
