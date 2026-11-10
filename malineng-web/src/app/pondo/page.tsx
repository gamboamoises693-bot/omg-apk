"use client";

import { useEffect, useMemo, useState } from "react";
import { collection, deleteDoc, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where, writeBatch } from "firebase/firestore";
import { Camera, Landmark, Pencil, Plus, Receipt, Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { logActivity } from "@/lib/activity";
import { compressToDataUrl } from "@/lib/upload";
import { formatDate, formatPeso, friendlyError, todayISO } from "@/lib/format";
import { Button, Card, EmptyState, ErrorText, Input, Modal, PageHeader, Select, Spinner } from "@/components/ui";
import { useToast } from "@/components/Toast";

interface BudgetCategory {
  name: string;
  allocated: number;
}
interface Budget {
  total: number;
  categories: BudgetCategory[];
}
interface Expense {
  id: string;
  year: number;
  date: string;
  description: string;
  category: string;
  amount: number;
  hasReceipt: boolean;
}

const DEFAULT_CATEGORIES = ["Imprastraktura", "Kalusugan", "SK / Kabataan", "Calamity fund (5%)", "Serbisyong panlipunan", "Sahod at operasyon", "Iba pa"];

/* ---------------- Officer forms ---------------- */

function BudgetForm({ year, budget, onDone }: { year: number; budget: Budget | null; onDone: () => void }) {
  const toast = useToast();
  const [total, setTotal] = useState(String(budget?.total ?? ""));
  const [cats, setCats] = useState<{ name: string; allocated: string }[]>(
    budget?.categories.length ? budget.categories.map((c) => ({ name: c.name, allocated: String(c.allocated) })) : DEFAULT_CATEGORIES.map((name) => ({ name, allocated: "" })),
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const save = async () => {
    setError("");
    const t = Number(total);
    if (!(t >= 0)) return setError("Ilagay ang kabuuang budget.");
    const categories = cats.map((c) => ({ name: c.name.trim().slice(0, 60), allocated: Number(c.allocated) || 0 })).filter((c) => c.name);
    setBusy(true);
    try {
      await setDoc(doc(db, "budgets", String(year)), { total: t, categories, updatedAt: serverTimestamp() });
      logActivity("Transparency", `In-update ang budget ng ${year}: ${formatPeso(t)}`);
      toast("Na-save ang budget.");
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Input label={`Kabuuang budget ${year} (₱)`} type="number" inputMode="decimal" min={0} value={total} onChange={(e) => setTotal(e.target.value)} />
      <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Hati ng budget</p>
      {cats.map((c, i) => (
        <div key={i} className="grid grid-cols-[minmax(0,1fr)_7rem_auto] items-end gap-2">
          <Input label="Kategorya" value={c.name} onChange={(e) => setCats((all) => all.map((x, k) => (k === i ? { ...x, name: e.target.value } : x)))} />
          <Input label="₱" type="number" inputMode="decimal" min={0} value={c.allocated} onChange={(e) => setCats((all) => all.map((x, k) => (k === i ? { ...x, allocated: e.target.value } : x)))} />
          <button onClick={() => setCats((all) => all.filter((_, k) => k !== i))} className="mb-2.5 p-1 text-red-700" aria-label={`Alisin ang ${c.name || "kategorya"}`}>
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      ))}
      {cats.length < 20 && <Button variant="soft" full onClick={() => setCats((all) => [...all, { name: "", allocated: "" }])}><Plus className="h-4 w-4" /> Kategorya</Button>}
      <ErrorText>{error}</ErrorText>
      <Button full loading={busy} onClick={save}>I-save ang budget</Button>
    </div>
  );
}

function ExpenseForm({ year, categories, onDone }: { year: number; categories: string[]; onDone: () => void }) {
  const toast = useToast();
  const [date, setDate] = useState(todayISO());
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState(categories[0] ?? "Iba pa");
  const [amount, setAmount] = useState("");
  const [receipt, setReceipt] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const pick = async (file?: File) => {
    if (!file) return;
    try {
      setReceipt(await compressToDataUrl(file, 1100, 0.7, 380_000));
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const save = async () => {
    setError("");
    const a = Number(amount);
    if (!description.trim()) return setError("Ilagay kung para saan ang gastos.");
    if (!(a > 0)) return setError("Ilagay ang halaga.");
    setBusy(true);
    try {
      const ref = doc(collection(db, "expenses"));
      const batch = writeBatch(db);
      batch.set(ref, { year, date, description: description.trim().slice(0, 200), category, amount: a, hasReceipt: !!receipt, createdAt: serverTimestamp() });
      if (receipt) batch.set(doc(db, "expenseReceipts", ref.id), { photo: receipt });
      await batch.commit();
      logActivity("Transparency", `Nagtala ng gastos: ${description.trim()} (${formatPeso(a)})`, ref.id);
      toast("Naitala ang gastos.");
      onDone();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      <Input label="Para saan" placeholder="hal. Semento para sa drainage, Purok 2" value={description} onChange={(e) => setDescription(e.target.value)} maxLength={200} />
      <div className="grid grid-cols-2 gap-2">
        <Input label="Halaga (₱)" type="number" inputMode="decimal" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
        <Input label="Petsa" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
      </div>
      <Select label="Kategorya" options={categories.length ? categories : ["Iba pa"]} value={category} onChange={(e) => setCategory(e.target.value)} />
      <label className="block cursor-pointer">
        {receipt ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={receipt} alt="Resibo" className="max-h-56 w-full rounded-xl object-contain" />
        ) : (
          <span className="flex items-center justify-center gap-2 rounded-xl border-2 border-dashed border-brand/30 bg-brand-light py-3 text-sm font-bold text-brand">
            <Camera className="h-4 w-4" /> Litrato ng resibo (optional)
          </span>
        )}
        <input type="file" accept="image/*" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ""; }} />
      </label>
      <ErrorText>{error}</ErrorText>
      <Button full loading={busy} onClick={save}>Itala ang gastos</Button>
    </div>
  );
}

function ReceiptView({ id }: { id: string }) {
  const [photo, setPhoto] = useState<string | null>(null);
  useEffect(() => {
    getDoc(doc(db, "expenseReceipts", id))
      .then((s) => setPhoto((s.data()?.photo as string) ?? ""))
      .catch(() => setPhoto(""));
  }, [id]);
  if (photo === null) return <Spinner />;
  // eslint-disable-next-line @next/next/no-img-element
  return photo ? <img src={photo} alt="Resibo" className="w-full rounded-xl" /> : <p className="text-sm text-gray-500">Walang resibo.</p>;
}

/* ---------------- Page ---------------- */

export default function PondoPage() {
  const { isOfficer } = useAuth();
  const toast = useToast();
  const thisYear = new Date().getFullYear();
  const [year, setYear] = useState(thisYear);
  const [budget, setBudget] = useState<Budget | null>(null);
  const [budgetLoading, setBudgetLoading] = useState(true);
  const [editBudget, setEditBudget] = useState(false);
  const [addExpense, setAddExpense] = useState(false);
  const [receiptId, setReceiptId] = useState<string | null>(null);

  useEffect(() => {
    setBudgetLoading(true);
    return onSnapshot(
      doc(db, "budgets", String(year)),
      (s) => {
        setBudget(s.exists() ? (s.data() as Budget) : null);
        setBudgetLoading(false);
      },
      () => setBudgetLoading(false),
    );
  }, [year]);

  const q = useMemo(() => query(collection(db, "expenses"), where("year", "==", year)), [year]);
  const { data: expenses, loading } = useCollection<Expense>(q);
  const sorted = useMemo(() => [...expenses].sort((a, b) => b.date.localeCompare(a.date)), [expenses]);
  const spent = expenses.reduce((s, e) => s + e.amount, 0);
  const total = budget?.total ?? 0;
  const pct = total > 0 ? Math.min(100, Math.round((spent / total) * 100)) : 0;
  const spentBy = (name: string) => expenses.filter((e) => e.category === name).reduce((s, e) => s + e.amount, 0);
  const catNames = budget?.categories.map((c) => c.name) ?? DEFAULT_CATEGORIES;

  const remove = async (e: Expense) => {
    if (!confirm(`Burahin ang gastos na "${e.description}"?`)) return;
    try {
      await deleteDoc(doc(db, "expenses", e.id));
      if (e.hasReceipt) await deleteDoc(doc(db, "expenseReceipts", e.id)).catch(() => undefined);
      logActivity("Transparency", `Binura ang gastos: ${e.description} (${formatPeso(e.amount)})`, e.id);
    } catch (err) {
      toast(friendlyError(err), "error");
    }
  };

  const years = [thisYear + 1, thisYear, thisYear - 1, thisYear - 2];

  return (
    <div>
      <PageHeader title="Pondo ng Barangay" subtitle="Full Disclosure: saan napupunta ang pondo" />
      <div className="mb-3 flex items-center gap-2">
        <Select label="Taon" options={years.map(String)} value={String(year)} onChange={(e) => setYear(Number(e.target.value))} />
      </div>

      {budgetLoading ? (
        <Spinner />
      ) : (
        <section className="mb-4 rounded-2xl bg-gradient-to-br from-brand to-brand-deep p-4 text-white shadow-float">
          <p className="text-xs text-white/75">Kabuuang budget {year}</p>
          <p className="text-2xl font-extrabold">{budget ? formatPeso(total) : "Hindi pa nailalagay"}</p>
          {budget && (
            <>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/20">
                <div className="h-full bg-gold" style={{ width: `${pct}%` }} />
              </div>
              <p className="mt-1 text-xs text-white/85">
                {formatPeso(spent)} nagastos ({pct}%) · {formatPeso(Math.max(0, total - spent))} natitira
              </p>
            </>
          )}
          {isOfficer && (
            <button onClick={() => setEditBudget(true)} className="mt-2 flex items-center gap-1 text-xs font-bold text-gold">
              <Pencil className="h-3.5 w-3.5" /> {budget ? "Ayusin ang budget" : "Ilagay ang budget"}
            </button>
          )}
        </section>
      )}

      {budget && budget.categories.length > 0 && (
        <Card className="mb-4 space-y-2.5">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-500">Saan napupunta</p>
          {budget.categories.map((c) => {
            const used = spentBy(c.name);
            const p = c.allocated > 0 ? Math.min(100, Math.round((used / c.allocated) * 100)) : 0;
            return (
              <div key={c.name}>
                <div className="flex justify-between gap-2 text-[0.82rem]">
                  <span className="truncate font-semibold">{c.name}</span>
                  <span className="shrink-0 tabular-nums text-gray-600">{formatPeso(used)} / {formatPeso(c.allocated)}</span>
                </div>
                <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100">
                  <div className={`h-full ${p >= 100 ? "bg-red-500" : "bg-brand"}`} style={{ width: `${p}%` }} />
                </div>
              </div>
            );
          })}
        </Card>
      )}

      <div className="mb-2 flex items-center justify-between">
        <p className="text-base font-bold">Mga gastos</p>
        {isOfficer && (
          <Button variant="gold" className="!min-h-0 !py-1.5 text-sm" onClick={() => setAddExpense(true)}>
            <Plus className="h-4 w-4" /> Gastos
          </Button>
        )}
      </div>
      {loading ? (
        <Spinner />
      ) : sorted.length === 0 ? (
        <EmptyState icon={<Landmark />} title="Wala pang naitalang gastos ngayong taon" />
      ) : (
        <ul className="divide-y divide-gray-100 overflow-hidden rounded-2xl bg-white shadow-card">
          {sorted.map((e) => (
            <li key={e.id} className="flex items-center gap-3 px-3 py-2.5">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{e.description}</p>
                <p className="text-xs text-gray-500">{formatDate(e.date)} · {e.category}</p>
                {e.hasReceipt && (
                  <button onClick={() => setReceiptId(e.id)} className="mt-0.5 flex items-center gap-1 text-xs font-bold text-brand">
                    <Receipt className="h-3.5 w-3.5" /> Tingnan ang resibo
                  </button>
                )}
              </div>
              <p className="shrink-0 font-extrabold tabular-nums">{formatPeso(e.amount)}</p>
              {isOfficer && (
                <button onClick={() => remove(e)} className="p-1 text-red-700" aria-label={`Burahin ang ${e.description}`}>
                  <Trash2 className="h-4 w-4" />
                </button>
              )}
            </li>
          ))}
        </ul>
      )}

      <Modal open={editBudget} onClose={() => setEditBudget(false)} title={`Budget ${year}`}>
        {editBudget && <BudgetForm year={year} budget={budget} onDone={() => setEditBudget(false)} />}
      </Modal>
      <Modal open={addExpense} onClose={() => setAddExpense(false)} title="Bagong gastos">
        {addExpense && <ExpenseForm year={year} categories={catNames} onDone={() => setAddExpense(false)} />}
      </Modal>
      <Modal open={!!receiptId} onClose={() => setReceiptId(null)} title="Resibo">
        {receiptId && <ReceiptView id={receiptId} />}
      </Modal>
    </div>
  );
}
