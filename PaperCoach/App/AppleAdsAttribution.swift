import AdServices
import Foundation

/// Which Apple Ads campaign, if any, brought this install, from Apple's AdServices
/// attribution API (https://developer.apple.com/documentation/adservices, read
/// 2026-09-26). It needs no App Tracking Transparency prompt: the token the device
/// hands the app names the install's ad tap, not the person or the device, and
/// Apple answers with a campaign, an ad group and a keyword, never an identity.
///
/// Asked on each launch until Apple answers, at most `maxLaunches` times, then kept,
/// so later launches read the stored answer and ask no one. `AppModel` passes it to
/// `Analytics`, which sends it once as `install_attributed` and puts the campaign on
/// the events that say what an install was worth (`Analytics.acquisitionEvents`).
/// Keys are `asa_*`, as in GeoBlitz, so one report can read both apps.
@MainActor
final class AppleAdsAttribution {

    /// Apple's answer, as its attribution API returns it (`clickDate` is left out).
    struct Record: Codable, Equatable {
        var attribution: Bool
        var orgId: Int?
        var campaignId: Int?
        var adGroupId: Int?
        var keywordId: Int?
        var adId: Int?
        var countryOrRegion: String?
        var conversionType: String?
        var claimType: String?
    }

    enum Response: Equatable {
        case record(Record)
        /// 404: Apple has no answer yet; ask again in a few seconds.
        case notYet
        /// Another 4xx, or a body that is not an answer: this token will not do.
        case refused
        case unreachable
    }

    typealias TokenProvider = @Sendable () async throws -> String
    typealias Transport = @Sendable (String) async -> Response

    nonisolated static let apiURL = URL(string: "https://api-adservices.apple.com/api/v1/")!
    /// Launches that may ask before the app stops trying. Apple answers for an
    /// install within 30 days of the tap, and an organic install is answered at
    /// once (`attribution` false), so only a launch that never reaches Apple
    /// uses one up.
    static let maxLaunches = 5
    /// Apple asks for about five seconds between tries while an answer is not ready.
    static let triesPerLaunch = 3
    /// The ids in the sample answer Apple gives a token that did not come from an
    /// App Store install (an Xcode or TestFlight build).
    nonisolated static let testPayloadId = 1_234_567_890

    private static let recordKey = "appleAds.record"
    private static let launchesKey = "appleAds.launchesAsked"

    private let defaults: UserDefaults
    private let retryDelay: Duration
    private let token: TokenProvider
    private let transport: Transport

    init(defaults: UserDefaults,
         retryDelay: Duration = .seconds(5),
         token: @escaping TokenProvider = AppleAdsAttribution.systemToken,
         transport: @escaping Transport = AppleAdsAttribution.urlSessionTransport) {
        self.defaults = defaults
        self.retryDelay = retryDelay
        self.token = token
        self.transport = transport
    }

    /// The answer an earlier launch was given, if any.
    var record: Record? {
        defaults.data(forKey: Self.recordKey).flatMap { try? JSONDecoder().decode(Record.self, from: $0) }
    }

    /// Asks Apple, unless the answer is already kept or the launches are used up.
    /// Returns the answer only when this call got it, so the caller reports it once.
    func resolve() async -> Record? {
        guard record == nil else { return nil }
        let launches = defaults.integer(forKey: Self.launchesKey)
        guard launches < Self.maxLaunches else { return nil }
        defaults.set(launches + 1, forKey: Self.launchesKey)
        guard let token = try? await token() else { return nil }

        for attempt in 1...Self.triesPerLaunch {
            switch await transport(token) {
            case let .record(record):
                if let data = try? JSONEncoder().encode(record) {
                    defaults.set(data, forKey: Self.recordKey)
                }
                return record
            case .notYet where attempt < Self.triesPerLaunch:
                try? await Task.sleep(for: retryDelay)
            case .notYet, .refused, .unreachable:
                return nil
            }
        }
        return nil
    }

    /// What Apple's API said, from its status and body. Pure, for the tests.
    nonisolated static func response(status: Int, body: Data) -> Response {
        switch status {
        case 200:
            guard let record = try? JSONDecoder().decode(Record.self, from: body) else { return .refused }
            return .record(record)
        case 404:
            return .notYet
        case 400..<500:
            return .refused
        default:
            return .unreachable
        }
    }

    /// The device's token. Off the main thread: Apple says the call can take a moment.
    nonisolated static let systemToken: TokenProvider = {
        try await Task.detached(priority: .utility) { try AAAttribution.attributionToken() }.value
    }

    nonisolated static let urlSessionTransport: Transport = { token in
        var request = URLRequest(url: AppleAdsAttribution.apiURL)
        request.httpMethod = "POST"
        request.setValue("text/plain", forHTTPHeaderField: "Content-Type")
        request.httpBody = Data(token.utf8)
        request.timeoutInterval = 20
        do {
            let (data, reply) = try await URLSession.shared.data(for: request)
            return AppleAdsAttribution.response(status: (reply as? HTTPURLResponse)?.statusCode ?? 0, body: data)
        } catch {
            return .unreachable
        }
    }
}

extension AppleAdsAttribution.Record {
    /// Apple's sample answer, which a development or TestFlight build is given.
    var isTestPayload: Bool { campaignId == AppleAdsAttribution.testPayloadId }

    /// The `asa_*` keys it adds to events and to a 13+ learner's person. Ids, a
    /// country and two kinds; `asa_test_payload` marks Apple's sample answer so the
    /// charts can leave it out.
    var analyticsProperties: [String: String] {
        var properties = ["asa_attribution": attribution ? "true" : "false"]
        properties["asa_org_id"] = orgId.map(String.init)
        properties["asa_campaign_id"] = campaignId.map(String.init)
        properties["asa_ad_group_id"] = adGroupId.map(String.init)
        properties["asa_keyword_id"] = keywordId.map(String.init)
        properties["asa_ad_id"] = adId.map(String.init)
        properties["asa_country_or_region"] = countryOrRegion
        properties["asa_conversion_type"] = conversionType
        properties["asa_claim_type"] = claimType
        if isTestPayload { properties["asa_test_payload"] = "true" }
        return properties
    }
}
