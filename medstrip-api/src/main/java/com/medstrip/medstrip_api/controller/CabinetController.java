package com.medstrip.medstrip_api.controller;

import com.medstrip.medstrip_api.dto.MedicineReponse;
import com.medstrip.medstrip_api.dto.MedicineRequest;
import com.medstrip.medstrip_api.model.Medicine;
import com.medstrip.medstrip_api.repository.CabinetRepository;
import com.medstrip.medstrip_api.service.CabinetService;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Objects;

@RestController
@RequestMapping("/cabinet")
public class CabinetController {

    private final CabinetRepository cabinet;
    private final CabinetService service;

    public CabinetController(CabinetRepository cabinet, CabinetService service) {
        this.cabinet = cabinet;
        this.service = service;
    }

    @PostMapping
    public ResponseEntity<Medicine> addMedicine(
            @RequestHeader("X-User-Id") String userId,
            @RequestBody MedicineRequest request) {

        if(Objects.isNull(userId) || userId.isBlank()){
            throw new IllegalArgumentException("User Id is required in the header");
        }

        if(Objects.isNull(request)){
            throw new IllegalArgumentException("Medicine details are required");
        }

        Medicine medicine = new Medicine(
                null,
                request.name(),
                request.strength(),
                Medicine.parseExpiry(request.expiry()),
                null,
                "manual");

        boolean added = cabinet.addIfAbsent(userId, medicine);

        if (added) {
            return ResponseEntity.status(HttpStatus.CREATED).body(medicine);
        }
        Medicine existing = cabinet.find(userId, medicine.id()).orElse(medicine);
        return ResponseEntity.ok(existing);
    }

    @GetMapping
    public ResponseEntity<List<MedicineReponse>> getAllMedicines(@RequestHeader("X-User-Id") String userId){
        if(Objects.isNull(userId) || userId.isBlank()){
            throw new IllegalArgumentException("User Id is required in the header");
        }
        return ResponseEntity.ok(service.getMedicines(userId));
    }

    @DeleteMapping("/{id}")
    public ResponseEntity<Void> delete(
            @RequestHeader("X-User-Id") String userId,
            @PathVariable String id) {

        boolean removed = cabinet.deleteById(userId, id);
        return removed
                ? ResponseEntity.noContent().build()      // 204
                : ResponseEntity.notFound().build();      // 404
    }

}
