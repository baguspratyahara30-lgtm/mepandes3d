import { NextResponse } from "next/server";

import { type Attendance } from "@/lib/rsvp-store";
import { getCurrentRsvpResponse, pushRsvpEntry } from "@/lib/rsvp-service";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const NO_STORE_HEADERS = { "Cache-Control": "no-store" };

function isAttendance(value: unknown): value is Attendance {
  return value === "hadir" || value === "tidakHadir";
}

export async function GET() {
  try {
    const response = await getCurrentRsvpResponse();
    return NextResponse.json(response, {
      status: 200,
      headers: NO_STORE_HEADERS,
    });
  } catch (error) {
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

    const response = await pushRsvpEntry({
      name,
      attendance,
      message,
      createdAt: new Date().toISOString(),
    });

    return NextResponse.json(response, {
      status: 201,
      headers: NO_STORE_HEADERS,
    });
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
