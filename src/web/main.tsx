import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import './index.css'
import App from './App'
import { MetaProvider } from './lib/meta'
import { ToastProvider } from './lib/toast'
import { DialogProvider } from './ui/kit'
import { applyLangToDocument, startDomTranslator } from './lib/i18n'

applyLangToDocument()

const qc = new QueryClient({ defaultOptions: { queries: { staleTime: 15_000, refetchOnWindowFocus: false, retry: 1 } } })
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <ToastProvider><DialogProvider><MetaProvider><App /></MetaProvider></DialogProvider></ToastProvider>
      </BrowserRouter>
    </QueryClientProvider>
  </StrictMode>,
)
startDomTranslator()
