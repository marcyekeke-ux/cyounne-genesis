import { useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Brain, KeyRound, BookOpen, Image as ImageIcon, Users, Bell, MessageCircle, FileText } from "lucide-react";
import AdminDashboardView from "@/pages/admin/AdminDashboard";
import AdminApiKeys from "@/pages/admin/AdminApiKeys";
import AdminKnowledge from "@/pages/admin/AdminKnowledge";
import AdminMedia from "@/pages/admin/AdminMedia";
import AdminMembers from "@/pages/admin/AdminMembers";
import AdminAlerts from "@/pages/admin/AdminAlerts";
import AdminWhatsApp from "@/pages/admin/AdminWhatsApp";
import AdminReports from "@/pages/admin/AdminReports";

const TABS = [
  { id: "dashboard", label: "Vision", icon: Brain, Component: AdminDashboardView },
  { id: "api", label: "Clés API", icon: KeyRound, Component: AdminApiKeys },
  { id: "knowledge", label: "Connaissances", icon: BookOpen, Component: AdminKnowledge },
  { id: "media", label: "Médias", icon: ImageIcon, Component: AdminMedia },
  { id: "members", label: "Membres", icon: Users, Component: AdminMembers },
  { id: "alerts", label: "Alertes", icon: Bell, Component: AdminAlerts },
  { id: "whatsapp", label: "WhatsApp", icon: MessageCircle, Component: AdminWhatsApp },
  { id: "reports", label: "Rapports", icon: FileText, Component: AdminReports },
];

export function AdminPanel() {
  const [tab, setTab] = useState("dashboard");

  return (
    <Tabs value={tab} onValueChange={setTab} className="h-full flex flex-col">
      <TabsList className="mx-4 mt-3 grid grid-cols-4 md:grid-cols-8 gap-1 bg-secondary/40 p-1 h-auto">
        {TABS.map((t) => {
          const Icon = t.icon;
          return (
            <TabsTrigger key={t.id} value={t.id} className="flex flex-col items-center gap-1 py-2 text-[10px] data-[state=active]:bg-gradient-primary data-[state=active]:text-primary-foreground">
              <Icon className="w-3.5 h-3.5" />
              <span>{t.label}</span>
            </TabsTrigger>
          );
        })}
      </TabsList>
      <div className="flex-1 overflow-y-auto">
        {TABS.map((t) => {
          const C = t.Component as any;
          return (
            <TabsContent key={t.id} value={t.id} className="mt-0 data-[state=inactive]:hidden">
              <C />
            </TabsContent>
          );
        })}
      </div>
    </Tabs>
  );
}
