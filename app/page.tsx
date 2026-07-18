export default function Home() {
  return (
    <main className="flex min-h-screen items-center justify-center p-8">
      <div className="max-w-xl space-y-3 text-center">
        <p className="text-sm font-medium uppercase tracking-[0.2em] text-zinc-500">
          Hackathon starter
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">
          Ready to build
        </h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          The generic scaffold is running. Product-specific implementation
          starts during the event.
        </p>
      </div>
    </main>
  );
}
