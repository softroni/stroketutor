import Foundation

/// How long a lesson really took to draw, for `sk-complete`'s "Drawing time".
///
/// The clock runs from step one to the last "I drew it". The intro is watching, not
/// drawing, so it does not count. Time with the phone locked does: a learner may
/// lock it while copying a step onto paper, and those minutes were spent drawing.
///
/// What it cannot tell is a learner who put the lesson down and came back later.
/// So each stretch between two taps counts for at most `longestStretch`: longer than
/// anyone spends on one step, coloring included, and it keeps a lesson left open
/// over dinner from saying it took two hours. The player keeps the screen awake for
/// the same stretch (`PlayerScreen.keepScreenAwake()`).
///
/// A lesson left part-way keeps its seconds in `LessonProgress.drawingSeconds`, and
/// "Continue from step 4" starts the clock from them again.
struct DrawingClock: Equatable {
    static let longestStretch: TimeInterval = 10 * 60

    /// The seconds banked so far, not counting the stretch that is running.
    private(set) var seconds: TimeInterval
    private var stretchStartedAt: Date?

    init(seconds: TimeInterval = 0) {
        self.seconds = max(0, seconds)
    }

    var isRunning: Bool { stretchStartedAt != nil }

    /// A step began: starts the clock, or, when it is running, banks the stretch
    /// since the last tap and starts the next one.
    mutating func tap(at date: Date = Date()) {
        if let stretchStartedAt {
            seconds += min(max(0, date.timeIntervalSince(stretchStartedAt)), Self.longestStretch)
        }
        stretchStartedAt = date
    }

    /// The last "I drew it", or leaving: banks the running stretch and stops.
    mutating func stop(at date: Date = Date()) {
        guard isRunning else { return }
        tap(at: date)
        stretchStartedAt = nil
    }

    /// "40 sec", "4 min", "1 hr 5 min": seconds only while there are less than
    /// sixty of them, then whole minutes. The tile is a fact, not a score, so it
    /// never reads like a stopwatch.
    static func text(for seconds: TimeInterval) -> String {
        let wholeSeconds = Int(seconds.rounded())
        if wholeSeconds < 60 {
            return "\(max(1, wholeSeconds)) sec"
        }
        let minutes = Int((seconds / 60).rounded())
        guard minutes >= 60 else { return "\(minutes) min" }
        let hours = minutes / 60
        let rest = minutes % 60
        return rest == 0 ? "\(hours) hr" : "\(hours) hr \(rest) min"
    }
}
