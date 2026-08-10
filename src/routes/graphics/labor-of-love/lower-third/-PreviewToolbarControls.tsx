import type { LaborOfLoveLowerThirdProps } from './-types'

export function PreviewToolbarControls({
    workerName,
    championshipName,
    onChange,
}: {
    workerName: string
    championshipName: string
    onChange: (patch: Partial<LaborOfLoveLowerThirdProps>) => void
}) {
    return (
        <div className="flex max-w-[min(100vw,72rem)] flex-wrap items-center justify-center gap-x-4 gap-y-3 border-l border-slate-600 pl-4">
            <label className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Worker</span>
                <input
                    type="text"
                    className="min-w-56 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white"
                    value={workerName}
                    onChange={(e) => onChange({ workerName: e.target.value })}
                />
            </label>
            <label className="flex items-center gap-2">
                <span className="text-xs font-medium uppercase tracking-wide text-slate-400">Championship</span>
                <input
                    type="text"
                    className="min-w-56 rounded-md border border-slate-600 bg-slate-800 px-2 py-1.5 text-sm text-white"
                    value={championshipName}
                    onChange={(e) => onChange({ championshipName: e.target.value })}
                />
            </label>
        </div>
    )
}
