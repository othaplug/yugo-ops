"use client";

import * as React from "react";
import { createPortal } from "react-dom";
import {
  ChartBar,
  House,
  MapPin,
  Receipt,
  Recycle,
  SignOut,
  SunHorizon,
} from "@phosphor-icons/react";
import { FloatingActionMenu } from "@/components/ui/floating-action-menu";
import { normalizePhone } from "@/lib/phone";

const CREW_DISPATCH_PHONE =
  process.env.NEXT_PUBLIC_YUGO_PHONE || "(647) 370-4525";
const CREW_COORDINATOR_PHONE =
  process.env.NEXT_PUBLIC_YUGO_COORDINATOR_PHONE || CREW_DISPATCH_PHONE;

type NavSlot = {
  href: string | null;
  shortLabel: string;
  label: string;
  active: boolean;
  disabled: boolean;
};

export type CrewMobileFloatingNavProps = {
  show: boolean;
  pathname: string;
  isDashboard: boolean;
  navigation: NavSlot;
  hasActiveBinTasks?: boolean;
};

export function CrewMobileFloatingNav({
  show,
  pathname,
  isDashboard,
  navigation,
  hasActiveBinTasks = false,
}: CrewMobileFloatingNavProps) {
  const path = String(pathname);
  const isStats = path.startsWith("/crew/stats");
  const isExpense = path.startsWith("/crew/expense");
  const isEod = path.startsWith("/crew/end-of-day");
  const isBinOrders = path.startsWith("/crew/bin-orders");

  /** Body portal escapes `.crew-app { overflow-x: clip }`, which clips fixed UI in several browsers. */
  const [portalEl, setPortalEl] = React.useState<HTMLElement | null>(null);
  React.useLayoutEffect(() => {
    setPortalEl(document.body);
  }, []);

  const options = React.useMemo(
    () => [
      {
        label: "Dashboard",
        href: "/crew/dashboard",
        active: isDashboard,
        Icon: <House size={16} weight={isDashboard ? "fill" : "regular"} aria-hidden />,
      },
      {
        label: "Support",
        opensSubMenu: true,
      },
      {
        label: "Nav",
        href: navigation.disabled || !navigation.href ? undefined : navigation.href,
        disabled: navigation.disabled || !navigation.href,
        title: navigation.disabled
          ? "Available when you are en route on a job."
          : undefined,
        active: navigation.active,
        Icon: (
          <MapPin
            size={16}
            weight={navigation.active ? "fill" : "regular"}
            className={navigation.disabled ? "opacity-40" : undefined}
            aria-hidden
          />
        ),
      },
      {
        label: "Stats",
        href: "/crew/stats",
        active: isStats,
        Icon: <ChartBar size={16} weight={isStats ? "fill" : "regular"} aria-hidden />,
      },
      {
        label: "Expense",
        href: "/crew/expense",
        active: isExpense,
        Icon: <Receipt size={16} weight={isExpense ? "fill" : "regular"} aria-hidden />,
      },
      {
        label: "EOD",
        href: "/crew/end-of-day",
        active: isEod,
        Icon: <SunHorizon size={16} weight={isEod ? "fill" : "regular"} aria-hidden />,
      },
      ...(hasActiveBinTasks
        ? [
            {
              label: "Bin tasks",
              href: "/crew/bin-orders",
              active: isBinOrders,
              Icon: (
                <Recycle size={16} weight={isBinOrders ? "fill" : "regular"} aria-hidden />
              ),
            },
          ]
        : []),
      {
        label: "Sign out",
        Icon: <SignOut size={16} weight="regular" aria-hidden />,
        form: "crew-fab-logout",
      },
    ],
    [
      hasActiveBinTasks,
      isBinOrders,
      isDashboard,
      isEod,
      isExpense,
      isStats,
      navigation.active,
      navigation.disabled,
      navigation.href,
    ],
  );

  if (!show) return null;
  if (!portalEl) return null;

  return createPortal(
    <>
      <form id="crew-fab-logout" action="/api/crew/logout" method="POST" hidden />
      <FloatingActionMenu
        align="left"
        zIndexClass="z-[var(--z-top)]"
        triggerLabelClosed="Open crew navigation"
        triggerLabelOpen="Close crew navigation"
        triggerIcon={<House size={24} weight="regular" className="text-current" aria-hidden />}
        options={options}
        subMenuOptions={[
          {
            label: "Call dispatch",
            href: `tel:${normalizePhone(CREW_DISPATCH_PHONE)}`,
          },
          {
            label: "Call coordinator",
            href: `tel:${normalizePhone(CREW_COORDINATOR_PHONE)}`,
          },
        ]}
      />
    </>,
    portalEl,
  );
}
