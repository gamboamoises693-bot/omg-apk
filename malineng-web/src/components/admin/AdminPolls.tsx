"use client";

import { useMemo, useState, type FormEvent } from "react";
import { addDoc, collection, deleteDoc, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { Trash2 } from "lucide-react";
import { db } from "@/lib/firebase";
import { useAuth } from "@/context/AuthContext";
import { useCollection } from "@/lib/useCollection";
import { friendlyError, sortNewest } from "@/lib/format";
import type { Poll } from "@/lib/types";
import { Badge, Button, Card, Input, SectionTitle, Textarea } from "@/components/ui";
import { useToast } from "@/components/Toast";

const pollsCollection = collection(db, "polls");

export function AdminPolls() {
  const { user } = useAuth();
  const toast = useToast();
  const { data } = useCollection<Poll>(pollsCollection);
  const polls = useMemo(() => sortNewest(data), [data]);
  const [question, setQuestion] = useState("");
  const [optionsText, setOptionsText] = useState("");
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    const options = optionsText.split("\n").map((o) => o.trim()).filter(Boolean);
    if (!user || !question.trim() || options.length < 2) return toast("Kailangan ng tanong at 2+ na pagpipilian.", "error");
    setSaving(true);
    try {
      await addDoc(pollsCollection, { question: question.trim(), options, votes: [], voters: [], createdBy: user.uid, isActive: true, createdAt: serverTimestamp() });
      setQuestion("");
      setOptionsText("");
      toast("Na-create ang botohan.");
    } catch (err) {
      toast(friendlyError(err), "error");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      <Card>
        <form onSubmit={handleSubmit} className="space-y-3">
          <Input label="Tanong" value={question} onChange={(e) => setQuestion(e.target.value)} placeholder="Anong araw ang clean-up drive?" />
          <Textarea label="Mga Pagpipilian (isa bawat linya)" value={optionsText} onChange={(e) => setOptionsText(e.target.value)} placeholder={"Sabado\nLinggo"} />
          <Button type="submit" full loading={saving}>Gumawa ng Botohan</Button>
        </form>
      </Card>
      <SectionTitle>Mga Botohan</SectionTitle>
      <div className="space-y-2">
        {polls.map((p) => (
          <Card key={p.id}>
            <div className="flex items-start justify-between gap-2">
              <p className="font-bold">{p.question}</p>
              <Badge color={p.isActive ? "green" : "gray"}>{p.isActive ? "Bukas" : "Sarado"}</Badge>
            </div>
            <ul className="mt-2 text-gray-700">
              {p.options.map((o, i) => (
                <li key={i}>{o}: <b>{(p.votes ?? []).filter((v) => v.option === i).length}</b></li>
              ))}
            </ul>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => updateDoc(doc(db, "polls", p.id), { isActive: !p.isActive }).catch((err) => toast(friendlyError(err), "error"))}>
                {p.isActive ? "Isara" : "Buksan"}
              </Button>
              <Button
                variant="danger"
                onClick={async () => {
                  if (!confirm("Burahin ang botohan?")) return;
                  try { await deleteDoc(doc(db, "polls", p.id)); } catch (err) { toast(friendlyError(err), "error"); }
                }}
              >
                <Trash2 className="h-5 w-5" /> Burahin
              </Button>
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
