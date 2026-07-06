import { useEffect, useRef } from 'react'
import { useStore } from '../store/useStore'

// The app's one toast and one question dialog. Both are calm, in-theme
// replacements for window.alert/confirm: no OS modals, no surprise styling,
// Esc always means "no / dismiss".
export function Notices(): JSX.Element | null {
  const toast = useStore((s) => s.toast)
  const dismissToast = useStore((s) => s.dismissToast)
  const confirmBox = useStore((s) => s.confirmBox)
  const resolveConfirm = useStore((s) => s.resolveConfirm)
  const confirmRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    if (confirmBox) confirmRef.current?.focus()
  }, [confirmBox])

  useEffect(() => {
    if (!confirmBox && !toast) return
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return
      if (confirmBox) resolveConfirm(false)
      else dismissToast()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [confirmBox, toast, resolveConfirm, dismissToast])

  return (
    <>
      {confirmBox && (
        <div className="notice-backdrop" onClick={() => resolveConfirm(false)}>
          <div
            className="notice-dialog"
            role="alertdialog"
            aria-label={confirmBox.title}
            data-testid="confirm-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>{confirmBox.title}</h3>
            <p>{confirmBox.body}</p>
            <div className="notice-actions">
              <button className="ghost" data-testid="confirm-no" onClick={() => resolveConfirm(false)}>
                Cancel
              </button>
              <button
                ref={confirmRef}
                className={confirmBox.danger ? 'danger-btn' : 'primary'}
                data-testid="confirm-yes"
                onClick={() => resolveConfirm(true)}
              >
                {confirmBox.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}
      {toast && (
        <div className="toast" role="status" aria-live="polite" data-testid="toast">
          <span className="toast-message">{toast.message}</span>
          {toast.actions?.map((a) => (
            <button
              key={a.label}
              className="toast-action"
              data-testid={`toast-${a.label.toLowerCase().replace(/\s+/g, '-')}`}
              onClick={() => {
                a.run()
                dismissToast()
              }}
            >
              {a.label}
            </button>
          ))}
          <button className="toast-close" aria-label="Dismiss" onClick={dismissToast}>
            ×
          </button>
        </div>
      )}
    </>
  )
}
