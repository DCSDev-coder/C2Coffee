import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import AdminToast from './components/AdminToast.jsx'
import AdminDialog from './components/AdminDialog.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
    <AdminToast />
    <AdminDialog />
  </StrictMode>,
)
