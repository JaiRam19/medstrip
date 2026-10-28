package com.medstrip.medstrip_api.service;

import com.medstrip.medstrip_api.dto.MedicineReponse;
import com.medstrip.medstrip_api.dto.MedicineRequest;
import com.medstrip.medstrip_api.model.Medicine;
import com.medstrip.medstrip_api.repository.CabinetRepository;
import org.springframework.stereotype.Service;

import java.time.LocalDate;
import java.time.YearMonth;
import java.time.temporal.ChronoUnit;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
public class CabinetService {

    private final CabinetRepository cabinetRepository;

    public CabinetService(CabinetRepository cabinetRepository){
        this.cabinetRepository = cabinetRepository;
    }

    public List<MedicineReponse> getMedicines(String userId){
        List<Medicine> medicines = cabinetRepository.finaAll(userId);

        if(Objects.nonNull(medicines) && !medicines.isEmpty()){
            return medicines.stream()
                    .map(medicine ->
                    {
                        long daysLeft = calculateDaysLeft(medicine.expiry());
                        return new MedicineReponse(medicine, daysLeft, isExpired(daysLeft));
                    })
                    .sorted(Comparator.comparingLong(MedicineReponse::daysLeft))
                    .toList();
        }
        return new ArrayList<>();
    }

    private long calculateDaysLeft(YearMonth expiryDate){
        return ChronoUnit.DAYS.between(LocalDate.now(), expiryDate.atEndOfMonth());
    }

    private boolean isExpired(long days){
        return days <= 0;
    }
}
