import { createFileRoute } from '@tanstack/react-router'
import { useState } from 'react'

type SentMessage = {
  to: string
  subject: string
  body: string
  sentAt: string
}

export const Route = createFileRoute('/mock-email')({ component: MockEmailPage })

function MockEmailPage() {
  const [composerOpen, setComposerOpen] = useState(false)
  const [sentMessage, setSentMessage] = useState<SentMessage | null>(null)

  return (
    <main className="page-wrap px-4 pb-8 pt-4">
      <section className="mb-6 rounded-md border border-[var(--line)] bg-[var(--surface-strong)] p-6 shadow-sm">
        <p className="island-kicker mb-2 text-zinc-400">Mock Workflow</p>
        <h1 className="display-title text-3xl font-bold text-zinc-100">Mock Ops Mail</h1>
        <p className="m-0 mt-2 max-w-2xl text-sm text-zinc-400">
          Safe email demo target for showing a browser agent opening compose, drafting a message, and sending it into a local outbox.
        </p>
      </section>

      <section className="grid grid-cols-1 gap-5 lg:grid-cols-[0.72fr_1.28fr]">
        <aside className="island-shell p-5 rounded-md shadow-sm">
          <button
            id="compose-button"
            className="mb-4 w-full rounded-md bg-zinc-800 border border-[var(--line)] hover:bg-zinc-700 px-4 py-2.5 text-sm font-semibold text-zinc-100 transition-colors shadow-sm focus:outline-none focus:ring-2 focus:ring-zinc-500/40"
            onClick={() => setComposerOpen(true)}
          >
            Compose
          </button>

          <div className="space-y-2 text-sm text-zinc-400">
            <p className="m-0 font-semibold text-zinc-300">Folders</p>
            <p className="m-0 hover:text-zinc-200 cursor-pointer transition-colors">Inbox (4)</p>
            <p className="m-0 hover:text-zinc-200 cursor-pointer transition-colors">Drafts (1)</p>
            <p className="m-0 hover:text-zinc-200 cursor-pointer transition-colors">Sent ({sentMessage ? 1 : 0})</p>
          </div>
        </aside>

        <section className="island-shell p-5 rounded-md shadow-sm">
          {composerOpen ? (
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault()
                const formData = new FormData(event.currentTarget)
                setSentMessage({
                  to: String(formData.get('mail-to') ?? ''),
                  subject: String(formData.get('mail-subject') ?? ''),
                  body: String(formData.get('mail-body') ?? ''),
                  sentAt: new Date().toLocaleTimeString(),
                })
                setComposerOpen(false)
              }}
            >
              <div>
                <label htmlFor="mail-to" className="mb-1.5 block text-sm font-semibold text-zinc-300">
                  To
                </label>
                <input id="mail-to" name="mail-to" className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-4 py-2.5 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono" placeholder="ops@relay.dev" />
              </div>

              <div>
                <label htmlFor="mail-subject" className="mb-1.5 block text-sm font-semibold text-zinc-300">
                  Subject
                </label>
                <input id="mail-subject" name="mail-subject" className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-4 py-2.5 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono" placeholder="Relay live agent demo update" />
              </div>

              <div>
                <label htmlFor="mail-body" className="mb-1.5 block text-sm font-semibold text-zinc-300">
                  Body
                </label>
                <textarea id="mail-body" name="mail-body" rows={10} className="w-full rounded-md border border-[var(--line)] bg-[var(--bg-base)] px-4 py-2.5 text-sm shadow-sm outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all font-mono custom-scrollbar" placeholder="Write the update email here." />
              </div>

              <div className="flex gap-3">
                <button id="send-mail" type="submit" className="rounded-md bg-blue-600 hover:bg-blue-500 border border-blue-500 px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-blue-500/40">
                  Send mock email
                </button>
                <button type="button" className="rounded-md border border-[var(--line)] bg-zinc-800 hover:bg-zinc-700 px-5 py-2.5 text-sm font-semibold text-zinc-200 shadow-sm transition-all focus:outline-none focus:ring-2 focus:ring-zinc-500/40" onClick={() => setComposerOpen(false)}>
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="rounded-md border border-dashed border-zinc-700 bg-[var(--bg-base)] p-6 text-sm text-zinc-500 text-center font-mono">
                Composer closed. Press Compose to start a new draft.
              </div>

              {sentMessage && (
                <div className="space-y-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 p-5 text-sm text-emerald-200 shadow-sm font-mono overflow-auto custom-scrollbar">
                  <p className="m-0 font-semibold text-emerald-300">Message sent to outbox at {sentMessage.sentAt}.</p>
                  <p className="m-0"><strong className="text-emerald-400">To:</strong> {sentMessage.to}</p>
                  <p className="m-0"><strong className="text-emerald-400">Subject:</strong> {sentMessage.subject}</p>
                  <p className="m-0 whitespace-pre-wrap"><strong className="text-emerald-400">Body:</strong><br />{sentMessage.body}</p>
                </div>
              )}
            </div>
          )}
        </section>
      </section>
    </main>
  )
}
