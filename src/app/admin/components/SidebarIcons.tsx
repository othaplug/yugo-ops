/**
 * SidebarIcons — Phosphor-backed icon components for the admin sidebar.
 * Uses the global PhosphorProvider duotone weight.
 */
import React from "react";
import {
  Target, Truck, SquaresFour, UserCheck, Tag, ChartLineUp, ClipboardText,
  Calendar, MapPin, Armchair, Palette, Buildings, Image, Handshake, FileText,
  CurrencyDollar, Users, ChatText, ChartBar, Lock, Package,
  CreditCard, TrendUp, Shield, Lightning, Gear, Gift, House,
} from "@phosphor-icons/react";

const SIZE = 16;

const ic = (Comp: React.ComponentType<{ size?: number; className?: string }>) =>
  () => <Comp size={SIZE} className="shrink-0" />;

export const Icons = {
  target:         ic(Target),
  package:        ic(Truck),
  dispatch:       ic(SquaresFour),
  userCheck:      ic(UserCheck),
  tag:            ic(Tag),
  forecast:       ic(ChartLineUp),
  projects:       ic(ClipboardText),
  calendar:       ic(Calendar),
  mapPin:         ic(MapPin),
  sofa:           ic(Armchair),
  palette:        ic(Palette),
  hotel:          ic(Buildings),
  building:       ic(Buildings),
  image:          ic(Image),
  handshake:      ic(Handshake),
  fileText:       ic(FileText),
  dollarSign:     ic(CurrencyDollar),
  users:          ic(Users),
  messageSquare:  ic(ChatText),
  clipboardList:  ic(ClipboardText),
  barChart:       ic(ChartBar),
  lock:           ic(Lock),
  truck:          ic(Truck),
  quoteClipboard: ic(ClipboardText),
  creditCard:     ic(CreditCard),
  trendingUp:     ic(TrendUp),
  shield:         ic(Shield),
  zap:            ic(Lightning),
  settings:       ic(Gear),
  gift:           ic(Gift),
  home:           ic(House),
  package2:       ic(Package),
};
