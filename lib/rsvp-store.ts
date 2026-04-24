import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";

import { Redis } from "@upstash/redis";

export type Attendance = "hadir" | "tidakHadir";

export type RsvpSummary = {
  hadir: number;
  tidakHadir: number;
};

export type RsvpEntry = {
  attendance: Attendance;
  message: string;
  name: string;
  submittedAt: string;
};

export type RsvpStore = {
  entries: RsvpEntry[];
  lastGuest: string;
  summary: RsvpSummary;
};

const DATA_DIRECTORY = path.join(process.cwd(), ".data");
const DATA_FILE = path.join(DATA_DIRECTORY, "metatah-rsvp.json");
const REDIS_LAST_GUEST_KEY = "mepandes:rsvp:last-guest";
const REDIS_ENTRIES_KEY = "mepandes:rsvp:entries";
const REDIS_SUMMARY_KEY = "mepandes:rsvp:summary";

const EMPTY_STORE: RsvpStore = {
  entries: [],
  lastGuest: "",
  summary: {
    hadir: 0,
    tidakHadir: 0,
  },
};

let redisClient: Redis | null = null;

function hasRedisConfig() {
  return Boolean(
    process.env.UPSTASH_REDIS_REST_URL &&
      process.env.UPSTASH_REDIS_REST_TOKEN,
  );
}

function isVercelRuntime() {
  return process.env.VERCEL === "1";
}

function getRedisClient() {
  if (!hasRedisConfig()) {
    return null;
  }

  redisClient ??= Redis.fromEnv();
  return redisClient;
}

function toFiniteNumber(value: unknown) {
  const normalized = Number(value);
  return Number.isFinite(normalized) ? normalized : 0;
}

function normalizeEntry(entry: unknown): RsvpEntry | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }

  const candidate = entry as Partial<RsvpEntry>;
  const attendance = candidate.attendance;

  if (attendance !== "hadir" && attendance !== "tidakHadir") {
    return null;
  }

  return {
    attendance,
    message: typeof candidate.message === "string" ? candidate.message : "",
    name: typeof candidate.name === "string" ? candidate.name : "",
    submittedAt:
      typeof candidate.submittedAt === "string" ? candidate.submittedAt : "",
  };
}

function parseRedisEntry(raw: unknown) {
  if (typeof raw !== "string") {
    return null;
  }

  try {
    return normalizeEntry(JSON.parse(raw));
  } catch {
    return null;
  }
}

async function ensureDataFile() {
  await mkdir(DATA_DIRECTORY, { recursive: true });

  try {
    await readFile(DATA_FILE, "utf8");
  } catch {
    await writeFile(DATA_FILE, JSON.stringify(EMPTY_STORE, null, 2), "utf8");
  }
}

async function readFileStore() {
  await ensureDataFile();

  try {
    const raw = await readFile(DATA_FILE, "utf8");
    const parsed = JSON.parse(raw) as Partial<RsvpStore>;

    return {
      entries: Array.isArray(parsed.entries)
        ? parsed.entries
            .map((entry) => normalizeEntry(entry))
            .filter((entry): entry is RsvpEntry => entry !== null)
        : [],
      lastGuest: typeof parsed.lastGuest === "string" ? parsed.lastGuest : "",
      summary: {
        hadir: toFiniteNumber(parsed.summary?.hadir),
        tidakHadir: toFiniteNumber(parsed.summary?.tidakHadir),
      },
    } satisfies RsvpStore;
  } catch {
    return EMPTY_STORE;
  }
}

async function writeFileStore(store: RsvpStore) {
  await ensureDataFile();
  await writeFile(DATA_FILE, JSON.stringify(store, null, 2), "utf8");
}

async function readRedisStore(redis: Redis) {
  const [summaryRaw, lastGuestRaw, entriesRaw] = await Promise.all([
    redis.hgetall(REDIS_SUMMARY_KEY),
    redis.get(REDIS_LAST_GUEST_KEY),
    redis.lrange(REDIS_ENTRIES_KEY, 0, -1),
  ]);

  const entries = Array.isArray(entriesRaw)
    ? entriesRaw
        .map((entry) => parseRedisEntry(entry))
        .filter((entry): entry is RsvpEntry => entry !== null)
        .reverse()
    : [];

  return {
    entries,
    lastGuest: typeof lastGuestRaw === "string" ? lastGuestRaw : "",
    summary: {
      hadir: toFiniteNumber(
        (summaryRaw as Record<string, unknown> | null)?.hadir,
      ),
      tidakHadir: toFiniteNumber(
        (summaryRaw as Record<string, unknown> | null)?.tidakHadir,
      ),
    },
  } satisfies RsvpStore;
}

export function getRsvpStorageMode() {
  if (hasRedisConfig()) {
    return "upstash";
  }

  return isVercelRuntime() ? "unconfigured" : "file";
}

export async function readRsvpStore() {
  const redis = getRedisClient();

  if (redis) {
    return readRedisStore(redis);
  }

  return readFileStore();
}

export async function submitRsvp(input: {
  attendance: Attendance;
  message: string;
  name: string;
}) {
  const entry: RsvpEntry = {
    attendance: input.attendance,
    message: input.message,
    name: input.name,
    submittedAt: new Date().toISOString(),
  };

  const redis = getRedisClient();
  if (redis) {
    const transaction = redis.multi();
    transaction.lpush(REDIS_ENTRIES_KEY, JSON.stringify(entry));
    transaction.hincrby(REDIS_SUMMARY_KEY, input.attendance, 1);
    transaction.set(REDIS_LAST_GUEST_KEY, input.name);
    await transaction.exec();

    return readRedisStore(redis);
  }

  const store = await readFileStore();
  const nextStore: RsvpStore = {
    entries: [...store.entries, entry],
    lastGuest: input.name,
    summary: {
      ...store.summary,
      [input.attendance]: store.summary[input.attendance] + 1,
    },
  };

  await writeFileStore(nextStore);
  return nextStore;
}
