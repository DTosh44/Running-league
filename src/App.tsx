import { weeklyScoringRuns } from './scoring'
import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  Footprints,
  Gauge,
  Home,
  LockKeyhole,
  LogOut,
  Medal,
  Menu,
  Mountain,
  Plus,
  RefreshCw,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Upload,
  UserPlus,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { demoCredentials, useAuth } from './auth'
import { leagueMembers } from './data'
import { importActivityFile } from './activity-import'
import { usePlatform } from './platform'
import { supabase } from './supabase'
import { defaultPlanAnswers, generateTrainingPlan, parseDuration, weekdays } from './planner'
import { formatPace, leagueRules, scoringConfig, scoringVersion } from './scoring'
import type { ActivityRecord, LeagueTableEntry, PlanAnswers, TrainingPlan } from './types'

export function navigate(path: string) {
  window.history.pushState({}, '', path)
  window.dispatchEvent(new PopStateEvent('popstate'))
  window.scrollTo({ top: 0, behavior: 'smooth' })
}

function usePath() {
  const [path, setPath] = useState(() => window.location.pathname)
  useEffect(() => {
    const handleChange = () => setPath(window.location.pathname)
    window.addEventListener('popstate', handleChange)
    return () => window.removeEventListener('popstate', handleChange)
  }, [])
  return path
}

function AppLink({ to, className, children, onClick }: { to: string; className?: string; children: ReactNode; onClick?: () => void }) {
  return <a href={to} className={className} onClick={(event) => { if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return; event.preventDefault(); onClick?.(); navigate(to) }}>{children}</a>
}

function Logo({ inverse = false, compact = false }: { inverse?: boolean; compact?: boolean }) {
  return <span className={`brand${inverse ? ' brand-inverse' : ''}`} aria-label="RunningLeague">
    <span className="brand-mark"><span /><span /><span /></span>
    {!compact && <span className="brand-name"><strong>RUNNING</strong><em>LEAGUE</em></span>}
  </span>
}

function Avatar({ initials, colour = '#1646d8', size = 'medium' }: { initials: string; colour?: string; size?: 'small' | 'medium' | 'large' }) {
  return <span className={`avatar avatar-${size}`} style={{ background: colour }}>{initials}</span>
}

function ScoreDisc({ score, size = 'medium' }: { score: number; size?: 'small' | 'medium' | 'large' }) {
  return <span className={`score-disc score-${size}`} style={{ '--score-progress': `${score / 25 * 360}deg` } as React.CSSProperties}>
    <span><strong>{score}</strong><small>/25</small></span>
  </span>
}

function PublicHeader() {
  const [open, setOpen] = useState(false)
  const goTo = (id: string) => {
    setOpen(false)
    if (window.location.pathname !== '/') {
      navigate(`/#${id}`)
      window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' }), 50)
    } else {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' })
    }
  }
  return <header className="public-header">
    <div className="public-nav page-width">
      <AppLink to="/" className="logo-link"><Logo /></AppLink>
      <button className="menu-toggle" aria-label="Toggle navigation" onClick={() => setOpen((value) => !value)}>{open ? <X /> : <Menu />}</button>
      <nav className={open ? 'public-links open' : 'public-links'} aria-label="Main navigation">
        <button onClick={() => goTo('how-it-works')}>How it works</button>
        <button onClick={() => goTo('leagues')}>Leagues</button>
        <button onClick={() => goTo('training')}>Training plans</button>
        <AppLink to="/login" onClick={() => setOpen(false)}>Log in</AppLink>
        <AppLink to="/signup" className="button button-primary button-small" onClick={() => setOpen(false)}>Join the league <ArrowRight size={15} /></AppLink>
      </nav>
    </div>
  </header>
}

function HeroProductCard() {
  return <div className="hero-product-card" aria-label="RunningLeague dashboard preview">
    <div className="product-window-bar"><span /><span /><span /><small>THIS WEEK</small></div>
    <div className="product-preview-body">
      <div className="preview-score-block">
        <div><small>Your weekly score</small><strong>61</strong><span>3 runs counted</span></div>
        <ScoreDisc score={23} size="large" />
      </div>
      <div className="preview-progress"><span style={{ width: '81%' }} /><i>81%</i></div>
      <div className="preview-run">
        <span className="icon-tile"><Zap size={18} /></span>
        <div><strong>Tuesday intervals</strong><small>6.42 km · 92 m climbing</small></div>
        <b>23</b>
      </div>
      <div className="preview-run">
        <span className="icon-tile pale"><Route size={18} /></span>
        <div><strong>Sunday long run</strong><small>16.18 km · 1:31:34</small></div>
        <b>20</b>
      </div>
      <div className="preview-league">
        <span><Trophy size={17} /> North London Ten</span><strong>#2 <small>↑ 2</small></strong>
      </div>
    </div>
    <span className="hero-float-card float-left"><strong>+4</strong><small>interval uplift</small></span>
    <span className="hero-float-card float-right"><span className="avatar-stack"><Avatar initials="MS" size="small" colour="#6b4eff" /><Avatar initials="JB" size="small" colour="#6370a7" /><Avatar initials="RE" size="small" colour="#876be8" /></span><small>8 friends running</small></span>
  </div>
}

function PublicHome() {
  return <div className="public-site">
    <PublicHeader />
    <main>
      <section className="hero-section">
        <div className="hero-grid page-width">
          <div className="hero-copy">
            <span className="eyebrow"><span /> Fair competition for every runner</span>
            <h1>Every run gets a score.<br /><em>Every runner can compete.</em></h1>
            <p>RunningLeague turns pace, distance and climbing into one simple score. Build consistency, race your friends and see progress that ordinary leaderboards miss.</p>
            <div className="hero-actions">
              <AppLink to="/signup" className="button button-primary">Start running free <ArrowRight size={18} /></AppLink>
              <button className="text-button" onClick={() => document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })}>See how scoring works <ChevronRight size={17} /></button>
            </div>
            <div className="hero-proof">
              <span className="avatar-stack"><Avatar initials="MS" size="small" colour="#6b4eff" /><Avatar initials="JB" size="small" colour="#6370a7" /><Avatar initials="RE" size="small" colour="#876be8" /><Avatar initials="OG" size="small" colour="#2d63da" /></span>
              <span><strong>Made for real runners</strong><small>Fast, steady, hilly or just getting started.</small></span>
            </div>
          </div>
          <div className="hero-visual"><div className="hero-grid-lines" /><HeroProductCard /></div>
        </div>
      </section>

      <section className="statement-strip">
        <div className="page-width"><span>5K specialists</span><i /> <span>Sunday long runners</span><i /> <span>Comeback runners</span><i /> <span>Hill lovers</span><i /> <span>First-time racers</span></div>
      </section>

      <section className="how-section page-width" id="how-it-works">
        <header className="section-heading centred"><span className="eyebrow">ONE SCORE. DIFFERENT RUNS.</span><h2>A fairer way to compare effort.</h2><p>A flat 5K and a hilly ten-miler should not be judged by pace alone. RunningScore considers the whole run.</p></header>
        <div className="feature-grid three">
          <article className="feature-card"><span className="feature-number">01</span><span className="feature-icon"><Upload /></span><h3>Bring in your run</h3><p>Upload a GPX or FIT file, or enter a run manually.</p><small>Distance · elapsed time · elevation</small></article>
          <article className="feature-card feature-card-dark"><span className="feature-number">02</span><span className="feature-icon"><Gauge /></span><h3>We score the effort</h3><p>Elapsed time keeps the full activity honest. Climbing and interval detail make unlike runs comparable.</p><small>{scoringVersion} · 1–25 points</small></article>
          <article className="feature-card"><span className="feature-number">03</span><span className="feature-icon"><Trophy /></span><h3>Your best runs count</h3><p>Up to three scoring runs a week rewards consistency without making the league a mileage contest.</p><small>Best {leagueRules.countedWeeks} of {leagueRules.seasonWeeks} weeks</small></article>
        </div>
        <div className="score-demo-band">
          <div><span className="eyebrow light">A SCORE YOU CAN UNDERSTAND</span><h3>Strong run. <em>21 points.</em></h3><p>Based on a 7.8 km run with 126 m of climbing, including a fast interval block.</p></div>
          <div className="score-demo-scale"><span>1</span><div>{Array.from({ length: 25 }, (_, index) => <i key={index} className={index < 21 ? 'filled' : ''} />)}</div><span>25</span><small><b>Gentle</b><b>Solid</b><b>Peak</b></small></div>
          <AppLink to="/signup" className="button button-light">Try your first score <ArrowRight size={17} /></AppLink>
        </div>
      </section>

      <section className="league-section" id="leagues">
        <div className="page-width league-showcase">
          <div className="league-table-preview">
            <div className="mini-table-header"><span>North London Ten</span><small>WEEK 6 OF 10</small></div>
            {leagueMembers.slice(0, 5).map((member, index) => <div className={member.name === 'Darren Tosh' ? 'mini-member current' : 'mini-member'} key={member.id}>
              <b>{index + 1}</b><Avatar initials={member.initials} colour={member.colour} size="small" /><span><strong>{member.name}</strong><small>{member.runs}/3 runs</small></span><em>{member.weeklyPoints} pts</em>
            </div>)}
          </div>
          <div className="league-copy"><span className="eyebrow light">RUN TOGETHER. COMPETE FAIRLY.</span><h2>Your people.<br />Your league.</h2><p>Create a private league, invite your friends and turn an ordinary week of running into something everyone follows.</p><ul><li><Check size={17} /> Equal weekly scoring allowance</li><li><Check size={17} /> Weekly and season tables</li><li><Check size={17} /> Invite friends with a league code</li><li><Check size={17} /> Clear activity checks</li></ul><AppLink to="/signup" className="button button-light">Create a league <ArrowRight size={17} /></AppLink></div>
        </div>
      </section>

      <section className="training-section page-width" id="training">
        <div className="training-copy"><span className="eyebrow">TRAIN FOR SOMETHING</span><h2>A plan that fits around your week.</h2><p>Choose your race, date, target and available days. RunningLeague builds a progressive schedule around the time you actually have.</p><div className="question-chips"><span><Target size={16} /> Race goal</span><span><CalendarDays size={16} /> Best days</span><span><Clock3 size={16} /> Target time</span><span><Activity size={16} /> Current fitness</span></div><AppLink to="/signup" className="button button-primary">Build my race plan <ArrowRight size={17} /></AppLink></div>
        <div className="training-card-preview">
          <div className="training-card-top"><span><small>YOUR PLAN</small><strong>10K in 49:30</strong></span><b>8 weeks</b></div>
          <div className="week-label"><span>Week 3</span><small>BUILD CONSISTENCY · 24 KM</small></div>
          {[['TUE', 'Intervals', '6 × 2 min controlled hard'], ['THU', 'Easy run', '6 km · conversational'], ['SUN', 'Long run', '11 km · relaxed']].map(([day, name, detail], index) => <div className="plan-row" key={day}><span>{day}</span><i className={`session-line line-${index + 1}`} /><div><strong>{name}</strong><small>{detail}</small></div><Check size={17} /></div>)}
          <div className="plan-note"><Sparkles size={16} /><span>Plan adjusts to your goal, experience and preferred training days.</span></div>
        </div>
      </section>

      <section className="closing-cta"><div className="page-width"><span className="eyebrow light">YOUR NEXT RUN COUNTS</span><h2>Make running more fun<br />from the very first week.</h2><AppLink to="/signup" className="button button-light">Join RunningLeague <ArrowRight size={18} /></AppLink></div></section>
    </main>
    <footer className="public-footer"><div className="page-width"><Logo inverse /><p>Fair competition for every kind of runner.</p><nav><button onClick={() => document.getElementById('how-it-works')?.scrollIntoView()}>Scoring</button><button onClick={() => document.getElementById('leagues')?.scrollIntoView()}>Leagues</button><button onClick={() => document.getElementById('training')?.scrollIntoView()}>Plans</button><AppLink to="/privacy">Privacy</AppLink><AppLink to="/terms">Terms</AppLink><AppLink to="/login">Log in</AppLink></nav><small>© 2026 RunningLeague. Free public beta.</small></div></footer>
  </div>
}

function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { signIn, signUp, sendPasswordReset, cloudConfigured } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [resetMode, setResetMode] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setMessage('')
    setBusy(true)
    try {
      if (resetMode) {
        await sendPasswordReset(email)
        setMessage('Check your inbox for a secure password-reset link.')
      } else if (mode === 'signup') {
        const result = await signUp(name, email, password)
        if (result === 'verify-email') setMessage('Account created. Check your inbox and confirm your email to continue.')
        else navigate('/app')
      } else {
        await signIn(email, password)
        navigate('/app')
      }
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const useDemo = () => {
    setEmail(demoCredentials.email)
    setPassword(demoCredentials.password)
    setError('')
  }

  return <div className="auth-page">
    <div className="auth-brand-panel">
      <AppLink to="/"><Logo inverse /></AppLink>
      <div><span className="eyebrow light">EVERY RUN COUNTS</span><h1>{mode === 'login' ? 'Pick up where you left off.' : 'Your running gets more interesting here.'}</h1><p>Score your effort, compete with friends and train for what comes next.</p></div>
      <div className="auth-testimonial"><div className="avatar-stack"><Avatar initials="MS" size="small" colour="#6b4eff" /><Avatar initials="JB" size="small" colour="#6370a7" /><Avatar initials="RE" size="small" colour="#876be8" /></div><p>“It finally gives our mixed-pace group a league that feels fair.”</p><small>North London Ten · Demo league</small></div>
    </div>
    <main className="auth-form-panel">
      <div className="auth-mobile-logo"><AppLink to="/"><Logo /></AppLink></div>
      <form className="auth-form" onSubmit={submit}>
        <span className="auth-icon"><LockKeyhole /></span>
        <h2>{resetMode ? 'Reset your password' : mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p>{resetMode ? 'We’ll email you a secure link to choose a new password.' : mode === 'login' ? 'Log in to see your runs, leagues and training plan.' : 'Join the free beta and start your first league.'}</p>
        {mode === 'signup' && !resetMode && <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>}
        <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
        {!resetMode && <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /></label>}
        {error && <div className="form-error" role="alert">{error}</div>}
        {message && <div className="form-success" role="status"><CheckCircle2 size={18} />{message}</div>}
        <button className="button button-primary button-full" disabled={busy || Boolean(message)}>{busy ? 'Please wait…' : resetMode ? 'Send reset link' : mode === 'login' ? 'Log in' : 'Create free account'} <ArrowRight size={17} /></button>
        {mode === 'login' && !resetMode && <button type="button" className="forgot-link" onClick={() => { setResetMode(true); setError(''); setMessage('') }}>Forgot your password?</button>}
        {resetMode && <button type="button" className="forgot-link" onClick={() => { setResetMode(false); setError(''); setMessage('') }}>Back to log in</button>}
        {mode === 'login' && !resetMode && !cloudConfigured && (import.meta.env.DEV || import.meta.env.MODE === 'test') && <div className="demo-login"><span><strong>Demo account</strong><small>{demoCredentials.email} · {demoCredentials.password}</small></span><button type="button" onClick={useDemo}>Use demo</button></div>}
        {!resetMode && <><div className="auth-switch">{mode === 'login' ? <>New to RunningLeague? <AppLink to="/signup">Create an account</AppLink></> : <>Already have an account? <AppLink to="/login">Log in</AppLink></>}</div>{mode === 'signup' && <small className="legal-consent">By creating an account you agree to our <AppLink to="/terms">Terms</AppLink> and <AppLink to="/privacy">Privacy Policy</AppLink>.</small>}</>}
      </form>
    </main>
  </div>
}

const appNavigation = [
  { path: '/app', label: 'Overview', icon: Home },
  { path: '/app/leagues', label: 'Leagues', icon: Trophy },
  { path: '/app/activities', label: 'Activities', icon: Activity },
  { path: '/app/plan', label: 'Training plan', icon: CalendarCheck },
  { path: '/app/profile', label: 'Profile', icon: Users },
]

function AppShell({ path, children }: { path: string; children: ReactNode }) {
  const { user, signOut } = useAuth()
  const { leagues, error: dataError, refresh } = usePlatform()
  const [mobileOpen, setMobileOpen] = useState(false)
  const [openedAt] = useState(() => Date.now())
  const title = appNavigation.find((item) => item.path === path)?.label ?? 'RunningLeague'
  const logout = () => { void signOut().then(() => navigate('/')) }
  return <div className="app-layout">
    <aside className={mobileOpen ? 'app-sidebar open' : 'app-sidebar'}>
      <div className="sidebar-top"><AppLink to="/app" onClick={() => setMobileOpen(false)}><Logo inverse /></AppLink><button onClick={() => setMobileOpen(false)} aria-label="Close menu"><X /></button></div>
      <nav aria-label="Member navigation">{appNavigation.map((item) => { const Icon = item.icon; return <AppLink key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className={path === item.path ? 'active' : ''}><Icon size={19} /><span>{item.label}</span>{item.path === '/app/leagues' && leagues.length > 0 && <small>{leagues.length}</small>}</AppLink> })}</nav>
      <div className="sidebar-league"><span>{leagues.length ? 'ACTIVE LEAGUE' : 'LEAGUES'}</span><strong><span className="league-badge"><Trophy size={16} /></span>{leagues[0]?.name ?? 'Create your first'}</strong><small>{leagues[0] ? `${leagues[0].seasonWeeks}-week season` : 'Compete with friends'}</small><div><i style={{ width: leagues[0] ? `${Math.min(100, Math.max(0, (openedAt - new Date(leagues[0].createdAt).getTime()) / (leagues[0].seasonWeeks * 7 * 86400000) * 100))}%` : '0%' }} /></div></div>
      <div className="sidebar-user"><Avatar initials={user?.initials ?? 'RL'} colour="#6b4eff" /><span><strong>{user?.name}</strong><small>{user?.email}</small></span><button aria-label="Log out" onClick={logout}><LogOut size={17} /></button></div>
    </aside>
    {mobileOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
    <section className="app-main">
      <header className="app-topbar"><button className="app-menu-button" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu /></button><div><span>RUNNINGLEAGUE</span><h1>{title}</h1></div><div className="topbar-actions"><button className="button button-outline button-small" onClick={() => navigate('/app/activities')}><Plus size={16} /> Add a run</button><Avatar initials={user?.initials ?? 'RL'} colour="#1646d8" /></div></header>
      {dataError && <div className="notice error" role="alert">{dataError} <button onClick={() => void refresh()}>Retry</button></div>}
      {children}
    </section>
  </div>
}

function StatCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return <article className="stat-card"><span className="stat-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong><span>{detail}</span></div></article>
}

function EmptyState({ title, text, action, onAction }: { title: string; text: string; action?: string; onAction?: () => void }) {
  return <div className="empty-state"><span className="empty-icon"><Footprints /></span><h4>{title}</h4><p>{text}</p>{action && onAction && <button className="button button-outline button-small" onClick={onAction}>{action}</button>}</div>
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const close = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [onClose])
  return <div className="modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose() }}><section className="modal" role="dialog" aria-modal="true" aria-label={title}><header><h2>{title}</h2><button aria-label="Close" onClick={onClose}><X /></button></header>{children}</section></div>
}

function ActivityRow({ activity, onOpen }: { activity: ActivityRecord; onOpen?: () => void }) {
  return <button className="activity-row" onClick={onOpen}>
    <span className="activity-type-icon">{activity.score.intervalUplift ? <Zap size={18} /> : <Footprints size={18} />}</span>
    <span className="activity-main"><strong>{activity.name}</strong><small>{activity.date} · {activity.location}</small></span>
    <span className="activity-metric"><strong>{activity.distanceKm.toFixed(1)} km</strong><small>{formatPace(activity.elapsedSeconds / activity.distanceKm)}</small></span>
    <ScoreDisc score={activity.score.points} size="small" />
    <ChevronRight size={17} className="row-chevron" />
  </button>
}

function DashboardPage() {
  const { user } = useAuth()
  const { activities, leagues, plan } = usePlatform()
  const scoringRuns = weeklyScoringRuns(activities, leagueRules.scoringRunsPerWeek)
  const weeklyScore = scoringRuns.reduce((sum, run) => sum + run.score.points, 0)
  const bestRun = scoringRuns[0]
  return <div className="app-page dashboard-page">
    <div className="welcome-row"><div><span className="eyebrow">YOUR RUNNING WEEK</span><h2>Welcome, {user?.name.split(' ')[0]}.</h2><p>{leagues.length ? 'One strong run could change your league position this week.' : 'Add a run or create a league to get started.'}</p></div><button className="button button-primary" onClick={() => navigate('/app/activities')}><Upload size={17} /> Add an activity</button></div>
    <div className="stats-grid">
      <StatCard label="Weekly score" value={`${weeklyScore} pts`} detail={`${scoringRuns.length} of ${leagueRules.scoringRunsPerWeek} scoring runs`} icon={<Gauge />} />
      <StatCard label="Leagues" value={String(leagues.length)} detail={leagues.length ? 'Private leagues joined' : 'Create or join your first'} icon={<Trophy />} />
      <StatCard label="Activities" value={String(activities.length)} detail="Runs in your history" icon={<Activity />} />
      <StatCard label="Race plan" value={plan ? plan.answers.raceDistance : 'Not set'} detail={plan ? `${plan.weeks.length} weeks · target ${plan.answers.targetTime}` : 'Build a plan around your week'} icon={<Target />} />
    </div>
    <div className="dashboard-grid">
      <section className="panel weekly-panel"><header className="panel-header"><div><span className="eyebrow">YOUR WEEK</span><h3>Scoring runs</h3></div><button onClick={() => navigate('/app/activities')}>All activities <ArrowRight size={15} /></button></header>{bestRun ? <><div className="weekly-score-line"><ScoreDisc score={bestRun.score.points} size="large" /><div><span>Your best score</span><strong>{bestRun.score.band}</strong><small>{bestRun.name}{bestRun.score.intervalUplift ? ` · +${bestRun.score.intervalUplift} interval uplift` : ''}</small></div><div className="run-slots">{Array.from({ length: leagueRules.scoringRunsPerWeek }, (_, index) => <span className={index < scoringRuns.length ? 'filled' : ''} key={index}>{index < scoringRuns.length && <Check size={14} />} {index + 1}</span>)}</div></div>{scoringRuns.map((activity) => <ActivityRow activity={activity} key={activity.id} onOpen={() => navigate('/app/activities')} />)}</> : <EmptyState title="No runs yet" text="Add a run manually or import a GPX/FIT file to calculate your first score." action="Add an activity" onAction={() => navigate('/app/activities')} />}</section>
      <section className="panel league-panel"><header className="panel-header"><div><span className="eyebrow">PRIVATE LEAGUES</span><h3>{leagues[0]?.name ?? 'Your league table'}</h3></div><button onClick={() => navigate('/app/leagues')}>Open leagues <ArrowRight size={15} /></button></header>{leagues.length ? <><div className="leaderboard-list">{user && <div className="leaderboard-row current"><b>—</b><Avatar initials={user.initials} colour="#1646d8" size="small" /><span><strong>{user.name}</strong><small>{scoringRuns.length}/{leagueRules.scoringRunsPerWeek} runs</small></span><em>{weeklyScore}</em></div>}</div><div className="league-deadline"><Clock3 size={17} /><span><strong>Weekly scoring</strong><small>Your best {leagueRules.scoringRunsPerWeek} runs count</small></span></div></> : <EmptyState title="No leagues yet" text="Create a private league or join one with an invite code." action="Go to leagues" onAction={() => navigate('/app/leagues')} />}</section>
      <section className="panel plan-prompt"><div><span className="feature-icon"><CalendarCheck /></span><span className="eyebrow">RACE READY</span><h3>Build a plan that works on your days.</h3><p>Choose your distance, target and available days. We’ll shape the weeks for you.</p><button className="button button-primary" onClick={() => navigate('/app/plan')}>Create my plan <ArrowRight size={17} /></button></div><div className="mini-calendar"><span>M</span><span className="run">T<i>6k</i></span><span>W</span><span className="run">T<i>8k</i></span><span>F</span><span>S</span><span className="run long">S<i>12k</i></span></div></section>
      <section className="panel feed-panel"><header className="panel-header"><div><span className="eyebrow">THE CLUBHOUSE</span><h3>Recent activity</h3></div></header>{activities.length ? activities.slice(0, 3).map((activity) => <div className="feed-row" key={activity.id}><Avatar initials={user?.initials ?? 'RL'} colour="#1646d8" size="small" /><span><strong>{user?.name}</strong> scored {activity.score.points} on {activity.name}<small>{activity.date}</small></span></div>) : <EmptyState title="Nothing here yet" text="Your league activity will appear after runs are added." />}</section>
    </div>
  </div>
}

function LeaguesPage() {
  const { user } = useAuth()
  const { leagues, createLeague, joinLeague, getLeagueTable } = usePlatform()
  const [modal, setModal] = useState<'create' | 'join' | null>(null)
  const [selectedId, setSelectedId] = useState('')
  const [table, setTable] = useState<LeagueTableEntry[]>([])
  const [tableMode, setTableMode] = useState<'week' | 'season'>('week')
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [seasonWeeks, setSeasonWeeks] = useState(10)
  const [runsPerWeek, setRunsPerWeek] = useState(3)
  const [joinCode, setJoinCode] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const selectedLeague = leagues.find((league) => league.id === selectedId) ?? leagues[0]

  useEffect(() => {
    if (!selectedLeague) return
    void getLeagueTable(selectedLeague.id).then(setTable).catch(() => setTable([]))
  }, [getLeagueTable, selectedLeague])

  const submitCreate = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const league = await createLeague({ name, description, seasonWeeks, runsPerWeek })
      setSelectedId(league.id); setModal(null); setName(''); setDescription('')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The league could not be created.') } finally { setBusy(false) }
  }
  const submitJoin = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try { await joinLeague(joinCode); setModal(null); setJoinCode('') } catch (caught) { setError(caught instanceof Error ? caught.message : 'The league could not be joined.') } finally { setBusy(false) }
  }
  const copyCode = async () => {
    if (!selectedLeague) return
    await navigator.clipboard.writeText(selectedLeague.code)
    setCopied(true); window.setTimeout(() => setCopied(false), 1800)
  }

  const sortedTable = [...table].sort((a, b) => tableMode === 'week' ? b.weeklyPoints - a.weeklyPoints : b.seasonPoints - a.seasonPoints)
  return <div className="app-page"><div className="page-intro"><div><span className="eyebrow">PRIVATE LEAGUES</span><h2>Run with your people.</h2><p>Everyone gets the same weekly run allowance. The best scores decide the table.</p></div><div className="page-actions"><button className="button button-outline" onClick={() => { setError(''); setModal('join') }}><UserPlus size={17} /> Join with code</button><button className="button button-primary" onClick={() => { setError(''); setModal('create') }}><Plus size={17} /> Create a league</button></div></div>
    {leagues.length ? <div className="league-cards">{leagues.map((league, index) => <article className={league.id === selectedLeague?.id ? 'league-card active' : 'league-card'} key={league.id}><div className={index % 2 ? 'league-card-cover violet' : 'league-card-cover'}><Trophy /><span>{league.role === 'owner' ? 'YOU CREATED THIS' : 'MEMBER'}</span></div><div><h3>{league.name}</h3><p>{league.memberCount} {league.memberCount === 1 ? 'runner' : 'runners'} · {league.seasonWeeks}-week season</p><div className="season-progress"><span style={{ width: '10%' }} /></div><footer><span><strong>{league.runsPerWeek}</strong><small>Runs per week</small></span><span><strong>{league.code}</strong><small>Invite code</small></span><button onClick={() => setSelectedId(league.id)}>Open league <ArrowRight size={16} /></button></footer></div></article>)}</div> : <section className="panel"><EmptyState title="Start your first league" text="Create a private league for friends, colleagues or clubmates—or join one using an invite code." action="Create a league" onAction={() => setModal('create')} /></section>}
    {selectedLeague && <><section className="league-invite panel"><div><span className="eyebrow">INVITE RUNNERS</span><h3>{selectedLeague.name}</h3><p>Share this private code. New members can enter it from their Leagues page.</p></div><button onClick={copyCode}><strong>{selectedLeague.code}</strong><span>{copied ? 'Copied' : 'Copy code'} <Copy size={15} /></span></button></section>
    <section className="panel full-table"><header className="panel-header"><div><span className="eyebrow">LIVE TABLE</span><h3>{selectedLeague.name}</h3></div><div className="table-toggle"><button className={tableMode === 'week' ? 'active' : ''} onClick={() => setTableMode('week')}>This week</button><button className={tableMode === 'season' ? 'active' : ''} onClick={() => setTableMode('season')}>Season</button></div></header>{sortedTable.length ? <><div className="table-head"><span>POS</span><span>RUNNER</span><span>RUNS</span><span>WEEK</span><span>SEASON</span></div>{sortedTable.map((member, index) => <div className={member.userId === user?.id || member.name === user?.name ? 'table-member current' : 'table-member'} key={member.userId}><b>{index + 1}</b><span><Avatar initials={member.initials} colour={member.userId === user?.id ? '#1646d8' : '#6370a7'} size="small" /><strong>{member.name}</strong>{member.userId === user?.id && <small>YOU</small>}</span><em>{member.runs}/{selectedLeague.runsPerWeek}</em><strong>{member.weeklyPoints}</strong><strong>{member.seasonPoints}</strong></div>)}</> : <EmptyState title="The table is ready" text="Scores will appear as league members add activities." />}</section>
    <section className="rules-panel"><ShieldCheck /><div><h3>League rules</h3><p>Best {selectedLeague.runsPerWeek} runs each week · Maximum {leagueRules.maximumScoringRunsPerDay} scoring run per day · {selectedLeague.seasonWeeks}-week season.</p></div></section></>}
    {modal === 'create' && <Modal title="Create a private league" onClose={() => setModal(null)}><form className="modal-form" onSubmit={submitCreate}><label>League name<input value={name} onChange={(event) => setName(event.target.value)} placeholder="e.g. Sunday Miles" minLength={2} maxLength={80} required autoFocus /></label><label>Description<textarea value={description} onChange={(event) => setDescription(event.target.value)} placeholder="What brings this group together?" /></label><div className="form-grid two"><label>Season length<select value={seasonWeeks} onChange={(event) => setSeasonWeeks(Number(event.target.value))}>{[4, 6, 8, 10, 12, 16].map((value) => <option value={value} key={value}>{value} weeks</option>)}</select></label><label>Scoring runs<select value={runsPerWeek} onChange={(event) => setRunsPerWeek(Number(event.target.value))}>{[1, 2, 3, 4, 5].map((value) => <option value={value} key={value}>{value} per week</option>)}</select></label></div>{error && <div className="form-error">{error}</div>}<button className="button button-primary button-full" disabled={busy}>{busy ? 'Creating…' : 'Create league'} <ArrowRight size={17} /></button></form></Modal>}
    {modal === 'join' && <Modal title="Join a league" onClose={() => setModal(null)}><form className="modal-form" onSubmit={submitJoin}><p>Ask the league organiser for their seven-character invite code.</p><label>Invite code<input className="code-input" value={joinCode} onChange={(event) => setJoinCode(event.target.value.toUpperCase())} placeholder="ABC1234" minLength={5} maxLength={10} required autoFocus /></label>{error && <div className="form-error">{error}</div>}<button className="button button-primary button-full" disabled={busy}>{busy ? 'Joining…' : 'Join league'} <ArrowRight size={17} /></button></form></Modal>}
  </div>
}

function ScoreBreakdown({ activity }: { activity: ActivityRecord }) {
  const score = activity.score
  return <aside className="score-breakdown"><header><span><small>RUNNING SCORE</small><strong>{score.band}</strong></span><ScoreDisc score={score.points} size="large" /></header><div className="score-breakdown-metrics"><span><small>Elapsed pace</small><strong>{formatPace(activity.elapsedSeconds / activity.distanceKm)}</strong></span><span><small>Effort distance</small><strong>{score.effortDistanceKm.toFixed(2)} km</strong></span><span><small>Normalised pace</small><strong>{formatPace(score.normalizedPaceSecondsPerKm)}</strong></span><span><small>Performance index</small><strong>{score.performanceIndex.toFixed(1)}</strong></span></div>{score.intervalUplift > 0 && <div className="uplift-note"><Zap size={17} /><span><strong>+{score.intervalUplift} interval uplift</strong><small>Faster blocks counted without ignoring recovery time.</small></span></div>}<div className="score-formula"><strong>How this score was built</strong><ol><li><span>1</span>Distance plus {activity.elevationM} m of climbing gave {score.effortDistanceKm.toFixed(2)} effort km.</li><li><span>2</span>The full elapsed time and effort distance were used to calculate average effort pace.</li><li><span>3</span>The performance index converted to {score.points} league points.</li></ol></div><footer>{score.version}<span>Methodology is versioned and will be recalibrated after testing.</span></footer></aside>
}

function ActivitiesPage() {
  const { activities, addActivity } = usePlatform()
  const [selectedId, setSelectedId] = useState(activities[0]?.id ?? '')
  const [filter, setFilter] = useState<'all' | 'scoring' | 'training'>('all')
  const [modal, setModal] = useState(false)
  const [name, setName] = useState('Evening run')
  const [occurredAt, setOccurredAt] = useState(() => new Date(Date.now() - new Date().getTimezoneOffset() * 60000).toISOString().slice(0, 16))
  const [location, setLocation] = useState('')
  const [distanceKm, setDistanceKm] = useState(5)
  const [elevationM, setElevationM] = useState(0)
  const [duration, setDuration] = useState('00:30:00')
  const [training, setTraining] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')
  const filePicker = useRef<HTMLInputElement>(null)
  const scoringIds = useMemo(() => new Set(weeklyScoringRuns(activities, leagueRules.scoringRunsPerWeek).map((activity) => activity.id)), [activities])
  const visibleActivities = activities.filter((activity) => filter === 'all' || filter === 'training' ? filter === 'all' || activity.training : scoringIds.has(activity.id))
  const selected = visibleActivities.find((activity) => activity.id === selectedId) ?? visibleActivities[0]

  const submitManual = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try {
      const elapsedSeconds = parseDuration(duration)
      if (!elapsedSeconds) throw new Error('Enter a valid elapsed time.')
      await addActivity({ name, occurredAt: new Date(occurredAt).toISOString(), location: location || 'Not specified', source: 'Manual', distanceKm, elevationM, elapsedSeconds, training })
      setModal(false); setMessage('Run added and scored.'); setName('Evening run')
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The run could not be added.') } finally { setBusy(false) }
  }
  const uploadFile = async (file?: File) => {
    if (!file) return
    setBusy(true); setError(''); setMessage('')
    try {
      const imported = await importActivityFile(file)
      await addActivity(imported)
      setMessage(`${file.name} imported and scored.`)
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'The activity file could not be imported.') } finally {
      setBusy(false)
      if (filePicker.current) filePicker.current.value = ''
    }
  }
  return <div className="app-page"><div className="page-intro"><div><span className="eyebrow">ACTIVITY HISTORY</span><h2>Every run, explained.</h2><p>See the data behind each score and which runs count towards your league week.</p></div><div className="page-actions"><input ref={filePicker} type="file" accept=".gpx,.fit" hidden onChange={(event) => void uploadFile(event.target.files?.[0])} /><button className="button button-outline" disabled={busy} onClick={() => filePicker.current?.click()}><Upload size={17} /> {busy ? 'Importing…' : 'Import GPX / FIT'}</button><button className="button button-primary" onClick={() => { setModal(true); setError('') }}><Plus size={17} /> Enter run</button></div></div>{message && <div className="notice success"><CheckCircle2 />{message}</div>}{error && !modal && <div className="notice error">{error}</div>}<div className="activities-layout"><section className="panel activity-list-panel"><div className="activity-filter"><button className={filter === 'all' ? 'active' : ''} onClick={() => setFilter('all')}>All runs</button><button className={filter === 'scoring' ? 'active' : ''} onClick={() => setFilter('scoring')}>Scoring</button><button className={filter === 'training' ? 'active' : ''} onClick={() => setFilter('training')}>Training</button></div>{visibleActivities.length ? visibleActivities.map((activity) => <div className={activity.id === selected?.id ? 'selectable-activity selected' : 'selectable-activity'} key={activity.id}><span className="counted-chip">{scoringIds.has(activity.id) ? 'COUNTS' : activity.training ? 'TRAINING' : 'NEXT BEST'}</span><ActivityRow activity={activity} onOpen={() => setSelectedId(activity.id)} /></div>) : <EmptyState title="No matching runs" text={activities.length ? 'Try a different filter.' : 'Enter a run manually or import a GPX/FIT file.'} action={activities.length ? undefined : 'Enter a run'} onAction={() => setModal(true)} />}</section>{selected ? <ScoreBreakdown activity={selected} /> : <aside className="score-breakdown empty-score"><Gauge /><h3>Your score breakdown will appear here.</h3></aside>}</div>
    <section className="method-panel"><span className="method-icon"><BarChart3 /></span><div><span className="eyebrow">CURRENT METHODOLOGY</span><h3>RunningScore is designed to be inspectable.</h3><p>It uses elapsed time, effort distance and Riegel distance normalisation. Imported runs currently use activity totals; interval blocks and heart rate are not included in their score.</p></div><div className="method-stats"><span><small>Benchmark</small><strong>20:21 5K</strong></span><span><small>Climb adjustment</small><strong>100 m = 1 km</strong></span><span><small>Scale</small><strong>1–25 points</strong></span></div></section>
    {modal && <Modal title="Enter a run" onClose={() => setModal(false)}><form className="modal-form" onSubmit={submitManual}><div className="form-grid two"><label>Run name<input value={name} onChange={(event) => setName(event.target.value)} required autoFocus /></label><label>Date and time<input type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} required /></label></div><label>Location<input value={location} onChange={(event) => setLocation(event.target.value)} placeholder="Optional" /></label><div className="form-grid three"><label>Distance<div className="input-suffix"><input type="number" min="0.1" max="500" step="0.01" value={distanceKm} onChange={(event) => setDistanceKm(Number(event.target.value))} required /><span>km</span></div></label><label>Elevation<div className="input-suffix"><input type="number" min="0" max="20000" value={elevationM} onChange={(event) => setElevationM(Number(event.target.value))} required /><span>m</span></div></label><label>Elapsed time<input value={duration} onChange={(event) => setDuration(event.target.value)} pattern="\d{1,2}:\d{2}:\d{2}" placeholder="00:30:00" required /><small>HH:MM:SS</small></label></div><label className="toggle-row"><span><strong>Training only</strong><small>Keep this run in your plan history without counting it in league scoring.</small></span><input type="checkbox" checked={training} onChange={(event) => setTraining(event.target.checked)} /></label>{error && <div className="form-error">{error}</div>}<button className="button button-primary button-full" disabled={busy}>{busy ? 'Calculating…' : 'Add and score run'} <ArrowRight size={17} /></button></form></Modal>}
  </div>
}

function PlanQuestionnaire({ onGenerated, initialAnswers }: { onGenerated: (plan: TrainingPlan) => void | Promise<void>; initialAnswers?: PlanAnswers }) {
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState<PlanAnswers>(() => initialAnswers ?? defaultPlanAnswers())
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const update = <K extends keyof PlanAnswers>(key: K, value: PlanAnswers[K]) => setAnswers((current) => ({ ...current, [key]: value }))
  const toggleDay = (day: string) => update('preferredDays', answers.preferredDays.includes(day) ? answers.preferredDays.filter((item) => item !== day) : [...answers.preferredDays, day])
  const canContinue = step !== 2 || answers.preferredDays.length >= answers.runsPerWeek
  const generate = async () => {
    setError(''); setBusy(true)
    try { await onGenerated(generateTrainingPlan(answers)) }
    catch (caught) { setError(caught instanceof Error ? caught.message : 'Your plan could not be saved. Please try again.') }
    finally { setBusy(false) }
  }
  return <section className="plan-builder panel">
    <header className="plan-builder-header"><div><span className="eyebrow">PERSONALISED RACE PLAN</span><h2>Build around your real week.</h2><p>Answer four short sections. You can edit everything before the plan is created.</p></div><div className="step-progress"><strong>{step}</strong><span>of 4</span><div><i style={{ width: `${step * 25}%` }} /></div></div></header>
    <nav className="step-labels" aria-label="Plan steps">{['Race goal', 'Availability', 'Starting point', 'Preferences'].map((label, index) => <span className={step === index + 1 ? 'active' : step > index + 1 ? 'done' : ''} key={label}>{step > index + 1 ? <Check size={14} /> : index + 1}<b>{label}</b></span>)}</nav>
    <div className="question-panel">
      {step === 1 && <><div className="question-title"><span className="question-number">01</span><div><h3>What are you training for?</h3><p>This sets the length, peak mileage and pace of the plan.</p></div></div><div className="option-grid four">{(['5K', '10K', 'Half marathon', 'Marathon'] as const).map((distance) => <button className={answers.raceDistance === distance ? 'option-card selected' : 'option-card'} onClick={() => update('raceDistance', distance)} key={distance}><span>{distance === 'Half marathon' ? '21.1' : distance === 'Marathon' ? '42.2' : distance.replace('K', '')}<small>KM</small></span><strong>{distance}</strong>{answers.raceDistance === distance && <Check size={16} />}</button>)}</div><div className="form-grid two"><label>Race date<input type="date" value={answers.raceDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => update('raceDate', event.target.value)} /></label><label>Target finish time<input type="time" step="1" value={answers.targetTime} onChange={(event) => update('targetTime', event.target.value)} /><small>Hours : minutes : seconds</small></label></div></>}
      {step === 2 && <><div className="question-title"><span className="question-number">02</span><div><h3>When can running fit?</h3><p>Choose a realistic number of sessions and the days that usually work.</p></div></div><label className="field-title">Runs per week</label><div className="number-options">{[2, 3, 4, 5, 6].map((count) => <button className={answers.runsPerWeek === count ? 'selected' : ''} onClick={() => update('runsPerWeek', count)} key={count}><strong>{count}</strong><small>{count === 2 ? 'Minimum' : count === 3 ? 'Balanced' : count >= 5 ? 'Higher volume' : 'More progress'}</small></button>)}</div><label className="field-title">Preferred running days <small>Select at least {answers.runsPerWeek}</small></label><div className="day-options">{weekdays.map((day) => <button className={answers.preferredDays.includes(day) ? 'selected' : ''} onClick={() => toggleDay(day)} key={day}><span>{day.slice(0, 3)}</span><small>{day}</small></button>)}</div><label className="select-field">Preferred long-run day<select value={answers.longRunDay} onChange={(event) => update('longRunDay', event.target.value)}>{weekdays.map((day) => <option key={day}>{day}</option>)}</select></label>{!canContinue && <div className="inline-warning">Choose at least {answers.runsPerWeek} available days.</div>}</>}
      {step === 3 && <><div className="question-title"><span className="question-number">03</span><div><h3>Where are you starting from?</h3><p>This keeps the first weeks close to your current running load.</p></div></div><label className="field-title">Running experience</label><div className="option-grid two experience-options">{(['New runner', 'Building consistency', 'Experienced', 'Performance focused'] as const).map((level) => <button className={answers.experience === level ? 'option-card selected' : 'option-card'} onClick={() => update('experience', level)} key={level}><strong>{level}</strong><small>{level === 'New runner' ? 'Running for under 6 months' : level === 'Building consistency' ? 'A regular week is still taking shape' : level === 'Experienced' ? 'Comfortable with varied sessions' : 'Used to structured race training'}</small>{answers.experience === level && <Check size={16} />}</button>)}</div><div className="form-grid three"><label>Current weekly distance<div className="input-suffix"><input type="number" min="0" max="180" value={answers.weeklyDistanceKm} onChange={(event) => update('weeklyDistanceKm', Number(event.target.value))} /><span>km</span></div></label><label>Longest recent run<div className="input-suffix"><input type="number" min="0" max="60" step="0.5" value={answers.longestRunKm} onChange={(event) => update('longestRunKm', Number(event.target.value))} /><span>km</span></div></label><label>Recent 5K time<input type="time" step="1" value={answers.recentFiveK} onChange={(event) => update('recentFiveK', event.target.value)} /></label></div></>}
      {step === 4 && <><div className="question-title"><span className="question-number">04</span><div><h3>Make the plan yours.</h3><p>A few final preferences help shape the sessions around you.</p></div></div><label className="field-title">Usual terrain</label><div className="terrain-options">{(['Road', 'Trail', 'Mixed'] as const).map((terrain) => <button className={answers.terrain === terrain ? 'selected' : ''} onClick={() => update('terrain', terrain)} key={terrain}>{terrain === 'Road' ? <Route /> : terrain === 'Trail' ? <Mountain /> : <Activity />}<strong>{terrain}</strong></button>)}</div><label className="toggle-row"><span><strong>Add simple strength sessions</strong><small>20–30 minute calf, glute and core work every other week.</small></span><input type="checkbox" checked={answers.strengthTraining} onChange={(event) => update('strengthTraining', event.target.checked)} /></label><label>Personal training notes (saved for your reference)<textarea value={answers.notes} onChange={(event) => update('notes', event.target.value)} placeholder="These notes are saved with your plan; they do not automatically change the schedule." /></label><div className="plan-summary-box"><Target /><span><strong>{answers.raceDistance} on {new Date(`${answers.raceDate}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong><small>{answers.runsPerWeek} runs each week · {answers.preferredDays.join(', ')} · target {answers.targetTime}</small></span></div></>}
    </div>
    {error && <div className="notice error" role="alert">{error}</div>}<footer className="plan-builder-actions"><button className="button button-ghost" disabled={step === 1} onClick={() => setStep((value) => Math.max(1, value - 1))}><ChevronLeft size={17} /> Back</button>{step < 4 ? <button className="button button-primary" disabled={!canContinue} onClick={() => setStep((value) => Math.min(4, value + 1))}>Continue <ChevronRight size={17} /></button> : <button className="button button-primary" disabled={busy} onClick={() => void generate()}><Sparkles size={17} /> Generate my plan</button>}</footer>
  </section>
}

function ActivePlan({ plan, onReset }: { plan: TrainingPlan; onReset: () => void }) {
  const { completedSessions, toggleSessionCompletion } = usePlatform()
  const [weekIndex, setWeekIndex] = useState(0)
  const [error, setError] = useState('')
  const [savingSession, setSavingSession] = useState(false)
  const completeSession = async (key: string) => {
    setError(''); setSavingSession(true)
    try { await toggleSessionCompletion(key) } catch { setError('That change could not be saved. Please try again.') }
    finally { setSavingSession(false) }
  }
  const week = plan.weeks[weekIndex]
  return <div className="active-plan"><section className="plan-hero panel"><div><span className="eyebrow">YOUR {plan.answers.raceDistance.toUpperCase()} PLAN</span><h2>Race day has a route now.</h2><p>{plan.summary}</p><div className="plan-kpis"><span><small>Target pace</small><strong>{plan.targetPace}</strong></span><span><small>Race date</small><strong>{new Date(`${plan.answers.raceDate}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</strong></span><span><small>Long-run day</small><strong>{plan.answers.longRunDay}</strong></span></div></div><div className="plan-race-disc"><Target /><strong>{plan.answers.raceDistance}</strong><small>{plan.answers.targetTime}</small></div></section>
    {error && <div className="notice error" role="alert">{error}</div>}<div className="plan-toolbar"><div><button disabled={weekIndex === 0} onClick={() => setWeekIndex((value) => value - 1)} aria-label="Previous week"><ChevronLeft /></button><span><small>VIEWING</small><strong>{week.label} of {plan.weeks.length}</strong></span><button disabled={weekIndex === plan.weeks.length - 1} onClick={() => setWeekIndex((value) => value + 1)} aria-label="Next week"><ChevronRight /></button></div><button onClick={onReset}>Edit answers</button></div>
    <section className="panel plan-week"><header><div><span className="eyebrow">{week.isTaper ? 'TAPER WEEK' : `WEEK ${week.week}`}</span><h3>{week.focus}</h3><p>{week.totalKm} km planned across {week.sessions.filter((session) => session.type !== 'Strength').length} runs.</p></div><div className="week-volume"><strong>{week.totalKm}</strong><small>KM</small></div></header><div className="session-list">{week.sessions.map((session, index) => { const sessionKey = `${plan.createdAt}-${week.week}-${session.day}-${session.type}`; const complete = completedSessions.includes(sessionKey); return <article className={complete ? 'session-card complete' : 'session-card'} key={`${session.day}-${session.type}`}><span className={`session-type type-${session.type.toLowerCase().replace(' ', '-')}`}>{session.type === 'Intervals' ? <Zap /> : session.type === 'Long run' ? <Route /> : session.type === 'Strength' ? <Medal /> : <Footprints />}</span><div><small>{session.day.toUpperCase()}</small><h4>{session.type}{session.distanceKm ? ` · ${session.distanceKm} km` : ''}</h4><p>{session.detail}</p></div><span className="session-pace"><small>{session.type === 'Strength' ? 'DURATION' : 'PACE'}</small><strong>{session.pace}</strong></span><button className={complete ? 'complete' : ''} aria-label={`${complete ? 'Mark' : 'Mark'} ${session.type} ${complete ? 'incomplete' : 'complete'}`} disabled={savingSession} onClick={() => void completeSession(sessionKey)}><Check /></button>{index < week.sessions.length - 1 && <i />}</article> })}</div></section>
    <section className="plan-weeks-overview panel"><header className="panel-header"><div><span className="eyebrow">THE FULL BUILD</span><h3>{plan.weeks.length}-week overview</h3></div></header><div>{plan.weeks.map((item, index) => <button className={weekIndex === index ? 'active' : ''} onClick={() => setWeekIndex(index)} key={item.week}><span>{item.week}</span><strong>{item.totalKm} km</strong><small>{item.focus}</small></button>)}</div></section>
    <div className="training-safety"><ShieldCheck /><p>This plan is a starting point, not medical advice. Reduce or stop training if pain persists, and seek qualified guidance for injuries or health concerns.</p></div>
  </div>
}

function PlanPage() {
  const { plan, savePlan } = usePlatform()
  const [editing, setEditing] = useState(false)
  return <div className="app-page">{plan && !editing ? <ActivePlan plan={plan} onReset={() => setEditing(true)} /> : <><div className="page-intro compact"><div><span className="eyebrow">TRAINING PLAN</span><h2>What are you running towards?</h2><p>Build a plan that starts with your goal and respects the rest of your life.</p></div></div><PlanQuestionnaire initialAnswers={plan?.answers} onGenerated={async (next) => { await savePlan(next); setEditing(false) }} />{plan && <button className="button button-outline" onClick={() => setEditing(false)}>Keep existing plan</button>}</>}</div>
}

function ProfilePage() {
  const { user, updateName, cloudConfigured } = useAuth()
  const { stravaAvailable, stravaConnected, connectStrava, syncStrava } = usePlatform()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(user?.name ?? '')
  const [busy, setBusy] = useState(false)
  const stravaStatus = new URLSearchParams(window.location.search).get('strava')
  const [error, setError] = useState(stravaStatus && !['connected', 'cancelled'].includes(stravaStatus) ? 'Strava could not be connected. Please try again.' : '')
  const [message, setMessage] = useState(stravaStatus === 'connected' ? 'Strava connected and recent running activities imported.' : '')

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault(); setBusy(true); setError('')
    try { await updateName(name); setEditing(false); setMessage('Profile updated.') } catch (caught) { setError(caught instanceof Error ? caught.message : 'Profile could not be updated.') } finally { setBusy(false) }
  }
  const providerAction = async () => {
    setBusy(true); setError(''); setMessage('')
    try {
      if (stravaConnected) { await syncStrava(); setMessage('Strava activities are up to date.') }
      else await connectStrava()
    } catch (caught) { setError(caught instanceof Error ? caught.message : 'Strava could not be reached.') } finally { setBusy(false) }
  }
  return <div className="app-page"><div className="page-intro compact"><div><span className="eyebrow">YOUR ACCOUNT</span><h2>Profile and connections.</h2><p>Manage your runner details, activity sources and account support.</p></div></div>{message && <div className="notice success"><CheckCircle2 />{message}</div>}{error && <div className="notice error">{error}</div>}<div className="profile-grid"><section className="panel profile-card"><Avatar initials={user?.initials ?? 'RL'} colour="#1646d8" size="large" /><div><h3>{user?.name}</h3><p>{user?.email}</p><span>RunningLeague beta member</span></div><button className="button button-outline button-small" onClick={() => { setName(user?.name ?? ''); setEditing(true) }}>Edit profile</button></section><section className="panel connection-card"><header><span className="icon-tile"><Activity /></span><div><h3>Activity connections</h3><p>Bring your runs in automatically or upload activity files.</p></div></header><div><span><strong>Strava</strong><small>{stravaConnected ? 'Connected · last 90 days available' : stravaAvailable ? 'Import running activities securely' : 'Connection is not available yet; use GPX or FIT upload'}</small></span><button disabled={busy || !cloudConfigured || !stravaAvailable} onClick={() => void providerAction()}>{busy ? 'Working…' : stravaConnected ? <><RefreshCw size={15} /> Sync</> : stravaAvailable ? 'Connect' : 'Not available'}</button></div><div><span><strong>GPX / FIT upload</strong><small>Import from Garmin and other running watches</small></span><button onClick={() => navigate('/app/activities')}>Upload</button></div><div className="provider-coming"><span><strong>Direct Garmin sync</strong><small>Requires Garmin partner approval; FIT import works now</small></span><em>Not available</em></div></section><section className="panel account-links"><div><ShieldCheck /><span><h3>Privacy and support</h3><p>Read how data is used or send a support request.</p></span></div><nav><AppLink to="/privacy">Privacy Policy <ArrowRight size={15} /></AppLink><AppLink to="/terms">Terms of Use <ArrowRight size={15} /></AppLink><AppLink to="/support">Contact support <ArrowRight size={15} /></AppLink></nav></section></div>{editing && <Modal title="Edit profile" onClose={() => setEditing(false)}><form className="modal-form" onSubmit={saveProfile}><label>Your name<input value={name} onChange={(event) => setName(event.target.value)} minLength={2} required autoFocus /></label>{error && <div className="form-error">{error}</div>}<button className="button button-primary button-full" disabled={busy}>{busy ? 'Saving…' : 'Save changes'}</button></form></Modal>}</div>
}

function ResetPasswordPage() {
  const { updatePassword } = useAuth()
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (password !== confirm) { setError('The passwords do not match.'); return }
    try { await updatePassword(password); setSaved(true) } catch (caught) { setError(caught instanceof Error ? caught.message : 'The password could not be updated.') }
  }
  return <div className="simple-page"><PublicHeader /><main><section className="panel simple-form"><span className="auth-icon"><LockKeyhole /></span><h1>Choose a new password</h1>{saved ? <><div className="form-success"><CheckCircle2 />Your password has been updated.</div><AppLink to="/app" className="button button-primary">Continue to RunningLeague</AppLink></> : <form className="modal-form" onSubmit={submit}><label>New password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} minLength={8} autoComplete="new-password" required /></label><label>Confirm password<input type="password" value={confirm} onChange={(event) => setConfirm(event.target.value)} minLength={8} autoComplete="new-password" required /></label>{error && <div className="form-error">{error}</div>}<button className="button button-primary button-full">Update password</button></form>}</section></main></div>
}

function LegalPage({ type }: { type: 'privacy' | 'terms' }) {
  return <div className="simple-page"><PublicHeader /><main className="legal-page"><span className="eyebrow">RUNNINGLEAGUE BETA</span><h1>{type === 'privacy' ? 'Privacy Policy' : 'Terms of Use'}</h1><p className="legal-updated">Last updated: 20 September 2026</p>{type === 'privacy' ? <>
    <h2>What we collect</h2><p>We collect the account details you provide, your league membership, training-plan answers, preferences and running activity data. Connected services such as Strava share activity data only after you authorise access.</p>
    <h2>How we use it</h2><p>We use this information to operate your account, score activities, generate training plans, show private league tables, provide support and improve the beta. We do not sell your personal data.</p>
    <h2>Storage and security</h2><p>Account and product data is stored using managed cloud services with access controls. Passwords are handled by our authentication provider and are not stored in the RunningLeague application database.</p>
    <h2>Your choices</h2><p>You may revoke provider access in your Strava settings, or ask for access, correction or deletion of your data. During the beta, submit privacy requests through the support page.</p>
    <h2>Retention and lawful basis</h2><p>We process data to provide the service you request and for our legitimate interests in securing and improving it. We retain active account data while the account is in use and remove it following a valid deletion request, subject to legal requirements.</p>
  </> : <>
    <h2>Free beta</h2><p>RunningLeague is currently provided free of charge for testing and feedback. Features and the scoring methodology may change as the product develops.</p>
    <h2>Your account</h2><p>You must provide accurate information, keep your account secure and only upload activities you are entitled to use. Private invite codes should only be shared with people you want to join your league.</p>
    <h2>Fair participation</h2><p>Do not submit false activity data, interfere with another account or attempt to manipulate league results. We may remove clearly invalid data or suspend misuse to protect other runners.</p>
    <h2>Training plans</h2><p>Generated plans are general fitness guidance, not medical advice. Reduce or stop training if pain persists and seek qualified advice where appropriate.</p>
    <h2>Availability</h2><p>The beta is supplied as available without a guarantee of uninterrupted service. You remain responsible for keeping original copies of important activity files.</p>
  </>}<div className="legal-actions"><AppLink to="/support" className="button button-primary">Contact support</AppLink><AppLink to="/" className="button button-outline">Back home</AppLink></div></main></div>
}

function SupportPage() {
  const { user } = useAuth()
  const [email, setEmail] = useState(user?.email ?? '')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const submit = async (event: FormEvent) => {
    event.preventDefault(); setError('')
    if (!supabase) { setError('Support submissions will be available when the live beta service is connected.'); return }
    const { error: requestError } = await supabase.from('support_requests').insert({ user_id: user?.id ?? null, email: email.trim(), subject: subject.trim(), message: message.trim() })
    if (requestError) setError(requestError.message)
    else setSent(true)
  }
  return <div className="simple-page"><PublicHeader /><main><section className="panel simple-form"><span className="auth-icon"><Users /></span><h1>RunningLeague support</h1><p>Tell us what you need and we’ll use the details below to respond.</p>{sent ? <div className="form-success"><CheckCircle2 />Your support request has been sent.</div> : <form className="modal-form" onSubmit={submit}><label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} required /></label><label>Subject<input value={subject} onChange={(event) => setSubject(event.target.value)} minLength={3} maxLength={120} required /></label><label>Message<textarea value={message} onChange={(event) => setMessage(event.target.value)} minLength={10} maxLength={4000} required /></label>{error && <div className="form-error">{error}</div>}<button className="button button-primary button-full">Send request</button></form>}</section></main></div>
}

function NotFound() {
  return <div className="not-found"><Logo /><strong>404</strong><h1>That route has gone for a run.</h1><p>Head back to the home page and try again.</p><AppLink to="/" className="button button-primary">Back home</AppLink></div>
}

export default function App() {
  const path = usePath()
  const { user, loading } = useAuth()
  useEffect(() => {
    document.title = path.startsWith('/app') ? 'RunningLeague — Member dashboard' : 'RunningLeague — Every run counts'
  }, [path])

  if (loading) return <div className="app-loading"><Logo /><span>Loading your running space…</span></div>
  if (path === '/') return <PublicHome />
  if (path === '/privacy') return <LegalPage type="privacy" />
  if (path === '/terms') return <LegalPage type="terms" />
  if (path === '/support') return <SupportPage />
  if (path === '/reset-password') return <ResetPasswordPage />
  if (path === '/login') return user ? <AppShell path="/app"><DashboardPage /></AppShell> : <AuthPage mode="login" />
  if (path === '/signup') return user ? <AppShell path="/app"><DashboardPage /></AppShell> : <AuthPage mode="signup" />
  if (path.startsWith('/app')) {
    if (!user) return <AuthPage mode="login" />
    const page = path === '/app' ? <DashboardPage /> : path === '/app/leagues' ? <LeaguesPage /> : path === '/app/activities' ? <ActivitiesPage /> : path === '/app/plan' ? <PlanPage /> : path === '/app/profile' ? <ProfilePage /> : <NotFound />
    return <AppShell path={path}>{page}</AppShell>
  }
  return <NotFound />
}

export { scoringConfig }
