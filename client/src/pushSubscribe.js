// Registers this device for push notifications and saves the subscription for
// the signed-in user, so server-sent alerts (fee reminders, posters, …) reach
// the phone even when the app is closed. Asks for permission only if the user
// hasn't decided yet; does nothing if notifications are blocked or unsupported.
import axios from "axios";

const PUBLIC_VAPID_KEY =
  "BC0ajb0fFmrJohj0JlE5fseL4l4BU2gNRP8cPkQXVlAaXw4W6uGAevDqLgrD9Qzy4-W-FQvR-DNf0ccmo0YYkmM";

function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export async function subscribeDeviceToPush(userId) {
  if (!userId) return false;
  if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
    return false;
  }
  if (Notification.permission === "denied") return false;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return false;

    const register = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    const subscription =
      (await register.pushManager.getSubscription()) ||
      (await register.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY),
      }));

    await axios.post("https://art-portal-7n6r.onrender.com/api/notifications/subscribe", {
      userId,
      subscription,
    });
    return true;
  } catch (err) {
    console.log("Push subscription skipped:", err.message);
    return false;
  }
}
