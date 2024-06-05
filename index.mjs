import express from "express";
import bodyParser from "body-parser";
import { Readable } from "stream";
import { readFileSync, writeFileSync } from "node:fs";
import http from "node:http";
import process from "node:process";
import { join, dirname } from "node:path";
const createVerboseLogger = (VERBOSE = true) => ({
  log: VERBOSE ? console.log : () => {},
  error: VERBOSE ? console.error : () => {},
  warn: VERBOSE ? console.warn : () => {},
  info: VERBOSE ? console.info : () => {},
  debug: VERBOSE ? console.debug : () => {},
  trace: VERBOSE ? console.trace : () => {},
});

const genPath = (base, parent) => {
  if (base.startsWith("/")) {
    return base;
  }
  if (parent.startsWith("file://")) {
    parent = parent.substring("file://".length);
  }
  return join(parent, base);
};
const createDefaultConfig = () => ({
  sticky: false,
  random: false,
  servers: [],
});

const start = (
  PORT = 8080,
  SETTINGS_PATH = genPath("config.json", process.cwd()),
  VERBOSE = false
) => {
  const logger = createVerboseLogger(VERBOSE);
  const localAddress = `http://localhost:${PORT}`;
  let config;

  const readConfig = () => {
    try {
      config = JSON.parse(readFileSync(SETTINGS_PATH)) || createDefaultConfig();
    } catch (error) {
      logger.error(error);
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
    writeFileSync(SETTINGS_PATH, JSON.stringify(config, null, " "));
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
  const handler = async (request, response, next) => {
    // path: https://stackoverflow.com/a/56380963/1290781
    const path = request.baseUrl + request.path;
    // read or write config
    if (path === "/config") {
      if (request.method === "POST") {
        const formData = await request.formData;
        writeConfig(formData);
      }
      response
        .set({
          "Content-Type": "application/json",
          "x-used-option": lastUsedIndex ?? "",
        })
        .send(JSON.stringify(config, null, " "));
      return;
    }
    // Serve Static Files
    if (request.method === "GET") {
      const staticPath = genPath("static", dirname(import.meta.url));
      console.log(staticPath);
      express.static(staticPath)(request, response, next);
      return;
    }

    // Convert to JSON
    if (path === "/messages") {
      const data = request.formData;
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
      const res = await fetch(localAddress, {
        method: "POST",
        body: JSON.stringify({ messages }),
      });
      Readable.fromWeb(res.body).pipe(response);
      return;
    }
    let messages;
    try {
      ({ messages } = request.json);
    } catch {
      return new Response("Failed to parse JSON", { status: 400 });
    }
    let res;
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
      res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${key}`,
          "Content-Type": "application/json",
        },
        body,
      });

      if (!res.ok) {
        logger.log(
          "Failed to fetch",
          name,
          res.status,
          res.statusText,
          await res.text()
        );
        continue;
      }
      lastUsedIndex = index;
      Readable.fromWeb(res.body).pipe(response);
      return;
    }
  };
  const bufferToFormData = (body) => {
    const rawData = body.toString().split("\r\n");
    const boundary = rawData.shift();
    const contentStart = "Content-Disposition: form-data; name=";
    let datum = {};
    const data = [];
    for (let i = 0; i < rawData.length; i++) {
      const line = rawData[i];
      if (line.startsWith(contentStart)) {
        datum.name = line.substring(contentStart.length + 1, line.length - 1);
      } else if (line.startsWith(boundary)) {
        data.push(datum);
        datum = {};
      } else {
        datum.value = datum.value || "" + line;
      }
    }
    const formData = new FormData();
    for (const { name, value } of data) {
      formData.append(name, value);
    }
    return formData;
  };

  const formDataMiddleWare = () => (req, _, next) => {
    try {
      req.formData = bufferToFormData(req.body);
    } finally {
      next();
    }
  };

  const bufferToJSON = (body) => {
    const rawData = body.toString();
    try {
      return JSON.parse(rawData);
    } catch {
      return {};
    }
  };

  const jsonMiddleWare = () => (req, _, next) => {
    try {
      req.json = bufferToJSON(req.body);
    } finally {
      next();
    }
  };

  const app = express();
  app.use(bodyParser.raw({ type: "*/*" }));
  app.use(formDataMiddleWare());
  app.use(jsonMiddleWare());

  app.use(handler);
  const server = http.createServer(app);
  server.listen(PORT);
  logger.log(`Server running at ${localAddress}`);
};
export default start;

/*
General Imports:
None of the below:

Scoped Imports:
starts with "@"

Itentifier Imports:
starts with "<identifier>:"

Remote Imports:
starts with "http://", "https://"

Local Alias:
starts with "@/"

Local Imports:
starts with "./"
*/
