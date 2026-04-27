import { promises as fs } from "node:fs";
import path from "node:path";

export type Attendance = "hadir" | "tidakHadir";

export type RsvpEntry = {
  name: string;
  attendance: Attendance;
  message: string;
  createdAt: string;
};

export type RsvpSummary = {
  hadir: number;
  tidakHadir: number;
};

export type PublicMessage = {
  attendance: Attendance;
  name: string;
  message: string;
  createdAt: string;
};

export type RsvpData = {
  entries: RsvpEntry[];
  lastGuest: string;
  lastMessage: string;
  summary: RsvpSummary;
};

export type RsvpResponse = {
  summary: RsvpSummary;
  lastGuest: string;
  lastMessage: string;
  messages: PublicMessage[];
  hasSubmitted?: boolean;
};

const dataFilePath = path.join(process.cwd(), ".data", "metatah-rsvp.json");
const maxMessages = 50;

const emptyData: RsvpData = {
  entries: [],
  lastGuest: "",
  lastMessage: "",
  summary: {
    hadir: 0,
    tidakHadir: 0,
  },
};

async function ensureFile(): Promise<void> {
  await fs.mkdir(path.dirname(dataFilePath), { recursive: true });
  try {
    await fs.access(dataFilePath);
  } catch {
    await fs.writeFile(dataFilePath, JSON.stringify(emptyData, null, 2), "utf8");
  }
}

export async function readRsvpData(): Promise<RsvpData> {
  await ensureFile();
  const raw = await fs.readFile(dataFilePath, "utf8");
  const parsed = JSON.parse(raw) as Partial<RsvpData>;
  return {
    entries: parsed.entries ?? [],
    lastGuest: parsed.lastGuest ?? "",
    lastMessage: parsed.lastMessage ?? "",
    summary: {
      hadir: parsed.summary?.hadir ?? 0,
      tidakHadir: parsed.summary?.tidakHadir ?? 0,
    },
  };
}

export async function appendRsvpEntry(entry: RsvpEntry): Promise<RsvpData> {
  const current = await readRsvpData();
  const nextEntries = [...current.entries, entry];
  const summary: RsvpSummary = {
    hadir: nextEntries.filter((item) => item.attendance === "hadir").length,
    tidakHadir: nextEntries.filter((item) => item.attendance === "tidakHadir")
      .length,
  };

  const next: RsvpData = {
    entries: nextEntries,
    lastGuest: entry.name,
    lastMessage: entry.message,
    summary,
  };

  await fs.writeFile(dataFilePath, JSON.stringify(next, null, 2), "utf8");
  return next;
}

function toMessages(entries: RsvpEntry[]): PublicMessage[] {
  return entries
    .filter((entry) => entry.message.trim().length > 0)
    .slice(-maxMessages)
    .map((entry) => ({
      attendance: entry.attendance,
      name: entry.name,
      message: entry.message,
      createdAt: entry.createdAt,
    }));
}

export function toRsvpResponse(
  data: RsvpData,
  extras?: Pick<RsvpResponse, "hasSubmitted">,
): RsvpResponse {
  return {
    summary: data.summary,
    lastGuest: data.lastGuest,
    lastMessage: data.lastMessage,
    messages: toMessages(data.entries),
    hasSubmitted: extras?.hasSubmitted ?? false,
  };
}
