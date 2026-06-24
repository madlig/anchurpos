import httpx
from fastapi import FastAPI, Request
from fastapi.responses import Response
import asyncio

app = FastAPI()
NEXT_BASE = "http://localhost:3000"

@app.api_route("/{path:path}", methods=["GET","POST","PUT","PATCH","DELETE","OPTIONS"])
async def proxy(path: str, request: Request):
    url = f"{NEXT_BASE}/{path}"
    params = dict(request.query_params)
    headers = {k: v for k, v in request.headers.items() if k.lower() not in ("host", "content-length")}
    body = await request.body()
    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            resp = await client.request(
                method=request.method, url=url,
                headers=headers, content=body, params=params,
                follow_redirects=True,
            )
            return Response(
                content=resp.content,
                status_code=resp.status_code,
                headers=dict(resp.headers),
            )
    except Exception as e:
        return Response(content=str(e).encode(), status_code=502)
