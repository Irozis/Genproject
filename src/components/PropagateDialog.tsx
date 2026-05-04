// Modal dialog asking the user which formats to push the freshly-edited
// layout to. The actual layout projection (anchored fit + safe-zone clamp)
// lives in `lib/propagateLayout`; the recommendation logic — which targets
// are likely a good fit for the same layout — lives in `lib/formatSimilarity`.
// This component is presentation only.
//
// UX notes:
//   - Default selection is the "recommended" set (high + medium similarity)
//     so the primary action button is safe even if the user just hits Apply.
//   - Inside each platform group the recommended formats float to the top,
//     so the eye lands on them first. A small "★" badge with a tooltip
//     explains *why* something is recommended (same shape, same platform,
//     etc.) — users have asked us to be explicit about that.
//   - The header shows a "Только рекомендуемые" / "Выбрать все" toggle for
//     bulk control.

import { useEffect, useMemo, useState } from 'react'
import { getFormat } from '../lib/formats'
import { groupFormats, type FormatGroup } from '../lib/formatGroups'
import {
  defaultRecommendedTargets,
  recommendTargets,
  type FormatRecommendation,
  type RecommendationLevel,
} from '../lib/formatSimilarity'
import type { FormatKey, FormatRuleSet } from '../lib/types'

type Props = {
  sourceFormat: FormatKey
  /** Все форматы, выбранные в проекте — кандидаты на «применить к…». */
  candidates: FormatKey[]
  customFormats?: FormatRuleSet[]
  onApply: (targets: FormatKey[]) => void
  onCancel: () => void
}

export function PropagateDialog({ sourceFormat, candidates, customFormats, onApply, onCancel }: Props) {
  const targets = useMemo(
    () => candidates.filter((k) => k !== sourceFormat),
    [candidates, sourceFormat],
  )

  // Build recommendations once per (source, candidates) pair. The map gives
  // O(1) lookup inside the row renderer.
  const recommendations = useMemo(
    () => recommendTargets(sourceFormat, targets, customFormats),
    [sourceFormat, targets, customFormats],
  )
  const recsByKey = useMemo(() => {
    const map = new Map<FormatKey, FormatRecommendation>()
    for (const r of recommendations) map.set(r.key, r)
    return map
  }, [recommendations])

  // Sort each platform group so recommendations float to the top — keeps the
  // platform structure (which the user is used to) but rewards quick scanning.
  const groups = useMemo(() => {
    const raw = groupFormats(targets)
    return raw.map((g) => ({
      ...g,
      keys: [...g.keys].sort((a, b) => {
        const sa = recsByKey.get(a)?.score ?? 0
        const sb = recsByKey.get(b)?.score ?? 0
        return sb - sa
      }),
    }))
  }, [targets, recsByKey])

  const recommendedKeys = useMemo(
    () => defaultRecommendedTargets(recommendations),
    [recommendations],
  )

  const [selected, setSelected] = useState<Set<FormatKey>>(() => new Set(recommendedKeys))

  // Reset selection when the modal opens for a different source / target set.
  useEffect(() => {
    setSelected(new Set(recommendedKeys))
  }, [recommendedKeys])

  const allOn = selected.size === targets.length && targets.length > 0
  const onlyRecommended =
    selected.size === recommendedKeys.length &&
    recommendedKeys.every((k) => selected.has(k)) &&
    recommendedKeys.length > 0
  const sourceLabel = getFormat(sourceFormat, customFormats).label

  function toggle(key: FormatKey) {
    setSelected((s) => {
      const next = new Set(s)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(targets))
  }

  function selectRecommended() {
    setSelected(new Set(recommendedKeys))
  }

  function selectNone() {
    setSelected(new Set())
  }

  function toggleGroup(group: FormatGroup) {
    setSelected((s) => {
      const next = new Set(s)
      const allInGroupOn = group.keys.every((k) => next.has(k))
      if (allInGroupOn) {
        for (const k of group.keys) next.delete(k)
      } else {
        for (const k of group.keys) next.add(k)
      }
      return next
    })
  }

  return (
    <div className="propagate-dialog" role="dialog" aria-modal="true" aria-label="Применить макет к другим форматам">
      <div className="propagate-dialog__backdrop" onClick={onCancel} aria-hidden="true" />
      <div className="propagate-dialog__panel">
        <header className="propagate-dialog__head">
          <h2 className="propagate-dialog__title">Применить макет</h2>
          <p className="propagate-dialog__subtitle">
            Скопировать раскладку из <strong>«{sourceLabel}»</strong> в выбранные форматы. Положение
            каждого блока пересчитается по «привязке к краю» и уляжется в safe-zone каждого формата.
          </p>
          {recommendedKeys.length > 0 ? (
            <p className="propagate-dialog__hint">
              <span className="propagate-dialog__star" aria-hidden="true">★</span>
              {' '}
              Подсветили <strong>{recommendedKeys.length}</strong>{' '}
              {pluralFormat(recommendedKeys.length)} с похожими пропорциями — раскладка ляжет туда без
              значительных правок. Остальные можно отметить вручную.
            </p>
          ) : null}
        </header>

        <div className="propagate-dialog__list-head">
          <div className="propagate-dialog__quick">
            <button
              type="button"
              className={`btn btn-xs${onlyRecommended ? ' btn-primary' : ' btn-ghost'}`}
              onClick={selectRecommended}
              disabled={recommendedKeys.length === 0}
              title="Отметить только форматы с близкими пропорциями"
            >
              ★ Только рекомендуемые
            </button>
            <button
              type="button"
              className={`btn btn-xs${allOn ? ' btn-primary' : ' btn-ghost'}`}
              onClick={selectAll}
              disabled={targets.length === 0}
            >
              Все
            </button>
            <button
              type="button"
              className="btn btn-ghost btn-xs"
              onClick={selectNone}
              disabled={selected.size === 0}
            >
              Снять
            </button>
          </div>
          <span className="propagate-dialog__count">
            Выбрано {selected.size} из {targets.length}
          </span>
        </div>

        {targets.length === 0 ? (
          <div className="propagate-dialog__empty">
            В проекте нет других форматов, на которые можно перенести макет.
          </div>
        ) : (
          <div className="propagate-dialog__groups" role="list">
            {groups.map((group) => (
              <FormatGroupSection
                key={group.id}
                group={group}
                selected={selected}
                customFormats={customFormats}
                recsByKey={recsByKey}
                onToggleGroup={() => toggleGroup(group)}
                onToggle={toggle}
              />
            ))}
          </div>
        )}

        <footer className="propagate-dialog__footer">
          <button type="button" className="btn btn-ghost btn-xs" onClick={onCancel}>
            Отмена
          </button>
          <button
            type="button"
            className="btn btn-primary btn-xs"
            onClick={() => onApply(Array.from(selected))}
            disabled={selected.size === 0}
          >
            Применить к {selected.size}
          </button>
        </footer>
      </div>
    </div>
  )
}

function FormatGroupSection({
  group,
  selected,
  customFormats,
  recsByKey,
  onToggleGroup,
  onToggle,
}: {
  group: FormatGroup
  selected: Set<FormatKey>
  customFormats?: FormatRuleSet[]
  recsByKey: Map<FormatKey, FormatRecommendation>
  onToggleGroup: () => void
  onToggle: (key: FormatKey) => void
}) {
  const checkedCount = group.keys.reduce((n, k) => (selected.has(k) ? n + 1 : n), 0)
  const allOn = checkedCount === group.keys.length
  const noneOn = checkedCount === 0
  const recommendedInGroup = group.keys.filter(
    (k) => (recsByKey.get(k)?.level ?? 'low') !== 'low',
  ).length
  return (
    <section className="propagate-dialog__group" role="listitem">
      <header className="propagate-dialog__group-head">
        <label
          className="propagate-dialog__group-toggle"
          title={group.hint ?? group.label}
        >
          <input
            type="checkbox"
            checked={allOn}
            ref={(el) => {
              if (el) el.indeterminate = !allOn && !noneOn
            }}
            onChange={onToggleGroup}
            aria-label={`Выбрать все форматы группы «${group.label}»`}
          />
          <span className="propagate-dialog__group-label">{group.label}</span>
          {recommendedInGroup > 0 ? (
            <span
              className="propagate-dialog__group-rec"
              title="В этой группе есть похожие форматы"
              aria-label="В группе есть рекомендуемые форматы"
            >
              ★ {recommendedInGroup}
            </span>
          ) : null}
          <span className="propagate-dialog__group-count">
            {checkedCount}/{group.keys.length}
          </span>
        </label>
      </header>
      <ul className="propagate-dialog__list" role="list">
        {group.keys.map((k) => {
          const rules = getFormat(k, customFormats)
          const checked = selected.has(k)
          const rec = recsByKey.get(k)
          const level: RecommendationLevel = rec?.level ?? 'low'
          return (
            <li key={k}>
              <label
                className={`propagate-dialog__row${checked ? ' is-on' : ''} propagate-dialog__row--${level}`}
                title={rec && rec.reasons.length > 0 ? rec.reasons.join(' • ') : undefined}
              >
                <input type="checkbox" checked={checked} onChange={() => onToggle(k)} />
                <FormatThumb rules={rules} />
                <span className="propagate-dialog__row-text">
                  <span className="propagate-dialog__row-label">
                    {rules.label}
                    {level !== 'low' ? (
                      <span className={`propagate-dialog__badge propagate-dialog__badge--${level}`}>
                        {level === 'high' ? '★ Подходит' : '☆ Подойдёт'}
                      </span>
                    ) : null}
                  </span>
                  <span className="propagate-dialog__row-dim">
                    {rules.width}×{rules.height}
                    {rec && rec.reasons.length > 0 ? (
                      <span className="propagate-dialog__row-reason"> • {rec.reasons[0]}</span>
                    ) : null}
                  </span>
                </span>
              </label>
            </li>
          )
        })}
      </ul>
    </section>
  )
}

function FormatThumb({ rules }: { rules: FormatRuleSet }) {
  // Cap thumb at 56px square so very wide / very tall formats stay legible.
  const maxSide = 56
  const w = rules.aspectRatio >= 1 ? maxSide : maxSide * rules.aspectRatio
  const h = rules.aspectRatio >= 1 ? maxSide / rules.aspectRatio : maxSide
  return (
    <span
      className="propagate-dialog__thumb"
      aria-hidden="true"
      style={{ width: `${w}px`, height: `${h}px` }}
    />
  )
}

// Russian count: 1 формат / 2-4 формата / 5+ форматов.
function pluralFormat(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) return 'формат'
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) return 'формата'
  return 'форматов'
}
