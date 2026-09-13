import AVFoundation
import Foundation
import Observation

/// Lina's voice on a step.
///
/// The pipeline the handbook specifies (`src/handbook.html`, "Narration: the tutor's
/// voice on every step") publishes one short AAC file per step from the Studio, into
/// `shared/Assets/Voice/<lessonId>/<stepId>.m4a`, bundled as `Voice/` in the app. No
/// audio ships yet — M6/M7 produce it — so every lookup below returns nil today and
/// the player hides the narration chip. The plumbing is here so the day the files
/// land nothing has to be designed: drop them in the bundle and the chip appears.
///
/// Playback rules, from the same handbook section and the `pl-player` notes:
/// start with the step's animation; cancel on replay, back and leave; the speed
/// setting never touches the voice (`AVAudioPlayer.rate` is left alone); the session
/// is `.ambient` with mode `.spokenAudio` and options
/// `[.duckOthers, .interruptSpokenAudioAndMixWithOthers]`, so the silent switch is
/// respected, music ducks under Lina, a podcast pauses, and a phone call is never
/// interrupted. An interruption stops the voice and counts as "finished speaking".
@Observable
@MainActor
final class NarrationPlayer {

    /// True while a file is actually playing, which is what the chip's wave shows.
    private(set) var isSpeaking = false

    @ObservationIgnored private var player: AVAudioPlayer?
    @ObservationIgnored private var isSessionActive = false
    @ObservationIgnored private let bundle: Bundle

    init(bundle: Bundle = .main) {
        self.bundle = bundle
    }

    /// The recorded line for one step, if it shipped.
    func audioURL(lessonId: String, stepId: String) -> URL? {
        bundle.url(forResource: stepId,
                   withExtension: "m4a",
                   subdirectory: "Voice/\(lessonId)")
    }

    /// Whether this step has a voice. A step without one plays silently and the
    /// chip is hidden for that step — never greyed, which would read as broken.
    func hasAudio(lessonId: String, stepId: String) -> Bool {
        audioURL(lessonId: lessonId, stepId: stepId) != nil
    }

    /// Speaks the step's line from the top. Silently does nothing when there is no
    /// file: narration is never the only channel, the instruction is always on screen.
    func play(lessonId: String, stepId: String) {
        stop()
        guard let url = audioURL(lessonId: lessonId, stepId: stepId) else { return }
        activateSession()
        do {
            let player = try AVAudioPlayer(contentsOf: url)
            player.prepareToPlay()
            player.play()
            self.player = player
            isSpeaking = true
        } catch {
            // A bad file is not the learner's problem: stay quiet and carry on.
            isSpeaking = false
        }
    }

    /// Stops at once — the close button, a replay, a step change, leaving.
    func stop() {
        player?.stop()
        player = nil
        isSpeaking = false
    }

    /// Hands the audio route back politely, so whatever was ducked comes up again.
    func deactivate() {
        stop()
        guard isSessionActive else { return }
        isSessionActive = false
        try? AVAudioSession.sharedInstance().setActive(false, options: [.notifyOthersOnDeactivation])
    }

    private func activateSession() {
        guard !isSessionActive else { return }
        let session = AVAudioSession.sharedInstance()
        do {
            try session.setCategory(.ambient,
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
