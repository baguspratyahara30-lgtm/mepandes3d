"use client";

import Image from "next/image";
import { useEffect, useEffectEvent, useRef, useState } from "react";
import {
  CalendarDays,
  Clock3,
  MapPin,
  Volume2,
  VolumeX,
  ScrollText,
  Send,
  Users,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const EVENT_DATE = new Date("2026-05-16T08:00:00+08:00");
const MAP_URL = "https://maps.app.goo.gl/AzgMmtC7bBV3vUAa8";
const BGM_TRACK = "/audio/Bali World Music, Gus Teja, Morning Happiness.mp3";
const PAGE_SCROLL_THRESHOLD = 140;
const PAGE_LOCK_DURATION_MS = 850;

type Attendance = "hadir" | "tidakHadir";

type RsvpSummary = {
  hadir: number;
  tidakHadir: number;
};

type RsvpResponse = {
  summary: RsvpSummary;
  lastGuest: string;
  lastMessage: string;
  messages: Array<{
    attendance: Attendance;
    name: string;
    message: string;
    createdAt: string;
  }>;
  hasSubmitted?: boolean;
};

type MetatahInvitationProps = {
  initialRsvp?: RsvpResponse | null;
};

const EMPTY_RSVP: RsvpResponse = {
  summary: { hadir: 0, tidakHadir: 0 },
  lastGuest: "",
  lastMessage: "",
  messages: [],
  hasSubmitted: false,
};

function normalizeRsvpResponse(payload: unknown): RsvpResponse {
  if (!payload || typeof payload !== "object") {
    return EMPTY_RSVP;
  }

  const data = payload as Partial<RsvpResponse>;
  return {
    summary: {
      hadir:
        typeof data.summary?.hadir === "number" ? data.summary.hadir : 0,
      tidakHadir:
        typeof data.summary?.tidakHadir === "number" ? data.summary.tidakHadir : 0,
    },
    lastGuest: typeof data.lastGuest === "string" ? data.lastGuest : "",
    lastMessage: typeof data.lastMessage === "string" ? data.lastMessage : "",
    messages: Array.isArray(data.messages)
      ? data.messages.filter(
          (item): item is RsvpResponse["messages"][number] =>
            Boolean(item) &&
            typeof item === "object" &&
            (item.attendance === "hadir" || item.attendance === "tidakHadir") &&
            typeof item.name === "string" &&
            typeof item.message === "string" &&
            typeof item.createdAt === "string",
        )
      : [],
    hasSubmitted: data.hasSubmitted === true,
  };
}

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
        "absolute inset-0 px-4 py-5 transition-all duration-700 ease-out",
        active
          ? "pointer-events-auto opacity-100 blur-0"
          : "pointer-events-none opacity-0 blur-[10px] translate-y-4",
      ].join(" ")}
    >
      <div className="relative z-10 mx-auto flex min-h-[calc(100svh-2.5rem)] w-full max-w-6xl items-center justify-center">
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
      <div className="metatah-accent text-3xl font-semibold tracking-[0.08em] text-[#6c4629]">
        {value}
      </div>
      <div className="mt-2 text-xs uppercase tracking-[0.28em] text-[#8d6748]">
        {label}
      </div>
    </div>
  );
}

function getScrollableAncestor(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) {
    return null;
  }

  return target.closest(
    "[data-allow-native-scroll='true']",
  ) as HTMLElement | null;
}

function canScrollInside(target: EventTarget | null, direction: 1 | -1): boolean {
  const scrollable = getScrollableAncestor(target);
  if (!scrollable) {
    return false;
  }

  const { scrollTop, scrollHeight, clientHeight } = scrollable;
  const maxScrollTop = scrollHeight - clientHeight;
  if (maxScrollTop <= 1) {
    return false;
  }

  if (direction === 1) {
    return scrollTop < maxScrollTop - 1;
  }

  return scrollTop > 1;
}

function getResponseText(payload: unknown, field: "message" | "warning") {
  if (!payload || typeof payload !== "object") {
    return "";
  }

  const value = (payload as Record<string, unknown>)[field];
  return typeof value === "string" ? value : "";
}

export function MetatahInvitation({
  initialRsvp,
}: MetatahInvitationProps) {
  const [currentPage, setCurrentPage] = useState(0);
  const [isMusicPlaying, setIsMusicPlaying] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [countdown, setCountdown] = useState<CountdownState>(getCountdown);
  const [summary, setSummary] = useState<RsvpSummary | null>(
    initialRsvp?.summary ?? null,
  );
  const [lastGuest, setLastGuest] = useState(initialRsvp?.lastGuest ?? "");
  const [lastMessage, setLastMessage] = useState(initialRsvp?.lastMessage ?? "");
  const [messages, setMessages] = useState<RsvpResponse["messages"]>(
    initialRsvp?.messages ?? [],
  );
  const [lastUpdatedAt, setLastUpdatedAt] = useState(
    initialRsvp
      ? new Date().toLocaleTimeString("id-ID", {
          hour: "2-digit",
          minute: "2-digit",
          second: "2-digit",
        })
      : "",
  );
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true,
  );
  const [isSubmitted, setIsSubmitted] = useState(initialRsvp?.hasSubmitted ?? false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [rsvpError, setRsvpError] = useState("");
  const [form, setForm] = useState<GuestForm>({
    name: "",
    attendance: "hadir",
    message: "",
  });
  const navigationLockRef = useRef(false);
  const navigationTimerRef = useRef<number | null>(null);
  const wheelDeltaRef = useRef(0);
  const touchStartYRef = useRef<number | null>(null);
  const touchStartTargetRef = useRef<EventTarget | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const totalPages = 5;
  const rsvpPage = 3;

  const applyRsvpPayload = (
    payload: RsvpResponse,
    options?: { updateSubmitted?: boolean },
  ) => {
    setSummary(payload.summary);
    setLastGuest(payload.lastGuest);
    setLastMessage(payload.lastMessage);
    setMessages(payload.messages ?? []);
    if (options?.updateSubmitted) {
      setIsSubmitted(payload.hasSubmitted ?? false);
    }
    setLastUpdatedAt(new Date().toLocaleTimeString("id-ID", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }));
  };

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setCountdown(getCountdown());
    }, 1000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;

    const loadRsvp = async () => {
      try {
        const response = await fetch("/api/rsvp", {
          method: "GET",
          cache: "no-store",
        });

        const responsePayload = await response.json().catch(() => null);
        if (!response.ok) {
          throw new Error(
            getResponseText(responsePayload, "message") ||
              "Gagal memuat data RSVP.",
          );
        }

        const payload = normalizeRsvpResponse(responsePayload);
        if (cancelled) {
          return;
        }
        applyRsvpPayload(payload);
        setRsvpError(getResponseText(responsePayload, "warning"));
      } catch (error) {
        if (cancelled) {
          return;
        }

        setRsvpError(
          error instanceof Error ? error.message : "Gagal memuat data RSVP.",
        );
      }
    };

    void loadRsvp();
    const pollId = window.setInterval(() => {
      void loadRsvp();
    }, 3000);

    return () => {
      cancelled = true;
      window.clearInterval(pollId);
    };
  }, []);

  useEffect(() => {
    return () => {
      if (navigationTimerRef.current) {
        window.clearTimeout(navigationTimerRef.current);
      }
    };
  }, []);

  const goToPage = (nextPage: number) => {
    const clamped = Math.max(0, Math.min(totalPages - 1, nextPage));
    setCurrentPage(clamped);
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
    const next = Math.max(0, Math.min(totalPages - 1, currentPage + direction));
    if (next === currentPage) {
      return;
    }
    lockNavigation();
    goToPage(next);
  });

  const playBackgroundMusic = useEffectEvent(async () => {
    if (!audioRef.current) {
      return;
    }

    try {
      await audioRef.current.play();
      setIsMusicPlaying(true);
    } catch {
      setIsMusicPlaying(false);
    }
  });

  const toggleMute = () => {
    if (!audioRef.current) {
      return;
    }

    const nextMuted = !audioRef.current.muted;
    audioRef.current.muted = nextMuted;
    setIsMuted(nextMuted);
  };

  useEffect(() => {
    if (!audioRef.current) {
      return;
    }

    audioRef.current.volume = 0.5;
    void playBackgroundMusic();
  }, []);

  useEffect(() => {
    const ensurePlayingAfterInteraction = () => {
      if (audioRef.current?.paused) {
        void playBackgroundMusic();
      }
    };

    window.addEventListener("pointerdown", ensurePlayingAfterInteraction, {
      once: true,
    });
    window.addEventListener("touchstart", ensurePlayingAfterInteraction, {
      once: true,
    });
    window.addEventListener("keydown", ensurePlayingAfterInteraction, {
      once: true,
    });

    return () => {
      window.removeEventListener("pointerdown", ensurePlayingAfterInteraction);
      window.removeEventListener("touchstart", ensurePlayingAfterInteraction);
      window.removeEventListener("keydown", ensurePlayingAfterInteraction);
    };
  }, []);

  useEffect(() => {
    const handleWheel = (event: WheelEvent) => {
      if (Math.abs(event.deltaY) < 6) {
        return;
      }
      const direction = event.deltaY > 0 ? 1 : -1;

      if (canScrollInside(event.target, direction)) {
        wheelDeltaRef.current = 0;
        return;
      }

      event.preventDefault();
      wheelDeltaRef.current += event.deltaY;
      if (Math.abs(wheelDeltaRef.current) < PAGE_SCROLL_THRESHOLD) {
        return;
      }
      movePageBy(wheelDeltaRef.current > 0 ? 1 : -1);
      wheelDeltaRef.current = 0;
    };

    const handleTouchStart = (event: TouchEvent) => {
      touchStartYRef.current = event.touches[0]?.clientY ?? null;
      touchStartTargetRef.current = event.target;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (touchStartYRef.current === null || navigationLockRef.current) {
        touchStartYRef.current = null;
        touchStartTargetRef.current = null;
        return;
      }
      const touchEndY = event.changedTouches[0]?.clientY ?? touchStartYRef.current;
      const deltaY = touchStartYRef.current - touchEndY;
      touchStartYRef.current = null;
      if (Math.abs(deltaY) < 55) {
        touchStartTargetRef.current = null;
        return;
      }
      const direction = deltaY > 0 ? 1 : -1;
      if (canScrollInside(touchStartTargetRef.current, direction)) {
        touchStartTargetRef.current = null;
        return;
      }
      movePageBy(direction);
      touchStartTargetRef.current = null;
    };

    window.addEventListener("wheel", handleWheel, { passive: false });
    window.addEventListener("touchstart", handleTouchStart, { passive: true });
    window.addEventListener("touchend", handleTouchEnd, { passive: true });

    return () => {
      window.removeEventListener("wheel", handleWheel);
      window.removeEventListener("touchstart", handleTouchStart);
      window.removeEventListener("touchend", handleTouchEnd);
    };
  }, []);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isSubmitted) {
      setRsvpError("RSVP sudah terkirim. Refresh halaman jika ingin mengisi lagi.");
      return;
    }

    if (!isOnline) {
      setRsvpError("Anda offline. Silakan sambungkan internet lalu refresh halaman untuk mengirim RSVP.");
      return;
    }

    const trimmedName = form.name.trim();
    if (!trimmedName) {
      return;
    }

    try {
      setIsSubmitting(true);
      setRsvpError("");

      const response = await fetch("/api/rsvp", {
        method: "POST",
        cache: "no-store",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: trimmedName,
          attendance: form.attendance,
          message: form.message.trim(),
        }),
      });

      const responsePayload = await response.json().catch(() => null);
      const payload = normalizeRsvpResponse(responsePayload);
      applyRsvpPayload(payload, { updateSubmitted: true });

      if (!response.ok) {
        throw new Error(
          getResponseText(responsePayload, "message") || "Gagal mengirim RSVP.",
        );
      }

      setRsvpError("");
      setForm({
        name: "",
        attendance: "hadir",
        message: "",
      });
    } catch (error) {
      setRsvpError(
        error instanceof Error ? error.message : "Gagal mengirim RSVP.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="relative h-[100svh] overflow-hidden bg-[#e8d2bb] text-[#4e301d] [overscroll-behavior-x:none] [touch-action:pan-y]">
      <audio
        ref={audioRef}
        src={BGM_TRACK}
        loop
        preload="auto"
        onPlay={() => setIsMusicPlaying(true)}
        onPause={() => setIsMusicPlaying(false)}
      />
      <button
        type="button"
        onClick={toggleMute}
        title={isMusicPlaying ? "Musik latar sedang diputar" : "Musik latar belum diputar"}
        className="absolute right-4 top-4 z-30 inline-flex h-11 items-center gap-2 rounded-full border border-[#8f6544]/25 bg-[#fff8f1]/85 px-4 text-xs uppercase tracking-[0.18em] text-[#6d472b] shadow-[0_10px_24px_rgba(86,53,26,0.2)] backdrop-blur"
      >
        {isMuted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        {isMuted ? "Unmute" : "Mute"}
      </button>
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#fff7ea_0%,#edd9c0_43%,#d7b596_100%)]" />
        <div className="absolute inset-x-0 top-[-8%] h-[58%] bg-[url('/metatah/blob.png')] bg-contain bg-top bg-no-repeat opacity-55" />
        <div className="absolute inset-0 bg-[url('/metatah/paper-texture.jpg')] bg-cover bg-center opacity-16 mix-blend-multiply" />
        <div className="absolute left-[-8%] top-[16%] h-60 w-60 rounded-full bg-[#f7eddc]/60 blur-3xl" />
        <div className="absolute bottom-[8%] right-[-6%] h-64 w-64 rounded-full bg-[#c59a71]/30 blur-3xl" />
      </div>

      <PagePanel active={currentPage === 0}>
        <div className="w-full max-w-4xl text-center">
          <div className="metatah-script text-[1.85rem] text-[#7f5130]">
            Om Swastyastu
          </div>
          <h1 className="metatah-display mt-3 text-[2.6rem] leading-[0.95] text-[#5f3820]">
            Mepandes
          </h1>
          <p className="metatah-accent mt-3 text-base tracking-[0.2em] text-[#8b684c] uppercase">
            {PEOPLE.map((person) => person.fullName).join(" . ")}
          </p>
          <p className="mx-auto mt-6 max-w-2xl text-sm leading-7 text-[#6a4a33]">
            Atas asung kerta wara nugraha Ida Sang Hyang Widhi Wasa, kami
            mengundang Bapak/Ibu/Saudara/i untuk hadir dalam rangkaian upacara
            mepandes yang kami selenggarakan penuh sukacita.
          </p>
        </div>
      </PagePanel>

      <PagePanel active={currentPage === 1}>
        <div
          data-allow-native-scroll="true"
          className="grid w-full max-h-[calc(100svh-3.5rem)] gap-4 overflow-y-auto pr-1"
        >
          <div className="metatah-card rounded-[2.4rem] p-5 shadow-[0_32px_55px_rgba(86,53,26,0.13)]">
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
              <h2 className="metatah-display mt-2 text-[2.1rem] text-[#5d3921]">
                16 Mei 2026
              </h2>
            </div>
            <div className="mt-6 grid gap-3 grid-cols-1">
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

          <div className="metatah-card rounded-[2.4rem] p-5 shadow-[0_32px_55px_rgba(86,53,26,0.13)]">
            <div className="flex items-center gap-3 text-[#7f5635]">
              <Clock3 className="size-5" />
              <span className="text-xs uppercase tracking-[0.3em]">
                Countdown Realtime
              </span>
            </div>
            <h3 className="metatah-display mt-5 text-[1.9rem] text-[#5d3921]">
              Menuju Hari Mepandes
            </h3>
            <p className="mt-3 max-w-xl text-sm leading-7 text-[#6d4e37]">
              Hitung mundur akan terus berjalan secara realtime hingga
              rangkaian acara dimulai pada Sabtu, 16 Mei 2026 pukul 08.00 WITA.
            </p>

            <div className="mt-8 grid grid-cols-2 gap-3">
              <CountCard value={countdown.days} label="Hari" />
              <CountCard value={countdown.hours} label="Jam" />
              <CountCard value={countdown.minutes} label="Menit" />
              <CountCard value={countdown.seconds} label="Detik" />
            </div>
          </div>
        </div>
      </PagePanel>

      <PagePanel active={currentPage === 2}>
        <div
          data-allow-native-scroll="true"
          className="w-full max-h-[calc(100svh-3.5rem)] overflow-y-auto pr-1"
        >
          <div className="mx-auto max-w-3xl text-center">
            <div className="inline-flex items-center gap-3 text-[#7f5635]">
              <Users className="size-5" />
              <span className="text-xs uppercase tracking-[0.3em]">
                  Mepandes
              </span>
            </div>
          </div>

          <div className="mt-6 grid gap-4 grid-cols-1">
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
                    className="h-[300px] w-full object-cover object-center"
                  />
                </div>
                <div className="px-4 pb-4 pt-5 text-center">
                  <p className="metatah-script text-[1.75rem] text-[#8b6441]">
                    Mepandes
                  </p>
                  <h3 className="metatah-display mt-2 text-[1.7rem] leading-tight text-[#5b3720]">
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

      <PagePanel active={currentPage === rsvpPage}>
        <div
          data-allow-native-scroll="true"
          className="grid w-full max-h-[calc(100svh-3.5rem)] gap-4 overflow-y-auto pr-1"
        >
          <div className="metatah-card relative overflow-hidden rounded-[2.4rem] p-5 shadow-[0_32px_55px_rgba(86,53,26,0.13)]">
            <div className="absolute inset-0 bg-[url('/metatah/rsvp-card.png')] bg-cover bg-center opacity-[0.14]" />
            <div className="relative">
              <div className="flex items-center gap-3 text-[#7f5635]">
                <ScrollText className="size-5" />
                <span className="text-xs uppercase tracking-[0.3em]">
                  Buku Tamu
                </span>
              </div>
              <h2 className="metatah-display mt-5 text-[2.1rem] text-[#5d3921]">
                RSVP
              </h2>
              <p className="mt-4 text-sm leading-7 text-[#6a4b36]">
                Silakan isi kehadiran dan ucapan singkat Anda. Data RSVP ini
                akan tersimpan di website agar jumlah kehadiran dapat terlihat
                saat halaman dibuka secara online.
              </p>

              <div className="mt-8 grid grid-cols-2 gap-4">
                <div className="rounded-[2rem] border border-[#9a724f]/15 bg-[#fff8f1]/72 p-5 text-center">
                  <div className="metatah-accent text-4xl font-semibold text-[#7d5636]">
                    {summary?.hadir ?? "—"}
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.28em] text-[#9d7657]">
                    Hadir
                  </div>
                </div>
                <div className="rounded-[2rem] border border-[#9a724f]/15 bg-[#fff8f1]/72 p-5 text-center">
                  <div className="metatah-accent text-4xl font-semibold text-[#7d5636]">
                    {summary?.tidakHadir ?? "—"}
                  </div>
                  <div className="mt-2 text-xs uppercase tracking-[0.28em] text-[#9d7657]">
                    Tidak Hadir
                  </div>
                </div>
              </div>

              <div className="mt-3 text-sm leading-6 text-[#6a4b36]">
                Data kehadiran dan doa tamu akan diperbarui secara realtime saat
                halaman ini dibuka.
              </div>
              <div className="mt-1 text-xs uppercase tracking-[0.3em] text-[#8b6441]">
                {lastUpdatedAt
                  ? `Terakhir diperbarui: ${lastUpdatedAt}`
                  : "Memuat data RSVP..."}
              </div>

              <div className="mt-8 rounded-[2rem] border border-[#9a724f]/15 bg-[#fff9f4]/75 p-5">
                <p className="metatah-script text-[1.5rem] text-[#8b6441]">Doa Tamu</p>
                <p className="mt-2 text-sm leading-7 text-[#6a4b36]">
                  {lastGuest && lastMessage
                    ? `Terakhir: "${lastMessage}" - ${lastGuest}`
                    : "Belum ada pesan tamu. Kirim ucapan pertama sekarang."}
                </p>
                <div className="mt-4 max-h-52 space-y-3 overflow-y-auto rounded-2xl border border-[#9a724f]/15 bg-[#fffefb] p-3">
                  {messages.length === 0 ? (
                    <p className="text-sm text-[#8a6143]">
                      Belum ada chat yang tampil.
                    </p>
                  ) : (
                    messages.map((item) => (
                      <article
                        key={`${item.createdAt}-${item.name}`}
                        className="rounded-xl border border-[#9a724f]/10 bg-[#fff8f1] p-3"
                      >
                        <p className="text-xs uppercase tracking-[0.2em] text-[#91694a]">
                          {item.name}
                        </p>
                        <p className="mt-2 inline-flex rounded-full border border-[#8d6442]/15 bg-[#fffdf7] px-3 py-1 text-[10px] uppercase tracking-[0.22em] text-[#8d6442]">
                          {item.attendance === "hadir" ? "Hadir" : "Tidak Hadir"}
                        </p>
                        <p className="mt-1 text-sm leading-6 text-[#6a4b36]">
                          {item.message}
                        </p>
                      </article>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>

          <form
            onSubmit={handleSubmit}
            className="metatah-card rounded-[2.4rem] p-5 shadow-[0_32px_55px_rgba(86,53,26,0.13)]"
          >
            <h3 className="metatah-display text-[1.9rem] text-[#5d3921]">
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
                  disabled={isSubmitted}
                  autoComplete="name"
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
                <div className="grid gap-3 grid-cols-1">
                  <button
                    type="button"
                    disabled={isSubmitted}
                    onClick={() => {
                      if (isSubmitted) {
                        return;
                      }
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
                    disabled={isSubmitted}
                    onClick={() => {
                      if (isSubmitted) {
                        return;
                      }
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
                  Doa & Ucapan
                </label>
                <textarea
                  value={form.message}
                  disabled={isSubmitted}
                  onChange={(event) => {
                    setForm((current) => ({
                      ...current,
                      message: event.target.value,
                    }));
                  }}
                  rows={5}
                  placeholder="Titipkan doa dan ucapan terbaik Anda"
                  className="w-full rounded-[1.8rem] border border-[#9b724f]/15 bg-[#fff8f1]/80 px-4 py-3 text-sm leading-7 text-[#5e3a22] outline-none transition placeholder:text-[#b28a68] focus:border-[#855738]/35"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-4">
              <Button
                type="submit"
                disabled={isSubmitting || isSubmitted}
                aria-disabled={isSubmitting || isSubmitted}
                className="h-12 rounded-full border border-[#8f6544]/20 bg-[#74482b] px-6 text-xs uppercase tracking-[0.24em] text-[#fff8f2] transition hover:bg-[#5f3820]"
              >
                <Send className="size-4" />
                {isSubmitting
                  ? "Mengirim..."
                  : isSubmitted
                    ? "RSVP Terkirim"
                    : "Kirim RSVP"}
              </Button>
              <p className="text-sm text-[#8a6143]">
                {isSubmitted
                  ? "Terima kasih, RSVP dari perangkat ini sudah tersimpan dan tombol kirim otomatis dinonaktifkan."
                  : rsvpError || "Isi minimal nama untuk menyimpan RSVP."}
              </p>
            </div>
          </form>
        </div>
      </PagePanel>

      <PagePanel active={currentPage === totalPages - 1}>
        <div className="metatah-card relative w-full max-w-4xl overflow-hidden rounded-[2.6rem] px-5 py-10 text-center shadow-[0_36px_70px_rgba(86,53,26,0.14)]">
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
            <p className="metatah-script text-[1.8rem] text-[#8d6442]">
              Suksma
            </p>
            <h2 className="metatah-display mt-3 text-[2.5rem] leading-tight text-[#5d3921]">
              Terima Kasih
            </h2>
            <p className="mt-6 text-sm leading-8 text-[#6a4b36]">
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

            <div className="mt-8 flex flex-col items-center justify-center gap-3">
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
                onClick={() => goToPage(rsvpPage)}
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
