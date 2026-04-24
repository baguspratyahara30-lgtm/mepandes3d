"use client";

import Image from "next/image";
import { startTransition, useEffect, useEffectEvent, useRef, useState } from "react";
import {
  CalendarDays,
  Clock3,
  MapPin,
  ScrollText,
  Send,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EVENT_DATE = new Date("2026-05-16T08:00:00+08:00");
const MAP_URL = "https://maps.app.goo.gl/AzgMmtC7bBV3vUAa8";
const PAGE_SCROLL_THRESHOLD = 90;
const PAGE_LOCK_DURATION_MS = 820;

type Attendance = "hadir" | "tidakHadir";

type RsvpSummary = {
  hadir: number;
  tidakHadir: number;
};

type RsvpResponse = {
  summary: RsvpSummary;
  lastGuest: string;
};

type CountdownState = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
  finished: boolean;
};

type GuestForm = {
  name: string;
  attendance: Attendance;
  message: string;
};

const PEOPLE = [
  {
    fullName: "Dinda",
    fullNameDisplay: "Putu Dinda Putri Devina",
    role: "Anak pertama dari pasangan Bapak Komang Eka Budiwirawan dan Luh Yulik Damayanti",
    image: "/metatah/dinda.jpg",
  },
  {
    fullName: "Diana",
    fullNameDisplay: "Kadek Diana Tyas Nirmala",
    role: "Anak kedua dari pasangan Bapak Komang Eka Budiwirawan dan Luh Yulik Damayanti",
    image: "/metatah/diana.jpg",
  },
  {
    fullName: "Danta",
    fullNameDisplay: "Komang Danta Anugerah Wirawan",
    role: "Anak ketiga dari pasangan Bapak Komang Eka Budiwirawan dan Luh Yulik Damayanti",
    image: "/metatah/danta.jpg",
  },
];

function getCountdown(): CountdownState {
  const diff = EVENT_DATE.getTime() - Date.now();

  if (diff <= 0) {
    return {
      days: "00",
      hours: "00",
      minutes: "00",
      seconds: "00",
      finished: true,
    };
  }

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff / (1000 * 60 * 60)) % 24);
  const minutes = Math.floor((diff / (1000 * 60)) % 60);
  const seconds = Math.floor((diff / 1000) % 60);

  return {
    days: String(days).padStart(2, "0"),
    hours: String(hours).padStart(2, "0"),
    minutes: String(minutes).padStart(2, "0"),
    seconds: String(seconds).padStart(2, "0"),
    finished: false,
  };
}

function clampPage(page: number) {
  return Math.max(0, Math.min(4, page));
}

function PagePanel({
  active,
  children,
}: {
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <section
      aria-hidden={!active}
      className={[
        "metatah-fade-panel absolute inset-0 px-4 py-6 sm:px-6 sm:py-8",
        active
          ? "pointer-events-auto opacity-100 blur-0"
          : "pointer-events-none opacity-0 blur-[10px]",
      ].join(" ")}
    >
      <div className="mx-auto flex h-full w-full max-w-6xl items-center justify-center">
        {children}
      </div>
    </section>
  );
}

function CountCard({
  value,
  label,
}: {
  value: string | number;
  label: string;
}) {
  return (
    <div className="metatah-card rounded-[2rem] px-4 py-5 text-center shadow-[0_24px_45px_rgba(82,49,25,0.12)]">
      <div className="metatah-accent text-3xl font-semibold tracking-[0.08em] text-[#6c4629] sm:text-4xl">
        {value}
      </div>
      <div className="mt-2 text-xs uppercase tracking-[0.28em] text-[#8d6748]">
        {label}
      </div>
    </div>
  );
}

export function MetatahInvitation() {
  const [currentPage, setCurrentPage] = useState(0);
  const [isOpening, setIsOpening] = useState(false);
  const [hasOpened, setHasOpened] = useState(false);
  const [countdown, setCountdown] = useState<CountdownState>(getCountdown);
  const [summary, setSummary] = useState<RsvpSummary>({
    hadir: 0,
    tidakHadir: 0,
  });
  const [lastGuest, setLastGuest] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rsvpError, setRsvpError] = useState("");
  const [form, setForm] = useState<GuestForm>({
    name: "",
    attendance: "hadir",
    message: "",
  });
  const openTimerRef = useRef<number | null>(null);
  const navigationLockRef = useRef(false);
  const navigationTimerRef = useRef<number | null>(null);
  const wheelDeltaRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCountdown(getCountdown());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const abortController = new AbortController();

    const loadRsvp = async () => {
      try {
        const response = await fetch("/api/rsvp", {
          method: "GET",
          cache: "no-store",
          signal: abortController.signal,
        });

        if (!response.ok) {
          throw new Error("Gagal memuat data RSVP.");
        }

        const payload = (await response.json()) as RsvpResponse;
        setSummary(payload.summary);
        setLastGuest(payload.lastGuest);
        setRsvpError("");
      } catch (error) {
        if (abortController.signal.aborted) {
          return;
        }

        setRsvpError(
          error instanceof Error ? error.message : "Gagal memuat data RSVP.",
        );
      }
    };

    void loadRsvp();

    return () => abortController.abort();
  }, []);

  useEffect(() => {
    return () => {
      if (openTimerRef.current) {
        window.clearTimeout(openTimerRef.current);
      }
      if (navigationTimerRef.current) {
        window.clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

  const goToPage = (page: number) => {
    startTransition(() => {
      setCurrentPage(clampPage(page));
    });
  };

  const lockNavigation = () => {
    navigationLockRef.current = true;

    if (navigationTimerRef.current) {
      window.clearTimeout(navigationTimerRef.current);
    }

    navigationTimerRef.current = window.setTimeout(() => {
      navigationLockRef.current = false;
      wheelDeltaRef.current = 0;
    }, PAGE_LOCK_DURATION_MS);
  };

  const movePageBy = useEffectEvent((direction: 1 | -1) => {
    if (navigationLockRef.current) {
      return;
    }

    const nextPage = clampPage(currentPage + direction);
    if (nextPage === currentPage) {
      return;
    }

    lockNavigation();
    goToPage(nextPage);
  });

  const openInvitation = () => {
    if (isOpening) {
      return;
    }

    setIsOpening(true);

    openTimerRef.current = window.setTimeout(() => {
      setHasOpened(true);
      setIsOpening(false);
      goToPage(1);
    }, 1150);
  };

  useEffect(() => {
    if (!hasOpened) {
      return;
    }

    const isInteractiveTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) {
        return false;
      }

      return Boolean(
        target.closest(
          "input, textarea, select, button, a, [contenteditable='true'], [data-allow-native-scroll='true']",
        ),
      );
    };

    const handleWheel = (event: WheelEvent) => {
      if (isInteractiveTarget(event.target)) {
        return;
      }

      if (Math.abs(event.deltaY) < 6) {
        return;
      }

      event.preventDefault();

      if (navigationLockRef.current) {
        return;
      }

      wheelDeltaRef.current += event.deltaY;

      if (Math.abs(wheelDeltaRef.current) < PAGE_SCROLL_THRESHOLD) {
        return;
      }

      movePageBy(wheelDeltaRef.current > 0 ? 1 : -1);
      wheelDeltaRef.current = 0;
    };

    const handleTouchStart = (event: TouchEvent) => {
      if (isInteractiveTarget(event.target)) {
        touchStartYRef.current = null;
        return;
      }

      touchStartYRef.current = event.touches[0]?.clientY ?? null;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (touchStartYRef.current === null || navigationLockRef.current) {
        touchStartYRef.current = null;
        return;
      }

      const touchEndY = event.changedTouches[0]?.clientY ?? touchStartYRef.current;
      const deltaY = touchStartYRef.current - touchEndY;

      touchStartYRef.current = null;

      if (Math.abs(deltaY) < 60) {
        return;
      }

      if (isInteractiveTarget(event.target)) {
        return;
      }

      movePageBy(deltaY > 0 ? 1 : -1);
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, [hasOpened]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      return;
    }

    try {
      setIsSubmitting(true);
      setRsvpError("");

      const response = await fetch("/api/rsvp", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          attendance: form.attendance,
          message: form.message.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error("Gagal mengirim RSVP.");
      }

      const payload = (await response.json()) as RsvpResponse;
      setSummary(payload.summary);
      setLastGuest(payload.lastGuest);
      setIsSubmitted(true);
      setForm({
        name: "",
        attendance: "hadir",
        message: "",
      });
    } catch (error) {
      setIsSubmitted(false);
      setRsvpError(
        error instanceof Error ? error.message : "Gagal mengirim RSVP.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative h-[100svh] overflow-hidden bg-[#e8d2bb] text-[#4e301d]">
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#fff7ea_0%,#edd9c0_43%,#d7b596_100%)]" />
        <div className="absolute inset-x-0 top-[-8%] h-[58%] bg-[url('/metatah/blob.png')] bg-contain bg-top bg-no-repeat opacity-55" />
        <div className="absolute inset-0 bg-[url('/metatah/paper-texture.jpg')] bg-cover bg-center opacity-16 mix-blend-multiply" />
        <div className="absolute left-[-8%] top-[16%] h-64 w-64 rounded-full bg-[#f7eddc]/60 blur-3xl sm:h-80 sm:w-80" />
        <div className="absolute bottom-[8%] right-[-6%] h-72 w-72 rounded-full bg-[#c59a71]/30 blur-3xl sm:h-96 sm:w-96" />
      </div>

      <PagePanel active={currentPage === 0}>
        <div className="w-full max-w-4xl text-center">
          <div className="metatah-script text-[2rem] text-[#7f5130] sm:text-[2.6rem]">
            Om Swastyastu
          </div>
          <h1 className="metatah-display mt-3 text-4xl leading-[0.95] text-[#5f3820] sm:text-6xl">
            Mepandes
          </h1>
          <p className="metatah-accent mt-3 text-lg tracking-[0.24em] text-[#8b684c] uppercase sm:text-xl">
            {PEOPLE.map((person) => person.fullName).join(" . ")}
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-[#6a4a33] sm:text-base">
            Atas asung kerta wara nugraha Ida Sang Hyang Widhi Wasa, kami
            mengundang Bapak/Ibu/Saudara/i untuk hadir dalam rangkaian upacara
            mepandes yang kami selenggarakan penuh sukacita.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4">
            <Button
              type="button"
              onClick={openInvitation}
              className="h-12 rounded-full border border-[#8f6544]/20 bg-[#74482b] px-7 text-sm uppercase tracking-[0.22em] text-[#fff7f0] shadow-[0_18px_40px_rgba(97,57,29,0.25)] transition hover:bg-[#5f3820]"
            >
              Buka Undangan
            </Button>
            <p className="text-xs uppercase tracking-[0.28em] text-[#9f7757]">
              Surat akan terbuka menuju halaman berikutnya
            </p>
          </div>
        </div>
      </PagePanel>

      <PagePanel active={currentPage === 1}>
        <div className="grid w-full gap-6 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="metatah-card rounded-[2.6rem] p-6 shadow-[0_32px_55px_rgba(86,53,26,0.13)] sm:p-8">
            <div className="flex items-center gap-3 text-[#7f5635]">
              <CalendarDays className="size-5" />
              <span className="text-xs uppercase tracking-[0.3em]">
                Hari Acara
              </span>
            </div>
            <div className="mt-5">
              <p className="metatah-script text-[2rem] text-[#8d6442]">
                Save the Date
              </p>
              <h2 className="metatah-display mt-2 text-4xl text-[#5d3921] sm:text-5xl">
                16 Mei 2026
              </h2>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-[1.8rem] bg-[#fff7ef]/75 p-4">
                <p className="metatah-accent text-xs uppercase tracking-[0.24em] text-[#9a7354]">
                  Hari
                </p>
                <p className="mt-2 text-lg font-semibold text-[#5d3921]">
                  Sabtu
                </p>
              </div>
              <div className="rounded-[1.8rem] bg-[#fff7ef]/75 p-4">
                <p className="metatah-accent text-xs uppercase tracking-[0.24em] text-[#9a7354]">
                  Waktu
                </p>
                <p className="mt-2 text-lg font-semibold text-[#5d3921]">
                  08.00 - 12.00
                </p>
              </div>
              <div className="rounded-[1.8rem] bg-[#fff7ef]/75 p-4">
                <p className="metatah-accent text-xs uppercase tracking-[0.24em] text-[#9a7354]">
                  Zona
                </p>
                <p className="mt-2 text-lg font-semibold text-[#5d3921]">
                  WITA
                </p>
              </div>
            </div>
            <div className="mt-6 rounded-[2rem] border border-[#9b724f]/15 bg-[#f5eadb]/80 p-5">
              <div className="flex items-center gap-3 text-[#7f5635]">
                <MapPin className="size-5" />
                <span className="text-xs uppercase tracking-[0.3em]">
                  Lokasi
                </span>
              </div>
              <p className="mt-3 text-xl font-semibold text-[#5d3921]">
                Yayasan Santhi Yadnya
              </p>
              <p className="mt-2 text-sm leading-7 text-[#6d4e37]">
                Mohon catat tanggalnya dan mari bertemu dalam suasana hangat,
                penuh doa, serta kebersamaan keluarga.
              </p>
              <a
                href={MAP_URL}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex h-11 items-center justify-center rounded-full border border-[#835637]/20 bg-[#74482b] px-6 text-xs uppercase tracking-[0.24em] text-[#fff8f2] transition hover:bg-[#60371f]"
              >
                Buka Lokasi
              </a>
            </div>
          </div>

          <div className="metatah-card rounded-[2.6rem] p-6 shadow-[0_32px_55px_rgba(86,53,26,0.13)] sm:p-8">
            <div className="flex items-center gap-3 text-[#7f5635]">
              <Clock3 className="size-5" />
              <span className="text-xs uppercase tracking-[0.3em]">
                Countdown Realtime
              </span>
            </div>
            <h3 className="metatah-display mt-5 text-3xl text-[#5d3921] sm:text-4xl">
              Menuju Hari Mepandes
            </h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-[#6d4e37] sm:text-base">
              Hitung mundur akan terus berjalan secara realtime hingga
              rangkaian acara dimulai pada Sabtu, 16 Mei 2026 pukul 08.00 WITA.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
              <CountCard value={countdown.days} label="Hari" />
              <CountCard value={countdown.hours} label="Jam" />
              <CountCard value={countdown.minutes} label="Menit" />
              <CountCard value={countdown.seconds} label="Detik" />
            </div>
          </div>
        </div>
      </PagePanel>

      <PagePanel active={currentPage === 2}>
        <div className="w-full">
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-3 text-[#7f5635]">
              <Users className="size-5" />
              <span className="text-xs uppercase tracking-[0.3em]">
                Yang Melaksanakan Mepandes
              </span>
            </div>
            <h2 className="metatah-script mt-5 text-[2.4rem] text-[#7f5130] sm:text-[3.2rem]">
              Mepandes
            </h2>
          </div>

          <div className="mt-8 grid gap-5 lg:grid-cols-3">
            {PEOPLE.map((person) => (
              <article
                key={person.fullName}
                className="metatah-card overflow-hidden rounded-[2.5rem] p-4 shadow-[0_30px_50px_rgba(86,53,26,0.12)]"
              >
                <div className="relative overflow-hidden rounded-[2rem] bg-[#f2e0ca]">
                  <div className="absolute inset-x-0 top-0 z-10">
                    <Image
                      src="/metatah/ornament-top.png"
                      alt=""
                      width={1918}
                      height={476}
                      className="mx-auto w-[76%] opacity-60"
                    />
                  </div>
                  <Image
                    src={person.image}
                    alt={person.fullName}
                    width={740}
                    height={820}
                    className="h-[320px] w-full object-cover object-center sm:h-[360px]"
                  />
                </div>
                <div className="px-4 pb-4 pt-5 text-center">
                  <p className="metatah-script text-[1.75rem] text-[#8b6441]">
                    Mepandes
                  </p>
                  <h3 className="metatah-display mt-2 text-2xl leading-tight text-[#5b3720] sm:text-3xl">
                    {person.fullNameDisplay}
                  </h3>
                  <p className="mt-3 text-sm leading-7 text-[#7f5a3d]">
                    {person.role}
                  </p>
                </div>
              </article>
            ))}
          </div>
        </div>
      </PagePanel>

      <PagePanel active={currentPage === 3}>
        <div className="grid w-full gap-6 lg:grid-cols-[0.86fr_1.14fr]">
          <div className="metatah-card relative overflow-hidden rounded-[2.6rem] p-6 shadow-[0_32px_55px_rgba(86,53,26,0.13)] sm:p-8">
            <div className="absolute inset-0 bg-[url('/metatah/rsvp-card.png')] bg-cover bg-center opacity-[0.14]" />
            <div className="relative">
              <div className="flex items-center gap-3 text-[#7f5635]">
                <ScrollText className="size-5" />
                <span className="text-xs uppercase tracking-[0.3em]">
                  Buku Tamu
                </span>
              </div>
              <h2 className="metatah-display mt-5 text-4xl text-[#5d3921] sm:text-5xl">
                RSVP
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#6a4b36] sm:text-base">
                Silakan isi kehadiran dan ucapan singkat Anda. Data RSVP ini
                akan tersimpan di website agar jumlah kehadiran dapat terlihat
                saat halaman dibuka secara online.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-[2rem] border border-[#9a724f]/15 bg-[#fff8f1]/72 p-5 text-center">
                  <div className="metatah-accent text-4xl font-semibold text-[#7d5636]">
                    {summary.hadir}
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.28em] text-[#9d7657]">
                    Hadir
                  </div>
                </div>
                <div className="rounded-[2rem] border border-[#9a724f]/15 bg-[#fff8f1]/72 p-5 text-center">
                  <div className="metatah-accent text-4xl font-semibold text-[#7d5636]">
                    {summary.tidakHadir}
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.28em] text-[#9d7657]">
                    Tidak Hadir
                  </div>
                </div>
              </div>

              <div className="mt-8 rounded-[2rem] border border-[#9a724f]/15 bg-[#fff9f4]/75 p-5">
                <p className="metatah-script text-[1.5rem] text-[#8b6441]">
                  Sapaan terakhir
                </p>
                <p className="mt-2 text-sm leading-7 text-[#6a4b36]">
                  {lastGuest
                    ? `${lastGuest} sudah meninggalkan jejak hangat di buku tamu ini.`
                    : "Belum ada nama yang tersimpan. Jadilah yang pertama mengisi buku tamu."}
                </p>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="metatah-card rounded-[2.6rem] p-6 shadow-[0_32px_55px_rgba(86,53,26,0.13)] sm:p-8"
          >
            <h3 className="metatah-display text-3xl text-[#5d3921] sm:text-4xl">
              Isi Data Anda
            </h3>
            <p className="mt-3 text-sm leading-7 text-[#6a4b36]">
              Kehadiran dan doa restu Anda menjadi kebahagiaan tersendiri bagi
              keluarga kami.
            </p>

            <div className="mt-6 space-y-4">
              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.24em] text-[#91694a]">
                  Nama
                </label>
                <Input
                  value={form.name}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      name: event.target.value,
                    }));
                  }}
                  placeholder="Tuliskan nama Anda"
                  className="h-12 rounded-2xl border-[#9b724f]/15 bg-[#fff8f1]/80 px-4 text-[#5e3a22] placeholder:text-[#b28a68]"
                />
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.24em] text-[#91694a]">
                  Kehadiran
                </label>
                <div className="grid gap-3 sm:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setForm((current) => ({
                        ...current,
                        attendance: "hadir",
                      }));
                    }}
                    className={[
                      "rounded-[1.6rem] border px-4 py-4 text-left transition",
                      form.attendance === "hadir"
                        ? "border-[#7b5232]/25 bg-[#74482b] text-[#fff8f2]"
                        : "border-[#9b724f]/15 bg-[#fff8f1]/75 text-[#6a4b36]",
                    ].join(" ")}
                  >
                    <div className="metatah-accent text-lg font-semibold">
                      Hadir
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.2em] opacity-80">
                      Siap datang
                    </div>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setForm((current) => ({
                        ...current,
                        attendance: "tidakHadir",
                      }));
                    }}
                    className={[
                      "rounded-[1.6rem] border px-4 py-4 text-left transition",
                      form.attendance === "tidakHadir"
                        ? "border-[#7b5232]/25 bg-[#74482b] text-[#fff8f2]"
                        : "border-[#9b724f]/15 bg-[#fff8f1]/75 text-[#6a4b36]",
                    ].join(" ")}
                  >
                    <div className="metatah-accent text-lg font-semibold">
                      Tidak Hadir
                    </div>
                    <div className="mt-1 text-xs uppercase tracking-[0.2em] opacity-80">
                      Kirim doa
                    </div>
                  </button>
                </div>
              </div>

              <div className="space-y-2">
                <label className="text-xs uppercase tracking-[0.24em] text-[#91694a]">
                  Ucapan
                </label>
                <textarea
                  value={form.message}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      message: event.target.value,
                    }));
                    setIsSubmitted(false);
                  }}
                  rows={5}
                  placeholder="Titipkan doa dan ucapan terbaik Anda"
                  className="w-full rounded-[1.8rem] border border-[#9b724f]/15 bg-[#fff8f1]/80 px-4 py-3 text-sm leading-7 text-[#5e3a22] outline-none transition placeholder:text-[#b28a68] focus:border-[#855738]/35"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="h-12 rounded-full border border-[#8f6544]/20 bg-[#74482b] px-6 text-xs uppercase tracking-[0.24em] text-[#fff8f2] transition hover:bg-[#5f3820]"
              >
                <Send className="size-4" />
                {isSubmitting ? "Mengirim..." : "Kirim RSVP"}
              </Button>
              <p className="text-sm text-[#8a6143]">
                {isSubmitted
                  ? "Terima kasih, data RSVP Anda sudah tersimpan di website."
                  : rsvpError || "Isi minimal nama untuk menyimpan RSVP."}
              </p>
            </div>
          </form>
        </div>
      </PagePanel>

      <PagePanel active={currentPage === 4}>
        <div className="metatah-card relative w-full max-w-4xl overflow-hidden rounded-[3rem] px-6 py-12 text-center shadow-[0_36px_70px_rgba(86,53,26,0.14)] sm:px-10 sm:py-16">
          <div className="absolute inset-x-0 top-0">
            <Image
              src="/metatah/ornament-top.png"
              alt=""
              width={1918}
              height={476}
              className="mx-auto w-[72%] opacity-75"
            />
          </div>
          <div className="absolute inset-x-0 bottom-0">
            <Image
              src="/metatah/ornament-bottom.png"
              alt=""
              width={1920}
              height={438}
              className="mx-auto w-[72%] opacity-75"
            />
          </div>

          <div className="relative mx-auto max-w-2xl">
            <p className="metatah-script text-[2rem] text-[#8d6442] sm:text-[2.5rem]">
              Suksma
            </p>
            <h2 className="metatah-display mt-3 text-4xl leading-tight text-[#5d3921] sm:text-6xl">
              Terima Kasih
            </h2>
            <p className="mt-6 text-sm leading-8 text-[#6a4b36] sm:text-base">
              Merupakan kebanggaan dan kebahagiaan bagi kami sekeluarga apabila
              Bapak/Ibu/Saudara/i berkenan hadir. Atas kehadiran serta doa
              restunya, kami mengucapkan terima kasih.
            </p>

            <div className="mt-8 rounded-[2rem] border border-[#9b724f]/15 bg-[#fff8f1]/70 p-5">
              <p className="text-xs uppercase tracking-[0.3em] text-[#9d7657]">
                Sampai Jumpa Di Hari Acara
              </p>
              <p className="mt-3 text-lg font-semibold text-[#5d3921]">
                16 Mei 2026 . 08.00 WITA . Yayasan Santhi Yadnya
              </p>
            </div>

            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                type="button"
                onClick={() => goToPage(0)}
                variant="outline"
                className="h-12 rounded-full border-[#8e6545]/20 bg-[#fff8f2]/75 px-6 text-xs uppercase tracking-[0.24em] text-[#6d472b]"
              >
                Lihat Surat Lagi
              </Button>
              <Button
                type="button"
                onClick={() => goToPage(3)}
                className="h-12 rounded-full border border-[#8f6544]/20 bg-[#74482b] px-6 text-xs uppercase tracking-[0.24em] text-[#fff8f2] transition hover:bg-[#5f3820]"
              >
                Kembali ke RSVP
              </Button>
            </div>
          </div>
        </div>
      </PagePanel>

    </main>
  );
}
