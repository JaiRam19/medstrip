package com.medstrip.medstrip_agents.service;

import com.medstrip.medstrip_agents.exception.PhotoMissingException;
import com.medstrip.medstrip_agents.properties.S3Properties;
import com.medstrip.medstrip_agents.util.StoredPhoto;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.ResponseBytes;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.GetObjectRequest;
import software.amazon.awssdk.services.s3.model.GetObjectResponse;
import software.amazon.awssdk.services.s3.model.NoSuchKeyException;

@Service
public class PhotoStore {

    private final S3Client s3;
    private final S3Properties props;

    public PhotoStore(S3Client s3, S3Properties props) {
        this.s3 = s3;
        this.props = props;
    }

    public StoredPhoto load(String s3Key) {
        try {
            ResponseBytes<GetObjectResponse> object = s3.getObjectAsBytes(
                    GetObjectRequest.builder().bucket(props.bucket()).key(s3Key).build());
            return new StoredPhoto(object.asByteArray(), object.response().contentType());
        } catch (NoSuchKeyException e) {
            throw new PhotoMissingException(s3Key);
        }
    }
}
