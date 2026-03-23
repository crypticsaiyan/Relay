import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

export const Route = createFileRoute('/mock-form')({ component: MockFormPage })

function MockFormPage() {
  const [submitted, setSubmitted] = useState<null | {
    name: string
    email: string
    company: string
    useCase: string
  }>(null)

  return (
    <main className="page-wrap px-4 pb-8 pt-4">
      <section className="mb-6 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-sm">
        <p className="island-kicker mb-2 text-zinc-400">Mock Workflow</p>
        <h1 className="display-title text-3xl font-bold text-zinc-100">Lead Intake Form</h1>
        <p className="m-0 mt-2 max-w-2xl text-sm text-zinc-400">
          Safe demo target for showing a browser agent filling a multi-field form and submitting it while Relay streams every action.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <form
          className="island-shell space-y-5 rounded-md p-6 shadow-sm border border-[var(--line)]"
          onSubmit={(event) => {
            event.preventDefault()
            const formData = new FormData(event.currentTarget)
            setSubmitted({
              name: String(formData.get('lead-name') ?? ''),
              email: String(formData.get('lead-email') ?? ''),
              company: String(formData.get('lead-company') ?? ''),
              useCase: String(formData.get('lead-use-case') ?? ''),
            })
          }}
        >
          <div>
            <label htmlFor="lead-name" className="mb-1.5 block text-sm font-semibold text-zinc-300">
              Full name
            </label>
            <input id="lead-name" name="lead-name" className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-4 py-2.5 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono" placeholder="Ava Patel" />
          </div>

          <div>
            <label htmlFor="lead-email" className="mb-1.5 block text-sm font-semibold text-zinc-300">
              Work email
            </label>
            <input id="lead-email" name="lead-email" type="email" className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-4 py-2.5 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono" placeholder="ava@company.com" />
          </div>

          <div>
            <label htmlFor="lead-company" className="mb-1.5 block text-sm font-semibold text-zinc-300">
              Company
            </label>
            <input id="lead-company" name="lead-company" className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-4 py-2.5 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono" placeholder="Relay Labs" />
          </div>

          <div>
            <label htmlFor="lead-use-case" className="mb-1.5 block text-sm font-semibold text-zinc-300">
              Use case
            </label>
            <textarea id="lead-use-case" name="lead-use-case" rows={5} className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-4 py-2.5 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono custom-scrollbar" placeholder="We want to watch our agent work in real time." />
          </div>

          <button id="submit-lead" type="submit" className="rounded-md border border-blue-500 bg-blue-600 hover:bg-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40">
            Submit lead
          </button>
        </form>

        <aside className="island-shell rounded-md p-6 shadow-sm border border-[var(--line)]">
          <p className="island-kicker mb-4">Submission Status</p>
          {submitted ? (
            <div className="space-y-4 text-sm text-zinc-300 font-mono">
              <div className="rounded-md border border-emerald-500/40 bg-emerald-500/10 p-4 text-emerald-300 shadow-sm font-semibold text-center">
                Lead submitted successfully.
              </div>
              <div className="space-y-2 p-3 bg-[var(--bg-base)] border border-[var(--line)] rounded-md shadow-inner">
                <p className="m-0"><strong className="text-zinc-500 uppercase tracking-wider text-[10px] mr-2">Name:</strong> {submitted.name}</p>
                <p className="m-0"><strong className="text-zinc-500 uppercase tracking-wider text-[10px] mr-2">Email:</strong> {submitted.email}</p>
                <p className="m-0"><strong className="text-zinc-500 uppercase tracking-wider text-[10px] mr-2">Company:</strong> {submitted.company}</p>
                <p className="m-0 leading-relaxed"><strong className="text-zinc-500 uppercase tracking-wider text-[10px] block mb-1">Use case:</strong> {submitted.useCase}</p>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center p-8 text-center text-sm font-mono text-zinc-500 border border-dashed border-zinc-700 bg-[var(--bg-base)] rounded-md min-h-[200px]">
              <span className="text-2xl mb-3 opacity-50 block">📄</span>
              No submission yet.<br/>This panel updates after the form is sent.
            </div>
          )}
        </aside>
      </section>
    </main>
  )
}
