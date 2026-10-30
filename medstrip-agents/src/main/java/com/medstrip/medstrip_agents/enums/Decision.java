package com.medstrip.medstrip_agents.enums;

import com.medstrip.medstrip_agents.agent_results.MedicineReading;

public record Decision(
        Outcome outcome,
        MedicineReading reading,
        String message) {

}
