# Frontend Best Practices — Ant Design v6 + Tailwind

> Stack: Next.js 16 · React Query · Ant Design v6 · Tailwind CSS

This file is a **delta** over [`BEST-PRACTICES.md`](./BEST-PRACTICES.md). It overrides only the UI layer — component library, forms, tables, styling, and the error-display mechanism. Everything else follows the base unchanged:

> **Inherited verbatim from `BEST-PRACTICES.md`** (do not re-document here): Next.js Guidelines · App Router Special Files · Axios Instance · React Query Guidelines · Generated API Types · Component Standards · State Management · TypeScript Standards · Performance · Accessibility · Security Headers · Error Handling (boundaries) · Observability · Testing · Authentication · Analytics · Bot Protection · Notifications.

---

## Table of Contents

1. [Project Structure](#project-structure)
2. [Ant Design + Tailwind Guidelines](#ant-design--tailwind-guidelines)
3. [Error Display](#error-display)

---

## Project Structure

Identical to the [base structure](./BEST-PRACTICES.md#project-structure), with one addition: `lib/antdTheme.ts` holds the AntD `ThemeConfig` and is the single source of truth for design tokens.

```
lib/
├── api/                    # Axios instance + per-domain functions (same as base)
├── antdTheme.ts            # AntD ThemeConfig — single source of truth for tokens
└── utils.ts                # cn() and pure utilities
```

---

## Ant Design + Tailwind Guidelines

> Ant Design v6 supports **React 19** (shipped with Next.js 16). Upgrade `@ant-design/icons` to **v6** alongside `antd` — they are versioned together.

### Setup

Wrap the app in `<ConfigProvider>` at the root layout. Define the theme token once:

```tsx
// app/layout.tsx
import { ConfigProvider } from "antd";
import { theme } from "@/lib/antdTheme";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html>
      <body>
        <ConfigProvider theme={theme}>{children}</ConfigProvider>
      </body>
    </html>
  );
}
```

```ts
// lib/antdTheme.ts
import type { ThemeConfig } from "antd";

export const theme: ThemeConfig = {
  token: {
    colorPrimary: "#1677ff",
    borderRadius: 6,
  },
};
```

CSS variables are enabled by default in v6 — do not disable them.

**Tailwind alongside AntD:**

```css
/* app/globals.css */
@import "tailwindcss";

/* Sync Tailwind design tokens with AntD theme */
@theme {
  --color-primary: #1677ff;
  --radius-md: 6px;
}
```

### When to Use AntD vs Tailwind

| Use AntD for | Use Tailwind for |
|---|---|
| Forms, Tables, DatePicker, Select, Modal, Drawer | Page layout, spacing, flexbox/grid |
| Notification, Message, Popconfirm | Custom components with no AntD equivalent |
| Design tokens via ConfigProvider | Responsive utilities (`sm:`, `md:`, `lg:`) |

Do not reimplement what AntD already provides well. Do not use AntD layout components (`Row`/`Col`) — use Tailwind flex/grid instead.

### Forms

Use `Form` + `Form.Item` for all forms — this **replaces** the base's React Hook Form + Zod + shadcn `Form` guidance. Never control form state manually with `useState`:

```tsx
<Form form={form} onFinish={handleSubmit} layout="vertical">
  <Form.Item name="email" label="Email" rules={[{ required: true, type: "email" }]}>
    <Input />
  </Form.Item>
  <div className="flex justify-end gap-2">
    <Button onClick={() => form.resetFields()}>Cancel</Button>
    <Button type="primary" htmlType="submit">Submit</Button>
  </div>
</Form>
```

Use Tailwind for layout inside forms (`flex`, `gap`, `grid`) — not AntD `Space` or `Row/Col`.

> This replaces only *form-field* validation. **Zod is still used at API/trust boundaries** — Server Action input parsing and validating external/API responses (base [TypeScript rule](./BEST-PRACTICES.md#typescript-standards)) — since AntD `rules` only run in the browser and don't validate untrusted server-side input.

### Tables

Use `Table` with `columns` typed as `ColumnsType<T>` — this **replaces** the base's TanStack Table guidance. Always define a `rowKey`:

```tsx
import type { ColumnsType } from "antd/es/table";

const columns: ColumnsType<User> = [
  { key: "name", title: "Name", dataIndex: "name" },
  { key: "email", title: "Email", dataIndex: "email" },
];

<Table columns={columns} dataSource={users} rowKey="id" />
```

- Use `placement` prop on columns (not `position` — renamed in v6).

### Component Structure

Follows the base [Component Standards](./BEST-PRACTICES.md#component-standards) (named exports, props typed, under 150 lines) — only the imports differ: pull primitives from `antd`, and use `<Skeleton active />` for loading states.

```tsx
import { Button, Skeleton } from "antd";
// ...
if (isPending) return <Skeleton active />;
```

### Component Usage Rules (v6 API changes)

- Use `Space.Compact` instead of the removed `Button.Group` and `Input.Group`.
- Use `FloatButton.BackTop` instead of the removed `BackTop` component.
- In `notification.open()`, use `title` (not `message`) and `actions` (not `btn`) — both renamed in v6.
- `Tag` no longer has a default trailing margin in v6 — add spacing explicitly.
- Use `styles.header` / `styles.body` on Card, Modal, Drawer — `headStyle` / `bodyStyle` were removed in v6.
- Use `popupRender` on Select, Cascader, DatePicker — `dropdownRender` was removed in v6.
- Use `onOpenChange` on Select, Cascader, AutoComplete, DatePicker — `onDropdownVisibleChange` was removed in v6.
- Modal and Drawer show a mask blur by default. Disable via `ConfigProvider` if needed:

```tsx
<ConfigProvider modal={{ styles: { mask: { backdropFilter: "none" } } }}>
```

### Styling Rules

- Use AntD design tokens (`token.colorPrimary`, `token.borderRadius`) inside AntD components via `ConfigProvider`. Do not hardcode values.
- Use Tailwind utilities for layout, spacing, and custom components outside AntD.
- Do not override AntD internal class names (`.ant-btn`, etc.). Use `className` with Tailwind or override tokens via `ConfigProvider`.

### CSS Specificity

AntD v6 uses CSS variables. Tailwind utilities and AntD styles generally do not conflict. If they do:

- Use `ConfigProvider` to override AntD tokens — do not fight specificity with Tailwind's `!important` modifier (`!text-red-500`).
- Wrap AntD-heavy sections in a scoped className and apply token overrides there.

---

## Error Display

Route-segment error boundaries (`error.tsx`, `global-error.tsx`, `not-found.tsx`) and the Server-Action "return, don't throw" rule are **unchanged** — see the base [App Router Special Files](./BEST-PRACTICES.md#app-router-special-files) and [Error Handling](./BEST-PRACTICES.md#error-handling). Only the in-app display widgets differ: use AntD instead of Sonner/`FormMessage`.

- Surface mutation/async errors with `notification.error()` (not Sonner `toast`).
- Surface inline query errors with `<Alert type="error" />`.
- Surface field errors through `Form.Item` validation (not shadcn `FormMessage`).

> **Use the `App` wrapper, not the static `notification`/`message` imports.** In AntD v6 the static `notification.error()` / `message.x()` methods do **not** read `ConfigProvider` theme/locale context (and warn in the console). Wrap the tree once in `<App>` and pull context-aware instances from `App.useApp()`:
>
> ```tsx
> // providers — wrap once, inside ConfigProvider
> import { App, ConfigProvider } from "antd";
> <ConfigProvider theme={theme}><App>{children}</App></ConfigProvider>
>
> // in a component/hook
> const { notification } = App.useApp();
> notification.error({ message: "Failed to save" });
> ```

```tsx
const { data, isError, error } = useUsers(filters);

if (isError) {
  return <Alert type="error" message={error.message} />;
}
```
