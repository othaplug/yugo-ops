"use client"

import * as React from "react"
import {
  House,
  Calendar,
  Megaphone,
  CurrencyDollar,
  Truck,
  UsersThree,
  Buildings,
  BuildingOffice,
  Storefront,
  MapPin,
  MapTrifold,
  ChartLineUp,
  Calculator,
  FileText,
  GearSix,
  Bell,
  MagnifyingGlass,
  FunnelSimple,
  Plus,
  X,
  Trash,
  Check,
  Minus,
  DotsThree,
  DotsThreeVertical,
  DotsSix,
  CaretLeft,
  CaretRight,
  CaretUp,
  CaretDown,
  ArrowRight,
  ArrowUpRight,
  ArrowDown,
  ArrowUp,
  ArrowDownRight,
  Download,
  Eye,
  EyeSlash,
  Star,
  Lightning,
  Sparkle,
  Copy,
  Pencil,
  SignOut,
  User,
  Moon,
  Sun,
  Desktop,
  SortAscending,
  SortDescending,
  ListBullets,
  Kanban,
  GridFour,
  ChartBar,
  CaretUpDown,
  Warning,
  CheckCircle,
  XCircle,
  Info,
  Question,
  Phone,
  Envelope,
  ChatCircle,
  Package,
  Receipt,
  SlidersHorizontal,
  type IconProps as PhosphorIconProps,
} from "@phosphor-icons/react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "../lib/cn"

const iconVariants = cva("inline-block shrink-0", {
  variants: {
    size: {
      xs: "size-3", // 12
      sm: "size-3.5", // 14
      md: "size-4", // 16
      lg: "size-5", // 20
      xl: "size-6", // 24
    },
  },
  defaultVariants: { size: "md" },
})

export const ICONS = {
  home: House,
  calendar: Calendar,
  campaigns: Megaphone,
  deals: CurrencyDollar,
  leads: UsersThree,
  quotes: FileText,
  moves: Truck,
  invoices: Receipt,
  customers: UsersThree,
  b2b: Storefront,
  pm: BuildingOffice,
  buildings: Buildings,
  crew: User,
  fleet: Truck,
  dispatch: MapTrifold,
  analytics: ChartLineUp,
  pricing: Calculator,
  reports: ChartBar,
  settings: GearSix,

  search: MagnifyingGlass,
  filter: FunnelSimple,
  plus: Plus,
  close: X,
  trash: Trash,
  check: Check,
  minus: Minus,
  more: DotsThree,
  moreVertical: DotsThreeVertical,
  drag: DotsSix,

  caretLeft: CaretLeft,
  caretRight: CaretRight,
  caretUp: CaretUp,
  caretDown: CaretDown,
  caretUpDown: CaretUpDown,

  arrowRight: ArrowRight,
  arrowUpRight: ArrowUpRight,
  arrowUp: ArrowUp,
  arrowDown: ArrowDown,
  arrowDownRight: ArrowDownRight,

  download: Download,
  eye: Eye,
  eyeOff: EyeSlash,
  star: Star,
  lightning: Lightning,
  ai: Sparkle,
  copy: Copy,
  edit: Pencil,
  signOut: SignOut,
  user: User,

  bell: Bell,
  mapPin: MapPin,
  package: Package,

  light: Sun,
  dark: Moon,
  system: Desktop,

  sortAsc: SortAscending,
  sortDesc: SortDescending,

  viewList: ListBullets,
  viewBoard: Kanban,
  viewPipeline: GridFour,
  sliders: SlidersHorizontal,

  warning: Warning,
  success: CheckCircle,
  danger: XCircle,
  info: Info,
  help: Question,

  phone: Phone,
  email: Envelope,
  message: ChatCircle,
} as const

export type IconName = keyof typeof ICONS

export type IconProps = VariantProps<typeof iconVariants> &
  Omit<PhosphorIconProps, "size" | "ref"> & {
    name: IconName
    className?: string
    /** Phosphor icon weight. Defaults to "regular". */
    weight?: PhosphorIconProps["weight"]
    "aria-label"?: string
  }

export const Icon = ({ name, size, className, weight = "regular", ...rest }: IconProps) => {
  const Phosphor = ICONS[name]
  return (
    <Phosphor
      weight={weight}
      className={cn(iconVariants({ size }), className)}
      aria-hidden={rest["aria-label"] ? undefined : true}
      {...rest}
    />
  )
}
