"use client";

import { PageHeader } from "@/components/ui";
import { RaffleCard } from "@/components/RaffleCard";

export default function RafflePage() {
  return (
    <div>
      <PageHeader title="Raffle" subtitle="Para sa mga verified na taga-Malineng" />
      <RaffleCard full />
    </div>
  );
}
