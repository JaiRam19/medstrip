package com.medstrip.medstrip_api.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.HexFormat;
import java.util.Optional;

@Service
public class PhotoDedup {

    private static final Duration TTL = Duration.ofHours(1);
    private final StringRedisTemplate redis;

    public PhotoDedup(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public static String sha256(byte[] bytes) {
        try {
            byte[] hash = MessageDigest.getInstance("SHA-256").digest(bytes);
            return HexFormat.of().formatHex(hash);
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 not available", e);
        }
    }

    private String key(String userId, String sha) {
        return "photo:" + userId + ":" + sha;
    }

    /**
     * Try to claim this photo for the new jobId.
     * Empty = we claimed it, go ahead. Present = it was already uploaded, here is the old jobId.
     */
    public Optional<String> claim(String userId, String sha, String jobId) {
        String key = key(userId, sha);
        Boolean claimed = redis.opsForValue().setIfAbsent(key, jobId, TTL);   // atomic: set only if absent
        if (Boolean.TRUE.equals(claimed)) {
            return Optional.empty();
        }
        return Optional.ofNullable(redis.opsForValue().get(key));
    }

    public void release(String userId, String sha) {
        redis.delete(key(userId, sha));
    }
}
