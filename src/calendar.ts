#!/usr/bin/env bun
import { Command } from "commander";
import { authCommand } from "./commands/auth.js";
import {
  eventAddCommand,
  eventListCommand,
  eventRemoveCommand,
  eventShowCommand,
  eventUpdateCommand,
} from "./commands/event.js";

const program = new Command();

program
  .name("calendar")
  .description("Calendar event management")
  .version("0.1.0");

program
  .command("auth")
  .description("Authenticate Google account (includes Calendar scopes)")
  .action(authCommand);

program
  .command("ls")
  .description("List events")
  .option("--from <iso>", "Filter start after ISO datetime")
  .option("--to <iso>", "Filter start before ISO datetime")
  .option("--limit <n>", "Limit results", "20")
  .option("--calendar <id>", "Calendar ID", "primary")
  .action(eventListCommand);

program
  .command("show <id>")
  .description("Show event details")
  .action(eventShowCommand);

program
  .command("add")
  .description("Create event")
  .requiredOption("--title <text>", "Event title")
  .requiredOption("--start <iso>", "Start ISO datetime")
  .requiredOption("--end <iso>", "End ISO datetime")
  .option("--calendar <id>", "Calendar ID", "primary")
  .option("--location <text>", "Location")
  .option("--description <text>", "Description")
  .option("--all-day", "Create all-day event")
  .option("--rrule <rule>", "Recurring rule, e.g. FREQ=WEEKLY;BYDAY=MO")
  .action(eventAddCommand);

program
  .command("update <id>")
  .description("Update event")
  .option("--title <text>", "Event title")
  .option("--start <iso>", "Start ISO datetime")
  .option("--end <iso>", "End ISO datetime")
  .option("--calendar <id>", "Calendar ID", "primary")
  .option("--location <text>", "Location")
  .option("--description <text>", "Description")
  .option("--all-day", "Treat times as all-day")
  .option("--rrule <rule>", "Recurring rule, e.g. FREQ=WEEKLY;BYDAY=MO")
  .option("--clear-rrule", "Remove recurrence")
  .action(eventUpdateCommand);

program
  .command("rm <id>")
  .description("Delete event")
  .action(eventRemoveCommand);

program.parse();
