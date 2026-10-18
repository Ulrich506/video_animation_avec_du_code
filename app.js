"use strict";

// Les durées sont éditables ; leur somme doit rester égale à 60 secondes.
const SCENE_DURATIONS = {
  intro: 6,
  formation: 10,
  skills: 14,
  projects: 16,
  experience: 8,
  contact: 6
};

// Remplacez ici les textes, coordonnées, projets et compétences de démonstration.
const CONFIG = {
  name: "Root",
  role: "DÉVELOPPEUR FULL-STACK / SYSADMIN",
  education: ["École Nationale d’Informatique", "Université de Fianarantsoa", "Parcours SDI · Niveau L3", "Madagascar"],
  skills: [
    { name: "Web full-stack", value: 88, tags: "React · Vue · PHP · Odoo" },
    { name: "Systèmes & réseaux", value: 82, tags: "Linux Ubuntu · pfSense · Asterisk / VoIP" },
    { name: "Cybersécurité", value: 72, tags: "Sécurité réseau · bonnes pratiques" },
    { name: "Développement mobile", value: 68, tags: "Kotlin · Jetpack Compose" }
  ],
  projects: [
    { title: "A2 Billing", type: "PLATEFORME VOIP", desc: "Facturation et services basés sur Asterisk.", color: "#efa36a", icon: "01" },
    { title: "Gestion d’état civil", type: "MODULE ODOO", desc: "Gestion numérique des actes et dossiers.", color: "#d8b28d", icon: "02" },
    { title: "RichVente", type: "MARKETPLACE", desc: "Marketplace full-stack pour vendre en ligne.", color: "#d98758", icon: "03" }
  ],
  experience: ["À LA RECHERCHE D’UN STAGE", "Prêt à contribuer et à apprendre sur le terrain.", "Développement · Systèmes · Réseaux"],
  contact: { email: "votre.email@example.com", github: "github.com/votre-profil", portfolio: "votre-portfolio.dev" },
  colors: { background: "#171512", panel: "#211e1a", orange: "#df8750", light: "#f4eee6", muted: "#c2b6a9", blue: "#86bbca", skin: "#e9b59a", hair: "#191817" }
};

const TOTAL_DURATION = Object.values(SCENE_DURATIONS).reduce((total, duration) => total + duration, 0);
if (TOTAL_DURATION !== 60) throw new Error("La somme de SCENE_DURATIONS doit être de 60 secondes.");

const canvas = document.querySelector("#cv");
const ctx = canvas.getContext("2d");
const stage = document.querySelector(".stage");
const clock = document.querySelector("#clock");
const seek = document.querySelector("#seek");
const status = document.querySelector("#status");
const formatSelect = document.querySelector("#format");
const resolutionSelect = document.querySelector("#resolution");
const controls = [...document.querySelectorAll(".transport .button"), document.querySelector("#export")];
const C = CONFIG.colors;
const formatPresets = {
  desktop: { width: 1920, height: 1080 },
  laptop: { width: 1600, height: 900 },
  tablet: { width: 1440, height: 1080 },
  phone: { width: 1080, height: 1920 },
  foldable: { width: 1440, height: 1800 }
};
const particles = Array.from({ length: 72 }, (_, i) => ({
  x: (i * 7919 % 1920) / 1920,
  y: (i * 3571 % 1920) / 1920,
  radius: 1 + (i % 3) * .8,
  phase: i * 1.73,
  speed: .28 + (i % 5) * .09
}));
const state = { time: 0 };
const sceneNames = Object.keys(SCENE_DURATIONS);
const sceneStarts = {};
let activeFontScale = 1;
let elapsed = 0;
for (const scene of sceneNames) {
  sceneStarts[scene] = elapsed;
  elapsed += SCENE_DURATIONS[scene];
}

let recorder = null;
let recordingStream = null;
let chunks = [];
let isSeeking = false;

const clamp = (value, min = 0, max = 1) => Math.min(max, Math.max(min, value));
const smooth = value => {
  const x = clamp(value);
  return x * x * (3 - 2 * x);
};
const progress = scene => clamp((state.time - sceneStarts[scene]) / SCENE_DURATIONS[scene]);
const localTime = scene => Math.max(0, state.time - sceneStarts[scene]);

function setStatus(message) {
  status.textContent = message;
}

function even(value) {
  return Math.max(2, Math.round(value / 2) * 2);
}

function outputSize() {
  const source = formatPresets[formatSelect.value];
  const quality = resolutionSelect.value === "source" ? Math.max(source.width, source.height) : Number(resolutionSelect.value) * (1920 / 1080);
  const scale = Math.min(1, quality / Math.max(source.width, source.height));
  return { width: even(source.width * scale), height: even(source.height * scale) };
}

function applyFormat() {
  if (recorder && recorder.state !== "inactive") return;
  const { width, height } = outputSize();
  canvas.width = width;
  canvas.height = height;
  stage.dataset.format = formatSelect.value;
  canvas.setAttribute("aria-label", `CV animé de ${CONFIG.name}, ${width} par ${height} pixels`);
  render();
}

function roundedRect(x, y, width, height, radius, fill, stroke, lineWidth = 1) {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
  if (fill) { ctx.fillStyle = fill; ctx.fill(); }
  if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = lineWidth; ctx.stroke(); }
}

function text(value, x, y, size, color = C.light, weight = 500, align = "left", maxWidth) {
  ctx.fillStyle = color;
  ctx.font = `${weight} ${size * activeFontScale}px Inter, "Segoe UI", Arial, sans-serif`;
  ctx.textAlign = align;
  ctx.textBaseline = "middle";
  if (maxWidth) ctx.fillText(value, x, y, maxWidth);
  else ctx.fillText(value, x, y);
}

function fitText(value, x, y, size, maxWidth, color = C.light, weight = 600, align = "left", minimum = 15) {
  let fitted = size;
  ctx.font = `${weight} ${fitted * activeFontScale}px Inter, "Segoe UI", Arial, sans-serif`;
  while (fitted > minimum && ctx.measureText(value).width > maxWidth) {
    fitted -= 1;
    ctx.font = `${weight} ${fitted * activeFontScale}px Inter, "Segoe UI", Arial, sans-serif`;
  }
  text(value, x, y, fitted, color, weight, align, maxWidth);
}

function wrapText(value, x, y, maxWidth, lineHeight, size, color = C.muted, weight = 500, maxLines = 3) {
  ctx.font = `${weight} ${size * activeFontScale}px Inter, "Segoe UI", Arial, sans-serif`;
  const words = value.split(/\s+/);
  let line = "";
  const lines = [];
  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else line = candidate;
  }
  if (line) lines.push(line);
  lines.slice(0, maxLines).forEach((item, i) => text(item, x, y + i * lineHeight * activeFontScale, size, color, weight));
}

function panel(x, y, width, height, accent = C.orange, radius = 18) {
  ctx.save();
  ctx.shadowColor = "#0005";
  ctx.shadowBlur = 24;
  ctx.shadowOffsetY = 10;
  roundedRect(x, y, width, height, radius, C.panel, "#ffffff17", 1);
  ctx.restore();
  ctx.save();
  ctx.globalAlpha = .9;
  roundedRect(x, y, 4, height, 2, accent);
  ctx.restore();
}

function drawBackground(width, height, unit, motion) {
  const gradient = ctx.createLinearGradient(0, 0, width, height);
  gradient.addColorStop(0, "#211b16");
  gradient.addColorStop(.52, C.background);
  gradient.addColorStop(1, "#1d1a17");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, width, height);

  const haze = ctx.createRadialGradient(width * .68, height * .55, 0, width * .68, height * .55, Math.max(width, height) * .65);
  haze.addColorStop(0, "#d67d3d17");
  haze.addColorStop(1, "transparent");
  ctx.fillStyle = haze;
  ctx.fillRect(0, 0, width, height);

  ctx.save();
  for (const particle of particles) {
    const y = ((particle.y * height + motion * particle.speed * 7) % (height + 20)) - 10;
    ctx.globalAlpha = .15 + .28 * Math.abs(Math.sin(motion + particle.phase));
    ctx.fillStyle = particle.phase % 2 > 1 ? C.orange : C.light;
    ctx.beginPath();
    ctx.arc(particle.x * width, y, particle.radius * unit, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.globalAlpha = .045;
  ctx.strokeStyle = C.light;
  ctx.lineWidth = Math.max(1, unit);
  const step = 56 * unit;
  for (let x = 0; x < width; x += step) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, height); ctx.stroke();
  }
  ctx.restore();
}

function drawHeader(width, height, unit, index, section, portrait) {
  const margin = (portrait ? 58 : 76) * unit;
  text("ROOT  /  PORTFOLIO", margin, 48 * unit, 15 * unit, C.orange, 800);
  text(section.toUpperCase(), margin, 78 * unit, 11 * unit, C.muted, 600);
  const barY = 108 * unit;
  ctx.fillStyle = "#ffffff22";
  ctx.fillRect(margin, barY, width - margin * 2, Math.max(1, unit));
  ctx.fillStyle = C.orange;
  ctx.fillRect(margin, barY, (width - margin * 2) * (index / 6), Math.max(2, 2 * unit));
  if (!portrait) text(`${String(index).padStart(2, "0")} / 06`, width - margin, 48 * unit, 13 * unit, C.muted, 700, "right");
}

function speechBubble(x, y, width, message, unit, portrait = false) {
  const size = 20 * unit;
  const height = 50 * unit;
  roundedRect(x, y, width, height, 13 * unit, "#f2ede6", "#ffffff55", unit);
  fitText(message, x + width / 2, y + height / 2, size, width - 24 * unit, "#27211b", 650, "center", 11 * unit);
  if (portrait) {
    ctx.fillStyle = "#f2ede6";
    ctx.beginPath(); ctx.moveTo(x + width / 2 - 8 * unit, y + height - unit); ctx.lineTo(x + width / 2, y + height + 10 * unit); ctx.lineTo(x + width / 2 + 8 * unit, y + height - unit); ctx.fill();
  }
}

// Chibi inspiré de la référence : cheveux noirs volumineux, grands yeux bruns,
// veste sombre, t-shirt clair, pantalon et baskets. Le mouvement reste vectoriel.
function drawChibi(x, baseline, scale, pose, time, unit) {
  ctx.save();
  ctx.translate(x, baseline + Math.sin(time * 3.2) * 4 * unit);
  ctx.scale(scale, scale);
  const stride = pose === "walk" ? Math.sin(time * 9) : 0;
  const wave = pose === "wave" ? Math.sin(time * 10) : 0;

  // Ombre souple au sol.
  ctx.save(); ctx.globalAlpha = .24; ctx.fillStyle = "#000";
  ctx.beginPath(); ctx.ellipse(0, 3, 112, 15, 0, 0, Math.PI * 2); ctx.fill(); ctx.restore();

  // Pantalon et baskets.
  ctx.fillStyle = "#272522";
  ctx.beginPath(); ctx.moveTo(-54, -202); ctx.lineTo(-6, -202); ctx.lineTo(-17 + stride * 8, -52); ctx.lineTo(-62 + stride * 8, -52); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(5, -202); ctx.lineTo(55, -202); ctx.lineTo(61 - stride * 8, -52); ctx.lineTo(17 - stride * 8, -52); ctx.closePath(); ctx.fill();
  ctx.fillStyle = "#4b4741";
  ctx.fillRect(-61 + stride * 8, -72, 46, 13); ctx.fillRect(15 - stride * 8, -72, 46, 13);
  roundedRect(-77 + stride * 8, -59, 82, 34, 14, "#e8e5dc", "#aaa69c", 3);
  roundedRect(3 - stride * 8, -59, 82, 34, 14, "#e8e5dc", "#aaa69c", 3);
  roundedRect(-71 + stride * 8, -55, 72, 15, 8, "#25282a");
  roundedRect(9 - stride * 8, -55, 72, 15, 8, "#25282a");
  ctx.strokeStyle = "#d3d0c8"; ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath(); ctx.moveTo(-42 + stride * 8, -48 + i * 6); ctx.lineTo(-23 + stride * 8, -48 + i * 6); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(27 - stride * 8, -48 + i * 6); ctx.lineTo(46 - stride * 8, -48 + i * 6); ctx.stroke();
  }

  // T-shirt, veste ouverte et col.
  roundedRect(-78, -345, 156, 168, 38, "#e7e4dc", "#292623", 5);
  roundedRect(-101, -349, 64, 174, 28, "#282624", "#11100f", 5);
  roundedRect(37, -349, 64, 174, 28, "#282624", "#11100f", 5);
  ctx.fillStyle = C.blue;
  ctx.beginPath(); ctx.moveTo(-39, -348); ctx.lineTo(-13, -324); ctx.lineTo(-21, -199); ctx.lineTo(-40, -184); ctx.closePath(); ctx.fill();
  ctx.beginPath(); ctx.moveTo(39, -348); ctx.lineTo(13, -324); ctx.lineTo(21, -199); ctx.lineTo(40, -184); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = "#c4b7a7"; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.moveTo(0, -315); ctx.lineTo(0, -212); ctx.stroke();
  ctx.fillStyle = "#6d6860"; ctx.beginPath(); ctx.arc(0, -277, 3, 0, 7); ctx.arc(0, -246, 3, 0, 7); ctx.fill();
  roundedRect(-45, -205, 90, 27, 9, "#332f2a");

  if (pose === "cross") {
    // Avant-bras croisés, posture de portrait comme sur la référence.
    ctx.save(); ctx.rotate(-.08);
    roundedRect(-91, -316, 72, 34, 16, "#34312d", "#141312", 3);
    ctx.restore();
    ctx.save(); ctx.rotate(.1);
    roundedRect(18, -287, 78, 34, 16, "#34312d", "#141312", 3);
    ctx.restore();
    ctx.fillStyle = C.skin; ctx.beginPath(); ctx.ellipse(-7, -290, 19, 13, -.1, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(12, -311, 19, 13, .1, 0, 7); ctx.fill();
  } else {
    // Bras mobiles pour le salut, la marche et la présentation.
    ctx.save();
    const angle = pose === "wave" ? -.7 + wave * .42 : pose === "point" ? -.95 : .24 + stride * .12;
    ctx.translate(73, -326); ctx.rotate(angle);
    roundedRect(-18, -14, 40, 112, 19, "#302d29", "#151412", 3);
    ctx.fillStyle = C.skin; ctx.beginPath(); ctx.ellipse(2, 99, 20, 18, 0, 0, 7); ctx.fill();
    if (pose === "wave") {
      ctx.strokeStyle = C.skin; ctx.lineWidth = 7; ctx.beginPath();
      ctx.moveTo(0, 100); ctx.lineTo(-15, 120); ctx.moveTo(1, 101); ctx.lineTo(13, 122); ctx.stroke();
    }
    ctx.restore();
    ctx.save(); ctx.translate(-78, -324); ctx.rotate(-.1);
    roundedRect(-18, -12, 40, 99, 19, "#302d29", "#151412", 3);
    ctx.fillStyle = C.skin; ctx.beginPath(); ctx.ellipse(2, 88, 19, 17, 0, 0, 7); ctx.fill();
    ctx.restore();
  }

  if (pose === "type") {
    // Un petit ordinateur portable apparaît uniquement pendant la scène projets.
    roundedRect(-96, -222, 192, 122, 10, "#262a2b", "#a5b5b6", 4);
    roundedRect(-86, -212, 172, 100, 4, "#1b2428");
    text("root_", 0, -163, 22, C.blue, 700, "center");
    ctx.beginPath(); ctx.moveTo(-114, -99); ctx.lineTo(114, -99); ctx.lineTo(97, -83); ctx.lineTo(-97, -83); ctx.closePath();
    ctx.fillStyle = "#b8b7b0"; ctx.fill();
  }

  // Cou, oreilles et visage éclairé.
  roundedRect(-29, -430, 58, 63, 20, C.skin);
  const face = ctx.createRadialGradient(-35, -493, 8, 0, -455, 145);
  face.addColorStop(0, "#f5cbb0"); face.addColorStop(1, "#cf9079");
  ctx.fillStyle = face; ctx.strokeStyle = "#29201c"; ctx.lineWidth = 5;
  ctx.beginPath(); ctx.ellipse(0, -470, 102, 120, 0, 0, 7); ctx.fill(); ctx.stroke();
  ctx.fillStyle = C.skin;
  ctx.beginPath(); ctx.ellipse(-99, -455, 16, 23, -.2, 0, 7); ctx.ellipse(99, -455, 16, 23, .2, 0, 7); ctx.fill();

  // Cheveux noirs en mèches superposées et reflets doux.
  const hair = ctx.createLinearGradient(-85, -585, 85, -406);
  hair.addColorStop(0, "#34312e"); hair.addColorStop(.45, "#191817"); hair.addColorStop(1, "#100f0e");
  ctx.fillStyle = hair;
  ctx.beginPath();
  ctx.moveTo(-100, -462); ctx.quadraticCurveTo(-137, -537, -81, -571);
  ctx.quadraticCurveTo(-68, -615, -25, -586); ctx.quadraticCurveTo(9, -618, 39, -583);
  ctx.quadraticCurveTo(91, -602, 106, -550); ctx.quadraticCurveTo(133, -509, 98, -453);
  ctx.lineTo(78, -489); ctx.lineTo(58, -510); ctx.lineTo(40, -491);
  ctx.lineTo(20, -516); ctx.lineTo(0, -492); ctx.lineTo(-22, -515);
  ctx.lineTo(-44, -491); ctx.lineTo(-65, -510); ctx.lineTo(-80, -478); ctx.closePath();
  ctx.fill();
  ctx.fillStyle = "#55504a";
  ctx.globalAlpha = .55;
  ctx.beginPath(); ctx.ellipse(-43, -566, 23, 6, -.35, 0, 7); ctx.ellipse(20, -581, 20, 5, .2, 0, 7); ctx.fill();
  ctx.globalAlpha = 1;

  // Les grands yeux restent au premier plan des mèches de la frange.
  const blink = Math.pow(Math.max(0, Math.sin(time * 1.8 + .4)), 32);
  const look = pose === "point" ? .17 : Math.sin(time * 1.4) * .035;
  for (const eyeX of [-42, 42]) {
    const eyeY = -474;
    ctx.save();
    ctx.beginPath(); ctx.ellipse(eyeX, eyeY, 24, Math.max(2, 30 * (1 - blink)), 0, 0, 7); ctx.clip();
    ctx.fillStyle = "#fff9ee"; ctx.fillRect(eyeX - 25, eyeY - 31, 50, 62);
    const iris = ctx.createRadialGradient(eyeX - 4, eyeY + 5, 2, eyeX, eyeY + 2, 21);
    iris.addColorStop(0, "#8c4f28"); iris.addColorStop(.58, "#532d1a"); iris.addColorStop(1, "#211612");
    ctx.fillStyle = iris;
    ctx.beginPath(); ctx.ellipse(eyeX + look * 120, eyeY + 4, 17, 23, 0, 0, 7); ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.beginPath(); ctx.arc(eyeX - 4 + look * 120, eyeY - 5, 6, 0, 7); ctx.arc(eyeX + 7 + look * 120, eyeY + 7, 2.5, 0, 7); ctx.fill();
    ctx.restore();
    ctx.strokeStyle = "#241a16"; ctx.lineWidth = 8; ctx.lineCap = "round";
    ctx.beginPath(); ctx.moveTo(eyeX - 23, -514); ctx.quadraticCurveTo(eyeX, -529, eyeX + 23, -514); ctx.stroke();
  }

  // Expression et sourire, avec micro-mouvements synchronisés à la scène.
  ctx.fillStyle = "#8d5145";
  if (pose === "wave" && Math.sin(time * 8) > .45) {
    ctx.beginPath(); ctx.ellipse(0, -418, 10, 8, 0, 0, 7); ctx.fill();
  } else {
    ctx.strokeStyle = "#915247"; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(-12, -420); ctx.quadraticCurveTo(0, -408 - Math.max(0, Math.sin(time * 3)) * 3, 13, -420); ctx.stroke();
  }
  ctx.strokeStyle = "#d79278"; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-3, -448); ctx.quadraticCurveTo(1, -439, 8, -447); ctx.stroke();
  ctx.fillStyle = "#d88879";
  ctx.globalAlpha = .35; ctx.beginPath(); ctx.ellipse(-69, -440, 16, 7, 0, 0, 7); ctx.ellipse(69, -440, 16, 7, 0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
  ctx.restore();
}

function drawSectionTitle(label, width, unit, portrait) {
  text(label.toUpperCase(), portrait ? width / 2 : width * .085, 155 * unit, 13 * unit, C.orange, 800, portrait ? "center" : "left");
}

function drawIntro(width, height, unit, portrait, p, time) {
  drawHeader(width, height, unit, 1, "Présentation", portrait);
  const titleSize = (portrait ? 76 : 116) * unit;
  const x = portrait ? width / 2 : width * .085;
  const align = portrait ? "center" : "left";
  const y = portrait ? height * .24 : height * .38;
  text("BONJOUR, JE SUIS", x, y - 80 * unit, 15 * unit, C.orange, 800, align);
  fitText(CONFIG.name, x, y + 5 * unit, titleSize, portrait ? width * .86 : width * .55, C.light, 800, align, 38 * unit);
  wrapText(CONFIG.role, x, y + 78 * unit, portrait ? width * .84 : width * .55, 27 * unit, 19 * unit, C.muted, 600, 2);
  const avatarX = portrait ? width / 2 : width * .77;
  const avatarScale = (portrait ? 1.17 : .88) * unit;
  const baseline = portrait ? height * .91 : height * .93;
  const arrival = smooth(p * 3);
  drawChibi(avatarX + (portrait ? 0 : (1 - arrival) * 220 * unit), baseline, avatarScale, p > .68 ? "wave" : "cross", time, unit);
  if (p > .42) {
    const bubbleW = (portrait ? width * .73 : width * .34);
    speechBubble(portrait ? (width - bubbleW) / 2 : width * .57, portrait ? height * .48 : height * .22, bubbleW, "Heureux de vous rencontrer !", unit, portrait);
  }
}

function drawFormation(width, height, unit, portrait, p, time) {
  drawHeader(width, height, unit, 2, "Formation", portrait);
  const x = portrait ? width * .08 : width * .085;
  const cardY = portrait ? height * .24 : height * .27;
  const cardW = portrait ? width * .84 : width * .62;
  const cardH = portrait ? height * .37 : height * .47;
  panel(x, cardY, cardW, cardH, C.orange, 18 * unit);
  text("PARCOURS ACADÉMIQUE", x + 28 * unit, cardY + 42 * unit, 13 * unit, C.orange, 800);
  const lineGap = (portrait ? 61 : 72) * unit;
  CONFIG.education.forEach((line, i) => {
    fitText(line, x + 28 * unit, cardY + (portrait ? 94 : 122) * unit + i * lineGap, (i === 0 ? 25 : 18) * unit, cardW - 56 * unit, i === 0 ? C.light : (i === 2 ? C.orange : C.muted), i === 0 ? 750 : 550, "left", 13 * unit);
  });
  const charX = portrait ? width * .5 : width * .79;
  const charBase = portrait ? height * .94 : height * .94;
  const charScale = (portrait ? .88 : .77) * unit;
  drawChibi(charX, charBase, charScale, "point", time, unit);
  if (p > .2) {
    const bubbleW = (portrait ? width * .65 : width * .3);
    speechBubble(portrait ? (width - bubbleW) / 2 : width * .59, portrait ? height * .55 : height * .23, bubbleW, "Ma formation en informatique.", unit, portrait);
  }
}

function drawSkills(width, height, unit, portrait, p, time) {
  drawHeader(width, height, unit, 3, "Compétences", portrait);
  const cardX = width * (portrait ? .07 : .08);
  const cardW = width * (portrait ? .86 : .7);
  const rowH = portrait ? 117 * unit : 132 * unit;
  const gap = 13 * unit;
  const top = portrait ? height * .205 : height * .23;
  CONFIG.skills.forEach((skill, i) => {
    const y = top + i * (rowH + gap);
    panel(cardX, y, cardW, rowH, i % 2 ? C.blue : C.orange, 13 * unit);
    const textX = cardX + 23 * unit;
    fitText(skill.name, textX, y + 28 * unit, 20 * unit, cardW - 46 * unit, C.light, 750, "left", 13 * unit);
    fitText(skill.tags, textX, y + 57 * unit, 14 * unit, cardW - 46 * unit, C.muted, 500, "left", 11 * unit);
    const barY = y + rowH - 27 * unit;
    const barW = cardW - 46 * unit;
    roundedRect(textX, barY, barW, 5 * unit, 3 * unit, "#ffffff20");
    roundedRect(textX, barY, barW * skill.value / 100 * smooth(p * 5 - i * .78), 5 * unit, 3 * unit, C.orange);
  });
  if (!portrait) drawChibi(width * .84, height * .94, .65 * unit, p > .58 ? "wave" : "point", time, unit);
}

function drawProjects(width, height, unit, portrait, p, time) {
  drawHeader(width, height, unit, 4, "Projets sélectionnés", portrait);
  const gap = 18 * unit;
  if (portrait) {
    const x = width * .075;
    const cardW = width * .85;
    const cardH = 205 * unit;
    const top = height * .22;
    CONFIG.projects.forEach((project, i) => {
      const reveal = smooth((p - i * .12) * 5);
      const y = top + i * (cardH + gap) + (1 - reveal) * 35 * unit;
      ctx.save(); ctx.globalAlpha = reveal;
      panel(x, y, cardW, cardH, project.color, 14 * unit);
      text(project.icon, x + 24 * unit, y + 34 * unit, 14 * unit, project.color, 800);
      fitText(project.title, x + 24 * unit, y + 75 * unit, 23 * unit, cardW - 48 * unit, C.light, 750, "left", 13 * unit);
      text(project.type, x + 24 * unit, y + 108 * unit, 12 * unit, project.color, 750);
      wrapText(project.desc, x + 24 * unit, y + 143 * unit, cardW - 48 * unit, 18 * unit, 13 * unit, C.muted, 500, 2);
      ctx.restore();
    });
    drawChibi(width * .5, height * .99, .53 * unit, "type", time, unit);
  } else {
    const cardW = (width * .84 - gap * 2) / 3;
    const cardH = height * .42;
    const top = height * .29;
    CONFIG.projects.forEach((project, i) => {
      const reveal = smooth((p - i * .13) * 5);
      const x = width * .08 + i * (cardW + gap);
      const y = top + (1 - reveal) * 55 * unit;
      ctx.save(); ctx.globalAlpha = reveal;
      panel(x, y, cardW, cardH, project.color, 15 * unit);
      text(project.icon, x + 25 * unit, y + 37 * unit, 14 * unit, project.color, 800);
      fitText(project.title, x + 25 * unit, y + 91 * unit, 25 * unit, cardW - 50 * unit, C.light, 750, "left", 13 * unit);
      text(project.type, x + 25 * unit, y + 128 * unit, 12 * unit, project.color, 750);
      wrapText(project.desc, x + 25 * unit, y + 174 * unit, cardW - 50 * unit, 20 * unit, 14 * unit, C.muted, 500, 3);
      ctx.restore();
    });
    drawChibi(width * .8, height * .96, .45 * unit, "type", time, unit);
  }
}

function drawExperience(width, height, unit, portrait, p, time) {
  drawHeader(width, height, unit, 5, "Stage & expérience", portrait);
  const x = portrait ? width * .08 : width * .085;
  const cardY = portrait ? height * .27 : height * .3;
  const cardW = portrait ? width * .84 : width * .65;
  const cardH = portrait ? height * .33 : height * .38;
  panel(x, cardY, cardW, cardH, C.orange, 18 * unit);
  text("PROCHAINE ÉTAPE", x + 28 * unit, cardY + 42 * unit, 13 * unit, C.orange, 800);
  fitText(CONFIG.experience[0], x + 28 * unit, cardY + 100 * unit, 27 * unit, cardW - 56 * unit, C.light, 800, "left", 14 * unit);
  wrapText(CONFIG.experience[1], x + 28 * unit, cardY + 151 * unit, cardW - 56 * unit, 23 * unit, 16 * unit, C.muted, 500, 3);
  fitText(CONFIG.experience[2], x + 28 * unit, cardY + cardH - 34 * unit, 14 * unit, cardW - 56 * unit, C.orange, 650, "left", 11 * unit);
  drawChibi(portrait ? width * .5 : width * .81, height * .96, (portrait ? .95 : .76) * unit, "wave", time, unit);
  if (p > .16) {
    const bubbleW = portrait ? width * .66 : width * .32;
    speechBubble(portrait ? (width - bubbleW) / 2 : width * .61, portrait ? height * .55 : height * .22, bubbleW, "Partant pour un nouveau défi.", unit, portrait);
  }
}

function drawContact(width, height, unit, portrait, p, time) {
  drawHeader(width, height, unit, 6, "Contact", portrait);
  const x = portrait ? width * .08 : width * .085;
  const cardY = portrait ? height * .25 : height * .27;
  const cardW = portrait ? width * .84 : width * .64;
  const cardH = portrait ? height * .39 : height * .48;
  panel(x, cardY, cardW, cardH, C.orange, 18 * unit);
  text("ET SI ON ÉCHANGEAIT ?", x + 28 * unit, cardY + 42 * unit, 13 * unit, C.orange, 800);
  fitText("Recrutez-moi !", x + 28 * unit, cardY + 103 * unit, (portrait ? 37 : 54) * unit, cardW - 56 * unit, C.light, 800, "left", 22 * unit);
  const rows = [["E", CONFIG.contact.email], ["G", CONFIG.contact.github], ["W", CONFIG.contact.portfolio]];
  const rowGap = (portrait ? 43 : 51) * unit;
  rows.forEach((row, i) => {
    const y = cardY + (portrait ? 163 : 184) * unit + i * rowGap;
    text(row[0], x + 31 * unit, y, 12 * unit, C.orange, 800);
    fitText(row[1], x + 59 * unit, y, 15 * unit, cardW - 84 * unit, C.light, 550, "left", 10 * unit);
  });
  drawChibi(portrait ? width * .5 : width * .82, height * .96, (portrait ? 1 : .8) * unit, "wave", time, unit);
  if (p > .28) {
    const bubbleW = portrait ? width * .64 : width * .3;
    speechBubble(portrait ? (width - bubbleW) / 2 : width * .62, portrait ? height * .59 : height * .2, bubbleW, "À bientôt !", unit, portrait);
  }
}

function render() {
  const time = clamp(state.time, 0, TOTAL_DURATION);
  const width = canvas.width;
  const height = canvas.height;
  const portrait = height > width;
  const unit = portrait ? Math.min(width / 1080, height / 1920) : Math.min(width / 1920, height / 1080);
  activeFontScale = portrait ? 1.45 : 1;
  const motion = performance.now() / 1000;
  drawBackground(width, height, unit, motion);

  let currentScene = sceneNames[sceneNames.length - 1];
  for (const scene of sceneNames) {
    if (time < sceneStarts[scene] + SCENE_DURATIONS[scene]) {
      currentScene = scene;
      break;
    }
  }
  const p = progress(currentScene);
  const t = localTime(currentScene);

  switch (currentScene) {
    case "intro": drawIntro(width, height, unit, portrait, p, t); break;
    case "formation": drawFormation(width, height, unit, portrait, p, t); break;
    case "skills": drawSkills(width, height, unit, portrait, p, t); break;
    case "projects": drawProjects(width, height, unit, portrait, p, t); break;
    case "experience": drawExperience(width, height, unit, portrait, p, t); break;
    case "contact": drawContact(width, height, unit, portrait, p, t); break;
  }

  if (currentScene !== "intro" && t < .18) {
    ctx.save();
    ctx.globalAlpha = .2 * (1 - t / .18);
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, width, height);
    ctx.restore();
  }

  const seconds = Math.floor(time);
  clock.textContent = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")} / 01:00`;
  if (!isSeeking) seek.value = String(time);
}

if (!window.gsap) {
  setStatus("GSAP n’a pas été chargé. Vérifiez votre connexion Internet, puis actualisez la page.");
  throw new Error("GSAP est requis pour piloter la timeline.");
}

// Une timeline GSAP maîtresse synchronise toutes les scènes sur 60 secondes.
const timeline = gsap.timeline({
  paused: true,
  onUpdate: render,
  onComplete: () => {
    render();
    if (recorder && recorder.state !== "inactive") recorder.stop();
  }
});
timeline.to(state, { time: TOTAL_DURATION, duration: TOTAL_DURATION, ease: "none" });
gsap.ticker.add(render);
applyFormat();

document.querySelector("#play").addEventListener("click", () => {
  if (state.time >= TOTAL_DURATION) timeline.restart();
  else timeline.play();
});
document.querySelector("#pause").addEventListener("click", () => timeline.pause());
document.querySelector("#restart").addEventListener("click", () => {
  timeline.pause(0);
  render();
});

seek.addEventListener("input", () => {
  isSeeking = true;
  timeline.pause();
  timeline.time(Number(seek.value), false);
  render();
});
seek.addEventListener("change", () => { isSeeking = false; });

formatSelect.addEventListener("change", () => {
  applyFormat();
  setStatus(`Format prêt : ${canvas.width} × ${canvas.height} pixels.`);
});
resolutionSelect.addEventListener("change", () => {
  applyFormat();
  setStatus(`Résolution prête : ${canvas.width} × ${canvas.height} pixels.`);
});

function setControlsDisabled(disabled) {
  controls.forEach(button => { button.disabled = disabled; });
  formatSelect.disabled = disabled;
  resolutionSelect.disabled = disabled;
  seek.disabled = disabled;
}

function getWebMMimeType() {
  if (!window.MediaRecorder) return null;
  return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm"]
    .find(type => MediaRecorder.isTypeSupported(type)) || null;
}

function exportVideo() {
  if (!canvas.captureStream || !window.MediaRecorder) {
    setStatus("Cet export nécessite un navigateur récent compatible avec MediaRecorder et WebM (Chrome ou Firefox).");
    return;
  }
  const mimeType = getWebMMimeType();
  if (!mimeType) {
    setStatus("Ce navigateur ne propose aucun encodeur WebM compatible. Essayez Chrome ou Firefox à jour.");
    return;
  }

  try {
    applyFormat();
    chunks = [];
    recordingStream = canvas.captureStream(30);
    recorder = new MediaRecorder(recordingStream, { mimeType, videoBitsPerSecond: 6_000_000 });
    setControlsDisabled(true);

    recorder.ondataavailable = event => {
      if (event.data && event.data.size > 0) chunks.push(event.data);
    };
    recorder.onerror = event => {
      const message = event.error?.message || "erreur d’enregistrement inconnue";
      setStatus(`Échec de l’enregistrement : ${message}`);
      if (recordingStream) recordingStream.getTracks().forEach(track => track.stop());
      setControlsDisabled(false);
    };
    recorder.onstop = () => {
      if (recordingStream) recordingStream.getTracks().forEach(track => track.stop());
      if (!chunks.length) {
        setStatus("L’enregistrement n’a produit aucune donnée vidéo. Réessayez avec Chrome ou Firefox.");
      } else {
        const blob = new Blob(chunks, { type: mimeType });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `root-cv-${formatSelect.value}-${canvas.width}x${canvas.height}.webm`;
        document.body.append(link);
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        setStatus(`Vidéo WebM téléchargée · ${canvas.width} × ${canvas.height} · 60 secondes.`);
      }
      setControlsDisabled(false);
    };

    recorder.start(1000);
    setStatus(`Export en cours : ${canvas.width} × ${canvas.height}, 30 images/s, 60 secondes. Gardez cet onglet ouvert.`);
    timeline.restart();
  } catch (error) {
    if (recordingStream) recordingStream.getTracks().forEach(track => track.stop());
    setControlsDisabled(false);
    setStatus(`Impossible de démarrer l’export : ${error.message}`);
  }
}

document.querySelector("#export").addEventListener("click", exportVideo);
window.addEventListener("pagehide", () => {
  if (recordingStream) recordingStream.getTracks().forEach(track => track.stop());
});
