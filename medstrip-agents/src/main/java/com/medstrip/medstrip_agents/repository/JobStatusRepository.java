package com.medstrip.medstrip_agents.repository;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

@Repository
public class JobStatusRepository {

    private final StringRedisTemplate redis;

    public JobStatusRepository(StringRedisTemplate redis) {
        this.redis = redis;
    }

    /** Only updates a job that still exists. Returns false if it is gone. */
    public boolean setStatus(String jobId, String status, String message) {
        String key = "job:" + jobId;
        if (!Boolean.TRUE.equals(redis.hasKey(key))) {
            return false;
        }
        redis.opsForHash().put(key, "status", status);

        if (message != null) {
            redis.opsForHash().put(key, "message", message);
        }
        return true;
    }

    public String getStatus(String jobId) {
        Object s = redis.opsForHash().get("job:" + jobId, "status");
        return s == null ? null : s.toString();
    }
}
