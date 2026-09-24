import SwiftUI

/// `ob-who` — "Who's drawing?" The learner's name and picture on one screen, for the
/// profile the app made on first launch. The name may stay blank; the picture's
/// name stands in. Adding a second learner is not asked here — it is one tap on Home
/// whenever a family wants it.
struct OnboardingWhoBeat: View {

    let rail: OnboardingRail
    let onContinue: () -> Void

    @Environment(AppModel.self) private var app
    @State private var name = ""
    @State private var avatar: ProfileAvatar = .fox
    @State private var hasLoaded = false

    var body: some View {
        OnboardingBeatFrame(rail: rail) {
            TutorSays(pose: .neutral, text: "Who’s drawing? Pick a picture, and add your name if you like.")

            ProfileForm(name: $name, avatar: $avatar)
                .padding(.top, 4)

            OnboardingNote("Anyone else who draws here can have their own sketchbook too. Tap your picture on Home to add them.")
                .padding(.top, 8)
        } footer: {
            Button("Continue") {
                app.updateProfile(app.activeProfile.id, name: name, avatar: avatar)
                onContinue()
            }
            .buttonStyle(.primary)
        }
        .onAppear {
            guard !hasLoaded else { return }
            hasLoaded = true
            name = app.activeProfile.name
            avatar = app.activeProfile.avatar
        }
    }
}
