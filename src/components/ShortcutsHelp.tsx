import { X } from 'lucide-react'

interface ShortcutsHelpProps {
  open: boolean
  onClose: () => void
}

interface Shortcut {
  keys: string[]
  description: string
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['/'], description: 'Focus search' },
  { keys: ['1', '2', '3', '4', '5', '6'], description: 'Switch view tabs' },
  { keys: ['['], description: 'Previous entry' },
  { keys: [']'], description: 'Next entry' },
  { keys: ['Esc'], description: 'Close detail or modal' },
  { keys: ['?'], description: 'Show this dialog' },
]

export function ShortcutsHelp({ open, onClose }: ShortcutsHelpProps) {
  if (!open) {
    return null
  }

  return (
    <div className="modal-overlay" role="presentation" onClick={onClose}>
      <div
        className="modal-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="shortcuts-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="modal-top">
          <div>
            <p className="eyebrow">Keyboard</p>
            <h2 id="shortcuts-title">Shortcuts</h2>
          </div>
          <button type="button" className="icon-button" onClick={onClose}>
            <X aria-hidden="true" />
            <span className="sr-only">Close shortcuts</span>
          </button>
        </div>
        <dl className="shortcut-list">
          {SHORTCUTS.map((shortcut) => (
            <div key={shortcut.description}>
              <dt>
                {shortcut.keys.map((key) => (
                  <kbd key={key}>{key}</kbd>
                ))}
              </dt>
              <dd>{shortcut.description}</dd>
            </div>
          ))}
        </dl>
        <p className="modal-foot">
          All major actions are reachable from the keyboard. Press <kbd>?</kbd> to reopen this any time.
        </p>
      </div>
    </div>
  )
}
