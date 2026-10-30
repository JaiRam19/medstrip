package com.medstrip.medstrip_agents.controller;

import com.medstrip.medstrip_agents.agents.VisionReader;
import com.medstrip.medstrip_agents.exception.PhotoMissingException;
import com.medstrip.medstrip_agents.exception.PhotoTooLargeException;
import com.medstrip.medstrip_agents.exception.ReadingException;
import com.medstrip.medstrip_agents.service.PhotoStore;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
public class ReadTestController {

    private final VisionReader reader;
    private final PhotoStore store;

    public ReadTestController(VisionReader reader, PhotoStore store) {
        this.reader = reader;
        this.store = store;
    }

    @GetMapping("/read-text")
    public ResponseEntity<?> read(@RequestParam String text) {
        try {
            return ResponseEntity.ok(reader.readText(text));
        } catch (ReadingException e) {
            return ResponseEntity.unprocessableContent().body(Map.of("error", e.getMessage()));
        }
    }

    @GetMapping("/read-photo")
    public ResponseEntity<?> readPhoto(@RequestParam String key) {
        try {
            return ResponseEntity.ok(reader.readPhoto(store.load(key)));
        } catch (PhotoMissingException e) {
            return ResponseEntity.status(404).body(Map.of("error", e.getMessage()));
        } catch (PhotoTooLargeException | ReadingException e) {
            return ResponseEntity.unprocessableEntity().body(Map.of("error", e.getMessage()));
        }
    }
}
