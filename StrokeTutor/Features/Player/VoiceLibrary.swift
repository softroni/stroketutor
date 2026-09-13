import Foundation
import OSLog

/// `shared/Assets/Voice/<lessonId>/manifest.json`, written by the Studio when a
/// lesson's narration is published (`web/src/voice/types.ts`, `VoiceManifest`).
/// Only the parts the app acts on are decoded; the rest is the Studio's record of
/// how the recordings were made.
struct VoiceManifest: Decodable, Equatable {

    /// One step's recording: the file beside the manifest, and the words in it.
    struct Line: Decodable, Equatable {
        /// Relative to the manifest, always `<stepId>.m4a`.
        let file: String
        /// What Lina says — the step's instruction, or the spoken line written for
        /// it. Kept so a screen can show the words it is about to play.
        let text: String
        let durationMs: Double?
    }

    let manifestVersion: Int
    let lessonId: String
    let voiceName: String?
    /// Keyed by step id.
    let steps: [String: Line]
}

/// `shared/Assets/Voice/app/manifest.json`: the lines Lina says outside a lesson —
/// her hello on `ob-voice` and in Settings, and the eight closing lines of
/// `sk-complete`. The same shape as a lesson's manifest, keyed by line id
/// (`APP_LINE_IDS` in the same contract).
struct AppVoiceManifest: Decodable, Equatable {
    let manifestVersion: Int
    let voiceName: String?
    let lines: [String: VoiceManifest.Line]
}

/// The recordings in the bundle, read once and remembered.
///
/// A lesson's manifest is loaded the first time that lesson asks for a line rather
/// than at launch: a learner who never opens a lesson never reads a byte of it, and
/// a lesson with no recordings costs one failed file read.
///
/// The manifest, not the folder, is what says a recording exists. `voice publish`
/// writes the audio files and then the manifest, so a folder without one is a
/// publish that did not finish, and what is in it may not be what the lesson says
/// any more. A step is spoken only when the manifest names it *and* the file is
/// there; a missing or malformed manifest simply means that lesson has no voice,
/// which is not something to recover from or to tell the learner about — the
/// instruction is on screen either way.
@MainActor
final class VoiceLibrary {

    /// `Voice/` inside the bundle, or nil when the folder was not bundled at all.
    private let root: URL?
    private var lessons: [String: VoiceManifest?] = [:]
    private var appLines: AppVoiceManifest??
    private let fileManager = FileManager.default

    private static let log = Logger(subsystem: "com.softroni.StrokeTutor", category: "voice")

    convenience init(bundle: Bundle = .main) {
        self.init(root: bundle.resourceURL?.appendingPathComponent("Voice", isDirectory: true))
    }

    /// Reads any folder laid out as the bundle's `Voice/` is, which is what the
    /// tests hand it.
    init(root: URL?) {
        self.root = root
    }

    // MARK: - Lessons

    /// What was published for this lesson, or nil when nothing was.
    func manifest(lessonId: String) -> VoiceManifest? {
        if let known = lessons[lessonId] { return known }
        let loaded: VoiceManifest? = folder(lessonId).flatMap {
            decode(VoiceManifest.self,
                   at: $0.appendingPathComponent("manifest.json"),
                   describedAs: "the narration of \(lessonId)")
        }
        let kept = readable(loaded, version: loaded?.manifestVersion, named: "\(lessonId)/manifest.json")
        lessons[lessonId] = kept
        return kept
    }

    /// The recording of one step, when the manifest names it and the file is there.
    func audioURL(lessonId: String, stepId: String) -> URL? {
        guard let line = manifest(lessonId: lessonId)?.steps[stepId],
              let folder = folder(lessonId) else { return nil }
        return existingFile(line.file, in: folder)
    }

    /// The words of one step's recording, for a screen that shows what it plays.
    func text(lessonId: String, stepId: String) -> String? {
        manifest(lessonId: lessonId)?.steps[stepId]?.text
    }

    // MARK: - The app's own lines

    /// The lines Lina says outside a lesson, or nil when none were published.
    func appManifest() -> AppVoiceManifest? {
        if let known = appLines { return known }
        let loaded: AppVoiceManifest? = folder("app").flatMap {
            decode(AppVoiceManifest.self,
                   at: $0.appendingPathComponent("manifest.json"),
                   describedAs: "the app's own lines")
        }
        let kept = readable(loaded, version: loaded?.manifestVersion, named: "app/manifest.json")
        appLines = kept
        return kept
    }

    func appAudioURL(_ id: String) -> URL? {
        guard let line = appManifest()?.lines[id], let folder = folder("app") else { return nil }
        return existingFile(line.file, in: folder)
    }

    /// What Lina says in one of the app's own lines. It is the copy the card beside
    /// the play button shows, so the words and the recording are never two
    /// different sentences.
    func appText(_ id: String) -> String? {
        appManifest()?.lines[id]?.text
    }

    // MARK: - Reading

    private func folder(_ name: String) -> URL? {
        root?.appendingPathComponent(name, isDirectory: true)
    }

    /// A manifest written for a later app than this one is put aside rather than
    /// half-read: silence is the safe end of that, and the words are on screen.
    private func readable<T>(_ manifest: T?, version: Int?, named name: String) -> T? {
        guard let manifest, let version else { return nil }
        guard version == 1 else {
            Self.log.notice("Voice/\(name) is version \(version), which this app does not read.")
            return nil
        }
        return manifest
    }

    /// A file name in a manifest is only ever a name: one that tries to reach out
    /// of its own folder is ignored rather than followed.
    private func existingFile(_ name: String, in folder: URL) -> URL? {
        guard !name.isEmpty, !name.contains("/"), !name.hasPrefix(".") else { return nil }
        let url = folder.appendingPathComponent(name)
        return fileManager.fileExists(atPath: url.path) ? url : nil
    }

    private func decode<T: Decodable>(_ type: T.Type, at url: URL, describedAs what: String) -> T? {
        guard let data = try? Data(contentsOf: url) else { return nil }
        do {
            return try JSONDecoder().decode(type, from: data)
        } catch {
            // Nothing the learner can do about it, and nothing is lost but the
            // sound, so it is logged and never shown.
            Self.log.error("The manifest for \(what) could not be read: \(error.localizedDescription)")
            return nil
        }
    }
}
