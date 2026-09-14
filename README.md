# Verita Health

A React Native app that uses sensors already on a phone (front/rear camera +
flash, microphone, accelerometer, touchscreen) to screen for three narrow,
specific patterns: **suspected sudden cardiac arrest** (collapse + no
detectable pulse + no response to a check-in prompt), **possible
stroke** via all four FAST warning signs — **F**ace drooping
(facial-landmark symmetry via the front camera), **A**rm weakness (a finger
tapping test), **S**peech difficulty (on-device speech recognition against a
test phrase), and **T**ime (a manually-started onset stopwatch, since Time
is a call to action rather than something a sensor can detect) — and
**possible heart attack** via sudden facial
pallor (skin color compared against a saved personal baseline, since skin
tone itself varies too much across people for any absolute "pale"
threshold to mean anything). It is a screening aid to help someone get help
faster, not a diagnostic or FDA-cleared medical device. See [Medical &
safety disclaimer](#medical--safety-disclaimer) before using or
distributing it.

## What it actually does

- **Active Check** (`src/screens/ActiveCheckScreen.tsx`): user covers the
  camera + flash with a fingertip for 20s. `src/signal/ppgProcessor.ts`
  turns the resulting red-channel intensity stream into a BPM estimate and
  beat-to-beat intervals; `src/signal/hrvAnalysis.ts` flags markedly
  irregular beat spacing for follow-up (not a diagnosis — see limitations).
- **Passive collapse monitoring** (toggle on the home screen): while the app
  is in the foreground, `src/sensors/motion.ts` streams accelerometer data
  into `src/signal/collapseDetector.ts`, which looks for a sharp impact
  followed by ~8s of near-zero motion.
- **Triage fusion** (`src/signal/triageEngine.ts`): combines collapse status,
  last known pulse status, and response to an on-screen "are you OK?"
  prompt. **CRITICAL — the only level that opens the emergency flow —
  requires all three: collapse detected, no evidence of a pulse, and no
  response within the timeout.** Any one or two signals alone produce a
  lower, non-emergency level. This is intentionally conservative to avoid
  auto-alerting on a single ambiguous signal.
- **Emergency alert flow** (`src/screens/EmergencyAlertScreen.tsx`,
  `src/services/alertService.ts`): a cancellable 30s countdown, after which
  the native SMS composer opens pre-filled with an alert + Google Maps
  location link to your saved emergency contacts, and a one-tap "call local
  emergency number" button (looked up from `src/config/emergencyNumbers.ts`
  by the region you set in Settings — override this, especially when
  traveling).
- **Finger Tap Test** (`src/screens/StrokeCheckScreen.tsx`,
  `src/signal/fingerTapAnalysis.ts`): a 10-second tap-as-fast-as-you-can test
  per hand. Compares tap rate and rhythm between hands — a large asymmetry
  can indicate one-sided weakness (the "Arm weakness" in FAST: Face
  drooping, Arm weakness, Speech difficulty, Time to call emergency
  services). Deliberately never auto-triggers the emergency alert flow on
  its own — a single tapping-asymmetry reading is too weak and too easily
  confounded (handedness, fatigue, prior injury) to justify that; it only
  ever produces a "flag for follow-up" result with an explicit reminder to
  call emergency services if it comes with facial or speech symptoms.
- **Face Check** (`src/screens/FaceCheckScreen.tsx`,
  `src/signal/faceSymmetryAnalysis.ts`): a 4-second front-camera burst.
  `src/sensors/faceLandmarkCamera.ts` bridges to a native facial-landmark
  detector (see "Camera PPG and Face Check require native plugins" below)
  and the pure-logic module compares mouth-corner droop and eyelid aperture
  left vs right, normalized by interocular distance so face size/distance
  from the camera doesn't matter. Median-aggregated across the whole burst
  so a single blink or head turn can't produce a false flag. Same design
  stance as the Finger Tap Test: a "flag for follow-up" result only, never
  an auto-triggered emergency alert, with an explicit reminder to call
  emergency services if it comes with arm weakness or slurred speech.
- **Speech Check** (`src/screens/SpeechCheckScreen.tsx`,
  `src/signal/speechAnalysis.ts`): the user reads a fixed test sentence
  aloud — the Cincinnati Prehospital Stroke Scale's own phrase, "You can't
  teach an old dog new tricks", not one this app invented.
  `src/sensors/speechCheck.ts` bridges to on-device speech recognition (via
  `@react-native-voice/voice` — see the maintenance note in that file) and
  the pure-logic module scores two independent signals: word error rate
  against the expected phrase, and how much slower the attempt was than a
  normal reading pace. This is the weakest and most confounded of the three
  signals here — a failed transcription looks identical to a genuinely
  slurred one, and background noise/accent/microphone quality all matter —
  so like the other two, it only ever produces a "flag for follow-up"
  result, never an auto-triggered emergency alert.
- **Pallor Check** (`src/screens/PallorCheckScreen.tsx`,
  `src/signal/facialPallorAnalysis.ts`): a 5-second front-camera burst
  screening for sudden pale/ashen skin — one of several possible external
  signs of reduced blood perfusion that can accompany a heart attack.
  Deliberately **not** an absolute "pale" threshold — skin tone varies far
  too much across people for a universal cutoff to mean anything, and would
  bake in real bias. Instead the first-ever run just saves its aggregate
  color (median across the burst, from `src/sensors/faceColorCamera.ts`'s
  native color-sampling plugin) as a personal baseline
  (`src/services/skinToneBaseline.ts`); every run after that compares
  against it via `r/(r+g+b)` normalized redness, which is less sensitive to
  overall brightness than raw RGB. A "Recapture baseline" action on the
  results screen lets you reset it (tan, makeup, a new usual lighting setup
  all justify that). This is the **weakest and most confounded** camera
  signal in the app — a phone's automatic white balance and exposure
  actively fight this kind of measurement, since they're built to
  compensate for lighting/color changes rather than preserve them for
  comparison — so, same as Face Check/Finger Tap Test/Speech Check, it only
  ever produces a "flag for follow-up" result with an explicit reminder that
  the actual heart attack warning signs (chest pain/pressure, shortness of
  breath, pain radiating to arm/jaw, cold sweat, nausea) matter far more
  than this check and warrant calling emergency services regardless of what
  it shows.
- **Symptom-onset timer** (`src/screens/StrokeScreeningScreen.tsx`,
  `src/services/symptomTimer.ts`): the "Time" in FAST — Face, Arm, Speech,
  **Time** — isn't a sensor signal, it's a call to action, so this is a
  manually-started stopwatch, not a detection heuristic. Elapsed time is
  always recomputed live from the stored onset timestamp (`Date.now() -
  onset`) rather than an incrementing counter, so it can't drift even if the
  app is backgrounded for hours. Shown as a plain `HH:MM:SS` — deliberately
  digits-and-colons only, no words, so it needs no translation and reads
  like an actual stopwatch. Matters clinically: stroke treatment options
  (e.g. clot-dissolving medication) are genuinely time-windowed, and EMS/ER
  staff will ask exactly when symptoms started — this exists so that answer
  is precise instead of a guess made under stress.
- **History** (`src/screens/HistoryScreen.tsx`, `src/services/history.ts`,
  `src/signal/historyTrends.ts`): every completed Active Check, Face Check,
  Finger Tap Test, Speech Check, and Pallor Check is saved locally
  (AsyncStorage, capped at `MAX_HISTORY_ENTRIES` — oldest entries drop off
  first) as a small typed summary, not the raw signal — no `ibiMs` arrays,
  landmark frames, transcripts, or camera frames are kept, just the numbers
  a trend needs (BPM, irregularity score, asymmetry score, word error rate,
  redness drop, and which triage level each result produced). The History screen filters by check type and shows a
  small sparkline plus latest/average/range for whichever one metric that
  type tracks, alongside the full list — unreliable readings are included and
  labeled "not enough signal to score" rather than silently dropped.
  `historyTrends.ts` keeps the trend math (latest vs. previous, min/max/avg,
  up/down/flat) as plain, RN-free TypeScript, same rationale as the rest of
  `src/signal/*` — unit tested, no simulator needed. Nothing here is
  transmitted anywhere; the "Clear history" button on that screen wipes it,
  since it's on-device biometric screening data and should be trivial to
  remove.
- **Nearby hospitals** (`src/screens/NearbyHospitalsScreen.tsx`,
  `src/services/hospitalLookup.ts`): rather than bundle a hospital directory
  or call a Places API (an API key and a network dependency this otherwise
  fully on-device app doesn't otherwise need), this builds a native maps
  search URL — `maps.apple.com` on iOS, the `geo:` intent scheme on Android,
  with a Google Maps web-search fallback if neither can be opened — and
  hands off to whatever maps app is already installed, using its live data
  instead of a static list that would go stale. Two separate search buttons,
  deliberately not one: **Nearest Emergency Room** for an active emergency
  (any ER, not necessarily cardiac-specialized — the nearest one is the
  right call when time matters), and **Nearest Cardiovascular Center** for
  following up on a flagged (LOW) Active Check irregularity result — not for
  an active emergency. A prominent "call emergency now" box sits above both,
  and Active Check's results screen links here directly when an irregularity
  gets flagged. Reachable anytime from the Home dashboard's link row too.

## Why it never sends anything silently by default

Apple does not allow third-party apps to send SMS without the user tapping
send in the native composer; there is no way around this on iOS. Rather than
build an inconsistent "silent on Android, tap-required on iOS" experience —
and because a false-positive CRITICAL silently texting or calling people on
someone's behalf is a worse failure mode than asking for one tap — the
default flow on both platforms ends at the native compose/dial screen. The
30s countdown is the actual safety mechanism (time for the user or a
bystander to cancel); the final send/call is always a human action.

If you've made a deliberate, consent-covered decision to remove that last
tap on Android (Apple does not permit the equivalent on iOS), see
`android_native_reference/SilentSmsModule.kt` — it is a reference sketch,
not wired into the default build.

## Multi-language support

English and Spanish today (`src/passed/locales/en.json`, `es.json`), switched
in Settings and persisted locally (`src/services/language.ts`). Built on
`i18next`/`react-i18next` — deliberately **pure JS, no native module** like
`react-native-localize` for device-locale auto-detection: this project's
native build has already proven fragile (see the native-plugin notes above),
so language is an explicit user choice instead of something that needs a new
native dependency to detect automatically.

**Covers all static UI chrome** — every screen's titles, buttons,
instructions, and disclaimers, plus the Speech Check test phrase itself
(`speechCheck.testPhrase` per language: English uses the actual Cincinnati
Prehospital Stroke Scale phrase; Spanish uses an idiomatic equivalent,
"Loro viejo no aprende a hablar", chosen for similar length/cadence/meaning
but **not independently verified against a validated Spanish-language stroke
scale** — same "starting heuristic, not clinically validated" caveat as the
rest of this app).

**Does not (yet) cover** the dynamic "reasons" sentences returned by the
pure-logic signal modules (`src/signal/*.ts`, e.g. `analyzeFingerTaps`'s
`reasons: string[]`) — those stay English-only. Those modules are
deliberately RN-free, framework-agnostic TypeScript (see "Project layout"
below); threading translation keys through their return types and existing
unit tests is a larger, separate change than this one covers.

`__tests__/passedLocales.test.ts` guards against locale drift: every language
must define the exact same set of keys with the exact same `{{variable}}`
interpolation placeholders, so a translation can't silently fall back to a
raw key or drop a value.

## Project layout

```
src/
  types/               shared TS types, no RN dependency
  signal/              pure signal-processing core (ppgProcessor, hrvAnalysis,
                        collapseDetector, triageEngine, fingerTapAnalysis,
                        faceSymmetryAnalysis, speechAnalysis, historyTrends,
                        facialPallorAnalysis) — no RN imports, unit tested
  sensors/              camera PPG + face-landmark camera + face-color camera +
                        speech capture + accelerometer + permissions bridges to RN/native
  services/             emergency contacts storage, check history storage,
                        skin-tone baseline storage, language storage, alert/countdown, location, MonitorProvider
  passed/                i18next setup + locales/en.json, locales/es.json
  screens/, navigation/, components/   UI
__tests__/              Jest tests for src/signal/* and src/passed/locales/*
ios/, android/          generated native projects (checked in, see "Native projects" below)
android_native_reference/  Kotlin frame-processor plugins (PPG, face landmarks, face color),
                            optional silent-SMS module, AndroidManifest permission snippet
ios_native_reference/      Swift frame-processor plugins (PPG, face landmarks, face color),
                            Info.plist permission snippet
```

`src/signal/*` has zero React Native imports on purpose — it's plain,
synchronous TypeScript so the emergency-detection logic itself can be unit
tested in Node without a simulator/device, and so it's easy to audit.

## Setup

```bash
# 1. Install dependencies
npm install

# 2. Run the pure-logic unit tests
npm test

# 3. iOS only
cd ios && pod install && cd ..

# 4. Run
npm run ios     # or
npm run android
```

`ios/` and `android/` are already generated and checked into this repo (RN
0.74.5 template), with the permission manifests from `android_native_reference/`
and `ios_native_reference/` already merged in. **Both were verified to build
clean during development**: `./gradlew assembleDebug` produced a working
debug APK, and `xcodebuild ... build` for the iOS Simulator succeeded —
installed, launched, and screenshotted on-device to confirm the UI actually
renders, including after adding `@react-native-voice/voice` for Speech
Check (autolinked cleanly on both platforms, 65 pods on iOS).

**Speech Check works out of the box** — no native plugin wiring needed, just
`pod install`/a Gradle sync to pick up the dependency. **Camera PPG, Face
Check, and Pallor Check don't**: all three need a native Frame Processor
Plugin wired in by hand (see below) before they'll produce real readings,
though the app builds and runs fine without that — the Home dashboard,
Finger Tap Test, Speech Check, emergency contacts/alert flow, etc. all work
with zero native plugin wiring.

If you ever need to regenerate `ios/`/`android/` from scratch (e.g. bumping
the RN version), generate a fresh template in a scratch dir and copy just
those two folders over — don't hand-edit around a missing native project:

```bash
npx @react-native-community/cli init VeritaHealthScratch --version 0.74.5 --template react-native-template-typescript
cp -r VeritaHealthScratch/ios VeritaHealthScratch/android .
rm -rf VeritaHealthScratch
# then re-merge android_native_reference/AndroidManifest.snippet.xml and
# ios_native_reference/Info.plist.snippet.xml into the fresh folders.
```

### Camera PPG, Face Check, and Pallor Check require native plugins

All three features need a native Frame Processor Plugin — VisionCamera can't
do per-frame pixel reduction or ML inference fast enough in JS. Wire up, per
VisionCamera's "Creating Frame Processor Plugins" guide (these are reference
implementations to register in the native projects, not drop-in files):

- **PPG** (`meanRedChannel`): `android_native_reference/MeanRedChannelPlugin.kt`,
  `ios_native_reference/MeanRedChannelPlugin.swift`. No extra dependency.
- **Face Check** (`detectFaceLandmarks`): `android_native_reference/FaceLandmarksPlugin.kt`,
  `ios_native_reference/FaceLandmarksPlugin.swift`. iOS uses Apple's Vision
  framework — system-provided, no dependency. Android uses Google ML Kit
  Face Detection (on-device, no Firebase project or network call needed) —
  add `implementation("com.google.mlkit:face-detection:16.1.7")` to
  `android/app/build.gradle` first.
- **Pallor Check** (`meanFaceColor`): `android_native_reference/MeanFaceColorPlugin.kt`,
  `ios_native_reference/MeanFaceColorPlugin.swift`. No extra dependency —
  deliberately does not reuse ML Kit/Vision face detection (would mean a
  second ML pass per frame just for this); its `faceDetected` output is a
  coarse brightness sanity check, not real face detection. See the plugin
  files' own comments if you want to swap in real detection instead.

### If `pod install` fails with `ruby/config.h file not found`

This is a known macOS issue: Apple's system Ruby framework doesn't compile
native gem extensions cleanly against newer Xcode SDKs. Don't fight it —
either install Ruby via Homebrew + rbenv, or use a self-contained Ruby that
sidesteps the system framework entirely, e.g. the same
[portable-ruby](https://github.com/Homebrew/homebrew-portable-ruby/releases)
build used to verify this project (no Homebrew required, just download +
extract the tarball for your architecture and put its `bin/` on `PATH`
before running `pod install`).

### If Xcode's `[CP-User] [Hermes] Replace Hermes` script phase fails with `command not found`

`NODE_BINARY` in `ios/.xcode.env` resolves via `command -v node` inside
Xcode's own build-phase shell, which won't see a Node install that isn't on
the PATH Xcode itself uses (common if Node is only reachable via a shell rc
file, or an nvm/fnm shim, or a portable/manually-placed binary). Fix: create
`ios/.xcode.env.local` (gitignored, exactly what it's for) with:
```
export NODE_BINARY=/absolute/path/to/node
```

## Background monitoring limitations (read this before relying on it)

Both mobile OSes restrict what a foregrounded-only consumer app can do once
it's backgrounded:

- **iOS**: no background camera access at all (so no background PPG, ever),
  and background accelerometer streaming for third-party apps is heavily
  restricted outside of specific frameworks Apple reserves mostly for its
  own Health/Fitness stack.
- **Android**: the JS thread and sensor listeners stop when the app is
  backgrounded unless you run a persistent foreground service (not included
  here — it needs its own always-on notification and battery tradeoffs you
  should decide on deliberately, not something to bolt on silently).

Practically: treat **Active Check** as the reliable, on-demand tool, and
**passive collapse monitoring** as a best-effort feature that only works
while the app is open and on-screen. The triage engine reflects this reality
— it treats "no recent Active Check reading" as "pulse status unknown," and
leans on collapse + unresponsiveness alone for the CRITICAL path, rather
than pretending a continuous live pulse fusion exists that the phone
structurally cannot provide.

## Medical & safety disclaimer

Verita Health is a screening aid, not a diagnostic or treatment device. It
has not been reviewed or cleared by the FDA or any other regulator. Its
pulse estimate comes from camera PPG, not ECG; its collapse detection is a
heuristic over accelerometer data; its facial-symmetry check is a
camera-landmark heuristic that can't tell a stroke apart from Bell's palsy,
an old injury, or ordinary resting asymmetry, and normal lighting/camera
angle can throw it off; its speech check depends on on-device speech
recognition that can fail for reasons that have nothing to do with a stroke
(background noise, accent, a bad microphone), and a failed transcription
looks identical to a genuinely slurred one; and its pallor check — the
**weakest and most confounded signal in the entire app** — depends on a
phone camera's raw color response, which automatic white balance and
exposure are specifically designed to normalize away rather than preserve,
meaning a change in room lighting, a camera angle change, makeup, or a tan
can all produce the same reading as real pallor, and the baseline it
compares against is only as good as the lighting conditions it happened to
be captured in. The "Time" part of FAST isn't a sensor signal — it's a call
to action — so `src/screens/StrokeScreeningScreen.tsx`'s onset timer is
exactly that: a stopwatch the user starts manually, not something the app
detects or infers on its own. This app does not screen for the actual heart
attack warning signs that matter most (chest pain/pressure,
shortness of breath, pain radiating to the arm/jaw/back, cold sweat,
nausea) — pallor is a minor, supplementary signal, not a stand-in for those.
All of it can miss real emergencies and can raise false alarms. It does not
replace calling your local emergency number or seeking medical care. If you
or someone near you may be having a medical emergency — including any
sudden face drooping, arm weakness, slurred speech, chest pain, or shortness
of breath — contact emergency services immediately rather than relying on
this app. Do not ship this to real users without: legal/regulatory review
for your target markets, a real consent flow, and validation against actual
clinical events — the current thresholds in `src/signal/ppgProcessor.ts`,
`src/signal/hrvAnalysis.ts`, `src/signal/fingerTapAnalysis.ts`,
`src/signal/faceSymmetryAnalysis.ts`, `src/signal/speechAnalysis.ts`, and
`src/signal/facialPallorAnalysis.ts` are reasonable starting heuristics, not
clinically validated cutoffs.

## Testing

```
npm test
```

Covers `src/signal/ppgProcessor.ts`, `hrvAnalysis.ts`, `collapseDetector.ts`,
`triageEngine.ts`, `fingerTapAnalysis.ts`, `faceSymmetryAnalysis.ts`,
`speechAnalysis.ts`, `historyTrends.ts`, and `facialPallorAnalysis.ts` with
synthetic signals (regular/irregular pulse, collapse/no-collapse/ambiguous
accelerometer scenarios, symmetric/asymmetric tap patterns,
symmetric/drooping synthetic face landmarks, exact/garbled/slow synthetic
transcripts, every triage branch, trend summaries over
empty/single/multi-point series, and pale/normal synthetic skin-color
samples against a synthetic baseline), plus `src/passed/locales/en.json` and
`es.json` for key parity and matching `{{variable}}` interpolation names
across languages. The PPG and collapse math
were also independently sanity-checked against a parallel Python port during
development — same synthetic scenarios, same pass/fail outcomes.

Native-dependent code (`src/sensors/*`, `src/screens/*`) isn't covered by
this suite — Jest can't exercise a real camera or accelerometer. What *was*
verified during development: a full `./gradlew assembleDebug` (Android) and
`xcodebuild ... build` for the iOS Simulator both completed successfully
against this exact source tree, so the native build graph (VisionCamera +
worklets-core + all other pods/AARs) is known-good. That's a build-succeeds
check, not a functional one — actually exercising Active Check / collapse
detection / the emergency flow still needs a real device or simulator run
with a person tapping through it.
