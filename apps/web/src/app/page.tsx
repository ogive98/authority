export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-zinc-950 px-6 text-zinc-100">
      <p className="font-mono text-sm uppercase tracking-widest text-teal-400">
        SOC-01
      </p>
      <h1 className="mt-4 text-4xl font-semibold tracking-tight">AUTHORITY</h1>
      <p className="mt-3 max-w-md text-center text-zinc-400">
        Shell UI — socle API + web. Les modules métier arrivent après Thunder
        Core et le registry.
      </p>
      <p className="mt-8 font-mono text-xs text-zinc-500">
        API health:{" "}
        <a
          className="text-teal-400 hover:underline"
          href="http://localhost:3001/health/live"
          target="_blank"
          rel="noreferrer"
        >
          /health/live
        </a>
      </p>
    </main>
  );
}
