import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

import {
  appendRsvpEntry,
  readRsvpData,
  toRsvpResponse,
  type Attendance,
} from "@/lib/rsvp-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type SupabaseRsvpRow = {
  name: string;
  attendance: Attendance;
  message: string;
  created_at: string;
};

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function isProduction() {
  return process.env.NODE_ENV === "production";
}

function isSupabaseConfigured() {
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

function toSnapshot(rows: SupabaseRsvpRow[]) {
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

async function pushToSupabase(payload: {
  name: string;
  attendance: Attendance;
  message: string;
  createdAt: string;
}) {
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

  return getSupabaseSnapshot();
}

async function getLocalResponse() {
  const localData = await readRsvpData();
  return toRsvpResponse(localData);
}

async function getCurrentResponse() {
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
    return {
      ...supabaseSnapshot,
      hasSubmitted: false,
    };
  }

  if (isProduction()) {
    throw new Error("Data RSVP dari Supabase belum tersedia.");
  }

  return getLocalResponse();
}

export async function GET() {
  try {
    const response = await getCurrentResponse();
    return NextResponse.json(response, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
    if (isProduction()) {
      return NextResponse.json(
        {
          message:
            error instanceof Error
              ? error.message
              : "Sinkron Supabase sedang bermasalah.",
        },
        {
          status: 503,
          headers: NO_STORE_HEADERS,
        },
      );
    }

    const localResponse = await getLocalResponse();
    return NextResponse.json(
      {
        ...localResponse,
        warning:
          error instanceof Error
            ? error.message
            : "Sinkron Supabase sedang bermasalah.",
      },
      {
        status: 200,
        headers: NO_STORE_HEADERS,
      },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<{
      name: string;
      attendance: Attendance;
      message: string;
    }>;

    const name = body.name?.trim() ?? "";
    const message = body.message?.trim() ?? "";
    const attendance = body.attendance;

    if (!name) {
      return NextResponse.json(
        { message: "Nama wajib diisi." },
        { status: 400 },
      );
    }

    if (!isAttendance(attendance)) {
      return NextResponse.json(
        { message: "Status kehadiran tidak valid." },
        { status: 400 },
      );
    }

    const createdAt = new Date().toISOString();
    const shouldUseSupabase = isSupabaseConfigured();

    if (shouldUseSupabase) {
      const supabaseSnapshot = await pushToSupabase({
        name,
        attendance,
        message,
        createdAt,
      });

      if (supabaseSnapshot) {
        return NextResponse.json(
          {
            ...supabaseSnapshot,
            hasSubmitted: true,
          },
          {
            status: 201,
            headers: NO_STORE_HEADERS,
          },
        );
      }
    }

    if (process.env.NODE_ENV === "production" && !shouldUseSupabase) {
      return NextResponse.json(
        {
          message:
            "Supabase belum dikonfigurasi. Isi env SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY agar RSVP online bisa dipakai.",
        },
        {
          status: 503,
          headers: NO_STORE_HEADERS,
        },
      );
    }

    const localData = await appendRsvpEntry({
      name,
      attendance,
      message,
      createdAt,
    });

    return NextResponse.json(
      toRsvpResponse(localData, { hasSubmitted: true }),
      {
        status: 201,
        headers: NO_STORE_HEADERS,
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        message:
          error instanceof Error ? error.message : "Gagal mengirim RSVP.",
      },
      {
        status: error instanceof Error ? 503 : 500,
        headers: NO_STORE_HEADERS,
      },
    );
  }
}
