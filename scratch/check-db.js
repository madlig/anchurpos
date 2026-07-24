const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore } = require('firebase-admin/firestore');

const serviceAccount = require('./serviceAccountKey.json'); // Wait, I don't have the key here easily. 

// I can just write a quick Next.js script or use grep in the source code if there's seed data.
