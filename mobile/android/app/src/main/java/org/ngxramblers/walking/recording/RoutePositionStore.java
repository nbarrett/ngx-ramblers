package org.ngxramblers.walking.recording;

import android.content.Context;
import android.location.Location;
import java.io.File;
import java.io.FileOutputStream;
import java.io.RandomAccessFile;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import org.json.JSONArray;
import org.json.JSONObject;

final class RoutePositionStore {
    private final File directory;
    private String cursorSession;
    private double cursorAfter;
    private long cursorOffset;

    RoutePositionStore(Context context) throws Exception {
        this(context.getNoBackupFilesDir());
    }

    RoutePositionStore(File storageDirectory) throws Exception {
        directory = new File(storageDirectory, "route-recordings");
        if (!directory.isDirectory() && !directory.mkdirs()) {
            throw new IllegalStateException("Could not create recording storage");
        }
    }

    void prepare(String sessionId, boolean reset) throws Exception {
        synchronized (RoutePositionStore.class) {
            File file = file(sessionId);
            if (reset || !file.exists()) {
                try (FileOutputStream output = new FileOutputStream(file)) {
                    output.getFD().sync();
                }
                cursorSession = null;
                cursorAfter = 0;
                cursorOffset = 0;
            }
        }
    }

    void append(String sessionId, Location location) throws Exception {
        synchronized (RoutePositionStore.class) {
            JSONObject point = new JSONObject();
            point.put("latitude", location.getLatitude());
            point.put("longitude", location.getLongitude());
            point.put("accuracy", location.getAccuracy());
            point.put("altitude", location.hasAltitude() ? location.getAltitude() : JSONObject.NULL);
            point.put("heading", location.hasBearing() ? location.getBearing() : JSONObject.NULL);
            point.put("timestamp", location.getTime());
            try (FileOutputStream output = new FileOutputStream(file(sessionId), true)) {
                output.write((point.toString() + "\n").getBytes(StandardCharsets.UTF_8));
                output.getFD().sync();
            }
        }
    }

    JSONArray positions(String sessionId, double after) throws Exception {
        synchronized (RoutePositionStore.class) {
            JSONArray positions = new JSONArray();
            File file = file(sessionId);
            if (file.exists()) {
                try (RandomAccessFile input = new RandomAccessFile(file, "r")) {
                    long offset = sessionId.equals(cursorSession) && after >= cursorAfter ? cursorOffset : 0;
                    input.seek(offset);
                    byte[] remaining = new byte[Math.toIntExact(input.length() - offset)];
                    input.readFully(remaining);
                    int completeLength = java.util.stream.IntStream.range(0, remaining.length)
                        .filter(index -> remaining[index] == 10).max().orElse(-1) + 1;
                    String complete = new String(remaining, 0, completeLength, StandardCharsets.UTF_8);
                    for (String line : complete.split("\\n")) {
                        if (!line.isEmpty()) {
                            JSONObject point = new JSONObject(line);
                            if (point.getDouble("timestamp") > after) {
                                positions.put(point);
                            }
                        }
                    }
                    input.seek(offset + completeLength);
                    cursorSession = sessionId;
                    cursorAfter = positions.length() > 0 ? positions.getJSONObject(positions.length() - 1).getDouble("timestamp") : after;
                    cursorOffset = input.getFilePointer();
                }
            }
            return positions;
        }
    }

    private File file(String sessionId) throws Exception {
        byte[] digest = MessageDigest.getInstance("SHA-256").digest(sessionId.getBytes(StandardCharsets.UTF_8));
        String name = java.util.stream.IntStream.range(0, digest.length)
            .mapToObj(index -> String.format("%02x", digest[index])).collect(java.util.stream.Collectors.joining());
        return new File(directory, name + ".jsonl");
    }
}
