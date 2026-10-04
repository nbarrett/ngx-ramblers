package org.ngxramblers.walking.recording;

import static org.junit.Assert.assertEquals;
import java.io.File;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.StandardOpenOption;
import java.util.stream.Collectors;
import java.util.stream.IntStream;
import org.junit.Rule;
import org.junit.Test;
import org.junit.rules.TemporaryFolder;

public class RoutePositionStoreTest {
    @Rule
    public TemporaryFolder temporary = new TemporaryFolder();

    @Test
    public void recoversLongBackgroundBatchIncrementallyAndAfterRestart() throws Exception {
        RoutePositionStore store = new RoutePositionStore(temporary.getRoot());
        store.prepare("fictional-walk", true);
        File file = temporary.getRoot().toPath().resolve("route-recordings").toFile().listFiles()[0];
        String batch = IntStream.rangeClosed(1, 20000).mapToObj(timestamp -> "{\"timestamp\":" + timestamp + "}\n")
            .collect(Collectors.joining());
        Files.write(file.toPath(), batch.getBytes(StandardCharsets.UTF_8));
        assertEquals(20000, store.positions("fictional-walk", 0).length());
        assertEquals(0, store.positions("fictional-walk", 20000).length());
        Files.write(file.toPath(), "{\"timestamp\":20001}\n".getBytes(StandardCharsets.UTF_8), StandardOpenOption.APPEND);
        assertEquals(20001, store.positions("fictional-walk", 20000).getJSONObject(0).getInt("timestamp"));
        RoutePositionStore reopened = new RoutePositionStore(temporary.getRoot());
        assertEquals(2, reopened.positions("fictional-walk", 19999).length());
        reopened.prepare("fictional-walk", true);
        assertEquals(0, reopened.positions("fictional-walk", 0).length());
    }

    @Test
    public void waitsForCompletePointBeforeAdvancingTheReadCursor() throws Exception {
        RoutePositionStore store = new RoutePositionStore(temporary.getRoot());
        store.prepare("fictional-walk", true);
        File file = temporary.getRoot().toPath().resolve("route-recordings").toFile().listFiles()[0];
        Files.write(file.toPath(), "{\"timestamp\":1}\n{\"timestamp\":2".getBytes(StandardCharsets.UTF_8));
        assertEquals(1, store.positions("fictional-walk", 0).length());
        Files.write(file.toPath(), "}\n".getBytes(StandardCharsets.UTF_8), StandardOpenOption.APPEND);
        assertEquals(2, store.positions("fictional-walk", 1).getJSONObject(0).getInt("timestamp"));
    }
}
