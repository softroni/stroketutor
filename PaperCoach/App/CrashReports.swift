import Foundation
import MetricKit

/// Crash and hang reports from Apple's MetricKit, sent to PostHog as `app_crashed`
/// and `app_hung` (2026-09-27). App Store Connect's API has no crash reports and the
/// app carries no crash SDK, so without this a crash nobody writes in about is never
/// seen.
///
/// iOS writes the report on the device and hands it to the app on a later launch.
/// It says where the app was — a binary and an offset for each frame — the exception
/// and signal, the device model and the iOS version. Nothing about the learner: each
/// report goes out under an id of its own (`Analytics.trackAnonymously`), so it is
/// linked to no one, whatever the age tier.
///
/// Frames arrive unsymbolicated, as `binary+0xoffset`. `app_frame` is the first one
/// in the app itself; docs/ops/README.md says how the archive's dSYM turns it into a
/// line of Swift.
final class CrashReporter: NSObject, MXMetricManagerSubscriber {

    private let deliver: @MainActor ([AnalyticsEvent]) -> Void

    init(deliver: @escaping @MainActor ([AnalyticsEvent]) -> Void) {
        self.deliver = deliver
    }

    /// From now on iOS hands over the reports it holds, on this launch and later ones.
    func start() {
        MXMetricManager.shared.add(self)
    }

    func didReceive(_ payloads: [MXDiagnosticPayload]) {
        let events = payloads.flatMap { CrashReport.events(fromPayload: $0.jsonRepresentation()) }
        guard !events.isEmpty else { return }
        let deliver = deliver
        Task { @MainActor in deliver(events) }
    }
}

/// Turns one MetricKit diagnostic payload, as JSON, into the events PostHog gets.
/// Pure, so the tests read exactly what would be sent.
enum CrashReport {

    /// The app's own binary, whose frames are the ones worth reading first.
    static let appBinary = "PaperCoach"
    /// Frames kept from the top of the stack; the rest is the run loop and `main`.
    static let maxFrames = 40
    /// Longer texts (termination reason, exception message) are cut here.
    static let maxTextLength = 300

    enum Key {
        static let crashedAppVersion = "crashed_app_version"
        static let crashedAppBuild = "crashed_app_build"
        static let osVersion = "os_version"
        static let deviceType = "device_type"
        static let diagnosticDate = "diagnostic_date"
        static let exceptionType = "exception_type"
        static let exceptionCode = "exception_code"
        static let signal = "signal"
        static let terminationReason = "termination_reason"
        static let exceptionReason = "exception_reason"
        static let hangDuration = "hang_duration"
        static let appFrame = "app_frame"
        static let appBinaryUUID = "app_binary_uuid"
        static let frames = "frames"
        /// What a crash is grouped by: exception, signal and the app's own frame.
        static let signature = "signature"
    }

    static func events(fromPayload json: Data, appBinary: String = appBinary) -> [AnalyticsEvent] {
        guard let payload = (try? JSONSerialization.jsonObject(with: json)) as? [String: Any] else { return [] }
        let date = payload["timeStampEnd"] as? String
        let crashes = (payload["crashDiagnostics"] as? [[String: Any]] ?? []).map {
            crashEvent($0, date: date, appBinary: appBinary)
        }
        let hangs = (payload["hangDiagnostics"] as? [[String: Any]] ?? []).map {
            hangEvent($0, date: date, appBinary: appBinary)
        }
        return crashes + hangs
    }

    private static func crashEvent(_ diagnostic: [String: Any], date: String?, appBinary: String) -> AnalyticsEvent {
        let meta = diagnostic["diagnosticMetaData"] as? [String: Any] ?? [:]
        var properties = common(diagnostic, meta: meta, date: date, appBinary: appBinary)
        let exception = number(meta["exceptionType"]).map(exceptionName) ?? "unknown"
        let signal = number(meta["signal"]).map(signalName) ?? "unknown"
        properties[Key.exceptionType] = exception
        properties[Key.signal] = signal
        if let code = number(meta["exceptionCode"]) {
            properties[Key.exceptionCode] = String(code)
        }
        if let reason = meta["terminationReason"] as? String {
            properties[Key.terminationReason] = String(reason.prefix(maxTextLength))
        }
        if let reason = (meta["exceptionReason"] as? [String: Any])?["composedMessage"] as? String {
            properties[Key.exceptionReason] = String(reason.prefix(maxTextLength))
        }
        properties[Key.signature] = "\(exception)/\(signal) \(properties[Key.appFrame] ?? "none")"
        return AnalyticsEvent(name: "app_crashed", properties: properties)
    }

    private static func hangEvent(_ diagnostic: [String: Any], date: String?, appBinary: String) -> AnalyticsEvent {
        let meta = diagnostic["diagnosticMetaData"] as? [String: Any] ?? [:]
        var properties = common(diagnostic, meta: meta, date: date, appBinary: appBinary)
        properties[Key.hangDuration] = meta["hangDuration"] as? String ?? "unknown"
        properties[Key.signature] = "hang \(properties[Key.appFrame] ?? "none")"
        return AnalyticsEvent(name: "app_hung", properties: properties)
    }

    /// What crashes and hangs both say: which build, which device, and the stack.
    private static func common(_ diagnostic: [String: Any],
                               meta: [String: Any],
                               date: String?,
                               appBinary: String) -> [String: String] {
        var properties: [String: String] = [
            Key.crashedAppVersion: meta["appVersion"] as? String ?? "unknown",
            Key.crashedAppBuild: meta["appBuildVersion"] as? String ?? "unknown",
            Key.osVersion: meta["osVersion"] as? String ?? "unknown",
            Key.deviceType: meta["deviceType"] as? String ?? "unknown",
        ]
        if let date {
            properties[Key.diagnosticDate] = date
        }
        let frames = frames(of: diagnostic["callStackTree"] as? [String: Any])
        properties[Key.frames] = frames.map(describe).joined(separator: "\n")
        if let own = frames.first(where: { $0["binaryName"] as? String == appBinary }) {
            properties[Key.appFrame] = describe(own)
            properties[Key.appBinaryUUID] = own["binaryUUID"] as? String
        }
        return properties
    }

    /// The frames of the thread the report is about (the one that crashed, or the
    /// main thread for a hang), from the top of the stack down. MetricKit nests each
    /// frame's caller in its `subFrames`; a sampled tree is read depth first.
    static func frames(of tree: [String: Any]?) -> [[String: Any]] {
        let stacks = tree?["callStacks"] as? [[String: Any]] ?? []
        let stack = stacks.first { $0["threadAttributed"] as? Bool == true } ?? stacks.first
        var found: [[String: Any]] = []
        func walk(_ frames: [[String: Any]]) {
            for frame in frames where found.count < maxFrames {
                found.append(frame)
                walk(frame["subFrames"] as? [[String: Any]] ?? [])
            }
        }
        walk(stack?["callStackRootFrames"] as? [[String: Any]] ?? [])
        return found
    }

    /// `PaperCoach+0x1a2b`: the binary and the offset into its text segment, which
    /// is what `atos` needs.
    private static func describe(_ frame: [String: Any]) -> String {
        let name = frame["binaryName"] as? String ?? "?"
        let offset = number(frame["offsetIntoBinaryTextSegment"]) ?? 0
        return "\(name)+0x\(String(offset, radix: 16))"
    }

    private static func number(_ value: Any?) -> Int? {
        (value as? NSNumber)?.intValue
    }

    /// Mach exception types, as a crash log names them.
    static func exceptionName(_ type: Int) -> String {
        switch type {
        case 1: "EXC_BAD_ACCESS"
        case 2: "EXC_BAD_INSTRUCTION"
        case 3: "EXC_ARITHMETIC"
        case 4: "EXC_EMULATION"
        case 5: "EXC_SOFTWARE"
        case 6: "EXC_BREAKPOINT"
        case 10: "EXC_CRASH"
        case 11: "EXC_RESOURCE"
        case 12: "EXC_GUARD"
        case 13: "EXC_CORPSE_NOTIFY"
        default: "EXC_\(type)"
        }
    }

    static func signalName(_ signal: Int) -> String {
        switch signal {
        case 4: "SIGILL"
        case 5: "SIGTRAP"
        case 6: "SIGABRT"
        case 7: "SIGEMT"
        case 8: "SIGFPE"
        case 9: "SIGKILL"
        case 10: "SIGBUS"
        case 11: "SIGSEGV"
        case 12: "SIGSYS"
        case 13: "SIGPIPE"
        default: "SIG\(signal)"
        }
    }
}
