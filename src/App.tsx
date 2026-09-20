import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import {
  Activity,
  ArrowRight,
  BarChart3,
  CalendarCheck,
  CalendarDays,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Footprints,
  Gauge,
  Home,
  LockKeyhole,
  LogOut,
  Medal,
  Menu,
  Mountain,
  Plus,
  Route,
  ShieldCheck,
  Sparkles,
  Target,
  Trophy,
  Upload,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { demoCredentials, useAuth } from './auth'
import { demoActivities, feedItems, leagueMembers } from './data'
import { defaultPlanAnswers, generateTrainingPlan, weekdays } from './planner'
import { formatPace, leagueRules, scoringConfig, scoringVersion } from './scoring'
import type { ActivityRecord, PlanAnswers, TrainingPlan } from './types'

const PLAN_STORAGE_KEY = 'running-league-training-plan-v1'

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
  return <a href={to} className={className} onClick={(event) => { event.preventDefault(); onClick?.(); navigate(to) }}>{children}</a>
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
          <article className="feature-card"><span className="feature-number">01</span><span className="feature-icon"><Upload /></span><h3>Bring in your run</h3><p>Connect a provider later, or add FIT, GPX and manual activities in the first version.</p><small>Distance · elapsed time · elevation</small></article>
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
          <div className="league-copy"><span className="eyebrow light">RUN TOGETHER. COMPETE FAIRLY.</span><h2>Your people.<br />Your league.</h2><p>Create a private league, invite your friends and turn an ordinary week of running into something everyone follows.</p><ul><li><Check size={17} /> Equal weekly scoring allowance</li><li><Check size={17} /> Weekly and season tables</li><li><Check size={17} /> Shareable run and result cards</li><li><Check size={17} /> Clear activity checks</li></ul><AppLink to="/signup" className="button button-light">Create a league <ArrowRight size={17} /></AppLink></div>
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
    <footer className="public-footer"><div className="page-width"><Logo inverse /><p>Fair competition for every kind of runner.</p><nav><button onClick={() => document.getElementById('how-it-works')?.scrollIntoView()}>Scoring</button><button onClick={() => document.getElementById('leagues')?.scrollIntoView()}>Leagues</button><button onClick={() => document.getElementById('training')?.scrollIntoView()}>Plans</button><AppLink to="/login">Log in</AppLink></nav><small>© 2026 RunningLeague. Product prototype.</small></div></footer>
  </div>
}

function AuthPage({ mode }: { mode: 'login' | 'signup' }) {
  const { signIn, signUp } = useAuth()
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (event: FormEvent) => {
    event.preventDefault()
    setError('')
    setBusy(true)
    try {
      if (mode === 'signup') await signUp(name, email, password)
      else await signIn(email, password)
      navigate('/app')
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
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        <p>{mode === 'login' ? 'Log in to see your runs, leagues and training plan.' : 'Start with the full product demo. No provider connection is needed.'}</p>
        {mode === 'signup' && <label>Your name<input value={name} onChange={(event) => setName(event.target.value)} autoComplete="name" required /></label>}
        <label>Email address<input type="email" value={email} onChange={(event) => setEmail(event.target.value)} autoComplete="email" required /></label>
        <label>Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={8} required /></label>
        {error && <div className="form-error" role="alert">{error}</div>}
        <button className="button button-primary button-full" disabled={busy}>{busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Create account'} <ArrowRight size={17} /></button>
        {mode === 'login' && <div className="demo-login"><span><strong>Demo account</strong><small>{demoCredentials.email} · {demoCredentials.password}</small></span><button type="button" onClick={useDemo}>Use demo</button></div>}
        <div className="auth-switch">{mode === 'login' ? <>New to RunningLeague? <AppLink to="/signup">Create an account</AppLink></> : <>Already have an account? <AppLink to="/login">Log in</AppLink></>}</div>
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
  const [mobileOpen, setMobileOpen] = useState(false)
  const title = appNavigation.find((item) => item.path === path)?.label ?? 'RunningLeague'
  const logout = () => { signOut(); navigate('/') }
  return <div className="app-layout">
    <aside className={mobileOpen ? 'app-sidebar open' : 'app-sidebar'}>
      <div className="sidebar-top"><AppLink to="/app" onClick={() => setMobileOpen(false)}><Logo inverse /></AppLink><button onClick={() => setMobileOpen(false)} aria-label="Close menu"><X /></button></div>
      <nav aria-label="Member navigation">{appNavigation.map((item) => { const Icon = item.icon; return <AppLink key={item.path} to={item.path} onClick={() => setMobileOpen(false)} className={path === item.path ? 'active' : ''}><Icon size={19} /><span>{item.label}</span>{item.path === '/app/leagues' && <small>2</small>}</AppLink> })}</nav>
      <div className="sidebar-league"><span>ACTIVE LEAGUE</span><strong><span className="league-badge"><Trophy size={16} /></span>North London Ten</strong><small>Week 6 of 10</small><div><i style={{ width: '60%' }} /></div></div>
      <div className="sidebar-user"><Avatar initials={user?.initials ?? 'RL'} colour="#6b4eff" /><span><strong>{user?.name}</strong><small>{user?.email}</small></span><button aria-label="Log out" onClick={logout}><LogOut size={17} /></button></div>
    </aside>
    {mobileOpen && <button className="sidebar-scrim" aria-label="Close menu" onClick={() => setMobileOpen(false)} />}
    <section className="app-main">
      <header className="app-topbar"><button className="app-menu-button" aria-label="Open menu" onClick={() => setMobileOpen(true)}><Menu /></button><div><span>RUNNINGLEAGUE</span><h1>{title}</h1></div><div className="topbar-actions"><button className="button button-outline button-small" onClick={() => navigate('/app/activities')}><Plus size={16} /> Add a run</button><Avatar initials={user?.initials ?? 'RL'} colour="#1646d8" /></div></header>
      {children}
    </section>
  </div>
}

function StatCard({ label, value, detail, icon }: { label: string; value: string; detail: string; icon: ReactNode }) {
  return <article className="stat-card"><span className="stat-icon">{icon}</span><div><small>{label}</small><strong>{value}</strong><span>{detail}</span></div></article>
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
  const scoringRuns = [...demoActivities].sort((a, b) => b.score.points - a.score.points).slice(0, leagueRules.scoringRunsPerWeek)
  const weeklyScore = scoringRuns.reduce((sum, run) => sum + run.score.points, 0)
  return <div className="app-page dashboard-page">
    <div className="welcome-row"><div><span className="eyebrow">WEEK 6 · MON 14–SUN 20 SEP</span><h2>Good evening, {user?.name.split(' ')[0]}.</h2><p>One strong run could take you to the top of your league this week.</p></div><button className="button button-primary" onClick={() => navigate('/app/activities')}><Upload size={17} /> Add an activity</button></div>
    <div className="stats-grid">
      <StatCard label="Weekly score" value={`${weeklyScore} pts`} detail="3 of 3 scoring runs" icon={<Gauge />} />
      <StatCard label="League position" value="#2" detail="Up 2 places this week" icon={<Trophy />} />
      <StatCard label="Running streak" value="4 weeks" detail="At least 2 runs each week" icon={<Activity />} />
      <StatCard label="Race plan" value="Not set" detail="Build a plan around your week" icon={<Target />} />
    </div>
    <div className="dashboard-grid">
      <section className="panel weekly-panel"><header className="panel-header"><div><span className="eyebrow">YOUR WEEK</span><h3>Scoring runs</h3></div><button onClick={() => navigate('/app/activities')}>All activities <ArrowRight size={15} /></button></header><div className="weekly-score-line"><ScoreDisc score={scoringRuns[0].score.points} size="large" /><div><span>Your best score</span><strong>{scoringRuns[0].score.band}</strong><small>{scoringRuns[0].name} · +{scoringRuns[0].score.intervalUplift} interval uplift</small></div><div className="run-slots"><span className="filled"><Check size={14} /> 1</span><span className="filled"><Check size={14} /> 2</span><span className="filled"><Check size={14} /> 3</span></div></div>{scoringRuns.map((activity) => <ActivityRow activity={activity} key={activity.id} onOpen={() => navigate('/app/activities')} />)}</section>
      <section className="panel league-panel"><header className="panel-header"><div><span className="eyebrow">NORTH LONDON TEN</span><h3>Weekly table</h3></div><button onClick={() => navigate('/app/leagues')}>Full table <ArrowRight size={15} /></button></header><div className="leaderboard-list">{leagueMembers.slice(0, 5).map((member, index) => <div className={member.name === 'Darren Tosh' ? 'leaderboard-row current' : 'leaderboard-row'} key={member.id}><b>{index + 1}</b><Avatar initials={member.initials} colour={member.colour} size="small" /><span><strong>{member.name}</strong><small>{member.runs}/3 runs</small></span><em>{member.weeklyPoints}</em></div>)}</div><div className="league-deadline"><Clock3 size={17} /><span><strong>3 days left</strong><small>Week closes Sunday at midnight</small></span></div></section>
      <section className="panel plan-prompt"><div><span className="feature-icon"><CalendarCheck /></span><span className="eyebrow">RACE READY</span><h3>Build a plan that works on your days.</h3><p>Choose your distance, target and available days. We’ll shape the weeks for you.</p><button className="button button-primary" onClick={() => navigate('/app/plan')}>Create my plan <ArrowRight size={17} /></button></div><div className="mini-calendar"><span>M</span><span className="run">T<i>6k</i></span><span>W</span><span className="run">T<i>8k</i></span><span>F</span><span>S</span><span className="run long">S<i>12k</i></span></div></section>
      <section className="panel feed-panel"><header className="panel-header"><div><span className="eyebrow">THE CLUBHOUSE</span><h3>League activity</h3></div></header>{feedItems.map((item) => <div className="feed-row" key={item.name + item.time}><Avatar initials={item.initials} colour={item.colour} size="small" /><span><strong>{item.name}</strong> {item.action}<small>{item.time}</small></span></div>)}</section>
    </div>
  </div>
}

function LeaguesPage() {
  return <div className="app-page"><div className="page-intro"><div><span className="eyebrow">PRIVATE LEAGUES</span><h2>Run with your people.</h2><p>Everyone gets the same weekly run allowance. The best scores decide the table.</p></div><button className="button button-primary"><Plus size={17} /> Create a league</button></div>
    <div className="league-cards"><article className="league-card active"><div className="league-card-cover"><Trophy /><span>ACTIVE SEASON</span></div><div><h3>North London Ten</h3><p>10 runners · Week 6 of 10</p><div className="season-progress"><span style={{ width: '60%' }} /></div><footer><span><strong>#2</strong><small>Your position</small></span><span><strong>398</strong><small>Season points</small></span><button>Open league <ArrowRight size={16} /></button></footer></div></article><article className="league-card"><div className="league-card-cover violet"><Users /><span>FRIENDS LEAGUE</span></div><div><h3>Sunday Miles</h3><p>7 runners · Rolling weekly</p><div className="season-progress"><span style={{ width: '82%' }} /></div><footer><span><strong>#1</strong><small>Your position</small></span><span><strong>186</strong><small>Season points</small></span><button>Open league <ArrowRight size={16} /></button></footer></div></article></div>
    <section className="panel full-table"><header className="panel-header"><div><span className="eyebrow">WEEK 6</span><h3>North London Ten</h3></div><div className="table-toggle"><button className="active">This week</button><button>Season</button></div></header><div className="table-head"><span>POS</span><span>RUNNER</span><span>RUNS</span><span>WEEK</span><span>SEASON</span></div>{leagueMembers.map((member, index) => <div className={member.name === 'Darren Tosh' ? 'table-member current' : 'table-member'} key={member.id}><b>{index + 1}</b><span><Avatar initials={member.initials} colour={member.colour} size="small" /><strong>{member.name}</strong>{member.name === 'Darren Tosh' && <small>YOU</small>}</span><em>{member.runs}/3</em><strong>{member.weeklyPoints}</strong><strong>{member.seasonPoints}</strong></div>)}</section>
    <section className="rules-panel"><ShieldCheck /><div><h3>League rules</h3><p>Best {leagueRules.scoringRunsPerWeek} runs each week · Maximum {leagueRules.maximumScoringRunsPerDay} scoring run per day · Best {leagueRules.countedWeeks} of {leagueRules.seasonWeeks} weeks count.</p></div><button>View full rules</button></section>
  </div>
}

function ScoreBreakdown({ activity }: { activity: ActivityRecord }) {
  const score = activity.score
  return <aside className="score-breakdown"><header><span><small>RUNNING SCORE</small><strong>{score.band}</strong></span><ScoreDisc score={score.points} size="large" /></header><div className="score-breakdown-metrics"><span><small>Elapsed pace</small><strong>{formatPace(activity.elapsedSeconds / activity.distanceKm)}</strong></span><span><small>Effort distance</small><strong>{score.effortDistanceKm.toFixed(2)} km</strong></span><span><small>Normalised pace</small><strong>{formatPace(score.normalizedPaceSecondsPerKm)}</strong></span><span><small>Performance index</small><strong>{score.performanceIndex.toFixed(1)}</strong></span></div>{score.intervalUplift > 0 && <div className="uplift-note"><Zap size={17} /><span><strong>+{score.intervalUplift} interval uplift</strong><small>Faster blocks counted without ignoring recovery time.</small></span></div>}<div className="score-formula"><strong>How this score was built</strong><ol><li><span>1</span>Distance plus {activity.elevationM} m of climbing gave {score.effortDistanceKm.toFixed(2)} effort km.</li><li><span>2</span>30-second pace blocks were normalised while the full elapsed time stayed in the run.</li><li><span>3</span>The performance index converted to {score.points} league points.</li></ol></div><footer>{score.version}<span>Methodology is versioned and will be recalibrated after testing.</span></footer></aside>
}

function ActivitiesPage() {
  const [selectedId, setSelectedId] = useState(demoActivities[0].id)
  const selected = demoActivities.find((activity) => activity.id === selectedId) ?? demoActivities[0]
  return <div className="app-page"><div className="page-intro"><div><span className="eyebrow">ACTIVITY HISTORY</span><h2>Every run, explained.</h2><p>See the data behind each score and which runs count towards your league week.</p></div><button className="button button-primary"><Upload size={17} /> Import activity</button></div><div className="activities-layout"><section className="panel activity-list-panel"><div className="activity-filter"><button className="active">All runs</button><button>Scoring</button><button>Training</button></div>{demoActivities.map((activity, index) => <div className={activity.id === selectedId ? 'selectable-activity selected' : 'selectable-activity'} key={activity.id}><span className="counted-chip">{index < 3 ? 'COUNTS' : 'NEXT BEST'}</span><ActivityRow activity={activity} onOpen={() => setSelectedId(activity.id)} /></div>)}</section><ScoreBreakdown activity={selected} /></div>
    <section className="method-panel"><span className="method-icon"><BarChart3 /></span><div><span className="eyebrow">CURRENT METHODOLOGY</span><h3>RunningScore is designed to be inspectable.</h3><p>It uses elapsed time, effort distance, Riegel distance normalisation and interval-aware 30-second pace blocks. Heart rate is available for sense-checking but does not affect the score.</p></div><div className="method-stats"><span><small>Benchmark</small><strong>20:21 5K</strong></span><span><small>Climb adjustment</small><strong>100 m = 1 km</strong></span><span><small>Scale</small><strong>1–25 points</strong></span></div></section>
  </div>
}

function loadPlan(): TrainingPlan | null {
  try { return JSON.parse(localStorage.getItem(PLAN_STORAGE_KEY) ?? 'null') } catch { return null }
}

function PlanQuestionnaire({ onGenerated }: { onGenerated: (plan: TrainingPlan) => void }) {
  const [step, setStep] = useState(1)
  const [answers, setAnswers] = useState<PlanAnswers>(() => defaultPlanAnswers())
  const update = <K extends keyof PlanAnswers>(key: K, value: PlanAnswers[K]) => setAnswers((current) => ({ ...current, [key]: value }))
  const toggleDay = (day: string) => update('preferredDays', answers.preferredDays.includes(day) ? answers.preferredDays.filter((item) => item !== day) : [...answers.preferredDays, day])
  const canContinue = step !== 2 || answers.preferredDays.length >= answers.runsPerWeek
  const generate = () => {
    const plan = generateTrainingPlan(answers)
    localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify(plan))
    onGenerated(plan)
  }
  return <section className="plan-builder panel">
    <header className="plan-builder-header"><div><span className="eyebrow">PERSONALISED RACE PLAN</span><h2>Build around your real week.</h2><p>Answer four short sections. You can edit everything before the plan is created.</p></div><div className="step-progress"><strong>{step}</strong><span>of 4</span><div><i style={{ width: `${step * 25}%` }} /></div></div></header>
    <nav className="step-labels" aria-label="Plan steps">{['Race goal', 'Availability', 'Starting point', 'Preferences'].map((label, index) => <span className={step === index + 1 ? 'active' : step > index + 1 ? 'done' : ''} key={label}>{step > index + 1 ? <Check size={14} /> : index + 1}<b>{label}</b></span>)}</nav>
    <div className="question-panel">
      {step === 1 && <><div className="question-title"><span className="question-number">01</span><div><h3>What are you training for?</h3><p>This sets the length, peak mileage and pace of the plan.</p></div></div><div className="option-grid four">{(['5K', '10K', 'Half marathon', 'Marathon'] as const).map((distance) => <button className={answers.raceDistance === distance ? 'option-card selected' : 'option-card'} onClick={() => update('raceDistance', distance)} key={distance}><span>{distance === 'Half marathon' ? '21.1' : distance === 'Marathon' ? '42.2' : distance.replace('K', '')}<small>KM</small></span><strong>{distance}</strong>{answers.raceDistance === distance && <Check size={16} />}</button>)}</div><div className="form-grid two"><label>Race date<input type="date" value={answers.raceDate} min={new Date().toISOString().slice(0, 10)} onChange={(event) => update('raceDate', event.target.value)} /></label><label>Target finish time<input type="time" step="1" value={answers.targetTime} onChange={(event) => update('targetTime', event.target.value)} /><small>Hours : minutes : seconds</small></label></div></>}
      {step === 2 && <><div className="question-title"><span className="question-number">02</span><div><h3>When can running fit?</h3><p>Choose a realistic number of sessions and the days that usually work.</p></div></div><label className="field-title">Runs per week</label><div className="number-options">{[2, 3, 4, 5, 6].map((count) => <button className={answers.runsPerWeek === count ? 'selected' : ''} onClick={() => update('runsPerWeek', count)} key={count}><strong>{count}</strong><small>{count === 2 ? 'Minimum' : count === 3 ? 'Balanced' : count >= 5 ? 'Higher volume' : 'More progress'}</small></button>)}</div><label className="field-title">Preferred running days <small>Select at least {answers.runsPerWeek}</small></label><div className="day-options">{weekdays.map((day) => <button className={answers.preferredDays.includes(day) ? 'selected' : ''} onClick={() => toggleDay(day)} key={day}><span>{day.slice(0, 3)}</span><small>{day}</small></button>)}</div><label className="select-field">Preferred long-run day<select value={answers.longRunDay} onChange={(event) => update('longRunDay', event.target.value)}>{weekdays.map((day) => <option key={day}>{day}</option>)}</select></label>{!canContinue && <div className="inline-warning">Choose at least {answers.runsPerWeek} available days.</div>}</>}
      {step === 3 && <><div className="question-title"><span className="question-number">03</span><div><h3>Where are you starting from?</h3><p>This keeps the first weeks close to your current running load.</p></div></div><label className="field-title">Running experience</label><div className="option-grid two experience-options">{(['New runner', 'Building consistency', 'Experienced', 'Performance focused'] as const).map((level) => <button className={answers.experience === level ? 'option-card selected' : 'option-card'} onClick={() => update('experience', level)} key={level}><strong>{level}</strong><small>{level === 'New runner' ? 'Running for under 6 months' : level === 'Building consistency' ? 'A regular week is still taking shape' : level === 'Experienced' ? 'Comfortable with varied sessions' : 'Used to structured race training'}</small>{answers.experience === level && <Check size={16} />}</button>)}</div><div className="form-grid three"><label>Current weekly distance<div className="input-suffix"><input type="number" min="0" max="180" value={answers.weeklyDistanceKm} onChange={(event) => update('weeklyDistanceKm', Number(event.target.value))} /><span>km</span></div></label><label>Longest recent run<div className="input-suffix"><input type="number" min="0" max="60" step="0.5" value={answers.longestRunKm} onChange={(event) => update('longestRunKm', Number(event.target.value))} /><span>km</span></div></label><label>Recent 5K time<input type="time" step="1" value={answers.recentFiveK} onChange={(event) => update('recentFiveK', event.target.value)} /></label></div></>}
      {step === 4 && <><div className="question-title"><span className="question-number">04</span><div><h3>Make the plan yours.</h3><p>A few final preferences help shape the sessions around you.</p></div></div><label className="field-title">Usual terrain</label><div className="terrain-options">{(['Road', 'Trail', 'Mixed'] as const).map((terrain) => <button className={answers.terrain === terrain ? 'selected' : ''} onClick={() => update('terrain', terrain)} key={terrain}>{terrain === 'Road' ? <Route /> : terrain === 'Trail' ? <Mountain /> : <Activity />}<strong>{terrain}</strong></button>)}</div><label className="toggle-row"><span><strong>Add simple strength sessions</strong><small>20–30 minute calf, glute and core work every other week.</small></span><input type="checkbox" checked={answers.strengthTraining} onChange={(event) => update('strengthTraining', event.target.checked)} /></label><label>Anything the plan should know?<textarea value={answers.notes} onChange={(event) => update('notes', event.target.value)} placeholder="For example: returning from a break, club session every Wednesday, prefer no back-to-back running…" /></label><div className="plan-summary-box"><Target /><span><strong>{answers.raceDistance} on {new Date(`${answers.raceDate}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}</strong><small>{answers.runsPerWeek} runs each week · {answers.preferredDays.join(', ')} · target {answers.targetTime}</small></span></div></>}
    </div>
    <footer className="plan-builder-actions"><button className="button button-ghost" disabled={step === 1} onClick={() => setStep((value) => Math.max(1, value - 1))}><ChevronLeft size={17} /> Back</button>{step < 4 ? <button className="button button-primary" disabled={!canContinue} onClick={() => setStep((value) => Math.min(4, value + 1))}>Continue <ChevronRight size={17} /></button> : <button className="button button-primary" onClick={generate}><Sparkles size={17} /> Generate my plan</button>}</footer>
  </section>
}

function ActivePlan({ plan, onReset }: { plan: TrainingPlan; onReset: () => void }) {
  const [weekIndex, setWeekIndex] = useState(0)
  const week = plan.weeks[weekIndex]
  return <div className="active-plan"><section className="plan-hero panel"><div><span className="eyebrow">YOUR {plan.answers.raceDistance.toUpperCase()} PLAN</span><h2>Race day has a route now.</h2><p>{plan.summary}</p><div className="plan-kpis"><span><small>Target pace</small><strong>{plan.targetPace}</strong></span><span><small>Race date</small><strong>{new Date(`${plan.answers.raceDate}T12:00:00`).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })}</strong></span><span><small>Long-run day</small><strong>{plan.answers.longRunDay}</strong></span></div></div><div className="plan-race-disc"><Target /><strong>{plan.answers.raceDistance}</strong><small>{plan.answers.targetTime}</small></div></section>
    <div className="plan-toolbar"><div><button disabled={weekIndex === 0} onClick={() => setWeekIndex((value) => value - 1)} aria-label="Previous week"><ChevronLeft /></button><span><small>VIEWING</small><strong>{week.label} of {plan.weeks.length}</strong></span><button disabled={weekIndex === plan.weeks.length - 1} onClick={() => setWeekIndex((value) => value + 1)} aria-label="Next week"><ChevronRight /></button></div><button onClick={onReset}>Edit answers</button></div>
    <section className="panel plan-week"><header><div><span className="eyebrow">{week.isTaper ? 'TAPER WEEK' : `WEEK ${week.week}`}</span><h3>{week.focus}</h3><p>{week.totalKm} km planned across {week.sessions.filter((session) => session.type !== 'Strength').length} runs.</p></div><div className="week-volume"><strong>{week.totalKm}</strong><small>KM</small></div></header><div className="session-list">{week.sessions.map((session, index) => <article className="session-card" key={`${session.day}-${session.type}`}><span className={`session-type type-${session.type.toLowerCase().replace(' ', '-')}`}>{session.type === 'Intervals' ? <Zap /> : session.type === 'Long run' ? <Route /> : session.type === 'Strength' ? <Medal /> : <Footprints />}</span><div><small>{session.day.toUpperCase()}</small><h4>{session.type}{session.distanceKm ? ` · ${session.distanceKm} km` : ''}</h4><p>{session.detail}</p></div><span className="session-pace"><small>{session.type === 'Strength' ? 'DURATION' : 'PACE'}</small><strong>{session.pace}</strong></span><button aria-label={`Mark ${session.type} complete`}><Check /></button>{index < week.sessions.length - 1 && <i />}</article>)}</div></section>
    <section className="plan-weeks-overview panel"><header className="panel-header"><div><span className="eyebrow">THE FULL BUILD</span><h3>{plan.weeks.length}-week overview</h3></div></header><div>{plan.weeks.map((item, index) => <button className={weekIndex === index ? 'active' : ''} onClick={() => setWeekIndex(index)} key={item.week}><span>{item.week}</span><strong>{item.totalKm} km</strong><small>{item.focus}</small></button>)}</div></section>
    <div className="training-safety"><ShieldCheck /><p>This plan is a starting point, not medical advice. Reduce or stop training if pain persists, and seek qualified guidance for injuries or health concerns.</p></div>
  </div>
}

function PlanPage() {
  const [plan, setPlan] = useState<TrainingPlan | null>(() => loadPlan())
  return <div className="app-page">{plan ? <ActivePlan plan={plan} onReset={() => { localStorage.removeItem(PLAN_STORAGE_KEY); setPlan(null) }} /> : <><div className="page-intro compact"><div><span className="eyebrow">TRAINING PLAN</span><h2>What are you running towards?</h2><p>Build a plan that starts with your goal and respects the rest of your life.</p></div></div><PlanQuestionnaire onGenerated={setPlan} /></>}</div>
}

function ProfilePage() {
  const { user } = useAuth()
  return <div className="app-page"><div className="page-intro compact"><div><span className="eyebrow">YOUR ACCOUNT</span><h2>Profile and preferences.</h2><p>Manage your runner details, activity sources and privacy controls.</p></div></div><div className="profile-grid"><section className="panel profile-card"><Avatar initials={user?.initials ?? 'RL'} colour="#1646d8" size="large" /><div><h3>{user?.name}</h3><p>{user?.email}</p><span>Member since September 2026</span></div><button className="button button-outline button-small">Edit profile</button></section><section className="panel connection-card"><header><span className="icon-tile"><Activity /></span><div><h3>Activity connections</h3><p>Provider connections are ready for production setup.</p></div></header><div><span><strong>Garmin</strong><small>Demo activity source</small></span><button>Connect</button></div><div><span><strong>FIT / GPX upload</strong><small>Manual file import</small></span><button>Upload</button></div></section><section className="panel preferences-card"><h3>League preferences</h3><label><span><strong>Weekly result email</strong><small>Monday morning summary</small></span><input type="checkbox" defaultChecked /></label><label><span><strong>League activity notifications</strong><small>Moves, scores and invites</small></span><input type="checkbox" defaultChecked /></label><label><span><strong>Public profile</strong><small>Visible outside your private leagues</small></span><input type="checkbox" /></label></section></div></div>
}

function NotFound() {
  return <div className="not-found"><Logo /><strong>404</strong><h1>That route has gone for a run.</h1><p>Head back to the home page and try again.</p><AppLink to="/" className="button button-primary">Back home</AppLink></div>
}

export default function App() {
  const path = usePath()
  const { user } = useAuth()
  useEffect(() => {
    document.title = path.startsWith('/app') ? 'RunningLeague — Member dashboard' : 'RunningLeague — Every run counts'
  }, [path])

  if (path === '/') return <PublicHome />
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
