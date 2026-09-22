import SwiftUI

/// The PIN pad, in a sheet. Three jobs:
///
/// - **create** — enter four digits, then the same four again.
/// - **verify** — enter the PIN to let one destructive action through.
/// - **change** — verify the old PIN, then create a new one.
///
/// Big keys, no keyboard, so it works the same for the grown-up at every text size.
struct PINPadSheet: View {

    enum Mode {
        case create
        case verify(reason: String)
        case change
    }

    let mode: Mode
    /// Called once the PIN has been set or checked. The sheet closes itself.
    let onSuccess: () -> Void

    @Environment(AppModel.self) private var app
    @Environment(\.dismiss) private var dismiss

    private enum Stage: Equatable {
        case verifyOld
        case enterNew
        case confirmNew(first: String)
    }

    @State private var stage: Stage?
    @State private var entry = ""
    @State private var message: String?
    @State private var now = Date()

    var body: some View {
        NavigationStack {
            VStack(spacing: Theme.sectionSpacing) {
                Spacer(minLength: 0)

                Text(title)
                    .textRole(.title2)
                    .foregroundStyle(Theme.ink)
                    .multilineTextAlignment(.center)

                if let subtitle {
                    Text(subtitle)
                        .textRole(.subhead)
                        .foregroundStyle(Theme.ink55)
                        .multilineTextAlignment(.center)
                        .fixedSize(horizontal: false, vertical: true)
                }

                dots

                Text(message ?? " ")
                    .textRole(.footnote)
                    .foregroundStyle(Theme.danger)
                    .multilineTextAlignment(.center)
                    .accessibilityHidden(message == nil)

                keypad
                    .disabled(isPaused)
                    .opacity(isPaused ? 0.4 : 1)

                Spacer(minLength: 0)
            }
            .padding(.horizontal, Theme.gutter)
            .frame(maxWidth: .infinity, maxHeight: .infinity)
            .background(Theme.page)
            .toolbar {
                ToolbarItem(placement: .cancellationAction) {
                    Button("Cancel") { dismiss() }
                }
            }
        }
        .onAppear {
            if stage == nil {
                switch mode {
                case .create: stage = .enterNew
                case .verify, .change: stage = .verifyOld
                }
            }
        }
        .task {
            // Ticks only so a paused pad wakes up again on its own.
            while !Task.isCancelled {
                try? await Task.sleep(for: .seconds(1))
                now = Date()
            }
        }
    }

    // MARK: - Words

    private var title: String {
        switch stage {
        case .verifyOld, .none: return "Enter the PIN"
        case .enterNew: return "Choose a PIN"
        case .confirmNew: return "Enter it again"
        }
    }

    private var subtitle: String? {
        switch (mode, stage) {
        case let (.verify(reason), _): return reason
        case (.change, .verifyOld): return "First, the PIN you use now."
        case (_, .enterNew): return "Four digits. It is asked for before deleting someone or resetting progress."
        default: return nil
        }
    }

    private var isPaused: Bool {
        app.pin.isPaused(at: now)
    }

    // MARK: - Pad

    private var dots: some View {
        HStack(spacing: 18) {
            ForEach(0..<AppPIN.length, id: \.self) { index in
                Circle()
                    .fill(index < entry.count ? Theme.ink : Theme.surface2)
                    .frame(width: 18, height: 18)
            }
        }
        .accessibilityElement()
        .accessibilityLabel("\(entry.count) of \(AppPIN.length) digits entered")
    }

    private var keypad: some View {
        let rows = [["1", "2", "3"], ["4", "5", "6"], ["7", "8", "9"], ["", "0", "⌫"]]
        return VStack(spacing: 12) {
            ForEach(rows, id: \.self) { row in
                HStack(spacing: 12) {
                    ForEach(row, id: \.self) { key in
                        if key.isEmpty {
                            Color.clear.frame(width: 76, height: 64)
                        } else {
                            Button {
                                press(key)
                            } label: {
                                Group {
                                    if key == "⌫" {
                                        Image(systemName: "delete.left").scaledFont(22, .semibold, design: .default)
                                    } else {
                                        Text(key).scaledFont(28, .bold)
                                    }
                                }
                                .foregroundStyle(Theme.ink)
                                .frame(width: 76, height: 64)
                                .background(RoundedRectangle(cornerRadius: 18, style: .continuous)
                                    .fill(key == "⌫" ? Color.clear : Theme.surface))
                                .contentShape(Rectangle())
                            }
                            .buttonStyle(.plain)
                            .accessibilityLabel(key == "⌫" ? "Delete" : key)
                        }
                    }
                }
            }
        }
    }

    private func press(_ key: String) {
        if key == "⌫" {
            if !entry.isEmpty { entry.removeLast() }
            return
        }
        guard entry.count < AppPIN.length else { return }
        entry.append(key)
        message = nil
        if entry.count == AppPIN.length { submit(entry) }
    }

    private func submit(_ pin: String) {
        entry = ""
        switch stage {
        case .verifyOld, .none:
            if app.pin.verify(pin) {
                if case .change = mode {
                    stage = .enterNew
                } else {
                    finish()
                }
            } else {
                now = Date()
                message = app.pin.isPaused(at: now)
                    ? "Too many tries. Wait \(Int(AppPIN.pauseDuration)) seconds."
                    : "That is not the PIN."
            }
        case .enterNew:
            stage = .confirmNew(first: pin)
        case let .confirmNew(first):
            if first == pin {
                app.pin.set(pin)
                finish()
            } else {
                stage = .enterNew
                message = "Those did not match. Start again."
            }
        }
    }

    private func finish() {
        onSuccess()
        dismiss()
    }
}

/// What a destructive action needs the PIN for. With no PIN set, the action goes
/// straight to its own confirmation; with one, the PIN comes first.
struct PINGateRequest: Identifiable {
    let id = UUID()
    let reason: String
    let onApproved: () -> Void
}

extension View {
    /// Presents the PIN pad for `request`, and runs its action once the right PIN
    /// has been entered — after the pad has closed, so an action that raises its own
    /// confirmation is not presenting over a sheet on its way out.
    func pinGate(_ request: Binding<PINGateRequest?>) -> some View {
        modifier(PINGateModifier(request: request))
    }
}

private struct PINGateModifier: ViewModifier {
    @Binding var request: PINGateRequest?
    @State private var approved: (() -> Void)?

    func body(content: Content) -> some View {
        content.sheet(item: $request, onDismiss: {
            let action = approved
            approved = nil
            action?()
        }) { request in
            PINPadSheet(mode: .verify(reason: request.reason)) {
                approved = request.onApproved
            }
        }
    }
}
