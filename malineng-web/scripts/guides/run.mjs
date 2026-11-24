// Runs inside `firebase emulators:exec`: adds the sample data, then takes the pictures.
import { execFileSync } from "node:child_process";
import { writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { tmpdir } from "node:os";
import { seed } from "./seed.mjs";

const here = dirname(fileURLToPath(import.meta.url));
// A plain grey placeholder portrait for the sample resident's Barangay ID (a data URL, same format the app stores).
const selfie = join(tmpdir(), "guide-selfie.b64");
writeFileSync(selfie, execFileSync("python3", [join(here, "selfie.py")], { encoding: "utf8" }).trim());
// The same placeholder as a picture file, for the "upload a selfie" step of the register guide.
const selfieFile = join(tmpdir(), "guide-selfie.jpg");
writeFileSync(selfieFile, Buffer.from(execFileSync("python3", [join(here, "selfie.py")], { encoding: "utf8" }).trim().split(",")[1], "base64"));
process.env.GUIDE_SELFIE_FILE = selfieFile;
process.env.GUIDE_UID = await seed(selfie);
execFileSync("node", [join(here, "capture.mjs"), ...process.argv.slice(2)], { stdio: "inherit" });
