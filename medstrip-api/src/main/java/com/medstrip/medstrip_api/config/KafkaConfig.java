package com.medstrip.medstrip_api.config;

import org.apache.kafka.clients.admin.NewTopic;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.kafka.config.TopicBuilder;

@Configuration
public class KafkaConfig {

    @Bean
    public NewTopic photoUploadedTopic() {
        return TopicBuilder.name("medicine-photo-uploaded")
                .partitions(3)
                .replicas(1)
                .build();
    }
}
