import SwiftUI
import WebKit

/// The lesson's reference picture: the real thing the drawing simplifies
/// (`hp-preview`, the player's reference thumbnail and sheet).
///
/// The catalog's references are SVG today, so vector files are rendered by a
/// non-scrolling, non-interactive `WKWebView` with a stylesheet that makes the
/// drawing fill the view; raster files use `Image`. A file that is not in the bundle
/// shows the warm placeholder of the mockup (`.photo--warm`) and no text — a missing
/// photo is not the learner's problem.
struct ReferenceImageView: View {
    let reference: LessonReference?
    var contentMode: ContentMode = .fit

    var body: some View {
        if let url = Self.url(for: reference) {
            if reference?.isVector == true {
                VectorWebView(fileURL: url)
                    .accessibilityLabel("Reference picture")
            } else if let image = UIImage(contentsOfFile: url.path) {
                Image(uiImage: image)
                    .resizable()
                    .aspectRatio(contentMode: contentMode)
                    .accessibilityLabel("Reference photo")
            } else {
                ReferencePlaceholder()
            }
        } else {
            ReferencePlaceholder()
        }
    }

    /// `References/<file>` inside the bundle. The catalog's `file` is a bare name, so
    /// this can never resolve outside that folder.
    static func url(for reference: LessonReference?, in bundle: Bundle = .main) -> URL? {
        guard let reference else { return nil }
        let name = (reference.file as NSString).deletingPathExtension
        let ext = (reference.file as NSString).pathExtension
        if let url = bundle.url(forResource: name, withExtension: ext, subdirectory: "References") {
            return url
        }
        guard let resourceURL = bundle.resourceURL else { return nil }
        let candidate = resourceURL
            .appendingPathComponent("References", isDirectory: true)
            .appendingPathComponent(reference.file)
        return FileManager.default.fileExists(atPath: candidate.path) ? candidate : nil
    }
}

/// The warm placeholder of `.photo--warm`: a calm gradient, no words.
struct ReferencePlaceholder: View {
    var body: some View {
        LinearGradient(colors: [Color(hex: "#EADCC8") ?? .gray,
                                Color(hex: "#CDAB80") ?? .gray,
                                Color(hex: "#A07F56") ?? .gray],
                       startPoint: .topLeading,
                       endPoint: .bottomTrailing)
            .accessibilityHidden(true)
    }
}

/// A vector file rendered at the view's size, with scrolling and interaction off.
private struct VectorWebView: UIViewRepresentable {
    let fileURL: URL

    func makeUIView(context: Context) -> WKWebView {
        let configuration = WKWebViewConfiguration()
        configuration.suppressesIncrementalRendering = true
        let webView = WKWebView(frame: .zero, configuration: configuration)
        webView.isOpaque = false
        webView.backgroundColor = .clear
        webView.scrollView.isScrollEnabled = false
        webView.scrollView.bounces = false
        webView.isUserInteractionEnabled = false
        return webView
    }

    func updateUIView(_ webView: WKWebView, context: Context) {
        guard let markup = try? String(contentsOf: fileURL, encoding: .utf8) else { return }
        webView.loadHTMLString(Self.page(embedding: markup), baseURL: nil)
    }

    /// The file is inlined rather than linked: a `file://` subresource would be
    /// blocked, and the whole point is one drawing filling one view.
    private static func page(embedding markup: String) -> String {
        """
        <!doctype html>
        <html><head>
        <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
        <style>
          html, body { margin: 0; height: 100%; background: transparent; }
          body { display: grid; place-items: center; }
          svg { width: 100%; height: 100%; display: block; }
        </style>
        </head><body>\(markup)</body></html>
        """
    }
}
