package com.medstrip.medstrip_agents.exception;

public class PhotoTooLargeException extends RuntimeException {
    public PhotoTooLargeException(int bytes) {
        super("photo is too large for the model: " + bytes + " bytes");
    }
}
