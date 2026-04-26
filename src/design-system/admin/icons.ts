/**
 * Yugo+ admin v3 — icon barrel.
 *
 * Single import surface for Phosphor icons used across the admin. Every
 * v3 component must import icons from here so sizing, weight, and naming
 * stay consistent. No Lucide. No custom SVG packs.
 *
 * "use client" — phosphor's IconContext calls React.createContext at
 * module evaluation, which Next.js RSC bans in Server Components.
 * Marking this module client-side ensures any transitive import in a
 * Server Component is treated as a client reference rather than evaluated.
 */
"use client";

export {
  // Navigation / chrome
  House,
  MagnifyingGlass,
  Bell,
  Gear,
  GearSix,
  Plus,
  Question,
  CaretLeft,
  CaretRight,
  CaretDown,
  CaretUp,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  ArrowDown,
  ArrowUpRight,
  DotsThree,
  DotsThreeVertical,
  List,
  X,
  Check,
  Sparkle,
  MagicWand,
  Command,
  // Sections
  Broadcast,
  CalendarBlank,
  Calendar,
  Clock,
  MapPin,
  Path,
  Compass,
  Funnel,
  Handshake,
  Briefcase,
  FileText,
  Money,
  CurrencyDollar,
  Shield,
  Warning,
  TrendUp,
  TrendDown,
  UserCheck,
  Users,
  UsersThree,
  User,
  UserPlus,
  ClipboardText,
  Buildings,
  Truck,
  Recycle,
  ShippingContainer,
  Package,
  Receipt,
  FilePlus,
  Gift,
  Flag,
  Code,
  Lock,
  Lightning,
  Palette,
  Armchair,
  Scroll,
  ChartBar,
  ChartLine,
  ChartPie,
  MapTrifold,
  SquaresFour,
  HardHat,
  Pulse,
  CreditCard,
  Envelope,
  Phone,
  Notepad,
  // Status
  CheckCircle,
  WarningCircle,
  XCircle,
  Info,
  Circle,
  // Interaction / actions
  PencilSimple,
  Copy,
  Trash,
  DownloadSimple,
  UploadSimple,
  Eye,
  EyeSlash,
  Star,
  Heart,
  Link as LinkIcon,
  ShareNetwork,
  FloppyDisk,
  ArrowsClockwise,
  ArrowSquareOut,
  Sun,
  Moon,
  SignOut,
} from "@phosphor-icons/react";

/** Default icon sizes used across v3. */
export const ICON_SIZE = {
  xs: 12,
  sm: 14,
  md: 16,
  lg: 18,
  xl: 20,
  "2xl": 24,
} as const;

export type IconSize = keyof typeof ICON_SIZE;

/** Tiny trailing chevron for forward-action buttons. */
export { CaretDown as ChevronDown } from "@phosphor-icons/react";

/** Default weight used everywhere — no bold icons by policy. */
export const ICON_WEIGHT = "regular" as const;
