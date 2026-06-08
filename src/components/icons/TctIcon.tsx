/** @jsxImportSource preact */
import type { ComponentChildren } from "preact";

export type IconName =
  | "home"
  | "scale"
  | "wallet"
  | "userWallet"
  | "utensils"
  | "list"
  | "settings"
  | "chevronLeft"
  | "chevronRight"
  | "chevronDown"
  | "edit"
  | "tag"
  | "chart"
  | "cart"
  | "transport"
  | "sparkle"
  | "repeat"
  | "arrowRight"
  | "arrowLeft"
  | "arrowUp"
  | "arrowDown"
  | "plus"
  | "trash"
  | "sun"
  | "moon"
  | "dollarSign"
  | "theme"
  | "calendar"
  | "x"
  | "check";

interface TctIconProps {
  name: IconName | string;
  size?: number;
  class?: string;
  title?: string;
}

const paths: Record<string, ComponentChildren> = {
  home: (
    <>
      <path d="M3 11.5 12 4l9 7.5" />
      <path d="M5.5 10.5V20h5v-5.5h3V20h5v-9.5" />
    </>
  ),
  scale: (
    <>
      <path d="M12 4v16" />
      <path d="M5 7h14" />
      <path d="m7 7-3 6h6L7 7Z" />
      <path d="m17 7-3 6h6l-3-6Z" />
      <path d="M8 20h8" />
    </>
  ),
  wallet: (
    <>
      <path d="M4 7.5h15a2 2 0 0 1 2 2V18a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V7.5a2 2 0 0 1 2-2h12" />
      <path d="M16 13h5" />
      <path d="M17.5 13.2v-.4" />
    </>
  ),
  userWallet: (
    <>
      <path d="M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z" />
      <path d="M3.5 19c.7-3 2.2-4.5 4.5-4.5 1.2 0 2.2.4 3 1.1" />
      <path d="M12.5 10h7a1.5 1.5 0 0 1 1.5 1.5V18a1.5 1.5 0 0 1-1.5 1.5h-7A1.5 1.5 0 0 1 11 18v-6.5a1.5 1.5 0 0 1 1.5-1.5Z" />
      <path d="M17 14.5h4" />
    </>
  ),
  utensils: (
    <>
      <path d="M6 4v7" />
      <path d="M4 4v3.5a2 2 0 0 0 4 0V4" />
      <path d="M6 11v9" />
      <path d="M17 4v16" />
      <path d="M14 4c0 4 0 7 3 7" />
    </>
  ),
  list: (
    <>
      <path d="M8 6h13" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M3.5 6h.01" />
      <path d="M3.5 12h.01" />
      <path d="M3.5 18h.01" />
    </>
  ),
  settings: (
    <>
      <path d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z" />
      <path d="M19 13.2c.1-.4.1-.8.1-1.2s0-.8-.1-1.2l2-1.5-2-3.4-2.4 1a8 8 0 0 0-2-1.1L14.3 3h-4.6l-.4 2.8a8 8 0 0 0-2 1.1l-2.4-1-2 3.4 2 1.5a8 8 0 0 0 0 2.4l-2 1.5 2 3.4 2.4-1a8 8 0 0 0 2 1.1l.4 2.8h4.6l.4-2.8a8 8 0 0 0 2-1.1l2.4 1 2-3.4-2.1-1.5Z" />
    </>
  ),
  chevronLeft: <path d="m15 18-6-6 6-6" />,
  chevronRight: <path d="m9 6 6 6-6 6" />,
  chevronDown: <path d="m6 9 6 6 6-6" />,
  edit: (
    <>
      <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3Z" />
      <path d="m14.5 7.5 2 2" />
    </>
  ),
  tag: (
    <>
      <path d="M20 13 13 20 4 11V4h7l9 9Z" />
      <path d="M8 8h.01" />
    </>
  ),
  chart: (
    <>
      <path d="M4 19V5" />
      <path d="M4 19h16" />
      <path d="M8 16v-4" />
      <path d="M12 16V8" />
      <path d="M16 16v-6" />
    </>
  ),
  cart: (
    <>
      <path d="M3 5h2l2.2 10.2a2 2 0 0 0 2 1.6h7.7a2 2 0 0 0 2-1.5L20 8H6" />
      <path d="M9.5 20h.01" />
      <path d="M17 20h.01" />
    </>
  ),
  transport: (
    <>
      <path d="M6 17h12" />
      <path d="M7 17v2" />
      <path d="M17 17v2" />
      <path d="M5 13l1.2-5A3 3 0 0 1 9 6h6a3 3 0 0 1 2.8 2l1.2 5v4H5v-4Z" />
      <path d="M8 13h.01" />
      <path d="M16 13h.01" />
    </>
  ),
  sparkle: (
    <>
      <path d="M12 3l1.5 5 4.5 1.5-4.5 1.5L12 16l-1.5-5L6 9.5 10.5 8 12 3Z" />
      <path d="M19 14l.8 2.4L22 17l-2.2.6L19 20l-.8-2.4L16 17l2.2-.6L19 14Z" />
      <path d="M5 15l.6 1.8L7.5 17.5l-1.9.7L5 20l-.6-1.8-1.9-.7 1.9-.7L5 15Z" />
    </>
  ),
  repeat: (
    <>
      <path d="M17 2l4 4-4 4" />
      <path d="M3 11V9a3 3 0 0 1 3-3h15" />
      <path d="M7 22l-4-4 4-4" />
      <path d="M21 13v2a3 3 0 0 1-3 3H3" />
    </>
  ),
  arrowRight: (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  arrowLeft: (
    <>
      <path d="M19 12H5" />
      <path d="m11 6-6 6 6 6" />
    </>
  ),
  arrowUp: (
    <>
      <path d="M12 19V5" />
      <path d="m6 11 6-6 6 6" />
    </>
  ),
  arrowDown: (
    <>
      <path d="M12 5v14" />
      <path d="m6 13 6 6 6-6" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
      <path d="M6 7l1 13h10l1-13" />
      <path d="M9 7V4h6v3" />
    </>
  ),
  sun: (
    <>
      <path d="M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.9 4.9 1.4 1.4" />
      <path d="m17.7 17.7 1.4 1.4" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m4.9 19.1 1.4-1.4" />
      <path d="m17.7 6.3 1.4-1.4" />
    </>
  ),
  moon: <path d="M20 15.5A8 8 0 0 1 8.5 4 7 7 0 1 0 20 15.5Z" />,
  dollarSign: (
    <>
      <path d="M12 3v18" />
      <path d="M17 7.5C15.8 6.4 14.1 6 12.4 6 9.8 6 8 7.2 8 9c0 4 8 2 8 6 0 1.8-1.8 3-4.4 3-1.9 0-3.7-.6-4.9-1.8" />
    </>
  ),
  theme: (
    <>
      <path d="M12 3a9 9 0 1 0 0 18" />
      <path d="M12 3a9 9 0 0 1 0 18" />
      <path d="M12 3v18" />
    </>
  ),
  calendar: (
    <>
      <path d="M7 3v4" />
      <path d="M17 3v4" />
      <path d="M4 8h16" />
      <path d="M5 5h14a1 1 0 0 1 1 1v13a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a1 1 0 0 1 1-1Z" />
    </>
  ),
  x: (
    <>
      <path d="M6 6l12 12" />
      <path d="M18 6 6 18" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
};

export default function TctIcon({ name, size = 18, class: className, title }: TctIconProps) {
  const content = paths[name] || paths.tag;
  return (
    <svg
      class={className}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="1.8"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden={title ? undefined : "true"}
      role={title ? "img" : undefined}
    >
      {title && <title>{title}</title>}
      {content}
    </svg>
  );
}
