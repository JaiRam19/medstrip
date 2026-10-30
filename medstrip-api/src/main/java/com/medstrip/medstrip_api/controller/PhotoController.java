package com.medstrip.medstrip_api.controller;

import com.medstrip.medstrip_api.exception.EventPublishException;
import com.medstrip.medstrip_api.exception.UnsupportedPhotoException;
import com.medstrip.medstrip_api.repository.JobRepository;
import com.medstrip.medstrip_api.service.PhotoDedup;
import com.medstrip.medstrip_api.service.PhotoEventPublisher;
import com.medstrip.medstrip_api.service.PhotoStorage;
import com.medstrip.medstrip_api.service.RateLimiter;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.UUID;

@RestController
public class PhotoController {

    private final PhotoStorage storage;
    private final JobRepository jobs;
    private final PhotoEventPublisher events;
    private final RateLimiter rateLimiter;
    private final PhotoDedup dedup;

    public PhotoController(PhotoStorage storage,
                           JobRepository job,
                           PhotoEventPublisher events,
                           RateLimiter rateLimiter,
                           PhotoDedup dedup) {
        this.storage = storage;
        this.jobs = job;
        this.events = events;
        this.rateLimiter = rateLimiter;
        this.dedup = dedup;
    }


    @PostMapping(value = "/photos", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public ResponseEntity<Map<String, String>> upload(
            @RequestHeader("X-User-Id") String userId,
            @RequestParam("file") MultipartFile file) throws IOException {

        if(Objects.isNull(userId) || userId.isBlank()){
            throw new IllegalArgumentException("User Id is required in the header");
        }
        rateLimiter.check(userId);

        byte[] bytes = file.getBytes();
        if (bytes.length == 0) {
            throw new IllegalArgumentException("file is empty");
        }
        if (!isJpeg(bytes) && !isPng(bytes)) {
            throw new UnsupportedPhotoException("only JPEG and PNG photos are accepted");
        }

        String sha = PhotoDedup.sha256(bytes);
        String jobId = UUID.randomUUID().toString();

        Optional<String> existing = dedup.claim(userId, sha, jobId);
        if (existing.isPresent()) {
            return ResponseEntity.ok(Map.of("jobId", existing.get(), "duplicate", "true"));
        }

        try {
            boolean jpeg = isJpeg(bytes);
            String ext = jpeg ? "jpg" : "png";
            String contentType = jpeg ? "image/jpeg" : "image/png";

            String s3Key = storage.save(userId, jobId, bytes, ext, contentType);
            jobs.create(jobId, userId, s3Key);

            try {
                events.publishUploaded(jobId, userId, s3Key);
            } catch (EventPublishException e) {
                jobs.delete(jobId);
                throw e;
            }
        } catch (RuntimeException e) {
            dedup.release(userId, sha);      // the upload failed, so let the retry go through
            throw e;
        }

        return ResponseEntity.accepted().body(Map.of("jobId", jobId));
    }



    private static boolean isJpeg(byte[] b) {
        return b.length > 3 && (b[0] & 0xFF) == 0xFF && (b[1] & 0xFF) == 0xD8 && (b[2] & 0xFF) == 0xFF;
    }

    private static boolean isPng(byte[] b) {
        return b.length > 4 && (b[0] & 0xFF) == 0x89 && b[1] == 'P' && b[2] == 'N' && b[3] == 'G';
    }
}
