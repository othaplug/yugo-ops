/**
 * SidebarIcons — Phosphor-backed icon components for the admin sidebar.
 * Icons use weight from PhosphorProvider (regular).
 */
import React from "react";
import {
  Target,
  Path,
  Broadcast,
  UserCheck,
  Tag,
  ClipboardText,
  CalendarBlank,
  MapPin,
  Armchair,
  Palette,
  Buildings,
  Image,
  Handshake,
  FileText,
  Money,
  Users,
  ChatText,
  ChartBar,
  Lock,
  Truck,
  Briefcase,
  CreditCard,
  TrendUp,
  Shield,
  Lightning,
  Gear,
  Gift,
  House,
  Pulse,
  Bell,
  Scroll,
  UsersThree,
  Envelope,
} from "@phosphor-icons/react";

const SIZE = 16;

const ic = (Comp: React.ComponentType<{ size?: number; className?: string; weight?: "regular" | "bold" | "fill" | "duotone" | "thin" | "light" }>) =>
  () => <Comp size={SIZE} weight="regular" className="shrink-0" />;

export const Icons = {
  target:         ic(Target),
  /** All Moves — route / journey */
  path:           ic(Path),
  /** Jobs (deliveries list) */
  briefcase:      ic(Briefcase),
  dispatch:       ic(Broadcast),
  userCheck:      ic(UserCheck),
  tag:            ic(Tag),
  projects:       ic(ClipboardText),
  calendar:       ic(CalendarBlank),
  mapPin:         ic(MapPin),
  sofa:           ic(Armchair),
  palette:        ic(Palette),
  hotel:          ic(Buildings),
  building:       ic(Buildings),
  image:          ic(Image),
  handshake:      ic(Handshake),
  fileText:       ic(FileText),
  dollarSign:     ic(Money),
  users:          ic(Users),
  messageSquare:  ic(ChatText),
  clipboardList:  ic(ClipboardText),
  barChart:       ic(ChartBar),
  lock:           ic(Lock),
  truck:          ic(Truck),
  quoteClipboard: ic(FileText),
  creditCard:     ic(CreditCard),
  trendingUp:     ic(TrendUp),
  shield:         ic(Shield),
  zap:            ic(Lightning),
  settings:       ic(Gear),
  gift:           ic(Gift),
  home:           ic(House),
  /** Live activity / status stream */
  activity:       ic(Pulse),
  bell:           ic(Bell),
  auditLog:       ic(Scroll),
  usersThree:     ic(UsersThree),
  envelope:       ic(Envelope),
};
