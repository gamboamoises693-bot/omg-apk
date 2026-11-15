// What each guide says and what to press. One entry per guide.
//   ring   : the thing to circle in the picture (a Playwright selector)
//   before : actions run before the picture is taken (to get to the screen)
//   after  : actions run after the picture (to move on to the next step)
// Every text is Tagalog (tl) and English (en). The pictures are always taken from the Tagalog app.
const go = (path) => ({ goto: path });
const click = (sel) => ({ click: sel });

export const GUIDES = [
  {
    id: "home", routes: ["/"], group: "Simula",
    title: { tl: "Paano gamitin ang app", en: "How to use the app" },
    steps: [
      { before: [go("/")], ring: '[aria-label="Buksan ang menu ng serbisyo"]', after: [click('[aria-label="Buksan ang menu ng serbisyo"]')],
        tl: "Pindutin ang menu sa kaliwang taas para makita ang lahat ng serbisyo ng Barangay.", en: "Tap the menu at the top left to see every service of the Barangay." },
      { ring: 'nav a:has-text("Ambulansya")', after: [{ press: "Escape" }],
        tl: "Piliin ang serbisyong kailangan mo, halimbawa Ambulansya, Appointment o Reklamo.", en: "Choose the service you need, for example Ambulance, Appointment or Complaints." },
      { ring: 'a:visible:has-text("SOS")',
        tl: "Sa emergency, pindutin ang pulang SOS sa gitna para tumawag agad.", en: "In an emergency, tap the red SOS in the middle to call right away." },
      { ring: 'a:visible:has-text("Account")',
        tl: "Sa Account makikita ang profile mo, ang Barangay ID mo, at ang pag-verify ng account.", en: "In Account you will find your profile, your Barangay ID, and account verification." },
    ],
  },
  {
    id: "ambulansya", routes: ["/ambulansya"], group: "Emergency at kalusugan",
    title: { tl: "Paano mag-request ng ambulansya", en: "How to request an ambulance" },
    steps: [
      { before: [go("/ambulansya/")], ring: 'a:has-text("TUMAWAG AGAD")',
        tl: "Kung emergency, tumawag muna sa numerong ito para mas mabilis ang sagot.", en: "In an emergency, call this number first so you get an answer faster." },
      { ring: 'button:has-text("Mag-request ng Emergency")', after: [click('button:has-text("Mag-request ng Emergency")')],
        tl: "Pindutin ang Mag-request ng Emergency kung kailangan agad ng ambulansya.", en: "Tap Request an Emergency if you need the ambulance right away." },
      { ring: 'label:has-text("Pangalan ng pasyente")',
        tl: "Isulat ang pangalan ng pasyente, ang nangyari, at kung saan siya susunduin.", en: "Write the patient's name, what happened, and where to pick them up." },
      { ring: 'button:has-text("Ipadala ang Emergency Request")', after: [click('button[aria-label="Isara"]')],
        tl: "Pindutin ang Ipadala. Makikita mo ang status ng request sa MGA REQUEST KO.", en: "Tap Send. You can follow the request under MY REQUESTS." },
      { ring: 'button:has-text("Mag-schedule")',
        tl: "Hindi emergency (halimbawa dialysis o check-up)? Pindutin ang Mag-schedule at pumili ng petsa at oras.", en: "Not an emergency (for example dialysis or a check-up)? Tap Schedule and pick a date and time." },
    ],
  },
  {
    id: "appointment", routes: ["/appointment"], group: "Dokumento at tulong",
    title: { tl: "Paano mag-book ng appointment", en: "How to book an appointment" },
    steps: [
      { before: [go("/appointment/")], ring: 'label:has-text("Serbisyo")',
        tl: "Piliin ang serbisyo, halimbawa Barangay Clearance.", en: "Choose the service, for example Barangay Clearance." },
      { ring: 'label:has-text("Petsa ng Pagkuha")',
        tl: "Pumili ng petsa ng pagkuha. Lunes hanggang Biyernes lang.", en: "Pick the date you will pick it up. Monday to Friday only." },
      { ring: 'button:has-text("I-book ang Appointment")',
        tl: "Pindutin ang I-book ang Appointment. Dalhin ang valid ID sa Barangay Hall sa napiling petsa.", en: "Tap Book Appointment. Bring a valid ID to the Barangay Hall on that date." },
      { ring: 'h2:has-text("TRACKING")',
        tl: "Sa TRACKING makikita mo kung handa na ang dokumento mo.", en: "Under TRACKING you can see when your document is ready." },
    ],
  },
  {
    id: "barangay-id", routes: ["/barangay-id"], group: "Dokumento at tulong",
    title: { tl: "Ang Barangay ID mo", en: "Your Barangay ID" },
    steps: [
      { before: [go("/barangay-id/")], ring: "text=JUAN DELA CRUZ",
        tl: "Lalabas dito ang Barangay ID mo kapag verified na ang account mo. May QR code ito na ini-scan ng Barangay.", en: "Your Barangay ID shows here once your account is verified. It has a QR code the Barangay can scan." },
      { ring: 'button:has-text("I-print")',
        tl: "Pindutin ang I-print o i-save bilang PDF para may kopya ka.", en: "Tap Print or save as PDF to keep a copy." },
    ],
  },
  {
    id: "reklamo", routes: ["/reklamo"], group: "Dokumento at tulong",
    title: { tl: "Paano mag-file ng reklamo", en: "How to file a complaint" },
    steps: [
      { before: [go("/reklamo/")], ring: 'button:has-text("Mag-file ng reklamo")', after: [click('button:has-text("Mag-file ng reklamo")')],
        tl: "Pindutin ang Mag-file ng reklamo.", en: "Tap File a complaint." },
      { ring: 'label:has-text("Uri ng reklamo")',
        tl: "Piliin ang uri ng reklamo, halimbawa ingay o alitan.", en: "Choose the kind of complaint, for example noise or a dispute." },
      { ring: 'label:has-text("Ano ang nangyari")',
        tl: "Ikuwento ang nangyari: kailan, saan, at sino ang kasali.", en: "Tell what happened: when, where, and who was involved." },
      { ring: 'button:has-text("Ipadala sa Barangay")',
        tl: "Pindutin ang Ipadala sa Barangay. Pribado ang reklamo mo.", en: "Tap Send to the Barangay. Your complaint is private." },
    ],
  },
  {
    id: "chat", routes: ["/chat"], group: "Komunidad",
    title: { tl: "Paano gamitin ang Chat", en: "How to use Chat" },
    steps: [
      { before: [go("/chat/")], ring: 'a:has-text("Buong Barangay")', after: [click('a:has-text("Buong Barangay")')],
        tl: "Piliin ang room: Buong Barangay, o ang Purok mo.", en: "Pick a room: the whole Barangay, or your own Purok." },
      { ring: 'input[placeholder*="Mag-type"]',
        tl: "I-type ang mensahe mo. Magalang na usapan lang po.", en: "Type your message. Please keep it respectful." },
      { ring: 'button[aria-label="Ipadala"]', after: [go("/chat/")],
        tl: "Pindutin ang Ipadala. Nabubura ang mga mensahe pagkatapos ng 7 araw.", en: "Tap Send. Messages are deleted after 7 days." },
      { ring: 'a:has-text("Kausapin ang Developer")',
        tl: "May tanong o problema sa app? Pindutin ito para sa pribadong chat sa Developer.", en: "Have a question or a problem with the app? Tap this for a private chat with the Developer." },
    ],
  },
  {
    id: "raffle", routes: ["/raffle"], group: "Komunidad",
    title: { tl: "Paano sumali sa raffle", en: "How to join the raffle" },
    steps: [
      { before: [go("/raffle/")], ring: "text=Ang entry code mo",
        tl: "Kapag verified ang account mo, may entry code ka na sa raffle. Wala ka nang ibang gagawin.", en: "Once your account is verified you get a raffle entry code. There is nothing else to do." },
      { ring: 'button:has-text("Magdonate")',
        tl: "Gusto mong magbigay? Pindutin ang Magdonate o maging sponsor. Tatawagan ka ng Barangay.", en: "Want to give? Tap Donate or become a sponsor. The Barangay will call you." },
      { ring: 'h2:has-text("Paano ito gumagana")',
        tl: "Basahin dito ang buong paliwanag ng raffle.", en: "Read the full explanation of the raffle here." },
    ],
  },
  {
    id: "tindahan", routes: ["/tindahan", "/tindahan/magbenta"], group: "Negosyo at trabaho",
    title: { tl: "Paano bumili at magbenta sa Tindahan", en: "How to buy and sell in the Shop" },
    steps: [
      { before: [go("/tindahan/")], ring: 'input[placeholder*="Hanapin"]',
        tl: "Maghanap ng paninda dito, o pumili ng category sa ibaba.", en: "Search for items here, or pick a category below." },
      { ring: 'a:has-text("Magbenta")', after: [click('a:has-text("Magbenta")')],
        tl: "Gusto mong magbenta? Pindutin ang Magbenta (Libre!).", en: "Want to sell? Tap Sell (Free!)." },
      { ring: 'button:has-text("Pindutin para pumili")',
        tl: "Magdagdag ng larawan ng paninda mo.", en: "Add a photo of your item." },
      { ring: 'label:has-text("Pangalan ng Paninda")',
        tl: "Isulat ang pangalan, presyo at maikling paglalarawan.", en: "Write the name, the price and a short description." },
      { ring: 'button:has-text("I-post ang Paninda")',
        tl: "Pindutin ang I-post. Susuriin muna ito ng Barangay bago lumabas.", en: "Tap Post. The Barangay checks it before it appears." },
    ],
  },
  {
    id: "hiraman", routes: ["/hiraman", "/hiraman/hiram"], group: "Dokumento at tulong",
    title: { tl: "Paano humiram ng gamit", en: "How to borrow equipment" },
    steps: [
      { before: [go("/hiraman/")], ring: 'a:has-text("Hiramin")', after: [click('a:has-text("Hiramin")')],
        tl: "Pindutin ang Hiramin sa gamit na kailangan mo, halimbawa tent o upuan.", en: "Tap Borrow on the item you need, for example a tent or chairs." },
      { ring: 'label:has-text("Kukunin")',
        tl: "Piliin ang petsa ng kuha at ng balik.", en: "Pick the pick-up date and the return date." },
      { ring: 'button[aria-label^="Dagdagan"]',
        tl: "Piliin ang dami ng hihiramin.", en: "Choose how many you will borrow." },
      { ring: 'button:has-text("Ipadala ang request")',
        tl: "Pindutin ang Ipadala ang request. Aaprubahan ito ng mga opisyal.", en: "Tap Send request. The officials will approve it." },
    ],
  },
  {
    id: "ayuda", routes: ["/ayuda"], group: "Dokumento at tulong",
    title: { tl: "Paano i-check ang ayuda", en: "How to check your aid" },
    steps: [
      { before: [go("/ayuda/")], ring: 'input[placeholder*="Juan"]',
        tl: "Isulat ang pangalan mo o ang control number.", en: "Type your name or your control number." },
      { ring: 'button:has-text("I-check")',
        tl: "Pindutin ang I-check para makita kung kasama ka sa listahan.", en: "Tap Check to see if you are on the list." },
    ],
  },
  {
    id: "register", as: "guest", routes: ["/register"], group: "Simula",
    title: { tl: "Paano mag-register", en: "How to register" },
    steps: [
      { before: [go("/register/")], ring: 'label:has-text("Buong Pangalan")',
        tl: "Isulat ang buong pangalan mo, ang purok at ang contact number.", en: "Write your full name, your purok and your contact number." },
      { ring: 'label:has-text("Email")',
        tl: "Ilagay ang email at password (hindi bababa sa 8 characters).", en: "Enter your email and a password (at least 8 characters)." },
      { ring: 'button:has-text("Gumawa ng Account")',
        tl: "Pindutin ang Gumawa ng Account. Buksan ang email mo at i-click ang link para ma-confirm.", en: "Tap Create Account. Open your email and click the link to confirm." },
      { ring: 'button:has-text("Mag-login gamit ang Google")',
        tl: "Pwede ring Google ang gamitin kung wala kang gustong tandaang password.", en: "You can also use Google if you do not want to remember a password." },
    ],
  },
  {
    id: "verify", as: "newbie", routes: ["/verify"], group: "Simula",
    title: { tl: "Paano i-verify ang account", en: "How to verify your account" },
    steps: [
      { before: [go("/account/")], ring: 'a:has-text("Mag-selfie para ma-verify")', after: [click('a:has-text("Mag-selfie para ma-verify")')],
        tl: "Sa Account, pindutin ang Mag-selfie para ma-verify.", en: "In Account, tap Take a selfie to verify." },
      { ring: 'label:has-text("Pumapayag")',
        tl: "Basahin at lagyan ng check ang pahintulot na gamitin ng Barangay ang selfie mo.", en: "Read and tick the permission for the Barangay to use your selfie." },
      { ring: 'button:has-text("Buksan ang camera")',
        tl: "Pindutin ang Buksan ang camera at mag-selfie (walang shades o mask). Hintayin ang approval ng Barangay.", en: "Tap Open camera and take a selfie (no sunglasses or mask). Wait for the Barangay to approve." },
    ],
  },
  {
    id: "account", routes: ["/account"], group: "Simula",
    title: { tl: "Ang Account mo", en: "Your Account" },
    steps: [
      { before: [go("/account/")], ring: 'h2:has-text("PROFILE KO")',
        tl: "Dito mo mababago ang pangalan, purok, contact number at birthday mo.", en: "Here you can change your name, purok, contact number and birthday." },
      { ring: 'button:has-text("I-save ang Profile")',
        tl: "Pindutin ang I-save ang Profile pagkatapos magpalit.", en: "Tap Save Profile after you change something." },
      { ring: 'h2:has-text("WIKA")',
        tl: "Piliin ang wika (TL o EN) at ang laki ng text (Aa) para mas madaling basahin.", en: "Choose the language (TL or EN) and the text size (Aa) so it is easier to read." },
      { ring: 'button:has-text("Mag-logout")',
        tl: "Pindutin ang Mag-logout kapag tapos ka na, lalo na sa hiniram na phone.", en: "Tap Log out when you are done, especially on a borrowed phone." },
    ],
  },
];
