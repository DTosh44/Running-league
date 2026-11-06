import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react'
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Edit3, MapPin, Plus, RefreshCw, Route, Share2, Trash2, Users, X } from 'lucide-react'
import { useAuth } from './auth'
import { usePlatform } from './platform'
import { supabase } from './supabase'
import {
  calendarDays, createPlannedRuns, dateKey, deletePlannedRun, formatPace, listPlannedRuns,
  parsePace, setRunAttendance, shareRunUrl, shiftView, toLocalDateTime,
  updatePlannedRun, viewRange, type PlannedRun, type RunDraft, type RunPlansView,
} from './run-plans'
import './run-plans.css'

type RunFormValues = {
  title: string
  dateTime: string
  meetingPoint: string
  distance: string
  pace: string
  notes: string
  repeatWeeks: 1 | 4 | 8
}

const dateFormat = new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'short' })
const timeFormat = new Intl.DateTimeFormat('en-GB', { hour: '2-digit', minute: '2-digit' })
const longDateFormat = new Intl.DateTimeFormat('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

function initialDate(): Date {
  const fromLink = new URLSearchParams(window.location.search).get('date')
  const parsed = fromLink && /^\d{4}-\d{2}-\d{2}$/.test(fromLink) ? new Date(fromLink + 'T12:00:00') : null
  return parsed && Number.isFinite(parsed.getTime()) ? parsed : new Date()
}

function defaultForm(date: Date): RunFormValues {
  const next = new Date(date)
  if (next.getHours() === 0 && next.getMinutes() === 0 && next.getTime() > Date.now()) next.setHours(18, 0, 0, 0)
  if (next.getTime() <= Date.now()) next.setTime(Date.now() + 60 * 60 * 1000)
  next.setMinutes(Math.ceil(next.getMinutes() / 15) * 15, 0, 0)
  return { title: 'Easy run', dateTime: toLocalDateTime(next), meetingPoint: '', distance: '', pace: '', notes: '', repeatWeeks: 1 }
}

function editForm(plan: PlannedRun): RunFormValues {
  return {
    title: plan.title,
    dateTime: toLocalDateTime(new Date(plan.startsAt)),
    meetingPoint: plan.meetingPoint,
    distance: plan.distanceKm === null ? '' : String(plan.distanceKm),
    pace: plan.paceSecondsPerKm === null ? '' : formatPace(plan.paceSecondsPerKm).replace('/km', ''),
    notes: plan.notes,
    repeatWeeks: 1,
  }
}

function RunCard({ plan, userId, busy, onJoin, onEdit, onCancel }: {
  plan: PlannedRun
  userId: string
  busy: boolean
  onJoin: (plan: PlannedRun, joining: boolean) => void
  onEdit: (plan: PlannedRun) => void
  onCancel: (plan: PlannedRun) => void
}) {
  const owner = plan.createdBy === userId
  const joined = plan.attendees.some((person) => person.userId === userId)
  const upcoming = new Date(plan.startsAt).getTime() > Date.now()
  const shareUrl = shareRunUrl(plan, window.location.origin)
  const shareText = 'I have a run planned in our RunningLeague group on ' +
    longDateFormat.format(new Date(plan.startsAt)) + ' at ' + timeFormat.format(new Date(plan.startsAt)) +
    '. Fancy joining? ' + shareUrl
  const shareLink = 'https://wa.me/?text=' + encodeURIComponent(shareText)

  return <article className="run-plan-card" id={'run-plan-' + plan.id}>
    <div className="run-plan-card-top">
      <div><span className="run-plan-card-time"><Clock3 size={15} /> {timeFormat.format(new Date(plan.startsAt))}</span>
        <h4>{plan.title}</h4><span className="run-plan-host">Planned by {owner ? 'you' : plan.hostName}</span>
      </div>
      {plan.seriesId && <span className="run-plan-recurring">Weekly series</span>}
    </div>
    <div className="run-plan-details">
      <span><MapPin size={15} /> {plan.meetingPoint}</span>
      <span><Route size={15} /> {plan.distanceKm === null ? 'Flexible distance' : plan.distanceKm + ' km'}</span>
      <span><Clock3 size={15} /> {formatPace(plan.paceSecondsPerKm)}</span>
    </div>
    {plan.notes && <p className="run-plan-notes">{plan.notes}</p>}
    <div className="run-plan-attendees"><Users size={16} />
      <span><strong>{plan.attendees.length} {plan.attendees.length === 1 ? 'runner' : 'runners'}</strong>
        {plan.attendees.length > 0 && <small>{plan.attendees.map((person) => person.userId === userId ? 'You' : person.name).join(', ')}</small>}
      </span>
    </div>
    <div className="run-plan-actions">
      {upcoming && !owner && <button type="button" className={joined ? 'button button-outline button-small' : 'button button-primary button-small'} disabled={busy} onClick={() => onJoin(plan, !joined)}>{joined ? 'Leave run' : 'Join run'}</button>}
      {upcoming && owner && <button type="button" className="button button-outline button-small" disabled={busy} onClick={() => onEdit(plan)}><Edit3 size={14} /> Edit</button>}
      {owner && <button type="button" className="button button-outline button-small run-plan-delete" disabled={busy} onClick={() => onCancel(plan)}><Trash2 size={14} /> Cancel</button>}
      <a className="button button-outline button-small" href={shareLink} target="_blank" rel="noopener noreferrer" aria-label={'Share ' + plan.title + ' to WhatsApp'}><Share2 size={14} /> WhatsApp</a>
    </div>
  </article>
}

function RunForm({ form, setForm, editing, onClose, onSubmit, busy, error }: {
  form: RunFormValues
  setForm: (form: RunFormValues) => void
  editing: boolean
  onClose: () => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
  busy: boolean
  error: string
}) {
  useEffect(() => {
    const onEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', onEscape)
    return () => window.removeEventListener('keydown', onEscape)
  }, [onClose])

  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}>
    <section className="modal run-plan-modal" role="dialog" aria-modal="true" aria-label={editing ? 'Edit planned run' : 'Plan a run'}>
      <header><h2>{editing ? 'Edit planned run' : 'Plan a run'}</h2><button aria-label="Close run form" onClick={onClose}><X /></button></header>
      <form className="modal-form" onSubmit={onSubmit}>
        <p>Only members of this private league can see your meeting point and join your run.</p>
        <label>Run name<input required minLength={2} maxLength={100} value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} autoFocus placeholder="e.g. Tuesday evening 8K" /></label>
        <label>Date and time<input type="datetime-local" required value={form.dateTime} onChange={(event) => setForm({ ...form, dateTime: event.target.value })} /></label>
        <label>Where are you meeting?<input required minLength={2} maxLength={200} value={form.meetingPoint} onChange={(event) => setForm({ ...form, meetingPoint: event.target.value })} placeholder="e.g. Stratford Recreation Ground entrance" /></label>
        <div className="form-grid two">
          <label>Distance (km, optional)<input type="number" min="0.1" max="200" step="0.1" placeholder="Flexible" value={form.distance} onChange={(event) => setForm({ ...form, distance: event.target.value })} /></label>
          <label>Pace (min/km, optional)<input inputMode="numeric" placeholder="e.g. 5:30" value={form.pace} onChange={(event) => setForm({ ...form, pace: event.target.value })} /></label>
        </div>
        {!editing && <label>Repeat<select value={form.repeatWeeks} onChange={(event) => setForm({ ...form, repeatWeeks: Number(event.target.value) as 1 | 4 | 8 })}>
          <option value={1}>Just this run</option><option value={4}>Every week for 4 weeks</option><option value={8}>Every week for 8 weeks</option>
        </select></label>}
        {editing && <p className="run-plan-help">Changes to a weekly series apply to this date only.</p>}
        <label>Anything else? (optional)<textarea maxLength={1000} rows={3} value={form.notes} onChange={(event) => setForm({ ...form, notes: event.target.value })} placeholder="Easy conversational pace, loops or route notes…" /></label>
        {error && <div className="notice error" role="alert">{error}</div>}
        <button className="button button-primary button-full" type="submit" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add to group calendar'}</button>
      </form>
    </section>
  </div>
}

export default function RunPlansPage() {
  const { user } = useAuth()
  const { leagues, loading: leaguesLoading } = usePlatform()
  const parameters = useMemo(() => new URLSearchParams(window.location.search), [])
  const [selectedId, setSelectedId] = useState(() => parameters.get('league') ?? '')
  const [view, setView] = useState<RunPlansView>(() => parameters.has('run') ? 'day' : 'week')
  const [anchor, setAnchor] = useState<Date>(initialDate)
  const [plans, setPlans] = useState<PlannedRun[]>([])
  const requestVersion = useRef(0)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState<PlannedRun | null>(null)
  const [form, setForm] = useState<RunFormValues>(() => defaultForm(new Date()))
  const selectedLeague = leagues.find((league) => league.id === selectedId) ?? leagues[0]
  const range = useMemo(() => viewRange(view, anchor), [view, anchor])
  const days = useMemo(() => calendarDays(range.start, range.end), [range])
  const grouped = useMemo(() => {
    const groups: Record<string, PlannedRun[]> = {}
    for (const plan of plans) {
      const key = dateKey(new Date(plan.startsAt))
      if (!groups[key]) groups[key] = []
      groups[key].push(plan)
    }
    return groups
  }, [plans])

  const reload = useCallback(async () => {
    const version = ++requestVersion.current
    if (!user || !selectedLeague) { setPlans([]); setLoading(false); return }
    setLoading(true)
    setError('')
    try {
      const next = await listPlannedRuns(user, selectedLeague.id, range)
      if (requestVersion.current === version) setPlans(next)
    } catch (caught) {
      if (requestVersion.current === version) {
        setError(caught instanceof Error ? caught.message : 'Could not load planned runs.')
        setPlans([])
      }
    } finally {
      if (requestVersion.current === version) setLoading(false)
    }
  }, [user, selectedLeague, range])

  useEffect(() => { void reload() }, [reload])

  const openAdd = (date = new Date()) => {
    setEditing(null)
    setForm(defaultForm(date))
    setError('')
    setShowForm(true)
  }
  const openEdit = (plan: PlannedRun) => {
    setEditing(plan)
    setForm(editForm(plan))
    setError('')
    setShowForm(true)
  }
  const submitRun = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!user || !selectedLeague) return
    setBusy(true); setError(''); setNotice('')
    try {
      const draft: RunDraft = {
        leagueId: selectedLeague.id,
        title: form.title,
        startsAtLocal: form.dateTime,
        meetingPoint: form.meetingPoint,
        distanceKm: form.distance.trim() ? Number(form.distance) : null,
        paceSecondsPerKm: parsePace(form.pace),
        notes: form.notes,
        repeatWeeks: form.repeatWeeks,
      }
      if (editing) await updatePlannedRun(user, editing, draft)
      else await createPlannedRuns(user, draft)
      setShowForm(false)
      setEditing(null)
      setNotice(editing ? 'Run updated.' : form.repeatWeeks > 1 ? 'Weekly runs added to the calendar.' : 'Run added to the calendar.')
      setAnchor(new Date(form.dateTime))
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not save the run.') }
    finally { setBusy(false) }
  }
  const handleJoin = async (plan: PlannedRun, joining: boolean) => {
    if (!user) return
    setBusy(true); setError(''); setNotice('')
    try {
      await setRunAttendance(user, plan, joining)
      await reload()
      setNotice(joining ? 'You are joining this run.' : 'You have left this run.')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not update attendance.') }
    finally { setBusy(false) }
  }
  const handleCancel = async (plan: PlannedRun) => {
    if (!user || !window.confirm(plan.seriesId ? 'Cancel this date only? Other weeks will remain.' : 'Cancel this planned run?')) return
    setBusy(true); setError(''); setNotice('')
    try { await deletePlannedRun(user, plan); await reload(); setNotice('Planned run cancelled.') }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Could not cancel the run.') }
    finally { setBusy(false) }
  }
  const card = (plan: PlannedRun) => <RunCard key={plan.id} plan={plan} userId={user?.id ?? ''} busy={busy} onJoin={handleJoin} onEdit={openEdit} onCancel={handleCancel} />
  const headerLabel = view === 'month'
    ? new Intl.DateTimeFormat('en-GB', { month: 'long', year: 'numeric' }).format(anchor)
    : view === 'week' ? dateFormat.format(range.start) + ' – ' + dateFormat.format(new Date(range.end.getTime() - 1)) + ' ' + range.start.getFullYear()
      : longDateFormat.format(anchor)
  const highlightId = parameters.get('run')

  return <div className="app-page run-plans-page">
    <div className="page-intro"><div><span className="eyebrow">YOUR PEOPLE · YOUR PACE</span>
      <h2>Run Plans</h2><p>See when friends are running this week. Add your plans and let others join you.</p></div>
      {selectedLeague && <button className="button button-primary" onClick={() => openAdd()}><Plus size={17} /> Plan a run</button>}
    </div>
    {!leaguesLoading && leagues.length === 0 ? <section className="panel run-plans-empty">
      <Users size={35} /><h3>Start with a private league</h3>
      <p>Run Plans are shared with members of your league, not the public. Create one or join your friends with an invite code.</p>
      <a href="/app/leagues" className="button button-primary">Go to leagues</a>
    </section> : <>
      <section className="run-plans-toolbar panel" aria-label="Run planning controls">
        <label className="run-plans-league-select">Group
          <select value={selectedLeague?.id ?? ''} onChange={(event) => { setSelectedId(event.target.value); setNotice('') }}>
            {leagues.map((league) => <option key={league.id} value={league.id}>{league.name}</option>)}
          </select>
        </label>
        <div className="run-plans-view-toggle" aria-label="Calendar view">
          {(['day', 'week', 'month'] as const).map((option) => <button key={option} type="button" aria-pressed={view === option} className={view === option ? 'active' : ''} onClick={() => setView(option)}>{option.charAt(0).toUpperCase() + option.slice(1)}</button>)}
        </div>
        <div className="run-plans-calendar-nav">
          <button type="button" aria-label={'Previous ' + view} onClick={() => setAnchor(shiftView(view, anchor, -1))}><ChevronLeft size={18} /></button>
          <strong>{headerLabel}</strong>
          <button type="button" aria-label={'Next ' + view} onClick={() => setAnchor(shiftView(view, anchor, 1))}><ChevronRight size={18} /></button>
          <button type="button" className="run-plans-today" onClick={() => setAnchor(new Date())}>Today</button>
          <button type="button" aria-label="Refresh Run Plans" onClick={() => void reload()}><RefreshCw size={16} /></button>
        </div>
      </section>
      {!leaguesLoading && <p className="run-plans-private"><Users size={14} /> Only members of {selectedLeague?.name ?? 'your group'} can see these plans. {!supabase && 'Demo mode: runs are saved only in this browser.'}</p>}
      {notice && <div className="notice success" role="status">{notice}</div>}
      {error && !showForm && <div className="notice error" role="alert">{error}</div>}
      {loading || leaguesLoading ? <section className="panel run-plans-loading">Loading your group calendar…</section>
        : view === 'month'
          ? <div className="run-plans-month-wrap panel">
            <div className="run-plans-weekdays">{['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => <span key={day}>{day}</span>)}</div>
            <div className="run-plans-month-grid">{days.map((day) => {
              const runs = grouped[dateKey(day)] ?? []
              const outside = day.getMonth() !== anchor.getMonth()
              return <button type="button" key={dateKey(day)}
                className={'run-plans-month-day' + (outside ? ' outside' : '') + (dateKey(day) === dateKey(new Date()) ? ' today' : '')}
                aria-label={longDateFormat.format(day) + ', ' + runs.length + ' planned runs'}
                onClick={() => { setAnchor(day); setView('day') }}>
                <span>{day.getDate()}</span>
                {runs.slice(0, 2).map((run) => <small key={run.id}>{timeFormat.format(new Date(run.startsAt))} {run.title}</small>)}
                {runs.length > 2 && <em>+{runs.length - 2} more</em>}
              </button>
            })}</div>
          </div>
          : <div className={view === 'week' ? 'run-plans-week-grid' : 'run-plans-day-grid'}>{days.map((day) => {
            const runs = grouped[dateKey(day)] ?? []
            return <section className="run-plans-day panel" key={dateKey(day)} aria-label={longDateFormat.format(day)}>
              <header><div><span>{new Intl.DateTimeFormat('en-GB', { weekday: 'short' }).format(day)}</span><strong>{day.getDate()}</strong></div>
                <small>{runs.length ? runs.length + (runs.length === 1 ? ' run' : ' runs') : 'No runs planned'}</small></header>
              <div className="run-plans-day-content">{runs.length
                ? runs.map((plan) => <div className={plan.id === highlightId ? 'run-plans-highlight' : ''} key={plan.id}>{card(plan)}</div>)
                : <p className="run-plans-no-runs">Nothing planned yet.</p>}
              </div>
              {day.getTime() + 86400000 > Date.now() && <button type="button" className="run-plans-day-add" onClick={() => openAdd(day)}><Plus size={14} /> Add a run</button>}
            </section>
          })}</div>}
      {plans.length === 0 && !loading && !error && <p className="run-plans-footnote"><CalendarDays size={16} /> No runs scheduled in this view yet. Add one to get everyone moving.</p>}
    </>}
    {showForm && <RunForm form={form} setForm={setForm} editing={Boolean(editing)} onClose={() => { if (!busy) { setShowForm(false); setError('') } }} onSubmit={submitRun} busy={busy} error={error} />}
  </div>
}
