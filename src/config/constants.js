export const FRONTEND_URLS = [
  "http://localhost:5173", // Local development
  "http://localhost:3000", // Alternative local port
  "https://yuldagilar.vercel.app", // Production frontend
  "https://yoldagilar.vercel.app", // Alternative spelling
  "https://yoldagilar-frontend.vercel.app", // Backup domain
];

export const API_VERSION = "1.0.0";

export const DATABASE_CONSTANTS = {
  MAX_NAME_LENGTH: 200,
  MAX_USERNAME_LENGTH: 50,
  MAX_DAILY_POINTS: 10,
  MAX_PAGES_PER_DAY: 10000,
  MAX_DISTANCE_PER_DAY: 1000,
  DEFAULT_ACHIEVEMENTS: [],
};

export const RATE_LIMITS = {
  GENERAL: {
    windowMs: 60000, // 1 minute
    maxRequests: 100, // 100 requests per minute
  },
  AUTH: {
    windowMs: 300000, // 5 minutes
    maxRequests: 20, // 20 auth attempts per 5 minutes
  },
  SUBMIT: {
    windowMs: 60000, // 1 minute
    maxRequests: 10, // 10 submissions per minute
  },
};

export const TASK_DEFINITIONS = [
  { id: 1, title: "Kunlik vird", points: 50, category: "prayer" },
  { id: 2, title: "Silai rahm", points: 50, category: "family" },
  { id: 3, title: "Qur'on tinglash", points: 50, category: "quran" },
  { id: 4, title: "Ehson qilish", points: 50, category: "charity" },
  { id: 5, title: "Kitob o'qish", points: 50, category: "knowledge" },
  { id: 6, title: "Dars/Kurs", points: 50, category: "education" },
  { id: 7, title: "Audio kitob", points: 50, category: "audio" },
  { id: 8, title: "Erta uxlash", points: 50, category: "sleep" },
  { id: 9, title: "Erta turish", points: 50, category: "wake" },
  { id: 10, title: "Sport/Mashqlar", points: 50, category: "sport" },
];
