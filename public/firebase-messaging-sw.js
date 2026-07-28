importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyABNuH2Rw3mB_Ip-hacwuiDrNFyj_UZoAw",
  authDomain: "anchurpos.firebaseapp.com",
  projectId: "anchurpos",
  storageBucket: "anchurpos.firebasestorage.app",
  messagingSenderId: "804528216780",
  appId: "1:804528216780:web:4788bbe08ae90df8620069"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  
  const notificationTitle = payload.notification?.title || "Instruksi Baru";
  const notificationOptions = {
    body: payload.notification?.body || "Anda mendapatkan instruksi baru dari Manager.",
    icon: '/logo.png',
    badge: '/logo.png',
    data: payload.data,
    vibrate: [200, 100, 200, 100, 200, 100, 200]
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});
