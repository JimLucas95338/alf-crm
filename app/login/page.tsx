export default function LoginPage({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  return <LoginForm searchParams={searchParams} />;
}

async function LoginForm({ searchParams }: { searchParams: Promise<{ error?: string; next?: string }> }) {
  const sp = await searchParams;
  return (
    <div className="max-w-md mx-auto mt-24 panel p-8">
      <h1 className="text-xl font-semibold mb-1">ALF CRM</h1>
      <p className="text-sm mb-6" style={{ color: "var(--muted)" }}>Sign in to continue</p>
      <form method="post" action="/api/login" className="space-y-3">
        <input type="hidden" name="next" value={sp.next || "/"} />
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Email</label>
          <input className="input" type="email" name="email" required autoFocus />
        </div>
        <div>
          <label className="text-xs block mb-1" style={{ color: "var(--muted)" }}>Team password</label>
          <input className="input" type="password" name="password" required />
        </div>
        {sp.error && <div className="text-sm" style={{ color: "var(--danger)" }}>{sp.error}</div>}
        <button className="btn w-full mt-2" type="submit">Sign in</button>
      </form>
    </div>
  );
}
