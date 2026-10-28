package com.medstrip.medstrip_api.service;

import com.medstrip.medstrip_api.exception.RateLimitExceededException;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class RateLimiter {
    private static final int LIMIT = 5;
    private static final Duration WINDOW = Duration.ofSeconds(60);

    private final StringRedisTemplate redis;

    public RateLimiter(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void check(String userId) {
        String key = "rate:" + userId;

        // create with expiry in one atomic command, only if it does not exist yet
        redis.opsForValue().setIfAbsent(key, "0", WINDOW);
        Long count = redis.opsForValue().increment(key);

        if (count != null && count > LIMIT) {
            Long ttl = redis.getExpire(key);              // seconds left in this window
            long retryAfter = (ttl == null || ttl < 1) ? WINDOW.toSeconds() : ttl;
            throw new RateLimitExceededException(retryAfter);
        }
    }

}
