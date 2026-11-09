# DESIGN.md: Repositorio de Proyectos de Aula, Fisioterapia USC

Locked design system for the site (Hallmark direction: custom, brief palette fixed). UI copy is neutral professional Spanish. Code, comments and file names are English.

## Subject, audience, job

- Subject: a repository of illustrative A3 course posters from the Physiotherapy program (10 categories, 31 posters).
- Audience: students presenting their work, teachers and visitors on a projector or a phone.
- Job: find a poster by category or by search, read the full PDF without leaving the page, download it.

## Color tokens (declared in `src/styles/tokens.css`, never as literals in components)

| Token | Hex | Use | Contrast |
| --- | --- | --- | --- |
| `--color-navy` | #002B49 | Primary: hero, footer, viewer header, primary buttons | white on navy 14.6:1 |
| `--color-health` | #0077B6 | Secondary: focus ring on light, chart bars, icons | 4.87:1 on white |
| `--color-gold` | #D4AF37 | Accent: hairlines, icons, fills, text only on navy | 6.9:1 on navy, 2.1:1 on white (never text on white) |
| `--color-gold-ink` | #8A6D12 | Gold-tinted text on light backgrounds (reserved) | 4.91:1 on white |
| `--color-paper` | #F8FAFC | Page background | ink 16.1:1 |
| `--color-surface` | #FFFFFF | Cards, header, dialogs, hairline border, no shadow | |
| `--color-ink` | #0F1E2E | Body text | |
| `--color-muted` | #4A5D70 | Secondary text | 6.5:1 on paper |
| `--color-field-edge` | #6F8296 | Input borders | 3.8:1 on paper |
| `--color-rule` | #D5DEE8 | Hairlines | decorative |
| `--color-logo-bg` | #182039 | Tile behind the logo file (its baked-in background) | |

Gold on white is decorative only. Focus ring: 2px `--color-health` on light, `--color-gold` on navy, appears instantly.

## Type roles

- Display: Montserrat 700 (h1) and 600 (h2, h3, brand, UI headings), geometric sans like the institutional site. Letter-spacing -0.015em, line-height 1.1 to 1.3.
- Body: Source Sans 3 400 and 600, 16px, line-height 1.6, measure at most 65ch.
- Scale: 13, 14, 16, 17, 20, 25, 31 px plus fluid `--text-hero`, `--text-section`, `--text-lead`.
- Labels, tabs and buttons use the body face, sentence case, untracked.

## Layout

Mobile (375):

```
+-----------------------------+
| [logo] Repositorio de...  ≡ |  sticky white header, 64px
+-----------------------------+
| NAVY HERO                   |
| ── (gold bar)               |
| Muestra Académica de        |
| Proyectos de Aula           |
| Programa de Fisioterapia    |
| One sentence                |
| [Explorar Categorías v]     |
+-----------------------------+
| Pósteres por categoría      |
| (chip)(chip)(chip) ->scroll |
| Category name + description |
| +-------------------------+ |
| |   A3 miniature (well)   | |
| | Title / students / docente |
| | [Ver PDF completo]      | |
| | [Descargar PDF]         | |
| +-------------------------+ |
| NAVY FOOTER                 |
+-----------------------------+
```

Desktop (1280):

```
+--------------------------------------------------------------+
| [logo] Repositorio de Proyectos...   [Categorías v] [Search] |
+--------------------------------------------------------------+
| NAVY HERO                                                    |
| ── Muestra Académica                         +-------------+ |
| de Proyectos de Aula                         | logo tile   | |
| Programa de Fisioterapia                     | (gold ring) | |
| One sentence  [Explorar Categorías v]        +-------------+ |
+--------------------------------------------------------------+
| Pósteres por categoría                                       |
| +-------------+  Category name (h2)                          |
| | sticky      |  description, count                          |
| | vertical    |  +-----------+ +-----------+ (3 cols >= 960) |
| | tab index   |  | poster    | | poster    |                 |
| | (10 tabs)   |  +-----------+ +-----------+                 |
| +-------------+                                              |
+--------------------------------------------------------------+
| NAVY FOOTER: brand | categories | project folders            |
+--------------------------------------------------------------+
```

Alignment: everything left-aligned; the hero is one text column beside the logo tile. Search mode replaces the tab index with grouped results.

## Principles

1. One shelf, one containment layer: white cards with a hairline border on the pale paper, no shadows, no card in a card. The A3 miniature sits in a tinted region of the card, not in a bordered box.
2. Navy and gold are used the way the institution uses them: navy bands carry the page, gold is a hairline, a bar and an icon color, never text on white.
3. The poster is the content: miniatures keep the real A3 ratio (1:1.414) so nothing shifts, and the viewer opens the real PDF in a native dialog.
4. Motion answers actions: one orchestrated hero entrance (fade and 8px rise), dialog scale .96 to 1 in 420ms (exit 220ms), reduced motion falls back to a short crossfade. Only transform and opacity.
5. Keyboard and touch first: 44px targets, instant focus ring, tabs with arrow keys, Esc and backdrop close the viewer and focus returns to the trigger.

## Assistant

Floating virtual assistant (in-browser RAG, see README). It adds two floating layers and no new tokens.

- Launcher: navy pill, bottom right, gold `Sparkles` icon and the label "Asistente" (icon only below 40rem), 48px high, `--z-sticky`, below the header and the modal viewer. Focus ring `--color-focus-on-dark`.
- Panel: non-modal (so the modal PDF viewer opens above it), white surface with hairline border and `--shadow-pop`, the only shadow in the system, as for any floating layer. Desktop 26rem by up to 40rem; below 40rem a full-screen sheet (`100dvh`, page scroll locked, safe-area padding). Navy header with the gold icon, paper message area, white status and composer bands.
- Messages: user bubbles navy, assistant bubbles white with hairline; sources are paper cards with `.hl` marked matches; citations `[n]` are text links in `--color-health` that focus their source. Gold is never text.
- Motion: one enter animation (translateY 12px and opacity, 220ms, `.keep-motion`), crossfade under reduced motion. Streaming tokens never animate.
- Keyboard and a11y: Enter sends, Shift+Enter breaks the line, Esc closes (focus returns to the launcher), composer focused on open, a polite live region announces only finished replies, all targets 44px.
- States: checking, unsupported (explains why search mode is active), consent (one-time download size), downloading (progress bar with percent), ready, error with retry.

## Deviations from tool output

- `design-system/fisioterapia-usc/MASTER.md` (ui-ux-pro-max) suggests sky blue and Crimson Pro. The brief fixes navy, health blue and gold with Montserrat and Source Sans 3, so the brief wins; the tool's contrast, focus and touch-target rules were applied.
- Hallmark gate 58 prefers about 80 words per screen; cards carry title, people, summary and two actions because the brief requires them.

## Access page

`/acceso` is a single navy page with one white card (hairline border, no shadow): brand band in `--color-navy-2` with the logo tile and a gold rule, then a two-step form (details, then the 6-digit code). Labels are always visible, errors sit under their field (`aria-describedby`, `aria-invalid`) in `--color-error`, and a polite live region announces progress. The signed-in user's first name and "Salir" live in the header tools and at the bottom of the mobile drawer.
