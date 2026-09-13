/**
 * The voice contract shared by the Studio server (`server/voice*.ts`), the
 * Studio page (`src/studio/VoiceView.tsx`) and the command line: the tutor's
 * voice, Lina, is cast here from candidate voices, and lessons are narrated
 * with the cast voice, then published as `shared/Assets/Voice/<lessonId>/`
 * (one AAC file per step and a manifest), exactly as
 * `StrokeTutor/Features/Player/NarrationPlayer.swift` expects.
 *
 * Speech is made on the creator's private text-to-speech server (an MLX-Audio
 * server on their tailnet, OpenAI-compatible `/v1/audio/speech`), never by an
 * outside provider. Nothing here is read by the iOS app except the published
 * manifest (`VoiceManifest`).
 */

/** Which text-to-speech model a voice is made with, on the creator's server. */
export type VoiceEngine =
  /** Chatterbox Turbo: one fixed English voice, fast and steady. `instruct` and `speaker` are ignored. */
  | 'chatterbox'
  /** Qwen3 VoiceDesign: a voice invented from `instruct`, a description of the person. Varies a little from take to take until frozen. */
  | 'qwen-design'
  /** Qwen3 CustomVoice: one of a fixed set of speakers (`speaker`), with `instruct` steering the delivery. */
  | 'qwen-custom'

/** The speakers Qwen3 CustomVoice knows. An unknown name silently falls back to a default, so the page offers only these. */
export const QWEN_SPEAKERS = ['Vivian', 'Serena', 'Ryan', 'Aiden', 'Dylan', 'Eric', 'Uncle_Fu', 'Ono_Anna', 'Sohee'] as const
export type QwenSpeaker = (typeof QWEN_SPEAKERS)[number]

/**
 * A designed voice that was frozen: one of its takes was uploaded to the
 * text-to-speech server as a reference, and every later line is cloned from it
 * (Qwen3 Base), so the voice no longer drifts between takes.
 */
export interface FrozenReference {
  /** The reference's name on the server (`/Users/kevin/tts/voices/<name>.wav`). */
  referenceName: string
  /** The exact words spoken in the reference. */
  referenceText: string
  /** The take that was frozen, still playable through `GET /api/voice/takes/:id`. */
  takeId: string
  frozenAt: string
}

/** One candidate for Lina's voice. */
export interface Voice {
  id: string
  name: string
  /** One line about the personality, shown under the name. */
  tagline: string
  engine: VoiceEngine
  /** The person (qwen-design) or the delivery (qwen-custom); nothing for chatterbox. */
  instruct: string
  /** qwen-custom only. */
  speaker: QwenSpeaker | null
  /** Set once the voice is frozen; null while it is still free to vary. */
  frozen: FrozenReference | null
  /** One of the Studio's starting suggestions, as opposed to one the creator made. */
  suggested: boolean
  createdAt: string
  updatedAt: string
}

/** What a client sends to create or change a voice. */
export interface VoiceInput {
  name: string
  tagline?: string
  engine: VoiceEngine
  instruct?: string
  speaker?: QwenSpeaker | null
}

/** A line of the audition script: every voice reads the same lines, so they can be compared. */
export interface ScriptLine {
  id: string
  /** Where in the app the line would be heard: "Hello", "A step", "Encouragement", "Finished"… */
  label: string
  text: string
}

/** One generated recording of one voice reading one text. */
export interface Take {
  id: string
  voiceId: string
  text: string
  /** `sha256(engine settings + text)`, the cache key: the same voice saying the same words is not made twice unless asked. */
  textHash: string
  durationMs: number
  createdAt: string
  /** True when this call found the take already made. */
  cached?: boolean
}

/** The text-to-speech server as the Studio server sees it right now. */
export interface VoiceServerStatus {
  /** The speech endpoint's origin, from STUDIO_TTS_URL. */
  url: string
  reachable: boolean
  /** Model families currently loaded on the server, e.g. "chatterbox-turbo". */
  warm: string[]
  /** True while the server is making speech for someone. */
  generating: boolean
  /** Reference voices stored on the server, by name. */
  references: string[]
  /** Why it is not reachable, when it is not. */
  error?: string
}

/** `GET /api/voice`: everything the Voice page needs at once. */
export interface VoiceState {
  server: VoiceServerStatus
  /** The voice cast as Lina, or null while none is chosen. */
  castVoiceId: string | null
  voices: Voice[]
  script: ScriptLine[]
  /** Every take that exists, newest first, so the page can show what is already recorded without generating. */
  takes: Take[]
}

/** The narration of one step of a lesson, as it stands in the workspace. */
export interface StepNarration {
  stepId: string
  title: string
  /** The written instruction, what is spoken unless a line is written for it. */
  instruction: string
  /** A spoken line written for this step, or null to speak the instruction. */
  spokenLine: string | null
  /** What is (or would be) spoken: `spokenLine ?? instruction`. */
  text: string
  /** The recording made for this step, or null if none yet. */
  take: Take | null
  /**
   * Why the recording no longer matches: the words changed since it was made,
   * the cast voice changed, or nothing is wrong (`null`). A step with no take
   * is 'missing'.
   */
  stale: 'missing' | 'text-changed' | 'voice-changed' | null
}

/** `GET /api/voice/lessons/:id`. */
export interface LessonNarration {
  lessonId: string
  title: string
  castVoiceId: string | null
  steps: StepNarration[]
  /** What is in `shared/Assets/Voice/<lessonId>/` now, or null if nothing was published. */
  published: {
    generatedAt: string
    voiceId: string
    voiceName: string
    stepCount: number
    /** True when a step's published text or voice differs from the workspace's current take. */
    behind: boolean
  } | null
}

/** `shared/Assets/Voice/<lessonId>/manifest.json`: what the iOS app bundles beside the audio files. */
export interface VoiceManifest {
  manifestVersion: 1
  lessonId: string
  voiceId: string
  voiceName: string
  /** The engine the audio was made with, for the record. */
  model: string
  generatedAt: string
  steps: Record<
    string,
    {
      /** Relative to the manifest: `<stepId>.m4a`. */
      file: string
      text: string
      textHash: string
      durationMs: number
    }
  >
}

/**
 * `shared/Assets/Voice/reference/<voiceId>.json`, beside the `.wav` it
 * describes: everything needed to put a frozen voice back on a speech server
 * that has never heard of it. The reference itself lives only on the creator's
 * Mac and in the gitignored workspace, so without these two files a wiped
 * machine would lose Lina; with them, `voice reference restore` uploads the WAV
 * again under the same name and the voice speaks exactly as before.
 */
export interface VoiceReferenceRecord {
  referenceVersion: 1
  voiceId: string
  name: string
  tagline: string
  engine: VoiceEngine
  instruct: string
  speaker: QwenSpeaker | null
  /** The name the reference is stored under on the speech server. */
  referenceName: string
  /** The exact words spoken in the WAV, which the clone needs. */
  referenceText: string
  frozenAt: string
  takeId: string
  durationMs: number
}
