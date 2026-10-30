package com.medstrip.medstrip_agents;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.ConfigurationPropertiesScan;

@ConfigurationPropertiesScan
@SpringBootApplication
public class MedstripAgentsApplication {

	public static void main(String[] args) {
		SpringApplication.run(MedstripAgentsApplication.class, args);
	}

}
