"use client";

/**
 * AppIcons — string-keyed icon component backed by Phosphor icons.
 * All icons use the "duotone" weight from the global PhosphorProvider.
 * Usage: <Icon name="home" /> or <Icon name="truck" className="w-4 h-4" />
 */

import {
  MagnifyingGlass, Check, X, Lock, Plug, Bell, CreditCard, Envelope,
  Phone, ClipboardText, Warning, Truck, Confetti, File, FileText,
  CurrencyDollar, PaintBrush, ToggleRight, Gear, Users, Package,
  House, Buildings, Armchair, Palette, Image, Handshake, Eye,
  Clock, Flag, Target, Calendar, MapPin, ChatText, Gift, Camera,
  Star, Link, CircleNotch, Pulse, CaretRight, User, UserMinus,
  TrendUp, TrendDown, Minus, Certificate,
  type Icon as PhosphorIcon,
} from "@phosphor-icons/react";
import React from "react";

const ICON_MAP: Record<string, PhosphorIcon> = {
  // Core actions
  search:           MagnifyingGlass,
  check:            Check,
  x:                X,
  lock:             Lock,
  plug:             Plug,
  bell:             Bell,
  creditCard:       CreditCard,
  mail:             Envelope,
  phone:            Phone,
  clipboard:        ClipboardText,
  alertTriangle:    Warning,
  "alert-triangle": Warning,

  // Business objects
  truck:            Truck,
  party:            Confetti,
  file:             File,
  dollar:           CurrencyDollar,
  dollarSign:       CurrencyDollar,
  paint:            PaintBrush,
  toggleRight:      ToggleRight,
  settings:         Gear,
  users:            Users,
  package:          Package,
  projects:         ClipboardText,
  home:             House,
  building:         Buildings,
  sofa:             Armchair,
  palette:          Palette,
  hotel:            Buildings,
  image:            Image,
  handshake:        Handshake,
  eye:              Eye,
  clock:            Clock,
  flag:             Flag,
  target:           Target,
  calendar:         Calendar,
  mapPin:           MapPin,
  "map-pin":        MapPin,
  fileText:         FileText,
  messageSquare:    ChatText,
  message:          ChatText,
  gift:             Gift,
  camera:           Camera,
  star:             Star,
  link:             Link,
  doc:              FileText,

  // People
  user:             User,
  "user-x":         UserMinus,

  // Trends / charts
  trendingUp:       TrendUp,
  trendingDown:     TrendDown,
  minus:            Minus,
  activity:         Pulse,

  // Navigation
  chevronRight:     CaretRight,

  // Misc
  loading:          CircleNotch,
  award:            Certificate,
};

interface IconProps {
  name: string;
  /** Pixel size — only used when no sizing className is provided */
  size?: number;
  className?: string;
  style?: React.CSSProperties;
}

export const Icon = ({ name, size = 16, className, style }: IconProps) => {
  const PhIcon = ICON_MAP[name] ?? CircleNotch;
  return <PhIcon size={size} className={className} style={style} />;
};
