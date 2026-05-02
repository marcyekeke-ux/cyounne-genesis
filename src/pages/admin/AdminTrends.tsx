import { useEffect, useMemo, useState } from "react";
import { invokeCyounneAdmin } from "@/lib/cyounneAdmin";
import { Card } from "@/components/ui/card";
import { TrendingUp, Users, Activity, ShieldCheck, Sparkles } from "lucide-react";
import { LineChart, Line, BarChart, Bar, AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from "recharts";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

type Member = { id: string; full_name: string; trust_score: number; cumul: number; creances: number; gages: number; status: string; joined_at: string };
type Msg = { created_at: string; user_id: string };

export default function AdminTrends() {
  const [members, setMembers] = useState<Member[]>([]);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [selected, setSelected] = useState<string>("");

  useEffect(() => {
    (async () => {
      try {
        const [m, msg] = await Promise.all([
          invokeCyounneAdmin<{ data: Member[] }>("select", { table: "members", order: { column: "joined_at", ascending: true } }),
          invokeCyounneAdmin<{ data: Msg[] }>("select", { table: "messages", order: { column: "created_at", ascending: true } }),
        ]);
        setMembers(m.data ?? []);
        setMessages(msg.data ?? []);
        if (m.data?.[0]) setSelected(m.data[0].id);
      } catch (e: any) { toast.error(e?.message); }
    })();
  }, []);

  // Croissance journalière + prédiction (régression linéaire simple sur 30j)
  const growthData = useMemo(() => {
    const map = new Map<string, number>();
    members.forEach((m) => {
      const d = m.joined_at?.slice(0, 10);
      if (d) map.set(d, (map.get(d) ?? 0) + 1);
    });
    const sorted = [...map.entries()].sort(([a], [b]) => a.localeCompare(b));
    let cum = 0;
    const series = sorted.map(([date, n]) => { cum += n; return { date, total: cum, new: n }; });

    // Prédiction 14j sur tendance
    if (series.length >= 2) {
      const n = series.length;
      const xs = series.map((_, i) => i);
      const ys = series.map((s) => s.total);
      const meanX = xs.reduce((a, b) => a + b, 0) / n;
      const meanY = ys.reduce((a, b) => a + b, 0) / n;
      const slope = xs.reduce((a, x, i) => a + (x - meanX) * (ys[i] - meanY), 0) /
                    (xs.reduce((a, x) => a + (x - meanX) ** 2, 0) || 1);
      const intercept = meanY - slope * meanX;
      const lastDate = new Date(series[n - 1].date);
      for (let k = 1; k <= 14; k++) {
        const d = new Date(lastDate); d.setDate(d.getDate() + k);
        series.push({
          date: d.toISOString().slice(0, 10),
          total: 0 as any,
          new: 0,
          predicted: Math.max(0, Math.round(intercept + slope * (n - 1 + k))),
        } as any);
      }
    }
    return series;
  }, [members]);

  const memberActivity = useMemo(() => {
    if (!selected) return [];
    const member = members.find((m) => m.id === selected);
    if (!member) return [];
    const map = new Map<string, number>();
    messages.filter((x) => x.user_id === (member as any).user_id).forEach((x) => {
      const d = x.created_at.slice(0, 10);
      map.set(d, (map.get(d) ?? 0) + 1);
    });
    return [...map.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, count]) => ({ date, count }));
  }, [selected, members, messages]);

  const reliabilityDistribution = useMemo(() => {
    const buckets = { critique: 0, faible: 0, moyen: 0, bon: 0, excellent: 0 };
    members.forEach((m) => {
      const t = m.trust_score ?? 0;
      if (t < 30) buckets.critique++;
      else if (t < 60) buckets.faible++;
      else if (t < 80) buckets.moyen++;
      else if (t < 95) buckets.bon++;
      else buckets.excellent++;
    });
    return Object.entries(buckets).map(([k, v]) => ({ niveau: k, n: v }));
  }, [members]);

  const conversionsByMember = useMemo(() => {
    return [...members]
      .map((m) => ({ name: m.full_name, cumul: Number(m.cumul) || 0, creances: Number(m.creances) || 0, gages: Number(m.gages) || 0 }))
      .sort((a, b) => b.cumul - a.cumul)
      .slice(0, 10);
  }, [members]);

  return (
    <div className="p-6 md:p-10 space-y-6">
      <header className="flex items-center gap-3">
        <TrendingUp className="w-7 h-7 text-accent" />
        <div>
          <h1 className="font-display text-3xl font-black text-gradient">Tendances & Prédictions</h1>
          <p className="text-sm text-muted-foreground">Analyse Cyounne · activité, fiabilité, conversions, prévisions</p>
        </div>
      </header>

      <section className="grid md:grid-cols-3 gap-4">
        <StatCard icon={Users} label="Membres totaux" value={members.length} color="from-blue-500 to-cyan-400" />
        <StatCard icon={ShieldCheck} label="Trust moyen" value={Math.round(members.reduce((a, m) => a + (m.trust_score ?? 0), 0) / (members.length || 1))} color="from-emerald-500 to-teal-400" />
        <StatCard icon={Sparkles} label="Cumul total" value={members.reduce((a, m) => a + (Number(m.cumul) || 0), 0)} color="from-violet-500 to-fuchsia-400" />
      </section>

      <Card className="glass p-5">
        <h2 className="font-display font-bold mb-3 flex items-center gap-2"><TrendingUp className="w-4 h-4 text-accent" /> Croissance & prédiction (14 jours)</h2>
        <ResponsiveContainer width="100%" height={280}>
          <AreaChart data={growthData}>
            <defs>
              <linearGradient id="g1" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--accent))" stopOpacity={0.6} />
                <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="g2" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity={0.5} />
                <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Legend />
            <Area type="monotone" dataKey="total" name="Réel" stroke="hsl(var(--accent))" fill="url(#g1)" strokeWidth={2} />
            <Area type="monotone" dataKey="predicted" name="Prédit" stroke="hsl(var(--primary))" fill="url(#g2)" strokeWidth={2} strokeDasharray="5 5" />
          </AreaChart>
        </ResponsiveContainer>
      </Card>

      <section className="grid md:grid-cols-2 gap-4">
        <Card className="glass p-5">
          <h2 className="font-display font-bold mb-3 flex items-center gap-2"><ShieldCheck className="w-4 h-4 text-accent" /> Distribution de fiabilité</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={reliabilityDistribution}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="niveau" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="n" fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        <Card className="glass p-5">
          <h2 className="font-display font-bold mb-3 flex items-center gap-2"><Sparkles className="w-4 h-4 text-accent" /> Top 10 conversions (cumul)</h2>
          <ResponsiveContainer width="100%" height={240}>
            <BarChart data={conversionsByMember} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={10} />
              <YAxis type="category" dataKey="name" stroke="hsl(var(--muted-foreground))" fontSize={10} width={100} />
              <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
              <Bar dataKey="cumul" fill="hsl(var(--accent))" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </section>

      <Card className="glass p-5">
        <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
          <h2 className="font-display font-bold flex items-center gap-2"><Activity className="w-4 h-4 text-accent" /> Activité par membre</h2>
          <Select value={selected} onValueChange={setSelected}>
            <SelectTrigger className="w-64"><SelectValue placeholder="Choisir un membre" /></SelectTrigger>
            <SelectContent>
              {members.map((m) => <SelectItem key={m.id} value={m.id}>{m.full_name}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={memberActivity}>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
            <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={10} />
            <YAxis stroke="hsl(var(--muted-foreground))" fontSize={10} />
            <Tooltip contentStyle={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: 8 }} />
            <Line type="monotone" dataKey="count" stroke="hsl(var(--accent))" strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        {memberActivity.length === 0 && <p className="text-sm text-muted-foreground text-center py-8">Aucune activité pour ce membre.</p>}
      </Card>
    </div>
  );
}

function StatCard({ icon: Icon, label, value, color }: any) {
  return (
    <Card className="glass p-5">
      <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-3`}>
        <Icon className="w-5 h-5 text-white" />
      </div>
      <div className="text-3xl font-display font-bold">{value}</div>
      <div className="text-xs uppercase tracking-widest text-muted-foreground mt-1">{label}</div>
    </Card>
  );
}
