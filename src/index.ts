#!/usr/bin/env bun
import { Command } from "commander";
import { syncCommand } from "./commands/sync.js";
import { listCommand, showCommand } from "./commands/read.js";
import { tagAddCommand, tagRemoveCommand, tagListCommand } from "./commands/tag.js";
import { archiveCommand, deleteCommand } from "./commands/actions.js";
import { authCommand } from "./commands/auth.js";
import { doctorCommand } from "./commands/doctor.js";

const program = new Command();

program
  .name("mail")
  .description("CLI email reader and tagger")
  .version("0.1.0");

program
  .command("auth")
  .description("Authenticate Gmail account")
  .action(authCommand);

program
  .command("doctor")
  .description("Check auth, token, and database health")
  .action(doctorCommand);

program
  .command("sync")
  .description("Pull recent emails from Gmail")
  .option("--days <days>", "Number of days to sync", "30")
  .action(syncCommand);

program
  .command("ls")
  .description("List messages")
  .option("--tag <tag>", "Filter by tag")
  .option("--limit <n>", "Limit results", "20")
  .option("--include-archived", "Include archived messages")
  .option("--include-deleted", "Include deleted messages")
  .action(listCommand);

program
  .command("show <id>")
  .description("Show message details")
  .action(showCommand);

program
  .command("tag")
  .description("Tag operations")
  .argument("[action]", "add, rm, or ls")
  .argument("[id]", "Message ID")
  .argument("[tag]", "Tag name")
  .action((action, id, tag) => {
    if (action === "ls" || action === undefined) return tagListCommand();
    if (action === "add") return tagAddCommand(id, tag);
    if (action === "rm") return tagRemoveCommand(id, tag);
    console.error(`Unknown tag action: ${action}`);
    process.exit(1);
  });

program
  .command("archive <id>")
  .description("Archive a message")
  .action(archiveCommand);

program
  .command("delete <id>")
  .description("Delete a message")
  .action(deleteCommand);

program.parse();
