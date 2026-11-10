"use client";

import { useEffect, useState, type FormEvent } from "react";
import { collection, doc, getDocs, increment, limit, onSnapshot, orderBy, query, updateDoc, where } from "firebase/firestore";
import { Check, Copy, MapPin, Search, TriangleAlert, Vote } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { friendlyError } from "@/lib/format";
import { MAX_RESULTS, QUERY_LIMIT, normalizeKey, searchKey, type PrecinctMeta, type PrecinctVoter } from "@/lib/presinto";
import { Button, Card, EmptyState, ErrorText, Input, LinkButton, PageHeader, Spinner } from "@/components/ui";
import { LoginGate } from "@/components/LoginGate";

/** Strip the trailing letters: precinct 0123A belongs to clustered precinct 0123. */
function clustered(precinct: string): string {
  return precinct.replace(/[A-Z]+$/, "");
}

function ResultCard({ voter, meta }: { voter: PrecinctVoter; meta: PrecinctMeta }) {
  const [copied, setCopied] = useState(false);
  const place = meta.places?.[voter.precinct] || meta.defaultPlace;
  const active = voter.remarks.toUpperCase() === "ACTIVE";
  const summary = `${voter.name}\nPresinto: ${voter.precinct}${place ? `\nLugar ng botohan: ${place}` : ""}\nBarangay Malineng, Cuyapo`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(summary);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard can be blocked; the details are on screen anyway.
    }
  }

  return (
    <Card className="space-y-3 !rounded-3xl">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
          <Check className="h-6 w-6" aria-hidden />
        </span>
        <div className="min-w-0">
          <p className="text-xs text-gray-600">Nahanap ka sa listahan</p>
          <p className="text-lg font-extrabold leading-tight">{voter.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2.5 rounded-2xl bg-gradient-to-br from-brand to-brand-deep p-3.5 text-white">
        <div>
          <p className="text-[0.7rem] text-white/75">Presinto</p>
          <p className="text-3xl font-extrabold">{voter.precinct}</p>
        </div>
        <div>
          <p className="text-[0.7rem] text-white/75">Clustered Precinct</p>
          <p className="text-3xl font-extrabold">{clustered(voter.precinct)}</p>
        </div>
        {place && (
          <div className="col-span-2">
            <p className="text-[0.7rem] text-white/75">Lugar ng botohan</p>
            <p className="font-extrabold">{place}</p>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-sm">
        <div className="rounded-xl bg-gray-50 px-3 py-2">
          <p className="text-[0.7rem] text-gray-600">Address sa listahan</p>
          <p className="font-bold">{voter.address || "-"}</p>
        </div>
        <div className={`rounded-xl px-3 py-2 ${active ? "bg-emerald-50 text-emerald-800" : "bg-amber-100 text-amber-900"}`}>
          <p className="text-[0.7rem]">Remarks</p>
          <p className="font-bold">{voter.remarks || "-"}</p>
        </div>
      </div>

      {!active && (
        <p className="flex gap-2 rounded-xl bg-amber-100 px-3 py-2 text-xs text-amber-900">
          <TriangleAlert className="h-4 w-4 shrink-0" aria-hidden />
          Hindi “ACTIVE” ang remarks mo. Pumunta sa Barangay Hall o Office of the Election Officer (OEO) para ma-check.
        </p>
      )}

      <div className="grid grid-cols-2 gap-2">
        {place ? (
          <a
            href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${place}, Cuyapo, Nueva Ecija`)}`}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-xl bg-brand px-3 py-3 text-sm font-bold text-white active:bg-brand-dark"
          >
            <MapPin className="h-4 w-4" aria-hidden /> Direksyon
          </a>
        ) : (
          <span />
        )}
        <Button variant="soft" onClick={copy}>
          <Copy className="h-4 w-4" aria-hidden /> {copied ? "Nakopya!" : "Kopyahin"}
        </Button>
      </div>
    </Card>
  );
}

export default function PresintoPage() {
  const { isOfficer } = useAuth();
  const [meta, setMeta] = useState<PrecinctMeta | null>(null);
  const [metaLoading, setMetaLoading] = useState(true);
  const [last, setLast] = useState("");
  const [first, setFirst] = useState("");
  const [area, setArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [results, setResults] = useState<PrecinctVoter[] | null>(null);
  const [picked, setPicked] = useState<PrecinctVoter | null>(null);

  useEffect(
    () =>
      onSnapshot(
        doc(db, "precinctMeta", "current"),
        (snap) => {
          setMeta(snap.exists() ? (snap.data() as PrecinctMeta) : null);
          setMetaLoading(false);
        },
        () => setMetaLoading(false),
      ),
    [],
  );

  async function search(e: FormEvent) {
    e.preventDefault();
    setError("");
    setPicked(null);
    if (normalizeKey(last).length < 2) {
      setError("I-type ang apelyido (kahit 2 letra).");
      return;
    }
    setBusy(true);
    try {
      const key = searchKey(last, first);
      const snap = await getDocs(query(collection(db, "precinctVoters"), where("nameKey", ">=", key), where("nameKey", "<=", `${key}`), orderBy("nameKey"), limit(QUERY_LIMIT)));
      const areaKey = normalizeKey(area);
      let found = snap.docs.map((d) => ({ id: d.id, ...d.data() }) as PrecinctVoter);
      // Typing only "Santos" must not match "Santosa": require a word boundary after the surname.
      const lastKey = normalizeKey(last);
      found = found.filter((v) => v.nameKey === lastKey || v.nameKey.startsWith(`${lastKey} `));
      if (areaKey) found = found.filter((v) => normalizeKey(v.address).includes(areaKey));
      found = found.slice(0, MAX_RESULTS);
      setResults(found);
      if (found.length === 1) setPicked(found[0]);
      // Anonymous counters for the Super Admin dashboard; never blocks the search.
      updateDoc(doc(db, "precinctStats", "current"), { searches: increment(1), ...(found.length ? { found: increment(1) } : { notFound: increment(1) }) }).catch(() => {});
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  const ready = !!meta && meta.count > 0;

  return (
    <div className="space-y-3">
      <PageHeader title="Hanapin ang Presinto" subtitle="Saan ako boboto?" />

      {metaLoading ? (
        <Spinner />
      ) : !ready ? (
        <EmptyState icon={<Vote />} title="Wala pang listahan">
          Ia-upload pa ng Barangay ang listahan ng botante. Balik ka ulit mamaya.
          {isOfficer && (
            <div className="mt-3">
              <LinkButton href="/admin" variant="soft">I-upload sa Admin → Presinto</LinkButton>
            </div>
          )}
        </EmptyState>
      ) : (
        <>
          <div className="rounded-2xl bg-gradient-to-br from-brand to-brand-deep p-4 text-white">
            <p className="text-xs text-white/75">{meta.electionName || "Susunod na halalan"}</p>
            <p className="text-lg font-extrabold">{meta.electionDate || "Abangan ang petsa"}</p>
            <p className="mt-1 text-xs text-white/80">Alamin ang presinto mo bago pumunta. Hindi na kailangang pumila sa listahan sa Barangay Hall.</p>
          </div>

          <LoginGate message="Mag-login para hanapin ang presinto mo.">
            <form onSubmit={search} className="space-y-3 rounded-2xl bg-white p-4 shadow-card">
              <Input label="Apelyido" value={last} onChange={(e) => setLast(e.target.value)} placeholder="hal. Santos" autoComplete="off" required />
              <Input label="Pangalan" value={first} onChange={(e) => setFirst(e.target.value)} placeholder="hal. Maria" autoComplete="off" />
              <Input label="Purok o kalye (optional)" value={area} onChange={(e) => setArea(e.target.value)} placeholder="hal. Mabini" autoComplete="off" hint="Para paliitin ang resulta kung marami ang kapareho mo ng pangalan." />
              <p className="text-xs text-gray-600">Hanggang {MAX_RESULTS} tugma lang ang ipinapakita at hindi mabubuksan ang buong listahan, para protektado ang impormasyon ng mga botante.</p>
              <ErrorText>{error}</ErrorText>
              <Button type="submit" full loading={busy}>
                <Search className="h-4 w-4" aria-hidden /> Hanapin
              </Button>
            </form>

            {results && results.length === 0 && (
              <div className="space-y-3">
                <Card className="text-center">
                  <p className="text-lg font-extrabold">Walang nahanap</p>
                  <p className="text-sm text-gray-600">Walang tugmang pangalan sa listahan.</p>
                </Card>
                <Card className="space-y-1.5 text-sm text-gray-700">
                  <p className="text-xs font-bold tracking-wide text-gray-600">SUBUKAN ITO</p>
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Tingnan ang <b>spelling</b>. Subukan ang buong pangalan: “Maria” sa halip na “Ma.”</li>
                    <li>Kung may dalawang apelyido, subukan ang apelyido ng <b>ama</b>.</li>
                    <li>Subukang <b>apelyido lang</b> o i-type ang <b>Purok</b> para lumawak ang hanap.</li>
                    <li>Kung kapapalit mo lang ng tirahan o kakarehistro lang, wala ka pa sa listahan.</li>
                  </ul>
                  <p className="rounded-xl bg-brand-light px-3 py-2 text-brand-deep">Hindi pa rin makita? Pumunta sa Barangay Hall at humingi ng tulong kay Secretary. Dalhin ang valid ID.</p>
                </Card>
              </div>
            )}

            {results && results.length > 1 && (
              <div className="space-y-2">
                <p className="text-sm font-semibold text-gray-700">{results.length} ang tugma. Piliin ang ikaw:</p>
                {results.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => setPicked(v)}
                    className={`block w-full rounded-2xl bg-white p-3 text-left shadow-card active:bg-gray-50 ${picked?.id === v.id ? "ring-2 ring-brand" : ""}`}
                  >
                    <p className="font-extrabold">{v.name}</p>
                    <p className="text-sm text-gray-600">{v.address || "Walang address"}</p>
                  </button>
                ))}
              </div>
            )}

            {picked && meta && <ResultCard voter={picked} meta={meta} />}

            <p className="rounded-xl bg-gold-light px-3 py-2.5 text-xs text-yellow-900">
              Ito ay batay sa listahang ibinigay sa Barangay{meta?.listDate ? ` noong ${meta.listDate}` : ""}. Kung may pagkakaiba, ang opisyal na listahan ng COMELEC ang masusunod. Dalhin ang valid ID sa araw ng halalan.
            </p>
          </LoginGate>
        </>
      )}
    </div>
  );
}
