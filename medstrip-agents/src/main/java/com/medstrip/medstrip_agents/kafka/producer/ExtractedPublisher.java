package com.medstrip.medstrip_agents.kafka.producer;

import com.medstrip.medstrip_agents.agent_results.MedicineReading;
import com.medstrip.medstrip_agents.events.MedicineExtractedEvent;
import com.medstrip.medstrip_agents.events.PhotoUploadedEvent;
import org.springframework.kafka.core.KafkaTemplate;
import org.springframework.stereotype.Service;
import tools.jackson.databind.ObjectMapper;

import java.util.concurrent.TimeUnit;

@Service
public class ExtractedPublisher {
    private final KafkaTemplate<String, String> kafka;
    private final ObjectMapper mapper;

    public ExtractedPublisher(KafkaTemplate<String, String> kafka, ObjectMapper mapper) {
        this.kafka = kafka;
        this.mapper = mapper;
    }

    public void publish(PhotoUploadedEvent in, MedicineReading r) {
        try {
            String json = mapper.writeValueAsString(new MedicineExtractedEvent(
                    in.jobId(), in.userId(), r.name(), r.strength(), r.expiry(), r.confidence(), 1));
            kafka.send("medicine-extracted", in.userId(), json).get(4, TimeUnit.SECONDS);
        } catch (Exception e) {
            throw new IllegalStateException("could not publish medicine-extracted", e);
        }
    }
}
