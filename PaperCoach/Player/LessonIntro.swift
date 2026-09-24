import Foundation

/// What Lina says around a lesson, as a teacher would: a few words before it starts,
/// over a quick look at how the drawing comes together, and one sentence at the end.
/// The Studio records and publishes both exactly as it does a step, under two ids no
/// real step may take (`web/src/voice/bookends.ts`), so a lesson's manifest carries
/// them beside its steps.
enum LessonBookend {
    static let introId = "lesson-intro"
    static let outroId = "lesson-outro"

    // A teacher greets, says what is being made, takes the pressure off, and hands
    // over. The same patterns, picked the same way, as `bookends.ts`: a lesson whose
    // intro was never recorded still opens with the words the Studio would record.
    private static let intros = [
        "Hi, it’s Lina. Today we’re drawing {subject}. Watch how it comes together, then it’s your turn.",
        "Hello again. This time it’s {subject}. Have a look at how it’s made first, then we’ll draw it together, one step at a time.",
        "Hi, Lina here. Ready to draw {subject}? Watch the whole thing once, then grab your pen.",
        "Hey, good to see you. We’re going to draw {subject} today. It’s easier than it looks. Watch first, then we’ll go slowly."
    ]

    /// The intro's words when no line was published for it.
    static func defaultIntro(lessonId: String, title: String) -> String {
        let text = intros[pick(intros.count, lessonId: lessonId, salt: 7)]
            .replacingOccurrences(of: "{subject}", with: subject(of: title))
        return text.prefix(1).uppercased() + text.dropFirst()
    }

    /// "Apple" → "an apple", "Cherries" → "cherries", "Watermelon Slice" → "a watermelon slice".
    static func subject(of title: String) -> String {
        let thing = title.trimmingCharacters(in: .whitespaces).lowercased()
        let isPlural = thing.hasSuffix("s") && !thing.hasSuffix("ss") && thing.count > 1
        if isPlural { return thing }
        let article = thing.first.map { "aeiou".contains($0) } == true ? "an" : "a"
        return "\(article) \(thing)"
    }

    /// `pick` in `bookends.ts`: one lesson always says the same thing, and the next
    /// one along probably says something else.
    static func pick(_ count: Int, lessonId: String, salt: UInt32) -> Int {
        var hash = salt
        for unit in lessonId.utf16 { hash = hash &* 31 &+ UInt32(unit) }
        return Int(hash % UInt32(max(count, 1)))
    }
}

/// The look at what is going to be drawn, before step one: the finished drawing,
/// then every step drawn quickly in order, then the whole drawing again, waiting
/// for "I’m ready". The timeline is `web/src/player/intro.ts`, so the app and the
/// Studio's preview show a lesson the same way.
enum LessonIntro {

    /// What the intro shows at one moment.
    enum Frame: Equatable {
        /// The finished drawing, whole: this is what we are going to make.
        case goal
        /// The drawing coming together: `stepIndex` is being drawn; `itemIndex`
        /// counts through its strokes and then its fills.
        case build(stepIndex: Int, itemIndex: Int, progress: Double)
        /// The finished drawing again, waiting for "I’m ready".
        case rest
    }

    /// How long the intro runs when nothing is spoken over it: a little longer for
    /// a lesson with more steps.
    static func seconds(for tutorial: PreparedTutorial) -> Double {
        min(14, max(8, 5 + Double(tutorial.steps.count) * 0.6))
    }

    /// How long it runs for a lesson whose spoken intro lasts `spoken` seconds: as
    /// long as Lina speaks, so the two are never out of step.
    static func total(for tutorial: PreparedTutorial, spoken: Double?) -> Double {
        max(4, spoken ?? seconds(for: tutorial))
    }

    /// A step's share of the build is its share of the lesson's animation time, so
    /// the quick version has the rhythm of the real one.
    static func frame(for tutorial: PreparedTutorial, elapsed: Double, total: Double) -> Frame {
        let goal = min(2.5, total * 0.22)
        let rest = min(1.5, total * 0.12)
        if elapsed < goal { return .goal }
        let build = total - goal - rest
        let steps = tutorial.steps.map { $0.strokes.map(\.duration) + $0.fills.map(\.duration) }
        let whole = steps.joined().reduce(0, +)
        if elapsed >= total - rest || build <= 0 || whole <= 0 { return .rest }

        var at = ((elapsed - goal) / build) * whole
        for (stepIndex, durations) in steps.enumerated() {
            for (itemIndex, duration) in durations.enumerated() {
                if at < duration {
                    return .build(stepIndex: stepIndex,
                                  itemIndex: itemIndex,
                                  progress: duration > 0 ? at / duration : 1)
                }
                at -= duration
            }
        }
        return .rest
    }
}
