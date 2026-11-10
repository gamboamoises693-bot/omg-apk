"use client";

import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, getDoc, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { CheckCircle2, Lightbulb, Lock, Plus, Trash2, Unlock, Vote } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { logActivity } from "@/lib/activity";
import { friendlyError, timeAgo } from "@/lib/format";
import { submitSurvey, tally, type Survey, type SurveyResponse } from "@/lib/survey";
import { Badge, Button, Card, EmptyState, ErrorText, FilterTabs, Input, Modal, PageHeader, Spinner, Textarea } from "@/components/ui";
import { RequireVerified } from "@/components/RequireVerified";
import { useToast } from "@/components/Toast";

const surveysQ = query(collection(db, "surveys"), orderBy("createdAt", "desc"));

function Bars({ options, counts }: { options: string[]; counts: number[] }) {
  const total = counts.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)_2.5rem] items-center gap-x-2 gap-y-1.5 text-[0.82rem]">
      {options.map((o, i) => {
        const pct = Math.round((counts[i] / total) * 100);
        return (
          <div key={o} className="contents">
            <span className="truncate">{o}</span>
            <span className="h-2.5 rounded-full bg-gray-100">
              <span className="block h-full rounded-full bg-brand" style={{ width: `${pct}%` }} />
            </span>
            <b className="text-right tabular-nums">{pct}%</b>
          </div>
        );
      })}
    </div>
  );
}

/* ---------------- Resident: answer one survey ---------------- */

function AnswerFlow({ s, onDone }: { s: Survey; onDone: () => void }) {
  const { user } = useAuth();
  const toast = useToast();
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<number[]>(() => s.questions.map(() => -1));
  const [suggestion, setSuggestion] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const last = step === s.questions.length; // suggestion step

  const submit = async () => {
    if (!user) return;
    setBusy(true);
    setError("");
    try {
      await submitSurvey(s.id, user.uid, answers, suggestion);
      toast("Salamat sa sagot mo! Anonymous ito.");
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const q = s.questions[step];
  return (
    <div className="space-y-3">
      <div className="flex justify-between text-xs text-gray-500">
        <span>{last ? "Huling hakbang" : `Tanong ${step + 1} sa ${s.questions.length}`}</span>
        <span>Anonymous</span>
      </div>
      <div className="h-1.5 rounded-full bg-gray-100">
        <div className="h-full rounded-full bg-brand transition-all" style={{ width: `${((step + (last ? 1 : 0)) / s.questions.length) * 100}%` }} />
      </div>
      {last ? (
        <Textarea label="May suhestiyon ka ba? (optional)" value={suggestion} onChange={(e) => setSuggestion(e.target.value)} maxLength={500} />
      ) : (
        <fieldset className="space-y-2">
          <legend className="mb-2 text-base font-extrabold">{q.text}</legend>
          {q.options.map((o, i) => (
            <label key={o} className={`flex cursor-pointer items-center gap-3 rounded-xl border p-3 ${answers[step] === i ? "border-2 border-brand bg-brand-light" : "border-gray-200"}`}>
              <input type="radio" name={`q${step}`} checked={answers[step] === i} onChange={() => setAnswers((a) => a.map((v, k) => (k === step ? i : v)))} className="h-4 w-4 accent-brand" />
              {o}
            </label>
          ))}
        </fieldset>
      )}
      <ErrorText>{error}</ErrorText>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="outline" disabled={step === 0} onClick={() => setStep((n) => n - 1)}>Bumalik</Button>
        {last ? (
          <Button loading={busy} onClick={submit}>Ipadala</Button>
        ) : (
          <Button disabled={answers[step] < 0} onClick={() => setStep((n) => n + 1)}>Susunod</Button>
        )}
      </div>
    </div>
  );
}

function SurveyCard({ s }: { s: Survey }) {
  const { user } = useAuth();
  const [answered, setAnswered] = useState<boolean | null>(null);
  const [answering, setAnswering] = useState(false);

  useEffect(() => {
    if (!user) return setAnswered(false);
    getDoc(doc(db, "surveys", s.id, "voters", user.uid))
      .then((snap) => setAnswered(snap.exists()))
      .catch(() => setAnswered(false));
  }, [user, s.id]);

  return (
    <Card className="space-y-2">
      <div className="flex items-start justify-between gap-2">
        <p className="font-extrabold">{s.title}</p>
        {s.status === "open" ? <Badge color="green">Bukas</Badge> : <Badge color="gray">Sarado</Badge>}
      </div>
      <p className="text-xs text-gray-500">{s.questions.length} tanong · {timeAgo(s.createdAt)}{s.createdByName ? ` · ${s.createdByName}` : ""}</p>

      {s.results && (
        <div className="space-y-3 rounded-xl bg-gray-50 p-3">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Resulta ({s.responseCount ?? 0} sumagot)</p>
          {s.questions.map((q, i) => (
            <div key={q.text} className="space-y-1">
              <p className="text-sm font-semibold">{q.text}</p>
              <Bars options={q.options} counts={s.results?.[`q${i}`] ?? []} />
            </div>
          ))}
        </div>
      )}

      {s.status === "open" &&
        (answered ? (
          <p className="flex items-center gap-1.5 text-sm font-semibold text-emerald-700"><CheckCircle2 className="h-4 w-4" /> Nakasagot ka na. Salamat!</p>
        ) : (
          <Button full onClick={() => setAnswering(true)} disabled={answered === null}><Vote className="h-4 w-4" /> Sumagot</Button>
        ))}

      <Modal open={answering} onClose={() => setAnswering(false)} title={s.title}>
        {answering && (
          <RequireVerified feature="sumagot sa survey">
            <AnswerFlow s={s} onDone={() => { setAnswering(false); setAnswered(true); }} />
          </RequireVerified>
        )}
      </Modal>
    </Card>
  );
}

/* ---------------- Suhestiyon box ---------------- */

function SuggestionBox() {
  const { profile } = useAuth();
  const toast = useToast();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const send = async () => {
    if (!text.trim()) return;
    setBusy(true);
    try {
      // No uid or name is stored: anonymous by design.
      await addDoc(collection(db, "suggestions"), { text: text.trim().slice(0, 1000), purok: profile?.purok ?? "", createdAt: serverTimestamp() });
      toast("Naipadala ang suhestiyon mo. Salamat!");
      setText("");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <Card className="mt-4 space-y-2">
      <p className="flex items-center gap-2 font-extrabold"><Lightbulb className="h-5 w-5 text-gold-dark" /> Suhestiyon box</p>
      <p className="text-xs text-gray-500">Anonymous: hindi makikita kung sino ka, purok lang.</p>
      <RequireVerified feature="magpadala ng suhestiyon">
        <Textarea label="Ano ang mungkahi mo para sa Barangay?" value={text} onChange={(e) => setText(e.target.value)} maxLength={1000} />
        <Button full className="mt-2" loading={busy} disabled={!text.trim()} onClick={send}>Ipadala</Button>
      </RequireVerified>
    </Card>
  );
}

/* ---------------- Officers ---------------- */

function NewSurveyForm({ onDone }: { onDone: () => void }) {
  const { profile } = useAuth();
  const toast = useToast();
  const [title, setTitle] = useState("");
  const [qs, setQs] = useState([{ text: "", options: "" }]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    const questions = qs
      .map((q) => ({ text: q.text.trim().slice(0, 200), options: q.options.split("\n").map((o) => o.trim().slice(0, 80)).filter(Boolean).slice(0, 8) }))
      .filter((q) => q.text);
    if (!title.trim()) return setError("Ilagay ang pamagat.");
    if (questions.length === 0) return setError("Magdagdag ng kahit isang tanong.");
    if (questions.some((q) => q.options.length < 2)) return setError("Bawat tanong ay dapat may 2 o higit pang pagpipilian (isa kada linya).");
    setBusy(true);
    try {
      const ref = await addDoc(collection(db, "surveys"), { title: title.trim().slice(0, 150), questions, status: "open", createdAt: serverTimestamp(), createdByName: profile?.fullName ?? "" });
      logActivity("Survey", `Gumawa ng survey: ${title.trim()}`, ref.id);
      toast("Bukas na ang survey.");
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Input label="Pamagat" placeholder="hal. Saan uunahin ang pondo sa 2027?" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={150} />
      {qs.map((q, i) => (
        <div key={i} className="space-y-2 rounded-xl bg-gray-50 p-3">
          <Input label={`Tanong ${i + 1}`} value={q.text} onChange={(e) => setQs((all) => all.map((x, k) => (k === i ? { ...x, text: e.target.value } : x)))} maxLength={200} />
          <Textarea label="Mga pagpipilian (isa kada linya)" placeholder={"Kalsada\nGamot\nIlaw sa kalye"} value={q.options} onChange={(e) => setQs((all) => all.map((x, k) => (k === i ? { ...x, options: e.target.value } : x)))} />
          {qs.length > 1 && <button onClick={() => setQs((all) => all.filter((_, k) => k !== i))} className="text-xs font-semibold text-red-700">Alisin ang tanong</button>}
        </div>
      ))}
      {qs.length < 10 && <Button variant="soft" full onClick={() => setQs((all) => [...all, { text: "", options: "" }])}><Plus className="h-4 w-4" /> Magdagdag ng tanong</Button>}
      <ErrorText>{error}</ErrorText>
      <Button full loading={busy} onClick={save}>Buksan ang survey</Button>
    </div>
  );
}

function ResultsPanel({ s }: { s: Survey }) {
  const toast = useToast();
  const q = useMemo(() => query(collection(db, "surveyResponses"), where("surveyId", "==", s.id)), [s.id]);
  const { data, loading } = useCollection<SurveyResponse>(q);
  const counts = useMemo(() => tally(s, data), [s, data]);
  const suggestions = data.map((r) => r.suggestion).filter(Boolean);

  const act = async (patch: Partial<Survey>, log: string, ok: string) => {
    try {
      await updateDoc(doc(db, "surveys", s.id), patch);
      logActivity("Survey", log, s.id);
      toast(ok);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };
  const publish = () =>
    act({ results: Object.fromEntries(counts.map((c, i) => [`q${i}`, c])), responseCount: data.length }, `Inilabas ang resulta: ${s.title}`, "Nakikita na ng mga residente ang resulta.");
  const remove = async () => {
    if (!confirm(`Burahin ang survey na "${s.title}"?`)) return;
    try {
      await deleteDoc(doc(db, "surveys", s.id));
      logActivity("Survey", `Binura ang survey: ${s.title}`, s.id);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  if (loading) return <Spinner />;
  return (
    <div className="space-y-3">
      <p className="text-sm font-bold">{data.length} na ang sumagot</p>
      {s.questions.map((qq, i) => (
        <div key={qq.text} className="space-y-1">
          <p className="text-sm font-semibold">{qq.text}</p>
          <Bars options={qq.options} counts={counts[i]} />
        </div>
      ))}
      {suggestions.length > 0 && (
        <div>
          <p className="mb-1 text-xs font-bold uppercase tracking-wide text-gray-500">Mga suhestiyon</p>
          <ul className="space-y-1 text-sm">{suggestions.map((t, i) => <li key={i} className="rounded-lg bg-gray-50 p-2">“{t}”</li>)}</ul>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2">
        {s.status === "open" ? (
          <Button variant="outline" onClick={() => act({ status: "closed" }, `Isinara ang survey: ${s.title}`, "Isinara ang survey.")}><Lock className="h-4 w-4" /> Isara</Button>
        ) : (
          <Button variant="outline" onClick={() => act({ status: "open" }, `Binuksan ulit: ${s.title}`, "Bukas ulit ang survey.")}><Unlock className="h-4 w-4" /> Buksan</Button>
        )}
        <Button onClick={publish}>I-publish ang resulta</Button>
      </div>
      <button onClick={remove} className="flex w-full items-center justify-center gap-1 text-sm font-semibold text-red-700"><Trash2 className="h-4 w-4" /> Burahin ang survey</button>
    </div>
  );
}

function OfficerTools({ surveys }: { surveys: Survey[] }) {
  const [tab, setTab] = useState<"survey" | "suhestiyon">("survey");
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);
  const sugQ = useMemo(() => query(collection(db, "suggestions"), orderBy("createdAt", "desc")), []);
  const sug = useCollection<{ id: string; text: string; purok: string; createdAt?: Survey["createdAt"] }>(tab === "suhestiyon" ? sugQ : null);
  const open = surveys.find((s) => s.id === openId) ?? null;

  return (
    <Card className="mb-4 space-y-3 ring-1 ring-brand/20">
      <p className="text-xs font-bold uppercase tracking-wide text-brand">Para sa Kapitan at Secretary</p>
      <FilterTabs label="Officer tools" value={tab} onChange={setTab} options={[{ value: "survey", label: "Mga survey" }, { value: "suhestiyon", label: "Suhestiyon" }]} />
      {tab === "survey" ? (
        <>
          <Button variant="gold" full onClick={() => setCreating(true)}><Plus className="h-4 w-4" /> Bagong survey</Button>
          {surveys.map((s) => (
            <button key={s.id} onClick={() => setOpenId(s.id)} className="flex w-full items-center justify-between gap-2 rounded-xl bg-gray-50 p-3 text-left text-sm">
              <span className="truncate font-semibold">{s.title}</span>
              <span className="shrink-0 text-xs font-bold text-brand">Resulta →</span>
            </button>
          ))}
        </>
      ) : sug.loading ? (
        <Spinner />
      ) : sug.data.length === 0 ? (
        <p className="text-sm text-gray-500">Wala pang suhestiyon.</p>
      ) : (
        <ul className="space-y-1.5">
          {sug.data.map((x) => (
            <li key={x.id} className="rounded-xl bg-gray-50 p-2.5 text-sm">
              “{x.text}”<p className="mt-0.5 text-xs text-gray-500">{x.purok || "—"} · {timeAgo(x.createdAt)}</p>
            </li>
          ))}
        </ul>
      )}
      <Modal open={creating} onClose={() => setCreating(false)} title="Bagong survey">{creating && <NewSurveyForm onDone={() => setCreating(false)} />}</Modal>
      <Modal open={!!open} onClose={() => setOpenId(null)} title={open?.title ?? "Resulta"}>{open && <ResultsPanel s={open} />}</Modal>
    </Card>
  );
}

export default function SurveyPage() {
  const { isOfficer } = useAuth();
  const { data, loading } = useCollection<Survey>(surveysQ);
  // Residents see open surveys and closed ones whose results were published.
  const visible = data.filter((s) => s.status === "open" || s.results);

  return (
    <div>
      <PageHeader title="Boses ng Malineng" subtitle="Survey mula sa Barangay · anonymous ang sagot" />
      {isOfficer && <OfficerTools surveys={data} />}
      {loading ? (
        <Spinner />
      ) : visible.length === 0 ? (
        <EmptyState icon={<Vote />} title="Walang bukas na survey ngayon" />
      ) : (
        <div className="space-y-3">{visible.map((s) => <SurveyCard key={s.id} s={s} />)}</div>
      )}
      <SuggestionBox />
    </div>
  );
}
