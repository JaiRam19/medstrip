package com.medstrip.medstrip_agents.agents;

import com.medstrip.medstrip_agents.agent_results.MedicineReading;
import com.medstrip.medstrip_agents.exception.PhotoTooLargeException;
import com.medstrip.medstrip_agents.exception.ReadingException;
import com.medstrip.medstrip_agents.util.StoredPhoto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.ai.chat.client.ChatClient;
import org.springframework.ai.chat.model.ChatResponse;
import org.springframework.ai.converter.BeanOutputConverter;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.stereotype.Service;
import org.springframework.util.MimeType;
import org.springframework.util.MimeTypeUtils;

import java.util.stream.Collectors;

@Service
public class VisionReader {

    private static final int MAX_IMAGE_BYTES = 5 * 1024 * 1024;
    private Logger log = LoggerFactory.getLogger(VisionReader.class);

    private static final String SYSTEM = """
            You read a photo or text of a medicine strip.
            Extract the medicine name, the strength (for example "400 mg"), and the expiry date.
            Rules:
            - Use the EXPIRY date only. Ignore manufacturing dates (MFG).
            - Write expiry as YYYY-MM, for example 2027-06.
            - If a field is not in the text, use null. Never guess.
            - confidence is a number from 0 to 1 for how sure you are about the whole reading.
            """;

    private final ChatClient chat;

    public VisionReader(ChatClient.Builder builder) {
        this.chat = builder.build();
    }

    public MedicineReading readText(String text) {
        try {
            return chat.prompt()
                    .system(SYSTEM)
                    .user(text)
                    .call()
                    .entity(MedicineReading.class);
        } catch (Exception e) {
            throw new ReadingException("could not read the medicine", e);
        }
    }

    public MedicineReading readPhoto(StoredPhoto photo) {
        if (photo.bytes().length > MAX_IMAGE_BYTES) {
            throw new PhotoTooLargeException(photo.bytes().length);
        }
        MimeType type = MimeTypeUtils.parseMimeType(photo.contentType());
        BeanOutputConverter<MedicineReading> converter = new BeanOutputConverter<>(MedicineReading.class);

        String text = null;
        try {
            ChatResponse response = chat.prompt()
                    .system(SYSTEM + "\nReply with ONLY the JSON object. No explanation before or after it.\n"
                            + converter.getFormat())          // the exact keys and types
                    .user(u -> u.text("Read the medicine strip in this photo.")
                            .media(type, new ByteArrayResource(photo.bytes())))
                    .call()
                    .chatResponse();

            text = response.getResults().stream()                    // all parts, not only the first
                    .map(g -> g.getOutput().getText())
                    .filter(t -> t != null && !t.isBlank())
                    .collect(Collectors.joining("\n"));

            if (text.isBlank()) {
                throw new ReadingException("the model returned no answer", null);
            }
            return converter.convert(extractJson(text));
        } catch (ReadingException e) {
            throw e;
        } catch (Exception e) {
            log.error("vision reading failed. raw reply: [{}]", text, e);
            throw new ReadingException("could not read the medicine", e);
        }
    }

    /** Keep only the part from the first { to the last }, in case the model adds words around it. */
    private static String extractJson(String text) {
        int start = text.indexOf('{');
        int end = text.lastIndexOf('}');
        if (start < 0 || end <= start) {
            throw new ReadingException("the model reply has no JSON object", null);
        }
        return text.substring(start, end + 1);
    }
}
