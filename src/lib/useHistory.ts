// Bare-bones undo/redo for a single piece of state. Mirrors the useState
// signature so callers don't change shape; additionally exposes undo/redo
// and the boolean guards to wire up buttons / keyboard shortcuts.
//
// Coalescing: rapid successive writes within `debounceMs` collapse into a
// single history entry, so dragging a slider or typing into an input doesn't
// flood the past stack with one entry per keystroke. The commit happens
// implicitly when the window elapses or via the returned `commit()` fn.

import { useCallback, useEffect, useRef, useState } from 'react'

type Updater<T> = T | ((prev: T) => T)

export type HistoryControls<T> = {
  undo: () => void
  redo: () => void
  canUndo: boolean
  canRedo: boolean
  /** Force-close the current coalescing window so the next setState pushes
   *  a fresh history entry. Useful on pointer-up after a drag. */
  commit: () => void
  /** Replace current state without touching the undo stack. Use for remote
   *  imports / resets that shouldn't be undoable as a tiny step. */
  reset: (next: T) => void
}

export function useHistory<T>(
  initial: T | (() => T),
  debounceMs = 400,
): [T, (updater: Updater<T>) => void, HistoryControls<T>] {
  const [state, setStateRaw] = useState<T>(initial)
  const pastRef = useRef<T[]>([])
  const futureRef = useRef<T[]>([])
  // When undefined, the next setState pushes a new history entry. When set to
  // a timestamp, setState calls within the debounce window replace the most
  // recent entry instead of appending.
  const lastCommitAtRef = useRef<number | null>(null)
  const [tick, setTick] = useState(0)

  const commit = useCallback(() => {
    lastCommitAtRef.current = null
  }, [])

  const setState = useCallback(
    (updater: Updater<T>) => {
      setStateRaw((prev) => {
        const next =
          typeof updater === 'function' ? (updater as (p: T) => T)(prev) : updater
        if (Object.is(next, prev)) return prev
        const now = Date.now()
        const within =
          lastCommitAtRef.current !== null &&
          now - lastCommitAtRef.current < debounceMs
        if (!within) {
          pastRef.current.push(prev)
          // cap history to avoid memory runaway
          if (pastRef.current.length > 100) pastRef.current.shift()
          futureRef.current = []
        }
        lastCommitAtRef.current = now
        setTick((t) => t + 1)
        return next
      })
    },
    [debounceMs],
  )

  const undo = useCallback(() => {
    const past = pastRef.current
    if (past.length === 0) return
    setStateRaw((cur) => {
      const prev = past.pop() as T
      futureRef.current.push(cur)
      lastCommitAtRef.current = null
      setTick((t) => t + 1)
      return prev
    })
  }, [])

  const redo = useCallback(() => {
    const future = futureRef.current
    if (future.length === 0) return
    setStateRaw((cur) => {
      const next = future.pop() as T
      pastRef.current.push(cur)
      lastCommitAtRef.current = null
      setTick((t) => t + 1)
      return next
    })
  }, [])

  const reset = useCallback((next: T) => {
    pastRef.current = []
    futureRef.current = []
    lastCommitAtRef.current = null
    setStateRaw(next)
    setTick((t) => t + 1)
  }, [])

  // Flush coalescing on window blur so switching apps doesn't leave a stale
  // hot entry that a fresh edit would merge into.
  useEffect(() => {
    const onBlur = () => {
      lastCommitAtRef.current = null
    }
    window.addEventListener('blur', onBlur)
    return () => window.removeEventListener('blur', onBlur)
  }, [])

  // `tick` is only read here so React re-renders consumers when canUndo/canRedo
  // flip. The variable itself isn't meaningful — it just bumps identity.
  void tick

  return [
    state,
    setState,
    {
      undo,
      redo,
      canUndo: pastRef.current.length > 0,
      canRedo: futureRef.current.length > 0,
      commit,
      reset,
    },
  ]
}
