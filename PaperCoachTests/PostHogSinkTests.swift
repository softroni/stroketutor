import XCTest
@testable import PaperCoach

/// What the PostHog sink sends: only what each age tier allows, never a location,
/// in batches that survive a missing network and are let go when PostHog refuses
/// them.
@MainActor
final class PostHogSinkTests: XCTestCase {

    private let child = AnalyticsPolicy(tier: .child)
    private let teen = AnalyticsPolicy(tier: .teen)
    private let adult = AnalyticsPolicy(tier: .adult)

    // MARK: - Events

    func testAChildsEventsBuildNoPersonAndNoLocation() {
        let sink = makeSink { _ in .sent }
        let event = sink.makeEvent(name: "lesson_started",
                                   properties: ["lesson_id": "pine-tree", "age_group": "6to9"],
                                   distinctId: "launch-id",
                                   policy: child)

        XCTAssertEqual(event.event, "lesson_started")
        XCTAssertEqual(event.distinctId, "launch-id")
        XCTAssertEqual(event.properties["$process_person_profile"], .bool(false))
        XCTAssertEqual(event.properties["$geoip_disable"], .bool(true))
        XCTAssertEqual(event.properties["lesson_id"], .string("pine-tree"))
        XCTAssertEqual(event.properties["age_group"], .string("6to9"))
    }

    func testTeensAndAdultsBuildAPersonButStillNoLocation() {
        let sink = makeSink { _ in .sent }
        for policy in [teen, adult] {
            let event = sink.makeEvent(name: "lesson_completed", properties: [:], distinctId: "profile", policy: policy)
            XCTAssertEqual(event.properties["$process_person_profile"], .bool(true))
            XCTAssertEqual(event.properties["$geoip_disable"], .bool(true))
        }
    }

    func testEveryEventSaysWhichBuildSentIt() {
        let event = makeSink { _ in .sent }.makeEvent(name: "x", properties: [:], distinctId: "d", policy: adult)
        XCTAssertEqual(event.properties["build"], .string("debug"))
        XCTAssertEqual(event.properties["$app_version"], .string("1.0"))
        XCTAssertEqual(event.properties["$lib"], .string("paper-couch-ios"))
    }

    func testIdentifySendsNothingForAChild() {
        let sink = makeSink { _ in .sent }
        sink.identify(distinctId: "launch-id", properties: ["age_group": "under6"], policy: child)
        XCTAssertTrue(sink.queue.isEmpty)
    }

    func testIdentifySetsTheAgeGroupForATeen() {
        let sink = makeSink { _ in .sent }
        sink.identify(distinctId: "profile", properties: ["age_group": "13to15"], policy: teen)
        XCTAssertEqual(sink.queue.map(\.event), ["$identify"])
        XCTAssertEqual(sink.queue.first?.properties["$set"], .object(["age_group": "13to15"]))
    }

    func testTheBatchBodyIsWhatPostHogReads() throws {
        let sink = makeSink { _ in .sent }
        let event = sink.makeEvent(name: "path_opened", properties: ["path_id": "plants"], distinctId: "d", policy: child)
        let json = try XCTUnwrap(JSONSerialization.jsonObject(with: PostHogSink.body(for: [event])) as? [String: Any])

        XCTAssertEqual(json["api_key"] as? String, PostHogSink.projectKey)
        let first = try XCTUnwrap((json["batch"] as? [[String: Any]])?.first)
        XCTAssertEqual(first["event"] as? String, "path_opened")
        XCTAssertEqual(first["distinct_id"] as? String, "d")
        XCTAssertNotNil(first["timestamp"] as? String)
        let properties = try XCTUnwrap(first["properties"] as? [String: Any])
        XCTAssertEqual(properties["path_id"] as? String, "plants")
        XCTAssertEqual(properties["$geoip_disable"] as? Bool, true)
    }

    // MARK: - Sending

    func testAFullBatchGoesAtOnceAndLeavesTheQueue() async {
        let sent = SentBodies()
        let sink = makeSink { body in await sent.append(body); return .sent }
        for index in 0..<PostHogSink.flushCount {
            sink.capture(AnalyticsEvent(name: "e\(index)"), distinctId: "d", policy: child)
        }
        await waitUntil { sink.queue.isEmpty }
        let count = await sent.count
        XCTAssertEqual(count, 1)
    }

    func testEventsWaitForTheNetwork() async {
        let sink = makeSink { _ in .unreachable }
        sink.capture(AnalyticsEvent(name: "a"), distinctId: "d", policy: child)
        sink.flush()
        await settle()
        XCTAssertEqual(sink.queue.map(\.event), ["a"], "Kept for the next try.")
    }

    func testABatchPostHogRefusesIsLetGo() async {
        let sink = makeSink { _ in .refused }
        sink.capture(AnalyticsEvent(name: "a"), distinctId: "d", policy: child)
        sink.flush()
        await waitUntil { sink.queue.isEmpty }
        XCTAssertTrue(sink.queue.isEmpty)
    }

    func testTheQueueNeverGrowsPastItsLimit() {
        let sink = makeSink { _ in .unreachable }
        sink.flush() // Nothing queued: nothing sent, nothing held.
        for index in 0..<(PostHogSink.maxQueued + 5) {
            // Below flushCount at a time would still flush; an unreachable network
            // keeps everything, so the cap is what holds the line.
            sink.capture(AnalyticsEvent(name: "e\(index)"), distinctId: "d", policy: child)
        }
        XCTAssertLessThanOrEqual(sink.queue.count, PostHogSink.maxQueued)
        XCTAssertEqual(sink.queue.last?.event, "e\(PostHogSink.maxQueued + 4)", "The newest are the ones kept.")
    }

    // MARK: - The app's sink

    func testTheTestsSendNothing() {
        XCTAssertTrue(PostHogSink.make() is NoAnalyticsSink)
    }

    // MARK: - Helpers

    private func makeSink(_ transport: @escaping PostHogSink.Transport) -> PostHogSink {
        PostHogSink(appVersion: "1.0", build: "debug", transport: transport)
    }

    private func settle() async {
        for _ in 0..<20 { await Task.yield() }
    }

    private func waitUntil(_ condition: @MainActor () -> Bool) async {
        for _ in 0..<200 {
            if condition() { return }
            await Task.yield()
        }
    }
}

private actor SentBodies {
    private var bodies: [Data] = []
    var count: Int { bodies.count }
    func append(_ body: Data) { bodies.append(body) }
}
