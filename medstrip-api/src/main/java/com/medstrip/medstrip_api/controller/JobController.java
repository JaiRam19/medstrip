package com.medstrip.medstrip_api.controller;

import com.medstrip.medstrip_api.repository.JobRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class JobController {

    private final JobRepository jobs;

    public JobController(JobRepository jobs) {
        this.jobs = jobs;
    }

    @GetMapping("/jobs/{jobId}")
    public ResponseEntity<Map<String, Object>> get(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String jobId) {

        return jobs.find(jobId)
                .filter(j -> j.userId().equals(userId))     // someone else's job looks like "not found"
                .map(j -> ResponseEntity.ok(Map.<String, Object>of(
                        "jobId", j.jobId(),
                        "status", j.status(),
                        "createdAt", j.createdAt().toString())))
                .orElse(ResponseEntity.notFound().build());
    }
}
