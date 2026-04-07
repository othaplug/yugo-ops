/**
 * Property Management partner portal — typography tokens.
 * Serif (font-hero): page titles, section headings, large KPI numerals.
 * DM Sans (var(--font-body)): labels, nav, body, tables, uppercase eyebrows.
 */

export const pmFontBody = "[font-family:var(--font-body)]";

/** Small caps section eyebrows (Volume, Cost, …) */
export const pmEyebrow =
  `text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.12em] leading-none text-[#5A6B5E] ${pmFontBody}`;

/** “Partner portal” line above tab context titles */
export const pmPortalEyebrow =
  `text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.12em] leading-none text-[#5A6B5E] mb-2 ${pmFontBody}`;

/** Primary page title (tab context) */
export const pmPageTitle =
  "font-hero font-normal text-[#5C1A33] leading-[1.1] tracking-tight break-words text-[24px] sm:text-[28px] md:text-[30px]";

/** Subtitle under tab context titles */
export const pmPageSubtitle =
  `text-[14px] leading-relaxed text-[#5A6B5E] mt-2 max-w-xl ${pmFontBody}`;

/** Section / chart titles (h3) */
export const pmSectionTitle =
  "font-hero font-normal text-[#5C1A33] tracking-tight leading-[1.2] text-[17px] sm:text-[18px]";

/** Card titles (buildings, projects) */
export const pmCardTitle =
  "font-hero font-normal text-[#5C1A33] leading-tight text-[17px] sm:text-[18px]";

/** In-page hero line (empty states, secondary page leads) */
export const pmLeadTitle =
  "font-hero font-normal text-[#5C1A33] leading-tight text-[20px] sm:text-[22px]";

/** Tab strip (Overview, Calendar, …) — already wine; keep DM caps */
export const pmTabLabel =
  `text-[10px] font-bold tracking-[0.12em] uppercase ${pmFontBody}`;

/** DM Sans tight uppercase wine title (schedule / create-project chrome) */
export const pmUiTitleCaps =
  `text-[11px] sm:text-[12px] font-bold uppercase tracking-[0.12em] leading-none text-[#5C1A33] ${pmFontBody}`;

/** Body copy */
export const pmBody =
  `text-[13px] leading-relaxed text-[#1a1f1b] ${pmFontBody}`;

/** Secondary / helper copy (meets contrast on #FAF7F2) */
export const pmBodyMuted =
  `text-[12px] sm:text-[13px] leading-relaxed text-[#5A6B5E] ${pmFontBody}`;

/** Tighter helper (cards, list meta) */
export const pmMeta =
  `text-[12px] leading-relaxed text-[#5A6B5E] ${pmFontBody}`;

/** Stat / table column labels (uppercase) */
export const pmLabelCaps =
  `text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] ${pmFontBody}`;

/** KPI strip: label above large number */
export const pmKpiLabel =
  `text-[9px] sm:text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] ${pmFontBody}`;

/** KPI strip: large value (serif) */
export const pmKpiValue =
  "text-[24px] sm:text-[28px] font-normal font-hero leading-none text-[#1a1f1b]";

export const pmKpiValueMuted =
  "text-[24px] sm:text-[28px] font-normal font-hero leading-none text-[#5A6B5E]";

/** KPI sublabel under number */
export const pmKpiSublabel =
  `text-[11px] mt-1 font-medium min-h-4 text-[#5A6B5E] ${pmFontBody}`;

/** Building card stat numerals (small grid) */
export const pmStatGridValue =
  "text-[17px] font-normal font-hero text-[#1a1f1b] tabular-nums leading-none";

/** Move history summary strip (wine serif) */
export const pmSummaryStatValue =
  "text-[18px] font-normal font-hero text-[#5C1A33] tabular-nums leading-none";

/** Overview “Needs attention” row titles */
export const pmOverviewRowTitle =
  `text-[13px] font-semibold text-[#1a1f1b] text-left tracking-tight ${pmFontBody}`;

/** Overview panel eyebrow */
export const pmOverviewPanelEyebrow =
  `text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] ${pmFontBody}`;

/** Data tables */
export const pmTableText =
  `text-[12px] text-[#1a1f1b] ${pmFontBody}`;

export const pmTableHead =
  `text-[10px] font-bold uppercase tracking-[0.12em] text-[#5A6B5E] ${pmFontBody}`;

/** Inline links on cream */
export const pmLink =
  "text-[12px] font-semibold text-[#5C1A33] hover:underline";
