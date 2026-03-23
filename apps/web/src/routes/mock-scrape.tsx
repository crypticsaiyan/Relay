import { createFileRoute } from '@tanstack/react-router'
import { useMemo, useState } from 'react'

export const Route = createFileRoute('/mock-scrape')({ component: MockScrapePage })

type RecordRow = {
  account: string
  sector: string
  intent: 'High' | 'Medium'
  arr: string
  owner: string
}

const RECORDS: RecordRow[] = [
  { account: 'Northstar Health', sector: 'Healthcare', intent: 'High', arr: '$82k', owner: 'Maya' },
  { account: 'Kepler Freight', sector: 'Logistics', intent: 'Medium', arr: '$41k', owner: 'Dane' },
  { account: 'Harbor Retail', sector: 'Commerce', intent: 'High', arr: '$64k', owner: 'Jules' },
  { account: 'Atlas Legal', sector: 'Legal', intent: 'Medium', arr: '$27k', owner: 'Rina' },
  { account: 'Signal Grid', sector: 'Infrastructure', intent: 'High', arr: '$91k', owner: 'Ishaan' },
]

function MockScrapePage() {
  const [highIntentOnly, setHighIntentOnly] = useState(false)
  const [tableView, setTableView] = useState(false)

  const visibleRecords = useMemo(
    () => highIntentOnly ? RECORDS.filter((row) => row.intent === 'High') : RECORDS,
    [highIntentOnly]
  )

  return (
    <main className="page-wrap px-4 pb-8 pt-4">
      <section className="mb-6 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-sm">
        <p className="island-kicker mb-2 text-zinc-400">Mock Workflow</p>
        <h1 className="display-title text-3xl font-bold text-zinc-100">Revenue Signal Dataset</h1>
        <p className="m-0 mt-2 max-w-2xl text-sm text-zinc-400">
          Legacy local fallback for the scrape demo. The default `mock-scrape` browser workflow now points at Books to Scrape, a public site explicitly meant for scraping demos.
        </p>
      </section>

      <section className="mb-5 grid grid-cols-1 gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="island-shell p-5 rounded-md shadow-sm border border-[var(--line)]">
          <p className="island-kicker mb-3">Controls</p>
          <div className="flex flex-wrap gap-2">
            <button
              id="filter-high-intent"
              className={`rounded-md px-4 py-2 text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-500/40 ${highIntentOnly ? 'bg-zinc-100 text-zinc-900 border border-zinc-200 hover:bg-zinc-200' : 'border border-[var(--line)] bg-[var(--bg-base)] text-zinc-300 hover:bg-zinc-800'}`}
              onClick={() => setHighIntentOnly(true)}
            >
              High intent only
            </button>
            <button
              className={`rounded-md px-4 py-2 text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-500/40 ${!highIntentOnly ? 'bg-zinc-100 text-zinc-900 border border-zinc-200 hover:bg-zinc-200' : 'border border-[var(--line)] bg-[var(--bg-base)] text-zinc-300 hover:bg-zinc-800'}`}
              onClick={() => setHighIntentOnly(false)}
            >
              All records
            </button>
            <button
              id="view-table"
              className={`rounded-md px-4 py-2 text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-500/40 ml-auto ${tableView ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500' : 'border border-[var(--line)] bg-[var(--bg-base)] text-zinc-300 hover:bg-zinc-800'}`}
              onClick={() => setTableView(true)}
            >
              Table view
            </button>
            <button
              className={`rounded-md px-4 py-2 text-xs font-semibold shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-500/40 ${!tableView ? 'bg-blue-600 text-white border-blue-500 hover:bg-blue-500' : 'border border-[var(--line)] bg-[var(--bg-base)] text-zinc-300 hover:bg-zinc-800'}`}
              onClick={() => setTableView(false)}
            >
              Card view
            </button>
          </div>
        </div>

        <div className="island-shell p-5 rounded-md shadow-sm border border-[var(--line)] text-sm text-zinc-400 font-mono">
          <p className="island-kicker mb-3">Overview</p>
          <p className="m-0"><strong className="text-zinc-200 uppercase tracking-wider text-[10px] mr-2">Visible records:</strong> {visibleRecords.length}</p>
          <p className="m-0 mt-1"><strong className="text-zinc-200 uppercase tracking-wider text-[10px] mr-2">Current filter:</strong> {highIntentOnly ? 'High intent only' : 'All records'}</p>
          <p className="m-0 mt-1"><strong className="text-zinc-200 uppercase tracking-wider text-[10px] mr-2">Current layout:</strong> {tableView ? 'Table view' : 'Card view'}</p>
        </div>
      </section>

      {tableView ? (
        <section className="island-shell p-5 rounded-md shadow-sm border border-[var(--line)] overflow-x-auto custom-scrollbar">
          <table className="w-full border-collapse text-left text-sm font-mono whitespace-nowrap">
            <thead>
              <tr className="border-b border-[var(--line)] text-zinc-500 uppercase tracking-widest text-[10px]">
                <th className="py-3 px-2 font-bold font-sans">Account</th>
                <th className="py-3 px-2 font-bold font-sans">Sector</th>
                <th className="py-3 px-2 font-bold font-sans">Intent</th>
                <th className="py-3 px-2 font-bold font-sans">ARR</th>
                <th className="py-3 px-2 font-bold font-sans">Owner</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300 text-[13px]">
              {visibleRecords.map((row) => (
                <tr key={row.account} className="border-b border-[var(--line)] last:border-b-0 hover:bg-zinc-800/30 transition-colors">
                  <td className="py-3 px-2 font-semibold text-zinc-100">{row.account}</td>
                  <td className="py-3 px-2">{row.sector}</td>
                  <td className="py-3 px-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${row.intent === 'High' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{row.intent}</span>
                  </td>
                  <td className="py-3 px-2">{row.arr}</td>
                  <td className="py-3 px-2 text-zinc-400">{row.owner}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ) : (
        <section className="grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
          {visibleRecords.map((row) => (
            <article key={row.account} className="island-shell p-5 rounded-md shadow-sm border border-[var(--line)] hover:border-zinc-600 transition-colors group">
              <div className="flex justify-between items-start mb-3">
                <p className="m-0 text-base font-bold text-zinc-100">{row.account}</p>
                <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-widest ${row.intent === 'High' ? 'bg-emerald-500/20 text-emerald-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{row.intent}</span>
              </div>
              <div className="space-y-1.5 font-mono text-xs">
                <p className="m-0 text-zinc-400 flex justify-between"><span className="text-zinc-600 uppercase tracking-wider text-[10px]">Sector</span> <span className="text-zinc-300">{row.sector}</span></p>
                <p className="m-0 text-zinc-400 flex justify-between"><span className="text-zinc-600 uppercase tracking-wider text-[10px]">ARR</span> <span className="font-semibold text-zinc-200">{row.arr}</span></p>
                <p className="m-0 text-zinc-400 flex justify-between"><span className="text-zinc-600 uppercase tracking-wider text-[10px]">Owner</span> <span>{row.owner}</span></p>
              </div>
            </article>
          ))}
        </section>
      )}
    </main>
  )
}
