import Foundation

/// Premium, as the screens ask about it: which lessons wear a crown, what a tap on
/// one does, and where the way to Premium leaves the learner.
extension AppModel {

    /// Whether the learner who is drawing is treated as a child — under 13, or
    /// never said. A child never sees a price: a crowned lesson opens its own card
    /// (the lesson, "Save to my wish list", a free lesson instead), "More coming"
    /// the card for the grown-up who set the app up, Settings › Premium "This part
    /// is for a grown-up", and the sketchbook's "For grown-ups" the parental check
    /// itself (`GrownUpHandoffView`, `ParentalGateView`) — all before the grown-up's
    /// paywall.
    var learnerIsChild: Bool {
        activeProfile.privacyTier == .child
    }

    /// What comes before a way to Premium that Settings opens on its own ("Redeem a
    /// code"): nothing for a learner 13 or over; for a child, the grown-ups' check
    /// the way to the paywall asks (`ParentalGateView`), the app's PIN when one is
    /// set, else the question in words.
    var grownUpCheckBeforePremium: GrownUpCheck {
        guard learnerIsChild else { return .notNeeded }
        return pin.isSet ? .pin : .question
    }

    /// What comes before something leaves the app from a child's hands — a drawing
    /// shared from the sketchbook, Settings' "Rate" and "Share" — since nothing does
    /// without a grown-up (App Review Guidelines 1.3): the same check as before a
    /// way to Premium, the PIN when one is set, else the question in words. Nothing
    /// for a learner 13 or over.
    var grownUpCheckBeforeSharing: GrownUpCheck {
        grownUpCheckBeforePremium
    }

    /// True when this lesson is past its path's free lessons and Premium is not
    /// active: it wears a crown, and a tap opens the way to Premium.
    func needsPremium(_ lesson: Lesson) -> Bool {
        guard !premium.isPremium, let path = path(id: lesson.pathId) else { return false }
        return PremiumAccess.isPremiumLesson(lesson, in: path)
    }

    /// Opens the way to Premium for a lesson that needs it, and says so. Returns
    /// false, doing nothing, for a lesson that is free or already unlocked.
    ///
    /// Every tap on a crown opens it, straight away and every time, with nothing in
    /// between: the creator's decision of 2026-09-27, which took the place of the
    /// Premium lesson drawer and of the child's "is a Premium lesson" note. Where
    /// the cover starts is `OfferRoute`'s: for a learner 13 or over, the paywall
    /// (Superwall's `premium_lesson` placement first, the native paywall in its
    /// place); for a child, the lesson's own card (`GrownUpHandoffView`: "Rain Cloud
    /// is a Premium lesson", "Save to my wish list", a free lesson instead, and
    /// "For grown-ups" to the parental check), so a child never sees a price or a
    /// buy button, and nothing appeals to them to get a grown-up to buy (UK Digital
    /// Markets, Competition and Consumers Act 2024, Schedule 20 para 30; EU Unfair
    /// Commercial Practices Directive, Annex I point 28; CARU, Self-Regulatory
    /// Guidelines for Children's Advertising, Sales Pressure: "Advertising should
    /// not urge Children to ask parents or others to buy products").
    ///
    /// The paywall keeps an obvious way out, "Continue with free lessons" (Human
    /// Interface Guidelines › Modality,
    /// https://developer.apple.com/design/human-interface-guidelines/modality), and
    /// the billed amount as its most prominent price (Apple, "Auto-renewable
    /// subscriptions", https://developer.apple.com/app-store/subscriptions/); see
    /// `PaywallView`.
    ///
    /// Tapped on a finished lesson's completion or photo screen (the gold card),
    /// the cover remembers that lesson, so leaving without subscribing ends that
    /// screen the way its own "Not now" would (`finishOffer(_:subscribed:)`).
    @discardableResult
    func offerPremiumIfNeeded(for lesson: Lesson) -> Bool {
        guard needsPremium(lesson) else { return false }
        analytics.track(.premiumLessonTapped(lessonId: lesson.id))
        switch cover {
        case let .completion(lessonId), let .capture(lessonId, false):
            offerReturnLessonId = lessonId
        default:
            offerReturnLessonId = nil
        }
        cover = .offer(.premiumLesson(lessonId: lesson.id))
        return true
    }

    /// The Premium row in Settings, and anything else that opens the paywall
    /// without a lesson in hand.
    func presentOffer(_ entry: OfferEntry) {
        cover = .offer(entry)
    }

    /// The lesson after this one when it needs Premium: the completion and saved
    /// screens show it as a gold card rather than "Next lesson".
    func premiumNextLesson(after lesson: Lesson) -> Lesson? {
        guard let next = nextLesson(after: lesson), needsPremium(next) else { return nil }
        return next
    }

    /// A free lesson from another path, offered beside that gold card.
    func freeLessonSuggestion(besides lesson: Lesson) -> Lesson? {
        PremiumAccess.freeLessonSuggestion(excludingPath: lesson.pathId,
                                           paths: paths,
                                           progress: progress)
    }

    /// The lessons on the child's wish list that still need Premium, oldest first.
    var wishedLessons: [Lesson] {
        preferences.wishList.compactMap { lesson(id: $0) }.filter { needsPremium($0) }
    }

    /// Whether the lesson is on the wish list of the learner who is drawing.
    func isWished(_ lesson: Lesson) -> Bool {
        preferences.wishList.contains(lesson.id)
    }

    /// "Save to my wish list" on a crowned lesson's card, or "On my wish list" to
    /// take it off again. The list is the learner's own (`ProfilePreferences`), and
    /// the grown-up's paywall and Home's "Your wish list" show it.
    func toggleWish(_ lesson: Lesson) {
        preferences.toggleWish(lesson.id)
        analytics.track(.wishListChanged(lessonId: lesson.id, added: isWished(lesson)))
    }

    /// The free lesson a crowned lesson's card offers in its place: the next free
    /// one on the same path, else one from another path
    /// (`PremiumAccess.freeLessonInstead(of:paths:progress:)`).
    func freeLessonInstead(of lesson: Lesson) -> Lesson? {
        PremiumAccess.freeLessonInstead(of: lesson, paths: paths, progress: progress)
    }

    /// The way to Premium is over. Subscribed or not, the first run ends here; a
    /// Premium lesson that was asked for opens once it is unlocked.
    ///
    /// `drawingInstead` is the free lesson a child chose on a crowned lesson's card
    /// ("Draw Tulip"): the cover closes, over a finished lesson's screen too, and
    /// that lesson's preview opens.
    func finishOffer(_ entry: OfferEntry, subscribed: Bool, drawingInstead: Lesson? = nil) {
        analytics.track(.offerFinished(entry: entry.analyticsName, subscribed: subscribed))
        if let drawingInstead, !subscribed {
            offerReturnLessonId = nil
            dismissCover()
            showPreview(of: drawingInstead)
            return
        }
        switch entry {
        case .onboarding:
            let firstLesson = firstRunLesson
            finishFirstRun()
            if let firstLesson {
                // The same rest a new learner gets after any first lesson: All
                // paths' one-time welcome, or their path.
                leaveCompletion(for: firstLesson)
            } else {
                dismissCover()
            }
        case let .premiumLesson(lessonId):
            let returnLesson = offerReturnLessonId.flatMap { self.lesson(id: $0) }
            offerReturnLessonId = nil
            // The lesson opens only once Premium really shows as active. A lesson
            // still behind it would ask for this same cover again at once, over a
            // flow that has already finished and so could never be left.
            if subscribed, let lesson = self.lesson(id: lessonId), !needsPremium(lesson) {
                dismissCover()
                showPreview(of: lesson)
            } else if let returnLesson {
                leaveCompletion(for: returnLesson)
            } else {
                dismissCover()
            }
        case .settings, .sketchbook:
            dismissCover()
        }
    }
}

/// The grown-ups' check before a way to Premium (`AppModel.grownUpCheckBeforePremium`).
enum GrownUpCheck: Equatable {
    case notNeeded
    /// The app's PIN (`PINGateRequest`).
    case pin
    /// A sum written in words (`ParentalQuestion`).
    case question
}
