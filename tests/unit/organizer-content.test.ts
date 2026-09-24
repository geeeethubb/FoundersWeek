/**
 * The organizer view against the current content: the four mentors (names, verified roles),
 * organizer-only notes and drafts, no events (e.g. Dan Caruso) posing as mentors, and the
 * "Data store" indicator never exposing connection details.
 */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { getMentors, getMentorsForOrganizers } from "@/content";
import { events } from "@/content/events";
import { mentors as productionMentors } from "@/content/mentors";
import { MentorLineup } from "@/components/organizer/mentor-lineup";
import { MentorNotes, mentorDrafts, mentorMissing } from "@/components/organizer/mentor-notes";
import { buildApplicationCatalog } from "@/lib/applications/catalog";
import { __setDbForTests, createMemoryDbForTests } from "@/lib/db/client";
import { getDataStoreStatus, postgresProvider } from "@/lib/organizer/data-store";
import { describeDataStore, redactSecrets } from "@/lib/organizer/data-store-view";
import { buildOrganizerDirectory, joinNames, mentorBookability } from "@/lib/organizer/directory";
import { DEFAULT_APPLICATION_FILTERS, parseApplicationFilters, restrictToDirectory } from "@/lib/organizer/filters";
import { directory as fixtureDirectory } from "./organizer-fixtures";

const MENTOR_IDS = ["patrick-haddox", "arnav-mishra", "vikram-lakhwara", "ron-lewis"];

function text(html: string): string {
  return html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ");
}

beforeEach(() => {
  vi.stubEnv("SHOW_DEMO_CONTENT", "");
  vi.stubEnv("SHOW_DRAFT_CONTENT", "");
});

afterEach(() => {
  vi.unstubAllEnvs();
});

describe("organizer directory from production content", () => {
  const directory = buildOrganizerDirectory(getMentorsForOrganizers());

  it("lists exactly the four mentors with verified names and roles", () => {
    expect(directory.mentors.map((m) => m.id)).toEqual(MENTOR_IDS);
    const by = (id: string) => directory.mentorsById.get(id)!;
    expect(by("patrick-haddox")).toMatchObject({ name: "Patrick Haddox", affiliation: "CEO & Co-Founder, Samara Aerospace" });
    expect(by("arnav-mishra")).toMatchObject({ name: "Arnav Mishra", affiliation: "Co-Founder & CTO, Doss" });
    // Vik's title is unverified: never guessed.
    expect(by("vikram-lakhwara")).toMatchObject({ name: "Vikram “Vik” Lakhwara", firstName: "Vik", role: null, affiliation: "Stakehouse" });
    expect(by("ron-lewis")).toMatchObject({ name: "Ron Lewis", affiliation: "Co-Founder, Auctus Advisory" });
    expect(by("patrick-haddox").scheduling).toBe("available");
    expect(by("arnav-mishra").scheduling).toBe("available");
    expect(by("vikram-lakhwara").scheduling).toBe("in-progress");
    expect(by("ron-lewis").scheduling).toBe("in-progress");
  });

  it("never treats an event (Dan Caruso) as a mentor, window, slot or application option", () => {
    expect(events.some((e) => e.id === "dan-caruso-fireside-chat")).toBe(true);
    const everything = JSON.stringify({
      mentors: directory.mentors,
      slots: directory.slots,
      windows: directory.windows,
      catalog: buildApplicationCatalog(getMentorsForOrganizers()),
    });
    expect(everything).not.toMatch(/caruso/i);

    // A filter URL naming the event is dropped instead of silently filtering to nothing.
    const filters = restrictToDirectory(
      parseApplicationFilters({ mentor: "dan-caruso-fireside-chat", choice: "first", availability: "window:dan-caruso-fireside-chat" }),
      directory,
    );
    expect(filters).toEqual(DEFAULT_APPLICATION_FILTERS);
    // Known ids survive.
    expect(
      restrictToDirectory(
        parseApplicationFilters({ mentor: "ron-lewis", availability: "window:patrick-haddox-2026-10-01-am" }),
        directory,
      ),
    ).toMatchObject({ mentor: "ron-lewis", availability: "window:patrick-haddox-2026-10-01-am" });
    expect(restrictToDirectory(parseApplicationFilters({ availability: "none" }), directory).availability).toBe("none");
  });

  it("labels windows without repeating the weekday", () => {
    expect(directory.windowsById.get("patrick-haddox-2026-10-01-am")?.label).toBe("Thu, Oct 1 · 10:00–11:30 AM CT");
    expect(directory.windowsById.get("arnav-mishra-2026-10-02-am")?.label).toBe(
      "Oct 2 · Friday morning, before noon · Exact window pending",
    );
  });

  it("explains which preferred mentors can't be booked yet", () => {
    const prefs = mentorBookability(directory, ["vikram-lakhwara", "ron-lewis", "patrick-haddox"]);
    expect(prefs.map((p) => [p.firstName, p.slots.length, p.windows.length, p.scheduling])).toEqual([
      ["Vik", 0, 0, "in-progress"],
      ["Ron", 0, 0, "in-progress"],
      ["Patrick", 0, 1, "available"],
    ]);
    expect(joinNames(prefs.map((p) => p.firstName))).toBe("Vik, Ron and Patrick");
    expect(joinNames(["Vik", "Ron"])).toBe("Vik and Ron");
    // With demo content, slots exist for demo mentors only.
    expect(mentorBookability(fixtureDirectory, ["demo-avery-sample"])[0].slots).toHaveLength(2);
  });
});

describe("mentor notes (organizer-only)", () => {
  it("keeps organizer notes and drafts out of public mentor data", () => {
    const publicMentors = JSON.stringify(getMentors());
    expect(publicMentors).not.toContain("not available slots");
    expect(publicMentors).not.toContain("Revenue strategy");
    const organizer = getMentorsForOrganizers();
    expect(organizer.every((m) => Boolean(m.organizerNotes))).toBe(true);
  });

  it("shows every mentor's organizer notes, Ron's draft topics and what's still missing", () => {
    const mentors = getMentorsForOrganizers();
    const html = renderToStaticMarkup(createElement(MentorNotes, { mentors }));
    const t = text(html);
    for (const m of productionMentors) {
      expect(t).toContain(m.name);
      expect(t).toContain(m.organizerNotes!);
    }
    // Vik's existing commitments are constraints, not availability.
    expect(t).toContain("these are not available slots");
    // Ron's suggested topics are drafts awaiting his confirmation.
    const ron = mentors.find((m) => m.id === "ron-lewis")!;
    expect(mentorDrafts(ron).map((d) => d.label)).toEqual(["Ask me about"]);
    for (const topic of ron.askMeAbout!.value) expect(t).toContain(topic);
    expect(t).toContain("Draft");
    expect(t).toContain("Hidden on the public site until marked approved");
    // Missing details are honest.
    expect(mentorMissing(mentors.find((m) => m.id === "vikram-lakhwara")!)).toContain("Title (unverified — hidden)");
    expect(t).toContain("Title not verified");
    // Links go to the application section on the Office Hours page — never /apply.
    expect(html).toContain('href="/office-hours?mentor=ron-lewis#apply"');
    expect(html).toContain('href="/office-hours/vikram-lakhwara"');
    expect(html).not.toMatch(/href="\/apply/);
    // Portraits (initials) rather than the old monogram; no event appears.
    expect(t).toContain("VL");
    expect(t).not.toMatch(/caruso/i);
  });

  it("the mentor lineup shows all four mentors with demand and scheduling state", () => {
    const directory = buildOrganizerDirectory(getMentorsForOrganizers());
    const html = renderToStaticMarkup(
      createElement(MentorLineup, {
        directory,
        interest: new Map([["ron-lewis", { any: 5, first: 2 }]]),
        usage: new Map(),
        filters: { ...DEFAULT_APPLICATION_FILTERS, mentor: "ron-lewis" },
      }),
    );
    const t = text(html);
    for (const m of productionMentors) expect(t).toContain(m.name);
    expect(t).toContain("5 interested · 2 first choice");
    expect(t).toContain("Scheduling in progress");
    expect(t).toContain("Thu, Oct 1 · 10:00–11:30 AM");
    // The active mentor links back to all mentors; the others filter.
    expect(html).toContain('href="/organizers"');
    expect(html).toContain('href="/organizers?mentor=patrick-haddox"');
    expect(html.match(/aria-current="true"/g)).toHaveLength(1);
  });
});

describe("data store indicator", () => {
  const checkedAt = "2026-09-23T20:00:00.000Z";

  it("labels live Postgres/Supabase, local PGlite and disconnected states", () => {
    expect(
      describeDataStore({ persistence: { ready: true, kind: "postgres" }, provider: "supabase", schema: "0001_init", showHints: true, checkedAt }),
    ).toMatchObject({ state: "live", provider: "Supabase · Postgres", headline: "Live database connected", schema: "0001_init", hint: null });
    expect(
      describeDataStore({ persistence: { ready: true, kind: "postgres" }, provider: "postgres", schema: "0001_init", showHints: true, checkedAt }),
    ).toMatchObject({ state: "live", provider: "Postgres" });
    expect(
      describeDataStore({ persistence: { ready: true, kind: "pglite" }, provider: "pglite", schema: "0001_init", showHints: true, checkedAt }),
    ).toMatchObject({ state: "local", provider: "PGlite · local file" });
    const down = describeDataStore({
      persistence: { ready: false, reason: "unreachable", detail: "Could not connect: postgres://admin:hunter2@db.abc.supabase.co:5432/postgres" },
      provider: "supabase",
      schema: "0001_init",
      showHints: true,
      checkedAt,
    });
    expect(down).toMatchObject({ state: "down", headline: "Database not connected", schema: null });
    expect(JSON.stringify(down)).not.toMatch(/hunter2|admin:|postgres:\/\//);
    // Production: no hint at all.
    expect(
      describeDataStore({ persistence: { ready: false, reason: "not-migrated", detail: "x" }, provider: "postgres", schema: "0001_init", showHints: false, checkedAt }).hint,
    ).toBeNull();
  });

  it("redacts connection strings and credentials from free text", () => {
    expect(redactSecrets("failed for postgresql://user:p%40ss@host:6543/db?sslmode=require now")).toBe(
      "failed for [connection string hidden] now",
    );
    expect(redactSecrets("auth failed for admin:hunter2@10.0.0.5")).not.toContain("hunter2");
    expect(redactSecrets("password=hunter2 sslmode=require")).toBe("password=[hidden] sslmode=require");
    expect(redactSecrets("Database schema is missing. Run `npm run db:migrate`.")).toBe(
      "Database schema is missing. Run `npm run db:migrate`.",
    );
  });

  it("hides database hosts and IPs from driver errors (shown as setup hints on preview deploys)", () => {
    expect(redactSecrets("Could not connect to the database: connect ECONNREFUSED 127.0.0.1:1")).toBe(
      "Could not connect to the database: connect ECONNREFUSED [host hidden]",
    );
    expect(redactSecrets("getaddrinfo ENOTFOUND db.abcdefghijkl.supabase.co")).toBe("getaddrinfo ENOTFOUND [host hidden]");
    expect(redactSecrets("connect ECONNREFUSED ::1:5432")).toBe("connect ECONNREFUSED [host hidden]");
    expect(redactSecrets("connect ECONNREFUSED [2600:1f18::5]:6543")).toBe("connect ECONNREFUSED [host hidden]");
    expect(redactSecrets("timeout on aws-0-us-east-1.pooler.supabase.com:6543 after 10s")).toBe(
      "timeout on [host hidden] after 10s",
    );
    expect(redactSecrets("no route to localhost:5432")).toBe("no route to [host hidden]");
  });

  it("detects Supabase by host without exposing it", () => {
    expect(postgresProvider("postgresql://postgres.ref:pw@aws-0-us-east-1.pooler.supabase.com:6543/postgres")).toBe("supabase");
    expect(postgresProvider("postgres://postgres:pw@db.abcdefgh.supabase.co:5432/postgres")).toBe("supabase");
    expect(postgresProvider("postgres://u:p@localhost:5432/app")).toBe("postgres");
    expect(postgresProvider("postgres://u:p@supabase.co.evil.example/app")).toBe("postgres");
    expect(postgresProvider("not a url")).toBe("postgres");
  });

  it("reports the connected database and a dead one without leaking the URL", async () => {
    const db = await createMemoryDbForTests();
    __setDbForTests(db);
    try {
      expect(await getDataStoreStatus(new Date(checkedAt))).toMatchObject({ state: "local", checkedAt });
    } finally {
      __setDbForTests(undefined);
    }
    vi.stubEnv("DATABASE_URL", "postgres://admin:hunter2@127.0.0.1:1/founders");
    vi.stubEnv("POSTGRES_URL", "");
    const dead = await getDataStoreStatus();
    expect(dead.state).toBe("down");
    expect(dead.provider).toBe("Postgres");
    expect(JSON.stringify(dead)).not.toMatch(/hunter2|admin|postgres:\/\//);

    vi.stubEnv("DATABASE_URL", "");
    expect(await getDataStoreStatus()).toMatchObject({ state: "down", headline: "No database configured", provider: "Not configured" });
  });
});
