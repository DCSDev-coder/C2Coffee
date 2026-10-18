/* global firebase */
// This file must remain in public/ because FCM requires a root-scoped worker.
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/12.19.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: 'AIzaSyAySv6y3wABXJ8a4KrON6sKFGZr6hF3OHM',
  authDomain: 'c2coffeeandcandle.firebaseapp.com',
  projectId: 'c2coffeeandcandle',
  storageBucket: 'c2coffeeandcandle.firebasestorage.app',
  messagingSenderId: '1090758125150',
  appId: '1:1090758125150:web:bacab6aad94b31aa36b6cf',
});

// Initialising Messaging in this root-scoped worker lets FCM render the
// standard notification payload while the console is in another tab or closed.
firebase.messaging();
