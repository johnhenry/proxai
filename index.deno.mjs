import { serveDir } from "jsr:@std/http/file-server";
import { dirname, join } from "node:path";
const genPath = (base, parent) => {
  if (base.startsWith("/")) {
    return base;
  }
  if (parent.startsWith("file://")) {
    parent = parent.substring("file://".length);
  }
  return join(dirname(parent), base);
};
const PORT = 8080;
const localAddress = `http://localhost:${PORT}`;
const SETTINGS_PATH = genPath("config.json", import.meta.url);
let config;
const createDefaultConfig = () => ({
  sticky: false,
  random: false,
  servers: [],
});

const readConfig = () => {
  try {
    config =
      JSON.parse(Deno.readTextFileSync(SETTINGS_PATH)) || createDefaultConfig();
  } catch (error) {
    console.error(error);
    config = createDefaultConfig();
  }
};
readConfig();
const writeConfig = (formData) => {
  const sticky = !!formData.get("sticky");
  const random = !!formData.get("random");
  const names = formData.getAll("name");
  const urls = formData.getAll("url");
  const keys = formData.getAll("key");
  const models = formData.getAll("model");
  const servers = [];
  for (let i = 0; i < names.length; i++) {
    const name = names[i];
    const url = urls[i];
    const key = keys[i];
    const model = models[i];
    servers.push({ name, url, key, model });
  }
  config = {
    sticky,
    random,
    servers,
  };
  Deno.writeTextFileSync(SETTINGS_PATH, JSON.stringify(config, null, " "));
};

const getIndicies = (servers, random, sticky) => {
  const indices = [];
  for (let i = 0; i < servers.length; i++) {
    indices.push(i);
  }
  if (random) {
    indices.sort(() => Math.random() - 0.5);
  }
  if (sticky) {
    if (lastUsedIndex > -1) {
      const index = indices.indexOf(lastUsedIndex);
      indices.splice(index, 1);
      indices.unshift(lastUsedIndex);
    }
  }
  return indices;
};

let lastUsedIndex;
const handler = async (request) => {
  const path = new URL(request.url).pathname;

  // read or write config
  if (path === "/config") {
    if (request.method === "POST") {
      const formData = await request.formData();
      writeConfig(formData);
    }
    return new Response(JSON.stringify(config, null, " "), {
      headers: {
        "Content-Type": "application/json",
        "x-used-option": lastUsedIndex ?? "",
      },
    });
  }
  // Serve Static Files
  if (request.method === "GET") {
    return serveDir(request, {
      fsRoot: "./static",
      urlRoot: "",
    });
  }
  // Convert to JSON
  if (path === "/messages") {
    const data = await request.formData();
    const roles = data.getAll("role");
    const contents = data.getAll("content");
    const messages = [];
    for (let i = 0; i < roles.length; i++) {
      const [role, content] = [roles[i], contents[i]];
      messages.push({
        role,
        content,
      });
    }
    return fetch(localAddress, {
      method: "POST",
      body: JSON.stringify({ messages }),
    });
  }

  // Read json and send to all
  let messages;
  try {
    ({ messages } = await request.json());
  } catch {
    return new Response("Failed to parse JSON", { status: 400 });
  }
  let response;
  for (const index of getIndicies(
    config.servers,
    config.random,
    config.sticky
  )) {
    const { name, url, key, model } = config.servers[index];

    const body = JSON.stringify({
      model,
      messages,
    });
    response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body,
    });

    if (!response.ok) {
      console.log(
        "Failed to fetch",
        name,
        response.status,
        response.statusText,
        await response.text()
      );
      continue;
    }
    lastUsedIndex = index;
    const ts = new TransformStream();
    const fullResponse = new Response(ts.readable, {
      status: 200,
      headers: {
        ...response.headers,
        "x-used-option": index,
      },
    });
    response.body.pipeTo(ts.writable);
    return fullResponse;
  }
  return new Response("Failed to fetch", { status: 500 });
};

Deno.serve({ port: PORT }, handler);
