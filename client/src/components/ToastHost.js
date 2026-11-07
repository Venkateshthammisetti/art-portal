import React, { useEffect, useRef, useState } from "react";
import { TOAST_EVENT } from "../utils/notify";
import "./ToastHost.css";

// Stacked, auto-dismissing toasts with an optional Retry button. Errors stay
// longer (and stay while a Retry is offered) so they can't be missed.
const ToastHost = () => {
  const [toasts, setToasts] = useState([]);
  const nextId = useRef(1);
  const timers = useRef({});

  const dismiss = (id) => {
    clearTimeout(timers.current[id]);
    delete timers.current[id];
    setToasts((list) => list.filter((t) => t.id !== id));
  };

  useEffect(() => {
    const onToast = (e) => {
      const id = nextId.current++;
      const { message, type, retry, action, duration } = e.detail || {};
      setToasts((list) => [...list.slice(-3), { id, message, type, retry, action }]);
      const ms = duration ?? (retry || action ? 8000 : type === "error" ? 6000 : 3500);
      timers.current[id] = setTimeout(() => dismiss(id), ms);
    };
    window.addEventListener(TOAST_EVENT, onToast);
    const live = timers.current;
    return () => {
      window.removeEventListener(TOAST_EVENT, onToast);
      Object.values(live).forEach(clearTimeout);
    };
  }, []);

  if (!toasts.length) return null;
  return (
    <div className="toast-host" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast-item ${t.type}`} role={t.type === "error" ? "alert" : "status"}>
          <span className="toast-msg">{t.message}</span>
          {t.retry && (
            <button type="button" className="toast-btn" onClick={() => { dismiss(t.id); t.retry(); }}>Retry</button>
          )}
          {t.action && (
            <button type="button" className="toast-btn" onClick={() => { dismiss(t.id); t.action.onClick(); }}>{t.action.label}</button>
          )}
          <button type="button" className="toast-close" aria-label="Dismiss" onClick={() => dismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
};

export default ToastHost;
