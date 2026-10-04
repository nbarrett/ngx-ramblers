import Foundation
import CryptoKit

final class RoutePositionStore {
    private let directory: URL
    private var cursorSession: String?
    private var cursorAfter: Double = 0
    private var cursorOffset: UInt64 = 0

    init(directory: URL? = nil) throws {
        self.directory = try directory ?? FileManager.default.url(for: .applicationSupportDirectory, in: .userDomainMask, appropriateFor: nil, create: true).appendingPathComponent("route-recordings", isDirectory: true)
        try FileManager.default.createDirectory(at: self.directory, withIntermediateDirectories: true, attributes: [.protectionKey: FileProtectionType.completeUntilFirstUserAuthentication])
        var excluded = self.directory
        var values = URLResourceValues()
        values.isExcludedFromBackup = true
        try excluded.setResourceValues(values)
    }

    func prepare(sessionId: String, reset: Bool) throws {
        let url = file(sessionId)
        if reset || !FileManager.default.fileExists(atPath: url.path) {
            try Data().write(to: url, options: [.atomic, .completeFileProtectionUntilFirstUserAuthentication])
            cursorSession = nil
            cursorAfter = 0
            cursorOffset = 0
        }
    }

    func append(sessionId: String, position: [String: Any]) throws {
        let handle = try FileHandle(forWritingTo: file(sessionId))
        defer { try? handle.close() }
        try handle.seekToEnd()
        var data = try JSONSerialization.data(withJSONObject: position, options: [.sortedKeys])
        data.append(0x0a)
        try handle.write(contentsOf: data)
        try handle.synchronize()
    }

    func positions(sessionId: String, after: Double) throws -> [[String: Any]] {
        let url = file(sessionId)
        if FileManager.default.fileExists(atPath: url.path) {
            let handle = try FileHandle(forReadingFrom: url)
            defer { try? handle.close() }
            let offset = cursorSession == sessionId && after >= cursorAfter ? cursorOffset : 0
            try handle.seek(toOffset: offset)
            let data = try handle.readToEnd() ?? Data()
            let complete = data.lastIndex(of: 0x0a).map { data.prefix(through: $0) } ?? Data()
            let positions = try String(decoding: complete, as: UTF8.self).split(separator: "\n").map { line in
                try JSONSerialization.jsonObject(with: Data(line.utf8)) as? [String: Any] ?? [:]
            }.filter { ($0["timestamp"] as? Double ?? 0) > after }.sorted {
                ($0["timestamp"] as? Double ?? 0) < ($1["timestamp"] as? Double ?? 0)
            }
            cursorSession = sessionId
            cursorAfter = positions.last?["timestamp"] as? Double ?? after
            cursorOffset = offset + UInt64(complete.count)
            return positions
        } else {
            return []
        }
    }

    private func file(_ sessionId: String) -> URL {
        let digest = SHA256.hash(data: Data(sessionId.utf8)).map { String(format: "%02x", $0) }.joined()
        return directory.appendingPathComponent(digest + ".jsonl")
    }
}
