import SwiftUI

/// The root of the app. Loads the content once, shows the tabs, and presents the
/// full-screen flows on top of them: onboarding on first run, "Who's drawing?" on a
/// launch with more than one learner, then the player, completion and capture that
/// follow a lesson.
///
/// Covers rather than pushes, because none of these belongs to a tab's back stack
/// (`v3.html`: `ob-*`, `pl-player`, `sk-complete`, `sk-capture`).
///
/// A DEBUG-only screenshot harness lives beside this file, in
/// `DebugScreenHarness.swift`. Launched with `-STScreen <name>` (`xcrun simctl
/// launch … -STScreen home-progress`), it seeds the stores and navigates to one
/// named screen for a design review — `xcrun simctl` can screenshot but cannot
/// tap. It is called once below, right after `loadContent()`, and is inert on
/// every other launch; see that file for the full list of names and how a couple
/// of screens whose state lives in a private `@State` (`PlayerScreen`,
/// `CaptureFlow`) are reached anyway.
struct AppRoot: View {
    @State private var app = AppModel()
    @Environment(\.scenePhase) private var scenePhase

    var body: some View {
        @Bindable var app = app

        MainTabs()
            // A new learner gets fresh tabs: no scroll position, sheet or half-typed
            // note from the learner before them survives the switch.
            .id(app.activeProfile.id)
            .environment(app)
            .background(Theme.page.ignoresSafeArea())
            .task {
                guard !app.hasLoadedContent else { return }
                app.loadContent()
                #if DEBUG
                DebugScreenHarness.applyIfRequested(to: app)
                #endif
                app.premium.start()
                if !app.settings.hasCompletedOnboarding {
                    // No slide up on first run: the launch screen gives way
                    // straight to the splash, so Home never shows under it first.
                    var transaction = Transaction()
                    transaction.disablesAnimations = true
                    withTransaction(transaction) { app.presentOnboarding() }
                } else if app.settings.firstRunStage != nil, !isScreenshotLaunch {
                    // A first run the app was closed in the middle of: back to the
                    // same stop, with nothing of the tabs showing first.
                    var transaction = Transaction()
                    transaction.disablesAnimations = true
                    withTransaction(transaction) { app.resumeFirstRun() }
                } else if app.shouldAskWhoIsDrawing, !isScreenshotLaunch {
                    // Once per launch, here; never on a return from the background.
                    app.presentProfilePicker()
                }
                await rescheduleReminderIfEnabled()
            }
            // The Premium drawer over the tabs. When a cover is up, the cover's own
            // copy below shows it instead, so it is never asked of a view that is
            // already presenting.
            .sheet(item: drawer(overCover: false), onDismiss: { app.openOfferAfterDrawer() }) { offer in
                PremiumLessonSheet(lessonId: offer.lessonId)
                    .environment(app)
            }
            .overlay(alignment: .top) {
                if let nudge = app.premiumNudge, app.cover == nil {
                    PremiumNudgeToast(nudge: nudge)
                        .environment(app)
                        .padding(.top, 8)
                        .transition(.move(edge: .top).combined(with: .opacity))
                }
            }
            .animation(.easeOut(duration: 0.25), value: app.premiumNudge)
            // A subscription can start, lapse or be refunded while the app is away.
            .onChange(of: scenePhase) { _, phase in
                guard phase == .active, app.hasLoadedContent else { return }
                Task { await app.premium.refreshEntitlements() }
            }
            .fullScreenCover(item: $app.cover, onDismiss: { app.coverDidDismiss() }) { cover in
                content(for: cover)
                    .environment(app)
                    .sheet(item: drawer(overCover: true), onDismiss: { app.openOfferAfterDrawer() }) { offer in
                        PremiumLessonSheet(lessonId: offer.lessonId)
                            .environment(app)
                    }
            }
    }

    /// The drawer's binding for one of its two hosts: the tabs while no cover is up,
    /// the cover while one is.
    private func drawer(overCover: Bool) -> Binding<PremiumOffer?> {
        Binding(get: { (app.cover != nil) == overCover ? app.premiumOffer : nil },
                set: { if $0 == nil { app.premiumOffer = nil } })
    }

    private var isScreenshotLaunch: Bool {
        #if DEBUG
        DebugScreenHarness.isActive
        #else
        false
        #endif
    }

    /// Keeps the practice reminder's pending notifications in step with the stored
    /// settings after an update or a restore, when iOS may have dropped them. The
    /// reminder screen does the same when it appears; `st-reminder`'s notes ask for both.
    private func rescheduleReminderIfEnabled() async {
        let settings = app.settings
        guard settings.reminderEnabled else { return }
        let subject = app.currentPath.map { PracticeReminder.subject(fromPathTitle: $0.title) }
        await PracticeReminderScheduler.reschedule(
            days: PracticeReminder.days(from: settings.reminderDays),
            time: PracticeReminder.time(from: settings.reminderTime),
            body: PracticeReminder.body(subject: subject))
    }

    @ViewBuilder
    private func content(for cover: AppCover) -> some View {
        switch cover {
        case .onboarding:
            OnboardingFlow(onFinished: { lesson in
                // `ob-ready` already showed the lesson and its Start drawing, so
                // the preview would ask the same question twice: open the player,
                // as the first stop of the guided first run — once the onboarding
                // cover has finished closing (`finishOnboarding(startingWith:)`).
                if let lesson { app.markFirstRunStarted(with: lesson) }
                app.finishOnboarding(startingWith: lesson)
            })

        case let .player(lessonId, resumeFrom):
            if let lesson = app.lesson(id: lessonId) {
                #if DEBUG
                PlayerScreen(lesson: lesson,
                            resumeFrom: resumeFrom,
                            harnessState: DebugScreenHarness.pendingPlayerHarnessState)
                #else
                PlayerScreen(lesson: lesson, resumeFrom: resumeFrom)
                #endif
            } else {
                missingLesson
            }

        case let .completion(lessonId):
            if let lesson = app.lesson(id: lessonId) {
                CompletionView(lesson: lesson)
            } else {
                missingLesson
            }

        case let .capture(lessonId, fromSketchbook):
            if let lesson = app.lesson(id: lessonId) {
                #if DEBUG
                CaptureFlow(lesson: lesson,
                           fromSketchbook: fromSketchbook,
                           debugReviewImage: DebugScreenHarness.pendingCaptureReviewImage,
                           debugSavedPage: DebugScreenHarness.pendingCaptureSavedPage,
                           debugOpensCornerEditor: DebugScreenHarness.pendingCaptureOpensCornerEditor)
                #else
                CaptureFlow(lesson: lesson, fromSketchbook: fromSketchbook)
                #endif
            } else {
                missingLesson
            }

        case .profilePicker:
            ProfilePickerView()

        case .firstRunSketchbook:
            FirstRunSketchbookView()

        case let .offer(entry):
            OfferFlow(entry: entry)
        }
    }

    /// Only reachable if the content changed under a cover — a reinstall with a
    /// different catalog, say. Calm, and it always lets the learner out.
    private var missingLesson: some View {
        VStack(spacing: Theme.stackSpacing) {
            Text("That lesson is no longer installed.")
                .textRole(.title3)
                .multilineTextAlignment(.center)
            Button("Close") { app.dismissCover() }
                .buttonStyle(.secondary)
        }
        .padding(Theme.gutter)
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.page.ignoresSafeArea())
    }
}
