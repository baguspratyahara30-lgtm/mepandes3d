import { NextResponse } from "next/server";

import {
  getRsvpStorageMode,
  readRsvpStore,
  submitRsvp,
  type Attendance,
} from "@/lib/rsvp-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const store = await readRsvpStore();

    return NextResponse.json({
      lastGuest: store.lastGuest,
      storage: getRsvpStorageMode(),
      summary: store.summary,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "RSVP online belum dikonfigurasi. Hubungkan Upstash Redis saat deploy ke Vercel.",
      },
      { status: 503 },
    );
  }
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as Partial<{
      attendance: Attendance;
      message: string;
      name: string;
    }>;

    const name = body.name?.trim();
    const attendance = body.attendance;
    const message = body.message?.trim() ?? "";

    if (!name) {
      return NextResponse.json(
        { error: "Nama wajib diisi." },
        { status: 400 },
      );
    }

    if (attendance !== "hadir" && attendance !== "tidakHadir") {
      return NextResponse.json(
        { error: "Status kehadiran tidak valid." },
        { status: 400 },
      );
    }

    const nextStore = await submitRsvp({
      attendance,
      message,
      name,
    });

    return NextResponse.json({
      lastGuest: nextStore.lastGuest,
      storage: getRsvpStorageMode(),
      summary: nextStore.summary,
    });
  } catch {
    return NextResponse.json(
      {
        error:
          "Terjadi kesalahan saat menyimpan RSVP. Pastikan Upstash Redis sudah terhubung di Vercel.",
      },
      { status: 503 },
    );
  }
}
