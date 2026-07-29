const admin = require('firebase-admin');

admin.initializeApp({
  credential: admin.credential.cert({
    projectId: "anchurpos",
    clientEmail: "firebase-adminsdk-fbsvc@anchurpos.iam.gserviceaccount.com",
    privateKey: "-----BEGIN PRIVATE KEY-----\nMIIEvQIBADANBgkqhkiG9w0BAQEFAASCBKcwggSjAgEAAoIBAQC+MZMhBzNTUAJz\n6xlMXvlDrEeanpPF2dTvbSwMa3xQ+YtmZGmepfB7nCn4dBeBHX7kFda7ecAbv+T6\nMi3ch/tsmClgMV9tWTeTOmp0g0X7NyAQqcqEh5EIBULQIq8+oAcNbonT/k1S4MhO\n2a/Fyk40/JtTfnt7hZYN/mpHYPweYRBaUbucGovGPUbhKxcjc0o2F2v6V9GcAvMO\nFv2ODSUXADpE6r4ibvsF2Eknky0yHrRpHvfWBLVL2SsQSM06ORj9FNBgxu6gF5hU\nS41o1jBkEU1VvrczLEJjpBAz84WksP3137GslUTo1ZnIEk6kYGvO9LEwIXnO+o2N\nxpjeEChjAgMBAAECggEAAiDRN1AP+vas5a8pG/mpawsad1h0PtqDz3S2nCJNGdAx\nByGd15tJEu5ZvzX4ArHZzE4864wejNubgaaIwixOBpZioCOX9cPxzevxalcDCXSX\nH0NHHi8w0u4mzpK/c0FHKEH8Y4A3op3GoAXqOZmx66synGnl59Pu1z6UNzLr9KBh\nzMs6dJIuPHoIyxnl/lRK7lzoJqUfKWGLGrE6e2y7a17BrbO+w3Otm00LhYan3LOv\nWaWKxgyYeZbBDlMiZLog/dirogTnxcPZQMKPBdjZBZe74LZzczAHuMX873Fsk4MU\nNY0MNWCaMz35SYb9uyUvGXQebVDCZKQMTQUEILh1AQKBgQDvSHWo+szdnaOz3zmp\njA28cfcSbRcB0ru0z7QmhxMeZTyW/RPqqUvBHb9oY2QK5ufUndDKXYmfqs2foaGT\n41KESfNbeMrt6VKTZRflFSr5PW+i5P+YK359EaU6ccLjN0ZY0O8GYwJz42Y7wlXw\npwGayTsJlglGTbTgpIi3OSEe0QKBgQDLeyirXoV8W7SXuy9quByAvLxUlpVb8f3/\nUzckh7dneSZp3p1poT7IsS3E31nvyJRpkb40mFoWQ0rapfnS/OK5A4oiDBoY6pE7\nLhqZSmenZ4gElSuD7VRRm2fljMUblZDo4XnUVO1DHKWkA8bdtZqKv7bnVX3FomXt\ns7hcYito8wKBgQCMm6jAXnhqNgsPVLo+nlUoClQkmMQvRxUUQAVdqnwanWTIWPkO\nKOOiHIfwoI8WNO/AKeiaMfMAR09DYahgDfHcWNRPSSD+QuBKStqKvDCfe3GRaD2l\nvtE6T1cni9f4yu9km4oJ176GOPdHYIA9xPWVbnBpxqe2j00dwLGx8Tk8MQKBgBVo\nZLP64tJdl5drEycILb+Bm9LOcPJWeGGXcLLAMJSLU3ZJ/IezdjaJJYaT9RNcJ/kf\nY0KHUNsMw2BTnAANqRDMBYlleo1qiFMQm63K/TLImq/YvdZIbtmTHxAwikBHsRI/\nPqEPOlMYPXkPCKokxBia6PRXsz7KwiyK/veBQI3vAoGACjTS0e0bNyD9KXvYt+x4\nv+OrhthSLp6co3xgawyvO75r9BzbMxnrZeAm2wuq8dDKfq3Plrx+m8xquq2lWMGR\noWGy8CGd/E0PbMrXUK0hKVQ9TAU8ZWTkVW3EzP5OGuNi91/1bNSZI76XmntExYT8\n+8KtmzSqx6XTibdjrxh/DLM=\n-----END PRIVATE KEY-----\n"
  })
});

const db = admin.firestore();

async function seedPackagingRecipes() {
  const batch = db.batch();

  // Clear existing
  const snap = await db.collection("packagingRecipes").get();
  snap.docs.forEach(d => batch.delete(d.ref));

  // Churros Frozen Regular (Thinwall 500ml or Plastik Regular + Stiker Label)
  const reg1 = db.collection("packagingRecipes").doc();
  batch.set(reg1, {
    productId: "churros-frozen-regular",
    ingredientId: "plastik-regular",
    qtyPerPack: 1,
    unit: "pcs",
    createdAt: new Date()
  });

  const reg2 = db.collection("packagingRecipes").doc();
  batch.set(reg2, {
    productId: "churros-frozen-regular",
    ingredientId: "stiker-label",
    qtyPerPack: 1,
    unit: "lembar",
    createdAt: new Date()
  });

  // Churros Frozen Full
  const full1 = db.collection("packagingRecipes").doc();
  batch.set(full1, {
    productId: "churros-frozen-full",
    ingredientId: "plastik-full",
    qtyPerPack: 1,
    unit: "pcs",
    createdAt: new Date()
  });

  const full2 = db.collection("packagingRecipes").doc();
  batch.set(full2, {
    productId: "churros-frozen-full",
    ingredientId: "stiker-label",
    qtyPerPack: 1,
    unit: "lembar",
    createdAt: new Date()
  });

  await batch.commit();
  console.log("Seeded initial packaging recipes successfully.");
}

seedPackagingRecipes().then(() => process.exit(0)).catch(err => { console.error(err); process.exit(1); });
