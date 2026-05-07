const BLOCKED_PATTERNS = [
  /\b(https?:\/\/)?(bit\.ly|tinyurl|t\.co|goo\.gl|ow\.ly)\b/gi,
  /\b\d{3}[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  /\b[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}\b/g,
];

const PROFANITY_FILTER = [
  /\b(fuck|shit|bitch|ass|damn|bastard|dick|pussy|cock|cunt|whore|slut|nigga|nigger|fag|faggot|retard|cunt|raper?)\b/gi,
];

const MAX_BIO_LENGTH = 150;

export const sanitizeText = (text, maxLength = 500) => {
  if (!text || typeof text !== 'string') return '';
  let cleaned = text.trim();
  if (cleaned.length > maxLength) {
    cleaned = cleaned.slice(0, maxLength).trim() + '...';
  }
  return cleaned;
};

export const filterProfanity = (text) => {
  if (!text || typeof text !== 'string') return text;
  let filtered = text;
  for (const pattern of PROFANITY_FILTER) {
    filtered = filtered.replace(pattern, (match) => '*'.repeat(match.length));
  }
  return filtered;
};

export const filterLinks = (text) => {
  if (!text || typeof text !== 'string') return text;
  let filtered = text;
  for (const pattern of BLOCKED_PATTERNS) {
    filtered = filtered.replace(pattern, '[link removed]');
  }
  return filtered;
};

export const sanitizeBio = (bio) => {
  const cleaned = sanitizeText(bio, MAX_BIO_LENGTH);
  const noLinks = filterLinks(cleaned);
  return filterProfanity(noLinks);
};

export const sanitizePost = (text) => {
  const cleaned = sanitizeText(text, 1000);
  return filterProfanity(cleaned);
};

export const sanitizeUsername = (username) => {
  if (!username || typeof username !== 'string') return '';
  return username.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 30);
};

export const containsBlockedContent = (text) => {
  if (!text || typeof text !== 'string') return false;
  for (const pattern of BLOCKED_PATTERNS) {
    if (pattern.test(text)) return true;
  }
  return false;
};

export default {
  sanitizeText,
  filterProfanity,
  filterLinks,
  sanitizeBio,
  sanitizePost,
  sanitizeUsername,
  containsBlockedContent,
};
