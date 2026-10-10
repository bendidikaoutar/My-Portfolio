// One scroll scheduler for the page. CSS is enhanced only after initialization.
const root = document.documentElement;
const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
const desktop = matchMedia("(min-width: 1024px) and (min-height: 720px)");
const nav = document.querySelector<HTMLElement>("#main-nav");
const hero = document.querySelector<HTMLElement>('[data-motion="hero"]');
const journey = document.querySelector<HTMLElement>('[data-motion="journey"]');
const steps = Array.from(journey?.querySelectorAll<HTMLElement>("li") ?? []);
const architecture = document.querySelector<HTMLElement>('[data-motion="architecture"]');
const pipeline = document.querySelector<HTMLElement>("#arch-pipeline");
const nodes = Array.from(pipeline?.querySelectorAll<HTMLElement>(".pipeline-node") ?? []);
const projects = document.querySelector<HTMLElement>('[data-motion="projects"]');
const slots = Array.from(projects?.querySelectorAll<HTMLElement>(".project-slot") ?? []);
const cards = slots.map(slot => slot.querySelector<HTMLElement>(".project-card")!);
const contact = document.querySelector<HTMLElement>('[data-motion="contact"]');
const scenes = Array.from(document.querySelectorAll<HTMLElement>("[data-motion]"));
const nearby = new Set<Element>();
const clamp = (value: number) => Math.max(0, Math.min(1, value));
const set = (element: HTMLElement | null, name: string, value: number) =>
  element?.style.setProperty(name, value.toFixed(4));

let frame = 0;
let dirty = true;
let navHeight = 70;
let architecturePinned = false;
let projectsPinned = false;
let manualArchitecture = false;
let lastArchitectureKey = "";
let projectStarts: number[] = [];
let projectInsets: number[] = [];
let anchorProject = false;

function schedule(measure = false) {
  dirty ||= measure;
  if (!frame) frame = requestAnimationFrame(update);
}

function measure() {
  navHeight = nav?.offsetHeight ?? 70;
  root.style.setProperty("--motion-nav-height", `${navHeight}px`);
  const immersive = desktop.matches && !reducedMotion.matches;

  // offsetHeight excludes the transforms applied to the editor and cards.
  architecturePinned = immersive && !!pipeline && pipeline.offsetHeight <= innerHeight - navHeight - 48;
  architecture?.classList.toggle("is-pinned", architecturePinned);
  architecture?.style.setProperty("--architecture-distance", `${innerHeight * 0.8}px`);

  // Measure at the final single-column width, even when the stack is expanded.
  projects?.classList.toggle("is-desktop", immersive);
  projects?.classList.remove("is-stacked");
  const interacting = !!projects?.contains(document.activeElement) ||
    !!projects?.querySelector("details[open]") || anchorProject;
  let titleHeight = 0;
  projectInsets = slots.map((slot, index) => {
    // Leave the previous title bars exposed, with 12px extra separation per window.
    const inset = navHeight + 24 + index * 12 + titleHeight;
    slot.style.setProperty("--project-top", `${inset}px`);
    titleHeight += cards[index].querySelector<HTMLElement>(".project-bar")?.offsetHeight ?? 0;
    return inset;
  });
  projectsPinned = immersive && !interacting && cards.every((card, index) =>
    card.offsetHeight <= innerHeight - projectInsets[index] - 24);
  // Read the slots before restoring sticky positioning; offsetTop can reflect sticky displacement.
  projectStarts = slots.map(slot => slot.offsetTop);
  projects?.classList.toggle("is-stacked", projectsPinned);
}

function architectureProgress() {
  if (!architecture || !pipeline || !nearby.has(architecture)) return;
  const bounds = architecture.getBoundingClientRect();
  if (bounds.bottom <= navHeight || bounds.top >= innerHeight) {
    manualArchitecture = false;
    lastArchitectureKey = "";
    return;
  }
  if (manualArchitecture || reducedMotion.matches) return;

  let progress: number;
  if (architecturePinned) {
    progress = clamp((navHeight + 24 - bounds.top) / (innerHeight * 0.8));
  } else {
    // Mobile nodes move through the reading line in their natural layout.
    const first = nodes[0]?.getBoundingClientRect();
    const last = nodes[nodes.length - 1]?.getBoundingClientRect();
    if (!first || !last) return;
    const range = last.top - first.top;
    progress = range > 1
      ? clamp((innerHeight * 0.55 - first.top) / range)
      : clamp((innerHeight * 0.8 - bounds.top) / (innerHeight * 0.5));
  }
  const index = Math.min(nodes.length - 1, Math.floor(progress * nodes.length));
  const key = nodes[index]?.dataset.node;
  if (key && key !== lastArchitectureKey) {
    lastArchitectureKey = key;
    pipeline.dispatchEvent(new CustomEvent("architecture-scroll", { detail: { key } }));
  }
  nodes.forEach((node, i) => set(node, "--connection-progress", clamp(progress * nodes.length - i)));
}

function update() {
  frame = 0;
  if (dirty) {
    dirty = false;
    measure();
  }
  set(root, "--reading-progress", clamp(scrollY / Math.max(1, root.scrollHeight - innerHeight)));
  if (reducedMotion.matches) return;

  if (hero && nearby.has(hero)) {
    const bounds = hero.getBoundingClientRect();
    set(hero, "--hero-progress", desktop.matches ? clamp((navHeight - bounds.top) / bounds.height) : 0);
  }

  if (journey && nearby.has(journey)) {
    const bounds = journey.getBoundingClientRect();
    const vertical = getComputedStyle(journey).gridTemplateColumns.split(" ").length === 1;
    const progress = clamp((innerHeight * 0.78 - bounds.top) /
      (vertical ? Math.max(1, bounds.height - steps[steps.length - 1].offsetHeight) : innerHeight * 0.35));
    set(journey, "--journey-progress", progress);
    steps.forEach((step, index) => {
      step.classList.toggle("is-current", Math.min(steps.length - 1, Math.floor(progress * steps.length)) === index);
      step.classList.toggle("is-reached", progress * (steps.length - 1) >= index);
    });
  }

  architectureProgress();

  if (projects && nearby.has(projects)) {
    const top = projects.getBoundingClientRect().top;
    slots.forEach((slot, index) => {
      const nextStart = projectStarts[index + 1];
      // Incoming windows cover the previous one as their natural position approaches its inset.
      const cover = projectsPinned && nextStart !== undefined
        ? clamp((projectInsets[index + 1] + innerHeight * 0.45 - (top + nextStart)) / (innerHeight * 0.45))
        : 0;
      set(slot, "--project-cover", cover);
      const entrance = clamp((innerHeight * 0.96 - (top + projectStarts[index])) / (innerHeight * 0.22));
      set(slot, "--entrance", projectsPinned ? 1 : entrance);
    });
  }

  if (contact && nearby.has(contact)) {
    set(contact, "--entrance", clamp((innerHeight * 0.92 - contact.getBoundingClientRect().top) / (innerHeight * 0.3)));
  }
}

const observer = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) nearby.add(entry.target);
    else {
      nearby.delete(entry.target);
      if (entry.target === architecture) {
        manualArchitecture = false;
        lastArchitectureKey = "";
      }
    }
  });
  schedule();
}, { rootMargin: "100% 0px" }) : null;
scenes.forEach(scene => {
  nearby.add(scene); // Also render correctly on a restored scroll position before the first observer callback.
  observer?.observe(scene);
});

function preferenceChanged() {
  root.classList.toggle("scroll-motion", !reducedMotion.matches);
  manualArchitecture = false;
  lastArchitectureKey = "";
  schedule(true);
}

window.addEventListener("scroll", () => schedule(), { passive: true });
window.addEventListener("resize", () => schedule(true), { passive: true });
window.addEventListener("pageshow", () => schedule(true));
desktop.addEventListener("change", () => schedule(true));
reducedMotion.addEventListener("change", preferenceChanged);
document.fonts?.ready.then(() => schedule(true));
document.addEventListener("load", () => schedule(true), true);
document.addEventListener("toggle", () => schedule(true), true);
projects?.addEventListener("focusin", () => schedule(true));
projects?.addEventListener("focusout", () => schedule(true));
pipeline?.addEventListener("architecture-manual", () => {
  manualArchitecture = true;
  schedule(true);
});

// Internal links to an individual project must land on readable, uncovered content.
function updateAnchor(hash = location.hash) {
  anchorProject = cards.some(card => `#${card.id}` === hash);
  schedule(true);
}
document.addEventListener("click", event => {
  const target = event.target instanceof Element ? event.target.closest<HTMLAnchorElement>('a[href^="#"]') : null;
  if (target) {
    updateAnchor(target.hash);
    if (anchorProject) projects?.classList.remove("is-stacked");
  }
});
window.addEventListener("hashchange", () => updateAnchor());
updateAnchor();

// ResizeObserver follows detail panels, responsive wrapping and font/image layout changes.
const resizeObserver = "ResizeObserver" in window ? new ResizeObserver(() => schedule(true)) : null;
[nav, pipeline, ...cards, document.body].forEach(element => { if (element) resizeObserver?.observe(element); });
preferenceChanged();

// Do not leave duplicate listeners/observers behind during Vite hot replacement.
if (import.meta.hot) import.meta.hot.accept(() => location.reload());
