import SwiftUI

/// `st-settings` — the third tab: narration and speed, the sketchbook's one option
/// and its privacy promise, the reminder, Rate and Share (once the app is on the
/// App Store), Privacy (the published policy), and the single destructive row.
/// "Reset onboarding" is a development-only row.
/// No account, nothing to manage, nothing that creates an obligation.
///
/// White list cards with 2 pt borders, each opened by a 40 pt tinted icon tile
/// so the list scans by colour, then the one destructive row alone on its own card
/// and the version line under it.
struct SettingsView: View {
    @Environment(AppModel.self) private var app
    @State private var isConfirmingReset = false
    @State private var isConfirmingOnboardingReset = false
    @State private var isPhotosAccessRefused = false
    @State private var isAddingProfile = false
    @State private var gate: PINGateRequest?
    @State private var pinSheet: PINSheet?
    @State private var isChoosingPINAction = false
    @State private var isRestoring = false
    @State private var restoreMessage: String?
    @Environment(\.openURL) private var openURL

    /// The PIN pad, when it is opened from its own row.
    private enum PINSheet: Identifiable {
        case create, change, remove
        var id: Self { self }
    }

    var body: some View {
        @Bindable var preferences = app.preferences

        ScrollView {
            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                Text("Settings")
                    .textRole(.largeTitle)
                    .foregroundStyle(Theme.ink)
                    .accessibilityAddTraits(.isHeader)

                // ---------------------------------------------------------- People
                peopleSection

                // --------------------------------------------------------- Premium
                premiumSection

                // ---------------------------------------------------------- Lesson
                SettingsSectionHeader("Lesson")
                ListCard {
                    // One row for the tutor: her portrait, whether she speaks, and
                    // the way to the voice screen. Narration and "Lina's voice" used
                    // to be two rows that opened the same screen.
                    Button {
                        app.push(.narrationSettings)
                    } label: {
                        SettingsCustomRow(title: "Lina’s voice") {
                            // Her portrait sits in the tile at 30 pt, as `.leading .face` does.
                            SettingsIconTile(tint: .clay) { LinaFace(size: 30) }
                        } trailing: {
                            HStack(spacing: 14) {
                                Text(preferences.narrationEnabled ? "On" : "Off")
                                    .scaledFont(16, .semibold)
                                    .foregroundStyle(Theme.ink55)
                                chevron
                            }
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isButton)
                    .accessibilityValue(preferences.narrationEnabled ? "On" : "Off")
                    RowDivider()
                    speedRow
                }

                // ------------------------------------------------------ Sketchbook
                SettingsSectionHeader("Sketchbook")
                ListCard {
                    ToggleRow(title: "Also save to Photos",
                              subtitle: "Your sketchbook keeps its own copy either way.",
                              systemImage: "photo",
                              tint: .gold,
                              isOn: alsoSaveToPhotosBinding)
                }
                // The promise for grown-ups, kept here rather than under the
                // learner's drawings (`sk-book` is pictures only).
                SettingsCaption("Kept on this iPhone. Nothing in the sketchbook is uploaded or shared.")

                // ------------------------------------------------------------ More
                SettingsSectionHeader("More")
                ListCard {
                    SettingsRow(title: "Practice reminder",
                                value: reminderValue,
                                systemImage: "bell",
                                tint: .neutral) { app.push(.reminderSettings) }
                    #if DEBUG
                    RowDivider()
                    // Development only: a published app has no reason to replay it.
                    // Presents a cover rather than pushing, so no chevron.
                    Button {
                        isConfirmingOnboardingReset = true
                    } label: {
                        SettingsCustomRow(title: "Reset onboarding",
                                          subtitle: "See the introduction again from the start.") {
                            SettingsIconTile(symbol: "arrow.clockwise", tint: .neutral)
                        } trailing: {
                            EmptyView()
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isButton)
                    #endif
                    if let listing = AppStoreListing.current {
                        RowDivider()
                        rateRow(listing)
                        RowDivider()
                        shareRow(listing)
                    }
                    RowDivider()
                    // The published policy, opened in Safari, so the app and the
                    // website can never say different things.
                    Link(destination: Self.privacyPolicyURL) {
                        SettingsCustomRow(title: "Privacy",
                                          subtitle: "Everything stays on this iPhone.") {
                            SettingsIconTile(symbol: "lock.fill", tint: .neutral)
                        } trailing: {
                            Image(systemName: "arrow.up.right")
                                .scaledFont(14, .bold, design: .default)
                                .foregroundStyle(Theme.ink25)
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isLink)
                    .accessibilityHint("Opens the privacy policy in Safari.")
                }

                // ------------------------------------------------- Reset progress
                ListCard {
                    Button {
                        requestReset()
                    } label: {
                        Text("Reset \(app.activeProfile.displayName)’s progress")
                            .textRole(.headline)
                            .foregroundStyle(Theme.danger)
                            .multilineTextAlignment(.center)
                            .frame(maxWidth: .infinity)
                            .padding(.vertical, 12)
                            .padding(.horizontal, 18)
                            .frame(minHeight: Theme.minimumTapTarget)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityHint("Clears how far \(app.activeProfile.displayName) is through every path. Their sketchbook is kept.")
                }
                .padding(.top, 8)

                Text(SettingsFormat.versionLine())
                    .textRole(.footnote)
                    .foregroundStyle(Theme.ink40)
                    .frame(maxWidth: .infinity)
                    .padding(.top, 10)
                    .padding(.bottom, 4)
            }
            .padding(.horizontal, Theme.gutter)
            .padding(.top, 6)
            .padding(.bottom, 16)
        }
        .background(Theme.page)
        .toolbar(.hidden, for: .navigationBar)
        .alert("Reset \(app.activeProfile.displayName)’s progress?", isPresented: $isConfirmingReset) {
            Button("Reset progress", role: .destructive) { app.progress.resetAll() }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("Every path starts again from lesson 1 for \(app.activeProfile.displayName). Their sketchbook, and everyone else’s progress, are not touched.")
        }
        .pinGate($gate)
        #if DEBUG
        .onAppear {
            guard DebugScreenHarness.raisePINCreate else { return }
            DebugScreenHarness.raisePINCreate = false
            pinSheet = .create
        }
        #endif
        .sheet(isPresented: $isAddingProfile) {
            NewProfileSheet(onAdded: { _ in isAddingProfile = false },
                            onCancel: { isAddingProfile = false })
        }
        .sheet(item: $pinSheet) { sheet in
            switch sheet {
            case .create:
                PINPadSheet(mode: .create) { }
            case .change:
                PINPadSheet(mode: .change) { }
            case .remove:
                PINPadSheet(mode: .verify(reason: "Needed to turn the PIN off.")) {
                    app.pin.remove()
                }
            }
        }
        .confirmationDialog("PIN", isPresented: $isChoosingPINAction, titleVisibility: .visible) {
            Button("Change PIN") { pinSheet = .change }
            Button("Turn off PIN", role: .destructive) { pinSheet = .remove }
            Button("Cancel", role: .cancel) { }
        }
        .alert("Photos access is off", isPresented: $isPhotosAccessRefused) {
            Button("Open Settings") {
                if let url = URL(string: UIApplication.openSettingsURLString) {
                    UIApplication.shared.open(url)
                }
            }
            Button("Not now", role: .cancel) { }
        } message: {
            Text("Paper Coach can only add pages to Photos once you allow it in Settings. Your sketchbook keeps every page either way.")
        }
        // Access can be taken away in the Settings app while this screen is away; the
        // toggle follows, rather than staying on while nothing is saved.
        .onAppear(perform: turnOffPhotosIfRefused)
        .onReceive(NotificationCenter.default.publisher(for: UIApplication.didBecomeActiveNotification)) { _ in
            turnOffPhotosIfRefused()
        }
        #if DEBUG
        .alert("Reset onboarding?", isPresented: $isConfirmingOnboardingReset) {
            Button("Reset onboarding") { app.resetOnboarding() }
            Button("Cancel", role: .cancel) { }
        } message: {
            Text("The introduction plays again from the start. Your progress and sketchbook are kept.")
        }
        #endif
    }

    private static let privacyPolicyURL = URL(string: "https://softroni.com/privacy-policy.html")!

    /// Where the App Store lets the account holder change or cancel a subscription.
    private static let manageSubscriptionsURL = URL(string: "https://apps.apple.com/account/subscriptions")!

    // MARK: - Premium

    /// Whether Premium is on for this Apple account, the way to it (or to manage
    /// it), and Restore. A child's tap goes through the grown-up's check first,
    /// like any other way to the paywall (`OfferFlow`).
    private var premiumSection: some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            SettingsSectionHeader("Premium")
            ListCard {
                SettingsRow(title: "Paper Coach Premium",
                            subtitle: app.premium.isPremium
                                ? "Every lesson on every path."
                                : "Lessons 1 to \(PremiumAccess.freeLessonsPerPath) of every path are free.",
                            value: app.premium.isPremium ? "Active" : nil,
                            systemImage: "crown.fill",
                            tint: .gold) {
                    if app.premium.isPremium {
                        openURL(Self.manageSubscriptionsURL)
                    } else {
                        app.presentOffer(.settings)
                    }
                }
                RowDivider()
                SettingsRow(title: isRestoring ? "Restoring…" : "Restore purchases",
                            systemImage: "arrow.clockwise",
                            tint: .neutral) {
                    restorePurchases()
                }
            }
        }
        .alert("Restore purchases",
               isPresented: Binding(get: { restoreMessage != nil },
                                    set: { if !$0 { restoreMessage = nil } })) {
            Button("OK", role: .cancel) {}
        } message: {
            Text(restoreMessage ?? "")
        }
    }

    private func restorePurchases() {
        guard !isRestoring else { return }
        isRestoring = true
        Task {
            let restored = await app.premium.restore()
            isRestoring = false
            restoreMessage = restored
                ? "Premium is active on this iPhone."
                : "This Apple Account has no Paper Coach Premium to restore."
        }
    }

    /// Turning "Also save to Photos" on asks for add-only access first; the switch
    /// only stays on once iOS says pages can be added. Turning it off never asks.
    private var alsoSaveToPhotosBinding: Binding<Bool> {
        Binding(get: { app.settings.alsoSaveToPhotos },
                set: { isOn in
                    guard isOn else {
                        app.settings.alsoSaveToPhotos = false
                        return
                    }
                    Task {
                        if await PhotoLibraryWriter.requestAccess() {
                            app.settings.alsoSaveToPhotos = true
                        } else {
                            app.settings.alsoSaveToPhotos = false
                            isPhotosAccessRefused = true
                        }
                    }
                })
    }

    private func turnOffPhotosIfRefused() {
        if app.settings.alsoSaveToPhotos && PhotoLibraryWriter.isRefused {
            app.settings.alsoSaveToPhotos = false
        }
    }

    /// With a PIN set, the PIN first; either way, the confirmation after it.
    private func requestReset() {
        if app.pin.isSet {
            gate = PINGateRequest(reason: "Needed to reset \(app.activeProfile.displayName)’s progress.") {
                isConfirmingReset = true
            }
        } else {
            isConfirmingReset = true
        }
    }

    /// `.chevron`: 20 pt at 25 % ink, only on a row that pushes.
    private var chevron: some View {
        Image(systemName: "chevron.right")
            .scaledFont(14, .bold, design: .default)
            .foregroundStyle(Theme.ink25)
    }

    /// "Off", or the schedule in words — never a raw date.
    private var reminderValue: String {
        PracticeReminder.summary(for: app.settings)
    }
}

#Preview {
    let model = AppModel()
    return NavigationStack {
        SettingsView()
    }
    .environment(model)
    .task { model.loadContent() }
}


// MARK: - People

private extension SettingsView {
    /// Everyone who draws here, the way to add someone, and the PIN. The words are
    /// "people" and "someone", never "kid": a grown-up learning alone should not
    /// feel the app was made for someone else. Renaming is a tap away and never
    /// asks for the PIN; deleting someone and resetting progress do.
    var peopleSection: some View {
        Group {
            SettingsSectionHeader("People")
            ListCard {
                ForEach(app.profiles) { profile in
                    Button {
                        app.push(.profile(id: profile.id))
                    } label: {
                        SettingsCustomRow(title: profile.displayName,
                                          subtitle: profile.id == app.activeProfile.id ? "Drawing now" : nil) {
                            ProfileAvatarView(avatar: profile.avatar, size: 40)
                        } trailing: {
                            chevron
                        }
                        .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityElement(children: .combine)
                    .accessibilityAddTraits(.isButton)
                    RowDivider()
                }

                Button {
                    isAddingProfile = true
                } label: {
                    SettingsCustomRow(title: "Add someone") {
                        SettingsIconTile(symbol: "plus", tint: .green)
                    } trailing: {
                        EmptyView()
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isButton)
                RowDivider()

                Button {
                    if app.pin.isSet {
                        isChoosingPINAction = true
                    } else {
                        pinSheet = .create
                    }
                } label: {
                    SettingsCustomRow(title: "PIN",
                                      subtitle: "Asked before deleting someone or resetting progress.") {
                        SettingsIconTile(symbol: "lock.fill", tint: .neutral)
                    } trailing: {
                        Text(app.pin.isSet ? "On" : "Off")
                            .scaledFont(16, .semibold)
                            .foregroundStyle(Theme.ink55)
                    }
                    .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityElement(children: .combine)
                .accessibilityAddTraits(.isButton)
                .accessibilityValue(app.pin.isSet ? "On" : "Off")
            }
        }
    }
}

// MARK: - Rate and share

/// Where Paper Coach lives on the App Store. Until the app has a record in App Store
/// Connect there is nowhere to send anyone, so the Rate and Share rows stay hidden in
/// a release build; a debug build shows them against an App Store search so the rows
/// can be seen and tried. Once the record exists, set `appID` to its Apple ID (the
/// number under App Information in App Store Connect) and both rows go live.
struct AppStoreListing {
    /// The app's Apple ID from App Store Connect, e.g. "6740000000". Nil until it exists.
    static let appID: String? = nil

    /// The page a friend is sent to.
    let pageURL: URL
    /// The App Store's "Write a Review" sheet, opened straight from the link.
    let reviewURL: URL

    static var current: AppStoreListing? {
        if let appID {
            return AppStoreListing(
                pageURL: URL(string: "https://apps.apple.com/app/id\(appID)")!,
                reviewURL: URL(string: "https://apps.apple.com/app/id\(appID)?action=write-review")!)
        }
        #if DEBUG
        let search = URL(string: "https://apps.apple.com/search?term=Paper%20Coach")!
        return AppStoreListing(pageURL: search, reviewURL: search)
        #else
        return nil
        #endif
    }
}

private extension SettingsView {
    /// Opens the App Store's review sheet. A link the learner chooses to follow,
    /// rather than `requestReview`, which iOS rations and may silently ignore.
    func rateRow(_ listing: AppStoreListing) -> some View {
        Link(destination: listing.reviewURL) {
            SettingsCustomRow(title: "Rate Paper Coach",
                              subtitle: "A review helps other people find it.") {
                SettingsIconTile(symbol: "star.fill", tint: .gold)
            } trailing: {
                Image(systemName: "arrow.up.right")
                    .scaledFont(14, .bold, design: .default)
                    .foregroundStyle(Theme.ink25)
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isLink)
        .accessibilityHint("Opens the App Store to write a review.")
    }

    /// The system share sheet with the App Store link and a line to go with it.
    func shareRow(_ listing: AppStoreListing) -> some View {
        ShareLink(item: listing.pageURL,
                  subject: Text("Paper Coach"),
                  message: Text("Learn to draw one stroke at a time with Paper Coach.")) {
            SettingsCustomRow(title: "Share Paper Coach",
                              subtitle: "Send it to someone who’d like to draw.") {
                SettingsIconTile(symbol: "square.and.arrow.up", tint: .neutral)
            } trailing: {
                EmptyView()
            }
            .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .accessibilityElement(children: .combine)
        .accessibilityAddTraits(.isButton)
    }
}

// MARK: - Speed

private extension SettingsView {
    /// The speed a lesson starts at, set right here rather than on the voice screen:
    /// it is how fast each step draws, and it never changes Lina's voice, so a
    /// learner who came to change it should not have to pass her card to find it.
    var speedRow: some View {
        @Bindable var preferences = app.preferences
        return VStack(alignment: .leading, spacing: 10) {
            HStack(spacing: 14) {
                SettingsIconTile(symbol: "speedometer", tint: .green)
                VStack(alignment: .leading, spacing: 2) {
                    Text("Speed")
                        .textRole(.headline)
                        .foregroundStyle(Theme.ink)
                    Text("How fast each step draws. You can change it while you draw.")
                        .textRole(.footnote)
                        .foregroundStyle(Theme.ink55)
                        .fixedSize(horizontal: false, vertical: true)
                }
                .frame(maxWidth: .infinity, alignment: .leading)
            }

            SegmentedPicker(options: PlayerViewModel.speedOptions,
                            title: SettingsFormat.speed,
                            selection: $preferences.defaultSpeed)
                .accessibilityLabel("Speed")
        }
        .padding(.vertical, 14)
        .padding(.horizontal, 18)
    }
}
