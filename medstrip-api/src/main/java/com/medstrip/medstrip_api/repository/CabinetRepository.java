package com.medstrip.medstrip_api.repository;

import com.medstrip.medstrip_api.model.Medicine;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Repository;
import tools.jackson.core.JacksonException;
import tools.jackson.databind.ObjectMapper;

import javax.swing.text.html.Option;
import java.util.ArrayList;
import java.util.List;
import java.util.Objects;
import java.util.Optional;

@Repository
public class CabinetRepository {

    private final StringRedisTemplate redis;
    private final ObjectMapper mapper;   // import the ObjectMapper your IDE suggests

    public CabinetRepository(StringRedisTemplate redis, ObjectMapper mapper) {
        this.redis = redis;
        this.mapper = mapper;
    }

    private String key(String userId) {
        return "cabinet:" + userId;
    }

    /** true = new medicine added, false = it was already there. One atomic Redis command. */
    public boolean addIfAbsent(String userId, Medicine medicine) {
        String json;
        try {
            json = mapper.writeValueAsString(medicine);
        } catch (Exception e) {
            throw new IllegalStateException("could not save medicine", e);
        }
        Boolean added = redis.opsForHash().putIfAbsent(key(userId), medicine.id(), json);
        return Boolean.TRUE.equals(added);
    }

    public Optional<Medicine> find(String userId, String medicineId) {
        try {
            Object json = redis.opsForHash().get(key(userId), medicineId);
            if (json == null) {
                return Optional.empty();
            }
            return Optional.of(mapper.readValue(json.toString(), Medicine.class));
        } catch (Exception e) {
            throw new IllegalStateException("could not read medicine", e);
        }
    }

    public List<Medicine> finaAll(String userId){

        List<Object> jsonList = redis.opsForHash().values(key(userId));
        List<Medicine> medicines = new ArrayList<>();

        for (Object json : jsonList){
            try {
                medicines.add(mapper.readValue(json.toString(), Medicine.class));
            } catch (JacksonException e) {
                throw new RuntimeException(e.getMessage());
            }
        }
        return medicines;
    }

    public boolean deleteById(String userId, String medicineId) {
        Long removed = redis.opsForHash().delete(key(userId), medicineId);
        return removed != null && removed > 0;
    }
}
