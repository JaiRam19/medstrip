package com.medstrip.medstrip_api.service;

import com.medstrip.medstrip_api.events.PhotoUploadedEvent;
import com.medstrip.medstrip_api.exception.EventPublishException;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.util.concurrent.TimeUnit;

@Service
public class PhotoEventPublisher {

    private static final String TOPIC = "medicine-photo-uploaded";

    private final KafkaTemplate<String, String> kafka;
    private final ObjectMapper mapper;   // the same ObjectMapper import as in the repository

    public PhotoEventPublisher(KafkaTemplate<String, String> kafka, ObjectMapper mapper) {
        this.kafka = kafka;
        this.mapper = mapper;
    }

    public void publishUploaded(String jobId, String userId, String s3Key) {
        try {
            String json = mapper.writeValueAsString(new PhotoUploadedEvent(jobId, userId, s3Key, 1));
            kafka.send(TOPIC, userId, json).get(4, TimeUnit.SECONDS);   // wait for the broker to confirm
        } catch (Exception e) {
            throw new EventPublishException("could not publish upload event", e);
        }
    }
}
