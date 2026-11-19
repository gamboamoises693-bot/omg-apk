/** The flag of the Philippines: blue over red, a white triangle, a golden sun with eight rays and three stars. Drawn here, so it works offline. */
export function PhFlag({ className = "h-3.5 w-[1.3125rem]" }: { className?: string }) {
  const ray = "M-0.9 -6.2 L0 -13 L0.9 -6.2Z";
  const star = (x: number, y: number) => {
    const pts = Array.from({ length: 10 }, (_, i) => {
      const r = i % 2 === 0 ? 4.2 : 1.7;
      const a = (Math.PI / 5) * i - Math.PI / 2;
      return `${(x + r * Math.cos(a)).toFixed(2)},${(y + r * Math.sin(a)).toFixed(2)}`;
    }).join(" ");
    return <polygon key={`${x}-${y}`} points={pts} fill="#FCD116" />;
  };
  return (
    <svg viewBox="0 0 90 60" className={`${className} shrink-0 rounded-[2px] shadow-[0_1px_3px_rgba(0,0,0,.5)]`} role="img" aria-label="Watawat ng Pilipinas">
      <rect width="90" height="30" fill="#0038A8" />
      <rect y="30" width="90" height="30" fill="#CE1126" />
      <path d="M0 0 L52 30 L0 60 Z" fill="#fff" />
      <g fill="#FCD116" transform="translate(17,30)">
        <circle r="5.2" />
        {Array.from({ length: 8 }, (_, i) => <path key={i} d={ray} transform={`rotate(${i * 45})`} />)}
      </g>
      {star(4.5, 9)}
      {star(4.5, 51)}
      {star(43, 30)}
    </svg>
  );
}

/** A thin blue and red stripe, and "REPUBLIKA NG PILIPINAS" with the flag, at the very top of every page. */
export function PhilippinesBanner() {
  return (
    <div className="no-print" data-no-i18n translate="no">
      <div className="flex h-2" aria-hidden>
        <i className="flex-1 bg-[#0038A8]" />
        <i className="flex-1 bg-[#CE1126]" />
      </div>
      <div className="flex items-center justify-center gap-2 bg-[#0A1B3C] py-1 text-[0.6rem] font-bold tracking-[0.22em] text-white/85">
        <PhFlag /> REPUBLIKA NG PILIPINAS
      </div>
    </div>
  );
}
