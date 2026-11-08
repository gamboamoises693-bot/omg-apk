"use client";

import { useState } from "react";
import Link from "next/link";
import { Ambulance, Flame, Phone, ShieldAlert } from "lucide-react";
import { useSettings } from "@/lib/useSettings";
import { telHref } from "@/lib/format";
import { Modal, PageHeader, SectionTitle, Spinner } from "@/components/ui";
import { HotlineList } from "@/components/HotlineList";

export default function EmergencyPage() {
  const { settings, loading } = useSettings();
  const [selected, setSelected] = useState<{ label: string; number: string } | null>(null);

  const buttons = [
    { label: "TANOD", sub: "Gulo, nakawan, aksidente", number: settings.emergencyNumbers.tanod, icon: ShieldAlert },
    { label: "HEALTH CENTER", sub: "May sakit, kailangan ng doktor", number: settings.emergencyNumbers.healthCenter, icon: Ambulance },
    { label: "BFP (BUMBERO)", sub: "Sunog", number: settings.emergencyNumbers.bfp, icon: Flame },
  ];

  return (
    <div>
      <PageHeader title="Emergency" subtitle="Pindutin para makita ang number at tumawag agad" />
      {loading ? (
        <Spinner />
      ) : (
        <div className="space-y-4">
          {buttons.map(({ label, sub, number, icon: Icon }) => (
            <button
              key={label}
              onClick={() => setSelected({ label, number })}
              className="flex w-full items-center gap-4 rounded-3xl bg-red-600 p-6 text-left text-white shadow-lg active:scale-[0.98] active:bg-red-700"
            >
              <Icon className="h-14 w-14 shrink-0" aria-hidden />
              <span>
                <span className="block text-xl font-black">{label}</span>
                <span className="block text-white/90">{sub}</span>
              </span>
            </button>
          ))}
          <a href="tel:911" className="flex w-full items-center justify-center gap-3 rounded-3xl border-4 border-red-600 bg-white p-5 text-2xl font-black text-red-600">
            <Phone className="h-8 w-8" /> 911 (National)
          </a>
          <Link href="/ambulansya" className="flex w-full items-center justify-center gap-3 rounded-3xl bg-white p-5 text-xl font-black text-red-600 ring-2 ring-red-200">
            <Ambulance className="h-8 w-8" /> Ambulansya ng Barangay
          </Link>
          <SectionTitle>Cuyapo Hotlines</SectionTitle>
          <HotlineList hotlines={settings.hotlines} />
        </div>
      )}

      <Modal open={!!selected} onClose={() => setSelected(null)} title={selected?.label ?? ""}>
        {selected && (
          <div className="text-center">
            {selected.number ? (
              <>
                <p className="text-3xl font-black tracking-wide text-red-600">{selected.number}</p>
                <a href={telHref(selected.number)} className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-red-600 py-5 text-2xl font-black text-white">
                  <Phone className="h-8 w-8" /> TAWAGAN NA
                </a>
              </>
            ) : (
              <p className="text-gray-600">Wala pang naka-set na number. Tumawag sa 911 o pumunta sa Barangay Hall.</p>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
