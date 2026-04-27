import { useRef } from 'react'
import { FilePicker } from './FilePicker'
import type { OnboardingMode } from '../lib/types'

type Props = {
  onChoose: (mode: OnboardingMode, payload?: { imageDataUrl?: string }) => void
  onImportJson: (file: File) => void
}

export function Onboarding({ onChoose, onImportJson }: Props) {
  const fileRef = useRef<HTMLInputElement>(null)
  return (
    <div className="onboarding">
      <header className="onboarding__brand">Adaptive Graphics</header>

      <h1 className="onboarding__title">Build once. Ship marketplace-ready layouts.</h1>
      <p className="onboarding__sub">
        Generate every format you need from one master creative — deterministic, fast, on-brand.
      </p>

      <section className="onboarding__primary card">
        <div className="card__icon" aria-hidden>↑</div>
        <div className="card__body">
          <div className="card__title">Import reference image</div>
          <div className="card__desc">Drop a product photo — we'll match colors and pick a composition.</div>
          <FilePicker
            label="Choose file"
            hint="or drag an image here"
            onFile={(dataUrl) => onChoose('reference', { imageDataUrl: dataUrl })}
          />
        </div>
      </section>

      <section className="onboarding__pair">
        <button className="card card--action" onClick={() => onChoose('master')}>
          <div className="card__title">Build master creative</div>
          <div className="card__desc">Start from a blank canvas with full control.</div>
          <span className="card__cta">Create new →</span>
        </button>
        <button className="card card--action" onClick={() => onChoose('template')}>
          <div className="card__title">Start from brand template</div>
          <div className="card__desc">Pick a preset visual system.</div>
          <span className="card__cta">Browse →</span>
        </button>
      </section>

      <ol className="onboarding__steps">
        <li><span>1</span> Choose mode</li>
        <li><span>2</span> Define pack</li>
        <li><span>3</span> Select direction</li>
        <li><span>4</span> Save and export</li>
      </ol>

      <div className="onboarding__import">
        Or{' '}
        <button className="link" type="button" onClick={() => fileRef.current?.click()}>
          import a saved .json project
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const f = e.target.files?.[0]
            if (f) onImportJson(f)
            e.target.value = ''
          }}
        />
      </div>
    </div>
  )
}
