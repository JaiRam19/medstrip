package com.medstrip.medstrip_api.dto;

import com.medstrip.medstrip_api.model.Medicine;

public record MedicineReponse(Medicine medicine, long daysLeft, boolean expired) {
}
