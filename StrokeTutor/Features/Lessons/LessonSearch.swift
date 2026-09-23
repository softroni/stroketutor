import Foundation

/// One path's worth of the Lessons list, and the level it is listed under.
struct LessonsSection: Identifiable, Equatable {
    let level: CatalogLevel?
    let path: PathModel

    var id: String { path.id }
}

/// A lesson as the Lessons list shows it, with its real one-based place in its path.
/// A search leaves gaps in a path, so the place is carried rather than counted: the
/// tile's VoiceOver label and the next-or-locked rule are both about the real lesson.
struct LessonsEntry: Identifiable, Equatable {
    let lesson: Lesson
    let position: Int

    var id: String { lesson.id }
}

/// A section as the list draws it: the path and the lessons of it that are on show —
/// every one of them, in order, when nothing is being searched.
struct LessonsSearchSection: Identifiable, Equatable {
    let level: CatalogLevel?
    let path: PathModel
    let entries: [LessonsEntry]

    var id: String { path.id }
}

/// What a search leaves of the list.
struct LessonsSearchResult: Equatable {
    /// The sections with a lesson on show, in the catalog's order.
    let sections: [LessonsSearchSection]
    /// How many lessons are on show, across every section.
    let matchCount: Int
    /// True when the query had a word to search for. A blank query, or one made only
    /// of punctuation, filters nothing and says nothing was searched.
    let isFiltered: Bool
}

/// The Lessons tab's search, kept apart from the screen so it can be tested on its
/// own. The learners are 8 to 16 and type on a phone, so it forgives what they are
/// likely to get wrong and nothing more:
///
/// * Case, accents and full-width letters do not matter, and punctuation, apostrophes
///   and "&" only split words — "sky and weather" and "Sky & Weather" read the same.
/// * A query word matches the start of a word, so a word half typed already finds
///   its lessons: "rock" finds "Rocket".
/// * A typo in a longer word is let through: one letter wrong, missing, extra or two
///   letters swapped in a word of four to six letters ("rokcet"), two in a longer
///   one. Short words are not guessed at: three letters with one wrong could be
///   almost anything, and a list of unrelated lessons is worse than none. Nor is a
///   word that already starts a word somewhere in the list: "moon" means the moon,
///   and bringing up "Mountains" one letter away would bury it.
/// * Every word has to match, in the lesson's name or its path's, so a second word
///   narrows. Typing a path's name ("space", "wheels") brings up that whole path.
/// * Little joining words ("the", "of", "and") are skipped, so "on the water" asks
///   for "water"; typed alone, they are searched for like any other word.
enum LessonSearch {

    /// Words a query drops, unless nothing else is left.
    static let stopWords: Set<String> = ["a", "an", "the", "of", "and", "in", "on", "at", "to", "with"]

    /// Filters the list's sections by `query`. A blank query returns every section
    /// with every lesson; otherwise a section keeps only its matching lessons, each
    /// at its real place in the path, and a path with none is dropped.
    static func filter(_ sections: [LessonsSection], query: String) -> LessonsSearchResult {
        let queryWords = searchWords(in: query)
        guard !queryWords.isEmpty else {
            let all = sections.map { section in
                LessonsSearchSection(level: section.level,
                                     path: section.path,
                                     entries: entries(of: section.path) { _ in true })
            }
            return LessonsSearchResult(sections: all,
                                       matchCount: all.reduce(0) { $0 + $1.entries.count },
                                       isFiltered: false)
        }

        // A word that starts some word in the list is taken as meant: "moon" is
        // looking for the moon, not for "Mountains" one letter away. Only a word
        // that starts nothing is read as a typo.
        let vocabulary = Set(sections.flatMap { section in
            words(in: section.path.title) + section.path.lessons.flatMap { words(in: $0.title) }
        })
        let terms = queryWords.map { word in
            (word: word, allowsTypos: !vocabulary.contains { $0.hasPrefix(word) })
        }

        var found: [LessonsSearchSection] = []
        for section in sections {
            let pathWords = words(in: section.path.title)
            let matching = entries(of: section.path) { lesson in
                let pool = words(in: lesson.title) + pathWords
                return terms.allSatisfy { term in
                    pool.contains { matches(queryWord: term.word, textWord: $0, allowsTypos: term.allowsTypos) }
                }
            }
            if !matching.isEmpty {
                found.append(LessonsSearchSection(level: section.level, path: section.path, entries: matching))
            }
        }
        return LessonsSearchResult(sections: found,
                                   matchCount: found.reduce(0) { $0 + $1.entries.count },
                                   isFiltered: true)
    }

    /// A path's lessons that pass `include`, each with its one-based place.
    private static func entries(of path: PathModel, where include: (Lesson) -> Bool) -> [LessonsEntry] {
        path.lessons.enumerated().compactMap { index, lesson in
            include(lesson) ? LessonsEntry(lesson: lesson, position: index + 1) : nil
        }
    }

    // MARK: - Words

    /// Folds case, accents and width, then splits on anything that is not a letter
    /// or a digit: "Café & Crème's" is ["cafe", "creme", "s"].
    static func words(in text: String) -> [String] {
        text.folding(options: [.caseInsensitive, .diacriticInsensitive, .widthInsensitive], locale: nil)
            .lowercased()
            .components(separatedBy: CharacterSet.alphanumerics.inverted)
            .filter { !$0.isEmpty }
    }

    /// A query's words with the little joining words dropped — unless that would
    /// leave nothing, in which case the query is searched as typed.
    static func searchWords(in query: String) -> [String] {
        let all = words(in: query)
        let kept = all.filter { !stopWords.contains($0) }
        return kept.isEmpty ? all : kept
    }

    // MARK: - Matching one word

    /// True when `queryWord` is the start of `textWord`, or — when typos are allowed —
    /// close enough to it, or to its start of the same length, for a typo. Both are
    /// already folded.
    static func matches(queryWord: String, textWord: String, allowsTypos: Bool = true) -> Bool {
        if textWord.hasPrefix(queryWord) { return true }
        let allowed = allowsTypos ? allowedTypos(forLength: queryWord.count) : 0
        guard allowed > 0 else { return false }

        let query = Array(queryWord)
        let text = Array(textWord)
        if distance(query, text, limit: allowed) <= allowed { return true }
        // A misspelled word still being typed: "rokc" against "rock" of "rocket".
        if text.count > query.count,
           distance(query, Array(text.prefix(query.count)), limit: allowed) <= allowed {
            return true
        }
        return false
    }

    /// How many typos a query word of this length may carry: none up to three
    /// letters, one up to six, two beyond.
    static func allowedTypos(forLength length: Int) -> Int {
        switch length {
        case ..<4: return 0
        case 4...6: return 1
        default: return 2
        }
    }

    /// The Damerau–Levenshtein distance between two words (the optimal string
    /// alignment form): one for each letter changed, added or dropped, and one for
    /// two neighbors swapped. Gives up early, returning `limit + 1`, once the words
    /// are certain to be further apart than `limit`.
    static func distance(_ a: [Character], _ b: [Character], limit: Int = .max) -> Int {
        if abs(a.count - b.count) > limit { return limit + 1 }
        if a.isEmpty { return b.count }
        if b.isEmpty { return a.count }

        // Three rows are all the recurrence looks back at.
        var before = [Int](repeating: 0, count: b.count + 1)
        var previous = Array(0...b.count)
        var current = [Int](repeating: 0, count: b.count + 1)

        for i in 1...a.count {
            current[0] = i
            var rowBest = current[0]
            for j in 1...b.count {
                let cost = a[i - 1] == b[j - 1] ? 0 : 1
                var value = min(previous[j] + 1,        // dropped from a
                                current[j - 1] + 1,     // added to a
                                previous[j - 1] + cost) // changed
                if i > 1, j > 1, a[i - 1] == b[j - 2], a[i - 2] == b[j - 1] {
                    value = min(value, before[j - 2] + 1) // two neighbors swapped
                }
                current[j] = value
                rowBest = min(rowBest, value)
            }
            if limit != .max, rowBest > limit { return limit + 1 }
            (before, previous, current) = (previous, current, before)
        }
        return limit == .max ? previous[b.count] : min(previous[b.count], limit + 1)
    }
}
