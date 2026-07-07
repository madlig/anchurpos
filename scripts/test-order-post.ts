import { config } from "dotenv";
config({ path: ".env.local" });

import { NextRequest } from "next/server";
import { POST } from "../app/api/orders/route";

async function run() {
  const req = new NextRequest("http://localhost:3000/api/orders", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-debug-bypass-auth": "true" // Note: we're bypassing auth middleware in test if possible, but actually we can't easily. 
    },
    body: JSON.stringify({
      customerName: "Walk-in",
      source: "walk_in",
      orderChannel: "walkin",
      items: [
        {
          productId: "churros-frozen-regular",
          variantId: "original",
          qty: 10,
          sauceId: "saus-tiramisu",
          sauceName: "Tiramisu"
        }
      ]
    })
  });

  const res = await POST(req);
  const text = await res.text();
  console.log("STATUS:", res.status);
  console.log("RESPONSE:", text);
}

run().catch(console.error);
