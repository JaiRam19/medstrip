package com.medstrip.medstrip_agents.service;

import com.medstrip.medstrip_agents.util.AgentRun;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class AgentRunLog {

    private static final Logger log = LoggerFactory.getLogger(AgentRunLog.class);
    private static final String KEY = "agent_runs";
    private static final int KEEP = 1000;

    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;

    public AgentRunLog(StringRedisTemplate redis, ObjectMapper mapper) {
        this.redis = redis;
        this.mapper = mapper;
    }

    public void record(AgentRun run) {
        try {
            redis.opsForList().leftPush(KEY, mapper.writeValueAsString(run));   // newest first
            redis.opsForList().trim(KEY, 0, KEEP - 1);                         // keep only the last 1000
        } catch (Exception e) {
            log.warn("could not write the agent run log", e);                   // never break the agent
        }
    }
}
