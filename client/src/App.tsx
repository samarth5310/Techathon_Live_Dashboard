import {
  memo,
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
} from "firebase/firestore";
import { onAuthStateChanged, signInWithEmailAndPassword, signOut, type User } from "firebase/auth";
import {
  FiActivity,
  FiAward,
  FiBell,
  FiCalendar,
  FiCode,
  FiEye,
  FiX,
  FiGift,
  FiGrid,
  FiHash,
  FiImage,
  FiMaximize,
  FiMinimize,
  FiMonitor,
  FiMoon,
  FiPause,
  FiPlay,
  FiSearch,
  FiSun,
  FiTarget,
  FiTrendingUp,
  FiUsers,
  FiZap,
  FiCheck,
  FiClock,
  FiPlus,
  FiEdit3,
  FiMinus,
  FiRefreshCw,
} from "react-icons/fi";
import { auth, db } from "./firebase";
import {
  AnalyticsCharts,
  type ProblemStatementPoint,
  type StatusPoint,
  type ScorePoint,
} from "./components/AnalyticsCharts";
import AdminControlsPage from "./components/AdminControlsPage";
import TeamPortalPage from "./components/TeamPortalPage";
import {
  QuickLinksTile,
  ProblemStatementsTile,
  QuickHelpTile,
  TeamSpotlightTile,
  IdeaBoardTile,
  ResourceHubTile,
  HelpRequestsFeedTile,
  AudienceVotingTile,
} from "./components/DashboardTiles";
import type {
  ActivityItem,
  Announcement,
  GalleryItem,
  ScheduleItem,
  StatDoc,
  Team,
  TileConfig,
  TileType,
  TileSize,
} from "./types";
import { DEFAULT_TILES, TILE_TEMPLATES } from "./types";

const sidebarItems = [
  { label: "Dashboard", icon: FiGrid },
  { label: "Teams", icon: FiUsers },
  { label: "Schedule", icon: FiCalendar },
  { label: "Announcements", icon: FiBell },
  { label: "Gallery", icon: FiImage },
];

const defaultStats: StatDoc = {
  totalParticipants: 0,
  teamsRegistered: 0,
  projectsSubmitted: 0,
  activeNow: 0,
};

const adminEmailAllowlist = (import.meta.env.VITE_ADMIN_EMAILS ?? "admindashboard@techathon.com")
  .split(",")
  .map((email: string) => email.trim().toLowerCase())
  .filter(Boolean);

type DashboardState = {
  stats: StatDoc;
  teams: Team[];
  announcements: Announcement[];
  schedule: ScheduleItem[];
  activity: ActivityItem[];
  gallery: GalleryItem[];
  departmentAnalytics: DepartmentPoint[];
  submissionTrends: SubmissionPoint[];
  activeUsersOverTime: ActiveUserPoint[];
  listenerError: string;
  lastUpdatedMs: number | null;
  isLive: boolean;
};

type DashboardAction =
  | { type: "stats"; payload: StatDoc; lastUpdatedMs: number | null }
  | { type: "teams"; payload: Team[] }
  | { type: "announcements"; payload: Announcement[] }
  | { type: "schedule"; payload: ScheduleItem[] }
  | { type: "activity"; payload: ActivityItem[] }
  | { type: "gallery"; payload: GalleryItem[] }
  | { type: "departmentAnalytics"; payload: DepartmentPoint[] }
  | { type: "submissionTrends"; payload: SubmissionPoint[] }
  | { type: "activeUsersOverTime"; payload: ActiveUserPoint[] }
  | { type: "error"; payload: string }
  | { type: "live"; payload: boolean };

const initialState: DashboardState = {
  stats: defaultStats,
  teams: [],
  announcements: [],
  schedule: [],
  activity: [],
  gallery: [],
  departmentAnalytics: [],
  submissionTrends: [],
  activeUsersOverTime: [],
  listenerError: "",
  lastUpdatedMs: null,
  isLive: false,
};

function dashboardReducer(state: DashboardState, action: DashboardAction): DashboardState {
  switch (action.type) {
    case "stats":
      return {
        ...state,
        stats: action.payload,
        lastUpdatedMs: action.lastUpdatedMs ?? Date.now(),
        isLive: true,
      };
    case "teams":
      return { ...state, teams: action.payload, lastUpdatedMs: Date.now(), isLive: true };
    case "announcements":
      return { ...state, announcements: action.payload, lastUpdatedMs: Date.now(), isLive: true };
    case "schedule":
      return { ...state, schedule: action.payload, lastUpdatedMs: Date.now(), isLive: true };
    case "activity":
      return { ...state, activity: action.payload, lastUpdatedMs: Date.now(), isLive: true };
    case "gallery":
      return { ...state, gallery: action.payload, lastUpdatedMs: Date.now(), isLive: true };
    case "departmentAnalytics":
      return { ...state, departmentAnalytics: action.payload, lastUpdatedMs: Date.now(), isLive: true };
    case "submissionTrends":
      return { ...state, submissionTrends: action.payload, lastUpdatedMs: Date.now(), isLive: true };
    case "activeUsersOverTime":
      return { ...state, activeUsersOverTime: action.payload, lastUpdatedMs: Date.now(), isLive: true };
    case "error":
      return { ...state, listenerError: action.payload, isLive: false };
    case "live":
      return { ...state, isLive: action.payload };
    default:
      return state;
  }
}

function timestampToMillis(value: unknown): number | null {
  if (typeof value === "object" && value !== null && "toMillis" in value) {
    const candidate = value as { toMillis: () => number };
    return candidate.toMillis();
  }
  return null;
}

// Sparkline mini chart SVG
const Sparkline = memo(function Sparkline({ value, accent }: { value: number; accent: string }) {
  const points = useMemo(() => {
    const count = 12;
    const height = 28;
    const data: number[] = [];
    let v = Math.max(1, value * 0.6);
    for (let i = 0; i < count; i++) {
      v = Math.max(1, v + (Math.random() - 0.4) * (value * 0.15));
      data.push(v);
    }
    // normalize to height
    const max = Math.max(...data);
    const min = Math.min(...data);
    const range = max - min || 1;
    return data.map((d, i) => `${(i / (count - 1)) * 100},${height - ((d - min) / range) * (height - 4)}`).join(" ");
  }, [value]);
  
  const colorMap: Record<string, string> = { green: 'var(--accent-green)', purple: 'var(--accent-purple)', blue: 'var(--accent-blue)', orange: 'var(--accent-orange)', cyan: 'var(--accent-cyan)' };
  const c = colorMap[accent] || 'var(--accent-green)';
  
  return (
    <svg viewBox="0 0 100 28" className="w-full h-7 mt-2 opacity-60" preserveAspectRatio="none">
      <polyline fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" points={points} />
    </svg>
  );
});

const StatCard = memo(function StatCard({
  title,
  value,
  prefix = "",
  accent = "green",
  icon: Icon,
}: {
  title: string;
  value: number;
  prefix?: string;
  accent?: "green" | "purple" | "blue" | "orange" | "cyan";
  icon?: React.ComponentType<{ size?: number }>;
}) {
  return (
    <article className={`t-card stat-accent-${accent} p-5 h-full flex flex-col transition-all duration-300 group`}>
      <div className="flex items-center gap-4">
        {Icon && (
          <div className={`icon-circle icon-circle-${accent}`}>
            <Icon size={20} />
          </div>
        )}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>{title}</p>
          <p className="mt-1 text-3xl font-bold tracking-tight overflow-hidden text-ellipsis" style={{ color: 'var(--text-primary)' }}>
            {prefix}<AnimatedCounter value={value} />
          </p>
        </div>
      </div>
      <Sparkline value={value} accent={accent} />
    </article>
  );
});

const EventProgressTracker = memo(function EventProgressTracker({ currentPhase }: { currentPhase: string }) {
  const phases = ["inauguration", "hackathon", "evaluation", "valedictory"];
  const currentIndex = Math.max(0, phases.indexOf(currentPhase));
  
  return (
    <div className="t-card p-4 sm:p-5 w-full h-full overflow-hidden flex flex-col">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-secondary)' }}>Event Progress Tracker</h2>
      <div className="overflow-hidden pb-1">
      <div className="flex w-full items-center justify-between gap-2">
        {phases.map((phase, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          return (
            <div key={phase} className="flex flex-col items-center relative flex-1">
              <div className={`z-10 flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all ${
                isCompleted ? "border-transparent text-white" : 
                isCurrent ? "border-transparent" : ""
              }`} style={{
                borderColor: isCompleted || isCurrent ? 'var(--accent-green)' : 'var(--border-main)',
                background: isCompleted ? 'var(--accent-green)' : 'var(--bg-card)',
                color: isCompleted ? '#fff' : isCurrent ? 'var(--accent-green)' : 'var(--text-muted)',
              }}>
                {isCompleted ? <FiCheck size={14} /> : <span className="text-xs font-bold">{index + 1}</span>}
              </div>
              <p className={`mt-2 px-1 text-[9px] sm:text-xs leading-tight font-medium capitalize text-center`} style={{
                color: isCompleted || isCurrent ? 'var(--text-primary)' : 'var(--text-muted)'
              }}>{phase}</p>
              {index < phases.length - 1 && (
                <div className="absolute top-4 w-full left-[50%] h-[2px]" style={{
                  background: isCompleted ? 'var(--accent-green)' : 'var(--border-main)',
                  transform: "translateY(-50%)", zIndex: 0
                }} />
              )}
            </div>
          );
        })}
      </div>
      </div>
    </div>
  );
});

const CircularProgress = memo(function CircularProgress({ percentage, label }: { percentage: number; label: string }) {
  const radius = 52;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;
  
  return (
    <div className="t-card p-4 sm:p-6 flex flex-col items-center justify-center">
      <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider self-start" style={{ color: 'var(--text-secondary)' }}>{label}</h2>
      <div className="relative w-28 h-28 sm:w-32 sm:h-32">
        <svg className="w-full h-full" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r={radius} fill="none" stroke="var(--border-main)" strokeWidth="8" />
          <circle
            cx="60" cy="60" r={radius} fill="none"
            stroke="var(--accent-green)"
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="progress-ring-circle"
            style={{ filter: 'drop-shadow(0 0 6px var(--accent-green))' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>{percentage}%</span>
        </div>
      </div>
      <p className="mt-3 text-sm font-medium" style={{ color: 'var(--text-secondary)' }}>Complete</p>
    </div>
  );
});

function AnimatedCounter({ value }: { value: number }) {
  const [display, setDisplay] = useState(0);
  const previousRef = useRef(0);

  useEffect(() => {
    const from = previousRef.current;
    const to = value;
    const duration = 900;
    let frame = 0;
    const start = performance.now();

    const tick = (now: number) => {
      const progress = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(from + (to - from) * eased));
      if (progress < 1) {
        frame = requestAnimationFrame(tick);
      } else {
        previousRef.current = to;
      }
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value]);

  return <>{display.toLocaleString()}</>;
}

const LiveStatus = memo(function LiveStatus({
  isLive,
  lastUpdatedMs,
}: {
  isLive: boolean;
  lastUpdatedMs: number | null;
}) {
  const [nowMs, setNowMs] = useState(Date.now());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const relativeLabel = useMemo(() => {
    if (!lastUpdatedMs) {
      return "Waiting for first update";
    }

    const seconds = Math.max(0, Math.floor((nowMs - lastUpdatedMs) / 1000));
    if (seconds < 60) {
      return `Last updated ${seconds} second${seconds === 1 ? "" : "s"} ago`;
    }

    const minutes = Math.floor(seconds / 60);
    return `Last updated ${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }, [lastUpdatedMs, nowMs]);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
      <span className="inline-flex items-center gap-2 rounded-full px-3 py-1" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)', border: '1px solid var(--accent-green)', borderColor: 'rgba(45,224,143,0.25)' }}>
        <span className={`h-2.5 w-2.5 rounded-full ${isLive ? "live-dot" : ""}`} style={{ background: isLive ? 'var(--accent-green)' : 'var(--text-muted)' }} />
        {isLive ? "Live" : "Offline"}
      </span>
      <span style={{ color: 'var(--text-secondary)' }}>{relativeLabel}</span>
    </div>
  );
});

const activityTypeClasses: Record<ActivityItem["type"], string> = {
  submission: "bg-emerald-400",
  mentor: "bg-sky-400",
  join: "bg-amber-400",
  announcement: "bg-fuchsia-400",
};

const ActivityFeed = memo(function ActivityFeed({
  items,
  freshIds,
}: {
  items: ActivityItem[];
  freshIds: Set<string>;
}) {
  return (
    <article className="t-card p-5 h-full flex flex-col">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          <div className="icon-circle icon-circle-green" style={{ width: 32, height: 32 }}>
            <FiActivity size={15} />
          </div>
          Live Activity
        </h2>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Latest first</p>
      </div>

      <div className="space-y-2">
        {items.slice(0, 8).map((item) => (
          <div
            key={item.id}
            className={`t-inset p-3 ${freshIds.has(item.id) ? "activity-enter" : ""}`}
            style={{ borderRadius: 'var(--card-radius)' }}
          >
            <div className="flex items-start gap-3">
              <span className={`mt-1.5 h-2.5 w-2.5 rounded-full flex-shrink-0 ${activityTypeClasses[item.type]}`} />
              <div className="min-w-0">
                <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.message}</p>
                <p className="mt-1 text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{item.type}</p>
              </div>
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No activity yet.</p>}
      </div>
    </article>
  );
});

const GalleryPanel = memo(function GalleryPanel({ items }: { items: GalleryItem[] }) {
  const [slideIndex, setSlideIndex] = useState(0);

  useEffect(() => {
    if (slideIndex >= items.length) {
      setSlideIndex(0);
    }
  }, [items.length, slideIndex]);

  const currentSlide = items[slideIndex] ?? null;
  const rawUrl = currentSlide?.imageUrl ?? "";

  const getEmbedUrl = (url: string) => {
    if (!url) return "";
    const folderMatch = url.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    if (folderMatch) return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#grid`;
    
    if (url.includes("drive.google.com")) {
      const idMatch = url.match(/id=([a-zA-Z0-9-_]+)/);
      if (idMatch) return `https://drive.google.com/embeddedfolderview?id=${idMatch[1]}#grid`;
      
      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
      if (fileMatch) return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
    }
    return url;
  };

  const embedUrl = getEmbedUrl(rawUrl);
  const isDriveEmbed = embedUrl.includes("drive.google.com");

  return (
    <article className="t-card flex flex-col md:flex-row min-h-[420px] md:min-h-[600px] overflow-hidden">
      
      {/* Side selection list */}
      <div className="w-full md:w-1/3 p-4 sm:p-5 lg:p-6 flex flex-col max-h-[280px] sm:max-h-[360px] md:max-h-none overflow-y-auto" style={{ background: 'var(--bg-card-alt)', borderRight: '1px solid var(--border-main)' }}>
        <h2 className="flex items-center gap-2 text-xl font-bold mb-6" style={{ color: 'var(--text-primary)' }}>
          <div className="icon-circle icon-circle-green">
             <FiImage size={16} />
          </div>
          Gallery Drives
        </h2>
        
        <div className="flex-1 space-y-3">
          {items.map((item, index) => (
            <button
              type="button"
              key={item.id}
              onClick={() => setSlideIndex(index)}
              className="w-full text-left p-4 transition-all duration-300 flex items-center gap-4"
              style={{
                background: index === slideIndex ? 'var(--accent-green-dim)' : 'var(--bg-card)',
                border: index === slideIndex ? '2px solid var(--accent-green)' : '1px solid var(--border-main)',
                borderRadius: 'var(--card-radius)',
                transform: index === slideIndex ? 'scale(1.02)' : 'scale(1)',
              }}
            >
              <div 
                className="w-10 h-10 sm:w-12 sm:h-12 flex items-center justify-center flex-shrink-0 font-black text-base sm:text-xl text-black border-2 border-white shadow-[4px_4px_0px_white]"
                style={{ background: ['var(--accent-green)', 'var(--accent-purple)', 'var(--accent-blue)', 'var(--accent-orange)'][index % 4] }}
              >
                {index + 1}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-bold truncate" style={{ color: index === slideIndex ? 'var(--accent-green)' : 'var(--text-primary)' }}>
                  {item.uploadedBy || `Connection 0${index + 1}`}
                </p>
                <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{item.imageUrl.substring(0, 30)}...</p>
              </div>
            </button>
          ))}
          {items.length === 0 && (
             <div className="text-center py-10 t-inset border-dashed" style={{ borderRadius: 'var(--card-radius)' }}>
                <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No Connections Active.</p>
                <p className="text-[11px] mt-1" style={{ color: 'var(--text-muted)' }}>Paste a Google Drive URL in Admin</p>
             </div>
          )}
        </div>
      </div>

      {/* Main Viewport */}
      <div className="w-full md:w-2/3 p-4 sm:p-5 lg:p-6 flex flex-col" style={{ background: 'var(--bg-card)' }}>
        <div className="w-full h-full min-h-[320px] md:min-h-[550px] overflow-hidden flex items-center justify-center relative" style={{ background: 'var(--bg-inset)', border: '1px solid var(--border-main)', borderRadius: 'var(--card-radius)' }}>
          {embedUrl ? (
            isDriveEmbed ? (
              <div className="absolute inset-0 overflow-hidden" style={{ borderRadius: 'var(--card-radius)' }}>
                <iframe 
                   className="absolute top-0 bottom-0 left-0 h-full border-none" 
                   style={{ width: 'calc(100% + 24px)' }}
                   src={embedUrl} 
                   allow="autoplay" 
                   allowFullScreen
                ></iframe>
              </div>
            ) : (
              <div className="w-full h-full flex items-center justify-center p-5 sm:p-12 transition-all animate-fade-in">
                <div 
                  className="w-full max-w-sm aspect-square flex flex-col items-center justify-center border-[8px] border-white shadow-[12px_12px_0px_rgba(255,255,255,1)]"
                  style={{ 
                    background: ['var(--accent-green)', 'var(--accent-purple)', 'var(--accent-blue)', 'var(--accent-orange)'][slideIndex % 4],
                  }}
                >
                  <span className="text-8xl sm:text-[12rem] font-black text-black leading-none">{slideIndex + 1}</span>
                  <p className="mt-4 text-xs sm:text-xl font-bold uppercase tracking-widest text-black bg-white px-3 py-1 text-center">Collection_0{slideIndex + 1}</p>
                </div>
              </div>
            )
          ) : (
            <div className="text-center">
              <FiImage className="mx-auto text-5xl mb-3" style={{ color: 'var(--text-muted)' }} />
              <span className="font-semibold" style={{ color: 'var(--text-muted)' }}>Select a connected drive</span>
            </div>
          )}
        </div>
      </div>
      
    </article>
  );
});



const Leaderboard = memo(function Leaderboard({
  teams,
  trendingIds,
}: {
  teams: Team[];
  trendingIds: Set<string>;
}) {
  const first = teams[0];
  const second = teams[1];
  const third = teams[2];
  const rest = teams.slice(3, 10);

  return (
    <div className="w-full h-full">
      <article className="t-card p-4 sm:p-6 w-full md:p-8 h-full flex flex-col">
        <div className="mb-6 flex items-center justify-between gap-2 pb-4" style={{ borderBottom: '1px solid var(--border-main)' }}>
          <h2 className="flex items-center gap-2 text-lg font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            <div className="icon-circle icon-circle-purple" style={{ width: 30, height: 30 }}>
              <FiAward size={15} />
            </div>
            Leaderboard
          </h2>
          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md whitespace-nowrap" style={{ background: 'var(--accent-purple-dim)', color: 'var(--accent-purple)', border: '1px solid rgba(168,85,247,0.3)' }}>
            Top 10
          </span>
        </div>

        {teams.length > 0 ? (
          <>
            <div className="flex justify-center items-end gap-2 md:gap-4 mb-8 pt-6 px-2 overflow-x-auto">
              {/* 2nd Place */}
              {second && (
                <div className="flex flex-col items-center min-w-[88px] w-24 md:w-32 animate-fade-in" style={{ animationDelay: '100ms' }}>
                  <span className="text-3xl font-black mb-2" style={{ color: 'var(--text-muted)' }}>2</span>
                  <div className="w-full h-24 flex items-start justify-center pt-3 relative overflow-hidden" style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border-main)', borderRadius: 'var(--card-radius) var(--card-radius) 0 0' }}>
                    <span className="font-bold text-xs md:text-sm text-center px-1 z-10 w-full truncate" style={{ color: 'var(--text-secondary)' }}>{second.name}</span>
                  </div>
                  <div className="w-full py-2 text-center text-xs md:text-sm font-black z-10" style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)', borderRadius: '0 0 12px 12px' }}>{second.score ?? 0} pts</div>
                </div>
              )}
              {/* 1st Place */}
              {first && (
                <div className="flex flex-col items-center min-w-[100px] w-28 md:w-36 z-20 animate-fade-in" style={{ transform: 'scale(1.05)' }}>
                  <div className="text-4xl mb-1">👑</div>
                  <span className="text-4xl font-black mb-2" style={{ color: 'var(--accent-green)', textShadow: '0 0 20px var(--accent-green-dim)' }}>1</span>
                  <div className="w-full h-32 flex items-start justify-center pt-3 relative overflow-hidden" style={{ background: 'var(--accent-green-dim)', border: '2px solid var(--accent-green)', borderRadius: 'var(--card-radius) var(--card-radius) 0 0' }}>
                    <span className="font-bold text-sm md:text-base text-center px-2.5 z-10 w-full truncate" style={{ color: 'var(--accent-green)' }}>{first.name}</span>
                  </div>
                  <div className="w-full py-2.5 text-center text-sm md:text-base font-black z-10" style={{ background: 'var(--accent-green)', color: '#000', borderRadius: '0 0 12px 12px', boxShadow: 'var(--shadow-glow-green)' }}>{first.score ?? 0} pts</div>
                </div>
              )}
              {/* 3rd Place */}
              {third && (
                <div className="flex flex-col items-center min-w-[88px] w-24 md:w-32 animate-fade-in" style={{ animationDelay: '200ms' }}>
                  <span className="text-2xl font-black mb-2" style={{ color: 'var(--accent-orange)' }}>3</span>
                  <div className="w-full h-20 flex items-start justify-center pt-2 relative overflow-hidden" style={{ background: 'var(--bg-card-alt)', border: '1px solid var(--border-main)', borderRadius: 'var(--card-radius) var(--card-radius) 0 0' }}>
                    <span className="font-bold text-xs md:text-sm text-center px-1 z-10 w-full truncate" style={{ color: 'var(--text-secondary)' }}>{third.name}</span>
                  </div>
                  <div className="w-full py-1.5 text-center text-xs font-black z-10" style={{ background: 'var(--accent-orange-dim)', color: 'var(--accent-orange)', borderRadius: '0 0 12px 12px' }}>{third.score ?? 0} pts</div>
                </div>
              )}
            </div>

            <div className="space-y-3">
              {rest.map((team, index) => {
                const rank = index + 4;
                return (
                  <div
                    key={team.id}
                    className="group t-inset p-3 transition-all flex items-center justify-between gap-3"
                    style={{ borderRadius: 'var(--card-radius)' }}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <span className="text-base font-bold w-6 text-center" style={{ color: 'var(--text-muted)' }}>#{rank}</span>
                      <p className="truncate text-sm md:text-base font-bold" style={{ color: 'var(--text-primary)' }}>{team.name}</p>
                    </div>

                    <div className="flex items-center gap-2 md:gap-3 flex-shrink-0">
                      {trendingIds.has(team.id) && (
                        <span className="hidden sm:inline-block rounded-full px-2.5 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider" style={{ background: 'var(--accent-pink-dim)', color: 'var(--accent-pink)' }}>
                          Trending
                        </span>
                      )}
                      <span className="hidden sm:inline-block rounded-full px-2.5 py-1 text-[10px] sm:text-xs font-bold uppercase tracking-wider" style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' }}>
                        {team.status}
                      </span>
                      <span className="px-3 py-1.5 text-sm md:text-base font-black" style={{ background: 'var(--bg-card)', border: '2px solid var(--border-main)', borderRadius: 'var(--card-radius)', color: 'var(--text-primary)' }}>
                        {team.score ?? 0}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        ) : (
          <div className="py-12 text-center t-inset" style={{ borderRadius: 'var(--card-radius)' }}>
            <p className="text-sm font-medium" style={{ color: 'var(--text-muted)' }}>No teams yet.</p>
          </div>
        )}
      </article>
    </div>
  );
});

function parseScheduleTimeToMs(time: string, now: Date): number | null {
  const parts = time.split(":").map((part) => Number(part));
  if (parts.length < 2 || parts.some((part) => Number.isNaN(part))) {
    return null;
  }

  const [hours, minutes, seconds = 0] = parts;
  const target = new Date(now);
  target.setHours(hours, minutes, seconds, 0);

  return target.getTime();
}

function formatRemaining(totalSeconds: number): string {
  const safe = Math.max(0, totalSeconds);
  const hours = Math.floor(safe / 3600)
    .toString()
    .padStart(2, "0");
  const minutes = Math.floor((safe % 3600) / 60)
    .toString()
    .padStart(2, "0");
  const seconds = Math.floor(safe % 60)
    .toString()
    .padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

const CountdownTimer = memo(function CountdownTimer({
  event,
  targetMs,
  onReachedZero,
}: {
  event: ScheduleItem | null;
  targetMs: number | null;
  onReachedZero: (event: ScheduleItem) => Promise<void>;
}) {
  const [nowMs, setNowMs] = useState(Date.now());
  const triggeredRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!event || targetMs === null) {
      return;
    }

    if (nowMs >= targetMs && !triggeredRef.current.has(event.id)) {
      triggeredRef.current.add(event.id);
      void onReachedZero(event);
    }
  }, [event, nowMs, onReachedZero, targetMs]);

  const totalSeconds = targetMs === null ? 0 : Math.floor((targetMs - nowMs) / 1000);

  return (
    <article className="t-card p-5">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
          <div className="icon-circle icon-circle-cyan" style={{ width: 32, height: 32 }}>
            <FiClock size={15} />
          </div>
          Next Event Countdown
        </h2>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Updates every second</p>
      </div>

      {event ? (
        <>
          <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>{event.title}</p>
          <p className="mt-2 text-3xl sm:text-4xl font-bold tracking-tight" style={{ color: 'var(--accent-green)', textShadow: '0 0 20px var(--accent-green-dim)' }}>{formatRemaining(totalSeconds)}</p>
        </>
      ) : (
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No upcoming event found.</p>
      )}
    </article>
  );
});

const HackathonClockCard = memo(function HackathonClockCard({ startTime }: { startTime: number | null }) {
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);

  const endMs = startTime ? startTime + (24 * 60 * 60 * 1000) : null;
  const isLive = endMs && nowMs < endMs;

  return (
    <article className="t-card p-5 flex flex-col items-center justify-center h-full relative overflow-hidden" style={{ border: '2px solid var(--accent-green)', background: 'var(--accent-green-dim)' }}>
      <div className="absolute top-2 left-2 px-2 py-0.5 text-[9px] sm:text-[10px] font-black uppercase tracking-widest bg-black text-[#00ff66]">Hackathon_Master_Clock</div>
      {isLive ? (
        <>
          <p className="text-3xl sm:text-4xl md:text-5xl font-black font-mono tracking-tighter" style={{ color: 'var(--text-primary)' }}>
            {formatRemaining(Math.floor((endMs - nowMs) / 1000))}
          </p>
          <p className="mt-2 text-xs font-bold uppercase tracking-widest animate-pulse" style={{ color: 'var(--accent-green)' }}>Time Remaining</p>
        </>
      ) : (
        <div className="text-center">
            <p className="font-bold text-sm" style={{ color: 'var(--text-muted)' }}>{startTime ? 'HACKATHON ENDED' : 'AWAITING START COMMAND'}</p>
            {!startTime && <p className="text-[10px] uppercase font-bold mt-2" style={{ color: 'var(--text-muted)' }}>GO TO ADMIN &gt; STATS TO START</p>}
        </div>
      )}
    </article>
  );
});

const ProjectorMainTimerSlide = memo(function ProjectorMainTimerSlide({
  targetMs,
  label = "HACKATHON_TIMER",
  accent = "#0F7B5F"
}: {
  targetMs: number | null;
  label?: string;
  accent?: string;
}) {
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const totalSeconds = targetMs === null ? 0 : Math.floor((targetMs - nowMs) / 1000);

  return (
    <section className="h-full w-full bg-black border-[12px] p-10 flex flex-col items-center justify-center relative overflow-hidden font-mono projector-fade" style={{ borderColor: accent }}>
      <div className="absolute inset-0 opacity-10 bg-[linear-gradient(rgba(0,0,0,0.5)_2px,transparent_2px)] bg-[length:100%_4px]" style={{ backgroundColor: accent }}></div>
      <h2 className="text-4xl md:text-6xl font-black tracking-[0.2em] uppercase mb-12 border-b-[8px] pb-4 z-10" style={{ color: accent, borderColor: accent }}>[ {label} ]</h2>
      <p className="text-[12rem] md:text-[min(20vw,24rem)] font-black text-white drop-shadow-[0_0_40px_rgba(255,255,255,0.8)] tracking-tighter leading-none z-10">
        {formatRemaining(totalSeconds)}
      </p>
      <div className="absolute bottom-10 left-10 z-10">
        <p className="text-2xl font-bold animate-pulse" style={{ color: accent }}>_SYS:ACTIVE</p>
      </div>
      <div className="absolute top-10 right-10 z-10 flex items-center gap-2">
         <div className="h-6 w-6 rounded-full bg-red-500 animate-pulse"></div>
         <p className="text-red-500 font-bold text-3xl tracking-widest">REC</p>
      </div>
    </section>
  );
});

const ProjectorStatsSlide = memo(function ProjectorStatsSlide({
  stats,
  event,
  targetMs,
}: {
  stats: { totalParticipants: number; teamsRegistered: number; projectsSubmitted: number; activeNow: number };
  event: ScheduleItem | null;
  targetMs: number | null;
}) {
  const [nowMs, setNowMs] = useState(Date.now());
  useEffect(() => {
    const interval = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(interval);
  }, []);
  const totalSeconds = targetMs === null ? 0 : Math.floor((targetMs - nowMs) / 1000);

  return (
    <section className="h-full w-full bg-black p-10 grid grid-cols-1 gap-10 xl:grid-cols-[1.2fr_1fr] font-mono border-[12px] border-yellow-500 projector-fade relative">
      <div className="absolute inset-0 bg-yellow-500 opacity-5 bg-[repeating-linear-gradient(45deg,transparent,transparent_10px,#eab308_10px,#eab308_20px)]"></div>
      
      <div className="grid grid-cols-2 gap-8 border-r-[8px] border-yellow-500 pr-10 z-10">
        <div className="border-[6px] border-yellow-500 p-8 flex flex-col justify-end bg-yellow-500/10 hover:bg-yellow-500/30 transition-colors">
          <p className="text-2xl text-yellow-500 uppercase font-black tracking-widest break-words">Total<br/>Participants</p>
          <p className="mt-4 text-8xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]">{stats.totalParticipants}</p>
        </div>
        <div className="border-[6px] border-yellow-500 p-8 flex flex-col justify-end bg-yellow-500/10 hover:bg-yellow-500/30 transition-colors">
          <p className="text-2xl text-yellow-500 uppercase font-black tracking-widest break-words">Teams<br/>Registered</p>
          <p className="mt-4 text-8xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]">{stats.teamsRegistered}</p>
        </div>
        <div className="border-[6px] border-yellow-500 p-8 flex flex-col justify-end bg-yellow-500/10 hover:bg-yellow-500/30 transition-colors">
          <p className="text-2xl text-yellow-500 uppercase font-black tracking-widest break-words">Projects<br/>Submitted</p>
          <p className="mt-4 text-8xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]">{stats.projectsSubmitted}</p>
        </div>
        <div className="border-[6px] border-yellow-500 p-8 flex flex-col justify-end bg-yellow-500/10 hover:bg-yellow-500/30 transition-colors">
          <p className="text-2xl text-yellow-500 uppercase font-black tracking-widest break-words">Teams<br/>Present</p>
          <p className="mt-4 text-8xl font-black text-yellow-400 drop-shadow-[0_0_15px_rgba(234,179,8,0.8)]">{stats.activeNow}</p>
        </div>
      </div>

      <div className="flex flex-col justify-center items-center border-[6px] border-yellow-500 bg-yellow-500/10 p-10 relative overflow-hidden z-10 w-full">
        <h2 className="text-4xl text-yellow-500 uppercase tracking-[0.2em] font-black absolute top-10 border-b-[4px] border-yellow-500 pb-2 break-all w-[90%] text-center truncate">[ NEXT_EVENT ]</h2>
        <p className="mt-16 text-6xl lg:text-7xl font-black text-white uppercase text-center break-words w-full px-5 drop-shadow-[0_0_10px_rgba(255,255,255,0.5)]">{event?.title ?? "VERIFYING..."}</p>
        <p className="mt-12 text-[7rem] xl:text-[9rem] font-black tracking-tighter text-yellow-400 drop-shadow-[0_0_25px_rgba(234,179,8,1)] leading-none text-center bg-black/40 px-4 rounded-xl">{formatRemaining(totalSeconds)}</p>
      </div>
    </section>
  );
});

const ProjectorLeaderboardSlide = memo(function ProjectorLeaderboardSlide({ teams }: { teams: Team[] }) {
  return (
    <section className="h-full w-full bg-black p-12 border-[12px] border-[#3B82F6] font-mono relative projector-fade overflow-hidden flex flex-col">
      <div className="absolute inset-0 bg-[#3B82F6] opacity-[0.03] bg-[radial-gradient(#3B82F6_2px,transparent_2px)] bg-[length:30px_30px]"></div>
      <h2 className="mb-10 text-6xl md:text-8xl font-black text-[#3B82F6] uppercase tracking-widest border-b-[8px] border-[#3B82F6] pb-6 z-10 drop-shadow-[0_0_10px_rgba(59,130,246,0.5)]">_LIVE_RANKINGS_</h2>
      
      <div className="space-y-4 flex-1 overflow-hidden flex flex-col justify-center z-10">
        {teams.slice(0, 7).map((team, index) => (
          <div key={team.id} className="flex items-center justify-between border-[4px] border-blue-500/50 bg-blue-900/20 px-8 py-5 hover:bg-blue-500/20 transition-colors">
            <p className="text-4xl md:text-5xl font-bold text-white truncate max-w-[50%] flex items-center">
              <span className="text-blue-500 mr-6 font-black w-24 inline-block text-right">#{index + 1}</span>
              {team.name}
            </p>
            <div className="flex items-center gap-10">
              <span className={`px-5 py-2 text-2xl font-black uppercase tracking-widest border-[3px] ${team.status === 'submitted' ? 'border-emerald-500 text-emerald-400 bg-emerald-500/10' : 'border-blue-500 text-blue-400 bg-blue-500/10'}`}>
                {team.status}
              </span>
              <p className="text-6xl md:text-7xl font-black text-blue-100 min-w-[150px] text-right drop-shadow-[0_0_15px_rgba(59,130,246,0.8)]">{team.score ?? 0}</p>
            </div>
          </div>
        ))}
        {teams.length === 0 && <p className="text-5xl text-blue-500 font-black uppercase text-center mt-20 animate-pulse">NO_DATA_STREAM</p>}
      </div>
    </section>
  );
});

const ProjectorGallerySlide = memo(function ProjectorGallerySlide({ items }: { items: GalleryItem[] }) {
  const [slideIndex, setSlideIndex] = useState(0);

  const slides = useMemo(() => {
    const extractDriveId = (url: string) => {
      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9_-]+)/);
      if (fileMatch?.[1]) return fileMatch[1];
      const openMatch = url.match(/[?&]id=([a-zA-Z0-9_-]+)/);
      if (openMatch?.[1]) return openMatch[1];
      return null;
    };

    return items
      .map((item) => {
        const raw = (item.imageUrl ?? "").trim();
        if (!raw) {
          return null;
        }

        const folderMatch = raw.match(/\/folders\/([a-zA-Z0-9_-]+)/);
        if (folderMatch?.[1]) {
          return {
            id: item.id,
            label: item.uploadedBy || "Drive Folder",
            src: `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#grid`,
            mode: "iframe" as const,
          };
        }

        if (raw.includes("drive.google.com")) {
          const driveId = extractDriveId(raw);
          if (driveId) {
            return {
              id: item.id,
              label: item.uploadedBy || "Drive Image",
              src: `https://drive.google.com/uc?export=view&id=${driveId}`,
              mode: "image" as const,
            };
          }
        }

        return {
          id: item.id,
          label: item.uploadedBy || "Gallery Source",
          src: raw,
          mode: "image" as const,
        };
      })
      .filter((slide): slide is { id: string; label: string; src: string; mode: "image" | "iframe" } => Boolean(slide));
  }, [items]);

  useEffect(() => {
    if (slideIndex >= slides.length) {
      setSlideIndex(0);
    }
  }, [slides.length, slideIndex]);

  useEffect(() => {
    if (slides.length <= 1) {
      return;
    }

    const interval = setInterval(() => {
      setSlideIndex((prev) => (prev + 1) % slides.length);
    }, 4500);

    return () => clearInterval(interval);
  }, [slides.length]);

  const current = slides[slideIndex] ?? null;

  return (
    <section className="projector-fade grid h-full grid-cols-1 gap-10 xl:grid-cols-[2fr_1fr] bg-black p-10 border-[12px] border-[#A855F7] font-mono relative">
      <div className="absolute inset-0 bg-[#A855F7] opacity-5 bg-[linear-gradient(to_right,#000_1px,transparent_1px),linear-gradient(to_bottom,#000_1px,transparent_1px)] bg-[length:40px_40px] border-[#A855F7]"></div>
      
      <div className="overflow-hidden border-[8px] border-[#A855F7] bg-black relative z-10 flex items-center justify-center">
        {current ? (
          current.mode === "iframe" ? (
            <iframe
              src={current.src}
              title="Gallery drive"
              className="h-full w-full border-none"
              allow="autoplay"
            />
          ) : (
            <img
              src={current.src}
              alt="Gallery slide"
              className="h-full w-full object-contain p-4"
              onError={() => {
                if (slides.length > 1) {
                  setSlideIndex((prev) => (prev + 1) % slides.length);
                }
              }}
            />
          )
        ) : (
          <div className="text-4xl text-[#A855F7] font-black uppercase animate-pulse">SIGNAL_STRENGTH_WEAK</div>
        )}
      </div>
      <div className="border-[8px] border-[#A855F7] bg-[#A855F7]/10 p-10 z-10 flex flex-col">
        <h3 className="mb-6 text-6xl font-black text-[#A855F7] uppercase border-b-[6px] border-[#A855F7] pb-4">_MEDIA_FEED_</h3>
        <p className="mb-8 text-2xl text-purple-300 font-bold uppercase tracking-widest animate-pulse">[ AUTO_CYCLE : ON ]</p>
        <div className="space-y-4 flex-1 overflow-hidden">
          {slides.slice(0, 8).map((item, index) => (
            <div
              key={item.id}
              className={`border-[4px] px-6 py-4 font-bold text-2xl uppercase truncate transition-colors ${
                index === slideIndex ? "border-white text-white bg-[#A855F7]/40 shadow-[0_0_15px_rgba(168,85,247,0.8)]" : "border-[#A855F7]/40 text-[#A855F7] bg-black"
              }`}
            >
              {item.label || `SOURCE_${index+1}`}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
});

const AdminAuthPanel = memo(function AdminAuthPanel({
  isAdmin,
  authLoading,
  authError,
  currentUser,
  onLogin,
  onLogout,
}: {
  isAdmin: boolean;
  authLoading: boolean;
  authError: string;
  currentUser: User | null;
  onLogin: (email: string, password: string) => Promise<void>;
  onLogout: () => Promise<void>;
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleLogin = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    try {
      await onLogin(email, password);
      setPassword("");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (authLoading) {
    return (
      <article className="t-card p-5">
        <h2 className="mb-2 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Admin Access</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Checking authentication...</p>
      </article>
    );
  }

  if (isAdmin) {
    return (
      <article className="t-card p-6 text-center" style={{ borderColor: 'var(--accent-green)' }}>
        <h2 className="mb-2 text-xl font-bold" style={{ color: 'var(--accent-green)' }}>Login Successful!</h2>
        <p className="text-sm" style={{ color: 'var(--text-secondary)' }}>Signed in as {currentUser?.email ?? "admin"}</p>
        <button
          type="button"
          onClick={() => {
            void onLogout();
          }}
          className="mt-5 w-full px-4 py-2.5 text-sm font-bold text-black transition"
          style={{ background: 'var(--accent-green)', borderRadius: 'var(--card-radius)' }}
        >
          Sign Out
        </button>
      </article>
    );
  }

  return (
    <article className="t-card p-5">
      <h2 className="mb-3 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>Admin Login</h2>
      <form className="space-y-3" onSubmit={handleLogin}>
        <input
          type="email"
          required
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Admin email"
          className="w-full t-input px-3 py-2 text-sm"
        />
        <input
          type="password"
          required
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          className="w-full t-input px-3 py-2 text-sm"
        />
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full px-3 py-2 text-sm font-semibold text-black transition disabled:cursor-not-allowed disabled:opacity-60"
          style={{ background: 'var(--accent-green)', borderRadius: 'var(--card-radius)' }}
        >
          {isSubmitting ? "Signing in..." : "Sign In as Admin"}
        </button>
      </form>
      {authError && <p className="mt-3 text-xs" style={{ color: 'var(--accent-orange)' }}>{authError}</p>}
    </article>
  );
});

function App() {
  const [state, dispatch] = useReducer(dashboardReducer, initialState);
  const [authLoading, setAuthLoading] = useState(true);
  const [authError, setAuthError] = useState("");
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAdmin, setIsAdmin] = useState(false);
  const signaturesRef = useRef({
    stats: "",
    teams: "",
    announcements: "",
    schedule: "",
    activity: "",
    gallery: "",
    departmentAnalytics: "",
    submissionTrends: "",
    activeUsersOverTime: "",
  });
  const lastUpdatedRef = useRef<number | null>(null);
  const previousActivityIdsRef = useRef<string[]>([]);
  const [freshActivityIds, setFreshActivityIds] = useState<Set<string>>(new Set());
  const freshTimersRef = useRef<Record<string, number>>({});
  const previousTeamScoresRef = useRef<Record<string, number>>({});
  const [trendingTeamIds, setTrendingTeamIds] = useState<Set<string>>(new Set());
  const trendingTimersRef = useRef<Record<string, number>>({});
  const [countdownNotice, setCountdownNotice] = useState("");
  const [projectorMode, setProjectorMode] = useState(false);
  const [projectorSlide, setProjectorSlide] = useState(0);
  const [showAdminModal, setShowAdminModal] = useState(false);
  const [activeTab, setActiveTab] = useState("Dashboard");
  const [searchQuery, setSearchQuery] = useState("");
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'info' | 'error' } | null>(null);
  const [isMobileView, setIsMobileView] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const mediaQuery = window.matchMedia("(max-width: 767px)");
    const apply = () => setIsMobileView(mediaQuery.matches);
    apply();
    mediaQuery.addEventListener("change", apply);
    return () => mediaQuery.removeEventListener("change", apply);
  }, []);

  const showNotification = useCallback((message: string, type: 'success' | 'info' | 'error' = 'success') => {
    setNotification({ message, type });
    // Clear previous timeout if exists
    if ((window as any).notificationTimeout) clearTimeout((window as any).notificationTimeout);
    (window as any).notificationTimeout = setTimeout(() => setNotification(null), 3500);
  }, []);

  // ============ TILE GRID STATE ============
  const [tiles, setTiles] = useState<TileConfig[]>(DEFAULT_TILES);
  const [editMode, setEditMode] = useState(false);
  const [showAddTilePanel, setShowAddTilePanel] = useState(false);
  const [removingTileId, setRemovingTileId] = useState<string | null>(null);

  useEffect(() => {
    localStorage.setItem("dashboard-tiles", JSON.stringify(tiles));
    // Automatic cloud saving is removed to prevent feedback loops.
    // Saving now happens explicitly via "Reset Layout" or "Save Layout" actions.
  }, [tiles]);

  // Load layout from Firestore on mount
  useEffect(() => {
    const unsub = onSnapshot(doc(db, "dashboardLayout", "config"), (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        if (data.tiles && Array.isArray(data.tiles)) {
          // IMPORTANT: If we are an admin and currently editing, DO NOT let the cloud 
          // overwrite our local changes. Otherwise, overwrite the state.
          if (!editMode) {
            setTiles(data.tiles);
            localStorage.setItem("dashboard-tiles", JSON.stringify(data.tiles));
          }
        }
      }
    }, (err) => {
      console.error("Layout sync error:", err);
    });
    return () => unsub();
  }, []);

  const handleRemoveTile = useCallback((tileId: string) => {
    setRemovingTileId(tileId);
    setTimeout(() => {
      setTiles(prev => prev.filter(t => t.id !== tileId));
      setRemovingTileId(null);
      showNotification("Tile removed from dashboard", "info");
    }, 350);
  }, [showNotification]);

  const handleAddTile = useCallback((type: TileType, defaultSize: TileSize) => {
    const newTile: TileConfig = {
      id: `tile-${type}-${Date.now()}`,
      type,
      size: defaultSize,
      order: tiles.length,
      visible: true,
    };
    setTiles(prev => [...prev, newTile]);
    setShowAddTilePanel(false);
    showNotification(`${type.replace(/([A-Z])/g, ' $1').trim()} added to dashboard!`);
  }, [tiles.length, showNotification]);


  const [theme, setTheme] = useState<"default" | "brutalist">(() => {
    if (typeof window !== "undefined") {
      return (localStorage.getItem("dashboard-theme") as "default" | "brutalist") || "brutalist";
    }
    return "brutalist";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
    localStorage.setItem("dashboard-theme", theme);
  }, [theme]);

  const toggleTheme = useCallback(() => {
    setTheme((prev) => (prev === "default" ? "brutalist" : "default"));
  }, []);

  const availableTabs = useMemo(() => {
    const tabs = [
      { label: "Dashboard", icon: FiGrid },
      { label: "Gallery", icon: FiImage },
      { label: "Team Portal", icon: FiUsers },
    ];
    if (isAdmin) {
      tabs.push({ label: "Scoring", icon: FiHash });
      tabs.push({ label: "Admin Controls", icon: FiZap });
    }
    return tabs;
  }, [isAdmin]);

  useEffect(() => {
    if (isMobileView && projectorMode) {
      setProjectorMode(false);
    }
  }, [isMobileView, projectorMode]);

  const [hasActiveHelpRequests, setHasActiveHelpRequests] = useState(false);
  const [showCredits, setShowCredits] = useState(true);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "helpRequests")),
      (snap) => {
        const hasOpen = snap.docs.some(doc => doc.data().status === "open");
        setHasActiveHelpRequests(hasOpen);
      }
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setCurrentUser(user);
      const email = user?.email?.toLowerCase() ?? "";
      setIsAdmin(adminEmailAllowlist.includes(email));
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    lastUpdatedRef.current = state.lastUpdatedMs;
  }, [state.lastUpdatedMs]);

  useEffect(() => {
    const unsubStats = onSnapshot(
      doc(db, "stats", "dashboard"),
      (snapshot) => {
        if (snapshot.exists()) {
          const data = snapshot.data() as StatDoc;
          const lastUpdatedMs = timestampToMillis(data.lastUpdated);
          const sig = [
            data.totalParticipants ?? 0,
            data.teamsRegistered ?? 0,
            data.projectsSubmitted ?? 0,
            data.activeNow ?? 0,
            data.hackathonStartTime ? (data.hackathonStartTime.toMillis ? data.hackathonStartTime.toMillis() : data.hackathonStartTime) : "none",
            lastUpdatedMs ?? "none",
          ].join("|");

          if (sig !== signaturesRef.current.stats) {
            signaturesRef.current.stats = sig;
            dispatch({ type: "stats", payload: data, lastUpdatedMs });
          }
        }
      },
      (error) => dispatch({ type: "error", payload: error.message })
    );

    const unsubTeams = onSnapshot(
      query(collection(db, "teamPortal")),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => {
          const data = item.data();
          const p = data.participants || [];
          const leader = data.leaderName ? [data.leaderName] : [];
          const memberNames = [...leader, ...p.map((x: any) => x.name)];
          return {
            id: item.id,
            teamId: data.teamCode || "",
            name: data.teamName || "Unnamed Team",
            members: memberNames,
            score: data.score || 0,
            status: data.status || "building",
            lastActive: data.lastActive || data.createdAt,
            department: data.department || "",
          } as Team;
        });
        const sig = rows
          .map(
            (item) =>
              `${item.id}:${item.name}:${item.status}:${item.score}:${item.members?.length ?? 0}`
          )
          .join("~");

        if (sig !== signaturesRef.current.teams) {
          signaturesRef.current.teams = sig;

          const nextScores: Record<string, number> = {};
          const increasedIds: string[] = [];
          for (const team of rows) {
            const score = team.score ?? 0;
            nextScores[team.id] = score;
            const previousScore = previousTeamScoresRef.current[team.id];
            if (previousScore !== undefined && score > previousScore) {
              increasedIds.push(team.id);
            }
          }
          previousTeamScoresRef.current = nextScores;

          if (increasedIds.length > 0) {
            setTrendingTeamIds((prev) => {
              const next = new Set(prev);
              for (const id of increasedIds) {
                next.add(id);
              }
              return next;
            });

            for (const id of increasedIds) {
              if (trendingTimersRef.current[id]) {
                clearTimeout(trendingTimersRef.current[id]);
              }
              trendingTimersRef.current[id] = window.setTimeout(() => {
                setTrendingTeamIds((prev) => {
                  const next = new Set(prev);
                  next.delete(id);
                  return next;
                });
                delete trendingTimersRef.current[id];
              }, 15000);
            }
          }

          dispatch({ type: "teams", payload: rows });
        }
      },
      (error) => dispatch({ type: "error", payload: error.message })
    );

    const unsubAnnouncements = onSnapshot(
      query(collection(db, "announcements"), orderBy("timestamp", "desc")),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({
          id: item.id,
          ...(item.data() as Omit<Announcement, "id">),
        }));
        const sig = rows.map((item) => `${item.id}:${item.type}:${item.message}`).join("~");

        if (sig !== signaturesRef.current.announcements) {
          signaturesRef.current.announcements = sig;
          dispatch({ type: "announcements", payload: rows });
        }
      },
      (error) => dispatch({ type: "error", payload: error.message })
    );

    const unsubSchedule = onSnapshot(
      query(collection(db, "schedule"), orderBy("time", "asc")),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ScheduleItem, "id">) }));
        const sig = rows.map((item) => `${item.id}:${item.title}:${item.time}:${item.status}`).join("~");

        if (sig !== signaturesRef.current.schedule) {
          signaturesRef.current.schedule = sig;
          dispatch({ type: "schedule", payload: rows });
        }
      },
      (error) => dispatch({ type: "error", payload: error.message })
    );

    const unsubActivity = onSnapshot(
      query(collection(db, "activity"), orderBy("timestamp", "desc"), limit(20)),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<ActivityItem, "id">) }));
        const sig = rows.map((item) => `${item.id}:${item.type}:${item.message}`).join("~");

        if (sig !== signaturesRef.current.activity) {
          signaturesRef.current.activity = sig;

          const previousIds = previousActivityIdsRef.current;
          const addedIds = rows
            .map((item) => item.id)
            .filter((id) => previousIds.length > 0 && !previousIds.includes(id));
          previousActivityIdsRef.current = rows.map((item) => item.id);

          if (addedIds.length > 0) {
            setFreshActivityIds((prev) => {
              const next = new Set(prev);
              for (const id of addedIds) {
                next.add(id);
              }
              return next;
            });

            for (const id of addedIds) {
              if (freshTimersRef.current[id]) {
                clearTimeout(freshTimersRef.current[id]);
              }
              freshTimersRef.current[id] = window.setTimeout(() => {
                setFreshActivityIds((prev) => {
                  const next = new Set(prev);
                  next.delete(id);
                  return next;
                });
                delete freshTimersRef.current[id];
              }, 900);
            }
          }

          dispatch({ type: "activity", payload: rows });
        }
      },
      (error) => dispatch({ type: "error", payload: error.message })
    );

    const unsubGallery = onSnapshot(
      query(collection(db, "gallery"), orderBy("timestamp", "desc"), limit(30)),
      (snapshot) => {
        const rows = snapshot.docs.map((item) => ({ id: item.id, ...(item.data() as Omit<GalleryItem, "id">) }));
        const sig = rows.map((item) => `${item.id}:${item.imageUrl}:${item.uploadedBy}`).join("~");

        if (sig !== signaturesRef.current.gallery) {
          signaturesRef.current.gallery = sig;
          dispatch({ type: "gallery", payload: rows });
        }
      },
      (error) => dispatch({ type: "error", payload: error.message })
    );

    const unsubDepartmentAnalytics = onSnapshot(
      doc(db, "analytics", "participationByDepartment"),
      (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }
        const data = snapshot.data() as { items?: DepartmentPoint[] };
        const rows = data.items ?? [];
        const sig = rows.map((item) => `${item.department}:${item.participants}`).join("~");
        if (sig !== signaturesRef.current.departmentAnalytics) {
          signaturesRef.current.departmentAnalytics = sig;
          dispatch({ type: "departmentAnalytics", payload: rows });
        }
      },
      (error) => dispatch({ type: "error", payload: error.message })
    );

    const unsubSubmissionTrends = onSnapshot(
      doc(db, "analytics", "submissionTrends"),
      (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }
        const data = snapshot.data() as { items?: SubmissionPoint[] };
        const rows = data.items ?? [];
        const sig = rows.map((item) => `${item.label}:${item.submissions}`).join("~");
        if (sig !== signaturesRef.current.submissionTrends) {
          signaturesRef.current.submissionTrends = sig;
          dispatch({ type: "submissionTrends", payload: rows });
        }
      },
      (error) => dispatch({ type: "error", payload: error.message })
    );

    const unsubActiveUsers = onSnapshot(
      doc(db, "analytics", "activeUsersOverTime"),
      (snapshot) => {
        if (!snapshot.exists()) {
          return;
        }
        const data = snapshot.data() as { items?: ActiveUserPoint[] };
        const rows = data.items ?? [];
        const sig = rows.map((item) => `${item.label}:${item.activeUsers}`).join("~");
        if (sig !== signaturesRef.current.activeUsersOverTime) {
          signaturesRef.current.activeUsersOverTime = sig;
          dispatch({ type: "activeUsersOverTime", payload: rows });
        }
      },
      (error) => dispatch({ type: "error", payload: error.message })
    );

    const offlineTimeout = setInterval(() => {
      if (lastUpdatedRef.current && Date.now() - lastUpdatedRef.current > 15000) {
        dispatch({ type: "live", payload: false });
      }
    }, 5000);

    return () => {
      unsubStats();
      unsubTeams();
      unsubAnnouncements();
      unsubSchedule();
      unsubActivity();
      unsubGallery();
      unsubDepartmentAnalytics();
      unsubSubmissionTrends();
      unsubActiveUsers();
      clearInterval(offlineTimeout);
      for (const timerId of Object.values(freshTimersRef.current)) {
        clearTimeout(timerId);
      }
      for (const timerId of Object.values(trendingTimersRef.current)) {
        clearTimeout(timerId);
      }
    };
  }, []);

  const resolvedStats = useMemo(
    () => ({
      totalParticipants:
        state.stats.totalParticipants || state.teams.reduce((sum, team) => sum + (team.members?.length || 0), 0),
      teamsRegistered: state.stats.teamsRegistered || state.teams.length,
      projectsSubmitted:
        state.stats.projectsSubmitted || state.teams.filter((team) => team.status === "submitted").length,
      activeNow:
        state.stats.activeNow ||
        state.teams.filter((team) => team.status === "building" || team.status === "testing").length,
      prizePool: state.stats.prizePool || 0,
      eventPhase: state.stats.eventPhase || "inauguration",
      hackathonStartTime: state.stats.hackathonStartTime 
        ? (typeof state.stats.hackathonStartTime === 'number' 
            ? state.stats.hackathonStartTime 
            : (state.stats.hackathonStartTime.toMillis ? state.stats.hackathonStartTime.toMillis() : null)) 
        : null,
    }),
    [state.stats, state.teams]
  );

  const resolvedProblemStatementData = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const team of state.teams) {
      const ps = team.problemStatement || "Unassigned";
      counts[ps] = (counts[ps] || 0) + 1;
    }
    return Object.entries(counts).map(([name, value]) => ({ name, value }));
  }, [state.teams]);

  const resolvedStatusData = useMemo(() => {
    const counts: Record<string, number> = { ideation: 0, building: 0, testing: 0, submitted: 0 };
    for (const team of state.teams) {
      if (counts[team.status] !== undefined) {
        counts[team.status]++;
      }
    }
    return Object.entries(counts).map(([status, count]) => ({ status, count }));
  }, [state.teams]);

  const resolvedScoreData = useMemo(() => {
    return [...state.teams].sort((a, b) => b.score - a.score).slice(0, 5).map(team => ({ name: team.name, score: team.score }));
  }, [state.teams]);

  const leaderboardTeams = useMemo(
    () => [...state.teams].sort((a, b) => (b.score ?? 0) - (a.score ?? 0)),
    [state.teams]
  );

  const nextUpcomingEvent = useMemo(() => {
    const now = new Date();
    const upcoming = state.schedule
      .filter((item) => item.status === "upcoming")
      .map((item) => ({ item, targetMs: parseScheduleTimeToMs(item.time, now) }))
      .filter((entry): entry is { item: ScheduleItem; targetMs: number } => entry.targetMs !== null)
      .sort((a, b) => a.targetMs - b.targetMs);

    return upcoming[0] ?? null;
  }, [state.schedule]);

  useEffect(() => {
    if (!projectorMode) {
      return;
    }

    // Variable duration: Gallery (slide 3) stays longer
    const slideDurations = [12000, 10000, 10000, 20000]; // Timer, Stats, Leaderboard, Gallery
    let timer: ReturnType<typeof setTimeout>;

    const scheduleNext = () => {
      timer = setTimeout(() => {
        setProjectorSlide((prev) => {
          const next = (prev + 1) % 4;
          return next;
        });
        scheduleNext();
      }, slideDurations[projectorSlide]);
    };

    scheduleNext();
    return () => clearTimeout(timer);
  }, [projectorMode, projectorSlide]);

  useEffect(() => {
    const onFullscreenChange = () => {
      if (!document.fullscreenElement) {
        setProjectorMode(false);
      }
    };

    document.addEventListener("fullscreenchange", onFullscreenChange);
    return () => document.removeEventListener("fullscreenchange", onFullscreenChange);
  }, []);

  const loginAsAdmin = async (email: string, password: string) => {
    try {
      setAuthError("");
      const credential = await signInWithEmailAndPassword(auth, email, password);
      const signedInEmail = credential.user.email?.toLowerCase() ?? "";
      if (!adminEmailAllowlist.includes(signedInEmail)) {
        await signOut(auth);
        setIsAdmin(false);
        throw new Error("This account is not authorized as admin.");
      }
      setTimeout(() => setShowAdminModal(false), 2000);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to sign in.";
      setAuthError(message);
      throw error;
    }
  };

  const logoutAdmin = async () => {
    await signOut(auth);
    setIsAdmin(false);
    setAuthError("");
  };

  const assertAdminAccess = () => {
    if (!isAdmin) {
      throw new Error("Admin access required.");
    }
  };

  const updateStats = async (payload: {
    totalParticipants: number;
    teamsRegistered: number;
    projectsSubmitted: number;
    activeNow: number;
    prizePool: number;
    eventPhase: string;
  }) => {
    assertAdminAccess();
    await setDoc(
      doc(db, "stats", "dashboard"),
      {
        ...payload,
        lastUpdated: serverTimestamp(),
      },
      { merge: true }
    );
  };

  const addAnnouncement = async (message: string, type: "info" | "urgent") => {
    assertAdminAccess();
    await addDoc(collection(db, "announcements"), {
      message,
      type,
      timestamp: serverTimestamp(),
    });
  };

  const uploadGalleryImage = async (imageUrl: string, uploadedBy: string) => {
    assertAdminAccess();
    await addDoc(collection(db, "gallery"), {
      imageUrl,
      uploadedBy,
      timestamp: serverTimestamp(),
    });
  };

  const addScheduleItem = async (payload: {
    title: string;
    time: string;
    status: ScheduleItem["status"];
  }) => {
    assertAdminAccess();
    await addDoc(collection(db, "schedule"), payload);
  };

  const addTeamData = async (payload: { name: string; members: string[]; department: string }) => {
    assertAdminAccess();
    await addDoc(collection(db, "teams"), {
      ...payload,
      score: 0,
      status: "ideation",
      lastActive: serverTimestamp(),
    });
    await addDoc(collection(db, "activity"), {
      message: `New team ${payload.name} has registered!`,
      type: "join",
      timestamp: serverTimestamp(),
    });
  };

  const updateScheduleStatus = async (scheduleId: string, status: ScheduleItem["status"]) => {
    assertAdminAccess();
    await updateDoc(doc(db, "schedule", scheduleId), { status });
  };

  const updateTeamScore = async (teamId: string, teamName: string, points: number) => {
    assertAdminAccess();
    if (!teamId || points <= 0) {
      throw new Error("Invalid team or points.");
    }

    await runTransaction(db, async (transaction) => {
      const teamRef = doc(db, "teams", teamId);
      const teamSnapshot = await transaction.get(teamRef);
      if (!teamSnapshot.exists()) {
        throw new Error("Team not found.");
      }

      const currentScore = Number(teamSnapshot.data().score ?? 0);
      const nextScore = currentScore + points;

      transaction.update(teamRef, {
        score: nextScore,
        lastActive: serverTimestamp(),
      });

      const activityRef = doc(collection(db, "activity"));
      transaction.set(activityRef, {
        message: `${teamName} gained +${points} points`,
        type: "announcement",
        timestamp: serverTimestamp(),
      });
    });
  };

  const handleCountdownReachedZero = useCallback(async (event: ScheduleItem) => {
    await runTransaction(db, async (transaction) => {
      const scheduleRef = doc(db, "schedule", event.id);
      const scheduleSnapshot = await transaction.get(scheduleRef);
      if (!scheduleSnapshot.exists()) {
        return;
      }

      const currentStatus = scheduleSnapshot.data().status;
      if (currentStatus !== "upcoming") {
        return;
      }

      transaction.update(scheduleRef, { status: "live" });

      const activityRef = doc(collection(db, "activity"));
      transaction.set(activityRef, {
        message: `${event.title} is now live`,
        type: "announcement",
        timestamp: serverTimestamp(),
      });
    });

    setCountdownNotice(`${event.title} is now live.`);

    if (typeof window !== "undefined" && "Notification" in window) {
      if (window.Notification.permission === "granted") {
        new window.Notification("Event is live", { body: `${event.title} has started.` });
      } else if (window.Notification.permission === "default") {
        const permission = await window.Notification.requestPermission();
        if (permission === "granted") {
          new window.Notification("Event is live", { body: `${event.title} has started.` });
        }
      }
    }
  }, []);

  const toggleProjectorMode = useCallback(async () => {
    if (!projectorMode) {
      try {
        if (typeof document !== "undefined" && document.documentElement.requestFullscreen) {
          await document.documentElement.requestFullscreen();
        }
      } catch {
        // Fullscreen blocked — still enter projector mode
      }
      setProjectorSlide(0);
      setProjectorMode(true);
      return;
    }

    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      }
    } catch {
      // Ignore fullscreen exit errors
    }
    setProjectorMode(false);
  }, [projectorMode]);

  const renderProjectorSlide = () => {
    // Determine the target for the main timer slide (Slide 0)
    // If hackathon has started, prioritize the 24h timer. 
    // Otherwise show the next upcoming event from schedule.
    const hackathonEndMs = resolvedStats.hackathonStartTime ? resolvedStats.hackathonStartTime + (24 * 60 * 60 * 1000) : null;
    const isHackathonLive = resolvedStats.hackathonStartTime && Date.now() < hackathonEndMs;

    if (projectorSlide === 0) {
      if (isHackathonLive) {
        return (
          <ProjectorMainTimerSlide
            targetMs={hackathonEndMs}
            label="24HR_HACKATHON"
            accent="#00ff66"
          />
        );
      }
      return (
        <ProjectorMainTimerSlide
          targetMs={nextUpcomingEvent?.targetMs ?? null}
          label="NEXT_EVENT"
          accent="#0F7B5F"
        />
      );
    }
    if (projectorSlide === 1) {
      return (
        <ProjectorStatsSlide
          stats={resolvedStats}
          event={nextUpcomingEvent?.item ?? null}
          targetMs={nextUpcomingEvent?.targetMs ?? null}
        />
      );
    }
    if (projectorSlide === 2) {
      return <ProjectorLeaderboardSlide teams={leaderboardTeams} />;
    }
    return <ProjectorGallerySlide items={state.gallery} />;
  };

  const completionPercentage = useMemo(() => {
    if (resolvedStats.hackathonStartTime) {
      const start = resolvedStats.hackathonStartTime;
      const end = start + (24 * 60 * 60 * 1000);
      const now = Date.now();
      if (now < start) return 0;
      if (now > end) return 100;
      return Math.min(100, Math.max(0, Math.round(((now - start) / (end - start)) * 100)));
    }
    // If timer hasn't started, always show 0% progress
    return 0;
  }, [resolvedStats.eventPhase, resolvedStats.hackathonStartTime]);

  // ============ TILE CONTENT RENDERER ============
  const renderTileContent = useCallback((tile: TileConfig) => {
    switch (tile.type) {
      case "eventProgress":
        return <EventProgressTracker currentPhase={resolvedStats.eventPhase} />;
      case "masterClock":
        return <HackathonClockCard startTime={resolvedStats.hackathonStartTime} />;
      case "stats":
        return (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-2 lg:grid-cols-5 h-full">
            <StatCard title="Total Students" value={resolvedStats.totalParticipants} accent="green" icon={FiUsers} />
            <StatCard title="Total Teams" value={resolvedStats.teamsRegistered} accent="purple" icon={FiTarget} />
            <StatCard title="Prize Pool" value={resolvedStats.prizePool} prefix="₹" accent="orange" icon={FiGift} />
            <StatCard title="Projects Submitted" value={resolvedStats.projectsSubmitted} accent="blue" icon={FiAward} />
            <StatCard title="Active Now" value={resolvedStats.activeNow} accent="cyan" icon={FiTrendingUp} />
          </div>
        );
      case "analytics":
        return (
          <AnalyticsCharts
            problemStatementData={resolvedProblemStatementData}
            statusData={resolvedStatusData}
            scoreData={resolvedScoreData}
          />
        );
      case "countdown":
        return (
          <CountdownTimer
            event={nextUpcomingEvent?.item ?? null}
            targetMs={nextUpcomingEvent?.targetMs ?? null}
            onReachedZero={handleCountdownReachedZero}
          />
        );
      case "circularProgress":
        return <CircularProgress percentage={completionPercentage} label="Hackathon Progress" />;
      case "leaderboard":
        return <Leaderboard teams={leaderboardTeams.filter(t => !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()))} trendingIds={trendingTeamIds} />;
      case "announcements":
        return (
          <article className="t-card p-5 h-full">
            <h2 className="flex items-center gap-2 mb-3 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              <div className="icon-circle icon-circle-orange" style={{ width: 32, height: 32 }}>
                <FiBell size={15} />
              </div>
              Announcements
            </h2>
            <div className="space-y-2">
              {state.announcements.filter(a => !searchQuery || a.message.toLowerCase().includes(searchQuery.toLowerCase()) || a.type.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 4).map((item) => (
                <div key={item.id} className="t-inset p-3" style={{ borderRadius: 'var(--card-radius)' }}>
                  <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{item.message}</p>
                  <p className="mt-1 text-[11px] uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>{item.type}</p>
                </div>
              ))}
              {state.announcements.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No announcements available.</p>}
            </div>
          </article>
        );
      case "schedule":
        return (
          <article className="t-card p-5 h-full">
            <h2 className="flex items-center gap-2 mb-3 text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
              <div className="icon-circle icon-circle-blue" style={{ width: 32, height: 32 }}>
                <FiClock size={15} />
              </div>
              Today's Schedule
            </h2>
            <div className="space-y-2">
              {state.schedule.filter(s => !searchQuery || s.title.toLowerCase().includes(searchQuery.toLowerCase())).slice(0, 5).map((item) => (
                <div key={item.id} className="flex items-center justify-between t-inset p-3" style={{ borderRadius: 'var(--card-radius)' }}>
                  <div className="flex items-center gap-3">
                    <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: item.status === 'live' ? 'var(--accent-green)' : item.status === 'completed' ? 'var(--text-muted)' : 'var(--accent-blue)', boxShadow: item.status === 'live' ? '0 0 8px var(--accent-green)' : 'none' }}></div>
                    <div>
                      <p className="text-sm font-medium" style={{ color: 'var(--text-primary)', textDecoration: item.status === 'completed' ? 'line-through' : 'none', opacity: item.status === 'completed' ? 0.5 : 1 }}>{item.title}</p>
                      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{item.time}</p>
                    </div>
                  </div>
                  <span className="px-2 py-1 text-[10px] font-bold uppercase rounded-full" style={{ background: item.status === 'live' ? 'var(--accent-green-dim)' : 'var(--accent-blue-dim)', color: item.status === 'live' ? 'var(--accent-green)' : 'var(--accent-blue)' }}>
                    {item.status}
                  </span>
                </div>
              ))}
              {state.schedule.length === 0 && <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No schedule data yet.</p>}
            </div>
            {isAdmin && (
              <form className="mt-3 flex gap-2" onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget as HTMLFormElement;
                const title = (form.elements.namedItem("stitle") as HTMLInputElement).value;
                const time = (form.elements.namedItem("stime") as HTMLInputElement).value;
                if (!title || !time) return;
                await addDoc(collection(db, "schedule"), { title, time, status: "upcoming" });
                (form.elements.namedItem("stitle") as HTMLInputElement).value = "";
                (form.elements.namedItem("stime") as HTMLInputElement).value = "";
              }}>
                <input name="stitle" placeholder="Event" required className="flex-1 t-input px-2 py-1.5 text-xs" />
                <input name="stime" placeholder="Time" required className="w-20 t-input px-2 py-1.5 text-xs" />
                <button type="submit" className="px-3 py-1.5 text-xs font-bold text-black rounded" style={{ background: 'var(--accent-blue)' }}>+</button>
              </form>
            )}
          </article>
        );
      case "activityFeed":
        return <ActivityFeed items={state.activity} freshIds={freshActivityIds} />;
      case "quickLinks":
        return <QuickLinksTile />;
      case "problemStatements":
        return <ProblemStatementsTile />;
      case "quickHelp":
        return <QuickHelpTile />;
      case "teamSpotlight":
        return <TeamSpotlightTile teams={leaderboardTeams} />;
      case "ideaBoard":
        return <IdeaBoardTile />;
      case "resourceHub":
        return <ResourceHubTile />;
      case "helpRequests":
        return <HelpRequestsFeedTile isAdmin={isAdmin} />;
      case "audienceVoting":
        return <AudienceVotingTile isAdmin={isAdmin} />;
      default:
        return <div className="t-card p-5 h-full flex items-center justify-center"><p className="text-sm" style={{ color: 'var(--text-muted)' }}>Unknown tile</p></div>;
    }
  }, [resolvedStats, resolvedProblemStatementData, resolvedStatusData, resolvedScoreData, nextUpcomingEvent, handleCountdownReachedZero, completionPercentage, leaderboardTeams, trendingTeamIds, state.announcements, state.schedule, state.activity, freshActivityIds, isAdmin]);

  if (projectorMode) {
    const labels = ["24HR COUNTDOWN", "LIVE STATS", "RANKINGS", "MEDIA FEED"];
    const borderColors = ["border-[#0F7B5F]", "border-yellow-500", "border-[#3B82F6]", "border-[#A855F7]"];
    const textColors = ["text-[#0F7B5F]", "text-yellow-500", "text-[#3B82F6]", "text-[#A855F7]"];

    return (
      <div className="h-screen w-screen bg-black text-white font-mono overflow-hidden relative">
        {/* Brutalist top bar */}
        <div className={`absolute top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4 border-b-[4px] ${borderColors[projectorSlide]} bg-black/80 backdrop-blur-sm`}>
          <div className="flex items-center gap-6">
            <p className={`text-2xl font-black uppercase tracking-[0.3em] ${textColors[projectorSlide]}`}>TECHATHON_1.0</p>
            <div className={`h-4 w-4 rounded-full animate-pulse ${projectorSlide === 0 ? 'bg-[#0F7B5F]' : projectorSlide === 1 ? 'bg-yellow-500' : projectorSlide === 2 ? 'bg-[#3B82F6]' : 'bg-[#A855F7]'}`}></div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              {labels.map((label, i) => (
                <button
                  key={label}
                  onClick={() => setProjectorSlide(i)}
                  className={`px-4 py-2 text-sm font-black uppercase tracking-wider border-[3px] transition-all ${
                    i === projectorSlide
                      ? `${borderColors[i]} ${textColors[i]} bg-white/10 shadow-lg`
                      : 'border-white/20 text-white/40 hover:border-white/40 hover:text-white/70'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => { void toggleProjectorMode(); }}
              className={`inline-flex items-center gap-2 border-[3px] ${borderColors[projectorSlide]} px-5 py-2 text-sm font-black uppercase tracking-widest ${textColors[projectorSlide]} transition hover:bg-white/10`}
            >
              <FiMinimize />
              EXIT
            </button>
          </div>
        </div>

        {/* Full screen slide content */}
        <div className="h-screen w-screen pt-[72px]">{renderProjectorSlide()}</div>

        {/* Bottom progress indicator */}
        <div className="absolute bottom-0 left-0 right-0 h-2 bg-white/10 z-50">
          <div
            className={`h-full transition-all duration-500 ${projectorSlide === 0 ? 'bg-[#0F7B5F] w-1/4' : projectorSlide === 1 ? 'bg-yellow-500 w-2/4' : projectorSlide === 2 ? 'bg-[#3B82F6] w-3/4' : 'bg-[#A855F7] w-full'}`}
          />
        </div>
      </div>
    );
  }


  return (
    <div className="min-h-screen w-full overflow-x-hidden p-2 md:p-4 pb-32 md:pb-36 relative transition-colors duration-300" style={{ background: 'var(--bg-app)', color: 'var(--text-primary)' }}>
      {/* Floating Bottom Navigation Island */}
      <div className="fixed left-1/2 -translate-x-1/2 bottom-[max(0.75rem,env(safe-area-inset-bottom))] sm:bottom-6 z-[9999] pointer-events-none w-[calc(100%-1rem)] sm:w-full max-w-[460px] sm:max-w-[560px] flex justify-center px-0 sm:px-4 animate-fade-in">
        <nav className="flex w-full sm:w-auto items-stretch justify-between sm:justify-center gap-1 sm:gap-2 p-1.5 sm:p-2 backdrop-blur-xl shadow-[0_20px_60px_-10px_rgba(0,0,0,0.4)] rounded-full pointer-events-auto transition-all" style={{ background: 'var(--nav-bg)', border: '1px solid var(--nav-border)' }}>
          {availableTabs.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.label;
            return (
              <button
                key={item.label}
                onClick={() => setActiveTab(item.label)}
                className="group flex flex-1 sm:flex-none min-w-0 items-center justify-center rounded-full px-2 py-3 sm:py-3 sm:px-5 text-sm font-semibold transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)]"
                style={{
                  background: isActive ? 'var(--nav-active)' : 'transparent',
                  color: isActive ? 'var(--nav-active-text)' : 'var(--text-secondary)',
                  boxShadow: 'none',
                }}
              >
                <Icon className={`text-xl sm:text-lg transition-transform duration-300 ${isActive ? 'scale-110' : 'group-hover:scale-110'}`} />
                <span className={`transition-all duration-300 ease-[cubic-bezier(0.34,1.56,0.64,1)] overflow-hidden whitespace-nowrap hidden sm:block ${isActive ? 'max-w-[150px] opacity-100 ml-2' : 'max-w-0 opacity-0 ml-0 group-hover:max-w-[150px] group-hover:opacity-100 group-hover:ml-2'}`}>
                  {item.label}
                </span>
              </button>
            );
          })}
        </nav>
      </div>

      <div className="mx-auto w-full max-w-full p-1 md:p-2 relative">
        <main className="t-surface p-3 sm:p-4 md:p-6 w-full">
          <header className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3 w-full lg:w-auto">
              <div className="grid h-10 w-10 place-items-center rounded-none border-2 shadow-[4px_4px_0px_rgba(0,0,0,1)] dark:shadow-[4px_4px_0px_rgba(255,255,255,1)]" style={{ background: 'var(--accent-green)', color: '#000', borderColor: 'var(--text-primary)' }}>
                <FiTarget size={20} strokeWidth={3} />
              </div>
              <h1 className="text-2xl sm:text-3xl font-black uppercase tracking-widest" style={{ color: 'var(--text-primary)' }}>
                TECHATHON_<span style={{ color: 'var(--accent-green)' }}>1.0</span>
              </h1>
            </div>

            <div className="relative w-full lg:max-w-md xl:max-w-xl">
              <FiSearch className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-muted)' }} />
              <input
                placeholder="Search teams, tracks, announcements"
                className="w-full t-input px-11 py-3 text-sm"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>

            <div className="flex w-full lg:w-auto items-center gap-2 sm:gap-3 justify-end lg:justify-start flex-wrap">
              {isAdmin && !isMobileView && (
                <button
                  type="button"
                  onClick={() => { void toggleProjectorMode(); }}
                  className="inline-flex h-11 items-center gap-2 px-4 text-sm font-semibold transition-all t-card rounded-full"
                  style={{ color: 'var(--text-primary)' }}
                >
                  <FiMonitor />
                  Projector
                </button>
              )}
              {isAdmin && editMode && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (window.confirm("Reset to default structured layout for ALL users? This will overwrite the current cloud configuration.")) {
                        setTiles(DEFAULT_TILES);
                        if (isAdmin) {
                          try {
                            await setDoc(doc(db, "dashboardLayout", "config"), { 
                              tiles: DEFAULT_TILES, 
                              lastUpdated: serverTimestamp() 
                            });
                            alert("Layout Reset and Synced to Cloud Successfully!");
                          } catch (err: any) {
                            alert("Sync Failed: " + err.message);
                          }
                        }
                      }
                    }}
                    className="inline-flex h-11 items-center gap-2 px-4 text-sm font-semibold transition-all t-card rounded-full"
                    style={{ color: 'var(--accent-orange)' }}
                    title="Reset to default layout"
                  >
                    <FiRefreshCw />
                    Reset Layout
                  </button>
              )}
              {isAdmin && editMode && (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        await setDoc(doc(db, "dashboardLayout", "config"), { 
                          tiles, 
                          lastUpdated: serverTimestamp() 
                        });
                        alert("Custom Layout Synced to Cloud Successfully!");
                      } catch (err: any) {
                        alert("Sync Failed: " + err.message);
                      }
                    }}
                    className="inline-flex h-11 items-center gap-2 px-4 text-sm font-semibold transition-all t-card rounded-full"
                    style={{ color: 'var(--accent-green)' }}
                    title="Save current layout to cloud"
                  >
                    <FiZap />
                    Save to Cloud
                  </button>
              )}
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => { setEditMode(prev => !prev); if (editMode) setShowAddTilePanel(false); }}
                  className="inline-flex h-11 items-center gap-2 px-4 text-sm font-semibold transition-all t-card rounded-full"
                  style={{
                    color: editMode ? '#000' : 'var(--text-primary)',
                    background: editMode ? 'var(--accent-green)' : undefined,
                    boxShadow: editMode ? '0 0 20px var(--accent-green-dim)' : 'none',
                  }}
                >
                  <FiEdit3 />
                  {editMode ? "Done" : "Edit Layout"}
                </button>
              )}
              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                className="group grid h-11 w-11 place-items-center transition-all t-card rounded-full"
                style={{ color: 'var(--text-secondary)' }}
                title={`Switch to ${theme === 'default' ? 'Dark' : 'Light'} theme`}
              >
                {theme === "default" ? <FiMoon className="group-hover:rotate-180 transition-transform duration-500" /> : <FiSun className="group-hover:rotate-90 transition-transform duration-500" />}
              </button>
              <button className="grid h-11 w-11 place-items-center transition-all t-card rounded-full relative" style={{ color: 'var(--text-secondary)' }}>
                <FiBell />
                {hasActiveHelpRequests && <span className="absolute top-2.5 right-2.5 w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse border-2" style={{ borderColor: 'var(--bg-card)' }}></span>}
              </button>
              <button
                type="button"
                onClick={() => setShowAdminModal(true)}
                className="grid h-11 w-11 place-items-center transition-all t-card rounded-full"
                style={{ color: 'var(--text-secondary)' }}
              >
                <FiEye />
              </button>
              <div className="hidden sm:flex items-center gap-3 px-3 py-1.5 t-card rounded-full max-w-full">
                <img
                  src="https://i.pravatar.cc/80?img=12"
                  alt="Profile"
                  className="h-9 w-9 rounded-full object-cover"
                  style={{ boxShadow: '0 0 0 2px var(--accent-green)' }}
                />
                <div>
                  <p className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{isAdmin ? (currentUser?.email ?? 'Admin') : 'Techathon 1.0'}</p>
                  <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{isAdmin ? 'Admin Panel' : 'Event Dashboard'}</p>
                </div>
              </div>
            </div>
          </header>

          {activeTab === "Admin Controls" && isAdmin ? (
            <AdminControlsPage state={state} showNotification={showNotification} />
          ) : activeTab === "Scoring" && isAdmin ? (
            <section className="animate-fade-in mt-2 flex-1">
              <div className="mb-6">
                <h1 className="text-3xl font-semibold tracking-tight md:text-4xl" style={{ color: 'var(--text-primary)' }}>Team Scoring</h1>
                <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Award and modify points for competing teams.</p>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                {state.teams.filter(t => !searchQuery || t.name.toLowerCase().includes(searchQuery.toLowerCase()) || t.department.toLowerCase().includes(searchQuery.toLowerCase())).map((t) => (
                  <article key={t.id} className="t-card p-5 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <div className="icon-circle icon-circle-green" style={{ width: 40, height: 40 }}>
                        <FiUsers size={18} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="font-bold truncate" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t.department} • {t.members?.length} members</p>
                      </div>
                      <div className="text-right">
                        <p className="text-2xl font-black" style={{ color: 'var(--accent-green)' }}>{t.score}</p>
                        <p className="text-[10px] uppercase font-semibold" style={{ color: 'var(--text-muted)' }}>Points</p>
                      </div>
                    </div>
                    <form className="flex gap-2" onSubmit={async (e) => {
                      e.preventDefault();
                      const inputEl = (e.currentTarget as HTMLFormElement).elements.namedItem("pts") as HTMLInputElement;
                      const addPoints = Number(inputEl.value);
                      if (!addPoints && addPoints !== 0) return;
                      await updateDoc(doc(db, "teams", t.id), { score: t.score + addPoints, lastActive: serverTimestamp() });
                      await addDoc(collection(db, "activity"), {
                        message: `Admin modified score for ${t.name} (${addPoints >= 0 ? '+' : ''}${addPoints} pts)`,
                        type: "mentor",
                        timestamp: serverTimestamp(),
                      });
                      inputEl.value = "";
                      showNotification(`Updated score for ${t.name}!`);
                    }}>
                      <input type="number" name="pts" placeholder="+/- Points" required className="flex-1 t-input px-3 py-2 text-sm text-center font-semibold" />
                      <button type="submit" className="px-4 py-2 text-sm font-bold text-black" style={{ background: 'var(--accent-green)', borderRadius: 'var(--card-radius)' }}>Apply</button>
                    </form>
                  </article>
                ))}
                {state.teams.length === 0 && (
                  <div className="col-span-full text-center py-16 t-inset" style={{ borderRadius: 'var(--card-radius)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No teams registered yet. Add teams from Admin Controls.</p>
                  </div>
                )}
              </div>
            </section>
          ) : activeTab === "Gallery" ? (
            <section className="animate-fade-in mt-2 flex-1">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h1 className="text-3xl font-semibold tracking-tight md:text-4xl" style={{ color: 'var(--text-primary)' }}>Event Gallery</h1>
                  <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>View all visuals from the hackathon.</p>
                </div>
              </div>
              <GalleryPanel items={state.gallery} />
            </section>
          ) : activeTab === "Team Portal" ? (
            <section className="animate-fade-in flex-1 w-full" style={{ margin: "-12px -16px", width: "calc(100% + 32px)", maxWidth: "100vw" }}>
              <TeamPortalPage />
            </section>
          ) : (
            <div className={`animate-fade-in ${editMode ? 'edit-mode' : ''}`}>
          <section className="mb-6 flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-semibold tracking-tight md:text-4xl" style={{ color: 'var(--text-primary)' }}>Event Dashboard</h1>
              <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Real-time pulse of your hackathon operations.</p>
              <LiveStatus isLive={state.isLive} lastUpdatedMs={state.lastUpdatedMs} />
            </div>
            {editMode && (
              <div className="flex items-center gap-2 animate-fade-in">
                <span className="px-3 py-1 text-[10px] font-black uppercase tracking-widest" style={{ color: 'var(--accent-green)', background: 'var(--accent-green-dim)', border: '2px solid var(--accent-green)' }}>
                  EDIT MODE
                </span>
              </div>
            )}
          </section>
            {countdownNotice && (
              <p className="mb-4 px-3 py-2 text-xs" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)', border: '1px solid rgba(45,224,143,0.2)', borderRadius: 'var(--card-radius)' }}>
                {countdownNotice}
              </p>
            )}
            {state.listenerError && (
              <p className="mb-4 px-3 py-2 text-xs" style={{ background: 'var(--accent-orange-dim)', color: 'var(--accent-orange)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: 'var(--card-radius)' }}>
                Firestore listener issue: {state.listenerError}
              </p>
            )}

          {/* ============ DYNAMIC TILE GRID ============ */}
          <div className="tile-grid">
            {[...tiles].filter(t => t.visible).sort((a, b) => (a.order || 0) - (b.order || 0)).map((tile) => (
              <div
                key={tile.id}
                className={`tile-wrapper tile-${tile.size} ${removingTileId === tile.id ? 'tile-removing' : 'tile-entering'}`}
              >
                {renderTileContent(tile)}

                {/* Delete button - only in edit mode */}
                {editMode && (
                  <button
                    type="button"
                    className="tile-delete-btn"
                    onClick={(e) => { e.stopPropagation(); handleRemoveTile(tile.id); }}
                    title="Remove tile"
                  >
                    <FiMinus />
                  </button>
                )}

              </div>
            ))}
          </div>

          {/* ============ FLOATING ADD TILE BUTTON ============ */}
          {editMode && (
            <button
              type="button"
              onClick={() => setShowAddTilePanel(prev => !prev)}
              className="fixed bottom-24 sm:bottom-28 right-4 sm:right-8 z-[999] flex items-center gap-2 px-4 sm:px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-black uppercase tracking-wider text-black transition-all animate-fade-in"
              style={{
                background: 'var(--accent-green)',
                border: '3px solid #fff',
                boxShadow: '6px 6px 0px #000, 0 0 30px var(--accent-green-dim)',
              }}
            >
              <FiPlus size={18} />
              Add Tile
            </button>
          )}

          {/* ============ ADD TILE PANEL ============ */}
          {showAddTilePanel && (
            <div className="fixed inset-0 z-[9998]" onClick={() => setShowAddTilePanel(false)}>
              <div
                className="absolute right-0 top-0 h-full w-full max-w-md p-4 sm:p-6 overflow-y-auto add-tile-panel-enter"
                style={{ background: 'var(--bg-surface)', borderLeft: '4px solid var(--accent-green)' }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-xl font-black uppercase tracking-wider" style={{ color: 'var(--accent-green)' }}>
                    + Add Tile
                  </h2>
                  <button onClick={() => setShowAddTilePanel(false)} className="p-2" style={{ color: 'var(--text-secondary)' }}>
                    <FiX size={20} />
                  </button>
                </div>
                <div className="space-y-3">
                  {TILE_TEMPLATES.filter(tmpl => !tiles.some(t => t.type === tmpl.type)).length === 0 && (
                    <div className="text-center py-10 t-inset" style={{ borderRadius: 'var(--card-radius)' }}>
                      <p className="text-sm" style={{ color: 'var(--text-muted)' }}>All available tiles are already on your dashboard.</p>
                    </div>
                  )}
                  {TILE_TEMPLATES.filter(tmpl => !tiles.some(t => t.type === tmpl.type)).map((tmpl) => (
                    <button
                      key={tmpl.type}
                      type="button"
                      onClick={() => handleAddTile(tmpl.type, tmpl.defaultSize)}
                      className="tile-template-card w-full text-left flex items-center gap-4"
                    >
                      <span className="text-3xl flex-shrink-0">{tmpl.icon}</span>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{tmpl.label}</p>
                        <p className="text-[11px]" style={{ color: 'var(--text-muted)' }}>{tmpl.description}</p>
                      </div>
                      <span className="px-2 py-0.5 text-[9px] font-bold uppercase flex-shrink-0" style={{ color: 'var(--accent-green)', border: '1px solid var(--accent-green)' }}>{tmpl.defaultSize}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
          </div>
          )}
        </main>
      </div>

      {showAdminModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'var(--modal-overlay)' }}>
          <div className="relative w-full max-w-md max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setShowAdminModal(false)}
              className="absolute -right-2 -top-2 z-10 grid h-8 w-8 place-items-center rounded-full shadow transition t-card"
              style={{ color: 'var(--text-secondary)' }}
            >
              <FiX />
            </button>
            <div className="overflow-hidden shadow-2xl" style={{ borderRadius: 'var(--card-radius)' }}>
              <AdminAuthPanel
                isAdmin={isAdmin}
                authLoading={authLoading}
                authError={authError}
                currentUser={currentUser}
                onLogin={loginAsAdmin}
                onLogout={logoutAdmin}
              />
            </div>
          </div>
        </div>
      )}


      {/* ============ GLOBAL NOTIFICATION TOAST ============ */}
      {notification && (
        <div 
          className="fixed bottom-24 sm:bottom-10 left-1/2 -translate-x-1/2 z-[10000] w-[calc(100%-1rem)] sm:w-auto max-w-[95vw] px-4 sm:px-6 py-3 sm:py-4 flex items-center gap-3 border-[3px] border-black shadow-[8px_8px_0px_#000] animate-slide-up"
          style={{ 
            background: notification.type === 'success' ? 'var(--accent-green)' : notification.type === 'error' ? '#ef4444' : 'var(--accent-blue)',
            color: notification.type === 'success' || notification.type === 'info' ? '#000' : '#fff'
          }}
        >
          {notification.type === 'success' ? <FiCheck size={20} strokeWidth={3} /> : <FiZap size={20} />}
          <span className="font-black uppercase tracking-widest text-xs sm:text-sm break-words">{notification.message}</span>
        </div>
      )}

      {/* ============ CREDITS BADGE ============ */}
      {showCredits && (
        <div className="fixed bottom-4 right-4 z-[99999] flex items-center gap-2 t-card px-4 py-2 rounded-full animate-fade-in transition-all hover:-translate-y-1" style={{ background: 'var(--bg-card)' }}>
          <a href="https://www.linkedin.com/in/samarth-k-632720275" target="_blank" rel="noopener noreferrer" className="text-[10px] font-black tracking-widest uppercase hover:underline" style={{ color: 'var(--text-primary)' }}>
            Made By Samarth
          </a>
          <button onClick={() => setShowCredits(false)} className="ml-2 text-neutral-500 hover:text-red-500 transition-colors">
            <FiX size={14} />
          </button>
        </div>
      )}
    </div>
  );
}

export default App;
