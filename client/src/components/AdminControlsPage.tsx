import { useState, useEffect } from "react";
import { createPortal } from "react-dom";
import { addDoc, collection, doc, serverTimestamp, setDoc, updateDoc, deleteDoc, deleteField } from "firebase/firestore";
import { useMemo, memo } from "react";
import { FiTrash2, FiPlus, FiChevronDown, FiChevronRight, FiUsers, FiTarget, FiCalendar, FiBarChart2, FiBell, FiImage, FiActivity, FiFileText, FiEdit3, FiCheck, FiHash, FiPlay, FiClock, FiGrid } from "react-icons/fi";
import { db } from "../firebase";
import type { Team, ScheduleItem, Announcement, GalleryItem, ActivityItem, StatDoc } from "../types";

// ---------- Theme-Aware Custom Select ----------
const CustomSelect = ({ value, defaultValue, onChange, options, name }: { value?: string; defaultValue?: string; onChange?: (val: string) => void; options: { label: string; value: string }[], name?: string }) => {
  const [internalVal, setInternalVal] = useState(defaultValue || options[0]?.value);
  const currentVal = value !== undefined ? value : internalVal;
  const [open, setOpen] = useState(false);
  return (
    <div className={`relative w-full ${open ? 'z-[999]' : ''}`}>
      {name && <input type="hidden" name={name} value={currentVal} />}
      <button 
        type="button" 
        onClick={(e) => { e.preventDefault(); setOpen(!open); }} 
        onBlur={() => setTimeout(() => setOpen(false), 150)} 
        className="w-full t-input flex justify-between items-center p-3 text-sm font-medium"
      >
        <span className="truncate">{options.find(o => o.value === currentVal)?.label || currentVal}</span>
        <svg className={`w-4 h-4 transition-transform flex-shrink-0 ml-2 ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--text-muted)' }} fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </button>
      {open && (
        <div className="absolute top-full left-0 z-[1000] w-full mt-1 overflow-hidden animate-fade-in" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: 'var(--card-radius)', boxShadow: '0 20px 60px rgba(0,0,0,0.4)' }}>
          {options.map(opt => (
            <div 
              key={opt.value} 
              onMouseDown={() => { setInternalVal(opt.value); if(onChange) onChange(opt.value); setOpen(false); }} 
              className="px-4 py-2.5 text-sm cursor-pointer transition select-none"
              style={{ background: currentVal === opt.value ? 'var(--accent-green-dim)' : 'transparent', color: currentVal === opt.value ? 'var(--accent-green)' : 'var(--text-secondary)', fontWeight: currentVal === opt.value ? 700 : 400 }}
            >
              {opt.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

// ---------- Theme-Aware Section Header ----------
const SectionHeader = ({ icon: Icon, title, count, accentClass = "icon-circle-green" }: { icon: React.ElementType; title: string; count?: number; accentClass?: string }) => (
  <h3 className="flex flex-wrap items-center gap-3 text-base sm:text-lg font-bold mb-4" style={{ color: 'var(--text-primary)' }}>
    <div className={`icon-circle ${accentClass}`} style={{ width: 36, height: 36 }}>
      <Icon size={16} />
    </div>
    {title}
    {count !== undefined && <span className="ml-auto text-xs sm:text-sm font-semibold px-3 py-1 rounded-full" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>{count}</span>}
  </h3>
);

export default function AdminControlsPage({
  state,
  showNotification,
}: {
  state: {
    teams: Team[];
    schedule: ScheduleItem[];
    announcements: Announcement[];
    gallery: GalleryItem[];
    activity: ActivityItem[];
    stats: Partial<StatDoc>;
  };
  showNotification: (msg: string, type?: 'success' | 'info' | 'error') => void;
}) {
  const [statsForm, setStatsForm] = useState({
    totalParticipants: state.stats.totalParticipants ?? 0,
    teamsRegistered: state.stats.teamsRegistered ?? 0,
    projectsSubmitted: state.stats.projectsSubmitted ?? 0,
    activeNow: state.stats.activeNow ?? 0,
    prizePool: state.stats.prizePool ?? 0,
    eventPhase: state.stats.eventPhase ?? "inauguration",
  });
  const [announcementMessage, setAnnouncementMessage] = useState("");
  const [announcementType, setAnnouncementType] = useState<"info" | "urgent">("info");
  const [imageUrl, setImageUrl] = useState("");
  const [uploadedBy, setUploadedBy] = useState("Admin Dashboard");
  const [scheduleForm, setScheduleForm] = useState({ title: "", time: "", status: "upcoming" as ScheduleItem["status"] });
  
  const [teamForm, setTeamForm] = useState({ name: "", members: "", department: "" });
  const [panelMessage, setPanelMessage] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ id?: string; ids?: string[]; collection: string; message: string } | null>(null);
  const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());

  // Problem Statements state
  const [problemStatements, setProblemStatements] = useState<{ id: string; title: string; description: string; track?: string }[]>([]);
  const [psForm, setPsForm] = useState({ title: "", description: "", track: "" });

  const [activeAdminTab, setActiveAdminTab] = useState("Stats");

  const [themedConfirm, setThemedConfirm] = useState<{
    show: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
  }>({ show: false, title: "", message: "", onConfirm: () => {} });

  const adminTabs = [
    { label: "Stats", icon: FiBarChart2 },
    { label: "Teams", icon: FiUsers },
    { label: "Problem Statements", icon: FiFileText },
    { label: "Schedule", icon: FiCalendar },
    { label: "Announcements", icon: FiBell },
    { label: "Gallery", icon: FiImage },
    { label: "Activity", icon: FiActivity },
    { label: "Tiles Data", icon: FiGrid },
  ];

  const toggleSelection = (id: string, e?: React.ChangeEvent | React.MouseEvent) => {
    if (e) e.stopPropagation();
    setSelectedItems((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAll = (ids: string[]) => {
    if (selectedItems.size === ids.length) {
      setSelectedItems(new Set());
    } else {
      setSelectedItems(new Set(ids));
    }
  };

  const toggleExpanded = (id: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const BulkActionBar = ({ collection, items }: { collection: string; items: any[] }) => {
    return (
      <div className="flex flex-wrap items-center justify-between gap-3 mb-4 p-3 t-inset" style={{ borderRadius: 'var(--card-radius)' }}>
        <label className="flex items-center gap-2 px-2 text-sm font-semibold cursor-pointer select-none" style={{ color: 'var(--text-secondary)' }}>
          <input 
            type="checkbox" 
            checked={items.length > 0 && selectedItems.size === items.length} 
            onChange={() => toggleAll(items.map(i => i.id))} 
            className="w-4 h-4 rounded cursor-pointer accent-[var(--accent-green)]" 
          />
          Select All
        </label>
        {selectedItems.size > 0 && (
          <button 
            type="button"
            onClick={() => setConfirmDelete({ ids: Array.from(selectedItems), collection, message: `Delete ${selectedItems.size} selected items?` })}
            className="w-full sm:w-auto px-3 py-1.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2"
            style={{ background: '#ef4444', color: '#fff' }}
          >
            <FiTrash2 /> Delete Selected ({selectedItems.size})
          </button>
        )}
      </div>
    );
  };

  const showMessage = (msg: string) => {
    showNotification(msg, 'success');
  };

  // Listen to external stats updates
  useEffect(() => {
    setStatsForm({
      totalParticipants: state.stats.totalParticipants ?? 0,
      teamsRegistered: state.stats.teamsRegistered ?? 0,
      projectsSubmitted: state.stats.projectsSubmitted ?? 0,
      activeNow: state.stats.activeNow ?? 0,
      prizePool: state.stats.prizePool ?? 0,
      eventPhase: state.stats.eventPhase ?? "inauguration",
    });
  }, [state.stats]);

  // Update Stats
  const handleUpdateStats = async (e: React.FormEvent) => {
    e.preventDefault();
    await setDoc(doc(db, "stats", "dashboard"), { ...statsForm, lastUpdated: serverTimestamp() }, { merge: true });
    showMessage("Main statistics updated successfully!");
  };

  const handleStartHackathon = () => {
    setThemedConfirm({
      show: true,
      title: "INITIATE MASTER CLOCK",
      message: "Start the 24-hour hackathon timer? This will broadcast to all screens and lock the system phase to HACKATHON.",
      onConfirm: async () => {
        await updateDoc(doc(db, "stats", "dashboard"), {
          hackathonStartTime: serverTimestamp(),
          eventPhase: "hackathon"
        });
        showMessage("PROJECT_OMEGA: 24-Hour Timer Active");
      }
    });
  };

  const handleResetHackathon = () => {
    setThemedConfirm({
      show: true,
      title: "DECOMMISSION TIMER",
      message: "Reset the master timer? This will take the countdown offline for all users.",
      onConfirm: async () => {
        await updateDoc(doc(db, "stats", "dashboard"), {
          hackathonStartTime: deleteField()
        });
        showMessage("Master Timer Offline");
      }
    });
  };

  // Team
  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const membersList = teamForm.members.split(",").map((m) => m.trim()).filter(Boolean);
    await addDoc(collection(db, "teams"), {
      name: teamForm.name,
      members: membersList,
      department: teamForm.department,
      score: 0,
      status: "ideation",
      lastActive: serverTimestamp(),
    });
    setTeamForm({ name: "", members: "", department: "" });
    showMessage("Team added successfully!");
  };
  const handleDeleteTeam = (id: string, name: string) => {
    setConfirmDelete({ id, collection: "teams", message: `Are you sure you want to delete ${name}?` });
  };
  const handleUpdateScore = async (e: React.FormEvent, teamId: string, currentScore: number, teamName: string) => {
    e.preventDefault();
    const inputEl = (e.currentTarget as HTMLFormElement).elements.namedItem("pts") as HTMLInputElement;
    const addPoints = Number(inputEl.value);
    if (!addPoints && addPoints !== 0) return;
    const teamRef = doc(db, "teams", teamId);
    await updateDoc(teamRef, { score: currentScore + addPoints, lastActive: serverTimestamp() });
    await addDoc(collection(db, "activity"), {
      message: `Admin modified score for ${teamName} (${addPoints >= 0 ? '+' : ''}${addPoints} pts)`,
      type: "mentor",
      timestamp: serverTimestamp(),
    });
    inputEl.value = "";
    showMessage("Team score updated.");
  };

  // Problem Statements
  const handleAddProblemStatement = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, "problemStatements"), {
      title: psForm.title,
      description: psForm.description,
      track: psForm.track,
      timestamp: serverTimestamp(),
    });
    setPsForm({ title: "", description: "", track: "" });
    showMessage("Problem statement added!");
  };

  const handleAssignStatement = async (teamId: string, statementTitle: string) => {
    await updateDoc(doc(db, "teams", teamId), { problemStatement: statementTitle });
    showMessage(`Assigned "${statementTitle}" to team.`);
  };

  // Announcements
  const handleAddAnnouncement = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, "announcements"), {
      message: announcementMessage,
      type: announcementType,
      timestamp: serverTimestamp(),
    });
    setAnnouncementMessage("");
    showMessage("Announcement published to all dashboards!");
  };
  const handleDeleteAnnouncement = (id: string) => {
    setConfirmDelete({ id, collection: "announcements", message: "Delete this announcement?" });
  };

  // Schedule
  const handleAddSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, "schedule"), scheduleForm);
    setScheduleForm({ title: "", time: "", status: "upcoming" });
    showMessage("Schedule event added!");
  };
  const handleUpdateScheduleStatus = async (id: string, status: ScheduleItem["status"]) => {
    await updateDoc(doc(db, "schedule", id), { status });
    showMessage(`Schedule status updated to ${status}.`);
  };
  const handleDeleteSchedule = (id: string) => {
    setConfirmDelete({ id, collection: "schedule", message: "Delete this schedule event?" });
  };

  // Gallery
  const handleUploadImage = async (e: React.FormEvent) => {
    e.preventDefault();
    await addDoc(collection(db, "gallery"), {
      imageUrl,
      uploadedBy,
      timestamp: serverTimestamp(),
    });
    setImageUrl("");
    showMessage("Image added to gallery!");
  };
  const handleDeleteGallery = (id: string) => {
    setConfirmDelete({ id, collection: "gallery", message: "Delete this image?" });
  };

  // Activity
  const handleDeleteActivity = (id: string) => {
    setConfirmDelete({ id, collection: "activity", message: "Delete this activity log?" });
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    try {
      if (confirmDelete.ids) {
        await Promise.all(confirmDelete.ids.map(id => deleteDoc(doc(db, confirmDelete.collection, id))));
      } else if (confirmDelete.id) {
        await deleteDoc(doc(db, confirmDelete.collection, confirmDelete.id));
      }
      showMessage("Deleted successfully.");
      setSelectedItems(new Set());
    } catch (e) {
      console.error(e);
      showMessage("Error deleting items.");
    } finally {
      setConfirmDelete(null);
    }
  };

  const DeleteBtn = ({ onClick }: { onClick: (e: any) => void }) => (
    <button type="button" onClick={onClick} className="grid place-items-center h-8 w-8 rounded-full transition flex-shrink-0" style={{ color: '#ef4444' }}>
      <FiTrash2 size={14} />
    </button>
  );

  return (
    <div className="animate-fade-in w-full p-4 sm:p-6 md:p-10 min-h-[850px]" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: 'var(--card-radius)' }}>
      <div className="mb-8 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center" style={{ borderBottom: '1px solid var(--border-main)' }}>
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold" style={{ color: 'var(--text-primary)' }}>Admin Master Controls</h1>
          <p className="mt-1 text-sm" style={{ color: 'var(--text-secondary)' }}>Full read/write permissions for all collections. Handle carefully.</p>
        </div>
      </div>

      {/* Central Toast Popup Portal */}
      {panelMessage && createPortal(
        <div 
          className="fixed top-1/2 left-1/2 z-[100000] toast-enter flex flex-col items-center pointer-events-auto cursor-pointer"
          onClick={() => setPanelMessage("")}
        >
          <div className="px-6 py-4 shadow-2xl flex items-center gap-3" style={{ background: 'var(--bg-card)', border: '1px solid var(--accent-green)', borderRadius: 'var(--card-radius)', color: 'var(--text-primary)' }}>
            <div className="rounded-full p-1" style={{ background: 'var(--accent-green)' }}><svg className="w-5 h-5 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg></div>
            <span className="font-semibold">{panelMessage}</span>
          </div>
        </div>,
        document.body
      )}

      {/* Admin Tabs */}
      <div className="flex gap-2 overflow-x-auto mb-8 pb-2">
        {adminTabs.map((tab) => {
          const TabIcon = tab.icon;
          return (
            <button
              key={tab.label}
              onClick={() => { setActiveAdminTab(tab.label); setSelectedItems(new Set()); }}
              className="whitespace-nowrap px-3 sm:px-4 py-2 text-xs sm:text-sm font-semibold rounded-full transition flex items-center gap-2"
              style={{
                background: activeAdminTab === tab.label ? 'var(--accent-green)' : 'var(--bg-inset)',
                color: activeAdminTab === tab.label ? '#000' : 'var(--text-secondary)',
                border: `1px solid ${activeAdminTab === tab.label ? 'var(--accent-green)' : 'var(--border-main)'}`,
              }}
            >
              <TabIcon size={14} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="animate-fade-in">
        {/* ===== STATS TAB ===== */}
        {activeAdminTab === "Stats" && (
          <form className="max-w-2xl space-y-4" onSubmit={handleUpdateStats}>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 p-4 sm:p-6 t-inset" style={{ borderRadius: 'var(--card-radius)' }}>
              {Object.entries(statsForm).filter(([k]) => k !== "eventPhase").map(([key, val]) => (
                <div key={key}>
                  <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>{key}</label>
                  <input type="number" required value={val as number} onChange={(e) => setStatsForm((prev) => ({ ...prev, [key]: Number(e.target.value) }))} className="w-full t-input p-3 text-sm" />
                </div>
              ))}
              <div className="sm:col-span-2">
                <label className="text-xs font-semibold uppercase block mb-1" style={{ color: 'var(--text-muted)' }}>Event Phase Tracker</label>
                <CustomSelect 
                  value={statsForm.eventPhase} 
                  onChange={(val) => setStatsForm((prev) => ({ ...prev, eventPhase: val }))} 
                  options={[
                    { label: "Inauguration", value: "inauguration" },
                    { label: "Hackathon", value: "hackathon" },
                    { label: "Evaluation", value: "evaluation" },
                    { label: "Valedictory", value: "valedictory" },
                  ]}
                />
              </div>
            </div>
            <button type="submit" className="w-full font-semibold py-3 px-6 text-sm text-black transition" style={{ background: 'var(--accent-green)', borderRadius: 'var(--card-radius)' }}>
              <FiCheck className="inline mr-2" />Save Statistics to Firestore
            </button>

            <div className="mt-8 p-4 sm:p-6 border-[3px] border-dashed border-[var(--border-main)]" style={{ borderRadius: 'var(--card-radius)' }}>
               <h3 className="text-lg font-black uppercase tracking-tighter mb-4 flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
                 <FiPlay size={18} className="text-red-500" /> Hackathon Master Clock
               </h3>
               <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {state.stats.hackathonStartTime ? (
                    <div className="flex items-center justify-center gap-2 py-4 font-black text-black uppercase tracking-widest bg-yellow-400 border-2 border-white" style={{ borderRadius: 'var(--card-radius)' }}>
                      <div className="w-2 h-2 rounded-full bg-black animate-ping" />
                      Timer Running
                    </div>
                  ) : (
                    <button 
                      type="button" 
                      onClick={handleStartHackathon}
                      className="py-4 font-black text-black uppercase tracking-widest transition hover:scale-[1.02] active:scale-95" 
                      style={{ background: 'var(--accent-green)', borderRadius: 'var(--card-radius)' }}
                    >
                      Start 24HR Countdown
                    </button>
                  )}
                  <button 
                    type="button" 
                    onClick={handleResetHackathon}
                    className="py-4 font-black text-white uppercase tracking-widest transition hover:scale-[1.02] active:scale-95 border-2 border-red-500 hover:bg-red-500/10" 
                    style={{ borderRadius: 'var(--card-radius)' }}
                  >
                    Reset Timer
                  </button>
               </div>
               <p className="mt-4 text-xs italic text-center" style={{ color: 'var(--text-muted)' }}>
                 Note: Starting the timer will automatically set the Event Phase to "Hackathon".
               </p>
            </div>
          </form>
        )}

        {/* ===== TEAMS TAB (Expandable with members) ===== */}
        {activeAdminTab === "Teams" && (
          <div className="grid lg:grid-cols-2 gap-5 sm:gap-8">
            <form className="space-y-4 p-4 sm:p-6 t-inset" style={{ borderRadius: 'var(--card-radius)' }} onSubmit={handleAddTeam}>
              <SectionHeader icon={FiPlus} title="Register New Team" accentClass="icon-circle-green" />
              <input required placeholder="Team Name" value={teamForm.name} onChange={(e) => setTeamForm((p) => ({ ...p, name: e.target.value }))} className="w-full t-input p-3 text-sm" />
              <input required placeholder="Department" value={teamForm.department} onChange={(e) => setTeamForm((p) => ({ ...p, department: e.target.value }))} className="w-full t-input p-3 text-sm" />
              <input required placeholder="Members (comma separated)" value={teamForm.members} onChange={(e) => setTeamForm((p) => ({ ...p, members: e.target.value }))} className="w-full t-input p-3 text-sm" />
              <button type="submit" className="w-full font-semibold py-3 px-6 text-sm text-black transition" style={{ background: 'var(--accent-green)', borderRadius: 'var(--card-radius)' }}>
                <FiPlus className="inline mr-2" />Add Team
              </button>
            </form>
            <div>
              <SectionHeader icon={FiUsers} title="Existing Teams" count={state.teams.length} accentClass="icon-circle-purple" />
              <BulkActionBar collection="teams" items={state.teams} />
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {state.teams.map((t) => (
                  <div key={t.id} className="transition select-none" style={{ background: selectedItems.has(t.id) ? 'var(--accent-green-dim)' : 'var(--bg-inset)', border: selectedItems.has(t.id) ? '2px solid var(--accent-green)' : '1px solid var(--border-main)', borderRadius: 'var(--card-radius)' }}>
                    <div className="p-4 flex items-start justify-between cursor-pointer" onClick={(e) => { if ((e.target as HTMLElement).tagName !== 'BUTTON') toggleSelection(t.id) }}>
                      <div className="flex gap-3 items-start">
                        <input type="checkbox" checked={selectedItems.has(t.id)} readOnly className="mt-1 w-4 h-4 rounded cursor-pointer accent-[var(--accent-green)]" />
                        <div>
                          <p className="font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>
                            {t.name} 
                            <span className="ml-2 inline-block px-2 py-0.5 text-xs font-mono rounded-full" style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' }}>{t.status}</span>
                          </p>
                          <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{t.department} • {t.members?.length} members</p>
                          {(t as any).problemStatement && (
                            <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--accent-purple)' }}>
                              <FiFileText size={11} /> {(t as any).problemStatement}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button type="button" onClick={(e) => { e.stopPropagation(); toggleExpanded(t.id); }} className="grid place-items-center h-8 w-8 rounded-full transition" style={{ color: 'var(--text-secondary)' }}>
                          {expandedTeams.has(t.id) ? <FiChevronDown size={16} /> : <FiChevronRight size={16} />}
                        </button>
                        <DeleteBtn onClick={(e: any) => { e.stopPropagation(); handleDeleteTeam(t.id, t.name); }} />
                      </div>
                    </div>
                    {/* Expanded members list */}
                    {expandedTeams.has(t.id) && (
                      <div className="px-4 pb-4 pt-0 animate-fade-in" style={{ borderTop: '1px solid var(--border-main)' }}>
                        <p className="text-xs font-semibold uppercase mb-2 mt-3" style={{ color: 'var(--text-muted)' }}>Team Members</p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {t.members?.map((m, i) => (
                            <div key={i} className="flex items-center gap-2 px-3 py-2 text-sm" style={{ background: 'var(--bg-card)', border: '1px solid var(--border-main)', borderRadius: 'var(--card-radius)', color: 'var(--text-primary)' }}>
                              <div className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)' }}>
                                {m.charAt(0).toUpperCase()}
                              </div>
                              {m}
                            </div>
                          ))}
                        </div>
                        <div className="mt-3">
                          <p className="text-xs font-semibold uppercase mb-2" style={{ color: 'var(--text-muted)' }}>Score</p>
                          <form className="flex flex-wrap gap-2 items-center" onSubmit={(e) => handleUpdateScore(e, t.id, t.score, t.name)}>
                            <span className="px-3 py-1.5 text-sm font-bold" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)', borderRadius: 'var(--card-radius)' }}>{t.score} pts</span>
                            <input type="number" name="pts" placeholder="+/- Pts" required className="w-full sm:w-20 t-input px-2 py-1.5 text-sm text-center" />
                            <button type="submit" className="px-3 py-1.5 text-sm font-semibold text-black" style={{ background: 'var(--accent-green)', borderRadius: 'var(--card-radius)' }}>Apply</button>
                          </form>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== PROBLEM STATEMENTS TAB ===== */}
        {activeAdminTab === "Problem Statements" && (
          <div className="grid lg:grid-cols-2 gap-5 sm:gap-8">
            <form className="space-y-4 p-4 sm:p-6 t-inset" style={{ borderRadius: 'var(--card-radius)' }} onSubmit={handleAddProblemStatement}>
              <SectionHeader icon={FiFileText} title="Add Problem Statement" accentClass="icon-circle-orange" />
              <input required placeholder="Problem Statement Title" value={psForm.title} onChange={(e) => setPsForm(p => ({ ...p, title: e.target.value }))} className="w-full t-input p-3 text-sm" />
              <textarea required placeholder="Detailed description of the problem..." value={psForm.description} onChange={(e) => setPsForm(p => ({ ...p, description: e.target.value }))} className="w-full t-input p-3 text-sm min-h-[100px] resize-y" />
              <input placeholder="Track / Category (optional)" value={psForm.track} onChange={(e) => setPsForm(p => ({ ...p, track: e.target.value }))} className="w-full t-input p-3 text-sm" />
              <button type="submit" className="w-full font-semibold py-3 px-6 text-sm text-black transition" style={{ background: 'var(--accent-orange)', borderRadius: 'var(--card-radius)' }}>
                <FiPlus className="inline mr-2" />Publish Problem Statement
              </button>
            </form>
            <div>
              <SectionHeader icon={FiTarget} title="Assign to Teams" accentClass="icon-circle-purple" />
              <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>Select a team and assign a problem statement to them.</p>
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {state.teams.map((t) => (
                  <div key={t.id} className="p-4 t-inset flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between" style={{ borderRadius: 'var(--card-radius)' }}>
                    <div>
                      <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{t.name}</p>
                      <p className="text-xs mt-0.5" style={{ color: (t as any).problemStatement ? 'var(--accent-purple)' : 'var(--text-muted)' }}>
                        {(t as any).problemStatement || "No statement assigned"}
                      </p>
                    </div>
                    <select
                      className="t-input px-2 py-1.5 text-xs w-full sm:w-auto sm:max-w-[200px]"
                      value={(t as any).problemStatement || ""}
                      onChange={(e) => { if (e.target.value) handleAssignStatement(t.id, e.target.value); }}
                    >
                      <option value="">— Select —</option>
                      <option value="Open Choice">Open Choice</option>
                    </select>
                  </div>
                ))}
                {state.teams.length === 0 && (
                  <div className="text-center py-10 t-inset" style={{ borderRadius: 'var(--card-radius)' }}>
                    <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No teams registered yet.</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ===== SCHEDULE TAB ===== */}
        {activeAdminTab === "Schedule" && (
          <div className="grid lg:grid-cols-2 gap-5 sm:gap-8">
            <form className="space-y-4 p-4 sm:p-6 t-inset" style={{ borderRadius: 'var(--card-radius)' }} onSubmit={handleAddSchedule}>
              <SectionHeader icon={FiCalendar} title="Add Schedule Block" accentClass="icon-circle-blue" />
              <input required placeholder="Event title (e.g. Hackathon Ends)" value={scheduleForm.title} onChange={(e) => setScheduleForm((p) => ({ ...p, title: e.target.value }))} className="w-full t-input p-3 text-sm" />
              <input required placeholder="Time (HH:MM)" value={scheduleForm.time} onChange={(e) => setScheduleForm((p) => ({ ...p, time: e.target.value }))} className="w-full t-input p-3 text-sm" />
              <CustomSelect 
                value={scheduleForm.status}
                onChange={(val) => setScheduleForm((p) => ({ ...p, status: val as ScheduleItem["status"] }))}
                options={[
                  { label: "Upcoming", value: "upcoming" },
                  { label: "Live", value: "live" },
                  { label: "Completed", value: "completed" },
                ]}
              />
              <button type="submit" className="w-full font-semibold py-3 px-6 text-sm text-black transition" style={{ background: 'var(--accent-blue)', borderRadius: 'var(--card-radius)' }}>
                <FiPlus className="inline mr-2" />Publish Event
              </button>
            </form>
            <div>
              <SectionHeader icon={FiCalendar} title="Event Flow Tracker" count={state.schedule.length} accentClass="icon-circle-cyan" />
              <BulkActionBar collection="schedule" items={state.schedule} />
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {state.schedule.map((item) => (
                  <div key={item.id} onClick={(e) => { if ((e.target as HTMLElement).tagName !== 'BUTTON') toggleSelection(item.id) }} className="transition select-none cursor-pointer" style={{ background: selectedItems.has(item.id) ? 'var(--accent-green-dim)' : 'var(--bg-inset)', border: selectedItems.has(item.id) ? '2px solid var(--accent-green)' : '1px solid var(--border-main)', borderRadius: 'var(--card-radius)', padding: '1rem' }}>
                    <div className="flex justify-between items-center mb-3">
                      <div className="flex gap-3 items-center">
                        <input type="checkbox" checked={selectedItems.has(item.id)} readOnly className="w-4 h-4 rounded cursor-pointer accent-[var(--accent-green)]" />
                        <div>
                          <p className="font-semibold leading-tight" style={{ color: 'var(--text-primary)' }}>{item.title}</p>
                          <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--text-muted)' }}>{item.time}</p>
                        </div>
                      </div>
                      <DeleteBtn onClick={(e: any) => { e.stopPropagation(); handleDeleteSchedule(item.id); }} />
                    </div>
                    <div className="flex flex-wrap p-1 rounded-lg" style={{ background: 'var(--bg-card)' }}>
                      {(["upcoming", "live", "completed"] as const).map((st) => (
                        <button key={st} onClick={() => handleUpdateScheduleStatus(item.id, st)} className="flex-1 min-w-[90px] text-[11px] font-semibold py-1.5 uppercase rounded-md transition" style={{ background: item.status === st ? 'var(--accent-green-dim)' : 'transparent', color: item.status === st ? 'var(--accent-green)' : 'var(--text-muted)' }}>{st}</button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== ANNOUNCEMENTS TAB ===== */}
        {activeAdminTab === "Announcements" && (
          <div className="grid lg:grid-cols-2 gap-5 sm:gap-8">
            <form className="space-y-4 p-4 sm:p-6 t-inset" style={{ borderRadius: 'var(--card-radius)' }} onSubmit={handleAddAnnouncement}>
              <SectionHeader icon={FiBell} title="Push Announcement" accentClass="icon-circle-orange" />
              <input required placeholder="Provide a detailed message..." value={announcementMessage} onChange={(e) => setAnnouncementMessage(e.target.value)} className="w-full t-input p-3 text-sm" />
              <CustomSelect 
                value={announcementType}
                onChange={(val) => setAnnouncementType(val as "info" | "urgent")}
                options={[
                  { label: "Information Tag", value: "info" },
                  { label: "Urgent Warning", value: "urgent" },
                ]}
              />
              <button type="submit" className="w-full font-semibold py-3 px-6 text-sm text-black transition" style={{ background: 'var(--accent-orange)', borderRadius: 'var(--card-radius)' }}>
                <FiPlus className="inline mr-2" />Publish
              </button>
            </form>
            <div>
              <SectionHeader icon={FiBell} title="Past Blasts" count={state.announcements.length} accentClass="icon-circle-orange" />
              <BulkActionBar collection="announcements" items={state.announcements} />
              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-2">
                {state.announcements.map((a) => (
                  <div key={a.id} onClick={(e) => { if ((e.target as HTMLElement).tagName !== 'BUTTON') toggleSelection(a.id) }} className="flex gap-3 justify-between items-start cursor-pointer transition select-none p-4" style={{ background: selectedItems.has(a.id) ? 'var(--accent-green-dim)' : 'var(--bg-inset)', border: selectedItems.has(a.id) ? '2px solid var(--accent-green)' : '1px solid var(--border-main)', borderRadius: 'var(--card-radius)' }}>
                    <div className="flex gap-3 items-start">
                         <input type="checkbox" checked={selectedItems.has(a.id)} readOnly className="mt-1 w-4 h-4 rounded cursor-pointer accent-[var(--accent-green)]" />
                         <div>
                           <span className="px-2 py-0.5 rounded text-[10px] uppercase font-bold tracking-wider" style={{ background: a.type === "urgent" ? 'var(--accent-orange-dim)' : 'var(--accent-blue-dim)', color: a.type === "urgent" ? 'var(--accent-orange)' : 'var(--accent-blue)' }}>
                             {a.type}
                           </span>
                           <p className="text-sm font-medium mt-2" style={{ color: 'var(--text-primary)' }}>{a.message}</p>
                         </div>
                    </div>
                    <DeleteBtn onClick={(e: any) => { e.stopPropagation(); handleDeleteAnnouncement(a.id); }} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== GALLERY TAB ===== */}
        {activeAdminTab === "Gallery" && (
          <div className="grid lg:grid-cols-2 gap-5 sm:gap-8">
            <form className="space-y-4 p-4 sm:p-6 t-inset" style={{ borderRadius: 'var(--card-radius)' }} onSubmit={handleUploadImage}>
              <SectionHeader icon={FiImage} title="Add Image Module" accentClass="icon-circle-green" />
              <input required placeholder="https://image-url.com/image.png" value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} className="w-full t-input p-3 text-sm" />
              <input required placeholder="Author" value={uploadedBy} onChange={(e) => setUploadedBy(e.target.value)} className="w-full t-input p-3 text-sm" />
              <button type="submit" className="w-full font-semibold py-3 px-6 text-sm text-black transition" style={{ background: 'var(--accent-green)', borderRadius: 'var(--card-radius)' }}>
                <FiPlus className="inline mr-2" />Upload File Resource
              </button>
            </form>
            <div>
              <SectionHeader icon={FiImage} title="Stored Images" count={state.gallery.length} accentClass="icon-circle-green" />
              <BulkActionBar collection="gallery" items={state.gallery} />
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-3 gap-3 max-h-[500px] overflow-y-auto pr-2">
                {state.gallery.map((g, index) => (
                  <div key={g.id} onClick={(e) => { if ((e.target as HTMLElement).tagName !== 'BUTTON') toggleSelection(g.id) }} className="relative group overflow-hidden cursor-pointer transition select-none aspect-square flex items-center justify-center" style={{ border: selectedItems.has(g.id) ? '2px solid var(--accent-green)' : '1px solid var(--border-main)', borderRadius: 'var(--card-radius)', background: ['var(--accent-green)', 'var(--accent-purple)', 'var(--accent-blue)', 'var(--accent-orange)'][index % 4] }}>
                    <div className="flex flex-col items-center">
                      <span className="text-4xl font-black text-black">{index + 1}</span>
                      <span className="text-[8px] font-bold uppercase tracking-widest text-black/60 mt-1">Resource</span>
                    </div>
                    <input type="checkbox" checked={selectedItems.has(g.id)} readOnly className={`absolute top-2 left-2 z-10 w-4 h-4 rounded accent-[var(--accent-green)] ${selectedItems.has(g.id) ? 'opacity-100' : 'opacity-0 group-hover:opacity-100'} transition cursor-pointer`} />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition">
                       <button type="button" onClick={(e) => { e.stopPropagation(); handleDeleteGallery(g.id); }} className="p-2 rounded-full transform hover:scale-110 transition" style={{ background: '#ef4444', color: '#fff' }}><FiTrash2 size={16} /></button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ===== ACTIVITY TAB ===== */}
        {activeAdminTab === "Activity" && (
          <div>
              <SectionHeader icon={FiActivity} title="Activity Audit Logs" count={state.activity.length} accentClass="icon-circle-cyan" />
              <BulkActionBar collection="activity" items={state.activity} />
              <div className="space-y-2 max-h-[700px] overflow-y-auto pr-2">
                {state.activity.map((a) => (
                  <div key={a.id} onClick={(e) => { if ((e.target as HTMLElement).tagName !== 'BUTTON') toggleSelection(a.id) }} className="cursor-pointer p-3 flex gap-3 justify-between items-center transition select-none" style={{ background: selectedItems.has(a.id) ? 'var(--accent-green-dim)' : 'var(--bg-inset)', border: selectedItems.has(a.id) ? '2px solid var(--accent-green)' : '1px solid var(--border-main)', borderRadius: 'var(--card-radius)' }}>
                    <div className="flex gap-3 items-center min-w-0">
                         <input type="checkbox" checked={selectedItems.has(a.id)} readOnly className="w-4 h-4 rounded cursor-pointer shrink-0 accent-[var(--accent-green)]" />
                         <span className="w-20 text-center px-1 py-0.5 rounded text-[10px] uppercase tracking-wider shrink-0" style={{ background: 'var(--bg-card)', color: 'var(--text-muted)', border: '1px solid var(--border-main)' }}>
                           {a.type}
                         </span>
                         <p className="text-sm truncate" style={{ color: 'var(--text-primary)' }}>{a.message}</p>
                    </div>
                    <DeleteBtn onClick={(e: any) => { e.stopPropagation(); handleDeleteActivity(a.id); }} />
                  </div>
                ))}
              </div>
          </div>
        )}

        {/* ===== TILES DATA TAB ===== */}
        {activeAdminTab === "Tiles Data" && (
          <div className="grid gap-5 sm:gap-6 md:grid-cols-2 xl:grid-cols-3">
            
            {/* Quick Links Admin */}
            <section className="t-card p-5">
              <SectionHeader icon={FiActivity} title="Quick Links" accentClass="icon-circle-cyan" />
              <form className="space-y-2" onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const name = (form.elements.namedItem("qlname") as HTMLInputElement).value;
                const url = (form.elements.namedItem("qlurl") as HTMLInputElement).value;
                if (!name || !url) return;
                await addDoc(collection(db, "quickLinks"), { name, url, timestamp: serverTimestamp() });
                (form.elements.namedItem("qlname") as HTMLInputElement).value = "";
                (form.elements.namedItem("qlurl") as HTMLInputElement).value = "";
                showMessage("Quick Link added!");
              }}>
                <input name="qlname" placeholder="Link Name" required className="w-full t-input px-3 py-2 text-sm" />
                <input name="qlurl" placeholder="https://..." required className="w-full t-input px-3 py-2 text-sm" />
                <button type="submit" className="w-full py-2 font-bold text-sm text-black" style={{ background: 'var(--accent-cyan)', borderRadius: 'var(--card-radius)' }}>
                  <FiPlus className="inline mr-1" /> Add Link
                </button>
              </form>
            </section>

            {/* Problem Statements Admin */}
            <section className="t-card p-5">
              <SectionHeader icon={FiFileText} title="Problem Statements" accentClass="icon-circle-purple" />
              <form className="space-y-2" onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const title = (form.elements.namedItem("pstitle") as HTMLInputElement).value;
                const description = (form.elements.namedItem("psdesc") as HTMLTextAreaElement).value;
                const difficulty = (form.elements.namedItem("psdiff") as HTMLInputElement).value || "medium";
                const track = (form.elements.namedItem("pstrack") as HTMLInputElement).value;
                if (!title || !description) return;
                await addDoc(collection(db, "problemStatements"), { title, description, difficulty, track, timestamp: serverTimestamp() });
                form.reset();
                showMessage("Problem Statement added!");
              }}>
                <input name="pstitle" placeholder="Problem Title" required className="w-full t-input px-3 py-2 text-sm" />
                <textarea name="psdesc" placeholder="Description..." required className="w-full t-input px-3 py-2 text-sm resize-none h-20" />
                <div className="flex flex-col sm:flex-row gap-2">
                  <CustomSelect name="psdiff" options={[
                    { label: "Easy", value: "easy" },
                    { label: "Medium", value: "medium" },
                    { label: "Hard", value: "hard" },
                  ]} />
                  <input name="pstrack" placeholder="Track" className="flex-1 t-input px-3 py-2 text-sm" />
                </div>
                <button type="submit" className="w-full py-2 font-bold text-sm text-black" style={{ background: 'var(--accent-purple)', borderRadius: 'var(--card-radius)' }}>
                  <FiPlus className="inline mr-1" /> Add Problem
                </button>
              </form>
            </section>

            {/* Idea Board Admin */}
            <section className="t-card p-5">
              <SectionHeader icon={FiBell} title="Idea Board" accentClass="icon-circle-orange" />
              <form className="space-y-2" onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const prompt = (form.elements.namedItem("ideaprompt") as HTMLInputElement).value;
                const category = (form.elements.namedItem("ideacat") as HTMLInputElement).value;
                if (!prompt) return;
                await addDoc(collection(db, "ideaBoard"), { prompt, category, timestamp: serverTimestamp() });
                form.reset();
                showMessage("Idea Prompt added!");
              }}>
                <input name="ideaprompt" placeholder="Innovation prompt..." required className="w-full t-input px-3 py-2 text-sm" />
                <input name="ideacat" placeholder="Category (optional)" className="w-full t-input px-3 py-2 text-sm" />
                <button type="submit" className="w-full py-2 font-bold text-sm text-black" style={{ background: 'var(--accent-orange)', borderRadius: 'var(--card-radius)' }}>
                  <FiPlus className="inline mr-1" /> Add Prompt
                </button>
              </form>
            </section>

            {/* Resources Admin */}
            <section className="t-card p-5">
              <SectionHeader icon={FiTarget} title="Resources" accentClass="icon-circle-blue" />
              <form className="space-y-2" onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const name = (form.elements.namedItem("resname") as HTMLInputElement).value;
                const url = (form.elements.namedItem("resurl") as HTMLInputElement).value;
                const category = (form.elements.namedItem("rescat") as HTMLInputElement).value || "docs";
                const description = (form.elements.namedItem("resdesc") as HTMLInputElement).value;
                if (!name || !url) return;
                await addDoc(collection(db, "resources"), { name, url, category, description });
                form.reset();
                showMessage("Resource added!");
              }}>
                <input name="resname" placeholder="Resource Name" required className="w-full t-input px-3 py-2 text-sm" />
                <input name="resurl" placeholder="https://..." required className="w-full t-input px-3 py-2 text-sm" />
                <div className="flex flex-col sm:flex-row gap-2">
                  <CustomSelect name="rescat" options={[
                    { label: "API", value: "api" },
                    { label: "Docs", value: "docs" },
                    { label: "Tool", value: "tool" },
                    { label: "Template", value: "template" },
                  ]} />
                  <input name="resdesc" placeholder="Description" className="flex-1 t-input px-3 py-2 text-sm" />
                </div>
                <button type="submit" className="w-full py-2 font-bold text-sm text-black" style={{ background: 'var(--accent-blue)', borderRadius: 'var(--card-radius)' }}>
                  <FiPlus className="inline mr-1" /> Add Resource
                </button>
              </form>
            </section>

            {/* Voting Admin */}
            <section className="t-card p-5 md:col-span-2">
              <SectionHeader icon={FiBarChart2} title="Audience Voting" accentClass="icon-circle-pink" />
              <form className="space-y-2" onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const question = (form.elements.namedItem("vquestion") as HTMLInputElement).value;
                const optionsRaw = (form.elements.namedItem("voptions") as HTMLInputElement).value;
                if (!question || !optionsRaw) return;
                const options = optionsRaw.split(",").map(s => ({ label: s.trim(), votes: 0 })).filter(o => o.label);
                if (options.length < 2) return;
                await addDoc(collection(db, "votes"), { question, options, isActive: true, timestamp: serverTimestamp() });
                form.reset();
                showMessage("Poll created successfully!");
              }}>
                <input name="vquestion" placeholder="Poll Question" required className="w-full t-input px-3 py-2 text-sm" />
                <input name="voptions" placeholder="Option 1, Option 2, Option 3..." required className="w-full t-input px-3 py-2 text-sm" />
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>Separate options with commas. Min 2 options.</p>
                <button type="submit" className="w-full py-2 font-bold text-sm text-black" style={{ background: 'var(--accent-pink)', borderRadius: 'var(--card-radius)' }}>
                  <FiPlus className="inline mr-1" /> Create Poll
                </button>
              </form>
            </section>
          </div>
        )}
      </div>

      {/* Custom Themed Confirmation Modal */}
      {themedConfirm.show && createPortal(
        <div className="fixed inset-0 z-[100001] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in" style={{ background: 'rgba(0,0,0,0.85)' }}>
           <div 
             className="w-full max-w-md p-5 sm:p-8 border-[6px] border-white shadow-[15px_15px_0px_rgba(255,255,255,1)] transition-all transform scale-100"
             style={{ background: 'var(--bg-card)' }}
           >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-red-500 border-2 border-white flex items-center justify-center text-black font-black">!</div>
                <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>{themedConfirm.title}</h3>
              </div>
              <p className="text-base sm:text-lg font-medium leading-relaxed mb-8" style={{ color: 'var(--text-secondary)' }}>{themedConfirm.message}</p>
              <div className="grid grid-cols-2 gap-4">
                 <button 
                   onClick={() => { themedConfirm.onConfirm(); setThemedConfirm(p => ({ ...p, show: false })); }}
                   className="py-4 font-black text-black uppercase tracking-widest transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_white] active:translate-x-0 active:translate-y-0"
                   style={{ background: 'var(--accent-green)' }}
                 >
                   Confirm
                 </button>
                 <button 
                   onClick={() => setThemedConfirm(p => ({ ...p, show: false }))}
                   className="py-4 font-black text-white uppercase tracking-widest border-2 border-white hover:bg-white/10"
                 >
                   Abort
                 </button>
              </div>
           </div>
        </div>,
        document.body
      )}

      {/* Delete Confirmation Modal */}
      {confirmDelete && createPortal(
        <div className="fixed inset-0 z-[100002] flex items-center justify-center p-4 backdrop-blur-md animate-fade-in" style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="max-w-sm w-full p-5 sm:p-8 border-[6px] border-white shadow-[12px_12px_0px_#ef4444]" style={{ background: 'var(--bg-card)' }}>
            <h3 className="text-xl sm:text-2xl font-black uppercase tracking-tighter mb-2" style={{ color: 'var(--text-primary)' }}>Warning_Delete</h3>
            <p className="mb-8 font-medium text-base sm:text-lg leading-tight" style={{ color: 'var(--text-secondary)' }}>{confirmDelete.message}</p>
            <div className="grid grid-cols-2 gap-4">
              <button 
                type="button"
                onClick={() => setConfirmDelete(null)}
                className="py-3 font-black uppercase tracking-widest border-2 border-white hover:bg-white/10"
              >
                Abort
              </button>
              <button 
                type="button"
                onClick={executeDelete}
                className="py-3 font-black uppercase tracking-widest text-white transition-all hover:translate-x-[-2px] hover:translate-y-[-2px] hover:shadow-[4px_4px_0px_white] active:translate-x-0 active:translate-y-0"
                style={{ background: '#ef4444' }}
              >
                Confirm
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}


      {/* Tiles Data Management moved to its own tab */}

    </div>
  );
}
