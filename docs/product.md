# Product

## Register

product

## Users

Four roles. Everyone is mid-task, most at a desk, one on a phone.

- **Citizens** — Bangladeshi residents who hold credentials (national identity, academic degree, driving licence). Mixed digital literacy, often on a mid-range Android phone in daylight, may read Bangla more comfortably than English. Job to be done: see what credentials they hold, share one specific credential with a verifier, review who accessed what and when.
- **Issuer staff** — officers at the Identity, Education, or Transport authority. Repetitive desk work: issue a credential to a citizen accurately, and occasionally suspend, reactivate, or revoke one. Their actions are on the permanent record, so the interface must make the current state and the consequences of an action unambiguous.
- **Verifier staff** — HR managers, bank onboarding officers. Job to be done: given a citizen's share token or QR, get a clear valid / not-valid answer, understand what was actually checked, and leave a record that the check happened.
- **Oversight / auditors** — the governance body. Read-mostly. Job to be done: review member organizations, approve or suspend them, and read an immutable audit trail they can trust.

Context: BCOLBD 2026 competition prototype now; a focused academic-credential pilot with real institutions and real citizens next. Bangladesh government and regulated-institution setting throughout.

## Product Purpose

A shared trust layer that lets independent authorities issue citizen credentials and lets anyone verify authenticity and revocation status in seconds, without a central database that owns every citizen's complete record. Personal data and full payloads stay off-chain; only hashes, status, consent events, and governance events go on-chain.

Success looks like: a verifier gets a correct answer in seconds without contacting the issuer, a citizen controls exactly what is disclosed, an issuer can revoke in real time, and every step leaves an auditable trail that no single party can rewrite.

## Brand Personality

Trustworthy, clear, and human. CiviLedger is public infrastructure that ordinary people are meant to use, so it should feel approachable, not bureaucratic. Three words: **trustworthy, legible, warm**.

Two surfaces, one voice:

- **The marketing site** (`/` and anything explaining the system to a newcomer) is a real product website. It uses real photography of people and civic settings, confident color, generous layout, and plain language to make a first-time citizen or a procurement officer understand what this is and why it matters.
- **The app** (dashboards, wallet, verifier, oversight) stays calm and focused so someone can finish their task without friction. It is friendly, not cold: a coherent icon set, warm microcopy, avatars for people, helpful empty states. It just does not carry marketing imagery or decoration.

Confidence comes from clarity and from showing the work (real transactions, plain-language results), never from coldness and never from spectacle. When the system states a blockchain fact, it states it plainly and completely rather than reducing it to a single green tick.

## Anti-references

- **Neon-on-black crypto and web3 dashboards.** No glow, no gradient text, no glassmorphism, no floating blurred orbs, no treating "on-chain" as spectacle.
- **Marketing chrome inside the app.** No hero sections, hero-metric templates, or explanatory landing-page blocks inside a dashboard. The app is a tool; the website is the website.
- **The current prototype look:** ad-hoc Tailwind utilities with no token layer, a single flat type size, one white rounded card for every kind of content, raw enum strings (`ISSUER_NOT_TRUSTED`, `MEMBER_PROPOSED`) shown to users, truncated UUIDs as the primary identifier of a table row, demo account passwords and wallet addresses printed in the shipped UI.
- **Consumer-fintech playfulness:** confetti, mascots, jokey microcopy, celebration animations. Warm and serious, not cute. This is civic infrastructure.
- **Flag-literal palette.** Do not build the identity from Bangladesh green and red. Cultural reading comes from photography, language, and content, not a national-colours theme.
- **Stock-photo tokenism.** Generic handshake-in-front-of-glass-building images, or a wall of identical smiling headshots. Pick specific, real, Bangladeshi civic and campus scenes; one decisive image per section beats a collage.
- **Bloomberg-terminal density for its own sake.** Dense is welcome; hostile and unscannable is not.

## Design Principles

1. **Correctness is the aesthetic.** The interface's first job is to never misrepresent on-chain truth. A cached status and a freshly verified status must be visually distinct. "Valid" is a specific, earned claim, never a decorative badge.
2. **Legible over dense, dense over sparse.** Tables and forms in this product carry a lot and that is fine, but they stay scannable. Whitespace is used to group related things, not to pad everything equally.
3. **Plain bilingual language.** Every user-facing string is Bangla and English, plain-worded, and rendered from a translation key rather than a raw database value. Copy is written for a nervous citizen, not for an engineer.
4. **Show the work.** When the system makes a trust claim, it shows what was checked and links to the real transactions. No black-box result screens.
5. **One vocabulary everywhere.** One button component, one field component, one status pill, one table, one empty state, one alert, one icon set, used identically across all four role views. If two screens solve the same problem differently, one of them is wrong.
6. **Accessible by construction.** Keyboard completeness, visible focus, AA contrast in both languages, honoured reduced-motion, and correctly associated form labels and errors are defaults built in from the first component, not a pass at the end.
7. **Human by default.** A consistent icon set, real photography on the marketing site, avatars for people, and plain bilingual language lower the barrier to a public service. Warmth is not decoration here; it is what makes a nervous first-time citizen willing to continue.

## Accessibility & Inclusion

Target WCAG 2.1 AA. Full Bangla/English bilingual UI from day one: localized strings, dates, and numbers, and a font stack that renders Bengali script properly at every weight used. All flows keyboard-complete with a visible focus indicator that meets AA contrast on every surface. `prefers-reduced-motion` honoured for all non-essential motion. Forms use real `<label>` association and programmatically linked error text. Assume the citizen role is often on a mid-range Android device and a slower network, so the citizen surfaces stay light and degrade gracefully.
