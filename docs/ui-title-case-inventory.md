# UI title-case / capitalize inventory

Generated for the typography pass: **all-caps micro-labels** moved to **CSS `capitalize`** / Tailwind **`capitalize`**, plus **`toTitleCase()`** for dynamic snake_case values.

**Regenerate partial lists:**

```bash
# Files that mention Tailwind/CSS capitalize (word boundary)
grep -rl '\bcapitalize\b' src --include='*.tsx' --include='*.ts' | sort

# Every toTitleCase( call site (excluding the function definition line)
grep -rn 'toTitleCase(' src --include='*.tsx' --include='*.ts' | grep -v 'export function toTitleCase' | sort -t: -k1,1 -k2,2n

# globals.css
grep -n 'capitalize' src/app/globals.css
```

---

## 1. Global CSS (`src/app/globals.css`)

These rules use `text-transform: capitalize` (lines as of last update):

| Line (approx.) | Selector / rule |
|----------------|-----------------|
| 244 | `.admin-kpi-label` |
| 269 | `.admin-view-all-link` |
| 1025 | `.mc-l` |
| 1420 | `.data-label` |
| 1516 | `.ty-label-upper` |
| 1610 | `.dt-th` |
| 1664 | `.dt-badge` |

---

## 2. Explicit English strings rewritten (`JobCard` dispatch statuses)

Source: `src/components/dispatch/JobCard.tsx` — `STATUS_DOT` labels (were ALL CAPS, now title case):

| Before | After |
|--------|--------|
| CONFIRMED | Confirmed |
| EN ROUTE | En Route |
| LOADING | Loading |
| IN TRANSIT | In Transit |
| UNLOADING | Unloading |
| IN PROGRESS | In Progress |
| COMPLETED | Completed |
| PROBLEM | Problem |
| DELAYED | Delayed |

Unknown status fallback: **`.toUpperCase()` after `replace(/_/g, " ")`** → **`toTitleCase(status)`**.

---

## 3. Admin Command Center change-request task title

Source: `src/app/admin/page.tsx`

- **Before:** `` `${typeLabel.charAt(0).toUpperCase() + typeLabel.slice(1)} request` ``
- **After:** `` `${typeLabel} Request` `` where `typeLabel = toTitleCase(String(r.type || "change"))`

---

## 4. All `toTitleCase(` call sites (excluding definition)

**90 `toTitleCase(` call sites** across **44 implementation files** (plus `src/lib/format-text.ts` where the helper is defined) — full dump (sorted by path, then line number):

```
src/app/admin/calendar/components/JobCard.tsx:113:        <span className="truncate">{toTitleCase(event.description)}</span>
src/app/admin/calendar/components/JobDetailPanel.tsx:116:                {toTitleCase(event.calendarStatus)}
src/app/admin/calendar/components/JobDetailPanel.tsx:125:            <p className="text-[12px] text-[var(--tx3)] mt-0.5">{toTitleCase(event.description)}</p>
src/app/admin/calendar/components/JobDetailPanel.tsx:216:                Category: {toTitleCase(event.category)}
src/app/admin/change-requests/ChangeRequestsClient.tsx:152:              {toTitleCase(r.status)}
src/app/admin/change-requests/ChangeRequestsClient.tsx:164:        render: (r) => <span className="text-[11px] font-medium text-[var(--tx2)]">{toTitleCase(r.type)}</span>,
src/app/admin/clients/[id]/ClientDetailClient.tsx:369:                status={toTitleCase(d.status || "")}
src/app/admin/clients/[id]/ClientDetailClient.tsx:409:                    {toTitleCase(cr.status)}
src/app/admin/components/Badge.tsx:40:  const label = moveLabel !== "-" ? moveLabel : (status ? toTitleCase(status) : "-");
src/app/admin/components/RealtimeListener.tsx:110:        const type = row.move_type ? ` (${toTitleCase(row.move_type)})` : "";
src/app/admin/crew/UnifiedTrackingView.tsx:164:  return labels[status] || CREW_STATUS_TO_LABEL[status] || toTitleCase(status);
src/app/admin/deliveries/AllProjectsView.tsx:78:  const parts = [d.delivery_type ? toTitleCase(String(d.delivery_type).replace(/_/g, " ")) : "", d.zone != null ? `Z${d.zone}` : ""].filter(Boolean);
src/app/admin/deliveries/AllProjectsView.tsx:122:    render: (d) => <span className="text-[var(--tx2)]">{toTitleCase(d.category || "Delivery")}</span>,
src/app/admin/deliveries/AllProjectsView.tsx:154:          {toTitleCase(d.status || "")}
src/app/admin/deliveries/RecurringSchedulesView.tsx:382:                        <span className="text-[var(--tx2)]">{toTitleCase(s.booking_type.replace(/_/g, " "))}</span>
src/app/admin/deliveries/[id]/DeliveryDetailClient.tsx:647:                    <span className={`text-[12px] font-bold ${sc.text}`}>{STATUS_LABELS[delivery.status] || toTitleCase(delivery.status)}</span>
src/app/admin/deliveries/[id]/DeliveryDetailClient.tsx:661:          This delivery is {toTitleCase(delivery.status)}. Some fields are locked.
src/app/admin/deliveries/[id]/DeliveryDetailClient.tsx:685:                        <td className="py-2 px-3 text-[var(--tx)]">{toTitleCase(row.message_type)}</td>
src/app/admin/deliveries/[id]/LiveTrackingMap.tsx:472:                  {CREW_STATUS_TO_LABEL[liveStage] || toTitleCase(liveStage)}
src/app/admin/deliveries/[id]/LiveTrackingMap.tsx:549:                {CREW_STATUS_TO_LABEL[liveStage] || toTitleCase(liveStage)}
src/app/admin/moves/AllMovesClient.tsx:675:                      {toTitleCase(q.status)}
src/app/admin/moves/[id]/MoveDetailClient.tsx:660:                    <td className="py-2 px-3 text-[var(--tx)]">{toTitleCase(row.message_type)}</td>
src/app/admin/moves/[id]/MoveDetailClient.tsx:673:        <CollapsibleSection title="Review Request" defaultCollapsed={false} subtitle={reviewRequest.review_clicked ? "Clicked ✓" : toTitleCase(reviewRequest.status)}>
src/app/admin/moves/[id]/MoveDetailClient.tsx:682:                      ? `${toTitleCase(reviewRequest.status)}${reviewRequest.status === "reminded" && reviewRequest.reminder_sent_at ? ` (${formatReviewTime(reviewRequest.reminder_sent_at)})` : reviewRequest.email_sent_at ? ` (${formatReviewTime(reviewRequest.email_sent_at)})` : ""} · Not clicked yet`
src/app/admin/moves/[id]/MoveDetailClient.tsx:683:                      : toTitleCase(reviewRequest.status)}
src/app/admin/moves/[id]/MoveDetailClient.tsx:1434:              const stLabel = BIN_ORDER_STATUS_ADMIN[stKey] ?? toTitleCase(stKey);
src/app/admin/moves/[id]/MoveDetailClient.tsx:1503:                  Reason: {toTitleCase(move.walkthrough_skip_reason)}
src/app/admin/moves/[id]/MoveInventorySection.tsx:516:                            {toTitleCase(e.status)}
src/app/admin/page.tsx:108:    const typeLabel = toTitleCase(String(r.type || "change"));
src/app/admin/partners/designers/DesignerDashboard.tsx:112:                const statusLabel = toTitleCase(d.status || "");
src/app/admin/partners/gallery/GalleryClient.tsx:186:                              {toTitleCase(p.project_type)}
src/app/admin/partners/gallery/GalleryClient.tsx:302:                <div className="text-[var(--tx)]">{toTitleCase(projectDetail.project_type || "-")}</div>
src/app/admin/partners/hospitality/HospitalityClient.tsx:146:                  const statusLabel = toTitleCase(d.status || "");
src/app/admin/partners/retail/RetailClient.tsx:148:                    const statusLabel = toTitleCase(d.status || "");
src/app/admin/platform/EquipmentDashboard.tsx:151:                      <td className="py-1.5 pr-2 text-[var(--tx2)]">{toTitleCase(l.reason)}</td>
src/app/admin/platform/PricingControlPanel.tsx:588:              <td className={td}><span className="text-[12px]">{toTitleCase(String(r.access_type))}</span></td>
src/app/admin/platform/PricingControlPanel.tsx:667:              <td className={td}><span className="text-[12px]">{toTitleCase(String(r.item_type))}</span></td>
src/app/admin/platform/PricingControlPanel.tsx:718:              <td className={td}><span className="text-[12px]">{toTitleCase(String(r.item_category))}</span></td>
src/app/admin/platform/PricingControlPanel.tsx:849:                <td className={`${td} font-medium`}>{toTitleCase(st)}</td>
src/app/admin/platform/PricingControlPanel.tsx:910:              <td className={td}><span className="text-[12px]">{toTitleCase(String(r.parameter))}</span></td>
src/app/admin/platform/PricingControlPanel.tsx:1713:                    <option key={r} value={r}>{toTitleCase(r)}</option>
src/app/admin/quotes/QuotesListClient.tsx:271:                {toTitleCase(q.status)}
src/app/admin/quotes/QuotesListClient.tsx:281:        exportAccessor: (q) => toTitleCase(q.status),
src/app/admin/quotes/[quoteId]/QuoteDetailClient.tsx:207:            {toTitleCase(quote.status)}
src/app/admin/quotes/[quoteId]/QuoteDetailClient.tsx:213:          {toTitleCase(quote.service_type?.split("_").join(" "))} &middot; Created{" "}
src/app/admin/quotes/[quoteId]/QuoteDetailClient.tsx:361:                      {toTitleCase(quote.truck_primary)}
src/app/admin/quotes/[quoteId]/QuoteDetailClient.tsx:362:                      {quote.truck_secondary ? ` + ${toTitleCase(quote.truck_secondary)}` : ""}
src/app/admin/quotes/[quoteId]/QuoteDetailClient.tsx:413:                      label: toTitleCase(ev.type),
src/app/admin/quotes/[quoteId]/QuoteDetailClient.tsx:576:                <span className="text-[var(--tx)] font-medium">{toTitleCase(quote.service_type?.split("_").join(" "))}</span>
src/app/admin/quotes/[quoteId]/QuoteDetailClient.tsx:587:                  <span className="text-[var(--tx)] font-medium">{toTitleCase(quote.truck_primary)}</span>
src/app/admin/quotes/new/QuoteFormClient.tsx:2465:                          {toTitleCase(type)}
src/app/admin/quotes/new/QuoteFormClient.tsx:2474:                          <span className="text-[11px] text-[var(--tx)] flex-1">{toTitleCase(item.type)}</span>
src/app/admin/quotes/new/QuoteFormClient.tsx:4063:                      <SinglePriceDisplay price={quoteResult.custom_price} label={toTitleCase(serviceType)} />
src/app/admin/quotes/new/QuoteFormClient.tsx:5302:          <span className="text-[var(--tx3)]">{toTitleCase(key)}</span>
src/app/admin/reports/CrewReportsTab.tsx:590:                            <span className="font-semibold capitalize">{toTitleCase(inc.issue_type)}</span>
src/app/api/admin/calendar/route.ts:228:          ? `${toTitleCase(eventPhase || "event")} · ${m.client_name || ""}`
src/app/api/admin/calendar/route.ts:229:          : `${toTitleCase(m.move_type || "")} Move`.trim(),
src/app/api/admin/calendar/route.ts:292:        description: `${itemCount ? itemCount + "pc " : ""}${toTitleCase(d.delivery_type || d.category || "")} Delivery`.trim(),
src/app/api/admin/calendar/route.ts:309:        category: (d.category || d.delivery_type) ? toTitleCase(String(d.category || d.delivery_type)) : null,
src/app/api/admin/calendar/route.ts:522:        category: toTitleCase(b.block_type),
src/app/api/admin/calendar/route.ts:575:            ? `Day Rate · ${toTitleCase(r.vehicle_type || "")}`
src/app/api/admin/calendar/route.ts:576:            : toTitleCase((r.booking_type || "").replace(/_/g, " "));
src/app/api/partner/calendar/route.ts:96:      description: `${itemCount ? itemCount + "pc " : ""}${toTitleCase(d.delivery_type || d.category || "")} Delivery`.trim(),
src/app/api/partner/calendar/route.ts:113:      category: (d.category || d.delivery_type) ? toTitleCase(String(d.category || d.delivery_type)) : null,
src/app/api/partner/calendar/route.ts:155:        ? `Day Rate · ${toTitleCase(r.vehicle_type || "")}`
src/app/api/partner/calendar/route.ts:156:        : toTitleCase((r.booking_type || "").replace(/_/g, " "));
src/app/crew/expense/CrewExpenseClient.tsx:263:                      ${(e.amount_cents / 100).toFixed(2)} · {toTitleCase(e.category)}
src/app/crew/expense/CrewExpenseClient.tsx:267:                      {new Date(e.submitted_at).toLocaleDateString()} · {toTitleCase(e.status)}
src/app/partner/PartnerDeliveryDetailModal.tsx:322:                  {liveStage ? (CREW_STATUS_TO_LABEL[liveStage] || toTitleCase(liveStage)) : toTitleCase(d.status || "")}
src/app/partner/PartnerDeliveryDetailModal.tsx:472:                        {isCompleted ? "Delivery complete" : liveStage ? (STAGE_LABELS[liveStage] || CREW_STATUS_TO_LABEL[liveStage] || toTitleCase(liveStage)) : "Crew assigned"}
src/app/partner/tabs/PartnerB2BProjectsTab.tsx:205:  return ITEM_STATUS_CONFIG[s] || { label: toTitleCase(s), color: "text-[#888]", bg: "bg-[#888]/10" };
src/app/partner/tabs/PartnerDeliveriesTab.tsx:242:  const statusLabel = STATUS_LABEL_OVERRIDE[statusKey] || toTitleCase(d.status || "");
src/app/partner/tabs/PartnerDeliveriesTab.tsx:283:              : [d.delivery_type ? toTitleCase(String(d.delivery_type).replace(/_/g, " ")) : null, d.zone != null ? `Z${d.zone}` : null].filter(Boolean).join(" · ") || d.delivery_address || "Address TBD"}
src/app/partner/tabs/PartnerLiveMapTab.tsx:127:                {CREW_STATUS_TO_LABEL[selected.live_stage || ""] || toTitleCase(selected.live_stage || "") || "Active"}
src/app/partner/tabs/PartnerRealtorTab.tsx:58:        const statusLabel = toTitleCase(r.status || "");
src/app/quote/[quoteId]/layouts/B2BOneOffLayout.tsx:77:                {toTitleCase(String(f.item_category))}
src/app/quote/[quoteId]/layouts/OfficeLayout.tsx:39:    quote.from_access && { label: "Origin Access", value: toTitleCase(quote.from_access) },
src/app/quote/[quoteId]/layouts/OfficeLayout.tsx:40:    quote.to_access && { label: "Destination Access", value: toTitleCase(quote.to_access) },
src/app/quote/[quoteId]/layouts/SingleItemLayout.tsx:26:  const category = toTitleCase((f?.item_category as string) ?? "item");
src/app/quote/[quoteId]/layouts/SpecialtyLayout.tsx:56:  const accessLabel = accessKey ? (SPECIALTY_ACCESS_LABELS[accessKey] ?? toTitleCase(accessKey.replace(/_/g, " "))) : "";
src/app/quote/[quoteId]/layouts/SpecialtyLayout.tsx:133:              {PROJECT_TYPE_LABELS[projectType] ?? toTitleCase(projectType)}
src/app/quote/[quoteId]/layouts/SpecialtyLayout.tsx:186:                  <span>{SPECIALTY_BUILDING_LABELS[key] ?? toTitleCase(key.replace(/_/g, " "))}</span>
src/app/quote/[quoteId]/layouts/WhiteGloveLayout.tsx:77:              {toTitleCase((f?.item_category as string) ?? "premium item")}
src/app/shipment/[id]/track/PublicInboundTrackClient.tsx:106:                  <div className="font-medium">{toTitleCase(row.status)}</div>
src/app/track/delivery/[id]/TrackDeliveryClient.tsx:353:                {normalizedStage ? CLIENT_STAGE_LABELS[normalizedStage] || CLIENT_MAIN_STEPS[clientMainStepIdx] : toTitleCase(liveStage || "")}
src/app/track/delivery/[id]/TrackDeliveryClient.tsx:891:                      {normalizedStage ? CLIENT_STAGE_LABELS[normalizedStage] : toTitleCase(liveStage || "")}
src/app/track/move/[id]/TrackLiveMap.tsx:450:                        {CREW_STATUS_TO_LABEL[liveStage || ""] || toTitleCase(liveStage || "") || "Live"}
src/app/track/move/[id]/TrackMoveClient.tsx:151:  return map[status] ?? toTitleCase(status);
src/components/booking/ContractSign.tsx:182:  const serviceHeading = isBinRental ? "Bin Rental" : toTitleCase(q.serviceType);
src/components/dispatch/JobCard.tsx:86:  return STATUS_DOT[s] || { icon: Circle, color: "text-[var(--tx3)]", label: toTitleCase(status || "-") };
```

Implementation: `src/lib/format-text.ts` → `export function toTitleCase(...)`.

---

## 5. All `src/**/*.tsx` and `src/**/*.ts` files containing the word `capitalize`

**246 files** (typically Tailwind class `capitalize`, or `textTransform: "capitalize"`, or inline `text-transform:capitalize` in email HTML strings):

<!-- FILE_LIST_START -->
src/app/admin/AdminPageClient.tsx
src/app/admin/audit-log/AuditLogClient.tsx
src/app/admin/bin-rentals/BinRentalsClient.tsx
src/app/admin/bin-rentals/[id]/BinOrderDetailClient.tsx
src/app/admin/calendar/components/CalendarHeader.tsx
src/app/admin/calendar/components/DayView.tsx
src/app/admin/calendar/components/JobCard.tsx
src/app/admin/calendar/components/JobDetailPanel.tsx
src/app/admin/calendar/components/MonthView.tsx
src/app/admin/calendar/components/ScheduleJobModal.tsx
src/app/admin/calendar/components/WeekView.tsx
src/app/admin/change-requests/ChangeRequestsClient.tsx
src/app/admin/change-requests/page.tsx
src/app/admin/claims/ClaimsListClient.tsx
src/app/admin/claims/[id]/ClaimDetailClient.tsx
src/app/admin/claims/new/NewClaimClient.tsx
src/app/admin/clients/ClientsPageClient.tsx
src/app/admin/clients/ClientsTableBody.tsx
src/app/admin/clients/MoveClientsTableBody.tsx
src/app/admin/clients/[id]/AdminPartnerAnalytics.tsx
src/app/admin/clients/[id]/ClientDetailClient.tsx
src/app/admin/clients/[id]/DeliverySummaryModal.tsx
src/app/admin/clients/[id]/EditPartnerModal.tsx
src/app/admin/clients/[id]/InvoiceDetailModal.tsx
src/app/admin/clients/[id]/PartnerCardOnFileSection.tsx
src/app/admin/clients/[id]/PartnerPaymentTermsSection.tsx
src/app/admin/clients/[id]/PartnerRateCardTab.tsx
src/app/admin/clients/[id]/PortalAccessSection.tsx
src/app/admin/clients/[id]/revenue/page.tsx
src/app/admin/clients/new/NewClientForm.tsx
src/app/admin/components/AdminShell.tsx
src/app/admin/components/ChangePasswordGate.tsx
src/app/admin/components/CommandPalette.tsx
src/app/admin/components/ContactDetailsModal.tsx
src/app/admin/components/FilterBar.tsx
src/app/admin/components/NotificationDropdown.tsx
src/app/admin/components/ProfileDropdown.tsx
src/app/admin/components/ScheduleItem.tsx
src/app/admin/components/SearchBox.tsx
src/app/admin/components/SegmentedProgressBar.tsx
src/app/admin/components/Sidebar.tsx
src/app/admin/crew/CrewMap.tsx
src/app/admin/crew/DispatchMapView.tsx
src/app/admin/crew/UnifiedTrackingView.tsx
src/app/admin/crew/analytics/CrewAnalyticsClient.tsx
src/app/admin/crew/page.tsx
src/app/admin/deliveries/AllProjectsView.tsx
src/app/admin/deliveries/RecurringSchedulesView.tsx
src/app/admin/deliveries/[id]/DeliveryCrewPhotosSection.tsx
src/app/admin/deliveries/[id]/DeliveryDetailClient.tsx
src/app/admin/deliveries/[id]/EditDeliveryModal.tsx
src/app/admin/deliveries/new/AdminDayRateForm.tsx
src/app/admin/deliveries/new/B2BOneOffDeliveryForm.tsx
src/app/admin/deliveries/new/NewDeliveryForm.tsx
src/app/admin/dispatch/DispatchBoardClient.tsx
src/app/admin/drafts/DraftsClient.tsx
src/app/admin/finance/forecast/ForecastClient.tsx
src/app/admin/finance/profitability/ProfitabilityClient.tsx
src/app/admin/inbound-shipments/InboundShipmentsClient.tsx
src/app/admin/inbound-shipments/[id]/InboundShipmentDetailClient.tsx
src/app/admin/inbound-shipments/new/NewInboundShipmentClient.tsx
src/app/admin/invoices/AdminInvoiceDetailModal.tsx
src/app/admin/invoices/CreateInvoiceModal.tsx
src/app/admin/invoices/new/page.tsx
src/app/admin/invoices/page.tsx
src/app/admin/moves/AllMovesClient.tsx
src/app/admin/moves/[id]/BalancePaymentSection.tsx
src/app/admin/moves/[id]/ClientMessagesSection.tsx
src/app/admin/moves/[id]/DistanceLogistics.tsx
src/app/admin/moves/[id]/EditMoveDetailsModal.tsx
src/app/admin/moves/[id]/InventoryChangeRequestPanel.tsx
src/app/admin/moves/[id]/MoveContactModal.tsx
src/app/admin/moves/[id]/MoveCrewPhotosSection.tsx
src/app/admin/moves/[id]/MoveDetailClient.tsx
src/app/admin/moves/[id]/MoveDocumentsSection.tsx
src/app/admin/moves/[id]/MoveFilesSection.tsx
src/app/admin/moves/[id]/MoveInventorySection.tsx
src/app/admin/moves/[id]/MovePhotosSection.tsx
src/app/admin/moves/[id]/MoveSignOffSection.tsx
src/app/admin/moves/[id]/RecommendedCrewPanel.tsx
src/app/admin/moves/new/CreateMoveForm.tsx
src/app/admin/moves/office/OfficeMovesClient.tsx
src/app/admin/moves/residential/ResidentialMovesClient.tsx
src/app/admin/notifications/page.tsx
src/app/admin/partners/AllPartnersClient.tsx
src/app/admin/partners/[partnerId]/billing/PartnerBillingAdmin.tsx
src/app/admin/partners/designers/DesignerDashboard.tsx
src/app/admin/partners/designers/page.tsx
src/app/admin/partners/gallery/CreateGalleryProjectModal.tsx
src/app/admin/partners/gallery/EditProjectModal.tsx
src/app/admin/partners/gallery/GalleryClient.tsx
src/app/admin/partners/gallery/GalleryItemsPanel.tsx
src/app/admin/partners/gallery/page.tsx
src/app/admin/partners/health/PartnerHealthClient.tsx
src/app/admin/partners/hospitality/HospitalityClient.tsx
src/app/admin/partners/hospitality/page.tsx
src/app/admin/partners/realtors/AddRealtorModal.tsx
src/app/admin/partners/realtors/AddReferralModal.tsx
src/app/admin/partners/realtors/AgentDetailModal.tsx
src/app/admin/partners/realtors/RealtorPartnersSection.tsx
src/app/admin/partners/realtors/page.tsx
src/app/admin/partners/retail/RetailClient.tsx
src/app/admin/partners/retail/page.tsx
src/app/admin/partners/statements/[statementId]/PartnerStatementView.tsx
src/app/admin/perks/page.tsx
src/app/admin/platform/AddPortalAccessModal.tsx
src/app/admin/platform/AddTeamMemberModal.tsx
src/app/admin/platform/DeviceSetupCodes.tsx
src/app/admin/platform/EquipmentDashboard.tsx
src/app/admin/platform/FleetVehiclesManager.tsx
src/app/admin/platform/InviteUserModal.tsx
src/app/admin/platform/PartnerOnboardingWizard.tsx
src/app/admin/platform/PartnersManagement.tsx
src/app/admin/platform/PlatformSettingsClient.tsx
src/app/admin/platform/PricingControlPanel.tsx
src/app/admin/platform/RateTemplatesPanel.tsx
src/app/admin/platform/TruckAssignments.tsx
src/app/admin/platform/UserDetailModal.tsx
src/app/admin/platform/page.tsx
src/app/admin/projects/ProjectsListClient.tsx
src/app/admin/projects/[projectId]/ProjectDetailClient.tsx
src/app/admin/projects/new/NewProjectForm.tsx
src/app/admin/quotes/QuotesListClient.tsx
src/app/admin/quotes/[quoteId]/QuoteDetailClient.tsx
src/app/admin/quotes/[quoteId]/edit/EditQuoteClient.tsx
src/app/admin/quotes/new/QuoteFormClient.tsx
src/app/admin/reports/CrewReportsTab.tsx
src/app/admin/reports/ReportsClient.tsx
src/app/admin/reports/page.tsx
src/app/admin/revenue/RevenueClient.tsx
src/app/admin/settings/AppearanceSettings.tsx
src/app/admin/settings/EditableEmailSection.tsx
src/app/admin/settings/IntegrationHealthPanel.tsx
src/app/admin/settings/LoginHistoryPanel.tsx
src/app/admin/settings/NotificationToggles.tsx
src/app/admin/settings/PartnerProfileSettings.tsx
src/app/admin/settings/[tab]/page.tsx
src/app/admin/settings/layout.tsx
src/app/admin/tips/TipsClient.tsx
src/app/admin/users/UsersClient.tsx
src/app/admin/widget-leads/WidgetLeadsClient.tsx
src/app/api/admin/projects/[id]/route.ts
src/app/api/admin/projects/route.ts
src/app/api/cron/daily-brief/route.ts
src/app/api/cron/partner-statements/route.ts
src/app/api/partner/daily-summary/route.ts
src/app/claim/new/ClaimSubmissionClient.tsx
src/app/crew/bin-orders/page.tsx
src/app/crew/components/CrewSettingsDropdown.tsx
src/app/crew/components/CrewShell.tsx
src/app/crew/dashboard/components/ReadinessCheck.tsx
src/app/crew/dashboard/job/[type]/[id]/DayRateStopFlow.tsx
src/app/crew/dashboard/job/[type]/[id]/JobInventory.tsx
src/app/crew/dashboard/job/[type]/[id]/JobPhotos.tsx
src/app/crew/dashboard/job/[type]/[id]/WalkthroughModal.tsx
src/app/crew/dashboard/job/[type]/[id]/page.tsx
src/app/crew/dashboard/job/[type]/[id]/signoff/page.tsx
src/app/crew/dashboard/page.tsx
src/app/crew/end-of-day/page.tsx
src/app/crew/expense/CrewExpenseClient.tsx
src/app/crew/login/page.tsx
src/app/crew/setup/page.tsx
src/app/crew/stats/page.tsx
src/app/legal/privacy-policy/page.tsx
src/app/legal/terms-and-conditions/page.tsx
src/app/legal/terms-of-use/page.tsx
src/app/login/page.tsx
src/app/partner/PartnerDeliveryDetailModal.tsx
src/app/partner/PartnerPortalClient.tsx
src/app/partner/PartnerScheduleModal.tsx
src/app/partner/PartnerSettingsPanel.tsx
src/app/partner/statements/[statementId]/pay/PartnerStatementPayClient.tsx
src/app/partner/tabs/PartnerAnalyticsTab.tsx
src/app/partner/tabs/PartnerB2BProjectsTab.tsx
src/app/partner/tabs/PartnerBillingTab.tsx
src/app/partner/tabs/PartnerCalendarTab.tsx
src/app/partner/tabs/PartnerDeliveriesTab.tsx
src/app/partner/tabs/PartnerInboundShipmentsTab.tsx
src/app/partner/tabs/PartnerInvoicesTab.tsx
src/app/partner/tabs/PartnerLiveMapTab.tsx
src/app/partner/tabs/PartnerProjectsTab.tsx
src/app/partner/tabs/PartnerRealtorTab.tsx
src/app/partner/tabs/PartnerRecurringTab.tsx
src/app/pay/[moveId]/BalancePaymentClient.tsx
src/app/quote-widget/QuoteWidgetClient.tsx
src/app/quote/[quoteId]/QuotePageClient.tsx
src/app/quote/[quoteId]/layouts/B2BOneOffLayout.tsx
src/app/quote/[quoteId]/layouts/BinRentalLayout.tsx
src/app/quote/[quoteId]/layouts/EventLayout.tsx
src/app/quote/[quoteId]/layouts/LabourOnlyLayout.tsx
src/app/quote/[quoteId]/layouts/LongDistanceLayout.tsx
src/app/quote/[quoteId]/layouts/OfficeLayout.tsx
src/app/quote/[quoteId]/layouts/ResidentialLayout.tsx
src/app/quote/[quoteId]/layouts/SingleItemLayout.tsx
src/app/quote/[quoteId]/layouts/SpecialtyLayout.tsx
src/app/quote/[quoteId]/layouts/WhiteGloveLayout.tsx
src/app/track/delivery/[id]/TrackDeliveryClient.tsx
src/app/track/move/[id]/ClientSettingsMenu.tsx
src/app/track/move/[id]/TrackDocuments.tsx
src/app/track/move/[id]/TrackInventory.tsx
src/app/track/move/[id]/TrackLiveMap.tsx
src/app/track/move/[id]/TrackMoveClient.tsx
src/app/track/move/[id]/TrackPhotos.tsx
src/app/track/move/[id]/TrackingAgreementModal.tsx
src/app/track/rissd/[id]/RissdCustomerTrackClient.tsx
src/app/tracking/TrackingLookup.tsx
src/app/update-password/page.tsx
src/components/EmbedQuoteCalculator.tsx
src/components/ProofOfDeliverySection.tsx
src/components/SeasonalPricingPreview.tsx
src/components/VendorStatusCompactTable.tsx
src/components/YugoLogo.tsx
src/components/admin/CancelMoveModal.tsx
src/components/admin/DataTable.tsx
src/components/admin/PartnerPortalFeaturesCard.tsx
src/components/admin/RevenueForecastWidget.tsx
src/components/admin/SchedulingSuggestion.tsx
src/components/booking/ContractSign.tsx
src/components/crew/CrewAreaWeather.tsx
src/components/crew/CrewNavigation.tsx
src/components/crew/JobConditionsInline.tsx
src/components/delivery-day/DeliveryDayForm.tsx
src/components/dispatch/DispatchSchedule.tsx
src/components/dispatch/JobCard.tsx
src/components/dispatch/RoutingSuggestionBanner.tsx
src/components/inventory/InventoryInput.tsx
src/components/partner/DeliveryScoreCard.tsx
src/components/partner/OrgSwitcher.tsx
src/components/partner/PartnerSpendSummary.tsx
src/components/partner/RescheduleDeliveryModal.tsx
src/components/payments/SquarePaymentForm.tsx
src/components/tracking/InventoryChangeRequestModal.tsx
src/components/tracking/LiveMoveTimeline.tsx
src/components/tracking/PreMoveChecklist.tsx
src/components/ui/AddressAutocomplete.tsx
src/components/ui/KpiCard.tsx
src/components/ui/MultiStopAddressField.tsx
src/components/ui/SectionDivider.tsx
src/lib/b2b-delivery-business-notifications.ts
src/lib/delivery-tracking-tokens.ts
src/lib/email-templates.ts
src/lib/email/admin-templates.ts
src/lib/email/client-email-footer.ts
src/lib/email/lifecycle-templates.ts
src/lib/email/quote-templates.ts
src/lib/extra-item-notifications.ts
<!-- FILE_LIST_END -->

---

## 6. Per-line `capitalize` listing

There are **thousands** of class tokens / style properties across those files. To dump **every line**:

```bash
grep -rn '\bcapitalize\b' src --include='*.tsx' --include='*.ts' --include='*.css'
```

---

## 7. Notes

- **`capitalize` in TS/TSX** is usually the Tailwind utility (title-style first letter per word) or `textTransform: "capitalize"` / email `text-transform:capitalize`.
- **`toTitleCase`** handles **snake_case** and **kebab-case** by normalizing spaces then capitalizing word starts (`src/lib/format-text.ts`).
- This document was generated from the repo state when the inventory was written; re-run the commands in §0 after large refactors.
