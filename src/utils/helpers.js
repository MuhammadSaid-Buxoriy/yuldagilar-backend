import crypto from 'crypto';

/**
 * Generate unique request ID
 */
export function generateRequestId() {
  return crypto.randomBytes(16).toString('hex');
}

/**
 * Format Telegram user name
 */
export function formatTelegramName(user) {
  if (user.first_name && user.last_name) {
    return `${user.first_name} ${user.last_name}`;
  }
  return user.first_name || user.username || `User ${user.id}`;
}

/**
 * Validate Telegram ID
 */
export function isValidTelegramId(id) {
  const telegramId = parseInt(id);
  return Number.isInteger(telegramId) && telegramId > 0;
}

/**
 * Calculate completion percentage
 */
export function calculateCompletionPercentage(completed, total) {
  if (total === 0) return 0;
  return Math.round((completed / total) * 100);
}

/**
 * Get date string in YYYY-MM-DD format
 */
export function getDateString(date = new Date()) {
  return date.toISOString().split('T')[0];
}

/**
 * Get week start date (Monday)
 */
export function getWeekStartDate(date = new Date()) {
  const d = new Date(date);
  const day = d.getDay();
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

/**
 * Format duration in human readable format
 */
export function formatDuration(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  if (minutes > 0) return `${minutes}m ${seconds % 60}s`;
  return `${seconds}s`;
}

/**
 * Sanitize user input
 */
export function sanitizeString(str, maxLength = 200) {
  if (typeof str !== 'string') return '';
  return str.trim().substring(0, maxLength);
}

/**
 * Generate avatar URL from name
 */
export function generateAvatarUrl(name, size = 100) {
  const initial = name.charAt(0).toUpperCase();
  const colors = ['FF6B6B', '4ECDC4', '45B7D1', '96CEB4', 'FFEAA7', 'DDA0DD', 'FFB347'];
  const colorIndex = name.charCodeAt(0) % colors.length;
  const color = colors[colorIndex];
  
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(initial)}&size=${size}&background=${color}&color=fff&bold=true`;
}

/**
 * Parse query string safely
 */
export function parseQueryString(query, defaults = {}) {
  const parsed = { ...defaults };
  
  for (const [key, value] of Object.entries(query)) {
    if (value !== undefined && value !== null && value !== '') {
      parsed[key] = value;
    }
  }
  
  return parsed;
}

/**
 * Delay function for rate limiting
 */
export function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
