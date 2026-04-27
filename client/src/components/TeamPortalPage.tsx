import { useState, useEffect, memo, useMemo } from "react";
import {
  collection,
  query,
  where,
  getDocs,
  onSnapshot,
  orderBy,
  limit,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  FiUsers,
  FiWifi,
  FiHome,
  FiFileText,
  FiMail,
  FiUser,
  FiLogOut,
  FiGrid,
  FiImage,
  FiBell,
  FiCalendar,
  FiAward,
  FiClock,
  FiInfo,
  FiChevronRight,
  FiStar,
  FiShield,
} from "react-icons/fi";
import type {
  TeamPortalEntry,
  Announcement,
  ScheduleItem,
  GalleryItem,
} from "../types";

// ====== CODE INPUT COMPONENT ======
const CodeInput = memo(function CodeInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (val: string) => void;
}) {
  const digits = value.padEnd(6, " ").split("");

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      onChange(value.slice(0, -1));
      e.preventDefault();
    }
  };

  const handleInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
    if (raw.length <= 6) onChange(raw);
  };

  return (
    <div className="team-code-input-wrap">
      <div className="team-code-boxes">
        {digits.map((d, i) => (
          <div
            key={i}
            className={`team-code-box ${
              i === value.length ? "team-code-box-active" : ""
            } ${d.trim() ? "team-code-box-filled" : ""}`}
          >
            {d.trim() || ""}
          </div>
        ))}
      </div>
      <input
        type="text"
        className="team-code-hidden-input"
        value={value}
        onChange={handleInput}
        onKeyDown={handleKeyDown}
        maxLength={6}
        autoFocus
        autoComplete="off"
        spellCheck={false}
      />
    </div>
  );
});

// ====== LOGIN SCREEN ======
const TeamLoginScreen = memo(function TeamLoginScreen({
  onLogin,
}: {
  onLogin: (team: TeamPortalEntry) => void;
}) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async () => {
    if (code.length !== 6) {
      setError("Please enter a valid 6-digit code");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const q = query(
        collection(db, "teamPortal"),
        where("teamCode", "==", code.toUpperCase())
      );
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        setError("Invalid code. Please check and try again.");
        setLoading(false);
        return;
      }
      const docData = snapshot.docs[0];
      const team = {
        id: docData.id,
        ...(docData.data() as Omit<TeamPortalEntry, "id">),
      };
      // Store in session
      sessionStorage.setItem("teamPortalCode", code.toUpperCase());
      onLogin(team);
    } catch (err) {
      setError("Something went wrong. Please try again.");
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="team-login-screen">
      <div className="team-login-bg-grid" />
      <div className="team-login-card animate-fade-in">
        <div className="team-login-badge">
          <FiShield size={24} />
        </div>
        <h1 className="team-login-title">TEAM_PORTAL</h1>
        <p className="team-login-subtitle">
          Enter your 6-digit team access code
        </p>

        <CodeInput value={code} onChange={setCode} />

        {error && <p className="team-login-error">{error}</p>}

        <button
          type="button"
          className="team-login-btn"
          onClick={handleSubmit}
          disabled={loading || code.length !== 6}
        >
          {loading ? (
            <span className="team-login-spinner" />
          ) : (
            <>
              <FiChevronRight size={20} />
              ACCESS PORTAL
            </>
          )}
        </button>

        <p className="team-login-hint">
          Your code was shared by the event organizers
        </p>
      </div>
    </div>
  );
});

// ====== TEAM DASHBOARD ======
function TeamDashboard({
  team: initialTeam,
  onLogout,
}: {
  team: TeamPortalEntry;
  onLogout: () => void;
}) {
  const [team, setTeam] = useState<TeamPortalEntry>(initialTeam);
  const [activeSection, setActiveSection] = useState("overview");
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [schedule, setSchedule] = useState<ScheduleItem[]>([]);
  const [gallery, setGallery] = useState<GalleryItem[]>([]);

  // Live listener for team data
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "teamPortal"),
      (snapshot) => {
        const found = snapshot.docs.find(
          (d) => d.data().teamCode === team.teamCode
        );
        if (found) {
          setTeam({
            id: found.id,
            ...(found.data() as Omit<TeamPortalEntry, "id">),
          });
        }
      }
    );
    return () => unsub();
  }, [team.teamCode]);

  // Announcements listener
  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collection(db, "announcements"),
        orderBy("timestamp", "desc"),
        limit(10)
      ),
      (snapshot) => {
        setAnnouncements(
          snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<Announcement, "id">),
          }))
        );
      }
    );
    return () => unsub();
  }, []);

  // Schedule listener
  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "schedule"), orderBy("time", "asc")),
      (snapshot) => {
        setSchedule(
          snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ScheduleItem, "id">),
          }))
        );
      }
    );
    return () => unsub();
  }, []);

  // Gallery listener
  useEffect(() => {
    const unsub = onSnapshot(
      query(
        collection(db, "gallery"),
        orderBy("timestamp", "desc"),
        limit(20)
      ),
      (snapshot) => {
        setGallery(
          snapshot.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<GalleryItem, "id">),
          }))
        );
      }
    );
    return () => unsub();
  }, []);

  const sections = [
    { id: "overview", label: "Overview", icon: FiGrid },
    { id: "details", label: "Room & WiFi", icon: FiWifi },
    { id: "problem", label: "Problem", icon: FiFileText },
    { id: "schedule", label: "Schedule", icon: FiCalendar },
    { id: "announcements", label: "Alerts", icon: FiBell },
    { id: "gallery", label: "Gallery", icon: FiImage },
  ];

  const getEmbedUrl = (url: string) => {
    if (!url) return "";
    const folderMatch = url.match(/\/folders\/([a-zA-Z0-9-_]+)/);
    if (folderMatch)
      return `https://drive.google.com/embeddedfolderview?id=${folderMatch[1]}#grid`;
    if (url.includes("drive.google.com")) {
      const idMatch = url.match(/id=([a-zA-Z0-9-_]+)/);
      if (idMatch)
        return `https://drive.google.com/embeddedfolderview?id=${idMatch[1]}#grid`;
      const fileMatch = url.match(/\/file\/d\/([a-zA-Z0-9-_]+)/);
      if (fileMatch)
        return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
    }
    return url;
  };

  return (
    <div
      className="team-dashboard"
      style={{ background: "var(--bg-app)", minHeight: "100vh" }}
    >
      {/* Welcome Header */}
      <header className="team-dash-header">
        <div className="team-dash-header-inner">
          <div>
            <p className="team-dash-welcome-tag">WELCOME, TEAM</p>
            <h1 className="team-dash-team-name">{team.teamName}</h1>
            <p className="team-dash-leader">
              <FiUser size={12} style={{ display: "inline" }} /> Led by{" "}
              <strong>{team.leaderName}</strong>
            </p>
          </div>
          <div className="team-dash-header-actions">
            <div className="team-dash-code-badge">
              <span className="team-dash-code-label">CODE</span>
              <span className="team-dash-code-value">{team.teamCode}</span>
            </div>
            <button
              type="button"
              onClick={onLogout}
              className="team-dash-logout-btn"
              title="Logout"
            >
              <FiLogOut size={18} />
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <nav className="team-dash-nav">
        <div className="team-dash-nav-inner">
          {sections.map((s) => {
            const Icon = s.icon;
            return (
              <button
                key={s.id}
                onClick={() => setActiveSection(s.id)}
                className={`team-dash-nav-btn ${
                  activeSection === s.id ? "team-dash-nav-btn-active" : ""
                }`}
              >
                <Icon size={16} />
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Content Area */}
      <main className="team-dash-content">
        {/* ====== OVERVIEW ====== */}
        {activeSection === "overview" && (
          <div className="animate-fade-in">
            {/* Quick Info Cards */}
            <div className="team-dash-grid-3">
              <div className="t-card team-info-card team-info-card-room">
                <div className="team-info-card-icon">
                  <FiHome size={22} />
                </div>
                <p className="team-info-card-label">Allotted Room</p>
                <p className="team-info-card-value">
                  {team.allottedRoom || "Not Assigned Yet"}
                </p>
              </div>
              <div className="t-card team-info-card team-info-card-wifi">
                <div className="team-info-card-icon">
                  <FiWifi size={22} />
                </div>
                <p className="team-info-card-label">Internet</p>
                <p className="team-info-card-value">
                  {team.internetDetails
                    ? team.internetDetails.split("\n")[0]
                    : "Details Pending"}
                </p>
              </div>
              <div className="t-card team-info-card team-info-card-ps">
                <div className="team-info-card-icon">
                  <FiFileText size={22} />
                </div>
                <p className="team-info-card-label">Problem Statement</p>
                <p className="team-info-card-value">
                  {team.problemStatementTitle || "Awaiting Assignment"}
                </p>
              </div>
            </div>

            {/* Team Members */}
            <div className="t-card team-members-card">
              <h2 className="team-section-title">
                <div className="icon-circle icon-circle-green" style={{ width: 36, height: 36 }}>
                  <FiUsers size={16} />
                </div>
                Team Members
                <span className="team-member-count">
                  {team.participants?.length || 0}
                </span>
              </h2>
              <div className="team-members-grid">
                {/* Leader */}
                <div className="team-member-item team-member-leader">
                  <div className="team-member-avatar team-member-avatar-leader">
                    <FiStar size={16} />
                  </div>
                  <div>
                    <p className="team-member-name">{team.leaderName}</p>
                    <p className="team-member-email">{team.leaderEmail}</p>
                    <span className="team-member-role-tag">LEADER</span>
                  </div>
                </div>
                {/* Participants */}
                {team.participants?.map((p, i) => (
                  <div className="team-member-item" key={i}>
                    <div className="team-member-avatar">
                      {p.name?.charAt(0)?.toUpperCase() || "?"}
                    </div>
                    <div>
                      <p className="team-member-name">{p.name}</p>
                      <p className="team-member-email">{p.email}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Latest Announcements */}
            {announcements.length > 0 && (
              <div className="t-card team-announcements-preview">
                <h2 className="team-section-title">
                  <div className="icon-circle icon-circle-orange" style={{ width: 36, height: 36 }}>
                    <FiBell size={16} />
                  </div>
                  Latest Announcements
                </h2>
                <div className="team-ann-list">
                  {announcements.slice(0, 3).map((a) => (
                    <div key={a.id} className="team-ann-item">
                      <span
                        className={`team-ann-badge ${
                          a.type === "urgent"
                            ? "team-ann-badge-urgent"
                            : "team-ann-badge-info"
                        }`}
                      >
                        {a.type}
                      </span>
                      <p className="team-ann-msg">{a.message}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ====== ROOM & WIFI ====== */}
        {activeSection === "details" && (
          <div className="animate-fade-in">
            <div className="team-detail-section">
              <div className="t-card team-detail-card">
                <div className="team-detail-icon-wrap team-detail-icon-room">
                  <FiHome size={32} />
                </div>
                <h2 className="team-detail-heading">Allotted Room</h2>
                <p className="team-detail-value">
                  {team.allottedRoom || "Not assigned yet. Check back soon."}
                </p>
              </div>

              <div className="t-card team-detail-card">
                <div className="team-detail-icon-wrap team-detail-icon-wifi">
                  <FiWifi size={32} />
                </div>
                <h2 className="team-detail-heading">Internet Connection</h2>
                <pre className="team-detail-pre">
                  {team.internetDetails ||
                    "WiFi details will be shared before the event starts."}
                </pre>
              </div>

              {team.additionalNotes && (
                <div className="t-card team-detail-card">
                  <div className="team-detail-icon-wrap team-detail-icon-notes">
                    <FiInfo size={32} />
                  </div>
                  <h2 className="team-detail-heading">Additional Notes</h2>
                  <pre className="team-detail-pre">
                    {team.additionalNotes}
                  </pre>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ====== PROBLEM STATEMENT ====== */}
        {activeSection === "problem" && (
          <div className="animate-fade-in">
            {team.problemStatementTitle ? (
              <div className="t-card team-problem-card">
                <div className="team-problem-badge">ASSIGNED</div>
                <h2 className="team-problem-title">
                  {team.problemStatementTitle}
                </h2>
                <div className="team-problem-divider" />
                <pre className="team-problem-desc">
                  {team.problemStatementDescription ||
                    "No detailed description provided yet."}
                </pre>
              </div>
            ) : (
              <div className="t-card team-problem-empty">
                <FiFileText size={48} style={{ color: "var(--text-muted)" }} />
                <h2>Problem Statement Not Assigned</h2>
                <p>
                  The admin will assign your problem statement soon. Check back
                  later.
                </p>
              </div>
            )}
          </div>
        )}

        {/* ====== SCHEDULE ====== */}
        {activeSection === "schedule" && (
          <div className="animate-fade-in">
            <div className="t-card" style={{ padding: "24px" }}>
              <h2 className="team-section-title" style={{ marginBottom: 20 }}>
                <div className="icon-circle icon-circle-blue" style={{ width: 36, height: 36 }}>
                  <FiCalendar size={16} />
                </div>
                Event Schedule
              </h2>
              {schedule.length > 0 ? (
                <div className="team-schedule-list">
                  {schedule.map((s) => (
                    <div key={s.id} className="team-schedule-item">
                      <div className="team-schedule-time">{s.time}</div>
                      <div className="team-schedule-line">
                        <div
                          className={`team-schedule-dot ${
                            s.status === "live"
                              ? "team-schedule-dot-live"
                              : s.status === "completed"
                              ? "team-schedule-dot-done"
                              : ""
                          }`}
                        />
                      </div>
                      <div className="team-schedule-info">
                        <p className="team-schedule-title">{s.title}</p>
                        <span
                          className={`team-schedule-status team-schedule-status-${s.status}`}
                        >
                          {s.status}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                  Schedule not published yet.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ====== ANNOUNCEMENTS ====== */}
        {activeSection === "announcements" && (
          <div className="animate-fade-in">
            <div className="t-card" style={{ padding: "24px" }}>
              <h2 className="team-section-title" style={{ marginBottom: 20 }}>
                <div className="icon-circle icon-circle-orange" style={{ width: 36, height: 36 }}>
                  <FiBell size={16} />
                </div>
                All Announcements
              </h2>
              {announcements.length > 0 ? (
                <div className="team-ann-list">
                  {announcements.map((a) => (
                    <div key={a.id} className="team-ann-item">
                      <span
                        className={`team-ann-badge ${
                          a.type === "urgent"
                            ? "team-ann-badge-urgent"
                            : "team-ann-badge-info"
                        }`}
                      >
                        {a.type}
                      </span>
                      <p className="team-ann-msg">{a.message}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                  No announcements yet.
                </p>
              )}
            </div>
          </div>
        )}

        {/* ====== GALLERY ====== */}
        {activeSection === "gallery" && (
          <div className="animate-fade-in">
            <div className="t-card" style={{ padding: "24px" }}>
              <h2 className="team-section-title" style={{ marginBottom: 20 }}>
                <div className="icon-circle icon-circle-green" style={{ width: 36, height: 36 }}>
                  <FiImage size={16} />
                </div>
                Event Gallery
              </h2>
              {gallery.length > 0 ? (
                <div className="team-gallery-list">
                  {gallery.map((g, i) => {
                    const embed = getEmbedUrl(g.imageUrl);
                    const isDrive = embed.includes("drive.google.com");
                    return (
                      <div key={g.id} className="team-gallery-item">
                        {isDrive ? (
                          <iframe
                            src={embed}
                            title={g.uploadedBy}
                            className="team-gallery-iframe"
                            allow="autoplay"
                          />
                        ) : (
                          <div
                            className="team-gallery-placeholder"
                            style={{
                              background: [
                                "var(--accent-green)",
                                "var(--accent-purple)",
                                "var(--accent-blue)",
                                "var(--accent-orange)",
                              ][i % 4],
                            }}
                          >
                            <span className="team-gallery-placeholder-num">
                              {i + 1}
                            </span>
                          </div>
                        )}
                        <p className="team-gallery-label">
                          {g.uploadedBy || `Gallery ${i + 1}`}
                        </p>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p style={{ color: "var(--text-muted)", fontSize: 14 }}>
                  No gallery items yet.
                </p>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// ====== MAIN EXPORT ======
export default function TeamPortalPage() {
  const [team, setTeam] = useState<TeamPortalEntry | null>(null);
  const [checking, setChecking] = useState(true);

  // Check session for saved code
  useEffect(() => {
    const savedCode = sessionStorage.getItem("teamPortalCode");
    if (savedCode) {
      const q = query(
        collection(db, "teamPortal"),
        where("teamCode", "==", savedCode)
      );
      getDocs(q)
        .then((snapshot) => {
          if (!snapshot.empty) {
            const d = snapshot.docs[0];
            setTeam({
              id: d.id,
              ...(d.data() as Omit<TeamPortalEntry, "id">),
            });
          }
        })
        .finally(() => setChecking(false));
    } else {
      setChecking(false);
    }
  }, []);

  const handleLogout = () => {
    sessionStorage.removeItem("teamPortalCode");
    setTeam(null);
  };

  if (checking) {
    return (
      <div className="team-login-screen">
        <div className="team-login-bg-grid" />
        <div className="team-login-spinner-lg" />
      </div>
    );
  }

  if (!team) {
    return <TeamLoginScreen onLogin={setTeam} />;
  }

  return <TeamDashboard team={team} onLogout={handleLogout} />;
}
