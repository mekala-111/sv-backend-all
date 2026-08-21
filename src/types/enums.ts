export enum UserRole {
  SUPER_ADMIN = "SUPER_ADMIN",
  ADMIN = "ADMIN",
  VENDOR = "VENDOR",
  CUSTOMER = "CUSTOMER",
}

export enum UserStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  SUSPENDED = "SUSPENDED",
  PENDING = "PENDING",
}

export enum OtpPurpose {
  LOGIN = "LOGIN",
  PHONE_VERIFY = "PHONE_VERIFY",
  EMAIL_VERIFY = "EMAIL_VERIFY",
  PASSWORD_RESET = "PASSWORD_RESET",
}

export enum VendorStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  SUSPENDED = "SUSPENDED",
  PENDING_APPROVAL = "PENDING_APPROVAL",
}

export enum CustomerStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  SUSPENDED = "SUSPENDED",
}

export enum EventStatus {
  DRAFT = "DRAFT",
  UPCOMING = "UPCOMING",
  LIVE = "LIVE",
  COMPLETED = "COMPLETED",
  CANCELLED = "CANCELLED",
  EXPIRED = "EXPIRED",
}

export enum ThemeStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
  DRAFT = "DRAFT",
}

export enum MediaType {
  COVER = "COVER",
  GALLERY = "GALLERY",
  TEASER = "TEASER",
  CUSTOM = "CUSTOM",
  LOGO = "LOGO",
  WHATSAPP = "WHATSAPP",
}

export enum MediaStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}

export enum YoutubeChannelStatus {
  CONNECTED = "CONNECTED",
  DISCONNECTED = "DISCONNECTED",
  ERROR = "ERROR",
  TOKEN_EXPIRED = "TOKEN_EXPIRED",
}

export enum YoutubeStreamStatus {
  CONNECTED = "CONNECTED",
  SCHEDULED = "SCHEDULED",
  LIVE = "LIVE",
  ENDED = "ENDED",
  ERROR = "ERROR",
}

export enum EventAccessType {
  PUBLIC = "PUBLIC",
  PRIVATE = "PRIVATE",
}

export enum PaymentStatus {
  PENDING = "PENDING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  REFUNDED = "REFUNDED",
  CANCELLED = "CANCELLED",
}

export enum WalletTxnType {
  CREDIT = "CREDIT",
  DEBIT = "DEBIT",
  REFUND = "REFUND",
  ADJUSTMENT = "ADJUSTMENT",
}

export enum TicketStatus {
  OPEN = "OPEN",
  PENDING = "PENDING",
  RESOLVED = "RESOLVED",
  CLOSED = "CLOSED",
  CRITICAL = "CRITICAL",
}

export enum TicketPriority {
  LOW = "LOW",
  MEDIUM = "MEDIUM",
  HIGH = "HIGH",
  CRITICAL = "CRITICAL",
}

export enum BookingStatus {
  NEW = "NEW",
  CONTACTED = "CONTACTED",
  QUOTED = "QUOTED",
  CONVERTED = "CONVERTED",
  CLOSED = "CLOSED",
}

export enum PlanStatus {
  ACTIVE = "ACTIVE",
  INACTIVE = "INACTIVE",
}
