import { Notification } from "../../models";

/**
 * Fire-and-record a notification for a user. Types used across the app:
 * EVENT_CREATED, EVENT_PUBLISHED, YOUTUBE_CONNECTED, YOUTUBE_ERROR,
 * EVENT_LIVE, PAYMENT_SUCCESSFUL.
 * Extend this to also push via FCM/SMS/email as needed — DB write stays the source of truth.
 */
export async function createNotification(
  userId: string,
  type: string,
  title: string,
  message: string,
  data?: Record<string, unknown>
) {
  return Notification.create({ userId, type, title, message, data: data ?? null });
}
