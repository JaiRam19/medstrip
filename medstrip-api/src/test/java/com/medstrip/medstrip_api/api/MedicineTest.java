package com.medstrip.medstrip_api.api;


import com.medstrip.medstrip_api.model.Medicine;
import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

public class MedicineTest {

    @Test
    void sameInputGivesSameId() {
        Medicine a = new Medicine(null, "Ibuprofen", "400mg",
                Medicine.parseExpiry("2027-06"), null, "photo");
        Medicine b = new Medicine(null, "Ibuprofen", "400mg",
                Medicine.parseExpiry("2027-06"), null, "photo");

        assertThat(a.id()).isEqualTo(b.id());
    }

    @Test
    void spacingAndCaseDoNotChangeId() {
        Medicine a = new Medicine(null, " Ibuprofen ", "400 mg",
                Medicine.parseExpiry("2027-06"), null, "photo");
        Medicine b = new Medicine(null, "ibuprofen", "400mg",
                Medicine.parseExpiry("2027-06"), null, "photo");

        assertThat(a.id()).isEqualTo(b.id());
    }

    @Test
    void blankNameIsRejected() {
        assertThatThrownBy(() -> new Medicine(null, "  ", "400mg",
                Medicine.parseExpiry("2027-06"), null, "photo"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void badExpiryIsRejected() {
        assertThatThrownBy(() -> Medicine.parseExpiry("13/2027"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void differentInputShouldGenerateDifferentId() {
        Medicine a = new Medicine(null, "Ibuprofen", "400mg",
                Medicine.parseExpiry("2027-07"), null, "photo");
        Medicine b = new Medicine(null, "Ibuprofen", "400mg",
                Medicine.parseExpiry("2027-06"), null, "photo");

        assertThat(a.id()).isNotEqualTo(b.id());
    }


}
