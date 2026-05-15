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
    <div className="layers-panel layout-editor__layers" role="listbox" aria-label="Слои">
      <div className="layout-editor__layers-head">Слои</div>
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
              aria-label={object.visible ? 'Скрыть слой' : 'Показать слой'}
              title={object.visible ? 'Скрыть слой' : 'Показать слой'}
            >
              {object.visible ? 'П' : '-'}
            </button>
            <button
              type="button"
              className="layout-editor__layer-vis"
              onClick={() => onToggleLocked(object.id, !object.locked)}
              aria-pressed={!!object.locked}
              aria-label={object.locked ? 'Разблокировать слой' : 'Заблокировать слой'}
              title={object.locked ? 'Разблокировать слой' : 'Заблокировать слой'}
            >
              {object.locked ? 'З' : 'О'}
            </button>
            <button
              type="button"
              role="option"
              aria-selected={isSelected}
              className="layout-editor__layer-pick"
              onClick={() => onSelect(object.id)}
              title={`Выбрать: ${displayObjectName(object)}`}
            >
              <span className="layout-editor__layer-icon" aria-hidden="true">
                {layerGlyph(object.type)}
              </span>
              <span className="layout-editor__layer-label">{displayObjectName(object)}</span>
              <span className="layers-panel__type">{objectTypeLabel(object.type)}</span>
            </button>
            <button
              type="button"
              className="layout-editor__layer-vis"
              onClick={() => onMove(object.id, 'up')}
              disabled={!canMoveUp || backgroundMovementLocked}
              aria-label="Переместить слой выше"
              title="Выше"
            >
              ^
            </button>
            <button
              type="button"
              className="layout-editor__layer-vis"
              onClick={() => onMove(object.id, 'down')}
              disabled={!canMoveDown || backgroundMovementLocked}
              aria-label="Переместить слой ниже"
              title="Ниже"
            >
              v
            </button>
          </div>
        )
      })}
    </div>
  )
}

function displayObjectName(object: SceneObject): string {
  if (!object.name || isTechnicalName(object.name, object.type)) return objectTypeLabel(object.type)
  return object.name
}

function isTechnicalName(name: string, type: SceneObject['type']): boolean {
  const normalized = name.toLowerCase()
  return normalized === type || normalized === 'title' || normalized === 'subtitle' || normalized === 'cta' || normalized === 'badge' || normalized === 'logo' || normalized === 'image' || normalized === 'background'
}

function objectTypeLabel(type: SceneObject['type']): string {
  switch (type) {
    case 'background':
      return 'Фон'
    case 'image':
    case 'custom-image':
      return 'Изображение'
    case 'title':
      return 'Заголовок'
    case 'subtitle':
      return 'Подзаголовок'
    case 'cta':
      return 'Кнопка'
    case 'badge':
      return 'Бейдж'
    case 'logo':
      return 'Логотип'
    case 'text':
      return 'Текст'
    case 'shape':
      return 'Фигура'
    case 'decor':
      return 'Декор'
  }
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
