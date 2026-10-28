package com.medstrip.medstrip_api.dto;

public record MedicineRequest(
        String name,
        String strength,
        String expiry
) {}
