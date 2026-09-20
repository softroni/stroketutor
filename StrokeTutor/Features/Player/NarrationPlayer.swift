import AVFoundation
import Foundation
import Observation
import OSLog

/// Lina's voice, on a step and on the app's own lines.
///
/// The pipeline the handbook specifies (`src/handbook.html`, "Narration: the tutor's
/// voice on every step") publishes one short AAC file per step from the Studio, into
/// `shared/Assets/Voice/<lessonId>/<stepId>.m4a` with a manifest beside it, bundled
/// as `Voice/` in the app; `Voice/app/` holds the lines Lina says outside a lesson.
/// The audio ships for whatever the Studio has published and nothing else, so a
/// lesson that has not been narrated is silent and hides its chip, exactly as it did
/// when no audio shipped at all. `VoiceLibrary` is what reads the folder.
///
/// Playback rules, from the same handbook section and the `pl-player` notes:
/// start with the step's animation; cancel on replay, back and leave; the speed
/// setting never touches the voice (`AVAudioPlayer.rate` is left alone); the session
/// is `.ambient` with mode `.spokenAudio` and options
/// `[.duckOthers, .interruptSpokenAudioAndMixWithOthers]` with the `.playback`
/// category, so the ringer switch is not what silences her (the setting is), music ducks under Lina, a podcast pauses, and a phone call is never
/// interrupted. An interruption stops the voice and counts as "finished speaking".
@Observable
@MainActor
final class NarrationPlayer {

    /// True while a file is actually playing, which is what the chip's wave shows.
    private(set) var isSpeaking = false

    @ObservationIgnored private let library: VoiceLibrary
    @ObservationIgnored private var player: AVAudioPlayer?
    @ObservationIgnored private var finished: FinishedListener?
    @ObservationIgnored private var interruptions: NSObjectProtocol?
    @ObservationIgnored private var isSessionActive = false

    private static let log = Logger(subsystem: "com.softroni.StrokeTutor", category: "voice")

    convenience init(bundle: Bundle = .main) {
        self.init(library: VoiceLibrary(bundle: bundle))
    }

    init(library: VoiceLibrary) {
        self.library = library
        // A phone call, Siri, another app taking the route: the line is lost, so it
        // stops rather than resumes halfway through a sentence.
        interruptions = NotificationCenter.default.addObserver(
            forName: AVAudioSession.interruptionNotification,
            object: AVAudioSession.sharedInstance(),
            queue: .main
        ) { [weak self] _ in
            MainActor.assumeIsolated { self?.stop() }
        }
    }

    deinit {
        if let interruptions { NotificationCenter.default.removeObserver(interruptions) }
    }

    // MARK: - A lesson's steps

    /// The recorded line for one step, if it shipped.
    func audioURL(lessonId: String, stepId: String) -> URL? {
        library.audioURL(lessonId: lessonId, stepId: stepId)
    }

    /// Whether this step has a voice. A step without one plays silently and the
    /// chip is hidden for that step — never greyed, which would read as broken.
    func hasAudio(lessonId: String, stepId: String) -> Bool {
        audioURL(lessonId: lessonId, stepId: stepId) != nil
    }

    /// What Lina says in that recording. The lesson's intro and outro
    /// (`LessonBookend`) are lines of the lesson like any step, and their words are
    /// shown as she says them.
    func lineText(lessonId: String, stepId: String) -> String? {
        library.text(lessonId: lessonId, stepId: stepId)
    }

    /// How long that recording lasts, when it shipped and the Studio measured it.
    func lineSeconds(lessonId: String, stepId: String) -> Double? {
        guard hasAudio(lessonId: lessonId, stepId: stepId),
              let milliseconds = library.manifest(lessonId: lessonId)?.steps[stepId]?.durationMs,
              milliseconds > 0 else { return nil }
        return milliseconds / 1000
    }

    /// Speaks the step's line from the top. Silently does nothing when there is no
    /// file: narration is never the only channel, the instruction is always on screen.
    func play(lessonId: String, stepId: String) {
        play(audioURL(lessonId: lessonId, stepId: stepId), named: "\(lessonId)/\(stepId)")
    }

    // MARK: - The app's own lines

    /// One of `Voice/app/`: `hello` on the onboarding beat and in Settings, and the
    /// eight `lesson-N` / `path-N` lines of the completion screen.
    func hasAppLine(_ id: String) -> Bool {
        library.appAudioURL(id) != nil
    }

    /// What Lina says in that line, so a card can show the words it plays rather
    /// than a sentence written separately and left to drift.
    func appLineText(_ id: String) -> String? {
        library.appText(id)
    }

    func playAppLine(_ id: String) {
        play(library.appAudioURL(id), named: "app/\(id)")
    }

    // MARK: - Playing

    /// Stops at once — the close button, a replay, a step change, leaving.
    func stop() {
        if isSpeaking { Self.log.debug("narration stopped") }
        player?.delegate = nil
        player?.stop()
        player = nil
        finished = nil
        isSpeaking = false
    }

    /// Hands the audio route back politely, so whatever was ducked comes up again.
    func deactivate() {
        stop()
        guard isSessionActive else { return }
        isSessionActive = false
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }

    private func play(_ url: URL?, named name: String) {
        stop()
        guard let url else { return }
        activateSession()
        do {
            let player = try AVAudioPlayer(contentsOf: url)
            let listener = FinishedListener { [weak self] in self?.didFinish(name) }
            player.delegate = listener
            player.prepareToPlay()
            player.play()
            self.player = player
            self.finished = listener
            isSpeaking = true
            Self.log.debug("narration started \(name, privacy: .public)")
        } catch {
            // A bad file is not the learner's problem: stay quiet and carry on.
            isSpeaking = false
            Self.log.error("narration could not play \(name, privacy: .public): \(error.localizedDescription)")
        }
    }

    private func didFinish(_ name: String) {
        Self.log.debug("narration finished \(name, privacy: .public)")
        player?.delegate = nil
        player = nil
        finished = nil
        isSpeaking = false
    }

    private func activateSession() {
        guard !isSessionActive else { return }
        let session = AVAudioSession.sharedInstance()
        do {
            // `.playback`, not `.ambient`: a learner who taps Play, or starts a
            // lesson with narration on, should hear Lina even with the ringer
            // switch off — the first thing the creator reported was a moving chip
            // and no sound. Music still ducks under her and a podcast still pauses;
            // the volume buttons still apply.
            try session.setCategory(.playback,
                                    mode: .spokenAudio,
                                    options: [.duckOthers, .interruptSpokenAudioAndMixWithOthers])
            try session.setActive(true)
            isSessionActive = true
        } catch {
            // Without a session the voice simply does not play. The lesson does.
            isSessionActive = false
        }
    }
}

/// `AVAudioPlayer` wants an `NSObject` delegate, and the player above is neither an
/// `NSObject` nor its own delegate — holding both would be a retain cycle. This is
/// the one job: say when the file ran out, so the chip stops waving.
private final class FinishedListener: NSObject, AVAudioPlayerDelegate {
    private let onFinish: @MainActor () -> Void

    init(onFinish: @escaping @MainActor () -> Void) {
        self.onFinish = onFinish
    }

    func audioPlayerDidFinishPlaying(_ player: AVAudioPlayer, successfully flag: Bool) {
        Task { @MainActor in onFinish() }
    }

    func audioPlayerDecodeErrorDidOccur(_ player: AVAudioPlayer, error: Error?) {
        Task { @MainActor in onFinish() }
    }
}
