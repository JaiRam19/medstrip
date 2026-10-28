package com.medstrip.medstrip_api.service;

import com.medstrip.medstrip_api.properties.S3Properties;
import org.springframework.stereotype.Service;
import software.amazon.awssdk.core.sync.RequestBody;
import software.amazon.awssdk.services.s3.S3Client;
import software.amazon.awssdk.services.s3.model.PutObjectRequest;

@Service
public class PhotoStorage {

    private final S3Client s3;
    private final S3Properties props;

    public PhotoStorage(S3Client s3, S3Properties props) {
        this.s3 = s3;
        this.props = props;
    }

    public String save(String userId, String jobId, byte[] bytes, String ext, String contentType) {
        String key = userId + "/" + jobId + "." + ext;
        s3.putObject(
                PutObjectRequest.builder()
                        .bucket(props.bucket())
                        .key(key)
                        .contentType(contentType)
                        .build(),
                RequestBody.fromBytes(bytes));
        return key;
    }
}
