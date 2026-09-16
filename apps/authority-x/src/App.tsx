/**
 * AUTHORITY X — Floating Command UI
 * One solid unit · X right + rail expands left · drop expands under
 */

import { useEffect, useRef, useState } from "react";
import {
  buildExecutionLog,
  entityKindLabel,
  listHistory,
  pushHistory,
  type ScoredSuggestion,
} from "./engine";
import { prepareIntent } from "./engine/bridge";
import type { ResolvedEntity } from "./engine/types";
import {
  claimPairCode,
  clearDeviceAuth,
  getCachedDeviceAuth,
  verifyDeviceAuth,
} from "./device-auth";

type Phase =
  | "idle"
  | "input"
  | "suggestions"
  | "ambiguous"
  | "executing"
  | "awaiting_validation"
  | "success";

type WorkflowMode = "human" | "auto";

type LogKind = "success" | "running" | "processing" | "error";

type LogItem = {
  id: string;
  kind: LogKind;
  title: string;
  detail?: string;
  href?: string;
};

const AUTHORITY_URL =
  (import.meta as { env?: { VITE_AUTHORITY_URL?: string } }).env
    ?.VITE_AUTHORITY_URL ?? "http://127.0.0.1:3000";

export function App() {
  const [phase, setPhase] = useState<Phase>("idle");
  const [query, setQuery] = useState("");
  const [active, setActive] = useState(0);
  const [logs, setLogs] = useState<LogItem[]>([]);
  const [workflowMode, setWorkflowMode] = useState<WorkflowMode>("human");
  const [pickedEntity, setPickedEntity] = useState<ResolvedEntity | null>(null);
  const [selected, setSelected] = useState<ScoredSuggestion | null>(null);
  const [suggestions, setSuggestions] = useState<ScoredSuggestion[]>([]);
  const [ambiguousEntities, setAmbiguousEntities] = useState<ResolvedEntity[]>(
    [],
  );
  const [ambiguous, setAmbiguous] = useState(false);
  const [pairedName, setPairedName] = useState<string | null>(null);
  const [pairCode, setPairCode] = useState("");
  const [pairBusy, setPairBusy] = useState(false);
  const [pairError, setPairError] = useState<string | null>(null);
  const [openError, setOpenError] = useState<string | null>(null);
  const [isPreview, setIsPreview] = useState(true);
  const [appeared, setAppeared] = useState(false);
  const [spinning, setSpinning] = useState(false);
  const [recent, setRecent] = useState(() => listHistory());
  const inputRef = useRef<HTMLInputElement>(null);
  const logEndRef = useRef<HTMLDivElement>(null);
  const timersRef = useRef<number[]>([]);
  const queryEpoch = useRef(0);

  const open = phase !== "idle";
  const showSuggestions =
    (phase === "input" || phase === "suggestions") &&
    !ambiguous &&
    suggestions.length > 0;
  const showAmbiguous =
    (phase === "input" || phase === "suggestions" || phase === "ambiguous") &&
    ambiguous;
  const showRecent =
    open &&
    !query.trim() &&
    (phase === "input" || phase === "suggestions") &&
    recent.length > 0;
  const showLog =
    phase === "executing" ||
    phase === "awaiting_validation" ||
    phase === "success";
  const stepsClickable = showLog;
  const showPair =
    open &&
    !pairedName &&
    !query.trim() &&
    (phase === "input" || phase === "suggestions");
  const showPairedStatus =
    Boolean(pairedName) &&
    open &&
    !query.trim() &&
    phase === "input";
  const hasDrop =
    showRecent ||
    showAmbiguous ||
    showSuggestions ||
    showLog ||
    showPair ||
    showPairedStatus ||
    Boolean(openError);

  useEffect(() => {
    const t = window.setTimeout(() => setAppeared(true), 40);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    const unsubs: Array<() => void> = [];
    async function boot() {
      if (!window.authorityX) {
        setIsPreview(true);
        return;
      }
      setIsPreview(false);
      const ok = await verifyDeviceAuth();
      setPairedName(ok ? getCachedDeviceAuth()?.displayName ?? "OK" : null);
      unsubs.push(
        window.authorityX.onOpened(() => {
          setAppeared(true);
          expandFromOrb();
        }),
      );
    }
    void boot();
    return () => unsubs.forEach((u) => u());
  }, []);

  useEffect(() => {
    setActive(0);
    const epoch = ++queryEpoch.current;

    if (!query.trim()) {
      setSuggestions([]);
      setAmbiguous(false);
      setAmbiguousEntities([]);
      setPickedEntity(null);
      if (phase === "suggestions" || phase === "ambiguous") setPhase("input");
      return;
    }

    const ac = new AbortController();
    const timer = window.setTimeout(() => {
      void prepareIntent({
        raw: query,
        entity: pickedEntity,
        signal: ac.signal,
      }).then((res) => {
        if (epoch !== queryEpoch.current) return;
        setAmbiguous(res.ambiguous && !pickedEntity);
        setAmbiguousEntities(res.entities);
        setSuggestions(res.suggestions);
        if (res.ambiguous && !pickedEntity) setPhase("ambiguous");
        else if (res.suggestions.length > 0) setPhase("suggestions");
        else if (phase === "suggestions" || phase === "ambiguous")
          setPhase("input");
      });
    }, 160);

    return () => {
      ac.abort();
      window.clearTimeout(timer);
    };
  }, [query, pickedEntity]);

  useEffect(() => {
    if (phase === "input" || phase === "suggestions" || phase === "ambiguous") {
      const t = window.setTimeout(() => inputRef.current?.focus(), 280);
      return () => clearTimeout(t);
    }
  }, [phase]);

  useEffect(() => {
    logEndRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [logs]);

  function clearTimers() {
    timersRef.current.forEach((id) => window.clearTimeout(id));
    timersRef.current = [];
  }

  function spinOnce() {
    setSpinning(true);
    window.setTimeout(() => setSpinning(false), 420);
  }

  async function onClaimPair() {
    setPairBusy(true);
    setPairError(null);
    try {
      const auth = await claimPairCode(pairCode);
      setPairedName(auth.displayName);
      setPairCode("");
    } catch (err) {
      setPairError(err instanceof Error ? err.message : String(err));
    } finally {
      setPairBusy(false);
    }
  }

  async function onUnpair() {
    await clearDeviceAuth();
    setPairedName(null);
  }

  function expandFromOrb() {
    spinOnce();
    setPhase("input");
    setRecent(listHistory());
    setOpenError(null);
  }

  function collapseToIdle() {
    clearTimers();
    spinOnce();
    setPhase("idle");
    setQuery("");
    setLogs([]);
    setSelected(null);
    setPickedEntity(null);
    setActive(0);
    setOpenError(null);
  }

  async function closeFully() {
    collapseToIdle();
    if (window.authorityX) await window.authorityX.hide();
  }

  function onOrbClick() {
    if (phase === "idle") expandFromOrb();
    else if (
      phase === "input" ||
      phase === "suggestions" ||
      phase === "ambiguous"
    ) {
      collapseToIdle();
    }
  }

  async function openAuthority(path = "/") {
    const url = `${AUTHORITY_URL}${path.startsWith("/") ? path : `/${path}`}`;
    setOpenError(null);
    try {
      if (window.authorityX?.openAuthority) {
        const res = await window.authorityX.openAuthority(url);
        if (res?.ok) return;
      }
    } catch {
      /* fall through */
    }
    try {
      const win = window.open(url, "authority-soft-glass");
      if (win) {
        try {
          win.focus();
        } catch {
          /* ignore */
        }
        return;
      }
    } catch {
      /* ignore */
    }
    setOpenError(
      "AUTHORITY ne s’ouvre pas — lancez Soft Glass (npm run dev) sur :3000",
    );
  }

  function pickEntity(e: ResolvedEntity) {
    setPickedEntity(e);
    setPhase("suggestions");
    setActive(0);
  }

  function runExecution(s: ScoredSuggestion) {
    clearTimers();
    setSelected(s);
    setPhase("executing");
    setLogs([]);
    setOpenError(null);

    pushHistory({
      query: query.trim(),
      actionId: s.actionId,
      entityId: s.entity?.id ?? null,
    });
    setRecent(listHistory());

    const sequence = buildExecutionLog({
      query: query.trim() || "…",
      actionTitle: s.title,
      entity: s.entity,
      amount: s.amount,
      route: s.route,
    });

    sequence.forEach((step, i) => {
      const id = window.setTimeout(() => {
        setLogs((prev) => [
          ...prev,
          { ...step, id: `${s.id}-${i}-${step.title}` },
        ]);
        if (i === sequence.length - 1) {
          const done = window.setTimeout(() => {
            if (workflowMode === "human") setPhase("awaiting_validation");
            else {
              setPhase("success");
              void openAuthority(s.route);
            }
          }, 260);
          timersRef.current.push(done);
        }
      }, 300 + i * 400);
      timersRef.current.push(id);
    });
  }

  function confirmHumanValidation() {
    setPhase("success");
    if (selected) void openAuthority(selected.route);
  }

  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      if (phase === "suggestions" || phase === "ambiguous") {
        setQuery("");
        setPickedEntity(null);
        setPhase("input");
        return;
      }
      if (
        phase === "executing" ||
        phase === "awaiting_validation" ||
        phase === "success"
      ) {
        collapseToIdle();
        return;
      }
      if (phase === "input") {
        collapseToIdle();
        return;
      }
      void closeFully();
      return;
    }

    if (showAmbiguous) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setActive((i) => Math.min(i + 1, ambiguousEntities.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setActive((i) => Math.max(i - 1, 0));
      } else if (e.key === "Enter" && ambiguousEntities[active]) {
        e.preventDefault();
        pickEntity(ambiguousEntities[active]);
      }
      return;
    }

    if (phase !== "suggestions" && phase !== "input") return;

    if (e.key === "ArrowDown" && suggestions.length) {
      e.preventDefault();
      setPhase("suggestions");
      setActive((i) => Math.min(i + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp" && suggestions.length) {
      e.preventDefault();
      setActive((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && suggestions[active]) {
      e.preventDefault();
      runExecution(suggestions[active]);
    }
  }

  return (
    <div
      className={`ax-stage${isPreview ? " is-preview" : ""}`}
      onKeyDown={onKeyDown}
    >
      <div
        className={[
          "ax-unit",
          appeared ? "is-appeared" : "",
          spinning ? "is-spinning" : "",
          open ? "is-open" : "is-idle",
          hasDrop ? "has-drop" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <div className="ax-bar">
          <div className="ax-rail">
            <input
              ref={inputRef}
              className="ax-input"
              value={query}
              placeholder="Commande…"
              spellCheck={false}
              disabled={showLog}
              tabIndex={open ? 0 : -1}
              onChange={(e) => {
                setPickedEntity(null);
                setQuery(e.target.value);
                setOpenError(null);
              }}
              aria-autocomplete="list"
            />
            <div className="ax-modes" role="group" aria-label="Ouverture">
              <button
                type="button"
                className={`ax-mode-opt${workflowMode === "human" ? " is-on" : ""}`}
                onClick={() => setWorkflowMode("human")}
                title="Confirmer avant Soft Glass"
                tabIndex={open ? 0 : -1}
              >
                Valider
              </button>
              <button
                type="button"
                className={`ax-mode-opt${workflowMode === "auto" ? " is-on" : ""}`}
                onClick={() => setWorkflowMode("auto")}
                title="Ouvre Soft Glass automatiquement"
                tabIndex={open ? 0 : -1}
              >
                Direct
              </button>
            </div>
            <button
              type="button"
              className="ax-btn-authority"
              title="Ouvrir AUTHORITY Soft Glass"
              tabIndex={open ? 0 : -1}
              onClick={() => void openAuthority("/")}
            >
              Soft Glass
            </button>
          </div>

          <button
            type="button"
            className="ax-orb"
            aria-label={open ? "Réduire AUTHORITY X" : "Ouvrir AUTHORITY X"}
            aria-expanded={open}
            onClick={onOrbClick}
          >
            <span className="ax-orb-x">X</span>
          </button>
        </div>

        <div className={`ax-drop${hasDrop ? " is-open" : ""}`}>
          <div className="ax-drop-inner">
            {openError ? (
              <div className="ax-open-error">{openError}</div>
            ) : null}

            {showPair ? (
              <div className="ax-pair">
                <div className="ax-hint">Appairage Soft Glass</div>
                <p className="ax-pair-help">
                  Préférences → Poste → Générer un code, puis coller ici.
                </p>
                <div className="ax-pair-row">
                  <input
                    className="ax-pair-input"
                    value={pairCode}
                    placeholder="XXXX-XXXX"
                    spellCheck={false}
                    autoCapitalize="characters"
                    onChange={(e) => setPairCode(e.target.value.toUpperCase())}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        void onClaimPair();
                      }
                    }}
                  />
                  <button
                    type="button"
                    className="ax-btn-primary"
                    disabled={pairBusy || pairCode.trim().length < 8}
                    onClick={() => void onClaimPair()}
                  >
                    Lier
                  </button>
                </div>
                {pairError ? (
                  <div className="ax-open-error">{pairError}</div>
                ) : null}
                <button
                  type="button"
                  className="ax-btn-quiet"
                  onClick={() => void openAuthority("/settings#poste")}
                >
                  Ouvrir Préférences
                </button>
              </div>
            ) : null}

            {showPairedStatus ? (
              <div className="ax-pair-status">
                <span>API · {pairedName}</span>
                <button type="button" className="ax-btn-quiet" onClick={() => void onUnpair()}>
                  Délier
                </button>
              </div>
            ) : null}

            {showRecent ? (
              <>
                <div className="ax-hint">Récent</div>
                {recent.slice(0, 6).map((h) => (
                  <button
                    key={h.id}
                    type="button"
                    className="ax-item"
                    onClick={() => {
                      setQuery(h.query);
                      setPickedEntity(null);
                    }}
                  >
                    <span className="ax-item-icon">↻</span>
                    <span className="ax-item-body">
                      <span className="ax-item-title">{h.query}</span>
                      <span className="ax-item-desc">{h.actionId}</span>
                    </span>
                  </button>
                ))}
              </>
            ) : null}

            {showAmbiguous ? (
              <>
                <div className="ax-hint">Plusieurs correspondances</div>
                {ambiguousEntities.map((e, idx) => (
                  <button
                    key={e.id}
                    type="button"
                    role="option"
                    aria-selected={idx === active}
                    className={`ax-item${idx === active ? " is-active is-primary" : ""}`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => pickEntity(e)}
                  >
                    <span className="ax-item-icon">○</span>
                    <span className="ax-item-body">
                      <span className="ax-item-title">{e.label}</span>
                      <span className="ax-item-desc">
                        {entityKindLabel(e.kind)}
                      </span>
                    </span>
                    {idx === active ? (
                      <span className="ax-item-chevron">›</span>
                    ) : null}
                  </button>
                ))}
              </>
            ) : null}

            {showSuggestions ? (
              <>
                <div className="ax-hint">Actions</div>
                {suggestions.map((s, idx) => (
                  <button
                    key={s.id}
                    type="button"
                    role="option"
                    aria-selected={idx === active}
                    className={`ax-item${idx === active ? " is-active" : ""}${
                      s.relevance === "high" ? " is-primary" : ""
                    }`}
                    onMouseEnter={() => setActive(idx)}
                    onClick={() => runExecution(s)}
                  >
                    <span className="ax-item-icon" aria-hidden>
                      {s.icon}
                    </span>
                    <span className="ax-item-body">
                      <span className="ax-item-title">
                        {s.title}
                        {s.relevance === "high" ? (
                          <span className="ax-badge">Top</span>
                        ) : null}
                      </span>
                      <span className="ax-item-desc">{s.description}</span>
                    </span>
                    {idx === active ? (
                      <span className="ax-item-chevron" aria-hidden>
                        ›
                      </span>
                    ) : null}
                  </button>
                ))}
              </>
            ) : null}

            {showLog ? (
              <div className="ax-log">
                <div className="ax-hint">Étapes — clic = Soft Glass</div>
                {logs.map((item, i) => {
                  const clickable = Boolean(stepsClickable && item.href);
                  const Tag = clickable ? "button" : "div";
                  return (
                    <Tag
                      key={item.id}
                      type={clickable ? "button" : undefined}
                      className={`ax-log-item is-${item.kind}${
                        clickable ? " is-clickable" : ""
                      }`}
                      onClick={
                        clickable
                          ? () => void openAuthority(item.href!)
                          : undefined
                      }
                    >
                      <div className="ax-log-rail" aria-hidden>
                        <span className="ax-log-dot">
                          {item.kind === "success"
                            ? "✓"
                            : item.kind === "processing"
                              ? "→"
                              : item.kind === "error"
                                ? "!"
                                : "•"}
                        </span>
                        {i < logs.length - 1 || phase === "executing" ? (
                          <span className="ax-log-line" />
                        ) : null}
                      </div>
                      <div className="ax-log-body">
                        <div className="ax-log-title">
                          {item.title}
                          {clickable ? (
                            <span className="ax-log-link">Ouvrir ›</span>
                          ) : null}
                        </div>
                        {item.detail ? (
                          <div className="ax-log-detail">{item.detail}</div>
                        ) : null}
                        {clickable && item.href ? (
                          <div className="ax-log-path">{item.href}</div>
                        ) : null}
                      </div>
                    </Tag>
                  );
                })}
                <div ref={logEndRef} />

                {phase === "awaiting_validation" ? (
                  <div className="ax-ready">
                    <div className="ax-ready-title">Confirmation</div>
                    <div className="ax-ready-desc">
                      Ouvrir AUTHORITY Soft Glass maintenant ?
                    </div>
                    <div className="ax-validate-actions">
                      <button
                        type="button"
                        className="ax-btn-quiet"
                        onClick={collapseToIdle}
                      >
                        Annuler
                      </button>
                      <button
                        type="button"
                        className="ax-btn-primary"
                        onClick={confirmHumanValidation}
                      >
                        Ouvrir AUTHORITY
                      </button>
                    </div>
                  </div>
                ) : null}

                {phase === "success" ? (
                  <div className="ax-ready">
                    <div className="ax-ready-title">✓ Prêt</div>
                    <div className="ax-ready-desc">
                      Soft Glass doit tourner sur http://127.0.0.1:3000
                    </div>
                    <button
                      type="button"
                      className="ax-btn-primary ax-btn-block"
                      onClick={() => void openAuthority(selected?.route ?? "/")}
                    >
                      Ouvrir AUTHORITY
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
