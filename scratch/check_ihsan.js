const { adminDb } = require('./lib/firebase-admin');

async function checkIhsan() {
  const empId = "hB7V9a4c0h4Y8lZ9jW3b"; // I don't know Ihsan's ID, I need to fetch it first.
  const users = await adminDb.collection("users").where("name", "==", "Ihsan").get();
  if (users.empty) {
    console.log("Ihsan not found");
    return;
  }
  const ihsanId = users.docs[0].id;
  console.log("Ihsan ID:", ihsanId);

  const snap = await adminDb.collection("attendance")
    .where("employeeId", "==", ihsanId)
    .where("date", ">=", "2026-06-26")
    .where("date", "<=", "2026-07-28")
    .get();

  const records = snap.docs.map(d => d.data());
  records.sort((a, b) => a.date.localeCompare(b.date));
  
  console.log(`Found ${records.length} records:`);
  records.forEach(r => {
    console.log(`${r.date} | Status: ${r.status} | Total Hours: ${r.totalHours} | Flag: ${r.flaggedReason || 'none'}`);
  });
}

checkIhsan().then(() => process.exit(0));
