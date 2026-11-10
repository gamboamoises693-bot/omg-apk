"use client";

import { useEffect, useState } from "react";
import { doc, serverTimestamp, setDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { logActivity } from "@/lib/activity";
import { friendlyError } from "@/lib/format";
import { ACCESS_LABEL, ACCESS_LEVELS, PRESETS, WEB_FEATURES, levelOf, presetLevels, useWebAccess, type AccessLevel, type PresetKey } from "@/lib/webAccess";
import { Button, Card, ErrorText, Spinner } from "@/components/ui";

/** Super Admin: choose what residents can see and who may open each service. */
export function AdminWebAccess() {
  const { access, loading } = useWebAccess();
  const [levels, setLevels] = useState<Record<string, AccessLevel>>({});
  const [preset, setPreset] = useState<PresetKey>("custom");
  const [electionMode, setElectionMode] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [ready, setReady] = useState(false);

  // Load the saved values once; after that the Super Admin's edits are the source of truth.
  useEffect(() => {
    if (loading || ready) return;
    setLevels(Object.fromEntries(WEB_FEATURES.map((f) => [f.key, levelOf(access, f.key)])));
    setPreset(access?.preset ?? "lahat");
    setElectionMode(access?.electionMode ?? false);
    setReady(true);
  }, [loading, ready, access]);

  if (!ready) return <Spinner />;

  function applyPreset(key: Exclude<PresetKey, "custom">) {
    setLevels(presetLevels(key));
    setPreset(key);
    setElectionMode(key === "eleksyon");
    setSaved(false);
  }

  function setLevel(key: string, level: AccessLevel) {
    setLevels((prev) => ({ ...prev, [key]: level }));
    setPreset("custom");
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    setError("");
    try {
      await setDoc(doc(db, "settings", "webAccess"), { features: levels, preset, electionMode, updatedAt: serverTimestamp() });
      const off = WEB_FEATURES.filter((f) => levels[f.key] === "off").map((f) => f.label);
      logActivity("Web Access", `Na-save ang Web Access${off.length ? `. Patay: ${off.join(", ")}` : ""}${electionMode ? ". Eleksyon mode" : ""}`);
      setSaved(true);
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-600">Piliin kung ano muna ang makikita ng residente. Ang mga admin at opisyal ay nakikita ang lahat.</p>

      <div className="grid grid-cols-3 gap-1.5">
        {PRESETS.map((p) => (
          <button
            key={p.key}
            type="button"
            onClick={() => applyPreset(p.key)}
            aria-pressed={preset === p.key}
            className={`rounded-xl px-1 py-2.5 text-xs font-bold ${preset === p.key ? "border-2 border-brand bg-white text-brand" : "border-2 border-transparent bg-brand-light text-brand"}`}
          >
            {p.label}
          </button>
        ))}
      </div>

      <Card className="divide-y divide-gray-100 !p-0">
        {WEB_FEATURES.map((f) => (
          <div key={f.key} className="flex items-center gap-2 px-3 py-2.5">
            <span className="min-w-0 flex-1 text-sm font-bold">{f.label}</span>
            <div className="grid shrink-0 grid-cols-4 overflow-hidden rounded-lg border border-gray-300 text-[0.68rem] font-bold" role="radiogroup" aria-label={`Access ng ${f.label}`}>
              {ACCESS_LEVELS.map((lv) => {
                const on = levels[f.key] === lv;
                return (
                  <button
                    key={lv}
                    type="button"
                    role="radio"
                    aria-checked={on}
                    onClick={() => setLevel(f.key, lv)}
                    className={`px-1.5 py-1.5 ${on ? (lv === "off" ? "bg-gray-500 text-white" : "bg-brand text-white") : "text-gray-600"}`}
                  >
                    {ACCESS_LABEL[lv]}
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </Card>

      <div className="space-y-1 rounded-2xl bg-brand-light p-3 text-xs text-brand-deep">
        <p><b>Lahat:</b> kahit bisita (hindi naka-login) ay nakakakita.</p>
        <p><b>Login:</b> kailangang naka-login.</p>
        <p><b>Verified:</b> verified na residente lang.</p>
        <p><b>Patay:</b> nakatago sa residente (lalabas ang “Malapit na”).</p>
        <p className="pt-1"><b>Eleksyon mode:</b> {electionMode ? "NAKA-ON. Nasa unahan ng Home ang Presinto at may naka-pin na paalala." : "naka-off."}</p>
      </div>

      <p className="rounded-xl bg-gold-light px-3 py-2 text-xs text-yellow-900">
        Itinatago lang nito ang mga screen. Ang proteksyon ng pribadong datos ay nasa mga patakaran ng database, kaya hindi ito mapapalitan ng sinuman maliban sa Super Admin.
      </p>

      <ErrorText>{error}</ErrorText>
      {saved && <p className="text-sm font-semibold text-emerald-700">Na-save ang Web Access.</p>}
      <Button full loading={saving} onClick={save}>I-save ang Web Access</Button>
    </div>
  );
}
