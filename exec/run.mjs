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
          describe: "",
          type: "string",
        })
    },(argv)=>{
      const {verbose, port} = argv;
      argv.config = argv.config || argv._[1];
      start(port, argv.config, verbose);
    })
  .demandCommand(1, `try: ${NAME} serve`)
  .alias("h", "help")
  .help().argv;