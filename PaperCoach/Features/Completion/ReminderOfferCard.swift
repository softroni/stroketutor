import SwiftUI

/// "Draw again tomorrow?" — the practice reminder, offered on a finished drawing's
/// screen (`sk-complete`) when `ReminderOfferPolicy` says so: one row above "Add to
/// sketchbook", where it is seen without scrolling whatever else the screen holds.
/// It names the time of the note before anything is asked, so iOS's own prompt,
/// which "Remind me" may raise, comes after the learner has seen what they would
/// get (Human Interface Guidelines › Managing notifications;
/// `PracticeReminderScheduler`). The cross is "No thanks", which puts it away for
/// good; Settings › Practice reminder stays where it was.
///
/// Once the reminder is on, the row says when the first note comes and stays,
/// quietly, until the screen is left.
struct ReminderOfferCard: View {
    enum Phase: Equatable {
        case asking
        /// "Remind me" was tapped and iOS's prompt is waiting for an answer.
        case waiting
        case accepted
    }

    let phase: Phase
    /// The note's time as this iPhone writes times: "4:45 PM".
    let timeText: String
    let onAccept: () -> Void
    let onDecline: () -> Void

    @Environment(\.dynamicTypeSize) private var dynamicTypeSize

    var body: some View {
        Group {
            if phase == .accepted {
                accepted
            } else if dynamicTypeSize.isAccessibilitySize {
                VStack(alignment: .leading, spacing: 10) {
                    HStack(alignment: .top, spacing: 12) {
                        icon("bell.fill")
                        askingWords
                    }
                    remindButton
                    Button("No thanks", action: onDecline)
                        .buttonStyle(.quiet)
                        .disabled(phase == .waiting)
                }
            } else {
                HStack(spacing: 10) {
                    askingWords
                        .frame(maxWidth: .infinity, alignment: .leading)
                    remindButton
                    closeButton
                }
            }
        }
        .padding(.vertical, 10)
        .padding(.leading, 16)
        .padding(.trailing, 6)
        .frame(maxWidth: .infinity, alignment: .leading)
        .background(
            RoundedRectangle(cornerRadius: Theme.controlCornerRadius, style: .continuous)
                .fill(Theme.surface)
        )
    }

    // MARK: - Asking

    private var askingWords: some View {
        VStack(alignment: .leading, spacing: 2) {
            Text("Draw again tomorrow?")
                .scaledFont(16, .heavy, relativeTo: .headline)
                .foregroundStyle(Theme.ink)
                .fixedSize(horizontal: false, vertical: true)
            Text("Every day at \(timeText)")
                .scaledFont(14, .semibold, relativeTo: .subheadline)
                .foregroundStyle(Theme.ink55)
                .fixedSize(horizontal: false, vertical: true)
        }
        .accessibilityElement(children: .combine)
    }

    private var remindButton: some View {
        Button(action: onAccept) {
            Text("Remind me")
                .scaledFont(15, .heavy, relativeTo: .subheadline)
                .foregroundStyle(.white)
                .padding(.horizontal, 14)
                .frame(minHeight: 44)
                .background(Capsule().fill(Theme.green))
                .fixedSize()
                .contentShape(Capsule())
        }
        .buttonStyle(PressableSlotStyle())
        .disabled(phase == .waiting)
        .opacity(phase == .waiting ? 0.6 : 1)
    }

    /// "No thanks", as a cross: the row has no room for the words.
    private var closeButton: some View {
        Button(action: onDecline) {
            Image(systemName: "xmark")
                .scaledFont(13, .heavy, design: .default)
                .foregroundStyle(Theme.ink40)
                .frame(width: 30, height: 30)
                .background(Circle().fill(Theme.surface2))
                .frame(width: 44, height: 44)
                .contentShape(Rectangle())
        }
        .buttonStyle(.plain)
        .disabled(phase == .waiting)
        .accessibilityLabel("No thanks")
    }

    // MARK: - Accepted

    private var accepted: some View {
        HStack(spacing: 12) {
            icon("checkmark")
            VStack(alignment: .leading, spacing: 2) {
                Text("See you tomorrow at \(timeText).")
                    .scaledFont(16, .heavy, relativeTo: .headline)
                    .foregroundStyle(Theme.ink)
                    .fixedSize(horizontal: false, vertical: true)
                Text("Change it any time in Settings.")
                    .scaledFont(14, .semibold, relativeTo: .subheadline)
                    .foregroundStyle(Theme.ink55)
                    .fixedSize(horizontal: false, vertical: true)
            }
            .frame(maxWidth: .infinity, alignment: .leading)
        }
        .frame(minHeight: 44)
        .accessibilityElement(children: .combine)
    }

    private func icon(_ systemName: String) -> some View {
        Image(systemName: systemName)
            .scaledFont(15, .bold, design: .default)
            .foregroundStyle(Theme.greenDeep)
            .frame(width: 34, height: 34)
            .background(Circle().fill(Theme.greenSoft))
            .accessibilityHidden(true)
    }
}
