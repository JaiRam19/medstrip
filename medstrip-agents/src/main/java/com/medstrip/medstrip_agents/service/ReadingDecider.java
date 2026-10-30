package com.medstrip.medstrip_agents.service;

import com.medstrip.medstrip_agents.agent_results.MedicineReading;
import com.medstrip.medstrip_agents.enums.Decision;
import com.medstrip.medstrip_agents.enums.Outcome;
import com.medstrip.medstrip_agents.properties.ReadingThresholds;
import org.springframework.stereotype.Component;

import java.time.Year;
import java.time.YearMonth;

@Component
public class ReadingDecider {

    private final ReadingThresholds limits;

    public ReadingDecider(ReadingThresholds limits) {
        this.limits = limits;
    }

    public Decision decide(MedicineReading raw) {
        MedicineReading r = clean(raw);

        boolean nothingReadable = r.name() == null && r.strength() == null && r.expiry() == null;
        if (nothingReadable || r.confidence() < limits.retake()) {
            return new Decision(Outcome.NEEDS_RETAKE, r,
                    "We couldn't read this photo. Retake it in good light with the strip flat.");
        }

        boolean missingField = r.name() == null || r.strength() == null || r.expiry() == null;
        if (missingField || r.confidence() < limits.ok()) {
            return new Decision(Outcome.NEEDS_CONFIRMATION, r,
                    "Please check what we read before we continue.");
        }

        return new Decision(Outcome.OK, r, "OK");
    }

    static MedicineReading clean(MedicineReading raw) {
        double confidence = Double.isNaN(raw.confidence()) ? 0 : Math.max(0, Math.min(1, raw.confidence()));
        return new MedicineReading(
                blankToNull(raw.name()),
                blankToNull(raw.strength()),
                validExpiry(raw.expiry()),
                confidence);
    }

    private static String blankToNull(String s) {
        return (s == null || s.isBlank()) ? null : s.trim();
    }

    private static String validExpiry(String s) {
        if (s == null) {
            return null;
        }
        try {
            YearMonth ym = YearMonth.parse(s.trim());
            int year = ym.getYear();
            int now = Year.now().getValue();
            return (year < 2000 || year > now + 20) ? null : ym.toString();
        } catch (Exception e) {
            return null;
        }
    }
}
