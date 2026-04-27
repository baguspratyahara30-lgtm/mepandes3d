import { createClient } from "@supabase/supabase-js";

import {
  appendRsvpEntry,
  readRsvpData,
  toRsvpResponse,
  type Attendance,
  type RsvpResponse,
} from "@/lib/rsvp-store";

type SupabaseRsvpRow = {
  name: string;
  attendance: Attendance;
  message: string;
  created_at: string;
};

function isProduction() {
  return process.env.NODE_ENV === "production";
}

export function isSupabaseConfigured() {
  return Boolean(
    process.env.SUPABASE_URL &&
      (process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY),
  );
}

function getSupabaseClient() {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl) {
    return null;
  }

  const key = supabaseServiceRoleKey ?? supabaseAnonKey;
  if (!key) {
    return null;
  }

  return createClient(supabaseUrl, key);
}

function isAttendance(value: unknown): value is Attendance {
  return value === "hadir" || value === "tidakHadir";
}

function isSupabaseRow(value: unknown): value is SupabaseRsvpRow {
  if (!value || typeof value !== "object") {
    return false;
  }

  const candidate = value as Partial<SupabaseRsvpRow>;
  return (
    typeof candidate.name === "string" &&
    isAttendance(candidate.attendance) &&
    typeof candidate.message === "string" &&
    typeof candidate.created_at === "string"
  );
}

function toSnapshot(rows: SupabaseRsvpRow[]): RsvpResponse {
  const summary = rows.reduce(
    (acc, row) => {
      if (row.attendance === "hadir") {
        acc.hadir += 1;
      } else {
        acc.tidakHadir += 1;
      }
      return acc;
    },
    { hadir: 0, tidakHadir: 0 },
  );

  const last = rows.length > 0 ? rows[rows.length - 1] : null;
  const messages = rows
    .filter((row) => row.message.trim().length > 0)
    .slice(-50)
    .map((row) => ({
      attendance: row.attendance,
      name: row.name,
      message: row.message,
      createdAt: row.created_at,
    }));

  return {
    summary,
    lastGuest: last?.name ?? "",
    lastMessage: last?.message ?? "",
    messages,
    hasSubmitted: false,
  };
}

async function getSupabaseSnapshot() {
  const supabase = getSupabaseClient();
  if (!supabase) {
    return null;
  }

  const { data, error } = await supabase
    .from("rsvp_entries")
    .select("name, attendance, message, created_at")
    .order("created_at", { ascending: true });

  if (error) {
    throw new Error(`Gagal membaca Supabase: ${error.message}`);
  }

  const rows = Array.isArray(data)
    ? data.filter((item): item is SupabaseRsvpRow => isSupabaseRow(item))
    : [];

  return toSnapshot(rows);
}

async function getLocalResponse() {
  const localData = await readRsvpData();
  return toRsvpResponse(localData);
}

export async function getCurrentRsvpResponse() {
  if (!isSupabaseConfigured()) {
    if (isProduction()) {
      throw new Error(
        "Supabase belum dikonfigurasi. Isi env SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY agar RSVP online bisa dipakai.",
      );
    }

    return getLocalResponse();
  }

  const supabaseSnapshot = await getSupabaseSnapshot();
  if (supabaseSnapshot) {
    return supabaseSnapshot;
  }

  if (isProduction()) {
    throw new Error("Data RSVP dari Supabase belum tersedia.");
  }

  return getLocalResponse();
}

export async function pushRsvpEntry(payload: {
  name: string;
  attendance: Attendance;
  message: string;
  createdAt: string;
}) {
  const shouldUseSupabase = isSupabaseConfigured();

  if (shouldUseSupabase) {
    const supabase = getSupabaseClient();
    if (!supabase) {
      throw new Error("Supabase belum dikonfigurasi.");
    }

    const { error } = await supabase.from("rsvp_entries").insert({
      name: payload.name,
      attendance: payload.attendance,
      message: payload.message,
      created_at: payload.createdAt,
    });

    if (error) {
      throw new Error(`Gagal menulis ke Supabase: ${error.message}`);
    }

    const snapshot = await getSupabaseSnapshot();
    if (snapshot) {
      return {
        ...snapshot,
        hasSubmitted: true,
      } satisfies RsvpResponse;
    }
  }

  if (isProduction() && !shouldUseSupabase) {
    throw new Error(
      "Supabase belum dikonfigurasi. Isi env SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY agar RSVP online bisa dipakai.",
    );
  }

  const localData = await appendRsvpEntry(payload);
  return toRsvpResponse(localData, { hasSubmitted: true });
}
