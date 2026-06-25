import React, { useState, useEffect } from 'react';
import {
  Home, FileWarning, BookOpen, MessageSquare, Plane, Plus, Trash2,
  Send, Loader2, AlertTriangle, ChevronDown, ChevronUp, ExternalLink,
  Camera,
} from 'lucide-react';
import storage from './storage.js';

const DISPLAY = { fontFamily: "'Oswald', sans-serif" };
const MONO = { fontFamily: "'JetBrains Mono', monospace" };

const AC1B_URL = 'https://www.faa.gov/documentLibrary/media/Advisory_Circular/43.13-1B.pdf';
const AC2B_URL = 'https://www.faa.gov/documentlibrary/media/advisory_circular/ac%2043.13-2b.pdf';
const DRS_URL = 'https://drs.faa.gov/browse';
const PART43_URL = 'https://www.ecfr.gov/current/title-14/chapter-I/subchapter-C/part-43';

const TABS = [
  { id: 'overview', label: 'Overview', icon: Home },
  { id: 'ads', label: 'AD Tracker', icon: FileWarning },
  { id: 'library', label: 'AC 43.13', icon: BookOpen },
  { id: 'photos', label: 'Manual Photos', icon: Camera },
  { id: 'assistant', label: 'Ask Assistant', icon: MessageSquare },
];

const CHAPTERS = [
  { num: 1, title: 'Wood Structure', desc: 'Inspection and repair practices for wood airframe components.' },
  { num: 2, title: 'Fabric Covering', desc: 'Inspecting, repairing, and recovering fabric-covered surfaces.' },
  { num: 3, title: 'Fiberglass & Plastics', desc: 'Composite structures, fairings, and transparencies (windows, canopies).' },
  { num: 4, title: 'Metal Structure, Welding & Brazing', desc: 'Sheet metal repair techniques, welding, and brazing standards.' },
  { num: 5, title: 'Nondestructive Inspection (NDI)', desc: 'Dye penetrant, magnetic particle, eddy current, and other NDI methods.' },
  { num: 6, title: 'Corrosion: Inspection & Protection', desc: 'Identifying, treating, and preventing corrosion on airframe structure.' },
  { num: 7, title: 'Hardware, Control Cables & Turnbuckles', desc: 'Fasteners, cable tension, rigging, and general hardware practices.' },
  { num: 8, title: 'Engines, Fuel, Exhaust & Propellers', desc: 'General powerplant inspection and minor repair guidance.' },
  { num: 9, title: 'Aircraft Systems & Components', desc: 'Hydraulic, landing gear, and environmental system basics.' },
  { num: 10, title: 'Weight & Balance', desc: 'Computing and documenting weight and balance after alterations.' },
  { num: 11, title: 'Aircraft Electrical Systems', desc: 'Wiring, batteries, generators/alternators, and circuit protection.', expandable: true },
  { num: 12, title: 'Aircraft Avionics Systems', desc: 'General avionics installation and inspection guidance.' },
  { num: 13, title: 'Human Factors', desc: 'Error-reduction practices for maintenance work.' },
];

const CH11_SECTIONS = [
  { sec: 1, title: 'Inspection & Care of Electrical Systems', note: 'General visual inspection: cleanliness, security, corrosion, and wear on electrical equipment and connections.' },
  { sec: 2, title: 'Storage Batteries', note: 'Battery types (lead-acid, NiCad), electrolyte servicing, and ventilation requirements.' },
  { sec: 3, title: 'Inspection of Equipment Installation', note: 'Covers generators, alternators, static inverters/converters, and electrical load monitoring.' },
  { sec: 4, title: 'Circuit-Protection Devices', note: 'Breaker and fuse rating checks and replacement guidance.' },
  { sec: 8, title: 'Wiring', note: 'Wire gauge selection, routing, bundling, clamping, and splicing practices.' },
  { sec: 18, title: 'Conduits', note: 'Conduit sizing, fittings, and installation practices.' },
  { sec: 19, title: 'Protection of Unused Connectors', note: 'Sealing and protecting open connector cavities.' },
  { sec: 20, title: 'Electrical & Electronic Symbols', note: 'Standard schematic symbol reference.' },
];

const GENERAL_SYSTEM_PROMPT = `You are a reference assistant for A&P/IA aircraft mechanics, built around general practices from FAA Advisory Circular 43.13-1B/-2B and 14 CFR Part 43/65.

Rules:
- You are not a substitute for the aircraft, engine, propeller, or component manufacturer's maintenance manual or Instructions for Continued Airworthiness (ICA). Per 14 CFR 43.13(a), those are the primary approved data and must be consulted for any actual repair.
- Never state specific torque values, part numbers, wire gauges, AD numbers, or step-by-step teardown/reassembly procedures for a specific aircraft or component unless the user has provided that information to you directly in this conversation. If asked for these, say plainly that they must come from the manufacturer's manual/IPC or FAA DRS, and explain generally what kind of document would contain that information.
- You can discuss general inspection concepts, troubleshooting logic, terminology, and what AC 43.13 chapters/sections generally cover.
- Keep answers practical and concise. End any answer that touches on inspection or repair with a short reminder to verify against approved data and sign off per Part 43.`;

function buildManualSystemPrompt(manualText, hasPhoto) {
  const sources = [];
  if (manualText.trim()) sources.push("pasted text from their aircraft or component maintenance manual / Instructions for Continued Airworthiness (ICA)");
  if (hasPhoto) sources.push('a photo of a page from their aircraft or component maintenance manual / ICA, taken on the job');
  const sourceLine = sources.length ? sources.join(' and ') : 'their own maintenance manual material';

  return `The user has provided ${sourceLine}. Answer the user's questions using ONLY this material - nothing from general knowledge.

Rules:
- If the answer isn't contained in what's provided, say so plainly and suggest which section of the manual they might check instead - do not fill gaps with guesswork.
- If a photo is blurry, cropped, or a detail isn't legible, say so rather than guessing at a number, value, or part name.
- Answer the specific question asked. Do not transcribe or reproduce the full page verbatim - quote only the short, specific phrase, value, or part number directly relevant to the question.
- If the material includes section, page, step, or figure references, cite them in your answer.
${manualText.trim() ? `\n--- PASTED MANUAL TEXT ---\n${manualText}\n--- END PASTED TEXT ---` : ''}`;
}

const GENERAL_STARTERS = [
  "What should I check if a DC generator isn't charging?",
  'What does AC 43.13 Chapter 11 generally cover?',
  'Where would I find the correct torque value for a part?',
];

const MANUAL_STARTERS = [
  'Summarize the inspection steps in this text',
  'What limits or values are listed here?',
  'What tools or part numbers are mentioned?',
  'What does this diagram show?',
];

// Calls our own Netlify serverless function, which holds the real Anthropic
// API key server-side and forwards the request to api.anthropic.com.
async function askClaude(systemPrompt, messages) {
  const res = await fetch('/.netlify/functions/chat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ system: systemPrompt, messages }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || 'Request failed');
  }
  const data = await res.json();
  return (data.content || [])
    .map((b) => (b.type === 'text' ? b.text : ''))
    .join('\n')
    .trim();
}

function resizeImageFile(file, maxDim = 1280, quality = 0.75) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Could not read file'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('Could not load image'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          const scale = maxDim / Math.max(width, height);
          width = Math.round(width * scale);
          height = Math.round(height * scale);
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function toWireMessages(history, photo) {
  return history.map((m) => {
    if (m.role === 'user' && photo) {
      const base64 = photo.dataUrl.split(',')[1];
      return {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: base64 } },
          { type: 'text', text: m.content },
        ],
      };
    }
    return { role: m.role, content: m.content };
  });
}

function Plate({ children, className = '' }) {
  return (
    <div className={`relative border border-neutral-600 bg-neutral-900 rounded-sm px-5 py-4 ${className}`}>
      <span className="absolute top-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-neutral-600" />
      <span className="absolute top-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-neutral-600" />
      <span className="absolute bottom-1.5 left-1.5 w-1.5 h-1.5 rounded-full bg-neutral-600" />
      <span className="absolute bottom-1.5 right-1.5 w-1.5 h-1.5 rounded-full bg-neutral-600" />
      {children}
    </div>
  );
}

function RefLink({ href, title, desc }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      className="block border border-neutral-600 bg-neutral-900 rounded-sm px-4 py-3 hover:border-blue-400 transition-colors"
    >
      <div className="flex items-center justify-between gap-2">
        <span className="font-medium text-sm" style={MONO}>{title}</span>
        <ExternalLink className="w-3.5 h-3.5 text-neutral-500 flex-shrink-0" />
      </div>
      <p className="text-xs text-neutral-400 mt-1">{desc}</p>
    </a>
  );
}

function StatusBadge({ status }) {
  const map = {
    open: { label: 'OPEN', cls: 'bg-orange-500/15 text-orange-300 border-orange-500/40' },
    complied: { label: 'COMPLIED', cls: 'bg-blue-500/15 text-blue-300 border-blue-500/40' },
    na: { label: 'N/A', cls: 'bg-neutral-800 text-neutral-300 border-neutral-600' },
  };
  const s = map[status] || map.open;
  return (
    <span className={`text-xs border rounded-full px-2 py-0.5 ${s.cls}`} style={MONO}>
      {s.label}
    </span>
  );
}

export default function App() {
  const [activeTab, setActiveTab] = useState('overview');
  const [aircraft, setAircraft] = useState({ make: '', model: '', tail: '' });
  const [adLog, setAdLog] = useState([]);
  const [adDraft, setAdDraft] = useState({ adNumber: '', appliesTo: '', subject: '', status: 'open' });
  const [expandedChapter, setExpandedChapter] = useState(null);

  const [mode, setMode] = useState('general');
  const [manualText, setManualText] = useState('');
  const [chatGeneral, setChatGeneral] = useState([]);
  const [chatManual, setChatManual] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [chatError, setChatError] = useState(null);

  const [photos, setPhotos] = useState([]);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoError, setPhotoError] = useState(null);
  const [selectedPhotoId, setSelectedPhotoId] = useState(null);

  useEffect(() => {
    (async () => {
      try {
        const a = await storage.get('davis-thinks-aircraft');
        if (a) setAircraft(JSON.parse(a.value));
      } catch (e) {}
      try {
        const l = await storage.get('davis-thinks-ad-log');
        if (l) setAdLog(JSON.parse(l.value));
      } catch (e) {}
      try {
        const p = await storage.get('davis-thinks-manual-photos');
        if (p) setPhotos(JSON.parse(p.value));
      } catch (e) {}
    })();
  }, []);

  const updateAircraft = (next) => {
    setAircraft(next);
    (async () => {
      try {
        await storage.set('davis-thinks-aircraft', JSON.stringify(next));
      } catch (e) {}
    })();
  };

  const saveAdLog = (next) => {
    setAdLog(next);
    (async () => {
      try {
        await storage.set('davis-thinks-ad-log', JSON.stringify(next));
      } catch (e) {}
    })();
  };

  const addAdEntry = () => {
    if (!adDraft.adNumber.trim()) return;
    const entry = { id: Date.now().toString(), ...adDraft };
    saveAdLog([entry, ...adLog]);
    setAdDraft({ adNumber: '', appliesTo: '', subject: '', status: 'open' });
  };

  const removeAdEntry = (id) => {
    saveAdLog(adLog.filter((e) => e.id !== id));
  };

  const savePhotos = (next) => {
    setPhotos(next);
    (async () => {
      try {
        await storage.set('davis-thinks-manual-photos', JSON.stringify(next));
      } catch (e) {}
    })();
  };

  const handlePhotoUpload = async (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = '';
    if (!file) return;
    setPhotoError(null);
    setPhotoUploading(true);
    try {
      const dataUrl = await resizeImageFile(file);
      const entry = {
        id: Date.now().toString(),
        label: `Manual page ${photos.length + 1}`,
        dataUrl,
        addedAt: new Date().toISOString(),
      };
      const next = [entry, ...photos];
      await storage.set('davis-thinks-manual-photos', JSON.stringify(next));
      setPhotos(next);
      setSelectedPhotoId(entry.id);
    } catch (err) {
      setPhotoError("Couldn't save that photo — try a smaller image or a different file.");
    } finally {
      setPhotoUploading(false);
    }
  };

  const removePhoto = (id) => {
    savePhotos(photos.filter((p) => p.id !== id));
    if (selectedPhotoId === id) setSelectedPhotoId(null);
  };

  const updatePhotoLabel = (id, label) => {
    savePhotos(photos.map((p) => (p.id === id ? { ...p, label } : p)));
  };

  const currentChat = mode === 'general' ? chatGeneral : chatManual;
  const starters = mode === 'general' ? GENERAL_STARTERS : MANUAL_STARTERS;
  const selectedPhoto = photos.find((p) => p.id === selectedPhotoId) || null;
  const manualReady = manualText.trim().length > 0 || !!selectedPhoto;

  const handleSend = async () => {
    if (!chatInput.trim() || chatLoading) return;
    if (mode === 'manual' && !manualReady) return;
    const userMsg = { role: 'user', content: chatInput.trim() };
    const history = currentChat;
    const newHistory = [...history, userMsg];
    if (mode === 'general') setChatGeneral(newHistory);
    else setChatManual(newHistory);
    setChatInput('');
    setChatLoading(true);
    setChatError(null);
    try {
      const sys = mode === 'general' ? GENERAL_SYSTEM_PROMPT : buildManualSystemPrompt(manualText, !!selectedPhoto);
      const wireHistory = mode === 'manual' ? toWireMessages(newHistory, selectedPhoto) : newHistory;
      const reply = await askClaude(sys, wireHistory);
      const finalHistory = [...newHistory, { role: 'assistant', content: reply || "I couldn't generate a response - try rephrasing." }];
      if (mode === 'general') setChatGeneral(finalHistory);
      else setChatManual(finalHistory);
    } catch (e) {
      setChatError("Couldn't reach the assistant. Check your connection and try again.");
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-neutral-50">
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute inset-0 bg-gradient-to-b from-black via-blue-950 to-black" />
        <div className="absolute -top-20 -right-16 w-72 h-72 rounded-full bg-orange-500/25 blur-3xl" />
        <div className="absolute top-1/3 -left-24 w-80 h-80 rounded-full bg-blue-600/25 blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-64 h-64 rounded-full bg-orange-600/15 blur-3xl" />
      </div>

      <div className="bg-black text-white">
        <div className="max-w-4xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-2">
            <Plane className="w-5 h-5 text-orange-500" />
            <span className="text-xl tracking-wider" style={DISPLAY}><span style={{ color: '#4169E1' }}>DAVIS</span> <span className="text-orange-500">THINKS</span></span>
          </div>
          <div className="text-xs text-blue-300 flex gap-4 flex-wrap" style={MONO}>
            <span>TYPE — FIELD REFERENCE</span>
            <span>BASIS — 14 CFR PART 43</span>
          </div>
        </div>
      </div>

      <div className="bg-orange-500/10 border-b border-orange-500/30 text-orange-300 text-sm">
        <div className="max-w-4xl mx-auto px-4 py-2 flex items-start gap-2">
          <AlertTriangle className="w-4 h-4 mt-0.5 flex-shrink-0" />
          <p>Reference only — not approved maintenance data. All maintenance must be performed using data acceptable under 14 CFR 43.13 and signed off per Part 43.</p>
        </div>
      </div>

      <div className="bg-neutral-900 border-b border-neutral-700 sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 flex gap-1 overflow-x-auto">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`flex items-center gap-2 px-3 py-3 text-sm whitespace-nowrap border-b-2 transition-colors ${
                  active ? 'border-blue-600 text-neutral-50 font-medium' : 'border-transparent text-neutral-400 hover:text-neutral-200'
                }`}
              >
                <Icon className="w-4 h-4" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-6">
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <Plate>
              <h2 className="text-2xl mb-2" style={DISPLAY}>How approved data works</h2>
              <p className="text-sm text-neutral-300 mb-3">
                Under 14 CFR 43.13(a), maintenance must follow a specific order of authority. This tool is organized the same way.
              </p>
              <ol className="space-y-2 text-sm">
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600 flex-shrink-0" style={MONO}>1</span>
                  <div>
                    <span className="font-medium">Manufacturer's Maintenance Manual / ICA</span> — the primary source for any specific aircraft, engine, or component. Always check here first for procedures, diagrams, and limits.
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600 flex-shrink-0" style={MONO}>2</span>
                  <div>
                    <span className="font-medium">AC 43.13-1B / -2B</span> — FAA-accepted general practices, used only when the manufacturer provides no instructions for a given repair, mostly for minor repairs.
                  </div>
                </li>
                <li className="flex gap-3">
                  <span className="font-bold text-blue-600 flex-shrink-0" style={MONO}>3</span>
                  <div>
                    <span className="font-medium">Other FAA-approved data</span> — STCs, field approvals, TSO data, and similar.
                  </div>
                </li>
              </ol>
            </Plate>

            <Plate>
              <h2 className="text-2xl mb-3" style={DISPLAY}>Aircraft on the bench</h2>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <label className="text-sm">
                  <span className="block text-neutral-400 mb-1">Make</span>
                  <input
                    value={aircraft.make}
                    onChange={(e) => updateAircraft({ ...aircraft, make: e.target.value })}
                    placeholder="Cessna"
                    className="w-full border border-neutral-600 bg-neutral-800 text-neutral-100 rounded-sm px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-neutral-400 mb-1">Model</span>
                  <input
                    value={aircraft.model}
                    onChange={(e) => updateAircraft({ ...aircraft, model: e.target.value })}
                    placeholder="152"
                    className="w-full border border-neutral-600 bg-neutral-800 text-neutral-100 rounded-sm px-2 py-1.5 text-sm"
                  />
                </label>
                <label className="text-sm">
                  <span className="block text-neutral-400 mb-1">Tail number</span>
                  <input
                    value={aircraft.tail}
                    onChange={(e) => updateAircraft({ ...aircraft, tail: e.target.value })}
                    placeholder="N12345"
                    className="w-full border border-neutral-600 bg-neutral-800 text-neutral-100 rounded-sm px-2 py-1.5 text-sm"
                  />
                </label>
              </div>
              <p className="text-xs text-neutral-500 mt-2">Saved on this device. Used to label entries in the AD Tracker tab.</p>
            </Plate>

            <div>
              <h2 className="text-2xl mb-3 text-white" style={DISPLAY}>Quick references</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <RefLink
                  href={DRS_URL}
                  title="FAA Dynamic Regulatory System"
                  desc="Current Airworthiness Directives, Type Certificate Data Sheets, and Advisory Circulars."
                />
                <RefLink
                  href={AC1B_URL}
                  title="AC 43.13-1B"
                  desc="Acceptable methods, techniques & practices — inspection and repair."
                />
                <RefLink
                  href={AC2B_URL}
                  title="AC 43.13-2B"
                  desc="Acceptable methods, techniques & practices — alterations."
                />
                <RefLink
                  href={PART43_URL}
                  title="14 CFR Part 43"
                  desc="The regulation governing maintenance, preventive maintenance, and alterations."
                />
              </div>
            </div>
          </div>
        )}

        {activeTab === 'ads' && (
          <div className="space-y-6">
            <Plate>
              <h2 className="text-2xl mb-2" style={DISPLAY}>Airworthiness Directives</h2>
              <p className="text-sm text-neutral-300 mb-3">
                ADs are mandatory and change over time. The DRS is the authoritative source — check it for the airframe, engine, propeller, and every installed appliance before signing off an inspection.
              </p>
              <a
                href={DRS_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2 rounded-sm hover:bg-blue-700"
              >
                Open FAA Dynamic Regulatory System <ExternalLink className="w-3.5 h-3.5" />
              </a>
              {(aircraft.make || aircraft.model) && (
                <p className="text-xs text-neutral-500 mt-2">
                  On the bench: <span style={MONO}>{[aircraft.make, aircraft.model, aircraft.tail].filter(Boolean).join(' / ')}</span>
                </p>
              )}
            </Plate>

            <div>
              <h3 className="text-lg mb-3 text-white" style={DISPLAY}>Your AD log</h3>

              <Plate className="mb-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                  <label className="text-sm">
                    <span className="block text-neutral-400 mb-1">AD number</span>
                    <input
                      value={adDraft.adNumber}
                      onChange={(e) => setAdDraft({ ...adDraft, adNumber: e.target.value })}
                      placeholder="e.g. 80-04-06"
                      className="w-full border border-neutral-600 bg-neutral-800 text-neutral-100 rounded-sm px-2 py-1.5 text-sm"
                      style={MONO}
                    />
                  </label>
                  <label className="text-sm">
                    <span className="block text-neutral-400 mb-1">Applies to</span>
                    <input
                      value={adDraft.appliesTo}
                      onChange={(e) => setAdDraft({ ...adDraft, appliesTo: e.target.value })}
                      placeholder="e.g. generator, magneto"
                      className="w-full border border-neutral-600 bg-neutral-800 text-neutral-100 rounded-sm px-2 py-1.5 text-sm"
                    />
                  </label>
                </div>
                <label className="text-sm block mb-3">
                  <span className="block text-neutral-400 mb-1">Subject / compliance notes</span>
                  <input
                    value={adDraft.subject}
                    onChange={(e) => setAdDraft({ ...adDraft, subject: e.target.value })}
                    placeholder="Short description, compliance method, due date or hours"
                    className="w-full border border-neutral-600 bg-neutral-800 text-neutral-100 rounded-sm px-2 py-1.5 text-sm"
                  />
                </label>
                <div className="flex items-center gap-3">
                  <select
                    value={adDraft.status}
                    onChange={(e) => setAdDraft({ ...adDraft, status: e.target.value })}
                    className="border border-neutral-600 bg-neutral-800 text-neutral-100 rounded-sm px-2 py-1.5 text-sm"
                  >
                    <option value="open">Open</option>
                    <option value="complied">Complied</option>
                    <option value="na">N/A</option>
                  </select>
                  <button
                    onClick={addAdEntry}
                    disabled={!adDraft.adNumber.trim()}
                    className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm px-3 py-1.5 rounded-sm disabled:opacity-40 hover:bg-blue-700"
                  >
                    <Plus className="w-4 h-4" /> Add to log
                  </button>
                </div>
              </Plate>

              {adLog.length === 0 ? (
                <p className="text-sm text-neutral-400">No ADs logged yet — add one above, or check DRS for your aircraft's current AD list.</p>
              ) : (
                <div className="space-y-2">
                  {adLog.map((entry) => (
                    <Plate key={entry.id}>
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex items-center gap-2 mb-1 flex-wrap">
                            <span className="font-bold text-sm" style={MONO}>{entry.adNumber}</span>
                            <StatusBadge status={entry.status} />
                          </div>
                          {entry.appliesTo && <p className="text-xs text-neutral-400">Applies to: {entry.appliesTo}</p>}
                          {entry.subject && <p className="text-sm text-neutral-200 mt-1">{entry.subject}</p>}
                        </div>
                        <button onClick={() => removeAdEntry(entry.id)} className="text-neutral-500 hover:text-orange-600 flex-shrink-0">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </Plate>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'library' && (
          <div className="space-y-4">
            <Plate>
              <h2 className="text-2xl mb-2" style={DISPLAY}>AC 43.13-1B / -2B</h2>
              <p className="text-sm text-neutral-300 mb-3">
                General practices accepted by the FAA — use them when your aircraft or component manufacturer's manual doesn't cover the issue (14 CFR 43.13(a)). For specific torque values, part numbers, and teardown steps on something like a Cessna 152 generator, go to the manufacturer's maintenance manual, overhaul manual, or Illustrated Parts Catalog first.
              </p>
              <div className="flex gap-2 flex-wrap">
                <a href={AC1B_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm border border-neutral-600 rounded-sm px-3 py-1.5 hover:border-blue-400">
                  Open AC 43.13-1B <ExternalLink className="w-3.5 h-3.5 text-neutral-500" />
                </a>
                <a href={AC2B_URL} target="_blank" rel="noreferrer" className="inline-flex items-center gap-2 text-sm border border-neutral-600 rounded-sm px-3 py-1.5 hover:border-blue-400">
                  Open AC 43.13-2B <ExternalLink className="w-3.5 h-3.5 text-neutral-500" />
                </a>
              </div>
            </Plate>

            <div className="space-y-2">
              {CHAPTERS.map((ch) => (
                <div key={ch.num} className="border border-neutral-600 bg-neutral-900 rounded-sm px-4 py-3">
                  <div className="flex items-start gap-3">
                    <span className="text-xs text-neutral-500 w-6 pt-0.5" style={MONO}>{String(ch.num).padStart(2, '0')}</span>
                    <div className="flex-1">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium">{ch.title}</span>
                        {ch.expandable && (
                          <button
                            onClick={() => setExpandedChapter(expandedChapter === ch.num ? null : ch.num)}
                            className="text-xs text-neutral-500 flex items-center gap-1 flex-shrink-0"
                          >
                            Details {expandedChapter === ch.num ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                          </button>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 mt-1">{ch.desc}</p>

                      {ch.expandable && expandedChapter === ch.num && (
                        <div className="mt-3 space-y-3">
                          <div className="space-y-2">
                            {CH11_SECTIONS.map((sec) => (
                              <div key={sec.sec} className="text-sm">
                                <span className="font-medium" style={MONO}>§{sec.sec}</span> {sec.title}
                                <p className="text-xs text-neutral-400">{sec.note}</p>
                              </div>
                            ))}
                          </div>
                          <div className="bg-orange-500/10 border border-orange-500/30 rounded-sm p-3">
                            <div className="flex items-center gap-2 mb-2">
                              <AlertTriangle className="w-4 h-4 text-orange-600 flex-shrink-0" />
                              <span className="text-sm font-medium">Generator / alternator — general inspection points</span>
                            </div>
                            <ul className="text-xs text-neutral-200 space-y-1 list-disc pl-4">
                              <li>Mounting bolts/brackets secure and properly safetied; drive coupling or belt in serviceable condition</li>
                              <li>Terminal connections clean, tight, and free of corrosion; ground strap continuity intact</li>
                              <li>Output voltage and amperage within the limits specified by the aircraft/component manufacturer</li>
                              <li>Housing free of cracks, overheating discoloration, or oil contamination</li>
                              <li>Brushes, commutator, and bearings — inspect and service only per the component manufacturer's overhaul manual</li>
                            </ul>
                            <p className="text-xs text-neutral-400 mt-2">
                              These are general things to check, not a repair procedure. Brush limits, commutator specs, and reassembly torques come from the component manufacturer's overhaul manual referenced in your aircraft's Illustrated Parts Catalog.
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'photos' && (
          <div className="space-y-4">
            <Plate>
              <h2 className="text-2xl mb-2" style={DISPLAY}>Manual photos</h2>
              <p className="text-sm text-neutral-300 mb-3">
                Snap a photo of the page you're actually using from the manufacturer's maintenance manual, overhaul manual, or ICA. Saved privately for you in this app, so you can pull it back up or hand it to the assistant for questions grounded in that exact page.
              </p>
              <label className="inline-flex items-center gap-2 bg-blue-600 text-white text-sm px-4 py-2 rounded-sm hover:bg-blue-700 cursor-pointer">
                <Camera className="w-4 h-4" />
                {photoUploading ? 'Saving photo...' : 'Add a photo'}
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  className="hidden"
                  onChange={handlePhotoUpload}
                  disabled={photoUploading}
                />
              </label>
              {photoError && <p className="text-sm text-orange-600 mt-2">{photoError}</p>}
            </Plate>

            {photos.length === 0 ? (
              <p className="text-sm text-neutral-400">No photos saved yet. Add one above, then use it in Ask Assistant for questions grounded in that exact page.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {photos.map((photo) => (
                  <Plate key={photo.id}>
                    <img
                      src={photo.dataUrl}
                      alt={photo.label}
                      className="w-full h-40 object-cover rounded-sm border border-neutral-700 mb-2"
                    />
                    <input
                      value={photo.label}
                      onChange={(e) => updatePhotoLabel(photo.id, e.target.value)}
                      className="w-full text-sm font-medium bg-transparent text-neutral-100 border border-transparent hover:border-neutral-600 focus:border-neutral-600 rounded-sm px-1 py-0.5 mb-2"
                    />
                    <div className="flex items-center justify-between gap-2">
                      <button
                        onClick={() => {
                          setSelectedPhotoId(photo.id);
                          setMode('manual');
                          setActiveTab('assistant');
                        }}
                        className="text-xs border border-neutral-600 rounded-full px-3 py-1.5 text-neutral-300 hover:border-blue-400"
                      >
                        Use in Assistant
                      </button>
                      <button onClick={() => removePhoto(photo.id)} className="text-neutral-500 hover:text-orange-600">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </Plate>
                ))}
              </div>
            )}
          </div>
        )}

        {activeTab === 'assistant' && (
          <div className="space-y-4">
            <Plate>
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-orange-600" />
                <h2 className="text-lg font-medium">Before you ask</h2>
              </div>
              <p className="text-sm text-neutral-300">
                This assistant can explain general concepts and help you read your own manual text or photos. It does not know the specific procedures, torque values, or part numbers for your aircraft unless you provide them. Anything you paste or attach is sent to Claude for this question only.
              </p>
            </Plate>

            <div className="flex gap-2">
              <button
                onClick={() => setMode('general')}
                className={`flex-1 text-sm px-3 py-2 rounded-sm border transition-colors ${
                  mode === 'general' ? 'bg-blue-600 text-white border-blue-600' : 'bg-neutral-900 border-neutral-600 text-neutral-300'
                }`}
              >
                General practices
              </button>
              <button
                onClick={() => setMode('manual')}
                className={`flex-1 text-sm px-3 py-2 rounded-sm border transition-colors ${
                  mode === 'manual' ? 'bg-blue-600 text-white border-blue-600' : 'bg-neutral-900 border-neutral-600 text-neutral-300'
                }`}
              >
                My manual
              </button>
            </div>

            {mode === 'manual' && (
              <Plate>
                <span className="block text-sm text-neutral-400 mb-2">Photo of manual page</span>
                {photos.length === 0 ? (
                  <button
                    onClick={() => setActiveTab('photos')}
                    className="text-sm border border-neutral-600 rounded-sm px-3 py-1.5 text-neutral-300 hover:border-blue-400 mb-3"
                  >
                    Add a photo in Manual Photos
                  </button>
                ) : (
                  <div className="flex gap-2 overflow-x-auto mb-3 pb-1">
                    <button
                      onClick={() => setSelectedPhotoId(null)}
                      className={`flex-shrink-0 w-14 h-14 rounded-sm border-2 flex items-center justify-center text-xs text-neutral-500 ${
                        !selectedPhotoId ? 'border-blue-600' : 'border-neutral-700'
                      }`}
                    >
                      None
                    </button>
                    {photos.map((photo) => (
                      <button
                        key={photo.id}
                        onClick={() => setSelectedPhotoId(photo.id)}
                        className={`flex-shrink-0 w-14 h-14 rounded-sm border-2 overflow-hidden ${
                          selectedPhotoId === photo.id ? 'border-blue-600' : 'border-neutral-700'
                        }`}
                        title={photo.label}
                      >
                        <img src={photo.dataUrl} alt={photo.label} className="w-full h-full object-cover" />
                      </button>
                    ))}
                  </div>
                )}

                <label className="text-sm block">
                  <span className="block text-neutral-400 mb-1">Paste manual / ICA text (optional if a photo is selected)</span>
                  <textarea
                    value={manualText}
                    onChange={(e) => setManualText(e.target.value)}
                    rows={5}
                    placeholder="Paste the relevant section from your maintenance manual, IPC, or ICA here..."
                    className="w-full border border-neutral-600 bg-neutral-800 text-neutral-100 rounded-sm px-2 py-1.5 text-sm"
                    style={MONO}
                  />
                </label>
              </Plate>
            )}

            <div className="border border-neutral-600 bg-neutral-900 rounded-sm flex flex-col">
              <div className="flex-1 overflow-y-auto p-4 space-y-3" style={{ maxHeight: '400px', minHeight: '200px' }}>
                {currentChat.length === 0 ? (
                  <div className="space-y-2">
                    <p className="text-sm text-neutral-500">Try asking:</p>
                    <div className="flex flex-wrap gap-2">
                      {starters.map((s, i) => (
                        <button
                          key={i}
                          onClick={() => setChatInput(s)}
                          className="text-xs border border-neutral-600 rounded-full px-3 py-1.5 text-neutral-300 hover:border-blue-400 text-left"
                        >
                          {s}
                        </button>
                      ))}
                    </div>
                  </div>
                ) : (
                  currentChat.map((m, i) => (
                    <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                      <div
                        className={`text-sm rounded-sm px-3 py-2 whitespace-pre-wrap ${
                          m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-neutral-800 border border-neutral-700 text-neutral-200'
                        }`}
                        style={{ maxWidth: '85%' }}
                      >
                        {m.content}
                      </div>
                    </div>
                  ))
                )}
                {chatLoading && (
                  <div className="flex items-center gap-2 text-sm text-neutral-500">
                    <Loader2 className="w-4 h-4 animate-spin" /> Thinking...
                  </div>
                )}
                {chatError && <p className="text-sm text-orange-600">{chatError}</p>}
              </div>
              <div className="border-t border-neutral-700 p-3 flex gap-2">
                <input
                  value={chatInput}
                  onChange={(e) => setChatInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleSend();
                  }}
                  disabled={mode === 'manual' && !manualReady}
                  placeholder={mode === 'manual' && !manualReady ? 'Add manual text or a photo first...' : 'Ask a question...'}
                  className="flex-1 border border-neutral-600 bg-neutral-800 text-neutral-100 rounded-sm px-3 py-2 text-sm disabled:bg-neutral-900"
                />
                <button
                  onClick={handleSend}
                  disabled={chatLoading || !chatInput.trim() || (mode === 'manual' && !manualReady)}
                  className="bg-blue-600 text-white rounded-sm px-3 py-2 disabled:opacity-40 flex-shrink-0"
                >
                  <Send className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
