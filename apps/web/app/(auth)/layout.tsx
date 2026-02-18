/**
 * Auth layout — centered card with Orbyt branding and space background.
 * No sidebar, no nav — just the auth form.
 */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-screen flex-col items-center justify-center bg-bg px-4 py-12">
      {/* Orbital background decoration */}
      <div
        className="pointer-events-none absolute inset-0 overflow-hidden"
        aria-hidden="true"
      >
        {/* Large orbital ring */}
        <div
          className="absolute -top-32 left-1/2 h-[600px] w-[600px] -translate-x-1/2 rounded-full"
          style={{
            background:
              "radial-gradient(circle, rgb(var(--color-accent) / 0.04) 0%, transparent 70%)",
            border: "1px solid rgb(var(--color-accent) / 0.08)",
          }}
        />
        {/* Small orbital ring */}
        <div
          className="absolute -top-16 left-1/2 h-[300px] w-[300px] -translate-x-1/2 rounded-full"
          style={{
            border: "1px solid rgb(var(--color-accent) / 0.12)",
          }}
        />
      </div>

      {/* Orbyt logo */}
      <div className="relative mb-8 flex flex-col items-center gap-2">
        <div
          className="flex h-12 w-12 items-center justify-center rounded-xl"
          style={{
            background:
              "linear-gradient(135deg, rgb(var(--color-accent)), rgb(var(--color-accent-hover)))",
            boxShadow: "0 0 20px rgb(var(--color-accent) / 0.4)",
          }}
        >
          {/* Placeholder logo — replace with SVG */}
          <span className="font-display text-xl font-bold text-bg">O</span>
        </div>
        <h1 className="font-display text-2xl font-bold tracking-tight text-text glow-text">
          Orbyt
        </h1>
        <p className="text-sm text-text-muted">Your Family&apos;s AI Butler</p>
      </div>

      {/* Auth form card */}
      <div className="relative w-full max-w-md">
        <div className="glass-card p-8">
          {children}
        </div>
      </div>
    </div>
  );
}
