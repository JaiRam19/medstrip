package com.medstrip.medstrip_agents.util;

import java.time.Instant;

public record AgentRun(String agent, String jobId, Instant at, long durationMs,
                       int promptTokens, int completionTokens, String status, String summary) {}
