---
name: Elvora Logistics OS
description: Permission-aware logistics workspaces with complete task access.
colors:
  emerald: "#007b52"
  fold: "#025e3d"
  signal: "#c32135"
  graphite: "#161d1a"
  workspace-ground: "#e8ece9"
  bg: "#f5f6f5"
  card: "#ffffff"
  ink: "#161d1a"
  body: "#3f4f47"
  muted: "#53655b"
  line: "#e4e9e6"
  line-strong: "#bac8bf"
  soft: "#f1f4f2"
  hover: "#edf5f0"
  focus: "#1fa06b"
  dark-navigation: "#75d8a9"
  ocean: "#15526b"
  teal: "#0f7f8c"
  aviation: "#344d77"
  copper: "#8c4329"
  violet: "#493d72"
  mint: "#dcf1e6"
  sky: "#dfecfa"
  sand: "#f7ead8"
  lilac: "#e8e3f7"
  blush: "#fbe1e4"
  gold: "#f6e9c3"
typography:
  headline:
    fontFamily: "Plus Jakarta Sans, Instrument Sans, system-ui, sans-serif"
    fontSize: "clamp(24px, 2.3vw, 32px)"
    fontWeight: 750
    lineHeight: 1.3
    letterSpacing: "-.03em"
  title:
    fontFamily: "Plus Jakarta Sans, Instrument Sans, system-ui, sans-serif"
    fontSize: "24px"
    lineHeight: 1.2
    letterSpacing: "-.025em"
  body:
    fontFamily: "Instrument Sans, system-ui, Arial, sans-serif"
    fontSize: "15px"
    lineHeight: 1.5
  label:
    fontFamily: "Instrument Sans, system-ui, Arial, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    letterSpacing: ".01em"
rounded:
  control: "10px"
  search: "12px"
  card: "16px"
  record: "20px"
  frame: "24px"
  badge: "99px"
spacing:
  compact: "12px"
  feature-gap: "16px"
  workspace-gap: "20px"
  card-padding: "24px"
components:
  button-primary:
    backgroundColor: "{colors.emerald}"
    textColor: "{colors.card}"
    rounded: "{rounded.control}"
    padding: "7px 14px"
  button-outline:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "7px 14px"
  button-ghost:
    textColor: "{colors.body}"
    rounded: "{rounded.control}"
    padding: "7px 14px"
  workspace-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "24px"
  feature-card:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.card}"
    padding: "22px"
  input:
    backgroundColor: "{colors.card}"
    textColor: "{colors.ink}"
    rounded: "{rounded.control}"
    padding: "6px 10px"
---

# Design System: Elvora Logistics OS

## Overview

Elvora uses a light framed workspace with emerald accents, generous card spacing and dense, readable operating surfaces. The approved navigation moves from workspace cards to feature cards to the existing task screens. Preserve all record types, routes, permission checks, workflow actions, labels, document content and brand assets.

The invoice-dashboard reference informs composition only. It does not replace Elvora's identity or supply business data. Keep existing module colours and real account records; do not invent metrics, decorative charts, stock imagery or payment credentials.

**Key Characteristics:**
- Permission-filtered workspace and feature discovery.
- Quiet neutral surfaces with Elvora emerald for navigation and actions.
- Self-hosted brand typography and the existing curved E mark.
- Wrapping content and contained table scrolling on narrow screens.

## Colors

The frontmatter records the effective light-theme palette from `src/web/index.css`, including later overrides. Emerald is the primary action accent; deep green supports emphasis and signal red communicates errors and destructive actions. Graphite supports dark backing and detailed operating surfaces. Ocean, teal, aviation, copper and violet retain their existing module roles; mint, sky, sand, lilac, blush and gold support status treatments.

Neutral ground separates the outer frame from the content background, white cards and subdued borders. Ink, body and muted colours establish reading hierarchy. Dark navigation links and icons use the dedicated dark-navigation tint. Dark mode retains the CSS custom-property overrides; do not replace semantic variables with fixed light colours in new components.

## Typography

The body uses self-hosted Instrument Sans; headings use self-hosted Plus Jakarta Sans with Instrument Sans fallback. RTL mode retains Noto Sans Arabic. Numeric data uses tabular figures. Preserve the supplied font files and the existing weights.

Page headings use the frontmatter headline role; workspace titles use the title role, reducing to (23px) below (640px). Body copy uses the body role and field labels use the label role. Feature labels are bold, with muted group context beneath search results. Long names and values wrap instead of truncating task content.

## Layout

The desktop frame has (14px) outside space and fills the remaining viewport height. The light header holds the brand link, notifications, search and account access. The main pane scrolls vertically; the status footer remains a separate flex item. At widths below (768px), the frame becomes edge-to-edge and the header uses a (62px) height. Main mobile padding is (20px 14px 28px).

The root route `/` presents metadata-derived workspace cards in business-flow order. `/workspace/:workspace` presents every permitted feature in the selected group. `/dashboard` remains separate and directly accessible. `/workspace-tools` contains profile, help, search, freight tools, blog, website, language and sign-out cards. No sidebar or duplicate module strip is rendered by the shell. Breadcrumbs lead back to Workspaces and the current metadata group.

Workspace pages have a maximum width of (1440px). Cards and feature grids use three columns, two below (1024px), and one below (640px). The carousel shows three desktop cards, two at medium widths and an (88%) slide on small screens. Workspace gaps are (20px); feature gaps are (16px), reducing to (12px) on mobile. Card heights are minimums, allowing content to grow.

Dashboard metrics retain all items; the first four receive emphasis. Metrics use two columns on mobile and one below (360px). Tables scroll inside their work surfaces; numeric cells retain unbroken figures. Forms use one column, two from (768px), and three from (1280px). Modal field content scrolls independently of its action footer. Job routes wrap, then stack origin, direction indicator and destination below (640px).

## Elevation & Depth

Use tonal layering and modest diffuse shadows rather than heavy borders. General cards and panels are flat; workspace and feature cards carry restrained lift. The frame uses its own ambient shadow, while detailed record workspaces retain dark backing. Shadow values and motion extensions are recorded in the sidecar.

State transitions use the existing fast motion and easing. Reduced-motion CSS shortens transitions and animations, removes account-card tilt and disables printer-paper motion. PDF printer motion follows real loading states without artificial delays.

## Shapes

Use the frontmatter control, card, record and frame radii according to their roles. Status badges remain capsules. Maintain clipping on the outer frame and carousel viewport, with scrolling inside data surfaces. Do not use fixed card heights to clip labels or values.

## Components

### Buttons and inputs

Primary buttons use emerald and white text; outlined buttons use card, ink and strong border colours; ghost buttons use transparent backgrounds and body text. Buttons wrap labels and grow vertically. Mobile buttons use at least (44px) height. Hover uses the existing brightness or surface treatment; active buttons shift down (1px). Disabled controls retain their existing opacity and interaction restrictions.

Inputs, selects and textareas use card surfaces and strong borders. Focus changes the border to emerald with a translucent ring; invalid fields use signal red. Read-only and disabled fields use soft surfaces and muted text. Keep visible labels and required-field markers.

### Workspace cards and carousel

Each workspace card is one link with a group icon, label, up to three feature previews, a total feature count and an Open workspace cue. Previews are summaries; the destination grid exposes the complete permitted list. The carousel uses Embla with start alignment and trimmed snaps, explicit previous/next controls, a live position indicator and viewport arrow-key browsing. RTL reverses browsing direction; carousel arrow transforms override the inherited RTL icon flip. There is no autoplay. View all workspaces switches to a full grid.

Reference: https://21st.dev/@larsen66/components/carousel/carousel-with-spacing (Embla/shadcn spacing pattern).

### Feature cards and search

Feature cards use an icon, a wrapping strong label and a directional arrow. Links preserve metadata destinations, including query strings. Root search matches workspace and feature labels and offers direct feature links; group search filters its feature cards. Empty states expose Clear search or a return to permitted workspaces. Quote-to-cash shortcuts render only where their routes are present in permitted metadata.

### Header, breadcrumbs and utilities

Keep notifications, command search (Ctrl/Cmd+K), the existing Ctrl K shortcut hint and account access in the header. Narrow screens hide toolbar text while preserving named icon controls. Notifications use a viewport-constrained popover. Breadcrumbs wrap. Utility cards preserve the existing account, help, language and external-site actions, including Elvora Logistics OS v1.0 copy.

### Task surfaces and forms

Preserve the existing job tabs, collaboration rail, record fields, tables, dialogs and permission-controlled workflow actions. Entity-form actions occupy a dedicated footer outside the scrolling field area. The status footer wraps long user values. These containment rules support the card navigation without replacing task content.

### Brand and print

The verified curved E is `public/brand/icon-primary.png`. The older `icon-primary.svg` is a different mark and must not be used for the favicon. Favicon exports derive directly from the PNG without redrawing the logo. Print output excludes shell navigation, carousel, breadcrumbs and loading animations; preserve existing document content and A4 geometry.

## Do's and Don'ts

### Do:
- **Do** derive workspace and feature access from permission-filtered navigation metadata.
- **Do** preserve Elvora fonts, module colours, logo assets and existing task routes.
- **Do** wrap long labels and contain table scrolling within operating surfaces.
- **Do** keep task actions visible outside scrolling modal field content.

### Don't:
- **Don't** reintroduce the sidebar or crowded duplicate module strip into the approved shell.
- **Don't** hide permitted features behind the three-item workspace preview.
- **Don't** replace business content with fictional metrics, decorative charts or stock imagery.
- **Don't** redraw the verified curved E or substitute the older SVG favicon.
