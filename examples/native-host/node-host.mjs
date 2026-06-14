#!/usr/bin/env node

import { stdin, stdout, env } from "node:process";

let buffer = Buffer.alloc(0);

stdin.on("data", async (chunk) => {
  buffer = Buffer.concat([buffer, chunk]);

  while (buffer.length >= 4) {
    const length = buffer.readUInt32LE(0);
    if (buffer.length < 4 + length) return;

    const raw = buffer.subarray(4, 4 + length).toString("utf8");
    buffer = buffer.subarray(4 + length);

    try {
      const message = JSON.parse(raw);
      await handleMessage(message);
    } catch (error) {
      writeMessage({ type: "error", message: error.message });
    }
  }
});

async function handleMessage(message) {
  if (message.type === "ping") {
    writeMessage({ type: "pong", connected: true });
    return;
  }

  if (message.type === "create_task") {
    const result = await createTask(message.payload);
    writeMessage({
      type: "task_created",
      id: result.id,
      status: result.status || "accepted"
    });
    return;
  }

  writeMessage({ type: "error", message: `Unsupported message type: ${message.type}` });
}

async function createTask(payload) {
  const apiUrl = env.CODEX_BRIDGE_API_URL;
  const token = env.CODEX_BRIDGE_TOKEN;

  if (!apiUrl) {
    return {
      id: `local_${Date.now()}`,
      status: "accepted"
    };
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: JSON.stringify(payload)
  });

  const body = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(body.error?.message || body.message || `Task API failed with ${response.status}`);
  }

  return body;
}

function writeMessage(message) {
  const payload = Buffer.from(JSON.stringify(message), "utf8");
  const header = Buffer.alloc(4);
  header.writeUInt32LE(payload.length, 0);
  stdout.write(Buffer.concat([header, payload]));
}
