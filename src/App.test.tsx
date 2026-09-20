import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import App from './App'
import { AuthProvider } from './auth'

const renderApp = (path = '/') => {
  window.history.replaceState({}, '', path)
  return render(<AuthProvider><App /></AuthProvider>)
}

describe('RunningLeague product', () => {
  it('shows the public proposition and main product areas', () => {
    renderApp()
    expect(screen.getByRole('heading', { name: /Every run gets a score/i })).toBeInTheDocument()
    expect(screen.getByText('A fairer way to compare effort.')).toBeInTheDocument()
    expect(screen.getByText('A plan that fits around your week.')).toBeInTheDocument()
  })

  it('logs in with the demo account', async () => {
    renderApp('/login')
    fireEvent.click(screen.getByRole('button', { name: 'Use demo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))

    await waitFor(() => expect(screen.getByText(/Good evening, Darren/i)).toBeInTheDocument())
    expect(window.location.pathname).toBe('/app')
  })

  it('creates a local demo account', async () => {
    renderApp('/signup')
    fireEvent.change(screen.getByLabelText('Your name'), { target: { value: 'Alex Runner' } })
    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'alex@example.com' } })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'StrongPass1!' } })
    fireEvent.click(screen.getByRole('button', { name: /Create account/ }))

    await waitFor(() => expect(screen.getByText(/Good evening, Alex/i)).toBeInTheDocument())
  })

  it('generates and displays a race plan', async () => {
    renderApp('/login')
    fireEvent.click(screen.getByRole('button', { name: 'Use demo' }))
    fireEvent.click(screen.getByRole('button', { name: 'Log in' }))
    await waitFor(() => screen.getByText(/Good evening, Darren/i))

    fireEvent.click(screen.getByRole('link', { name: /Training plan/i }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    fireEvent.click(screen.getByRole('button', { name: /Continue/ }))
    fireEvent.click(screen.getByRole('button', { name: /Generate my plan/ }))

    expect(await screen.findByText('Race day has a route now.')).toBeInTheDocument()
    expect(screen.getByText(/Week 1 of/)).toBeInTheDocument()
  })
})
