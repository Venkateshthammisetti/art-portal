// Tiny app-wide toast helper, used instead of window.alert().
//   notify.success("Saved"), notify.error("Couldn't save", { retry: () => save() })
// <ToastHost /> (components/ToastHost.js) renders them; mount it once per dashboard.
const EVT = "app-toast";
const send = (message, type, opts = {}) => {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(EVT, { detail: { message: String(message), type, retry: opts.retry || null, duration: opts.duration } }));
};
const notify = {
  success: (m, o) => send(m, "success", o),
  error: (m, o) => send(m, "error", o),
  info: (m, o) => send(m, "info", o),
};
export const TOAST_EVENT = EVT;
export default notify;
