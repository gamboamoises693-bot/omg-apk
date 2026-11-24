/**
 * Per-person admin access for a Kagawad.
 * The Developer ticks which admin sections a Kagawad may open (users/{uid}.adminAccess = list of section keys).
 * A Kagawad with nothing ticked has no admin powers at all (also enforced by firestore.rules).
 * Kapitan, Secretary and the other positions are not limited by this.
 */
export const KAGAWAD_POSITION = "Kagawad";

export const isLimitedPosition = (position?: string): boolean => position === KAGAWAD_POSITION;

/** Sections a Kagawad can be given, grouped for the checklist. Keys match the sections in app/admin/page.tsx. */
export const KAGAWAD_SECTIONS: { title: string; items: { key: string; label: string }[] }[] = [
  {
    title: "Kailangang aksyunan",
    items: [
      { key: "approve", label: "I-approve" },
      { key: "verification", label: "Verification" },
      { key: "profilechange", label: "Pagbabago sa Profile" },
      { key: "helpsetup", label: "Tulong sa Setup" },
      { key: "hallregister", label: "Rehistro sa Hall" },
      { key: "ambulansya", label: "Ambulansya" },
      { key: "appointments", label: "Appointments" },
      { key: "hiraman", label: "Hiraman (pag-apruba)" },
      { key: "ayudabatch", label: "Ayuda: Batch (pag-apruba)" },
      { key: "raffleverify", label: "Raffle: I-verify ang nanalo" },
      { key: "rafflepledge", label: "Raffle: Donasyon" },
      { key: "desisyon", label: "Mahalagang desisyon" },
    ],
  },
  {
    title: "Mga residente",
    items: [
      { key: "ayuda", label: "Ayuda" },
      { key: "households", label: "Households" },
      { key: "registrations", label: "Registrations" },
      { key: "idprint", label: "I-print ang mga ID" },
    ],
  },
  {
    title: "Website at komunidad",
    items: [
      { key: "proyekto", label: "Proyekto" },
      { key: "mapa", label: "Mapa" },
      { key: "events", label: "Events" },
      { key: "polls", label: "Botohan" },
      { key: "purok", label: "Purok Points" },
      { key: "report", label: "Report" },
      { key: "settings", label: "Settings" },
    ],
  },
];
