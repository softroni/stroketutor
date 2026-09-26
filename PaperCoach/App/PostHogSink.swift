import Foundation
import os

/// Sends `Analytics` events to PostHog (project "Paper Coach", 629055, US cloud)
/// through its batch capture API, with no SDK: only the events `Analytics` names
/// leave the device, never a tap or a screen on their own, never a recording, and
/// nothing about the device beyond the app's version.
///
/// What each age tier allows (`AnalyticsPolicy`) comes out as:
/// - **child**: `$process_person_profile` false, so PostHog keeps no person for the
///   per-launch id `Analytics` gives them; nothing is sent on `identify`.
/// - **teen, adult**: the profile's random id builds a person, and `identify` sets
///   its `age_group`.
///
/// Every event carries `$geoip_disable`, so PostHog works out no location from the
/// connection, and the project discards client IP addresses ("Discard client IP
/// data", Settings › Project). "Controlling data storage"
/// (https://posthog.com/docs/privacy/data-storage), read 2026-09-26.
///
/// Events wait in memory and go in batches: every `flushInterval`, at `flushCount`,
/// and when the app goes to the background (`flush()`). A batch that fails for want
/// of a network stays for the next try; one PostHog refuses is dropped.
@MainActor
final class PostHogSink: AnalyticsSink {

    /// The project's public key. Public by design, like Superwall's `pk_`: it only
    /// lets the app send events, never read them.
    nonisolated static let projectKey = "phc_ypKEM2MfVWZQZEz24GhQwzG3NyfZksRgHEMpUiLojXQt"
    nonisolated static let batchURL = URL(string: "https://us.i.posthog.com/batch/")!
    static let flushInterval: Duration = .seconds(15)
    static let flushCount = 20
    /// Beyond this, the oldest events are let go rather than kept forever offline.
    static let maxQueued = 500

    /// Sends one batch body; answers whether PostHog took it (`.sent`), refused it
    /// (`.refused`) or could not be reached (`.unreachable`).
    typealias Transport = @Sendable (Data) async -> SendResult
    enum SendResult { case sent, refused, unreachable }

    private static let log = Logger(subsystem: "com.softroni.papercoach", category: "analytics")

    private let transport: Transport
    private let appVersion: String
    private let build: String
    private let now: () -> Date
    private(set) var queue: [PostHogEvent] = []
    private var timer: Task<Void, Never>?
    private var isSending = false

    init(appVersion: String, build: String, now: @escaping () -> Date = Date.init, transport: @escaping Transport) {
        self.appVersion = appVersion
        self.build = build
        self.now = now
        self.transport = transport
    }

    /// The sink for this launch: PostHog in the app, nothing in the unit tests or a
    /// screenshot launch of the harness. A debug build sends too, marked
    /// `build: debug` so the charts can leave it out.
    static func make(bundle: Bundle = .main) -> AnalyticsSink {
        #if DEBUG
        let runningTests = ProcessInfo.processInfo.environment["XCTestConfigurationFilePath"] != nil
        if runningTests || DebugScreenHarness.isActive { return NoAnalyticsSink() }
        let build = "debug"
        #else
        let build = "release"
        #endif
        let version = bundle.object(forInfoDictionaryKey: "CFBundleShortVersionString") as? String ?? "?"
        return PostHogSink(appVersion: version, build: build, transport: urlSessionTransport)
    }

    // MARK: - AnalyticsSink

    func identify(distinctId: String, properties: [String: String], policy: AnalyticsPolicy) {
        guard policy.keepsPersonProfile else { return }
        var event = makeEvent(name: "$identify", properties: [:], distinctId: distinctId, policy: policy)
        event.properties["$set"] = .object(properties)
        enqueue(event)
    }

    func capture(_ event: AnalyticsEvent, distinctId: String, policy: AnalyticsPolicy) {
        enqueue(makeEvent(name: event.name,
                          properties: event.properties,
                          distinctId: distinctId,
                          policy: policy))
    }

    /// Nothing to forget here: every queued event already carries its own id, and
    /// no id is kept between events.
    func reset() {}

    func flush() {
        timer?.cancel()
        timer = nil
        guard !isSending, !queue.isEmpty else { return }
        let batch = Array(queue.prefix(100))
        guard let body = try? Self.body(for: batch) else {
            queue.removeFirst(batch.count)
            return
        }
        isSending = true
        Task {
            let result = await transport(body)
            isSending = false
            switch result {
            case .sent, .refused:
                if result == .refused { Self.log.error("PostHog refused a batch of \(batch.count) events") }
                queue.removeFirst(min(batch.count, queue.count))
                if !queue.isEmpty { scheduleFlush() }
            case .unreachable:
                scheduleFlush()
            }
        }
    }

    // MARK: - Events

    /// One event as PostHog's capture API takes it. Pure, so the tests read exactly
    /// what would be sent.
    func makeEvent(name: String, properties: [String: String], distinctId: String, policy: AnalyticsPolicy) -> PostHogEvent {
        var values = properties.mapValues(PostHogEvent.Value.string)
        values["$process_person_profile"] = .bool(policy.keepsPersonProfile)
        values["$geoip_disable"] = .bool(true)
        values["$lib"] = .string("paper-coach-ios")
        values["$app_version"] = .string(appVersion)
        values["$os"] = .string("iOS")
        values["build"] = .string(build)
        return PostHogEvent(event: name,
                            distinctId: distinctId,
                            uuid: UUID().uuidString.lowercased(),
                            timestamp: Self.timestamp(now()),
                            properties: values)
    }

    private func enqueue(_ event: PostHogEvent) {
        queue.append(event)
        if queue.count > Self.maxQueued {
            queue.removeFirst(queue.count - Self.maxQueued)
        }
        if queue.count >= Self.flushCount {
            flush()
        } else {
            scheduleFlush()
        }
    }

    private func scheduleFlush() {
        guard timer == nil else { return }
        timer = Task { [weak self] in
            try? await Task.sleep(for: Self.flushInterval)
            guard !Task.isCancelled else { return }
            self?.timer = nil
            self?.flush()
        }
    }

    static func body(for batch: [PostHogEvent]) throws -> Data {
        try JSONEncoder().encode(Batch(apiKey: projectKey, batch: batch))
    }

    private static func timestamp(_ date: Date) -> String {
        let formatter = ISO8601DateFormatter()
        formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
        return formatter.string(from: date)
    }

    private struct Batch: Encodable {
        let apiKey: String
        let batch: [PostHogEvent]

        enum CodingKeys: String, CodingKey {
            case apiKey = "api_key"
            case batch
        }
    }

    nonisolated private static let urlSessionTransport: Transport = { body in
        var request = URLRequest(url: batchURL)
        request.httpMethod = "POST"
        request.setValue("application/json", forHTTPHeaderField: "Content-Type")
        request.httpBody = body
        request.timeoutInterval = 20
        do {
            let (_, response) = try await URLSession.shared.data(for: request)
            let status = (response as? HTTPURLResponse)?.statusCode ?? 0
            switch status {
            case 200..<300: return .sent
            case 400..<500: return .refused
            default: return .unreachable
            }
        } catch {
            return .unreachable
        }
    }
}

/// One event in PostHog's batch body.
struct PostHogEvent: Encodable, Equatable {
    enum Value: Encodable, Equatable {
        case string(String)
        case bool(Bool)
        case object([String: String])

        func encode(to encoder: Encoder) throws {
            var container = encoder.singleValueContainer()
            switch self {
            case let .string(value): try container.encode(value)
            case let .bool(value): try container.encode(value)
            case let .object(value): try container.encode(value)
            }
        }
    }

    let event: String
    let distinctId: String
    let uuid: String
    let timestamp: String
    var properties: [String: Value]

    enum CodingKeys: String, CodingKey {
        case event
        case distinctId = "distinct_id"
        case uuid
        case timestamp
        case properties
    }
}
