package com.medstrip.medstrip_agents.kafka.consumer;

import com.medstrip.medstrip_agents.agents.VisionReader;
import com.medstrip.medstrip_agents.enums.Decision;
import com.medstrip.medstrip_agents.kafka.producer.ExtractedPublisher;
import com.medstrip.medstrip_agents.repository.JobStatusRepository;
import com.medstrip.medstrip_agents.events.PhotoUploadedEvent;
import com.medstrip.medstrip_agents.service.AgentRunLog;
import com.medstrip.medstrip_agents.service.PhotoStore;
import com.medstrip.medstrip_agents.service.ReadingDecider;
import com.medstrip.medstrip_agents.util.AgentRun;
import com.medstrip.medstrip_agents.util.ReadResult;
import org.apache.kafka.clients.consumer.ConsumerRecord;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.kafka.annotation.KafkaListener;
import org.springframework.stereotype.Component;
import tools.jackson.databind.ObjectMapper;

import java.time.Instant;

@Component
public class PhotoUploadedListener {
    private static final Logger log = LoggerFactory.getLogger(PhotoUploadedListener.class);

    private final ObjectMapper mapper;     // same ObjectMapper import as in the API
    private final JobStatusRepository jobs;
    private final PhotoStore store;
    private final VisionReader reader;
    private final ReadingDecider decider;
    private final ExtractedPublisher publisher;
    private final AgentRunLog runLog;

    public PhotoUploadedListener(ObjectMapper mapper,
                                 JobStatusRepository jobs,
                                 PhotoStore store,
                                 VisionReader reader,
                                 ReadingDecider decider,
                                 ExtractedPublisher publisher, AgentRunLog runLog) {
        this.mapper = mapper;
        this.jobs = jobs;
        this.store = store;
        this.reader = reader;
        this.decider = decider;
        this.publisher = publisher;
        this.runLog = runLog;
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

        long start = System.nanoTime();

        try {
            ReadResult result = reader.readPhoto(store.load(event.s3Key()));
            Decision decision = decider.decide(result.reading());
            log.info("Job {} outcome {} (confidence {})", event.jobId(), decision.outcome(), decision.reading().confidence());

            switch (decision.outcome()){
                case OK -> {
                    publisher.publish(event, decision.reading());
                    jobs.setStatus(event.jobId(), "LOOKING_UP", null);
                }
                case NEEDS_CONFIRMATION -> jobs.setStatus(event.jobId(), "AWAITING_CONFIRMATION", decision.message());
                case NEEDS_RETAKE -> jobs.setStatus(event.jobId(), "NEEDS_RETAKE", decision.message());
            }

            runLog.record(new AgentRun("vision-reader", event.jobId(), Instant.now(),
                    (System.nanoTime() - start) / 1_000_000,
                    result.promptTokens(), result.completionTokens(),
                    decision.outcome().name(),
                    decision.reading().name() + " " + decision.reading().strength() + ", confidence " + decision.reading().confidence()));

        } catch (RuntimeException e) {
            runLog.record(new AgentRun("vision-reader", event.jobId(), Instant.now(),
                    (System.nanoTime() - start) / 1_000_000, 0, 0, "ERROR",
                    e.getClass().getSimpleName() + ": " + e.getMessage()));

            throw e;
        }
    }


}
