package com.medstrip.medstrip_agents.util;

import com.medstrip.medstrip_agents.agent_results.MedicineReading;

public record ReadResult(MedicineReading reading, int promptTokens, int completionTokens) {}
