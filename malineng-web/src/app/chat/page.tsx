"use client";

import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  Timestamp,
  where,
} from "firebase/firestore";
import { Copy, Flag, Video, ImagePlus, MoreHorizontal, Pin, PinOff, Send, Trash2, VolumeX, X } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { useSettings } from "@/lib/useSettings";
import { compressToDataUrl } from "@/lib/upload";
import { friendlyError } from "@/lib/format";
import { logActivity } from "@/lib/activity";
import {
  MAX_TEXT,
  MESSAGE_LIMIT,
  MUTE_OPTIONS,
  OWN_DELETE_MINUTES,
  REPORT_REASONS,
  ROOM_ALL,
  ROOM_STAFF_ADMIN,
  callUrl,
  newCallMessage,
  parseCall,
  ROOM_STAFF_OFFICIALS,
  isStaffRoom,
  cutoffTimestamp,
  dayLabel,
  getLastRead,
  roomTitle,
  setLastRead,
  timeLabel,
  type ChatMessage,
  type ChatSettings,
} from "@/lib/chat";
import { Avatar } from "@/components/Avatar";
import { Button, ErrorText, Modal, PageHeader, Spinner } from "@/components/ui";
import { RequireVerified } from "@/components/RequireVerified";

const ROLE_STYLE: Record<string, string> = { Kapitan: "bg-amber-700", Secretary: "bg-teal-700", "Super Admin": "bg-purple-700" };
/** Stored as "Super Admin" (the database rules check it); shown as "Developer". */
const roleText = (role: string) => (role === "Super Admin" ? "Developer" : role);

/* ------------------------------ Room list ------------------------------ */

function RoomRow({ room }: { room: string }) {
  const q = useMemo(
    () => query(collection(db, "chatRooms", room, "messages"), where("createdAt", ">=", cutoffTimestamp()), orderBy("createdAt", "desc"), limit(1)),
    [room],
  );
  const { data } = useCollection<ChatMessage>(q);
  const last = data[0];
  const fresh = !!last?.createdAt && last.createdAt.toMillis() > getLastRead(room);
  const staff = isStaffRoom(room);
  const initial = staff ? (room === ROOM_STAFF_OFFICIALS ? "★" : "🛡") : room === ROOM_ALL ? "🏘" : room.replace(/\D+/g, "") || room[0];

  return (
    <Link href={`/chat/?room=${encodeURIComponent(room)}`} className="flex items-center gap-3 border-b border-gray-100 px-3 py-3 last:border-0 active:bg-gray-50">
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-base font-extrabold text-white ${staff ? "bg-brand-deep" : room === ROOM_ALL ? "bg-brand" : "bg-teal-600"}`}>{initial}</span>
      <span className="min-w-0 flex-1">
        <span className="block font-bold">{roomTitle(room)}</span>
        <span className="block truncate text-xs text-gray-500">
          {last ? `${last.authorName.split(" ")[0]}: ${last.text && parseCall(last.text) ? "📹 Video call" : last.text || "📷 Larawan"}` : "Walang mensahe pa"}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-[0.68rem] text-gray-500">{last ? timeLabel(last.createdAt) : ""}</span>
        {fresh && <span className="rounded-full bg-red-600 px-2 py-0.5 text-[0.65rem] font-black text-white">Bago</span>}
      </span>
    </Link>
  );
}

function RoomList() {
  const { profile, isStaff, isAdmin } = useAuth();
  const { settings } = useSettings();
  // Private staff rooms come first. Officials = admins without BHW (and the Developer).
  const staffRooms = [...(isStaff ? [ROOM_STAFF_ADMIN] : []), ...(isAdmin ? [ROOM_STAFF_OFFICIALS] : [])];
  const rooms = [ROOM_ALL, ...(isStaff ? settings.puroks : profile?.purok ? [profile.purok] : [])];
  return (
    <div className="space-y-3">
      <PageHeader title="Chat ng Barangay" subtitle="Verified na residente lang" />
      <p className="rounded-xl bg-brand-light px-3 py-2 text-xs text-brand-deep">Magalang na usapan lang po. Ang mga mensahe ay nabubura pagkatapos ng <b>7 araw</b>.</p>
      {staffRooms.length > 0 && (
        <>
          <p className="px-1 text-xs font-bold tracking-wide text-gray-600">PRIBADO · PARA SA STAFF LANG</p>
          <div className="overflow-hidden rounded-2xl bg-white shadow-card">
            {staffRooms.map((r) => (
              <RoomRow key={r} room={r} />
            ))}
          </div>
        </>
      )}
      <p className="px-1 text-xs font-bold tracking-wide text-gray-600">MGA CHAT ROOM</p>
      <div className="overflow-hidden rounded-2xl bg-white shadow-card">
        {rooms.map((r) => (
          <RoomRow key={r} room={r} />
        ))}
      </div>
      <p className="text-xs text-gray-600">
        {isStaff ? "Bilang opisyal, nababasa mo ang lahat ng room." : "Mababasa mo ang Buong Barangay at ang Purok mo. Ang ibang Purok ay para sa mga taga-roon lang."}
      </p>
      {!isStaff && !profile?.purok && <p className="rounded-xl bg-gold-light px-3 py-2 text-xs text-yellow-900">Wala pang Purok sa profile mo. Ilagay ito sa Account para makita ang chat ng Purok mo.</p>}
    </div>
  );
}

/* ------------------------------- Conversation ------------------------------- */

function Conversation({ room }: { room: string }) {
  const { user, profile, isOfficer, isAdmin, isSuperAdmin } = useAuth();
  const [pin, setPin] = useState<{ pinText: string; pinBy: string } | null>(null);
  const [muteUntil, setMuteUntil] = useState<number>(0);
  const [chat, setChat] = useState<ChatSettings>({ enabled: true, photos: true });
  const [text, setText] = useState("");
  const [photo, setPhoto] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [picked, setPicked] = useState<ChatMessage | null>(null);
  const [mode, setMode] = useState<"menu" | "report" | "mute">("menu");
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [notice, setNotice] = useState("");
  const lastSent = useRef(0);
  const bottom = useRef<HTMLDivElement>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const q = useMemo(
    () => query(collection(db, "chatRooms", room, "messages"), where("createdAt", ">=", cutoffTimestamp()), orderBy("createdAt", "desc"), limit(MESSAGE_LIMIT)),
    [room],
  );
  const { data, loading, error: loadError } = useCollection<ChatMessage>(q);
  const messages = useMemo(() => [...data].reverse(), [data]);

  useEffect(() => onSnapshot(doc(db, "chatRooms", room), (s) => setPin(s.exists() ? (s.data() as { pinText: string; pinBy: string }) : null), () => setPin(null)), [room]);
  useEffect(() => onSnapshot(doc(db, "settings", "chat"), (s) => s.exists() && setChat({ enabled: s.data().enabled !== false, photos: s.data().photos !== false }), () => {}), []);
  useEffect(() => {
    if (!user) return;
    return onSnapshot(doc(db, "chatMutes", user.uid), (s) => setMuteUntil(s.exists() ? ((s.data().until as Timestamp)?.toMillis() ?? 0) : 0), () => setMuteUntil(0));
  }, [user]);

  // Scroll to the newest message and remember that this room was read.
  useEffect(() => {
    bottom.current?.scrollIntoView({ block: "end" });
    const newest = messages[messages.length - 1]?.createdAt;
    if (newest) setLastRead(room, newest.toMillis());
  }, [messages, room]);

  const muted = muteUntil > Date.now();

  async function pickPhoto(file?: File) {
    if (!file) return;
    setError("");
    try {
      setPhoto(await compressToDataUrl(file, 800, 0.7, 150_000));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  }

  // Officers and the Developer can start a video call in the private staff rooms.
  const canStartCall = isOfficer && isStaffRoom(room);

  async function send(callMessage?: string) {
    if (!user || !profile) return;
    const body = callMessage ?? text.trim();
    if (!body && !photo) return;
    if (Date.now() - lastSent.current < 2000) {
      setError("Dahan-dahan po. Maghintay ng ilang segundo.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const role = isSuperAdmin ? "Super Admin" : isAdmin ? (profile.position ?? "") : "";
      await addDoc(collection(db, "chatRooms", room, "messages"), {
        text: body,
        photo: callMessage ? "" : photo,
        authorId: user.uid,
        authorName: profile.fullName,
        authorRole: role,
        createdAt: serverTimestamp(),
      });
      lastSent.current = Date.now();
      if (!callMessage) {
        setText("");
        setPhoto("");
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  function closeSheet() {
    setPicked(null);
    setMode("menu");
    setNotice("");
  }

  async function run(action: () => Promise<void>, done: string) {
    setError("");
    try {
      await action();
      setNotice(done);
      setTimeout(closeSheet, 900);
    } catch (err) {
      setError(friendlyError(err));
    }
  }

  const mine = (m: ChatMessage) => m.authorId === user?.uid;
  const withinOwnWindow = (m: ChatMessage) => !!m.createdAt && Date.now() - m.createdAt.toMillis() < OWN_DELETE_MINUTES * 60_000;

  let lastDay = "";
  return (
    <div className="flex min-h-[calc(100dvh-13rem)] flex-col">
      <PageHeader title={roomTitle(room)} subtitle={isStaffRoom(room) ? "Pribado · staff lang" : "Verified na residente lang"} />

      {pin?.pinText && (
        <div className="mb-3 flex items-start gap-2 rounded-xl bg-yellow-100 px-3 py-2 text-xs text-yellow-900">
          <Pin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden />
          <span className="min-w-0 flex-1"><b>Naka-pin:</b> {pin.pinText}</span>
          {isOfficer && (
            <button type="button" aria-label="Alisin ang pin" onClick={() => setDoc(doc(db, "chatRooms", room), { pinText: "", pinBy: "", pinAt: new Date().toISOString() }).catch((e) => setError(friendlyError(e)))}>
              <PinOff className="h-4 w-4" />
            </button>
          )}
        </div>
      )}

      <div className="flex-1 space-y-2.5">
        {loading ? (
          <Spinner />
        ) : loadError ? (
          <ErrorText>{loadError}</ErrorText>
        ) : messages.length === 0 ? (
          <p className="rounded-2xl bg-white p-6 text-center text-sm text-gray-600 shadow-card">Wala pang mensahe. Mauna ka na! 👋</p>
        ) : (
          messages.map((m) => {
            const day = dayLabel(m.createdAt);
            const showDay = day !== lastDay;
            lastDay = day;
            const me = mine(m);
            return (
              <div key={m.id}>
                {showDay && <p className="mx-auto my-1 w-fit rounded-full bg-gray-200 px-3 py-0.5 text-[0.7rem] text-gray-600">{day}</p>}
                <div className={`flex items-end gap-2 ${me ? "justify-end" : ""}`}>
                  {!me && <Avatar name={m.authorName} size="h-8 w-8" textClass="text-xs" />}
                  <div className={`max-w-[80%] ${me ? "items-end" : ""}`}>
                    {!me && (
                      <p className="mb-0.5 ml-1 text-[0.7rem] font-bold text-gray-600">
                        {m.authorName}
                        {m.authorRole && <span className={`ml-1.5 rounded-full px-1.5 py-px text-[0.6rem] font-extrabold uppercase text-white ${ROLE_STYLE[m.authorRole] ?? "bg-gray-600"}`}>{roleText(m.authorRole)}</span>}
                      </p>
                    )}
                    <div
                      // Tapping the bubble opens the same action menu as the "..." button (delete, pin, report...).
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("a, button")) return;
                        setPicked(m);
                        setMode("menu");
                        setError("");
                      }}
                      className={`group relative cursor-pointer rounded-2xl px-3 py-2 shadow-sm ${me ? "rounded-br-sm bg-brand text-white" : "rounded-bl-sm bg-white text-gray-900"}`}
                    >
                      {m.text && parseCall(m.text) ? (
                        <div className="space-y-2">
                          <p className="flex items-center gap-1.5 text-[0.95rem] font-bold"><Video className="h-4 w-4" aria-hidden /> Video call</p>
                          <a
                            href={callUrl(parseCall(m.text)!, profile?.fullName ?? "Malineng")}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block rounded-xl bg-gold px-4 py-2 text-center text-sm font-extrabold text-brand-deep active:opacity-80"
                          >
                            Sumali sa call
                          </a>
                        </div>
                      ) : (
                        m.text && <p className="whitespace-pre-wrap break-words text-[0.95rem]">{m.text}</p>
                      )}
                      {m.photo && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={m.photo} alt="Larawan sa chat" loading="lazy" className="mt-1 max-h-64 w-full rounded-lg object-cover" />
                      )}
                      <div className={`mt-0.5 flex items-center justify-end gap-1.5 text-[0.62rem] ${me ? "text-white/75" : "text-gray-400"}`}>
                        {timeLabel(m.createdAt)}
                        <button type="button" aria-label="Mga aksyon sa mensahe" onClick={() => { setPicked(m); setMode("menu"); setError(""); }} className="-mr-1.5 flex h-7 w-8 items-center justify-center rounded-lg bg-black/10 active:bg-black/20">
                          <MoreHorizontal className="h-5 w-5" />
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        )}
        <div ref={bottom} />
      </div>

      {/* Composer */}
      <div className="sticky bottom-[4.4rem] z-20 -mx-4 mt-3 border-t border-gray-200 bg-white px-3 pb-2 pt-2">
        {!chat.enabled ? (
          <p className="rounded-xl bg-gray-100 px-3 py-3 text-center text-sm text-gray-600">Sarado muna ang chat sa ngayon.</p>
        ) : muted ? (
          <p className="rounded-xl bg-red-50 px-3 py-3 text-center text-sm font-semibold text-red-800">
            Naka-mute ka hanggang {new Date(muteUntil).toLocaleString("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}.
          </p>
        ) : (
          <>
            {photo && (
              <div className="relative mb-2 w-24">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={photo} alt="Ipapadalang larawan" className="h-24 w-24 rounded-xl object-cover" />
                <button type="button" aria-label="Alisin ang larawan" onClick={() => setPhoto("")} className="absolute -right-2 -top-2 rounded-full bg-gray-800 p-1 text-white"><X className="h-3.5 w-3.5" /></button>
              </div>
            )}
            <ErrorText>{error}</ErrorText>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                send();
              }}
              className="flex items-end gap-2"
            >
              {canStartCall && (
                <button
                  type="button"
                  aria-label="Magsimula ng video call"
                  disabled={busy}
                  onClick={() => send(newCallMessage())}
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gold-light text-gold-dark active:opacity-80 disabled:opacity-50"
                >
                  <Video className="h-5 w-5" />
                </button>
              )}
              {chat.photos && (
                <>
                  <input ref={fileInput} type="file" accept="image/*" hidden onChange={(e) => pickPhoto(e.target.files?.[0])} />
                  <button type="button" aria-label="Magdagdag ng larawan" onClick={() => fileInput.current?.click()} className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-light text-brand active:bg-blue-100">
                    <ImagePlus className="h-5 w-5" />
                  </button>
                </>
              )}
              <input
                value={text}
                onChange={(e) => setText(e.target.value.slice(0, MAX_TEXT))}
                placeholder="Mag-type ng mensahe…"
                aria-label="Mensahe"
                maxLength={MAX_TEXT}
                className="min-w-0 flex-1 rounded-full border border-gray-200 bg-gray-50 px-4 py-2.5 outline-none focus:border-brand"
              />
              <button type="submit" disabled={busy || (!text.trim() && !photo)} aria-label="Ipadala" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand text-white disabled:opacity-50 active:bg-brand-dark">
                <Send className="h-[1.1rem] w-[1.1rem]" />
              </button>
            </form>
          </>
        )}
      </div>

      {/* Message actions */}
      <Modal open={!!picked} onClose={closeSheet} title={mode === "report" ? "I-report ang mensahe" : mode === "mute" ? `I-mute si ${picked?.authorName.split(" ")[0]}` : "Mga aksyon"}>
        {picked && (
          <div className="space-y-2">
            <p className="rounded-xl bg-gray-50 px-3 py-2 text-sm text-gray-700">
              <b>{picked.authorName}:</b> {picked.text || "📷 Larawan"}
            </p>
            {notice ? (
              <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-800">{notice}</p>
            ) : mode === "report" ? (
              <>
                <div className="space-y-1.5">
                  {REPORT_REASONS.map((r) => (
                    <label key={r} className="flex items-center gap-2 text-sm">
                      <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-brand" /> {r}
                    </label>
                  ))}
                </div>
                <ErrorText>{error}</ErrorText>
                <div className="grid grid-cols-2 gap-2">
                  <Button variant="outline" onClick={() => setMode("menu")}>Bumalik</Button>
                  <Button
                    onClick={() =>
                      run(
                        () =>
                          setDoc(doc(db, "chatReports", `${picked.id}_${user!.uid}`), {
                            room,
                            messageId: picked.id,
                            messageText: (picked.text || "(larawan)").slice(0, 500),
                            messageAuthorId: picked.authorId,
                            messageAuthorName: picked.authorName,
                            reporterId: user!.uid,
                            reason,
                            status: "open",
                            createdAt: serverTimestamp(),
                          }),
                        "Naipadala ang report. Salamat po!",
                      )
                    }
                  >
                    Ipadala
                  </Button>
                </div>
              </>
            ) : mode === "mute" ? (
              <>
                <div className="grid grid-cols-3 gap-2">
                  {MUTE_OPTIONS.map((o) => (
                    <Button
                      key={o.label}
                      variant="soft"
                      onClick={() =>
                        run(async () => {
                          await setDoc(doc(db, "chatMutes", picked.authorId), { until: Timestamp.fromMillis(Date.now() + o.ms), by: user!.uid, name: picked.authorName, reason: `Mula sa ${roomTitle(room)}` });
                          logActivity("Chat", `Na-mute si ${picked.authorName} ng ${o.label}`, picked.authorId);
                        }, `Na-mute si ${picked.authorName} ng ${o.label}.`)
                      }
                    >
                      {o.label}
                    </Button>
                  ))}
                </div>
                <ErrorText>{error}</ErrorText>
                <Button variant="outline" full onClick={() => setMode("menu")}>Bumalik</Button>
              </>
            ) : (
              <>
                <ErrorText>{error}</ErrorText>
                <Button
                  variant="outline"
                  full
                  onClick={() => {
                    navigator.clipboard?.writeText(picked.text).catch(() => {});
                    closeSheet();
                  }}
                  disabled={!picked.text}
                >
                  <Copy className="h-4 w-4" /> Kopyahin
                </Button>
                {!mine(picked) && (
                  <Button variant="outline" full onClick={() => setMode("report")}>
                    <Flag className="h-4 w-4" /> I-report ang mensahe
                  </Button>
                )}
                {mine(picked) && !withinOwnWindow(picked) && !isOfficer && (
                  <p className="rounded-xl bg-gray-100 px-3 py-2 text-xs text-gray-600">Mabubura mo lang ang sarili mong mensahe sa loob ng {OWN_DELETE_MINUTES} minuto. Pagkatapos nito, ang opisyal na lang ang makakabura.</p>
                )}
                {mine(picked) && withinOwnWindow(picked) && (
                  <Button variant="danger" full onClick={() => run(() => deleteDoc(doc(db, "chatRooms", room, "messages", picked.id)), "Nabura ang mensahe.")}>
                    <Trash2 className="h-4 w-4" /> Burahin ang mensahe ko
                  </Button>
                )}
                {isOfficer && (
                  <div className="space-y-2 border-t border-gray-100 pt-2">
                    <p className="text-[0.7rem] font-bold tracking-wide text-purple-700">PARA SA ADMIN</p>
                    <Button
                      variant="danger"
                      full
                      onClick={() =>
                        run(async () => {
                          await deleteDoc(doc(db, "chatRooms", room, "messages", picked.id));
                          logActivity("Chat", `Binura ang mensahe ni ${picked.authorName} sa ${roomTitle(room)}`, picked.id);
                        }, "Nabura ang mensahe.")
                      }
                    >
                      <Trash2 className="h-4 w-4" /> Burahin ang mensahe
                    </Button>
                    <Button
                      variant="outline"
                      full
                      onClick={() => run(() => setDoc(doc(db, "chatRooms", room), { pinText: (picked.text || "(larawan)").slice(0, 300), pinBy: profile?.fullName ?? "Admin", pinAt: new Date().toISOString() }), "Na-pin sa itaas.")}
                    >
                      <Pin className="h-4 w-4" /> I-pin sa itaas
                    </Button>
                    {!mine(picked) && (
                      <Button variant="outline" full onClick={() => setMode("mute")}>
                        <VolumeX className="h-4 w-4" /> I-mute si {picked.authorName.split(" ")[0]}
                      </Button>
                    )}
                  </div>
                )}
                <Button variant="ghost" full onClick={closeSheet}>Isara</Button>
              </>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}

function ChatInner() {
  const room = useSearchParams().get("room");
  return room ? <Conversation room={room} /> : <RoomList />;
}

export default function ChatPage() {
  return (
    <RequireVerified feature="sumali sa chat ng barangay">
      <Suspense fallback={<Spinner />}>
        <ChatInner />
      </Suspense>
    </RequireVerified>
  );
}
