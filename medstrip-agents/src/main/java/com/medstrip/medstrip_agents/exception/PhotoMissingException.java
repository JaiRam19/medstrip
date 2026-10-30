package com.medstrip.medstrip_agents.exception;

public class PhotoMissingException extends RuntimeException{
    public PhotoMissingException(String key) {
        super("photo not found in storage: " + key);
    }
}
