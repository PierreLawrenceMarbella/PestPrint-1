# PESTPRINT motion system

The project uses CSS motion, with no additional dependencies. `src/motion.css`
is imported once by `src/styles.css`. Existing hero effects, loading indicators
and hover transitions use its shared tokens. New reveal utilities are opt-in;
Phase 1 establishes the reusable foundation. Phase 2 applies it to the existing
landing-page hero while retaining its layout.

## Timing and transitions

| Token | Default | Use |
| --- | --- | --- |
| `--motion-duration-fast` | 180ms | Hover and color feedback |
| `--motion-duration-standard` | 250ms | Transform and opacity transitions |
| `--motion-duration-reveal` | 400ms | Entrances |
| `--motion-stagger-step` | 60ms | Spacing between sibling entrances |
| `--motion-stagger-limit` | 300ms | Maximum extra stagger delay |

Use `--motion-ease-standard` for interactions and `--motion-ease-enter` for
entrances. Ambient effects retain their existing longer durations, named in the
same stylesheet. Phase 2's hero component (`src/hero.tsx`) owns the six-second
slide timer, preloading, pause, visibility and reduced-motion handling. It uses
the Phase 1 entrances with hero-only duration (600ms) and stagger (90ms) overrides.
The 1400ms crossfade keeps the outgoing image opaque underneath the incoming
image, with its zoom continuing through the fade. A slow or failed next image
never replaces a ready frame. Reduced motion keeps the current scene static.

## Reusable classes

| Class | Behavior |
| --- | --- |
| `motion-fade-in` | Fade from transparent to visible |
| `motion-fade-up` | Fade and move up 12px to the resting position |
| `motion-scale` | Fade and scale from 0.98 to the resting size |
| `motion-hover` | Smooth 2px lift on hover with a mouse or fine pointer |
| `motion-stagger` | Delay direct children that use an entrance class |
| `motion-transition` | Smooth color, border, shadow and lift changes |
| `motion-transition-transform` | Smooth an existing transform state change |
| `motion-transition-fade` | Smooth an existing opacity state change |

Use one entrance class per element. Entrances run once when the element mounts;
they do not observe scrolling. They animate only opacity and transform, so they
do not change document layout. Apply them to an element without a resting
transform, or animate a separate existing ancestor if its transform is needed.
Hover uses individual `translate`, so it can compose with an entrance.
Transition utilities smooth state changes; they do not create states themselves.

```tsx
import { staggerStyle } from "./motion";

// Add classes to existing elements; no new layout wrappers are required.
<div className="existing-grid motion-stagger">
  {items.map((item, index) => (
    <article
      key={item.id}
      className="existing-card motion-fade-up motion-hover"
      style={staggerStyle(index)}
    >
      {item.title}
    </article>
  ))}
</div>
```

`staggerStyle(index)` supplies a safe, zero-based `--motion-index`. Plain CSS
consumers can set that custom property directly. Set `--motion-duration` or
`--motion-delay` on an entrance to override its duration or starting delay;
containers can override the stagger step and limit. Prefer the shared defaults.

## Accessibility

The shared `prefers-reduced-motion` rule disables animations, transitions,
smooth scrolling and hover movement immediately, including during an entrance.
Elements have no permanently hidden base state, so disabling motion also removes
stagger delays and shows content immediately. Keyboard focus within a reveal
cancels that entrance so focused controls remain visible. Existing focus outlines
are preserved. No behavior depends on animation completion events.

## Phase 2 completion

Status: COMPLETE. Verified on November 5, 2026.

The interrupted implementation already contained the slideshow, decoded image
preloading, continuous outgoing zoom, scanner sweep and glow, floating previews,
staggered entrances, and motion controls. Completion work retained those features
and finished the pending scanner movement, navigation and visual checks.
No additional animation implementation or runtime fixes were needed.

- `npm run build`: passed TypeScript compilation and the Vite production build.
- Seven tests in `tests/hero.spec.ts`: passed, covering the full slide loop,
  crossfade layers and continuous zoom, stationary copy, pause and hidden tabs,
  reduced motion, slow/failed image requests, cleanup, scanner movement,
  responsive layouts, keyboard focus and the primary action.
- The home/navigation regression in `tests/app.spec.ts`: passed.
- Visual review: all four desktop scenes and the mobile hero remained readable.
  Responsive assertions and screenshots covered 320, 390, 600, 768 and 1440px.

Browser checks used Microsoft Edge with emulated viewport sizes; physical mobile
devices were not tested. Slow images intentionally keep the current frame past
six seconds until the next image is decoded.

## Phase 3: navigation and Home interactions

- Navigation links reveal their underline with a transform transition and use
  subtle green highlights. Keyboard focus keeps a visible outline.
- The mobile menu fades and moves 8px as a single panel. Closed links are inert
  and hidden from assistive technology immediately, including during the exit.
  Escape restores focus to the toggle. Navigation, outside clicks and keyboard
  focus leaving the header close the menu; breakpoint changes hand focus to the
  visible control after inert is updated. All event listeners are cleaned up.
- `HowItWorks` accepts an optional `animated` prop. Home opts in to the Phase 1
  stagger and hover classes. The About page keeps its original card behavior.
  Informational cards remain outside the tab order.
- Home cards lift 3px, change their shadow and softly highlight their icons on
  fine-pointer hover. Their resting position and dimensions are preserved.
- Only the hero action and Home's Get Started button opt in to elevation and
  pressed shadows. The hero arrow moves 3px; touch devices do not retain lifts.
- Shared reduced-motion rules disable entrances and transitions. Motion-only
  hover states are restricted to fine pointers with no reduced-motion request.

Verification: `npm run build` passed TypeScript and the production build. All
16 selected browser tests passed: eight new interaction tests, seven hero tests,
and the home/navigation regression. Checks cover desktop, mobile viewports,
touch emulation, keyboard focus, rapid menu reversals, breakpoint changes,
reduced motion, navigation and the Phase 2 slideshow. Saved layout and typography
measurements matched before and after at 320, 390, 600, 768 and 1440px, with About
card and button measurements also unchanged. Screenshots were visually reviewed.

## Phase 4: Analyze upload interactions

- The existing drop zone uses the shared interaction transitions for its forest
  green border and tinted background. Its icon lifts 3px while a file is over
  the zone, and the active instruction is announced politely. Text drags do not
  activate the file state. Nested drag events retain their depth counter;
  leaving, Escape, drag end, outside drops, window blur and hidden tabs clear it.
  Global listeners are removed when Analyze unmounts.
- Decoded previews use `motion-scale` for the fade and 0.98 settling scale.
  Replacing an image remounts only the preview surface so its entrance replays.
  Existing image actions fade in with the shared reveal and stagger timing.
  The ready label receives focus after selection; removing returns focus to
  Choose Image. A canceled or invalid replacement preserves the valid preview.
- Upload and camera controls use the existing hover utility, soft shadows,
  visible keyboard focus and pressed feedback. Disabled controls retain their
  locks during validation and analysis. Supported class images have a restrained
  hover zoom and shadow without changing card dimensions or links.
- Motion transforms are gated by reduced-motion preferences; hover movement is
  also restricted to fine pointers. The shared policy removes reveal animations
  immediately. No new dependencies, motion utilities or timers were introduced.

Verification: TypeScript and the production build passed (`npm run build`).
All 10 selected browser tests passed: seven in `tests/upload.spec.ts` plus the
existing drag/replacement, camera permission failure and camera capture tests.
Coverage includes native file chooser events, canceled replacement, removal and
reselection, nested/canceled drags, validation failures, analysis error recovery
and disabled actions, keyboard focus, the four guide links, reduced motion and
touch input. Layout and typography measurements for empty and preview states
matched the saved baseline at 320, 390, 600, 768 and 1440px with no horizontal
overflow. Desktop and mobile screenshots were visually reviewed.

Browser checks used Microsoft Edge. Desktop camera capture used a simulated
canvas video stream and verified stream cleanup; mobile testing exercised the
native `capture="environment"` input with an image fixture. Physical camera
hardware and native mobile camera applications were not tested. Model status
and analysis error responses in the new tests are fixtures; AI inference was
not changed or retested in this phase.

## Phase 5: request-driven image scanning

`src/analysis-scanner.tsx` renders only while Analyze's real request is pending.
The original preview remains visible beneath a thin green sweep, a soft moving
highlight, a steady illuminated border and four decorative corner brackets.
These brackets are visual framing, not inferred damage locations. The processing
spinner is indeterminate; no progress percentage or staged AI claims are shown.
The scanner reuses the shared scan duration, easing and spinner animation.

The visible status reads "Analyzing rice crop image...". A single live region
outside the busy panel announces this state without waiting for `aria-busy` to
clear. Reduced motion hides the sweep and stops the spinner, leaving stationary
framing and readable status. Hidden tabs pause decorative animations; the request
continues. The visibility listener is removed when the scanner unmounts.

Cancel Analysis aborts the existing fetch, retains the image and returns focus
to Analyze Image for retry. The request ref blocks duplicate submissions, while
abort checks discard canceled responses. Success, failure, timeout and navigation
remove the scanner immediately; there is no minimum display time or dependency
on animation completion. Canceling the browser request does not guarantee that
the backend has stopped computation already in progress.

Verification: `npm run build` passed TypeScript and the production build. All
13 scanning and upload browser tests passed, including six new scanning tests.
Coverage includes pending requests, duplicate clicks, success while the sweep is
paused, unchanged returned probabilities, HTTP/network/malformed-response errors,
retry, cancellation and late responses, timeout, navigation cleanup, hidden tabs,
live reduced-motion changes and responsive layouts at 320, 390, 768 and 1440px.
The responsive test passed again after waiting for the existing mobile menu's
breakpoint transition before screenshots. Desktop and mobile scans were visually
reviewed. API responses are explicit browser-test fixtures; real model inference
was not rerun. No backend, model or classification values were modified.

## Phase 6: classification result reveal

Only the Results Pages opt in to the new sequence. The uploaded photo fades in,
followed by the information panel, a subtle icon scale and the class text. The
confidence fill follows, then the probability rows and fills stagger in their
existing sorted order. Actions fade in and use the shared 2px hover lift with
soft shadows and pressed feedback. The final probability fill completes at
880ms with default tokens. Layouts, fonts and the existing pest, healthy and
Unknown themes are retained.

The sequence reuses Phase 1 entrances, `staggerStyle` and timing tokens. A single
result-only keyframe scales each fill from zero to its raw response width. The
probability track and fill inherit the row's shared stagger delay. Numeric labels
show their returned scores immediately; there are no counter timers or temporary
prediction values. Keyboard focus reveals delayed actions immediately. Reduced
motion removes all entrances and shows the final bar widths without delays.

Genuine zero scores now have zero-width fills instead of a minimum 2px segment.
The normal one-decimal percentage display is retained. Positive scores below
0.1% display `<0.1%`, and less-than-certain scores above 99.9% display `>99.9%`.
This avoids falsely displaying zero or certainty. Progressbar accessibility
values and fill widths retain the raw response percentages. The existing API
validation and score selection are unchanged: missing classes are never added,
and Unknown appears in the score list only if the connected backend returns it.

Verification: TypeScript and the production build passed (`npm run build`). All
13 selected browser tests passed: seven new result tests and six scanning
regressions. Explicit development fixtures cover all four intended results,
their themes and guide links, the reveal order, zero-to-value bar animation,
score precision, genuine zero scores, a model that does not support Unknown,
reset/retry, immediate keyboard access and live reduced-motion changes. The
scanning tests continue to verify immediate result handoff and request cleanup.

Layout and typography measurements matched the saved original for all four
result states at 320, 390, 600, 768 and 1440px (20 comparisons, no horizontal
overflow). Desktop result screenshots and the mobile Unknown result were
visually reviewed. Tests used Microsoft Edge and labeled API fixtures, not new
real model inference. No prediction pipeline or model files were changed.

## Phase 7: Pest Guide and page transitions

- The four guide cards use the shared hover lift, soft shadows and a green
  border highlight. Their existing images zoom subtly and View Details arrows
  move 3px on fine-pointer hover. Keyboard focus receives the same card highlight
  and retains the link outline. Touch and reduced motion do not retain movement.
- Existing page roots use `motion-page motion-fade-up` for a 250ms entrance,
  with no delay or exit wait. Navigation and its focus handling remain outside
  these elements. Analyze keeps its existing state through ordinary rerenders;
  Results apply the entrance to the panel beneath the focused result heading.
  The Phase 6 reveal sequence and raw values are retained. Detail roots use the
  guide slug as a key so a changed detail entry gets its own entrance.
- Detail imagery and copy fade in; the main heading enters with a 6px lift.
  Section headings and the lower notice reveal once as needed. About sections
  and guide cards also opt into section reveals on their existing elements.
- `useSectionReveals` in `src/scroll-reveal.ts` owns one IntersectionObserver per
  mounted page. Content starts visible; sections below the viewport are armed
  and unobserved after their first entrance. Focus exposes a pending section
  immediately. Reduced motion exposes all sections and clears pending effects.
  Missing IntersectionObserver support leaves everything visible. Observers,
  focus listeners and media listeners are cleaned up on unmount or slug changes.
  No scroll listeners, animation timers, dependencies or layout wrappers were
  added. Child motion keeps its original durations.

Verification: TypeScript and the production build passed (`npm run build`).
All 36 selected browser tests passed after targeted reruns: eight new guide and
navigation tests, eight Home/navigation regressions, seven result tests, six
scanning tests and seven upload tests. Three older position assertions initially
measured during the new entrance; they now wait for the entrance to settle and
passed on rerun. An older Phase 3 expectation was also updated to recognize the
upload button hover already added in Phase 4.

Checks cover all four guide links, hover return, keyboard focus, rapid navigation
while an entrance is paused, retained upload state, result handoff, scroll-once
behavior, observer cleanup and fallback, reduced motion, and mobile touch
navigation. Layout and typography matched the saved baseline for eight routes
at 320, 390, 768 and 1440px (32 comparisons), plus all four result states at five
widths (20 comparisons). There was no horizontal overflow. Desktop guide/detail
and mobile detail screenshots were visually reviewed.

Browser verification used Microsoft Edge with emulated mobile/touch viewports.
Analysis responses in navigation and result checks were labeled development
fixtures; the model and backend were not changed or re-evaluated in this phase.

## Phase 8: final polish and validation

- Retained the shared 180ms interaction, 250ms page, 400ms reveal and 1400ms
  crossfade tokens and easing curves. The slower hero and request scanner timing
  remains intentional. No dependencies or alternate animation systems were added.
- Fixed entrances replaying after focus left an element. `useMotionFocus` in
  `src/motion.ts`, mounted once by App, exposes focused entrances permanently for
  that element's lifetime using `motion-entered`. This keeps a page visible when
  Analyze disables the focused button or a camera dialog takes focus. The one
  delegated focus listener is removed on unmount. Fresh route elements retain
  their entrances; existing keyboard and reduced-motion behavior is preserved.
- Fixed hover selectors overriding upload and result buttons' pressed shadows.
  Their existing shared hover movement, timing and pressed feedback now compose.
- The hero's existing suspension state also observes viewport visibility. Its
  slideshow timer, zoom, scanner, glow and floating frames pause offscreen and
  resume without catching up. Manual pause, hidden tabs, image decoding and
  reduced motion retain their behavior. The observer disconnects on unmount;
  browsers without IntersectionObserver retain the existing visibility policy.
- At widths up to 760px or with a coarse pointer, keep crossfades and the scan
  line, while removing continuous hero zoom, frame floating and glow pulsing.
  Mobile hero and analysis corner brackets omit drop-shadow filters. This leaves
  one continuous hero animation loop instead of five on desktop. No scrolling
  listeners, permanent will-change layers or additional animation timers were added.
- Hidden-tab analysis now pauses both processing spinners, including the one
  outside the scanner overlay. The real request continues normally.
- Print styles expose pending scroll sections immediately and disable motion.
  Screen reader status, image previews, routes, layouts, real model values and
  the four intended categories are preserved.

The Phase 8 checks in `tests/polish.spec.ts` cover offscreen playback, the mobile
animation budget, pressed states, print visibility and focus/disabled-control
replay. Existing scanning checks now cover both hidden-tab spinners. Two older
checks were corrected: model notices are scoped separately from upload status,
and the route test freezes entrances from their first frame so a busy machine
cannot finish the animation before the test inspects it.

Verification:

- `npm run build`: passed TypeScript compilation and the Vite production build.
- `npm run test:e2e -- --reporter=line`: all 66 unique browser checks passed
  after a targeted rerun. The final full run passed 65; the new focus regression
  initially looked up Analyze by its idle label after the button had changed to
  its busy label. Using the stable button selector fixed the test, and the
  targeted rerun passed. Production code did not change after the final build.
- `python -m unittest discover -s tests -v` in the project virtual environment:
  all six API tests passed, including inference with the existing trained weights.
- A browser audit of the production build measured five running infinite hero
  loops on desktop and one on mobile. A real uploaded image returned a Rice
  Leaffolder prediction from EfficientNet-B0; displayed scores matched the API.
  Network latency was emulated to inspect and capture the actual pending request.
  The page stayed fully visible as the Analyze button disabled, and no page
  errors were reported. Desktop Home, mobile Home, scanning and real result
  screenshots were visually reviewed.
- Saved layout and typography baselines matched eight routes at four widths
  (32 comparisons) and all four result states at five widths (20 comparisons).
  No horizontal overflow was found. Tests confirm the removed pest remains
  absent from advertised categories, guide content and its former detail route.
- `git diff --check -- frontend`: passed.

Changed source files: `src/hero.tsx`, `src/main.tsx`, `src/motion.ts`,
`src/motion.css`, `src/styles.css`. Changed checks: `tests/polish.spec.ts` (new),
`tests/scanning.spec.ts`, `tests/classifications.spec.ts`,
`tests/guide-navigation.spec.ts`. This motion document was also updated.

Limitations: browser checks used Microsoft Edge and mobile/touch emulation;
physical phones and cameras were not tested. Camera capture used a simulated
video stream, plus native capture-input and permission-failure checks. All four
result themes used explicit development fixtures; real inference and Unknown
handling were checked separately. This phase validates UI behavior, not model
accuracy or confidence calibration. The model and backend were not modified.

Final Phase 8 status: COMPLETE. Changes remain local; no later phase was started.
