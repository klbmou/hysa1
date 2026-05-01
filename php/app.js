/* global window, document */

const tokenKey = "hysa_token";
const langKey = "hysa_lang";

// Use an absolute API origin for shared hosting (InfinityFree) and cross-origin setups.
// You can override it by setting: window.HYSA_API_ORIGIN = "https://your-domain.example";
const defaultApiOrigin = location.origin && location.origin !== "null" ? location.origin : "";
const API_ORIGIN = String(window.HYSA_API_ORIGIN || defaultApiOrigin || "http://hysa.xo.je").replace(/\/$/, "");

let token = localStorage.getItem(tokenKey) || "";
let me = null;
let feedCursor = null;
let feedLoading = false;
let feedObserver = null;
let postViewObserver = null;
const sentViews = new Set();
let activeProfileKey = null;
let activePostId = null;

let lang = localStorage.getItem(langKey) || "ar";
if (!["ar", "en", "fr"].includes(lang)) lang = "ar";

const I18N = {
  ar: {
    pageTitle: "HYSA - شبكة تواصل مصغّرة",
    brandTag: "منشورات قصيرة، متابعة، إعجاب",
    searchPlaceholder: "ابحث عن مستخدم...",
    logout: "تسجيل خروج",
    startNow: "ابدأ الآن",
    authBlurb: 'هذا مشروع تجريبي سريع. البيانات تُحفظ داخل قاعدة بيانات <span class="mono">MySQL</span>.',
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
    error_file_origin: "افتح الموقع عبر رابط http/https وليس كملف (File).",
    error_network: "لا يمكن الاتصال بالسيرفر. تأكد أن /api يعمل وأن إعدادات MySQL صحيحة.",
    error_server_outdated: "ملفات السيرفر غير متوافقة. حدّث مجلد /api على الاستضافة.",
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
    error_db_not_configured: "إعدادات MySQL غير مكتملة. عدّل api/db.php على الاستضافة.",
    error_db_connect_failed: "فشل الاتصال بقاعدة البيانات. تأكد من بيانات MySQL.",
    error_unknown: "حدث خطأ غير متوقع.",
    error_upload_missing: "ميزة رفع الملفات غير متوفرة. تأكد أن /api/upload.php يعمل وأن مجلد /uploads قابل للكتابة.",
  },
  en: {
    pageTitle: "HYSA - Mini Social",
    brandTag: "Short posts, follow, like",
    searchPlaceholder: "Search users...",
    logout: "Log out",
    startNow: "Get started",
    authBlurb: 'Quick demo project. Data is saved in <span class="mono">MySQL</span>.',
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
    error_file_origin: "Open the site via http/https (not as a local file).",
    error_network: "Can't reach the server. Make sure /api is working and MySQL is configured.",
    error_server_outdated: "Server files are outdated. Upload the latest /api folder.",
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
    error_db_not_configured: "MySQL config is missing. Edit api/db.php on your hosting.",
    error_db_connect_failed: "Couldn't connect to the database. Check your MySQL credentials.",
    error_unknown: "Something went wrong.",
    error_upload_missing: "Upload isn't available. Make sure /api/upload.php works and /uploads is writable.",
  },
  fr: {
    pageTitle: "HYSA - Mini reseau social",
    brandTag: "Posts courts, suivre, aimer",
    searchPlaceholder: "Rechercher un utilisateur...",
    logout: "Deconnexion",
    startNow: "Commencer",
    authBlurb: 'Projet de demo. Les donnees sont sauvegardees dans <span class="mono">MySQL</span>.',
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
    error_file_origin: "Ouvrez le site via http/https (pas en fichier local).",
    error_network: "Impossible de joindre le serveur. Verifiez que /api fonctionne et que MySQL est configure.",
    error_server_outdated: "Fichiers serveur obsoletes. Uploadez le dernier dossier /api.",
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
    error_db_not_configured: "Config MySQL manquante. Modifiez api/db.php sur votre hebergement.",
    error_db_connect_failed: "Connexion a la base impossible. Verifiez vos identifiants MySQL.",
    error_unknown: "Une erreur est survenue.",
    error_upload_missing: "Le televersement n'est pas disponible. Verifiez /api/upload.php et que /uploads est inscriptible.",
  },
};

function t(key) {
  return I18N[lang]?.[key] ?? I18N.ar[key] ?? key;
}

const el = {
  authView: document.getElementById("authView"),
  appView: document.getElementById("appView"),

  tabLogin: document.getElementById("tabLogin"),
  tabRegister: document.getElementById("tabRegister"),
  loginForm: document.getElementById("loginForm"),
  registerForm: document.getElementById("registerForm"),
  loginMsg: document.getElementById("loginMsg"),
  registerMsg: document.getElementById("registerMsg"),

  meBtn: document.getElementById("meBtn"),
  logoutBtn: document.getElementById("logoutBtn"),
  searchInput: document.getElementById("searchInput"),
  searchResults: document.getElementById("searchResults"),
  langSelect: document.getElementById("langSelect"),

  refreshBtn: document.getElementById("refreshBtn"),
  viewTitle: document.getElementById("viewTitle"),
  profileHeader: document.getElementById("profileHeader"),
  feed: document.getElementById("feed"),
  feedLoader: document.getElementById("feedLoader"),
  feedSentinel: document.getElementById("feedSentinel"),

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

  insightsModal: document.getElementById("insightsModal"),
  insightsClose: document.getElementById("insightsClose"),
  insightsPosts: document.getElementById("insightsPosts"),
  insightsViews: document.getElementById("insightsViews"),
  insightsLikes: document.getElementById("insightsLikes"),
  insightsMsg: document.getElementById("insightsMsg"),

  toast: document.getElementById("toast"),
};

function setMsg(node, text, isError = false) {
  if (!node) return;
  node.textContent = text || "";
  node.classList.toggle("error", !!isError);
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
}

function fmtTime(iso) {
  try {
    const d = new Date(iso);
    const locale = lang === "fr" ? "fr-FR" : lang === "en" ? "en-US" : "ar";
    return d.toLocaleString(locale);
  } catch {
    return iso;
  }
}

function toFormData(fields) {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields || {})) {
    if (v === undefined || v === null) continue;
    fd.append(k, String(v));
  }
  return fd;
}

async function api(path, opts = {}) {
  const headers = new Headers(opts.headers || {});
  headers.set("Accept", "application/json");
  if (opts.body && !(opts.body instanceof FormData)) headers.set("Content-Type", "application/json; charset=utf-8");
  if (token) headers.set("Authorization", `Bearer ${token}`);

  if (location.protocol === "file:" && !API_ORIGIN) throw new Error("FILE_ORIGIN");

  // InfinityFree/shared hosting friendly API mapping:
  // Convert extension-less Node style endpoints into simple .php files (no rewrite needed).
  let mappedPath = path;
  try {
    const u = new URL(String(path || ""), location.origin);
    const p = u.pathname;
    if (p.startsWith("/api/")) {
      const setToken = () => {
        if (!token) return;
        if (u.searchParams.has("token")) return;
        if (p.startsWith("/api/login") || p.startsWith("/api/signup") || p.startsWith("/api/register")) return;
        u.searchParams.set("token", token);
      };

      if (p === "/api/version") u.pathname = "/api/version.php";
      else if (p === "/api/signup") u.pathname = "/api/signup.php";
      else if (p === "/api/register") u.pathname = "/api/signup.php";
      else if (p === "/api/login") u.pathname = "/api/login.php";
      else if (p === "/api/logout") u.pathname = "/api/logout.php";
      else if (p === "/api/me") u.pathname = "/api/me.php";
      else if (p === "/api/insights") u.pathname = "/api/insights.php";
      else if (p === "/api/profile") u.pathname = "/api/profile.php";
      else if (p === "/api/upload") u.pathname = "/api/upload.php";
      else if (p === "/api/posts") u.pathname = "/api/posts.php";
      else if (p === "/api/feed") u.pathname = "/api/feed.php";
      else if (p === "/api/search") u.pathname = "/api/search.php";
      else if (p === "/api/report") u.pathname = "/api/report.php";
      else {
        let m;
        m = /^\\/api\\/user\\/(.+)$/.exec(p);
        if (m) {
          u.pathname = "/api/user.php";
          u.searchParams.set("u", decodeURIComponent(m[1] || ""));
        }

        m = /^\\/api\\/follow\\/(.+)$/.exec(p);
        if (m) {
          u.pathname = "/api/follow.php";
          u.searchParams.set("u", decodeURIComponent(m[1] || ""));
        }

        m = /^\\/api\\/posts\\/(.+)\\/comments$/.exec(p);
        if (m) {
          u.pathname = "/api/comments.php";
          u.searchParams.set("id", decodeURIComponent(m[1] || ""));
        }

        m = /^\\/api\\/posts\\/(.+)\\/like$/.exec(p);
        if (m) {
          u.pathname = "/api/like.php";
          u.searchParams.set("id", decodeURIComponent(m[1] || ""));
        }

        m = /^\\/api\\/posts\\/(.+)\\/view$/.exec(p);
        if (m) {
          u.pathname = "/api/view.php";
          u.searchParams.set("id", decodeURIComponent(m[1] || ""));
        }

        m = /^\\/api\\/posts\\/(.+)$/.exec(p);
        if (m) {
          u.pathname = "/api/post.php";
          u.searchParams.set("id", decodeURIComponent(m[1] || ""));
        }
      }

      setToken();
      mappedPath = u.pathname + u.search;
    } else {
      mappedPath = u.pathname + u.search;
    }
  } catch {
    // ignore mapping errors and try the raw path
    mappedPath = path;
  }

  const baseOrigin = API_ORIGIN || (location.origin && location.origin !== "null" ? location.origin : "");
  if (!baseOrigin) throw new Error("FILE_ORIGIN");

  let fetchUrl = "";
  try {
    fetchUrl = new URL(String(mappedPath || ""), baseOrigin).toString();
  } catch {
    fetchUrl = String(mappedPath || "");
  }

  let res;
  try {
    res = await fetch(fetchUrl, { ...opts, headers });
  } catch {
    throw new Error("NETWORK");
  }

  let json = null;
  try {
    json = await res.json();
  } catch {
    // ignore
  }

  let endpointPath = String(mappedPath || path || "");
  try {
    endpointPath = new URL(fetchUrl).pathname;
  } catch {
    // ignore
  }
  const isAuthEndpoint =
    endpointPath.startsWith("/api/login") || endpointPath.startsWith("/api/register") || endpointPath.startsWith("/api/signup");
  if (res.status === 401 && !isAuthEndpoint) {
    clearSession();
    showAuth();
    throw new Error("UNAUTHENTICATED");
  }

  if (!json) {
    throw new Error(`HTTP_${res.status}`);
  }

  if (!res.ok || (json && (json.ok === false || json.success === false))) {
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
  if (m === "DB_NOT_CONFIGURED") return t("error_db_not_configured");
  if (m === "DB_CONNECT_FAILED") return t("error_db_connect_failed");
  if (m && m !== "SERVER_ERROR") return m;
  return fallback || t("error_unknown");
}

function clearSession() {
  token = "";
  localStorage.removeItem(tokenKey);
  me = null;
}

function hideAllOverlays() {
  if (el.composeModal) el.composeModal.hidden = true;
  if (el.profileModal) el.profileModal.hidden = true;
  if (el.reportModal) el.reportModal.hidden = true;
  if (el.insightsModal) el.insightsModal.hidden = true;
}

function showAuth() {
  hideAllOverlays();
  el.authView.hidden = false;
  el.appView.hidden = true;
  el.meBtn.hidden = true;
  el.logoutBtn.hidden = true;
  el.searchInput.disabled = true;
  el.searchResults.hidden = true;
  el.searchInput.value = "";
  if (el.composeFab) el.composeFab.hidden = true;
  location.hash = "#home";
}

function showApp() {
  el.authView.hidden = true;
  el.appView.hidden = false;
  el.meBtn.hidden = false;
  el.logoutBtn.hidden = false;
  el.searchInput.disabled = false;
  if (el.composeFab) el.composeFab.hidden = false;
  el.meBtn.textContent = me ? `@${me.username}` : "@me";
}

function switchAuthTab(tab) {
  const isLogin = tab === "login";
  el.tabLogin.classList.toggle("active", isLogin);
  el.tabRegister.classList.toggle("active", !isLogin);
  el.loginForm.hidden = !isLogin;
  el.registerForm.hidden = isLogin;
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
  el.profileHeader.hidden = false;
  el.profileHeader.textContent = "";

  const isMe = !!(me && profile.username === me.username);

  const top = document.createElement("div");
  top.className = "profileTop";

  const ident = document.createElement("div");
  ident.className = "profileIdent";
  ident.appendChild(avatarNode(profile.avatarUrl, profile.username, "xl"));

  const nameWrap = document.createElement("div");
  nameWrap.style.minWidth = "0";
  const name = document.createElement("div");
  name.className = "profileName";
  name.textContent = `@${profile.username}`;
  nameWrap.appendChild(name);
  ident.appendChild(nameWrap);

  const right = document.createElement("div");
  if (isMe) {
    const insightsBtn = document.createElement("button");
    insightsBtn.type = "button";
    insightsBtn.className = "btn ghost";
    insightsBtn.textContent = t("insights");
    insightsBtn.addEventListener("click", () => openInsights());
    right.appendChild(insightsBtn);

    const edit = document.createElement("button");
    edit.type = "button";
    edit.className = "btn ghost";
    edit.textContent = t("editProfile");
    edit.addEventListener("click", () => openProfileEdit());
    right.appendChild(edit);
  } else {
    const followBtn = document.createElement("button");
    followBtn.type = "button";
    followBtn.className = "btn ghost";
    followBtn.textContent = profile.isFollowing ? t("unfollow") : t("follow");
    followBtn.addEventListener("click", async () => {
      followBtn.disabled = true;
      try {
        const r = await api(`/api/follow.php?u=${encodeURIComponent(activeProfileKey)}`, { method: "POST" });
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
  el.profileHeader.appendChild(stats);
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

    if (item.kind === "video") {
      const v = document.createElement("video");
      v.src = item.url;
      v.playsInline = true;
      v.controls = !!withControls;
      if (!withControls) v.muted = true;
      tile.appendChild(v);
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
      rm.addEventListener("click", () => onRemove && onRemove(item));
      tile.appendChild(rm);
    }

    grid.appendChild(tile);
  }
  return grid;
}

function commentNode(comment) {
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
  return wrap;
}

function postNode(post) {
  const root = document.createElement("div");
  root.className = "post";

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
  const time = document.createElement("div");
  time.className = "time";
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
  moreBtn.textContent = "⋯";

  const menu = document.createElement("div");
  menu.className = "menu";
  menu.hidden = true;

  const shareBtn = document.createElement("button");
  shareBtn.type = "button";
  shareBtn.className = "menuItem";
  shareBtn.textContent = t("copyLink");
  shareBtn.addEventListener("click", async () => {
    closeMenu();
    const url = `${location.origin}/#p/${encodeURIComponent(post.id)}`;
    try {
      if (navigator.share) {
        await navigator.share({ title: "HYSA", text: post.text || "", url });
      } else if (navigator.clipboard && navigator.clipboard.writeText) {
        await navigator.clipboard.writeText(url);
        showToast(t("linkCopied"));
      } else {
        window.prompt("Copy link:", url);
      }
    } catch {
      // ignore
    }
  });

  const reportBtn = document.createElement("button");
  reportBtn.type = "button";
  reportBtn.className = "menuItem";
  reportBtn.textContent = t("report");
  reportBtn.addEventListener("click", () => {
    closeMenu();
    openReport(post.id);
  });

  menu.appendChild(shareBtn);
  menu.appendChild(reportBtn);

  moreBtn.addEventListener("click", () => {
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
    const text = document.createElement("div");
    text.className = "postText";
    text.textContent = post.text;
    root.appendChild(text);
  }

  if (Array.isArray(post.media) && post.media.length) {
    const media = mediaGridNode(post.media, { withControls: true });
    media.classList.add("postMedia");
    root.appendChild(media);
  }

  const actions = document.createElement("div");
  actions.className = "postActions";

  const likeBtn = document.createElement("button");
  likeBtn.type = "button";
  likeBtn.className = `pill ${post.likedByMe ? "liked" : ""}`.trim();
  likeBtn.innerHTML = `${t("like")} <strong>${post.likeCount}</strong>`;
  likeBtn.addEventListener("click", async () => {
    likeBtn.disabled = true;
    try {
      const r = await api(`/api/like.php?id=${encodeURIComponent(post.id)}`, { method: "POST" });
      post.likedByMe = r.liked;
      post.likeCount = r.likeCount;
      likeBtn.classList.toggle("liked", !!post.likedByMe);
      likeBtn.innerHTML = `${t("like")} <strong>${post.likeCount}</strong>`;
    } catch {
      // ignore
    } finally {
      likeBtn.disabled = false;
    }
  });

  const commentBtn = document.createElement("button");
  commentBtn.type = "button";
  commentBtn.className = "pill";
  commentBtn.innerHTML = `${t("comments")} <strong class="mono">${post.commentCount || 0}</strong>`;

  const viewsPill = document.createElement("div");
  viewsPill.className = "pill static";
  const viewsLabel = document.createElement("span");
  viewsLabel.textContent = t("views");
  const viewsCount = document.createElement("strong");
  viewsCount.className = "mono";
  viewsCount.dataset.role = "viewCount";
  viewsCount.textContent = String(Number(post.viewCount) || 0);
  viewsPill.appendChild(viewsLabel);
  viewsPill.appendChild(viewsCount);

  actions.appendChild(likeBtn);
  actions.appendChild(commentBtn);
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

  async function loadComments() {
    if (commentsLoading) return;
    commentsLoading = true;
    commentsList.textContent = "";
    try {
      const r = await api(`/api/comments.php?id=${encodeURIComponent(post.id)}&limit=50`, { method: "GET" });
      const list = Array.isArray(r.comments) ? r.comments : [];
      if (!list.length) {
        const empty = document.createElement("div");
        empty.className = "muted";
        empty.textContent = "…";
        empty.dataset.empty = "true";
        commentsList.appendChild(empty);
      } else {
        for (const c of list) commentsList.appendChild(commentNode(c));
      }
      post.commentCount = r.commentCount ?? post.commentCount;
      commentBtn.innerHTML = `${t("comments")} <strong class="mono">${post.commentCount || 0}</strong>`;
      commentsLoaded = true;
    } catch {
      // ignore
    } finally {
      commentsLoading = false;
    }
  }

  commentBtn.addEventListener("click", async () => {
    commentsWrap.hidden = !commentsWrap.hidden;
    if (!commentsWrap.hidden) {
      commentInput.focus();
      if (!commentsLoaded) await loadComments();
    }
  });

  commentSend.addEventListener("click", async () => {
    setMsg(commentMsg, "");
    const textValue = commentInput.value;
    if (!textValue.trim()) return setMsg(commentMsg, t("error_invalid_comment"), true);
    commentSend.disabled = true;
    try {
      const r = await api(`/api/comments.php?id=${encodeURIComponent(post.id)}`, {
        method: "POST",
        body: toFormData({ text: textValue }),
      });
      const empty = commentsList.querySelector("[data-empty='true']");
      if (empty) empty.remove();
      commentsList.appendChild(commentNode(r.comment));
      commentInput.value = "";
      post.commentCount = r.commentCount ?? (Number(post.commentCount) || 0) + 1;
      commentBtn.innerHTML = `${t("comments")} <strong class="mono">${post.commentCount || 0}</strong>`;
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

async function loadFeed({ reset = false } = {}) {
  if (feedLoading) return;
  feedLoading = true;
  if (el.feedLoader) el.feedLoader.hidden = false;

  if (reset) {
    el.feed.textContent = "";
    feedCursor = null;
  }

  try {
    const url = new URL("/api/feed.php", location.origin);
    url.searchParams.set("limit", "20");
    if (feedCursor) url.searchParams.set("cursor", feedCursor);

    const r = await api(url.pathname + url.search, { method: "GET" });
    const posts = Array.isArray(r.posts) ? r.posts : [];
    feedCursor = r.nextCursor;

    if (reset && !posts.length) {
      const empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = t("noPosts");
      empty.dataset.empty = "true";
      el.feed.appendChild(empty);
      return;
    }

    const empty = el.feed.querySelector("[data-empty='true']");
    if (empty) empty.remove();
    for (const p of posts) el.feed.appendChild(postNode(p));
  } finally {
    feedLoading = false;
    if (el.feedLoader) el.feedLoader.hidden = true;
    updateFeedSentinel();
  }
}

async function openProfile(userKeyOrName) {
  activeProfileKey = userKeyOrName;
  activePostId = null;
  const r = await api(`/api/user.php?u=${encodeURIComponent(userKeyOrName)}`, { method: "GET" });
  setViewTitle(`${t("profileTitle")} @${r.profile.username}`);
  renderProfileHeader(r.profile);
  el.feed.textContent = "";
  const posts = Array.isArray(r.posts) ? r.posts : [];
  if (!posts.length) {
    const empty = document.createElement("div");
    empty.className = "muted";
    empty.textContent = t("noPosts");
    empty.dataset.empty = "true";
    el.feed.appendChild(empty);
  } else {
    for (const p of posts) el.feed.appendChild(postNode(p));
  }
  updateFeedSentinel();
}

async function openPost(postId) {
  activeProfileKey = null;
  activePostId = postId;
  clearProfileHeader();
  const r = await api(`/api/post.php?id=${encodeURIComponent(postId)}`, { method: "GET" });
  setViewTitle(t("postViewTitle"));
  el.feed.textContent = "";
  if (r.post) el.feed.appendChild(postNode(r.post));
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
      if (!token) return;
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
        api(`/api/view.php?id=${encodeURIComponent(postId)}`, { method: "POST" })
          .then((r) => {
            const n = Number(r?.viewCount);
            if (!Number.isFinite(n)) return;
            const strong = node.querySelector("[data-role='viewCount']");
            if (strong) strong.textContent = String(n);
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
  if (!token) return;
  const h = location.hash || "#home";
  const mProfile = /^#u\/(.+)$/.exec(h);
  const mPost = /^#p\/(.+)$/.exec(h);

  if (mProfile) {
    const key = decodeURIComponent(mProfile[1]);
    openProfile(key).catch(() => {});
    return;
  }
  if (mPost) {
    const id = decodeURIComponent(mPost[1]);
    openPost(id).catch(() => {});
    return;
  }

  activeProfileKey = null;
  activePostId = null;
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
    left.textContent = `@${r.username}`;
    const right = document.createElement("div");
    right.className = "badge";
    right.textContent = r.key;
    item.appendChild(left);
    item.appendChild(right);
    item.addEventListener("click", () => {
      el.searchResults.hidden = true;
      el.searchInput.value = "";
      location.hash = `#u/${encodeURIComponent(r.key)}`;
    });
    el.searchResults.appendChild(item);
  }
}

let composeMedia = [];
let composeUploading = 0;

function updateComposeCount() {
  const len = el.composeText.value.length;
  el.composeCount.textContent = `${len}/280`;
}

function renderComposeMedia() {
  el.composeMedia.textContent = "";
  if (!composeMedia.length) {
    el.composeMedia.hidden = true;
    return;
  }
  el.composeMedia.hidden = false;
  el.composeMedia.appendChild(
    mediaGridNode(composeMedia, {
      removable: true,
      onRemove: (item) => {
        composeMedia = composeMedia.filter((m) => m.url !== item.url);
        renderComposeMedia();
      },
    }),
  );
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
  el.composeText.value = "";
  if (el.composeVisibility) el.composeVisibility.value = "public";
  composeMedia = [];
  composeUploading = 0;
  updateComposeCount();
  renderComposeMedia();
  el.composeSend.disabled = false;
}

function openCompose() {
  resetCompose();
  showOverlay(el.composeModal);
  window.setTimeout(() => el.composeText.focus(), 0);
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
  if (!/^image\//.test(file.type) && !/^video\//.test(file.type)) throw new Error("INVALID_FILE");

  const dataUrl = await readFileAsDataUrl(file);
  let r;
  try {
    r = await api("/api/upload.php", { method: "POST", body: toFormData({ dataUrl }) });
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
  el.composeSend.disabled = true;
  setMsg(el.composeMsg, t("uploadProgress"));

  for (const f of slice) {
    try {
      const media = await uploadFile(f);
      if (media) {
        composeMedia.push(media);
        renderComposeMedia();
      }
    } catch (err) {
      const code = String(err?.message || "");
      if (code === "FILE_TOO_LARGE") showToast(t("fileTooLarge"), true);
      else if (code === "INVALID_FILE") showToast(t("invalidFile"), true);
      else showToast(humanizeError(code, t("error_upload_invalid")), true);
    } finally {
      composeUploading -= 1;
    }
  }

  setMsg(el.composeMsg, "");
  el.composeSend.disabled = false;
}

let pendingAvatarUrl = null;
function openProfileEdit() {
  if (!me) return;
  pendingAvatarUrl = me.avatarUrl || "";
  setAvatarPreview(pendingAvatarUrl);
  el.profileBio.value = me.bio || "";
  setMsg(el.profileMsg, "");
  showOverlay(el.profileModal);
}

function closeProfileEdit() {
  hideOverlay(el.profileModal);
}

async function openInsights() {
  if (!me) return;
  setMsg(el.insightsMsg, "");
  showOverlay(el.insightsModal);
  if (el.insightsPosts) el.insightsPosts.textContent = "…";
  if (el.insightsViews) el.insightsViews.textContent = "…";
  if (el.insightsLikes) el.insightsLikes.textContent = "…";
  try {
    const r = await api("/api/insights.php", { method: "GET" });
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
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) onClose();
  });
}

async function boot() {
  applyI18n();
  switchAuthTab("login");

  if (el.langSelect) {
    el.langSelect.addEventListener("change", () => {
      lang = el.langSelect.value || "ar";
      if (!["ar", "en", "fr"].includes(lang)) lang = "ar";
      localStorage.setItem(langKey, lang);
      applyI18n();
      if (me) route();
    });
  }

  if (location.protocol === "file:") {
    showAuth();
    const warn = t("error_file_origin");
    setMsg(el.loginMsg, warn, true);
    setMsg(el.registerMsg, warn, true);
  }

  el.tabLogin.addEventListener("click", () => switchAuthTab("login"));
  el.tabRegister.addEventListener("click", () => switchAuthTab("register"));

  el.loginForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg(el.loginMsg, "");
    const fd = new FormData(el.loginForm);
    const username = String(fd.get("username") || "");
    const password = String(fd.get("password") || "");
    try {
      const r = await api("/api/login.php", { method: "POST", body: toFormData({ username, password }) });
      const nextToken = r && r.token ? String(r.token) : "";
      const nextUser = (r && (r.user || r.me)) || null;
      if (!nextToken || !nextUser) throw new Error("SERVER_ERROR");
      token = nextToken;
      localStorage.setItem(tokenKey, token);
      me = nextUser;
      showApp();
      route();
    } catch (err) {
      setMsg(el.loginMsg, humanizeError(err?.message), true);
    }
  });

  el.registerForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    setMsg(el.registerMsg, "");
    const fd = new FormData(el.registerForm);
    const username = String(fd.get("username") || "");
    const password = String(fd.get("password") || "");
    try {
      const r = await api("/api/signup.php", { method: "POST", body: toFormData({ username, password }) });
      const nextToken = r && r.token ? String(r.token) : "";
      const nextUser = (r && (r.user || r.me)) || null;
      if (!nextToken || !nextUser) throw new Error("SERVER_ERROR");
      token = nextToken;
      localStorage.setItem(tokenKey, token);
      me = nextUser;
      showApp();
      route();
    } catch (err) {
      setMsg(el.registerMsg, humanizeError(err?.message), true);
    }
  });

  el.logoutBtn.addEventListener("click", async () => {
    try {
      await api("/api/logout.php", { method: "POST" });
    } catch {
      // ignore
    }
    clearSession();
    showAuth();
  });

  const homeBrand = document.getElementById("homeBrand");
  const goHome = () => {
    if (!token) return;
    location.hash = "#home";
    route();
  };
  if (homeBrand) {
    homeBrand.addEventListener("click", () => goHome());
    homeBrand.addEventListener("keydown", (e) => {
      if (e.key !== "Enter" && e.key !== " ") return;
      e.preventDefault();
      goHome();
    });
  }

  el.meBtn.addEventListener("click", () => {
    if (!me) return;
    location.hash = `#u/${encodeURIComponent(me.username.toLowerCase())}`;
  });

  el.refreshBtn.addEventListener("click", () => route());
  ensureInfiniteFeed();

  el.composeFab.addEventListener("click", () => openCompose());
  el.composeClose.addEventListener("click", () => closeCompose());
  bindOverlayClose(el.composeModal, () => closeCompose());
  el.composeText.addEventListener("input", () => updateComposeCount());
  el.composeAddMedia.addEventListener("click", () => el.composeFiles.click());
  el.composeFiles.addEventListener("change", async () => {
    // Snapshot the FileList before clearing the input value.
    // Some browsers treat FileList as a live view, and clearing the input empties it.
    const files = Array.from(el.composeFiles.files || []);
    el.composeFiles.value = "";
    await handleComposeFiles(files);
  });

  el.composeSend.addEventListener("click", async () => {
    setMsg(el.composeMsg, "");
    const text = String(el.composeText.value || "");
    const hasText = !!text.trim();
    const hasMedia = composeMedia.length > 0;
    if (!hasText && !hasMedia) return setMsg(el.composeMsg, t("error_invalid_post"), true);
    if (composeUploading > 0) return;
    el.composeSend.disabled = true;
    try {
      let visibility = el.composeVisibility ? String(el.composeVisibility.value || "public") : "public";
      if (visibility !== "public" && visibility !== "private") visibility = "public";
      await api("/api/posts.php", {
        method: "POST",
        body: toFormData({ text, media: JSON.stringify(composeMedia), visibility }),
      });
      closeCompose();
      showToast(t("postSent"));
      location.hash = "#home";
      await loadFeed({ reset: true });
    } catch (err) {
      setMsg(el.composeMsg, humanizeError(err?.message, t("error_invalid_post")), true);
    } finally {
      el.composeSend.disabled = false;
    }
  });

  el.profileClose.addEventListener("click", () => closeProfileEdit());
  bindOverlayClose(el.profileModal, () => closeProfileEdit());
  el.avatarPick.addEventListener("click", () => el.avatarFile.click());
  el.avatarRemove.addEventListener("click", () => {
    pendingAvatarUrl = "";
    setAvatarPreview("");
  });
  el.avatarFile.addEventListener("change", async () => {
    const file = el.avatarFile.files && el.avatarFile.files[0];
    el.avatarFile.value = "";
    if (!file) return;
    setMsg(el.profileMsg, t("uploadProgress"));
    el.profileSave.disabled = true;
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
      el.profileSave.disabled = false;
    }
  });
  el.profileSave.addEventListener("click", async () => {
    setMsg(el.profileMsg, "");
    el.profileSave.disabled = true;
    try {
      const bio = String(el.profileBio.value || "");
      const r = await api("/api/profile.php", {
        method: "POST",
        body: toFormData({ bio, avatarUrl: pendingAvatarUrl }),
      });
      me = r.me;
      closeProfileEdit();
      showToast(t("saved"));
      if (activeProfileKey && me && activeProfileKey === me.username.toLowerCase()) route();
    } catch (err) {
      setMsg(el.profileMsg, humanizeError(err?.message), true);
    } finally {
      el.profileSave.disabled = false;
    }
  });

  if (el.insightsClose) el.insightsClose.addEventListener("click", () => closeInsights());
  bindOverlayClose(el.insightsModal, () => closeInsights());

  el.reportClose.addEventListener("click", () => closeReport());
  bindOverlayClose(el.reportModal, () => closeReport());
  el.reportSend.addEventListener("click", async () => {
    setMsg(el.reportMsg, "");
    const reason = String(el.reportReason.value || "");
    const note = String(el.reportNote.value || "");
    if (!reportTargetPostId) return;
    el.reportSend.disabled = true;
    try {
      await api("/api/report.php", {
        method: "POST",
        body: toFormData({ type: "post", targetId: reportTargetPostId, reason, note }),
      });
      closeReport();
      showToast(t("reportSent"));
    } catch (err) {
      setMsg(el.reportMsg, humanizeError(err?.message), true);
    } finally {
      el.reportSend.disabled = false;
    }
  });

  el.searchInput.addEventListener(
    "input",
    debounce(async () => {
      const q = el.searchInput.value.trim();
      if (!q) return showSearchResults([]);
      try {
        const r = await api(`/api/search.php?q=${encodeURIComponent(q)}`, { method: "GET" });
        showSearchResults(r.results || []);
      } catch {
        showSearchResults([]);
      }
    }, 250),
  );

  window.addEventListener("click", (e) => {
    const target = e.target;
    if (!target) return;
    if (!el.searchResults.hidden && !el.searchResults.contains(target) && !el.searchInput.contains(target)) {
      el.searchResults.hidden = true;
    }
    if (openMenu) {
      const wrap = openMenu.parentElement;
      if (!wrap || !wrap.contains(target)) closeMenu();
    }
  });

  window.addEventListener("keydown", (e) => {
    if (e.key !== "Escape") return;
    if (!el.composeModal.hidden) closeCompose();
    if (!el.profileModal.hidden) closeProfileEdit();
    if (!el.reportModal.hidden) closeReport();
    if (el.insightsModal && !el.insightsModal.hidden) closeInsights();
    closeMenu();
  });

  window.addEventListener("hashchange", () => route());

  if (!token) {
    showAuth();
    return;
  }

  try {
    const r = await api("/api/me.php", { method: "GET" });
    me = r.me;
    showApp();
    route();
    api("/api/version.php", { method: "GET" }).catch(() => showToast(t("error_server_outdated"), true));
  } catch {
    showAuth();
  }
}

boot();
