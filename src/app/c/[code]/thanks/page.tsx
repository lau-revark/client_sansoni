export default function ThanksPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-navy px-4">
      <div className="w-full max-w-md rounded-2xl bg-surface p-8 text-center shadow-xl">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-good/10 text-2xl text-good">✓</div>
        <h1 className="mt-4 text-2xl font-bold text-ink">You're in!</h1>
        <p className="mt-2 text-ink-2">Payment received. A confirmation is on its way to your email. Please show this screen to the team.</p>
      </div>
    </main>
  );
}
