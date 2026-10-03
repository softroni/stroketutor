import XCTest

/// Drives the installed Paper Coach from a script in the STSCRIPT environment
/// variable (passed as TEST_RUNNER_STSCRIPT): commands separated by "|".
///   launch <args...>        terminate, then launch with these launch arguments
///   wait <seconds>
///   tap <kind>:<label>      kind: button, text, cell, any, id; waits up to 10 s
///   tapxy <x>,<y>           normalized point on the app's window
///   hold <x>,<y> <sec>
///   drag <x1>,<y1> <x2>,<y2> <sec>
///   swipe <up|down|left|right>
///   rotate <portrait|left|right>
///   key <characters>        typed into the app (a hardware keyboard)
///   dump                    print the accessibility tree
///   mark <name>             print MARK <name> <unix time>
final class Driver: XCTestCase {
    let app = XCUIApplication(bundleIdentifier: "com.softroni.papercoach")

    func testScript() throws {
        continueAfterFailure = false
        let script = ProcessInfo.processInfo.environment["STSCRIPT"] ?? ""
        for raw in script.split(separator: "|") {
            let line = raw.trimmingCharacters(in: .whitespaces)
            if line.isEmpty { continue }
            let parts = line.split(separator: " ", maxSplits: 1).map(String.init)
            let cmd = parts[0], arg = parts.count > 1 ? parts[1] : ""
            print("STEP \(line) \(Date().timeIntervalSince1970)")
            switch cmd {
            case "launch":
                app.terminate()
                app.launchArguments = arg.split(separator: " ").map(String.init)
                app.launch()
            case "activate":
                app.activate()
            case "wait":
                Thread.sleep(forTimeInterval: Double(arg) ?? 1)
            case "tap":
                let e = element(arg)
                if e.isHittable { e.tap() } else { e.coordinate(withNormalizedOffset: CGVector(dx: 0.5, dy: 0.5)).tap() }
            case "tapif":
                let e = element(arg, timeout: 2, required: false)
                if e.exists { e.tap() }
            case "tapxy":
                point(arg).tap()
            case "hold":
                let p = arg.split(separator: " ")
                point(String(p[0])).press(forDuration: Double(p[1]) ?? 1)
            case "drag":
                let p = arg.split(separator: " ")
                point(String(p[0])).press(forDuration: 0.05, thenDragTo: point(String(p[1])),
                                          withVelocity: .slow, thenHoldForDuration: 0.1)
            case "swipe":
                switch arg {
                case "up": app.swipeUp(velocity: .slow)
                case "down": app.swipeDown(velocity: .slow)
                case "left": app.swipeLeft(velocity: .slow)
                default: app.swipeRight(velocity: .slow)
                }
            case "rotate":
                XCUIDevice.shared.orientation = arg == "left" ? .landscapeLeft
                    : arg == "right" ? .landscapeRight : .portrait
            case "key":
                app.typeText(arg)
            case "dump":
                print("DUMP-BEGIN\n\(app.debugDescription)\nDUMP-END")
            case "mark":
                print("MARK \(arg) \(Date().timeIntervalSince1970)")
            default:
                XCTFail("Unknown command \(cmd)")
            }
        }
    }

    private func element(_ spec: String, timeout: Double = 10, required: Bool = true) -> XCUIElement {
        let kind = spec.prefix { $0 != ":" }
        let label = String(spec.dropFirst(kind.count + 1))
        let e: XCUIElement
        switch kind {
        case "button": e = app.buttons[label].firstMatch
        case "text": e = app.staticTexts[label].firstMatch
        case "cell": e = app.cells[label].firstMatch
        case "id": e = app.descendants(matching: .any).matching(identifier: label).firstMatch
        case "contains":
            e = app.descendants(matching: .any).matching(NSPredicate(format: "label CONTAINS %@", label)).firstMatch
        case "buttoncontains":
            e = app.buttons.matching(NSPredicate(format: "label CONTAINS %@", label)).firstMatch
        default: e = app.descendants(matching: .any)[label].firstMatch
        }
        if !e.waitForExistence(timeout: timeout) && required {
            print("DUMP-BEGIN\n\(app.debugDescription)\nDUMP-END")
            XCTFail("Not found: \(spec)")
        }
        return e
    }

    private func point(_ s: String) -> XCUICoordinate {
        let xy = s.split(separator: ",").map { Double($0) ?? 0.5 }
        return app.windows.firstMatch.coordinate(withNormalizedOffset: CGVector(dx: xy[0], dy: xy[1]))
    }
}
