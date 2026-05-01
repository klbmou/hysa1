/* global window, document */

const tokenKey = "token";
const legacyTokenKey = "hysa_token";
const langKey = "hysa_lang";
const themeKey = "hysa_theme";

function getToken() {
  return localStorage.getItem("token");
}

function readStoredToken() {
  const current = getToken();
  if (current) return current;
  const legacy = localStorage.getItem(legacyTokenKey);
  if (legacy) {
    localStorage.setItem(tokenKey, legacy);
    localStorage.removeItem(legacyTokenKey);
    return legacy;
  }
  return "";
}

function saveToken(nextToken) {
  token = String(nextToken || "");
  if (token) localStorage.setItem("token", token);
  else localStorage.removeItem("token");
  localStorage.removeItem(legacyTokenKey);
}

function clearStoredToken() {
  token = "";
  localStorage.removeItem("token");
  localStorage.removeItem(legacyTokenKey);
}

let token = readStoredToken();
let me = null;
let feedCursor = null;
let feedLoading = false;
let feedObserver = null;
let postViewObserver = null;
const sentViews = new Set();
let activeProfileKey = null;
let activePostId = null;
let activeProfileTab = "posts";
let storyCache = [];
let activeStoryIndex = 0;
let storyProgressTimer = null;
let storyFileInput = null;
let storyDraftFile = null;
let storyDraftPreviewUrl = "";
let storyDraftFilter = "normal";
let aiMode = "chat";

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

const I18N = {
  ar: {
    pageTitle: "HYSA - شبكة تواصل مصغّرة",
    brandTag: "منشورات قصيرة، متابعة، إعجاب",
    searchPlaceholder: "ابحث عن مستخدم...",
    logout: "تسجيل خروج",
    startNow: "ابدأ الآن",
    authBlurb: 'هذا مشروع تجريبي سريع. البيانات تُحفظ في <span class="mono">data.json</span>.',
    login: "دخول",
    register: "تسجيل",
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
    authBlurb: 'Quick demo project. Data is stored in <span class="mono">data.json</span>.',
    login: "Login",
    register: "Register",
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
  }, isError ? 2600 : 1800);
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
  if (el.langToggle) el.langToggle.textContent = (lang || "ar").toUpperCase();
}

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    const ms = Date.now() - d.getTime();
    const sec = Math.max(1, Math.floor(ms / 1000));
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
    return iso;
  }
}

function formatCount(n) {
  const value = Number(n) || 0;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(value >= 10_000_000 ? 0 : 1)}m`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k`;
  return String(value);
}

const ICONS = {
  heart: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/></svg>',
  comment: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.4 8.4 0 0 1-3.8-.9L3 21l1.9-5.7a8.4 8.4 0 0 1-.9-3.8 8.5 8.5 0 0 1 17 0Z"/></svg>',
  eye: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"/><circle cx="12" cy="12" r="3"/></svg>',
  repost: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/></svg>',
  share: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/></svg>',
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
  const b = document.createElement("span");
  b.className = "verifiedBadge";
  b.innerHTML = icon("check");
  b.title = "Verified";
  return b;
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

function currentUserKey() {
  return String((me && (me.userKey || me.key || me.username)) || "").toLowerCase();
}

function isMineKey(key) {
  const mine = currentUserKey();
  return !!mine && String(key || "").toLowerCase() === mine;
}

let authFailureCount = 0;

async function fetchJson(path, opts = {}) {
  const p = String(path || "");
  if (!p.startsWith("/api/")) throw new Error("INVALID_API_PATH");

  const headers = new Headers(opts.headers || {});
  headers.set("Accept", "application/json");
  if (opts.body && !(opts.body instanceof FormData)) headers.set("Content-Type", "application/json; charset=utf-8");

  token = readStoredToken();
  const storedToken = getToken();
  if (storedToken) headers.set("Authorization", `Bearer ${storedToken}`);

  let res;
  try {
    res = await fetch(p, { ...opts, headers });
  } catch {
    throw new Error("NETWORK");
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  return { res, json };
}

async function api(path, opts = {}) {
  if (location.protocol === "file:") throw new Error("FILE_ORIGIN");

  const p = String(path || "");
  const isAuthEndpoint = p.startsWith("/api/login") || p.startsWith("/api/register");
  let { res, json } = await fetchJson(p, opts);

  if (res.status === 401 && !isAuthEndpoint) {
    let retried = false;
    if (getToken()) {
      retried = true;
      ({ res, json } = await fetchJson(p, opts));
    }
    if (res.status === 401) authFailureCount += retried ? 2 : 1;
    else authFailureCount = 0;
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

let activeDmPeer = null;
let activeDmPeerProfile = null;
let dmRecorder = null;
let dmRecordingChunks = [];

function formatDuration(seconds) {
  const n = Number.isFinite(Number(seconds)) ? Math.max(0, Math.floor(Number(seconds))) : 0;
  const m = Math.floor(n / 60);
  const s = n % 60;
  return `${m}:${String(s).padStart(2, "0")}`;
}

function customAudioPlayer(url, { compact = false } = {}) {
  const wrap = document.createElement("div");
  wrap.className = `voicePlayer ${compact ? "compact" : ""}`.trim();

  const audio = document.createElement("audio");
  audio.src = url;
  audio.preload = "metadata";

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
    time.textContent = formatDuration(audio.duration);
  });
  on(audio, "timeupdate", () => {
    const total = Number(audio.duration || 0);
    const current = Number(audio.currentTime || 0);
    time.textContent = formatDuration(total ? Math.max(0, total - current) : current);
    wrap.style.setProperty("--progress", total ? String(current / total) : "0");
  });

  wrap.appendChild(audio);
  wrap.appendChild(play);
  wrap.appendChild(wave);
  wrap.appendChild(time);
  return wrap;
}

function customVideoPlayer(url, { muted = false, autoplay = false } = {}) {
  const player = document.createElement("div");
  player.className = "proVideo";

  const video = document.createElement("video");
  video.src = url;
  video.playsInline = true;
  video.preload = "metadata";
  video.muted = !!muted;
  video.loop = !!autoplay;
  video.autoplay = !!autoplay;

  const center = document.createElement("button");
  center.type = "button";
  center.className = "videoCenterPlay";
  center.setAttribute("aria-label", "Play video");
  center.textContent = "Play";

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
  mute.textContent = video.muted ? "Mute" : "Sound";

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
  function togglePlay() {
    if (video.paused) video.play().catch(() => {});
    else video.pause();
  }

  on(play, "click", togglePlay);
  on(center, "click", togglePlay);
  on(video, "click", togglePlay);
  on(video, "play", setPausedState);
  on(video, "pause", setPausedState);
  on(video, "loadedmetadata", sync);
  on(video, "timeupdate", sync);
  on(mute, "click", () => {
    video.muted = !video.muted;
    mute.textContent = video.muted ? "Mute" : "Sound";
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
  player.appendChild(center);
  player.appendChild(controls);
  setPausedState();
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
          if (entry.isIntersecting) v.play().catch(() => {});
          else v.pause();
        }
      },
      { threshold: 0.72 },
    );
  }
  for (const v of videos) mediaPlaybackObserver.observe(v);
}

function renderDmMessage(message) {
  const b = document.createElement("div");
  b.className = `dmBubble ${message.mine ? "mine" : ""}`.trim();
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
      img.referrerPolicy = "no-referrer";
      img.src = item.url;
      wrap.appendChild(img);
    } else if (item.kind === "video") {
      wrap.appendChild(customVideoPlayer(item.url));
    } else if (item.kind === "audio") {
      wrap.appendChild(customAudioPlayer(item.url, { compact: true }));
    }
    b.appendChild(wrap);
  }
  if (!b.childNodes.length) b.textContent = "Message";
  return b;
}

async function openDmThread(peerKey) {
  activeDmPeer = peerKey;
  if (el.dmModal) el.dmModal.hidden = false;
  const r = await api(`/api/dm/${encodeURIComponent(peerKey)}`, { method: "GET" });
  activeDmPeerProfile = r.peer || { key: peerKey, username: peerKey, avatarUrl: "" };
  if (el.dmPeer) el.dmPeer.textContent = `@${activeDmPeerProfile.username || peerKey}`;
  if (el.dmStatus) el.dmStatus.textContent = "Active now";
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
  if (el.dmHeaderAvatar) {
    el.dmHeaderAvatar.replaceWith(avatarNode(activeDmPeerProfile.avatarUrl, activeDmPeerProfile.username, "sm"));
    el.dmHeaderAvatar = document.getElementById("dmHeaderAvatar") || document.querySelector(".dm-view-header .avatar");
    if (el.dmHeaderAvatar) el.dmHeaderAvatar.id = "dmHeaderAvatar";
  }
  if (el.dmMessages) {
    el.dmMessages.textContent = "";
    const messages = Array.isArray(r.messages) ? r.messages : [];
    for (const m of messages) el.dmMessages.appendChild(renderDmMessage(m));
    el.dmMessages.scrollTop = el.dmMessages.scrollHeight;
  }
  if (el.dmThreads) {
    for (const n of el.dmThreads.querySelectorAll(".dmThreadItem")) {
      n.classList.toggle("active", n.dataset.peerKey === peerKey);
    }
  }
}

async function openDmInbox() {
  if (!el.dmModal) return;
  activeDmPeer = null;
  activeDmPeerProfile = null;
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
  const r = await api("/api/dm/threads", { method: "GET" });
  const threads = Array.isArray(r.threads) ? r.threads : [];
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
    const unread = Number(t.unreadCount || 0);
    btn.appendChild(avatarNode(t.peerAvatar, t.peerUsername, "sm"));
    const copy = document.createElement("span");
    copy.className = "dmThreadCopy";
    copy.innerHTML = `<strong>@${t.peerUsername}</strong><small>${t.lastMessage || "Tap to chat"}</small>`;
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

function closeDmView() {
  if (el.dmModal) el.dmModal.hidden = true;
  activeDmPeer = null;
  activeDmPeerProfile = null;
}

async function sendDmMessage({ text = "", media = [] } = {}) {
  if (!activeDmPeer) return;
  const body = { text: String(text || "").trim(), media };
  if (!body.text && !body.media.length) return;
  if (el.dmSend) el.dmSend.disabled = true;
  if (el.dmMessages) {
    el.dmMessages.appendChild(renderDmMessage({ ...body, mine: true, createdAt: new Date().toISOString() }));
    el.dmMessages.scrollTop = el.dmMessages.scrollHeight;
  }
  try {
    await api(`/api/dm/${encodeURIComponent(activeDmPeer)}`, { method: "POST", body: JSON.stringify(body) });
    if (el.dmText) el.dmText.value = "";
    await openDmThread(activeDmPeer);
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
    script.src = "https://unpkg.com/peerjs@1.5.4/dist/peerjs.min.js";
    script.async = true;
    script.dataset.peerjs = "true";
    script.onload = resolve;
    script.onerror = () => reject(new Error("Video calling failed to load."));
    document.head.appendChild(script);
  });
}

function ensureVideoCallStyles() {
  if (document.getElementById("videoCallStyles")) return;
  const style = document.createElement("style");
  style.id = "videoCallStyles";
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
  if (el.meBtn) el.meBtn.textContent = me ? `@${me.username}` : "@me";
  if (me) ensurePeerClient().catch(() => {});
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
  return (Array.isArray(stories) ? stories : []).filter((story) => story && story.id && story.media && story.media.url);
}

function storyLabel(story) {
  return String(story && story.author ? story.author : "user");
}

function storyIndexById(id) {
  return storyCache.findIndex((story) => String(story.id) === String(id));
}

function storyNode(story) {
  const wrap = document.createElement("button");
  wrap.type = "button";
  wrap.className = "storyItem";
  wrap.title = `Story by @${storyLabel(story)}`;
  const ring = document.createElement("div");
  ring.className = `storyRing ${story.seen ? "seen" : ""}`.trim();
  ring.appendChild(avatarNode(story.authorAvatar, storyLabel(story)));
  const label = document.createElement("div");
  label.className = "storyLabel";
  label.textContent = `@${storyLabel(story)}`;
  wrap.appendChild(ring);
  wrap.appendChild(label);
  on(wrap, "click", () => {
    const idx = storyIndexById(story.id);
    if (idx >= 0) openStoryViewer(idx);
  });
  return wrap;
}

function myStoryNode(myStory) {
  const wrap = storyNode(myStory || {
    id: "",
    author: me?.username || "me",
    authorAvatar: me?.avatarUrl || "",
    seen: false,
    media: null,
  });
  wrap.classList.add("storyMine");
  wrap.title = myStory ? "View your story" : "Add story";
  const label = wrap.querySelector(".storyLabel");
  if (label) label.textContent = "Your story";
  const ring = wrap.querySelector(".storyRing");
  if (ring) ring.classList.toggle("empty", !myStory);

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

  if (!myStory) {
    on(wrap, "click", (e) => {
      e.preventDefault();
      openStoryComposer();
    });
  }
  return wrap;
}

async function loadStories() {
  if (!el.storiesBar || !getToken()) return;
  try {
    const r = await api("/api/stories", { method: "GET" });
    const stories = safeStoryList(r.stories);
    storyCache = stories;
    el.storiesBar.textContent = "";
    const myKey = String(me?.userKey || me?.username || "").toLowerCase();
    const myStory = stories.find((s) => String(s.authorKey || s.author || "").toLowerCase() === myKey) || null;
    if (me) el.storiesBar.appendChild(myStoryNode(myStory));
    for (const s of stories) {
      if (myStory && String(s.id) === String(myStory.id)) continue;
      el.storiesBar.appendChild(storyNode(s));
    }
    el.storiesBar.hidden = !me && !stories.length;
  } catch {
    el.storiesBar.hidden = true;
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
  on(el.storyPick, "click", () => ensureStoryFileInput().click());
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
    video.controls = true;
    video.playsInline = true;
    video.className = `storyDraftMedia story-filter-${storyDraftFilter}`;
    el.storyPreview.appendChild(video);
  } else {
    const img = document.createElement("img");
    img.alt = "";
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
      <div class="storyProgress"><span id="storyProgressFill"></span></div>
      <header class="storyViewerHeader">
        <div id="storyViewerAuthor" class="storyViewerAuthor"></div>
        <button id="storyViewerClose" class="iconBtn" type="button" aria-label="Close">X</button>
      </header>
      <div id="storyViewerMedia" class="storyViewerMedia"></div>
      <button id="storyPrev" class="storyTapZone prev" type="button" aria-label="Previous story"></button>
      <button id="storyNext" class="storyTapZone next" type="button" aria-label="Next story"></button>
    </section>
  `;
  document.body.appendChild(overlay);
  el.storyViewer = overlay;
  el.storyProgressFill = overlay.querySelector("#storyProgressFill");
  el.storyViewerAuthor = overlay.querySelector("#storyViewerAuthor");
  el.storyViewerMedia = overlay.querySelector("#storyViewerMedia");
  el.storyViewerClose = overlay.querySelector("#storyViewerClose");
  el.storyPrev = overlay.querySelector("#storyPrev");
  el.storyNext = overlay.querySelector("#storyNext");
  on(el.storyViewerClose, "click", closeStoryViewer);
  on(el.storyPrev, "click", previousStory);
  on(el.storyNext, "click", nextStory);
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
  if (el.storyProgressFill) {
    el.storyProgressFill.style.transition = "none";
    el.storyProgressFill.style.width = "0%";
  }
}

function startStoryProgress(durationMs) {
  clearStoryProgress();
  if (!el.storyProgressFill) return;
  window.requestAnimationFrame(() => {
    if (!el.storyProgressFill) return;
    el.storyProgressFill.style.transition = `width ${durationMs}ms linear`;
    el.storyProgressFill.style.width = "100%";
  });
  storyProgressTimer = window.setTimeout(nextStory, durationMs);
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
  if (el.storyViewer) el.storyViewer.hidden = true;
  if (el.storyViewerMedia) el.storyViewerMedia.textContent = "";
}

function renderStoryViewer() {
  const story = storyCache[activeStoryIndex];
  if (!story || !el.storyViewerMedia || !el.storyViewerAuthor) return closeStoryViewer();
  clearStoryProgress();
  el.storyViewerMedia.textContent = "";
  el.storyViewerAuthor.textContent = "";
  el.storyViewerAuthor.appendChild(avatarNode(story.authorAvatar, storyLabel(story), "sm"));
  const name = document.createElement("strong");
  name.textContent = `@${storyLabel(story)}`;
  el.storyViewerAuthor.appendChild(name);

  const mediaClass = `storyFullMedia story-filter-${story.filter || "normal"}`;
  if (story.media.kind === "video") {
    const video = document.createElement("video");
    video.src = story.media.url;
    video.className = mediaClass;
    video.autoplay = true;
    video.controls = true;
    video.muted = true;
    video.playsInline = true;
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
    img.src = story.media.url;
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
  if (activeStoryIndex < storyCache.length - 1) {
    activeStoryIndex += 1;
    renderStoryViewer();
  } else {
    closeStoryViewer();
    loadStories().catch(() => {});
  }
}

function previousStory() {
  if (activeStoryIndex > 0) {
    activeStoryIndex -= 1;
    renderStoryViewer();
  } else {
    renderStoryViewer();
  }
}

async function loadTrends() {
  if (!el.trendsBar || !getToken()) return;
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
  } catch {
    el.trendsBar.hidden = true;
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
  if (profile.verified) name.appendChild(verifiedBadge());
  if (profile.isPrivate) {
    const locked = document.createElement("span");
    locked.className = "visBadge";
    locked.innerHTML = `${icon("lock")} Private`;
    name.appendChild(locked);
  }
  nameWrap.appendChild(name);
  ident.appendChild(nameWrap);

  const right = document.createElement("div");
  if (isMe) {
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
    const callBtn = document.createElement("button");
    callBtn.type = "button";
    callBtn.className = "btn ghost";
    callBtn.innerHTML = `${icon("phone")}<span>Call</span>`;
    on(callBtn, "click", () => initiateVideoCall(profileKey || activeProfileKey));
    right.appendChild(callBtn);

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
    followBtn.className = "btn ghost";
    followBtn.textContent = profile.isFollowing ? t("unfollow") : t("follow");
    on(followBtn, "click", async () => {
      followBtn.disabled = true;
      try {
        const r = await api(`/api/follow/${encodeURIComponent(activeProfileKey)}`, { method: "POST" });
        profile.isFollowing = r.following;
        followBtn.textContent = profile.isFollowing ? t("unfollow") : t("follow");
        const badge = el.profileHeader.querySelector("[data-badge='followers']");
        if (badge) badge.textContent = String(r.followerCount);
      } catch {
        // ignore
      } finally {
        followBtn.disabled = false;
      }
    });
    right.appendChild(followBtn);
  }

  top.appendChild(ident);
  top.appendChild(right);

  const bio = document.createElement("div");
  bio.className = "profileBio";
  bio.textContent = profile.bio || t("noBio");

  const stats = document.createElement("div");
  stats.className = "profileStats";
  stats.innerHTML = `<span>${t("followers")}: <span class="badge" data-badge="followers">${profile.followerCount}</span></span>
  <span>${t("following")}: <span class="badge">${profile.followingCount}</span></span>`;

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

function mediaGridNode(media, { removable = false, onRemove, withControls = false } = {}) {
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
      if (withControls) {
        tile.appendChild(customVideoPlayer(item.url, { muted: true }));
      } else {
        tile.appendChild(customVideoPlayer(item.url, { muted: true, autoplay: true }));
      }
    } else {
      const img = document.createElement("img");
      img.alt = "";
      img.loading = "lazy";
      img.referrerPolicy = "no-referrer";
      img.src = item.url;
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

function commentNode(comment, onReply, onDelete, post) {
  const wrap = document.createElement("div");
  wrap.className = "comment";

  const top = document.createElement("div");
  top.className = "commentTop";

  const who = document.createElement("div");
  who.className = "postWho";
  who.appendChild(avatarNode(comment.authorAvatar, comment.author, "sm"));

  const whoText = document.createElement("div");
  whoText.className = "whoText";
  const link = document.createElement("a");
  link.href = `#u/${encodeURIComponent(comment.authorKey)}`;
  link.textContent = `@${comment.author}`;
  const time = document.createElement("div");
  time.className = "time";
  time.textContent = fmtTime(comment.createdAt);
  whoText.appendChild(link);
  whoText.appendChild(time);
  who.appendChild(whoText);

  top.appendChild(who);

  const text = document.createElement("div");
  text.className = "commentText";
  text.textContent = comment.text;

  wrap.appendChild(top);
  wrap.appendChild(text);
  const actionRow = document.createElement("div");
  actionRow.className = "commentActions";
  const replyBtn = document.createElement("button");
  replyBtn.type = "button";
  replyBtn.className = "pill";
  replyBtn.textContent = "Reply";
  on(replyBtn, "click", () => onReply && onReply(comment));
  actionRow.appendChild(replyBtn);
  const canDelete = isMineKey(comment.authorKey) || isMineKey(post && (post.authorId || post.authorKey));
  if (canDelete) {
    const deleteBtn = document.createElement("button");
    deleteBtn.type = "button";
    deleteBtn.className = "pill";
    deleteBtn.textContent = "Delete";
    on(deleteBtn, "click", () => onDelete && onDelete(comment));
    actionRow.appendChild(deleteBtn);
  }
  wrap.appendChild(actionRow);
  if (Array.isArray(comment.replies) && comment.replies.length) {
    const replies = document.createElement("div");
    replies.style.marginInlineStart = "18px";
    replies.style.display = "grid";
    replies.style.gap = "8px";
    for (const r of comment.replies) replies.appendChild(commentNode(r, onReply, onDelete, post));
    wrap.appendChild(replies);
  }
  return wrap;
}

function richTextNode(textValue) {
  const text = document.createElement("div");
  text.className = "postText";
  const raw = String(textValue || "");
  const parts = raw.split(/(#[a-z0-9_]{2,30})/gi);
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
    } else {
      text.appendChild(document.createTextNode(part));
    }
  }
  return text;
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
  if (post.verified) top.appendChild(verifiedBadge());
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
  if (post.verified) a.appendChild(verifiedBadge());
  const time = document.createElement("div");
  time.className = "time";
  // Professional relative time
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
    root.appendChild(richTextNode(post.text));
  }

  let mediaNode = null;
  if (Array.isArray(post.media) && post.media.length) {
    const media = mediaGridNode(post.media, { withControls: true });
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
    likeBtn.classList.toggle("active", !!post.likedByMe);
    likeBtn.innerHTML = `${icon("heart")}<strong>${formatCount(post.likeCount)}</strong>`;
  }
  on(likeBtn, "click", async () => {
    pulseTap(likeBtn);
    likeBtn.disabled = true;
    try {
      await toggleLike();
    } catch {
      // ignore
    } finally {
      likeBtn.disabled = false;
    }
  });
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
    if (target && target.closest("button, a, input, textarea, select, .videoControls")) return;
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
    on(mediaNode, "dblclick", likeFromMedia);
    on(mediaNode, "pointerup", (e) => {
      if (e.pointerType === "mouse") return;
      const now = Date.now();
      if (now - lastMediaTap < 320) {
        lastMediaTap = 0;
        likeFromMedia(e).catch(() => {});
      } else {
        lastMediaTap = now;
      }
    });
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
    const url = `${location.origin}/#p/${encodeURIComponent(post.id)}`;
    try {
      if (navigator.share) await navigator.share({ title: "HYSA", text: post.text || "", url });
      else if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        showToast(t("linkCopied"));
      }
    } catch {
      // ignore
    }
  });

  const bookmarkBtn = iconCountButton("bookmark", post.bookmarkCount, "Save", post.bookmarkedByMe);
  on(bookmarkBtn, "click", async () => {
    pulseTap(bookmarkBtn);
    try {
      const r = await api(`/api/posts/${encodeURIComponent(post.id)}/bookmark`, { method: "POST" });
      post.bookmarkedByMe = r.bookmarked;
      post.bookmarkCount = r.bookmarkCount;
      bookmarkBtn.classList.toggle("active", !!post.bookmarkedByMe);
      bookmarkBtn.innerHTML = `${icon("bookmark")}<strong>${formatCount(post.bookmarkCount)}</strong>`;
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

async function loadFeed({ reset = false } = {}) {
  if (!el.feed) return;
  if (!getToken()) {
    showAuth();
    return;
  }
  if (feedLoading) return;
  feedLoading = true;
  if (el.feedLoader) el.feedLoader.hidden = false;

  if (reset) {
    el.feed.textContent = "";
    feedCursor = null;
    for (let i = 0; i < 3; i++) {
      el.feed.appendChild(createSkeletonPost());
    }
  }

  try {
    if (reset) {
      await loadStories();
      await loadTrends();
    }
    const url = new URL("/api/feed", location.origin);
    url.searchParams.set("limit", "20");
    if (feedCursor) url.searchParams.set("cursor", feedCursor);

    const r = await api(url.pathname + url.search, { method: "GET" });
    const posts = Array.isArray(r.posts) ? r.posts : [];
    feedCursor = r.nextCursor;

    el.feed.textContent = "";

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
      observeMediaPlayback(node);
    }
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
  el.reelsView.hidden = false;
  el.feed.hidden = true;
  if (el.storiesBar) el.storiesBar.hidden = true;
  if (el.trendsBar) el.trendsBar.hidden = true;
  el.reelsView.textContent = "";
  const exit = document.createElement("button");
  exit.type = "button";
  exit.className = "reelsExit";
  exit.setAttribute("aria-label", "Exit reels");
  exit.textContent = "X";
  on(exit, "click", () => {
    location.hash = "#home";
    route();
  });
  el.reelsView.appendChild(exit);
  const r = await api("/api/reels?limit=20", { method: "GET" });
  const reels = Array.isArray(r.reels) ? r.reels : [];
  for (const reel of reels) {
    const card = document.createElement("div");
    card.className = "reelCard";
    const reelMedia = (reel.media || []).find((m) => m && m.kind === "video") || (reel.media || [])[0];
    const media = document.createElement("div");
    media.className = "reelMedia";
    if (reelMedia && reelMedia.kind === "video") media.appendChild(customVideoPlayer(reelMedia.url, { muted: true, autoplay: true }));
    else if (reelMedia && reelMedia.kind === "image") {
      const img = document.createElement("img");
      img.alt = "";
      img.src = reelMedia.url;
      media.appendChild(img);
    }
    const heart = document.createElement("div");
    heart.className = "heartBurst";
    heart.textContent = "♥";
    const actions = document.createElement("div");
    actions.className = "reelActions";
    const likeAction = document.createElement("button");
    likeAction.type = "button";
    likeAction.className = "reelActionBtn";
    likeAction.innerHTML = `${icon("heart")}<strong>${formatCount(reel.likeCount || 0)}</strong>`;
    const commentAction = document.createElement("button");
    commentAction.type = "button";
    commentAction.className = "reelActionBtn";
    commentAction.innerHTML = icon("comment");
    const shareAction = document.createElement("button");
    shareAction.type = "button";
    shareAction.className = "reelActionBtn";
    shareAction.innerHTML = icon("share");
    const copyAction = document.createElement("button");
    copyAction.type = "button";
    copyAction.className = "reelActionBtn";
    copyAction.innerHTML = icon("bookmark");
    actions.appendChild(likeAction);
    actions.appendChild(commentAction);
    actions.appendChild(shareAction);
    actions.appendChild(copyAction);
    card.appendChild(media);
    card.appendChild(heart);
    card.appendChild(actions);
    async function likeReel() {
      const rLike = await api(`/api/posts/${encodeURIComponent(reel.id)}/like`, { method: "POST" });
      reel.likedByMe = rLike.liked;
      reel.likeCount = rLike.likeCount;
      likeAction.innerHTML = `${icon("heart")}<strong>${formatCount(reel.likeCount || 0)}</strong>`;
    }
    on(card, "dblclick", () => {
      heart.classList.add("show");
      window.setTimeout(() => heart.classList.remove("show"), 400);
      if (!reel.likedByMe) likeReel().catch(() => {});
    });
    on(likeAction, "click", () => likeReel().catch(() => {}));
    on(commentAction, "click", () => {
      location.hash = `#p/${encodeURIComponent(reel.id)}`;
      route();
    });
    on(shareAction, "click", async () => {
      const url = `${location.origin}/#p/${encodeURIComponent(reel.id)}`;
      try {
        if (navigator.share) await navigator.share({ title: "HYSA Reel", url });
        else if (navigator.clipboard) await navigator.clipboard.writeText(url);
      } catch {
        // ignore
      }
    });
    on(copyAction, "click", async () => {
      const url = `${location.origin}/#p/${encodeURIComponent(reel.id)}`;
      try {
        if (navigator.clipboard) await navigator.clipboard.writeText(url);
        showToast(t("linkCopied"));
      } catch {
        // ignore
      }
    });
    el.reelsView.appendChild(card);
  }
  const videos = Array.from(el.reelsView.querySelectorAll("video"));
  const io = new IntersectionObserver(
    (entries) => {
      for (const e of entries) {
        const v = e.target;
        if (!(v instanceof HTMLVideoElement)) continue;
        if (e.isIntersecting) v.play().catch(() => {});
        else v.pause();
      }
    },
    { threshold: 0.65 },
  );
  for (const v of videos) io.observe(v);
}

async function openProfile(userKeyOrName) {
  activeProfileKey = userKeyOrName;
  activePostId = null;
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
}

async function openPost(postId) {
  activeProfileKey = null;
  activePostId = postId;
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

function route() {
  if (!getToken()) return;
  const h = location.hash || "#home";
  const mProfile = /^#u\/(.+)$/.exec(h);
  const mPost = /^#p\/(.+)$/.exec(h);
  const mDm = /^#dm\/(.+)$/.exec(h);

  if (mProfile) {
    closeDmView();
    const key = decodeURIComponent(mProfile[1]);
    openProfile(key).catch(() => {});
    return;
  }
  if (mPost) {
    closeDmView();
    const id = decodeURIComponent(mPost[1]);
    openPost(id).catch(() => {});
    return;
  }

  if (h === "#dm") {
    openDmInbox().catch(() => {});
    return;
  }
  if (mDm) {
    const key = decodeURIComponent(mDm[1]);
    openDmInbox().then(() => openDmThread(key)).catch(() => {});
    return;
  }
  if (h === "#reels") {
    closeDmView();
    clearProfileHeader();
    setViewTitle("Reels");
    loadReels().catch(() => {});
    return;
  }

  activeProfileKey = null;
  activePostId = null;
  closeDmView();
  if (el.reelsView) el.reelsView.hidden = true;
  if (el.feed) el.feed.hidden = false;
  clearProfileHeader();
  setViewTitle(t("feedTitle"));
  loadFeed({ reset: true }).catch(() => {});
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
    el.searchResults.hidden = true;
    el.searchResults.textContent = "";
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
      left.textContent = `@${r.username}`;
      if (r.verified) left.appendChild(verifiedBadge());
      right.textContent = r.isPrivate ? "Private" : r.key;
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
    if (item.kind === "video") tile.appendChild(customVideoPlayer(item.previewUrl || item.url, { muted: true }));
    else if (item.kind === "audio") tile.appendChild(customAudioPlayer(item.previewUrl || item.url, { compact: true }));
    else {
      const img = document.createElement("img");
      img.alt = "";
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

async function uploadFile(file) {
  if (!file) throw new Error("UPLOAD_INVALID");
  const maxBytes = 25 * 1024 * 1024;
  if (file.size > maxBytes) throw new Error("FILE_TOO_LARGE");
  if (!/^image\//.test(file.type) && !/^video\//.test(file.type) && !/^audio\//.test(file.type)) throw new Error("INVALID_FILE");

  const dataUrl = await readFileAsDataUrl(file);
  let r;
  try {
    r = await api("/api/upload", { method: "POST", body: JSON.stringify({ dataUrl }) });
  } catch (err) {
    const code = String(err?.message || "");
    if (code === "NOT_FOUND" || code === "HTTP_404") throw new Error("UPLOAD_ENDPOINT_MISSING");
    throw err;
  }
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
  el.profilePrivate = privacyInput;
  el.profileSkills = skillsInput;
}

function openProfileEdit() {
  if (!me || !el.profileModal) return;
  ensureProfileEditFields();
  pendingAvatarUrl = me.avatarUrl || "";
  setAvatarPreview(pendingAvatarUrl);
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
  try {
    const r = await api("/api/insights", { method: "GET" });
    const ins = r.insights || {};
    if (el.insightsPosts) el.insightsPosts.textContent = String(ins.posts ?? 0);
    if (el.insightsViews) el.insightsViews.textContent = String(ins.views ?? 0);
    if (el.insightsLikes) el.insightsLikes.textContent = String(ins.likes ?? 0);
  } catch (err) {
    setMsg(el.insightsMsg, humanizeError(err?.message), true);
    if (el.insightsPosts) el.insightsPosts.textContent = "0";
    if (el.insightsViews) el.insightsViews.textContent = "0";
    if (el.insightsLikes) el.insightsLikes.textContent = "0";
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

function ensureAiAssistant() {
  if (el.aiFab) return;
  const fab = document.createElement("button");
  fab.id = "aiFab";
  fab.type = "button";
  fab.className = "aiFab";
  fab.innerHTML = icon("spark");
  fab.setAttribute("aria-label", "Open AI assistant");
  fab.title = "AI assistant";

  const panel = document.createElement("section");
  panel.id = "aiPanel";
  panel.className = "aiPanel glass";
  panel.hidden = true;
  panel.innerHTML = `
    <header class="aiHeader">
      <div><strong>HYSA AI</strong><span>Assistant</span></div>
      <button id="aiClose" class="iconBtn" type="button" aria-label="Close">X</button>
    </header>
    <div id="aiModes" class="aiModes">
      <button type="button" data-ai-mode="chat" class="active">${icon("spark")}<span>Chat</span></button>
      <button type="button" data-ai-mode="image">${icon("image")}<span>Image</span></button>
      <button type="button" data-ai-mode="video">${icon("video")}<span>Video</span></button>
    </div>
    <div id="aiMessages" class="aiMessages"></div>
    <form id="aiForm" class="aiForm">
      <input id="aiPrompt" type="text" maxlength="1000" autocomplete="off" placeholder="Ask HYSA AI...">
      <button id="aiSend" class="btn primary sm" type="submit">Send</button>
    </form>
  `;
  document.body.appendChild(fab);
  document.body.appendChild(panel);

  el.aiFab = fab;
  el.aiPanel = panel;
  el.aiClose = panel.querySelector("#aiClose");
  el.aiModes = panel.querySelector("#aiModes");
  el.aiMessages = panel.querySelector("#aiMessages");
  el.aiForm = panel.querySelector("#aiForm");
  el.aiPrompt = panel.querySelector("#aiPrompt");
  el.aiSend = panel.querySelector("#aiSend");

  on(fab, "click", () => {
    if (!getToken()) return showAuth();
    panel.hidden = !panel.hidden;
    if (!panel.hidden && el.aiMessages && !el.aiMessages.children.length) {
      addAiMessage("assistant", "AI is ready. If the backend has no API key yet, I will answer in safe mock mode.");
    }
    if (!panel.hidden && el.aiPrompt) el.aiPrompt.focus();
  });
  on(el.aiClose, "click", () => {
    panel.hidden = true;
  });
  for (const btn of panel.querySelectorAll("[data-ai-mode]")) {
    on(btn, "click", () => {
      aiMode = btn.getAttribute("data-ai-mode") || "chat";
      for (const item of panel.querySelectorAll("[data-ai-mode]")) item.classList.toggle("active", item === btn);
      if (el.aiPrompt) {
        el.aiPrompt.placeholder = aiMode === "chat" ? "Ask HYSA AI..." : `Describe the ${aiMode} you want...`;
        el.aiPrompt.focus();
      }
    });
  }
  on(el.aiForm, "submit", sendAiPrompt);
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
    insightsMsg: document.getElementById("insightsMsg"),

    toast: document.getElementById("toast"),
    actionSheet: document.getElementById("actionSheet"),
    sheetTitle: document.getElementById("sheetTitle"),
    sheetBody: document.getElementById("sheetBody"),
    sheetCancel: document.getElementById("sheetCancel"),
    mobileNav: document.getElementById("mobileNav"),
  };

  applyI18n();
  switchAuthTab("login");
  ensureAiAssistant();

  if (el.langSelect) {
    on(el.langSelect, "change", () => {
      lang = el.langSelect.value || "ar";
      if (!["ar", "en", "fr"].includes(lang)) lang = "ar";
      localStorage.setItem(langKey, lang);
      applyI18n();
      if (me) route();
    });
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
        el.langSelect.value = value;
        el.langSelect.dispatchEvent(new Event("change"));
        el.langMenu.hidden = true;
      });
    }
  }

  if (location.protocol === "file:") {
    showAuth();
    const warn = t("error_file_origin");
    setMsg(el.loginMsg, warn, true);
    setMsg(el.registerMsg, warn, true);
  }

  on(el.tabLogin, "click", () => switchAuthTab("login"));
  on(el.tabRegister, "click", () => switchAuthTab("register"));

  on(el.loginForm, "submit", async (e) => {
    e.preventDefault();
    setMsg(el.loginMsg, "");
    const fd = new FormData(el.loginForm);
    const username = String(fd.get("username") || "");
    const password = String(fd.get("password") || "");
    try {
      const r = await api("/api/login", { method: "POST", body: JSON.stringify({ username, password }) });
      saveToken(r.token);
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
      saveToken(r.token);
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
    if (el.dmFiles && activeDmPeer) el.dmFiles.click();
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
    on(el.dmSend, "click", () => sendDmMessage({ text: el.dmText?.value || "" }));
  }
  on(el.dmText, "keydown", (e) => {
    if (e.key !== "Enter" || e.shiftKey) return;
    e.preventDefault();
    sendDmMessage({ text: el.dmText?.value || "" });
  });
  if (el.dmRecord) {
    on(el.dmRecord, "click", async () => {
      if (!activeDmPeer) return;
      if (dmRecorder && dmRecorder.state === "recording") {
        dmRecorder.stop();
        return;
      }
      if (!navigator.mediaDevices || !window.MediaRecorder) {
        showToast("Voice recording is not supported in this browser.", true);
        return;
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        dmRecordingChunks = [];
        dmRecorder = new MediaRecorder(stream);
        dmRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size) dmRecordingChunks.push(event.data);
        };
        dmRecorder.onstop = async () => {
          stream.getTracks().forEach((track) => track.stop());
          el.dmRecord.classList.remove("recording");
          const blob = new Blob(dmRecordingChunks, { type: "audio/webm" });
          const file = new File([blob], `voice-${Date.now()}.webm`, { type: "audio/webm" });
          try {
            const media = await uploadFile(file);
            await sendDmMessage({ media: [media] });
          } catch (err) {
            showToast(humanizeError(err?.message, t("error_upload_invalid")), true);
          }
        };
        dmRecorder.start();
        el.dmRecord.classList.add("recording");
        showToast("Recording... tap the microphone again to send.");
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
        for (const n of el.mobileNav.querySelectorAll(".nav-item")) n.classList.remove("active");
        btn.classList.add("active");
        if (nav === "home") location.hash = "#home";
        else if (nav === "search" && el.searchInput) el.searchInput.focus();
        else if (nav === "create") openCompose();
        else if (nav === "reels") location.hash = "#reels";
        else if (nav === "profile" && me) location.hash = `#u/${encodeURIComponent(me.username.toLowerCase())}`;
      });
    }
  }

  on(el.refreshBtn, "click", () => route());
  ensureInfiniteFeed();

  on(el.composeFab, "click", () => openCompose());
  on(el.composeClose, "click", () => closeCompose());
  if (el.composeModal) bindOverlayClose(el.composeModal, () => closeCompose());
  on(el.composeText, "input", () => updateComposeCount());
  on(el.composeAddMedia, "click", () => {
    if (el.composeFiles) el.composeFiles.click();
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
    if (el.avatarFile) el.avatarFile.click();
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
      const bio = String(el.profileBio?.value || "");
      const skills = String(el.profileSkills?.value || "")
        .split(",")
        .map((x) => x.trim())
        .filter(Boolean)
        .slice(0, 20);
      const r = await api("/api/profile", {
        method: "POST",
        body: JSON.stringify({ bio, avatarUrl: pendingAvatarUrl, isPrivate: !!el.profilePrivate?.checked, skills }),
      });
      me = r.me;
      closeProfileEdit();
      showToast(t("saved"));
      if (activeProfileKey && me && activeProfileKey === me.username.toLowerCase()) route();
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

  on(window, "keydown", (e) => {
    if (e.key !== "Escape") return;
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

  token = readStoredToken();
  if (!getToken()) {
    showAuth();
    return;
  }

  showApp();
  route();

  api("/api/me", { method: "GET" })
    .then((r) => {
      me = r.me;
      showApp();
    })
    .catch((err) => {
      if (String(err && err.message) !== "UNAUTHENTICATED") {
        showToast(humanizeError(err && err.message), true);
      }
    });
  api("/api/version", { method: "GET" }).catch(() => showToast(t("error_server_outdated"), true));
}

document.addEventListener("DOMContentLoaded", () => {
  boot().catch((err) => {
    console.error("[boot] failed:", err);
    clearSession({ clearToken: false });
    showAuth();
    setMsg(el.loginMsg, humanizeError(err && err.message), true);
  });
});
