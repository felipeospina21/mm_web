'use client'

import { useEffect, useRef } from 'react'

export interface ConfirmModalProps {
  /** Whether the modal is visible. */
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  /** Called when the user confirms the action. */
  onConfirm: () => void
  /** Called when the user cancels or dismisses (Esc / backdrop / Cancel). */
  onCancel: () => void
}

/**
 * A small, accessible confirmation modal. Used to guard destructive actions
 * such as loading a saved quotation while the editor has unsaved changes.
 *
 * Accessibility: role="dialog" + aria-modal, labelled by its title, closes on
 * Escape, focuses the cancel button on open, and closes on backdrop click.
 */
export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const cancelRef = useRef<HTMLButtonElement | null>(null)

  // Focus the cancel (safe default) button and wire Escape-to-cancel.
  useEffect(() => {
    if (!open) return
    cancelRef.current?.focus()
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onCancel}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="confirm-modal-title"
        aria-describedby="confirm-modal-message"
        className="w-full max-w-md rounded-xl bg-white p-6 shadow-xl"
        onClick={(e) => e.stopPropagation()}
      >
        <h2
          id="confirm-modal-title"
          className="text-lg font-semibold text-neutral-900"
        >
          {title}
        </h2>
        <p
          id="confirm-modal-message"
          className="mt-2 text-sm leading-relaxed text-neutral-600"
        >
          {message}
        </p>
        <div className="mt-6 flex justify-end gap-2">
          <button
            ref={cancelRef}
            onClick={onCancel}
            className="rounded-lg border border-neutral-300 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50 focus:outline-none focus:ring-2 focus:ring-neutral-400"
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-400"
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
