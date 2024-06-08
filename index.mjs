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
  VERBOSE = false,
  TIMEOUT = undefined
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

  const writeConfig = (data) => {
    config = data;
    writeFileSync(SETTINGS_PATH, JSON.stringify(data, null, " "));
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
  const getIndiciesByNames = (servers, ...server_names) => {
    const indices = [];
    for (const server of server_names) {
      const index = servers.findIndex((s) => s.name === server);
      if (index > -1) {
        indices.push(index);
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
        const data = await request.json;
        writeConfig(data);
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
    let messages, server, modelIndex;
    try {
      ({ model: modelIndex, messages, server } = request.json);
    } catch {
      return new Response("Failed to parse JSON", { status: 400 });
    }
    modelIndex = modelIndex || 0;
    let res;

    const indices = server
      ? getIndiciesByNames(config.servers, server)
      : getIndicies(config.servers, config.random, config.sticky);
    try {
      for (const index of indices) {
        const { name, url, headers, models } = config.servers[index];
        const model = models[modelIndex] || models[0];
        const body = JSON.stringify({
          model,
          messages,
        });
        let timeoutId;
        let abortController;
        if (TIMEOUT) {
          abortController = new AbortController();
          timeoutId = setTimeout(
            () => abortController.abort(new Error("Request timed out")),
            TIMEOUT
          );
        }
        try {
          res = await fetch(url, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...headers,
            },
            body,
            signal: abortController?.signal,
          });
        } catch (error) {
          res = {
            status: 500,
            statusText: error.message,
            text() {
              return error.message;
            },
          };
        }

        clearTimeout(timeoutId);

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
    } catch (error) {
      logger.error(error);
      response.status(500).send(`Internal Server Error: ${error.message}`);
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
  http.createServer(app).listen(PORT, () => {
    logger.log(`Server running at ${localAddress}`);
  });
};
export default start;

// The following function creats a request to the given url, but immediately aborts it and logs the aborted result from fetch
const fetchAndAbort = async (url, options, timeout = 0) => {
  const controller = new AbortController();
  const { signal } = controller;
  const timeoutId = setTimeout(() => {
    controller.abort(new Error("Request timed out"));
  }, timeout);
  try {
    const response = await fetch(url, { ...options, signal });
    console.log("response", response);
    return response;
  } catch (error) {
    console.log("error", error);
  } finally {
    clearTimeout(timeoutId);
  }
};
