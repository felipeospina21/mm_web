"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

import { t } from "@/i18n/messages";

/**
 * App-wide, non-blocking notifications. Replaces native `alert(...)` for
 * transient success/error messages (e.g. save or PDF-export failures).
 *
 * Mounted once at the root layout so any client component can call
 * `useToast().showError(...)` without threading props. Backed by real state
 * (mirrors `EditorDraftProvider`) so toasts render reactively and survive
 * route changes within the app.
 */
export type ToastVariant = "error" | "success" | "info";

export interface Toast {
  id: number;
  message: string;
  variant: ToastVariant;
}

export interface ShowToastOptions {
  /** Auto-dismiss delay in ms. Pass 0 to disable auto-dismiss. */
  durationMs?: number;
}

interface ToastContextValue {
  /** Show a toast of the given variant; returns its id. */
  showToast: (
    message: string,
    variant?: ToastVariant,
    options?: ShowToastOptions,
  ) => number;
  /** Convenience for the common error path. Errors do not auto-dismiss. */
  showError: (message: string, options?: ShowToastOptions) => number;
  /** Dismiss a toast by id. */
  dismiss: (id: number) => void;
}

const DEFAULT_DURATION_MS = 5000;

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const nextId = useRef(0);
  // Track pending auto-dismiss timers so we can clear them on unmount.
  const timers = useRef(new Map<number, ReturnType<typeof setTimeout>>());

  const dismiss = useCallback((id: number) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
  }, []);

  const showToast = useCallback(
    (
      message: string,
      variant: ToastVariant = "info",
      options?: ShowToastOptions,
    ): number => {
      const id = nextId.current++;
      setToasts((current) => [...current, { id, message, variant }]);
      // Errors stay until dismissed (duration 0) unless the caller overrides;
      // other variants auto-dismiss.
      const duration =
        options?.durationMs ??
        (variant === "error" ? 0 : DEFAULT_DURATION_MS);
      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
      return id;
    },
    [dismiss],
  );

  const showError = useCallback(
    (message: string, options?: ShowToastOptions) =>
      showToast(message, "error", options),
    [showToast],
  );

  // Clear any outstanding timers if the provider unmounts.
  useEffect(() => {
    const pending = timers.current;
    return () => {
      pending.forEach((timer) => clearTimeout(timer));
      pending.clear();
    };
  }, []);

  const value = useMemo(
    () => ({ showToast, showError, dismiss }),
    [showToast, showError, dismiss],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toasts={toasts} onDismiss={dismiss} />
    </ToastContext.Provider>
  );
}

const VARIANT_STYLES: Record<ToastVariant, string> = {
  error: "border-red-200 bg-red-50 text-red-800",
  success: "border-green-200 bg-green-50 text-green-800",
  info: "border-neutral-200 bg-white text-neutral-800",
};

function ToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: Toast[];
  onDismiss: (id: number) => void;
}) {
  if (toasts.length === 0) return null;
  return (
    <div
      // A polite live region so screen readers announce new toasts; individual
      // error toasts are assertive (see below).
      aria-live="polite"
      className="pointer-events-none fixed inset-x-0 bottom-0 z-[60] flex flex-col items-center gap-2 p-4 sm:items-end"
    >
      {toasts.map((toast) => (
        <div
          key={toast.id}
          role={toast.variant === "error" ? "alert" : "status"}
          aria-live={toast.variant === "error" ? "assertive" : "polite"}
          className={`pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg ${VARIANT_STYLES[toast.variant]}`}
        >
          <p className="flex-1 leading-relaxed">{toast.message}</p>
          <button
            type="button"
            onClick={() => onDismiss(toast.id)}
            aria-label={t("common.dismiss")}
            className="-m-1 rounded-md p-1 text-current/70 hover:text-current focus:ring-2 focus:ring-current/40 focus:outline-none"
          >
            <span aria-hidden="true">✕</span>
          </button>
        </div>
      ))}
    </div>
  );
}

/**
 * Access the toast API. Returns no-op defaults when used outside a provider so
 * consumers (and tests) never need to null-check.
 */
export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  return (
    context ?? {
      showToast: () => -1,
      showError: () => -1,
      dismiss: () => undefined,
    }
  );
}
