/**
 * Phosphor icon utilities for Yugo.
 *
 * All icons are sourced from @phosphor-icons/react.
 * Default weight is "regular"; use duotone only for feature cards and hero accents.
 */
import {
  Truck, Users, Shield, ShieldCheck, Package, House, Wrench, MapPin,
  Money, Star, Phone, Gift, ClipboardText, TShirt, Trash,
  Cube, Eye, Calendar, CalendarX, CaretRight, CaretLeft, CaretDown, CaretUp,
  Bell, Gear, MagnifyingGlass, Plus, X, Check, CheckCircle, Warning,
  WarningCircle, Info, ArrowRight, ArrowLeft, ArrowUpRight, ArrowsDownUp,
  Clock, Heart, Copy, ChatText, Envelope, File, FileText, Image,
  Download, Upload, PencilSimple, DotsThreeVertical, FunnelSimple,
  SignOut, UserCircle, Buildings, Storefront, PaintBrush, Armchair, Bed, Lamp,
  Monitor, Note, BookOpen, Barbell, Car, Wine, Diamond,
  Crown, Certificate, Sparkle, Target, Camera, Lock, Link, Stack,
  Hash, Sun, SunHorizon, Radio, Circle, Minus, Tag, User,
  ChartBar, ChartLine, ChartDonut, TrendUp, TrendDown, CreditCard, Wallet,
  Handshake, PaperPlaneTilt, ArrowsClockwise, ArrowCounterClockwise,
  CircleNotch, WifiSlash, ArrowSquareOut, SidebarSimple, Broadcast,
  ColumnsPlusRight, Bookmark, BookmarkSimple, ListBullets, CursorClick,
  ToggleRight, DeviceMobile, Columns, Pulse, Ruler, Lightning,
  type Icon,
} from '@phosphor-icons/react'

export type { Icon }

/** Default weight for the app */
export const ICON_WEIGHT = 'regular' as const

/** Standardised icon sizes */
export const ICON_SIZES = {
  nav: 20,
  button: 18,
  card: 24,
  feature: 28,
  empty: 48,
  hero: 32,
} as const

/** Lucide name → Phosphor component mapping (for dynamic icon rendering) */
export const ICON_MAP: Record<string, Icon> = {
  // Navigation
  ChevronRight: CaretRight,
  ChevronLeft: CaretLeft,
  ChevronDown: CaretDown,
  ChevronUp: CaretUp,
  ArrowRight,
  ArrowLeft,
  ArrowUpRight,
  ArrowUpDown: ArrowsDownUp,

  // Actions
  Plus,
  X,
  Check,
  Edit: PencilSimple,
  Pencil: PencilSimple,
  Trash: Trash,
  Trash2: Trash,
  Copy,
  Download,
  Upload,
  Search: MagnifyingGlass,
  Filter: FunnelSimple,
  MoreVertical: DotsThreeVertical,
  LogOut: SignOut,
  RefreshCw: ArrowsClockwise,
  RotateCcw: ArrowCounterClockwise,
  Send: PaperPlaneTilt,
  ExternalLink: ArrowSquareOut,
  Loader2: CircleNotch,

  // Status
  CheckCircle,
  CheckCircle2: CheckCircle,
  AlertTriangle: Warning,
  AlertCircle: WarningCircle,
  Info,
  Bell,
  Clock,
  WifiOff: WifiSlash,

  // Business
  Truck,
  Users,
  Shield,
  ShieldCheck,
  Package,
  Home: House,
  Wrench,
  MapPin,
  DollarSign: Money,
  Star,
  Phone,
  Gift,
  ClipboardCheck: ClipboardText,
  Calendar,
  CalendarDays: Calendar,
  CalendarX,
  Settings: Gear,
  User,
  UserCircle,
  Building: Buildings,
  Building2: Buildings,
  Store: Storefront,
  Heart,
  Lock,
  Target,
  Camera,
  Eye,
  Ruler,
  Hash,
  Radio,
  Layers: Stack,
  Boxes: Cube,
  Activity: Pulse,
  Zap: Lightning,
  Radar: Broadcast,

  // Inventory
  Shirt: TShirt,
  Sofa: Armchair,
  Bed,
  Lamp,
  Monitor,
  BookOpen,
  Dumbbell: Barbell,
  Wine,
  Car,

  // Files / Communication
  File,
  FileText,
  Image,
  Mail: Envelope,
  MessageSquare: ChatText,
  Link,
  StickyNote: Note,

  // Finance
  CreditCard,
  Wallet,

  // Charts
  TrendingUp: TrendUp,
  TrendingDown: TrendDown,
  BarChart3: ChartBar,
  BarChart2: ChartBar,
  BarChart: ChartBar,
  LineChart: ChartLine,
  PieChart: ChartDonut,

  // UI Controls
  PanelRightOpen: SidebarSimple,
  PanelRightClose: SidebarSimple,
  Columns3: Columns,
  Bookmark,
  BookmarkCheck: BookmarkSimple,
  LayoutList: ListBullets,
  MousePointerClick: CursorClick,
  ToggleRight,

  // Premium / Decorative
  Crown,
  Diamond,
  Gem: Diamond,
  Award: Certificate,
  Sparkles: Sparkle,

  // People
  Handshake,

  // Devices
  Smartphone: DeviceMobile,
}

/**
 * Resolve a Lucide icon name to its Phosphor component.
 * Falls back to CheckCircle if the name is unknown.
 */
export function getIcon(lucideName: string): Icon {
  return ICON_MAP[lucideName] ?? CheckCircle
}

// Named re-exports so consumers can import directly from this file
export {
  Truck, Users, Shield, ShieldCheck, Package, House, Wrench, MapPin,
  Money, Star, Phone, Gift, ClipboardText, TShirt, Trash,
  Cube, Eye, Calendar, CalendarX, CaretRight, CaretLeft, CaretDown, CaretUp,
  Bell, Gear, MagnifyingGlass, Plus, X, Check, CheckCircle, Warning,
  WarningCircle, Info, ArrowRight, ArrowLeft, ArrowUpRight, ArrowsDownUp,
  Clock, Heart, Copy, ChatText, Envelope, File, FileText, Image,
  Download, Upload, PencilSimple, DotsThreeVertical, FunnelSimple,
  SignOut, UserCircle, Buildings, Storefront, PaintBrush, Armchair, Bed, Lamp,
  Monitor, Note, BookOpen, Barbell, Car, Wine, Diamond,
  Crown, Certificate, Sparkle, Target, Camera, Lock, Link, Stack,
  Hash, Sun, SunHorizon, Radio, Circle, Minus, Tag, User,
  ChartBar, ChartLine, ChartDonut, TrendUp, TrendDown, CreditCard, Wallet,
  Handshake, PaperPlaneTilt, ArrowsClockwise, ArrowCounterClockwise,
  CircleNotch, WifiSlash, ArrowSquareOut, SidebarSimple, Broadcast,
  ColumnsPlusRight, Bookmark, BookmarkSimple, ListBullets, CursorClick,
  ToggleRight, DeviceMobile, Columns, Pulse, Ruler, Lightning,
}
