const STORAGE_KEY = "calisthenics_ranked_prev_positions_v1";
const LANG = (document.documentElement.lang || "en").toLowerCase().startsWith("es") ? "es" : "en";

const I18N = {
  en: {
    position: "Position",
    athlete: "Athlete",
    state: "State",
    up: "Moved up",
    tie: "Tie",
    pointsSuffix: "pts",
  },
  es: {
    position: "Posición",
    athlete: "Atleta",
    state: "Estado",
    up: "Subió",
    tie: "Empate",
    pointsSuffix: "pts",
  }
};

const TEXT = I18N[LANG];

const athletes = [
  {
    id: 1,
    name: "paracu",
    points: 5 + 3 + 2 + 3 + 2,
    photo: "photos/paracu.jpeg",
    socials: {
      instagram: "https://www.instagram.com/paracu.sw/",
      youtube: "https://youtube.com/@paracu_sw?si=YCiXktwlxgzpzq3P",
      tiktok: "https://www.tiktok.com/@user691637720?_r=1&_t=ZN-942DjwGJtcU"
    },
    videoUrl: "https://www.instagram.com/reel/DPQelW6jZ55/?igsh=MWo2eWRubGJlN2N5cg==",
    videoDuration: "0:20",
  },
];

const $list = document.getElementById("athletesList");
const $search = document.getElementById("searchInput");

const $statTotal = document.getElementById("statTotal");
const $statUps = document.getElementById("statUps");
const $statTies = document.getElementById("statTies");

const $overlay = document.getElementById("modalOverlay");
const $modalClose = document.getElementById("modalClose");
const $modalTitle = document.getElementById("modalTitle");
const $modalPhoto = document.getElementById("modalPhoto");
const $modalPoints = document.getElementById("modalPoints");
const $modalDuration = document.getElementById("modalDuration");
const $modalVideo = document.getElementById("modalVideo");
const $modalAthleteInfo = document.getElementById("modalAthleteInfo");

let ranked = [];
let query = "";
let prevPositions = loadPrevPositions();
let renderLimit = 50;
let lastFilteredCacheKey = "";
let filteredCache = [];

function norm(s) {
  return (s ?? "").toString().trim().toLowerCase();
}

function makeFilterKey() {
  return `${norm(query)}|${ranked.length}`;
}

function getFilteredRanked() {
  const key = makeFilterKey();
  if (key === lastFilteredCacheKey) return filteredCache;

  const q = norm(query);
  const jumpPos = parsePositionJump(query);

  const filtered = ranked.filter((a) => {
    if (!q) return true;
    if (jumpPos !== null) return a.position >= jumpPos;
    return norm(a.name).includes(q) || String(a.position).includes(q) || (`#${a.position}`).includes(q);
  });

  lastFilteredCacheKey = key;
  filteredCache = filtered;
  return filteredCache;
}

function ensureScrollLoader() {
  if (ensureScrollLoader._bound) return;
  ensureScrollLoader._bound = true;

  window.addEventListener("scroll", () => {
    const nearBottom = window.innerHeight + window.scrollY >= document.body.offsetHeight - 400;
    if (!nearBottom) return;

    const filtered = getFilteredRanked();
    if (renderLimit >= filtered.length) return;

    renderLimit = Math.min(renderLimit + 50, filtered.length);
    renderList();
  }, { passive: true });
}

function parsePositionJump(raw) {
  const s = String(raw ?? "").trim();
  if (!s) return null;
  const m = s.match(/^#?\s*(\d+)$/);
  if (!m) return null;
  const n = Number(m[1]);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function loadPrevPositions() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return {};
    return parsed;
  } catch {
    return {};
  }
}

function savePrevPositions(map) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(map));
  } catch {
  }
}

function setLinkOrHide($a, href) {
  if (href) {
    $a.style.display = "inline-flex";
    $a.href = href;
  } else {
    $a.style.display = "none";
    $a.href = "#";
  }
}

function getAthleteInfoLink(a) {
  return (
    a.athleteInfoUrl ||
    a.socials?.instagram ||
    a.socials?.youtube ||
    a.socials?.tiktok ||
    null
  );
}

function makeAvatarDataUri(name) {
  const initials = name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join("");

  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  const hue = hash % 360;

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
  <svg xmlns="http://www.w3.org/2000/svg" width="400" height="400" viewBox="0 0 400 400">
    <defs>
      <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stop-color="hsl(${hue}, 70%, 85%)"/>
        <stop offset="1" stop-color="hsl(${(hue + 30) % 360}, 70%, 75%)"/>
      </linearGradient>
    </defs>
    <rect width="400" height="400" rx="40" fill="url(#g)"/>
    <text x="200" y="230" text-anchor="middle" font-family="system-ui" font-size="110" font-weight="900" fill="rgba(0,0,0,0.65)">${initials}</text>
  </svg>`;

  const encoded = encodeURIComponent(svg).replaceAll("%0A", "");
  return `data:image/svg+xml;charset=UTF-8,${encoded}`;
}

function computeRanking() {
  const sorted = [...athletes].sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    return a.name.localeCompare(b.name, "es");
  });

  const pointsCount = new Map();
  for (const a of sorted) pointsCount.set(a.points, (pointsCount.get(a.points) ?? 0) + 1);

  ranked = sorted.map((a, idx) => {
    const position = idx + 1;
    const prev = Number(prevPositions[a.id] ?? position);
    const isTie = (pointsCount.get(a.points) ?? 0) >= 2;
    const isUp = prev > position;

    return {
      ...a,
      position,
      previousPosition: prev,
      isTie,
      isUp,
      photo: a.photo ?? makeAvatarDataUri(a.name)
    };
  });
}

function persistCurrentPositions() {
  const next = {};
  for (const a of ranked) next[a.id] = a.position;
  savePrevPositions(next);
}

function getRankBadge(position) {
  if (position === 1) return { text: "🏆", className: "rank-badge--gold" };
  if (position === 2) return { text: "🏆", className: "rank-badge--silver" };
  if (position === 3) return { text: "🏆", className: "rank-badge--bronze" };
  return { text: `#${position}`, className: "rank-badge--normal" };
}

function getStateClasses(a) {
  const card = ["athlete-card"];
  const points = ["points-badge"];

  if (a.isTie) {
    card.push("athlete-card--tie");
    points.push("points-badge--tie");
  } else if (a.isUp) {
    card.push("athlete-card--up");
    points.push("points-badge--up");
  } else {
    points.push("points-badge--normal");
  }

  return { card: card.join(" "), points: points.join(" ") };
}

function renderStats() {
  $statTotal.textContent = String(ranked.length);
  $statUps.textContent = String(ranked.filter((a) => a.isUp).length);
  $statTies.textContent = String(ranked.filter((a) => a.isTie).length);
}

function renderList() {
  const filtered = getFilteredRanked();
  const slice = filtered.slice(0, Math.max(0, renderLimit));

  $list.innerHTML = "";

  for (const a of slice) {
    const badge = getRankBadge(a.position);
    const state = getStateClasses(a);
    const meta = (a.position <= 3) ? `${TEXT.position} ${a.position}` : TEXT.athlete;

    const icons = [];
    if (a.isUp) icons.push(`<span class="state-icon--up" title="${TEXT.up}">▲</span>`);
    if (a.isTie) icons.push(`<span class="state-icon--tie" title="${TEXT.tie}">⚠</span>`);

    const card = document.createElement("article");
    card.className = state.card;
    card.setAttribute("role", "button");
    card.setAttribute("tabindex", "0");

    card.innerHTML = `
      <div class="rank-badge ${badge.className}" aria-hidden="true">${badge.text}</div>
      <div class="athlete-main">
        <p class="athlete-name">${a.name}</p>
        <p class="athlete-meta">${meta}</p>
      </div>
      <div class="athlete-right">
        <div class="state-icons" aria-label="${TEXT.state}">${icons.join("")}</div>
        <div class="${state.points}">${a.points} ${TEXT.pointsSuffix}</div>
      </div>
    `.trim();

    card.addEventListener("click", () => openModal(a.id));
    card.addEventListener("keydown", (ev) => {
      if (ev.key === "Enter" || ev.key === " ") {
        ev.preventDefault();
        openModal(a.id);
      }
    });

    $list.appendChild(card);
  }

  renderStats();
  ensureScrollLoader();
}

function openModal(id) {
  const a = ranked.find((x) => x.id === id);
  if (!a) return;

  $modalTitle.textContent = `#${a.position} - ${a.name}`;
  $modalPhoto.src = a.photo;
  $modalPoints.textContent = String(a.points);
  if ($modalDuration) $modalDuration.textContent = a.videoDuration ?? "—";

  if (a.videoUrl && a.videoUrl !== "#") {
    $modalVideo.style.display = "inline-flex";
    $modalVideo.href = a.videoUrl;
  } else {
    $modalVideo.style.display = "none";
  }

  setLinkOrHide($modalAthleteInfo, getAthleteInfoLink(a));

  $overlay.classList.add("is-open");
  $overlay.setAttribute("aria-hidden", "false");
}

function closeModal() {
  $overlay.classList.remove("is-open");
  $overlay.setAttribute("aria-hidden", "true");
}

$modalClose?.addEventListener("click", closeModal);
$overlay?.addEventListener("click", (ev) => {
  if (ev.target === $overlay) closeModal();
});

document.addEventListener("keydown", (ev) => {
  if (ev.key === "Escape" && $overlay?.classList.contains("is-open")) closeModal();
});

$search?.addEventListener("input", (ev) => {
  query = ev.target.value;
  renderLimit = 50;
  lastFilteredCacheKey = "";
  renderList();
});

computeRanking();
renderList();
persistCurrentPositions();
