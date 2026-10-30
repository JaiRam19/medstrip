package com.medstrip.medstrip_agents.events;

public record MedicineExtractedEvent(String jobId, String userId, String name, String strength,
                                     String expiry, double confidence, int schemaVersion) {}
