import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { PortalProvider } from './lib/store'
import './index.css'

// The provider sits above <App> so the store survives the login/logout branch
// and the active module is read from the URL hash on the very first render.
// The non-null assertion on getElementById becomes a runtime throw: the cast
// would only move the failure to the first line of app code.
const container = document.getElementById('root')
if (!container) throw new Error('index.html is missing the #root mount point')

ReactDOM.createRoot(container).render(
  <React.StrictMode>
    <PortalProvider>
      <App />
    </PortalProvider>
  </React.StrictMode>,
)
