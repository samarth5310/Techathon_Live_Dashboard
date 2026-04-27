import {
  Area,
  AreaChart,
  Pie,
  PieChart,
  Cell,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export type ProblemStatementPoint = {
  name: string;
  value: number;
};

export type StatusPoint = {
  status: string;
  count: number;
};

export type ScorePoint = {
  name: string;
  score: number;
};

const THEME_COLORS = [
  'var(--accent-green)',
  'var(--accent-purple)',
  'var(--accent-blue)',
  'var(--accent-orange)',
  'var(--accent-cyan)',
  'var(--accent-pink)'
];

export function AnalyticsCharts({
  problemStatementData,
  statusData,
  scoreData,
}: {
  problemStatementData: ProblemStatementPoint[];
  statusData: StatusPoint[];
  scoreData: ScorePoint[];
}) {
  return (
    <section className="grid gap-4 xl:grid-cols-2 h-full">
      <article className="t-card p-5 min-w-0">
        <h3 className="mb-3 text-sm font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>
          Teams by Problem Statement
        </h3>
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%" minWidth={0}>
            <PieChart>
              <Pie
                data={problemStatementData}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={80}
                innerRadius={50}
                stroke="var(--border-main)"
                strokeWidth={2}
                paddingAngle={2}
              >
                {problemStatementData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={THEME_COLORS[index % THEME_COLORS.length]} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-main)",
                  borderRadius: "var(--card-radius)",
                  color: "var(--text-primary)",
                }}
                itemStyle={{ color: "var(--text-primary)", fontWeight: "bold" }}
              />
              <Legend wrapperStyle={{ fontSize: '11px', color: 'var(--text-secondary)' }} />
            </PieChart>
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
