// src/components/hours/HoursSection.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { db } from "@/lib/firebase";
import { useSiteKey } from "@/lib/atoms/siteKeyAtom";
import { doc, onSnapshot } from "firebase/firestore";
import clsx from "clsx";
import { useUILang } from "@/lib/atoms/uiLangAtom";
import { motion } from "framer-motion";
import { StaggerChars } from "@/components/animated/StaggerChars";

/** Firestore 保存スキーマ（BusinessHoursCard に一致） */
type DayKey = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
type TimeRange = { start: string; end: string };
type DayHours = { closed?: boolean; ranges?: TimeRange[] };
type BusinessHours = {
  enabled?: boolean;
  tz?: string;
  days?: Partial<Record<DayKey, DayHours>>;
  notes?: string;
  note?: string; // 互換
};

const DAY_ORDER: DayKey[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

type HoursI18n = {
  title: string;
  srTitle: string;
  loading: string;
  noHoursStatic: string;
  todayClosed: string;
  todayNoRange: string;
  todayOpenPattern: string; // {start}, {end}
  todayHoursPattern: string; // {start}, {end}
  tableDayHeader: string;
  tableHoursHeader: string;
  labelClosed: string;
  labelTodayBadge: string;
  note: string;
};

/** 曜日ラベル（多言語） */
const DAY_LABELS: Record<string, Record<DayKey, string>> = {
  ja: {
    mon: "月",
    tue: "火",
    wed: "水",
    thu: "木",
    fri: "金",
    sat: "土",
    sun: "日",
  },
  en: {
    mon: "Mon",
    tue: "Tue",
    wed: "Wed",
    thu: "Thu",
    fri: "Fri",
    sat: "Sat",
    sun: "Sun",
  },
  zh: {
    mon: "周一",
    tue: "周二",
    wed: "周三",
    thu: "周四",
    fri: "周五",
    sat: "周六",
    sun: "周日",
  },
  "zh-TW": {
    mon: "週一",
    tue: "週二",
    wed: "週三",
    thu: "週四",
    fri: "週五",
    sat: "週六",
    sun: "週日",
  },
  ko: {
    mon: "월",
    tue: "화",
    wed: "수",
    thu: "목",
    fri: "금",
    sat: "토",
    sun: "일",
  },
  fr: {
    mon: "Lun",
    tue: "Mar",
    wed: "Mer",
    thu: "Jeu",
    fri: "Ven",
    sat: "Sam",
    sun: "Dim",
  },
  es: {
    mon: "Lun",
    tue: "Mar",
    wed: "Mié",
    thu: "Jue",
    fri: "Vie",
    sat: "Sáb",
    sun: "Dom",
  },
  de: {
    mon: "Mo",
    tue: "Di",
    wed: "Mi",
    thu: "Do",
    fri: "Fr",
    sat: "Sa",
    sun: "So",
  },
  pt: {
    mon: "Seg",
    tue: "Ter",
    wed: "Qua",
    thu: "Qui",
    fri: "Sex",
    sat: "Sáb",
    sun: "Dom",
  },
  it: {
    mon: "Lun",
    tue: "Mar",
    wed: "Mer",
    thu: "Gio",
    fri: "Ven",
    sat: "Sab",
    sun: "Dom",
  },
  ru: {
    mon: "Пн",
    tue: "Вт",
    wed: "Ср",
    thu: "Чт",
    fri: "Пт",
    sat: "Сб",
    sun: "Вс",
  },
  th: {
    mon: "จันทร์",
    tue: "อังคาร",
    wed: "พุธ",
    thu: "พฤหัส",
    fri: "ศุกร์",
    sat: "เสาร์",
    sun: "อาทิตย์",
  },
  vi: {
    mon: "Th 2",
    tue: "Th 3",
    wed: "Th 4",
    thu: "Th 5",
    fri: "Th 6",
    sat: "Th 7",
    sun: "CN",
  },
  id: {
    mon: "Sen",
    tue: "Sel",
    wed: "Rab",
    thu: "Kam",
    fri: "Jum",
    sat: "Sab",
    sun: "Min",
  },
  hi: {
    mon: "सोम",
    tue: "मंगल",
    wed: "बुध",
    thu: "गुरु",
    fri: "शुक्र",
    sat: "शनि",
    sun: "रवि",
  },
  ar: {
    mon: "الإثنين",
    tue: "الثلاثاء",
    wed: "الأربعاء",
    thu: "الخميس",
    fri: "الجمعة",
    sat: "السبت",
    sun: "الأحد",
  },
};

/** 文言（多言語） */
const HOURS_I18N: Record<string, HoursI18n> = {
  ja: {
    title: "営業時間",
    srTitle: "営業時間",
    loading: "読み込み中…",
    noHoursStatic: "固定の営業時間は設定されていません。",
    todayClosed: "本日は休業です。",
    todayNoRange: "本日の営業時間は未設定です。",
    todayOpenPattern: "本日は営業中（{start} - {end}）",
    todayHoursPattern: "本日の営業時間（{start} - {end}）",
    tableDayHeader: "曜日",
    tableHoursHeader: "営業時間",
    labelClosed: "休業",
    labelTodayBadge: "本日",
    note: "※ 営業時間は目安です。状況により前後することがあります。確定のご依頼は予約フォームからお願いいたします。",
  },
  en: {
    title: "Opening hours",
    srTitle: "Opening hours",
    loading: "Loading…",
    noHoursStatic: "Regular business hours are not set.",
    todayClosed: "We are closed today.",
    todayNoRange: "Today's opening hours are not set.",
    todayOpenPattern: "Open today ({start} - {end})",
    todayHoursPattern: "Today's hours ({start} - {end})",
    tableDayHeader: "Day",
    tableHoursHeader: "Hours",
    labelClosed: "Closed",
    labelTodayBadge: "Today",
    note: "※ Opening hours are a guide and may change depending on the situation. For confirmed bookings, please use the reservation form.",
  },
  zh: {
    title: "营业时间",
    srTitle: "营业时间",
    loading: "加载中…",
    noHoursStatic: "尚未设置固定营业时间。",
    todayClosed: "本日休息。",
    todayNoRange: "今日营业时间未设置。",
    todayOpenPattern: "今日营业中（{start} - {end}）",
    todayHoursPattern: "今日营业时间（{start} - {end}）",
    tableDayHeader: "星期",
    tableHoursHeader: "营业时间",
    labelClosed: "休息",
    labelTodayBadge: "今天",
    note: "※ 营业时间仅供参考，可能会根据情况有所变动。请通过预约表单进行正式预约。",
  },
  "zh-TW": {
    title: "營業時間",
    srTitle: "營業時間",
    loading: "讀取中…",
    noHoursStatic: "尚未設定固定營業時間。",
    todayClosed: "本日公休。",
    todayNoRange: "今日營業時間尚未設定。",
    todayOpenPattern: "今日營業中（{start} - {end}）",
    todayHoursPattern: "今日營業時間（{start} - {end}）",
    tableDayHeader: "星期",
    tableHoursHeader: "營業時間",
    labelClosed: "公休",
    labelTodayBadge: "今天",
    note: "※ 營業時間僅供參考，可能會依情況有所變動。正式預約請使用預約表單。",
  },
  ko: {
    title: "영업시간",
    srTitle: "영업시간",
    loading: "불러오는 중…",
    noHoursStatic: "정해진 영업시간이 설정되어 있지 않습니다.",
    todayClosed: "오늘은 휴무입니다.",
    todayNoRange: "오늘의 영업시간이 설정되어 있지 않습니다.",
    todayOpenPattern: "오늘 영업 중 ({start} - {end})",
    todayHoursPattern: "오늘의 영업시간 ({start} - {end})",
    tableDayHeader: "요일",
    tableHoursHeader: "영업시간",
    labelClosed: "휴무",
    labelTodayBadge: "오늘",
    note: "※ 영업시간은 안내용이며 상황에 따라 변경될 수 있습니다. 확정 예약은 예약 폼을 이용해 주세요.",
  },
  fr: {
    title: "Horaires d'ouverture",
    srTitle: "Horaires d'ouverture",
    loading: "Chargement…",
    noHoursStatic: "Les horaires fixes ne sont pas définis.",
    todayClosed: "Fermé aujourd'hui.",
    todayNoRange: "Les horaires d'aujourd'hui ne sont pas définis.",
    todayOpenPattern: "Ouvert aujourd'hui ({start} - {end})",
    todayHoursPattern: "Horaires du jour ({start} - {end})",
    tableDayHeader: "Jour",
    tableHoursHeader: "Horaires",
    labelClosed: "Fermé",
    labelTodayBadge: "Aujourd'hui",
    note: "※ Les horaires sont donnés à titre indicatif et peuvent varier. Pour une réservation ferme, veuillez utiliser le formulaire de réservation.",
  },
  es: {
    title: "Horario de apertura",
    srTitle: "Horario de apertura",
    loading: "Cargando…",
    noHoursStatic: "No se ha configurado un horario fijo.",
    todayClosed: "Hoy estamos cerrados.",
    todayNoRange: "El horario de hoy no está configurado.",
    todayOpenPattern: "Abierto hoy ({start} - {end})",
    todayHoursPattern: "Horario de hoy ({start} - {end})",
    tableDayHeader: "Día",
    tableHoursHeader: "Horario",
    labelClosed: "Cerrado",
    labelTodayBadge: "Hoy",
    note: "※ El horario es orientativo y puede variar según la situación. Para reservas seguras, utilice el formulario de reservas.",
  },
  de: {
    title: "Öffnungszeiten",
    srTitle: "Öffnungszeiten",
    loading: "Wird geladen…",
    noHoursStatic: "Feste Öffnungszeiten sind nicht hinterlegt.",
    todayClosed: "Heute geschlossen.",
    todayNoRange: "Die heutigen Öffnungszeiten sind nicht festgelegt.",
    todayOpenPattern: "Heute geöffnet ({start} - {end})",
    todayHoursPattern: "Heutige Öffnungszeiten ({start} - {end})",
    tableDayHeader: "Tag",
    tableHoursHeader: "Öffnungszeiten",
    labelClosed: "Geschlossen",
    labelTodayBadge: "Heute",
    note: "※ Die Öffnungszeiten dienen nur als Richtwert und können sich ändern. Für verbindliche Buchungen nutzen Sie bitte das Reservierungsformular.",
  },
  pt: {
    title: "Horário de funcionamento",
    srTitle: "Horário de funcionamento",
    loading: "Carregando…",
    noHoursStatic: "O horário fixo de funcionamento não foi definido.",
    todayClosed: "Hoje estamos fechados.",
    todayNoRange: "O horário de hoje não foi definido.",
    todayOpenPattern: "Aberto hoje ({start} - {end})",
    todayHoursPattern: "Horário de hoje ({start} - {end})",
    tableDayHeader: "Dia",
    tableHoursHeader: "Horário",
    labelClosed: "Fechado",
    labelTodayBadge: "Hoje",
    note: "※ O horário é apenas uma referência e pode mudar conforme a situação. Para reservas confirmadas, use o formulário de reserva.",
  },
  it: {
    title: "Orari di apertura",
    srTitle: "Orari di apertura",
    loading: "Caricamento…",
    noHoursStatic: "Gli orari fissi non sono impostati.",
    todayClosed: "Oggi siamo chiusi.",
    todayNoRange: "L'orario di oggi non è impostato.",
    todayOpenPattern: "Aperto oggi ({start} - {end})",
    todayHoursPattern: "Orario di oggi ({start} - {end})",
    tableDayHeader: "Giorno",
    tableHoursHeader: "Orario",
    labelClosed: "Chiuso",
    labelTodayBadge: "Oggi",
    note: "※ Gli orari sono indicativi e possono variare. Per una prenotazione confermata, si prega di usare il modulo di prenotazione.",
  },
  ru: {
    title: "Часы работы",
    srTitle: "Часы работы",
    loading: "Загрузка…",
    noHoursStatic: "Постоянные часы работы не указаны.",
    todayClosed: "Сегодня закрыто.",
    todayNoRange: "Часы работы на сегодня не указаны.",
    todayOpenPattern: "Сегодня открыто ({start} - {end})",
    todayHoursPattern: "Сегодняшние часы работы ({start} - {end})",
    tableDayHeader: "День",
    tableHoursHeader: "Часы",
    labelClosed: "Выходной",
    labelTodayBadge: "Сегодня",
    note: "※ Часы работы указаны ориентировочно и могут меняться. Для подтверждения брони используйте форму бронирования.",
  },
  th: {
    title: "เวลาเปิดทำการ",
    srTitle: "เวลาเปิดทำการ",
    loading: "กำลังโหลด…",
    noHoursStatic: "ยังไม่ได้กำหนดเวลาเปิดทำการประจำ.",
    todayClosed: "วันนี้ปิดทำการ.",
    todayNoRange: "ยังไม่ได้กำหนดเวลาเปิดทำการของวันนี้.",
    todayOpenPattern: "เปิดทำการวันนี้ ({start} - {end})",
    todayHoursPattern: "เวลาเปิดทำการวันนี้ ({start} - {end})",
    tableDayHeader: "วัน",
    tableHoursHeader: "เวลา",
    labelClosed: "ปิดทำการ",
    labelTodayBadge: "วันนี้",
    note: "※ เวลาเปิดทำการเป็นเวลาโดยประมาณ อาจเปลี่ยนแปลงได้ตามสถานการณ์ หากต้องการจองโปรดใช้แบบฟอร์มจอง.",
  },
  vi: {
    title: "Giờ làm việc",
    srTitle: "Giờ làm việc",
    loading: "Đang tải…",
    noHoursStatic: "Chưa thiết lập giờ làm việc cố định.",
    todayClosed: "Hôm nay nghỉ.",
    todayNoRange: "Giờ làm việc hôm nay chưa được thiết lập.",
    todayOpenPattern: "Hôm nay đang mở ({start} - {end})",
    todayHoursPattern: "Giờ làm việc hôm nay ({start} - {end})",
    tableDayHeader: "Thứ",
    tableHoursHeader: "Giờ",
    labelClosed: "Nghỉ",
    labelTodayBadge: "Hôm nay",
    note: "※ Giờ làm việc chỉ mang tính tham khảo và có thể thay đổi. Để đặt lịch chính thức, vui lòng dùng biểu mẫu đặt chỗ.",
  },
  id: {
    title: "Jam operasional",
    srTitle: "Jam operasional",
    loading: "Memuat…",
    noHoursStatic: "Jam operasional tetap belum diatur.",
    todayClosed: "Hari ini tutup.",
    todayNoRange: "Jam operasional hari ini belum diatur.",
    todayOpenPattern: "Buka hari ini ({start} - {end})",
    todayHoursPattern: "Jam hari ini ({start} - {end})",
    tableDayHeader: "Hari",
    tableHoursHeader: "Jam",
    labelClosed: "Tutup",
    labelTodayBadge: "Hari ini",
    note: "※ Jam operasional hanya sebagai panduan dan dapat berubah sesuai situasi. Untuk pemesanan pasti, gunakan formulir reservasi.",
  },
  hi: {
    title: "कार्य समय",
    srTitle: "कार्य समय",
    loading: "लोड हो रहा है…",
    noHoursStatic: "नियमित कार्य समय सेट नहीं किया गया है.",
    todayClosed: "आज बंद है.",
    todayNoRange: "आज के कार्य समय सेट नहीं हैं.",
    todayOpenPattern: "आज खुला है ({start} - {end})",
    todayHoursPattern: "आज का कार्य समय ({start} - {end})",
    tableDayHeader: "दिन",
    tableHoursHeader: "समय",
    labelClosed: "बंद",
    labelTodayBadge: "आज",
    note: "※ कार्य समय केवल मार्गदर्शन के लिए हैं और परिस्थिति के अनुसार बदल सकते हैं। पक्का आरक्षण करने के लिए कृपया आरक्षण फ़ॉर्म का उपयोग करें。",
  },
  ar: {
    title: "ساعات العمل",
    srTitle: "ساعات العمل",
    loading: "جارٍ التحميل…",
    noHoursStatic: "لم يتم تعيين ساعات عمل ثابتة.",
    todayClosed: "نحن مغلقون اليوم.",
    todayNoRange: "لم يتم تعيين ساعات العمل لليوم.",
    todayOpenPattern: "مفتوح اليوم ({start} - {end})",
    todayHoursPattern: "ساعات العمل اليوم ({start} - {end})",
    tableDayHeader: "اليوم",
    tableHoursHeader: "ساعات العمل",
    labelClosed: "مغلق",
    labelTodayBadge: "اليوم",
    note: "※ ساعات العمل إرشادية وقد تتغير حسب الظروف. للحجز المؤكد، يرجى استخدام نموذج الحجز.",
  },
};

function formatHours(pattern: string, start: string, end: string) {
  return pattern.replace("{start}", start).replace("{end}", end);
}

function nowInTZ(tz?: string) {
  const timeZone = tz || "Asia/Tokyo";
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour12: false,
    weekday: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).formatToParts(new Date());

  const wd = (parts.find((p) => p.type === "weekday")?.value || "Mon").slice(
    0,
    3
  );
  const h = parseInt(parts.find((p) => p.type === "hour")?.value || "0", 10);
  const m = parseInt(parts.find((p) => p.type === "minute")?.value || "0", 10);

  const map: Record<string, DayKey> = {
    Sun: "sun",
    Mon: "mon",
    Tue: "tue",
    Wed: "wed",
    Thu: "thu",
    Fri: "fri",
    Sat: "sat",
  };
  return { dayKey: map[wd] ?? "mon", minutes: h * 60 + m };
}

function toMinutes(t?: string): number | null {
  if (!t || !/^\d{1,2}:\d{2}$/.test(t)) return null;
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
}

function isOpenNowInRanges(minsNow: number, d?: DayHours | null) {
  if (!d || d.closed) return false;
  const ranges = d.ranges || [];
  return ranges.some((r) => {
    const o = toMinutes(r.start);
    const c = toMinutes(r.end);
    return o != null && c != null && o <= minsNow && minsNow < c;
  });
}

function rangesLabel(d?: DayHours | null) {
  if (!d || d.closed) return "";
  const ranges = (d.ranges || []).filter((r) => r.start && r.end);
  if (!ranges.length) return "";
  return ranges.map((r) => `${r.start} - ${r.end}`).join(" / ");
}

export default function HoursSection() {
  const siteKey = useSiteKey();
  const { uiLang } = useUILang();
  const t = HOURS_I18N[uiLang] ?? HOURS_I18N["ja"];
  const dayLabels = DAY_LABELS[uiLang] ?? DAY_LABELS["ja"];

  const [bh, setBh] = useState<BusinessHours | null>(null);
  const [loading, setLoading] = useState(true);

  // Firestore 購読
  useEffect(() => {
    const ref = doc(db, "siteSettingsEditable", siteKey);
    return onSnapshot(
      ref,
      (snap) => {
        const data = (snap.data() as any) || {};
        setBh((data.businessHours as BusinessHours) || null);
        setLoading(false);
      },
      () => setLoading(false)
    );
  }, []);

  // 1分おきに再描画（営業中表示の更新）
  const [, forceRender] = useState(0);
  useEffect(() => {
    const id = setInterval(() => forceRender((n) => n + 1), 60_000);
    return () => clearInterval(id);
  }, []);

  const tz = bh?.tz || "Asia/Tokyo";
  const { dayKey: todayKey, minutes: nowMins } = nowInTZ(tz);
  const todayDay = bh?.days?.[todayKey] ?? null;
  const openNow = useMemo(
    () => isOpenNowInRanges(nowMins, todayDay),
    [nowMins, todayDay]
  );

  const todayMessage = useMemo(() => {
    if (!bh?.enabled) return t.noHoursStatic;
    if (
      !todayDay ||
      todayDay.closed ||
      !(todayDay.ranges && todayDay.ranges.length)
    )
      return t.todayClosed;
    const first = todayDay.ranges[0];
    if (!first?.start || !first?.end) return t.todayNoRange;
    return openNow
      ? formatHours(t.todayOpenPattern, first.start, first.end)
      : formatHours(t.todayHoursPattern, first.start, first.end);
  }, [bh?.enabled, todayDay, openNow, t]);

  const weeklyRows = useMemo(() => {
    const days = bh?.days || {};
    return DAY_ORDER.map((k) => {
      const d = days[k];
      const closed = d?.closed || !(d?.ranges && d.ranges.length);
      return {
        key: k,
        label: dayLabels[k],
        closed,
        text: rangesLabel(d),
      };
    });
  }, [bh?.days, dayLabels]);

  return (
    <section className="mx-auto max-w-3xl px-4 py-8 text-neutral-900">
      <h1 className="text-3xl font-extrabold tracking-tight mb-4 text-white text-outline">
        <StaggerChars text={t.title} />
      </h1>
      <h2 className="sr-only">{t.srTitle}</h2>

      {loading || !bh?.enabled ? (
        <div className="rounded-2xl shadow-xl ring-1 ring-black/10 bg-white p-6">
          {loading ? t.loading : t.noHoursStatic}
        </div>
      ) : (
        <>
          {/* 本日情報カード */}
          <motion.div
            className={clsx(
              "rounded-2xl shadow-xl ring-1 ring-black/10 p-5 mb-6",
              openNow ? "bg-green-300/30" : "bg-white"
            )}
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.7 }}
            transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
          >
            <p className="text-lg font-semibold">{todayMessage}</p>
            {(bh?.notes || bh?.note) && (
              <p className="text-sm text-neutral-700 mt-1">
                {bh.notes || bh.note}
              </p>
            )}
          </motion.div>

          {/* 週間テーブル */}
          <motion.div
            className="overflow-hidden rounded-2xl shadow-xl ring-1 ring-black/10 card-bg"
            initial={{ opacity: 0, y: 16, scale: 0.98 }}
            whileInView={{ opacity: 1, y: 0, scale: 1 }}
            viewport={{ once: true, amount: 0.7 }}
            transition={{ duration: 1.05, ease: [0.16, 1, 0.3, 1] }}
          >
            <table className="w-full text-sm text-neutral-900">
              <thead className="bg-neutral-100">
                <tr>
                  <th className="text-left px-4 py-3 w-24">
                    {t.tableDayHeader}
                  </th>
                  <th className="text-left px-4 py-3">{t.tableHoursHeader}</th>
                </tr>
              </thead>
              <tbody>
                {weeklyRows.map((r) => {
                  const isToday = r.key === todayKey;
                  return (
                    <tr
                      key={r.key}
                      className={clsx("border-t", isToday && "bg-blue-50/60")}
                    >
                      <td className="px-4 py-3 font-semibold">
                        {r.label}
                        {isToday && (
                          <span className="ml-2 text-xs rounded bg-blue-600 text-white px-1.5 py-0.5">
                            {t.labelTodayBadge}
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {r.closed ? (
                          <span className="text-neutral-700">
                            {t.labelClosed}
                          </span>
                        ) : (
                          <span className="font-medium">{r.text}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </motion.div>

          <p className="text-xs text-black mt-6">{t.note}</p>
        </>
      )}
    </section>
  );
}
