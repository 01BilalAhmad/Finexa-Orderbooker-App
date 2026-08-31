# UI Redesign 003 — Aurora Glass (faithful HTML mockup port)

**Agent**: Super Z (main agent)
**Task ID**: 8-aurora-glass-redesign
**Status**: ✅ Complete
**Source of truth**: `/home/z/my-project/upload/finexa-app-preview-v2.html`
**Target style**: Style 1 of 4 — "Aurora Glass" (light + glassmorphism), the DEFAULT style

## Why round 2 failed (user feedback)

Round 2 (ui-redesign-002) was built from a TEXT SPEC with "Modern Blue"
`#2563EB / #1E40AF` colors because the mockup file was missing at that time.
The user rejected it: *"Ya to same Wohi old design hi hy bs tumny colour dark
kr diy hn mujhy to is html sy 1st design chahiye tha same to same"* — the blue
look reads as "same old design, darkened". Round 3 ports the ACTUAL Aurora
Glass tokens from the user's HTML file.

## Aurora Glass tokens extracted from the HTML

| CSS var | Value | RN usage |
|---|---|---|
| `--gradient-brand` | 135deg #4F46E5 → #7C3AED → #6366F1 | all hero headers, FAB, primary buttons |
| `--gradient-danger` | 135deg #E11D48 → #F43F5E → #FB7185 | overdue accents |
| `--bg-page` | #F8FAFC + violet/indigo radial tints | screen roots + tint blobs |
| `--bg-card / glass / pill` | rgba(255,255,255, .78/.72/.85) | glass cards (no blur — expo-blur unavailable) |
| `--border-subtle/default` | rgba(148,163,184, .18/.24) | card borders |
| accent | #4F46E5 (indigo-600) | active states |
| aurora chip | rgba(99,102,241,0.16) + #4338CA | chips, tags |
| tier colors | rose-600/rose-500/amber-500/emerald-500 | shop avatars |
| numerals | JetBrains Mono → FontMono (Menlo/monospace) | all money values |

## Files changed (26 files, +1137/−794)

### Foundation
- `constants/theme.ts` — full Aurora rewrite; `AURORA` token object + `FontMono` +
  glow/button shadows added; ALL previous export keys preserved (Colors, Spacing,
  Radius, FontSize, FontWeight, Shadow) so every screen inherits the palette.
- `constants/Colors.ts` — legacy light/dark tint aligned to indigo.
- `app.json` — native splash backgrounds → #4F46E5 / #4338CA.

### Tab bar (mockup .bottom-nav)
- `app/(tabs)/_layout.tsx` — floating glass pill (rgba white .85, 1px border,
  r-28, shadow-lg) with 26px icon chips; active = indigo + card-bg chip +
  translateY(-2). Gradient FAB 56px with 4px page border + glow, centered on the
  pill's TOP edge (mockup margin-top −28). FAB rendered as overlay SIBLING of
  the pill with `pointerEvents="box-none"` so (a) the raised half stays
  touchable on Android (container reserves 28px headroom) and (b) tab buttons
  keep their full touch area. Center 72px spacer keeps 5-slot layout.

### Login (mockup screen 1)
- `app/login.tsx` — brand-gradient hero (rounded bottom 28) with glass logo
  tile (64px r-18) + "Finexa mein khush amdeed" copy; aurora page bg with tint
  blobs; glass inputs (elevated r-12, 1.5px border) with leading icons;
  gradient Sign In with indigo glow. All login logic untouched.

### Dashboard / Route (mockup screen 2)
- `app/(tabs)/index.tsx` — hero is now FULL-BLEED brand gradient with
  "Assalam-o-Alaikum / {name} Bhai" greeting; hero-body shows "AAJ KI
  RECOVERY" big mono value + SVG progress ring (white arc, % visited);
  bento grid removed from hero and REPLACED by 2×2 white-glass KPI tiles
  (Shops / Visits / Overdue / Outstanding) overlapping the hero by −20px
  with corner icons + violet glow blobs (mockup .kpi-grid). Both modes
  (all-routes + normal) updated. compactPKR() helper (Rs 1.2L style).
  Aurora page tint blobs behind the list.

### Shops (mockup screen 3)
- `components/ui/ShopCard.tsx` — 42px tier-gradient avatars
  (overdue rose-600 / high rose-500 / mid amber / low emerald), edge tags
  (⏰ Overdue / ✓ Aaj visit / 💰 High balance / ✓ Clear), "Balance" label
  above right-aligned mono value, glass card, gradient Collect chip.
  `getShopDisplayBalance` export byte-for-byte identical; all props/handlers
  preserved.

### Recovery sheet (mockup screen 4) & Shop detail (screen 5)
- `components/ui/RecoveryBottomSheet.tsx` — palette + gradient conversion
  (amount hero = brand gradient, sheet = elevated glass r-28, submit = indigo
  glow r-12).
- `components/ui/ShopDetailModal.tsx` — hero gradient + full palette swap.

### Ledger / Profile / Map (screens 7 / 10 / 8)
- `app/(tabs)/ledger.tsx` — hero gradient; txn rows match mockup ledger
  semantics: RECOVERY = emerald, CREDIT = rose.
- `app/(tabs)/profile.tsx`, `app/(tabs)/map.tsx` — gradient + palette swap.

### Startup + shared components (palette sweep)
BismillahSplash (brand gradient), PinLockScreen, PinSetupScreen, download,
route-summary, setup-url, DailyReportCard, NotificationChoice, OfflineBanner,
OverdueAlertBanner (danger → rose), GpsVisitBottomSheet, EditRecoveryModal,
PerformanceChart, RecoveryAnalysisChart, PendingMessagesSheet.
`RecoveryReceipt.tsx` + PDF generators intentionally NOT changed — printed
receipts are branded artifacts, not app UI.

## Verification

- `npx tsc --noEmit` → **0 errors** (whole app, deps installed fresh).
- `npx eslint app/ components/ constants/` → 5 errors, ALL pre-existing
  `react/no-unescaped-entities` (original code had 7 errors; this round fixed
  2 incidentally and added none).
- No `#2563EB / #1E40AF / #1D4ED8 / #60A5FA` left in app UI code.
- FAB touch area verified for Android hit-testing constraints.
