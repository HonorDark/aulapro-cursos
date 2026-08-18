export type NotificationType = "INFO" | "SUCCESS" | "WARNING" | "ERROR";
export type NotificationItem = {
  id: string;
  title: string;
  message: string;
  type: NotificationType;
  href: string | null;
  is_read: boolean;
  created_at: string;
  read_at: string | null;
};
export type NotificationResponse = {
  items: NotificationItem[];
  unread: number;
};
