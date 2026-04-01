import type { ComponentType } from "react";
import {
  Armchair,
  Bed,
  Books,
  Chair,
  Desk,
  Dresser,
  Lamp,
  Package,
  Table,
  Television,
  type IconProps,
} from "@phosphor-icons/react";

/** Maps admin `item_config.quickAdd[].icon` strings to Phosphor icons (furniture presets). */
const QUICK_ADD_ICON_MAP: Record<string, ComponentType<IconProps>> = {
  Armchair,
  Table,
  Chair,
  Bed,
  Dresser,
  Nightstand: Lamp,
  Bookshelf: Books,
  Books,
  Television,
  Package,
  Desk,
};

export function B2bQuickAddIcon({ icon, className }: { icon?: string; className?: string }) {
  const Cmp = (icon && QUICK_ADD_ICON_MAP[icon]) || Package;
  return <Cmp className={className} size={16} weight="duotone" aria-hidden />;
}
