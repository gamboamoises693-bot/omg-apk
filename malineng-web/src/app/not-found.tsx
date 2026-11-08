import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <p className="text-6xl font-black text-brand">404</p>
      <p className="mt-2 text-lg text-gray-700">Hindi mahanap ang page na ito.</p>
      <Link href="/" className="mt-6 inline-block rounded-xl bg-brand px-6 py-3 font-bold text-white">Bumalik sa Home</Link>
    </div>
  );
}
