import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import Index from "./pages/Index.tsx";
import NotFound from "./pages/NotFound.tsx";
import Auth from "./pages/Auth.tsx";
import Chat from "./pages/Chat.tsx";
import AdminDashboard from "./pages/admin/AdminDashboard.tsx";
import AdminApiKeys from "./pages/admin/AdminApiKeys.tsx";
import AdminKnowledge from "./pages/admin/AdminKnowledge.tsx";
import AdminMedia from "./pages/admin/AdminMedia.tsx";
import AdminMembers from "./pages/admin/AdminMembers.tsx";
import AdminAlerts from "./pages/admin/AdminAlerts.tsx";
import AdminReports from "./pages/admin/AdminReports.tsx";
import AdminWhatsApp from "./pages/admin/AdminWhatsApp.tsx";
import AdminSettings from "./pages/admin/AdminSettings.tsx";
import AdminTrends from "./pages/admin/AdminTrends.tsx";
import AdminSyncApps from "./pages/admin/AdminSyncApps.tsx";
import AdminTontineRules from "./pages/admin/AdminTontineRules.tsx";
import AdminTontineLate from "./pages/admin/AdminTontineLate.tsx";
import Embed from "./pages/Embed.tsx";
import { ProtectedRoute } from "./components/cyounne/ProtectedRoute.tsx";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Index />} />
          <Route path="/auth" element={<Auth />} />
          {/* Cyounne accessible sans compte (Genesis gère l'auth en amont) */}
          <Route path="/chat" element={<ProtectedRoute><Chat /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/api-keys" element={<ProtectedRoute adminOnly><AdminApiKeys /></ProtectedRoute>} />
          <Route path="/admin/knowledge" element={<ProtectedRoute adminOnly><AdminKnowledge /></ProtectedRoute>} />
          <Route path="/admin/media" element={<ProtectedRoute adminOnly><AdminMedia /></ProtectedRoute>} />
          <Route path="/admin/members" element={<ProtectedRoute adminOnly><AdminMembers /></ProtectedRoute>} />
          <Route path="/admin/alerts" element={<ProtectedRoute adminOnly><AdminAlerts /></ProtectedRoute>} />
          <Route path="/admin/whatsapp" element={<ProtectedRoute adminOnly><AdminWhatsApp /></ProtectedRoute>} />
          <Route path="/admin/reports" element={<ProtectedRoute adminOnly><AdminReports /></ProtectedRoute>} />
          <Route path="/admin/settings" element={<ProtectedRoute adminOnly><AdminSettings /></ProtectedRoute>} />
          <Route path="/admin/trends" element={<ProtectedRoute adminOnly><AdminTrends /></ProtectedRoute>} />
          <Route path="/admin/sync-apps" element={<ProtectedRoute adminOnly><AdminSyncApps /></ProtectedRoute>} />
          <Route path="/admin/tontine-rules" element={<ProtectedRoute adminOnly><AdminTontineRules /></ProtectedRoute>} />
          <Route path="/embed" element={<Embed />} />
          {/* catch-all */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
