import { getApp, getApps, initializeApp } from 'firebase/app';
import { getMessaging, getToken, isSupported, onMessage } from 'firebase/messaging';

import { adminRequest } from './adminApi';

// Firebase web-app configuration identifies the public client application; it
// is not a server credential. The private FCM service account remains API-only.
const firebaseConfig = {
  apiKey: 'AIzaSyAySv6y3wABXJ8a4KrON6sKFGZr6hF3OHM',
  authDomain: 'c2coffeeandcandle.firebaseapp.com',
  projectId: 'c2coffeeandcandle',
  storageBucket: 'c2coffeeandcandle.firebasestorage.app',
  messagingSenderId: '1090758125150',
  appId: '1:1090758125150:web:bacab6aad94b31aa36b6cf',
};

const vapidKey = String(import.meta.env.VITE_FIREBASE_VAPID_KEY || '').trim();
let foregroundUnsubscribe = null;
let alertAudioContext = null;

function getAlertAudioContext() {
  if (alertAudioContext || typeof window === 'undefined') return alertAudioContext;
  const AudioContextConstructor = window.AudioContext || window.webkitAudioContext;
  if (!AudioContextConstructor) return null;
  alertAudioContext = new AudioContextConstructor();
  return alertAudioContext;
}

// Browsers require a user interaction before allowing sound. Calling this from
// the alert-enable action primes the chime for later incoming orders.
export async function primeOrderAlertSound() {
  const audioContext = getAlertAudioContext();
  if (audioContext?.state === 'suspended') {
    await audioContext.resume();
  }
}

export function playOrderAlertSound() {
  const audioContext = getAlertAudioContext();
  if (!audioContext || audioContext.state !== 'running') return;

  const oscillator = audioContext.createOscillator();
  const gain = audioContext.createGain();
  oscillator.type = 'sine';
  oscillator.frequency.setValueAtTime(880, audioContext.currentTime);
  oscillator.frequency.setValueAtTime(1175, audioContext.currentTime + 0.13);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.18, audioContext.currentTime + 0.015);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.34);
  oscillator.connect(gain).connect(audioContext.destination);
  oscillator.start();
  oscillator.stop(audioContext.currentTime + 0.35);
}

function setupStatus(status, message) {
  return { status, message };
}

function canUseBrowserPush() {
  return typeof window !== 'undefined'
    && 'Notification' in window
    && 'serviceWorker' in navigator
    && window.isSecureContext;
}

async function getSupportedMessaging() {
  if (!canUseBrowserPush()) return null;
  return (await isSupported()) ? getMessaging(getApps().length > 0 ? getApp() : initializeApp(firebaseConfig)) : null;
}

function attachForegroundHandler(messaging, onOrderAlert) {
  foregroundUnsubscribe?.();
  foregroundUnsubscribe = onMessage(messaging, (payload) => {
    const title = payload.notification?.title || payload.data?.notification_title || 'New order to prepare';
    const body = payload.notification?.body || payload.data?.notification_body || 'A paid pickup order is waiting in the queue.';
    playOrderAlertSound();
    onOrderAlert?.();
    if (Notification.permission === 'granted') {
      new Notification(title, { body });
    }
  });
}

/**
 * Registers the current authenticated barista browser and listens for order
 * alerts while the console is open. Permission is only prompted from a click.
 */
export async function registerBaristaBrowserPush({ requestPermission = false, onOrderAlert } = {}) {
  if (!canUseBrowserPush()) {
    return setupStatus('unsupported', 'Browser alerts require HTTPS and a supported browser.');
  }
  if (!vapidKey) {
    return setupStatus('configuration', 'Browser alerts are awaiting Firebase Web Push configuration.');
  }
  if (Notification.permission === 'denied') {
    return setupStatus('blocked', 'Browser alerts are blocked. Allow notifications in this browser site settings.');
  }
  if (Notification.permission !== 'granted' && !requestPermission) {
    return setupStatus('ready', 'Enable browser alerts so new paid orders appear immediately.');
  }

  if (Notification.permission !== 'granted') {
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      return setupStatus('blocked', 'Browser alerts were not enabled. You can allow them later in site settings.');
    }
  }

  const messaging = await getSupportedMessaging();
  if (!messaging) {
    return setupStatus('unsupported', 'This browser does not support Firebase browser alerts.');
  }

  const serviceWorkerRegistration = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
  await navigator.serviceWorker.ready;
  const pushToken = await getToken(messaging, { vapidKey, serviceWorkerRegistration });
  if (!pushToken) {
    return setupStatus('error', 'Browser alerts could not be registered. Please try again.');
  }

  await adminRequest('/v1/admin/devices/push-token', {
    method: 'POST',
    body: JSON.stringify({ platform: 'web', push_token: pushToken }),
  });
  attachForegroundHandler(messaging, onOrderAlert);
  return setupStatus('enabled', 'Browser alerts are on for this barista console.');
}

export function stopBaristaBrowserPush() {
  foregroundUnsubscribe?.();
  foregroundUnsubscribe = null;
}
