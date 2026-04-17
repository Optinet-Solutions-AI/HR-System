# Dark Mode — Design Spec

## Context

WFH Sentinel currently runs in light mode only. The project already has most dark mode infrastructure in place (`next-themes` installed, CSS variables defined for `.dark`, Tailwind configured with `darkMode: ["class"]`), but it's never been wired up. This spec covers enabling dark mode with a user-facing toggle.

## Approach

Wire up the existing `next-themes` package. No new dependencies needed.

## Changes

### 1. ThemeProvider wrapper

**New file:** `src/components/theme-provider.tsx`

A thin `"use client"` wrapper around `next-themes`'s `ThemeProvider`:
- `attribute="class"` — matches Tailwind's `darkMode: ["class"]`
- `defaultTheme="system"` — respects OS preference
- `enableSystem={true}`
- `disableTransitionOnChange` — prevents FOUC flicker during theme switch

### 2. Root layout integration

**Modify:** `src/app/layout.tsx`

Wrap `{children}` and `<Toaster />` inside the new `<ThemeProvider>`. Add `suppressHydrationWarning` to the `<html>` tag (required by `next-themes` to avoid React hydration mismatch on the `class` attribute it injects).

### 3. Theme toggle component

**New file:** `src/components/theme-toggle.tsx`

A `"use client"` button that cycles: system → light → dark → system. Uses `useTheme()` from `next-themes` and icons from `lucide-react`:
- `Monitor` icon for system mode
- `Sun` icon for light mode
- `Moon` icon for dark mode

Styled as a ghost icon button matching the existing sidebar aesthetic.

### 4. Sidebar integration

**Modify:** `src/components/sidebar.tsx`

In the bottom `border-t` section, place the `ThemeToggle` next to the `UserProfileDropdown`. Use flexbox: profile on the left (flex-1), toggle on the right.

**Modify:** `src/components/sidebar.tsx` (`SidebarContent` export)

Same change for the mobile sidebar content.

### 5. Fix hardcoded light-only colors

**Modify:** `src/app/page.tsx` (Access Pending page)
- `bg-gray-50` → `bg-gray-50 dark:bg-gray-950`
- `bg-white` → `bg-white dark:bg-gray-900`
- `border-gray-200` → `border-gray-200 dark:border-gray-800`
- `text-gray-900` → `text-gray-900 dark:text-gray-100`
- `text-gray-500` → `text-gray-500 dark:text-gray-400`
- `text-gray-700` → `text-gray-700 dark:text-gray-300`
- `text-gray-400` → `text-gray-400 dark:text-gray-500`
- `hover:text-gray-600` → `hover:text-gray-600 dark:hover:text-gray-300`

**Modify:** `src/components/employees/employees-table.tsx`
- Active badge: `bg-green-100 text-green-800` → add `dark:bg-green-900/30 dark:text-green-300`
- Inactive badge: `bg-gray-100 text-gray-500` → add `dark:bg-gray-800 dark:text-gray-400`

**Modify:** `src/components/reports/wfh-utilization-tab.tsx`
- Progress bar track: `bg-gray-100` → `bg-gray-100 dark:bg-gray-800`

### 6. STATUS_COLORS dark mode variants

**Modify:** `src/lib/constants.ts`

Add `dark:` Tailwind classes to each status color entry:

| Status         | Light bg          | Dark bg                   | Light text        | Dark text             | Light border       | Dark border              |
|----------------|-------------------|---------------------------|-------------------|-----------------------|--------------------|--------------------------|
| office         | `bg-green-100`    | `dark:bg-green-900/30`    | `text-green-800`  | `dark:text-green-300` | `border-green-200` | `dark:border-green-800`  |
| wfh            | `bg-blue-100`     | `dark:bg-blue-900/30`     | `text-blue-800`   | `dark:text-blue-300`  | `border-blue-200`  | `dark:border-blue-800`   |
| vacation       | `bg-yellow-100`   | `dark:bg-yellow-900/30`   | `text-yellow-800` | `dark:text-yellow-300`| `border-yellow-200`| `dark:border-yellow-800` |
| sick_leave     | `bg-orange-100`   | `dark:bg-orange-900/30`   | `text-orange-800` | `dark:text-orange-300`| `border-orange-200`| `dark:border-orange-800` |
| public_holiday | `bg-gray-100`     | `dark:bg-gray-800`        | `text-gray-800`   | `dark:text-gray-300`  | `border-gray-200`  | `dark:border-gray-700`   |
| violation      | `bg-red-100`      | `dark:bg-red-900/30`      | `text-red-800`    | `dark:text-red-300`   | `border-red-200`   | `dark:border-red-800`    |
| unknown        | `bg-gray-50`      | `dark:bg-gray-800/50`     | `text-gray-400`   | `dark:text-gray-500`  | `border-gray-100`  | `dark:border-gray-700`   |
| not_scheduled  | `bg-gray-50`      | `dark:bg-gray-800/50`     | `text-gray-400`   | `dark:text-gray-500`  | `border-gray-100`  | `dark:border-gray-700`   |

Each entry combines both: e.g., `bg: 'bg-green-100 dark:bg-green-900/30'`. The `dot` colors stay unchanged (solid mid-tone colors work in both themes).

### 7. No changes needed

These already work via CSS variables and will respond to the `.dark` class automatically:
- All shadcn/ui components (`button`, `card`, `dialog`, `table`, `tabs`, `badge`, `input`, `label`, `select`, `sheet`, `dropdown-menu`, `calendar`)
- Sonner toast (already uses `useTheme`)
- `globals.css` (already has complete `.dark` variable set)
- Nav links, sidebar borders, backgrounds (use `bg-background`, `border-border`, etc.)

## Files Summary

| File | Action |
|------|--------|
| `src/components/theme-provider.tsx` | **Create** — `"use client"` ThemeProvider wrapper |
| `src/components/theme-toggle.tsx` | **Create** — theme cycle button |
| `src/app/layout.tsx` | **Modify** — wrap with ThemeProvider, add suppressHydrationWarning |
| `src/components/sidebar.tsx` | **Modify** — add ThemeToggle to sidebar footer |
| `src/app/page.tsx` | **Modify** — add dark: variants to hardcoded colors |
| `src/components/employees/employees-table.tsx` | **Modify** — add dark: variants to badge colors |
| `src/components/reports/wfh-utilization-tab.tsx` | **Modify** — add dark: variant to progress bar |
| `src/lib/constants.ts` | **Modify** — add dark: variants to STATUS_COLORS |

## Verification

1. Run `npm run dev` and open the app
2. Click the theme toggle in the sidebar — should cycle through system/light/dark
3. Verify all pages render correctly in dark mode:
   - Login page
   - Access Pending page
   - Admin dashboard (status cards, employee table)
   - Calendar view
   - Compliance page (flag badges)
   - Reports page (utilization bars)
   - Employee management (active/inactive badges)
   - Rules page
4. Verify status color badges are legible in dark mode
5. Verify toast notifications theme correctly
6. Verify mobile sidebar shows the toggle
7. Refresh the page — theme preference should persist
8. Set OS to dark mode, use "system" theme — should auto-switch
9. Run `npm run typecheck` — no type errors
10. Run `npm run lint` — no lint errors
