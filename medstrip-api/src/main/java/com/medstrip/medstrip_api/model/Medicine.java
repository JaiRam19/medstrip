package com.medstrip.medstrip_api.model;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.time.YearMonth;
import java.util.HexFormat;

public record Medicine(
        String id,
        String name,
        String strength,
        YearMonth expiry,
        Instant addedAt,
        String source
) {
    public Medicine {
        if (name == null || name.isBlank()) {
            throw new IllegalArgumentException("name is required");
        }
        if (strength == null || strength.isBlank()) {
            throw new IllegalArgumentException("strength is required");
        }
        if (expiry == null) {
            throw new IllegalArgumentException("expiry is required");
        }

        name = name.trim().toLowerCase();
        strength = strength.replaceAll("\\s+", "").toLowerCase();

        if (addedAt == null) {
            addedAt = Instant.now();
        }
        if (source == null || source.isBlank()) {
            source = "unknown";
        }

        id = generateId(name, strength, expiry);   // overwrites whatever was passed in
    }

    private static String generateId(String name, String strength, YearMonth expiry) {
        try {
            String text = name + "|" + strength + "|" + expiry;
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hash = digest.digest(text.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    public static YearMonth parseExpiry(String text) {
        try {
            return YearMonth.parse(text);        // expects "2027-06"
        } catch (Exception e) {
            throw new IllegalArgumentException("expiry must be YYYY-MM", e);
        }
    }
}
