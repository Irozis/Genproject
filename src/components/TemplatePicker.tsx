import { SceneRenderer } from '../renderers/SceneRenderer'
import { getFormat } from '../lib/formats'
import { TEMPLATES, type Template } from '../lib/templates'
import { buildScene } from '../lib/buildScene'
import { DEFAULT_ENABLED } from '../lib/defaults'

type Props = {
  onPick: (template: Template) => void
  onBack: () => void
}

export function TemplatePicker({ onPick, onBack }: Props) {
  const previewFormat = getFormat('marketplace-card')

  return (
    <div className="template-picker">
      <header className="template-picker__head">
        <button className="btn btn-ghost btn-sm" onClick={onBack}>← Back</button>
        <h1>Choose a brand template</h1>
        <span />
      </header>

      <div className="template-grid">
        {TEMPLATES.map((t) => {
          const override = t.preferredModels?.['marketplace-card']
          const scene = buildScene(
            t.master,
            'marketplace-card',
            t.brandKit,
            DEFAULT_ENABLED,
            override ? { override } : {},
          )
          return (
            <button
              key={t.id}
              type="button"
              className="template-card"
              onClick={() => onPick(t)}
            >
              <div className="template-card__preview">
                <SceneRenderer
                  scene={scene}
                  rules={previewFormat}
                  displayFont={t.brandKit.displayFont}
                  textFont={t.brandKit.textFont}
                  brandInitials={t.brandKit.brandName}
                  brandColor={t.brandKit.palette.accent}
                  className="template-card__svg"
                />
              </div>
              <div className="template-card__meta">
                <div className="template-card__name">{t.name}</div>
                <div className="template-card__desc">{t.description}</div>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
