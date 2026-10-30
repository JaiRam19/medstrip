package com.medstrip.medstrip_agents.kafka.consumer;

import com.medstrip.medstrip_agents.agents.VisionReader;
import com.medstrip.medstrip_agents.enums.Decision;
import com.medstrip.medstrip_agents.kafka.producer.ExtractedPublisher;
import com.medstrip.medstrip_agents.repository.JobStatusRepository;
import com.medstrip.medstrip_agents.events.PhotoUploadedEvent;
import com.medstrip.medstrip_agents.service.PhotoStore;
import com.medstrip.medstrip_agents.service.ReadingDecider;
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
    private final PhotoStore store;
    private final VisionReader reader;
    private final ReadingDecider decider;
    private final ExtractedPublisher publisher;

    public PhotoUploadedListener(ObjectMapper mapper,
                                 JobStatusRepository jobs,
                                 PhotoStore store,
                                 VisionReader reader,
                                 ReadingDecider decider,
                                 ExtractedPublisher publisher) {
        this.mapper = mapper;
        this.jobs = jobs;
        this.store = store;
        this.reader = reader;
        this.decider = decider;
        this.publisher = publisher;
    }

    @KafkaListener(topics = "medicine-photo-uploaded")
    public void onMessage(ConsumerRecord<String, String> record) throws Exception {
        PhotoUploadedEvent event = mapper.readValue(record.value(), PhotoUploadedEvent.class);

        String status = jobs.getStatus(event.jobId());
        if (status == null) {
            log.warn("Job {} no longer exists, skipping", event.jobId());
            return;
        }

        if (!status.equals("UPLOADED") && !status.equals("READING")) {
            log.info("Job {} is already {}, skipping (duplicate delivery)", event.jobId(), status);
            return;
        }

        jobs.setStatus(event.jobId(), "READING", null);

        Decision decision = decider.decide(reader.readPhoto(store.load(event.s3Key())));
        log.info("Job {} outcome {} (confidence {})", event.jobId(), decision.outcome(), decision.reading().confidence());

        switch (decision.outcome()){
            case OK -> {
                publisher.publish(event, decision.reading());
                jobs.setStatus(event.jobId(), "LOOKING_UP", null);
            }
            case NEEDS_CONFIRMATION -> jobs.setStatus(event.jobId(), "AWAITING_CONFIRMATION", decision.message());
            case NEEDS_RETAKE -> jobs.setStatus(event.jobId(), "NEEDS_RETAKE", decision.message());
        }
    }
}
