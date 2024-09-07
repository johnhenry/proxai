import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert";
import { readFileSync, writeFileSync, unlinkSync, existsSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import start from "../index.mjs";
import express from "express";
import fetch from "node-fetch";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const TEST_CONFIG_PATH = join(__dirname, "test_proxai.json");

describe("Proxai Tests", () => {
  let server;

  beforeEach(() => {
    // Create a test configuration file
    const testConfig = {
      sticky: false,
      random: false,
      servers: [
        {
          name: "test-server-1",
          url: "http://localhost:54321",
          headers: {},
          models: ["model1", "model2"],
        },
        {
          name: "test-server-2",
          url: "http://localhost:65432",
          headers: {},
          models: ["model3"],
        },
      ],
    };
    writeFileSync(TEST_CONFIG_PATH, JSON.stringify(testConfig));
  });

  afterEach(() => {
    // Clean up the test configuration file
    if (existsSync(TEST_CONFIG_PATH)) {
      unlinkSync(TEST_CONFIG_PATH);
    }
    if (server && server.close) {
      return new Promise((resolve) => server.close(resolve));
    }
  });

  test("Configuration Management", async (t) => {
    const TEST_PORT = 12345;

    await t.test("Read config", () => {
      const config = JSON.parse(readFileSync(TEST_CONFIG_PATH));
      assert.deepStrictEqual(config.servers.length, 2);
      assert.strictEqual(config.servers[0].name, "test-server-1");
    });

    await t.test("Write config", async () => {
      server = await start(
        TEST_PORT,
        TEST_CONFIG_PATH,
        false,
        undefined,
        false,
        true
      );
      const newConfig = {
        sticky: true,
        random: true,
        servers: [
          {
            name: "new-server",
            url: "http://localhost:11111",
            headers: {},
            models: [],
          },
        ],
      };

      const response = await fetch(`http://localhost:${TEST_PORT}/config`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newConfig),
      });

      assert.strictEqual(response.status, 200);

      const updatedConfig = JSON.parse(readFileSync(TEST_CONFIG_PATH));
      assert.deepStrictEqual(updatedConfig, newConfig);
    });
  });

  test("Server Routing and Request Handling", async (t) => {
    const TEST_PORT = 12346;
    server = await start(TEST_PORT, TEST_CONFIG_PATH);

    await t.test("Route requests to the correct server", async () => {
      // Mock the fetch function
      global.fetch = async (url, options) => {
        if (url === "http://localhost:54321") {
          return {
            ok: true,
            status: 200,
            body: new ReadableStream({
              start(controller) {
                controller.enqueue("Response from test-server-1");
                controller.close();
              },
            }),
          };
        }
        throw new Error("Unexpected URL");
      };

      const response = await fetch(`http://localhost:${TEST_PORT}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: 0,
          messages: [{ role: "user", content: "Hello" }],
        }),
      });

      assert.strictEqual(response.status, 200);
      const responseText = await response.text();
      assert.strictEqual(responseText, "Response from test-server-1");
    });
  });

  test("Error Handling", async (t) => {
    console.log("Starting Error Handling test suite");
    const TEST_PORT = 12347;
    console.log("Starting server on port", TEST_PORT);
    server = await start(TEST_PORT, TEST_CONFIG_PATH);
    console.log("Server started");

    await t.test("Handle server errors gracefully", async () => {
      console.log("Starting Handle server errors gracefully test");
      // Mock the fetch function to simulate a server error
      global.fetch = async () => {
        console.log("Mocked fetch function called");
        return {
          ok: false,
          status: 500,
          statusText: "Internal Server Error",
          text: () => Promise.resolve("Something went wrong"),
        };
      };

      console.log("Sending request to server");
      const response = await fetch(`http://localhost:${TEST_PORT}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          model: 0,
          messages: [{ role: "user", content: "Hello" }],
        }),
      });
      console.log("Received response from server");

      console.log("Response status:", response.status);
      assert.strictEqual(response.status, 500);
      const responseText = await response.text();
      console.log("Response text:", responseText);
      assert.strictEqual(
        responseText,
        "Internal Server Error: Something went wrong"
      );
      console.log("Test completed successfully");
    });
  });
});
