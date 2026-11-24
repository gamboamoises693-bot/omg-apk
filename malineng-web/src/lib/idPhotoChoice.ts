/** The photo printed on the Barangay ID: the approved ID photo when there is one, otherwise the original selfie. */
export function photoForId(data: { selfie?: string; idPhoto?: string; idPhotoStatus?: string } | undefined | null): string {
  if (!data) return "";
  if (data.idPhoto && data.idPhotoStatus === "approved") return data.idPhoto;
  return data.selfie ?? "";
}
