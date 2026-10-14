import http from "node:http";
import { URL } from "node:url";
import handler from "../.output/server/index.mjs";

const port = Number(process.env.PORT ?? 3000);
const host = process.env.HOST ?? "0.0.0.0";

const readBody = async (request) => {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  return chunks.length ? Buffer.concat(chunks) : undefined;
};

const server = http.createServer(async (request, response) => {
  try {
    const body = ["GET", "HEAD"].includes(request.method ?? "GET")
      ? undefined
      : await readBody(request);
    const webRequest = new Request(
      new URL(request.url ?? "/", `http://${request.headers.host ?? "localhost"}`),
      {
        method: request.method,
        headers: request.headers,
        body,
      },
    );
    const webResponse = await handler.fetch(webRequest, {}, { waitUntil() {} });
    response.statusCode = webResponse.status;
    webResponse.headers.forEach((value, key) => response.setHeader(key, value));
    if (request.method === "HEAD") response.end();
    else response.end(Buffer.from(await webResponse.arrayBuffer()));
  } catch (error) {
    console.error(error);
    response.statusCode = 500;
    response.end("Internal Server Error");
  }
});

server.listen(port, host, () => {
  console.log(`LclPlan server listening on http://${host}:${port}`);
});
