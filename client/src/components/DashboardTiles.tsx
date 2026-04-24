import { memo, useState, useEffect, useCallback, useRef } from "react";
import { addDoc, collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, limit } from "firebase/firestore";
import { db } from "../firebase";
import {
  FiLink, FiFileText, FiHelpCircle, FiStar, FiZap,
  FiPackage, FiAlertTriangle, FiThumbsUp, FiExternalLink,
  FiSend, FiBook, FiCode, FiTool, FiChevronRight, FiMessageCircle,
} from "react-icons/fi";
import type {
  QuickLink, ProblemStatement, HelpRequest,
  IdeaPrompt, VotePoll, ResourceItem,
  Team,
} from "../types";

// ============ QUICK LINKS TILE ============
export const QuickLinksTile = memo(function QuickLinksTile() {
  const [links, setLinks] = useState<QuickLink[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "quickLinks"), orderBy("timestamp", "desc")),
      (snap) => setLinks(snap.docs.map(d => ({ id: d.id, ...d.data() } as QuickLink))),
      () => {}
    );
    return () => unsub();
  }, []);

  return (
    <article className="t-card p-5 h-full flex flex-col">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
        <div className="icon-circle icon-circle-cyan" style={{ width: 28, height: 28 }}>
          <FiLink size={13} />
        </div>
        Quick Links
      </h2>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {links.map(link => (
          <a
            key={link.id}
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 p-3 t-inset transition-all hover:border-[var(--accent-cyan)] group"
            style={{ borderRadius: 'var(--card-radius)' }}
          >
            <FiExternalLink size={14} style={{ color: 'var(--accent-cyan)' }} className="flex-shrink-0 group-hover:translate-x-0.5 transition-transform" />
            <span className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{link.name}</span>
          </a>
        ))}
        {links.length === 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No links added yet. Admin can add links from controls.</p>}
      </div>
    </article>
  );
});

// ============ PROBLEM STATEMENTS TILE ============
export const ProblemStatementsTile = memo(function ProblemStatementsTile() {
  const [statements, setStatements] = useState<ProblemStatement[]>([]);
  const [selected, setSelected] = useState<ProblemStatement | null>(null);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "problemStatements"), orderBy("timestamp", "desc")),
      (snap) => setStatements(snap.docs.map(d => ({ id: d.id, ...d.data() } as ProblemStatement))),
      () => {}
    );
    return () => unsub();
  }, []);

  const difficultyColors: Record<string, string> = {
    easy: 'var(--accent-green)',
    medium: 'var(--accent-orange)',
    hard: 'var(--accent-pink)',
  };

  return (
    <article className="t-card p-5 h-full flex flex-col relative">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
        <div className="icon-circle icon-circle-purple" style={{ width: 28, height: 28 }}>
          <FiFileText size={13} />
        </div>
        Problem Statements
      </h2>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {statements.map(ps => (
          <button
            key={ps.id}
            type="button"
            onClick={() => setSelected(ps)}
            className="w-full text-left p-3 t-inset transition-all hover:border-[var(--accent-purple)] flex items-center justify-between gap-2"
            style={{ borderRadius: 'var(--card-radius)' }}
          >
            <div className="min-w-0 flex-1">
              <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>{ps.title}</p>
              {ps.track && <p className="text-[10px] uppercase tracking-wider mt-0.5" style={{ color: 'var(--text-muted)' }}>{ps.track}</p>}
            </div>
            <span className="px-2 py-0.5 text-[10px] font-black uppercase flex-shrink-0" style={{ color: difficultyColors[ps.difficulty] || 'var(--text-muted)', background: 'var(--bg-card)', border: `1px solid ${difficultyColors[ps.difficulty] || 'var(--border-main)'}` }}>{ps.difficulty}</span>
          </button>
        ))}
        {statements.length === 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No problem statements posted yet.</p>}
      </div>

      {/* Detail Modal */}
      {selected && (
        <div className="fixed inset-0 z-[99999] flex items-center justify-center p-3 sm:p-4 backdrop-blur-md" style={{ background: 'rgba(0,0,0,0.85)' }} onClick={() => setSelected(null)}>
          <div className="max-w-lg w-full max-h-[88vh] overflow-y-auto p-4 sm:p-8 border-[6px] border-white shadow-[12px_12px_0px_var(--accent-purple)]" style={{ background: 'var(--bg-card)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-start justify-between gap-4 mb-4">
              <h3 className="text-lg sm:text-xl font-black uppercase tracking-tighter" style={{ color: 'var(--text-primary)' }}>{selected.title}</h3>
              <span className="px-2 py-1 text-[10px] font-black uppercase flex-shrink-0" style={{ color: difficultyColors[selected.difficulty], border: `2px solid ${difficultyColors[selected.difficulty]}` }}>{selected.difficulty}</span>
            </div>
            {selected.track && <p className="text-xs uppercase tracking-wider mb-4" style={{ color: 'var(--accent-purple)' }}>Track: {selected.track}</p>}
            <p className="text-sm leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{selected.description}</p>
            <button onClick={() => setSelected(null)} className="mt-6 w-full py-3 font-black uppercase tracking-widest text-black" style={{ background: 'var(--accent-purple)' }}>Close</button>
          </div>
        </div>
      )}
    </article>
  );
});

// ============ QUICK HELP TILE ============
export const QuickHelpTile = memo(function QuickHelpTile() {
  const [message, setMessage] = useState("");
  const [sent, setSent] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    await addDoc(collection(db, "helpRequests"), {
      teamName: "Anonymous",
      message: message.trim(),
      status: "open",
      timestamp: serverTimestamp(),
    });
    setMessage("");
    setSent(true);
    alert("Help request sent to administrators!");
    setTimeout(() => setSent(false), 3000);
  };

  return (
    <article className="t-card p-5 h-full flex flex-col">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
        <div className="icon-circle icon-circle-orange" style={{ width: 28, height: 28 }}>
          <FiHelpCircle size={13} />
        </div>
        Quick Help
      </h2>
      <div className="flex-1 flex flex-col justify-center">
        <textarea
          value={message}
          onChange={e => setMessage(e.target.value)}
          placeholder="Describe your issue or question..."
          className="w-full t-input p-3 text-sm resize-none h-24 mb-3"
          maxLength={300}
        />
        <button
          onClick={handleSend}
          disabled={!message.trim() || sent}
          className="w-full py-3 font-bold text-sm uppercase tracking-widest text-black transition-all disabled:opacity-50"
          style={{ background: sent ? 'var(--accent-green)' : 'var(--accent-orange)', borderRadius: 'var(--card-radius)' }}
        >
          <FiSend className="inline mr-2" size={14} />
          {sent ? "Sent! ✓" : "Send to Organizers"}
        </button>
      </div>
    </article>
  );
});

// ============ TEAM SPOTLIGHT TILE ============
export const TeamSpotlightTile = memo(function TeamSpotlightTile({ teams }: { teams: Team[] }) {
  const [spotlightIdx, setSpotlightIdx] = useState(0);

  useEffect(() => {
    if (teams.length <= 1) return;
    const interval = setInterval(() => {
      setSpotlightIdx(prev => (prev + 1) % teams.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [teams.length]);

  const team = teams[spotlightIdx];

  if (!team) {
    return (
      <article className="t-card p-5 h-full flex items-center justify-center">
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No teams to spotlight</p>
      </article>
    );
  }

  return (
    <article className="t-card p-5 h-full flex flex-col relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl" style={{ background: 'var(--accent-green-dim)' }} />
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4 z-10" style={{ color: 'var(--text-secondary)' }}>
        <div className="icon-circle icon-circle-green" style={{ width: 28, height: 28 }}>
          <FiStar size={13} />
        </div>
        Team Spotlight
      </h2>
      <div className="flex-1 flex flex-col justify-center z-10 animate-fade-in" key={team.id}>
        <p className="text-2xl font-black mb-2" style={{ color: 'var(--accent-green)' }}>{team.name}</p>
        <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>{team.department} • {team.members?.length || 0} members</p>
        <div className="flex items-center gap-4">
          <div className="px-3 py-1 text-sm font-black" style={{ background: 'var(--accent-green-dim)', color: 'var(--accent-green)', border: '1px solid var(--accent-green)' }}>
            {team.score} PTS
          </div>
          <span className="px-2 py-1 text-[10px] font-bold uppercase" style={{ background: 'var(--accent-blue-dim)', color: 'var(--accent-blue)' }}>{team.status}</span>
        </div>
        {team.projectDescription && (
          <p className="mt-3 text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>{team.projectDescription}</p>
        )}
      </div>
      <p className="text-[10px] text-right mt-2" style={{ color: 'var(--text-muted)' }}>{spotlightIdx + 1} / {teams.length}</p>
    </article>
  );
});

// ============ IDEA BOARD TILE ============
export const IdeaBoardTile = memo(function IdeaBoardTile() {
  const [prompts, setPrompts] = useState<IdeaPrompt[]>([]);
  const [currentIdx, setCurrentIdx] = useState(0);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "ideaBoard"), orderBy("timestamp", "desc"), limit(20)),
      (snap) => setPrompts(snap.docs.map(d => ({ id: d.id, ...d.data() } as IdeaPrompt))),
      () => {}
    );
    return () => unsub();
  }, []);

  useEffect(() => {
    if (prompts.length <= 1) return;
    const interval = setInterval(() => setCurrentIdx(p => (p + 1) % prompts.length), 6000);
    return () => clearInterval(interval);
  }, [prompts.length]);

  const current = prompts[currentIdx];

  return (
    <article className="t-card p-5 h-full flex flex-col">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
        <div className="icon-circle icon-circle-purple" style={{ width: 28, height: 28 }}>
          <FiZap size={13} />
        </div>
        Idea Board
      </h2>
      <div className="flex-1 flex flex-col items-center justify-center text-center px-1">
        {current ? (
          <div className="animate-fade-in" key={current.id}>
            <p className="text-4xl sm:text-5xl mb-4">💡</p>
            <p className="text-base sm:text-lg font-bold leading-snug break-words" style={{ color: 'var(--text-primary)' }}>"{current.prompt}"</p>
            {current.category && <p className="mt-3 text-[10px] uppercase tracking-widest" style={{ color: 'var(--accent-purple)' }}>{current.category}</p>}
          </div>
        ) : (
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No prompts added yet</p>
        )}
      </div>
    </article>
  );
});

// ============ RESOURCE HUB TILE ============
export const ResourceHubTile = memo(function ResourceHubTile() {
  const [resources, setResources] = useState<ResourceItem[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      collection(db, "resources"),
      (snap) => setResources(snap.docs.map(d => ({ id: d.id, ...d.data() } as ResourceItem))),
      () => {}
    );
    return () => unsub();
  }, []);

  const categoryIcons: Record<string, typeof FiCode> = {
    api: FiCode,
    docs: FiBook,
    tool: FiTool,
    template: FiPackage,
  };

  return (
    <article className="t-card p-5 h-full flex flex-col">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
        <div className="icon-circle icon-circle-blue" style={{ width: 28, height: 28 }}>
          <FiPackage size={13} />
        </div>
        Resource Hub
      </h2>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {resources.map(r => {
          const IconComp = categoryIcons[r.category] || FiExternalLink;
          return (
            <a
              key={r.id}
              href={r.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 p-3 t-inset transition-all hover:border-[var(--accent-blue)] group"
              style={{ borderRadius: 'var(--card-radius)' }}
            >
              <IconComp size={14} style={{ color: 'var(--accent-blue)' }} className="flex-shrink-0" />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium truncate" style={{ color: 'var(--text-primary)' }}>{r.name}</p>
                {r.description && <p className="text-[10px] truncate" style={{ color: 'var(--text-muted)' }}>{r.description}</p>}
              </div>
              <span className="px-1.5 py-0.5 text-[9px] font-bold uppercase" style={{ color: 'var(--accent-blue)', background: 'var(--accent-blue-dim)' }}>{r.category}</span>
            </a>
          );
        })}
        {resources.length === 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No resources added yet.</p>}
      </div>
    </article>
  );
});

// ============ HELP REQUESTS FEED TILE ============
export const HelpRequestsFeedTile = memo(function HelpRequestsFeedTile({ isAdmin }: { isAdmin: boolean }) {
  const [requests, setRequests] = useState<HelpRequest[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "helpRequests"), orderBy("timestamp", "desc"), limit(20)),
      (snap) => setRequests(snap.docs.map(d => ({ id: d.id, ...d.data() } as HelpRequest))),
      () => {}
    );
    return () => unsub();
  }, []);

  const handleResolve = async (id: string) => {
    await updateDoc(doc(db, "helpRequests", id), { status: "resolved" });
  };

  return (
    <article className="t-card p-5 h-full flex flex-col">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
        <div className="icon-circle icon-circle-orange" style={{ width: 28, height: 28 }}>
          <FiAlertTriangle size={13} />
        </div>
        Help Requests
        {requests.filter(r => r.status === "open").length > 0 && (
          <span className="ml-auto px-2 py-0.5 text-[10px] font-black bg-red-500 text-white animate-pulse">{requests.filter(r => r.status === "open").length}</span>
        )}
      </h2>
      <div className="flex-1 space-y-2 overflow-y-auto">
        {requests.map(req => (
          <div key={req.id} className="t-inset p-3 flex items-start gap-3" style={{ borderRadius: 'var(--card-radius)', borderLeft: `3px solid ${req.status === "open" ? '#ff6600' : 'var(--accent-green)'}` }}>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-[10px] font-bold uppercase" style={{ color: req.status === "open" ? '#ff6600' : 'var(--accent-green)' }}>{req.status}</p>
                <p className="text-[10px]" style={{ color: 'var(--text-muted)' }}>{req.teamName}</p>
              </div>
              <p className="text-sm" style={{ color: 'var(--text-primary)' }}>{req.message}</p>
            </div>
            {isAdmin && req.status === "open" && (
              <button
                onClick={() => handleResolve(req.id)}
                className="px-2 py-1 text-[10px] font-bold uppercase flex-shrink-0 transition-all hover:bg-[var(--accent-green)] hover:text-black"
                style={{ color: 'var(--accent-green)', border: '1px solid var(--accent-green)' }}
              >
                ✓
              </button>
            )}
          </div>
        ))}
        {requests.length === 0 && <p className="text-xs" style={{ color: 'var(--text-muted)' }}>No help requests yet.</p>}
      </div>
    </article>
  );
});

// ============ AUDIENCE VOTING TILE ============
export const AudienceVotingTile = memo(function AudienceVotingTile({ isAdmin }: { isAdmin: boolean }) {
  const [polls, setPolls] = useState<VotePoll[]>([]);

  useEffect(() => {
    const unsub = onSnapshot(
      query(collection(db, "votes"), orderBy("timestamp", "desc"), limit(5)),
      (snap) => setPolls(snap.docs.map(d => ({ id: d.id, ...d.data() } as VotePoll))),
      () => {}
    );
    return () => unsub();
  }, []);

  const activePoll = polls.find(p => p.isActive);

  const handleVote = async (pollId: string, optionIndex: number) => {
    const poll = polls.find(p => p.id === pollId);
    if (!poll) return;
    const updatedOptions = poll.options.map((opt, i) => i === optionIndex ? { ...opt, votes: opt.votes + 1 } : opt);
    await updateDoc(doc(db, "votes", pollId), { options: updatedOptions });
    alert(`Vote for "${poll.options[optionIndex].label}" recorded!`);
  };

  if (!activePoll) {
    return (
      <article className="t-card p-5 h-full flex flex-col items-center justify-center">
        <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-4" style={{ color: 'var(--text-secondary)' }}>
          <FiThumbsUp size={14} style={{ color: 'var(--accent-pink)' }} /> Audience Voting
        </h2>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>No active polls right now</p>
      </article>
    );
  }

  const totalVotes = activePoll.options.reduce((sum, o) => sum + o.votes, 0);
  const voteColors = ['var(--accent-green)', 'var(--accent-purple)', 'var(--accent-blue)', 'var(--accent-orange)', 'var(--accent-pink)'];

  return (
    <article className="t-card p-5 h-full flex flex-col">
      <h2 className="flex items-center gap-2 text-sm font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-secondary)' }}>
        <div className="icon-circle icon-circle-pink" style={{ width: 28, height: 28 }}>
          <FiThumbsUp size={13} />
        </div>
        Live Vote
      </h2>
      <p className="text-sm sm:text-base font-bold mb-4 break-words" style={{ color: 'var(--text-primary)' }}>{activePoll.question}</p>
      <div className="flex-1 space-y-3">
        {activePoll.options.map((opt, i) => {
          const pct = totalVotes > 0 ? Math.round((opt.votes / totalVotes) * 100) : 0;
          return (
            <button
              key={i}
              onClick={() => handleVote(activePoll.id, i)}
              className="w-full text-left p-3 t-inset transition-all hover:border-[var(--accent-pink)]"
              style={{ borderRadius: 'var(--card-radius)' }}
            >
              <div className="flex justify-between items-center mb-1">
                <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{opt.label}</span>
                <span className="text-xs font-bold" style={{ color: voteColors[i % voteColors.length] }}>{pct}%</span>
              </div>
              <div className="vote-bar">
                <div className="vote-bar-fill" style={{ width: `${pct}%`, background: voteColors[i % voteColors.length] }} />
              </div>
              <p className="text-[10px] mt-1" style={{ color: 'var(--text-muted)' }}>{opt.votes} votes</p>
            </button>
          );
        })}
      </div>
      <p className="text-[10px] mt-2 text-right" style={{ color: 'var(--text-muted)' }}>Total: {totalVotes} votes</p>
    </article>
  );
});
