import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type DepartmentPoint = {
  department: string;
  participants: number;
};

export type StatusPoint = {
  status: string;
  count: number;
};

export type ScorePoint = {
  name: string;
  score: number;
};

export function AnalyticsCharts({
  departmentData,
  statusData,
  scoreData,
}: {
  departmentData: DepartmentPoint[];
  statusData: StatusPoint[];
  scoreData: ScorePoint[];
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-2 h-full">
      <article className="t-card p-5 min-w-0">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Participation by Department
        </h3>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <BarChart data={departmentData}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="department" stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} allowDecimals={false} />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-main)",
                  borderRadius: "10px",
                  color: "var(--text-primary)",
                }}
                labelStyle={{ color: 'var(--text-secondary)' }}
              />
              <defs>
                <linearGradient id="barGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--chart-bar-1)" stopOpacity={1} />
                  <stop offset="100%" stopColor="var(--chart-bar-2)" stopOpacity={0.8} />
                </linearGradient>
              </defs>
              <Bar dataKey="participants" fill="url(#barGrad)" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </article>

      <article className="t-card p-5 min-w-0">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Top Teams Scores
        </h3>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <AreaChart data={scoreData}>
              <defs>
                <linearGradient id="scoreFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="var(--chart-area)" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="var(--chart-area)" stopOpacity={0.02} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--chart-grid)" />
              <XAxis dataKey="name" stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} hide />
              <YAxis stroke="var(--text-muted)" tick={{ fontSize: 12, fill: 'var(--text-secondary)' }} />
              <Tooltip
                contentStyle={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-main)",
                  borderRadius: "10px",
                  color: "var(--text-primary)",
                }}
                labelStyle={{ color: 'var(--text-secondary)' }}
              />
              <Area
                type="monotone"
                dataKey="score"
                stroke="var(--chart-area)"
                fill="url(#scoreFill)"
                strokeWidth={3}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </article>
    </section>
  );
}
