import type { ReactNode } from "react";

interface ActionsMenuItemProps {
  children: ReactNode;
  onClick: () => void;
  disabled?: boolean;
}

export function ActionsMenuItem({
  children,
  onClick,
  disabled = false,
}: ActionsMenuItemProps) {
  return (
    <button
      type="button"
      role="menuitem"
      className="block w-full rounded px-3 py-1.5 text-left text-sm text-neutral-700 hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-50"
      onClick={onClick}
      disabled={disabled}
    >
      {children}
    </button>
  );
}
