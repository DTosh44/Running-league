import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'
import { AuthProvider } from './auth'
import { PlatformProvider } from './platform'

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
