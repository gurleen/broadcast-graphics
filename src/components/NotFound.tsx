export function NotFound() {
  return (
    <div className="page-shell flex min-h-full flex-col items-center justify-center p-8 text-center">
      <h1 className="text-3xl font-bold">Not found</h1>
      <p className="mt-2 text-slate-400">This route does not exist.</p>
      <a
        href="/"
        className="mt-6 text-sky-400 underline-offset-2 hover:underline"
      >
        Back to index
      </a>
    </div>
  )
}
