import {ExtractionPage} from './pages/ExtractionPage'
import {DepositPage} from './pages/DepositPage'
import {CustodyPage} from './pages/CustodyPage'
import {RfqComparisonPage,CompetencyPage} from './pages/EnterprisePages'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { Suspense, lazy, type ReactNode } from 'react'
import { useMeta } from './lib/meta'
import { Shell } from './components/Shell'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Workspaces, WorkspaceUtilities } from './pages/Workspaces'
import { EntityListPage, EntityRecordPage } from './pages/EntityPages'
import { JobPage } from './pages/JobPage'
import { JobSearch, TrackingPage } from './pages/SearchPages'
import { CalendarPage } from './pages/CalendarPage'
import { ReportsPage, KpiPage } from './pages/ReportPages'
import { StockPage } from './pages/WarehousePages'
import { ToolsPage } from './pages/ToolsPage'
import { DocumentsPage } from './pages/DocumentsPage'
import { ProfilePage } from './pages/ProfilePage'
import { RolesPage, SettingsPage, AuditPage, BackupPage } from './pages/AdminPages'
import { CompliancePage } from './pages/CompliancePage'
import { JobControlPage } from './pages/JobControlPage'
import { WorkQueuePage,HandoverPage } from './pages/WorkPages'
import { ScopePage } from './pages/ScopePage'
import { PublicTrack } from './pages/PublicTrack'
import { IntegrationsPage } from './pages/IntegrationsPage'
import { AiPage } from './pages/AiPage'
import { WhatsAppPage } from './pages/WhatsAppPage'
import { BankImportPage, YearEndPage, WpsPage } from './pages/FinanceExtras'
import { PrintPage } from './print/PrintPage'
import { Loading, ErrorBox } from './ui/kit'

function Guard({ module, children }: { module: string; children: ReactNode }) {
  const { can } = useMeta()
  return can(module, 'view') ? <>{children}</> : <ErrorBox error={new Error('You do not have access to this page. Ask an administrator to grant the permission.')} />
}
const Statements = () => <ReportsPage fixed={['trial_balance', 'profit_loss', 'balance_sheet', 'general_ledger', 'vat_return', 'ar_aging', 'ap_aging', 'tax_invoice_register']} />

export default function App() {
  const { me, loading } = useMeta()
  const loc = useLocation()
  if (loc.pathname.startsWith('/t/')) return <Routes><Route path="/t/:token" element={<PublicTrack />} /></Routes>
  if (loading) return <div className="h-full grid place-items-center"><Loading label="Starting Elvora Logistics OS…" /></div>
  if (!me) return <Routes><Route path="/login" element={<Login />} /><Route path="*" element={<Navigate to="/login" replace state={{ from: loc.pathname }} />} /></Routes>
  if (me.mustChangePassword && !loc.pathname.startsWith('/profile') && !loc.pathname.startsWith('/print')) return <Navigate to="/profile" replace />
  return (
    <Suspense fallback={<Loading />}>
      <Routes>
        <Route path="/login" element={<Navigate to="/" replace />} />
        <Route element={<Shell />}>
          <Route index element={<Workspaces />} />
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/workspace/:workspace" element={<Workspaces key={loc.pathname} />} />
          <Route path="/workspace-tools" element={<WorkspaceUtilities />} />
          <Route path="/jobs/:id/closure" element={<Guard module="jobs"><JobControlPage /></Guard>} />
          <Route path="/jobs/:id" element={<Guard module="jobs"><JobPage /></Guard>} />
          <Route path="/e/:entity" element={<EntityListPage />} />
          <Route path="/e/:entity/:id" element={<EntityRecordPage />} />
          <Route path="/search" element={<Guard module="jobs"><JobSearch /></Guard>} />
          <Route path="/tracking" element={<Guard module="jobs"><TrackingPage /></Guard>} />
          <Route path="/extractions/:id" element={<Guard module="documents"><ExtractionPage /></Guard>} />
          <Route path="/container-deposits/:id" element={<Guard module="finance"><DepositPage /></Guard>} />
          <Route path="/originals/:id" element={<Guard module="documents"><CustodyPage /></Guard>} />
          <Route path="/rfqs/:id/compare" element={<Guard module="sales"><RfqComparisonPage /></Guard>} />
          <Route path="/competency" element={<Guard module="hr"><CompetencyPage /></Guard>} />
          <Route path="/work/queues" element={<Guard module="projects"><WorkQueuePage /></Guard>} />
          <Route path="/work/handovers" element={<Guard module="projects"><HandoverPage /></Guard>} />
          <Route path="/calendar" element={<CalendarPage />} />
          <Route path="/reports" element={<Guard module="reports"><ReportsPage /></Guard>} />
          <Route path="/finance/statements" element={<Guard module="finance"><Statements /></Guard>} />
          <Route path="/kpi" element={<Guard module="reports"><KpiPage /></Guard>} />
          <Route path="/warehouse/stock" element={<Guard module="warehouse"><StockPage /></Guard>} />
          <Route path="/documents" element={<Guard module="documents"><DocumentsPage /></Guard>} />
          <Route path="/tools" element={<ToolsPage />} />
          <Route path="/profile" element={<ProfilePage />} />
          <Route path="/admin/roles" element={<Guard module="admin"><RolesPage /></Guard>} />
          <Route path="/admin/settings" element={<Guard module="admin"><SettingsPage /></Guard>} />
          <Route path="/admin/audit" element={<Guard module="admin"><AuditPage /></Guard>} />
          <Route path="/admin/integrations" element={<Guard module="admin"><IntegrationsPage /></Guard>} />
          <Route path="/ai" element={<Guard module="ai"><AiPage /></Guard>} />
          <Route path="/whatsapp" element={<Guard module="crm"><WhatsAppPage /></Guard>} />
          <Route path="/finance/bank-import" element={<Guard module="finance"><BankImportPage /></Guard>} />
          <Route path="/finance/year-end" element={<Guard module="finance"><YearEndPage /></Guard>} />
          <Route path="/hr/wps" element={<Guard module="hr"><WpsPage /></Guard>} />
          <Route path="/compliance" element={<Guard module="compliance"><CompliancePage /></Guard>} />
          <Route path="/admin/scope" element={<Guard module="admin"><ScopePage /></Guard>} />
          <Route path="/admin/backup" element={<Guard module="admin"><BackupPage /></Guard>} />
          <Route path="/print/:entity/:id" element={<PrintPage />} />
          <Route path="*" element={<ErrorBox error={new Error('Page not found')} />} />
        </Route>
      </Routes>
    </Suspense>
  )
}
void lazy


