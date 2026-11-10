"use client";

import { useEffect, useMemo, useState } from "react";
import { addDoc, collection, deleteDoc, doc, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { CalendarDays, Minus, Plus, Trophy, Users } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { usePuroks } from "@/lib/useSettings";
import { logActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import { Badge, Button, Card, EmptyState, ErrorText, FilterTabs, Input, Modal, PageHeader, Select, Spinner, Textarea } from "@/components/ui";
import { RequireVerified } from "@/components/RequireVerified";
import { useToast } from "@/components/Toast";

interface League {
  id: string;
  name: string;
  sport: string;
  status: "active" | "done";
}
interface Team {
  id: string;
  leagueId: string;
  name: string;
  purok: string;
  captainId: string;
  captainName: string;
  contact: string;
  players: string[];
  status: "pending" | "approved" | "rejected";
}
interface Game {
  id: string;
  leagueId: string;
  homeId: string;
  awayId: string;
  homeName: string;
  awayName: string;
  scheduledAt: string; // local datetime
  venue: string;
  status: "scheduled" | "live" | "final";
  homeScore: number;
  awayScore: number;
  period: string;
}

const SPORTS = ["Basketball", "Volleyball", "Badminton", "Chess", "Iba pa"] as const;

function when(local: string): string {
  const d = new Date(local);
  return Number.isNaN(d.getTime()) ? local : d.toLocaleString("fil-PH", { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

/** Wins/losses from final games (ties count for nobody). */
function standings(teams: Team[], games: Game[]) {
  const rows = new Map(teams.map((t) => [t.id, { team: t, w: 0, l: 0, pf: 0, pa: 0 }]));
  for (const g of games) {
    if (g.status !== "final") continue;
    const h = rows.get(g.homeId);
    const a = rows.get(g.awayId);
    if (h) { h.pf += g.homeScore; h.pa += g.awayScore; }
    if (a) { a.pf += g.awayScore; a.pa += g.homeScore; }
    if (g.homeScore > g.awayScore) { if (h) h.w++; if (a) a.l++; }
    else if (g.awayScore > g.homeScore) { if (a) a.w++; if (h) h.l++; }
  }
  return [...rows.values()].sort((x, y) => y.w - x.w || x.l - y.l || (y.pf - y.pa) - (x.pf - x.pa));
}

/* ---------------- Resident: register a team ---------------- */

function TeamForm({ league, onDone }: { league: League; onDone: () => void }) {
  const { user, profile } = useAuth();
  const puroks = usePuroks();
  const toast = useToast();
  const [name, setName] = useState("");
  const [purok, setPurok] = useState(profile?.purok ?? "");
  const [players, setPlayers] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async () => {
    if (!user || !profile) return;
    setError("");
    const list = players.split("\n").map((p) => p.trim().slice(0, 60)).filter(Boolean).slice(0, 20);
    if (!name.trim()) return setError("Ilagay ang pangalan ng team.");
    if (list.length < 2) return setError("Ilista ang mga manlalaro (isa kada linya).");
    setBusy(true);
    try {
      const ref = await addDoc(collection(db, "ligaTeams"), {
        leagueId: league.id,
        name: name.trim().slice(0, 60),
        purok,
        captainId: user.uid,
        captainName: profile.fullName,
        contact: profile.contact ?? "",
        players: list,
        status: "pending",
        createdAt: serverTimestamp(),
      });
      logActivity("Liga", `Nag-register ng team: ${name.trim()} (${league.name})`, ref.id);
      toast("Naipadala. Hintayin ang approval ng SK o Barangay.");
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Input label="Pangalan ng team" placeholder="hal. Purok 1 Agila" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
      <Select label="Purok" options={puroks} placeholder="Piliin" value={purok} onChange={(e) => setPurok(e.target.value)} />
      <Textarea label="Mga manlalaro (isa kada linya)" value={players} onChange={(e) => setPlayers(e.target.value)} />
      <p className="text-xs text-gray-500">Ikaw ang magiging team captain.</p>
      <ErrorText>{error}</ErrorText>
      <Button full loading={busy} onClick={submit}>I-register ang team</Button>
    </div>
  );
}

/* ---------------- Manager tools (officers + SK Chairman) ---------------- */

function LeagueForm({ onDone }: { onDone: () => void }) {
  const toast = useToast();
  const [name, setName] = useState(`Liga ng Malineng ${new Date().getFullYear()}`);
  const [sport, setSport] = useState<string>(SPORTS[0]);
  const [busy, setBusy] = useState(false);
  const save = async () => {
    if (!name.trim()) return;
    setBusy(true);
    try {
      const ref = await addDoc(collection(db, "leagues"), { name: name.trim().slice(0, 80), sport, status: "active", createdAt: serverTimestamp() });
      logActivity("Liga", `Gumawa ng liga: ${name.trim()}`, ref.id);
      onDone();
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="space-y-3">
      <Input label="Pangalan ng liga" value={name} onChange={(e) => setName(e.target.value)} maxLength={80} />
      <Select label="Laro" options={SPORTS} value={sport} onChange={(e) => setSport(e.target.value)} />
      <Button full loading={busy} onClick={save}>Gawin ang liga</Button>
    </div>
  );
}

function GameForm({ league, teams, onDone }: { league: League; teams: Team[]; onDone: () => void }) {
  const toast = useToast();
  const names = teams.map((t) => t.name);
  const [home, setHome] = useState(names[0] ?? "");
  const [away, setAway] = useState(names[1] ?? "");
  const [at, setAt] = useState("");
  const [venue, setVenue] = useState("Covered court");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const save = async () => {
    setError("");
    const h = teams.find((t) => t.name === home);
    const a = teams.find((t) => t.name === away);
    if (!h || !a || h.id === a.id) return setError("Pumili ng dalawang magkaibang team.");
    if (!at) return setError("Ilagay ang petsa at oras.");
    setBusy(true);
    try {
      await addDoc(collection(db, "ligaGames"), { leagueId: league.id, homeId: h.id, awayId: a.id, homeName: h.name, awayName: a.name, scheduledAt: at, venue: venue.trim().slice(0, 60), status: "scheduled", homeScore: 0, awayScore: 0, period: "" });
      logActivity("Liga", `Naglagay ng laro: ${h.name} vs ${a.name}`);
      toast("Naidagdag ang laro.");
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };
  if (teams.length < 2) return <p className="text-sm text-gray-600">Kailangan ng kahit 2 aprubadong team.</p>;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Select label="Home" options={names} value={home} onChange={(e) => setHome(e.target.value)} />
        <Select label="Away" options={names} value={away} onChange={(e) => setAway(e.target.value)} />
      </div>
      <Input label="Petsa at oras" type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
      <Input label="Lugar" value={venue} onChange={(e) => setVenue(e.target.value)} maxLength={60} />
      <ErrorText>{error}</ErrorText>
      <Button full loading={busy} onClick={save}>Idagdag ang laro</Button>
    </div>
  );
}

function ScoreKeeper({ g }: { g: Game }) {
  const toast = useToast();
  const [period, setPeriod] = useState(g.period);
  const set = async (patch: Partial<Game>, log?: string) => {
    try {
      await updateDoc(doc(db, "ligaGames", g.id), patch);
      if (log) logActivity("Liga", log, g.id);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };
  const bump = (side: "homeScore" | "awayScore", d: number) => set({ [side]: Math.max(0, g[side] + d), status: g.status === "scheduled" ? "live" : g.status } as Partial<Game>);
  const step = [1, 2, 3];
  return (
    <div className="space-y-3">
      {(["homeScore", "awayScore"] as const).map((side) => (
        <div key={side} className="rounded-xl bg-gray-50 p-3">
          <div className="flex items-center justify-between">
            <p className="font-bold">{side === "homeScore" ? g.homeName : g.awayName}</p>
            <p className="text-3xl font-extrabold tabular-nums">{g[side]}</p>
          </div>
          <div className="mt-2 grid grid-cols-4 gap-1.5">
            <Button variant="outline" onClick={() => bump(side, -1)} aria-label="Bawasan ng 1"><Minus className="h-4 w-4" /></Button>
            {step.map((n) => <Button key={n} variant="soft" onClick={() => bump(side, n)}>+{n}</Button>)}
          </div>
        </div>
      ))}
      <div className="flex items-end gap-2">
        <Input label="Quarter / set" placeholder="hal. 3rd Quarter" value={period} onChange={(e) => setPeriod(e.target.value)} maxLength={30} />
        <Button variant="outline" onClick={() => set({ period })}>I-save</Button>
      </div>
      <div className="grid grid-cols-2 gap-2">
        {g.status !== "live" && <Button variant="soft" onClick={() => set({ status: "live" }, `LIVE: ${g.homeName} vs ${g.awayName}`)}>Simulan (LIVE)</Button>}
        {g.status !== "final" && <Button onClick={() => confirm("Tapos na ang laro?") && set({ status: "final" }, `Final: ${g.homeName} ${g.homeScore}–${g.awayScore} ${g.awayName}`)}>Tapos na (Final)</Button>}
        <Button variant="outline" className="!text-red-700" onClick={async () => { if (confirm("Burahin ang larong ito?")) { await deleteDoc(doc(db, "ligaGames", g.id)).catch((e) => toast(friendlyError(e), "error")); } }}>Burahin</Button>
      </div>
    </div>
  );
}

function ManagerPanel({ league, teams, games }: { league: League | null; teams: Team[]; games: Game[] }) {
  const toast = useToast();
  const [modal, setModal] = useState<"league" | "game" | null>(null);
  const pending = teams.filter((t) => t.status === "pending");
  const approved = teams.filter((t) => t.status === "approved");

  const decide = async (t: Team, status: "approved" | "rejected") => {
    try {
      await updateDoc(doc(db, "ligaTeams", t.id), { status });
      logActivity("Liga", `${status === "approved" ? "Inaprubahan" : "Tinanggihan"} ang team: ${t.name}`, t.id);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  return (
    <Card className="mb-4 space-y-3 ring-1 ring-brand/20">
      <p className="text-xs font-bold uppercase tracking-wide text-brand">Para sa SK at Barangay</p>
      <div className="grid grid-cols-2 gap-2">
        <Button variant="gold" onClick={() => setModal("league")}><Trophy className="h-4 w-4" /> Bagong liga</Button>
        <Button variant="soft" disabled={!league} onClick={() => setModal("game")}><CalendarDays className="h-4 w-4" /> Bagong laro</Button>
      </div>
      {league && (
        <button
          onClick={async () => { await updateDoc(doc(db, "leagues", league.id), { status: league.status === "active" ? "done" : "active" }).catch((e) => toast(friendlyError(e), "error")); }}
          className="text-xs font-semibold text-gray-600 underline"
        >
          {league.status === "active" ? "Tapusin ang liga na ito" : "Buksan ulit ang liga"}
        </button>
      )}
      {pending.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-bold">Mga team na naghihintay ({pending.length})</p>
          {pending.map((t) => (
            <div key={t.id} className="rounded-xl bg-gray-50 p-3 text-sm">
              <p className="font-bold">{t.name} <span className="font-normal text-gray-500">· {t.purok || "—"}</span></p>
              <p className="text-xs text-gray-600">Captain: {t.captainName}{t.contact ? ` · ${t.contact}` : ""}</p>
              <p className="text-xs text-gray-600">{t.players.join(", ")}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                <Button variant="outline" className="!text-red-700" onClick={() => decide(t, "rejected")}>Tanggihan</Button>
                <Button onClick={() => decide(t, "approved")}>Aprubahan</Button>
              </div>
            </div>
          ))}
        </div>
      )}
      <Modal open={modal === "league"} onClose={() => setModal(null)} title="Bagong liga">{modal === "league" && <LeagueForm onDone={() => setModal(null)} />}</Modal>
      <Modal open={modal === "game"} onClose={() => setModal(null)} title="Bagong laro">{modal === "game" && league && <GameForm league={league} teams={approved} onDone={() => setModal(null)} />}</Modal>
      <p className="text-[0.7rem] text-gray-500">{games.length} laro · {approved.length} team. Pindutin ang isang laro sa ibaba para i-update ang score.</p>
    </Card>
  );
}

/* ---------------- Page ---------------- */

export default function LigaPage() {
  const { user, canLiga } = useAuth();
  const leagues = useCollection<League>(useMemo(() => query(collection(db, "leagues"), orderBy("createdAt", "desc")), []));
  const [leagueId, setLeagueId] = useState("");
  useEffect(() => {
    if (!leagueId && leagues.data.length) setLeagueId((leagues.data.find((l) => l.status === "active") ?? leagues.data[0]).id);
  }, [leagues.data, leagueId]);
  const league = leagues.data.find((l) => l.id === leagueId) ?? null;

  const teamsQ = useMemo(() => (leagueId ? query(collection(db, "ligaTeams"), where("leagueId", "==", leagueId)) : null), [leagueId]);
  const gamesQ = useMemo(() => (leagueId ? query(collection(db, "ligaGames"), where("leagueId", "==", leagueId)) : null), [leagueId]);
  const teams = useCollection<Team>(teamsQ);
  const games = useCollection<Game>(gamesQ);
  const [tab, setTab] = useState<"laro" | "standings" | "teams">("laro");
  const [registering, setRegistering] = useState(false);
  const [scoring, setScoring] = useState<string | null>(null);

  const approved = teams.data.filter((t) => t.status === "approved");
  const sorted = [...games.data].sort((a, b) => a.scheduledAt.localeCompare(b.scheduledAt));
  const live = sorted.filter((g) => g.status === "live");
  const upcoming = sorted.filter((g) => g.status === "scheduled");
  const results = sorted.filter((g) => g.status === "final").reverse();
  const table = standings(approved, games.data);
  const myTeam = user ? teams.data.find((t) => t.captainId === user.uid) : undefined;
  const scoringGame = games.data.find((g) => g.id === scoring) ?? null;

  const GameRow = ({ g }: { g: Game }) => (
    <button onClick={() => canLiga && setScoring(g.id)} disabled={!canLiga} className="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm enabled:active:bg-gray-50">
      <div className="min-w-0 flex-1">
        <p className="truncate font-semibold">{g.homeName} vs {g.awayName}</p>
        <p className="text-xs text-gray-500">{when(g.scheduledAt)} · {g.venue}</p>
      </div>
      {g.status === "final" ? <b className="tabular-nums">{g.homeScore}–{g.awayScore}</b> : g.status === "live" ? <Badge color="red">LIVE</Badge> : null}
    </button>
  );

  return (
    <div>
      <PageHeader title="Liga at Palaro" subtitle={league ? `${league.name} · ${league.sport}` : "SK Malineng"} />
      {leagues.data.length > 1 && (
        <Select label="Liga" options={leagues.data.map((l) => l.name)} value={league?.name ?? ""} onChange={(e) => setLeagueId(leagues.data.find((l) => l.name === e.target.value)?.id ?? "")} />
      )}
      {canLiga && <div className="mt-3"><ManagerPanel league={league} teams={teams.data} games={games.data} /></div>}

      {leagues.loading ? (
        <Spinner />
      ) : !league ? (
        <EmptyState icon={<Trophy />} title="Wala pang liga" />
      ) : (
        <>
          {live.map((g) => (
            <button key={g.id} onClick={() => canLiga && setScoring(g.id)} className="mb-3 block w-full rounded-2xl bg-gradient-to-br from-brand to-brand-deep p-4 text-left text-white shadow-float">
              <div className="flex justify-between text-xs text-white/80"><span className="font-bold text-red-200">● LIVE{g.period ? ` · ${g.period}` : ""}</span><span>{g.venue}</span></div>
              <div className="mt-2 grid grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 text-center">
                <p className="truncate font-extrabold">{g.homeName}</p>
                <p className="text-3xl font-extrabold tabular-nums">{g.homeScore} <span className="text-gold">–</span> {g.awayScore}</p>
                <p className="truncate font-extrabold">{g.awayName}</p>
              </div>
            </button>
          ))}

          <FilterTabs
            label="Liga"
            value={tab}
            onChange={setTab}
            options={[
              { value: "laro", label: "Mga laro", count: upcoming.length, tone: "neutral" },
              { value: "standings", label: "Standings" },
              { value: "teams", label: "Teams", count: approved.length, tone: "neutral" },
            ]}
          />

          {tab === "laro" && (
            <div className="space-y-3">
              <Card className="!p-0 overflow-hidden">
                <p className="px-3 pt-3 text-xs font-bold uppercase tracking-wide text-gray-500">Susunod na laro</p>
                {upcoming.length === 0 ? <p className="p-3 text-sm text-gray-500">Wala pang schedule.</p> : <div className="divide-y divide-gray-100">{upcoming.map((g) => <GameRow key={g.id} g={g} />)}</div>}
              </Card>
              {results.length > 0 && (
                <Card className="!p-0 overflow-hidden">
                  <p className="px-3 pt-3 text-xs font-bold uppercase tracking-wide text-gray-500">Mga resulta</p>
                  <div className="divide-y divide-gray-100">{results.map((g) => <GameRow key={g.id} g={g} />)}</div>
                </Card>
              )}
            </div>
          )}

          {tab === "standings" && (
            <Card>
              {table.length === 0 ? (
                <p className="text-sm text-gray-500">Wala pang aprubadong team.</p>
              ) : (
                <div className="grid grid-cols-[1.5rem_minmax(0,1fr)_2rem_2rem_2.75rem] gap-x-2 gap-y-1.5 text-sm">
                  <b className="text-gray-500">#</b><b className="text-gray-500">Team</b><b className="text-center text-gray-500">W</b><b className="text-center text-gray-500">L</b><b className="text-right text-gray-500">+/-</b>
                  {table.map((r, i) => (
                    <div key={r.team.id} className="contents">
                      <span>{i + 1}</span>
                      <span className="truncate font-semibold">{r.team.name}</span>
                      <span className="text-center">{r.w}</span>
                      <span className="text-center">{r.l}</span>
                      <span className="text-right tabular-nums">{r.pf - r.pa > 0 ? "+" : ""}{r.pf - r.pa}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === "teams" && (
            <div className="space-y-2">
              {approved.length === 0 ? <EmptyState icon={<Users />} title="Wala pang aprubadong team" /> : approved.map((t) => (
                <Card key={t.id}>
                  <p className="font-bold">{t.name} <span className="text-xs font-normal text-gray-500">· {t.purok || "—"}</span></p>
                  <p className="text-xs text-gray-600">Captain: {t.captainName}</p>
                  <p className="mt-1 text-xs text-gray-600">{t.players.join(", ")}</p>
                </Card>
              ))}
            </div>
          )}

          {league.status === "active" && (
            <div className="mt-4">
              {myTeam ? (
                <p className="rounded-2xl bg-brand-light p-3 text-sm text-brand-deep">
                  Team mo: <b>{myTeam.name}</b> · {myTeam.status === "approved" ? "Aprubado ✓" : myTeam.status === "pending" ? "Naghihintay ng approval" : "Hindi naaprubahan"}
                </p>
              ) : (
                <Button variant="soft" full onClick={() => setRegistering(true)}><Plus className="h-4 w-4" /> I-register ang team</Button>
              )}
            </div>
          )}
        </>
      )}

      <Modal open={registering} onClose={() => setRegistering(false)} title="I-register ang team">
        {registering && league && (
          <RequireVerified feature="mag-register ng team">
            <TeamForm league={league} onDone={() => setRegistering(false)} />
          </RequireVerified>
        )}
      </Modal>
      <Modal open={!!scoringGame} onClose={() => setScoring(null)} title={scoringGame ? `${scoringGame.homeName} vs ${scoringGame.awayName}` : "Score"}>
        {scoringGame && <ScoreKeeper key={scoringGame.id} g={scoringGame} />}
      </Modal>
    </div>
  );
}
