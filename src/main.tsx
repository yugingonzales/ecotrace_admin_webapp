import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { PortalProvider } from './lib/store'
import './index.css'

// The provider sits above <App> so the store survives the login/logout branch
// and the active module is read from the URL hash on the very first render.
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <PortalProvider>
      <App />
    </PortalProvider>
  </React.StrictMode>,
)
