import { createServer } from "node:http";
import { cookable, save } from "./recipes.ts";

const json = (body: unknown) => JSON.stringify(body);

createServer(async (req, res) => {
  const url = new URL(req.url ?? "/", "http://localhost");
  res.setHeader("content-type", "application/json");

  if (req.method === "GET" && url.pathname === "/recipes") {
    const have = url.searchParams.get("with")?.split(",") ?? [];
    return res.end(json(cookable(have)));
  }

  if (req.method === "POST" && url.pathname === "/recipes") {
    let body = "";
    for await (const chunk of req) body += chunk;
    res.statusCode = 201;
    return res.end(json(save(JSON.parse(body))));
  }

  res.statusCode = 404;
  res.end(json({ error: "Not found" }));
}).listen(3000);
