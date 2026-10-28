package com.medstrip.medstrip_api.repository;

import com.medstrip.medstrip_api.model.Job;
import org.springframework.data.redis.core.RedisOperations;
import org.springframework.data.redis.core.SessionCallback;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;

import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.Optional;

@Repository
public class JobRepository {

    private static final Duration TTL = Duration.ofDays(7);
    private final StringRedisTemplate redis;

    public JobRepository(StringRedisTemplate redis) {
        this.redis = redis;
    }

    private String key(String jobId) {
        return "job:" + jobId;
    }

    public void create(String jobId, String userId, String s3Key) {
        Map<String, String> fields = Map.of(
                "userId", userId,
                "s3Key", s3Key,
                "status", "UPLOADED",
                "createdAt", Instant.now().toString());

        // MULTI/EXEC: both commands run together or not at all
        redis.execute(new SessionCallback<Object>() {
            @Override
            @SuppressWarnings({"unchecked", "rawtypes"})
            public Object execute(RedisOperations ops) {
                ops.multi();
                ops.opsForHash().putAll(key(jobId), fields);
                ops.expire(key(jobId), TTL);
                return ops.exec();
            }
        });
    }

    public Optional<Job> find(String jobId) {
        Map<Object, Object> f = redis.opsForHash().entries(key(jobId));
        if (f.isEmpty()) {
            return Optional.empty();
        }
        return Optional.of(new Job(
                jobId,
                (String) f.get("userId"),
                (String) f.get("s3Key"),
                (String) f.get("status"),
                Instant.parse((String) f.get("createdAt"))));
    }

    public void delete(String jobId) {
        redis.delete(key(jobId));
    }
}
