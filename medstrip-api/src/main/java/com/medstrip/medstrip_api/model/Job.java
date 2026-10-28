package com.medstrip.medstrip_api.model;

import java.time.Instant;

public record Job(String jobId, String userId, String s3Key, String status, Instant createdAt) {}
