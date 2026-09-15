import { homeTechnologyBubbleStateAt } from './product-first-model.js';

const art = document.querySelector('[data-product-arrival]');
const story = document.querySelector('[data-home-technology-story]');
const stage = document.querySelector('[data-home-technology-stage]');
const composition = art?.querySelector('[data-home-bubble-composition]');
const approved = art?.querySelector('[data-home-bubble-approved]');
const layers = new Map(
  [...(art?.querySelectorAll('[data-home-bubble-layer]') ?? [])]
    .map((node) => [node.dataset.homeBubbleLayer, node]),
);
const labels = new Map(
  [...(art?.querySelectorAll('[data-home-bubble-label]') ?? [])]
    .map((node) => [node.dataset.homeBubbleLabel, node]),
);

const desktopMotion = matchMedia('(min-width: 981px) and (hover: hover) and (pointer: fine)');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const forcedColors = matchMedia('(forced-colors: active)');
const header = document.querySelector('.site-header');

let configured = false;
let enabled = false;
let framePending = false;
let geometryDirty = true;
let lastProgress = 1;
let lastPerspectiveProgress = 1;
let lastScrollY = window.scrollY;
let lastScrollDirection = 0;
let lastPhase = '';
let lastApprovedOpacity = '';
let lastApprovedVisibility = '';
let layerRenderCache = new WeakMap();
let labelRenderCache = new WeakMap();
let lastGeometry = {
  start: 0,
  end: 0,
  travel: 0,
  perspectiveStart: 0,
  perspectiveEnd: 0,
  compositionWidth: 0,
};

const clamp01 = (value) => Math.max(0, Math.min(1, Number(value) || 0));
const closeEnough = (a, b) => Math.abs(a - b) <= 0.0001;

const applyLayer = (node, state, opacityMultiplier) => {
  if (!node) return;
  const opacity = state.opacity * opacityMultiplier;
  const next = {
    transform: `translate3d(${state.x.toFixed(4)}%, ${state.y.toFixed(4)}%, 0) rotate(${state.rotate.toFixed(4)}deg) scale(${state.scale.toFixed(5)})`,
    opacity: opacity.toFixed(5),
    visibility: opacity <= 0.0001 ? 'hidden' : 'visible',
  };
  const previous = layerRenderCache.get(node) || {};
  if (next.transform !== previous.transform) node.style.transform = next.transform;
  if (next.opacity !== previous.opacity) node.style.opacity = next.opacity;
  if (next.visibility !== previous.visibility) node.style.visibility = next.visibility;
  layerRenderCache.set(node, next);
};

const applyLabel = (node, state, width, height) => {
  if (!node) return;
  const x = (state.x / 100) * width;
  const y = (state.y / 100) * height;
  const next = {
    transform: `translate3d(${x.toFixed(3)}px, ${y.toFixed(3)}px, 0) rotate(${state.rotate.toFixed(4)}deg) scale(${state.scale.toFixed(5)})`,
    opacity: state.opacity.toFixed(5),
    visibility: state.opacity <= 0.0001 ? 'hidden' : 'visible',
  };
  const previous = labelRenderCache.get(node) || {};
  if (next.transform !== previous.transform) node.style.transform = next.transform;
  if (next.opacity !== previous.opacity) node.style.opacity = next.opacity;
  if (next.visibility !== previous.visibility) node.style.visibility = next.visibility;
  labelRenderCache.set(node, next);
};

const setPhase = (progress) => {
  const phase = progress <= 0.0005
    ? 'before'
    : progress >= 0.9995
      ? 'settled'
      : 'scrubbing';
  if (phase !== lastPhase) {
    art.dataset.phase = phase;
    lastPhase = phase;
  }
};

const renderBubble = (progress) => {
  if (!enabled || !art || !composition || !approved || closeEnough(progress, lastProgress)) return;
  const model = homeTechnologyBubbleStateAt(progress);
  const width = lastGeometry.compositionWidth;

  Object.entries(model.layers).forEach(([name, state]) => {
    applyLayer(layers.get(name), state, model.generatedOpacity);
    applyLabel(labels.get(name), state, width, width * 0.75);
  });

  const approvedOpacity = model.approvedOpacity.toFixed(5);
  const approvedVisibility = model.approvedOpacity <= 0.0001 ? 'hidden' : 'visible';
  if (approvedOpacity !== lastApprovedOpacity) {
    approved.style.opacity = approvedOpacity;
    lastApprovedOpacity = approvedOpacity;
  }
  if (approvedVisibility !== lastApprovedVisibility) {
    approved.style.visibility = approvedVisibility;
    lastApprovedVisibility = approvedVisibility;
  }
  if (approved.style.transform !== 'none') approved.style.transform = 'none';
  art.dataset.progress = model.progress.toFixed(4);
  setPhase(model.progress);
  lastProgress = model.progress;
};

const renderPerspective = (progress) => {
  if (!art || closeEnough(progress, lastPerspectiveProgress)) return;
  const yaw = -45 * (1 - progress);
  art.style.setProperty('--technology-scroll-yaw', `${yaw.toFixed(3)}deg`);
  art.style.setProperty('--technology-schedule-label-top', `${(100 - progress * 4).toFixed(3)}%`);
  art.dataset.technologyAngleProgress = progress.toFixed(4);
  art.dataset.technologyAngleState = progress <= 0.001
    ? 'angled'
    : progress >= 0.999
      ? 'front-facing'
      : 'transitioning';
  lastPerspectiveProgress = progress;
};

const measureGeometry = () => {
  if (!story || !stage || !composition || !art) return;
  const headerBottom = Math.max(0, header?.offsetHeight ?? 0);
  const storyTop = story.getBoundingClientRect().top + window.scrollY;
  const travel = Math.max(1, story.offsetHeight - stage.offsetHeight - headerBottom);
  lastGeometry = {
    start: storyTop,
    end: storyTop + travel,
    travel,
    perspectiveStart: storyTop - window.innerHeight * 0.78,
    perspectiveEnd: storyTop - window.innerHeight * 0.12,
    compositionWidth: composition.getBoundingClientRect().width,
  };
  art.dataset.scrollStart = lastGeometry.start.toFixed(2);
  art.dataset.scrollEnd = lastGeometry.end.toFixed(2);
  art.dataset.scrollTravel = lastGeometry.travel.toFixed(2);
  geometryDirty = false;
};

const update = () => {
  framePending = false;
  if (!enabled) return;

  const currentScrollY = window.scrollY;
  if (geometryDirty && lastGeometry.travel > 0) {
    const cachedPerspectiveTravel = Math.max(1, lastGeometry.perspectiveEnd - lastGeometry.perspectiveStart);
    const cachedPerspectiveProgress = clamp01((currentScrollY - lastGeometry.perspectiveStart) / cachedPerspectiveTravel);
    const cachedBubbleProgress = clamp01((currentScrollY - lastGeometry.start) / lastGeometry.travel);
    const remainsAtEndpoint = (lastProgress <= 0.0001 || lastProgress >= 0.9999)
      && (lastPerspectiveProgress <= 0.0001 || lastPerspectiveProgress >= 0.9999)
      && closeEnough(cachedBubbleProgress, lastProgress)
      && closeEnough(cachedPerspectiveProgress, lastPerspectiveProgress);
    if (remainsAtEndpoint) {
      lastScrollY = currentScrollY;
      return;
    }
  }
  if (geometryDirty) measureGeometry();

  const perspectiveTravel = Math.max(1, lastGeometry.perspectiveEnd - lastGeometry.perspectiveStart);
  const rawPerspectiveProgress = clamp01((currentScrollY - lastGeometry.perspectiveStart) / perspectiveTravel);
  const rawBubbleProgress = clamp01((currentScrollY - lastGeometry.start) / lastGeometry.travel);
  const perspectiveProgress = rawPerspectiveProgress <= 0.001
    ? 0
    : rawPerspectiveProgress >= 0.999
      ? 1
      : rawPerspectiveProgress;
  const bubbleProgress = rawBubbleProgress <= 0.001
    ? 0
    : rawBubbleProgress >= 0.999
      ? 1
      : rawBubbleProgress;
  if (bubbleProgress > 0 && bubbleProgress < 1) {
    let nextDirection = lastScrollDirection;
    if (currentScrollY > lastScrollY + 0.25) nextDirection = 1;
    else if (currentScrollY < lastScrollY - 0.25) nextDirection = -1;
    if (nextDirection !== lastScrollDirection) {
      lastScrollDirection = nextDirection;
      art.dataset.scrollDirection = nextDirection > 0 ? 'down' : nextDirection < 0 ? 'up' : 'none';
    }
  }
  lastScrollY = currentScrollY;

  renderPerspective(perspectiveProgress);
  renderBubble(bubbleProgress);
};

const requestUpdate = () => {
  if (!enabled || framePending) return;
  framePending = true;
  requestAnimationFrame(update);
};

const invalidateGeometry = () => {
  geometryDirty = true;
  requestUpdate();
};

const handleResize = () => {
  if (enabled) measureGeometry();
  requestUpdate();
};

const hydrateLayers = () => {
  layers.forEach((node) => {
    if (!node.getAttribute('src') && node.dataset.src) {
      node.loading = 'eager';
      node.src = node.dataset.src;
    }
  });
};

const clearMotionStyles = () => {
  layers.forEach((node) => {
    node.style.transform = 'none';
    node.style.opacity = '0';
    node.style.visibility = 'hidden';
  });
  labels.forEach((node) => {
    node.style.transform = 'none';
    node.style.opacity = '1';
    node.style.visibility = 'visible';
  });
  if (approved) {
    approved.style.transform = 'none';
    approved.style.opacity = '1';
    approved.style.visibility = 'visible';
  }
  if (art) {
    art.style.setProperty('--technology-scroll-yaw', '0deg');
    art.style.setProperty('--technology-schedule-label-top', '96%');
    art.dataset.progress = '1.0000';
    art.dataset.phase = 'static-settled';
    art.dataset.motion = 'static';
    art.dataset.autonomous = 'false';
    art.dataset.scrollDirection = 'none';
    art.dataset.technologyAngleProgress = '1.0000';
    art.dataset.technologyAngleState = 'static';
    delete art.dataset.scrollStart;
    delete art.dataset.scrollEnd;
    delete art.dataset.scrollTravel;
  }
  layerRenderCache = new WeakMap();
  labelRenderCache = new WeakMap();
  lastApprovedOpacity = '';
  lastApprovedVisibility = '';
  lastProgress = 1;
  lastPerspectiveProgress = 1;
  lastScrollDirection = 0;
  lastPhase = 'static-settled';
  lastGeometry = { start: 0, end: 0, travel: 0, perspectiveStart: 0, perspectiveEnd: 0, compositionWidth: 0 };
};

const configure = () => {
  const nextEnabled = desktopMotion.matches && !reducedMotion.matches && !forcedColors.matches;
  if (configured && nextEnabled === enabled) {
    requestUpdate();
    return;
  }

  configured = true;
  enabled = nextEnabled;
  framePending = false;
  geometryDirty = true;
  art?.classList.toggle('is-home-bubble-motion', enabled);
  if (enabled) {
    document.documentElement.dataset.homeTechnologyController = 'scroll-linked';
    art.dataset.motion = 'scroll-linked';
    art.dataset.autonomous = 'false';
    hydrateLayers();
    lastScrollY = window.scrollY;
    lastProgress = Number.NaN;
    lastPerspectiveProgress = Number.NaN;
    lastPhase = '';
    measureGeometry();
    update();
  } else {
    delete document.documentElement.dataset.homeTechnologyController;
    clearMotionStyles();
  }
};

const setup = () => {
  if (!art || !story || !stage || !composition || !approved || layers.size !== 4) return () => {};

  window.addEventListener('scroll', requestUpdate, { passive: true });
  window.addEventListener('resize', handleResize, { passive: true });
  desktopMotion.addEventListener?.('change', configure);
  reducedMotion.addEventListener?.('change', configure);
  forcedColors.addEventListener?.('change', configure);
  configure();

  return () => {
    window.removeEventListener('scroll', requestUpdate);
    window.removeEventListener('resize', handleResize);
    desktopMotion.removeEventListener?.('change', configure);
    reducedMotion.removeEventListener?.('change', configure);
    forcedColors.removeEventListener?.('change', configure);
    enabled = false;
    framePending = false;
    art.classList.remove('is-home-bubble-motion');
    delete document.documentElement.dataset.homeTechnologyController;
    clearMotionStyles();
  };
};

const cleanup = setup();

export function homeTechnologyBubbleDebugState() {
  return {
    enabled,
    framePending,
    progress: lastProgress,
    phase: art?.dataset.phase ?? null,
    motion: art?.dataset.motion ?? null,
    autonomous: false,
    scrollDirection: lastScrollDirection,
    ...lastGeometry,
  };
}

export { cleanup };
