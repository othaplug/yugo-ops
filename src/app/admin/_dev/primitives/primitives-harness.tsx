"use client"

import * as React from "react"
import { ThemeProvider, useTheme } from "@/components/admin-v2/providers/theme-provider"
import {
  Avatar,
  AvatarStack,
  Badge,
  Button,
  Checkbox,
  Chip,
  DropdownContent,
  DropdownItem,
  DropdownLabel,
  DropdownPortal,
  DropdownRoot,
  DropdownSeparator,
  DropdownTrigger,
  EmptyState,
  Icon,
  Input,
  PopoverContent,
  PopoverRoot,
  PopoverTrigger,
  Radio,
  RadioGroup,
  Skeleton,
  Switch,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  ToggleGroup,
  ToggleGroupItem,
  Tooltip,
  TooltipProvider,
  variantForStatus,
} from "@/components/admin-v2/primitives"

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-b border-line pb-10 pt-8">
    <p className="label-md mb-5 text-fg-muted uppercase tracking-[0.08em]">{title}</p>
    <div className="flex flex-wrap items-start gap-4">{children}</div>
  </section>
)

const ThemeSwitcher = () => {
  const { theme, resolvedTheme, setTheme } = useTheme()
  return (
    <div className="flex items-center gap-2">
      <span className="body-sm text-fg-muted">Theme:</span>
      <ToggleGroup
        type="single"
        value={theme}
        onValueChange={(v) => v && setTheme(v as typeof theme)}
      >
        <ToggleGroupItem value="light">
          <Icon name="light" size="sm" /> Light
        </ToggleGroupItem>
        <ToggleGroupItem value="dark">
          <Icon name="dark" size="sm" /> Dark
        </ToggleGroupItem>
        <ToggleGroupItem value="system">
          <Icon name="system" size="sm" /> System
        </ToggleGroupItem>
      </ToggleGroup>
      <span className="body-sm text-fg-muted">({resolvedTheme})</span>
    </div>
  )
}

const stackItems = [
  { name: "Andy Shepard" },
  { name: "Emily Thompson" },
  { name: "Michael Carter" },
  { name: "David Anderson" },
  { name: "Lily Hernandez" },
]

const Harness = () => {
  const [checked, setChecked] = React.useState<boolean | "indeterminate">(false)
  const [switched, setSwitched] = React.useState(false)
  const [radio, setRadio] = React.useState("a")

  return (
    <div className="min-h-dvh bg-canvas text-fg">
      <header className="sticky top-0 z-10 flex items-center justify-between border-b border-line bg-surface px-6 py-4">
        <div>
          <p className="display-sm text-fg">Admin v2 · Primitives</p>
          <p className="body-sm text-fg-muted">
            Dev harness — review every component, variant, and state.
          </p>
        </div>
        <ThemeSwitcher />
      </header>

      <div className="mx-auto max-w-[1200px] px-6">
        <Section title="Buttons">
          <Button variant="primary">Primary</Button>
          <Button variant="accent">Accent</Button>
          <Button variant="secondary">Secondary</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Destructive</Button>
          <Button variant="primary" leadingIcon={<Icon name="plus" size="sm" />}>
            New lead
          </Button>
          <Button variant="secondary" trailingIcon={<Icon name="caretDown" size="sm" />}>
            Last 7 days
          </Button>
          <Button size="sm">Small</Button>
          <Button size="md">Medium</Button>
          <Button size="lg">Large</Button>
          <Button loading>Loading</Button>
          <Button disabled>Disabled</Button>
        </Section>

        <Section title="Chips · status tags">
          <Chip label="ORGANIC" variant="neutral" />
          <Chip label="DTJ25" variant="neutral" external />
          <Chip label="PRE-SALE" variant="warning" />
          <Chip label="CLOSED" variant="success" />
          <Chip label="LOST" variant="danger" />
          <Chip label="CLOSING" variant="info" />
          <Chip label="NEW" variant="brand" />
          <Chip label="WON" variant={variantForStatus("won")} />
          <Chip label="HIGH" variant="success" dot />
          <Chip label="MID" variant="warning" dot />
          <Chip label="LOW" variant="danger" dot />
        </Section>

        <Section title="Avatars">
          <Avatar name="Andy Shepard" size="sm" />
          <Avatar name="Emily Thompson" size="md" />
          <Avatar name="Michael Carter" size="lg" />
          <Avatar name="David Anderson" size="md" status="success" />
          <Avatar name="Lily Hernandez" size="md" status="offline" />
          <AvatarStack items={stackItems} size="md" max={3} />
          <AvatarStack items={stackItems} size="sm" max={4} />
        </Section>

        <Section title="Inputs">
          <Input placeholder="Search..." size="md" />
          <Input
            placeholder="Search leads..."
            leadingIcon={<Icon name="search" size="sm" />}
            trailingIcon={<Icon name="filter" size="sm" />}
          />
          <Input placeholder="Error state" error="Required field" />
          <Input placeholder="Small" size="sm" />
          <Input placeholder="Large" size="lg" />
          <Input placeholder="Disabled" disabled />
        </Section>

        <Section title="Checkbox · Switch · Radio">
          <Checkbox
            checked={checked}
            onCheckedChange={(v) => setChecked(v)}
            aria-label="Select row"
          />
          <Checkbox defaultChecked aria-label="Default checked" />
          <Checkbox checked="indeterminate" aria-label="Indeterminate" />
          <Checkbox disabled aria-label="Disabled" />
          <Switch checked={switched} onCheckedChange={setSwitched} aria-label="Group" />
          <Switch disabled aria-label="Disabled switch" />
          <RadioGroup value={radio} onValueChange={setRadio} className="flex gap-4">
            <label className="flex items-center gap-2 body-sm text-fg">
              <Radio value="a" /> Option A
            </label>
            <label className="flex items-center gap-2 body-sm text-fg">
              <Radio value="b" /> Option B
            </label>
            <label className="flex items-center gap-2 body-sm text-fg">
              <Radio value="c" /> Option C
            </label>
          </RadioGroup>
        </Section>

        <Section title="Dropdown · Popover · Tooltip">
          <DropdownRoot>
            <DropdownTrigger asChild>
              <Button variant="secondary" trailingIcon={<Icon name="caretDown" size="sm" />}>
                Open menu
              </Button>
            </DropdownTrigger>
            <DropdownPortal>
              <DropdownContent>
                <DropdownLabel>Actions</DropdownLabel>
                <DropdownItem leadingIcon={<Icon name="ai" size="sm" />}>
                  AI analyze
                </DropdownItem>
                <DropdownSeparator />
                <DropdownItem leadingIcon={<Icon name="sortAsc" size="sm" />}>
                  Sort ascending
                </DropdownItem>
                <DropdownItem leadingIcon={<Icon name="sortDesc" size="sm" />}>
                  Sort descending
                </DropdownItem>
                <DropdownItem leadingIcon={<Icon name="filter" size="sm" />}>
                  Filter
                </DropdownItem>
                <DropdownSeparator />
                <DropdownItem leadingIcon={<Icon name="eyeOff" size="sm" />}>
                  Hide column
                </DropdownItem>
                <DropdownItem
                  destructive
                  leadingIcon={<Icon name="trash" size="sm" />}
                  shortcut="⌘⌫"
                >
                  Delete
                </DropdownItem>
              </DropdownContent>
            </DropdownPortal>
          </DropdownRoot>

          <PopoverRoot>
            <PopoverTrigger asChild>
              <Button variant="secondary">Open popover</Button>
            </PopoverTrigger>
            <PopoverContent>
              <p className="body-md text-fg">Popover content</p>
              <p className="body-sm text-fg-muted">Use for inline filter forms.</p>
            </PopoverContent>
          </PopoverRoot>

          <TooltipProvider>
            <Tooltip content="Tooltip copy">
              <Button variant="ghost">Hover me</Button>
            </Tooltip>
          </TooltipProvider>
        </Section>

        <Section title="Tabs · ToggleGroup · Badge">
          <Tabs defaultValue="overview" className="w-full max-w-[520px]">
            <TabsList>
              <TabsTrigger value="overview">Overview</TabsTrigger>
              <TabsTrigger value="distributions">Distributions</TabsTrigger>
              <TabsTrigger value="waterfall">Waterfall</TabsTrigger>
            </TabsList>
            <TabsContent value="overview" className="pt-4 body-sm text-fg-muted">
              Overview content
            </TabsContent>
            <TabsContent value="distributions" className="pt-4 body-sm text-fg-muted">
              Distributions content
            </TabsContent>
            <TabsContent value="waterfall" className="pt-4 body-sm text-fg-muted">
              Waterfall content
            </TabsContent>
          </Tabs>

          <Tabs defaultValue="list" variant="pills">
            <TabsList>
              <TabsTrigger value="list">
                <Icon name="viewList" size="sm" /> List
              </TabsTrigger>
              <TabsTrigger value="board">
                <Icon name="viewBoard" size="sm" /> Board
              </TabsTrigger>
              <TabsTrigger value="pipeline">
                <Icon name="arrowRight" size="sm" /> Pipeline
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <ToggleGroup type="single" defaultValue="d">
            <ToggleGroupItem value="d">D</ToggleGroupItem>
            <ToggleGroupItem value="w">W</ToggleGroupItem>
            <ToggleGroupItem value="m">M</ToggleGroupItem>
            <ToggleGroupItem value="y">Y</ToggleGroupItem>
            <ToggleGroupItem value="all">All</ToggleGroupItem>
          </ToggleGroup>

          <div className="flex items-center gap-2 body-sm text-fg">
            My work <Badge>24</Badge>
          </div>
          <div className="flex items-center gap-2 body-sm text-fg">
            Inbox <Badge tone="accent">3</Badge>
          </div>
          <div className="flex items-center gap-2 body-sm text-fg">
            Alerts <Badge tone="danger">!</Badge>
          </div>
        </Section>

        <Section title="Skeleton · EmptyState">
          <div className="flex flex-col gap-2">
            <Skeleton width={240} height={16} />
            <Skeleton width={180} height={12} />
            <Skeleton width={320} height={80} radius="md" />
          </div>
          <EmptyState
            icon={<Icon name="leads" size="lg" />}
            title="No leads yet"
            description="Leads will appear here once your sources start sending them in."
            action={
              <Button variant="primary" leadingIcon={<Icon name="plus" size="sm" />}>
                New lead
              </Button>
            }
          />
        </Section>

        <div className="h-24" />
      </div>
    </div>
  )
}

export const PrimitivesHarness = () => (
  <ThemeProvider>
    <Harness />
  </ThemeProvider>
)
