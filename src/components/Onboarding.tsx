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
      <header className="onboarding__brand">Генератор креативов</header>

      <h1 className="onboarding__title">Один макет - все форматы для маркетплейсов.</h1>
      <p className="onboarding__sub">
        Соберите мастер-креатив и быстро адаптируйте его под карточки, сторис, объявления и инфографику.
      </p>

      <section className="onboarding__primary card">
        <div className="card__icon" aria-hidden>↑</div>
        <div className="card__body">
          <div className="card__title">Загрузить референс</div>
          <div className="card__desc">Добавьте фото товара - мы подберем палитру и композицию.</div>
          <FilePicker
            label="Выбрать файл"
            hint="или перетащите изображение сюда"
            onFile={(dataUrl) => onChoose('reference', { imageDataUrl: dataUrl })}
          />
        </div>
      </section>

      <section className="onboarding__pair">
        <button className="card card--action" onClick={() => onChoose('master')}>
          <div className="card__title">Создать мастер-креатив</div>
          <div className="card__desc">Начните с чистого макета и настройте все вручную.</div>
          <span className="card__cta">Создать новый</span>
        </button>
        <button className="card card--action" onClick={() => onChoose('template')}>
          <div className="card__title">Выбрать бренд-шаблон</div>
          <div className="card__desc">Возьмите готовую визуальную систему как старт.</div>
          <span className="card__cta">Открыть шаблоны</span>
        </button>
      </section>

      <ol className="onboarding__steps">
        <li><span>1</span> Выберите сценарий</li>
        <li><span>2</span> Настройте форматы</li>
        <li><span>3</span> Доведите макеты</li>
        <li><span>4</span> Экспортируйте результат</li>
      </ol>

      <div className="onboarding__import">
        Или{' '}
        <button className="link" type="button" onClick={() => fileRef.current?.click()}>
          импортируйте сохраненный .json-проект
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
