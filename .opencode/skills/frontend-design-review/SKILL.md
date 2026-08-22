---
name: frontend-design-review
description: Comprehensive UI/UX, responsive layout, visual hierarchy, accessibility, and CSS audit standards. Trigger this skill whenever checking a page or component for design flaws, responsive viewport issues, spacing inconsistencies, accessibility gaps, or "AI template slop."
license: MIT
compatibility: opencode
---

# Role & Design Philosophy
Act as a **Senior UI/UX Engineer & Design System Lead**. Your goal is to ensure user interfaces feel visually polished, sharp, responsive, accessible, and cohesive across all viewports.

---

## 1. Multi-Device & Responsive Layout Criteria
When testing live URLs (via Playwright/Browser tools) or reviewing layout markup:

* **Viewport Boundaries:**
  * Desktop: `1440x900`
  * Tablet: `768x1024`
  * Mobile: `375x812`
* **Zero Horizontal Overflow:** Mobile views must never exhibit horizontal scrollbars (`overflow-x`). Ensure long strings or flex containers use `min-w-0`, `truncate`, or `break-words`.
* **Fold & Target Primacy:** Primary CTAs, key inputs, and essential navigation must remain visible above or near the fold without requiring excessive scrolling.
* **Touch Targets:** Interactive elements on mobile viewports must meet a minimum target area of at least **44x44px**.

---

## 2. Visual Hierarchy, Spacing & Layout
* **Spatial Grid:** Enforce an **8px / 4px spatial system** (e.g., Tailwind `p-1`, `p-2`, `p-4`, `p-6`, `p-8`). Flag arbitrary spacing like `margin: 13px` or mismatched padding across adjacent card components.
* **Typography Scale:** Check line-heights (1.4–1.6x for body text) and ensure clear, proportional heading scales (`h1` > `h2` > `h3`).
* **Layout Shift (CLS):** Ensure image and video components enforce explicit aspect ratios or `object-fit: cover` to avoid page layout shifts during loading.

---

## 3. Anti-"AI Slop" & Visual Polish Rules
Flag and clean up generic, low-quality AI design patterns:

* **Overuse of Generic Radii:** Replace universal `rounded-3xl` or exaggerated border radii with intentional elevation scaling (e.g., `rounded-lg` for cards, `rounded-md` for inputs).
* **Flat Low-Contrast Shadows:** Replace heavy, unstyled drop-shadows with subtle, multi-layered elevation tokens or crisp borders.
* **Unreadable Low-Contrast Text:** Flag light gray text on light backgrounds (e.g., `text-gray-400` on white). Maintain a minimum **4.5:1 WCAG AA contrast ratio** for body text.
* **Component Uniformity:** Ensure button heights, icon padding, and border weights remain identical across primary and secondary UI variants.

---

## 4. Accessibility (a11y) & Micro-Interactions
* **Focus States:** Every interactive element (`<button>`, `<a>`, `<input>`) must have an explicit, visible focus ring (`focus-visible:ring-2`). Never set `outline: none` without a custom focus indicator.
* **Screen Reader Labels:** Icon-only buttons must include `aria-label` or visually hidden text (`sr-only`).
* **State Feedback:** Ensure interactive components support distinct **hover**, **focus**, **active**, and **disabled** states.

---

## Audit Workflow Checklist

When executing a design review:

1. **Live Browser Inspection (if URL provided):** Check the application across Desktop, Tablet, and Mobile viewports using Playwright or browser MCP tools. Capture console errors and layout shifts.
2. **Static Code Review (if reviewing components/files):** Scan source files for hardcoded hex colors, arbitrary inline styles, missing responsive utility classes, and a11y gaps.
3. **Actionable Remediation:** Group findings by **Severity (High / Medium / Low)** and provide exact CSS / Tailwind / JS refactor snippets for every defect identified.
