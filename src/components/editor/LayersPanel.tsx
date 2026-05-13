import { sortLayers } from '../../lib/formatDocuments'
import type { SceneObject } from '../../lib/types'

type Props = {
  objects: SceneObject[]
  activeObjectId?: string | null
  onSelect: (objectId: string) => void
  onToggleVisible: (objectId: string, visible: boolean) => void
  onToggleLocked: (objectId: string, locked: boolean) => void
  onMove: (objectId: string, direction: 'up' | 'down') => void
}

export function LayersPanel({
  objects,
  activeObjectId,
  onSelect,
  onToggleVisible,
  onToggleLocked,
  onMove,
}: Props) {
  const layers = sortLayers(objects)
  const protectedBackgroundId = objects.find((object) => object.type === 'background' && object.locked)?.id

  if (layers.length === 0) return null

  return (
    <div className="layers-panel layout-editor__layers" role="listbox" aria-label="Layers">
      <div className="layout-editor__layers-head">Layers</div>
      {layers.map((object, index) => {
        const isSelected = object.id === activeObjectId
        const canMoveUp = index > 0
        const canMoveDown = index < layers.length - 1 && layers[index + 1]?.id !== protectedBackgroundId
        const backgroundMovementLocked = object.id === protectedBackgroundId
        return (
          <div
            key={object.id}
            className={`layout-editor__layer${isSelected ? ' is-selected' : ''}${object.visible ? '' : ' is-hidden'}${object.locked ? ' is-locked' : ''}`}
          >
            <button
              type="button"
              className="layout-editor__layer-vis"
              onClick={() => onToggleVisible(object.id, !object.visible)}
              aria-pressed={object.visible}
              title={object.visible ? 'Hide layer' : 'Show layer'}
            >
              {object.visible ? 'V' : '-'}
            </button>
            <button
              type="button"
              className="layout-editor__layer-vis"
              onClick={() => onToggleLocked(object.id, !object.locked)}
              aria-pressed={!!object.locked}
              title={object.locked ? 'Unlock layer' : 'Lock layer'}
            >
              {object.locked ? 'L' : 'U'}
            </button>
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              className="layout-editor__layer-pick"
              onClick={() => onSelect(object.id)}
              title={`Select ${object.name}`}
            >
              <span className="layout-editor__layer-icon" aria-hidden="true">
                {layerGlyph(object.type)}
              </span>
              <span className="layout-editor__layer-label">{object.name}</span>
              <span className="layers-panel__type">{object.type}</span>
            </button>
            <button
              type="button"
              className="layout-editor__layer-vis"
              onClick={() => onMove(object.id, 'up')}
              disabled={!canMoveUp || backgroundMovementLocked}
              title="Move layer up"
            >
              ^
            </button>
            <button
              type="button"
              className="layout-editor__layer-vis"
              onClick={() => onMove(object.id, 'down')}
              disabled={!canMoveDown || backgroundMovementLocked}
              title="Move layer down"
            >
              v
            </button>
          </div>
        )
      })}
    </div>
  )
}

function layerGlyph(type: SceneObject['type']): string {
  switch (type) {
    case 'background':
      return 'BG'
    case 'image':
    case 'custom-image':
      return 'I'
    case 'title':
      return 'T'
    case 'subtitle':
    case 'text':
      return 'A'
    case 'cta':
      return 'C'
    case 'badge':
      return 'B'
    case 'logo':
      return 'L'
    case 'shape':
      return 'S'
    case 'decor':
      return 'D'
  }
}
