"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import * as Dialog from "@radix-ui/react-dialog";
import { Command } from "cmdk";
import { Icon, type IconName } from "../primitives/Icon";
import { Chip } from "../primitives/Chip";
import { cn } from "../lib/cn";

type SearchUniverse = {
  leads: Array<{ id: string; name: string; email: string; source?: string }>;
  quotes: Array<{ id: string; number: string; customerName: string }>;
  moves: Array<{ id: string; number: string; customerName: string }>;
  customers: Array<{
    id: string;
    name: string;
    email: string;
    type?: string;
  }>;
  invoices: Array<{ id: string; number: string; customerName: string }>;
};

const NAV_ITEMS: Array<{
  id: string;
  label: string;
  icon: IconName;
  href: string;
  group: string;
}> = [
  {
    id: "nav-dashboard",
    label: "Dashboard",
    icon: "home",
    href: "/admin-v2/dashboard",
    group: "Pages",
  },
  {
    id: "nav-leads",
    label: "Leads",
    icon: "leads",
    href: "/admin-v2/leads",
    group: "Pages",
  },
  {
    id: "nav-quotes",
    label: "Quotes",
    icon: "quotes",
    href: "/admin-v2/quotes",
    group: "Pages",
  },
  {
    id: "nav-moves",
    label: "Moves",
    icon: "moves",
    href: "/admin-v2/moves",
    group: "Pages",
  },
  {
    id: "nav-customers",
    label: "Customers",
    icon: "customers",
    href: "/admin-v2/customers",
    group: "Pages",
  },
  {
    id: "nav-crew",
    label: "Crew",
    icon: "crew",
    href: "/admin-v2/crew",
    group: "Pages",
  },
  {
    id: "nav-invoices",
    label: "Invoices",
    icon: "invoices",
    href: "/admin-v2/invoices",
    group: "Pages",
  },
  {
    id: "nav-dispatch",
    label: "Dispatch",
    icon: "dispatch",
    href: "/admin-v2/dispatch",
    group: "Pages",
  },
  {
    id: "nav-calendar",
    label: "Calendar",
    icon: "calendar",
    href: "/admin-v2/calendar",
    group: "Pages",
  },
  {
    id: "nav-analytics",
    label: "Analytics",
    icon: "analytics",
    href: "/admin-v2/analytics",
    group: "Pages",
  },
  {
    id: "nav-pricing",
    label: "Pricing",
    icon: "pricing",
    href: "/admin-v2/pricing",
    group: "Pages",
  },
  {
    id: "nav-settings",
    label: "Settings",
    icon: "settings",
    href: "/admin-v2/settings",
    group: "Pages",
  },
  {
    id: "nav-new-quote",
    label: "New quote",
    icon: "plus",
    href: "/admin-v2/quotes/new",
    group: "Create",
  },
  {
    id: "nav-new-move",
    label: "New move",
    icon: "plus",
    href: "/admin-v2/moves/new",
    group: "Create",
  },
];

const GROUP_HEADING_CLASS =
  "**:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:py-1 **:[[cmdk-group-heading]]:label-sm **:[[cmdk-group-heading]]:text-fg-subtle";

type CommandPaletteProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export const CommandPalette = ({ open, onOpenChange }: CommandPaletteProps) => {
  const router = useRouter();
  const [query, setQuery] = React.useState("");
  const [universe, setUniverse] = React.useState<SearchUniverse | null>(null);

  React.useEffect(() => {
    if (!open || universe) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/admin-v2/universe", {
          credentials: "same-origin",
        });
        if (!res.ok) return;
        const data = (await res.json()) as SearchUniverse;
        if (!cancelled) setUniverse(data);
      } catch {
        // Search silently degrades when the endpoint is unreachable.
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [open, universe]);

  const runAction = (href: string) => {
    onOpenChange(false);
    router.push(href);
  };

  const results = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || !universe) return null;
    const customers = universe.customers
      .filter(
        (c) =>
          c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q),
      )
      .slice(0, 5);
    const leads = universe.leads
      .filter((l) => l.name.toLowerCase().includes(q))
      .slice(0, 5);
    const moves = universe.moves
      .filter((m) => `${m.number} ${m.customerName}`.toLowerCase().includes(q))
      .slice(0, 5);
    const quotes = universe.quotes
      .filter((qu) =>
        `${qu.number} ${qu.customerName}`.toLowerCase().includes(q),
      )
      .slice(0, 5);
    return { customers, leads, moves, quotes };
  }, [query, universe]);

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay
          className={cn(
            "fixed inset-0 z-50 bg-black/60 backdrop-blur-xs",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0",
          )}
        />
        <Dialog.Content
          className={cn(
            "fixed left-1/2 top-[15%] z-50 w-[min(92vw,640px)] -translate-x-1/2",
            "overflow-hidden rounded-xl border border-line bg-surface shadow-lg",
            "data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95",
            "data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95",
          )}
        >
          <Dialog.Title className="sr-only">Search</Dialog.Title>
          <Command shouldFilter={false} className="flex flex-col">
            <div className="flex items-center gap-2 border-b border-line px-4">
              <Icon name="search" size="md" className="text-fg-subtle" />
              <Command.Input
                value={query}
                onValueChange={setQuery}
                placeholder="Search customers, moves, quotes, or jump to page"
                className="flex-1 bg-transparent py-3 body-md text-fg outline-none placeholder:text-fg-subtle"
                autoFocus
              />
              <kbd className="label-sm text-fg-subtle">ESC</kbd>
            </div>

            <Command.List className="max-h-[420px] overflow-y-auto p-1.5">
              <Command.Empty className="px-4 py-8 text-center body-sm text-fg-subtle">
                No matches.
              </Command.Empty>

              {results ? (
                <>
                  {results.customers.length > 0 ? (
                    <Command.Group
                      heading="Customers"
                      className={GROUP_HEADING_CLASS}
                    >
                      {results.customers.map((c) => (
                        <Command.Item
                          key={c.id}
                          value={`customer-${c.id}`}
                          onSelect={() =>
                            runAction(
                              `/admin-v2/customers?drawer=customer:${c.id}`,
                            )
                          }
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 body-sm text-fg data-[selected=true]:bg-surface-subtle"
                        >
                          <Icon
                            name="customers"
                            size="sm"
                            className="text-fg-subtle"
                          />
                          <span className="flex-1 truncate">{c.name}</span>
                          {c.type ? (
                            <Chip
                              label={c.type.toUpperCase()}
                              variant="neutral"
                            />
                          ) : null}
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}

                  {results.leads.length > 0 ? (
                    <Command.Group
                      heading="Leads"
                      className={GROUP_HEADING_CLASS}
                    >
                      {results.leads.map((l) => (
                        <Command.Item
                          key={l.id}
                          value={`lead-${l.id}`}
                          onSelect={() =>
                            runAction(`/admin-v2/leads?drawer=lead:${l.id}`)
                          }
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 body-sm text-fg data-[selected=true]:bg-surface-subtle"
                        >
                          <Icon
                            name="leads"
                            size="sm"
                            className="text-fg-subtle"
                          />
                          <span className="flex-1 truncate">{l.name}</span>
                          <span className="body-xs text-fg-subtle">
                            {l.source}
                          </span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}

                  {results.moves.length > 0 ? (
                    <Command.Group
                      heading="Moves"
                      className={GROUP_HEADING_CLASS}
                    >
                      {results.moves.map((m) => (
                        <Command.Item
                          key={m.id}
                          value={`move-${m.id}`}
                          onSelect={() =>
                            runAction(`/admin-v2/moves?drawer=move:${m.id}`)
                          }
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 body-sm text-fg data-[selected=true]:bg-surface-subtle"
                        >
                          <Icon
                            name="moves"
                            size="sm"
                            className="text-fg-subtle"
                          />
                          <span className="flex-1 truncate">
                            {m.number} · {m.customerName}
                          </span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}

                  {results.quotes.length > 0 ? (
                    <Command.Group
                      heading="Quotes"
                      className={GROUP_HEADING_CLASS}
                    >
                      {results.quotes.map((q) => (
                        <Command.Item
                          key={q.id}
                          value={`quote-${q.id}`}
                          onSelect={() =>
                            runAction(`/admin-v2/quotes?drawer=quote:${q.id}`)
                          }
                          className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 body-sm text-fg data-[selected=true]:bg-surface-subtle"
                        >
                          <Icon
                            name="quotes"
                            size="sm"
                            className="text-fg-subtle"
                          />
                          <span className="flex-1 truncate">
                            {q.number} · {q.customerName}
                          </span>
                        </Command.Item>
                      ))}
                    </Command.Group>
                  ) : null}
                </>
              ) : null}

              <Command.Group heading="Pages" className={GROUP_HEADING_CLASS}>
                {NAV_ITEMS.map((item) => (
                  <Command.Item
                    key={item.id}
                    value={`nav-${item.label.toLowerCase()}`}
                    onSelect={() => runAction(item.href)}
                    className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-2 body-sm text-fg data-[selected=true]:bg-surface-subtle"
                  >
                    <Icon
                      name={item.icon}
                      size="sm"
                      className="text-fg-subtle"
                    />
                    <span className="flex-1">{item.label}</span>
                    <span className="body-xs text-fg-subtle">Jump</span>
                  </Command.Item>
                ))}
              </Command.Group>
            </Command.List>
          </Command>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
};
