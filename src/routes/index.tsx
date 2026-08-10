import { Link, createFileRoute, useRouter } from '@tanstack/react-router'

export const Route = createFileRoute('/')({ component: Home })

function Home() {
  const router = useRouter()
  const paths = Object.keys(router.routesByPath)
    .filter((p) => p.startsWith('/graphics/'))
    .sort()

  return (
    <div className="page-shell p-8">
      <h1 className="text-4xl font-bold">Broadcast Graphics</h1>
      <p className="mt-4 max-w-2xl text-lg text-slate-300">
        Broadcast graphics at 1920×1080 with transparent backgrounds. Each graphic
        is fully self-contained in{' '}
        <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sm">
          src/routes/graphics/&lt;name&gt;/route.tsx
        </code>
        , with supporting files in the same folder prefixed with{' '}
        <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sm">-</code> (e.g.{' '}
        <code className="rounded bg-slate-800 px-1.5 py-0.5 text-sm">-Scene.tsx</code>) so
        the router ignores them.
      </p>

      <section className="mt-10">
        <h2 className="text-xl font-semibold">Graphics</h2>
        {paths.length === 0 ? (
          <p className="mt-3 text-slate-400">No graphics yet.</p>
        ) : (
          <ul className="mt-4 space-y-3">
            {paths.map((path) => (
              <li key={path} className="flex flex-wrap items-center gap-3">
                <Link
                  to={path}
                  className="font-medium text-sky-400 underline-offset-2 hover:underline"
                >
                  {path}
                </Link>
                <Link
                  to={path}
                  search={{ preview: true }}
                  className="text-sm text-slate-400 underline-offset-2 hover:text-slate-200 hover:underline"
                >
                  preview
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
