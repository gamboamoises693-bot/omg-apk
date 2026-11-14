"use client";

import { Suspense, useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { doc, getDoc, serverTimestamp, setDoc } from "firebase/firestore";
import { Camera, ScanLine } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { logActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import { maskName } from "@/lib/raffle";
import { LoginGate } from "@/components/LoginGate";
import { Button, Input, PageHeader, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";

interface Winner {
  uid: string;
  code: string;
  name: string;
  purok: string;
  prize: string;
}
interface RoundDoc {
  round: number;
  winners: Winner[];
}
interface ClaimDoc {
  claimedByName: string;
  claimedAt?: { toDate: () => Date };
}

type Result =
  | { kind: "none" }
  | { kind: "invalid" }
  | { kind: "ok"; round: number; roundName: string; winner: Winner; claim: ClaimDoc | null };

/** Admin scans the winner's QR with the phone camera (it opens this page) or with the scanner below. */
function Verify() {
  const params = useSearchParams();
  const router = useRouter();
  const { user, profile, isAdmin } = useAuth();
  const toast = useToast();
  const round = Number(params.get("r") ?? "0");
  const code = (params.get("c") ?? "").toUpperCase();
  const [result, setResult] = useState<Result>({ kind: "none" });
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [manualRound, setManualRound] = useState("");
  const [manualCode, setManualCode] = useState("");
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState("");
  const video = useRef<HTMLVideoElement>(null);

  // Look the code up in the private round (admins only).
  useEffect(() => {
    if (!isAdmin || !round || !code) {
      setResult({ kind: "none" });
      return;
    }
    let live = true;
    setLoading(true);
    (async () => {
      try {
        const [rd, claim, pub] = await Promise.all([
          getDoc(doc(db, "raffleRounds", String(round))),
          getDoc(doc(db, "raffleClaims", `${round}_${code}`)),
          getDoc(doc(db, "rafflePublicRounds", String(round))),
        ]);
        if (!live) return;
        const w = rd.exists() ? (rd.data() as RoundDoc).winners.find((x) => x.code === code) : undefined;
        if (!w) setResult({ kind: "invalid" });
        else setResult({ kind: "ok", round, roundName: pub.exists() ? String(pub.data().name ?? `Round ${round}`) : `Round ${round}`, winner: w, claim: claim.exists() ? (claim.data() as ClaimDoc) : null });
      } catch {
        if (live) setResult({ kind: "invalid" });
      } finally {
        if (live) setLoading(false);
      }
    })();
    return () => {
      live = false;
    };
  }, [isAdmin, round, code]);

  const go = useCallback((r: string | number, c: string) => router.push(`/raffle/verify/?r=${encodeURIComponent(String(r))}&c=${encodeURIComponent(c.toUpperCase())}`), [router]);

  // Camera scanner (Chrome on Android supports BarcodeDetector; otherwise use the phone's own camera app).
  useEffect(() => {
    if (!scanning) return;
    const Detector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => { detect: (v: HTMLVideoElement) => Promise<{ rawValue: string }[]> } }).BarcodeDetector;
    if (!Detector) {
      setScanError("Hindi sinusuportahan ng browser na ito ang scanner. Gamitin ang camera ng phone, o i-type ang code sa ibaba.");
      setScanning(false);
      return;
    }
    let stop = false;
    let stream: MediaStream | null = null;
    const detector = new Detector({ formats: ["qr_code"] });
    (async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
        if (video.current) {
          video.current.srcObject = stream;
          await video.current.play();
        }
        const tick = async () => {
          if (stop || !video.current) return;
          try {
            const found = await detector.detect(video.current);
            const raw = found[0]?.rawValue;
            if (raw) {
              const u = new URL(raw);
              const r = u.searchParams.get("r");
              const c = u.searchParams.get("c");
              if (r && c) {
                setScanning(false);
                go(r, c);
                return;
              }
            }
          } catch {
            /* keep scanning */
          }
          setTimeout(tick, 300);
        };
        tick();
      } catch {
        setScanError("Hindi mabuksan ang camera. Payagan ang camera sa browser, o i-type ang code sa ibaba.");
        setScanning(false);
      }
    })();
    return () => {
      stop = true;
      stream?.getTracks().forEach((t) => t.stop());
    };
  }, [scanning, go]);

  const give = async () => {
    if (!user || !profile || result.kind !== "ok") return;
    setBusy(true);
    try {
      await setDoc(doc(db, "raffleClaims", `${result.round}_${result.winner.code}`), {
        round: result.round,
        code: result.winner.code,
        claimedBy: user.uid,
        claimedByName: profile.fullName,
        claimedAt: serverTimestamp(),
      });
      logActivity("Raffle", `Naibigay ang premyo (round ${result.round}): ${maskName(result.winner.name)} · ${result.winner.prize}`);
      toast("Naitala: naibigay ang premyo.");
      setResult({ ...result, claim: { claimedByName: profile.fullName } });
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };

  if (!isAdmin) {
    return (
      <div className="space-y-3">
        <p className="rounded-2xl bg-white p-4 text-center text-sm text-gray-700 shadow-card">Para sa mga admin ang pahinang ito. Kung ikaw ang nanalo, ipakita ang QR mo sa admin ng Barangay Hall.</p>
        <Link href="/raffle" className="block rounded-xl bg-brand py-2.5 text-center text-sm font-bold text-white">Bumalik sa Raffle</Link>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <p className="rounded-2xl bg-brand-deep p-3 text-sm text-white">I-scan ang <b className="text-gold">QR ng nanalo</b>. Titingnan ng app ang pribadong resulta ng raffle. Ihambing ang pangalan at mukha sa <b>valid ID</b> bago ibigay ang premyo.</p>

      {loading && <Spinner />}
      {!loading && result.kind === "ok" && (
        result.claim ? (
          <div className="rounded-2xl bg-red-50 p-4 text-red-800">
            <p className="font-extrabold">Nakuha na ang premyong ito.</p>
            <p className="text-sm">Naibigay ni {result.claim.claimedByName}{result.claim.claimedAt ? ` noong ${result.claim.claimedAt.toDate().toLocaleString("fil-PH")}` : ""}. Huwag ibigay ulit.</p>
            <p className="mt-2 text-sm">{result.winner.name} · {result.winner.prize}</p>
          </div>
        ) : (
          <div className="space-y-3 rounded-2xl bg-green-50 p-4 text-green-900">
            <p className="text-lg font-extrabold">✓ Totoong nanalo</p>
            <div>
              <p className="text-xl font-black">{result.winner.name}</p>
              <p className="text-sm">{result.winner.purok || "Malineng"} · Entry {result.winner.code}</p>
            </div>
            <div className="grid grid-cols-2 gap-2 text-center">
              <div className="rounded-xl bg-white p-2"><b className="block">{result.roundName}</b><span className="text-xs text-gray-500">Round {result.round}</span></div>
              <div className="rounded-xl bg-white p-2"><b className="block">{result.winner.prize}</b><span className="text-xs text-gray-500">Premyo</span></div>
            </div>
            <p className="text-sm">Hingin ang valid ID at ihambing ang pangalan at mukha.</p>
            <Button full loading={busy} onClick={give}>Ibigay na ang premyo</Button>
          </div>
        )
      )}
      {!loading && result.kind === "invalid" && (
        <div className="rounded-2xl bg-red-50 p-4 text-red-800">
          <p className="font-extrabold">✕ Hindi nanalo ang QR na ito.</p>
          <p className="text-sm">Wala ito sa listahan ng mga mananalo, o mali ang code. Huwag ibigay ang premyo.</p>
        </div>
      )}

      {scanning ? (
        <div className="space-y-2">
          <video ref={video} className="w-full rounded-2xl bg-black" playsInline muted />
          <Button variant="outline" full onClick={() => setScanning(false)}>Itigil ang scanner</Button>
        </div>
      ) : (
        <Button full onClick={() => { setScanError(""); setScanning(true); }}>
          <Camera className="h-5 w-5" aria-hidden /> I-scan ang QR
        </Button>
      )}
      {scanError && <p className="rounded-xl bg-yellow-50 p-2.5 text-sm text-yellow-900">{scanError}</p>}

      <form
        className="space-y-2 rounded-2xl bg-white p-3 shadow-card"
        onSubmit={(e) => {
          e.preventDefault();
          if (manualRound && manualCode.trim()) go(manualRound, manualCode.trim());
        }}
      >
        <p className="flex items-center gap-1.5 text-sm font-bold"><ScanLine className="h-4 w-4" aria-hidden /> O i-type ang code</p>
        <div className="grid grid-cols-3 gap-2">
          <Input label="Round" type="number" inputMode="numeric" min={1} value={manualRound} onChange={(e) => setManualRound(e.target.value)} />
          <div className="col-span-2"><Input label="Entry code" value={manualCode} onChange={(e) => setManualCode(e.target.value.toUpperCase())} maxLength={8} /></div>
        </div>
        <Button type="submit" variant="outline" full>I-check</Button>
      </form>
    </div>
  );
}

export default function VerifyPage() {
  return (
    <div>
      <PageHeader title="I-verify ang nanalo" subtitle="Para sa admin" />
      <LoginGate message="Mag-login bilang admin para i-verify ang nanalo.">
        <Suspense fallback={<Spinner />}>
          <Verify />
        </Suspense>
      </LoginGate>
    </div>
  );
}
