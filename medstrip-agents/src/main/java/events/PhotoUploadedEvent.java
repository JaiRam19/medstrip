package events;

public record PhotoUploadedEvent(String jobId, String userId, String s3Key, int schemaVersion) {}
