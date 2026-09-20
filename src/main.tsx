import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider, useAuth } from './auth'
import { PlatformProvider } from './platform'
import './styles.css'

function AccountPlatform() {
  const { user } = useAuth()
  return <PlatformProvider key={user?.id ?? 'signed-out'}><App /></PlatformProvider>
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <AccountPlatform />
    </AuthProvider>
  </StrictMode>,
)
