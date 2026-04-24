# Hex Color Audit — Baseline (PR 1)

This is the frozen baseline of raw hex color literals in `.tsx` files under
`src/app/admin/**` and `src/components/**` at the moment PR 1 lands.

- **Scan pattern**: `#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?(?:[0-9A-Fa-f]{2})?`
  on file contents (matches 3/6/8-digit hex literals).
- **Scope**: `*.tsx` files only under the two target directories.
- **Target**: zero matches after PR 6 ships.

## Totals

| Directory          | Files with hex | Hex occurrences |
| ------------------ | -------------- | --------------- |
| `src/app/admin/**` | 59             | 380             |
| `src/components/**`| 44             | 512             |
| **Grand total**    | **103**        | **892**         |

The audit excludes `src/app/admin-v2/**` (out of scope for this redesign;
admin-v2 is a separate shell), `src/styles/**` (tokens and CSS utilities
live here by design), and CSS files in `globals.css`.

## `src/app/admin/**/*.tsx`

| File | Hex occurrences |
| ---- | ---: |
| src/app/admin/crew/UnifiedTrackingView.tsx | 39 |
| src/app/admin/quotes/new/QuoteFormClient.tsx | 38 |
| src/app/admin/calendar/components/JobDetailPanel.tsx | 28 |
| src/app/admin/finance/profitability/ProfitabilityClient.tsx | 16 |
| src/app/admin/partners/gallery/GalleryItemsPanel.tsx | 16 |
| src/app/admin/crew/analytics/CrewAnalyticsClient.tsx | 14 |
| src/app/admin/partners/AllPartnersClient.tsx | 13 |
| src/app/admin/platform/PartnersManagement.tsx | 13 |
| src/app/admin/partners/[partnerId]/billing/PartnerBillingAdmin.tsx | 13 |
| src/app/admin/partners/health/PartnerHealthClient.tsx | 13 |
| src/app/admin/AdminPageClient.tsx | 11 |
| src/app/admin/deliveries/AllProjectsView.tsx | 11 |
| src/app/admin/deliveries/[id]/DeliveryDetailClient.tsx | 9 |
| src/app/admin/deliveries/[id]/LiveTrackingMap.tsx | 9 |
| src/app/admin/components/AdminShell.tsx | 7 |
| src/app/admin/moves/new/CreateMoveForm.tsx | 7 |
| src/app/admin/projects/[projectId]/ProjectDetailClient.tsx | 7 |
| src/app/admin/partners/statements/[statementId]/PartnerStatementView.tsx | 7 |
| src/app/admin/revenue/RevenueClient.tsx | 6 |
| src/app/admin/deliveries/[id]/LiveTrackingMapLeaflet.tsx | 6 |
| src/app/admin/moves/[id]/MoveFilesSection.tsx | 6 |
| src/app/admin/perks/page.tsx | 6 |
| src/app/admin/clients/[id]/AdminPartnerAnalytics.tsx | 6 |
| src/app/admin/quotes/new/b2b-one-off-ui.tsx | 5 |
| src/app/admin/components/NotificationDropdown.tsx | 5 |
| src/app/admin/notifications/page.tsx | 5 |
| src/app/admin/finance/forecast/ForecastClient.tsx | 5 |
| src/app/admin/moves/AllMovesClient.tsx | 4 |
| src/app/admin/quotes/[quoteId]/QuoteDetailClient.tsx | 4 |
| src/app/admin/crew/DispatchMapView.tsx | 4 |
| src/app/admin/moves/[id]/MoveDetailClient.tsx | 3 |
| src/app/admin/dispatch/DispatchBoardClient.tsx | 3 |
| src/app/admin/settings/AppearanceSettings.tsx | 3 |
| src/app/admin/calendar/CalendarView.tsx | 3 |
| src/app/admin/platform/PlatformSettingsClient.tsx | 3 |
| src/app/admin/tips/TipsClient.tsx | 3 |
| src/app/admin/bin-rentals/BinRentalsClient.tsx | 2 |
| src/app/admin/calendar/components/WeekView.tsx | 2 |
| src/app/admin/moves/[id]/MoveSignOffSection.tsx | 2 |
| src/app/admin/claims/ClaimsListClient.tsx | 2 |
| src/app/admin/claims/[id]/ClaimDetailClient.tsx | 2 |
| src/app/admin/widget-leads/WidgetLeadsClient.tsx | 2 |
| src/app/admin/platform/PricingControlPanel.tsx | 1 |
| src/app/admin/components/SegmentedProgressBar.tsx | 1 |
| src/app/admin/moves/[id]/MoveModificationQuickForm.tsx | 1 |
| src/app/admin/inbound-shipments/InboundShipmentsClient.tsx | 1 |
| src/app/admin/leads/LeadsHubClient.tsx | 1 |
| src/app/admin/quotes/[quoteId]/edit/EditQuoteClient.tsx | 1 |
| src/app/admin/inbound-shipments/new/NewInboundShipmentClient.tsx | 1 |
| src/app/admin/components/SearchBox.tsx | 1 |
| src/app/admin/invoices/AdminInvoiceDetailModal.tsx | 1 |
| src/app/admin/inbound-shipments/[id]/InboundShipmentDetailClient.tsx | 1 |
| src/app/admin/quotes/QuotesListClient.tsx | 1 |
| src/app/admin/partners/gallery/GalleryClient.tsx | 1 |
| src/app/admin/components/ScheduleItem.tsx | 1 |
| src/app/admin/partners/realtors/RealtorsTable.tsx | 1 |
| src/app/admin/crew/CrewMap.tsx | 1 |
| src/app/admin/crew/CrewMapLeaflet.tsx | 1 |
| src/app/admin/calendar/components/MonthView.tsx | 1 |

## `src/components/**/*.tsx`

| File | Hex occurrences |
| ---- | ---: |
| src/components/partner/pm/PartnerPmPortalViews.tsx | 98 |
| src/components/partner/pm/PartnerPmCalendarTab.tsx | 57 |
| src/components/partner/pm/PartnerPmStatementsTab.tsx | 52 |
| src/components/maps/PartnerPricingMap.tsx | 37 |
| src/components/partner/pm/PartnerPmAnalyticsTab.tsx | 37 |
| src/components/crew/CrewNavigation.tsx | 27 |
| src/components/EmbedQuoteCalculator.tsx | 16 |
| src/components/partner/PartnerPortalWelcomeTour.tsx | 12 |
| src/components/booking/ContractSign.tsx | 11 |
| src/components/crew/WaiverFlow.tsx | 10 |
| src/components/tracking/InventoryChangeRequestModal.tsx | 9 |
| src/components/tracking/ClientRoomPhotoCapture.tsx | 10 |
| src/components/dispatch/ActivityFeed.tsx | 10 |
| src/components/partner/RescheduleDeliveryModal.tsx | 10 |
| src/components/partner/PartnerChrome.tsx | 9 |
| src/components/crew/CrewBuildingReportCard.tsx | 8 |
| src/components/StageProgressBar.tsx | 7 |
| src/components/crew/ClientWaiverView.tsx | 7 |
| src/components/tracking/PreMoveChecklist.tsx | 7 |
| src/components/YugoLogo.tsx | 7 |
| src/components/DeliveryProgressBar.tsx | 6 |
| src/components/crew/CrewAreaWeather.tsx | 6 |
| src/components/SeasonalPricingPreview.tsx | 5 |
| src/components/ui/InfoHint.tsx | 5 |
| src/components/tracking/LiveMoveTimeline.tsx | 5 |
| src/components/partner/DeliveryScoreCard.tsx | 5 |
| src/components/payments/SquarePaymentForm.tsx | 4 |
| src/components/dispatch/JobCard.tsx | 4 |
| src/components/dispatch/DispatchMap.tsx | 4 |
| src/components/tracking/ExperienceRatingSection.tsx | 4 |
| src/components/partner/PartnerOnboardingChecklist.tsx | 3 |
| src/components/partner/PartnerSpendSummary.tsx | 3 |
| src/components/ui/MultiStopAddressField.tsx | 3 |
| src/components/tracking/EstateServiceChecklist.tsx | 2 |
| src/components/tracking/TipSection.tsx | 2 |
| src/components/TruckMarker.tsx | 2 |
| src/components/tracking/TipConfirmation.tsx | 1 |
| src/components/tracking/TrackYourCrewSection.tsx | 1 |
| src/components/admin/AdminContextHints.tsx | 1 |
| src/components/admin/ReferralPartnersOverviewHint.tsx | 1 |
| src/components/YugoBetaBanner.tsx | 1 |
| src/components/dispatch/RoutingSuggestionBanner.tsx | 1 |
| src/components/delivery-day/DeliveryDayForm.tsx | 1 |
| src/components/ui/OfflineBanner.tsx | 1 |

## Reading the list

Top offenders in `src/app/admin`:

1. `crew/UnifiedTrackingView.tsx` (39)
2. `quotes/new/QuoteFormClient.tsx` (38)
3. `calendar/components/JobDetailPanel.tsx` (28)

Top offenders in `src/components`:

1. `partner/pm/PartnerPmPortalViews.tsx` (98)
2. `partner/pm/PartnerPmCalendarTab.tsx` (57)
3. `partner/pm/PartnerPmStatementsTab.tsx` (52)

Note that many of the `src/components/partner/**` and `src/components/crew/**`
files live outside the redesign scope (partner + crew portals use their own
shells). Later PRs will decide whether to migrate them, but they are listed
here for completeness.

## How to reproduce

From repo root:

```bash
# per-file count (requires ripgrep)
rg --count-matches '#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?(?:[0-9A-Fa-f]{2})?\b' -g '*.tsx' src/app/admin src/components

# grand total
rg --count-matches '#[0-9A-Fa-f]{3}(?:[0-9A-Fa-f]{3})?(?:[0-9A-Fa-f]{2})?\b' -g '*.tsx' src/app/admin src/components \
  | awk -F: '{sum+=$NF} END {print sum}'
```
