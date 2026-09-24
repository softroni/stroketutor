import Foundation

/// Premium, as the screens ask about it: which lessons wear a crown, what a tap on
/// one does, and where the way to Premium leaves the learner.
extension AppModel {

    /// Whether the learner who is drawing is treated as a child — under 13, or
    /// never said. A child never sees a price: the drawer and the paywall ask for a
    /// grown-up, behind the parental check (`ParentalGateView`).
    var learnerIsChild: Bool {
        activeProfile.privacyTier == .child
    }

    /// True when this lesson is past its path's free lessons and Premium is not
    /// active: it wears a crown, and a tap offers the free week.
    func needsPremium(_ lesson: Lesson) -> Bool {
        guard !premium.isPremium, let path = path(id: lesson.pathId) else { return false }
        return PremiumAccess.isPremiumLesson(lesson, in: path)
    }

    /// Opens the Premium drawer for a lesson that needs it, and says so. Returns
    /// false, doing nothing, for a lesson that is free or already unlocked.
    ///
    /// A child who closed the drawer with "Not now" this session gets a short
    /// nudge instead of the same drawer again on every crown they tap.
    @discardableResult
    func offerPremiumIfNeeded(for lesson: Lesson) -> Bool {
        guard needsPremium(lesson) else { return false }
        // The nudge shows over the tabs only; over a cover (the gold card after a
        // lesson) the drawer itself comes up, so the tap is never lost.
        if learnerIsChild && hasClosedKidDrawer && cover == nil {
            premiumNudge = PremiumNudge(lessonId: lesson.id, title: lesson.title)
        } else {
            premiumOffer = PremiumOffer(lessonId: lesson.id)
        }
        analytics.track(.premiumLessonTapped(lessonId: lesson.id))
        return true
    }

    /// The drawer's way on. The drawer closes first; `AppRoot` opens the offer when
    /// it has gone (`openOfferAfterDrawer()`).
    func continueFromDrawer(to entry: OfferEntry) {
        offerAfterDrawer = entry
        premiumOffer = nil
    }

    /// "Not now" or the close button on the drawer.
    func closePremiumDrawer() {
        premiumOffer = nil
    }

    /// Called as the drawer finishes going away, however it was closed: brings up
    /// the offer it chose, if any. A child who closed it without asking for a
    /// grown-up is not shown it again this session (`offerPremiumIfNeeded(for:)`).
    func openOfferAfterDrawer() {
        guard let entry = offerAfterDrawer else {
            if learnerIsChild { hasClosedKidDrawer = true }
            return
        }
        offerAfterDrawer = nil
        cover = .offer(entry)
    }

    /// The nudge's own tap: the child asked again, so the drawer comes back.
    func openDrawer(for nudge: PremiumNudge) {
        premiumNudge = nil
        premiumOffer = PremiumOffer(lessonId: nudge.lessonId)
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

    /// The way to Premium is over. Subscribed or not, the first run ends here; a
    /// Premium lesson that was asked for opens once it is unlocked.
    func finishOffer(_ entry: OfferEntry, subscribed: Bool) {
        analytics.track(.offerFinished(entry: entry.analyticsName, subscribed: subscribed))
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
            dismissCover()
            if subscribed, let lesson = self.lesson(id: lessonId) {
                showPreview(of: lesson)
            }
        case .settings:
            dismissCover()
        }
    }
}
