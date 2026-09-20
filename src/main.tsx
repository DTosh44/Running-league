import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { AuthProvider } from './auth'
import { PlatformProvider } from './platform'
import './styles.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AuthProvider>
      <PlatformProvider>
        <App />
      </PlatformProvider>
    </AuthProvider>
  </StrictMode>,
)
