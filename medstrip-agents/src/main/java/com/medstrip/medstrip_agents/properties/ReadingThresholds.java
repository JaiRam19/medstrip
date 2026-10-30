package com.medstrip.medstrip_agents.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.reading")
public record ReadingThresholds(double ok, double retake) {
}
