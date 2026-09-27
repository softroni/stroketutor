import XCTest
@testable import PaperCoach

/// What a MetricKit report becomes: one `app_crashed` or `app_hung` per diagnostic,
/// naming the build, the device, the exception and the app's own frame, and sent
/// under an id that belongs to no learner.
@MainActor
final class CrashReportTests: XCTestCase {

    func testACrashNamesTheBuildTheExceptionAndTheAppsOwnFrame() throws {
        let events = CrashReport.events(fromPayload: payload(crashes: [crash()]))

        let event = try XCTUnwrap(events.first)
        XCTAssertEqual(events.count, 1)
        XCTAssertEqual(event.name, "app_crashed")
        XCTAssertEqual(event.properties["crashed_app_version"], "1.0.1")
        XCTAssertEqual(event.properties["crashed_app_build"], "3")
        XCTAssertEqual(event.properties["os_version"], "iPhone OS 26.0 (23A341)")
        XCTAssertEqual(event.properties["device_type"], "iPhone17,1")
        XCTAssertEqual(event.properties["diagnostic_date"], "2026-09-27 23:59:00 +0000")
        XCTAssertEqual(event.properties["exception_type"], "EXC_BREAKPOINT")
        XCTAssertEqual(event.properties["signal"], "SIGTRAP")
        XCTAssertEqual(event.properties["exception_code"], "0")
        XCTAssertEqual(event.properties["app_frame"], "PaperCoach+0x1a2b")
        XCTAssertEqual(event.properties["app_binary_uuid"], "APP-UUID")
        XCTAssertEqual(event.properties["signature"], "EXC_BREAKPOINT/SIGTRAP PaperCoach+0x1a2b")
    }

    func testFramesRunFromTheTopOfTheCrashedThreadDown() throws {
        let events = CrashReport.events(fromPayload: payload(crashes: [crash()]))

        let frames = try XCTUnwrap(events.first?.properties["frames"])
        XCTAssertEqual(frames, "libswiftCore.dylib+0x10\nPaperCoach+0x1a2b\nPaperCoach+0x400\nUIKitCore+0xff")
    }

    func testTheThreadTheReportIsAboutWinsOverTheFirstOne() {
        let quiet: [String: Any] = ["threadAttributed": false,
                                    "callStackRootFrames": [frame("PaperCoach", 0x999)]]
        let crashed: [String: Any] = ["threadAttributed": true,
                                      "callStackRootFrames": [frame("PaperCoach", 0x77)]]

        let frames = CrashReport.frames(of: ["callStacks": [quiet, crashed]])

        XCTAssertEqual(frames.count, 1)
        XCTAssertEqual(frames.first?["offsetIntoBinaryTextSegment"] as? Int, 0x77)
    }

    func testADeepStackKeepsOnlyItsTop() {
        var chain = frame("PaperCoach", 0)
        for offset in 1...100 {
            chain = frame("PaperCoach", offset, calledBy: chain)
        }

        let frames = CrashReport.frames(of: ["callStacks": [["threadAttributed": true,
                                                             "callStackRootFrames": [chain]]]])

        XCTAssertEqual(frames.count, CrashReport.maxFrames)
        XCTAssertEqual(frames.first?["offsetIntoBinaryTextSegment"] as? Int, 100)
    }

    func testLongReasonsAreCut() throws {
        var diagnostic = crash()
        var meta = try XCTUnwrap(diagnostic["diagnosticMetaData"] as? [String: Any])
        meta["terminationReason"] = String(repeating: "x", count: 1000)
        meta["exceptionReason"] = ["composedMessage": String(repeating: "y", count: 1000)]
        diagnostic["diagnosticMetaData"] = meta

        let event = try XCTUnwrap(CrashReport.events(fromPayload: payload(crashes: [diagnostic])).first)

        XCTAssertEqual(event.properties["termination_reason"]?.count, CrashReport.maxTextLength)
        XCTAssertEqual(event.properties["exception_reason"]?.count, CrashReport.maxTextLength)
    }

    func testACrashOutsideTheAppSaysSo() throws {
        var diagnostic = crash()
        diagnostic["callStackTree"] = ["callStacks": [["threadAttributed": true,
                                                       "callStackRootFrames": [frame("UIKitCore", 0x5)]]]]

        let event = try XCTUnwrap(CrashReport.events(fromPayload: payload(crashes: [diagnostic])).first)

        XCTAssertNil(event.properties["app_frame"])
        XCTAssertEqual(event.properties["signature"], "EXC_BREAKPOINT/SIGTRAP none")
    }

    func testAHangSaysHowLong() throws {
        let hang: [String: Any] = [
            "callStackTree": ["callStacks": [["threadAttributed": true,
                                              "callStackRootFrames": [frame("PaperCoach", 0x42)]]]],
            "diagnosticMetaData": ["appVersion": "1.0.1", "appBuildVersion": "3", "hangDuration": "4 sec"],
        ]

        let events = CrashReport.events(fromPayload: payload(crashes: [crash()], hangs: [hang]))

        XCTAssertEqual(events.map(\.name), ["app_crashed", "app_hung"])
        let event = try XCTUnwrap(events.last)
        XCTAssertEqual(event.properties["hang_duration"], "4 sec")
        XCTAssertEqual(event.properties["signature"], "hang PaperCoach+0x42")
    }

    func testAnythingElseSendsNothing() {
        XCTAssertEqual(CrashReport.events(fromPayload: Data("not json".utf8)), [])
        XCTAssertEqual(CrashReport.events(fromPayload: payload(crashes: [])), [])
    }

    func testUnknownNumbersStillGetANameAnAnalystCanRead() {
        XCTAssertEqual(CrashReport.exceptionName(1), "EXC_BAD_ACCESS")
        XCTAssertEqual(CrashReport.exceptionName(99), "EXC_99")
        XCTAssertEqual(CrashReport.signalName(11), "SIGSEGV")
        XCTAssertEqual(CrashReport.signalName(99), "SIG99")
    }

    func testAReportGoesOutUnderAnIdThatIsNoLearners() throws {
        let sink = RecordingSink()
        let analytics = Analytics(sink: sink)
        analytics.identify(Profile(name: "Sam", avatar: .fox, ageGroup: .adult))
        let learner = analytics.distinctId

        analytics.trackAnonymously(AnalyticsEvent(name: "app_crashed", properties: ["signal": "SIGTRAP"]))
        analytics.trackAnonymously(AnalyticsEvent(name: "app_crashed", properties: ["signal": "SIGTRAP"]))

        XCTAssertEqual(sink.captured.count, 2)
        XCTAssertNotEqual(sink.captured[0].distinctId, learner)
        XCTAssertNotEqual(sink.captured[0].distinctId, sink.captured[1].distinctId)
        for captured in sink.captured {
            XCTAssertFalse(captured.policy.keepsPersonProfile)
            XCTAssertEqual(captured.event.properties, ["signal": "SIGTRAP"])
        }
    }

    // MARK: - Fixtures

    /// A payload shaped like `MXDiagnosticPayload.jsonRepresentation()`.
    private func payload(crashes: [[String: Any]], hangs: [[String: Any]] = []) -> Data {
        let object: [String: Any] = [
            "timeStampBegin": "2026-09-27 00:00:00 +0000",
            "timeStampEnd": "2026-09-27 23:59:00 +0000",
            "crashDiagnostics": crashes,
            "hangDiagnostics": hangs,
        ]
        return try! JSONSerialization.data(withJSONObject: object)
    }

    /// A Swift trap in the app, called from UIKit.
    private func crash() -> [String: Any] {
        let stack = frame("libswiftCore.dylib", 0x10,
                          calledBy: frame("PaperCoach", 0x1a2b, uuid: "APP-UUID",
                                          calledBy: frame("PaperCoach", 0x400,
                                                          calledBy: frame("UIKitCore", 0xff))))
        return [
            "version": "1.0.0",
            "callStackTree": ["callStackPerThread": true,
                              "callStacks": [["threadAttributed": true, "callStackRootFrames": [stack]]]],
            "diagnosticMetaData": [
                "appVersion": "1.0.1",
                "appBuildVersion": "3",
                "osVersion": "iPhone OS 26.0 (23A341)",
                "deviceType": "iPhone17,1",
                "exceptionType": 6,
                "exceptionCode": 0,
                "signal": 5,
                "platformArchitecture": "arm64e",
            ] as [String: Any],
        ]
    }

    /// A frame and, below it, the frame that called it.
    private func frame(_ binary: String, _ offset: Int, uuid: String = "UUID",
                       calledBy caller: [String: Any]? = nil) -> [String: Any] {
        var frame: [String: Any] = ["binaryName": binary,
                                    "binaryUUID": uuid,
                                    "offsetIntoBinaryTextSegment": offset,
                                    "address": 0x100000000 + offset,
                                    "sampleCount": 1]
        if let caller {
            frame["subFrames"] = [caller]
        }
        return frame
    }
}

/// Keeps everything the app would have sent, with the policy it was sent under.
@MainActor
private final class RecordingSink: AnalyticsSink {
    struct Captured { let event: AnalyticsEvent; let distinctId: String; let policy: AnalyticsPolicy }

    private(set) var captured: [Captured] = []

    func identify(distinctId: String, properties: [String: String], policy: AnalyticsPolicy) {}

    func capture(_ event: AnalyticsEvent, distinctId: String, policy: AnalyticsPolicy) {
        captured.append(Captured(event: event, distinctId: distinctId, policy: policy))
    }

    func reset() {}
}
