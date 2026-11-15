# Mga gabay ("Paano gamitin")

Ang button na **Paano gamitin** sa bawat page ay nagbubukas ng hakbang-hakbang na gabay. Ang mga larawan ay kuha mismo sa app
(may pulang bilog sa pipindutin), hindi drawing.

## Paano magdagdag o magbago ng gabay
1. Buksan ang `spec.mjs` at dagdagan ang listahan: `id`, `routes` (mga page na may button), `group`, pamagat at mga hakbang
   (`ring` = ang bilugan, `before` / `after` = ang mga pindot para makarating sa screen). Tagalog at English ang bawat teksto.
2. Patakbuhin: `scripts/guides/run.sh` (o `scripts/guides/run.sh ambulansya chat` para ang piling gabay lang).
3. I-commit ang `public/guides/*.jpg` at `src/data/guides.json` na nabuo.

## Ano ang ginagawa ng script
- Gumagawa ng kopya ng app na kumakausap sa **local emulators** lang (`NEXT_PUBLIC_USE_EMULATORS=1`), hindi sa totoong Firebase.
- Naglalagay ng sample na residente ("Juan Dela Cruz") at sample na data, kaya walang totoong tao sa mga larawan.
- Nagbubukas ng phone-sized na browser (Playwright), kumukuha ng larawan sa bawat hakbang, at sumusulat ng `src/data/guides.json`.

Kailangan: node, `npx firebase-tools`, at Playwright na may Chromium (`npm i -g playwright`).
Kapag nagbago ang itsura ng app, i-run ulit ang script para sumunod ang mga larawan.
