import { PageHeader } from "@/components/admin-v2/composites/PageHeader"

type ShortcutGroup = {
  heading: string
  rows: { keys: string[]; description: string }[]
}

const SHORTCUTS: ShortcutGroup[] = [
  {
    heading: "Global",
    rows: [
      { keys: ["⌘", "K"], description: "Open command palette" },
      { keys: ["⌘", "B"], description: "Toggle sidebar" },
      { keys: ["⌘", "D"], description: "Toggle light/dark theme" },
      { keys: ["N"], description: "Open notifications drawer" },
      { keys: ["?"], description: "Open this shortcuts cheatsheet" },
    ],
  },
  {
    heading: "Data tables",
    rows: [
      { keys: ["↑", "↓"], description: "Move between rows" },
      { keys: ["Space"], description: "Toggle selection for focused row" },
      { keys: ["Shift", "↑", "↓"], description: "Extend selection" },
      { keys: ["Enter"], description: "Open drawer for focused row" },
      { keys: ["E"], description: "Run primary action (Engage / Send)" },
      { keys: ["X"], description: "Delete focused or selected rows" },
      { keys: ["/"], description: "Jump focus to search" },
    ],
  },
  {
    heading: "Drawers",
    rows: [
      { keys: ["Esc"], description: "Close drawer" },
      { keys: ["⌘", "Enter"], description: "Save / confirm action" },
      { keys: ["Tab"], description: "Cycle interactive controls" },
    ],
  },
]

const Key = ({ value }: { value: string }) => (
  <kbd className="inline-flex h-7 min-w-[28px] items-center justify-center rounded-sm border border-line bg-surface-subtle px-2 label-sm text-fg shadow-sm">
    {value}
  </kbd>
)

const HelpPage = () => (
  <div className="flex flex-col gap-6">
    <PageHeader
      title="Help & shortcuts"
      description="Keyboard-first operating layer. Every shortcut works from anywhere in /admin-v2."
    />
    <div className="grid gap-4 md:grid-cols-2">
      {SHORTCUTS.map((group) => (
        <section
          key={group.heading}
          className="rounded-lg border border-line bg-surface p-5"
        >
          <header className="flex items-center justify-between pb-3 border-b border-line">
            <h3 className="heading-sm text-fg">{group.heading}</h3>
            <span className="body-xs text-fg-subtle">
              {group.rows.length} shortcuts
            </span>
          </header>
          <ul className="mt-3 divide-y divide-line">
            {group.rows.map((row, index) => (
              <li
                key={`${group.heading}-${index}`}
                className="flex items-center justify-between gap-3 py-2.5"
              >
                <span className="body-sm text-fg">{row.description}</span>
                <span className="flex items-center gap-1">
                  {row.keys.map((key, keyIndex) => (
                    <Key key={`${row.description}-${keyIndex}`} value={key} />
                  ))}
                </span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  </div>
)

export default HelpPage
