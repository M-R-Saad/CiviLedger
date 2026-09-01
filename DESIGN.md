# Design

Starter visual system for CiviLedger. The current `frontend/` has an empty Tailwind
theme and no token layer, so this file seeds the system rather than documenting an
existing one. Once the token layer and primitives are built, reconcile the exact
values here with the code (`/impeccable document` can regenerate from the real CSS).

Register: **product**. Color strategy: **Restrained** (tinted neutrals plus one accent
under 10% of any surface). Reference lane: Stripe dashboard, GOV.UK Design System,
Linear. The look is a registry office, not a launch.

---

## 1. Theme

**Light is the default and the only implemented theme for the pilot.**

Scene sentence that forces it: an issuer clerk doing forty issuances in a shift under
fluorescent office light on a mid-range monitor, and a citizen checking their wallet on
a 2019 Android phone in daylight. Both are in bright rooms doing careful work. Dark mode
is drafted below as a Phase 2 addition (auditors working late, low-vision preference)
but is not built yet.

Neutrals are tinted warm (hue ~75) so the product reads as paper and ink, not as cold
slate. Never `#000` or `#fff`.

---

## 2. Color

OKLCH. All text tokens are AA (>= 4.5:1) on `--bg` and on `--surface`.

### Light tokens

```css
:root {
  /* Surfaces */
  --bg:              oklch(0.992 0.003 75);   /* app background, warm near-white */
  --surface:         oklch(1     0     0  );   /* cards, tables, panels */
  --surface-sunken:  oklch(0.972 0.004 75);   /* table header, inset wells, code blocks */
  --surface-raised:  oklch(1     0     0  );   /* popovers, menus (shadow, not tint) */

  /* Text */
  --text:            oklch(0.24  0.012 75);   /* primary ink */
  --text-muted:      oklch(0.47  0.012 75);   /* secondary, labels, metadata */
  --text-subtle:     oklch(0.60  0.010 75);   /* placeholder, disabled text */
  --text-on-accent:  oklch(0.99  0.003 75);

  /* Lines */
  --border:          oklch(0.905 0.006 75);   /* default hairline */
  --border-strong:   oklch(0.82  0.008 75);   /* input borders, table rules */

  /* Accent — restrained indigo. Deliberately not corporate-blue, not trust-green. */
  --accent:          oklch(0.47  0.11  275);
  --accent-hover:    oklch(0.41  0.11  275);
  --accent-active:   oklch(0.36  0.10  275);
  --accent-quiet:    oklch(0.962 0.020 275);  /* selected row, active nav, subtle fill */
  --accent-border:   oklch(0.86  0.045 275);

  /* Focus — amber-gold ring, high contrast on every surface (the GOV.UK move) */
  --focus-ring:      oklch(0.80  0.16  85);

  /* Semantic — muted, AA on --surface. Used for credential/org/verification state. */
  --ok-fg:           oklch(0.45  0.11  150);
  --ok-bg:           oklch(0.955 0.030 150);
  --ok-border:       oklch(0.84  0.070 150);

  --warn-fg:         oklch(0.50  0.10  70);
  --warn-bg:         oklch(0.960 0.045 75);
  --warn-border:     oklch(0.83  0.080 75);

  --danger-fg:       oklch(0.50  0.17  25);
  --danger-bg:       oklch(0.960 0.030 25);
  --danger-border:   oklch(0.85  0.090 25);

  --info-fg:         var(--accent);
  --info-bg:         var(--accent-quiet);
  --info-border:     var(--accent-border);
}
```

### Role mapping

| Meaning | Token |
|---|---|
| Credential `ACTIVE`, org `ACTIVE`, verification `VALID` | `--ok-*` |
| Credential `SUSPENDED`, org `PENDING` | `--warn-*` |
| Credential `REVOKED` / `EXPIRED`, verification failed | `--danger-*` |
| Credential `SUPERSEDED`, offboarded | neutral `--text-muted` on `--surface-sunken` |
| Primary action, current selection, active nav item, links | `--accent` |
| Live on-chain verified (distinct from cached) | `--ok-*` with a solid left check glyph, never a bare tick |

Accent appears only on: primary buttons, the current nav item, selected table rows,
links, and focused form controls. Not on headers, not on decoration.

### Dark tokens (drafted, Phase 2, not implemented)

Same roles, swapped: `--bg` oklch(0.20 0.008 75), `--surface` oklch(0.24 0.008 75),
`--text` oklch(0.93 0.01 75), accent lifts to oklch(0.68 0.12 275), semantic
foregrounds lighten to ~0.72 L and backgrounds drop to ~0.28 L. Keep the amber focus
ring. Do not ship until it is fully audited in both languages.

---

## 3. Typography

Bilingual is the constraint. One family that covers Bengali and Latin with matching
proportions, so the two languages sit together without a visible seam.

- **UI family:** `"Anek Bangla", "Anek Latin", "Noto Sans Bengali", system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`
  Anek is a variable family (Ek Type) drawn for Indic scripts with a matching Latin. Load
  weights 400 / 500 / 600 only. Verify Bengali rendering at each weight before locking;
  fall back to `"Noto Sans Bengali"` + system if Anek's Bengali hinting disappoints.
- **Mono family (hashes, addresses, tokens, tx ids):** `ui-monospace, "SF Mono", "Cascadia Mono", Menlo, Consolas, monospace`. No webfont.
- Do not use a display face. Product UI does not need heading/body pairing.

### Scale — fixed rem, ratio ~1.2

| Token | Size / line-height | Use |
|---|---|---|
| `text-xs`  | 12 / 16 | dense table metadata, timestamps, legal |
| `text-sm`  | 13 / 20 | secondary text, helper text, table cells |
| `text-base`| 14 / 22 | body default, form values, most UI |
| `text-md`  | 16 / 24 | emphasised body, card titles |
| `text-lg`  | 20 / 28 | section headings |
| `text-xl`  | 25 / 32 | page title |
| `text-2xl` | 31 / 38 | the single largest thing on a screen, rare |

Weights: 400 body, 500 labels and table headers and buttons, 600 headings and the one
key number on a screen. Hierarchy comes from weight plus size, never from color alone.
Bengali text: add 0.05 to line-height versus the Latin equivalent (taller conjuncts).

Prose (citizen explanatory copy) caps at 68ch. Tables may run full width.

---

## 4. Spacing & layout

4px base. Scale: `4 8 12 16 24 32 48 64 96`. Vary it: 24 between unrelated blocks, 8
inside a group, 12 in form fields. Same padding everywhere is the current problem.

- **App shell:** persistent left rail (role nav, 240px, collapses to icons under 1024px,
  to a top sheet under 768px) + top bar (product mark, current org / role, language
  toggle, account menu). Content max-width 1120px for dashboards, 640px for single forms.
- **Grids:** credential lists use `repeat(auto-fill, minmax(280px, 1fr))`. Do not force a
  fixed 2-column grid.
- **Containers:** one `Panel` primitive. A screen is a `PageHeader` plus one or more
  Panels or a DataTable. Panels never nest inside Panels.
- Left-align content. No centered-stack layouts except the two auth screens.

---

## 5. Elevation & radius

Borders do the work, not shadows. This is a registry, not a stack of floating cards.

- `--radius-control: 6px` (buttons, inputs, pills)
- `--radius-container: 10px` (panels, tables, modals)
- Full round only for avatars and dot indicators.
- One shadow token, for true overlays only (popover, menu, modal, toast):
  `--shadow-overlay: 0 1px 2px oklch(0.24 0.01 75 / 0.08), 0 8px 24px oklch(0.24 0.01 75 / 0.10)`
- Panels and table containers get a 1px `--border`, no shadow.

---

## 6. Motion

150–200ms, `ease-out` (`cubic-bezier(0.2, 0, 0, 1)`). No bounce, no elastic, no
page-load choreography.

- Motion conveys state only: menu open/close, row expand, toast in/out, status change
  flash on a pill after an action succeeds.
- Never animate layout properties. Expanding rows transition `grid-template-rows`.
- Everything non-essential is wrapped in `@media (prefers-reduced-motion: no-preference)`.

---

## 7. Components

One implementation each, in `frontend/src/components/ui/`.

- **Button** — variants: `primary` (accent), `secondary` (border + surface), `ghost`,
  `danger`. Sizes `sm` / `md`. States: default, hover, active, focus-visible, disabled,
  loading (spinner replaces label, width held). One shape everywhere.
- **Field** — wrapper owning `<label>`, optional hint, error slot, and `aria-describedby`
  wiring. Wraps **Input**, **Select**, **Textarea**, **Checkbox**, **RadioGroup**. Every
  control ships default / hover / focus / disabled / error / read-only.
- **StatusPill** — takes a semantic status enum, renders the translated label and the
  role-mapped color from section 2. Never renders a raw enum string.
- **DataTable** — header (weight 500 on `--surface-sunken`), zebra-free rows with
  `--border` rules, hover state, selected state (`--accent-quiet`), sortable headers,
  loading = skeleton rows, empty = `EmptyState`, footer pagination. Horizontal scroll
  contained inside the table, never the page.
- **Panel** — titled container, optional header action slot. The only card.
- **Alert** — inline, variants `info` / `success` / `warning` / `error`, full border +
  tint, icon, no side-stripe. **Toast** uses the same visual language for transient
  confirmations.
- **CopyableValue** — for hashes, tokens, addresses, tx ids. Shows a truncated middle
  (`0x70997970…dc79C8`), copy button, and when it is a tx hash an external link to the
  configured block explorer. Full value in `title` and to screen readers.
- **OnChainBadge** — the "show the work" element. Two forms: `cached` (neutral, "last
  synced 2m ago") and `verified` (`--ok`, "checked on-chain just now" + tx link). These
  must never look the same.
- **EmptyState** — short heading, one sentence in plain bilingual copy, one primary
  action. Used by every list and table.
- **Skeleton** — shape-matched placeholders. Replaces the literal "Loading..." text.
- **PageHeader** — title (`text-xl`), optional description, breadcrumb slot, action slot.
- **AppShell / RoleNav / LanguageToggle** — section 4.
- **VerificationResult** — dedicated composition, not a colored box: the overall verdict,
  then a checklist of what was verified (hash integrity, issuer trusted and active,
  on-chain status, not expired), each line with its own pass/fail and evidence link.

---

## 8. Iconography

One set, one weight. `lucide` (1.5px stroke) or Heroicons outline. 16px in dense UI,
20px in nav and buttons. Icons support labels, they do not replace them. No filled/
duotone/emoji icons in the product surface (the current emoji role labels go).

---

## 9. Voice

Plain, calm, specific. Translated from keys in both languages.

- Labels are nouns (`Credential type`, not `What kind?`). Buttons are verbs
  (`Issue credential`, `Revoke`).
- Errors say what happened and what to do: "This share link expired 3 minutes ago. Ask
  the citizen to generate a new one." Not "Error 410".
- Never show a raw status, enum, UUID, or stack message to a user.
- No em dashes. No exclamation marks outside a genuine success confirmation.
