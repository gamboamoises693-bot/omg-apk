"use client";

import Link from "next/link";
import {
  FileText,
  HeartHandshake,
  Receipt,
  ShieldAlert,
  Store,
  MessagesSquare,
  Briefcase,
  Wrench,
  Siren,
  Search,
  HandCoins,
  CalendarCheck,
  CalendarDays,
  Vote,
  Trophy,
  ClipboardList,
  Megaphone,
  Phone,
  UserRound,
} from "lucide-react";
import { useSettings } from "@/lib/useSettings";
import { Card, LinkButton, SectionTitle, Spinner } from "@/components/ui";
import { formatDate, telHref } from "@/lib/format";
import { BARANGAY_CITY } from "@/lib/constants";
import { HotlineList } from "@/components/HotlineList";

const QUICK_SERVICES = [
  { label: "Barangay Clearance", icon: FileText, service: "Barangay Clearance" },
  { label: "Indigency", icon: HeartHandshake, service: "Indigency" },
  { label: "Cedula", icon: Receipt, service: "Cedula" },
  { label: "Blotter / Report", icon: ShieldAlert, service: "Blotter" },
] as const;

const ALL_FEATURES = [
  { href: "/tindahan", label: "Tindahan", icon: Store, color: "bg-gold-light text-yellow-800" },
  { href: "/board", label: "Community Board", icon: MessagesSquare, color: "bg-blue-50 text-blue-700" },
  { href: "/trabaho", label: "Trabaho", icon: Briefcase, color: "bg-brand-light text-brand" },
  { href: "/skills", label: "Skills", icon: Wrench, color: "bg-orange-50 text-orange-700" },
  { href: "/ayuda", label: "Ayuda Checker", icon: HandCoins, color: "bg-emerald-50 text-emerald-700" },
  { href: "/appointment", label: "Appointment", icon: CalendarCheck, color: "bg-purple-50 text-purple-700" },
  { href: "/lost-found", label: "Lost & Found", icon: Search, color: "bg-pink-50 text-pink-700" },
  { href: "/register-event", label: "Magparehistro", icon: ClipboardList, color: "bg-teal-50 text-teal-700" },
  { href: "/events", label: "Events", icon: CalendarDays, color: "bg-indigo-50 text-indigo-700" },
  { href: "/botohan", label: "Botohan", icon: Vote, color: "bg-cyan-50 text-cyan-700" },
  { href: "/purok", label: "Purok Points", icon: Trophy, color: "bg-amber-50 text-amber-700" },
  { href: "/emergency", label: "Emergency", icon: Siren, color: "bg-red-50 text-red-700" },
] as const;

export default function HomePage() {
  const { settings, loading } = useSettings();
  const punong = settings.officials.find((o) => /punong/i.test(o.position));
  const others = settings.officials.filter((o) => o !== punong);

  const emergency = [
    { label: "Tanod", number: settings.emergencyNumbers.tanod },
    { label: "Health Center", number: settings.emergencyNumbers.healthCenter },
    { label: "BFP (Bumbero)", number: settings.emergencyNumbers.bfp },
  ];

  return (
    <div>
      {/* Hero */}
      <section className="-mx-4 -mt-4 bg-gradient-to-b from-brand to-brand-dark px-5 pb-8 pt-7 text-white">
        <p className="text-sm font-semibold uppercase tracking-wider text-gold">Barangay Malineng</p>
        <h1 className="mt-1 text-3xl font-extrabold leading-tight">Serbisyong Tapat, Para sa Malineng</h1>
        <p className="mt-2 text-white/85">Kumuha ng dokumento, mag-report, bumili at magbenta — lahat dito na.</p>
        <div className="mt-5 grid grid-cols-2 gap-3">
          <LinkButton href="/appointment?service=Barangay%20Clearance" variant="gold">
            <FileText className="h-5 w-5" /> Kumuha ng Clearance
          </LinkButton>
          <LinkButton href="/appointment?service=Blotter" variant="outline">
            <ShieldAlert className="h-5 w-5" /> Mag-report
          </LinkButton>
        </div>
      </section>

      {/* Quick services */}
      <SectionTitle>Mabilis na Serbisyo</SectionTitle>
      <div className="grid grid-cols-2 gap-3">
        {QUICK_SERVICES.map(({ label, icon: Icon, service }) => (
          <Link
            key={service}
            href={`/appointment?service=${encodeURIComponent(service)}`}
            className="flex flex-col items-center gap-2 rounded-2xl bg-white p-4 text-center shadow-sm ring-1 ring-gray-100 active:bg-brand-light"
          >
            <span className="rounded-full bg-brand-light p-3 text-brand">
              <Icon className="h-7 w-7" aria-hidden />
            </span>
            <span className="font-bold text-gray-800">{label}</span>
          </Link>
        ))}
      </div>

      {/* All features */}
      <SectionTitle>Lahat ng Serbisyo</SectionTitle>
      <div className="grid grid-cols-3 gap-3">
        {ALL_FEATURES.map(({ href, label, icon: Icon, color }) => (
          <Link key={href} href={href} className="flex flex-col items-center gap-2 rounded-2xl bg-white p-3 text-center shadow-sm ring-1 ring-gray-100 active:scale-95">
            <span className={`rounded-xl p-3 ${color}`}>
              <Icon className="h-6 w-6" aria-hidden />
            </span>
            <span className="text-sm font-semibold leading-tight text-gray-800">{label}</span>
          </Link>
        ))}
      </div>

      {loading ? (
        <Spinner />
      ) : (
        <>
          {/* Announcements */}
          <SectionTitle>Mga Anunsyo</SectionTitle>
          {settings.announcements.length === 0 ? (
            <Card className="text-gray-500">Wala pang anunsyo sa ngayon.</Card>
          ) : (
            <div className="space-y-3">
              {settings.announcements.map((a, i) => (
                <Card key={`${a.title}-${i}`} className="border-l-4 border-gold">
                  <div className="flex items-start gap-3">
                    <Megaphone className="mt-1 h-5 w-5 shrink-0 text-gold-dark" aria-hidden />
                    <div>
                      <p className="font-bold">{a.title}</p>
                      {a.date && <p className="text-sm text-gray-500">{formatDate(a.date)}</p>}
                      <p className="mt-1 whitespace-pre-line text-gray-700">{a.body}</p>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Officials */}
          <SectionTitle>Mga Opisyal ng Barangay</SectionTitle>
          {settings.officials.length === 0 ? (
            <Card className="text-gray-500">Ilalagay pa ng admin ang listahan ng opisyal.</Card>
          ) : (
            <>
              {punong && (
                <Card className="mb-3 flex items-center gap-4 bg-brand text-white">
                  <span className="rounded-full bg-gold p-3 text-brand-dark">
                    <UserRound className="h-8 w-8" aria-hidden />
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-gold">{punong.position}</p>
                    <p className="text-xl font-bold">{punong.name}</p>
                  </div>
                </Card>
              )}
              <div className="grid grid-cols-2 gap-3">
                {others.map((o, i) => (
                  <Card key={`${o.name}-${i}`} className="text-center">
                    <UserRound className="mx-auto mb-1 h-8 w-8 text-brand" aria-hidden />
                    <p className="font-bold leading-tight">{o.name}</p>
                    <p className="text-sm text-gray-500">{o.position}</p>
                  </Card>
                ))}
              </div>
            </>
          )}

          {/* Transparency */}
          <SectionTitle>Transparency: Mga Proyekto</SectionTitle>
          <Card className="space-y-4">
            {settings.projects.length === 0 && <p className="text-gray-500">Wala pang naka-post na proyekto.</p>}
            {settings.projects.map((p, i) => {
              const pct = Math.min(100, Math.max(0, Number(p.progress) || 0));
              return (
                <div key={`${p.name}-${i}`}>
                  <div className="mb-1 flex justify-between gap-2 font-semibold">
                    <span>{p.name}</span>
                    <span className="shrink-0 text-brand">{pct === 100 ? "✅ Tapos na" : `${pct}%`}</span>
                  </div>
                  <div className="h-4 overflow-hidden rounded-full bg-gray-200" role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={p.name}>
                    <div className="h-full rounded-full bg-gradient-to-r from-brand to-gold transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </Card>

          {/* Emergency */}
          <SectionTitle>Emergency Contacts</SectionTitle>
          <div className="space-y-3">
            {emergency.map((e) => (
              <Card key={e.label} className="flex items-center justify-between">
                <div>
                  <p className="font-bold">{e.label}</p>
                  <p className="text-gray-600">{e.number || "Wala pang number"}</p>
                </div>
                {e.number && (
                  <a href={telHref(e.number)} className="flex items-center gap-2 rounded-xl bg-red-600 px-4 py-3 font-bold text-white">
                    <Phone className="h-5 w-5" /> Tawagan
                  </a>
                )}
              </Card>
            ))}
          </div>

          <SectionTitle>Cuyapo Hotlines</SectionTitle>
          <HotlineList hotlines={settings.hotlines} />
          <a href="tel:911" className="mt-3 flex items-center justify-between rounded-2xl border-2 border-red-600 bg-white p-4 font-bold text-red-600">
            <span>Nationwide Emergency Hotline</span>
            <span className="flex items-center gap-2"><Phone className="h-5 w-5" /> 911</span>
          </a>
        </>
      )}

      <p className="mt-8 text-center text-sm text-gray-400">© {new Date().getFullYear()} Barangay Malineng, {BARANGAY_CITY}</p>
    </div>
  );
}
