import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import { AuthProvider } from './auth'
import { PlatformProvider } from './platform'

vi.mock('./screenshot-import', () => ({
  readStravaScreenshot: async () => ({ distanceKm: 5.02, elevationM: 32, elapsedSeconds: 1460, movingSeconds: 1440 }),
  formatScreenshotTime: (seconds: number) => {
    const clock = [Math.floor(seconds / 3600), Math.floor(seconds / 60) % 60, seconds % 60]
    return clock.map((value) => String(value).padStart(2, '0')).join(':')
  },
}))

const renderApp = (path = '/') => {
  window.history.replaceState({}, '', path)
  return render(<AuthProvider><PlatformProvider><App /></PlatformProvider></AuthProvider>)
}

describe('RunningLeague product', () => {
  const logInDemo = async () => {
    fireEvent.click(screen.getByRole('button', { name: 'Use demo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    await waitFor(() => screen.getByText(/Welcome, Darren/i))
  }

  it('shows the public proposition and main product areas', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: /Every run gets a score/i })).toBeInTheDocument()
    expect(screen.getByText('A fairer way to compare effort.')).toBeInTheDocument()
    expect(screen.getByText('A plan that fits around your week.')).toBeInTheDocument()
  })

  it('logs in with the demo account', async () => {
    renderApp('/login')
    await logInDemo()
    await waitFor(() => expect(screen.getByText(/Welcome, Darren/i)).toBeInTheDocument())
    expect(window.location.pathname).toBe('/app')
  })

  it('never stores registration passwords locally', async () => {
    renderApp('/signup')
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex Runner' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'alex@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1!' } })
    fireEvent.click(screen.getByRole('button', { name: /Create free account/ }))

    expect(await screen.findByText(/Secure account creation requires/)).toBeInTheDocument()
    expect(JSON.stringify(localStorage)).not.toContain('StrongPass1!')
  })

  it('generates and displays a race plan', async () => {
    renderApp('/login')
    await logInDemo()

    fireEvent.click(screen.getByRole('link', { name: /Training plan/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    fireEvent.click(screen.getByRole('button', { name: /Generate my plan/ }))

    expect(await screen.findByText('Race day has a route now.')).toBeInTheDocument()
    expect(screen.getByText(/Week 1 of/)).toBeInTheDocument()
  })

  it('adds and scores a manual run', async () => {
    renderApp('/login')
    await logInDemo()
    fireEvent.click(screen.getByRole('link', { name: /Activities/i }))
    fireEvent.click(screen.getByRole('button', { name: /Enter run/i }))
    fireEvent.change(screen.getByLabelText('Run name'), { target: { value: 'Lunch 5K' } })
    fireEvent.click(screen.getByRole('button', { name: /Add and score run/i }))
    expect(await screen.findByText('Run added and scored.')).toBeInTheDocument()
    expect(screen.getByText('Lunch 5K')).toBeInTheDocument()
  })


  it('reviews up to two screenshots and refuses unverified demo submissions', async () => {
    renderApp('/login')
    await logInDemo()
    fireEvent.click(screen.getByRole('link', { name: /Activities/i }))
    const picker = screen.getByLabelText('Choose Strava screenshots')
    fireEvent.change(picker, { target: { files: [new File(['image'], 'overview.png', { type: 'image/png' })] } })
    expect(await screen.findByText(/Moving time detected/)).toBeInTheDocument()
    expect(screen.getByLabelText('Distance (km)')).toHaveValue(5.02)
    expect(screen.getByLabelText('Elevation gain (m)')).toHaveValue(32)
    expect(screen.getByLabelText('Elapsed time (HH:MM:SS)')).toHaveValue('00:24:20')
    expect(screen.getByLabelText('Run date and time')).toHaveValue('')

    const second = screen.getByLabelText('Add a second Strava screenshot')
    fireEvent.change(second, { target: { files: [new File(['image2'], 'details.png', { type: 'image/png' })] } })
    await waitFor(() => expect(screen.queryByRole('button', { name: /Add second screenshot with elapsed time/ })).not.toBeInTheDocument())
    fireEvent.change(screen.getByLabelText('Run date and time'), { target: { value: '2026-11-07T08:30' } })
    fireEvent.click(screen.getByRole('checkbox', { name: /I can see the full elapsed time/ }))
    fireEvent.click(screen.getByRole('button', { name: /Submit for organiser review/ }))
    expect(await screen.findByText(/Verified screenshot submissions require a live Running League account/)).toBeInTheDocument()
    expect(screen.queryByText('Strava run')).not.toBeInTheDocument()
  })

  it('creates a private league with an invite code', async () => {
    renderApp('/login')
    await logInDemo()
    fireEvent.click(screen.getByRole('link', { name: /Leagues/i }))
    fireEvent.click(screen.getByRole('button', { name: /Create a league/i }))
    fireEvent.change(screen.getByLabelText('League name'), { target: { value: 'Saturday Crew' } })
    fireEvent.click(screen.getByRole('button', { name: /Create league/i }))
    expect(await screen.findByText('Saturday Crew')).toBeInTheDocument()
  })

  it('marks a training session complete', async () => {
    renderApp('/login')
    await logInDemo()
    fireEvent.click(screen.getByRole('link', { name: /Training plan/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    fireEvent.click(screen.getByRole('button', { name: /Generate my plan/ }))
    const completeButton = await screen.findByRole('button', { name: 'Mark Intervals complete' })
    fireEvent.click(completeButton)
    expect(await screen.findByRole('button', { name: 'Mark Intervals incomplete' })).toBeInTheDocument()
  })
})
