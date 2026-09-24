import SwiftUI

// MARK: - Motion

private struct OnboardingReducesMotionKey: EnvironmentKey {
    static let defaultValue = false
}

extension EnvironmentValues {
    /// True when the flow must hold still: the system's Reduce Motion setting, or
    /// the app's own override in Settings. `OnboardingFlow` resolves the two once
    /// and every beat reads this instead of asking twice.
    var onboardingReducesMotion: Bool {
        get { self[OnboardingReducesMotionKey.self] }
        set { self[OnboardingReducesMotionKey.self] = newValue }
    }
}

// MARK: - The rail

/// The onboarding rail (`.ob-rail`): a 44 pt back chevron, a 14 pt green progress
/// bar, and "Skip" on the beats that may be skipped. 56 pt tall, 4 pt in from the
/// left so the chevron's tap target reaches the edge.
///
/// The bar is the learner's only sense of how long this is; it never goes backwards
/// without the chevron being pressed.
struct OnboardingRail: View {

    /// 0...1.
    let progress: Double
    /// What VoiceOver reads for the bar: "Step 2 of 9".
    let stepLabel: String
    var onBack: (() -> Void)?
    var onSkip: (() -> Void)?

    @Environment(\.onboardingReducesMotion) private var reducesMotion

    var body: some View {
        HStack(spacing: 12) {
            Button {
                onBack?()
            } label: {
                Image(systemName: "chevron.left")
                    .scaledFont(20, .bold, design: .default)
                    .foregroundStyle(Theme.ink)
                    .frame(width: Theme.navTapTarget, height: Theme.navTapTarget)
                    .contentShape(Rectangle())
            }
            .buttonStyle(.plain)
            .accessibilityLabel("Back")
            // The launch beat is not a place the learner can return to, so beat one
            // keeps the chevron's space and hides the control itself.
            .opacity(onBack == nil ? 0 : 1)
            .disabled(onBack == nil)
            .accessibilityHidden(onBack == nil)

            track

            if let onSkip {
                Button {
                    onSkip()
                } label: {
                    Text("Skip")
                        .scaledFont(15, .bold)
                        .foregroundStyle(Theme.ink55)
                        .padding(.horizontal, 8)
                        .frame(minHeight: Theme.navTapTarget)
                        .contentShape(Rectangle())
                }
                .buttonStyle(.plain)
                .accessibilityHint("Goes straight to who is drawing")
            }
        }
        .padding(.leading, 4)
        .padding(.trailing, 12)
        .frame(height: 56)
    }

    private var track: some View {
        GeometryReader { geometry in
            ZStack(alignment: .leading) {
                Capsule().fill(Theme.surface2)
                Capsule()
                    .fill(Theme.green)
                    .frame(width: geometry.size.width * min(max(progress, 0), 1))
            }
        }
        .frame(height: 14)
        .frame(maxWidth: .infinity)
        .animation(reducesMotion ? nil : .easeOut(duration: 0.3), value: progress)
        .accessibilityElement()
        .accessibilityLabel(stepLabel)
    }
}

// MARK: - The beat frame

/// The shape every onboarding beat after the launch takes: the rail, a body that
/// scrolls only when it has to, and the buttons pinned to the bottom
/// (`.screen-body.ob-body` over `.bottom-area`).
///
/// The body is always inside a `ScrollView` with a minimum height of the space
/// available, so spacers still push things apart at ordinary text sizes and the
/// whole thing scrolls at the accessibility ones — with the buttons never moving.
struct OnboardingBeatFrame<Content: View, Footer: View>: View {

    let rail: OnboardingRail
    @ViewBuilder var content: () -> Content
    @ViewBuilder var footer: () -> Footer

    var body: some View {
        VStack(spacing: 0) {
            rail

            GeometryReader { geometry in
                ScrollView {
                    VStack(alignment: .leading, spacing: 16) {
                        content()
                    }
                    .frame(maxWidth: .infinity, alignment: .leading)
                    .padding(.horizontal, Theme.gutter)
                    .padding(.vertical, 8)
                    .frame(minHeight: geometry.size.height, alignment: .top)
                }
                .scrollBounceBehavior(.basedOnSize)
            }

            VStack(spacing: Theme.stackSpacing) {
                footer()
            }
            .padding(.top, Theme.stackSpacing)
            .padding(.horizontal, Theme.gutter)
            .padding(.bottom, Theme.stackSpacing)
            .background(Theme.page)
        }
        .frame(maxWidth: .infinity, maxHeight: .infinity)
        .background(Theme.page.ignoresSafeArea())
    }
}

// MARK: - Lina and her line

/// Lina beside what she is saying (`.tutor-says`): her portrait and a speech bubble
/// with the tail pointing at her.
///
/// At the accessibility text sizes there is no room for both side by side, so the
/// bubble takes the full width and Lina stands underneath it — the tail then points
/// down at her, which is also the order VoiceOver should read them in.
struct TutorSays: View {
    let pose: LinaView.Pose
    let text: String
    /// Her drawn height. 192 on beat one (`lina--lg`), 124 elsewhere (`lina--md`).
    var size: CGFloat = 124

    @Environment(\.dynamicTypeSize) private var typeSize

    var body: some View {
        if typeSize.isAccessibilitySize {
            VStack(alignment: .leading, spacing: Theme.stackSpacing) {
                SpeechBubble(text: text, tail: .below)
                LinaView(pose: pose, size: 76)
            }
        } else {
            HStack(alignment: .top, spacing: Theme.stackSpacing) {
                LinaView(pose: pose, size: size)
                SpeechBubble(text: text)
            }
        }
    }
}

// MARK: - Small shared pieces

/// A line of quiet body copy centred under a beat's illustration — "No timer. No
/// countdown. The pace is yours." 17/medium at `--ink-55`.
struct OnboardingNote: View {
    let text: String

    init(_ text: String) { self.text = text }

    var body: some View {
        Text(text)
            .textRole(.body)
            .foregroundStyle(Theme.ink55)
            .multilineTextAlignment(.center)
            .fixedSize(horizontal: false, vertical: true)
            .frame(maxWidth: .infinity)
    }
}

extension PathModel {
    /// The subject glyph the path wears in onboarding, on the chip of `ob-ready`. A
    /// path the catalog adds later gets the neutral mark rather than a wrong one.
    ///
    /// Every glyph here is an SF Symbol from SF Symbols 4 or earlier, so all of them
    /// exist on the deployment target (iOS 17). The ids are the curriculum's, level
    /// by level; the two the app shipped with first (`trees`, `cars`) are kept so a
    /// catalog from before the paths were renamed still draws its subjects.
    var onboardingSymbol: String {
        switch id {
        // Starter
        case "sky-weather": return "cloud.sun"
        case "fruits": return "leaf"
        case "food-treats": return "fork.knife"
        // Core
        case "forms": return "cube"
        case "plants", "trees": return "tree"
        case "wheels", "cars": return "car"
        case "on-the-water": return "sailboat"
        case "in-the-air": return "airplane"
        case "space": return "moon.stars"
        case "buildings": return "building.2"
        // Advanced
        case "gear": return "headphones"
        case "fantasy-objects": return "wand.and.stars"
        case "lettering": return "textformat"
        // Paths an earlier catalog named.
        case "houses": return "house"
        case "flowers": return "camera.macro"
        case "mountains": return "mountain.2"
        case "streets", "streets-and-places": return "signpost.right"
        default: return "scribble"
        }
    }
}

extension CatalogLevel {
    /// The few words under the level's name on `ob-level`, which say who it is for
    /// rather than what it teaches: the catalog's own line is written for `hp-paths`
    /// and is too long for a first question. A level the catalog adds later shows
    /// its name alone.
    var onboardingLine: String? {
        switch id {
        case "starter": return "New to drawing"
        case "core": return "Some practice"
        case "advanced": return "Ready for more"
        default: return nil
        }
    }
}

// MARK: - Choosing a first path

/// What `ob-level` and `ob-path` offer, worked out from the catalog and nothing
/// else: the levels that have a path a learner can open, in the catalog's order,
/// and under each at most four of its paths, in catalog order too.
///
/// A catalog without levels, or one whose shipped paths name none, has nothing to
/// ask on `ob-level`: `levels` is then empty and `paths(in:)` offers the first four
/// paths instead. Nothing left out here is hidden from the learner — a path past
/// the fourth, or one no level claims, is on `hp-paths` like every other.
struct OnboardingPathChoices {

    /// A level with the paths `ob-path` shows under it.
    struct Level: Identifiable, Hashable {
        let level: CatalogLevel
        /// One to `maximumPaths`, in catalog order.
        let paths: [PathModel]

        var id: String { level.id }

        /// The path to take when there is nothing to pick between, so the flow can
        /// go past `ob-path` without asking. Nil when there are two or more.
        var onlyPath: PathModel? { paths.count == 1 ? paths.first : nil }
    }

    /// Four picture cards fill two rows, which is as many as the beat shows.
    static let maximumPaths = 4

    /// The levels to ask about, easiest first. Empty when there is no level to ask.
    let levels: [Level]
    /// Every path a learner can open, in catalog order.
    private let shipped: [PathModel]

    /// `paths` in catalog order, as `AppModel` holds them. A path with no lesson in
    /// the bundle is not offered, and a level with no path left is not asked about.
    init(levels catalogLevels: [CatalogLevel], paths: [PathModel]) {
        let shipped = paths.filter { !$0.isEmpty }
        self.shipped = shipped

        var seen: Set<String> = []
        levels = catalogLevels.compactMap { level in
            guard seen.insert(level.id).inserted else { return nil }
            let offered = shipped.filter { $0.level == level.id }.prefix(Self.maximumPaths)
            return offered.isEmpty ? nil : Level(level: level, paths: Array(offered))
        }
    }

    /// True when `ob-level` has something to ask.
    var asksForLevel: Bool { !levels.isEmpty }

    func level(id: String?) -> Level? {
        guard let id else { return nil }
        return levels.first { $0.id == id }
    }

    /// The level a path belongs to, whether or not it is one of the four `ob-path`
    /// shows — so a flow replayed from Settings opens on the learner's own level.
    func level(ofPath pathId: String?) -> Level? {
        guard let pathId, let path = shipped.first(where: { $0.id == pathId }) else { return nil }
        return level(id: path.level)
    }

    /// The paths `ob-path` offers: the level's, or the first four when there are no
    /// levels to choose from.
    func paths(in level: Level?) -> [PathModel] {
        guard asksForLevel else { return Array(shipped.prefix(Self.maximumPaths)) }
        return level?.paths ?? []
    }

    /// The level `ob-level` shows as chosen: the one tapped, else the level of the
    /// path tapped on `ob-path` before coming back, else the level suggested by the
    /// learner's age, else the level of the path the learner already has, else the
    /// easiest.
    func chosenLevel(tapped levelId: String?, tappedPath: String?,
                     ageGroup: AgeGroup? = nil, storedPath: String?) -> Level? {
        level(id: levelId)
            ?? level(ofPath: tappedPath)
            ?? level(id: ageGroup?.suggestedLevelId)
            ?? level(ofPath: storedPath)
            ?? levels.first
    }

    /// The path `ob-path` shows as chosen among the ones it offers: the one tapped,
    /// else the first. The path the learner already has is not consulted, so any
    /// level opens on its first path.
    func chosenPath(in level: Level?, tapped pathId: String?) -> PathModel? {
        let offered = paths(in: level)
        return offered.first { $0.id == pathId } ?? offered.first
    }
}

/// A sheet of white paper with a drawing on it (`.thumb`, `.ob-tile-art`): white,
/// a 2 pt `--line` border, and the picture inside.
struct PaperTile<Content: View>: View {
    var cornerRadius: CGFloat = Theme.thumbCornerRadius
    @ViewBuilder var content: () -> Content

    var body: some View {
        content()
            .padding(2)
            .background(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .fill(Theme.paper)
            )
            .overlay(
                RoundedRectangle(cornerRadius: cornerRadius, style: .continuous)
                    .strokeBorder(Theme.line, lineWidth: 2)
            )
            .clipShape(RoundedRectangle(cornerRadius: cornerRadius, style: .continuous))
    }
}
