import type { APIRoute } from "astro";
import webpush from "web-push";
import { supabase } from "../../../lib/supabase";

const TZ = "America/Santiago";

type WeightPeriod = "morning" | "night";
type MealName = "Desayuno" | "Almuerzo" | "Once";

type PushReminderTarget = {
  user_id: string;
  endpoint: string;
  keys_p256dh: string;
  keys_auth: string;
  should_send: boolean;
  meal_description: string | null;
};

type Reminder =
  | {
      type: "weight";
      period: WeightPeriod;
      targetTime: string;
      title: string;
      body: string;
      url: string;
    }
  | {
      type: "meal";
      mealName: MealName;
      targetTime: string;
      title: string;
      url: string;
    };

const REMINDERS: Reminder[] = [
  {
    type: "weight",
    period: "morning",
    targetTime: "09:30",
    title: "Buenos dias",
    body: "Registra tu peso de la manana",
    url: "/peso",
  },
  {
    type: "meal",
    mealName: "Desayuno",
    targetTime: "11:00",
    title: "Hora de desayuno",
    url: "/comidas",
  },
  {
    type: "meal",
    mealName: "Almuerzo",
    targetTime: "14:00",
    title: "Hora de almuerzo",
    url: "/comidas",
  },
  {
    type: "meal",
    mealName: "Once",
    targetTime: "20:30",
    title: "Hora de once",
    url: "/comidas",
  },
  {
    type: "weight",
    period: "night",
    targetTime: "23:59",
    title: "Buenas noches",
    body: "Registra tu peso antes de dormir",
    url: "/peso",
  },
];

export const GET: APIRoute = async ({ request, url }) => {
  const authHeader = request.headers.get("authorization");
  const cronSecret = getBearerToken(authHeader);
  const configuredCronSecret = import.meta.env.CRON_SECRET;

  if (!cronSecret || (configuredCronSecret && cronSecret !== configuredCronSecret)) {
    return json({ error: "Unauthorized" }, 401);
  }

  const vapidPublic = import.meta.env.VAPID_PUBLIC_KEY;
  const vapidPrivate = import.meta.env.VAPID_PRIVATE_KEY;
  if (!vapidPublic || !vapidPrivate) {
    return json({ error: "VAPID keys not configured" }, 500);
  }

  const reminder = getRequestedReminder(url) || getCurrentReminder();
  const chileTime = getChileTimeHHMM();
  const todayStr = getTodayChile();

  if (!reminder) {
    return json({ skipped: true, reason: "no reminder due", chileTime, date: todayStr });
  }

  webpush.setVapidDetails("mailto:tct-app@example.com", vapidPublic, vapidPrivate);

  const { data: targets, error: targetsError } = await supabase.rpc("get_push_reminder_targets", {
    p_secret: cronSecret,
    p_reminder_type: reminder.type,
    p_today: todayStr,
    p_weight_period: reminder.type === "weight" ? reminder.period : null,
    p_meal_name: reminder.type === "meal" ? reminder.mealName : null,
  });

  if (targetsError) {
    const isUnauthorized = targetsError.message === "Unauthorized";
    return json({ error: isUnauthorized ? "Unauthorized" : targetsError.message }, isUnauthorized ? 401 : 500);
  }

  if (!targets || targets.length === 0) {
    return json({ sent: 0, reason: "no subscriptions", reminder, chileTime, date: todayStr });
  }

  const result = reminder.type === "weight"
    ? await sendWeightReminder(targets, reminder, todayStr, cronSecret)
    : await sendMealReminder(targets, reminder, todayStr, cronSecret);

  return json({ ...result, reminder, chileTime, date: todayStr });
};

async function sendWeightReminder(
  targets: PushReminderTarget[],
  reminder: Extract<Reminder, { type: "weight" }>,
  todayStr: string,
  cronSecret: string
) {
  const payload = JSON.stringify({
    title: reminder.title,
    body: reminder.body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    url: reminder.url,
    tag: `weight-${reminder.period}-${todayStr}`,
  });

  const subscriptions = targets.filter((target) => target.should_send);
  const skippedUsers = new Set(
    targets.filter((target) => !target.should_send).map((target) => target.user_id)
  ).size;

  return sendToSubscriptions(
    subscriptions,
    payload,
    { skippedUsers },
    cronSecret
  );
}

async function sendMealReminder(
  targets: PushReminderTarget[],
  reminder: Extract<Reminder, { type: "meal" }>,
  todayStr: string,
  cronSecret: string
) {
  const mealLabel = reminder.mealName.toLowerCase();
  const subscriptions = targets.filter((target) => target.should_send);
  const mealDescription = subscriptions.find((target) => target.meal_description)?.meal_description || null;
  const payload = JSON.stringify({
    title: reminder.title,
    body: mealDescription
      ? `${reminder.mealName}: ${mealDescription}`
      : `Aun no hay ${mealLabel} planificado para hoy`,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    url: reminder.url,
    tag: `meal-${reminder.mealName.toLowerCase()}-${todayStr}`,
  });

  return sendToSubscriptions(subscriptions, payload, { skippedUsers: 0 }, cronSecret);
}

async function sendToSubscriptions(
  subscriptions: PushReminderTarget[],
  payload: string,
  extra: Record<string, unknown>,
  cronSecret: string
) {
  let sent = 0;
  let failed = 0;
  const staleEndpoints: string[] = [];

  for (const sub of subscriptions) {
    try {
      await webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.keys_p256dh, auth: sub.keys_auth },
        },
        payload,
        { TTL: 3600 }
      );
      sent++;
    } catch (err: any) {
      failed++;
      if (err.statusCode === 404 || err.statusCode === 410) {
        staleEndpoints.push(sub.endpoint);
      }
    }
  }

  if (staleEndpoints.length > 0) {
    await supabase.rpc("delete_stale_push_subscriptions", {
      p_secret: cronSecret,
      p_endpoints: staleEndpoints,
    });
  }

  return { sent, failed, cleaned: staleEndpoints.length, ...extra };
}

function getRequestedReminder(url: URL): Reminder | null {
  const type = url.searchParams.get("type");
  const period = url.searchParams.get("period");
  const meal = url.searchParams.get("meal");

  if (type === "weight" && period) {
    return REMINDERS.find((r) => r.type === "weight" && r.period === period) || null;
  }

  if (type === "meal" && meal) {
    return REMINDERS.find((r) => r.type === "meal" && r.mealName === meal) || null;
  }

  return null;
}

function getBearerToken(authHeader: string | null): string | null {
  if (!authHeader?.startsWith("Bearer ")) return null;
  const token = authHeader.slice("Bearer ".length).trim();
  return token.length > 0 ? token : null;
}

function getCurrentReminder(): Reminder | null {
  const chileTime = getChileTimeHHMM();
  return REMINDERS.find((r) => r.targetTime === chileTime) || null;
}

function getChileTimeHHMM(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    hourCycle: "h23",
  }).formatToParts(new Date());
  const hour = parts.find((part) => part.type === "hour")?.value || "00";
  const minute = parts.find((part) => part.type === "minute")?.value || "00";
  return `${hour}:${minute}`;
}

function getTodayChile(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: TZ });
}

function json(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}
