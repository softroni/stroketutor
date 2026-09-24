import SwiftUI

/// A learner's animal on its soft disc. Decorative by default: the name beside it is
/// what VoiceOver reads.
struct ProfileAvatarView: View {
    let avatar: ProfileAvatar
    var size: CGFloat = 44
    /// A green ring, for the learner who is drawing now or the picture being chosen.
    var isHighlighted = false

    var body: some View {
        Text(avatar.emoji)
            .font(.system(size: size * 0.56))
            .frame(width: size, height: size)
            .background(Circle().fill(avatar.tint))
            .overlay {
                if isHighlighted {
                    Circle().strokeBorder(Theme.green, lineWidth: max(2, size / 22))
                }
            }
            .accessibilityHidden(true)
    }
}

/// The one screen that sets up a learner: a name and a picture, together. Used by
/// onboarding, "Add someone" and the profile's own settings page.
///
/// The name may be left blank — a four-year-old can pick the fox and go — and
/// then the picture's name stands in for it.
struct ProfileForm: View {
    @Binding var name: String
    @Binding var avatar: ProfileAvatar
    /// Pictures other learners already use, shown but not blocked: two foxes is
    /// allowed.
    var takenAvatars: Set<ProfileAvatar> = []

    @FocusState private var nameFocused: Bool

    private let columns = [GridItem(.adaptive(minimum: 64, maximum: 88), spacing: 12)]

    var body: some View {
        VStack(alignment: .leading, spacing: Theme.stackSpacing) {
            HStack {
                Spacer()
                ProfileAvatarView(avatar: avatar, size: 96)
                Spacer()
            }
            .padding(.bottom, 4)

            Text("Name")
                .textRole(.headline)
                .foregroundStyle(Theme.ink)
            // Ink, a green caret and an ink-40 placeholder, set here rather than left
            // to the system: in dark mode those default to white on this light field.
            TextField("", text: $name, prompt: Text(avatar.name).foregroundStyle(Theme.ink40))
                .textFieldStyle(.plain)
                .textRole(.body)
                .foregroundStyle(Theme.ink)
                .tint(Theme.green)
                .textContentType(.givenName)
                .textInputAutocapitalization(.words)
                .autocorrectionDisabled()
                .submitLabel(.done)
                .focused($nameFocused)
                .padding(.horizontal, 18)
                .frame(minHeight: Theme.minimumTapTarget)
                .background(RoundedRectangle(cornerRadius: Theme.controlCornerRadius, style: .continuous)
                    .fill(Theme.surface))
                .onChange(of: name) { _, new in
                    if new.count > Profile.maximumNameLength {
                        name = String(new.prefix(Profile.maximumNameLength))
                    }
                }
                .accessibilityLabel("Name")
                .accessibilityHint("Optional. Leave it blank to use the picture's name.")

            Text("Picture")
                .textRole(.headline)
                .foregroundStyle(Theme.ink)
                .padding(.top, 8)
            LazyVGrid(columns: columns, spacing: 12) {
                ForEach(ProfileAvatar.allCases) { option in
                    Button {
                        nameFocused = false
                        avatar = option
                    } label: {
                        ProfileAvatarView(avatar: option, size: 64, isHighlighted: option == avatar)
                            .opacity(takenAvatars.contains(option) && option != avatar ? 0.45 : 1)
                            .frame(maxWidth: .infinity)
                            .contentShape(Rectangle())
                    }
                    .buttonStyle(.plain)
                    .accessibilityLabel(option.name)
                    .accessibilityAddTraits(option == avatar ? [.isButton, .isSelected] : .isButton)
                }
            }
        }
    }
}

/// "Add someone", in a sheet: the form and one button. Never part of
/// onboarding's required steps.
struct NewProfileSheet: View {
    /// Called with the new learner once their folder is on disk.
    let onAdded: (Profile) -> Void
    var onCancel: () -> Void

    @Environment(AppModel.self) private var app
    @State private var name = ""
    @State private var avatar: ProfileAvatar = .fox
    @State private var didFail = false

    var body: some View {
        NavigationStack {
            ScrollView {
                ProfileForm(name: $name, avatar: $avatar, takenAvatars: Set(app.profiles.map(\.avatar)))
                    .padding(Theme.gutter)

                if didFail {
                    Text("That could not be saved. Try again.")
                        .textRole(.footnote)
                        .foregroundStyle(Theme.danger)
                }
            }
            .safeAreaInset(edge: .bottom) {
                Button("Add \(name.isEmpty ? avatar.name : Profile.cleaned(name))") {
                    if let profile = app.addProfile(name: name, avatar: avatar) {
                        onAdded(profile)
                    } else {
                        didFail = true
                    }
                }
                .buttonStyle(.primary)
                .padding(.horizontal, Theme.gutter)
                .padding(.vertical, Theme.stackSpacing)
                .background(Theme.page)
            }
            .background(Theme.page)
            .navigationTitle("Add someone")
            .navigationBarTitleDisplayMode(.inline)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel", action: onCancel)
                }
            }
        }
        .onAppear { avatar = ProfileAvatar.firstUnused(by: app.profiles) }
    }
}
