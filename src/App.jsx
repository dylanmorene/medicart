import { useState, useEffect } from "react";
import {
  Cloud, Sun, Gift, Home, Package, Link2, ShoppingBag,
  Tag, ShoppingCart, LayoutGrid, Radio, Archive,
  TrendingUp, TrendingDown, Minus, ChevronRight, Plus, X,
  Layers, BarChart2, Activity, Loader, Database, UploadCloud, Rocket, Edit2, AlertCircle
} from "lucide-react";

const API = "http://localhost:5001/api";

// Color palette — each new dataset gets the next color automatically
const PALETTE = [
  "#4a7fa5", 
  "#e07b39", 
  "#6a9e5f", 
  "#9b6bbf",
  "#c0515a", 
  "#4aaba5",
  "#d4a83a",
  "#5a7abf",
];

function paletteColor(index) {
  return PALETTE[index % PALETTE.length];
}

const TABS = [
  { id: "homepage",  label: "Homepage Ranking",  Icon: Home },
  { id: "bundles",   label: "Top Bundles",        Icon: Package },
  { id: "rules",     label: "Association Rules",  Icon: Link2 },
  { id: "fbt",       label: "Bought Together",    Icon: ShoppingBag },
  { id: "promo",     label: "Promo Generator",    Icon: Tag },
  { id: "crosssell", label: "Cross-Sell Sim",     Icon: ShoppingCart },
  { id: "shelf",     label: "Shelf Placement",    Icon: LayoutGrid },
  { id: "drift",     label: "Drift Detection",    Icon: Radio },
  { id: "versions",  label: "Version Cache",      Icon: Archive },
];

const pct  = (v) => `${(v * 100).toFixed(1)}%`;
const fmt2 = (v) => (v >= 999 ? "—" : Number(v).toFixed(2));

// Suggests a clean filename from the uploaded CSV
function suggestName(filename) {
  if (!filename) return "";
  return filename
    .replace(/\.csv$/i, "")
    .replace(/[_\-]+/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase())
    .trim();
}

function SupportBar({ value, accent }) {
  return (
    <div style={{ height: 3, background: "#e5e7eb", borderRadius: 99, overflow: "hidden", width: "100%" }}>
      <div style={{ height: "100%", width: `${Math.min(value * 100, 100)}%`, background: accent, borderRadius: 99, transition: "width 0.6s ease" }} />
    </div>
  );
}

function Chip({ children, accent, light }) {
  return (
    <span style={{ background: light, color: accent, border: `1px solid ${accent}30`, fontSize: 11, padding: "2px 8px", borderRadius: 99, fontWeight: 600, whiteSpace: "nowrap" }}>
      {children}
    </span>
  );
}

function StatBox({ label, value, accent }) {
  return (
    <div style={{ padding: "10px 14px", borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb", minWidth: 72, textAlign: "center" }}>
      <div style={{ fontSize: 10, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 3 }}>{label}</div>
      <div style={{ fontSize: 14, fontWeight: 700, color: accent, fontVariantNumeric: "tabular-nums" }}>{value}</div>
    </div>
  );
}

function LoadingSpinner({ accent }) {
  return (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", padding: "48px 0", gap: 10, color: "#9ca3af" }}>
      <Loader size={18} color={accent} style={{ animation: "spin 1s linear infinite" }} />
      <span style={{ fontSize: 13 }}>Loading from database...</span>
      <style>{`@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

function ErrorBox({ message }) {
  return (
    <div style={{ padding: 16, borderRadius: 8, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", fontSize: 13, lineHeight: 1.7 }}>
      <strong>Could not connect to Flask API.</strong><br />
      Make sure <code>flask_api.py</code> is running:<br />
      <code style={{ fontSize: 11 }}>python flask_api.py</code><br /><br />
      <span style={{ color: "#7f1d1d", fontSize: 11 }}>{message}</span>
    </div>
  );
}

// ─── FIRST PAGE ──────────────────────────────────────────────────────────────────
function Gateway({ onStart }) {
  const [file, setFile] = useState(null);
  const [uploading, setUploading] = useState(false);
  const hasFile = !!file;

  const handleDrop = (e) => {
    e.preventDefault();
    const f = e.dataTransfer.files[0];
    if (f && f.name.endsWith(".csv")) setFile(f);
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 40, fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif" }}>
      <div style={{ width: 64, height: 64, borderRadius: 16, background: "linear-gradient(135deg, #1f2937, #111827)", display: "flex", alignItems: "center", justifyContent: "center", marginBottom: 20, boxShadow: "0 10px 25px rgba(0,0,0,0.1)" }}>
        <BarChart2 size={32} color="#fff" />
      </div>
      <h1 style={{ fontSize: 32, fontWeight: 800, color: "#111827", marginBottom: 12, letterSpacing: "-0.02em" }}>MediCart</h1>
      <p style={{ fontSize: 14, color: "#6b7280", marginBottom: 32 }}>Upload first dataset to begin</p>

      <div style={{ display: "flex", gap: 6, marginBottom: 32, alignItems: "center" }}>
        <div style={{ width: 8, height: 8, borderRadius: 99, background: hasFile ? "#10b981" : "#d1d5db", transition: "all 0.3s" }} />
        <span style={{ fontSize: 12, color: "#6b7280", fontWeight: 500 }}>{hasFile ? `Ready: ${file.name}` : "No dataset selected"}</span>
      </div>

      <div style={{ width: "100%", maxWidth: 400 }}>
        <div
          onDragOver={e => e.preventDefault()}
          onDrop={handleDrop}
          style={{ background: hasFile ? "#e8f2f9" : "#fff", border: `2px dashed ${hasFile ? "#4a7fa5" : "#d1d5db"}`, borderRadius: 16, padding: "48px 20px", textAlign: "center", transition: "all 0.2s" }}
        >
          <div style={{ width: 48, height: 48, borderRadius: 12, background: hasFile ? "#4a7fa5" : "#f3f4f6", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px", transition: "all 0.2s" }}>
            <Database size={24} color={hasFile ? "#fff" : "#9ca3af"} />
          </div>
          <h3 style={{ fontSize: 16, fontWeight: 700, color: "#111827", marginBottom: 4 }}>Dataset A — Base Season</h3>
          <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 20 }}>This will be Iteration 1. Upload datasets B and C from the dashboard after this.</p>

          {!hasFile ? (
            <label style={{ display: "inline-block", padding: "8px 16px", background: "#f9fafb", border: "1px solid #e5e7eb", borderRadius: 8, fontSize: 12, fontWeight: 600, color: "#4b5563", cursor: "pointer" }}>
              Click or drag CSV here
              <input type="file" accept=".csv" style={{ display: "none" }} onChange={e => {
                const f = e.target.files[0];
                if (f && f.name.endsWith(".csv")) setFile(f);
              }} />
            </label>
          ) : (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "8px 16px", background: "#fff", border: "1px solid #4a7fa5", borderRadius: 8, fontSize: 12, fontWeight: 700, color: "#4a7fa5" }}>
              {file.name}
              <X size={12} style={{ cursor: "pointer" }} onClick={() => setFile(null)} />
            </div>
          )}
        </div>
      </div>

      <button
        disabled={!hasFile || uploading}
        onClick={async () => {
          setUploading(true);
          try { await onStart(file); }
          catch { setUploading(false); alert("Analysis failed. Make sure flask_api.py is running!"); }
        }}
        style={{ marginTop: 40, padding: "16px 40px", background: hasFile ? "#111827" : "#e5e7eb", color: hasFile ? "#fff" : "#9ca3af", border: "none", borderRadius: 99, fontSize: 16, fontWeight: 700, display: "flex", alignItems: "center", gap: 10, cursor: hasFile ? "pointer" : "not-allowed", transition: "all 0.2s", boxShadow: hasFile ? "0 10px 25px rgba(17,24,39,0.25)" : "none" }}
      >
        {uploading ? <Loader size={20} style={{ animation: "spin 1s linear infinite" }} /> : <Rocket size={20} />}
        {uploading ? "Analyzing..." : "Run MBA Engine"}
      </button>

      <p style={{ textAlign: "center", fontSize: 11, color: "#d1d5db", marginTop: 60, letterSpacing: "0.05em" }}>
        MediCart · FP-Growth + Apriori · Self-Learning MBA Engine
      </p>
    </div>
  );
}

// ─── UPLOAD MODAL ─────────────────────────────────────────────────────────────
function UploadModal({ show, onClose, onUpload, existingNames, themeColor, setThemeColor }) {
  const [file, setFile]           = useState(null);
  const [name, setName]           = useState("");
  const [nameTouched, setNameTouched] = useState(false);
  const [drag, setDrag]           = useState(false);
  const [uploading, setUploading] = useState(false);

  // Auto-suggest name when file is chosen
  const handleFile = (f) => {
    if (!f || !f.name.endsWith(".csv")) return;
    setFile(f);
    // Only auto-fill if user hasn't typed anything yet
    if (!nameTouched || name.trim() === "") {
      setName(suggestName(f.name));
    }
  };

  const isDuplicateName = existingNames.includes(name.trim());
  const nameEmpty       = name.trim() === "";
  const canSubmit       = file && !nameEmpty && !isDuplicateName && !uploading;

  const handleSubmit = async () => {
    if (!canSubmit) return;
    setUploading(true);
    try {
      await onUpload(file, name.trim(), themeColor);
      // Reset
      setFile(null);
      setName("");
      setNameTouched(false);
    } catch (e) {
      alert("Upload failed: " + e.message);
    } finally {
      setUploading(false);
    }
  };

  if (!show) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(17,24,39,0.7)", backdropFilter: "blur(4px)", zIndex: 9999, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ background: "#fff", width: "100%", maxWidth: 500, borderRadius: 24, boxShadow: "0 20px 60px rgba(0,0,0,0.15)", overflow: "hidden" }}>

        {/* Header */}
        <div style={{ padding: "20px 24px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid #f3f4f6" }}>
          <h2 style={{ fontSize: 17, fontWeight: 700, color: "#111827", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
            <Database size={18} color="#6b7280" /> Upload Next Dataset
          </h2>
          <button onClick={onClose} style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer", display: "flex" }}>
            <X size={20} />
          </button>
        </div>

        <div style={{ padding: 28 }}>

          {/* Name field — required */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>
              Dataset Name
              <span style={{ color: "#ef4444", fontSize: 14, lineHeight: 1 }}>*</span>
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 400, color: "#9ca3af" }}>required</span>
            </label>
            <input
              type="text"
              placeholder="e.g. Summer Season"
              value={name}
              onChange={e => { setName(e.target.value); setNameTouched(true); }}
              style={{
                width: "100%", padding: "10px 14px", borderRadius: 8, fontSize: 14, outline: "none",
                border: `1px solid ${isDuplicateName ? "#ef4444" : nameEmpty && nameTouched ? "#f59e0b" : "#d1d5db"}`,
                background: isDuplicateName ? "#fef2f2" : "#fff",
              }}
            />
            {isDuplicateName && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 12, color: "#dc2626" }}>
                <AlertCircle size={12} /> A dataset named "{name.trim()}" already exists. Choose a different name.
              </div>
            )}
            {nameEmpty && nameTouched && (
              <div style={{ display: "flex", alignItems: "center", gap: 4, marginTop: 6, fontSize: 12, color: "#d97706" }}>
                <AlertCircle size={12} /> Dataset name is required before uploading.
              </div>
            )}
          </div>

          {/* Theme color */}
          <div style={{ marginBottom: 20 }}>
            <label style={{ display: "block", fontSize: 12, fontWeight: 700, color: "#374151", marginBottom: 6 }}>Theme Color</label>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <label style={{ width: 40, height: 40, borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", border: "1px solid #d1d5db", cursor: "pointer", background: themeColor, flexShrink: 0 }}>
                <input type="color" value={themeColor} onChange={e => setThemeColor(e.target.value)} style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
              </label>
              <span style={{ fontSize: 12, color: "#6b7280" }}>Pick a color to distinguish this dataset's tab</span>
            </div>
          </div>

          {/* Drop zone */}
          <div
            onDragOver={e => { e.preventDefault(); setDrag(true); }}
            onDragLeave={e => { e.preventDefault(); setDrag(false); }}
            onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
            style={{ background: drag ? "#f3f4f6" : file ? "#f0fdf4" : "#fff", border: `2px dashed ${drag ? themeColor : file ? "#16a34a" : "#d1d5db"}`, borderRadius: 14, padding: "36px 24px", textAlign: "center", transition: "all 0.2s" }}
          >
            {file ? (
              <div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: "#dcfce7", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <UploadCloud size={22} color="#16a34a" />
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: "#15803d", marginBottom: 4 }}>{file.name}</div>
                <button onClick={() => setFile(null)} style={{ fontSize: 11, color: "#9ca3af", background: "none", border: "none", cursor: "pointer", textDecoration: "underline" }}>
                  Remove and choose another
                </button>
              </div>
            ) : (
              <div>
                <div style={{ width: 40, height: 40, borderRadius: 10, background: drag ? themeColor + "22" : "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 12px" }}>
                  <UploadCloud size={22} color={drag ? themeColor : "#9ca3af"} />
                </div>
                <p style={{ fontSize: 13, color: "#6b7280", marginBottom: 14 }}>Drag & drop your CSV here, or click to browse</p>
                <label style={{ display: "inline-block", padding: "8px 20px", background: themeColor, color: "#fff", borderRadius: 99, fontSize: 12, fontWeight: 600, cursor: "pointer" }}>
                  Browse Files
                  <input type="file" accept=".csv" style={{ display: "none" }} onChange={e => handleFile(e.target.files[0])} />
                </label>
              </div>
            )}
          </div>

          {/* Submit */}
          <button
            disabled={!canSubmit}
            onClick={handleSubmit}
            style={{ marginTop: 20, width: "100%", padding: "12px", background: canSubmit ? "#111827" : "#e5e7eb", color: canSubmit ? "#fff" : "#9ca3af", border: "none", borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: canSubmit ? "pointer" : "not-allowed", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, transition: "all 0.2s" }}
          >
            {uploading ? <Loader size={16} style={{ animation: "spin 1s linear infinite" }} /> : <BarChart2 size={16} />}
            {uploading ? "Analyzing dataset..." : !file ? "Select a CSV file first" : nameEmpty ? "Enter a dataset name first" : isDuplicateName ? "Name already taken" : "Run MBA Engine"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── TAB SECTIONS ─────────────────────────────────────────────────────────────

function HomepageRanking({ data, cfg }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.07em" }}>MBA-powered product ranking by transaction frequency</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
        {data.map((item, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 12px", borderRadius: 8, border: "1px solid #e5e7eb", background: i === 0 ? cfg.accentLight : "#fff" }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: cfg.accent, width: 20, textAlign: "center", flexShrink: 0 }}>{i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 500, color: "#111827", marginBottom: 4, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.item}</div>
              <SupportBar value={item.support} accent={cfg.accent} />
            </div>
            <span style={{ fontSize: 12, fontWeight: 600, color: cfg.accent, flexShrink: 0 }}>{pct(item.support)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TopBundles({ data, cfg }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.07em" }}>Frequent itemsets — co-purchased item groups</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((bundle, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "10px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}>
            <span style={{ fontSize: 12, fontWeight: 600, color: "#d1d5db", width: 20, flexShrink: 0 }}>{i + 1}</span>
            <div style={{ flex: 1, display: "flex", flexWrap: "wrap", gap: 4 }}>
              {bundle.items.map((item, j) => (
                <Chip key={j} accent={cfg.accent} light={cfg.accentLight}>{item}</Chip>
              ))}
            </div>
            <div style={{ textAlign: "right", flexShrink: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: cfg.accent }}>{bundle.support_count}×</div>
              <div style={{ fontSize: 11, color: "#9ca3af" }}>{pct(bundle.support)}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function AssociationRules({ data, cfg }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.07em" }}>Top rules by composite score · lift × 0.4 + conf × 0.35 + sup × 0.25</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {data.map((rule, i) => (
          <div key={i} style={{ padding: "12px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {rule.antecedent.map((a, j) => (
                  <span key={j} style={{ fontSize: 12, fontWeight: 500, color: "#374151", background: "#f3f4f6", padding: "2px 8px", borderRadius: 99, border: "1px solid #e5e7eb" }}>{a}</span>
                ))}
              </div>
              <ChevronRight size={13} color="#9ca3af" />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                {rule.consequent.map((c, j) => (
                  <Chip key={j} accent={cfg.accent} light={cfg.accentLight}>{c}</Chip>
                ))}
              </div>
              <span style={{ marginLeft: "auto", fontSize: 11, fontWeight: 700, color: cfg.accent, background: cfg.accentLight, padding: "2px 8px", borderRadius: 99, border: `1px solid ${cfg.accentMid}` }}>
                Score {Number(rule.score).toFixed(3)}
              </span>
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
              {[["Support", pct(rule.support)], ["Confidence", pct(rule.confidence)], ["Lift", fmt2(rule.lift)], ["Leverage", Number(rule.leverage).toFixed(3)], ["Conviction", fmt2(rule.conviction)]].map(([label, val]) => (
                <StatBox key={label} label={label} value={val} accent={cfg.accent} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function FrequentlyBoughtTogether({ data, cfg }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.07em" }}>High-score item pairs — surface to customers at checkout</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((fbt, i) => (
          <div key={i} style={{ padding: "14px 16px", borderRadius: 8, border: `1px solid ${cfg.accentMid}`, background: cfg.accentLight }}>
            <div style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: 6, marginBottom: 8 }}>
              {fbt.bundle.map((item, j) => (
                <span key={j} style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{item}</span>
                  {j < fbt.bundle.length - 1 && <Plus size={12} color="#9ca3af" />}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: 16, fontSize: 12, color: "#6b7280" }}>
              <span>Lift <strong style={{ color: cfg.accent }}>{fmt2(fbt.lift)}×</strong></span>
              <span>Conf <strong style={{ color: cfg.accent }}>{pct(fbt.confidence)}</strong></span>
              <span>Support <strong style={{ color: cfg.accent }}>{pct(fbt.support)}</strong></span>
              <span style={{ marginLeft: "auto", fontWeight: 700, color: cfg.accent }}>Score {Number(fbt.score).toFixed(3)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PromoGenerator({ data, cfg }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.07em" }}>Promo suggestions generated from lift × confidence scoring</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((promo, i) => (
          <div key={i} style={{ padding: "14px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>{promo.promo_type}</span>
              <span style={{ fontSize: 18, fontWeight: 800, color: cfg.accent }}>{promo.suggested_discount} OFF</span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: 8 }}>
              {promo.bundle.map((item, j) => (
                <Chip key={j} accent={cfg.accent} light={cfg.accentLight}>{item}</Chip>
              ))}
            </div>
            <p style={{ fontSize: 12, color: "#9ca3af", fontStyle: "italic", margin: 0 }}>{promo.rationale}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function CrossSellSim({ allItems, season, cfg }) {
  const [cart, setCart]             = useState([]);
  const [input, setInput]           = useState("");
  const [suggestions, setSuggestions] = useState([]);
  const [loading, setLoading]       = useState(false);

  useEffect(() => { setCart([]); setSuggestions([]); }, [season]);

  const fetchSuggestions = async (newCart) => {
    if (newCart.length === 0) { setSuggestions([]); return; }
    setLoading(true);
    try {
      const res = await fetch(`${API}/crosssell/${season}/${encodeURIComponent(newCart.join(","))}`);
      setSuggestions(await res.json());
    } catch { setSuggestions([]); }
    setLoading(false);
  };

  const addItem = (item) => {
    if (!item || cart.includes(item)) return;
    const nc = [...cart, item]; setCart(nc); setInput(""); fetchSuggestions(nc);
  };
  const removeItem = (item) => {
    const nc = cart.filter(c => c !== item); setCart(nc); fetchSuggestions(nc);
  };

  return (
    <div>
      <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.07em" }}>Simulate cross-sell — add items to cart to see live suggestions</p>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        <select value={input} onChange={e => setInput(e.target.value)}
          style={{ flex: 1, padding: "8px 12px", borderRadius: 8, border: "1px solid #d1d5db", fontSize: 13, color: "#374151", background: "#fff", outline: "none" }}>
          <option value="">Select an item...</option>
          {allItems.map(item => <option key={item} value={item}>{item}</option>)}
        </select>
        <button onClick={() => addItem(input)} style={{ padding: "8px 16px", borderRadius: 8, background: cfg.accent, color: "#fff", border: "none", fontSize: 13, fontWeight: 600 }}>Add</button>
      </div>
      {cart.length > 0 && (
        <div style={{ padding: "10px 12px", borderRadius: 8, background: "#f9fafb", border: "1px solid #e5e7eb", marginBottom: 14 }}>
          <div style={{ fontSize: 11, color: "#9ca3af", marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.07em" }}>Cart</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
            {cart.map((item, i) => (
              <span key={i} onClick={() => removeItem(item)} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 12, fontWeight: 500, color: "#374151", background: "#fff", border: "1px solid #d1d5db", padding: "2px 8px", borderRadius: 99, cursor: "pointer" }}>
                {item} <X size={10} />
              </span>
            ))}
          </div>
        </div>
      )}
      {loading && <LoadingSpinner accent={cfg.accent} />}
      {!loading && cart.length > 0 && (
        suggestions.length === 0
          ? <p style={{ fontSize: 13, color: "#9ca3af", fontStyle: "italic" }}>No cross-sell matches for current cart.</p>
          : (
            <div>
              <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 8 }}>Live suggestions from SQLite</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {suggestions.map((s, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, border: `1px solid ${cfg.accentMid}`, background: cfg.accentLight }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 13, fontWeight: 600, color: "#111827" }}>{s.consequent.join(", ")}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>triggered by: {s.antecedent.join(", ")}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: cfg.accent }}>{pct(s.confidence)}</div>
                      <div style={{ fontSize: 11, color: "#9ca3af" }}>lift {fmt2(s.lift)}×</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
      )}
    </div>
  );
}

function ShelfPlacement({ data, cfg }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.07em" }}>Co-purchase pairs — recommended physical shelf adjacency</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
        {data.map((s, i) => (
          <div key={i} style={{ display: "flex", alignItems: "center", gap: 12, padding: "10px 14px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}>
            <LayoutGrid size={15} color={cfg.accent} style={{ flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                <span style={{ fontSize: 13, fontWeight: 500, color: "#111827" }}>{s.item_a}</span>
                <span style={{ fontSize: 11, color: "#d1d5db" }}>alongside</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: cfg.accent }}>{s.item_b}</span>
              </div>
              <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 2 }}>{s.insight}</div>
            </div>
            <span style={{ fontSize: 13, fontWeight: 700, color: cfg.accent, flexShrink: 0 }}>{s.co_purchases}×</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function DriftReport({ data, cfg }) {
  if (!data) return (
    <div style={{ textAlign: "center", padding: "48px 0", color: "#9ca3af" }}>
      <Activity size={28} color="#d1d5db" style={{ margin: "0 auto 12px" }} />
      <p style={{ fontSize: 13 }}>Iteration 1 — no previous dataset to compare against.</p>
    </div>
  );
  return (
    <div>
      <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.07em" }}>Rule changes detected vs previous dataset iteration</p>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 16 }}>
        {[{ label: "Shifted Rules", value: data.drift_count, Icon: Minus }, { label: "New Rules", value: data.new_count, Icon: TrendingUp }, { label: "Dropped Rules", value: data.dropped_count, Icon: TrendingDown }].map(({ label, value, Icon }) => (
          <div key={label} style={{ padding: 14, borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff", textAlign: "center" }}>
            <Icon size={16} color={cfg.accent} style={{ margin: "0 auto 6px" }} />
            <div style={{ fontSize: 22, fontWeight: 800, color: cfg.accent }}>{value}</div>
            <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em" }}>{label}</div>
          </div>
        ))}
      </div>
      {data.new_rules?.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>New rules this dataset</div>
          {data.new_rules.slice(0, 6).map((r, i) => (
            <div key={i} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, background: "#f0fdf4", border: "1px solid #bbf7d0", color: "#166534", marginBottom: 4 }}>+ {r}</div>
          ))}
        </div>
      )}
      {data.dropped_rules?.length > 0 && (
        <div>
          <div style={{ fontSize: 11, color: "#9ca3af", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Rules no longer active</div>
          {data.dropped_rules.slice(0, 6).map((r, i) => (
            <div key={i} style={{ fontSize: 12, padding: "6px 10px", borderRadius: 6, background: "#fef2f2", border: "1px solid #fecaca", color: "#991b1b", marginBottom: 4 }}>− {r}</div>
          ))}
        </div>
      )}
    </div>
  );
}

function VersionCache({ data }) {
  return (
    <div>
      <p style={{ fontSize: 12, color: "#9ca3af", marginBottom: 16, textTransform: "uppercase", letterSpacing: "0.07em" }}>Model snapshots — one stored version per dataset iteration</p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {data.map((v, i) => (
          <div key={i} style={{ padding: "14px 16px", borderRadius: 8, border: "1px solid #e5e7eb", background: "#fff" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontSize: 13, fontWeight: 700, color: "#111827" }}>{v.key}</span>
                <span style={{ fontSize: 11, color: "#9ca3af" }}>Iteration {v.iteration}</span>
              </div>
              <span style={{ fontSize: 11, fontWeight: 600, color: "#16a34a", background: "#f0fdf4", border: "1px solid #bbf7d0", padding: "2px 8px", borderRadius: 99 }}>cached</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
              {[["Transactions", v.n_transactions], ["Itemsets", v.n_itemsets], ["Rules", v.n_rules], ["MinSup", v.minsup], ["MinConf", v.minconf], ["Algorithm", "FP-Growth"]].map(([k, val]) => (
                <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "4px 0", borderBottom: "1px solid #f3f4f6" }}>
                  <span style={{ color: "#9ca3af" }}>{k}</span>
                  <span style={{ fontWeight: 600, color: "#374151" }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [appMode, setAppMode]       = useState("loading");
  const [season, setSeason]         = useState("Base");
  const [tab, setTab]               = useState("homepage");
  const [data, setData]             = useState(null);
  const [versions, setVersions]     = useState([]);
  const [loading, setLoading]       = useState(true);
  const [error, setError]           = useState(null);
  const [seasonsMap, setSeasonsMap] = useState({});
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [uploadLoading, setUploadLoading]     = useState(false);
  const [modalThemeColor, setModalThemeColor] = useState(paletteColor(0));

  const [editingName, setEditingName]   = useState(false);
  const [editNameValue, setEditNameValue] = useState("");
  const [editThemeValue, setEditThemeValue] = useState("");

  // On load: check if DB already has seasons → resume dashboard, else show gateway
  useEffect(() => {
    fetch(`${API}/seasons`)
      .then(r => r.json())
      .then(seasons => {
        if (!seasons || seasons.length === 0) {
          setAppMode("gateway");
          return;
        }
        // Rebuild seasonsMap from existing DB data
        const map = {};
        seasons.forEach(s => {
          const color = s.theme_color || "#4a7fa5";
          map[s.season] = {
            label: s.season,
            Icon: Database,
            accent: color,
            accentMid: color + "88",
            accentLight: color + "1A",
            tagline: s.tagline || "Dataset analysis",
          };
        });
        setSeasonsMap(map);
        setSeason(seasons[0].season);
        setAppMode("dashboard");
      })
      .catch(() => setAppMode("gateway"));
  }, []);

  // Fetch season data when season changes
  useEffect(() => {
    if (appMode !== "dashboard") return;
    setLoading(true); setError(null); setData(null);
    fetch(`${API}/seasons/${season}`)
      .then(r => { if (!r.ok) throw new Error(`HTTP ${r.status}`); return r.json(); })
      .then(d  => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [season, appMode]);

  // Fetch version cache when in dashboard
  useEffect(() => {
    if (appMode !== "dashboard") return;
    fetch(`${API}/versions`).then(r => r.json()).then(setVersions).catch(() => {});
  }, [appMode, seasonsMap]);

  // ── First dataset ────────────────────────────────────────────────
  const handleInitEngine = async (file) => {
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`${API}/init-engine`, { method: "POST", body: formData });
    if (!res.ok) throw new Error("Init engine failed");
    const result = await res.json();
    if (result.error) throw new Error(result.error);

    setSeasonsMap({
      "Base": { label: "Base", Icon: Database, accent: "#4a7fa5", accentMid: "#b8d4e8", accentLight: "#e8f2f9", tagline: "Starting Dataset" }
    });
    setSeason("Base");
    setAppMode("dashboard");
  };

  // ── File upload in Dashboard: B and C datasets ──────────────────────────────────
  const handleUpload = async (file, name, color) => {
    setUploadLoading(true);
    const formData = new FormData();
    formData.append("file", file);
    formData.append("dataset_name", name);
    formData.append("theme_color", color);

    try {
      const res = await fetch(`${API}/upload`, { method: "POST", body: formData });
      if (!res.ok) throw new Error("Upload failed");
      const result = await res.json();
      if (result.error) throw new Error(result.error);

      setSeasonsMap(prev => ({
        ...prev,
        [name]: { label: name, Icon: Database, accent: color, accentMid: color + "88", accentLight: color + "1A", tagline: "User-uploaded dataset analysis" }
      }));
      setSeason(name);
      setTab("homepage");
      setShowUploadModal(false);
    } finally {
      setUploadLoading(false);
    }
  };

  // ── Rename ────────────────────────────────────────────────────────────────
  const handleRename = async () => {
    const newName  = editNameValue.trim() || season;
    const newColor = editThemeValue || cfg.accent;
    if (newName === season && newColor === cfg.accent) { setEditingName(false); return; }
    try {
      const res = await fetch(`${API}/update-season`, {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ old_name: season, new_name: newName, theme_color: newColor }),
      });
      if (!res.ok) throw new Error("Update failed");
      setSeasonsMap(prev => {
        const next = { ...prev };
        const old  = next[season] || {};
        next[newName] = { ...old, label: newName, accent: newColor, accentMid: newColor + "88", accentLight: newColor + "1A" };
        if (newName !== season) delete next[season];
        return next;
      });
      setSeason(newName);
      setEditingName(false);
    } catch (err) { alert(err.message); setEditingName(false); }
  };

  const rawCfg = seasonsMap[season] || {};
  const cfg = {
    label: rawCfg.label || season,
    Icon: rawCfg.Icon || Database,
    accent: rawCfg.accent || "#4b5563",
    accentLight: rawCfg.accentLight || "#f3f4f6",
    accentMid: rawCfg.accentMid || "#e5e7eb",
    tagline: rawCfg.tagline || "",
  };
  const meta = data?.season;
  const existingNames = Object.keys(seasonsMap);

  const renderTab = () => {
    if (loading) return <LoadingSpinner accent={cfg.accent} />;
    if (error)   return <ErrorBox message={error} />;
    if (!data)   return null;
    switch (tab) {
      case "homepage":  return <HomepageRanking data={data.homepage_ranking} cfg={cfg} />;
      case "bundles":   return <TopBundles data={data.top_bundles} cfg={cfg} />;
      case "rules":     return <AssociationRules data={data.top_rules} cfg={cfg} />;
      case "fbt":       return <FrequentlyBoughtTogether data={data.frequently_bought_together} cfg={cfg} />;
      case "promo":     return <PromoGenerator data={data.promo_recommendations} cfg={cfg} />;
      case "crosssell": return <CrossSellSim allItems={data.all_items.map(i => i.item)} season={season} cfg={cfg} />;
      case "shelf":     return <ShelfPlacement data={data.shelf_placement} cfg={cfg} />;
      case "drift":     return <DriftReport data={data.drift_report} cfg={cfg} />;
      case "versions":  return <VersionCache data={versions} />;
      default: return null;
    }
  };

  if (appMode === "loading") return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <Loader size={32} color="#9ca3af" style={{ animation: "spin 1s linear infinite" }} />
      <style>{`@keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} }`}</style>
    </div>
  );

  if (appMode === "gateway") return <Gateway onStart={handleInitEngine} />;

  return (
    <div style={{ minHeight: "100vh", background: "#f9fafb", fontFamily: "ui-sans-serif, system-ui, -apple-system, sans-serif", color: "#111827" }}>
      <style>{`* { box-sizing: border-box; margin: 0; padding: 0; } button { cursor: pointer; } @keyframes spin { from{transform:rotate(0deg)}to{transform:rotate(360deg)} } ::-webkit-scrollbar{height:4px;width:4px} ::-webkit-scrollbar-thumb{background:#d1d5db;border-radius:99px}`}</style>

      {/* Upload Modal */}
      <UploadModal
        show={showUploadModal}
        onClose={() => setShowUploadModal(false)}
        onUpload={handleUpload}
        existingNames={existingNames}
        themeColor={modalThemeColor}
        setThemeColor={setModalThemeColor}
      />

      {/* Upload loading overlay */}
      {uploadLoading && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(255,255,255,0.85)", zIndex: 9999, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12 }}>
          <Loader size={28} color="#4b5563" style={{ animation: "spin 1s linear infinite" }} />
          <span style={{ fontSize: 14, fontWeight: 600, color: "#4b5563" }}>Analyzing dataset & computing drift...</span>
        </div>
      )}

      {/* TOPBAR */}
      <div style={{ background: "#fff", borderBottom: "1px solid #e5e7eb", padding: "0 24px" }}>
        <div style={{ maxWidth: 960, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", height: 56 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 30, height: 30, borderRadius: 6, background: cfg.accent, display: "flex", alignItems: "center", justifyContent: "center" }}>
              <BarChart2 size={16} color="#fff" />
            </div>
            <div>
              <div style={{ fontSize: 15, fontWeight: 700, color: "#111827", letterSpacing: "-0.01em" }}>MediCart</div>
              <div style={{ fontSize: 10, color: "#9ca3af", letterSpacing: "0.06em", textTransform: "uppercase" }}>Seasonal MBA Engine</div>
            </div>
          </div>
          <div style={{ display: "flex", gap: 4, flexWrap: "wrap", justifyContent: "flex-end", alignItems: "center" }}>
            {Object.entries(seasonsMap).map(([key, s]) => {
              const active = season === key;
              return (
                <button key={key} onClick={() => { setSeason(key); setTab("homepage"); }}
                  style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 12px", borderRadius: 6, border: `1px solid ${active ? s.accentMid : "#e5e7eb"}`, background: active ? s.accentLight : "#fff", color: active ? s.accent : "#6b7280", fontSize: 13, fontWeight: active ? 700 : 500 }}>
                  <s.Icon size={13} />{key}
                </button>
              );
            })}
            <div style={{ width: 1, height: 24, background: "#e5e7eb", margin: "0 4px" }} />
            <button onClick={() => {
              setModalThemeColor(paletteColor(Object.keys(seasonsMap).length));
              setShowUploadModal(true);
            }}
              style={{ display: "flex", alignItems: "center", gap: 6, padding: "6px 14px", borderRadius: 6, border: "none", background: "#111827", color: "#fff", fontSize: 13, fontWeight: 600 }}>
              <Plus size={14} /> Upload Dataset
            </button>
            <button
              title="Reset"
              onClick={() => {
                if (!window.confirm("Reset MediCart? This will delete all datasets and start over.")) return;
                fetch(`${API}/reset`, { method: "POST" }).then(() => {
                  setSeasonsMap({});
                  setSeason("Base");
                  setData(null);
                  setVersions([]);
                  setAppMode("gateway");
                });
              }}
              style={{ display: "flex", alignItems: "center", justifyContent: "center", width: 32, height: 32, borderRadius: 6, border: "1px solid #e5e7eb", background: "#fff", color: "#9ca3af" }}
            >
              <X size={14} />
            </button>
          </div>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: 24 }}>

        {/* SEASON HERO */}
        <div style={{ padding: "16px 20px", borderRadius: 10, border: `1px solid ${cfg.accentMid}`, background: cfg.accentLight, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 12 }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                <cfg.Icon size={18} color={cfg.accent} />
                {editingName ? (
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input autoFocus value={editNameValue} onChange={e => setEditNameValue(e.target.value)} onKeyDown={e => e.key === "Enter" && handleRename()}
                      style={{ fontSize: 17, fontWeight: 700, color: "#111827", border: `1px solid ${cfg.accent}`, borderRadius: 4, padding: "2px 6px", outline: "none", width: 180 }} />
                    <label style={{ width: 26, height: 26, borderRadius: 4, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", background: editThemeValue, border: "1px solid #d1d5db" }}>
                      <input type="color" value={editThemeValue} onChange={e => setEditThemeValue(e.target.value)} style={{ opacity: 0, width: 0, height: 0, position: "absolute" }} />
                    </label>
                    <button onClick={handleRename} style={{ background: cfg.accent, color: "#fff", border: "none", padding: "4px 10px", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>Save</button>
                    <button onClick={() => setEditingName(false)} style={{ background: "#f3f4f6", color: "#4b5563", border: "none", padding: "4px 10px", borderRadius: 4, fontSize: 12, fontWeight: 600 }}>Cancel</button>
                  </div>
                ) : (
                  <>
                    <span style={{ fontSize: 17, fontWeight: 700, color: "#111827" }}>{cfg.label}</span>
                    <button onClick={() => { setEditNameValue(season); setEditThemeValue(cfg.accent); setEditingName(true); }} style={{ background: "transparent", border: "none", color: "#9ca3af", cursor: "pointer", display: "flex" }}>
                      <Edit2 size={14} />
                    </button>
                  </>
                )}
                {meta && <span style={{ fontSize: 11, fontWeight: 600, color: cfg.accent, background: "#fff", border: `1px solid ${cfg.accentMid}`, padding: "1px 7px", borderRadius: 99 }}>Iteration #{meta.iteration}</span>}
              </div>
              <p style={{ fontSize: 12, color: "#6b7280" }}>{cfg.tagline}</p>
            </div>
            {meta && (
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {[["Transactions", Number(meta.n_transactions).toLocaleString()], ["Itemsets", meta.n_itemsets], ["Rules", meta.n_rules], ["Method", meta.method], ["MinSup", pct(meta.minsup)], ["MinConf", pct(meta.minconf)]].map(([label, val]) => (
                  <StatBox key={label} label={label} value={val} accent={cfg.accent} />
                ))}
              </div>
            )}
          </div>

        </div>

        {/* TABS */}
        <div style={{ display: "flex", gap: 2, marginBottom: 16, overflowX: "auto", paddingBottom: 2 }}>
          {TABS.map(({ id, label, Icon: TabIcon }) => {
            const active = tab === id;
            return (
              <button key={id} onClick={() => setTab(id)}
                style={{ display: "flex", alignItems: "center", gap: 5, padding: "7px 12px", borderRadius: 6, whiteSpace: "nowrap", border: `1px solid ${active ? cfg.accentMid : "#e5e7eb"}`, background: active ? cfg.accentLight : "#fff", color: active ? cfg.accent : "#6b7280", fontSize: 12, fontWeight: active ? 700 : 500 }}>
                <TabIcon size={12} />{label}
              </button>
            );
          })}
        </div>

        {/* CONTENT */}
        <div style={{ padding: 20, borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff", minHeight: 300 }}>
          {renderTab()}
        </div>

        {/* SELF-LEARNING FOOTER */}
        <div style={{ marginTop: 16, padding: "14px 16px", borderRadius: 10, border: "1px solid #e5e7eb", background: "#fff" }}>
          <div style={{ fontSize: 11, fontWeight: 700, color: "#374151", textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 10, display: "flex", alignItems: "center", gap: 6 }}>
            <Layers size={13} color={cfg.accent} />Self-Learning Mechanisms
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            {[
              ["Auto-Threshold", "Search over minsup/minconf space targeting ~30 rules and ~50 itemsets per iteration"],
              ["Composite Rule Scoring", "Weighted score: Lift × 0.4 + Confidence × 0.35 + Support × 0.25"],
              ["Drift Detection", "Compares rule sets across datasets"],
              ["Version Caching", "Each iteration's model and thresholds are stored for cross-dataset comparison"],
            ].map(([title, desc]) => (
              <div key={title} style={{ fontSize: 12, color: "#6b7280", lineHeight: 1.6 }}>
                <span style={{ fontWeight: 700, color: cfg.accent }}>{title} — </span>{desc}
              </div>
            ))}
          </div>
        </div>

        <p style={{ textAlign: "center", fontSize: 11, color: "#d1d5db", marginTop: 16, letterSpacing: "0.05em" }}>
          MediCart · FP-Growth + Apriori · SQLite backend · Flask API
        </p>
      </div>
    </div>
  );
}
