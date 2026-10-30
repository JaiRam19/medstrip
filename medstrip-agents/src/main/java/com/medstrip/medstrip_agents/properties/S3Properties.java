package com.medstrip.medstrip_agents.properties;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.s3")
public record S3Properties(String endpoint,
                           String region,
                           String bucket,
                           String accessKey,
                           String secretKey,
                           boolean pathStyleAccess) {}