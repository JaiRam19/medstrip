package com.medstrip.medstrip_api.exception;

public class RateLimitExceededException extends RuntimeException{

    private final long retryAfterSeconds;

    public RateLimitExceededException(long retryAfterSeconds) {
        super("too many uploads");
        this.retryAfterSeconds = retryAfterSeconds;
    }

    public long getRetryAfterSeconds() {
        return retryAfterSeconds;
    }
}
