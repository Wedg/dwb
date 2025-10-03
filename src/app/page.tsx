"use client";

import Link from "next/link";
import QRCode from "qrcode.react";

export default function HomePage() {
  // Adjust this to your deployed URL on Vercel (or custom domain)
  const publicBracketsUrl = "https://dwb.vercel.app/brackets";

  return (
    <main className="flex flex-col items-center gap-6 p-8 font-sans">
      <h1 className="text-3xl font-bold text-center">
        Dinner with the Bishop — Tournament Hub
      </h1>
      <p className="text-gray-600 text-center max-w-xl">
        Welcome! Follow the live tournament brackets, view matches, or manage
        players if you are the TD (tournament director).
      </p>

      <div className="grid gap-4 sm:grid-cols-2 mt-6">
        <Link
          href="/brackets"
          className="rounded-lg border border-gray-300 p-6 hover:bg-gray-50 text-center"
        >
          <h2 className="text-xl font-semibold">Brackets (public)</h2>
          <p className="text-gray-500">View live brackets for Main, Lower, and Doubles.</p>
        </Link>

        <Link
          href="/matches"
          className="rounded-lg border border-gray-300 p-6 hover:bg-gray-50 text-center"
        >
          <h2 className="text-xl font-semibold">Matches (public)</h2>
          <p className="text-gray-500">Browse all matches and results.</p>
        </Link>

        <Link
          href="/players"
          className="rounded-lg border border-gray-300 p-6 hover:bg-gray-50 text-center"
        >
          <h2 className="text-xl font-semibold">Players (admin)</h2>
          <p className="text-gray-500">Manage player list and seeding (PIN required).</p>
        </Link>

        <Link
          href="/control"
          className="rounded-lg border border-gray-300 p-6 hover:bg-gray-50 text-center"
        >
          <h2 className="text-xl font-semibold">TD Control (admin)</h2>
          <p className="text-gray-500">Bracket setup, score entry, resets (PIN required).</p>
        </Link>
      </div>

      <div className="mt-10 flex flex-col items-center gap-3">
        <p className="text-gray-600">
          Share this QR code with players to follow the live brackets:
        </p>
        <QRCode value={publicBracketsUrl} size={160} />
        <p className="text-sm text-gray-500">{publicBracketsUrl}</p>
      </div>
    </main>
  );
}
