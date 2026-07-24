import { NextRequest, NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { verifyAuth, requireRole } from "@/lib/auth-middleware";
import type { WorkOrder } from "@/types";

export async function GET(req: NextRequest) {
  const auth = await verifyAuth(req);
  if (!auth) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const url = new URL(req.url);
  const statusFilter = url.searchParams.get("status");
  const dateFilter = url.searchParams.get("date"); // YYYY-MM-DD
  const limitParam = url.searchParams.get("limit") || "50";

  try {
    let query: FirebaseFirestore.Query = adminDb.collection("tasks");

    if (auth.role === "crew") {
      query = query.where("assignedRole", "in", ["crew", "all"]);
    }

    if (statusFilter) {
      query = query.where("status", "==", statusFilter);
    }
    
    query = query.orderBy("createdAt", "desc").limit(parseInt(limitParam, 10));

    const snap = await query.get();
    let tasks = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as WorkOrder[];

    if (dateFilter) {
      tasks = tasks.filter(t => t.createdAt.startsWith(dateFilter));
    }

    if (!statusFilter) {
      tasks.sort((a, b) => {
        if (a.status === "pending" && b.status === "done") return -1;
        if (a.status === "done" && b.status === "pending") return 1;
        return 0;
      });
    }

    return NextResponse.json(tasks);
  } catch (error: any) {
    console.error("GET Tasks error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireRole(req, ["owner", "manager"]);
  if (auth instanceof NextResponse) return auth;
  const user = auth;

  try {
    const data = await req.json();
    const { type, title, description, assignedRole, productionData, packingData } = data;

    if (!type || !title) {
      return NextResponse.json({ error: "Data tugas tidak lengkap" }, { status: 400 });
    }

    const newTask: Omit<WorkOrder, "id"> = {
      type,
      title,
      description: description || "",
      assignedRole: assignedRole || "crew",
      status: "pending",
      createdBy: user.uid,
      createdAt: new Date().toISOString(),
      ...(productionData && { productionData }),
      ...(packingData && { packingData }),
    };

    const docRef = await adminDb.collection("tasks").add(newTask);
    return NextResponse.json({ id: docRef.id, ...newTask });
  } catch (error: any) {
    console.error("POST Tasks error:", error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
