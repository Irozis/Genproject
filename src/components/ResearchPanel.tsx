import { useEffect, useMemo, useState } from 'react'
import {
  RESEARCH_SCENARIOS,
  calculateResearchMetrics,
  compareResearchResults,
  type ManualResearchResult,
  type ResearchMethod,
  type ResearchSession,
} from '../lib/research'

type Props = {
  session: ResearchSession | null
  manualResults: ManualResearchResult[]
  onStart: (params: { scenarioName: string; participantId?: string; method: ResearchMethod; notes?: string }) => void
  onStop: () => void
  onReset: () => void
  onExport: () => void
  onAddManualResult: (result: ManualResearchResult) => void
}

export function ResearchPanel({ session, manualResults, onStart, onStop, onReset, onExport, onAddManualResult }: Props) {
  const [scenarioName, setScenarioName] = useState<string>(RESEARCH_SCENARIOS[0]?.name ?? 'Small set')
  const [participantId, setParticipantId] = useState('')
  const [method, setMethod] = useState<ResearchMethod>('app')
  const [notes, setNotes] = useState('')
  const [now, setNow] = useState(Date.now())
  const [manualOpen, setManualOpen] = useState(false)
  const [manualForm, setManualForm] = useState({
    scenarioName: String(RESEARCH_SCENARIOS[0]?.name ?? 'Small set'),
    method: 'manual' as ResearchMethod,
    participantId: '',
    totalDurationMinutes: 0,
    actionCount: 0,
    formatCount: 0,
    exportedFormatCount: 0,
    errorCount: 0,
    manualEditCount: 0,
    notes: '',
  })

  useEffect(() => {
    if (!session || session.finishedAt) return
    const timer = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(timer)
  }, [session])

  const metrics = useMemo(() => session ? calculateResearchMetrics(session.finishedAt ? session : { ...session, durationMs: now - new Date(session.startedAt).getTime() }) : null, [now, session])
  const comparison = session && manualResults[0] ? compareResearchResults(manualResults[0], session) : null

  return (
    <section className="research-panel" data-testid="research-panel">
      <div className="research-panel__header">
        <div>
          <p className="eyebrow">Режим эксперимента</p>
          <h2>Замер подготовки макетов</h2>
        </div>
        <span className={session && !session.finishedAt ? 'badge badge--success' : 'badge'}>{session && !session.finishedAt ? 'Идёт замер' : 'Остановлен'}</span>
      </div>

      <div className="research-panel__grid">
        <label>
          Сценарий
          <select value={scenarioName} onChange={(event) => setScenarioName(event.target.value)} disabled={!!session && !session.finishedAt}>
            {RESEARCH_SCENARIOS.map((scenario) => <option key={scenario.id} value={scenario.name}>{scenario.name}</option>)}
          </select>
        </label>
        <label>
          Метод
          <select value={method} onChange={(event) => setMethod(event.target.value as ResearchMethod)} disabled={!!session && !session.finishedAt}>
            <option value="app">приложение</option>
            <option value="manual">ручной способ</option>
            <option value="template">шаблон</option>
            <option value="other">другое</option>
          </select>
        </label>
        <label>
          Участник
          <input value={participantId} onChange={(event) => setParticipantId(event.target.value)} placeholder="необязательно" disabled={!!session && !session.finishedAt} />
        </label>
        <label>
          Заметки
          <input value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="условия эксперимента" disabled={!!session && !session.finishedAt} />
        </label>
      </div>

      <div className="research-panel__actions">
        <button type="button" onClick={() => onStart({ scenarioName, participantId, method, notes })} disabled={!!session && !session.finishedAt}>Начать замер</button>
        <button type="button" onClick={onStop} disabled={!session || !!session.finishedAt}>Остановить замер</button>
        <button type="button" onClick={onReset}>Сбросить</button>
        <button type="button" onClick={onExport} disabled={!session}>Экспортировать отчёт</button>
        <button type="button" onClick={() => setManualOpen((value) => !value)}>Добавить результат ручного метода</button>
      </div>

      <div className="research-panel__metrics">
        <Metric label="Таймер" value={metrics ? `${metrics.totalDurationMinutes.toFixed(2)} мин` : '0.00 мин'} />
        <Metric label="Действий" value={session?.actionCount ?? 0} />
        <Metric label="Выбрано форматов" value={session?.selectedFormatCount ?? 0} />
        <Metric label="Сгенерировано" value={session?.generatedAssetCount ?? 0} />
        <Metric label="Экспортировано" value={session?.exportedAssetCount ?? 0} />
        <Metric label="Предупреждений" value={session?.validationWarningCount ?? 0} />
        <Metric label="Ошибок" value={session?.validationErrorCount ?? 0} />
        <Metric label="Ручных правок" value={session?.manualEditCount ?? 0} />
      </div>

      {session?.finishedAt && metrics && (
        <div className="research-results">
          <h3>Результаты эксперимента</h3>
          <p>Общее время: {metrics.totalDurationMinutes.toFixed(2)} мин</p>
          <p>Форматов подготовлено: {session.selectedFormatCount}</p>
          <p>Среднее время на формат: {metrics.averageTimePerFormatMinutes.toFixed(2)} мин</p>
          <p>Действий выполнено: {session.actionCount}</p>
          <p>Среднее число действий на формат: {metrics.averageActionsPerFormat.toFixed(2)}</p>
          <p>Ручных правок: {session.manualEditCount}</p>
          <p>Предупреждений: {session.validationWarningCount}</p>
          <p>Ошибок: {session.validationErrorCount}</p>
          <p>Экспортировано файлов: {session.exportedAssetCount}</p>
          <p>Доля экспортированных форматов: {metrics.exportedFormatsShare.toFixed(1)}%</p>
          {comparison && (
            <div className="research-results__comparison">
              <h4>Сравнение методов</h4>
              <p>Сокращение времени: {comparison.timeReductionPercent.toFixed(1)}%</p>
              <p>Сокращение количества действий: {comparison.actionReductionPercent.toFixed(1)}%</p>
              <p>Разница среднего времени на формат: {comparison.averageTimePerFormatDifference.toFixed(2)} мин</p>
              <p>Разница ошибок: {comparison.errorDifference}</p>
              <p>Разница ручных правок: {comparison.manualEditDifference}</p>
            </div>
          )}
        </div>
      )}

      {manualOpen && (
        <form className="research-manual-form" onSubmit={(event) => {
          event.preventDefault()
          onAddManualResult({ ...manualForm, id: `manual-${Date.now()}`, participantId: manualForm.participantId || undefined, notes: manualForm.notes || undefined })
          setManualOpen(false)
        }}>
          <h3>Добавить результат ручного метода</h3>
          <input value={manualForm.scenarioName} onChange={(event) => setManualForm({ ...manualForm, scenarioName: event.target.value })} placeholder="scenarioName" />
          <select value={manualForm.method} onChange={(event) => setManualForm({ ...manualForm, method: event.target.value as ResearchMethod })}>
            <option value="manual">manual</option>
            <option value="template">template</option>
            <option value="app">app</option>
            <option value="other">other</option>
          </select>
          <input value={manualForm.participantId} onChange={(event) => setManualForm({ ...manualForm, participantId: event.target.value })} placeholder="participantId" />
          <NumberInput label="totalDurationMinutes" value={manualForm.totalDurationMinutes} onChange={(value) => setManualForm({ ...manualForm, totalDurationMinutes: value })} />
          <NumberInput label="actionCount" value={manualForm.actionCount} onChange={(value) => setManualForm({ ...manualForm, actionCount: value })} />
          <NumberInput label="formatCount" value={manualForm.formatCount} onChange={(value) => setManualForm({ ...manualForm, formatCount: value })} />
          <NumberInput label="exportedFormatCount" value={manualForm.exportedFormatCount} onChange={(value) => setManualForm({ ...manualForm, exportedFormatCount: value })} />
          <NumberInput label="errorCount" value={manualForm.errorCount} onChange={(value) => setManualForm({ ...manualForm, errorCount: value })} />
          <NumberInput label="manualEditCount" value={manualForm.manualEditCount} onChange={(value) => setManualForm({ ...manualForm, manualEditCount: value })} />
          <textarea value={manualForm.notes} onChange={(event) => setManualForm({ ...manualForm, notes: event.target.value })} placeholder="notes" />
          <button type="submit">Сохранить результат</button>
        </form>
      )}
    </section>
  )
}

function Metric({ label, value }: { label: string; value: string | number }) {
  return <div className="research-metric"><span>{label}</span><strong>{value}</strong></div>
}

function NumberInput({ label, value, onChange }: { label: string; value: number; onChange: (value: number) => void }) {
  return <label>{label}<input type="number" min="0" step="0.01" value={value} onChange={(event) => onChange(Number(event.target.value))} /></label>
}
