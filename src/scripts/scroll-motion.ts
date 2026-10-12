// One scroll scheduler for the page. CSS is enhanced only after initialization.
const root = document.documentElement;
const reducedMotion = {
  matches: false,
  addEventListener: () => {}
};
const desktop = matchMedia("(min-width: 1024px) and (min-height: 720px)");
const projectViewport = matchMedia("(min-height: 620px)");
const nav = document.querySelector<HTMLElement>("#main-nav");
const hero = document.querySelector<HTMLElement>('[data-motion="hero"]');
const editor = hero?.querySelector<HTMLPreElement>(".editor pre");
const sourceCode = editor?.querySelector("code");
const typedCharacters: HTMLSpanElement[] = [];
// Show the profile's identity immediately instead of an almost empty editor.
const openingLength = (sourceCode?.textContent ?? "").split("\n").slice(0, 5).join("\n").length;
let typedCount = -1;
let displayedCount = -1;
let typingTime = 0;
let editorStart = 0;
let editorEnd = 1;
const typingCursor = document.createElement("span");
typingCursor.className = "typing-caret";
typingCursor.setAttribute("aria-hidden", "true");

// Keep the complete source for assistive technology and a same-size visual copy.
if (editor && sourceCode) {
  const visualCode = sourceCode.cloneNode(true) as HTMLElement;
  visualCode.setAttribute("aria-hidden", "true");
  const walker = document.createTreeWalker(visualCode, NodeFilter.SHOW_TEXT);
  const textNodes: Text[] = [];
  while (walker.nextNode()) textNodes.push(walker.currentNode as Text);
  textNodes.forEach(node => {
    const fragment = document.createDocumentFragment();
    Array.from(node.data).forEach(character => {
      const span = document.createElement("span");
      span.textContent = character;
      typedCharacters.push(span);
      fragment.append(span);
    });
    node.replaceWith(fragment);
  });
  sourceCode.classList.add("typing-source");
  visualCode.append(typingCursor);
  editor.append(visualCode);
}

function writeCode(progress: number, immediate = false) {
  const target = Math.round(typedCharacters.length * progress);
  const now = performance.now();
  const elapsed = Math.min(64, Math.max(1, now - typingTime));
  typingTime = now;
  if (immediate || displayedCount < 0) displayedCount = target;
  else displayedCount += (target - displayedCount) * (1 - Math.exp(-elapsed / 65));
  if (Math.abs(target - displayedCount) < 0.5) displayedCount = target;
  else schedule();
  const count = Math.round(displayedCount);
  if (count === typedCount) return;
  typedCharacters.forEach((character, index) => {
    if (typedCount < 0 || (index >= Math.min(count, typedCount) && index < Math.max(count, typedCount))) {
      character.classList.toggle("typing-unwritten", index >= count);
    }
  });
  if (typedCharacters[count]) typedCharacters[count].before(typingCursor);
  else typedCharacters.at(-1)?.after(typingCursor);
  typedCount = count;
}
const journey = document.querySelector<HTMLElement>('[data-motion="journey"]');
const steps = Array.from(journey?.querySelectorAll<HTMLElement>("li") ?? []);
const about = document.querySelector<HTMLElement>('[data-motion="about"]');
const aboutItems = Array.from(about?.querySelectorAll<HTMLElement>("[data-about-reveal]") ?? []);
const aboutTypeGroups = Array.from(about?.querySelectorAll<HTMLElement>("[data-about-type]") ?? []).map(element => {
  const text = element.textContent ?? "";
  const characters = element.dataset.aboutType === "characters";
  const parts = characters ? Array.from(text) : text.split(/(\s+)/);
  const visual = document.createElement("span");
  const tokens: HTMLSpanElement[] = [];
  visual.setAttribute("aria-hidden", "true");
  parts.forEach(part => {
    if (/^\s+$/.test(part)) {
      visual.append(document.createTextNode(part));
    } else if (part) {
      const token = document.createElement("span");
      token.className = "about-type-token";
      token.textContent = part;
      tokens.push(token);
      visual.append(token);
    }
  });
  element.setAttribute("aria-label", text.trim());
  element.replaceChildren(visual);
  return { element, tokens, count: -1 };
});

function revealAboutText(group: typeof aboutTypeGroups[number], progress: number) {
  const count = Math.round(group.tokens.length * progress);
  if (count === group.count) return;
  group.tokens.forEach((token, index) => {
    token.classList.toggle("is-written", index < count);
    token.classList.toggle("has-caret", index === count - 1 && count < group.tokens.length);
  });
  group.count = count;
}
const architecture = document.querySelector<HTMLElement>('[data-motion="architecture"]');
const pipeline = document.querySelector<HTMLElement>("#arch-pipeline");
const nodes = Array.from(pipeline?.querySelectorAll<HTMLElement>(".pipeline-node") ?? []);
const projects = document.querySelector<HTMLElement>('[data-motion="projects"]');
const slots = Array.from(projects?.querySelectorAll<HTMLElement>(".project-slot") ?? []);
const cards = slots.map(slot => slot.querySelector<HTMLElement>(".project-card")!);
const contact = document.querySelector<HTMLElement>('[data-motion="contact"]');
const scenes = Array.from(document.querySelectorAll<HTMLElement>("[data-motion]"));
const mobileSkillsScene = document.querySelector<HTMLElement>('[data-motion="mobile-skills"]');
const mobileSkills = mobileSkillsScene?.querySelector<HTMLElement>("[data-mobile-skills]");
const skillButtons = Array.from(mobileSkills?.querySelectorAll<HTMLButtonElement>("[data-category]") ?? []);
const skillPanels = Array.from(mobileSkills?.querySelectorAll<HTMLElement>("[data-panel]") ?? []);
let skillsPinned = false;
let skillsDistance = 1;
let selectedSkill = -1;

function selectSkill(index: number) {
  if (index === selectedSkill) return;
  selectedSkill = index;
  skillButtons.forEach((button, i) => button.setAttribute("aria-pressed", String(i === index)));
  skillPanels.forEach((panel, i) => { panel.hidden = i !== index; });
}
if (mobileSkills) {
  selectSkill(0);
  mobileSkills.classList.add("is-interactive");
}
skillButtons.forEach((button, index) => button.addEventListener("click", () => {
  selectSkill(index);
  if (skillsPinned && mobileSkillsScene) {
    const start = mobileSkillsScene.getBoundingClientRect().top + scrollY - navHeight - 12;
    window.scrollTo({ top: start + skillsDistance * (index + 0.5) / skillButtons.length, behavior: "instant" });
  }
}));
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
let revealFocusedProject = false;

function schedule(measure = false) {
  dirty ||= measure;
  if (!frame) frame = requestAnimationFrame(update);
}

function measure() {
  navHeight = nav?.offsetHeight ?? 70;
  root.style.setProperty("--motion-nav-height", `${navHeight}px`);
  if (editor) {
    // Layout offsets exclude the workspace's rotation and scroll transform.
    let top = 0;
    let element: HTMLElement | null = editor;
    while (element) { top += element.offsetTop; element = element.offsetParent as HTMLElement | null; }
    editorStart = Math.max(0, top - innerHeight * 0.85);
    // Complete before the first line passes behind the fixed navigation.
    editorEnd = Math.max(editorStart + 1, top - navHeight - 32);
  }
  const immersive = desktop.matches && !reducedMotion.matches;
  skillsPinned = !reducedMotion.matches && innerWidth < 768 && !!mobileSkills &&
    mobileSkills.offsetHeight <= innerHeight - navHeight - 36;
  // Keep the four changes deliberate without making mobile visitors scroll too far.
  skillsDistance = Math.max(520, innerHeight * 1.05);
  mobileSkillsScene?.style.setProperty("--mobile-skills-height", `${mobileSkills?.offsetHeight ?? 0}px`);
  mobileSkillsScene?.style.setProperty("--mobile-skills-distance", `${skillsDistance}px`);
  mobileSkillsScene?.classList.toggle("is-pinned", skillsPinned);
  if (journey && steps.length) {
    journey.style.setProperty("--journey-track-height", `${steps[steps.length - 1].offsetTop - steps[0].offsetTop}px`);
  }

  // offsetHeight excludes the transforms applied to the editor and cards.
  architecturePinned = immersive && !!pipeline && pipeline.offsetHeight <= innerHeight - navHeight - 48;
  architecture?.classList.toggle("is-pinned", architecturePinned);
  architecture?.style.setProperty("--architecture-distance", `${innerHeight * 0.8}px`);

  // Measure at the final single-column width, even when the stack is expanded.
  const projectMotion = !reducedMotion.matches && projectViewport.matches;
  projects?.classList.toggle("is-scroll-layout", projectMotion);
  projects?.classList.remove("is-stacked");
  // Pointer clicks may open details without cancelling the stack. Keyboard focus
  // still switches to the plain list so every control remains easy to reach.
  const interacting = !!projects?.querySelector(":focus-visible") || anchorProject;
  let titleHeight = 0;
  projectInsets = slots.map((slot, index) => {
    // Leave the previous title bars exposed, with 12px extra separation per window.
    const inset = navHeight + 24 + index * 12 + titleHeight;
    slot.style.setProperty("--project-top", `${inset}px`);
    titleHeight += cards[index].querySelector<HTMLElement>(".project-bar")?.offsetHeight ?? 0;
    return inset;
  });
  projectsPinned = projectMotion && !interacting && cards.every((card, index) =>
    card.offsetHeight <= innerHeight - projectInsets[index] - 24);
  // Read the slots before restoring sticky positioning; offsetTop can reflect sticky displacement.
  projectStarts = slots.map(slot => slot.offsetTop);
  projects?.classList.toggle("is-stacked", projectsPinned);
}

function architectureProgress() {
  if (!architecture || !pipeline || !nearby.has(architecture) || !pipeline.getClientRects().length) return;
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
  if (revealFocusedProject) {
    revealFocusedProject = false;
    const focused = document.activeElement;
    if (focused instanceof HTMLElement && projects?.contains(focused)) {
      const bounds = focused.getBoundingClientRect();
      if (bounds.top < navHeight + 24 || bounds.bottom > innerHeight - 24) {
        focused.scrollIntoView({ block: "center", behavior: "instant" });
      }
    }
  }
  set(root, "--reading-progress", clamp(scrollY / Math.max(1, root.scrollHeight - innerHeight)));
  if (reducedMotion.matches) { writeCode(1, true); return; }

  if (hero && nearby.has(hero)) {
    // Leave the opening comment visible; finish typing while the editor is still in view.
    const progress = clamp((scrollY - editorStart) / (editorEnd - editorStart));
    const opening = openingLength / Math.max(1, typedCharacters.length);
    const focused = !!editor?.contains(document.activeElement);
    writeCode(focused ? 1 : opening + progress * (1 - opening), focused || progress === 1);
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

  if (about && nearby.has(about)) {
    aboutItems.forEach(item => {
      const bounds = item.getBoundingClientRect();
      // Use a long scroll range so the content rises gradually instead of popping in.
      const progress = clamp((innerHeight * 0.94 - bounds.top) / (innerHeight * 0.68));
      set(item, "--about-entrance", progress);
    });
    aboutTypeGroups.forEach(group => {
      const bounds = group.element.getBoundingClientRect();
      const progress = clamp((innerHeight * 0.92 - bounds.top) / (innerHeight * 0.62));
      revealAboutText(group, progress);
    });
  }

  architectureProgress();
  if (skillsPinned && mobileSkillsScene && nearby.has(mobileSkillsScene)) {
    const progress = clamp((navHeight + 12 - mobileSkillsScene.getBoundingClientRect().top) / skillsDistance);
    set(mobileSkillsScene, "--skills-progress", progress);
    // A focused project link must not disappear while someone is using the keyboard.
    if (!skillPanels.some(panel => panel.contains(document.activeElement))) {
      selectSkill(Math.min(skillButtons.length - 1, Math.floor(progress * skillButtons.length)));
    }
  }

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
projectViewport.addEventListener("change", () => schedule(true));
reducedMotion.addEventListener("change", preferenceChanged);
visualViewport?.addEventListener("resize", () => schedule(true), { passive: true });
document.fonts?.ready.then(() => schedule(true));
document.addEventListener("load", () => schedule(true), true);
document.addEventListener("toggle", () => schedule(true), true);
projects?.addEventListener("focusin", () => {
  revealFocusedProject = true;
  schedule(true);
});
projects?.addEventListener("focusout", () => schedule(true));
editor?.addEventListener("focusin", () => schedule());
editor?.addEventListener("focusout", () => schedule());
mobileSkills?.addEventListener("focusout", () => schedule());
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
