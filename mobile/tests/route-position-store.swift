import Foundation

@main
struct RoutePositionStoreChecks {
    static func main() throws {
        let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString)
        let store = try RoutePositionStore(directory: directory)
        try store.prepare(sessionId: "fictional-walk", reset: true)
        try (1...2000).forEach { timestamp in
            try store.append(sessionId: "fictional-walk", position: ["timestamp": timestamp, "latitude": 51.0, "longitude": 0.0])
        }
        let backgroundBatchRecovered = try store.positions(sessionId: "fictional-walk", after: 0).count == 2000
        precondition(backgroundBatchRecovered)
        let noDuplicatePoints = try store.positions(sessionId: "fictional-walk", after: 2000).isEmpty
        precondition(noDuplicatePoints)
        try store.append(sessionId: "fictional-walk", position: ["timestamp": 2001, "latitude": 51.0, "longitude": 0.0])
        let newPointRecovered = try store.positions(sessionId: "fictional-walk", after: 2000).count == 1
        precondition(newPointRecovered)
        let reopened = try RoutePositionStore(directory: directory)
        let savedPointsRecoveredAfterRestart = try reopened.positions(sessionId: "fictional-walk", after: 1999).count == 2
        precondition(savedPointsRecoveredAfterRestart)
        try reopened.prepare(sessionId: "fictional-walk", reset: true)
        let replacementIsEmpty = try reopened.positions(sessionId: "fictional-walk", after: 0).isEmpty
        precondition(replacementIsEmpty)
        try FileManager.default.removeItem(at: directory)
    }
}
