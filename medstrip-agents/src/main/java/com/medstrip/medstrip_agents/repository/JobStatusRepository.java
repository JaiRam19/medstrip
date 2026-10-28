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
    public boolean setStatus(String jobId, String status) {
        String key = "job:" + jobId;
        if (!Boolean.TRUE.equals(redis.hasKey(key))) {
            return false;
        }
        redis.opsForHash().put(key, "status", status);
        return true;
    }
}
