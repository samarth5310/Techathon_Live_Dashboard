import { useState, useEffect } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  updateDoc,
} from "firebase/firestore";
import { db } from "../firebase";
import {
  FiPlus,
  FiTrash2,
  FiUsers,
  FiEdit3,
  FiChevronDown,
  FiChevronRight,
  FiCopy,
  FiCheck,
  FiUpload,
  FiHome,
  FiWifi,
  FiFileText,
  FiInfo,
  FiX,
} from "react-icons/fi";
import type { TeamPortalEntry, TeamPortalParticipant } from "../types";

function generateCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function AdminTeamPortal({
  showNotification,
}: {
  showNotification: (msg: string, type?: "success" | "info" | "error") => void;
}) {
  const [teams, setTeams] = useState<TeamPortalEntry[]>([]);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [showBulkUpload, setShowBulkUpload] = useState(false);
  const [bulkJson, setBulkJson] = useState("");

  // Single team form
  const [form, setForm] = useState({
    teamName: "",
    leaderName: "",
    leaderEmail: "",
    participantsRaw: "", // "Name1,email1\nName2,email2"
  });

  // Edit form for room/wifi/problem
  const [editForm, setEditForm] = useState({
    allottedRoom: "",
    internetDetails: "",
    problemStatementTitle: "",
    problemStatementDescription: "",
    additionalNotes: "",
  });

  // Listen to teamPortal collection
  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "teamPortal"),
      (snapshot) => {
        const data = snapshot.docs
          .map((d) => ({
            id: d.id,
            ...(d.data() as Omit<TeamPortalEntry, "id">),
          }))
          .sort((a, b) => (a.teamName || "").localeCompare(b.teamName || ""));
        setTeams(data);
      }
    );
    return () => unsub();
  }, []);

  const parseParticipants = (raw: string): TeamPortalParticipant[] => {
    return raw
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => {
        const parts = line.split(",").map((p) => p.trim());
        return { name: parts[0] || "", email: parts[1] || "" };
      });
  };

  const handleAddTeam = async (e: React.FormEvent) => {
    e.preventDefault();
    const participants = parseParticipants(form.participantsRaw);
    const code = generateCode();

    await addDoc(collection(db, "teamPortal"), {
      teamName: form.teamName,
      teamCode: code,
      leaderName: form.leaderName,
      leaderEmail: form.leaderEmail,
      participants,
      allottedRoom: "",
      internetDetails: "",
      problemStatementTitle: "",
      problemStatementDescription: "",
      additionalNotes: "",
      createdAt: serverTimestamp(),
    });

    setForm({ teamName: "", leaderName: "", leaderEmail: "", participantsRaw: "" });
    setShowAddForm(false);
    showNotification(`Team "${form.teamName}" added! Code: ${code}`);
  };

  const handleBulkUpload = async () => {
    try {
      const parsed = JSON.parse(bulkJson);
      if (!Array.isArray(parsed)) {
        showNotification("JSON must be an array of team objects", "error");
        return;
      }
      let count = 0;
      for (const t of parsed) {
        const code = generateCode();
        const participants = (t.participants || []).map((p: any) => ({
          name: p.name || "",
          email: p.email || "",
        }));
        await addDoc(collection(db, "teamPortal"), {
          teamName: t.teamName || t.name || "",
          teamCode: code,
          leaderName: t.leaderName || t.leader || "",
          leaderEmail: t.leaderEmail || "",
          participants,
          allottedRoom: t.allottedRoom || "",
          internetDetails: t.internetDetails || "",
          problemStatementTitle: t.problemStatementTitle || "",
          problemStatementDescription: t.problemStatementDescription || "",
          additionalNotes: t.additionalNotes || "",
          createdAt: serverTimestamp(),
        });
        count++;
      }
      setBulkJson("");
      setShowBulkUpload(false);
      showNotification(`${count} teams uploaded successfully!`);
    } catch (err) {
      showNotification("Invalid JSON format. Please check and try again.", "error");
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete team "${name}"? This cannot be undone.`)) return;
    await deleteDoc(doc(db, "teamPortal", id));
    showNotification(`Team "${name}" deleted.`, "info");
  };

  const startEdit = (t: TeamPortalEntry) => {
    setEditingId(t.id);
    setEditForm({
      allottedRoom: t.allottedRoom || "",
      internetDetails: t.internetDetails || "",
      problemStatementTitle: t.problemStatementTitle || "",
      problemStatementDescription: t.problemStatementDescription || "",
      additionalNotes: t.additionalNotes || "",
    });
  };

  const handleSaveEdit = async (id: string) => {
    await updateDoc(doc(db, "teamPortal", id), { ...editForm });
    setEditingId(null);
    showNotification("Team details updated!");
  };

  const copyCode = (code: string, id: string) => {
    navigator.clipboard.writeText(code);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  return (
    <div className="animate-fade-in w-full">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
        <div>
          <h2
            className="text-xl sm:text-2xl font-bold flex items-center gap-3"
            style={{ color: "var(--text-primary)" }}
          >
            <div className="icon-circle icon-circle-cyan" style={{ width: 40, height: 40 }}>
              <FiUsers size={18} />
            </div>
            Team Portal Management
          </h2>
          <p className="mt-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            {teams.length} teams registered • Each team gets a unique 6-digit
            access code
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => {
              setShowBulkUpload(!showBulkUpload);
              setShowAddForm(false);
            }}
            className="px-4 py-2.5 text-sm font-bold flex items-center gap-2 transition"
            style={{
              background: showBulkUpload ? "var(--accent-purple)" : "var(--bg-inset)",
              color: showBulkUpload ? "#000" : "var(--accent-purple)",
              border: "2px solid var(--accent-purple)",
              borderRadius: "var(--card-radius)",
            }}
          >
            <FiUpload size={14} />
            Bulk JSON
          </button>
          <button
            type="button"
            onClick={() => {
              setShowAddForm(!showAddForm);
              setShowBulkUpload(false);
            }}
            className="px-4 py-2.5 text-sm font-bold flex items-center gap-2 transition"
            style={{
              background: showAddForm ? "var(--accent-green)" : "var(--bg-inset)",
              color: showAddForm ? "#000" : "var(--accent-green)",
              border: "2px solid var(--accent-green)",
              borderRadius: "var(--card-radius)",
            }}
          >
            <FiPlus size={14} />
            Add Team
          </button>
        </div>
      </div>

      {/* Bulk Upload Panel */}
      {showBulkUpload && (
        <div
          className="t-card p-5 mb-6 animate-fade-in"
          style={{ borderColor: "var(--accent-purple)" }}
        >
          <h3
            className="text-sm font-bold mb-3"
            style={{ color: "var(--accent-purple)" }}
          >
            BULK JSON UPLOAD
          </h3>
          <p className="text-xs mb-3" style={{ color: "var(--text-muted)" }}>
            Paste a JSON array. Each object needs: teamName, leaderName,
            leaderEmail, participants: [{"{"} name, email {"}"}]
          </p>
          <textarea
            className="w-full t-input p-3 text-sm font-mono min-h-[150px] resize-y mb-3"
            placeholder={`[
  {
    "teamName": "Team Alpha",
    "leaderName": "John Doe",
    "leaderEmail": "john@example.com",
    "participants": [
      { "name": "Jane Smith", "email": "jane@example.com" },
      { "name": "Bob Wilson", "email": "bob@example.com" }
    ]
  }
]`}
            value={bulkJson}
            onChange={(e) => setBulkJson(e.target.value)}
          />
          <div className="flex gap-2 items-center flex-wrap">
            <button
              type="button"
              onClick={handleBulkUpload}
              className="px-4 py-2.5 text-sm font-bold text-black"
              style={{
                background: "var(--accent-purple)",
                borderRadius: "var(--card-radius)",
              }}
            >
              <FiUpload className="inline mr-2" />
              Upload JSON
            </button>
            <span className="text-xs font-bold uppercase mx-2" style={{ color: "var(--text-muted)" }}>OR</span>
            <label
              className="px-4 py-2.5 text-sm font-bold cursor-pointer transition hover:scale-105"
              style={{
                background: "var(--accent-cyan)",
                color: "#000",
                borderRadius: "var(--card-radius)",
              }}
            >
              <input 
                type="file" 
                accept=".csv" 
                className="hidden" 
                onChange={async (e) => {
                  const file = e.target.files?.[0];
                  if (!file) return;
                  const reader = new FileReader();
                  reader.onload = async (event) => {
                    const text = event.target?.result as string;
                    if (!text) return;
                    
                    const rows = text.split('\n').map(row => row.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))); // basic parse
                    const teamMap = new Map();
                    for (let i = 1; i < rows.length; i++) {
                      const row = rows[i];
                      if (!row || row.length < 5 || !row[0]) continue;
                      
                      const allottedRoom = row[1] || "";
                      const teamName = row[2] || "";
                      const leaderName = row[4] || "";
                      const leaderEmail = row[5] || "";
                      
                      if (!teamMap.has(teamName)) {
                        teamMap.set(teamName, { teamName, leaderName, leaderEmail, allottedRoom, participants: [] });
                      }
                      
                      const team = teamMap.get(teamName);
                      
                      for (let j = 6; j < row.length; j += 2) {
                        const pName = row[j];
                        const pEmail = row[j+1] || "";
                        if (pName) {
                          if (!team.participants.some((p: any) => p.email === pEmail && p.name === pName)) {
                            team.participants.push({ name: pName, email: pEmail });
                          }
                        }
                      }
                    }
                    const teamsToUpload = Array.from(teamMap.values());
                    
                    if (window.confirm(`Found ${teamsToUpload.length} teams in CSV. Upload now?`)) {
                      let count = 0;
                      for (const t of teamsToUpload) {
                        const code = generateCode();
                        await addDoc(collection(db, "teamPortal"), {
                          ...t,
                          teamCode: code,
                          allottedRoom: t.allottedRoom || "",
                          internetDetails: "",
                          problemStatementTitle: "",
                          problemStatementDescription: "",
                          additionalNotes: "",
                          createdAt: serverTimestamp(),
                        });
                        count++;
                      }
                      showNotification(`${count} teams uploaded successfully from CSV!`);
                      setShowBulkUpload(false);
                    }
                    e.target.value = '';
                  };
                  reader.readAsText(file);
                }}
              />
              <FiFileText className="inline mr-2" />
              Upload CSV File
            </label>
            <button
              type="button"
              onClick={() => setShowBulkUpload(false)}
              className="px-4 py-2.5 text-sm font-bold ml-auto"
              style={{
                color: "var(--text-secondary)",
                border: "1px solid var(--border-main)",
                borderRadius: "var(--card-radius)",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Add Single Team Form */}
      {showAddForm && (
        <form
          className="t-card p-5 mb-6 animate-fade-in"
          style={{ borderColor: "var(--accent-green)" }}
          onSubmit={handleAddTeam}
        >
          <h3
            className="text-sm font-bold mb-4"
            style={{ color: "var(--accent-green)" }}
          >
            REGISTER NEW TEAM
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input
              required
              placeholder="Team Name"
              value={form.teamName}
              onChange={(e) => setForm((p) => ({ ...p, teamName: e.target.value }))}
              className="w-full t-input p-3 text-sm"
            />
            <input
              required
              placeholder="Leader Name"
              value={form.leaderName}
              onChange={(e) => setForm((p) => ({ ...p, leaderName: e.target.value }))}
              className="w-full t-input p-3 text-sm"
            />
            <input
              required
              type="email"
              placeholder="Leader Email"
              value={form.leaderEmail}
              onChange={(e) => setForm((p) => ({ ...p, leaderEmail: e.target.value }))}
              className="w-full t-input p-3 text-sm sm:col-span-2"
            />
          </div>
          <textarea
            placeholder={`Participants (one per line):\nName1, email1@example.com\nName2, email2@example.com`}
            value={form.participantsRaw}
            onChange={(e) =>
              setForm((p) => ({ ...p, participantsRaw: e.target.value }))
            }
            className="w-full t-input p-3 text-sm min-h-[100px] resize-y mb-3 font-mono"
          />
          <div className="flex gap-2">
            <button
              type="submit"
              className="px-4 py-2.5 text-sm font-bold text-black"
              style={{
                background: "var(--accent-green)",
                borderRadius: "var(--card-radius)",
              }}
            >
              <FiPlus className="inline mr-2" />
              Register Team
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 py-2.5 text-sm font-bold"
              style={{
                color: "var(--text-secondary)",
                border: "1px solid var(--border-main)",
                borderRadius: "var(--card-radius)",
              }}
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Teams List */}
      <div className="space-y-3">
        {teams.length === 0 && (
          <div
            className="text-center py-16 t-inset"
            style={{ borderRadius: "var(--card-radius)" }}
          >
            <FiUsers
              size={40}
              className="mx-auto mb-3"
              style={{ color: "var(--text-muted)" }}
            />
            <p className="text-sm font-medium" style={{ color: "var(--text-muted)" }}>
              No teams registered yet. Add teams above.
            </p>
          </div>
        )}

        {teams.map((t) => {
          const isExpanded = expandedId === t.id;
          const isEditing = editingId === t.id;

          return (
            <div
              key={t.id}
              className="t-card transition-all"
              style={{
                borderColor: isExpanded ? "var(--accent-cyan)" : undefined,
              }}
            >
              {/* Collapsed Row */}
              <div
                className="p-4 flex items-center justify-between gap-3 cursor-pointer"
                onClick={() => setExpandedId(isExpanded ? null : t.id)}
              >
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    className="flex-shrink-0"
                    style={{ color: "var(--text-secondary)" }}
                  >
                    {isExpanded ? (
                      <FiChevronDown size={18} />
                    ) : (
                      <FiChevronRight size={18} />
                    )}
                  </button>
                  <div className="min-w-0 flex-1">
                    <p
                      className="font-bold truncate"
                      style={{ color: "var(--text-primary)" }}
                    >
                      {t.teamName}
                    </p>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-muted)" }}>
                      Leader: {t.leaderName} •{" "}
                      {(t.participants?.length || 0) + 1} members
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 flex-shrink-0">
                  {/* Code Badge */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      copyCode(t.teamCode, t.id);
                    }}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-mono font-bold tracking-widest transition"
                    style={{
                      background: "var(--accent-cyan-dim)",
                      color: "var(--accent-cyan)",
                      border: "2px solid var(--accent-cyan)",
                      borderRadius: "var(--card-radius)",
                    }}
                    title="Click to copy code"
                  >
                    {copiedId === t.id ? (
                      <FiCheck size={12} />
                    ) : (
                      <FiCopy size={12} />
                    )}
                    {t.teamCode}
                  </button>
                  {/* Status indicators */}
                  {t.allottedRoom && (
                    <span
                      className="hidden sm:flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase"
                      style={{
                        background: "var(--accent-green-dim)",
                        color: "var(--accent-green)",
                        borderRadius: "var(--card-radius)",
                      }}
                    >
                      <FiHome size={10} /> Room
                    </span>
                  )}
                  {t.problemStatementTitle && (
                    <span
                      className="hidden sm:flex items-center gap-1 px-2 py-1 text-[10px] font-bold uppercase"
                      style={{
                        background: "var(--accent-purple-dim)",
                        color: "var(--accent-purple)",
                        borderRadius: "var(--card-radius)",
                      }}
                    >
                      <FiFileText size={10} /> PS
                    </span>
                  )}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(t.id, t.teamName);
                    }}
                    className="grid place-items-center h-8 w-8 rounded-full transition flex-shrink-0"
                    style={{ color: "#ef4444" }}
                  >
                    <FiTrash2 size={14} />
                  </button>
                </div>
              </div>

              {/* Expanded Content */}
              {isExpanded && (
                <div
                  className="px-4 pb-4 animate-fade-in"
                  style={{ borderTop: "1px solid var(--border-main)" }}
                >
                  {/* Team members */}
                  <div className="mt-4 mb-4">
                    <p
                      className="text-xs font-bold uppercase mb-2"
                      style={{ color: "var(--text-muted)" }}
                    >
                      Members
                    </p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                      <div
                        className="flex items-center gap-2 px-3 py-2 text-sm"
                        style={{
                          background: "var(--accent-green-dim)",
                          border: "1px solid var(--accent-green)",
                          borderRadius: "var(--card-radius)",
                          color: "var(--accent-green)",
                        }}
                      >
                        <span className="font-bold">★</span>
                        <span className="truncate font-medium">{t.leaderName}</span>
                        <span
                          className="text-[10px] ml-auto opacity-70 truncate"
                        >
                          {t.leaderEmail}
                        </span>
                      </div>
                      {t.participants?.map((p, i) => (
                        <div
                          key={i}
                          className="flex items-center gap-2 px-3 py-2 text-sm"
                          style={{
                            background: "var(--bg-card)",
                            border: "1px solid var(--border-main)",
                            borderRadius: "var(--card-radius)",
                            color: "var(--text-primary)",
                          }}
                        >
                          <span
                            className="w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                            style={{
                              background: "var(--accent-cyan-dim)",
                              color: "var(--accent-cyan)",
                            }}
                          >
                            {p.name?.charAt(0)?.toUpperCase() || "?"}
                          </span>
                          <span className="truncate">{p.name}</span>
                          <span
                            className="text-[10px] ml-auto opacity-50 truncate"
                          >
                            {p.email}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Edit / View details */}
                  {isEditing ? (
                    <div
                      className="p-4 t-inset animate-fade-in"
                      style={{ borderRadius: "var(--card-radius)" }}
                    >
                      <p
                        className="text-xs font-bold uppercase mb-3"
                        style={{ color: "var(--accent-green)" }}
                      >
                        Edit Team Details
                      </p>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div>
                          <label
                            className="text-[10px] font-bold uppercase block mb-1"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <FiHome size={10} className="inline mr-1" />
                            Allotted Room
                          </label>
                          <input
                            value={editForm.allottedRoom}
                            onChange={(e) =>
                              setEditForm((p) => ({
                                ...p,
                                allottedRoom: e.target.value,
                              }))
                            }
                            placeholder="e.g. Room 201, Block A"
                            className="w-full t-input p-2.5 text-sm"
                          />
                        </div>
                        <div>
                          <label
                            className="text-[10px] font-bold uppercase block mb-1"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <FiFileText size={10} className="inline mr-1" />
                            Problem Statement Title
                          </label>
                          <input
                            value={editForm.problemStatementTitle}
                            onChange={(e) =>
                              setEditForm((p) => ({
                                ...p,
                                problemStatementTitle: e.target.value,
                              }))
                            }
                            placeholder="e.g. Smart Campus App"
                            className="w-full t-input p-2.5 text-sm"
                          />
                        </div>
                      </div>
                      <div className="mb-3">
                        <label
                          className="text-[10px] font-bold uppercase block mb-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <FiWifi size={10} className="inline mr-1" />
                          Internet / WiFi Details
                        </label>
                        <textarea
                          value={editForm.internetDetails}
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              internetDetails: e.target.value,
                            }))
                          }
                          placeholder={`SSID: HackathonWiFi\nPassword: hack2026\nPort: Ethernet-201`}
                          className="w-full t-input p-2.5 text-sm min-h-[80px] resize-y font-mono"
                        />
                      </div>
                      <div className="mb-3">
                        <label
                          className="text-[10px] font-bold uppercase block mb-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <FiFileText size={10} className="inline mr-1" />
                          Problem Statement Description
                        </label>
                        <textarea
                          value={editForm.problemStatementDescription}
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              problemStatementDescription: e.target.value,
                            }))
                          }
                          placeholder="Full description of the problem statement..."
                          className="w-full t-input p-2.5 text-sm min-h-[80px] resize-y"
                        />
                      </div>
                      <div className="mb-4">
                        <label
                          className="text-[10px] font-bold uppercase block mb-1"
                          style={{ color: "var(--text-muted)" }}
                        >
                          <FiInfo size={10} className="inline mr-1" />
                          Additional Notes
                        </label>
                        <textarea
                          value={editForm.additionalNotes}
                          onChange={(e) =>
                            setEditForm((p) => ({
                              ...p,
                              additionalNotes: e.target.value,
                            }))
                          }
                          placeholder="Any extra info for this team..."
                          className="w-full t-input p-2.5 text-sm min-h-[60px] resize-y"
                        />
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(t.id)}
                          className="px-4 py-2 text-sm font-bold text-black"
                          style={{
                            background: "var(--accent-green)",
                            borderRadius: "var(--card-radius)",
                          }}
                        >
                          <FiCheck className="inline mr-1" />
                          Save
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingId(null)}
                          className="px-4 py-2 text-sm font-bold"
                          style={{
                            color: "var(--text-secondary)",
                            border: "1px solid var(--border-main)",
                            borderRadius: "var(--card-radius)",
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div>
                      {/* Current details display */}
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                        <div
                          className="p-3"
                          style={{
                            background: "var(--bg-inset)",
                            border: "1px solid var(--border-main)",
                            borderRadius: "var(--card-radius)",
                          }}
                        >
                          <p
                            className="text-[10px] font-bold uppercase mb-1 flex items-center gap-1"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <FiHome size={10} /> Room
                          </p>
                          <p
                            className="text-sm font-medium"
                            style={{
                              color: t.allottedRoom
                                ? "var(--text-primary)"
                                : "var(--text-muted)",
                            }}
                          >
                            {t.allottedRoom || "Not assigned"}
                          </p>
                        </div>
                        <div
                          className="p-3"
                          style={{
                            background: "var(--bg-inset)",
                            border: "1px solid var(--border-main)",
                            borderRadius: "var(--card-radius)",
                          }}
                        >
                          <p
                            className="text-[10px] font-bold uppercase mb-1 flex items-center gap-1"
                            style={{ color: "var(--text-muted)" }}
                          >
                            <FiFileText size={10} /> Problem Statement
                          </p>
                          <p
                            className="text-sm font-medium"
                            style={{
                              color: t.problemStatementTitle
                                ? "var(--text-primary)"
                                : "var(--text-muted)",
                            }}
                          >
                            {t.problemStatementTitle || "Not assigned"}
                          </p>
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          startEdit(t);
                        }}
                        className="px-4 py-2 text-sm font-bold flex items-center gap-2 transition"
                        style={{
                          color: "var(--accent-cyan)",
                          border: "1px solid var(--accent-cyan)",
                          borderRadius: "var(--card-radius)",
                        }}
                      >
                        <FiEdit3 size={14} />
                        Edit Details
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
