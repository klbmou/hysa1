/* global window, document */

const legacyTokenKey = "hysa_token";
const langKey = "hysa_lang";
const themeKey = "hysa_theme";
const lowDataKey = "hysa_low_data_mode";
let googleClientId = "";
let googleClientConfigPromise = null;
let csrfToken = "";

function getCspNonce() {
  const script = document.querySelector("script[nonce]");
  return script ? String(script.nonce || script.getAttribute("nonce") || "") : "";
}

function getToken() {
  return token;
}

function readStoredToken() {
  localStorage.removeItem("token");
  localStorage.removeItem(legacyTokenKey);
  return "";
}

function saveToken(nextToken) {
  token = nextToken === false ? "" : "cookie-session";
  localStorage.removeItem("token");
  localStorage.removeItem(legacyTokenKey);
}

function clearStoredToken() {
  token = "";
  csrfToken = "";
  localStorage.removeItem("token");
  localStorage.removeItem(legacyTokenKey);
}

let token = readStoredToken();
let me = null;
let feedCursor = null;
let feedPage = 1;
let feedLoading = false;
let feedObserver = null;
let postViewObserver = null;
const sentViews = new Set();
const FEED_CACHE_TTL = 30000;
const SEEN_POSTS_KEY = "hysa_seen_posts";
const HOME_SCROLL_KEY = "hysa_home_scroll_y";
let feedCache = { key: "", timestamp: 0, payload: null };
let activeProfileKey = null;
let activePostId = null;
let activeProfileTab = "posts";
let storyCache = [];
let seenPostIds = new Set();
try {
  const storedSeen = JSON.parse(localStorage.getItem(SEEN_POSTS_KEY) || "[]");
  if (Array.isArray(storedSeen)) seenPostIds = new Set(storedSeen.map(String));
} catch {
  seenPostIds = new Set();
}
let storyGroups = [];
let storiesLoading = false;
let storiesLoadedAt = 0;
let trendsLoading = false;
let trendsLoadedAt = 0;
let activeStoryIndex = 0;
let storyProgressTimer = null;
let storyFileInput = null;
let storyDraftFile = null;
let storyDraftPreviewUrl = "";
let storyDraftFilter = "normal";
let activeDmPeer = null;
let activeDmPeerProfile = null;
let storyProgressStartedAt = 0;
let storyProgressDuration = 0;
let storyProgressRemaining = 0;
let activeStoryVideo = null;
let mediaPickerTarget = null;
let dmThreadPollTimer = null;
let dmInboxPollTimer = null;
let dmPollGeneration = 0;
let lastDmThreadSignature = "";
let lastDmInboxSignature = "";
let aiMode = "chat";
let reelMutePreference = localStorage.getItem("hysa_reels_muted") !== "false";
const reelViewedIds = new Set();
const REELS_CACHE_TTL = 60000;
let reelsCache = { timestamp: 0, payload: null };
let reelsLoading = false;
let reelScrollTicking = false;

const STORY_FILTERS = [
  { key: "normal", label: "Normal" },
  { key: "warm", label: "Warm" },
  { key: "cool", label: "Cool" },
  { key: "contrast", label: "Contrast" },
  { key: "grayscale", label: "Gray" },
  { key: "glow", label: "Glow" },
];

let lang = localStorage.getItem(langKey) || "ar";
if (!["ar", "en", "fr"].includes(lang)) lang = "ar";

// Theme management
let theme = localStorage.getItem(themeKey) || "dark";
function setTheme(newTheme) {
  theme = newTheme === "light" ? "light" : "dark";
  localStorage.setItem(themeKey, theme);
  document.documentElement.setAttribute("data-theme", theme);
}
setTheme(theme); // Apply on load

function autoLowDataPreferred() {
  const c = navigator.connection || navigator.mozConnection || navigator.webkitConnection;
  if (!c) return false;
  return !!c.saveData || /(^|-)2g$/i.test(String(c.effectiveType || ""));
}

let lowDataMode = localStorage.getItem(lowDataKey);
lowDataMode = lowDataMode == null ? autoLowDataPreferred() : lowDataMode === "true";

function setLowDataMode(nextValue) {
  lowDataMode = !!nextValue;
  localStorage.setItem(lowDataKey, String(lowDataMode));
  document.documentElement.toggleAttribute("data-low-data", lowDataMode);
  feedCache = { key: "", timestamp: 0, payload: null };
}

setLowDataMode(lowDataMode);

const I18N = {
  ar: {
    pageTitle: "HYSA - شبكة تواصل مصغّرة",
    brandTag: "منشورات قصيرة، متابعة، إعجاب",
    searchPlaceholder: "ابحث عن مستخدم...",
    logout: "تسجيل خروج",
    startNow: "ابدأ الآن",
    authBlurb: 'تواصل مع الأصدقاء. شارك لحظاتك. اكتشف مجتمعك.',
    login: "دخول",
    register: "تسجيل",
    continueWithGoogle: "المتابعة بواسطة Google",
    username: "اسم المستخدم",
    password: "كلمة المرور",
    feedTitle: "المنشورات",
    refresh: "تحديث",
    loadMore: "تحميل المزيد",
    loading: "جار التحميل...",
    footerNote: "HYSA تجريبي. ليس جاهزاً للإنتاج بدون مراجعة أمن/خصوصية/إشراف.",
    composeTitle: "منشور جديد",
    composePlaceholder: "بماذا تفكر؟",
    addMedia: "إضافة وسائط",
    visibilityPublic: "عام",
    visibilityPrivate: "خاص",
    privateBadge: "خاص",
    post: "نشر",
    editProfile: "تعديل البروفايل",
    insights: "الإحصائيات",
    changePhoto: "تغيير الصورة",
    removePhoto: "إزالة",
    bio: "النبذة",
    bioPlaceholder: "اكتب نبذة قصيرة...",
    save: "حفظ",
    saved: "تم الحفظ.",
    follow: "متابعة",
    unfollow: "إلغاء متابعة",
    followers: "متابعون",
    following: "يتابع",
    noBio: "لا توجد نبذة.",
    noPosts: "لا توجد منشورات بعد.",
    like: "إعجاب",
    views: "مشاهدات",
    comments: "تعليقات",
    writeComment: "اكتب تعليقاً...",
    send: "إرسال",
    copyLink: "نسخ الرابط",
    report: "إبلاغ",
    reportReason: "السبب",
    reasonSpam: "سبام",
    reasonAbuse: "إساءة",
    reasonFake: "انتحال",
    reasonOther: "أخرى",
    note: "ملاحظة (اختياري)",
    notePlaceholder: "اكتب تفاصيل إضافية...",
    sendReport: "إرسال الإبلاغ",
    linkCopied: "تم نسخ الرابط.",
    reportSent: "تم إرسال الإبلاغ.",
    postSent: "تم النشر.",
    uploadProgress: "جاري رفع الوسائط...",
    tooManyMedia: "يمكنك إضافة 4 وسائط كحد أقصى.",
    fileTooLarge: "الملف كبير جداً.",
    invalidFile: "نوع الملف غير مدعوم.",
    postViewTitle: "منشور",
    profileTitle: "ملف",
    error_file_origin: "افتح الموقع عبر http://localhost:3000 وليس كملف (File).",
    error_network: "لا يمكن الاتصال بالسيرفر. شغّل node server.js وافتح http://localhost:3000",
    error_server_outdated: "السيرفر الحالي قديم أو لم يُعاد تشغيله. أوقفه ثم شغّل node server.js من جديد.",
    error_invalid_credentials: "اسم المستخدم أو كلمة المرور غير صحيحة.",
    error_username_taken: "اسم المستخدم مستخدم من قبل.",
    error_invalid_username: "اسم مستخدم غير صالح.",
    error_invalid_password: "كلمة مرور غير صالحة.",
    error_invalid_post: "منشور غير صالح.",
    error_invalid_comment: "تعليق غير صالح.",
    error_bio_too_long: "النبذة طويلة جداً.",
    error_invalid_media: "وسائط غير صالحة.",
    error_upload_too_large: "حجم الرفع كبير جداً.",
    error_upload_invalid: "ملف/رفع غير صالح.",
    error_report_invalid: "الإبلاغ غير صالح.",
    error_unknown: "حدث خطأ غير متوقع.",
    error_google_auth_not_configured: "تسجيل الدخول بواسطة Google غير مفعّل بعد.",
    error_invalid_google_credential: "تعذر التحقق من حساب Google.",
    error_upload_missing: "ميزة رفع الملفات غير متوفرة في السيرفر الحالي. أوقف السيرفر ثم شغّل node server.js من جديد.",
    // New features
    stories: "القصص",
    trending: "الأكثر شعبية",
    verification: "التحقق",
    requestVerification: "طلب التحقق",
    verified: "موثق",
    pending: "قيد الانتظار",
    saves: "الحفظ",
    postInsights: "إحصائيات المنشور",
    darkMode: "الوضع الداكن",
    lightMode: "الوضع الفاتح",
    typing: "يكتب...",
  },
  en: {
    pageTitle: "HYSA - Mini Social",
    brandTag: "Short posts, follow, like",
    searchPlaceholder: "Search users...",
    logout: "Log out",
    startNow: "Get started",
    authBlurb: 'Connect with friends. Share your moments. Discover your community.',
    login: "Login",
    register: "Register",
    continueWithGoogle: "Continue with Google",
    username: "Username",
    password: "Password",
    feedTitle: "Posts",
    refresh: "Refresh",
    loadMore: "Load more",
    loading: "Loading...",
    footerNote: "HYSA is a demo. Not production-ready without security/privacy/moderation.",
    composeTitle: "New post",
    composePlaceholder: "What's happening?",
    addMedia: "Add media",
    visibilityPublic: "Public",
    visibilityPrivate: "Private",
    privateBadge: "Private",
    post: "Post",
    editProfile: "Edit profile",
    insights: "Insights",
    changePhoto: "Change photo",
    removePhoto: "Remove",
    bio: "Bio",
    bioPlaceholder: "Write a short bio...",
    save: "Save",
    saved: "Saved.",
    follow: "Follow",
    unfollow: "Unfollow",
    followers: "Followers",
    following: "Following",
    noBio: "No bio yet.",
    noPosts: "No posts yet.",
    like: "Like",
    views: "Views",
    comments: "Comments",
    writeComment: "Write a comment...",
    send: "Send",
    copyLink: "Copy link",
    report: "Report",
    reportReason: "Reason",
    reasonSpam: "Spam",
    reasonAbuse: "Abuse",
    reasonFake: "Impersonation",
    reasonOther: "Other",
    note: "Note (optional)",
    notePlaceholder: "Add details...",
    sendReport: "Send report",
    linkCopied: "Link copied.",
    reportSent: "Report sent.",
    postSent: "Posted.",
    uploadProgress: "Uploading media...",
    tooManyMedia: "You can add up to 4 items.",
    fileTooLarge: "File is too large.",
    invalidFile: "Unsupported file type.",
    postViewTitle: "Post",
    profileTitle: "Profile",
    error_file_origin: "Open the site at http://localhost:3000 (not as a local file).",
    error_network: "Can't reach the server. Run node server.js and open http://localhost:3000",
    error_server_outdated: "Server is outdated or not restarted. Restart node server.js.",
    error_invalid_credentials: "Wrong username or password.",
    error_username_taken: "Username is already taken.",
    error_invalid_username: "Invalid username.",
    error_invalid_password: "Invalid password.",
    error_invalid_post: "Invalid post.",
    error_invalid_comment: "Invalid comment.",
    error_bio_too_long: "Bio is too long.",
    error_invalid_media: "Invalid media.",
    error_upload_too_large: "Upload too large.",
    error_upload_invalid: "Invalid upload.",
    error_report_invalid: "Invalid report.",
    error_unknown: "Something went wrong.",
    error_google_auth_not_configured: "Google login is not configured yet.",
    error_invalid_google_credential: "Could not verify your Google account.",
    error_upload_missing: "Upload is not available on the running server. Restart node server.js.",
  },
  fr: {
    pageTitle: "HYSA - Mini reseau social",
    brandTag: "Posts courts, suivre, aimer",
    searchPlaceholder: "Rechercher un utilisateur...",
    logout: "Deconnexion",
    startNow: "Commencer",
    authBlurb: 'Projet de demo. Les donnees sont stockees dans <span class="mono">data.json</span>.',
    login: "Connexion",
    register: "Inscription",
    username: "Nom d'utilisateur",
    password: "Mot de passe",
    feedTitle: "Publications",
    refresh: "Rafraichir",
    loadMore: "Charger plus",
    loading: "Chargement...",
    footerNote: "HYSA est une demo. Pas pret pour la production sans securite/vie privee/moderation.",
    composeTitle: "Nouveau post",
    composePlaceholder: "Quoi de neuf ?",
    addMedia: "Ajouter un media",
    visibilityPublic: "Public",
    visibilityPrivate: "Prive",
    privateBadge: "Prive",
    post: "Publier",
    editProfile: "Modifier le profil",
    insights: "Statistiques",
    changePhoto: "Changer la photo",
    removePhoto: "Retirer",
    bio: "Bio",
    bioPlaceholder: "Ecrivez une courte bio...",
    save: "Enregistrer",
    saved: "Enregistre.",
    follow: "Suivre",
    unfollow: "Ne plus suivre",
    followers: "Abonnes",
    following: "Abonnements",
    noBio: "Pas de bio.",
    noPosts: "Aucune publication pour le moment.",
    like: "J'aime",
    views: "Vues",
    comments: "Commentaires",
    writeComment: "Ecrire un commentaire...",
    send: "Envoyer",
    copyLink: "Copier le lien",
    report: "Signaler",
    reportReason: "Raison",
    reasonSpam: "Spam",
    reasonAbuse: "Abus",
    reasonFake: "Usurpation",
    reasonOther: "Autre",
    note: "Note (optionnel)",
    notePlaceholder: "Ajoutez des details...",
    sendReport: "Envoyer",
    linkCopied: "Lien copie.",
    reportSent: "Signalement envoye.",
    postSent: "Publie.",
    uploadProgress: "Televersement...",
    tooManyMedia: "Maximum 4 elements.",
    fileTooLarge: "Fichier trop volumineux.",
    invalidFile: "Type de fichier non supporte.",
    postViewTitle: "Post",
    profileTitle: "Profil",
    error_file_origin: "Ouvrez le site via http://localhost:3000 (pas en fichier local).",
    error_network: "Impossible de joindre le serveur. Lancez node server.js puis ouvrez http://localhost:3000",
    error_server_outdated: "Serveur obsolet ou non redemarre. Redemarrez node server.js.",
    error_invalid_credentials: "Identifiants incorrects.",
    error_username_taken: "Ce nom d'utilisateur est deja pris.",
    error_invalid_username: "Nom d'utilisateur invalide.",
    error_invalid_password: "Mot de passe invalide.",
    error_invalid_post: "Post invalide.",
    error_invalid_comment: "Commentaire invalide.",
    error_bio_too_long: "Bio trop longue.",
    error_invalid_media: "Media invalide.",
    error_upload_too_large: "Televersement trop gros.",
    error_upload_invalid: "Televersement invalide.",
    error_report_invalid: "Signalement invalide.",
    error_unknown: "Une erreur est survenue.",
    error_upload_missing: "Le televersement n'est pas disponible sur le serveur en cours. Redemarrez node server.js.",
    // New features
    stories: "Histoires",
    trending: "Tendances",
    verification: "Verification",
    requestVerification: "Demander la verification",
    verified: "Verifie",
    pending: "En attente",
    saves: "Sauvegardes",
    postInsights: "Statistiques du post",
    darkMode: "Mode sombre",
    lightMode: "Mode clair",
    typing: "ecrit...",
  },
};

function t(key) {
  return I18N[lang]?.[key] ?? I18N.ar[key] ?? key;
}

let el = {};

function setMsg(node, text, isError = false) {
  if (!node) return;
  node.textContent = text || "";
  node.classList.toggle("error", !!isError);
}

function on(node, eventName, handler, options) {
  if (!node || typeof node.addEventListener !== "function") return;
  node.addEventListener(eventName, handler, options);
}

let toastTimer = null;
function showToast(text, isError = false) {
  if (!el.toast) return;
  if (toastTimer) window.clearTimeout(toastTimer);
  el.toast.textContent = text || "";
  el.toast.classList.toggle("error", !!isError);
  el.toast.hidden = false;
  window.requestAnimationFrame(() => el.toast.classList.add("show"));
  toastTimer = window.setTimeout(() => {
    el.toast.classList.remove("show");
    window.setTimeout(() => {
      el.toast.hidden = true;
    }, 160);
  }, isError ? 3000 : 2500);
}

function showActionSheet(title, build) {
  if (!el.actionSheet || !el.sheetBody) return;
  if (el.sheetTitle) el.sheetTitle.textContent = title || "";
  el.sheetBody.textContent = "";
  build(el.sheetBody);
  el.actionSheet.hidden = false;
  window.requestAnimationFrame(() => el.actionSheet.classList.add("show"));
}

function hideActionSheet() {
  if (!el.actionSheet) return;
  el.actionSheet.classList.remove("show");
  window.setTimeout(() => {
    if (el.actionSheet) el.actionSheet.hidden = true;
  }, 180);
}

function sheetButton(label, className = "") {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `sheet-button ${className}`.trim();
  btn.textContent = label;
  return btn;
}

function applyI18n() {
  const dir = lang === "ar" ? "rtl" : "ltr";
  document.documentElement.lang = lang;
  document.documentElement.dir = dir;

  for (const node of document.querySelectorAll("[data-t]")) {
    node.textContent = t(node.dataset.t);
  }
  for (const node of document.querySelectorAll("[data-t-html]")) {
    node.innerHTML = t(node.dataset.tHtml);
  }
  for (const node of document.querySelectorAll("[data-t-placeholder]")) {
    node.setAttribute("placeholder", t(node.dataset.tPlaceholder));
  }

  if (el.langSelect) el.langSelect.value = lang;
  if (el.langToggleLabel) el.langToggleLabel.textContent = (lang || "ar").toUpperCase();
  if (el.settingsLang) el.settingsLang.value = lang;
  if (el.settingsPrivate && me) el.settingsPrivate.checked = !!me.isPrivate;
}

function fmtTime(iso) {
  try {
    if (!iso) return "";
    const d = new Date(iso);
    if (isNaN(d.getTime())) return "";
    const ms = Date.now() - d.getTime();
    if (ms < 0) return "just now";
    const sec = Math.floor(ms / 1000);
    if (sec < 5) return "just now";
    if (sec < 60) return `${sec}s ago`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}m ago`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}h ago`;
    const day = Math.floor(hr / 24);
    if (day < 7) return `${day}d ago`;
    const wk = Math.floor(day / 7);
    if (wk < 5) return `${wk}w ago`;
    const mo = Math.floor(day / 30);
    if (mo < 12) return `${mo}mo ago`;
    const yr = Math.floor(day / 365);
    return `${yr}y ago`;
  } catch {
    return "";
  }
}

function formatCount(n) {
  const value = Number(n) || 0;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}K`;
  return String(value);
}

function setIconCountState(button, iconName, count, active = false) {
  if (!button) return;
  button.classList.toggle("active", !!active);
  button.innerHTML = `${icon(iconName)}<strong>${formatCount(count || 0)}</strong>`;
}

function normalizeReactionEntries(reactions) {
  const source = reactions && typeof reactions === "object" ? reactions : {};
  const items = [];
  for (const [emoji, users] of Object.entries(source)) {
    const uniqueUsers = Array.from(new Set((Array.isArray(users) ? users : []).map((user) => String(user || "")).filter(Boolean)));
    if (!emoji || !uniqueUsers.length) continue;
    items.push({ emoji, users: uniqueUsers, count: uniqueUsers.length });
  }
  items.sort((a, b) => b.count - a.count || a.emoji.localeCompare(b.emoji));
  return items;
}

function reactionSignature(reactions) {
  return normalizeReactionEntries(reactions)
    .map((entry) => `${entry.emoji}:${entry.users.join(",")}`)
    .join("|");
}

const ICONS = {
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
  comment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 17 0Z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  repost: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
  plane: '<svg viewBox="0 0 24 24" aria-hidden="true" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>',
  bookmark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M19 21 12 17 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2Z"/></svg>',
  more: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 12.2 11.2 14.4 15.6 9.6"/><path d="M12 2.8 14.1 5l3-.3.7 2.9 2.6 1.5-1.4 2.7 1.4 2.7-2.6 1.5-.7 2.9-3-.3-2.1 2.2-2.1-2.2-3 .3-.7-2.9-2.6-1.5 1.4-2.7-1.4-2.7 2.6-1.5.7-2.9 3 .3Z"/></svg>',
  trash: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18"/><path d="M8 6V4h8v2"/><path d="m19 6-1 15H6L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>',
  phone: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 8-6 4 6 4V8Z"/><rect x="2" y="6" width="14" height="12" rx="2"/></svg>',
  lock: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  plus: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14"/><path d="M5 12h14"/></svg>',
  image: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="2"/><circle cx="8.5" cy="10" r="1.5"/><path d="m21 15-4.5-4.5L9 18"/></svg>',
  video: '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="13" height="12" rx="2"/><path d="m16 10 5-3v10l-5-3Z"/></svg>',
  spark: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2l1.8 6.1L20 10l-6.2 1.9L12 18l-1.8-6.1L4 10l6.2-1.9Z"/><path d="M19 16l.8 2.2L22 19l-2.2.8L19 22l-.8-2.2L16 19l2.2-.8Z"/></svg>',
};

function icon(name) {
  return ICONS[name] || "";
}

function iconCountButton(name, count, label, active = false) {
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = `actionIcon ${active ? "active" : ""}`.trim();
  btn.setAttribute("aria-label", label);
  btn.title = label;
  btn.innerHTML = `${icon(name)}<strong>${formatCount(count || 0)}</strong>`;
  return btn;
}

function verifiedBadge() {
  return renderUserBadge({ verified: true });
}

function ownerPopoverText(user) {
  const created = user && user.createdAt ? new Date(user.createdAt) : null;
  const memberSince = created && !Number.isNaN(created.getTime()) ? `Member since ${created.getFullYear()}` : "";
  return {
    title: user && user.role === "owner" ? "Verified Owner" : "Verified Account",
    body: user && user.role === "owner"
      ? "This account belongs to the creator and owner of HYSA."
      : "This account is verified on HYSA.",
    meta: user && user.role === "owner" ? (memberSince || "Official HYSA account") : memberSince,
  };
}

function closeBadgePopovers() {
  for (const node of document.querySelectorAll(".ownerBadgePopover")) node.remove();
}

function showBadgePopover(badge, user) {
  closeBadgePopovers();
  const copy = ownerPopoverText(user || {});
  const pop = document.createElement("div");
  pop.className = "ownerBadgePopover glass";
  pop.innerHTML = `<strong></strong><span></span><small></small>`;
  pop.querySelector("strong").textContent = copy.title;
  pop.querySelector("span").textContent = copy.body;
  pop.querySelector("small").textContent = copy.meta || "Official HYSA account";
  document.body.appendChild(pop);
  const rect = badge.getBoundingClientRect();
  const isMobile = window.matchMedia("(max-width: 640px)").matches;
  if (isMobile) {
    pop.classList.add("mobile");
    pop.style.left = "14px";
    pop.style.right = "14px";
    pop.style.bottom = `calc(18px + env(safe-area-inset-bottom))`;
  } else {
    pop.style.left = `${Math.min(window.innerWidth - 292, Math.max(12, rect.left - 22))}px`;
    pop.style.top = `${Math.max(12, rect.bottom + 10)}px`;
  }
  window.setTimeout(() => {
    const close = (event) => {
      if (event.target === badge || pop.contains(event.target)) return;
      closeBadgePopovers();
      document.removeEventListener("pointerdown", close);
    };
    document.addEventListener("pointerdown", close);
  }, 0);
}

function renderUserBadge(user = {}) {
  const role = String(user.role || user.authorRole || "").toLowerCase();
  const verified = !!(user.verified || user.authorVerified || role === "owner");
  if (!verified) return null;
  const badge = document.createElement("button");
  badge.type = "button";
  badge.className = `verifiedBadge hysaUserBadge ${role === "owner" ? "ownerBadge" : ""}`.trim();
  badge.innerHTML = role === "owner"
    ? '<span class="hysaBadgeCore">H</span><span class="hysaBadgeSpark"></span>'
    : '<span class="hysaBadgeCore">H</span>';
  badge.title = role === "owner" ? "Verified Owner" : "Verified";
  on(badge, "click", (event) => {
    event.preventDefault();
    event.stopPropagation();
    showBadgePopover(badge, user);
  });
  on(badge, "mouseenter", () => {
    if (!window.matchMedia("(hover: hover)").matches) return;
    showBadgePopover(badge, user);
  });
  return badge;
}

function pulseTap(node) {
  if (!node) return;
  node.classList.remove("tapPulse");
  void node.offsetWidth;
  node.classList.add("tapPulse");
}

function isFullMediaUrl(url) {
  return /^(\/uploads\/|https?:\/\/|data:(image|video|audio)\/[a-z0-9.+-]+;base64,)/i.test(String(url || ""));
}

function mediaDisplayUrl(item) {
  if (lowDataMode) return mediaThumbUrl(item);
  return String((item && (item.previewUrl || item.thumbnailUrl || item.url)) || "");
}

function mediaFullUrl(item) {
  return String((item && (item.fullUrl || item.url || item.previewUrl || item.thumbnailUrl)) || "");
}

function mediaThumbUrl(item) {
  if (lowDataMode) return String((item && (item.thumbnailUrl || item.previewUrl || item.url || item.fullUrl)) || "");
  return String((item && (item.thumbnailUrl || item.previewUrl || item.url || item.fullUrl)) || "");
}

function currentUserKey() {
  return String((me && (me.userKey || me.key || me.username)) || "").toLowerCase();
}

function isMineKey(key) {
  const mine = currentUserKey();
  return !!mine && String(key || "").toLowerCase() === mine;
}

let authFailureCount = 0;
const inflightGets = new Map();

async function fetchJson(path, opts = {}) {
  const p = String(path || "");
  if (!p.startsWith("/api/")) throw new Error("INVALID_API_PATH");

  const headers = new Headers(opts.headers || {});
  headers.set("Accept", "application/json");
  if (opts.body && !(opts.body instanceof FormData)) headers.set("Content-Type", "application/json; charset=utf-8");
  const method = String(opts.method || "GET").toUpperCase();
  if (csrfToken && ["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    headers.set("X-CSRF-Token", csrfToken);
  }

  let res;
  try {
    res = await fetch(p, { ...opts, headers, credentials: "include" });
  } catch {
    throw new Error("NETWORK");
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }
  if (json && typeof json.csrfToken === "string" && json.csrfToken) {
    csrfToken = json.csrfToken;
  }

  return { res, json };
}

async function api(path, opts = {}) {
  if (location.protocol === "file:") throw new Error("FILE_ORIGIN");

  const p = String(path || "");
  const method = String(opts.method || "GET").toUpperCase();
  if (method === "GET" && inflightGets.has(p)) return inflightGets.get(p);
  if (method === "GET") {
    const pending = api(p, { ...opts, method: "__GET_INTERNAL__" }).finally(() => inflightGets.delete(p));
    inflightGets.set(p, pending);
    return pending;
  }
  const actualOpts = method === "__GET_INTERNAL__" ? { ...opts, method: "GET" } : opts;
  const isAuthEndpoint = p.startsWith("/api/login") || p.startsWith("/api/register") || p.startsWith("/api/signup") || p.startsWith("/api/auth/google");
  let { res, json } = await fetchJson(p, actualOpts);

  if (res.status === 401 && !isAuthEndpoint) {
    authFailureCount += 1;
  } else if (res.ok && !(json && json.ok === false)) {
    authFailureCount = 0;
  }

  if (res.status === 401 && !isAuthEndpoint) {
    if (p.startsWith("/api/me") || authFailureCount > 2) {
      clearSession({ clearToken: true });
      showAuth();
    }
    throw new Error("UNAUTHENTICATED");
  }

  if (!res.ok || (json && json.ok === false)) {
    const msg = (json && (json.message || json.error)) || `HTTP_${res.status}`;
    throw new Error(msg);
  }

  return json;
}

function humanizeError(message, fallback) {
  const m = String(message || "");
  if (m === "FILE_ORIGIN") return t("error_file_origin");
  if (m === "NETWORK") return t("error_network");
  if (m === "INVALID_CREDENTIALS") return t("error_invalid_credentials");
  if (m === "USERNAME_TAKEN") return t("error_username_taken");
  if (m === "INVALID_USERNAME") return t("error_invalid_username");
  if (m === "INVALID_PASSWORD") return t("error_invalid_password");
  if (m === "INVALID_POST") return t("error_invalid_post");
  if (m === "INVALID_COMMENT") return t("error_invalid_comment");
  if (m === "BIO_TOO_LONG") return t("error_bio_too_long");
  if (m === "INVALID_MEDIA") return t("error_invalid_media");
  if (m === "UPLOAD_TOO_LARGE") return t("error_upload_too_large");
  if (m === "UPLOAD_INVALID") return t("error_upload_invalid");
  if (m === "UPLOAD_ENDPOINT_MISSING") return t("error_upload_missing");
  if (m === "REPORT_INVALID") return t("error_report_invalid");
  if (m === "GOOGLE_AUTH_NOT_CONFIGURED") return t("error_google_auth_not_configured");
  if (m === "INVALID_GOOGLE_CREDENTIAL") return t("error_invalid_google_credential");
  if (m === "INVALID_CSRF_TOKEN") return "Security check failed. Please refresh and try again.";
  if (m && m !== "SERVER_ERROR") return m;
  return fallback || t("error_unknown");
}

function clearSession({ clearToken = true } = {}) {
  endVideoCall({ closePeerCall: true });
  if (peerClient && typeof peerClient.destroy === "function") peerClient.destroy();
  peerClient = null;
  peerReadyPromise = null;
  if (clearToken) clearStoredToken();
  me = null;
}

let googleAuthReady = false;
let googleAuthInitializing = false;

async function loadGoogleClientId() {
  if (googleClientId) return googleClientId;
  if (!googleClientConfigPromise) {
    googleClientConfigPromise = api("/api/config", { method: "GET" })
      .then((r) => {
        googleClientId = String(r?.googleClientId || "").trim();
        if (/^(localhost|127\.0\.0\.1|\[::1\])$/.test(window.location.hostname)) {
          console.log("[HYSA Google Auth] client_id:", googleClientId || "(missing)");
        }
        if (!googleClientId) throw new Error("GOOGLE_AUTH_NOT_CONFIGURED");
        return googleClientId;
      })
      .catch((err) => {
        googleClientConfigPromise = null;
        throw err;
      });
  }
  return googleClientConfigPromise;
}

function loadGoogleIdentityScript() {
  if (window.google?.accounts?.id) return Promise.resolve();
  const existing = document.querySelector("script[src*='accounts.google.com/gsi/client']");
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      window.setTimeout(() => {
        if (window.google?.accounts?.id) resolve();
      }, 800);
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.defer = true;
    script.nonce = getCspNonce();
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

async function finishGoogleLogin(response) {
  const credential = String(response?.credential || "");
  if (!credential) throw new Error("INVALID_GOOGLE_CREDENTIAL");
  const r = await api("/api/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
  saveToken(true);
  authFailureCount = 0;
  me = r.me;
  showApp();
  route();
}

async function initGoogleAuth() {
  if (googleAuthReady || googleAuthInitializing) return;
  googleAuthInitializing = true;
  try {
    const clientId = await loadGoogleClientId();
    await loadGoogleIdentityScript();
    if (!window.google?.accounts?.id) throw new Error("GOOGLE_AUTH_NOT_CONFIGURED");
    window.google.accounts.id.initialize({
      client_id: clientId,
      callback: (response) => {
        const msg = document.getElementById("googleAuthMsg");
        setMsg(msg, t("loading"));
        finishGoogleLogin(response)
          .catch((err) => setMsg(msg, humanizeError(err?.message), true));
      },
    });
    googleAuthReady = true;
  } finally {
    googleAuthInitializing = false;
  }
}

function ensureGoogleAuthButton() {
  if (document.getElementById("googleAuthButton")) return;
  const target = el.registerForm || el.loginForm;
  if (!target || !target.parentElement) return;
  const wrap = document.createElement("div");
  wrap.className = "googleAuthWrap";
  const divider = document.createElement("div");
  divider.className = "authDivider";
  divider.textContent = "or";
  const button = document.createElement("button");
  button.id = "googleAuthButton";
  button.type = "button";
  button.className = "googleAuthButton";
  button.innerHTML = '<span class="googleMark">G</span><span data-t="continueWithGoogle"></span>';
  const label = button.querySelector("[data-t]");
  if (label) label.textContent = t("continueWithGoogle");
  const msg = document.createElement("div");
  msg.id = "googleAuthMsg";
  msg.className = "msg";
  on(button, "click", async () => {
    setMsg(msg, t("loading"));
    button.disabled = true;
    try {
      await initGoogleAuth();
      window.google.accounts.id.prompt((notification) => {
        if (notification.isNotDisplayed() || notification.isSkippedMoment()) {
          setMsg(msg, "Use the Google popup or allow popups for this site.", true);
        }
      });
    } catch (err) {
      setMsg(msg, humanizeError(err?.message), true);
    } finally {
      button.disabled = false;
    }
  });
  wrap.appendChild(divider);
  wrap.appendChild(button);
  wrap.appendChild(msg);
  target.parentElement.insertBefore(wrap, target.nextSibling);
}

function hideAllOverlays() {
  clearStoryProgress();
  if (el.composeModal) el.composeModal.hidden = true;
  if (el.profileModal) el.profileModal.hidden = true;
  if (el.reportModal) el.reportModal.hidden = true;
  if (el.insightsModal) el.insightsModal.hidden = true;
  if (el.dmModal) el.dmModal.hidden = true;
  if (el.storyComposer) el.storyComposer.hidden = true;
  if (el.storyViewer) el.storyViewer.hidden = true;
  if (el.aiPanel) el.aiPanel.hidden = true;
}

let dmRecorder = null;
let dmRecordingChunks = [];
let dmRecordingStartedAt = 0;
let dmRecordingTimer = null;
let dmVoiceDraft = null;
let dmRecordingStream = null;

function formatDuration(seconds) {
  const n = Number.isFinite(Number(seconds)) ? Math.max(0, Math.floor(Number(seconds))) : 0;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function customAudioPlayer(url, { compact = false, effect = "", speed = 1 } = {}) {
  const wrap = document.createElement("div");
  wrap.className = `voicePlayer ${compact ? "compact" : ""}`.trim();

  const audio = document.createElement("audio");
  audio.src = url;
  audio.preload = "metadata";
  const speeds = [1, 1.5, 2];
  let speedIndex = Math.max(0, speeds.indexOf(Number(speed) || 1));
  audio.playbackRate = speeds[speedIndex] || (effect === "deep" ? 0.5 : effect === "high" ? 1.5 : 1);

  const play = document.createElement("button");
  play.type = "button";
  play.className = "voicePlay";
  play.setAttribute("aria-label", "Play voice message");
  play.textContent = "Play";

  const wave = document.createElement("div");
  wave.className = "voiceWave";
  for (let i = 0; i < 24; i += 1) {
    const bar = document.createElement("span");
    bar.style.setProperty("--h", `${18 + ((i * 17) % 34)}%`);
    wave.appendChild(bar);
  }

  const time = document.createElement("span");
  time.className = "voiceTime";
  time.textContent = "0:00";
  const speedBtn = document.createElement("button");
  speedBtn.type = "button";
  speedBtn.className = "voiceSpeed";
  speedBtn.textContent = `${audio.playbackRate}x`;

  on(play, "click", () => {
    if (audio.paused) audio.play().catch(() => {});
    else audio.pause();
  });
  on(audio, "play", () => {
    wrap.classList.add("playing");
    play.textContent = "Pause";
  });
  on(audio, "pause", () => {
    wrap.classList.remove("playing");
    play.textContent = "Play";
  });
  on(audio, "ended", () => {
    wrap.classList.remove("playing");
    play.textContent = "Play";
    audio.currentTime = 0;
  });
  on(audio, "loadedmetadata", () => {
    time.textContent = `0:00 / ${formatDuration(audio.duration)}`;
  });
  on(audio, "timeupdate", () => {
    const total = Number(audio.duration || 0);
    const current = Number(audio.currentTime || 0);
    time.textContent = `${formatDuration(current)} / ${formatDuration(total || current)}`;
    wrap.style.setProperty("--progress", total ? String(current / total) : "0");
  });
  on(speedBtn, "click", () => {
    speedIndex = (speedIndex + 1) % speeds.length;
    audio.playbackRate = speeds[speedIndex];
    speedBtn.textContent = `${speeds[speedIndex]}x`;
  });

  wrap.appendChild(audio);
  wrap.appendChild(play);
  wrap.appendChild(wave);
  wrap.appendChild(time);
  wrap.appendChild(speedBtn);
  return wrap;
}

function customVideoPlayer(url, {
  muted = false,
  autoplay = false,
  poster = "",
  previewUrl = "",
  onDoubleTap = null,
  singleTapBehavior = "toggle",
} = {}) {
  const player = document.createElement("div");
  player.className = "proVideo";

  const video = document.createElement("video");
  const fullUrl = String(url || "");
  const lightUrl = String(previewUrl || "");
  video.dataset.src = fullUrl;
  if (autoplay) {
    video.src = lightUrl || fullUrl;
    video.dataset.autoplay = "1";
  }
  if (poster) video.poster = poster;
  video.playsInline = true;
  video.preload = autoplay ? "metadata" : "none";
  video.muted = !!muted;
  video.loop = !!autoplay;
  video.autoplay = !!autoplay;

  const center = document.createElement("button");
  center.type = "button";
  center.className = "videoCenterPlay";
  center.setAttribute("aria-label", "Play video");
  center.textContent = "Play";

  const spinner = document.createElement("div");
  spinner.className = "videoSpinner";
  spinner.setAttribute("aria-hidden", "true");

  const controls = document.createElement("div");
  controls.className = "videoControls glass";
  const play = document.createElement("button");
  play.type = "button";
  play.className = "videoControlBtn";
  play.setAttribute("aria-label", "Play video");
  play.textContent = "Play";
  const bar = document.createElement("button");
  bar.type = "button";
  bar.className = "videoProgress";
  bar.setAttribute("aria-label", "Seek video");
  const fill = document.createElement("span");
  bar.appendChild(fill);
  const time = document.createElement("span");
  time.className = "videoTime";
  time.textContent = "0:00";
  const mute = document.createElement("button");
  mute.type = "button";
  mute.className = "videoControlBtn";
  mute.setAttribute("aria-label", "Mute video");
  mute.textContent = video.muted ? "Muted" : "Sound";

  let tapTimer = null;
  let lastTapAt = 0;

  function sync() {
    const total = Number(video.duration || 0);
    const current = Number(video.currentTime || 0);
    fill.style.width = `${total ? (current / total) * 100 : 0}%`;
    time.textContent = formatDuration(total ? Math.max(0, total - current) : current);
  }
  function setPausedState() {
    const paused = video.paused;
    player.classList.toggle("isPaused", paused);
    play.textContent = paused ? "Play" : "Pause";
    center.textContent = paused ? "Play" : "";
  }
  function setLoadingState(isLoading) {
    player.classList.toggle("isLoading", !!isLoading);
  }
  function togglePlay() {
    if (!video.currentSrc && video.dataset.src) {
      video.src = video.dataset.src;
      video.load();
    }
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }
  function clearTapTimer() {
    if (tapTimer) window.clearTimeout(tapTimer);
    tapTimer = null;
  }
  function handleSurfaceTap(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    const now = Date.now();
    if (now - lastTapAt < 280) {
      clearTapTimer();
      lastTapAt = 0;
      if (typeof onDoubleTap === "function") onDoubleTap(event);
      return;
    }
    lastTapAt = now;
    clearTapTimer();
    tapTimer = window.setTimeout(() => {
      tapTimer = null;
      lastTapAt = 0;
      if (singleTapBehavior === "toggle") togglePlay();
    }, typeof onDoubleTap === "function" ? 220 : 0);
  }

  on(play, "click", togglePlay);
  on(center, "click", togglePlay);
  on(video, "click", handleSurfaceTap);
  on(center, "dblclick", (event) => event.preventDefault());
  on(video, "dblclick", (event) => event.preventDefault());
  on(video, "play", setPausedState);
  on(video, "pause", setPausedState);
  on(video, "loadedmetadata", sync);
  on(video, "timeupdate", sync);
  on(video, "loadstart", () => setLoadingState(true));
  on(video, "waiting", () => setLoadingState(true));
  on(video, "stalled", () => setLoadingState(true));
  on(video, "canplay", () => setLoadingState(false));
  on(video, "playing", () => setLoadingState(false));
  on(mute, "click", () => {
    video.muted = !video.muted;
    mute.textContent = video.muted ? "Muted" : "Sound";
  });
  on(bar, "click", (event) => {
    const rect = bar.getBoundingClientRect();
    const pct = rect.width ? (event.clientX - rect.left) / rect.width : 0;
    if (Number.isFinite(video.duration)) video.currentTime = Math.max(0, Math.min(1, pct)) * video.duration;
  });

  controls.appendChild(play);
  controls.appendChild(bar);
  controls.appendChild(time);
  controls.appendChild(mute);
  player.appendChild(video);
  player.appendChild(spinner);
  player.appendChild(center);
  player.appendChild(controls);
  setPausedState();
  setLoadingState(autoplay);
  if (autoplay) {
    window.setTimeout(() => video.play().catch(() => {}), 0);
  }
  return player;
}

let mediaPlaybackObserver = null;
function observeMediaPlayback(root) {
  const videos = Array.from((root || document).querySelectorAll(".proVideo video"));
  if (!videos.length) return;
  if (!mediaPlaybackObserver) {
    mediaPlaybackObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const v = entry.target;
          if (!(v instanceof HTMLVideoElement)) continue;
          if (entry.isIntersecting) {
            if (v.dataset.autoplay !== "1") continue;
            if (v.closest("#reelsView")) {
              for (const other of document.querySelectorAll("#reelsView .reelCard video")) {
                if (other !== v) other.pause();
              }
            }
            v.play().catch(() => {});
          } else {
            v.pause();
          }
        }
      },
      { threshold: 0.72 },
    );
  }
  for (const v of videos) mediaPlaybackObserver.observe(v);
}

let feedRevealObserver = null;
let feedRevealIndex = 0;
function observeFeedReveal(node, index = feedRevealIndex++) {
  if (!node || !node.classList) return;
  node.classList.add("feed-reveal");
  node.style.setProperty("--feed-reveal-delay", `${Math.min(index, 8) * 70}ms`);
  if (!("IntersectionObserver" in window)) {
    window.requestAnimationFrame(() => node.classList.add("is-visible"));
    return;
  }
  if (!feedRevealObserver) {
    feedRevealObserver = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          entry.target.classList.add("is-visible");
          feedRevealObserver.unobserve(entry.target);
        }
      },
      { root: null, rootMargin: "0px 0px -8% 0px", threshold: 0.14 },
    );
  }
  feedRevealObserver.observe(node);
}

function scrollDmToLatest({ smooth = false } = {}) {
  if (!el.dmMessages) return;
  el.dmMessages.scrollTo({ top: el.dmMessages.scrollHeight, behavior: smooth ? "smooth" : "auto" });
}

function resetMainScroll() {
  const main = document.querySelector(".main-content");
  if (main) main.scrollTop = 0;
  if (el.feed) el.feed.scrollTop = 0;
  if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
  window.scrollTo({ top: 0, left: 0, behavior: "auto" });
}

function currentScrollY() {
  return window.scrollY || document.documentElement.scrollTop || document.body.scrollTop || 0;
}

function rememberHomeScroll() {
  if (activeProfileKey || activePostId) return;
  const hash = location.hash || "#home";
  if (hash !== "#home" && hash !== "#") return;
  localStorage.setItem(HOME_SCROLL_KEY, String(Math.max(0, Math.round(currentScrollY()))));
}

function restoreHomeScroll() {
  const y = Number(localStorage.getItem(HOME_SCROLL_KEY) || 0);
  if (!Number.isFinite(y) || y <= 0) return;
  window.requestAnimationFrame(() => {
    window.scrollTo({ top: y, left: 0, behavior: "auto" });
  });
}

function rememberSeenPost(postId) {
  if (!postId) return;
  const id = String(postId);
  if (seenPostIds.has(id)) return;
  seenPostIds.add(id);
  try {
    localStorage.setItem(SEEN_POSTS_KEY, JSON.stringify(Array.from(seenPostIds).slice(-600)));
  } catch {
    // localStorage may be full or unavailable; visual state can simply remain session-only.
  }
}

function dmMessageSignature(messages) {
  return (Array.isArray(messages) ? messages : [])
    .map((message) => `${message.id}|${message.seen ? "1" : "0"}|${reactionSignature(message.reactions)}`)
    .join("~");
}

function renderDmReactionSummary(message) {
  const entries = normalizeReactionEntries(message.reactions);
  if (!entries.length) return null;
  const row = document.createElement("div");
  row.className = "dmReactionSummary";
  for (const entry of entries) {
    const pill = document.createElement("button");
    pill.type = "button";
    pill.className = "dmReactionPill";
    if (entry.users.includes(currentUserKey())) pill.classList.add("active");
    pill.textContent = `${entry.emoji} ${entry.count}`;
    on(pill, "click", async () => {
      try {
        await api(`/api/dm/message/${encodeURIComponent(message.id)}/reactions`, {
          method: "POST",
          body: JSON.stringify({ emoji: entry.emoji }),
        });
        if (activeDmPeer) await openDmThread(activeDmPeer, { silent: true, preserveScroll: true });
      } catch (err) {
        showToast(humanizeError(err?.message), true);
      }
    });
    row.appendChild(pill);
  }
  return row;
}

function openDmReactionPicker(message) {
  const emojis = ["👍", "❤️", "😂", "😮", "😢", "🔥"];
  showActionSheet("React", (body) => {
    const row = document.createElement("div");
    row.className = "storyViewerReactions";
    for (const emoji of emojis) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "storyReactionBtn";
      btn.textContent = emoji;
      on(btn, "click", async () => {
        try {
          await api(`/api/dm/message/${encodeURIComponent(message.id)}/reactions`, {
            method: "POST",
            body: JSON.stringify({ emoji }),
          });
          hideActionSheet();
          if (activeDmPeer) await openDmThread(activeDmPeer, { silent: true, preserveScroll: true });
        } catch (err) {
          showToast(humanizeError(err?.message), true);
        }
      });
      row.appendChild(btn);
    }
    body.appendChild(row);
  });
}

function renderDmMessage(message) {
  const row = document.createElement("div");
  row.className = `dmMessageRow ${message.mine ? "mine" : "theirs"}`.trim();
  const b = document.createElement("div");
  b.className = `dmBubble ${message.mine ? "mine" : "theirs"}`.trim();
  b.dataset.messageId = String(message.id || "");
  if (!message.mine && activeDmPeerProfile) {
    row.appendChild(avatarNode(activeDmPeerProfile.avatarUrl, activeDmPeerProfile.username, "xs"));
  }
  const media = Array.isArray(message.media) ? message.media : [];
  if (message.text) {
    const text = document.createElement("div");
    text.className = "dmBubbleText";
    text.textContent = message.text;
    b.appendChild(text);
  }
  for (const item of media) {
    if (!item || !item.url) continue;
    const wrap = document.createElement("div");
    wrap.className = `dmMedia dmMedia-${item.kind || "file"}`;
    if (!isFullMediaUrl(item.url)) {
      const archived = document.createElement("div");
      archived.className = "mediaArchived";
      archived.innerHTML = `<strong>Media unavailable</strong><span>This upload is missing from storage.</span>`;
      wrap.appendChild(archived);
      b.appendChild(wrap);
      continue;
    }
    if (item.kind === "image") {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.src = mediaDisplayUrl(item);
      img.dataset.fullSrc = mediaFullUrl(item);
      wrap.appendChild(img);
    } else if (item.kind === "video") {
      wrap.appendChild(customVideoPlayer(mediaFullUrl(item), {
        poster: mediaThumbUrl(item),
        previewUrl: String(item.previewUrl || ""),
      }));
    } else if (item.kind === "audio") {
      wrap.appendChild(customAudioPlayer(item.url, { compact: true, effect: item.effect || "", speed: item.speed || 1 }));
    }
    b.appendChild(wrap);
  }
  const meta = document.createElement("div");
  meta.className = "dmBubbleMeta";
  const time = document.createElement("span");
  time.textContent = fmtTime(message.createdAt);
  meta.appendChild(time);
  if (message.mine) {
    const seen = document.createElement("span");
    seen.className = "dmSeenState";
    seen.textContent = message.seen ? "Seen" : "Sent";
    meta.appendChild(seen);
  }
  const react = document.createElement("button");
  react.type = "button";
  react.className = "dmReactionTrigger";
  react.textContent = "☺";
  on(react, "click", () => openDmReactionPicker(message));
  meta.appendChild(react);
  b.appendChild(meta);
  const summary = renderDmReactionSummary(message);
  if (summary) b.appendChild(summary);
  if (!b.childNodes.length) b.textContent = "Message";
  row.appendChild(b);
  return row;
}

function stopDmPolling() {
  dmPollGeneration += 1;
  if (dmThreadPollTimer) window.clearInterval(dmThreadPollTimer);
  if (dmInboxPollTimer) window.clearInterval(dmInboxPollTimer);
  dmThreadPollTimer = null;
  dmInboxPollTimer = null;
}

function renderDmThreadList(threads) {
  if (!el.dmThreads) return;
  el.dmThreads.textContent = "";
  if (!threads.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = "No conversations yet.";
    el.dmThreads.appendChild(empty);
    return;
  }
  for (const t of threads) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "dmThreadItem";
    btn.dataset.peerKey = t.peerKey;
    if (activeDmPeer && t.peerKey === activeDmPeer) btn.classList.add("active");
    const unread = Number(t.unreadCount || 0);
    btn.appendChild(avatarNode(t.peerAvatar, t.peerUsername, "sm"));
    const copy = document.createElement("span");
    copy.className = "dmThreadCopy";
    const name = document.createElement("strong");
    name.textContent = `@${t.peerUsername}`;
    const threadBadge = renderUserBadge({ verified: t.peerVerified, role: t.peerRole, createdAt: t.peerCreatedAt });
    if (threadBadge) name.appendChild(threadBadge);
    const preview = document.createElement("small");
    preview.textContent = t.lastMessage || "Tap to chat";
    copy.appendChild(name);
    copy.appendChild(preview);
    btn.appendChild(copy);
    if (unread > 0) {
      const badge = document.createElement("span");
      badge.className = "dmUnread";
      badge.textContent = String(unread);
      btn.appendChild(badge);
    }
    on(btn, "click", () => {
      location.hash = `#dm/${encodeURIComponent(t.peerKey)}`;
    });
    el.dmThreads.appendChild(btn);
  }
}

function ensureDmRecordStatus() {
  const bar = el.dmText?.closest(".dm-input-bar");
  if (!bar) return null;
  let status = document.getElementById("dmRecordStatus");
  if (status) return status;
  status = document.createElement("div");
  status.id = "dmRecordStatus";
  status.className = "dmRecordStatus";
  status.hidden = true;
  status.innerHTML = `
    <span class="recordDot"></span>
    <strong>0:00</strong>
    <div class="recordWave"></div>
    <div class="recordActions">
      <button type="button" data-record-stop>Stop</button>
      <button type="button" data-record-cancel>Cancel</button>
      <button type="button" data-voice-play>Play</button>
      <button type="button" data-voice-rerecord>Re-record</button>
      <button type="button" data-voice-speed="0.5">0.5x</button>
      <button type="button" data-voice-speed="1">1x</button>
      <button type="button" data-voice-speed="1.5">1.5x</button>
      <button type="button" data-voice-speed="2">2x</button>
      <button type="button" data-voice-send>Send</button>
    </div>`;
  const wave = status.querySelector(".recordWave");
  for (let i = 0; i < 18; i += 1) {
    const barNode = document.createElement("span");
    barNode.style.setProperty("--h", `${18 + ((i * 19) % 52)}%`);
    wave.appendChild(barNode);
  }
  on(status.querySelector("[data-record-stop]"), "click", () => stopDmRecording());
  on(status.querySelector("[data-record-cancel]"), "click", () => stopDmRecording({ cancel: true }));
  on(status.querySelector("[data-voice-rerecord]"), "click", () => {
    clearDmVoiceDraft();
    startDmRecording().catch(() => showToast("Microphone permission was denied.", true));
  });
  on(status.querySelector("[data-voice-send]"), "click", sendDmVoiceDraft);
  for (const speedBtn of status.querySelectorAll("[data-voice-speed]")) {
    on(speedBtn, "click", () => setDmVoiceSpeed(Number(speedBtn.getAttribute("data-voice-speed")) || 1));
  }
  on(status.querySelector("[data-voice-play]"), "click", () => {
    if (!dmVoiceDraft?.audio) return;
    if (dmVoiceDraft.audio.paused) dmVoiceDraft.audio.play().catch(() => {});
    else dmVoiceDraft.audio.pause();
  });
  bar.parentElement?.insertBefore(status, bar);
  return status;
}

function setDmRecordStatus(state, text = "") {
  const status = ensureDmRecordStatus();
  if (!status) return;
  status.hidden = state === "idle";
  status.dataset.state = state;
  const label = status.querySelector("strong");
  if (label && text) label.textContent = text;
}

function stopDmRecording({ cancel = false } = {}) {
  if (!dmRecorder || dmRecorder.state === "inactive") return;
  dmRecorder._hysaCancel = !!cancel;
  dmRecorder.stop();
}

function updateDmSendState() {
  if (!el.dmSend) return;
  const hasText = !!String(el.dmText?.value || "").trim();
  el.dmSend.classList.toggle("ready", hasText || !!dmVoiceDraft);
}

function clearDmVoiceDraft() {
  document.getElementById("dmRecordStatus")?.classList.remove("sending");
  if (dmVoiceDraft?.url) URL.revokeObjectURL(dmVoiceDraft.url);
  if (dmVoiceDraft?.audio) dmVoiceDraft.audio.pause();
  dmVoiceDraft = null;
  dmRecordingChunks = [];
  setDmRecordStatus("idle");
  updateDmSendState();
}

function setDmVoiceSpeed(speed) {
  if (!dmVoiceDraft?.audio) return;
  const nextSpeed = [0.5, 1, 1.5, 2].includes(Number(speed)) ? Number(speed) : 1;
  dmVoiceDraft.speed = nextSpeed;
  dmVoiceDraft.audio.playbackRate = nextSpeed;
  const status = ensureDmRecordStatus();
  if (status) {
    for (const btn of status.querySelectorAll("[data-voice-speed]")) {
      btn.classList.toggle("active", Number(btn.getAttribute("data-voice-speed")) === nextSpeed);
    }
  }
}

function createDmVoiceDraft(blob, duration, mime) {
  clearDmVoiceDraft();
  const cleanMime = String(mime || "audio/webm").split(";")[0] || "audio/webm";
  const voiceBlob = blob.type === cleanMime ? blob : new Blob([blob], { type: cleanMime });
  const url = URL.createObjectURL(voiceBlob);
  const audio = new Audio(url);
  dmVoiceDraft = { blob: voiceBlob, duration, mime: cleanMime, url, audio, speed: 1 };
  setDmVoiceSpeed(1);
  setDmRecordStatus("preview", formatDuration(duration));
  updateDmSendState();
}

async function sendDmVoiceDraft() {
  if (!dmVoiceDraft || !activeDmPeer) return;
  const status = ensureDmRecordStatus();
  const sendBtn = status?.querySelector("[data-voice-send]");
  if (sendBtn) sendBtn.disabled = true;
  try {
    setDmRecordStatus("uploading", "Uploading...");
    const mime = dmVoiceDraft.mime || "audio/webm";
    const ext = mime.includes("mp4") ? "m4a" : mime.includes("ogg") ? "ogg" : "webm";
    const file = new File([dmVoiceDraft.blob], `voice-message-${Date.now()}.${ext}`, { type: mime });
    const media = await uploadFile(file);
    const statusNode = ensureDmRecordStatus();
    statusNode?.classList.add("sending");
    await sendDmMessage({
      media: [{
        ...media,
        type: "voice",
        duration: dmVoiceDraft.duration,
        speed: dmVoiceDraft.speed || 1,
      }],
    });
    showToast("Voice message sent.");
    clearDmVoiceDraft();
  } catch (err) {
    setDmRecordStatus("error", humanizeError(err?.message, t("error_upload_invalid")));
    showToast(humanizeError(err?.message, t("error_upload_invalid")), true);
  } finally {
    if (sendBtn) sendBtn.disabled = false;
  }
}

async function startDmRecording() {
  if (!activeDmPeer) return;
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    showToast("Voice recording is not supported in this browser.", true);
    return;
  }
  clearDmVoiceDraft();
  dmRecordingStream = await navigator.mediaDevices.getUserMedia({ audio: true });
  dmRecordingChunks = [];
  const preferredMime = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"]
    .find((type) => window.MediaRecorder.isTypeSupported && window.MediaRecorder.isTypeSupported(type)) || "";
  dmRecorder = preferredMime ? new MediaRecorder(dmRecordingStream, { mimeType: preferredMime }) : new MediaRecorder(dmRecordingStream);
  dmRecorder.ondataavailable = (event) => {
    if (event.data && event.data.size) dmRecordingChunks.push(event.data);
  };
  dmRecorder.onstop = () => {
    if (dmRecordingStream) dmRecordingStream.getTracks().forEach((track) => track.stop());
    dmRecordingStream = null;
    if (dmRecordingTimer) window.clearInterval(dmRecordingTimer);
    dmRecordingTimer = null;
    el.dmRecord?.classList.remove("recording");
    if (dmRecorder._hysaCancel) {
      dmRecordingChunks = [];
      setDmRecordStatus("idle");
      showToast("Recording cancelled.");
      dmRecorder = null;
      return;
    }
    try {
      const duration = Math.max(1, Math.round((Date.now() - dmRecordingStartedAt) / 1000));
      const mime = dmRecorder.mimeType || "audio/webm";
      const blob = new Blob(dmRecordingChunks, { type: mime });
      if (!blob.size) throw new Error("UPLOAD_INVALID");
      createDmVoiceDraft(blob, duration, mime);
      showToast("Voice preview ready.");
    } catch (err) {
      setDmRecordStatus("error", humanizeError(err?.message, t("error_upload_invalid")));
      showToast(humanizeError(err?.message, t("error_upload_invalid")), true);
    } finally {
      dmRecorder = null;
    }
  };
  dmRecorder.start(250);
  el.dmRecord?.classList.add("recording");
  dmRecordingStartedAt = Date.now();
  setDmRecordStatus("recording", "0:00");
  dmRecordingTimer = window.setInterval(() => {
    setDmRecordStatus("recording", formatDuration((Date.now() - dmRecordingStartedAt) / 1000));
  }, 250);
  showToast("Recording... tap Stop to preview.");
}

async function refreshDmInbox({ silent = false } = {}) {
  const r = await api("/api/dm/threads", { method: "GET" });
  const threads = Array.isArray(r.threads) ? r.threads : [];
  const signature = threads.map((item) => `${item.peerKey}|${item.createdAt}|${item.unreadCount}|${item.lastMessage}`).join("~");
  if (!silent || signature !== lastDmInboxSignature) {
    renderDmThreadList(threads);
    lastDmInboxSignature = signature;
  }
}

function startDmInboxPolling() {
  stopDmPolling();
  const generation = ++dmPollGeneration;
  dmInboxPollTimer = window.setInterval(() => {
    if (generation !== dmPollGeneration || location.hash.startsWith("#dm/")) return;
    refreshDmInbox({ silent: true }).catch(() => {});
  }, 30000);
}

function applyDmThreadPayload(payload, { preserveScroll = false } = {}) {
  const messages = Array.isArray(payload?.messages) ? payload.messages : [];
  const signature = dmMessageSignature(messages);
  if (preserveScroll && signature === lastDmThreadSignature) return;
  lastDmThreadSignature = signature;
  activeDmPeerProfile = payload.peer || activeDmPeerProfile || { key: activeDmPeer, username: activeDmPeer, avatarUrl: "" };
  if (el.dmPeer) el.dmPeer.textContent = `@${activeDmPeerProfile.username || activeDmPeer || "dm"}`;
  if (el.dmPeer) {
    const dmBadge = renderUserBadge(activeDmPeerProfile);
    if (dmBadge) el.dmPeer.appendChild(dmBadge);
  }
  if (el.dmStatus) el.dmStatus.textContent = messages.length ? "Updated just now" : "No messages yet";
  if (el.dmHeaderAvatar) {
    el.dmHeaderAvatar.replaceWith(avatarNode(activeDmPeerProfile.avatarUrl, activeDmPeerProfile.username, "sm"));
    el.dmHeaderAvatar = document.getElementById("dmHeaderAvatar") || document.querySelector(".dm-view-header .avatar");
    if (el.dmHeaderAvatar) el.dmHeaderAvatar.id = "dmHeaderAvatar";
  }
  if (!el.dmMessages) return;
  const nearBottom = preserveScroll
    ? el.dmMessages.scrollHeight - el.dmMessages.scrollTop - el.dmMessages.clientHeight < 84
    : true;
  el.dmMessages.textContent = "";
  if (!messages.length) {
    const empty = document.createElement("div");
    empty.className = "dmEmpty";
    empty.textContent = "Say hello to start the conversation.";
    el.dmMessages.appendChild(empty);
    return;
  }
  for (const message of messages) el.dmMessages.appendChild(renderDmMessage(message));
  if (!preserveScroll || nearBottom) scrollDmToLatest({ smooth: preserveScroll });
}

function startDmThreadPolling(peerKey) {
  stopDmPolling();
  const generation = ++dmPollGeneration;
  dmThreadPollTimer = window.setInterval(() => {
    if (generation !== dmPollGeneration || activeDmPeer !== peerKey) return;
    openDmThread(peerKey, { silent: true, preserveScroll: true }).catch(() => {});
  }, 30000);
}

async function openDmThread(peerKey, { silent = false, preserveScroll = false } = {}) {
  activeDmPeer = peerKey;
  if (el.dmModal) el.dmModal.hidden = false;
  const r = await api(`/api/dm/${encodeURIComponent(peerKey)}`, { method: "GET" });
  const dmHeader = el.dmModal?.querySelector(".dm-view-header");
  if (dmHeader && !document.getElementById("dmCallButton")) {
    const callBtn = document.createElement("button");
    callBtn.id = "dmCallButton";
    callBtn.type = "button";
    callBtn.className = "iconBtn";
    callBtn.setAttribute("aria-label", "Start video call");
    callBtn.title = "Video call";
    callBtn.innerHTML = icon("phone");
    on(callBtn, "click", () => activeDmPeer && initiateVideoCall(activeDmPeer));
    dmHeader.appendChild(callBtn);
  }
  const dmCallButton = document.getElementById("dmCallButton");
  if (dmCallButton) dmCallButton.hidden = false;
  applyDmThreadPayload(r, { preserveScroll });
  if (el.dmThreads) {
    for (const n of el.dmThreads.querySelectorAll(".dmThreadItem")) {
      n.classList.toggle("active", n.dataset.peerKey === peerKey);
    }
  }
  refreshDmInbox({ silent: true }).catch(() => {});
  if (!silent) startDmThreadPolling(peerKey);
}

async function openDmInbox() {
  if (!el.dmModal) return;
  activeDmPeer = null;
  activeDmPeerProfile = null;
  lastDmThreadSignature = "";
  el.dmModal.hidden = false;
  if (el.dmPeer) el.dmPeer.textContent = "Direct Messages";
  if (el.dmStatus) el.dmStatus.textContent = "Inbox";
  const dmCallButton = document.getElementById("dmCallButton");
  if (dmCallButton) dmCallButton.hidden = true;
  if (el.dmMessages) {
    el.dmMessages.textContent = "";
    const empty = document.createElement("div");
    empty.className = "dmEmpty";
    empty.textContent = "Choose a conversation to start chatting.";
    el.dmMessages.appendChild(empty);
  }
  await refreshDmInbox();
  startDmInboxPolling();
}

function closeDmView() {
  stopDmPolling();
  if (el.dmModal) el.dmModal.hidden = true;
  activeDmPeer = null;
  activeDmPeerProfile = null;
}

async function sendDmMessage({ text = "", media = [] } = {}) {
  if (!activeDmPeer) return;
  const body = { text: String(text || "").trim(), media };
  if (!body.text && !body.media.length) return;
  if (el.dmSend) el.dmSend.disabled = true;
  try {
    await api(`/api/dm/${encodeURIComponent(activeDmPeer)}`, { method: "POST", body: JSON.stringify(body) });
    if (el.dmText) el.dmText.value = "";
    await openDmThread(activeDmPeer, { silent: true });
    scrollDmToLatest({ smooth: true });
  } catch (err) {
    showToast(humanizeError(err?.message), true);
  } finally {
    if (el.dmSend) el.dmSend.disabled = false;
  }
}

let peerClient = null;
let peerReadyPromise = null;
let activePeerCall = null;
let localCallStream = null;

function loadPeerJsClient() {
  if (window.Peer) return Promise.resolve();
  const existing = document.querySelector("script[data-peerjs='true']");
  if (existing) {
    return new Promise((resolve, reject) => {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
    });
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    script.src = "/vendor/peerjs.min.js";
    script.async = true;
    script.dataset.peerjs = "true";
    script.nonce = getCspNonce();
    script.onload = resolve;
    script.onerror = () => reject(new Error("Video calling failed to load."));
    document.head.appendChild(script);
  });
}

function ensureVideoCallStyles() {
  if (document.getElementById("videoCallStyles")) return;
  const style = document.createElement("style");
  style.id = "videoCallStyles";
  style.nonce = getCspNonce();
  style.textContent = `
    .video-call-overlay{position:fixed;inset:0;z-index:1200;background:rgba(5,8,14,.78);backdrop-filter:blur(22px);display:grid;place-items:center;padding:18px}
    .video-call-panel{width:min(960px,100%);height:min(720px,100%);display:grid;grid-template-rows:auto 1fr;gap:12px}
    .video-call-head{display:flex;align-items:center;justify-content:space-between;color:#fff}
    .video-call-stage{position:relative;border-radius:24px;overflow:hidden;background:#05070c;box-shadow:0 24px 80px rgba(0,0,0,.45)}
    .video-call-stage video{width:100%;height:100%;object-fit:cover;background:#080a12}
    .video-call-local{position:absolute;right:14px;bottom:14px;width:min(190px,34vw);aspect-ratio:9/16;border-radius:18px;border:1px solid rgba(255,255,255,.28);box-shadow:0 12px 36px rgba(0,0,0,.35)}
    .video-call-close{border:0;border-radius:999px;background:rgba(255,255,255,.16);color:#fff;padding:10px 16px;backdrop-filter:blur(18px)}
  `;
  document.head.appendChild(style);
}

function ensureIncomingCallModal() {
  ensureVideoCallStyles();
  let modal = document.getElementById("incomingCallModal");
  if (modal) return modal;
  modal = document.createElement("section");
  modal.id = "incomingCallModal";
  modal.className = "video-call-overlay";
  modal.hidden = true;
  modal.innerHTML = `
    <div class="video-call-panel" style="max-width: 420px; max-height: 320px;">
      <header class="video-call-head" style="padding: 0 0 16px;">
        <strong id="incomingCallTitle">Incoming Call</strong>
      </header>
      <div id="incomingCallAvatar" style="width: 100px; height: 100px; border-radius: 50%; margin: 0 auto 16px; display: grid; place-items: center; font-size: 48px; font-weight: 800; background: linear-gradient(135deg, rgba(47, 155, 255, 0.38), rgba(98, 240, 200, 0.28)); border: 1px solid rgba(255, 255, 255, 0.14);"></div>
      <div style="text-align: center; margin-bottom: 24px;">
        <div id="incomingCallerName" style="font-size: 22px; font-weight: 800; margin-bottom: 6px;"></div>
        <div style="color: var(--muted);">Video call</div>
      </div>
      <div style="display: flex; gap: 16px; justify-content: center;">
        <button id="declineCallBtn" class="btn ghost danger" style="min-width: 120px;">Decline</button>
        <button id="acceptCallBtn" class="btn primary" style="min-width: 120px;">Accept</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);
  return modal;
}

function showIncomingCall(peerKey, onAccept, onDecline) {
  const modal = ensureIncomingCallModal();
  const callerName = peerKey;
  const avatar = modal.querySelector("#incomingCallAvatar");
  avatar.textContent = callerName.charAt(0).toUpperCase();
  modal.querySelector("#incomingCallerName").textContent = `@${callerName}`;
  
  const acceptBtn = modal.querySelector("#acceptCallBtn");
  const declineBtn = modal.querySelector("#declineCallBtn");
  
  const cleanup = () => {
    acceptBtn.removeEventListener("click", handleAccept);
    declineBtn.removeEventListener("click", handleDecline);
  };
  
  const handleAccept = () => {
    cleanup();
    modal.hidden = true;
    if (onAccept) onAccept();
  };
  
  const handleDecline = () => {
    cleanup();
    modal.hidden = true;
    if (onDecline) onDecline();
  };
  
  on(acceptBtn, "click", handleAccept);
  on(declineBtn, "click", handleDecline);
  
  modal.hidden = false;
}

function ensureVideoCallOverlay() {
  ensureVideoCallStyles();
  let overlay = document.getElementById("videoCallOverlay");
  if (overlay) return overlay;
  overlay = document.createElement("section");
  overlay.id = "videoCallOverlay";
  overlay.className = "video-call-overlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="video-call-panel">
      <header class="video-call-head">
        <strong id="videoCallTitle">Video call</strong>
        <button id="videoCallClose" class="video-call-close" type="button">End</button>
      </header>
      <div class="video-call-stage">
        <video id="remoteVideo" autoplay playsinline></video>
        <video id="localVideo" class="video-call-local" autoplay muted playsinline></video>
      </div>
    </div>
  `;
  document.body.appendChild(overlay);
  on(overlay.querySelector("#videoCallClose"), "click", () => endVideoCall());
  return overlay;
}

function attachStream(video, stream) {
  if (!video || !stream) return;
  video.srcObject = stream;
  video.play().catch(() => {});
}

function showVideoCallUI(peerKey, localStream) {
  const overlay = ensureVideoCallOverlay();
  const title = overlay.querySelector("#videoCallTitle");
  if (title) title.textContent = `Video call with @${peerKey}`;
  attachStream(overlay.querySelector("#localVideo"), localStream);
  overlay.hidden = false;
}

function endVideoCall({ closePeerCall = true } = {}) {
  const call = activePeerCall;
  activePeerCall = null;
  if (closePeerCall && call && typeof call.close === "function") call.close();
  if (localCallStream) {
    localCallStream.getTracks().forEach((track) => track.stop());
    localCallStream = null;
  }
  const overlay = document.getElementById("videoCallOverlay");
  if (overlay) {
    const remote = overlay.querySelector("#remoteVideo");
    const local = overlay.querySelector("#localVideo");
    if (remote) remote.srcObject = null;
    if (local) local.srcObject = null;
    overlay.hidden = true;
  }
}

async function ensurePeerClient() {
  if (!me) throw new Error("UNAUTHENTICATED");
  if (peerClient && !peerClient.destroyed) return peerClient;
  if (peerReadyPromise) return peerReadyPromise;
  peerReadyPromise = (async () => {
    await loadPeerJsClient();
    const peerId = String(me.userKey || me.key || me.username || "").toLowerCase();
    if (!peerId) throw new Error("UNAUTHENTICATED");
    const opts = {
      host: location.hostname,
      path: "/peerjs",
      secure: location.protocol === "https:",
      debug: 1,
    };
    opts.port = location.port ? Number(location.port) : (opts.secure ? 443 : 80);
    const peer = new window.Peer(peerId, opts);
    peer.on("call", async (call) => {
    const handleAccept = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localCallStream = stream;
        activePeerCall = call;
        showVideoCallUI(call.peer, stream);
        call.answer(stream);
        call.on("stream", (remoteStream) => {
          const overlay = ensureVideoCallOverlay();
          attachStream(overlay.querySelector("#remoteVideo"), remoteStream);
        });
        call.on("close", () => endVideoCall({ closePeerCall: false }));
        call.on("error", () => endVideoCall({ closePeerCall: false }));
      } catch {
        showToast("Camera or microphone permission was denied.", true);
      }
    };
    const handleDecline = () => {
      if (call && typeof call.close === "function") {
        call.close();
      }
    };
    showIncomingCall(call.peer, handleAccept, handleDecline);
  });
    peer.on("error", (err) => {
      const msg = String(err?.type || err?.message || "Video call error");
      if (msg !== "unavailable-id") showToast(msg, true);
    });
    peerClient = peer;
    return peer;
  })().finally(() => {
    peerReadyPromise = null;
  });
  return peerReadyPromise;
}

async function initiateVideoCall(targetUserId) {
  const target = String(targetUserId || "").toLowerCase();
  if (!target || target === currentUserKey()) return;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    showToast("Video calling is not supported in this browser.", true);
    return;
  }
  try {
    const peer = await ensurePeerClient();
    const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
    localCallStream = stream;
    showVideoCallUI(target, stream);
    const call = peer.call(target, stream);
    activePeerCall = call;
    call.on("stream", (remoteStream) => {
      const overlay = ensureVideoCallOverlay();
      attachStream(overlay.querySelector("#remoteVideo"), remoteStream);
    });
    call.on("close", () => endVideoCall({ closePeerCall: false }));
    call.on("error", () => {
      showToast("Video call failed.", true);
      endVideoCall({ closePeerCall: false });
    });
  } catch (err) {
    showToast(humanizeError(err?.message, "Video call failed."), true);
    endVideoCall({ closePeerCall: false });
  }
}

window.initiateVideoCall = initiateVideoCall;

function showAuth() {
  hideAllOverlays();
  if (el.authView) el.authView.hidden = false;
  if (el.appView) el.appView.hidden = true;
  if (el.meBtn) el.meBtn.hidden = true;
  if (el.logoutBtn) el.logoutBtn.hidden = true;
  if (el.searchInput) {
    el.searchInput.disabled = true;
    el.searchInput.value = "";
  }
  if (el.searchResults) el.searchResults.hidden = true;
  if (el.composeFab) el.composeFab.hidden = true;
  if (el.mobileNav) el.mobileNav.hidden = true;
  if (el.dmBtn) el.dmBtn.hidden = true;
  if (el.reelsBtn) el.reelsBtn.hidden = true;
  if (el.aiFab) el.aiFab.hidden = true;
  if (el.aiPanel) el.aiPanel.hidden = true;
  location.hash = "#home";
}

function updateNavAvatar() {
  if (!el.navAvatar) return;
  if (me && me.avatarUrl) {
    el.navAvatar.innerHTML = `<img src="${me.avatarUrl}" alt="${me.username}" loading="lazy">`;
  } else if (me) {
    el.navAvatar.textContent = (me.username || "?")[0].toUpperCase();
  }
}

function showApp() {
  if (el.authView) el.authView.hidden = true;
  if (el.appView) el.appView.hidden = false;
  if (el.meBtn) el.meBtn.hidden = false;
  if (el.logoutBtn) el.logoutBtn.hidden = false;
  if (el.dmBtn) el.dmBtn.hidden = false;
  if (el.reelsBtn) el.reelsBtn.hidden = false;
  if (el.searchInput) el.searchInput.disabled = false;
  if (el.composeFab) el.composeFab.hidden = false;
  if (el.mobileNav) el.mobileNav.hidden = false;
  if (el.aiFab) el.aiFab.hidden = false;
  updateNavAvatar();
  if (me) ensurePeerClient().catch(() => {});
}

function ensureLowDataToggle() {
  if (!el.settingsView || document.getElementById("settingsLowData")) return;
  const body = el.settingsView.querySelector(".settings-body");
  if (!body) return;
  const section = document.createElement("div");
  section.className = "settings-section";
  section.innerHTML = `
    <h3 class="settings-section-title">Data</h3>
    <div class="settings-option">
      <div class="settings-option-info">
        <span class="settings-option-label">Low Data Mode</span>
        <span class="settings-option-desc muted">Use smaller thumbnails and stop automatic video loading</span>
      </div>
      <label class="toggle-switch">
        <input type="checkbox" id="settingsLowData">
        <span class="toggle-slider"></span>
      </label>
    </div>
  `;
  body.insertBefore(section, body.children[1] || null);
  const input = section.querySelector("#settingsLowData");
  input.checked = lowDataMode;
  on(input, "change", () => {
    setLowDataMode(input.checked);
    storiesLoadedAt = 0;
    trendsLoadedAt = 0;
    if (me) loadFeed({ reset: true }).catch(() => {});
  });
}

function showFeedError(err, { reset = false } = {}) {
  if (!el.feed) return;
  const code = String(err && err.message || "");
  if (code === "UNAUTHENTICATED" || !getToken()) {
    showAuth();
    return;
  }

  if (!reset && el.feed.children.length) {
    showToast(humanizeError(code, "Could not load feed."), true);
    return;
  }

  el.feed.textContent = "";
  const box = document.createElement("div");
  box.className = "muted";
  box.dataset.empty = "true";

  const message = document.createElement("div");
  message.textContent = humanizeError(code, "Could not load feed.");

  const retry = document.createElement("button");
  retry.type = "button";
  retry.className = "btn ghost sm";
  retry.textContent = "Retry";
  on(retry, "click", () => loadFeed({ reset: true }).catch(() => {}));

  box.appendChild(message);
  box.appendChild(retry);
  el.feed.appendChild(box);
}

function switchAuthTab(tab) {
  const isLogin = tab === "login";
  if (el.tabLogin) el.tabLogin.classList.toggle("active", isLogin);
  if (el.tabRegister) el.tabRegister.classList.toggle("active", !isLogin);
  if (el.loginForm) el.loginForm.hidden = !isLogin;
  if (el.registerForm) el.registerForm.hidden = isLogin;
}

function avatarNode(avatarUrl, fallback, sizeClass = "") {
  const node = document.createElement("div");
  node.className = `avatar ${sizeClass}`.trim();
  if (fallback) node.dataset.ukey = String(fallback).trim().toLowerCase();
  if (avatarUrl) {
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.referrerPolicy = "no-referrer";
    img.src = avatarUrl;
    node.appendChild(img);
  } else {
    const ch = String(fallback || "?").trim().slice(0, 1).toUpperCase() || "?";
    node.textContent = ch;
  }
  return node;
}

function safeStoryList(stories) {
  return (Array.isArray(stories) ? stories : [])
    .filter((story) => story && story.id && story.media && story.media.url)
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")) || String(a.id).localeCompare(String(b.id)));
}

function storyLabel(story) {
  return String(story && story.author ? story.author : "user");
}

function storyOwnerKey(story) {
  return String(story && (story.authorKey || story.author || "")).toLowerCase();
}

function buildStoryGroups(stories) {
  const map = new Map();
  for (const story of safeStoryList(stories)) {
    const key = storyOwnerKey(story);
    if (!key) continue;
    let group = map.get(key);
    if (!group) {
      group = {
        key,
        authorKey: String(story.authorKey || key),
        author: story.author || key,
        authorAvatar: story.authorAvatar || "",
        stories: [],
      };
      map.set(key, group);
    }
    group.stories.push(story);
    if (!group.authorAvatar && story.authorAvatar) group.authorAvatar = story.authorAvatar;
  }
  const groups = Array.from(map.values());
  groups.forEach((group) => {
    group.stories.sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
  });
  groups.sort((a, b) => {
    const aLatest = a.stories[a.stories.length - 1];
    const bLatest = b.stories[b.stories.length - 1];
    return String(bLatest?.createdAt || "").localeCompare(String(aLatest?.createdAt || ""));
  });
  return groups;
}

function storyGroupStartIndex(group) {
  const list = Array.isArray(group?.stories) ? group.stories : [];
  const firstUnseen = list.find((story) => !story.seen);
  const target = firstUnseen || list[0];
  return target ? storyIndexById(target.id) : -1;
}

function storyIndexById(id) {
  return storyCache.findIndex((story) => String(story.id) === String(id));
}

function openStoryById(id) {
  const idx = storyIndexById(id);
  if (idx >= 0) {
    activeStoryIndex = idx;
    renderStoryViewer();
  }
}

function storyNode(group) {
  const stories = Array.isArray(group?.stories) ? group.stories : [];
  const story = stories[stories.length - 1] || {
    id: "",
    authorKey: group?.authorKey || "",
    author: group?.author || "user",
    authorAvatar: group?.authorAvatar || "",
    seen: false,
  };
  const allSeen = stories.length > 0 && stories.every((item) => !!item.seen);
  const wrap = document.createElement("button");
  wrap.type = "button";
  wrap.className = "storyItem";
  wrap.title = `Story by @${storyLabel(story)}`;
  const ring = document.createElement("div");
  ring.className = `storyRing ${allSeen ? "seen" : ""}`.trim();
  ring.style.setProperty("--story-count", String(Math.max(1, stories.length || 1)));
  if (stories.length > 1) {
    ring.classList.add("segmented");
    const segments = document.createElement("div");
    segments.className = "storySegments";
    stories.slice(0, 8).forEach((item, index) => {
      const segment = document.createElement("span");
      segment.className = item.seen ? "seen" : "";
      segment.style.setProperty("--i", String(index));
      segment.style.setProperty("--n", String(Math.min(stories.length, 8)));
      segments.appendChild(segment);
    });
    ring.appendChild(segments);
  }
  ring.appendChild(avatarNode(story.authorAvatar, storyLabel(story)));
  if (stories.length > 1) {
    const count = document.createElement("span");
    count.className = "storyCountBadge";
    count.textContent = String(stories.length);
    ring.appendChild(count);
  }
  const label = document.createElement("div");
  label.className = "storyLabel";
  label.textContent = `@${storyLabel(story)}`;
  wrap.appendChild(ring);
  wrap.appendChild(label);
  on(wrap, "click", () => {
    const idx = storyGroupStartIndex(group);
    if (idx >= 0) openStoryViewer(idx);
  });
  return wrap;
}

function myStoryNode(myGroup) {
  const wrap = storyNode(myGroup || {
    authorKey: me?.userKey || me?.username || "me",
    author: me?.username || "me",
    authorAvatar: me?.avatarUrl || "",
    stories: [],
  });
  wrap.classList.add("storyMine");
  wrap.title = myGroup && myGroup.stories.length ? "View your story" : "Add story";
  const label = wrap.querySelector(".storyLabel");
  if (label) label.textContent = "Your story";
  const ring = wrap.querySelector(".storyRing");
  if (ring) ring.classList.toggle("empty", !(myGroup && myGroup.stories.length));

  const add = document.createElement("button");
  add.type = "button";
  add.className = "storyAddBtn";
  add.innerHTML = icon("plus");
  add.setAttribute("aria-label", "Add story");
  add.title = "Add story";
  on(add, "click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    openStoryComposer();
  });
  wrap.appendChild(add);

  if (!(myGroup && myGroup.stories.length)) {
    on(wrap, "click", (e) => {
      e.preventDefault();
      openStoryComposer();
    });
  }
  return wrap;
}

async function loadStories() {
  if (!el.storiesBar || !getToken()) return;
  if (storiesLoading) return;
  const ttl = lowDataMode ? 180000 : 45000;
  if (storiesLoadedAt && Date.now() - storiesLoadedAt < ttl && storyCache.length) return;
  storiesLoading = true;
  try {
    const r = await api("/api/stories", { method: "GET" });
    const stories = safeStoryList(r.stories);
    storyGroups = buildStoryGroups(stories);
    storyCache = storyGroups.flatMap((group) => group.stories);
    el.storiesBar.textContent = "";
    const myKey = String(me?.userKey || me?.username || "").toLowerCase();
    const myGroup = storyGroups.find((group) => group.key === myKey) || null;
    if (me) el.storiesBar.appendChild(myStoryNode(myGroup));
    for (const group of storyGroups) {
      if (myGroup && group.key === myGroup.key) continue;
      el.storiesBar.appendChild(storyNode(group));
    }
    el.storiesBar.hidden = !me && !stories.length;
    storiesLoadedAt = Date.now();
  } catch {
    el.storiesBar.hidden = true;
  } finally {
    storiesLoading = false;
  }
}

function ensureStoryFileInput() {
  if (storyFileInput) return storyFileInput;
  storyFileInput = document.createElement("input");
  storyFileInput.type = "file";
  storyFileInput.accept = "image/*,video/*";
  storyFileInput.hidden = true;
  on(storyFileInput, "change", () => {
    const file = storyFileInput.files && storyFileInput.files[0];
    if (file) handleStoryDraftFile(file).catch((err) => setMsg(el.storyMsg, humanizeError(err?.message), true));
    storyFileInput.value = "";
  });
  document.body.appendChild(storyFileInput);
  return storyFileInput;
}

function ensureStoryComposer() {
  if (el.storyComposer) return;
  const overlay = document.createElement("div");
  overlay.id = "storyComposerModal";
  overlay.className = "overlay glass storyComposerOverlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <div class="modal card storyComposerCard" role="dialog" aria-modal="true" aria-label="Create story">
      <div class="modal-header">
        <h3>Add story</h3>
        <button id="storyClose" class="iconBtn" type="button" aria-label="Close">X</button>
      </div>
      <div id="storyPreview" class="storyDraftPreview">
        <div class="storyDraftEmpty">${icon("image")}<strong>Select an image or video</strong></div>
      </div>
      <div id="storyFilters" class="storyFilterRow"></div>
      <div class="modal-footer storyComposerActions">
        <button id="storyPick" class="btn ghost" type="button">Choose media</button>
        <button id="storyShare" class="btn primary" type="button" disabled>Share story</button>
      </div>
      <div id="storyMsg" class="msg"></div>
    </div>
  `;
  document.body.appendChild(overlay);
  el.storyComposer = overlay;
  el.storyClose = overlay.querySelector("#storyClose");
  el.storyPreview = overlay.querySelector("#storyPreview");
  el.storyFilters = overlay.querySelector("#storyFilters");
  el.storyPick = overlay.querySelector("#storyPick");
  el.storyShare = overlay.querySelector("#storyShare");
  el.storyMsg = overlay.querySelector("#storyMsg");

  on(el.storyClose, "click", closeStoryComposer);
  on(el.storyPick, "click", () => openMediaPicker("story"));
  on(el.storyShare, "click", publishStory);
  bindOverlayClose(overlay, closeStoryComposer);
}

function resetStoryDraft() {
  if (storyDraftPreviewUrl && storyDraftPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(storyDraftPreviewUrl);
  storyDraftFile = null;
  storyDraftPreviewUrl = "";
  storyDraftFilter = "normal";
  setMsg(el.storyMsg, "");
  renderStoryDraft();
}

function openStoryComposer() {
  if (!getToken()) return showAuth();
  ensureStoryComposer();
  resetStoryDraft();
  showOverlay(el.storyComposer);
  window.setTimeout(() => openMediaPicker("story"), 120);
}

function closeStoryComposer() {
  hideOverlay(el.storyComposer);
}

function setStoryFilter(filter) {
  storyDraftFilter = STORY_FILTERS.some((item) => item.key === filter) ? filter : "normal";
  renderStoryDraft();
}

async function handleStoryDraftFile(file) {
  if (!file) return;
  if (!/^image\//.test(file.type) && !/^video\//.test(file.type)) throw new Error("INVALID_FILE");
  const maxBytes = 25 * 1024 * 1024;
  if (file.size > maxBytes) throw new Error("FILE_TOO_LARGE");
  if (storyDraftPreviewUrl && storyDraftPreviewUrl.startsWith("blob:")) URL.revokeObjectURL(storyDraftPreviewUrl);
  storyDraftFile = file;
  storyDraftPreviewUrl = URL.createObjectURL(file);
  setMsg(el.storyMsg, "");
  renderStoryDraft();
}

function renderStoryDraft() {
  if (!el.storyPreview || !el.storyFilters || !el.storyShare) return;
  el.storyPreview.textContent = "";
  if (!storyDraftFile) {
    const empty = document.createElement("div");
    empty.className = "storyDraftEmpty";
    empty.innerHTML = `${icon("image")}<strong>Select an image or video</strong>`;
    el.storyPreview.appendChild(empty);
  } else if (/^video\//.test(storyDraftFile.type)) {
    const video = document.createElement("video");
    video.src = storyDraftPreviewUrl;
    video.controls = false;
    video.playsInline = true;
    video.muted = true;
    video.loop = true;
    video.className = `storyDraftMedia story-filter-${storyDraftFilter}`;
    el.storyPreview.appendChild(video);
  } else {
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.src = storyDraftPreviewUrl;
    img.className = `storyDraftMedia story-filter-${storyDraftFilter}`;
    el.storyPreview.appendChild(img);
  }

  el.storyFilters.textContent = "";
  for (const item of STORY_FILTERS) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `storyFilter ${item.key === storyDraftFilter ? "active" : ""}`.trim();
    btn.textContent = item.label;
    on(btn, "click", () => setStoryFilter(item.key));
    el.storyFilters.appendChild(btn);
  }
  el.storyShare.disabled = !storyDraftFile;
}

async function publishStory() {
  if (!storyDraftFile || !el.storyShare) return;
  el.storyShare.disabled = true;
  if (el.storyPick) el.storyPick.disabled = true;
  setMsg(el.storyMsg, "Uploading story...");
  try {
    const media = await uploadFile(storyDraftFile);
    await api("/api/stories", {
      method: "POST",
      body: JSON.stringify({ media, filter: storyDraftFilter }),
    });
    closeStoryComposer();
    showToast("Story shared.");
    await loadStories();
  } catch (err) {
    setMsg(el.storyMsg, humanizeError(err?.message), true);
  } finally {
    if (el.storyPick) el.storyPick.disabled = false;
    if (el.storyShare) el.storyShare.disabled = !storyDraftFile;
  }
}

function ensureStoryViewer() {
  if (el.storyViewer) return;
  const overlay = document.createElement("div");
  overlay.id = "storyViewer";
  overlay.className = "storyViewerOverlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="storyViewerShell" role="dialog" aria-modal="true" aria-label="Story viewer">
      <div id="storyProgress" class="storyProgress"></div>
      <header class="storyViewerHeader">
        <div id="storyViewerAuthor" class="storyViewerAuthor"></div>
        <button id="storyMute" class="storyMute" type="button" aria-label="Mute story">Muted</button>
        <button id="storyViewerClose" class="iconBtn" type="button" aria-label="Close">X</button>
      </header>
      <div id="storyViewerMedia" class="storyViewerMedia"></div>
      <footer class="storyViewerFooter">
        <div id="storyViewerReactions" class="storyViewerReactions"></div>
        <form id="storyReplyForm" class="storyReplyForm">
          <input id="storyReplyInput" type="text" maxlength="280" placeholder="Send message...">
          <button id="storyReplyBtn" class="storyReplyBtn" type="submit">Send</button>
        </form>
      </footer>
      <button id="storyPrev" class="storyTapZone prev" type="button" aria-label="Previous story"></button>
      <button id="storyNext" class="storyTapZone next" type="button" aria-label="Next story"></button>
    </section>
  `;
  document.body.appendChild(overlay);
  el.storyViewer = overlay;
  el.storyProgress = overlay.querySelector("#storyProgress");
  el.storyViewerAuthor = overlay.querySelector("#storyViewerAuthor");
  el.storyViewerMedia = overlay.querySelector("#storyViewerMedia");
  el.storyViewerReactions = overlay.querySelector("#storyViewerReactions");
  el.storyViewerClose = overlay.querySelector("#storyViewerClose");
  el.storyMute = overlay.querySelector("#storyMute");
  el.storyReplyForm = overlay.querySelector("#storyReplyForm");
  el.storyReplyInput = overlay.querySelector("#storyReplyInput");
  el.storyReplyBtn = overlay.querySelector("#storyReplyBtn");
  el.storyPrev = overlay.querySelector("#storyPrev");
  el.storyNext = overlay.querySelector("#storyNext");
  on(el.storyViewerClose, "click", (event) => {
    event.stopPropagation();
    closeStoryViewer();
  });
  on(el.storyPrev, "click", (event) => {
    event.stopPropagation();
    previousStory();
  });
  on(el.storyNext, "click", (event) => {
    event.stopPropagation();
    nextStory();
  });
  on(el.storyMute, "click", (event) => {
    event.stopPropagation();
    if (!activeStoryVideo) return;
    activeStoryVideo.muted = !activeStoryVideo.muted;
    el.storyMute.textContent = activeStoryVideo.muted ? "Muted" : "Sound";
  });
  const pausePress = () => pauseStoryPlayback();
  const resumePress = () => resumeStoryPlayback();
  on(overlay, "pointerdown", (e) => {
    if (e.target && e.target.closest && e.target.closest("button, input, form")) return;
    pausePress();
  });
  on(overlay, "pointerup", resumePress);
  on(overlay, "pointercancel", resumePress);
  on(el.storyReplyForm, "submit", (event) => {
    event.preventDefault();
    event.stopPropagation();
    const story = storyCache[activeStoryIndex];
    if (!story || !story.authorKey || isMineKey(story.authorKey)) return;
    const text = String(el.storyReplyInput?.value || "").trim();
    if (!text) return;
    el.storyReplyBtn.disabled = true;
    api(`/api/dm/${encodeURIComponent(story.authorKey)}`, {
      method: "POST",
      body: JSON.stringify({ text: `Reply to your story: ${text}` }),
    }).then(() => {
      if (el.storyReplyInput) el.storyReplyInput.value = "";
      showToast("Reply sent.");
    }).catch((err) => {
      showToast(humanizeError(err?.message), true);
    }).finally(() => {
      el.storyReplyBtn.disabled = false;
    });
  });
  on(document, "keydown", (e) => {
    if (!el.storyViewer || el.storyViewer.hidden) return;
    if (e.key === "Escape") closeStoryViewer();
    if (e.key === "ArrowRight") nextStory();
    if (e.key === "ArrowLeft") previousStory();
  });
}

function clearStoryProgress() {
  if (storyProgressTimer) window.clearTimeout(storyProgressTimer);
  storyProgressTimer = null;
  storyProgressStartedAt = 0;
  storyProgressDuration = 0;
  storyProgressRemaining = 0;
  for (const fill of Array.from(el.storyProgress?.querySelectorAll(".storyProgressFill") || [])) {
    fill.style.transition = "none";
    fill.style.width = "0%";
  }
}

function activeStoryGroupContext() {
  const story = storyCache[activeStoryIndex];
  const key = storyOwnerKey(story);
  const group = storyGroups.find((item) => item.key === key || String(item.authorKey).toLowerCase() === key);
  const stories = Array.isArray(group?.stories) && group.stories.length ? group.stories : (story ? [story] : []);
  const index = Math.max(0, stories.findIndex((item) => String(item.id) === String(story?.id)));
  return { group, stories, index };
}

function renderStoryProgressSegments() {
  if (!el.storyProgress) return null;
  const { stories, index } = activeStoryGroupContext();
  el.storyProgress.textContent = "";
  let activeFill = null;
  stories.forEach((_, i) => {
    const bar = document.createElement("span");
    bar.className = "storyProgressSegment";
    const fill = document.createElement("span");
    fill.className = "storyProgressFill";
    fill.style.width = i < index ? "100%" : "0%";
    bar.appendChild(fill);
    el.storyProgress.appendChild(bar);
    if (i === index) activeFill = fill;
  });
  return activeFill;
}

function startStoryProgress(durationMs) {
  clearStoryProgress();
  const activeFill = renderStoryProgressSegments();
  if (!activeFill) return;
  storyProgressDuration = durationMs;
  storyProgressRemaining = durationMs;
  storyProgressStartedAt = Date.now();
  window.requestAnimationFrame(() => {
    activeFill.style.transition = `width ${durationMs}ms linear`;
    activeFill.style.width = "100%";
  });
  storyProgressTimer = window.setTimeout(nextStory, durationMs);
}

function pauseStoryPlayback() {
  if (!storyProgressTimer) return;
  window.clearTimeout(storyProgressTimer);
  storyProgressTimer = null;
  const elapsed = Date.now() - storyProgressStartedAt;
  storyProgressRemaining = Math.max(250, storyProgressDuration - elapsed);
  const activeFill = el.storyProgress?.querySelectorAll(".storyProgressFill")[activeStoryGroupContext().index];
  if (activeFill) {
    const pct = storyProgressDuration ? Math.min(100, (elapsed / storyProgressDuration) * 100) : 0;
    activeFill.style.transition = "none";
    activeFill.style.width = `${pct}%`;
  }
  if (activeStoryVideo) activeStoryVideo.pause();
}

function resumeStoryPlayback() {
  if (!storyProgressRemaining || storyProgressTimer) return;
  const activeFill = el.storyProgress?.querySelectorAll(".storyProgressFill")[activeStoryGroupContext().index];
  storyProgressStartedAt = Date.now();
  storyProgressDuration = storyProgressRemaining;
  if (activeFill) {
    window.requestAnimationFrame(() => {
      activeFill.style.transition = `width ${storyProgressRemaining}ms linear`;
      activeFill.style.width = "100%";
    });
  }
  if (activeStoryVideo) activeStoryVideo.play().catch(() => {});
  storyProgressTimer = window.setTimeout(nextStory, storyProgressRemaining);
}

function openStoryViewer(index) {
  ensureStoryViewer();
  if (!storyCache.length) return;
  activeStoryIndex = Math.max(0, Math.min(storyCache.length - 1, Number(index) || 0));
  el.storyViewer.hidden = false;
  renderStoryViewer();
}

function closeStoryViewer() {
  clearStoryProgress();
  activeStoryVideo = null;
  if (el.storyViewer) el.storyViewer.hidden = true;
  if (el.storyViewerMedia) el.storyViewerMedia.textContent = "";
  if (el.storyViewerAuthor) el.storyViewerAuthor.textContent = "";
  if (el.storyViewerReactions) el.storyViewerReactions.textContent = "";
}

async function sendStoryReaction(story, emoji) {
  if (!story || !story.authorKey || isMineKey(story.authorKey)) return;
  await api(`/api/stories/${encodeURIComponent(story.id)}/reactions`, {
    method: "POST",
    body: JSON.stringify({ emoji }),
  });
}

function renderStoryViewer() {
  const story = storyCache[activeStoryIndex];
  if (!story || !el.storyViewerMedia || !el.storyViewerAuthor) return closeStoryViewer();
  clearStoryProgress();
  activeStoryVideo = null;
  el.storyViewerMedia.textContent = "";
  el.storyViewerAuthor.textContent = "";
  if (el.storyViewerReactions) el.storyViewerReactions.textContent = "";
  el.storyViewerAuthor.appendChild(avatarNode(story.authorAvatar, storyLabel(story), "sm"));
  const name = document.createElement("strong");
  name.textContent = `@${storyLabel(story)}`;
  el.storyViewerAuthor.appendChild(name);
  const storyBadge = renderUserBadge({ verified: story.authorVerified, role: story.authorRole, createdAt: story.authorCreatedAt });
  if (storyBadge) el.storyViewerAuthor.appendChild(storyBadge);
  if (el.storyReplyBtn) el.storyReplyBtn.disabled = isMineKey(story.authorKey);
  if (el.storyReplyInput) {
    el.storyReplyInput.disabled = isMineKey(story.authorKey);
    el.storyReplyInput.placeholder = isMineKey(story.authorKey) ? "Your story" : "Send message...";
  }

  if (el.storyViewerReactions) {
    const reactions = ["❤️", "🔥", "😂", "😮", "😢", "👍"];
    for (const emoji of reactions) {
      const button = document.createElement("button");
      button.type = "button";
      button.className = "storyReactionBtn";
      button.textContent = emoji;
      button.disabled = isMineKey(story.authorKey);
      on(button, "click", async (event) => {
        event.stopPropagation();
        try {
          await sendStoryReaction(story, emoji);
          showToast("Reaction sent.");
        } catch (err) {
          showToast(humanizeError(err?.message), true);
        }
      });
      el.storyViewerReactions.appendChild(button);
    }
  }

  const mediaClass = `storyFullMedia story-filter-${story.filter || "normal"}`;
  if (story.media.kind === "video") {
    const video = document.createElement("video");
    video.poster = mediaThumbUrl(story.media);
    if (!lowDataMode) video.src = String(story.media.previewUrl || story.media.url || "");
    video.dataset.src = mediaFullUrl(story.media);
    video.className = mediaClass;
    video.autoplay = !lowDataMode;
    video.controls = false;
    video.muted = reelMutePreference;
    video.playsInline = true;
    video.preload = lowDataMode ? "none" : "metadata";
    activeStoryVideo = video;
    on(video, "click", () => {
      if (!video.currentSrc && video.dataset.src) {
        video.src = video.dataset.src;
        video.load();
      }
      video.play().catch(() => {});
    });
    if (el.storyMute) el.storyMute.textContent = video.muted ? "Muted" : "Sound";
    on(video, "loadedmetadata", () => {
      const duration = Number.isFinite(video.duration) && video.duration > 0 ? Math.min(video.duration * 1000, 15000) : 8000;
      startStoryProgress(duration);
    }, { once: true });
    on(video, "ended", nextStory);
    el.storyViewerMedia.appendChild(video);
    window.setTimeout(() => {
      if (!storyProgressTimer) startStoryProgress(8000);
    }, 600);
  } else {
    const img = document.createElement("img");
    img.alt = "";
    img.loading = "lazy";
    img.decoding = "async";
    img.src = mediaDisplayUrl(story.media);
    img.className = mediaClass;
    el.storyViewerMedia.appendChild(img);
    startStoryProgress(5500);
  }

  if (!story.seen) {
    story.seen = true;
    api(`/api/stories/${encodeURIComponent(story.id)}/view`, { method: "POST", body: "{}" }).catch(() => {});
  }
}

function nextStory() {
  const { group, stories, index } = activeStoryGroupContext();
  const nextInGroup = stories[index + 1];
  if (nextInGroup) {
    openStoryById(nextInGroup.id);
    return;
  }
  const groupIndex = storyGroups.findIndex((item) => item === group || item.key === group?.key);
  const nextGroup = storyGroups[groupIndex + 1];
  if (nextGroup && nextGroup.stories.length) {
    openStoryById(nextGroup.stories[0].id);
  } else {
    closeStoryViewer();
    loadStories().catch(() => {});
  }
}

function previousStory() {
  const { group, stories, index } = activeStoryGroupContext();
  const prevInGroup = stories[index - 1];
  if (prevInGroup) {
    openStoryById(prevInGroup.id);
    return;
  }
  const groupIndex = storyGroups.findIndex((item) => item === group || item.key === group?.key);
  const prevGroup = storyGroups[groupIndex - 1];
  if (prevGroup && prevGroup.stories.length) {
    openStoryById(prevGroup.stories[prevGroup.stories.length - 1].id);
  } else {
    renderStoryViewer();
  }
}

async function loadTrends() {
  if (!el.trendsBar || !getToken()) return;
  if (lowDataMode) {
    el.trendsBar.hidden = true;
    return;
  }
  if (trendsLoading || (trendsLoadedAt && Date.now() - trendsLoadedAt < 120000)) return;
  trendsLoading = true;
  try {
    const r = await api("/api/trends", { method: "GET" });
    const trends = Array.isArray(r.trends) ? r.trends : [];
    el.trendsBar.textContent = "";
    if (!trends.length) {
      el.trendsBar.hidden = true;
      return;
    }
    for (const trend of trends) {
      const chip = document.createElement("button");
      chip.type = "button";
      chip.className = "trendChip";
      chip.innerHTML = `<span>${trend.tag}</span><strong>${formatCount(trend.count)}</strong>`;
      on(chip, "click", () => {
        if (el.searchInput) {
          el.searchInput.value = trend.tag;
          el.searchInput.dispatchEvent(new Event("input", { bubbles: true }));
          el.searchInput.focus();
        }
      });
      el.trendsBar.appendChild(chip);
    }
    el.trendsBar.hidden = false;
    trendsLoadedAt = Date.now();
  } catch {
    el.trendsBar.hidden = true;
  } finally {
    trendsLoading = false;
  }
}

function setAvatarPreview(url) {
  if (!el.avatarPreview) return;
  el.avatarPreview.textContent = "";
  el.avatarPreview.appendChild(avatarNode(url, me?.username || "HY", "xl"));
}

function setViewTitle(text) {
  el.viewTitle.textContent = text;
}

function clearProfileHeader() {
  el.profileHeader.hidden = true;
  el.profileHeader.textContent = "";
}

function renderProfileHeader(profile) {
  if (!el.profileHeader) return;
  el.profileHeader.hidden = false;
  el.profileHeader.textContent = "";

  const profileKey = String(profile.key || profile.userKey || profile.username || "").toLowerCase();
  const isMe = !!(me && (profileKey === currentUserKey() || profile.username === me.username));
  const isFriend = !!profile.isFriend;

  const top = document.createElement("div");
  top.className = "profileTop";

  const ident = document.createElement("div");
  ident.className = "profileIdent";
  ident.appendChild(avatarNode(profile.avatarUrl, profile.username, "xl"));

  const nameWrap = document.createElement("div");
  nameWrap.style.minWidth = "0";
  const name = document.createElement("div");
  name.className = "profileName";
  const handle = document.createElement("span");
  handle.textContent = `@${profile.username}`;
  name.appendChild(handle);
  const profileBadge = renderUserBadge(profile);
  if (profileBadge) name.appendChild(profileBadge);
  if (profile.isPrivate) {
    const locked = document.createElement("span");
    locked.className = "visBadge";
    locked.innerHTML = `${icon("lock")} Private`;
    name.appendChild(locked);
  }
  nameWrap.appendChild(name);
  ident.appendChild(nameWrap);

  const right = document.createElement("div");
  right.className = "profileActions";
  if (isMe) {
    const analyticsBtn = document.createElement("button");
    analyticsBtn.type = "button";
    analyticsBtn.className = "btn ghost";
    analyticsBtn.textContent = "📊";
    analyticsBtn.title = "الإحصائيات";
    on(analyticsBtn, "click", () => openAnalyticsDashboard());
    right.appendChild(analyticsBtn);

    const insightsBtn = document.createElement("button");
    insightsBtn.type = "button";
    insightsBtn.className = "btn ghost";
    insightsBtn.textContent = t("insights");
    on(insightsBtn, "click", () => openInsights());
    right.appendChild(insightsBtn);

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "btn ghost";
    edit.textContent = t("editProfile");
    on(edit, "click", () => openProfileEdit());
    right.appendChild(edit);
  } else {
    const msgBtn = document.createElement("button");
    msgBtn.type = "button";
    msgBtn.className = "btn ghost";
    msgBtn.textContent = "Message";
    on(msgBtn, "click", () => {
      location.hash = `#dm/${encodeURIComponent(activeProfileKey)}`;
    });
    right.appendChild(msgBtn);

    const followBtn = document.createElement("button");
    followBtn.type = "button";
    followBtn.className = isFriend ? "btn primary" : "btn ghost";
    followBtn.textContent = isFriend ? "Friend" : profile.isFollowing ? t("unfollow") : t("follow");
    on(followBtn, "click", async () => {
      followBtn.disabled = true;
      try {
        const r = await api(`/api/follow/${encodeURIComponent(activeProfileKey)}`, { method: "POST" });
        profile.isFollowing = r.following;
        profile.isFriend = !!r.isFriend;
        followBtn.className = profile.isFriend ? "btn primary" : "btn ghost";
        followBtn.textContent = profile.isFriend ? "Friend" : profile.isFollowing ? t("unfollow") : t("follow");
        const badge = el.profileHeader.querySelector("[data-badge='followers']");
        if (badge) badge.textContent = String(r.followerCount);
      } catch {
        // ignore
      } finally {
        followBtn.disabled = false;
      }
    });
    right.appendChild(followBtn);

    const callBtn = document.createElement("button");
    callBtn.type = "button";
    callBtn.className = "btn ghost";
    callBtn.innerHTML = `${icon("phone")}<span>Call</span>`;
    callBtn.title = "Calls coming soon";
    on(callBtn, "click", () => showToast("Calls coming soon.", true));
    right.appendChild(callBtn);

    const blockBtn = document.createElement("button");
    blockBtn.type = "button";
    blockBtn.className = "btn ghost danger blockProfileBtn";
    blockBtn.title = "Block user";
    blockBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg>`;
    let isBlocked = false;
    api(`/api/users/blocked`).then((r) => {
      if (Array.isArray(r.blocked)) {
        isBlocked = r.blocked.some((b) => b.blocked_key === activeProfileKey);
        blockBtn.title = isBlocked ? "Unblock" : "Block";
        blockBtn.style.opacity = isBlocked ? "1" : "0.5";
      }
    }).catch(() => {});
    on(blockBtn, "click", async () => {
      blockBtn.disabled = true;
      try {
        if (isBlocked) {
          await api(`/api/users/block/${encodeURIComponent(activeProfileKey)}`, { method: "DELETE" });
          isBlocked = false;
          showToast("User unblocked.");
        } else {
          await api(`/api/users/block/${encodeURIComponent(activeProfileKey)}`, { method: "POST" });
          isBlocked = true;
          showToast("User blocked.");
        }
        blockBtn.title = isBlocked ? "Unblock" : "Block";
        blockBtn.style.opacity = isBlocked ? "1" : "0.5";
      } catch { /* ignore */ } finally { blockBtn.disabled = false; }
    });
    right.appendChild(blockBtn);
  }

  top.appendChild(ident);
  top.appendChild(right);

  const bio = document.createElement("div");
  bio.className = "profileBio";
  bio.textContent = profile.bio || t("noBio");

  const stats = document.createElement("div");
  stats.className = "profileStats";
  stats.innerHTML = `<span><strong data-badge="followers">${profile.followerCount}</strong><small>${t("followers")}</small></span>
  <span><strong>${profile.followingCount}</strong><small>${t("following")}</small></span>
  <span><strong>${profile.isFriend ? "Yes" : "-"}</strong><small>Friend</small></span>`;

  el.profileHeader.appendChild(top);
  el.profileHeader.appendChild(bio);
  if (Array.isArray(profile.skills) && profile.skills.length) {
    const skills = document.createElement("div");
    skills.className = "profileStats";
    for (const skill of profile.skills.slice(0, 8)) {
      const chip = document.createElement("span");
      chip.className = "badge";
      chip.textContent = skill;
      skills.appendChild(chip);
    }
    el.profileHeader.appendChild(skills);
  }
  el.profileHeader.appendChild(stats);

  const tabs = document.createElement("div");
  tabs.className = "tabs";
  tabs.style.marginTop = "12px";
  const postsTab = document.createElement("button");
  postsTab.textContent = "Posts";
  postsTab.className = activeProfileTab === "posts" ? "active" : "";
  const repostsTab = document.createElement("button");
  repostsTab.textContent = "Reposts";
  repostsTab.className = activeProfileTab === "reposts" ? "active" : "";
  tabs.appendChild(postsTab);
  tabs.appendChild(repostsTab);
  const mediaTab = document.createElement("button");
  mediaTab.textContent = "Media";
  mediaTab.disabled = true;
  tabs.appendChild(mediaTab);
  el.profileHeader.appendChild(tabs);

  on(postsTab, "click", () => {
    activeProfileTab = "posts";
    postsTab.classList.add("active");
    repostsTab.classList.remove("active");
    openProfile(activeProfileKey);
  });
  on(repostsTab, "click", async () => {
    activeProfileTab = "reposts";
    repostsTab.classList.add("active");
    postsTab.classList.remove("active");
    if (el.feed) el.feed.innerHTML = '<div class="muted" data-empty="true">Loading reposts...</div>';
    try {
      const r = await api(`/api/user/${encodeURIComponent(activeProfileKey)}`, { method: "GET" });
      const reposts = (Array.isArray(r.posts) ? r.posts : []).filter(post => post.isRepost);
      if (el.feed) {
        el.feed.textContent = "";
        if (!reposts.length) {
          const empty = document.createElement("div");
          empty.className = "muted";
          empty.textContent = "No reposts yet.";
          empty.dataset.empty = "true";
          el.feed.appendChild(empty);
        } else {
          for (const p of reposts) {
            const node = postNode(p);
            el.feed.appendChild(node);
            observeMediaPlayback(node);
          }
        }
      }
    } catch {
      if (el.feed) el.feed.innerHTML = '<div class="muted" data-empty="true">Failed to load reposts.</div>';
    }
  });
}

let openMenu = null;
function closeMenu() {
  if (openMenu) {
    openMenu.hidden = true;
    openMenu = null;
  }
}

function carouselNode(media, { withControls = false, onVideoDoubleTap = null } = {}) {
  const wrap = document.createElement("div");
  wrap.className = "mediaCarousel";

  const track = document.createElement("div");
  track.className = "carouselTrack";

  let current = 0;

  const renderSlide = (item) => {
    const slide = document.createElement("div");
    slide.className = "carouselSlide";
    if (!isFullMediaUrl(item && item.url)) {
      const archived = document.createElement("div");
      archived.className = "mediaArchived";
      archived.innerHTML = `<strong>Media unavailable</strong>`;
      slide.appendChild(archived);
      return slide;
    }
    if (item.kind === "video") {
      slide.appendChild(customVideoPlayer(mediaFullUrl(item), {
        muted: true,
        poster: mediaThumbUrl(item),
        previewUrl: String(item && item.previewUrl || ""),
        onDoubleTap: onVideoDoubleTap,
      }));
    } else {
      const img = document.createElement("img");
      img.src = mediaDisplayUrl(item);
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.dataset.fullSrc = mediaFullUrl(item);
      slide.appendChild(img);
    }
    return slide;
  };

  for (const item of media) track.appendChild(renderSlide(item));

  const dots = document.createElement("div");
  dots.className = "carouselDots";
  const dotEls = media.map((_, i) => {
    const dot = document.createElement("span");
    dot.className = i === 0 ? "carouselDot active" : "carouselDot";
    on(dot, "click", () => goTo(i));
    dots.appendChild(dot);
    return dot;
  });

  const countBadge = document.createElement("div");
  countBadge.className = "carouselCount";
  countBadge.textContent = `1 / ${media.length}`;

  function goTo(idx) {
    current = Math.max(0, Math.min(media.length - 1, idx));
    track.style.transform = `translateX(${-current * 100}%)`;
    dotEls.forEach((d, i) => d.classList.toggle("active", i === current));
    countBadge.textContent = `${current + 1} / ${media.length}`;
  }

  let startX = 0, startY = 0, isDragging = false;
  on(wrap, "touchstart", (e) => { startX = e.touches[0].clientX; startY = e.touches[0].clientY; isDragging = true; }, { passive: true });
  on(wrap, "touchend", (e) => {
    if (!isDragging) return;
    isDragging = false;
    const dx = e.changedTouches[0].clientX - startX;
    const dy = e.changedTouches[0].clientY - startY;
    if (Math.abs(dx) > Math.abs(dy) && Math.abs(dx) > 36) {
      if (dx < 0) goTo(current + 1); else goTo(current - 1);
    }
  }, { passive: true });

  const prev = document.createElement("button");
  prev.type = "button";
  prev.className = "carouselArrow prev";
  prev.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m15 18-6-6 6-6"/></svg>`;
  on(prev, "click", (e) => { e.stopPropagation(); goTo(current - 1); });

  const next = document.createElement("button");
  next.type = "button";
  next.className = "carouselArrow next";
  next.innerHTML = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m9 18 6-6-6-6"/></svg>`;
  on(next, "click", (e) => { e.stopPropagation(); goTo(current + 1); });

  wrap.appendChild(track);
  wrap.appendChild(prev);
  wrap.appendChild(next);
  wrap.appendChild(countBadge);
  wrap.appendChild(dots);
  return wrap;
}

function mediaGridNode(media, {
  removable = false,
  onRemove,
  withControls = false,
  onVideoDoubleTap = null,
} = {}) {
  if (media && media.length > 1 && !removable) {
    return carouselNode(media, { withControls, onVideoDoubleTap });
  }
  const grid = document.createElement("div");
  grid.className = "mediaGrid";
  for (const item of media || []) {
    const tile = document.createElement("div");
    tile.className = "mediaItem";
    if (!isFullMediaUrl(item && item.url)) {
      const archived = document.createElement("div");
      archived.className = "mediaArchived";
      archived.innerHTML = `<strong>Media unavailable</strong><span>This upload is missing from storage.</span>`;
      tile.appendChild(archived);
      grid.appendChild(tile);
      continue;
    }

    if (item.kind === "video") {
      const videoUrl = mediaFullUrl(item);
      const posterUrl = mediaThumbUrl(item);
      const previewUrl = String(item && item.previewUrl || "");
      if (withControls) {
        tile.appendChild(customVideoPlayer(videoUrl, { muted: true, poster: posterUrl, previewUrl, onDoubleTap: onVideoDoubleTap }));
      } else {
        tile.appendChild(customVideoPlayer(videoUrl, { muted: true, poster: posterUrl, previewUrl, onDoubleTap: onVideoDoubleTap }));
      }
    } else {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.referrerPolicy = "no-referrer";
      img.src = mediaDisplayUrl(item);
      img.dataset.fullSrc = mediaFullUrl(item);
      tile.appendChild(img);
    }

    if (removable) {
      const rm = document.createElement("button");
      rm.type = "button";
      rm.className = "mediaRemove";
      rm.textContent = "×";
      on(rm, "click", () => onRemove && onRemove(item));
      tile.appendChild(rm);
    }

    grid.appendChild(tile);
  }
  return grid;
}

function showDeleteConfirm(title, bodyText, onConfirm) {
  showActionSheet(title || "Delete", (body) => {
    const copy = document.createElement("div");
    copy.className = "muted";
    copy.textContent = bodyText || "This cannot be undone.";
    const del = sheetButton("Delete", "danger");
    del.style.color = "#ff3b5c";
    const keep = sheetButton("Keep", "");
    on(del, "click", async () => {
      del.disabled = true;
      try {
        await onConfirm();
        hideActionSheet();
      } catch (err) {
        showToast(humanizeError(err?.message), true);
      } finally {
        del.disabled = false;
      }
    });
    on(keep, "click", () => hideActionSheet());
    body.appendChild(copy);
    body.appendChild(del);
    body.appendChild(keep);
  });
}

function commentNode(comment, onReply, onDelete, post, depth = 0) {
  const wrap = document.createElement("div");
  wrap.className = "comment" + (depth > 0 ? " reply" : "");

  const avatar = avatarNode(comment.authorAvatar, comment.author, "sm");
  avatar.classList.add("comment-avatar");
  wrap.appendChild(avatar);

  const body = document.createElement("div");
  body.className = "comment-body";

  const meta = document.createElement("div");
  meta.className = "comment-meta";
  const link = document.createElement("a");
  link.className = "comment-username";
  link.href = `#u/${encodeURIComponent(comment.authorKey)}`;
  link.textContent = `@${comment.author}`;
  const commentBadge = renderUserBadge({ verified: comment.authorVerified, role: comment.authorRole, createdAt: comment.authorCreatedAt });
  if (commentBadge) link.appendChild(commentBadge);
  const time = document.createElement("div");
  time.className = "comment-time time";
  time.dataset.iso = comment.createdAt || "";
  time.textContent = fmtTime(comment.createdAt);
  meta.appendChild(link);
  meta.appendChild(time);

  const text = document.createElement("div");
  text.className = "comment-text commentText";
  text.textContent = comment.text;

  body.appendChild(meta);
  body.appendChild(text);

  const actionRow = document.createElement("div");
  actionRow.className = "comment-actions commentActions";

  const replyBtn = document.createElement("button");
  replyBtn.type = "button";
  replyBtn.className = "comment-reply-btn";
  replyBtn.textContent = "Reply";
  on(replyBtn, "click", () => onReply && onReply(comment));
  actionRow.appendChild(replyBtn);

  let localLiked = !!comment.likedByMe;
  let localCount = Number(comment.likeCount || 0);
  const likeBtn = document.createElement("button");
  likeBtn.type = "button";
  function syncLikeBtn() {
    likeBtn.className = "comment-like comment-like-btn" + (localLiked ? " liked" : "");
    likeBtn.textContent = (localLiked ? "❤️" : "🤍") + (localCount > 0 ? ` ${localCount}` : "");
  }
  syncLikeBtn();
  on(likeBtn, "click", async () => {
    if (likeBtn.disabled) return;
    pulseTap(likeBtn);
    likeBtn.disabled = true;
    localLiked = !localLiked;
    localCount = localLiked ? localCount + 1 : Math.max(0, localCount - 1);
    syncLikeBtn();
    try {
      const r = await api(`/api/posts/${encodeURIComponent(post.id)}/comments/${encodeURIComponent(comment.id)}/like`, { method: "POST" });
      localLiked = r.liked;
      localCount = r.likeCount;
      syncLikeBtn();
    } catch {
      localLiked = !localLiked;
      localCount = localLiked ? localCount + 1 : Math.max(0, localCount - 1);
      syncLikeBtn();
    } finally {
      likeBtn.disabled = false;
    }
  });
  actionRow.appendChild(likeBtn);

  const canDelete = isMineKey(comment.authorKey) || isMineKey(post && (post.authorId || post.authorKey));
  if (canDelete) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "comment-reply-btn danger";
    deleteBtn.textContent = "Delete";
    on(deleteBtn, "click", () => onDelete && onDelete(comment));
    actionRow.appendChild(deleteBtn);
  }
  body.appendChild(actionRow);
  wrap.appendChild(body);
  if (Array.isArray(comment.replies) && comment.replies.length) {
    const replies = document.createElement("div");
    replies.className = "comment-replies";
    for (const r of comment.replies) replies.appendChild(commentNode(r, onReply, onDelete, post, depth + 1));
    wrap.appendChild(replies);
  }
  return wrap;
}

function richTextNode(textValue, { truncate = false } = {}) {
  const raw = String(textValue || "");
  const text = document.createElement("div");
  text.className = "postText";
  const parts = raw.split(/(#[a-z0-9_]{2,30}|@[a-z0-9_]{1,30})/gi);
  for (const part of parts) {
    if (/^#[a-z0-9_]{2,30}$/i.test(part)) {
      const tag = document.createElement("button");
      tag.type = "button";
      tag.className = "hashTag";
      tag.textContent = part;
      on(tag, "click", () => {
        if (el.searchInput) {
          el.searchInput.value = part;
          el.searchInput.dispatchEvent(new Event("input", { bubbles: true }));
          el.searchInput.focus();
        }
      });
      text.appendChild(tag);
    } else if (/^@[a-z0-9_]{1,30}$/i.test(part)) {
      const mention = document.createElement("a");
      mention.className = "mentionLink";
      mention.textContent = part;
      mention.href = `#u/${encodeURIComponent(part.slice(1).toLowerCase())}`;
      text.appendChild(mention);
    } else {
      text.appendChild(document.createTextNode(part));
    }
  }
  if (!truncate || raw.length <= 120) return text;
  const wrap = document.createElement("div");
  wrap.className = "postTextWrap";
  text.classList.add("clamped");
  const more = document.createElement("button");
  more.type = "button";
  more.className = "postTextMore";
  more.textContent = "\u2026\u0627\u0644\u0645\u0632\u064a\u062f";
  let expanded = false;
  on(more, "click", (e) => {
    e.stopPropagation();
    expanded = !expanded;
    text.classList.toggle("clamped", !expanded);
    more.textContent = expanded ? "\u0623\u0642\u0644" : "\u2026\u0627\u0644\u0645\u0632\u064a\u062f";
  });
  wrap.appendChild(text);
  wrap.appendChild(more);
  return wrap;
}

function quotedPostNode(post) {
  if (!post) return null;
  const q = document.createElement("div");
  q.className = "quotedPost";
  const top = document.createElement("div");
  top.className = "quotedTop";
  top.appendChild(avatarNode(post.authorAvatar, post.author, "sm"));
  const name = document.createElement("a");
  name.href = `#u/${encodeURIComponent(post.authorKey)}`;
  name.textContent = `@${post.author}`;
  top.appendChild(name);
  const quotedBadge = renderUserBadge({ verified: post.verified, role: post.authorRole, createdAt: post.authorCreatedAt });
  if (quotedBadge) top.appendChild(quotedBadge);
  q.appendChild(top);
  if (post.text) q.appendChild(richTextNode(post.text));
  if (Array.isArray(post.media) && post.media.length) {
    const media = mediaGridNode(post.media.slice(0, 1), { withControls: true });
    media.classList.add("postMedia", "quotedMedia");
    q.appendChild(media);
  }
  return q;
}

function postNode(post) {
  const root = document.createElement("div");
  root.className = "post";
  if (post && seenPostIds.has(String(post.id))) root.classList.add("post-seen");
  const postHeart = document.createElement("div");
  postHeart.className = "heartBurst";
  postHeart.textContent = "♥";

  const top = document.createElement("div");
  top.className = "postTop";

  const who = document.createElement("div");
  who.className = "postWho";
  who.appendChild(avatarNode(post.authorAvatar, post.author));

  const whoText = document.createElement("div");
  whoText.className = "whoText";
  const a = document.createElement("a");
  a.href = `#u/${encodeURIComponent(post.authorKey)}`;
  a.textContent = `@${post.author}`;
  const postBadge = renderUserBadge({ verified: post.verified, role: post.authorRole, createdAt: post.authorCreatedAt });
  if (postBadge) a.appendChild(postBadge);
  const time = document.createElement("div");
  time.className = "time";
  time.dataset.iso = post.createdAt || "";
  time.textContent = fmtTime(post.createdAt);
  const metaLine = document.createElement("div");
  metaLine.className = "whoMeta";
  metaLine.appendChild(time);
  if (post.visibility === "private") {
    const badge = document.createElement("span");
    badge.className = "visBadge";
    badge.textContent = t("privateBadge");
    metaLine.appendChild(badge);
  }
  whoText.appendChild(a);
  whoText.appendChild(metaLine);
  who.appendChild(whoText);

  const meta = document.createElement("div");
  meta.className = "postMeta";

  const menuWrap = document.createElement("div");
  menuWrap.className = "menuWrap";
  const moreBtn = document.createElement("button");
  moreBtn.type = "button";
  moreBtn.className = "iconBtn";
  moreBtn.innerHTML = icon("more");

  const menu = document.createElement("div");
  menu.className = "menu";
  menu.hidden = true;

  const shareBtn = document.createElement("button");
  shareBtn.type = "button";
  shareBtn.className = "menuItem";
  shareBtn.innerHTML = `${icon("share")}<span>${t("copyLink")}</span>`;
  on(shareBtn, "click", async () => {
    closeMenu();
    const url = `${location.origin}/#p/${encodeURIComponent(post.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "HYSA", text: post.text || "", url });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        showToast(t("linkCopied"));
      } else {
        showToast(url);
      }
    } catch {
      // ignore
    }
  });

  const reportBtn = document.createElement("button");
  reportBtn.type = "button";
  reportBtn.className = "menuItem";
  reportBtn.textContent = t("report");
  on(reportBtn, "click", () => {
    closeMenu();
    openReport(post.id);
  });

  menu.appendChild(shareBtn);
  menu.appendChild(reportBtn);

  if (!isMineKey(post.authorId || post.authorKey)) {
    const blockMenuBtn = document.createElement("button");
    blockMenuBtn.type = "button";
    blockMenuBtn.className = "menuItem";
    blockMenuBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="4.93" y1="4.93" x2="19.07" y2="19.07"/></svg><span>Block @${post.author}</span>`;
    on(blockMenuBtn, "click", async () => {
      closeMenu();
      showDeleteConfirm(`Block @${post.author}?`, "They won't be able to see your posts, and their posts will be hidden from your feed.", async () => {
        await api(`/api/users/block/${encodeURIComponent(post.authorKey)}`, { method: "POST" });
        root.remove();
        showToast(`@${post.author} blocked.`);
      });
    });
    menu.appendChild(blockMenuBtn);
  }

  if (isMineKey(post.authorId || post.authorKey)) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "menuItem";
    deleteBtn.innerHTML = `${icon("trash")}<span>Delete post</span>`;
    on(deleteBtn, "click", () => {
      closeMenu();
      showDeleteConfirm("Delete post", "This post and its comments will be removed.", async () => {
        await api(`/api/posts/${encodeURIComponent(post.id)}`, { method: "DELETE" });
        root.remove();
        showToast("Post deleted.");
        if (activePostId === post.id) {
          location.hash = "#home";
          route();
        }
      });
    });
    menu.appendChild(deleteBtn);
  }

  on(moreBtn, "click", () => {
    if (menu.hidden) {
      closeMenu();
      menu.hidden = false;
      openMenu = menu;
    } else {
      menu.hidden = true;
      openMenu = null;
    }
  });

  menuWrap.appendChild(moreBtn);
  menuWrap.appendChild(menu);
  meta.appendChild(menuWrap);

  top.appendChild(who);
  top.appendChild(meta);
  root.appendChild(top);

  if (post.text && String(post.text).trim()) {
    root.appendChild(richTextNode(post.text, { truncate: true }));
  }

  let mediaNode = null;
  if (Array.isArray(post.media) && post.media.length) {
    const media = mediaGridNode(post.media, {
      withControls: true,
      onVideoDoubleTap: () => likeFromMedia().catch(() => {}),
    });
    media.classList.add("postMedia");
    mediaNode = media;
    root.appendChild(media);
  }
  if (post.quotedPost) {
    const quoted = quotedPostNode(post.quotedPost);
    if (quoted) root.appendChild(quoted);
  }
  if (mediaNode) mediaNode.appendChild(postHeart);

  const actions = document.createElement("div");
  actions.className = "postActions";

  const likeBtn = iconCountButton("heart", post.likeCount, t("like"), post.likedByMe);
  async function toggleLike() {
    const r = await api(`/api/posts/${encodeURIComponent(post.id)}/like`, { method: "POST" });
    post.likedByMe = r.liked;
    post.likeCount = r.likeCount;
    setIconCountState(likeBtn, "heart", post.likeCount, post.likedByMe);
  }
  on(likeBtn, "click", async () => {
    pulseTap(likeBtn);
    if (navigator.vibrate) navigator.vibrate(10);
    likeBtn.disabled = true;
    try {
      await toggleLike();
      if (post.likedByMe) showPostHeart();
    } catch {
      // ignore
    } finally {
      likeBtn.disabled = false;
    }
  });
  let _lkTimer = null;
  on(likeBtn, "pointerdown", () => {
    _lkTimer = window.setTimeout(() => {
      _lkTimer = null;
      showReactionPicker(likeBtn, async (emoji) => {
        if (navigator.vibrate) navigator.vibrate(10);
        if (emoji === "\u2764\ufe0f" && !post.likedByMe) {
          try { await toggleLike(); } catch {}
        } else {
          showToast("Reacted " + emoji);
        }
      });
    }, 500);
  });
  on(likeBtn, "pointerup", () => { if (_lkTimer) { window.clearTimeout(_lkTimer); _lkTimer = null; } });
  on(likeBtn, "pointercancel", () => { if (_lkTimer) { window.clearTimeout(_lkTimer); _lkTimer = null; } });
  function showPostHeart() {
    postHeart.classList.remove("show");
    void postHeart.offsetWidth;
    postHeart.classList.add("show");
    window.setTimeout(() => postHeart.classList.remove("show"), 620);
  }

  let lastMediaTap = 0;
  let lastMediaLikeTrigger = 0;
  async function likeFromMedia(e) {
    const target = e && e.target && e.target.closest ? e.target : null;
    if (target && target.closest("button, a, input, textarea, select, .videoControls, .proVideo")) return;
    const now = Date.now();
    if (now - lastMediaLikeTrigger < 360) return;
    lastMediaLikeTrigger = now;
    if (e && typeof e.preventDefault === "function") e.preventDefault();
    showPostHeart();
    if (!post.likedByMe) {
      try {
        await toggleLike();
      } catch {
        // ignore
      }
    }
  }
  if (mediaNode) {
    on(mediaNode, "dblclick", (e) => {
      const target = e && e.target && e.target.closest ? e.target : null;
      if (target && target.closest(".proVideo")) return;
      likeFromMedia(e).catch(() => {});
    });
    on(mediaNode, "pointerup", (e) => {
      if (e.pointerType === "mouse") return;
      const target = e && e.target && e.target.closest ? e.target : null;
      if (target && target.closest(".proVideo")) return;
      const now = Date.now();
      if (now - lastMediaTap < 320) {
        lastMediaTap = 0;
        likeFromMedia(e).catch(() => {});
      } else {
        lastMediaTap = now;
      }
    });
    for (const img of mediaNode.querySelectorAll("img:not([data-lb])")) {
      img.dataset.lb = "1";
      img.style.cursor = "zoom-in";
      on(img, "click", (e) => {
        e.stopPropagation();
        openLightbox(img.currentSrc || img.src, "image", likeFromMedia);
      });
    }
    for (const video of mediaNode.querySelectorAll("video:not([data-lb])")) {
      video.dataset.lb = "1";
      video.style.cursor = "zoom-in";
      on(video, "dblclick", (e) => {
        e.preventDefault();
        e.stopPropagation();
        openLightbox(video.currentSrc || video.src, "video", likeFromMedia);
      });
    }
    for (const player of mediaNode.querySelectorAll(".proVideo:not([data-lb-wrap])")) {
      player.dataset.lbWrap = "1";
      on(player, "click", (e) => {
        const target = e.target && e.target.closest ? e.target : null;
        if (target && target.closest(".videoControls, .videoCenterPlay, button")) return;
        const video = player.querySelector("video");
        if (!video) return;
        e.stopPropagation();
        openLightbox(video.currentSrc || video.src, "video", likeFromMedia);
      });
    }
  }

  const commentBtn = iconCountButton("comment", post.commentCount, t("comments"));

  const viewsPill = document.createElement("div");
  viewsPill.className = "actionIcon static";
  viewsPill.innerHTML = icon("eye");
  const viewsCount = document.createElement("strong");
  viewsCount.className = "mono";
  viewsCount.dataset.role = "viewCount";
  viewsCount.textContent = formatCount(post.viewCount);
  viewsPill.appendChild(viewsCount);

  const repostBtn = iconCountButton("repost", post.repostCount, "Repost", post.repostedByMe);
  async function submitRepost(quoteText = "") {
    try {
      const repostType = Array.isArray(post.media) && post.media.some((m) => m && m.kind === "video") ? "video" : "post";
      const r = await api(`/api/posts/${encodeURIComponent(post.id)}/repost`, {
        method: "POST",
        body: JSON.stringify({ quoteText, repostType }),
      });
      post.repostedByMe = r.reposted;
      post.repostCount = r.repostCount;
      repostBtn.classList.toggle("active", !!post.repostedByMe);
      repostBtn.innerHTML = `${icon("repost")}<strong>${formatCount(post.repostCount)}</strong>`;
      hideActionSheet();
      showToast(quoteText.trim() ? "Quote posted." : (r.reposted ? "Reposted." : "Repost removed."));
      if (quoteText.trim()) {
        location.hash = "#home";
        await loadFeed({ reset: true });
      }
    } catch (err) {
      showToast(humanizeError(err?.message), true);
    }
  }
  on(repostBtn, "click", () => {
    pulseTap(repostBtn);
    showActionSheet("Repost", (body) => {
      const now = sheetButton(post.repostedByMe ? "Remove Repost" : "Repost Now", "primary");
      on(now, "click", () => submitRepost(""));
      const quote = document.createElement("textarea");
      quote.className = "sheet-textarea";
      quote.maxLength = 280;
      quote.placeholder = "Add a comment...";
      const sendQuote = sheetButton("Quote Post", "primary");
      on(sendQuote, "click", () => submitRepost(quote.value || ""));
      body.appendChild(now);
      body.appendChild(quote);
      body.appendChild(sendQuote);
    });
  });

  const shareAction = iconCountButton("share", 0, "Share");
  shareAction.querySelector("strong").remove();
  on(shareAction, "click", async () => {
    pulseTap(shareAction);
    shareContent({ kind: Array.isArray(post.media) && post.media.some((m) => m.kind === "video") ? "reel" : "post", id: post.id, text: post.text || "", author: post.author || "", media: post.media || [] });
  });

  const bookmarkBtn = iconCountButton("bookmark", post.bookmarkCount, "Save", post.bookmarkedByMe);
  on(bookmarkBtn, "click", async () => {
    pulseTap(bookmarkBtn);
    try {
      const r = await api(`/api/posts/${encodeURIComponent(post.id)}/bookmark`, { method: "POST" });
      post.bookmarkedByMe = r.bookmarked;
      post.bookmarkCount = r.bookmarkCount;
      setIconCountState(bookmarkBtn, "bookmark", post.bookmarkCount, post.bookmarkedByMe);
    } catch (err) {
      showToast(humanizeError(err?.message), true);
    }
  });

  actions.appendChild(likeBtn);
  actions.appendChild(commentBtn);
  actions.appendChild(repostBtn);
  actions.appendChild(shareAction);
  actions.appendChild(bookmarkBtn);
  actions.appendChild(viewsPill);
  root.appendChild(actions);

  const commentsWrap = document.createElement("div");
  commentsWrap.className = "comments";
  commentsWrap.hidden = true;

  const commentComposer = document.createElement("div");
  commentComposer.className = "commentComposer";

  const commentInput = document.createElement("textarea");
  commentInput.className = "commentInput";
  commentInput.rows = 2;
  commentInput.maxLength = 200;
  commentInput.placeholder = t("writeComment");
  attachMentionAutocomplete(commentInput);

  const bar = document.createElement("div");
  bar.className = "commentBar";
  const commentMsg = document.createElement("div");
  commentMsg.className = "msg";
  commentMsg.setAttribute("role", "status");
  const commentSend = document.createElement("button");
  commentSend.type = "button";
  commentSend.className = "btn primary";
  commentSend.textContent = t("send");

  bar.appendChild(commentMsg);
  bar.appendChild(commentSend);
  commentComposer.appendChild(commentInput);
  commentComposer.appendChild(bar);

  const commentsList = document.createElement("div");
  commentsList.className = "commentsList";

  commentsWrap.appendChild(commentComposer);
  commentsWrap.appendChild(commentsList);
  root.appendChild(commentsWrap);

  let commentsLoaded = false;
  let commentsLoading = false;
  let replyToCommentId = null;

  async function deleteComment(comment) {
    showDeleteConfirm("Delete comment", "This comment will be removed.", async () => {
      const r = await api(`/api/posts/${encodeURIComponent(post.id)}/comments/${encodeURIComponent(comment.id)}`, { method: "DELETE" });
      post.commentCount = r.commentCount ?? Math.max(0, Number(post.commentCount || 0) - 1);
      commentBtn.innerHTML = `${icon("comment")}<strong>${formatCount(post.commentCount || 0)}</strong>`;
      commentsLoaded = false;
      await loadComments();
      showToast("Comment deleted.");
    });
  }

  async function loadComments() {
    if (commentsLoading) return;
    commentsLoading = true;
    commentsList.textContent = "";
    try {
      const r = await api(`/api/posts/${encodeURIComponent(post.id)}/comments?limit=50`, { method: "GET" });
      const list = Array.isArray(r.comments) ? r.comments : [];
      if (!list.length) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "…";
        empty.dataset.empty = "true";
        commentsList.appendChild(empty);
      } else {
        for (const c of list) {
          commentsList.appendChild(
            commentNode(c, (targetComment) => {
              replyToCommentId = targetComment.id;
              commentInput.focus();
              commentInput.placeholder = `Reply to @${targetComment.author}`;
            }, deleteComment, post),
          );
        }
      }
      post.commentCount = r.commentCount ?? post.commentCount;
      commentBtn.innerHTML = `${icon("comment")}<strong>${formatCount(post.commentCount || 0)}</strong>`;
      commentsLoaded = true;
    } catch {
      // ignore
    } finally {
      commentsLoading = false;
    }
  }

  on(commentBtn, "click", async () => {
    pulseTap(commentBtn);
    commentsWrap.hidden = !commentsWrap.hidden;
    if (!commentsWrap.hidden) {
      commentInput.focus();
      if (!commentsLoaded) await loadComments();
    }
  });

  on(commentSend, "click", async () => {
    if (navigator.vibrate) navigator.vibrate(10);
    setMsg(commentMsg, "");
    const textValue = commentInput.value;
    if (!textValue.trim()) return setMsg(commentMsg, t("error_invalid_comment"), true);
    commentSend.disabled = true;
    try {
      const r = await api(`/api/posts/${encodeURIComponent(post.id)}/comments`, {
        method: "POST",
        body: JSON.stringify({ text: textValue, parentId: replyToCommentId || undefined }),
      });
      const empty = commentsList.querySelector("[data-empty='true']");
      if (empty) empty.remove();
      commentsList.appendChild(commentNode(r.comment, (targetComment) => {
        replyToCommentId = targetComment.id;
        commentInput.focus();
        commentInput.placeholder = `Reply to @${targetComment.author}`;
      }, deleteComment, post));
      commentInput.value = "";
      replyToCommentId = null;
      commentInput.placeholder = t("writeComment");
      post.commentCount = r.commentCount ?? (Number(post.commentCount) || 0) + 1;
      commentBtn.innerHTML = `${icon("comment")}<strong>${formatCount(post.commentCount || 0)}</strong>`;
      commentsLoaded = true;
      commentsWrap.hidden = false;
    } catch (err) {
      setMsg(commentMsg, humanizeError(err?.message), true);
    } finally {
      commentSend.disabled = false;
    }
  });

  observePostView(root, post.id);
  return root;
}

function createSkeletonPost() {
  const node = document.createElement("div");
  node.className = "post";
  node.style.padding = "16px";

  const top = document.createElement("div");
  top.className = "postTop";
  top.style.display = "flex";
  top.style.alignItems = "center";
  top.style.gap = "12px";

  const avatar = document.createElement("div");
  avatar.className = "skeleton skeleton-avatar";

  const nameWrap = document.createElement("div");
  nameWrap.style.minWidth = "0";
  nameWrap.style.display = "grid";
  nameWrap.style.gap = "6px";

  const nameLine = document.createElement("div");
  nameLine.className = "skeleton skeleton-line";
  nameLine.style.width = "120px";
  nameLine.style.margin = "0";

  const timeLine = document.createElement("div");
  timeLine.className = "skeleton skeleton-line";
  timeLine.style.width = "60px";
  timeLine.style.margin = "0";

  nameWrap.appendChild(nameLine);
  nameWrap.appendChild(timeLine);
  top.appendChild(avatar);
  top.appendChild(nameWrap);

  node.appendChild(top);

  const text1 = document.createElement("div");
  text1.className = "skeleton skeleton-line";
  text1.style.margin = "0 16px 10px";
  text1.style.width = "90%";
  node.appendChild(text1);

  const text2 = document.createElement("div");
  text2.className = "skeleton skeleton-line";
  text2.style.margin = "0 16px 16px";
  text2.style.width = "70%";
  node.appendChild(text2);

  return node;
}

function stableFeedJitter(post) {
  const raw = String(post && (post.id || post.createdAt || post.authorKey || post.author || ""));
  let hash = 0;
  for (let i = 0; i < raw.length; i++) {
    hash = ((hash << 5) - hash + raw.charCodeAt(i)) | 0;
  }
  return (Math.abs(hash) % 100) / 1000;
}

function smartRankFeedPosts(posts) {
  const now = Date.now();
  return [...(Array.isArray(posts) ? posts : [])].sort((a, b) => {
    const aTime = new Date(a.createdAt || a.created_at || 0).getTime() || 0;
    const bTime = new Date(b.createdAt || b.created_at || 0).getTime() || 0;
    const aAgeHours = aTime ? Math.max(0, (now - aTime) / 3600000) : 9999;
    const bAgeHours = bTime ? Math.max(0, (now - bTime) / 3600000) : 9999;
    const aEngagement = (Number(a.likeCount || a.likes || 0) * 3) + (Number(a.commentCount || a.comments || 0) * 4);
    const bEngagement = (Number(b.likeCount || b.likes || 0) * 3) + (Number(b.commentCount || b.comments || 0) * 4);
    const aRecency = aAgeHours <= 1 ? 120 : aAgeHours <= 24 ? 70 : aAgeHours <= 168 ? 30 : 0;
    const bRecency = bAgeHours <= 1 ? 120 : bAgeHours <= 24 ? 70 : bAgeHours <= 168 ? 30 : 0;
    const aScore = aRecency + aEngagement + stableFeedJitter(a);
    const bScore = bRecency + bEngagement + stableFeedJitter(b);
    if (bScore !== aScore) return bScore - aScore;
    return bTime - aTime;
  });
}

async function loadFeed({ reset = false } = {}) {
  if (!el.feed) return;
  if (!getToken()) {
    showAuth();
    return;
  }
  if (feedLoading) return;
  const feedLimit = lowDataMode ? 5 : 8;
  const cacheKey = `home:page1:limit${feedLimit}:low${lowDataMode ? 1 : 0}`;
  if (reset && feedCache.key === cacheKey && feedCache.payload && Date.now() - feedCache.timestamp < FEED_CACHE_TTL) {
    const cached = feedCache.payload;
    const posts = smartRankFeedPosts(cached.posts);
    feedCursor = cached.nextCursor || null;
    feedPage = cached.nextPage || 2;
    el.feed.textContent = "";
    if (!posts.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = t("noPosts");
      empty.dataset.empty = "true";
      el.feed.appendChild(empty);
    } else {
      feedRevealIndex = 0;
      for (const p of posts) {
        const node = postNode(p);
        el.feed.appendChild(node);
        observeFeedReveal(node);
        observeMediaPlayback(node);
      }
      window.setTimeout(wireLightboxToFeed, 80);
    }
    updateFeedSentinel();
    if (reset) window.requestAnimationFrame(restoreHomeScroll);
    return;
  }
  feedLoading = true;
  if (el.feedLoader) el.feedLoader.hidden = false;

  if (reset) {
    el.feed.textContent = "";
    feedCursor = null;
    feedPage = 1;
    feedRevealIndex = 0;
    for (let i = 0; i < 3; i++) {
      el.feed.appendChild(createSkeletonPost());
    }
  }

  try {
    if (reset) {
      await loadStories();
      await loadTrends();
    }
    const url = new URL("/api/posts", location.origin);
    url.searchParams.set("limit", String(feedLimit));
    url.searchParams.set("page", String(feedPage));

    const r = await api(url.pathname + url.search, { method: "GET" });
    const posts = smartRankFeedPosts(r.posts);
    feedCursor = r.nextCursor;
    feedPage = r.nextPage || (feedPage + 1);
    if (reset) feedCache = { key: cacheKey, timestamp: Date.now(), payload: r };

    if (reset) el.feed.textContent = "";

    if (reset && !posts.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = t("noPosts");
      empty.dataset.empty = "true";
      el.feed.appendChild(empty);
      return;
    }

    for (const p of posts) {
      const node = postNode(p);
      el.feed.appendChild(node);
      observeFeedReveal(node);
      observeMediaPlayback(node);
    }
    window.setTimeout(wireLightboxToFeed, 80);
    if (reset) restoreHomeScroll();
  } catch (err) {
    showFeedError(err, { reset });
  } finally {
    feedLoading = false;
    if (el.feedLoader) el.feedLoader.hidden = true;
    updateFeedSentinel();
  }
}

async function loadReels() {
  if (!el.reelsView || !el.feed) return;
  if (reelsLoading) return;
  reelsLoading = true;
  el.reelsView.hidden = false;
  el.feed.hidden = true;
  resetMainScroll();
  el.reelsView.scrollTop = 0;
  if (el.storiesBar) el.storiesBar.hidden = true;
  if (el.trendsBar) el.trendsBar.hidden = true;
  el.reelsView.textContent = "";

  // ── TOP BAR (fixed overlay, created once) ────────────────
  const topBar = document.createElement("div");
  topBar.className = "reelTopBar";
  const topCreate = document.createElement("button");
  topCreate.type = "button";
  topCreate.className = "reelTopBtn";
  topCreate.setAttribute("aria-label", "Create reel");
  topCreate.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="3"/><path d="M12 8v8M8 12h8"/></svg>`;
  on(topCreate, "click", () => { location.hash = "#home"; route(); });
  const topTitle = document.createElement("span");
  topTitle.className = "reelTopTitle";
  topTitle.textContent = "Reels";
  const topFilter = document.createElement("button");
  topFilter.type = "button";
  topFilter.className = "reelTopBtn";
  topFilter.setAttribute("aria-label", "Filter");
  topFilter.innerHTML = `<svg viewBox="0 0 24 24" width="26" height="26" stroke="currentColor" stroke-width="2.2" fill="none" stroke-linecap="round" stroke-linejoin="round"><line x1="4" y1="6" x2="20" y2="6"/><line x1="8" y1="12" x2="16" y2="12"/><line x1="11" y1="18" x2="13" y2="18"/></svg>`;
  topBar.appendChild(topCreate);
  topBar.appendChild(topTitle);
  topBar.appendChild(topFilter);
  el.reelsView.appendChild(topBar);

  const loading = document.createElement("div");
  loading.className = "reelsLoading reelsSkeleton";
  loading.textContent = t("loading");
  el.reelsView.appendChild(loading);

  let r = null;
  try {
    if (reelsCache.payload && Date.now() - reelsCache.timestamp < REELS_CACHE_TTL) {
      r = reelsCache.payload;
    } else {
      r = await api(`/api/reels?limit=${lowDataMode ? 5 : 8}`, { method: "GET" });
      reelsCache = { timestamp: Date.now(), payload: r };
    }
  } finally {
    reelsLoading = false;
  }
  const reels = Array.isArray(r.reels) ? r.reels : [];
  loading.remove();
  if (!reels.length) {
    const empty = document.createElement("div");
    empty.className = "reelsLoading";
    empty.textContent = "No reels yet.";
    el.reelsView.appendChild(empty);
    return;
  }

  for (const reel of reels) {
    const card = document.createElement("div");
    card.className = "reelCard";
    const reelMedia = (reel.media || []).find((m) => m && m.kind === "video") || (reel.media || [])[0];

    // ── MEDIA LAYER ──────────────────────────────────────────
    const media = document.createElement("div");
    media.className = "reelMedia";

    // ── GRADIENT OVERLAYS ────────────────────────────────────
    const gradTop = document.createElement("div");
    gradTop.className = "reelGradTop";
    const gradBottom = document.createElement("div");
    gradBottom.className = "reelGradBottom";

    // ── HEART BURST (double-tap) ─────────────────────────────
    const heart = document.createElement("div");
    heart.className = "heartBurst";
    heart.textContent = "\u2665";

    // ── REACTION PALETTE (long-press) ────────────────────────
    const reactionPalette = document.createElement("div");
    reactionPalette.className = "reelReactionPalette";
    for (const emoji of ["❤️", "😂", "😮", "😢", "😡"]) {
      const reactionBtn = document.createElement("button");
      reactionBtn.type = "button";
      reactionBtn.textContent = emoji;
      on(reactionBtn, "click", () => {
        reactionPalette.classList.remove("show");
        if (emoji === "❤️" && !reel.likedByMe) likeReel().catch(() => {});
        showToast(`Reacted ${emoji}`);
      });
      reactionPalette.appendChild(reactionBtn);
    }

    // ── RIGHT RAIL ────────────────────────────────────────────
    const rail = document.createElement("div");
    rail.className = "reelRightRail";

    // Profile avatar + follow badge
    const railProfile = document.createElement("div");
    railProfile.className = "reelRailProfile";
    const railAvatar = avatarNode(reel.authorAvatar, reel.author, "sm");
    railAvatar.classList.add("reelRailAvatar");
    railProfile.appendChild(railAvatar);
    const followAction = document.createElement("button");
    followAction.type = "button";
    followAction.className = "reelFollowBadge";
    followAction.textContent = reel.isFollowingAuthor ? "\u2713" : "+";
    followAction.hidden = isMineKey(reel.authorKey);
    railProfile.appendChild(followAction);
    rail.appendChild(railProfile);

    // Like
    const likeAction = document.createElement("button");
    likeAction.type = "button";
    likeAction.className = "reelRailBtn";
    setIconCountState(likeAction, "heart", reel.likeCount || 0, reel.likedByMe);

    // Comment
    const commentAction = document.createElement("button");
    commentAction.type = "button";
    commentAction.className = "reelRailBtn";
    setIconCountState(commentAction, "comment", reel.commentCount || 0, false);

    // Share (forward arrow)
    const shareAction = document.createElement("button");
    shareAction.type = "button";
    shareAction.className = "reelRailBtn";
    shareAction.innerHTML = `${icon("share")}<strong>${formatCount(0)}</strong>`;

    // DM / Send (paper plane) — hidden for own reels
    const messageAction = document.createElement("button");
    messageAction.type = "button";
    messageAction.className = "reelRailBtn";
    messageAction.innerHTML = `${icon("plane")}<strong>${formatCount(0)}</strong>`;
    messageAction.hidden = isMineKey(reel.authorKey);

    // Bookmark
    const saveAction = document.createElement("button");
    saveAction.type = "button";
    saveAction.className = "reelRailBtn";
    setIconCountState(saveAction, "bookmark", reel.bookmarkCount || 0, reel.bookmarkedByMe);

    // More (⋯)
    const moreAction = document.createElement("button");
    moreAction.type = "button";
    moreAction.className = "reelRailBtn reelRailMore";
    moreAction.innerHTML = `<svg viewBox="0 0 24 24" width="24" height="24" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg><strong></strong>`;

    // Views (non-interactive)
    const viewsAction = document.createElement("button");
    viewsAction.type = "button";
    viewsAction.className = "reelRailBtn";
    viewsAction.style.pointerEvents = "none";
    setIconCountState(viewsAction, "eye", reel.viewCount || 0, false);

    rail.appendChild(likeAction);
    rail.appendChild(commentAction);
    rail.appendChild(shareAction);
    rail.appendChild(messageAction);
    rail.appendChild(saveAction);
    rail.appendChild(moreAction);

    // ── BOTTOM LEFT ───────────────────────────────────────────
    const bottomLeft = document.createElement("div");
    bottomLeft.className = "reelBottomLeft";

    // Row: avatar + username + badge + follow button
    const infoRow = document.createElement("div");
    infoRow.className = "reelInfoRow";
    const infoAvatar = avatarNode(reel.authorAvatar, reel.author, "sm");
    infoAvatar.classList.add("reelInfoAvatar");
    const authorLink = document.createElement("a");
    authorLink.href = `#u/${encodeURIComponent(reel.authorKey)}`;
    authorLink.className = "reelUsername";
    authorLink.textContent = `@${reel.author || "user"}`;
    const reelBadge = renderUserBadge({ verified: reel.verified, role: reel.authorRole, createdAt: reel.authorCreatedAt });
    const followBtnInline = document.createElement("button");
    followBtnInline.type = "button";
    followBtnInline.className = "reelFollowInline";
    if (reel.isFollowingAuthor) followBtnInline.classList.add("following");
    followBtnInline.textContent = reel.isFollowingAuthor ? "Following" : "Follow";
    followBtnInline.hidden = isMineKey(reel.authorKey);
    infoRow.appendChild(infoAvatar);
    infoRow.appendChild(authorLink);
    if (reelBadge) infoRow.appendChild(reelBadge);
    infoRow.appendChild(followBtnInline);
    bottomLeft.appendChild(infoRow);

    // Caption (2-line clamp + ...more)
    const captionText = richTextNode(reel.text || "");
    captionText.className = "reelCaptionText";
    const moreTextBtn = document.createElement("button");
    moreTextBtn.type = "button";
    moreTextBtn.className = "reelMoreText";
    moreTextBtn.textContent = "...more";
    let captionExpanded = false;
    on(moreTextBtn, "click", () => {
      captionExpanded = !captionExpanded;
      captionText.classList.toggle("expanded", captionExpanded);
      moreTextBtn.textContent = captionExpanded ? "less" : "...more";
    });
    bottomLeft.appendChild(captionText);
    bottomLeft.appendChild(moreTextBtn);

    // Social proof
    const socialProof = document.createElement("div");
    socialProof.className = "reelSocialProof";
    if (reel.mutualFollowers && reel.mutualFollowers.length) {
      socialProof.textContent = `Followed by ${reel.mutualFollowers[0]} and others`;
    }
    bottomLeft.appendChild(socialProof);

    // Music/sound marquee row
    const musicRow = document.createElement("button");
    musicRow.type = "button";
    musicRow.className = "reelMusicRow";
    const musicMarquee = document.createElement("span");
    musicMarquee.className = "reelMusicMarquee";
    musicMarquee.textContent = `\u266A sound \u00B7 ${reel.author || "HYSA"}`;
    musicRow.appendChild(musicMarquee);
    on(musicRow, "click", () => showToast("Related reels for this sound are coming."));
    bottomLeft.appendChild(musicRow);

    // ── MUTE CIRCLE (center bottom) ───────────────────────────
    const muteIconMuted = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><line x1="23" y1="9" x2="17" y2="15"/><line x1="17" y1="9" x2="23" y2="15"/></svg>`;
    const muteIconOn = `<svg viewBox="0 0 24 24" width="20" height="20" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"><polygon points="11 5 6 9 2 9 2 15 6 15 11 19 11 5"/><path d="M15.54 8.46a5 5 0 0 1 0 7.07"/><path d="M19.07 4.93a10 10 0 0 1 0 14.14"/></svg>`;
    const mute = document.createElement("button");
    mute.type = "button";
    mute.className = "reelMuteCircle";
    mute.setAttribute("aria-label", reelMutePreference ? "Unmute" : "Mute");
    mute.innerHTML = reelMutePreference ? muteIconMuted : muteIconOn;

    // ── ASSEMBLE CARD ─────────────────────────────────────────
    card.appendChild(media);
    card.appendChild(gradTop);
    card.appendChild(gradBottom);
    card.appendChild(heart);
    card.appendChild(reactionPalette);
    card.appendChild(mute);
    card.appendChild(rail);
    card.appendChild(bottomLeft);

    // ── FOLLOW LOGIC ─────────────────────────────────────────
    async function toggleReelFollow() {
      if (!reel.authorKey || isMineKey(reel.authorKey)) return;
      followAction.disabled = true;
      followBtnInline.disabled = true;
      try {
        const rFollow = await api(`/api/follow/${encodeURIComponent(reel.authorKey)}`, { method: "POST" });
        reel.isFollowingAuthor = !!rFollow.following;
        followAction.textContent = reel.isFollowingAuthor ? "\u2713" : "+";
        followBtnInline.textContent = reel.isFollowingAuthor ? "Following" : "Follow";
        followBtnInline.classList.toggle("following", reel.isFollowingAuthor);
      } catch (err) {
        showToast(humanizeError(err?.message), true);
      } finally {
        followAction.disabled = false;
        followBtnInline.disabled = false;
      }
    }
    on(followAction, "click", toggleReelFollow);
    on(followBtnInline, "click", toggleReelFollow);

    // ── HEART ANIMATIONS ─────────────────────────────────────
    function flashHeart() {
      heart.classList.remove("show");
      void heart.offsetWidth;
      heart.classList.add("show");
      window.setTimeout(() => heart.classList.remove("show"), 620);
    }
    function floatHearts(event) {
      const rect = card.getBoundingClientRect();
      const baseX = event && Number.isFinite(event.clientX) ? event.clientX - rect.left : rect.width / 2;
      const baseY = event && Number.isFinite(event.clientY) ? event.clientY - rect.top : rect.height / 2;
      for (let i = 0; i < 8; i += 1) {
        const node = document.createElement("span");
        node.className = "floatingHeart";
        node.textContent = "\u2665";
        node.style.left = `${baseX}px`;
        node.style.top = `${baseY}px`;
        node.style.setProperty("--x", `${(i - 3.5) * 18}px`);
        node.style.setProperty("--y", `${-70 - ((i * 13) % 60)}px`);
        node.style.setProperty("--r", `${(i % 2 ? 1 : -1) * (10 + i * 4)}deg`);
        card.appendChild(node);
        window.setTimeout(() => node.remove(), 950);
      }
    }
    function pulseLikeButton() {
      likeAction.classList.remove("likedPulse");
      void likeAction.offsetWidth;
      likeAction.classList.add("likedPulse");
      window.setTimeout(() => likeAction.classList.remove("likedPulse"), 320);
    }
    async function likeReel() {
      const rLike = await api(`/api/posts/${encodeURIComponent(reel.id)}/like`, { method: "POST" });
      reel.likedByMe = rLike.liked;
      reel.likeCount = rLike.likeCount;
      setIconCountState(likeAction, "heart", reel.likeCount || 0, reel.likedByMe);
      pulseLikeButton();
    }

    // ── VIDEO PLAYER ─────────────────────────────────────────
    if (reelMedia && reelMedia.kind === "video") {
      const player = customVideoPlayer(mediaFullUrl(reelMedia), {
        muted: reelMutePreference,
        autoplay: !lowDataMode,
        poster: mediaThumbUrl(reelMedia),
        previewUrl: String(reelMedia.previewUrl || ""),
        onDoubleTap: (event) => {
          flashHeart();
          floatHearts(event);
          if (!reel.likedByMe) likeReel().catch(() => {});
        },
      });
      player.classList.add("reelPlayer");
      const progress = document.createElement("div");
      progress.className = "reelProgress";
      const progressFill = document.createElement("span");
      progress.appendChild(progressFill);
      player.appendChild(progress);
      const video = player.querySelector("video");
      if (video) {
        video.loop = true;
        video.preload = "metadata";
        let pressTimer = null;
        let longPressPaused = false;
        on(video, "timeupdate", () => {
          const total = Number(video.duration || 0);
          const pct = total ? Number(video.currentTime || 0) / total : 0;
          progressFill.style.width = `${pct * 100}%`;
          if (pct >= 0.8) {
            const nextVideo = card.nextElementSibling?.querySelector?.("video");
            if (nextVideo && nextVideo.preload !== "auto") {
              nextVideo.preload = "metadata";
              nextVideo.load();
            }
          }
        });
        on(media, "pointerdown", (event) => {
          if (event.target && event.target.closest && event.target.closest("button, a")) return;
          longPressPaused = false;
          pressTimer = window.setTimeout(() => {
            reactionPalette.classList.add("show");
            if (!video.paused) {
              longPressPaused = true;
              video.pause();
            }
          }, 420);
        });
        on(media, "pointerup", () => {
          if (pressTimer) window.clearTimeout(pressTimer);
          pressTimer = null;
          if (longPressPaused) video.play().catch(() => {});
          longPressPaused = false;
        });
        on(media, "pointercancel", () => {
          if (pressTimer) window.clearTimeout(pressTimer);
          pressTimer = null;
          longPressPaused = false;
        });
        let viewTimer = null;
        let reelInView = false;
        const cancelReelViewTimer = () => {
          if (viewTimer) window.clearTimeout(viewTimer);
          viewTimer = null;
        };
        const markView = () => {
          const reelId = String(reel.id || "");
          if (!reelId || reelViewedIds.has(reelId) || viewTimer || !reelInView || video.paused) return;
          viewTimer = window.setTimeout(() => {
            viewTimer = null;
            if (!reelInView || video.paused || reelViewedIds.has(reelId)) return;
            reelViewedIds.add(reelId);
            api(`/api/reels/${encodeURIComponent(reelId)}/view`, { method: "POST", body: "{}" })
              .then((rView) => {
                reel.viewCount = rView.viewCount ?? reel.viewCount;
                reel.views = reel.viewCount;
                setIconCountState(viewsAction, "eye", reel.viewCount || 0, false);
              })
              .catch(() => {});
          }, 3000);
        };
        if ("IntersectionObserver" in window) {
          const reelViewObserver = new IntersectionObserver(
            (entries) => {
              const entry = entries[0];
              reelInView = !!(entry && entry.isIntersecting);
              if (reelInView) markView();
              else cancelReelViewTimer();
            },
            { root: null, threshold: 0.75 },
          );
          reelViewObserver.observe(card);
        } else {
          reelInView = true;
        }
        on(video, "playing", markView);
        on(video, "pause", cancelReelViewTimer);
        on(video, "ended", cancelReelViewTimer);
        on(mute, "click", () => {
          video.muted = !video.muted;
          reelMutePreference = video.muted;
          localStorage.setItem("hysa_reels_muted", String(reelMutePreference));
          mute.innerHTML = video.muted ? muteIconMuted : muteIconOn;
          mute.setAttribute("aria-label", video.muted ? "Unmute" : "Mute");
          for (const v of el.reelsView.querySelectorAll(".reelCard video")) v.muted = reelMutePreference;
        });
      }
      media.appendChild(player);
    } else if (reelMedia && reelMedia.kind === "image") {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.src = mediaDisplayUrl(reelMedia);
      media.appendChild(img);
    }

    // ── INTERACTIONS ─────────────────────────────────────────
    on(card, "dblclick", (event) => {
      const target = event && event.target && event.target.closest ? event.target : null;
      if (target && target.closest(".proVideo")) return;
      flashHeart();
      floatHearts(event);
      if (!reel.likedByMe) likeReel().catch(() => {});
    });
    on(likeAction, "click", () => {
      likeAction.classList.add("railBounce");
      window.setTimeout(() => likeAction.classList.remove("railBounce"), 340);
      likeReel().catch(() => {});
    });
    on(commentAction, "click", () => {
      commentAction.classList.add("railBounce");
      window.setTimeout(() => commentAction.classList.remove("railBounce"), 340);
      openReelComments(reel, commentAction).catch((err) => showToast(humanizeError(err?.message), true));
    });
    on(shareAction, "click", () => {
      shareAction.classList.add("railBounce");
      window.setTimeout(() => shareAction.classList.remove("railBounce"), 340);
      shareReel(reel);
    });
    on(moreAction, "click", () => {
      showActionSheet("Reel options", (body, close) => {
        const viewInfo = document.createElement("div");
        viewInfo.className = "sharePreviewCard";
        viewInfo.innerHTML = `<strong>${formatCount(reel.viewCount || 0)} views</strong><span>@${reel.author || "HYSA"}</span>`;
        body.appendChild(viewInfo);
        const save = sheetButton(reel.bookmarkedByMe ? "Saved" : "Save");
        on(save, "click", async () => {
          close();
          saveAction.click();
        });
        body.appendChild(save);
        if (!isMineKey(reel.authorKey)) {
          const dm = sheetButton("Message creator");
          on(dm, "click", () => {
            close();
            if (reel.authorKey) location.hash = `#dm/${encodeURIComponent(reel.authorKey)}`;
          });
          body.appendChild(dm);
        }
      });
    });
    on(messageAction, "click", () => {
      messageAction.classList.add("railBounce");
      window.setTimeout(() => messageAction.classList.remove("railBounce"), 340);
      if (!reel.authorKey) return;
      location.hash = `#dm/${encodeURIComponent(reel.authorKey)}`;
    });
    on(saveAction, "click", async () => {
      saveAction.classList.add("railBounce");
      window.setTimeout(() => saveAction.classList.remove("railBounce"), 340);
      try {
        const rSave = await api(`/api/posts/${encodeURIComponent(reel.id)}/bookmark`, { method: "POST" });
        reel.bookmarkedByMe = rSave.bookmarked;
        reel.bookmarkCount = rSave.bookmarkCount;
        setIconCountState(saveAction, "bookmark", reel.bookmarkCount || 0, reel.bookmarkedByMe);
      } catch (err) {
        showToast(humanizeError(err?.message), true);
      }
    });

    el.reelsView.appendChild(card);
  }

  const videos = Array.from(el.reelsView.querySelectorAll(".reelCard video"));
  videos.forEach((video, index) => {
    video.preload = index < 2 ? "auto" : "metadata";
  });
  observeMediaPlayback(el.reelsView);
  on(el.reelsView, "scroll", () => {
    if (reelScrollTicking) return;
    reelScrollTicking = true;
    window.requestAnimationFrame(() => {
      reelScrollTicking = false;
      let best = null;
      let bestOverlap = 0;
      for (const video of videos) {
        if (!video.isConnected) continue;
        const rect = video.getBoundingClientRect();
        const overlap = Math.max(0, Math.min(rect.bottom, window.innerHeight) - Math.max(rect.top, 0));
        if (overlap > bestOverlap) {
          bestOverlap = overlap;
          best = video;
        }
      }
      for (const video of videos) {
        if (!video.isConnected) continue;
        if (video !== best) video.pause();
      }
    });
  }, { passive: true });
}

async function openReelComments(reel, commentAction) {
  showActionSheet(t("comments"), async (body) => {
    body.classList.add("reelCommentsSheet");
    const list = document.createElement("div");
    list.className = "reelCommentsList";
    list.textContent = t("loading");
    const input = document.createElement("textarea");
    input.className = "sheet-textarea";
    input.maxLength = 200;
    input.placeholder = `${t("writeComment")} :)`;
    const send = sheetButton(t("send"), "primary");
    body.appendChild(list);
    body.appendChild(input);
    body.appendChild(send);

    let replyTo = "";
    async function load() {
      const r = await api(`/api/posts/${encodeURIComponent(reel.id)}/comments?limit=80`, { method: "GET" });
      const comments = Array.isArray(r.comments) ? r.comments : [];
      list.textContent = "";
      if (!comments.length) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "No comments yet";
        list.appendChild(empty);
      }
      for (const c of comments) {
        list.appendChild(commentNode(c, (targetComment) => {
          replyTo = targetComment.id;
          input.placeholder = `Reply to @${targetComment.author}`;
          input.focus();
        }, null, reel));
      }
      reel.commentCount = r.commentCount ?? reel.commentCount;
      setIconCountState(commentAction, "comment", reel.commentCount || 0, false);
    }

    on(send, "click", async () => {
      const textValue = input.value.trim();
      if (!textValue) return;
      send.disabled = true;
      try {
        const r = await api(`/api/posts/${encodeURIComponent(reel.id)}/comments`, {
          method: "POST",
          body: JSON.stringify({ text: textValue, parentId: replyTo || undefined }),
        });
        reel.commentCount = r.commentCount ?? (Number(reel.commentCount || 0) + 1);
        input.value = "";
        replyTo = "";
        input.placeholder = `${t("writeComment")} :)`;
        await load();
      } catch (err) {
        showToast(humanizeError(err?.message), true);
      } finally {
        send.disabled = false;
      }
    });

    await load();
    window.setTimeout(() => input.focus(), 80);
  });
}

function shareReel(reel) {
  shareContent({ kind: "reel", id: reel.id, text: reel.text || "", author: reel.author || "", media: reel.media || [] });
}

async function sendSharedItemToPeer(peer, item, url, button) {
  const key = String(peer?.key || peer?.userKey || peer || "").trim();
  if (!key) return;
  if (button) button.disabled = true;
  try {
    await api(`/api/dm/${encodeURIComponent(key)}`, {
      method: "POST",
      body: JSON.stringify({ text: `Shared ${item.kind || "post"} from @${item.author || "HYSA"}: ${url}` }),
    });
    hideActionSheet();
    showToast("Sent to DM.");
  } catch (err) {
    showToast(humanizeError(err?.message), true);
  } finally {
    if (button) button.disabled = false;
  }
}

function shareContent(item) {
  const url = `${location.origin}/#p/${encodeURIComponent(item.id)}`;
  showActionSheet(`Share ${item.kind || "post"}`, (body) => {
    const native = sheetButton("Share");
    const copy = sheetButton(t("copyLink"));
    const dmInput = document.createElement("input");
    dmInput.type = "text";
    dmInput.placeholder = "Send to friend username";
    const sendDm = sheetButton("Send to DM", "primary");
    const preview = document.createElement("div");
    preview.className = "sharePreviewCard";
    preview.innerHTML = `<strong></strong><span></span>`;
    preview.querySelector("strong").textContent = `@${item.author || "HYSA"}`;
    preview.querySelector("span").textContent = String(item.text || url).slice(0, 110);
    const friendsRow = document.createElement("div");
    friendsRow.className = "shareFriends";
    friendsRow.innerHTML = '<span class="muted">Loading friends...</span>';
    api("/api/friends", { method: "GET" }).then((r) => {
      const friends = Array.isArray(r.friends) ? r.friends : [];
      friendsRow.textContent = "";
      if (!friends.length) {
        friendsRow.innerHTML = '<span class="muted">No mutual friends yet.</span>';
        return;
      }
      for (const friend of friends.slice(0, 12)) {
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "shareFriend";
        btn.appendChild(avatarNode(friend.avatarUrl, friend.username, "sm"));
        const name = document.createElement("span");
        name.textContent = `@${friend.username}`;
        const badge = renderUserBadge(friend);
        if (badge) name.appendChild(badge);
        btn.appendChild(name);
        on(btn, "click", () => sendSharedItemToPeer(friend, item, url, btn));
        friendsRow.appendChild(btn);
      }
    }).catch(() => {
      friendsRow.innerHTML = '<span class="muted">Friends unavailable.</span>';
    });

    on(native, "click", async () => {
      try {
        if (navigator.share) await navigator.share({ title: "HYSA", text: item.text || "", url });
        else showToast("Native share is not available here.", true);
      } catch {
        // ignore
      }
    });
    on(copy, "click", async () => {
      try {
        if (navigator.clipboard) await navigator.clipboard.writeText(url);
        showToast(t("linkCopied"));
      } catch {
        showToast(url);
      }
    });
    on(sendDm, "click", async () => {
      const peer = dmInput.value.trim().replace(/^@/, "").toLowerCase();
      if (!peer) return dmInput.focus();
      sendSharedItemToPeer(peer, item, url, sendDm);
    });

    body.appendChild(preview);
    body.appendChild(friendsRow);
    body.appendChild(native);
    body.appendChild(copy);
    body.appendChild(dmInput);
    body.appendChild(sendDm);
  });
}

async function openNotificationsPanel() {
  try {
    const r = await api("/api/notifications", { method: "GET" });
    const notifications = Array.isArray(r.notifications) ? r.notifications : [];
    showActionSheet("🔔 الإشعارات", (body) => {
      body.classList.add("notificationsSheet");

      const now = Date.now();
      const dayMs = 86400000;
      const weekMs = 7 * dayMs;
      const todayItems = [], weekItems = [], olderItems = [];
      for (const n of notifications) {
        const age = now - new Date(n.createdAt || n.created_at || 0).getTime();
        if (age < dayMs) todayItems.push(n);
        else if (age < weekMs) weekItems.push(n);
        else olderItems.push(n);
      }

      const typeText = (item) => ({
        like: "أعجب بمنشورك ❤️",
        comment: "علّق على منشورك 💬",
        comment_reply: "ردّ على تعليقك 💬",
        dm: "أرسل لك رسالة 📩",
        story_reaction: "تفاعل مع قصتك ✨",
        new_follower: "بدأ بمتابعتك 👤",
        repost: "شارك منشورك 🔁",
        follow_accepted: "قبل طلب متابعتك ✅",
        mention: "ذكرك في منشور 📢",
      }[item.type] || String(item.type || "إشعار"));

      const renderGroup = (label, items) => {
        if (!items.length) return;
        const header = document.createElement("div");
        header.className = "notifGroupHeader";
        header.textContent = label;
        body.appendChild(header);
        for (const item of items) {
          const row = document.createElement("div");
          row.className = `notificationItem ${item.read ? "" : "unread"}`.trim();
          const actor = item.actorKey ? `@${item.actorKey}` : "HYSA";
          const avEl = avatarNode(item.actorAvatarUrl || "", item.actorKey || "H", "sm");
          const textEl = document.createElement("div");
          textEl.className = "notifText";
          textEl.innerHTML = `<span class="notifActor">${actor}</span> ${typeText(item)}<br><small class="muted">${fmtTime(item.createdAt || item.created_at)}</small>`;
          const delBtn = document.createElement("button");
          delBtn.type = "button";
          delBtn.className = "notifDelete iconBtn";
          delBtn.textContent = "✕";
          delBtn.title = "حذف";
          on(delBtn, "click", async (e) => {
            e.stopPropagation();
            row.style.opacity = "0.3";
            await api(`/api/notifications/${encodeURIComponent(item.id)}`, { method: "DELETE" }).catch(() => {});
            row.remove();
          });
          row.appendChild(avEl);
          row.appendChild(textEl);
          row.appendChild(delBtn);
          on(row, "click", async () => {
            if (!item.read) {
              api(`/api/notifications/${encodeURIComponent(item.id)}/read`, { method: "POST" }).catch(() => {});
              row.classList.remove("unread");
              item.read = true;
            }
            hideActionSheet();
            if (item.type === "dm" && item.actorKey) location.hash = `#dm/${encodeURIComponent(item.actorKey)}`;
            else if (item.postId || item.post_id) location.hash = `#p/${encodeURIComponent(item.postId || item.post_id)}`;
            else if (item.actorKey) location.hash = `#u/${encodeURIComponent(item.actorKey)}`;
            route();
          });
          body.appendChild(row);
        }
      };

      if (!notifications.length) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.style.cssText = "padding:24px;text-align:center";
        empty.textContent = "لا توجد إشعارات بعد 🔔";
        body.appendChild(empty);
      } else {
        renderGroup("اليوم", todayItems);
        renderGroup("هذا الأسبوع", weekItems);
        renderGroup("سابقاً", olderItems);
      }

      const mark = sheetButton("تحديد الكل كمقروء", "primary");
      on(mark, "click", async () => {
        await api("/api/notifications/read-all", { method: "POST", body: "{}" }).catch(() => {});
        if (el.notifDot) el.notifDot.hidden = true;
        if (el.notifBadge) el.notifBadge.hidden = true;
        hideActionSheet();
      });
      body.appendChild(mark);
    });
  } catch (err) {
    showToast(humanizeError(err?.message), true);
  }
}

async function openProfile(userKeyOrName) {
  activeProfileKey = userKeyOrName;
  activePostId = null;
  resetMainScroll();
  if (el.reelsView) el.reelsView.hidden = true;
  if (el.feed) el.feed.hidden = false;
  const r = await api(`/api/user/${encodeURIComponent(userKeyOrName)}`, { method: "GET" });
  if (el.trendsBar) el.trendsBar.hidden = true;
  setViewTitle(`${t("profileTitle")} @${r.profile.username}`);
  renderProfileHeader(r.profile);
  el.feed.textContent = "";
  const posts = Array.isArray(r.posts) ? r.posts : [];
  if (!posts.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = r.private ? "This profile is private." : t("noPosts");
    empty.dataset.empty = "true";
    el.feed.appendChild(empty);
  } else {
    for (const p of posts) {
      const node = postNode(p);
      el.feed.appendChild(node);
      observeMediaPlayback(node);
    }
  }
  updateFeedSentinel();
  resetMainScroll();
  window.requestAnimationFrame(resetMainScroll);
}

async function openPost(postId) {
  activeProfileKey = null;
  activePostId = postId;
  if (el.reelsView) el.reelsView.hidden = true;
  if (el.feed) el.feed.hidden = false;
  clearProfileHeader();
  const r = await api(`/api/posts/${encodeURIComponent(postId)}`, { method: "GET" });
  setViewTitle(t("postViewTitle"));
  el.feed.textContent = "";
  if (r.post) {
    const node = postNode(r.post);
    el.feed.appendChild(node);
    observeMediaPlayback(node);
  }
  updateFeedSentinel();
}

function updateFeedSentinel() {
  if (!el.feedSentinel) return;
  const isHome = !activeProfileKey && !activePostId;
  el.feedSentinel.hidden = !isHome || !feedCursor;
}

function ensureInfiniteFeed() {
  if (!el.feedSentinel) return;
  if (!("IntersectionObserver" in window)) return;
  if (feedObserver) return;
  feedObserver = new IntersectionObserver(
    (entries) => {
      const hit = entries.some((e) => e.isIntersecting);
      if (!hit) return;
      if (!getToken()) return;
      if (activeProfileKey || activePostId) return;
      if (!feedCursor) return;
      if (feedLoading) return;
      loadFeed().catch(() => {});
    },
    { root: null, rootMargin: "600px 0px", threshold: 0 },
  );
  feedObserver.observe(el.feedSentinel);
}

function ensurePostViewObserver() {
  if (!("IntersectionObserver" in window)) return;
  if (postViewObserver) return;
  postViewObserver = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const node = e.target;
        const postId = node && node.dataset ? node.dataset.postId : "";
        if (!postId) continue;
        rememberSeenPost(postId);
        node.classList.add("post-seen");
        if (sentViews.has(postId)) {
          postViewObserver.unobserve(node);
          continue;
        }
        sentViews.add(postId);
        postViewObserver.unobserve(node);
        api(`/api/posts/${encodeURIComponent(postId)}/view`, { method: "POST", body: "{}" })
          .then((r) => {
            const n = Number(r?.viewCount);
            if (!Number.isFinite(n)) return;
            const strong = node.querySelector("[data-role='viewCount']");
            if (strong) strong.textContent = formatCount(n);
          })
          .catch(() => {});
      }
    },
    { root: null, rootMargin: "0px 0px -20% 0px", threshold: 0.65 },
  );
}

function observePostView(node, postId) {
  if (!node || !postId) return;
  ensurePostViewObserver();
  if (!postViewObserver) return;
  node.dataset.postId = String(postId);
  postViewObserver.observe(node);
}

function attachMentionAutocomplete(textarea) {
  let dropdown = null;
  let mentionStart = -1;
  let searchTimer = null;

  function hideDrop() {
    if (dropdown) { dropdown.remove(); dropdown = null; }
    mentionStart = -1;
  }

  function showDrop(users, curPos) {
    hideDrop();
    if (!users.length) return;
    const parent = textarea.parentNode;
    if (!parent) return;
    if (getComputedStyle(parent).position === "static") parent.style.position = "relative";
    dropdown = document.createElement("div");
    dropdown.className = "mentionDrop glass";
    for (const u of users) {
      const item = document.createElement("div");
      item.className = "mentionItem";
      item.innerHTML = `<span class="mentionAt">@${u.username}</span>${u.displayName || u.display_name ? `<small class="muted"> ${u.displayName || u.display_name}</small>` : ""}`;
      on(item, "mousedown", (e) => {
        e.preventDefault();
        const val = textarea.value;
        const before = val.substring(0, mentionStart);
        const after = val.substring(curPos);
        textarea.value = `${before}@${u.username} ${after}`;
        const newPos = mentionStart + u.username.length + 2;
        textarea.setSelectionRange(newPos, newPos);
        hideDrop();
        textarea.focus();
      });
      dropdown.appendChild(item);
    }
    parent.appendChild(dropdown);
  }

  on(textarea, "input", () => {
    const val = textarea.value;
    const pos = textarea.selectionStart;
    const textBefore = val.substring(0, pos);
    const match = /@([a-z0-9_]*)$/i.exec(textBefore);
    if (match && match[1].length >= 1) {
      mentionStart = match.index;
      const query = match[1];
      if (searchTimer) clearTimeout(searchTimer);
      searchTimer = setTimeout(async () => {
        try {
          const r = await api(`/api/search?q=${encodeURIComponent(query)}&limit=5`);
          const users = Array.isArray(r.results) ? r.results.filter((x) => x.type === "user" || x.username) : [];
          showDrop(users.slice(0, 5), pos);
        } catch { hideDrop(); }
      }, 250);
    } else {
      hideDrop();
    }
  });

  on(textarea, "blur", () => setTimeout(hideDrop, 200));
  on(textarea, "keydown", (e) => { if (dropdown && e.key === "Escape") { hideDrop(); e.preventDefault(); } });
}

async function openExplorePage() {
  if (!getToken()) return;
  activeProfileKey = null;
  activePostId = null;
  closeDmView();
  if (el.reelsView) el.reelsView.hidden = true;
  clearProfileHeader();
  setViewTitle("استكشاف");

  if (!el.exploreView) return;

  if (el.feed) el.feed.hidden = true;
  if (el.storiesBar) el.storiesBar.hidden = true;
  if (el.trendsBar) el.trendsBar.hidden = true;
  el.exploreView.hidden = false;
  el.exploreView.textContent = "";

  const header = document.createElement("div");
  header.className = "exploreHeader";
  header.innerHTML = `<h3 class="exploreTitle">🔍 استكشاف</h3><p class="muted" style="font-size:13px">المنشورات الأكثر تفاعلاً</p>`;
  el.exploreView.appendChild(header);

  const grid = document.createElement("div");
  grid.className = "exploreGrid";
  el.exploreView.appendChild(grid);

  const skeletons = document.createElement("div");
  skeletons.className = "exploreSkeleton";
  skeletons.innerHTML = Array(9).fill('<div class="skeletonTile"></div>').join("");
  grid.appendChild(skeletons);

  try {
    const r = await api("/api/explore");
    const posts = Array.isArray(r.posts) ? r.posts : [];
    grid.textContent = "";
    if (!posts.length) {
      grid.innerHTML = `<p class="muted" style="text-align:center;padding:32px">لا توجد منشورات بعد</p>`;
      return;
    }
    for (const p of posts) {
      const tile = document.createElement("div");
      tile.className = "exploreTile";
      tile.setAttribute("role", "button");
      tile.tabIndex = 0;
      const hasMedia = Array.isArray(p.media) && p.media.length && isFullMediaUrl(p.media[0] && p.media[0].url);
      if (hasMedia) {
        const m = p.media[0];
        if (m.kind === "video") {
          const img = document.createElement("img");
          img.src = mediaThumbUrl(m);
          img.alt = "";
          img.loading = "lazy";
          img.decoding = "async";
          img.referrerPolicy = "no-referrer";
          tile.appendChild(img);
        } else {
          const img = document.createElement("img");
          img.src = mediaThumbUrl(m);
          img.alt = "";
          img.loading = "lazy";
          img.decoding = "async";
          img.referrerPolicy = "no-referrer";
          tile.appendChild(img);
        }
        if (p.media.length > 1) {
          const multi = document.createElement("span");
          multi.className = "exploreTileMulti";
          multi.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>`;
          tile.appendChild(multi);
        }
      } else {
        const textTile = document.createElement("div");
        textTile.className = "exploreTileText";
        textTile.textContent = String(p.text || "").slice(0, 80);
        tile.appendChild(textTile);
      }
      const overlay = document.createElement("div");
      overlay.className = "exploreTileOverlay";
      overlay.innerHTML = `<span>❤️ ${formatCount(p.likeCount || 0)}</span><span>💬 ${formatCount(Array.isArray(p.comments) ? p.comments.length : 0)}</span>`;
      tile.appendChild(overlay);
      on(tile, "click", () => { location.hash = `#p/${encodeURIComponent(p.id)}`; });
      on(tile, "keydown", (e) => { if (e.key === "Enter") tile.click(); });
      grid.appendChild(tile);
    }
  } catch (err) {
    grid.innerHTML = `<p class="muted" style="text-align:center;padding:32px">تعذّر تحميل المحتوى</p>`;
  }
}

function closeExplorePage() {
  if (el.exploreView) el.exploreView.hidden = true;
  if (el.feed) el.feed.hidden = false;
}

function route() {
  if (!getToken()) return;
  rememberHomeScroll();
  const h = location.hash || "#home";
  const mProfile = /^#u\/(.+)$/.exec(h);
  const mPost = /^#p\/(.+)$/.exec(h);
  const mDm = /^#dm\/(.+)$/.exec(h);

  if (mProfile) {
    closeExplorePage();
    closeDmView();
    const key = decodeURIComponent(mProfile[1]);
    openProfile(key).catch(() => {});
    return;
  }
  if (mPost) {
    closeExplorePage();
    closeDmView();
    const id = decodeURIComponent(mPost[1]);
    openPost(id).catch(() => {});
    return;
  }

  if (h === "#dm") {
    closeExplorePage();
    openDmInbox().catch(() => {});
    return;
  }
  if (mDm) {
    closeExplorePage();
    const key = decodeURIComponent(mDm[1]);
    openDmInbox().then(() => openDmThread(key)).catch(() => {});
    return;
  }
  if (h === "#reels") {
    closeExplorePage();
    closeDmView();
    clearProfileHeader();
    setViewTitle("Reels");
    loadReels().catch(() => {});
    return;
  }
  if (h === "#explore") {
    closeDmView();
    openExplorePage().catch(() => {});
    return;
  }

  activeProfileKey = null;
  activePostId = null;
  closeExplorePage();
  closeDmView();
  if (el.reelsView) el.reelsView.hidden = true;
  if (el.feed) el.feed.hidden = false;
  clearProfileHeader();
  setViewTitle(t("feedTitle"));
  loadFeed({ reset: true }).then(restoreHomeScroll).catch(() => {});
}

function debounce(fn, ms) {
  let tmr = null;
  return (...args) => {
    if (tmr) clearTimeout(tmr);
    tmr = setTimeout(() => fn(...args), ms);
  };
}

function showSearchResults(results) {
  if (!el.searchResults) return;
  if (!results.length) {
    el.searchResults.textContent = "";
    if (el.searchInput && el.searchInput.value.trim()) {
      el.searchResults.hidden = false;
      const empty = document.createElement("div");
      empty.className = "result empty";
      empty.textContent = "No users found";
      el.searchResults.appendChild(empty);
    } else {
      el.searchResults.hidden = true;
    }
    return;
  }
  el.searchResults.hidden = false;
  el.searchResults.textContent = "";
  for (const r of results) {
    const item = document.createElement("div");
    item.className = "result";
    const left = document.createElement("div");
    const right = document.createElement("div");
    right.className = "badge";
    if (r.type === "post") {
      const headline = document.createElement("strong");
      headline.textContent = `${r.hashtag || "#"} by @${r.author || r.authorKey || "user"}`;
      const snippet = document.createElement("small");
      snippet.textContent = r.text || "Post";
      left.appendChild(headline);
      left.appendChild(document.createElement("br"));
      left.appendChild(snippet);
      right.textContent = "Post";
    } else {
      const row = document.createElement("div");
      row.className = "searchUserRow";
      row.appendChild(avatarNode(r.avatarUrl, r.username, "xs"));
      const copy = document.createElement("span");
      const title = document.createElement("strong");
      title.textContent = `@${r.username}`;
      const resultBadge = renderUserBadge(r);
      if (resultBadge) title.appendChild(resultBadge);
      const sub = document.createElement("small");
      sub.textContent = [r.displayName, r.isFriend ? "Friend" : r.isFollowing ? "Following" : ""].filter(Boolean).join(" · ") || "HYSA user";
      copy.appendChild(title);
      copy.appendChild(sub);
      row.appendChild(copy);
      left.appendChild(row);
      right.textContent = r.isFriend ? "Friend" : r.isPrivate ? "Private" : "";
    }
    item.appendChild(left);
    item.appendChild(right);
    on(item, "click", () => {
      el.searchResults.hidden = true;
      if (el.searchInput) el.searchInput.value = "";
      if (r.type === "post") location.hash = `#p/${encodeURIComponent(r.id)}`;
      else location.hash = `#u/${encodeURIComponent(r.key)}`;
    });
    el.searchResults.appendChild(item);
  }
}

let composeMedia = [];
let composeUploading = 0;

function updateComposeCount() {
  const len = el.composeText ? el.composeText.value.length : 0;
  if (el.composeCount) el.composeCount.textContent = `${len}/280`;
  updateComposeSendState();
}

function updateComposeSendState() {
  if (!el.composeSend) return;
  const hasText = !!String(el.composeText?.value || "").trim();
  const hasReadyMedia = composeMedia.some((m) => m && !m.uploading && isFullMediaUrl(m.url));
  el.composeSend.disabled = composeUploading > 0 || (!hasText && !hasReadyMedia);
}

function renderComposeMedia() {
  if (!el.composeMedia) return;
  el.composeMedia.textContent = "";
  if (!composeMedia.length) {
    el.composeMedia.hidden = true;
    return;
  }
  el.composeMedia.hidden = false;
  const grid = document.createElement("div");
  grid.className = "mediaGrid composePreviewGrid";
  for (const item of composeMedia) {
    const tile = document.createElement("div");
    tile.className = `mediaItem ${item.uploading ? "uploading" : ""}`.trim();
    if (item.kind === "video") tile.appendChild(customVideoPlayer(item.previewUrl || item.url, { muted: true, poster: item.thumbnailUrl || "" }));
    else if (item.kind === "audio") tile.appendChild(customAudioPlayer(item.previewUrl || item.url, { compact: true }));
    else {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.decoding = "async";
      img.src = item.previewUrl || item.url;
      tile.appendChild(img);
    }
    if (item.uploading) {
      const badge = document.createElement("div");
      badge.className = "uploadBadge";
      badge.textContent = "Uploading...";
      tile.appendChild(badge);
    }
    const rm = document.createElement("button");
    rm.type = "button";
    rm.className = "mediaRemove";
    rm.textContent = "X";
    on(rm, "click", () => {
      if (item.previewUrl && item.previewUrl.startsWith("blob:")) URL.revokeObjectURL(item.previewUrl);
      composeMedia = composeMedia.filter((m) => m.localId !== item.localId);
      renderComposeMedia();
      updateComposeSendState();
    });
    tile.appendChild(rm);
    grid.appendChild(tile);
  }
  el.composeMedia.appendChild(grid);
  updateComposeSendState();
}

function showOverlay(overlay) {
  if (!overlay) return;
  overlay.hidden = false;
  const modal = overlay.querySelector(".modal");
  try {
    overlay.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 160, easing: "ease-out" });
  } catch {
    // ignore
  }
  try {
    if (modal) {
      modal.animate(
        [
          { opacity: 0, transform: "translateY(14px) scale(0.98)", filter: "blur(6px)" },
          { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0px)" },
        ],
        { duration: 220, easing: "cubic-bezier(0.2, 0.9, 0.2, 1)" },
      );
    }
  } catch {
    // ignore
  }
}

function hideOverlay(overlay) {
  if (!overlay || overlay.hidden) return;
  const modal = overlay.querySelector(".modal");
  let a1 = null;
  let a2 = null;
  try {
    a1 = overlay.animate([{ opacity: 1 }, { opacity: 0 }], { duration: 160, easing: "ease-in" });
  } catch {
    // ignore
  }
  try {
    if (modal) {
      a2 = modal.animate(
        [
          { opacity: 1, transform: "translateY(0) scale(1)", filter: "blur(0px)" },
          { opacity: 0, transform: "translateY(14px) scale(0.98)", filter: "blur(6px)" },
        ],
        { duration: 200, easing: "cubic-bezier(0.2, 0.9, 0.2, 1)" },
      );
    }
  } catch {
    // ignore
  }
  Promise.allSettled([a1?.finished, a2?.finished].filter(Boolean)).finally(() => {
    overlay.hidden = true;
  });
}

function resetCompose() {
  setMsg(el.composeMsg, "");
  if (el.composeText) el.composeText.value = "";
  if (el.composeVisibility) el.composeVisibility.value = "public";
  composeMedia = [];
  composeUploading = 0;
  updateComposeCount();
  renderComposeMedia();
  updateComposeSendState();
}

function openCompose() {
  if (!el.composeModal) return;
  resetCompose();
  showOverlay(el.composeModal);
  window.setTimeout(() => {
    if (el.composeText) el.composeText.focus();
  }, 0);
}

function closeCompose() {
  hideOverlay(el.composeModal);
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("READ_FAILED"));
    reader.readAsDataURL(file);
  });
}

async function compressedImageDataUrl(file) {
  if (!file || !/^image\//.test(file.type) || /gif$/i.test(file.type)) {
    return readFileAsDataUrl(file);
  }
  if (!("createImageBitmap" in window)) return readFileAsDataUrl(file);
  let bitmap = null;
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: "from-image" });
    const maxSide = 1600;
    const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
    const width = Math.max(1, Math.round(bitmap.width * scale));
    const height = Math.max(1, Math.round(bitmap.height * scale));
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { alpha: false });
    if (!ctx) return readFileAsDataUrl(file);
    ctx.drawImage(bitmap, 0, 0, width, height);
    const mime = file.type === "image/png" ? "image/png" : "image/jpeg";
    const quality = mime === "image/png" ? undefined : 0.82;
    const dataUrl = canvas.toDataURL(mime, quality);
    return dataUrl.length < file.size * 1.45 ? dataUrl : readFileAsDataUrl(file);
  } catch {
    return readFileAsDataUrl(file);
  } finally {
    if (bitmap && typeof bitmap.close === "function") bitmap.close();
  }
}

async function uploadFile(file) {
  if (!file) throw new Error("UPLOAD_INVALID");
  const maxBytes = 25 * 1024 * 1024;
  if (file.size > maxBytes) throw new Error("FILE_TOO_LARGE");
  if (!/^image\//.test(file.type) && !/^video\//.test(file.type) && !/^audio\//.test(file.type)) throw new Error("INVALID_FILE");

  const dataUrl = /^image\//.test(file.type) ? await compressedImageDataUrl(file) : await readFileAsDataUrl(file);
  let r;
  const controller = "AbortController" in window ? new AbortController() : null;
  const timeout = window.setTimeout(() => controller?.abort(), 45000);
  try {
    r = await api("/api/upload", { method: "POST", body: JSON.stringify({ dataUrl }), signal: controller?.signal });
  } catch (err) {
    const code = String(err?.message || "");
    if (code === "NOT_FOUND" || code === "HTTP_404") throw new Error("UPLOAD_ENDPOINT_MISSING");
    if (err?.name === "AbortError" || code === "NETWORK") throw new Error("UPLOAD_TIMEOUT");
    throw err;
  } finally {
    window.clearTimeout(timeout);
  }
  if (!r?.media?.url || !r.media.kind || !r.media.mime) throw new Error("UPLOAD_INVALID");
  return r.media;
}

async function handleComposeFiles(files) {
  const list = Array.from(files || []);
  if (!list.length) return;

  const maxItems = 4;
  const remaining = maxItems - composeMedia.length;
  if (remaining <= 0) {
    showToast(t("tooManyMedia"), true);
    return;
  }

  const slice = list.slice(0, remaining);
  composeUploading += slice.length;
  updateComposeSendState();
  setMsg(el.composeMsg, t("uploadProgress"));

  for (const f of slice) {
    const localId = `${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const kind = /^video\//.test(f.type) ? "video" : /^audio\//.test(f.type) ? "audio" : "image";
    const previewUrl = URL.createObjectURL(f);
    composeMedia.push({ localId, previewUrl, url: previewUrl, kind, mime: f.type, uploading: true });
    renderComposeMedia();
    try {
      const media = await uploadFile(f);
      if (media) {
        composeMedia = composeMedia.map((m) => m.localId === localId ? { ...media, localId, previewUrl, uploading: false } : m);
        renderComposeMedia();
      }
    } catch (err) {
      composeMedia = composeMedia.filter((m) => m.localId !== localId);
      URL.revokeObjectURL(previewUrl);
      const code = String(err?.message || "");
      if (code === "FILE_TOO_LARGE") showToast(t("fileTooLarge"), true);
      else if (code === "INVALID_FILE") showToast(t("invalidFile"), true);
      else showToast(humanizeError(code, t("error_upload_invalid")), true);
      renderComposeMedia();
    } finally {
      composeUploading -= 1;
      updateComposeSendState();
    }
  }

  setMsg(el.composeMsg, "");
  updateComposeSendState();
}

let pendingAvatarUrl = null;

function ensureProfileEditFields() {
  if (el.profilePrivate && el.profileSkills) return;
  const modal = el.profileModal?.querySelector(".modal");
  if (!modal || !el.profileSave) return;

  const usernameInput = document.createElement("input");
  usernameInput.type = "text";
  usernameInput.id = "profileUsername";
  usernameInput.placeholder = "Username";
  usernameInput.maxLength = 50;

  const displayNameInput = document.createElement("input");
  displayNameInput.type = "text";
  displayNameInput.id = "profileDisplayName";
  displayNameInput.placeholder = "Display name";
  displayNameInput.maxLength = 80;

  const emailInput = document.createElement("input");
  emailInput.type = "email";
  emailInput.id = "profileEmail";
  emailInput.placeholder = "Email";
  emailInput.maxLength = 160;

  modal.insertBefore(usernameInput, el.profileBio);
  modal.insertBefore(displayNameInput, el.profileBio);
  modal.insertBefore(emailInput, el.profileBio);

  const privacyRow = document.createElement("label");
  privacyRow.className = "profileStats";
  privacyRow.style.justifyContent = "space-between";
  privacyRow.style.cursor = "pointer";
  const privacyText = document.createElement("span");
  privacyText.textContent = "Private profile";
  const privacyInput = document.createElement("input");
  privacyInput.type = "checkbox";
  privacyInput.id = "profilePrivate";
  privacyRow.appendChild(privacyText);
  privacyRow.appendChild(privacyInput);

  const skillsInput = document.createElement("input");
  skillsInput.type = "text";
  skillsInput.id = "profileSkills";
  skillsInput.placeholder = "Skills, comma separated";
  skillsInput.maxLength = 240;

  modal.insertBefore(privacyRow, el.profileSave);
  modal.insertBefore(skillsInput, el.profileSave);
  el.profileUsername = usernameInput;
  el.profileDisplayName = displayNameInput;
  el.profileEmail = emailInput;
  el.profilePrivate = privacyInput;
  el.profileSkills = skillsInput;
}

function openProfileEdit() {
  if (!me || !el.profileModal) return;
  ensureProfileEditFields();
  pendingAvatarUrl = me.avatarUrl || "";
  setAvatarPreview(pendingAvatarUrl);
  if (el.profileUsername) el.profileUsername.value = me.username || "";
  if (el.profileDisplayName) el.profileDisplayName.value = me.displayName || "";
  if (el.profileEmail) el.profileEmail.value = me.email || "";
  if (el.profileBio) el.profileBio.value = me.bio || "";
  if (el.profilePrivate) el.profilePrivate.checked = !!me.isPrivate;
  if (el.profileSkills) el.profileSkills.value = Array.isArray(me.skills) ? me.skills.join(", ") : "";
  setMsg(el.profileMsg, "");
  showOverlay(el.profileModal);
}

function closeProfileEdit() {
  hideOverlay(el.profileModal);
}

async function openInsights() {
  if (!me || !el.insightsModal) return;
  setMsg(el.insightsMsg, "");
  showOverlay(el.insightsModal);
  if (el.insightsPosts) el.insightsPosts.textContent = "…";
  if (el.insightsViews) el.insightsViews.textContent = "…";
  if (el.insightsLikes) el.insightsLikes.textContent = "…";
  if (el.insightsSaves) el.insightsSaves.textContent = "…";
  try {
    const r = await api("/api/insights", { method: "GET" });
    const ins = r.insights || {};
    if (el.insightsPosts) el.insightsPosts.textContent = String(ins.posts ?? 0);
    if (el.insightsViews) el.insightsViews.textContent = String(ins.views ?? 0);
    if (el.insightsLikes) el.insightsLikes.textContent = String(ins.likes ?? 0);
    if (el.insightsSaves) el.insightsSaves.textContent = String(ins.saves ?? 0);
  } catch (err) {
    setMsg(el.insightsMsg, humanizeError(err?.message), true);
    if (el.insightsPosts) el.insightsPosts.textContent = "0";
    if (el.insightsViews) el.insightsViews.textContent = "0";
    if (el.insightsLikes) el.insightsLikes.textContent = "0";
    if (el.insightsSaves) el.insightsSaves.textContent = "0";
  }
}

function closeInsights() {
  hideOverlay(el.insightsModal);
}

let reportTargetPostId = null;
function openReport(postId) {
  reportTargetPostId = postId;
  if (el.reportReason) el.reportReason.value = "spam";
  if (el.reportNote) el.reportNote.value = "";
  setMsg(el.reportMsg, "");
  showOverlay(el.reportModal);
}

function closeReport() {
  hideOverlay(el.reportModal);
  reportTargetPostId = null;
}

function bindOverlayClose(overlay, onClose) {
  if (!overlay) return;
  on(overlay, "click", (e) => {
    if (e.target === overlay) onClose();
  });
}

let settingsScrollY = 0;
function lockSettingsPageScroll() {
  if (document.body.classList.contains("settings-open")) return;
  settingsScrollY = window.scrollY || document.documentElement.scrollTop || 0;
  document.body.style.top = `-${settingsScrollY}px`;
  document.body.classList.add("settings-open");
}

function unlockSettingsPageScroll() {
  if (!document.body.classList.contains("settings-open")) return;
  document.body.classList.remove("settings-open");
  document.body.style.top = "";
  window.scrollTo(0, settingsScrollY);
}

function hideSettingsPanel() {
  if (el.settingsView) el.settingsView.hidden = true;
  unlockSettingsPageScroll();
}

function closeSettings() {
  hideSettingsPanel();
}

function ensureSettingsSections() {
  const body = el.settingsView?.querySelector(".settings-body");
  if (!body || body.dataset.completedSections === "true") return;

  const clickableSections = [
    { title: "👥 الأصدقاء", desc: "قائمة أصدقائك وطلبات المتابعة والمقترحون", action: () => { closeSettings(); openFriendsPanel(); } },
    { title: "🔖 المحفوظات", desc: "المنشورات التي حفظتها", action: () => { closeSettings(); openSavedPosts(); } },
    { title: "📊 الإحصائيات", desc: "تحليلات منشوراتك ومتابعيك", action: () => { closeSettings(); openAnalyticsDashboard(); } },
    { title: "🔒 مركز الأمان", desc: "تغيير كلمة المرور، الجلسات، التحقق بخطوتين", action: () => { closeSettings(); openSecurityCenter(); } },
    { title: "🌰 بلوطة AI", desc: "مساعدك الذكي لكتابة الكابشنات والهاشتاقات", action: () => { closeSettings(); if (el.aiFab) el.aiFab.click(); } },
    { title: "About HYSA", desc: "الإصدار 2.0 · Arabic-first social platform", action: null },
  ];

  for (const { title, desc, action } of clickableSections) {
    const section = document.createElement("div");
    section.className = "settings-section";
    const opt = document.createElement("div");
    opt.className = "settings-option";
    opt.style.cursor = "pointer";
    opt.tabIndex = 0;
    opt.setAttribute("role", "button");
    const info = document.createElement("div");
    info.className = "settings-option-info";
    const labelEl = document.createElement("span");
    labelEl.className = "settings-option-label";
    labelEl.textContent = title;
    const descEl = document.createElement("span");
    descEl.className = "settings-option-desc muted";
    descEl.textContent = desc;
    info.appendChild(labelEl);
    info.appendChild(descEl);
    opt.appendChild(info);
    if (action) {
      const arrow = document.createElement("span");
      arrow.textContent = "›";
      arrow.style.cssText = "font-size:20px;opacity:0.5;margin-inline-start:auto";
      opt.appendChild(arrow);
      on(opt, "click", () => {
        try {
          action();
        } catch (err) {
          console.warn("Settings action unavailable:", labelEl.textContent, err);
          showToast(`${labelEl.textContent || "This feature"} is coming soon.`);
        }
      });
    } else {
      on(opt, "click", () => showToast(`${labelEl.textContent || "This feature"} is coming soon.`));
    }
    on(opt, "keydown", (e) => {
      if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        opt.click();
      }
    });
    section.appendChild(opt);
    body.appendChild(section);
  }
  body.dataset.completedSections = "true";
}

function ensureMediaPicker() {
  if (el.mediaPicker) return;
  const overlay = document.createElement("div");
  overlay.id = "mediaPicker";
  overlay.className = "mediaPickerOverlay";
  overlay.hidden = true;
  overlay.innerHTML = `
    <section class="mediaPickerSheet glass" role="dialog" aria-modal="true" aria-label="Choose media">
      <div class="sheet-handle"></div>
      <h3>Choose media</h3>
      <div class="mediaPickerGrid">
        <button type="button" data-media-choice="camera">${icon("image")}<span>Camera</span></button>
        <button type="button" data-media-choice="gallery">${icon("image")}<span>Gallery</span></button>
        <button type="button" data-media-choice="video">${icon("video")}<span>Video</span></button>
        <button type="button" data-media-choice="files">${icon("plus")}<span>Files</span></button>
      </div>
      <button id="mediaPickerCancel" class="sheet-cancel" type="button">Cancel</button>
    </section>
  `;
  document.body.appendChild(overlay);
  el.mediaPicker = overlay;
  el.mediaPickerCancel = overlay.querySelector("#mediaPickerCancel");
  on(el.mediaPickerCancel, "click", closeMediaPicker);
  bindOverlayClose(overlay, closeMediaPicker);
  for (const btn of overlay.querySelectorAll("[data-media-choice]")) {
    on(btn, "click", () => chooseMediaSource(btn.getAttribute("data-media-choice") || "gallery"));
  }
}

function inputForMediaTarget(target) {
  if (target === "story") return ensureStoryFileInput();
  if (target === "dm") return el.dmFiles;
  if (target === "avatar") return el.avatarFile;
  return el.composeFiles;
}

function openMediaPicker(target) {
  ensureMediaPicker();
  mediaPickerTarget = target || "post";
  if (el.mediaPicker) {
    el.mediaPicker.hidden = false;
    window.requestAnimationFrame(() => el.mediaPicker.classList.add("show"));
  }
}

function closeMediaPicker() {
  if (!el.mediaPicker) return;
  el.mediaPicker.classList.remove("show");
  window.setTimeout(() => {
    if (el.mediaPicker) el.mediaPicker.hidden = true;
  }, 180);
}

function chooseMediaSource(choice) {
  const input = inputForMediaTarget(mediaPickerTarget);
  if (!input) return closeMediaPicker();
  input.removeAttribute("capture");
  if (mediaPickerTarget === "avatar") {
    input.accept = "image/*";
  } else if (mediaPickerTarget === "story") {
    input.accept = choice === "video" ? "video/*" : choice === "files" ? "image/*,video/*" : "image/*,video/*";
  } else if (mediaPickerTarget === "dm") {
    input.accept = choice === "files" ? "image/*,video/*,audio/*" : choice === "video" ? "video/*" : "image/*,video/*,audio/*";
  } else {
    input.accept = choice === "files" ? "image/*,video/*,audio/*" : choice === "video" ? "video/*" : "image/*,video/*";
  }
  if (choice === "camera") input.setAttribute("capture", "environment");
  if (choice === "video") input.setAttribute("capture", "environment");
  closeMediaPicker();
  window.setTimeout(() => input.click(), 40);
}

function ensureAiAssistant() {
  if (el.aiFab) return;
  const fab = document.createElement("button");
  fab.id = "aiFab";
  fab.type = "button";
  fab.className = "aiFab baloota";
  fab.setAttribute("aria-label", "بلوطة - مساعدك الذكي");
  fab.title = "بلوطة 🌰";
  fab.textContent = "🌰";

  const panel = document.createElement("section");
  panel.id = "aiPanel";
  panel.className = "aiPanel glass";
  panel.hidden = true;
  panel.innerHTML = `
    <header class="aiHeader baloota-header">
      <div class="aiHeaderInfo">
        <span class="aiBaloota-icon">🌰</span>
        <div>
          <strong>بلوطة</strong>
          <span class="aiSubtitle">مساعدك الذكي</span>
        </div>
      </div>
      <button id="aiClose" class="iconBtn" type="button" aria-label="Close">✕</button>
    </header>
    <div id="aiSuggested" class="aiSuggested">
      <button type="button" class="aiSuggestBtn" data-prompt="اكتب كابشن لصورة 📸">اكتب كابشن لصورة 📸</button>
      <button type="button" class="aiSuggestBtn" data-prompt="اقترح هاشتاقات ✈️">اقترح هاشتاقات ✈️</button>
      <button type="button" class="aiSuggestBtn" data-prompt="اكتب بايو احترافي">اكتب بايو احترافي</button>
      <button type="button" class="aiSuggestBtn" data-prompt="Write a funny caption">Write a funny caption</button>
    </div>
    <div id="aiMessages" class="aiMessages"></div>
    <form id="aiForm" class="aiForm">
      <input id="aiPrompt" type="text" maxlength="1000" autocomplete="off" placeholder="اسألني أي شيء... 🌰" dir="auto">
      <button id="aiSend" class="btn primary sm" type="submit">إرسال</button>
    </form>
  `;
  document.body.appendChild(fab);
  document.body.appendChild(panel);

  el.aiFab = fab;
  el.aiPanel = panel;
  el.aiClose = panel.querySelector("#aiClose");
  el.aiSuggested = panel.querySelector("#aiSuggested");
  el.aiMessages = panel.querySelector("#aiMessages");
  el.aiForm = panel.querySelector("#aiForm");
  el.aiPrompt = panel.querySelector("#aiPrompt");
  el.aiSend = panel.querySelector("#aiSend");

  on(fab, "click", () => {
    if (!getToken()) return showAuth();
    panel.hidden = !panel.hidden;
    if (!panel.hidden && el.aiMessages && !el.aiMessages.children.length) {
      addAiMessage("assistant", "أهلاً! أنا بلوطة 🌰 مساعدك على HYSA. يمكنني مساعدتك في كتابة الكابشنات، الهاشتاقات، البايو، وأفكار المحتوى. اضغط على أحد الأزرار أو اكتب سؤالك!");
    }
    if (!panel.hidden && el.aiPrompt) el.aiPrompt.focus();
    if (el.aiSuggested) el.aiSuggested.hidden = !!(el.aiMessages && el.aiMessages.children.length > 0);
  });
  on(el.aiClose, "click", () => { panel.hidden = true; });

  for (const btn of panel.querySelectorAll(".aiSuggestBtn")) {
    on(btn, "click", () => {
      const prompt = btn.getAttribute("data-prompt") || "";
      if (el.aiPrompt) el.aiPrompt.value = prompt;
      if (el.aiSuggested) el.aiSuggested.hidden = true;
      sendAiPrompt(new Event("submit"));
    });
  }
  on(el.aiForm, "submit", (e) => {
    if (el.aiSuggested) el.aiSuggested.hidden = true;
    sendAiPrompt(e);
  });
}

function addAiMessage(role, text, mediaUrl = "") {
  if (!el.aiMessages) return;
  const item = document.createElement("div");
  item.className = `aiBubble ${role === "user" ? "user" : "assistant"}`;
  const copy = document.createElement("div");
  copy.textContent = text || "";
  item.appendChild(copy);
  if (mediaUrl) {
    const card = document.createElement("a");
    card.className = "aiMediaCard";
    card.href = mediaUrl;
    card.target = "_blank";
    card.rel = "noopener";
    card.textContent = "Open generated media";
    item.appendChild(card);
  }
  el.aiMessages.appendChild(item);
  el.aiMessages.scrollTop = el.aiMessages.scrollHeight;
}

function setAiTyping(show) {
  if (!el.aiMessages) return null;
  let node = el.aiMessages.querySelector(".aiTyping");
  if (!show) {
    if (node) node.remove();
    return null;
  }
  if (!node) {
    node = document.createElement("div");
    node.className = "aiBubble assistant aiTyping";
    node.innerHTML = "<span></span><span></span><span></span>";
    el.aiMessages.appendChild(node);
  }
  el.aiMessages.scrollTop = el.aiMessages.scrollHeight;
  return node;
}

async function sendAiPrompt(e) {
  e.preventDefault();
  const prompt = String(el.aiPrompt?.value || "").trim();
  if (!prompt) return;
  if (!getToken()) return showAuth();
  el.aiPrompt.value = "";
  addAiMessage("user", prompt);
  setAiTyping(true);
  if (el.aiSend) el.aiSend.disabled = true;
  try {
    const endpoint = aiMode === "image" ? "/api/ai/image" : aiMode === "video" ? "/api/ai/video" : "/api/ai/chat";
    const body = aiMode === "chat" ? { message: prompt } : { prompt };
    const r = await api(endpoint, { method: "POST", body: JSON.stringify(body) });
    setAiTyping(false);
    const text = r.reply || r.message || "AI is not configured yet.";
    addAiMessage("assistant", text, r.imageUrl || r.videoUrl || "");
  } catch (err) {
    setAiTyping(false);
    addAiMessage("assistant", humanizeError(err?.message, "AI could not respond right now."));
  } finally {
    if (el.aiSend) el.aiSend.disabled = false;
  }
}

// =============================================
// FEATURE 3 — FRIENDS SYSTEM UI
// =============================================

async function openFriendsPanel() {
  try {
    const [friendsR, suggestedR, requestsR] = await Promise.all([
      api("/api/friends"),
      api("/api/users/suggested"),
      api("/api/users/follow-requests"),
    ]);
    const friends = friendsR.friends || [];
    const suggested = suggestedR.suggested || [];
    const requests = requestsR.requests || [];

    showActionSheet("👥 الأصدقاء", (body) => {
      body.classList.add("friendsSheet");

      if (requests.length) {
        const rHeader = document.createElement("div");
        rHeader.className = "notifGroupHeader";
        rHeader.textContent = `طلبات المتابعة (${requests.length})`;
        body.appendChild(rHeader);
        for (const req of requests) {
          const row = document.createElement("div");
          row.className = "friendRow";
          const av = avatarNode(req.avatarUrl, req.username, "sm");
          const info = document.createElement("div");
          info.className = "friendInfo";
          info.innerHTML = `<strong>${req.displayName || req.username}</strong><small>@${req.username}</small>`;
          const acceptBtn = document.createElement("button");
          acceptBtn.type = "button";
          acceptBtn.className = "btn primary xs";
          acceptBtn.textContent = "قبول";
          const declineBtn = document.createElement("button");
          declineBtn.type = "button";
          declineBtn.className = "btn ghost xs";
          declineBtn.textContent = "رفض";
          on(acceptBtn, "click", async () => {
            await api(`/api/users/follow-requests/${encodeURIComponent(req.id)}/accept`, { method: "POST" });
            row.style.opacity = "0.4";
            showToast("تم قبول الطلب ✅");
          });
          on(declineBtn, "click", async () => {
            await api(`/api/users/follow-requests/${encodeURIComponent(req.id)}/decline`, { method: "POST" });
            row.remove();
          });
          const btns = document.createElement("div");
          btns.style.display = "flex";
          btns.style.gap = "6px";
          btns.appendChild(acceptBtn);
          btns.appendChild(declineBtn);
          row.appendChild(av);
          row.appendChild(info);
          row.appendChild(btns);
          body.appendChild(row);
        }
      }

      if (friends.length) {
        const fHeader = document.createElement("div");
        fHeader.className = "notifGroupHeader";
        fHeader.textContent = `أصدقاؤك (${friends.length})`;
        body.appendChild(fHeader);
        for (const f of friends) {
          const row = document.createElement("div");
          row.className = "friendRow";
          const av = avatarNode(f.avatarUrl, f.username, "sm");
          const info = document.createElement("div");
          info.className = "friendInfo";
          info.innerHTML = `<strong>${f.displayName || f.username}</strong> <span class="badge" style="font-size:10px">صديق</span><br><small>@${f.username}</small>`;
          on(row, "click", () => { hideActionSheet(); location.hash = `#u/${encodeURIComponent(f.userKey)}`; route(); });
          row.appendChild(av);
          row.appendChild(info);
          body.appendChild(row);
        }
      }

      if (suggested.length) {
        const sHeader = document.createElement("div");
        sHeader.className = "notifGroupHeader";
        sHeader.textContent = "أشخاص قد تعرفهم";
        body.appendChild(sHeader);
        for (const s of suggested) {
          const row = document.createElement("div");
          row.className = "friendRow";
          const av = avatarNode(s.avatarUrl, s.username, "sm");
          const info = document.createElement("div");
          info.className = "friendInfo";
          info.innerHTML = `<strong>${s.displayName || s.username}</strong><small>@${s.username}</small>`;
          const followBtn = document.createElement("button");
          followBtn.type = "button";
          followBtn.className = "btn ghost xs";
          followBtn.textContent = "متابعة";
          on(followBtn, "click", async () => {
            await api(`/api/follow/${encodeURIComponent(s.userKey)}`, { method: "POST" });
            followBtn.textContent = "تمت المتابعة ✓";
            followBtn.disabled = true;
          });
          row.appendChild(av);
          row.appendChild(info);
          row.appendChild(followBtn);
          body.appendChild(row);
        }
      }

      if (!friends.length && !suggested.length && !requests.length) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.style.cssText = "padding:24px;text-align:center";
        empty.textContent = "لا أصدقاء بعد — ابدأ بمتابعة أشخاص!";
        body.appendChild(empty);
      }
    });
  } catch (err) {
    showToast(humanizeError(err?.message), true);
  }
}

// =============================================
// FEATURE 4 — SECURITY CENTER UI
// =============================================

async function openSecurityCenter() {
  showActionSheet("🔒 مركز الأمان", async (body) => {
    body.classList.add("securitySheet");

    // Change Password
    const pwSection = document.createElement("div");
    pwSection.className = "securitySection";
    pwSection.innerHTML = `
      <h3 class="securityTitle">تغيير كلمة المرور</h3>
      <div class="securityForm">
        <input type="password" id="secOldPw" placeholder="كلمة المرور الحالية" class="input" autocomplete="current-password">
        <input type="password" id="secNewPw" placeholder="كلمة المرور الجديدة (٨ أحرف+)" class="input" autocomplete="new-password">
        <div id="pwStrengthBar" class="pwStrengthBar"><div id="pwStrengthFill" class="pwStrengthFill"></div></div>
        <button type="button" id="secChangePwBtn" class="btn primary" style="width:100%">تغيير كلمة المرور</button>
        <div id="secPwMsg" class="formMsg"></div>
      </div>
    `;
    body.appendChild(pwSection);

    const newPwInput = pwSection.querySelector("#secNewPw");
    const fill = pwSection.querySelector("#pwStrengthFill");
    on(newPwInput, "input", () => {
      const v = newPwInput.value;
      let score = 0;
      if (v.length >= 8) score++;
      if (/[A-Z]/.test(v)) score++;
      if (/[0-9]/.test(v)) score++;
      if (/[^A-Za-z0-9]/.test(v)) score++;
      const pct = [0, 25, 50, 75, 100][score];
      const color = ["#e74c3c", "#e74c3c", "#f39c12", "#27ae60", "#27ae60"][score];
      fill.style.width = pct + "%";
      fill.style.background = color;
    });
    on(pwSection.querySelector("#secChangePwBtn"), "click", async () => {
      const oldPw = pwSection.querySelector("#secOldPw").value;
      const newPw = newPwInput.value;
      const msg = pwSection.querySelector("#secPwMsg");
      try {
        await api("/api/auth/change-password", { method: "POST", body: JSON.stringify({ oldPassword: oldPw, newPassword: newPw }) });
        msg.textContent = "تم تغيير كلمة المرور بنجاح ✅";
        msg.style.color = "var(--green)";
        pwSection.querySelector("#secOldPw").value = "";
        newPwInput.value = "";
      } catch (err) {
        msg.textContent = humanizeError(err?.message);
        msg.style.color = "var(--red)";
      }
    });

    // Privacy Toggle
    const privSection = document.createElement("div");
    privSection.className = "securitySection";
    const isPrivate = !!(me && me.isPrivate);
    privSection.innerHTML = `
      <h3 class="securityTitle">خصوصية الحساب</h3>
      <div class="securityOption">
        <div>
          <div>حساب خاص</div>
          <small class="muted">يتطلب موافقتك قبل المتابعة</small>
        </div>
        <label class="toggleSwitch">
          <input type="checkbox" id="privacyToggle" ${isPrivate ? "checked" : ""}>
          <span class="toggleSlider"></span>
        </label>
      </div>
    `;
    body.appendChild(privSection);
    on(privSection.querySelector("#privacyToggle"), "change", async (e) => {
      await api("/api/users/privacy", { method: "PATCH", body: JSON.stringify({ isPrivate: e.target.checked }) });
      if (me) me.isPrivate = e.target.checked;
      showToast(e.target.checked ? "الحساب الآن خاص 🔒" : "الحساب الآن عام 🌐");
    });

    // Login History
    const histSection = document.createElement("div");
    histSection.className = "securitySection";
    histSection.innerHTML = `<h3 class="securityTitle">سجل تسجيل الدخول</h3><div id="loginHistList" class="loginHistList"><div class="muted" style="padding:8px">جاري التحميل...</div></div>`;
    body.appendChild(histSection);

    try {
      const r = await api("/api/auth/login-history");
      const list = histSection.querySelector("#loginHistList");
      list.textContent = "";
      if (!r.history || !r.history.length) {
        list.innerHTML = `<div class="muted" style="padding:8px">لا يوجد سجل بعد</div>`;
      } else {
        for (const h of r.history.slice(0, 10)) {
          const item = document.createElement("div");
          item.className = "loginHistItem";
          item.style.borderRight = `3px solid ${h.status === "success" ? "var(--green, #27ae60)" : "var(--red, #e74c3c)"}`;
          item.innerHTML = `<span style="font-size:12px">${h.ip || "Unknown IP"} · ${String(h.device || "").slice(0, 30)}</span><small class="muted">${fmtTime(h.created_at)}</small>`;
          list.appendChild(item);
        }
      }
    } catch {}

    // Active Sessions
    const sessSection = document.createElement("div");
    sessSection.className = "securitySection";
    sessSection.innerHTML = `<h3 class="securityTitle">الجلسات النشطة</h3><div id="sessListEl" class="loginHistList"><div class="muted" style="padding:8px">جاري التحميل...</div></div>`;
    body.appendChild(sessSection);
    const logAllBtn = sheetButton("تسجيل الخروج من كل الجلسات", "ghost");
    on(logAllBtn, "click", async () => {
      await api("/api/auth/sessions", { method: "DELETE" });
      showToast("تم تسجيل الخروج من جميع الجلسات");
    });
    body.appendChild(logAllBtn);

    try {
      const sr = await api("/api/auth/sessions");
      const sl = sessSection.querySelector("#sessListEl");
      sl.textContent = "";
      if (!sr.sessions || !sr.sessions.length) {
        sl.innerHTML = `<div class="muted" style="padding:8px">لا جلسات نشطة محفوظة</div>`;
      } else {
        for (const s of sr.sessions.slice(0, 5)) {
          const item = document.createElement("div");
          item.className = "loginHistItem";
          item.innerHTML = `<span style="font-size:12px">${s.ip || "?"} · ${String(s.device || "").slice(0, 30)}</span><small class="muted">${fmtTime(s.last_active)}</small>`;
          const rmBtn = document.createElement("button");
          rmBtn.type = "button";
          rmBtn.className = "btn ghost xs";
          rmBtn.textContent = "إنهاء";
          on(rmBtn, "click", async () => { await api(`/api/auth/sessions/${encodeURIComponent(s.id)}`, { method: "DELETE" }); item.remove(); });
          item.appendChild(rmBtn);
          sl.appendChild(item);
        }
      }
    } catch {}
  });
}

// =============================================
// FEATURE 5 — POST ANALYTICS UI
// =============================================

async function openAnalyticsDashboard() {
  showActionSheet("📊 الإحصائيات", async (body) => {
    body.classList.add("analyticsSheet");

    const loadingEl = document.createElement("div");
    loadingEl.className = "muted";
    loadingEl.style.padding = "20px";
    loadingEl.textContent = "جاري تحميل الإحصائيات...";
    body.appendChild(loadingEl);

    try {
      const r = await api("/api/users/analytics");
      const a = r.analytics || {};
      loadingEl.remove();

      const statsGrid = document.createElement("div");
      statsGrid.className = "analyticsGrid";
      const stats = [
        { label: "المشاهدات", value: a.totalViews || 0, icon: "👁️" },
        { label: "الإعجابات", value: a.totalLikes || 0, icon: "❤️" },
        { label: "المتابعون", value: a.followerCount || 0, icon: "👥" },
        { label: "المشاركات", value: a.totalBookmarks || 0, icon: "🔖" },
        { label: "المنشورات", value: a.totalPosts || 0, icon: "📝" },
        { label: "التفاعل %", value: (a.engagement || 0) + "%", icon: "📈" },
      ];
      for (const s of stats) {
        const card = document.createElement("div");
        card.className = "analyticsCard";
        card.innerHTML = `<span class="analyticsIcon">${s.icon}</span><strong class="analyticsVal">${s.value}</strong><span class="analyticslabel">${s.label}</span>`;
        statsGrid.appendChild(card);
      }
      body.appendChild(statsGrid);

      if (a.bestPost) {
        const bestSection = document.createElement("div");
        bestSection.className = "securitySection";
        bestSection.innerHTML = `
          <h3 class="securityTitle">⭐ أفضل منشور</h3>
          <div class="analyticsCard" style="width:100%;text-align:right">
            <p style="margin:0;font-size:14px">${String(a.bestPost.text || "").slice(0, 100) || "(بدون نص)"}</p>
            <small class="muted">❤️ ${a.bestPost.likes} · 👁️ ${a.bestPost.views}</small>
          </div>
        `;
        on(bestSection.querySelector(".analyticsCard"), "click", () => {
          hideActionSheet();
          location.hash = `#p/${encodeURIComponent(a.bestPost.id)}`;
        });
        body.appendChild(bestSection);
      }

      const tipSection = document.createElement("div");
      tipSection.className = "securitySection";
      tipSection.innerHTML = `
        <h3 class="securityTitle">💡 أفضل وقت للنشر</h3>
        <div class="muted" style="font-size:13px;line-height:1.5">
          بناءً على التحليلات: أفضل وقت للنشر هو <strong>مساءً بين ٧–١٠ م</strong> عندما يكون معظم المتابعين نشطين.
        </div>
      `;
      body.appendChild(tipSection);

    } catch (err) {
      loadingEl.textContent = humanizeError(err?.message);
    }
  });
}

// =============================================
// FEATURE 6 — CONTENT FEATURES UI
// =============================================

async function openSavedPosts() {
  showActionSheet("🔖 المحفوظات", async (body) => {
    body.classList.add("savedSheet");
    const loadEl = document.createElement("div");
    loadEl.className = "muted";
    loadEl.style.padding = "20px";
    loadEl.textContent = "جاري التحميل...";
    body.appendChild(loadEl);
    try {
      const r = await api("/api/users/saved");
      loadEl.remove();
      const posts = r.posts || [];
      if (!posts.length) {
        const e = document.createElement("div");
        e.className = "muted";
        e.style.cssText = "padding:24px;text-align:center";
        e.textContent = "لا منشورات محفوظة بعد 🔖";
        body.appendChild(e);
        return;
      }
      for (const p of posts) {
        const row = document.createElement("div");
        row.className = "savedPostRow";
        const textEl = document.createElement("div");
        textEl.style.flex = "1";
        textEl.innerHTML = `<div style="font-size:14px;line-height:1.4">${String(p.text || "").slice(0, 80) || "(صورة/فيديو)"}</div><small class="muted">@${p.author || p.authorKey} · ${fmtTime(p.createdAt)}</small>`;
        row.appendChild(textEl);
        on(row, "click", () => { hideActionSheet(); location.hash = `#p/${encodeURIComponent(p.id)}`; route(); });
        body.appendChild(row);
      }
    } catch (err) {
      loadEl.textContent = humanizeError(err?.message);
    }
  });
}

async function openHighlights(userKey) {
  try {
    const r = await api(`/api/highlights/${encodeURIComponent(userKey)}`);
    const highlights = r.highlights || [];
    showActionSheet("✨ الهايلايتس", (body) => {
      body.classList.add("highlightsSheet");
      const grid = document.createElement("div");
      grid.className = "highlightsGrid";
      for (const h of highlights) {
        const item = document.createElement("div");
        item.className = "highlightItem";
        const cover = document.createElement("div");
        cover.className = "highlightCover";
        if (h.cover) cover.style.backgroundImage = `url(${h.cover})`;
        else cover.textContent = "✨";
        const label = document.createElement("span");
        label.textContent = h.title;
        item.appendChild(cover);
        item.appendChild(label);
        grid.appendChild(item);
      }
      if (!highlights.length) {
        grid.innerHTML = `<div class="muted" style="padding:20px;text-align:center">لا توجد هايلايتس بعد</div>`;
      }
      body.appendChild(grid);

      if (me && me.userKey === userKey) {
        const createBtn = sheetButton("+ إنشاء هايلايت", "primary");
        on(createBtn, "click", async () => {
          const title = prompt("اسم الهايلايت:");
          if (!title) return;
          await api("/api/highlights", { method: "POST", body: JSON.stringify({ title }) });
          showToast("تم إنشاء الهايلايت ✅");
          hideActionSheet();
        });
        body.appendChild(createBtn);
      }
    });
  } catch (err) {
    showToast(humanizeError(err?.message), true);
  }
}

async function openPollForPost(postId) {
  try {
    const r = await api(`/api/posts/${encodeURIComponent(postId)}/poll`);
    const poll = r.poll;
    if (!poll) return showToast("لا يوجد استطلاع لهذا المنشور", true);

    showActionSheet(`📊 ${poll.question}`, (body) => {
      const options = Array.isArray(poll.options) ? poll.options : [];
      const votes = poll.votes || {};
      const totalVotes = Object.values(votes).length;
      const myvote = me ? votes[me.userKey] : undefined;
      const expired = !!poll.expired;

      for (let i = 0; i < options.length; i++) {
        const optVotes = Object.values(votes).filter(v => v === i).length;
        const pct = totalVotes > 0 ? Math.round((optVotes / totalVotes) * 100) : 0;
        const optRow = document.createElement("div");
        optRow.className = `pollOption ${myvote === i ? "voted" : ""}`;
        optRow.innerHTML = `
          <div class="pollBar" style="width:${myvote !== undefined || expired ? pct : 0}%"></div>
          <span class="pollLabel">${options[i]}</span>
          ${myvote !== undefined || expired ? `<span class="pollPct">${pct}%</span>` : ""}
        `;
        if (myvote === undefined && !expired) {
          on(optRow, "click", async () => {
            await api(`/api/posts/${encodeURIComponent(postId)}/poll/vote`, { method: "POST", body: JSON.stringify({ option: i }) });
            showToast("تم التصويت ✅");
            hideActionSheet();
          });
        }
        body.appendChild(optRow);
      }
      const meta = document.createElement("div");
      meta.className = "muted";
      meta.style.cssText = "text-align:center;padding:8px;font-size:12px";
      meta.textContent = `${totalVotes} تصويت${expired ? " · انتهى الاستطلاع" : ""}`;
      body.appendChild(meta);
    });
  } catch (err) {
    showToast(humanizeError(err?.message), true);
  }
}

async function boot() {
  el = {
    authView: document.getElementById("authView"),
    appView: document.getElementById("appView"),

    tabLogin: document.getElementById("tabLogin"),
    tabRegister: document.getElementById("tabRegister"),
    loginForm: document.getElementById("loginForm"),
    registerForm: document.getElementById("registerForm"),
    loginMsg: document.getElementById("loginMsg"),
    registerMsg: document.getElementById("registerMsg"),

    meBtn: document.getElementById("meBtn"),
    reelsBtn: document.getElementById("reelsBtn"),
    dmBtn: document.getElementById("dmBtn"),
    logoutBtn: document.getElementById("logoutBtn"),
    searchInput: document.getElementById("searchInput"),
    searchResults: document.getElementById("searchResults"),
    langSelect: document.getElementById("langSelect"),
    langToggle: document.getElementById("langToggle"),
    langMenu: document.getElementById("langMenu"),

    refreshBtn: document.getElementById("refreshBtn"),
    viewTitle: document.getElementById("viewTitle"),
    profileHeader: document.getElementById("profileHeader"),
    feed: document.getElementById("feed"),
    feedLoader: document.getElementById("feedLoader"),
    feedSentinel: document.getElementById("feedSentinel"),
    storiesBar: document.getElementById("storiesBar"),
    trendsBar: document.getElementById("trendsBar"),
    reelsView: document.getElementById("reelsView"),
    exploreView: document.getElementById("exploreView"),

    composeFab: document.getElementById("composeFab"),
    composeModal: document.getElementById("composeModal"),
    composeClose: document.getElementById("composeClose"),
    composeText: document.getElementById("composeText"),
    composeVisibility: document.getElementById("composeVisibility"),
    composeCount: document.getElementById("composeCount"),
    composeMsg: document.getElementById("composeMsg"),
    composeSend: document.getElementById("composeSend"),
    composeAddMedia: document.getElementById("composeAddMedia"),
    composeFiles: document.getElementById("composeFiles"),
    composeMedia: document.getElementById("composeMedia"),

    profileModal: document.getElementById("profileModal"),
    profileClose: document.getElementById("profileClose"),
    avatarPreview: document.getElementById("avatarPreview"),
    avatarFile: document.getElementById("avatarFile"),
    avatarPick: document.getElementById("avatarPick"),
    avatarRemove: document.getElementById("avatarRemove"),
    profileBio: document.getElementById("profileBio"),
    profileMsg: document.getElementById("profileMsg"),
    profileSave: document.getElementById("profileSave"),

    reportModal: document.getElementById("reportModal"),
    reportClose: document.getElementById("reportClose"),
    reportReason: document.getElementById("reportReason"),
    reportNote: document.getElementById("reportNote"),
    reportMsg: document.getElementById("reportMsg"),
    reportSend: document.getElementById("reportSend"),

    dmModal: document.getElementById("dmModal"),
    dmClose: document.getElementById("dmClose"),
    dmBack: document.getElementById("dmBack"),
    dmThreads: document.getElementById("dmThreads"),
    dmPeer: document.getElementById("dmPeer"),
    dmStatus: document.getElementById("dmStatus"),
    dmHeaderAvatar: document.getElementById("dmHeaderAvatar"),
    dmMessages: document.getElementById("dmMessages"),
    dmText: document.getElementById("dmText"),
    dmAttach: document.getElementById("dmAttach"),
    dmFiles: document.getElementById("dmFiles"),
    dmRecord: document.getElementById("dmRecord"),
    dmSend: document.getElementById("dmSend"),

    insightsModal: document.getElementById("insightsModal"),
    insightsClose: document.getElementById("insightsClose"),
    insightsPosts: document.getElementById("insightsPosts"),
    insightsViews: document.getElementById("insightsViews"),
    insightsLikes: document.getElementById("insightsLikes"),
    insightsSaves: document.getElementById("insightsSaves"),
    insightsMsg: document.getElementById("insightsMsg"),

    toast: document.getElementById("toast"),
    actionSheet: document.getElementById("actionSheet"),
    sheetTitle: document.getElementById("sheetTitle"),
    sheetBody: document.getElementById("sheetBody"),
    sheetCancel: document.getElementById("sheetCancel"),
    mobileNav: document.getElementById("mobileNav"),

    // Settings
    settingsView: document.getElementById("settingsView"),
    settingsBtn: document.getElementById("settingsBtn"),
    settingsClose: document.getElementById("settingsClose"),
    darkModeToggle: document.getElementById("darkModeToggle"),
    settingsLang: document.getElementById("settingsLang"),
    settingsPrivate: document.getElementById("settingsPrivate"),
    settingsEditProfile: document.getElementById("settingsEditProfile"),
    settingsInsights: document.getElementById("settingsInsights"),
    settingsLogout: document.getElementById("settingsLogout"),
    accentPicker: document.getElementById("accentPicker"),

    // Nav
    notifBtn: document.getElementById("notifBtn"),
    notifDot: document.getElementById("notifDot"),
    notifBadge: document.getElementById("notifBadge"),
    navAvatar: document.getElementById("navAvatar"),
    langToggleLabel: document.getElementById("langToggleLabel"),
    themeToggle: document.getElementById("themeToggle"),
    themeIconDark: document.getElementById("themeIconDark"),
    themeIconLight: document.getElementById("themeIconLight"),
    navDmBtn: document.getElementById("navDmBtn"),
  };

  applyI18n();
  switchAuthTab("login");
  ensureAiAssistant();
  ensureLowDataToggle();

  function applyLang(newLang) {
    if (!["ar", "en", "fr"].includes(newLang)) newLang = "ar";
    lang = newLang;
    localStorage.setItem(langKey, lang);
    applyI18n();
    if (el.langToggleLabel) el.langToggleLabel.textContent = lang.toUpperCase();
    if (el.settingsLang) el.settingsLang.value = lang;
    if (me) route();
  }

  if (el.langToggle && el.langMenu) {
    on(el.langToggle, "click", () => {
      const next = !el.langMenu.hidden;
      el.langMenu.hidden = next;
      el.langToggle.setAttribute("aria-expanded", String(!next));
    });
    for (const option of el.langMenu.querySelectorAll(".langOption")) {
      on(option, "click", () => {
        const value = option.getAttribute("data-lang") || "ar";
        applyLang(value);
        el.langMenu.hidden = true;
      });
    }
  }

  if (el.settingsLang) {
    el.settingsLang.value = lang;
    on(el.settingsLang, "change", () => {
      applyLang(el.settingsLang.value || "ar");
    });
  }

  if (location.protocol === "file:") {
    showAuth();
    const warn = t("error_file_origin");
    setMsg(el.loginMsg, warn, true);
    setMsg(el.registerMsg, warn, true);
  }

  on(el.tabLogin, "click", () => switchAuthTab("login"));
  on(el.tabRegister, "click", () => switchAuthTab("register"));
  ensureGoogleAuthButton();

  on(el.loginForm, "submit", async (e) => {
    e.preventDefault();
    setMsg(el.loginMsg, "");
    const fd = new FormData(el.loginForm);
    const username = String(fd.get("username") || "");
    const password = String(fd.get("password") || "");
    try {
      const r = await api("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
      saveToken(true);
      authFailureCount = 0;
      me = r.me;
      showApp();
      route();
    } catch (err) {
      setMsg(el.loginMsg, humanizeError(err?.message), true);
    }
  });

  on(el.registerForm, "submit", async (e) => {
    e.preventDefault();
    setMsg(el.registerMsg, "");
    const fd = new FormData(el.registerForm);
    const username = String(fd.get("username") || "");
    const password = String(fd.get("password") || "");
    try {
      const r = await api("/api/register", { method: "POST", body: JSON.stringify({ username, password }) });
      saveToken(true);
      authFailureCount = 0;
      me = r.me;
      showApp();
      route();
    } catch (err) {
      setMsg(el.registerMsg, humanizeError(err?.message), true);
    }
  });

  on(el.logoutBtn, "click", async () => {
    try {
      await api("/api/logout", { method: "POST" });
    } catch {
      // ignore
    }
    clearSession();
    showAuth();
  });

  if (el.dmBtn) {
    on(el.dmBtn, "click", () => {
      location.hash = "#dm";
    });
  }
  if (el.reelsBtn) {
    on(el.reelsBtn, "click", () => {
      location.hash = "#reels";
      route();
    });
  }
  on(el.dmClose, "click", () => closeDmView());
  on(el.dmBack, "click", () => {
    if (activeDmPeer) location.hash = "#dm";
    else {
      closeDmView();
      location.hash = "#home";
    }
  });
  on(el.dmAttach, "click", () => {
    if (el.dmFiles && activeDmPeer) openMediaPicker("dm");
  });
  on(el.dmFiles, "change", async () => {
    const files = Array.from(el.dmFiles?.files || []);
    if (el.dmFiles) el.dmFiles.value = "";
    if (!activeDmPeer || !files.length) return;
    const media = [];
    showToast(t("uploadProgress"));
    for (const file of files.slice(0, 4)) {
      try {
        media.push(await uploadFile(file));
      } catch (err) {
        showToast(humanizeError(err?.message, t("error_upload_invalid")), true);
      }
    }
    if (media.length) await sendDmMessage({ media });
  });
  if (el.dmSend) {
    on(el.dmSend, "click", () => {
      if (dmVoiceDraft && !String(el.dmText?.value || "").trim()) return sendDmVoiceDraft();
      return sendDmMessage({ text: el.dmText?.value || "" });
    });
  }
  on(el.dmText, "input", updateDmSendState);
  updateDmSendState();
  on(el.dmText, "keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    sendDmMessage({ text: el.dmText?.value || "" });
  });
  if (el.dmRecord) {
    on(el.dmRecord, "click", async () => {
      if (!activeDmPeer) return;
      if (dmVoiceDraft) {
        setDmRecordStatus("preview", formatDuration(dmVoiceDraft.duration));
        return;
      }
      if (dmRecorder && dmRecorder.state === "recording") {
        stopDmRecording();
        return;
      }
      try {
        await startDmRecording();
      } catch {
        showToast("Microphone permission was denied.", true);
      }
    });
  }

  const homeBrand = document.getElementById("homeBrand");
  const goHome = () => {
    if (!getToken()) return;
    location.hash = "#home";
    route();
  };
  if (homeBrand) {
    on(homeBrand, "click", () => goHome());
    on(homeBrand, "keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      goHome();
    });
  }

  on(el.meBtn, "click", () => {
    if (!me) return;
    location.hash = `#u/${encodeURIComponent(me.username.toLowerCase())}`;
  });

  if (el.mobileNav) {
    // Updated selector to match .nav-item used in index.html
    for (const btn of el.mobileNav.querySelectorAll(".nav-item")) {
      on(btn, "click", () => {
        pulseTap(btn);
        const nav = btn.getAttribute("data-nav");
        if (nav === "create") {
          openCompose();
          return;
        }
        for (const n of el.mobileNav.querySelectorAll(".nav-item")) n.classList.remove("active");
        btn.classList.add("active");
        if (nav === "home") location.hash = "#home";
        else if (nav === "search" && el.searchInput) el.searchInput.focus();
        else if (nav === "reels") location.hash = "#reels";
        else if (nav === "explore") location.hash = "#explore";
        else if (nav === "notifications") openNotificationsPanel();
        else if (nav === "profile" && me) location.hash = `#u/${encodeURIComponent(me.username.toLowerCase())}`;
        else if (nav === "aiChat") {
          if (el.aiFab) el.aiFab.click();
        }
      });
    }
  }

  on(el.refreshBtn, "click", () => route());
  ensureInfiniteFeed();

  on(el.composeFab, "click", () => openCompose());
  on(el.composeClose, "click", () => closeCompose());
  if (el.composeModal) bindOverlayClose(el.composeModal, () => closeCompose());
  on(el.composeText, "input", () => updateComposeCount());
  if (el.composeText) attachMentionAutocomplete(el.composeText);
  on(el.composeAddMedia, "click", () => {
    if (el.composeFiles) openMediaPicker("post");
  });
  on(el.composeFiles, "change", async () => {
    // Snapshot the FileList before clearing the input value.
    // Some browsers treat FileList as a live view, and clearing the input empties it.
    const files = Array.from(el.composeFiles.files || []);
    el.composeFiles.value = "";
    await handleComposeFiles(files);
  });

  on(el.composeSend, "click", async () => {
    setMsg(el.composeMsg, "");
    const text = String(el.composeText?.value || "");
    const hasText = !!text.trim();
    const readyMedia = composeMedia.filter((m) => m && !m.uploading && isFullMediaUrl(m.url)).map((m) => ({ url: m.url, kind: m.kind, mime: m.mime }));
    const hasMedia = readyMedia.length > 0;
    if (!hasText && !hasMedia) return setMsg(el.composeMsg, t("error_invalid_post"), true);
    if (composeUploading > 0) return setMsg(el.composeMsg, t("uploadProgress"), true);
    if (el.composeSend) el.composeSend.disabled = true;
    try {
      let visibility = el.composeVisibility ? String(el.composeVisibility.value || "public") : "public";
      if (visibility !== "public" && visibility !== "private") visibility = "public";
      await api("/api/posts", { method: "POST", body: JSON.stringify({ text, media: readyMedia, visibility }) });
      feedCache = { key: "", timestamp: 0, payload: null };
      closeCompose();
      showToast(t("postSent"));
      location.hash = "#home";
      await loadFeed({ reset: true });
    } catch (err) {
      setMsg(el.composeMsg, humanizeError(err?.message, t("error_invalid_post")), true);
    } finally {
      if (el.composeSend) el.composeSend.disabled = false;
    }
  });

  on(el.profileClose, "click", () => closeProfileEdit());
  bindOverlayClose(el.profileModal, () => closeProfileEdit());
  on(el.avatarPick, "click", () => {
    if (el.avatarFile) openMediaPicker("avatar");
  });
  on(el.avatarRemove, "click", () => {
    pendingAvatarUrl = "";
    setAvatarPreview("");
  });
  on(el.avatarFile, "change", async () => {
    const file = el.avatarFile?.files && el.avatarFile.files[0];
    if (el.avatarFile) el.avatarFile.value = "";
    if (!file) return;
    setMsg(el.profileMsg, t("uploadProgress"));
    if (el.profileSave) el.profileSave.disabled = true;
    try {
      const media = await uploadFile(file);
      if (media && media.kind === "image") {
        pendingAvatarUrl = media.url;
        setAvatarPreview(pendingAvatarUrl);
      } else {
        showToast(t("invalidFile"), true);
      }
      setMsg(el.profileMsg, "");
    } catch (err) {
      setMsg(el.profileMsg, humanizeError(err?.message, t("error_upload_invalid")), true);
    } finally {
      if (el.profileSave) el.profileSave.disabled = false;
    }
  });
  on(el.profileSave, "click", async () => {
    setMsg(el.profileMsg, "");
    if (el.profileSave) el.profileSave.disabled = true;
    try {
      const profileKeyBeforeSave = String(activeProfileKey || "").toLowerCase();
      const myKeysBeforeSave = [me?.userKey, me?.key, me?.username]
        .map((value) => String(value || "").toLowerCase())
        .filter(Boolean);
      const savingOwnProfile = !!profileKeyBeforeSave && myKeysBeforeSave.includes(profileKeyBeforeSave);
      const bio = String(el.profileBio?.value || "");
      const username = String(el.profileUsername?.value || "").trim();
      const displayName = String(el.profileDisplayName?.value || "").trim();
      const email = String(el.profileEmail?.value || "").trim();
      const skills = String(el.profileSkills?.value || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 20);
      const r = await api("/api/profile", {
        method: "POST",
        body: JSON.stringify({ username, displayName, email, bio, avatarUrl: pendingAvatarUrl, isPrivate: !!el.profilePrivate?.checked, skills }),
      });
      me = r.me;
      closeProfileEdit();
      showToast(t("saved"));
      if (savingOwnProfile && me?.username) {
        location.hash = `#u/${encodeURIComponent(me.username.toLowerCase())}`;
      } else if (activeProfileKey) {
        route();
      }
    } catch (err) {
      setMsg(el.profileMsg, humanizeError(err?.message), true);
    } finally {
      if (el.profileSave) el.profileSave.disabled = false;
    }
  });

  on(el.insightsClose, "click", () => closeInsights());
  bindOverlayClose(el.insightsModal, () => closeInsights());

  on(el.reportClose, "click", () => closeReport());
  bindOverlayClose(el.reportModal, () => closeReport());
  on(el.sheetCancel, "click", () => hideActionSheet());
  on(el.actionSheet, "click", (e) => {
    if (e.target === el.actionSheet) hideActionSheet();
  });
  on(el.reportSend, "click", async () => {
    setMsg(el.reportMsg, "");
    const reason = String(el.reportReason?.value || "");
    const note = String(el.reportNote?.value || "");
    if (!reportTargetPostId) return;
    if (el.reportSend) el.reportSend.disabled = true;
    try {
      await api("/api/report", {
        method: "POST",
        body: JSON.stringify({ type: "post", targetId: reportTargetPostId, reason, note }),
      });
      closeReport();
      showToast(t("reportSent"));
    } catch (err) {
      setMsg(el.reportMsg, humanizeError(err?.message), true);
    } finally {
      if (el.reportSend) el.reportSend.disabled = false;
    }
  });

  on(el.searchInput,
    "input",
    debounce(async () => {
      const q = el.searchInput ? el.searchInput.value.trim() : "";
      if (!q) return showSearchResults([]);
      try {
        if (el.searchResults) {
          el.searchResults.hidden = false;
          el.searchResults.innerHTML = '<div class="result empty">Searching...</div>';
        }
        const r = await api(`/api/search?q=${encodeURIComponent(q)}`, { method: "GET" });
        showSearchResults(r.results || []);
      } catch {
        showSearchResults([]);
      }
    }, 250),
  );

  on(window, "click", (e) => {
    const target = e.target;
    if (!target) return;
    if (
      el.searchResults &&
      el.searchInput &&
      !el.searchResults.hidden &&
      !el.searchResults.contains(target) &&
      !el.searchInput.contains(target)
    ) {
      el.searchResults.hidden = true;
    }
    if (el.langMenu && el.langToggle) {
      const inMenu = el.langMenu.contains(target) || el.langToggle.contains(target);
      if (!inMenu) el.langMenu.hidden = true;
    }
    if (openMenu) {
      const wrap = openMenu.parentElement;
      if (!wrap || !wrap.contains(target)) closeMenu();
    }
  });

  // =====================
  // SETTINGS PANEL
  // =====================
  function openSettings() {
    if (!el.settingsView) return;
    ensureSettingsSections();
    // Sync toggles to current state
    if (el.darkModeToggle) el.darkModeToggle.checked = (theme !== "light");
    if (el.settingsPrivate && me) el.settingsPrivate.checked = !!me.isPrivate;
    if (el.settingsLang) el.settingsLang.value = lang;
    el.settingsView.hidden = false;
    lockSettingsPageScroll();
    const settingsPanel = el.settingsView.querySelector(".settings-panel");
    if (settingsPanel) settingsPanel.scrollTop = 0;
  }
  function closeSettings() {
    hideSettingsPanel();
  }

  // Wire up the top-nav theme toggle button
  if (el.themeToggle) {
    on(el.themeToggle, "click", () => {
      setTheme(theme === "light" ? "dark" : "light");
      if (el.themeIconDark) el.themeIconDark.hidden = theme === "light";
      if (el.themeIconLight) el.themeIconLight.hidden = theme === "dark";
      if (el.darkModeToggle) el.darkModeToggle.checked = (theme !== "light");
    });
    // Initialize icon state
    if (el.themeIconDark) el.themeIconDark.hidden = theme === "light";
    if (el.themeIconLight) el.themeIconLight.hidden = theme === "dark";
  }

  if (el.settingsBtn) on(el.settingsBtn, "click", openSettings);
  if (el.settingsClose) on(el.settingsClose, "click", closeSettings);
  if (el.settingsView) {
    on(el.settingsView, "click", (e) => {
      if (e.target === el.settingsView) closeSettings();
    });
  }

  if (el.darkModeToggle) {
    el.darkModeToggle.checked = (theme !== "light");
    on(el.darkModeToggle, "change", () => {
      setTheme(el.darkModeToggle.checked ? "dark" : "light");
      // Sync the top-nav theme icon
      if (el.themeIconDark) el.themeIconDark.hidden = theme === "light";
      if (el.themeIconLight) el.themeIconLight.hidden = theme === "dark";
    });
  }

  if (el.accentPicker) {
    const savedAccent = localStorage.getItem("hysa_accent") || "blue";
    document.documentElement.setAttribute("data-accent", savedAccent);
    const swatches = el.accentPicker.querySelectorAll(".accent-swatch");
    for (const swatch of swatches) {
      if (swatch.dataset.accent === savedAccent) swatch.classList.add("active");
      on(swatch, "click", () => {
        const accent = swatch.dataset.accent || "blue";
        localStorage.setItem("hysa_accent", accent);
        document.documentElement.setAttribute("data-accent", accent);
        for (const s of swatches) s.classList.toggle("active", s.dataset.accent === accent);
      });
    }
  }

  if (el.settingsPrivate && me) {
    el.settingsPrivate.checked = !!me.isPrivate;
    on(el.settingsPrivate, "change", async () => {
      try {
        const r = await api("/api/profile", {
          method: "POST",
          body: JSON.stringify({ bio: me.bio || "", avatarUrl: me.avatarUrl || "", isPrivate: el.settingsPrivate.checked }),
        });
        me = r.me;
        showToast(t("saved"));
      } catch (err) {
        showToast(humanizeError(err?.message), true);
        if (el.settingsPrivate) el.settingsPrivate.checked = !!me.isPrivate;
      }
    });
  }

  if (el.settingsEditProfile) {
    on(el.settingsEditProfile, "click", () => {
      closeSettings();
      openProfileEdit();
    });
  }

  if (el.settingsInsights) {
    on(el.settingsInsights, "click", async () => {
      closeSettings();
      try {
        const r = await api("/api/insights", { method: "GET" });
        if (el.insightsPosts) el.insightsPosts.textContent = String(r.insights?.posts ?? 0);
        if (el.insightsViews) el.insightsViews.textContent = String(r.insights?.views ?? 0);
        if (el.insightsLikes) el.insightsLikes.textContent = String(r.insights?.likes ?? 0);
        if (el.insightsSaves) el.insightsSaves.textContent = String(r.insights?.saves ?? 0);
        if (el.insightsModal) el.insightsModal.hidden = false;
      } catch (err) {
        showToast(humanizeError(err?.message), true);
      }
    });
  }

  if (el.settingsLogout) {
    on(el.settingsLogout, "click", async () => {
      closeSettings();
      try { await api("/api/logout", { method: "POST" }); } catch {}
      clearSession();
      showAuth();
    });
  }

  // Notifications dot — poll every 30s using fast unread-count endpoint
  async function checkNotifDot() {
    if (!getToken()) return;
    try {
      const r = await api("/api/notifications/unread-count");
      const count = Number(r.count || 0);
      if (el.notifDot) el.notifDot.hidden = count === 0;
      if (el.notifBadge) {
        el.notifBadge.hidden = count === 0;
        el.notifBadge.textContent = count > 9 ? "9+" : String(count);
      }
    } catch {}
  }
  if (el.notifBtn) {
    on(el.notifBtn, "click", () => openNotificationsPanel());
    setInterval(checkNotifDot, 30000);
  }

  on(window, "keydown", (e) => {
    if (e.key !== "Escape") return;
    if (el.settingsView && !el.settingsView.hidden) { closeSettings(); return; }
    if (el.composeModal && !el.composeModal.hidden) closeCompose();
    if (el.profileModal && !el.profileModal.hidden) closeProfileEdit();
    if (el.reportModal && !el.reportModal.hidden) closeReport();
    if (el.insightsModal && !el.insightsModal.hidden) closeInsights();
    if (el.dmModal && !el.dmModal.hidden) {
      closeDmView();
      location.hash = "#home";
    }
    closeMenu();
  });

  on(window, "hashchange", () => route());

  clearStoredToken();

  if (el.navDmBtn) {
    on(el.navDmBtn, "click", () => { location.hash = "#dm"; route(); });
  }

  api("/api/me", { method: "GET" })
    .then((r) => {
      saveToken(true);
      me = r.me;
      showApp();
      initScrollHideNav();
      initPullToRefresh();
      initSwipeGestures();
      setupA2hsBanner();
      registerServiceWorker();
      setInterval(refreshAllTimestamps, 60000);
      setInterval(pollOnlineStatus, 60000);
      route();
      api("/api/version", { method: "GET" }).catch(() => showToast(t("error_server_outdated"), true));
    })
    .catch((err) => {
      if (String(err && err.message) !== "UNAUTHENTICATED") {
        showToast(humanizeError(err && err.message), true);
      }
      showAuth();
    });
}

// =====================================================================
// FEATURE BLOCK — 27-item UI/PWA improvement pass
// =====================================================================

// #15: Reaction picker (long-press on like)
function showReactionPicker(anchorEl, onPick) {
  const EMOJIS = ["\u2764\ufe0f", "\ud83d\ude02", "\ud83d\ude2e", "\ud83d\ude22", "\ud83d\ude21", "\ud83d\udc4f"];
  let popup = anchorEl._rxPopup;
  if (!popup) {
    popup = document.createElement("div");
    popup.className = "reactionPopup";
    for (const emoji of EMOJIS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.textContent = emoji;
      btn.setAttribute("aria-label", emoji);
      on(btn, "click", (e) => {
        e.stopPropagation();
        popup.classList.remove("show");
        onPick(emoji);
      });
      popup.appendChild(btn);
    }
    anchorEl._rxPopup = popup;
    anchorEl.style.position = "relative";
    anchorEl.appendChild(popup);
  }
  if (navigator.vibrate) navigator.vibrate(12);
  popup.classList.add("show");
  const dismiss = (e) => {
    if (!popup.contains(e.target) && e.target !== anchorEl) {
      popup.classList.remove("show");
      document.removeEventListener("click", dismiss);
    }
  };
  window.setTimeout(() => document.addEventListener("click", dismiss), 10);
}

// #10: Fullscreen media viewer
let lightboxLikeHandler = null;
function openLightbox(src, kind = "image", onLike = null) {
  const lb = document.getElementById("lightbox");
  if (!lb) return;
  lightboxLikeHandler = typeof onLike === "function" ? onLike : null;
  lb.hidden = false;
  lb.classList.remove("closing", "is-video");
  lb.classList.toggle("is-video", kind === "video");
  lb.querySelectorAll(".lightbox-video, .lightbox-heart").forEach((node) => node.remove());
  const img = lb.querySelector(".lightbox-img");
  if (img) {
    img.hidden = kind === "video";
    img.src = "";
    if (kind !== "video") img.src = src;
  }
  let mediaEl = img;
  if (kind === "video") {
    const video = document.createElement("video");
    video.className = "lightbox-video";
    video.src = src;
    video.controls = true;
    video.playsInline = true;
    video.autoplay = true;
    video.loop = true;
    video.preload = "metadata";
    lb.appendChild(video);
    mediaEl = video;
    video.play().catch(() => {});
  }
  const heart = document.createElement("div");
  heart.className = "lightbox-heart";
  heart.textContent = "\u2665";
  lb.appendChild(heart);
  window.requestAnimationFrame(() => lb.classList.add("show"));

  let startY = 0;
  let lastTap = 0;
  function showViewerHeart() {
    heart.classList.remove("show");
    void heart.offsetWidth;
    heart.classList.add("show");
    window.setTimeout(() => heart.classList.remove("show"), 720);
  }
  function likeFromViewer(event) {
    if (event && typeof event.preventDefault === "function") event.preventDefault();
    showViewerHeart();
    if (navigator.vibrate) navigator.vibrate(10);
    if (lightboxLikeHandler) Promise.resolve(lightboxLikeHandler(event)).catch(() => {});
  }
  function lbClose(e) {
    if (e.target === lb || e.target.id === "lightboxClose") closeLightbox();
  }
  function lbTap(e) {
    if (e.target && e.target.id === "lightboxClose") return;
    const now = Date.now();
    if (now - lastTap < 300) {
      lastTap = 0;
      likeFromViewer(e);
    } else {
      lastTap = now;
    }
  }
  function lbSwipe(e) {
    if (lb._swipeY === undefined) return;
    if (e.changedTouches[0].clientY - lb._swipeY > 76) closeLightbox();
  }
  lb._lbClick = lbClose;
  lb._lbSwipe = lbSwipe;
  lb._lbTap = lbTap;
  lb._lbTouchStart = (e) => { startY = e.touches[0].clientY; lb._swipeY = startY; };
  lb.addEventListener("click", lbClose);
  if (mediaEl) mediaEl.addEventListener("pointerup", lbTap);
  lb.addEventListener("touchstart", lb._lbTouchStart, { passive: true });
  lb.addEventListener("touchend", lbSwipe, { passive: true });
}

function closeLightbox() {
  const lb = document.getElementById("lightbox");
  if (!lb) return;
  lb.classList.add("closing");
  lb.classList.remove("show");
  if (lb._lbClick) { lb.removeEventListener("click", lb._lbClick); lb._lbClick = null; }
  const mediaEl = lb.querySelector(".lightbox-video") || lb.querySelector(".lightbox-img");
  if (mediaEl && lb._lbTap) mediaEl.removeEventListener("pointerup", lb._lbTap);
  if (lb._lbTouchStart) { lb.removeEventListener("touchstart", lb._lbTouchStart); lb._lbTouchStart = null; }
  if (lb._lbSwipe) { lb.removeEventListener("touchend", lb._lbSwipe); lb._lbSwipe = null; }
  lb._lbTap = null;
  lightboxLikeHandler = null;
  const video = lb.querySelector(".lightbox-video");
  if (video) {
    video.pause();
    video.removeAttribute("src");
    video.load();
  }
  window.setTimeout(() => {
    lb.hidden = true;
    lb.classList.remove("closing", "is-video");
    lb.querySelectorAll(".lightbox-video, .lightbox-heart").forEach((node) => node.remove());
    const img = lb.querySelector(".lightbox-img");
    if (img) { img.hidden = false; img.src = ""; }
  }, 260);
}

function wireLightboxToFeed(likeHandler = null) {
  if (!el.feed) return;
  for (const img of el.feed.querySelectorAll(".postMedia img:not([data-lb])")) {
    img.dataset.lb = "1";
    img.style.cursor = "zoom-in";
    on(img, "click", (e) => { e.stopPropagation(); openLightbox(img.dataset.fullSrc || img.currentSrc || img.src, "image", likeHandler); });
  }
  for (const video of el.feed.querySelectorAll(".postMedia video:not([data-lb])")) {
    video.dataset.lb = "1";
    video.style.cursor = "zoom-in";
    on(video, "dblclick", (e) => { e.preventDefault(); e.stopPropagation(); openLightbox(video.dataset.src || video.currentSrc || video.src, "video", likeHandler); });
  }
}

// #14: Online status
const onlineUsers = new Set();
function applyOnlineDots() {
  for (const node of document.querySelectorAll(".avatar[data-ukey]")) {
    node.classList.toggle("is-online", onlineUsers.has(node.dataset.ukey));
  }
}
function pollOnlineStatus() {
  if (!getToken()) return;
  api("/api/online", { method: "GET" })
    .then((r) => {
      onlineUsers.clear();
      const list = Array.isArray(r.online) ? r.online : (Array.isArray(r.users) ? r.users : []);
      for (const u of list) onlineUsers.add(String(u).toLowerCase());
      applyOnlineDots();
    })
    .catch(() => {});
}

// #9: Timestamp auto-update (every 60 s)
function refreshAllTimestamps() {
  for (const node of document.querySelectorAll(".time[data-iso]")) {
    if (node.dataset.iso) node.textContent = fmtTime(node.dataset.iso);
  }
}

// #27: Preload adjacent posts
function preloadAdjacentPosts(currentNode) {
  if (!el.feed || !currentNode) return;
  const posts = Array.from(el.feed.querySelectorAll(".post"));
  const idx = posts.indexOf(currentNode);
  for (let i = 1; i <= 2; i++) {
    const next = posts[idx + i];
    if (!next) break;
    for (const img of next.querySelectorAll('img[loading="lazy"]')) {
      img.loading = "eager";
    }
  }
}

// #22: Service Worker
function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  navigator.serviceWorker.register("/sw.js").catch(() => {});
}

// #26: API response cache (60 s TTL)
const _apiCache = new Map();
const _API_CACHE_TTL = 60000;
async function cachedApi(path, opts) {
  const isGet = !opts || !opts.method || opts.method === "GET";
  if (isGet) {
    const hit = _apiCache.get(path);
    if (hit && (Date.now() - hit.ts) < _API_CACHE_TTL) return hit.data;
  }
  const result = await api(path, opts || {});
  if (isGet) _apiCache.set(path, { ts: Date.now(), data: result });
  return result;
}
function invalidateApiCache(pathOrAll) {
  if (!pathOrAll) _apiCache.clear();
  else _apiCache.delete(pathOrAll);
}

// #23: Add-to-Home-Screen banner
let _a2hsPrompt = null;
window.addEventListener("beforeinstallprompt", (e) => {
  e.preventDefault();
  _a2hsPrompt = e;
  window.setTimeout(() => {
    const banner = document.getElementById("a2hsBanner");
    if (banner && !localStorage.getItem("hysa_a2hs_dismissed")) {
      banner.hidden = false;
      window.requestAnimationFrame(() => banner.classList.add("show"));
    }
  }, 30000);
});

function setupA2hsBanner() {
  const install = document.getElementById("a2hsInstall");
  const dismiss = document.getElementById("a2hsDismiss");
  function hideBanner() {
    const banner = document.getElementById("a2hsBanner");
    if (!banner) return;
    banner.classList.remove("show");
    window.setTimeout(() => { banner.hidden = true; }, 380);
  }
  if (install) {
    on(install, "click", async () => {
      if (!_a2hsPrompt) return;
      _a2hsPrompt.prompt();
      await _a2hsPrompt.userChoice.catch(() => {});
      _a2hsPrompt = null;
      hideBanner();
    });
  }
  if (dismiss) {
    on(dismiss, "click", () => {
      localStorage.setItem("hysa_a2hs_dismissed", "1");
      hideBanner();
    });
  }
}

// #19 / #20: Hide nav on scroll
function initScrollHideNav() {
  let lastY = 0;
  let ticking = false;
  const topNav = document.querySelector(".top-nav");
  const bottomNav = document.getElementById("mobileNav");
  window.addEventListener("scroll", () => {
    if (ticking) return;
    ticking = true;
    window.requestAnimationFrame(() => {
      ticking = false;
      const y = window.scrollY;
      if (y > lastY + 4 && y > 100) {
        topNav?.classList.add("nav-hidden");
        bottomNav?.classList.add("nav-hidden");
      } else if (y < lastY - 4) {
        topNav?.classList.remove("nav-hidden");
        bottomNav?.classList.remove("nav-hidden");
      }
      lastY = y;
    });
  }, { passive: true });
}

// #13: Pull-to-refresh
function initPullToRefresh() {
  let startY = 0;
  let startX = 0;
  let active = false;
  let armed = false;
  const armDistance = 34;
  const refreshDistance = 88;
  const indicator = document.getElementById("pullIndicator");
  const isHomeFeed = () => !location.hash || location.hash === "#home" || location.hash === "#";
  const setPullIndicator = (distance = 0) => {
    if (!indicator) return;
    const progress = Math.max(0, Math.min(1, distance / refreshDistance));
    indicator.style.setProperty("--pull-progress", progress.toFixed(2));
    indicator.classList.toggle("show", progress > 0.12);
    indicator.classList.toggle("ready", distance >= refreshDistance);
  };
  const resetPull = () => {
    active = false;
    armed = false;
    setPullIndicator(0);
  };
  window.addEventListener("touchstart", (e) => {
    if (!isHomeFeed() || feedLoading || document.body.classList.contains("settings-open")) return;
    if ((window.scrollY || document.documentElement.scrollTop || 0) > 2) return;
    if (!e.touches || e.touches.length !== 1) return;
    startY = e.touches[0].clientY;
    startX = e.touches[0].clientX;
    active = true;
    armed = false;
    setPullIndicator(0);
  }, { passive: true });
  window.addEventListener("touchmove", (e) => {
    if (!active) return;
    if ((window.scrollY || document.documentElement.scrollTop || 0) > 2) { resetPull(); return; }
    const dy = e.touches[0].clientY - startY;
    const dx = Math.abs(e.touches[0].clientX - startX);
    if (dx > 36 && dx > dy) { resetPull(); return; }
    if (dy <= 0) { resetPull(); return; }
    armed = dy >= armDistance;
    setPullIndicator(armed ? dy : 0);
  }, { passive: true });
  window.addEventListener("touchend", (e) => {
    if (!active) return;
    const dy = e.changedTouches[0].clientY - startY;
    const shouldRefresh = armed && dy >= refreshDistance && !feedLoading && isHomeFeed();
    resetPull();
    if (shouldRefresh) {
      if (navigator.vibrate) navigator.vibrate(10);
      feedCache = { key: "", timestamp: 0, payload: null };
      loadFeed({ reset: true }).catch(() => {});
    }
  }, { passive: true });
  window.addEventListener("touchcancel", resetPull, { passive: true });
}

// #16 / #17: Swipe gestures
function initSwipeGestures() {
  let swStart = null;
  const mainEl = document.querySelector(".main-content");
  if (mainEl) {
    mainEl.addEventListener("touchstart", (e) => {
      swStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    mainEl.addEventListener("touchend", (e) => {
      if (!swStart) return;
      const dx = e.changedTouches[0].clientX - swStart.x;
      const dy = Math.abs(e.changedTouches[0].clientY - swStart.y);
      swStart = null;
      if (dx > 80 && dy < 55 && !activeDmPeer) { location.hash = "#dm"; route(); }
    }, { passive: true });
  }
  const dmEl = document.getElementById("dmModal");
  let dmSwStart = null;
  if (dmEl) {
    dmEl.addEventListener("touchstart", (e) => {
      dmSwStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    }, { passive: true });
    dmEl.addEventListener("touchend", (e) => {
      if (!dmSwStart) return;
      const dx = e.changedTouches[0].clientX - dmSwStart.x;
      const dy = Math.abs(e.changedTouches[0].clientY - dmSwStart.y);
      dmSwStart = null;
      if (dx < -80 && dy < 55) {
        const back = document.getElementById("dmBack");
        if (back) back.click();
      }
    }, { passive: true });
  }
}

document.addEventListener("DOMContentLoaded", () => {
  boot().catch((err) => {
    console.error("[boot] failed:", err);
    clearSession({ clearToken: false });
    showAuth();
    setMsg(el.loginMsg, humanizeError(err && err.message), true);
  });
});
