package com.medstrip.medstrip_agents.kafka.consumer;

import com.medstrip.medstrip_agents.repository.JobStatusRepository;
import events.PhotoUploadedEvent;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

@Component
public class PhotoUploadedListener {
    private static final Logger log = LoggerFactory.getLogger(PhotoUploadedListener.class);

    private final ObjectMapper mapper;     // same ObjectMapper import as in the API
    private final JobStatusRepository jobs;

    public PhotoUploadedListener(ObjectMapper mapper, JobStatusRepository jobs) {
        this.mapper = mapper;
        this.jobs = jobs;
    }

    @KafkaListener(topics = "medicine-photo-uploaded")
    public void onMessage(ConsumerRecord<String, String> record) throws Exception {
        PhotoUploadedEvent event = mapper.readValue(record.value(), PhotoUploadedEvent.class);

        log.info("Got job {} for user {} (partition {}, offset {})",
                event.jobId(), record.key(), record.partition(), record.offset());

        boolean updated = jobs.setStatus(event.jobId(), "READING");
        if (!updated) {
            log.warn("Job {} no longer exists, skipping", event.jobId());
        }
    }
}
