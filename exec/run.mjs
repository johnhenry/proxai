#!/usr/bin/env node --no-warnings
import PACKAGE from "../package.json" with { type: "json" };
import yargs from "yargs/yargs";
import { hideBin } from "yargs/helpers";
const NAME = PACKAGE.name;
const VERSION = PACKAGE.version;
import start from "../index.mjs";
yargs(hideBin(process.argv))
  .version(VERSION)
  .scriptName(NAME)
  .usage("$0 <cmd> [args]")
  .command(
    "serve [config]",
    `start ${NAME} server`,
    (yargs) => {
      // most of the options are from child_process.exec options (see https://nodejs.org/api/child_process.html#child_process_child_process_exec_command_options_callback)
      yargs.option("verbose", {
          alias: "v",
          describe: "verbose mode",
          default: false,
          type: "boolean",
        })
        .option("port", {
          alias: "p",
          describe: "server port",
          default: 8095,
          type: "number",
        })
        .option("config", {
          alias: "c",
          describe: "Location of config file. Default is 'config.json' in current directory",
          type: "string",
        })
        .option("timeout", {
          describe: "Request timeout in milliseconds",
          type: "number",
        }).option("webui", {
          alias: "w",
          describe: "Enables Web UI for configruation at /",
          default:false,
          type: "boolean",
        })
        .option("writableconfig", {
          alias: "r",
          describe: "Make config writable. ",
          default:false,
          type: "boolean",
        })
    },({_, port, config, verbose, timeout, webui, writableconfig})=>{
      start(port, config || _[1], verbose, timeout, webui, writableconfig);
    })
  .demandCommand(1, `try: ${NAME} serve`)
  .alias("h", "help")
  .help().argv;